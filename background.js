chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'typeWord') {
    if (!sender.tab) {
      sendResponse({ ok: false, reason: 'no-tab' });
      return true;
    }
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      world: 'MAIN',
      func: (word) => {
        return new Promise((resolve) => {
          const el = document.querySelector('#game-chat > form > input[type="text"], #game-chat .chat-form input[type="text"]');
          if (!el || el.disabled || el.style.display === 'none') {
            resolve({ ok: false, reason: 'input-unavailable' });
            return;
          }

          el.focus();
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(el, word);
          el.dispatchEvent(new Event('input', { bubbles: true }));

          setTimeout(() => {
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            if (el.form) el.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            if (el.form && typeof el.form.requestSubmit === 'function' && el.value) el.form.requestSubmit();

            setTimeout(() => {
              const current = (el.value || '').trim().toLowerCase();
              resolve({ ok: current !== word.toLowerCase(), value: current });
            }, 160);
          }, 60 + Math.random() * 60);
        });
      },
      args: [msg.word]
    }).then((results) => {
      sendResponse((results && results[0] && results[0].result) || { ok: false, reason: 'no-result' });
    }).catch((err) => {
      sendResponse({ ok: false, reason: err.message });
    });
    return true;
  }

  if (msg.action === 'getState') {
    chrome.storage.local.get(['autoGuess', 'delaySpeed'], (data) => {
      sendResponse(data);
    });
    return true;
  }

  if (msg.action === 'setState') {
    chrome.storage.local.set(msg.data, () => sendResponse({ ok: true }));
    return true;
  }
});
