"""Automatic & on-demand album cover art generation using Z-Image-Turbo and diffusers."""
from __future__ import annotations

import gc
import json
from pathlib import Path
import re
import urllib.request

from .settings import ROOT


def extract_genre_mood(style_text: str) -> tuple[str, str]:
    """Extract evocative visual descriptors and style tags from a YuE2 musical style prompt."""
    text = style_text.lower()
    
    genres = []
    if any(k in text for k in ('synth', 'cyberpunk', 'retro', '80s', 'neon', 'wave')):
        genres.append('cyberpunk retro synthwave, glowing neon lights, futuristic grid lines, dark chrome reflections')
    if any(k in text for k in ('celtic', 'scottish', 'braveheart', 'pipe', 'irish', 'folk', 'whistle')):
        genres.append('mystical highland mountains, foggy Celtic landscape, ancient stone ruins, epic cinematic atmosphere')
    if any(k in text for k in ('metal', 'rock', 'guitar', 'heavy', 'distort', 'punk', 'grunge')):
        genres.append('dark gritty textured rock aesthetic, high-contrast dynamic lighting, dramatic shadows, raw expressive energy')
    if any(k in text for k in ('acoustic', 'indie', 'intimate', 'piano', 'warm', 'ballad')):
        genres.append('warm analog film photography, golden hour sunlight, soft vintage depth of field, intimate emotional mood')
    if any(k in text for k in ('hip-hop', 'trap', '808', 'rap', 'drill', 'urban')):
        genres.append('moody urban street photography, dramatic neon rim lighting, cinematic midnight metropolis, luxury vinyl cover art')
    if any(k in text for k in ('cinematic', 'orchestral', 'film', 'epic', 'soundtrack', 'symphonic')):
        genres.append('grand cinematic panoramic landscape, sweeping majestic lighting, breathtaking scale, blockbuster movie poster aesthetic')
    if any(k in text for k in ('lo-fi', 'chill', 'jazzy', 'relax', 'cozy', 'coffee')):
        genres.append('cozy nostalgic anime illustration, rainy window with soft bokeh, pastel palette, peaceful lo-fi aesthetic')
    if any(k in text for k in ('pop', 'dance', 'electronic', 'club', 'house', 'edm')):
        genres.append('vibrant surrealist 3D abstract shapes, energetic laser lighting, fluid iridescent textures, modern album art')

    if not genres:
        genres.append('atmospheric artistic album cover design, rich textured color palette, evocative surreal composition')

    primary_genre = genres[0]
    return primary_genre, style_text[:200]


def synthesize_cover_prompt(title: str, style: str, lyrics: str = '') -> str:
    """Generate a high-quality visual prompt for album artwork generation."""
    clean_title = (title or 'New Single').strip()
    genre_desc, raw_style = extract_genre_mood(style)
    
    # Extract evocative lyrics theme if available
    lyric_snippet = ''
    if lyrics:
        lines = [l.strip() for l in lyrics.splitlines() if l.strip() and not l.startswith('[')]
        if lines:
            lyric_snippet = f", subtle artistic theme representing '{lines[0][:60]}'"

    prompt = (
        f"Masterpiece album cover art for track '{clean_title}'. "
        f"{genre_desc}{lyric_snippet}. "
        f"Professional square 1:1 format, pristine vinyl album packaging aesthetic, "
        f"visually stunning, evocative lighting, volumetric atmosphere, 8k resolution, "
        f"award-winning art, trending on ArtStation, no text, no typography, clean visual focus"
    )
    return prompt


def generate_cover_prompt(payload: dict) -> dict:
    title = str(payload.get('title') or '').strip()
    style = str(payload.get('style') or '').strip()
    lyrics = str(payload.get('lyrics') or '').strip()
    
    prompt = synthesize_cover_prompt(title, style, lyrics)
    return {'prompt': prompt, 'title': title}


def generate_cover(payload: dict) -> dict:
    job_id = str(payload.get('job_id') or '').strip()
    title = str(payload.get('title') or 'Untitled Song').strip()
    style = str(payload.get('style') or '').strip()
    lyrics = str(payload.get('lyrics') or '').strip()
    prompt = str(payload.get('prompt') or '').strip()
    seed = payload.get('seed')
    
    if not prompt:
        prompt = synthesize_cover_prompt(title, style, lyrics)

    if not job_id:
        raise ValueError('Job ID is required to generate and link an album cover.')

    job_dir = ROOT / 'runs/studio' / job_id
    if not job_dir.is_dir():
        raise ValueError(f'Song run directory for {job_id} was not found.')

    result_dir = job_dir / 'result'
    result_dir.mkdir(parents=True, exist_ok=True)
    target_cover_path = result_dir / 'cover.jpg'

    # Resilient compatibility shim for huggingface_hub / diffusers version mismatches
    try:
        import huggingface_hub
        if not hasattr(huggingface_hub, 'get_cached_repo_tree'):
            for mod_name in ('huggingface_hub.file_download', 'huggingface_hub._snapshot_download', 'huggingface_hub.hf_api'):
                try:
                    mod = __import__(mod_name, fromlist=['get_cached_repo_tree'])
                    if hasattr(mod, 'get_cached_repo_tree'):
                        huggingface_hub.get_cached_repo_tree = getattr(mod, 'get_cached_repo_tree')
                        break
                except Exception:
                    pass
            if not hasattr(huggingface_hub, 'get_cached_repo_tree'):
                huggingface_hub.get_cached_repo_tree = lambda *args, **kwargs: None
    except Exception:
        pass

    import torch
    
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    
    image = None
    engine_used = 'z_image_turbo'
    pipe = None
    
    try:
        from diffusers import DiffusionPipeline
        
        dtype = torch.bfloat16 if (device == 'cuda' and torch.cuda.is_bf16_supported()) else torch.float16 if device == 'cuda' else torch.float32
        
        # 1. Attempt Tongyi-MAI/Z-Image-Turbo
        try:
            pipe = DiffusionPipeline.from_pretrained(
                "Tongyi-MAI/Z-Image-Turbo",
                torch_dtype=dtype
            )
            pipe.to(device)
            gen = torch.Generator(device=device).manual_seed(int(seed)) if seed is not None else None
            result = pipe(
                prompt=prompt,
                num_inference_steps=8,
                generator=gen,
                width=1024,
                height=1024
            )
            image = result.images[0]
            engine_used = 'Tongyi-MAI/Z-Image-Turbo'
        except Exception as z_err:
            # 2. Fallback to SDXL-Turbo / Fast Diffusers Pipeline
            try:
                from diffusers import AutoPipelineForText2Image
                pipe = AutoPipelineForText2Image.from_pretrained(
                    "stabilityai/sdxl-turbo",
                    torch_dtype=torch.float16 if device == 'cuda' else torch.float32,
                    variant="fp16" if device == 'cuda' else None
                )
                pipe.to(device)
                gen = torch.Generator(device=device).manual_seed(int(seed)) if seed is not None else None
                result = pipe(
                    prompt=prompt,
                    num_inference_steps=2,
                    guidance_scale=0.0,
                    generator=gen,
                    width=512,
                    height=512
                )
                image = result.images[0]
                engine_used = 'stabilityai/sdxl-turbo (fast fallback)'
            except Exception as sdxl_err:
                raise RuntimeError(f"Image generator models failed to load ({z_err}; {sdxl_err})")

    except ImportError as imp_err:
        raise ValueError(f'The "diffusers" and "torch" packages are required for album cover generation: {imp_err}')
    finally:
        # Guarantee VRAM cleanup for music generation
        if pipe is not None:
            del pipe
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    if image is not None:
        image.save(str(target_cover_path), format='JPEG', quality=95)
        url = f"/artifacts/{job_id}/result/cover.jpg"
        return {
            'status': 'ok',
            'url': url,
            'job_id': job_id,
            'prompt': prompt,
            'engine': engine_used
        }

    raise RuntimeError('Could not generate album cover image.')
