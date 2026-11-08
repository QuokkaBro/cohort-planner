'use strict';
/* 기수 일정판 — 정적 페이지. 데이터는 브라우저(localStorage)와 GitHub 비공개 저장소 JSON 한 파일에 저장. */

// ───── 기준 데이터 ─────
const TRACKS = {
  common:  { name: '공통과정',          short: '공통' },
  care:    { name: '고객케어 전문과정', short: '고객케어' },
  general: { name: '일반 전문과정',     short: '일반' },
  tech:    { name: '기술 전문과정',     short: '기술' },
};
const SPEC = ['care', 'general', 'tech'];
const PERIODS = [
  [1, '09:00', '10:00'], [2, '10:00', '11:00'], [3, '11:00', '12:00'], [4, '12:00', '13:00'],
  ['점심', '13:00', '14:00'],
  [5, '14:00', '15:00'], [6, '15:00', '16:00'], [7, '16:00', '17:00'], [8, '17:00', '18:00'],
];
// 법정 공휴일(대체공휴일 포함). 확정 전 윤혁님 확인 필요.
const HOLIDAYS = {
  '2026-01-01': '신정', '2026-02-16': '설날 연휴', '2026-02-17': '설날', '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절', '2026-03-02': '대체공휴일', '2026-05-05': '어린이날', '2026-05-24': '부처님오신날',
  '2026-05-25': '대체공휴일', '2026-06-03': '지방선거', '2026-06-06': '현충일', '2026-08-15': '광복절',
  '2026-08-17': '대체공휴일', '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절', '2026-10-05': '대체공휴일', '2026-10-09': '한글날', '2026-12-25': '성탄절',
  '2027-01-01': '신정', '2027-02-06': '설날 연휴', '2027-02-07': '설날', '2027-02-08': '설날 연휴',
  '2027-02-09': '대체공휴일', '2027-03-01': '삼일절', '2027-05-05': '어린이날', '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일', '2027-08-15': '광복절', '2027-08-16': '대체공휴일', '2027-09-14': '추석 연휴',
  '2027-09-15': '추석', '2027-09-16': '추석 연휴', '2027-10-03': '개천절', '2027-10-04': '대체공휴일',
  '2027-10-09': '한글날', '2027-10-11': '대체공휴일', '2027-12-25': '성탄절', '2027-12-27': '대체공휴일',
};
// 교육일로 세지만 표시만 하는 날(월-일)
const AMBIGUOUS = { '12-31': '연말: 교육일로 셈', '05-01': '노동절: 회사 휴무 확인', '07-17': '제헌절: 휴무 확인' };
// docs/agents/cohort-schedule.md 일정표
const DEFAULT_TASKS = {
  pre: ['1-1 강의장 미리 세팅하기'],
  c1: ['아침: 1-1 강의장에서 첫인사', '점심: 신규 기수와 식사', '강사별 인원 1:1 면담 시작(RP 테스트 전까지)'],
  c3: ['저녁: 2층 짐 옮기기'],
  c8: ['공통 RP 테스트', '각 실 실장님께 인원정보 출력해서 미리 전달'],
  s1: ['각 실 실장님 간담회'],
  s2: ['일반전문 종이테스트'], s3: ['일반전문 종이테스트'], s4: ['일반전문 종이테스트'],
  s5: ['일반전문 종이테스트'], s6: ['일반전문 종이테스트'],
  s9: ['실전응대'],
  s10: ['실전응대', '현장 의견과 종합해서 최종 수료인원 결정'],
  s11: ['전국체전(현장 리더들과 함께 RP)', '점심: 센터장님과 식사'],
  s12: ['전문과정 마지막 날', '수료식 진행'],
  f1: ['오전: 각 실로 인솔'],
};

// ───── 작은 도구 ─────
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const fmt = (s) => { const d = parse(s); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`; };
const clone = (o) => JSON.parse(JSON.stringify(o));

// ───── 상태 ─────
const LS_DATA = 'cp.data', LS_META = 'cp.meta', LS_SYNC = 'cp.sync';
const empty = () => ({ version: 1, offDays: {}, curricula: {}, cohorts: [] });
let S = readLS(LS_DATA) || empty();
let META = readLS(LS_META) || { sha: null, dirty: false };
let SYNC = readLS(LS_SYNC);
const UI = { view: 'month', cursor: ymd(new Date()), filter: 'all' };

function readLS(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 불가 브라우저 */ } }

// ───── 영업일·일정 계산 ─────
const holidayName = (s) => S.offDays[s] || HOLIDAYS[s] || '';
const isOff = (s) => { const w = parse(s).getDay(); return w === 0 || w === 6 || !!HOLIDAYS[s] || !!S.offDays[s]; };
const nextWork = (s) => { let d = addDays(s, 1); while (isOff(d)) d = addDays(d, 1); return d; };
const prevWork = (s) => { let d = addDays(s, -1); while (isOff(d)) d = addDays(d, -1); return d; };

function schedule(c) {
  const out = [{ key: 'pre', kind: 'pre', n: 0, date: prevWork(c.start) }];
  let d = c.start;
  for (let i = 1; i <= 8; i++) { out.push({ key: 'c' + i, kind: 'c', n: i, date: d }); d = nextWork(d); }
  for (let i = 1; i <= 12; i++) { out.push({ key: 's' + i, kind: 's', n: i, date: d }); d = nextWork(d); }
  out.push({ key: 'f1', kind: 'f', n: 1, date: d });
  return out;
}
function dayLabel(day, track) {
  if (day.kind === 'pre') return '교육 시작 전';
  if (day.kind === 'f') return '현장 1일차';
  if (day.kind === 'c') return `공통과정 ${day.n}일차`;
  return `${TRACKS[track].name} ${day.n}일차`;
}
function indexByDate() {
  const idx = {};
  for (const c of sortedCohorts()) for (const day of schedule(c)) (idx[day.date] ||= []).push({ c, day });
  return idx;
}
const sortedCohorts = () => [...S.cohorts].sort((a, b) => a.start.localeCompare(b.start));
const findCohort = (id) => S.cohorts.find((c) => c.id === id);
const tasksOf = (c, key) => c.tasks.filter((t) => t.key === key);

function blocksOf(c, track, n) {
  const cur = c.curr?.[track];
  const day = cur?.days?.find((x) => x.day === n);
  return day ? day.blocks : null;
}

// ───── 저장 ─────
let pushTimer = null;
function save() {
  writeLS(LS_DATA, S);
  META.dirty = true; writeLS(LS_META, META);
  if (!SYNC) { setStatus('local'); return; }
  setStatus('saving');
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 1200);
}
function setStatus(kind, extra = '') {
  const el = $('#status');
  const map = {
    local: ['이 브라우저에만 저장(시험 모드)', 'warn'],
    saving: ['저장 중…', ''],
    saved: ['GitHub에 저장됨 ' + extra, 'ok'],
    loaded: ['GitHub 최신 내용 ' + extra, 'ok'],
    fail: ['저장 실패: ' + extra, 'bad'],
    conflict: ['다른 PC가 먼저 저장함 → 새로고침', 'bad'],
  };
  const [t, cls] = map[kind];
  el.textContent = t; el.className = 'status ' + cls;
}
const now = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const b64e = (s) => { let bin = ''; new TextEncoder().encode(s).forEach((b) => { bin += String.fromCharCode(b); }); return btoa(bin); };
const b64d = (b) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\n/g, '')), (ch) => ch.charCodeAt(0)));
const apiUrl = (cfg) => `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path || 'planner.json'}`;
const apiHeaders = (cfg) => ({ Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json' });

async function pull(cfg = SYNC) {
  const r = await fetch(apiUrl(cfg) + '?t=' + Date.now(), { headers: apiHeaders(cfg), cache: 'no-store' });
  if (r.status === 404) return { data: null, sha: null };
  if (!r.ok) throw new Error(r.status === 401 ? '열쇠(토큰)가 틀림' : '오류 ' + r.status);
  const j = await r.json();
  return { data: JSON.parse(b64d(j.content)), sha: j.sha };
}
async function push() {
  try {
    const body = { message: '일정판 저장 ' + new Date().toISOString(), content: b64e(JSON.stringify(S, null, 1)) };
    if (META.sha) body.sha = META.sha;
    const r = await fetch(apiUrl(SYNC), { method: 'PUT', headers: apiHeaders(SYNC), body: JSON.stringify(body) });
    if (r.status === 409 || r.status === 422) { setStatus('conflict'); return; }
    if (!r.ok) throw new Error(r.status === 401 ? '열쇠(토큰)가 틀림' : '오류 ' + r.status);
    META.sha = (await r.json()).content.sha; META.dirty = false; writeLS(LS_META, META);
    setStatus('saved', now());
  } catch (e) { setStatus('fail', e.message === 'Failed to fetch' ? '인터넷 확인' : e.message); }
}
async function startSync() {
  if (!SYNC) { setStatus(META.dirty || S.cohorts.length ? 'local' : 'local'); return; }
  try {
    setStatus('saving');
    const { data, sha } = await pull();
    if (!data) { META.sha = null; await push(); return; }
    if (META.dirty && sha !== META.sha) {
      const useRemote = confirm('다른 PC에서 고친 내용과 이 PC에서 고친 내용이 다릅니다.\n\n[확인] GitHub 내용 쓰기(이 PC 변경 버림)\n[취소] 이 PC 내용으로 GitHub 덮기');
      if (!useRemote) { META.sha = sha; await push(); return; }
    } else if (META.dirty && sha === META.sha) { await push(); return; }
    S = data; META = { sha, dirty: false };
    writeLS(LS_DATA, S); writeLS(LS_META, META);
    setStatus('loaded', now()); render();
  } catch (e) { setStatus('fail', e.message === 'Failed to fetch' ? '인터넷 확인' : e.message); }
}
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !SYNC || META.dirty) return;
  try {
    const { data, sha } = await pull();
    if (data && sha !== META.sha) { S = data; META = { sha, dirty: false }; writeLS(LS_DATA, S); writeLS(LS_META, META); setStatus('loaded', now()); render(); }
  } catch { /* 다음에 다시 */ }
});

// ───── 화면: 달력 ─────
function render() {
  document.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.view === UI.view));
  $('#legend').innerHTML = Object.entries(TRACKS).map(([k, t]) => `<span class="chip t-${k}">${t.short}</span>`).join('')
    + '<span class="chip t-etc">시작 전·현장</span><span class="lg-note">칸을 누르면 그날 시간표·할 일·메모</span>';
  if (UI.view === 'table') return renderTable();
  const cur = parse(UI.cursor);
  let first, days;
  if (UI.view === 'month') {
    $('#range').textContent = `${cur.getFullYear()}년 ${cur.getMonth() + 1}월`;
    const m1 = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const offset = (m1.getDay() + 6) % 7; // 월요일 시작
    first = ymd(new Date(m1.getFullYear(), m1.getMonth(), 1 - offset));
    const last = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const cells = Math.ceil((offset + last.getDate()) / 7) * 7;
    days = Array.from({ length: cells }, (_, i) => addDays(first, i));
  } else {
    const offset = (cur.getDay() + 6) % 7;
    first = addDays(UI.cursor, -offset);
    days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
    $('#range').textContent = `${fmt(days[0])} ~ ${fmt(days[6])}`;
  }
  const idx = indexByDate();
  const today = ymd(new Date());
  const month = cur.getMonth();
  const head = ['월', '화', '수', '목', '금', '토', '일'].map((w, i) => `<div class="wh ${i > 4 ? 'we' : ''}">${w}</div>`).join('');
  const body = days.map((d) => {
    const dt = parse(d), w = dt.getDay();
    const hol = holidayName(d), amb = AMBIGUOUS[d.slice(5)];
    const cls = ['cell', w === 0 || w === 6 ? 'we' : '', UI.view === 'month' && dt.getMonth() !== month ? 'other' : '', d === today ? 'today' : '', hol ? 'hol' : ''].join(' ');
    const items = (idx[d] || []).map(({ c, day }) => entryHtml(c, day)).join('');
    return `<div class="${cls}"><div class="dn"><b>${dt.getDate()}</b>${hol ? `<span class="hn">${esc(hol)}</span>` : ''}${amb && !hol ? `<span class="amb" title="${esc(amb)}">확인</span>` : ''}</div>${items}</div>`;
  }).join('');
  $('#main').innerHTML = `<div class="grid ${UI.view}">${head}${body}</div>`;
  if (!S.cohorts.length) $('#main').insertAdjacentHTML('afterbegin', '<p class="empty">아직 기수가 없습니다. 위의 <b>+ 기수 만들기</b>에서 기수 번호와 입사일을 넣으세요.</p>');
}
function entryHtml(c, day) {
  const ts = tasksOf(c, day.key), left = ts.filter((t) => !t.done).length;
  const badge = ts.length ? `<span class="tb ${left ? '' : 'done'}">할 일 ${ts.length - left}/${ts.length}</span>` : '';
  const detail = UI.view === 'week' && ts.length ? `<ul class="wt">${ts.map((t) => `<li class="${t.done ? 'done' : ''}">${esc(t.text)}</li>`).join('')}</ul>` : '';
  if (day.kind === 's') {
    return `<div class="grp">${SPEC.map((tr) => `<button class="chip t-${tr}" data-open="${c.id}|${day.key}|${tr}">${c.number}기 ${TRACKS[tr].short} ${day.n}일차</button>`).join('')}${badge ? `<button class="chip t-task" data-open="${c.id}|${day.key}|care">${badge}</button>` : ''}${detail}</div>`;
  }
  const tr = day.kind === 'c' ? 'common' : 'etc';
  const label = day.kind === 'c' ? `공통 ${day.n}일차` : dayLabel(day);
  return `<div class="grp"><button class="chip t-${tr}" data-open="${c.id}|${day.key}|common">${c.number}기 ${label} ${badge}</button>${detail}</div>`;
}

// ───── 화면: 표 ─────
function renderTable() {
  const list = sortedCohorts();
  $('#range').textContent = '표 보기';
  const opts = ['<option value="all">모든 기수</option>', ...list.map((c) => `<option value="${c.id}" ${UI.filter === c.id ? 'selected' : ''}>${c.number}기</option>`)].join('');
  const rows = [];
  for (const c of list) {
    if (UI.filter !== 'all' && UI.filter !== c.id) continue;
    for (const day of schedule(c)) {
      const ts = tasksOf(c, day.key);
      const label = day.kind === 's' ? `전문과정 ${day.n}일차 (3개 반)` : dayLabel(day);
      rows.push({ date: day.date, html: `<tr>
        <td class="nw">${fmt(day.date)}</td><td class="nw">${c.number}기</td>
        <td><button class="link" data-open="${c.id}|${day.key}|${day.kind === 's' ? 'care' : 'common'}">${label}</button></td>
        <td>${ts.map((t) => `<label class="ck"><input type="checkbox" data-task="${c.id}|${t.id}" ${t.done ? 'checked' : ''}> ${esc(t.text)}</label>`).join('')}</td>
        <td><textarea rows="1" data-memo="${c.id}|${day.key}" placeholder="메모">${esc(c.memos[day.key] || '')}</textarea></td></tr>` });
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  $('#main').innerHTML = `<div class="tbar"><select id="filter">${opts}</select></div>
    <table class="tbl"><thead><tr><th>날짜</th><th>기수</th><th>일정</th><th>할 일</th><th>메모</th></tr></thead>
    <tbody>${rows.map((r) => r.html).join('') || '<tr><td colspan="5" class="empty">기수가 없습니다.</td></tr>'}</tbody></table>`;
}

// ───── 하루 창(시간표·할 일·메모) ─────
function ttHtml(blocks, editable) {
  const byP = {};
  // 점심을 건너는 수업은 오전·오후 두 칸으로 나눠 보여 줌
  const parts = (blocks || []).flatMap((b) => (b.from <= 4 && b.to >= 5 ? [{ ...b, to: 4 }, { ...b, from: 5 }] : [b]));
  parts.forEach((b) => { for (let p = b.from; p <= b.to; p++) byP[p] = b; });
  return `<table class="tt"><tbody>${PERIODS.map(([p, s, e]) => {
    const time = `<th><b>${p === '점심' ? '점심' : p + '교시'}</b><small>${s}~${e}</small></th>`;
    if (p === '점심') return `<tr class="lunch">${time}<td>점심시간</td></tr>`;
    if (editable) {
      const b = byP[p] || {};
      return `<tr>${time}<td class="ed"><input data-p="${p}" data-f="subject" value="${esc(b.subject || '')}" placeholder="과목"><input data-p="${p}" data-f="instructor" value="${esc(b.instructor || '')}" placeholder="강사"></td></tr>`;
    }
    const b = byP[p];
    if (b && b.from !== p) return `<tr>${time}</tr>`;
    if (!b) return `<tr>${time}<td class="miss">확인 필요(빈칸)</td></tr>`;
    const span = b.to - b.from + 1;
    return `<tr>${time}<td rowspan="${span}" class="blk"><b>${esc(b.subject)}</b><span>${esc(b.instructor)}</span>${span > 1 ? `<small>${b.from}~${b.to}교시</small>` : ''}</td></tr>`;
  }).join('')}</tbody></table>`;
}
function openDay(cid, key, track, editing = false) {
  const c = findCohort(cid); if (!c) return;
  const day = schedule(c).find((d) => d.key === key);
  const hasTT = day.kind === 'c' || day.kind === 's';
  const tr = day.kind === 's' ? track : 'common';
  const tabs = day.kind === 's' ? `<div class="tabs">${SPEC.map((t) => `<button class="chip t-${t} ${t === tr ? 'on' : ''}" data-tab="${t}">${TRACKS[t].short}</button>`).join('')}</div>` : '';
  const blocks = hasTT ? blocksOf(c, tr, day.n) : null;
  const tt = !hasTT ? '' : (blocks === null && !editing
    ? `<p class="miss box">${TRACKS[tr].name} 커리큘럼이 아직 없습니다. 위의 <b>커리큘럼</b>에서 넣거나, 아래 <b>이 날 시간표 고치기</b>로 직접 넣으세요.</p>`
    : ttHtml(blocks, editing));
  const ts = tasksOf(c, key);
  $('#dlgBody').innerHTML = `
    <div class="dh"><h2>${c.number}기 ${dayLabel(day, tr)}</h2><span class="date">${fmt(day.date)}${holidayName(day.date) ? ' · ' + esc(holidayName(day.date)) : ''}</span><button class="x" data-close>닫기</button></div>
    ${tabs}
    <div class="dcols">
      ${hasTT ? `<section><h3>시간표</h3>${tt}<div class="row">${editing
        ? `<button class="primary" data-ttsave="${cid}|${key}|${tr}">시간표 저장</button><button data-reopen="${cid}|${key}|${tr}">취소</button><span class="hint">같은 과목·강사가 이어지면 한 칸으로 합쳐집니다.</span>`
        : `<button data-ttedit="${cid}|${key}|${tr}">이 날 시간표 고치기</button>`}</div></section>` : ''}
      <section><h3>할 일</h3>
        <ul class="tasks">${ts.map((t) => `<li><label class="ck"><input type="checkbox" data-task="${cid}|${t.id}" ${t.done ? 'checked' : ''}> <span>${esc(t.text)}</span></label><button class="del" data-tdel="${cid}|${t.id}|${key}|${tr}" aria-label="지우기">지우기</button></li>`).join('') || '<li class="muted">할 일이 없습니다.</li>'}</ul>
        <form class="row" data-tadd="${cid}|${key}|${tr}"><input name="t" placeholder="할 일 추가" required><button class="primary">추가</button></form>
        <h3>메모</h3><textarea rows="5" data-memo="${cid}|${key}" placeholder="이 날 메모">${esc(c.memos[key] || '')}</textarea>
      </section>
    </div>`;
  $('#dlgBody').dataset.ctx = `${cid}|${key}`;
  if (!$('#dlg').open) $('#dlg').showModal();
}
function readEditedBlocks() {
  const rows = {};
  document.querySelectorAll('#dlgBody .ed input').forEach((i) => { (rows[i.dataset.p] ||= {})[i.dataset.f] = i.value.trim(); });
  const blocks = [];
  for (let p = 1; p <= 8; p++) {
    const r = rows[p] || {};
    if (!r.subject && !r.instructor) continue;
    const last = blocks[blocks.length - 1];
    if (last && last.to === p - 1 && last.subject === r.subject && last.instructor === r.instructor) last.to = p;
    else blocks.push({ from: p, to: p, subject: r.subject || '', instructor: r.instructor || '' });
  }
  return blocks;
}

// ───── 기수 만들기·관리 ─────
function openCohorts() {
  const list = sortedCohorts();
  const have = Object.keys(TRACKS).map((k) => `${TRACKS[k].short} ${S.curricula[k] ? '있음' : '없음'}`).join(' · ');
  $('#dlgBody').innerHTML = `
    <div class="dh"><h2>기수 만들기</h2><button class="x" data-close>닫기</button></div>
    <form id="fCohort" class="stack">
      <label>기수 번호 <input name="num" type="number" min="1" required placeholder="예: 405"></label>
      <label>입사일(공통 1일차) <input name="start" type="date" required></label>
      <p id="pv" class="hint">입사일을 넣으면 일정이 미리 보입니다.</p>
      <p class="hint">커리큘럼 원본(${have})을 이 기수에 복사합니다. 기본 할 일은 기수 일정 기준표대로 들어갑니다.</p>
      <button class="primary">만들기</button>
    </form>
    <h3>있는 기수</h3>
    <ul class="clist">${list.map((c) => { const s = schedule(c); return `<li><b>${c.number}기</b> 입사 ${fmt(c.start)} · 공통 ${fmt(s[1].date)}~${fmt(s[8].date)} · 전문 ${fmt(s[9].date)}~${fmt(s[20].date)} · 현장 ${fmt(s[21].date)}
      <span class="row"><button data-recopy="${c.id}">커리큘럼 원본 다시 복사</button><button class="danger" data-cdel="${c.id}">기수 지우기</button></span></li>`; }).join('') || '<li class="muted">없음</li>'}</ul>`;
  if (!$('#dlg').open) $('#dlg').showModal();
  const f = $('#fCohort');
  f.start.addEventListener('input', () => {
    if (!f.start.value) return;
    const s = schedule({ start: f.start.value });
    const warn = isOff(f.start.value) ? ' <b class="bad">⚠ 입사일이 쉬는 날입니다</b>' : '';
    const amb = s.filter((d) => AMBIGUOUS[d.date.slice(5)]).map((d) => `${fmt(d.date)} ${AMBIGUOUS[d.date.slice(5)]}`);
    $('#pv').innerHTML = `시작 전 ${fmt(s[0].date)} · 공통 ${fmt(s[1].date)}~${fmt(s[8].date)} · 전문 ${fmt(s[9].date)}~${fmt(s[20].date)} · 현장 ${fmt(s[21].date)}${warn}${amb.length ? '<br>확인할 날: ' + amb.join(', ') : ''}`;
  });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const number = Number(f.num.value);
    if (S.cohorts.some((c) => c.number === number) && !confirm(`${number}기가 이미 있습니다. 하나 더 만들까요?`)) return;
    const tasks = [];
    for (const [key, list2] of Object.entries(DEFAULT_TASKS)) list2.forEach((text) => tasks.push({ id: uid(), key, text, done: false }));
    S.cohorts.push({ id: uid(), number, start: f.start.value, tasks, memos: {}, curr: clone(S.curricula) });
    save(); UI.cursor = f.start.value; UI.view = UI.view === 'table' ? 'month' : UI.view; render(); openCohorts();
  });
}

// ───── 커리큘럼 ─────
function openCurr(track = 'general', draft = null) {
  const cur = draft || S.curricula[track];
  $('#dlgBody').innerHTML = `
    <div class="dh"><h2>커리큘럼 원본</h2><button class="x" data-close>닫기</button></div>
    <div class="tabs">${Object.keys(TRACKS).map((k) => `<button class="chip t-${k} ${k === track ? 'on' : ''}" data-ctab="${k}">${TRACKS[k].short}${S.curricula[k] ? ' ✓' : ''}</button>`).join('')}</div>
    <p class="hint">사진을 Claude 채팅에 올리면 받는 커리큘럼 JSON을 붙여넣거나 파일로 올리세요. 빨간 칸은 빈칸(확인 필요)입니다.</p>
    <textarea id="cj" rows="4" placeholder='{"track":"${track}","days":[{"day":1,"blocks":[{"from":1,"to":4,"subject":"…","instructor":"…"}]}]}'></textarea>
    <div class="row"><input type="file" id="cf" accept=".json,application/json"><button id="cprev">미리보기</button></div>
    ${draft ? '<p class="hint bad">미리보기입니다. 아직 저장 안 됨.</p>' : ''}
    <div class="cgrid">${cur ? currGrid(cur, track) : '<p class="muted">아직 없습니다.</p>'}</div>
    ${draft ? `<div class="stack"><p class="hint">저장하면 ${TRACKS[track].name} 원본이 바뀝니다. 이미 만든 기수에도 적용하려면 고르세요(그 기수 시간표를 덮어씀).</p>
      ${sortedCohorts().map((c) => `<label class="ck"><input type="checkbox" class="applyc" value="${c.id}"> ${c.number}기에도 적용</label>`).join('')}
      <button class="primary" id="csave">원본으로 저장</button></div>` : ''}`;
  $('#dlgBody').dataset.track = track;
  $('#dlgBody').draft = draft;
  if (!$('#dlg').open) $('#dlg').showModal();
}
function currGrid(cur, track) {
  const n = track === 'common' ? 8 : 12;
  const cols = Array.from({ length: n }, (_, i) => i + 1);
  const map = {};
  (cur.days || []).forEach((d) => d.blocks.forEach((b) => { for (let p = b.from; p <= b.to; p++) map[`${d.day}-${p}`] = b; }));
  const head = `<tr><th></th>${cols.map((d) => `<th>${d}일차</th>`).join('')}</tr>`;
  const rows = PERIODS.map(([p]) => {
    if (p === '점심') return `<tr class="lunch"><th>점심</th>${cols.map(() => '<td></td>').join('')}</tr>`;
    return `<tr><th>${p}교시</th>${cols.map((d) => { const b = map[`${d}-${p}`]; return b ? `<td class="${b.from === p ? 'b0' : 'bc'}">${b.from === p ? `${esc(b.subject)}<small>${esc(b.instructor)}</small>` : '〃'}</td>` : '<td class="miss">빈칸</td>'; }).join('')}</tr>`;
  }).join('');
  return `<table class="cg">${head}${rows}</table>`;
}
function parseCurr(text, track) {
  const j = JSON.parse(text);
  if (!Array.isArray(j.days)) throw new Error('days 목록이 없습니다');
  for (const d of j.days) for (const b of d.blocks || []) {
    if (!(b.from >= 1 && b.to <= 8 && b.from <= b.to)) throw new Error(`${d.day}일차 교시 번호가 이상합니다(${b.from}~${b.to})`);
  }
  if (j.track && TRACKS[j.track] && j.track !== track && !confirm(`파일은 ${TRACKS[j.track].name}입니다. 지금 고른 ${TRACKS[track].name}에 넣을까요?`)) throw new Error('취소함');
  return { track, version: j.version || ymd(new Date()), days: j.days.map((d) => ({ day: d.day, blocks: d.blocks || [] })) };
}

// ───── 휴무일 ─────
function openOff() {
  const offs = Object.entries(S.offDays).sort();
  const year = new Date().getFullYear();
  const hol = Object.entries(HOLIDAYS).filter(([d]) => d >= `${year}-01-01`).map(([d, n]) => `<li>${d} ${fmt(d)} ${esc(n)}</li>`).join('');
  $('#dlgBody').innerHTML = `
    <div class="dh"><h2>휴무일</h2><button class="x" data-close>닫기</button></div>
    <p class="hint">회사 휴무를 넣으면 그날을 건너뛰고 일정이 다시 계산됩니다.</p>
    <form id="fOff" class="row"><input type="date" name="d" required><input name="n" placeholder="이름(예: 회사 창립기념일)" required><button class="primary">추가</button></form>
    <ul class="clist">${offs.map(([d, n]) => `<li>${d} ${fmt(d)} ${esc(n)} <button class="danger" data-odel="${d}">빼기</button></li>`).join('') || '<li class="muted">추가한 회사 휴무 없음</li>'}</ul>
    <details><summary>들어 있는 법정 공휴일 (확인 필요)</summary><ul class="hol">${hol}</ul></details>
    <p class="hint">교육일로 세되 표시만 하는 날: ${Object.entries(AMBIGUOUS).map(([k, v]) => `${k} ${v}`).join(' · ')}</p>`;
  if (!$('#dlg').open) $('#dlg').showModal();
  $('#fOff').addEventListener('submit', (e) => { e.preventDefault(); S.offDays[e.target.d.value] = e.target.n.value.trim(); save(); render(); openOff(); });
}

// ───── A4 출력 ─────
function openPrint() {
  const list = sortedCohorts();
  if (!list.length) { alert('기수를 먼저 만드세요.'); return; }
  const dayOpts = (c) => schedule(c).filter((d) => d.kind === 'c' || d.kind === 's').map((d) => `<option value="${d.key}">${d.kind === 'c' ? '공통' : '전문'} ${d.n}일차 · ${fmt(d.date)}</option>`).join('');
  $('#dlgBody').innerHTML = `
    <div class="dh"><h2>A4 한 장 출력</h2><button class="x" data-close>닫기</button></div>
    <form id="fPrint" class="stack">
      <label>기수 <select name="c">${list.map((c) => `<option value="${c.id}">${c.number}기</option>`).join('')}</select></label>
      <label class="ck"><input type="radio" name="kind" value="all" checked> 기수 전체 한 장 (20일, 날마다 주요 할 일)</label>
      <label class="ck"><input type="radio" name="kind" value="day"> 하루 시간표 한 장 (전문은 3개 반 나란히)</label>
      <label>날짜 <select name="d">${dayOpts(list[0])}</select></label>
      <label class="ck"><input type="checkbox" name="trainee"> 교육생용(시간표만, 할 일·메모 뺌)</label>
      <button class="primary">인쇄 화면 열기</button>
    </form>`;
  if (!$('#dlg').open) $('#dlg').showModal();
  const f = $('#fPrint');
  f.c.addEventListener('change', () => { f.d.innerHTML = dayOpts(findCohort(f.c.value)); });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const c = findCohort(f.c.value), trainee = f.trainee.checked;
    $('#print').innerHTML = f.kind.value === 'all' ? printAll(c, trainee) : printDay(c, f.d.value, trainee);
    $('#dlg').close();
    setTimeout(() => window.print(), 50);
  });
}
function printAll(c, trainee) {
  const rows = schedule(c).map((d) => {
    const label = d.kind === 's' ? `전문과정 ${d.n}일차` : dayLabel(d);
    const ts = tasksOf(c, d.key).map((t) => `${t.done ? '☑' : '☐'} ${esc(t.text)}`).join('<br>');
    const memo = c.memos[d.key] ? `<div class="pm">${esc(c.memos[d.key])}</div>` : '';
    return `<tr class="k-${d.kind}"><td class="nw">${fmt(d.date)}</td><td class="nw">${label}</td>${trainee ? '' : `<td>${ts}${memo}</td>`}</tr>`;
  }).join('');
  return `<h1>${c.number}기 교육 일정</h1><p class="psub">입사 ${fmt(c.start)} · 공통 8일 + 전문 12일${trainee ? '' : ' · 강사용'}</p>
    <table class="ptbl"><thead><tr><th>날짜</th><th>일정</th>${trainee ? '' : '<th>할 일 · 메모</th>'}</tr></thead><tbody>${rows}</tbody></table>`;
}
function printDay(c, key, trainee) {
  const d = schedule(c).find((x) => x.key === key);
  const tracks = d.kind === 's' ? SPEC : ['common'];
  const cols = tracks.map((t) => `<div class="pcol"><h2 class="t-${t}">${TRACKS[t].name} ${d.n}일차</h2>${ttHtml(blocksOf(c, t, d.n) || [], false)}</div>`).join('');
  const ts = tasksOf(c, key);
  const extra = trainee ? '' : `<div class="pextra"><b>할 일</b> ${ts.map((t) => `${t.done ? '☑' : '☐'} ${esc(t.text)}`).join(' · ') || '없음'}${c.memos[key] ? `<br><b>메모</b> ${esc(c.memos[key])}` : ''}</div>`;
  return `<h1>${c.number}기 ${d.kind === 's' ? '전문과정' : '공통과정'} ${d.n}일차 시간표</h1><p class="psub">${fmt(d.date)}</p>
    <div class="pcols n${tracks.length}">${cols}</div>${extra}`;
}

// ───── 저장 설정 ─────
function openSync() {
  const s = SYNC || {};
  $('#dlgBody').innerHTML = `
    <div class="dh"><h2>저장 설정 (GitHub)</h2><button class="x" data-close>닫기</button></div>
    <p class="hint">집·회사 PC가 같은 내용을 보려면 GitHub <b>비공개</b> 저장소에 저장합니다. PC마다 처음 한 번만 넣으면 됩니다. 열쇠는 이 브라우저에만 저장됩니다.</p>
    <form id="fSync" class="stack">
      <label>GitHub 아이디 <input name="owner" value="${esc(s.owner || '')}" required placeholder="예: QuokkaBro"></label>
      <label>비공개 저장소 이름 <input name="repo" value="${esc(s.repo || '')}" required placeholder="예: cohort-data"></label>
      <label>열쇠(fine-grained 토큰) <input name="token" type="password" value="${esc(s.token || '')}" required placeholder="github_pat_…"></label>
      <div class="row"><button class="primary">연결하고 저장</button>${SYNC ? '<button type="button" class="danger" id="unsync">연결 끊기(이 PC만)</button>' : ''}</div>
      <p id="syncMsg" class="hint"></p>
    </form>
    <details><summary>열쇠 만드는 법</summary><ol class="hint">
      <li>GitHub → 오른쪽 위 사진 → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</li>
      <li>Repository access: <b>Only select repositories</b> → 비공개 저장소 하나만 고르기</li>
      <li>Permissions → Repository permissions → <b>Contents: Read and write</b></li>
      <li>만든 열쇠(github_pat_…)를 위 칸에 붙여넣기</li></ol></details>`;
  if (!$('#dlg').open) $('#dlg').showModal();
  $('#fSync').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, cfg = { owner: f.owner.value.trim(), repo: f.repo.value.trim(), token: f.token.value.trim(), path: 'planner.json' };
    $('#syncMsg').textContent = '연결 시험 중…';
    try { await pull(cfg); } catch (err) { $('#syncMsg').innerHTML = `<b class="bad">연결 실패: ${esc(err.message === 'Failed to fetch' ? '인터넷 확인' : err.message)}</b>`; return; }
    SYNC = cfg; writeLS(LS_SYNC, SYNC);
    $('#syncMsg').textContent = '연결됨.';
    await startSync();
    $('#dlg').close();
  });
  $('#unsync')?.addEventListener('click', () => { if (!confirm('이 PC에서 GitHub 연결을 끊을까요? 저장소 내용은 그대로 남습니다.')) return; SYNC = null; localStorage.removeItem(LS_SYNC); setStatus('local'); $('#dlg').close(); });
}

// ───── 이벤트 ─────
document.addEventListener('click', (e) => {
  const t = e.target.closest('button, [data-open]'); if (!t) return;
  const d = t.dataset;
  if (d.view) { UI.view = d.view; render(); }
  else if (t.id === 'prev' || t.id === 'next') {
    const dir = t.id === 'prev' ? -1 : 1;
    if (UI.view === 'month') { const c = parse(UI.cursor); UI.cursor = ymd(new Date(c.getFullYear(), c.getMonth() + dir, 1)); }
    else if (UI.view === 'week') UI.cursor = addDays(UI.cursor, 7 * dir);
    render();
  }
  else if (t.id === 'today') { UI.cursor = ymd(new Date()); render(); }
  else if (t.id === 'btnCohort') openCohorts();
  else if (t.id === 'btnCurr') openCurr();
  else if (t.id === 'btnOff') openOff();
  else if (t.id === 'btnPrint') openPrint();
  else if (t.id === 'btnSync') openSync();
  else if (d.open) { const [cid, key, tr] = d.open.split('|'); openDay(cid, key, tr); }
  else if (d.close !== undefined) $('#dlg').close();
  else if (d.tab) { const [cid, key] = $('#dlgBody').dataset.ctx.split('|'); openDay(cid, key, d.tab); }
  else if (d.ttedit) { const [cid, key, tr] = d.ttedit.split('|'); openDay(cid, key, tr, true); }
  else if (d.reopen) { const [cid, key, tr] = d.reopen.split('|'); openDay(cid, key, tr); }
  else if (d.ttsave) {
    const [cid, key, tr] = d.ttsave.split('|'), c = findCohort(cid), n = Number(key.slice(1));
    c.curr ||= {}; c.curr[tr] ||= { track: tr, days: [] };
    const days = c.curr[tr].days, i = days.findIndex((x) => x.day === n), blocks = readEditedBlocks();
    if (i >= 0) days[i].blocks = blocks; else days.push({ day: n, blocks });
    save(); openDay(cid, key, tr);
  }
  else if (d.tdel) { const [cid, id, key, tr] = d.tdel.split('|'), c = findCohort(cid); c.tasks = c.tasks.filter((x) => x.id !== id); save(); render(); openDay(cid, key, tr); }
  else if (d.cdel) { const c = findCohort(d.cdel); if (confirm(`${c.number}기를 지울까요? 할 일·메모·시간표가 같이 지워집니다.`)) { S.cohorts = S.cohorts.filter((x) => x !== c); save(); render(); openCohorts(); } }
  else if (d.recopy) { const c = findCohort(d.recopy); if (confirm(`${c.number}기 시간표를 지금 커리큘럼 원본으로 덮어쓸까요? 이 기수에서 고친 시간표는 사라집니다.`)) { c.curr = clone(S.curricula); save(); alert('복사했습니다.'); } }
  else if (d.ctab) openCurr(d.ctab);
  else if (t.id === 'cprev') {
    const track = $('#dlgBody').dataset.track;
    try { openCurr(track, parseCurr($('#cj').value, track)); } catch (err) { if (err.message !== '취소함') alert('읽을 수 없습니다: ' + err.message); }
  }
  else if (t.id === 'csave') {
    const track = $('#dlgBody').dataset.track, draft = $('#dlgBody').draft;
    S.curricula[track] = draft;
    document.querySelectorAll('.applyc:checked').forEach((cb) => { const c = findCohort(cb.value); (c.curr ||= {})[track] = clone(draft); });
    save(); render(); openCurr(track);
  }
  else if (d.odel) { delete S.offDays[d.odel]; save(); render(); openOff(); }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.task) { const [cid, id] = el.dataset.task.split('|'); const tk = findCohort(cid).tasks.find((x) => x.id === id); tk.done = el.checked; save(); if (UI.view !== 'table') render(); }
  else if (el.id === 'filter') { UI.filter = el.value; render(); }
  else if (el.id === 'cf' && el.files[0]) { el.files[0].text().then((txt) => { $('#cj').value = txt; }); }
});
let memoTimer = null;
document.addEventListener('input', (e) => {
  const el = e.target; if (!el.dataset.memo) return;
  const [cid, key] = el.dataset.memo.split('|'), c = findCohort(cid);
  if (el.value.trim()) c.memos[key] = el.value; else delete c.memos[key];
  clearTimeout(memoTimer); memoTimer = setTimeout(save, 600);
});
document.addEventListener('submit', (e) => {
  const f = e.target; if (!f.dataset.tadd) return;
  e.preventDefault();
  const [cid, key, tr] = f.dataset.tadd.split('|');
  findCohort(cid).tasks.push({ id: uid(), key, text: f.t.value.trim(), done: false });
  save(); render(); openDay(cid, key, tr);
});
$('#dlg').addEventListener('close', () => render());

render();
startSync();
