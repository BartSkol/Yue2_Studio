# YuE2 Studio · Instrukcja uruchamiania na procesorze (CPU)

Wersja została dostosowana do w pełni samodzielnego działania na procesorze (CPU) bez wymogu posiadania karty graficznej NVIDIA (24 GB VRAM) ani wcześniejszej instalacji oryginalnego upstreamu YuE2.

---

## 1. Jak uruchomić (1 kliknięciem)

Wystarczy uruchomić plik:
👉 **`Start_Studio_CPU.bat`** (lub `Start Yue2 Studio.bat`)

Skrypt automatycznie:
1. Utworzy lokalne środowisko wirtualne `.venv`.
2. Zainstaluje lekkie pakiety Pythona zoptymalizowane pod CPU (`requirements_cpu.txt`).
3. Uruchomi serwer YuE2 Studio pod adresem: **`http://127.0.0.1:7862`** i otworzy przeglądarkę.

---

## 2. Dwie metody generowania muzyki na CPU

### Opcja A: Backend `audio.cpp / GGUF` (**Zalecane – najszybsze na CPU**)
Silnik C++ zoptymalizowany pod instrukcje procesora (AVX2 / AVX-512) i skwantyzowane wagi 4-bitowe / 8-bitowe.

1. W menu bocznym kliknij **Music models** (lub **Set up GGUF / Models**).
2. Pobierz model **Q4** (`yue2-3b-q4_0.gguf`) lub **Q8** (`yue2-3b-q8_0.gguf`) klikając przycisk **Download Q4** / **Download Q8** (pobierze model, dekoder VAE oraz pliki sidecars).
3. Kliknij **Use Q4** / **Use Q8**.
4. W **Advanced settings → audio.cpp / GGUF**:
   - **audio.cpp device backend**: wybierz `cpu`
   - **audio.cpp CPU threads**: ustaw liczbę wątków CPU (np. `8` lub tyle, ile ma Twój procesor).
   - Wskaż ścieżkę do pliku `audiocpp_cli.exe` (z projektu [audio.cpp](https://github.com/0xShug0/audio.cpp)).

---

### Opcja B: Backend PyTorch (`torch-eager`)
Działa bezpośrednio na natywnych wagach PyTorch (bfloat16 / float32).

1. W **Advanced settings → Models & runtime**:
   - **Compute device (`device`)**: wpisz `cpu` (lub zostaw `auto`).
   - **Inference backend (`backend`)**: wybierz `torch-eager` (*CUDA Graphs są automatycznie wyłączane dla CPU*).
2. Wymagania: minimum 16–32 GB pamięci RAM.
3. *Uwaga:* Czysty PyTorch na CPU jest bardzo wymagający obliczeniowo – wygenerowanie pełnego utworu może zająć od 45 do 90 minut.

---

## 3. Co zostało zrobione / zoptymalizowane pod CPU:
- ✅ **Zabezpieczenie przed błędami CUDA/cuDNN:** Wszystkie wywołania `torch.cuda`, CUDA Graphs oraz Flash Attention są automatycznie pomijane przy pracy na urządzeniu CPU.
- ✅ **Samodzielny protokół i moduły:** Dodano implementacje protokołu (`protocol.py`, `storage.py`, `progress.py`, `modeling_yue2.py`, `modeling_vae.py`), dzięki czemu Studio działa bez zewnętrznego repozytorium YuE2.
- ✅ **Automatyczny launcher `.bat`:** `Start_Studio_CPU.bat` sam zarządza środowiskiem i instalacją bibliotek pod CPU.
- ✅ **Wielowątkowość audio.cpp:** Możliwość precyzyjnego ustawienia liczby wątków procesora (`threads`) w panelu ustawień.
