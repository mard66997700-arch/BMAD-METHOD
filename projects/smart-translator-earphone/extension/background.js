/**
 * Service worker. Owns the offscreen document lifecycle and ferries
 * `chrome.tabCapture.getMediaStreamId()` results from the popup down
 * into it (offscreen docs can't call `tabCapture` themselves).
 */

const OFFSCREEN_URL = 'offscreen.html';

async function hasOffscreen() {
  if (!chrome.runtime.getContexts) return false;
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  return contexts.length > 0;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['USER_MEDIA'],
    justification: 'Capture and process tab audio for real-time translation.',
  });
}

async function startCapture(config) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  const streamId = await new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message ?? 'tabCapture failed'));
      else resolve(id);
    });
  });
  await ensureOffscreen();
  await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'start',
    streamId,
    config,
  });
  await chrome.storage.session.set({ capturedTabId: tab.id });
}

async function stopCapture() {
  try {
    await chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop' });
  } catch {
    /* offscreen may have closed */
  }
  await chrome.storage.session.remove('capturedTabId');
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== 'background') return false;
  if (msg.type === 'start') {
    startCapture(msg.config)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (msg.type === 'stop') {
    stopCapture()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  return false;
});
