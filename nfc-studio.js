(() => {
  'use strict';

  // The public PWA cannot fetch localhost directly in current Edge/Chrome builds.
  // A local bridge window performs the PC/SC work on the same localhost origin,
  // while this page controls it through window.postMessage.
  const BRIDGE_ORIGIN = 'http://127.0.0.1:8766';
  const BRIDGE_URL = `${BRIDGE_ORIGIN}/studio?proxy=1`;
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
  let requestCounter = 0;
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

  const renderConnectState = (message = 'Start the local bridge, then connect it once.') => {
    bridgeOnline = false;
    cardPresent = false;
    previousPresent = false;
    els.module.textContent = 'BRIDGE OFFLINE';
    els.module.classList.remove('ready');
    els.module.classList.add('standby');
    els.reader.textContent = 'Waiting for local bridge';
    els.card.textContent = 'No card detected';
    els.uid.textContent = '—';
    els.hint.innerHTML = `<div style="display:grid;gap:10px"><span>${message}</span><button id="nfcConnectBridgeBtn" type="button" style="border:0;border-radius:10px;padding:11px 14px;font-weight:800;background:#173b7a;color:#fff;cursor:pointer">Connect NFC Bridge</button></div>`;
    const button = $('nfcConnectBridgeBtn');
    if (button) button.addEventListener('click', connectBridge);
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
      ? 'Reader and card are ready. All buttons on this page are active.'
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

  function connectBridge() {
    if (bridgeWindow && !bridgeWindow.closed) {
      bridgeWindow.focus();
      return;
    }
    bridgeWindow = window.open(BRIDGE_URL, 'tabajaNfcBridge', 'width=560,height=760,resizable=yes,scrollbars=yes');
    if (!bridgeWindow) {
      renderConnectState('The browser blocked the bridge window. Allow pop-ups for Tabaja, then press Connect NFC Bridge again.');
      return;
    }
    els.module.textContent = 'CONNECTING…';
    els.reader.textContent = 'Opening local bridge';
    els.hint.textContent = 'Keep the local bridge window open or minimized. Operations will run from this page.';
  }

  function sendCommand(action, payload = {}, timeout = 6000) {
    return new Promise((resolve, reject) => {
      if (!bridgeWindow || bridgeWindow.closed) {
        renderConnectState('The local bridge window is closed. Press Connect NFC Bridge.');
        reject(new Error('NFC Bridge is not connected.'));
        return;
      }
      const id = `nfc-${Date.now()}-${++requestCounter}`;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('NFC Bridge did not respond. Keep its local window open.'));
      }, timeout);
      pending.set(id, { resolve, reject, timer });
      bridgeWindow.postMessage({ channel: 'tabaja-nfc-command', id, action, payload }, BRIDGE_ORIGIN);
    });
  }

  window.addEventListener('message', event => {
    if (event.origin !== BRIDGE_ORIGIN || !event.data || event.data.channel !== 'tabaja-nfc-bridge') return;
    if (event.data.type === 'ready') {
      bridgeWindow = event.source;
      sendCommand('status').then(applyStatus).catch(error => renderConnectState(error.message));
      return;
    }
    if (event.data.type === 'status') {
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
      if (bridgeWindow && !bridgeWindow.closed) sendCommand('status', {}, 2500).then(applyStatus).catch(() => {});
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
      const data = await sendCommand('write', { url }, 9000);
      lastWrittenUrl = url;
      const verified = data.url && normalizeUrl(data.url) === normalizeUrl(url);
      addLog(verified ? 'Website link written and verified' : 'Website link written', `${data.url || url} · UID ${data.uid || ''}`, true);
    });
  }

  async function verifyCard() {
    const expected = els.url.value.trim() || lastWrittenUrl;
    await withBusy(async () => {
      const data = await sendCommand('verify', { url: expected });
      const match = data.match || (data.url && normalizeUrl(data.url) === normalizeUrl(expected));
      addLog(match ? 'Card verified successfully' : 'Verification mismatch', match ? data.url : `Found: ${data.url || 'no URL'}`, !!match);
    });
  }

  els.read.addEventListener('click', readCard);
  els.write.addEventListener('click', writeUrl);
  els.verify.addEventListener('click', verifyCard);
  els.auto.addEventListener('change', () => { autoArmed = true; });

  renderConnectState();
  setInterval(() => {
    if (bridgeWindow && !bridgeWindow.closed && !busy) {
      sendCommand('status', {}, 2200).then(applyStatus).catch(() => renderConnectState('Bridge connection was lost. Press Connect NFC Bridge again.'));
    } else if (bridgeOnline) {
      renderConnectState('The local bridge window was closed. Press Connect NFC Bridge.');
    }
  }, 900);
})();
