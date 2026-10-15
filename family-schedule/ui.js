// ---------- UI state ----------
const ui = {
  tab: 'day', page: null, pageArg: null,
  date: todayKey(), careDate: todayKey(),
  filter: [], showVisitors: false, collapsed: {},
  sheet: null
};

// ---------- Small builders ----------
function tag(pid) {
  const p = person(pid);
  return `<span class="tag" style="background:${tint(p.color)};color:${ink(p.color)}">${esc(p.name)}</span>`;
}
function tags(ids) { return (ids || []).map(tag).join(' '); }
function peoplePicker(selected, opts = {}) {
  const sel = new Set(selected || []);
  const list = S.people.filter(p => p.core || sel.has(p.id) || opts.all);
  const extra = S.people.filter(p => !list.includes(p));
  const btn = (p) => `<button type="button" class="pchip${sel.has(p.id) ? ' on' : ''}" data-toggle data-pid="${p.id}" style="--c:${p.color};--t:${tint(p.color)};--i:${ink(p.color)}">${esc(p.name)}</button>`;
  return `<div class="pick" data-pick="people">${list.map(btn).join('')}${extra.length ? `<details class="more-people"><summary>Visitors</summary><div class="pick-inner">${extra.map(btn).join('')}</div></details>` : ''}</div>`;
}
const readPeople = (root) => $$('[data-pick=people] .pchip.on', root).map(b => b.dataset.pid);
function daysPicker(selected) {
  const sel = new Set(selected || []);
  const order = [1, 2, 3, 4, 5, 6, 0];
  return `<div class="days" data-pick="days">${order.map(d => `<button type="button" class="dchip${sel.has(d) ? ' on' : ''}" data-toggle data-day="${d}" aria-label="${DAY_LONG[d]}">${DAY_LETTER[d]}</button>`).join('')}</div>`;
}
const readDays = (root, sel = '[data-pick=days]') => $$(sel + ' .dchip.on', root).map(b => +b.dataset.day).sort();
function seg(name, options, value) {
  return `<div class="seg" data-seg="${name}">${options.map(([v, l]) => `<button type="button" class="${String(v) === String(value) ? 'on' : ''}" data-segv="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
}
const readSeg = (root, name) => { const b = $(`[data-seg="${name}"] .on`, root); return b ? b.dataset.segv : null; };
const field = (label, input) => `<label class="field"><span>${esc(label)}</span>${input}</label>`;
const timeInput = (name, m) => `<input type="time" name="${name}" value="${m == null ? '' : toTimeInput(m)}">`;
const val = (root, name) => { const el = $(`[name="${name}"]`, root); return el ? el.value : ''; };
const checked = (root, name) => { const el = $(`[name="${name}"]`, root); return !!(el && el.checked); };

function chipsRow() {
  const core = S.people.filter(p => p.core);
  const vis = S.people.filter(p => !p.core);
  const on = new Set(ui.filter);
  const chip = (p) => `<button class="fchip${on.has(p.id) ? ' on' : ''}" data-act="filter" data-pid="${p.id}" style="--c:${p.color};--t:${tint(p.color)};--i:${ink(p.color)};--e:${edge(p.color)}">${esc(p.name)}</button>`;
  return `<div class="chips">
    <button class="fchip all${ui.filter.length ? '' : ' on'}" data-act="filter" data-pid="">Everyone</button>
    ${core.map(chip).join('')}
    ${ui.showVisitors ? vis.map(chip).join('') + `<button class="fchip ghost" data-act="visitors">Hide visitors</button>` : `<button class="fchip ghost" data-act="visitors">+ Visitors</button>`}
  </div>`;
}

// ---------- Render root ----------
function render() {
  const app = $('#app');
  let body = '';
  if (ui.tab === 'day') body = viewDay();
  else if (ui.tab === 'week') body = viewWeek();
  else if (ui.tab === 'care') body = viewCare();
  else body = viewMore();
  app.innerHTML = body + navBar();
  renderSheet();
}
function navBar() {
  const t = (id, label) => `<button class="${ui.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">${label}</button>`;
  return `<nav class="nav">${t('day', 'Today')}${t('week', 'Week')}${t('care', 'Care')}${t('more', 'More')}</nav>`;
}

// ---------- Day ----------
function viewDay() {
  const k = ui.date;
  const d = fromKey(k);
  const b = buildDay(k);
  const isToday = k === todayKey();
  const school = S.schedule.some(s => s.id === 's-school' && !s.date && (s.days || []).includes(d.getDay()));
  let h = `<header class="top">
    <div class="datebox">
      <div class="sub">${DAY_LONG[d.getDay()]}${school ? ' · school day' : ''}${isToday ? ' · today' : ''}</div>
      <div class="big">${niceDate(k)}</div>
    </div>
    <div class="top-actions">
      <button class="icon" data-act="day" data-n="-1" aria-label="Previous day">‹</button>
      ${isToday ? '' : `<button class="small" data-act="today">Today</button>`}
      <button class="icon" data-act="day" data-n="1" aria-label="Next day">›</button>
      <button class="primary" data-act="share">Share</button>
    </div>
  </header>
  <div class="bar">${chipsRow()}</div>`;

  const flags = b.flags;
  if (flags.length) {
    h += `<section class="flags">${flags.map((f, i) => `<div class="flag"><div>${esc(f.text)}</div><button class="small light" data-act="flagShare" data-i="${i}">Message</button></div>`).join('')}</section>`;
  }
  const since = Date.now() - (S.settings.lastBackup || S.settings.createdAt || Date.now());
  if (since > 7 * 86400000) {
    h += `<section class="notice"><div>No backup in ${Math.floor(since / 86400000)} days.</div><button class="small" data-act="goto" data-page="backup">Back up</button></section>`;
  }

  // Anytime tray
  const day = peekDay(k);
  const tray = (S.tasks || []).filter(t => t.mode !== 'slot' && taskDue(t, k) && (day.slotted || {})[t.id] == null)
    .filter(t => visibleFor({ people: taskAssignees(t, k) }, ui.filter));
  if (tray.length) {
    h += `<section class="card"><div class="label">Today, anytime</div>${tray.map(t => {
      const doneT = !!(day.taskDone || {})[t.id];
      return `<div class="trow${doneT ? ' done' : ''}">
        <button class="cb${doneT ? ' on' : ''}" data-act="taskDone" data-id="${t.id}" aria-label="Done: ${esc(t.title)}"></button>
        <button class="tlabel" data-act="editTask" data-id="${t.id}">${esc(t.title)}</button>
        ${tags(taskAssignees(t, k))}
        ${doneT ? '' : `<button class="small light" data-act="slotTask" data-id="${t.id}">Slot it</button>`}
      </div>`;
    }).join('')}</section>`;
  }
  const allDay = b.allDay.filter(a => visibleFor(a, ui.filter) || !a.people.length);
  if (allDay.length) h += `<section class="allday">${allDay.map(a => `<button class="ad" data-act="proton" data-key="${esc(a.key)}">All day · ${esc(a.title)} ${tags(a.people)}</button>`).join('')}</section>`;

  h += `<section class="timeline">${timelineHTML(b, isToday)}</section>`;

  if (!ui.filter.length || ui.filter.includes('anaise')) h += careStrip();
  h += `<div class="addrow"><button class="add" data-act="add">+ Add</button></div>`;
  return `<main class="view">${h}</main>`;
}

function buildBlocks(entries) {
  const raw = [];
  for (const e of entries) {
    const grouped = e.kind === 'step' || e.kind === 'insert';
    const last = raw[raw.length - 1];
    if (grouped && last && last.group === e.group) last.items.push(e);
    else raw.push({ group: grouped ? e.group : e.key, kind: e.kind, items: [e] });
  }
  // Fold an inserted routine into the routine it interrupts.
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const b = raw[i];
    const prev = out[out.length - 1];
    if (b.kind === 'insert' && prev && prev.kind === 'step') {
      let j = i + 1;
      const ins = [b];
      while (j < raw.length && raw[j].kind === 'insert') { ins.push(raw[j]); j++; }
      if (j < raw.length && raw[j].group === prev.group) {
        for (const x of ins) prev.items.push({ nested: x });
        prev.items.push(...raw[j].items);
        i = j;
        continue;
      }
    }
    out.push(b);
  }
  return out;
}

function timelineHTML(b, isToday) {
  const vis = b.entries.filter(e => visibleFor(e, ui.filter));
  if (!vis.length) return `<div class="empty">Nothing scheduled${ui.filter.length ? ' for this selection' : ''}.</div>`;
  const blocks = buildBlocks(vis);
  const now = nowMin();
  let nowPlaced = !isToday;
  let h = '';
  for (const bl of blocks) {
    const first = bl.items.find(x => !x.nested) || bl.items[0];
    if (!nowPlaced && first.start > now) { h += nowLine(now); nowPlaced = true; }
    if (bl.kind === 'step' || bl.kind === 'insert') h += groupHTML(bl, isToday, now);
    else h += itemHTML(first);
  }
  if (!nowPlaced) h += nowLine(now);
  return h;
}
const nowLine = (m) => `<div class="now"><span>${hhmm(m)}</span></div>`;

function stepRow(e) {
  const moved = e.moved && !e.skipped && e.kind === 'step' ? `<span class="moved">${e.moved > 0 ? '+' : '−'}${Math.abs(e.moved)}m</span>` : '';
  const title = (e.optional ? 'If needed: ' : '') + e.title;
  const note = e.skipped ? (e.autoSkip ? ' <span class="muted">(done in poo routine)</span>' : ' <span class="muted">(skipped)</span>') : '';
  const listLink = e.list && !e.skipped ? ` <button class="link" data-act="openList" data-id="${e.list}">${esc((S.lists.find(l => l.id === e.list) || {}).name || 'List')} ›</button>` : '';
  return `<div class="srow${e.done ? ' done' : ''}${e.skipped ? ' skipped' : ''}${e.optional ? ' opt' : ''}">
    <button class="cb${e.done ? ' on' : ''}" data-act="done" data-key="${esc(e.key)}" aria-label="Done: ${esc(e.title)}"></button>
    <div class="t">${hhmm(e.start)}</div>
    <button class="stitle" data-act="step" data-key="${esc(e.key)}">${esc(title)}${note} ${e.kind === 'step' ? tags(e.stepPeople) : ''}</button>${listLink}
    ${moved}
  </div>`;
}

function groupHTML(bl, isToday, now) {
  const items = bl.items.filter(x => !x.nested);
  const first = items[0];
  const live = items.filter(x => !x.skipped);
  const lastLive = live[live.length - 1] || first;
  const endM = lastLive.start + lastLive.min;
  const c = first.color || '#0e6e5c';
  const finished = isToday && endM <= now && items.every(x => x.done || x.skipped);
  const key = ui.date + '|' + bl.group;
  const collapsed = ui.collapsed[key] != null ? ui.collapsed[key] : finished;
  const isInsert = bl.kind === 'insert';
  let inner = '';
  if (collapsed) {
    inner = `<div class="sum">${items.length} steps · ${items.filter(x => x.done).length} done</div>`;
  } else {
    for (const it of bl.items) {
      if (it.nested) inner += nestedHTML(it.nested);
      else inner += stepRow(it);
    }
  }
  return `<div class="band" style="--c:${c};--t:${soft(c)};--i:${ink(c)};--e:${edge(c)}">
    <div class="bhead">
      <button class="bname" data-act="group" data-group="${esc(bl.group)}">${esc(first.groupName)}</button>
      <span class="brange">${hhmm(first.start)}–${hhmm(endM)}</span>
    </div>
    ${inner}
    <div class="bfoot">
      <button class="small light" data-act="collapse" data-k="${esc(key)}" data-v="${collapsed ? 0 : 1}">${collapsed ? 'Expand' : 'Collapse'}</button>
      ${isInsert ? insertActions(first.insertId) : ''}
    </div>
  </div>`;
}
function insertActions(id) {
  const isToday = ui.date === todayKey();
  return `${isToday ? `<button class="small light" data-act="insDone" data-id="${id}">Finished now</button>` : ''}<button class="small light" data-act="insRemove" data-id="${id}">Remove</button>`;
}
function nestedHTML(bl) {
  const first = bl.items[0];
  const last = bl.items[bl.items.length - 1];
  const c = first.color;
  return `<div class="nested" style="--c:${c};--t:${soft(c)};--i:${ink(c)};--e:${edge(c)}">
    <div class="bhead"><span class="bname static">${esc(first.groupName)}</span><span class="brange">${hhmm(first.start)}–${hhmm(last.start + last.min)}</span></div>
    ${bl.items.map(stepRow).join('')}
    <div class="bfoot">${insertActions(first.insertId)}</div>
  </div>`;
}

function itemHTML(e) {
  const range = e.min ? `${hhmm(e.start)}–${hhmm(e.start + e.min)}` : hhmm(e.start);
  if (e.kind === 'event' && e.handoff) {
    return `<div class="row"><div class="t">${hhmm(e.start)}</div><button class="handoff" data-act="event" data-key="${esc(e.key)}">Handoff · ${esc(e.title)} ${tags(e.people)}</button></div>`;
  }
  if (e.kind === 'proton') {
    return `<div class="row"><div class="t">${hhmm(e.start)}</div><button class="ecard proton" data-act="proton" data-key="${esc(e.key)}">
      <span class="etitle">${esc(e.title)}</span><span class="emeta">${range} · From Proton ${e.people.length ? tags(e.people) : '<span class="warn">Tap to assign people</span>'}</span></button></div>`;
  }
  if (e.kind === 'task') {
    return `<div class="row${e.done ? ' done' : ''}"><div class="t">${hhmm(e.start)}</div><div class="ecard task">
      <button class="cb${e.done ? ' on' : ''}" data-act="taskDone" data-id="${e.taskId}" aria-label="Done: ${esc(e.title)}"></button>
      <button class="etitle tbtn" data-act="slotTask" data-id="${e.taskId}">${esc(e.title)}</button>${tags(e.people)}</div></div>`;
  }
  const single = e.people.length === 1 ? person(e.people[0]) : null;
  const style = single ? `style="background:${tint(single.color)};border-color:${tint(single.color)};color:${ink(single.color)}"` : '';
  return `<div class="row"><div class="t">${hhmm(e.start)}</div><button class="ecard" ${style} data-act="event" data-key="${esc(e.key)}">
    <span class="etitle">${esc(e.title)}</span><span class="emeta">${range}${single ? ' · ' + esc(single.name) : ' ' + tags(e.people)}${e.note ? ' · ' + esc(e.note) : ''}</span></button></div>`;
}

function careStrip() {
  const lf = lastCare('feed');
  const todayC = careFor(todayKey());
  const wet = todayC.filter(c => c.type === 'diaper' && (c.data.kind === 'pee' || c.data.kind === 'both')).length;
  const dirty = todayC.filter(c => c.type === 'diaper' && (c.data.kind === 'poo' || c.data.kind === 'both')).length;
  const quick = S.routines.filter(r => r.quick);
  return `<section class="card care">
    <div class="label">Anaise · care log</div>
    <div class="status">${lf ? `Last feed <b>${agoText(Date.now() - lf.ts)} ago</b>` : 'No feeds logged yet'} · ${wet} wet / ${dirty} dirty today</div>
    <div class="cbtns">
      <button class="cbtn" data-act="careAdd" data-type="feed">+ Feed</button>
      <button class="cbtn" data-act="careAdd" data-type="diaper">+ Diaper</button>
      <button class="cbtn" data-act="careAdd" data-type="hygiene">+ Hygiene</button>
      ${quick.map(r => `<button class="cbtn strong" data-act="quick" data-id="${r.id}">+ ${esc(r.name)}</button>`).join('')}
    </div>
  </section>`;
}

// ---------- Week ----------
function weekStartKey(k) { const d = fromKey(k); const off = (d.getDay() + 6) % 7; return addDays(k, -off); }
function viewWeek() {
  const ws = weekStartKey(ui.date);
  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  const PX = 40;
  const built = days.map(k => buildDay(k));
  let lo = 7 * 60, hi = 22 * 60;
  const blocksPer = built.map(b => {
    const vis = b.entries.filter(e => visibleFor(e, ui.filter) && !e.skipped && e.kind !== 'insert');
    const groups = {};
    const blocks = [];
    for (const e of vis) {
      if (e.kind === 'step' || e.kind === 'insert') {
        const g = groups[e.group] || (groups[e.group] = { title: e.groupName, start: e.start, end: e.start + e.min, color: e.color, kind: e.kind });
        g.start = Math.min(g.start, e.start); g.end = Math.max(g.end, e.start + e.min);
      } else {
        const one = e.people.length === 1 ? person(e.people[0]).color : null;
        blocks.push({ title: e.title, start: e.start, end: e.start + Math.max(e.min, 10), kind: e.kind, color: one });
      }
    }
    for (const g of Object.values(groups)) blocks.push({ title: g.title.replace(' routine', ''), start: g.start, end: Math.max(g.end, g.start + 10), kind: g.kind, color: g.color, routine: true });
    blocks.sort((a, b) => a.start - b.start);
    // lanes for overlaps
    const laneEnds = [];
    for (const bl of blocks) {
      let lane = laneEnds.findIndex(end => end <= bl.start);
      if (lane < 0) { lane = laneEnds.length; laneEnds.push(0); }
      laneEnds[lane] = bl.end; bl.lane = lane;
    }
    for (const bl of blocks) {
      const over = blocks.filter(o => o.start < bl.end && bl.start < o.end);
      bl.lanes = Math.max(...over.map(o => o.lane)) + 1;
      lo = Math.min(lo, Math.floor(bl.start / 60) * 60); hi = Math.max(hi, Math.ceil(bl.end / 60) * 60);
    }
    return blocks;
  });
  hi = Math.min(hi, 24 * 60);
  const height = (hi - lo) / 60 * PX;
  const y = (m) => (m - lo) / 60 * PX;
  const tk = todayKey();
  let hours = '';
  for (let m = lo; m <= hi; m += 60) hours += `<div class="hl" style="top:${y(m) - 7}px">${hhmm(m)}</div>`;
  let lines = '';
  for (let m = lo; m <= hi; m += 60) lines += `<div class="hline" style="top:${y(m)}px"></div>`;
  const cols = days.map((k, i) => {
    const bl = blocksPer[i].map(b => {
      const c = b.color || '#8a887f';
      const shared = !b.color;
      const st = b.kind === 'proton'
        ? `background:#fff;border:1.5px dashed #6f95bd;color:#163a5a`
        : shared ? `background:#fff;border:1.5px solid #b9b7ad;color:#1d1d1b`
          : `background:${tint(c)};border:1.5px solid ${edge(c)};color:${ink(c)}`;
      const w = 100 / b.lanes;
      const hgt = y(b.end) - y(b.start);
      return `<button class="wb" data-act="openDay" data-k="${k}" style="top:${y(b.start)}px;height:${hgt}px;left:calc(${w * b.lane}% + 1px);width:calc(${w}% - 2px);${st}">${hgt >= 18 ? esc(b.title) : ''}</button>`;
    }).join('');
    return `<div class="wcol${i % 2 ? '' : ' alt'}" style="height:${height}px">${lines}${bl}</div>`;
  }).join('');
  const heads = days.map(k => { const d = fromKey(k); return `<button class="wh${k === tk ? ' today' : ''}${k === ui.date ? ' sel' : ''}" data-act="openDay" data-k="${k}"><span>${DAY_SHORT[d.getDay()]}</span><b>${pad(d.getDate())}</b></button>`; }).join('');
  const end = addDays(ws, 6);
  return `<main class="view">
    <header class="top">
      <div class="datebox"><div class="sub">Week of</div><div class="big">${fromKey(ws).getDate()} – ${niceDate(end)}</div></div>
      <div class="top-actions">
        <button class="icon" data-act="week" data-n="-7" aria-label="Previous week">‹</button>
        <button class="icon" data-act="week" data-n="7" aria-label="Next week">›</button>
        <button class="primary" data-act="share" data-mode="week">Share</button>
      </div>
    </header>
    <div class="bar">${chipsRow()}</div>
    <section class="week">
      <div class="wgrid"><div></div>${heads}</div>
      <div class="wgrid"><div class="hours" style="height:${height}px">${hours}</div>${cols}</div>
      <div class="legend">Tap a day to open it. Turn the phone sideways for more room.</div>
    </section>
  </main>`;
}

// ---------- Care ----------
function viewCare() {
  const k = ui.careDate;
  const list = careFor(k);
  const lf = lastCare('feed');
  const next = lf ? lf.ts + S.settings.feedEveryMin * 60000 : null;
  const wet = list.filter(c => c.type === 'diaper' && (c.data.kind === 'pee' || c.data.kind === 'both')).length;
  const dirty = list.filter(c => c.type === 'diaper' && (c.data.kind === 'poo' || c.data.kind === 'both')).length;
  const feeds = list.filter(c => c.type === 'feed').length;
  const lastBath = lastCare('hygiene');
  const quick = S.routines.filter(r => r.quick);
  const timeOf = (ts) => { const d = new Date(ts); return hhmm(d.getHours() * 60 + d.getMinutes()); };
  return `<main class="view">
    <header class="top">
      <div class="datebox"><div class="sub">Anaise · care log</div><div class="big">${niceDate(k)}</div></div>
      <div class="top-actions">
        <button class="icon" data-act="careDay" data-n="-1" aria-label="Previous day">‹</button>
        ${k === todayKey() ? '' : `<button class="small" data-act="careToday">Today</button>`}
        <button class="icon" data-act="careDay" data-n="1" aria-label="Next day">›</button>
        <button class="primary" data-act="shareCare">Share</button>
      </div>
    </header>
    <section class="card">
      <div class="status big">${lf ? `Last feed <b>${agoText(Date.now() - lf.ts)} ago</b> (${timeOf(lf.ts)})` : 'No feeds logged yet'}</div>
      ${next ? `<div class="muted">Next feed around ${timeOf(next)} · every ${Math.round(S.settings.feedEveryMin / 60 * 10) / 10}h</div>` : ''}
      <div class="stats"><div><b>${feeds}</b><span>feeds</span></div><div><b>${wet}</b><span>wet</span></div><div><b>${dirty}</b><span>dirty</span></div></div>
      ${lastBath ? `<div class="muted">Last hygiene: ${esc(careText(lastBath))} · ${niceDate(dateKey(new Date(lastBath.ts)))}</div>` : ''}
      <div class="cbtns">
        <button class="cbtn" data-act="careAdd" data-type="feed">+ Feed</button>
        <button class="cbtn" data-act="careAdd" data-type="diaper">+ Diaper</button>
        <button class="cbtn" data-act="careAdd" data-type="hygiene">+ Hygiene</button>
        <button class="cbtn" data-act="careAdd" data-type="note">+ Note</button>
        ${quick.map(r => `<button class="cbtn strong" data-act="quick" data-id="${r.id}">+ ${esc(r.name)}</button>`).join('')}
      </div>
    </section>
    <section class="card">
      <div class="label">Log · ${niceDate(k)}</div>
      ${list.length ? list.map(c => `<button class="logrow" data-act="careEdit" data-id="${c.id}"><span class="t">${timeOf(c.ts)}</span><span>${esc(careText(c))}</span></button>`).join('') : '<div class="empty">Nothing logged.</div>'}
    </section>
    <section class="card">
      <div class="label">Feed reminder interval</div>
      <div class="inline">${seg('feedEvery', [[150, '2.5h'], [180, '3h'], [210, '3.5h'], [240, '4h']], S.settings.feedEveryMin)}</div>
    </section>
  </main>`;
}

// ---------- More ----------
const PAGES = [
  ['routines', 'Routines', 'Steps, minutes, who'],
  ['schedule', 'Repeating events & routine times', 'Preschool, lunch, when routines start'],
  ['tasks', 'Chores & tasks', 'Daily, weekly, rotating'],
  ['lists', 'Checklists', 'Backpack, diaper bag'],
  ['due', 'Due tracker', 'Appointments and upkeep'],
  ['watch', 'Event watchlist', 'Yearly events and notes'],
  ['people', 'People & colors', 'Names, colors, notes'],
  ['proton', 'Proton calendar', 'Import events'],
  ['caregiver', 'Caregiver info', 'Contacts for caregiver sheet'],
  ['backup', 'Backup & restore', 'Save a copy of everything']
];
function viewMore() {
  if (ui.page) return `<main class="view">${pageHTML()}</main>`;
  return `<main class="view"><header class="top"><div class="datebox"><div class="sub">Settings &amp; lists</div><div class="big">More</div></div></header>
    <section class="menu">${PAGES.map(([id, t, s]) => `<button class="mrow" data-act="goto" data-page="${id}"><span><b>${esc(t)}</b><small>${esc(s)}</small></span><span>›</span></button>`).join('')}</section>
    <p class="foot muted">Family Schedule · v${APP_VERSION} · data stays on this phone</p></main>`;
}
function pageHead(title, sub, action) {
  return `<header class="top"><div class="datebox"><button class="back" data-act="back">‹ ${ui.page && ui.pageArg ? 'Back' : 'More'}</button><div class="big">${esc(title)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>${action ? `<div class="top-actions">${action}</div>` : ''}</header>`;
}
function pageHTML() {
  const p = ui.page;
  if (p === 'routines') return pageHead('Routines', 'Tap one to edit its steps', `<button class="primary" data-act="newRoutine">+ New</button>`) +
    `<section class="menu">${S.routines.map(r => `<button class="mrow" data-act="routine" data-id="${r.id}" style="border-left:4px solid ${r.color || person((r.people || ['me'])[0]).color}"><span><b>${esc(r.name)}</b><small>${r.steps.length} steps · ${r.steps.reduce((a, s) => a + s.min, 0)}m${r.quick ? ' · quick add' : ''}</small></span><span>›</span></button>`).join('')}</section>`;
  if (p === 'routine') return routinePage(ui.pageArg);
  if (p === 'schedule') return pageHead('Repeating events', 'Routine start times and fixed events', `<button class="primary" data-act="newEvent">+ Event</button>`) +
    `<section class="menu">${S.schedule.slice().sort((a, b) => a.start - b.start).map(it => {
      const name = it.kind === 'routine' ? (routineById(it.routineId) || {}).name : it.title;
      const when = it.date ? niceDate(it.date) : (it.days || []).length === 7 ? 'Every day' : (it.days || []).map(d => DAY_SHORT[d]).join(', ');
      return `<button class="mrow" data-act="sched" data-id="${it.id}"><span><b>${hhmm(it.start)}${it.end != null ? '–' + hhmm(it.end) : ''} · ${esc(name)}</b><small>${it.kind === 'routine' ? 'Routine' : 'Event'} · ${esc(when)}</small></span><span>›</span></button>`;
    }).join('')}</section><div class="addrow"><button class="add" data-act="newSchedRoutine">+ Routine at a time</button></div>`;
  if (p === 'tasks') return pageHead('Chores & tasks', 'Anytime tray or a fixed time', `<button class="primary" data-act="editTask" data-id="">+ New</button>`) +
    `<section class="menu">${(S.tasks || []).map(t => `<button class="mrow" data-act="editTask" data-id="${t.id}"><span><b>${esc(t.title)}</b><small>${esc(freqText(t.freq))} · ${t.mode === 'slot' ? 'at ' + hhmm(t.time || 720) : 'anytime'} · ${t.assign && t.assign.type === 'rotate' ? 'rotates ' : ''}${(t.assign && t.assign.people || []).map(x => person(x).name).join(' / ')}</small></span><span>›</span></button>`).join('') || '<div class="empty">No chores yet.</div>'}</section>`;
  if (p === 'lists') return pageHead('Checklists', '', `<button class="primary" data-act="newList">+ New</button>`) +
    `<section class="menu">${S.lists.map(l => `<button class="mrow" data-act="gotoList" data-id="${l.id}"><span><b>${esc(l.name)}</b><small>${l.items.length} items · ${esc(person(l.personId).name)}</small></span><span>›</span></button>`).join('')}</section>`;
  if (p === 'list') return listPage(ui.pageArg);
  if (p === 'due') return duePage();
  if (p === 'watch') return watchPage();
  if (p === 'people') return pageHead('People & colors', 'Core people show as filter chips', `<button class="primary" data-act="editPerson" data-id="">+ New</button>`) +
    `<section class="menu">${S.people.map(x => `<button class="mrow" data-act="editPerson" data-id="${x.id}"><span class="pdot" style="background:${x.color}"></span><span class="grow"><b>${esc(x.name)}</b><small>${x.core ? 'Household' : 'Visitor'}${x.notes ? ' · ' + esc(x.notes.slice(0, 40)) : ''}</small></span><span>›</span></button>`).join('')}</section>`;
  if (p === 'proton') return protonPage();
  if (p === 'caregiver') return pageHead('Caregiver info', 'Goes on the caregiver sheet') +
    `<section class="card"><label class="field"><span>Contacts (you, husband, pediatrician, emergency)</span><textarea name="contacts" rows="6" data-change="contacts">${esc(S.settings.contacts)}</textarea></label>
    <p class="muted">Each child's standing info (allergies, routines, where things are) goes in their notes under People &amp; colors.</p></section>`;
  if (p === 'backup') return backupPage();
  return '';
}

function routinePage(id) {
  const r = routineById(id);
  if (!r) return pageHead('Routine not found');
  const c = r.color || person((r.people || ['me'])[0]).color;
  let t = 0;
  return pageHead(r.name, r.steps.reduce((a, s) => a + s.min, 0) + ' minutes total', `<button class="small" data-act="routineMeta" data-id="${r.id}">Edit details</button>`) +
    `<section class="band static" style="--c:${c};--t:${soft(c)};--i:${ink(c)};--e:${edge(c)}">
      ${r.steps.map((s, i) => { const at = t; t += s.min; return `<div class="erow">
        <div class="t">+${at}m</div>
        <button class="stitle" data-act="tplStep" data-rid="${r.id}" data-sid="${s.id}">${s.optional ? 'If needed: ' : ''}${esc(s.title)} <span class="muted">${s.min}m${s.days ? ' · ' + s.days.map(d => DAY_SHORT[d]).join('/') : ''}${s.mustEndBy != null ? ' · by ' + hhmm(s.mustEndBy) : ''}</span> ${tags(s.people)}</button>
        <div class="ord"><button class="icon s" data-act="stepMove" data-rid="${r.id}" data-i="${i}" data-d="-1" aria-label="Move up">↑</button><button class="icon s" data-act="stepMove" data-rid="${r.id}" data-i="${i}" data-d="1" aria-label="Move down">↓</button></div>
      </div>`; }).join('')}
    </section>
    <div class="addrow"><button class="add" data-act="tplStep" data-rid="${r.id}" data-sid="">+ Add step</button></div>
    <p class="muted pad">Times are minutes from the routine's start. Start times are set under Repeating events.</p>`;
}

function listPage(id) {
  const l = S.lists.find(x => x.id === id);
  if (!l) return pageHead('List not found');
  return pageHead(l.name, person(l.personId).name, `<button class="small" data-act="listMeta" data-id="${l.id}">Edit</button>`) +
    `<section class="menu">${l.items.map(it => `<button class="mrow" data-act="listItem" data-lid="${l.id}" data-id="${it.id}"><span><b>${esc(it.title)}</b><small>${(it.days || []).length === 7 ? 'Every day' : (it.days || []).map(d => DAY_SHORT[d]).join(', ')}${it.note ? ' · ' + esc(it.note) : ''}</small></span><span>›</span></button>`).join('') || '<div class="empty">No items yet.</div>'}</section>
    <div class="addrow"><button class="add" data-act="listItem" data-lid="${l.id}" data-id="">+ Add item</button><button class="add light" data-act="openList" data-id="${l.id}">Open today's checklist</button></div>`;
}

function dueInfo(d) {
  if (!d.lastDone) return { next: null, cls: 'unk', text: 'Set last visit' };
  const next = addMonthsKey(d.lastDone, +d.everyMonths || 12);
  const diff = daysBetween(todayKey(), next);
  if (diff < 0) return { next, cls: 'over', text: 'Overdue · was due ' + niceDate(next) };
  if (diff <= 30) return { next, cls: 'soon', text: 'Due ' + niceDate(next) + ' · in ' + diff + 'd' };
  return { next, cls: 'ok', text: 'Next ' + niceDate(next) + ' ' + next.slice(0, 4) };
}
function duePage() {
  const items = S.due.slice().sort((a, b) => { const x = dueInfo(a).next || '0000', y = dueInfo(b).next || '0000'; return x < y ? -1 : 1; });
  return pageHead('Due tracker', 'Recurring appointments and upkeep', `<button class="primary" data-act="editDue" data-id="">+ New</button>`) +
    `<section class="menu">${items.map(d => { const inf = dueInfo(d); return `<div class="mrow due ${inf.cls}"><button class="grow left" data-act="editDue" data-id="${d.id}"><b>${esc(d.title)}</b> ${tags(d.people)}<small>${esc(inf.text)} · every ${d.everyMonths}mo</small></button><button class="small light" data-act="dueDone" data-id="${d.id}">Done today</button></div>`; }).join('') || '<div class="empty">Nothing tracked yet.</div>'}</section>
    <p class="muted pad">Once you book it, add the appointment in Proton. Mark it done here after the visit.</p>`;
}
function watchPage() {
  const tk = todayKey();
  return pageHead('Event watchlist', 'Yearly events with changing dates', `<button class="primary" data-act="editWatch" data-id="">+ New</button>`) +
    `<section class="menu">${S.watch.map(w => { const due = w.checkOn && w.checkOn <= tk; return `<div class="mrow due ${due ? 'soon' : 'ok'}"><button class="grow left" data-act="editWatch" data-id="${w.id}"><b>${esc(w.title)}</b><small>${esc(w.usual || '')}${w.checkOn ? ' · check ' + niceDate(w.checkOn) + ' ' + w.checkOn.slice(0, 4) : ''}${w.notes && w.notes.length ? ' · ' + w.notes.length + ' notes' : ''}</small></button>${due ? `<button class="small light" data-act="watchChecked" data-id="${w.id}">Checked</button>` : ''}</div>`; }).join('') || '<div class="empty">Add events like a township day whose date changes each year.</div>'}</section>`;
}
function protonPage() {
  const P = S.proton;
  const titles = {};
  for (let i = 0; i < 21; i++) for (const ev of protonOn(addDays(todayKey(), i))) titles[ev.title.trim().toLowerCase()] = ev;
  const unassigned = Object.values(titles).filter(ev => !protonPeople(ev).length);
  return pageHead('Proton calendar', P.imported ? 'Last import ' + new Date(P.imported).toLocaleString() : 'Not imported yet') +
    `<section class="card">
      <label class="field"><span>Share link (from Proton web: Settings → Calendars → Share with anyone → Full view)</span><input name="purl" value="${esc(P.url)}" placeholder="https://calendar.proton.me/api/calendar/v1/url/…"></label>
      <div class="btnrow"><button class="small" data-act="protonSave">Save link</button>${P.url ? `<a class="small btnlink" href="${esc(P.url)}" target="_blank" rel="noopener">Open link (downloads file)</a>` : ''}<button class="small" data-act="protonFetch">Try direct refresh</button></div>
    </section>
    <section class="card">
      <div class="label">Import a calendar file</div>
      <p class="muted">Open the link above, then share the downloaded file to Family Schedule. Or pick the file here.</p>
      <label class="filebtn">Choose .ics file<input type="file" accept=".ics,text/calendar" data-change="icsFile" hidden></label>
      <div class="muted">${P.events.length} events stored.</div>
    </section>
    ${unassigned.length ? `<section class="card"><div class="label">Who are these for? (next 3 weeks)</div>${unassigned.map(ev => `<button class="mrow" data-act="protonAssignTitle" data-title="${esc(ev.title)}"><span><b>${esc(ev.title)}</b><small>Tap to pick people · remembered by title</small></span><span>›</span></button>`).join('')}</section>` : ''}
    ${Object.keys(P.titleMap).length ? `<section class="card"><div class="label">Remembered titles</div>${Object.entries(P.titleMap).map(([t, ids]) => `<div class="trow"><span class="grow">${esc(t)}</span>${tags(ids)}<button class="small light" data-act="forgetTitle" data-title="${esc(t)}">Forget</button></div>`).join('')}</section>` : ''}`;
}
function backupPage() {
  const lb = S.settings.lastBackup;
  return pageHead('Backup & restore', lb ? 'Last backup ' + new Date(lb).toLocaleDateString() : 'No backup yet') +
    `<section class="card">
      <p>A backup is one file with everything: routines, logs, lists, people. Save it somewhere safe like Proton Drive. Weekly is plenty.</p>
      <div class="btnrow"><button class="primary" data-act="exportBackup">Back up now</button></div>
    </section>
    <section class="card">
      <div class="label">Restore</div>
      <p class="muted">Replaces everything in the app with the backup.</p>
      <label class="filebtn">Choose backup file<input type="file" accept=".json,application/json" data-change="restoreFile" hidden></label>
    </section>
    <section class="card">
      <div class="label">Start over</div>
      <p class="muted">Erases everything and reloads the starting routines.</p>
      <button class="small danger" data-act="resetAll">Reset app</button>
    </section>`;
}
