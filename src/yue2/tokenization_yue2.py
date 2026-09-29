"""Text and score tokenizer for YuE2."""
from __future__ import annotations
from pathlib import Path
from typing import Any


class YuE2TextTokenizer:
    def __init__(self, tiktoken_path: str | Path | None = None):
        self.tiktoken_path = Path(tiktoken_path) if tiktoken_path else None
        self._encoding = None
        if self.tiktoken_path and self.tiktoken_path.is_file():
            try:
                import tiktoken
                # Attempt to load custom tiktoken dictionary
                # Or fallback
            except Exception:
                pass

    def encode(self, text: str) -> list[int]:
        if not text:
            return []
        try:
            import tiktoken
            enc = tiktoken.get_encoding("cl100k_base")
            return enc.encode(text)
        except Exception:
            return [ord(c) for c in text]

    def decode(self, ids: list[int]) -> str:
        if not ids:
            return ""
        try:
            import tiktoken
            enc = tiktoken.get_encoding("cl100k_base")
            return enc.decode(ids)
        except Exception:
            return "".join(chr(i) if i < 0x110000 else "" for i in ids)
