// ---------- Utilities ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (m) => { m = Math.round(m); const d = ((m % 1440) + 1440) % 1440; return pad(Math.floor(d / 60)) + pad(d % 60); };
const toTimeInput = (m) => { const d = ((Math.round(m) % 1440) + 1440) % 1440; return pad(Math.floor(d / 60)) + ':' + pad(d % 60); };
const fromTimeInput = (v) => { if (!v) return null; const [h, m] = v.split(':').map(Number); return h * 60 + m; };
const parseHHMM = (v) => { v = String(v || '').replace(/\D/g, ''); if (v.length < 3) return null; const h = +v.slice(0, v.length - 2), m = +v.slice(-2); if (h > 23 || m > 59) return null; return h * 60 + m; };
const dateKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return dateKey(d); };
const todayKey = () => dateKey(new Date());
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const niceDate = (k) => { const d = fromKey(k); return pad(d.getDate()) + ' ' + MONTHS[d.getMonth()]; };
const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 86400000);
const addMonthsKey = (k, n) => { const d = fromKey(k); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return dateKey(d); };
const agoText = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); if (m < 60) return m + 'm'; const h = Math.floor(m / 60); return h + 'h' + (m % 60 ? pad(m % 60) + 'm' : ''); };

function mix(hex, other, t) {
  const p = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex), b = p(other);
  return '#' + a.map((v, i) => pad(Math.round(v + (b[i] - v) * t).toString(16))).join('');
}
const tint = (c) => mix(c, '#ffffff', 0.85);
const soft = (c) => mix(c, '#ffffff', 0.93);
const ink = (c) => mix(c, '#000000', 0.38);
const edge = (c) => mix(c, '#ffffff', 0.45);

// ---------- Storage (IndexedDB, one document) ----------
const Store = (() => {
  let db = null;
  function open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('family-schedule', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  }
  function get(key) {
    return new Promise((res) => {
      try {
        const tx = db.transaction('kv', 'readonly').objectStore('kv').get(key);
        tx.onsuccess = () => res(tx.result);
        tx.onerror = () => res(undefined);
      } catch (e) { res(undefined); }
    });
  }
  function put(key, val) {
    return new Promise((res) => {
      try {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(val, key);
        tx.oncomplete = () => res(true);
        tx.onerror = () => res(false);
      } catch (e) { res(false); }
    });
  }
  return { open, get, put };
})();

let S = null; // app data
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => Store.put('state', JSON.stringify(S)), 250);
}
async function loadState() {
  try { await Store.open(); } catch (e) { /* fall through */ }
  let raw = null;
  try { raw = await Store.get('state'); } catch (e) { raw = null; }
  if (raw) { try { S = JSON.parse(raw); } catch (e) { S = null; } }
  if (!S) { S = seedState(); S.settings.createdAt = Date.now(); save(); }
  migrate();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
}
function migrate() {
  const base = seedState();
  for (const k of Object.keys(base)) if (S[k] === undefined) S[k] = base[k];
  for (const k of Object.keys(base.settings)) if (S.settings[k] === undefined) S.settings[k] = base.settings[k];
  if (!S.settings.createdAt) S.settings.createdAt = Date.now();
}

// Undo for the last change
let undoSnap = null;
function snapshot() { undoSnap = JSON.stringify(S); }
function undo() { if (!undoSnap) return false; S = JSON.parse(undoSnap); undoSnap = null; save(); return true; }

// ---------- Lookups ----------
const person = (id) => S.people.find(p => p.id === id) || { id, name: id, color: '#888888' };
const routineById = (id) => S.routines.find(r => r.id === id);
function dayData(k) {
  if (!S.days[k]) S.days[k] = {};
  const d = S.days[k];
  for (const f of ['done', 'skip', 'edits', 'removed', 'moved', 'taskDone', 'slotted', 'lists']) if (!d[f]) d[f] = {};
  if (!d.inserts) d.inserts = [];
  return d;
}
const peekDay = (k) => S.days[k] || {};
const uniq = (a) => Array.from(new Set(a.filter(Boolean)));

// ---------- Tasks / chores ----------
function weekIndex(k) { const d = fromKey(k); const mon = new Date(2024, 0, 1); return Math.floor((d - mon) / (7 * 86400000)); }
function taskAssignees(t, k) {
  const a = t.assign || { type: 'person', people: ['me'] };
  if (a.type === 'rotate' && a.people.length) return [a.people[((weekIndex(k) % a.people.length) + a.people.length) % a.people.length]];
  return a.people || [];
}
function taskDue(t, k) {
  const f = t.freq || { type: 'daily' };
  const dow = fromKey(k).getDay();
  if (f.type === 'daily') return true;
  if (f.type === 'weekly') return (f.days || []).includes(dow);
  if (f.type === 'monthly') return fromKey(k).getDate() === (+f.dom || 1);
  if (f.type === 'everyN') {
    if (!t.lastDone) return true;
    if (t.lastDone === k) return true;
    return daysBetween(t.lastDone, k) >= (+f.n || 7);
  }
  if (f.type === 'once') return f.date === k;
  return false;
}
function freqText(f) {
  if (!f) return '';
  if (f.type === 'daily') return 'Every day';
  if (f.type === 'weekly') return 'Weekly · ' + (f.days || []).map(d => DAY_SHORT[d]).join(', ');
  if (f.type === 'monthly') return 'Monthly · day ' + (f.dom || 1);
  if (f.type === 'everyN') return 'Every ' + (f.n || 7) + ' days';
  if (f.type === 'once') return 'Once · ' + f.date;
  return '';
}

// ---------- Proton events ----------
function protonPeople(ev) {
  return S.proton.assign[ev.uid] || S.proton.titleMap[ev.title.trim().toLowerCase()] || [];
}
function protonOn(k) {
  if (!S.proton.events || !S.proton.events.length) return [];
  return ICS.eventsOn(S.proton.events, fromKey(k));
}

// ---------- The day engine ----------
// Builds a day: expands routines into timed steps, applies today-only edits,
// inserted routines (which push later steps back), skipped steps (which pull
// later steps forward), and flags problems. Fixed items (routine starts and
// your events) never move; a push stops at the next fixed item.
function buildDay(k) {
  const date = fromKey(k);
  const dow = date.getDay();
  const day = peekDay(k);
  const edits = day.edits || {}, removed = day.removed || {}, moved = day.moved || {};
  const done = day.done || {}, skip = day.skip || {};
  let seq = 0;
  const chain = [];
  const loose = [];
  const allDay = [];

  for (const it of S.schedule) {
    const active = it.date ? it.date === k : (it.days || []).includes(dow);
    if (!active || removed[it.id]) continue;
    if (it.until && k > it.until) continue;
    const start = moved[it.id] != null ? moved[it.id] : it.start;
    if (it.kind === 'routine') {
      const r = routineById(it.routineId);
      if (!r) continue;
      let cursor = start;
      let first = true;
      const steps = r.steps.filter(s => !s.days || s.days.includes(dow));
      for (const st of steps) {
        const key = 'r:' + it.id + ':' + st.id;
        const ed = edits[key] || {};
        if (ed.deleted) continue;
        const min = ed.min != null ? ed.min : st.min;
        chain.push({
          key, kind: 'step', seq: seq++, group: 'g:' + it.id, groupName: r.name, routineId: r.id, schedId: it.id, stepId: st.id,
          title: ed.title || st.title, min, base: cursor, anchor: first,
          people: uniq([...(r.people || []), ...(ed.people || st.people || [])]), stepPeople: ed.people || st.people || [],
          optional: !!st.optional, mustEndBy: st.mustEndBy, list: st.list, skipWhen: st.skipWhen,
          color: r.color || person((r.people || ['me'])[0]).color
        });
        cursor += min;
        first = false;
      }
    } else {
      const key = 'e:' + it.id;
      const ed = edits[key] || {};
      chain.push({
        key, kind: 'event', seq: seq++, group: 'e:' + it.id, schedId: it.id, title: ed.title || it.title,
        base: start, min: Math.max(0, (it.end != null ? it.end : it.start + 30) - it.start), anchor: it.fixed !== false,
        people: ed.people || it.people || [], handoff: !!it.handoff, note: it.note || '', oneOff: !!it.date
      });
    }
  }

  // Tasks placed at a time
  for (const t of S.tasks || []) {
    const slotted = (day.slotted || {})[t.id];
    if (slotted == null && !(t.mode === 'slot' && taskDue(t, k))) continue;
    if (slotted == null && t.mode !== 'slot') continue;
    const at = slotted != null ? slotted : (t.time != null ? t.time : 720);
    const tkey = 't:' + t.id;
    loose.push({ key: tkey, kind: 'task', seq: seq++, group: tkey, taskId: t.id, title: t.title, base: at, start: at, min: t.min || 10, people: taskAssignees(t, k), done: !!(day.taskDone || {})[t.id] });
  }

  // Proton events sit on their own time and never push anything.
  for (const ev of protonOn(k)) {
    const s = new Date(ev.start), e = new Date(ev.end);
    const key = 'p:' + ev.uid + ':' + ev.start;
    if (ev.allDay) { allDay.push({ key, kind: 'proton', title: ev.title, people: protonPeople(ev), uid: ev.uid, ev }); continue; }
    const sk = dateKey(s);
    const startMin = sk === k ? s.getHours() * 60 + s.getMinutes() : 0;
    const endMin = dateKey(e) === k ? e.getHours() * 60 + e.getMinutes() : 1440;
    loose.push({ key, kind: 'proton', seq: seq++, group: key, title: ev.title, base: startMin, start: startMin, min: Math.max(0, endMin - startMin), people: protonPeople(ev), uid: ev.uid, ev, notes: ev.notes, location: ev.location });
  }

  chain.sort((a, b) => a.base - b.base || a.seq - b.seq);
  const inserts = (day.inserts || []).slice().sort((a, b) => a.at - b.at);

  const out = [];
  const flags = [];
  let shift = 0, floor = -Infinity, lastEnd = -Infinity, lastItem = null;
  let segTags = new Set();
  let ii = 0;

  const placeInsert = (ins) => {
    const r = routineById(ins.routineId);
    if (!r) return;
    let cursor = ins.at;
    const steps = r.steps;
    const total = steps.reduce((a, s) => a + s.min, 0);
    const actual = ins.min != null ? ins.min : total;
    const scale = total ? actual / total : 1;
    for (const st of steps) {
      const key = 'i:' + ins.id + ':' + st.id;
      const m = Math.round(st.min * scale);
      out.push({
        key, kind: 'insert', seq: seq++, group: 'i:' + ins.id, groupName: r.name, insertId: ins.id, routineId: r.id, stepId: st.id,
        title: st.title, min: m, start: cursor, people: uniq([...(r.people || []), ...(st.people || [])]),
        color: r.color || person((r.people || ['me'])[(r.people || []).length > 1 ? 1 : 0]).color, done: !!done[key]
      });
      cursor += m;
    }
    const startOfIns = ins.at;
    const endOfIns = startOfIns + actual;
    floor = Math.max(floor, endOfIns);
    lastEnd = Math.max(lastEnd, endOfIns);
    lastItem = { title: r.name };
    if (r.tag) segTags.add(r.tag);
  };

  for (const e of chain) {
    while (ii < inserts.length && (e.anchor ? inserts[ii].at < e.base : inserts[ii].at <= Math.max(e.base + shift, floor))) {
      placeInsert(inserts[ii++]);
    }
    let start;
    if (e.anchor) {
      if (lastEnd > e.base && lastItem && e.kind !== 'task') {
        flags.push({ type: 'overrun', text: lastItem.title + ' runs ' + (lastEnd - e.base) + 'm into ' + (e.groupName || e.title) + ' (' + hhmm(e.base) + ')' });
      }
      start = e.base; shift = 0; floor = -Infinity; segTags = new Set();
    } else {
      start = Math.max(e.base + shift, floor);
    }
    const autoSkip = e.skipWhen && segTags.has(e.skipWhen);
    const skipped = !!skip[e.key] || autoSkip;
    const eff = skipped ? 0 : e.min;
    shift = start - e.base - (skipped ? e.min : 0);
    if (e.anchor) shift = -(skipped ? e.min : 0);
    const item = Object.assign({}, e, { start, moved: start - e.base, skipped, autoSkip, done: !!done[e.key] });
    out.push(item);
    if (e.mustEndBy != null && !skipped && start + e.min > e.mustEndBy) {
      flags.push({ type: 'late', text: e.title + ' ends ' + hhmm(start + e.min) + ', after ' + hhmm(e.mustEndBy) });
    }
    if (e.kind === 'event') { lastEnd = -Infinity; lastItem = null; }
    else if (eff > 0 || e.anchor) { lastEnd = start + eff; lastItem = { title: e.groupName || e.title }; }
  }
  while (ii < inserts.length) placeInsert(inserts[ii++]);

  // Double-booked people across fixed events (not routine steps).
  const fixedEv = out.filter(x => x.kind === 'event').concat(loose);
  for (let i = 0; i < fixedEv.length; i++) for (let j = i + 1; j < fixedEv.length; j++) {
    const a = fixedEv[i], b = fixedEv[j];
    if (a.start < b.start + b.min && b.start < a.start + a.min) {
      const both = a.people.filter(p => b.people.includes(p));
      if (both.length) flags.push({ type: 'double', text: both.map(p => person(p).name).join(', ') + ': ' + a.title + ' overlaps ' + b.title + ' (' + hhmm(Math.max(a.start, b.start)) + ')' });
    }
  }

  const all = out.concat(loose).sort((a, b) => a.start - b.start || a.seq - b.seq);
  return { key: k, entries: all, allDay, flags };
}

function visibleFor(entry, filter) {
  if (!filter || !filter.length) return true;
  return entry.people.some(p => filter.includes(p));
}

// ---------- Care log helpers ----------
function careFor(k) {
  const start = fromKey(k).getTime(), end = start + 86400000;
  return S.care.filter(c => c.ts >= start && c.ts < end).sort((a, b) => a.ts - b.ts);
}
function lastCare(type) {
  let best = null;
  for (const c of S.care) if (c.type === type && (!best || c.ts > best.ts)) best = c;
  return best;
}
function careText(c) {
  const d = c.data || {};
  if (c.type === 'feed') return 'Feed' + (d.side ? ' · ' + d.side : '') + (d.min ? ' · ' + d.min + 'm' : '') + (d.note ? ' · ' + d.note : '');
  if (c.type === 'diaper') {
    const parts = ['Diaper · ' + (d.kind || 'pee')];
    if (d.kind && d.kind !== 'pee') { if (d.color) parts.push(d.color); if (d.consistency) parts.push(d.consistency); if (d.amount) parts.push(d.amount); }
    if (d.note) parts.push(d.note);
    return parts.join(' · ');
  }
  if (c.type === 'hygiene') return (d.what || 'Hygiene') + (d.note ? ' · ' + d.note : '');
  return 'Note · ' + (d.note || '');
}

// ---------- Share text ----------
function scheduleText(k, filter, opts = {}) {
  const b = buildDay(k);
  const d = fromKey(k);
  const who = filter && filter.length ? filter.map(p => person(p).name).join(' + ') : 'Everyone';
  const lines = [DAY_LONG[d.getDay()] + ' ' + niceDate(k) + ' · ' + who, ''];
  for (const a of b.allDay) if (visibleFor(a, filter)) lines.push('All day  ' + a.title);
  let lastGroup = null;
  for (const e of b.entries) {
    if (e.skipped) continue;
    if (!visibleFor(e, filter)) continue;
    const isGroup = e.kind === 'step' || e.kind === 'insert';
    if (isGroup && e.group !== lastGroup) {
      const members = b.entries.filter(x => x.group === e.group && !x.skipped);
      const last = members[members.length - 1];
      lines.push('');
      lines.push('— ' + e.groupName + ' ' + hhmm(members[0].start) + '–' + hhmm(last.start + last.min) + ' —');
    }
    if (!isGroup && lastGroup !== null && /^[gi]:/.test(lastGroup)) lines.push('');
    const tag = e.kind === 'step' || e.kind === 'insert' ? (e.stepPeople && e.stepPeople.length && opts.tags !== false ? ' (' + e.stepPeople.map(p => person(p).name).join(', ') + ')' : '') : (e.people.length && opts.tags !== false ? ' (' + e.people.map(p => person(p).name).join(', ') + ')' : '');
    const range = !isGroup && e.min ? hhmm(e.start) + '–' + hhmm(e.start + e.min) : hhmm(e.start);
    lines.push(range + '  ' + (e.handoff ? 'HANDOFF: ' : '') + e.title + tag);
    lastGroup = e.group;
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
