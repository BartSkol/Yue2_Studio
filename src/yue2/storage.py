"""Model resolution, file hashing, and json persistence helpers."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import shutil
from typing import Any


def sha256_file(path: str | Path) -> str:
    path = Path(path)
    if not path.is_file():
        return ""
    hasher = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(4 * 1024 * 1024):
            hasher.update(chunk)
    return hasher.hexdigest()


def identity(obj: Any) -> str:
    raw = json.dumps(obj, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def write_json(path: str | Path, data: Any):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    temp.replace(path)


def collect_hashes(directory: str | Path) -> dict[str, str]:
    directory = Path(directory)
    result = {}
    if not directory.is_dir():
        return result
    for p in sorted(directory.rglob("*")):
        if p.is_file():
            rel = str(p.relative_to(directory)).replace("\\", "/")
            result[rel] = sha256_file(p)
    return result


def resolve_model(model: str | Path, revision: str | None = None, local_files_only: bool = False,
                  token: str | None = None, cache_dir: str | Path | None = None) -> Path:
    p = Path(model)
    if p.exists():
        return p.resolve()
    # If it's a Hugging Face hub repo
    try:
        from huggingface_hub import snapshot_download
        return Path(snapshot_download(
            repo_id=str(model),
            revision=revision,
            local_files_only=local_files_only,
            token=token,
            cache_dir=cache_dir
        ))
    except Exception:
        return p.resolve()


def model_identity(model_dir: str | Path, verify_hashes: bool = False) -> dict[str, Any]:
    model_dir = Path(model_dir)
    info = {"path": str(model_dir)}
    config_file = model_dir / "config.json"
    if config_file.is_file():
        try:
            info["config"] = json.loads(config_file.read_text(encoding="utf-8"))
        except Exception:
            pass
    if verify_hashes and model_dir.is_dir():
        info["hashes"] = collect_hashes(model_dir)
    return info


def copy_model_files(src: str | Path, dst: str | Path):
    src, dst = Path(src), Path(dst)
    dst.mkdir(parents=True, exist_ok=True)
    for item in src.iterdir():
        if item.is_file():
            shutil.copy2(item, dst / item.name)
        elif item.is_dir():
            shutil.copytree(item, dst / item.name, dirs_exist_ok=True)
