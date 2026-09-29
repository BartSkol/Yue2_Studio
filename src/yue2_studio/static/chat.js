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

function initChat() {
  loadChatStorage();
  bindChatUI();
  renderChatMessages();
  renderChatVersions();
  updateChatBaseIndicator();

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
        source_job: v.job_id || state.sourceJob || ''
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
    source_job: state.sourceJob || ''
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

    card.append(header, meta, stylePreview);
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

      // Live Audio Player / Progress inside bubble
      if (msg.job_id) {
        const audioContainer = document.createElement('div');
        audioContainer.className = 'inline-audio-container';
        audioContainer.id = `chat_audio_${msg.job_id}`;
        renderInlineAudioCard(audioContainer, msg.job_id, msg.draft);
        draftCard.append(audioContainer);
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

    actionRow.append(starBtn, dlFlac, dlWav, toStudio);
    completeBox.append(player, actionRow);
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

  const autoGenerate = $('chatAutoGenToggle') ? $('chatAutoGenToggle').checked : true;
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
    toast('Chat session cleared.');
  });
}

function openChatPopout() {
  const url = `${window.location.origin}/?view=chat`;
  window.open(url, 'YuE2_AI_Producer_Chat', 'width=1320,height=860,menubar=no,toolbar=no,location=no,status=no');
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
