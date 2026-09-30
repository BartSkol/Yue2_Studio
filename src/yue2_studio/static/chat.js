'use strict';

/**
 * AI Music Producer Chat Controller
 * Manages conversational track iteration, auto-generation, live audio players, and version tracking.
 */
const chatState = {
  messages: [],
  versions: [],
  activeBaseVersionId: null,
  isGenerating: false,
  activeChatJobId: null
};

const CHAT_STORAGE_KEY = 'yue2_studio_chat_history_v1';
const CHAT_VERSIONS_KEY = 'yue2_studio_chat_versions_v1';

function saveChatStorage() {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatState.messages.slice(-30)));
    localStorage.setItem(CHAT_VERSIONS_KEY, JSON.stringify(chatState.versions.slice(-50)));
  } catch (e) {
    console.warn('Could not save chat storage:', e);
  }
}

function loadChatStorage() {
  try {
    const savedMsgs = localStorage.getItem(CHAT_STORAGE_KEY);
    if (savedMsgs) chatState.messages = JSON.parse(savedMsgs);
    const savedVers = localStorage.getItem(CHAT_VERSIONS_KEY);
    if (savedVers) chatState.versions = JSON.parse(savedVers);
  } catch (e) {
    console.warn('Could not load chat storage:', e);
  }
}

function syncInspectorPanel(data) {
  if (!data) {
    const ctx = getActiveChatContext();
    data = ctx;
  }
  populateInspectorLoras();
  if ($('inspectorTitle')) $('inspectorTitle').value = data.title || '';
  if ($('inspectorStyle')) $('inspectorStyle').value = data.style || '';
  if ($('inspectorLyrics')) $('inspectorLyrics').value = data.lyrics || '';
  if ($('inspectorMode')) $('inspectorMode').value = data.cot || 'full';
  if ($('inspectorSeed')) $('inspectorSeed').value = data.seed || Math.floor(Math.random() * (2**31 - 1));
  if ($('inspectorLora')) {
    if (data.lora_path) {
      $('inspectorLora').value = data.lora_path;
    } else if (data.lora) {
      const found = Array.isArray(loraCatalogue) ? loraCatalogue.find(l => l.name === data.lora || l.path.includes(data.lora)) : null;
      if (found) $('inspectorLora').value = found.path;
      else if (state.settings?.lora?.path) $('inspectorLora').value = state.settings.lora.path;
    } else if (state.settings?.lora?.path) {
      $('inspectorLora').value = state.settings.lora.path;
    }
  }
  const strength = data.lora_strength !== undefined ? data.lora_strength : (state.settings?.lora?.strength ?? 1.0);
  if ($('inspectorLoraStrength')) $('inspectorLoraStrength').value = strength;
  if ($('inspectorLoraVal')) $('inspectorLoraVal').textContent = Number(strength).toFixed(2);

  const coverImg = $('inspectorCoverImg');
  const coverPl = $('inspectorCoverPlaceholder');
  const coverPromptInput = $('inspectorCoverPrompt');

  if (coverPromptInput) {
    coverPromptInput.value = data.cover_prompt || '';
  }

  const coverUrl = data.cover_url || (data.job_id ? `/artifacts/${data.job_id}/result/cover.jpg` : null);
  if (coverImg && coverPl) {
    if (coverUrl) {
      coverImg.src = coverUrl;
      coverImg.hidden = false;
      coverPl.hidden = true;
      coverImg.onerror = () => {
        coverImg.hidden = true;
        coverPl.hidden = false;
      };
    } else {
      coverImg.hidden = true;
      coverPl.hidden = false;
    }
  }
}

function populateInspectorLoras() {
  const select = $('inspectorLora');
  if (!select) return;
  const currentVal = select.value;
  select.replaceChildren(new Option('None · Original YuE2', ''));
  if (Array.isArray(loraCatalogue)) {
    loraCatalogue.forEach(item => {
      select.add(new Option((item.kind === 'artist' ? 'Artist · ' : 'Style · ') + (item.name || item.path), item.path));
    });
  }
  if (currentVal) select.value = currentVal;
}

function initChat() {
  loadChatStorage();
  bindChatUI();
  renderChatMessages();
  renderChatVersions();
  updateChatBaseIndicator();
  syncInspectorPanel();

  // Check URL params for standalone view mode (?view=chat)
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'chat') {
    setTimeout(() => {
      if (typeof switchView === 'function') switchView('chat');
    }, 100);
  }
}

function getActiveChatContext() {
  // If user selected a specific version as base, use it; otherwise pull current editor values
  if (chatState.activeBaseVersionId) {
    const v = chatState.versions.find(item => item.id === chatState.activeBaseVersionId);
    if (v) {
      return {
        title: v.title || $('songTitle')?.value || '',
        style: v.style || $('style')?.value || '',
        lyrics: v.lyrics || $('lyrics')?.value || '',
        cot: v.cot || $('planMode')?.value || 'full',
        abc: $('abc')?.value || '',
        mode: state.mode || 'create',
        source_job: v.job_id || state.sourceJob || '',
        seed: v.seed || null
      };
    }
  }
  return {
    title: $('songTitle')?.value || '',
    style: $('style')?.value || '',
    lyrics: $('lyrics')?.value || '',
    cot: $('planMode')?.value || 'full',
    abc: $('abc')?.value || '',
    mode: state.mode || 'create',
    source_job: state.sourceJob || '',
    seed: $('seed')?.value || null
  };
}

function updateChatBaseIndicator() {
  const badge = $('chatBaseBadge');
  const titleSpan = $('chatBaseTitle');
  if (!badge || !titleSpan) return;

  const ctx = getActiveChatContext();
  if (chatState.activeBaseVersionId) {
    const v = chatState.versions.find(item => item.id === chatState.activeBaseVersionId);
    titleSpan.textContent = v ? `v${v.version_num}: ${v.title}` : (ctx.title || 'Current draft');
  } else {
    titleSpan.textContent = ctx.title ? `Studio Draft: ${ctx.title}` : 'Studio Composer Draft';
  }
}

function setChatBaseVersion(versionId) {
  chatState.activeBaseVersionId = versionId;
  const v = versionId ? chatState.versions.find(item => item.id === versionId) : null;
  syncInspectorPanel(v);
  updateChatBaseIndicator();
  renderChatVersions();
  toast(versionId ? 'Base song set for AI Producer conversation.' : 'Base song reset to current Studio composer.');
}

function renderChatVersions() {
  const container = $('chatVersionsList');
  const countBadge = $('chatVersionsCount');
  if (!container) return;

  if (countBadge) countBadge.textContent = chatState.versions.length;
  container.replaceChildren();

  if (!chatState.versions.length) {
    const empty = document.createElement('div');
    empty.className = 'chat-versions-empty';
    empty.innerHTML = `
      <div class="empty-icon"><svg><use href="#i-music"/></svg></div>
      <strong>No versions yet</strong>
      <p>Send a message to your AI Producer. Every generated iteration will appear here.</p>
    `;
    container.append(empty);
    return;
  }

  // Render versions in reverse chronological order
  [...chatState.versions].reverse().forEach(v => {
    const isBase = chatState.activeBaseVersionId === v.id;
    const card = document.createElement('article');
    card.className = `version-card ${isBase ? 'active-base' : ''}`;
    card.style.cursor = 'pointer';
    card.onclick = () => syncInspectorPanel(v);

    const header = document.createElement('div');
    header.className = 'version-card-header';

    const vTag = document.createElement('span');
    vTag.className = 'version-tag';
    vTag.textContent = `v${v.version_num}`;

    const titleEl = document.createElement('strong');
    titleEl.className = 'version-title';
    titleEl.textContent = v.title || 'Untitled track';

    const starBtn = document.createElement('button');
    starBtn.type = 'button';
    starBtn.className = `star-button ${v.starred ? 'starred' : ''}`;
    starBtn.innerHTML = `<svg><use href="#i-star"/></svg>`;
    starBtn.title = v.starred ? 'Starred' : 'Star this version';
    starBtn.onclick = (e) => {
      e.stopPropagation();
      toggleVersionStar(v);
    };

    header.append(vTag, titleEl, starBtn);

    const meta = document.createElement('div');
    meta.className = 'version-card-meta';
    meta.textContent = `${new Date(v.created).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} · ${v.cot === 'off' ? 'Direct Audio' : v.cot === 'melody' ? 'Melody' : 'Full Score'}`;

    const stylePreview = document.createElement('div');
    stylePreview.className = 'version-style-preview';
    stylePreview.textContent = v.style || 'No style prompt recorded';

    const bodyRow = document.createElement('div');
    bodyRow.className = 'version-card-cover-row';

    if (v.cover_url || v.job_id) {
      const coverThumb = document.createElement('img');
      coverThumb.className = 'version-cover-thumb';
      coverThumb.src = v.cover_url || `/artifacts/${v.job_id}/result/cover.jpg`;
      coverThumb.alt = 'Cover';
      coverThumb.onerror = () => coverThumb.remove();
      bodyRow.append(coverThumb);
    }

    const previewBlock = document.createElement('div');
    previewBlock.style.flex = '1';
    previewBlock.style.minWidth = '0';
    previewBlock.append(meta, stylePreview);
    bodyRow.append(previewBlock);

    // Audio player if completed
    let audioElem = null;
    if (v.job_id) {
      const job = state.jobs.find(j => j.id === v.job_id);
      const isComplete = job && ['complete', 'needs_review'].includes(job.status);
      if (isComplete || v.status === 'complete') {
        audioElem = document.createElement('audio');
        audioElem.controls = true;
        audioElem.preload = 'none';
        audioElem.src = `/artifacts/${v.job_id}/result/audio.flac`;
      }
    }

    const actions = document.createElement('div');
    actions.className = 'version-card-actions';

    const infoBtn = document.createElement('button');
    infoBtn.type = 'button';
    infoBtn.className = 'button quiet small';
    infoBtn.innerHTML = `<svg><use href="#i-info"/></svg> Details`;
    infoBtn.onclick = () => showVersionInfoModal(v);

    const baseBtn = document.createElement('button');
    baseBtn.type = 'button';
    baseBtn.className = `button ${isBase ? 'primary' : 'subtle'} small`;
    baseBtn.innerHTML = isBase ? `<svg><use href="#i-check"/></svg> Active Base` : `<svg><use href="#i-refresh"/></svg> Use as Base`;
    baseBtn.onclick = () => setChatBaseVersion(isBase ? null : v.id);

    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.className = 'button subtle small';
    loadBtn.innerHTML = `<svg><use href="#i-upload"/></svg> To Studio`;
    loadBtn.title = 'Load this song version into Studio Composer';
    loadBtn.onclick = () => loadVersionIntoComposer(v);

    actions.append(infoBtn, baseBtn, loadBtn);

    card.append(header, bodyRow);
    if (audioElem) card.append(audioElem);
    card.append(actions);

    container.append(card);
  });
}

async function toggleVersionStar(version) {
  if (!version.job_id) return;
  try {
    const newStar = !version.starred;
    version.starred = newStar;
    await api(`/api/jobs/${version.job_id}/star`, { starred: newStar });
    const mainJob = state.jobs.find(j => j.id === version.job_id);
    if (mainJob) mainJob.starred = newStar;
    saveChatStorage();
    renderChatVersions();
    renderChatMessages();
    toast(newStar ? 'Song starred in library & chat.' : 'Star removed.');
  } catch (err) {
    toast('Error updating star: ' + err.message, true);
  }
}

function loadVersionIntoComposer(version) {
  if (typeof restoreProject === 'function') {
    maybeReplace('Load version v' + version.version_num + ' into Studio Composer?',
      'This will replace the current song in your Studio editor with "' + version.title + '".',
      () => {
        $('songTitle').value = version.title || '';
        $('style').value = version.style || '';
        $('lyrics').value = version.lyrics || '';
        if ($('planMode')) $('planMode').value = version.cot || 'full';
        if (version.seed && $('seed')) $('seed').value = version.seed;
        if (version.job_id) state.sourceJob = version.job_id;
        if (typeof save === 'function') save();
        if (typeof switchView === 'function') switchView('create');
        toast(`Version v${version.version_num} loaded into Studio Composer.`);
      }
    );
  }
}

function showVersionInfoModal(version) {
  const dialog = $('versionInfoDialog');
  if (!dialog) return;

  $('modalVersionTitle').textContent = `Version v${version.version_num}: ${version.title || 'Untitled'}`;
  $('modalVersionMeta').textContent = `Created: ${new Date(version.created).toLocaleString()} · Mode: ${version.cot} · Seed: ${version.seed || 'Auto'}`;
  $('modalVersionStyle').textContent = version.style || 'None';
  $('modalVersionLyrics').textContent = version.lyrics || 'None';
  $('modalVersionNotes').textContent = version.producer_notes || 'No producer notes recorded.';

  $('copyModalStyle').onclick = async () => {
    await navigator.clipboard.writeText(version.style || '');
    toast('Style prompt copied to clipboard.');
  };
  $('copyModalLyrics').onclick = async () => {
    await navigator.clipboard.writeText(version.lyrics || '');
    toast('Lyrics copied to clipboard.');
  };
  $('copyModalAll').onclick = async () => {
    const fullText = `TITLE: ${version.title}\n\nSTYLE:\n${version.style}\n\nLYRICS:\n${version.lyrics}\n\nPRODUCER NOTES:\n${version.producer_notes}`;
    await navigator.clipboard.writeText(fullText);
    toast('Full song details copied to clipboard.');
  };

  dialog.showModal();
}

function renderChatMessages() {
  const container = $('chatMessagesFeed');
  if (!container) return;

  container.replaceChildren();

  if (!chatState.messages.length) {
    const welcome = document.createElement('div');
    welcome.className = 'chat-welcome-bubble';
    welcome.innerHTML = `
      <div class="welcome-header">
        <div class="welcome-avatar"><svg><use href="#i-spark"/></svg></div>
        <div>
          <h3>Welcome to your AI Music Producer</h3>
          <p>I am your creative audio director and songwriting partner. Talk to me naturally to shape your music.</p>
        </div>
      </div>
      <div class="welcome-tips">
        <div class="tip-item">
          <strong>💬 Natural Conversation</strong>
          <span>Say "Make it faster with heavy 808s", "Change chorus to an upbeat rock vibe", or "Add acoustic guitars and male vocals".</span>
        </div>
        <div class="tip-item">
          <strong>⚡ Instant Rendering</strong>
          <span>I'll analyze your request, update the style/lyrics, and automatically render the audio directly into our conversation.</span>
        </div>
        <div class="tip-item">
          <strong>📚 Version History</strong>
          <span>Every iteration is saved on the left panel with prompt info, star ratings, and 1-click loading.</span>
        </div>
      </div>
    `;
    container.append(welcome);
    return;
  }

  chatState.messages.forEach(msg => {
    const row = document.createElement('div');
    row.className = `chat-message-row ${msg.role === 'user' ? 'user-row' : 'producer-row'}`;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${msg.role === 'user' ? 'user-bubble' : 'producer-bubble'}`;

    const header = document.createElement('div');
    header.className = 'bubble-header';

    const author = document.createElement('span');
    author.className = 'bubble-author';
    author.innerHTML = msg.role === 'user'
      ? `<svg><use href="#i-file"/></svg> You`
      : `<svg><use href="#i-spark"/></svg> AI Music Producer`;

    const time = document.createElement('span');
    time.className = 'bubble-time';
    time.textContent = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

    header.append(author, time);
    bubble.append(header);

    const content = document.createElement('div');
    content.className = 'bubble-text';
    content.textContent = msg.content;
    bubble.append(content);

    // If producer message has structured track draft / job
    if (msg.role === 'assistant' && msg.draft) {
      const draftCard = document.createElement('div');
      draftCard.className = 'message-draft-card';

      const draftHeader = document.createElement('div');
      draftHeader.className = 'draft-card-header';
      draftHeader.innerHTML = `
        <span class="draft-pill">🎵 ${msg.draft.title || 'New Track'}</span>
        <span class="draft-pill-mode">${msg.draft.cot === 'off' ? 'Direct Audio' : msg.draft.cot === 'melody' ? 'Melody' : 'Full Score'}</span>
      `;

      const draftStyle = document.createElement('div');
      draftStyle.className = 'draft-style-tag';
      draftStyle.textContent = msg.draft.style;

      draftCard.append(draftHeader, draftStyle);

      if (msg.draft.producer_notes) {
        const notes = document.createElement('div');
        notes.className = 'draft-notes-text';
        notes.textContent = `💡 Producer Notes: ${msg.draft.producer_notes}`;
        draftCard.append(notes);
      }

      // Inline expandable editor / inspector
      const editDetails = document.createElement('details');
      editDetails.className = 'draft-expand-details';
      editDetails.innerHTML = `
        <summary class="draft-expand-summary"><svg class="icon-s"><use href="#i-pencil"/></svg> <span>Inspect &amp; Edit Proposal</span></summary>
        <div class="draft-edit-form">
          <label class="field-label-s">Title</label>
          <input type="text" class="draft-input-title" value="${(msg.draft.title || '').replace(/"/g, '&quot;')}" placeholder="Track title">
          <label class="field-label-s">Musical Style Prompt</label>
          <textarea class="draft-input-style" rows="2" placeholder="Style prompt">${(msg.draft.style || '').replace(/</g, '&lt;')}</textarea>
          <label class="field-label-s">Lyrics</label>
          <textarea class="draft-input-lyrics" rows="4" placeholder="Lyrics">${(msg.draft.lyrics || '').replace(/</g, '&lt;')}</textarea>
        </div>
      `;
      const titleInput = editDetails.querySelector('.draft-input-title');
      const styleInput = editDetails.querySelector('.draft-input-style');
      const lyricsInput = editDetails.querySelector('.draft-input-lyrics');
      if (titleInput) titleInput.oninput = () => { msg.draft.title = titleInput.value; saveChatStorage(); };
      if (styleInput) styleInput.oninput = () => { msg.draft.style = styleInput.value; draftStyle.textContent = styleInput.value; saveChatStorage(); };
      if (lyricsInput) lyricsInput.oninput = () => { msg.draft.lyrics = lyricsInput.value; saveChatStorage(); };
      draftCard.append(editDetails);

      // Live Audio Player / Progress inside bubble
      if (msg.job_id) {
        const audioContainer = document.createElement('div');
        audioContainer.className = 'inline-audio-container';
        audioContainer.id = `chat_audio_${msg.job_id}`;
        renderInlineAudioCard(audioContainer, msg.job_id, msg.draft);
        draftCard.append(audioContainer);
      } else if (msg.draft.style) {
        const draftActions = document.createElement('div');
        draftActions.className = 'draft-pending-actions row gap-s wrap';
        draftActions.style.marginTop = '10px';

        const renderBtn = document.createElement('button');
        renderBtn.type = 'button';
        renderBtn.className = 'button primary small';
        renderBtn.innerHTML = `<svg><use href="#i-arrow"/></svg> Render this track`;
        renderBtn.onclick = async () => {
          renderBtn.disabled = true;
          renderBtn.textContent = 'Queueing on GPU…';
          try {
            const currentSong = getActiveChatContext();
            const jobPayload = {
              title: msg.draft.title || currentSong.title || 'Untitled track',
              mode: state.mode || 'create',
              stage: 'audio',
              request: {
                style: msg.draft.style,
                lyrics: msg.draft.lyrics || '',
                cot: msg.draft.cot || 'full',
                seed: Math.floor(Math.random() * (2**31 - 1)),
                id: 'song'
              },
              settings: state.settings,
              source_job: currentSong.source_job || ''
            };
            const job = await api('/api/generate', jobPayload);
            msg.job_id = job.id;
            saveChatStorage();
            renderChatMessages();
            if (typeof poll === 'function') poll();
            toast('Track queued for GPU rendering!');
          } catch (err) {
            toast('Render error: ' + err.message, true);
            renderBtn.disabled = false;
            renderBtn.innerHTML = `<svg><use href="#i-arrow"/></svg> Render this track`;
          }
        };

        const loadBtn = document.createElement('button');
        loadBtn.type = 'button';
        loadBtn.className = 'button subtle small';
        loadBtn.innerHTML = `<svg><use href="#i-upload"/></svg> Load to Composer`;
        loadBtn.onclick = () => {
          if ($('songTitle')) $('songTitle').value = msg.draft.title || '';
          if ($('style')) $('style').value = msg.draft.style || '';
          if ($('lyrics')) $('lyrics').value = msg.draft.lyrics || '';
          if ($('planMode')) $('planMode').value = msg.draft.cot || 'full';
          if (typeof save === 'function') save();
          if (typeof switchView === 'function') switchView('create');
          toast('Draft loaded into Studio Composer.');
        };

        const copyPromptBtn = document.createElement('button');
        copyPromptBtn.type = 'button';
        copyPromptBtn.className = 'button quiet small';
        copyPromptBtn.textContent = 'Copy Prompt';
        copyPromptBtn.onclick = async () => {
          await navigator.clipboard.writeText(msg.draft.style || '');
          toast('Style prompt copied to clipboard.');
        };

        draftActions.append(renderBtn, loadBtn, copyPromptBtn);
        draftCard.append(draftActions);
      }

      bubble.append(draftCard);
    }

    row.append(bubble);
    container.append(row);
  });

  // Auto-scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function renderInlineAudioCard(container, jobId, draft) {
  const job = state.jobs.find(j => j.id === jobId);
  container.replaceChildren();

  if (!job) {
    const waiting = document.createElement('div');
    waiting.className = 'inline-loading-card';
    waiting.innerHTML = `<span class="status-dot pulse"></span><span>Connecting to GPU queue…</span>`;
    container.append(waiting);
    return;
  }

  const isLive = ['queued', 'running', 'cancelling'].includes(job.status);
  const isComplete = ['complete', 'needs_review'].includes(job.status);
  const isFailed = ['failed', 'cancelled', 'interrupted'].includes(job.status);

  if (isLive) {
    const liveBox = document.createElement('div');
    liveBox.className = 'inline-progress-card';

    const topRow = document.createElement('div');
    topRow.className = 'row between';
    topRow.innerHTML = `
      <span class="row gap-s"><span class="status-dot pulse"></span> <strong>${job.status === 'queued' ? 'Queued on GPU…' : 'Rendering Lossless Audio…'}</strong></span>
      <button class="button danger small" id="cancel_chat_${jobId}">Cancel</button>
    `;

    const progressElem = document.createElement('div');
    progressElem.className = 'engine-progress';
    renderProgress(progressElem, job);

    liveBox.append(topRow, progressElem);
    container.append(liveBox);

    const cancelBtn = liveBox.querySelector(`#cancel_chat_${jobId}`);
    if (cancelBtn) {
      cancelBtn.onclick = async () => {
        try {
          cancelBtn.disabled = true;
          await api(`/api/jobs/${jobId}/cancel`, {});
        } catch (e) {
          toast(e.message, true);
        }
      };
    }
  } else if (isComplete) {
    const completeBox = document.createElement('div');
    completeBox.className = 'inline-player-card';

    const player = document.createElement('audio');
    player.controls = true;
    player.preload = 'metadata';
    player.src = `/artifacts/${jobId}/result/audio.flac`;

    const actionRow = document.createElement('div');
    actionRow.className = 'inline-player-actions';

    const starBtn = document.createElement('button');
    starBtn.type = 'button';
    starBtn.className = `star-button ${job.starred ? 'starred' : ''}`;
    starBtn.innerHTML = `<svg><use href="#i-star"/></svg>`;
    starBtn.title = job.starred ? 'Remove star' : 'Star this song';
    starBtn.onclick = async () => {
      await toggleStar(jobId);
      renderChatMessages();
      renderChatVersions();
    };

    const dlFlac = document.createElement('a');
    dlFlac.href = `/artifacts/${jobId}/result/audio.flac`;
    dlFlac.download = `${job.title || 'song'}.flac`;
    dlFlac.className = 'button primary small';
    dlFlac.innerHTML = `<svg><use href="#i-download"/></svg> FLAC`;

    const dlWav = document.createElement('button');
    dlWav.type = 'button';
    dlWav.className = 'button subtle small';
    dlWav.innerHTML = `WAV`;
    dlWav.onclick = async () => {
      try {
        const res = await api(`/api/jobs/${jobId}/wav`, {});
        const link = document.createElement('a');
        link.href = res.url;
        link.download = `${job.title || 'song'}.wav`;
        link.click();
      } catch (e) {
        toast('WAV export error: ' + e.message, true);
      }
    };

    const toStudio = document.createElement('button');
    toStudio.type = 'button';
    toStudio.className = 'button subtle small';
    toStudio.innerHTML = `<svg><use href="#i-upload"/></svg> Load to Studio`;
    toStudio.onclick = () => {
      const v = chatState.versions.find(item => item.job_id === jobId);
      if (v) loadVersionIntoComposer(v);
      else useRun(job, false);
    };

    const coverArt = document.createElement('img');
    coverArt.className = 'inline-cover-art';
    coverArt.src = `/artifacts/${jobId}/result/cover.jpg`;
    coverArt.alt = `${job.title || 'Track'} Album Cover`;
    coverArt.onerror = () => coverArt.remove();

    const genCoverBtn = document.createElement('button');
    genCoverBtn.type = 'button';
    genCoverBtn.className = 'button subtle small';
    genCoverBtn.innerHTML = `<svg><use href="#i-palette"/></svg> Cover Art`;
    genCoverBtn.onclick = async () => {
      genCoverBtn.disabled = true;
      genCoverBtn.textContent = 'Generating Cover…';
      try {
        const res = await api('/api/cover/generate', {
          job_id: jobId,
          title: job.title || '',
          style: job.input?.request?.style || '',
          lyrics: job.input?.request?.lyrics || ''
        });
        toast('Album cover generated with Z-Image Turbo!');
        renderChatMessages();
        renderChatVersions();
        syncInspectorPanel();
      } catch (e) {
        toast('Cover error: ' + e.message, true);
      } finally {
        genCoverBtn.disabled = false;
        genCoverBtn.innerHTML = `<svg><use href="#i-palette"/></svg> Cover Art`;
      }
    };

    actionRow.append(starBtn, dlFlac, dlWav, genCoverBtn, toStudio);
    completeBox.append(coverArt, player, actionRow);
    container.append(completeBox);
  } else if (isFailed) {
    const errorBox = document.createElement('div');
    errorBox.className = 'inline-error-card';
    errorBox.innerHTML = `
      <span class="danger-tag">Render ${job.status}</span>
      <p class="error-msg">${job.error || 'Generation was cancelled or stopped.'}</p>
    `;
    container.append(errorBox);
  }
}

async function sendChatMessage() {
  const input = $('chatInputText');
  if (!input) return;
  const userText = input.value.trim();
  if (!userText || chatState.isGenerating) return;

  if (!state.connection.model) {
    if (typeof openRunner === 'function') openRunner();
    else toast('Please configure an LLM model in LLM Runner first.', true);
    return;
  }

  // Clear input
  input.value = '';
  input.style.height = 'auto';

  // Add User Message
  chatState.messages.push({
    role: 'user',
    content: userText,
    timestamp: Date.now()
  });
  renderChatMessages();

  chatState.isGenerating = true;
  updateChatSendButton();

  const explicitGenKeywords = ['generuj', 'render', 'stwórz', 'wygeneruj', 'odpal', 'nagraj', 'zrób to', 'generate', 'produce this', 'render this', 'let\'s render', 'make it'];
  const hasIntent = explicitGenKeywords.some(kw => userText.toLowerCase().includes(kw));
  const autoGenerate = ($('chatAutoGenToggle') ? $('chatAutoGenToggle').checked : false) || hasIntent;
  const currentSongContext = getActiveChatContext();

  try {
    const historyPayload = chatState.messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    const result = await api('/api/chat/produce', {
      connection: state.connection,
      message: userText,
      history: historyPayload,
      current_song: currentSongContext,
      settings: state.settings,
      auto_generate: autoGenerate
    });

    const draft = result.draft || {};
    const replyText = result.reply || draft.producer_reply || 'I have updated your track!';
    const jobId = result.job ? result.job.id : null;

    // Add Assistant Message
    chatState.messages.push({
      role: 'assistant',
      content: replyText,
      draft: draft,
      job_id: jobId,
      timestamp: Date.now()
    });

    // Record as a version iteration
    const versionNum = chatState.versions.length + 1;
    const newVersion = {
      id: 'ver_' + Date.now(),
      version_num: versionNum,
      job_id: jobId,
      title: draft.title || `Iteration ${versionNum}`,
      style: draft.style || currentSongContext.style,
      lyrics: draft.lyrics || currentSongContext.lyrics,
      cot: draft.cot || currentSongContext.cot || 'full',
      seed: draft.seed || null,
      producer_notes: draft.producer_notes || replyText,
      created: Date.now(),
      status: jobId ? 'queued' : 'draft',
      starred: false
    };

    chatState.versions.push(newVersion);
    chatState.activeBaseVersionId = newVersion.id;

    saveChatStorage();
    renderChatMessages();
    renderChatVersions();
    updateChatBaseIndicator();
    syncInspectorPanel(newVersion);

    if (jobId) {
      chatState.activeChatJobId = jobId;
      state.activeId = jobId;
      if (typeof poll === 'function') poll();
      toast(`Version v${versionNum} queued for rendering!`);
    } else {
      toast(`Version v${versionNum} draft prepared.`);
    }

  } catch (err) {
    chatState.messages.push({
      role: 'assistant',
      content: '⚠️ Error from AI Producer: ' + err.message,
      timestamp: Date.now()
    });
    renderChatMessages();
    toast(err.message, true);
  } finally {
    chatState.isGenerating = false;
    updateChatSendButton();
  }
}

function updateChatSendButton() {
  const btn = $('chatSendBtn');
  if (!btn) return;
  btn.disabled = chatState.isGenerating;
  btn.innerHTML = chatState.isGenerating
    ? `<span class="status-dot pulse"></span> Working…`
    : `<svg><use href="#i-arrow"/></svg> Send`;
}

function clearChatSession() {
  maybeReplace('Clear AI Producer Chat?', 'This will reset the conversation history and start a fresh session. Your generated songs remain saved in the Song Library.', () => {
    chatState.messages = [];
    chatState.versions = [];
    chatState.activeBaseVersionId = null;
    saveChatStorage();
    renderChatMessages();
    renderChatVersions();
    updateChatBaseIndicator();
    syncInspectorPanel();
    toast('Chat session cleared.');
  });
}

function openChatPopout() {
  const url = `${window.location.origin}/?view=chat`;
  window.open(url, 'YuE2_AI_Producer_Chat', 'width=1320,height=860,menubar=no,toolbar=no,location=no,status=no');
}

function bindInspectorUI() {
  const title = $('inspectorTitle');
  const style = $('inspectorStyle');
  const lyrics = $('inspectorLyrics');
  const mode = $('inspectorMode');
  const lora = $('inspectorLora');
  const loraStrength = $('inspectorLoraStrength');
  const loraVal = $('inspectorLoraVal');
  const seed = $('inspectorSeed');
  const randSeed = $('inspectorRandomSeed');
  const renderBtn = $('inspectorRenderBtn');
  const syncBtn = $('syncInspectorToComposer');
  const copyStyleBtn = $('inspectorCopyStyle');
  const copyLyricsBtn = $('inspectorCopyLyrics');

  const updateActiveVersionDraft = () => {
    if (chatState.activeBaseVersionId) {
      const v = chatState.versions.find(item => item.id === chatState.activeBaseVersionId);
      if (v) {
        if (title) v.title = title.value;
        if (style) v.style = style.value;
        if (lyrics) v.lyrics = lyrics.value;
        if (mode) v.cot = mode.value;
        if (seed) v.seed = seed.value;
        if (lora) v.lora_path = lora.value;
        if (loraStrength) v.lora_strength = Number(loraStrength.value);
        saveChatStorage();
        renderChatVersions();
        updateChatBaseIndicator();
      }
    }
  };

  if (title) title.oninput = updateActiveVersionDraft;
  if (style) style.oninput = updateActiveVersionDraft;
  if (lyrics) lyrics.oninput = updateActiveVersionDraft;
  if (mode) mode.onchange = updateActiveVersionDraft;

  if (lora) {
    lora.onchange = () => {
      if (state.settings?.lora) {
        state.settings.lora.path = lora.value;
        if (typeof syncLoras === 'function') syncLoras();
        if (typeof save === 'function') save();
      }
      updateActiveVersionDraft();
    };
  }

  if (loraStrength) {
    loraStrength.oninput = () => {
      const val = Number(loraStrength.value);
      if (loraVal) loraVal.textContent = val.toFixed(2);
      if (state.settings?.lora) {
        state.settings.lora.strength = val;
        if (typeof syncLoras === 'function') syncLoras();
        if (typeof save === 'function') save();
      }
      updateActiveVersionDraft();
    };
  }

  if (randSeed && seed) {
    randSeed.onclick = () => {
      seed.value = Math.floor(Math.random() * (2**31 - 1));
      updateActiveVersionDraft();
    };
  }

  if (copyStyleBtn && style) {
    copyStyleBtn.onclick = async () => {
      await navigator.clipboard.writeText(style.value || '');
      toast('Style prompt copied to clipboard.');
    };
  }

  if (copyLyricsBtn && lyrics) {
    copyLyricsBtn.onclick = async () => {
      await navigator.clipboard.writeText(lyrics.value || '');
      toast('Lyrics copied to clipboard.');
    };
  }

  const genCoverBtn = $('inspectorGenerateCover');
  const coverImg = $('inspectorCoverImg');
  const coverPl = $('inspectorCoverPlaceholder');
  const coverPromptInput = $('inspectorCoverPrompt');

  if (genCoverBtn) {
    genCoverBtn.onclick = async () => {
      let activeJobId = null;
      if (chatState.activeBaseVersionId) {
        const v = chatState.versions.find(item => item.id === chatState.activeBaseVersionId);
        if (v && v.job_id) activeJobId = v.job_id;
      }
      if (!activeJobId && chatState.activeChatJobId) {
        activeJobId = chatState.activeChatJobId;
      }
      if (!activeJobId && state.jobs && state.jobs.length) {
        const lastComplete = state.jobs.find(j => j.status === 'complete');
        if (lastComplete) activeJobId = lastComplete.id;
      }

      if (!activeJobId) {
        toast('Render a song first before generating its album cover.', true);
        return;
      }

      genCoverBtn.disabled = true;
      const origHtml = genCoverBtn.innerHTML;
      genCoverBtn.innerHTML = `<span class="status-dot pulse"></span> Generating Cover…`;

      try {
        const curTitle = title ? title.value : '';
        const curStyle = style ? style.value : '';
        const curLyrics = lyrics ? lyrics.value : '';
        const curPrompt = coverPromptInput ? coverPromptInput.value : '';
        const curSeed = seed ? parseInt(seed.value, 10) : undefined;

        const res = await api('/api/cover/generate', {
          job_id: activeJobId,
          title: curTitle,
          style: curStyle,
          lyrics: curLyrics,
          prompt: curPrompt,
          seed: curSeed
        });

        toast('Album cover generated with Z-Image Turbo!');
        if (coverImg && coverPl) {
          coverImg.src = res.url + '?t=' + Date.now();
          coverImg.hidden = false;
          coverPl.hidden = true;
        }
        if (coverPromptInput && res.prompt) {
          coverPromptInput.value = res.prompt;
        }
        if (chatState.activeBaseVersionId) {
          const v = chatState.versions.find(item => item.id === chatState.activeBaseVersionId);
          if (v) {
            v.cover_url = res.url;
            v.cover_prompt = res.prompt;
            saveChatStorage();
            renderChatVersions();
          }
        }
        renderChatMessages();
      } catch (err) {
        toast('Cover generation error: ' + err.message, true);
      } finally {
        genCoverBtn.disabled = false;
        genCoverBtn.innerHTML = origHtml;
      }
    };
  }

  if (syncBtn) {
    syncBtn.onclick = () => {
      if ($('songTitle')) $('songTitle').value = title ? title.value : '';
      if ($('style')) $('style').value = style ? style.value : '';
      if ($('lyrics')) $('lyrics').value = lyrics ? lyrics.value : '';
      if ($('planMode')) $('planMode').value = mode ? mode.value : 'full';
      if ($('seed')) $('seed').value = seed ? seed.value : '831001';
      if (lora && state.settings?.lora) {
        state.settings.lora.path = lora.value;
        if (loraStrength) state.settings.lora.strength = Number(loraStrength.value);
        if (typeof syncLoras === 'function') syncLoras();
      }
      if (typeof save === 'function') save();
      if (typeof switchView === 'function') switchView('create');
      toast('Inspector proposal loaded into Studio Composer.');
    };
  }

  if (renderBtn) {
    renderBtn.onclick = async () => {
      if (chatState.isGenerating) return;
      renderBtn.disabled = true;
      const originalHtml = renderBtn.innerHTML;
      renderBtn.innerHTML = `<span class="status-dot pulse"></span> Queueing on GPU…`;

      try {
        const currentSong = getActiveChatContext();
        const curTitle = title?.value.trim() || currentSong.title || 'Untitled Track';
        const curStyle = style?.value.trim() || currentSong.style || '';
        const curLyrics = lyrics?.value.trim() || currentSong.lyrics || '';
        const curCot = mode?.value || currentSong.cot || 'full';
        const curSeed = parseInt(seed?.value, 10) || Math.floor(Math.random() * (2**31 - 1));

        if (lora && state.settings?.lora) {
          state.settings.lora.path = lora.value;
          if (loraStrength) state.settings.lora.strength = Number(loraStrength.value);
        }

        const jobPayload = {
          title: curTitle,
          mode: state.mode || 'create',
          stage: 'audio',
          request: {
            style: curStyle,
            lyrics: curLyrics,
            cot: curCot,
            seed: curSeed,
            id: 'song'
          },
          settings: state.settings,
          source_job: currentSong.source_job || ''
        };

        const job = await api('/api/generate', jobPayload);
        const versionNum = chatState.versions.length + 1;
        const newVersion = {
          id: 'ver_' + Date.now(),
          version_num: versionNum,
          job_id: job.id,
          title: curTitle,
          style: curStyle,
          lyrics: curLyrics,
          cot: curCot,
          seed: curSeed,
          lora_path: lora?.value || '',
          lora_strength: loraStrength ? Number(loraStrength.value) : 1.0,
          producer_notes: 'Rendered directly from Track Inspector.',
          created: Date.now(),
          status: 'queued',
          starred: false
        };

        chatState.versions.push(newVersion);
        chatState.activeBaseVersionId = newVersion.id;

        chatState.messages.push({
          role: 'assistant',
          content: `🚀 Triggered render on GPU for "${curTitle}" (v${versionNum}).`,
          draft: {
            title: curTitle,
            style: curStyle,
            lyrics: curLyrics,
            cot: curCot,
            seed: curSeed,
            producer_notes: 'Track queued from Inspector.'
          },
          job_id: job.id,
          timestamp: Date.now()
        });

        saveChatStorage();
        renderChatMessages();
        renderChatVersions();
        updateChatBaseIndicator();
        syncInspectorPanel(newVersion);

        chatState.activeChatJobId = job.id;
        state.activeId = job.id;
        if (typeof poll === 'function') poll();
        toast(`Version v${versionNum} queued for GPU rendering!`);

      } catch (err) {
        toast('Render error: ' + err.message, true);
      } finally {
        renderBtn.disabled = false;
        renderBtn.innerHTML = originalHtml;
      }
    };
  }
}

function bindChatUI() {
  const sendBtn = $('chatSendBtn');
  const input = $('chatInputText');
  const clearBtn = $('clearChatBtn');
  const popoutBtn = $('popoutChatBtn');
  const popoutTopbarBtn = $('popoutTopbarChat');
  const resetBaseBtn = $('resetChatBaseBtn');

  if (sendBtn) sendBtn.onclick = sendChatMessage;

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    });
  }

  if (clearBtn) clearBtn.onclick = clearChatSession;
  if (popoutBtn) popoutBtn.onclick = openChatPopout;
  if (popoutTopbarBtn) popoutTopbarBtn.onclick = openChatPopout;
  if (resetBaseBtn) resetBaseBtn.onclick = () => setChatBaseVersion(null);

  // Quick suggestion chips
  document.querySelectorAll('.chat-chip[data-prompt]').forEach(chip => {
    chip.onclick = () => {
      if (input) {
        input.value = chip.dataset.prompt;
        input.focus();
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
      }
    };
  });

  bindInspectorUI();
}

// Global hook for polling loop: updates inline audio cards & version statuses
window.updateChatJobStatuses = function() {
  if (!chatState.messages.length) return;

  let needsSave = false;
  chatState.versions.forEach(v => {
    if (v.job_id) {
      const job = state.jobs.find(j => j.id === v.job_id);
      if (job && job.status !== v.status) {
        v.status = job.status;
        v.starred = Boolean(job.starred);
        needsSave = true;
      }
    }
  });

  if (needsSave) {
    saveChatStorage();
    renderChatVersions();
  }

  // Update visible inline audio players in chat messages
  chatState.messages.forEach(m => {
    if (m.job_id) {
      const el = document.getElementById(`chat_audio_${m.job_id}`);
      if (el) renderInlineAudioCard(el, m.job_id, m.draft);
    }
  });
};
