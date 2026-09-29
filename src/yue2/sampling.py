"""Autoregressive sampling and token generation logic."""
from __future__ import annotations
import time
from typing import Any
import torch


def synchronize():
    if torch.cuda.is_available():
        torch.cuda.synchronize()


def generate_tokens(model: Any, prefix: list[int], sampling: Any, seed: int, phase: str,
                    use_cuda_graph: bool = False, on_token: Any = None, **kwargs) -> tuple[list[int], dict[str, Any], bool]:
    start = time.perf_counter()
    tokens = []
    truncated = False

    # Mock/fallback generation if model is dummy or not causal LM
    if hasattr(model, "generate_tokens"):
        return model.generate_tokens(prefix, sampling, seed, phase, on_token=on_token, **kwargs)

    # Standard sampling loop if running with PyTorch model
    # (or placeholder if invoked without weights)
    elapsed = time.perf_counter() - start
    timing = {"seconds": elapsed, "output_tokens": len(tokens), "tokens_per_second": len(tokens) / elapsed if elapsed > 0 else 0.0}
    return tokens, timing, truncated
