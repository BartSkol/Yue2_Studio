"""Non-autoregressive (NAR) acoustic synthesis."""
from __future__ import annotations
from typing import Any
import torch


def synthesize(model: Any, prefix: list[int], tokens: list[int], seed: int,
               steps: int = 32, context: int = 24576, offload_ar: bool = False,
               cancelled: Any = None, on_progress: Any = None) -> torch.Tensor:
    if hasattr(model, "synthesize"):
        return model.synthesize(prefix, tokens, seed, steps=steps, context=context,
                                offload_ar=offload_ar, cancelled=cancelled, on_progress=on_progress)

    # Return empty latents tensor shape [1, 64, num_frames]
    frames = max(1, len(tokens))
    for step in range(1, steps + 1):
        if cancelled and cancelled():
            raise InterruptedError("Synthesis cancelled")
        if on_progress:
            on_progress(step, steps)
    return torch.zeros((1, 64, frames), dtype=torch.float32)
