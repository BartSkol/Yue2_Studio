"""Resolve optimized execution against the installed Torch build, not OS guesses."""
from functools import lru_cache


@lru_cache(maxsize=1)
def capabilities():
    import torch
    available = torch.cuda.is_available() and torch.cuda.get_device_capability()[0] >= 8 and torch.backends.cuda.is_flash_attention_available()
    return {'flash_attention': available, 'note': '' if available else
            'This GPU or PyTorch build uses cuDNN / SDPA attention. The torch backend keeps CUDA graphs enabled for fast generation.'}


def compatible_runtime(runtime, flash_attention):
    effective = dict(runtime)
    warning = None
    if runtime['backend']=='torch' and not flash_attention and str(runtime['device']).split(':')[0] not in ('cpu','mps'):
        warning={'requested_backend':'torch','effective_backend':'torch',
                 'reason':'Flash Attention is not compiled. CUDA graphs remain enabled with cuDNN attention when supported, otherwise SDPA.'}
    return effective, warning
