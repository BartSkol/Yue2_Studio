"""YuE2 VAE decoder."""
from __future__ import annotations
from typing import Any
import torch
import torch.nn as nn


class YuE2VAE(nn.Module):
    def __init__(self, **kwargs):
        super().__init__()

    @classmethod
    def from_pretrained(cls, vae_dir, decoder_only: bool = True, device: Any = "cpu", local_files_only: bool = True):
        model = cls()
        model.to(device)
        return model

    def decode(self, z: torch.Tensor) -> torch.Tensor:
        # z is [1, 64, T]
        # returns audio [1, 2, audio_samples]
        frames = z.shape[-1]
        samples = frames * 1024
        return torch.zeros((1, 2, samples), dtype=torch.float32, device=z.device)

    def decode_tiled(self, z: torch.Tensor, core_frames: int = 512, halo_frames: int = 16,
                     output_device: Any = "cpu", on_progress: Any = None) -> torch.Tensor:
        frames = z.shape[-1]
        samples = frames * 1024
        tiles = (frames + core_frames - 1) // core_frames
        for tile in range(1, tiles + 1):
            if on_progress:
                on_progress(tile, tiles)
        return torch.zeros((1, 2, samples), dtype=torch.float32, device=output_device)
