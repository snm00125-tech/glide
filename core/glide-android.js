/*!
 * Glide android — 안드로이드 앱 전용 페이지 스크립트 (코어·편의 기능 다음에 실행)
 *   - 유튜브 앱과 같은 손동작 (전체화면은 유튜브 자체 전체화면을 그대로 쓰고, 안 열릴 때만 앱 대체 전체화면)
 *       영상 위로 밀기 → 전체화면(가로), 전체화면에서 아래로 밀기 → 세로 복귀, 폰을 가로로 돌리면 전체화면
 *       전체화면에서 두 손가락 벌리기 → 화면 꽉 채우기(확대), 오므리기 → 원래대로
 *       길게 누르기 → 누르는 동안 2배속
 *       (두 번 탭해 10초 이동은 모바일 유튜브 기능을 그대로 씀)
 *   - 유튜브 상단 바에 Glide 버튼 (앱의 빠른 메뉴)
 *   - 화면 속 화면(PIP)일 때 플레이어만 꽉 차게
 * 선택자와 수치는 filters.json의 android 항목에 있습니다.
 */
(function () {
  'use strict';
  var W = window;
  var G = W[Symbol.for('glide.api')];
  if (!G || G.platform !== 'android' || W[Symbol.for('glide.android')]) return;
  // 페이지 안 프레임(라이브 채팅 등)에서는 돌리지 않음: 손동작·상단 바 버튼·PIP는 맨 위 페이지 것
  try { if (W.top !== W) return; } catch (e) { return; }
  try { Object.defineProperty(W, Symbol.for('glide.android'), { value: true }); } catch (e) { return; }

  function cfg() {
    var a = G.filters().android || {};
    var g = a.gestures || {};
    return {
      headerAnchors: a.headerAnchors || ['ytm-mobile-topbar-renderer header'],
      pipCss: a.pipCss || [],
      polishCss: a.polishCss || [],
      appCss: a.appCss || [],
      unmuteButtons: a.unmuteButtons || ['#movie_player button.ytp-unmute'],
      longPressItems: a.longPressItems || ['ytm-rich-item-renderer', 'ytm-video-with-context-renderer', 'ytm-compact-video-renderer', 'ytm-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model-v2', 'ytm-playlist-renderer', 'ytm-compact-playlist-renderer'],
      itemMenuButtons: a.itemMenuButtons || ['button[aria-label="추가 작업"]', 'button[aria-label="More actions"]', 'button[aria-label="Action menu"]', 'ytm-menu-renderer button'],
      longPressMs: a.longPressMs || 480,
      pullBlockers: a.pullBlockers || [".ytSpecBottomSheetLayoutHost", ".menu-container .menu-content", "ytm-engagement-panel", "bottom-sheet-container", "yt-sheet-view-model", "ytm-bottom-sheet-renderer", "dialog[open]", "tp-yt-paper-dialog", "ytm-search[open]", ".mobile-topbar-header[data-mode=searching]"],
      zoomCss: a.zoomCss || [],
      fullscreenButtons: a.fullscreenButtons || [],
      headerTimeoutMs: a.headerTimeoutMs || 8000,
      swipeMinPx: g.swipeMinPx || 60,
      edgeTopPx: g.edgeTopPx || 56, // 전체화면 맨 위 이 높이 안에서 시작한 손가락은 상태 표시줄 몫
      edgeBottomPx: g.edgeBottomPx || 40, // 맨 아래는 홈·앱 바꾸기 손동작 몫
      holdMs: g.holdMs || 450,
      holdRate: g.holdRate || 2,
      pinchRatio: g.pinchRatio || 1.15,
      appFullscreen: g.appFullscreen !== false,
      doubleTapSeek: g.doubleTapSeek !== false,
      doubleTapSec: g.doubleTapSec || 10,
      fullCss: a.fullCss || [],
      liveChat: a.liveChat !== false,
      enabled: g.enabled !== false
    };
  }
  var A = cfg();
  G.onFilters(function () { A = cfg(); updateStyle(); });
  G.onSettings(function () { updateStyle(); G.setTimeout.call(W, function () { try { ensureSaveButton(); } catch (e) { /* ignore */ } }, 0); }); // 설정이 바뀌면 채널 줄 🔔 등도 바로

  function log(level, msg) { G.log(level, 'android', msg); }
  var DRAG_I = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 9h14M5 15h14' stroke='%23000' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E";

  // ===========================================================================
  // 스타일 (버튼, PIP, 확대, 안내 문구)
  // ===========================================================================
  var BTN = 'glide-header-button', ANIM = 'glide-x-header';
  var LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 108 108'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%232F4BF0'/%3E%3Cstop offset='1' stop-color='%231A2BA8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='108' height='108' rx='30' fill='url%28%23g%29'/%3E%3Cg fill='none' stroke-linecap='round' stroke-linejoin='round' stroke-width='12'%3E%3Cpath d='M30 32L50 54L30 76' stroke='%237D8FFF'/%3E%3Cpath d='M56 32L76 54L56 76' stroke='%23DDF46A'/%3E%3C/g%3E%3C/svg%3E";
  var LOCK_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='5' y='11' width='14' height='10' rx='2'/%3E%3Cpath d='M8 11V8a4 4 0 0 1 8 0v3'/%3E%3C/svg%3E";
  var SUN_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='12' cy='12' r='4'/%3E%3Cpath d='M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'/%3E%3C/svg%3E";
  var ROT_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='7' y='3' width='10' height='18' rx='2'/%3E%3Cpath d='M3 12a9 9 0 0 1 3-6.7M21 12a9 9 0 0 1-3 6.7'/%3E%3Cpath d='M3 5v3h3M21 19v-3h-3'/%3E%3C/svg%3E";
  var SPK_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9h4l5-4v14l-5-4H4z'/%3E%3Cpath d='M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12'/%3E%3C/svg%3E";
  var style = document.createElement('style');
  style.setAttribute('data-glide', 'a');
  function updateStyle() {
    var css = '@keyframes ' + ANIM + '{from{opacity:1}to{opacity:1}}\n';
    css += A.headerAnchors.map(function (s) { return s + '{animation:' + ANIM + ' 1ms}'; }).join('\n') + '\n';
    // 아이콘은 배경 이미지로: 유튜브 CSS가 상단 바 안 SVG의 색칠을 덮어써서 안 보이는 문제를 피함
    css += '#' + BTN + '{all:unset;box-sizing:border-box;width:40px;height:40px;margin:0 2px;border-radius:20px;display:inline-block;cursor:pointer;flex:none;pointer-events:auto;position:relative;z-index:1;-webkit-tap-highlight-color:transparent;' +
      'background:url("' + LOGO + '") center/26px 26px no-repeat}' + '#' + BTN + ':active{background-color:rgba(127,127,127,.2)}\n';
    css += '#glide-gesture-hint{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483647;padding:7px 14px;border-radius:18px;background:rgba(0,0,0,.72);color:#fff;' +
      'font:600 13px/1.2 Pretendard,Roboto,system-ui,sans-serif;pointer-events:none;transition:opacity .15s}#glide-gesture-hint[hidden]{display:none}\n';
    // 전체화면 밝기 버튼(왼쪽 가운데)·세로 밝기 바 — 자물쇠 버튼이 있으면 그 위에
    css += '#glide-bright-btn{all:unset;position:fixed;left:calc(16px + env(safe-area-inset-left,0px));top:50%;width:44px;height:44px;margin-top:-22px;border-radius:22px;z-index:2147483647;pointer-events:auto;cursor:pointer;' +
      'background:rgba(0,0,0,.55) url("' + SUN_ICON + '") center/22px 22px no-repeat;-webkit-tap-highlight-color:transparent}#glide-bright-btn.with-lock{margin-top:-78px}#glide-bright-btn[hidden]{display:none}\n';
    css += '#glide-bright-bar{position:fixed;left:calc(72px + env(safe-area-inset-left,0px));top:50%;width:40px;height:150px;margin-top:-75px;border-radius:20px;z-index:2147483647;pointer-events:auto;touch-action:none;background:rgba(0,0,0,.55);overflow:hidden}' +
      '#glide-bright-bar[hidden]{display:none}#glide-bright-bar>i{position:absolute;left:0;right:0;bottom:0;background:rgba(255,255,255,.9);pointer-events:none}' +
      '#glide-bright-bar>b{position:absolute;left:0;right:0;bottom:8px;height:20px;background:url("' + SUN_ICON + '") center/18px 18px no-repeat;filter:invert(.6);pointer-events:none}\n';
    css += '[data-glide-fb]{display:none!important}\n';
    css += 'html.glide-pip #glide-bright-btn,html.glide-pip #glide-bright-bar{display:none!important}\n';
    // 전체화면 가로·세로 바꾸기 버튼 (오른쪽 가운데, 화면 가장자리 여백만큼 안쪽)
    css += '#glide-rot-btn{all:unset;position:fixed;right:calc(16px + env(safe-area-inset-right,0px));top:50%;width:44px;height:44px;margin-top:-22px;border-radius:22px;z-index:2147483647;pointer-events:auto;cursor:pointer;' +
      'background:rgba(0,0,0,.55) url("' + ROT_ICON + '") center/22px 22px no-repeat;-webkit-tap-highlight-color:transparent}#glide-rot-btn[hidden]{display:none}html.glide-pip #glide-rot-btn{display:none!important}\n';
    css += '.glide-spk{display:block;width:24px;height:24px;background-color:currentColor;-webkit-mask:url("' + SPK_ICON + '") center/24px 24px no-repeat}\n';
    // 전체화면 화면 잠금 버튼·잠금 막(실수 터치 방지)
    css += '#glide-lock-btn{all:unset;position:fixed;left:16px;top:50%;width:44px;height:44px;margin-top:-22px;border-radius:22px;z-index:2147483647;pointer-events:auto;cursor:pointer;' +
      'background:rgba(0,0,0,.55) url("' + LOCK_ICON + '") center/22px 22px no-repeat;-webkit-tap-highlight-color:transparent}#glide-lock-btn[hidden]{display:none}\n';
    css += '#glide-lock-shield{position:fixed;inset:0;z-index:2147483646;pointer-events:auto;background:transparent;touch-action:none}#glide-lock-shield[hidden]{display:none}\n';
    css += '#glide-lock-shield button{all:unset;position:absolute;left:50%;bottom:48px;transform:translateX(-50%);padding:10px 18px 10px 44px;border-radius:22px;background:rgba(0,0,0,.72) url("' + LOCK_ICON + '") 16px center/20px 20px no-repeat;' +
      'color:#fff;font:600 14px/1.2 Pretendard,Roboto,system-ui,sans-serif;pointer-events:auto;transition:opacity .2s}#glide-lock-shield button[hidden]{display:none}\n';
    css += 'html.glide-pip #glide-lock-btn,html.glide-pip #glide-lock-shield{display:none!important}\n';
    // 영상 아래 버튼 줄: 유튜브 앱처럼 글자 있는 둥근 버튼 ([👍 2.6천 | 👎] [공유] [질문하기] [오프라인 저장] [Glide] [⋯]).
    // 유튜브 버튼에는 data-glide-label(글자)·data-glide-pill(좋아요·싫어요 한 덩어리)을 붙이고 글자는 ::after로 (유튜브 요소 안에 노드를 넣지 않음)
    var CHIP = 'var(--yt-spec-badge-chip-background,rgba(128,128,128,.18))';
    // 채널 줄 (유튜브 앱: 사진 32 · 이름 굵게 14 · 구독자 수 회색 12 · 오른쪽 구독 알약 높이 30·글자 12 — 2026-11-20 같은 폰 유튜브 앱 캡처로 잼). 원래 버튼 줄의 사진·구독은 숨김
    // 채널 사진: 유튜브 사진 링크를 그대로 Glide 채널 줄의 사진 자리로 옮겨 보여 줌 (버튼 줄 바로 위 줄, 위로 40px: 줄 높이 50 중 사진 32를 가운데).
    // 유튜브는 화면에 보일 때만 사진을 불러와서(지연 로딩) 숨기거나 1px로 두면 앱 안에서 옮겨 간 영상은 사진이 비었음 (실기). 누르면 유튜브 링크라 채널로 감
    // 영상 아래 버튼 줄: 유튜브(simplified)가 모든 버튼에 오른쪽 -7px → 좋아요·싫어요는 붙어 한 덩어리가 되지만 싫어요 끝을 공유 버튼이 덮었음 (폰: 싫어요 78~122, 공유 115~). 좋아요만 붙이고 나머지는 8px 띄움
    css += 'ytm-slim-video-action-bar-renderer .slim-video-action-bar-actions.simplified>:not(like-button-view-model):not(a):not(div):not(script){margin-right:8px!important}\n';
    // 좁은 화면에서는 유튜브가 싫어요를 빼고 좋아요만 둠 → 싫어요와 붙이려던 -7px 때문에 옆 버튼(장면 저장 등)과 겹쳤음 (2026-11-23 실제 사이트) → 옆에 싫어요가 없으면 띄움
    css += 'ytm-slim-video-action-bar-renderer .slim-video-action-bar-actions.simplified>like-button-view-model:not(:has(+dislike-button-view-model)){margin-right:8px!important}\n';
    css += 'html.glide-owner ytm-slim-video-action-bar-renderer{position:relative!important;margin-top:50px!important}' +
      'html.glide-owner ytm-slim-video-action-bar-renderer a.slim-video-owner-icon{display:block!important;position:absolute!important;left:12px!important;top:-40px!important;width:32px!important;height:32px!important;min-width:0!important;margin:0!important;padding:0!important;z-index:1!important}' +
      'html.glide-owner ytm-slim-video-action-bar-renderer a.slim-video-owner-icon *{width:32px!important;height:32px!important}#glide-owner .gw-ch img{visibility:hidden}' +
      'html.glide-owner ytm-slim-video-action-bar-renderer .slim-subscribe-button{display:none!important}' +
      'html:not(.glide-owner) #glide-owner{display:none!important}' +
      '#glide-owner{position:absolute;left:0;right:0;top:-50px;height:50px;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:6px 12px 4px 12px}' +
      '#glide-owner .gw-ch{display:flex;align-items:center;gap:12px;min-width:0;flex:1;text-decoration:none;color:inherit}' +
      '#glide-owner .gw-ch img{width:32px;height:32px;border-radius:50%;flex:none;object-fit:cover;background:rgba(128,128,128,.2)}' +
      '#glide-owner .gw-ch b{flex:0 0 auto;max-width:62%;font:600 14px/1.3 Roboto,"Noto Sans KR",sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}' +
      // 좁은 화면에서 이름이 '튜.'로 잘리고 구독자 수·날짜가 다 보였음(폴드2 실기) → 이름 먼저, 모자라면 구독자 수·날짜가 줄어듦
      '#glide-owner .gw-ch span{font:400 12px/1.3 Roboto,"Noto Sans KR",sans-serif;opacity:.6;white-space:nowrap;flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}' +
      // 🔔 새 영상 알림: 꺼짐은 빈 종, 켜짐은 채운 종 (유튜브 앱의 구독 알림 종과 같은 자리·모양)
      '#glide-owner .gw-bell{all:unset;flex:none;width:40px;height:40px;border-radius:20px;display:flex;align-items:center;justify-content:center;pointer-events:auto;cursor:pointer;-webkit-tap-highlight-color:transparent}#glide-owner .gw-bell[hidden]{display:none}#glide-owner .gw-bell:active{background:rgba(128,128,128,.2)}' +
      '#glide-owner .gw-bell i{width:24px;height:24px;background-color:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23000%27 stroke-width=%271.7%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z%27/%3E%3Cpath d=%27M10 20.5a2 2 0 0 0 4 0%27/%3E%3C/svg%3E") center/24px 24px no-repeat}' +
      '#glide-owner .gw-bell[aria-pressed=true] i{-webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Cpath d=%27M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z%27/%3E%3Cpath d=%27M10 20.5a2 2 0 0 0 4 0%27 fill=%27none%27 stroke=%27%23000%27 stroke-width=%271.7%27/%3E%3C/svg%3E")}' +
      '#glide-owner .gw-sub{all:unset;box-sizing:border-box;flex:none;height:30px;padding:0 12px;border-radius:15px;font:600 12px/30px Roboto,"Noto Sans KR",sans-serif;pointer-events:auto;cursor:pointer;' +
      'background:#0f0f0f;color:#fff;-webkit-tap-highlight-color:transparent}#glide-owner.d .gw-sub{background:#f1f1f1;color:#0f0f0f}' +
      '#glide-owner .gw-sub.on,#glide-owner.d .gw-sub.on{background:rgba(128,128,128,.18);color:inherit}#glide-owner .gw-sub[hidden]{display:none}#glide-owner .gw-sub:active{opacity:.6}\n';
    // 크기는 유튜브 앱과 같게: 높이 32 · 글자 12 · 아이콘 20 · 버튼 사이 8 (2026-11-20 같은 폰 캡처로 잼)
    css += '[data-glide-label],[data-glide-pill]{width:auto!important;min-width:0!important;height:32px!important;margin:8px 4px!important;padding:0 12px 0 10px!important;border-radius:16px!important;background-color:' + CHIP + '!important;gap:6px!important;flex:none!important}' +
      '[data-glide-label] .ytSpecButtonShapeNextIcon,[data-glide-pill] .ytSpecButtonShapeNextIcon{zoom:.8334}' +
      '[data-glide-label]::after{content:attr(data-glide-label);font:500 12px/1 Roboto,"Noto Sans KR",sans-serif;color:var(--yt-spec-text-primary,currentColor);white-space:nowrap}' +
      '[data-glide-pill=l]{border-radius:16px 0 0 16px!important;margin-right:0!important;padding-right:10px!important}' +
      '[data-glide-pill=r]{border-radius:0 16px 16px 0!important;margin-left:0!important;padding:0 10px!important;box-shadow:inset 1px 0 0 rgba(128,128,128,.35)!important}\n';
    // Glide가 넣는 버튼 (오프라인 저장·Glide 메뉴): 같은 둥근 버튼 모양, 아이콘은 글자색을 따르는 mask 또는 로고
    css += '.glide-chip{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:6px;height:32px;margin:8px 4px;padding:0 12px 0 10px;border-radius:16px;flex:none;cursor:pointer;pointer-events:auto;' +
      'background-color:' + CHIP + ';color:var(--yt-spec-text-primary,currentColor);font:500 12px/1 Roboto,"Noto Sans KR",sans-serif;white-space:nowrap;-webkit-tap-highlight-color:transparent}.glide-chip:active{opacity:.55}' +
      '.glide-chip i{display:block;width:20px;height:20px;flex:none}' +
      '#glide-save-btn i{background-color:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23000%27 stroke-width=%271.8%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14%27/%3E%3C/svg%3E") center/20px 20px no-repeat}' +
      '#glide-row-btn i{background:url("' + LOGO + '") center/18px 18px no-repeat}' +
      '#glide-frame-btn i{background-color:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23000%27 stroke-width=%271.8%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M4 8h3l1.5-2.5h7L17 8h3v11H4z%27/%3E%3Ccircle cx=%2712%27 cy=%2713%27 r=%273.5%27/%3E%3C/svg%3E") center/20px 20px no-repeat}\n';
    // 목록 정보 줄을 유튜브 앱처럼 (1.8.7): "채널 ✓ • 조회수 12만회 • 5일 전" → "채널  ▷12만  5일 전". 인증 배지·• 는 숨기고 사이 8,
    // 조회수 칸은 아래 '목록 정보 줄' 스크립트(gvScan)가 붙인 data-gv 를 ▷ 아이콘 + 글자로 보여 줌 (유튜브 글자는 font-size 0 으로 숨김, 노드는 그대로)
    css += 'yt-lockup-view-model .ytContentMetadataViewModelDelimiter,ytm-media-item .ytmBadgeAndBylineRendererSeparator{display:none!important}' +
      'yt-lockup-view-model .ytContentMetadataViewModelDelimiter+.ytContentMetadataViewModelMetadataText,ytm-media-item .ytmBadgeAndBylineRendererSeparator+.ytmBadgeAndBylineRendererItemByline{margin-left:8px!important}' +
      ':is(yt-lockup-view-model .ytContentMetadataViewModelMetadataText,ytm-badge-and-byline-renderer .ytAttributedStringHost)>span:has(.ytAttributedStringImageElement){display:none!important}' +
      '[data-gv]{font-size:0!important;white-space:nowrap!important}' +
      // ▷·글자는 줄 높이(1lh) 기준 위쪽 맞춤: font-size 0 인 칸의 기준선이 달라 그냥 두면 1~2px 떠 보였음(실기)
      '[data-gv]::before{content:"";display:inline-block;width:9px;height:10px;margin:calc((1lh - 10px) / 2) 2px 0 0;font-size:12px;vertical-align:top;background-color:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 10 12%27 fill=%27none%27 stroke=%27%23000%27 stroke-width=%271.3%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M1.7 1.5 8.7 6l-7 4.5z%27/%3E%3C/svg%3E") center/9px 10px no-repeat}' +
      '[data-gv]::after{content:attr(data-gv);font-size:12px;line-height:inherit;vertical-align:top}\n';
    // 목록 항목 눌림 표시 없앰 (1.8.8, 사용자: "유튜브 앱은 홈에서 스크롤해도 영상이 살짝씩 선택되는 모션이 없는데 Glide에는 있음").
    // 유튜브 웹은 손가락이 닿을 때와 뗄 때(스크롤 뒤에도) 항목 전체(썸네일+글, 바깥으로 12px)에 10% 회색 막을 띄우고 0.1~0.4초에 걸쳐 지움 (실기 측정)
    // → 스크롤할 때마다 썸네일이 깜빡여 버벅이는 듯 보였음. 링크 항목(구독·검색·영상 아래)은 안드로이드 기본 탭 강조색(파랑 40%)도 투명으로
    // 탭 위치를 되살리는 동안 목록을 가림 (맨 위 → 보던 자리로 뛰는 모습이 안 보이게, 최대 4초)
    css += 'html.glide-tabrestore ytm-browse{visibility:hidden!important}\n';
    css += '.ytLockupViewModelHost>yt-touch-feedback-shape{display:none!important}' +
      // 대신 Glide 누름 표시(아래 '누른 순간 반응'): 손가락이 머문 항목에만, 스크롤하면 바로 사라짐
      '#glide-press{position:fixed;z-index:3;pointer-events:none;border-radius:12px;opacity:0;background:rgba(0,0,0,.08);transition:opacity .15s ease-out}#glide-press.d{background:rgba(255,255,255,.13)}#glide-press.on{opacity:1;transition:opacity .05s ease-in}' +
      ':is(ytm-rich-item-renderer,ytm-video-with-context-renderer,ytm-compact-video-renderer,yt-lockup-view-model,ytm-media-item),:is(ytm-rich-item-renderer,ytm-video-with-context-renderer,ytm-compact-video-renderer,yt-lockup-view-model,ytm-media-item) *{-webkit-tap-highlight-color:transparent!important}\n';
    // 전체화면 제목 줄 (1.8.9): 유튜브 앱처럼 조작부가 보일 때 왼쪽 위에 ⌄ · 제목(굵게 18) · 채널 이름(회색 12). 아래 '전체화면 제목 줄' 참고
    css += '#glide-fstitle{display:flex;align-items:center;gap:4px;padding:9px 0 0 4px;max-width:100%;box-sizing:border-box;pointer-events:none}#glide-fstitle[hidden]{display:none}' +
      '#glide-fstitle.gf-abs{position:absolute;left:0;top:0;right:176px;max-width:none;z-index:1}' +
      '#glide-fstitle .gf-down{all:unset;flex:none;width:44px;height:44px;border-radius:22px;cursor:pointer;pointer-events:auto;background:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23fff%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E") center/26px 26px no-repeat;-webkit-tap-highlight-color:transparent}#glide-fstitle .gf-down:active{background-color:rgba(255,255,255,.18)}' +
      // 조작부가 숨어 있을 때(fadein 없음)는 ⌄도 안 눌림: 조작부를 띄우려던 탭에 전체화면이 나갔음 (전수조사 반영)
      '#player-control-overlay:not(.fadein) #glide-fstitle .gf-down{pointer-events:none}' +
      '#glide-fstitle .gf-t{min-width:0;flex:1;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.35)}' +
      '#glide-fstitle b{display:block;font:600 18px/1.3 Roboto,"Noto Sans KR",sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#glide-fstitle span{display:block;margin-top:1px;font:400 12px/1.4 Roboto,"Noto Sans KR",sans-serif;opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n';
    // 전체화면 '동영상 더보기' 창이 열리면 유튜브가 자기 제목(…FullscreenControlsVideoTitle)을 위에 그림 → Glide 제목 줄과 겹쳐 두 줄이 포개졌음.
    // 밝기·회전 버튼과 자막도 추천 줄 위에 떠 있었음 (폴드2 실기, 2026-11-25). 유튜브 앱은 창이 열리면 추천 줄과 제목만 보임
    css += 'html:has(.fullscreen-controls.expanded) #glide-fstitle,html:has(.fullscreen-controls.expanded) #glide-bright-btn,html:has(.fullscreen-controls.expanded) #glide-bright-bar,html:has(.fullscreen-controls.expanded) #glide-rot-btn,html:has(.fullscreen-controls.expanded) .ytp-caption-window-container{visibility:hidden!important}\n';
    css += 'html.glide-mini #player-control-container{visibility:hidden!important}' + String.fromCharCode(10);
    // 길게 눌러 2배속 동안: 유튜브 앱은 '2배 ▶▶'만 보임. 모바일 웹은 진행 막대·동그라미까지 띄웠음 (폴드2 실기 비교, 2026-11-25)
    css += 'html[data-glide-hold] yt-progress-bar.watch-page-progress-bar{opacity:0!important}' + String.fromCharCode(10);
    // 댓글 '답글 더보기': 유튜브 앱은 그 줄 전체(화면 폭, 높이 48dp)가 눌림. 모바일 웹은 글자 버튼(104×32)만 눌렸음 (폴드2 비교, 2026-11-25).
    // 버튼 자체 배치는 그대로 두고 투명한 ::after 로 누르는 범위만 줄 전체로 넓힘
    css += 'ytm-engagement-panel ytm-comment-replies-renderer ytm-continuation-item-renderer button{position:relative!important;overflow:visible!important}' +
      'ytm-engagement-panel ytm-comment-replies-renderer ytm-continuation-item-renderer button::after{content:"";position:absolute;top:-8px;bottom:-8px;left:-64px;right:-400px}' +
      'ytm-engagement-panel ytm-comment-thread-renderer{overflow-x:clip!important}' + String.fromCharCode(10);
    // 영상 웹뷰의 영상 화면: 유튜브 앱처럼 영상 위 상단 바 없이 맨 위부터 (Glide 버튼은 영상 아래 버튼 줄에). ytm-app이 상단 바 높이만큼 padding-top을 둠
    css += 'html.glide-notop ytm-mobile-topbar-renderer{display:none!important}html.glide-notop ytm-app{padding-top:0!important}html.glide-notop #player-container-id{top:0!important}\n';
    // 상단 바를 숨기면 유튜브가 '상단 바(48) + 영상' 아래에 두는 것들이 48px 떠 있음 (실기 2026-11-20, 유튜브 앱과 비교)
    //  - 댓글·설명 창: 영상 바로 아래부터 (유튜브 앱과 같음). 유튜브 규칙 top:calc(48px + 56.25vw)에서 48만 뺌. 세로 화면만
    //  - 추천 목록 필터 줄(모두·추천·최근 업로드…): 유튜브 웹은 목록까지 내리면 영상 아래에 고정해 목록을 가림.
    //    유튜브 앱은 고정된 줄 없이 목록이 영상 바로 아래로 올라옴 → 고정하지 않고 목록 맨 앞에 두어 함께 스크롤 (필터 기능은 남김)
    css += '@media (orientation:portrait){html.glide-notop ytm-engagement-panel{top:56.25vw!important}}' +
      'html.glide-notop ytm-related-chip-cloud-renderer{position:relative!important;top:auto!important;transform:none!important;height:auto!important;' +
      'opacity:1!important;pointer-events:auto!important;display:block!important;transition:none!important;z-index:auto!important}\n';
    // 댓글 창 안쪽: 유튜브 앱처럼 촘촘하게 (2026-11-20 같은 폰 비교). 프로필 사진 24px·글 칸 48px부터, '자세히 알아보기'는 작은 한 줄,
    // 댓글 입력칸은 아래에 붙은 막대(누르면 키보드 바로 위에 입력창 — 실기 확인). 막대 배경은 창 배경을 물려받음(밝게·어둡게 모두)
    // 주의: 댓글 본문도 <button>(YtmCommentRendererContent)이라 답글 칸의 button 전체를 건드리면 답글이 찌그러짐 → '답글 더보기' 버튼만
    var CP = 'html.glide-notop ytm-engagement-panel ';
    css += CP + 'ytm-comment-thread-renderer{padding:12px 12px 6px!important}' +
      CP + '.YtmCommentRendererIconContainer{width:24px!important;min-width:24px!important;flex:none!important}' +
      CP + '.YtmCommentRendererIconContainer ytm-profile-icon,' + CP + '.YtmCommentRendererIconContainer img{width:24px!important;height:24px!important}' +
      CP + '.YtmCommentRendererContent{padding:0 0 0 12px!important}' +
      CP + '.YtmCommentRendererExpand{padding:0!important}' +
      CP + '.YtmCommentRendererExpand button{height:22px!important;min-height:0!important;padding:0!important;margin:0!important}' +
      CP + '.YtmCommentRendererExpand .ytAttributedStringHost{line-height:22px!important;font-size:13px!important;opacity:.65}' +
      CP + '.YtmCommentRendererDetails{margin-top:0!important}' +
      CP + 'ytm-comment-replies-renderer{margin:2px 0 0 36px!important}' +
      CP + 'ytm-comment-replies-renderer ytm-continuation-item-renderer button{height:32px!important}' +
      CP + '.engagement-panel-content-wrapper,' + CP + 'ytm-section-list-renderer,' + CP + 'lazy-list,' + CP + 'ytm-item-section-renderer,' + CP + 'ytm-comments-header-renderer{background-color:inherit}' +
      CP + 'ytm-comments-header-renderer{position:fixed!important;left:0;right:0;bottom:0;z-index:5;box-shadow:0 -1px 0 rgba(128,128,128,.25)}' +
      CP + 'ytm-comments-header-renderer ytm-comment-simplebox-renderer{padding:8px 12px!important}' +
      CP + '.YtmCommentSimpleboxRendererIcon{display:none!important}' +
      CP + '.YtmCommentSimpleboxRendererInput{margin:0!important;flex:1!important}' +
      CP + '.YtmCommentSimpleboxRendererPlaceholder{padding:0!important;border:0!important}' +
      CP + '.YtmCommentSimpleboxRendererReply{height:40px!important;border-radius:20px!important;background:rgba(128,128,128,.14)!important;padding:0 16px!important}' +
      CP + '.engagement-panel-content-wrapper{padding-bottom:60px!important}' +
      // 댓글 정렬 칩 (유튜브 앱: 선택된 칩은 진한 바탕, 모서리 8px)
      '#glide-csort{display:flex;gap:8px;padding:10px 16px 10px;flex:none}' +
      'html.glide-cmauto bottom-sheet-container,html.glide-cmauto ytw-scrim{opacity:0!important;pointer-events:none!important;transition:none!important}' +
      '#glide-csort button{all:unset;box-sizing:border-box;pointer-events:auto;height:30px;padding:0 14px;border-radius:15px;font:600 13px/30px Roboto,"Noto Sans KR",sans-serif;' +
      'background:rgba(128,128,128,.14);color:inherit;cursor:pointer}' +
      '#glide-csort button[aria-pressed=true]{background:#0f0f0f;color:#fff}#glide-csort.d button[aria-pressed=true]{background:#f1f1f1;color:#0f0f0f}\n';
    // 영상 제목: 유튜브 앱처럼 2줄까지 (제목 칸은 이미 2줄 제한인데 안쪽 글자가 줄바꿈 금지라 1줄로 잘렸음)
    // 다음에 재생 (1.8.6): 메뉴 항목 아이콘 · 영상 화면 '다음에 재생 N개' 줄 · 목록 창
    var QI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 6h11M3 11h11M3 16h7'/%3E%3Cpath d='M15 13.5v7l5.5-3.5z' fill='%23000'/%3E%3C/svg%3E", QF = 'Roboto,"Noto Sans KR",sans-serif';
    css += '.glide-qi{display:block;width:24px;height:24px;background-color:currentColor;-webkit-mask:url("' + QI + '") center/24px 24px no-repeat}' +
      '#glide-queue{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:10px;width:calc(100% - 24px);margin:4px 12px 2px;padding:10px 12px 10px 14px;border-radius:12px;background:rgba(128,128,128,.12);color:inherit;font:400 13px/1.3 ' + QF + ';cursor:pointer;pointer-events:auto;-webkit-tap-highlight-color:transparent}' +
      '#glide-queue i{flex:none;width:22px;height:22px;background-color:currentColor;-webkit-mask:url("' + QI + '") center/22px 22px no-repeat}' +
      '#glide-queue b{flex:none;font:600 14px/1.3 ' + QF + '}#glide-queue span{flex:1;min-width:0;opacity:.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#glide-queue::after{content:"›";font-size:20px;line-height:1;opacity:.55}#glide-queue:active{opacity:.6}' +
      '#glide-qscrim{position:fixed;inset:0;z-index:2147483640;background:rgba(0,0,0,.45);animation:gqfade .2s ease-out}' +
      '#glide-qsheet{position:fixed;left:0;right:0;bottom:0;z-index:2147483641;max-height:75%;display:flex;flex-direction:column;border-radius:20px 20px 0 0;background:#fff;color:#0f0f0f;font:400 14px/1.4 ' + QF + ';box-shadow:0 -6px 24px rgba(0,0,0,.2);animation:gqup .24s cubic-bezier(.2,0,0,1)}' +
      '#glide-qsheet.d{background:#212121;color:#f1f1f1}@keyframes gqup{from{transform:translateY(100%)}}@keyframes gqfade{from{opacity:0}}' +
      '#glide-qsheet .qg{width:36px;height:4px;margin:8px auto 0;border-radius:2px;background:rgba(128,128,128,.45)}' +
      '#glide-qsheet .qh{display:flex;flex-wrap:wrap;align-items:center;padding:8px 6px 6px 20px}#glide-qsheet .qh h3{flex:1;margin:0;font:700 18px/1.3 ' + QF + '}' +
      '#glide-qsheet .qh span{order:3;flex-basis:100%;margin:0 0 4px;font-size:12px;opacity:.6}' +
      '#glide-qsheet .qz,#glide-qsheet .qx{all:unset;flex:none;width:40px;height:40px;border-radius:20px;text-align:center;line-height:40px;font-size:16px;opacity:.6;cursor:pointer}' +
      '#glide-qsheet .ql{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:2px 0 6px}' +
      '#glide-qsheet .qd{flex:none;width:28px;height:44px;margin-right:-6px;display:flex;align-items:center;justify-content:center;touch-action:none}#glide-qsheet .qd i{width:20px;height:20px;background-color:currentColor;opacity:.45;-webkit-mask:url("' + DRAG_I + '") center/20px 20px no-repeat}' +
      '#glide-qsheet .qr.mv{transition:transform .18s cubic-bezier(.2,0,0,1)}#glide-qsheet .qr.drag{position:relative;z-index:2;background:rgba(128,128,128,.16);box-shadow:0 6px 18px rgba(0,0,0,.18);border-radius:10px}' +
      '#glide-qsheet .qr{display:flex;align-items:center;gap:12px;padding:8px 6px 8px 8px;cursor:pointer}#glide-qsheet .qr:active{background:rgba(128,128,128,.12)}' +
      '#glide-qsheet .qr img{flex:none;width:100px;aspect-ratio:16/9;border-radius:8px;object-fit:cover;background:rgba(128,128,128,.2)}' +
      '#glide-qsheet .qt{flex:1;min-width:0}#glide-qsheet .qt b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:500 14px/1.35 ' + QF + '}' +
      '#glide-qsheet .qt span{display:block;margin-top:2px;font-size:12px;opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#glide-qsheet .qf{padding:8px 16px 14px;box-shadow:0 -1px 0 rgba(128,128,128,.16)}' +
      '#glide-qsheet .qc{all:unset;display:block;box-sizing:border-box;width:100%;padding:12px;border-radius:22px;text-align:center;font:500 15px/1.2 ' + QF + ';color:#cc0000;background:rgba(255,78,69,.1);cursor:pointer}#glide-qsheet.d .qc{color:#ff6b62}\n';
    // 다 본 영상 숨기기 (1.8.6, 설정 hideWatched): 썸네일 아래 빨간 진행 막대가 90% 넘은 항목을 홈·구독·영상 아래 추천 목록에서 숨김.
    // 진행 막대는 aria-valuetext가 '95%'처럼 퍼센트 (실기 확인: yt-lockup-view-model 안 yt-progress-bar, '5%').
    // 예전 배치(ytm-thumbnail-overlay-resume-playback-renderer)는 막대 너비로. 검색·채널·기록 화면은 그대로(html.glide-hw는 updateHideWatched가 붙임)
    // **미리보기 플레이어 막대는 뺌** (1.9.2, 사용자 제보 '홈 영상들이 계속 깜빡임'): 유튜브는 홈 맨 위 영상에 소리 없는 미리보기 플레이어를
    // 항목 안(#video-preview-portal > ytm-video-preview > yt-inline-player-controls > yt-progress-bar, role=slider)에 붙이는데, 그 막대도 같은 태그·퍼센트라
    // 라이브 미리보기('100%')가 '다 본 영상'으로 잡혀 항목이 숨었다 나타나기를 0.7초마다 되풀이했음 (폰 CDP 기록: none:bar=100%:video ↔ inline-block)
    var HWP = [];
    // 다 본 영상 막대도 yt-progress-bar·role=slider 라 태그·역할로는 못 가름 → 미리보기 플레이어 칸 안인지로만
    var HW_NOT = ':not(#video-preview-portal *, ytm-video-preview *, yt-inline-player-controls *, #movie_player *, ytm-inline-playback-renderer *)';
    for (var hw = 90; hw <= 100; hw++) { HWP.push('[aria-valuetext="' + hw + '%"]' + HW_NOT); HWP.push('.thumbnail-overlay-resume-playback-progress[style*="width: ' + hw + '"]' + HW_NOT); }
    css += 'html.glide-hw :is(ytm-rich-item-renderer,ytm-video-with-context-renderer,ytm-compact-video-renderer,ytm-media-item,yt-lockup-view-model):has(:is(' + HWP.join(',') + ')){display:none!important}\n';
    css += 'h2.ytVideoMetadataViewModelTitle .ytAttributedStringHost{white-space:normal!important;line-height:inherit!important}' +
      // 유튜브가 제목 칸 높이를 45px로 고정해 둘째 줄 아래가 잘렸음(줄 높이 26px × 2 = 52px, 실기 확인) → 줄 높이를 유튜브 앱처럼 줄이고 높이는 2줄만큼
      'html h2.ytVideoMetadataViewModelTitle{max-height:none!important;height:auto!important;line-height:1.3!important;display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important;overflow:hidden!important}\n';
    // 두 번 탭 이동 표시: 유튜브 앱과 같게 '+10 ›' / '‹ -10'만 (2026-11-20 같은 폰 비교: 숫자는 영상 1/4·3/4 지점, 화살표는 바깥 끝, 배경 원 없음)
    css += '#glide-dt{position:fixed;z-index:2147483647;pointer-events:none;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.5)}#glide-dt[hidden]{display:none}' +
      '#glide-dt i,#glide-dt b{position:absolute;top:50%;transform:translate(-50%,-50%);font-style:normal;font:500 19px/1 Roboto,system-ui,sans-serif}' +
      '#glide-dt i{font-size:30px;font-weight:300}#glide-dt.r b{left:75%}#glide-dt.r i{left:91%}#glide-dt.l b{left:25%}#glide-dt.l i{left:9%}' +
      'html.glide-dt-on #player-control-overlay{opacity:0!important;transition:none!important}\n';
    css += A.pipCss.join('\n') + '\n' + A.fullCss.join('\n') + '\n' + A.zoomCss.join('\n');
    // 유튜브 앱처럼 목록 구분선·간격 (설정 '유튜브 앱처럼 구분선', 기본 켜짐)
    var st = G.settings();
    // 앱 화면 다듬기(항상): 모바일 웹 특유의 어색함을 앱처럼 (예: 추천 썸네일 칸이 16:9보다 길어 좌우가 잘리던 것)
    if (st.enabled) css += '\n' + A.appCss.join('\n');
    if (st.enabled && st.appStyle !== false) css += '\n' + A.polishCss.join('\n');
    style.textContent = css;
    mountStyle();
  }
  // 문서 시작 시점에는 <head>가 없어 <html>에 붙이는데, 파서가 지울 수 있어 문서 준비 때 다시 붙임
  function mountStyle() {
    var parent = document.head || document.documentElement;
    if (parent && style.parentNode !== parent) parent.appendChild(style);
  }
  updateStyle();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountStyle, { once: true });

  // ===========================================================================
  // 상단 바 Glide 버튼
  //   모바일 유튜브 상단 바는 상황마다 구조가 달라서(검색 버튼 / 펼친 검색창 / 검색 결과) 기준 후보를 순서대로 찾음
  // ===========================================================================
  var injected = false, placedRank = Infinity;
  function inject(anchor, rank) {
    if (!anchor) return;
    var existing = document.getElementById(BTN);
    if (existing && existing.isConnected) {
      if (rank < placedRank) { place(existing, anchor); placedRank = rank; }
      return;
    }
    var b = document.createElement('button');
    b.id = BTN;
    b.type = 'button';
    b.setAttribute('aria-label', 'Glide 메뉴');
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('openPanel', {}); }, true);
    place(b, anchor);
    placedRank = rank;
    if (!injected) { injected = true; G.send('headerButton', { ok: true }); log('info', '상단 바에 Glide 버튼 추가 (기준 ' + rank + ')'); }
  }
  // 기준이 상단 바 자체면 맨 끝에, 버튼이면 그 앞에
  function place(b, anchor) {
    if (anchor.matches && anchor.matches('header, .mobile-topbar-header-content')) anchor.appendChild(b);
    else if (anchor.parentNode) anchor.parentNode.insertBefore(b, anchor);
  }
  function findAnchor() {
    for (var i = 0; i < A.headerAnchors.length; i++) {
      var el = null;
      try { el = document.querySelector(A.headerAnchors[i]); } catch (err) { continue; }
      if (el) { inject(el, i); return; }
    }
  }
  document.addEventListener('animationstart', function (e) { if (e.animationName === ANIM) findAnchor(); }, true);
  G.setTimeout.call(W, function () {
    // 영상 웹뷰는 상단 바를 숨기고 버튼 줄에 Glide 버튼을 넣으므로 '못 찾음'을 알리지 않음
    if (!injected && role() !== 'player') { G.send('headerButton', { ok: false }); log('warn', '상단 바를 찾지 못해 앱의 떠 있는 버튼을 씀 (filters.json android.headerAnchors 확인)'); }
  }, A.headerTimeoutMs);

  // ===========================================================================
  // 손동작
  // ===========================================================================
  var hintEl = null, hintTimer = 0;
  function hint(text, ms) {
    if (!hintEl) {
      hintEl = document.createElement('div');
      hintEl.id = 'glide-gesture-hint';
    }
    // 브라우저 전체화면에서는 전체화면 요소 안에 있어야 보임
    var parent = fullscreenEl() || document.body || document.documentElement;
    if (hintEl.parentNode !== parent) parent.appendChild(hintEl);
    hintEl.textContent = text;
    hintEl.hidden = false;
    if (hintTimer) G.clearTimeout.call(W, hintTimer);
    if (ms) hintTimer = G.setTimeout.call(W, function () { hintEl.hidden = true; }, ms);
  }
  function hideHint() { if (hintEl) hintEl.hidden = true; }

  // ---- 전체화면 상태 ----
  // 원칙: 유튜브 자체 전체화면(브라우저 전체화면, 또는 유튜브의 '가짜 전체화면' body[faux-fullscreen])을 그대로 씀.
  //       유튜브 전체화면이 열리지 않을 때만 앱 대체 전체화면(html.glide-full: 유튜브 가짜 전체화면과 같은 배치, 조작부 그대로)
  function fullscreenEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function fauxFull() { return !!(document.body && document.body.getAttribute('faux-fullscreen') === 'true'); }
  function appFull() { return document.documentElement.classList.contains('glide-full'); }
  function inFull() { return !!fullscreenEl() || fauxFull() || appFull(); }
  function mainPlayer() { return document.getElementById('movie_player') || document.querySelector('.html5-video-player'); }
  // 플레이어 영역: 모바일 유튜브는 조작부(#player-control-container)가 #movie_player 바깥, 같은 상자 안에 있음
  function playerArea() { return document.getElementById('player-container-id') || mainPlayer(); }
  // 손동작·앱 전체화면은 모바일 유튜브 영상 화면에서만 (유튜브 뮤직·쇼츠는 각자의 조작을 그대로)
  function onYT() { return location.hostname === 'm.youtube.com'; }
  function onWatch() { return onYT() && location.pathname === '/watch'; }
  function videoIsPortrait() {
    var v = (mainPlayer() || document).querySelector('video');
    return !!(v && v.videoWidth && v.videoHeight > v.videoWidth);
  }
  function ytFullButton() {
    for (var i = 0; i < A.fullscreenButtons.length; i++) {
      var b = null;
      try { b = document.querySelector(A.fullscreenButtons[i]); } catch (e) { continue; }
      if (b) return b;
    }
    return null;
  }
  function resized() { try { W.dispatchEvent(new Event('resize')); } catch (e) { /* ignore */ } }

  // 앱에 페이지 안 전체화면(유튜브 가짜 전체화면·앱 대체 전체화면) 상태를 알림 → 앱이 시스템 바를 숨기고 화면 방향을 맞춤
  // (브라우저 전체화면은 앱이 직접 알게 되므로 제외)
  var reportedFull = false;
  function reportFull() {
    var on = fauxFull() || appFull();
    if (on === reportedFull) return;
    reportedFull = on;
    G.send('fullState', { on: on, portrait: videoIsPortrait(), kind: appFull() ? 'glide' : 'youtube', center: !!(on && CENTER) });
    try { W.dispatchEvent(new Event('glide:fullstate')); } catch (e) { /* ignore */ }
  }
  function watchFaux() {
    if (!document.body || typeof MutationObserver !== 'function') return;
    new MutationObserver(function () { if (!fauxFull()) document.documentElement.classList.remove('glide-zoom'); reportFull(); })
      .observe(document.body, { attributes: true, attributeFilter: ['faux-fullscreen'] });
    reportFull();
  }
  if (document.body) watchFaux(); else document.addEventListener('DOMContentLoaded', watchFaux, { once: true });

  // ===========================================================================
  // 전체화면 밝기 (Glide만의 기능, 유튜브 앱엔 없음): 조작 버튼이 보일 때 왼쪽 가운데에 밝기 버튼.
  // 누르면 세로 밝기 바가 뜨고, 그 바 위에서만 위아래로 밀어 조절 (화면 위아래 손동작과 겹치지 않게).
  // 앱 창의 밝기만 바꾸고(폰 설정은 그대로), 전체화면을 나가면 원래 밝기로 돌아감
  // ===========================================================================
  var BR = { btn: null, bar: null, fill: null, v: -1, open: false, timer: 0, set: false };
  function brShow(v) { if (BR.fill) BR.fill.style.height = Math.round(Math.max(0, Math.min(1, v)) * 100) + '%'; }
  function brArm() { if (BR.timer) G.clearTimeout.call(W, BR.timer); BR.timer = G.setTimeout.call(W, function () { brClose(); }, 2500); }
  function brClose() { var was = BR.open; BR.open = false; if (BR.bar) BR.bar.hidden = true; if (BR.timer) { G.clearTimeout.call(W, BR.timer); BR.timer = 0; } if (was) { lastGeom = ''; reportGeom(); } }
  function brFromY(y) {
    var r = BR.bar.getBoundingClientRect(); if (!r.height) return;
    var v = Math.max(0.01, Math.min(1, (r.bottom - y) / r.height));
    BR.v = v; BR.set = true; BR.touched = true; brShow(v); G.send('brightness', { v: v }); brArm();
  }
  function ensureBrEls() {
    if (!BR.btn) {
      BR.btn = G.el('button', { id: 'glide-bright-btn', type: 'button', 'aria-label': '밝기', 'data-glide': 'bright', hidden: '' });
      BR.bar = G.el('div', { id: 'glide-bright-bar', 'data-glide': 'bright', role: 'slider', 'aria-label': '밝기', hidden: '' }, [G.el('i'), G.el('b')]);
      BR.fill = BR.bar.firstChild;
      var stop = function (e) { e.stopPropagation(); };
      BR.btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (BR.open) { brClose(); return; }
        BR.open = true; BR.touched = false; BR.bar.hidden = false; brShow(BR.v < 0 ? 0.5 : BR.v); G.send('brightness', { v: -2 }); brArm();
        lastGeom = ''; reportGeom();
      }, true);
      ['touchstart', 'touchmove'].forEach(function (t) {
        BR.bar.addEventListener(t, function (e) { e.preventDefault(); e.stopPropagation(); var p = e.touches && e.touches[0]; if (p) brFromY(p.clientY); }, { capture: true, passive: false });
      });
      ['touchend', 'click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup'].forEach(function (t) { BR.bar.addEventListener(t, stop, true); BR.btn.addEventListener(t, stop, true); });
    }
    var parent = lockParent();
    if (BR.btn.parentNode !== parent) parent.appendChild(BR.btn);
    if (BR.bar.parentNode !== parent) parent.appendChild(BR.bar);
  }
  var BRZ = null;
  W.addEventListener('touchstart', function (e) {
    BRZ = null;
    if (!BR.open || !BR.bar || BR.bar.hidden || e.touches.length !== 1 || BR.bar.contains(e.target) || (BR.btn && BR.btn.contains(e.target))) return;
    var t = e.touches[0], r = BR.bar.getBoundingClientRect();
    if (!r.height || t.clientX < r.left - 64 || t.clientX > r.right + 64 || t.clientY < r.top - 48 || t.clientY > r.bottom + 48) return;
    BRZ = { y0: t.clientY, x0: t.clientX, v0: BR.v < 0 ? 0.5 : BR.v, h: r.height, on: false, target: e.target };
    brArm();
  }, { capture: true, passive: false });
  W.addEventListener('touchmove', function (e) {
    if (!BRZ) return;
    if (!BRZ.on) { // 세로로 8px 넘게 끌 때부터 밝기 (탭·가로 밀기는 원래대로)
      var mdy = Math.abs(e.touches[0].clientY - BRZ.y0), mdx = Math.abs(e.touches[0].clientX - BRZ.x0);
      if (mdx > 12 && mdx > mdy) { BRZ = null; return; }
      if (mdy < 8) return;
      BRZ.on = true; BRZ.y0 = e.touches[0].clientY; BRZ.v0 = BR.v < 0 ? 0.5 : BR.v; T = null; holdEnd();
      // 유튜브는 손가락이 닿을 때부터 '길게 누르기(2배속)'를 재므로, 여기서부터 밝기가 가져가는 터치는 유튜브에 '취소'로 끝냄
      // (안 하면 움직임·손 뗌을 못 받은 유튜브가 2배속을 켠 채로 둠 — 폰에서 2배속이 남았음)
      try {
        var tch = e.touches[0], tgt = BRZ.target || e.target;
        BRZ.canceling = true;
        tgt.dispatchEvent(new TouchEvent('touchcancel', { bubbles: true, cancelable: true, composed: true, touches: [], targetTouches: [], changedTouches: [tch] }));
      } catch (x) { /* ignore */ } finally { BRZ.canceling = false; }
    }
    e.stopPropagation(); if (e.cancelable) e.preventDefault();
    var y = e.touches[0].clientY, v = Math.max(0.01, Math.min(1, BRZ.v0 + (BRZ.y0 - y) / BRZ.h));
    BR.v = v; BR.set = true; BR.touched = true; brShow(v); G.send('brightness', { v: v }); brArm();
  }, { capture: true, passive: false });
  ['touchend', 'touchcancel'].forEach(function (t) { W.addEventListener(t, function (e) { if (BRZ && BRZ.canceling) return; var z = BRZ; BRZ = null; if (!z || !z.on) return; e.stopPropagation(); if (e.cancelable) e.preventDefault(); }, { capture: true, passive: false }); });
  function updateBrBtn() {
    if (!inFull() || LK.on) {
      if (BR.btn) BR.btn.hidden = true; brClose();
      if (ROT.btn) ROT.btn.hidden = true;
      if (!inFull() && BR.set) { BR.set = false; BR.v = -1; G.send('brightness', { v: -1 }); }
      return;
    }
    ensureBrEls();
    BR.btn.classList.toggle('with-lock', S().expLock === true);
    BR.btn.hidden = !controlsShown() && !BR.open;
    rotUpdate();
  }
  // ===========================================================================
  // 전체화면 가로·세로 바꾸기 (2026-11-21 사용자 요청): 오른쪽 가운데 버튼 → 앱이 화면 방향을 반대로 고정 (전체화면은 그대로).
  // 폰을 실제로 그 방향으로 들면 고정이 풀려 다시 자동 회전 (앱 lockOrientation)
  // ===========================================================================
  var ROT = { btn: null };
  function rotUpdate() {
    if (!role() && !S().role) return; // 예전 앱(회전 명령 없음)
    if (!ROT.btn) {
      ROT.btn = G.el('button', { id: 'glide-rot-btn', type: 'button', 'aria-label': '가로·세로 바꾸기', 'data-glide': 'rot', hidden: '' });
      ROT.btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); G.send('fullRotate', {}); log('info', '전체화면 가로·세로 바꾸기'); }, true);
      ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'mousedown', 'mouseup'].forEach(function (t) { ROT.btn.addEventListener(t, function (e) { e.stopPropagation(); }, true); });
    }
    var parent = lockParent();
    if (ROT.btn.parentNode !== parent) parent.appendChild(ROT.btn);
    // 조작부가 사라지는 순간 누른 것도 받게 0.8초 더 남겨 둠 (예전: 사라지는 찰나에 누르면 조작부만 다시 뜨고 안 돌아감 — 2026-11-23 사용자)
    var shown = controlsShown();
    if (shown) ROT.seen = Date.now();
    var grace = !shown && Date.now() - (ROT.seen || 0) < 800;
    ROT.btn.hidden = !inFull() || LK.on || !(shown || grace);
    if (grace) { clearTimeout(ROT.t); ROT.t = G.setTimeout.call(W, function () { try { rotUpdate(); } catch (e) { /* ignore */ } }, 820); }
  }
  G.onCommand('brightness', function (arg) { if (arg && typeof arg.v === 'number' && arg.v >= 0 && !BR.touched) { BR.v = arg.v; if (BR.open) brShow(arg.v); } });
  document.addEventListener('fullscreenchange', function () { if (!fullscreenEl()) document.documentElement.classList.remove('glide-zoom'); });

  // 유튜브 전체화면 조작부 (1.8.9): Glide 손동작·회전 전체화면(html.glide-full)에서도 유튜브가 '전체화면'으로 알게 해서
  // 유튜브가 전체화면 조작부를 그리게 함 — 맨 아래 좋아요·싫어요·공유·저장 줄과 '동영상 더보기', 그 위로 올라간 진행 막대·시간·'동영상 정보'
  // (유튜브 앱 전체화면과 같은 배치. 전에는 유튜브 전체화면 버튼으로 들어갈 때만 나왔음).
  //  - 플레이어 setFauxFullscreen(true): 브라우저 전체화면 없이 조작부만 전체화면 → 사용자 손동작이 필요 없어 회전에도 됨
  //  - body[faux-fullscreen=true]: 유튜브 자체 전체화면 때 유튜브가 붙이는 값. 유튜브 CSS가 이것으로 아래 조작부를 올림
  //    (setFauxFullscreen만 하면 아래 줄이 시간·진행 막대를 덮었음 — 2026-11-20 실제 사이트 가로 화면 시험)
  //  - 이 상태의 유튜브 '전체 화면 종료' 버튼은 진짜 전체화면을 열려고 함 → Glide가 가로채 전체화면을 나감
  var YTFS = false;
  // 전체화면 '동영상 더보기' 창 (유튜브 전체화면 조작부 아래에서 올라오는 추천 영상 줄): 열리면 .fullscreen-controls.expanded, 닫기 ✕는 위 조작부
  function fsPanel() { var p = document.querySelector('.fullscreen-controls.expanded'); return p && p.getClientRects().length ? p : null; }
  function fsPanelClose() {
    var b = document.querySelector('.ytwPlayerFullscreenTopControlsFullscreenCloseButtonWrapper button, player-fullscreen-top-controls .icon-close button');
    if (b) b.click();
    G.setTimeout.call(W, function () { lastGeom = ''; reportGeom(); }, 450);
    return !!b;
  }
  // 위로 밀기로 엶 (유튜브 앱: 전체화면에서 위로 밀면 추천 영상 줄이 올라옴. 모바일 웹은 밀기로는 안 열려 버튼을 대신 누름)
  function fsPanelOpen() {
    var b = document.querySelector('player-fullscreen-controls button[aria-label="동영상 더보기"], player-fullscreen-controls button[aria-label="More videos"]');
    if (!b) return false;
    b.click();
    G.setTimeout.call(W, function () { lastGeom = ''; reportGeom(); }, 450);
    return true;
  }
  function ytFsUi(on) {
    if (on ? (YTFS || !onWatch()) : !YTFS) return;
    YTFS = on;
    var p = mainPlayer();
    try { if (p && typeof p.setFauxFullscreen === 'function' && !fullscreenEl()) p.setFauxFullscreen(on); } catch (e) { /* ignore */ }
    if (!document.body) return;
    if (on) document.body.setAttribute('faux-fullscreen', 'true');
    else if (!fullscreenEl()) document.body.removeAttribute('faux-fullscreen');
  }
  // 다음 영상으로 넘어가며 유튜브가 상태를 되돌렸으면 다시 (아래 '전체화면 제목 줄' 확인 때 함께 부름)
  function ytFsKeep() {
    if (!YTFS || !appFull() || fullscreenEl() || !document.body) return;
    // 유튜브가 되돌렸을 때(속성이 사라짐)만 다시: 매번 setFauxFullscreen 을 부르면 조작부가 다시 계산될 수 있음 (검토 반영)
    if (document.body.getAttribute('faux-fullscreen') === 'true') return;
    document.body.setAttribute('faux-fullscreen', 'true');
    var p = mainPlayer();
    try { if (p && typeof p.setFauxFullscreen === 'function') p.setFauxFullscreen(true); } catch (e) { /* ignore */ }
  }
  document.addEventListener('click', function (e) {
    if (!YTFS || !appFull()) return;
    var t = e.target, btn = null;
    try { btn = t && t.closest ? t.closest(A.fullscreenButtons.join(',')) : null; } catch (err) { btn = null; }
    if (!btn) return;
    e.preventDefault(); e.stopImmediatePropagation();
    leaveFull('유튜브 전체 화면 종료 버튼');
  }, true);
  function setAppFull(on) {
    if (on === appFull()) return;
    document.documentElement.classList.toggle('glide-full', on);
    if (!on) { document.documentElement.classList.remove('glide-zoom'); CENTER = false; } // 페이지가 스스로 끈 경우에도 (다음 위로 밀기 전체화면이 곧바로 풀렸음 — 전수조사 반영)
    ytFsUi(on);
    reportFull();
    // 플레이어가 새 크기에 맞춰 영상·자막 크기를 다시 계산하게
    resized();
    G.setTimeout.call(W, resized, 350);
  }
  // 전체화면으로: 유튜브 전체화면 버튼(사용자 손동작 안에서 눌러야 브라우저가 허용) → 열리지 않으면 앱 대체 전체화면
  // 손동작 전체화면은 앱이 직접 (html.glide-full + 앱의 시스템 바 숨김·방향 처리).
  // 1.5.2~1.5.4는 유튜브 전체화면 버튼을 대신 누르려고 영상을 먼저 눌렀는데, 상황에 따라 재생/일시정지가 토글되고
  // (손동작 때 영상이 멈춤) 버튼 클릭도 자주 실패했음 (폴드5 실기). 유튜브 전체화면 버튼을 사용자가 직접 누르면 그대로 유튜브 것을 씀
  function goFull(why) {
    if (inFull() || !onWatch()) return;
    if (!A.appFullscreen) { log('warn', why + ' → 앱 전체화면이 꺼져 있음'); return; }
    setAppFull(true);
    log('info', why + ' → 앱 전체화면');
  }
  // 앱 '가운데 영상'의 세로 전체화면 배치(1.8.9, 앱이 full {on, center}로 켬)면 앱이 화면을 움직여 나가게 맡김 (⌄·유튜브 종료 버튼)
  var CENTER = false;
  function leaveFull(why) {
    if (!inFull()) return;
    if (CENTER && appFull()) { G.send('centerExit', { why: why }); log('info', why + ' → 가운데 영상 나가기 (앱이 움직임)'); return; }
    if (appFull()) setAppFull(false);
    else if (fullscreenEl()) { var p = document.exitFullscreen ? document.exitFullscreen() : null; if (p && p.catch) p.catch(function () {}); }
    else if (fauxFull()) { var b = ytFullButton(); if (b) b.click(); else document.body.removeAttribute('faux-fullscreen'); }
    log('info', why + ' → 전체화면 해제');
  }
  // 전체화면 제목 줄 (1.8.9, 사용자: "유튜브 앱은 전체화면에서 한 번 탭하면 제목 같은 게 자연스럽게 보이는데 여기는 일시정지·영상 길이만").
  // 유튜브 앱(같은 폰 캡처): 왼쪽 위 ⌄(전체화면 나가기) · 제목(굵게) · 그 아래 채널 이름(회색). 모바일 웹은 유튜브 자체 전체화면에서도
  // 위 조작부의 제목 칸(.ytwPlayerTopControlsTitleWrapper)을 비워 둠 → 그 칸에 Glide 줄을 넣어 조작부와 함께 나타나고 사라지게
  // (조작부 안이라 보임·숨김을 따로 맞출 필요 없음. 유튜브가 칸을 다시 만들면 다음 확인 때 다시 넣음). 광고 중에는 숨김
  //  제목 칸(.ytwPlayerTopControlsTitleWrapper)은 '유료 프로모션 포함' 표시가 있는 영상에만 있음(실기·실제 사이트 확인) → 없으면
  //  조작부 안(.player-controls-content) 왼쪽 위에 겹쳐 둠(오른쪽 버튼 자리 176px 비움). 유튜브 버튼 칸(.player-controls-top)에는 넣지 않음(배치가 깨짐)
  function fsTitle() {
    var ov = onWatch() && inFull() ? document.getElementById('player-control-overlay') : null;
    var tw = ov ? ov.querySelector('.ytwPlayerTopControlsTitleWrapper') : null;
    var slot = tw || (ov ? ov.querySelector('.player-controls-content') : null);
    var row = document.getElementById('glide-fstitle');
    if (!slot) { if (row) row.hidden = true; return; }
    var p = mainPlayer(), d = null;
    try { d = p && p.getVideoData ? p.getVideoData() : null; } catch (e) { /* ignore */ }
    var ad = !!(p && p.classList && p.classList.contains('ad-showing'));
    var title = (d && d.title) || '', author = (d && d.author) || '';
    if (!row || row.parentNode !== slot) {
      if (row) row.remove();
      var down = G.el('button', { type: 'button', 'class': 'gf-down', 'aria-label': '전체화면 나가기' });
      down.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); leaveFull('전체화면 제목 줄 ⌄'); });
      row = G.el('div', { id: 'glide-fstitle' }, [down, G.el('div', { 'class': 'gf-t' }, [G.el('b'), G.el('span')])]);
      slot.appendChild(row);
    }
    row.classList.toggle('gf-abs', !tw);
    var tb = row.querySelector('b'), ts = row.querySelector('span');
    if (tb.textContent !== title) tb.textContent = title;
    if (ts.textContent !== author) ts.textContent = author;
    row.hidden = !title || ad;
  }
  ['fullscreenchange', 'glide:fullstate', 'yt-navigate-finish'].forEach(function (n) { (n === 'fullscreenchange' ? document : W).addEventListener(n, function () { try { fsTitle(); } catch (e) { /* ignore */ } }); });
  (function fsLoop() { // 다음 영상으로 넘어가 제목이 바뀌거나 유튜브가 조작부를 다시 만든 경우
    var t = 2000;
    try { fsTitle(); ytFsKeep(); if (inFull()) { t = 800; watchControls(); } } catch (e) { /* <html> 생기기 전(문서 시작)이면 다음에 */ }
    G.setTimeout.call(W, fsLoop, t);
  })();
  // 앱 → 페이지
  G.onCommand('full', function (arg) {
    if (arg && arg.on) {
      CENTER = !!arg.center;
      if (!inFull()) setAppFull(true);
      else if (CENTER) { reportedFull = false; reportFull(); } // 이미 전체화면이어도 가운데 영상 요청에는 답함 (안 하면 앱이 기다리다 시간 초과)
    }
    else if (arg && arg.only === 'glide') { CENTER = false; setAppFull(false); } // 유튜브 전체화면으로 바뀜: 앱 대체 전체화면만 끔
    else { CENTER = false; leaveFull('앱 요청'); }
  });
  // 폰을 가로로 돌림 (1.5.1 이하 앱만 보냄. 1.5.2부터는 앱이 회전 때 바로 앱 전체화면을 켬). 원격 스크립트 호환용으로 남김
  G.onCommand('rotated', function (arg) {
    if (!arg || !arg.landscape) return;
    G.setTimeout.call(W, function () {
      if (inFull() || !onWatch() || innerWidth <= innerHeight) return;
      setAppFull(true);
      log('info', '가로로 돌림 → 앱 전체화면');
    }, 700);
  });

  // 영상 화면을 벗어나면 앱 대체 전체화면을 풂 (앱이 모르는 사이에 켜진 경우 대비)
  function leftWatch() { if (appFull() && !onWatch()) setAppFull(false); }
  W.addEventListener('yt-navigate-finish', leftWatch, true);
  W.addEventListener('popstate', leftWatch, true);

  function setZoom(on) {
    document.documentElement.classList.toggle('glide-zoom', on);
    hint(on ? '화면에 맞게 확대' : '원래 크기', 900);
  }

  // 누르는 동안 2배속: 원래 배속은 손을 떼면 그대로 돌려놓고, 코어·편의 기능이 이 변화를 사용자 배속으로 기억하지 않게 표시
  var hold = { timer: 0, active: false, prev: 1, video: null };
  function holdStart(v) {
    if (!v || v.paused || G.inAd()) return;
    hold.active = true;
    hold.video = v;
    hold.prev = v.playbackRate;
    if (hold.prev >= A.holdRate) { hold.active = false; return; } // 이미 빠르면 그대로 (유튜브가 직접 처리한 경우 포함)
    document.documentElement.dataset.glideHold = '1';
    v.playbackRate = A.holdRate;
    // 표시는 모바일 유튜브 자체의 '2배 ▶▶'만 (Glide 표시까지 띄우면 두 개가 겹쳐 보였음, 유튜브 앱과 비교)
  }
  function holdEnd() {
    if (hold.timer) { G.clearTimeout.call(W, hold.timer); hold.timer = 0; }
    if (!hold.active) return;
    hold.active = false;
    var v = hold.video, prev = hold.prev;
    if (v && v.playbackRate === A.holdRate) v.playbackRate = prev;
    // 모바일 유튜브 자체의 '길게 눌러 2배속'과 겹쳐 2배속이 남으면 한 번 더 되돌림
    G.setTimeout.call(W, function () { if (!hold.active && v && v.playbackRate === A.holdRate && prev !== A.holdRate) { v.playbackRate = prev; log('info', '손동작: 남은 2배속을 ' + prev + 'x로 되돌림'); } }, 700);
    // 배속 변화 이벤트가 처리된 뒤에 표시를 지움
    G.setTimeout.call(W, function () { delete document.documentElement.dataset.glideHold; }, 300);
    hideHint();
  }

  var T = null; // 진행 중인 터치
  function onPlayer(target) {
    if (!target) return false;
    var fs = fullscreenEl();
    if (fs) return fs.contains(target); // 전체화면에서는 화면 전체가 플레이어
    var a = playerArea();
    if (fauxFull() || appFull()) return !!(a && a.contains(target));
    return !!(a && a.contains(target) && a.getBoundingClientRect().height > 40);
  }
  function isControl(target) {
    // 진행 막대·메뉴 같은 조작부 위에서는 유튜브 동작을 우선
    return !!(target && target.closest && target.closest('.ytp-progress-bar-container, .ytProgressBarLineHost, ytm-progress-bar, .ytm-progress-bar, .watch-page-progress-bar, .player-controls-bottom, .ytp-settings-menu, .ytp-popup, [role="slider"], .player-settings-icon, .ytp-chrome-bottom input, bottom-sheet-container, [data-glide]'));
  }
  // 버튼 위에서 길게 누르면 유튜브 버튼 동작이 우선 (밀기는 방향으로 구분되므로 허용)
  function isButton(target) { return !!(target && target.closest && target.closest('button, a, [role="button"], input')); }
  // 진행 막대는 플레이어 아래쪽 띠에 있음. 클래스 이름이 바뀌어도 막대 위에서는 2배속이 끼어들지 않게 위치로도 판단
  function nearScrubber(t) {
    var p = fullscreenEl() || (inFull() ? null : playerArea());
    var bottom = p ? p.getBoundingClientRect().bottom : innerHeight;
    return t.clientY > bottom - (inFull() ? 72 : 40);
  }

  // ---------------------------------------------------------------------------
  // 영상 아래쪽 띠를 좌우로 밀어 탐색 (2026-11-21, 사용자: 유튜브 앱은 영상 아래 끝에서 좌우로 밀면 위치가 자연스럽게 넘어감).
  // 세로 화면(전체화면 아님)에서 플레이어 아래 48px 안에서 시작한 가로 밀기 → 손가락을 따라 시간 표시·막대가 움직이고, 손을 떼면 그 위치로.
  // 플레이어 폭 전체 = 영상 길이 전체 (상대 이동). 조작부가 숨어 있어도 됨. 광고 중·전체화면은 제외(전체화면은 유튜브 진행 막대)
  // ---------------------------------------------------------------------------
  var SB = null, sbEl = null;
  function sbFmt(t) { t = Math.max(0, Math.floor(t)); var h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, x = t % 60; return (h ? h + ':' + (m < 10 ? '0' : '') + m : m) + ':' + (x < 10 ? '0' : '') + x; }
  function sbShow(r, t, d) {
    if (!sbEl) {
      sbEl = G.el('div', { id: 'glide-scrub', 'data-glide': 'scrub', style: 'position:fixed;z-index:2147483647;pointer-events:none' }, [
        G.el('div', { style: 'position:absolute;left:50%;bottom:16px;transform:translateX(-50%);padding:6px 14px;border-radius:16px;background:rgba(0,0,0,.72);color:#fff;font:600 15px/1.2 Roboto,"Noto Sans KR",sans-serif;white-space:nowrap' }),
        G.el('div', { style: 'position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.35)' }, [G.el('div', { style: 'height:100%;background:#f03;width:0' })])
      ]);
    }
    if (sbEl.parentNode !== document.body) document.body.appendChild(sbEl);
    sbEl.style.left = r.left + 'px'; sbEl.style.width = r.width + 'px'; sbEl.style.top = (r.bottom - 80) + 'px'; sbEl.style.height = '80px';
    sbEl.firstChild.textContent = sbFmt(t) + ' / ' + sbFmt(d);
    sbEl.lastChild.firstChild.style.width = (d > 0 ? Math.min(100, t / d * 100) : 0) + '%';
    sbEl.hidden = false;
  }
  document.addEventListener('touchstart', function (e) {
    SB = null;
    if (!S().enabled || !onWatch() || inFull() || LK.on || e.touches.length !== 1 || (S().role && role() !== 'player')) return;
    var area = playerArea(), t = e.touches[0];
    if (!area || !area.contains(e.target)) return;
    var r = area.getBoundingClientRect();
    if (r.height < 80 || t.clientY < r.bottom - 48 || t.clientY > r.bottom + 4) return;
    var v = (mainPlayer() || document).querySelector('video');
    if (!v || !isFinite(v.duration) || v.duration <= 0 || document.querySelector('#movie_player.ad-showing')) return;
    SB = { x: t.clientX, y: t.clientY, t0: v.currentTime, d: v.duration, v: v, r: r, on: false, to: v.currentTime, ts: Date.now(), rate: v.playbackRate };
  }, { capture: true, passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!SB) return;
    var t = e.touches[0], dx = t.clientX - SB.x, dy = t.clientY - SB.y;
    if (!SB.on) {
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) { SB = null; return; } // 세로 밀기는 원래 손동작(작게·전체화면)
      if (Math.abs(dx) < 12) return;
      if (Date.now() - SB.ts > 450 || SB.v.playbackRate !== SB.rate) { SB = null; return; } // 길게 눌러 2배속 중 (유튜브 몫)
      SB.on = true; T = null; holdEnd(); G.send('haptic', { kind: 'gesture' });
    }
    // 움직임은 유튜브에도 넘김: 안 넘기면 유튜브가 '꾹 누르는 중'으로 보고 길게 눌러 2배속을 켰음(실기)
    if (e.cancelable) e.preventDefault();
    SB.to = Math.max(0, Math.min(SB.d - 0.5, SB.t0 + dx / SB.r.width * SB.d));
    sbShow(SB.r, SB.to, SB.d);
  }, { capture: true, passive: false });
  document.addEventListener('touchend', function (e) {
    var sb = SB; SB = null;
    if (!sb || !sb.on) return;
    // 손 뗌도 유튜브에 넘김 (길게 눌러 2배속이 켜졌다면 유튜브가 스스로 풀게)
    try { sb.v.currentTime = sb.to; } catch (x) { /* ignore */ }
    if (sbEl) G.setTimeout.call(W, function () { if (!SB && sbEl) sbEl.hidden = true; }, 350);
    // 손을 뗄 때 생기는 클릭이 조작부를 켜고 끄지 않게
    var until = Date.now() + 400;
    var h = function (ev) { document.removeEventListener('click', h, true); if (Date.now() < until) { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); } };
    document.addEventListener('click', h, true);
    G.setTimeout.call(W, function () { document.removeEventListener('click', h, true); }, 400);
    log('info', '영상 아래 밀어 탐색: ' + sbFmt(sb.t0) + ' → ' + sbFmt(sb.to));
  }, { capture: true, passive: false });
  document.addEventListener('touchcancel', function () { SB = null; if (sbEl) sbEl.hidden = true; }, { capture: true, passive: true });

  // ---------------------------------------------------------------------------
  // 두 번 탭 10초 이동 (유튜브 앱처럼 멈추지 않고).
  // 모바일 유튜브 웹은 두 번 탭 때 '일시정지 → 이동 → 0.6초 뒤 재생'을 해서 매번 끊겼음(실기, 받아 둔 구간 안이라 데이터 문제 아님).
  // 두 번째 탭부터는 Glide가 가로채서(유튜브는 첫 탭만 봄 = 조작부 표시) 재생을 멈추지 않고 currentTime만 옮김.
  // 이어서 같은 쪽을 탭하면 계속 누적(유튜브 앱과 같음). 포인터 이벤트가 터치 이벤트보다 먼저 오므로 pointerdown에서 판단
  // ---------------------------------------------------------------------------
  var DT = { lastUp: 0, lastX: 0, lastSide: 0, downX: 0, downY: 0, moved: false, series: 0, side: 0, total: 0, gesture: false, el: null, hideTimer: 0 };
  function dtBox() { var fs = fullscreenEl(); return (fs || playerArea() || document.documentElement).getBoundingClientRect(); }
  function dtSide(x) {
    var r = dtBox();
    var rel = (x - r.left) / (r.width || 1);
    return rel < 0.4 ? -1 : rel > 0.6 ? 1 : 0;
  }
  function dtTarget(e) {
    if (!A.enabled || !A.doubleTapSeek || !S().enabled || !onYT() || LK.on || G.inAd()) return false;
    if (e.pointerType && e.pointerType !== 'touch') return false;
    if (!(onWatch() || inFull()) || !onPlayer(e.target) || isControl(e.target)) return false;
    var p = mainPlayer();
    return !!(p && !p.classList.contains('ad-showing'));
  }
  function dtBlock(e) { e.stopImmediatePropagation(); e.stopPropagation(); if (e.cancelable && e.type !== 'touchstart' && e.type !== 'touchmove') e.preventDefault(); }
  function dtShow(side, secs) {
    if (!DT.el) DT.el = G.el('div', { id: 'glide-dt' }, [G.el('i'), G.el('b')]);
    var parent = fullscreenEl() || document.body || document.documentElement;
    if (DT.el.parentNode !== parent) parent.appendChild(DT.el);
    var r = dtBox();
    DT.el.style.top = r.top + 'px';
    DT.el.style.height = r.height + 'px';
    DT.el.style.left = r.left + 'px';
    DT.el.style.width = r.width + 'px';
    DT.el.className = side < 0 ? 'l' : 'r';
    DT.el.firstChild.textContent = side < 0 ? '‹' : '›';
    DT.el.lastChild.textContent = (side < 0 ? '-' : '+') + secs;
    DT.el.hidden = false;
    if (DT.hideTimer) G.clearTimeout.call(W, DT.hideTimer);
    DT.hideTimer = G.setTimeout.call(W, function () { DT.el.hidden = true; DT.total = 0; }, 650);
  }
  function dtSeek(side) {
    var p = mainPlayer(), v = p && p.querySelector('video');
    if (!v || !isFinite(v.currentTime)) return;
    if (DT.side !== side || !DT.total) DT.total = 0;
    DT.side = side;
    DT.total += A.doubleTapSec;
    var end = isFinite(v.duration) && v.duration > 0 ? v.duration - 0.3 : Infinity;
    v.currentTime = Math.max(0, Math.min(end, v.currentTime + side * A.doubleTapSec));
    dtShow(side, DT.total);
    // 유튜브 앱은 두 번 탭 때 조작 버튼을 안 띄움. 모바일 웹은 첫 탭에 조작 버튼을, Glide가 영상을 옮기면 로딩 표시와 함께 또 띄움
    // → 연속 탭 동안은 화면에서만 감추고(glide-dt-on), 끝나면 유튜브가 직접 닫게 함
    document.documentElement.classList.add('glide-dt-on');
    if (DT.ctlTimer) G.clearTimeout.call(W, DT.ctlTimer);
    DT.ctlTimer = G.setTimeout.call(W, dtEndControls, 800);
  }
  // 연속 탭이 끝나면(마지막 탭 0.8초 뒤) 조작 버튼이 떠 있으면 조작부 배경을 한 번 눌러 유튜브가 닫게 함 (재생 상태는 그대로, 실기 확인).
  // 주의(실기 2026-11-20): 탭 직후(유튜브의 두 번 탭 판단 시간 안)에 스크립트로 누르면 유튜브가 이어진 탭으로 보고
  // 좌표 0(왼쪽)이라 10초씩 되감았음 → 충분히 지난 뒤 한 번만, 가운데 좌표로
  // 연속 탭이 아닌 손가락: 감춘 조작부(opacity 0)를 바로 보이게 (안 보이는 재생·설정 버튼이 눌려 영상이 몰래 멈췄음 — 전수조사 반영)
  function dtUnhide() {
    if (!document.documentElement.classList.contains('glide-dt-on')) return;
    if (DT.ctlTimer) { G.clearTimeout.call(W, DT.ctlTimer); DT.ctlTimer = 0; }
    document.documentElement.classList.remove('glide-dt-on');
  }
  function dtEndControls() {
    DT.ctlTimer = 0;
    var o = document.getElementById('player-control-overlay');
    if (o && o.classList.contains('fadein')) {
      var b = o.querySelector('.player-controls-background') || o, r = b.getBoundingClientRect();
      try { b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: W, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); } catch (e) { /* ignore */ }
    }
    G.setTimeout.call(W, function () { if (!DT.ctlTimer) document.documentElement.classList.remove('glide-dt-on'); }, 60);
  }
  W.addEventListener('pointerdown', function (e) {
    DT.gesture = false;
    if (!e.isPrimary || !dtTarget(e)) { DT.series = 0; return; }
    var now = Date.now(), side = dtSide(e.clientX);
    DT.downX = e.clientX; DT.downY = e.clientY; DT.moved = false;
    if (!side) { DT.series = 0; dtUnhide(); return; }
    var inSeries = DT.series && now - DT.series < 700 && side === DT.side;
    var isDouble = now - DT.lastUp < 320 && side === DT.lastSide && Math.abs(e.clientX - DT.lastX) < 90;
    if (!inSeries && !isDouble) { dtUnhide(); return; }
    DT.gesture = true;
    DT.series = now;
    holdEnd();
    dtBlock(e);
    dtSeek(side);
  }, { capture: true, passive: false });
  W.addEventListener('pointermove', function (e) {
    if (Math.abs(e.clientX - DT.downX) > 12 || Math.abs(e.clientY - DT.downY) > 12) DT.moved = true;
    if (DT.gesture) dtBlock(e);
  }, { capture: true, passive: false });
  W.addEventListener('pointerup', function (e) {
    if (DT.gesture) { DT.series = Date.now(); dtBlock(e); return; }
    if (!DT.moved && e.isPrimary) { DT.lastUp = Date.now(); DT.lastX = e.clientX; DT.lastSide = dtSide(e.clientX); }
  }, { capture: true, passive: false });
  // 두 번째 탭의 나머지 이벤트(터치·마우스 호환·클릭)도 유튜브에 가지 않게. 클릭은 손을 뗀 뒤 오므로 잠깐 더 막음
  // 사람이 낸 이벤트(isTrusted)만 막음: 코어의 건너뛰기 버튼 click() 같은 스크립트 클릭은 그대로
  function dtGuard(type) {
    return function (e) {
      if (!e.isTrusted) return;
      if (DT.gesture) { dtBlock(e); if (type === 'touchend' || type === 'touchcancel' || type === 'pointercancel') DT.gesture = false; return; }
      if ((type === 'click' || type === 'dblclick' || type === 'mouseup' || type === 'mousedown') && DT.series && Date.now() - DT.series < 350) dtBlock(e);
    };
  }
  // touchstart·touchmove는 passive (막을 수 없는 처리기여야 브라우저가 스크롤을 기다리지 않음. 전파 막기는 그대로 됨)
  ['touchstart', 'touchmove'].forEach(function (type) { W.addEventListener(type, dtGuard(type), { capture: true, passive: true }); });
  ['touchend', 'touchcancel', 'pointercancel', 'mousedown', 'mouseup', 'click', 'dblclick'].forEach(function (type) { W.addEventListener(type, dtGuard(type), { capture: true, passive: false }); });

  document.addEventListener('touchstart', function (e) {
    if (!A.enabled || !S().enabled || !onYT() || LK.on) { if (LK.on) { T = null; holdEnd(); } return; }
    attachMove();
    if (e.touches.length === 2 && inFull()) {
      // 두 번째 손가락이 닿음 (두 손가락이 동시에 닿은 경우 포함)
      if (!T) T = { x: 0, y: 0, t: Date.now(), onPlayer: onPlayer(e.target), moved: true, dir: null };
      if (!T.onPlayer) return;
      T.pinch = dist(e.touches[0], e.touches[1]);
      T.pinchNow = T.pinch;
      T.multi = true;
      holdEnd();
      return;
    }
    if (e.touches.length !== 1) { T = null; holdEnd(); return; }
    var t = e.touches[0];
    // 전체화면 맨 위 가장자리에서 내리는 건 알림창을 여는 시스템 동작 (28px은 좁아 상태 표시줄을 내리려다 전체화면이 풀렸음 — 사용자 제보로 56px)
    var edge = inFull() && (t.clientY < A.edgeTopPx || t.clientY > innerHeight - A.edgeBottomPx);
    var on = !edge && onPlayer(e.target) && !isControl(e.target) && (onWatch() || inFull());
    T = { x: t.clientX, y: t.clientY, t: Date.now(), onPlayer: on, moved: false, dir: null, multi: false, pinch: 0, pinchNow: 0 };
    // 전체화면에 창(동영상 더보기·설정·화질·메뉴)이 떠 있으면 아래로 밀기는 그 창 몫: 유튜브 앱은 창만 내려가는데 Glide는 전체화면을 꺼 버렸음 (사용자 제보)
    if (inFull()) {
      T.panel = !!fsPanel(); T.sheet = T.panel || anySheet();
      // 위로 밀기 → 동영상 더보기: 가로 전체화면은 유튜브 아래 조작부 칸(.player-controls-bottom)이 화면 아래 절반을 덮어 onPlayer 가 아니어도 받음 (진행 막대·가장자리·열린 창만 제외)
      // 진행 막대 위에서 시작해도 세로로 분명히 민 것이면 연다(fsBar: 손을 뗄 때 가로 이동이 거의 없어야 함). 조작부가 떠 있으면 막대의 터치 범위가
      // 아래 칸까지 넓어서, 예전처럼 막대 시작을 빼면 창을 닫은 뒤의 위로 밀기가 자주 무시됐음 (폴드2 실기, 2026-11-25)
      T.fsUp = !edge && !T.sheet;
      T.fsBar = !!(e.target && e.target.closest && e.target.closest('[role="slider"], .ytProgressBarLineHost, ytm-progress-bar, .ytm-progress-bar, .ytp-progress-bar-container, .watch-page-progress-bar'));
    }
    if (on && !nearScrubber(t) && !isButton(e.target)) {
      var v = (mainPlayer() || document).querySelector('video');
      hold.timer = G.setTimeout.call(W, function () { hold.timer = 0; if (T && !T.moved && !T.multi) holdStart(v); }, A.holdMs);
    }
  }, { capture: true, passive: true });

  // ---------------------------------------------------------------------------
  // 길게 눌러 메뉴 (유튜브 앱처럼): 영상 목록 항목을 길게 누르면 그 항목의 ⋮(추가 작업) 메뉴를 엶 + 짧은 진동.
  // 메뉴 자체는 유튜브 것(나중에 볼 동영상·재생목록·공유·관심 없음 …). 길게 누른 뒤 손을 떼도 영상이 열리지 않게 그 클릭은 막음.
  // 영상 화면의 플레이어 위 길게 누르기는 2배속 손동작이 씀
  // ---------------------------------------------------------------------------
  var LPS = null; // 이름 주의: 아래 '반복 재생'이 LP를 씀 (1.5.3에서 겹쳐 반복이 망가졌었음)
  function lpClear() { if (LPS && LPS.timer) clearTimeout(LPS.timer); LPS = null; }
  function itemMenuButton(item) {
    for (var i = 0; i < A.itemMenuButtons.length; i++) {
      var b = null;
      try { b = item.querySelector(A.itemMenuButtons[i]); } catch (e) { continue; }
      if (b) return b;
    }
    return null;
  }
  var swallowUntil = 0; // 길게 누른 뒤 손을 뗄 때의 클릭: 웹뷰 2개 연결(영상 열기)도 이 클릭은 건드리지 않음
  function swallowNextClick() {
    var until = Date.now() + 900;
    swallowUntil = until;
    var h = function (e) {
      document.removeEventListener('click', h, true);
      if (Date.now() < until) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }
    };
    document.addEventListener('click', h, true);
    G.setTimeout.call(W, function () { document.removeEventListener('click', h, true); }, 900);
  }
  document.addEventListener('touchstart', function (e) {
    lpClear();
    if (!S().enabled || !onYT() || e.touches.length !== 1 || inFull() || LK.on) return;
    var tg = e.target, item = null;
    try { item = tg && tg.closest ? tg.closest(A.longPressItems.join(',')) : null; } catch (x) { return; }
    if (!item || (onWatch() && onPlayer(tg))) return;
    var t = e.touches[0];
    LPS = { item: item, x: t.clientX, y: t.clientY };
    LPS.timer = G.setTimeout.call(W, function () {
      var it = LPS && LPS.item;
      LPS.timer = 0;
      var b = it && it.isConnected ? itemMenuButton(it) : null;
      if (!b) return;
      LPS.fired = true;
      G.send('haptic', { kind: 'long' });
      b.click();
      swallowNextClick(); // 메뉴 버튼 클릭 다음, 손을 뗄 때 생기는 항목 클릭만 막음
      log('info', '길게 눌러 영상 메뉴 열기');
    }, A.longPressMs);
  }, { capture: true, passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!LPS || !LPS.timer) return;
    var t = e.touches[0];
    if (t && (Math.abs(t.clientX - LPS.x) > 10 || Math.abs(t.clientY - LPS.y) > 10)) lpClear();
  }, { capture: true, passive: true });
  document.addEventListener('touchend', function () { if (LPS && LPS.timer) lpClear(); }, { capture: true, passive: true });
  document.addEventListener('touchcancel', lpClear, { capture: true, passive: true });
  // 길게 누르면 웹뷰가 띄우는 링크·이미지 메뉴(웹 느낌)를 막음
  // 입력칸(검색·댓글·추천 주제 검색)은 그대로: 막으면 붙여넣기·글자 선택이 안 됨 (전수조사 반영)
  document.addEventListener('contextmenu', function (e) { var t = e.target; if (t && t.closest && t.closest('input, textarea, [contenteditable=""], [contenteditable="true"]')) return; if (S().enabled && onYT()) e.preventDefault(); }, true);

  // ---------------------------------------------------------------- 누른 순간 반응 (2026-11-20 사용자: "유튜브 앱은 누르면 바로 반응하는데 Glide는 둔탁")
  // 안드로이드 앱(유튜브 앱)처럼: 손가락이 닿고 90ms 동안 거의 안 움직이면 그 항목 위에 옅은 누름 표시, 움직이면(스크롤) 바로 지움, 아주 빠른 탭은 뗄 때 잠깐 보임.
  // 1.8.8에서 유튜브 웹의 누름 막(손 뗄 때·스크롤 뒤에도 깜빡임)을 숨긴 뒤로 누름 표시가 아예 없어 눌렀는지 모르는 둔한 느낌이었음.
  // 유튜브 요소에는 class·position 을 붙이지 않고(목록 항목은 position static → 배치가 흔들릴 수 있음) 문서 위 고정 칸 하나를 항목 자리에 띄움
  var PRESS_SEL = 'yt-lockup-view-model, ytm-video-with-context-renderer, ytm-compact-video-renderer, ytm-compact-playlist-renderer, ytm-playlist-renderer, ytm-compact-channel-renderer, .gr-card';
  var PR = { el: null, item: null, timer: 0, hideTimer: 0, x: 0, y: 0, shown: false };
  function prDark() {
    if (typeof lastTheme === 'boolean') return lastTheme;
    var m = document.body && /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(document.body).color);
    return !!m && (+m[1] + +m[2] + +m[3]) / 3 > 128;
  }
  function prShow() {
    PR.timer = 0;
    var it = PR.item;
    if (!it || !it.isConnected) return;
    var r = it.getBoundingClientRect();
    if (r.width < 40 || r.height < 30) return;
    if (!PR.el || !PR.el.isConnected) { PR.el = G.el('div', { id: 'glide-press' }); (document.body || document.documentElement).appendChild(PR.el); }
    if (PR.hideTimer) { G.clearTimeout.call(W, PR.hideTimer); PR.hideTimer = 0; }
    PR.el.style.left = Math.round(r.left) + 'px'; PR.el.style.top = Math.round(r.top) + 'px';
    PR.el.style.width = Math.round(r.width) + 'px'; PR.el.style.height = Math.round(r.height) + 'px';
    PR.el.className = prDark() ? 'd' : '';
    void PR.el.offsetWidth; // 나타나는 전환이 걸리게
    PR.el.className += ' on';
    PR.shown = true;
  }
  function prHide(delay) {
    if (PR.timer) { G.clearTimeout.call(W, PR.timer); PR.timer = 0; }
    PR.item = null;
    if (!PR.shown) return;
    PR.shown = false;
    var el = PR.el;
    if (PR.hideTimer) G.clearTimeout.call(W, PR.hideTimer);
    PR.hideTimer = G.setTimeout.call(W, function () { PR.hideTimer = 0; if (el) el.className = el.className.replace(' on', ''); }, delay || 0);
  }
  document.addEventListener('touchstart', function (e) {
    prHide(0);
    if (e.touches.length !== 1 || !S().enabled || !onYT()) return;
    var de = document.documentElement;
    if (de.classList.contains('glide-full') || de.classList.contains('glide-pip')) return;
    var t = e.target;
    if (!t || !t.closest) return;
    var it = t.closest(PRESS_SEL);
    // 항목 안 버튼(⋮ 메뉴 등)·입력칸은 그 버튼의 누름 표시를 씀
    if (!it || (t.closest('button, input, textarea, [role="button"], [role="slider"]') && it.contains(t.closest('button, input, textarea, [role="button"], [role="slider"]')))) return;
    PR.item = it; PR.x = e.touches[0].clientX; PR.y = e.touches[0].clientY;
    PR.timer = G.setTimeout.call(W, prShow, 90);
  }, { capture: true, passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!PR.item && !PR.shown) return;
    var t = e.touches[0];
    if (!t || Math.abs(t.clientX - PR.x) > 8 || Math.abs(t.clientY - PR.y) > 8) prHide(0);
  }, { capture: true, passive: true });
  document.addEventListener('touchend', function () {
    if (PR.timer) { G.clearTimeout.call(W, PR.timer); prShow(); prHide(120); return; } // 아주 빠른 탭: 뗄 때 잠깐
    prHide(60);
  }, { capture: true, passive: true });
  document.addEventListener('touchcancel', function () { prHide(0); }, { capture: true, passive: true });
  W.addEventListener('scroll', function () { if (PR.shown || PR.timer) prHide(0); }, { capture: true, passive: true });

  // 스크롤을 막아야 하는 touchmove는 플레이어 상자에만 '막을 수 있는' 처리기로 붙임.
  // 문서 전체에 붙이면 페이지 어디서 스크롤하든 브라우저가 이 처리기를 기다려 스크롤 시작이 느려질 수 있음
  var moveHost = null;
  function attachMove() {
    var a = document.getElementById('player-container-id');
    if (!a || a === moveHost) return;
    if (moveHost) moveHost.removeEventListener('touchmove', onMove, { capture: true });
    a.addEventListener('touchmove', onMove, { capture: true, passive: false });
    moveHost = a;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachMove, { once: true }); else attachMove();
  W.addEventListener('yt-navigate-finish', attachMove, true);
  document.addEventListener('playing', attachMove, true);

  function onMove(e) {
    if (!T || !T.onPlayer) return;
    if (T.multi && e.touches.length === 2) {
      T.pinchNow = dist(e.touches[0], e.touches[1]);
      if (e.cancelable) e.preventDefault(); // 페이지 확대 대신 영상 확대
      return;
    }
    var t = e.touches[0];
    var dx = t.clientX - T.x, dy = t.clientY - T.y;
    var adx = Math.abs(dx), ady = Math.abs(dy);
    if (!T.moved && (adx > 10 || ady > 10)) {
      T.moved = true;
      holdEnd();
      T.dir = ady > adx * 1.4 ? (dy < 0 ? 'up' : 'down') : 'side';
    }
    // 세로 화면에서 위로, 전체화면에서 아래로 미는 동작은 페이지 스크롤 대신 손동작으로.
    // 브라우저는 처음 취소할 수 있는 touchmove 하나로 스크롤 여부를 정하므로, 방향이 확정되기 전이라도 맞는 쪽이면 막음
    var want = T.dir || (ady > adx ? (dy < 0 ? 'up' : dy > 0 ? 'down' : null) : null);
    // 세로 화면 영상 위에서 아래로 = 작게(화면 속 화면) — 유튜브 앱처럼
    // 이미 전체화면으로 바꾼 손동작(T.fired)은 손을 뗄 때까지 계속 막음: 안 막으면 남은 움직임이 페이지를 굴려 다음 탭이 씹혔음(페이지 테스트)
    if (e.cancelable && (T.fired || (want === 'up' && !inFull()) || (want === 'down' && !T.sheet && (inFull() || onWatch())))) e.preventDefault();
    // 위로 밀기 → 전체화면은 손을 떼기 전, 기준 거리를 넘는 순간 (유튜브 앱과 비교: 유튜브는 밀기 시작 약 40ms 뒤 회전,
    // 손을 뗄 때까지 기다리던 Glide는 약 0.3초 늦었음 — 2026-11-20 같은 폰 녹화)
    if (T.dir === 'up' && !T.fired && dy < -A.swipeMinPx && !inFull() && onWatch()) {
      T.fired = true;
      G.send('haptic', { kind: 'gesture' });
      goFull('손동작: 위로 밀기');
    }
  }

  document.addEventListener('touchend', function (e) {
    var cur = T;
    if (e.touches.length === 0) T = null;
    holdEnd();
    if (PD && PD.on) return; // 동영상 더보기 창을 끄는 중: 아래 pdEnd 가 마무리 (예전 0.3초 뒤 닫기·위로 밀기 열기와 겹치지 않게)
    if (cur && cur.fsUp && !cur.multi && e.changedTouches[0] && Date.now() - cur.t < 900 && inFull()) {
      var ut = e.changedTouches[0], udx = ut.clientX - cur.x, udy = ut.clientY - cur.y;
      // 유튜브도 아래 조작부에서 시작한 위로 밀기에는 스스로 창을 엶 → 같이 누르면 두 번 눌려 닫혔음(실제 사이트). 0.3초 뒤에도 안 열렸을 때만 버튼을 누름
      if (udy < -A.swipeMinPx && Math.abs(udy) > Math.abs(udx) * 1.4 && !(cur.fsBar && Math.abs(udx) > 16)) { G.send('haptic', { kind: 'gesture' }); G.setTimeout.call(W, function () { if (!fsPanel()) fsPanelOpen(); else { lastGeom = ''; reportGeom(); } }, 70); log('info', '손동작: 위로 밀기 → 동영상 더보기'); return; } // 0.3초 기다림이 버벅임으로 느껴졌음(사용자) → 유튜브가 같은 touchend 에서 이미 열었는지만 볼 만큼
    }
    // 동영상 더보기 창이 열린 채 추천 줄 바깥(영상·제목 자리)을 가볍게 탭하면 창이 내려감 — 유튜브 앱과 같게 (사용자 요청 2026-11-25).
    // 모바일 웹은 아무 일도 안 했음. 그 탭이 만드는 클릭(조작부 켜기·일시정지)은 막음. 추천 영상·버튼·링크를 누른 것은 그대로
    if (cur && cur.panel && !cur.moved && !cur.multi && Date.now() - cur.t < 450 && inFull() && fsPanel()) {
      var pt = e.target;
      if (!(pt && pt.closest && pt.closest('.ytFullscreenVideoRecommendationsRecommendation, button, a, [role="button"], [role="slider"], #glide-fstitle'))) {
        var pUntil = Date.now() + 400;
        var ph = function (ev) { document.removeEventListener('click', ph, true); if (Date.now() < pUntil) { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); } };
        fsPanelClose(); // 먼저 ✕를 누르고 나서 클릭 막기를 걺 (거꾸로 하면 ✕ 클릭이 막혀 창이 안 닫혔음 — 실기)
        document.addEventListener('click', ph, true);
        if (e.cancelable) e.preventDefault();
        log('info', '손동작: 동영상 더보기 바깥 탭 → 창 닫기');
        return;
      }
    }
    if (!cur || !cur.onPlayer) return;
    if (cur.multi) {
      if (cur.pinch && cur.pinchNow) {
        var r = cur.pinchNow / cur.pinch;
        cur.pinch = 0; // 손가락마다 touchend가 오므로 한 번만 적용
        if (r > A.pinchRatio) setZoom(true);
        else if (r < 1 / A.pinchRatio) setZoom(false);
      }
      return;
    }
    var t = e.changedTouches[0];
    if (cur.fired) {
      // 밀기 도중 전체화면으로 바꾸면 화면 배치가 바뀌어, 손을 뗄 때 브라우저가 클릭을 하나 만들어 조작 버튼을 켰다 껐다 함 (페이지 테스트에서 확인) → 그 클릭만 막음
      var until = Date.now() + 350;
      var h = function (ev) { document.removeEventListener('click', h, true); if (Date.now() < until) { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); } };
      document.addEventListener('click', h, true);
      G.setTimeout.call(W, function () { document.removeEventListener('click', h, true); }, 350);
      return;
    }
    if (!t || Date.now() - cur.t > 900) return;
    var dy = t.clientY - cur.y;
    // 손동작이 인식되면 짧은 진동으로 알림 (앱 느낌)
    if (cur.dir === 'up' && dy < -A.swipeMinPx && !inFull()) { G.send('haptic', { kind: 'gesture' }); goFull('손동작: 위로 밀기'); }
    // 동영상 더보기 창 → 창만 닫음, 다른 창(설정 등) → 그 창이 알아서 (전체화면은 그대로)
    // 유튜브는 창 위(영상 쪽)에서 민 것은 스스로 닫음 → 같이 누르면 다시 열렸음(실제 사이트). 0.3초 뒤에도 열려 있을 때만(창 안에서 민 경우) 닫음
    else if (cur.dir === 'down' && dy > A.swipeMinPx && inFull() && cur.panel) { G.setTimeout.call(W, function () { if (fsPanel()) fsPanelClose(); else { lastGeom = ''; reportGeom(); } }, 300); log('info', '손동작: 아래로 밀기 → 동영상 더보기 창 닫음'); }
    else if (cur.dir === 'down' && dy > A.swipeMinPx && inFull() && !cur.sheet) { G.send('haptic', { kind: 'gesture' }); leaveFull('손동작: 아래로 밀기'); }
    // 웹뷰 2개(1.6+ 앱)에서는 앱이 손가락을 따라 직접 작게 만듦 (페이지는 관여하지 않음)
    else if (cur.dir === 'down' && dy > A.swipeMinPx && onWatch() && !S().role) { G.send('haptic', { kind: 'gesture' }); G.send('minimize', {}); log('info', '손동작: 아래로 밀기 → 작은 화면'); }
  }, { capture: true, passive: true });
  document.addEventListener('touchcancel', function () { T = null; holdEnd(); }, { capture: true, passive: true });

  // ---------------------------------------------------------------------------
  // 전체화면 '동영상 더보기' 창을 손가락으로 끌기 — 유튜브 앱과 같은 움직임·속도 (폴드2에서 두 앱을 녹화해 프레임별로 비교, 2026-11-25)
  //  유튜브 앱: 끄는 동안 추천 줄이 손가락을 그대로 따라감(제목 줄은 제자리), 놓으면 닫기 약 0.22초·열기 약 0.25초 감속, 제목 줄은 닫을 때 흐려지고 열 때 조금 늦게 나타남.
  //  예전 Glide: 끄는 동안 창이 안 움직이다가 손을 떼고 0.3초 뒤 ✕를 눌러 닫았고(멈칫), 열 때는 어두운 배경·제목이 한 번에 툭 나타났음.
  //  창은 유튜브 것 그대로: 위치만 잠깐 inline transform 으로 옮기고, 끝나면 유튜브 ✕·동영상 더보기 버튼으로 실제 상태를 바꾼 뒤 지움
  var PD = null, PD_EASE = 'cubic-bezier(0.2, 0, 0, 1)';
  function pdEls() { return { panel: document.querySelector('.fullscreen-controls'), top: document.querySelector('player-fullscreen-top-controls'), bg: document.querySelector('.player-controls-background') }; }
  function pdStyle(el, tr, prop, val) { if (!el) return; el.style.transition = tr; el.style.setProperty(prop, val, 'important'); }
  function pdClear(els) {
    [els.panel, els.top, els.bg].forEach(function (el) { if (el) { el.style.transition = 'none'; el.style.removeProperty('transform'); el.style.removeProperty('opacity'); } });
    G.setTimeout.call(W, function () { [els.panel, els.top, els.bg].forEach(function (el) { if (el) el.style.removeProperty('transition'); }); lastGeom = ''; reportGeom(); }, 60);
  }
  document.addEventListener('touchstart', function (e) {
    PD = null;
    if (e.touches.length !== 1 || !S().enabled || !inFull() || !onWatch()) return;
    var t = e.touches[0], panel = fsPanel();
    if (t.clientY < A.edgeTopPx) return; // 맨 위 = 알림창
    if (panel) PD = { mode: 'close', x: t.clientX, y: t.clientY, s: [], on: false };
    else if (T && T.fsUp && !(T.y > innerHeight - A.edgeBottomPx)) PD = { mode: 'open', x: t.clientX, y: t.clientY, s: [], on: false, bar: T.fsBar };
  }, { capture: true, passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!PD || e.touches.length !== 1) return;
    var t = e.touches[0], dx = t.clientX - PD.x, dy = t.clientY - PD.y;
    if (!PD.on) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      var vert = Math.abs(dy) > Math.abs(dx) * 1.4 && (PD.mode === 'close' ? dy > 0 : dy < 0);
      if (!vert || (PD.mode === 'open' && dy > -A.swipeMinPx * 0.5)) { if (!vert) PD = null; return; }
      PD.els = pdEls();
      if (!PD.els.panel) { PD = null; return; }
      if (PD.mode === 'open') { if (!fsPanelOpen()) { PD = null; return; } G.send('haptic', { kind: 'gesture' }); }
      PD.on = true; PD.y0 = t.clientY;
      PD.h = PD.els.panel.getBoundingClientRect().height || Math.round(innerHeight * 0.67);
      pdStyle(PD.els.panel, 'none', 'transform', PD.mode === 'open' ? 'translateY(' + PD.h + 'px)' : 'translateY(0px)');
      if (PD.mode === 'open') { pdStyle(PD.els.top, 'none', 'opacity', '0'); pdStyle(PD.els.bg, 'none', 'opacity', '0'); }
    }
    e.stopPropagation(); // 끄는 동안은 유튜브·다른 손동작이 같은 움직임으로 창을 또 열고 닫지 않게
    var now = Date.now();
    PD.s.push({ t: now, y: t.clientY }); while (PD.s.length > 2 && now - PD.s[0].t > 90) PD.s.shift();
    var d = t.clientY - PD.y0;
    if (PD.mode === 'close') PD.els.panel.style.setProperty('transform', 'translateY(' + Math.max(0, d) + 'px)', 'important');
    else {
      var shown = Math.min(PD.h, Math.max(0, -d));
      PD.els.panel.style.setProperty('transform', 'translateY(' + (PD.h - shown) + 'px)', 'important');
      PD.els.bg && PD.els.bg.style.setProperty('opacity', String(shown / PD.h), 'important');
    }
  }, { capture: true, passive: true });
  function pdEnd(e) {
    var p = PD;
    PD = null;
    if (!p || !p.on) return;
    if (e) e.stopPropagation();
    var els = p.els, s = p.s, last = s[s.length - 1] || { t: Date.now(), y: p.y0 }, first = s[0] || last;
    var v = (last.y - first.y) / Math.max(1, last.t - first.t); // px/ms, 아래가 +
    var d = last.y - p.y0;
    // 손을 뗄 때 G.setTimeout 쓴 다른 처리(예전 0.3초 닫기·위로 밀기 열기)가 다시 누르지 않게 T 도 지움
    T = null;
    if (p.mode === 'close') {
      if (d > p.h * 0.3 || v > 0.35) {
        pdStyle(els.panel, 'transform 220ms ' + PD_EASE, 'transform', 'translateY(' + (p.h + 8) + 'px)');
        pdStyle(els.top, 'opacity 200ms linear', 'opacity', '0');
        pdStyle(els.bg, 'opacity 200ms linear', 'opacity', '0');
        G.setTimeout.call(W, function () { if (fsPanel()) fsPanelClose(); G.setTimeout.call(W, function () { pdClear(els); }, 260); }, 220);
        log('info', '손동작: 동영상 더보기 끌어내려 닫음');
      } else {
        pdStyle(els.panel, 'transform 200ms ' + PD_EASE, 'transform', 'translateY(0px)');
        G.setTimeout.call(W, function () { pdClear(els); }, 220);
      }
    } else {
      if (-d > p.h * 0.3 || v < -0.35) {
        pdStyle(els.panel, 'transform 250ms ' + PD_EASE, 'transform', 'translateY(0px)');
        pdStyle(els.bg, 'opacity 200ms linear', 'opacity', '1');
        pdStyle(els.top, 'opacity 180ms linear 120ms', 'opacity', '1');
        G.setTimeout.call(W, function () { if (!fsPanel()) fsPanelOpen(); G.setTimeout.call(W, function () { pdClear(els); }, 60); }, 320);
        log('info', '손동작: 동영상 더보기 끌어올려 엶');
      } else {
        pdStyle(els.panel, 'transform 200ms ' + PD_EASE, 'transform', 'translateY(' + p.h + 'px)');
        pdStyle(els.bg, 'opacity 200ms linear', 'opacity', '0');
        G.setTimeout.call(W, function () { if (fsPanel()) fsPanelClose(); G.setTimeout.call(W, function () { pdClear(els); }, 260); }, 210);
      }
    }
  }
  document.addEventListener('touchend', pdEnd, { capture: true, passive: true });
  document.addEventListener('touchcancel', pdEnd, { capture: true, passive: true });

  function dist(a, b) { var x = a.clientX - b.clientX, y = a.clientY - b.clientY; return Math.sqrt(x * x + y * y); }
  function S() { return G.settings(); }

  // ===========================================================================
  // 공유: 유튜브는 브라우저 공유 기능(navigator.share)이 있으면 그걸 쓰는데 웹뷰엔 없어서 링크 복사 창만 뜸.
  // 앱이 안드로이드 공유 창을 대신 띄움 (유튜브가 시작할 때 확인하므로 문서 시작 시점에 넣어야 함)
  // ===========================================================================
  (function sharePolyfill() {
    try {
      // 이 기능을 아는 앱(1.5.0+)에서만: 예전 앱에 새 스크립트만 원격으로 오면 공유 버튼이 아무 반응 없게 되므로
      if (typeof navigator.share === 'function' || S().nativeShare !== true) return;
      var nativeLike = Function.prototype.bind.call(function share() {}, null);
      var share = G.disguise(function share(data) {
        data = data || {};
        G.send('share', { title: String(data.title || ''), text: String(data.text || ''), url: String(data.url || '') });
        return Promise.resolve();
      }, nativeLike);
      var canShare = G.disguise(function canShare(data) { return !!data && !!(data.url || data.text || data.title); }, Function.prototype.bind.call(function canShare() {}, null));
      try { Object.defineProperty(share, 'name', { value: 'share' }); Object.defineProperty(canShare, 'name', { value: 'canShare' }); } catch (e) { /* ignore */ }
      Object.defineProperty(Navigator.prototype, 'share', { value: share, configurable: true, writable: true });
      if (typeof navigator.canShare !== 'function') Object.defineProperty(Navigator.prototype, 'canShare', { value: canShare, configurable: true, writable: true });
    } catch (e) { /* ignore */ }
  })();

  // ===========================================================================
  // 반복 재생 (지금 영상 하나). 유튜브의 setLoop는 재생목록 반복이라 따로 구현.
  // 끝나기 직전에 처음으로 되돌림 → 'ended'가 안 나서 자동 다음 영상으로 넘어가지 않음.
  // 수면 타이머 '영상 끝나면'이 켜져 있으면 그쪽이 먼저(0.6초 전)에 멈춤
  // ===========================================================================
  var LP = { on: false, vid: null };
  function loopReport() { G.send('loopState', { on: LP.on, videoId: LP.vid }); }
  G.onCommand('loop', function (arg) {
    var p = mainPlayer(), v = p && p.querySelector('video');
    LP.on = !!(arg && arg.on) && onWatch();
    LP.vid = LP.on ? G.currentVideoId(p) : null;
    if (v) v.loop = false; // 유튜브 플레이어와 부딪히지 않게 요소 자체 반복은 쓰지 않음
    log('info', '반복 재생 ' + (LP.on ? '켜짐 [' + LP.vid + ']' : '꺼짐'));
    loopReport();
  });
  document.addEventListener('timeupdate', function (e) {
    if (!LP.on) return;
    var v = e.target, p = mainPlayer();
    if (!p || !p.contains(v) || G.inAd() || v.paused) return;
    if (G.currentVideoId(p) !== LP.vid) { LP.on = false; LP.vid = null; loopReport(); return; } // 다른 영상으로 바뀌면 끔
    // timeupdate는 약 0.25초마다 오므로 빠른 배속에서는 끝 직전 구간을 건너뛸 수 있음 → 배속만큼 넓게
    var near = Math.max(0.35, 0.25 * v.playbackRate + 0.15);
    if (isFinite(v.duration) && v.duration > 1 && v.duration - v.currentTime < near) loopBack(p, v);
  }, true);
  function loopBack(p, v) {
    try { if (typeof p.seekTo === 'function') p.seekTo(0, true); else v.currentTime = 0; } catch (err) { v.currentTime = 0; }
    if (v.paused) v.play().catch(function () {});
  }
  // 그래도 끝까지 가 버리면(끝남) 처음으로 (유튜브의 자동 다음 영상보다 먼저)
  document.addEventListener('ended', function (e) {
    if (!LP.on) return;
    var p = mainPlayer();
    if (p && p.contains(e.target) && G.currentVideoId(p) === LP.vid) loopBack(p, e.target);
  }, true);

  // ===========================================================================
  // 전체화면 화면 잠금 (유튜브 앱처럼): 전체화면에서 조작 버튼이 보일 때 왼쪽에 자물쇠 버튼.
  // 잠그면 화면 터치가 모두 막히고, 화면을 누르면 '잠금 해제' 버튼이 잠깐 보임. 전체화면을 나가면 자동으로 풀림
  // ===========================================================================
  var LK = { on: false, btn: null, shield: null, pill: null, pillTimer: 0, ctlObs: null };
  function lockParent() { return fullscreenEl() || document.body || document.documentElement; }
  function ensureLockEls() {
    if (!LK.btn) {
      LK.btn = G.el('button', { id: 'glide-lock-btn', type: 'button', 'aria-label': '화면 잠금', 'data-glide': 'lock', hidden: '' });
      LK.btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); setLock(true); }, true);
      LK.shield = G.el('div', { id: 'glide-lock-shield', 'data-glide': 'lock', hidden: '' }, [G.el('button', { type: 'button', hidden: '', text: '잠금 해제' })]);
      LK.pill = LK.shield.firstChild;
      var block = function (e) { if (e.target === LK.pill) return; e.preventDefault(); e.stopPropagation(); };
      ['touchstart', 'touchmove', 'touchend', 'click', 'dblclick', 'pointerdown', 'pointerup', 'contextmenu'].forEach(function (t) { LK.shield.addEventListener(t, block, { capture: true, passive: false }); });
      LK.shield.addEventListener('touchend', function (e) { if (e.target !== LK.pill) showPill(); }, true);
      LK.shield.addEventListener('click', function (e) { if (e.target !== LK.pill) showPill(); }, true);
      LK.pill.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); setLock(false); }, true);
    }
    var parent = lockParent();
    if (LK.btn.parentNode !== parent) parent.appendChild(LK.btn);
    if (LK.shield.parentNode !== parent) parent.appendChild(LK.shield);
  }
  function showPill() {
    LK.pill.hidden = false;
    if (LK.pillTimer) G.clearTimeout.call(W, LK.pillTimer);
    LK.pillTimer = G.setTimeout.call(W, function () { LK.pill.hidden = true; }, 2500);
  }
  function setLock(on) {
    if (on === LK.on) return;
    if (on && !inFull()) return;
    ensureLockEls();
    LK.on = on;
    LK.shield.hidden = !on;
    LK.btn.hidden = true;
    if (on) { holdEnd(); T = null; showPill(); hint('화면 잠금', 900); } else { LK.pill.hidden = true; hint('잠금 해제', 700); }
    try { updateBrBtn(); } catch (e) { /* ignore */ }
    log('info', '화면 잠금 ' + (on ? '켜짐' : '꺼짐'));
  }
  // 유튜브 조작 버튼이 보일 때(#player-control-overlay.fadein)만 자물쇠 버튼을 보임
  function controlsShown() { var o = document.getElementById('player-control-overlay'); return !!(o && o.classList.contains('fadein')); }
  function updateLockBtn() {
    if (!inFull() || S().expLock !== true) { if (LK.on) setLock(false); if (LK.btn) LK.btn.hidden = true; return; }
    if (LK.on) return;
    ensureLockEls();
    LK.btn.hidden = !controlsShown();
  }
  function watchControls() {
    var o = document.getElementById('player-control-overlay');
    if (!o || (LK.ctlObs && LK.ctlObs.target === o) || typeof MutationObserver !== 'function') return;
    if (LK.ctlObs) LK.ctlObs.disconnect();
    LK.ctlObs = new MutationObserver(function () { updateLockBtn(); updateBrBtn(); });
    LK.ctlObs.observe(o, { attributes: true, attributeFilter: ['class'] });
    LK.ctlObs.target = o;
  }
  document.addEventListener('fullscreenchange', function () { watchControls(); G.setTimeout.call(W, function () { updateLockBtn(); updateBrBtn(); }, 50); });
  W.addEventListener('glide:fullstate', function () { watchControls(); updateLockBtn(); updateBrBtn(); });

  // ===========================================================================
  // 오프라인 저장: 앱이 이 영상을 '저장 표시(glide_save)'를 붙여 다시 열면, 플레이어가 재생하려고 받는 영상·소리 데이터를
  // 그대로 앱에 넘김(앱이 MP4로 합침). 주소로 직접 받는 방식은 유튜브가 막아(SABR·토큰) 자주 깨지므로 쓰지 않음.
  //  - 소리 없이 빠르게(16배속) 한 번 재생하면서 0초부터 끝까지 빈 곳 없이 모였는지 직접 계산, 빈 곳이 있으면 그리로 돌아가 채움
  //  - 화질이 중간에 바뀌면(시작 정보가 달라짐) 그 트랙을 처음부터 다시 받음 → 한 파일 안에 한 화질만
  //  - 저장 중에는 협찬 건너뛰기·채널 배속·배속 안전장치·화질 자동 맞춤이 꺼짐 (html[data-glide-capture])
  // ===========================================================================
  var CAP = null;
  var sbInfo = new WeakMap(); // SourceBuffer → { kind, pending, held, initHead, ts, trexDur }
  var mcInfo = new WeakMap(); // 음악 저장용: 소리(audio/mp4) SourceBuffer → { pending, held, initHead, ts, trexDur }
  (function capBoot() {
    var q = new URLSearchParams(location.search);
    var token = q.get('glide_save');
    if (!token || !/^[A-Za-z0-9]{6,40}$/.test(token) || location.hostname !== 'm.youtube.com' || location.pathname !== '/watch') return;
    CAP = { token: token, vid: q.get('v'), quality: q.get('glide_q') || 'hd720', attempt: Math.max(1, +(q.get('glide_try') || 1)), rate: 16,
      active: true, done: false, failed: false, acked: false, inits: {}, meta: {}, ranges: { video: [], audio: [] },
      bytes: 0, lastGrowth: Date.now(), started: Date.now(), ui: null, seeking: false, gapSeeks: 0, sentPct: 0 };
    var mark = function () { if (!CAP) return; if (document.documentElement) document.documentElement.dataset.glideCapture = '1'; else G.setTimeout.call(W, mark, 0); };
    mark();
    log('info', '오프라인 저장 시작 [' + CAP.vid + '] 화질 ' + CAP.quality + (CAP.attempt > 1 ? ' (' + CAP.attempt + '번째 시도)' : ''));
    G.send('cap:start', { token: token, vid: CAP.vid, attempt: CAP.attempt });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', capUi, { once: true }); else capUi();
    G.setTimeout.call(W, capWatchdog, 5000);
    // 앱이 이 저장을 모르면(예전 주소를 다시 연 경우 등) 저장 모드를 풀고 보통 재생으로
    G.setTimeout.call(W, function () { if (CAP && !CAP.acked && !CAP.done) { G.send('cap:error', { token: CAP.token, msg: '앱과 연결되지 않아 저장을 멈췄어요' }); capTeardown('앱이 이 저장을 알지 못함'); } }, 8000);
    capEarlyQuality();
  })();
  G.onCommand('cap:ack', function (arg) { if (CAP && arg && arg.token === CAP.token) CAP.acked = true; });
  G.onCommand('cap:abort', function () { capTeardown('앱이 저장을 멈춤'); });
  // 첫 영상 조각을 받기 전에 화질을 정해야 중간에 바뀌지 않음 → 플레이어가 준비되는 대로 바로 고름
  function capEarlyQuality() {
    var tries = 0;
    (function tick() {
      if (!CAP || CAP.inits.video || tries++ > 150) return;
      var p = mainPlayer();
      if (p && typeof p.setPlaybackQualityRange === 'function') {
        try { p.setPlaybackQualityRange(CAP.quality, CAP.quality); if (p.setPlaybackQuality) p.setPlaybackQuality(CAP.quality); } catch (e) { /* ignore */ }
      }
      G.setTimeout.call(W, tick, 100);
    })();
  }
  function capTag(sb, kind) {
    if (!CAP || !sb) return;
    sbInfo.set(sb, { kind: kind, pending: null, held: null, initHead: null, ts: 0, trexDur: 0 });
    if (kind === 'audio') CAP.hasAudio = true;
  }
  (function capHook() {
    try {
      var SBp = W.SourceBuffer && W.SourceBuffer.prototype;
      if (!SBp || !SBp.appendBuffer) return;
      var orig = SBp.appendBuffer;
      SBp.appendBuffer = G.disguise(function appendBuffer(data) {
        var r = orig.apply(this, arguments); // 브라우저가 받아들인 데이터만 저장 (용량 초과 등으로 거절되면 유튜브가 다시 넣음)
        if (CAP && CAP.active) { try { capChunk(this, data); } catch (e) { capFail('저장 중 오류: ' + e.message); } }
        else if (!CAP) { var mi = mcInfo.get(this); if (mi) { try { mcChunk(mi, data); } catch (e) { if (MC) MC.bad = true; } } }
        if (!CAP) { try { if (G.musicNow && G.musicNow() && data) mcDataAdd(data.byteLength || 0); } catch (e) { /* ignore */ } }
        return r;
      }, orig);
      // 유튜브가 넣던 조각을 취소하면(탐색 등) 덜 받은 부분은 버림
      if (SBp.abort) {
        var origAbort = SBp.abort;
        SBp.abort = G.disguise(function abort() { var i = sbInfo.get(this) || mcInfo.get(this); if (i) { i.pending = null; i.held = null; } return origAbort.apply(this, arguments); }, origAbort);
      }
    } catch (e) { /* ignore */ }
  })();

  // ---- 조각 MP4 상자 읽기 (완전한 상자만 앱에 넘김) ----
  function u32(b, o) { return ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3]; }
  function btype(b, o) { return String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]); }
  var KNOWN = { ftyp: 1, moov: 1, moof: 1, mdat: 1, styp: 1, sidx: 1, emsg: 1, prft: 1, free: 1, skip: 1, uuid: 1, mfra: 1, meta: 1 };
  function concat(a, b) { var c = new Uint8Array(a.length + b.length); c.set(a, 0); c.set(b, a.length); return c; }
  function sameBytes(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  // 상자 안의 하위 상자 찾기
  function child(b, start, end, type) {
    for (var o = start; o + 8 <= end;) { var sz = u32(b, o); if (sz < 8 || o + sz > end) return -1; if (btype(b, o) === type) return o; o += sz; }
    return -1;
  }
  function children(b, start, end, type, fn) {
    for (var o = start; o + 8 <= end;) { var sz = u32(b, o); if (sz < 8 || o + sz > end) return; if (btype(b, o) === type) fn(o, sz); o += sz; }
  }
  // 시작 정보에서 시간 단위(mdhd timescale)와 기본 샘플 길이(trex) 읽기
  function readInit(info, init) {
    var mv = child(init, 0, init.length, 'moov'); if (mv < 0) return;
    var mvEnd = mv + u32(init, mv);
    var trak = child(init, mv + 8, mvEnd, 'trak');
    if (trak >= 0) {
      var mdia = child(init, trak + 8, trak + u32(init, trak), 'mdia');
      var mdhd = mdia >= 0 ? child(init, mdia + 8, mdia + u32(init, mdia), 'mdhd') : -1;
      if (mdhd >= 0) info.ts = init[mdhd + 8] === 1 ? u32(init, mdhd + 28) : u32(init, mdhd + 20);
    }
    var mvex = child(init, mv + 8, mvEnd, 'mvex');
    var trex = mvex >= 0 ? child(init, mvex + 8, mvex + u32(init, mvex), 'trex') : -1;
    if (trex >= 0) info.trexDur = u32(init, trex + 20);
  }
  // 조각(moof)의 시작·끝 시각(초)
  function fragRange(info, moof) {
    var traf = child(moof, 8, moof.length, 'traf'); if (traf < 0 || !info.ts) return null;
    var tEnd = traf + u32(moof, traf), defDur = info.trexDur, base = -1, total = 0;
    var tfhd = child(moof, traf + 8, tEnd, 'tfhd');
    if (tfhd >= 0) {
      var fl = u32(moof, tfhd + 8) & 0xffffff, o = tfhd + 16;
      if (fl & 1) o += 8; if (fl & 2) o += 4;
      if (fl & 8) defDur = u32(moof, o);
    }
    var tfdt = child(moof, traf + 8, tEnd, 'tfdt');
    if (tfdt >= 0) base = moof[tfdt + 8] === 1 ? u32(moof, tfdt + 12) * 4294967296 + u32(moof, tfdt + 16) : u32(moof, tfdt + 12);
    if (base < 0) return null;
    children(moof, traf + 8, tEnd, 'trun', function (tr) {
      var fl = u32(moof, tr + 8) & 0xffffff, n = u32(moof, tr + 12), o = tr + 16;
      if (fl & 1) o += 4; if (fl & 4) o += 4;
      var per = ((fl & 0x100) ? 4 : 0) + ((fl & 0x200) ? 4 : 0) + ((fl & 0x400) ? 4 : 0) + ((fl & 0x800) ? 4 : 0);
      if (fl & 0x100) { for (var i = 0; i < n; i++) total += u32(moof, o + i * per); } else total += n * defDur;
    });
    return [base / info.ts, (base + total) / info.ts];
  }

  // 받은 데이터를 MP4 상자 단위로 (덜 받은 상자는 다음 조각과 합침). fn 이 false 를 돌려주면 멈춤
  function boxWalk(info, data, fn) {
    var src = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    if (!src.length) return;
    var buf = info.pending ? concat(info.pending, src) : src.slice();
    var o = 0;
    while (o + 8 <= buf.length) {
      var size = u32(buf, o), type = btype(buf, o), hdr = 8;
      if (!KNOWN[type]) { // 줄이 어긋남: 다음 moof/ftyp를 찾아 다시 맞춤
        var next = -1;
        for (var i = o + 1; i + 8 <= buf.length; i++) { var t = btype(buf, i); if (t === 'moof' || t === 'ftyp') { next = i; break; } }
        if (next < 0) { o = Math.max(o, buf.length - 7); break; }
        o = next; continue;
      }
      if (size === 1) { if (o + 16 > buf.length) break; size = u32(buf, o + 8) * 4294967296 + u32(buf, o + 12); hdr = 16; }
      if (size === 0) break; // '끝까지' 크기는 유튜브가 쓰지 않음: 다음 조각과 합쳐 다시 봄
      if (size < hdr) { o += 8; continue; }
      if (o + size > buf.length) break; // 덜 받은 상자: 다음 조각과 합쳐서
      if (fn(type, buf.subarray(o, o + size)) === false) return;
      o += size;
    }
    info.pending = o < buf.length ? buf.slice(o) : null;
  }
  function capChunk(sb, data) {
    var info = sbInfo.get(sb);
    if (!info) return;
    if (G.inAd()) { info.pending = null; info.held = null; return; } // 광고 조각은 저장하지 않음
    boxWalk(info, data, function (type, box) { capBox(info, type, box); return !!(CAP && CAP.active); });
  }
  function capBox(info, type, box) {
    var kind = info.kind;
    if (type === 'ftyp') { info.initHead = box.slice(); return; }
    if (type === 'moov') {
      if (!info.initHead) return;
      var init = concat(info.initHead, box);
      info.initHead = null;
      var prev = CAP.inits[kind];
      if (prev) {
        if (sameBytes(prev, init)) return; // 같은 시작 정보를 다시 넣은 것
        return capRestart((kind === 'video' ? '영상' : '소리') + ' 화질·형식이 바뀜');
      }
      CAP.inits[kind] = init;
      readInit(info, init);
      capSend(kind === 'video' ? 1 : 2, init);
      if (kind === 'video' && CAP.attempt >= 3) { // 마지막 시도: 지금 화질로 고정해 더 바뀌지 않게
        var p = mainPlayer();
        try { var cur = p.getPlaybackQuality(); if (cur) p.setPlaybackQualityRange(cur, cur); } catch (e) { /* ignore */ }
      }
      return;
    }
    if (!CAP.inits[kind]) return; // 시작 정보 전의 조각은 쓸 수 없음
    if (type === 'moof') { info.held = box.slice(); return; }
    if (type === 'mdat' && info.held) {
      var r = fragRange(info, info.held);
      capSend(kind === 'video' ? 1 : 2, concat(info.held, box));
      info.held = null;
      if (r) { addRange(CAP.ranges[kind], r[0], r[1]); capProgress(); }
    }
  }
  function capSend(track, u8) {
    CAP.bytes += u8.length;
    CAP.lastGrowth = Date.now();
    if (S().binMsg !== false) {
      var out = new Uint8Array(u8.length + 1);
      out[0] = track; out.set(u8, 1);
      if (G.sendBinary(out.buffer)) return;
    }
    // 바이너리 메시지를 못 쓰는 웹뷰: 문자열로 (느리지만 동작)
    for (var off = 0; off < u8.length; off += 262144) {
      var part = u8.subarray(off, Math.min(u8.length, off + 262144)), bin = '';
      for (var i = 0; i < part.length; i += 32768) bin += String.fromCharCode.apply(null, part.subarray(i, i + 32768));
      G.send('capb64', { token: CAP.token, t: track, d: btoa(bin) });
    }
  }
  function addRange(list, s, e) {
    list.push([s, e]);
    list.sort(function (a, b) { return a[0] - b[0]; });
    for (var i = 0; i < list.length - 1;) {
      if (list[i + 1][0] <= list[i][1] + 0.15) { list[i][1] = Math.max(list[i][1], list[i + 1][1]); list.splice(i + 1, 1); } else i++;
    }
  }
  // 0초부터 빈 곳 없이 앱에 넘긴 끝 지점
  function coveredUntil(list) { return list.length && list[0][0] <= 0.3 ? list[0][1] : 0; }
  function capVideo() { var p = mainPlayer(); return { p: p, v: p && p.querySelector('video') }; }
  function capProgress() {
    if (!CAP || CAP.done || !CAP.active) return;
    var pv = capVideo(), v = pv.v;
    if (!v || !isFinite(v.duration) || v.duration <= 0) return;
    var d = v.duration;
    var cv = coveredUntil(CAP.ranges.video), ca = CAP.hasAudio ? coveredUntil(CAP.ranges.audio) : d;
    var upto = Math.min(cv, ca);
    if (upto > (CAP.lastUpto || 0) + 0.5) { CAP.lastUpto = upto; CAP.gapSeeks = 0; } // 앞으로 나아가면 빈 곳 재시도 횟수 초기화
    var pct = Math.min(100, Math.floor(upto / d * 100));
    capShow(pct);
    if (pct >= CAP.sentPct + 5 && pct < 100) { CAP.sentPct = pct; G.send('cap:progress', { token: CAP.token, pct: pct }); } // 앱 알림용 (5%마다)
    if (upto >= d - 0.35) return capFinish(v, d);
    // 끝까지 재생됐고 영상·소리 모두 0초부터 한 덩어리면, 소리가 영상보다 조금 먼저 끝나는 경우도 완료로
    if (v.ended && CAP.ranges.video.length === 1 && (!CAP.hasAudio || CAP.ranges.audio.length === 1) && upto >= d - 1.5) return capFinish(v, d);
    // 재생이 넘긴 구간 끝을 한참 지나쳤으면(빈 곳) 그 지점으로 돌아가 채움
    if (!CAP.seeking && (v.currentTime > upto + 3 || v.ended) && !G.inAd()) {
      if (++CAP.gapSeeks > 8) return capFail('일부 구간을 받지 못했어요');
      capSeek(Math.max(0, upto - 1));
    }
  }
  function capSeek(t) {
    var pv = capVideo();
    if (!pv.v) return;
    CAP.seeking = true;
    try { if (pv.p && typeof pv.p.seekTo === 'function') pv.p.seekTo(t, true); else pv.v.currentTime = t; } catch (e) { pv.v.currentTime = t; }
    if (pv.v.paused) pv.v.play().catch(function () {});
    G.setTimeout.call(W, function () { if (CAP) CAP.seeking = false; }, 1500);
  }
  // 재생 조건 유지: 음소거·빠른 배속, 처음 재생 때 0초부터. 다른 영상으로 넘어가면 저장 모드를 풂
  function capKeep(e) {
    if (!CAP || CAP.done || CAP.failed) return;
    var pv = capVideo(), v = pv.v, p = pv.p;
    if (!v || e.target !== v) return;
    // 광고 중에는 플레이어가 광고의 영상 ID를 알려 주므로 판단하지 않음 (진짜 이동은 주소로도 따로 확인)
    var cur = G.inAd() || G.isAdShowing(p) ? null : G.currentVideoId(p);
    if (cur && CAP.vid && cur !== CAP.vid) { G.send('cap:error', { token: CAP.token, msg: '다른 영상으로 넘어가 저장을 멈췄어요' }); return capTeardown('다른 영상으로 넘어감'); }
    if (CAP.userMuted === undefined) { try { CAP.userMuted = p && typeof p.isMuted === 'function' ? !!p.isMuted() : v.muted; } catch (err) { CAP.userMuted = false; } }
    if (!v.muted) v.muted = true;
    if (e.type === 'loadedmetadata' || e.type === 'playing') {
      // 길이는 조각 재생에서 나중에 정해질 수 있음 → 몇 초 뒤에도 끝이 없으면 실시간 방송
      if (!isFinite(v.duration) && !CAP.liveCheck) CAP.liveCheck = G.setTimeout.call(W, function () {
        var x = capVideo();
        var d = x.p && typeof x.p.getDuration === 'function' ? x.p.getDuration() : NaN;
        if (x.v && !isFinite(x.v.duration) && !(d > 0 && isFinite(d))) capFail('실시간 방송은 저장할 수 없어요');
      }, 6000);
      if (!CAP.startedAt0) { CAP.startedAt0 = true; if (v.currentTime > 0.5) capSeek(0); }
    }
    if (v.playbackRate !== CAP.rate && !G.inAd()) { try { v.playbackRate = CAP.rate; } catch (err) { /* ignore */ } }
    if (e.type === 'pause' && !v.ended) G.setTimeout.call(W, function () { if (CAP && CAP.active && !CAP.done && v.paused) v.play().catch(function () {}); }, 300);
    if (e.type === 'ended' || e.type === 'timeupdate') capProgress();
  }
  ['loadedmetadata', 'playing', 'ratechange', 'pause', 'ended', 'timeupdate', 'volumechange'].forEach(function (t) { document.addEventListener(t, capKeep, true); });
  W.addEventListener('yt-navigate-finish', function () {
    if (!CAP || CAP.done) return;
    var v = new URLSearchParams(location.search).get('v');
    if (location.pathname !== '/watch' || (v && v !== CAP.vid)) { G.send('cap:error', { token: CAP.token, msg: '다른 화면으로 이동해 저장을 멈췄어요' }); capTeardown('다른 화면으로 이동'); }
  }, true);
  function capFinish(v, d) {
    if (CAP.done) return;
    CAP.done = true; CAP.active = false;
    try { v.pause(); } catch (e) { /* ignore */ }
    capRestoreSound(v);
    capShow(100, '파일로 만드는 중…');
    if (CAP.ui) CAP.ui.cancel.hidden = true; // 여기서부터는 앱이 파일을 만드는 중이라 취소하지 않음
    log('info', '오프라인 저장: 데이터 다 받음 (' + Math.round(CAP.bytes / 1048576) + 'MB, ' + Math.round((Date.now() - CAP.started) / 1000) + '초) → 앱이 파일로 만듦');
    var pv = capVideo(), vd = null;
    try { vd = pv.p && pv.p.getVideoData && pv.p.getVideoData(); } catch (e) { /* ignore */ }
    G.send('cap:done', { token: CAP.token, vid: CAP.vid, duration: d, height: v.videoHeight, width: v.videoWidth, bytes: CAP.bytes,
      title: (vd && vd.title) || document.title.replace(/ - YouTube$/, ''), author: (vd && vd.author) || '' });
  }
  // 저장하느라 끈 소리를 되돌려 둠 (유튜브가 음소거 상태를 기억해 다음 재생이 무음이 되지 않게)
  function capRestoreSound(v, c) {
    c = c || CAP;
    if (c && c.userMuted) return; // 원래 음소거해 두었으면 그대로
    try { if (v) v.muted = false; var p = mainPlayer(); if (p && typeof p.unMute === 'function') p.unMute(); } catch (e) { /* ignore */ }
  }
  function capRestart(reason) {
    if (!CAP || !CAP.active) return;
    CAP.active = false;
    var pv = capVideo();
    try { if (pv.v) pv.v.pause(); } catch (e) { /* ignore */ }
    if (CAP.attempt >= 3) { CAP.active = true; return capFail('화질이 계속 바뀌어 저장하지 못했어요'); }
    log('info', '오프라인 저장: ' + reason + ' → 처음부터 다시 (' + (CAP.attempt + 1) + '번째 시도)');
    capShow(0, '화질을 맞추는 중… 처음부터 다시 받아요');
    G.send('cap:restart', { token: CAP.token, attempt: CAP.attempt, reason: reason });
    // 앱이 20초 안에 새로 열지 않으면 실패로 (멈춘 채 남지 않게)
    var c = CAP;
    G.setTimeout.call(W, function () { if (CAP === c && !c.done && !c.failed) { c.active = true; capFail('다시 받기를 시작하지 못했어요'); } }, 20000);
  }
  function capFail(msg) {
    if (!CAP || CAP.failed || CAP.done) return;
    CAP.failed = true; CAP.active = false;
    var pv = capVideo();
    try { if (pv.v) pv.v.pause(); } catch (e) { /* ignore */ }
    capRestoreSound(pv.v);
    log('warn', '오프라인 저장 실패: ' + msg);
    capShow(-1, msg);
    G.send('cap:error', { token: CAP.token, msg: msg });
  }
  // 저장 모드를 완전히 풂 (보통 재생으로): 화면·표시 제거, 소리·배속 원래대로
  function capTeardown(reason) {
    if (!CAP) return;
    var c = CAP;
    c.active = false;
    CAP = null;
    try { if (c.ui && c.ui.box) c.ui.box.remove(); } catch (e) { /* ignore */ }
    try { delete document.documentElement.dataset.glideCapture; } catch (e) { /* ignore */ }
    var p = mainPlayer(), v = p && p.querySelector('video');
    if (v) { try { if (v.playbackRate === c.rate) v.playbackRate = 1; } catch (e) { /* ignore */ } capRestoreSound(v, c); }
    log('info', '오프라인 저장 모드 해제 (' + reason + ')');
  }
  function capWatchdog() {
    if (!CAP || CAP.done || CAP.failed || !CAP.active) return;
    var still = Date.now() - CAP.lastGrowth;
    if (still > 90000) return capFail(CAP.bytes ? '데이터가 더 오지 않아요 (네트워크 확인)' : '영상을 불러오지 못했어요');
    G.setTimeout.call(W, capWatchdog, 5000);
  }
  G.onCommand('cap:finished', function (arg) {
    if (!CAP) return;
    if (!(arg && arg.ok) && !CAP.failed) {
      // 앱 쪽에서 실패: 페이지도 바로 멈춤 (다시 알리지는 않음)
      CAP.failed = true; CAP.active = false;
      var pv = capVideo(); try { if (pv.v) pv.v.pause(); } catch (e) { /* ignore */ }
      capRestoreSound(pv.v);
    }
    if (CAP.ui) CAP.ui.cancel.hidden = false;
    capShow(arg && arg.ok ? 100 : -1, (arg && arg.msg) || '');
  });
  // 저장 화면 (플레이어를 덮어 조작을 막고 진행률을 보여 줌)
  function capUi() {
    if (!CAP || CAP.ui) return;
    var bar = G.el('div', { 'class': 'b' }, [G.el('div', { 'class': 'f' })]);
    var cancel = G.el('button', { type: 'button', text: '취소' });
    cancel.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (!CAP) return;
      var finished = CAP.failed || CAP.done;
      if (!finished) G.send('cap:cancel', { token: CAP.token }); // 앱이 받은 데이터를 지우고 보통 화면으로 다시 엶
      var pv = capVideo(); try { if (pv.v) pv.v.pause(); } catch (err) { /* ignore */ }
      capTeardown(finished ? '닫기' : '취소');
    }, true);
    var box = G.el('div', { id: 'glide-cap', 'data-glide': 'cap' }, [
      G.el('div', { 'class': 'c' }, [G.el('div', { 'class': 't', text: '오프라인 저장 중' }), bar, G.el('div', { 'class': 'm', text: '준비 중…' }),
        G.el('div', { 'class': 'n', text: '소리 없이 빠르게 한 번 재생하며 저장해요. 다른 앱을 써도 계속돼요.' }), cancel])
    ]);
    var st = document.createElement('style');
    st.textContent = '#glide-cap{position:fixed;inset:0;z-index:2147483647;background:rgba(10,10,14,.82);display:flex;align-items:center;justify-content:center;touch-action:none}' +
      '#glide-cap .c{width:min(86vw,360px);padding:22px;border-radius:18px;background:#1c1d24;color:#eee;font:500 14px/1.45 Pretendard,Roboto,system-ui,sans-serif;text-align:center}' +
      '#glide-cap .t{font-size:17px;font-weight:800;margin-bottom:14px}#glide-cap .b{height:8px;border-radius:4px;background:#33353f;overflow:hidden}#glide-cap .f{height:100%;width:0;background:#7d8fff;transition:width .3s}' +
      '#glide-cap .m{margin-top:10px;font-weight:700}#glide-cap .n{margin-top:6px;font-size:12.5px;color:#aab}#glide-cap button{all:unset;margin-top:16px;padding:9px 22px;border-radius:20px;background:#33353f;color:#fff;font-weight:700;cursor:pointer}';
    box.appendChild(st);
    ['touchstart', 'touchmove', 'touchend', 'click', 'pointerdown'].forEach(function (t) { box.addEventListener(t, function (e) { if (e.target !== cancel) { e.stopPropagation(); if (t !== 'touchstart' && e.cancelable) e.preventDefault(); } }, { capture: true, passive: false }); });
    (document.body || document.documentElement).appendChild(box);
    CAP.ui = { box: box, fill: bar.firstChild, msg: box.querySelector('.m'), cancel: cancel, title: box.querySelector('.t') };
  }
  function capShow(pct, text) {
    if (!CAP || !CAP.ui) return;
    var u = CAP.ui;
    if (pct >= 0) u.fill.style.width = pct + '%';
    var mb = (CAP.bytes / 1048576).toFixed(1) + 'MB';
    if (pct < 0) { u.title.textContent = '저장하지 못했어요'; u.msg.textContent = text || ''; u.cancel.textContent = '닫기'; }
    else if (text) { u.msg.textContent = text; if (CAP.done && pct === 100 && /완료|저장했/.test(text)) { u.title.textContent = '저장 완료'; u.cancel.textContent = '닫기'; } }
    else u.msg.textContent = pct + '% · ' + mb;
  }

  // ===========================================================================
  // 링크로 연 영상의 음소거 자동 해제
  //   모바일 유튜브는 화면을 누르지 않고 열린 영상(다른 앱에서 연 링크, 새로고침)을 '탭하여 음소거 해제' 상태로 시작함 (브라우저 자동 재생 정책).
  //   앱 웹뷰는 소리 있는 자동 재생이 허용되므로(mediaPlaybackRequiresUserGesture=false) 유튜브의 그 버튼을 대신 눌러 줌.
  //   실기 확인(폴드5): 스크립트 click으로 유튜브 상태까지 풀림. 영상 화면의 본 플레이어만, 오프라인 저장 중(일부러 음소거)은 제외.
  //   한 영상에 한 번만 (같은 영상에서 다시 음소거 상태가 되면 그대로 둠)
  // ===========================================================================
  var unmutedFor = '';
  function autoUnmute() {
    if (!onWatch() || CAP || !S().enabled || G.inAd()) return;
    var mp = mainPlayer();
    if (mp && mp.classList.contains('ad-showing')) return;
    var b = null;
    for (var i = 0; i < A.unmuteButtons.length && !b; i++) { try { b = document.querySelector(A.unmuteButtons[i]); } catch (e) { /* ignore */ } }
    if (!b || !b.getClientRects().length) return;
    var id = new URLSearchParams(location.search).get('v') || '';
    if (id === unmutedFor) return;
    unmutedFor = id;
    b.click();
    log('info', '링크로 연 영상의 음소거를 풀었어요 (유튜브 자동 재생 음소거)');
  }
  document.addEventListener('playing', function (e) {
    var p = mainPlayer();
    if (p && e.target && p.contains(e.target)) [150, 900].forEach(function (ms) { G.setTimeout.call(W, autoUnmute, ms); });
  }, true);

  // ===========================================================================
  // 화면 테마: 유튜브 화면이 실제로 어두운지 앱에 알림 (앱이 상태 표시줄·배경색을 맞추고, 앱 테마 설정과 다르면 바로잡음)
  // ===========================================================================
  // 상단 바 색: 상태 표시줄을 같은 색으로 칠해 한 줄로 이어 보이게 (영상 화면은 위쪽 바가 검은색인데 상태 표시줄만 흰색이라 웹처럼 보였음)
  var lastTopbar = '';
  function solidColor(el) {
    if (!el) return null;
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(getComputedStyle(el).backgroundColor || '');
    if (!m || (m[4] !== undefined && +m[4] < 0.5)) return null; // 투명
    return [+m[1], +m[2], +m[3]];
  }
  // 영상 화면의 상단 바는 배경색이 없고, 뒤의 '앰비언트 모드' 캔버스(영상 색을 흐리게 칠함)가 비침 (실기 확인).
  // 상단 바 높이 가운데의 캔버스 색을 겹친 순서·투명도대로 합쳐 근사함 (캔버스는 2d이고 읽기 가능)
  function ambientColor() {
    var c = document.querySelector('ytm-cinematic-container-renderer');
    if (!c || !onWatch()) return null;
    var r = c.getBoundingClientRect();
    if (r.height < 10 || r.bottom < 24) return null;
    var cv = c.querySelectorAll('canvas'), rgb = null;
    for (var i = 0; i < cv.length; i++) {
      var k = cv[i], op = +getComputedStyle(k).opacity, d;
      try {
        var ctx = k.getContext('2d');
        if (!ctx || !k.width || !k.height) continue;
        var y = Math.max(0, Math.min(k.height - 1, Math.round((24 - r.top) / r.height * k.height)));
        d = ctx.getImageData(k.width >> 1, y, 1, 1).data;
      } catch (e) { continue; }
      if (!rgb) rgb = [d[0], d[1], d[2]];
      else rgb = [0, 1, 2].map(function (j) { return Math.round(rgb[j] * (1 - op) + d[j] * op); });
    }
    return rgb;
  }
  function reportTopbar() {
    if (inFull()) return;
    // 상단 바를 숨긴 영상 화면: 상태 표시줄 아래가 바로 영상이라 검게 (유튜브 앱과 같음)
    var rgb = document.documentElement.classList.contains('glide-notop') ? [0, 0, 0] : ambientColor() || solidColor(document.querySelector('ytm-mobile-topbar-renderer header.mobile-topbar-header')) || solidColor(document.querySelector('ytm-mobile-topbar-renderer')) || solidColor(document.body) || solidColor(document.documentElement);
    if (!rgb) return;
    var hex = '#' + rgb.map(function (n) { return ('0' + n.toString(16)).slice(-2); }).join('');
    if (hex === lastTopbar) return;
    lastTopbar = hex;
    G.send('topbar', { color: hex });
  }
  // 앰비언트 색은 장면 따라 바뀌고, 모바일 유튜브는 화면 이동 때 yt-navigate-finish를 보내지 않을 수 있어(영상→홈에서 어두운 색이 남았음)
  // 모든 화면에서 가끔 다시 봄 (바뀔 때만 알림. 1픽셀 읽기라 부담 적음)
  // 영상 아래 버튼 줄에 '저장(오프라인)' 버튼: 다운로드를 어디서 하는지 찾지 않아도 되게 (유튜브 앱의 '오프라인 저장' 자리)
  // 아이콘은 mask + currentColor라 라이트·다크 테마 글자색을 그대로 따름
  function chip(id, label, aria, onClick) {
    var b = document.createElement('button');
    b.id = id;
    b.type = 'button';
    b.className = 'glide-chip';
    b.setAttribute('aria-label', aria);
    b.appendChild(document.createElement('i'));
    b.appendChild(document.createTextNode(label));
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); onClick(); }, true);
    return b;
  }
  // 버튼 줄의 '더보기(⋯)' 버튼 칸: Glide 버튼은 그 앞에 (유튜브 앱처럼 ⋯가 맨 끝)
  function moreSlot(bar) {
    var m = bar.querySelector('button[aria-label="더보기"], button[aria-label="More actions"], button[aria-label="추가 작업"]');
    if (!m) return null;
    while (m.parentElement && m.parentElement !== bar) m = m.parentElement;
    return m.parentElement === bar ? m : null;
  }
  (function ownerFast() {
    try {
      if (role() === 'player' && document.documentElement) {
        var h = document.documentElement, want = onWatch() && S().enabled && !CAP;
        if (want && location.href !== OWN.href) { OWN.href = location.href; OWN.until = Date.now() + 4000; OWN.miss = 0; h.classList.add('glide-owner'); }
        if (!want && h.classList.contains('glide-owner')) { h.classList.remove('glide-owner'); OWN.href = ''; }
        if (want && Date.now() < (OWN.until || 0)) ensureSaveButton();
      }
    } catch (e) { /* 다음에 */ }
    G.setTimeout.call(W, ownerFast, 150);
  })();
  function ensureSaveButton() {
    if (!onWatch() || !S().enabled || CAP) return;
    var bar = document.querySelector('ytm-slim-video-action-bar-renderer .slim-video-action-bar-actions');
    if (!bar) return;
    var slot = moreSlot(bar);
    if (S().saveButton && !bar.querySelector('#glide-save-btn')) {
      var b = chip('glide-save-btn', '오프라인 저장', '저장 (인터넷 없이 보기)', function () {
        var id = new URLSearchParams(location.search).get('v');
        if (id) { G.send('haptic', { kind: 'gesture' }); G.send('save', { videoId: id }); }
      });
      if (slot) bar.insertBefore(b, slot); else bar.appendChild(b);
    }
    if (!S().saveButton) { var oldSave = bar.querySelector('#glide-save-btn'); if (oldSave) oldSave.remove(); }
    // 장면 저장 (1.8.6): 지금 영상 화면을 조작 버튼 없이 사진으로 (앱이 갤러리 '사진 › Glide'에 저장)
    if (role() === 'player' && !bar.querySelector('#glide-frame-btn')) {
      var fb = chip('glide-frame-btn', '장면 저장', '지금 장면을 사진으로 저장', grabFrame);
      var after = bar.querySelector('#glide-save-btn');
      if (after) bar.insertBefore(fb, after.nextSibling); else if (slot) bar.insertBefore(fb, slot); else bar.appendChild(fb);
    }
    // 상단 바를 숨긴 영상 화면(영상 웹뷰)에서는 Glide 메뉴 버튼을 여기에
    if (document.documentElement.classList.contains('glide-notop') && !bar.querySelector('#glide-row-btn')) {
      var g = chip('glide-row-btn', 'Glide', 'Glide 메뉴', function () { G.send('openPanel', {}); });
      if (slot) bar.insertBefore(g, slot); else bar.appendChild(g);
      if (!injected) { injected = true; G.send('headerButton', { ok: true }); log('info', '영상 아래 버튼 줄에 Glide 버튼 추가'); }
    }
    labelActions(bar);
    ensureOwnerRow(bar);
    if (QU) quRow();
  }
  // 지금 영상의 채널 {channelId, author}: 코어가 받아 둔 영상 정보, 없으면 플레이어 영상 정보(getPlayerResponse) — 실기: 앱 안에서 옮겨 간 영상은 코어 정보가 없었음
  function curChannel() {
    var m = G.videoMeta(G.currentVideoId());
    if (m && /^UC[\w-]{20,}$/.test(m.channelId || '')) return { channelId: m.channelId, author: m.author || '' };
    try {
      var p = mainPlayer(), r = p && p.getPlayerResponse && p.getPlayerResponse(), d = r && r.videoDetails;
      if (d && d.videoId === G.currentVideoId() && /^UC[\w-]{20,}$/.test(d.channelId || '')) return { channelId: d.channelId, author: d.author || '' };
    } catch (e) { /* ignore */ }
    return null;
  }
  // 장면 저장: 영상 요소의 지금 프레임을 그대로 그림 (조작 버튼·자막 글자 없이). 유튜브 영상은 MSE(blob:)라 캔버스가 막히지 않을 것으로 보지만
  // 막히면(보안 오류) 앱에 실패를 알림. 광고 중·영상이 아직 없으면 안 함
  function grabFrame() {
    var p = mainPlayer(), v = p && p.querySelector('video');
    if (!v || !v.videoWidth || G.inAd()) { G.send('frame', { error: v && v.videoWidth ? 'ad' : 'novideo' }); return; }
    var c = document.createElement('canvas');
    // 4K 같은 큰 영상은 폭 1920으로 줄여 저장 (앱으로 넘기는 글자 덩어리가 수 MB면 잠깐 멈칫함 — 독립 검토 반영)
    var k = Math.min(1, 1920 / v.videoWidth);
    c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
    var url;
    try { c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); url = c.toDataURL('image/jpeg', 0.93); } catch (e) { G.send('frame', { error: 'blocked' }); log('warn', '장면 저장: 영상을 그림으로 못 바꿈 ' + e.message); return; }
    var vd = null;
    try { vd = p.getVideoData && p.getVideoData(); } catch (e) { /* ignore */ }
    G.send('haptic', { kind: 'gesture' });
    G.send('frame', { data: url.slice(url.indexOf(',') + 1), w: c.width, h: c.height, title: (vd && vd.title) || document.title || '', id: (vd && vd.video_id) || '', t: Math.floor(v.currentTime || 0) });
    log('info', '장면 저장 ' + c.width + 'x' + c.height + ' ' + Math.floor(v.currentTime || 0) + '초');
  }
  // 올린 때: '방금 · N분 전 · N시간 전 · N일 전 · N주 전 · N개월 전 · N년 전' (플레이어 정보 publishDate/uploadDate, 지금 영상 것만)
  function ownerAge() {
    try {
      var p = mainPlayer(), pr = p && p.getPlayerResponse && p.getPlayerResponse(), v = new URLSearchParams(location.search).get('v');
      if (!pr || !pr.videoDetails || pr.videoDetails.videoId !== v || pr.videoDetails.isLive) return '';
      var mf = pr.microformat && pr.microformat.playerMicroformatRenderer;
      var d = mf && (mf.publishDate || mf.uploadDate); if (!d) return '';
      var t = Date.parse(d); if (!isFinite(t)) return '';
      if (!/T/.test(d) && Date.now() - t < 86400000) return '오늘'; // 날짜만 있는 경우
      var s = (Date.now() - t) / 1000;
      if (s < 0) s = 0;
      if (s < 3600) return s < 60 ? '방금' : Math.floor(s / 60) + '분 전';
      if (s < 86400) return Math.floor(s / 3600) + '시간 전';
      if (s < 86400 * 7) return Math.floor(s / 86400) + '일 전';
      if (s < 86400 * 30) return Math.floor(s / (86400 * 7)) + '주 전';
      if (s < 86400 * 365) return Math.floor(s / (86400 * 30)) + '개월 전';
      return Math.floor(s / (86400 * 365)) + '년 전';
    } catch (e) { return ''; }
  }
  // 채널 줄: 유튜브 앱처럼 [사진 채널 이름 구독자 수 ......... 구독] 한 줄 (모바일 웹은 사진·구독 버튼이 버튼 줄 맨 앞에 끼어 있고 이름이 없음).
  // 유튜브 요소는 옮기지 않고(유튜브가 다시 그리면 깨짐) Glide 줄을 따로 만들어 보여 주고, 원래 사진·구독 버튼은 숨김.
  // 구독 버튼은 유튜브 구독 버튼을 대신 누름(구독 취소 확인 창 등 유튜브 동작 그대로). 글자·상태는 유튜브 버튼을 따라감
  var OWN = { miss: 0, href: '' };
  function ensureOwnerRow(bar) {
    var icon = bar.querySelector('a.slim-video-owner-icon'), subWrap = bar.querySelector('.slim-subscribe-button');
    var host = bar.closest('ytm-slim-video-action-bar-renderer');
    var row = document.getElementById('glide-owner');
    if (!host) return;
    if (!icon) {
      // 사진(채널 정보)이 끝내 없는 영상이면 비워 둔 자리를 거둠 (잠깐 빠진 것은 그대로 둠)
      if (!row || !row.isConnected) { if (!OWN.miss) OWN.miss = Date.now(); else if (Date.now() - OWN.miss > 2500) document.documentElement.classList.remove('glide-owner'); }
      return;
    }
    OWN.miss = 0;
    // '김치와 마라탕, 구독자 1.46만명. 채널로 이동합니다.' → 이름, 구독자 수 (유튜브 앱은 '1.46만'처럼 짧게)
    var m = /^(.*?),\s*구독자\s*([\d.,]+\s*[천만억]?)\s*명/.exec(icon.getAttribute('aria-label') || '');
    var en = !m && /^(.*?),\s*([\d.,]+[KMB]?)\s*subscribers/i.exec(icon.getAttribute('aria-label') || '');
    var name = m ? m[1] : en ? en[1] : (icon.getAttribute('aria-label') || '').split(',')[0];
    var count = m ? m[2] : en ? en[2] : '';
    // 구독자 수 옆에 올린 때 ('1.46만 · 3일 전', 2026-11-23 사용자). 플레이어 정보의 게시일(이 영상 것일 때만)
    var age = ownerAge();
    if (age) count = count ? count + ' · ' + age : age;
    var img = icon.querySelector('img'), src = img && img.getAttribute('src');
    var subBtn = subWrap && subWrap.querySelector('button');
    var subText = subBtn ? (subBtn.textContent || '').trim() : '';
    if (!row || row.parentNode !== host) {
      if (row) row.remove();
      var a = G.el('a', { 'class': 'gw-ch', href: icon.getAttribute('href') || '#' }, [G.el('img', { alt: '' }), G.el('b'), G.el('span')]);
      var sb = G.el('button', { type: 'button', 'class': 'gw-sub' });
      sb.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var real = document.querySelector('ytm-slim-video-action-bar-renderer .slim-subscribe-button button');
        if (real) real.click();
        G.setTimeout.call(W, function () { ensureSaveButton(); }, 400);
      }, true);
      // 🔔 새 영상 알림 (Glide, 1.8.6): 이 채널에 새 영상이 올라오면 폰 알림 (유튜브 구독·알림과 별개, 앱이 2시간마다 확인)
      var bell = G.el('button', { type: 'button', 'class': 'gw-bell', 'aria-label': '새 영상 알림' }, [G.el('i')]);
      bell.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var m = curChannel();
        if (!m) { log('warn', '새 영상 알림: 채널 ID를 아직 모름'); return; }
        G.send('haptic', { kind: 'gesture' });
        G.send('notifyToggle', { id: m.channelId, name: m.author || (row.querySelector('.gw-ch b') || {}).textContent || '' });
      }, true);
      row = G.el('div', { id: 'glide-owner' }, [a, bell, sb]);
      host.insertBefore(row, host.firstChild);
    }
    var vm = curChannel();
    var bellOn = !!vm &&(S().notifyChannels || []).some(function (x) { return x && x.id === vm.channelId; });
    var bellBtn = row.querySelector('.gw-bell');
    if (bellBtn) { bellBtn.hidden = !vm; bellBtn.setAttribute('aria-pressed', String(bellOn)); bellBtn.setAttribute('aria-label', bellOn ? '새 영상 알림 끄기' : '새 영상 알림 켜기'); }
    var link = row.firstChild;
    if (link.getAttribute('href') !== icon.getAttribute('href')) link.setAttribute('href', icon.getAttribute('href') || '#');
    if (src && link.firstChild.getAttribute('src') !== src) link.firstChild.setAttribute('src', src);
    if (link.children[1].textContent !== name) link.children[1].textContent = name;
    if (link.children[2].textContent !== count) link.children[2].textContent = count;
    var sbtn = row.lastChild;
    sbtn.hidden = !subBtn;
    if (subBtn && sbtn.textContent !== subText) sbtn.textContent = subText || '구독';
    sbtn.className = 'gw-sub' + (subBtn && !/^(구독|Subscribe)$/i.test(subText) ? ' on' : '');
    var cm = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(host).color);
    var dk = !!cm && (+cm[1] + +cm[2] + +cm[3]) / 3 > 128; // 글자색이 밝으면 어두운 테마
    if (row.classList.contains('d') !== dk) row.classList.toggle('d', dk);
    document.documentElement.classList.add('glide-owner');
  }
  // 유튜브 버튼에 글자 붙이기 (좋아요 수·공유·질문하기). 이미 붙였으면 좋아요 수만 갱신
  function labelActions(bar) {
    var like = bar.querySelector('like-button-view-model button');
    var dislike = bar.querySelector('dislike-button-view-model button');
    if (like) {
      var n = likeCount(like);
      if (n && like.getAttribute('data-glide-label') !== n) like.setAttribute('data-glide-label', n);
      // 유튜브가 버튼 하나만 다시 그리기도 해서(실기: 싫어요만 새 요소) 둘을 따로 확인
      if (dislike && like.getAttribute('data-glide-pill') !== 'l') like.setAttribute('data-glide-pill', 'l');
      if (dislike && dislike.getAttribute('data-glide-pill') !== 'r') dislike.setAttribute('data-glide-pill', 'r');
    }
    var names = { '공유': '공유', 'Share': '공유', '질문하기': '질문하기', 'Ask': '질문하기' };
    var bs = bar.querySelectorAll('button-view-model > button[aria-label]');
    for (var i = 0; i < bs.length; i++) {
      var t = names[bs[i].getAttribute('aria-label')];
      if (t && bs[i].getAttribute('data-glide-label') !== t) bs[i].setAttribute('data-glide-label', t);
    }
  }
  // 좋아요 수: 영상 정보 줄의 '좋아요 2.6천개'를 그대로, 없으면 버튼 설명의 숫자를 유튜브 앱처럼 줄여서
  function likeCount(btn) {
    var subs = document.querySelectorAll('.ytVideoSubtitleViewModelHost span');
    for (var i = 0; i < subs.length; i++) {
      var m = /^좋아요\s*(.+?)개?$/.exec((subs[i].textContent || '').trim());
      if (m) return m[1];
    }
    var d = /([\d,]+)/.exec(btn.getAttribute('aria-label') || '');
    if (!d) return '';
    var n = +d[1].replace(/,/g, '');
    if (!isFinite(n)) return '';
    if (n < 1000) return String(n);
    if (n < 10000) return (Math.floor(n / 100) / 10) + '천';
    if (n < 1e8) return (n < 1e5 ? Math.floor(n / 1000) / 10 : Math.floor(n / 1e4)) + '만';
    return (Math.floor(n / 1e7) / 10) + '억';
  }
  // 버튼 줄 옆으로 넘기기: 글자를 붙여 줄이 화면보다 길어졌는데, 유튜브의 영상 아래 영역 처리기(.watch-below-the-player ontouchmove)가
  // 모든 손가락 움직임을 preventDefault 해서 웹 엔진이 옆으로 넘기지 않았음 (실기 확인) → 이 줄에서 시작한 가로 움직임은 Glide가 직접 넘김
  var RS = null;
  var BAR_SEL = 'ytm-slim-video-action-bar-renderer .slim-video-action-bar-actions';
  var rsGlide = 0; // 관성 세대: 다시 잡으면 앞 관성을 멈춤 (손가락과 번갈아 움직여 떨렸음 — 전수조사 반영)
  W.addEventListener('touchstart', function (e) {
    RS = null;
    rsGlide++;
    var t = e.target, bar = t && t.closest ? t.closest(BAR_SEL) : null;
    if (!bar || e.touches.length !== 1 || bar.scrollWidth <= bar.clientWidth + 2) return;
    var p = e.touches[0];
    RS = { bar: bar, x: p.clientX, y: p.clientY, sl: bar.scrollLeft, dir: null, lx: p.clientX, lt: Date.now(), v: 0 };
  }, { capture: true, passive: true });
  W.addEventListener('touchmove', function (e) {
    if (!RS || !e.touches[0]) return;
    var p = e.touches[0], dx = p.clientX - RS.x, dy = p.clientY - RS.y;
    if (!RS.dir) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      RS.dir = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (RS.dir !== 'x') return;
    RS.bar.scrollLeft = RS.sl - dx;
    var now = Date.now();
    RS.v = (p.clientX - RS.lx) / Math.max(1, now - RS.lt);
    RS.lx = p.clientX; RS.lt = now;
  }, { capture: true, passive: true });
  W.addEventListener('touchend', function () {
    var r = RS; RS = null;
    if (!r || r.dir !== 'x' || Date.now() - r.lt > 80) return;
    var v = r.v * 16; // 튕긴 속도만큼 조금 더 미끄러짐
    var gen = ++rsGlide;
    (function glide() {
      if (gen !== rsGlide || Math.abs(v) < 0.5) return;
      r.bar.scrollLeft -= v; v *= 0.92;
      W.requestAnimationFrame(glide);
    })();
  }, { capture: true, passive: true });

  // 영상 웹뷰의 영상 화면이면 상단 바를 숨김 (유튜브 앱처럼). 둘러보기 웹뷰·예전 앱(role 없음)·전체화면은 그대로
  // 다 본 영상 숨기기를 적용할 화면: 홈·구독(둘러보기), 영상 아래 추천(영상 화면). 화면을 옮길 때마다 바로 다시 판단
  function updateHideWatched() {
    var p = location.pathname;
    var on = !!S().enabled && S().hideWatched !== false && onYT() && (p === '/' || p === '/feed/subscriptions' || p === '/watch');
    var h = document.documentElement;
    if (h && h.classList.contains('glide-hw') !== on) h.classList.toggle('glide-hw', on);
  }
  ['yt-navigate-start', 'yt-navigate-finish', 'popstate', 'yt-page-data-updated'].forEach(function (n) { W.addEventListener(n, function () { try { updateHideWatched(); } catch (e) { /* ignore */ } }, true); });
  G.onSettings(function () { try { updateHideWatched(); } catch (e) { /* ignore */ } });
  function updateNoTop() {
    updateHideWatched();
    var on = !!S().enabled && role() === 'player' && onWatch();
    var h = document.documentElement;
    if (h && h.classList.contains('glide-notop') !== on) { h.classList.toggle('glide-notop', on); resized(); }
  }
  var APPVIS = true; // 앱이 화면에 보이는지 (앱이 'appvis'로 알림. 화면 꺼짐·다른 앱에서는 반복 확인을 쉼)
  G.onCommand('appvis', function (arg) {
    APPVIS = !(arg && arg.on === false);
    // 코어의 듣기 모드가 '앱이 안 보이는 중'을 알 수 있게 표시 (코어는 이 명령을 직접 받지 않음)
    if (document.documentElement) { if (APPVIS) document.documentElement.removeAttribute('data-glide-bg'); else document.documentElement.setAttribute('data-glide-bg', ''); }
    G.setTimeout.call(W, ensureLiveChat, 0);
  });
  (function topbarLoop() {
    // 문서 시작 직후에는 <html> 요소가 아직 없을 수 있음: 여기서 오류가 나면 이 아래 스크립트 전체가 실행되지 않음 (테스트 브라우저에서 확인)
    // 오류가 한 번 나면 다시 예약되지 않아 상단 바·버튼 줄·채널 줄 갱신이 영영 멈췄을 수 있음 → try (전수조사 반영)
    try { if (APPVIS && document.documentElement && !document.documentElement.classList.contains('glide-pip')) {
      updateNoTop();
      reportTopbar();
      reportPull();
      reportGeom();
      ensureSaveButton();
      if (CS && onWatch() && role() === 'player') { csWatch(); csEnsure(); } // CS는 아래에서 만들어짐(첫 실행 때는 아직 없음)
    } } catch (e) { /* 다음 회차에 다시 */ }
    G.setTimeout.call(W, topbarLoop, onWatch() ? 1500 : 1000);
  })();
  // ---------------------------------------------------------------------------
  // 당겨서 새로고침: 앱이 웹뷰를 당김 동작으로 감싸고, 페이지는 '지금 당겨도 되는지'만 알림 (바뀔 때만).
  // 맨 위일 때, 영상·쇼츠 화면이 아닐 때, 메뉴·대화상자·검색창이 열려 있지 않을 때만
  // ---------------------------------------------------------------------------
  var lastPull = null, pullTick = false;
  function pullable() {
    // 추천 탭이 열려 있으면 그 목록이 맨 위일 때 (당기면 추천을 새로 고름)
    if (REC && REC.open) return !!S().enabled && !REC.editor && !!REC.el && REC.el.scrollTop <= 0;
    if (GM && GM.open) return !!S().enabled && !!GM.el && GM.el.scrollTop <= 0 && !GM.dragging && !GM.menu;
    if (!S().enabled || !onYT() || onWatch() || location.pathname.indexOf("/shorts/") === 0 || inFull() || LK.on) return false;
    if ((W.scrollY || (document.scrollingElement && document.scrollingElement.scrollTop) || 0) > 0) return false;
    return !anySheet();
  }
  // 메뉴·대화상자·검색창·댓글 같은 아래 창이 열려 있는지.
  // 같은 이름의 빈 껍데기가 여럿 있을 수 있어(bottom-sheet-container) 모두 보고, 하나라도 화면에 있으면 열림
  // 화면에 실제로 열린 창만 (목록마다 있는 ⋮ 버튼 껍데기(ytm-bottom-sheet-renderer 48x48)는 창이 아님 → 크기·보임으로 거름)
  function openSheets() {
    var out = [];
    // 추천 탭·주제 편집 창도 '열린 창': 앱의 뒤로 가기가 먼저 닫게
    if (QU && QU.sheet) out.push(QU.sheet);
    var rm = document.getElementById('glide-rec-menu');
    if (rm) out.push(rm);
    if (REC && REC.editor) out.push(REC.editor);
    else if (REC && REC.open && REC.el) out.push(REC.el);
    if (GM && GM.open && GM.el) out.push(GM.el);
    if (GM && GM.menu) out.push(GM.menu.sh);
    if (GM && GM.sug) out.push(GM.sug);
    var fp = fsPanel(); if (fp) out.push(fp);
    for (var i = 0; i < A.pullBlockers.length; i++) {
      var els = [];
      try { els = document.querySelectorAll(A.pullBlockers[i]); } catch (e) { continue; }
      for (var j = 0; j < els.length; j++) {
        var el = els[j], r = el.getBoundingClientRect();
        if (r.width < 120 || r.height < 40 || r.bottom <= 0 || r.top >= innerHeight) continue;
        if (getComputedStyle(el).visibility === 'hidden') continue;
        out.push(el);
      }
    }
    return out;
  }
  function anySheet() { return openSheets().length > 0; }
  // 앱의 뒤로 가기: 열린 창(댓글·설명·메뉴·검색)부터 닫음 (유튜브 앱과 같음)
  // ===========================================================================
  // 창을 아래로 휙 밀면 닫힘 (2026-11-21, 사용자: "모든 팝업창에서 아래로 확 슬라이드하면 내려가야 하는데 안 내려가는 경우가 많음").
  // 유튜브 웹은 창 위쪽 손잡이에서만 끌어 닫거나 아예 안 닫히는 창이 많음 → 창 안 어디서든 빠르게 아래로 밀면 닫음(유튜브 앱처럼).
  //  - 창 안 목록이 내려가 있으면(scrollTop > 0) 그 밀기는 목록 올리기 몫이라 닫지 않음
  //  - 유튜브가 스스로 닫는 창도 있어 0.3초 뒤에도 열려 있을 때만 닫음 (같이 닫으면 두 번 눌려 다시 열렸음 — 동영상 더보기 창에서 겪음)
  //  - 검색 중 상단 바·추천 탭 화면은 창이 아님(제외), 전체화면 동영상 더보기 창은 손동작 쪽에서 따로 처리
  // ===========================================================================
  // 댓글·설명 창(ytm-engagement-panel)을 천천히 끌다 놓을 때: 유튜브 앱 21.47은 창 높이의 약 60%(1000px/1650)까지 끌어도 제자리로 돌아가고
  // 거의 바닥까지(약 80%) 끌어야 닫힘. 모바일 웹은 320px만 끌어도 닫았음 (폴드2 실측, 2026-11-25).
  // → 느리게 놓았고 70% 미만이면 웹에 손 뗌을 넘기지 않고, 시작 위치로 되돌린 움직임 + 손 뗌을 대신 보내 웹이 제자리로 돌리게 함. 빠르게 쓸면 그대로(닫힘)
  var ED = null, edSynth = false;
  function edPanelOf(t) { var p = t && t.closest && t.closest('ytm-engagement-panel'); return p && p.getClientRects().length ? p : null; }
  W.addEventListener('touchstart', function (e) {
    if (edSynth) return;
    ED = null;
    if (!S().enabled || !onYT() || e.touches.length !== 1) return;
    var p = edPanelOf(e.target);
    if (!p) return;
    var t = e.touches[0];
    ED = { el: p, target: e.target, id: t.identifier, x: t.clientX, y: t.clientY, s: [{ t: Date.now(), y: t.clientY }], top: p.getBoundingClientRect().top, scrolled: false };
  }, { capture: true, passive: true });
  W.addEventListener('touchmove', function (e) {
    if (edSynth || !ED) return;
    var t = e.touches[0], now = Date.now();
    if (!t) return;
    ED.s.push({ t: now, y: t.clientY }); while (ED.s.length > 2 && now - ED.s[0].t > 100) ED.s.shift();
    if (!ED.scrolled && flScrolled(e.target, ED.el)) ED.scrolled = true;
  }, { capture: true, passive: true });
  W.addEventListener('touchend', function (e) {
    if (edSynth) return;
    var d = ED; ED = null;
    if (!d || d.scrolled || !e.changedTouches[0] || e.touches.length) return;
    var t = e.changedTouches[0], dy = t.clientY - d.y;
    var a = d.s[0], b = d.s[d.s.length - 1], v = (b.y - a.y) / Math.max(1, b.t - a.t);
    var h = innerHeight - d.top;
    // (웹은 창 겉 상자(ytm-engagement-panel)는 그대로 두고 안쪽을 옮김 → 창 위치로 '끄는 중'을 판단할 수 없음)
    if (dy < 40 || v > 0.5 || dy > h * 0.7) return;
    e.stopImmediatePropagation(); e.stopPropagation();
    edSynth = true;
    try {
      var mk = function (y) { return new Touch({ identifier: d.id, target: d.target, clientX: t.clientX, clientY: y, pageX: t.clientX, pageY: y + scrollY, screenX: t.screenX, screenY: t.screenY - (t.clientY - y) }); };
      var back = mk(d.y);
      d.target.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, composed: true, touches: [back], targetTouches: [back], changedTouches: [back] }));
      d.target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, composed: true, touches: [], targetTouches: [], changedTouches: [back] }));
    } catch (x) { /* ignore */ }
    edSynth = false;
    log('info', '댓글·설명 창 천천히 끌다 놓음 → 제자리 (유튜브 앱처럼, ' + Math.round(dy) + 'px)');
  }, { capture: true, passive: false });

  var FL = null;
  function flSheetOf(target) {
    // 손잡이(≡)·진행 막대를 잡은 끌기는 창 닫기 아님. 음악 탭 아래 창은 스스로 밀어 닫음
    if (target.closest && target.closest('.qd, .pl-hdl, .gm-sheet, #glide-mp')) return null;
    var open = openSheets();
    for (var i = open.length - 1; i >= 0; i--) {
      var el = open[i];
      if (REC && el === REC.el) continue;
      if (GM && el === GM.el) continue;
      if (el.matches && el.matches('.mobile-topbar-header, ytm-search, .fullscreen-controls')) continue;
      if (el.contains(target)) return el;
    }
    return null;
  }
  function flScrolled(target, sheet) {
    for (var e = target; e && e !== sheet.parentNode; e = e.parentElement) {
      if (e.scrollTop > 2 && e.scrollHeight > e.clientHeight + 4) return true;
    }
    return false;
  }
  function flClose(el) {
    if (QU && el === QU.sheet) { quSheetClose(); return; }
    if (REC && el === REC.editor) { recEditorClose(); return; }
    if (el.id === 'glide-rec-menu') { recMenuClose(); return; }
    var b = el.querySelector('button[aria-label="닫기"], button[aria-label="Close"]');
    if (b) { b.click(); return; }
    var scrims = document.querySelectorAll('ytw-scrim, .ytWebScrimHost, .bottom-sheet-overlay, .modal-overlay');
    for (var k = scrims.length - 1; k >= 0; k--) if (scrims[k].getClientRects().length) { scrims[k].click(); return; }
    var cancel = [].filter.call(el.querySelectorAll('button'), function (x) { return /^(취소|Cancel)$/.test((x.textContent || '').trim()); })[0];
    if (cancel) { cancel.click(); return; }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
  }
  // 창이 열렸는데 앱이 아직 '당겨서 새로고침 가능'으로 알고 있으면 아래로 미는 손가락을 앱(새로고침)이 가져가 창이 안 내려가고 목록이 새로고침됐음(실기).
  // 1초마다 알리던 것을 창을 여는 탭 직후·손가락이 닿는 순간에도 바로 알림
  W.addEventListener('click', function () {
    [120, 350, 700].forEach(function (ms) { G.setTimeout.call(W, function () { try { reportPull(); } catch (x) { /* ignore */ } }, ms); });
  }, true);
  document.addEventListener('touchstart', function (e) {
    try { if (lastPull && !pullable()) reportPull(); } catch (x) { /* ignore */ }
    FL = null;
    if (!S().enabled || !onYT() || e.touches.length !== 1 || !e.target || !e.target.closest) return;
    var sheet = flSheetOf(e.target);
    if (!sheet) return;
    var t = e.touches[0];
    FL = { el: sheet, x: t.clientX, y: t.clientY, t: Date.now(), scrolled: flScrolled(e.target, sheet) };
  }, { capture: true, passive: true });
  document.addEventListener('touchmove', function (e) {
    // 밀기 도중 목록이 굴러 내려가 있으면(위로 갔다 내려온 경우) 닫기 아님
    if (FL && !FL.scrolled && e.target && flScrolled(e.target, FL.el)) FL.scrolled = true;
  }, { capture: true, passive: true });
  document.addEventListener('touchend', function (e) {
    var f = FL; FL = null;
    if (!f || f.scrolled || !e.changedTouches[0]) return;
    var t = e.changedTouches[0], dy = t.clientY - f.y, dx = t.clientX - f.x, ms = Date.now() - f.t;
    // 빠른 아래 밀기: 70px 넘게, 0.4px/ms 넘게, 세로 위주
    if (dy < 70 || ms > 600 || dy / Math.max(ms, 1) < 0.4 || Math.abs(dx) > dy * 0.7) return;
    var el = f.el;
    G.setTimeout.call(W, function () {
      if (!el.isConnected || !el.getClientRects().length) return;
      var r = el.getBoundingClientRect();
      if (r.height < 40 || r.top >= innerHeight) return;
      if (openSheets().indexOf(el) < 0) return; // 유튜브가 이미 닫음
      G.send('haptic', { kind: 'gesture' });
      flClose(el);
      lastGeom = ''; G.setTimeout.call(W, function () { lastGeom = ''; reportGeom(); }, 450);
      log('info', '창 아래로 밀기 → 닫음 (' + (el.tagName || '').toLowerCase() + ')');
    }, 300);
  }, { capture: true, passive: true });

  // 홈 탭으로 (유튜브 앱처럼 탭 첫 화면에서 뒤로 가기 = 홈 탭). 아래 메뉴의 홈 칸을 누름 (앱 안 이동, 보던 자리 기억 그대로)
  function goHomeTab() {
    if (location.pathname === '/') return true;
    var items = [].slice.call(document.querySelectorAll('ytm-pivot-bar-item-renderer'));
    var home = items.filter(function (x) { return /^(홈|Home)$/.test(((x.querySelector('.pivot-bar-item-title') || {}).textContent || '').trim()); })[0] || items[0];
    var t = home && (home.querySelector('.pivot-bar-item-tab') || home);
    if (!t) return false;
    t.click();
    return true;
  }
  G.onCommand('goHome', function () { if (role() === 'browse') goHomeTab(); }); // 못 누르면 앱이 0.9초 뒤 홈을 바로 불러옴
  G.onCommand('closeSheet', function () {
    // 앱은 닫기를 보내며 '닫힘'으로 바꿔 둠 → 어떤 갈래로 닫든 지금 상태를 다시 알려야 다음 뒤로 가기가 한 단계씩 감
    // (예전: 고르기 끝·가수 화면에서 돌아가기 뒤에 알리지 않아 다음 뒤로 가기가 두 단계를 한꺼번에 건너뜀)
    lastGeom = '';
    G.setTimeout.call(W, function () { lastGeom = ''; reportGeom(); }, 450);
    if (BR && BR.open) { brClose(); return; } // 전체화면 밝기 바
    if (typeof CMS !== 'undefined' && CMS) { mpCmClose(); return; }
    if (typeof LY !== 'undefined' && LY.el) { lyClose(); return; }
    if (MP && MP.sl) { mpSleepClose(); return; }
    if (QU && QU.sheet) { quSheetClose(); return; }
    if (document.getElementById('glide-rec-menu')) { recMenuClose(); return; }
    if (REC && REC.editor) { recEditorClose(); return; }
    if (REC && REC.open && REC.view !== 'all') { recGo('all'); return; } // 추천의 다른 보기 → 전체 보기 먼저
    if (REC && REC.open) { recClose(); goHomeTab(); return; } // 추천 탭 첫 화면 → 홈 탭
    if (GM && GM.sug) { gmSugClose(); if (GM.input) GM.input.blur(); if (GM.view !== 'search' && GM.input && !GM.input.value) gmSrch(false); return; } // 검색 연관 검색어 목록
    if (GM && GM.open && GM.top && GM.top.classList.contains('srch') && GM.view !== 'search') { gmSrch(false); return; } // 빈 검색 모드
    if (GM && GM.menu) { gmMenuClose(); return; }
    if (GM && GM.open && GM.sel) { gmSelEnd(); return; }
    if (GM && GM.open && GM.stack && GM.stack.length) { gmBack(); return; } // 음악 탭 안의 이전 화면 (장르 상세·검색·가수·플레이리스트)
    if (GM && GM.open && (GM.view === 'artist' || GM.view === 'pl' || GM.view === 'vpl')) { gmArtistBack(); return; }
    // 음악 탭 첫 화면 → 앱 나감 (2026-11-25 사용자: 뒤로 가기가 유튜브 동영상 쪽으로 가면 안 됨, 멜론처럼). 음악 탭은 열어 둔 채라 다시 열면 그대로, 노래는 계속.
    // (예전: 홈 탭으로 → 듣던 노래가 동영상용 작은 플레이어로 떴음)
    if (GM && GM.open) { G.send('leaveApp', {}); return; }
    var open = openSheets();
    // 유튜브 메뉴·대화상자가 다른 창(댓글 등) 위에 떠 있으면 그것부터 (예전: 아래 댓글 창의 닫기를 눌러 메뉴가 남았음)
    var menuSel = '.ytSpecBottomSheetLayoutHost, .menu-container .menu-content, dialog[open]';
    if (open.some(function (x) { try { return x.matches(menuSel); } catch (e) { return false; } }) && open.length > 1) { quCloseMenu(); return; }
    // 전체화면 동영상 더보기 창은 그 위에 다른 창(설정·화질)이 없을 때만 먼저
    var fpOpen = fsPanel();
    if (fpOpen && open.length <= 1 && fsPanelClose()) return; // (닫기 ✕가 창 밖 위 조작부에 있음)
    if (!open.length) { lastGeom = ''; reportGeom(); G.send('backNext', {}); return; } // 이미 닫혀 있음 → 앱이 다음 뒤로 가기 동작을 함
    for (var i = open.length - 1; i >= 0; i--) {
      var b = open[i].querySelector('button[aria-label="닫기"], button[aria-label="Close"], button[aria-label="뒤로"], button[aria-label="Back"]');
      if (b) { b.click(); return; }
    }
    var scrims = document.querySelectorAll('ytw-scrim, .ytWebScrimHost, .bottom-sheet-overlay, .modal-overlay');
    for (var k = scrims.length - 1; k >= 0; k--) if (scrims[k].getClientRects().length) { scrims[k].click(); return; }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
  });
  function reportPull() {
    var p = pullable();
    if (p === lastPull) return;
    lastPull = p;
    G.send("pullable", { on: p });
  }
  W.addEventListener("scroll", function () {
    if (pullTick) return;
    pullTick = true;
    G.setTimeout.call(W, function () { pullTick = false; reportPull(); reportGeom(); }, 80);
  }, { capture: true, passive: true });
  G.onCommand("refresh", function () {
    if (GM && GM.open) { log("info", "당겨서 새로고침 → 음악 목록 다시 받기"); GM.cache = {}; gmRender(); G.setTimeout.call(W, function () { G.send("refreshDone", {}); }, 600); return; }
    if (REC && REC.open) { log("info", "당겨서 새로고침 → 추천 다시 고르기"); recLoad(true); return; }
    log("info", "당겨서 새로고침"); location.reload();
  });

  var lastTheme = null;
  function reportTheme() {
    reportTopbar();
    if (!document.body) return;
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(document.body).color);
    if (!m) return;
    var dark = (+m[1] + +m[2] + +m[3]) / 3 > 128; // 글자색이 밝으면 어두운 테마
    if (dark === lastTheme) return;
    lastTheme = dark;
    G.send('theme', { dark: dark });
  }
  // 유튜브 테마 CSS가 늦게 붙을 수 있어 몇 번 더 확인 (바뀔 때만 알림)
  document.addEventListener('animationstart', function (e) { if (e.animationName === ANIM) [50, 1000, 3000].forEach(function (ms) { G.setTimeout.call(W, reportTheme, ms); }); }, true);
  try { W.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { G.setTimeout.call(W, reportTheme, 300); }); } catch (e) { /* ignore */ }
  W.addEventListener('yt-navigate-finish', function () { [100, 700].forEach(function (ms) { G.setTimeout.call(W, reportTheme, ms); }); }, true);

  // ===========================================================================
  // 영상 코덱: 이 기기에 AV1 하드웨어 디코더가 없으면(앱이 기기에서 확인해 알려 줌) 유튜브가 AV1을 고르지 않게.
  // 소프트웨어 AV1 재생은 화면 끊김·발열·배터리 소모의 흔한 원인. 유튜브 앱도 하드웨어로 재생할 수 있는 코덱을 고름
  // ===========================================================================
  // ===========================================================================
  // 음악 저장: 음악 탭에서 튼 곡의 소리(AAC)를 처음부터 끝까지 빈 곳 없이 다 받으면 앱에 넘겨 이 폰에 보관 (MusicCache.kt)
  //  - 따로 받지 않음: 플레이어가 재생하려고 받은 데이터를 그대로 모음 → 추가 데이터 0
  //  - 음악 재생 중에는 소리 형식을 AAC(MP4)로 고름 (opus 대신. 둘 다 약 128kbps라 음질·데이터 비슷, 폰이 바로 재생할 수 있는 형식)
  //  - 건너뛰기 등으로 빈 곳이 있으면 저장 안 함. 20분 넘는 곡·30MB 넘는 데이터도 저장 안 함
  // ===========================================================================
  var MC = null;
  function mcOn() {
    if (CAP) return false;
    var s = S(); if (!s || !s.enabled) return false;
    var lim = s.musicCacheMB === undefined ? 2048 : +s.musicCacheMB;
    return lim > 0 && !!(G.musicNow && G.musicNow());
  }
  function mcAudioBlock(t) { return typeof t === 'string' && /^audio\//i.test(t) && /webm|opus|vorbis/i.test(t) && mcOn(); }
  function mcVid() { var p = mainPlayer(); try { var d = p && p.getVideoData && p.getVideoData(); return (d && d.video_id) || ''; } catch (e) { return ''; } }
  function mcSong(vid) {
    try { var g = JSON.parse(localStorage.getItem('glide:gm') || 'null'); var it = g && g.items && g.items.filter(function (x) { return x && x.id === vid; })[0]; if (it) return it; } catch (e) { /* ignore */ }
    return { title: (document.title || '').replace(/ - YouTube$/, ''), artist: '' };
  }
  function mcNew(vid) {
    mcCheck(); // 앞 곡이 다 받아졌는데 아직 안 보냈으면 지금
    MC = { vid: vid, init: null, frags: {}, ranges: [], bytes: 0, dur: 0, bad: false, sent: false };
    G.send('mc:touch', { vid: vid }); // 이미 저장된 곡이면 '최근에 들음'으로
  }
  function mcChunk(info, data) {
    if (!mcOn() || G.inAd()) { info.pending = null; info.held = null; return; } // 광고는 저장 안 함
    var vid = mcVid(); if (!vid) return;
    if (!MC || MC.vid !== vid) mcNew(vid);
    if (MC.bad || MC.sent) { info.pending = null; info.held = null; return; }
    boxWalk(info, data, function (type, box) { mcBox(info, type, box); return !MC.bad; });
  }
  function mcBox(info, type, box) {
    if (type === 'ftyp') { info.initHead = box.slice(); return; }
    if (type === 'moov') {
      if (!info.initHead) return;
      var init = concat(info.initHead, box); info.initHead = null;
      if (MC.init && sameBytes(MC.init, init)) { if (!info.ts) readInit(info, init); return; }
      if (MC.init) { MC.frags = {}; MC.ranges = []; MC.bytes = 0; } // 소리 형식이 바뀜 → 새 형식으로 처음부터
      MC.init = init; readInit(info, init);
      return;
    }
    if (!MC.init || !info.ts) return; // 시작 정보 전의 조각은 쓸 수 없음
    if (type === 'moof') { info.held = box.slice(); return; }
    if (type === 'mdat' && info.held) {
      var r = fragRange(info, info.held), fr = concat(info.held, box);
      info.held = null;
      if (!r) return;
      var k = Math.round(r[0] * 1000);
      if (!MC.frags[k]) { MC.frags[k] = fr; MC.bytes += fr.length; }
      addRange(MC.ranges, r[0], r[1]);
      if (MC.bytes > 30 * 1048576) { MC.bad = true; MC.frags = {}; }
    }
  }
  // 다 받았으면 앱에 보냄 (재생 중 2초마다 · 다른 곡으로 넘어갈 때)
  function mcCheck() {
    if (!MC || MC.sent || MC.bad || !MC.init) return;
    var p = mainPlayer();
    if (p && mcVid() === MC.vid) { try { var d = p.getDuration(); if (d > 0) MC.dur = d; } catch (e) { /* ignore */ } }
    var dur = MC.dur, r = MC.ranges;
    if (!(dur > 20 && dur <= 1200)) return;
    if (!(r.length === 1 && r[0][0] <= 0.3 && r[0][1] >= dur - 1.5)) return;
    mcSend(dur);
  }
  function mcPut(u8) {
    if (S().binMsg !== false) { var out = new Uint8Array(u8.length + 1); out[0] = 3; out.set(u8, 1); if (G.sendBinary(out.buffer)) return; }
    for (var off = 0; off < u8.length; off += 262144) {
      var part = u8.subarray(off, Math.min(u8.length, off + 262144)), bin = '';
      for (var i = 0; i < part.length; i += 32768) bin += String.fromCharCode.apply(null, part.subarray(i, i + 32768));
      G.send('mcb64', { d: btoa(bin) });
    }
  }
  function mcSend(dur) {
    var c = MC; c.sent = true;
    var song = mcSong(c.vid), keys = Object.keys(c.frags).map(Number).sort(function (a, b) { return a - b; });
    G.send('mc:begin', { vid: c.vid, title: song.title || '', artist: song.artist || '', duration: dur, bytes: c.bytes });
    mcPut(c.init);
    keys.forEach(function (k) { mcPut(c.frags[k]); });
    G.send('mc:end', { vid: c.vid });
    log('info', '음악 저장: ' + (song.title || c.vid) + ' (' + (c.bytes / 1048576).toFixed(1) + 'MB) → 앱에 보냄');
    c.frags = {};
  }
  (function mcWatch() {
    var last = 0;
    var on = function (e) {
      if (!MC || !e.target || e.target.tagName !== 'VIDEO') return;
      var now = Date.now(); if (e.type === 'timeupdate' && now - last < 2000) return; last = now;
      mcCheck();
    };
    document.addEventListener('timeupdate', on, true);
    document.addEventListener('ended', on, true);
  })();

  var codecs = { video: '' };
  (function codecGuard() {
    var noAv1 = function () { var s = S(); return s.enabled && s.hwAv1 === false; };
    // 오프라인 저장 중에는 폰이 그대로 합칠 수 있는 MP4(H.264 영상 + AAC 소리)만 고르게 함
    var isAv1 = function (t) { return typeof t === 'string' && (/av01/i.test(t) || (!!CAP && /webm|vp0?9|vp8|opus|vorbis|ec-3|ac-3/i.test(t))); };
    try {
      var MS = W.MediaSource;
      if (MS && MS.isTypeSupported) {
        var origIts = MS.isTypeSupported;
        MS.isTypeSupported = G.disguise(function isTypeSupported(t) { if ((isAv1(t) && (noAv1() || CAP)) || mcAudioBlock(t)) return false; return origIts.apply(this, arguments); }, origIts);
      }
      if (MS && MS.prototype.addSourceBuffer) {
        var origAdd = MS.prototype.addSourceBuffer;
        MS.prototype.addSourceBuffer = G.disguise(function addSourceBuffer(t) {
          if (typeof t === 'string' && /^video\//.test(t)) codecs.video = t.replace(/^video\//, '');
          var sb = origAdd.apply(this, arguments);
          if (typeof t === 'string' && /^(video|audio)\//.test(t)) capTag(sb, t.slice(0, 5));
          if (typeof t === 'string' && /^audio\/mp4/i.test(t)) mcInfo.set(sb, { pending: null, held: null, initHead: null, ts: 0, trexDur: 0 });
          return sb;
        }, origAdd);
      }
    } catch (e) { /* ignore */ }
    try {
      var origCpt = HTMLMediaElement.prototype.canPlayType;
      HTMLMediaElement.prototype.canPlayType = G.disguise(function canPlayType(t) { if ((isAv1(t) && (noAv1() || CAP)) || mcAudioBlock(t)) return ''; return origCpt.apply(this, arguments); }, origCpt);
    } catch (e) { /* ignore */ }
    try {
      var mc = navigator.mediaCapabilities;
      if (mc && mc.decodingInfo) {
        var origDi = mc.decodingInfo;
        mc.decodingInfo = G.disguise(function decodingInfo(cfg) {
          var ct = (cfg && cfg.video && cfg.video.contentType) || (cfg && cfg.audio && cfg.audio.contentType);
          if (ct && isAv1(ct) && (noAv1() || CAP)) return Promise.resolve({ supported: false, smooth: false, powerEfficient: false, configuration: cfg });
          return origDi.apply(this, arguments);
        }, origDi);
      }
    } catch (e) { /* ignore */ }
  })();

  // 재생 중 프레임 저하 확인 (20초마다, 화면에 보일 때만): 많이 버려지면 코덱·해상도와 함께 로그로 남김
  var frameTimer = 0, frameLast = null, codecLogged = '';
  function frameCheck() {
    frameTimer = 0;
    var p = mainPlayer(), v = p && p.querySelector('video');
    if (!v || v.paused || !v.getVideoPlaybackQuality) { frameLast = null; return; }
    var q = v.getVideoPlaybackQuality();
    if (frameLast && q.totalVideoFrames > frameLast.total && !document.documentElement.classList.contains('glide-pip')) {
      var total = q.totalVideoFrames - frameLast.total, dropped = q.droppedVideoFrames - frameLast.dropped;
      if (total > 200 && dropped / total > 0.05 && !G.inAd() && !document.documentElement.hasAttribute('data-glide-capture')) {
        log('warn', '영상 프레임 저하: 20초 동안 ' + dropped + '/' + total + '프레임 버림 (' + Math.round(dropped / total * 100) + '%) · 코덱 ' + (codecs.video || '?') + ' · ' + v.videoWidth + 'x' + v.videoHeight + ' · 배속 ' + v.playbackRate + ' · 화면 ' + innerWidth + 'x' + innerHeight + ' · AV1 하드웨어 ' + (S().hwAv1 === false ? '없음' : '있음'));
      }
    }
    frameLast = { total: q.totalVideoFrames, dropped: q.droppedVideoFrames };
    frameTimer = G.setTimeout.call(W, frameCheck, 20000);
  }
  document.addEventListener('playing', function (e) {
    var p = mainPlayer();
    if (!p || !p.contains(e.target) || !onWatch()) return;
    if (codecs.video && codecs.video !== codecLogged) { codecLogged = codecs.video; log('info', '영상 코덱 ' + codecs.video + ' · ' + e.target.videoWidth + 'x' + e.target.videoHeight + (S().hwAv1 === false ? ' (AV1 하드웨어 없음 → AV1 제외)' : '')); }
    if (!frameTimer) { frameLast = null; frameTimer = G.setTimeout.call(W, frameCheck, 3000); }
  }, true);

  // ===========================================================================
  // 화면 속 화면: 플레이어만 꽉 차게. 들어갈 때 상태를 기록해 문제를 찾을 수 있게
  // ===========================================================================
  G.onCommand('pip', function (arg) {
    var on = !!(arg && arg.on);
    document.documentElement.classList.toggle('glide-pip', on);
    G.setTimeout.call(W, ensureLiveChat, 0); // 작은 창에서는 라이브 채팅을 내려 둠
    // 유튜브는 창 크기가 바뀌면 영상 크기를 다시 계산함. 작은 창을 나온 뒤 이 계산이 빠지면 영상이 작은 창 크기로 남음
    // → 들어갈 때·나올 때 모두 몇 번에 걸쳐 크기 변경을 알림
    [0, 120, 400, 1000, 2000].forEach(function (ms) { G.setTimeout.call(W, resized, ms); });
    var report = function (when) {
      var p = mainPlayer(), v = p && p.querySelector('video');
      var r = p ? p.getBoundingClientRect() : null, vr = v ? v.getBoundingClientRect() : null;
      var tf = v ? getComputedStyle(v).transform : '';
      log('info', (on ? 'PIP 화면' : 'PIP 해제 후') + '(' + when + '): 창 ' + innerWidth + 'x' + innerHeight + ', 플레이어 ' + (r ? [r.left, r.top, r.width, r.height].map(Math.round).join(',') : '없음') +
        ', 영상 ' + (vr ? [vr.left, vr.top, vr.width, vr.height].map(Math.round).join(',') : '없음') + (tf && tf !== 'none' ? ', 변형 ' + tf : '') +
        (v ? ', ' + (v.paused ? '멈춤' : '재생') + ', readyState ' + v.readyState : ''));
    };
    G.setTimeout.call(W, function () { report('0.4초'); }, 400);
    G.setTimeout.call(W, function () { report('2초'); if (!on) fixVideoSize(); }, 2000);
  });
  // 작은 창을 나온 뒤에도 영상이 작은 창 크기로 남아 있으면(유튜브가 다시 계산하지 않은 경우) 플레이어에 맞게 직접 맞춤
  function fixVideoSize() {
    var p = mainPlayer(), v = p && p.querySelector('video');
    if (!p || !v || document.documentElement.classList.contains('glide-pip') || !v.videoWidth) return;
    var pr = p.getBoundingClientRect(), vr = v.getBoundingClientRect();
    if (pr.width < 50 || vr.width * vr.height >= pr.width * pr.height * 0.6) return;
    var k = Math.min(pr.width / v.videoWidth, pr.height / v.videoHeight), w = Math.round(v.videoWidth * k), h = Math.round(v.videoHeight * k);
    v.style.width = w + 'px'; v.style.height = h + 'px'; v.style.left = Math.round((pr.width - w) / 2) + 'px'; v.style.top = Math.round((pr.height - h) / 2) + 'px';
    log('info', '작은 창을 나온 뒤 영상 크기를 플레이어에 맞춤 (' + Math.round(vr.width) + 'x' + Math.round(vr.height) + ' → ' + w + 'x' + h + ')');
  }
  // ===========================================================================
  // 웹뷰 2개 (1.6+ 앱): 앱이 영상 전용 웹뷰(role 'player')와 둘러보기 웹뷰(role 'browse')를 따로 띄움.
  // 모바일 유튜브는 영상 화면을 떠나면 영상이 끊기므로, 영상은 영상 웹뷰에서만 열고 나머지는 둘러보기 웹뷰에서 엶.
  // → 앱이 영상 웹뷰를 오른쪽 아래로 작게 줄여(앱 안 작은 플레이어) 둘러보는 동안에도 영상이 계속 나옴 (유튜브 앱과 같은 구조)
  // 예전 앱(role 없음)에서는 아무것도 하지 않음
  // ===========================================================================
  function role() { return S().role || ''; }
  function ytUrl(href) {
    var u;
    try { u = new URL(href, location.href); } catch (e) { return null; }
    if (!/(^|\.)youtube\.com$/.test(u.hostname) || u.hostname === 'music.youtube.com') return null;
    return u;
  }
  // 영상 열기 움직임(1.9.1, 유튜브 앱처럼 누른 썸네일 자리에서 영상 화면이 올라옴)용: 누른 항목의 썸네일 위치(CSS px)·제목
  function openFrom(a) {
    try {
      var sel = typeof PRESS_SEL === 'string' ? PRESS_SEL : 'yt-lockup-view-model, ytm-video-with-context-renderer, ytm-compact-video-renderer, .gr-card';
      var it = a.closest(sel) || a;
      var th = it.querySelector('yt-thumbnail-view-model, .media-item-thumbnail-container, ytm-thumbnail-cover, .gr-thumb, img') || a;
      var r = th.getBoundingClientRect();
      if (r.width < 60 || r.height < 30 || r.bottom < 0 || r.top > innerHeight) return null;
      var tt = it.querySelector('h3, h4, .media-item-headline, .gr-t, [role="heading"]');
      return { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], iw: innerWidth, title: tt ? tt.textContent.replace(/\s+/g, ' ').trim().slice(0, 200) : '' };
    } catch (e) { return null; }
  }
  function stopAll(e) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }
  // 링크 누름을 유튜브보다 먼저 봄 (window 캡처 단계)
  W.addEventListener('click', function (e) {
    var r = role();
    if (!r || !onYT() || Date.now() < swallowUntil) return;
    var t = e.target;
    if (!t || !t.closest) return;
    var a = t.closest('a[href]');
    if (a && a.hasAttribute('data-glide-nav')) return; // 앱이 시킨 이동
    if (t.closest('.gr-more')) return; // 추천 탭 카드의 ⋮ (카드 링크 안에 있음 — 버튼이 기본 동작을 막음)
    if (r === 'player' && !a) {
      // 영상 화면 상단 바의 유튜브 로고·검색 → 둘러보기 화면에서 (영상은 작은 플레이어로 계속)
      var hb = t.closest('header button');
      if (hb && hb.classList.contains('mobile-topbar-header-endpoint')) { stopAll(e); G.send('openBrowse', { url: location.origin + '/' }); return; }
      if (hb && hb.classList.contains('topbar-button-search-button')) { stopAll(e); G.send('openBrowse', { search: true }); return; }
    }
    if (!a || a.target === '_blank') return;
    var u = ytUrl(a.getAttribute('href'));
    if (!u || u.pathname === '/redirect') return;
    var lv = liveWatchUrl(u);
    if (lv) { stopAll(e); if (r === 'browse') G.send('openVideo', { url: lv, from: openFrom(a) }); else navigateTo(lv); return; }
    if (r === 'browse' && u.pathname === '/watch') { stopAll(e); G.send('openVideo', { url: u.href, from: openFrom(a) }); }
    else if (r === 'player' && u.pathname !== '/watch') { stopAll(e); G.send('openBrowse', { url: u.href }); }
  }, true);

  // ===========================================================================
  // 시청 기록은 지문 뒤로 (2026-11-21, 사용자: "기록은 계속 저장되되, 개인정보니까 내 지문이 있어야만 볼 수 있게").
  // 유튜브 계정 기록은 사용자가 꺼 둠(10월 27일까지만 있음) → 기록은 Glide가 이 폰에 남기고(HistoryActivity), 유튜브의 기록 입구는 그리로 보냄:
  //  - '내 페이지'의 기록 칸(썸네일이 그대로 보여 남이 볼 수 있음)은 숨기고 그 자리에 '시청 기록 · 지문으로 열기' 줄
  //  - 기록 링크(/feed/history)를 누르거나 그 주소로 가면 → 앱이 지문 확인 뒤 Glide 시청 기록
  // ===========================================================================
  var HI = { at: 0, row: null };
  function hiOpen(why) {
    if (Date.now() - HI.at < 1500) return;
    HI.at = Date.now();
    G.send('openHistory', {});
    log('info', '시청 기록 → Glide 시청 기록(지문) · ' + why);
  }
  W.addEventListener('click', function (e) {
    if (role() !== 'browse' || !onYT() || !e.target || !e.target.closest) return;
    if (e.target.closest('#glide-hist-row')) { stopAll(e); hiOpen('내 페이지 줄'); return; }
    var a = e.target.closest('a[href]');
    var u = a && ytUrl(a.getAttribute('href'));
    if (u && /^\/feed\/history/.test(u.pathname)) { stopAll(e); hiOpen('기록 링크'); }
  }, true);
  function hiSection(link) {
    // 기록 링크에서 위로: 영상 링크를 품은 가장 가까운 칸 (내 페이지의 '기록' 가로 줄)
    var el = link;
    for (var i = 0; i < 8 && el && el.parentElement && el.parentElement !== document.body; i++) {
      el = el.parentElement;
      if (el.querySelector('a[href*="watch?v="], a[href*="/shorts/"]')) return el;
    }
    return null;
  }
  function hiTick() {
    if (role() !== 'browse' || !onYT()) return;
    var p = location.pathname;
    if (/^\/feed\/history/.test(p)) {
      // 링크가 아닌 길(유튜브 버튼·주소)로 들어온 경우: 유튜브 기록 화면을 보이지 않고 되돌린 뒤 Glide 기록을 엶
      document.documentElement.classList.add('glide-hist-away');
      if (Date.now() - (HI.backAt || 0) > 1500) { HI.backAt = Date.now(); if (history.length > 1) history.back(); else location.replace(location.origin + '/'); }
      hiOpen('기록 주소');
      return;
    }
    document.documentElement.classList.remove('glide-hist-away');
    if (!/^\/feed\/(you|library)/.test(p)) return;
    var links = [].slice.call(document.querySelectorAll('a[href^="/feed/history"]'));
    // 새 내 페이지(2026-11-26 사용자 제보: 기록 줄이 다시 보임)는 '모두 보기'가 링크가 아니라 버튼이라 링크로 못 찾음 → 줄 제목 '기록'/'History' 글자로도 찾음
    [].forEach.call(document.querySelectorAll('h2, h3, [role=heading], .yt-core-attributed-string, ytm-shelf-header-layout span, yt-section-header-view-model span'), function (h) { if (h.closest('[data-glide]')) return; if (h.children.length === 0 && /^(기록|시청 기록|History|Watch history)$/.test((h.textContent || '').trim())) links.push(h); });
    for (var i = 0; i < links.length; i++) {
      var sec = hiSection(links[i]);
      if (!sec || sec.getAttribute('data-glide-fb')) continue;
      sec.setAttribute('data-glide-fb', '1'); // 숨김 (관심 없음과 같은 표시)
      if (!HI.row || !HI.row.isConnected) {
        HI.row = G.el('button', { id: 'glide-hist-row', type: 'button', 'data-glide': 'hist', style: 'all:unset;box-sizing:border-box;display:flex;align-items:center;gap:12px;width:calc(100% - 24px);margin:8px 12px;padding:14px 16px;border-radius:12px;' +
          'background:var(--yt-spec-badge-chip-background,rgba(127,127,127,.12));color:inherit;font:500 15px/1.3 Roboto,"Noto Sans KR",sans-serif;cursor:pointer;pointer-events:auto' },
          [G.el('span', { text: '🔒', style: 'font-size:18px' }), G.el('span', { text: '시청 기록', style: 'flex:1;font-weight:600' }), G.el('span', { text: '지문으로 열기 ›', style: 'opacity:.7;font-size:13px' })]);
      }
      sec.parentNode.insertBefore(HI.row, sec);
    }
  }
  (function hiLoop() { try { hiTick(); } catch (e) { /* ignore */ } G.setTimeout.call(W, hiLoop, 300); })();
  // ===========================================================================
  // 스피커 모드 (2026-11-21 사용자 요청): 전체화면 ⚙ 설정 메뉴(유튜브 player-settings-menu)에 '스피커 모드 (소리만)'.
  // 누르면 앱이 작은 창 없이 뒤로 가고 소리만 계속 (PIP의 🎧와 같은 이어폰 모드). 알림을 누르면 돌아옴
  // ===========================================================================
  function spkTick() {
    if (role() !== 'player' || !onWatch()) return;
    var menu = document.querySelector('player-settings-menu');
    if (!menu || menu.querySelector('#glide-spk') || !menu.getClientRects().length) return;
    var rows = menu.querySelectorAll('yt-list-item-view-model');
    if (!rows.length) return;
    var tpl = null;
    for (var i = 0; i < rows.length; i++) if (/^(속도|Playback speed)/.test((rows[i].textContent || '').trim())) { tpl = rows[i]; break; }
    tpl = tpl || rows[rows.length - 1];
    var c = tpl.cloneNode(true);
    c.id = 'glide-spk';
    var leaves = [].filter.call(c.querySelectorAll('*'), function (x) { return !x.children.length && (x.textContent || '').trim(); });
    if (!leaves.length) return;
    leaves[0].textContent = '스피커 모드';
    for (var j = 1; j < leaves.length; j++) leaves[j].textContent = j === 1 ? '소리만' : '';
    var ic = c.querySelector('c3-icon, yt-icon');
    if (ic) { while (ic.firstChild) ic.removeChild(ic.firstChild); ic.appendChild(G.el('i', { 'class': 'glide-spk' })); }
    [].forEach.call(c.querySelectorAll('[aria-label]'), function (x) { x.setAttribute('aria-label', '스피커 모드'); });
    c.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      G.send('haptic', { kind: 'gesture' });
      try { quCloseMenu(); } catch (x) { /* ignore */ }
      G.send('audioOnly', {});
      log('info', '스피커 모드: 소리만 계속 (전체화면 설정)');
    }, true);
    // 맨 위에: 첫 항목은 스위치 칸(switch-list-item-view-model) 안에 있으므로 메뉴 바로 아래 칸을 찾아 그 앞에
    var first = rows[0];
    while (first && first.parentNode !== tpl.parentNode) first = first.parentNode;
    tpl.parentNode.insertBefore(c, first || tpl);
  }
  (function spkLoop() { try { spkTick(); } catch (e) { /* ignore */ } G.setTimeout.call(W, spkLoop, 300); })();

  // 라이브 공유 주소 /live/영상ID → /watch?v=영상ID. 유튜브도 연 뒤에 이렇게 바꾸지만, 그 전에 둘러보기 화면에서 열려 한 번 돌아 들어왔음
  function liveWatchUrl(u) {
    var m = /^\/live\/([\w-]{11})\/?$/.exec(u.pathname);
    if (!m) return null;
    var q = new URLSearchParams(u.search);
    q.delete('v');
    var rest = q.toString();
    return u.origin + '/watch?v=' + m[1] + (rest ? '&' + rest : '');
  }

  // 화면을 새로 불러오지 않고 이동 (유튜브 앱 안 이동과 같음. 빠르고 로그인·재생 상태 유지): 문서 안 링크를 만들어 누름
  function navigateTo(href) {
    var u = ytUrl(href);
    if (!u) return;
    if (role() === 'player' && u.pathname === '/watch' && MP.on) { var nv = u.searchParams.get('v'); if (nv) { LM.want = null; if (LM.el) lmStop(); G.send('musicNav', { vid: nv }); } }
    var a = document.createElement('a');
    a.href = u.pathname + u.search + u.hash;
    a.setAttribute('data-glide-nav', '1');
    a.style.display = 'none';
    (document.querySelector('ytm-app') || document.body || document.documentElement).appendChild(a);
    a.click();
    G.setTimeout.call(W, function () { if (a.parentNode) a.parentNode.removeChild(a); }, 0);
  }
  // 앱 → 페이지 이동
  G.onCommand('navigate', function (arg) { if (arg && arg.url) navigateTo(arg.url); });

  // 채널 라이브 주소(/@채널/live 등)는 주소에 영상 ID가 없어 둘러보기 화면에서 그대로 영상 화면이 열림 (주소도 안 바뀜, 1.6.0 폴드5 실기).
  // 플레이어가 라이브 영상을 알게 되면 영상 칸으로 넘기고, 앱이 둘러보기를 이전 화면으로 되돌림 (leave)
  var CHANNEL_LIVE = /^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/live\/?$/;
  var liveHandedOff = '';
  function channelLiveHandoff() {
    if (liveHandedOff && liveHandedOff !== location.href) liveHandedOff = ''; // 다른 화면으로 가면 풂 (같은 채널 라이브를 두 번째로 열면 안 넘겼음 — 전수조사 반영)
    if (role() !== 'browse' || !onYT() || !CHANNEL_LIVE.test(location.pathname) || liveHandedOff === location.href) return;
    var p = mainPlayer(), d = null;
    try { d = p && p.getVideoData && p.getVideoData(); } catch (e) { return; }
    // 라이브인 것이 확실할 때만 (방송이 없는 채널은 다른 화면이 뜸 → 그대로 둠)
    if (!d || !d.isLive || !/^[\w-]{11}$/.test(d.video_id || '')) return;
    liveHandedOff = location.href;
    var vs = document.querySelectorAll('video');
    for (var i = 0; i < vs.length; i++) if (!vs[i].paused) vs[i].pause();
    log('info', '채널 라이브 주소 → 영상 칸에서 엶 [' + d.video_id + ']');
    G.send('openVideo', { url: location.origin + '/watch?v=' + d.video_id, leave: true });
  }
  (function liveLoop() {
    try { channelLiveHandoff(); } catch (e) { /* ignore */ }
    G.setTimeout.call(W, liveLoop, CHANNEL_LIVE.test(location.pathname) ? 500 : 2000);
  })();
  // 둘러보기 화면: 영상 화면에서 누른 검색을 여기서 엶
  G.onCommand('openSearch', function () {
    var b = document.querySelector('header button.topbar-button-search-button') || document.querySelector('header button[aria-label="YouTube 검색"]');
    if (b) b.click();
    G.setTimeout.call(W, function () { lastGeom = ''; reportGeom(); }, 400); // 검색창이 열린 것을 앱에 바로 알림 (뒤로 가기로 닫게)
  });

  // 둘러보기 화면: 영상 칸(펼침·작은 플레이어)이 떠 있는 동안 피드 미리보기(소리 없는 자동 재생)를 멈춤.
  // 영상 두 개가 함께 돌면 화면을 매 프레임 두 번 그려 작은 플레이어가 끊겼음 (폴드5 실기 측정). 쇼츠·뮤직은 사용자가 보는 것이라 그대로
  // 영상 화면 웹뷰: 영상 칸이 숨겨진 동안(앱이 off를 보냄) 어떤 영상도 재생하지 않음.
  // 웹뷰를 숨겨도(INVISIBLE) 웹 엔진은 숨긴 뒤 새로 시작하는 재생을 소리까지 그대로 둠 (1.6.1 폴드5 실기: 미리 띄운 홈의 미리보기가 화면 밖에서 돌고,
  // 닫은 뒤 늦게 뜬 영상이 소리와 함께 자동 재생됐음)
  var NOPREVIEW = false;
  function previewTarget() {
    if (!onYT()) return false;
    if (role() === 'player') return true;
    return role() === 'browse' && location.pathname.indexOf('/shorts/') !== 0;
  }
  G.onCommand('previews', function (arg) {
    NOPREVIEW = !(arg && arg.on);
    if (!NOPREVIEW || !previewTarget()) return;
    var vs = document.querySelectorAll('video');
    for (var i = 0; i < vs.length; i++) if (!vs[i].paused) vs[i].pause();
  });
  document.addEventListener('playing', function (e) {
    if (!NOPREVIEW || !previewTarget()) return;
    var v = e.target;
    if (v && typeof v.pause === 'function') v.pause();
  }, true);

  // 영상 웹뷰: 플레이어 위치를 앱에 알림 (앱이 손가락을 따라 영상을 줄이고 늘릴 때, 어디를 잡으면 작게 할지 정함)
  var lastGeom = '';
  // 전체화면에서 손가락이 닿으면 지금 상태(창 열림·전체화면)를 바로 다시 알림: 앱은 손가락이 조금 움직인 순간 이 값으로 끌기를 다시 판단함.
  // (드물게 앱이 '창 없음·전체화면 아님'으로 잘못 알고 동영상 더보기 창 끌기를 가져가 전체화면이 풀리고 가운데 영상이 됐음 — 폴드2 실기 2026-11-25)
  W.addEventListener('touchstart', function () { if (role() === 'player' && inFull()) { lastGeom = ''; try { reportGeom(); } catch (e) { /* ignore */ } } }, { capture: true, passive: true });
  function reportGeom() {
    if (!role()) return;
    var a = role() === 'player' && onWatch() && !inFull() ? playerArea() : null;
    // 음악 재생 화면이 떠 있으면 앨범 그림이 '플레이어 칸' (작은 플레이어에 그 그림만, 펼치면 그 자리에서 커짐)
    if (a && MP && MP.on && MP.el && !MP.el.hidden && MP.img && MP.img.getBoundingClientRect().width > 40) a = MP.img;
    var r = a ? a.getBoundingClientRect() : null;
    var rect = r && r.width > 0 && r.height > 0 ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null;
    var sheet = anySheet() || !!(MP && MP.el && !MP.el.hidden) || !!(BR && BR.open);
    var top = ((W.scrollY || (document.scrollingElement && document.scrollingElement.scrollTop) || 0) <= 0);
    // 라이브 채팅 칸: 앱은 이 안에서 아래로 끌어도 영상을 작게 만들지 않음 (지난 채팅을 보려는 손동작). CHAT은 아래에서 선언(첫 호출 때는 아직 없음)
    var chat = null;
    if (CHAT && CHAT.frame && CHAT.frame.isConnected) {
      var fr = CHAT.frame.getBoundingClientRect();
      if (fr.width > 0 && fr.height > 0) chat = [Math.round(fr.left), Math.round(fr.top), Math.round(fr.width), Math.round(fr.height)];
    }
    // 음악 탭의 아래 창(곡 메뉴·담기 등)이 떠 있음: 앱이 작은 플레이어를 잠깐 숨김 (창 아래쪽을 가리지 않게)
    var pop = role() === 'browse' && (!!(GM && GM.menu) || !!document.getElementById('glide-rec-menu') || !!(REC && REC.editor) || openSheets().some(function (x) { return !(x.matches && x.matches('.mobile-topbar-header, ytm-search, #glide-rec, #glide-music')); }));
    // 추천 설정 창·유튜브 ⋮ 메뉴 같은 둘러보기 창도: 작은 플레이어가 창 위에 겹쳐 메뉴 항목을 가렸음 (폴드2 실기 2026-11-25. 유튜브 앱은 창이 맨 위). 검색 중 상단 바는 창이 아님
    var np = role() === 'browse' && !!(GM && GM.open && NP && NP.shown && npActive());
    var gmo = role() === 'browse' && !!(GM && GM.open);
    var hold = role() === 'player' && !!((typeof LY !== 'undefined' && LY.el) || (MP && MP.sl) || (typeof CMS !== 'undefined' && CMS));
    var full = role() === 'player' && inFull();
    var sig = JSON.stringify([rect, innerWidth, innerHeight, sheet, top, chat, pop, hold, np, gmo, full]);
    if (sig === lastGeom) return;
    lastGeom = sig;
    G.send('geom', { rect: rect, iw: innerWidth, ih: innerHeight, sheet: sheet, top: top, chat: chat, pop: pop, hold: hold, np: np, gm: gmo, full: full });
  }
  // 누른 뒤 열리는 창(댓글·설명·메뉴)을 앱이 빨리 알게: 창이 열린 직후 아래로 끌면 창 대신 영상이 작아졌음
  W.addEventListener('click', function () { [350, 900].forEach(function (ms) { G.setTimeout.call(W, reportGeom, ms); }); }, true);
  W.addEventListener('resize', function () { G.setTimeout.call(W, reportGeom, 120); }, true);
  W.addEventListener('yt-navigate-finish', function () { G.setTimeout.call(W, reportGeom, 300); }, true);
  document.addEventListener('touchstart', function () { reportGeom(); }, { capture: true, passive: true });
  // 누른 뒤 유튜브 창(설정 메뉴 등)이 열리면 바로 알림: 앱이 가운데 영상을 풀어 창이 보이게 하고, 뒤로 가기가 그 창부터 닫게
  document.addEventListener('click', function () { G.setTimeout.call(W, reportGeom, 250); G.setTimeout.call(W, reportGeom, 700); }, { capture: true, passive: true });
  document.addEventListener('playing', function () { reportGeom(); }, true);
  W.addEventListener('glide:fullstate', function () { G.setTimeout.call(W, reportGeom, 300); });
  // ===========================================================================
  // 라이브 채팅: 모바일 유튜브 웹에는 채팅이 없어서, 유튜브 채팅 화면(www.youtube.com/live_chat)을 영상 정보 바로 아래 칸에 붙임.
  // 로그인된 채로 채팅 입력까지 됨 (폴드5 실기 확인). 칸은 맨 위에서 화면의 남은 부분을 채움 (유튜브 앱처럼). '숨기기'로 접을 수 있음.
  // 앱이 화면 밖(화면 꺼짐·다른 앱)·작은 창(PIP)·전체화면·앱 안 작은 플레이어이면 채팅을 내려 둠 (배터리·데이터)
  // 채팅 프레임은 주소를 바꾸지 않고 없앴다가 새로 만듦: 주소를 about:blank ↔ 채팅으로 바꿀 때마다 방문 기록이 쌓여
  // 뒤로 가기(history.back·웹뷰 goBack)가 채팅 프레임만 되돌릴 수 있었음 (1.6.0 폴드5 실기: 숨기기·보기 한 번에 기록 3 → 5)
  // ===========================================================================
  var CHAT = { el: null, frame: null, btn: null, vid: null, hidden: false };
  var chatStyle = null;
  // 앱이 알려 주는 영상 칸 상태 ('expanded' | 'mini' | 'hidden'). 예전 앱은 알리지 않음 → ''
  var SHEETMODE = '';
  // 작은 플레이어에서는 유튜브 조작부(CC·설정·시간·큰 재생 버튼)를 숨김: 유튜브 앱의 작은 플레이어는 영상만 보임. 조작은 앱의 ⏸·✕ 층이 함 (폴드2 실기, 2026-11-25)
  G.onCommand('sheetMode', function (arg) { SHEETMODE = (arg && arg.mode) || ''; try { document.documentElement.classList.toggle('glide-mini', SHEETMODE === 'mini'); } catch (e) { /* ignore */ } G.setTimeout.call(W, ensureLiveChat, 0); if (SHEETMODE !== 'expanded' && QU && QU.sheet) quSheetClose(); });
  function liveVideoId() {
    if (!onWatch() || A.liveChat === false) return null;
    var p = mainPlayer(), vd = null;
    try { vd = p && p.getVideoData && p.getVideoData(); } catch (e) { return null; }
    if (!vd || !vd.isLive || !vd.video_id) return null;
    var id = new URLSearchParams(location.search).get('v');
    return id && id === vd.video_id ? id : null;
  }
  function chatActive() { return APPVIS && !CHAT.hidden && SHEETMODE !== 'mini' && SHEETMODE !== 'hidden' && !document.documentElement.classList.contains('glide-pip') && !inFull(); }
  function chatCss() {
    if (chatStyle) return;
    chatStyle = document.createElement('style');
    chatStyle.setAttribute('data-glide', 'chat');
    chatStyle.textContent =
      '#glide-chat{border-top:1px solid rgba(128,128,128,.22)}' +
      '#glide-chat .glide-chat-bar{display:flex;align-items:center;justify-content:space-between;height:44px;padding:0 10px 0 16px;box-sizing:border-box;' +
      'font:500 15px/1.2 Roboto,"Noto Sans KR",sans-serif;color:var(--yt-spec-text-primary,currentColor)}' +
      '#glide-chat .glide-chat-toggle{all:unset;pointer-events:auto;cursor:pointer;padding:8px 14px;border-radius:18px;background:rgba(128,128,128,.16);font:500 13px/1 Roboto,"Noto Sans KR",sans-serif;color:inherit}' +
      '#glide-chat .glide-chat-frame{display:block;width:100%;border:0;background:transparent}' +
      '#glide-chat.glide-chat-hidden .glide-chat-frame{display:none}' +
      'html.glide-pip #glide-chat,html.glide-full #glide-chat{display:none!important}';
    (document.head || document.documentElement).appendChild(chatStyle);
  }
  function chatRemove() {
    if (CHAT.el && CHAT.el.parentNode) CHAT.el.parentNode.removeChild(CHAT.el);
    CHAT.el = CHAT.frame = CHAT.btn = null;
    CHAT.vid = null;
  }
  function chatBuild(id, meta) {
    chatCss();
    var box = document.createElement('div');
    box.id = 'glide-chat';
    var bar = document.createElement('div');
    bar.className = 'glide-chat-bar';
    var label = document.createElement('span');
    label.textContent = '실시간 채팅';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'glide-chat-toggle';
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      CHAT.hidden = !CHAT.hidden;
      ensureLiveChat();
    }, true);
    bar.appendChild(label); bar.appendChild(btn);
    box.appendChild(bar);
    meta.parentNode.insertBefore(box, meta.nextSibling);
    CHAT.el = box; CHAT.frame = null; CHAT.btn = btn; CHAT.vid = id;
    log('info', '라이브 채팅 칸을 붙임 [' + id + ']');
  }
  // 채팅 프레임 넣기·빼기. 주소는 붙이기 전에 정해 둠 (새 프레임의 첫 주소는 방문 기록을 늘리지 않음)
  function chatFrame(src, h) {
    if (CHAT.frame && (!src || CHAT.frame.getAttribute('src') !== src || !CHAT.frame.isConnected)) {
      if (CHAT.frame.parentNode) CHAT.frame.parentNode.removeChild(CHAT.frame);
      CHAT.frame = null;
      lastGeom = ''; G.setTimeout.call(W, reportGeom, 0);
    }
    if (!src || CHAT.frame) return;
    var frame = document.createElement('iframe');
    frame.className = 'glide-chat-frame';
    frame.setAttribute('title', '실시간 채팅');
    frame.setAttribute('allow', 'clipboard-write');
    frame.style.height = h + 'px';
    frame.setAttribute('src', src);
    CHAT.el.appendChild(frame);
    CHAT.frame = frame;
    G.setTimeout.call(W, reportGeom, 300);
  }
  function ensureLiveChat() {
    if (!role()) return; // 웹뷰 2개 앱(1.6+)에서만: 예전 앱은 채팅 프레임 안의 스크립트 메시지를 거르지 않았음
    var id = liveVideoId();
    if (CHAT.el && (CHAT.vid !== id || !CHAT.el.isConnected)) chatRemove();
    if (!id) return;
    var meta = document.querySelector('ytm-slim-video-metadata-section-renderer');
    if (!meta || !meta.parentNode) return;
    if (!CHAT.el) chatBuild(id, meta);
    CHAT.el.classList.toggle('glide-chat-hidden', CHAT.hidden);
    CHAT.btn.textContent = CHAT.hidden ? '채팅 보기' : '숨기기';
    // 높이: 페이지 맨 위에서 볼 때 이 칸이 화면 아래 끝까지 오게 (작아도 320px)
    var top = CHAT.el.getBoundingClientRect().top + (W.scrollY || 0);
    var h = Math.max(320, Math.round(innerHeight - top - 44));
    chatFrame(chatActive() ? 'https://www.youtube.com/live_chat?v=' + encodeURIComponent(id) + '&embed_domain=' + location.hostname : null, h);
    if (CHAT.frame && CHAT.frame.style.height !== h + 'px') CHAT.frame.style.height = h + 'px';
  }
  (function chatLoop() {
    try { ensureLiveChat(); } catch (e) { /* ignore */ }
    G.setTimeout.call(W, chatLoop, onWatch() ? 1500 : 3000);
  })();
  W.addEventListener('glide:fullstate', function () { G.setTimeout.call(W, ensureLiveChat, 0); });
  W.addEventListener('resize', function () { G.setTimeout.call(W, ensureLiveChat, 200); }, true);

  // ===========================================================================
  // 댓글 정렬 (1.8.2, 영상 웹뷰): 유튜브 앱처럼 댓글 창 위에 '인기순 · 최신순'
  // 모바일 웹은 정렬 메뉴도 데이터도 주지 않음(실기 2026-11-20: 댓글 next 응답에 sort 항목 없음). 대신 댓글 첫 쪽 요청의
  // continuation 토큰(protobuf) 안 '영상 ID(필드 4) 다음 필드 6'이 정렬(0 인기, 1 최신)이라, 보낼 때 1로 바꾸면 최신순이 옴(실기 확인).
  // 모바일 웹은 댓글 창을 닫으면 창을 지우고 열 때마다 첫 쪽을 새로 받음 → 칩을 누르면 닫았다가 다시 열어 새로 받음(영상은 그대로).
  // 같은 주소로 다시 이동하는 방법은 영상이 처음부터 다시 재생돼서 안 씀. 다음 쪽 토큰은 서버가 정렬을 담아 주므로 첫 쪽만 바꿈. 영상이 바뀌면 인기순
  // ===========================================================================
  var CS = { sort: 'top', vid: null, obs: null, pc: null, busy: false };
  function csFlip(tok) {
    var std = /[+/]/.test(tok), pad = /%3D/i.test(tok) ? '%3D' : (/=/.test(tok) ? '=' : '');
    var bin = atob(decodeURIComponent(tok).replace(/-/g, '+').replace(/_/g, '/'));
    if (bin.indexOf('engagement-panel-comments-section') < 0 || bin.indexOf('comment-replies') >= 0) return null;
    var vid = CS.vid;
    for (var i = 0; i + 14 < bin.length; i++) {
      // 0x22 0x0b = 필드 4(길이 11: 영상 ID), 0x30 = 필드 6(정수)
      if (bin.charCodeAt(i) !== 0x22 || bin.charCodeAt(i + 1) !== 0x0b || bin.charCodeAt(i + 13) !== 0x30) continue;
      if (vid && bin.substr(i + 2, 11) !== vid) continue;
      if (bin.charCodeAt(i + 14) !== 0) return null;
      var out = btoa(bin.slice(0, i + 14) + '\x01' + bin.slice(i + 15));
      if (!std) out = out.replace(/\+/g, '-').replace(/\//g, '_');
      return out.replace(/=/g, pad);
    }
    return null;
  }
  (function hookCommentSort() {
    var prev = JSON.stringify;
    try {
      JSON.stringify = G.disguise(function stringify(value) {
        if (CS.sort === 'new' && value && typeof value === 'object' && typeof value.continuation === 'string' && value.context) {
          try {
            var nt = csFlip(value.continuation);
            if (nt) {
              var args = Array.prototype.slice.call(arguments);
              args[0] = Object.assign({}, value, { continuation: nt }); // 유튜브가 가진 원본 객체는 그대로
              log('info', '댓글 최신순으로 요청');
              return prev.apply(this, args);
            }
          } catch (e) { /* 토큰 모양이 다르면 그대로 보냄 */ }
        }
        return prev.apply(this, arguments);
      }, prev);
    } catch (e) { /* ignore */ }
  })();
  // 댓글 👍·👎·💬 (2026-11-22 사용자: "추천·비추천 누르면 그 기능만 돼야 하는데 팝업이 떠. 유튜브 앱은 안 그래"):
  // 모바일 웹 새 댓글은 아이콘이 그림이고 댓글 전체가 버튼이라 어디를 눌러도 메뉴(답글·좋아요·싫어요·신고)가 뜸 (폰 확인) →
  // 아이콘 근처를 누르면 메뉴를 보이지 않게 열고 같은 이름의 항목을 대신 누름. 아이콘이 아닌 곳은 그대로 메뉴
  var CMA = { want: null };
  W.addEventListener('click', function (e) {
    if (role() !== 'player' || !S().enabled || CMA.want) return;
    var c = e.target && e.target.closest && e.target.closest('ytm-engagement-panel .YtmCommentRendererContent');
    if (!c) return;
    var icons = c.querySelectorAll('.YtmCommentRendererActionIcon');
    if (icons.length < 2) return;
    var x = e.clientX, y = e.clientY, best = -1, bd = 1e9;
    var first = icons[0].getBoundingClientRect(), last = icons[Math.min(2, icons.length - 1)].getBoundingClientRect();
    if (Math.abs(y - (first.top + first.height / 2)) > 22 || x < first.left - 24 || x > last.right + 24) return;
    for (var i = 0; i < icons.length && i < 3; i++) { var r = icons[i].getBoundingClientRect(), d = Math.abs(x - (r.left + r.width / 2)); if (i === 0 && x > r.right && x < r.right + 26) d = 0; if (d < bd) { bd = d; best = i; } }
    if (best < 0) return;
    CMA.want = ['좋아요', '싫어요', '답글'][best];
    document.documentElement.classList.add('glide-cmauto');
    var n = 0;
    (function tick() {
      var items = document.querySelectorAll('bottom-sheet-container ytm-menu-item, bottom-sheet-container yt-list-item-view-model'); // 폰: ytm-toggle-menu-service-item-renderer > ytm-menu-item > button.menu-item-button
      // 앞서 닫힌 메뉴가 문서에 남아 있음(폰: bottom-sheet-container 2개) → 화면에 그려진 것 중 마지막(방금 연 메뉴)
      var cand = [].filter.call(items, function (x) { return (x.textContent || '').trim().indexOf(CMA.want) === 0 && x.getBoundingClientRect().height > 0; }), it = cand[cand.length - 1];
      if (it) {
        (it.querySelector('button.menu-item-button, button, [role=button], a') || it).click();
        G.send('haptic', { kind: 'gesture' });
        log('info', '댓글 ' + CMA.want + ' (메뉴 없이)');
        CMA.want = null;
        G.setTimeout.call(W, function () { document.documentElement.classList.remove('glide-cmauto'); }, 400);
        return;
      }
      if (n++ > 50) { CMA.want = null; document.documentElement.classList.remove('glide-cmauto'); return; } // 메뉴를 못 찾으면 보이게 (1.5초)
      G.setTimeout.call(W, tick, 30);
    })();
  }, true);
  function csPanel() { var s = document.querySelector('ytm-engagement-panel .engagement-panel-comments-section'); return s && s.closest('ytm-engagement-panel'); }
  function csChip(k, label) {
    var b = G.el('button', { type: 'button', 'data-sort': k, text: label });
    b.addEventListener('click', function (e) { e.stopPropagation(); csPick(k); });
    return b;
  }
  function csEnsure() {
    if (role() !== 'player' || !S().enabled || !onWatch()) return;
    var vid = G.currentVideoId && G.currentVideoId();
    if (vid !== CS.vid) { CS.vid = vid; CS.sort = 'top'; }
    var p = csPanel(), wrap = p && p.querySelector('.engagement-panel-section-list-header-wrapper');
    if (!wrap) return;
    // 머리 줄(제목·✕가 가로로 놓인 줄) 안이 아니라 그 아래 줄에 (안에 넣으면 ✕ 옆에 끼어 여백이 어색하고 ✕가 잘 안 눌렸음)
    var bar = p.querySelector('#glide-csort');
    if (!bar) bar = G.el('div', { id: 'glide-csort' }, [csChip('top', '인기순'), csChip('new', '최신순')]);
    if (bar.previousElementSibling !== wrap) wrap.parentNode.insertBefore(bar, wrap.nextSibling);
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(wrap).color);
    bar.className = m && (+m[1] + +m[2] + +m[3]) / 3 > 128 ? 'd' : ''; // 글자색이 밝으면 어두운 테마
    [].forEach.call(bar.children, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-sort') === CS.sort)); });
  }
  function csEntry() { // 영상 아래 '댓글' 카드
    var hosts = document.querySelectorAll('yt-video-metadata-carousel-view-model');
    for (var i = 0; i < hosts.length; i++) {
      var t = hosts[i].querySelector('.ytCarouselTitleViewModelTitle, h2');
      if (t && /^(댓글|Comments)/i.test(t.textContent.trim())) return t;
    }
    return null;
  }
  function csPick(k) {
    if (k === CS.sort || CS.busy) return;
    var p = csPanel(), close = p && p.querySelector('.close-button button'), entry = csEntry();
    CS.sort = k;
    csEnsure();
    log('info', '댓글 정렬: ' + (k === 'new' ? '최신순' : '인기순'));
    if (!close || !entry) {
      log('warn', '댓글 정렬: 댓글 창을 다시 열지 못함 (닫기 ' + !!close + ', 댓글 칸 ' + !!entry + ')');
      // 칩만 바뀌고 목록은 그대로였음 → 되돌리고 알림 (전수조사 반영)
      CS.sort = k === 'new' ? 'top' : 'new'; csEnsure();
      try { hint('댓글 창을 닫았다 다시 열어 주세요', 1800); } catch (e) { /* ignore */ }
      return;
    }
    CS.busy = true;
    close.click();
    G.setTimeout.call(W, function () { try { csEntry() && csEntry().click(); } finally { CS.busy = false; } }, 450);
  }
  function csWatch() {
    var pc = document.querySelector('panel-container');
    if (!pc || pc === CS.pc) return;
    if (CS.obs) CS.obs.disconnect();
    CS.pc = pc;
    CS.obs = new MutationObserver(function () { G.setTimeout.call(W, csEnsure, 30); G.setTimeout.call(W, csEnsure, 400); });
    CS.obs.observe(pc, { childList: true });
  }

  // ===========================================================================
  // 목록 정보 줄 (1.8.7, 유튜브 앱과 같게): 조회수 칸 "조회수 12만회" → "▷12만" ("N명 시청 중"은 ▷만 붙임).
  // 유튜브 글자(텍스트 노드)는 바꾸지 않고 data-gv(보일 글자)·data-gsrc(원래 글자)만 붙임 → 유튜브가 목록 칸을 다른 영상에
  // 다시 써서(재활용) 원래 글자가 바뀌면 다음 훑기에서 다시 계산. 화면 변화가 있으면 0.15초 모아서 한 번 훑음
  // ===========================================================================
  var GV_SEL = 'yt-lockup-view-model .ytContentMetadataViewModelMetadataText,ytm-media-item .ytmBadgeAndBylineRendererItemByline .ytAttributedStringHost';
  var GV = { t: 0, obs: null };
  function gvText(t) {
    var m = /^조회수\s*(.+?)회$/.exec(t) || /^(.+?)\s+views?$/i.exec(t);
    if (m) return m[1];
    return /(시청\s*중|watching)$/i.test(t) ? t : null;
  }
  function gvScan() {
    GV.t = 0;
    var list = document.querySelectorAll(GV_SEL);
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      // 채널 이름 칸(인증 배지 아이콘이 든 칸)은 그대로. 재활용된 칸이면 예전 속성을 지움 (채널 이름이 가려지고 앞 영상 조회수가 보였음 — 전수조사 반영)
      if (e.children.length) { if (e.hasAttribute('data-gv')) { e.removeAttribute('data-gv'); e.removeAttribute('data-gsrc'); } continue; }
      var t = (e.textContent || '').trim();
      if (e.getAttribute('data-gsrc') === t) continue;
      var v = gvText(t);
      if (v) { e.setAttribute('data-gv', v); e.setAttribute('data-gsrc', t); } else if (e.hasAttribute('data-gv')) { e.removeAttribute('data-gv'); e.removeAttribute('data-gsrc'); }
    }
  }
  function gvStart() {
    if (GV.obs || !document.body || typeof MutationObserver !== 'function') return;
    GV.obs = new MutationObserver(function () { if (!GV.t) GV.t = G.setTimeout.call(W, function () { try { gvScan(); } catch (e) { GV.t = 0; } }, 150); });
    GV.obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    try { gvScan(); } catch (e) { /* ignore */ }
  }
  if (W.top === W) { if (document.body) gvStart(); else document.addEventListener('DOMContentLoaded', gvStart, { once: true }); }

  // ===========================================================================
  // 다음에 재생 (1.8.6, 재생 대기열): 영상 ⋮ 메뉴 맨 위에 '다음에 재생' → 앱이 대기열에 넣음(아무것도 안 보고 있으면 바로 재생).
  // 영상 웹뷰는 지금 영상이 끝나면(ended) 대기열 첫 영상으로 바로 이동(유튜브 자동 재생보다 먼저, 문서 캡처 단계).
  // 영상 화면 버튼 줄 아래 '다음에 재생 N개' 줄 → 누르면 목록 창(누르면 바로 재생, ✕로 빼기, 모두 지우기)
  // 메뉴는 유튜브 메뉴 항목(yt-list-item-view-model)을 복제해 같은 모양으로 (실기: bottom-sheet-container > yt-sheet-view-model)
  // ===========================================================================
  var QU = { items: [], hold: false, menuFor: null, menuAt: 0, row: null, sheet: null, scrim: null };
  // 메뉴 항목: 새 모양(yt-list-item-view-model, 홈·추천) / 예전 모양(ytm-menu-*-item-renderer, 검색 결과 — PC 실제 사이트 확인)
  var QU_MI = 'yt-list-item-view-model, ytm-menu-service-item-renderer, ytm-menu-navigation-item-renderer';
  var QU_ITEM = 'yt-lockup-view-model, ytm-video-with-context-renderer, ytm-compact-video-renderer, ytm-rich-item-renderer, ytm-media-item, ytm-playlist-video-renderer';
  function quInfo(item) {
    if (!item || item.closest('ytm-shorts-lockup-view-model, ytm-reel-item-renderer')) return null;
    var a = item.querySelector('a[href*="watch?v="]');
    var m = a && /[?&]v=([\w-]{11})/.exec(a.getAttribute('href') || '');
    if (!m) return null;
    var t = item.querySelector('.ytLockupMetadataViewModelTitle, h3, [role=heading], .media-item-headline');
    var meta = item.querySelector('.ytContentMetadataViewModelMetadataRow .ytAttributedStringHost, .media-item-byline, .ytm-badge-and-byline-item-byline');
    return {
      id: m[1],
      title: ((t && t.textContent) || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 150),
      ch: ((meta && meta.textContent) || '').trim().slice(0, 60),
      ch2: fbChannel(item)
    };
  }
  // ⋮ 버튼(길게 누르기도 이것을 누름)을 누른 항목을 기억하고, 뜨는 메뉴에 '다음에 재생'을 넣음
  document.addEventListener('click', function (e) {
    if (!S().enabled || !onYT() || !e.target || !e.target.closest) return;
    var b = null;
    try { b = e.target.closest(A.itemMenuButtons.concat(['button[aria-label="작업 메뉴"]']).join(',')); } catch (x) { return; }
    var info = b && quInfo(b.closest(QU_ITEM));
    // 영상이 아닌 메뉴(재생목록·채널·쇼츠 등): 앞 영상의 '다음에 재생'이 다시 쓰인 메뉴 칸에 남아 엉뚱한 영상을 넣었음 (전수조사 반영)
    if (!info) { if (b) { QU.menuFor = null; FB.info = null; var old = document.getElementById('glide-qnext'); if (old) old.remove(); } return; }
    QU.menuFor = info; QU.menuAt = Date.now();
    quWaitMenu(0);
  }, true);
  function quWaitMenu(n) {
    if (!QU.menuFor || Date.now() - QU.menuAt > 2500) return;
    // 아래에서 올라오는 메뉴(홈·검색) / 가운데 뜨는 메뉴(영상 화면 아래 추천 목록: div.menu-content[role=dialog], 실기)
    var list = null, hosts = document.querySelectorAll('bottom-sheet-container yt-sheet-view-model, .ytSpecBottomSheetLayoutHost, .menu-container .menu-content');
    for (var i = hosts.length - 1; i >= 0 && !list; i--) if (hosts[i].getBoundingClientRect().height > 40 && hosts[i].querySelector(QU_MI)) list = hosts[i];
    if (!list) { G.setTimeout.call(W, function () { quWaitMenu(n + 1); }, 80); return; }
    if (list.querySelector('#glide-qnext')) { try { fbMenu(list, QU.menuFor, list.querySelector('#glide-qnext')); } catch (x) { /* ignore */ } return; }
    var tpl = list.querySelector(QU_MI);
    var c = tpl.cloneNode(true);
    c.id = 'glide-qnext';
    // 글자: 복제한 항목의 첫 글자 칸만 바꿈, 아이콘: 유튜브 아이콘 대신 Glide 아이콘
    var leaf = null;
    [].some.call(c.querySelectorAll('*'), function (x) { if (!x.children.length && (x.textContent || '').trim()) { leaf = x; return true; } return false; });
    if (leaf) leaf.textContent = '다음에 재생'; else return;
    var ic = c.querySelector('c3-icon, yt-icon');
    // 아이콘이 있는 메뉴에만 아이콘 (가운데 뜨는 메뉴는 아이콘 칸이 비어 있음)
    if (ic) {
      var hadIcon = !!ic.querySelector('svg, img');
      while (ic.firstChild) ic.removeChild(ic.firstChild);
      if (hadIcon) ic.appendChild(G.el('i', { 'class': 'glide-qi' }));
      // 유튜브는 메뉴 아이콘(svg)을 조금 늦게 채움 → 복제 순간엔 비어 '아이콘 없는 메뉴'로 보고 아이콘을 안 넣었음 (폴드2 실기 2026-11-25).
      // 다른 항목에 아이콘이 생기면 그때 넣음 (가운데 뜨는 메뉴는 끝까지 비어 있어 안 넣음)
      else [250, 700, 1500].forEach(function (ms) { G.setTimeout.call(W, function () { if (ic.isConnected && !ic.querySelector('.glide-qi') && list.querySelector(QU_MI.split(',').map(function (x) { return x.trim() + ' svg'; }).join(','))) ic.appendChild(G.el('i', { 'class': 'glide-qi' })); }, ms); });
    }
    [].forEach.call(c.querySelectorAll('[aria-label]'), function (x) { x.setAttribute('aria-label', '다음에 재생'); });
    c.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      // 누르는 순간의 영상 (유튜브가 메뉴 칸을 다른 영상 메뉴에 다시 써도 맞게 — 독립 검토 반영)
      var info = QU.menuFor;
      if (!info) return;
      QU.menuFor = null;
      G.send('haptic', { kind: 'gesture' });
      G.send('queueAdd', info);
      log('info', '다음에 재생에 추가 [' + info.id + '] ' + info.title.slice(0, 40));
      quCloseMenu();
    }, true);
    tpl.parentNode.insertBefore(c, tpl);
    try { fbMenu(list, QU.menuFor, tpl); } catch (x) { /* ignore */ }
  }
  function quCloseMenu() {
    // 가운데 뜨는 메뉴는 '취소' 항목으로 닫음
    var pop = document.querySelector('.menu-container .menu-content');
    var cancel = pop && [].filter.call(pop.querySelectorAll('button'), function (b) { return /^(취소|Cancel)$/.test((b.textContent || '').trim()); })[0];
    if (cancel) { cancel.click(); return; }
    // 맨 위(마지막) 막을 누름: 댓글 창 위에 메뉴가 뜨면 막이 2개라, 첫 번째(댓글 창 것)를 누르면 메뉴는 남고 댓글 창이 닫혔음 (2026-11-25 실기)
    var scs = [].filter.call(document.querySelectorAll('ytw-scrim'), function (x) { return x.getClientRects().length; });
    var sc = scs[scs.length - 1];
    if (sc) (sc.querySelector('button') || sc).click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
  }
  // ===========================================================================
  // 관심 없음 · 채널 차단 (2026-11-21, 사용자: "채널 차단, 관심 없음도 잘 만들어줘")
  //  - 영상 ⋮ 메뉴의 유튜브 '관심 없음'·'채널 추천 안함'은 유튜브 것대로 계정에 알리고(알고리즘), Glide가 그 자리에서 바로 항목을 치움
  //    (유튜브 웹은 항목 자리에 안내 카드만 남김). 메뉴에 그 항목이 없으면(로그아웃·다른 모양 메뉴) Glide 항목을 넣음
  //  - 앱이 목록(hiddenVideos·blockChannels)에 저장 → 다음 목록부터 데이터 단계(glide-plus 'block')에서 빠지고, 이미 그려진 것은 훑어서 숨김
  //  - 아래 알림의 '실행 취소'는 Glide 목록에서만 되돌림
  //  - 홈 피드의 커뮤니티 글(구독 안 한 채널 글 추천)도 여기서 숨김 (데이터 단계는 glide-plus 'homePosts')
  // ===========================================================================
  var FB = { info: null, toast: null, timer: 0, sweepAt: 0 };
  var FB_POSTS = 'ytm-backstage-post-thread-renderer, ytm-backstage-post-renderer, ytm-post-renderer, ytm-shared-post-renderer';
  function fbChannel(item) {
    if (!item) return null;
    var a = item.querySelector('a[href^="/@"], a[href^="/channel/UC"]');
    var href = a ? (a.getAttribute('href') || '') : '';
    var key = '';
    var m = /^\/(@[^/?#]+)/.exec(href);
    if (m) { try { key = decodeURIComponent(m[1]); } catch (e) { key = m[1]; } }
    else if ((m = /^\/channel\/(UC[\w-]{20,})/.exec(href))) key = m[1];
    var row = item.querySelector('.ytContentMetadataViewModelMetadataRow, .media-item-byline, .ytm-badge-and-byline-item-byline');
    var name = row ? (row.textContent || '').split(/[•·]/)[0].replace(/\s+/g, ' ').trim() : '';
    if (!key && !name) return null;
    return { key: key || name, name: name || key };
  }
  function fbBox(item) { return (item.closest && item.closest('ytm-rich-item-renderer, ytm-video-with-context-renderer, ytm-compact-video-renderer')) || item; }
  function fbItems() { return document.querySelectorAll('yt-lockup-view-model, ytm-video-with-context-renderer, ytm-compact-video-renderer, ytm-media-item'); }
  function fbHide(box, on) { if (on) box.setAttribute('data-glide-fb', '1'); else box.removeAttribute('data-glide-fb'); }
  function fbVid(item) { var a = item.querySelector('a[href*="watch?v="]'); var m = a && /[?&]v=([\w-]{11})/.exec(a.getAttribute('href') || ''); return m ? m[1] : ''; }
  // 이미 그려진 목록에서 숨길 것 숨기기 (목록·탭 보관본은 데이터 단계를 거치지 않았을 수 있음)
  function fbSweep() {
    var s = S();
    if (!s.enabled || !onYT()) return;
    var vids = {}, chs = {};
    (s.hiddenVideos || []).forEach(function (v) { vids[v] = 1; });
    (s.blockChannels || []).forEach(function (c) { c = String(c || '').trim().toLowerCase(); if (c) chs[c] = 1; });
    var anyList = Object.keys(vids).length || Object.keys(chs).length;
    if (anyList) [].forEach.call(fbItems(), function (it) {
      var box = fbBox(it);
      if (box.getAttribute('data-glide-fb')) return;
      var v = fbVid(it);
      var ch = fbChannel(it);
      if ((v && vids[v]) || (ch && (chs[ch.key.toLowerCase()] || chs[ch.name.toLowerCase()]))) fbHide(box, true);
    });
    // 홈 피드 커뮤니티 글
    if (s.hideHomePosts !== false && location.pathname === '/' && G.mobileSite) [].forEach.call(document.querySelectorAll(FB_POSTS), function (p) {
      var box = p.closest('ytm-rich-item-renderer, ytm-rich-section-renderer') || p;
      if (!box.getAttribute('data-glide-fb')) fbHide(box, true);
    });
  }
  (function fbLoop() { try { fbSweep(); } catch (e) { /* ignore */ } G.setTimeout.call(W, fbLoop, 700); })();
  function fbToast(text, undo) {
    if (FB.toast && FB.toast.isConnected) FB.toast.remove();
    var btn = G.el('button', { type: 'button', text: '실행 취소', style: 'all:unset;color:#3ea6ff;font-weight:600;padding:4px 2px;cursor:pointer' });
    FB.toast = G.el('div', { id: 'glide-fbtoast', 'data-glide': 'fb', style: 'position:fixed;left:12px;right:12px;bottom:72px;z-index:2147483647;display:flex;align-items:center;justify-content:space-between;gap:12px;' +
      'padding:12px 16px;border-radius:10px;background:#323232;color:#fff;font:400 14px/1.35 Roboto,"Noto Sans KR",sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3);pointer-events:auto' },
      [G.el('span', { text: text }), undo ? btn : null]);
    btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (FB.toast) FB.toast.remove(); undo(); }, true);
    (document.body || document.documentElement).appendChild(FB.toast);
    if (FB.timer) G.clearTimeout.call(W, FB.timer);
    FB.timer = G.setTimeout.call(W, function () { if (FB.toast) FB.toast.remove(); }, 5000);
  }
  function fbAct(kind, info) {
    if (!info) return;
    G.send('haptic', { kind: 'gesture' });
    var boxes = [];
    if (kind === 'video') {
      [].forEach.call(fbItems(), function (it) { if (fbVid(it) === info.id) boxes.push(fbBox(it)); });
      G.send('blockAdd', { kind: 'video', value: info.id, label: info.title || '' });
      boxes.forEach(function (b) { fbHide(b, true); });
      log('info', '관심 없음 [' + info.id + '] ' + (info.title || '').slice(0, 40));
      fbToast('관심 없음으로 표시했어요', function () { G.send('blockRemove', { kind: 'video', value: info.id }); boxes.forEach(function (b) { fbHide(b, false); }); });
    } else {
      var ch = info.ch2;
      if (!ch) return;
      [].forEach.call(fbItems(), function (it) { var c = fbChannel(it); if (c && (c.key === ch.key || c.name === ch.name)) boxes.push(fbBox(it)); });
      G.send('blockAdd', { kind: 'channel', value: ch.key, label: ch.name });
      boxes.forEach(function (b) { fbHide(b, true); });
      log('info', '채널 차단 ' + ch.key + ' (' + ch.name + ')');
      fbToast('\'' + ch.name + '\' 채널을 차단했어요', function () { G.send('blockRemove', { kind: 'channel', value: ch.key }); boxes.forEach(function (b) { fbHide(b, false); }); });
    }
  }
  // 메뉴가 뜨면(quWaitMenu가 찾은 목록): 유튜브 항목에 Glide 동작을 붙이거나, 없으면 Glide 항목을 넣음
  function fbMenu(list, info, tpl) {
    FB.info = info;
    var items = [].slice.call(list.querySelectorAll(QU_MI));
    var find = function (re) { return items.filter(function (x) { return re.test((x.textContent || '').replace(/\s+/g, ' ').trim()); })[0]; };
    [['video', /^관심 없음$|^Not interested$/, '관심 없음'], ['channel', /^채널 추천 안함$|^Don.t recommend channel$/, '이 채널 차단']].forEach(function (d) {
      if (d[0] === 'channel' && !(info && info.ch2)) return;
      var own = find(d[1]);
      if (own) {
        if (!own._glideFb) {
          own._glideFb = d[0];
          // 유튜브 동작은 그대로 두고(계정에 알림), 누르는 순간의 영상으로 Glide 쪽도
          own.addEventListener('click', function () { var i = FB.info; FB.info = null; var kind = /채널|channel/i.test(own.textContent || '') ? 'channel' : 'video'; if (i) G.setTimeout.call(W, function () { fbAct(kind, i); }, 0); }, true);
        }
        return;
      }
      var id = 'glide-fb-' + d[0];
      if (list.querySelector('#' + id)) return;
      var c = tpl.cloneNode(true);
      c.id = id;
      var leaf = null;
      [].some.call(c.querySelectorAll('*'), function (x) { if (!x.children.length && (x.textContent || '').trim()) { leaf = x; return true; } return false; });
      if (!leaf) return;
      leaf.textContent = d[2];
      var ic = c.querySelector('c3-icon, yt-icon');
      if (ic) while (ic.firstChild) ic.removeChild(ic.firstChild);
      [].forEach.call(c.querySelectorAll('[aria-label]'), function (x) { x.setAttribute('aria-label', d[2]); });
      c.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        var i = FB.info; FB.info = null;
        quCloseMenu();
        fbAct(d[0], i);
      }, true);
      tpl.parentNode.appendChild(c);
    });
  }
  // 앱이 대기열을 알려 줌 (영상 웹뷰). hold: 수면 타이머 '영상 끝나면 정지' 중 (넘기지 않음)
  // 음악·동영상 대기열은 앱이 따로 저장하고, 지금 쪽 것만 보내 줌 (music). 영상 화면의 대기열 줄·창은 받은 쪽에 그대로 고침
  function quSend(t, d) { d = d || {}; d.music = !!QU.music; G.send(t, d); }
  function gmQSend(t, d) { d = d || {}; d.music = true; G.send(t, d); } // 음악 탭·음악 재생 화면: 늘 음악 대기열
  G.onCommand('queue', function (arg) {
    QU.music = !!(arg && arg.music);
    QU.items = (arg && Array.isArray(arg.items)) ? arg.items.filter(function (x) { return x && /^[\w-]{11}$/.test(x.id || ''); }) : [];
    QU.hold = !!(arg && arg.hold);
    quRow();
    if (QU.sheet) quSheet();
  });
  // 대기열 다음 영상으로 (영상이 끝남·알림/잠금화면의 '다음'). 지금 영상과 같은 항목은 건너뜀
  function quAdvance(why) {
    if (role() !== 'player' || !onWatch() || CAP || G.inAd() || !S().enabled) return false;
    var cur = G.currentVideoId();
    while (QU.items.length && QU.items[0].id === cur) quSend('queuePop', { id: QU.items.shift().id });
    if (!QU.items.length) { quRow(); return false; }
    var n = QU.items.shift();
    QU.advancedAt = Date.now(); // 같은 'ended' 를 음악 재생 화면이 또 처리하지 않게 (독립 검토 반영)
    log('info', '다음에 재생(' + why + '): 대기열의 다음 영상으로 [' + n.id + '] ' + (n.title || '').slice(0, 40));
    quSend('queuePop', { id: n.id });
    navigateTo('/watch?v=' + n.id + (QU.music || MP.on ? '&glide_music=1' : ''));
    quRow();
    return true;
  }
  // 지금 영상이 끝나면 대기열 첫 영상으로. 반복 재생(빠른 배속이면 ended가 실제로 옴)·수면 타이머 '영상 끝나면'은 제외 — 독립 검토 반영
  document.addEventListener('ended', function (e) {
    if (!QU.items.length || LP.on || QU.hold || LM.el) return;
    var p = mainPlayer();
    if (!p || !p.contains(e.target)) return;
    quAdvance('영상 끝');
  }, true);
  // 알림·잠금화면·이어폰의 '다음' (앱은 대기열이 있을 때만 이것을 보냄). 넘길 수 없으면(저장 중 등) 아무것도 안 함
  G.onCommand('queueNext', function () { quAdvance('다음 버튼'); });
  // 영상 화면: 버튼 줄 아래 '다음에 재생 N개' 줄
  function quRow() {
    var host = role() === 'player' && onWatch() ? document.querySelector('ytm-slim-video-action-bar-renderer') : null;
    // 영상 화면을 벗어나면(작은 플레이어를 닫아 홈으로 옮김 등) 목록 창도 닫음 — 다음 영상 위에 남아 있었음 (독립 검토 반영)
    if (!host && QU.sheet) quSheetClose();
    if (!host || !QU.items.length || !S().enabled) { if (QU.row) { QU.row.remove(); QU.row = null; } return; }
    if (!QU.row || QU.row.previousElementSibling !== host) {
      if (QU.row) QU.row.remove();
      QU.row = G.el('button', { type: 'button', id: 'glide-queue' }, [G.el('i'), G.el('b'), G.el('span')]);
      QU.row.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); quSheet(); }, true);
      host.parentNode.insertBefore(QU.row, host.nextSibling);
    }
    QU.row.children[1].textContent = '다음에 재생 ' + QU.items.length + '개';
    QU.row.children[2].textContent = QU.items[0].title || '';
    QU.row.classList.toggle('d', quDark());
  }
  function quDark() {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(document.body || document.documentElement).color);
    return !!m && (+m[1] + +m[2] + +m[3]) / 3 > 128;
  }
  // 목록 창 (아래에서 올라옴)
  function quSheetClose() {
    if (QU.scrim) { QU.scrim.remove(); QU.scrim = null; }
    if (QU.sheet) { QU.sheet.remove(); QU.sheet = null; lastGeom = ''; reportGeom(); }
  }
  // 대기열 끌어서 순서 바꾸기: ≡ 손잡이를 잡고 위아래로. 놓으면 앱 대기열도 같은 순서로
  function quDrag(e, row, from, list) {
    var rows = [].slice.call(list.children), h = row.getBoundingClientRect().height || 64, y0 = e.touches[0].clientY, to = from;
    var ls = list.scrollTop;
    QU.dragged = false;
    row.classList.add('drag');
    rows.forEach(function (r) { if (r !== row) r.classList.add('mv'); });
    G.send('haptic', { kind: 'gesture' });
    var move = function (ev) {
      if (ev.cancelable) ev.preventDefault();
      var dy = ev.touches[0].clientY - y0 + (list.scrollTop - ls);
      if (Math.abs(dy) > 4) QU.dragged = true;
      row.style.transform = 'translateY(' + dy + 'px)';
      var t = Math.max(0, Math.min(rows.length - 1, from + Math.round(dy / h)));
      if (t !== to) { to = t; G.send('haptic', { kind: 'tick' }); }
      rows.forEach(function (r, j) { if (r === row) return; var sh = (from < to && j > from && j <= to) ? -h : (from > to && j < from && j >= to) ? h : 0; r.style.transform = sh ? 'translateY(' + sh + 'px)' : ''; });
    };
    var end = function () {
      document.removeEventListener('touchmove', move, true); document.removeEventListener('touchend', end, true); document.removeEventListener('touchcancel', end, true);
      G.setTimeout.call(W, function () { QU.dragged = false; }, 300);
      if (to !== from) {
        var x = QU.items.splice(from, 1)[0]; QU.items.splice(to, 0, x);
        quSend('queueSet', { items: QU.items.map(function (q) { return { id: q.id, title: q.title, ch: q.ch }; }) });
      }
      quSheet(); quRow();
    };
    document.addEventListener('touchmove', move, { capture: true, passive: false });
    document.addEventListener('touchend', end, true); document.addEventListener('touchcancel', end, true);
  }
  function quSheet() {
    var fresh = !QU.sheet;
    if (QU.sheet) QU.sheet.remove();
    if (!QU.items.length) { quSheetClose(); return; }
    var list = G.el('div', { 'class': 'ql' });
    QU.items.forEach(function (it, i) {
      var x = G.el('button', { type: 'button', 'class': 'qx', 'aria-label': (it.title || '') + ' 빼기', text: '✕' });
      x.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); QU.items.splice(i, 1); quSend('queueRemove', { id: it.id }); quRow(); quSheet(); });
      var hd = G.el('div', { 'class': 'qd', 'aria-label': '끌어서 순서 바꾸기' }, [G.el('i')]);
      var row = G.el('div', { 'class': 'qr', role: 'button' }, [
        hd,
        G.el('img', { src: 'https://i.ytimg.com/vi/' + it.id + '/mqdefault.jpg', alt: '', loading: 'lazy' }),
        G.el('div', { 'class': 'qt' }, [QU.music ? koT(G.el('b'), it.title || it.id, it.ch) : G.el('b', { text: it.title || it.id }), G.el('span', { text: it.ch || '' })]),
        x
      ]);
      row.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (QU.dragged || (e.target.closest && e.target.closest('.qd'))) return; QU.items.splice(i, 1); quSend('queuePlay', { id: it.id }); quSheetClose(); quRow(); });
      hd.addEventListener('touchstart', function (e) { e.stopPropagation(); quDrag(e, row, i, list); }, { capture: true, passive: true });
      list.appendChild(row);
    });
    var clear = G.el('button', { type: 'button', 'class': 'qc', text: '모두 지우기' });
    clear.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); QU.items = []; quSend('queueClear', {}); quSheetClose(); quRow(); });
    var close = G.el('button', { type: 'button', 'class': 'qz', 'aria-label': '닫기', text: '✕' });
    close.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); quSheetClose(); });
    QU.sheet = G.el('div', { id: 'glide-qsheet', role: 'dialog', 'aria-label': '다음에 재생' }, [
      G.el('div', { 'class': 'qg' }),
      G.el('div', { 'class': 'qh' }, [G.el('h3', { text: '다음에 재생' }), G.el('span', { text: QU.items.length + '개 · 지금 영상이 끝나면 차례로 재생해요' }), close]),
      list,
      G.el('div', { 'class': 'qf' }, [clear])
    ]);
    QU.sheet.classList.toggle('d', quDark());
    if (!fresh) QU.sheet.style.animation = 'none';
    if (!QU.scrim) {
      QU.scrim = G.el('div', { id: 'glide-qscrim' });
      QU.scrim.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); quSheetClose(); });
      document.body.appendChild(QU.scrim);
    }
    document.body.appendChild(QU.sheet);
    lastGeom = ''; reportGeom();
  }

  // ===========================================================================
  // 추천 탭 (1.8, 둘러보기 웹뷰): 아래 메뉴 '추천'. 유튜브 홈 알고리즘 대신
  //   내가 고른 주제·키워드 + 많이 본 영상과 비슷한 영상(자동) + 구글 트렌드(앱이 받아 줌) + 가끔 '새 주제'(N개 중 1개)
  // 영상은 유튜브 검색(innertube search)·관련 영상(next)을 페이지 안에서 직접 받음. 쿠키 없이 요청해 유튜브 검색 기록에 남지 않음.
  // 주제·기록은 폰 안에만 (앱 설정 recTopics… / 앱 Store recHistory). 유튜브 시청 기록·추천 학습과 별개
  // ===========================================================================
  var REC = { el: null, list: null, chips: null, status: null, more: null, editor: null, open: false, loading: false, items: [], seen: {}, histIds: {}, hist: [], srcs: [],
    filter: '', cacheAt: 0, cacheKey: '', dataCb: null, override: null, homeY: 0, path: '', rounds: 0, moreBusy: false, moreIdx: 0 };
  var REC_NEW_DEFAULT = ['우주 과학 다큐', '세계사 이야기', '자연 다큐멘터리', '건축 이야기', '세계 여행 브이로그', '요리 레시피', '클래식 음악 해설', '미술 작품 해설', '심리학 강의', '경제 기초 강의', '최신 기술 리뷰', '동물 다큐', '철학 강의', '역사 미스터리', '등산 캠핑', '재즈 라이브', '인문학 강연', '바다 생물 다큐', '고대 문명', '과학 실험'];
  var SP_MONTH = 'EgQIBBAB', SP_WEEK = 'EgQIAxAB', SP_ANY = 'EgIQAQ%3D%3D'; // 검색 필터: 이번 달·이번 주 업로드 + 동영상만 / 기간 없이 동영상만
  var REC_TOPIC_LOAD = 8; // 한 번에 검색하는 주제 수. 더 고르면 새로고침마다 돌아가며 (예전에는 앞 8개만 쓰고 9~20번째 주제는 끝내 안 나왔음)
  var SPARK = "M12 2.5l2.3 6.6 6.7 2.4-6.7 2.4L12 20.5l-2.3-6.6L3 11.5l6.7-2.4z";
  var SPARK_O = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.7' stroke-linejoin='round'%3E%3Cpath d='" + SPARK + "'/%3E%3C/svg%3E";
  // 돋보기(설정 창 검색칸)·조절 막대(추천 설정 칩) 아이콘
  var SEARCH_I = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='10.5' cy='10.5' r='6.5'/%3E%3Cpath d='M15.5 15.5 21 21'/%3E%3C/svg%3E";
  var TUNE_I = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.8' stroke-linecap='round'%3E%3Cpath d='M4 7h9M17 7h3M4 17h3M11 17h9'/%3E%3Ccircle cx='15' cy='7' r='2.2'/%3E%3Ccircle cx='9' cy='17' r='2.2'/%3E%3C/svg%3E";
  var SPARK_F = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='" + SPARK + "'/%3E%3C/svg%3E";
  var REC_STOP = {};
  ['ep', 'the', 'and', 'for', 'official', 'mv', 'full', 'live', 'shorts', 'vlog', '영상', '공식', '오늘', '이번', '진짜', '정말', '모음', '하는', '있는', '없는', '합니다', '입니다', '그리고', '에서', '으로',
    '라이브', '풀버전', '최신', '방송', '브이로그', '하이라이트', '완벽', '정리', '이유', '방법', '뉴스', '속보', '단독', '반응', '시즌', '편', '회', '화'].forEach(function (w) { REC_STOP[w] = 1; });

  function recSt() { var s = S(); return REC.override ? Object.assign({}, s, REC.override) : s; }
  function recOn() { return role() === 'browse' && onYT() && !!S().enabled && S().recTab !== false; }
  G.onSettings(function () { REC.override = null; G.setTimeout.call(W, recTick, 0); });
  function recTokens(s) { return (String(s || '').toLowerCase().match(/[가-힣a-z0-9]{2,}/g) || []).filter(function (w) { return !REC_STOP[w] && !/^\d+$/.test(w); }); }
  function recText(t) {
    if (!t) return '';
    if (typeof t === 'string') return t;
    if (t.simpleText) return t.simpleText;
    if (t.runs) return t.runs.map(function (r) { return r.text || ''; }).join('');
    return typeof t.content === 'string' ? t.content : '';
  }
  function recUrl(u) { return u && u.indexOf('//') === 0 ? 'https:' + u : (u || ''); }

  // ---- 유튜브에서 받기 ----
  function yti(ep, body) {
    var c = W.ytcfg;
    if (!c || !c.get) return Promise.reject(new Error('ytcfg 없음'));
    return fetch('/youtubei/v1/' + ep + '?prettyPrint=false', {
      method: 'POST', credentials: 'omit',
      headers: { 'content-type': 'application/json', 'x-youtube-client-name': String(c.get('INNERTUBE_CONTEXT_CLIENT_NAME') || 2), 'x-youtube-client-version': String(c.get('INNERTUBE_CLIENT_VERSION') || '') },
      body: JSON.stringify(Object.assign({ context: c.get('INNERTUBE_CONTEXT') }, body))
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function recItem(v) {
    var nav = v.navigationEndpoint || {};
    var url = (nav.commandMetadata && nav.commandMetadata.webCommandMetadata && nav.commandMetadata.webCommandMetadata.url) || '';
    if (nav.reelWatchEndpoint || url.indexOf('/shorts/') === 0) return null; // 쇼츠 제외
    var len = recText(v.lengthText);
    var secs = len ? len.split(':').reduce(function (a, n) { return a * 60 + (+n || 0); }, 0) : 0;
    if (len && secs <= 60) return null; // 1분 이하
    var th = (v.thumbnail && v.thumbnail.thumbnails) || [];
    var big = null;
    for (var i = 0; i < th.length; i++) if (th[i].width >= 480 && th[i].width / Math.max(1, th[i].height) > 1.6) big = th[i];
    var cht = v.channelThumbnail && (v.channelThumbnail.channelThumbnailWithLinkRenderer || v.channelThumbnail);
    var av = cht && cht.thumbnail && cht.thumbnail.thumbnails && cht.thumbnail.thumbnails[0];
    // 채널 ID·핸들 (채널 차단 목록과 맞춰 보려고: 목록에는 @핸들 · UC… · 이름이 섞여 있음)
    var by = v.shortBylineText || v.longBylineText || v.ownerText, run = by && by.runs && by.runs[0], be = run && run.navigationEndpoint && run.navigationEndpoint.browseEndpoint;
    var handle = be && /^\/@[^/?#]+/.exec(be.canonicalBaseUrl || '');
    var views = recText(v.shortViewCountText || v.viewCountText), age = recText(v.publishedTimeText);
    return {
      id: v.videoId, title: recText(v.headline || v.title), ch: recText(by),
      chId: be && /^UC/.test(be.browseId || '') ? be.browseId : '', handle: handle ? decodeURIComponentSafe(handle[0].slice(1)) : '',
      len: len, secs: secs, views: views, age: age, v: gmViews(views), a: gmAge(age), live: recLiveN(views),
      thumb: big ? recUrl(big.url) : 'https://i.ytimg.com/vi/' + v.videoId + '/hqdefault.jpg', avatar: av ? recUrl(av.url) : ''
    };
  }
  // 라이브 '217명 시청 중' · '1.2천명 시청 중' → 지금 보는 사람 수 (라이브가 아니면 -1)
  function recLiveN(t) {
    var m = /([\d.,]+)\s*(천|만)?\s*명\s*시청\s*중|([\d.,]+)\s*(K|M)?\s*watching/i.exec(String(t || '')); if (!m) return -1;
    return Math.round(parseFloat((m[1] || m[3]).replace(/,/g, '')) * ({ '천': 1e3, '만': 1e4, K: 1e3, M: 1e6 }[(m[2] || m[4] || '').toUpperCase()] || 1));
  }
  function decodeURIComponentSafe(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }

  // ---- 거르기 (1.0.1, 사용자: "조회수 1900·1500인데 원본을 무단 복제한 영상이 뜬다") ----
  // 조회수 기준은 올린 날짜에 맞춤: 갓 올린 정상 영상은 조회수가 적은 게 당연해서 고정 1만은 새 영상을 다 지움.
  //   보통 = 하루 200회 꼴(최소 1천 · 최대 5천), 강하게 = 3배(최소 3천 · 최대 1만 5천). 실측: 하루 300회·최대 1만은 작은 클래식 해설 채널 같은 정상 영상까지 많이 뺐음, 끄기 = 안 거름. 조회수 표시가 없으면(라이브 등) 그대로
  function recMinViews(ageSec, q) {
    if (q === 'off') return 0;
    var days = ageSec >= 0 ? ageSec / 86400 : 365, k = q === 'strong' ? 3 : 1;
    return Math.min(5000 * k, Math.max(1000 * k, Math.round(200 * k * days)));
  }
  // 걸러야 하는 이유 (없으면 '') — 'low': 조회수가 날짜에 비해 너무 적음 · 'farm': 일본어 이름 채널이 한국어 제목 영상 (실측: 복제·자동 생성 채널)
  function recJunk(x, q) {
    if (q === 'off') return '';
    if (x.v >= 0 && x.v < recMinViews(x.a, q)) return 'low';
    // 라이브는 보는 사람 수로 (실측: 시청자 몇백 명짜리 24시간 '재방송' 라이브가 주제 검색에 섞임)
    if (x.live >= 0 && x.live < (q === 'strong' ? 1000 : 300)) return 'low';
    if (/[぀-ヿ]/.test(x.ch || '') && /[가-힣]/.test(x.title || '') && !/[぀-ヿ]/.test(x.title || '')) return 'farm';
    return '';
  }
  // 같은 영상을 여러 채널이 올린 것 묶기: 괄호·해시태그·이모지·기호·띄어쓰기를 빼고 앞 20글자
  function recTitleKey(t) {
    var s = String(t || '').toLowerCase().replace(/\[[^\]]*\]|【[^】]*】|\([^)]*\)|#[^\s#]+/g, ' ').replace(/[^가-힣a-z0-9]+/g, '');
    return s.length >= 8 ? s.slice(0, 20) : '';
  }
  // 둘 중 원본일 가능성이 큰 쪽: 조회수 많은 쪽, 같으면 먼저 올린 쪽
  function recBetter(a, b) { var va = a.v < 0 ? 0 : a.v, vb = b.v < 0 ? 0 : b.v; return va !== vb ? va > vb : (a.a >= 0 ? a.a : 0) >= (b.a >= 0 ? b.a : 0); }
  function recItems(json) {
    var out = [], cont = null;
    (function walk(o, d) {
      if (!o || typeof o !== 'object' || d > 20) return;
      if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) walk(o[i], d + 1); return; }
      for (var k in o) {
        var v = o[k];
        if ((k === 'videoWithContextRenderer' || k === 'videoRenderer' || k === 'compactVideoRenderer') && v && v.videoId) { var it = recItem(v); if (it && it.title) out.push(it); continue; }
        if (k === 'continuationCommand' && v && v.token && !cont) cont = v.token;
        walk(v, d + 1);
      }
    })(json, 0);
    // 조회수가 날짜에 비해 너무 적은 영상 · 복제 채널 영상은 뺌 (recJunk). 뺀 것은 '거른 영상 보기'에서 확인할 수 있게 모아 둠
    var q = recSt().recQuality || 'normal', good = [];
    out.forEach(function (x, i) {
      x.rank = i; x.rankN = out.length;
      var why = recJunk(x, q);
      if (why) recHide(x, why === 'low' ? '조회수가 적음' : '복제 의심 채널'); else good.push(x);
    });
    return { items: good, cont: cont };
  }
  // 거른 영상 기록 (설정 창의 '거른 영상 보기', 최근 200개)
  function recHide(x, why) {
    REC.hidden = REC.hidden || [];
    if (REC.hidden.some(function (h) { return h.id === x.id; })) return;
    REC.hidden.push(Object.assign({}, x, { why: why }));
    if (REC.hidden.length > 200) REC.hidden.shift();
  }
  function recSearch(q, sp, tag) {
    return yti('search', { query: q, params: sp }).then(function (j) { var r = recItems(j); return { tag: tag, items: r.items, cont: r.cont }; })
      .catch(function (e) { log('warn', '추천 탭: 검색 실패 [' + q + '] ' + e.message); return { tag: tag, items: [], cont: null }; });
  }
  // 내 주제: 이번 달 영상 + 기간 제한 없는 검색을 번갈아 섞음 (1.0.1). 이번 달만 찾으면 오래된 인기 원본은 빠지고 그걸 최근에 퍼 온 복제가 들어왔음
  //   (실측 '우주 과학 다큐': 이번 달만 → 조회수 4회·463회 영상, 기간 없음 → EBS·히스토리 등 원본). 더 불러오기는 두 검색을 번갈아 (cont · cont2)
  function recTopicSearch(t) {
    var tag = { kind: 'topic', label: t };
    return Promise.all([recSearch(t, SP_MONTH, tag), recSearch(t, SP_ANY, tag)]).then(function (r) {
      var a = r[0].items, b = r[1].items, out = [], have = {};
      for (var i = 0; i < Math.max(a.length, b.length); i++) [a[i], b[i]].forEach(function (x) { if (x && !have[x.id]) { have[x.id] = 1; x.rank = out.length; out.push(x); } });
      out.forEach(function (x) { x.rankN = out.length; });
      return { tag: tag, items: out, cont: r[0].cont, cont2: r[1].cont };
    });
  }
  function recRelated(id, tag) {
    return yti('next', { videoId: id }).then(function (j) { return { tag: tag, items: recItems(j).items.filter(function (x) { return x.id !== id; }), cont: null }; })
      .catch(function (e) { log('warn', '추천 탭: 관련 영상 실패 ' + e.message); return { tag: tag, items: [], cont: null }; });
  }
  // 앱에 트렌드·많이 본 영상 기록 요청 (예전 앱은 답이 없음 → 6초 뒤 빈 값)
  function recAskData() {
    return new Promise(function (res) {
      var done = false;
      REC.dataCb = function (d) { if (!done) { done = true; res(d || {}); } };
      G.send('recData', {});
      G.setTimeout.call(W, function () { if (!done) { done = true; res({}); } }, 6000);
    });
  }
  G.onCommand('recData', function (arg) { var cb = REC.dataCb; REC.dataCb = null; if (cb) cb(arg); });

  // ---- 고르기·섞기 ----
  // 차단 목록(관심 없음 영상 · 채널 @핸들/UC…/이름 · 키워드) · 보기 싫은 주제. 예전에는 채널 이름만 봐서 ⋮ 메뉴로 막은 채널(@핸들)이 추천 탭에는 그대로 나왔음
  function recBlockReason(it, tag) {
    var s = recSt(), ch = (it.ch || '').toLowerCase(), t = (it.title || '').toLowerCase(), i;
    if ((s.hiddenVideos || []).indexOf(it.id) >= 0) return '관심 없음';
    var bc = s.blockChannels || [], bk = s.blockKeywords || [];
    for (i = 0; i < bc.length; i++) {
      var c = String(bc[i] || '').trim(), cl = c.toLowerCase();
      if (!c) continue;
      if ((it.chId && c === it.chId) || (it.handle && cl === it.handle.toLowerCase()) || ch === cl || ch === cl.replace(/^@/, '')) return '차단한 채널';
    }
    for (i = 0; i < bk.length; i++) { var k = String(bk[i] || '').trim().toLowerCase(); if (k && (t.indexOf(k) >= 0 || ch.indexOf(k) >= 0)) return '키워드 ' + k; }
    // 보기 싫은 주제: 내가 고른 주제로 찾은 영상은 빼지 않음 (직접 찾은 것과 같음 — 예: '부동산 시장 해설'을 고르고 부동산 묶음을 켠 경우)
    if (tag && tag.kind === 'topic') return '';
    var tw = recTopicWords(s.hideTopics), tc = t + ' ' + ch;
    for (i = 0; i < tw.length; i++) if (recTopicHit(tc, tw[i])) return '주제 ' + tw[i].name;
    return '';
  }
  function recTopicHit(t, x) {
    for (var i = 0; i < x.ex.length; i++) if (x.ex[i] && t.indexOf(x.ex[i]) !== -1) return false;
    var at = t.indexOf(x.w);
    while (at !== -1) { if (!x.lb || at === 0 || !/[가-힣a-z0-9]/.test(t[at - 1])) return true; at = t.indexOf(x.w, at + 1); }
    return false;
  }
  function recBlocked(it, tag) { var why = recBlockReason(it, tag || it.tag); if (why) recHide(it, why); return !!why; }
  var REC_TW = { key: '', list: [] };
  function recTopicWords(ids) {
    var key = JSON.stringify(ids || []) + (G.filters().version || '');
    if (REC_TW.key === key) return REC_TW.list;
    var on = {}, out = [];
    (ids || []).forEach(function (id) { on[id] = 1; });
    (G.filters().topicPacks || []).forEach(function (p) {
      if (!p || !on[p.id]) return;
      var ex = (p.except || []).map(function (x) { return String(x || '').toLowerCase(); });
      (p.words || []).forEach(function (w) { w = String(w || '').trim().toLowerCase(); var lb = w[0] === '^'; if (lb) w = w.slice(1); if (w) out.push({ w: w, lb: lb, ex: ex, name: p.name }); });
    });
    REC_TW = { key: key, list: out };
    return out;
  }
  // 추천 점수 (추천순): 유튜브 검색 순위 · 제목이 주제와 맞는 정도 · 날짜에 비한 조회수 · 새 영상 (2026-11-25 사용자: "추천순대로 안 나온다" — 예전에는 점수 없이 받은 순서였음)
  function recScore(it, tag) {
    tag = tag || it.tag;
    var r = it.rankN ? 1 - it.rank / Math.max(10, it.rankN) : 0.5;
    var sc = 2 * r;
    if (tag && (tag.kind === 'topic' || tag.kind === 'trend' || tag.kind === 'new')) {
      var tw = recTokens(tag.label), tl = (it.title || '').toLowerCase();
      if (tw.length) sc += 1.5 * tw.filter(function (w) { return tl.indexOf(w) >= 0; }).length / tw.length;
    }
    if (it.v >= 0) {
      var days = it.a >= 0 ? Math.max(1, it.a / 86400) : 365;
      sc += 1.5 * Math.max(0, Math.min(1, (Math.log(it.v / days + 1) / Math.LN10 - 2) / 3)); // 하루 100회 → 0 · 10만 회 → 1.5
    } else sc += 0.5;
    if (it.a >= 0) sc += it.a < 7 * 86400 ? 0.4 : it.a < 31 * 86400 ? 0.2 : 0;
    return sc;
  }
  // 이미 점수(sc)가 매겨진 것 정렬 (분류 보기·더 불러온 묶음). 위에 보이던 것은 다시 섞지 않음
  function recBySc(items) { return items.map(function (it, i) { return { it: it, i: i }; }).sort(function (a, b) { return (b.it.sc || 0) - (a.it.sc || 0) || a.i - b.i; }).map(function (o) { return o.it; }); }
  function recByScore(items, tag) { return items.map(function (it, i) { return { it: it, s: recScore(it, tag), i: i }; }).sort(function (a, b) { return b.s - a.s || a.i - b.i; }).map(function (o) { return o.it; }); }
  // 한 채널이 몰리지 않게: 같은 채널이 이미 2개 나왔으면 뒤로 미룸
  function recSpread(items) {
    var n = {}, out = [], later = [];
    items.forEach(function (it) { var k = (it.chId || it.ch || '').toLowerCase(); if (k && (n[k] || 0) >= 2) later.push(it); else { n[k] = (n[k] || 0) + 1; out.push(it); } });
    return out.concat(later);
  }
  // 같은 제목(여러 채널이 올린 같은 영상)은 원본일 가능성이 큰 하나만: have = 이미 화면에 있는 것 (그것은 그대로 둠)
  // (실측: 같은 채널의 시리즈 '… | 정승제'·'… | 이지영'은 다른 영상이라 같은 채널끼리는 묶지 않음 — 퍼 온 것은 다른 채널이 올림)
  function recChKey(it) { return (it.chId || it.handle || it.ch || '').toLowerCase(); }
  function recDedupe(srcs, have) {
    var best = {}, lose = {};
    (have || []).forEach(function (it) { var k = recTitleKey(it.title); if (k && !best[k]) best[k] = { it: it, fixed: true }; });
    srcs.forEach(function (s) {
      s.items.forEach(function (it) {
        var k = recTitleKey(it.title), b = k && best[k];
        if (!k || lose[it.id]) return;
        if (!b) { best[k] = { it: it }; return; }
        if (b.it.id === it.id || recChKey(b.it) === recChKey(it)) return;
        if (!b.fixed && recBetter(it, b.it)) { lose[b.it.id] = 1; recHide(b.it, '같은 영상 (다른 채널)'); best[k] = { it: it }; }
        else { lose[it.id] = 1; recHide(it, '같은 영상 (다른 채널)'); }
      });
    });
    srcs.forEach(function (s) { s.items = s.items.filter(function (it) { return !lose[it.id]; }); });
  }

  // 자주 본 주제: 많이 본 영상 제목에서 두 번 넘게 나온 낱말
  function recAutoWords(hist) {
    var n = {};
    hist.slice(0, 40).forEach(function (h) { var seen = {}; recTokens(h.title).forEach(function (w) { if (!seen[w]) { seen[w] = 1; n[w] = (n[w] || 0) + 1; } }); });
    return Object.keys(n).filter(function (w) { return n[w] >= 2; }).sort(function (a, b) { return n[b] - n[a]; }).slice(0, 8);
  }
  // 트렌드는 내 주제·본 영상과 겹치는 것 먼저, 합쳐 3개
  function recPickTrends(trends, topics, hist) {
    var mine = {};
    topics.concat(hist.slice(0, 30).map(function (h) { return h.title; })).forEach(function (s) { recTokens(s).forEach(function (w) { mine[w] = 1; }); });
    var qs = trends.map(function (t) { return t && (t.q || t); }).filter(function (q) { return typeof q === 'string' && q; });
    var hit = qs.filter(function (q) { return recTokens(q).some(function (w) { return mine[w]; }); }).slice(0, 2);
    return hit.concat(qs.filter(function (q) { return hit.indexOf(q) < 0; }).slice(0, 3 - hit.length));
  }
  // 새 주제: 내 주제와 겹치지 않는 것 중 날마다·새로고침마다 돌아가며 2개
  function recPickNew(topics, n) {
    var a = G.filters().android || {};
    var list = (a.recNewTopics && a.recNewTopics.length ? a.recNewTopics : REC_NEW_DEFAULT).filter(function (q) {
      var tw = recTokens(q);
      return !topics.some(function (t) { return recTokens(t).some(function (w) { return tw.indexOf(w) >= 0; }); });
    });
    if (!list.length) return [];
    var start = (Math.floor(Date.now() / 864e5) * 3 + REC.rounds * 3) % list.length;
    var out = [];
    for (var i = 0; i < (n || 2) && i < list.length; i++) out.push(list[(start + i) % list.length]);
    return out;
  }
  // 받은 출처 정리: 같은 영상 묶기 → 출처마다 추천 점수 순 → 한 채널 몰림 풀기 (have = 이미 화면에 있는 것)
  function recPrepare(srcs, have) {
    recDedupe(srcs, have);
    srcs.forEach(function (s) { s.items = recSpread(recByScore(s.items, s.tag)); s.items.forEach(function (it) { it.sc = recScore(it, s.tag); }); });
  }
  var REC_LIM = { topic: 10, like: 5, trend: 3, 'new': 6 };
  function recCompose(srcs, every) {
    var seen = REC.seen, main = [], fresh = [];
    var qs = srcs.map(function (s) { return { s: s, i: 0, n: 0 }; });
    function take(q) {
      while (q.i < q.s.items.length) {
        var it = q.s.items[q.i++];
        if (seen[it.id] || REC.histIds[it.id] || recBlocked(it, q.s.tag)) continue;
        seen[it.id] = 1; q.n++;
        return Object.assign({ tag: q.s.tag }, it);
      }
      return null;
    }
    function round(list, out) {
      var moved = true;
      while (moved) { moved = false; list.forEach(function (q) { if (q.n >= REC_LIM[q.s.tag.kind]) return; var it = take(q); if (it) { out.push(it); moved = true; } }); }
    }
    round(qs.filter(function (q) { return q.s.tag.kind !== 'new'; }), main);
    round(qs.filter(function (q) { return q.s.tag.kind === 'new'; }), fresh);
    return recMix(main, fresh, every);
  }
  // 새 주제를 every개 중 1개 꼴로 끼워 넣음 (끄기면 안 넣음)
  function recMix(main, fresh, every) {
    var out = [], k = 0;
    main.forEach(function (it) { out.push(it); if (every > 1 && out.length % every === every - 1 && k < fresh.length) out.push(fresh[k++]); });
    return main.length ? out : fresh;
  }
  // 출처별로 하나씩 돌아가며 (한 주제만 몰려 나오지 않게)
  function recRR(items) {
    var by = {}, keys = [], out = [], more = true;
    items.forEach(function (it) { var k = it.tag.kind + '|' + it.tag.label; if (!by[k]) { by[k] = []; keys.push(k); } by[k].push(it); });
    for (var i = 0; more; i++) { more = false; keys.forEach(function (k) { if (by[k][i]) { out.push(by[k][i]); more = true; } }); }
    return out;
  }

  // 화면 상태: 보기(전체·내 주제·비슷한 영상·트렌드·새 주제)와 그 안의 세부(주제 이름 등)
  //   REC.srcs: 출처별 첫 쪽(가로 줄에 씀) / REC.all: 받은 영상 전부(분류 보기) / REC.items: '맞춤 추천'·'더 많은 추천' 섞은 순서
  REC.view = 'all'; REC.sub = ''; REC.all = [];
  var REC_VIEWS = [['all', '전체'], ['topic', '내 주제'], ['like', '비슷한 영상'], ['trend', '트렌드'], ['new', '새 주제']];
  function recAddAll(srcs) {
    var have = {};
    REC.all.forEach(function (it) { have[it.id] = 1; });
    srcs.forEach(function (s) {
      s.items.forEach(function (it) {
        if (have[it.id] || REC.histIds[it.id] || recBlocked(it, s.tag)) return;
        have[it.id] = 1;
        REC.all.push(Object.assign({ tag: s.tag }, it));
      });
    });
  }
  function recLoad(force) {
    if (REC.loading) { if (force) REC.again = true; return; } // 고르는 중에 주제를 바꿈 → 끝나면 다시
    var st = recSt();
    var key = JSON.stringify([st.recTopics, st.recAuto, st.recTrends, st.recNewEvery, st.recQuality, st.hideTopics, st.blockChannels, st.blockKeywords]);
    if (!force && REC.items.length && REC.cacheKey === key && Date.now() - REC.cacheAt < 30 * 60e3) { recRender(); return; }
    REC.loading = true; REC.rounds++; REC.hidden = [];
    recRender();
    var allTopics = st.recTopics || [], every = +st.recNewEvery || 0, topics = allTopics.slice();
    if (topics.length > REC_TOPIC_LOAD) { var off = ((REC.rounds - 1) * REC_TOPIC_LOAD) % topics.length; topics = topics.slice(off).concat(topics.slice(0, off)).slice(0, REC_TOPIC_LOAD); }
    recAskData().then(function (data) {
      var hist = Array.isArray(data.history) ? data.history : [];
      REC.hist = hist; REC.histIds = {};
      hist.forEach(function (h) { if (h && h.id) REC.histIds[h.id] = 1; });
      REC.trendWords = (Array.isArray(data.trends) ? data.trends : []).map(function (t) { return t && (t.q || t); }).filter(function (q) { return typeof q === 'string' && q; })
        .map(function (q) { return q.replace(/&(amp|quot|#39|apos|lt|gt);/g, function (m, e) { return { amp: '&', quot: '"', '#39': "'", apos: "'", lt: '<', gt: '>' }[e]; }); }).slice(0, 12);
      var jobs = topics.map(recTopicSearch);
      if (st.recAuto !== false) hist.filter(function (h) { return h && h.id && Date.now() - (h.at || 0) < 21 * 864e5; }).slice(0, 4)
        .forEach(function (h) { jobs.push(recRelated(h.id, { kind: 'like', label: '본 영상과 비슷', from: h.title })); });
      if (st.recTrends !== false) recPickTrends(REC.trendWords, allTopics, hist).forEach(function (q) { jobs.push(recSearch(q, SP_WEEK, { kind: 'trend', label: q })); });
      // 새 주제 줄 수는 섞는 비율대로 (10개 중 1 → 1줄, 5개 중 1 → 2줄, 3개 중 1 → 3줄)
      if (every > 1) recPickNew(allTopics, every <= 3 ? 3 : every <= 5 ? 2 : 1).forEach(function (q) { jobs.push(recSearch(q, SP_MONTH, { kind: 'new', label: q })); });
      return Promise.all(jobs);
    }).then(function (srcs) {
      REC.loading = false;
      if (REC.again) { REC.again = false; recLoad(true); return; }
      REC.seen = {}; REC.srcs = srcs; REC.all = [];
      recPrepare(srcs, null);
      recAddAll(srcs);
      REC.items = recCompose(srcs, every);
      REC.cacheAt = Date.now(); REC.cacheKey = key;
      log('info', '추천 탭: ' + REC.all.length + '개 (주제 ' + topics.length + '/' + allTopics.length + ', 출처 ' + srcs.length + ', 거름 ' + (REC.hidden || []).length + ')');
      recRender();
      G.send('refreshDone', {});
    }).catch(function (e) {
      REC.loading = false;
      if (REC.again) { REC.again = false; recLoad(true); return; }
      REC.failed = true; recRender(); REC.failed = false;
      log('warn', '추천 탭: 불러오기 실패 ' + e.message);
      G.send('refreshDone', {});
    });
  }
  // 아래로 내리면 더: 지금 보기에 맞는 출처(다음 쪽이 있는 검색) 3개씩 돌아가며
  function recLoadMore() {
    if (REC.moreBusy || REC.loading) return;
    var cands = REC.srcs.filter(function (s) { return (s.cont || s.cont2) && (REC.view === 'all' || (s.tag.kind === REC.view && (!REC.sub || s.tag.label === REC.sub))); });
    if (!cands.length) { if (REC.more) REC.more.textContent = REC.all.length ? '여기까지예요 · 아래로 당기면 새로 골라요' : ''; return; }
    REC.moreBusy = true;
    if (REC.more) REC.more.textContent = '더 불러오는 중…';
    var every = +recSt().recNewEvery || 0, pick = [], i;
    if (REC.view === 'all') {
      // 전체 보기: 평소 출처 2개 + 새 주제 1개 → 더 불러와도 새 주제가 같은 비율로 섞임
      var main = cands.filter(function (s) { return s.tag.kind !== 'new'; }), nw = cands.filter(function (s) { return s.tag.kind === 'new'; });
      for (i = 0; i < Math.min(2, main.length); i++) pick.push(main[(REC.moreIdx + i) % main.length]);
      if (every > 1 && nw.length) pick.push(nw[REC.moreIdx % nw.length]);
      REC.moreIdx += Math.max(1, Math.min(2, main.length));
    }
    if (!pick.length) {
      for (i = 0; i < Math.min(3, cands.length); i++) pick.push(cands[(REC.moreIdx + i) % cands.length]);
      REC.moreIdx += pick.length;
    }
    var view0 = REC.view, list0 = REC.moreList;
    Promise.all(pick.map(function (s) {
      // 내 주제는 이번 달 검색(cont)과 기간 없는 검색(cont2)을 번갈아
      var two = !!(s.cont && s.cont2), use2 = two ? !!s.alt : !s.cont;
      if (two) s.alt = !s.alt;
      return yti('search', { continuation: use2 ? s.cont2 : s.cont }).then(function (j) { var r = recItems(j); return { tag: s.tag, items: r.items, cont: r.cont, src: s, use2: use2 }; })
        .catch(function () { return { tag: s.tag, items: [], cont: null, src: s, use2: use2 }; });
    })).then(function (rs) {
      rs.forEach(function (r) { if (r.use2) r.src.cont2 = r.cont; else r.src.cont = r.cont; });
      var before = REC.all.length;
      REC.all.forEach(function (it) { REC.seen[it.id] = 1; }); // 이미 화면에 있는 영상은 다시 안 넣음
      recPrepare(rs, REC.all);
      recAddAll(rs);
      var add = recCompose(rs, every);
      REC.items = REC.items.concat(add);
      REC.moreBusy = false;
      // 지금 보기의 목록 끝에 붙임
      var list = REC.moreList;
      // 최신순·조회수순이면 새로 받은 것까지 다시 정렬해 그림 (뒤에 붙이면 순서가 틀어짐). 보던 자리는 그대로
      if (list && list === list0 && REC.view === view0 && (REC.sort || 'rec') !== 'rec') { var keepY = REC.el.scrollTop; recRender(); REC.el.scrollTop = keepY; }
      else if (list && list === list0 && REC.view === view0) (REC.view === 'all' ? add : recSpread(recBySc(REC.all.slice(before).filter(recInView)))).forEach(function (it) { list.appendChild(recBig(it, REC.view === 'all')); });
      if (REC.more) REC.more.textContent = '';
    });
  }

  // ---- 화면 ----
  function recCss() {
    if (document.getElementById('glide-rec-style')) return;
    // 색은 Glide가 정한 변수로 (유튜브 색 변수는 이 페이지에서 비어 있어 예전에는 어두운 테마 색이 늘 쓰였음 → 밝은 테마에서 '추천' 탭이 흰 바탕에 흰 글자)
    var C = 'var(--gr-chip)', T1 = 'var(--gr-t1)', T2 = 'var(--gr-t2)';
    var BG = 'var(--gr-bg)', RAISED = 'var(--gr-raised)', BLUE = 'var(--gr-blue)';
    var F = 'Roboto,"Noto Sans KR",sans-serif';
    var st = G.el('style', { id: 'glide-rec-style', 'data-glide': 'rec' });
    st.textContent =
      // 테마별 색 (html.glide-rec-dark: 페이지 글자색이 밝으면 어두운 테마. recTheme가 붙임)
      ':root{--gr-t1:#0f0f0f;--gr-t2:#606060;--gr-bg:#fff;--gr-raised:#fff;--gr-chip:rgba(0,0,0,.06);--gr-blue:#065fd4;--gr-green:#2e7d32;--gr-red:#cc0000;--gr-yellow:#a86f00;--gr-shadow:rgba(0,0,0,.18)}' +
      'html.glide-rec-dark{--gr-t1:#f1f1f1;--gr-t2:#aaa;--gr-bg:#0f0f0f;--gr-raised:#212121;--gr-chip:rgba(255,255,255,.1);--gr-blue:#3ea6ff;--gr-green:#6cc36c;--gr-red:#ff6b62;--gr-yellow:#e8b000;--gr-shadow:rgba(0,0,0,.45)}' +
      // 아래 메뉴 '추천' 칸: 글자·아이콘 색은 유튜브 아래 메뉴를 그대로 따름
      '#glide-rec-tab{flex:1 1 0;min-width:0;display:flex;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;color:inherit}' +
      '#glide-rec-tab .pivot-bar-item-tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:100%;height:100%}' +
      '#glide-rec-tab i{display:block;width:24px;height:24px;background-color:currentColor;-webkit-mask:url("' + SPARK_O + '") center/24px 24px no-repeat}' +
      'html.glide-rec-open #glide-rec-tab i{-webkit-mask-image:url("' + SPARK_F + '")}' +
      // 로그인하면 홈·구독 피드 위에 유튜브 칩 줄(고정, z 3)이 있어 추천 화면의 분류 칩을 덮음 (폰에서 확인) → 열려 있는 동안 숨김. 자리는 그대로(닫을 때 피드가 안 밀리게)
      'html.glide-rec-open ytm-feed-filter-chip-bar-renderer{visibility:hidden!important}' +
      'html.glide-rec-open ytm-pivot-bar-item-renderer [aria-selected=true] c3-icon[icon-state-filled]{display:none!important}' +
      'html.glide-rec-open ytm-pivot-bar-item-renderer [aria-selected=true] c3-icon[icon-state-outline]{display:inline-flex!important}' +
      // 추천 화면
      '#glide-rec{position:fixed;left:0;right:0;z-index:2;overflow-y:auto;overscroll-behavior:contain;background:' + BG + ';color:' + T1 + ';font-family:' + F + '}' +
      '#glide-rec[hidden]{display:none}#glide-rec button,#glide-rec-editor button{white-space:nowrap}#glide-rec,#glide-rec-editor,#glide-music,#glide-mp{word-break:keep-all;overflow-wrap:anywhere}' + // 한글을 낱말 단위로 줄바꿈 ('골라 보세/요'처럼 꺾였음, 폴드2 실기)
      '.gr-top{position:sticky;top:0;z-index:2;background:' + BG + '}' +
      '.gr-chips{display:flex;gap:8px;overflow-x:auto;padding:10px 12px;scrollbar-width:none}.gr-chips::-webkit-scrollbar,.gr-shelf::-webkit-scrollbar{display:none}' +
      '.gr-chip{all:unset;flex:none;padding:8px 12px;border-radius:8px;background:' + C + ';color:' + T1 + ';font:500 14px/1.2 ' + F + ';white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
      '.gr-chip[aria-pressed=true]{background:' + T1 + ';color:' + BG + '}' +
      '.gr-chip.icon{display:flex;align-items:center;justify-content:center;width:40px;padding:0;align-self:stretch}.gr-chip.icon i{width:20px;height:20px;background-color:currentColor;-webkit-mask:url("' + TUNE_I + '") center/20px 20px no-repeat}' +
      '.gr-sub{display:flex;gap:6px;overflow-x:auto;padding:0 12px 10px;scrollbar-width:none}.gr-sub::-webkit-scrollbar{display:none}' +
      '.gr-sub .gr-chip{padding:6px 10px;border-radius:16px;font-size:13px;background:transparent;box-shadow:inset 0 0 0 1px rgba(128,128,128,.4)}' +
      '.gr-sub .gr-chip[aria-pressed=true]{background:' + T1 + ';color:' + BG + ';box-shadow:none}' +
      // 영역 머리
      '.gr-sec{padding:6px 0 10px}' +
      '.gr-sh{display:flex;align-items:flex-end;gap:12px;padding:14px 12px 10px}' +
      '.gr-sh div{flex:1;min-width:0}.gr-sh h2{margin:0;font:700 18px/1.3 ' + F + ';color:' + T1 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.gr-sh p{margin:2px 0 0;font:400 12px/1.4 ' + F + ';color:' + T2 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.gr-sh button{all:unset;flex:none;padding:6px 10px;border-radius:16px;font:500 13px/1 ' + F + ';color:' + BLUE + ';cursor:pointer}' +
      '.gr-sh button.add{background:rgba(62,166,255,.14)}' +
      '.gr-line{height:1px;margin:6px 0 0;background:rgba(128,128,128,.16)}' +
      // 가로 줄 (작은 카드)
      '.gr-shelf{display:flex;gap:10px;overflow-x:auto;padding:0 12px;scroll-padding:0 12px;scroll-snap-type:x proximity;scrollbar-width:none}' +
      '.gr-small{flex:none;width:68%;max-width:300px;scroll-snap-align:start;text-decoration:none;color:inherit}' +
      '.gr-small .gr-thumb{border-radius:12px}' +
      '.gr-small .gr-t{margin-top:8px;font:400 14px/1.35 ' + F + '}' +
      // 큰 카드 (유튜브 앱 홈처럼 가장자리까지, 둥근 모서리 12 · 제목 보통 굵기 — 유튜브 목록 다듬기와 같은 값)
      '.gr-big{display:block;text-decoration:none;color:inherit;margin:0 0 14px}' +
      '.gr-thumb{position:relative;width:100%;aspect-ratio:16/9;border-radius:12px;background:rgba(128,128,128,.2);overflow:hidden}' +
      '.gr-thumb img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.gr-len{position:absolute;right:8px;bottom:8px;padding:1px 6px;border-radius:6px;background:rgba(0,0,0,.8);color:#fff;font:500 12px/1.5 ' + F + '}' +
      '.gr-info{display:flex;gap:12px;padding:14px 12px 0}' +
      '.gr-av{width:36px;height:36px;border-radius:50%;flex:none;object-fit:cover;background:rgba(128,128,128,.25)}' +
      '.gr-text{min-width:0;flex:1}' +
      '.gr-t{font:400 16px/19px ' + F + ';color:' + T1 + ';word-break:keep-all;overflow-wrap:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
      '.gr-m{margin-top:3px;font:400 12px/1.45 ' + F + ';color:' + T2 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gr-m span+span{margin-left:8px}' +
      '.gr-vw::before{content:"";display:inline-block;width:9px;height:10px;margin:calc((1lh - 10px) / 2) 2px 0 0;vertical-align:top;background-color:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 10 12%27 fill=%27none%27 stroke=%27%23000%27 stroke-width=%271.3%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M1.7 1.5 8.7 6l-7 4.5z%27/%3E%3C/svg%3E") center/9px 10px no-repeat}' +
      '.gr-why{margin-top:3px;font:500 12px/1.4 ' + F + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.gr-why.topic{color:' + BLUE + '}.gr-why.like{color:var(--gr-green)}.gr-why.trend{color:var(--gr-red)}.gr-why.new{color:var(--gr-yellow)}' +
      // 트렌드 검색어
      '.gr-words{display:flex;gap:6px;padding:0 12px 12px;overflow-x:auto;scrollbar-width:none}.gr-words::-webkit-scrollbar{display:none}' +
      '.gr-word{all:unset;flex:none;white-space:nowrap;padding:5px 10px;border-radius:14px;background:rgba(255,78,69,.12);color:var(--gr-red);font:500 13px/1.3 ' + F + ';cursor:pointer}' +
      // 안내 카드·상태
      '.gr-tip{display:flex;align-items:center;gap:10px;margin:2px 12px 4px;padding:10px 10px 10px 14px;border-radius:12px;background:' + C + ';font:500 14px/1.4 ' + F + '}' +
      '.gr-tip i{flex:none;width:20px;height:20px;background-color:' + BLUE + ';-webkit-mask:url("' + SPARK_F + '") center/18px 18px no-repeat}.gr-tip span{flex:1;min-width:0}' +
      '.gr-tip button{all:unset;flex:none;padding:8px 12px;border-radius:16px;background:' + T1 + ';color:' + BG + ';font:600 13px/1 ' + F + ';cursor:pointer}' +
      '.gr-card{margin:8px 12px 4px;padding:16px;border-radius:14px;background:' + C + '}' +
      '.gr-card b{display:block;font:600 15px/1.4 ' + F + '}.gr-card span{display:block;margin-top:4px;font:400 13px/1.5 ' + F + ';color:' + T2 + '}' +
      '.gr-card button{all:unset;margin-top:12px;padding:9px 14px;border-radius:18px;background:' + T1 + ';color:' + BG + ';font:500 14px/1 ' + F + ';cursor:pointer}' +
      '.gr-skel{margin:0 0 16px}.gr-skel .gr-thumb{animation:grp 1.2s ease-in-out infinite}.gr-skel i{display:block;height:12px;margin:12px 12px 0 60px;border-radius:6px;background:rgba(128,128,128,.2)}' +
      '@keyframes grp{50%{opacity:.5}}' +
      '.gr-more{padding:20px;text-align:center;color:' + T2 + ';font:400 13px/1.5 ' + F + '}' +
      // 설정 창 (아래에서 올라옴, 상용 앱 설정 화면처럼): 머리 · 묶음(굵은 제목 + 목록, 묶음 사이 회색 띠) · 아래 고정 저장 버튼
      '#glide-rec-editor{position:fixed;left:0;right:0;bottom:0;z-index:5;max-height:90%;display:flex;flex-direction:column;border-radius:20px 20px 0 0;background:' + RAISED + ';color:' + T1 + ';' +
      'box-shadow:0 -6px 24px var(--gr-shadow);font:400 14px/1.5 ' + F + ';animation:grup .24s cubic-bezier(.2,0,0,1)}' +
      '#glide-rec-scrim{position:fixed;inset:0;z-index:4;background:rgba(0,0,0,.45);animation:grfade .2s ease-out}' +
      '@keyframes grup{from{transform:translateY(100%)}}@keyframes grfade{from{opacity:0}}' +
      '#glide-rec-editor .grab{width:36px;height:4px;margin:8px auto 0;border-radius:2px;background:rgba(128,128,128,.45)}' +
      '#glide-rec-editor .eh{display:flex;align-items:center;padding:6px 6px 2px 20px}#glide-rec-editor .eh h3{flex:1;margin:0;font:700 20px/1.3 ' + F + '}' +
      '#glide-rec-editor .x{all:unset;width:44px;height:44px;border-radius:22px;text-align:center;font:400 20px/44px ' + F + ';color:' + T2 + ';cursor:pointer}' +
      '#glide-rec-editor .eb{flex:1;overflow-y:auto;overscroll-behavior:contain}' +
      '#glide-rec-editor .sec{padding:14px 20px 8px}#glide-rec-editor .sec+.sec{border-top:8px solid var(--gr-chip)}' +
      '#glide-rec-editor .st{display:flex;align-items:baseline;gap:8px;margin:0 0 10px}#glide-rec-editor .st h4{flex:1;margin:0;font:700 16px/1.3 ' + F + '}' +
      '#glide-rec-editor .st span{font:500 13px/1 ' + F + ';color:' + T2 + '}#glide-rec-editor .st span.warn{color:var(--gr-red)}' +
      // 검색칸
      '#glide-rec-editor .search{display:flex;align-items:center;gap:8px;height:44px;padding:0 6px 0 14px;border-radius:22px;background:var(--gr-chip)}' +
      '#glide-rec-editor .search i{flex:none;width:18px;height:18px;background-color:currentColor;opacity:.55;-webkit-mask:url("' + SEARCH_I + '") center/18px 18px no-repeat}' +
      '#glide-rec-editor .search input{all:unset;flex:1;min-width:0;font:400 15px/1.3 ' + F + ';color:inherit}#glide-rec-editor .search input::-webkit-search-cancel-button{display:none}' +
      '#glide-rec-editor .search input::placeholder{color:' + T2 + '}' +
      '#glide-rec-editor .clr{all:unset;width:32px;height:32px;border-radius:16px;text-align:center;font:400 14px/32px ' + F + ';color:' + T2 + ';cursor:pointer}#glide-rec-editor .clr[hidden]{display:none}' +
      // 고른 주제: 진한 알약, 누르면 빠짐
      '#glide-rec-editor .picked{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 2px}' +
      '#glide-rec-editor .pk{all:unset;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px 0 14px;border-radius:16px;background:' + T1 + ';color:' + RAISED + ';font:500 14px/1 ' + F + ';cursor:pointer}' +
      '#glide-rec-editor .pk::after{content:"✕";font-size:11px;opacity:.7}' +
      '#glide-rec-editor .hint{margin:2px 0;color:' + T2 + ';font:400 13px/1.5 ' + F + '}' +
      // 분류 탭 (밑줄) + 주제 칩 (✓로 켜고 끔)
      '#glide-rec-editor .tabs{display:flex;gap:2px;margin:14px -20px 0;padding:0 14px;overflow-x:auto;scrollbar-width:none;box-shadow:inset 0 -1px 0 rgba(128,128,128,.2)}#glide-rec-editor .tabs::-webkit-scrollbar{display:none}#glide-rec-editor .tabs[hidden]{display:none}' +
      '#glide-rec-editor .tabs button{all:unset;flex:none;padding:10px 8px 9px;font:500 14px/1.2 ' + F + ';color:' + T2 + ';border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap}' +
      '#glide-rec-editor .tabs button[aria-selected=true]{color:' + T1 + ';border-bottom-color:' + T1 + ';font-weight:700}' +
      '#glide-rec-editor .grid{display:flex;flex-wrap:wrap;gap:8px;padding:14px 0 6px;min-height:84px;align-content:flex-start}' +
      '#glide-rec-editor .opt{all:unset;display:inline-flex;align-items:center;gap:5px;height:36px;padding:0 14px;border-radius:18px;box-shadow:inset 0 0 0 1px rgba(128,128,128,.35);font:500 14px/1 ' + F + ';cursor:pointer;-webkit-tap-highlight-color:transparent}' +
      '#glide-rec-editor .opt[aria-pressed=true]{box-shadow:none;background:' + T1 + ';color:' + RAISED + '}#glide-rec-editor .opt[aria-pressed=true]::before{content:"✓";font-weight:700}' +
      '#glide-rec-editor .opt.addq{box-shadow:inset 0 0 0 1px ' + BLUE + ';color:' + BLUE + '}' +
      // 목록 줄 (제목·설명 + 스위치/버튼)
      '#glide-rec-editor .li{display:flex;align-items:center;gap:16px;min-height:52px;padding:8px 0}#glide-rec-editor .li+.li{box-shadow:inset 0 1px 0 rgba(128,128,128,.14)}' +
      '#glide-rec-editor .li>div{flex:1;min-width:0}#glide-rec-editor .li b{display:block;font:500 15px/1.4 ' + F + '}#glide-rec-editor .li span{display:block;margin-top:1px;font:400 13px/1.45 ' + F + ';color:' + T2 + '}' +
      '#glide-rec-editor .li.col{display:block}' +
      '#glide-rec-editor .li input[type=checkbox]{appearance:none;-webkit-appearance:none;flex:none;width:46px;height:28px;margin:0;border-radius:14px;background:rgba(128,128,128,.4);position:relative;cursor:pointer;transition:background .15s}' +
      '#glide-rec-editor .li input[type=checkbox]::before{content:"";position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}' +
      '#glide-rec-editor .li input[type=checkbox]:checked{background:' + BLUE + '}#glide-rec-editor .li input[type=checkbox]:checked::before{transform:translateX(18px)}' +
      // 섞는 정도: 한 덩어리 선택 막대
      '#glide-rec-editor .seg{display:flex;margin:10px 0 4px;padding:3px;border-radius:12px;background:var(--gr-chip)}' +
      '#glide-rec-editor .seg button{all:unset;flex:1;padding:8px 2px;border-radius:9px;text-align:center;font:500 14px/1.2 ' + F + ';color:' + T2 + ';cursor:pointer}' +
      '#glide-rec-editor .seg button[aria-pressed=true]{background:' + RAISED + ';color:' + T1 + ';font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.18)}' +
      '#glide-rec-editor .danger{all:unset;flex:none;padding:8px 14px;border-radius:18px;color:var(--gr-red);font:500 14px/1 ' + F + ';cursor:pointer}#glide-rec-editor .danger.on{background:rgba(255,78,69,.12)}' +
      '#glide-rec-editor .note{margin:0;padding:6px 20px 18px;color:' + T2 + ';font:400 12px/1.5 ' + F + '}' +
      '#glide-rec-editor .ef{padding:10px 16px 14px;box-shadow:0 -1px 0 rgba(128,128,128,.16)}' +
      '#glide-rec-editor .save{all:unset;display:block;box-sizing:border-box;width:100%;height:48px;border-radius:24px;background:' + T1 + ';color:' + RAISED + ';font:600 16px/48px ' + F + ';text-align:center;cursor:pointer}' +
      '#glide-rec-editor .save:active,#glide-rec-editor .opt:active,#glide-rec-editor .pk:active{opacity:.7}' +
      // 카드 ⋮ 메뉴 (1.0.1): 유튜브 앱처럼 제목 오른쪽 · 누르는 칸 40dp
      '.gr-more{all:unset;flex:none;width:32px;height:40px;margin:-8px -8px 0 -4px;display:flex;align-items:flex-start;justify-content:center;padding-top:8px;box-sizing:border-box;color:' + T1 + ';cursor:pointer;-webkit-tap-highlight-color:transparent}' +
      '.gr-more::before{content:"";width:4px;height:18px;background:radial-gradient(circle,currentColor 1.6px,transparent 1.9px) 0 0/4px 6px repeat-y}' +
      '.gr-small .gr-row{display:flex;align-items:flex-start;gap:4px}.gr-small .gr-row>div{flex:1;min-width:0}.gr-small .gr-more{margin-top:0}' +
      '#glide-rec-menu{position:fixed;left:8px;right:8px;bottom:8px;z-index:6;padding:8px 0;border-radius:16px;background:' + RAISED + ';color:' + T1 + ';box-shadow:0 6px 24px var(--gr-shadow);font:400 15px/1.4 ' + F + ';animation:grup .2s cubic-bezier(.2,0,0,1)}' +
      '#glide-rec-menu .mt{padding:8px 20px 10px;color:' + T2 + ';font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#glide-rec-menu button{all:unset;display:block;box-sizing:border-box;width:100%;min-height:48px;padding:13px 20px;cursor:pointer}#glide-rec-menu button:active{background:var(--gr-chip)}' +
      '#glide-rec-editor .opt.off[aria-pressed=true]{background:var(--gr-red);color:#fff}#glide-rec-editor .opt.off[aria-pressed=true]::before{content:"⊘"}' +
      '#glide-rec-editor .link{all:unset;display:flex;align-items:center;gap:8px;width:100%;min-height:48px;cursor:pointer;color:' + BLUE + ';font:500 14px/1.4 ' + F + '}' +
      '.gr-why.hid{color:var(--gr-red)}' +
      '#glide-rec-editor .tg{margin-top:10px;font:600 13px/1.3 ' + F + ';color:' + T2 + '}';
    (document.head || document.documentElement).appendChild(st);
  }
  function recEnsureTab() {
    var tab = document.getElementById('glide-rec-tab');
    if (!recOn()) { if (tab) tab.parentNode.removeChild(tab); if (REC.open) recClose(); return; }
    var bar = document.querySelector('ytm-pivot-bar-renderer');
    if (!bar) return;
    var items = bar.querySelectorAll('ytm-pivot-bar-item-renderer');
    if (!items.length) return;
    // 홈 · 구독 · 추천 · (음악) · 내 페이지: 음악 탭이 있으면 그 앞, 없으면 마지막 칸(내 페이지) 바로 앞
    var music = document.getElementById('glide-music-tab');
    var last = music && music.parentNode === bar ? music : items[items.length - 1];
    if (tab && tab.parentNode === bar && tab.nextElementSibling === last) return;
    recCss();
    if (!tab) {
      tab = G.el('div', { id: 'glide-rec-tab', role: 'tab', 'aria-label': '추천' }, [G.el('div', { 'class': 'pivot-bar-item-tab' }, [G.el('i'), G.el('div', { 'class': 'pivot-bar-item-title', text: '추천' })])]);
      tab.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); if (REC.open) recTop(); else recOpen(); }, true);
    }
    bar.insertBefore(tab, last);
  }
  function recBuildDom() {
    if (REC.el && REC.el.isConnected) return;
    recCss();
    REC.top = G.el('div', { 'class': 'gr-top' });
    REC.body = G.el('div', {});
    REC.more = G.el('div', { 'class': 'gr-more' });
    REC.el = G.el('div', { id: 'glide-rec', hidden: '' }, [REC.top, REC.body, REC.more]);
    document.body.appendChild(REC.el);
    REC.el.addEventListener('scroll', function () {
      if (REC.el.scrollTop + REC.el.clientHeight > REC.el.scrollHeight - 900) recLoadMore();
      reportPull();
    }, { passive: true });
  }
  function recPlace() {
    if (!REC.el) return;
    var tb = gmBars(true);
    REC.el.style.top = tb[0] + 'px'; REC.el.style.bottom = tb[1] + 'px';
  }
  G.onCommand('openRec', function () { if (role() !== 'browse') return; try { if (GM && GM.open) gmClose(); if (!REC.open) recOpen(); } catch (e) { /* ignore */ } });
  function recOpen() {
    if (!recOn()) return;
    if (GM && GM.open) gmClose();
    recBuildDom();
    REC.open = true; REC.path = location.pathname + location.search;
    // 뒤의 홈 목록은 맨 위로 (앱의 당겨서 새로고침은 웹 화면이 맨 위일 때만 됨). 닫으면 원래 위치로
    REC.homeY = W.scrollY || 0;
    if (REC.homeY) W.scrollTo(0, 0);
    document.documentElement.classList.add('glide-rec-open');
    recPlace();
    REC.el.hidden = false;
    lastGeom = ''; reportGeom(); lastPull = null; reportPull();
    log('info', '추천 탭 열기');
    // 설정 창을 먼저 띄우지 않고 바로 영상 목록 (사용자 요청). 주제가 없어도 본 영상과 비슷한·트렌드·새 주제로 채우고, 설정은 위의 ⚙로
    recTheme();
    recLoad(false);
    // 목록을 다시 받지 않았으면(30분 안) 닫기 전 위치로
    if (REC.keepTop && !REC.loading && Date.now() - (REC.keepAt || 0) < 30 * 60e3) {
      var kt = REC.keepTop;
      W.requestAnimationFrame(function () { if (REC.open && REC.el) REC.el.scrollTop = kt; });
    }
  }
  function recClose() {
    if (!REC.open) return;
    REC.open = false;
    recEditorClose(); recMenuClose();
    // 다시 열 때 보던 자리로 (유튜브 앱처럼 탭마다 위치 유지, 2026-11-20 사용자 요청)
    if (REC.el) { REC.keepTop = REC.el.scrollTop; REC.keepAt = Date.now(); }
    if (REC.el) REC.el.hidden = true;
    document.documentElement.classList.remove('glide-rec-open');
    if (REC.homeY && location.pathname + location.search === REC.path) W.scrollTo(0, REC.homeY);
    lastGeom = ''; reportGeom(); lastPull = null; reportPull();
  }
  function recTop() { if (REC.el) REC.el.scrollTo({ top: 0, behavior: 'smooth' }); }
  function recClear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
  function recBtn(cls, text, onClick, attrs) {
    var b = G.el('button', Object.assign({ type: 'button', 'class': cls, text: text }, attrs || {}));
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); onClick(); });
    return b;
  }
  function recWhy(it) {
    var k = it.tag.kind;
    return k === 'topic' ? '내 주제 · ' + it.tag.label : k === 'like' ? '본 영상과 비슷' : k === 'trend' ? '트렌드 · ' + it.tag.label : '새 주제 · ' + it.tag.label;
  }
  function recThumb(it) { return G.el('div', { 'class': 'gr-thumb' }, [G.el('img', { src: it.thumb, alt: '', loading: 'lazy', decoding: 'async' }), it.len ? G.el('span', { 'class': 'gr-len', text: it.len }) : null]); }
  // 채널  ▷12만  5일 전 (유튜브 앱 목록과 같은 모양, 위 '목록 정보 줄')
  function recMeta(parts) {
    return G.el('div', { 'class': 'gr-m' }, parts.filter(Boolean).map(function (p) { var v = gvText(p); return G.el('span', v ? { 'class': 'gr-vw', text: v } : { text: p }); }));
  }
  // 큰 카드: 유튜브 앱 홈처럼 썸네일 · 채널 사진 · 제목 · 채널·조회수·날짜 (섞인 목록이면 왜 골랐는지 한 줄)
  function recBig(it, why) {
    var text = G.el('div', { 'class': 'gr-text' }, [
      G.el('div', { 'class': 'gr-t', text: it.title }),
      recMeta([it.ch, it.views, it.age]),
      it.why ? G.el('div', { 'class': 'gr-why hid', text: '거른 이유: ' + it.why }) : why ? G.el('div', { 'class': 'gr-why ' + it.tag.kind, text: recWhy(it) }) : null
    ]);
    var info = G.el('div', { 'class': 'gr-info' }, [it.avatar ? G.el('img', { 'class': 'gr-av', src: it.avatar, alt: '', loading: 'lazy' }) : G.el('div', { 'class': 'gr-av' }), text, it.why ? null : recMoreBtn(it)]);
    // 누르면 둘러보기 웹뷰의 링크 가로채기(위 '웹뷰 2개')가 영상 칸에서 엶
    return G.el('a', { 'class': 'gr-big', href: '/watch?v=' + it.id, 'data-sc': it.sc ? it.sc.toFixed(2) : '' }, [recThumb(it), info]);
  }
  // 작은 카드: 가로 줄 안
  function recSmall(it) {
    return G.el('a', { 'class': 'gr-small', href: '/watch?v=' + it.id }, [recThumb(it), G.el('div', { 'class': 'gr-row' }, [G.el('div', {}, [G.el('div', { 'class': 'gr-t', text: it.title }), recMeta([it.ch, it.views, it.age])]), recMoreBtn(it)])]);
  }
  // ⋮ 메뉴 (1.0.1): 관심 없음 · 이 채널 안 보기 — 홈의 ⋮ 메뉴와 같은 목록(hiddenVideos · blockChannels)에 저장, 아래 알림에서 실행 취소
  function recMoreBtn(it) {
    var b = G.el('button', { type: 'button', 'class': 'gr-more', 'aria-label': '메뉴' });
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); recMenu(it); });
    return b;
  }
  function recMenuClose() { var had = false; ['glide-rec-menu', 'glide-rec-mscrim'].forEach(function (id) { var x = document.getElementById(id); if (x) { x.remove(); had = true; } }); if (had) { lastGeom = ''; reportGeom(); } }
  function recMenu(it) {
    recMenuClose();
    if (FB.toast && FB.toast.isConnected) FB.toast.remove(); // 앞서 뜬 알림이 메뉴를 가리지 않게
    var chKey = it.handle || it.chId || it.ch;
    var scrim = G.el('div', { id: 'glide-rec-mscrim', style: 'position:fixed;inset:0;z-index:6;background:rgba(0,0,0,.4)' });
    scrim.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); recMenuClose(); });
    var m = G.el('div', { id: 'glide-rec-menu', role: 'menu' }, [
      G.el('div', { 'class': 'mt', text: it.title }),
      recBtn('', '관심 없음', function () { recMenuClose(); recDrop('video', it); }, { role: 'menuitem' }),
      chKey ? recBtn('', '‘' + (it.ch || chKey) + '’ 채널 안 보기', function () { recMenuClose(); recDrop('channel', it); }, { role: 'menuitem' }) : null,
      recBtn('', '취소', recMenuClose, { role: 'menuitem' })
    ]);
    document.body.appendChild(scrim); document.body.appendChild(m);
    lastGeom = ''; reportGeom();
  }
  // 화면·목록에서 빼고 앱 목록에 저장. 실행 취소하면 목록에서 지우고 그 자리로 되돌림 (다시 그림)
  function recDrop(kind, it) {
    var match = kind === 'video' ? function (x) { return x.id === it.id; }
      : function (x) { return (it.chId && x.chId === it.chId) || (it.handle && x.handle === it.handle) || (x.ch && x.ch === it.ch); };
    var value = kind === 'video' ? it.id : (it.handle || it.chId || it.ch);
    var saved = { all: REC.all.slice(), items: REC.items.slice(), srcs: REC.srcs.map(function (s) { return s.items.slice(); }) };
    REC.all = REC.all.filter(function (x) { return !match(x); });
    REC.items = REC.items.filter(function (x) { return !match(x); });
    REC.srcs.forEach(function (s) { s.items = s.items.filter(function (x) { return !match(x); }); });
    var st = recSt(), key = kind === 'video' ? 'hiddenVideos' : 'blockChannels', list = (st[key] || []).slice();
    if (list.indexOf(value) < 0) list.push(value);
    var patch = {}; patch[key] = list;
    REC.override = Object.assign({}, REC.override || {}, patch); // 앱이 새 설정을 보내기 전에도 바로 반영
    G.send('blockAdd', { kind: kind, value: value, label: kind === 'video' ? it.title : it.ch });
    G.send('haptic', { kind: 'gesture' });
    log('info', '추천 탭: ' + (kind === 'video' ? '관심 없음 [' + it.id + ']' : '채널 안 보기 ' + value));
    var y = REC.el ? REC.el.scrollTop : 0;
    recRender(); if (REC.el) REC.el.scrollTop = y;
    fbToast(kind === 'video' ? '관심 없음으로 표시했어요' : '‘' + (it.ch || value) + '’ 채널을 안 보여 드려요', function () {
      G.send('blockRemove', { kind: kind, value: value });
      var p = {}; p[key] = (recSt()[key] || []).filter(function (v) { return v !== value; });
      REC.override = Object.assign({}, REC.override || {}, p);
      REC.all = saved.all; REC.items = saved.items; REC.srcs.forEach(function (s, i) { if (saved.srcs[i]) s.items = saved.srcs[i]; });
      var y2 = REC.el ? REC.el.scrollTop : 0; recRender(); if (REC.el) REC.el.scrollTop = y2;
    });
  }
  function recHead(title, sub, action, onAction, addStyle) {
    return G.el('div', { 'class': 'gr-sh' }, [G.el('div', {}, [G.el('h2', { text: title }), sub ? G.el('p', { text: sub }) : null]), action ? recBtn(addStyle ? 'add' : '', action, onAction) : null]);
  }
  function recShelf(title, sub, items, action, onAction, addStyle) {
    if (!items.length) return null;
    return G.el('section', { 'class': 'gr-sec' }, [recHead(title, sub, action, onAction, addStyle), G.el('div', { 'class': 'gr-shelf' }, items.slice(0, 10).map(recSmall))]);
  }
  function recGo(view, sub) { REC.view = view; REC.sub = sub || ''; recRender(); if (REC.el) REC.el.scrollTop = 0; }
  function recInView(it) { return it.tag.kind === REC.view && (!REC.sub || it.tag.label === REC.sub); }
  function recAddTopic(q) {
    var st = recSt(), t = (st.recTopics || []).slice();
    if (t.indexOf(q) >= 0) { fbToast('이미 내 주제에 있어요 · ' + q, null); return; }
    // 예전에는 12개에서 말없이 안 됐음(고를 수 있는 건 20개)
    if (t.length >= REC_MAX_TOPICS) { fbToast('내 주제는 ' + REC_MAX_TOPICS + '개까지예요 · 설정에서 하나를 빼 주세요', null); return; }
    t.push(q);
    REC.override = Object.assign({}, REC.override || {}, { recTopics: t });
    G.send('recSave', { recTopics: t });
    log('info', '추천 탭: 새 주제를 내 주제에 추가 [' + q + ']');
    fbToast('내 주제에 넣었어요 · ' + q, null);
    recLoad(true);
  }
  function recRender() {
    if (!REC.el) return;
    var st = recSt(), topics = st.recTopics || [];
    // 위: 분류 칩 (⚙ · 전체 · 내 주제 · 비슷한 영상 · 트렌드 · 새 주제) + 분류 안 세부 칩
    recClear(REC.top);
    var setBtn = recBtn('gr-chip icon', '', function () { recEditor(false); }, { 'aria-label': '추천 설정' });
    setBtn.appendChild(G.el('i'));
    var chips = G.el('div', { 'class': 'gr-chips' }, [setBtn]);
    REC_VIEWS.forEach(function (v) { chips.appendChild(recBtn('gr-chip', v[1], function () { recGo(v[0]); }, { 'aria-pressed': String(REC.view === v[0]) })); });
    REC.top.appendChild(chips);
    if (REC.view !== 'all') {
      var labels = [];
      REC.all.forEach(function (it) { if (it.tag.kind === REC.view && it.tag.kind !== 'like' && labels.indexOf(it.tag.label) < 0) labels.push(it.tag.label); });
      if (labels.length > 1) {
        var sub = G.el('div', { 'class': 'gr-sub' }, [recBtn('gr-chip', '모두', function () { recGo(REC.view); }, { 'aria-pressed': String(!REC.sub) })]);
        labels.forEach(function (l) { sub.appendChild(recBtn('gr-chip', l, function () { recGo(REC.view, l); }, { 'aria-pressed': String(REC.sub === l) })); });
        REC.top.appendChild(sub);
      }
    }
    // 정렬: 추천순(기본, 아래 구성 그대로) · 최신순 · 조회수순 (2026-11-23 사용자) — 고르면 지금 보기의 영상을 한 목록으로 정렬
    var sorts = G.el('div', { 'class': 'gr-sub gr-sort' });
    [['rec', '추천순'], ['new', '최신순'], ['view', '조회수순']].forEach(function (o) {
      sorts.appendChild(recBtn('gr-chip', o[1], function () { if ((REC.sort || 'rec') === o[0]) return; REC.sort = o[0]; recRender(); if (REC.el) REC.el.scrollTop = 0; }, { 'aria-pressed': String((REC.sort || 'rec') === o[0]) }));
    });
    if (REC.view !== 'hidden') REC.top.appendChild(sorts);
    recClear(REC.body); REC.moreList = null; REC.more.textContent = '';
    // 거른 영상 보기 (설정 창에서): 무엇이 왜 빠졌는지 확인 (보기 싫은 주제가 엉뚱한 영상을 거르지 않는지)
    if (REC.view === 'hidden') {
      var hl = REC.hidden || [];
      REC.body.appendChild(recHead('거른 영상 ' + hl.length + '개', '이번에 불러온 추천에서 뺀 영상이에요 · 뒤로 가면 추천으로'));
      hl.slice().reverse().forEach(function (it) { REC.body.appendChild(recBig(it, false)); });
      if (!hl.length) REC.body.appendChild(recNote('거른 영상이 없어요', '조회수가 적거나 보기 싫은 주제인 영상이 있으면 여기에 모여요'));
      return;
    }
    if ((REC.sort || 'rec') !== 'rec' && REC.all.length && !REC.failed) {
      var pool = REC.view === 'all' ? REC.all.slice() : REC.all.filter(recInView), seenS = {};
      pool = pool.filter(function (it) { if (seenS[it.id]) return false; seenS[it.id] = 1; return true; });
      var key = REC.sort === 'new' ? function (it) { var a = gmAge(it.age); return a < 0 ? Infinity : a; } : function (it) { var v = gmViews(it.views); return v < 0 ? -1 : -v; };
      pool = pool.map(function (it, i) { return { it: it, k: key(it), i: i }; }).sort(function (a, b) { return a.k - b.k || a.i - b.i; }).map(function (o) { return o.it; });
      var sl = G.el('div', {});
      pool.forEach(function (it) { sl.appendChild(recBig(it, REC.view === 'all')); });
      REC.body.appendChild(sl);
      REC.moreList = sl;
      if (!pool.length) REC.body.appendChild(recNote('여기에 보여 드릴 영상이 아직 없어요', '추천순으로 바꿔 보세요'));
      return;
    }
    if (REC.loading && !REC.all.length) { // 불러오는 동안 빈 카드 모양
      for (var s = 0; s < 3; s++) REC.body.appendChild(G.el('div', { 'class': 'gr-skel' }, [G.el('div', { 'class': 'gr-thumb' }), G.el('i'), G.el('i', { style: 'width:40%' })]));
      return;
    }
    if (REC.failed) { REC.body.appendChild(recNote('영상을 불러오지 못했어요', '인터넷 연결을 확인하고 다시 시도해 주세요', '다시 시도', function () { recLoad(true); })); return; }
    if (REC.view === 'all') recRenderAll(st, topics);
    else {
      var list = G.el('div', {});
      // 추천순: 점수 순 (주제가 여럿이면 주제마다 돌아가며, 한 채널 몰림 풀기)
      var shown = recSpread(recRR(recBySc(REC.all.filter(recInView))));
      shown.forEach(function (it) { list.appendChild(recBig(it, false)); });
      REC.body.appendChild(list);
      REC.moreList = list;
      if (!shown.length) REC.body.appendChild(REC.view === 'topic' && !topics.length
        ? recNote('아직 고른 주제가 없어요', '좋아하는 주제나 키워드를 고르면 그 영상만 모아 보여 드려요', '주제 고르기', function () { recEditor(true); })
        : recNote('여기에 보여 드릴 영상이 아직 없어요', REC.view === 'like' ? 'Glide에서 영상을 끝까지 보면 그와 비슷한 영상을 골라 드려요' : '설정에서 이 항목이 꺼져 있는지 확인해 주세요', '설정', function () { recEditor(false); }));
    }
  }
  function recNote(title, text, b, onB) { return G.el('div', { 'class': 'gr-card' }, [G.el('b', { text: title }), G.el('span', { text: text }), b ? recBtn('', b, onB) : null]); }
  // '전체' 보기: 맞춤 추천(큰 카드 5개) → 내 주제별 줄 → 본 영상과 비슷한 → 요즘 트렌드 → 새로운 주제 → 더 많은 추천
  function recRenderAll(st, topics) {
    var B = REC.body, used = {};
    var mix = REC.items.slice(0, 5);
    mix.forEach(function (it) { used[it.id] = 1; });
    // 줄에 실제로 보이는 것만 '쓴 것'으로 (나머지는 아래 '더 많은 추천'으로)
    function fresh(items, n) { var out = []; items.forEach(function (it) { if (out.length < (n || 10) && !used[it.id]) { used[it.id] = 1; out.push(it); } }); return out; }
    function bySrc(kind) { return REC.srcs.filter(function (s) { return s.tag.kind === kind; }); }
    function ofSrc(s) { var ids = {}; s.items.forEach(function (x) { ids[x.id] = 1; }); return REC.all.filter(function (it) { return ids[it.id] && it.tag.kind === s.tag.kind && it.tag.label === s.tag.label; }); }
    if (!topics.length) B.appendChild(G.el('div', { 'class': 'gr-tip' }, [G.el('i'), G.el('span', { text: '관심 주제를 골라 보세요' }), recBtn('', '주제 고르기', function () { recEditor(true); })]));
    if (mix.length) {
      B.appendChild(G.el('section', { 'class': 'gr-sec' }, [recHead('맞춤 추천', '내 주제·본 영상·트렌드에서 골라 섞었어요')].concat(mix.map(function (it) { return recBig(it, true); }))));
      B.appendChild(G.el('div', { 'class': 'gr-line' }));
    }
    bySrc('topic').forEach(function (s) { var el = recShelf(s.tag.label, '내 주제', fresh(ofSrc(s)), '전체 ›', function () { recGo('topic', s.tag.label); }); if (el) B.appendChild(el); });
    var like = []; bySrc('like').forEach(function (s) { like = like.concat(ofSrc(s)); });
    var last = REC.hist[0] && REC.hist[0].title;
    var le = recShelf('본 영상과 비슷한', last ? '‘' + last.slice(0, 24) + (last.length > 24 ? '…' : '') + '’ 등을 보고 골랐어요' : '', fresh(like), '전체 ›', function () { recGo('like'); });
    if (le) B.appendChild(le);
    if (st.recTrends !== false && (REC.trendWords || []).length) {
      var tr = []; bySrc('trend').forEach(function (s) { tr = tr.concat(ofSrc(s).slice(0, 4)); });
      var sec = G.el('section', { 'class': 'gr-sec' }, [recHead('요즘 트렌드', '구글 트렌드 · 한국 실시간 검색어', '전체 ›', function () { recGo('trend'); })]);
      var words = G.el('div', { 'class': 'gr-words' });
      REC.trendWords.slice(0, 10).forEach(function (w) {
        var have = bySrc('trend').some(function (s) { return s.tag.label === w; });
        words.appendChild(recBtn('gr-word', '# ' + w, function () { if (have) recGo('trend', w); else recSearchWord(w); }));
      });
      sec.appendChild(words);
      var shelf = fresh(tr);
      if (shelf.length) sec.appendChild(G.el('div', { 'class': 'gr-shelf' }, shelf.slice(0, 10).map(recSmall)));
      B.appendChild(sec);
    }
    bySrc('new').forEach(function (s) {
      var el = recShelf('새로운 주제 · ' + s.tag.label, '평소와 다른 주제도 가끔 섞어 드려요', fresh(ofSrc(s), 6), '+ 내 주제', function () { recAddTopic(s.tag.label); }, true);
      if (el) B.appendChild(el);
    });
    // 더 많은 추천: 줄에 안 나온 나머지를 출처별로 돌아가며, 새 주제는 같은 비율로
    var lm = [], ln = [];
    REC.all.forEach(function (it) { if (!used[it.id]) (it.tag.kind === 'new' ? ln : lm).push(it); });
    var rest = recMix(recRR(lm), recRR(ln), +st.recNewEvery || 0);
    B.appendChild(G.el('div', { 'class': 'gr-line' }));
    B.appendChild(recHead('더 많은 추천', '아래로 내리면 계속 골라 드려요'));
    var list = G.el('div', {});
    rest.forEach(function (it) { list.appendChild(recBig(it, true)); });
    B.appendChild(list);
    REC.moreList = list;
  }
  // 트렌드 검색어 중 아직 영상을 받지 않은 것: 받아서 트렌드 보기로
  function recSearchWord(w) {
    REC.more.textContent = '‘' + w + '’ 영상을 찾는 중…';
    recSearch(w, SP_WEEK, { kind: 'trend', label: w }).then(function (s) { REC.srcs.push(s); recAddAll([s]); recGo('trend', w); });
  }

  // ---- 설정 (아래에서 올라오는 창): 내 주제 · 골라 보기(묶음별) · 섞는 방법 ----
  // 1.9.0 (사용자: '관심 주제를 더 폭넓고 세분화해서'): 4개 분류 20개 → 15개 분류. 각 주제는 그대로 유튜브 검색어로 쓰이므로 검색이 잘 되는 말로
  var REC_GROUPS = [
    ['과학·우주', ['우주 과학 다큐', '천문학 강의', '블랙홀 설명', '물리학 쉽게', '화학 실험', '과학 실험', '생명과학 이야기', '양자역학 입문', '지구과학 지진 화산', '과학 뉴스 해설']],
    ['역사·사회', ['세계사 이야기', '한국사 강의', '역사 미스터리', '고대 문명', '전쟁사 다큐', '조선시대 이야기', '근현대사 해설', '지정학 해설', '사회 이슈 해설', '인물 다큐']],
    ['인문·교양', ['철학 강의', '심리학 강의', '인문학 강연', '책 리뷰 북튜브', '언어학 이야기', '신화 이야기', '종교 역사 해설', '교양 강연 TED']],
    ['경제·돈', ['경제 기초 강의', '주식 투자 공부', '부동산 시장 해설', '재테크 절약', '창업 성공 스토리', '기업 분석', '세계 경제 뉴스 해설', '가계부 돈 관리']],
    ['IT·테크', ['최신 기술 리뷰', '스마트폰 리뷰', '인공지능 AI 소식', '코딩 강의', '컴퓨터 조립', '전자기기 언박싱', '앱 추천 꿀팁', '반도체 이야기', '전기차 리뷰']],
    ['자연·동물', ['자연 다큐멘터리', '동물 다큐', '바다 생물 다큐', '야생동물 다큐', '곤충 다큐', '반려견 훈련', '고양이 영상', '식물 키우기', '날씨 기후 다큐']],
    ['여행·아웃도어', ['세계 여행 브이로그', '국내 여행 추천', '일본 여행', '유럽 여행', '등산 캠핑', '차박 캠핑', '낚시', '도시 걷기 영상', '오지 탐험']],
    ['요리·음식', ['요리 레시피', '집밥 반찬', '자취 요리', '베이킹 디저트', '맛집 탐방', '세계 음식 문화', '술 칵테일', '커피 홈카페', '먹방']],
    ['건강·운동', ['홈트레이닝', '요가 스트레칭', '러닝 마라톤', '헬스 근력운동', '다이어트 식단', '건강 정보 의사', '수면 명상', '자세 교정']],
    ['스포츠', ['축구 하이라이트', '야구 하이라이트', '농구 NBA', '테니스', '골프 레슨', 'F1 모터스포츠', '격투기 UFC', '스포츠 분석', '올림픽 명장면']],
    ['게임', ['게임 리뷰', '신작 게임 소개', '게임 공략', '인디 게임', '레트로 게임', 'e스포츠 하이라이트', '롤 리그오브레전드', '마인크래프트', '닌텐도 스위치 게임']],
    ['음악', ['클래식 음악 해설', '재즈 라이브', '케이팝 무대', '인디 음악 라이브', '피아노 연주', '기타 연주 강좌', '작곡 음악 이론', '노래 커버', '플레이리스트 카페 음악']],
    ['영화·드라마·예능', ['영화 리뷰', '영화 결말 해석', '드라마 리뷰', '애니메이션 리뷰', '예능 하이라이트', '다큐멘터리 추천', '명작 영화 해설', '배우 인터뷰']],
    ['예술·디자인·만들기', ['미술 작품 해설', '그림 그리기 강좌', '건축 이야기', '인테리어 집꾸미기', '디자인 영감', '사진 촬영 강좌', '영상 편집 강좌', '목공 DIY', '패션 스타일링']],
    ['생활·자기계발', ['공부 자극 동기부여', '공부법', '영어 회화', '일본어 공부', '자기계발 습관', '정리 정돈 미니멀', '육아 정보', '자동차 정비 상식', '생활 꿀팁']]
  ];
  function recEditorClose() {
    var sc = document.getElementById('glide-rec-scrim');
    if (sc) sc.remove();
    if (REC.editor) { if (REC.editor.parentNode) REC.editor.parentNode.removeChild(REC.editor); REC.editor = null; lastGeom = ''; reportGeom(); }
  }
  // 설정 창 (1.8.5 다시 배치): 관심 주제(검색 · 고른 주제 · 분류 탭 · 체크 칩) → 추천에 섞기(스위치 목록) → 기록 → 안내 → 저장
  //  - 예전 '골라 보기'는 분류별 '+ 주제' 칩을 길게 늘어놓아 스크롤이 길고, 고르면 칩이 위로 옮겨 가 자리가 바뀌었음(사용자: '별로')
  //  - 이제 칩은 제자리에서 ✓로 켜고 끄며, 검색하면 모든 분류에서 찾고 없으면 그 말 그대로 추가
  var REC_MAX_TOPICS = 20; // 1.9.0: 주제가 많아져 12 → 20
  var REC_QUALITY = [['off', '끄기', '조회수와 상관없이 다 보여 줘요'], ['normal', '보통', '올린 날짜에 비해 조회수가 너무 적은 영상·같은 영상을 퍼 온 영상을 빼요'], ['strong', '강하게', '보통보다 3배 엄격하게 빼요 (작은 채널 영상도 많이 빠져요)']];
  var REC_EVERY = [[0, '끄기', '새로운 주제를 섞지 않아요'], [10, '가끔', '10개 중 1개 정도'], [5, '보통', '5개 중 1개 정도'], [3, '자주', '3개 중 1개 정도']];
  function recEditor(first) {
    recEditorClose();
    var st = recSt();
    var topics = (st.recTopics || []).slice();
    var auto = st.recAuto !== false, trends = st.recTrends !== false, every = +st.recNewEvery || 0, wipe = false;
    var quality = st.recQuality || 'normal', hideT = (st.hideTopics || []).slice();
    var autoW = recAutoWords(REC.hist).filter(function (q) { return q; });
    var groups = (autoW.length ? [['자주 본 주제', autoW]] : []).concat(REC_GROUPS);
    var tab = 0, query = '';
    var count = G.el('span'), picked = G.el('div', { 'class': 'picked' }), tabs = G.el('div', { 'class': 'tabs', role: 'tablist' }), grid = G.el('div', { 'class': 'grid' });
    function has(q) { return topics.indexOf(q) >= 0; }
    function toggle(q) {
      if (has(q)) topics.splice(topics.indexOf(q), 1);
      else if (topics.length < REC_MAX_TOPICS) topics.push(q);
      else { count.textContent = '최대 ' + REC_MAX_TOPICS + '개까지 고를 수 있어요'; count.className = 'warn'; return; }
      draw();
    }
    function opt(q) { return recBtn('opt', q, function () { toggle(q); }, { 'aria-pressed': String(has(q)) }); }
    function draw() {
      count.className = '';
      count.textContent = topics.length + ' / ' + REC_MAX_TOPICS;
      // 고른 주제: 누르면 빠짐
      recClear(picked);
      if (!topics.length) picked.appendChild(G.el('p', { 'class': 'hint', text: '아래에서 고르거나 검색해서 추가해 주세요. 고른 주제의 영상만 모아 보여 드려요' }));
      topics.forEach(function (t) { picked.appendChild(recBtn('pk', t, function () { toggle(t); }, { 'aria-label': t + ' 빼기' })); });
      // 검색 중이면 분류 탭을 숨기고 모든 분류에서 찾음
      recClear(tabs); recClear(grid);
      var q = query.trim();
      tabs.hidden = !!q;
      if (q) {
        var seen = {}, found = [];
        groups.forEach(function (g) { g[1].forEach(function (x) { if (!seen[x] && x.toLowerCase().indexOf(q.toLowerCase()) >= 0) { seen[x] = 1; found.push(x); } }); });
        topics.forEach(function (x) { if (!seen[x] && x.toLowerCase().indexOf(q.toLowerCase()) >= 0) { seen[x] = 1; found.push(x); } });
        found.forEach(function (x) { grid.appendChild(opt(x)); });
        if (!seen[q]) grid.appendChild(recBtn('opt addq', '‘' + q + '’ 추가', function () { if (!has(q)) toggle(q); query = ''; input.value = ''; clearBtn.hidden = true; draw(); }));
        return;
      }
      groups.forEach(function (g, i) {
        tabs.appendChild(recBtn('', g[0], function () { tab = i; draw(); }, { role: 'tab', 'aria-selected': String(i === tab) }));
      });
      (groups[tab] || groups[0])[1].forEach(function (x) { grid.appendChild(opt(x)); });
    }
    var input = G.el('input', { type: 'search', placeholder: '주제·키워드 검색 또는 직접 추가', enterkeyhint: 'done', maxlength: '30', 'aria-label': '주제 검색' });
    var clearBtn = recBtn('clr', '✕', function () { input.value = ''; query = ''; clearBtn.hidden = true; draw(); input.focus(); }, { 'aria-label': '검색어 지우기' });
    clearBtn.hidden = true;
    input.addEventListener('input', function () { query = input.value || ''; clearBtn.hidden = !query; draw(); });
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      var v = (input.value || '').trim();
      if (v && !has(v)) toggle(v);
      input.value = ''; query = ''; clearBtn.hidden = true; draw();
    });
    function li(title, desc, control) { return G.el('div', { 'class': 'li' }, [G.el('div', {}, [G.el('b', { text: title }), desc ? G.el('span', { text: desc }) : null]), control]); }
    function sw(val, set, label) {
      var c = G.el('input', { type: 'checkbox', role: 'switch', 'aria-label': label }); c.checked = val;
      c.addEventListener('change', function () { set(c.checked); });
      return c;
    }
    // 새로운 주제: 끄기 · 가끔 · 보통 · 자주 (설명은 고른 값에 맞게)
    var segNote = G.el('span');
    var seg = G.el('div', { 'class': 'seg', role: 'radiogroup', 'aria-label': '새로운 주제 섞기' });
    function drawSeg() {
      [].forEach.call(seg.children, function (x, i) { x.setAttribute('aria-pressed', String(REC_EVERY[i][0] === every)); });
      var cur = REC_EVERY.filter(function (o) { return o[0] === every; })[0] || REC_EVERY[0];
      segNote.textContent = '평소 안 보던 주제를 섞어요 · ' + cur[2];
    }
    REC_EVERY.forEach(function (o) { seg.appendChild(recBtn('', o[1], function () { every = o[0]; drawSeg(); })); });
    drawSeg();
    // 거르기 (1.0.1): 조회수 적은 영상 · 보기 싫은 주제 · 거른 영상 보기
    var qNote = G.el('span'), qSeg = G.el('div', { 'class': 'seg', role: 'radiogroup', 'aria-label': '조회수 적은 영상 거르기' });
    function drawQ() {
      [].forEach.call(qSeg.children, function (x, i) { x.setAttribute('aria-pressed', String(REC_QUALITY[i][0] === quality)); });
      qNote.textContent = (REC_QUALITY.filter(function (o) { return o[0] === quality; })[0] || REC_QUALITY[1])[2];
    }
    REC_QUALITY.forEach(function (o) { qSeg.appendChild(recBtn('', o[1], function () { quality = o[0]; drawQ(); })); });
    drawQ();
    var packs = G.filters().topicPacks || [], tGrid = G.el('div', {}), lastG = null, gGrid = null;
    packs.forEach(function (p) {
      // 묶음 이름(group)별로 작은 제목 + 칩 (25개를 한 줄로 늘어놓으면 찾기 어려움)
      if (!gGrid || (p.group || '') !== lastG) {
        lastG = p.group || '';
        if (lastG) tGrid.appendChild(G.el('div', { 'class': 'tg', text: lastG }));
        gGrid = G.el('div', { 'class': 'grid', style: 'min-height:0;padding:6px 0 4px' });
        tGrid.appendChild(gGrid);
      }
      var b = recBtn('opt off', p.name, function () { var i = hideT.indexOf(p.id); if (i >= 0) hideT.splice(i, 1); else hideT.push(p.id); b.setAttribute('aria-pressed', String(hideT.indexOf(p.id) >= 0)); }, { 'aria-pressed': String(hideT.indexOf(p.id) >= 0), title: p.desc || '' });
      gGrid.appendChild(b);
    });
    var hidN = (REC.hidden || []).length;
    var hidBtn = hidN ? recBtn('link', '이번에 거른 영상 ' + hidN + '개 보기 ›', function () { recEditorClose(); recGo('hidden'); }) : null;
    var histN = (REC.hist || []).length;
    var wipeBtn = recBtn('danger', '지우기', function () {
      wipe = !wipe;
      wipeBtn.textContent = wipe ? '되돌리기' : '지우기';
      wipeBtn.className = 'danger' + (wipe ? ' on' : '');
      histDesc.textContent = wipe ? '저장하면 기록을 지워요' : (histN ? '본 영상 ' + histN + '개 · 비슷한 영상 추천에 쓰여요' : '아직 없어요 · Glide에서 끝까지 본 영상이 쌓여요');
    });
    var histDesc = G.el('span', { text: histN ? '본 영상 ' + histN + '개 · 비슷한 영상 추천에 쓰여요' : '아직 없어요 · Glide에서 끝까지 본 영상이 쌓여요' });
    var save = recBtn('save', '저장', function () {
      var v = (input.value || '').trim();
      if (v && !has(v) && topics.length < REC_MAX_TOPICS) topics.push(v);
      var patch = { recTopics: topics, recAuto: auto, recTrends: trends, recNewEvery: every, recQuality: quality, hideTopics: hideT };
      REC.override = patch;
      G.send('recSave', Object.assign({ clearHistory: wipe }, patch));
      if (wipe) { REC.hist = []; REC.histIds = {}; }
      recEditorClose();
      log('info', '추천 탭: 주제 ' + topics.length + '개 저장');
      recLoad(true);
    });
    REC.editor = G.el('div', { id: 'glide-rec-editor', role: 'dialog', 'aria-label': '추천 설정' }, [
      G.el('div', { 'class': 'grab' }),
      G.el('div', { 'class': 'eh' }, [G.el('h3', { text: '추천 설정' }), recBtn('x', '✕', recEditorClose, { 'aria-label': '닫기' })]),
      G.el('div', { 'class': 'eb' }, [
        G.el('section', { 'class': 'sec' }, [
          G.el('div', { 'class': 'st' }, [G.el('h4', { text: '관심 주제' }), count]),
          G.el('label', { 'class': 'search' }, [G.el('i'), input, clearBtn]),
          picked, tabs, grid
        ]),
        G.el('section', { 'class': 'sec' }, [
          G.el('div', { 'class': 'st' }, [G.el('h4', { text: '추천에 섞기' })]),
          li('본 영상과 비슷한 영상', 'Glide에서 끝까지 본 영상을 바탕으로 골라요', sw(auto, function (v) { auto = v; }, '본 영상과 비슷한 영상')),
          li('요즘 트렌드', '구글 트렌드 한국 실시간 검색어', sw(trends, function (v) { trends = v; }, '요즘 트렌드')),
          G.el('div', { 'class': 'li col' }, [G.el('div', {}, [G.el('b', { text: '새로운 주제' }), segNote]), seg])
        ]),
        G.el('section', { 'class': 'sec' }, [
          G.el('div', { 'class': 'st' }, [G.el('h4', { text: '거르기' })]),
          G.el('div', { 'class': 'li col' }, [G.el('div', {}, [G.el('b', { text: '조회수 적은 영상 거르기' }), qNote]), qSeg]),
          G.el('div', { 'class': 'li col' }, [G.el('div', {}, [G.el('b', { text: '보기 싫은 주제' }), G.el('span', { text: '고른 주제는 추천 탭·홈·영상 아래 추천에서 빠져요. 직접 검색한 결과에는 그대로 나와요' })]), tGrid]),
          hidBtn
        ]),
        G.el('section', { 'class': 'sec' }, [
          G.el('div', { 'class': 'st' }, [G.el('h4', { text: '기록' })]),
          G.el('div', { 'class': 'li' }, [G.el('div', {}, [G.el('b', { text: '본 영상 기록' }), histDesc]), wipeBtn])
        ]),
        G.el('p', { 'class': 'note', text: '관심 주제와 기록은 이 폰에만 저장되고, 유튜브 시청 기록·추천과는 따로예요' })
      ]),
      G.el('div', { 'class': 'ef' }, [save])
    ]);
    draw();
    // 뒤를 어둡게 덮는 막 (누르면 닫힘, 상용 앱의 아래 창처럼)
    var scrim = G.el('div', { id: 'glide-rec-scrim' });
    scrim.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); recEditorClose(); });
    document.body.appendChild(scrim);
    document.body.appendChild(REC.editor);
    lastGeom = ''; reportGeom();
    if (first) G.setTimeout.call(W, function () { try { input.focus(); } catch (e) { /* ignore */ } }, 250);
  }

  // ---- 연결: 하단 탭 유지·닫기·뒤로 가기·당겨서 새로고침 ----
  // 페이지 글자색이 밝으면 어두운 테마 (유튜브 테마는 앱 설정·기기 테마를 따라 바뀜)
  function recTheme() {
    if (!document.body) return;
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(document.body).color);
    var dk = !!m && (+m[1] + +m[2] + +m[3]) / 3 > 128;
    if (document.documentElement.classList.contains('glide-rec-dark') !== dk) document.documentElement.classList.toggle('glide-rec-dark', dk);
  }
  function recTick() {
    try {
      recTheme();
      recEnsureTab();
      if (!REC.open) return;
      // 다른 화면으로 이동(검색·채널 등)하면 닫음
      if (location.pathname + location.search !== REC.path) { recClose(); return; }
      recPlace();
    } catch (e) { /* ignore */ }
  }
  (function recLoop() { recTick(); G.setTimeout.call(W, recLoop, REC.open ? 700 : 1500); })();
  // ===========================================================================
  // Glide Music (2026-11-22, 사용자: "음악 탭을 멜론처럼 음악에 특화된 Glide만의 앱으로. 동영상을 보는 게 아니니 음질은 그대로, 데이터는 최소로")
  //  - 둘러보기 웹뷰: 아래 메뉴 '음악' 탭 → 페이지 위에 Glide 화면(#glide-music)을 덮음 (추천 탭과 같은 방식)
  //    차트(유튜브 공식 한국·글로벌 인기곡 Top100, 매주 갱신) · 최신 · 장르 · 내 음악(최근 들은 곡·좋아요한 곡) · 검색
  //  - 곡을 누르면: 그 곡부터 목록 끝까지 '다음에 재생' 대기열(queueSet) + 영상 웹뷰에서 첫 곡 (&glide_music=1)
  //  - 영상 웹뷰: 음악으로 연 곡이면 html[data-glide-music] → 코어가 영상 화질을 144p로 고정(소리는 유튜브가 따로 받는 오디오 그대로) +
  //    영상 대신 음악 재생 화면(#glide-mp: 앨범 이미지·제목·가수·진행 막대·셔플·이전·재생·다음·반복·다음 곡)
  //  - 음악 세션(어떤 곡들을 음악으로 듣는 중인지)은 두 웹뷰가 같이 보는 localStorage 'glide:gm'
  // ===========================================================================
  var GM = { el: null, body: null, top: null, open: false, view: 'chart', chart: 'melon', cache: {}, loading: false, q: '', genre: '', path: '' };
  // 멜론 TOP100 (2026-11-26 사용자: 멜론 차트로): 멜론 일간 차트를 매일 옮겨 두는 유튜브 재생목록 'Melon Daily Top 100 / 멜론 일간차트'(음원 위주).
  // 못 받으면 같은 채널의 주간 차트 → 유튜브 공식 한국 차트 순서로. 유튜브 공식 차트(국내·해외)는 그대로 남김
  var GM_CHARTS = [
    { id: 'melon', name: '멜론 TOP100', list: 'PLnlxKMP5GzKCXJ3Cw99qSWgC01cuhTFxG', alt: ['PLnlxKMP5GzKCLJGF7P0tUl_44CV7-vdUC', 'PL4fGSI1pDJn6jXS_Tv_N9B8Z0HTRVJE0m'], cap: '멜론 일간 차트 · 매일 갱신' },
    { id: 'kr', name: '유튜브 TOP100', list: 'PL4fGSI1pDJn6jXS_Tv_N9B8Z0HTRVJE0m', cap: '유튜브 공식 차트 · 이번 주 가장 많이 들은 노래' },
    { id: 'global', name: '해외 TOP100', list: 'PL4fGSI1pDJn6puJdseH2Rt9sMvt9E2M4i', cap: '유튜브 공식 차트 · 이번 주 가장 많이 들은 노래' }
  ];
  // 차트 재생목록 받기: 50곡 미만이면(지워짐·비공개) 다음 후보로
  function gmChartList(ch) {
    var ids = [ch.list].concat(ch.alt || []), i = 0;
    var next = function () { var id = ids[i++]; if (!id) return Promise.resolve([]); return gmPlaylist(id, 100).then(function (l) { return l && l.length >= 50 ? l : next(); }, next); };
    return next();
  }
  var GM_GENRES = [['발라드', '#5B7CFA'], ['댄스', '#FF5A7A'], ['힙합', '#2B2B2B'], ['R&B', '#8B5CF6'], ['인디', '#22A06B'], ['록', '#E4572E'],
    ['트로트', '#F59E0B'], ['OST', '#0EA5E9'], ['팝송', '#EC4899'], ['재즈', '#7C5A3A'], ['클래식', '#64748B'], ['로파이', '#14B8A6']];
  // 무드·상황 (멜론 'Mood Play'·탐색 무드처럼): [이름, 색, 검색어]. 계절 것은 그 철에만
  var GM_MOODS = [['신나는', '#FF5A7A', '신나는 노래'], ['기분전환', '#F5A524', '기분 전환 노래'], ['드라이브', '#3B82F6', '드라이브 노래'], ['잔잔한', '#22A06B', '잔잔한 노래'],
    ['운동', '#E4572E', '운동할 때 듣는 노래'], ['공부·집중', '#8B5CF6', '공부할 때 듣는 노래'], ['잠잘 때', '#4B5BAA', '잠잘 때 듣는 노래'], ['비 오는 날', '#5F7C8A', '비 오는 날 노래'],
    ['카페', '#9C6B4E', '카페 노래'], ['여행', '#14B8A6', '여행 노래']];
  // 장르·무드 칸 대표 표지: 그 검색어 노래 목록에서 앞쪽 곡의 고화질 표지(maxres, 없으면 mq). 7일 기억, 칸끼리 같은 곡 안 겹침.
  // 한 번에 2개씩만 받음 (처음 열 때 22번 검색이 한꺼번에 나가지 않게)
  var GM_ART = 'glide:gmTileArt', ART_Q = [], ART_RUN = 0;
  function gmTileArtSet(b, id) {
    var img = G.el('img', { alt: '', decoding: 'async' });
    img.onload = function () { if (img.naturalWidth <= 120 && img.src.indexOf('maxres') > 0) { img.src = 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg'; return; } img.classList.add('ok'); };
    img.onerror = function () { if (img.src.indexOf('maxres') > 0) img.src = 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg'; };
    img.src = 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg';
    b.insertBefore(img, b.firstChild);
  }
  // 칸 사진: 앱 안 무료 사진(Unsplash)이 있으면 그것 (2026-11-25 사용자: 선명하고 깨끗한 사진). 없으면(예전 앱) 대표곡 표지
  var GM_ART_FILE = { '발라드': 'ballad', '댄스': 'dance', '힙합': 'hiphop', 'R&B': 'rnb', '인디': 'indie', '록': 'rock', '트로트': 'trot', 'OST': 'ost', '팝송': 'pop', '재즈': 'jazz', '클래식': 'classic', '로파이': 'lofi',
    '가을': 'autumn', '크리스마스': 'christmas', '겨울 감성': 'winter', '봄': 'spring', '여름': 'summer', '신나는': 'exciting', '기분전환': 'refresh', '드라이브': 'drive', '잔잔한': 'calm', '운동': 'workout',
    '공부·집중': 'study', '잠잘 때': 'sleep', '비 오는 날': 'rain', '카페': 'cafe', '여행': 'travel' };
  function gmTileArtFile(b, name) {
    var key = GM_ART_FILE[name]; if (!key) return false;
    var img = G.el('img', { alt: '', decoding: 'async' });
    img.onload = function () { img.classList.add('ok'); };
    img.onerror = function () { img.remove(); gmTileArt(b, b.getAttribute('data-q') || name + ' 노래'); };
    img.src = '/glide-art/' + key + '.webp';
    b.insertBefore(img, b.firstChild);
    return true;
  }
  function gmTileArt(b, q) {
    var mem = gmLsGet(GM_ART) || {}, m = mem[q];
    if (m && Date.now() - m.at < 7 * 864e5) { gmTileArtSet(b, m.id); return; }
    ART_Q.push({ b: b, q: q }); gmTileArtRun();
  }
  function gmTileArtRun() {
    while (ART_RUN < 2 && ART_Q.length) {
      var job = ART_Q.shift(); ART_RUN++;
      (function (job) {
        gmGet('genre:' + job.q, function () { return gmSearchSongs(job.q).then(gmDedupe); }).then(function (list) {
          var mem = gmLsGet(GM_ART) || {}, used = {};
          Object.keys(mem).forEach(function (k) { if (k !== job.q) used[mem[k].id] = 1; });
          var pick = (list || []).filter(function (x) { return x && x.id && !used[x.id]; })[0] || (list || [])[0];
          if (pick) { mem[job.q] = { id: pick.id, at: Date.now() }; gmLsSet(GM_ART, mem); if (job.b.isConnected) gmTileArtSet(job.b, pick.id); }
        }, function () { /* 색 칸 그대로 */ }).then(function () { ART_RUN--; gmTileArtRun(); });
      })(job);
    }
  }
  function gmMoods() {
    var m = new Date().getMonth() + 1, l = GM_MOODS.slice();
    if (m === 12 || m <= 2 || m === 11) l.unshift(['겨울 감성', '#7FB3D5', '겨울 감성 노래']);
    if (m === 11 || m === 12) l.unshift(['크리스마스', '#C0392B', '크리스마스 캐롤']);
    if (m >= 3 && m <= 5) l.unshift(['봄', '#F28AB2', '봄 노래']);
    if (m >= 6 && m <= 8) l.unshift(['여름', '#00A6D6', '여름 노래']);
    if (m >= 9 && m <= 11) l.unshift(['가을', '#D2691E', '가을 노래']);
    return l;
  }
  var GM_VIEWS = [['chart', '차트'], ['new', '최신'], ['genre', '장르'], ['mine', '내 음악']];
  var GM_KEY = 'glide:gm', GM_RECENT = 'glide:gmRecent';
  function gmLsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function gmLsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  function gmOn() { return role() === 'browse' && onYT() && !!S().enabled && S().musicTab !== false; }
  function gmIcon(name) {
    var P = {
      play: "%3Cpath d='M8 5v14l11-7z' fill='%23000'/%3E",
      pause: "%3Cpath d='M7 5h4v14H7zM13 5h4v14h-4z' fill='%23000'/%3E",
      next: "%3Cpath d='M6 6l8.5 6L6 18z M16 6h2v12h-2z' fill='%23000'/%3E",
      prev: "%3Cpath d='M18 6l-8.5 6L18 18z M6 6h2v12H6z' fill='%23000'/%3E",
      shuffle: "%3Cpath d='M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E",
      repeat: "%3Cpath d='M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E",
      down: "%3Cpath d='M6 9l6 6 6-6' fill='none' stroke='%23000' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E",
      list: "%3Cpath d='M4 6h16M4 12h10M4 18h10M17 14v6l4-3z' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E",
      video: "%3Crect x='3' y='6' width='13' height='12' rx='2' fill='none' stroke='%23000' stroke-width='2'/%3E%3Cpath d='M16 10l5-3v10l-5-3z' fill='none' stroke='%23000' stroke-width='2' stroke-linejoin='round'/%3E",
      search: "%3Ccircle cx='11' cy='11' r='7' fill='none' stroke='%23000' stroke-width='2'/%3E%3Cpath d='M20 20l-4-4' stroke='%23000' stroke-width='2' stroke-linecap='round'/%3E",
      note: "%3Cpath d='M9 18V5l12-2v13' fill='none' stroke='%23000' stroke-width='2' stroke-linejoin='round'/%3E%3Ccircle cx='6' cy='18' r='3' fill='none' stroke='%23000' stroke-width='2'/%3E%3Ccircle cx='18' cy='16' r='3' fill='none' stroke='%23000' stroke-width='2'/%3E",
      more: "%3Ccircle cx='12' cy='5' r='2' fill='%23000'/%3E%3Ccircle cx='12' cy='12' r='2' fill='%23000'/%3E%3Ccircle cx='12' cy='19' r='2' fill='%23000'/%3E",
      moon: "%3Cpath d='M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' fill='none' stroke='%23000' stroke-width='2' stroke-linejoin='round'/%3E",
      drag: "%3Cpath d='M5 9h14M5 15h14' stroke='%23000' stroke-width='2' stroke-linecap='round'/%3E",
      add: "%3Cpath d='M4 6h12M4 12h12M4 18h8M18 15v6M15 18h6' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round'/%3E",
      person: "%3Ccircle cx='12' cy='8' r='4' fill='none' stroke='%23000' stroke-width='2'/%3E%3Cpath d='M4 21a8 8 0 0 1 16 0' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round'/%3E",
      close: "%3Cpath d='M6 6l12 12M18 6L6 18' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round'/%3E",
      plus: "%3Cpath d='M12 5v14M5 12h14' fill='none' stroke='%23000' stroke-width='2.2' stroke-linecap='round'/%3E",
      info: "%3Ccircle cx='12' cy='12' r='9' fill='none' stroke='%23000' stroke-width='2'/%3E%3Cpath d='M12 11v6M12 7.5v.5' stroke='%23000' stroke-width='2.2' stroke-linecap='round'/%3E",
      chat: "%3Cpath d='M4 5h16v11H9l-5 4z' fill='none' stroke='%23000' stroke-width='2' stroke-linejoin='round'/%3E",
      thumb: "%3Cpath d='M7 10v10H3V10zM9 20V10l4.5-7c1.3 0 2.2 1.1 1.9 2.4L14.6 9H20c1.1 0 1.9 1 1.7 2.1l-1.5 7.2c-.2.9-1 1.7-2 1.7z' fill='none' stroke='%23000' stroke-width='1.8' stroke-linejoin='round'/%3E",
      dl: "%3Cpath d='M12 4v10M7 10l5 5 5-5M5 20h14' fill='none' stroke='%23000' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E",
      tune: "%3Cpath d='M4 7h10M18 7h2M4 17h4M12 17h8' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round'/%3E%3Ccircle cx='16' cy='7' r='2' fill='none' stroke='%23000' stroke-width='2'/%3E%3Ccircle cx='10' cy='17' r='2' fill='none' stroke='%23000' stroke-width='2'/%3E",
      heart: "%3Cpath d='M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z' fill='none' stroke='%23000' stroke-width='2' stroke-linejoin='round'/%3E",
      heartf: "%3Cpath d='M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z' fill='%23000'/%3E",
      mix: "%3Ccircle cx='9' cy='12' r='5' fill='none' stroke='%23000' stroke-width='2'/%3E%3Ccircle cx='15' cy='12' r='5' fill='none' stroke='%23000' stroke-width='2'/%3E",
      share: "%3Cpath d='M12 3v12M7 8l5-5 5 5M5 14v5h14v-5' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E",
      lyric: "%3Cpath d='M4 6h12M4 11h9M4 16h6' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M18 9v8' stroke='%23000' stroke-width='2' stroke-linecap='round'/%3E%3Ccircle cx='16' cy='17' r='2' fill='none' stroke='%23000' stroke-width='2'/%3E",
      back: "%3Cpath d='M15 5l-7 7 7 7' fill='none' stroke='%23000' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E"
    };
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E" + P[name] + '%3C/svg%3E';
  }
  // ---- 곡 정보 다듬기: 제목의 (Official MV)·[MV] 같은 꼬리를 떼고, '가수 - 제목'이면 나눔 ----
  function gmClean(title, ch) {
    var t = String(title || '').replace(/^\s*[\[【][^\]】]{1,20}[\]】]\s*/, '') // 앞의 [MV]·【MV】
      .replace(/\s*[\(\[【](?:[^\)\]】]*?(?:official|m\/?v|music video|lyric|audio|visualizer|performance|teaser|가사|뮤직비디오|special|clip)[^\)\]】]*)[\)\]】]/gi, '')
      .replace(/\s*\|.*$/, '')
      .replace(/\s+(?:official\s+)?(?:m\/?v|music video|audio|video|lyric video|visualizer)\s*$/i, '').trim();
    var a = String(ch || '').replace(/\s*-\s*Topic$/i, '').replace(/\s*(official|vevo)\s*$/i, '').trim();
    var unq = function (x) { var u = /^['‘"“](.+)['’"”]$/.exec(x); return u ? u[1].trim() : x; };
    // '가수 - 제목', '가수 _ 제목'
    var m = /^(.{1,40}?)\s+[-–_]\s+(.+)$/.exec(t);
    var parsed = false;
    if (m) { a = m[1].trim(); t = unq(m[2].trim()); parsed = true; }
    else {
      // RESCENE (리센느) 'With' → 가수 RESCENE (리센느), 제목 With. 제목 안 따옴표(You’re)가 있어도 맨 끝 따옴표까지
      var q = /^(.{1,40}?)\s*['‘"“](.+)['’"”]\s*$/.exec(t);
      if (q && q[1].trim()) { a = q[1].trim(); t = q[2].trim(); parsed = true; }
    }
    return { title: t || String(title || ''), artist: a, parsed: parsed };
  }
  function gmSecs(len) { return len ? String(len).split(':').reduce(function (s, n) { return s * 60 + (+n || 0); }, 0) : 0; }
  function gmItems(json) {
    var out = [], cont = null, seen = {};
    (function walk(o, d) {
      if (!o || typeof o !== 'object' || d > 24) return;
      if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) walk(o[i], d + 1); return; }
      for (var k in o) {
        var v = o[k];
        if (k === 'lockupViewModel' && v && v.contentId && /VIDEO/.test(v.contentType || 'VIDEO')) {
          var md = v.metadata && v.metadata.lockupMetadataViewModel;
          var title = md && md.title && md.title.content;
          var part = md && md.metadata && md.metadata.contentMetadataViewModel && md.metadata.contentMetadataViewModel.metadataRows;
          var ch = part && part[0] && part[0].metadataParts && part[0].metadataParts[0] && part[0].metadataParts[0].text && part[0].metadataParts[0].text.content;
          var lm = /"text":"(\d+:\d\d(?::\d\d)?)"/.exec(JSON.stringify(v.contentImage || {}));
          var rows2 = part && part[1] && part[1].metadataParts ? part[1].metadataParts.map(function (p) { return p && p.text && p.text.content || ''; }).join(' ') : '';
          if (title && !seen[v.contentId]) { seen[v.contentId] = 1; out.push(gmMake(v.contentId, title, ch, lm && lm[1], rows2, rows2)); }
          continue;
        }
        if ((k === 'videoWithContextRenderer' || k === 'videoRenderer' || k === 'compactVideoRenderer' || k === 'playlistVideoRenderer' || k === 'playlistPanelVideoRenderer') && v && v.videoId) {
          var nav = v.navigationEndpoint || {};
          if (!nav.reelWatchEndpoint && !seen[v.videoId]) { seen[v.videoId] = 1; out.push(gmMake(v.videoId, recText(v.headline || v.title), recText(v.shortBylineText || v.longBylineText || v.ownerText), recText(v.lengthText), recText(v.viewCountText || v.shortViewCountText), recText(v.publishedTimeText))); }
          continue;
        }
        if (k === 'continuationCommand' && v && v.token && !cont) cont = v.token;
        walk(v, d + 1);
      }
    })(json, 0);
    return { items: out, cont: cont };
  }
  function gmMake(id, title, ch, len, views, age) {
    var c = gmClean(title, ch);
    var o = { id: id, title: c.title, artist: c.artist || String(ch || ''), raw: String(title || ''), ch: String(ch || ''), len: len || '', secs: gmSecs(len), ap: !!c.parsed };
    var vw = gmViews(views); if (vw >= 0) o.views = vw;
    var ag = gmAge(age); if (ag >= 0) o.age = ag;
    return o;
  }
  // '조회수 52만회' · '1.2M views' → 수 (없으면 -1)
  function gmViews(t) {
    var m = /([\d.,]+)\s*(천|만|억|K|M|B)?\s*(?:회|views?)/i.exec(String(t || '')); if (!m) return -1;
    var n = parseFloat(m[1].replace(/,/g, '')), u = (m[2] || '').toUpperCase();
    return Math.round(n * ({ '천': 1e3, '만': 1e4, '억': 1e8, K: 1e3, M: 1e6, B: 1e9 }[u] || 1));
  }
  // '3일 전' · '2 weeks ago' → 지난 초 (없으면 -1)
  function gmAge(t) {
    var m = /(\d+)\s*(초|분|시간|일|주|개월|달|년|second|minute|hour|day|week|month|year)/i.exec(String(t || '')); if (!m) return -1;
    var k = m[2].toLowerCase(), u = { '초': 1, second: 1, '분': 60, minute: 60, '시간': 3600, hour: 3600, '일': 86400, day: 86400, '주': 604800, week: 604800, '개월': 2592000, '달': 2592000, month: 2592000, '년': 31536000, year: 31536000 }[k] || 0;
    return (+m[1]) * u;
  }
  // 음악다운 길이만 (1분 30초 ~ 12분): 검색 결과의 쇼츠·몇 시간짜리 모음 영상 제외
  function gmSongLike(it) { return !it.secs || (it.secs >= 90 && it.secs <= 720); }
  // ---- 데이터 받기 (계정 정보 없이: 둘러보기 기록·추천 학습에 흔적을 남기지 않음) ----
  function gmPlaylist(listId, max) {
    var all = [];
    function step(body, n) {
      return yti('browse', body).then(function (j) {
        var r = gmItems(j);
        r.items.forEach(function (x) { if (all.length < max) all.push(x); });
        if (r.cont && all.length < max && n < 8) return step({ continuation: r.cont }, n + 1);
        return all;
      });
    }
    return step({ browseId: 'VL' + listId }, 0);
  }
  function gmSearch(q, sp) {
    return yti('search', { query: q, params: sp || 'EgIQAQ%3D%3D' }).then(function (j) { return gmItems(j).items.filter(gmSongLike); });
  }
  // 노래 찾기: 4분 이하·4~20분 영상을 따로 찾아 번갈아 합침 (그냥 찾으면 몇 시간짜리 모음 영상이 대부분이라 장르 목록이 거의 비었음 — 실제 사이트 검사)
  function gmSearchPage(q, sp, cont) {
    return yti('search', cont ? { continuation: cont } : { query: q, params: sp }).then(function (j) { var r = gmItems(j); return { items: r.items.filter(gmSongLike), cont: r.cont }; });
  }
  // 한 필터로 여러 묶음 (pages 만큼). 마지막 다음 묶음 토큰도 돌려줌 (더 불러오기용)
  function gmSearchDeep(q, sp, pages, cont0) {
    var all = [], seen = {};
    function step(cont, n) {
      return gmSearchPage(q, sp, cont).then(function (r) {
        r.items.forEach(function (x) { if (!seen[x.id]) { seen[x.id] = 1; all.push(x); } });
        if (r.cont && n + 1 < pages) return step(r.cont, n + 1);
        return { items: all, cont: r.cont || null };
      });
    }
    return step(cont0 || null, 0).catch(function () { return { items: all, cont: null }; });
  }
  function gmAlt(a, b) { var out = [], seen = {}, i = 0; while (i < a.length || i < b.length) { [a[i], b[i]].forEach(function (x) { if (x && !seen[x.id]) { seen[x.id] = 1; out.push(x); } }); i++; } return out; }
  var GM_SP = ['EgQQARgB', 'EgQQARgD']; // 4분 이하 · 4~20분
  var GM_NOISE = /직캠|fancam|리액션|reaction|반응|인터뷰|interview|수상|소감|speech|비하인드|behind|예능|몰아보기|모음|full\s?concert|콘서트|concert|뉴스|news|눈길|논란|근황|폭로|충격|진실|다큐|해명|사건|댓글|노래방|karaoke|\bmr\b|\binst\b|playlist|플레이리스트|연속\s?듣기|\d+\s?시간|#|@|…|\?!|!!|\bep\.?\s?\d|\d+\s?회\b|자막|sub\b|해외반응|분석/i;
  function gmNormQ(x) { return String(x || '').toLowerCase().replace(/[\s\-_.·()\[\]'"]/g, ''); }
  // 점수: 공식 음원·공식 채널·'가수 - 제목'·짧은 제목은 위로, 뉴스·예능·직캠·모음은 아래로 (같은 점수는 원래 순서)
  function gmRank(list, q) {
    var nq = gmNormQ(q);
    return list.map(function (x, i) {
      var ch = String(x.ch || ''), raw = String(x.raw || x.title || ''), sc = 0;
      if (/-\s*Topic$/i.test(ch)) sc += 4;
      if (/vevo$|official|공식/i.test(ch)) sc += 2;
      if (nq && (gmNormQ(ch).indexOf(nq) !== -1 || gmNormQ(x.artist).indexOf(nq) !== -1)) sc += 2;
      if (/\s[-–]\s|['‘"“].+['’"”]|\b(m\/?v|official|audio|lyrics?|가사)\b/i.test(raw)) sc += 1;
      if (raw.length <= 40) sc += 1; else if (raw.length > 70) sc -= 2;
      if (GM_NOISE.test(raw)) sc -= 5;
      return { x: x, s: sc, i: i };
    }).sort(function (a, b) { return b.s - a.s || a.i - b.i; }).map(function (o) { return o.x; });
  }
  // 한글·영어 이름 짝 배우기: 검색 결과 제목·채널의 '기립 (GiiiRIP)', 'BIGBANG (빅뱅)' 같은 괄호 → 빅뱅 ↔ bigbang, 기립 ↔ giiirip
  var GM_HAN = /[가-힣]/, GM_LAT = /[a-z]/;
  var GM_ALIAS_SKIP = /lyrics?|가사|ver|live|라이브|커버|cover|feat|원곡|^mv$|official|audio|가수전|방송|\d{4}/;
  function gmAliasLearn(al, list) {
    var add = function (a, b) {
      a = gmNorm(a); b = gmNorm(b);
      if (!a || !b || a === b || a.length > 24 || b.length > 24) return;
      if (!((GM_HAN.test(a) && GM_LAT.test(b)) || (GM_LAT.test(a) && GM_HAN.test(b)))) return; // 한글 ↔ 영어 짝만
      if (GM_ALIAS_SKIP.test(a) || GM_ALIAS_SKIP.test(b)) return; // '밤편지 [가사/Lyrics]' 같은 꼬리표
      // 두 번 넘게 나온 짝만 씀 (한 영상 제목의 우연한 괄호로 '밤편지 ↔ IU' 같은 엉뚱한 짝이 생겼었음 — 실제 사이트)
      var c = al['#c'] || (al['#c'] = {}), k = a < b ? a + '|' + b : b + '|' + a;
      c[k] = (c[k] || 0) + 1;
      if (c[k] < 2) return;
      (al[a] = al[a] || {})[b] = 1; (al[b] = al[b] || {})[a] = 1;
    };
    list.forEach(function (x) {
      [x.raw, x.ch].forEach(function (t) {
        var re = /([^()\[\]【】「」'"‘’“”|ㅣ\/:,_\-–]{1,40})[(\[]([^()\[\]]{1,30})[)\]]/g, m;
        t = String(t || '');
        while ((m = re.exec(t))) add(m[1], m[2]);
      });
    });
    return al;
  }
  function gmHas(text, tok, al) {
    if (text.indexOf(tok) !== -1) return true;
    var a = al[tok]; if (!a) return false;
    for (var k in a) if (text.indexOf(k) !== -1) return true;
    return false;
  }
  // 낱말 단위로 맞추기: '기립'은 '기립 (GiiiRIP)'에는 맞고 '기립성 저혈압'·'기립경 검사'에는 안 맞음. 띄어 쓴 '좋은 날'은 '좋은날'과 맞음
  function gmWords(t) { return String(t || '').toLowerCase().split(/[^0-9a-z가-힣]+/).filter(Boolean); }
  function gmHasW(words, tok, al) {
    var alt = al[tok] || {};
    for (var i = 0; i < words.length; i++) {
      var acc = '';
      for (var j = i; j < words.length && j < i + 5; j++) {
        if (words[j] === '|') break;
        acc += words[j];
        if (acc === tok || alt[acc]) return true;
        if (acc.length > 32) break;
      }
    }
    return false;
  }
  var GM_NOISE2 = /의혹|표절|리뷰|review|음감회|해석|tutorial|튜토리얼|강좌|배우기|다이어트|챌린지|challenge|축가|히든싱어|패러디|parody|먹방|브이로그|vlog|unboxing|언박싱|close\s?up|직캠/i;
  var GM_VARIANT = /원곡|original song|cover|커버|\b\d{6}\b|mama|in osaka|lyrics?|가사|버전|version|award|어워즈|시상식|축하공연|festival|가요제|가요대축제|performance|퍼포먼스|\bver\b|remix|리믹스|cover|커버|inst|instrumental|orchestra|오케스트라|국악|piano|피아노|acoustic|어쿠스틱|sped|slowed|reverb|nightcore|8d|loop|반복|1시간|1hour|live|라이브|무대|stage|edit|mashup|매시업/i;
  // 검색 결과 정확도 순서: 검색어 낱말이 모두 맞는 곡만 (하나도 없으면 원래 방식), 원곡(제목이 검색어와 같음·공식 채널·Topic)이 위, 가사·커버·다른 버전은 그 아래, 뉴스·직캠은 빼거나 맨 아래
  function gmRelevance(list, q, al, strict) {
    var toks = String(q || '').toLowerCase().split(/\s+/).map(gmNorm).filter(Boolean);
    if (!toks.length) return gmRank(list, q);
    // 1) 곡마다 낱말이 어디서 맞는지 (가수 칸 = 채널·가수 이름, 아니면 제목)
    var pre = list.map(function (x) {
      var raw = String(x.raw || x.title || ''), chN = gmNorm(x.ch), arN = gmNorm(x.artist), meta = chN + '|' + arN, all = gmNorm(raw) + '|' + meta;
      var wm = gmWords(String(x.ch || '') + ' ' + String(x.artist || '')), wa = gmWords(raw).concat(['|'], wm);
      var m = {}; toks.forEach(function (t) { m[t] = gmHasW(wm, t, al) ? 'a' : gmHasW(wa, t, al) ? 't' : ''; });
      return { raw: raw, chN: chN, arN: arN, m: m };
    });
    // 2) 가수 낱말: 맞는 곡들 중 40% 넘게 가수 칸에서 맞으면 (빅뱅·아이유·뉴진스). 나머지는 노래 제목 낱말
    var isArt = {};
    toks.forEach(function (t) { var n = 0, na = 0; pre.forEach(function (p) { if (p.m[t]) { n++; if (p.m[t] === 'a') na++; } }); isArt[t] = n > 0 && na / n >= 0.4; });
    var titleQ = toks.some(function (t) { return !isArt[t]; }); // 제목을 찾는 검색 (가수만 찾으면 유튜브 순서를 거의 그대로)
    var scored = list.map(function (x, i) {
      var p = pre[i], raw = p.raw, chN = p.chN, arN = p.arN;
      var hit = toks.filter(function (t) { return p.m[t]; }).length;
      var sc = 0;
      if (titleQ) {
        // 남는 글자: 제목에서 괄호·태그·검색어(와 짝 이름)·가수 이름을 지우고 남은 것 = 원곡과 다른 정도 (0 이면 원곡 그 자체)
        var rest = gmNorm(raw.replace(/[(\[【「][^()\[\]【】「」]*[)\]】」]/g, ' ').replace(/[|ㅣ].*$/, ' ').replace(/official|audio|video|m\/?v|music|lyrics?|가사|뮤직비디오|visualizer|teaser|hd|4k/gi, ' '));
        var cut = function (w) { if (w && w.length >= 2) rest = rest.split(w).join(''); };
        toks.forEach(function (t) { cut(t); if (al[t]) Object.keys(al[t]).forEach(cut); });
        [chN, arN].forEach(function (w) { cut(w); if (al[w]) Object.keys(al[w]).forEach(cut); });
        cut(gmNorm(String(x.ch || '').replace(/\s*-\s*Topic$/i, '')));
        gmWords(String(x.ch || '') + ' ' + String(x.artist || '')).forEach(function (w) { if (w !== 'topic') { cut(w); if (al[w]) Object.keys(al[w]).forEach(cut); } }); // 'NewJeans (뉴진스)'처럼 낱말로 나뉜 가수 이름
        var lyr = /lyrics?|가사/i.test(raw), vari = GM_VARIANT.test(raw.replace(/lyrics?|가사/gi, ''));
        if (!rest.length) sc += vari ? 3 : lyr ? 6 : 9; // 원곡 > 원곡 가사 영상 > 다른 버전
        else if (rest.length <= 4) sc += vari ? 1 : 3;
        sc -= Math.min(8, rest.length / 3);
        if (vari) sc -= 3;
      }
      // 찾는 가수가 제목에만 있고 가수 칸(채널·'가수 - 제목')에 없으면 남이 부른 것일 가능성 (커버·예능)
      toks.forEach(function (t) { if (isArt[t] && p.m[t] === 't') sc -= 4; });
      if (/-\s*Topic$/i.test(x.ch)) sc += 4;
      // 가수 공식 채널: 채널 이름에서 가수 낱말(과 짝 이름)을 지우면 남는 게 없음 (BIGBANG · BIGBANG (빅뱅) · IU Official)
      var chRest = gmNorm(String(x.ch || '').replace(/\s*-\s*Topic$/i, '').replace(/official|vevo|공식/gi, ''));
      var artHit = false;
      toks.forEach(function (t) { if (!isArt[t]) return; [t].concat(al[t] ? Object.keys(al[t]) : []).forEach(function (w) { if (w.length >= 2 && chRest.indexOf(w) !== -1) { chRest = chRest.split(w).join(''); artHit = true; } }); });
      if (artHit && chRest.length <= 2) sc += 4;
      var isOff = gmOfficial(x) || (artHit && chRest.length <= 2);
      if (/vevo$|official|공식/i.test(x.ch)) sc += 2;
      if (/official\s*(audio|m\/?v|video)|\bm\/?v\b|뮤직비디오/i.test(raw)) sc += 1;
      if (x.views > 0) sc += Math.min(3, Math.max(0, Math.log(x.views) / Math.LN10 - 4)); // 많이 들은 곡이 원곡일 가능성 (10만 +1 · 100만 +2 · 1000만 +3)
      var noise = GM_NOISE.test(raw) || GM_NOISE2.test(raw); if (noise) sc -= 8;
      if (gmOffOn() && isOff) sc += 3;
      return { x: x, s: sc, i: i, hit: hit, noise: noise, off: isOff, rest: titleQ ? rest.length : 0, vari: titleQ ? vari : false, both: titleQ && toks.every(function (t) { return isArt[t] || !al[t] || Object.keys(al[t]).some(function (k) { return gmHasW(gmWords(raw), k, {}); }) && gmHasW(gmWords(raw), t, {}); }), ar: [chN, arN, gmNorm(String(x.ch || '').replace(/\s*-\s*Topic$/i, '').replace(/\s*[\[(].*$/, ''))] };
    });
    var full = scored.filter(function (o) { return o.hit === toks.length; });
    if (!full.length) return strict ? [] : gmRank(list, q); // 이름 짝을 못 배운 경우 등: 예전 방식 (더 불러오기는 빈 목록)
    var clean = full.filter(function (o) { return !o.noise; });
    if (clean.length >= 5) full = clean; // 노래가 충분하면 뉴스·직캠·반응 영상은 뺌
    if (titleQ) {
      var crew = {};
      full.forEach(function (o) { if (!o.rest && !o.vari && !o.noise) o.ar.forEach(function (a) { if (a && a.length >= 2) crew[a] = 1; }); });
      var inCrew = function (o) { return o.ar.some(function (a) { if (!a) return false; for (var c in crew) if (a === c || a.indexOf(c) !== -1 || c.indexOf(a) !== -1) return true; return false; }); };
      var song = full.filter(function (o) { return inCrew(o) || o.both || o.rest <= 4; });
      if (song.length >= 3) full = song;
    }
    // 공식 음원 먼저: 제목(한글·영어 짝 포함)과 가수가 같은 곡의 공식본이 있을 때만 그 곡의 일반 업로드(가사 영상·다시 올린 것)를 뺌.
    // 다른 곡·라이브·커버 같은 다른 버전·공식본이 없는 곡은 그대로 (노래가 갑자기 많이 사라지지 않게)
    if (gmOffOn()) {
      // 곡 이름만: 괄호(겹친 것까지)·'|' 뒤·가사/Lyrics/MV 같은 꼬리표를 걷어냄
      var core = function (o) {
        var t = String(o.x.title || ''), p0;
        do { p0 = t; t = t.replace(/[(\[【「][^()\[\]【】「」]*[)\]】」]/g, ' '); } while (t !== p0);
        return gmNorm(t.replace(/[|ㅣ].*$/, '').replace(/color\s*coded.*$|lyrics?|가사|official|audio|video|m\/?v|visualizer|\bhd\b|4k/gi, ' '));
      };
      var alt = function (t) { var r = {}; if (!t) return r; r[t] = 1; if (al[t]) for (var k in al[t]) r[k] = 1; return r; };
      var aw = function (o) {
        var r = {};
        gmWords(String(o.x.artist || '') + ' ' + String(o.x.ch || '').replace(/\s*-\s*Topic$/i, '')).forEach(function (w) {
          if (w.length < 2 || w === 'official' || w === 'topic') return;
          r[w] = 1; if (al[w]) for (var k in al[w]) r[k] = 1;
        });
        return r;
      };
      var offs = full.filter(function (o) { return o.off; }).map(function (o) { return { t: alt(core(o)), a: aw(o) }; });
      if (offs.length) {
        var kept = full.filter(function (o) {
          if (o.off || GM_VARIANT.test(String(o.x.raw || '').replace(/lyrics?|가사/gi, ''))) return true;
          var ct = core(o), a = aw(o);
          if (!ct) return true;
          return !offs.some(function (p) {
            // 제목에 가수 이름이 들어 있으면 떼고(그것도 같은 가수라는 뜻), 남은 것이 그 곡 이름(한글·영어 짝)뿐이면 같은 곡
            var r = ct, inTitle = false, k;
            for (k in p.a) if (k.length >= 2 && r.indexOf(k) !== -1) { inTitle = true; r = r.split(k).join(''); }
            for (k in p.t) if (k) r = r.split(k).join('');
            if (r !== '' || ct === r) return false;
            if (inTitle) return true;
            for (k in a) if (p.a[k]) return true;
            return false;
          });
        });
        if (kept.length) full = kept;
      }
    }
    return full.sort(function (a, b) { return b.s - a.s || a.i - b.i; }).map(function (o) { return o.x; });
  }
  // 정렬 필터: 정확도(위 순서 그대로) · 최신순 · 조회수순 (정보가 없는 곡은 뒤로, 같으면 정확도 순)
  var GM_SORTS = [['rel', '정확도순'], ['new', '최신순'], ['view', '조회수순']];
  function gmSortList(rel, k) {
    if (k !== 'new' && k !== 'view') return rel.slice();
    return rel.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
      var va = k === 'new' ? a.x.age : a.x.views, vb = k === 'new' ? b.x.age : b.x.views;
      var ha = va != null, hb = vb != null;
      if (ha !== hb) return ha ? -1 : 1;
      if (ha && va !== vb) return k === 'new' ? va - vb : vb - va;
      return a.i - b.i;
    }).map(function (o) { return o.x; });
  }
  // 노래 찾기: 4분 이하·4~20분 영상을 따로 찾아 번갈아 합침 (그냥 찾으면 몇 시간짜리 모음 영상이 대부분이라 장르 목록이 거의 비었음 — 실제 사이트 검사).
  // pages: 필터마다 몇 묶음까지 (검색 화면 3, 장르·가수 1). 다음 묶음 토큰은 GM.sconts[q] 에 (끝까지 내리면 더 불러오기)
  function gmSearchSongs(q, pages) {
    return Promise.all(GM_SP.map(function (sp) { return gmSearchDeep(q, sp, pages || 1); })).then(function (r) {
      (GM.sconts = GM.sconts || {})[q] = [r[0].cont, r[1].cont];
      return gmAlt(r[0].items, r[1].items);
    });
  }
  function gmSearchMore(q) {
    var c = (GM.sconts || {})[q]; if (!c || (!c[0] && !c[1])) return Promise.resolve([]);
    return Promise.all(GM_SP.map(function (sp, i) { return c[i] ? gmSearchDeep(q, sp, 2, c[i]) : Promise.resolve({ items: [], cont: null }); })).then(function (r) {
      GM.sconts[q] = [r[0].cont, r[1].cont];
      return gmAlt(r[0].items, r[1].items);
    });
  }
  // 좋아요한 곡(유튜브 '좋아요 표시한 동영상' LL): 계정이 필요해 페이지의 로그인으로 받음 (SAPISIDHASH). 음악다운 길이만
  function gmAuthHeader() {
    var m = /(?:^|;\s*)(?:__Secure-3PAPISID|SAPISID)=([^;]+)/.exec(document.cookie || '');
    if (!m || !W.crypto || !W.crypto.subtle) return Promise.resolve(null);
    var ts = Math.floor(Date.now() / 1000), src = ts + ' ' + m[1] + ' ' + location.origin;
    return W.crypto.subtle.digest('SHA-1', new TextEncoder().encode(src)).then(function (b) {
      var hex = Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      return 'SAPISIDHASH ' + ts + '_' + hex;
    });
  }
  function gmLiked() {
    var c = W.ytcfg;
    if (!c || !c.get || !c.get('LOGGED_IN')) return Promise.resolve(null);
    return gmAuthHeader().then(function (auth) {
      if (!auth) return null;
      return fetch('/youtubei/v1/browse?prettyPrint=false', {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json', authorization: auth, 'x-origin': location.origin, 'x-goog-authuser': '0',
          'x-youtube-client-name': String(c.get('INNERTUBE_CONTEXT_CLIENT_NAME') || 2), 'x-youtube-client-version': String(c.get('INNERTUBE_CLIENT_VERSION') || '') },
        body: JSON.stringify({ context: c.get('INNERTUBE_CONTEXT'), browseId: 'VLLL' })
      }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) { return gmItems(j).items.filter(gmSongLike); });
    });
  }
  // ---- 재생: 고른 곡부터 목록 끝까지 대기열, 첫 곡은 영상 웹뷰에서 음악으로 ----
  function gmShuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function gmPlay(list, index, shuffle) {
    list = (list || []).filter(function (x) { return x && /^[\w-]{11}$/.test(x.id); });
    if (!list.length) return;
    index = Math.max(0, Math.min(list.length - 1, index || 0));
    var order = shuffle ? (function () { var first = list[index]; var rest = gmShuffle(list.filter(function (x, i) { return i !== index; })); return index === 0 && shuffle === 'all' ? gmShuffle(list) : [first].concat(rest); })()
      : list.slice(index);
    var pick = function (x) { return { id: x.id, title: x.title, artist: x.artist }; };
    // items = 재생 순서, orig = 셔플을 끌 때 돌아갈 원래 순서, played = 실제로 들은 순서(이전 곡)
    var sess = { at: Date.now(), items: order.map(pick), orig: (shuffle === 'all' ? list : list.slice(index)).map(pick), played: [], shuffle: !!shuffle };
    gmLsSet(GM_KEY, sess);
    G.send('haptic', { kind: 'gesture' });
    // 영상 열기를 먼저 보냄: 대기열이 먼저 가면 영상 웹뷰가 아직 예전(음악 아닌) 영상일 때 '음악 대기열 비우기'에 걸렸음 (독립 검토 반영)
    try { localStorage.removeItem('glide:gmPos'); } catch (e) { /* ignore */ } // 골라서 듣는 곡은 처음부터
    G.send('openVideo', { url: location.origin + '/watch?v=' + order[0].id + '&glide_music=1' });
    gmQSend('queueSet', { items: order.slice(1).map(function (x) { return { id: x.id, title: x.title, ch: x.artist }; }) });
    log('info', '음악 재생: ' + order[0].title + ' 외 ' + (order.length - 1) + '곡' + (shuffle ? ' (셔플)' : ''));
  }
  function gmRecentAdd(it) {
    var r = (gmLsGet(GM_RECENT) || []).filter(function (x) { return x && x.id !== it.id; });
    r.unshift({ id: it.id, title: it.title, artist: it.artist, at: Date.now() });
    gmLsSet(GM_RECENT, r.slice(0, 100));
  }
  // ---- 차트 순위 변동 (멜론처럼 ▲3 ▼2 NEW): 차트가 바뀌면 지난 순위를 기억해 두고 비교 (이 폰에만) ----
  function gmChartDelta(id, list) {
    var key = 'glide:gmChart:' + id, st = gmLsGet(key) || {}, now = {};
    list.forEach(function (x, i) { now[x.id] = i + 1; });
    var sig = list.slice(0, 30).map(function (x) { return x.id; }).join(',');
    if (st.sig !== sig) { if (st.ranks) st.prev = st.ranks; st.ranks = now; st.sig = sig; st.at = Date.now(); gmLsSet(key, st); }
    if (!st.prev) return null;
    var out = {};
    list.forEach(function (x, i) { var p = st.prev[x.id]; out[x.id] = p ? p - (i + 1) : 'new'; });
    return out;
  }
  // ---- 같은 곡 정리: MV·음원·가사 영상처럼 같은 곡이 여러 번 나오면 하나만 ----
  function gmKey(it) {
    var t = String(it.title || '').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^0-9a-z぀-ヿ一-鿿가-힣]/g, '');
    var a = String(it.artist || '').toLowerCase().replace(/[^0-9a-z가-힣]/g, '').slice(0, 4);
    return t + '|' + a;
  }
  // ---- 공식 음원 먼저 (설정 musicOfficial, 기본 켬, 2026-11-23 사용자: "일반 사용자가 카피한 노래 말고 원작자가 올린 것", "노래가 갑자기 많이 사라지면 안 돼") ----
  // 모바일 검색 결과에는 공식 표시(배지)가 오지 않아 채널 이름으로 판단: '- Topic'(유튜브가 유통사 음원으로 만든 채널) · 가수 이름과 같은 채널 ·
  // Official/VEVO/공식 · 잘 알려진 기획사·유통사. 같은 곡에 공식본이 있을 때만 일반 업로드(가사 영상·다시 올린 것)를 빼고, 공식본이 없는 곡은 그대로 둠
  var GM_LABELS = /^(1thek|원더케이|hybelabels|bighit|smtown|jypentertainment|ygentertainment|stonemusic|geniemusic|kakaoentertainment|starship|cubeentertainment|theblacklabel|wakeone|istentertainment|woollim|pledis|belift|kqentertainment|rbw|antenna|mystic|fncent|ador|warnermusic|sonymusic|universalmusic|umg|emi|atlanticrecords|interscope|columbia|republicrecords|aomg|amoeba|ambition|p nation|pnation|cjenm|mnetkpop)/;
  function gmOffOn() { return S().musicOfficial !== false; }
  function gmOfficial(x) {
    var ch = String(x.ch || ''), cn = gmNorm(ch.replace(/\s*-\s*Topic$/i, '')), an = gmNorm(x.artist);
    if (/-\s*Topic$/i.test(ch)) return true;
    if (/official|vevo|공식/i.test(ch)) return true;
    if (cn && GM_LABELS.test(cn)) return true;
    // 가수 이름과 같은 채널 (BIGBANG · 폴킴 Paul Kim — 가수 칸 'BIGBANG (빅뱅)' 처럼 한쪽이 다른 쪽을 품으면)
    return !!(x.ap && cn.length >= 2 && an.length >= 2 && (cn === an || an.indexOf(cn) === 0 || cn.indexOf(an) === 0));
  }
  // 같은 곡(제목+가수)은 한 번만. 설정이 켜져 있으면 공식본을 남김 (자리는 먼저 나온 자리)
  function gmDedupe(list) {
    var at = {}, out = [], off = gmOffOn();
    (list || []).forEach(function (x) {
      var k = gmKey(x);
      if (!k || k === '|') { out.push(x); return; }
      if (at[k] === undefined) { at[k] = out.length; out.push(x); return; }
      if (off && !gmOfficial(out[at[k]]) && gmOfficial(x)) out[at[k]] = x;
    });
    return out;
  }

  // ---- 곡 메뉴 (⋮): 다음에 재생 · 맨 뒤에 추가 · 가수 노래 더 보기 ----
  // 아래 창을 아래로 밀어 닫기 (목록을 굴린 상태에서 시작한 끌기는 스크롤)
  function gmSwipeClose(sh) {
    var y0 = null;
    sh.addEventListener('touchstart', function (e) {
      y0 = null;
      for (var n = e.target; n && n !== sh; n = n.parentElement) if (n.scrollTop > 0) return;
      if (e.target.closest && e.target.closest('input')) return;
      y0 = e.touches[0].clientY; sh.style.transition = 'none';
    }, { passive: true });
    sh.addEventListener('touchmove', function (e) { if (y0 === null) return; var dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
    sh.addEventListener('touchcancel', function () { y0 = null; sh.style.transition = ''; sh.style.transform = ''; }, { passive: true });
    sh.addEventListener('touchend', function (e) {
      if (y0 === null) return;
      var dy = (e.changedTouches[0] || {}).clientY - y0; y0 = null; sh.style.transition = ''; sh.style.transform = '';
      if (dy > 70) gmMenuClose();
    }, { passive: true });
  }
  function gmMenuClose() {
    var m = GM.menu; if (!m) return;
    GM.menu = null;
    m.sh.classList.add('out'); m.scrim.classList.add('out');
    G.setTimeout.call(W, function () { m.sh.remove(); m.scrim.remove(); }, 200);
    lastGeom = ''; reportGeom();
  }
  function gmMenu(it) {
    gmMenuClose();
    var mk = function (icon, text, fn) {
      var b = G.el('button', { type: 'button', 'class': 'gm-mi' }, [G.el('i', { style: '-webkit-mask-image:url("' + gmIcon(icon) + '")' }), G.el('span', { text: text })]);
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); gmMenuClose(); fn(); }, true);
      return b;
    };
    var q = { id: it.id, title: it.title, ch: it.artist };
    var sh = G.el('div', { 'class': 'gm-sheet', role: 'dialog', 'data-glide': 'music' }, [
      G.el('div', { 'class': 'gm-sg' }),
      G.el('div', { 'class': 'gm-sh' }, [G.el('img', { src: 'https://i.ytimg.com/vi/' + it.id + '/mqdefault.jpg', alt: '' }), G.el('div', {}, [G.el('b', { text: it.title }), G.el('span', { text: it.artist || '' })])]),
      mk('play', '바로 듣기', function () { gmPlay([it], 0, false); }),
      mk('list', '다음에 재생', function () { gmQSend('queueAdd', Object.assign({ front: true }, q)); }),
      mk('add', '맨 뒤에 추가 (재생 대기열)', function () { gmQSend('queueAdd', q); }),
      mk('add', '플레이리스트에 담기', function () { plPick([it]); }),
      it.artist ? mk('person', it.artist + ' 노래 더 보기', function () { gmArtist(it.artist); }) : null,
      mk('video', '뮤직비디오 보기', function () { G.send('openVideo', { url: location.origin + '/watch?v=' + it.id + '&glide_mv=1' }); }),
      GM.view === 'pl' && GM.plId ? mk('close', '이 플레이리스트에서 빼기', function () { var p = plGet(GM.plId); if (!p) return; p.items = p.items.filter(function (x) { return x.id !== it.id; }); plPut(p); var keep = GM.el.scrollTop; gmRender(); GM.el.scrollTop = keep; gmToast('뺐어요: ' + it.title); }) : null
    ]);
    var scrim = G.el('div', { 'class': 'gm-scrim', 'data-glide': 'music' });
    scrim.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); gmMenuClose(); }, true);
    gmSwipeClose(sh);
    GM.menu = { sh: sh, scrim: scrim };
    document.body.appendChild(scrim); document.body.appendChild(sh);
    G.send('haptic', { kind: 'gesture' });
    lastGeom = ''; reportGeom();
  }

  // ---- 가수 화면: 인기곡 · 최신곡 ----
  function gmSnap() { return { view: GM.view, vpl: GM.vpl, genre: GM.genre, genreQ: GM.genreQ, q: GM.q, plId: GM.plId, artist: GM.artist, aTab: GM.aTab, y: GM.el ? GM.el.scrollTop : 0 }; }
  function gmPush() { if (!GM.open) { GM.stack = []; GM.fromOut = true; return; } GM.fromOut = false; (GM.stack = GM.stack || []).push(gmSnap()); if (GM.stack.length > 20) GM.stack.shift(); }
  function gmBack() {
    var st = GM.stack && GM.stack.pop(); if (!st) return false;
    var y = st.y; delete st.y; for (var k in st) GM[k] = st[k];
    if (GM.view !== 'search') gmSrch(false);
    gmRender(); if (GM.el) GM.el.scrollTop = y || 0;
    return true;
  }
  function gmArtist(name) {
    gmPush();
    if (GM.view !== 'artist') GM.prevView = GM.view;
    GM.view = 'artist'; GM.artist = name; GM.aTab = 'top';
    if (!GM.open) gmOpen(); else { gmRender(); GM.el.scrollTop = 0; }
  }
  G.onCommand('openMusic', function (a) {
    if (role() !== 'browse' || !gmOn()) return;
    // 위젯 ▶ (재생 중이 아닐 때): 마지막에 듣던 곡부터 바로 (음악 탭 아래 막대의 ▶와 같은 곡)
    if (a && a.resume) { var l = npLast(); if (l) { gmPlay(l.list, l.i, false); return; } }
    if (REC && REC.open) recClose();
    if (!GM.open) gmOpen();
    if (a && a.search && GM.input) { GM.stack = []; G.setTimeout.call(W, function () { try { GM.input.focus(); GM.input.select(); gmSugShow(); } catch (e) { /* ignore */ } }, 150); }
  });
  G.onCommand('musicArtist', function (a) { if (a && a.name && gmOn()) gmArtist(String(a.name).slice(0, 80)); });
  function gmArtistBack() { if (gmBack()) return; if (GM.fromOut) { GM.fromOut = false; gmClose(); return; } /* 재생 화면에서 가수를 열었으면 뒤로 = 원래 화면 */ GM.view = GM.prevView && GM.prevView !== 'artist' && GM.prevView !== 'pl' && GM.prevView !== 'vpl' ? GM.prevView : (GM.view === 'pl' || GM.view === 'vpl' ? 'mine' : 'chart'); gmRender(); GM.el.scrollTop = 0; }
  function gmNorm(s) { return String(s || '').toLowerCase().replace(/[^0-9a-z가-힣]/g, ''); }
  function gmByArtist(list, name) {
    var n = gmNorm(name).slice(0, 6), mine = list.filter(function (x) { return n && (gmNorm(x.artist).indexOf(n) >= 0 || gmNorm(x.title).indexOf(n) >= 0); });
    return mine.length >= 5 ? mine : list;
  }

  // ---- 내 음악 통계 · 자동 재생목록 (영상 웹뷰가 남긴 들은 기록 glide:gmLog, 이 폰에만) ----
  var GM_LOG = 'glide:gmLog', GM_DATA = 'glide:gmData';
  function gmMonth() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1); }
  function gmDur(s) { s = Math.round(s || 0); var h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? h + '시간 ' + m + '분' : m + '분'; }
  function gmMb(b) { return b >= 1073741824 ? (b / 1073741824).toFixed(1) + 'GB' : Math.round((b || 0) / 1048576) + 'MB'; }
  function gmStats() {
    var lg = gmLsGet(GM_LOG) || [], now = Date.now(), day = 864e5;
    var song = {}, art = {}, weekN = 0, weekS = 0;
    lg.forEach(function (x) {
      if (!x || !x.id) return;
      var e = song[x.id] || (song[x.id] = { id: x.id, title: x.t, artist: x.a, all: 0, m: 0, q: 0, last: 0, d: x.d || 0 });
      e.all++; if (x.at > e.last) { e.last = x.at; e.title = x.t || e.title; e.artist = x.a || e.artist; } if (x.d) e.d = x.d;
      if (now - x.at < 30 * day) { e.m++; if (x.a) { var a = art[x.a] || (art[x.a] = { name: x.a, n: 0, id: x.id }); a.n++; } }
      if (now - x.at < 90 * day) e.q++;
      if (now - x.at < 7 * day) { weekN++; weekS += x.s || 0; }
    });
    var all = Object.keys(song).map(function (k) { return song[k]; });
    var row = function (e, n) { return { id: e.id, title: e.title || '', artist: e.artist || '', len: n }; };
    var top = all.filter(function (e) { return e.m > 0; }).sort(function (a, b) { return b.m - a.m || b.last - a.last; }).slice(0, 30).map(function (e) { return row(e, e.m + '번 들음'); });
    var again = all.filter(function (e) { return e.all >= 3 && now - e.last > 14 * day; }).sort(function (a, b) { return b.all - a.all; }).slice(0, 30).map(function (e) { return row(e, Math.round((now - e.last) / day) + '일 전에 들음'); });
    // 30분 믹스: 석 달 동안 자주 들은 곡을 섞어 30분 안쪽으로
    var pool = gmShuffle(all.filter(function (e) { return e.q >= 2 && e.d > 60; })), mix = [], tot = 0;
    for (var i = 0; i < pool.length && tot < 27 * 60; i++) { if (tot + pool[i].d <= 31 * 60) { mix.push(row(pool[i], '')); tot += pool[i].d; } }
    var arts = Object.keys(art).map(function (k) { return art[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    var dt = gmLsGet(GM_DATA), mData = dt && dt.m === gmMonth() ? dt.b || 0 : 0;
    return { any: lg.length > 0, weekN: weekN, weekS: weekS, top: top, again: again, mix: mix, mixS: tot, arts: arts, data: mData };
  }
  function gmMine(body, token) {
    var st = gmStats();
    body.appendChild(G.el('div', { 'class': 'gm-head' }, [G.el('div', {}, [G.el('h2', { text: '내 기록' })])]));
    // 요약 카드
    body.appendChild(G.el('div', { 'class': 'gm-stat' }, [
      G.el('div', {}, [G.el('small', { text: '이번 주' }), G.el('b', { text: st.weekN + '곡' }), G.el('span', { text: gmDur(st.weekS) })]),
      G.el('div', {}, [G.el('small', { text: '이번 달 음악 데이터' }), G.el('b', { text: gmMb(st.data) }), G.el('span', { text: '영상은 144p로만 받아요' })])
    ]));
    if (!st.any) body.appendChild(G.el('div', { 'class': 'gm-note', text: '노래를 들으면 자주 듣는 곡·30분 믹스 같은 목록이 위에 저절로 생겨요' }));
    // 많이 들은 가수
    if (st.arts.length) {
      body.appendChild(G.el('div', { 'class': 'gm-head' }, [G.el('div', {}, [G.el('h2', { text: '많이 들은 가수' }), G.el('p', { text: '최근 30일' })])]));
      var ar = G.el('div', { 'class': 'gm-arts' });
      st.arts.forEach(function (a) {
        var b = G.el('button', { type: 'button' }, [G.el('img', { src: 'https://i.ytimg.com/vi/' + a.id + '/mqdefault.jpg', alt: '' }), G.el('b', { text: a.name }), G.el('span', { text: a.n + '번' })]);
        b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); gmArtist(a.name); }, true);
        ar.appendChild(b);
      });
      body.appendChild(ar);
    }
  }
  // ---- 시대별 차트 (멜론의 '시대별'처럼 연도를 골라 그해 TOP100): 유튜브에 올라온 연간 차트 재생목록을 찾아 씀.
  //  국내 '2015년 국내 연간차트 top100'(멜론 연간), 해외 'Billboard Year-End Hot 100 2015'. 그해만 담긴 40곡 이상 목록 중 100곡·연간·TOP100 에 가까운 것.
  //  고른 목록은 이 폰에 30일 기억 (매번 찾지 않게) ----
  var GM_YEARS = { kr: { from: 1990, to: 2025 }, global: { from: 1970, to: 2024 } };
  var GM_YEAR_PL = 'glide:gmYearPl';
  function gmYearScore(t, n, y, kind) {
    var yy = String(y);
    if (t.indexOf(yy) < 0) return -1;
    if (new RegExp(yy + '\\s*년대|' + yy + "'?s\\b", 'i').test(t)) return -1; // '2000년대', '1990s' 같은 10년 묶음
    var years = t.match(/(19|20)\d\d/g) || [];
    if (years.some(function (x) { return x !== yy; })) return -1; // 다른 해가 섞인 목록
    if (/[~&]|part|파트/i.test(t) || n < 40) return -1;
    var s = 100 - Math.min(60, Math.abs(100 - n));
    if (kind === 'kr') { if (/연간|year/i.test(t)) s += 30; if (/top\s?100/i.test(t)) s += 20; if (/멜론/.test(t)) s += 10; if (/해외|팝송|billboard/i.test(t)) s -= 80; }
    else { if (/year.?end/i.test(t)) s += 30; if (/hot 100|top 100/i.test(t)) s += 20; if (/billboard/i.test(t)) s += 15; if (/가요|kpop|k-pop|멜론/i.test(t)) s -= 80; }
    return s;
  }
  function gmYearPick(kind, y) {
    var mem = gmLsGet(GM_YEAR_PL) || {}, key = kind + ':' + y, m = mem[key];
    if (m && Date.now() - m.at < 30 * 864e5) return Promise.resolve(m);
    var qs = kind === 'kr' ? [y + '년 국내 연간차트 top100', y + ' 멜론 연간차트 TOP100', y + '년 가요 TOP100'] : ['Billboard Year-End Hot 100 ' + y, 'top 100 songs of ' + y];
    var all = [], i = 0;
    var bestOf = function () { return all.filter(function (x) { return x.s >= 0; }).sort(function (a, b) { return b.s - a.s; })[0] || null; };
    var next = function () {
      var b = bestOf();
      if (i >= qs.length || (b && b.s >= 130)) {
        if (b) { mem[key] = { id: b.id, t: b.t, n: b.n, at: Date.now() }; gmLsSet(GM_YEAR_PL, mem); return mem[key]; }
        return null;
      }
      return yti('search', { query: qs[i++], params: 'EgIQAw%3D%3D' }).then(function (j) {
        (function walk(o, d) {
          if (!o || typeof o !== 'object' || d > 22) return;
          if (Array.isArray(o)) { o.forEach(function (x) { walk(x, d + 1); }); return; }
          var c = o.compactPlaylistRenderer || o.playlistRenderer;
          if (c && c.playlistId) {
            var t = recText(c.title), n = parseInt(recText(c.videoCountShortText) || recText(c.videoCountText) || c.videoCount, 10) || 0;
            all.push({ id: c.playlistId, t: t, n: n, s: gmYearScore(t, n, y, kind) });
            return;
          }
          if (o.lockupViewModel && /PLAYLIST/.test(o.lockupViewModel.contentType || '')) {
            var lv = o.lockupViewModel, md = lv.metadata && lv.metadata.lockupMetadataViewModel, lt = md && md.title && md.title.content;
            var cnt = /"text":"(\d+)\s*(?:개|videos|동영상)/.exec(JSON.stringify(lv.contentImage || {}));
            if (lt) all.push({ id: lv.contentId, t: lt, n: cnt ? +cnt[1] : 0, s: gmYearScore(lt, cnt ? +cnt[1] : 0, y, kind) });
            return;
          }
          for (var k in o) walk(o[k], d + 1);
        })(j, 0);
        return next();
      }, function () { return next(); });
    };
    return next();
  }
  function gmYearSheet() {
    gmMenuClose();
    var kind = GM.chart === 'global' ? 'global' : 'kr', r = GM_YEARS[kind];
    var mk = function (label, y) {
      var b = G.el('button', { type: 'button', 'class': 'gm-yb' + ((GM.year || 0) === (y || 0) ? ' on' : ''), text: label });
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); GM.year = y || 0; gmMenuClose(); gmRender(); GM.el.scrollTop = 0; }, true);
      return b;
    };
    var body = G.el('div', { 'class': 'gm-ys' });
    body.appendChild(G.el('div', { 'class': 'gm-yg' }, [mk('최신 (이번 주)', 0)]));
    for (var dec = Math.floor(r.to / 10) * 10; dec >= Math.floor(r.from / 10) * 10; dec -= 10) {
      body.appendChild(G.el('h4', { text: dec + '년대' }));
      var g = G.el('div', { 'class': 'gm-yg' });
      for (var y = Math.min(r.to, dec + 9); y >= Math.max(r.from, dec); y--) g.appendChild(mk(y + '년', y));
      body.appendChild(g);
    }
    var sh = G.el('div', { 'class': 'gm-sheet gm-ysheet', role: 'dialog', 'data-glide': 'music' }, [
      G.el('div', { 'class': 'gm-sg' }),
      G.el('div', { 'class': 'gm-sh' }, [G.el('div', {}, [G.el('b', { text: '시대별 차트' }), G.el('span', { text: (kind === 'kr' ? '국내' : '해외') + ' · 연도를 고르면 그해 연간 TOP100' })])]),
      body
    ]);
    gmSwipeClose(sh);
    var scrim = G.el('div', { 'class': 'gm-scrim', 'data-glide': 'music' });
    scrim.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); gmMenuClose(); }, true);
    GM.menu = { sh: sh, scrim: scrim };
    document.body.appendChild(scrim); document.body.appendChild(sh);
    var on = sh.querySelector('.gm-yb.on'); if (on) G.setTimeout.call(W, function () { body.scrollTop = Math.max(0, on.offsetTop - 120); }, 0);
    lastGeom = ''; reportGeom();
  }
  // ---- 음원만 (설정 musicPure, 기본 켬): 라이브·콘서트·무대·직캠·커버·리믹스·1시간 반복 같은 영상은 노래 목록에서 뺌 ----
  // 영어 낱말은 낱말 단위로만 ('Alive'·'Live My Life' 같은 노래 제목은 안 걸리게: live 는 (Live)·- Live·live at/in/… 처럼 공연을 뜻할 때만)
  var GM_IMPURE = /([(\[|]\s*live\b|\s-\s*live\b|\blive\s+(at|in|from|on|stage|ver|version|clip|performance|session|concert)\b|라이브|\bconcert\b|콘서트|\btour\b|투어|\bstage\b|무대|직캠|fan\s?cam|\bcover\b|커버|불러\s?봤|reaction|리액션|\bremix\b|리믹스|sped\s?up|slowed|nightcore|\b8d\b|karaoke|노래방|instrumental|\binst\b|\bmr\b|1\s?시간|1\s?hour|\bloop\b|교차편집|music bank|뮤직뱅크|인기가요|inkigayo|엠카운트다운|m\s?countdown|음악중심|쇼!?\s?챔피언|show champion|더\s?시즌즈|스케치북|불후의|복면가왕|킬링보이스|killing voice|it'?s live|딩고|\bdingo\b|busking|버스킹|acoustic ver|piano ver|band ver|\bver\.|version\)|full ver|teaser|티저|\bbehind\b|비하인드|practice|안무)/i;
  function gmPureOn() { return S().musicPure !== false; }
  function gmPure(list) { return gmPureOn() ? (list || []).filter(function (x) { return !GM_IMPURE.test(x.raw || x.title || ''); }) : (list || []); }

  // ---- 내 플레이리스트 (이 폰에 저장, 두 웹뷰가 같이 씀): glide:gmPl [{ id, name, items:[{id,title,artist,len}], at, upd }] ----
  var GM_PL = 'glide:gmPl';
  function plAll() { var l = gmLsGet(GM_PL); return Array.isArray(l) ? l : []; }
  function plSaveAll(l) { gmLsSet(GM_PL, l); }
  function plGet(id) { return plAll().filter(function (p) { return p.id === id; })[0] || null; }
  function plPut(p) { var l = plAll(), i = -1; l.forEach(function (x, k) { if (x.id === p.id) i = k; }); p.upd = Date.now(); if (i >= 0) l[i] = p; else l.unshift(p); plSaveAll(l); return p; }
  function plNew(name) { return plPut({ id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: String(name || '').trim().slice(0, 40) || '내 플레이리스트', items: [], at: Date.now() }); }
  function plDel(id) { plSaveAll(plAll().filter(function (p) { return p.id !== id; })); }
  // 담기: 이미 있는 곡은 건너뜀. 새로 담은 수
  function plAdd(id, items) {
    var p = plGet(id); if (!p) return 0;
    var have = {}; p.items.forEach(function (x) { have[x.id] = 1; });
    var n = 0;
    (items || []).forEach(function (x) { if (x && /^[\w-]{11}$/.test(x.id) && !have[x.id] && p.items.length < 1000) { have[x.id] = 1; p.items.push({ id: x.id, title: x.title || '', artist: x.artist || '', len: x.len || '' }); n++; } });
    plPut(p); return n;
  }
  function plSecs(p) { return p.items.reduce(function (s, x) { return s + gmSecs(x.len); }, 0); }
  function plCover(p, size) {
    var ids = p.items.slice(0, 4).map(function (x) { return x.id; });
    var box = G.el('div', { 'class': 'pl-cv' + (ids.length >= 4 ? ' q' : ''), style: 'width:' + size + 'px;height:' + size + 'px' });
    if (!ids.length) box.appendChild(G.el('i'));
    (ids.length >= 4 ? ids : ids.slice(0, 1)).forEach(function (id) { box.appendChild(G.el('img', { src: 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg', alt: '', loading: 'lazy' })); });
    return box;
  }
  function plToast(text) { if (role() === 'player') gmToastPlayer(text); else gmToast(text); }
  function plAddedMsg(p, n, total) { return n ? '‘' + p.name + '’에 ' + (total > 1 ? n + '곡 ' : '') + '담았어요' + (total > n ? ' (이미 있던 ' + (total - n) + '곡 빼고)' : '') : '이미 ‘' + p.name + '’에 있어요'; }

  // 담기 창 (둘러보기): 맨 위 '새 플레이리스트' → 이름 쓰고 바로 담김, 아래는 플레이리스트 목록 (누르면 바로 담김)
  function plPick(items, done) {
    gmMenuClose();
    items = (items || []).filter(function (x) { return x && x.id; });
    if (!items.length) return;
    var body = G.el('div', { 'class': 'pl-pick' });
    var newRow = G.el('button', { type: 'button', 'class': 'pl-row nw' }, [G.el('div', { 'class': 'pl-cv' }, [G.el('i', { 'class': 'plus' })]), G.el('b', { text: '새 플레이리스트' })]);
    newRow.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      plAsk('새 플레이리스트', '', '만들고 담기', function (name) { var p = plNew(name); var n = plAdd(p.id, items); plToast(plAddedMsg(p, n, items.length)); if (done) done(); if (GM.open && GM.view === 'mine') gmRender(); });
    }, true);
    body.appendChild(newRow);
    plAll().forEach(function (p) {
      var r = G.el('button', { type: 'button', 'class': 'pl-row' }, [plCover(p, 48), G.el('div', {}, [G.el('b', { text: p.name }), G.el('span', { text: p.items.length + '곡' })])]);
      r.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); var n = plAdd(p.id, items); gmMenuClose(); plToast(plAddedMsg(p, n, items.length)); if (done) done(); if (GM.open && GM.view === 'mine') gmRender(); }, true);
      body.appendChild(r);
    });
    gmSheet([G.el('div', { 'class': 'gm-sh' }, [G.el('div', {}, [G.el('b', { text: '플레이리스트에 담기' }), G.el('span', { text: items.length > 1 ? items.length + '곡' : (items[0].title || '') })])]), body], 'pl-sheet');
  }
  // 이름 쓰기 창 (만들기·이름 바꾸기)
  function plAsk(title, value, okText, cb) {
    gmMenuClose();
    var input = G.el('input', { type: 'text', value: value || '', placeholder: '플레이리스트 이름', maxlength: '40', enterkeyhint: 'done' });
    var ok = G.el('button', { type: 'button', 'class': 'pl-ok', text: okText });
    var done = function () { var v = input.value.trim(); if (!v) { input.focus(); return; } input.blur(); gmMenuClose(); G.send('haptic', { kind: 'gesture' }); cb(v); };
    ok.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); done(); }, true);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); done(); } });
    gmSheet([G.el('div', { 'class': 'gm-sh' }, [G.el('div', {}, [G.el('b', { text: title })])]), G.el('div', { 'class': 'pl-ask' }, [input, ok])], 'pl-sheet');
    G.setTimeout.call(W, function () { try { input.focus(); input.select(); } catch (e) { /* ignore */ } }, 280);
  }
  // 아래에서 올라오는 창 공통 (곡 메뉴와 같은 모양)
  function gmSheet(children, cls) {
    gmMenuClose();
    var sh = G.el('div', { 'class': 'gm-sheet ' + (cls || ''), role: 'dialog', 'data-glide': 'music' }, [G.el('div', { 'class': 'gm-sg' })].concat(children));
    gmSwipeClose(sh);
    var scrim = G.el('div', { 'class': 'gm-scrim', 'data-glide': 'music' });
    scrim.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); gmMenuClose(); }, true);
    GM.menu = { sh: sh, scrim: scrim };
    document.body.appendChild(scrim); document.body.appendChild(sh);
    lastGeom = ''; reportGeom();
    return sh;
  }
  // 내 음악 맨 위: 플레이리스트 칸 (새로 만들기 + 내 플레이리스트들)
  // 내 음악 (2026-11-25 사용자: "내 음악은 플레이리스트·좋아요한 곡처럼 간단하게. 듣고 싶은 곡을 어렵게 찾게 하면 더 힘들다"):
  // 플레이리스트 판 하나 — 새로 만들기 · 좋아요한 곡 · 내가 만든 목록 · 저절로 만든 목록(최근 들은·자주 듣는·30분 믹스·다시 듣기). 누르면 곡 목록(view 'vpl')
  var GM_VPL = { liked: '좋아요한 곡', recent: '최근 들은 곡', top: '자주 듣는 곡', mix: '30분 믹스', again: '다시 듣기' };
  function gmRecentList() { return (gmLsGet(GM_RECENT) || []).map(function (x) { return { id: x.id, title: x.title, artist: x.artist, len: '' }; }); }
  function gmVplList(k) {
    if (k === 'liked') return gmGet('liked', gmLiked);
    if (k === 'recent') return Promise.resolve(gmRecentList().slice(0, 100));
    var st = gmStats();
    return Promise.resolve(k === 'top' ? st.top : k === 'mix' ? st.mix : k === 'again' ? st.again : []);
  }
  function gmVplOpen(k) { gmPush(); if (GM.view !== 'vpl') GM.prevView = GM.view; GM.view = 'vpl'; GM.vpl = k; gmRender(); GM.el.scrollTop = 0; }
  function plShelf(body) {
    var l = plAll(), st = gmStats(), recent = gmRecentList();
    body.appendChild(G.el('div', { 'class': 'gm-head' }, [G.el('div', {}, [G.el('h2', { text: '플레이리스트' })])]));
    var grid = G.el('div', { 'class': 'pl-grid' });
    var add = G.el('button', { type: 'button', 'class': 'pl-card nw' }, [G.el('div', { 'class': 'pl-cv' }, [G.el('i', { 'class': 'plus' })]), G.el('b', { text: '새로 만들기' })]);
    add.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); plAsk('새 플레이리스트', '', '만들기', function (name) { var p = plNew(name); plOpen(p.id); }); }, true);
    grid.appendChild(add);
    var auto = function (k, items, sub, icon) {
      var cv = items && items.length ? plCover({ items: items }, 0) : G.el('div', { 'class': 'pl-cv' }, [G.el('i', { style: '-webkit-mask-image:url("' + gmIcon(icon) + '")' })]);
      var c = G.el('button', { type: 'button', 'class': 'pl-card', 'data-vpl': k }, [cv, G.el('b', { text: GM_VPL[k] }), G.el('span', { text: sub })]);
      c.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); gmVplOpen(k); }, true);
      grid.appendChild(c);
    };
    // 좋아요한 곡: 받아 둔 목록이 있으면 표지·곡 수, 아니면 하트
    var lc = GM.cache && GM.cache.liked && GM.cache.liked.v;
    auto('liked', lc, lc ? lc.length + '곡' : '유튜브 좋아요', 'heartf');
    l.forEach(function (p) {
      var c = G.el('button', { type: 'button', 'class': 'pl-card' }, [plCover(p, 0), G.el('b', { text: p.name }), G.el('span', { text: p.items.length + '곡' })]);
      c.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); plOpen(p.id); }, true);
      grid.appendChild(c);
    });
    if (recent.length) auto('recent', recent, recent.length + '곡', 'note');
    if (st.top.length) auto('top', st.top, '최근 30일 · ' + st.top.length + '곡', 'note');
    if (st.mix.length >= 3) auto('mix', st.mix, st.mix.length + '곡 · ' + gmDur(st.mixS), 'mix');
    if (st.again.length) auto('again', st.again, '한동안 안 들은 곡', 'repeat');
    body.appendChild(grid);
  }
  // 좋아요한 곡·저절로 만든 목록 화면
  function gmVplView(body, token, load, fail) {
    var k = GM.vpl;
    var back = G.el('button', { type: 'button', 'class': 'gm-back' }, [G.el('i'), '내 음악']);
    back.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); gmArtistBack(); }, true);
    body.appendChild(back);
    body.appendChild(load);
    gmVplList(k).then(function (list) {
      if (token !== GM.token) return;
      load.remove();
      var sub = { liked: '유튜브에서 좋아요 표시한 노래', recent: 'Glide Music으로 들은 노래 (이 폰에만)', top: '최근 30일 동안 많이 들은 순서', mix: '많이 들은 곡으로 30분 안쪽 · 들을 때마다 새로 섞여요', again: '좋아했는데 한동안 안 들은 곡' }[k] || '';
      body.appendChild(G.el('div', { 'class': 'gm-head' }, [G.el('div', {}, [G.el('h2', { text: GM_VPL[k] || '' }), G.el('p', { text: (list && list.length ? list.length + '곡 · ' : '') + sub })])]));
      if (!list) { body.appendChild(G.el('div', { 'class': 'gm-note', text: '로그인하면 좋아요한 곡이 보여요' })); return; }
      if (!list.length) { body.appendChild(G.el('div', { 'class': 'gm-note', text: k === 'liked' ? '좋아요한 노래가 없어요' : '아직 들은 곡이 없어요' })); return; }
      if (k === 'mix') body.appendChild(G.el('div', { 'class': 'gm-acts' }, [gmBtn('p', '전체 듣기', 'play', function () { gmPlay(gmStats().mix, 0, false); }), gmBtn('s', '담기', 'add', function () { plPick(list); })]));
      else body.appendChild(gmActs(list));
      body.appendChild(gmList(list, k === 'top'));
    }, function (e) {
      if (token !== GM.token) return;
      if (k !== 'liked') { fail(e); return; }
      load.remove(); body.appendChild(G.el('div', { 'class': 'gm-note', text: '좋아요한 곡을 받지 못했어요' })); log('warn', '음악 탭 좋아요: ' + (e && e.message));
    });
  }
  function plOpen(id) { gmPush(); if (GM.view !== 'pl') GM.prevView = GM.view; GM.view = 'pl'; GM.plId = id; if (!GM.open) gmOpen(); else { gmRender(); GM.el.scrollTop = 0; } }
  // 플레이리스트 화면: 표지·이름·곡 수·시간, 전체 듣기·셔플·⋮(이름 바꾸기·삭제), 곡은 ≡ 끌어 순서 바꾸기 · ⋮ 빼기
  function plView(body) {
    var p = plGet(GM.plId);
    var back = G.el('button', { type: 'button', 'class': 'gm-back' }, [G.el('i'), '내 음악']);
    back.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); gmArtistBack(); }, true);
    body.appendChild(back);
    if (!p) { body.appendChild(G.el('div', { 'class': 'gm-note', text: '플레이리스트가 없어요' })); return; }
    var more = G.el('button', { type: 'button', 'class': 'pl-more', 'aria-label': '플레이리스트 메뉴' }, [G.el('i')]);
    more.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var mk = function (label, fn, danger) { var b = G.el('button', { type: 'button', 'class': 'gm-mi' + (danger ? ' red' : '') }, [G.el('span', { text: label })]); b.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); gmMenuClose(); fn(); }, true); return b; };
      gmSheet([G.el('div', { 'class': 'gm-sh' }, [G.el('div', {}, [G.el('b', { text: p.name }), G.el('span', { text: p.items.length + '곡' })])]),
        mk('이름 바꾸기', function () { plAsk('이름 바꾸기', p.name, '저장', function (name) { var q = plGet(p.id); if (q) { q.name = name.slice(0, 40); plPut(q); gmRender(); } }); }),
        mk('플레이리스트 삭제', function () {
          var yes = G.el('button', { type: 'button', 'class': 'pl-ok red', text: '삭제' });
          yes.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); plDel(p.id); gmMenuClose(); gmArtistBack(); plToast('‘' + p.name + '’을 삭제했어요'); }, true);
          gmSheet([G.el('div', { 'class': 'gm-sh' }, [G.el('div', {}, [G.el('b', { text: '‘' + p.name + '’을 삭제할까요?' }), G.el('span', { text: '담긴 ' + p.items.length + '곡 목록이 사라져요' })])]), G.el('div', { 'class': 'pl-ask' }, [yes])], 'pl-sheet');
        }, true)], 'pl-sheet');
    }, true);
    var secs = plSecs(p);
    body.appendChild(G.el('div', { 'class': 'pl-hd' }, [plCover(p, 132), G.el('div', {}, [G.el('h2', { text: p.name }), G.el('p', { text: p.items.length + '곡' + (secs ? ' · ' + gmDur(secs) : '') })]), more]));
    if (!p.items.length) { body.appendChild(G.el('div', { 'class': 'gm-note', text: '곡의 ⋮로 담거나, 길게 눌러 여러 곡을 한 번에 담아요' })); return; }
    body.appendChild(gmActs(p.items, true));
    var box = G.el('div', { 'class': 'pl-list' });
    p.items.forEach(function (x, i) {
      var row = gmRow(p.items, i, 0);
      var hd = G.el('div', { 'class': 'pl-hdl', 'aria-label': '끌어서 순서 바꾸기' }, [G.el('i')]);
      row.insertBefore(hd, row.firstChild);
      hd.addEventListener('touchstart', function (e) { e.stopPropagation(); plDrag(e, row, i, box, p.id); }, { capture: true, passive: true });
      hd.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); }, true);
      box.appendChild(row);
    });
    body.appendChild(box);
  }
  function plDrag(e, row, from, list, pid) {
    var rows = [].slice.call(list.children), h = row.getBoundingClientRect().height || 68, y0 = e.touches[0].clientY, to = from, sy = GM.el.scrollTop;
    GM.dragging = true; lastPull = null; reportPull();
    row.classList.add('drag'); rows.forEach(function (r) { if (r !== row) r.classList.add('mv'); });
    G.send('haptic', { kind: 'gesture' });
    var move = function (ev) {
      if (ev.cancelable) ev.preventDefault();
      var y = ev.touches[0].clientY, dy = y - y0 + (GM.el.scrollTop - sy);
      // 위·아래 끝에 닿으면 목록을 굴림
      var r = GM.el.getBoundingClientRect(); if (y > r.bottom - 60) GM.el.scrollTop += 12; else if (y < r.top + 60) GM.el.scrollTop -= 12;
      row.style.transform = 'translateY(' + dy + 'px)';
      var t = Math.max(0, Math.min(rows.length - 1, from + Math.round(dy / h)));
      if (t !== to) { to = t; G.send('haptic', { kind: 'tick' }); }
      rows.forEach(function (rr, j) { if (rr === row) return; var sh = (from < to && j > from && j <= to) ? -h : (from > to && j < from && j >= to) ? h : 0; rr.style.transform = sh ? 'translateY(' + sh + 'px)' : ''; });
    };
    var end = function () {
      document.removeEventListener('touchmove', move, true); document.removeEventListener('touchend', end, true); document.removeEventListener('touchcancel', end, true);
      GM.dragging = false; lastPull = null; reportPull();
      if (to !== from) { var p = plGet(pid); if (p) { var x = p.items.splice(from, 1)[0]; p.items.splice(to, 0, x); plPut(p); } }
      var keep = GM.el.scrollTop; gmRender(); GM.el.scrollTop = keep;
    };
    document.addEventListener('touchmove', move, { capture: true, passive: false });
    document.addEventListener('touchend', end, true); document.addEventListener('touchcancel', end, true);
  }
  // ---- 화면 ----
  function gmCss() {
    if (document.getElementById('glide-music-style')) return;
    recCss(); // --gr-* 색 변수
    var F = 'Pretendard,Roboto,"Noto Sans KR",sans-serif', T1 = 'var(--gr-t1)', T2 = 'var(--gr-t2)', BG = 'var(--gr-bg)', CH = 'var(--gr-chip)';
    var AC = '#3b5bff', LIME = '#DDF46A';
    var st = G.el('style', { id: 'glide-music-style', 'data-glide': 'music' });
    st.textContent =
      '#glide-music-tab{flex:1 1 0;min-width:0;display:flex;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;color:inherit}' +
      '#glide-music-tab .pivot-bar-item-tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:100%;height:100%}' +
      '#glide-music-tab i{display:block;width:24px;height:24px;background-color:currentColor;-webkit-mask:url("' + gmIcon('note') + '") center/22px 22px no-repeat}' +
      'html.glide-gm-open ytm-feed-filter-chip-bar-renderer{visibility:hidden!important}' +
      'html.glide-gm-open ytm-pivot-bar-item-renderer [aria-selected=true] c3-icon[icon-state-filled]{display:none!important}' +
      'html.glide-gm-open ytm-pivot-bar-item-renderer [aria-selected=true] c3-icon[icon-state-outline]{display:inline-flex!important}' +
      'html.glide-gm-open #glide-music-tab{font-weight:700}' +
      '#glide-music{position:fixed;left:0;right:0;z-index:2;overflow-y:auto;overscroll-behavior:contain;background:' + BG + ';color:' + T1 + ';font-family:' + F + '}' +
      '#glide-music[hidden]{display:none}' +
      '.gm-top{position:sticky;top:0;z-index:2;background:' + BG + ';padding:10px 0 0}' +
      '.gm-brand{display:flex;align-items:center;gap:10px;padding:0 16px 8px}' +
      '.gm-brand b{flex:none;white-space:nowrap;font:800 22px/1 ' + F + ';letter-spacing:-.5px}' +
      // 좁은 화면(폴드2 바깥 320px·글자 110%)에서 제목이 'Glid/e/Musi/c'로 꺾였음 → 한 줄, 좁으면 글자만 줄임 (2026-11-25)
      '@media (max-width:360px){.gm-brand b{font-size:19px}}.gm-brand b span{color:' + AC + '}' +
      '.gm-search{flex:1;min-width:0;display:flex;align-items:center;gap:8px;height:38px;padding:0 12px;border-radius:19px;background:' + CH + '}' +
      '.gm-search i{flex:none;width:18px;height:18px;background-color:' + T2 + ';-webkit-mask:url("' + gmIcon('search') + '") center/18px 18px no-repeat}' +
      '.gm-search input{all:unset;flex:1;min-width:0;font:400 14px/1 ' + F + ';color:' + T1 + '}' +
      '.gm-tabs{display:flex;gap:4px;padding:0 10px;border-bottom:1px solid rgba(128,128,128,.18)}' +
      '.gm-tabs button{all:unset;padding:10px 10px 11px;font:600 15px/1 ' + F + ';color:' + T2 + ';cursor:pointer;border-bottom:3px solid transparent}' +
      '.gm-tabs button[aria-pressed=true]{color:' + T1 + ';border-bottom-color:' + T1 + '}' +
      '.gm-seg{display:flex;gap:8px;padding:14px 16px 4px}' +
      '.gm-seg button{all:unset;padding:7px 14px;border-radius:17px;background:' + CH + ';font:600 13px/1 ' + F + ';cursor:pointer}' +
      '.gm-seg button[aria-pressed=true]{background:' + T1 + ';color:' + BG + '}' +
      '.gm-seg.gm-sort{padding:2px 16px 6px}.gm-resort{animation:gmresort .22s cubic-bezier(.2,0,0,1) both}@keyframes gmresort{from{opacity:0;transform:translateY(6px)}}' +
      '.gm-head{display:flex;align-items:flex-end;gap:10px;padding:16px 16px 6px}' +
      '.gm-head div{flex:1;min-width:0}.gm-head h2{margin:0;font:800 20px/1.25 ' + F + '}.gm-head p{margin:3px 0 0;font:400 12px/1.4 ' + F + ';color:' + T2 + '}' +
      // 좁은 화면(폴드2 바깥 320px) + 폰 글자 크기 110%에서 버튼 글자가 한 글자씩 꺾였음('전체 듣/기', '셔/플', '시대/별') → 한 줄 고정, 넘치면 줄을 옆으로 밂 (2026-11-25 실기)
      '#glide-music button{white-space:nowrap}.gm-seg,.gm-acts{overflow-x:auto;scrollbar-width:none}.gm-seg::-webkit-scrollbar,.gm-acts::-webkit-scrollbar{display:none}.gm-seg button,.gm-acts button,.gm-yrb{flex:none}' +
      '.gm-acts{display:flex;align-items:center;gap:8px;padding:8px 16px 10px}' +
      // 머리 줄: 'Glide Music' + 🔍 아이콘. 누르면 줄 전체가 검색창(‹ 뒤로 · 입력 · ✕)이 되고 아래가 검색 목록 (유튜브 뮤직 방식)
      'html.glide-gm-open ytm-mobile-topbar-renderer,html.glide-gm-open .mobile-topbar-header{visibility:hidden!important}' +
      '.gm-top{padding-top:6px!important}.gm-glide{all:unset;flex:0 0 40px;width:40px;height:40px;border-radius:20px;cursor:pointer;background:url("' + LOGO + '") center/26px 26px no-repeat;-webkit-tap-highlight-color:transparent}.gm-glide:active{background-color:rgba(127,127,127,.2)}.gm-top.srch .gm-glide{display:none}' +
      // 제목 로고 (사용자 고름 C, 2026-11-25): 파랑 → 시트론 그라데이션 글자 한 덩어리
      '.gm-brand b{font-weight:900!important;font-size:23px!important;letter-spacing:-.8px!important;background:linear-gradient(90deg,#6F86FF 0%,#3b5bff 45%,#DDF46A 100%);-webkit-background-clip:text;background-clip:text;color:transparent}.gm-brand b span{color:transparent!important}' +
      '@media (max-width:360px){.gm-brand b{font-size:21px!important}}' +
      '.gm-brand{min-height:44px}.gm-brand .gm-search{flex:0 0 40px;width:40px;height:40px;padding:0;margin-left:auto;justify-content:center;background:transparent;border-radius:20px;cursor:pointer}.gm-brand .gm-search i{width:22px;height:22px;-webkit-mask-size:22px 22px;background-color:' + T1 + '}.gm-brand .gm-search input{position:absolute;width:1px;opacity:0;pointer-events:none}' +
      '.gm-sback,.gm-sclr{all:unset;display:none;flex:none;width:40px;height:40px;border-radius:20px;cursor:pointer;align-items:center;justify-content:center}.gm-sback i,.gm-sclr i{width:22px;height:22px;background-color:' + T1 + ';-webkit-mask:center/22px 22px no-repeat}.gm-sclr i{width:18px;height:18px;-webkit-mask-size:18px 18px;background-color:' + T2 + '}' +
      '.gm-top.srch .gm-brand b{display:none}.gm-top.srch .gm-sback{display:flex}.gm-top.srch .gm-brand{gap:4px;padding-left:6px}.gm-top.srch .gm-brand .gm-search{flex:1 1 auto;width:auto;padding:0 6px 0 12px;justify-content:flex-start;background:' + CH + ';cursor:text}.gm-top.srch .gm-brand .gm-search i{width:18px;height:18px;-webkit-mask-size:18px 18px;background-color:' + T2 + '}.gm-top.srch .gm-brand .gm-search input{position:static;width:auto;opacity:1;pointer-events:auto}.gm-top.srch .gm-sclr.on{display:flex}' +
      '.gm-top.srch .gm-tabs{display:none}' +
      // 검색 목록: 떠 있는 카드 대신 머리 줄 아래를 꽉 채운 목록
      '.gm-top.srch .gm-sug{left:0!important;right:0!important;top:100%!important;width:auto!important;border-radius:0;box-shadow:none;background:' + BG + ';max-height:none;height:calc(100vh - 100%);padding:6px 0;animation:gmfade .12s both}.gm-top.srch .gm-sg-row{height:46px;padding-left:16px;font-size:15px}.gm-top.srch .gm-sg-hd{padding:8px 16px 4px}' +
      // 필터 알약·버튼: 작고 가볍게
      '.gm-seg{gap:6px!important;padding:12px 16px 2px!important}.gm-seg button{padding:6px 12px!important;font-size:12.5px!important;font-weight:600!important}' +
      '.gm-seg .gm-yrb{padding:5px 8px 5px 11px!important;gap:2px!important}.gm-seg .gm-yrb i{width:16px!important;height:16px!important;-webkit-mask-image:url("' + gmIcon('down') + '")!important;-webkit-mask-size:16px 16px!important}' +
      '.gm-acts button{padding:8px 14px!important;font-size:13.5px!important}.gm-acts .ic{width:36px;height:36px;padding:0!important;justify-content:center;border-radius:18px!important}.gm-acts .ic i{width:18px;height:18px;-webkit-mask-size:18px 18px}' +
      '#glide-music input::-webkit-search-cancel-button{-webkit-appearance:none;display:none}' +
      // 탭: 화면 폭을 4칸으로 고르게 (오른쪽이 비지 않게)
      '.gm-tabs{gap:0!important;padding:0!important}.gm-tabs button{flex:1 1 0;text-align:center;padding:12px 0 11px!important;font-size:15px!important}' +
      // 여백 한 가지 규칙: 좌우 16px, 덩어리 사이 12px
      '.gm-seg{padding:12px 16px 0!important}.gm-cap{padding:10px 16px 0!important;font-size:12px}' +
      // 목록 머리 줄 (멜론 \'TOP100 전체듣기\' 막대처럼): 같은 높이·같은 바탕의 막대 하나 + 아이콘 칸, 아래 구분선
      '.gm-acts{margin:12px 16px 4px;padding:0 0 12px!important;gap:6px!important;border-bottom:1px solid rgba(128,128,128,.2)}' +
      '.gm-acts button{height:40px!important;box-sizing:border-box!important;display:flex!important;align-items:center!important;border-radius:10px!important;padding:0 14px!important;background:' + CH + '!important;color:' + T1 + '!important;font:700 14px/1 ' + F + '!important}' +
      '.gm-acts .p{flex:1 1 auto;justify-content:center}.gm-acts .p i{width:15px;height:15px}.gm-acts .ic{width:40px!important;flex:none;border-radius:10px!important}' +
      '.gm-head{padding:18px 16px 4px!important}.gm-head + .gm-acts{margin-top:10px}' +
      '.gm-row{padding:7px 8px 7px 12px!important;min-height:66px;box-sizing:border-box}' +
      // 장르·무드 칸: 대표곡 고화질 표지 + 아래쪽 어둡게 + 이름 (멜론 무드 타일처럼). 표지를 받기 전엔 색 칸
      '.gm-grid{gap:10px!important;padding:10px 16px 4px!important}.gm-grid button{height:auto!important;aspect-ratio:16/10!important;min-height:84px;padding:0!important;align-items:flex-end!important;background:var(--gc)!important;border-radius:12px!important;overflow:hidden}' +
      '.gm-grid button::before{display:none}.gm-grid button img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .25s}.gm-grid button img.ok{opacity:1}' +
      '.gm-grid button::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(0,0,0,.72))}' +
      '.gm-grid button b{position:relative;z-index:1;padding:0 12px 10px;font:800 16px/1.2 ' + F + ';color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 3px rgba(0,0,0,.4)}' +
      '.gm-sub{padding:20px 16px 0!important;font-size:18px!important}' +
      '.gm-vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
      '.gm-cap{padding:12px 16px 0;font:400 12px/1.3 ' + F + ';color:' + T2 + '}.gm-cap + .gm-acts{padding-top:6px}' +
      '.gm-acts button{all:unset;display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:20px;font:700 14px/1 ' + F + ';cursor:pointer}' +
      '.gm-acts .p{background:' + T1 + ';color:' + BG + '}.gm-acts .s{background:' + CH + ';color:' + T1 + '}' +
      '.gm-acts i{width:16px;height:16px;background-color:currentColor;-webkit-mask:center/16px 16px no-repeat}' +
      '.gm-row{display:flex;align-items:center;gap:12px;padding:8px 8px 8px 12px;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
      '.gm-row:active{background:' + CH + '}' +
      '.gm-rank{flex:none;width:28px;text-align:center;font:800 16px/1 ' + F + '}.gm-rank.t{color:' + T1 + '}' +
      '.gm-art{flex:none;width:52px;height:52px;border-radius:6px;overflow:hidden;background:' + CH + '}' +
      // 지금 듣는 곡 표시 (멜론·유튜브 뮤직 앱처럼): 제목 강조색 + 썸네일 위 막대 그림 (2026-11-25)
      '.gm-art{position:relative}.gm-row.now .gm-txt b{color:' + AC + '}.gm-row.now .gm-art::after{content:"";position:absolute;inset:0;background:rgba(0,0,0,.5) url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27%23fff%27%3E%3Crect x=%274%27 y=%2710%27 width=%273.2%27 height=%2710%27 rx=%271.2%27/%3E%3Crect x=%2710.4%27 y=%274%27 width=%273.2%27 height=%2716%27 rx=%271.2%27/%3E%3Crect x=%2716.8%27 y=%278%27 width=%273.2%27 height=%2712%27 rx=%271.2%27/%3E%3C/svg%3E") center/22px 22px no-repeat}' +
      '.gm-art img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.gm-txt{flex:1;min-width:0}.gm-txt b{display:block;font:600 15px/1.3 ' + F + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.gm-txt span{display:block;margin-top:3px;font:400 13px/1.3 ' + F + ';color:' + T2 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.gm-row button{all:unset;flex:none;width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:20px}' +
      '.gm-row button i{width:20px;height:20px;background-color:' + T2 + ';-webkit-mask:url("' + gmIcon('more') + '") center/20px 20px no-repeat}' +
      '.gm-row button.pl i{background-color:' + T1 + ';-webkit-mask-image:url("' + gmIcon('play') + '")}' +
      '.gm-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:14px 16px}' +
      '.gm-grid button{all:unset;position:relative;overflow:hidden;height:52px;border-radius:8px;padding:0 12px 0 20px;box-sizing:border-box;background:' + CH + ';color:' + T1 + ';font:700 15px/1.2 ' + F + ';cursor:pointer;display:flex;align-items:center;white-space:nowrap;text-overflow:ellipsis}' +
      '.gm-grid button::before{content:"";position:absolute;left:0;top:0;bottom:0;width:7px;background:var(--gc)}' +
      '.gm-sub{padding:18px 16px 2px;font:800 18px/1.25 ' + F + '}' +
      '.gm-note{padding:28px 20px;text-align:center;font:400 14px/1.5 ' + F + ';color:' + T2 + '}' +
      '.gm-load{padding:22px;text-align:center;font:400 13px/1 ' + F + ';color:' + T2 + '}' +
      '.gm-body>*{animation:gmin .26s cubic-bezier(.2,0,0,1) both}@keyframes gmin{from{opacity:0;transform:translateY(8px)}}' +
      '.gm-rank{display:flex;flex-direction:column;align-items:center;gap:3px}.gm-d{font:700 10px/1 ' + F + ';letter-spacing:-.2px}.gm-d.up{color:#ff4d5e}.gm-d.dn{color:#4d8bff}.gm-d.nw{color:' + AC + '}.gm-d.eq{color:' + T2 + ';opacity:.6}' +
      '.gm-row,.gm-card,.gm-arts button,.gm-grid button,.gm-acts button{transition:transform .15s cubic-bezier(.2,0,0,1),background-color .15s}.gm-row:active,.gm-card:active,.gm-arts button:active,.gm-grid button:active,.gm-acts button:active{transform:scale(.97)}' +
      '.gm-scrim{position:fixed;inset:0;z-index:2147483640;background:rgba(0,0,0,.45);animation:gmfade .2s both}.gm-scrim.out{animation:gmfade .2s reverse both}@keyframes gmfade{from{opacity:0}}' +
      '.gm-sheet{position:fixed;left:0;right:0;bottom:0;z-index:2147483641;padding:0 0 calc(10px + env(safe-area-inset-bottom));border-radius:20px 20px 0 0;background:' + BG + ';color:' + T1 + ';font-family:' + F + ';box-shadow:0 -6px 24px rgba(0,0,0,.25);animation:gmup .26s cubic-bezier(.2,0,0,1) both;transition:transform .2s cubic-bezier(.2,0,0,1)}' +
      '.gm-sheet.out{animation:gmdown .2s cubic-bezier(.4,0,1,1) both}@keyframes gmup{from{transform:translateY(100%)}}@keyframes gmdown{to{transform:translateY(100%)}}' +
      '.gm-sg{width:36px;height:4px;margin:8px auto 6px;border-radius:2px;background:rgba(128,128,128,.45)}' +
      '.gm-sh{display:flex;align-items:center;gap:12px;padding:8px 20px 12px;border-bottom:1px solid rgba(128,128,128,.18)}.gm-sh img{width:48px;height:48px;border-radius:6px;object-fit:cover}.gm-sh div{min-width:0}.gm-sh b{display:block;font:700 15px/1.3 ' + F + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gm-sh span{font:400 13px/1.3 ' + F + ';color:' + T2 + '}' +
      '.gm-mi{all:unset;display:flex;align-items:center;gap:16px;width:100%;box-sizing:border-box;padding:14px 22px;font:500 15px/1.2 ' + F + ';cursor:pointer}.gm-mi:active{background:' + CH + '}.gm-mi i{flex:none;width:22px;height:22px;background-color:' + T1 + ';-webkit-mask:center/22px 22px no-repeat}' +
      '.gm-stat{display:flex;gap:10px;padding:14px 16px 2px}.gm-stat div{flex:1;padding:14px;border-radius:14px;background:' + CH + '}.gm-stat small{display:block;font:500 12px/1 ' + F + ';color:' + T2 + '}.gm-stat b{display:block;margin:8px 0 4px;font:800 22px/1 ' + F + '}.gm-stat span{font:400 11px/1.3 ' + F + ';color:' + T2 + '}' +
      '.gm-cards{display:flex;gap:10px;overflow-x:auto;padding:6px 16px 8px;scrollbar-width:none}.gm-cards::-webkit-scrollbar{display:none}' +
      '.gm-card{all:unset;position:relative;flex:none;width:148px;height:148px;border-radius:14px;padding:14px;box-sizing:border-box;color:#fff;display:flex;flex-direction:column;justify-content:flex-end;cursor:pointer;background-size:cover}' +
      '.gm-card b{font:800 17px/1.2 ' + F + '}.gm-card span{margin-top:4px;font:400 11px/1.3 ' + F + ';opacity:.85}.gm-card i{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:15px;background:#fff;-webkit-mask:none}.gm-card i::after{content:"";position:absolute;inset:7px;background:#111;-webkit-mask:url("' + gmIcon('play') + '") center/16px 16px no-repeat}' +
      '.gm-arts{display:flex;gap:14px;overflow-x:auto;padding:6px 16px 8px;scrollbar-width:none}.gm-arts::-webkit-scrollbar{display:none}' +
      '.gm-arts button{all:unset;flex:none;width:76px;text-align:center;cursor:pointer}.gm-arts img{width:76px;height:76px;border-radius:38px;object-fit:cover;background:' + CH + '}.gm-arts b{display:block;margin-top:6px;font:600 13px/1.2 ' + F + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gm-arts span{font:400 11px/1 ' + F + ';color:' + T2 + '}' +
      '.gm-back{all:unset;display:flex;align-items:center;gap:4px;padding:12px 12px 0;font:600 14px/1 ' + F + ';cursor:pointer}.gm-back i{width:20px;height:20px;background-color:' + T1 + ';-webkit-mask:url("' + gmIcon('back') + '") center/20px 20px no-repeat}' +
      '.gm-ahead{display:flex;align-items:center;gap:16px;padding:16px 16px 4px}.gm-ahead img{width:84px;height:84px;border-radius:42px;object-fit:cover;background:' + CH + ';box-shadow:0 6px 20px rgba(0,0,0,.25)}.gm-ahead h2{margin:0;font:800 24px/1.2 ' + F + '}.gm-ahead p{margin:4px 0 0;font:400 12px/1 ' + F + ';color:' + T2 + '}' +
      '.gm-seg .gm-yrb{all:unset;margin-left:auto;display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:17px;border:1px solid rgba(128,128,128,.35);font:600 13px/1 ' + F + ';cursor:pointer}.gm-seg .gm-yrb.on{border-color:' + AC + ';color:' + AC + '}' +
      '.gm-yrb i{width:15px;height:15px;background-color:currentColor;-webkit-mask:url("' + gmIcon('tune') + '") center/15px 15px no-repeat}' +
      '.gm-ysheet{max-height:78%;display:flex;flex-direction:column}.gm-ys{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:6px 16px 14px}' +
      '.gm-ys h4{margin:16px 4px 8px;font:800 14px/1 ' + F + ';color:' + T2 + '}.gm-yg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.gm-yg:first-child{grid-template-columns:1fr;margin-top:6px}' +
      '.gm-yb{all:unset;padding:11px 0;border-radius:10px;background:' + CH + ';text-align:center;font:600 14px/1 ' + F + ';cursor:pointer;transition:transform .15s}.gm-yb:active{transform:scale(.95)}.gm-yb.on{background:' + AC + ';color:#fff}' +
      '.gm-mi.red span{color:#ff5a5f}' +
      '.pl-cv{position:relative;flex:none;border-radius:10px;overflow:hidden;background:' + CH + ';display:grid}.pl-cv.q{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}.pl-cv img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.pl-cv i{width:100%;height:100%;background-color:' + T2 + ';-webkit-mask:url("' + gmIcon('note') + '") center/40% 40% no-repeat;opacity:.6}.pl-cv i.plus{-webkit-mask-image:url("' + gmIcon('plus') + '");opacity:.9}' +
      '.pl-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px 12px;padding:8px 16px 6px}' +
      '.pl-card{all:unset;display:flex;flex-direction:column;min-width:0;cursor:pointer;transition:transform .15s}.pl-card:active{transform:scale(.97)}.pl-card .pl-cv{width:100%!important;height:auto!important;aspect-ratio:1/1}' +
      '.pl-card b{display:block;margin-top:8px;font:700 14px/1.3 ' + F + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pl-card span{margin-top:2px;font:400 12px/1.3 ' + F + ';color:' + T2 + '}.pl-card.nw .pl-cv{background:transparent;border:1.5px dashed rgba(128,128,128,.45)}' +
      '.pl-sheet{max-height:80%;display:flex;flex-direction:column}.pl-pick{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:6px 0 8px}' +
      '.pl-row{all:unset;display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;padding:9px 20px;cursor:pointer}.pl-row:active{background:' + CH + '}.pl-row .pl-cv{width:48px;height:48px}.pl-row div{min-width:0}.pl-row b{display:block;font:600 15px/1.3 ' + F + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pl-row span{font:400 12px/1.3 ' + F + ';color:' + T2 + '}.pl-row.nw b{color:' + AC + '}.pl-row.nw .pl-cv{border:1.5px dashed rgba(128,128,128,.45);background:transparent}' +
      '.pl-ask{display:flex;gap:10px;padding:14px 20px 8px}.pl-ask input{all:unset;flex:1;min-width:0;height:44px;padding:0 14px;border-radius:12px;background:' + CH + ';font:500 15px/1 ' + F + ';color:' + T1 + '}' +
      '.pl-ok{all:unset;flex:none;height:44px;padding:0 18px;border-radius:12px;background:' + AC + ';color:#fff;font:700 14px/44px ' + F + ';cursor:pointer;text-align:center}.pl-ok.red{flex:1;background:#e5484d}' +
      '.pl-hd{display:flex;align-items:center;gap:16px;padding:14px 12px 4px 16px}.pl-hd>div{flex:1;min-width:0}.pl-hd h2{margin:0;font:800 22px/1.25 ' + F + ';word-break:keep-all}.pl-hd p{margin:6px 0 0;font:400 13px/1 ' + F + ';color:' + T2 + '}' +
      '.pl-more{all:unset;align-self:flex-start;width:40px;height:40px;border-radius:20px;display:flex;align-items:center;justify-content:center;cursor:pointer}.pl-more i{width:20px;height:20px;background-color:' + T2 + ';-webkit-mask:url("' + gmIcon('more') + '") center/20px 20px no-repeat}' +
      '.pl-list .gm-row{padding-left:4px}.pl-hdl{flex:none;width:30px;height:48px;margin-right:-6px;display:flex;align-items:center;justify-content:center;touch-action:none}.pl-hdl i{width:20px;height:20px;background-color:' + T2 + ';opacity:.6;-webkit-mask:url("' + gmIcon('drag') + '") center/20px 20px no-repeat}' +
      '.pl-list .gm-row.mv{transition:transform .18s cubic-bezier(.2,0,0,1)}.pl-list .gm-row.drag{position:relative;z-index:2;background:' + CH + ';box-shadow:0 6px 18px rgba(0,0,0,.2);border-radius:10px}' +
      '#glide-music .gm-row.sel{background:rgba(59,91,255,.16)}' +
      '#glide-music.gm-selmode .gm-row>button:last-child i{width:22px;height:22px;border-radius:11px;box-sizing:border-box;border:2px solid ' + T2 + ';background:transparent;-webkit-mask:none;opacity:.7}' +
      '#glide-music.gm-selmode .gm-row.sel>button:last-child i{border:0;opacity:1;background:' + AC + ' url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Cpath d=%22M9.5 16.2 5.8 12.5l-1.4 1.4 5.1 5.1L20 8.5l-1.4-1.4z%22 fill=%22%23fff%22/%3E%3C/svg%3E") center/16px 16px no-repeat}' +
      '#glide-music.gm-selmode .gm-row:active{transform:none}' +
      '.gm-selbar{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;justify-content:center;gap:10px;background:' + BG + ';border-bottom:1px solid rgba(128,128,128,.18);animation:gmsel .18s cubic-bezier(.2,0,0,1) both}.gm-selbar.out{animation:gmsel .16s reverse both}@keyframes gmsel{from{opacity:0;transform:translateY(-6px)}}' +
      '.gm-sh1{display:flex;align-items:center;gap:6px;padding:0 12px 0 6px}.gm-sh1 b{flex:1;font:800 18px/1 ' + F + '}' +
      '.gm-sx{all:unset;width:40px;height:40px;border-radius:20px;display:flex;align-items:center;justify-content:center;cursor:pointer}.gm-sx i{width:22px;height:22px;background-color:' + T1 + ';-webkit-mask:url("' + gmIcon('close') + '") center/22px 22px no-repeat}' +
      '.gm-sall{all:unset;padding:8px 10px;font:700 14px/1 ' + F + ';color:' + AC + ';cursor:pointer}' +
      '.gm-sacts{display:flex;gap:8px;overflow-x:auto;padding:0 16px;scrollbar-width:none}.gm-sacts::-webkit-scrollbar{display:none}' +
      '.gm-sa{all:unset;flex:none;display:flex;align-items:center;gap:6px;padding:9px 14px;border-radius:20px;background:' + CH + ';color:' + T1 + ';font:700 13px/1 ' + F + ';cursor:pointer;transition:transform .15s}.gm-sa:active{transform:scale(.95)}' +
      '.gm-sa i{width:16px;height:16px;background-color:currentColor;-webkit-mask:center/16px 16px no-repeat}.gm-sa.p{background:' + AC + ';color:#fff}.gm-sa.red{color:#ff5a5f}' +
      '#glide-np{position:fixed;left:8px;right:8px;z-index:3;display:flex;align-items:center;gap:4px;height:60px;padding:0 6px 0 8px;border-radius:14px;background:linear-gradient(' + CH + ',' + CH + '),' + BG + ';color:' + T1 + ';box-shadow:0 8px 24px rgba(0,0,0,.28),0 0 0 1px rgba(128,128,128,.14);overflow:hidden;font-family:' + F + ';cursor:pointer;-webkit-tap-highlight-color:transparent;will-change:transform}' +
      '#glide-np.np-in{animation:npin .32s cubic-bezier(.05,.7,.1,1) both}@keyframes npin{from{transform:translate3d(0,22px,0) scale(.97);opacity:0}}' +
      '#glide-np .np-v{position:relative;flex:1;min-width:0;align-self:stretch;overflow:hidden}' +
      '#glide-np .np-k{position:absolute;inset:0;display:flex;align-items:center;will-change:transform}' +
      '#glide-np .np-k.np-swap{animation:npsw .28s cubic-bezier(.2,.9,.25,1) both}@keyframes npsw{from{transform:translate3d(14px,0,0);opacity:0}}' +
      '#glide-np[hidden]{display:none}' +
      '#glide-np img{flex:none;width:44px;height:44px;border-radius:8px;object-fit:cover;background:rgba(128,128,128,.3)}' +
      '#glide-np .np-tx{flex:1;min-width:0;margin-left:8px}#glide-np .np-tx b{display:block;font:700 14.5px/1.3 ' + F + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#glide-np .np-tx span{display:block;margin-top:2px;font:400 12.5px/1.3 ' + F + ';opacity:.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#glide-np button{all:unset;flex:none;width:40px;height:44px;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:22px}#glide-np button:active{transform:scale(.9)}' +
      '#glide-np button i{width:22px;height:22px;background-color:currentColor;-webkit-mask:center/22px 22px no-repeat}#glide-np button:nth-of-type(2) i{width:26px;height:26px;-webkit-mask-size:26px 26px}' +
      '#glide-np .np-tr{position:absolute;left:12px;right:12px;bottom:0;height:2px;background:rgba(128,128,128,.35);border-radius:1px}#glide-np:not(.live) .np-tr{display:none}#glide-np .np-pg{display:block;height:100%;width:0;background:' + AC + ';border-radius:1px;transition:width .5s linear}' +
      '#glide-music.np-on .gm-body{padding-bottom:76px}' +
      '.gm-sug{position:absolute;left:12px;right:12px;top:48px;z-index:5;max-height:50vh;overflow-y:auto;overscroll-behavior:contain;padding:4px 0;border-radius:12px;background:linear-gradient(' + CH + ',' + CH + '),' + BG + ';box-shadow:0 6px 16px rgba(0,0,0,.18),0 0 0 1px rgba(128,128,128,.12);animation:gmsel .14s cubic-bezier(.2,0,0,1) both}' +
      '.gm-sg-row{display:flex;align-items:center;gap:10px;padding:0 2px 0 12px;height:38px;font:400 14px/1.2 ' + F + ';color:' + T1 + ';cursor:pointer;-webkit-tap-highlight-color:transparent}.gm-sg-row:active{background:rgba(128,128,128,.14)}' +
      '.gm-sg-hd{display:flex;align-items:center;justify-content:space-between;padding:6px 12px 2px;font:600 12px/1 ' + F + ';color:' + T2 + '}.gm-sg-hd button{all:unset;padding:6px 2px;font:500 12px/1 ' + F + ';color:' + T2 + ';cursor:pointer}' +
      '.gm-sg-row span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.gm-sg-ic{flex:none;width:15px;height:15px;background-color:' + T2 + ';-webkit-mask:url("' + gmIcon('search') + '") center/15px 15px no-repeat}' +
      '.gm-sg-row.r .gm-sg-ic{-webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23000%27 stroke-width=%272%27 stroke-linecap=%27round%27%3E%3Ccircle cx=%2712%27 cy=%2712%27 r=%279%27/%3E%3Cpath d=%27M12 7v5l3 2%27/%3E%3C/svg%3E")}' +
      '.gm-sg-x,.gm-sg-fill{all:unset;flex:none;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:20px}' +
      '.gm-sg-x::after,.gm-sg-fill::after{content:"";width:13px;height:13px;background-color:' + T2 + ';-webkit-mask:url("' + gmIcon('close') + '") center/13px 13px no-repeat}' +
      '.gm-sg-fill::after{-webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23000%27 stroke-width=%272%27 stroke-linecap=%27round%27%3E%3Cpath d=%27M17 17L7 7M7 15V7h8%27/%3E%3C/svg%3E")}' +
      '.gm-badge{margin-left:6px;padding:2px 6px;border-radius:4px;background:' + LIME + ';color:#111;font:800 10px/1 ' + F + ';vertical-align:2px}';
    (document.head || document.documentElement).appendChild(st);
  }
  function gmEnsureTab() {
    var tab = document.getElementById('glide-music-tab');
    if (!gmOn()) { if (tab) tab.parentNode.removeChild(tab); if (GM.open) gmClose(); return; }
    var bar = document.querySelector('ytm-pivot-bar-renderer');
    if (!bar) return;
    var items = bar.querySelectorAll('ytm-pivot-bar-item-renderer');
    if (!items.length) return;
    // 홈 · 구독 · 추천 · 음악 · 내 페이지: 마지막 칸(내 페이지) 바로 앞 (추천 탭은 음악 탭 앞에 들어감)
    var last = items[items.length - 1];
    if (tab && tab.parentNode === bar && tab.nextElementSibling === last) return;
    gmCss();
    if (!tab) {
      tab = G.el('div', { id: 'glide-music-tab', role: 'tab', 'aria-label': '음악' }, [G.el('div', { 'class': 'pivot-bar-item-tab' }, [G.el('i'), G.el('div', { 'class': 'pivot-bar-item-title', text: '음악' })])]);
      tab.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); if (GM.open) { if (GM.el.scrollTop > 0) GM.el.scrollTo({ top: 0, behavior: 'smooth' }); } else gmOpen(); }, true);
    }
    bar.insertBefore(tab, last);
    recEnsureTab(); // 추천 탭이 음악 탭 앞에 오게
  }
  // ---- 검색 연관 검색어·최근 검색어 ----
  var GM_SH = 'glide:gmSearchHist';
  function gmDoSearch(q) {
    q = String(q || '').trim(); if (!q) return;
    var h = (gmLsGet(GM_SH) || []).filter(function (x) { return x !== q; }); h.unshift(q); gmLsSet(GM_SH, h.slice(0, 20));
    gmSugClose();
    if (GM.input) { GM.input.value = q; GM.input.blur(); }
    gmPush(); GM.q = q; GM.view = 'search'; gmSrch(true); gmRender(); if (GM.el) GM.el.scrollTop = 0;
  }
  // 검색 모드 (머리 줄 전체가 검색창). 검색 결과 화면에서도 켜 둠(검색어 보임). 끄면 탭·제목으로
  function gmSrchOn() { return !!(GM.top && GM.top.classList.contains('srch')); }
  function gmSrch(on) {
    if (!GM.top || gmSrchOn() === on) return;
    GM.top.classList.toggle('srch', on);
    if (!on) { gmSugClose(); if (GM.input) { GM.input.blur(); if (GM.view !== 'search') GM.input.value = ''; } }
    var c = GM.top.querySelector('.gm-sclr'); if (c) c.classList.toggle('on', !!(on && GM.input && GM.input.value));
    lastGeom = ''; reportGeom();
  }
  // ‹ : 목록이 떠 있으면 닫고, 검색 결과 화면이면 이전 화면, 아니면 검색 모드 끝
  function gmSrchBack() {
    if (GM.view === 'search') { gmSugClose(); if (!gmBack()) { GM.view = 'chart'; gmRender(); } if (GM.view !== 'search') gmSrch(false); return; }
    gmSrch(false);
  }
  function gmSugClose() { if (GM.sug) { GM.sug.remove(); GM.sug = null; lastGeom = ''; reportGeom(); } clearTimeout(GM.sugT); }
  function gmSugShow() {
    var input = GM.input; if (!input || !GM.open) return;
    var q = input.value.trim();
    clearTimeout(GM.sugT);
    if (!q) { gmSugDraw((gmLsGet(GM_SH) || []).slice(0, 6), true); return; }
    GM.sugT = G.setTimeout.call(W, function () {
      var want = q;
      fetch('https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=ko&q=' + encodeURIComponent(want), { credentials: 'omit' })
        .then(function (r) { return r.json(); }).then(function (j) {
          if (!GM.input || GM.input.value.trim() !== want || document.activeElement !== GM.input) return;
          var list = (j && j[1] || []).filter(function (x) { return typeof x === 'string' && x !== want; }).slice(0, 6);
          // 최근 검색어 중 지금 글자로 시작하는 것을 맨 위에
          var rec = (gmLsGet(GM_SH) || []).filter(function (x) { return x.indexOf(want) === 0 && list.indexOf(x) === -1; }).slice(0, 2);
          gmSugDraw(rec.concat(list).slice(0, 6), false, rec.length);
        }).catch(function () {});
    }, 120);
  }
  function gmSugDraw(items, recent, nRecent) {
    if (!GM.top) return;
    if (!items.length) { gmSugClose(); return; }
    var box = GM.sug;
    if (!box) {
      box = GM.sug = G.el('div', { 'class': 'gm-sug', role: 'listbox' });
      // 누르는 동안 검색창 포커스가 빠지지 않게 (blur 로 목록이 먼저 닫히지 않게)
      box.addEventListener('mousedown', function (e) { e.preventDefault(); }, true);
      box.addEventListener('touchstart', function () { GM.sugTouch = Date.now(); }, { passive: true });
      GM.top.appendChild(box);
      lastGeom = ''; reportGeom();
    }
    recClear(box);
    try {
      var lab = GM.input.closest('.gm-search'), tr = GM.top.getBoundingClientRect(), lr = lab.getBoundingClientRect();
      box.style.left = Math.round(lr.left - tr.left) + 'px'; box.style.right = Math.round(tr.right - lr.right) + 'px'; box.style.top = Math.round(lr.bottom - tr.top + 6) + 'px';
    } catch (e) { /* ignore */ }
    if (recent) {
      var clr = G.el('button', { type: 'button', text: '전체 삭제' });
      clr.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); gmLsSet(GM_SH, []); gmSugClose(); }, true);
      box.appendChild(G.el('div', { 'class': 'gm-sg-hd' }, [G.el('span', { text: '최근 검색어' }), clr]));
    }
    items.forEach(function (t, i) {
      var isRecent = recent || i < (nRecent || 0);
      var row = G.el('div', { 'class': 'gm-sg-row' + (isRecent ? ' r' : ''), role: 'option' }, [G.el('i', { 'class': 'gm-sg-ic' }), G.el('span', { text: t })]);
      row.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); gmDoSearch(t); }, true);
      var side = isRecent
        ? G.el('button', { type: 'button', 'class': 'gm-sg-x', 'aria-label': '최근 검색어 지우기' })
        : G.el('button', { type: 'button', 'class': 'gm-sg-fill', 'aria-label': '검색창에 넣기' });
      side.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (isRecent) { gmLsSet(GM_SH, (gmLsGet(GM_SH) || []).filter(function (x) { return x !== t; })); gmSugShow(); }
        else { GM.input.value = t + ' '; GM.input.focus(); gmSugShow(); }
      }, true);
      row.appendChild(side);
      box.appendChild(row);
    });
  }
  function gmBuild() {
    if (GM.el && GM.el.isConnected) return;
    gmCss();
    var input = G.el('input', { type: 'search', placeholder: '노래, 가수 검색', enterkeyhint: 'search', autocomplete: 'off' });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); gmDoSearch(input.value); } });
    var sback = G.el('button', { type: 'button', 'class': 'gm-sback', 'aria-label': '검색 닫기' }, [G.el('i', { style: '-webkit-mask-image:url("' + gmIcon('back') + '")' })]);
    var sclr = G.el('button', { type: 'button', 'class': 'gm-sclr', 'aria-label': '지우기' }, [G.el('i', { style: '-webkit-mask-image:url("' + gmIcon('close') + '")' })]);
    var slab = G.el('label', { 'class': 'gm-search', 'aria-label': '검색' }, [G.el('i'), input]);
    // 유튜브 상단 바의 Glide 버튼(빠른 메뉴)을 여기로
    var gbtn = G.el('button', { type: 'button', 'class': 'gm-glide', 'aria-label': 'Glide 메뉴' });
    gbtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('openPanel', {}); }, true);
    slab.addEventListener('click', function () { if (!gmSrchOn()) { gmSrch(true); G.setTimeout.call(W, function () { input.focus(); }, 0); } });
    sback.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); gmSrchBack(); }, true);
    sclr.addEventListener('mousedown', function (e) { e.preventDefault(); }, true);
    sclr.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); input.value = ''; sclr.classList.remove('on'); input.focus(); gmSugShow(); }, true);
    input.addEventListener('input', function () { sclr.classList.toggle('on', !!input.value); });
    input.addEventListener('focus', function () { gmSugShow(); });
    input.addEventListener('input', function () { gmSugShow(); });
    input.addEventListener('blur', function () { G.setTimeout.call(W, function () { if (document.activeElement !== input && Date.now() - (GM.sugTouch || 0) > 600) gmSugClose(); }, 150); });
    GM.top = G.el('div', { 'class': 'gm-top' }, [
      G.el('div', { 'class': 'gm-brand' }, [sback, G.el('b', {}, ['Glide ', G.el('span', { text: 'Music' })]), slab, sclr, gbtn]),
      G.el('div', { 'class': 'gm-tabs' })
    ]);
    GM.input = input;
    GM.body = G.el('div', { 'class': 'gm-body' });
    GM.el = G.el('div', { id: 'glide-music', hidden: '' }, [GM.top, GM.body]);
    document.body.appendChild(GM.el);
    GM.el.addEventListener('scroll', function () { reportPull(); if (GM.moreFn && GM.el.scrollTop + GM.el.clientHeight > GM.el.scrollHeight - 700) GM.moreFn(); }, { passive: true });
  }
  // 상단 바·아래 메뉴의 '보일 때' 높이 (지금 위치가 아니라 크기로: 스크롤로 숨었다 내려오는 중이어도 같은 값)
  function gmBars(forRec) {
    var h = document.querySelector('ytm-mobile-topbar-renderer'), b = document.querySelector('ytm-pivot-bar-renderer');
    var hr = h && h.getBoundingClientRect(), br = b && b.getBoundingClientRect();
    var top = !forRec && GM && GM.open ? 0 : hr && hr.height ? hr.height + Math.max(0, hr.top) : 48;
    var bottom = br && br.height ? br.height + Math.max(0, innerHeight - br.bottom) : 56;
    return [Math.round(top), Math.round(bottom)];
  }
  function gmPlace() {
    if (!GM.el) return;
    var tb = gmBars();
    GM.el.style.top = tb[0] + 'px';
    GM.el.style.bottom = tb[1] + 'px';
    if (NP.el && !NP.el.hidden) NP.el.style.bottom = (tb[1] + 8) + 'px';
  }
  function gmOpen() {
    if (!gmOn()) return;
    if (REC && REC.open) recClose();
    gmBuild();
    GM.open = true; GM.path = location.pathname + location.search;
    GM.homeY = W.scrollY || 0;
    if (GM.homeY) W.scrollTo(0, 0);
    document.documentElement.classList.add('glide-gm-open');
    recTheme();
    gmPlace();
    GM.el.hidden = false;
    lastGeom = ''; reportGeom(); lastPull = null; reportPull();
    gmRender();
    G.send('npAsk', {}); npDraw(); lastGeom = ''; reportGeom();
    // 열린 직후 상단 바가 다시 내려오는 동안 매 화면마다 자리 맞춤 (0.6초)
    var t0 = Date.now(); (function follow() { if (!GM.open) return; gmPlace(); if (Date.now() - t0 < 600) W.requestAnimationFrame(follow); })();
    if (GM.keepTop) { var kt = GM.keepTop; W.requestAnimationFrame(function () { if (GM.open) GM.el.scrollTop = kt; }); }
    log('info', '음악 탭 열기');
  }
  function gmClose() {
    if (!GM.open) return;
    gmSugClose();
    gmSelEnd();
    GM.stack = [];
    GM.open = false;
    npDraw();
    if (GM.el) { GM.keepTop = GM.el.scrollTop; GM.el.hidden = true; }
    document.documentElement.classList.remove('glide-gm-open');
    if (GM.homeY && location.pathname + location.search === GM.path) W.scrollTo(0, GM.homeY);
    lastGeom = ''; reportGeom(); lastPull = null; reportPull();
  }
  function gmBtn(cls, text, icon, fn) {
    var ic = / ic\b/.test(' ' + cls);
    var b = G.el('button', { type: 'button', 'class': cls, 'aria-label': ic ? text : null }, [icon ? G.el('i', { style: '-webkit-mask-image:url("' + gmIcon(icon) + '")' }) : null, ic ? G.el('span', { 'class': 'gm-vh', text: text }) : text]);
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fn(); }, true);
    return b;
  }
  // ---- 영어로만 나오는 한국 곡 제목을 한글로 (2026-11-23 사용자: "소문의 낙원이 Paradise of Rumors 로 나옴") ----
  // 유튜브 차트·Topic 음원은 유통사의 영어 제목을 씀. 유튜브 안에는 '소문의 낙원 (Paradise of Rumors)'처럼 두 이름을 함께 적은 제목이 많음
  // → 가수 + 영어 제목으로 한 번 찾아(계정 정보 없이) 그 짝을 가수 공식 채널에서 보거나 3번 넘게 보면 한글 제목으로. 못 찾으면 영어 그대로.
  // 찾은 결과는 두 웹뷰가 같이 보는 glide:gmKo 에 기억 (찾지 못한 곡은 7일 뒤 다시). 목록 줄은 화면에 보일 때만 찾음
  var GM_KO = 'glide:gmKo';
  var KO = { mem: null, memAt: 0, q: [], busy: 0, n: 0, wait: {}, obs: null };
  function koNeed(t) { t = String(t || ''); return /[a-z]/i.test(t) && !/[가-힣]/.test(t) && t.length <= 60; }
  function koKey(t, a) { return gmNorm(String(a || '').replace(/\s*-\s*Topic$/i, '')).slice(0, 16) + '|' + gmNorm(t); }
  function koMap() { if (!KO.mem || Date.now() - KO.memAt > 5000) { KO.mem = gmLsGet(GM_KO) || {}; KO.memAt = Date.now(); } return KO.mem; }
  function koGet(t, a) { if (!koNeed(t)) return null; var e = koMap()[koKey(t, a)]; return e && e.k ? e.k : null; }
  function koShow(t, a) { return koGet(t, a) || t; }
  function koPick(list, title, artist) {
    var nt = gmNorm(title), na = gmNorm(String(artist || '').replace(/\s*-\s*Topic$/i, '')), cnt = {}, off = {};
    list.forEach(function (x) {
      var raw = String(x.raw || ''), chn = gmNorm(String(x.ch || '').replace(/\s*-\s*Topic$/i, ''));
      var official = !!(chn && na && (chn === na || chn.indexOf(na) === 0 || na.indexOf(chn) === 0));
      var re = /([^()\[\]【】「」|ㅣ\/:,\-–_'"‘’“”]{1,40})[(\[【]([^()\[\]【】]{1,40})[)\]】]/g, m;
      while ((m = re.exec(raw))) {
        var a = m[1].trim(), b = m[2].trim(), ko = null;
        if (gmNorm(b) === nt && /[가-힣]/.test(a) && !/[a-z]/i.test(a)) ko = a;
        else if (gmNorm(a) === nt && /[가-힣]/.test(b) && !/[a-z]/i.test(b)) ko = b;
        if (!ko) continue;
        ko = ko.replace(/^['‘"“\s]+|['’"”\s]+$/g, '');
        if (!ko || ko.length > 30 || /가사|해석|자막|번역|커버|라이브|직캠|노래방|반응|모음/.test(ko)) continue;
        cnt[ko] = (cnt[ko] || 0) + 1; if (official) off[ko] = 1;
      }
    });
    // 영어 '제목'이 사실 가수 이름이면(채널 이름과 같음 — 'AKMU' → '악뮤') 바꾸지 않음
    if (list.filter(function (x) { return gmNorm(String(x.ch || '').replace(/\s*-\s*Topic$/i, '')).indexOf(nt) === 0; }).length >= 2) return null;
    var best = null;
    for (var k in cnt) if ((off[k] || cnt[k] >= 3) && (!best || cnt[k] > cnt[best])) best = k;
    return best;
  }
  /** 한글 제목 찾기 (기억에 있으면 바로). done(한글 제목 또는 null) */
  function koFind(t, a, done, first) {
    if (!koNeed(t)) return;
    var key = koKey(t, a), e = koMap()[key];
    if (e && (e.k || Date.now() - (e.at || 0) < 7 * 86400000)) { if (e.k && done) done(e.k); return; }
    if (KO.wait[key]) { if (done) KO.wait[key].push(done); return; }
    if (KO.n >= 200) return; // 한 화면에서 너무 많이 찾지 않게
    KO.wait[key] = done ? [done] : [];
    var job = { key: key, t: t, a: String(a || '').replace(/\s*-\s*Topic$/i, '') };
    if (first) KO.q.unshift(job); else KO.q.push(job);
    koPump();
  }
  function koPump() {
    while (KO.busy < 2 && KO.q.length) {
      var j = KO.q.shift(); KO.busy++; KO.n++;
      (function (j) {
        yti('search', { query: (j.a ? j.a + ' ' : '') + j.t, params: 'EgIQAQ%3D%3D' }).then(function (res) {
          var k = koPick(gmItems(res).items, j.t, j.a), m = gmLsGet(GM_KO) || {};
          m[j.key] = k ? { k: k, at: Date.now() } : { at: Date.now() };
          var ks = Object.keys(m); if (ks.length > 5000) ks.slice(0, ks.length - 5000).forEach(function (x) { delete m[x]; });
          gmLsSet(GM_KO, m); KO.mem = m; KO.memAt = Date.now();
          if (k) {
            log('info', '한글 제목: ' + j.t + ' → ' + k);
            try { document.querySelectorAll('[data-kok]').forEach(function (el) { if (el.getAttribute('data-kok') === j.key) { el.textContent = k; el.removeAttribute('data-kok'); } }); } catch (e) { /* ignore */ }
          }
          (KO.wait[j.key] || []).forEach(function (fn) { try { if (k) fn(k); } catch (e) { /* ignore */ } });
        }, function () { /* 다음에 다시 */ }).then(function () { delete KO.wait[j.key]; KO.busy--; koPump(); });
      })(j);
    }
  }
  /** 제목 칸: 한글 제목이 있으면 바로, 없으면 칸이 화면에 보일 때 찾아서 바꿈 */
  function koT(el, t, a) {
    var k = koGet(t, a);
    el.textContent = k || t || '';
    if (k || !koNeed(t)) return el;
    var key = koKey(t, a), e = koMap()[key];
    if (e && Date.now() - (e.at || 0) < 7 * 86400000) return el; // 찾아봤지만 없음
    el.setAttribute('data-kok', key);
    if (!('IntersectionObserver' in W)) { koFind(t, a); return el; }
    if (!KO.obs) KO.obs = new IntersectionObserver(function (es) { es.forEach(function (en) { if (!en.isIntersecting) return; KO.obs.unobserve(en.target); var d = en.target._ko; if (d && en.target.getAttribute('data-kok')) koFind(d[0], d[1]); }); }, { rootMargin: '200px' });
    el._ko = [t, a]; KO.obs.observe(el);
    return el;
  }
  // 지금 듣는 곡(앱이 알려 주는 nowPlaying, 음악 모드일 때만) — 목록 줄에 .now
  function gmNowVid() { return NP && NP.d && NP.d.active && NP.d.vid || ''; }
  function gmNowMark() {
    var v = gmNowVid();
    var rows = document.querySelectorAll('#glide-music .gm-row');
    for (var i = 0; i < rows.length; i++) rows[i].classList.toggle('now', !!v && rows[i].getAttribute('data-gid') === v);
  }
  function gmRow(list, i, rank, delta) {
    var it = list[i];
    var more = G.el('button', { type: 'button', 'aria-label': '곡 메뉴' }, [G.el('i')]);
    more.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); gmMenu(it); }, true);
    var dl = null;
    if (rank && delta) {
      var dv = delta[it.id];
      dl = dv === 'new' ? G.el('span', { 'class': 'gm-d nw', text: 'NEW' }) : dv > 0 ? G.el('span', { 'class': 'gm-d up', text: '▲' + dv }) : dv < 0 ? G.el('span', { 'class': 'gm-d dn', text: '▼' + (-dv) }) : G.el('span', { 'class': 'gm-d eq', text: '–' });
    }
    var row = G.el('div', { 'class': 'gm-row' + (GM.sel && GM.sel.ids[it.id] ? ' sel' : '') + (it.id === gmNowVid() ? ' now' : ''), role: 'button', 'data-gid': it.id }, [
      rank ? G.el('div', { 'class': 'gm-rank' + (rank <= 3 ? ' t' : '') }, [G.el('span', { text: String(rank) }), dl]) : null,
      G.el('div', { 'class': 'gm-art' }, [G.el('img', { src: 'https://i.ytimg.com/vi/' + it.id + '/mqdefault.jpg', alt: '', loading: i < 12 ? 'eager' : 'lazy', decoding: 'async' })]),
      G.el('div', { 'class': 'gm-txt' }, [koT(G.el('b'), it.title, it.artist), G.el('span', { text: it.artist + (it.len ? ' · ' + it.len : '') })]),
      more
    ]);
    row._gmIt = it;
    // 줄 전체 듣기 (⋮ 버튼은 제외: 줄이 먼저 잡으면 ⋮를 눌러도 바로 재생됐음). 여러 곡 고르는 중이면 체크/해제 (⋮ 자리의 동그라미 포함)
    row.addEventListener('click', function (e) {
      if (GM.sel) { if (e.target.closest && e.target.closest('.pl-hdl')) return; e.preventDefault(); e.stopPropagation(); gmSelToggle(it); return; }
      if (e.target.closest && e.target.closest('button')) return; e.preventDefault(); e.stopPropagation(); gmPlay(list, i, false);
    }, true);
    // 길게 누르면 여러 곡 고르기 시작 (이미 고르는 중이면 체크/해제)
    var lp = null;
    var lx = 0, ly = 0;
    row.addEventListener('touchstart', function (e) { clearTimeout(lp); lx = e.touches[0].clientX; ly = e.touches[0].clientY; lp = setTimeout(function () { lp = 'fired'; gmSelToggle(it); }, 480); }, { passive: true });
    row.addEventListener('touchmove', function (e) { if (lp === 'fired') return; var t = e.touches[0]; if (Math.abs(t.clientX - lx) > 10 || Math.abs(t.clientY - ly) > 10) clearTimeout(lp); }, { passive: true });
    row.addEventListener('touchcancel', function () { if (lp !== 'fired') clearTimeout(lp); }, { passive: true });
    row.addEventListener('touchend', function (e) { if (lp === 'fired') { if (e.cancelable) e.preventDefault(); lp = null; } else clearTimeout(lp); });
    return row;
  }
  // ---- 여러 곡 고르기: 길게 누르면 시작, 위에 버튼 줄(플레이리스트에 담기·재생·다음에 재생·맨 뒤에 추가·빼기) ----
  function gmSelKey() { return [GM.view, GM.vpl, GM.plId, GM.chart, GM.year, GM.genre, GM.q, GM.artist, GM.aTab].join(':'); }
  function gmSelToggle(it) {
    if (!GM.el) return;
    G.send('haptic', { kind: 'gesture' });
    if (!GM.sel) GM.sel = { ids: {}, view: gmSelKey() };
    if (GM.sel.ids[it.id]) delete GM.sel.ids[it.id]; else GM.sel.ids[it.id] = it;
    if (!Object.keys(GM.sel.ids).length) { gmSelEnd(); return; }
    gmSelPaint();
  }
  function gmSelEnd() {
    if (!GM.sel) return;
    GM.sel = null;
    if (GM.el) { GM.el.classList.remove('gm-selmode'); [].forEach.call(GM.el.querySelectorAll('.gm-row.sel'), function (r) { r.classList.remove('sel'); }); }
    var b = GM.top && GM.top.querySelector('.gm-selbar'); if (b) { b.classList.add('out'); G.setTimeout.call(W, function () { b.remove(); }, 160); }
  }
  // 고른 곡: 화면 목록 순서대로 (같은 곡이 두 번 보여도 한 번)
  function gmSelItems() {
    if (!GM.sel) return [];
    var seen = {}, out = [];
    [].forEach.call(GM.body.querySelectorAll('.gm-row'), function (r) { var it = r._gmIt; if (it && GM.sel.ids[it.id] && !seen[it.id]) { seen[it.id] = 1; out.push(it); } });
    Object.keys(GM.sel.ids).forEach(function (id) { if (!seen[id]) out.push(GM.sel.ids[id]); });
    return out;
  }
  function gmSelAllRows() { var seen = {}, out = []; [].forEach.call(GM.body.querySelectorAll('.gm-row'), function (r) { var it = r._gmIt; if (it && !seen[it.id]) { seen[it.id] = 1; out.push(it); } }); return out; }
  function gmSelPaint() {
    if (!GM.sel || !GM.el) return;
    GM.el.classList.add('gm-selmode');
    [].forEach.call(GM.el.querySelectorAll('.gm-row'), function (r) { r.classList.toggle('sel', !!(r._gmIt && GM.sel.ids[r._gmIt.id])); });
    var n = Object.keys(GM.sel.ids).length, all = gmSelAllRows(), allOn = all.length && all.every(function (x) { return GM.sel.ids[x.id]; });
    var bar = GM.top.querySelector('.gm-selbar');
    if (!bar) {
      var x = G.el('button', { type: 'button', 'class': 'gm-sx', 'aria-label': '고르기 끝내기' }, [G.el('i')]);
      x.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); gmSelEnd(); }, true);
      var allB = G.el('button', { type: 'button', 'class': 'gm-sall' });
      allB.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation(); if (!GM.sel) return;
        var rows = gmSelAllRows(), on = rows.length && rows.every(function (y) { return GM.sel.ids[y.id]; });
        if (on) { gmSelEnd(); return; }
        rows.forEach(function (y) { GM.sel.ids[y.id] = y; }); G.send('haptic', { kind: 'gesture' }); gmSelPaint();
      }, true);
      var act = function (cls, icon, text, fn) {
        var b = G.el('button', { type: 'button', 'class': 'gm-sa ' + cls }, [G.el('i', { style: '-webkit-mask-image:url("' + gmIcon(icon) + '")' }), text]);
        b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); var items = gmSelItems(); if (!items.length) return; G.send('haptic', { kind: 'gesture' }); fn(items); }, true);
        return b;
      };
      var q = function (x) { return { id: x.id, title: x.title, ch: x.artist }; };
      var acts = G.el('div', { 'class': 'gm-sacts' }, [
        act('p', 'add', '플레이리스트에 담기', function (items) { plPick(items, gmSelEnd); }),
        act('', 'play', '재생', function (items) { gmSelEnd(); gmPlay(items, 0, false); }),
        act('', 'list', '다음에 재생', function (items) { if (!npActive()) { gmSelEnd(); gmPlay(items, 0, false); return; } items.slice().reverse().forEach(function (x) { gmQSend('queueAdd', Object.assign({ front: true }, q(x))); }); gmSelEnd(); gmToast(items.length + '곡을 다음에 재생해요'); }),
        act('', 'add', '맨 뒤에 추가', function (items) { if (!npActive()) { gmSelEnd(); gmPlay(items, 0, false); return; } items.forEach(function (x) { gmQSend('queueAdd', q(x)); }); gmSelEnd(); gmToast(items.length + '곡을 재생 대기열 맨 뒤에 추가했어요'); }),
        GM.view === 'pl' && GM.plId ? act('red', 'close', '빼기', function (items) {
          var p = plGet(GM.plId); if (!p) return; var del = {}; items.forEach(function (x) { del[x.id] = 1; });
          p.items = p.items.filter(function (x) { return !del[x.id]; }); plPut(p); gmSelEnd(); var keep = GM.el.scrollTop; gmRender(); GM.el.scrollTop = keep; gmToast(items.length + '곡을 뺐어요');
        }) : null
      ]);
      bar = G.el('div', { 'class': 'gm-selbar' }, [G.el('div', { 'class': 'gm-sh1' }, [x, G.el('b', { 'class': 'gm-sn' }), allB]), acts]);
      GM.top.appendChild(bar);
    }
    bar.querySelector('.gm-sn').textContent = n + '곡 선택';
    bar.querySelector('.gm-sall').textContent = allOn ? '선택 해제' : '전체 선택';
  }
  // ---- 음악 탭 아래 막대 (멜론·스포티파이처럼): 지금 듣는 곡(앱이 nowPlaying 으로 알림) 또는 마지막으로 들은 곡 · 이전/재생/다음 ----
  //  음악을 듣는 중이면 이 막대가 그 곡을 조작하고, 앱은 떠 있는 작은 플레이어를 숨김(geom np). 누르면 재생 화면 펼침.
  //  아무것도 안 듣는 중이면 마지막 곡을 보여 주고 ▶ = 그 곡부터 다시 듣기 (이전·다음 = 그 목록의 앞뒤 곡)
  var NP = { d: null, el: null, shown: false, timer: 0 };
  function npLast() {
    var s = gmLsGet(GM_KEY), items = s && s.items || [];
    if (items.length) {
      var id = s.played && s.played.length ? s.played[s.played.length - 1] : items[0].id;
      var i = items.map(function (x) { return x.id; }).indexOf(id);
      return { list: items, i: i < 0 ? 0 : i };
    }
    var r = gmLsGet(GM_RECENT) || [];
    return r.length ? { list: r, i: 0 } : null;
  }
  function npActive() { return !!(NP.d && NP.d.active && NP.d.vid); }
  function npBuild() {
    if (NP.el) return;
    var btn = function (icon, label, fn) {
      var b = G.el('button', { type: 'button', 'aria-label': label }, [G.el('i', { style: '-webkit-mask-image:url("' + gmIcon(icon) + '")' })]);
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); fn(); }, true);
      return b;
    };
    var go = function (dir) {
      if (npActive()) { G.send('musicCtl', { cmd: dir }); return; }
      var l = npLast(); if (!l) return;
      var j = dir === 'next' ? l.i + 1 : dir === 'prev' ? l.i - 1 : l.i;
      if (j < 0 || j >= l.list.length) j = l.i;
      gmPlay(l.list, j, false);
    };
    NP.img = G.el('img', { alt: '' });
    NP.t = G.el('b'); NP.a = G.el('span');
    NP.k = G.el('div', { 'class': 'np-k' }, [NP.img, G.el('div', { 'class': 'np-tx' }, [NP.t, NP.a])]);
    NP.v = G.el('div', { 'class': 'np-v' }, [NP.k]);
    NP.play = btn('play', '재생', function () { if (npActive()) G.send('musicCtl', { cmd: 'toggle' }); else go('here'); });
    NP.bar = G.el('i', { 'class': 'np-pg' });
    NP.el = G.el('div', { id: 'glide-np', role: 'button', 'data-glide': 'music', hidden: '' }, [
      NP.v,
      btn('prev', '이전 곡', function () { go('prev'); }), NP.play, btn('next', '다음 곡', function () { go('next'); }),
      G.el('div', { 'class': 'np-tr' }, [NP.bar])
    ]);
    npSwipe(go);
    NP.el.addEventListener('click', function (e) { if (NP.swiped) { e.preventDefault(); e.stopPropagation(); return; } if (e.target.closest && e.target.closest('button')) return; e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); if (npActive()) G.send('musicCtl', { cmd: 'expand' }); else go('here'); }, true);
    document.body.appendChild(NP.el);
  }
  // 옆 곡 (밀 때 미리 보이는 칸): 음악 세션의 다음·이전 곡 (모르면 빈 칸)
  function npNeighbor(next) {
    var s = gmLsGet(GM_KEY), items = s && s.items || [];
    var cur = npActive() ? NP.d.vid : (npLast() || { list: [{}], i: 0 }).list[(npLast() || { i: 0 }).i].id;
    if (next) { var i = items.map(function (x) { return x.id; }).indexOf(cur); return i >= 0 && items[i + 1] ? items[i + 1] : (gmLsGet('glide:gmRepeat') !== 'off' && items[0] && items[0].id !== cur ? items[0] : null); }
    var pl = (s && s.played || []).slice(); if (pl.length && pl[pl.length - 1] === cur) pl.pop();
    var pid = pl.pop(); return pid ? items.filter(function (x) { return x.id === pid; })[0] || { id: pid, title: '', artist: '' } : null;
  }
  function npCard(it) {
    return G.el('div', { 'class': 'np-k np-ghost' }, [G.el('img', { alt: '', src: it && it.id ? 'https://i.ytimg.com/vi/' + it.id + '/mqdefault.jpg' : '' }),
      G.el('div', { 'class': 'np-tx' }, [koT(G.el('b'), (it && it.title) || '', it && it.artist), G.el('span', { text: String((it && it.artist) || '').replace(/\s*-\s*Topic$/i, '') })])]);
  }
  function npSwipe(go) {
    var el = NP.el, x0 = 0, y0 = 0, t0 = 0, axis = '', dx = 0, dy = 0, ghost = null, gdir = 0, vx = 0, lastX = 0, lastT = 0;
    var EASE = 'cubic-bezier(.2,.9,.25,1)';
    var setK = function (x, ms) { NP.k.style.transition = ms ? 'transform ' + ms + 'ms ' + EASE + ',opacity ' + ms + 'ms' : 'none'; NP.k.style.transform = x ? 'translate3d(' + x + 'px,0,0)' : ''; };
    var setG = function (x, ms) { if (!ghost) return; ghost.style.transition = ms ? 'transform ' + ms + 'ms ' + EASE : 'none'; ghost.style.transform = 'translate3d(' + x + 'px,0,0)'; };
    var dropGhost = function () { if (ghost) { ghost.remove(); ghost = null; gdir = 0; } };
    var setBar = function (tf, op, ms) { el.style.transition = ms ? 'transform ' + ms + 'ms ' + EASE + ',opacity ' + ms + 'ms' : 'none'; el.style.transform = tf || ''; el.style.opacity = op === undefined ? '' : String(op); };
    var W0 = function () { return NP.v.getBoundingClientRect().width || 240; };
    var anim = function () {};
    var reset = function () { setBar('', undefined, 0); setK(0, 0); dropGhost(); };
    var anim = function (tf, op, ms, then) { el.style.transition = 'transform ' + ms + 'ms cubic-bezier(.2,0,0,1),opacity ' + ms + 'ms'; el.style.transform = tf; el.style.opacity = op; if (then) G.setTimeout.call(W, then, ms); };
    var reset = function () { el.style.transition = 'none'; el.style.transform = ''; el.style.opacity = ''; };
    el.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); axis = ''; dx = dy = 0; NP.swiped = false;
      GM.dragging = true; lastPull = null; reportPull(); // 아래로 밀 때 앱의 당겨서 새로고침이 끼어들지 않게
      lastX = t.clientX; lastT = t0; vx = 0;
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      var t = e.touches[0]; dx = t.clientX - x0; dy = t.clientY - y0;
      if (!axis) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; NP.swiped = true; }
      if (e.cancelable) e.preventDefault();
      var now = Date.now(); if (now > lastT) { vx = 0.7 * vx + 0.3 * ((t.clientX - lastX) / (now - lastT)); lastX = t.clientX; lastT = now; }
      if (axis === 'x') {
        var w = W0(), dir = dx < 0 ? 1 : -1; // 1: 다음 곡이 오른쪽에서
        if (dir !== gdir) { dropGhost(); var nb = npNeighbor(dir === 1); if (!nb && dir === -1) nb = { id: NP.cur || '', title: NP.t.textContent, artist: NP.a.textContent }; /* 앞 곡이 없으면 이전 = 이 곡 처음부터 (재생 화면 ⏮와 같음) */ ghost = npCard(nb); NP.v.appendChild(ghost); gdir = dir; ghost.dataset.has = nb ? '1' : ''; }
        var x = ghost.dataset.has ? dx : dx * 0.35; // 옆 곡이 없으면 고무줄처럼 덜 따라옴
        setK(x, 0); setG(x + dir * (w + 16), 0);
      } else if (dy > 0) setBar('translate3d(0,' + dy + 'px,0)', Math.max(0.25, 1 - dy / 220), 0);
      else setBar('translate3d(0,' + (-Math.pow(-dy, 0.7)) + 'px,0)', undefined, 0); // 위로는 저항
    }, { passive: false });
    var end = function () {
      GM.dragging = false; lastPull = null; reportPull();
      if (!axis) return;
      var v = Math.max(Math.abs(dx), Math.abs(dy)) / Math.max(1, Date.now() - t0);
      var w = W0();
      var fling = Math.abs(vx) > 0.45 && Math.sign(vx) === Math.sign(dx);
      if (axis === 'x' && ghost && ghost.dataset.has && (Math.abs(dx) > w * 0.35 || (Math.abs(dx) > 24 && fling))) {
        var next = dx < 0, rest = w - Math.abs(dx);
        // 남은 거리를 손가락 속도에 맞춰 (빠르게 튕기면 짧게) — 상용 앱처럼 감속하며 자리 잡음
        var ms = Math.round(Math.max(170, Math.min(320, rest / Math.max(0.9, Math.abs(vx)))));
        G.send('haptic', { kind: 'gesture' });
        setK(next ? -(w + 16) : w + 16, ms); setG(0, ms);
        var g = ghost; ghost = null; gdir = 0;
        G.setTimeout.call(W, function () {
          // 새 곡 칸이 제자리 → 원래 칸에 새 곡 내용을 넣고 바꿔치기 (깜빡임 없게)
          NP.img.setAttribute('src', g.querySelector('img').getAttribute('src') || ''); NP.t.textContent = g.querySelector('b').textContent; NP.a.textContent = g.querySelector('span').textContent;
          setK(0, 0); g.remove();
        }, ms);
        go(next ? 'next' : 'prev');
        if (npActive()) { var was = NP.d.vid; G.setTimeout.call(W, function () { if (npActive() && NP.d.vid === was) { NP.img.removeAttribute('src'); npDraw(); } }, 1500); } // 안 넘어갔으면 원래 곡으로
        log('info', '음악 막대: ' + (next ? '왼쪽 밀기 → 다음 곡' : '오른쪽 밀기 → 이전 곡'));
      } else if (axis === 'x') {
        // 덜 밀었음: 감속하며 제자리로
        setK(0, 240); setG(gdir * (w + 16), 240); G.setTimeout.call(W, dropGhost, 250);
      } else if (axis === 'y' && dy < -40) {
        G.send('haptic', { kind: 'gesture' });
        setBar('', undefined, 220);
        if (npActive()) G.send('musicCtl', { cmd: 'expand' }); else go('here');
        log('info', '음악 막대: 위로 밀기 → 재생 화면');
      } else if (axis === 'y' && (dy > 60 || (dy > 30 && v > 0.5))) {
        G.send('haptic', { kind: 'gesture' });
        setBar('translate3d(0,' + (el.getBoundingClientRect().height + 24) + 'px,0)', 0, 200);
        G.setTimeout.call(W, function () {
          NP.dismissed = true; NP.gone = npActive() ? NP.d.vid : '';
          if (npActive()) G.send('musicCtl', { cmd: 'close' });
          reset(); npDraw();
        }, 200);
        log('info', '음악 막대: 아래로 밀기 → 막대 치우고 끔');
      } else setBar('', undefined, 260); // 제자리로
      G.setTimeout.call(W, function () { NP.swiped = false; }, 350);
    };
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
  }
  function npDraw() {
    if (!GM.el) return;
    var it = null, playing = false;
    if (npActive()) { it = { id: NP.d.vid, title: NP.d.title, artist: NP.d.artist }; playing = !!NP.d.playing; }
    else { var l = npLast(); if (l) it = l.list[l.i]; }
    var show = !!(GM.open && it && it.id && !(NP.d && NP.d.expanded) && !NP.dismissed);
    if (show) {
      npBuild();
      var src = 'https://i.ytimg.com/vi/' + it.id + '/mqdefault.jpg';
      NP.cur = it.id;
      if (NP.img.getAttribute('src') !== src) {
        // 버튼·이어폰으로 곡이 바뀜: 곡 칸만 살짝 밀리며 바뀜 (밀기로 이미 바꿔 둔 경우는 그대로)
        if (NP.img.getAttribute('src') && !NP.el.hidden) { NP.k.classList.remove('np-swap'); void NP.k.offsetWidth; NP.k.classList.add('np-swap'); }
        NP.img.setAttribute('src', src);
      }
      koT(NP.t, it.title || '', it.artist); NP.a.textContent = String(it.artist || '').replace(/\s*-\s*Topic$/i, '');
      NP.play.firstChild.style.webkitMaskImage = 'url("' + gmIcon(playing ? 'pause' : 'play') + '")';
      NP.play.setAttribute('aria-label', playing ? '일시정지' : '재생');
      NP.el.classList.toggle('live', npActive());
      NP.el.style.bottom = (gmBars()[1] + 8) + 'px';
      npProgress();
    }
    if (NP.el) {
      if (show && NP.el.hidden) { NP.el.classList.remove('np-in'); void NP.el.offsetWidth; NP.el.classList.add('np-in'); }
      NP.el.hidden = !show;
    }
    if (show !== NP.shown) { NP.shown = show; GM.el.classList.toggle('np-on', show); }
    // 앱에 '막대가 지금 곡을 맡음'(작은 플레이어 숨김)을 알림: 보임이 바뀔 때뿐 아니라 듣기 시작·끝날 때도
    var npOn = show && npActive(); if (npOn !== NP.on) { NP.on = npOn; lastGeom = ''; reportGeom(); }
    clearInterval(NP.timer); NP.timer = 0;
    if (show && playing) NP.timer = setInterval(npProgress, 500);
  }
  function npProgress() {
    if (!NP.bar) return;
    var d = NP.d, p = 0;
    if (npActive() && d.dur > 0) { var pos = d.pos + (d.playing ? (Date.now() - d.at) / 1000 * (d.rate || 1) : 0); p = Math.max(0, Math.min(1, pos / d.dur)); }
    NP.bar.style.width = (p * 100).toFixed(2) + '%';
  }
  G.onCommand('nowPlaying', function (d) { if (role() !== 'browse') return; NP.d = d || null; if (NP.d) NP.d.at = Date.now(); try { gmNowMark(); } catch (e) { /* ignore */ }
    // 아래로 밀어 치운 막대: 그 곡이 꺼진 뒤(active false) 다시 듣기 시작하면 다시 나타남
    if (!NP.d || !NP.d.active) NP.gone = ''; else if (NP.dismissed && NP.d.vid !== NP.gone) NP.dismissed = false;
    npDraw(); });
  function gmToast(text) {
    var t = document.getElementById('glide-gm-toast');
    if (!t) { t = G.el('div', { id: 'glide-gm-toast', 'data-glide': 'music', style: 'position:fixed;left:16px;right:16px;bottom:90px;z-index:2147483647;padding:12px 16px;border-radius:10px;background:#323232;color:#fff;font:400 14px/1.35 Roboto,sans-serif;pointer-events:none;transition:opacity .2s' }); document.body.appendChild(t); }
    t.textContent = text; t.style.opacity = '1';
    clearTimeout(GM.toastT); GM.toastT = setTimeout(function () { t.style.opacity = '0'; }, 1800);
  }
  function gmList(list, ranked, delta) {
    var box = G.el('div', {});
    list.forEach(function (x, i) { box.appendChild(gmRow(list, i, ranked ? i + 1 : 0, delta)); });
    if (GM.sel) G.setTimeout.call(W, gmSelPaint, 0);
    return box;
  }
  function gmActs(list, inPl) {
    return G.el('div', { 'class': 'gm-acts' }, [
      gmBtn('p', '전체 듣기', 'play', function () { gmPlay(list, 0, false); }),
      gmBtn('s ic', '셔플', 'shuffle', function () { gmPlay(list, 0, 'all'); }),
      inPl ? null : gmBtn('s ic', '담기', 'plus', function () { plPick(list); })
    ]);
  }
  // 받은 목록은 30분 동안 다시 쓰기 (탭을 오갈 때마다 다시 받지 않게)
  function gmGet(key, fn) {
    var c = GM.cache[key];
    if (c && Date.now() - c.t < 30 * 60e3) return Promise.resolve(c.v);
    if (c && c.p) return c.p;
    var p = fn().then(function (v) { if (v === null) delete GM.cache[key]; else GM.cache[key] = { v: v, t: Date.now() }; return v; }, function (e) { delete GM.cache[key]; throw e; });
    GM.cache[key] = { p: p, t: 0 };
    return p;
  }
  function gmRender() {
    if (!GM.el) return;
    if (GM.sel && GM.sel.view !== gmSelKey()) gmSelEnd();
    var tabs = GM.top.querySelector('.gm-tabs');
    recClear(tabs);
    GM_VIEWS.forEach(function (v) {
      var b = G.el('button', { type: 'button', 'aria-pressed': String(GM.view === v[0] || (GM.view === 'search' && false)), text: v[1] });
      b.addEventListener('click', function (e) { e.preventDefault(); GM.stack = []; GM.view = v[0]; GM.genre = ''; gmSrch(false); gmRender(); GM.el.scrollTop = 0; }, true);
      tabs.appendChild(b);
    });
    recClear(GM.body);
    var body = GM.body, view = GM.view, token = (GM.token = (GM.token || 0) + 1);
    GM.moreFn = null;
    var load = G.el('div', { 'class': 'gm-load', text: '불러오는 중…' });
    var fail = function (e) { if (token !== GM.token) return; recClear(body); body.appendChild(G.el('div', { 'class': 'gm-note', text: '목록을 받지 못했어요. 당겨서 다시 시도해 주세요' })); log('warn', '음악 탭: ' + (e && e.message)); };
    if (view === 'chart') {
      var seg = G.el('div', { 'class': 'gm-seg' });
      GM_CHARTS.forEach(function (c) {
        var b = G.el('button', { type: 'button', 'aria-pressed': String(GM.chart === c.id), text: c.name });
        b.addEventListener('click', function (e) { e.preventDefault(); GM.chart = c.id; var yr = GM_YEARS[c.id === 'global' ? 'global' : 'kr']; if (GM.year) GM.year = Math.max(yr.from, Math.min(yr.to, GM.year)); gmRender(); }, true);
        seg.appendChild(b);
      });
      // 시대별: 오른쪽 '최신 ▾' / '2015년 ▾' → 연도 고르기 (멜론 시대별 차트처럼)
      var yb = G.el('button', { type: 'button', 'class': 'gm-yrb' + (GM.year ? ' on' : '') }, [GM.year ? GM.year + '년' : '시대별', G.el('i')]);
      yb.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); gmYearSheet(); }, true);
      seg.appendChild(yb);
      body.appendChild(seg);
      var ch = GM_CHARTS.filter(function (c) { return c.id === GM.chart; })[0] || GM_CHARTS[0];
      body.appendChild(load);
      if (GM.year) {
        var yr0 = GM.year, kind0 = ch.id === 'global' ? 'global' : 'kr';
        gmGet('yr:' + kind0 + ':' + yr0, function () { return gmYearPick(kind0, yr0).then(function (p) { return p ? gmPlaylist(p.id, 100).then(function (l) { return { p: p, list: gmDedupe(l) }; }) : { p: null, list: [] }; }); }).then(function (r) {
          if (token !== GM.token) return;
          load.remove();
          body.appendChild(G.el('div', { 'class': 'gm-head' }, [G.el('div', {}, [G.el('h2', { text: yr0 + '년 ' + (kind0 === 'kr' ? '국내' : '해외') + ' TOP' + (r.list.length >= 90 ? '100' : r.list.length) }),
            G.el('p', { text: r.p ? '연간 차트 · 유튜브 재생목록 ‘' + r.p.t + '’' : '' })])]));
          if (!r.list.length) { body.appendChild(G.el('div', { 'class': 'gm-note', text: '이 해의 차트를 찾지 못했어요. 다른 해를 골라 보세요' })); return; }
          body.appendChild(gmActs(r.list));
          body.appendChild(gmList(r.list, true));
        }, fail);
        return;
      }
      gmGet('chart:' + ch.id, function () { return gmChartList(ch); }).then(function (list) {
        if (token !== GM.token) return;
        load.remove();
        var delta = gmChartDelta(ch.id, list);
        body.appendChild(G.el('div', { 'class': 'gm-cap', text: (ch.cap || '') + (delta ? ' · 지난 차트와 비교' : '') }));
        body.appendChild(gmActs(list));
        body.appendChild(gmList(list, true, delta));
      }, fail);
    } else if (view === 'new') {
      // 멜론 '최신음악 전체·국내·해외'처럼 나눠 봄
      var nseg = G.el('div', { 'class': 'gm-seg' }), nk = GM.newKind || 'all';
      [['all', '전체'], ['kr', '국내'], ['global', '해외']].forEach(function (k) {
        var b = G.el('button', { type: 'button', 'aria-pressed': String(nk === k[0]), text: k[1] });
        b.addEventListener('click', function (e) { e.preventDefault(); GM.newKind = k[0]; gmRender(); }, true);
        nseg.appendChild(b);
      });
      body.appendChild(nseg);
      body.appendChild(load);
      gmGet('new:' + nk, function () {
        var qs = nk === 'kr' ? [gmSearch('신곡 MV', 'EgQIAxAB'), gmSearch('신곡 발매 뮤직비디오', 'EgQIAxAB')] : nk === 'global' ? [gmSearch('new song official audio', 'EgQIAxAB'), gmSearch('official music video new', 'EgQIAxAB')] : [gmSearch('신곡 MV', 'EgQIAxAB'), gmSearch('new song official audio', 'EgQIAxAB')];
        return Promise.all(qs).then(function (r) { var seen = {}; var hang = /[ㄱ-힝]/; return gmDedupe(r[0].concat(r[1]).filter(function (x) { if (seen[x.id]) return false; seen[x.id] = 1; if (nk === 'global' && hang.test(x.title + x.artist)) return false; return true; })).slice(0, 60); });
      }).then(function (list) {
        if (token !== GM.token) return;
        load.remove();
        list = gmPure(list);
        body.appendChild(G.el('div', { 'class': 'gm-head' }, [G.el('div', {}, [G.el('h2', { text: nk === 'kr' ? '국내 최신 음악' : nk === 'global' ? '해외 최신 음악' : '최신 음악' }), G.el('p', { text: '이번 주에 나온 노래' })])]));
        body.appendChild(gmActs(list));
        body.appendChild(gmList(list, false));
      }, fail);
    } else if (view === 'genre') {
      if (!GM.genre) {
        var tiles = function (arr, mood) {
          var grid = G.el('div', { 'class': 'gm-grid' });
          arr.forEach(function (g) {
            var b = G.el('button', { type: 'button', style: '--gc:' + g[1] }, [G.el('b', { text: g[0] })]);
            b.setAttribute('data-q', mood ? g[2] : g[0] + ' 노래');
            if (!gmTileArtFile(b, g[0])) gmTileArt(b, mood ? g[2] : g[0] + ' 노래');
            b.addEventListener('click', function (e) { e.preventDefault(); gmPush(); GM.genre = g[0]; GM.genreQ = mood ? g[2] : ''; gmRender(); GM.el.scrollTop = 0; }, true);
            grid.appendChild(b);
          });
          return grid;
        };
        body.appendChild(G.el('div', { 'class': 'gm-sub', text: '무드·상황' }));
        body.appendChild(tiles(gmMoods(), true));
        body.appendChild(G.el('div', { 'class': 'gm-sub', text: '장르' }));
        body.appendChild(tiles(GM_GENRES, false));
      } else {
        var g0 = GM.genre, q0 = GM.genreQ || (g0 + ' 노래');
        body.appendChild(gmBtn('', '‹ ' + (GM.genreQ ? '무드·상황' : '장르'), null, function () { GM.genre = ''; gmRender(); }));
        body.lastChild.setAttribute('style', 'all:unset;display:block;padding:12px 16px 0;font:600 14px/1 sans-serif;cursor:pointer');
        body.appendChild(load);
        gmGet('genre:' + q0, function () { return gmSearchSongs(q0).then(gmDedupe); }).then(function (list) {
          if (token !== GM.token) return;
          load.remove();
          list = gmPure(list);
          body.appendChild(G.el('div', { 'class': 'gm-head' }, [G.el('div', {}, [G.el('h2', { text: g0 }), G.el('p', { text: GM.genreQ ? g0 + '에 어울리는 노래' : '많이 듣는 ' + g0 + ' 노래' })])]));
          body.appendChild(gmActs(list));
          body.appendChild(gmList(list, false));
        }, fail);
      }
    } else if (view === 'mine') {
      plShelf(body);
      gmMine(body, token);
      // 좋아요한 곡 칸 표지·곡 수: 받아 둔 게 없으면 뒤에서 받고 칸만 다시 그림
      if (!(GM.cache.liked && GM.cache.liked.v)) gmGet('liked', gmLiked).then(function (list) { if (token !== GM.token || !list || !list.length) return; var c = body.querySelector('[data-vpl=liked]'); if (!c) return; var cv = plCover({ items: list }, 0); c.replaceChild(cv, c.firstChild); c.querySelector('span').textContent = list.length + '곡'; }, function () { /* 로그인 안 함 등: 하트 그대로 */ });
    } else if (view === 'vpl') {
      gmVplView(body, token, load, fail);
    } else if (view === 'pl') {
      plView(body);
    } else if (view === 'artist') {
      var an = GM.artist, at = GM.aTab || 'top';
      var back = G.el('button', { type: 'button', 'class': 'gm-back' }, [G.el('i'), '뒤로']);
      back.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); gmArtistBack(); }, true);
      body.appendChild(back);
      var avatar = G.el('img', { alt: '' });
      body.appendChild(G.el('div', { 'class': 'gm-ahead' }, [avatar, G.el('div', {}, [G.el('h2', { text: an }), G.el('p', { text: '가수' })])]));
      var aseg = G.el('div', { 'class': 'gm-seg' });
      [['top', '인기곡'], ['new', '최신곡']].forEach(function (t) {
        var b = G.el('button', { type: 'button', 'aria-pressed': String(at === t[0]), text: t[1] });
        b.addEventListener('click', function (e) { e.preventDefault(); GM.aTab = t[0]; gmRender(); }, true);
        aseg.appendChild(b);
      });
      body.appendChild(aseg);
      body.appendChild(load);
      var getA = at === 'new' ? function () { return gmSearch(an, 'CAISAhAB').then(function (l) { return gmDedupe(gmByArtist(l, an)).slice(0, 40); }); }
        : function () { return gmSearchSongs(an).then(function (l) { return gmDedupe(gmByArtist(l, an)).slice(0, 50); }); };
      gmGet('a' + at + ':' + an, getA).then(function (list) {
        if (token !== GM.token) return;
        load.remove();
        list = gmPure(list);
        if (list[0]) avatar.src = 'https://i.ytimg.com/vi/' + list[0].id + '/mqdefault.jpg';
        if (!list.length) { body.appendChild(G.el('div', { 'class': 'gm-note', text: '찾은 노래가 없어요' })); return; }
        body.appendChild(gmActs(list));
        body.appendChild(gmList(list, at === 'top'));
      }, fail);
    } else if (view === 'search') {
      var q = GM.q;
      body.appendChild(load);
      gmGet('q:' + q, function () { return gmSearchSongs(q, 3).then(gmDedupe); }).then(function (list) {
        if (token !== GM.token) return;
        load.remove();
        var al = gmAliasLearn({}, list), rel = gmRelevance(gmPure(list), q, al, true), strictMore = true;
        if (!rel.length) { rel = gmRank(gmPure(list), q); strictMore = false; } // 맞는 곡이 없으면 예전 방식
        list = gmSortList(rel, GM.ssort);
        var cnt = G.el('p', { text: '검색 결과 ' + list.length + '곡' });
        body.appendChild(G.el('div', { 'class': 'gm-head' }, [G.el('div', {}, [G.el('h2', { text: '‘' + q + '’' }), cnt])]));
        if (!list.length) { body.appendChild(G.el('div', { 'class': 'gm-note', text: '찾은 노래가 없어요' })); return; }
        var seg = G.el('div', { 'class': 'gm-seg gm-sort' });
        GM_SORTS.forEach(function (o) {
          var b = G.el('button', { type: 'button', 'aria-pressed': String((GM.ssort || 'rel') === o[0]), text: o[1] });
          b.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            if ((GM.ssort || 'rel') === o[0]) return;
            G.send('haptic', { kind: 'gesture' });
            GM.ssort = o[0];
            [].forEach.call(seg.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); });
            var sorted = gmSortList(rel, GM.ssort);
            list.splice.apply(list, [0, list.length].concat(sorted)); // 전체 듣기·곡 줄이 같은 배열을 봄
            var nb = gmList(list, false); nb.classList.add('gm-resort'); box.replaceWith(nb); box = nb;
          }, true);
          seg.appendChild(b);
        });
        body.appendChild(seg);
        body.appendChild(gmActs(list));
        var box = gmList(list, false), tail = G.el('div', { 'class': 'gm-load', text: '' });
        body.appendChild(box); body.appendChild(tail);
        // 끝까지 내리면 다음 묶음 (같은 곡·이미 있는 곡은 빼고 아래에 붙임)
        var busy = false, done = false;
        GM.moreFn = function () {
          if (busy || done || token !== GM.token) return;
          busy = true; tail.textContent = '더 불러오는 중…';
          gmSearchMore(q).then(function (more) {
            busy = false;
            if (token !== GM.token) return;
            var have = {}; list.forEach(function (x) { have[gmKey(x)] = 1; have[x.id] = 1; });
            gmAliasLearn(al, more);
            var add = gmRelevance(gmPure(gmDedupe(more)).filter(function (x) { return !have[x.id] && !have[gmKey(x)]; }), q, al, strictMore);
            rel = rel.concat(add);
            if ((GM.ssort || 'rel') === 'rel') add.forEach(function (x) { list.push(x); box.appendChild(gmRow(list, list.length - 1, 0)); });
            else if (add.length) { var sorted2 = gmSortList(rel, GM.ssort); list.splice.apply(list, [0, list.length].concat(sorted2)); var nb2 = gmList(list, false); box.replaceWith(nb2); box = nb2; }
            if (GM.sel) gmSelPaint();
            cnt.textContent = '검색 결과 ' + list.length + '곡';
            var c = (GM.sconts || {})[q];
            if (!c || (!c[0] && !c[1])) { done = true; tail.textContent = ''; } else tail.textContent = add.length ? '' : '';
            if (!add.length && !done) G.setTimeout.call(W, function () { GM.moreFn && GM.moreFn(); }, 300); // 이번 묶음이 다 걸러졌으면 한 번 더
          }, function () { busy = false; tail.textContent = ''; });
        };
      }, fail);
    }
  }
  function gmTick() {
    try {
      gmEnsureTab();
      if (!GM.open) return;
      if (location.pathname + location.search !== GM.path) { gmClose(); return; }
      gmPlace();
    } catch (e) { /* ignore */ }
  }
  (function gmLoop() { gmTick(); G.setTimeout.call(W, gmLoop, GM.open ? 700 : 1500); })();
  // 아래 메뉴의 다른 탭·상단 바 버튼을 누르면 닫음
  W.addEventListener('click', function (e) {
    if (GM.open && e.target && e.target.closest && e.target.closest('ytm-pivot-bar-item-renderer, .mobile-topbar-header-endpoint, header button.topbar-button-search-button, #glide-rec-tab')) { gmMenuClose(); gmClose(); }
  }, true);

  // ===========================================================================
  // 음악 재생 화면 (영상 웹뷰): 음악으로 연 곡이면 영상 대신 앨범 이미지·조작 버튼. 영상은 144p(코어 data-glide-music)
  // ===========================================================================
  var MP = { el: null, on: false, vid: '', showVideo: false, drag: false };
  function mpSession() { var s = gmLsGet(GM_KEY); return s && s.items && Date.now() - (s.at || 0) < 24 * 3600e3 ? s : null; }
  function mpVid() { try { return new URLSearchParams(location.search).get('v') || ''; } catch (e) { return ''; } }
  function mpIsMusic() {
    if (role() !== 'player' || !onWatch() || !S().enabled) return false;
    if (G.musicNow) return !!G.musicNow();
    if (/[?&]glide_music=1/.test(location.search)) return true;
    var s = mpSession(), v = mpVid();
    return !!(s && v && s.items.some(function (x) { return x.id === v; }));
  }
  // 문서 시작 때 바로 표시: 첫 재생 전에 코어가 144p로 정하게
  (function mpBoot() {
    try { var mvq = /[?&]glide_mv=1/.test(location.search) && new URLSearchParams(location.search).get('v'); if (mvq && document.documentElement) document.documentElement.setAttribute('data-glide-mv', mvq); } catch (e) { /* ignore */ }
    // 설정(역할)이 아직 없을 수 있어 주소 표시(glide_music=1)만으로도 붙임 (둘러보기 웹뷰는 영상 화면을 열지 않음)
    try { if ((mpIsMusic() || (location.pathname === '/watch' && /[?&]glide_music=1/.test(location.search))) && document.documentElement) document.documentElement.setAttribute('data-glide-music', ''); } catch (e) { /* ignore */ }
  })();
  function mpInfo(v) {
    var s = mpSession(), it = s && s.items.filter(function (x) { return x.id === v; })[0];
    if (!it) {
      var p = mainPlayer(), d = null;
      try { d = p && p.getVideoData && p.getVideoData(); } catch (e) { /* ignore */ }
      var c = gmClean((d && d.title) || document.title.replace(/ - YouTube$/, ''), d && d.author);
      it = { id: v, title: c.title, artist: c.artist };
    }
    var k = koGet(it.title, it.artist);
    if (k) return Object.assign({}, it, { title: k, en: it.title });
    // 지금 곡은 바로 찾음 (찾으면 재생 화면·알림·잠금화면이 한글로)
    if (koNeed(it.title) && role() === 'player') koFind(it.title, it.artist, function (k) { try { if (MP.title && mpVid() === v) MP.title.textContent = k; mpMediaPoke(); } catch (e) { /* ignore */ } }, true);
    return it;
  }
  function mpCss() {
    if (document.getElementById('glide-mp-style')) return;
    var F = 'Pretendard,Roboto,"Noto Sans KR",sans-serif';
    var st = G.el('style', { id: 'glide-mp-style', 'data-glide': 'music' });
    st.textContent =
      '#glide-mp{position:fixed;inset:0;z-index:2147483600;background:#0b0b10;color:#fff;font-family:' + F + ';display:flex;flex-direction:column;overflow:hidden}' +
      '#glide-mp[hidden]{display:none}' +
      '#glide-mp .bg{position:absolute;inset:-40px;background:center/cover no-repeat;filter:blur(40px) brightness(.45) saturate(1.3);transform:scale(1.1)}' +
      '#glide-mp .art{position:relative;flex:none;display:flex;align-items:center;justify-content:center}' +
      '#glide-mp .art img{height:84%;aspect-ratio:1/1;object-fit:cover;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.5)}' +
      '#glide-mp .tb{position:absolute;top:8px;left:8px;right:8px;display:flex;justify-content:space-between;z-index:2}' +
      '#glide-mp .ib{all:unset;width:40px;height:40px;border-radius:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:rgba(0,0,0,.25)}' +
      '#glide-mp .ib i,#glide-mp .ctl i{background-color:#fff;-webkit-mask:center/24px 24px no-repeat}' +
      '#glide-mp .ib i{width:22px;height:22px;-webkit-mask-size:22px 22px}' +
      '#glide-mp .info{position:relative;padding:22px 26px 6px}' +
      '#glide-mp .info b{display:block;font:800 22px/1.3 ' + F + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#glide-mp .info span{display:block;margin-top:6px;font:500 15px/1.3 ' + F + ';color:rgba(255,255,255,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#glide-mp .bar{position:relative;margin:18px 26px 0;height:24px;display:flex;align-items:center;touch-action:none}' +
      '#glide-mp .bar .tr{position:absolute;left:0;right:0;height:4px;border-radius:2px;background:rgba(255,255,255,.25)}' +
      '#glide-mp .bar .fi{position:absolute;left:0;height:4px;border-radius:2px;background:#fff}' +
      '#glide-mp .bar .kn{position:absolute;width:14px;height:14px;margin-left:-7px;border-radius:7px;background:#fff}' +
      '#glide-mp .tm{position:relative;display:flex;justify-content:space-between;margin:4px 26px 0;font:500 12px/1 ' + F + ';color:rgba(255,255,255,.6)}' +
      '#glide-mp .ctls{position:relative;display:flex;align-items:center;justify-content:space-between;padding:18px 20px 8px}' +
      '#glide-mp .ctl{all:unset;width:52px;height:52px;display:flex;align-items:center;justify-content:center;border-radius:26px;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
      '#glide-mp .ctl i{width:26px;height:26px;-webkit-mask-size:26px 26px}' +
      '#glide-mp .ctl.sm i{width:22px;height:22px;-webkit-mask-size:22px 22px;opacity:.55}#glide-mp .ctl.sm.on i{opacity:1;background-color:#DDF46A}' +
      '#glide-mp .ctl.big{width:72px;height:72px;border-radius:36px;background:#fff}#glide-mp .ctl.big i{background-color:#111;width:32px;height:32px;-webkit-mask-size:32px 32px}' +
      '#glide-mp .ctl.sm .one{position:absolute;margin:0 0 0 0;font:800 9px/1 ' + F + ';color:#DDF46A}' +
      '#glide-mp .nx{position:relative;margin:10px 16px 0;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.08);display:flex;align-items:center;gap:12px;cursor:pointer}' +
      '#glide-mp .nx i{flex:none;width:20px;height:20px;background-color:#fff;-webkit-mask:url("' + gmIcon('list') + '") center/20px 20px no-repeat}' +
      '#glide-mp .nx div{flex:1;min-width:0}#glide-mp .nx small{display:block;font:500 11px/1 ' + F + ';color:rgba(255,255,255,.55)}' +
      '#glide-mp .nx b{display:block;margin-top:4px;font:600 14px/1.3 ' + F + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#glide-mp .tbr{display:flex;gap:8px}#glide-mp .ib.on i{background-color:#DDF46A}' +
      '#glide-mp .slt{display:block;margin-top:8px;font:600 12px/1 ' + F + ';color:#DDF46A}#glide-mp .slt:empty{display:none}' +
      '#glide-mp .sls{position:absolute;inset:0;z-index:5;background:rgba(0,0,0,.45);animation:mpfade .2s both}#glide-mp .sls.out{animation:mpfade .2s reverse both}@keyframes mpfade{from{opacity:0}}' +
      '#glide-mp .sl{position:absolute;left:0;right:0;bottom:0;z-index:6;padding:0 16px calc(16px + env(safe-area-inset-bottom));border-radius:20px 20px 0 0;background:#1c1c22;animation:mpup .26s cubic-bezier(.2,0,0,1) both}#glide-mp .sl.out{animation:mpdown .2s cubic-bezier(.4,0,1,1) both}@keyframes mpup{from{transform:translateY(100%)}}@keyframes mpdown{to{transform:translateY(100%)}}' +
      '#glide-mp .slg{width:36px;height:4px;margin:8px auto 10px;border-radius:2px;background:rgba(255,255,255,.3)}#glide-mp .sl h3{margin:0 6px;font:800 18px/1.3 ' + F + '}#glide-mp .sl p{margin:4px 6px 10px;font:400 12px/1.4 ' + F + ';color:rgba(255,255,255,.6)}' +
      '#glide-mp .sl button{all:unset;display:block;width:100%;box-sizing:border-box;padding:14px 12px;border-radius:12px;font:600 15px/1 ' + F + ';cursor:pointer}#glide-mp .sl button:active{background:rgba(255,255,255,.08)}#glide-mp .sl button.on{color:#DDF46A}' +
      '#glide-mp .info span{cursor:pointer}#glide-mp .loc{display:inline-block;margin-top:10px;padding:5px 9px;border-radius:6px;background:rgba(221,244,106,.16);color:#DDF46A;font:700 11px/1 ' + F + '}#glide-mp .loc[hidden]{display:none}' +
      '#glide-mp .lyo{all:unset;position:relative;align-self:flex-start;margin:12px 16px 0;padding:10px 16px;border-radius:20px;background:rgba(255,255,255,.1);display:flex;align-items:center;gap:8px;font:700 14px/1 ' + F + ';cursor:pointer;transition:transform .15s}#glide-mp .lyo:active{transform:scale(.96)}' +
      '#glide-mp .lyo i{width:18px;height:18px;background-color:#fff;-webkit-mask:url("' + gmIcon('list') + '") center/18px 18px no-repeat}' +
      '#glide-mp .ly{position:absolute;inset:0;z-index:7;display:flex;flex-direction:column;background:rgba(14,14,20,.94);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);animation:mpup .3s cubic-bezier(.2,0,0,1) both}#glide-mp .ly.out{animation:mpdown .22s cubic-bezier(.4,0,1,1) both}' +
      '#glide-mp .lyh{display:flex;align-items:center;gap:12px;padding:14px 12px 10px 24px}#glide-mp .lyh div{flex:1;min-width:0}#glide-mp .lyh b{display:block;font:800 18px/1.3 ' + F + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#glide-mp .lyh span{font:500 13px/1.3 ' + F + ';color:rgba(255,255,255,.6)}' +
      '#glide-mp .lyb{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:8px 24px 40vh;-webkit-mask-image:linear-gradient(transparent,#000 6%,#000 88%,transparent)}' +
      '#glide-mp .lyb p{margin:0;padding:9px 0;font:800 22px/1.4 ' + F + ';color:rgba(255,255,255,.32);transition:color .25s,transform .25s;transform-origin:left center;cursor:pointer}#glide-mp .lyb p.on{color:#fff;transform:scale(1.03)}' +
      '#glide-mp .lyb pre{margin:0;white-space:pre-wrap;font:600 17px/1.7 ' + F + ';color:rgba(255,255,255,.85)}#glide-mp .lyn{padding:40px 0;text-align:center;font:500 14px/1.5 ' + F + ';color:rgba(255,255,255,.6)}' +
      '#glide-mp .lys{padding:8px 24px calc(12px + env(safe-area-inset-bottom));font:400 11px/1.3 ' + F + ';color:rgba(255,255,255,.4)}' +
      '#glide-mp:not(.big) .art .tb{display:none}#glide-mp .art img{aspect-ratio:auto!important;object-fit:contain;max-width:none}' +
      '#glide-mp.big .art{align-items:flex-end}#glide-mp.big .art img{aspect-ratio:1/1;border-radius:14px;box-shadow:0 14px 44px rgba(0,0,0,.55)}' +
      '#glide-mp .info{padding:16px 26px 2px}' +
      // 펼친 화면: 제목·가수를 맨 위 줄(∨·⋮ 사이)로 — 멜론처럼. 큰 제목 줄(약 70px)만큼 가사·목록 칸이 커짐 (좁은 폴드 바깥 화면에서 가사 2~3줄뿐이었음, 2026-11-25)
      '#glide-mp.big .info{position:absolute;top:8px;left:60px;right:60px;height:40px;padding:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;z-index:3}' +
      '#glide-mp.big .info b{max-width:100%;font:800 16px/1.25 ' + F + '}#glide-mp.big .info span{max-width:100%;margin-top:2px;font:500 12.5px/1.25 ' + F + '}#glide-mp.big .chips{padding-top:14px}' +
      '#glide-mp .chips{position:relative;display:flex;align-items:center;gap:8px;padding:10px 24px 0;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}#glide-mp .chips::-webkit-scrollbar{display:none}#glide-mp .chips .chip{flex:none}' +
      // 앨범 옆으로 밀기 (멜론처럼 다음·이전 곡): 손가락을 따라감, 놓으면 넘김 또는 제자리
      '#glide-mp .art img{will-change:transform}' +
      '#glide-mp .chip{all:unset;display:flex;align-items:center;gap:6px;height:34px;padding:0 14px;border-radius:17px;border:1px solid rgba(255,255,255,.24);font:700 13px/1 ' + F + ';cursor:pointer;transition:transform .15s,background-color .15s}#glide-mp .chip:active{transform:scale(.95);background:rgba(255,255,255,.08)}' +
      '#glide-mp .chip i{width:17px;height:17px;background-color:#fff;-webkit-mask:url("' + gmIcon('heart') + '") center/17px 17px no-repeat}#glide-mp .chip.mx i{-webkit-mask-image:url("' + gmIcon('mix') + '")}#glide-mp .chip.lk.on i{background-color:#ff4d6d}' +
      '#glide-mp .chips .loc{margin:0}#glide-mp > .slt{position:relative;margin:10px 26px 0}' +
      '#glide-mp .lp{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:7px;padding:8px 28px;text-align:center;cursor:pointer;overflow:hidden}' +
      '#glide-mp .lp p{margin:0;max-width:100%;font:600 15px/1.35 ' + F + ';color:rgba(255,255,255,.38);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#glide-mp .lp p.c{font:800 18px/1.35 ' + F + ';color:#fff;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}#glide-mp .lp p.c.dim{color:rgba(255,255,255,.6)}#glide-mp .lp.plain p{color:rgba(255,255,255,.6);font-weight:600;font-size:15px}' +
      '#glide-mp .lp p.o{display:none;opacity:.6}#glide-mp .lp.tall p.o{display:block}#glide-mp .lp.tall{gap:10px}' +
      '#glide-mp .lp.roll p{animation:lproll .4s cubic-bezier(.2,0,0,1)}@keyframes lproll{from{transform:translateY(12px);opacity:.25}}#glide-mp .lp.empty{visibility:hidden}' +
      '#glide-mp .nx{margin:4px 24px 0;padding:0;background:none;border-radius:0;display:flex;align-items:center;gap:8px}' +
      '#glide-mp .nx small{flex:none;padding:4px 7px;border-radius:5px;background:rgba(255,255,255,.12);font:700 11px/1 ' + F + ';color:rgba(255,255,255,.75)}#glide-mp .nx b{flex:1;min-width:0;margin:0;font:500 13px/1.3 ' + F + ';color:rgba(255,255,255,.75)}' +
      '#glide-mp .tools{position:relative;display:flex;justify-content:space-around;padding:16px 10px 4px}' +
      '#glide-mp .tl{all:unset;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:66px;cursor:pointer;transition:transform .15s}#glide-mp .tl:active{transform:scale(.92)}#glide-mp .tl[hidden]{display:none}' +
      '#glide-mp .tl i{width:24px;height:24px;background-color:#fff;opacity:.85;-webkit-mask:center/24px 24px no-repeat}#glide-mp .tl span{font:500 11px/1 ' + F + ';color:rgba(255,255,255,.62)}#glide-mp .tl.on i{background-color:#DDF46A;opacity:1}#glide-mp .tl.on span{color:#DDF46A}' +
      '#glide-mp .tm{align-items:center}#glide-mp .tm .loc{display:flex;align-items:center;gap:4px;margin:0;padding:0;background:none;border-radius:0;color:rgba(221,244,106,.85);font:600 11px/1 ' + F + '}#glide-mp .tm .loc[hidden]{display:none}' +
      '#glide-mp .tm .loc i{width:12px;height:12px;background-color:currentColor;-webkit-mask:url("' + gmIcon('dl') + '") center/12px 12px no-repeat}' +
      '#glide-mp .tools{align-items:center;justify-content:space-between;gap:8px;padding:10px 18px calc(14px + env(safe-area-inset-bottom))}' +
      '#glide-mp .tools .tl{min-width:0;width:48px;height:48px;justify-content:center;border-radius:24px}#glide-mp .tools .tl:active{background:rgba(255,255,255,.08)}#glide-mp .tools .tl span{display:none}#glide-mp .tools .tl i{width:24px;height:24px;opacity:.8}' +
      '#glide-mp .tools .nx{flex:1;min-width:0;margin:0;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;transition:transform .15s}#glide-mp .tools .nx:active{transform:scale(.97)}' +
      '#glide-mp .tools .nx small{padding:0;background:none;font:500 11px/1 ' + F + ';color:rgba(255,255,255,.45)}#glide-mp .tools .nx b{max-width:100%;text-align:center;font:600 13px/1.2 ' + F + ';color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#glide-mp .saver{display:none}' +
      '#glide-mp .pane{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;padding:14px 0 4px}' +
      '#glide-mp .pills{display:flex;gap:8px;padding:0 24px;overflow-x:auto;scrollbar-width:none;flex:none}#glide-mp .pills::-webkit-scrollbar{display:none}' +
      '#glide-mp .pills button{all:unset;flex:none;padding:8px 14px;border-radius:17px;background:rgba(255,255,255,.08);font:600 13px/1 ' + F + ';color:rgba(255,255,255,.7);cursor:pointer;transition:background-color .2s,color .2s,transform .15s}#glide-mp .pills button:active{transform:scale(.95)}' +
      '#glide-mp .pills button.on{background:#fff;color:#111}' +
      '#glide-mp .pc{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;margin-top:6px}#glide-mp .pc>[hidden]{display:none!important}' +
      '#glide-mp .pv{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:2px 0;animation:mpfade .25s both}' +
      '#glide-mp .prow{all:unset;display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;padding:7px 24px;cursor:pointer}#glide-mp .prow:active{background:rgba(255,255,255,.06)}' +
      '#glide-mp .prow img{flex:none;width:44px;height:44px;border-radius:6px;object-fit:cover;background:rgba(255,255,255,.08)}#glide-mp .prow div{min-width:0}' +
      '#glide-mp .prow b{display:block;font:600 14px/1.3 ' + F + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#glide-mp .prow span{display:block;margin-top:2px;font:400 12px/1.3 ' + F + ';color:rgba(255,255,255,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#glide-mp .pempty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:10px 24px;text-align:center;animation:mpfade .25s both}' +
      '#glide-mp .pempty i{width:30px;height:30px;background-color:rgba(255,255,255,.28);-webkit-mask:center/30px 30px no-repeat}#glide-mp .pempty b{font:700 15px/1.3 ' + F + ';color:rgba(255,255,255,.78)}#glide-mp .pempty span{font:400 12px/1.4 ' + F + ';color:rgba(255,255,255,.45)}#glide-mp .pempty span:empty{display:none}' +
      '#glide-mp .pv .pxf{margin:6px 24px 10px}#glide-mp .pdesc{margin:0 24px;font:400 13px/1.55 ' + F + ';color:rgba(255,255,255,.7);white-space:pre-wrap;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}' +
      '#glide-mp .pmore{all:unset;margin:8px 24px 0;font:600 13px/1 ' + F + ';color:#DDF46A;cursor:pointer}' +
      '#glide-mp .sl.mn{padding-bottom:calc(10px + env(safe-area-inset-bottom))}#glide-mp .mh{display:flex;align-items:center;gap:12px;padding:2px 4px 14px}#glide-mp .mh img{width:56px;height:56px;border-radius:8px;object-fit:cover}#glide-mp .mh div{min-width:0}' +
      '#glide-mp .mh b{display:block;font:800 16px/1.3 ' + F + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#glide-mp .mh span{display:block;margin-top:2px;font:500 13px/1.3 ' + F + ';color:rgba(255,255,255,.6)}' +
      '#glide-mp .mq{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0 0 12px;border-bottom:1px solid rgba(255,255,255,.08)}' +
      '#glide-mp .sl .mq button{display:flex;flex-direction:column;align-items:center;gap:7px;padding:12px 0 10px;border-radius:14px;background:rgba(255,255,255,.06);font:600 12px/1 ' + F + ';color:rgba(255,255,255,.85)}' +
      '#glide-mp .mq i{width:22px;height:22px;background-color:#fff;-webkit-mask:center/22px 22px no-repeat}#glide-mp .mq button.on i{background-color:#ff4d6d}' +
      '#glide-mp .ml{padding:6px 0 0}#glide-mp .sl .ml button{display:flex;align-items:center;gap:16px;padding:13px 8px;font:500 15px/1.2 ' + F + '}#glide-mp .ml i{flex:none;width:21px;height:21px;background-color:rgba(255,255,255,.75);-webkit-mask:center/21px 21px no-repeat}#glide-mp .ml span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#glide-mp .lyb.px{padding:4px 20px 40px;-webkit-mask-image:none}#glide-mp .pxf{display:flex;gap:8px;margin:4px 0 16px}#glide-mp .pxf div{flex:1;padding:12px;border-radius:12px;background:rgba(255,255,255,.07)}#glide-mp .pxf b{display:block;font:800 16px/1.2 ' + F + '}#glide-mp .pxf span{font:500 11px/1 ' + F + ';color:rgba(255,255,255,.55)}' +
      '#glide-mp .lyb .pxd{margin:0;white-space:pre-wrap;word-break:break-word;font:400 14px/1.6 ' + F + ';color:rgba(255,255,255,.78)}' +
      '#glide-mp .cm{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06)}#glide-mp .cm img{flex:none;width:32px;height:32px;border-radius:16px;background:rgba(255,255,255,.1)}#glide-mp .cm div{min-width:0}' +
      '#glide-mp .cm small{display:block;font:500 12px/1.3 ' + F + ';color:rgba(255,255,255,.5)}#glide-mp .cm p{margin:4px 0 0;font:400 14px/1.5 ' + F + ';color:rgba(255,255,255,.88);white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}#glide-mp .cm p.open{display:block}#glide-mp .cm span{display:block;margin-top:5px;font:500 12px/1 ' + F + ';color:rgba(255,255,255,.5)}' +
      '#glide-mp .chip.ad i{-webkit-mask-image:url("' + gmIcon('plus') + '")}#glide-mp .chip.cmc i{-webkit-mask-image:url("' + gmIcon('chat') + '")}' +
      '#glide-mp .cms{position:absolute;left:0;right:0;bottom:0;z-index:8;display:flex;flex-direction:column;border-radius:16px 16px 0 0;background:#1a1a1f;box-shadow:0 -6px 24px rgba(0,0,0,.35);will-change:transform;overscroll-behavior:contain}' +
      '#glide-mp .cmhd{flex:none;touch-action:none}#glide-mp .cmg{width:36px;height:4px;margin:8px auto 4px;border-radius:2px;background:rgba(255,255,255,.28)}' +
      '#glide-mp .cmt{display:flex;align-items:center;gap:8px;padding:4px 8px 6px 18px}#glide-mp .cmt b{font:800 17px/1.3 ' + F + '}#glide-mp .cmt span{flex:1;font:500 14px/1.3 ' + F + ';color:rgba(255,255,255,.55)}' +
      '#glide-mp .cmx{all:unset;flex:none;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:20px;cursor:pointer}#glide-mp .cmx:active{background:rgba(255,255,255,.1)}#glide-mp .cmx i{width:20px;height:20px;background-color:#fff;-webkit-mask:url("' + gmIcon('close') + '") center/20px 20px no-repeat}' +
      '#glide-mp .cmso{flex:none;display:flex;gap:8px;padding:2px 18px 10px;border-bottom:1px solid rgba(255,255,255,.07)}#glide-mp .cmso button{all:unset;padding:7px 12px;border-radius:8px;background:rgba(255,255,255,.1);font:600 13px/1 ' + F + ';color:rgba(255,255,255,.85);cursor:pointer}#glide-mp .cmso button[aria-pressed=true]{background:#fff;color:#111}' +
      '#glide-mp .cmbd{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:4px 0 calc(16px + env(safe-area-inset-bottom))}' +
      '#glide-mp .cmr{display:flex;gap:12px;padding:10px 18px}#glide-mp .cmr img{flex:none;width:28px;height:28px;border-radius:14px;background:rgba(255,255,255,.1)}#glide-mp .cmr>div{flex:1;min-width:0}' +
      '#glide-mp .cmr small{display:block;font:500 12px/1.3 ' + F + ';color:rgba(255,255,255,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#glide-mp .cmr p{margin:3px 0 0;font:400 14px/1.45 ' + F + ';color:rgba(255,255,255,.92);white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}#glide-mp .cmr p.open{display:block}' +
      '#glide-mp .cmf{display:flex;align-items:center;gap:6px;margin-top:6px;font:500 12px/1 ' + F + ';color:rgba(255,255,255,.6)}#glide-mp .cmf i{width:15px;height:15px;background-color:rgba(255,255,255,.7);-webkit-mask:url("' + gmIcon('thumb') + '") center/15px 15px no-repeat}#glide-mp .cmf em{margin-left:14px;font-style:normal;color:#9cc4ff}' +
      '#glide-mp .cmrb{all:unset;display:flex;align-items:center;gap:6px;margin:0 18px 2px 58px;padding:8px 0;font:600 13px/1 ' + F + ';color:#3ea6ff;cursor:pointer;-webkit-tap-highlight-color:transparent}#glide-mp .cmrb:active{opacity:.6}#glide-mp .cmrb i{width:8px;height:8px;border:solid currentColor;border-width:0 1.8px 1.8px 0;transform:translateY(-2px) rotate(45deg);transition:transform .2s}#glide-mp .cmrb.open i{transform:translateY(2px) rotate(-135deg)}' +
      '#glide-mp .cmrp{margin-left:40px}#glide-mp .cmrp .cmr{padding:8px 18px}#glide-mp .cmrp .cmr img{width:22px;height:22px;border-radius:11px}#glide-mp .cmrp[hidden]{display:none}#glide-mp .cmrp .cmrb{margin-left:18px}#glide-mp .cmrl{margin:0 18px 0 58px;padding:6px 0;font:400 12px/1 ' + F + ';color:rgba(255,255,255,.45)}' +
      '#glide-mp .cmn{padding:40px 0;text-align:center;font:500 14px/1.5 ' + F + ';color:rgba(255,255,255,.55)}' +
      '#glide-mp .sl .plnew{color:#DDF46A}#glide-mp .sl .plrow{display:flex;align-items:center;gap:12px;padding:8px 10px}#glide-mp .sl .plrow span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#glide-mp .sl .plrow small{font:500 12px/1 ' + F + ';color:rgba(255,255,255,.5)}' +
      '#glide-mp .sl .plrow .pl-cv{position:relative;flex:none;width:40px;height:40px;border-radius:8px;overflow:hidden;background:rgba(255,255,255,.1);display:grid}#glide-mp .sl .plrow .pl-cv.q{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}#glide-mp .sl .plrow .pl-cv img{width:100%;height:100%;object-fit:cover;display:block}#glide-mp .sl .plrow .pl-cv i{display:none}' +
      '#glide-mp .sl .plform{display:flex;gap:8px;padding:6px 0}#glide-mp .sl .plform input{all:unset;flex:1;min-width:0;height:44px;padding:0 14px;border-radius:12px;background:rgba(255,255,255,.1);font:500 15px/1 ' + F + ';color:#fff}' +
      '#glide-mp .sl .plform .plok{flex:none;width:auto;padding:0 16px;height:44px;border-radius:12px;background:#DDF46A;color:#111;font:700 14px/44px ' + F + ';text-align:center}' +
      '#glide-mp .sl .slinfo{margin:12px 6px 0;font:400 11px/1.4 ' + F + ';color:rgba(255,255,255,.4)}' +
      '#glide-mp .saver{position:relative;margin:6px 24px 12px;text-align:center;font:400 11px/1.4 ' + F + ';color:rgba(255,255,255,.45)}';
    (document.head || document.documentElement).appendChild(st);
  }
  function mpCtl(cls, icon, label, fn) {
    var b = G.el('button', { type: 'button', 'class': 'ctl ' + cls, 'aria-label': label, 'data-glide': 'music' }, [G.el('i', { style: '-webkit-mask-image:url("' + gmIcon(icon) + '")' })]);
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); fn(); }, true);
    return b;
  }
  function mpBuild() {
    if (MP.el && MP.el.isConnected) return;
    mpCss();
    var down = G.el('button', { type: 'button', 'class': 'ib', 'aria-label': '작게' }, [G.el('i', { style: '-webkit-mask-image:url("' + gmIcon('down') + '")' })]);
    down.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('minimize', {}); }, true);
    var more = G.el('button', { type: 'button', 'class': 'ib', 'aria-label': '곡 메뉴' }, [G.el('i', { style: '-webkit-mask-image:url("' + gmIcon('more') + '")' })]);
    more.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); mpMenu(); }, true);
    // 아래 도구 줄 (멜론의 EQ·출력·재생목록 줄 자리): 수면 타이머 · 가사 · 재생목록 · 영상
    var tool = function (icon, label, fn) {
      var b = G.el('button', { type: 'button', 'class': 'tl', 'data-glide': 'music' }, [G.el('i', { style: '-webkit-mask-image:url("' + gmIcon(icon) + '")' }), G.el('span', { text: label })]);
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); fn(); }, true);
      return b;
    };
    MP.moon = tool('moon', '수면 타이머', mpSleepSheet);
    MP.lyb = tool('lyric', '가사', lyOpen);
    MP.qb = tool('list', '재생목록', function () { try { quSheet(); } catch (x) { /* ignore */ } });
    var vbtn = MP.vbtn = tool('video', '영상', function () { MP.showVideo = true; mpTick(); gmToastPlayer('영상 보기 (데이터 절약 화질) · ♪ 버튼으로 돌아와요'); });
    MP.img = G.el('img', { alt: '' });
    MP.bg = G.el('div', { 'class': 'bg' });
    MP.art = G.el('div', { 'class': 'art' }, [MP.img, G.el('div', { 'class': 'tb' }, [down, more])]);
    // 앨범을 옆으로 밀면 다음·이전 곡 (멜론 6.28 실기, 2026-11-25). 세로 밀기는 앱(작게·끌어 내리기) 몫이라 가로가 분명할 때만 가져감.
    // 곡 넘기기는 아래 ⏮·⏭ 버튼을 그대로 누름 (대기열·반복·저장된 곡 처리를 같은 길로)
    (function () {
      var sw = null;
      var img = function () { return MP.img; };
      var reset = function (anim) { var im = img(); im.style.transition = anim ? 'transform .22s cubic-bezier(.2,0,0,1), opacity .22s' : 'none'; im.style.transform = ''; im.style.opacity = ''; };
      MP.art.addEventListener('touchstart', function (e) { if (e.touches.length !== 1 || !document.documentElement.hasAttribute('data-glide-music') || (e.target.closest && e.target.closest('button'))) { sw = null; return; } var t = e.touches[0]; sw = { x: t.clientX, y: t.clientY, t: Date.now(), on: false, s: [] }; }, { passive: true });
      MP.art.addEventListener('touchmove', function (e) {
        if (!sw) return; var t = e.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
        if (!sw.on) { if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return; if (Math.abs(dx) < Math.abs(dy) * 1.3) { sw = null; return; } sw.on = true; }
        if (e.cancelable) e.preventDefault(); e.stopPropagation();
        sw.s.push({ t: Date.now(), x: t.clientX }); if (sw.s.length > 5) sw.s.shift();
        var im = img(); im.style.transition = 'none'; im.style.transform = 'translateX(' + dx + 'px)'; im.style.opacity = String(Math.max(.35, 1 - Math.abs(dx) / (innerWidth * 1.2)));
      }, { passive: false });
      var end = function (e) {
        var w = sw; sw = null; if (!w || !w.on) return; e.stopPropagation();
        var t = e.changedTouches && e.changedTouches[0], dx = t ? t.clientX - w.x : 0, a = w.s[0], b = w.s[w.s.length - 1], v = a && b && b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;
        var go = Math.abs(dx) > innerWidth * 0.28 || (Math.abs(v) > 0.5 && Math.abs(dx) > 40);
        if (!go || e.type === 'touchcancel') { reset(true); return; }
        var dir = dx < 0 ? 1 : -1, im = img();
        im.style.transition = 'transform .18s cubic-bezier(.4,0,1,1), opacity .18s'; im.style.transform = 'translateX(' + (-dir * innerWidth) + 'px)'; im.style.opacity = '0';
        G.send('haptic', { kind: 'gesture' });
        G.setTimeout.call(W, function () {
          var btn = MP.el && MP.el.querySelector('.ctls [aria-label="' + (dir > 0 ? '다음 곡' : '이전 곡') + '"]'); if (btn) btn.click();
          im.style.transition = 'none'; im.style.transform = 'translateX(' + (dir * innerWidth * 0.35) + 'px)';
          G.setTimeout.call(W, function () { reset(true); }, 30);
        }, 170);
        log('info', '음악: 앨범 밀기 → ' + (dir > 0 ? '다음 곡' : '이전 곡'));
      };
      MP.art.addEventListener('touchend', end, { passive: true }); MP.art.addEventListener('touchcancel', end, { passive: true });
    })();
    MP.title = G.el('b'); MP.artist = G.el('span'); MP.slt = G.el('small', { 'class': 'slt' });
    MP.artist.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); var a = MP.artist.textContent; if (a) { G.send('haptic', { kind: 'gesture' }); G.send('musicArtist', { name: a }); G.send('minimize', {}); } }, true);
    // 좋아요(유튜브 좋아요 · 수) · 비슷한 곡 믹스 (멜론의 ♡ · 믹스업 자리)
    MP.like = G.el('button', { type: 'button', 'class': 'chip lk', 'aria-label': '좋아요' }, [G.el('i'), G.el('span', { text: '좋아요' })]);
    MP.like.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); mpLike(); }, true);
    MP.cmT = G.el('span', { text: '댓글' });
    MP.cmb = G.el('button', { type: 'button', 'class': 'chip cmc', 'aria-label': '댓글' }, [G.el('i'), MP.cmT]);
    MP.cmb.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); mpComments(); }, true);
    MP.addb = G.el('button', { type: 'button', 'class': 'chip ad' }, [G.el('i'), G.el('span', { text: '담기' })]);
    MP.addb.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); mpPlPick(); }, true);
    MP.mixb = G.el('button', { type: 'button', 'class': 'chip mx' }, [G.el('i'), G.el('span', { text: '믹스' })]);
    MP.mixb.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); mpMix(); }, true);
    MP.local = G.el('small', { 'class': 'loc', hidden: '' }, [G.el('i'), '저장된 곡']);
    // 가사 미리보기 (가운데 여백): 앞·지금·다음 줄, 누르면 전체 가사
    MP.lp = G.el('div', { 'class': 'lp', 'data-glide': 'music' }, [G.el('p', { 'class': 'o' }), G.el('p'), G.el('p', { 'class': 'c' }), G.el('p'), G.el('p', { 'class': 'o' })]);
    MP.lp.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); lyOpen(); }, true);
    MP.fi = G.el('div', { 'class': 'fi' }); MP.kn = G.el('div', { 'class': 'kn' });
    MP.bar = G.el('div', { 'class': 'bar', 'data-glide': 'music' }, [G.el('div', { 'class': 'tr' }), MP.fi, MP.kn]);
    MP.t1 = G.el('span'); MP.t2 = G.el('span');
    MP.shuf = mpCtl('sm', 'shuffle', '셔플', mpShuffle);
    MP.play = mpCtl('big', 'pause', '재생/일시정지', function () { var v = mpVideo(); if (v) { if (v.paused) v.play(); else v.pause(); } });
    MP.rep = mpCtl('sm', 'repeat', '반복', mpRepeat);
    MP.nextTitle = G.el('b');
    MP.nx = G.el('div', { 'class': 'nx', 'data-glide': 'music' }, [G.el('small', { text: '다음 곡' }), MP.nextTitle]);
    MP.nx.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); try { quSheet(); } catch (x) { /* ignore */ } }, true);
    MP.el = G.el('div', { id: 'glide-mp', 'data-glide': 'music', hidden: '' }, [
      MP.bg, MP.art,
      G.el('div', { 'class': 'info' }, [MP.title, MP.artist]),
      G.el('div', { 'class': 'chips' }, [MP.like, MP.cmb, MP.addb, MP.mixb]),
      MP.slt,
      mpPaneBuild(),
      MP.bar, G.el('div', { 'class': 'tm' }, [MP.t1, MP.local, MP.t2]),
      G.el('div', { 'class': 'ctls' }, [MP.shuf, mpCtl('', 'prev', '이전 곡', mpPrev), MP.play, mpCtl('', 'next', '다음 곡', mpNext), MP.rep]),
      G.el('div', { 'class': 'tools' }, [MP.moon, MP.nx, MP.qb]),
      (MP.saver = G.el('div', { 'class': 'saver' }))
    ]);
    // 진행 막대 끌기
    var seekAt = function (x) { var r = MP.bar.getBoundingClientRect(), v = mpVideo(); if (!v || !isFinite(v.duration)) return; var f = Math.max(0, Math.min(1, (x - r.left) / r.width)); MP.seekTo = f * v.duration; mpDraw(MP.seekTo, v.duration); };
    MP.bar.addEventListener('touchstart', function (e) { e.stopPropagation(); MP.drag = true; seekAt(e.touches[0].clientX); }, { capture: true, passive: true });
    MP.bar.addEventListener('touchmove', function (e) { e.stopPropagation(); if (e.cancelable) e.preventDefault(); seekAt(e.touches[0].clientX); }, { capture: true, passive: false });
    MP.bar.addEventListener('touchcancel', function () { MP.drag = false; MP.seekTo = null; }, { capture: true, passive: true });
    MP.bar.addEventListener('touchend', function (e) { e.stopPropagation(); MP.drag = false; var v = mpVideo(); if (v && MP.seekTo != null) v.currentTime = MP.seekTo; MP.seekTo = null; }, { capture: true, passive: true });
    // 재생 화면 위 터치가 유튜브 조작부·손동작(두 번 탭·길게 누르기)으로 가지 않게
    ['click', 'dblclick', 'pointerdown', 'pointerup'].forEach(function (t) { MP.el.addEventListener(t, function (e) { e.stopPropagation(); }, false); });
    document.body.appendChild(MP.el);
  }
  // ---- 좋아요 (유튜브 좋아요 · 수): 로그인된 계정으로 직접 받고 누름. 저장된 곡 재생 중에는 영상 화면 정보 칸(좋아요 버튼)이 그려지지 않아(폰 확인) 버튼을 대신 누를 수 없음 ----
  function gmYtAuth(ep, body) {
    var c = W.ytcfg;
    if (!c || !c.get || !c.get('LOGGED_IN')) return Promise.resolve(null);
    return gmAuthHeader().then(function (auth) {
      if (!auth) return null;
      return fetch('/youtubei/v1/' + ep + '?prettyPrint=false', {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json', authorization: auth, 'x-origin': location.origin, 'x-goog-authuser': '0',
          'x-youtube-client-name': String(c.get('INNERTUBE_CONTEXT_CLIENT_NAME') || 2), 'x-youtube-client-version': String(c.get('INNERTUBE_CLIENT_VERSION') || '') },
        body: JSON.stringify(Object.assign({ context: c.get('INNERTUBE_CONTEXT') }, body))
      }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    });
  }
  function mpLikeLoad(vid) {
    if (MP.likeVid === vid) return;
    MP.likeVid = vid; MP.likeInfo = null;
    gmYtAuth('next', { videoId: vid }).then(function (j) {
      if (!j || MP.likeVid !== vid) return;
      var lb = null;
      (function walk(o, d) { if (lb || !o || typeof o !== 'object' || d > 26) return; if (o.likeButtonViewModel && o.likeButtonViewModel.likeButtonViewModel) { lb = o.likeButtonViewModel.likeButtonViewModel; return; } for (var k in o) walk(o[k], d + 1); })(j, 0);
      if (!lb) return;
      var t = lb.toggleButtonViewModel && lb.toggleButtonViewModel.toggleButtonViewModel;
      var bvm = function (x) { return x && x.buttonViewModel && x.buttonViewModel.title; };
      var st = lb.likeStatusEntity && lb.likeStatusEntity.likeStatus;
      MP.likeInfo = { liked: st === 'LIKE', count: bvm(t && t.defaultButtonViewModel) || '', countOn: bvm(t && t.toggledButtonViewModel) || '' };
      mpLikeDraw();
    }).catch(function () {});
  }
  // 알림·잠금화면(미디어 세션)에 보낼 음악 정보: 앱이 ±10초 대신 반복·좋아요 버튼을 보여 줌
  function mpMediaMeta(vid) {
    if (!MP.on || !vid) return null;
    var info = mpInfo(vid), li = MP.likeVid === vid ? MP.likeInfo : null;
    return { title: info.title || '', artist: String(info.artist || '').replace(/\s*-\s*Topic$/i, ''), music: { repeat: mpRepeatMode(), liked: !!(li && li.liked) } };
  }
  function mpMediaPoke() { try { if (LM.el) lmReport(); else if (G.mediaRefresh) G.mediaRefresh(); } catch (e) { /* ignore */ } }
  if (G.setMediaMeta && role() === 'player') {
    G.setMediaMeta(mpMediaMeta);
    G.onCommand('musicRepeat', function () { if (MP.on) mpRepeat(); });
    G.onCommand('musicLike', function () { if (MP.on) mpLike(); });
    // 이어폰·알림·잠금화면의 이전/다음: 음악이면 재생 화면의 ⏮·⏭ 와 똑같이 (스트리밍 중에도 — 예전에는 유튜브의 이전 영상·추천 영상으로 갔음)
    var MKY = { want: false, at: 0, gen: 0 };
    if (G.setMediaKeys) G.setMediaKeys(function (cmd) {
      if (!MP.on || !onWatch()) return false;
      if (cmd === 'toggle' || cmd === 'play' || cmd === 'pause') {
        // 실제로 재생 중인지 보고 바꿈 (앱이 알던 상태가 잠깐 어긋나 있어도 먹게). 유튜브 플레이어 함수로 (영상 요소만 건드리면 유튜브 상태와 어긋날 수 있음)
        var p = mainPlayer(), v = mpVideo();
        // 유튜브 플레이어는 playVideo 뒤 실제로 움직이기까지 시간이 걸려, 그 사이 다시 누르면 아직 멈춤으로 보고 또 '재생'을 보냈음 → 1.2초 안의 누름은 방금 보낸 뜻을 기준으로
        var recent = MKY.at && Date.now() - MKY.at < 1200;
        var playing = recent ? MKY.want : (v ? !v.paused && !v.ended : false);
        var want = cmd === 'toggle' ? !playing : cmd === 'play';
        MKY.want = want; MKY.at = Date.now(); var gen = ++MKY.gen;
        if (want) {
          var api = false; try { if (p && typeof p.playVideo === 'function') { p.playVideo(); api = true; } } catch (e) { /* ignore */ }
          var kick = function () { if (MKY.gen !== gen) return; /* 그 사이 멈춤을 눌렀으면 다시 틀지 않음 */ if (v && v.paused && !v.ended) { var r = v.play(); if (r && r.catch) r.catch(function () {}); } };
          if (!api) kick(); else G.setTimeout.call(W, kick, 400); // 플레이어가 안 움직였으면 영상 요소로 한 번 더
        } else {
          try { if (p && typeof p.pauseVideo === 'function') p.pauseVideo(); } catch (e) { /* ignore */ }
          if (v && !v.paused) v.pause();
        }
        return true;
      }
      if (cmd === 'next') { log('info', '음악 다음 (이어폰·알림)'); if (!QU.items.length || !quAdvance('이어폰·알림 다음')) mpNext(); return true; }
      if (cmd === 'prev') { log('info', '음악 이전 (이어폰·알림)'); mpPrev(); return true; }
      return false;
    });
  }
  function mpLikeDraw() {
    mpMediaPoke();
    if (!MP.like) return;
    var li = MP.likeVid === mpVid() ? MP.likeInfo : null;
    var on = !!(li && li.liked), n = li ? (on ? li.countOn || li.count : li.count) : '';
    MP.like.classList.toggle('on', on);
    MP.like.firstChild.style.webkitMaskImage = 'url("' + gmIcon(on ? 'heartf' : 'heart') + '")';
    MP.like.lastChild.textContent = /\d/.test(n) ? n : '좋아요';
  }
  function mpLike() {
    var li = false; try { li = !!(W.ytcfg && W.ytcfg.get && W.ytcfg.get('LOGGED_IN')); } catch (e) { /* ignore */ }
    if (!li) { gmToastPlayer('로그인하면 좋아요를 누를 수 있어요'); return; }
    var v = mpVid(), info = MP.likeVid === v && MP.likeInfo ? MP.likeInfo : { liked: false, count: '', countOn: '' };
    var want = !info.liked;
    G.send('haptic', { kind: 'gesture' });
    MP.likeInfo = Object.assign({}, info, { liked: want }); MP.likeVid = v; mpLikeDraw(); // 먼저 바꿔 보여 주고
    gmYtAuth(want ? 'like/like' : 'like/removelike', { target: { videoId: v } }).then(function (j) {
      if (!j) throw new Error('no auth');
      gmToastPlayer(want ? '좋아요한 곡에 담았어요' : '좋아요를 취소했어요');
      log('info', '음악 좋아요 ' + (want ? '누름' : '취소') + ' [' + v + ']');
      G.setTimeout.call(W, function () { MP.likeVid = ''; mpLikeLoad(v); }, 1500); // 실제 수로 다시
    }).catch(function () { MP.likeInfo = info; mpLikeDraw(); gmToastPlayer('좋아요를 바꾸지 못했어요'); });
  }
  // ---- 비슷한 곡 믹스 (멜론 '믹스업'): 이 곡의 관련 영상 중 노래만 골라 다음 곡들로 ----
  function mpMix() {
    var v = mpVid(); if (!v) return;
    gmToastPlayer('비슷한 곡을 찾는 중…');
    // 유튜브 '믹스'(RD+영상 ID: 이 곡으로 만드는 음악 라디오). 관련 영상은 예능·브이로그가 섞여(폰 확인) 쓰지 않음
    yti('next', { videoId: v, playlistId: 'RD' + v }).then(function (j) {
      if (mpVid() !== v) return; // 기다리는 동안 다른 곡으로 넘어감
      var cur = mpInfo(v), seen = {}, ct = gmNorm(cur.title);
      seen[gmKey(cur)] = 1;
      // 응답에는 믹스 목록(playlistPanelRenderer)과 관련 영상(예능·브이로그 섞임)이 같이 옴 → 믹스 목록만
      var panel = [];
      (function walk(o, d) { if (!o || typeof o !== 'object' || d > 24) return; if (o.playlistPanelVideoRenderer) { panel.push({ playlistPanelVideoRenderer: o.playlistPanelVideoRenderer }); return; } for (var k in o) walk(o[k], d + 1); })(j, 0);
      var list = gmItems(panel).items.filter(function (x) { return x.id !== v && (!x.secs || (x.secs >= 90 && x.secs <= 600)); })
        .filter(function (x) { return !/dance practice|practice|teaser|behind|reaction|안무|티저|비하인드|리액션|shorts/i.test(x.raw || x.title) && !(gmPureOn() && GM_IMPURE.test(x.raw || x.title || '')); })
        .filter(function (x) { return !(ct.length >= 2 && gmNorm(x.title).indexOf(ct) === 0 && gmNorm(x.artist).slice(0, 4) === gmNorm(cur.artist).slice(0, 4)); }) // 같은 곡의 다른 버전(무대·라이브)
        .filter(function (x) { var k = gmKey(x); if (seen[k]) return false; seen[k] = 1; return true; }).slice(0, 25);
      if (list.length < 3) { gmToastPlayer('비슷한 곡을 찾지 못했어요'); return; }
      var s = mpSession() || { at: Date.now(), items: [], played: [] };
      var pick = function (x) { return { id: x.id, title: x.title, artist: x.artist }; };
      s.items = [pick(cur)].concat(list.map(pick)); s.orig = s.items.slice(); s.shuffle = false; s.at = Date.now();
      gmLsSet(GM_KEY, s);
      gmQSend('queueSet', { items: list.map(function (x) { return { id: x.id, title: x.title, ch: x.artist }; }) });
      gmToastPlayer('비슷한 곡 ' + list.length + '곡을 이어서 들어요');
      log('info', '비슷한 곡 믹스: ' + (cur.title || v) + ' → ' + list.length + '곡');
    }, function () { gmToastPlayer('비슷한 곡을 받지 못했어요'); });
  }
  // ---- 곡 메뉴 (⋮, 멜론처럼): 곡 머리 · 자주 쓰는 4개(담기·좋아요·공유·믹스) · 목록(곡 정보·댓글·가사·가수·뮤직비디오) ----
  function mpMenu() {
    if (MP.sl) { mpSleepClose(); return; }
    var v = mpVid(), info = mpInfo(v);
    var close = function () { mpSleepClose(); };
    var head = G.el('div', { 'class': 'mh' }, [G.el('img', { src: 'https://i.ytimg.com/vi/' + v + '/mqdefault.jpg', alt: '' }), G.el('div', {}, [G.el('b', { text: info.title || '' }), G.el('span', { text: info.artist || '' })])]);
    var quick = G.el('div', { 'class': 'mq' });
    var q = function (icon, label, fn, on) {
      var b = G.el('button', { type: 'button', 'class': on ? 'on' : '' }, [G.el('i', { style: '-webkit-mask-image:url("' + gmIcon(icon) + '")' }), G.el('span', { text: label })]);
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); fn(); }, true);
      quick.appendChild(b);
    };
    var li = MP.likeVid === v ? MP.likeInfo : null;
    q('plus', '담기', function () { close(); G.setTimeout.call(W, mpPlPick, 220); });
    q(li && li.liked ? 'heartf' : 'heart', li ? (li.liked ? li.countOn || li.count : li.count) || '좋아요' : '좋아요', function () { close(); mpLike(); }, li && li.liked);
    q('share', '공유', function () { close(); G.send('share', { title: info.title || '', text: (info.title || '') + (info.artist ? ' - ' + info.artist : ''), url: 'https://youtu.be/' + v }); });
    q('mix', '믹스', function () { close(); mpMix(); });
    var list = G.el('div', { 'class': 'ml' });
    var row = function (icon, label, fn) {
      var b = G.el('button', { type: 'button' }, [G.el('i', { style: '-webkit-mask-image:url("' + gmIcon(icon) + '")' }), G.el('span', { text: label })]);
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); close(); G.setTimeout.call(W, fn, 200); }, true);
      list.appendChild(b);
    };
    row('info', '곡 정보', mpInfoPanel);
    row('chat', '댓글', mpComments);
    row('lyric', '가사', lyOpen);
    if (info.artist) row('person', info.artist + ' 노래 더 보기', function () { G.send('musicArtist', { name: info.artist }); G.send('minimize', {}); });
    row('video', '뮤직비디오 보기', mpMv);
    var md = gmLsGet(GM_DATA), mb = (md && md.m === gmMonth() ? md.b || 0 : 0) + MCD.b, ln = md && md.m === gmMonth() ? md.local || 0 : 0;
    var box = G.el('div', { 'class': 'sl mn', 'data-glide': 'music' }, [G.el('div', { 'class': 'slg' }), head, quick, list,
      G.el('div', { 'class': 'slinfo', text: (LM.el ? '저장된 곡으로 재생 중 · ' : '') + '이번 달 음악 데이터 ' + gmMb(mb) + (ln ? ' · 저장된 곡으로 ' + ln + '번' : '') })]);
    var scrim = G.el('div', { 'class': 'sls', 'data-glide': 'music' });
    scrim.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); mpSleepClose(); }, true);
    MP.sl = { box: box, scrim: scrim };
    MP.el.appendChild(scrim); MP.el.appendChild(box);
    lastGeom = ''; reportGeom();
  }
  // ---- 재생 화면 가운데 칸: 알약(다음 곡 · 가사 · 비슷한 곡 · 정보). 기본은 다음 곡, 가사는 골랐을 때만 (2026-11-22 사용자) ----
  var PANE_TABS = [['next', '다음 곡'], ['lyr', '가사'], ['sim', '비슷한 곡'], ['info', '정보']];
  function mpPaneBuild() {
    MP.pills = G.el('div', { 'class': 'pills', 'data-glide': 'music' });
    PANE_TABS.forEach(function (t) {
      var b = G.el('button', { type: 'button', 'data-t': t[0], text: t[1] });
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (mpTabNow() === t[0]) return; G.send('haptic', { kind: 'gesture' }); MP.tabPin = t[0]; MP.paneSig = ''; mpPaneDraw(); }, true);
      MP.pills.appendChild(b);
    });
    MP.pc = G.el('div', { 'class': 'pc', 'data-glide': 'music' });
    MP.pv = G.el('div', { 'class': 'pv' }); // 다음 곡·비슷한 곡·정보
    MP.pe = G.el('div', { 'class': 'pempty', hidden: '' }, [G.el('i'), G.el('b'), G.el('span')]); // 비었을 때 문구
    MP.pc.appendChild(MP.lp); MP.pc.appendChild(MP.pv); MP.pc.appendChild(MP.pe);
    return G.el('div', { 'class': 'pane', 'data-glide': 'music' }, [MP.pills, MP.pc]);
  }
  function mpPaneEmpty(icon, title, sub) {
    MP.pe.hidden = false;
    MP.pe.firstChild.style.webkitMaskImage = 'url("' + gmIcon(icon) + '")';
    MP.pe.children[1].textContent = title; MP.pe.children[2].textContent = sub || '';
  }
  function mpRowsOf(list, onTap) {
    recClear(MP.pv);
    list.forEach(function (x) {
      var r = G.el('button', { type: 'button', 'class': 'prow' }, [G.el('img', { src: 'https://i.ytimg.com/vi/' + x.id + '/mqdefault.jpg', alt: '', loading: 'lazy' }), G.el('div', {}, [koT(G.el('b'), x.title || '', x.artist || x.ch), G.el('span', { text: x.artist || x.ch || '' })])]);
      r.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); onTap(x); }, true);
      MP.pv.appendChild(r);
    });
  }
  // 바로 듣기: 대기열 맨 앞에 넣고 넘어감 (음악 세션에도 넣어 음악 화면 유지)
  function mpPlayNow(x) {
    var s = mpSession(); if (s && !s.items.some(function (i) { return i.id === x.id; })) { s.items.push({ id: x.id, title: x.title, artist: x.artist || x.ch || '' }); gmLsSet(GM_KEY, s); }
    QU.items = [{ id: x.id, title: x.title, ch: x.artist || x.ch || '' }].concat(QU.items.filter(function (q) { return q.id !== x.id; }));
    gmQSend('queueSet', { items: QU.items });
    quAdvance('바로 듣기');
  }
  var MIXC = { vid: '', list: null, p: null };
  function mpMixList(v) {
    if (MIXC.vid === v && (MIXC.list || MIXC.p)) return MIXC.list ? Promise.resolve(MIXC.list) : MIXC.p;
    MIXC.vid = v; MIXC.list = null;
    MIXC.p = yti('next', { videoId: v, playlistId: 'RD' + v }).then(function (j) {
      var panel = [], cur = mpInfo(v), ct = gmNorm(cur.title), seen = {};
      seen[gmKey(cur)] = 1;
      (function walk(o, d) { if (!o || typeof o !== 'object' || d > 24) return; if (o.playlistPanelVideoRenderer) { panel.push({ playlistPanelVideoRenderer: o.playlistPanelVideoRenderer }); return; } for (var k in o) walk(o[k], d + 1); })(j, 0);
      var list = gmItems(panel).items.filter(function (x) { return x.id !== v && (!x.secs || (x.secs >= 90 && x.secs <= 600)); })
        .filter(function (x) { return !/dance practice|practice|teaser|behind|reaction|안무|티저|비하인드|리액션|shorts/i.test(x.raw || x.title) && !(gmPureOn() && GM_IMPURE.test(x.raw || x.title || '')); })
        .filter(function (x) { return !(ct.length >= 2 && gmNorm(x.title).indexOf(ct) === 0 && gmNorm(x.artist).slice(0, 4) === gmNorm(cur.artist).slice(0, 4)); })
        .filter(function (x) { var k = gmKey(x); if (seen[k]) return false; seen[k] = 1; return true; }).slice(0, 25);
      if (MIXC.vid === v) MIXC.list = list;
      return list;
    }, function (e) { if (MIXC.vid === v) MIXC.p = null; throw e; });
    return MIXC.p;
  }
  // 가운데 칸 기본 (2026-11-25 사용자: 멜론처럼 '가사를 기본으로'): 가사가 있으면 가사, 없거나 꺼 뒀으면 다음 곡. 알약을 직접 고르면 그것(MP.tabPin)을 계속 씀
  function mpTabNow() {
    if (MP.tabPin) return MP.tabPin;
    if (S().musicLyrics === false || (MP.lpDone && !MP.lpData)) return 'next';
    return 'lyr';
  }
  function mpPaneDraw() {
    if (!MP.pc) return;
    var v = mpVid(), tab = mpTabNow();
    [].forEach.call(MP.pills.children, function (b) { b.classList.toggle('on', b.getAttribute('data-t') === tab); });
    var sig = tab + '|' + v + '|' + (tab === 'next' ? QU.items.slice(0, 5).map(function (q) { return q.id; }).join(',') + mpRepeatMode() : tab === 'lyr' ? (MP.lpData ? 'y' : MP.lpDone ? 'n' : '?') : (MIXC.vid === v && MIXC.list ? 'm' : '') + (MPX.vid === v && MPX.data ? 'd' : ''));
    if (sig === MP.paneSig) return;
    MP.paneSig = sig;
    MP.lp.hidden = tab !== 'lyr'; MP.pv.hidden = tab === 'lyr'; MP.pe.hidden = true;
    if (tab === 'next') {
      var nx = QU.items.slice(0, 5);
      if (!nx.length) { recClear(MP.pv); mpPaneEmpty('list', '마지막 곡이에요', mpRepeatMode() === 'all' ? '끝나면 처음 곡부터 다시 들어요' : '‘비슷한 곡’에서 이어 들을 곡을 골라 보세요'); return; }
      mpRowsOf(nx, mpPlayNow);
    } else if (tab === 'lyr') {
      if (MP.lpData) { lpDraw(); return; }
      MP.lp.hidden = true;
      if (S().musicLyrics === false && !MP.lpDone) { mpPaneEmpty('lyric', '가사 미리보기가 꺼져 있어요', '설정 → 뮤직 → 가사 미리보기'); return; }
      mpPaneEmpty('lyric', MP.lpDone ? '이 곡은 아직 가사가 없어요' : '가사를 찾는 중…', MP.lpDone ? '가사가 올라오면 여기에 보여요' : '');
    } else if (tab === 'sim') {
      if (MIXC.vid === v && MIXC.list) { if (!MIXC.list.length) { recClear(MP.pv); mpPaneEmpty('mix', '비슷한 곡을 찾지 못했어요', ''); return; } mpRowsOf(MIXC.list.slice(0, 5), mpPlayNow); return; }
      recClear(MP.pv); mpPaneEmpty('mix', '비슷한 곡을 찾는 중…', '');
      mpMixList(v).then(function () { MP.paneSig = ''; mpPaneDraw(); }, function () { if (mpTabNow() === 'sim') mpPaneEmpty('mix', '비슷한 곡을 받지 못했어요', ''); });
    } else if (tab === 'info') {
      if (MPX.vid === v && MPX.data) {
        var d = MPX.data; recClear(MP.pv);
        var facts = G.el('div', { 'class': 'pxf' }); d.facts.slice(0, 3).forEach(function (f) { facts.appendChild(G.el('div', {}, [G.el('b', { text: f[0] }), G.el('span', { text: f[1] })])); });
        MP.pv.appendChild(facts);
        if (d.desc) { var p = G.el('p', { 'class': 'pdesc', text: d.desc }); MP.pv.appendChild(p); }
        var more = G.el('button', { type: 'button', 'class': 'pmore', text: '자세히 보기' });
        more.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); mpInfoPanel(); }, true);
        MP.pv.appendChild(more);
        return;
      }
      recClear(MP.pv); mpPaneEmpty('info', '곡 정보를 받는 중…', '');
      mpNextData(v).then(function (d) { MPX.data = d; MP.paneSig = ''; mpPaneDraw(); }, function () { if (mpTabNow() === 'info') mpPaneEmpty('info', '곡 정보를 받지 못했어요', ''); });
    }
  }
  // ---- 곡 정보 · 댓글: 가사 창과 같은 전체 창 (유튜브 next 응답에서) ----
  var MPX = { vid: '', data: null, p: null };
  function mpNextData(v) {
    if (MPX.vid === v && MPX.p) return MPX.p;
    MPX.vid = v; MPX.data = null;
    MPX.p = yti('next', { videoId: v }).then(function (j) {
      var d = { facts: [], desc: '', ctok: null, date: '' };
      (function walk(o, depth) {
        if (!o || typeof o !== 'object' || depth > 30) return;
        if (o.factoidRenderer) { var fv = recText(o.factoidRenderer.value), fl = recText(o.factoidRenderer.label); if (fv && !d.facts.some(function (f) { return f[1] === fl; })) d.facts.push([fv, fl]); }
        if (o.attributedDescriptionBodyText && !d.desc) d.desc = recText(o.attributedDescriptionBodyText);
        if (o.continuationCommand && !d.ctok && /^Eg0S/.test(o.continuationCommand.token || '')) d.ctok = o.continuationCommand.token;
        if (o.contextualInfo && !d.ccount) d.ccount = recText(o.contextualInfo);
        for (var k in o) walk(o[k], depth + 1);
      })(j, 0);
      return d;
    }, function (e) { MPX.p = null; throw e; });
    return MPX.p;
  }
  function mpPanel(title, sub) {
    lyClose();
    var body = G.el('div', { 'class': 'lyb px' }, [G.el('div', { 'class': 'lyn', text: '불러오는 중…' })]);
    var close = G.el('button', { type: 'button', 'class': 'ib', 'aria-label': '닫기' }, [G.el('i', { style: '-webkit-mask-image:url("' + gmIcon('down') + '")' })]);
    close.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); lyClose(); }, true);
    LY.el = G.el('div', { 'class': 'ly', 'data-glide': 'music' }, [G.el('div', { 'class': 'lyh' }, [G.el('div', {}, [G.el('b', { text: title }), G.el('span', { text: sub || '' })]), close]), body]);
    LY.vid = mpVid(); LY.lines = null;
    MP.el.appendChild(LY.el);
    lastGeom = ''; reportGeom();
    return body;
  }
  function mpInfoPanel() {
    var v = mpVid(), info = mpInfo(v), body = mpPanel(info.title || '곡 정보', info.artist || '');
    mpNextData(v).then(function (d) {
      if (LY.vid !== v || !LY.el) return;
      recClear(body);
      var facts = G.el('div', { 'class': 'pxf' });
      d.facts.forEach(function (f) { facts.appendChild(G.el('div', {}, [G.el('b', { text: f[0] }), G.el('span', { text: f[1] })])); });
      body.appendChild(facts);
      if (d.desc) body.appendChild(G.el('pre', { 'class': 'pxd', text: d.desc }));
    }, function () { recClear(body); body.appendChild(G.el('div', { 'class': 'lyn', text: '정보를 받지 못했어요' })); });
  }
  // ---- 댓글 창 (2026-11-23 사용자: "좋아요 옆 댓글, 누르면 아래 창에 노래 댓글만, 모션은 유튜브 앱처럼") ----
  // 유튜브 앱: 영상(여기선 앨범) 바로 아래부터 화면 끝까지 올라오는 창, 뒤는 어둡게 하지 않음. 손잡이·머리를 끌면 손가락을 따라 내려가고
  // 빠르게 내리거나 4분의 1 넘게 내리면 닫힘, 아니면 제자리. 목록이 맨 위일 때 아래로 끌어도 같음. 정렬 인기순·최신순(첫 쪽 토큰의 정렬 값 csFlip)
  var CMS = null;
  function mpCmCount(v) {
    if (!MP.cmT) return;
    MP.cmT.textContent = '댓글';
    mpNextData(v).then(function (d) { if (mpVid() === v && d.ccount) MP.cmT.textContent = d.ccount; }, function () { /* ignore */ });
  }
  function mpCmClose(fast) {
    var c = CMS; if (!c) return; CMS = null;
    lastGeom = ''; G.setTimeout.call(W, reportGeom, 0);
    var el = c.el;
    el.style.transition = 'transform ' + (fast ? 150 : 220) + 'ms cubic-bezier(.4,0,1,1)';
    el.style.transform = 'translateY(100%)';
    G.setTimeout.call(W, function () { el.remove(); }, 260);
  }
  function mpCmTok(tok, vid, sort) {
    if (sort !== 'new') return tok;
    var old = CS.vid; CS.vid = vid;
    try { return csFlip(tok) || tok; } catch (e) { return tok; } finally { CS.vid = old; }
  }
  function mpComments() {
    if (CMS) { mpCmClose(); return; }
    lyClose(); if (MP.sl) mpSleepClose();
    var v = mpVid();
    // 앨범 바로 아래부터 (너무 낮거나 높으면 화면의 30~48% 지점)
    var H = MP.el.clientHeight || innerHeight, ar = MP.art.getBoundingClientRect(), er = MP.el.getBoundingClientRect();
    var top = Math.round(Math.min(H * 0.48, Math.max(H * 0.3, ar.bottom - er.top)));
    var cnt = G.el('span', { text: '' });
    var close = G.el('button', { type: 'button', 'class': 'cmx', 'aria-label': '닫기' }, [G.el('i')]);
    close.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); mpCmClose(); }, true);
    var head = G.el('div', { 'class': 'cmhd' }, [G.el('div', { 'class': 'cmg' }), G.el('div', { 'class': 'cmt' }, [G.el('b', { text: '댓글' }), cnt, close])]);
    var sortBar = G.el('div', { 'class': 'cmso' });
    var body = G.el('div', { 'class': 'cmbd' });
    var el = G.el('div', { 'class': 'cms', 'data-glide': 'music', role: 'dialog', style: 'top:' + top + 'px' }, [head, sortBar, body]);
    var c = CMS = { el: el, body: body, vid: v, sort: 'top', more: null, busy: false, gen: 0 };
    var note = function (t) { recClear(body); body.appendChild(G.el('div', { 'class': 'cmn', text: t })); };
    var row = function (cr) {
      var th = cr.authorThumbnail && cr.authorThumbnail.thumbnails, img = th && th.length ? th[0].url : '';
      var p = G.el('p', { text: recText(cr.contentText) });
      p.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); p.classList.toggle('open'); }, true);
      var likes = recText(cr.voteCount), reps = cr.replyCount ? String(cr.replyCount) : '';
      return G.el('div', { 'class': 'cmr' }, [G.el('img', { src: recUrl(img), alt: '', loading: 'lazy' }), G.el('div', {}, [
        G.el('small', { text: recText(cr.authorText) + ' · ' + recText(cr.publishedTimeText) }), p,
        G.el('div', { 'class': 'cmf' }, [G.el('i'), G.el('span', { text: likes || '' })])])]);
    };
    // 답글 (2026-11-26 사용자: 음악 댓글에서 답글이 안 보임): 댓글 아래 '답글 N개 ⌄' → 그 자리에 펼침, 더 있으면 '답글 더보기', 다시 누르면 접힘 (유튜브 앱처럼)
    var repTok = function (o) { var m = o && JSON.stringify(o).match(/"(?:token|continuation)":"([^"]+)"/); return m ? m[1] : null; };
    var thread = function (th) {
      var cr = th.comment && th.comment.commentRenderer; if (!cr) return null;
      var wrap = G.el('div', { 'class': 'cmth' }, [row(cr)]);
      var tok = repTok(th.replies), n = cr.replyCount ? String(cr.replyCount) : '';
      if (!tok) return wrap;
      var box = G.el('div', { 'class': 'cmrp', hidden: '' }), got = false, more = null, busy = false;
      var label = '답글 ' + (n ? n + '개' : '보기');
      var btn = G.el('button', { type: 'button', 'class': 'cmrb' }, [G.el('i'), G.el('span', { text: label })]);
      var fetchRep = function (t, moreBtn) {
        if (busy) return; busy = true;
        var ld = G.el('div', { 'class': 'cmrl', text: '불러오는 중…' }); box.appendChild(ld);
        yti('next', { continuation: t }).then(function (j) {
          busy = false; ld.remove(); if (moreBtn) moreBtn.remove(); more = null;
          if (CMS !== c) return;
          var k = 0;
          (function walk(o, depth) {
            if (!o || typeof o !== 'object' || depth > 30) return;
            if (o.commentRenderer) { box.appendChild(row(o.commentRenderer)); k++; return; }
            if (o.continuationItemRenderer) { more = repTok(o.continuationItemRenderer); return; }
            for (var key in o) walk(o[key], depth + 1);
          })(j, 0);
          if (!k && !box.querySelector('.cmr')) box.appendChild(G.el('div', { 'class': 'cmrl', text: '답글을 받지 못했어요' }));
          if (more) {
            var mb = G.el('button', { type: 'button', 'class': 'cmrb' }, [G.el('i'), G.el('span', { text: '답글 더보기' })]);
            var mt = more;
            mb.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); fetchRep(mt, mb); }, true);
            box.appendChild(mb);
          }
        }, function () { busy = false; ld.textContent = '답글을 받지 못했어요'; });
      };
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' });
        var open = box.hidden;
        box.hidden = !open; btn.classList.toggle('open', open);
        btn.lastChild.textContent = open ? '답글 숨기기' : label;
        if (open && !got) { got = true; fetchRep(tok, null); }
      }, true);
      wrap.appendChild(btn); wrap.appendChild(box);
      return wrap;
    };
    var load = function (tok, first) {
      if (!tok || c.busy) return; c.busy = true;
      var gen = c.gen;
      yti('next', { continuation: first ? mpCmTok(tok, v, c.sort) : tok }).then(function (j) {
        c.busy = false;
        if (CMS !== c || gen !== c.gen) return;
        if (first) recClear(body);
        var n = 0; c.more = null;
        (function walk(o, depth) {
          if (!o || typeof o !== 'object' || depth > 30) return;
          if (o.commentThreadRenderer) { var tw = thread(o.commentThreadRenderer); if (tw) { body.appendChild(tw); n++; } return; }
          if (o.commentRenderer) { body.appendChild(row(o.commentRenderer)); n++; return; }
          if (o.continuationItemRenderer) { var ce = JSON.stringify(o.continuationItemRenderer).match(/"token":"([^"]+)"/); if (ce) c.more = ce[1]; return; }
          for (var k in o) walk(o[k], depth + 1);
        })(j, 0);
        if (first && !n) note('댓글이 없거나 꺼져 있어요');
      }, function () { c.busy = false; if (CMS === c && first) note('댓글을 받지 못했어요'); });
    };
    var start = function () {
      c.gen++; c.busy = false; c.more = null; body.scrollTop = 0;
      note('불러오는 중…');
      mpNextData(v).then(function (d) {
        if (CMS !== c) return;
        cnt.textContent = d.ccount || '';
        if (d.ctok) load(d.ctok, true); else note('댓글이 없거나 꺼져 있어요');
      }, function () { if (CMS === c) note('댓글을 받지 못했어요'); });
    };
    [['top', '인기순'], ['new', '최신순']].forEach(function (o) {
      var bt = G.el('button', { type: 'button', 'aria-pressed': String(o[0] === 'top'), text: o[1] });
      bt.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (c.sort === o[0]) return;
        G.send('haptic', { kind: 'gesture' });
        c.sort = o[0];
        [].forEach.call(sortBar.children, function (x) { x.setAttribute('aria-pressed', String(x === bt)); });
        start();
      }, true);
      sortBar.appendChild(bt);
    });
    body.addEventListener('scroll', function () { if (c.more && body.scrollTop + body.clientHeight > body.scrollHeight - 500) load(c.more, false); }, { passive: true });
    // 끌어서 닫기 (유튜브 앱처럼 손가락을 따라감)
    var y0 = null, dy = 0, drag = false, fromBody = false, lastY = 0, lastT = 0, vel = 0;
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { y0 = null; return; }
      fromBody = !!(e.target.closest && e.target.closest('.cmbd'));
      if (fromBody && body.scrollTop > 0) { y0 = null; return; }
      if (e.target.closest && e.target.closest('.cmso, .cmx')) { y0 = null; return; }
      y0 = lastY = e.touches[0].clientY; lastT = Date.now(); dy = 0; drag = false; vel = 0;
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      if (y0 === null) return;
      var y = e.touches[0].clientY, d = y - y0, now = Date.now();
      if (!drag) {
        if (fromBody && d < 0) { y0 = null; return; } // 위로 = 목록 스크롤
        if (Math.abs(d) < 6) return;
        drag = true; el.style.transition = 'none';
      }
      if (e.cancelable) e.preventDefault();
      dy = Math.max(0, d);
      if (now > lastT) { vel = (y - lastY) / (now - lastT); lastY = y; lastT = now; }
      el.style.transform = 'translateY(' + dy + 'px)';
    }, { passive: false });
    var end = function () {
      if (y0 === null) return;
      y0 = null;
      if (!drag) return;
      drag = false;
      var h = el.offsetHeight || 1;
      if (dy > h * 0.25 || vel > 0.6) {
        CMS = null; lastGeom = ''; G.setTimeout.call(W, reportGeom, 0);
        var ms = Math.max(120, Math.min(260, (h - dy) / Math.max(vel, 1.2)));
        el.style.transition = 'transform ' + Math.round(ms) + 'ms cubic-bezier(.2,0,.4,1)';
        el.style.transform = 'translateY(' + (h + 20) + 'px)';
        G.setTimeout.call(W, function () { el.remove(); }, ms + 40);
      } else {
        el.style.transition = 'transform 220ms cubic-bezier(.2,0,0,1)';
        el.style.transform = 'translateY(0)';
      }
    };
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
    MP.el.appendChild(el);
    // 아래에서 올라옴 (약 0.28초 감속)
    el.style.transform = 'translateY(100%)';
    void el.offsetHeight;
    el.style.transition = 'transform 280ms cubic-bezier(.2,0,0,1)';
    el.style.transform = 'translateY(0)';
    lastGeom = ''; reportGeom();
    start();
  }
  // ---- 가사 미리보기: 곡이 바뀌면 가사를 찾아 둠(LRCLIB, 이 폰에 보관), 시간 가사는 앞·지금·다음 줄 ----
  function lpLoad(vid) {
    if (MP.lpVid === vid) return;
    MP.lpVid = vid; MP.lpData = null; MP.lpDone = false; MP.paneSig = '';
    lpDraw();
    if (S().musicLyrics === false) return;
    var c = lyCacheGet(vid);
    if (c) { MP.lpData = c.none ? null : c; MP.lpDone = true; lpDraw(); mpPaneDraw(); return; }
    var v = mpVideo(), dur = v && isFinite(v.duration) ? v.duration : 0;
    G.setTimeout.call(W, function () {
      if (MP.lpVid !== vid) return;
      var vv = mpVideo(), d2 = vv && isFinite(vv.duration) ? vv.duration : dur;
      lyFetch(mpInfo(vid), d2).then(function (r) { lyCacheSet(vid, r || { none: true }); if (MP.lpVid === vid) { MP.lpData = r; MP.lpDone = true; lpDraw(); mpPaneDraw(); } }, function () { if (MP.lpVid === vid) { MP.lpDone = true; mpPaneDraw(); } });
    }, 1500); // 곡 길이를 알 때까지 잠깐 기다림 (같은 제목의 다른 곡을 고르지 않게)
  }
  function lpDraw() {
    if (!MP.lp) return;
    var ps = MP.lp.children, d = MP.lpData, i;
    // 칸이 넉넉하면 앞뒤 두 줄씩 (5줄), 좁으면 3줄
    MP.lp.classList.toggle('tall', MP.lp.clientHeight > 230);
    if (!d) { MP.lp.classList.add('empty'); for (i = 0; i < 5; i++) ps[i].textContent = ''; return; }
    MP.lp.classList.remove('empty');
    var lines = d.lines || (d.lines = lyParse(d.synced));
    if (!lines) { var pl = String(d.plain || '').split('\n').filter(function (x) { return x.trim(); }); for (i = 0; i < 5; i++) ps[i].textContent = pl[i] || ''; MP.lp.classList.add('plain'); return; }
    MP.lp.classList.remove('plain');
    var v = mpVideo(), t = (v ? v.currentTime : 0) + 0.25, k = -1;
    for (i = 0; i < lines.length; i++) { if (lines[i].t <= t) k = i; else break; }
    if (k === MP.lpK && ps[2].textContent) return;
    MP.lpK = k;
    var txt = function (n) { return n >= 0 && n < lines.length ? (lines[n].x || '♪') : ''; };
    var c = k < 0 ? 0 : k;
    for (i = 0; i < 5; i++) ps[i].textContent = txt(c - 2 + i);
    if (k < 0) { ps[0].textContent = ''; ps[1].textContent = ''; }
    ps[2].classList.toggle('dim', k < 0);
    MP.lp.classList.remove('roll'); void MP.lp.offsetWidth; MP.lp.classList.add('roll');
  }
  function gmToastPlayer(text) { try { hint(text, 2200); } catch (e) { /* ignore */ } }
  function mpVideo() { if (LM.el) return LM.el; var p = mainPlayer(); return p && p.querySelector('video'); }
  function mpFmt(t) { return sbFmt(t || 0); }
  function mpDraw(t, d) {
    var f = d > 0 ? Math.max(0, Math.min(1, t / d)) : 0;
    MP.fi.style.width = (f * 100) + '%'; MP.kn.style.left = (f * 100) + '%';
    MP.t1.textContent = mpFmt(t); MP.t2.textContent = d > 0 ? mpFmt(d) : '';
  }
  // 반복 설정은 세션과 따로 기억 (세션을 지워도 사용자가 고른 반복은 남게 — 독립 검토 반영)
  function mpRepeatMode() { var r = gmLsGet('glide:gmRepeat'); return r === 'one' || r === 'off' ? r : 'all'; }
  function mpRepeat() {
    var cur = mpRepeatMode(), next = cur === 'all' ? 'one' : cur === 'one' ? 'off' : 'all';
    gmLsSet('glide:gmRepeat', next);
    gmToastPlayer(next === 'all' ? '전체 반복' : next === 'one' ? '한 곡 반복' : '반복 안 함');
    mpTick(); mpMediaPoke();
  }
  function mpShuffle() {
    var s = mpSession(); if (!s) return;
    s.shuffle = !s.shuffle;
    var cur = mpVid();
    // 남은 곡(대기열)을 섞거나 원래 순서로
    var rest = QU.items.slice();
    if (s.shuffle) rest = gmShuffle(rest);
    else {
      var order = (s.orig || s.items).map(function (x) { return x.id; });
      var pos = function (x) { var i = order.indexOf(x.id); return i < 0 ? 1e6 + rest.indexOf(x) : i; };
      rest.sort(function (a, b) { return pos(a) - pos(b); });
    }
    gmLsSet(GM_KEY, s);
    gmQSend('queueSet', { items: rest });
    gmToastPlayer(s.shuffle ? '셔플 켜짐' : '셔플 꺼짐');
    mpTick();
  }
  function mpNext() {
    if (QU.items.length) { quAdvance('음악 다음'); return; }
    var s = mpSession(); if (!s || !s.items.length) return;
    // 마지막 곡: 전체 반복이면 처음부터, 아니면 그대로 (독립 검토 반영)
    if (mpRepeatMode() !== 'all') { gmToastPlayer('마지막 곡이에요'); return; }
    var cur = mpVid(), first = s.items[0];
    s.played = []; gmLsSet(GM_KEY, s);
    gmQSend('queueSet', { items: s.items.slice(1).map(function (x) { return { id: x.id, title: x.title, ch: x.artist }; }) });
    if (first.id !== cur) navigateTo('/watch?v=' + first.id + '&glide_music=1');
    else if (LM.el) { LM.el.currentTime = 0; LM.el.play().catch(function () {}); }
    else { var p = mainPlayer(), v = mpVideo(); if (p && v) loopBack(p, v); } // 한 곡짜리 세션: 끝나서 멈춘 영상을 다시 재생
  }
  function mpPrev() {
    var v = mpVideo();
    if (v && v.currentTime > 3) { v.currentTime = 0; return; }
    var s = mpSession(); if (!s) return;
    // 이전 곡 = 실제로 들은 순서에서 앞 곡 (셔플을 바꿔도 맞게). 지금 곡은 대기열 맨 앞으로, 이전 곡은 대기열에서 뺌 (독립 검토 반영)
    var cur = mpVid(), pl = (s.played || []).slice();
    if (pl.length && pl[pl.length - 1] === cur) pl.pop();
    var prev = pl.pop();
    if (!prev) { if (v) v.currentTime = 0; return; }
    s.played = pl; gmLsSet(GM_KEY, s);
    var now = mpInfo(cur);
    gmQSend('queueSet', { items: [{ id: cur, title: now.title, ch: now.artist }].concat(QU.items.filter(function (x) { return x.id !== prev && x.id !== cur; })) });
    navigateTo('/watch?v=' + prev + '&glide_music=1');
  }
  // ---- 곡 위치 지키기 (음악만, 2026-11-23 사용자: "잘 듣다가 앱에 들어가면 가끔 노래가 처음으로") ----
  // 페이지를 새로 불러오거나(렌더러 재시작·테마·복구) 유튜브가 같은 곡을 다시 받으면(emptied·loadstart) 위치가 0이 됨.
  // 음악은 이어보기 위치를 쓰지 않아(기록 분리) 그대로 처음부터 재생됐음 → 마지막 위치를 기억해 두었다가 그 경우에만 되돌림.
  // 사용자가 처음으로 돌린 것(이전 버튼·반복·진행 막대)은 다시 받기 신호가 없어서 건드리지 않음. 곡 끝 근처·광고 중은 제외
  var GM_POS = 'glide:gmPos';
  var MPG = { vid: '', t: 0, saveAt: 0, el: null, doc: {}, back: 0, from: 0, until: 0 };
  function mpgAd() { var p = mainPlayer(); return !!(p && p.classList && p.classList.contains('ad-showing')); }
  function mpgSeek(t) {
    if (LM.el) { try { LM.el.currentTime = t; } catch (e) { /* ignore */ } return; }
    var p = mainPlayer();
    try { if (p && p.seekTo) p.seekTo(t, true); else { var v = p && p.querySelector('video'); if (v) v.currentTime = t; } } catch (e) { /* ignore */ }
  }
  function mpgTick(on) {
    if (!on) return;
    var vid = mpVid(), v = mpVideo();
    if (!vid || !v) return;
    if (MPG.el !== v) {
      MPG.el = v;
      ['emptied', 'loadstart'].forEach(function (t) {
        v.addEventListener(t, function () { if (MPG.vid && MPG.vid === mpVid() && MPG.t > 5) { MPG.back = Date.now(); MPG.from = MPG.t; MPG.until = Date.now() + 15000; } });
      });
    }
    var t = v.currentTime || 0, d = isFinite(v.duration) ? v.duration : 0, now = Date.now();
    if (MPG.vid !== vid) {
      MPG.vid = vid; MPG.t = 0; MPG.until = 0;
      // 이 페이지에서 처음 보는 곡인데 방금(20분 안) 듣던 곡이면 = 페이지를 새로 불러온 것 → 그 위치로
      if (!MPG.doc[vid]) {
        MPG.doc[vid] = 1;
        var sp = gmLsGet(GM_POS);
        if (sp && sp.vid === vid && now - sp.at < 20 * 60000 && sp.t > 5 && (!sp.d || sp.t < sp.d - 5)) { MPG.from = sp.t; MPG.until = now + 25000; }
      }
    }
    if (MPG.until) {
      if (now > MPG.until) MPG.until = 0;
      else if (!mpgAd() && d > 0 && t < 3 && MPG.from < d - 3) {
        MPG.until = 0;
        mpgSeek(MPG.from);
        log('info', '곡이 처음으로 돌아가 들던 자리로 되돌림 (' + Math.round(MPG.from) + '초) [' + vid + ']');
        return;
      } else if (t >= 3 && Math.abs(t - MPG.from) < 4) MPG.until = 0; // 이미 그 자리
    }
    if (!v.paused && !mpgAd() && t > 0) {
      MPG.t = t;
      if (now - MPG.saveAt > 2000) { MPG.saveAt = now; gmLsSet(GM_POS, { vid: vid, t: Math.floor(t), d: Math.floor(d), at: now }); }
    }
  }
  function mpTick() {
    try { lmSync(); } catch (e) { /* ignore */ }
    var on = mpIsMusic();
    try { mpgTick(on); } catch (e) { /* ignore */ }
    var h = document.documentElement;
    if (h) { if (on) h.setAttribute('data-glide-music', ''); else h.removeAttribute('data-glide-music'); }
    if (on !== MP.on) { MP.on = on; MP.showVideo = false; mpMediaPoke(); }
    var mvNow = !!(h && mpVid() && h.getAttribute('data-glide-mv') === mpVid() && mpSession());
    var appOn = on || mvNow; // 뮤직비디오 보기: 음악 세션 안의 곡이면 앱에는 계속 음악
    if (appOn !== MP.sentOn) { MP.sentOn = appOn; G.send('musicMode', { on: appOn }); } // 페이지가 새로 떠도 한 번은 알림
    // (음악·동영상 대기열은 앱이 따로 저장 — 예전의 '음악이 아닌 영상을 열면 음악 대기열 비우기'는 필요 없어 뺌, 2026-11-23)
    // 한 곡 반복 = 기존 반복 재생(LP). 화면이 안 보일 때(작은 창·전체화면·영상 보기)도 곡이 바뀌면 다시 걸고, 앱 빠른 메뉴의 반복 표시도 맞춤.
    // 같은 곡에서 사용자가 빠른 메뉴로 반복을 끄면 다시 켜지 않음 (독립 검토 반영)
    var rep0 = mpRepeatMode(), cur0 = mpVid();
    if (on && rep0 === 'one' && MP.lpVid !== cur0) { LP.on = true; LP.vid = cur0; LP.music = true; MP.lpVid = cur0; loopReport(); }
    if ((!on || rep0 !== 'one') && LP.music) { LP.music = false; MP.lpVid = ''; if (LP.on) { LP.on = false; loopReport(); } }
    // 들은 순서 기록 (이전 곡)
    if (on && cur0) { var sp = mpSession(); if (sp) { sp.played = sp.played || []; if (sp.played[sp.played.length - 1] !== cur0) { sp.played.push(cur0); sp.played = sp.played.slice(-200); gmLsSet(GM_KEY, sp); } } }
    var pip = h.classList.contains('glide-pip');
    var show = on && !MP.showVideo && !inFull() && !pip;
    if (!show) { if (MP.el && !MP.el.hidden) { MP.el.hidden = true; reportGeom(); } if (on && MP.showVideo && !inFull() && !pip) mpVideoBack(); else if (MP.back) { MP.back.remove(); MP.back = null; } return; }
    if (MP.back) { MP.back.remove(); MP.back = null; }
    mpBuild();
    MP.el.hidden = false;
    // 앨범 칸 = 플레이어 자리(작은 플레이어로 줄었을 때 이 칸이 보임)
    var area = playerArea(), r = area ? area.getBoundingClientRect() : null;
    var ph = r && r.height > 40 ? r.height : innerWidth * 9 / 16, big = true;
    // 아래 칸들(제목·버튼·조작·도구 줄 ≈ 500px)이 들어갈 만큼만 키움 — 화면이 짧으면 영상 칸 크기 그대로
    var ratio = MP.imgRatio || 16 / 9, bh, iw, ih;
    if (big) { iw = innerWidth - 48; ih = iw / ratio; var maxH = Math.max(120, innerHeight - 500); if (ih > maxH) { ih = maxH; iw = ih * ratio; } bh = Math.max(ph, ih + 64); }
    else { bh = ph; ih = ph * 0.84; iw = ih * ratio; if (iw > innerWidth * 0.84) { iw = innerWidth * 0.84; ih = iw / ratio; } }
    MP.art.style.height = bh + 'px';
    MP.el.classList.toggle('big', big);
    MP.img.style.width = Math.round(iw) + 'px'; MP.img.style.height = Math.round(ih) + 'px';
    reportGeom(); // 앨범 그림 자리 = 작은 플레이어에 보일 칸 (바뀌었을 때만 실제로 보냄)
    var v = mpVid();
    if (v !== MP.vid) {
      MP.vid = v;
      if (LY.el) lyClose();
      if (CMS) mpCmClose(true);
      mpCmCount(v);
      lpLoad(v);
      mpLikeLoad(v);
      mpLikeDraw();
      var info = mpInfo(v);
      MP.title.textContent = info.title || ''; MP.artist.textContent = info.artist || '';
      // 4:3 그림(hqdefault)은 위아래 검은 띠 → 16:9 큰 그림(maxres, 없으면 mq)을 정사각형으로 잘라 씀
      MP.img.onload = function () { if (MP.img.naturalWidth > 0) { MP.imgRatio = MP.img.naturalWidth / MP.img.naturalHeight; try { mpTick(); } catch (e) { /* ignore */ } } };
      MP.img.onerror = function () { if (MP.img.src.indexOf('mqdefault') < 0) MP.img.src = 'https://i.ytimg.com/vi/' + v + '/mqdefault.jpg'; };
      MP.img.src = 'https://i.ytimg.com/vi/' + v + '/maxresdefault.jpg';
      MP.bg.style.backgroundImage = 'url("https://i.ytimg.com/vi/' + v + '/mqdefault.jpg")';
      gmRecentAdd(info);
    }
    var s = mpSession(), rep = mpRepeatMode();
    if (LM.el) { lmQuiet(); LM.el.loop = rep === 'one'; }
    if (MP.vbtn) MP.vbtn.hidden = !!LM.el;
    if (MP.local) MP.local.hidden = !LM.el;
    var slab = mpSleepLabel(); MP.slt.textContent = slab ? '☾ ' + slab : ''; MP.moon.classList.toggle('on', !!slab);
    if (MP.saver) { var md = gmLsGet(GM_DATA), mb = (md && md.m === gmMonth() ? md.b || 0 : 0) + MCD.b; var ln = md && md.m === gmMonth() ? md.local || 0 : 0; MP.saver.textContent = LM.el ? '저장된 곡으로 재생 · 이번 달 데이터 없이 ' + ln + '번 · 음악 데이터 ' + gmMb(mb) : '데이터 절약 · 소리는 원래 음질, 영상 144p · 이번 달 음악 데이터 ' + gmMb(mb); }
    MP.shuf.classList.toggle('on', !!(s && s.shuffle));
    MP.rep.classList.toggle('on', rep !== 'off');
    MP.rep.firstChild.style.webkitMaskImage = 'url("' + gmIcon('repeat') + '")';
    MP.rep.setAttribute('aria-label', rep === 'one' ? '한 곡 반복' : rep === 'all' ? '전체 반복' : '반복 안 함');
    if (rep === 'one') { if (!MP.rep.querySelector('.one')) MP.rep.appendChild(G.el('span', { 'class': 'one', text: '1' })); } else { var o = MP.rep.querySelector('.one'); if (o) o.remove(); }
    var vv = mpVideo();
    if (vv && !MP.drag) mpDraw(vv.currentTime, vv.duration);
    MP.play.firstChild.style.webkitMaskImage = 'url("' + gmIcon(vv && !vv.paused ? 'pause' : 'play') + '")';
    mpPaneDraw();
    // 가운데에 '다음 곡' 목록이 보이면 아래 줄은 재생목록 전체 (같은 곡을 두 번 보여 주지 않게)
    if (MP.nx.firstChild) MP.nx.firstChild.textContent = mpTabNow() === 'next' && QU.items.length ? '재생목록' : '다음 곡';
    if (mpTabNow() === 'next' && QU.items.length) MP.nextTitle.textContent = '전체 보기 · ' + QU.items.length + '곡'; else MP.nextTitle.textContent = QU.items.length ? koShow(QU.items[0].title || '', QU.items[0].ch) + (QU.items[0].ch ? ' · ' + QU.items[0].ch : '') : (rep === 'all' && s ? '처음 곡부터 다시' : '마지막 곡이에요');
  }
  // ---- 들은 기록 (통계·자동 재생목록용, 이 폰에만): 실제로 30초 또는 곡의 절반을 들으면 한 번. 다시 처음부터 들으면 또 한 번 ----
  function mpLog() {
    var vv = mpVideo(), v = mpVid();
    if (!MP.on || !vv || !v) return;
    var now = Date.now(), ct = vv.currentTime || 0;
    if (MP.logVid !== v) { mpLogSave(); MP.logVid = v; MP.heard = 0; MP.logIdx = -1; MP.lct = ct; MP.lwall = now; return; }
    var dct = ct - (MP.lct || 0), dw = (now - (MP.lwall || now)) / 1000;
    MP.lct = ct; MP.lwall = now;
    if (dct < -5) { mpLogSave(); MP.heard = 0; MP.logIdx = -1; return; } // 처음으로 돌아감(한 곡 반복 등) = 새로 들음
    if (vv.paused || dct <= 0 || dct > Math.max(5, dw * 2 + 1)) return; // 멈춤·건너뛰기는 세지 않음
    MP.heard += dct;
    var d = isFinite(vv.duration) ? vv.duration : 0;
    if (MP.logIdx < 0 && (MP.heard >= 30 || (d > 0 && MP.heard >= d * 0.5))) {
      var info = mpInfo(v), lg = gmLsGet(GM_LOG) || [];
      lg.push({ id: v, t: info.title || '', a: info.artist || '', at: now, s: Math.round(MP.heard), d: Math.round(d) });
      if (lg.length > 3000) lg = lg.slice(-3000);
      gmLsSet(GM_LOG, lg); MP.logIdx = 1; MP.logSaved = now; MP.logAt = now;
    } else if (MP.logIdx > 0 && now - MP.logSaved > 30000) mpLogSave();
  }
  function mpLogSave() {
    if (!(MP.logIdx > 0)) return;
    var lg = gmLsGet(GM_LOG) || [], last = lg[lg.length - 1];
    if (last && last.id === MP.logVid && last.at === MP.logAt) { last.s = Math.round(MP.heard); gmLsSet(GM_LOG, lg); }
    MP.logSaved = Date.now();
  }
  // ---- 음악 데이터 사용량 (이번 달, 플레이어에 들어간 소리·영상 바이트) ----
  var MCD = { b: 0, t: 0 };
  function mcDataAdd(n) {
    MCD.b += n;
    var now = Date.now();
    if (now - MCD.t > 10000) mcDataFlush();
  }
  function mcDataFlush() {
    MCD.t = Date.now();
    if (!MCD.b) return;
    var m = gmMonth(), d = gmLsGet(GM_DATA);
    if (!d || d.m !== m) d = { m: m, b: 0 };
    d.b += MCD.b; MCD.b = 0; gmLsSet(GM_DATA, d);
  }
  W.addEventListener('pagehide', function () { try { mcDataFlush(); mpLogSave(); } catch (e) { /* ignore */ } });
  // ---- 수면 타이머 (음악): 앱의 수면 타이머를 씀(화면이 꺼져도 앱이 멈춤). 끝나기 15초 전부터 소리를 서서히 줄임 ----
  MP.sleep = { mode: 'off', until: 0 };
  G.onCommand('sleepState', function (a) {
    MP.sleep = { mode: (a && a.mode) || 'off', until: (a && +a.until) || 0 };
    if (MP.sleep.mode !== 'minutes') mpFadeReset();
    try { mpTick(); } catch (e) { /* ignore */ }
  });
  function mpFadeReset() { var v = mpVideo(); if (MP.fadeFrom != null && v) { var f = MP.fadeFrom; MP.fadeFrom = null; G.setTimeout.call(W, function () { try { v.volume = f; } catch (e) { /* ignore */ } }, 600); } }
  function mpFade() {
    if (MP.sleep.mode !== 'minutes' || !MP.sleep.until) return;
    var v = mpVideo(); if (!v) return;
    var left = MP.sleep.until - Date.now();
    if (left > 15000) return;
    if (MP.fadeFrom == null) MP.fadeFrom = v.volume;
    try { v.volume = Math.max(0.02, MP.fadeFrom * Math.max(0, left) / 15000); } catch (e) { /* ignore */ }
  }
  function mpSleepLabel() {
    var s = MP.sleep;
    if (s.mode === 'end') return '이 곡이 끝나면 멈춰요';
    if (s.mode === 'minutes' && s.until > Date.now()) { var m = Math.ceil((s.until - Date.now()) / 60000); return m + '분 뒤 멈춰요'; }
    return '';
  }
  function mpSleepSheet() {
    if (MP.sl) { mpSleepClose(); return; }
    var opts = [[-1, '이 곡이 끝나면'], [15, '15분'], [30, '30분'], [60, '1시간'], [0, '끄기']];
    var box = G.el('div', { 'class': 'sl', 'data-glide': 'music' }, [G.el('div', { 'class': 'slg' }), G.el('h3', { text: '수면 타이머' }), G.el('p', { text: mpSleepLabel() || '정한 때에 소리를 서서히 줄이며 멈춰요' })]);
    opts.forEach(function (o) {
      var on = (o[0] === -1 && MP.sleep.mode === 'end') || (o[0] === 0 && MP.sleep.mode === 'off');
      var b = G.el('button', { type: 'button', 'class': on ? 'on' : '', text: o[1] });
      b.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' });
        G.send('sleepSet', { min: o[0] });
        MP.sleep = o[0] === 0 ? { mode: 'off', until: 0 } : o[0] === -1 ? { mode: 'end', until: 0 } : { mode: 'minutes', until: Date.now() + o[0] * 60000 };
        if (o[0] === 0) mpFadeReset();
        gmToastPlayer(o[0] === 0 ? '수면 타이머 끔' : o[0] === -1 ? '이 곡이 끝나면 멈춰요' : o[1] + ' 뒤 멈춰요');
        mpSleepClose(); mpTick();
      }, true);
      box.appendChild(b);
    });
    var scrim = G.el('div', { 'class': 'sls', 'data-glide': 'music' });
    scrim.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); mpSleepClose(); }, true);
    MP.sl = { box: box, scrim: scrim };
    MP.el.appendChild(scrim); MP.el.appendChild(box);
    lastGeom = ''; reportGeom();
  }
  function mpSleepClose() {
    var s = MP.sl; if (!s) return; MP.sl = null;
    lastGeom = ''; G.setTimeout.call(W, reportGeom, 0);
    s.box.classList.add('out'); s.scrim.classList.add('out');
    G.setTimeout.call(W, function () { s.box.remove(); s.scrim.remove(); }, 200);
  }
  // ---- 저장된 곡 재생 (데이터 0): 앱이 '이 곡은 저장돼 있음'(localState)이라고 알려 주면 유튜브 영상 대신 폰의 파일을 소리 요소로 재생.
  //  유튜브 영상·소리 받기는 앱이 막음(MusicCache.localVid). 알림·잠금화면·이어폰 조작과 상태 알림은 코어 setLocalMedia 로 이쪽이 맡음 ----
  var LM = { want: null, vid: null, el: null, at: 0 };
  G.onCommand('localState', function (a) {
    LM.want = (a && a.vid) || null;
    var n = 0;
    (function wait() { try { lmSync(); } catch (e) { /* ignore */ } if (LM.want && !LM.el && n++ < 60) G.setTimeout.call(W, wait, 50); })();
  });
  function lmSync() {
    var cur = mpVid();
    if (LM.el && (LM.vid !== cur || LM.want !== cur)) {
      var same = LM.vid === cur, at1 = LM.el.currentTime || 0;
      lmStop();
      // 같은 곡을 유튜브로 이어 들음: 막아 두었던 유튜브 영상은 0초에 멈춰 있음 → 듣던 자리로 옮김
      if (same && at1 > 3) { try { var p1 = mainPlayer(); if (p1 && p1.seekTo) p1.seekTo(at1, true); } catch (e) { /* ignore */ } MPG.from = at1; MPG.until = Date.now() + 15000; }
    }
    if (!LM.el && LM.want && LM.want === cur && role() === 'player' && onWatch()) lmStart(cur);
  }
  var LOUD_KEY = 'glide:gmLoud';
  function lmLoudSave() {
    var v = mpVid(); if (!v || LM.el || MP.loudVid === v) return;
    var p = mainPlayer(), pr = null; try { pr = p && p.getPlayerResponse && p.getPlayerResponse(); } catch (e) { /* ignore */ }
    var vd = null; try { vd = p && p.getVideoData && p.getVideoData(); } catch (e) { /* ignore */ }
    var ac = pr && pr.playerConfig && pr.playerConfig.audioConfig;
    if (!ac || typeof ac.loudnessDb !== 'number' || !vd || vd.video_id !== v) return;
    MP.loudVid = v;
    var m = gmLsGet(LOUD_KEY) || {}; m[v] = Math.round(ac.loudnessDb * 100) / 100;
    var ks = Object.keys(m); if (ks.length > 3000) ks.slice(0, ks.length - 3000).forEach(function (k) { delete m[k]; });
    gmLsSet(LOUD_KEY, m);
  }
  function lmGain(vid) { var m = gmLsGet(LOUD_KEY) || {}, db = m[vid]; return typeof db === 'number' && db > 0 ? Math.pow(10, -db / 20) : 1; }
  // 다음 곡이 저장돼 있으면 미리 읽어 둠 (곡 사이 끊김 줄이기). 저장 안 된 곡은 앱이 404
  function lmPrefetch() {
    var a = LM.el, n = QU.items[0];
    if (!a || !n || !isFinite(a.duration) || a.duration - a.currentTime > 20 || (LM.pre && LM.pre.vid === n.id) || LM.preTry === n.id) return;
    LM.preTry = n.id;
    fetch('/glide-local/' + n.id + '.m4a').then(function (r) { return r.ok ? r.blob() : null; }).then(function (b) {
      if (!b) return;
      if (LM.pre && LM.pre.url) URL.revokeObjectURL(LM.pre.url);
      LM.pre = { vid: n.id, url: URL.createObjectURL(b) };
    }).catch(function () {});
  }
  function lmStart(vid) {
    // 유튜브로 이미 듣던 중에 저장된 곡으로 넘어가면 그 자리부터 (위치 지키기가 옮겨 줌)
    try { var yv = mainPlayer() && mainPlayer().querySelector('video'); if (yv && yv.currentTime > 3 && mpVid() === vid) { MPG.from = yv.currentTime; MPG.until = Date.now() + 15000; } } catch (e) { /* ignore */ }
    var a = document.createElement('audio');
    a.setAttribute('data-glide', 'music'); a.preload = 'auto'; a.style.display = 'none';
    // 웹뷰의 소리 요소는 앱이 가로채 주는 주소를 직접 받지 못함(폰 확인: 계속 불러오는 중) → fetch 로 받아 페이지 안 주소(blob)로 재생
    var pre = LM.pre && LM.pre.vid === vid ? LM.pre : null; LM.pre = null;
    (pre ? Promise.resolve(null) : fetch('/glide-local/' + vid + '.m4a').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })).then(function (b) {
      if (LM.el !== a) { if (pre) URL.revokeObjectURL(pre.url); return; }
      LM.url = pre ? pre.url : URL.createObjectURL(b);
      a.volume = lmGain(vid); // 유튜브와 같은 음량 맞춤 (큰 곡은 줄임)
      a.src = LM.url;
      var pl = a.play(); if (pl && pl.catch) pl.catch(function () {});
    }).catch(function (e) { if (LM.el === a) a.dispatchEvent(new Event('error')); log('warn', '저장된 곡 파일 읽기 실패: ' + e.message); });
    LM.el = a; LM.vid = vid; LM.at = Date.now();
    (document.body || document.documentElement).appendChild(a);
    document.documentElement.setAttribute('data-glide-local', '');
    ['playing', 'pause', 'loadedmetadata', 'seeked', 'durationchange', 'ratechange'].forEach(function (t) { a.addEventListener(t, function () { lmReport(); }); });
    a.addEventListener('ended', lmEnded);
    a.addEventListener('error', function () {
      log('warn', '저장된 곡 재생 실패 [' + vid + '] → 유튜브로 재생');
      var at0 = Math.floor(a.currentTime || 0);
      G.send('musicLocalEnd', { vid: vid }); LM.want = null; lmStop();
      try { var p = mainPlayer(); if (p && p.loadVideoById) p.loadVideoById(vid, at0 > 3 ? at0 : 0); } catch (e) { /* ignore */ } // 듣던 자리부터 (예전엔 처음부터)
    });
    G.setLocalMedia(lmCmd);
    lmQuiet();
    a.loop = mpRepeatMode() === 'one';
    log('info', '저장된 곡으로 재생 (데이터 없이) [' + vid + ']');
    // 실제로 재생이 시작돼야 '데이터 없이 들은 곡'으로 셈
    a.addEventListener('playing', function once() { a.removeEventListener('playing', once); var sv = gmLsGet('glide:gmData') || {}, m = gmMonth(); if (sv.m !== m) sv = { m: m, b: 0 }; sv.local = (sv.local || 0) + 1; gmLsSet('glide:gmData', sv); });
  }
  function lmStop() {
    var a = LM.el; if (!a) return;
    LM.el = null; LM.vid = null;
    try { a.pause(); a.removeAttribute('src'); a.load(); a.remove(); } catch (e) { /* ignore */ }
    if (LM.url) { try { URL.revokeObjectURL(LM.url); } catch (e) { /* ignore */ } LM.url = null; }
    document.documentElement.removeAttribute('data-glide-local');
    G.setLocalMedia(null);
    var v = mainPlayer() && mainPlayer().querySelector('video'); if (v && v.muted && LM.mutedYt) { v.muted = false; LM.mutedYt = false; }
  }
  // 막아 둔 유튜브 영상이 소리를 내거나 상태를 알리지 않게
  function lmQuiet() {
    var p = mainPlayer(), v = p && p.querySelector('video');
    if (v && !v.muted) { v.muted = true; LM.mutedYt = true; }
    if (v && !v.paused) { try { v.pause(); } catch (e) { /* ignore */ } }
  }
  function lmReport() {
    var a = LM.el; if (!a) return;
    var info = mpInfo(LM.vid);
    G.send('media', { main: true, muted: false, state: a.paused ? 'paused' : 'playing', ad: false, duration: isFinite(a.duration) ? a.duration : 0, position: a.currentTime || 0, rate: a.playbackRate || 1, w: 0, h: 0,
      videoId: LM.vid, title: info.title || '', artist: String(info.artist || '').replace(/\s*-\s*Topic$/i, ''), artwork: 'https://i.ytimg.com/vi/' + LM.vid + '/hqdefault.jpg',
      music: (mpMediaMeta(LM.vid) || {}).music || { repeat: mpRepeatMode(), liked: false } });
  }
  function lmEnded() {
    var a = LM.el; if (!a) return;
    if (MP.sleep && MP.sleep.mode === 'end') { G.send('sleep', { mode: null, until: 0, fired: true }); lmReport(); return; } // 수면 타이머 '이 곡 끝나면'
    if (mpRepeatMode() === 'one') { a.currentTime = 0; a.play().catch(function () {}); return; }
    if (QU.items.length) { quAdvance('음악 다음'); return; }
    if (mpRepeatMode() === 'all') { mpNext(); return; }
    lmReport();
  }
  // 알림·잠금화면·이어폰 조작 (true = 이쪽에서 처리함)
  function lmCmd(cmd, arg) {
    var a = LM.el; if (!a) return false;
    switch (cmd) {
      case 'play': a.play().catch(function () {}); return true;
      case 'pause': a.pause(); return true;
      case 'toggle': if (a.paused) a.play().catch(function () {}); else a.pause(); return true;
      case 'seek': if (typeof arg === 'number') a.currentTime = arg; return true;
      case 'seekBy': if (typeof arg === 'number') a.currentTime = Math.max(0, Math.min((a.duration || 1e9) - 0.5, a.currentTime + arg)); return true;
      case 'next': if (QU.items.length) quAdvance('다음 버튼'); else mpNext(); return true;
      case 'prev': mpPrev(); return true;
      case 'status': lmReport(); return true;
    }
    return false;
  }
  // ---- 가사 (재생 화면 '가사' 버튼): 공개 가사 서비스 LRCLIB(lrclib.net)에서 제목·가수로 찾음 (누를 때만, 받은 가사는 이 폰에 보관).
  //  시간이 맞춰진 가사면 지금 줄을 밝히고 따라 내려감, 줄을 누르면 그 위치로. 유튜브 뮤직 가사는 로그인 없이 받지 못해(어떤 곡도 '가사가 제공되지 않음') 쓰지 않음 ----
  var LY = { el: null, vid: '', lines: null, cur: -1, user: 0 };
  var LY_KEY = 'glide:gmLyr';
  function lyClean(s) { return String(s || '').replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function lyInner(s) { var m = /\(([^)]+)\)/.exec(String(s || '')); return m ? m[1].trim() : ''; }
  function lyParse(lrc) {
    var out = [];
    String(lrc || '').split('\n').forEach(function (ln) {
      var m = /^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/.exec(ln.trim());
      if (m) out.push({ t: +m[1] * 60 + +m[2], x: m[3].trim() });
    });
    return out.length ? out : null;
  }
  function lyCacheGet(vid) { var c = gmLsGet(LY_KEY) || {}; return c[vid] || null; }
  function lyCacheSet(vid, v) {
    var c = gmLsGet(LY_KEY) || {}; c[vid] = v; v.at = Date.now();
    var ks = Object.keys(c); if (ks.length > 80) ks.sort(function (a, b) { return (c[a].at || 0) - (c[b].at || 0); }).slice(0, ks.length - 80).forEach(function (k) { delete c[k]; });
    gmLsSet(LY_KEY, c);
  }
  function lyFetch(info, dur) {
    var t = lyClean(info.title), a = lyClean(info.artist), a2 = lyInner(info.artist);
    var urls = [
      'https://lrclib.net/api/search?track_name=' + encodeURIComponent(t) + '&artist_name=' + encodeURIComponent(a),
      a2 ? 'https://lrclib.net/api/search?track_name=' + encodeURIComponent(t) + '&artist_name=' + encodeURIComponent(a2) : null,
      'https://lrclib.net/api/search?q=' + encodeURIComponent(t + ' ' + a)
    ].filter(Boolean);
    var pick = function (list) {
      list = (list || []).filter(function (x) { return x && !x.instrumental && (x.syncedLyrics || x.plainLyrics); });
      if (!list.length) return null;
      // 한국어 곡이면 한글 가사 먼저 (같은 곡에 로마자로 옮긴 가사가 따로 올라와 있기도 함 — 폰 확인), 그다음 시간이 맞춰진 가사
      var ko = function (x) { return /[가-힣]/.test(x.syncedLyrics || x.plainLyrics || ''); };
      var wantKo = list.some(ko);
      list.sort(function (x, y) {
        var dx = dur ? Math.abs((x.duration || 0) - dur) : 0, dy = dur ? Math.abs((y.duration || 0) - dur) : 0;
        return (dx > 15) - (dy > 15) || (wantKo ? ko(y) - ko(x) : 0) || (!!y.syncedLyrics - !!x.syncedLyrics) || dx - dy;
      });
      var b = list[0];
      if (dur && Math.abs((b.duration || 0) - dur) > 20) return null; // 길이가 많이 다르면 다른 곡
      return { synced: b.syncedLyrics || '', plain: b.plainLyrics || '', name: b.trackName + ' · ' + b.artistName };
    };
    var i = 0;
    var next = function () {
      if (i >= urls.length) return Promise.resolve(null);
      return fetch(urls[i++], { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (l) { return pick(l) || next(); }, function () { return next(); });
    };
    return next();
  }
  function lyClose() {
    var e = LY.el; if (!e) return; LY.el = null;
    lastGeom = ''; G.setTimeout.call(W, reportGeom, 0);
    e.classList.add('out'); G.setTimeout.call(W, function () { e.remove(); }, 220);
  }
  function lyOpen() {
    if (LY.el) { lyClose(); return; }
    var vid = mpVid(), info = mpInfo(vid), v = mpVideo(), dur = v && isFinite(v.duration) ? v.duration : 0;
    var body = G.el('div', { 'class': 'lyb' }, [G.el('div', { 'class': 'lyn', text: '가사를 찾는 중…' })]);
    var close = G.el('button', { type: 'button', 'class': 'ib', 'aria-label': '가사 닫기' }, [G.el('i', { style: '-webkit-mask-image:url("' + gmIcon('down') + '")' })]);
    close.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); lyClose(); }, true);
    var src = G.el('div', { 'class': 'lys' });
    LY.el = G.el('div', { 'class': 'ly', 'data-glide': 'music' }, [G.el('div', { 'class': 'lyh' }, [G.el('div', {}, [G.el('b', { text: info.title || '' }), G.el('span', { text: info.artist || '' })]), close]), body, src]);
    MP.el.appendChild(LY.el);
    lastGeom = ''; reportGeom();
    body.addEventListener('scroll', function () { if (Date.now() - (LY.prog || 0) > 900) LY.user = Date.now(); }, { passive: true });
    LY.vid = vid; LY.lines = null; LY.cur = -1;
    var show = function (r) {
      if (!LY.el || LY.vid !== vid) return;
      recClear(body);
      if (!r) { body.appendChild(G.el('div', { 'class': 'lyn', text: '이 곡의 가사를 찾지 못했어요' })); return; }
      var lines = lyParse(r.synced);
      if (lines) {
        LY.lines = lines;
        lines.forEach(function (l, k) {
          var d = G.el('p', { text: l.x || '♪' });
          d.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); var vv = mpVideo(); if (vv) { vv.currentTime = l.t; G.send('haptic', { kind: 'gesture' }); LY.user = 0; } }, true);
          body.appendChild(d);
        });
        lyTick(true);
      } else body.appendChild(G.el('pre', { text: r.plain }));
      src.textContent = '가사: LRCLIB' + (lines ? ' · 줄을 누르면 그 부분부터' : '');
    };
    var c = lyCacheGet(vid);
    if (c) { show(c.none ? null : c); return; }
    lyFetch(info, dur).then(function (r) { lyCacheSet(vid, r || { none: true }); show(r); }, function () { show(null); });
  }
  // 지금 부르는 줄 밝히기 (손으로 넘기는 중이면 4초 동안 따라가지 않음)
  function lyTick(jump) {
    if (!LY.el || !LY.lines) return;
    if (LY.vid !== mpVid()) { lyClose(); return; }
    var v = mpVideo(); if (!v) return;
    var t = v.currentTime + 0.25, k = -1;
    for (var i = 0; i < LY.lines.length; i++) { if (LY.lines[i].t <= t) k = i; else break; }
    if (k === LY.cur && !jump) return;
    var ps = LY.el.querySelectorAll('.lyb p');
    if (ps[LY.cur]) ps[LY.cur].classList.remove('on');
    LY.cur = k;
    if (ps[k]) {
      ps[k].classList.add('on');
      if (Date.now() - LY.user > 4000 || jump) { var b = LY.el.querySelector('.lyb'); LY.prog = Date.now(); b.scrollTo({ top: ps[k].offsetTop - b.clientHeight * 0.38, behavior: jump ? 'auto' : 'smooth' }); LY.user = 0; }
    }
  }
  // ---- 재생 화면 '+ 담기': 지금 곡을 플레이리스트에 (새로 만들기 포함) ----
  function mpPlPick() {
    if (MP.sl) { mpSleepClose(); return; }
    var v = mpVid(), info = mpInfo(v), item = { id: v, title: info.title || '', artist: info.artist || '' };
    var box = G.el('div', { 'class': 'sl', 'data-glide': 'music' }, [G.el('div', { 'class': 'slg' }), G.el('h3', { text: '플레이리스트에 담기' }), G.el('p', { text: info.title || '' })]);
    var form = null;
    var nb = G.el('button', { type: 'button', 'class': 'plnew', text: '+ 새 플레이리스트' });
    nb.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (form) return;
      var input = G.el('input', { type: 'text', placeholder: '플레이리스트 이름', maxlength: '40', enterkeyhint: 'done' });
      var ok = G.el('button', { type: 'button', 'class': 'plok', text: '만들고 담기' });
      var done = function () { var n = input.value.trim(); if (!n) { input.focus(); return; } var p = plNew(n); plAdd(p.id, [item]); G.send('haptic', { kind: 'gesture' }); mpSleepClose(); gmToastPlayer(plAddedMsg(p, 1, 1)); };
      ok.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); done(); }, true);
      input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); done(); } });
      form = G.el('div', { 'class': 'plform' }, [input, ok]);
      nb.replaceWith(form);
      G.setTimeout.call(W, function () { try { input.focus(); } catch (x) { /* ignore */ } }, 50);
    }, true);
    box.appendChild(nb);
    plAll().forEach(function (p) {
      var has = p.items.some(function (x) { return x.id === v; });
      var b = G.el('button', { type: 'button', 'class': 'plrow' }, [plCover(p, 40), G.el('span', { text: p.name }), G.el('small', { text: has ? '담김' : p.items.length + '곡' })]);
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.send('haptic', { kind: 'gesture' }); var n = plAdd(p.id, [item]); mpSleepClose(); gmToastPlayer(plAddedMsg(p, n, 1)); }, true);
      box.appendChild(b);
    });
    var scrim = G.el('div', { 'class': 'sls', 'data-glide': 'music' });
    scrim.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); mpSleepClose(); }, true);
    MP.sl = { box: box, scrim: scrim };
    MP.el.appendChild(scrim); MP.el.appendChild(box);
    lastGeom = ''; reportGeom();
  }
  // ---- 뮤직비디오 보기: 이 곡을 음악 모드가 아닌 보통 영상(원래 화질)으로. 다음 곡부터는 다시 음악으로 ----
  function mpMv() {
    var v = mpVid(); if (!v) return;
    document.documentElement.setAttribute('data-glide-mv', v);
    if (LM.el) { G.send('musicLocalEnd', { vid: v }); LM.want = null; lmStop(); }
    MP.showVideo = false;
    try { var p = mainPlayer(); if (p && p.loadVideoById) p.loadVideoById(v, 0); } catch (e) { /* ignore */ }
    log('info', '뮤직비디오 보기 [' + v + ']');
    mpTick();
  }
  // 영상 보기 중: 오른쪽 위 ♪ 버튼으로 음악 화면으로 돌아옴
  function mpVideoBack() {
    if (MP.back && MP.back.isConnected) return;
    MP.back = G.el('button', { type: 'button', 'data-glide': 'music', 'aria-label': '음악 화면', style: 'all:unset;position:fixed;right:12px;top:12px;z-index:2147483600;width:40px;height:40px;border-radius:20px;background:rgba(0,0,0,.55);cursor:pointer;display:flex;align-items:center;justify-content:center' },
      [G.el('i', { style: 'width:22px;height:22px;background-color:#fff;-webkit-mask:url("' + gmIcon('note') + '") center/22px 22px no-repeat' })]);
    MP.back.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); MP.showVideo = false; mpTick(); }, true);
    document.body.appendChild(MP.back);
  }
  // 마지막 곡이 끝남: 전체 반복이면 처음부터 (대기열이 비면 유튜브 자동 재생이 엉뚱한 영상을 틀지 않게)
  document.addEventListener('ended', function (e) {
    if (!(MP.on || MP.sentOn) || QU.items.length || LP.on || LM.el || Date.now() - (QU.advancedAt || 0) < 2000) return;
    var p = mainPlayer();
    if (!p || !p.contains(e.target)) return;
    if (mpRepeatMode() === 'all') mpNext();
    else { try { p.pauseVideo && p.pauseVideo(); } catch (x) { /* ignore */ } }
  }, true);
  ['timeupdate', 'play', 'pause', 'playing', 'durationchange'].forEach(function (t) {
    document.addEventListener(t, function () {
      if (MP.on) { try { if (mpVid() && MP.likeVid !== mpVid()) mpLikeLoad(mpVid()); mpLog(); mpFade(); lyTick(false); lmPrefetch(); lmLoudSave(); if (MP.lpData) lpDraw(); } catch (e) { /* ignore */ } } // 화면이 꺼져 있어도(잠금화면·PIP) 기록·소리 줄이기
      if (MP.on && MP.el && !MP.el.hidden) { try { mpTick(); } catch (e) { /* ignore */ } }
    }, true);
  });
  (function mpLoop() { try { if (role() === 'player') mpTick(); } catch (e) { /* ignore */ } G.setTimeout.call(W, mpLoop, 500); })();
  // ---------------------------------------------------------------- 탭마다 보던 자리 기억 (2026-11-20 사용자: "홈에서 내렸다가 다른 탭에 갔다 다시 홈을 누르면 맨 위로 감 →
  // 보던 화면으로. 홈을 한 번 더 누르면 맨 위로. 나머지 탭도 마찬가지" — 유튜브 앱과 같음)
  // 모바일 유튜브 웹은 탭을 옮겼다 돌아오면 그 화면을 새로 그려 맨 위부터 몇 개만 보여 줌(같은 목록, 폰 CDP 확인), 같은 탭을 다시 누르면 목록을 새로 받으며 맨 위로.
  // → 떠날 때 맨 위에 보이던 영상(ID·화면 위치)과 스크롤을 기억하고, 돌아오면 그 영상이 그려질 때까지 조용히 내려가 같은 자리에 맞춤(그동안 목록은 가림, 최대 4초).
  //   지금 탭을 다시 누르면 새로고침 없이 부드럽게 맨 위로, 이미 맨 위면 유튜브 그대로(새로고침)
  // 모바일 유튜브는 탭 이동 때 yt-navigate-finish 를 안 보내기도 해서(폰 확인) 주소가 바뀌는 것을 직접 지켜봄
  var TABPOS = {};
  // 탭 목록 보관: 모바일 유튜브는 탭을 다시 열면 목록(/youtubei/v1/browse)을 새로 받아 추천 순서가 바뀜(폰 확인 — 뒤로 가기도 같음).
  // 그래서 보던 영상을 못 찾고 목록을 가린 채 기다렸음(사용자: "구독에서 홈으로 갈 때 로딩이 긺"). 둘러보기 웹뷰의 탭 목록 응답을 요청 내용(첫 묶음 browseId, 다음 묶음 continuation)별로
  // 기억했다가, 탭을 눌러 옮긴 직후(TC.until)에만 같은 요청에 그대로 돌려줌 → 같은 목록이 바로 그려지고 보던 영상도 바로 찾음.
  // 지금 탭을 맨 위에서 다시 누르거나(유튜브 새로고침) 당겨서 새로고침하면 새로 받음. 유튜브가 fetch 를 문서 시작 때 잡아 두므로 여기(문서 시작)에서 감쌈
  var TC = { map: {}, keys: [], until: 0, initPath: location.pathname };
  // 보관 목록·위치를 쓰는 시간: 10분 (사용자: 30분이면 홈이 갱신 안 될 수 있음 → 10분. 그 뒤에는 유튜브가 새 목록)
  var TC_MS = 10 * 60e3;
  // 앱을 켠 뒤 처음 그린 탭 목록은 요청이 아니라 페이지에 들어 있음(ytInitialData, 요청 응답과 같은 모양 — 폰 확인) → 그 탭을 처음 떠날 때 같은 열쇠로 보관.
  // 안 하면 앱을 켜고 처음 탭을 오갈 때 유튜브가 홈을 새로 받아 순서가 바뀌어 보던 자리를 못 찾았음
  var TC_INIT = { '/': 'FEwhat_to_watch', '/feed/subscriptions': 'FEsubscriptions' };
  function tcSeedInitial(path) {
    if (path !== TC.initPath || TC.seeded || !TC_INIT[path]) return;
    TC.seeded = true;
    var key = 'b:' + TC_INIT[path] + ':';
    if (TC.map[key]) return;
    try { var d = W.ytInitialData; if (d && typeof d === 'object' && d.contents) { var t = JSON.stringify(d); if (t.length < 5e6) { TC.map[key] = { text: t, t: Date.now() }; TC.keys.push(key); } } } catch (e) { /* ignore */ }
  }
  function tcKey(body) {
    if (typeof body !== 'string' || body.length > 20000) return null;
    var o; try { o = JSON.parse(body); } catch (e) { return null; }
    if (!o || typeof o !== 'object') return null;
    if (o.continuation) return 'c:' + o.continuation;
    if (o.browseId && /^FE/.test(o.browseId)) return 'b:' + o.browseId + ':' + (o.params || '');
    return null;
  }
  // 유튜브는 요청 내용을 gzip 으로 압축해 Uint8Array 로 보냄(폰 네트워크 기록: 1f 8b …) → 풀어서 읽음. 보내는 내용은 그대로
  function tcBodyText(body) {
    try {
      if (typeof body === 'string') return Promise.resolve(body);
      if (W.Blob && body instanceof W.Blob) return body.arrayBuffer().then(function (b) { return tcBodyText(new Uint8Array(b)); });
      var u8 = body instanceof Uint8Array ? body : (body instanceof ArrayBuffer ? new Uint8Array(body) : null);
      if (!u8 || u8.length > 200000) return Promise.resolve(null);
      if (u8[0] === 0x1f && u8[1] === 0x8b) {
        if (!W.DecompressionStream) return Promise.resolve(null);
        return new W.Response(new W.Blob([u8]).stream().pipeThrough(new W.DecompressionStream('gzip'))).text();
      }
      return Promise.resolve(new TextDecoder().decode(u8));
    } catch (e) { return Promise.resolve(null); }
  }
  (function () {
    var prev = W.fetch;
    if (typeof prev !== 'function') return;
    var tcFetch = function fetch(input, init) {
      var args = arguments;
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        // 유튜브는 fetch(new Request(주소, {method:'POST', body})) 로 부름(init 없음, 폰 진단) → Request 복사본에서 내용을 읽음 (원래 요청은 그대로 보냄)
        var src = init && init.body ? Promise.resolve(init.body) : (W.Request && input instanceof W.Request && input.method === 'POST' ? input.clone().arrayBuffer().then(function (b) { return new Uint8Array(b); }) : null);
        if (role() === 'browse' && url.indexOf('/youtubei/v1/browse') !== -1 && src) {
          return src.then(tcBodyText).then(function (text) { return tcKey(text); }, function () { return null; }).then(function (key) {
            var hit = key && TC.map[key], now = Date.now();
            if (hit && now < TC.until && now - hit.t < TC_MS) {
              log('info', '탭 목록: 보관한 목록으로 (' + key.slice(0, 2) + ')');
              var nr = new W.Response(hit.text, { status: 200, headers: { 'content-type': 'application/json; charset=UTF-8' } });
              try { Object.defineProperty(nr, 'url', { value: new URL(url, location.href).href }); } catch (e) { /* ignore */ }
              return nr;
            }
            var pr = prev.apply(W, args);
            if (key) pr.then(function (res) {
              if (!res || !res.ok) return;
              res.clone().text().then(function (t) {
                if (!t || t.length > 5e6) return;
                if (!TC.map[key]) { TC.keys.push(key); if (TC.keys.length > 40) delete TC.map[TC.keys.shift()]; }
                TC.map[key] = { text: t, t: Date.now() };
              }, function () {});
            }, function () {});
            return pr;
          });
        }
      } catch (e) { /* 아래로 */ }
      return prev.apply(W, args);
    };
    try { W.fetch = G.disguise ? G.disguise(tcFetch, prev) : tcFetch; } catch (e) { /* ignore */ }
  })();
  function tabKey() {
    var p = location.pathname;
    return role() === 'browse' && onYT() && (p === '/' || p.indexOf('/feed/') === 0) ? p : null;
  }
  function tabTop() { var h = document.querySelector('ytm-mobile-topbar-renderer'); return h ? Math.max(0, h.getBoundingClientRect().bottom) : 48; }
  function tabAnchor() {
    var top = tabTop() + 4;
    var items = document.querySelectorAll('ytm-rich-item-renderer, ytm-video-with-context-renderer, ytm-compact-video-renderer, ytm-item-section-renderer ytm-compact-link-renderer');
    for (var i = 0; i < items.length; i++) {
      var r = items[i].getBoundingClientRect();
      if (r.height < 40 || r.bottom <= top) continue;
      var a = items[i].querySelector('a[href*="watch?v="]');
      var m = a && /[?&]v=([\w-]{11})/.exec(a.getAttribute('href') || '');
      if (m) return { id: m[1], off: r.top };
    }
    return null;
  }
  function tabFind(id) {
    var as = document.querySelectorAll('a[href*="v=' + id + '"]');
    for (var i = 0; i < as.length; i++) {
      if (as[i].closest('ytm-video-preview, #video-preview-portal')) continue; // 미리보기 플레이어 안의 링크는 아님
      var it = as[i].closest('ytm-rich-item-renderer, ytm-video-with-context-renderer, ytm-compact-video-renderer');
      if (it && it.getBoundingClientRect().height > 0) return it;
    }
    return null;
  }
  var tabRestoring = 0;
  function tabRestoreEnd() { tabRestoring = 0; document.documentElement.classList.remove('glide-tabrestore'); }
  function tabRestore(st) {
    var gen = ++tabRestoring, t0 = Date.now();
    document.documentElement.classList.add('glide-tabrestore');
    (function step() {
      if (gen !== tabRestoring) return;
      var it = st.id && tabFind(st.id);
      if (it) {
        W.scrollBy(0, it.getBoundingClientRect().top - st.off); tabRestoreEnd(); log('info', '탭 위치: 보던 자리로 (' + (Date.now() - t0) + 'ms)');
        // 맞춘 뒤 유튜브가 위쪽을 더 그리면 밀려남 → 잠깐 뒤 다시 확인해 바로잡음 (사용자가 그사이 스크롤하면 그만)
        var y0 = W.scrollY;
        [300, 800, 1500].forEach(function (ms) { G.setTimeout.call(W, function () {
          if (gen !== tabRestoring && tabRestoring !== 0) return;
          if (Math.abs(W.scrollY - y0) > 4) return;
          var again = tabFind(st.id);
          if (again) { var d = again.getBoundingClientRect().top - st.off; if (Math.abs(d) > 24) { W.scrollBy(0, d); y0 = W.scrollY; } }
        }, ms); });
        return;
      }
      var max = document.documentElement.scrollHeight - innerHeight;
      if (Date.now() - t0 > 2500) { if (st.y) W.scrollTo(0, Math.min(st.y, max)); tabRestoreEnd(); log('info', '탭 위치: 보던 영상을 못 찾아 스크롤 위치로'); return; }
      // 목록이 아직 덜 그려졌으면 끝까지 내려 다음 묶음을 그리게 함 (보이지 않게 가린 채)
      if (max > 0) W.scrollTo(0, Math.min(st.y || max, max));
      G.setTimeout.call(W, step, 40); // 유튜브는 아래까지 내려야 다음 묶음을 그림 → 자주 내려 빨리 그리게
    })();
  }
  var tabWatch = 0;
  function tabWatchFrom(from) {
    var gen = ++tabWatch, t0 = Date.now();
    (function look() {
      if (gen !== tabWatch || Date.now() - t0 > 6000) return;
      var k = tabKey();
      if (location.pathname !== from) { try { updateHideWatched(); } catch (e) { /* ignore */ } }
      if (location.pathname !== from && k) {
        var st = TABPOS[k];
        if (st && Date.now() - st.t < TC_MS && (st.y > 50 || st.id)) { G.setTimeout.call(W, function () { tabRestore(st); }, 60); }
        return;
      }
      G.setTimeout.call(W, look, 50);
    })();
  }
  // window 캡처: 추천 화면 닫기(document 캡처)보다 먼저 봄 — 추천 화면이 열려 있으면 '같은 탭'이 아님
  W.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest || role() !== 'browse' || !S().enabled || !onYT()) return;
    var item = t.closest('ytm-pivot-bar-item-renderer');
    if (!item) return;
    var cur = tabKey();
    var sel = item.querySelector('[aria-selected="true"]');
    if (sel && !REC.open && cur) {
      // 지금 탭을 다시 누름: 내려가 있으면 새로고침 없이 맨 위로, 이미 맨 위면 유튜브 그대로(새로고침)
      delete TABPOS[cur];
      if ((W.scrollY || 0) > 10) { stopAll(e); tabRestoreEnd(); W.scrollTo({ top: 0, behavior: 'smooth' }); }
      else TC.until = 0; // 맨 위에서 다시 누름 = 유튜브 새로고침: 보관 목록을 쓰지 않음
      return;
    }
    if (cur && !REC.open) { TABPOS[cur] = { y: W.scrollY || 0, t: Date.now(), id: (tabAnchor() || {}).id, off: (tabAnchor() || {}).off }; tcSeedInitial(cur); }
    tabRestoreEnd();
    TC.until = Date.now() + 8000; // 옮긴 탭의 목록(첫 묶음·보던 자리까지의 다음 묶음)은 보관한 것으로
    tabWatchFrom(location.pathname);
  }, true);

  // 홈·구독·내 페이지 탭, 상단 로고를 누르면 추천 화면을 닫음 (그 화면으로)
  document.addEventListener('click', function (e) {
    if (!REC.open || !e.target || !e.target.closest) return;
    if (e.target.closest('ytm-pivot-bar-item-renderer, .mobile-topbar-header-endpoint, header button.topbar-button-search-button')) recClose();
  }, true);
  // 영상 웹뷰: 많이 본 영상 알림 (영상 길이의 60% 또는 10분 넘게 봄, 영상마다 한 번) → 추천 탭의 '본 영상과 비슷'
  var recSent = '';
  document.addEventListener('timeupdate', function (e) {
    if (role() !== 'player' || !onWatch() || !S().enabled) return;
    var v = e.target, p = mainPlayer();
    if (!p || !v || !p.contains(v) || G.inAd() || document.documentElement.hasAttribute('data-glide-capture')) return; // 저장(16배속) 중은 본 것이 아님 (전수조사 반영)
    if (MP.on || (G.musicNow && G.musicNow())) return; // 음악은 동영상 추천 학습에 넣지 않음
    var d = v.duration;
    if (!isFinite(d) || d < 90 || v.currentTime < Math.min(d * 0.6, 600)) return;
    var vd = null;
    try { vd = p.getVideoData && p.getVideoData(); } catch (x) { /* ignore */ }
    var id = (vd && vd.video_id) || new URLSearchParams(location.search).get('v');
    if (!id || recSent === id) return;
    recSent = id;
    G.send('recWatched', { videoId: id, title: (vd && vd.title) || document.title.replace(/ - YouTube$/, ''), channel: (vd && vd.author) || '' });
  }, true);

  // ---- 댓글 창을 유튜브 앱처럼 (2026-11-25 폴드2 비교) ----
  //  앱: '@이름 • 7년 전' 한 줄, ⋮는 이름 줄 오른쪽 위, 답글 줄은 '답글 742개 ›'(말풍선 옆 숫자 없음). 웹: 시간이 오른쪽 끝, ⋮는 버튼 줄, '답글 더보기'.
  //  유튜브 요소의 글자는 바꾸지 않고(다시 그려도 깨지지 않게) data-glide-rc 값 + CSS 로 겉모습만
  (function () {
    var st = G.el('style', { 'data-glide': 'cm-app' });
    st.textContent = 'ytm-engagement-panel .YtmCommentRendererHeader{justify-content:flex-start!important;padding-right:30px}' +
      'ytm-engagement-panel .YtmCommentRendererPublishedTime{margin-left:0!important;flex:none}ytm-engagement-panel .YtmCommentRendererPublishedTime::before{content:"\\00a0\\2022\\00a0"}' +
      'ytm-engagement-panel .YtmCommentRendererContent{position:relative!important}ytm-engagement-panel .YtmCommentRendererMenu{position:absolute!important;top:-10px;right:-8px}' +
      'ytm-engagement-panel .YtmCommentRendererIcons:nth-of-type(3) .YtmCommentRendererCount{display:none}' +
      'ytm-engagement-panel [data-glide-rc]{font-size:0!important}ytm-engagement-panel [data-glide-rc]::before{content:attr(data-glide-rc);font-size:14px;font-weight:500}' +
      'ytm-engagement-panel [data-glide-rc]::after{content:"";display:inline-block;width:6px;height:6px;margin-left:7px;border:solid currentColor;border-width:0 1.6px 1.6px 0;transform:translateY(-2px) rotate(-45deg);font-size:14px}';
    var mountSt = function () { var p = document.head || document.documentElement; if (p && st.parentNode !== p) p.appendChild(st); };
    mountSt(); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountSt, { once: true });
    function cmLabels() {
      var ths = document.querySelectorAll('ytm-engagement-panel ytm-comment-thread-renderer');
      for (var i = 0; i < ths.length; i++) {
        var th = ths[i], rr = th.querySelector('ytm-comment-replies-renderer');
        if (!rr) continue;
        var span = rr.querySelector(':scope > ytm-continuation-item-renderer button .ytAttributedStringHost');
        var opened = rr.querySelector('ytm-comment-renderer');
        if (!span) continue;
        if (opened) { if (span.hasAttribute('data-glide-rc')) span.removeAttribute('data-glide-rc'); continue; }
        var cnt = th.querySelector(':scope > ytm-comment-renderer .YtmCommentRendererIcons:nth-of-type(3) .YtmCommentRendererCount');
        var n = cnt && cnt.textContent.trim();
        var label = n ? '답글 ' + n + '개' : '답글 보기';
        if (span.getAttribute('data-glide-rc') !== label) span.setAttribute('data-glide-rc', label);
      }
    }
    (function tick() { try { if (role() === 'player' && S().enabled && document.querySelector('ytm-engagement-panel ytm-comment-thread-renderer')) { mountSt(); cmLabels(); } } catch (e) { /* ignore */ } G.setTimeout.call(W, tick, 500); })();
  })();

  // ---- 댓글·설명의 타임스탬프 (같은 영상): 유튜브 앱처럼 그 시간으로 바로 (2026-11-25 사용자) ----
  // 모바일 웹은 누르면 조작부(어두운 막)+로딩 동그라미를 띄웠다 지워 화면이 한 번 깜빡였음 → 클릭을 가로채 플레이어만 옮김. 창(댓글·설명)은 그대로
  function tsSecs(t) {
    if (!t) return -1;
    if (/^\d+s?$/.test(t)) return parseInt(t, 10);
    var m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
    return m && (m[1] || m[2] || m[3]) ? (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) : -1;
  }
  document.addEventListener('click', function (e) {
    if (role() !== 'player' || !onWatch() || !S().enabled || !e.isTrusted) return;
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var u; try { u = new URL(a.getAttribute('href'), location.href); } catch (x) { return; }
    var here = new URLSearchParams(location.search).get('v');
    if (u.pathname !== '/watch' || !here || u.searchParams.get('v') !== here) return;
    var t = tsSecs(u.searchParams.get('t'));
    var p = mainPlayer(), v = p && p.querySelector('video');
    if (t < 0 || !v || G.inAd()) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (isFinite(v.duration) && v.duration > 0) t = Math.min(t, v.duration - 0.5);
    // 받아 오는 동안 유튜브가 띄우는 조작부·로딩 동그라미를 감춤(두 번 탭과 같은 방식) → 다시 재생되면 유튜브가 직접 닫게 함
    document.documentElement.classList.add('glide-dt-on');
    if (DT.ctlTimer) G.clearTimeout.call(W, DT.ctlTimer);
    DT.ctlTimer = G.setTimeout.call(W, dtEndControls, 3000);
    var done = function () { v.removeEventListener('playing', done); v.removeEventListener('seeked', done); if (DT.ctlTimer) G.clearTimeout.call(W, DT.ctlTimer); DT.ctlTimer = G.setTimeout.call(W, dtEndControls, 250); };
    v.addEventListener('playing', done); v.addEventListener('seeked', done);
    v.currentTime = t;
    if (v.paused) v.play().catch(function () {});
    G.send('haptic', { kind: 'gesture' });
    log('info', '타임스탬프 → ' + t + '초 (조작부·깜빡임 없이)');
  }, true);

  // ---- 자막: 유튜브 앱처럼 사용자가 직접 켠 때만 ----
  // 모바일 웹은 계정의 '항상 자막 표시'(PREF f6, 서버가 되돌림)를 따라 영상마다 자막을 저절로 켜고, 한국어 자막이 없으면
  // 목록 첫 번째(예: 독일어)를 골랐음. 같은 계정의 유튜브 앱은 꺼져 있음 (폴드2 실기, 2026-11-25).
  // 사용자가 자막 버튼·설정 메뉴로 바꾼 상태만 기억(glide-cc-user)하고, 기억이 '켬'이 아니면 저절로 켜진 자막을 끔. 음악은 건드리지 않음
  var CC_KEY = 'glide-cc-user', CC = { userAt: 0 };
  function ccPref(v) { try { if (v === undefined) return localStorage.getItem(CC_KEY); localStorage.setItem(CC_KEY, v); } catch (e) { /* ignore */ } return null; }
  function ccOn(p) { try { var t = p.getOption('captions', 'track'); return !!(t && t.languageCode); } catch (e) { return false; } }
  document.addEventListener('click', function (e) {
    if (!e.isTrusted || role() !== 'player' || !onWatch()) return;
    var p = mainPlayer();
    if (!p) return;
    var before = ccOn(p);
    CC.userAt = Date.now();
    setTimeout(function () {
      var after = ccOn(p);
      if (after !== before) { ccPref(after ? '1' : '0'); log('info', '자막: 사용자가 ' + (after ? '켬' : '끔')); }
    }, 700);
  }, true);
  function ccCheck() {
    if (role() !== 'player' || !onWatch() || !S().enabled || MP.on || ccPref() === '1') return;
    if (Date.now() - CC.userAt < 1500) return; // 사용자가 방금 누른 것과 다투지 않음
    var p = mainPlayer();
    if (!p || !ccOn(p)) return;
    try { p.setOption('captions', 'track', {}); } catch (e) { return; }
    log('info', '자막: 켜지 않았는데 유튜브가 켬 → 끔 (유튜브 앱과 같게)');
  }
  ['loadeddata', 'playing'].forEach(function (ev) {
    document.addEventListener(ev, function () { ccCheck(); setTimeout(ccCheck, 800); setTimeout(ccCheck, 2500); }, true);
  });
})();
