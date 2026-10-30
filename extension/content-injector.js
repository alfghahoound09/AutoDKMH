/**
 * Auto DKMH VNU v2.0 - Content Script Injector & Isolated Storage Bridge
 * Tự động phân tách kho lưu trữ môn học giữa:
 * - Cổng thật (dangkyhoc.vnu.edu.vn) -> key: 'autodkmh_v2_queue_vnu'
 * - Localhost Test (localhost / 127.0.0.1) -> key: 'autodkmh_v2_queue_local'
 */
(async function () {
  'use strict';

  const isLocalHost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const STORAGE_KEY = isLocalHost ? 'autodkmh_v2_queue_local' : 'autodkmh_v2_queue_vnu';

  // 1. Inject page-bridge.js into Page Context
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('page-bridge.js');
  script.onload = function () {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);

  // 2. Listen for storage sync messages from page-bridge.js
  window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'AUTODKMH_PAGE') {
      return;
    }

    try {
      if (event.data.type === 'LOAD_QUEUE') {
        const stored = await chrome.storage.local.get(STORAGE_KEY);
        window.postMessage(
          {
            source: 'AUTODKMH_EXTENSION',
            type: 'QUEUE_LOADED',
            env: isLocalHost ? 'LOCAL_SANDBOX' : 'VNU_PROD',
            queue: Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : []
          },
          '*'
        );
      } else if (event.data.type === 'SAVE_QUEUE') {
        await chrome.storage.local.set({
          [STORAGE_KEY]: Array.isArray(event.data.queue) ? event.data.queue : []
        });
      }
    } catch (err) {
      console.error('AutoDKMH storage sync error:', err);
    }
  });
})();
