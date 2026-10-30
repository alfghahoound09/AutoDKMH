/**
 * Auto DKMH VNU v2.0 - Page Bridge & Shadow DOM Floating Command Panel
 * Features:
 * - Solution 1: Proactive Anti-Kick Defense (Canary Probe + Silent Session Heartbeat + Human Jitter)
 * - Pinned Course Burst Multiplier (Ghim môn x10 / x25 / x50 / x100 + Pipelined Burst + Instant Early-Commit)
 */
(function () {
  'use strict';

  if (window.location.pathname === '/landing') return;

  const REQUEST_TIMEOUT_MS = 6000; // Cắt kết nối treo sau 6s
  const HEARTBEAT_INTERVAL_MS = 180000; // 3 phút ping nhẹ giữ phiên 1 lần
  const BURST_PRESETS = [50, 100, 150, 1]; // Nút chọn nhanh số lần bắn nền trong Auto (Mặc định: 50)
  const MIN_BURST = 1;
  const MAX_BURST = 1000;
  const BURST_CONCURRENCY = 4; // Số luồng song song trong 1 đợt bắn nền

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Chỉ coi là trang sập 503 / ASP.NET Error khi KHÔNG có bảng môn học #divDSDK và nội dung trang ngắn chứa thông báo lỗi
  function isPageCrashed503() {
    if (!document.body) return false;
    if (document.querySelector('#divDSDK') || document.querySelector('#main-nav')) {
      return false;
    }
    const text = document.body.innerText ? document.body.innerText.trim() : '';
    return (
      text.length < 600 &&
      (text.includes('The service is unavailable') ||
        text.includes('Service Unavailable') ||
        text.includes('An error occurred while processing your request') ||
        text.includes('502 Bad Gateway') ||
        text.includes('Server Error in'))
    );
  }

  function isResponse503OrHtmlError(status, text) {
    if (status >= 500 || status === 429 || status === 0) return true;
    if (!text) return false;
    return (
      text.includes('The service is unavailable') ||
      text.includes('Service Unavailable') ||
      text.includes('An error occurred while processing your request') ||
      text.includes('502 Bad Gateway') ||
      text.includes('Runtime Error')
    );
  }

  function isResponsePortalLocked(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return (
      text.includes('Đang khóa đăng ký học') ||
      lower.includes('ngoài thời hạn đăng ký') ||
      lower.includes('chưa đến thời gian đăng ký') ||
      lower.includes('ngoài thời gian đăng ký')
    );
  }

  function isResponseSessionExpired(response, text) {
    if (response && response.redirected && response.url && response.url.includes('dang-nhap')) {
      return true;
    }
    if (!text) return false;
    return (
      text.includes('Đăng nhập hệ thống') ||
      text.includes('Quay lại sau:') ||
      text.includes('giới hạn số người truy cập tối đa') ||
      text.includes('cf-turnstile')
    );
  }

  // =========================================================================
  // 1. UNLOCK VNU PORTAL CLIENT RESTRICTIONS
  // =========================================================================
  try {
    window.$registrationMode = '1';
    window.$registrationAvailable = 'true';
    if (window.App && typeof window.App.blockUI === 'function') {
      window.App.blockUI = function () {};
    }
    window.CheckConflict = function () {};
  } catch (err) {
    console.warn('AutoDKMH: Portal globals not initialized yet', err);
  }

  if (window.jQuery) {
    const $ = window.jQuery;
    if ($('.confirm-registration').length === 0 && $('.col-md-offset-0').length > 0) {
      const confirmBtn = document.createElement('button');
      confirmBtn.style.marginBottom = '5px';
      confirmBtn.className = 'btn btn-success confirm-registration';
      confirmBtn.innerHTML = '<i class="icon-save"></i> Ghi nhận';
      $('.col-md-offset-0').append(confirmBtn);
    }
  }

  // =========================================================================
  // 2. ANTI-503 PAGE RECOVERY BANNER
  // =========================================================================
  let recoveryPoller = null;
  let recoveryCount = 0;

  function mount503RecoveryOverlay() {
    if (!isPageCrashed503() || document.getElementById('autodkmh-503-recovery')) return;

    const banner = document.createElement('div');
    banner.id = 'autodkmh-503-recovery';
    banner.style.cssText =
      'margin:24px auto;max-width:720px;padding:20px 24px;border-radius:12px;background:#111827;color:#F8FAFC;border:1px solid #EF4444;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;box-shadow:0 20px 40px rgba(0,0,0,0.45);';

    banner.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;">
        <strong style="color:#EF4444;font-size:16px;">🔥 Cổng VNU đang báo: "The service is unavailable." (IIS 503 Overload)</strong>
        <span id="autodkmh-503-ping-status" style="padding:3px 10px;border-radius:999px;background:rgba(6,182,212,0.18);color:#06B6D4;font-size:12px;font-weight:700;">Đang chờ lệnh</span>
      </div>
      <p style="margin:0 0 14px;color:#94A3B8;font-size:13.5px;line-height:1.55;">
        1. <strong>Đừng lo!</strong> Cookie phiên đăng nhập của bạn trên trình duyệt vẫn còn nguyên.<br>
        2. Bạn <strong>không cần chờ giao diện web hiện lại</strong>: Hãy dùng ngay bảng <strong>Auto DKMH VNU v2.0</strong> ở góc phải dưới để bắn thẳng API đăng ký ngầm!<br>
        3. Hoặc bấm nút bên dưới để tool tự động ping nhẹ kiểm tra ngầm mỗi 3 giây và tự khôi phục trang ngay khi server VNU hết báo <code>The service is unavailable.</code>
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button type="button" id="autodkmh-btn-recover" style="padding:8px 16px;border-radius:8px;border:none;background:#10B981;color:#090D16;font-weight:700;font-size:13px;cursor:pointer;">
          🔄 Tự động dò & Khôi phục trang ĐKMH (3s/lần)
        </button>
        <a href="/dang-ky-mon-hoc-nganh-1" style="padding:8px 14px;border-radius:8px;border:1px solid #334155;background:#1E293B;color:#F8FAFC;text-decoration:none;font-weight:600;font-size:13px;">
          👉 Vào thẳng /dang-ky-mon-hoc-nganh-1
        </a>
      </div>
    `;

    document.body.appendChild(banner);

    const recoverBtn = document.getElementById('autodkmh-btn-recover');
    const pingStatus = document.getElementById('autodkmh-503-ping-status');

    recoverBtn.addEventListener('click', () => {
      if (recoveryPoller) {
        clearInterval(recoveryPoller);
        recoveryPoller = null;
        recoverBtn.textContent = '🔄 Tự động dò & Khôi phục trang ĐKMH (3s/lần)';
        pingStatus.textContent = 'Đã tạm dừng';
        return;
      }

      recoverBtn.textContent = '⏹ Dừng tự động dò';
      const targetUrl = window.location.pathname || '/dang-ky-mon-hoc-nganh-1';
      const checkServerAlive = async () => {
        recoveryCount += 1;
        pingStatus.textContent = `Đang ping thử ${targetUrl} (#${recoveryCount})...`;
        try {
          const res = await fetch(targetUrl, {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store'
          });
          const html = await res.text();
          if (res.ok && !isResponse503OrHtmlError(res.status, html)) {
            clearInterval(recoveryPoller);
            pingStatus.textContent = '✅ Cổng đã sống lại! Đang mở...';
            window.location.href = targetUrl;
          } else {
            pingStatus.textContent = `🔥 Vẫn lỗi 503/Error (Lần #${recoveryCount}) - Đợi 3s...`;
          }
        } catch (e) {
          pingStatus.textContent = `🔥 Mạng nghẽn (Lần #${recoveryCount}) - Đợi 3s...`;
        }
      };

      checkServerAlive();
      recoveryPoller = setInterval(checkServerAlive, 3000);
    });
  }

  mount503RecoveryOverlay();

  // =========================================================================
  // 3. STATE, QUEUE & BACKGROUND AUTO BURST (MẶC ĐỊNH 50 LẦN, MIN 1 - MAX 1000)
  // =========================================================================
  let queue = [];
  let isProcessing = false;
  let autoTimer = null;
  let intervalSec = 2;
  let globalBurstCount = 50; // Mặc định bắn nền 50 lần trong Auto (min 1, max 1000)
  let canaryModeEnabled = true;
  let heartbeatEnabled = true;
  let heartbeatTimer = null;
  let consecutiveOverloads = 0;

  function clampBurst(val) {
    const num = parseInt(val, 10);
    if (Number.isNaN(num)) return 50;
    return Math.min(MAX_BURST, Math.max(MIN_BURST, num));
  }

  function saveQueue() {
    const cleanQueue = queue.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      status: item.status === 'sending' || item.status === 'shielded' ? 'idle' : item.status,
      pingMs: item.pingMs || 0,
      attempts: item.attempts || 0,
      burstProgress: 0
    }));
    window.postMessage({ source: 'AUTODKMH_PAGE', type: 'SAVE_QUEUE', queue: cleanQueue }, '*');
  }

  // =========================================================================
  // 4. SHADOW DOM FLOATING PANEL UI (Obsidian Slate & VNU Emerald)
  // =========================================================================
  const host = document.createElement('div');
  host.id = 'autodkmh-v2-host';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host {
      --bg-canvas: #090D16;
      --bg-surface-1: #111827;
      --bg-surface-2: #1E293B;
      --border-subtle: #1F2937;
      --border-highlight: #334155;
      --text-primary: #F8FAFC;
      --text-secondary: #94A3B8;
      --text-muted: #64748B;
      --accent-primary: #10B981;
      --accent-secondary: #06B6D4;
      --status-warning: #F59E0B;
      --status-danger: #EF4444;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .panel {
      position: fixed;
      bottom: 18px;
      right: 18px;
      width: 435px;
      max-width: calc(100vw - 24px);
      background: var(--bg-surface-1);
      color: var(--text-primary);
      border: 1px solid var(--border-highlight);
      border-radius: 14px;
      box-shadow: 0 22px 45px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(16, 185, 129, 0.22);
      z-index: 2147483647;
      overflow: hidden;
    }

    .panel.minimized .panel-body {
      display: none;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: var(--bg-canvas);
      border-bottom: 1px solid var(--border-subtle);
      user-select: none;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 7px;
      font-weight: 700;
      font-size: 13px;
    }

    .brand-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      color: var(--bg-canvas);
      font-size: 12px;
    }

    .version-pill {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.16);
      color: var(--accent-primary);
      border: 1px solid rgba(16, 185, 129, 0.35);
    }

    .env-pill {
      font-size: 9.5px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 999px;
      letter-spacing: 0.3px;
    }

    .env-pill.vnu {
      background: rgba(6, 182, 212, 0.16);
      color: var(--accent-secondary);
      border: 1px solid rgba(6, 182, 212, 0.45);
    }

    .env-pill.local {
      background: rgba(245, 158, 11, 0.18);
      color: var(--status-warning);
      border: 1px solid rgba(245, 158, 11, 0.45);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .toggle-btn {
      background: var(--bg-surface-2);
      border: 1px solid var(--border-highlight);
      color: var(--text-secondary);
      border-radius: 6px;
      padding: 2px 8px;
      font-size: 11px;
      cursor: pointer;
    }

    .panel-body {
      padding: 12px 14px;
    }

    .shield-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 6px 9px;
      margin-bottom: 10px;
      border-radius: 8px;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      font-size: 11px;
    }

    .shield-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 7px;
      border-radius: 6px;
      border: 1px solid var(--border-highlight);
      background: var(--bg-surface-2);
      color: var(--text-secondary);
      cursor: pointer;
      user-select: none;
      font-weight: 600;
      transition: all 0.15s ease;
    }

    .shield-chip.active {
      border-color: rgba(16, 185, 129, 0.5);
      background: rgba(16, 185, 129, 0.14);
      color: var(--accent-primary);
    }

    .input-row {
      display: flex;
      gap: 5px;
      margin-bottom: 10px;
    }

    .input-row input {
      flex: 1;
      min-width: 0;
      padding: 7px 9px;
      border-radius: 8px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-canvas);
      color: var(--text-primary);
      font-size: 12px;
      outline: none;
    }

    .input-row input:focus {
      border-color: var(--accent-secondary);
    }

    .burst-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 6px 9px;
      margin-bottom: 10px;
      border-radius: 8px;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      font-size: 11.5px;
    }

    .burst-label {
      color: var(--text-secondary);
      font-weight: 600;
      white-space: nowrap;
    }

    .burst-presets {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .burst-btn {
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid var(--border-highlight);
      background: var(--bg-surface-2);
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .burst-btn:hover {
      border-color: var(--status-warning);
      color: var(--status-warning);
    }

    .burst-btn.active {
      background: rgba(245, 158, 11, 0.2);
      border-color: var(--status-warning);
      color: var(--status-warning);
    }

    .burst-input {
      width: 58px;
      padding: 3px 6px;
      border-radius: 6px;
      border: 1px solid var(--border-highlight);
      background: var(--bg-surface-2);
      color: var(--status-warning);
      font-size: 11.5px;
      font-weight: 700;
      text-align: center;
      outline: none;
    }

    .burst-input:focus {
      border-color: var(--status-warning);
    }

    .btn-add {
      padding: 7px 11px;
      border-radius: 8px;
      border: 1px solid var(--border-highlight);
      background: var(--bg-surface-2);
      color: var(--text-primary);
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
    }

    .btn-add:hover {
      border-color: var(--accent-primary);
      color: var(--accent-primary);
    }

    .queue-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 230px;
      overflow-y: auto;
      margin-bottom: 10px;
    }

    .queue-empty {
      padding: 14px;
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      border: 1px dashed var(--border-subtle);
      border-radius: 8px;
    }

    .queue-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 7px 9px;
      border-radius: 8px;
      background: var(--bg-surface-2);
      border: 1px solid var(--border-highlight);
      font-size: 12px;
      transition: all 0.15s ease;
    }

    .queue-card.is-pinned {
      background: linear-gradient(90deg, rgba(245, 158, 11, 0.14), var(--bg-surface-2) 65%);
      border-color: rgba(245, 158, 11, 0.65);
    }

    .queue-card.status-sending { border-color: var(--accent-secondary); }
    .queue-card.status-selected,
    .queue-card.status-confirmed { border-color: var(--accent-primary); }
    .queue-card.status-full { border-color: var(--status-warning); }
    .queue-card.status-shielded { border-color: #334155; opacity: 0.85; }
    .queue-card.status-overload,
    .queue-card.status-expired { border-color: var(--status-danger); }

    .card-left {
      display: flex;
      align-items: center;
      gap: 5px;
      min-width: 0;
    }

    .canary-tag {
      font-size: 10px;
      padding: 1px 4px;
      border-radius: 4px;
      background: rgba(6, 182, 212, 0.18);
      color: var(--accent-secondary);
      border: 1px solid rgba(6, 182, 212, 0.35);
      font-weight: 700;
      flex-shrink: 0;
    }

    .pin-btn {
      padding: 3px 7px;
      border-radius: 5px;
      border: 1px solid var(--border-highlight);
      background: var(--bg-canvas);
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 0.15s ease;
    }

    .pin-btn:hover {
      border-color: var(--status-warning);
      color: var(--status-warning);
    }

    .pin-btn.pinned {
      background: rgba(245, 158, 11, 0.22);
      border-color: var(--status-warning);
      color: var(--status-warning);
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.3);
    }

    .row-id {
      color: var(--accent-secondary);
      font-family: monospace;
      font-weight: 700;
      flex-shrink: 0;
    }

    .course-code {
      font-weight: 700;
      color: var(--text-primary);
      white-space: nowrap;
    }

    .course-name {
      color: var(--text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .card-right {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .badge {
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 10.5px;
      font-weight: 600;
      white-space: nowrap;
    }

    .badge-idle { background: var(--bg-canvas); color: var(--text-secondary); }
    .badge-sending { background: rgba(6, 182, 212, 0.2); color: var(--accent-secondary); }
    .badge-selected,
    .badge-confirmed { background: rgba(16, 185, 129, 0.2); color: var(--accent-primary); }
    .badge-full { background: rgba(245, 158, 11, 0.2); color: var(--status-warning); }
    .badge-shielded { background: var(--bg-canvas); color: var(--text-secondary); }
    .badge-overload,
    .badge-expired { background: rgba(239, 68, 68, 0.2); color: var(--status-danger); }

    .btn-del {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 14px;
      cursor: pointer;
      padding: 0 3px;
    }
    .btn-del:hover { color: var(--status-danger); }

    .controls {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-bottom: 8px;
    }

    .btn-main {
      flex: 1;
      padding: 8px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid transparent;
      cursor: pointer;
    }

    .btn-fast {
      background: var(--accent-primary);
      color: var(--bg-canvas);
    }

    .btn-auto {
      background: rgba(6, 182, 212, 0.16);
      color: var(--accent-secondary);
      border-color: rgba(6, 182, 212, 0.45);
    }
    .btn-auto.active {
      background: var(--accent-secondary);
      color: var(--bg-canvas);
    }

    .interval-input {
      width: 46px;
      padding: 7px 5px;
      border-radius: 8px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-canvas);
      color: var(--text-primary);
      font-size: 12px;
      text-align: center;
    }

    .toast {
      padding: 7px 9px;
      border-radius: 8px;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      font-size: 11.5px;
      line-height: 1.45;
    }
  `;

  const isLocalEnv =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  const envBadgeClass = isLocalEnv ? 'local' : 'vnu';
  const envBadgeText = isLocalEnv ? '🧪 LOCAL' : '🎓 VNU LIVE';
  const envBadgeTitle = isLocalEnv
    ? 'Môi trường Localhost Sandbox (tách biệt bộ nhớ với cổng VNU thật)'
    : 'Cổng đăng ký học chính thức ĐHQGHN (dangkyhoc.vnu.edu.vn)';

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="panel-header">
      <div class="brand">
        <span class="brand-icon">⚡</span>
        <span>Auto DKMH VNU</span>
        <span class="version-pill">v2.0</span>
        <span class="env-pill ${envBadgeClass}" title="${envBadgeTitle}">${envBadgeText}</span>
      </div>
      <div class="header-actions">
        <button type="button" class="toggle-btn" id="reset-status-btn" title="Đặt lại trạng thái các môn về Sẵn sàng">↺</button>
        <button type="button" class="toggle-btn" id="minimize-btn">Thu gọn</button>
      </div>
    </div>
    <div class="panel-body">
      <div class="shield-bar">
        <button type="button" class="shield-chip active" id="canary-toggle" title="Chỉ bắn 1 request thăm dò khi cổng đang khóa/503 để chống văng phiên">
          🐦 Chim Mồi (Canary): BẬT
        </button>
        <button type="button" class="shield-chip active" id="heartbeat-toggle" title="Tự động ping nhẹ mỗi 3 phút để nuôi sống ASP.NET_SessionId">
          💓 Giữ phiên 3p: BẬT
        </button>
      </div>
      <div class="burst-bar">
        <span class="burst-label" title="Số lần bắn nền tự động cho mỗi môn trong Auto (Min: 1, Max: 1000)">🎯 Ghim môn:</span>
        <div class="burst-presets">
          <button type="button" class="burst-btn active" data-burst="50">50</button>
          <button type="button" class="burst-btn" data-burst="100">100</button>
          <button type="button" class="burst-btn" data-burst="150">150</button>
          <button type="button" class="burst-btn" data-burst="1">1</button>
          <input type="number" class="burst-input" id="burst-input" value="50" min="1" max="1000" title="Nhập số lần bắn nền (Min: 1 - Max: 1000)" />
        </div>
      </div>
      <div class="input-row">
        <input type="text" id="course-input" placeholder="Nhập mã môn (VD: 926 hoặc UET.CS2046 7)..." />
        <button type="button" class="btn-add" id="add-btn">+ Thêm</button>
      </div>
      <div class="queue-list" id="queue-list"></div>
      <div class="controls">
        <button type="button" class="btn-main btn-fast" id="fast-btn">⚡ Đăng Ký Nhanh</button>
        <button type="button" class="btn-main btn-auto" id="auto-btn">🔁 Auto</button>
        <input type="number" class="interval-input" id="interval-input" value="2" min="1" max="60" title="Chu kỳ Auto (giây)" />
      </div>
      <div class="toast" id="toast-box">
        🎯 <strong>Auto chạy nền:</strong> Mặc định bắn <strong>50 lần/môn</strong> (có thể chọn nhanh <strong>50 / 100 / 150 / 1</strong> hoặc nhập <strong>1–1000</strong>) và tự động chốt đơn ngay khi trúng slot!
      </div>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(panel);

  const canaryToggle = shadow.getElementById('canary-toggle');
  const heartbeatToggle = shadow.getElementById('heartbeat-toggle');
  const resetStatusBtn = shadow.getElementById('reset-status-btn');
  const minimizeBtn = shadow.getElementById('minimize-btn');
  const burstInput = shadow.getElementById('burst-input');
  const burstBtns = Array.from(shadow.querySelectorAll('.burst-btn'));
  const courseInput = shadow.getElementById('course-input');
  const addBtn = shadow.getElementById('add-btn');
  const queueListEl = shadow.getElementById('queue-list');
  const fastBtn = shadow.getElementById('fast-btn');
  const autoBtn = shadow.getElementById('auto-btn');
  const intervalInput = shadow.getElementById('interval-input');
  const toastBox = shadow.getElementById('toast-box');

  function setToast(html) {
    toastBox.innerHTML = html;
  }

  function syncBurstUI(newVal) {
    globalBurstCount = clampBurst(newVal);
    burstInput.value = String(globalBurstCount);
    burstBtns.forEach((btn) => {
      btn.classList.toggle('active', parseInt(btn.dataset.burst, 10) === globalBurstCount);
    });
    renderQueue();
  }

  burstBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      syncBurstUI(btn.dataset.burst);
      setToast(
        `🎯 Đã đặt chế độ <strong>Ghim bắn nền Auto = ${globalBurstCount} lần/môn</strong> (Min: 1, Max: 1000).`
      );
    });
  });

  burstInput.addEventListener('change', () => {
    syncBurstUI(burstInput.value);
    setToast(
      `🎯 Đã đặt chế độ <strong>Ghim bắn nền Auto = ${globalBurstCount} lần/môn</strong> (Min: 1, Max: 1000).`
    );
  });

  canaryToggle.addEventListener('click', () => {
    canaryModeEnabled = !canaryModeEnabled;
    canaryToggle.classList.toggle('active', canaryModeEnabled);
    canaryToggle.textContent = canaryModeEnabled
      ? '🐦 Chim Mồi (Canary): BẬT'
      : '🐦 Chim Mồi (Canary): TẮT';
    renderQueue();
  });

  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (!heartbeatEnabled) return;

    heartbeatTimer = setInterval(async () => {
      if (isProcessing || autoBtn.classList.contains('active')) return;
      try {
        const res = await fetch('/dang-ky-mon-hoc-nganh-1', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store'
        });
        const text = await res.text();
        if (isResponseSessionExpired(res, text)) {
          setToast('⚠️ <strong>Cảnh báo:</strong> Phiên đăng nhập đã hết hạn! Hãy kiểm tra lại trước giờ mở cổng.');
        } else {
          const nowStr = new Date().toLocaleTimeString('vi-VN');
          setToast(`💓 <strong>Keep-Alive (${nowStr}):</strong> Đã tự động làm mới phiên đăng nhập ngầm!`);
        }
      } catch (e) {}
    }, HEARTBEAT_INTERVAL_MS + Math.floor(Math.random() * 12000));
  }

  heartbeatToggle.addEventListener('click', () => {
    heartbeatEnabled = !heartbeatEnabled;
    heartbeatToggle.classList.toggle('active', heartbeatEnabled);
    heartbeatToggle.textContent = heartbeatEnabled ? '💓 Giữ phiên 3p: BẬT' : '💓 Giữ phiên 3p: TẮT';
    startHeartbeat();
  });

  startHeartbeat();

  minimizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isMin = panel.classList.toggle('minimized');
    minimizeBtn.textContent = isMin ? 'Mở rộng' : 'Thu gọn';
  });

  resetStatusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    consecutiveOverloads = 0;
    queue.forEach((item) => {
      item.status = 'idle';
      item.attempts = 0;
      item.pingMs = 0;
      item.burstProgress = 0;
    });
    saveQueue();
    renderQueue();
    setToast('↺ Đã đặt lại trạng thái tất cả các môn về <strong>⏳ Sẵn sàng</strong>.');
  });

  function renderQueue() {
    queueListEl.innerHTML = '';
    if (queue.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'queue-empty';
      empty.textContent = 'Danh sách trống. Hãy bấm nút "+Auto" cạnh môn học trên bảng hoặc nhập mã môn bên trên!';
      queueListEl.appendChild(empty);
      return;
    }

    const firstUnconfirmedIdx = queue.findIndex((q) => q.status !== 'confirmed');

    queue.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'queue-card status-' + item.status;

      const isCanary = canaryModeEnabled && queue.length > 1 && idx === firstUnconfirmedIdx;

      const left = document.createElement('div');
      left.className = 'card-left';

      const infoSpan = document.createElement('span');
      infoSpan.style.cssText = 'display:flex;align-items:center;gap:5px;min-width:0;overflow:hidden;';
      infoSpan.innerHTML =
        (isCanary ? '<span class="canary-tag" title="Môn Chim Mồi đi đầu thăm dò cổng">🐦 Mồi</span>' : '') +
        `<span class="row-id">#${item.id}</span>` +
        `<span class="course-code">${item.code || ''}</span>` +
        `<span class="course-name">${item.name || ''}</span>`;
      left.appendChild(infoSpan);

      const right = document.createElement('div');
      right.className = 'card-right';

      const badge = document.createElement('span');
      badge.className = 'badge badge-' + item.status;
      if (item.status === 'idle') {
        badge.textContent = `⏳ Sẵn sàng (x${globalBurstCount})`;
      } else if (item.status === 'sending') {
        if (globalBurstCount > 1 && item.burstProgress > 0) {
          badge.textContent = `🎯 Bắn ${item.burstProgress}/${globalBurstCount} (${item.pingMs}ms)`;
        } else {
          badge.textContent = `🔄 Đang gửi... (${item.pingMs}ms)`;
        }
      } else if (item.status === 'selected') {
        badge.textContent = `☑️ Trúng slot! (${item.pingMs}ms)`;
      } else if (item.status === 'confirmed') {
        badge.textContent = `✅ Đã ghi nhận (${item.pingMs}ms)`;
      } else if (item.status === 'full') {
        badge.textContent = `⚠️ Đầy (#${item.attempts} req)`;
      } else if (item.status === 'shielded') {
        badge.textContent = '🛡️ Chờ Chim Mồi';
      } else if (item.status === 'overload') {
        badge.textContent = `🔥 Cổng khóa/503 (#${item.attempts})`;
      } else if (item.status === 'expired') {
        badge.textContent = '❌ Văng phiên!';
      }

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-del';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', () => {
        queue = queue.filter((q) => q.id !== item.id);
        saveQueue();
        renderQueue();
      });

      right.appendChild(badge);
      right.appendChild(delBtn);
      card.appendChild(left);
      card.appendChild(right);
      queueListEl.appendChild(card);
    });
  }

  function ensureAllRowsHaveRowIndex() {
    const rows = Array.from(document.querySelectorAll('#divDSDK table tbody tr'));
    if (rows.length === 0) return rows;

    // Pass 1: Đọc data-rowindex từ input.order hoặc data-rowindex trên tr
    let lastKnownIdx = null;
    rows.forEach((tr) => {
      const orderInput = tr.querySelector('.order');
      const existingIdx =
        (orderInput && orderInput.getAttribute('data-rowindex')) ||
        tr.getAttribute('data-rowindex');
      if (existingIdx) {
        tr.setAttribute('data-rowindex', existingIdx);
        const parsed = parseInt(existingIdx, 10);
        if (!Number.isNaN(parsed)) lastKnownIdx = parsed;
      } else if (lastKnownIdx !== null) {
        // Tự động nội suy mã số cho các lớp đã FULL (VNU ẩn thẻ input.order khi ĐK >= Tổng)
        lastKnownIdx += 1;
        tr.setAttribute('data-rowindex', String(lastKnownIdx));
      }
    });

    // Pass 2: Ngược từ dưới lên cho các lớp đầu bảng bị full (nếu có)
    let nextKnownIdx = null;
    for (let i = rows.length - 1; i >= 0; i--) {
      const tr = rows[i];
      const idxStr = tr.getAttribute('data-rowindex');
      if (idxStr) {
        const parsed = parseInt(idxStr, 10);
        if (!Number.isNaN(parsed)) nextKnownIdx = parsed;
      } else if (nextKnownIdx !== null && nextKnownIdx > 1) {
        nextKnownIdx -= 1;
        tr.setAttribute('data-rowindex', String(nextKnownIdx));
      }
    }

    return rows;
  }

  function extractRowCourseMeta(tr) {
    const cells = tr ? tr.querySelectorAll('td') : [];
    const rowIdx =
      tr.getAttribute('data-rowindex') ||
      (tr.querySelector('.order') && tr.querySelector('.order').getAttribute('data-rowindex')) ||
      '';
    if (cells.length < 5) {
      return { rowIdx, courseCode: '', courseName: '' };
    }
    const cell2Text = cells[2].textContent.trim();
    const isRealVnuLayout = /^\d+$/.test(cell2Text);
    const courseName = isRealVnuLayout
      ? cells[1].textContent.trim()
      : cells[2].textContent.trim();
    const courseCode = cells[4].textContent.trim();
    return { rowIdx, courseCode, courseName };
  }

  function resolveCourseFromDOM(rawInput) {
    const clean = rawInput.trim();
    if (!clean) return null;

    const rows = ensureAllRowsHaveRowIndex();
    for (let i = 0; i < rows.length; i++) {
      const { rowIdx, courseCode, courseName } = extractRowCourseMeta(rows[i]);
      if (
        (rowIdx && rowIdx === clean) ||
        (courseCode && courseCode.toLowerCase() === clean.toLowerCase())
      ) {
        return {
          id: rowIdx || clean,
          code: courseCode || ('Môn #' + rowIdx),
          name: courseName
        };
      }
    }

    return {
      id: clean,
      code: 'Mã #' + clean,
      name: 'Gửi trực tiếp qua API'
    };
  }

  function addCourseItem(courseObj) {
    if (!courseObj || !courseObj.id) return;
    const existing = queue.find((q) => q.id === courseObj.id);
    if (existing) {
      setToast(
        `ℹ️ Môn <strong>${existing.code}</strong> (#${existing.id}) đã có trong danh sách Auto (Bắn nền x${globalBurstCount} lần).`
      );
      return;
    }

    queue.push({
      id: courseObj.id,
      code: courseObj.code || '',
      name: courseObj.name || '',
      status: 'idle',
      pingMs: 0,
      attempts: 0,
      burstProgress: 0
    });
    saveQueue();
    renderQueue();
  }

  addBtn.addEventListener('click', () => {
    const raw = courseInput.value.trim();
    if (!raw) return;
    const parts = raw.split(/[\n,;]+/);

    parts.forEach((p) => {
      const resolved = resolveCourseFromDOM(p);
      if (resolved) {
        addCourseItem(resolved);
      }
    });

    courseInput.value = '';
  });

  courseInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addBtn.click();
    }
  });

  // =========================================================================
  // 5. BATCHED DOM ENHANCEMENT ON VNU TABLE (CHỈ GẮN MÃ SỐ & NÚT "+Auto")
  // =========================================================================
  async function enhanceCourseTable() {
    const rows = ensureAllRowsHaveRowIndex();
    if (rows.length === 0) return;
    const BATCH = 20;

    for (let i = 0; i < rows.length; i += BATCH) {
      await new Promise((resolve) =>
        requestAnimationFrame(() => {
          rows.slice(i, i + BATCH).forEach((tr) => {
            if (tr.dataset.autodkmhEnhanced === '1') return;
            const firstCell = tr.querySelector('td');
            const rowIndex = tr.getAttribute('data-rowindex');
            if (!firstCell || !rowIndex) return;

            tr.dataset.autodkmhEnhanced = '1';
            firstCell.style.whiteSpace = 'nowrap';

            const badge = document.createElement('span');
            badge.style.cssText =
              'margin-left:3px;padding:1px 4px;border-radius:3px;background:#1E293B;color:#06B6D4;font-family:monospace;font-size:11px;font-weight:bold;';
            badge.textContent = rowIndex;

            const quickBtn = document.createElement('button');
            quickBtn.type = 'button';
            quickBtn.style.cssText =
              'margin-left:3px;padding:1px 6px;border-radius:3px;border:1px solid #10B981;background:#090D16;color:#10B981;font-size:10.5px;font-weight:600;cursor:pointer;';
            quickBtn.textContent = '+Auto';
            quickBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              const resolved = resolveCourseFromDOM(rowIndex);
              addCourseItem(resolved);
              setToast(
                `➕ Đã thêm <strong>${resolved.code}</strong> (#${rowIndex}) vào Auto (Chạy nền x${globalBurstCount} lần).`
              );
            });

            const orderInput = firstCell.querySelector('.order');
            if (orderInput) {
              orderInput.after(quickBtn);
              orderInput.after(badge);
            } else {
              firstCell.appendChild(badge);
              firstCell.appendChild(quickBtn);
            }
          });
          resolve();
        })
      );
    }
  }

  window.successCallback1 = function (htmlContent) {
    if (window.jQuery) {
      window.jQuery('#divDSDK table tbody').html(htmlContent);
    }
    enhanceCourseTable();
  };

  // Gắn nút ngay lập tức trên bảng hiện có và theo dõi mọi thay đổi của #divDSDK
  enhanceCourseTable();

  const dsdkContainer = document.querySelector('#divDSDK');
  if (dsdkContainer) {
    const observer = new MutationObserver(() => {
      enhanceCourseTable();
    });
    observer.observe(dsdkContainer, { childList: true, subtree: true });
  }

  // =========================================================================
  // 6. ENGINE: CANARY PROBE + PINNED BURST MULTIPLIER (x10 - x100) + EARLY COMMIT
  // =========================================================================
  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  async function sendSinglePacket(item) {
    const regMode = window.$registrationMode || '1';
    const dsdkMod = window.$dsdkMod || '1';
    const url = `/chon-mon-hoc/${encodeURIComponent(item.id)}/${regMode}/${dsdkMod}`;

    const start = performance.now();
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        },
        REQUEST_TIMEOUT_MS
      );

      const bodyText = await response.text();
      item.pingMs = Math.floor(performance.now() - start);
      item.attempts += 1;

      if (isResponseSessionExpired(response, bodyText)) {
        return 'SESSION_EXPIRED';
      }

      if (isResponse503OrHtmlError(response.status, bodyText) || isResponsePortalLocked(bodyText)) {
        return 'PORTAL_BLOCKED';
      }

      if (response.ok) {
        window.dispatchEvent(new CustomEvent('autodkmh:selected', { detail: { id: item.id } }));
        return 'SELECTED';
      } else {
        return 'CLASS_FULL';
      }
    } catch (err) {
      item.pingMs = Math.floor(performance.now() - start);
      item.attempts += 1;
      return 'PORTAL_BLOCKED';
    }
  }

  async function commitSelectedCoursesImmediately() {
    const hasSelected = queue.some((q) => q.status === 'selected');
    if (!hasSelected) return false;

    try {
      const regMode = window.$registrationMode || '1';
      const confirmRes = await fetchWithTimeout(
        `/xac-nhan-dang-ky/${regMode}`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        },
        REQUEST_TIMEOUT_MS
      );

      const confirmText = await confirmRes.text();
      if (confirmRes.ok && !isResponse503OrHtmlError(confirmRes.status, confirmText)) {
        let msg = 'Đã ghi nhận vào hệ thống!';
        try {
          const data = JSON.parse(confirmText);
          if (data && data.message) msg = data.message;
        } catch (e) {}

        queue.forEach((q) => {
          if (q.status === 'selected') {
            q.status = 'confirmed';
          }
        });
        renderQueue();
        setToast(`✅ <strong>Chốt đơn thành công:</strong> ${msg}`);

        if (!isPageCrashed503() && typeof window.DSDK === 'function' && window.jQuery) {
          const modVal = window.jQuery('.sel-dsdk-mod').select2('val');
          window.DSDK(modVal);
        }
        return true;
      } else {
        setToast(
          '🔥 Đã bắt được slot nhưng bước Xác nhận đang nghẽn — Auto sẽ chốt lại ở chu kỳ sau!'
        );
      }
    } catch (err) {
      setToast('🔥 Cổng xác nhận phản hồi quá 6s — Giữ nguyên các môn đã chọn để chốt lại!');
    }
    return false;
  }

  async function processCourseItem(item, isCanaryFirstPacket) {
    if (item.status === 'confirmed') return 'CONFIRMED';

    const totalBurst = clampBurst(burstInput.value || globalBurstCount);
    globalBurstCount = totalBurst;
    item.status = 'sending';
    item.burstProgress = 1;
    renderQueue();

    const firstResult = await sendSinglePacket(item);

    if (firstResult === 'SESSION_EXPIRED') {
      item.status = 'expired';
      renderQueue();
      return 'SESSION_EXPIRED';
    }

    if (firstResult === 'SELECTED') {
      item.status = 'selected';
      renderQueue();
      if (totalBurst > 1) {
        await commitSelectedCoursesImmediately();
      }
      return 'SELECTED';
    }

    if (isCanaryFirstPacket && canaryModeEnabled && firstResult === 'PORTAL_BLOCKED') {
      item.status = 'overload';
      renderQueue();
      return 'PORTAL_BLOCKED';
    }

    if (totalBurst > 1) {
      let sentSoFar = 1;
      let captured = false;
      let expired = false;
      let overloadSeen = firstResult === 'PORTAL_BLOCKED';

      while (sentSoFar < totalBurst && !captured && !expired) {
        const waveSize = Math.min(BURST_CONCURRENCY, totalBurst - sentSoFar);
        const wavePromises = [];

        for (let w = 0; w < waveSize; w++) {
          wavePromises.push(
            (async () => {
              const r = await sendSinglePacket(item);
              sentSoFar += 1;
              item.burstProgress = sentSoFar;
              renderQueue();
              return r;
            })()
          );
        }

        const results = await Promise.all(wavePromises);

        if (results.includes('SESSION_EXPIRED')) {
          expired = true;
          break;
        }
        if (results.includes('SELECTED')) {
          captured = true;
          break;
        }
        if (results.every((r) => r === 'PORTAL_BLOCKED')) {
          overloadSeen = true;
          if (canaryModeEnabled) break;
        }

        await sleep(45);
      }

      if (expired) {
        item.status = 'expired';
        renderQueue();
        return 'SESSION_EXPIRED';
      }

      if (captured) {
        item.status = 'selected';
        renderQueue();
        setToast(
          `🎯 <strong>Auto Bắn Nền thành công!</strong> Đã bắt dính slot môn <strong>${item.code}</strong> ở gói tin thứ <strong>#${item.burstProgress}/${totalBurst}</strong>!`
        );
        await commitSelectedCoursesImmediately();
        return 'SELECTED';
      }

      item.status = overloadSeen ? 'overload' : 'full';
      renderQueue();
      return overloadSeen ? 'PORTAL_BLOCKED' : 'CLASS_FULL';
    }

    item.status = firstResult === 'PORTAL_BLOCKED' ? 'overload' : 'full';
    renderQueue();
    return firstResult;
  }

  async function executeFastRegistration() {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;

    const unconfirmedIndices = [];
    queue.forEach((q, idx) => {
      if (q.status !== 'confirmed') unconfirmedIndices.push(idx);
    });

    if (unconfirmedIndices.length === 0) {
      setToast('🎉 Tất cả môn trong danh sách đều đã được <strong>Ghi nhận thành công</strong>!');
      if (autoTimer) stopAutoMode();
      isProcessing = false;
      return;
    }

    const firstIdx = unconfirmedIndices[0];
    const firstItem = queue[firstIdx];

    const firstRes = await processCourseItem(firstItem, true);

    if (firstRes === 'SESSION_EXPIRED') {
      stopAutoMode();
      setToast(
        '🛑 <strong>PHANH KHẨN CẤP:</strong> Phát hiện phiên đăng nhập bị văng! Đã dừng Auto trong 0ms để tránh bị phạt Queue!'
      );
      saveQueue();
      isProcessing = false;
      return;
    }

    if (canaryModeEnabled && firstRes === 'PORTAL_BLOCKED' && unconfirmedIndices.length > 1) {
      consecutiveOverloads += 1;
      for (let k = 1; k < unconfirmedIndices.length; k++) {
        const idx = unconfirmedIndices[k];
        if (queue[idx].status !== 'selected' && queue[idx].status !== 'confirmed') {
          queue[idx].status = 'shielded';
        }
      }
      renderQueue();
      setToast(
        `🛡️ <strong>Chim Mồi báo cổng đang khóa/503:</strong> Đã phanh lại các môn sau để bảo vệ Session!`
      );
      saveQueue();
      isProcessing = false;
      return;
    }

    consecutiveOverloads = 0;
    for (let k = 1; k < unconfirmedIndices.length; k++) {
      await sleep(120 + Math.floor(Math.random() * 120));
      const idx = unconfirmedIndices[k];
      const res = await processCourseItem(queue[idx], false);
      if (res === 'SESSION_EXPIRED') {
        stopAutoMode();
        setToast('🛑 <strong>PHANH KHẨN CẤP:</strong> Phát hiện phiên đăng nhập bị văng!');
        saveQueue();
        isProcessing = false;
        return;
      }
    }

    const anyStillSelected = queue.some((q) => q.status === 'selected');
    if (anyStillSelected) {
      await sleep(100);
      await commitSelectedCoursesImmediately();
    } else if (!queue.every((q) => q.status === 'confirmed')) {
      setToast(
        `⚠️ Các môn chưa đỗ hiện đang đầy (Đã bắn nền x${globalBurstCount} lần/môn). Bạn có thể chọn <strong>100 / 150</strong> hoặc nhập tới <strong>1000</strong> trên thanh Ghim môn!`
      );
    }

    saveQueue();
    isProcessing = false;
  }

  function stopAutoMode() {
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    autoBtn.classList.remove('active');
    autoBtn.textContent = '🔁 Auto';
  }

  function scheduleNextAutoTick() {
    if (!autoBtn.classList.contains('active')) return;
    const adaptiveExtraMs = Math.min(2000, consecutiveOverloads * 350);
    const humanJitterMs = 200 + Math.floor(Math.random() * 550);
    const nextDelayMs = intervalSec * 1000 + adaptiveExtraMs + humanJitterMs;

    autoTimer = setTimeout(async () => {
      await executeFastRegistration();
      if (autoBtn.classList.contains('active')) {
        scheduleNextAutoTick();
      }
    }, nextDelayMs);
  }

  fastBtn.addEventListener('click', () => {
    executeFastRegistration();
  });

  autoBtn.addEventListener('click', async () => {
    if (autoBtn.classList.contains('active')) {
      stopAutoMode();
      setToast('⏹ Đã dừng chế độ tự động săn slot.');
      return;
    }

    consecutiveOverloads = 0;
    if (queue.length > 0 && queue.every((q) => q.status === 'confirmed')) {
      queue.forEach((q) => {
        q.status = 'idle';
        q.attempts = 0;
        q.burstProgress = 0;
      });
    }

    intervalSec = Math.max(1, parseInt(intervalInput.value, 10) || 2);
    autoBtn.classList.add('active');
    autoBtn.textContent = `⏹ Đang Auto (${intervalSec}s)`;
    await executeFastRegistration();
    if (autoBtn.classList.contains('active')) {
      scheduleNextAutoTick();
    }
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'AUTODKMH_EXTENSION') {
      return;
    }
    if (event.data.type === 'QUEUE_LOADED' && Array.isArray(event.data.queue)) {
      queue = event.data.queue.map((item) => ({
        ...item,
        burstProgress: 0
      }));
      renderQueue();
    }
  });

  window.postMessage({ source: 'AUTODKMH_PAGE', type: 'LOAD_QUEUE' }, '*');
  renderQueue();
})();
