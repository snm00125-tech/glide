// MAIN world, document_start. 공통 코어가 읽을 부트 데이터를 동기적으로 준비합니다.
// 확장 프로그램 저장소(chrome.storage)는 MAIN world에서 못 읽으므로 bridge.js가 남겨 둔
// localStorage 사본을 쓰고, 없으면 확장에 들어 있는 기본 필터를 씁니다.
(function () {
  var defaults = window.__GLIDE_DEFAULT_FILTERS__ || {};
  try { delete window.__GLIDE_DEFAULT_FILTERS__; } catch (e) { /* ignore */ }
  var cached = null;
  try { cached = JSON.parse(localStorage.getItem('glide:boot') || 'null'); } catch (e) { /* ignore */ }
  function ver(v) { return String(v || '0').split('.').map(Number); }
  function newerOrSame(a, b) {
    var x = ver(a), y = ver(b);
    for (var i = 0; i < Math.max(x.length, y.length); i++) {
      if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
    }
    return true;
  }
  var filters = defaults;
  if (cached && cached.filters && newerOrSame(cached.filters.version, defaults.version)) filters = cached.filters;
  window.__GLIDE_BOOT__ = { platform: 'extension', settings: cached && cached.settings, filters: filters };
})();
