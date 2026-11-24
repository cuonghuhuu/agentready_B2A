(() => {
  'use strict';

  const I18N = {
    en: {
      navDemo: 'Storefront Demo (v0.3)',
      eyebrow: 'LOCAL-FIRST · READ-ONLY · SSRF-PROTECTED',
      heroTitle: 'Website AI Readiness Scanner',
      heroSubtitle:
        'Inspect public websites for AI-agent discovery, Schema.org commerce data, semantic readability, and WebMCP signals with deterministic, evidence-backed scoring.',
      urlLabel: 'Public website URL',
      modeLabel: 'Scan mode',
      modeAuto: 'Auto-detect',
      modeCommerce: 'Commerce audit',
      modeGeneral: 'General website',
      scanButton: 'Run Scan',
      scanningButton: 'Scanning...',
      formNote:
        'Only public http:// and https:// URLs on ports 80/443 are permitted. Private/loopback IPs, credentials in URLs, and checkout mutations are blocked.',
      dismiss: 'Dismiss',
      progressTitle: 'Live Scan Progress',
      categoryBreakdown: 'Category Breakdown',
      capabilitiesTitle: 'Detected Signals vs. Verified Capabilities',
      verifiedCap: 'Verified Capabilities (HTTP)',
      detectedSig: 'Detected Static Signals',
      unverifiedCap: 'Unverified Capabilities',
      criteriaTitle: 'Detailed Evidence & Recommendations',
      exportJson: 'Export JSON',
      exportMd: 'Export Markdown',
      footerDisclaimer: 'AgentReady-defined scoring model, not an official industry certification.',
      footerDemoLink: 'Open v0.3 Fictional Storefront Demo',
      noneLabel: 'None',
      recommendedFixPrefix: 'Recommended fix: ',
      requestsUnit: 'request(s)',
      themeToLight: 'Light',
      themeToDark: 'Dark',
      steps: {
        validate_url: 'Validate URL & SSRF Rules',
        fetch_robots: 'Fetch & Parse robots.txt',
        fetch_homepage: 'Fetch Target HTML Document',
        fetch_sitemap: 'Discover & Parse sitemap.xml',
        fetch_llms: 'Check /llms.txt',
        fetch_agentready: 'Probe /agentready/ Endpoints',
        evaluate_score: 'Compute Deterministic Score'
      }
    },
    vi: {
      navDemo: 'Demo Cửa hàng (v0.3)',
      eyebrow: 'CHẠY CỤC BỘ · CHỈ ĐỌC · CHỐNG SSRF',
      heroTitle: 'Trình quét AI Readiness cho Website',
      heroSubtitle:
        'Kiểm tra website công khai về khả năng khám phá cho AI agent, dữ liệu thương mại Schema.org, độ dễ đọc ngữ nghĩa và tín hiệu WebMCP với thang điểm minh bạch có bằng chứng.',
      urlLabel: 'URL website công khai',
      modeLabel: 'Chế độ quét',
      modeAuto: 'Tự nhận diện',
      modeCommerce: 'Kiểm tra thương mại',
      modeGeneral: 'Website thông thường',
      scanButton: 'Quét ngay',
      scanningButton: 'Đang quét...',
      formNote:
        'Chỉ cho phép URL http:// và https:// công khai trên cổng 80/443. Chặn IP nội bộ/loopback, thông tin đăng nhập trong URL và mọi thao tác thanh toán/thay đổi dữ liệu.',
      dismiss: 'Đóng',
      progressTitle: 'Tiến trình quét thực tế',
      categoryBreakdown: 'Điểm theo Nhóm tiêu chí',
      capabilitiesTitle: 'Tín hiệu phát hiện vs. Khả năng đã kiểm chứng',
      verifiedCap: 'Khả năng đã kiểm chứng (HTTP)',
      detectedSig: 'Tín hiệu tĩnh phát hiện',
      unverifiedCap: 'Khả năng chưa kiểm chứng',
      criteriaTitle: 'Chi tiết Bằng chứng & Khuyến nghị',
      exportJson: 'Xuất JSON',
      exportMd: 'Xuất Markdown',
      footerDisclaimer: 'Thang điểm do AgentReady định nghĩa, không phải chứng nhận chính thức của ngành.',
      footerDemoLink: 'Mở Demo Cửa hàng giả lập v0.3',
      noneLabel: 'Không có',
      recommendedFixPrefix: 'Khuyến nghị khắc phục: ',
      requestsUnit: 'yêu cầu',
      themeToLight: 'Sáng',
      themeToDark: 'Tối',
      steps: {
        validate_url: 'Kiểm tra URL & luật chống SSRF',
        fetch_robots: 'Tải & phân tích robots.txt',
        fetch_homepage: 'Tải tài liệu HTML mục tiêu',
        fetch_sitemap: 'Tìm & phân tích sitemap.xml',
        fetch_llms: 'Kiểm tra /llms.txt',
        fetch_agentready: 'Kiểm tra /agentready/ công khai',
        evaluate_score: 'Tính điểm AI Readiness'
      }
    }
  };

  const STEP_ORDER = [
    'validate_url',
    'fetch_robots',
    'fetch_homepage',
    'fetch_sitemap',
    'fetch_llms',
    'fetch_agentready',
    'evaluate_score'
  ];

  const CIRCUMFERENCE = 2 * Math.PI * 58;

  let currentLang = localStorage.getItem('ar_lang') === 'vi' ? 'vi' : 'en';
  let currentTheme = localStorage.getItem('ar_theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  let activeFilter = 'ALL';
  let lastResult = null;
  let activeEventSource = null;
  let stepState = {};

  const els = {
    form: document.getElementById('scan-form'),
    urlInput: document.getElementById('url-input'),
    modeSelect: document.getElementById('mode-select'),
    scanBtn: document.getElementById('scan-btn'),
    errorPanel: document.getElementById('error-panel'),
    errorCode: document.getElementById('error-code'),
    errorMessage: document.getElementById('error-message'),
    errorDismiss: document.getElementById('error-dismiss'),
    progressPanel: document.getElementById('progress-panel'),
    progressCounter: document.getElementById('progress-counter'),
    stepList: document.getElementById('step-list'),
    resultsSection: document.getElementById('results-section'),
    disclaimerBar: document.getElementById('disclaimer-bar'),
    gaugeFill: document.getElementById('gauge-fill'),
    scoreValue: document.getElementById('score-value'),
    scoreSub: document.getElementById('score-sub'),
    gradeBadge: document.getElementById('grade-badge'),
    siteProfilePill: document.getElementById('site-profile-pill'),
    resultTitle: document.getElementById('result-title'),
    resultUrl: document.getElementById('result-url'),
    applicableChip: document.getElementById('applicable-chip'),
    coverageChip: document.getElementById('coverage-chip'),
    durationChip: document.getElementById('duration-chip'),
    categoryList: document.getElementById('category-list'),
    scoringVersionLabel: document.getElementById('scoring-version-label'),
    verifiedCapList: document.getElementById('verified-cap-list'),
    detectedSigList: document.getElementById('detected-sig-list'),
    unverifiedCapList: document.getElementById('unverified-cap-list'),
    criteriaList: document.getElementById('criteria-list'),
    statusFilters: document.getElementById('status-filters'),
    exportJsonBtn: document.getElementById('export-json-btn'),
    exportMdBtn: document.getElementById('export-md-btn'),
    langEn: document.getElementById('lang-en'),
    langVi: document.getElementById('lang-vi'),
    themeToggle: document.getElementById('theme-toggle'),
    themeLabel: document.getElementById('theme-label')
  };

  function t(key) {
    return I18N[currentLang][key] || I18N.en[key] || key;
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    els.themeLabel.textContent = currentTheme === 'dark' ? t('themeToLight') : t('themeToDark');
    localStorage.setItem('ar_theme', currentTheme);
  }

  function applyLanguage() {
    document.documentElement.lang = currentLang;
    els.langEn.classList.toggle('active', currentLang === 'en');
    els.langVi.classList.toggle('active', currentLang === 'vi');
    localStorage.setItem('ar_lang', currentLang);

    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      if (key && I18N[currentLang][key]) {
        node.textContent = I18N[currentLang][key];
      }
    });

    els.themeLabel.textContent = currentTheme === 'dark' ? t('themeToLight') : t('themeToDark');
    renderSteps();
    if (lastResult) {
      renderCriteria(lastResult.criteria);
      renderCapabilities(lastResult.capabilities);
    }
  }

  function showError(code, message) {
    els.errorCode.textContent = code || 'ERROR';
    els.errorMessage.textContent = message || 'Scan failed.';
    els.errorPanel.classList.remove('hidden');
  }

  function hideError() {
    els.errorPanel.classList.add('hidden');
  }

  function resetSteps() {
    stepState = {};
    for (const id of STEP_ORDER) {
      stepState[id] = { status: 'pending', detail: '' };
    }
    els.progressCounter.textContent = `0 ${t('requestsUnit')}`;
    renderSteps();
  }

  function renderSteps() {
    els.stepList.replaceChildren();
    for (const id of STEP_ORDER) {
      const st = stepState[id] || { status: 'pending', detail: '' };
      const li = document.createElement('li');
      li.className = 'step-item';
      li.setAttribute('data-status', st.status);

      const left = document.createElement('div');
      left.className = 'step-left';
      const dot = document.createElement('span');
      dot.className = 'step-dot';
      const label = document.createElement('span');
      label.textContent = I18N[currentLang].steps[id] || id;
      left.append(dot, label);

      const detail = document.createElement('span');
      detail.className = 'step-detail';
      detail.textContent = st.detail || st.status;

      li.append(left, detail);
      els.stepList.append(li);
    }
  }

  function renderCapabilities(caps) {
    const fill = (ul, items) => {
      ul.replaceChildren();
      if (!items || items.length === 0) {
        const li = document.createElement('li');
        li.textContent = t('noneLabel');
        ul.append(li);
        return;
      }
      for (const item of items) {
        const li = document.createElement('li');
        li.textContent = item;
        ul.append(li);
      }
    };
    fill(els.verifiedCapList, caps.verifiedCapabilities);
    fill(els.detectedSigList, caps.detectedSignals);
    fill(els.unverifiedCapList, caps.unverifiedCapabilities);
  }

  function renderCategories(categories) {
    els.categoryList.replaceChildren();
    for (const cat of categories) {
      const row = document.createElement('div');
      const top = document.createElement('div');
      top.className = 'cat-row-top';

      const name = document.createElement('span');
      name.textContent = cat.name;

      const score = document.createElement('span');
      score.className = 'cat-score-text';
      score.textContent = `${cat.awardedScore} / ${cat.applicableMaxScore} (max ${cat.maxScore})`;

      top.append(name, score);

      const track = document.createElement('div');
      track.className = 'cat-bar-track';
      const fill = document.createElement('div');
      fill.className = 'cat-bar-fill';
      const pct = cat.applicableMaxScore > 0 ? Math.round((cat.awardedScore / cat.applicableMaxScore) * 100) : 0;
      fill.style.width = `${pct}%`;
      track.append(fill);

      row.append(top, track);
      els.categoryList.append(row);
    }
  }

  function renderCriteria(criteria) {
    els.criteriaList.replaceChildren();
    const filtered = activeFilter === 'ALL' ? criteria : criteria.filter((c) => c.status === activeFilter);

    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'muted-text';
      empty.textContent = t('noneLabel');
      els.criteriaList.append(empty);
      return;
    }

    for (const c of filtered) {
      const card = document.createElement('article');
      card.className = 'criterion-card';

      const top = document.createElement('div');
      top.className = 'criterion-top';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'criterion-title-wrap';
      const idEl = document.createElement('span');
      idEl.className = 'crit-id';
      idEl.textContent = c.id;
      const titleEl = document.createElement('span');
      titleEl.className = 'crit-title';
      titleEl.textContent = c.title;
      titleWrap.append(idEl, titleEl);

      const right = document.createElement('div');
      right.className = 'crit-right';
      const pts = document.createElement('span');
      pts.className = 'crit-points';
      pts.textContent = `${c.awardedPoints} / ${c.maxPoints}`;
      const badge = document.createElement('span');
      badge.className = `status-badge status-${c.status}`;
      badge.textContent = c.status;
      right.append(pts, badge);

      top.append(titleWrap, right);

      const explanation = document.createElement('p');
      explanation.className = 'crit-explanation';
      explanation.textContent = c.explanation;

      const evList = document.createElement('ul');
      evList.className = 'crit-evidence';
      for (const ev of c.evidence || []) {
        const li = document.createElement('li');
        li.textContent = ev;
        evList.append(li);
      }

      const fix = document.createElement('p');
      fix.className = 'crit-fix';
      const fixStrong = document.createElement('strong');
      fixStrong.textContent = t('recommendedFixPrefix');
      const fixText = document.createTextNode(c.recommendedFix || '');
      fix.append(fixStrong, fixText);

      card.append(top, explanation, evList, fix);
      els.criteriaList.append(card);
    }
  }

  function renderResult(result) {
    lastResult = result;
    els.resultsSection.classList.remove('hidden');

    els.disclaimerBar.textContent = result.disclaimer;
    els.scoringVersionLabel.textContent = `v${result.scoringVersion}`;
    els.resultTitle.textContent = result.metadata?.pageTitle || result.origin;
    els.resultUrl.textContent = result.finalUrl || result.targetUrl;

    const s = result.summary;
    const pct = s.applicableMaxScore > 0 ? s.normalizedApplicableScore : 0;
    const offset = CIRCUMFERENCE * (1 - pct / 100);
    els.gaugeFill.style.strokeDasharray = String(CIRCUMFERENCE);
    els.gaugeFill.style.strokeDashoffset = String(offset);

    if (pct >= 75) els.gaugeFill.style.stroke = 'var(--pass)';
    else if (pct >= 50) els.gaugeFill.style.stroke = 'var(--partial)';
    else els.gaugeFill.style.stroke = 'var(--fail)';

    els.scoreValue.textContent = String(s.awardedScore);
    els.scoreSub.textContent = `/ ${s.applicableMaxScore}`;
    els.gradeBadge.textContent = `Grade ${s.grade}`;
    els.siteProfilePill.textContent = result.siteProfile;
    els.applicableChip.textContent = `Applicable: ${s.applicableMaxScore}/${s.totalMaxScore} (${pct}%)`;
    els.coverageChip.textContent = `Verified: ${s.verificationCoveragePercent}%`;
    els.durationChip.textContent = `${result.durationMs} ms · ${result.metadata?.requestsExecuted ?? 0} req`;

    renderCategories(result.categories);
    renderCapabilities(result.capabilities);
    renderCriteria(result.criteria);
  }

  function buildClientMarkdown(result) {
    const isVi = currentLang === 'vi';
    const s = result.summary;
    const lines = [
      `# ${isVi ? 'Báo cáo AI Readiness — AgentReady B2A' : 'AgentReady B2A — AI Readiness Scan Report'}`,
      '',
      `> ${result.disclaimer}`,
      '',
      `- **URL:** ${result.targetUrl}`,
      `- **Final URL:** ${result.finalUrl}`,
      `- **Profile:** \`${result.siteProfile}\``,
      `- **Score:** ${s.awardedScore}/${s.applicableMaxScore} applicable (${s.normalizedApplicableScore}%, Grade ${s.grade})`,
      `- **Verification Coverage:** ${s.verificationCoveragePercent}%`,
      '',
      '## Categories',
      '',
      '| Category | Awarded | Applicable Max | Max |',
      '| --- | ---: | ---: | ---: |',
      ...result.categories.map((c) => `| ${c.name} | ${c.awardedScore} | ${c.applicableMaxScore} | ${c.maxScore} |`),
      '',
      '## Criteria',
      ''
    ];
    for (const c of result.criteria) {
      lines.push(`### ${c.id} — ${c.title} (${c.awardedPoints}/${c.maxPoints} · ${c.status})`);
      lines.push(`- ${c.explanation}`);
      for (const ev of c.evidence) lines.push(`  - ${ev}`);
      lines.push(`- **Fix:** ${c.recommendedFix}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  function downloadBlob(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function setScanning(isScanning) {
    els.scanBtn.disabled = isScanning;
    els.scanBtn.textContent = isScanning ? t('scanningButton') : t('scanButton');
  }

  function runScan(rawUrl, mode) {
    hideError();
    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }

    resetSteps();
    els.progressPanel.classList.remove('hidden');
    setScanning(true);

    const streamUrl = `/api/scan/stream?url=${encodeURIComponent(rawUrl)}&mode=${encodeURIComponent(mode)}`;
    const es = new EventSource(streamUrl);
    activeEventSource = es;

    let completed = false;

    es.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse(event.data);
        stepState[data.step] = { status: data.status, detail: data.detail };
        els.progressCounter.textContent = `${data.requestCount ?? 0} ${t('requestsUnit')}`;
        renderSteps();
      } catch {
        // ignore malformed frame
      }
    });

    es.addEventListener('result', (event) => {
      completed = true;
      es.close();
      activeEventSource = null;
      setScanning(false);
      try {
        const result = JSON.parse(event.data);
        renderResult(result);
      } catch {
        showError('PARSE_ERROR', 'Failed to parse scan result payload.');
      }
    });

    es.addEventListener('scan_error', (event) => {
      completed = true;
      es.close();
      activeEventSource = null;
      setScanning(false);
      try {
        const err = JSON.parse(event.data);
        showError(err.code, err.message);
      } catch {
        showError('SCAN_ERROR', 'The scan failed.');
      }
    });

    es.onerror = () => {
      if (completed) return;
      es.close();
      activeEventSource = null;
      setScanning(false);
      showError('CONNECTION_ERROR', 'Lost connection to the local scanner stream (or rate limit exceeded).');
    };
  }

  // Event bindings
  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawUrl = els.urlInput.value.trim();
    if (!rawUrl) {
      showError('INVALID_URL', 'Please enter a public http:// or https:// website URL.');
      return;
    }
    runScan(rawUrl, els.modeSelect.value);
  });

  els.errorDismiss.addEventListener('click', hideError);

  els.langEn.addEventListener('click', () => {
    currentLang = 'en';
    applyLanguage();
  });

  els.langVi.addEventListener('click', () => {
    currentLang = 'vi';
    applyLanguage();
  });

  els.themeToggle.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme();
  });

  els.statusFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    activeFilter = btn.getAttribute('data-filter') || 'ALL';
    els.statusFilters.querySelectorAll('.filter-btn').forEach((b) => b.classList.toggle('active', b === btn));
    if (lastResult) renderCriteria(lastResult.criteria);
  });

  els.exportJsonBtn.addEventListener('click', () => {
    if (!lastResult) return;
    downloadBlob(`agentready-scan-${lastResult.scanId.slice(0, 8)}.json`, JSON.stringify(lastResult, null, 2), 'application/json');
  });

  els.exportMdBtn.addEventListener('click', () => {
    if (!lastResult) return;
    downloadBlob(`agentready-scan-${lastResult.scanId.slice(0, 8)}.md`, buildClientMarkdown(lastResult), 'text/markdown; charset=utf-8');
  });

  // Init
  applyTheme();
  applyLanguage();
})();
