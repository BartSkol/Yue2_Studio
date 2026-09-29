"""Native request protocol, configuration, and prefix construction."""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any

CODEC_OFFSET = 32768


@dataclass
class Sampling:
    temperature: float = 0.7
    top_p: float = 0.9
    top_k: int = 30
    repetition_penalty: float = 1.005
    penalty_window: int = 100
    min_tokens: int = 32
    max_tokens: int = 4096

    def __post_init__(self):
        if self.min_tokens > self.max_tokens:
            raise ValueError("min_tokens cannot exceed max_tokens")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Sampling:
        valid_keys = {f.name for f in cls.__dataclass_fields__.values()}
        return cls(**{k: v for k, v in data.items() if k in valid_keys})


@dataclass
class GenerationConfig:
    abc: Sampling = field(default_factory=lambda: Sampling(0.7, 0.9, 30, 1.005, 100, 32, 4096))
    semantic: Sampling = field(default_factory=lambda: Sampling(1.0, 0.95, 100, 1.2, 50, 200, 9000))
    ode_steps: int = 32
    context: int = 24576

    def to_dict(self) -> dict[str, Any]:
        return {
            "abc": self.abc.to_dict(),
            "semantic": self.semantic.to_dict(),
            "ode_steps": self.ode_steps,
            "context": self.context,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> GenerationConfig:
        abc_data = data.get("abc", {})
        sem_data = data.get("semantic", {})
        abc = Sampling.from_dict(abc_data) if isinstance(abc_data, dict) else Sampling()
        semantic = Sampling.from_dict(sem_data) if isinstance(sem_data, dict) else Sampling(1.0, 0.95, 100, 1.2, 50, 200, 9000)
        return cls(
            abc=abc,
            semantic=semantic,
            ode_steps=int(data.get("ode_steps", 32)),
            context=int(data.get("context", 24576)),
        )


@dataclass
class SongRequest:
    style: str
    lyrics: str
    cot: str = "full"
    seed: int = -1
    abc: str | None = None
    cfg_scale: float = 1.0
    id: str = "song"

    def __post_init__(self):
        if self.cot not in ("full", "melody", "off"):
            raise ValueError(f"Invalid cot mode: {self.cot}")
        if self.cot == "off" and self.abc is not None:
            raise ValueError("ABC score cannot be provided when cot is 'off'")
        if self.seed < -1 or self.seed >= 2**63:
            raise ValueError("Seed must be between -1 and 2^63 - 1")

    @property
    def guidance(self) -> float:
        return self.cfg_scale

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "style": self.style,
            "lyrics": self.lyrics,
            "cot": self.cot,
            "seed": self.seed,
            "abc": self.abc,
            "cfg_scale": self.cfg_scale,
        }


def resolve_sampling(override: Any, fallback: Sampling) -> Sampling:
    if override is None:
        return fallback
    if isinstance(override, Sampling):
        return override
    if isinstance(override, dict):
        base = fallback.to_dict()
        base.update({k: v for k, v in override.items() if k in base and v is not None})
        return Sampling.from_dict(base)
    return fallback


def token_prefixes(request: SongRequest, tokenizer: Any, abc_ids: list[int] | None = None) -> list[int]:
    if hasattr(tokenizer, "encode_prefix"):
        return tokenizer.encode_prefix(request, abc_ids)
    if hasattr(tokenizer, "encode"):
        text = f"<|im_start|>system\nStyle: {request.style}\n<|im_end|>\n<|im_start|>user\n{request.lyrics}\n<|im_end|>\n<|im_start|>assistant\n"
        tokens = tokenizer.encode(text)
        if abc_ids:
            tokens = tokens + list(abc_ids)
        return tokens
    return [1, 2]


def negative_prefix(request: SongRequest, tokenizer: Any, abc_ids: list[int] | None = None) -> list[int]:
    if hasattr(tokenizer, "encode_negative"):
        return tokenizer.encode_negative(request, abc_ids)
    if hasattr(tokenizer, "encode"):
        text = "<|im_start|>system\n<|im_end|>\n<|im_start|>user\n<|im_end|>\n<|im_start|>assistant\n"
        tokens = tokenizer.encode(text)
        if abc_ids and request.cot != "off":
            tokens = tokens + list(abc_ids)
        return tokens
    return [1]
