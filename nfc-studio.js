(() => {
  'use strict';

  const BRIDGE = 'http://127.0.0.1:8765';
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

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const requestOptions = {
        ...options,
        mode: 'cors',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        signal: controller.signal,
        cache: 'no-store'
      };

      // Chromium Local Network Access: explicitly declare that this request targets
      // the computer's loopback address. Older browsers safely ignore this option.
      requestOptions.targetAddressSpace = 'loopback';

      const response = await fetch(BRIDGE + path, requestOptions);
      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error || `Bridge error ${response.status}`);
      return data;
    } finally { clearTimeout(timer); }
  }

  async function refreshStatus() {
    try {
      const data = await request('/status');
      bridgeOnline = true;
      cardPresent = !!data.cardPresent;
      els.module.textContent = cardPresent ? 'CARD READY' : 'READER READY';
      els.module.classList.toggle('ready', true);
      els.module.classList.toggle('standby', false);
      els.reader.textContent = data.reader || 'ACR122U connected';
      els.card.textContent = cardPresent ? 'Card detected' : 'Place a card on reader';
      els.uid.textContent = data.uid || '—';
      els.hint.innerHTML = cardPresent ? 'Reader and card are ready.' : 'Reader connected. Place one card in the center.';

      if (els.auto.checked) {
        if (!cardPresent) autoArmed = true;
        if (cardPresent && !previousPresent && autoArmed && !busy) {
          autoArmed = false;
          setTimeout(writeUrl, 180);
        }
      }
      previousPresent = cardPresent;
    } catch (_) {
      bridgeOnline = false; cardPresent = false; previousPresent = false;
      els.module.textContent = 'BRIDGE OFFLINE';
      els.module.classList.remove('ready'); els.module.classList.add('standby');
      els.reader.textContent = 'Waiting for bridge'; els.card.textContent = 'No card detected'; els.uid.textContent = '—';
      els.hint.innerHTML = 'Run <b>NFC-Bridge\\Start-NFC-Bridge.bat</b>. Keep the black PowerShell window open.';
    }
    setButtons();
  }

  async function withBusy(fn) {
    if (busy) return;
    busy = true; setButtons();
    try { await fn(); } catch (e) { addLog('Operation failed', e.message || String(e), false); }
    finally { busy = false; setButtons(); refreshStatus(); }
  }

  async function readCard() {
    await withBusy(async () => {
      const data = await request('/read');
      addLog('Card read successfully', data.url ? `URL: ${data.url}` : `UID: ${data.uid || 'unknown'}`);
      if (data.url) els.url.value = data.url;
    });
  }

  async function writeUrl() {
    const url = els.url.value.trim();
    if (!/^https?:\/\//i.test(url)) {
      addLog('Invalid website link', 'The link must begin with https:// or http://', false); return;
    }
    await withBusy(async () => {
      const data = await request('/write', { method: 'POST', body: JSON.stringify({ url }) });
      lastWrittenUrl = url;
      addLog('Website link written', `${url} · UID ${data.uid || ''}`);
    });
  }

  async function verifyCard() {
    const expected = els.url.value.trim() || lastWrittenUrl;
    await withBusy(async () => {
      const data = await request('/verify', { method: 'POST', body: JSON.stringify({ url: expected }) });
      addLog(data.match ? 'Card verified successfully' : 'Verification mismatch', data.match ? data.url : `Found: ${data.url || 'no URL'}`, !!data.match);
    });
  }

  els.read.addEventListener('click', readCard);
  els.write.addEventListener('click', writeUrl);
  els.verify.addEventListener('click', verifyCard);
  els.auto.addEventListener('change', () => { autoArmed = true; });
  refreshStatus();
  setInterval(refreshStatus, 900);
})();
