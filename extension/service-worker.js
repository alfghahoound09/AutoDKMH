/**
 * Auto DKMH VNU v2.0 - Manifest V3 Service Worker
 * Phân tách rõ trạng thái hoạt động trên Cổng thật (dangkyhoc.vnu.edu.vn) và Localhost Sandbox
 */

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  try {
    const url = new URL(tab.url);
    const isVnuProd = url.hostname.endsWith('dangkyhoc.vnu.edu.vn');
    const isLocalTest =
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      (url.pathname.startsWith('/dang-ky-mon-hoc') || url.pathname.startsWith('/dang-nhap'));

    if (isVnuProd) {
      await chrome.action.setBadgeText({ tabId, text: 'VNU' });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#10B981' });
    } else if (isLocalTest) {
      await chrome.action.setBadgeText({ tabId, text: 'DEV' });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#F59E0B' });
    } else {
      await chrome.action.setBadgeText({ tabId, text: '' });
    }
  } catch (err) {
    console.error('AutoDKMH badge update failed:', err);
  }
});

chrome.action.onClicked.addListener(async () => {
  try {
    await chrome.tabs.create({ url: 'https://duclvz.github.io/AutoDKMH' });
  } catch (err) {
    console.error('AutoDKMH failed to open page:', err);
  }
});
