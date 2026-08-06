(() => {
  'use strict';

  const BRIDGE_ORIGIN = 'http://127.0.0.1:8766';
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
  let busy = false;
  let lastStatusAt = 0;

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

  function renderDisconnected() {
    bridgeOnline = false;
    cardPresent = false;
    els.module.textContent = 'CONNECT BRIDGE';
    els.module.classList.remove('ready');
    els.module.classList.add('standby');
    els.reader.textContent = 'Waiting for local writer';
    els.card.textContent = 'No card detected';
    els.uid.textContent = '—';
    els.hint.innerHTML = `
      <div style="display:grid;gap:10px">
        <span>Run <b>NFC-Bridge\\Start-NFC-Bridge.bat</b>, then connect the local writer once.</span>
        <button id="nfcConnectBridge" type="button" style="border:0;border-radius:10px;padding:11px 14px;font-weight:800;background:#173b7a;color:#fff;cursor:pointer">Connect NFC Bridge</button>
      </div>`;
    const button = $('nfcConnectBridge');
    if (button) button.onclick = connectBridge;
    setButtons();
  }

  function renderStatus(data) {
    bridgeOnline = true;
    cardPresent = !!data.cardPresent;
    lastStatusAt = Date.now();
    els.module.textContent = cardPresent ? 'CARD READY' : 'BRIDGE ONLINE';
    els.module.classList.add('ready');
    els.module.classList.remove('standby');
    els.reader.textContent = data.reader || 'Bridge online — connect ACR122U';
    els.card.textContent = cardPresent ? 'Card detected' : 'Place a card on reader';
    els.uid.textContent = data.uid || '—';
    els.hint.innerHTML = cardPresent
      ? 'Bridge, reader and card are ready. You can read, write or verify from this page.'
      : 'Bridge is online. Connect the ACR122U and place one card in the center.';
    setButtons();
  }

  function connectBridge() {
    bridgeWindow = window.open(`${BRIDGE_ORIGIN}/studio?controller=tabaja`, 'tabajaNfcBridge', 'width=540,height=720,resizable=yes,scrollbars=yes');
    if (!bridgeWindow) {
      addLog('Popup blocked', 'Allow pop-ups for Tabaja, then press Connect NFC Bridge again.', false);
      return;
    }
    addLog('Connecting to NFC Bridge', 'Keep the local writer window open or minimized.');
    setTimeout(() => sendCommand('ping'), 600);
  }

  function sendCommand(action, extra = {}) {
    if (!bridgeWindow || bridgeWindow.closed) {
      renderDisconnected();
      addLog('Bridge window is not connected', 'Press Connect NFC Bridge first.', false);
      return false;
    }
    bridgeWindow.postMessage({ source: 'tabaja-nfc-app', action, ...extra }, BRIDGE_ORIGIN);
    return true;
  }

  function setBusy(value) {
    busy = value;
    setButtons();
  }

  window.addEventListener('message', event => {
    if (event.origin !== BRIDGE_ORIGIN || !event.data || event.data.source !== 'tabaja-nfc-bridge') return;
    const msg = event.data;
    if (msg.type === 'status') {
      renderStatus(msg.data || {});
      return;
    }
    if (msg.type === 'result') {
      setBusy(false);
      const data = msg.data || {};
      if (msg.action === 'read') {
        if (data.url) els.url.value = data.url;
        addLog('Card read successfully', data.url ? `URL: ${data.url}` : `UID: ${data.uid || 'unknown'}`);
      } else if (msg.action === 'write') {
        addLog(data.verified === false ? 'Link written — verify recommended' : 'Website link written and verified', `${data.url || els.url.value} · UID ${data.uid || ''}`, data.verified !== false);
      } else if (msg.action === 'verify') {
        addLog(data.match ? 'Card verified successfully' : 'Verification mismatch', data.match ? (data.url || '') : `Found: ${data.url || 'no URL'}`, !!data.match);
      }
      return;
    }
    if (msg.type === 'error') {
      setBusy(false);
      addLog('Operation failed', msg.error || 'Unknown bridge error', false);
    }
  });

  function validateUrl() {
    const url = els.url.value.trim();
    if (!/^https?:\/\//i.test(url)) {
      addLog('Invalid website link', 'The link must begin with https:// or http://', false);
      return null;
    }
    return url;
  }

  els.read.addEventListener('click', () => {
    if (sendCommand('read')) setBusy(true);
  });

  els.write.addEventListener('click', () => {
    const url = validateUrl();
    if (!url) return;
    if (sendCommand('write', { url })) setBusy(true);
  });

  els.verify.addEventListener('click', () => {
    const url = validateUrl();
    if (!url) return;
    if (sendCommand('verify', { url })) setBusy(true);
  });

  els.auto.addEventListener('change', () => {
    const url = validateUrl();
    if (!url && els.auto.checked) { els.auto.checked = false; return; }
    sendCommand('setAuto', { enabled: els.auto.checked, url: url || els.url.value.trim() });
    addLog(els.auto.checked ? 'Auto-write enabled' : 'Auto-write disabled', els.auto.checked ? 'Each new card will receive the same website link.' : 'Manual writing restored.');
  });

  els.url.addEventListener('change', () => {
    if (bridgeOnline) sendCommand('setUrl', { url: els.url.value.trim() });
  });

  setInterval(() => {
    if (bridgeOnline && Date.now() - lastStatusAt > 3000) renderDisconnected();
    if (bridgeWindow && bridgeWindow.closed && bridgeOnline) renderDisconnected();
  }, 1000);

  renderDisconnected();
})();
