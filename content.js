(function () {
  'use strict';

  console.log('[SkribblCheat] loaded');

  // ── State ────────────────────────────────────────────────────────────────
  let autoGuess = false;
  let showStatus = true;

  let guessed    = new Set();
  let wordPattern = '';
  let busy        = false;
  let lastHotkeyToggleAt = 0;
  let autoGuessVersion = 0;

  // ── Delay / spam-ramp ────────────────────────────────────────────────────
  // userDelayMs: the delay the user configured in the popup
  // rampDelay:   null = use userDelayMs; number = post-spam ramp (decreases each guess)
  let userDelayMs = 1000;
  let minLetters  = 0;
  let maxWords    = 0; // 0 means any amount
  let spamPauseMs = 5000;
  let adaptiveSpeed = true;
  let showWordList = false;
  let showCooldown = true;
  let sortPopularity = true;
  let filterOtherGuesses = true;
  let useCloseSniper = true;
  let hideSpamWarnings = false;
  let hideCloseMessages = false;
  let hideUserMessages = false;
  let hideGameNotices = false;
  let hideNoticeGuessed = true;
  let hideNoticeWordReveal = true;
  let hideNoticeJoinLeave = true;
  let hideNoticeDrawing = true;
  let hideNoticeReactions = true;
  let hideNoticeKickBan = true;
  let hideNoticeVotekick = true;
  let autoVotekick = false;
  let autoReconnect = false;
  let autoRequeue = false;
  let requeueDelayMs = 3000;
  let chatRepeatEnabled = false;
  let chatRepeatMessage = '';
  let chatRepeatCount = 1;
  let chatRepeaterActive = false;
  let customTheme = false;
  let cleanLobby = false;
  let themeBackground = '#15161c';
  let themePanel = '#182044';
  let themeChat = '#10131d';
  let themePlayers = '#151a2c';
  let themeText = '#f0f2f7';
  let themeAccent = '#8fa7ff';
  let themeBrightness = 100;
  let lobbyBackgroundUrl = '';
  let gameBackgroundUrl = '';
  let rampStartMs = 3000;
  let rampStepPct = 11;
  let hotkey = 'Control';
  let rampDelay   = null;       // null while running at normal speed
  let lastSpamTime = 0;
  let lastAutoVotekickAt = 0;
  let lastAutoVotekickTarget = '';
  let chatRepeaterRunId = 0;
  let listRefreshRunId = 0;
  let lastRoomId = '';
  let wasInGame = false;
  let recoveryTimerId = null;
  let recoveryAttempts = 0;
  let lastRecoveryReason = '';

  function safeStorageSet(data) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(data);
      }
    } catch (e) {
      console.log('[SkribblCheat] storage unavailable:', e.message);
    }
  }

  function effectiveDelay() {
    return rampDelay !== null ? rampDelay : userDelayMs;
  }

  function editDistance(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  function closeEnough(a, b) {
    return a.length === b.length && editDistance(a, b) === 1;
  }

  function keyNameFromEvent(e) {
    if (e.key === ' ') return 'Space';
    if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') return e.key;
    return e.key.length === 1 ? e.key.toUpperCase() : e.key;
  }

  function matchesHotkey(e) {
    return keyNameFromEvent(e) === hotkey;
  }

  function setAutoGuessState(nextAutoGuess, persist) {
    if (autoGuess === nextAutoGuess) {
      updateStatusOverlay();
      return;
    }
    autoGuess = nextAutoGuess;
    updateStatusOverlay();
    if (autoGuess) scheduleTick();
    else {
      cancelPendingTick();
      scheduleListRefresh();
    }
    if (persist) {
      autoGuessVersion += 1;
      safeStorageSet({ autoGuess, autoGuessVersion });
    }
  }

  /** Called after a word is successfully sent. Ramps delay back toward normal. */
  function onGuessedWord() {
    if (rampDelay === null) return;
    rampDelay *= Math.max(0.01, 1 - (rampStepPct / 100));
    if (rampDelay <= userDelayMs) {
      console.log('[SkribblCheat] ramp complete → normal delay', userDelayMs, 'ms');
      rampDelay = null;
    } else {
      console.log('[SkribblCheat] ramp delay →', Math.round(rampDelay), 'ms');
    }
    updateStatusOverlay();
  }

  function T() {
    const d = effectiveDelay();
    return {
      pre:  d * 0.1,
      preR: d * 0.4,
      post: d * 0.5,
      next: d * 0.3,
      nextR: d * 0.5
    };
  }

  chrome.storage.local.get(['autoGuess', 'autoGuessVersion', 'delaySpeed', 'minLetters', 'maxWords', 'adaptiveSpeed', 'spamPause', 'rampStart', 'rampStepPct', 'requeueDelay', 'autoHotkey', 'showWordList', 'showStatus', 'showCooldown', 'sortPopularity', 'filterOtherGuesses', 'useCloseSniper', 'hideSpamWarnings', 'hideCloseMessages', 'hideUserMessages', 'hideGameNotices', 'hideNoticeGuessed', 'hideNoticeWordReveal', 'hideNoticeJoinLeave', 'hideNoticeDrawing', 'hideNoticeReactions', 'hideNoticeKickBan', 'hideNoticeVotekick', 'autoVotekick', 'autoReconnect', 'autoRequeue', 'lastRoomId', 'chatRepeatEnabled', 'chatRepeatMessage', 'chatRepeatCount', 'customTheme', 'cleanLobby', 'themeBackground', 'themePanel', 'themeChat', 'themePlayers', 'themeText', 'themeAccent', 'themeBrightness', 'lobbyBackgroundUrl', 'gameBackgroundUrl'], (data) => {
    autoGuess = data.autoGuess ?? false;
    autoGuessVersion = data.autoGuessVersion ?? 0;
    userDelayMs = data.delaySpeed ?? 1000;
    minLetters  = data.minLetters ?? 0;
    maxWords    = data.maxWords ?? 0;
    adaptiveSpeed = data.adaptiveSpeed ?? true;
    spamPauseMs = data.spamPause ?? 5000;
    rampStartMs = data.rampStart ?? 3000;
    rampStepPct = data.rampStepPct ?? 11;
    requeueDelayMs = data.requeueDelay ?? 3000;
    hotkey = data.autoHotkey ?? 'Control';
    showWordList = data.showWordList ?? false;
    showStatus   = data.showStatus ?? true;
    showCooldown = data.showCooldown ?? true;
    sortPopularity = data.sortPopularity ?? true;
    filterOtherGuesses = data.filterOtherGuesses ?? true;
    useCloseSniper = data.useCloseSniper ?? true;
    hideSpamWarnings = data.hideSpamWarnings ?? false;
    hideCloseMessages = data.hideCloseMessages ?? false;
    hideUserMessages = data.hideUserMessages ?? false;
    hideGameNotices = data.hideGameNotices ?? false;
    hideNoticeGuessed = data.hideNoticeGuessed ?? true;
    hideNoticeWordReveal = data.hideNoticeWordReveal ?? true;
    hideNoticeJoinLeave = data.hideNoticeJoinLeave ?? true;
    hideNoticeDrawing = data.hideNoticeDrawing ?? true;
    hideNoticeReactions = data.hideNoticeReactions ?? true;
    hideNoticeKickBan = data.hideNoticeKickBan ?? true;
    hideNoticeVotekick = data.hideNoticeVotekick ?? true;
    autoVotekick = data.autoVotekick ?? false;
    autoReconnect = data.autoReconnect ?? false;
    autoRequeue = data.autoRequeue ?? false;
    if (autoReconnect && autoRequeue) {
      autoRequeue = false;
      safeStorageSet({ autoRequeue: false });
    }
    lastRoomId = data.lastRoomId ?? '';
    chatRepeatEnabled = data.chatRepeatEnabled ?? false;
    chatRepeatMessage = data.chatRepeatMessage ?? '';
    chatRepeatCount = data.chatRepeatCount ?? 1;
    customTheme = data.customTheme ?? false;
    cleanLobby = data.cleanLobby ?? false;
    themeBackground = data.themeBackground ?? '#15161c';
    themePanel = data.themePanel ?? '#182044';
    themeChat = data.themeChat ?? '#10131d';
    themePlayers = data.themePlayers ?? '#151a2c';
    themeText = data.themeText ?? '#f0f2f7';
    themeAccent = data.themeAccent ?? '#8fa7ff';
    themeBrightness = Number(data.themeBrightness ?? 100);
    lobbyBackgroundUrl = data.lobbyBackgroundUrl ?? '';
    gameBackgroundUrl = data.gameBackgroundUrl ?? '';
    updateTheme();
    applyMessageFilters();
    updateStatusOverlay();
    updateChatRepeaterState();
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.autoGuess) {
      const incomingVersion = changes.autoGuessVersion ? changes.autoGuessVersion.newValue : null;
      if (incomingVersion !== null && incomingVersion < autoGuessVersion) return;
      if (incomingVersion !== null) autoGuessVersion = incomingVersion;
      setAutoGuessState(!!changes.autoGuess.newValue, false);
    }
    if (changes.showWordList) {
      showWordList = changes.showWordList.newValue;
      if (showWordList) scheduleListRefresh();
      else updateWordListOverlay([]);
    }
    if (changes.showStatus) {
      showStatus = changes.showStatus.newValue;
      updateStatusOverlay();
    }
    if (changes.sortPopularity) {
      sortPopularity = changes.sortPopularity.newValue;
    }
    if (changes.showCooldown) {
      showCooldown = changes.showCooldown.newValue;
      updateStatusOverlay();
    }
    if (changes.filterOtherGuesses) {
      filterOtherGuesses = changes.filterOtherGuesses.newValue;
    }
    if (changes.useCloseSniper) {
      useCloseSniper = changes.useCloseSniper.newValue;
    }
    if (changes.hideSpamWarnings) {
      hideSpamWarnings = changes.hideSpamWarnings.newValue;
      applyMessageFilters();
    }
    if (changes.hideCloseMessages) {
      hideCloseMessages = changes.hideCloseMessages.newValue;
      applyMessageFilters();
    }
    if (changes.hideUserMessages) {
      hideUserMessages = changes.hideUserMessages.newValue;
      applyMessageFilters();
    }
    if (changes.hideGameNotices) {
      hideGameNotices = changes.hideGameNotices.newValue;
      applyMessageFilters();
    }
    if (changes.hideNoticeGuessed) {
      hideNoticeGuessed = changes.hideNoticeGuessed.newValue;
      applyMessageFilters();
    }
    if (changes.hideNoticeWordReveal) {
      hideNoticeWordReveal = changes.hideNoticeWordReveal.newValue;
      applyMessageFilters();
    }
    if (changes.hideNoticeJoinLeave) {
      hideNoticeJoinLeave = changes.hideNoticeJoinLeave.newValue;
      applyMessageFilters();
    }
    if (changes.hideNoticeDrawing) {
      hideNoticeDrawing = changes.hideNoticeDrawing.newValue;
      applyMessageFilters();
    }
    if (changes.hideNoticeReactions) {
      hideNoticeReactions = changes.hideNoticeReactions.newValue;
      applyMessageFilters();
    }
    if (changes.hideNoticeKickBan) {
      hideNoticeKickBan = changes.hideNoticeKickBan.newValue;
      applyMessageFilters();
    }
    if (changes.hideNoticeVotekick) {
      hideNoticeVotekick = changes.hideNoticeVotekick.newValue;
      applyMessageFilters();
    }
    if (changes.autoVotekick) autoVotekick = changes.autoVotekick.newValue;
    if (changes.autoReconnect) {
      autoReconnect = !!changes.autoReconnect.newValue;
      if (autoReconnect && autoRequeue) {
        autoRequeue = false;
        safeStorageSet({ autoRequeue: false });
      }
    }
    if (changes.autoRequeue) {
      autoRequeue = !!changes.autoRequeue.newValue;
      if (autoRequeue && autoReconnect) {
        autoReconnect = false;
        safeStorageSet({ autoReconnect: false });
      }
    }
    if ((changes.autoReconnect || changes.autoRequeue) && !autoReconnect && !autoRequeue && recoveryTimerId) {
      clearTimeout(recoveryTimerId);
      recoveryTimerId = null;
    }
    if (changes.requeueDelay) requeueDelayMs = changes.requeueDelay.newValue ?? 3000;
    if (changes.chatRepeatMessage) chatRepeatMessage = changes.chatRepeatMessage.newValue || '';
    if (changes.chatRepeatCount) chatRepeatCount = changes.chatRepeatCount.newValue || 1;
    if (changes.chatRepeatEnabled) {
      chatRepeatEnabled = !!changes.chatRepeatEnabled.newValue;
      updateChatRepeaterState();
    }
    if (changes.customTheme) {
      customTheme = changes.customTheme.newValue;
      updateTheme();
    }
    if (changes.cleanLobby) {
      cleanLobby = changes.cleanLobby.newValue;
      updateTheme();
    }
    if (changes.themeBackground) {
      themeBackground = changes.themeBackground.newValue;
      updateTheme();
    }
    if (changes.themePanel) {
      themePanel = changes.themePanel.newValue;
      updateTheme();
    }
    if (changes.themeChat) {
      themeChat = changes.themeChat.newValue;
      updateTheme();
    }
    if (changes.themePlayers) {
      themePlayers = changes.themePlayers.newValue;
      updateTheme();
    }
    if (changes.themeText) {
      themeText = changes.themeText.newValue;
      updateTheme();
    }
    if (changes.themeAccent) {
      themeAccent = changes.themeAccent.newValue;
      updateTheme();
    }
    if (changes.themeBrightness) {
      themeBrightness = Number(changes.themeBrightness.newValue ?? 100);
      updateTheme();
    }
    if (changes.lobbyBackgroundUrl) {
      lobbyBackgroundUrl = changes.lobbyBackgroundUrl.newValue || '';
      updateTheme();
    }
    if (changes.gameBackgroundUrl) {
      gameBackgroundUrl = changes.gameBackgroundUrl.newValue || '';
      updateTheme();
    }
    if (changes.delaySpeed) userDelayMs = changes.delaySpeed.newValue;
    if (changes.minLetters) minLetters = changes.minLetters.newValue;
    if (changes.maxWords)   maxWords = changes.maxWords.newValue;
    if (changes.adaptiveSpeed) adaptiveSpeed = changes.adaptiveSpeed.newValue;
    if (changes.spamPause)  spamPauseMs = changes.spamPause.newValue;
    if (changes.rampStart)  rampStartMs = changes.rampStart.newValue;
    if (changes.rampStepPct) rampStepPct = changes.rampStepPct.newValue;
    if (changes.autoHotkey) {
      hotkey = changes.autoHotkey.newValue || 'Control';
      updateStatusOverlay();
    }
  });

  // ── Hotkeys ──────────────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (matchesHotkey(e)) {
      e.preventDefault();
      if (e.repeat) return;
      const now = Date.now();
      if (now - lastHotkeyToggleAt < 120) return;
      lastHotkeyToggleAt = now;
      setAutoGuessState(!autoGuess, true);
    }
  }, true);

  // ── Cancelable tick scheduler ────────────────────────────────────────────
  let tickTimeoutId = null;

  function scheduleTick(overrideMs) {
    if (tickTimeoutId) clearTimeout(tickTimeoutId);
    const delay = overrideMs !== undefined
      ? overrideMs
      : (T().next + Math.random() * T().nextR);
    tickTimeoutId = setTimeout(tick, delay);
  }

  function cancelPendingTick() {
    if (tickTimeoutId) { clearTimeout(tickTimeoutId); tickTimeoutId = null; }
  }

  function scheduleListRefresh() {
    if (!showWordList) return;
    const runId = ++listRefreshRunId;
    setTimeout(() => {
      if (runId === listRefreshRunId) refreshWordListOnly();
    }, 60);
  }

  // ── Spam handler ─────────────────────────────────────────────────────────
  let spamPausedUntil = 0;

  function handleSpamDetected() {
    if (Date.now() - lastSpamTime < 1000) return; // debounce
    lastSpamTime = Date.now();
    cancelPendingTick();
    
    spamPausedUntil = Date.now() + spamPauseMs;
    updateStatusOverlay();
    
    rampDelay = Math.max(userDelayMs, rampStartMs);
    console.warn(`[SkribblCheat] spam! Waiting ${spamPauseMs/1000} s then resuming at ramp delay ${rampDelay} ms (shrinks ${rampStepPct}% each guess)`);

    if (autoGuess) {
      tickTimeoutId = setTimeout(tick, spamPauseMs);
    }
  }

  function isDrawingTurn() {
    const chatInput = document.querySelector('#game-chat > form > input[type="text"]');
    return !chatInput || chatInput.disabled || chatInput.style.display === 'none';
  }

  // ── Status overlay ───────────────────────────────────────────────────────
  let statusEl = null;
  let cooldownEl = null;
  let cooldownIntervalId = null;
  const dragState = new WeakMap();

  function makeDraggable(el, storageKey) {
    if (!el || dragState.has(el)) return;
    dragState.set(el, true);
    el.style.cursor = 'move';
    el.style.userSelect = 'none';
    chrome.storage.local.get([storageKey], (data) => {
      const pos = data[storageKey];
      if (!pos) return;
      el.style.left = pos.left + 'px';
      el.style.top = pos.top + 'px';
      el.style.right = 'auto';
    });
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest && e.target.closest('.skribbl-list-body')) return;
      const rect = el.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      e.preventDefault();

      function move(ev) {
        const left = Math.max(0, Math.min(window.innerWidth - rect.width, ev.clientX - offsetX));
        const top = Math.max(0, Math.min(window.innerHeight - rect.height, ev.clientY - offsetY));
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.right = 'auto';
      }

      function up() {
        document.removeEventListener('mousemove', move, true);
        document.removeEventListener('mouseup', up, true);
        safeStorageSet({
          [storageKey]: {
            left: Math.round(el.getBoundingClientRect().left),
            top: Math.round(el.getBoundingClientRect().top)
          }
        });
      }

      document.addEventListener('mousemove', move, true);
      document.addEventListener('mouseup', up, true);
    }, true);
  }

  function initOverlays() {
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.style.position = 'fixed';
      statusEl.style.left = '20px';
      statusEl.style.top = '50px';
      statusEl.style.padding = '8px 12px';
      statusEl.style.borderRadius = '6px';
      statusEl.style.zIndex = '9999';
      statusEl.style.fontFamily = 'monospace';
      statusEl.style.fontWeight = 'bold';
      statusEl.style.pointerEvents = 'auto';
      statusEl.style.display = 'none';
      document.body.appendChild(statusEl);
      makeDraggable(statusEl, 'statusOverlayPos');
    }
    
    if (!cooldownEl) {
      cooldownEl = document.createElement('div');
      cooldownEl.style.position = 'fixed';
      cooldownEl.style.left = '20px';
      cooldownEl.style.top = '95px';
      cooldownEl.style.padding = '8px 12px';
      cooldownEl.style.borderRadius = '6px';
      cooldownEl.style.zIndex = '9999';
      cooldownEl.style.fontFamily = 'monospace';
      cooldownEl.style.fontWeight = 'bold';
      cooldownEl.style.pointerEvents = 'auto';
      cooldownEl.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
      cooldownEl.style.display = 'none';
      document.body.appendChild(cooldownEl);
      makeDraggable(cooldownEl, 'cooldownOverlayPos');
    }
  }

  function updateStatusOverlay() {
    if (!statusEl) initOverlays();
    if (!showStatus) {
      statusEl.style.display = 'none';
    } else {
      statusEl.style.display = 'block';
      if (chatRepeaterActive) {
        statusEl.textContent = 'Repeater: RUNNING';
        statusEl.style.backgroundColor = 'rgba(39, 50, 82, 0.9)';
        statusEl.style.color = '#fff';
      } else if (autoGuess) {
        statusEl.textContent = `Auto-Guess: ON [${hotkey}]`;
        statusEl.style.backgroundColor = 'rgba(0, 128, 0, 0.85)';
        statusEl.style.color = '#fff';
      } else {
        statusEl.textContent = `Auto-Guess: OFF [${hotkey}]`;
        statusEl.style.backgroundColor = 'rgba(180, 0, 0, 0.85)';
        statusEl.style.color = '#fff';
      }
    }
    updateCooldownOverlay();
  }

  function updateCooldownOverlay() {
    if (!cooldownEl) initOverlays();
    if (!showCooldown) {
      cooldownEl.style.display = 'none';
      if (cooldownIntervalId) { clearInterval(cooldownIntervalId); cooldownIntervalId = null; }
      return;
    }
    cooldownEl.style.display = 'block';

    const now = Date.now();
    let needsTick = false;
    let html = '';

    if (autoGuess && now < spamPausedUntil) {
      const left = ((spamPausedUntil - now) / 1000).toFixed(1);
      html = `<span style="color: #ffcc00;">Spam Pause: ${left}s</span>`;
      needsTick = true;
    } else if (rampDelay !== null) {
      html = `<span style="color: #ffff00;">Delay: ${Math.round(rampDelay)}ms (Ramp)</span>`;
    } else {
      html = `<span style="color: #ccc;">Delay: ${userDelayMs}ms</span>`;
    }
    
    cooldownEl.innerHTML = html;

    if (needsTick && !cooldownIntervalId) {
      cooldownIntervalId = setInterval(updateCooldownOverlay, 100);
    } else if (!needsTick && cooldownIntervalId) {
      clearInterval(cooldownIntervalId);
      cooldownIntervalId = null;
    }
  }

  // ── Word list overlay ────────────────────────────────────────────────────
  let overlayEl = null;
  let lastCands = [];
  let wordListScrollTop = 0;

  function initOverlay() {
    if (overlayEl) return;
    if (!document.getElementById('skribbl-cheat-overlay-style')) {
      const style = document.createElement('style');
      style.id = 'skribbl-cheat-overlay-style';
      style.textContent = `
        .skribbl-list-body{scrollbar-width:thin;scrollbar-color:#8fa7ff rgba(255,255,255,.08)}
        .skribbl-list-body::-webkit-scrollbar{width:8px}
        .skribbl-list-body::-webkit-scrollbar-track{background:rgba(255,255,255,.08);border-radius:999px}
        .skribbl-list-body::-webkit-scrollbar-thumb{background:#8fa7ff;border-radius:999px}
        .skribbl-word-button{width:100%;display:block;margin:0 0 6px;padding:7px 9px;border:1px solid rgba(143,167,255,.28);border-radius:7px;background:rgba(255,255,255,.08);color:#f0fff4;text-align:left;font:inherit;line-height:1.25;cursor:pointer}
        .skribbl-word-button:hover{background:rgba(143,167,255,.2);border-color:#8fa7ff}
        .skribbl-word-button:active{transform:translateY(1px)}
      `;
      document.documentElement.appendChild(style);
    }
    overlayEl = document.createElement('div');
    overlayEl.style.position = 'fixed';
    overlayEl.style.right = '20px';
    overlayEl.style.top = '50px';
    overlayEl.style.width = '250px';
    overlayEl.style.maxHeight = '80vh';
    overlayEl.style.overflow = 'hidden';
    overlayEl.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    overlayEl.style.color = '#f0fff4';
    overlayEl.style.padding = '0';
    overlayEl.style.borderRadius = '8px';
    overlayEl.style.zIndex = '9999';
    overlayEl.style.fontFamily = 'Arial, sans-serif';
    overlayEl.style.fontSize = '15px';
    overlayEl.style.lineHeight = '1.45';
    overlayEl.style.pointerEvents = 'auto';
    overlayEl.style.display = 'none';
    document.body.appendChild(overlayEl);
    makeDraggable(overlayEl, 'wordListOverlayPos');
  }

  function updateWordListOverlay(cands) {
    if (!overlayEl) initOverlay();
    if (!showWordList || !cands || isDrawingTurn()) {
      overlayEl.style.display = 'none';
      return;
    }
    overlayEl.style.display = 'block';
    const oldBody = overlayEl.querySelector('.skribbl-list-body');
    if (oldBody) wordListScrollTop = oldBody.scrollTop;
    
    const visible = cands.slice();
    if (sortPopularity) {
      visible.sort((a, b) => (wordStats.get(b.toLowerCase()) || 0) - (wordStats.get(a.toLowerCase()) || 0));
    }
    const untried = visible.filter(w => !guessed.has(w));
    overlayEl.innerHTML = `<div style="padding: 8px 10px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,.18); cursor: move;">Possible: ${untried.length}</div><div class="skribbl-list-body" style="max-height: calc(80vh - 38px); overflow-y: auto; padding: 8px 10px; cursor: default;"></div>`;
    const newBody = overlayEl.querySelector('.skribbl-list-body');
    if (newBody) {
      const shown = untried.slice(0, 200);
      if (shown.length > 0) {
        for (const word of shown) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'skribbl-word-button';
          button.textContent = word;
          button.addEventListener('click', () => {
            guessed.add(word);
            updateWordListOverlay(lastCands);
            typeWord(word).then((sent) => {
              if (!sent) guessed.delete(word);
              updateWordListOverlay(lastCands);
            });
          });
          newBody.appendChild(button);
        }
        if (untried.length > shown.length) {
          const capped = document.createElement('div');
          capped.style.opacity = '.75';
          capped.style.fontStyle = 'italic';
          capped.textContent = `Showing first ${shown.length}...`;
          newBody.appendChild(capped);
        }
      } else {
        newBody.textContent = 'No candidates.';
      }
      newBody.scrollTop = Math.min(wordListScrollTop, Math.max(0, newBody.scrollHeight - newBody.clientHeight));
      newBody.addEventListener('scroll', () => {
        wordListScrollTop = newBody.scrollTop;
      }, { passive: true });
    }
  }

  // ── Word display ─────────────────────────────────────────────────────────
  function getWordDisplay() {
    const gw = document.getElementById('game-word');
    if (!gw) return null;

    const hints = Array.from(gw.querySelectorAll('.hints .container .hint'));
    if (hints.length > 0) {
      const chars = hints.map(el => {
        const t = el.textContent.trim().toLowerCase();
        if (!t || t === '?' || t === '_') return '_';
        const m = t.match(/[a-z]/i);
        return m ? m[0].toLowerCase() : '_';
      });
      const lengthText = gw.querySelector('.hints .container .word-length')?.textContent || '';
      const lengths = (lengthText.match(/\d+/g) || []).map(Number).filter(Boolean);

      if (lengths.length > 0 && lengths.reduce((sum, n) => sum + n, 0) === chars.length) {
        const parts = [];
        let offset = 0;
        for (const len of lengths) {
          parts.push(chars.slice(offset, offset + len).join(''));
          offset += len;
        }
        return parts.join(' ');
      }

      return chars.join('');
    }

    for (const child of gw.children) {
      const t = child.textContent.trim();
      const m = t.match(/[a-zA-Z_ \-]{2,}/);
      if (!m) continue;
      const cleaned = m[0].toLowerCase().trim();
      if ((cleaned.match(/_/g) || []).length >= 1) return cleaned;
    }
    return null;
  }

  function typeWord(word) {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        resolve(typeWordDirect(word));
        return;
      }
      try {
        chrome.runtime.sendMessage({ action: 'typeWord', word }, (res) => {
          if (chrome.runtime.lastError) {
            console.log('[SkribblCheat] sendMessage error:', chrome.runtime.lastError.message);
            resolve(typeWordDirect(word));
            return;
          }
          resolve(!!(res && res.ok) || typeWordDirect(word));
        });
      } catch(e) {
        console.log('[SkribblCheat] sendMessage error:', e);
        resolve(typeWordDirect(word));
      }
    });
  }

  function typeWordDirect(word) {
    const el = document.querySelector('#game-chat > form > input[type="text"], #game-chat .chat-form input[type="text"]');
    if (!el || el.disabled || el.style.display === 'none') return false;

    try {
      el.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (setter) setter.call(el, word);
      else el.value = word;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
      if (el.form) {
        el.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        if (typeof el.form.requestSubmit === 'function' && el.value) el.form.requestSubmit();
      }
      return true;
    } catch (e) {
      console.log('[SkribblCheat] direct send failed:', e);
      return false;
    }
  }

  // ── Skribbliohints word list ─────────────────────────────────────────────
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function updateChatRepeaterState() {
    if (!chatRepeatEnabled) {
      chatRepeaterRunId += 1;
      chatRepeaterActive = false;
      if (autoGuess) scheduleTick();
      return;
    }
    if (!chatRepeaterActive) runChatRepeater();
  }

  async function waitForChatRepeaterSlot(runId) {
    while (chatRepeatEnabled && runId === chatRepeaterRunId) {
      const pauseLeft = spamPausedUntil - Date.now();
      if (pauseLeft > 0) {
        await wait(Math.min(pauseLeft, 1000));
        continue;
      }
      if (!isDrawingTurn()) return true;
      await wait(500);
    }
    return false;
  }

  async function runChatRepeater() {
    const message = String(chatRepeatMessage || '').trim().slice(0, 100);
    const total = Math.max(1, Math.min(20, Number(chatRepeatCount) || 1));
    if (!message) {
      safeStorageSet({ chatRepeatEnabled: false });
      return;
    }

    const runId = ++chatRepeaterRunId;
    chatRepeaterActive = true;
    cancelPendingTick();
    updateStatusOverlay();

    try {
      for (let i = 0; i < total; i++) {
        if (!(await waitForChatRepeaterSlot(runId))) return;

        let sent = false;
        while (chatRepeatEnabled && runId === chatRepeaterRunId && !sent) {
          sent = await typeWord(message);
          if (!sent) await wait(1000);
        }
        if (!chatRepeatEnabled || runId !== chatRepeaterRunId) return;

        onGuessedWord();
        if (i < total - 1) await wait(Math.max(50, effectiveDelay()));
      }
    } finally {
      if (runId === chatRepeaterRunId) {
        chatRepeaterActive = false;
        safeStorageSet({ chatRepeatEnabled: false });
        if (autoGuess) scheduleTick();
        updateStatusOverlay();
      }
    }
  }

  // Primary source: https://skribbliohints.github.io/words.json
  // Fallback: local WORDS_BY_LEN (from wordlist.js)
  let skribbliByLen       = null;  // null=loading, false=failed, Map=ready
  let skribbliLoadPromise = null;
  let wordStats           = new Map();

  function fetchWithTimeout(url, ms = 8000) {
    const ctrl = new AbortController();
    const id   = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id));
  }

  function loadSkribbliWords() {
    if (skribbliLoadPromise) return skribbliLoadPromise;
    console.log('[SkribblCheat] fetching skribbliohints word list…');
    skribbliLoadPromise = fetchWithTimeout('https://skribbliohints.github.io/English.json', 8000)
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(data => {
        const wordArr = Array.isArray(data) ? data : Object.keys(data);
        const byLen   = new Map();
        for (const w of wordArr) {
          const lw = w.toLowerCase();
          if (!byLen.has(lw.length)) byLen.set(lw.length, []);
          byLen.get(lw.length).push(lw);
          
          if (!Array.isArray(data) && data[w]) {
            const p = data[w].picked || 0;
            const s = data[w].successRate || 0;
            wordStats.set(lw, p * s);
          }
        }
        skribbliByLen = byLen;
        console.log('[SkribblCheat] skribbliohints loaded:', wordArr.length, 'words,', byLen.size, 'lengths');
      })
      .catch(err => {
        console.warn('[SkribblCheat] skribbliohints unavailable, using local list only. Reason:', err.message);
        skribbliByLen = false;
      });
    return skribbliLoadPromise;
  }

  function matchesPattern(word, pat) {
    if (word.length !== pat.length) return false;
    if (!/[\s-]/.test(pat) && /[\s-]/.test(word)) return false;
    for (let i = 0; i < pat.length; i++) {
      if (pat[i] !== '_' && pat[i] !== word[i]) return false;
    }
    return true;
  }

  function getRawCandidatesByLength(len) {
    if (skribbliByLen && skribbliByLen.has(len)) return skribbliByLen.get(len);
    return WORDS_BY_LEN[len] || [];
  }

  function isKnownCandidateForPattern(word, pat) {
    if (!word || !pat || word.length !== pat.length) return false;
    return getRawCandidatesByLength(pat.length).includes(word) && matchesPattern(word, pat);
  }

  async function fetchCandidates(pat) {
    await loadSkribbliWords();
    const len = pat.length;

    // 1. Skribbliohints (primary, most complete - contains actual multi-word phrases)
    let hits = getRawCandidatesByLength(len).filter(w => matchesPattern(w, pat));

    if (useCloseSniper && closeWords.size > 0) {
      for (const cw of closeWords) {
        hits = hits.filter(w => closeEnough(w, cw));
      }
    }

    return hits;
  }

  async function refreshWordListOnly() {
    if (!showWordList || isDrawingTurn()) {
      updateWordListOverlay([]);
      return;
    }

    const pat = getWordDisplay();
    if (!pat || !pat.includes('_')) {
      updateWordListOverlay([]);
      return;
    }

    if (pat !== wordPattern) wordPattern = pat;

    const cands = await fetchCandidates(pat);
    lastCands = cands;
    updateWordListOverlay(cands);
  }

  // ── Round management ─────────────────────────────────────────────────────
  let closeWords = new Set();

  function resetRound() {
    cancelPendingTick();
    guessed.clear();
    closeWords.clear();
    lastCands = [];
    wordListScrollTop = 0;
    wordPattern = '';
    busy = false;
    updateWordListOverlay([]);
  }

  // ── Main tick ────────────────────────────────────────────────────────────
  async function tick() {
    if (!autoGuess || chatRepeatEnabled || chatRepeaterActive || busy || isDrawingTurn()) {
      if (showWordList && !chatRepeatEnabled && !chatRepeaterActive) scheduleListRefresh();
      else updateWordListOverlay([]);
      return;
    }

    const pat = getWordDisplay();
    if (!pat) { scheduleTick(); return; }

    // Word fully revealed — round is over, do not guess
    if (!pat.includes('_')) {
      if (wordPattern !== '') {
        console.log('[SkribblCheat] word revealed:', pat, '— round over.');
        resetRound();
      }
      return;
    }

    // New letter revealed — keep guessed set (wrong answers stay wrong)
    if (pat !== wordPattern) {
      console.log('[SkribblCheat] pattern:', pat);
      wordPattern = pat;
    }

    const cands = await fetchCandidates(pat);
    lastCands = cands;
    updateWordListOverlay(cands);

    // Re-check after async — another tick may have fired during the await
    if (!autoGuess || chatRepeatEnabled || chatRepeaterActive || busy || isDrawingTurn()) return;

    let untried = cands.filter(w => !guessed.has(w));

    // Min Letters and Max Words only gate auto-guessing; the possible list still updates.
    if (minLetters > 0) {
      const revealed = pat.replace(/[_\-\s]/g, '').length;
      if (revealed < minLetters && untried.length > 50) {
        scheduleTick();
        return;
      }
    }

    if (maxWords > 0 && untried.length > maxWords) {
      scheduleTick();
      return;
    }

    if (!untried.length) { scheduleTick(); return; }

    let pick;
    if (sortPopularity) {
      untried.sort((a, b) => (wordStats.get(b.toLowerCase()) || 0) - (wordStats.get(a.toLowerCase()) || 0));
      pick = untried[0];
    } else {
      pick = untried[Math.floor(Math.random() * untried.length)];
    }
    
    guessed.add(pick);
    busy = true;

    const t = T();
    setTimeout(() => {
      if (!autoGuess) { busy = false; return; }
      console.log('[SkribblCheat] →', pick, '(pattern:', wordPattern + ')');
      typeWord(pick).then((sent) => {
        if (!sent) {
          guessed.delete(pick);
          console.warn('[SkribblCheat] send failed, will retry later:', pick);
        }
        busy = false;
        if (sent) onGuessedWord(); // ramp speed back up toward normal after spam
        scheduleTick();
      });
    }, t.pre + Math.random() * t.preR);
  }

  // ── Mutation observer ────────────────────────────────────────────────────
  function checkSpamInNode(n) {
    if (n.nodeType !== 1) return false;
    return n.textContent.toLowerCase().includes('spam detected');
  }

  function normalizeGuessText(txt) {
    return txt.replace(/'/g, '').trim().toLowerCase();
  }

  function parseGuessFromNode(n) {
    if (n.nodeType !== 1) return null;
    const txt = n.textContent;
    // Do not abort on "is close!", we will process it separately now.
    if (txt.includes(' guessed the word!')) return null;
    if (!txt.includes(': ')) return null; // Not a player chat message
    return normalizeGuessText(txt.split(': ').pop());
  }

  function parseCloseGuess(txt) {
    const match = txt.match(/(.+?)\s+is close!/i);
    if (!match) return null;
    return normalizeGuessText(match[1].split(': ').pop());
  }

  function updateTheme() {
    let style = document.getElementById('skribbl-cheat-theme-style');
    if (!customTheme && !cleanLobby && !lobbyBackgroundUrl && !gameBackgroundUrl && themeBrightness === 100) {
      if (style) style.remove();
      applyCleanLobby();
      return;
    }

    if (!style) {
      style = document.createElement('style');
      style.id = 'skribbl-cheat-theme-style';
      document.documentElement.appendChild(style);
    }

    const cssUrl = (url) => `url("${String(url).replace(/["\\]/g, '\\$&')}")`;
    const lobbyBg = lobbyBackgroundUrl ? cssUrl(lobbyBackgroundUrl) : 'none';
    const gameBg = gameBackgroundUrl ? cssUrl(gameBackgroundUrl) : lobbyBg;
    const bodyBg = customTheme ? themeBackground : 'inherit';
    const panelCss = customTheme ? `
      :root {
        --COLOR_PANEL_BG: ${themePanel} !important;
        --COLOR_PANEL_LO: ${themePanel} !important;
        --COLOR_PANEL_HI: ${themeAccent} !important;
        --COLOR_PANEL_BORDER_FOCUS: ${themeAccent} !important;
        --COLOR_PANEL_BUTTON: ${themeAccent} !important;
        --COLOR_INPUT_BORDER_FOCUS: ${themeAccent} !important;
        --COLOR_TOOL_TIP_BG: ${themeAccent} !important;
        --COLOR_PANEL_TEXT: ${themeText} !important;
        --COLOR_CHAT_TEXT_BASE: ${themeText} !important;
        --COLOR_PLAYER_TEXT_BASE: ${themeText} !important;
        --COLOR_CHAT_BG_BASE: ${themeChat} !important;
        --COLOR_CHAT_BG_ALT: ${themeChat} !important;
        --COLOR_PLAYER_BG_BASE: ${themePlayers} !important;
        --COLOR_PLAYER_BG_ALT: ${themePlayers} !important;
      }
      #game-chat .chat-content,
      #game-chat .chat-form,
      #game-chat-input-mobile .chat-form {
        background: ${themeChat} !important;
        color: ${themeText} !important;
      }
      #game-players .player-background,
      #game-players,
      #game-players-footer {
        background: ${themePlayers} !important;
      }
      #game-bar,
      #game-toolbar,
      #game-canvas .overlay-content .room,
      #modal .modal-container {
        background-color: ${themePanel} !important;
        color: ${themeText} !important;
      }` : '';
    const cleanLobbyCss = cleanLobby ? `
      #home .bottom,
      #home .panel-left,
      #home .panel-right,
      #home .section-container,
      #home .section,
      #home .footer,
      #home .tos,
      #home .notice,
      #home .ad-top,
      #home .ad-side,
      #home [class*="ad-"],
      #home a[href*="terms"],
      #home a[href*="credits"],
      #cmpPersistentLink,
      .fc-consent-root {
        display: none !important;
      }
      #home {
        min-height: 100vh !important;
        justify-content: center !important;
      }
      #home .logo-big {
        margin-top: 0 !important;
        margin-bottom: 24px !important;
      }
      #home .panels {
        justify-content: center !important;
      }` : '';

    style.textContent = `
      body {
        background-image: ${lobbyBackgroundUrl || gameBackgroundUrl || customTheme ? lobbyBg : 'inherit'} !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        background-color: ${bodyBg} !important;
        color: ${customTheme ? themeText : 'inherit'} !important;
      }
      #home {
        background-image: ${lobbyBackgroundUrl ? lobbyBg : 'inherit'} !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        filter: brightness(${themeBrightness}%) !important;
      }
      #home::before {
        content: "" !important;
        position: fixed !important;
        inset: 0 !important;
        background-image: ${lobbyBackgroundUrl ? lobbyBg : 'none'} !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        pointer-events: none !important;
        z-index: -1 !important;
      }
      #home {
        isolation: isolate !important;
      }
      #game {
        background-image: ${gameBackgroundUrl ? gameBg : 'inherit'} !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        filter: brightness(${themeBrightness}%) !important;
      }
      #game::before {
        content: "" !important;
        position: fixed !important;
        inset: 0 !important;
        background-image: ${gameBackgroundUrl ? gameBg : 'none'} !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        pointer-events: none !important;
        z-index: -1 !important;
      }
      #game {
        isolation: isolate !important;
      }
      ${panelCss}
      ${cleanLobbyCss}
      #game-logo img,
      #home .logo-big img {
        filter: ${customTheme ? 'none' : 'inherit'} !important;
      }
    `;
    applyCleanLobby();
  }

  function setCleanLobbyHidden(el, hidden) {
    if (!el || el.nodeType !== 1) return;
    if (hidden) {
      if (el.dataset.skribblCheatCleanLobbyDisplay === undefined) {
        el.dataset.skribblCheatCleanLobbyDisplay = el.style.display || '__empty__';
      }
      el.style.display = 'none';
    } else if (el.dataset.skribblCheatCleanLobbyDisplay !== undefined) {
      const oldDisplay = el.dataset.skribblCheatCleanLobbyDisplay;
      el.style.display = oldDisplay === '__empty__' ? '' : oldDisplay;
      delete el.dataset.skribblCheatCleanLobbyDisplay;
    }
  }

  function applyCleanLobby() {
    const home = document.getElementById('home');
    if (!cleanLobby) {
      document.querySelectorAll('[data-skribbl-cheat-clean-lobby-display]').forEach(el => {
        setCleanLobbyHidden(el, false);
      });
      if (home && home.dataset.skribblCheatCleanLobby === '1') {
        home.style.minHeight = '';
        home.style.justifyContent = '';
        delete home.dataset.skribblCheatCleanLobby;
      }
      const logo = document.querySelector('#home .logo-big');
      if (logo && logo.dataset.skribblCheatCleanLobby === '1') {
        logo.style.marginTop = '';
        logo.style.marginBottom = '';
        delete logo.dataset.skribblCheatCleanLobby;
      }
      const panels = document.querySelector('#home .panels');
      if (panels && panels.dataset.skribblCheatCleanLobby === '1') {
        panels.style.justifyContent = '';
        panels.style.alignItems = '';
        delete panels.dataset.skribblCheatCleanLobby;
      }
      return;
    }

    [
      '#home .bottom',
      '#home .panel-left',
      '#home .panel-right',
      '#home .section-container',
      '#home .section',
      '#home .footer',
      '#home .tos',
      '#home .notice',
      '#home .ad-top',
      '#home .ad-side',
      '#home [class*="ad-"]',
      '#cmpPersistentLink',
      '.fc-consent-root'
    ].forEach(selector => {
      document.querySelectorAll(selector).forEach(el => setCleanLobbyHidden(el, true));
    });

    document.querySelectorAll('#home h2, #home h3').forEach(heading => {
      const title = heading.textContent.trim().toLowerCase();
      if (['about', 'news', 'how to play'].includes(title)) {
        setCleanLobbyHidden(heading.closest('.section') || heading.closest('.panel') || heading.parentElement, true);
      }
    });

    document.querySelectorAll('a, button').forEach(el => {
      const text = el.textContent.trim().toLowerCase();
      if (['privacy settings', 'terms of service', 'credits', 'contact'].includes(text)) {
        setCleanLobbyHidden(el, true);
      }
    });

    document.querySelectorAll('#home *').forEach(el => {
      const text = el.textContent.trim().toLowerCase();
      if (
        text.includes('skribbl.io is a free online multiplayer') ||
        text.includes('fresh paint') ||
        text.includes('the owner of this site is not responsible') ||
        text.includes('try to draw your choosen word')
      ) {
        setCleanLobbyHidden(el.closest('.section') || el.closest('.footer') || el, true);
      }
    });

    if (home) {
      home.dataset.skribblCheatCleanLobby = '1';
      home.style.minHeight = '100vh';
      home.style.justifyContent = 'center';
    }
    const logo = document.querySelector('#home .logo-big');
    if (logo) {
      logo.dataset.skribblCheatCleanLobby = '1';
      logo.style.marginTop = '0';
      logo.style.marginBottom = '24px';
    }
    const panels = document.querySelector('#home .panels');
    if (panels) {
      panels.dataset.skribblCheatCleanLobby = '1';
      panels.style.justifyContent = 'center';
      panels.style.alignItems = 'center';
    }
  }

  function isUserChatNode(node) {
    if (!node || node.nodeType !== 1) return false;
    const bold = node.querySelector('b');
    const span = node.querySelector('span');
    if (!bold || !span) return false;
    return bold.textContent.trim().endsWith(':') && span.textContent.trim().length > 0;
  }

  function getOwnPlayerNames() {
    const names = new Set();
    document.querySelectorAll('#game-players .player-name.me').forEach(el => {
      const name = el.textContent.trim();
      if (name) names.add(name);
    });
    document.querySelectorAll('#game-players .player.me .player-name').forEach(el => {
      const name = el.textContent.trim();
      if (name) names.add(name);
    });
    document.querySelectorAll('#home .input-name').forEach(el => {
      const name = el.value.trim();
      if (name) names.add(name);
    });
    return names;
  }

  function isOwnChatNode(node) {
    const bold = node && node.querySelector ? node.querySelector('b') : null;
    if (!bold) return false;
    const name = bold.textContent.replace(/:\s*$/, '').trim();
    return getOwnPlayerNames().has(name);
  }

  function isGameNoticeNode(node) {
    const txt = (node && node.textContent || '').toLowerCase();
    if (hideNoticeGuessed && (txt.includes(' guessed the word!') || txt.includes('everyone guessed the word!'))) return true;
    if (hideNoticeWordReveal && txt.includes('the word was')) return true;
    if (hideNoticeJoinLeave && (txt.includes(' joined the room!') || txt.includes(' left the room!'))) return true;
    if (hideNoticeDrawing && txt.includes(' is drawing now!')) return true;
    if (hideNoticeKickBan && (txt.includes(' has been kicked!') || txt.includes(' has been banned!'))) return true;
    if (hideNoticeReactions && (txt.includes(' liked the drawing!') || txt.includes(' disliked the drawing!'))) return true;
    if (hideNoticeVotekick && txt.includes(' is voting to kick ')) return true;
    return false;
  }

  function shouldHideChatNode(node) {
    if (!node || node.nodeType !== 1) return false;
    const txt = node.textContent || '';
    const low = txt.toLowerCase();
    if (hideSpamWarnings && low.includes('spam detected')) return true;
    if (hideCloseMessages && low.includes(' is close!')) return true;
    if (hideGameNotices && isGameNoticeNode(node)) return true;
    if (hideUserMessages && isUserChatNode(node) && !isOwnChatNode(node)) return true;
    return false;
  }

  function applyMessageFilterToNode(node) {
    if (!node || node.nodeType !== 1) return;
    if (shouldHideChatNode(node)) {
      node.dataset.skribblCheatHidden = '1';
      node.style.display = 'none';
    } else if (node.dataset.skribblCheatHidden === '1') {
      delete node.dataset.skribblCheatHidden;
      node.style.display = '';
    }
  }

  function applyMessageFilters(root = document) {
    const chat = root.querySelector ? root.querySelector('#game-chat .chat-content') : null;
    const nodes = chat ? chat.children : document.querySelectorAll('#game-chat .chat-content > *');
    for (const node of nodes) applyMessageFilterToNode(node);
  }

  function parseVotekickTarget(txt) {
    const match = txt.match(/^\s*(.+?)\s+is voting to kick\s+(.+?)\s+\(\d+\/\d+\)/i);
    return match ? match[2].trim() : '';
  }

  function normalizePlayerName(name) {
    return String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function clickLikeUser(el) {
    if (!el) return;
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    });
    el.click();
  }

  function findPlayerByName(name) {
    const wanted = normalizePlayerName(name);
    return Array.from(document.querySelectorAll('#game-players .player, #game-players [class*="player"]')).find(player => {
      const nameEl = player.querySelector('.player-name, [class*="player-name"]');
      return nameEl && normalizePlayerName(nameEl.textContent) === wanted;
    });
  }

  function tryClickVotekickButton(attempt = 0) {
    const buttons = Array.from(document.querySelectorAll('#modal .modal-container-player button, #modal button'));
    const button = buttons.find(btn => normalizePlayerName(btn.textContent) === 'votekick' || btn.classList.contains('votekick'));
    if (button && !button.disabled) {
      clickLikeUser(button);
      const close = document.querySelector('#modal .modal-title .close');
      if (close) setTimeout(() => clickLikeUser(close), 180);
      return true;
    }
    if (attempt < 4) setTimeout(() => tryClickVotekickButton(attempt + 1), 180 + attempt * 140);
    return false;
  }

  function tryAutoVotekick(txt) {
    if (!autoVotekick) return;
    const targetName = parseVotekickTarget(txt);
    if (!targetName) return;

    const now = Date.now();
    if (targetName === lastAutoVotekickTarget && now - lastAutoVotekickAt < 8000) return;

    const target = findPlayerByName(targetName);
    if (!target) return;

    lastAutoVotekickTarget = targetName;
    lastAutoVotekickAt = now;
    clickLikeUser(target);
    setTimeout(() => tryClickVotekickButton(), 180);
  }

  function getVisibleText(selector) {
    const el = document.querySelector(selector);
    if (!el) return '';
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return '';
    return el.textContent || '';
  }

  function captureRoomId() {
    const invite = document.querySelector('#input-invite')?.value || '';
    const fromInvite = invite.match(/\?([^/?#]+)/);
    const fromUrl = location.search.match(/^\?([^/?#]+)/);
    const id = (fromInvite && fromInvite[1]) || (fromUrl && fromUrl[1]) || '';
    if (id && id !== lastRoomId) {
      lastRoomId = id;
      safeStorageSet({ lastRoomId: id, lastRoomUrl: `${location.origin}/?${id}` });
    }
  }

  function getRecoveryErrorKind() {
    const text = getVisibleText('#modal').toLowerCase();
    if (!text) return '';
    if (text.includes('you have been banned') || text.includes('you are banned')) return 'blocked';
    if (text.includes('room is full') || text.includes('room not found')) return 'public';
    if (text.includes('kick cooldown') || text.includes('kicked too many times') || text.includes('joining rooms too quickly')) return 'public-wait';
    if (text.includes('you have been kicked')) return 'public';
    if (text.includes('connection lost') || text.includes('connect_error')) return 'same';
    return '';
  }

  function dismissRecoveryModal() {
    const buttons = Array.from(document.querySelectorAll('#modal button, #modal .close'));
    const button = buttons.find(btn => {
      const text = normalizePlayerName(btn.textContent);
      return text === 'okay!' || text === 'ok' || text === 'okay' || btn.classList.contains('close');
    });
    if (button) clickLikeUser(button);
  }

  function clearPrivateRoomQuery() {
    if (location.search) {
      history.replaceState(null, '', location.origin + location.pathname);
    }
  }

  function clickPlayButton() {
    const play = document.querySelector('#home .button-play, .button-play');
    if (play && !play.disabled) {
      clickLikeUser(play);
      return true;
    }
    return false;
  }

  function scheduleRecovery(mode, reason) {
    if (recoveryTimerId || (!autoReconnect && !autoRequeue)) return;
    if (reason === 'blocked') return;
    if (mode === 'same' && !autoReconnect) mode = 'public';
    if (mode === 'public' && !autoRequeue) return;

    if (lastRecoveryReason !== reason) {
      recoveryAttempts = 0;
      lastRecoveryReason = reason;
    }
    recoveryAttempts += 1;
    if (recoveryAttempts > 12) return;

    const extra = reason === 'public-wait' ? Math.min(30000, recoveryAttempts * 2500) : 0;
    const delay = Math.max(500, requeueDelayMs + extra);
    recoveryTimerId = setTimeout(() => {
      recoveryTimerId = null;
      dismissRecoveryModal();

      if (mode === 'same' && autoReconnect && lastRoomId) {
        const targetUrl = `${location.origin}/?${lastRoomId}`;
        if (location.href !== targetUrl) {
          location.href = targetUrl;
          return;
        }
        clickPlayButton();
        return;
      }

      if (autoRequeue) {
        clearPrivateRoomQuery();
        clickPlayButton();
      }
    }, delay);
  }

  function updateRecoveryState() {
    captureRoomId();
    const gameVisible = getComputedStyle(document.getElementById('game') || document.body).display !== 'none';
    const homeVisible = getComputedStyle(document.getElementById('home') || document.body).display !== 'none';
    if (gameVisible) {
      wasInGame = true;
      recoveryAttempts = 0;
      lastRecoveryReason = '';
      return;
    }

    const kind = getRecoveryErrorKind();
    if (kind) {
      const mode = kind === 'same' ? 'same' : 'public';
      scheduleRecovery(mode, kind);
      return;
    }

    if (wasInGame && homeVisible && autoRequeue) {
      scheduleRecovery('public', 'left');
    }
  }

  function onMutation(muts) {
    if (cleanLobby) applyCleanLobby();
    updateRecoveryState();

    // Detect new rounds (word display cleared or length changes dramatically)
    const pat = getWordDisplay();
    if (!pat) {
      // no word display (round over or waiting)
      if (wordPattern !== '') resetRound();
    } else {
      // word display exists
      if (!pat.includes('_')) {
        if (wordPattern !== '') resetRound();
      } else {
        // active round with underscores
        if (wordPattern === '') {
          // just started a new round from an empty state
          scheduleListRefresh();
          if (autoGuess) scheduleTick();
        } else if (Math.abs(pat.length - wordPattern.length) > 2) {
          // length changed drastically mid-round
          resetRound();
          scheduleListRefresh();
          if (autoGuess) scheduleTick();
        } else if (pat !== wordPattern) {
          scheduleListRefresh();
        }
      }
    }

    // Detect spam message or other players' guesses or close messages
    if (adaptiveSpeed || filterOtherGuesses || useCloseSniper || hideSpamWarnings || hideCloseMessages || hideUserMessages || hideGameNotices || autoVotekick) {
      for (const m of muts) {
        if (m.type === 'childList') {
          for (const n of m.addedNodes) {
            if (n.nodeType !== 1) continue;
            const txt = n.textContent;

            applyMessageFilterToNode(n);
            tryAutoVotekick(txt);

            if (adaptiveSpeed && checkSpamInNode(n)) { handleSpamDetected(); return; }
            
            const closeGuess = parseCloseGuess(txt);
            if (useCloseSniper && closeGuess) {
              const cw = closeGuess;
              if (cw && wordPattern !== '') {
                closeWords.add(cw);
                if (lastCands.length > 0) {
                  lastCands = lastCands.filter(cand => closeEnough(cand, cw));
                  updateWordListOverlay(lastCands);
                }
              }
              // It's a close message, definitely not an incorrect guess we should add to `guessed`
              continue; 
            }

            if (filterOtherGuesses && wordPattern !== '') {
              const guess = parseGuessFromNode(n);
              if (guess && (lastCands.includes(guess) || isKnownCandidateForPattern(guess, wordPattern))) {
                guessed.add(guess);
                if (lastCands.length > 0) updateWordListOverlay(lastCands);
              }
            }
          }
        } else if (m.type === 'characterData' && (adaptiveSpeed || hideSpamWarnings || hideCloseMessages || hideUserMessages || hideGameNotices || autoVotekick)) {
          const parent = m.target.parentElement;
          if (parent) {
            applyMessageFilterToNode(parent);
            tryAutoVotekick(parent.textContent || '');
          }
          if (parent && parent.textContent.toLowerCase().includes('spam detected')) {
            handleSpamDetected(); return;
          }
        }
      }
    }
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  function start() {
    console.log('[SkribblCheat] started');
    loadSkribbliWords(); // kick off fetch immediately so it's ready
    new MutationObserver(onMutation).observe(document.body, {
      childList: true, subtree: true, characterData: true
    });
    applyCleanLobby();
    updateRecoveryState();
    setInterval(updateRecoveryState, 1000);
    scheduleListRefresh();
    scheduleTick();
  }

  // Debug helper: Ctrl+Shift+9 logs elements that look like word hints
  document.addEventListener('keydown', (e) => {
    if (e.key === '9' && e.ctrlKey && e.shiftKey) {
      document.querySelectorAll('*').forEach(el => {
        const t = el.textContent.trim();
        if (t.length >= 2 && t.length <= 35 && t.includes('_') && /^[a-zA-Z_ \-]+$/.test(t))
          console.log('[SkribblCheat] HINT ELEMENT:', '<' + el.tagName + (el.id ? '#' + el.id : '') + '>', JSON.stringify(t));
      });
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
