/*!
 * Glide plus — 유튜브 편의 기능 (PC 확장 프로그램 + 안드로이드 앱 공용)
 *
 * 광고 차단(glide-core.js)과 분리된 파일입니다. 여기서 문제가 나도 광고 차단에는 영향이 없도록,
 * 코어가 열어 둔 연결 통로(window[Symbol.for('glide.api')])로만 주고받습니다. 반드시 코어 다음에 실행.
 *
 *   - 협찬·인트로·구독 요청 구간 건너뛰기 (SponsorBlock 공개 DB, 데이터는 호스트가 받아 전달)
 *   - 채널별 배속 기억
 *   - 쇼츠 숨기기 / 쇼츠를 일반 플레이어로 열기
 *   - 보기 싫은 채널·키워드 차단 (추천·검색 데이터 단계에서 제거)
 *   - 가장 많이 본 구간으로 이동
 *   - 수면 타이머 (명령으로 동작, 앱 UI에서 사용)
 *
 * 설정 키는 settings에, 동작 값(선택자 등)은 filters.json의 plus 항목에 있습니다.
 */
(function () {
  'use strict';

  var W = window;
  var G = W[Symbol.for('glide.api')];
  if (!G || W[Symbol.for('glide.plus')]) return;
  try { Object.defineProperty(W, Symbol.for('glide.plus'), { value: true }); } catch (e) { return; }

  var PLUS_VERSION = '1.0.0';
  var DEF = {
    sponsorBlock: true, sbCategories: ['sponsor', 'selfpromo', 'interaction', 'intro'],
    channelSpeed: true, defaultRate: 1, channelRates: {},
    hideShorts: true, shortsAsVideo: true,
    blockChannels: [], blockKeywords: [], hideTopics: [],
    peakButton: true, resume: true
  };
  var S = G.settings();
  var P = plusFilters();
  function opt(k) { return S[k] === undefined || S[k] === null ? DEF[k] : S[k]; }
  function on(k) { return !!(S.enabled && opt(k)); }
  function now() { return Date.now(); }
  function log(level, msg) { G.log(level, 'plus', msg); }
  function plusFilters() {
    var p = G.filters().plus || {};
    return {
      shortsHide: p.shortsHide || {},
      learnDelayMs: p.learnDelayMs || 2500,
      sbMinSegment: p.sbMinSegment || 1,
      peakMinStartPct: p.peakMinStartPct === undefined ? 3 : p.peakMinStartPct,
      toastMs: p.toastMs || 5000,
      sleepFadeMs: p.sleepFadeMs || 10000,
      blockItemKeys: p.blockItemKeys || []
    };
  }

  G.onSettings(function (s) {
    var prev = S;
    S = s;
    compileBlock();
    updateShortsStyle();
    if (!prev.shortsAsVideo && on('shortsAsVideo')) shortsRedirect();
    if (prev.sponsorBlock !== S.sponsorBlock || String(prev.sbCategories) !== String(S.sbCategories)) { SB.vid = null; SB.segs = []; }
    updatePeakButton();
  });
  G.onFilters(function () { P = plusFilters(); compileBlock(); updateShortsStyle(); });

  // ===========================================================================
  // 공통: 현재 영상
  // ===========================================================================
  function videoIdOf(p) { return G.urlVideoId() || G.currentVideoId(p); }
  function contentPlaying(p) { return p && G.isMainPlayer(p) && !G.isAdShowing(p) && !G.inAd(); }

  // ===========================================================================
  // 쇼츠
  // ===========================================================================
  var shortsStyle = null;
  function updateShortsStyle() {
    if (!shortsStyle) { shortsStyle = document.createElement('style'); shortsStyle.setAttribute('data-glide', 's'); }
    var sels = [];
    if (on('hideShorts')) {
      sels = (P.shortsHide.common || []).concat((G.mobileSite ? P.shortsHide.mobile : P.shortsHide.desktop) || []);
    }
    shortsStyle.textContent = sels.map(function (s) { return s + '{display:none!important}'; }).join('\n');
    mountStyle(shortsStyle);
  }
  // 문서 시작 시점에는 <head>가 없어 <html>에 붙이는데, 파서가 지울 수 있어 문서 준비 때 다시 붙임
  function mountStyle(el) {
    var parent = document.head || document.documentElement;
    if (parent && el.parentNode !== parent) parent.appendChild(el);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { if (shortsStyle) mountStyle(shortsStyle); }, { once: true });
  function shortsRedirect() {
    if (!on('shortsAsVideo')) return;
    var m = location.pathname.match(/^\/shorts\/([\w-]{6,})/);
    if (!m) return;
    log('info', '쇼츠를 일반 플레이어로 엶: ' + m[1]);
    location.replace('/watch?v=' + m[1]);
  }
  ['pushState', 'replaceState'].forEach(function (name) {
    var orig = history[name];
    if (typeof orig !== 'function') return;
    history[name] = G.disguise(function () { var r = orig.apply(this, arguments); try { shortsRedirect(); } catch (e) { /* ignore */ } return r; }, orig);
  });
  W.addEventListener('popstate', function () { shortsRedirect(); }, true);

  // ===========================================================================
  // 보기 싫은 채널·키워드 차단 (추천·검색·홈 데이터에서 항목 자체를 뺌)
  //   채널: "@핸들", "UC..."(채널 ID), 또는 채널 이름(정확히 일치)
  //   키워드: 제목·채널명 등에 포함되면 제외 (대소문자 무시)
  // ===========================================================================
  var ITEM_KEYS = {
    videoRenderer: 1, compactVideoRenderer: 1, gridVideoRenderer: 1, videoWithContextRenderer: 1,
    reelItemRenderer: 1, shortsLockupViewModel: 1, lockupViewModel: 1, playlistVideoRenderer: 1,
    compactRadioRenderer: 1, radioRenderer: 1, playlistRenderer: 1, compactPlaylistRenderer: 1,
    gridPlaylistRenderer: 1, movieRenderer: 1, compactMovieRenderer: 1
  };
  var BL = { ids: {}, handles: {}, names: {}, keywords: [], vids: {}, any: false };
  function compileBlock() {
    BL = { ids: {}, handles: {}, names: {}, keywords: [], vids: {}, any: false };
    // 영상 ⋮ 메뉴 '관심 없음'으로 고른 영상 (앱 목록 hiddenVideos)
    (opt('hiddenVideos') || []).forEach(function (v) { if (/^[\w-]{11}$/.test(v)) { BL.vids[v] = 1; BL.any = true; } });
    P.blockItemKeys.forEach(function (k) { ITEM_KEYS[k] = 1; });
    (opt('blockChannels') || []).forEach(function (c) {
      c = String(c || '').trim();
      if (!c) return;
      if (/^UC[\w-]{20,}$/.test(c)) BL.ids[c] = 1;
      else if (c[0] === '@') BL.handles['/' + c.toLowerCase()] = 1;
      else BL.names[c.toLowerCase()] = 1;
      BL.any = true;
    });
    (opt('blockKeywords') || []).forEach(function (k) {
      k = String(k || '').trim().toLowerCase();
      if (k) { BL.keywords.push(k); BL.any = true; }
    });
    // 보기 싫은 주제 묶음 (1.0.1, 설정 hideTopics = filters.json topicPacks 의 id). 홈·영상 아래 추천에서만 — 직접 검색한 결과는 그대로
    BL.topics = topicWords(opt('hideTopics'));
    if (BL.topics.length) BL.any = true;
  }
  // [{w: 낱말, name: 묶음 이름}]
  function topicWords(ids) {
    var on = {}, out = [];
    (ids || []).forEach(function (id) { on[id] = 1; });
    (G.filters().topicPacks || []).forEach(function (p) {
      if (!p || !on[p.id]) return;
      var ex = (p.except || []).map(function (x) { return String(x || '').toLowerCase(); });
      (p.words || []).forEach(function (w) { w = String(w || '').trim().toLowerCase(); var lb = w[0] === '^'; if (lb) w = w.slice(1); if (w) out.push({ w: w, lb: lb, ex: ex, name: p.name }); });
    });
    return out;
  }
  // 낱말이 들어 있는지: lb = 낱말 첫머리에서만 (앞 글자가 한글·영문·숫자면 아님) · ex = 이 말이 있으면 그 묶음은 안 걸림
  function topicHit(t, x) {
    for (var i = 0; i < x.ex.length; i++) if (x.ex[i] && t.indexOf(x.ex[i]) !== -1) return false;
    var at = t.indexOf(x.w);
    while (at !== -1) { if (!x.lb || at === 0 || !/[가-힣a-z0-9]/.test(t[at - 1])) return true; at = t.indexOf(x.w, at + 1); }
    return false;
  }
  compileBlock();

  function firstKey(o) { for (var k in o) return k; return null; }
  function itemBody(it) {
    var k = firstKey(it);
    if (!k) return null;
    if (k === 'richItemRenderer') {
      var c = it.richItemRenderer && it.richItemRenderer.content;
      var k2 = c && firstKey(c);
      return k2 && ITEM_KEYS[k2] ? c[k2] : null;
    }
    return ITEM_KEYS[k] ? it[k] : null;
  }
  // 항목 안의 글자·채널 정보 모으기 (깊이·개수 제한)
  function collect(node) {
    var out = { texts: [], ids: [], handles: [] };
    var stack = [[node, 0]], seen = 0;
    while (stack.length && seen < 600) {
      var pair = stack.pop(), o = pair[0], d = pair[1];
      seen++;
      if (!o || typeof o !== 'object' || d > 10) continue;
      for (var k in o) {
        var v = o[k];
        if (typeof v === 'string') {
          if (k === 'text' || k === 'simpleText' || k === 'content' || k === 'label' || k === 'title') out.texts.push(v);
          else if (k === 'browseId' && v.indexOf('UC') === 0) out.ids.push(v);
          else if ((k === 'canonicalBaseUrl' || k === 'url') && v.indexOf('/@') === 0) out.handles.push(v.split(/[/?#]/).slice(0, 2).join('/').toLowerCase());
        } else if (v && typeof v === 'object') stack.push([v, d + 1]);
      }
    }
    return out;
  }
  function blockedReason(body, search) {
    var vid = body && (body.videoId || body.contentId);
    if (vid && BL.vids[vid]) return '관심 없음';
    var c = collect(body), i;
    for (i = 0; i < c.ids.length; i++) if (BL.ids[c.ids[i]]) return '채널 ' + c.ids[i];
    for (i = 0; i < c.handles.length; i++) if (BL.handles[c.handles[i]]) return '채널 ' + c.handles[i].slice(1);
    for (i = 0; i < c.texts.length; i++) {
      var t = c.texts[i].trim().toLowerCase();
      if (BL.names[t]) return '채널 ' + c.texts[i].trim();
      for (var j = 0; j < BL.keywords.length; j++) if (t.indexOf(BL.keywords[j]) !== -1) return '키워드 "' + BL.keywords[j] + '"';
      if (!search) for (var k = 0; k < BL.topics.length; k++) if (topicHit(t, BL.topics[k])) return '주제 ' + BL.topics[k].name;
    }
    return null;
  }
  // 직접 검색한 결과인지 (보기 싫은 주제는 검색에서는 빼지 않음): 검색 요청이거나 검색 화면의 첫 데이터
  function isSearchSrc(src) { return /\/search\b/.test(String(src || '')) || (/^yt|initial/i.test(String(src || '')) && location.pathname === '/results'); }
  G.addTransformer({
    name: 'block',
    active: function () { return S.enabled && BL.any; },
    run: function (root, src) {
      var removed = 0, reasons = {}, stack = [root], visited = 0, search = isSearchSrc(src);
      while (stack.length) {
        var o = stack.pop();
        if (++visited > 300000) break;
        if (Array.isArray(o)) {
          for (var i = o.length - 1; i >= 0; i--) {
            var it = o[i];
            if (!it || typeof it !== 'object') continue;
            var body = itemBody(it);
            if (body) {
              var why = blockedReason(body, search);
              if (why) { o.splice(i, 1); removed++; reasons[why] = (reasons[why] || 0) + 1; continue; }
            }
            stack.push(it);
          }
        } else {
          for (var k in o) { var v = o[k]; if (v && typeof v === 'object') stack.push(v); }
        }
      }
      if (removed) log('info', '차단 목록으로 ' + removed + '개 숨김 (' + src + '): ' + Object.keys(reasons).map(function (r) { return r + '×' + reasons[r]; }).join(', '));
      return removed > 0;
    }
  });

  // ===========================================================================
  // 홈 피드의 커뮤니티 글 숨김 (2026-11-21, 사용자: 구독 안 한 채널의 커뮤니티 글 추천은 필요 없음)
  //  홈(주소 '/')의 목록에서만 뺌 — 구독 탭·채널 페이지의 게시물은 그대로. 설정 hideHomePosts(기본 켬)
  // ===========================================================================
  var POST_KEYS = { backstagePostThreadRenderer: 1, backstagePostRenderer: 1, postRenderer: 1, sharedPostRenderer: 1, postThreadRenderer: 1 };
  function isPostItem(it) {
    var k = firstKey(it);
    if (!k) return false;
    if (POST_KEYS[k]) return true;
    var c = it[k] && it[k].content;
    if (k === 'richItemRenderer' && c) return !!POST_KEYS[firstKey(c)];
    if (k === 'richSectionRenderer' && c) {
      // 게시물만 모은 칸(최신 게시물 줄)
      try { var str = G.stringify(c); return /"(backstagePostThreadRenderer|postRenderer|backstagePostRenderer)"/.test(str) && !/"(videoRenderer|lockupViewModel|videoWithContextRenderer|reelItemRenderer|shortsLockupViewModel)"/.test(str); } catch (e) { return false; }
    }
    return false;
  }
  G.addTransformer({
    name: 'homePosts',
    active: function () { return S.enabled && opt('hideHomePosts') !== false && location.pathname === '/' && G.mobileSite; },
    run: function (root, src) {
      if (src.indexOf('/next') !== -1 || src.indexOf('/player') !== -1) return false;
      var removed = 0, stack = [root], visited = 0;
      while (stack.length) {
        var o = stack.pop();
        if (++visited > 200000) break;
        if (Array.isArray(o)) {
          for (var i = o.length - 1; i >= 0; i--) {
            var it = o[i];
            if (!it || typeof it !== 'object') continue;
            if (isPostItem(it)) { o.splice(i, 1); removed++; continue; }
            stack.push(it);
          }
        } else for (var k in o) { var v = o[k]; if (v && typeof v === 'object') stack.push(v); }
      }
      if (removed) log('info', '홈 커뮤니티 글 ' + removed + '개 숨김 (' + src + ')');
      return removed > 0;
    }
  });

  // ===========================================================================
  // 가장 많이 본 구간 (유튜브의 '가장 많이 다시 본 구간' 그래프 데이터)
  // ===========================================================================
  var PK = {}; // videoId → [{s, d, v}]
  function collectHeatmap(root) {
    var found = 0, stack = [root], visited = 0;
    while (stack.length && visited < 200000) {
      var o = stack.pop();
      visited++;
      if (!o || typeof o !== 'object') continue;
      if (o.macroMarkersListEntity && o.macroMarkersListEntity.markersList) {
        var e = o.macroMarkersListEntity, ml = e.markersList;
        if (ml.markerType === 'MARKER_TYPE_HEATMAP' && Array.isArray(ml.markers) && e.externalVideoId) {
          PK[e.externalVideoId] = ml.markers.map(function (m) {
            return { s: +m.startMillis / 1000, d: +m.durationMillis / 1000, v: +(m.intensityScoreNormalized || 0) };
          });
          found++;
        }
        continue;
      }
      if (Array.isArray(o)) for (var i = 0; i < o.length; i++) stack.push(o[i]);
      else for (var k in o) { var v = o[k]; if (v && typeof v === 'object') stack.push(v); }
    }
    return found;
  }
  G.addTransformer({
    name: 'peak',
    active: function () { return S.enabled && !!opt('peakButton'); },
    run: function (root, src) {
      if (src.indexOf('/next') === -1 && src.indexOf('ytInitialData') === -1 && src.indexOf('get_watch') === -1) return false;
      var n = collectHeatmap(root);
      if (n) { log('debug', '가장 많이 본 구간 데이터 확보 (' + src + ')'); nativeLater(updatePeakButton, 0); }
      return false; // 읽기만 함
    }
  });
  function peakTime(vid, duration) {
    var list = PK[vid];
    if (!list || !list.length) return null;
    var minStart = (duration || 0) * P.peakMinStartPct / 100, best = null;
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.s < minStart) continue;
      if (!best || m.v > best.v) best = m;
    }
    return best ? best.s : null;
  }
  function jumpPeak() {
    var p = G.mainPlayer(), v = G.videoOf(p);
    if (!p || !v || !contentPlaying(p)) return false;
    var t = peakTime(videoIdOf(p), v.duration);
    if (t === null) { toast(p, '이 영상은 구간 데이터가 없어요'); return false; }
    v.currentTime = t;
    toast(p, '가장 많이 본 구간으로 이동했어요 (' + fmt(t) + ')');
    log('info', '가장 많이 본 구간으로 이동: ' + fmt(t));
    return true;
  }
  var peakBtn = null;
  var PEAK_ICON = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2036%2036%22%3E%3Cpath%20d%3D%22M8%2026l6.5-9%204.5%205%203.5-6%205.5%2010z%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-width%3D%222.2%22%20stroke-linejoin%3D%22round%22%20stroke-linecap%3D%22round%22%2F%3E%3Ccircle%20cx%3D%2222.5%22%20cy%3D%2211%22%20r%3D%222.2%22%20fill%3D%22%23DDF46A%22%2F%3E%3C%2Fsvg%3E';
  function updatePeakButton() {
    if (G.mobileSite) return; // 폰은 앱 화면의 버튼을 씀
    var p = G.mainPlayer();
    var controls = p && p.querySelector('.ytp-right-controls');
    var show = on('peakButton') && p && G.isMainPlayer(p) && !!PK[videoIdOf(p)];
    if (!show) { if (peakBtn) peakBtn.hidden = true; return; }
    if (!controls) return;
    if (!peakBtn || !peakBtn.isConnected) {
      peakBtn = document.createElement('button');
      peakBtn.className = 'ytp-button glide-peak-button';
      peakBtn.setAttribute('aria-label', '가장 많이 본 구간으로');
      peakBtn.setAttribute('data-title-no-tooltip', '가장 많이 본 구간으로');
      peakBtn.title = '가장 많이 본 구간으로';
      // 아이콘은 배경 이미지로 (유튜브 플레이어 CSS가 버튼 안 SVG 색을 덮어쓰지 않게)
      peakBtn.style.cssText = 'background:url("' + PEAK_ICON + '") center/70% no-repeat';
      peakBtn.addEventListener('click', function (e) { e.stopPropagation(); jumpPeak(); });
      controls.insertBefore(peakBtn, controls.firstChild);
    }
    peakBtn.hidden = false;
  }

  // ===========================================================================
  // SponsorBlock: 협찬·자기 홍보·구독 요청·인트로 등 사용자 표시 구간 건너뛰기
  //   구간 데이터는 호스트(확장 background / 앱)가 받아서 'sb' 명령으로 넘겨 줌
  // ===========================================================================
  var SB = { vid: null, segs: [], done: {} };
  var SB_LABEL = { sponsor: '협찬', selfpromo: '자기 홍보', interaction: '구독·좋아요 요청', intro: '인트로', outro: '아웃트로', preview: '미리보기', music_offtopic: '음악 외 구간', filler: '잡담' };
  function sbRequest(vid) {
    if (!on('sponsorBlock') || !vid || SB.vid === vid) return;
    SB.vid = vid; SB.segs = []; SB.done = {};
    G.send('sb:req', { videoId: vid, categories: opt('sbCategories') });
  }
  G.onCommand('sb', function (arg) {
    if (!arg || arg.videoId !== SB.vid) return;
    var cats = opt('sbCategories');
    SB.segs = (arg.segments || []).filter(function (s) {
      return s && Array.isArray(s.segment) && (s.actionType || 'skip') === 'skip' && cats.indexOf(s.category) !== -1 &&
        s.segment[1] - s.segment[0] >= P.sbMinSegment;
    }).map(function (s) { return { s: +s.segment[0], e: +s.segment[1], cat: s.category, id: s.UUID || (s.segment[0] + '-' + s.category) }; })
      .sort(function (a, b) { return a.s - b.s; });
    if (SB.segs.length) log('info', '건너뛸 구간 ' + SB.segs.length + '개 받음 [' + arg.videoId + ']: ' + SB.segs.map(function (x) { return (SB_LABEL[x.cat] || x.cat) + ' ' + fmt(x.s) + '–' + fmt(x.e); }).join(', '));
  });
  // 오프라인 저장 중(앱)에는 건너뛰기·채널 배속을 멈춤: 건너뛰면 저장 파일에 빈 구간이 생기고, 배속을 바꾸면 저장이 느려짐
  function capturing() { return !!(G.capturing && G.capturing()); }
  function sbTick(p, v) {
    if (!SB.segs.length || !on('sponsorBlock') || videoIdOf(p) !== SB.vid || capturing()) return;
    var t = v.currentTime, last = SB.lastT;
    SB.lastT = t;
    for (var i = 0; i < SB.segs.length; i++) {
      var g = SB.segs[i];
      // 구간 앞으로 되돌아오면(반복 재생·직접 되감기) 다시 건너뜀. '되돌리기'로 일부러 본 구간은 그대로 둠
      if (SB.done[g.id] === 1 && last - t > 2 && t < g.e - 0.3 && (t < g.s - 0.5 || g.s < 1.5)) { delete SB.done[g.id]; }
      if (SB.done[g.id] || t < g.s - 0.05 || t >= g.e - 0.3) continue;
      SB.done[g.id] = 1;
      var end = isFinite(v.duration) ? Math.min(g.e, v.duration - 0.1) : g.e;
      v.currentTime = end;
      G.stat('sponsor', 1, end - t);
      var label = SB_LABEL[g.cat] || g.cat;
      log('info', label + ' 구간 건너뜀 ' + fmt(t) + '→' + fmt(end) + ' [' + SB.vid + ']');
      toast(p, label + ' 구간을 건너뛰었어요 (' + Math.round(end - t) + '초)', '되돌리기', function () { SB.done[g.id] = 'undo'; v.currentTime = g.s; });
      return;
    }
  }

  // ===========================================================================
  // 채널별 배속 기억
  //   영상이 시작되면 그 채널에 기억해 둔 배속(없으면 기본 배속)으로 맞추고,
  //   재생 중에 사용자가 배속을 바꾸면 그 채널의 배속으로 기억함
  // ===========================================================================
  var CS = { vid: null, ch: null, appliedAt: 0, applied: 0, startedAt: 0 };
  function channelOf(p, vid) {
    var m = G.videoMeta(vid);
    if (m && m.channelId) return { id: m.channelId, name: m.author || '' };
    try {
      var r = p.getPlayerResponse && p.getPlayerResponse();
      var vd = r && r.videoDetails;
      if (vd && vd.videoId === vid && vd.channelId) return { id: vd.channelId, name: vd.author || '' };
    } catch (e) { /* ignore */ }
    return null;
  }
  function rateFor(ch) {
    var rates = opt('channelRates') || {};
    var r = ch && rates[ch.id];
    return r && r.rate ? +r.rate : +opt('defaultRate') || 1;
  }
  function csStart(p, v, vid) {
    if (capturing()) return;
    if (!on('channelSpeed') || CS.vid === vid) return;
    CS.vid = vid; CS.ch = channelOf(p, vid); CS.startedAt = now();
    var want = rateFor(CS.ch);
    if (Math.abs(v.playbackRate - want) < 0.001) return;
    CS.appliedAt = now(); CS.applied = want;
    try { if (typeof p.setPlaybackRate === 'function') p.setPlaybackRate(want); } catch (e) { /* ignore */ }
    try { if (v.playbackRate !== want) v.playbackRate = want; } catch (e) { /* ignore */ }
    log('info', '채널 배속 ' + want + 'x 적용' + (CS.ch ? ' (' + (CS.ch.name || CS.ch.id) + ')' : ''));
  }
  function csLearn(p, v) {
    if (!on('channelSpeed') || !CS.ch || CS.vid !== videoIdOf(p)) return;
    var t = now();
    var rate = v.playbackRate;
    if (document.documentElement.dataset.glideHold || capturing()) return; // 길게 눌러 잠깐 2배속 중 / 저장 중
    // Glide가 방금 건 배속, 영상 로딩 직후 유튜브가 맞추는 배속, 광고 직후 복구는 기억하지 않음
    if ((Math.abs(rate - CS.applied) < 0.001 && t - CS.appliedAt < 1000) || t - CS.startedAt < P.learnDelayMs || G.afterAd()) return;
    if (!(rate > 0 && rate <= 4)) return;
    if (Math.abs(rate - rateFor(CS.ch)) < 0.001) return;
    var rates = {};
    var cur = opt('channelRates') || {};
    for (var k in cur) rates[k] = cur[k];
    if (Math.abs(rate - (+opt('defaultRate') || 1)) < 0.001) delete rates[CS.ch.id];
    else rates[CS.ch.id] = { rate: rate, name: CS.ch.name, t: t };
    S = Object.assign({}, S, { channelRates: rates }); // 응답을 기다리지 않고 바로 반영
    G.send('channelRate', { id: CS.ch.id, name: CS.ch.name, rate: rate });
    log('info', '채널 배속 기억: ' + (CS.ch.name || CS.ch.id) + ' → ' + rate + 'x');
  }

  // ===========================================================================
  // 수면 타이머: 'sleep' 명령 { minutes } | { mode: 'end' } | { mode: 'off' }
  // ===========================================================================
  var SL = { mode: null, until: 0, timer: 0, fading: false };
  function nativeLater(fn, ms) { return G.setTimeout.call(W, fn, ms); }
  function sleepReport() { G.send('sleep', { mode: SL.mode, until: SL.until }); }
  function sleepClear() {
    if (SL.timer) G.clearTimeout.call(W, SL.timer);
    SL = { mode: null, until: 0, timer: 0, fading: false };
  }
  G.onCommand('sleep', function (arg) {
    sleepClear();
    if (arg && arg.minutes > 0) {
      SL.mode = 'minutes';
      SL.until = now() + arg.minutes * 60000;
      SL.timer = nativeLater(sleepFade, Math.max(0, arg.minutes * 60000 - P.sleepFadeMs));
      log('info', '수면 타이머: ' + arg.minutes + '분 뒤 정지');
    } else if (arg && arg.mode === 'end') {
      SL.mode = 'end';
      log('info', '수면 타이머: 이 영상이 끝나면 정지');
    } else log('info', '수면 타이머 꺼짐');
    sleepReport();
  });
  function sleepFade() {
    var v = G.videoOf(G.mainPlayer());
    if (!v) return sleepStop();
    SL.fading = true;
    var startVol = v.volume, steps = 20, i = 0;
    (function step() {
      if (!SL.fading) { v.volume = startVol; return; }
      i++;
      v.volume = Math.max(0, startVol * (1 - i / steps));
      if (i < steps) nativeLater(step, P.sleepFadeMs / steps);
      else { v.pause(); v.volume = startVol; sleepStop(); }
    })();
  }
  function sleepStop() {
    var v = G.videoOf(G.mainPlayer());
    if (v && !v.paused) v.pause();
    log('info', '수면 타이머로 재생을 멈춤');
    sleepClear();
    G.send('sleep', { mode: null, until: 0, fired: true });
  }
  function sleepTick(v) {
    if (capturing()) return; // 저장의 빠른 재생으로 '영상 끝나면' 타이머가 쓰이지 않게
    if (SL.mode === 'end' && isFinite(v.duration) && v.duration > 1 && v.duration - v.currentTime < 0.35 + 0.3 * Math.max(1, v.playbackRate || 1)) sleepStop();
  }

  // ===========================================================================
  // 안내 문구 (플레이어 안, 다른 스타일과 섞이지 않게 shadow DOM)
  // ===========================================================================
  var toastHost = null, toastTimer = 0;
  function toast(p, text, actionLabel, action) {
    if (!p) return;
    // 모바일 유튜브는 조작부가 #movie_player 바깥에서 화면 터치를 받으므로, 화면 맨 위 층(문서 또는 브라우저 전체화면 요소)에
    // 고정 위치로 띄우고 플레이어 아래쪽에 맞춤 (가짜 전체화면·가로 화면에서도 화면 안에 보이게)
    var mobileBottom = 0;
    if (G.mobileSite) {
      var fs = document.fullscreenElement;
      var area = document.getElementById('player-container-id') || p;
      var r = area.getBoundingClientRect();
      var full = !!fs || (document.body && document.body.getAttribute('faux-fullscreen') === 'true') || document.documentElement.classList.contains('glide-full');
      mobileBottom = full || !r.height ? 72 : Math.max(16, Math.round(innerHeight - Math.min(r.bottom, innerHeight) + 44));
      p = fs || document.body || p;
    }
    if (!toastHost || !toastHost.isConnected || toastHost.parentNode !== p) {
      toastHost = document.createElement('div');
      toastHost.setAttribute('data-glide', 't');
      toastHost.style.cssText = G.mobileSite ? 'position:fixed;left:12px;bottom:72px;z-index:2147483647;pointer-events:none' : 'position:absolute;left:12px;bottom:64px;z-index:70;pointer-events:none';
      var root = toastHost.attachShadow({ mode: 'open' });
      root.appendChild(G.el('style', { text: '.t{display:flex;align-items:center;gap:12px;padding:9px 12px 9px 14px;border-radius:10px;background:rgba(18,19,24,.88);color:#E4E1E9;' +
        'font:500 13px/1.3 Pretendard,"YouTube Sans",Roboto,system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.35);pointer-events:auto;transition:opacity .2s}' +
        '.t[hidden]{display:none}button{all:unset;cursor:pointer;color:#DDF46A;font-weight:700;padding:2px 4px;border-radius:6px}button:focus-visible{outline:2px solid #DDF46A}' }));
      root.appendChild(G.el('div', { 'class': 't', hidden: '' }, [G.el('span'), G.el('button', { type: 'button' })]));
      toastHost._root = root;
      p.appendChild(toastHost);
    }
    if (G.mobileSite) toastHost.style.bottom = mobileBottom + 'px';
    var box = toastHost._root.querySelector('.t'), btn = box.querySelector('button');
    box.querySelector('span').textContent = text;
    btn.hidden = !actionLabel;
    btn.textContent = actionLabel || '';
    var vid0 = G.urlVideoId ? G.urlVideoId() : '';
    btn.onclick = function (e) { e.stopPropagation(); box.hidden = true; if (action && (!vid0 || !G.urlVideoId || G.urlVideoId() === vid0)) action(); };
    box.hidden = false;
    if (toastTimer) G.clearTimeout.call(W, toastTimer);
    toastTimer = nativeLater(function () { box.hidden = true; }, P.toastMs);
  }
  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  }

  // ===========================================================================
  // 이벤트 연결 (미디어 이벤트만 사용, 반복 감시 없음)
  // ===========================================================================
  var cap = { capture: true, passive: true };
  function mainVideoEvent(e) {
    var v = e.target;
    if (!(v instanceof HTMLVideoElement)) return null;
    var p = G.playerOf(v);
    return p && G.isMainPlayer(p) ? p : null;
  }
  document.addEventListener('playing', function (e) {
    var p = mainVideoEvent(e);
    if (!p || !contentPlaying(p)) return;
    var vid = videoIdOf(p);
    csStart(p, e.target, vid);
    sbRequest(vid);
    updatePeakButton();
  }, cap);
  document.addEventListener('timeupdate', function (e) {
    var p = mainVideoEvent(e);
    if (!p || !contentPlaying(p)) return;
    sbTick(p, e.target);
    sleepTick(e.target);
  }, cap);
  document.addEventListener('ended', function (e) { var p = mainVideoEvent(e); if (p && SL.mode === 'end' && !capturing() && !G.inAd()) sleepStop(); }, cap);
  document.addEventListener('ratechange', function (e) {
    var p = mainVideoEvent(e);
    if (p && contentPlaying(p)) csLearn(p, e.target);
  }, cap);
  document.addEventListener('loadedmetadata', function (e) { if (mainVideoEvent(e)) updatePeakButton(); }, cap);
  G.onCommand('peak', jumpPeak);

  // ===========================================================================
  // 이어보기 (기기에만 저장)
  //   유튜브 시청 기록을 꺼 두면 다시 열 때 처음부터 나옴. 본 위치를 호스트(앱)가 기기 안에만 저장하고(유튜브 기록에는 안 남음),
  //   영상이 시작되면 그 위치로 옮기고 '처음부터' 되돌리기를 보여 줌. 주소에 t=(시작 위치)가 있으면 그대로 둠. 1분 미만 영상은 기억 안 함
  // ===========================================================================
  var RS = { asked: '', lastSent: 0, applied: '' };
  function rsUrlHasTime() { try { var u = new URL(location.href); return u.searchParams.has('t') || u.searchParams.has('start'); } catch (e) { return false; } }
  function rsTitle(vid) { var m = G.videoMeta(vid); return (m && m.title) || (document.title || '').replace(/ - YouTube$/, ''); }
  function rsSameVideo(p) { var a = G.urlVideoId(), b = G.currentVideoId(p); return !a || !b || a === b; }
  function rsSave(p, v, force) {
    // Glide 시청 기록(앱 history)도 같은 메시지로: 이어보기가 꺼져 있으면 historyOnly
    if (!(on('resume') || S.history !== false) || capturing() || !p || !v || !isFinite(v.duration) || v.duration < 60 || !rsSameVideo(p)) return;
    if (G.musicNow && G.musicNow()) return; // 음악(Glide Music)은 동영상 기록·이어보기와 따로
    var vid = videoIdOf(p), t = now();
    if (!force && t - RS.lastSent < 15000) return;
    if (!vid) return;
    RS.lastSent = t;
    G.send('resume:save', { videoId: vid, t: Math.floor(v.currentTime), d: Math.floor(v.duration), title: rsTitle(vid), historyOnly: !on('resume') });
  }
  function rsAsk(p) {
    if (G.musicNow ? G.musicNow() : (document.documentElement && document.documentElement.hasAttribute('data-glide-music'))) return;
    var vid = videoIdOf(p);
    if (!on('resume') || !vid || RS.asked === vid || capturing()) return;
    RS.asked = vid;
    if (!rsUrlHasTime()) G.send('resume:get', { videoId: vid });
  }
  G.onCommand('resume', function (arg) {
    var p = G.mainPlayer(), v = p && G.videoOf(p);
    if (!arg || !p || !v || videoIdOf(p) !== arg.videoId || !rsSameVideo(p) || RS.applied === arg.videoId) return;
    var t = +arg.t || 0;
    // 이미 사용자가 옮겼거나(5초 넘음) 거의 끝난 위치면 그대로
    if (t < 15 || v.currentTime > 5 || (isFinite(v.duration) && t > v.duration - 20)) return;
    RS.applied = arg.videoId;
    v.currentTime = t;
    log('info', '이어보기: ' + fmt(t) + '부터 [' + arg.videoId + ']');
    toast(p, '이어서 재생 (' + fmt(t) + ')', '처음부터', function () { v.currentTime = 0; G.send('resume:save', { videoId: arg.videoId, t: 0, d: Math.floor(v.duration || 0), title: rsTitle(arg.videoId) }); });
  });
  // 영상을 새로 불러올 때마다(같은 영상을 다시 열어도) 다시 물어봄. 예전에는 한 번 물어본 영상은 페이지가 살아 있는 동안 다시 안 물어봐서,
  // 보다가 닫고 홈에서 같은 영상을 다시 누르면 처음부터 나왔음 (1.0.1, 사용자 제보). 위치 옮김은 rsAsk/resume 의 조건(5초 안·끝 20초 전)이 그대로 막음
  document.addEventListener('loadstart', function (e) { if (mainVideoEvent(e)) { RS.asked = ''; RS.applied = ''; } }, cap);
  document.addEventListener('playing', function (e) { var p = mainVideoEvent(e); if (p && contentPlaying(p)) rsAsk(p); }, cap);
  document.addEventListener('timeupdate', function (e) { var p = mainVideoEvent(e); if (p && contentPlaying(p)) rsSave(p, e.target, false); }, cap);
  document.addEventListener('pause', function (e) { var p = mainVideoEvent(e); if (p && contentPlaying(p)) rsSave(p, e.target, true); }, cap);
  document.addEventListener('ended', function (e) { var p = mainVideoEvent(e); if (p && contentPlaying(p)) rsSave(p, e.target, true); }, cap);

  // ===========================================================================
  // 대본(스크립트) 가져오기: 유튜브 자막 데이터는 보안 토큰(pot)이 있어야 내용이 옴 (토큰 없이 요청하면 빈 응답, 실기 확인).
  //   그래서 플레이어에 자막을 잠깐 켜서 플레이어가 토큰을 붙여 요청한 주소를 얻고, 같은 주소로 json3 형식을 받아 문단으로 정리.
  //   원래 자막 상태는 되돌림. 결과는 호스트에 'transcript'로 넘김 (복사·공유는 앱이)
  // ===========================================================================
  function tsTracks(p) {
    var pr = null;
    try { pr = p.getPlayerResponse && p.getPlayerResponse(); } catch (e) { /* ignore */ }
    var r = pr && pr.captions && pr.captions.playerCaptionsTracklistRenderer;
    return (r && r.captionTracks) || [];
  }
  function tsPick(tracks) {
    var score = function (t) { return (t.languageCode === 'ko' ? 4 : 0) + (t.kind === 'asr' ? 0 : 2) + (/^en/.test(t.languageCode) ? 1 : 0); };
    return tracks.slice().sort(function (a, b) { return score(b) - score(a); })[0] || null;
  }
  var TS_SEEN = []; // [{url, at}] 최근 자막 요청 주소
  try {
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        if (/\/api\/timedtext/.test(e.name) && /[?&]pot=/.test(e.name)) { TS_SEEN.push({ url: e.name, at: e.startTime }); if (TS_SEEN.length > 20) TS_SEEN.shift(); }
      });
    }).observe({ type: 'resource', buffered: true });
  } catch (e) { /* ignore */ }
  function tsFindUrl(vid, lang, since) {
    for (var k = TS_SEEN.length - 1; k >= 0; k--) {
      var u = TS_SEEN[k].url;
      if (u.indexOf('v=' + vid) !== -1 && (!lang || u.indexOf('lang=' + lang) !== -1) && TS_SEEN[k].at >= since) return u;
    }
    var list = performance.getEntriesByType('resource');
    for (var i = list.length - 1; i >= 0; i--) {
      var n = list[i].name;
      if (/\/api\/timedtext/.test(n) && n.indexOf('v=' + vid) !== -1 && /[?&]pot=/.test(n) && (!lang || n.indexOf('lang=' + lang) !== -1) && list[i].startTime >= since) return n;
    }
    return null;
  }
  function tsParagraphs(json) {
    var out = [], cur = null;
    (json.events || []).forEach(function (ev) {
      if (!ev.segs) return;
      var text = ev.segs.map(function (s) { return s.utf8 || ''; }).join('').replace(/\s+/g, ' ').trim();
      if (!text) return;
      var start = (ev.tStartMs || 0) / 1000, speaker = /^>>/.test(text);
      text = text.replace(/^>>\s*/, '');
      // 화자가 바뀌거나(>>) 3초 넘게 쉬거나 문단이 길면 새 문단
      if (!cur || speaker || start - cur.end > 3 || cur.text.length > 400) { cur = { start: start, end: start, text: text }; out.push(cur); }
      else cur.text += ' ' + text;
      cur.end = start + (ev.dDurationMs || 0) / 1000;
    });
    return out;
  }
  var tsBusy = false;
  G.onCommand('transcript', function (arg) {
    var mode = (arg && arg.mode) || 'copy';
    var p = G.mainPlayer(), vid = p && videoIdOf(p);
    if (!p || !vid || tsBusy) return;
    var tracks = tsTracks(p), tr = tsPick(tracks);
    if (!tr) { toast(p, '이 영상은 자막(대본)이 없어요'); G.send('transcript', { videoId: vid, mode: mode, error: 'none' }); return; }
    tsBusy = true;
    var before = null;
    try { before = p.getOption && p.getOption('captions', 'track'); } catch (e) { /* ignore */ }
    var hadTrack = !!(before && before.languageCode);
    var t0 = performance.now(), url = tsFindUrl(vid, tr.languageCode, 0);
    if (!url) {
      try { if (p.loadModule) p.loadModule('captions'); p.setOption('captions', 'track', { languageCode: tr.languageCode, kind: tr.kind }); } catch (e) { /* ignore */ }
    }
    toast(p, '대본을 가져오는 중…');
    var tries = 0;
    (function wait() {
      url = url || tsFindUrl(vid, tr.languageCode, t0 - 50);
      if (!url && ++tries < 40) { nativeLater(wait, 150); return; }
      // 원래 자막 상태로
      try {
        if (!hadTrack) { p.setOption('captions', 'track', {}); if (p.unloadModule) p.unloadModule('captions'); }
        else if (before) p.setOption('captions', 'track', before);
      } catch (e) { /* ignore */ }
      if (!url) { tsBusy = false; toast(p, '대본을 가져오지 못했어요'); log('warn', '대본: 자막 요청 주소를 찾지 못함 [' + vid + ']'); return; }
      fetch(url.replace(/([?&])fmt=[^&]*&?/, '$1').replace(/[?&]$/, '') + '&fmt=json3', { credentials: 'include' })
        .then(function (r) { return r.text(); })
        .then(function (text) {
          tsBusy = false;
          var paras = tsParagraphs(G.parse(text));
          if (!paras.length) { toast(p, '대본을 가져오지 못했어요'); return; }
          var meta = G.videoMeta(vid) || {};
          G.send('transcript', {
            videoId: vid, mode: mode, title: rsTitle(vid), channel: meta.author || meta.channel || '',
            lang: tr.languageCode, auto: tr.kind === 'asr',
            lines: paras.map(function (x) { return { t: Math.floor(x.start), text: x.text }; })
          });
          log('info', '대본 ' + paras.length + '문단 (' + tr.languageCode + (tr.kind === 'asr' ? ', 자동 생성' : '') + ') [' + vid + ']');
        })
        .catch(function (e) { tsBusy = false; toast(p, '대본을 가져오지 못했어요'); log('warn', '대본 받기 실패: ' + e.message); });
    })();
  });

  // 시작
  updateShortsStyle();
  shortsRedirect();
  log('info', '편의 기능 ' + PLUS_VERSION + ' · 협찬 건너뛰기 ' + (on('sponsorBlock') ? 'on' : 'off') + ' · 채널 배속 ' + (on('channelSpeed') ? 'on' : 'off') +
    ' · 쇼츠 숨김 ' + (on('hideShorts') ? 'on' : 'off') + ' · 쇼츠→일반 ' + (on('shortsAsVideo') ? 'on' : 'off') + ' · 차단 목록 ' + (BL.any ? 'on' : 'off'));
})();
