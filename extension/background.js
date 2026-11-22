// Glide 확장 프로그램 서비스 워커
//  - 설정·필터·통계·로그 저장 (chrome.storage.local 이 단일 원본)
//  - 2층 광고 서버 차단: declarativeNetRequest 동적 규칙
//  - 필터 원격 업데이트 (GitHub raw)
const CORE_API = 2; // core/glide-core.js 의 CORE_API 와 같아야 함
const LOG_MAX = 600;
const RULE_START = 1;

export const DEFAULT_SETTINGS = {
  enabled: true, prune: true, network: true, skip: true, cosmetic: true,
  background: true, debug: false, theme: 'system', quality: 'auto',
  // 편의 기능 (core/glide-plus.js)
  sponsorBlock: true, sbCategories: ['sponsor', 'selfpromo', 'interaction', 'intro'],
  channelSpeed: true, defaultRate: 1, channelRates: {},
  hideShorts: true, shortsAsVideo: true,
  blockChannels: [], blockKeywords: [],
  peakButton: true
};

// ---------------------------------------------------------------------------
// 공용 유틸
// ---------------------------------------------------------------------------
function cmpVersion(a, b) {
  const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// storage 쓰기를 한 줄로 세워서 동시 갱신으로 값이 덮이지 않게 함
let queue = Promise.resolve();
function serial(fn) {
  queue = queue.then(fn, fn).catch((e) => console.error('[glide]', e));
  return queue;
}

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

// ---------------------------------------------------------------------------
// 로그
// ---------------------------------------------------------------------------
let debugCache = false;
// 서비스 워커가 메시지로 깨어난 직후에도 디버그 설정을 읽은 뒤에 판단 (아니면 첫 로그들이 빠짐)
const settingsReady = chrome.storage.local.get('settings').then(({ settings }) => { debugCache = !!(settings && settings.debug); }, () => {});
function addLog(entry) {
  settingsReady.then(() => addLogNow(entry));
}
function addLogNow(entry) {
  const level = entry.level || 'info';
  if (!debugCache && level !== 'warn' && level !== 'error') return;
  serial(async () => {
    const { logs = [] } = await chrome.storage.local.get('logs');
    logs.push({ t: Date.now(), level, area: entry.area || '-', msg: String(entry.msg || ''), src: entry.src || 'core', page: entry.page || '' });
    if (logs.length > LOG_MAX) logs.splice(0, logs.length - LOG_MAX);
    await chrome.storage.local.set({ logs });
  });
}
const bgLog = (level, area, msg) => addLog({ level, area, msg, src: 'bg' });

// ---------------------------------------------------------------------------
// 통계
// ---------------------------------------------------------------------------
const emptyBucket = () => ({ ads: 0, seconds: 0, requests: 0, warns: 0, pruned: 0, skipped: 0, feed: 0, sponsor: 0 });
const tabCounts = new Map();

function addStat(kind, n, seconds, tabId) {
  serial(async () => {
    const { stats } = await chrome.storage.local.get('stats');
    const s = stats && stats.total ? stats : { day: today(), today: emptyBucket(), total: emptyBucket() };
    if (s.day !== today()) { s.day = today(); s.today = emptyBucket(); }
    for (const b of [s.today, s.total]) {
      if (kind === 'request') b.requests += n;
      else if (kind === 'warn') b.warns += n;
      else if (kind === 'sponsor') { b.sponsor = (b.sponsor || 0) + n; b.seconds += seconds || 0; }
      else {
        b.ads += n; b.seconds += seconds || 0;
        if (kind === 'pruned') b.pruned += n; else if (kind === 'skip') b.skipped += n; else if (kind === 'feed') b.feed += n;
      }
    }
    await chrome.storage.local.set({ stats: s });
  });
  if (tabId != null && kind !== 'warn' && kind !== 'request' && kind !== 'sponsor') {
    const c = (tabCounts.get(tabId) || 0) + n;
    tabCounts.set(tabId, c);
    chrome.action.setBadgeText({ tabId, text: c ? String(c > 999 ? '999+' : c) : '' }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// 필터
// ---------------------------------------------------------------------------
async function bundledFilters() {
  const res = await fetch(chrome.runtime.getURL('core/filters.json'));
  return res.json();
}

function validFilters(f) {
  return f && typeof f === 'object' && typeof f.version === 'string' && f.prune && Array.isArray(f.prune.keys) &&
    f.player && f.cssHide && f.network && Array.isArray(f.network.blockDomains);
}

// 저장된(원격) 필터와 내장 필터 중 더 새 것을 활성 필터로
async function resolveFilters() {
  const bundled = await bundledFilters();
  const { filters: stored, filtersMeta = {} } = await chrome.storage.local.get(['filters', 'filtersMeta']);
  let active = bundled, source = 'bundled';
  if (validFilters(stored) && (stored.minCore || 1) <= CORE_API && cmpVersion(stored.version, bundled.version) > 0) {
    active = stored; source = filtersMeta.source === 'remote' ? 'remote' : 'stored';
  }
  const meta = { ...filtersMeta, version: active.version, source, bundledVersion: bundled.version };
  await chrome.storage.local.set({ filters: active, filtersMeta: meta });
  return active;
}

async function updateFilters(manual) {
  const { filters: current } = await chrome.storage.local.get('filters');
  const bundled = await bundledFilters();
  const url = (current && current.updateUrl) || bundled.updateUrl;
  const metaBase = (await chrome.storage.local.get('filtersMeta')).filtersMeta || {};
  const save = (patch) => chrome.storage.local.set({ filtersMeta: { ...metaBase, ...patch, lastCheck: Date.now() } });

  if (!url || url.includes('/OWNER/')) {
    await save({ status: 'error', message: '업데이트 주소가 아직 설정되지 않았어요 (filters.json updateUrl)' });
    return { ok: false };
  }
  try {
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const remote = await res.json();
    if (!validFilters(remote)) throw new Error('필터 형식이 올바르지 않음');
    if ((remote.minCore || 1) > CORE_API) {
      await save({ status: 'needs-update', message: `필터 ${remote.version}은 새 확장 프로그램이 필요해요. git pull 후 확장 프로그램을 새로고침하세요.` });
      bgLog('warn', 'filters', `원격 필터 ${remote.version}: minCore ${remote.minCore} > ${CORE_API}`);
      return { ok: false };
    }
    const base = current && cmpVersion(current.version, bundled.version) >= 0 ? current : bundled;
    if (cmpVersion(remote.version, base.version) > 0) {
      await chrome.storage.local.set({ filters: remote });
      await save({ status: 'updated', message: `${remote.version}(으)로 업데이트했어요`, version: remote.version, source: 'remote', lastUpdate: Date.now() });
      bgLog('info', 'filters', `필터 업데이트 ${base.version} → ${remote.version}`);
    } else {
      await save({ status: 'latest', message: '최신 필터를 쓰고 있어요', version: base.version });
      if (manual) bgLog('info', 'filters', `필터 확인: 최신 (${base.version})`);
    }
    return { ok: true };
  } catch (e) {
    await save({ status: 'error', message: '업데이트 실패: ' + e.message });
    bgLog('warn', 'filters', '필터 업데이트 실패: ' + e.message);
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// 2층: 광고 서버 차단 (declarativeNetRequest)
// ---------------------------------------------------------------------------
let ruleLabels = new Map();

function buildRules(f) {
  const n = f.network || {};
  const initiators = n.initiatorDomains && n.initiatorDomains.length ? n.initiatorDomains : ['youtube.com'];
  const rules = [];
  const labels = new Map();
  let id = RULE_START;
  for (const d of n.blockDomains || []) {
    labels.set(id, d);
    rules.push({ id: id++, priority: 1, action: { type: 'block' }, condition: { requestDomains: [d], initiatorDomains: initiators } });
  }
  for (const u of n.blockUrlFilters || []) {
    labels.set(id, u);
    rules.push({ id: id++, priority: 1, action: { type: 'block' }, condition: { urlFilter: u, initiatorDomains: initiators } });
  }
  for (const r of n.redirects || []) {
    labels.set(id, r.urlFilter + ' → ' + r.resource);
    rules.push({
      id: id++, priority: 2,
      action: { type: 'redirect', redirect: { extensionPath: '/resources/' + r.resource } },
      condition: { urlFilter: r.urlFilter, resourceTypes: [r.type || 'script'] }
    });
  }
  for (const u of n.allowUrlFilters || []) {
    labels.set(id, 'allow ' + u);
    rules.push({ id: id++, priority: 3, action: { type: 'allow' }, condition: { urlFilter: u } });
  }
  return { rules, labels };
}

// 여러 곳에서 동시에 불려도 한 번에 하나씩 (동시 실행 시 'Rule with id 1 does not have a unique ID' 오류)
let rulesQueue = Promise.resolve();
function applyNetworkRules() {
  rulesQueue = rulesQueue.then(applyNetworkRulesNow, applyNetworkRulesNow);
  return rulesQueue;
}
async function applyNetworkRulesNow() {
  const settings = await getSettings();
  const { filters } = await chrome.storage.local.get('filters');
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);
  let addRules = [];
  if (settings.enabled && settings.network && filters) {
    const built = buildRules(filters);
    addRules = built.rules;
    ruleLabels = built.labels;
  }
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
    if (settings.debug) bgLog('info', 'net', addRules.length ? `광고 서버 차단 규칙 ${addRules.length}개 적용` : '광고 서버 차단 꺼짐 (규칙 0개)');
  } catch (e) {
    bgLog('error', 'net', '차단 규칙 적용 실패: ' + e.message);
  }
}

// 압축 해제 설치(개발자 모드)에서만 동작. 규칙에 걸린 요청 수를 셉니다.
const netAgg = new Map();
if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    addStat('request', 1, 0, null);
    if (!debugCache) return;
    if (!ruleLabels.size) {
      chrome.storage.local.get('filters').then(({ filters }) => { if (filters && !ruleLabels.size) ruleLabels = buildRules(filters).labels; });
    }
    const label = ruleLabels.get(info.rule.ruleId) || ('rule ' + info.rule.ruleId);
    const a = netAgg.get(label) || { n: 0, last: 0 };
    a.n++;
    const t = Date.now();
    if (t - a.last > 10000) {
      let host = '';
      try { host = new URL(info.request.url).host; } catch (e) { /* ignore */ }
      addLog({ level: 'info', area: 'net', src: 'net', msg: `광고 서버 차단: ${host} (${label}) · 이번 세션 ${a.n}건` });
      a.last = t;
    }
    netAgg.set(label, a);
  });
}

// ---------------------------------------------------------------------------
// 아이콘 (전체 꺼짐이면 회색)
// ---------------------------------------------------------------------------
async function updateIcon() {
  const s = await getSettings();
  const pre = s.enabled ? 'icon' : 'icon-off';
  await chrome.action.setIcon({ path: { 16: `icons/${pre}-16.png`, 32: `icons/${pre}-32.png` } }).catch(() => {});
  await chrome.action.setTitle({ title: s.enabled ? 'Glide · 보호 중' : 'Glide · 일시정지됨' }).catch(() => {});
  await chrome.action.setBadgeBackgroundColor({ color: '#3047D6' }).catch(() => {});
}

// ---------------------------------------------------------------------------
// 시작·이벤트
// ---------------------------------------------------------------------------
async function init(reason) {
  const { settings } = await chrome.storage.local.get('settings');
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  if (!settings || Object.keys(merged).length !== Object.keys(settings).length) await chrome.storage.local.set({ settings: merged });
  debugCache = merged.debug;
  await resolveFilters();
  await applyNetworkRules();
  await updateIcon();
  chrome.alarms.create('filters', { periodInMinutes: 720, delayInMinutes: reason === 'install' ? 1 : 30 });
}

chrome.runtime.onInstalled.addListener((d) => { init(d.reason); });
chrome.runtime.onStartup.addListener(() => { init('startup'); });

chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'filters') updateFilters(false); });

chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local') return;
  if (ch.settings) {
    const o = ch.settings.oldValue || {}, n = ch.settings.newValue || {};
    debugCache = !!n.debug;
    if (o.enabled !== n.enabled || o.network !== n.network) applyNetworkRules();
    if (o.enabled !== n.enabled) updateIcon();
    if (!o.debug && n.debug) bgLog('info', 'bg', '디버그 모드 켜짐. 유튜브 탭을 새로고침하면 처음부터 기록됩니다.');
  }
  if (ch.filters) applyNetworkRules();
});

chrome.tabs.onRemoved.addListener((tabId) => tabCounts.delete(tabId));

// ---------------------------------------------------------------------------
// 편의 기능 지원
// ---------------------------------------------------------------------------
// SponsorBlock: 영상 ID의 SHA-256 앞 4자리로 조회 (어떤 영상을 보는지 서버가 정확히 알 수 없게)
const sbCache = new Map();
async function sponsorSegments(videoId, categories) {
  const key = videoId + '|' + categories.join(',');
  const hit = sbCache.get(key);
  if (hit && Date.now() - hit.t < 3600e3) return hit.segments;
  const { filters } = await chrome.storage.local.get('filters');
  const api = (filters && filters.plus && filters.plus.sponsorBlockApi) || 'https://sponsor.ajay.app';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(videoId));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  const url = `${api}/api/skipSegments/${hex.slice(0, 4)}?categories=${encodeURIComponent(JSON.stringify(categories))}&actionTypes=${encodeURIComponent('["skip"]')}`;
  const res = await (self.__glideFetch || fetch)(url);
  let segments = [];
  if (res.status === 200) {
    const list = await res.json();
    const item = Array.isArray(list) && list.find((x) => x.videoID === videoId);
    segments = item && Array.isArray(item.segments) ? item.segments : [];
  } else if (res.status !== 404) throw new Error('HTTP ' + res.status);
  sbCache.set(key, { t: Date.now(), segments });
  if (sbCache.size > 300) sbCache.delete(sbCache.keys().next().value);
  return segments;
}
function toPage(tabId, msg) {
  if (tabId == null) return;
  chrome.tabs.sendMessage(tabId, { glide: 'toPage', msg }).catch(() => {});
}
function handlePlus(msg, tabId) {
  if (msg.type === 'sb:req') {
    const { videoId, categories } = msg.data || {};
    if (!videoId || !Array.isArray(categories) || !categories.length) return;
    sponsorSegments(videoId, categories)
      .then((segments) => toPage(tabId, { cmd: 'sb', arg: { videoId, segments } }))
      .catch((e) => bgLog('warn', 'plus', '협찬 구간 데이터를 받지 못함: ' + e.message));
  } else if (msg.type === 'channelRate') {
    const { id, name, rate } = msg.data || {};
    if (!id || !(rate > 0)) return;
    serial(async () => {
      const settings = await getSettings();
      const rates = { ...(settings.channelRates || {}) };
      if (Math.abs(rate - (+settings.defaultRate || 1)) < 0.001) delete rates[id];
      else rates[id] = { rate, name: name || '', t: Date.now() };
      await chrome.storage.local.set({ settings: { ...settings, channelRates: rates } });
    });
  }
}

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m && m.from === 'core') {
    let msg;
    try { msg = JSON.parse(m.msg); } catch (e) { return; }
    const tabId = sender.tab ? sender.tab.id : null;
    if (msg.type === 'stat') addStat(msg.data.kind, msg.data.n, msg.data.seconds, tabId);
    else if (msg.type === 'log') addLog({ ...msg.data, page: msg.page, src: 'core' });
    else if (msg.type === 'sb:req' || msg.type === 'channelRate') handlePlus(msg, tabId);
    else if (msg.type === 'hello' && tabId != null) {
      tabCounts.set(tabId, 0);
      chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
    }
    return;
  }
  if (m && m.cmd === 'updateFilters') {
    updateFilters(true).then(reply);
    return true;
  }
  if (m && m.cmd === 'clearLogs') {
    serial(() => chrome.storage.local.set({ logs: [] })).then(() => reply({ ok: true }));
    return true;
  }
  if (m && m.cmd === 'resetStats') {
    serial(() => chrome.storage.local.set({ stats: { day: today(), today: emptyBucket(), total: emptyBucket() } })).then(() => reply({ ok: true }));
    return true;
  }
});

// 서비스 워커가 깨어날 때마다 상태 점검 (설치 이벤트를 놓친 경우 대비)
chrome.storage.local.get('filters').then(({ filters }) => { if (!filters) init('wake'); });
