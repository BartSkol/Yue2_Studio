"""Progress reporter for YuE2 console stages matching UI parser expectations."""
from __future__ import annotations
import sys
import time
from contextlib import contextmanager


class StageContext:
    def __init__(self, reporter: Progress, label: str, total: int | None = None, unit: str | None = None):
        self.reporter = reporter
        self.label = label
        self.total = total
        self.unit = unit or "tokens"
        self.completed = 0
        self.start_time = time.time()
        self._last_report = 0.0

    def advance(self, count: int = 1):
        self.completed += count
        now = time.time()
        if now - self._last_report >= 0.2:
            self._report_running()
            self._last_report = now

    def update(self, completed: int, total: int | None = None):
        self.completed = completed
        if total is not None:
            self.total = total
        now = time.time()
        if now - self._last_report >= 0.2:
            self._report_running()
            self._last_report = now

    def _report_running(self):
        if not self.reporter.enabled:
            return
        elapsed = time.time() - self.start_time
        if self.total and self.total > 0:
            pct = int(100 * self.completed / self.total)
            msg = f"[YuE2] Running {self.label}: {self.completed}/{self.total} {self.unit} ({pct}%) | elapsed {elapsed:.1f}s"
        else:
            speed = (self.completed / elapsed) if elapsed > 0 else 0.0
            msg = f"[YuE2] Running {self.label}: {self.completed} {self.unit} | {speed:.1f} {self.unit}/s | elapsed {elapsed:.1f}s"
        print(msg, flush=True)

    def finish(self, status: str = "completed"):
        if not self.reporter.enabled:
            return
        elapsed = time.time() - self.start_time
        if status == "truncated":
            speed = (self.completed / elapsed) if elapsed > 0 else 0.0
            print(f"[YuE2] Finished (generation limit reached) {self.label}: {self.completed} {self.unit} | {speed:.1f} {self.unit}/s | elapsed {elapsed:.1f}s", flush=True)
        elif status == "failed":
            print(f"[YuE2] Failed {self.label}: elapsed {elapsed:.1f}s", flush=True)
        else:
            print(f"[YuE2] Completed {self.label}: elapsed {elapsed:.1f}s", flush=True)


class Progress:
    def __init__(self, enabled: bool = True):
        self.enabled = enabled

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    @contextmanager
    def stage(self, label: str, total: int | None = None, unit: str | None = None):
        ctx = StageContext(self, label, total, unit)
        if self.enabled:
            print(f"[YuE2] Starting {label}: elapsed 0.0s", flush=True)
        try:
            yield ctx
            ctx.finish("completed")
        except Exception:
            ctx.finish("failed")
            raise

    def complete(self, audio_seconds: float, elapsed_seconds: float, truncated: bool = False):
        if not self.enabled:
            return
        speed = (audio_seconds / elapsed_seconds) if elapsed_seconds > 0 else 0.0
        print(f"[YuE2] Complete: {audio_seconds:.1f}s audio in {elapsed_seconds:.1f}s ({speed:.2f}x)", flush=True)
