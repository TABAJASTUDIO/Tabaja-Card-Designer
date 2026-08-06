(() => {
  'use strict';

  const LOCAL_ORIGIN = 'http://127.0.0.1:8766';
  const IS_LOCAL_APP = window.location.origin === LOCAL_ORIGIN;
  const API_BASE = IS_LOCAL_APP ? '' : LOCAL_ORIGIN;
  const $ = id => document.getElementById(id);
  const els = {
    module: $('nfcModuleStatus'), reader: $('nfcReaderStatus'), card: $('nfcCardStatus'), uid: $('nfcCardUid'),
    url: $('nfcUrlInput'), auto: $('nfcAutoWrite'), read: $('nfcReadCardBtn'), write: $('nfcWriteCardBtn'),
    verify: $('nfcVerifyCardBtn'), log: $('nfcActivityLog'), hint: $('nfcBridgeHint')
  };
  if (!els.module) return;

  let bridgeOnline = false;
  let cardPresent = false;
  let previousPresent = false;
  let autoArmed = true;
  let busy = false;
  let lastWrittenUrl = '';

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

  const api = async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.error || 'NFC Bridge error');
    return data;
  };

  const setButtons = () => {
    const enabled = IS_LOCAL_APP && bridgeOnline && cardPresent && !busy;
    els.read.disabled = !enabled;
    els.write.disabled = !enabled;
    els.verify.disabled = !enabled;
  };

  const showHostedMessage = () => {
    bridgeOnline = false;
    cardPresent = false;
    els.module.textContent = 'LOCAL NFC APP REQUIRED';
    els.module.classList.remove('ready');
    els.module.classList.add('standby');
    els.reader.textContent = 'Open Tabaja from the local NFC Bridge';
    els.card.textContent = 'Reader access is blocked in the cloud/PWA page';
    els.uid.textContent = '—';
    els.hint.innerHTML = `<div style="display:grid;gap:10px"><span>Run <b>NFC-Bridge\\Start-NFC-Bridge.bat</b>. It will open the complete Tabaja app locally, where these buttons work directly.</span><button id="openLocalNfcAppBtn" type="button" style="border:0;border-radius:10px;padding:11px 14px;font-weight:800;background:#173b7a;color:#fff;cursor:pointer">Open Local Tabaja NFC App</button></div>`;
    const button = $('openLocalNfcAppBtn');
    if (button) button.addEventListener('click', () => window.open(`${LOCAL_ORIGIN}/?source=nfc`, '_blank'));
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
      ? 'Reader and card are ready. Read, Write and Verify are active on this page.'
      : 'Bridge connected. Place one NFC card in the center of the reader.';

    if (els.auto.checked) {
      if (!cardPresent) autoArmed = true;
      if (cardPresent && !previousPresent && autoArmed && !busy) {
        autoArmed = false;
        setTimeout(writeUrl, 250);
      }
    }
    previousPresent = cardPresent;
    setButtons();
  };

  async function refreshStatus() {
    if (!IS_LOCAL_APP || busy) return;
    try {
      applyStatus(await api('/status'));
    } catch (error) {
      bridgeOnline = false;
      cardPresent = false;
      els.module.textContent = 'BRIDGE OFFLINE';
      els.module.classList.remove('ready');
      els.module.classList.add('standby');
      els.reader.textContent = 'Local bridge is not responding';
      els.card.textContent = 'No card detected';
      els.uid.textContent = '—';
      els.hint.textContent = error.message || 'Start the NFC Bridge.';
      setButtons();
    }
  }

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
      await refreshStatus();
    }
  }

  async function readCard() {
    await withBusy(async () => {
      const data = await api('/read');
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
      const data = await api('/write', { method: 'POST', body: JSON.stringify({ url }) });
      lastWrittenUrl = url;
      const verified = data.url && normalizeUrl(data.url) === normalizeUrl(url);
      addLog(verified ? 'Website link written and verified' : 'Website link written', `${data.url || url} · UID ${data.uid || ''}`, true);
    });
  }

  async function verifyCard() {
    const expected = els.url.value.trim() || lastWrittenUrl;
    await withBusy(async () => {
      const data = await api('/verify', { method: 'POST', body: JSON.stringify({ url: expected }) });
      const match = data.match || (data.url && normalizeUrl(data.url) === normalizeUrl(expected));
      addLog(match ? 'Card verified successfully' : 'Verification mismatch', match ? data.url : `Found: ${data.url || 'no URL'}`, !!match);
    });
  }

  els.read.addEventListener('click', readCard);
  els.write.addEventListener('click', writeUrl);
  els.verify.addEventListener('click', verifyCard);
  els.auto.addEventListener('change', () => { autoArmed = true; });

  if (!IS_LOCAL_APP) {
    showHostedMessage();
    return;
  }

  els.hint.textContent = 'Checking the local NFC Bridge…';
  refreshStatus();
  setInterval(refreshStatus, 700);
})();
