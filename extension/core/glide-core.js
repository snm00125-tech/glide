/*!
 * Glide core — 유튜브 광고 차단 공통 스크립트 (PC 확장 프로그램 + 안드로이드 앱 공용)
 *
 * 실행 위치: 페이지의 MAIN world, document_start (유튜브 코드보다 먼저)
 * 입력: window.__GLIDE_BOOT__ = { platform, settings, filters }  (읽은 뒤 바로 지움)
 * 출력: 확장 → document 'glide:out' 이벤트(JSON 문자열) / 앱 → window.glideNative.postMessage
 *
 * 층 구성
 *   1) 광고 데이터 제거  : JSON.parse, fetch, XHR, ytInitial* 전역 변수 가로채서 광고 항목 삭제
 *   3) 자동 스킵·배속   : 광고 재생 감지 시 음소거 + 최대 배속 + 건너뛰기 + 끝으로 이동, 끝나면 복구
 *   +) 화면 광고 숨김   : CSS
 *   +) 백그라운드 재생  : document.hidden / visibilityState 고정 (안드로이드)
 * (2층 광고 서버 차단은 각 플랫폼이 네트워크 단계에서 처리)
 *
 * 유튜브가 구조를 바꾸면 먼저 core/filters.json을 고치세요. 이 파일은 동작 방식이 바뀔 때만 수정합니다.
 */
(function () {
  'use strict';

  var CORE_VERSION = '1.0.8';
  var CORE_API = 4; // filters.json의 minCore와 비교

  var W = window;
  var MARK = Symbol.for('glide.core');
  if (W[MARK]) return;
  try { Object.defineProperty(W, MARK, { value: CORE_VERSION }); } catch (e) { /* ignore */ }

  // ---------------------------------------------------------------------------
  // 원본 함수 보관 (훅 설치 전에)
  // ---------------------------------------------------------------------------
  var nativeParse = JSON.parse;
  var nativeStringify = JSON.stringify;
  var nativeFetch = W.fetch;
  var NativeResponse = W.Response;
  var now = function () { return Date.now(); };
  var perf = function () { return (W.performance && performance.now) ? performance.now() : Date.now(); };

  // ---------------------------------------------------------------------------
  // 부트 데이터
  // ---------------------------------------------------------------------------
  var boot = W.__GLIDE_BOOT__ || {};
  try { delete W.__GLIDE_BOOT__; } catch (e) { W.__GLIDE_BOOT__ = undefined; }

  var PLATFORM = boot.platform === 'android' ? 'android' : 'extension';
  var IS_MOBILE_SITE = location.hostname.indexOf('m.youtube.com') === 0;

  var DEFAULT_SETTINGS = {
    enabled: true, prune: true, network: true, skip: true, cosmetic: true,
    background: true, debug: false, quality: 'auto'
  };
  var S = assign({}, DEFAULT_SETTINGS, boot.settings || {});
  var F = normalizeFilters(boot.filters);
  var C = {}; // 컴파일된 필터

  function assign(t) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i];
      if (s) for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k];
    }
    return t;
  }
  function on(feature) { return !!(S.enabled && S[feature]); }
  function arr(v) { return Array.isArray(v) ? v : []; }

  function normalizeFilters(f) {
    f = f && typeof f === 'object' ? f : {};
    var p = f.prune || {}, pl = f.player || {}, aa = f.antiAdblock || {}, css = f.cssHide || {};
    var tm = f.timers || {}, fg = f.frameGuard || {}, rc = f.recovery || {}, ps = f.pageScripts || {}, dg = f.diag || {};
    return {
      version: String(f.version || 'builtin'),
      minCore: f.minCore || 1,
      prune: {
        urlPatterns: arr(p.urlPatterns), roots: p.roots ? arr(p.roots) : [''], keys: arr(p.keys),
        globals: arr(p.globals), removeItems: arr(p.removeItems),
        suspectKeyPattern: p.suspectKeyPattern || '', ignoreSuspect: arr(p.ignoreSuspect)
      },
      player: {
        selector: pl.selector || '.html5-video-player',
        adClasses: pl.adClasses ? arr(pl.adClasses) : ['ad-showing'],
        adUiSelectors: arr(pl.adUiSelectors),
        ssapPollMs: pl.ssapPollMs || 1000,
        weakEvidenceMaxMs: pl.weakEvidenceMaxMs || 6000,
        noEvidenceDiagMs: pl.noEvidenceDiagMs || 2000,
        maxUserRate: pl.maxUserRate || 4,
        skipSelectors: arr(pl.skipSelectors),
        maxRate: pl.maxRate || 16,
        fallbackRates: pl.fallbackRates ? arr(pl.fallbackRates) : [8, 4, 2],
        seekToEnd: pl.seekToEnd !== false,
        restoreGuardMs: pl.restoreGuardMs || 2500
      },
      antiAdblock: {
        selectors: arr(aa.selectors), dialogSelectors: arr(aa.dialogSelectors),
        backdropSelectors: arr(aa.backdropSelectors), autoDismiss: aa.autoDismiss !== false
      },
      cssHide: { common: arr(css.common), desktop: arr(css.desktop), mobile: arr(css.mobile) },
      background: { blockEvents: (f.background && f.background.blockEvents) ? arr(f.background.blockEvents) : ['visibilitychange', 'webkitvisibilitychange'] },
      stats: { secondsPerAd: (f.stats && f.stats.secondsPerAd) || 15 },
      timers: { boost: arr(tm.boost), recordMinMs: tm.recordMinMs || 2000 },
      frameGuard: { props: fg.props ? arr(fg.props) : ['fetch', 'Request'] },
      recovery: {
        enabled: rc.enabled === true, hosts: arr(rc.hosts), markers: arr(rc.markers), edits: arr(rc.edits),
        markerPattern: rc.markerPattern || '', refererSuffix: rc.refererSuffix || '',
        snackbarKey: rc.snackbarKey || '', umpLengths: arr(rc.umpLengths)
      },
      pageScripts: { hosts: arr(ps.hosts), removeInlineContaining: arr(ps.removeInlineContaining), blockPromiseHandlers: arr(ps.blockPromiseHandlers) },
      diag: { slowStartMs: dg.slowStartMs || 2500, stallMs: dg.stallMs || 4000 },
      plus: f.plus && typeof f.plus === 'object' ? f.plus : {},
      topicPacks: arr(f.topicPacks), // 보기 싫은 주제 묶음 (1.0.1, glide-plus 차단 · 추천 탭)
      android: f.android && typeof f.android === 'object' ? f.android : {}
    };
  }

  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function splitPath(p) { return p ? String(p).split('.') : []; }

  function compile() {
    var needles = {};
    C.keys = F.prune.keys.map(function (k) { var p = splitPath(k); needles[p[p.length - 1]] = 1; return p; });
    C.roots = F.prune.roots.map(splitPath);
    C.items = F.prune.removeItems.map(function (r) {
      var eq = r.indexOf('=');
      var path = splitPath(eq >= 0 ? r.slice(0, eq) : r);
      var value = eq >= 0 ? r.slice(eq + 1) : undefined;
      needles[value !== undefined ? value : path[path.length - 1]] = 1;
      return { path: path, value: value, label: r };
    });
    var list = Object.keys(needles);
    C.needleRe = list.length ? new RegExp('"(?:' + list.map(escRe).join('|') + ')"') : null;
    C.itemNeedleRe = C.items.length ? new RegExp('"(?:' + C.items.map(function (i) { return escRe(i.value !== undefined ? i.value : i.path[i.path.length - 1]); }).join('|') + ')"') : null;
    try { C.suspectRe = F.prune.suspectKeyPattern ? new RegExp(F.prune.suspectKeyPattern) : null; } catch (e) { C.suspectRe = null; }
    C.pruneKeySet = {};
    F.prune.keys.forEach(function (k) { C.pruneKeySet[splitPath(k)[0]] = 1; });
    F.prune.ignoreSuspect.forEach(function (k) { C.pruneKeySet[k] = 1; });
    C.adClasses = F.player.adClasses;
  }
  compile();

  // ---------------------------------------------------------------------------
  // 호스트(확장/앱)와 통신
  // ---------------------------------------------------------------------------
  // 앱(안드로이드)은 웹뷰가 주입한 window.glideNative로 주고받음. 주입이 이 스크립트보다 늦을 수 있어 보낼 때마다 확인
  var nativePort = null;
  function attachNative() {
    if (nativePort || PLATFORM !== 'android' || !W.glideNative) return !!nativePort;
    nativePort = W.glideNative;
    try { nativePort.onmessage = function (e) { onInbound(e.data); }; } catch (e) { /* ignore */ }
    hostReady = true;
    var q = outQueue; outQueue = [];
    for (var i = 0; i < q.length; i++) deliver(q[i]);
    return true;
  }
  var hostReady = false;
  var outQueue = [];
  /** 오프라인 저장 중인지 (앱 전용 기능이 html[data-glide-capture]로 표시) */
  function capturing() { var h = document.documentElement; return !!(h && h.dataset && h.dataset.glideCapture); }
  /** 큰 데이터(오프라인 저장 조각)를 앱으로 바로 보냄. 앱이 바이너리 메시지를 못 받으면 false (호출 쪽이 다른 방법을 씀) */
  function sendBinary(buf) {
    if (PLATFORM !== 'android') return false;
    attachNative();
    if (!nativePort || !hostReady) return false;
    try { nativePort.postMessage(buf); return true; } catch (e) { return false; }
  }

  function send(type, data) {
    var msg = nativeStringify({ type: type, data: data, t: now(), page: location.pathname });
    if (PLATFORM === 'android') attachNative();
    if (!hostReady) { if (outQueue.length < 300) outQueue.push(msg); return; }
    deliver(msg);
  }
  function deliver(msg) {
    try {
      if (nativePort) nativePort.postMessage(msg);
      else document.dispatchEvent(new CustomEvent('glide:out', { detail: msg }));
    } catch (e) { /* ignore */ }
  }
  function flushQueue() {
    hostReady = true;
    var q = outQueue; outQueue = [];
    for (var i = 0; i < q.length; i++) deliver(q[i]);
  }

  // level: debug | info | warn | error. debug/info는 디버그 모드에서만 전송
  // 같은 내용이 1분 안에 반복되면 보내지 않고 세었다가, 다음에 보낼 때 반복 횟수를 붙임
  var logSeen = new Map();
  function log(level, area, msg, extra) {
    if ((level === 'debug' || level === 'info') && !S.debug) return;
    var key = level + area + msg, t = now(), seen = logSeen.get(key);
    if (seen && t - seen.t < 60000) { seen.n++; return; }
    if (seen && seen.n) msg += ' (직전 1분 동안 ' + seen.n + '회 더 반복)';
    logSeen.set(key, { t: t, n: 0 });
    if (logSeen.size > 300) logSeen.delete(logSeen.keys().next().value);
    send('log', { level: level, area: area, msg: msg, extra: extra });
  }
  function stat(kind, n, seconds) { send('stat', { kind: kind, n: n || 0, seconds: seconds || 0 }); }

  function onInbound(raw) {
    var m;
    try { m = typeof raw === 'string' ? nativeParse(raw) : raw; } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (!hostReady && PLATFORM !== 'android') flushQueue();
    if (m.filters) applyFilters(m.filters);
    if (m.settings) applySettings(m.settings);
    if (m.cmd) runCommand(m.cmd, m.arg);
  }
  document.addEventListener('glide:in', function (e) { onInbound(e.detail); });
  if (PLATFORM === 'android' && !attachNative()) {
    // 주입이 늦는 경우: 문서 준비 시점과 몇 차례 더 확인 (쌓아 둔 메시지를 보내기 위해)
    document.addEventListener('DOMContentLoaded', attachNative, { once: true });
    var earlyTimeout = W.setTimeout; // 이 시점엔 아직 가로채기 전 원본
    [50, 200, 1000, 3000].forEach(function (ms) { earlyTimeout.call(W, attachNative, ms); });
  }

  function applySettings(next) {
    var prev = S;
    S = assign({}, DEFAULT_SETTINGS, next);
    if (prev.debug !== S.debug && S.debug) logBootInfo();
    updateCosmetic();
    updateDetectStyle();
    if (!on('skip') && SK.inAd) exitAd(SK.player, SK.video, '설정 꺼짐');
    if (prev.quality !== S.quality) {
      var mp = mainPlayer();
      var mv = mp && videoOf(mp);
      // 재생 중인 영상(본편 재생 2.5초 넘음·위치 2초 넘음·듣기 모드 영상)의 화질은 바꾸지 않음: 다음 영상부터 새 설정
      // (재생 중 화질 변경 = 처음부터 다시 불러옴, 1.5.5). 예: 화면을 끄고 데이터로 듣다가 집 와이파이에 연결돼 화질 설정이 바뀌는 경우
      var cvid = mp ? currentVideoId(mp) : '';
      if (mv && ((mv.currentTime || 0) > 2 || inProgress(cvid) || (qualityListen && qualityListen === cvid))) mp = null;
      // 고정했던 화질을 '자동'으로 되돌리면 지금 영상의 고정도 풂 (예: 와이파이 1080p → 데이터 자동)
      if (mp && S.quality === 'auto' && qualityDone) {
        try { if (mp.setPlaybackQualityRange) mp.setPlaybackQualityRange('auto', 'auto'); if (mp.setPlaybackQuality) mp.setPlaybackQuality('auto'); log('info', 'quality', '화질 자동으로 되돌림'); } catch (e) { /* ignore */ }
      }
      qualityDone = '';
      if (mp) applyQuality(mp);
    }
    BG.active = PLATFORM === 'android' && on('background');
    notify(settingsListeners, S);
  }

  function applyFilters(next) {
    var nf = normalizeFilters(next);
    if (nf.minCore > CORE_API) {
      log('warn', 'filters', '필터 ' + nf.version + '는 더 새 코어(API ' + nf.minCore + ')가 필요해서 적용하지 않음. 현재 코어 API ' + CORE_API);
      return;
    }
    F = nf;
    compile();
    updateCosmetic();
    updateDetectStyle();
    log('info', 'filters', '필터 적용: ' + F.version);
    notify(filtersListeners, F);
  }

  // ---------------------------------------------------------------------------
  // 편의 기능(glide-plus.js)과의 연결
  // ---------------------------------------------------------------------------
  var settingsListeners = [], filtersListeners = [], commandHandlers = {}, transformers = [];
  function notify(list, value) {
    for (var i = 0; i < list.length; i++) { try { list[i](value); } catch (e) { log('error', 'plus', '설정 반영 오류: ' + e.message); } }
  }
  function transformersActive() {
    if (!S.enabled) return false;
    for (var i = 0; i < transformers.length; i++) { try { if (transformers[i].active()) return true; } catch (e) { /* ignore */ } }
    return false;
  }
  // 응답 객체를 편의 기능에 넘김 (채널·키워드 차단, 가장 많이 본 구간 수집). 바뀐 게 있으면 true
  function runTransformers(obj, src) {
    var changed = false;
    for (var i = 0; i < transformers.length; i++) {
      var t = transformers[i];
      try { if (t.active() && t.run(obj, src)) changed = true; } catch (e) { log('error', 'plus', '응답 처리 오류 (' + (t.name || '?') + '): ' + e.message); }
    }
    return changed;
  }

  // ---------------------------------------------------------------------------
  // 함수 위장 (toString이 [native code]를 돌려주도록)
  // ---------------------------------------------------------------------------
  var fnToString = Function.prototype.toString;
  var disguised = new WeakMap();
  function disguise(fake, original) {
    disguised.set(fake, original);
    try { Object.defineProperty(fake, 'name', { value: original.name, configurable: true }); } catch (e) { /* ignore */ }
    try { Object.defineProperty(fake, 'length', { value: original.length, configurable: true }); } catch (e) { /* ignore */ }
    return fake;
  }
  var toStringProxy = function toString() {
    var o = disguised.get(this);
    return fnToString.call(typeof o === 'function' ? o : this);
  };
  disguised.set(toStringProxy, fnToString);
  try { Function.prototype.toString = toStringProxy; } catch (e) { /* ignore */ }

  // ===========================================================================
  // 재생 지연 타이머 줄이기 + 진단용 기록
  //   광고 차단이 감지되면 유튜브가 재생 시작을 늦추는 타이머를 겁니다.
  //   filters.json timers.boost 규칙에 맞는 타이머는 지연 시간을 줄이고,
  //   긴 타이머는 모두 기록해 두었다가 '재생 시작까지 걸린 시간' 로그에 함께 남깁니다.
  // ===========================================================================
  var nativeSetTimeout = W.setTimeout;
  var nativeClearTimeout = W.clearTimeout;
  var longTimers = [];
  function timerSig(fn) {
    if (typeof fn !== 'function') return '(문자열 코드)';
    try { return fnToString.call(fn).slice(0, 240).replace(/\s+/g, ' ').slice(0, 90); } catch (e) { return '?'; }
  }
  W.setTimeout = disguise(function setTimeout(fn, delay) {
    var d = +delay || 0;
    if (d >= F.timers.recordMinMs && S.enabled) {
      try {
        var sig = timerSig(fn), rule = null, b = F.timers.boost;
        for (var i = 0; i < b.length; i++) {
          var r = b[i];
          if (d >= (r.min || 0) && d <= (r.max || Infinity) && sig.indexOf(r.match || '') !== -1) { rule = r; break; }
        }
        longTimers.push({ t: now(), d: d, sig: sig, boosted: !!rule });
        if (longTimers.length > 40) longTimers.shift();
        if (rule) {
          arguments[1] = Math.max(1, Math.round(d * (rule.factor || 0)));
          log('info', 'timer', '지연 타이머 ' + d + 'ms → ' + arguments[1] + 'ms로 줄임: ' + sig);
        }
      } catch (e) { /* ignore */ }
    }
    return nativeSetTimeout.apply(this, arguments);
  }, nativeSetTimeout);

  // 유튜브가 새 iframe에서 원본 fetch 등을 꺼내 가로채기를 피하지 못하게 함
  (function guardFrames() {
    function fix(node) {
      if (!node || node.nodeName !== 'IFRAME' || !S.enabled) return;
      var w;
      try { w = node.contentWindow; } catch (e) { return; }
      if (!w) return;
      var props = F.frameGuard.props;
      for (var i = 0; i < props.length; i++) {
        try { if (w[props[i]] !== W[props[i]]) w[props[i]] = W[props[i]]; } catch (e) { /* 다른 출처 iframe */ }
      }
    }
    var NP = Node.prototype, EP = Element.prototype;
    ['appendChild', 'insertBefore', 'replaceChild'].forEach(function (m) {
      var orig = NP[m];
      if (!orig) return;
      NP[m] = disguise(function () { var r = orig.apply(this, arguments); fix(arguments[0]); return r; }, orig);
    });
    ['append', 'prepend', 'after', 'before'].forEach(function (m) {
      var orig = EP[m];
      if (!orig) return;
      EP[m] = disguise(function () { var r = orig.apply(this, arguments); for (var i = 0; i < arguments.length; i++) fix(arguments[i]); return r; }, orig);
    });
  })();

  // ===========================================================================
  // 페이지 감시 스크립트 무력화 (www.youtube.com)
  //   - 유튜브 페이지에 들어 있는 fetch 감시 인라인 스크립트를 실행 전에 비움 (uBO: rmnt script window,"fetch")
  //   - 유튜브가 '비정상(광고 차단) 감지' 때 실행하는 처리 함수를 빈 함수로 바꿈 (uBO: Promise.then onAbnormalityDetected)
  // ===========================================================================
  function hostIn(list) { return list.indexOf(location.hostname) !== -1; }

  var ttPolicy = null;
  function trustedScript(text) {
    try {
      if (!ttPolicy && W.trustedTypes && W.trustedTypes.createPolicy) ttPolicy = W.trustedTypes.createPolicy('glide', { createScript: function (x) { return x; } });
    } catch (e) { /* 정책 이름이 막힌 경우 */ }
    return ttPolicy ? ttPolicy.createScript(text) : text;
  }

  (function stripInlineScripts() {
    var needles = F.pageScripts.removeInlineContaining;
    if (!needles.length || !hostIn(F.pageScripts.hosts) || typeof MutationObserver !== 'function') return;
    var mo = new MutationObserver(function (records) {
      if (!S.enabled) return;
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeName !== 'SCRIPT' || n.src) continue;
          var text = n.textContent || '';
          for (var k = 0; k < needles.length; k++) {
            if (text.indexOf(needles[k]) !== -1) {
              // 유튜브는 Trusted Types 정책이라 스크립트 내용을 그냥 바꿀 수 없음:
              // 실행되지 않는 종류로 바꾸고(이 속성은 허용됨), 가능하면 Glide 정책으로 내용도 비움
              n.type = 'text/plain';
              try { n.textContent = trustedScript(''); } catch (e) { /* 종류만 바꿔도 실행 안 됨 */ }
              log('info', 'page', '감시 스크립트 무력화 (' + needles[k] + ', ' + text.length + '자)');
              break;
            }
          }
        }
      }
    });
    mo.observe(document, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', function () { mo.disconnect(); }, { once: true });
  })();

  (function blockPromiseHandlers() {
    var names = F.pageScripts.blockPromiseHandlers;
    if (!names.length || !hostIn(F.pageScripts.hosts)) return;
    var origThen = Promise.prototype.then;
    var verdict = new WeakMap(); // 함수별 판정 캐시 (같은 콜백을 매번 문자열로 바꾸지 않도록)
    var noop = function () {};
    Promise.prototype.then = disguise(function then(onFulfilled) {
      if (typeof onFulfilled === 'function' && S.enabled) {
        var bad = verdict.get(onFulfilled);
        if (bad === undefined) {
          bad = false;
          try {
            var src = fnToString.call(onFulfilled);
            for (var i = 0; i < names.length; i++) if (src.indexOf(names[i]) !== -1) { bad = true; break; }
          } catch (e) { /* ignore */ }
          verdict.set(onFulfilled, bad);
          if (bad) log('info', 'page', '비정상 감지 처리 함수를 무력화 (' + names.join(',') + ')');
        }
        if (bad) {
          var args = Array.prototype.slice.call(arguments);
          args[0] = noop;
          return origThen.apply(this, args);
        }
      }
      return origThen.apply(this, arguments);
    }, origThen);
  })();

  // ===========================================================================
  // 재생 멈춤 복구 (www.youtube.com)
  //   uBlock Origin quick-fixes(2026-11-17)의 유튜브 스크립트를 옮긴 것 (uAssets, GPLv3).
  //   광고 데이터를 지우면 유튜브가 광고를 끼워 보내는 스트림(USDAI·SABR)에서 재생이 멈출 수 있음.
  //   유튜브 내부 신호(재생 중단 알림, 특정 스트리밍 메시지)가 왔고 버퍼 0.00 s·해상도 0x0으로
  //   실제로 멈춘 게 확인될 때만, 요청에 marker를 붙여 다시 불러옴 → 서버가 광고 없는 스트림을 줌.
  //   marker는 ytcfg INNERTUBE_CONTEXT.client.userAgent에 붙이고, JSON.stringify 단계에서
  //   해당 marker의 요청 수정(edits)을 적용함. 안 되면 다음 marker로, 다 쓰면 원래대로.
  // ===========================================================================
  var RC = { ready: false, base: [], list: [], flagged: false, origUA: null, marker: '', lastCheck: 0, reloads: 0, pollUntil: 0 };
  function rcActive() { return S.enabled && S.prune && F.recovery.enabled && hostIn(F.recovery.hosts) && !isPremium(); }
  function isPremium() {
    try {
      var d = W.ytInitialData;
      if (d && d.topbar && d.topbar.desktopTopbarRenderer && getPath(d.topbar.desktopTopbarRenderer, ['logo', 'topbarLogoRenderer', 'iconImage', 'iconType']) === 'YOUTUBE_PREMIUM_LOGO') return true;
      var m = document.getElementById('masthead');
      return !!(m && m.getAttribute('logo-type') === 'YOUTUBE_PREMIUM_LOGO');
    } catch (e) { return false; }
  }
  function innertubeClient() {
    try { return W.ytcfg.data_.INNERTUBE_CONTEXT.client; } catch (e) { return null; }
  }
  function rcInit() {
    if (RC.ready || !hostIn(F.recovery.hosts)) return;
    var c = innertubeClient();
    if (!c || typeof c.userAgent !== 'string') return; // ytcfg가 아직 없음: 신호·페이지 준비 때 다시 시도
    RC.origUA = c.userAgent;
    RC.base = F.recovery.markers.slice();
    RC.list = RC.base.slice();
    RC.ready = true;
  }
  function setMarker(m) {
    var c = innertubeClient();
    if (!c || typeof RC.origUA !== 'string') return;
    var head = RC.origUA.match(/Mozilla\/5\.0 \([^)]+/);
    c.userAgent = m && head ? RC.origUA.replace(head[0], head[0] + '; ' + m) : RC.origUA;
    RC.marker = m || '';
  }
  function rcSnapshot() {
    var p = document.getElementById('movie_player'), s = { p: p };
    if (!p) return s;
    try { s.resp = p.getPlayerResponse && p.getPlayerResponse(); } catch (e) { /* ignore */ }
    try { s.stats = p.getStatsForNerds && p.getStatsForNerds(); } catch (e) { /* ignore */ }
    try { s.prog = p.getProgressState && p.getProgressState(); } catch (e) { /* ignore */ }
    try { var o = p.getPlayerStateObject && p.getPlayerStateObject(); s.buffering = !!(o && o.isBuffering); } catch (e) { /* ignore */ }
    return s;
  }
  function rcStuck(s) {
    return !!s.buffering && !!s.stats && s.stats.buffer_health_seconds === '0.00 s' && s.stats.resolution === '0x0' && RC.list.length > 0;
  }
  // 유튜브 내부의 '멈춤' 신호 (uBO의 i())
  function rcSignal(why) {
    if (!RC.ready || RC.flagged || !rcActive()) return;
    var s = rcSnapshot();
    if (!s.p || !rcStuck(s)) return;
    var track = getPath(s.resp, ['playbackTracking', 'videostatsPlaybackUrl', 'baseUrl']);
    if (typeof track === 'string' && track.indexOf('reloadxhr') !== -1) RC.list = RC.list.slice(1);
    RC.flagged = true; RC.flagVid = urlVideoId() || '';
    log('warn', 'start', '재생 멈춤 신호 (' + why + ') · ' + nerdStats(s.p));
    // 페이지를 다 불러오기 전(DOMContentLoaded 전)에 영상을 다시 불러오면 플레이어가 아예 멈춤(2026-11-20 엣지 실측).
    // uBO도 신호 때는 표시만 하고 DOMContentLoaded 뒤 상태 확인에서 다시 불러옴 → 그때 rcCheck (아래 DOMContentLoaded 처리)
    if (document.readyState !== 'loading') nativeSetTimeout(rcCheck, 0);
  }
  function rcReload(p, vid, start, why) {
    RC.reloads++;
    log('warn', 'start', '"' + (RC.marker || '기본') + '" 방식으로 영상을 다시 불러옴 (' + why + ', ' + start + '초부터, ' + RC.reloads + '번째)');
    try { p.loadVideoById(vid, start); } catch (e) { log('error', 'start', '다시 불러오기 실패: ' + e.message); }
    var polling = RC.pollUntil > 0;
    RC.pollUntil = now() + 20000;
    if (!polling) nativeSetTimeout(rcPoll, 500);
  }
  // 다시 불러온 뒤에는 재생 불가 응답처럼 미디어 이벤트가 하나도 안 오는 경우가 있어(2026-11-20 엣지 실측: "channel" 방식 → UNPLAYABLE 화면),
  // 20초 동안 0.5초마다 상태를 확인해 다음 방식으로 넘어가게 함 (uBO는 화면이 바뀔 때마다 확인)
  function rcPoll() {
    if (!RC.pollUntil || now() > RC.pollUntil) { RC.pollUntil = 0; return; }
    var p = document.getElementById('movie_player');
    try { if (p && p.getPlayerState && p.getPlayerState() === 1) { RC.pollUntil = 0; return; } } catch (e) { /* ignore */ }
    try { rcCheck(); } catch (e) { /* ignore */ }
    nativeSetTimeout(rcPoll, 500);
  }
  // 상태 확인 (uBO의 e()). 페이지 변화 대신 미디어 이벤트·신호·응답 처리 때 호출
  function rcCheck() {
    if (!RC.ready || !rcActive()) return;
    var s = rcSnapshot(), p = s.p, href = location.href;
    if (!p || href.indexOf('/watch?') === -1) { RC.list = RC.base.slice(); return; }
    var resp = s.resp, prog = s.prog, stats = s.stats;
    var live = !!getPath(resp, ['videoDetails', 'isLive']);
    if (!((prog && prog.duration > 0 && (prog.loaded < prog.duration || prog.duration - prog.current > 1)) || live)) return;
    if (!stats || String(stats.debug_info || '').indexOf('SSAP, AD') === 0) return; // 서버 삽입 광고 재생 중: 3층에서 처리
    var vid = getPath(resp, ['videoDetails', 'videoId']);
    var start = getPath(resp, ['playerConfig', 'playbackStartConfig', 'startSeconds']) || parseInt(new URLSearchParams(location.search).get('t'), 10) || 0;
    var es = getPath(resp, ['playabilityStatus', 'errorScreen']);
    var runs = nativeStringify(getPath(es, ['playerErrorMessageRenderer', 'subreason', 'runs']) || getPath(es, ['playerInterstitialRenderer', 'content', 'interstitialViewModel', 'description', 'commandRuns'])) || '';
    var unplayable = getPath(resp, ['playabilityStatus', 'status']) === 'UNPLAYABLE' && !getPath(es, ['playerErrorMessageRenderer', 'playerCaptchaViewModel']) &&
      runs.indexOf('WEB_PAGE_TYPE_UNKNOWN') !== -1 && runs.indexOf('https://support.google.com/youtube/answer/3037019') !== -1;
    if (unplayable) {
      RC.list = RC.list.slice(1);
      setMarker(RC.list.length ? RC.list[0] : '');
      RC.flagged = false;
      rcReload(p, vid, start, '재생 불가 응답');
    } else if (RC.list.length === 0) {
      if (RC.marker) log('warn', 'start', '모든 방식을 써 봤지만 해결되지 않아 기본 방식으로 돌아감');
      RC.flagged = false;
      setMarker('');
    } else if (RC.flagged && RC.flagVid && RC.flagVid !== (urlVideoId() || '')) {
      RC.flagged = false; // 다른 영상으로 넘어감
    } else if (RC.flagged && rcStuck(s)) {
      setMarker(RC.list[0]);
      RC.flagged = false;
      rcReload(p, vid, start, '멈춤');
    } else if (!RC.flagged && prog && prog.current - start > 0.1 && prog.current - start < 5 && href.indexOf('&list=') !== -1) {
      // 다시 불러온 뒤 재생목록 연결이 끊긴 경우 되살림 (uBO와 같음)
      try {
        if (p.getPlaylistId && p.getPlaylistId() === null) {
          var mgr = document.querySelector('yt-playlist-manager');
          var data = mgr && mgr.getPlaylistData && mgr.getPlaylistData();
          if (data) {
            if (mgr.setPlaylistData) mgr.setPlaylistData(data);
            if (mgr.setPlayerPlaybackControlData) mgr.setPlayerPlaybackControlData({ playlistPanelRenderer: data });
            log('info', 'start', '재생목록 연결 복구');
          }
        }
      } catch (e) { /* ignore */ }
    }
  }
  function rcCheckSoon() {
    if (!RC.ready) return;
    var t = now();
    if (t - RC.lastCheck < 250) return;
    RC.lastCheck = t;
    rcCheck();
  }

  // 요청 수정: marker가 붙은 영상 정보 요청에만 적용 (uBO trusted-edit-inbound-object JSON.stringify)
  function rcEdit(v) {
    var ua = getPath(v, ['context', 'client', 'userAgent']);
    if (typeof ua !== 'string') return false;
    var changed = false;
    if (v.attestationRequest !== undefined) {
      var eds = F.recovery.edits;
      for (var i = 0; i < eds.length; i++) {
        var ed = eds[i];
        if (ua.indexOf(ed.marker) === -1) continue;
        var target = ed.path ? getPath(v, splitPath(ed.path)) : v;
        if (!target || typeof target !== 'object') continue;
        var ok = true;
        for (var k in (ed.if || {})) if (target[k] !== ed.if[k]) { ok = false; break; }
        if (!ok) continue;
        for (var m in (ed.merge || {})) target[m] = ed.merge[m];
        changed = true;
      }
      var cpc = getPath(v, ['playbackContext', 'contentPlaybackContext']);
      if (F.recovery.markerPattern && F.recovery.refererSuffix && cpc && new RegExp(F.recovery.markerPattern).test(ua)) {
        var ref = typeof cpc.referer === 'string' ? cpc.referer : '';
        if (ref.slice(-F.recovery.refererSuffix.length) !== F.recovery.refererSuffix) { cpc.referer = ref + F.recovery.refererSuffix; changed = true; }
      }
      if (changed) log('info', 'start', '영상 정보 요청에 "' + RC.marker + '" 방식 적용 [' + (v.videoId || '?') + ']');
    }
    // 댓글 작성 요청에는 marker를 빼서 보냄
    if (v.createCommentParams !== undefined && F.recovery.markerPattern) {
      var cleaned = ua.replace(new RegExp('; (' + F.recovery.markerPattern + ')\\b'), '');
      if (cleaned !== ua) { v.context.client.userAgent = cleaned; changed = true; }
    }
    return changed;
  }
  var hookedStringify = disguise(function stringify(value) {
    if (RC.marker && value && typeof value === 'object' && value.context !== undefined && (value.attestationRequest !== undefined || value.createCommentParams !== undefined)) {
      try {
        var copy = nativeParse(nativeStringify(value)); // 유튜브가 가진 원본 객체는 건드리지 않음
        if (rcEdit(copy)) {
          var args = Array.prototype.slice.call(arguments);
          args[0] = copy;
          return nativeStringify.apply(this, args);
        }
      } catch (e) { log('error', 'start', '요청 수정 실패: ' + e.message); }
    }
    return nativeStringify.apply(this, arguments);
  }, nativeStringify);
  try { JSON.stringify = hookedStringify; } catch (e) { /* ignore */ }

  // 유튜브 내부 신호 받기 (uBO: Map.prototype.has / Array.prototype.push 프록시). 가벼운 함수 래퍼로 구현
  (function hookSignals() {
    if (!hostIn(F.recovery.hosts)) return;
    var origHas = Map.prototype.has;
    Map.prototype.has = disguise(function has(key) {
      if (key === F.recovery.snackbarKey && !RC.flagged) { try { if (!RC.ready) rcInit(); if (RC.ready) rcSignal('재생 중단 알림'); } catch (e) { /* ignore */ } }
      return origHas.apply(this, arguments);
    }, origHas);
    var origPush = Array.prototype.push;
    Array.prototype.push = disguise(function push(item) {
      // 형식 배열(Uint8Array 등)만 먼저 거름 → 거의 모든 호출은 바로 통과.
      // ArrayBuffer.isView는 게터를 부르지 않음: 아무 객체에나 .length를 읽으면 유튜브가 push 하는 브라우저 객체에서
      // 'Illegal invocation'이 나 www.youtube.com 초기화가 멈추고 빈 화면이 됐음 (2026-11-20, PC 확장 시험에서 발견)
      if (item !== null && typeof item === 'object' && ArrayBuffer.isView(item) && (item.length === 104 || item.length === 105) && !RC.flagged &&
          F.recovery.umpLengths.indexOf(item.length) !== -1) {
        try {
          if (item.constructor && item.constructor.name === 'Uint8Array' && item.buffer && item.buffer.byteLength === item.length) { if (!RC.ready) rcInit(); if (RC.ready) rcSignal('스트리밍 메시지 ' + item.length + 'B'); }
        } catch (e) { /* ignore */ }
      }
      return origPush.apply(this, arguments);
    }, origPush);
  })();

  // ===========================================================================
  // 1층: 광고 데이터 제거
  // ===========================================================================
  var videoMeta = new Map(); // videoId → { len, ranges:[{s,e,done}] }
  var countedVideos = new Map(); // videoId → time (중복 집계 방지)
  var suspectSeen = {};

  function getPath(obj, path) {
    var o = obj;
    for (var i = 0; i < path.length; i++) {
      if (o === null || typeof o !== 'object') return undefined;
      o = o[path[i]];
    }
    return o;
  }
  function deletePath(obj, path) {
    var parent = path.length > 1 ? getPath(obj, path.slice(0, -1)) : obj;
    var key = path[path.length - 1];
    if (parent && typeof parent === 'object' && Object.prototype.hasOwnProperty.call(parent, key)) {
      var removed = parent[key];
      delete parent[key];
      return { removed: removed };
    }
    return null;
  }

  function rememberVideo(base) {
    var vd = base && base.videoDetails;
    if (!vd || !vd.videoId) return null;
    var m = videoMeta.get(vd.videoId) || { len: 0 };
    if (vd.lengthSeconds) m.len = +vd.lengthSeconds;
    if (vd.channelId) { m.channelId = vd.channelId; m.author = vd.author || m.author; }
    videoMeta.set(vd.videoId, m);
    if (videoMeta.size > 50) videoMeta.delete(videoMeta.keys().next().value);
    return vd.videoId;
  }

  // 기록 모드(디버그): 지우기 전 광고 데이터의 구조를 요약해서 남김. 유튜브 변화를 실제 데이터로 분석하기 위함
  var traced = {};
  function traceAds(base, src, vid) {
    if (!S.debug || !vid || traced[vid + src]) return;
    traced[vid + src] = 1;
    var parts = [];
    try {
      var pl = base.adPlacements;
      if (Array.isArray(pl)) {
        var kinds = {};
        pl.forEach(function (x) {
          var c = getPath(x, ['adPlacementRenderer', 'config', 'adPlacementConfig']) || {};
          var o = c.adTimeOffset || {};
          var k = String(c.kind || '?').replace('AD_PLACEMENT_KIND_', '') + (o.offsetStartMilliseconds !== undefined ? '@' + o.offsetStartMilliseconds + '~' + o.offsetEndMilliseconds : '');
          kinds[k] = (kinds[k] || 0) + 1;
        });
        parts.push('adPlacements: ' + Object.keys(kinds).slice(0, 16).map(function (k) { return k + (kinds[k] > 1 ? '×' + kinds[k] : ''); }).join(' '));
      }
      var sl = base.adSlots;
      if (Array.isArray(sl)) {
        var types = {};
        sl.forEach(function (x) {
          var md = getPath(x, ['adSlotRenderer', 'adSlotMetadata']) || {};
          var k = String(md.slotType || '?').replace('SLOT_TYPE_', '') + '/' + String(md.slotPhysicalPosition || '-') + '/' +
            Object.keys(getPath(x, ['adSlotRenderer', 'fulfillmentContent', 'fulfilledLayout']) || {}).join('+');
          types[k] = (types[k] || 0) + 1;
        });
        parts.push('adSlots: ' + Object.keys(types).map(function (k) { return k + (types[k] > 1 ? '×' + types[k] : ''); }).join(' '));
      }
      var sd = base.streamingData;
      if (sd) parts.push('스트림: ' + (sd.serverAbrStreamingUrl ? 'SABR' : 'URL') + (sd.adaptiveFormats ? ' 적응형 ' + sd.adaptiveFormats.length : ''));
      if (base.playerConfig) parts.push('playerConfig: ' + Object.keys(base.playerConfig).join(','));
      parts.push('최상위: ' + Object.keys(base).join(','));
    } catch (e) { parts.push('요약 실패 ' + e.message); }
    log('debug', 'trace', '응답 구조 (' + src + ') [' + vid + '] ' + parts.join(' · '));
  }

  function checkSuspects(base, where) {
    if (!C.suspectRe) return;
    for (var k in base) {
      if (C.pruneKeySet[k] || suspectSeen[k]) continue;
      if (C.suspectRe.test(k)) {
        suspectSeen[k] = 1;
        log('warn', 'data', '처리하지 않는 광고 의심 항목 발견: "' + k + '" (' + where + '). 광고가 새면 filters.json prune.keys에 추가 검토');
      }
    }
  }

  // 배열 안의 광고 항목(피드 광고 등) 제거
  function removeAdItems(root) {
    if (!C.items.length) return null;
    var removed = {}, total = 0, visited = 0;
    var stack = [root];
    while (stack.length) {
      var o = stack.pop();
      if (++visited > 400000) break;
      if (Array.isArray(o)) {
        for (var i = o.length - 1; i >= 0; i--) {
          var it = o[i];
          if (it && typeof it === 'object') {
            var hit = matchItem(it);
            if (hit) { o.splice(i, 1); removed[hit] = (removed[hit] || 0) + 1; total++; continue; }
            stack.push(it);
          }
        }
      } else {
        for (var k in o) {
          var v = o[k];
          if (v && typeof v === 'object') stack.push(v);
        }
      }
    }
    return total ? { total: total, by: removed } : null;
  }
  function matchItem(it) {
    for (var j = 0; j < C.items.length; j++) {
      var r = C.items[j];
      var v = getPath(it, r.path);
      if (v === undefined) continue;
      if (r.value === undefined || String(v) === r.value) return r.label;
    }
    return null;
  }

  /**
   * 객체에서 광고 항목을 제거. 반환값: 바뀐 게 있으면 true
   * @param {*} obj 파싱된 응답
   * @param {string} src 출처 (로그용)
   * @param {boolean} scanItems 피드 광고 항목까지 훑을지
   */
  function pruneObject(obj, src, scanItems) {
    if (!obj || typeof obj !== 'object') return false;
    var changed = false;
    var list = Array.isArray(obj) ? obj : [obj];
    var adsRemoved = 0, keysRemoved = [], videoId = null;

    for (var i = 0; i < list.length; i++) {
      var top = list[i];
      if (!top || typeof top !== 'object') continue;
      for (var r = 0; r < C.roots.length; r++) {
        var base = C.roots[r].length ? getPath(top, C.roots[r]) : top;
        if (!base || typeof base !== 'object' || Array.isArray(base)) continue;
        var vidHere = base.videoDetails && base.videoDetails.videoId;
        if (vidHere && C.keys.some(function (kp) { return getPath(base, kp) !== undefined; })) traceAds(base, src, vidHere);
        for (var k = 0; k < C.keys.length; k++) {
          var res = deletePath(base, C.keys[k]);
          if (!res) continue;
          changed = true;
          var name = C.keys[k].join('.');
          var rem = res.removed;
          if (name === 'adPlacements' && Array.isArray(rem)) adsRemoved += rem.length;
          else if (name === 'adSlots' && Array.isArray(rem) && !adsRemoved) adsRemoved += rem.length;
          keysRemoved.push(name + (Array.isArray(rem) ? '(' + rem.length + ')' : ''));
        }
        var vid = rememberVideo(base);
        if (vid) { videoId = vid; nativeSetTimeout(rcCheck, 500); }
        if (base.videoDetails || base.playabilityStatus) checkSuspects(base, src);
      }
    }

    if (keysRemoved.length) {
      log('info', 'data', '광고 데이터 제거 (' + src + '): ' + keysRemoved.join(', ') + (videoId ? ' [' + videoId + ']' : ''));
      var key = videoId || src;
      var last = countedVideos.get(key);
      if (adsRemoved && (!last || now() - last > 20000)) {
        countedVideos.set(key, now());
        if (countedVideos.size > 100) countedVideos.delete(countedVideos.keys().next().value);
        stat('pruned', adsRemoved, adsRemoved * F.stats.secondsPerAd);
      }
    }

    if (scanItems) {
      var items = removeAdItems(obj);
      if (items) {
        changed = true;
        log('info', 'data', '피드·화면 광고 항목 ' + items.total + '개 제거 (' + src + '): ' + Object.keys(items.by).map(function (k) { return k + '×' + items.by[k]; }).join(', '));
        stat('feed', items.total, 0);
      }
    }
    return changed;
  }

  // 재생 중 광고 지점에서 따로 받아오는 중간 광고 요청 (/player/ad_break)
  function logAdBreak(text, pruned) {
    var keys = '?';
    try { var o = nativeParse(text.replace(/^\)\]\}'\n?/, '')); keys = Object.keys(o).join(','); } catch (e) { /* ignore */ }
    log(pruned ? 'info' : 'warn', 'data', '중간 광고 요청(ad_break) 응답 ' + (pruned ? '처리함' : '그대로 통과') + ' · 남은 항목: ' + keys);
  }
  function urlMatches(url) {
    if (!url) return false;
    var p = F.prune.urlPatterns;
    for (var i = 0; i < p.length; i++) if (url.indexOf(p[i]) !== -1) return true;
    return false;
  }
  function shortUrl(url) {
    try { var u = new URL(url, location.href); return u.pathname; } catch (e) { return String(url).slice(0, 80); }
  }

  // 텍스트 응답 처리. 바뀌지 않으면 null
  function pruneText(text, src) {
    if (typeof text !== 'string') return null;
    var doPrune = on('prune') && !!C.needleRe && C.needleRe.test(text);
    var doPlus = transformersActive();
    if (!doPrune && !doPlus) return null;
    var prefix = '';
    var body = text;
    if (body.slice(0, 4) === ")]}'") { var nl = body.indexOf('\n'); prefix = body.slice(0, nl + 1); body = body.slice(nl + 1); }
    var obj;
    try { obj = nativeParse(body); } catch (e) { return null; }
    var changed = doPrune && pruneObject(obj, src, !!(C.itemNeedleRe && C.itemNeedleRe.test(body)));
    if (doPlus && runTransformers(obj, src)) changed = true;
    if (!changed) return null;
    return prefix + nativeStringify(obj);
  }

  // --- JSON.parse ---
  var hookedParse = disguise(function parse(text, reviver) {
    var r = nativeParse.apply(this, arguments);
    if (r !== null && typeof r === 'object' && on('prune')) {
      try { inspectParsed(r, text); } catch (e) { log('error', 'data', 'JSON.parse 처리 오류: ' + e.message); }
    }
    return r;
  }, nativeParse);
  try { JSON.parse = hookedParse; } catch (e) { /* ignore */ }

  function hasPlayerKeys(o) {
    for (var r = 0; r < C.roots.length; r++) {
      var base = C.roots[r].length ? getPath(o, C.roots[r]) : o;
      if (!base || typeof base !== 'object') continue;
      for (var k = 0; k < C.keys.length; k++) if (getPath(base, C.keys[k]) !== undefined) return true;
    }
    return false;
  }
  function inspectParsed(r, text) {
    var list = Array.isArray(r) ? r : [r];
    var hit = false;
    for (var i = 0; i < list.length && i < 8; i++) if (list[i] && typeof list[i] === 'object' && hasPlayerKeys(list[i])) { hit = true; break; }
    var scan = typeof text === 'string' && text.length > 2000 && C.itemNeedleRe && C.itemNeedleRe.test(text);
    if (hit || scan) pruneObject(r, 'JSON.parse', scan);
  }

  // --- fetch ---
  if (typeof nativeFetch === 'function') {
    var hookedFetch = disguise(function fetch(input, init) {
      var p = nativeFetch.apply(W, arguments);
      var url;
      try { url = typeof input === 'string' ? input : (input && input.url) || String(input); } catch (e) { url = ''; }
      if (!urlMatches(url) || (!on('prune') && !transformersActive())) return p;
      return p.then(function (res) {
        if (!res || res.type === 'opaque' || res.bodyUsed) return res;
        return res.clone().text().then(function (text) {
          var out = pruneText(text, 'fetch ' + shortUrl(url));
          if (url.indexOf('/ad_break') !== -1) logAdBreak(out !== null ? out : text, out !== null);
          if (out === null) return res;
          var nr = new NativeResponse(out, { status: res.status, statusText: res.statusText, headers: res.headers });
          try {
            Object.defineProperties(nr, {
              url: { value: res.url }, type: { value: res.type }, redirected: { value: res.redirected }
            });
          } catch (e) { /* ignore */ }
          return nr;
        }, function () { return res; });
      });
    }, nativeFetch);
    try { W.fetch = hookedFetch; } catch (e) { /* ignore */ }
  }

  // --- XMLHttpRequest ---
  (function hookXHR() {
    var XHR = W.XMLHttpRequest;
    if (!XHR) return;
    var proto = XHR.prototype;
    var urls = new WeakMap(), cache = new WeakMap();
    var origOpen = proto.open;
    proto.open = disguise(function open(method, url) {
      urls.set(this, String(url));
      cache.delete(this);
      return origOpen.apply(this, arguments);
    }, origOpen);

    var dText = Object.getOwnPropertyDescriptor(proto, 'responseText');
    var dResp = Object.getOwnPropertyDescriptor(proto, 'response');
    if (!dText || !dResp) return;

    function processed(xhr) {
      if (xhr.readyState !== 4) return null;
      if (cache.has(xhr)) return cache.get(xhr);
      var url = urls.get(xhr);
      var result = null;
      if (urlMatches(url) && (on('prune') || transformersActive())) {
        var type = xhr.responseType;
        try {
          if (type === '' || type === 'text') {
            var out = pruneText(dText.get.call(xhr), 'xhr ' + shortUrl(url));
            if (out !== null) result = out;
          } else if (type === 'json') {
            var obj = dResp.get.call(xhr);
            if (obj && typeof obj === 'object') {
              var ch = on('prune') && pruneObject(obj, 'xhr ' + shortUrl(url), true);
              if (transformersActive() && runTransformers(obj, 'xhr ' + shortUrl(url))) ch = true;
              if (ch) result = obj;
            }
          }
        } catch (e) { log('error', 'data', 'XHR 처리 오류: ' + e.message); }
      }
      cache.set(xhr, result);
      return result;
    }
    Object.defineProperty(proto, 'responseText', {
      configurable: true, enumerable: dText.enumerable,
      get: disguise(function () {
        var t = this.responseType;
        if (t === '' || t === 'text') { var p = processed(this); if (p !== null) return p; }
        return dText.get.call(this);
      }, dText.get)
    });
    Object.defineProperty(proto, 'response', {
      configurable: true, enumerable: dResp.enumerable,
      get: disguise(function () {
        var t = this.responseType;
        if (t === '' || t === 'text' || t === 'json') { var p = processed(this); if (p !== null) return p; }
        return dResp.get.call(this);
      }, dResp.get)
    });
  })();

  // --- ytInitialPlayerResponse 같은 전역 변수 ---
  F.prune.globals.forEach(trapGlobal);
  function trapGlobal(name) {
    var value = W[name];
    if (value && typeof value === 'object' && on('prune')) pruneObject(value, name, true);
    try {
      Object.defineProperty(W, name, {
        configurable: true, enumerable: true,
        get: function () { return value; },
        set: function (v) {
          if (v && typeof v === 'object' && on('prune')) {
            try { pruneObject(v, name, true); } catch (e) { log('error', 'data', name + ' 처리 오류: ' + e.message); }
          }
          if (v && typeof v === 'object' && transformersActive()) runTransformers(v, name);
          value = v;
        }
      });
    } catch (e) { log('error', 'data', name + ' 가로채기 실패: ' + e.message); }
  }

  // ===========================================================================
  // 감지용 CSS 애니메이션 (반복 감시 없이 요소 등장/클래스 변화를 이벤트로 받음)
  // ===========================================================================
  var ANIM = { adOn: 'glide-x-ad-on', adOff: 'glide-x-ad-off', adUi: 'glide-x-ad-ui', skip: 'glide-x-skip', warn: 'glide-x-warn' };
  var detectStyle = null, cosmeticStyle = null;

  function styleEl(id) {
    var s = document.createElement('style');
    s.setAttribute('data-glide', id);
    return s;
  }
  function mountStyle(s) {
    var parent = document.head || document.documentElement;
    if (parent && s.parentNode !== parent) parent.appendChild(s);
  }
  function rulesFor(selectors, body) {
    // 선택자 하나가 틀려도 나머지가 살도록 한 줄에 하나씩
    return selectors.map(function (s) { return s + '{' + body + '}'; }).join('\n');
  }

  function updateDetectStyle() {
    if (!detectStyle) detectStyle = styleEl('d');
    var css = '';
    var kf = '{from{opacity:1}to{opacity:1}}';
    css += '@keyframes ' + ANIM.adOn + kf + '@keyframes ' + ANIM.adOff + kf + '@keyframes ' + ANIM.adUi + kf + '@keyframes ' + ANIM.skip + kf + '@keyframes ' + ANIM.warn + kf + '\n';
    if (on('skip')) {
      var ps = F.player.selector;
      var adSel = C.adClasses.map(function (c) { return ps + '.' + c; });
      var notSel = ps + C.adClasses.map(function (c) { return ':not(.' + c + ')'; }).join('');
      css += rulesFor(adSel, 'animation:' + ANIM.adOn + ' 1ms') + '\n';
      css += notSel + '{animation:' + ANIM.adOff + ' 1ms}\n';
      css += rulesFor(F.player.skipSelectors, 'animation:' + ANIM.skip + ' 1ms') + '\n';
      css += rulesFor(F.player.adUiSelectors.map(function (x) { return ps + ' ' + x; }), 'animation:' + ANIM.adUi + ' 1ms') + '\n';
    }
    if (S.enabled) css += rulesFor(F.antiAdblock.selectors, 'animation:' + ANIM.warn + ' 1ms') + '\n';
    detectStyle.textContent = css;
    mountStyle(detectStyle);
  }

  function updateCosmetic() {
    if (!cosmeticStyle) cosmeticStyle = styleEl('c');
    if (!on('cosmetic')) { cosmeticStyle.textContent = ''; return; }
    var list = F.cssHide.common.concat(IS_MOBILE_SITE ? F.cssHide.mobile : F.cssHide.desktop);
    cosmeticStyle.textContent = rulesFor(list, 'display:none!important');
    mountStyle(cosmeticStyle);
  }

  function initStyles() {
    updateDetectStyle();
    updateCosmetic();
    if (document.readyState === 'loading') {
      // 문서 시작 시점에 <html>에 붙인 스타일은 파서가 지울 수 있어 문서 준비 때 다시 붙임
      document.addEventListener('DOMContentLoaded', function () { mountStyle(detectStyle); if (on('cosmetic')) mountStyle(cosmeticStyle); }, { once: true });
    }
  }

  // ===========================================================================
  // 3층: 자동 스킵 + 최대 배속
  // ===========================================================================
  var SK = {
    inAd: false, player: null, video: null, startedAt: 0, ads: 0, saved: 0, seen: null,
    contentRate: 1, rateKnown: false, lastRateChange: { prev: 1, t: 0 }, lastLoad: 0,
    contentMuted: false, contentVolume: 1, volKnown: false,
    appliedRate: 0, guardRate: 0, guardUntil: 0, restoreRate: 1, ssapCheck: 0, evidence: '',
    contentDur: 0, contentDurId: null, contentSrc: '', contentSrcId: null, noWeak: {}, ssapPoll: 0, recheck: 0,
    startPos: 0, muteGuardUntil: 0, waitLogged: 0
  };

  // 유튜브가 저장해 둔 음량 설정을 처음 값으로 사용 (첫 영상이 광고로 시작하는 경우 대비)
  (function readStoredVolume() {
    try {
      var raw = W.localStorage && localStorage.getItem('yt-player-volume');
      if (!raw) return;
      var outer = nativeParse(raw);
      var data = typeof outer.data === 'string' ? nativeParse(outer.data) : outer.data;
      if (data && typeof data.volume === 'number') {
        SK.contentVolume = Math.max(0, Math.min(1, data.volume / 100));
        SK.contentMuted = !!data.muted;
        SK.volKnown = true;
      }
    } catch (e) { /* ignore */ }
  })();

  function playerOf(el) { return el && el.closest ? el.closest(F.player.selector) : null; }
  function videoOf(player) { return player ? player.querySelector('video') : null; }
  function isAdShowing(player) {
    if (!player || !player.classList) return false;
    for (var i = 0; i < C.adClasses.length; i++) if (player.classList.contains(C.adClasses[i])) return true;
    return false;
  }
  function currentVideoId(player) {
    try { var d = player && player.getVideoData && player.getVideoData(); if (d && d.video_id) return d.video_id; } catch (e) { /* ignore */ }
    try {
      var u = new URL(location.href);
      var v = u.searchParams.get('v');
      if (v) return v;
      var m = u.pathname.match(/\/shorts\/([\w-]{6,})/);
      if (m) return m[1];
    } catch (e) { /* ignore */ }
    return null;
  }

  function setRate(v, rate) {
    var tries = [rate].concat(F.player.fallbackRates);
    for (var i = 0; i < tries.length; i++) {
      try { v.playbackRate = tries[i]; SK.appliedRate = tries[i]; return tries[i]; } catch (e) { /* 브라우저 한계 초과 → 다음 값 */ }
    }
    return 0;
  }

  // 광고 표시(클래스)만으로는 부족: 구간 이동 중 유튜브가 광고를 시도하다 실패하면 클래스만 잠깐 남고
  // 본편이 나오는 경우가 있음. 아래 근거 중 하나가 있어야 광고로 판정합니다.
  function adEvidence(player, v) {
    var sels = F.player.adUiSelectors;
    for (var i = 0; i < sels.length; i++) {
      var el;
      try { el = player.querySelector(sels[i]); } catch (e) { continue; }
      if (el && el.getClientRects().length) return 'UI ' + sels[i];
    }
    // 주소창 영상과 플레이어가 재생 중인 영상이 다르면 광고 (광고도 별도 영상 ID를 가짐)
    var urlId = location.pathname === '/watch' ? urlVideoId() : null;
    var dataId = null;
    try { var vd = player.getVideoData && player.getVideoData(); dataId = vd && vd.video_id; } catch (e) { /* ignore */ }
    if (urlId && dataId && urlId !== dataId) return '다른 영상 ID ' + dataId;
    try {
      var st = player.getStatsForNerds && player.getStatsForNerds();
      if (st && String(st.debug_info || '').indexOf('SSAP, AD') === 0) return 'SSAP';
    } catch (e) { /* ignore */ }
    // 약한 근거: 길이 차이. 영상 소스가 본편과 달라졌을 때만 인정 (구간 이동 중 광고 표시만 붙는 경우 방지)
    var key = urlId || dataId;
    var srcChanged = !!(v && SK.contentSrc && SK.contentSrcId === key && (v.currentSrc || v.src) !== SK.contentSrc);
    if (srcChanged && !SK.noWeak[key] && isFinite(v.duration) && v.duration > 0 && v.duration <= 180) {
      var meta = key && videoMeta.get(key);
      if (meta && meta.len && Math.abs(v.duration - meta.len) > 2.5) return '약함:길이 ' + v.duration.toFixed(1) + '초≠본편 ' + meta.len + '초';
      if (SK.contentDur && SK.contentDurId === key && Math.abs(v.duration - SK.contentDur) > 2.5) return '약함:길이 ' + v.duration.toFixed(1) + '초≠직전 본편 ' + SK.contentDur.toFixed(0) + '초';
    }
    return null;
  }

  var lastNoEvidence = 0, noEvTimer = 0, noEvReported = '';
  // 광고 표시가 계속되는데 근거를 못 찾으면, 플레이어 안의 광고 관련 클래스 이름을 로그로 남김
  // (유튜브가 광고 UI 이름을 바꾼 경우 filters.json player.adUiSelectors에 추가하면 됨)
  function scheduleNoEvidenceDiag(player) {
    if (noEvTimer) return;
    noEvTimer = nativeSetTimeout(function () {
      noEvTimer = 0;
      if (!isAdShowing(player) || SK.inAd) return;
      var v = videoOf(player);
      var ev = adEvidence(player, v);
      if (ev) { check(player, v, '지연 확인'); return; }
      var names = {};
      try {
        player.querySelectorAll('[class*="ad-"],[class*="-ad"],[class*="Ad"]').forEach(function (el) {
          String(el.className || '').split(/\s+/).forEach(function (c) { if (/ad/i.test(c) && c.indexOf('glide') === -1) names[c] = 1; });
        });
      } catch (e) { /* ignore */ }
      var list = Object.keys(names).slice(0, 20).join(' ');
      var key = (urlVideoId() || '') + list;
      if (key === noEvReported) return;
      noEvReported = key;
      var dataId = null;
      try { dataId = player.getVideoData().video_id; } catch (e) { /* ignore */ }
      log('warn', 'skip', '광고 표시가 ' + (F.player.noEvidenceDiagMs / 1000) + '초 넘게 있지만 광고 근거를 못 찾음 (영상 ' + (urlVideoId() || '-') + ' / 플레이어 ' + (dataId || '-') +
        ', 길이 ' + (v && isFinite(v.duration) ? v.duration.toFixed(1) : '-') + '초, ' + nerdStats(player) + '). 플레이어 안 광고 관련 클래스: ' + (list || '없음'));
    }, F.player.noEvidenceDiagMs);
  }
  // 광고가 계속되는 중인지: 광고 표시가 있거나, 서버 삽입 광고로 들어와서 아직 서버 삽입 광고 구간인 경우
  function adStillOn(player) {
    return isAdShowing(player) || (SK.inAd && SK.evidence.indexOf('SSAP') === 0 && ssapAd(player));
  }
  // 영상 요소에 아직 본편이 들어 있는지 (광고 영상으로 바뀌기 전 잠깐 동안). 이때 배속·이동을 하면 본편이 넘어감
  function stillContentMedia(player, v) {
    if (!v) return true;
    var key = urlVideoId() || currentVideoId(player);
    return !!(SK.contentSrc && SK.contentSrcId === key && (v.currentSrc || v.src) === SK.contentSrc);
  }
  function check(player, video, why) {
    if (!player || !isMainPlayer(player)) return;
    if (SK.inAd && SK.player && player !== SK.player) {
      if (SK.player.isConnected) return;
      exitAd(SK.player, SK.video, '플레이어 바뀜');
    }
    var v = video || videoOf(player);
    if (adStillOn(player) && on('skip')) {
      var ev = adEvidence(player, v);
      if (ev && ev.indexOf('SSAP') !== 0 && stillContentMedia(player, v)) {
        if (now() - SK.waitLogged > 5000) { SK.waitLogged = now(); log('info', 'skip', '광고 근거(' + ev + ')는 있지만 영상 요소에 아직 본편이 들어 있어 광고 영상으로 바뀔 때까지 기다림'); }
        if (SK.inAd) exitAd(player, v, '본편으로 돌아옴');
        clickSkip(player);
        return;
      }
      if (ev) { SK.evidence = ev; handleAd(player, v, why); return; }
      if (SK.inAd) { exitAd(player, v, '광고 근거 사라짐'); return; }
      if (now() - lastNoEvidence > 5000) { lastNoEvidence = now(); log('info', 'skip', '광고 표시는 있지만 실제 광고 근거가 없어 배속을 건드리지 않음 (' + why + ')'); }
      clickSkip(player);
      scheduleNoEvidenceDiag(player);
      return;
    }
    if (SK.inAd) exitAd(player, v, why);
  }

  function handleAd(player, v, why) {
    if (!v) return;
    var t = perf();
    if (!SK.inAd) {
      SK.inAd = true; SK.player = player; SK.video = v; SK.startedAt = t; SK.ads = 0; SK.saved = 0; SK.seen = {};
      // 광고 직전(0.3초 안)에 1배속으로 바뀐 것은 유튜브가 광고용으로 바꾼 것일 가능성이 커서 직전 값으로 기억
      if (SK.contentRate === 1 && t - SK.lastRateChange.t < 150) SK.contentRate = SK.lastRateChange.prev;
      SK.startPos = v.currentTime || 0;
      log('info', 'skip', '광고 재생 감지 (' + why + ', 근거: ' + SK.evidence + ') → 음소거·' + F.player.maxRate + '배속. 본편 배속 ' + SK.contentRate + 'x' + (SK.rateKnown ? '' : '(추정)') + ', 음소거 ' + SK.contentMuted);
    }
    var d = v.duration;
    var key = (v.currentSrc || v.src || '') + '|' + (isFinite(d) ? Math.round(d * 10) : 'x');
    var fresh = isFinite(d) && d > 0 && !SK.seen[key];
    if (fresh) { SK.seen[key] = 1; SK.ads++; }

    if (!v.muted) v.muted = true;
    if (SK.appliedRate === 0 || v.playbackRate !== SK.appliedRate) setRate(v, F.player.maxRate);

    if (START.vid && !START.reported) START.ad = true;
    var clicked = clickSkip(player);
    var ssap = false;
    if (now() - SK.ssapCheck > 400) { SK.ssapCheck = now(); ssap = trySsapSkip(player); }
    if (fresh && !ssap && F.player.seekToEnd) seekAdEnd(player, v, clicked);
  }

  // 서버가 본편 스트림에 끼워 넣은 광고(SSAP): 플레이어 API로 광고 끝 지점으로 이동
  function trySsapSkip(p) {
    var st = null, ps = null;
    try { st = p.getStatsForNerds && p.getStatsForNerds(); } catch (e) { /* ignore */ }
    if (!st || String(st.debug_info || '').indexOf('SSAP, AD') !== 0) return false;
    try { ps = p.getProgressState && p.getProgressState(); } catch (e) { /* ignore */ }
    if (ps && ps.duration > 0 && ps.current < ps.duration - 0.3 && typeof p.seekTo === 'function') {
      SK.saved += ps.duration - ps.current;
      try { p.seekTo(ps.duration); } catch (e) { return false; }
      log('info', 'skip', '서버 삽입 광고(SSAP) 끝으로 이동 ' + ps.current.toFixed(1) + '→' + ps.duration.toFixed(1) + '초');
      return true;
    }
    return false;
  }

  function clickSkip(root) {
    var n = 0;
    var sels = F.player.skipSelectors;
    for (var i = 0; i < sels.length; i++) {
      var els;
      try { els = (root || document).querySelectorAll(sels[i]); } catch (e) { continue; }
      for (var j = 0; j < els.length; j++) {
        try { els[j].click(); n++; } catch (e) { /* ignore */ }
      }
    }
    if (n) log('info', 'skip', '건너뛰기·닫기 버튼 ' + n + '개 클릭');
    return n;
  }

  // 본편 길이: 영상 정보 응답 → 직전에 본 본편 → 플레이어가 가진 응답 순서로
  function contentLength(player, key) {
    var m = key && videoMeta.get(key);
    if (m && m.len) return m.len;
    if (key && SK.contentDurId === key && SK.contentDur) return SK.contentDur;
    try {
      var r = player.getPlayerResponse && player.getPlayerResponse();
      var vd = r && r.videoDetails;
      if (vd && key && vd.videoId === key && vd.lengthSeconds) return +vd.lengthSeconds;
    } catch (e) { /* ignore */ }
    return 0;
  }
  // 영상 요소를 끝으로 옮겨도 되는지: 본편 길이를 알고, 지금 영상이 본편과 다른 영상(길이가 다름)일 때만
  function canSeekElement(player, v) {
    if (stillContentMedia(player, v)) return false;
    var len = contentLength(player, urlVideoId());
    return !!len && isFinite(v.duration) && Math.abs(v.duration - len) > 2.5;
  }
  function seekAdEnd(player, v, clicked) {
    var d = v.duration, cur = v.currentTime || 0;
    if (!isFinite(d) || d <= 0) return;
    var stitched = SK.evidence.indexOf('SSAP') === 0 || !canSeekElement(player, v);
    if (!stitched) {
      if (cur < d - 0.2) {
        SK.saved += d - cur;
        try { v.currentTime = d; } catch (e) { /* ignore */ }
        log('info', 'skip', '광고 끝으로 이동 (남은 ' + (d - cur).toFixed(1) + '초)' + (clicked ? ', 버튼도 클릭함' : ''));
      }
      return;
    }
    // 본편과 구분이 안 되는 경우: 끝으로 이동하면 본편까지 넘어갈 수 있어 플레이어 API(서버 삽입 광고)나 배속으로만 통과
    if (!trySsapSkip(player)) log('info', 'skip', '본편과 구분이 확실하지 않아 끝으로 이동하지 않고 ' + F.player.maxRate + '배속으로 통과');
  }

  function exitAd(player, v, why) {
    var dur = (perf() - SK.startedAt) / 1000;
    SK.inAd = false;
    if (v) restore(player, v);
    SK.guardUntil = perf() + F.player.restoreGuardMs;
    SK.muteGuardUntil = perf() + 1000;
    var ads = SK.ads || 1;
    stat('skip', ads, SK.saved);
    log('info', 'skip', '광고 종료 (' + why + ', ' + dur.toFixed(1) + '초 걸림, 광고 ' + ads + '개) → 배속 ' + SK.restoreRate + 'x, 음소거 ' + SK.contentMuted + ', 음량 ' + Math.round(SK.contentVolume * 100) + ' 복구');
    SK.guardRate = SK.appliedRate;
    SK.player = null; SK.video = null; SK.appliedRate = 0;
  }

  // 복구할 배속: 본편에서 직접 관찰한 값이 우선, 없으면(첫 영상이 광고로 시작) 유튜브 플레이어 설정값
  function targetRate(player) {
    if (SK.rateKnown) return SK.contentRate;
    var api = null;
    try { if (player && typeof player.getPlaybackRate === 'function') api = player.getPlaybackRate(); } catch (e) { /* ignore */ }
    if (typeof api === 'number' && api > 0 && api <= 4 && api !== SK.appliedRate) return api;
    return 1;
  }

  function restore(player, v) {
    var rate = targetRate(player);
    SK.restoreRate = rate;
    try { if (v.playbackRate !== rate) v.playbackRate = rate; } catch (e) { /* ignore */ }
    try { if (player && typeof player.getPlaybackRate === 'function' && player.getPlaybackRate() !== rate) player.setPlaybackRate(rate); } catch (e) { /* ignore */ }
    try { if (v.muted !== SK.contentMuted) v.muted = SK.contentMuted; } catch (e) { /* ignore */ }
    // 음량은 되돌리지 않음: 광고 처리는 음소거·배속만 바꾸고 음량은 건드리지 않음. 되돌리면 유튜브가 영상마다 맞추는 음량(평준화)을
    // 앞 영상·저장된 값으로 덮어 광고 뒤 본편 소리가 갑자기 커지거나 작아질 수 있었음 (1.9.0 전수조사 반영)
    try {
      if (player && typeof player.isMuted === 'function') {
        var m = player.isMuted();
        if (m && !SK.contentMuted) player.unMute();
        else if (!m && SK.contentMuted) player.mute();
      }
    } catch (e) { /* ignore */ }
  }

  // --- 이벤트 연결 (모두 이벤트 기반, 반복 감시 없음) ---
  function onMedia(e) {
    var v = e.target;
    if (!(v instanceof HTMLMediaElement)) return;
    if (e.type === 'loadstart' || e.type === 'emptied') {
      SK.lastLoad = perf();
      return;
    }
    if (e.type === 'pause' && now() < resumeUntil && !v.ended) { resumeUntil = 0; var rp = v.play(); if (rp && rp.catch) rp.catch(function () {}); log('info', 'detect', '경고 뒤 멈춘 영상을 다시 재생'); }
    var p = playerOf(v);
    if (p) check(p, v, e.type);
    if (p && isMainPlayer(p) && e.type === 'playing' && !SK.inAd && !isAdShowing(p) && isFinite(v.duration) && v.duration > 0) {
      SK.contentDur = v.duration;
      SK.contentDurId = urlVideoId() || currentVideoId(p);
      SK.contentSrc = v.currentSrc || v.src;
      SK.contentSrcId = SK.contentDurId;
    }
    if (p && isMainPlayer(p)) {
      if (e.type === 'waiting' || e.type === 'playing' || e.type === 'durationchange') rcCheckSoon();
      startEvent(p, v, e.type);
      if (e.type === 'playing') noteStarted(p, isAdShowing(p));
      if ((e.type === 'loadedmetadata' || e.type === 'playing') && !isAdShowing(p)) applyQuality(p);
    }
    // 광고가 아닌 상태에서 비정상 배속이 남아 있으면 되돌림 (재생·탐색 때마다 확인)
    if (p && !SK.inAd && !capturing() && v.playbackRate > F.player.maxUserRate && (e.type === 'playing' || e.type === 'seeked' || e.type === 'loadedmetadata')) {
      var back = SK.rateKnown && SK.contentRate <= F.player.maxUserRate ? SK.contentRate : 1;
      try { v.playbackRate = back; } catch (err) { /* ignore */ }
      log('warn', 'skip', '본편에 ' + F.player.maxRate + '배속이 남아 있어 ' + back + 'x로 되돌림 (' + e.type + ')');
    }
    if (PLATFORM === 'android') mediaReport(v, p, e.type);
  }

  function onRate(e) {
    var v = e.target;
    if (!(v instanceof HTMLVideoElement)) return;
    var p = playerOf(v);
    if (!p || !isMainPlayer(p)) return;
    if (PLATFORM === 'android' && !SK.inAd) mediaReport(v, p, 'ratechange'); // 잠금화면 진행 막대가 배속에 맞게 흐르도록
    if (SK.inAd && SK.player && p !== SK.player) return;
    if (adStillOn(p) && on('skip')) {
      if (!SK.inAd) check(p, v, 'ratechange');
      else if (v.playbackRate !== SK.appliedRate) {
        if (adEvidence(p, v)) setRate(v, F.player.maxRate);
        else exitAd(p, v, '광고 근거 사라짐');
      }
      if (SK.inAd) return;
    }
    if (SK.inAd) { exitAd(p, v, '광고 표시 없음'); }
    // 오프라인 저장 중에는 앱이 빠른 배속을 유지함 (안전장치·배속 기억 모두 건너뜀)
    if (capturing()) return;
    // 안전장치: 광고가 아닌데 사용자가 고를 수 없는 배속이면 즉시 되돌림
    if (v.playbackRate > F.player.maxUserRate) {
      var back = SK.rateKnown && SK.contentRate <= F.player.maxUserRate ? SK.contentRate : 1;
      var bad = v.playbackRate;
      try { v.playbackRate = back; } catch (err) { /* ignore */ }
      log(perf() < SK.guardUntil ? 'info' : 'warn', 'skip', '광고가 아닌데 ' + bad + '배속 감지 → ' + back + 'x로 되돌림');
      return;
    }
    if (perf() < SK.guardUntil && SK.guardRate && v.playbackRate === SK.guardRate) {
      try { v.playbackRate = SK.restoreRate; } catch (err) { /* ignore */ }
      log('info', 'skip', '광고 뒤 남은 ' + SK.guardRate + '배속을 ' + SK.restoreRate + 'x로 바로잡음');
      return;
    }
    // 새 영상을 불러올 때 브라우저가 기본 배속으로 되돌리는 변화는 무시
    if (v.playbackRate === v.defaultPlaybackRate && perf() - SK.lastLoad < 1500) return;
    // 앱의 '길게 눌러 잠깐 2배속'은 사용자 배속으로 기억하지 않음 (그 사이 광고가 끝나도 2배속으로 돌아가지 않게)
    if (document.documentElement.dataset.glideHold) return;
    SK.lastRateChange = { prev: SK.contentRate, t: perf() };
    SK.contentRate = v.playbackRate;
    SK.rateKnown = true;
  }

  function onVolume(e) {
    var v = e.target;
    if (!(v instanceof HTMLVideoElement)) return;
    var p = playerOf(v);
    if (!p || !isMainPlayer(p) || SK.inAd) return;
    if (perf() < SK.muteGuardUntil && v.muted && !SK.contentMuted) {
      try { v.muted = false; } catch (err) { /* ignore */ }
      log('info', 'skip', '광고 뒤 남은 음소거를 해제');
      return;
    }
    SK.contentMuted = v.muted;
    SK.contentVolume = v.volume;
    SK.volKnown = true;
  }

  // 광고 표시 없이 본편에 이어붙은 광고 구간 (1층에서 기록한 구간)
  // 광고 처리 중에도 근거를 다시 확인. 근거가 사라지거나 약한 근거로 너무 오래 끌면 본편으로 보고 복구
  function recheckAd(p, v) {
    if (now() - SK.recheck < 500) return;
    SK.recheck = now();
    var ev = adEvidence(p, v);
    var key = urlVideoId() || currentVideoId(p);
    if (!ev) {
      log('warn', 'skip', '광고 처리 중 근거가 사라져 본편으로 복구 (' + (v.currentTime || 0).toFixed(1) + '초, 이전 근거: ' + SK.evidence + ')');
      exitAd(p, v, '근거 사라짐');
      return;
    }
    SK.evidence = ev;
    if (ev.indexOf('약함:') === 0 && (perf() - SK.startedAt > F.player.weakEvidenceMaxMs || (v.currentTime || 0) - SK.startPos > 35)) {
      if (key) SK.noWeak[key] = 1;
      log('warn', 'skip', '길이 근거만으로 ' + (F.player.weakEvidenceMaxMs / 1000) + '초 넘게 광고 처리 중 → 오판으로 보고 복구, 이 영상에서는 길이 근거를 쓰지 않음 (' + ev + ')');
      exitAd(p, v, '오판 방지');
    }
  }
  function ssapAd(p) {
    try {
      var st = p.getStatsForNerds && p.getStatsForNerds();
      return !!st && String(st.debug_info || '').indexOf('SSAP, AD') === 0;
    } catch (e) { return false; }
  }
  function onTime(e) {
    var v = e.target;
    if (!(v instanceof HTMLVideoElement)) return;
    var p = playerOf(v);
    if (!p) return;
    if (!isMainPlayer(p)) return;
    rcCheckSoon();
    traceStream(p, v);
    if (!on('skip')) return;
    if (SK.inAd) { if (p === SK.player) recheckAd(p, v); return; }
    // 서버가 본편 스트림에 끼워 넣은 광고는 광고 표시 없이 나올 수 있어 재생 중 주기적으로 확인 (timeupdate에 얹어서, 별도 감시 없음)
    if (!v.paused && now() - SK.ssapPoll > F.player.ssapPollMs) {
      SK.ssapPoll = now();
      if (ssapAd(p)) { SK.evidence = 'SSAP(표시 없음)'; handleAd(p, v, '서버 삽입 광고'); return; }
    }
  }
  // 기록 모드(디버그): 스트림 상태(debug_info 앞부분)가 바뀔 때마다 기록
  var lastDebugInfo = '', debugInfoAt = 0;
  function traceStream(p, v) {
    if (!S.debug || now() - debugInfoAt < 1000) return;
    debugInfoAt = now();
    var di = '';
    try { var st = p.getStatsForNerds && p.getStatsForNerds(); di = st ? String(st.debug_info || '').split(/,\s*s:/)[0].slice(0, 40) : ''; } catch (e) { /* ignore */ }
    if (di === lastDebugInfo) return;
    lastDebugInfo = di;
    log('debug', 'trace', '스트림 상태 "' + di + '" · ' + (v.currentTime || 0).toFixed(1) + '초 · 광고 표시 ' + isAdShowing(p) + ' [' + (currentVideoId(p) || '-') + ']');
  }

  function onAnimation(e) {
    var n = e.animationName;
    if (n === ANIM.adOn || n === ANIM.adOff) {
      var p = e.target;
      check(p, videoOf(p), n === ANIM.adOn ? '광고 클래스' : '광고 클래스 해제');
    } else if (n === ANIM.adUi) {
      var pu = playerOf(e.target);
      if (pu) check(pu, videoOf(pu), '광고 화면 요소');
    } else if (n === ANIM.skip) {
      if (SK.inAd || isAdShowing(playerOf(e.target))) {
        try { e.target.click(); log('info', 'skip', '건너뛰기 버튼 등장 즉시 클릭: ' + describe(e.target)); } catch (err) { /* ignore */ }
      }
    } else if (n === ANIM.warn) {
      onAntiAdblock(e.target);
    }
  }

  function describe(el) {
    if (!el || !el.tagName) return '?';
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    return s;
  }

  // ===========================================================================
  // 재생 시작 진단 (동작 없음, 기록만)
  //   영상을 열고 재생이 시작될 때까지 걸린 시간을 재고, 오래 걸리면 원인 후보를 로그로 남깁니다.
  // ===========================================================================
  var START = { vid: null, t0: 0, reported: true, ad: false, waits: 0, timer: 0, stallLogged: false };

  // 모바일 유튜브는 홈·구독 피드의 소리 없는 미리보기에도 같은 #movie_player 를 옮겨 씀 → 앱에서는 본 영상 화면(/watch·쇼츠·뮤직)일 때만 본 플레이어.
  // 1.9.1까지는 이름만 봐서 미리보기의 음소거·길이·배속이 본편 상태(광고 뒤 음량 되돌리기·채널 배속·이어보기·협찬 건너뛰기)로 섞일 수 있었음 (1.9.2 전체 점검)
  function isMainPlayer(p) { return !!p && (p.id === 'movie_player' || p.id === 'shorts-player') && (PLATFORM !== 'android' || watchContext()); }
  function onWatchPage() { return location.pathname === '/watch'; }
  function urlVideoId() {
    try { return new URL(location.href).searchParams.get('v'); } catch (e) { return null; }
  }
  function markStart(vid, t0) {
    if (!vid || !onWatchPage() || (vid === START.vid && !START.reported)) return;
    if (START.timer) nativeClearTimeout(START.timer);
    START = { vid: vid, t0: t0 || now(), reported: false, ad: false, waits: 0, timer: 0, stallLogged: false };
    START.timer = nativeSetTimeout(logStall, F.diag.stallMs);
  }
  function nerdStats(p) {
    try {
      var s = p.getStatsForNerds && p.getStatsForNerds();
      if (s) return 'debug=' + String(s.debug_info || '-').slice(0, 30) + ', 버퍼 ' + s.buffer_health_seconds + ', 해상도 ' + s.resolution;
    } catch (e) { /* ignore */ }
    return '통계 없음';
  }
  function logStall() {
    START.timer = 0;
    if (START.reported || !S.enabled || !onWatchPage()) return;
    var p = mainPlayer(), v = videoOf(p);
    if (!p) return;
    if (v && !v.paused && v.currentTime > 0.1 && v.readyState >= 3) return;
    var state = null;
    try { state = p.getPlayerState(); } catch (e) { /* ignore */ }
    if (v && v.paused && state !== 3 && state !== -1) { START.reported = true; return; } // 자동재생 꺼짐 등: 사용자 입력 대기
    START.stallLogged = true;
    log('warn', 'start', '재생이 ' + ((now() - START.t0) / 1000).toFixed(1) + '초째 시작 안 됨 [' + START.vid + '] 상태 ' + state + ', readyState ' + (v ? v.readyState : '-') +
      ', 광고 표시 ' + isAdShowing(p) + ', ' + nerdStats(p) + ' · 긴 타이머: ' + (timersSince(START.t0) || '없음'));
  }
  function startEvent(p, v, type) {
    if (START.reported || !START.vid) return;
    if (type === 'waiting') { START.waits++; return; }
    if (type !== 'playing' || isAdShowing(p)) return;
    START.reported = true;
    if (START.timer) { nativeClearTimeout(START.timer); START.timer = 0; }
    var dt = now() - START.t0;
    var tl = timersSince(START.t0);
    log(dt > F.diag.slowStartMs ? 'warn' : 'info', 'start', '재생 시작까지 ' + (dt / 1000).toFixed(1) + '초 [' + START.vid + ']' +
      (START.ad ? ' · 광고 거침' : '') + (RC.reloads ? ' · 다시 불러오기 누적 ' + RC.reloads + '회' : '') + (RC.marker ? ' · 요청 방식 ' + RC.marker : '') +
      (START.waits ? ' · 버퍼링 ' + START.waits + '회' : '') + (tl ? ' · 긴 타이머: ' + tl : '') + ' · ' + nerdStats(p));
  }
  function timersSince(t0) {
    return longTimers.filter(function (x) { return x.t >= t0 - 50; })
      .sort(function (a, b) { return b.d - a.d; }).slice(0, 5)
      .map(function (x) { return x.d + 'ms' + (x.boosted ? '(줄임)' : '') + ' ' + x.sig.slice(0, 48); }).join(' | ');
  }
  function onUrlChange() {
    mediaLeft();
    var vid = urlVideoId();
    if (vid && vid !== START.vid) markStart(vid);
  }
  ['pushState', 'replaceState'].forEach(function (m) {
    var orig = history[m];
    if (typeof orig !== 'function') return;
    history[m] = disguise(function () { var r = orig.apply(this, arguments); try { onUrlChange(); } catch (e) { /* ignore */ } return r; }, orig);
  });
  W.addEventListener('popstate', onUrlChange, true);

  // ===========================================================================
  // 기본 화질: 영상을 열 때마다 고른 화질(또는 일반 계정이 고를 수 있는 최고 화질)로 맞춤
  //   settings.quality: auto | highest | 2160 | 1440 | 1080 | 720 | 480
  //   프리미엄 전용 화질(paygated)은 고르지 않음
  // ===========================================================================
  var Q_ORDER = ['highres', 'hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
  var Q_MAP = { '144': 'tiny', '2160': 'hd2160', '1440': 'hd1440', '1080': 'hd1080', '720': 'hd720', '480': 'large', '360': 'medium', '240': 'small' };
  var Q_LABEL = { highres: '4320p', hd2160: '2160p', hd1440: '1440p', hd1080: '1080p', hd720: '720p', large: '480p', medium: '360p', small: '240p', tiny: '144p' };
  var qualityDone = '';
  // ---------------------------------------------------------------------------
  // 1.5.4의 '듣기 모드 데이터 절약'(재생 중 144p로 낮춤)은 1.5.5에서 제거함: 재생 중 화질을 바꾸면 유튜브가 영상을 처음부터 다시 불러와
  // 소리가 끊기고 앞부분이 들렸음(폴드5 실기). 그때 유튜브 화질 선호(localStorage 'yt-player-quality')에 남은 144p를
  // 되돌리는 안전장치만 남김 (보관해 둔 원래 값이 있을 때만)
  // ---------------------------------------------------------------------------
  function lsGet(k) { try { return W.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v === null) W.localStorage.removeItem(k); else W.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  // 보관해 둔 원래 화질 선호로 되돌림. keep: 보관본을 남겨 둠 (유튜브가 나중에 다시 써도 한 번 더 되돌릴 수 있게)
  function restoreSaverPref(keep, why) {
    if (PLATFORM !== 'android') return;
    var m = lsGet('glide:saver-prev');
    if (m === null) return;
    var o = null;
    try { o = JSON.parse(m); } catch (e) { /* ignore */ }
    lsSet('yt-player-quality', o && typeof o.v === 'string' ? o.v : null);
    if (!keep) lsSet('glide:saver-prev', null);
    if (why) log('info', 'quality', why);
  }
  restoreSaverPref(false, '지난 듣기 모드에서 낮춘 유튜브 화질 선호를 되돌림');

  // ---------------------------------------------------------------------------
  // 듣기 모드 (3단계 5, 설정 listenSaver): 앱이 안 보일 때(화면 꺼짐·다른 앱·이어폰·동그라미 모드) **새로 시작하는** 영상만 240p로.
  // 재생 중인 영상의 화질은 절대 바꾸지 않음 (1.5.5 교훈: 재생 중 화질을 바꾸면 유튜브가 처음부터 다시 불러와 끊기고 앞부분이 들림).
  //  - 영상마다 화질은 처음 한 번만 정함 (qualityVid). 화면을 끄기 전에 시작한 영상은 그대로
  //  - 듣기 모드로 시작한 영상은 화면을 켜도 끝까지 240p (qualityListen), 다음 영상부터 원래 화질
  //  - 유튜브 화질 선호(localStorage 'yt-player-quality')에 240p가 남지 않게 바로 되돌림 (페이지가 그 사이 끝나도 다음 시작 때 restoreSaverPref가 되돌림)
  // 앱 보임 여부는 glide-android.js가 'appvis' 명령을 받아 html[data-glide-bg]로 표시
  // ---------------------------------------------------------------------------
  var qualityVid = '', qualityListen = '', listenLocked = false;
  // 화질을 정한 영상(decidedVid)과 그 영상 본편이 처음 재생된 시각: 본편이 2.5초 넘게 재생된 영상의 화질은 다시 바꾸지 않음
  var decidedVid = '', playVid = '', playAt = 0;
  function listenNow() {
    var h = document.documentElement;
    return PLATFORM === 'android' && !!S.listenSaver && !!h && h.hasAttribute('data-glide-bg');
  }
  // Glide Music(앱 음악 탭)으로 연 곡: 영상 웹뷰의 html[data-glide-music] (glide-android.js mpBoot/mpTick)
  // 주소에 glide_music=1 이거나, 음악 세션(localStorage 'glide:gm', 24시간)의 곡이면 음악. 영상 웹뷰에서만
  function musicNow() {
    if (PLATFORM !== 'android' || !S.enabled || (S.role && S.role !== 'player') || location.pathname !== '/watch') return false;
    if (/[?&]glide_mv=1/.test(location.search)) return false; // 뮤직비디오 보기
    var v = urlVideoId();
    var mv = document.documentElement && document.documentElement.getAttribute('data-glide-mv'); if (v && mv && mv === v) return false;
    if (/[?&]glide_music=1/.test(location.search)) return true;
    if (!v) return false;
    // (2026-11-26 폰 프로파일: 영상을 열 때 플레이어가 코덱 확인 등으로 이 함수를 수십 번 불러, 매번 100곡짜리 세션을 읽고 풀었음) 0.4초 안에는 지난 결과의 곡 목록을 다시 씀.
    // 음악 탭에서 고른 곡·다음 곡 이동은 주소에 glide_music=1 이 붙어 위에서 먼저 판단되므로 늦게 바뀌어도 결과가 같음
    var now = Date.now();
    if (!MNC.ids || now - MNC.at > 400) {
      MNC.at = now; MNC.ids = {};
      try { var s = JSON.parse(localStorage.getItem('glide:gm') || 'null'); if (s && s.items && now - (s.at || 0) < 864e5) s.items.forEach(function (x) { if (x && x.id) MNC.ids[x.id] = 1; }); } catch (e) { /* ignore */ }
    }
    return !!MNC.ids[v];
  }
  var MNC = { at: 0, ids: null };
  function inProgress(vid) { return playVid === vid && Date.now() - playAt > 2500; }
  // 본 플레이어의 'playing'마다:
  //  - 앱이 보이는 동안 재생을 시작한 영상(광고 중 포함)은 듣기 모드가 손대지 않음 (qualityVid).
  //    applyQuality가 끝까지 돌지 못한 경우(광고 표시가 남음·화질 목록이 비어 있음·Glide 꺼짐)도 '이미 시작한 영상'으로 남기기 위해 따로 기록
  //  - 본편이 처음 재생된 시각 (playVid/playAt)
  function noteStarted(p, ad) {
    var vid = currentVideoId(p);
    if (!vid) return;
    if (!listenNow() && vid !== qualityListen) qualityVid = vid;
    if (!ad && vid !== playVid) { playVid = vid; playAt = Date.now(); }
  }

  function applyQuality(p) {
    if (!S.enabled || capturing()) return; // 저장 중에는 저장 기능이 화질을 정함
    // 홈·구독 피드의 소리 없는 미리보기(같은 플레이어를 옮겨 씀)에는 화질을 걸지 않음: 미리보기에 1080p를 걸어 데이터를 더 쓰고,
    // 피드 미리보기를 끈 상태에서는 유튜브가 0.7초마다 다시 붙일 때마다 또 걸었음 (1.9.2, 폰 로그 '[둘러보기] 화질 1080p로 설정')
    if (typeof watchContext === 'function' && !watchContext()) return;
    var vid = currentVideoId(p);
    if (!vid) return;
    if (qualityListen && qualityListen !== vid) qualityListen = ''; // 다른 영상으로 넘어감
    if (qualityListen === vid) return; // 듣기 모드로 시작한 영상: 화면을 켜도 끝까지 그대로
    var v = videoOf(p);
    var at = v ? (v.currentTime || 0) : 0;
    var music = musicNow();
    var listen = listenNow() || music;
    if (!music && !listenNow() && lsGet('glide:saver-prev') !== null) restoreSaverPref(false, '음악이 끝나 유튜브 화질 선호를 되돌림');
    // 음악: 곡마다 처음 한 번 144p (이어보기 위치가 있어도 — 음악은 처음부터 재생하므로 at 은 보지 않음)
    // (속성이 첫 재생보다 늦게 붙어 이미 다른 화질로 정했어도 한 번은 144p로 바꿈)
    if (music && qualityDone === vid + '144') return;
    // 이미 재생 중인 곡은 바꾸지 않음: 재생 중 화질 변경 = 유튜브가 처음부터 다시 불러옴 (1.5.5). 설정을 다시 받으면 qualityDone 이 지워져
    // 앱을 앞으로 띄운 뒤의 'playing' 에서 곡 중간에 144p를 다시 걸어 노래가 처음으로 돌아갔음 (사용자 제보 2026-11-23)
    if (music && (at > 2 || inProgress(vid))) return;
    if (!music && listen && (qualityVid === vid || at > 2 || inProgress(vid))) { qualityVid = vid; return; } // 이미 시작한 영상(이어보기 위치 포함): 그대로 둠
    // 화질을 이미 정했고 본편이 재생 중인 영상: 설정(와이파이·데이터 화질)이 바뀌어도 그대로, 다음 영상부터 (재생 중 화질 변경 = 처음부터 다시 불러옴, 1.5.5)
    if (!music && inProgress(vid)) { decidedVid = vid; return; }
    var want = music ? '144' : listen ? '240' : S.quality;
    if (!want || want === 'auto') {
      // 직전 듣기 모드 영상의 240p 고정이 플레이어에 남아 있으면, 새 영상을 시작할 때(재생 전) 풀어 줌
      if (!listen && listenLocked && at < 1 && !inProgress(vid)) {
        listenLocked = false;
        try { if (p.setPlaybackQualityRange) p.setPlaybackQualityRange('auto', 'auto'); if (p.setPlaybackQuality) p.setPlaybackQuality('auto'); log('info', 'quality', '듣기 모드의 240p 고정을 풀고 자동 화질로 [' + vid + ']'); } catch (e) { /* ignore */ }
      }
      qualityVid = vid; decidedVid = vid; return;
    }
    if (qualityDone === vid + want) return;
    var levels = [];
    try {
      var data = p.getAvailableQualityData && p.getAvailableQualityData();
      if (data && data.length) {
        data.forEach(function (d) { if (d && d.isPlayable !== false && !d.paygatedQualityDetails && levels.indexOf(d.quality) === -1) levels.push(d.quality); });
      } else if (p.getAvailableQualityLevels) levels = p.getAvailableQualityLevels() || [];
    } catch (e) { return; }
    levels = levels.filter(function (q) { return Q_ORDER.indexOf(q) !== -1; });
    if (!levels.length) return; // 아직 준비 안 됨 → 다음 이벤트에서 다시
    var from = want === 'highest' ? 0 : Q_ORDER.indexOf(Q_MAP[want]);
    if (from < 0) return;
    var target = null;
    for (var i = from; i < Q_ORDER.length && !target; i++) if (levels.indexOf(Q_ORDER[i]) !== -1) target = Q_ORDER[i];
    if (!target) target = levels[levels.length - 1];
    // 원래 화질 선호는 처음 한 번만 보관 (2초 안에 듣기 영상이 두 번 바뀌어도 240p를 '원래 값'으로 덮지 않게)
    if (listen && lsGet('glide:saver-prev') === null) lsSet('glide:saver-prev', JSON.stringify({ v: lsGet('yt-player-quality') }));
    var curQ = null; try { curQ = p.getPlaybackQuality && p.getPlaybackQuality(); } catch (e) { /* ignore */ }
    if (music && curQ === target) {
      qualityDone = vid + want; qualityVid = vid; decidedVid = vid; qualityListen = vid; listenLocked = true;
      log('info', 'quality', '음악: 처음부터 ' + (Q_LABEL[target] || target) + '로 받는 중 (다시 불러오지 않음) [' + vid + ']');
      return;
    }
    try {
      if (p.setPlaybackQualityRange) p.setPlaybackQualityRange(target, target);
      if (p.setPlaybackQuality) p.setPlaybackQuality(target);
    } catch (e) { log('error', 'quality', '화질 변경 실패: ' + e.message); return; }
    qualityDone = vid + want;
    qualityVid = vid;
    decidedVid = vid;
    if (listen) {
      qualityListen = vid;
      listenLocked = true;
      // 유튜브가 나중에 선호를 다시 쓸 수 있어 두 번 되돌리고, 두 번째에 보관본을 지움
      if (!music) {
        nativeSetTimeout(function () { restoreSaverPref(true); }, 2000);
        nativeSetTimeout(function () { restoreSaverPref(false); }, 8000);
      }
    } else listenLocked = false;
    log('info', 'quality', (listen ? '듣기 모드: ' : '') + '화질 ' + (Q_LABEL[target] || target) + '로 설정 (원하는 화질 ' + want + ', 위치 ' + at.toFixed(1) + '초, 가능: ' + levels.map(function (q) { return Q_LABEL[q] || q; }).join('/') + ') [' + vid + ']');
  }

  // ===========================================================================
  // 광고 차단 감지 경고
  // ===========================================================================
  var lastWarnAt = 0, resumeUntil = 0;
  function onAntiAdblock(el) {
    var t = now();
    if (t - lastWarnAt > 3000) {
      stat('warn', 1, 0);
      log('warn', 'detect', '광고 차단 감지 경고가 떴음: <' + describe(el) + '>. 1층(데이터 제거)이 감지된 것일 수 있음. CLAUDE.md "경고 팝업이 뜸" 참고');
    }
    lastWarnAt = t;
    if (!F.antiAdblock.autoDismiss) return;
    var dlg = null;
    for (var i = 0; i < F.antiAdblock.dialogSelectors.length && !dlg; i++) {
      try { dlg = el.closest(F.antiAdblock.dialogSelectors[i]); } catch (e) { /* ignore */ }
    }
    try { if (dlg && typeof dlg.close === 'function') dlg.close(); } catch (e) { /* ignore */ }
    try { (dlg || el).remove(); } catch (e) { /* ignore */ }
    F.antiAdblock.backdropSelectors.forEach(function (s) {
      try { document.querySelectorAll(s).forEach(function (b) { b.remove(); }); } catch (e) { /* ignore */ }
    });
    var v = videoOf(mainPlayer()) || document.querySelector(F.player.selector + ' video');
    if (v && v.paused) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
    resumeUntil = now() + 1200;
    log('info', 'detect', '경고 팝업을 닫고 재생을 이어감');
  }

  // ===========================================================================
  // 백그라운드 재생 (안드로이드): 페이지가 항상 '보이는 중'이라고 믿게 함
  // ===========================================================================
  var BG = { active: PLATFORM === 'android' && on('background'), installed: false };
  function installBackground() {
    if (PLATFORM !== 'android' || BG.installed) return;
    BG.installed = true;
    var D = Document.prototype;
    function fake(prop, value) {
      var d = Object.getOwnPropertyDescriptor(D, prop);
      if (!d || !d.get) return;
      var orig = d.get;
      try {
        Object.defineProperty(D, prop, {
          configurable: true, enumerable: d.enumerable,
          get: disguise(function () { return BG.active || capturing() ? value : orig.call(this); }, orig)
        });
      } catch (e) { log('error', 'bg', prop + ' 고정 실패: ' + e.message); }
    }
    fake('hidden', false);
    fake('webkitHidden', false);
    fake('visibilityState', 'visible');
    fake('webkitVisibilityState', 'visible');
    var block = function (e) { if (BG.active || capturing()) { e.stopImmediatePropagation(); } }; // 오프라인 저장 중에도 (화면을 꺼도 저장이 이어지게)
    F.background.blockEvents.forEach(function (t) {
      W.addEventListener(t, block, true);
      document.addEventListener(t, block, true);
    });
    try {
      var hf = Document.prototype.hasFocus;
      Document.prototype.hasFocus = disguise(function hasFocus() { return BG.active || capturing() ? true : hf.call(this); }, hf);
    } catch (e) { /* ignore */ }
    // 작은 화면(PIP)에서 유튜브가 영상을 멈추지 않게.
    // 유튜브 플레이어는 창 크기가 바뀔 때 outerWidth×outerHeight를 screen 크기와 비교해 작으면 'PIP'로 보고(visibility.pictureInPicture),
    // 프리미엄이 아닌 영상(backgroundable 아님)은 재생 진행 이벤트마다 pauseVideo() 함 (player base.js XZ / onVideoProgress, 폴드5 실기에서 스택으로 확인).
    // 앱 PIP는 앱이 관리하므로 페이지에는 창이 화면만큼 크다고 알림. 화면 배치는 innerWidth/Height 기준이라 영향 없음.
    ['outerWidth', 'outerHeight'].forEach(function (prop) {
      var owner = Object.getOwnPropertyDescriptor(W, prop) ? W : (W.Window && Window.prototype);
      var d = owner && Object.getOwnPropertyDescriptor(owner, prop);
      if (!d || !d.get) return;
      var orig = d.get;
      try {
        Object.defineProperty(owner, prop, {
          configurable: true, enumerable: d.enumerable, set: d.set,
          get: disguise(function () {
            // 곱(넓이)은 항상 화면 넓이(긴 변×짧은 변)로 고정해 유튜브가 '창이 작아졌다(PIP)'로 볼 일이 없게 하고,
            // 모양은 지금 화면 배치(innerWidth/innerHeight)를 따름: 가로면 긴×짧은, 세로면 짧은×긴.
            //  - 1.5.3까지: 화면 크기를 각각 돌려줘 회전 도중 섞인 값(긴×긴)을 유튜브가 최대 창으로 기억 → 정상 가로 창을 PIP로 오판해 멈춤
            //  - 1.5.5~1.6.0: 둘 다 긴 변(정사각형) → 유튜브 가짜 전체화면이 이 값으로 영상 칸을 정사각형으로 잡아 영상이 아래로 밀려
            //    화면이 반쯤 잘렸음 (폴드5 실기: 창 1029x402, outer 1030x1030, 영상 top 225 = (1030-579)/2)
            // 실제 값은 쓰지 않음: 회전 도중 실제 값이 섞이면 다시 긴×긴이 될 수 있음
            var s = W.screen;
            var a = s ? s.width || 0 : 0, b = s ? s.height || 0 : 0;
            var big = Math.max(a, b), small = Math.min(a, b);
            if (!big || !small) return orig.call(this);
            var landscape = W.innerWidth > W.innerHeight;
            return prop === 'outerWidth' ? (landscape ? big : small) : (landscape ? small : big);
          }, orig)
        });
      } catch (e) { log('error', 'bg', prop + ' 고정 실패: ' + e.message); }
    });
  }

  // ===========================================================================
  // 안드로이드 미디어 알림용 상태 보고 + 명령
  // ===========================================================================
  var lastMedia = '';
  // 앱에 재생 상태를 알릴 화면: 영상(/watch), 쇼츠, 유튜브 뮤직. 홈 피드 미리보기(같은 플레이어를 옮겨 씀)는 제외
  function watchContext() {
    var path = location.pathname;
    return path === '/watch' || path.indexOf('/shorts/') === 0 || location.hostname === 'music.youtube.com';
  }
  var mediaMain = false;
  function mediaLeft() {
    if (PLATFORM !== 'android' || !mediaMain || watchContext()) return;
    mediaMain = false;
    lastMedia = '';
    send('media', { state: 'none', main: false });
  }
  // 저장된 곡 재생(Glide Music): 유튜브 영상 대신 페이지의 소리 요소가 재생하는 동안은 그쪽이 상태를 알리고 조작을 받음
  var localMedia = null;
  function setLocalMedia(h) { localMedia = typeof h === 'function' ? h : null; lastMedia = ''; }
  // 음악 재생 중: 알림·잠금화면 정보(정리한 제목·가수, 반복·좋아요 상태)를 페이지가 덧씌움
  var mediaMeta = null;
  function setMediaMeta(h) { mediaMeta = typeof h === 'function' ? h : null; lastMedia = ''; }
  // 음악 재생 화면(MP.on)일 때만: 이어폰·알림의 재생·일시정지·이전·다음을 음악 쪽이 먼저 처리 (동영상은 아래 예전 처리 그대로 — 음악·동영상 분리)
  var mediaKeys = null;
  function setMediaKeys(h) { mediaKeys = typeof h === 'function' ? h : null; }
  function mediaRefresh() { lastMedia = ''; var p = mainPlayer(), v = videoOf(p) || document.querySelector('video'); if (v && p) mediaReport(v, p, 'pause'); }
  function mediaReport(v, p, type) {
    if (localMedia) return;
    // seeked·ratechange: 잠금화면·알림의 진행 위치는 마지막 보고 위치와 배속으로 계산되므로 이동·배속 변화도 알림
    if (type !== 'playing' && type !== 'pause' && type !== 'loadedmetadata' && type !== 'ended' && type !== 'durationchange' && type !== 'seeked' && type !== 'ratechange') return;
    if (!p || !isMainPlayer(p) || !watchContext()) return;
    mediaMain = true;
    var data = { main: true, muted: v.muted, state: v.paused ? 'paused' : 'playing', ad: isAdShowing(p), duration: isFinite(v.duration) ? v.duration : 0, position: v.currentTime || 0, rate: v.playbackRate, w: v.videoWidth || 0, h: v.videoHeight || 0 };
    var vid = currentVideoId(p);
    data.videoId = vid;
    try {
      var md = navigator.mediaSession && navigator.mediaSession.metadata;
      if (md && md.title) { data.title = md.title; data.artist = md.artist; }
    } catch (e) { /* ignore */ }
    if (!data.title) {
      try { var vd = p && p.getVideoData && p.getVideoData(); if (vd) { data.title = vd.title; data.artist = vd.author; } } catch (e) { /* ignore */ }
    }
    if (!data.title) data.title = document.title.replace(/ - YouTube$/, '');
    if (vid) data.artwork = 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg';
    if (mediaMeta) { try { var mo = mediaMeta(vid); if (mo) for (var mk in mo) data[mk] = mo[mk]; } catch (e) { /* ignore */ } }
    var sig = data.state + data.videoId + data.title + data.ad + (data.music ? nativeStringify(data.music) : '');
    if (sig === lastMedia && type !== 'pause' && type !== 'playing' && type !== 'seeked' && type !== 'ratechange') return;
    lastMedia = sig;
    send('media', data);
  }

  function mainPlayer() {
    return document.querySelector('#movie_player') || document.querySelector(F.player.selector);
  }
  var TGL = { on: false, at: 0 };
  function runCommand(cmd, arg) {
    if (localMedia && PLATFORM === 'android') { try { if (localMedia(cmd, arg)) return; } catch (e) { log('error', 'cmd', '저장된 곡 조작 실패: ' + e.message); } }
    if (mediaKeys && PLATFORM === 'android') { try { if (mediaKeys(cmd, arg)) return; } catch (e) { log('error', 'cmd', '음악 ' + cmd + ' 실패: ' + e.message); } }
    // 영상 화면을 떠났으면 알림·블루투스의 재생 조작이 홈 피드 미리보기를 틀지 않게 무시
    if (PLATFORM === 'android' && !watchContext() && (cmd === 'play' || cmd === 'toggle' || cmd === 'next' || cmd === 'prev')) {
      log('info', 'cmd', cmd + ' 무시 (영상 화면이 아님)');
      return;
    }
    // 오프라인 저장 중에는 알림·블루투스·잠금화면의 재생 조작을 받지 않음 (다음 영상으로 넘어가면 저장이 깨짐)
    if (capturing() && (cmd === 'play' || cmd === 'pause' || cmd === 'toggle' || cmd === 'next' || cmd === 'prev' || cmd === 'seek' || cmd === 'seekBy')) {
      log('info', 'cmd', cmd + ' 무시 (오프라인 저장 중)');
      return;
    }
    var p = mainPlayer();
    var v = videoOf(p) || document.querySelector('video');
    try {
      switch (cmd) {
        case 'play': if (v) v.play(); break;
        case 'pause': if (v) v.pause(); break;
        case 'toggle': if (v) {
          // 연달아 누를 때(이어폰): 1.2초 안이면 방금 보낸 뜻을 기준으로 뒤집음 (영상이 아직 반응하기 전이라 같은 명령이 두 번 가던 것)
          var wasOn = TGL.at && Date.now() - TGL.at < 1200 ? TGL.on : !v.paused;
          TGL.on = !wasOn; TGL.at = Date.now();
          if (TGL.on) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); } else v.pause();
        } break;
        case 'next':
          if (p && typeof p.nextVideo === 'function') p.nextVideo();
          else { var nb = document.querySelector('.ytp-next-button, button[aria-label*="다음"], .player-controls-middle button:last-child'); if (nb) nb.click(); }
          break;
        case 'prev':
          if (v && v.currentTime > 3) v.currentTime = 0;
          else if (p && typeof p.previousVideo === 'function') p.previousVideo();
          else history.back();
          break;
        case 'seek': if (v && typeof arg === 'number') v.currentTime = arg; break;
        // 지금 위치에서 앞/뒤로 (알림창·잠금화면·이어폰의 10초 버튼). 광고 중에는 무시 (광고 처리와 겹치지 않게)
        case 'seekBy':
          if (v && typeof arg === 'number' && !SK.inAd && isFinite(v.currentTime)) {
            var end = isFinite(v.duration) && v.duration > 0 ? v.duration - 0.5 : Infinity;
            v.currentTime = Math.max(0, Math.min(end, v.currentTime + arg));
          }
          break;
        case 'status': if (v) { lastMedia = ''; mediaReport(v, p, 'pause'); } break;
        case 'diag': logBootInfo(); break;
        default: if (commandHandlers[cmd]) commandHandlers[cmd](arg);
      }
    } catch (e) { log('error', 'cmd', cmd + ' 실패: ' + e.message); }
  }

  // ===========================================================================
  // 시작
  // ===========================================================================
  function logBootInfo() {
    log('info', 'core', '코어 ' + CORE_VERSION + ' (API ' + CORE_API + ') · 필터 ' + F.version + ' · ' + PLATFORM + (IS_MOBILE_SITE ? ' · 모바일 사이트' : '') +
      ' · 설정 ' + ['prune', 'network', 'skip', 'cosmetic', 'background'].map(function (k) { return k + '=' + (S[k] ? 'on' : 'off'); }).join(' ') + (S.enabled ? '' : ' · 전체 꺼짐'));
  }

  installBackground();
  initStyles();
  var capture = { capture: true, passive: true };
  ['loadstart', 'emptied', 'loadedmetadata', 'durationchange', 'playing', 'play', 'pause', 'ended', 'seeking', 'seeked', 'waiting'].forEach(function (t) { document.addEventListener(t, onMedia, capture); });
  document.addEventListener('ratechange', onRate, capture);
  document.addEventListener('volumechange', onVolume, capture);
  document.addEventListener('timeupdate', onTime, capture);
  document.addEventListener('animationstart', onAnimation, capture);

  // 요소 만들기: 유튜브는 Trusted Types 정책으로 innerHTML 대입을 막으므로 요소를 직접 만듦
  //   makeEl('svg', {viewBox: '0 0 24 24'}, [makeEl('path', {d: '…'})])  (svg 안의 요소는 자동으로 SVG 네임스페이스)
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SVG_TAGS = { svg: 1, path: 1, circle: 1, rect: 1, g: 1, defs: 1, linearGradient: 1, stop: 1 };
  function makeEl(tag, attrs, children) {
    var e = SVG_TAGS[tag] ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
    for (var k in (attrs || {})) {
      if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  // glide-plus.js가 쓰는 연결 통로. 페이지 코드가 우연히 건드리지 않도록 Symbol 키에 숨김
  try {
    Object.defineProperty(W, Symbol.for('glide.api'), {
      value: Object.freeze({
        version: CORE_VERSION, platform: PLATFORM, mobileSite: IS_MOBILE_SITE,
        settings: function () { return S; },
        filters: function () { return F; },
        onSettings: function (cb) { settingsListeners.push(cb); },
        onFilters: function (cb) { filtersListeners.push(cb); },
        onCommand: function (name, cb) { commandHandlers[name] = cb; },
        addTransformer: function (t) { transformers.push(t); },
        send: send, sendBinary: sendBinary, capturing: capturing, log: log, stat: stat,
        mainPlayer: mainPlayer, playerOf: playerOf, videoOf: videoOf, isMainPlayer: isMainPlayer,
        isAdShowing: isAdShowing, inAd: function () { return SK.inAd; },
        afterAd: function () { return perf() < SK.guardUntil; },
        urlVideoId: urlVideoId, currentVideoId: currentVideoId, musicNow: musicNow, setLocalMedia: setLocalMedia, setMediaMeta: setMediaMeta, mediaRefresh: mediaRefresh, setMediaKeys: setMediaKeys,
        videoMeta: function (id) { return (id && videoMeta.get(id)) || null; },
        getPath: getPath, setTimeout: nativeSetTimeout, clearTimeout: nativeClearTimeout,
        parse: nativeParse, stringify: nativeStringify, disguise: disguise, el: makeEl
      })
    });
  } catch (e) { /* ignore */ }

  if (urlVideoId()) markStart(urlVideoId(), Date.now() - Math.round(perf()));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { rcInit(); rcCheck(); }, { once: true });
  else rcInit();
  logBootInfo();
  if (PLATFORM !== 'android') { try { document.dispatchEvent(new CustomEvent('glide:ready')); } catch (e) { /* ignore */ } }
  send('hello', { core: CORE_VERSION, api: CORE_API, filters: F.version, platform: PLATFORM, url: location.href });
})();
