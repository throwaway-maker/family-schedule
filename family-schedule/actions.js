// ---------- Sheets ----------
function openSheet(title, body, footer) {
  ui.sheet = { title, body, footer };
  renderSheet();
}
function closeSheet() { ui.sheet = null; renderSheet(); }
function renderSheet() {
  const el = $('#sheet');
  if (!ui.sheet) { el.innerHTML = ''; el.hidden = true; document.body.classList.remove('locked'); return; }
  el.hidden = false;
  document.body.classList.add('locked');
  el.innerHTML = `<div class="scrim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-label="${esc(ui.sheet.title)}">
    <div class="grab"></div>
    <div class="shead"><h2>${esc(ui.sheet.title)}</h2><button class="icon" data-act="closeSheet" aria-label="Close">×</button></div>
    <div class="sbody">${ui.sheet.body}</div>
    ${ui.sheet.footer ? `<div class="sfoot">${ui.sheet.footer}</div>` : ''}
  </div>`;
}
const sheetRoot = () => $('#sheet .sheet');

let toastTimer = null;
function toast(text, withUndo) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(text)}</span>${withUndo ? '<button data-act="undo">Undo</button>' : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, withUndo ? 7000 : 3000);
}

function commit(msg, withUndo) { save(); render(); if (msg) toast(msg, withUndo); }
const findEntry = (k, key) => buildDay(k).entries.concat(buildDay(k).allDay).find(e => e.key === key);

// ---------- Step sheet ----------
function stepSheet(key) {
  const k = ui.date;
  const e = findEntry(k, key);
  if (!e) return;
  if (e.kind === 'insert') {
    const day = dayData(k);
    openSheet(e.groupName + ' · ' + e.title, `<p class="muted">${hhmm(e.start)} · ${e.min}m</p>`,
      `<button class="light" data-act="insRemove" data-id="${e.insertId}">Remove ${esc(e.groupName)}</button><button class="primary" data-act="doneFromSheet" data-key="${esc(key)}">${day.done[key] ? 'Not done' : 'Done'}</button>`);
    return;
  }
  const r = routineById(e.routineId);
  const st = r.steps.find(s => s.id === e.stepId);
  openSheet(e.groupName, `
    ${field('Step', `<input name="title" value="${esc(e.title)}">`)}
    <div class="grid2">${field('Minutes', `<input name="min" type="number" inputmode="numeric" min="0" value="${e.min}">`)}${field('Starts', `<input value="${hhmm(e.start)}" disabled>`)}</div>
    <div class="field"><span>Who (besides the routine's people)</span>${peoplePicker(e.stepPeople)}</div>
    <div class="field"><span>Save change for</span>${seg('scope', [['day', 'This day only'], ['all', 'Every time']], 'day')}</div>
    <p class="muted">Later steps shift automatically. Fixed items (like the next routine or preschool) stay put.</p>
    ${e.skipped && e.autoSkip ? '<p class="muted">Skipped automatically because the poo routine covered it.</p>' : ''}
  `, `
    <button class="light" data-act="skipStep" data-key="${esc(key)}">${e.skipped && !e.autoSkip ? 'Unskip' : 'Skip this day'}</button>
    <button class="light danger" data-act="deleteStep" data-key="${esc(key)}">Delete</button>
    <button class="primary" data-act="saveStep" data-key="${esc(key)}">Save</button>`);
  ui.sheetCtx = { key, rid: r.id, sid: st.id };
}

function groupSheet(group) {
  const k = ui.date;
  if (group.startsWith('i:')) return;
  const schedId = group.slice(2);
  const it = S.schedule.find(s => s.id === schedId);
  if (!it) return;
  const r = routineById(it.routineId);
  const day = peekDay(k);
  const start = (day.moved || {})[it.id] != null ? day.moved[it.id] : it.start;
  openSheet(r.name, `
    <div class="grid2">${field('Starts', timeInput('start', start))}<div></div></div>
    <div class="field"><span>Save change for</span>${seg('scope', [['day', 'This day only'], ['all', 'Every time']], 'day')}</div>
    <div class="field"><span>Days (every time)</span>${daysPicker(it.days)}</div>
  `, `
    <button class="light" data-act="routine" data-id="${r.id}">Edit steps</button>
    <button class="light danger" data-act="skipGroup" data-id="${it.id}">Skip this day</button>
    <button class="primary" data-act="saveGroup" data-id="${it.id}">Save</button>`);
}

// ---------- Event sheet ----------
function eventSheet(schedId, opts = {}) {
  const k = ui.date;
  const it = schedId ? S.schedule.find(s => s.id === schedId) : null;
  const day = peekDay(k);
  const ed = it ? ((day.edits || {})['e:' + it.id] || {}) : {};
  const start = it ? ((day.moved || {})[it.id] != null ? day.moved[it.id] : it.start) : (opts.start != null ? opts.start : Math.min(1380, Math.ceil(nowMin() / 15) * 15));
  const end = it ? start + (ed.min != null ? ed.min : (it.end - it.start)) : start + 30;
  const repeating = it ? !it.date : false;
  openSheet(it ? 'Edit event' : 'New event', `
    ${field('What', `<input name="title" value="${esc(ed.title || (it && it.title) || '')}" placeholder="e.g. Pediatrician">`)}
    <div class="grid2">${field('Start', timeInput('start', start))}${field('End', timeInput('end', end))}</div>
    <div class="field"><span>Who</span>${peoplePicker(ed.people || (it && it.people) || (ui.filter.length ? ui.filter : ['me']))}</div>
    <div class="field"><span>Repeats</span>${seg('rep', [['no', 'Just ' + niceDate(it && it.date ? it.date : k)], ['yes', 'On days']], repeating ? 'yes' : 'no')}</div>
    <div class="field"><span>Repeat days</span>${daysPicker(it && it.days ? it.days : [fromKey(k).getDay()])}</div>
    <label class="check"><input type="checkbox" name="handoff" ${it && it.handoff ? 'checked' : ''}> Handoff marker (e.g. "Anaise → Husband")</label>
    ${field('Note', `<input name="note" value="${esc((it && it.note) || '')}">`)}
    ${repeating ? `<div class="field"><span>Save change for</span>${seg('scope', [['day', 'This day only'], ['all', 'Every time']], 'all')}</div>` : ''}
  `, `
    ${it ? `<button class="light danger" data-act="deleteEvent" data-id="${it.id}">Delete</button>` : ''}
    <button class="primary" data-act="saveEvent" data-id="${it ? it.id : ''}">Save</button>`);
}

function schedSheet(id) {
  const it = S.schedule.find(s => s.id === id);
  if (!it) return;
  if (it.kind === 'event') return eventSheet(id);
  const r = routineById(it.routineId);
  openSheet(r.name + ' start', `
    ${field('Starts', timeInput('start', it.start))}
    <div class="field"><span>Days</span>${daysPicker(it.days)}</div>`,
    `<button class="light danger" data-act="deleteSched" data-id="${it.id}">Remove</button><button class="primary" data-act="saveSched" data-id="${it.id}">Save</button>`);
}

function routineAtTimeSheet(opts = {}) {
  const k = ui.date;
  const at = opts.at != null ? opts.at : (k === todayKey() ? nowMin() : 720);
  openSheet('Add a routine', `
    <label class="field"><span>Routine</span><select name="rid">${S.routines.map(r => `<option value="${r.id}" ${r.id === opts.rid ? 'selected' : ''}>${esc(r.name)} (${r.steps.reduce((a, s) => a + s.min, 0)}m)</option>`).join('')}</select></label>
    ${field('Start', timeInput('at', at))}
    <div class="field"><span>How</span>${seg('how', [['insert', 'Insert (push later steps)'], ['repeat', 'Repeat on days']], opts.how || 'insert')}</div>
    <div class="field"><span>Repeat days</span>${daysPicker([fromKey(k).getDay()])}</div>`,
    `<button class="primary" data-act="saveRoutineAt">Add</button>`);
}

// ---------- Tasks ----------
function taskSheet(id) {
  const t = id ? S.tasks.find(x => x.id === id) : { title: '', min: 10, freq: { type: 'weekly', days: [fromKey(ui.date).getDay()] }, mode: 'float', assign: { type: 'person', people: ['me'] } };
  const f = t.freq || { type: 'daily' };
  openSheet(id ? 'Edit chore' : 'New chore', `
    ${field('What', `<input name="title" value="${esc(t.title)}" placeholder="e.g. Vacuum living room">`)}
    ${field('Minutes', `<input name="min" type="number" inputmode="numeric" min="0" value="${t.min || 10}">`)}
    <div class="field"><span>How often</span>${seg('ftype', [['daily', 'Daily'], ['weekly', 'Weekly'], ['everyN', 'Every N days'], ['monthly', 'Monthly'], ['once', 'Once']], f.type)}</div>
    <div class="field"><span>Weekly on</span>${daysPicker(f.days || [])}</div>
    <div class="grid2">${field('Every N days', `<input name="n" type="number" min="1" value="${f.n || 7}">`)}${field('Monthly on day', `<input name="dom" type="number" min="1" max="31" value="${f.dom || 1}">`)}</div>
    ${field('Once on', `<input name="once" type="date" value="${f.date || ui.date}">`)}
    <div class="field"><span>When</span>${seg('mode', [['float', 'Anytime tray'], ['slot', 'Fixed time']], t.mode || 'float')}</div>
    ${field('Fixed time', timeInput('time', t.time != null ? t.time : 1230))}
    <div class="field"><span>Who</span>${seg('atype', [['person', 'Assigned'], ['rotate', 'Rotate weekly']], (t.assign || {}).type || 'person')}</div>
    <div class="field">${peoplePicker((t.assign || {}).people || ['me'])}</div>
    <p class="muted">Rotate takes turns each week in the order picked.</p>`,
    `${id ? `<button class="light danger" data-act="deleteTask" data-id="${id}">Delete</button>` : ''}<button class="primary" data-act="saveTask" data-id="${id || ''}">Save</button>`);
}

// ---------- Care ----------
function careSheet(type, id) {
  const c = id ? S.care.find(x => x.id === id) : null;
  const d = c ? c.data : {};
  const ts = c ? new Date(c.ts) : new Date();
  const dateK = c ? dateKey(ts) : ui.careDate;
  const t = c ? ts.getHours() * 60 + ts.getMinutes() : nowMin();
  type = c ? c.type : type;
  let body = `<div class="grid2">${field('Time', timeInput('time', t))}${field('Date', `<input type="date" name="date" value="${dateK}">`)}</div>`;
  if (type === 'feed') {
    body += `<div class="field"><span>Side</span>${seg('side', [['Left', 'Left'], ['Right', 'Right'], ['Both', 'Both'], ['Bottle', 'Bottle']], d.side || 'Left')}</div>
      ${field('Minutes', `<input name="min" type="number" inputmode="numeric" value="${d.min || ''}">`)}`;
  } else if (type === 'diaper') {
    body += `<div class="field"><span>Diaper</span>${seg('kind', [['pee', 'Pee'], ['poo', 'Poo'], ['both', 'Both']], d.kind || 'pee')}</div>
      <div class="field"><span>Poo color</span>${seg('color', [['', '—'], ['yellow', 'Yellow'], ['green', 'Green'], ['brown', 'Brown'], ['other', 'Other']], d.color || '')}</div>
      <div class="field"><span>Consistency</span>${seg('consistency', [['', '—'], ['runny', 'Runny'], ['seedy', 'Seedy'], ['soft', 'Soft'], ['firm', 'Firm']], d.consistency || '')}</div>
      <div class="field"><span>Amount</span>${seg('amount', [['', '—'], ['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']], d.amount || '')}</div>`;
  } else if (type === 'hygiene') {
    body += `<div class="field"><span>What</span>${seg('what', [['Shower', 'Shower'], ['Ear cleaning', 'Ears'], ['Nails', 'Nails'], ['Other', 'Other']], d.what || 'Shower')}</div>`;
  }
  body += field('Note', `<textarea name="note" rows="2">${esc(d.note || '')}</textarea>`);
  const titles = { feed: 'Feed', diaper: 'Diaper', hygiene: 'Hygiene', note: 'Note' };
  openSheet((c ? 'Edit ' : 'Log ') + titles[type].toLowerCase(), body,
    `${c ? `<button class="light danger" data-act="careDelete" data-id="${c.id}">Delete</button>` : ''}<button class="primary" data-act="careSave" data-type="${type}" data-id="${c ? c.id : ''}">Save</button>`);
}

// ---------- Lists ----------
function checklistSheet(listId) {
  const l = S.lists.find(x => x.id === listId);
  if (!l) return;
  const k = ui.date;
  const dow = fromKey(k).getDay();
  const items = l.items.filter(it => !it.days || it.days.includes(dow));
  const st = ((peekDay(k).lists || {})[listId]) || {};
  const n = items.filter(it => st[it.id]).length;
  openSheet(l.name + ' · ' + DAY_SHORT[dow] + ' ' + niceDate(k), `
    <div class="label">${n} of ${items.length} packed</div>
    ${items.map(it => `<button class="crow${st[it.id] ? ' on' : ''}" data-act="checkItem" data-lid="${l.id}" data-id="${it.id}"><span class="cb${st[it.id] ? ' on' : ''}"></span><span class="grow">${esc(it.title)}</span>${it.days && it.days.length < 3 ? `<span class="tag">${it.days.map(d => DAY_SHORT[d]).join('/')}</span>` : ''}</button>`).join('') || '<div class="empty">Nothing on this list for today.</div>'}
    ${l.items.filter(it => it.days && !it.days.includes(dow) && it.note).map(it => `<p class="muted">Not today: ${esc(it.title)} (${esc(it.note)})</p>`).join('')}`,
    `<button class="light" data-act="gotoList" data-id="${l.id}">Edit list</button><button class="light" data-act="resetList" data-lid="${l.id}">Uncheck all</button>`);
}
function listItemSheet(lid, id) {
  const l = S.lists.find(x => x.id === lid);
  const it = id ? l.items.find(x => x.id === id) : { title: '', days: l.days || [0, 1, 2, 3, 4, 5, 6], note: '' };
  openSheet(id ? 'Edit item' : 'New item', `
    ${field('Item', `<input name="title" value="${esc(it.title)}">`)}
    <div class="field"><span>Days</span>${daysPicker(it.days)}</div>
    ${field('Note', `<input name="note" value="${esc(it.note || '')}" placeholder="e.g. Wed is pizza day">`)}`,
    `${id ? `<button class="light danger" data-act="deleteListItem" data-lid="${lid}" data-id="${id}">Delete</button>` : ''}<button class="primary" data-act="saveListItem" data-lid="${lid}" data-id="${id || ''}">Save</button>`);
}
function listMetaSheet(id) {
  const l = id ? S.lists.find(x => x.id === id) : { name: '', personId: 'me', days: [0, 1, 2, 3, 4, 5, 6] };
  openSheet(id ? 'Edit list' : 'New list', `
    ${field('Name', `<input name="name" value="${esc(l.name)}">`)}
    <label class="field"><span>For</span><select name="pid">${S.people.map(p => `<option value="${p.id}" ${p.id === l.personId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
    <div class="field"><span>Default days for new items</span>${daysPicker(l.days)}</div>`,
    `${id ? `<button class="light danger" data-act="deleteList" data-id="${id}">Delete list</button>` : ''}<button class="primary" data-act="saveList" data-id="${id || ''}">Save</button>`);
}

// ---------- Routine templates ----------
function tplStepSheet(rid, sid) {
  const r = routineById(rid);
  const st = sid ? r.steps.find(s => s.id === sid) : { title: '', min: 5, people: [] };
  openSheet(sid ? 'Edit step' : 'New step', `
    ${field('Step', `<input name="title" value="${esc(st.title)}">`)}
    <div class="grid2">${field('Minutes', `<input name="min" type="number" inputmode="numeric" min="0" value="${st.min}">`)}${field('Must end by', timeInput('mustEndBy', st.mustEndBy))}</div>
    <div class="field"><span>Who</span>${peoplePicker(st.people)}</div>
    <label class="check"><input type="checkbox" name="optional" ${st.optional ? 'checked' : ''}> Optional (only if needed)</label>
    <label class="check"><input type="checkbox" name="limit" ${st.days ? 'checked' : ''}> Only on certain days</label>
    ${daysPicker(st.days || [0, 1, 2, 3, 4, 5, 6])}
    <label class="field"><span>Checklist link</span><select name="list"><option value="">None</option>${S.lists.map(l => `<option value="${l.id}" ${l.id === st.list ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>`,
    `${sid ? `<button class="light danger" data-act="deleteTplStep" data-rid="${rid}" data-sid="${sid}">Delete</button>` : ''}<button class="primary" data-act="saveTplStep" data-rid="${rid}" data-sid="${sid || ''}">Save</button>`);
}
function routineMetaSheet(id) {
  const r = id ? routineById(id) : { name: '', people: ['me'], quick: false, color: '' };
  const c = r.color || person((r.people || ['me'])[0]).color;
  openSheet(id ? 'Routine details' : 'New routine', `
    ${field('Name', `<input name="name" value="${esc(r.name)}">`)}
    <div class="field"><span>Who does it (applies to every step)</span>${peoplePicker(r.people)}</div>
    <div class="grid2">${field('Color', `<input type="color" name="color" value="${c}">`)}<div></div></div>
    <label class="check"><input type="checkbox" name="quick" ${r.quick ? 'checked' : ''}> Quick add button (insert "now", like the poo routine)</label>`,
    `${id ? `<button class="light danger" data-act="deleteRoutine" data-id="${id}">Delete</button>` : ''}<button class="primary" data-act="saveRoutineMeta" data-id="${id || ''}">Save</button>`);
}

// ---------- People, due, watch, proton ----------
function personSheet(id) {
  const p = id ? person(id) : { name: '', color: '#7a6a5a', core: false, notes: '' };
  openSheet(id ? 'Edit ' + p.name : 'New person', `
    ${field('Name', `<input name="name" value="${esc(p.name)}">`)}
    <div class="grid2">${field('Color', `<input type="color" name="color" value="${p.color}">`)}<div></div></div>
    <label class="check"><input type="checkbox" name="core" ${p.core ? 'checked' : ''}> Household (always shown as a filter chip)</label>
    ${field('Notes for caregivers', `<textarea name="notes" rows="3" placeholder="Allergies, nap routine, where things are…">${esc(p.notes || '')}</textarea>`)}`,
    `${id && id !== 'me' ? `<button class="light danger" data-act="deletePerson" data-id="${id}">Delete</button>` : ''}<button class="primary" data-act="savePerson" data-id="${id || ''}">Save</button>`);
}
function dueSheet(id) {
  const d = id ? S.due.find(x => x.id === id) : { title: '', people: ['me'], everyMonths: 12, lastDone: null, notes: '' };
  openSheet(id ? 'Edit ' + d.title : 'New item', `
    ${field('What', `<input name="title" value="${esc(d.title)}" placeholder="e.g. Oil change">`)}
    <div class="field"><span>Who</span>${peoplePicker(d.people, { all: true })}</div>
    <div class="grid2">${field('Every (months)', `<input name="every" type="number" min="1" value="${d.everyMonths}">`)}${field('Last done', `<input type="date" name="last" value="${d.lastDone || ''}">`)}</div>
    ${field('Notes', `<textarea name="notes" rows="2">${esc(d.notes || '')}</textarea>`)}`,
    `${id ? `<button class="light danger" data-act="deleteDue" data-id="${id}">Delete</button>` : ''}<button class="primary" data-act="saveDue" data-id="${id || ''}">Save</button>`);
}
function watchSheet(id) {
  const w = id ? S.watch.find(x => x.id === id) : { title: '', usual: '', checkOn: '', notes: [] };
  const yr = new Date().getFullYear();
  openSheet(id ? w.title : 'New event to watch', `
    ${field('Event', `<input name="title" value="${esc(w.title)}" placeholder="e.g. Holmdel Day">`)}
    ${field('Usually', `<input name="usual" value="${esc(w.usual)}" placeholder="e.g. mid-September">`)}
    ${field('Remind me to check for the date on', `<input type="date" name="checkOn" value="${w.checkOn || ''}">`)}
    <div class="field"><span>Notes by year</span>${(w.notes || []).slice().sort((a, b) => b.year - a.year).map(n => `<div class="note"><b>${n.year}</b> ${esc(n.text)}</div>`).join('') || '<div class="muted">None yet.</div>'}</div>
    <div class="grid2">${field('Year', `<input name="ny" type="number" value="${yr}">`)}<div></div></div>
    ${field('What we liked / didn\'t', `<textarea name="nt" rows="2"></textarea>`)}`,
    `${id ? `<button class="light danger" data-act="deleteWatch" data-id="${id}">Delete</button>` : ''}<button class="primary" data-act="saveWatch" data-id="${id || ''}">Save</button>`);
}
function protonSheet(key, title) {
  let ev = null;
  if (key) { const e = findEntry(ui.date, key); if (e) ev = e.ev || e; }
  const t = ev ? ev.title : title;
  const ppl = ev ? protonPeople(ev) : (S.proton.titleMap[t.trim().toLowerCase()] || []);
  openSheet(t, `
    ${ev ? `<p class="muted">${ev.allDay ? 'All day' : hhmm(new Date(ev.start).getHours() * 60 + new Date(ev.start).getMinutes()) + '–' + hhmm(new Date(ev.end).getHours() * 60 + new Date(ev.end).getMinutes())} · from Proton (edit it in Proton)</p>` : ''}
    ${ev && ev.location ? `<p>${esc(ev.location)}</p>` : ''}
    ${ev && ev.notes ? `<p class="pre">${esc(ev.notes)}</p>` : ''}
    <div class="field"><span>Who is this for?</span>${peoplePicker(ppl)}</div>
    <label class="check"><input type="checkbox" name="remember" checked> Remember for every event titled "${esc(t)}"</label>`,
    `<button class="primary" data-act="saveProton" data-uid="${ev ? esc(ev.uid) : ''}" data-title="${esc(t)}">Save</button>`);
}

// ---------- Share ----------
function shareSheet(mode) {
  ui.shareMode = mode || ui.shareMode || 'day';
  const text = shareText(ui.shareMode);
  openSheet('Share', `
    ${seg('smode', [['day', 'This day'], ['week', 'This week'], ['caregiver', 'Caregiver sheet']], ui.shareMode)}
    <p class="muted">Showing: ${ui.filter.length ? ui.filter.map(p => esc(person(p).name)).join(' + ') : 'Everyone'}. Change with the people chips.</p>
    <textarea class="preview" name="stext" rows="14">${esc(text)}</textarea>`,
    `<button class="light" data-act="copyShare">Copy</button><button class="primary" data-act="doShare">Share</button>`);
}
function shareText(mode) {
  if (mode === 'week') {
    const ws = weekStartKey(ui.date);
    return [...Array(7)].map((_, i) => scheduleText(addDays(ws, i), ui.filter)).join('\n\n————\n\n');
  }
  if (mode === 'caregiver') {
    const kids = ui.filter.length ? ui.filter : ['eloise', 'anaise'];
    const lines = ['Caregiver sheet · ' + DAY_LONG[fromKey(ui.date).getDay()] + ' ' + niceDate(ui.date), ''];
    lines.push(scheduleText(ui.date, kids, { tags: true }).split('\n').slice(2).join('\n'));
    if (kids.includes('anaise')) {
      const lf = lastCare('feed'), ld = lastCare('diaper');
      const tod = careFor(todayKey());
      const tm = (c) => { const d = new Date(c.ts); return hhmm(d.getHours() * 60 + d.getMinutes()); };
      lines.push('', 'Anaise so far today:');
      lines.push('• Last feed: ' + (lf ? tm(lf) + ' (' + careText(lf) + ')' : 'not logged'));
      lines.push('• Last diaper: ' + (ld ? tm(ld) + ' (' + careText(ld) + ')' : 'not logged'));
      lines.push('• Today: ' + tod.filter(c => c.type === 'feed').length + ' feeds, ' + tod.filter(c => c.type === 'diaper').length + ' diapers');
      lines.push('• Feeds about every ' + (S.settings.feedEveryMin / 60) + 'h. Please note feeds and diapers.');
    }
    for (const id of kids) { const p = person(id); if (p.notes) lines.push('', p.name + ':', p.notes); }
    if (S.settings.contacts) lines.push('', 'Contacts:', S.settings.contacts);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  return scheduleText(ui.date, ui.filter);
}
async function shareOut(text, title) {
  try {
    if (navigator.share) { await navigator.share({ text, title }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  await copyText(text);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); }
  catch (e) { const ta = $('textarea.preview'); if (ta) { ta.select(); document.execCommand('copy'); toast('Copied'); } }
}

// ---------- Proton import ----------
function importICS(text, source) {
  let events;
  try { events = ICS.parse(text); } catch (e) { events = []; }
  if (!events.length && !/BEGIN:VCALENDAR/.test(text)) { toast('That file doesn\'t look like a calendar'); return false; }
  S.proton.events = events;
  S.proton.imported = Date.now();
  save();
  render();
  toast('Imported ' + events.length + ' events' + (source ? ' from ' + source : ''));
  return true;
}
async function protonFetch() {
  const url = S.proton.url;
  if (!url) { toast('Add your Proton link first'); return; }
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    importICS(await r.text(), 'link');
  } catch (e) {
    openSheet('Couldn\'t read the link directly', `<p>Your browser blocked reading Proton's link from inside the app. That's expected.</p>
      <ol class="steps"><li>Tap <b>Open link</b>. Chrome downloads a calendar file.</li><li>Open the download, tap <b>Share</b>, choose <b>Family Schedule</b>.</li></ol>
      <p class="muted">Or use "Choose .ics file" on the Proton page.</p>`,
      `${url ? `<a class="primary btnlink" href="${esc(url)}" target="_blank" rel="noopener">Open link</a>` : ''}`);
  }
}

// ---------- Backup ----------
async function exportBackup() {
  const data = JSON.stringify(Object.assign({}, S, { exportedAt: new Date().toISOString(), app: 'family-schedule' }));
  const name = 'family-schedule-backup-' + todayKey() + '.json';
  const blob = new Blob([data], { type: 'application/json' });
  let shared = false;
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); shared = true; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  if (!shared) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  S.settings.lastBackup = Date.now();
  commit('Backup saved');
}
