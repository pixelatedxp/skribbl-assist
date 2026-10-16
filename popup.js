document.addEventListener('DOMContentLoaded', () => {
  const settingKeys = [
    'autoGuess',
    'showStatus',
    'showCooldown',
    'sortPopularity',
    'filterOtherGuesses',
    'useCloseSniper',
    'adaptiveSpeed',
    'showWordList',
    'hideSpamWarnings',
    'hideCloseMessages',
    'hideUserMessages',
    'hideGameNotices',
    'hideNoticeGuessed',
    'hideNoticeWordReveal',
    'hideNoticeJoinLeave',
    'hideNoticeDrawing',
    'hideNoticeReactions',
    'hideNoticeKickBan',
    'hideNoticeVotekick',
    'autoVotekick',
    'autoReconnect',
    'autoRequeue',
    'customTheme',
    'cleanLobby',
    'delaySpeed',
    'minLetters',
    'maxWords',
    'spamPause',
    'rampStart',
    'rampStepPct',
    'requeueDelay',
    'autoHotkey',
    'themeBackground',
    'themePanel',
    'themeChat',
    'themePlayers',
    'themeText',
    'themeAccent',
    'themeBrightness',
    'menuHue',
    'menuSat',
    'menuGlow',
    'lobbyBackgroundUrl',
    'gameBackgroundUrl',
    'chatRepeatEnabled',
    'chatRepeatMessage',
    'chatRepeatCount'
  ];

  const defaults = {
    autoGuess: false,
    showStatus: true,
    showCooldown: true,
    sortPopularity: true,
    filterOtherGuesses: true,
    useCloseSniper: true,
    adaptiveSpeed: true,
    showWordList: false,
    hideSpamWarnings: false,
    hideCloseMessages: false,
    hideUserMessages: false,
    hideGameNotices: false,
    hideNoticeGuessed: true,
    hideNoticeWordReveal: true,
    hideNoticeJoinLeave: true,
    hideNoticeDrawing: true,
    hideNoticeReactions: true,
    hideNoticeKickBan: true,
    hideNoticeVotekick: true,
    autoVotekick: false,
    autoReconnect: false,
    autoRequeue: false,
    customTheme: false,
    cleanLobby: false,
    delaySpeed: 1000,
    minLetters: 0,
    maxWords: 0,
    spamPause: 5000,
    rampStart: 3000,
    rampStepPct: 11,
    requeueDelay: 3000,
    autoHotkey: 'Control',
    themeBackground: '#15161c',
    themePanel: '#182044',
    themeChat: '#10131d',
    themePlayers: '#151a2c',
    themeText: '#f0f2f7',
    themeAccent: '#8fa7ff',
    themeBrightness: 100,
    menuHue: 225,
    menuSat: 80,
    menuGlow: 35,
    lobbyBackgroundUrl: '',
    gameBackgroundUrl: '',
    chatRepeatEnabled: false,
    chatRepeatMessage: '',
    chatRepeatCount: 1
  };

  const checkboxIds = [
    'autoGuess',
    'showStatus',
    'showCooldown',
    'sortPopularity',
    'filterOtherGuesses',
    'useCloseSniper',
    'adaptiveSpeed',
    'showWordList',
    'hideSpamWarnings',
    'hideCloseMessages',
    'hideUserMessages',
    'hideGameNotices',
    'hideNoticeGuessed',
    'hideNoticeWordReveal',
    'hideNoticeJoinLeave',
    'hideNoticeDrawing',
    'hideNoticeReactions',
    'hideNoticeKickBan',
    'hideNoticeVotekick',
    'autoVotekick',
    'autoReconnect',
    'autoRequeue',
    'chatRepeatEnabled',
    'customTheme',
    'cleanLobby'
  ];

  const colorIds = [
    'themeBackground',
    'themePanel',
    'themeChat',
    'themePlayers',
    'themeText',
    'themeAccent'
  ];

  const textIds = [
    'lobbyBackgroundUrl',
    'gameBackgroundUrl',
    'chatRepeatMessage'
  ];
  const visualTextIds = [
    'lobbyBackgroundUrl',
    'gameBackgroundUrl'
  ];

  const controls = {
    delaySpeed: {
      slider: document.getElementById('delaySlider'),
      label: document.getElementById('delayLabel'),
      format: (v) => v + 'ms'
    },
    minLetters: {
      slider: document.getElementById('minLettersSlider'),
      label: document.getElementById('minLettersLabel'),
      format: (v) => v === 0 ? 'Any' : String(v)
    },
    maxWords: {
      slider: document.getElementById('maxWordsSlider'),
      label: document.getElementById('maxWordsLabel'),
      format: (v) => v === 0 ? 'Any' : String(v)
    },
    spamPause: {
      slider: document.getElementById('spamPauseSlider'),
      label: document.getElementById('spamPauseLabel'),
      format: (v) => v + 'ms'
    },
    rampStart: {
      slider: document.getElementById('rampStartSlider'),
      label: document.getElementById('rampStartLabel'),
      format: (v) => v + 'ms'
    },
    rampStepPct: {
      slider: document.getElementById('rampStepSlider'),
      label: document.getElementById('rampStepLabel'),
      format: (v) => v + '%'
    },
    requeueDelay: {
      slider: document.getElementById('requeueDelaySlider'),
      label: document.getElementById('requeueDelayLabel'),
      format: (v) => v + 'ms'
    },
    themeBrightness: {
      slider: document.getElementById('brightnessSlider'),
      label: document.getElementById('brightnessLabel'),
      format: (v) => v + '%'
    },
    menuHue: {
      slider: document.getElementById('menuHueSlider'),
      label: document.getElementById('menuHueLabel'),
      format: (v) => String(v)
    },
    menuSat: {
      slider: document.getElementById('menuSatSlider'),
      label: document.getElementById('menuSatLabel'),
      format: (v) => v + '%'
    },
    menuGlow: {
      slider: document.getElementById('menuGlowSlider'),
      label: document.getElementById('menuGlowLabel'),
      format: (v) => v + '%'
    }
  };

  const hotkeyButton = document.getElementById('hotkeyButton');
  const configName = document.getElementById('configName');
  const configSelect = document.getElementById('configSelect');
  const configStatus = document.getElementById('configStatus');
  const backgroundColorInput = document.getElementById('themeBackground');
  const chatRepeatCount = document.getElementById('chatRepeatCount');
  const textSaveTimers = {};

  function clampToSlider(slider, value) {
    const min = Number(slider.min);
    const max = Number(slider.max);
    const step = Number(slider.step) || 1;
    const clamped = Math.max(min, Math.min(max, Number(value)));
    return Math.round(clamped / step) * step;
  }

  function setControl(name, value, save) {
    const control = controls[name];
    const v = clampToSlider(control.slider, value);
    control.slider.value = v;
    control.label.textContent = control.format(v);
    if (name.startsWith('menu')) applyMenuStyle();
    if (save) chrome.storage.local.set({ [name]: v });
  }

  function applyMenuStyle() {
    const hue = controls.menuHue ? Number(controls.menuHue.slider.value) : defaults.menuHue;
    const sat = controls.menuSat ? Number(controls.menuSat.slider.value) : defaults.menuSat;
    const glow = controls.menuGlow ? Number(controls.menuGlow.slider.value) : defaults.menuGlow;
    document.documentElement.style.setProperty('--menu-hue', hue);
    document.documentElement.style.setProperty('--menu-sat', sat + '%');
    document.documentElement.style.setProperty('--menu-glow', glow / 100);
  }

  function keyNameFromEvent(e) {
    if (e.key === ' ') return 'Space';
    if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') return e.key;
    return e.key.length === 1 ? e.key.toUpperCase() : e.key;
  }

  function applySettingsToMenu(data, saveMissing) {
    if ((data.autoReconnect ?? defaults.autoReconnect) && (data.autoRequeue ?? defaults.autoRequeue)) {
      data.autoRequeue = false;
      chrome.storage.local.set({ autoRequeue: false });
    }

    for (const id of checkboxIds) {
      const el = document.getElementById(id);
      el.checked = data[id] ?? defaults[id];
      if (saveMissing && data[id] === undefined) chrome.storage.local.set({ [id]: defaults[id] });
    }

    for (const [name, control] of Object.entries(controls)) {
      setControl(name, data[name] ?? defaults[name], saveMissing && data[name] === undefined);
    }

    for (const id of colorIds) {
      const el = document.getElementById(id);
      el.value = data[id] ?? defaults[id];
      if (saveMissing && data[id] === undefined) chrome.storage.local.set({ [id]: defaults[id] });
    }

    for (const id of textIds) {
      const el = document.getElementById(id);
      el.value = data[id] ?? defaults[id];
      if (saveMissing && data[id] === undefined) chrome.storage.local.set({ [id]: defaults[id] });
    }

    chatRepeatCount.value = data.chatRepeatCount ?? defaults.chatRepeatCount;
    if (saveMissing && data.chatRepeatCount === undefined) chrome.storage.local.set({ chatRepeatCount: defaults.chatRepeatCount });

    hotkeyButton.textContent = data.autoHotkey ?? defaults.autoHotkey;
    if (saveMissing && data.autoHotkey === undefined) chrome.storage.local.set({ autoHotkey: defaults.autoHotkey });
    updateBackgroundLock();
  }

  function getMenuSettings() {
    const result = {};
    for (const id of checkboxIds) result[id] = document.getElementById(id).checked;
    for (const [name, control] of Object.entries(controls)) result[name] = Number(control.slider.value);
    for (const id of colorIds) result[id] = document.getElementById(id).value;
    for (const id of textIds) result[id] = document.getElementById(id).value.trim();
    result.chatRepeatCount = Number(chatRepeatCount.value) || defaults.chatRepeatCount;
    result.autoHotkey = hotkeyButton.textContent || defaults.autoHotkey;
    return result;
  }

  function setStatus(text) {
    configStatus.textContent = text;
    if (text) setTimeout(() => {
      if (configStatus.textContent === text) configStatus.textContent = '';
    }, 1800);
  }

  function saveTextSetting(id, value, immediate = false) {
    clearTimeout(textSaveTimers[id]);
    const save = () => chrome.storage.local.set({ [id]: value.trim() });
    if (id === 'lobbyBackgroundUrl') updateBackgroundLock();
    if (immediate) save();
    else textSaveTimers[id] = setTimeout(save, 120);
  }

  function updateBackgroundLock() {
    const locked = document.getElementById('lobbyBackgroundUrl').value.trim().length > 0;
    backgroundColorInput.disabled = locked;
    backgroundColorInput.title = locked ? 'Clear Lobby background URL to edit Background.' : '';
    const row = backgroundColorInput.closest('.color-row');
    if (row) row.classList.toggle('locked', locked);
  }

  function renderConfigs(configs) {
    const names = Object.keys(configs).sort((a, b) => a.localeCompare(b));
    configSelect.innerHTML = '';
    if (!names.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No configs saved';
      configSelect.appendChild(opt);
      return;
    }
    for (const name of names) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      configSelect.appendChild(opt);
    }
  }

  function loadConfigs() {
    chrome.storage.local.get(['configs'], (data) => renderConfigs(data.configs || {}));
  }

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`[data-page="${tab.dataset.tab}"]`).classList.add('active');
    });
  });

  document.getElementById('noticeSettingsButton').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('noticeSettingsMenu').classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    const menu = document.getElementById('noticeSettingsMenu');
    const button = document.getElementById('noticeSettingsButton');
    if (!menu.contains(e.target) && e.target !== button) menu.classList.remove('open');
  });

  chrome.storage.local.get([...settingKeys, 'configs'], (data) => {
    applySettingsToMenu(data, true);
    renderConfigs(data.configs || {});
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.chatRepeatEnabled) {
      document.getElementById('chatRepeatEnabled').checked = !!changes.chatRepeatEnabled.newValue;
    }
    if (changes.autoReconnect) {
      document.getElementById('autoReconnect').checked = !!changes.autoReconnect.newValue;
    }
    if (changes.autoRequeue) {
      document.getElementById('autoRequeue').checked = !!changes.autoRequeue.newValue;
    }
  });

  for (const id of checkboxIds) {
    document.getElementById(id).addEventListener('change', (e) => {
      if (id === 'chatRepeatEnabled' && e.target.checked) {
        const text = document.getElementById('chatRepeatMessage').value.trim();
        const count = Math.max(1, Math.min(20, Number(chatRepeatCount.value) || 1));
        chrome.storage.local.set({ chatRepeatMessage: text, chatRepeatCount: count, chatRepeatEnabled: true });
        return;
      }
      if (id === 'autoReconnect' && e.target.checked) {
        chrome.storage.local.set({ autoReconnect: true, autoRequeue: false });
        return;
      }
      if (id === 'autoRequeue' && e.target.checked) {
        chrome.storage.local.set({ autoRequeue: true, autoReconnect: false });
        return;
      }
      chrome.storage.local.set({ [id]: e.target.checked });
    });
  }

  for (const [name, control] of Object.entries(controls)) {
    control.slider.addEventListener('input', () => setControl(name, control.slider.value, true));
  }

  document.querySelectorAll('.control').forEach((controlEl) => {
    const name = controlEl.dataset.setting;
    controlEl.querySelectorAll('.step').forEach((button) => {
      button.addEventListener('click', () => {
        const current = Number(controls[name].slider.value);
        const step = Number(button.dataset.step);
        setControl(name, current + step, true);
      });
    });
  });

  for (const id of colorIds) {
    document.getElementById(id).addEventListener('input', (e) => {
      chrome.storage.local.set({ [id]: e.target.value });
    });
  }

  for (const id of textIds) {
    const el = document.getElementById(id);
    el.addEventListener('input', (e) => saveTextSetting(id, e.target.value));
    el.addEventListener('change', (e) => saveTextSetting(id, e.target.value, true));
  }

  chatRepeatCount.addEventListener('input', () => {
    const value = Math.max(1, Math.min(20, Number(chatRepeatCount.value) || 1));
    chatRepeatCount.value = value;
    chrome.storage.local.set({ chatRepeatCount: value });
  });

  document.getElementById('resetTheme').addEventListener('click', () => {
    document.getElementById('resetTheme').blur();
    const themeDefaults = {};
    for (const id of colorIds) themeDefaults[id] = defaults[id];
    for (const id of visualTextIds) themeDefaults[id] = defaults[id];
    themeDefaults.themeBrightness = defaults.themeBrightness;
    themeDefaults.menuHue = defaults.menuHue;
    themeDefaults.menuSat = defaults.menuSat;
    themeDefaults.menuGlow = defaults.menuGlow;
    themeDefaults.customTheme = false;
    themeDefaults.cleanLobby = false;
    chrome.storage.local.set(themeDefaults, () => {
      applySettingsToMenu({ ...getMenuSettings(), ...themeDefaults }, false);
    });
  });

  let listeningForHotkey = false;
  hotkeyButton.addEventListener('click', () => {
    listeningForHotkey = true;
    hotkeyButton.classList.add('listening');
    hotkeyButton.textContent = 'Press a key';
  });

  document.addEventListener('keydown', (e) => {
    if (!listeningForHotkey) return;
    e.preventDefault();
    const key = keyNameFromEvent(e);
    listeningForHotkey = false;
    hotkeyButton.classList.remove('listening');
    hotkeyButton.textContent = key;
    chrome.storage.local.set({ autoHotkey: key });
  }, true);

  document.getElementById('saveConfig').addEventListener('click', () => {
    const name = configName.value.trim();
    if (!name) {
      setStatus('Name the config first.');
      return;
    }
    chrome.storage.local.get(['configs'], (data) => {
      const configs = data.configs || {};
      configs[name] = getMenuSettings();
      chrome.storage.local.set({ configs }, () => {
        renderConfigs(configs);
        configSelect.value = name;
        setStatus('Saved.');
      });
    });
  });

  document.getElementById('loadConfig').addEventListener('click', () => {
    const name = configSelect.value;
    if (!name) return;
    chrome.storage.local.get(['configs'], (data) => {
      const configs = data.configs || {};
      if (!configs[name]) return;
      const next = {};
      for (const key of settingKeys) {
        if (configs[name][key] !== undefined) next[key] = configs[name][key];
      }
      chrome.storage.local.set(next, () => {
        applySettingsToMenu({ ...defaults, ...next }, false);
        setStatus('Loaded.');
      });
    });
  });

  document.getElementById('deleteConfig').addEventListener('click', () => {
    const name = configSelect.value;
    if (!name) return;
    chrome.storage.local.get(['configs'], (data) => {
      const configs = data.configs || {};
      delete configs[name];
      chrome.storage.local.set({ configs }, () => {
        renderConfigs(configs);
        setStatus('Deleted.');
      });
    });
  });

  configSelect.addEventListener('change', () => {
    configName.value = configSelect.value || '';
  });

  loadConfigs();
});
