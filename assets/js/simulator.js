/**
 * AutoDKMH VNU - Theme Toggle & Interactive Live Queue Simulator
 */
(function () {
  'use strict';

  // =========================================================================
  // 1. TWO-STATE THEME TOGGLE (Syncs <meta name="color-scheme"> & localStorage)
  // =========================================================================
  const metaScheme = document.querySelector('meta[name="color-scheme"]');
  const themeBtn = document.getElementById('theme-toggle');
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function getSystemScheme() {
    return darkQuery.matches ? 'dark' : 'light';
  }

  function getRenderedScheme() {
    const content = metaScheme ? metaScheme.content : 'light dark';
    if (content === 'dark' || content === 'light') {
      return content;
    }
    return getSystemScheme();
  }

  function applySchemeValue(val) {
    if (metaScheme) {
      metaScheme.content = val || 'light dark';
    }
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      const currentRendered = getRenderedScheme();
      const targetScheme = currentRendered === 'dark' ? 'light' : 'dark';
      const systemScheme = getSystemScheme();

      try {
        if (targetScheme === systemScheme) {
          localStorage.removeItem('color-scheme');
          applySchemeValue('light dark');
        } else {
          localStorage.setItem('color-scheme', targetScheme);
          applySchemeValue(targetScheme);
        }
      } catch (e) {
        applySchemeValue(targetScheme);
      }
    });
  }

  window.addEventListener('storage', function (e) {
    if (e.key === 'color-scheme') {
      applySchemeValue(e.newValue ?? 'light dark');
    }
  });

  // =========================================================================
  // 2. INTERACTIVE LIVE QUEUE SIMULATOR
  // =========================================================================
  const SAMPLE_CATALOG = [
    {
      rowIndex: '142',
      code: 'INT2204 1',
      name: 'Lập trình hướng đối tượng',
      credits: 3,
      slots: '58/60',
      isFull: false
    },
    {
      rowIndex: '218',
      code: 'INT2211 2',
      name: 'Cơ sở dữ liệu',
      credits: 4,
      slots: '44/50',
      isFull: false
    },
    {
      rowIndex: '305',
      code: 'PE1003 1',
      name: 'Giáo dục thể chất (Bóng chuyền)',
      credits: 2,
      slots: '60/60',
      isFull: true
    },
    {
      rowIndex: '419',
      code: 'FLF1107 4',
      name: 'Tiếng Anh B1',
      credits: 3,
      slots: '35/40',
      isFull: false
    }
  ];

  const courseTableEl = document.getElementById('sim-course-table');
  const queueListEl = document.getElementById('sim-queue-list');
  const queueCountEl = document.getElementById('sim-queue-count');
  const customInputEl = document.getElementById('sim-custom-input');
  const addBtnEl = document.getElementById('sim-add-btn');
  const fastBtnEl = document.getElementById('sim-fast-btn');
  const autoBtnEl = document.getElementById('sim-auto-btn');
  const resetBtnEl = document.getElementById('sim-reset-btn');
  const toastEl = document.getElementById('sim-toast');

  if (!courseTableEl || !queueListEl) return;

  let queue = [];
  let isProcessing = false;
  let autoTimer = null;
  let autoCycleCount = 0;

  function initDefaultQueue() {
    queue = [
      {
        id: '142',
        code: 'INT2204 1',
        name: 'Lập trình hướng đối tượng',
        status: 'idle', // 'idle' | 'sending' | 'success' | 'retry'
        pingMs: 0,
        attempts: 0,
        isFullInitially: false
      },
      {
        id: '218',
        code: 'INT2211 2',
        name: 'Cơ sở dữ liệu',
        status: 'idle',
        pingMs: 0,
        attempts: 0,
        isFullInitially: false
      },
      {
        id: '305',
        code: 'PE1003 1',
        name: 'Giáo dục thể chất (Bóng chuyền)',
        status: 'idle',
        pingMs: 0,
        attempts: 0,
        isFullInitially: true
      }
    ];
  }

  function showToast(htmlMsg, tone) {
    if (!toastEl) return;
    toastEl.className = 'sim-toast' + (tone ? ' toast-' + tone : '');
    toastEl.innerHTML = htmlMsg;
  }

  function renderCourseTable() {
    courseTableEl.innerHTML = '';
    SAMPLE_CATALOG.forEach(function (course) {
      const inQueue = queue.some(function (q) {
        return q.id === course.rowIndex || q.code.toLowerCase() === course.code.toLowerCase();
      });

      const tr = document.createElement('tr');
      if (inQueue) tr.className = 'row-selected';

      const tdIndex = document.createElement('td');
      tdIndex.innerHTML = '<span class="mono-badge">#' + course.rowIndex + '</span>';

      const tdCode = document.createElement('td');
      tdCode.className = 'mono-code';
      tdCode.textContent = course.code;

      const tdName = document.createElement('td');
      tdName.textContent = course.name;

      const tdSlots = document.createElement('td');
      tdSlots.innerHTML = course.isFull
        ? '<span class="slot-tag slot-full">' + course.slots + ' (Full)</span>'
        : '<span class="slot-tag slot-open">' + course.slots + '</span>';

      const tdAction = document.createElement('td');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = inQueue ? 'btn-pick picked' : 'btn-pick';
      btn.textContent = inQueue ? '✓ Đã thêm' : '+ Auto';
      btn.addEventListener('click', function () {
        if (inQueue) {
          removeFromQueue(course.rowIndex);
        } else {
          addCourseToQueue(course);
        }
      });
      tdAction.appendChild(btn);

      tr.appendChild(tdIndex);
      tr.appendChild(tdCode);
      tr.appendChild(tdName);
      tr.appendChild(tdSlots);
      tr.appendChild(tdAction);
      courseTableEl.appendChild(tr);
    });
  }

  function renderQueue() {
    queueListEl.innerHTML = '';
    if (queueCountEl) {
      queueCountEl.textContent = queue.length + ' môn';
    }

    if (queue.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'queue-empty';
      empty.textContent = 'Chưa có môn nào trong hàng đợi. Hãy bấm "+ Auto" ở bảng trên hoặc nhập mã môn!';
      queueListEl.appendChild(empty);
      return;
    }

    queue.forEach(function (item) {
      const card = document.createElement('div');
      card.className = 'queue-card status-' + item.status;
      card.dataset.id = item.id;

      const info = document.createElement('div');
      info.className = 'queue-card-info';
      info.innerHTML =
        '<span class="queue-rowindex">#' + item.id + '</span>' +
        '<strong class="queue-code">' + item.code + '</strong>' +
        '<span class="queue-name">' + item.name + '</span>';

      const right = document.createElement('div');
      right.className = 'queue-card-status';

      const badge = document.createElement('span');
      badge.className = 'status-pill pill-' + item.status;

      if (item.status === 'idle') {
        badge.innerHTML = '⏳ Sẵn sàng';
      } else if (item.status === 'sending') {
        badge.innerHTML = '<span class="spinner"></span> Đang gửi POST... (' + item.pingMs + 'ms)';
      } else if (item.status === 'success') {
        badge.innerHTML = '✅ Đã đăng ký (' + item.pingMs + 'ms)';
      } else if (item.status === 'retry') {
        badge.innerHTML = '⚠️ Lớp đầy (60/60) &bull; Chờ slot (Lần #' + item.attempts + ')';
      }

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'queue-remove-btn';
      removeBtn.title = 'Xóa khỏi danh sách';
      removeBtn.setAttribute('aria-label', 'Xóa ' + item.code);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', function () {
        removeFromQueue(item.id);
      });

      right.appendChild(badge);
      right.appendChild(removeBtn);

      card.appendChild(info);
      card.appendChild(right);
      queueListEl.appendChild(card);
    });
  }

  function addCourseToQueue(course) {
    const exists = queue.some(function (q) {
      return q.id === course.rowIndex;
    });
    if (exists) return;

    queue.push({
      id: course.rowIndex,
      code: course.code,
      name: course.name,
      status: 'idle',
      pingMs: 0,
      attempts: 0,
      isFullInitially: Boolean(course.isFull)
    });
    renderCourseTable();
    renderQueue();
    showToast('➕ Đã thêm <strong>' + course.code + '</strong> (#' + course.rowIndex + ') vào Live Queue.', 'info');
  }

  function removeFromQueue(id) {
    queue = queue.filter(function (q) {
      return q.id !== id;
    });
    renderCourseTable();
    renderQueue();
  }

  function handleCustomAdd() {
    if (!customInputEl) return;
    const raw = customInputEl.value.trim();
    if (!raw) return;

    const found = SAMPLE_CATALOG.find(function (c) {
      return c.rowIndex === raw || c.code.toLowerCase() === raw.toLowerCase();
    });

    if (found) {
      addCourseToQueue(found);
    } else {
      const isNumeric = /^\d+$/.test(raw);
      const customId = isNumeric ? raw : String(Math.floor(500 + Math.random() * 400));
      const customCode = isNumeric ? 'VNU' + raw + ' 1' : raw.toUpperCase();
      queue.push({
        id: customId,
        code: customCode,
        name: 'Học phần tự chọn VNU',
        status: 'idle',
        pingMs: 0,
        attempts: 0,
        isFullInitially: false
      });
      renderCourseTable();
      renderQueue();
      showToast('➕ Đã thêm học phần <strong>' + customCode + '</strong> (#' + customId + ') vào hàng đợi.', 'info');
    }
    customInputEl.value = '';
  }

  function sendSingleCourseSimulated(item, isAutoMode) {
    return new Promise(function (resolve) {
      if (item.status === 'success') {
        resolve();
        return;
      }

      item.status = 'sending';
      item.pingMs = 0;
      renderQueue();

      const duration = Math.floor(75 + Math.random() * 65);
      const startTime = performance.now();

      const timer = setInterval(function () {
        item.pingMs = Math.min(duration, Math.floor(performance.now() - startTime));
        renderQueue();
      }, 25);

      setTimeout(function () {
        clearInterval(timer);
        item.pingMs = duration;
        item.attempts += 1;

        // Nếu môn học đang full (VD: Giáo dục thể chất), lần đầu sẽ báo chờ slot,
        // sang vòng lặp Auto thứ 2 sẽ bắt được slot trống!
        if (item.isFullInitially && (!isAutoMode || item.attempts < 2)) {
          item.status = 'retry';
        } else {
          item.status = 'success';
        }
        renderQueue();
        resolve();
      }, duration + 180);
    });
  }

  async function runRegistrationBatch(isAutoMode) {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;

    const pendingItems = queue.filter(function (q) {
      return q.status !== 'success';
    });

    if (pendingItems.length === 0) {
      showToast('🎉 Toàn bộ các môn trong danh sách đều đã được ghi nhận thành công!', 'success');
      if (autoTimer) toggleAutoMode(false);
      isProcessing = false;
      return;
    }

    showToast(
      '🚀 Đang gửi chuỗi <code>POST /chon-mon-hoc/</code> bất đồng bộ cho <strong>' +
        pendingItems.length +
        ' môn</strong> (không gây đơ trình duyệt)...',
      'info'
    );

    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status !== 'success') {
        await sendSingleCourseSimulated(queue[i], isAutoMode);
      }
    }

    const successCount = queue.filter(function (q) {
      return q.status === 'success';
    }).length;
    const retryCount = queue.filter(function (q) {
      return q.status === 'retry';
    }).length;

    if (retryCount > 0) {
      showToast(
        '⚡ Đã ghi nhận <strong>' +
          successCount +
          '/' +
          queue.length +
          ' môn</strong>. Còn <strong>' +
          retryCount +
          ' môn</strong> lớp đầy (60/60) — Hãy bật <strong>🔁 Auto (2s)</strong> để tự động săn slot nhả ra!',
        'warning'
      );
    } else {
      showToast(
        '✅ Hoàn tất <code>POST /xac-nhan-dang-ky/1</code>: Đã đăng ký thành công <strong>' +
          successCount +
          '/' +
          queue.length +
          ' môn học</strong>!',
        'success'
      );
      if (autoTimer) toggleAutoMode(false);
    }

    isProcessing = false;
  }

  function toggleAutoMode(forceState) {
    const shouldEnable = typeof forceState === 'boolean' ? forceState : !autoTimer;

    if (!shouldEnable) {
      clearInterval(autoTimer);
      autoTimer = null;
      autoBtnEl.classList.remove('active');
      autoBtnEl.innerHTML = '🔁 Bật Auto (2s)';
      return;
    }

    // Nếu tất cả đã success thì reset môn full để người dùng xem hiệu ứng Auto săn slot
    const allSuccess = queue.every(function (q) {
      return q.status === 'success';
    });
    if (allSuccess) {
      initDefaultQueue();
      renderCourseTable();
      renderQueue();
    }

    autoCycleCount = 0;
    autoBtnEl.classList.add('active');
    autoBtnEl.innerHTML = '⏹ Đang Auto săn slot...';
    runRegistrationBatch(true);

    autoTimer = setInterval(function () {
      autoCycleCount += 1;
      runRegistrationBatch(true);
    }, 1800);
  }

  // Gắn sự kiện cho các nút điều khiển Simulator
  if (addBtnEl) {
    addBtnEl.addEventListener('click', handleCustomAdd);
  }
  if (customInputEl) {
    customInputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCustomAdd();
      }
    });
  }
  if (fastBtnEl) {
    fastBtnEl.addEventListener('click', function () {
      runRegistrationBatch(false);
    });
  }
  if (autoBtnEl) {
    autoBtnEl.addEventListener('click', function () {
      toggleAutoMode();
    });
  }
  if (resetBtnEl) {
    resetBtnEl.addEventListener('click', function () {
      if (autoTimer) toggleAutoMode(false);
      isProcessing = false;
      initDefaultQueue();
      renderCourseTable();
      renderQueue();
      showToast('↺ Đã đặt lại danh sách môn mẫu. Hãy thử bấm <strong>⚡ Đăng Ký Nhanh</strong>!', '');
    });
  }

  // Khởi chạy Simulator lần đầu
  initDefaultQueue();
  renderCourseTable();
  renderQueue();
})();

