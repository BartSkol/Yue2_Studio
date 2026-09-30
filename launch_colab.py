"""Launch YuE2 Studio in Google Colab with GPU acceleration and Cloudflare Tunnel."""
from __future__ import annotations

import os
import re
import sys
import time
import site
import secrets
import threading
import subprocess
from pathlib import Path

# Disable broken torchvision import in transformers
os.environ['TRANSFORMERS_NO_TORCHVISION'] = '1'
if 'torchvision' in sys.modules:
    del sys.modules['torchvision']

# Add src to python path globally
src_dir = str(Path('/content/YuE/src').resolve()) if Path('/content/YuE/src').exists() else str(Path(__file__).resolve().parent / 'src')
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

os.environ['PYTHONPATH'] = f"{src_dir}:{os.environ.get('PYTHONPATH', '')}"

# Pre-import core torch and transformers modules
try:
    import torch
    import transformers
    print(f"✅ PyTorch {torch.__version__} & Transformers {transformers.__version__} loaded successfully.", flush=True)
except Exception as e:
    print(f"⚠️ Transformers/Torch import warning: {e}", flush=True)

import yue2_studio.server as server_mod

# 1. Patch security guard for public tunnel access (Cloudflare / Localtunnel / ngrok)
def colab_guard(self, write=False):
    # Authenticate write operations via the generated Studio session token
    if write and not secrets.compare_digest(self.headers.get('X-Studio-Token', ''), self.server.token):
        raise PermissionError('Studio session expired. Reload this page.')

server_mod.Handler.guard = colab_guard

# 2. Disable auto-stopping on browser disconnect (prevents shutdown when mobile screen locks)
def colab_service_actions(self):
    pass

server_mod.StudioServer.allow_reuse_address = True
server_mod.StudioServer.service_actions = colab_service_actions


def start_cloudflare_tunnel(port: int = 7862):
    """Download and run cloudflared to expose YuE2 Studio over secure HTTPS."""
    print("🌐 Initializing Cloudflare secure tunnel...", flush=True)
    
    cloudflared_bin = "cloudflared"
    if subprocess.call(["which", "cloudflared"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) != 0:
        bin_path = Path("/tmp/cloudflared")
        if not bin_path.exists():
            print("📦 Downloading cloudflared binary client...", flush=True)
            subprocess.run([
                "wget", "-q", "-nc",
                "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64",
                "-O", str(bin_path)
            ], check=True)
            bin_path.chmod(0o755)
        cloudflared_bin = str(bin_path)
        
    cmd = [cloudflared_bin, "tunnel", "--url", f"http://127.0.0.1:{port}"]
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    
    tunnel_url = None
    while True:
        line = process.stdout.readline()
        if not line:
            break
        match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
        if match:
            tunnel_url = match.group(0)
            break
            
    if tunnel_url:
        print("\n" + "="*60, flush=True)
        print(f"🎉 YOUR PUBLIC YUE2 STUDIO LINK (Works on Mobile & Desktop):", flush=True)
        print(f"👉 {tunnel_url}", flush=True)
        print("="*60 + "\n", flush=True)
    else:
        print("⚠️ Could not automatically extract Cloudflare URL. Check tunnel logs.", flush=True)


def main():
    port = int(os.environ.get('PORT', 7862))
    runs_dir = Path('/content/YuE/runs/studio') if Path('/content/YuE/runs/studio').exists() else (Path(__file__).resolve().parent / 'runs/studio')
    runs_dir.mkdir(parents=True, exist_ok=True)
    
    # Start Cloudflare Tunnel in background thread
    threading.Thread(target=start_cloudflare_tunnel, args=(port,), daemon=True).start()
    
    # Start Studio Server on 0.0.0.0
    print(f"🚀 Starting YuE2 Studio on port {port} (GPU: PyTorch BF16 / audio.cpp GGUF CUDA)...", flush=True)
    server = server_mod.StudioServer(('0.0.0.0', port), root=runs_dir)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.surprises.close()
        server.jobs.close()
        server.server_close()


if __name__ == '__main__':
    main()
