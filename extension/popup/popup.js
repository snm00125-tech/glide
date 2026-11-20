// Glide 설정 팝업
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const FEATURES = ['prune', 'network', 'skip', 'cosmetic'];
const PLUS = ['sponsorBlock', 'channelSpeed', 'hideShorts', 'shortsAsVideo', 'peakButton'];
const DEFAULTS = {
  enabled: true, prune: true, network: true, skip: true, cosmetic: true, background: true, debug: false, theme: 'system', quality: 'auto',
  sponsorBlock: true, sbCategories: ['sponsor', 'selfpromo', 'interaction', 'intro'], channelSpeed: true, defaultRate: 1, channelRates: {},
  hideShorts: true, shortsAsVideo: true, blockChannels: [], blockKeywords: [], peakButton: true
};

let settings = { ...DEFAULTS };
let logs = [];
let logFilter = { level: 'all', area: null };

// ---------------------------------------------------------------------------
// 포맷
// ---------------------------------------------------------------------------
const nf = new Intl.NumberFormat('ko-KR');
function fmtDuration(sec) {
  sec = Math.round(sec || 0);
  if (sec < 60) return sec + '초';
  const m = Math.round(sec / 60);
  if (m < 60) return m + '분';
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}시간 ${r}분` : `${h}시간`;
}
function fmtAgo(t) {
  if (!t) return null;
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return Math.floor(s / 60) + '분 전';
  if (s < 86400) return Math.floor(s / 3600) + '시간 전';
  const d = new Date(t);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
function fmtTime(t) {
  const d = new Date(t);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}
function fmtDateTime(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${fmtTime(t)}`;
}
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// 렌더링
// ---------------------------------------------------------------------------
function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  $$('[data-theme-choice]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeChoice === (theme || 'system'))));
}

function renderSettings() {
  $('#s-enabled').checked = settings.enabled;
  document.body.classList.toggle('off', !settings.enabled);
  $('#status-text').textContent = settings.enabled ? '유튜브 광고 차단 중' : '일시정지됨';
  for (const k of FEATURES) {
    const input = $('#s-' + k);
    input.checked = settings[k];
    input.disabled = !settings.enabled;
    input.closest('.row').classList.toggle('disabled', !settings.enabled);
  }
  for (const k of PLUS) {
    const input = $('#s-' + k);
    input.checked = !!settings[k];
    input.disabled = !settings.enabled;
    input.closest('.row').classList.toggle('disabled', !settings.enabled);
  }
  $('#sb-cats').hidden = !settings.sponsorBlock;
  $$('#sb-cats .chip').forEach((c) => c.setAttribute('aria-pressed', String((settings.sbCategories || []).includes(c.dataset.cat))));
  $('#btn-rates').hidden = !settings.channelSpeed;
  const rates = Object.entries(settings.channelRates || {});
  $('#rates-count').textContent = nf.format(rates.length);
  $('#rates-meta').textContent = `기본 배속 ${settings.defaultRate || 1}x`;
  $('#s-defaultRate').value = String(settings.defaultRate || 1);
  const nb = (settings.blockChannels || []).length, nk = (settings.blockKeywords || []).length;
  $('#block-meta').textContent = nb || nk ? `채널 ${nb}개 · 키워드 ${nk}개` : '추천과 검색에서 안 보이게 해요';
  if (!$('#sheet-block').hidden) renderBlockLists();
  if (!$('#sheet-rates').hidden) renderRates();
  $('#s-debug').checked = settings.debug;
  $('#s-quality').value = settings.quality || 'auto';
  $('#s-quality').disabled = !settings.enabled;
  applyTheme(settings.theme);
}

function renderStats(stats) {
  const fresh = stats && stats.day === todayKey();
  const t = (fresh && stats.today) || {};
  const total = (stats && stats.total) || {};
  $('#st-today').textContent = nf.format(t.ads || 0);
  $('#st-total').textContent = nf.format(total.ads || 0);
  $('#st-time').textContent = fmtDuration(total.seconds || 0);
  const parts = [];
  if (t.seconds) parts.push(`오늘 ${fmtDuration(t.seconds)} 절약`);
  if (t.requests) parts.push(`광고 서버 요청 ${nf.format(t.requests)}건 차단`);
  $('#st-foot').textContent = parts.length ? parts.join(' · ') : (total.ads ? '오늘은 아직 차단한 광고가 없어요' : '아직 차단한 광고가 없어요');
  $('#warn-line').textContent = `광고 차단 감지 경고: 오늘 ${t.warns || 0}회 · 누적 ${total.warns || 0}회`;
}

function renderFilters(filters, meta = {}) {
  $('#f-version').textContent = (filters && filters.version) || '-';
  const bits = [];
  const upd = fmtAgo(meta.lastUpdate), chk = fmtAgo(meta.lastCheck);
  bits.push(upd ? `마지막 업데이트 ${upd}` : meta.source === 'remote' ? '원격 필터' : '내장 필터 사용 중');
  if (chk) bits.push(`확인 ${chk}`);
  $('#f-meta').textContent = bits.join(' · ');
  const msg = $('#f-msg');
  if (meta.message && meta.lastCheck && Date.now() - meta.lastCheck < 6 * 3600e3) {
    msg.hidden = false;
    msg.textContent = meta.message;
    msg.classList.toggle('err', meta.status === 'error' || meta.status === 'needs-update');
  } else msg.hidden = true;
}

function renderLogCount() {
  $('#log-count').textContent = nf.format(logs.length);
}

function filteredLogs() {
  return logs.filter((l) => {
    if (logFilter.level === 'warn' && l.level !== 'warn' && l.level !== 'error') return false;
    if (logFilter.area && l.area !== logFilter.area && !(logFilter.area === 'net' && l.src === 'net')) return false;
    return true;
  });
}

const AREA = { plus: '편의', trace: '기록', page: '페이지', quality: '화질', timer: '타이머', start: '시작', data: '데이터', net: '서버', skip: '스킵', detect: '감지', core: '코어', filters: '필터', bg: '확장', bgplay: '백그라운드', cmd: '명령' };
function renderLogList() {
  const list = $('#log-list');
  const items = filteredLogs().slice(-400).reverse();
  list.replaceChildren(...items.map((l) => {
    const li = document.createElement('li');
    li.className = l.level;
    const time = document.createElement('time');
    time.textContent = fmtTime(l.t);
    time.dateTime = new Date(l.t).toISOString();
    const area = document.createElement('span');
    area.className = 'area';
    area.textContent = AREA[l.area] || l.area;
    const page = document.createElement('span');
    page.className = 'page';
    page.textContent = l.page || '';
    const msg = document.createElement('span');
    msg.className = 'msg';
    msg.textContent = l.msg;
    li.append(time, area, page, msg);
    return li;
  }));
  $('#log-empty').hidden = items.length > 0;
}

function chipItem(text, onRemove, label) {
  const el = document.createElement('span');
  el.className = 'item';
  const t = document.createElement('span');
  t.textContent = text;
  t.title = text;
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', label + ' 삭제');
  b.innerHTML = '<svg><use href="#i-x"/></svg>';
  b.addEventListener('click', onRemove);
  el.append(t, b);
  return el;
}
function renderList(container, items, key, label) {
  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'none';
    p.textContent = '아직 없어요';
    container.replaceChildren(p);
    return;
  }
  container.replaceChildren(...items.map((x) => chipItem(x, () => saveSettings({ [key]: (settings[key] || []).filter((y) => y !== x) }), label + ' ' + x)));
}
function renderBlockLists() {
  renderList($('#list-channel'), settings.blockChannels || [], 'blockChannels', '채널');
  renderList($('#list-keyword'), settings.blockKeywords || [], 'blockKeywords', '키워드');
}
function renderRates() {
  const rates = Object.entries(settings.channelRates || {}).sort((a, b) => (a[1].name || a[0]).localeCompare(b[1].name || b[0], 'ko'));
  $('#rates-empty').hidden = rates.length > 0;
  $('#rates-list').hidden = !rates.length;
  $('#rates-list').replaceChildren(...rates.map(([id, r]) => {
    const row = document.createElement('div');
    row.className = 'row rate-row';
    const txt = document.createElement('span');
    txt.className = 'txt';
    const b = document.createElement('b');
    b.textContent = r.name || id;
    const s = document.createElement('small');
    s.textContent = r.t ? '기억한 날 ' + new Date(r.t).toLocaleDateString('ko-KR') : id;
    txt.append(b, s);
    const rate = document.createElement('span');
    rate.className = 'rate';
    rate.textContent = r.rate + 'x';
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'icon-btn';
    del.setAttribute('aria-label', (r.name || id) + ' 배속 기억 지우기');
    del.innerHTML = '<svg><use href="#i-x"/></svg>';
    del.addEventListener('click', () => {
      const next = { ...(settings.channelRates || {}) };
      delete next[id];
      saveSettings({ channelRates: next });
    });
    row.append(txt, rate, del);
    return row;
  }));
}
function addTo(key, input) {
  const v = input.value.trim();
  if (!v) return;
  const list = settings[key] || [];
  if (!list.some((x) => x.toLowerCase() === v.toLowerCase())) saveSettings({ [key]: list.concat(v) });
  input.value = '';
  input.focus();
}

// ---------------------------------------------------------------------------
// 동작
// ---------------------------------------------------------------------------
async function saveSettings(patch) {
  settings = { ...settings, ...patch };
  renderSettings();
  await chrome.storage.local.set({ settings });
}

let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

async function copyLogs() {
  const { filters, filtersMeta = {}, stats } = await chrome.storage.local.get(['filters', 'filtersMeta', 'stats']);
  const mf = chrome.runtime.getManifest();
  const head = [
    `# Glide 로그 (${fmtDateTime(Date.now())})`,
    `확장 ${mf.version} · 필터 ${filters ? filters.version : '-'} (${filtersMeta.source || '-'}) · ${navigator.userAgent}`,
    `설정: ${Object.entries(settings).map(([k, v]) => `${k}=${v}`).join(' ')}`,
    `통계(오늘): ${stats && stats.today ? JSON.stringify(stats.today) : '-'}`,
    ''
  ];
  const lines = logs.map((l) => `${fmtDateTime(l.t)} [${l.level}] [${l.area}] ${l.msg}${l.page ? '  @' + l.page : ''}`);
  const text = head.concat(lines).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    toast(`로그 ${nf.format(logs.length)}줄을 복사했어요`);
  } catch (e) {
    toast('복사하지 못했어요: ' + e.message);
  }
}

function openSheet(id) {
  const s = $(id);
  s.hidden = false;
  const first = s.querySelector('[data-close]');
  if (first) first.focus();
}
function closeSheets() { $$('.sheet').forEach((s) => { s.hidden = true; }); }

async function renderChanges() {
  try {
    const res = await fetch(chrome.runtime.getURL('core/changelog.json'));
    const list = await res.json();
    $('#changes').replaceChildren(...list.map((c) => {
      const a = document.createElement('article');
      const h = document.createElement('h3');
      h.textContent = 'v' + c.version;
      const d = document.createElement('span');
      d.textContent = c.date;
      h.append(d);
      const ul = document.createElement('ul');
      for (const it of c.items) { const li = document.createElement('li'); li.textContent = it; ul.append(li); }
      a.append(h, ul);
      return a;
    }));
  } catch (e) {
    $('#changes').textContent = '업데이트 내역을 불러오지 못했어요.';
  }
}

// ---------------------------------------------------------------------------
// 시작
// ---------------------------------------------------------------------------
async function init() {
  const st = await chrome.storage.local.get(['settings', 'stats', 'filters', 'filtersMeta', 'logs']);
  settings = { ...DEFAULTS, ...(st.settings || {}) };
  logs = st.logs || [];
  renderSettings();
  renderStats(st.stats);
  renderFilters(st.filters, st.filtersMeta);
  renderLogCount();
  const mf = chrome.runtime.getManifest();
  $('#app-version').textContent = mf.version;
  $('#app-meta').textContent = 'PC 확장 프로그램 · 개인용';

  $('#s-enabled').addEventListener('change', (e) => saveSettings({ enabled: e.target.checked }));
  for (const k of FEATURES) {
    $('#s-' + k).addEventListener('change', (e) => {
      saveSettings({ [k]: e.target.checked });
      if (k === 'prune') $('#reload-hint').hidden = false;
    });
  }
  $('#s-debug').addEventListener('change', (e) => {
    saveSettings({ debug: e.target.checked });
    toast(e.target.checked ? '디버그 모드를 켰어요. 유튜브 탭을 새로고침하세요.' : '디버그 모드를 껐어요');
  });
  $$('[data-theme-choice]').forEach((b) => b.addEventListener('click', () => saveSettings({ theme: b.dataset.themeChoice })));
  $('#s-quality').addEventListener('change', (e) => saveSettings({ quality: e.target.value }));
  for (const k of PLUS) $('#s-' + k).addEventListener('change', (e) => saveSettings({ [k]: e.target.checked }));
  $$('#sb-cats .chip').forEach((c) => c.addEventListener('click', () => {
    const cur = new Set(settings.sbCategories || []);
    if (cur.has(c.dataset.cat)) cur.delete(c.dataset.cat); else cur.add(c.dataset.cat);
    if (!cur.size) { toast('적어도 한 가지는 골라 주세요'); return; }
    saveSettings({ sbCategories: [...cur] });
  }));
  $('#btn-block').addEventListener('click', () => { renderBlockLists(); openSheet('#sheet-block'); });
  $('#btn-rates').addEventListener('click', () => { renderRates(); openSheet('#sheet-rates'); });
  $('#form-channel').addEventListener('submit', (e) => { e.preventDefault(); addTo('blockChannels', $('#in-channel')); });
  $('#form-keyword').addEventListener('submit', (e) => { e.preventDefault(); addTo('blockKeywords', $('#in-keyword')); });
  $('#s-defaultRate').addEventListener('change', (e) => saveSettings({ defaultRate: Number(e.target.value) }));

  $('#btn-update').addEventListener('click', async () => {
    const btn = $('#btn-update');
    btn.disabled = true; btn.classList.add('busy');
    btn.querySelector('.lbl').textContent = '확인 중';
    try { await chrome.runtime.sendMessage({ cmd: 'updateFilters' }); } finally {
      btn.disabled = false; btn.classList.remove('busy');
      btn.querySelector('.lbl').textContent = '지금 업데이트';
    }
  });

  $('#btn-logs').addEventListener('click', () => { renderLogList(); openSheet('#sheet-logs'); });
  $('#btn-copy').addEventListener('click', copyLogs);
  $('#logs-copy').addEventListener('click', copyLogs);
  $('#logs-clear').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ cmd: 'clearLogs' });
    toast('로그를 지웠어요');
  });
  $$('.filters-bar .chip').forEach((c) => c.addEventListener('click', () => {
    $$('.filters-bar .chip').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    c.setAttribute('aria-pressed', 'true');
    logFilter = c.dataset.area ? { level: 'all', area: c.dataset.area } : { level: c.dataset.level, area: null };
    renderLogList();
  }));
  $('#btn-changes').addEventListener('click', () => { renderChanges(); openSheet('#sheet-changes'); });
  $$('[data-close]').forEach((b) => b.addEventListener('click', closeSheets));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $$('.sheet').some((s) => !s.hidden)) { e.preventDefault(); closeSheets(); } });

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    if (ch.stats) renderStats(ch.stats.newValue);
    if (ch.settings) { settings = { ...DEFAULTS, ...(ch.settings.newValue || {}) }; renderSettings(); }
    if (ch.filters || ch.filtersMeta) chrome.storage.local.get(['filters', 'filtersMeta']).then((s) => renderFilters(s.filters, s.filtersMeta));
    if (ch.logs) {
      logs = ch.logs.newValue || [];
      renderLogCount();
      if (!$('#sheet-logs').hidden) renderLogList();
    }
  });
}

init();
