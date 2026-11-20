// ISOLATED world, document_start. 공통 코어(MAIN world) ↔ 확장 프로그램 사이 중계.
//  - 코어 → 'glide:out' 이벤트 → background 로 전달 (통계·로그)
//  - 저장소의 설정·필터 → 'glide:in' 이벤트로 코어에 전달 + localStorage 사본 갱신 (다음 로딩 때 동기 부팅용)
(function () {
  var alive = true;
  function toCore(obj) {
    document.dispatchEvent(new CustomEvent('glide:in', { detail: JSON.stringify(obj) }));
  }
  function saveBoot(settings, filters) {
    try { localStorage.setItem('glide:boot', JSON.stringify({ settings: settings, filters: filters })); } catch (e) { /* ignore */ }
  }
  function toBackground(msg) {
    if (!alive) return;
    try {
      chrome.runtime.sendMessage({ from: 'core', msg: msg }).catch(function () { /* 서비스 워커 재시작 중 */ });
    } catch (e) {
      alive = false; // 확장 프로그램이 다시 로드되어 이 페이지와 연결이 끊김
    }
  }

  document.addEventListener('glide:out', function (e) {
    if (typeof e.detail === 'string') toBackground(e.detail);
  });
  toCore({ hello: true }); // 코어가 쌓아 둔 메시지를 내보내도록 신호
  // 코어가 브리지보다 늦게 시작한 경우: 코어의 준비 알림을 받고 다시 신호 + 설정 전달
  document.addEventListener('glide:ready', function () {
    toCore({ hello: true });
    chrome.storage.local.get(['settings', 'filters']).then(function (st) {
      if (st.settings || st.filters) toCore({ settings: st.settings, filters: st.filters });
    });
  });

  // 백그라운드가 페이지(코어·편의 기능)로 보내는 메시지 (협찬 구간 데이터 등)
  chrome.runtime.onMessage.addListener(function (m) {
    if (m && m.glide === 'toPage' && m.msg) toCore(m.msg);
  });

  chrome.storage.local.get(['settings', 'filters']).then(function (st) {
    if (st.settings || st.filters) {
      saveBoot(st.settings, st.filters);
      toCore({ settings: st.settings, filters: st.filters });
    }
  });
  chrome.storage.onChanged.addListener(function (ch, area) {
    if (area !== 'local' || (!ch.settings && !ch.filters)) return;
    chrome.storage.local.get(['settings', 'filters']).then(function (st) {
      saveBoot(st.settings, st.filters);
      var m = {};
      if (ch.filters) m.filters = st.filters;
      if (ch.settings) m.settings = st.settings;
      toCore(m);
    });
  });
})();
