(() => {
  'use strict';

  const BRIDGE_STUDIO = 'http://127.0.0.1:8766/studio';
  const $ = id => document.getElementById(id);
  const els = {
    module: $('nfcModuleStatus'), reader: $('nfcReaderStatus'), card: $('nfcCardStatus'), uid: $('nfcCardUid'),
    url: $('nfcUrlInput'), auto: $('nfcAutoWrite'), read: $('nfcReadCardBtn'), write: $('nfcWriteCardBtn'),
    verify: $('nfcVerifyCardBtn'), log: $('nfcActivityLog'), hint: $('nfcBridgeHint')
  };
  if (!els.module) return;

  let bridgeWindow = null;
  let bridgeOnline = false;
  let cardPresent = false;
  let previousPresent = false;
  let autoArmed = true;
  let busy = false;
  let lastWrittenUrl = '';
  let lastStatusAt = 0;
  let requestSequence = 0;
  const pending = new Map();

  function normalizeUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      const pathname = (url.pathname || '/').replace(/\/+$/, '') || '/';
      return `${url.protocol.toLowerCase()}//${host}${pathname}${url.search}${url.hash}`;
    } catch (_) {
      return String(value || '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
    }
  }

  const setButtons = () => {
    const enabled = bridgeOnline && cardPresent && !busy;
    els.read.disabled = !enabled;
    els.write.disabled = !enabled;
    els.verify.disabled = !enabled;
  };

  const addLog = (title, detail = '', ok = true) => {
    const time = new Date().toLocaleTimeString();
    els.log.className = 'nfc-log-entry';
    els.log.innerHTML = `<span style="display:inline-grid;place-items:center;width:32px;height:32px;border-radius:50%;background:${ok ? '#eaf8f1' : '#fff1f1'};color:${ok ? '#087443' : '#b42318'}">${ok ? '✓' : '!'}</span><div><b>${title}</b><small style="display:block;margin-top:4px;color:#7c8796">${detail}${detail ? ' · ' : ''}${time}</small></div>`;
  };

  function renderConnectState(message = 'Start the NFC Bridge, then connect it once.') {
    bridgeOnline = false;
    cardPresent = false;
    previousPresent = false;
    els.module.textContent = 'BRIDGE OFFLINE';
    els.module.classList.remove('ready');
    els.module.classList.add('standby');
    els.reader.textContent = 'Waiting for bridge';
    els.card.textContent = 'No card detected';
    els.uid.textContent = '—';
    els.hint.innerHTML = `<div style="display:grid;gap:10px"><span>${message}</span><button id="nfcConnectBridge" type="button" style="border:0;border-radius:10px;padding:11px 14px;font-weight:800;background:#173b7a;color:#fff;cursor:pointer">Connect NFC Bridge</button></div>`;
    const button = $('nfcConnectBridge');
    if (button) button.onclick = connectBridge;
    setButtons();
  }

  function connectBridge() {
    bridgeWindow = window.open(BRIDGE_STUDIO, 'TabajaNfcBridgeAgent', 'width=820,height=760,resizable=yes,scrollbars=yes');
    if (!bridgeWindow) {
      addLog('Bridge window blocked', 'Allow pop-ups for Tabaja Solution, then press Connect NFC Bridge again.', false);
      return;
    }
    els.hint.textContent = 'Connecting to the local NFC Bridge… Keep the bridge window open or minimized.';
    const hello = setInterval(() => {
      if (!bridgeWindow || bridgeWindow.closed) {
        clearInterval(hello);
        renderConnectState('The NFC Bridge window was closed. Open it again to continue.');
        return;
      }
      bridgeWindow.postMessage({ source: 'tabaja-nfc-app', type: 'hello' }, '*');
      if (bridgeOnline) clearInterval(hello);
    }, 500);
  }

  function bridgeCommand(command, payload = {}) {
    if (!bridgeWindow || bridgeWindow.closed || !bridgeOnline) {
      renderConnectState('Connect the NFC Bridge before using Read, Write, or Verify.');
      return Promise.reject(new Error('NFC Bridge is not connected.'));
    }
    const requestId = `nfc-${Date.now()}-${++requestSequence}`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error('NFC Bridge did not answer in time.'));
      }, 8000);
      pending.set(requestId, { resolve, reject, timeout });
      bridgeWindow.postMessage({ source: 'tabaja-nfc-app', type: 'command', command, payload, requestId }, '*');
    });
  }

  function applyStatus(data) {
    lastStatusAt = Date.now();
    bridgeOnline = true;
    cardPresent = !!data.cardPresent;
    els.module.textContent = cardPresent ? 'CARD READY' : 'READER READY';
    els.module.classList.add('ready');
    els.module.classList.remove('standby');
    els.reader.textContent = data.reader || 'ACR122U not connected';
    els.card.textContent = cardPresent ? 'Card detected' : 'Place a card on reader';
    els.uid.textContent = data.uid || '—';
    els.hint.textContent = cardPresent
      ? 'Reader and card are ready. Read, write, and verify directly from this page.'
      : 'Bridge connected. Connect the reader and place one card in the center.';

    if (els.auto.checked) {
      if (!cardPresent) autoArmed = true;
      if (cardPresent && !previousPresent && autoArmed && !busy) {
        autoArmed = false;
        setTimeout(writeUrl, 220);
      }
    }
    previousPresent = cardPresent;
    setButtons();
  }

  window.addEventListener('message', event => {
    const data = event.data || {};
    if (data.source !== 'tabaja-nfc-bridge') return;
    if (!bridgeWindow && event.source) bridgeWindow = event.source;

    if (data.type === 'ready') {
      bridgeOnline = true;
      lastStatusAt = Date.now();
      if (bridgeWindow) bridgeWindow.postMessage({ source: 'tabaja-nfc-app', type: 'status-request' }, '*');
      return;
    }
    if (data.type === 'status') {
      applyStatus(data.status || {});
      return;
    }
    if (data.type === 'response') {
      const item = pending.get(data.requestId);
      if (!item) return;
      clearTimeout(item.timeout);
      pending.delete(data.requestId);
      if (data.ok) item.resolve(data.result || {});
      else item.reject(new Error(data.error || 'NFC Bridge operation failed.'));
    }
  });

  async function withBusy(fn) {
    if (busy) return;
    busy = true;
    setButtons();
    try { await fn(); }
    catch (error) { addLog('Operation failed', error.message || String(error), false); }
    finally { busy = false; setButtons(); }
  }

  async function readCard() {
    await withBusy(async () => {
      const data = await bridgeCommand('read');
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
      const data = await bridgeCommand('write', { url });
      lastWrittenUrl = url;
      const verified = normalizeUrl(data.url) === normalizeUrl(url);
      addLog(verified ? 'Website link written and verified' : 'Website link written', `${data.url || url} · UID ${data.uid || ''}`, verified);
    });
  }

  async function verifyCard() {
    const expected = els.url.value.trim() || lastWrittenUrl;
    await withBusy(async () => {
      const data = await bridgeCommand('verify', { url: expected });
      const match = data.match || normalizeUrl(data.url) === normalizeUrl(expected);
      addLog(match ? 'Card verified successfully' : 'Verification mismatch', match ? (data.url || expected) : `Found: ${data.url || 'no URL'}`, match);
    });
  }

  els.read.addEventListener('click', readCard);
  els.write.addEventListener('click', writeUrl);
  els.verify.addEventListener('click', verifyCard);
  els.auto.addEventListener('change', () => { autoArmed = true; });

  renderConnectState();
  setInterval(() => {
    if (bridgeOnline && Date.now() - lastStatusAt > 2500) {
      renderConnectState('Connection to the NFC Bridge was lost. Open it again to continue.');
    }
    if (bridgeWindow && !bridgeWindow.closed) {
      bridgeWindow.postMessage({ source: 'tabaja-nfc-app', type: 'status-request' }, '*');
    }
  }, 900);
})();
