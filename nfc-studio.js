(() => {
  'use strict';

  const LOCAL_WRITER = 'http://127.0.0.1:8765/studio';
  const $ = id => document.getElementById(id);
  const els = {
    module: $('nfcModuleStatus'), reader: $('nfcReaderStatus'), card: $('nfcCardStatus'), uid: $('nfcCardUid'),
    url: $('nfcUrlInput'), auto: $('nfcAutoWrite'), read: $('nfcReadCardBtn'), write: $('nfcWriteCardBtn'),
    verify: $('nfcVerifyCardBtn'), log: $('nfcActivityLog'), hint: $('nfcBridgeHint')
  };
  if (!els.module) return;

  // Chromium blocks an HTTPS GitHub/PWA page from directly calling a local HTTP
  // loopback service on some installations. The reliable production workflow is
  // therefore to launch the same-origin Local NFC Writer served by the bridge.
  // This file intentionally does not poll 127.0.0.1, avoiding repeated CORS/PNA
  // errors and leaving every other platform module untouched.
  const disableRemoteActions = () => {
    els.read.disabled = true;
    els.write.disabled = true;
    els.verify.disabled = true;
    els.auto.disabled = true;
  };

  const openLocalWriter = () => {
    const win = window.open(LOCAL_WRITER, '_blank');
    if (!win) window.location.href = LOCAL_WRITER;
  };

  els.module.textContent = 'LOCAL WRITER';
  els.module.classList.remove('standby');
  els.module.classList.add('ready');
  els.reader.textContent = 'ACR122U via local bridge';
  els.card.textContent = 'Open the local writer to detect a card';
  els.uid.textContent = 'Shown in Local Writer';
  disableRemoteActions();

  els.hint.innerHTML = `
    <div style="display:grid;gap:10px">
      <span><b>Step 1:</b> Run <b>NFC-Bridge\\Start-NFC-Bridge.bat</b> and keep the black window open.</span>
      <button id="nfcOpenLocalWriter" type="button" style="border:0;border-radius:10px;padding:12px 14px;font-weight:800;background:#173b7a;color:#fff;cursor:pointer">Open Local NFC Writer</button>
      <small style="color:#667085">The local writer reads, writes, verifies and supports Auto-write without Edge blocking the reader.</small>
    </div>`;

  const openButton = document.getElementById('nfcOpenLocalWriter');
  if (openButton) openButton.addEventListener('click', openLocalWriter);

  els.log.className = 'nfc-log-entry';
  els.log.innerHTML = '<span style="display:inline-grid;place-items:center;width:32px;height:32px;border-radius:50%;background:#eaf2ff;color:#173b7a">↗</span><div><b>Local NFC Writer ready</b><small style="display:block;margin-top:4px;color:#7c8796">Start the bridge, then press Open Local NFC Writer.</small></div>';
})();
