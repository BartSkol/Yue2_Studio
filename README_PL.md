# 🎛️ YuE2 Studio + AI Producer Chat & GGUF (audio.cpp)

Kompletne, lokalne środowisko muzyczne AI nowej generacji oparte o **YuE2 (multimodal-art-projection)** z autorskim, nowoczesnym interfejsem WebUI (**YuE2 Studio**), silnikiem kwantyzacji **GGUF (audio.cpp)** oraz dedykowanym **Asystentem Producenta Muzycznego AI** (obsługującym lokalne modele LLM takie jak Qwen 2.5 3B przez Ollama lub chmurowe API).

---

## 🌟 Najważniejsze Możliwości & Nowości

### 1. 🤖 AI Music Producer Chat (Twój Osobisty Producent Muzyczny)
* **Naturalna rozmowa o muzyce:** Zamiast ręcznie edytować tagi i suwaki, piszesz do AI jak do producenta w studio (np. *"dodaj głęboki bas 808, zrób z tego nowoczesny trap z klimatycznymi padami synthwave, a w refrenie niech śpiewa energiczny wokal męski"*).
* **Automatyczne renderowanie audio:** AI Producer automatycznie dostosowuje styl, strukturę utworu oraz słowa piosenki, a następnie **samodzielnie wysyła zadanie renderowania na GPU**.
* **Odtwarzacz Audio w dymku czatu:** Bezpośrednio w wiadomości czatu widzisz pasek postępu renderowania, a po zakończeniu pojawia się odtwarzacz audio FLAC/WAV oraz możliwość pobrania pliku.
* **Historia wersji utworu (v1, v2, v3...):** Na bocznym panelu czatu zapisują się wszystkie iteracje piosenki wraz z oceną gwiazdkową (`⭐`), podglądem promptu i notatek producenta (`ℹ️`) oraz przyciskiem natychmiastowego załadowania do kompozytora.
* **Osobne okno czatu (Pop-out):** Możliwość otwarcia czatu w osobnym oknie przeglądarki (`/?view=chat`) dla maksymalnej wygody pracy na wielu monitorach.

### 2. 🎛️ W pełni Zwijany & Responsywny Interfejs (Avant-Garde UI)
* **Zwijane lewe menu (Sidebar):** Zwija się do minimalistycznego paska ikon (68px), zapamiętując stan w przeglądarce.
* **Zwijany pokój songwritera (Right panel):** Po zwinięciu kompozytor muzyczny rozszerza się na **100% szerokości ekranu**.
* **Harmonijki sekcji (Accordions):** Wszystkie sekcje kompozytora (*Styl*, *Tekst*, *Opcje*, *Suwaki*, *LoRA*) można zwijać indywidualnie lub jednym przyciskiem.

### 3. ⚡ Błyskawiczny Silnik GGUF (audio.cpp)
* Do **3x szybsze generowanie muzyki** i o **60% mniejsze zużycie pamięci VRAM**.
* Pozwala tworzyć pełne utwory nawet na kartach **NVIDIA Tesla T4 (15 GB)**, **RTX 3060/4060 (8-12 GB)** czy **RTX 3090/4090/5090**.
* Obsługa modeli **Q4_0** (ok. 2.9 GB pakiet), **Q8_0** (4.5 GB) oraz **BF16**.

### 4. ✍️ Lokalny Asystent Songwritera (Qwen 2.5 3B przez Ollama)
* 100% lokalne, darmowe generowanie tekstów, zwrotek `[verse]` i refrenów `[chorus]`.
* Działa na GPU bez konieczności podawania jakichkolwiek kluczy API.

---

## 🚀 Jak Uruchomić w Google Colab (Krok po Kroku)

Notebook: [`YuE2_Studio_Colab_GPU.ipynb`](../YuE2_Studio_Colab_GPU.ipynb)

### Krok 0: Włącz akcelerator GPU
W menu u góry wybierz: **Środowisko wykonawcze** ➔ **Zmień typ środowiska wykonawczego** ➔ wybierz **T4 GPU** (lub L4 / A100) ➔ **Zapisz**.

### Krok 1: Instalacja bazy i kompilacja silnika
Uruchom komórkę **1. Pełna instalacja YuE2 + YuE2 Studio + audio.cpp (GGUF)**.
> 💡 **Wskazówka (Kompilacja CUDA):** Przy pierwszym uruchomieniu silnik `audiocpp_cli` kompiluje się pod CUDA (ok. 10-15 minut).

### 💾 Krok 1b (Opcjonalnie): Zapisz `audiocpp_cli` na Dysk Google!
Aby w przyszłości **nigdy więcej nie czekać 15 minut na kompilację**, uruchom komórkę **1b**:
* Zapisze ona plik `audiocpp_cli` na Twoim Dysku Google (`/content/drive/MyDrive/audiocpp_cli`).
* Przy każdym kolejnym otwarciu Colaba, Krok 1 automatycznie wykryje ten plik i załaduje silnik w **1 sekundę**!

### Krok 2: Pobranie modeli
Zaznacz `pobierz_gguf_q4 = True` i uruchom komórkę **2**.
Pobierze to zoptymalizowany model `audio-cpp/Yue2-3B-GGUF` (wagi Q4_0, dekoder VAE oraz pliki pomocnicze).

### Krok 2b (Opcjonalnie): Uruchom Asystenta AI (Qwen 2.5 3B)
Uruchom komórkę **2b**, aby postawić lokalny silnik **Ollama** z modelem `qwen2.5:3b`.

### Krok 3: Start YuE2 Studio WebUI
Uruchom komórkę **3**. W logach pojawi się bezpieczny, publiczny link **Cloudflare Tunnel** (np. `https://xxx-xxx.trycloudflare.com`), który działa zarówno na komputerze, jak i na smartfonie!

---

## 🛠️ Jak korzystać z menu "Music models" w Studio

Gdy wejdziesz w menu **Music models**:
1. Zobaczysz kafelki: **Q4**, **Q8** oraz **BF16**.
2. Kliknij **"Download Q4"** (jeśli plik nie został jeszcze pobrany w Colabie) lub **"Use Q4"**.
3. Studio automatycznie przełączy silnik generowania na `audio.cpp GGUF` z wagami Q4.
4. Czerwony komunikat o brakującym pliku Q8 natychmiast zniknie.

---

## 💻 Struktura Katalogów i Plików

```text
YuE/
├── audiocpp_cli              ← Skompilowany binarny silnik GGUF pod Linux/CUDA
├── launch_colab.py           ← Launcher Colab z tunelem Cloudflare
├── models/
│   ├── Yue2-3B-GGUF/         ← Modele GGUF (yue2-3b-q4_0.gguf, yue2-vae-f16.gguf, sidecars/)
│   └── loras/                ← Adaptery LoRA (np. Instrumental LoRA)
├── src/
│   ├── yue2/                 ← Oficjalny rdzeń silnika YuE2 (z patchami SDPA/T4)
│   └── yue2_studio/          ← Serwer Studio, zarządca modeli, logika AI Producer
│       ├── prompts/          ← Prompty systemowe dla Songwritera i AI Producera
│       ├── static/           ← Frontend WebUI (index.html, style.css, app.js, chat.js)
│       └── server.py         ← Backend REST API (/api/chat/produce, /api/jobs itp.)
└── Yue2_Studio/              ← Repozytorium nakładki Studio
```

---

## ❓ FAQ / Rozwiązywanie Problemów

* **Dlaczego widzę napis "2.67 GB missing" przy modelu Q4?**
  * Oznacza to, że plik główny `yue2-3b-q4_0.gguf` (2.67 GB) nie został jeszcze pobrany do folderu `models/Yue2-3B-GGUF`. Wystarczy kliknąć przycisk **"Download Q4"** w okienku Studio lub uruchomić Krok 2 w Colabie.
* **Gdzie znajduje się plik skompilowanego silnika w Colabie?**
  * Ścieżka to `/content/YuE/audiocpp_cli`. Możesz go pobrać na komputer lub skopiować na Dysk Google za pomocą komórki 1b.
* **Jak rozmawiać z AI Producerem po polsku?**
  * AI Producer automatycznie dopasowuje język do Twoich poleceń. Możesz pisać do niego w 100% po polsku, a on wygeneruje odpowiednie tagi stylistyczne po angielsku (najlepiej rozumiane przez model YuE2) oraz zachowa polskie teksty piosenek.
