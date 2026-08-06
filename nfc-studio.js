(() => {
  'use strict';

  // Real integration: the local bridge is loaded in a hidden iframe.
  // The public/PWA page never fetches localhost directly; all PC/SC work stays
  // inside the localhost document and commands cross origins via postMessage.
  const BRIDGE_ORIGIN = 'http://127.0.0.1:8766';
  const BRIDGE_URL = `${BRIDGE_ORIGIN}/studio?embedded=1`;
  const $ = id => document.getElementById(id);
  const els = {
    module: $('nfcModuleStatus'), reader: $('nfcReaderStatus'), card: $('nfcCardStatus'), uid: $('nfcCardUid'),
    url: $('nfcUrlInput'), auto: $('nfcAutoWrite'), read: $('nfcReadCardBtn'), write: $('nfcWriteCardBtn'),
    verify: $('nfcVerifyCardBtn'), log: $('nfcActivityLog'), hint: $('nfcBridgeHint')
  };
  if (!els.module) return;

  let bridgeFrame = null;
  let bridgeWindow = null;
  let bridgeOnline = false;
  let cardPresent = false;
  let previousPresent = false;
  let autoArmed = true;
  let busy = false;
  let lastWrittenUrl = '';
  let requestCounter = 0;
  let reconnectTimer = null;
  const pending = new Map();

  const normalizeUrl = value => {
    try {
      const u = new URL(value);
      return `${u.protocol}//${u.hostname.replace(/^www\./i, '').toLowerCase()}${u.pathname.replace(/\/$/, '')}${u.search}${u.hash}`;
    } catch (_) {
      return String(value || '').trim().replace(/^https?:\/\/(?:www\.)?/i, '').replace(/\/$/, '').toLowerCase();
    }
  };

  const addLog = (title, detail = '', ok = true) => {
    const time = new Date().toLocaleTimeString();
    els.log.className = 'nfc-log-entry';
    els.log.innerHTML = `<span style="display:inline-grid;place-items:center;width:32px;height:32px;border-radius:50%;background:${ok ? '#eaf8f1' : '#fff1f1'};color:${ok ? '#087443' : '#b42318'}">${ok ? '✓' : '!'}</span><div><b>${title}</b><small style="display:block;margin-top:4px;color:#7c8796">${detail}${detail ? ' · ' : ''}${time}</small></div>`;
  };

  const setButtons = () => {
    const enabled = bridgeOnline && cardPresent && !busy;
    els.read.disabled = !enabled;
    els.write.disabled = !enabled;
    els.verify.disabled = !enabled;
  };

  const setOffline = (message = 'Starting the local NFC bridge…') => {
    bridgeOnline = false;
    cardPresent = false;
    previousPresent = false;
    els.module.textContent = 'BRIDGE OFFLINE';
    els.module.classList.remove('ready');
    els.module.classList.add('standby');
    els.reader.textContent = 'Waiting for bridge';
    els.card.textContent = 'No card detected';
    els.uid.textContent = '—';
    els.hint.innerHTML = `<div style="display:grid;gap:8px"><span>${message}</span><button id="nfcRetryBridgeBtn" type="button" style="border:0;border-radius:10px;padding:11px 14px;font-weight:800;background:#173b7a;color:#fff;cursor:pointer">Retry NFC Bridge</button></div>`;
    const retry = $('nfcRetryBridgeBtn');
    if (retry) retry.addEventListener('click', mountBridgeFrame);
    setButtons();
  };

  const applyStatus = data => {
    bridgeOnline = !!(data && data.ok !== false);
    cardPresent = !!(data && data.cardPresent);
    els.module.textContent = cardPresent ? 'CARD READY' : 'BRIDGE ONLINE';
    els.module.classList.add('ready');
    els.module.classList.remove('standby');
    els.reader.textContent = data.reader || 'Bridge online — connect ACR122U';
    els.card.textContent = cardPresent ? 'Card detected' : 'Place one card on reader';
    els.uid.textContent = data.uid || '—';
    els.hint.textContent = cardPresent
      ? 'Reader and card are ready. Read, write and verify work directly from this page.'
      : 'Bridge connected. Place one NFC card in the center of the reader.';

    if (els.auto.checked) {
      if (!cardPresent) autoArmed = true;
      if (cardPresent && !previousPresent && autoArmed && !busy) {
        autoArmed = false;
        setTimeout(writeUrl, 220);
      }
    }
    previousPresent = cardPresent;
    setButtons();
  };

  function rejectAllPending(reason) {
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error(reason));
    }
    pending.clear();
  }

  function mountBridgeFrame() {
    clearTimeout(reconnectTimer);
    rejectAllPending('NFC bridge was restarted.');
    if (bridgeFrame) bridgeFrame.remove();

    bridgeFrame = document.createElement('iframe');
    bridgeFrame.id = 'tabajaNfcBridgeFrame';
    bridgeFrame.src = `${BRIDGE_URL}&t=${Date.now()}`;
    bridgeFrame.title = 'Tabaja NFC Bridge';
    bridgeFrame.setAttribute('aria-hidden', 'true');
    bridgeFrame.style.cssText = 'position:fixed;width:1px;height:1px;right:0;bottom:0;border:0;opacity:0;pointer-events:none;z-index:-1;';
    bridgeFrame.addEventListener('load', () => {
      bridgeWindow = bridgeFrame.contentWindow;
      els.module.textContent = 'CONNECTING…';
      els.reader.textContent = 'Connecting to local bridge';
      els.hint.textContent = 'The bridge is loading inside Tabaja. Keep the black bridge window open.';
    });
    bridgeFrame.addEventListener('error', () => setOffline('Could not load the local bridge. Make sure Start-NFC-Bridge.bat is running.'));
    document.body.appendChild(bridgeFrame);
    bridgeWindow = bridgeFrame.contentWindow;
    setOffline('Connecting automatically. Keep Start-NFC-Bridge.bat open.');

    reconnectTimer = setTimeout(() => {
      if (!bridgeOnline) setOffline('The bridge did not answer. Confirm Start-NFC-Bridge.bat is running on port 8766, then press Retry NFC Bridge.');
    }, 5000);
  }

  function sendCommand(action, payload = {}, timeout = 6500) {
    return new Promise((resolve, reject) => {
      if (!bridgeWindow) {
        reject(new Error('NFC Bridge is not loaded.'));
        return;
      }
      const id = `nfc-${Date.now()}-${++requestCounter}`;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('NFC Bridge did not respond. Keep Start-NFC-Bridge.bat open.'));
      }, timeout);
      pending.set(id, { resolve, reject, timer });
      bridgeWindow.postMessage({ channel: 'tabaja-nfc-command', id, action, payload }, BRIDGE_ORIGIN);
    });
  }

  window.addEventListener('message', event => {
    if (event.origin !== BRIDGE_ORIGIN || !event.data || event.data.channel !== 'tabaja-nfc-bridge') return;
    if (!bridgeFrame || event.source !== bridgeFrame.contentWindow) return;
    bridgeWindow = event.source;

    if (event.data.type === 'ready') {
      clearTimeout(reconnectTimer);
      sendCommand('status').then(applyStatus).catch(error => setOffline(error.message));
      return;
    }
    if (event.data.type === 'status') {
      clearTimeout(reconnectTimer);
      applyStatus(event.data.data || {});
      return;
    }
    if (event.data.type === 'response') {
      const item = pending.get(event.data.id);
      if (!item) return;
      clearTimeout(item.timer);
      pending.delete(event.data.id);
      if (event.data.ok) item.resolve(event.data.data || {});
      else item.reject(new Error(event.data.error || 'NFC operation failed.'));
    }
  });

  async function withBusy(fn) {
    if (busy) return;
    busy = true;
    setButtons();
    try {
      await fn();
    } catch (error) {
      addLog('Operation failed', error.message || String(error), false);
    } finally {
      busy = false;
      setButtons();
      if (bridgeWindow) sendCommand('status', {}, 2500).then(applyStatus).catch(() => {});
    }
  }

  async function readCard() {
    await withBusy(async () => {
      const data = await sendCommand('read');
      if (data.url) els.url.value = data.url;
      addLog('Card read successfully', data.url ? `URL: ${data.url}` : `UID: ${data.uid || 'unknown'}`);
    });
  }

  async function writeUrl() {
    const url = els.url.value.trim();
    if (!/^https?:\/\//i.test(url)) {
      addLog('Invalid website link', 'The link must begin with https:// or http://', false);
      return;
    }
    await withBusy(async () => {
      const data = await sendCommand('write', { url }, 10000);
      lastWrittenUrl = url;
      const verified = data.url && normalizeUrl(data.url) === normalizeUrl(url);
      addLog(verified ? 'Website link written and verified' : 'Website link written', `${data.url || url}${data.uid ? ` · UID ${data.uid}` : ''}`, true);
    });
  }

  async function verifyCard() {
    const expected = els.url.value.trim() || lastWrittenUrl;
    await withBusy(async () => {
      const data = await sendCommand('verify', { url: expected }, 8000);
      const match = data.match || (data.url && normalizeUrl(data.url) === normalizeUrl(expected));
      addLog(match ? 'Card verified successfully' : 'Verification mismatch', match ? data.url : `Found: ${data.url || 'no URL'}`, !!match);
    });
  }

  els.read.addEventListener('click', readCard);
  els.write.addEventListener('click', writeUrl);
  els.verify.addEventListener('click', verifyCard);
  els.auto.addEventListener('change', () => { autoArmed = true; });

  setOffline();
  mountBridgeFrame();
  setInterval(() => {
    if (bridgeWindow && !busy) {
      sendCommand('status', {}, 2500).then(applyStatus).catch(() => {
        if (bridgeOnline) setOffline('Bridge connection was lost. Press Retry NFC Bridge.');
      });
    }
  }, 1000);
})();
