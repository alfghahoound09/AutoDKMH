/**
 * Auto DKMH VNU v2.0 - Page Bridge & Shadow DOM Floating Command Panel
 * Features:
 * - Stealth Background Hang Engine: Solution B (Serialized Single-Shot Pacing) + Solution A (Passive Slot Radar) + Solution C (Sticky Selected Lock)
 * - Unthrottled Web Worker Background Timer (Chạy ngầm 100% khi ẩn tab / thu nhỏ trình duyệt)
 * - Silent Session Heartbeat (3m) + 0ms Circuit Breaker + 503 Recovery Overlay
 */
(function () {
  'use strict';

  if (window.location.pathname === '/landing') return;

  const REQUEST_TIMEOUT_MS = 6000; // Cắt kết nối treo sau 6s
  const HEARTBEAT_INTERVAL_MS = 180000; // 3 phút ping nhẹ giữ phiên 1 lần
  const DEFAULT_BURST = 50; // Tổng số lượt treo săn ngầm mặc định cho mỗi môn
  const MIN_BURST = 1;
  const MAX_BURST = 1000;
  const INTER_COURSE_MIN_GAP_MS = 850; // Khoảng giãn cách tuần tự giữa 2 môn chống khóa Session ASP.NET
  const INTER_COURSE_JITTER_MS = 500;

  // =========================================================================
  // 0. UNTHROTTLED WEB WORKER BACKGROUND TIMER (CHỐNG CHROME/BRAVE NGỦ ĐÔNG TAB NGẦM)
  // =========================================================================
  function createBackgroundWorkerTimer() {
    const callbacks = new Map();
    let worker = null;

    try {
      const workerCode = `
        const timers = new Map();
        self.onmessage = function (e) {
          const data = e.data || {};
          const id = data.id;
          if (data.cmd === 'setTimeout') {
            if (timers.has(id)) clearTimeout(timers.get(id).ref);
            const ref = setTimeout(() => {
              timers.delete(id);
              self.postMessage({ id });
            }, data.delayMs);
            timers.set(id, { type: 'timeout', ref });
          } else if (data.cmd === 'setInterval') {
            if (timers.has(id)) clearInterval(timers.get(id).ref);
            const ref = setInterval(() => {
              self.postMessage({ id });
            }, data.delayMs);
            timers.set(id, { type: 'interval', ref });
          } else if (data.cmd === 'clear') {
            if (timers.has(id)) {
              const t = timers.get(id);
              if (t.type === 'interval') clearInterval(t.ref);
              else clearTimeout(t.ref);
              timers.delete(id);
            }
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      worker = new Worker(blobUrl);
      worker.onmessage = (e) => {
        const id = e.data && e.data.id;
        const cb = callbacks.get(id);
        if (cb) cb();
      };
    } catch (err) {
      worker = null;
    }

    const fallbackRefs = new Map();

    return {
      isWorkerBacked: Boolean(worker),
      setTimeout(id, fn, delayMs) {
        callbacks.set(id, fn);
        if (worker) {
          worker.postMessage({ cmd: 'setTimeout', id, delayMs });
        } else {
          if (fallbackRefs.has(id)) clearTimeout(fallbackRefs.get(id));
          fallbackRefs.set(
            id,
            window.setTimeout(() => {
              fallbackRefs.delete(id);
              fn();
            }, delayMs)
          );
        }
      },
      setInterval(id, fn, delayMs) {
        callbacks.set(id, fn);
        if (worker) {
          worker.postMessage({ cmd: 'setInterval', id, delayMs });
        } else {
          if (fallbackRefs.has(id)) clearInterval(fallbackRefs.get(id));
          fallbackRefs.set(id, window.setInterval(fn, delayMs));
        }
      },
      clear(id) {
        callbacks.delete(id);
        if (worker) {
          worker.postMessage({ cmd: 'clear', id });
        } else if (fallbackRefs.has(id)) {
          clearTimeout(fallbackRefs.get(id));
          clearInterval(fallbackRefs.get(id));
          fallbackRefs.delete(id);
        }
      }
    };
  }

  const bgTimer = createBackgroundWorkerTimer();

  function sleep(ms) {
    return new Promise((resolve) => {
      const id = 'sleep_' + Math.random().toString(36).slice(2);
      bgTimer.setTimeout(id, resolve, ms);
    });
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
  // 3. STATE, QUEUE & STEALTH HANG ENGINE (SOLUTION B + A + C + WORKER)
  // =========================================================================
  let queue = [];
  let isProcessing = false;
  let isAutoRunning = false;
  let autoTickCount = 0;
  let intervalSec = 2;
  let consecutiveOverloads = 0;

  // Mỗi môn có số lượt treo săn ngầm riêng (item.burstCount), giới hạn MIN_BURST – MAX_BURST
  function clampBurst(val) {
    const num = parseInt(val, 10);
    if (Number.isNaN(num)) return DEFAULT_BURST;
    return Math.min(MAX_BURST, Math.max(MIN_BURST, num));
  }

  function saveQueue() {
    const cleanQueue = queue.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      status: item.status === 'sending' || item.status === 'hanging' ? 'idle' : item.status,
      pingMs: item.pingMs || 0,
      attempts: item.attempts || 0,
      burstCount: clampBurst(item.burstCount),
      burstProgress: item.burstProgress || 0,
      slotText: item.slotText || '',
      hasOpenSlot: Boolean(item.hasOpenSlot)
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

    .card-burst {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
      font-size: 10.5px;
      font-weight: 700;
      color: var(--status-warning);
    }

    .burst-input {
      width: 52px;
      padding: 2px 4px;
      border-radius: 5px;
      border: 1px solid rgba(245, 158, 11, 0.45);
      background: var(--bg-canvas);
      color: var(--status-warning);
      font-size: 11px;
      font-weight: 700;
      text-align: center;
      outline: none;
    }

    .burst-input:focus {
      border-color: var(--status-warning);
    }

    .burst-input:disabled {
      opacity: 0.55;
      cursor: not-allowed;
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

    .queue-card.status-sending,
    .queue-card.status-hanging { border-color: var(--accent-secondary); }
    .queue-card.status-selected,
    .queue-card.status-confirmed { border-color: var(--accent-primary); }
    .queue-card.status-full { border-color: var(--status-warning); }
    .queue-card.status-overload,
    .queue-card.status-expired { border-color: var(--status-danger); }

    .card-left {
      display: flex;
      align-items: center;
      gap: 5px;
      min-width: 0;
    }

    .slot-pill {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 4px;
      font-family: monospace;
      font-weight: 700;
      flex-shrink: 0;
      background: rgba(100, 116, 139, 0.22);
      color: var(--text-secondary);
      border: 1px solid rgba(100, 116, 139, 0.35);
    }

    .slot-pill.open {
      background: rgba(16, 185, 129, 0.18);
      color: var(--accent-primary);
      border-color: rgba(16, 185, 129, 0.45);
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
    .badge-sending,
    .badge-hanging { background: rgba(6, 182, 212, 0.2); color: var(--accent-secondary); }
    .badge-selected,
    .badge-confirmed { background: rgba(16, 185, 129, 0.2); color: var(--accent-primary); }
    .badge-full { background: rgba(245, 158, 11, 0.2); color: var(--status-warning); }
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
        🛰️ <strong>Treo săn ngầm chống văng (B+A+C + Worker):</strong> Mỗi chu kỳ điểm danh tuần tự <strong>1 gói/môn</strong> (tối đa <strong>🎯 số lượt</strong> đã đặt), tự găm giỏ & chốt đơn khi có slot!
      </div>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(panel);

  const resetStatusBtn = shadow.getElementById('reset-status-btn');
  const minimizeBtn = shadow.getElementById('minimize-btn');
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

  // Giữ phiên 3 phút tự động chạy ngầm bằng Web Worker (không cần nút bấm trên UI)
  function startHeartbeat() {
    bgTimer.clear('heartbeat');
    bgTimer.setInterval(
      'heartbeat',
      async () => {
        if (isProcessing || isAutoRunning) return;
        try {
          const res = await fetch('/dang-ky-mon-hoc-nganh-1', {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store'
          });
          const text = await res.text();
          if (isResponseSessionExpired(res, text)) {
            setToast(
              '⚠️ <strong>Cảnh báo:</strong> Phiên đăng nhập đã hết hạn! Hãy kiểm tra lại trước giờ mở cổng.'
            );
          } else {
            const nowStr = new Date().toLocaleTimeString('vi-VN');
            setToast(
              `💓 <strong>Worker Keep-Alive (${nowStr}):</strong> Đã tự động làm mới phiên đăng nhập ngầm!`
            );
          }
        } catch (e) {}
      },
      HEARTBEAT_INTERVAL_MS + Math.floor(Math.random() * 12000)
    );
  }

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
    refreshSlotRadarFromDOM();
    saveQueue();
    renderQueue();
    setToast('↺ Đã đặt lại trạng thái tất cả các môn và lượt treo về <strong>⏳ Sẵn sàng (0/N)</strong>.');
  });

  // =========================================================================
  // SOLUTION A: PASSIVE SLOT RADAR (ĐỌC TRỰC TIẾP ĐK/TỔNG TỪ BẢNG #divDSDK)
  // =========================================================================
  function getRowSlotInfo(rowId) {
    if (!rowId) return null;
    const tr = document.querySelector(`#divDSDK table tbody tr[data-rowindex="${CSS.escape(String(rowId))}"]`);
    if (!tr) return null;
    const cells = tr.querySelectorAll('td');
    if (cells.length < 7) return null;
    const maxSlots = parseInt(cells[5].textContent.trim(), 10);
    const enrolled = parseInt(cells[6].textContent.trim(), 10);
    if (Number.isNaN(maxSlots) || Number.isNaN(enrolled) || maxSlots <= 0) {
      return null;
    }
    return {
      enrolled,
      maxSlots,
      slotText: `${enrolled}/${maxSlots}`,
      hasOpenSlot: enrolled < maxSlots
    };
  }

  function refreshSlotRadarFromDOM() {
    ensureAllRowsHaveRowIndex();
    queue.forEach((item) => {
      const info = getRowSlotInfo(item.id);
      if (info) {
        item.slotText = info.slotText;
        item.hasOpenSlot = info.hasOpenSlot;
      }
    });
  }

  function triggerSilentTableRefresh() {
    if (isPageCrashed503()) return;
    try {
      if (typeof window.DSDK === 'function') {
        let modVal = '1';
        if (window.jQuery && window.jQuery('.sel-dsdk-mod').length > 0) {
          modVal =
            (typeof window.jQuery('.sel-dsdk-mod').select2 === 'function' &&
              window.jQuery('.sel-dsdk-mod').select2('val')) ||
            window.jQuery('.sel-dsdk-mod').val() ||
            '1';
        }
        window.DSDK(modVal);
      }
    } catch (e) {}
  }

  function renderQueue() {
    // Giữ nguyên focus nếu user đang gõ số lần bắn của 1 môn trong lúc Auto đang chạy
    const activeEl = shadow.activeElement;
    const focusedBurstId =
      activeEl && activeEl.classList && activeEl.classList.contains('burst-input')
        ? activeEl.dataset.itemId
        : null;
    const focusedValue = focusedBurstId ? activeEl.value : null;

    queueListEl.innerHTML = '';
    if (queue.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'queue-empty';
      empty.textContent = 'Danh sách trống. Hãy bấm nút "+Auto" cạnh môn học trên bảng hoặc nhập mã môn bên trên!';
      queueListEl.appendChild(empty);
      return;
    }

    queue.forEach((item) => {
      const burstCount = clampBurst(item.burstCount);
      item.burstCount = burstCount;
      const progress = item.burstProgress || 0;

      const card = document.createElement('div');
      card.className = 'queue-card status-' + item.status;

      const left = document.createElement('div');
      left.className = 'card-left';

      const slotBadgeHtml = item.slotText
        ? `<span class="slot-pill ${item.hasOpenSlot ? 'open' : ''}" title="Sĩ số lớp hiện tại (ĐK/Tổng) theo Radar Solution A">${item.slotText}</span>`
        : '';

      const infoSpan = document.createElement('span');
      infoSpan.style.cssText = 'display:flex;align-items:center;gap:5px;min-width:0;overflow:hidden;';
      infoSpan.innerHTML =
        `<span class="row-id">#${item.id}</span>` +
        `<span class="course-code">${item.code || ''}</span>` +
        slotBadgeHtml +
        `<span class="course-name">${item.name || ''}</span>`;
      left.appendChild(infoSpan);

      const right = document.createElement('div');
      right.className = 'card-right';

      // Ô nhập số lượt treo săn ngầm riêng cho từng môn (Min 1 – Max 1000)
      const burstWrap = document.createElement('label');
      burstWrap.className = 'card-burst';
      burstWrap.title = `Số lượt treo săn ngầm tuần tự cho môn này (Min ${MIN_BURST} – Max ${MAX_BURST})`;
      burstWrap.textContent = '🎯';

      const burstField = document.createElement('input');
      burstField.type = 'number';
      burstField.className = 'burst-input';
      burstField.min = String(MIN_BURST);
      burstField.max = String(MAX_BURST);
      burstField.step = '1';
      burstField.value = String(burstCount);
      burstField.dataset.itemId = item.id;
      burstField.disabled = item.status === 'sending';
      burstField.addEventListener('change', () => {
        const newVal = clampBurst(burstField.value);
        item.burstCount = newVal;
        if (item.status === 'full' && (item.burstProgress || 0) < newVal) {
          item.status = 'hanging';
        }
        burstField.value = String(newVal);
        saveQueue();
        renderQueue();
        setToast(
          `🎯 Môn <strong>${item.code}</strong> (#${item.id}) sẽ treo săn ngầm tối đa <strong>${newVal} lượt</strong> (Min ${MIN_BURST} – Max ${MAX_BURST}).`
        );
      });
      burstWrap.appendChild(burstField);

      const badge = document.createElement('span');
      badge.className = 'badge badge-' + item.status;
      if (item.status === 'idle') {
        badge.textContent = progress > 0 ? `⏳ Sẵn sàng (${progress}/${burstCount})` : '⏳ Sẵn sàng';
      } else if (item.status === 'sending') {
        badge.textContent = `🔄 Điểm danh ${progress}/${burstCount}...`;
      } else if (item.status === 'hanging') {
        badge.textContent = `🛰️ Treo ${progress}/${burstCount} (${item.pingMs}ms)`;
      } else if (item.status === 'selected') {
        badge.textContent = `📌 Đã găm giỏ (${item.pingMs}ms)`;
      } else if (item.status === 'confirmed') {
        badge.textContent = `✅ Đã ghi nhận (${item.pingMs}ms)`;
      } else if (item.status === 'full') {
        badge.textContent = `⏸ Đủ ${progress}/${burstCount} lượt`;
      } else if (item.status === 'overload') {
        badge.textContent = `🔥 Cổng khóa/503 (${progress}/${burstCount})`;
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

      right.appendChild(burstWrap);
      right.appendChild(badge);
      right.appendChild(delBtn);
      card.appendChild(left);
      card.appendChild(right);
      queueListEl.appendChild(card);

      if (focusedBurstId && focusedBurstId === String(item.id) && !burstField.disabled) {
        burstField.value = focusedValue;
        burstField.focus();
      }
    });
  }

  // Lưu ánh xạ mã lớp học phần -> data-rowindex để khi trang ở trạng thái "Ngoài thời hạn đăng ký!" (ẩn toàn bộ input.order) vẫn khôi phục đúng mã số
  const ROW_MAP_STORAGE_KEY = 'autodkmh_v2_rowindex_map';
  let cachedRowMap = {};
  try {
    cachedRowMap = JSON.parse(localStorage.getItem(ROW_MAP_STORAGE_KEY) || '{}') || {};
  } catch (e) {
    cachedRowMap = {};
  }

  function saveRowMap() {
    try {
      localStorage.setItem(ROW_MAP_STORAGE_KEY, JSON.stringify(cachedRowMap));
    } catch (e) {}
  }

  function getCourseCodeFromTr(tr) {
    const cells = tr ? tr.querySelectorAll('td') : [];
    return cells.length >= 5 ? cells[4].textContent.trim() : '';
  }

  function ensureAllRowsHaveRowIndex() {
    const rows = Array.from(document.querySelectorAll('#divDSDK table tbody tr'));
    if (rows.length === 0) return rows;

    let mapUpdated = false;

    // Pass 1: Đọc data-rowindex từ input.order, từ tr[data-rowindex], hoặc từ bộ nhớ cachedRowMap theo mã lớp
    let lastKnownIdx = null;
    rows.forEach((tr) => {
      const orderInput = tr.querySelector('.order');
      const courseCode = getCourseCodeFromTr(tr);
      const existingIdx =
        (orderInput && orderInput.getAttribute('data-rowindex')) ||
        tr.getAttribute('data-rowindex') ||
        (courseCode && cachedRowMap[courseCode]);

      if (existingIdx) {
        tr.setAttribute('data-rowindex', String(existingIdx));
        if (courseCode && cachedRowMap[courseCode] !== String(existingIdx)) {
          cachedRowMap[courseCode] = String(existingIdx);
          mapUpdated = true;
        }
        const parsed = parseInt(existingIdx, 10);
        if (!Number.isNaN(parsed)) lastKnownIdx = parsed;
      } else if (lastKnownIdx !== null) {
        // Tự động nội suy mã số cho các lớp bị ẩn input.order (Lớp đầy hoặc Ngoài thời hạn đăng ký)
        lastKnownIdx += 1;
        const inferred = String(lastKnownIdx);
        tr.setAttribute('data-rowindex', inferred);
        if (courseCode) {
          cachedRowMap[courseCode] = inferred;
          mapUpdated = true;
        }
      }
    });

    // Pass 2: Ngược từ dưới lên cho các lớp đầu bảng bị ẩn input.order
    let nextKnownIdx = null;
    for (let i = rows.length - 1; i >= 0; i--) {
      const tr = rows[i];
      const courseCode = getCourseCodeFromTr(tr);
      const idxStr = tr.getAttribute('data-rowindex');
      if (idxStr) {
        const parsed = parseInt(idxStr, 10);
        if (!Number.isNaN(parsed)) nextKnownIdx = parsed;
      } else if (nextKnownIdx !== null && nextKnownIdx > 1) {
        nextKnownIdx -= 1;
        const inferred = String(nextKnownIdx);
        tr.setAttribute('data-rowindex', inferred);
        if (courseCode) {
          cachedRowMap[courseCode] = inferred;
          mapUpdated = true;
        }
      }
    }

    // Pass 3: Fallback nếu mở trực tiếp ở trạng thái "Ngoài thời hạn đăng ký!" và chưa có bất kỳ rowindex nào trong cache
    rows.forEach((tr, idx) => {
      if (!tr.getAttribute('data-rowindex')) {
        const fallbackIdx = String(idx + 1);
        tr.setAttribute('data-rowindex', fallbackIdx);
      }
    });

    if (mapUpdated) {
      saveRowMap();
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
        const slotInfo = getRowSlotInfo(rowIdx || clean);
        return {
          id: rowIdx || clean,
          code: courseCode || ('Môn #' + rowIdx),
          name: courseName,
          slotText: slotInfo ? slotInfo.slotText : '',
          hasOpenSlot: slotInfo ? slotInfo.hasOpenSlot : false
        };
      }
    }

    return {
      id: clean,
      code: 'Mã #' + clean,
      name: 'Gửi trực tiếp qua API',
      slotText: '',
      hasOpenSlot: false
    };
  }

  function addCourseItem(courseObj) {
    if (!courseObj || !courseObj.id) return;
    const existing = queue.find((q) => q.id === courseObj.id);
    if (existing) {
      setToast(
        `ℹ️ Môn <strong>${existing.code}</strong> (#${existing.id}) đã có trong danh sách Auto (Treo tối đa x${clampBurst(existing.burstCount)} lượt).`
      );
      return;
    }

    const slotInfo = getRowSlotInfo(courseObj.id);
    queue.push({
      id: courseObj.id,
      code: courseObj.code || '',
      name: courseObj.name || '',
      status: 'idle',
      pingMs: 0,
      attempts: 0,
      burstCount: DEFAULT_BURST,
      burstProgress: 0,
      slotText: slotInfo ? slotInfo.slotText : courseObj.slotText || '',
      hasOpenSlot: slotInfo ? slotInfo.hasOpenSlot : Boolean(courseObj.hasOpenSlot)
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
  // 5. BATCHED DOM ENHANCEMENT ON VNU TABLE (MỞ KHÓA Ô TICK + MÃ SỐ + NÚT "+Auto")
  // =========================================================================
  function unlockOutOfTimeConfirmButton() {
    const outOfTimeBtn = document.querySelector('.btn-out-of-time');
    const container =
      (outOfTimeBtn && outOfTimeBtn.parentElement) || document.querySelector('.col-md-offset-0');
    if (!container) return;

    let confirmBtn = container.querySelector('.confirm-registration');
    if (!confirmBtn) {
      confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'btn btn-success confirm-registration';
      confirmBtn.style.marginLeft = '6px';
      confirmBtn.innerHTML = '💾 Ghi nhận';
      container.appendChild(confirmBtn);
    }

    if (confirmBtn.dataset.autodkmhBound !== '1') {
      confirmBtn.dataset.autodkmhBound = '1';
      confirmBtn.addEventListener('click', async () => {
        if (queue.some((q) => q.status === 'selected')) {
          await commitSelectedCoursesImmediately();
        } else {
          await executeFastRegistration();
        }
      });
    }
  }

  async function enhanceCourseTable() {
    unlockOutOfTimeConfirmButton();
    const rows = ensureAllRowsHaveRowIndex();
    if (rows.length === 0) return;
    refreshSlotRadarFromDOM();
    renderQueue();
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

            // Nếu ở trạng thái "Ngoài thời hạn đăng ký!" hoặc lớp đầy khiến VNU ẩn ô tick, tự động khôi phục ô tick .order
            let orderInput = firstCell.querySelector('.order');
            if (!orderInput) {
              orderInput = document.createElement('input');
              orderInput.type = 'checkbox';
              orderInput.className = 'order';
              orderInput.setAttribute('data-rowindex', rowIndex);
              orderInput.title = 'Tích chọn môn học (Đã mở khóa bởi Auto DKMH)';
              firstCell.prepend(orderInput);
            } else {
              orderInput.disabled = false;
              orderInput.setAttribute('data-rowindex', rowIndex);
            }

            if (orderInput.dataset.autodkmhBound !== '1') {
              orderInput.dataset.autodkmhBound = '1';
              orderInput.addEventListener('change', async () => {
                const resolved = resolveCourseFromDOM(rowIndex);
                if (!resolved) return;
                let item = queue.find((q) => q.id === resolved.id);
                if (!item) {
                  addCourseItem(resolved);
                  item = queue.find((q) => q.id === resolved.id);
                }
                if (orderInput.checked && item) {
                  await processCourseItem(item);
                  saveQueue();
                }
              });
            }

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
                `➕ Đã thêm <strong>${resolved.code}</strong> (#${rowIndex}) vào Auto (Treo săn ngầm mặc định ${DEFAULT_BURST} lượt — chỉnh được trên thẻ môn).`
              );
            });

            orderInput.after(quickBtn);
            orderInput.after(badge);
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
  // 6. STEALTH HANG ENGINE: SOLUTION B + SOLUTION A + SOLUTION C + WORKER
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
      item.attempts = (item.attempts || 0) + 1;

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
      item.attempts = (item.attempts || 0) + 1;
      return 'PORTAL_BLOCKED';
    }
  }

  // SOLUTION C: STICKY SELECTED LOCK (Đã găm vào giỏ thì chỉ gọi xác nhận, tuyệt đối không gọi lại /chon-mon-hoc tránh bị uncheck mất môn)
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
      if (isResponseSessionExpired(confirmRes, confirmText)) {
        return 'SESSION_EXPIRED';
      }

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
        triggerSilentTableRefresh();
        return true;
      } else {
        setToast(
          '📌 <strong>Solution C (Khóa Giỏ):</strong> Môn đã găm trong giỏ nhưng cổng Xác nhận đang nghẽn — Giữ nguyên giỏ để chốt lại ở nhịp sau!'
        );
      }
    } catch (err) {
      setToast('📌 <strong>Solution C (Khóa Giỏ):</strong> Cổng xác nhận phản hồi chậm — Giữ nguyên môn trong giỏ để chốt lại!');
    }
    return false;
  }

  // SOLUTION B: STRICTLY SERIALIZED SINGLE-SHOT PACING (1 gói/môn/chu kỳ, không bao giờ flood song song gây khóa Session ASP.NET)
  async function processCourseItem(item) {
    if (item.status === 'confirmed') return 'CONFIRMED';

    // Solution C: Nếu môn đã nằm trong giỏ ('selected'), tuyệt đối KHÔNG gọi lại /chon-mon-hoc để tránh bị toggle hủy chọn
    if (item.status === 'selected') {
      const commitRes = await commitSelectedCoursesImmediately();
      if (commitRes === 'SESSION_EXPIRED') {
        item.status = 'expired';
        renderQueue();
        return 'SESSION_EXPIRED';
      }
      return item.status === 'confirmed' ? 'CONFIRMED' : 'SELECTED';
    }

    const totalBurst = clampBurst(item.burstCount);
    item.burstCount = totalBurst;
    const currentProgress = item.burstProgress || 0;

    if (currentProgress >= totalBurst) {
      item.status = 'full';
      renderQueue();
      return 'QUOTA_REACHED';
    }

    item.status = 'sending';
    item.burstProgress = currentProgress + 1;
    renderQueue();

    const result = await sendSinglePacket(item);

    if (result === 'SESSION_EXPIRED') {
      item.status = 'expired';
      renderQueue();
      return 'SESSION_EXPIRED';
    }

    if (result === 'SELECTED') {
      item.status = 'selected';
      renderQueue();
      setToast(
        `🎯 <strong>Bắt dính slot!</strong> Môn <strong>${item.code}</strong> (#${item.id}) đã vào giỏ ở lượt treo <strong>#${item.burstProgress}/${totalBurst}</strong> — Đang chốt đơn ngay!`
      );
      const commitRes = await commitSelectedCoursesImmediately();
      if (commitRes === 'SESSION_EXPIRED') {
        item.status = 'expired';
        renderQueue();
        return 'SESSION_EXPIRED';
      }
      return 'SELECTED';
    }

    if (result === 'PORTAL_BLOCKED') {
      item.status = 'overload';
      renderQueue();
      return 'PORTAL_BLOCKED';
    }

    // CLASS_FULL: Nếu chưa hết số lượt treo (burstCount), giữ ở trạng thái 'hanging' (Treo săn ngầm)
    if (item.burstProgress < totalBurst) {
      item.status = 'hanging';
    } else {
      item.status = 'full';
    }
    renderQueue();
    return 'CLASS_FULL';
  }

  async function executeFastRegistration() {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;

    refreshSlotRadarFromDOM();

    // Solution C: Nếu có môn đang găm sẵn trong giỏ ('selected'), ưu tiên chốt đơn trước
    if (queue.some((q) => q.status === 'selected')) {
      const preCommit = await commitSelectedCoursesImmediately();
      if (preCommit === 'SESSION_EXPIRED') {
        stopAutoMode();
        setToast(
          '🛑 <strong>PHANH KHẨN CẤP:</strong> Phát hiện phiên đăng nhập bị văng! Đã dừng Auto trong 0ms để tránh bị phạt Queue!'
        );
        saveQueue();
        isProcessing = false;
        return;
      }
    }

    // Lọc các môn chưa ghi nhận và còn lượt treo
    const activeIndices = [];
    queue.forEach((q, idx) => {
      const maxQuota = clampBurst(q.burstCount);
      const progress = q.burstProgress || 0;
      if (q.status !== 'confirmed' && (q.status === 'selected' || progress < maxQuota)) {
        activeIndices.push(idx);
      } else if (q.status !== 'confirmed' && progress >= maxQuota) {
        q.status = 'full';
      }
    });

    if (activeIndices.length === 0) {
      if (queue.every((q) => q.status === 'confirmed')) {
        setToast('🎉 Tất cả môn trong danh sách đều đã được <strong>Ghi nhận thành công</strong>!');
      } else {
        setToast(
          '⏸ Đã chạy đủ số lượt treo của tất cả môn. Bấm <strong>🔁 Auto</strong> hoặc nút <strong>↺</strong> để treo tiếp!'
        );
      }
      if (isAutoRunning) stopAutoMode();
      renderQueue();
      saveQueue();
      isProcessing = false;
      return;
    }

    // Solution A: Ưu tiên môn đang có slot trống (ĐK < Tổng) lên đầu hàng đợi xử lý
    activeIndices.sort((a, b) => {
      const openA = queue[a].hasOpenSlot ? 1 : 0;
      const openB = queue[b].hasOpenSlot ? 1 : 0;
      return openB - openA;
    });

    // Solution B: Điểm danh tuần tự từng môn 1 gói/chu kỳ, giãn cách 850ms – 1350ms giữa các môn chống khóa Session ASP.NET
    let blockedCount = 0;
    for (let k = 0; k < activeIndices.length; k++) {
      if (k > 0) {
        const gapMs = INTER_COURSE_MIN_GAP_MS + Math.floor(Math.random() * INTER_COURSE_JITTER_MS);
        await sleep(gapMs);
      }
      const idx = activeIndices[k];
      const res = await processCourseItem(queue[idx]);
      if (res === 'SESSION_EXPIRED') {
        stopAutoMode();
        setToast(
          '🛑 <strong>PHANH KHẨN CẤP:</strong> Phát hiện phiên đăng nhập bị văng! Đã dừng Auto trong 0ms để tránh bị phạt Queue!'
        );
        saveQueue();
        isProcessing = false;
        return;
      }
      if (res === 'PORTAL_BLOCKED') {
        blockedCount += 1;
      }
    }

    if (blockedCount === activeIndices.length) {
      consecutiveOverloads += 1;
    } else {
      consecutiveOverloads = 0;
    }

    // Solution C: Chốt lại lần cuối nếu trong chu kỳ vừa rồi có môn mới vào giỏ
    if (queue.some((q) => q.status === 'selected')) {
      await sleep(180);
      await commitSelectedCoursesImmediately();
    } else if (!queue.every((q) => q.status === 'confirmed')) {
      const hangingCount = queue.filter((q) => q.status === 'hanging').length;
      if (hangingCount > 0) {
        setToast(
          `🛰️ <strong>Đang treo săn ngầm (${bgTimer.isWorkerBacked ? 'Web Worker' : 'Timer'}):</strong> Điểm danh tuần tự 1 gói/môn chống văng phiên. Có thể ẩn tab làm việc khác!`
        );
      } else {
        setToast(
          `⏸ Các môn chưa đỗ đã chạy hết số lượt treo. Bấm <strong>↺</strong> hoặc tăng ô <strong>🎯 số lượt</strong> (tối đa ${MAX_BURST}) để treo tiếp!`
        );
        if (isAutoRunning && queue.every((q) => q.status === 'confirmed' || q.status === 'full')) {
          stopAutoMode();
        }
      }
    }

    // Solution A: Định kỳ 3 chu kỳ Auto làm mới nhẹ bảng #divDSDK ngầm để cập nhật cột ĐK/Tổng mới nhất
    autoTickCount += 1;
    if (isAutoRunning && autoTickCount % 3 === 0) {
      triggerSilentTableRefresh();
    }

    saveQueue();
    isProcessing = false;
  }

  function stopAutoMode() {
    isAutoRunning = false;
    bgTimer.clear('autoTick');
    autoBtn.classList.remove('active');
    autoBtn.textContent = '🔁 Auto';
  }

  function scheduleNextAutoTick() {
    if (!isAutoRunning) return;
    const adaptiveExtraMs = Math.min(2500, consecutiveOverloads * 450);
    const humanJitterMs = 250 + Math.floor(Math.random() * 600);
    const nextDelayMs = intervalSec * 1000 + adaptiveExtraMs + humanJitterMs;

    bgTimer.setTimeout(
      'autoTick',
      async () => {
        await executeFastRegistration();
        if (isAutoRunning) {
          scheduleNextAutoTick();
        }
      },
      nextDelayMs
    );
  }

  fastBtn.addEventListener('click', () => {
    // Nếu các môn đã chạy hết quota ở lần trước, tự mở lại lượt treo khi user bấm Đăng Ký Nhanh
    if (
      queue.length > 0 &&
      queue.every((q) => q.status === 'confirmed' || (q.burstProgress || 0) >= clampBurst(q.burstCount))
    ) {
      queue.forEach((q) => {
        if (q.status !== 'confirmed') {
          q.status = 'idle';
          q.burstProgress = 0;
        }
      });
    }
    executeFastRegistration();
  });

  autoBtn.addEventListener('click', async () => {
    if (isAutoRunning) {
      stopAutoMode();
      setToast('⏹ Đã dừng chế độ treo săn slot ngầm.');
      return;
    }

    consecutiveOverloads = 0;
    autoTickCount = 0;

    // Mở lại bộ đếm lượt treo cho các môn chưa đỗ đã hết lượt
    const anyRunnable = queue.some(
      (q) => q.status !== 'confirmed' && (q.burstProgress || 0) < clampBurst(q.burstCount)
    );
    if (!anyRunnable) {
      queue.forEach((q) => {
        if (q.status !== 'confirmed' || queue.every((item) => item.status === 'confirmed')) {
          q.status = 'idle';
          q.attempts = 0;
          q.burstProgress = 0;
        }
      });
    }

    intervalSec = Math.max(1, parseInt(intervalInput.value, 10) || 2);
    isAutoRunning = true;
    autoBtn.classList.add('active');
    autoBtn.textContent = `⏹ Đang Treo (${intervalSec}s)`;
    await executeFastRegistration();
    if (isAutoRunning) {
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
        burstCount: clampBurst(item.burstCount),
        burstProgress: item.burstProgress || 0,
        slotText: item.slotText || '',
        hasOpenSlot: Boolean(item.hasOpenSlot)
      }));
      refreshSlotRadarFromDOM();
      renderQueue();
    }
  });

  window.postMessage({ source: 'AUTODKMH_PAGE', type: 'LOAD_QUEUE' }, '*');
  renderQueue();
})();
