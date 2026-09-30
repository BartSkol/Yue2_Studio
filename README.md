# 🎛️ YuE2 Studio · AI Music Producer & GGUF Engine

An avant-garde, local and cloud-ready Web Studio for **YuE2 (multimodal-art-projection)** featuring:
* 🤖 **AI Music Producer Chat:** Conversational music iteration with inline audio players & version tracking.
* 🎛️ **Collapsible Avant-Garde UI:** Mini-rail sidebar, full-width composer room, and section accordions.
* ⚡ **audio.cpp GGUF Engine:** Ultra-fast quantized inference (Q4/Q8) with 60% lower VRAM on Tesla T4, RTX 3060-5090.
* 🚀 **1-Click Google Colab Notebook:** Pre-compiled CUDA binary from GitHub Releases (2-second setup) with public Cloudflare Tunnel.
* ✍️ **Local & Cloud Songwriter:** Built-in Ollama Qwen 2.5 3B integration and cloud LLM support.
* 🎨 **Style & Artist LoRA Training:** Experimental LoRA trainer and SheetSage2 cover transcription.

[![Google Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://github.com/BartSkol/Yue2_Studio/blob/main/YuE2_Studio_Colab_GPU.ipynb)
[![GitHub Release](https://img.shields.io/github/v/release/BartSkol/Yue2_Studio?include_prereleases&color=blue)](https://github.com/BartSkol/Yue2_Studio/releases/tag/v0.1.0-colab-gpu)
[![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)

---

## 🌟 Key Features

### 1. 🤖 AI Music Producer Chat (Conversational Track Iteration)
* **Natural language feedback:** Talk to your AI Producer naturally (*"make it faster at 135 BPM, add deep 808 sub-bass, keep verses chill and make the chorus explosive with energetic male vocals"*).
* **Automatic rendering:** The AI Producer crafts the prompt and lyrics, then **automatically dispatches the job to the GPU queue**.
* **Inline audio players:** Watch live GPU render progress inside the chat bubble, and listen to the finished lossless FLAC / WAV directly in the conversation.
* **Track version history:** Left-hand version panel saves all iterations (`v1`, `v2`, `v3`...) with star synchronization (`⭐`), prompt/notes inspection (`ℹ️`), and 1-click loading into the main Studio Composer.
* **Pop-out window:** Open the producer chat in a dedicated separate browser window (`/?view=chat`).

### 2. 🎛️ Avant-Garde Collapsible UI Layout
* **Sidebar Mini-Rail:** Collapse the left navigation into a compact 68px icon rail (state persisted in `localStorage`).
* **100% Full-Width Composer:** Collapse the right Songwriter Room to expand the Composer across your entire display.
* **Section Accordions:** Individually toggle or globally collapse all editor sections (*Style*, *Lyrics*, *Options*, *Sliders*, *LoRAs*).

### 3. ⚡ audio.cpp GGUF Engine (Up to 3x Faster, 60% Less VRAM)
* Full support for **Q4_0**, **Q8_0**, and **BF16** quantized weights.
* Generates a 2-minute song in **~90 seconds** on a free Tesla T4 GPU in Google Colab.
* Pre-compiled Linux CUDA binary available directly in [GitHub Releases](https://github.com/BartSkol/Yue2_Studio/releases/tag/v0.1.0-colab-gpu).

---

## 🚀 Quick Start in Google Colab (Free GPU)

Open [`YuE2_Studio_Colab_GPU.ipynb`](https://github.com/BartSkol/Yue2_Studio/blob/main/YuE2_Studio_Colab_GPU.ipynb) in Google Colab:

1. **Enable GPU:** `Runtime` ➔ `Change runtime type` ➔ select **T4 GPU** (or L4 / A100).
2. **Run Step 1:** Clones this repository and installs the pre-compiled `audiocpp_cli` binary in **2 seconds** (skipping 15 minutes of CMake compilation).
3. **Run Step 2:** Downloads the GGUF Q4 bundle (`audio-cpp/Yue2-3B-GGUF`).
4. **Run Step 2b (Optional):** Launches local **Ollama with Qwen 2.5 3B** for zero-cost AI songwriting.
5. **Run Step 3:** Starts the Studio and provides a public **Cloudflare HTTPS link** accessible from both PC and smartphone.

---

## 💻 Local Installation (Windows / Linux)

### 1. Install Base YuE2
Follow the [official YuE2 installation](https://github.com/multimodal-art-projection/YuE#quick-start). Target commit is `92a73cc7652fcc1f937855e4b765e0a0edd7ff2e`.

### 2. Clone YuE2 Studio inside your YuE2 folder
```powershell
git clone https://github.com/BartSkol/Yue2_Studio.git
cd Yue2_Studio
.\"Start Yue2 Studio.bat"
```
Or on Linux:
```bash
../.venv/bin/python install_studio.py
../.venv/bin/python ../launch_studio.py
```
Open **http://127.0.0.1:7862** in your browser.

---

## 📁 Repository Structure

```text
YuE2_Studio/
├── launch_colab.py           # Colab launcher with integrated Cloudflare Tunnel
├── YuE2_Studio_Colab_GPU.ipynb # Ready-to-run Google Colab Notebook
├── install_studio.py         # Standard library overlay installer
├── src/
│   ├── yue2/                 # Core engine hooks (SDPA / Tesla T4 compatibility)
│   └── yue2_studio/          # Backend server & UI logic
│       ├── prompts/          # AI Producer & Songwriter system prompts
│       ├── static/           # Avant-Garde frontend (app.js, chat.js, style.css, index.html)
│       └── server.py         # REST API dispatcher (/api/chat/produce, /api/jobs, etc.)
└── README_PL.md              # Polish user documentation
```

---

## 📜 License & Credits
* Built on top of **YuE2** by [multimodal-art-projection](https://github.com/multimodal-art-projection/YuE).
* GGUF engine powered by [audio.cpp](https://github.com/0xShug0/audio.cpp).
* Studio overlay and AI Producer Chat developed by [BartSkol](https://github.com/BartSkol).
