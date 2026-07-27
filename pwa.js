(() => {
  'use strict';

  const installButton = document.getElementById('installAppBtn');
  let deferredInstallPrompt = null;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  function updateInstallButton() {
    if (!installButton) return;
    installButton.hidden = isStandalone() || !deferredInstallPrompt;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallButton();
  });

  installButton?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    installButton.disabled = true;
    try {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
    } finally {
      deferredInstallPrompt = null;
      installButton.disabled = false;
      updateInstallButton();
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallButton();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
        registration.update().catch(() => {});
      } catch (error) {
        console.error('PWA service worker registration failed:', error);
      }
    });
  }

  updateInstallButton();
})();
