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
      pullBlockers: a.pullBlockers || ["ytm-engagement-panel", "bottom-sheet-container", "yt-sheet-view-model", "ytm-bottom-sheet-renderer", "dialog[open]", "tp-yt-paper-dialog", "ytm-search[open]", ".mobile-topbar-header[data-mode=searching]"],
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

  // ===========================================================================
  // 스타일 (버튼, PIP, 확대, 안내 문구)
  // ===========================================================================
  var BTN = 'glide-header-button', ANIM = 'glide-x-header';
  var LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 108 108'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%232F4BF0'/%3E%3Cstop offset='1' stop-color='%231A2BA8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='108' height='108' rx='30' fill='url%28%23g%29'/%3E%3Cg fill='none' stroke-linecap='round' stroke-linejoin='round' stroke-width='12'%3E%3Cpath d='M30 32L50 54L30 76' stroke='%237D8FFF'/%3E%3Cpath d='M56 32L76 54L56 76' stroke='%23DDF46A'/%3E%3C/g%3E%3C/svg%3E";
  var LOCK_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='5' y='11' width='14' height='10' rx='2'/%3E%3Cpath d='M8 11V8a4 4 0 0 1 8 0v3'/%3E%3C/svg%3E";
  var SUN_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='12' cy='12' r='4'/%3E%3Cpath d='M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'/%3E%3C/svg%3E";
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
    css += '#glide-bright-btn{all:unset;position:fixed;left:16px;top:50%;width:44px;height:44px;margin-top:-22px;border-radius:22px;z-index:2147483647;pointer-events:auto;cursor:pointer;' +
      'background:rgba(0,0,0,.55) url("' + SUN_ICON + '") center/22px 22px no-repeat;-webkit-tap-highlight-color:transparent}#glide-bright-btn.with-lock{margin-top:-78px}#glide-bright-btn[hidden]{display:none}\n';
    css += '#glide-bright-bar{position:fixed;left:72px;top:50%;width:40px;height:150px;margin-top:-75px;border-radius:20px;z-index:2147483647;pointer-events:auto;touch-action:none;background:rgba(0,0,0,.55);overflow:hidden}' +
      '#glide-bright-bar[hidden]{display:none}#glide-bright-bar>i{position:absolute;left:0;right:0;bottom:0;background:rgba(255,255,255,.9);pointer-events:none}' +
      '#glide-bright-bar>b{position:absolute;left:0;right:0;bottom:8px;height:20px;background:url("' + SUN_ICON + '") center/18px 18px no-repeat;filter:invert(.6);pointer-events:none}\n';
    css += '[data-glide-fb]{display:none!important}\n';
    css += 'html.glide-pip #glide-bright-btn,html.glide-pip #glide-bright-bar{display:none!important}\n';
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
    css += 'html.glide-owner ytm-slim-video-action-bar-renderer{position:relative!important}' +
      'html.glide-owner ytm-slim-video-action-bar-renderer a.slim-video-owner-icon{display:block!important;position:absolute!important;left:12px!important;top:-40px!important;width:32px!important;height:32px!important;min-width:0!important;margin:0!important;padding:0!important;z-index:1!important}' +
      'html.glide-owner ytm-slim-video-action-bar-renderer a.slim-video-owner-icon *{width:32px!important;height:32px!important}#glide-owner .gw-ch img{visibility:hidden}' +
      'html.glide-owner ytm-slim-video-action-bar-renderer .slim-subscribe-button{display:none!important}' +
      '#glide-owner{display:flex;align-items:center;gap:12px;padding:6px 12px 4px 12px}' +
      '#glide-owner .gw-ch{display:flex;align-items:center;gap:12px;min-width:0;flex:1;text-decoration:none;color:inherit}' +
      '#glide-owner .gw-ch img{width:32px;height:32px;border-radius:50%;flex:none;object-fit:cover;background:rgba(128,128,128,.2)}' +
      '#glide-owner .gw-ch b{font:600 14px/1.3 Roboto,"Noto Sans KR",sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}' +
      '#glide-owner .gw-ch span{font:400 12px/1.3 Roboto,"Noto Sans KR",sans-serif;opacity:.6;white-space:nowrap;flex:none}' +
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
      '#glide-csort{display:flex;gap:8px;padding:2px 16px 12px}' +
      '#glide-csort button{all:unset;box-sizing:border-box;pointer-events:auto;height:32px;padding:0 12px;border-radius:8px;font:500 14px/32px Roboto,"Noto Sans KR",sans-serif;' +
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
      '#glide-qsheet .qr{display:flex;align-items:center;gap:12px;padding:8px 6px 8px 16px;cursor:pointer}#glide-qsheet .qr:active{background:rgba(128,128,128,.12)}' +
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
  function brClose() { BR.open = false; if (BR.bar) BR.bar.hidden = true; if (BR.timer) { G.clearTimeout.call(W, BR.timer); BR.timer = 0; } }
  function brFromY(y) {
    var r = BR.bar.getBoundingClientRect(); if (!r.height) return;
    var v = Math.max(0.01, Math.min(1, (r.bottom - y) / r.height));
    BR.v = v; BR.set = true; brShow(v); G.send('brightness', { v: v }); brArm();
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
        BR.open = true; BR.bar.hidden = false; brShow(BR.v < 0 ? 0.5 : BR.v); G.send('brightness', { v: -2 }); brArm();
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
  function updateBrBtn() {
    if (!inFull() || LK.on) {
      if (BR.btn) BR.btn.hidden = true; brClose();
      if (!inFull() && BR.set) { BR.set = false; BR.v = -1; G.send('brightness', { v: -1 }); }
      return;
    }
    ensureBrEls();
    BR.btn.classList.toggle('with-lock', S().expLock === true);
    BR.btn.hidden = !controlsShown() && !BR.open;
  }
  G.onCommand('brightness', function (arg) { if (arg && typeof arg.v === 'number' && arg.v >= 0) { BR.v = arg.v; if (BR.open) brShow(arg.v); } });
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
    try { fsTitle(); ytFsKeep(); if (inFull()) t = 800; } catch (e) { /* <html> 생기기 전(문서 시작)이면 다음에 */ }
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
      T.fsUp = !edge && !T.sheet && !(e.target && e.target.closest && e.target.closest('[role="slider"], .ytProgressBarLineHost, ytm-progress-bar, .ytm-progress-bar, .ytp-progress-bar-container, .watch-page-progress-bar'));
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
    if (cur && cur.fsUp && !cur.multi && e.changedTouches[0] && Date.now() - cur.t < 900 && inFull()) {
      var ut = e.changedTouches[0], udx = ut.clientX - cur.x, udy = ut.clientY - cur.y;
      // 유튜브도 아래 조작부에서 시작한 위로 밀기에는 스스로 창을 엶 → 같이 누르면 두 번 눌려 닫혔음(실제 사이트). 0.3초 뒤에도 안 열렸을 때만 버튼을 누름
      if (udy < -A.swipeMinPx && Math.abs(udy) > Math.abs(udx) * 1.4) { G.send('haptic', { kind: 'gesture' }); G.setTimeout.call(W, function () { if (!fsPanel()) fsPanelOpen(); else { lastGeom = ''; reportGeom(); } }, 300); log('info', '손동작: 위로 밀기 → 동영상 더보기'); return; }
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
        return r;
      }, orig);
      // 유튜브가 넣던 조각을 취소하면(탐색 등) 덜 받은 부분은 버림
      if (SBp.abort) {
        var origAbort = SBp.abort;
        SBp.abort = G.disguise(function abort() { var i = sbInfo.get(this); if (i) { i.pending = null; i.held = null; } return origAbort.apply(this, arguments); }, origAbort);
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

  function capChunk(sb, data) {
    var info = sbInfo.get(sb);
    if (!info) return;
    if (G.inAd()) { info.pending = null; info.held = null; return; } // 광고 조각은 저장하지 않음
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
      capBox(info, type, buf.subarray(o, o + size));
      if (!CAP || !CAP.active) return;
      o += size;
    }
    info.pending = o < buf.length ? buf.slice(o) : null;
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
  // 채널 줄: 유튜브 앱처럼 [사진 채널 이름 구독자 수 ......... 구독] 한 줄 (모바일 웹은 사진·구독 버튼이 버튼 줄 맨 앞에 끼어 있고 이름이 없음).
  // 유튜브 요소는 옮기지 않고(유튜브가 다시 그리면 깨짐) Glide 줄을 따로 만들어 보여 주고, 원래 사진·구독 버튼은 숨김.
  // 구독 버튼은 유튜브 구독 버튼을 대신 누름(구독 취소 확인 창 등 유튜브 동작 그대로). 글자·상태는 유튜브 버튼을 따라감
  function ensureOwnerRow(bar) {
    var icon = bar.querySelector('a.slim-video-owner-icon'), subWrap = bar.querySelector('.slim-subscribe-button');
    var host = bar.closest('ytm-slim-video-action-bar-renderer');
    var row = document.getElementById('glide-owner');
    if (!icon || !host) { if (row) row.remove(); document.documentElement.classList.remove('glide-owner'); return; }
    // '김치와 마라탕, 구독자 1.46만명. 채널로 이동합니다.' → 이름, 구독자 수 (유튜브 앱은 '1.46만'처럼 짧게)
    var m = /^(.*?),\s*구독자\s*([\d.,]+\s*[천만억]?)\s*명/.exec(icon.getAttribute('aria-label') || '');
    var en = !m && /^(.*?),\s*([\d.,]+[KMB]?)\s*subscribers/i.exec(icon.getAttribute('aria-label') || '');
    var name = m ? m[1] : en ? en[1] : (icon.getAttribute('aria-label') || '').split(',')[0];
    var count = m ? m[2] : en ? en[2] : '';
    var img = icon.querySelector('img'), src = img && img.getAttribute('src');
    var subBtn = subWrap && subWrap.querySelector('button');
    var subText = subBtn ? (subBtn.textContent || '').trim() : '';
    if (!row || row.nextElementSibling !== host) {
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
      host.parentNode.insertBefore(row, host);
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
    if (REC && REC.editor) out.push(REC.editor);
    else if (REC && REC.open && REC.el) out.push(REC.el);
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
  G.onCommand('closeSheet', function () {
    if (QU && QU.sheet) { quSheetClose(); return; }
    if (REC && REC.editor) { recEditorClose(); return; }
    if (REC && REC.open) { recClose(); return; }
    if (fsPanel() && fsPanelClose()) return; // 전체화면 동영상 더보기 창 (닫기 ✕가 창 밖 위 조작부에 있음)
    var open = openSheets();
    // 앱은 닫기를 보내며 '닫힘'으로 바꿔 둠 → 창이 실제로는 안 닫혔으면(답글 화면에서 목록으로만 돌아감 등) 같은 상태라도 다시 알려야 함
    lastGeom = '';
    G.setTimeout.call(W, function () { lastGeom = ''; reportGeom(); }, 450);
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
  var codecs = { video: '' };
  (function codecGuard() {
    var noAv1 = function () { var s = S(); return s.enabled && s.hwAv1 === false; };
    // 오프라인 저장 중에는 폰이 그대로 합칠 수 있는 MP4(H.264 영상 + AAC 소리)만 고르게 함
    var isAv1 = function (t) { return typeof t === 'string' && (/av01/i.test(t) || (!!CAP && /webm|vp0?9|vp8|opus|vorbis|ec-3|ac-3/i.test(t))); };
    try {
      var MS = W.MediaSource;
      if (MS && MS.isTypeSupported) {
        var origIts = MS.isTypeSupported;
        MS.isTypeSupported = G.disguise(function isTypeSupported(t) { if (isAv1(t) && (noAv1() || CAP)) return false; return origIts.apply(this, arguments); }, origIts);
      }
      if (MS && MS.prototype.addSourceBuffer) {
        var origAdd = MS.prototype.addSourceBuffer;
        MS.prototype.addSourceBuffer = G.disguise(function addSourceBuffer(t) {
          if (typeof t === 'string' && /^video\//.test(t)) codecs.video = t.replace(/^video\//, '');
          var sb = origAdd.apply(this, arguments);
          if (typeof t === 'string' && /^(video|audio)\//.test(t)) capTag(sb, t.slice(0, 5));
          return sb;
        }, origAdd);
      }
    } catch (e) { /* ignore */ }
    try {
      var origCpt = HTMLMediaElement.prototype.canPlayType;
      HTMLMediaElement.prototype.canPlayType = G.disguise(function canPlayType(t) { if (isAv1(t) && (noAv1() || CAP)) return ''; return origCpt.apply(this, arguments); }, origCpt);
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
      if (history.length > 1) history.back(); else location.replace(location.origin + '/');
      hiOpen('기록 주소');
      return;
    }
    document.documentElement.classList.remove('glide-hist-away');
    if (!/^\/feed\/(you|library)/.test(p)) return;
    var links = document.querySelectorAll('a[href^="/feed/history"]');
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
  function reportGeom() {
    if (!role()) return;
    var a = role() === 'player' && onWatch() && !inFull() ? playerArea() : null;
    var r = a ? a.getBoundingClientRect() : null;
    var rect = r && r.width > 0 && r.height > 0 ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null;
    var sheet = anySheet();
    var top = ((W.scrollY || (document.scrollingElement && document.scrollingElement.scrollTop) || 0) <= 0);
    // 라이브 채팅 칸: 앱은 이 안에서 아래로 끌어도 영상을 작게 만들지 않음 (지난 채팅을 보려는 손동작). CHAT은 아래에서 선언(첫 호출 때는 아직 없음)
    var chat = null;
    if (CHAT && CHAT.frame && CHAT.frame.isConnected) {
      var fr = CHAT.frame.getBoundingClientRect();
      if (fr.width > 0 && fr.height > 0) chat = [Math.round(fr.left), Math.round(fr.top), Math.round(fr.width), Math.round(fr.height)];
    }
    var sig = JSON.stringify([rect, innerWidth, innerHeight, sheet, top, chat]);
    if (sig === lastGeom) return;
    lastGeom = sig;
    G.send('geom', { rect: rect, iw: innerWidth, ih: innerHeight, sheet: sheet, top: top, chat: chat });
  }
  // 누른 뒤 열리는 창(댓글·설명·메뉴)을 앱이 빨리 알게: 창이 열린 직후 아래로 끌면 창 대신 영상이 작아졌음
  W.addEventListener('click', function () { if (role() === 'player') [350, 900].forEach(function (ms) { G.setTimeout.call(W, reportGeom, ms); }); }, true);
  W.addEventListener('resize', function () { G.setTimeout.call(W, reportGeom, 120); }, true);
  W.addEventListener('yt-navigate-finish', function () { G.setTimeout.call(W, reportGeom, 300); }, true);
  document.addEventListener('touchstart', function () { reportGeom(); }, { capture: true, passive: true });
  // 누른 뒤 유튜브 창(설정 메뉴 등)이 열리면 바로 알림: 앱이 가운데 영상을 풀어 창이 보이게 하고, 뒤로 가기가 그 창부터 닫게
  document.addEventListener('click', function () { if (role() === 'player') { G.setTimeout.call(W, reportGeom, 250); G.setTimeout.call(W, reportGeom, 700); } }, { capture: true, passive: true });
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
  G.onCommand('sheetMode', function (arg) { SHEETMODE = (arg && arg.mode) || ''; G.setTimeout.call(W, ensureLiveChat, 0); if (SHEETMODE !== 'expanded' && QU && QU.sheet) quSheetClose(); });
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
    var bar = wrap.querySelector('#glide-csort');
    if (!bar) { bar = G.el('div', { id: 'glide-csort' }, [csChip('top', '인기순'), csChip('new', '최신순')]); wrap.appendChild(bar); }
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
    if (!info) { if (b) { QU.menuFor = null; var old = document.getElementById('glide-qnext'); if (old) old.remove(); } return; }
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
    if (ic) { var hadIcon = !!ic.querySelector('svg, img'); while (ic.firstChild) ic.removeChild(ic.firstChild); if (hadIcon) ic.appendChild(G.el('i', { 'class': 'glide-qi' })); }
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
    var sc = document.querySelector('ytw-scrim button, ytw-scrim');
    if (sc) sc.click();
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
      [G.el('span', { text: text }), btn]);
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
          own.addEventListener('click', function () { var i = FB.info; FB.info = null; if (i) G.setTimeout.call(W, function () { fbAct(own._glideFb, i); }, 0); }, true);
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
  G.onCommand('queue', function (arg) {
    QU.items = (arg && Array.isArray(arg.items)) ? arg.items.filter(function (x) { return x && /^[\w-]{11}$/.test(x.id || ''); }) : [];
    QU.hold = !!(arg && arg.hold);
    quRow();
    if (QU.sheet) quSheet();
  });
  // 대기열 다음 영상으로 (영상이 끝남·알림/잠금화면의 '다음'). 지금 영상과 같은 항목은 건너뜀
  function quAdvance(why) {
    if (role() !== 'player' || !onWatch() || CAP || G.inAd() || !S().enabled) return false;
    var cur = G.currentVideoId();
    while (QU.items.length && QU.items[0].id === cur) G.send('queuePop', { id: QU.items.shift().id });
    if (!QU.items.length) { quRow(); return false; }
    var n = QU.items.shift();
    log('info', '다음에 재생(' + why + '): 대기열의 다음 영상으로 [' + n.id + '] ' + (n.title || '').slice(0, 40));
    G.send('queuePop', { id: n.id });
    navigateTo('/watch?v=' + n.id);
    quRow();
    return true;
  }
  // 지금 영상이 끝나면 대기열 첫 영상으로. 반복 재생(빠른 배속이면 ended가 실제로 옴)·수면 타이머 '영상 끝나면'은 제외 — 독립 검토 반영
  document.addEventListener('ended', function (e) {
    if (!QU.items.length || LP.on || QU.hold) return;
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
  function quSheet() {
    var fresh = !QU.sheet;
    if (QU.sheet) QU.sheet.remove();
    if (!QU.items.length) { quSheetClose(); return; }
    var list = G.el('div', { 'class': 'ql' });
    QU.items.forEach(function (it, i) {
      var x = G.el('button', { type: 'button', 'class': 'qx', 'aria-label': (it.title || '') + ' 빼기', text: '✕' });
      x.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); QU.items.splice(i, 1); G.send('queueRemove', { id: it.id }); quRow(); quSheet(); });
      var row = G.el('div', { 'class': 'qr', role: 'button' }, [
        G.el('img', { src: 'https://i.ytimg.com/vi/' + it.id + '/mqdefault.jpg', alt: '', loading: 'lazy' }),
        G.el('div', { 'class': 'qt' }, [G.el('b', { text: it.title || it.id }), G.el('span', { text: it.ch || '' })]),
        x
      ]);
      row.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); QU.items.splice(i, 1); G.send('queuePlay', { id: it.id }); quSheetClose(); quRow(); });
      list.appendChild(row);
    });
    var clear = G.el('button', { type: 'button', 'class': 'qc', text: '모두 지우기' });
    clear.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); QU.items = []; G.send('queueClear', {}); quSheetClose(); quRow(); });
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
  var SP_MONTH = 'EgQIBBAB', SP_WEEK = 'EgQIAxAB'; // 검색 필터: 이번 달·이번 주 업로드 + 동영상만
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
    return {
      id: v.videoId, title: recText(v.headline || v.title), ch: recText(v.shortBylineText || v.longBylineText || v.ownerText),
      len: len, views: recText(v.shortViewCountText || v.viewCountText), age: recText(v.publishedTimeText),
      thumb: big ? recUrl(big.url) : 'https://i.ytimg.com/vi/' + v.videoId + '/hqdefault.jpg', avatar: av ? recUrl(av.url) : ''
    };
  }
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
    return { items: out, cont: cont };
  }
  function recSearch(q, sp, tag) {
    return yti('search', { query: q, params: sp }).then(function (j) { var r = recItems(j); return { tag: tag, items: r.items, cont: r.cont }; })
      .catch(function (e) { log('warn', '추천 탭: 검색 실패 [' + q + '] ' + e.message); return { tag: tag, items: [], cont: null }; });
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
  function recBlocked(it) {
    var s = S(), ch = (it.ch || '').toLowerCase(), t = (it.title || '').toLowerCase();
    var bc = s.blockChannels || [], bk = s.blockKeywords || [];
    for (var i = 0; i < bc.length; i++) { var c = String(bc[i] || '').trim().toLowerCase().replace(/^@/, ''); if (c && ch === c) return true; }
    for (var j = 0; j < bk.length; j++) { var k = String(bk[j] || '').trim().toLowerCase(); if (k && t.indexOf(k) >= 0) return true; }
    return false;
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
  var REC_LIM = { topic: 10, like: 5, trend: 3, 'new': 6 };
  function recCompose(srcs, every) {
    var seen = REC.seen, main = [], fresh = [];
    var qs = srcs.map(function (s) { return { s: s, i: 0, n: 0 }; });
    function take(q) {
      while (q.i < q.s.items.length) {
        var it = q.s.items[q.i++];
        if (seen[it.id] || REC.histIds[it.id] || recBlocked(it)) continue;
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
        if (have[it.id] || REC.histIds[it.id] || recBlocked(it)) return;
        have[it.id] = 1;
        REC.all.push(Object.assign({ tag: s.tag }, it));
      });
    });
  }
  function recLoad(force) {
    if (REC.loading) { if (force) REC.again = true; return; } // 고르는 중에 주제를 바꿈 → 끝나면 다시
    var st = recSt();
    var key = JSON.stringify([st.recTopics, st.recAuto, st.recTrends, st.recNewEvery]);
    if (!force && REC.items.length && REC.cacheKey === key && Date.now() - REC.cacheAt < 30 * 60e3) { recRender(); return; }
    REC.loading = true; REC.rounds++;
    recRender();
    var topics = (st.recTopics || []).slice(0, 8), every = +st.recNewEvery || 0;
    recAskData().then(function (data) {
      var hist = Array.isArray(data.history) ? data.history : [];
      REC.hist = hist; REC.histIds = {};
      hist.forEach(function (h) { if (h && h.id) REC.histIds[h.id] = 1; });
      REC.trendWords = (Array.isArray(data.trends) ? data.trends : []).map(function (t) { return t && (t.q || t); }).filter(function (q) { return typeof q === 'string' && q; })
        .map(function (q) { return q.replace(/&(amp|quot|#39|apos|lt|gt);/g, function (m, e) { return { amp: '&', quot: '"', '#39': "'", apos: "'", lt: '<', gt: '>' }[e]; }); }).slice(0, 12);
      var jobs = topics.map(function (t) { return recSearch(t, SP_MONTH, { kind: 'topic', label: t }); });
      if (st.recAuto !== false) hist.filter(function (h) { return h && h.id && Date.now() - (h.at || 0) < 21 * 864e5; }).slice(0, 4)
        .forEach(function (h) { jobs.push(recRelated(h.id, { kind: 'like', label: '본 영상과 비슷', from: h.title })); });
      if (st.recTrends !== false) recPickTrends(REC.trendWords, topics, hist).forEach(function (q) { jobs.push(recSearch(q, SP_WEEK, { kind: 'trend', label: q })); });
      // 새 주제 줄 수는 섞는 비율대로 (10개 중 1 → 1줄, 5개 중 1 → 2줄, 3개 중 1 → 3줄)
      if (every > 1) recPickNew(topics, every <= 3 ? 3 : every <= 5 ? 2 : 1).forEach(function (q) { jobs.push(recSearch(q, SP_MONTH, { kind: 'new', label: q })); });
      return Promise.all(jobs);
    }).then(function (srcs) {
      REC.loading = false;
      if (REC.again) { REC.again = false; recLoad(true); return; }
      REC.seen = {}; REC.srcs = srcs; REC.all = [];
      recAddAll(srcs);
      REC.items = recCompose(srcs, every);
      REC.cacheAt = Date.now(); REC.cacheKey = key;
      log('info', '추천 탭: ' + REC.all.length + '개 (주제 ' + topics.length + ', 출처 ' + srcs.length + ')');
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
    var cands = REC.srcs.filter(function (s) { return s.cont && (REC.view === 'all' || (s.tag.kind === REC.view && (!REC.sub || s.tag.label === REC.sub))); });
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
    Promise.all(pick.map(function (s) {
      return yti('search', { continuation: s.cont }).then(function (j) { var r = recItems(j); return { tag: s.tag, items: r.items, cont: r.cont, src: s }; })
        .catch(function () { return { tag: s.tag, items: [], cont: null, src: s }; });
    })).then(function (rs) {
      rs.forEach(function (r) { r.src.cont = r.cont; });
      var before = REC.all.length;
      REC.all.forEach(function (it) { REC.seen[it.id] = 1; }); // 이미 화면에 있는 영상은 다시 안 넣음
      recAddAll(rs);
      var add = recCompose(rs, every);
      REC.items = REC.items.concat(add);
      REC.moreBusy = false;
      // 지금 보기의 목록 끝에 붙임
      var list = REC.moreList;
      if (list) (REC.view === 'all' ? add : REC.all.slice(before).filter(recInView)).forEach(function (it) { list.appendChild(recBig(it, REC.view === 'all')); });
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
      '#glide-rec[hidden]{display:none}' +
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
      '#glide-rec-editor .save:active,#glide-rec-editor .opt:active,#glide-rec-editor .pk:active{opacity:.7}';
    (document.head || document.documentElement).appendChild(st);
  }
  function recEnsureTab() {
    var tab = document.getElementById('glide-rec-tab');
    if (!recOn()) { if (tab) tab.parentNode.removeChild(tab); if (REC.open) recClose(); return; }
    var bar = document.querySelector('ytm-pivot-bar-renderer');
    if (!bar) return;
    var items = bar.querySelectorAll('ytm-pivot-bar-item-renderer');
    if (!items.length) return;
    // 홈 · 구독 · 추천 · 내 페이지: 마지막 칸(내 페이지) 바로 앞
    var last = items[items.length - 1];
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
    var h = document.querySelector('ytm-mobile-topbar-renderer'), b = document.querySelector('ytm-pivot-bar-renderer');
    var top = h ? Math.max(0, h.getBoundingClientRect().bottom) : 48;
    var bottom = b ? Math.max(0, innerHeight - b.getBoundingClientRect().top) : 56;
    REC.el.style.top = top + 'px'; REC.el.style.bottom = bottom + 'px';
  }
  function recOpen() {
    if (!recOn()) return;
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
    recEditorClose();
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
      why ? G.el('div', { 'class': 'gr-why ' + it.tag.kind, text: recWhy(it) }) : null
    ]);
    var info = G.el('div', { 'class': 'gr-info' }, [it.avatar ? G.el('img', { 'class': 'gr-av', src: it.avatar, alt: '', loading: 'lazy' }) : G.el('div', { 'class': 'gr-av' }), text]);
    // 누르면 둘러보기 웹뷰의 링크 가로채기(위 '웹뷰 2개')가 영상 칸에서 엶
    return G.el('a', { 'class': 'gr-big', href: '/watch?v=' + it.id }, [recThumb(it), info]);
  }
  // 작은 카드: 가로 줄 안
  function recSmall(it) {
    return G.el('a', { 'class': 'gr-small', href: '/watch?v=' + it.id }, [recThumb(it), G.el('div', { 'class': 'gr-t', text: it.title }), recMeta([it.ch, it.views])]);
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
    if (t.indexOf(q) >= 0 || t.length >= 12) return;
    t.push(q);
    REC.override = Object.assign({}, REC.override || {}, { recTopics: t });
    G.send('recSave', { recTopics: t });
    log('info', '추천 탭: 새 주제를 내 주제에 추가 [' + q + ']');
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
    recClear(REC.body); REC.moreList = null; REC.more.textContent = '';
    if (REC.loading && !REC.all.length) { // 불러오는 동안 빈 카드 모양
      for (var s = 0; s < 3; s++) REC.body.appendChild(G.el('div', { 'class': 'gr-skel' }, [G.el('div', { 'class': 'gr-thumb' }), G.el('i'), G.el('i', { style: 'width:40%' })]));
      return;
    }
    if (REC.failed) { REC.body.appendChild(recNote('영상을 불러오지 못했어요', '인터넷 연결을 확인하고 다시 시도해 주세요', '다시 시도', function () { recLoad(true); })); return; }
    if (REC.view === 'all') recRenderAll(st, topics);
    else {
      var list = G.el('div', {});
      var shown = REC.all.filter(recInView);
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
  var REC_EVERY = [[0, '끄기', '새로운 주제를 섞지 않아요'], [10, '가끔', '10개 중 1개 정도'], [5, '보통', '5개 중 1개 정도'], [3, '자주', '3개 중 1개 정도']];
  function recEditor(first) {
    recEditorClose();
    var st = recSt();
    var topics = (st.recTopics || []).slice();
    var auto = st.recAuto !== false, trends = st.recTrends !== false, every = +st.recNewEvery || 0, wipe = false;
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
      var patch = { recTopics: topics, recAuto: auto, recTrends: trends, recNewEvery: every };
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
    var d = v.duration;
    if (!isFinite(d) || d < 90 || v.currentTime < Math.min(d * 0.6, 600)) return;
    var vd = null;
    try { vd = p.getVideoData && p.getVideoData(); } catch (x) { /* ignore */ }
    var id = (vd && vd.video_id) || new URLSearchParams(location.search).get('v');
    if (!id || recSent === id) return;
    recSent = id;
    G.send('recWatched', { videoId: id, title: (vd && vd.title) || document.title.replace(/ - YouTube$/, ''), channel: (vd && vd.author) || '' });
  }, true);
})();
