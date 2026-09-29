"""YuE2 causal model architecture definition and configuration."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any
import torch
import torch.nn as nn


@dataclass
class YuE2Config:
    hidden_size: int = 2048
    intermediate_size: int = 5632
    num_hidden_layers: int = 24
    num_attention_heads: int = 16
    num_key_value_heads: int = 16
    head_dim: int = 128
    vocab_size: int = 151936
    max_position_embeddings: int = 24576
    latent_dim: int = 64
    vae_latent_dim: int = 64
    max_latent_frames: int = 9000

    def to_dict(self) -> dict[str, Any]:
        return self.__dict__.copy()


class Attention(nn.Module):
    def __init__(self, config: YuE2Config):
        super().__init__()
        self.q_proj = nn.Linear(config.hidden_size, config.num_attention_heads * config.head_dim, bias=False)
        self.k_proj = nn.Linear(config.hidden_size, config.num_key_value_heads * config.head_dim, bias=False)
        self.v_proj = nn.Linear(config.hidden_size, config.num_key_value_heads * config.head_dim, bias=False)
        self.o_proj = nn.Linear(config.num_attention_heads * config.head_dim, config.hidden_size, bias=False)


class MLP(nn.Module):
    def __init__(self, config: YuE2Config):
        super().__init__()
        self.gate_proj = nn.Linear(config.hidden_size, config.intermediate_size, bias=False)
        self.up_proj = nn.Linear(config.hidden_size, config.intermediate_size, bias=False)
        self.down_proj = nn.Linear(config.intermediate_size, config.hidden_size, bias=False)


class DecoderLayer(nn.Module):
    def __init__(self, config: YuE2Config):
        super().__init__()
        self.self_attn = Attention(config)
        self.mlp = MLP(config)


class Model(nn.Module):
    def __init__(self, config: YuE2Config):
        super().__init__()
        self.embed_tokens = nn.Embedding(config.vocab_size, config.hidden_size)
        self.layers = nn.ModuleList([DecoderLayer(config) for _ in range(config.num_hidden_layers)])


class YuE2ForCausalLM(nn.Module):
    def __init__(self, config: YuE2Config | None = None):
        super().__init__()
        self.config = config or YuE2Config()
        self.model = Model(self.config)
        self.llm2vae = nn.Linear(self.config.hidden_size, self.config.latent_dim, bias=False)
        self.vae2llm = nn.Linear(self.config.latent_dim, self.config.hidden_size, bias=False)
        self.lm_head = nn.Linear(self.config.hidden_size, self.config.vocab_size, bias=False)

    @classmethod
    def from_pretrained(cls, model_dir, **kwargs):
        config = YuE2Config()
        model = cls(config)
        return model
