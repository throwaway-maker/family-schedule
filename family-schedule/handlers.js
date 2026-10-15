// ---------- Click handlers ----------
const ACT = {
  tab: (d) => { ui.tab = d.tab; ui.page = null; ui.pageArg = null; if (d.tab === 'day' && !ui.dateTouched) ui.date = todayKey(); render(); window.scrollTo(0, 0); },
  day: (d) => { ui.date = addDays(ui.date, +d.n); ui.dateTouched = true; render(); },
  week: (d) => { ui.date = addDays(ui.date, +d.n); render(); },
  today: () => { ui.date = todayKey(); render(); },
  openDay: (d) => { ui.date = d.k; ui.dateTouched = true; ui.tab = 'day'; render(); window.scrollTo(0, 0); },
  filter: (d) => {
    if (!d.pid) ui.filter = [];
    else ui.filter = ui.filter.includes(d.pid) ? ui.filter.filter(x => x !== d.pid) : [...ui.filter, d.pid];
    render();
  },
  visitors: () => { ui.showVisitors = !ui.showVisitors; render(); },
  collapse: (d) => { ui.collapsed[d.k] = d.v === '1'; render(); },
  closeSheet: () => closeSheet(),
  undo: () => { if (undo()) { render(); toast('Undone'); } },

  done: (d) => { const day = dayData(ui.date); day.done[d.key] = !day.done[d.key]; commit(); },
  doneFromSheet: (d) => { const day = dayData(ui.date); day.done[d.key] = !day.done[d.key]; closeSheet(); commit(); },
  step: (d) => stepSheet(d.key),
  group: (d) => groupSheet(d.group),
  skipStep: (d) => { snapshot(); const day = dayData(ui.date); if (day.skip[d.key]) delete day.skip[d.key]; else day.skip[d.key] = true; closeSheet(); commit('Updated', true); },
  saveStep: () => {
    const root = sheetRoot(), c = ui.sheetCtx;
    const title = val(root, 'title').trim(), min = Math.max(0, +val(root, 'min') || 0), ppl = readPeople(root);
    snapshot();
    if (readSeg(root, 'scope') === 'all') {
      const st = routineById(c.rid).steps.find(s => s.id === c.sid);
      st.title = title || st.title; st.min = min; st.people = ppl;
    } else {
      dayData(ui.date).edits[c.key] = { title, min, people: ppl };
    }
    closeSheet(); commit('Saved', true);
  },
  deleteStep: (d) => {
    const c = ui.sheetCtx;
    const all = readSeg(sheetRoot(), 'scope') === 'all';
    if (all && !confirm('Delete this step from the routine every time?')) return;
    snapshot();
    if (all) { const r = routineById(c.rid); r.steps = r.steps.filter(s => s.id !== c.sid); }
    else dayData(ui.date).edits[d.key] = Object.assign({}, dayData(ui.date).edits[d.key], { deleted: true });
    closeSheet(); commit('Step removed', true);
  },
  saveGroup: (d) => {
    const root = sheetRoot();
    const it = S.schedule.find(s => s.id === d.id);
    const start = fromTimeInput(val(root, 'start'));
    snapshot();
    if (readSeg(root, 'scope') === 'all') { if (start != null) it.start = start; const days = readDays(root); if (days.length) it.days = days; delete dayData(ui.date).moved[it.id]; }
    else if (start != null) dayData(ui.date).moved[it.id] = start;
    closeSheet(); commit('Saved', true);
  },
  skipGroup: (d) => { snapshot(); dayData(ui.date).removed[d.id] = true; closeSheet(); commit('Skipped for this day', true); },

  quick: (d) => {
    const r = routineById(d.id);
    if (ui.date === todayKey() || ui.tab === 'care') {
      snapshot();
      const k = todayKey();
      dayData(k).inserts.push({ id: uid(), routineId: r.id, at: nowMin() });
      if (ui.tab !== 'care') ui.date = k;
      commit(r.name + ' added at ' + hhmm(nowMin()) + '. Later steps moved.', true);
    } else routineAtTimeSheet({ rid: r.id, how: 'insert' });
  },
  insDone: (d) => {
    const day = dayData(ui.date);
    const ins = day.inserts.find(x => x.id === d.id);
    if (!ins) return;
    snapshot();
    ins.min = Math.max(1, nowMin() - ins.at);
    const r = routineById(ins.routineId);
    for (const s of r.steps) day.done['i:' + ins.id + ':' + s.id] = true;
    closeSheet(); commit('Finished. Later steps pulled back.', true);
  },
  insRemove: (d) => {
    snapshot();
    const day = dayData(ui.date);
    day.inserts = day.inserts.filter(x => x.id !== d.id);
    closeSheet(); commit('Removed', true);
  },

  add: () => openSheet('Add', `<div class="menu">
      <button class="mrow" data-act="newEvent"><span><b>Event</b><small>One time or repeating</small></span><span>›</span></button>
      <button class="mrow" data-act="addRoutineAt"><span><b>Routine at a time</b><small>Insert into this day or repeat</small></span><span>›</span></button>
      <button class="mrow" data-act="addTaskToday"><span><b>Task for this day</b><small>Goes in the anytime tray</small></span><span>›</span></button>
      ${S.routines.filter(r => r.quick).map(r => `<button class="mrow" data-act="quickFromAdd" data-id="${r.id}"><span><b>${esc(r.name)} now</b><small>Pushes later steps back</small></span><span>›</span></button>`).join('')}
    </div>`),
  quickFromAdd: (d) => { closeSheet(); ACT.quick(d); },
  newEvent: () => eventSheet(null),
  addRoutineAt: () => routineAtTimeSheet({}),
  newSchedRoutine: () => routineAtTimeSheet({ how: 'repeat' }),
  addTaskToday: () => {
    openSheet('Task for ' + niceDate(ui.date), `${field('What', `<input name="title" placeholder="e.g. Call pediatrician">`)}<div class="field"><span>Who</span>${peoplePicker(['me'])}</div>`,
      `<button class="primary" data-act="saveTaskToday">Add</button>`);
  },
  saveTaskToday: () => {
    const root = sheetRoot();
    const title = val(root, 'title').trim();
    if (!title) return toast('Type what it is');
    S.tasks.push({ id: uid(), title, min: 10, freq: { type: 'once', date: ui.date }, mode: 'float', assign: { type: 'person', people: readPeople(root) } });
    closeSheet(); commit('Added');
  },
  saveRoutineAt: () => {
    const root = sheetRoot();
    const rid = val(root, 'rid'), at = fromTimeInput(val(root, 'at'));
    if (at == null) return toast('Pick a time');
    snapshot();
    if (readSeg(root, 'how') === 'repeat') {
      const days = readDays(root);
      S.schedule.push({ id: uid(), kind: 'routine', routineId: rid, start: at, days: days.length ? days : [fromKey(ui.date).getDay()] });
    } else dayData(ui.date).inserts.push({ id: uid(), routineId: rid, at });
    closeSheet(); commit('Added', true);
  },
  event: (d) => eventSheet(d.key.slice(2)),
  saveEvent: (d) => {
    const root = sheetRoot();
    const title = val(root, 'title').trim();
    const start = fromTimeInput(val(root, 'start'));
    let end = fromTimeInput(val(root, 'end'));
    if (!title || start == null) return toast('Add a name and start time');
    if (end == null || end < start) end = start + 30;
    const people = readPeople(root);
    const rep = readSeg(root, 'rep') === 'yes';
    const days = readDays(root);
    const handoff = checked(root, 'handoff');
    const note = val(root, 'note').trim();
    snapshot();
    const it = d.id ? S.schedule.find(s => s.id === d.id) : null;
    if (it && !it.date && readSeg(root, 'scope') === 'day') {
      const day = dayData(ui.date);
      day.moved[it.id] = start;
      day.edits['e:' + it.id] = { title, people, min: end - start };
    } else {
      const obj = it || { id: uid(), kind: 'event' };
      Object.assign(obj, { title, start, end, people, handoff, note });
      if (rep) { obj.days = days.length ? days : [fromKey(ui.date).getDay()]; delete obj.date; }
      else { obj.date = obj.date || ui.date; delete obj.days; }
      if (!it) S.schedule.push(obj);
      if (it) { const day = dayData(ui.date); delete day.moved[it.id]; delete day.edits['e:' + it.id]; }
    }
    closeSheet(); commit('Saved', true);
  },
  deleteEvent: (d) => {
    const it = S.schedule.find(s => s.id === d.id);
    const root = sheetRoot();
    snapshot();
    if (it && !it.date && readSeg(root, 'scope') === 'day') dayData(ui.date).removed[it.id] = true;
    else S.schedule = S.schedule.filter(s => s.id !== d.id);
    closeSheet(); commit('Deleted', true);
  },
  sched: (d) => schedSheet(d.id),
  saveSched: (d) => {
    const root = sheetRoot();
    const it = S.schedule.find(s => s.id === d.id);
    const start = fromTimeInput(val(root, 'start'));
    snapshot();
    if (start != null) it.start = start;
    const days = readDays(root); if (days.length) it.days = days;
    closeSheet(); commit('Saved', true);
  },
  deleteSched: (d) => { if (!confirm('Remove this from the schedule?')) return; snapshot(); S.schedule = S.schedule.filter(s => s.id !== d.id); closeSheet(); commit('Removed', true); },

  // tasks
  taskDone: (d) => {
    const day = dayData(ui.date);
    const t = S.tasks.find(x => x.id === d.id);
    day.taskDone[d.id] = !day.taskDone[d.id];
    if (t) t.lastDone = day.taskDone[d.id] ? ui.date : t.prevDone || null;
    commit();
  },
  slotTask: (d) => {
    const t = S.tasks.find(x => x.id === d.id);
    const cur = (peekDay(ui.date).slotted || {})[d.id];
    openSheet('Slot "' + t.title + '"', field('At', timeInput('at', cur != null ? cur : Math.ceil(nowMin() / 15) * 15)),
      `${cur != null ? `<button class="light" data-act="unslot" data-id="${d.id}">Back to anytime</button>` : ''}<button class="primary" data-act="saveSlot" data-id="${d.id}">Place it</button>`);
  },
  saveSlot: (d) => { const at = fromTimeInput(val(sheetRoot(), 'at')); if (at == null) return; dayData(ui.date).slotted[d.id] = at; closeSheet(); commit('Placed at ' + hhmm(at)); },
  unslot: (d) => { delete dayData(ui.date).slotted[d.id]; closeSheet(); commit(); },
  editTask: (d) => taskSheet(d.id),
  saveTask: (d) => {
    const root = sheetRoot();
    const title = val(root, 'title').trim();
    if (!title) return toast('Type the chore');
    const ft = readSeg(root, 'ftype');
    const freq = { type: ft };
    if (ft === 'weekly') freq.days = readDays(root);
    if (ft === 'everyN') freq.n = Math.max(1, +val(root, 'n') || 7);
    if (ft === 'monthly') freq.dom = Math.min(31, Math.max(1, +val(root, 'dom') || 1));
    if (ft === 'once') freq.date = val(root, 'once') || ui.date;
    const t = d.id ? S.tasks.find(x => x.id === d.id) : { id: uid() };
    Object.assign(t, { title, min: Math.max(0, +val(root, 'min') || 10), freq, mode: readSeg(root, 'mode'), time: fromTimeInput(val(root, 'time')), assign: { type: readSeg(root, 'atype'), people: readPeople(root) } });
    if (!d.id) S.tasks.push(t);
    closeSheet(); commit('Saved');
  },
  deleteTask: (d) => { snapshot(); S.tasks = S.tasks.filter(t => t.id !== d.id); closeSheet(); commit('Deleted', true); },

  // care
  careAdd: (d) => careSheet(d.type),
  careEdit: (d) => careSheet(null, d.id),
  careSave: (d) => {
    const root = sheetRoot();
    const t = fromTimeInput(val(root, 'time'));
    const dk = val(root, 'date') || todayKey();
    const base = fromKey(dk);
    const ts = base.getTime() + (t != null ? t : nowMin()) * 60000;
    const data = { note: val(root, 'note').trim() };
    if (d.type === 'feed') { data.side = readSeg(root, 'side'); data.min = +val(root, 'min') || null; }
    if (d.type === 'diaper') { data.kind = readSeg(root, 'kind'); data.color = readSeg(root, 'color'); data.consistency = readSeg(root, 'consistency'); data.amount = readSeg(root, 'amount'); }
    if (d.type === 'hygiene') data.what = readSeg(root, 'what');
    if (d.id) { const c = S.care.find(x => x.id === d.id); c.ts = ts; c.data = data; }
    else S.care.push({ id: uid(), ts, type: d.type, data });
    closeSheet(); commit('Logged');
  },
  careDelete: (d) => { snapshot(); S.care = S.care.filter(c => c.id !== d.id); closeSheet(); commit('Deleted', true); },
  careDay: (d) => { ui.careDate = addDays(ui.careDate, +d.n); render(); },
  careToday: () => { ui.careDate = todayKey(); render(); },
  shareCare: () => {
    const k = ui.careDate;
    const lines = ['Anaise · ' + DAY_LONG[fromKey(k).getDay()] + ' ' + niceDate(k), ''];
    for (const c of careFor(k)) { const d = new Date(c.ts); lines.push(hhmm(d.getHours() * 60 + d.getMinutes()) + '  ' + careText(c)); }
    if (lines.length === 2) lines.push('Nothing logged.');
    openSheet('Share care log', `<textarea class="preview" name="stext" rows="14">${esc(lines.join('\n'))}</textarea>`,
      `<button class="light" data-act="copyShare">Copy</button><button class="primary" data-act="doShare">Share</button>`);
  },

  // lists
  openList: (d) => checklistSheet(d.id),
  checkItem: (d) => {
    const day = dayData(ui.date);
    const st = day.lists[d.lid] || (day.lists[d.lid] = {});
    st[d.id] = !st[d.id];
    save(); checklistSheet(d.lid);
  },
  resetList: (d) => { dayData(ui.date).lists[d.lid] = {}; save(); checklistSheet(d.lid); },
  gotoList: (d) => { closeSheet(); ui.tab = 'more'; ui.page = 'list'; ui.pageArg = d.id; render(); window.scrollTo(0, 0); },
  listItem: (d) => listItemSheet(d.lid, d.id),
  saveListItem: (d) => {
    const root = sheetRoot(); const l = S.lists.find(x => x.id === d.lid);
    const title = val(root, 'title').trim(); if (!title) return toast('Type the item');
    const it = d.id ? l.items.find(x => x.id === d.id) : { id: uid() };
    Object.assign(it, { title, days: readDays(root), note: val(root, 'note').trim() });
    if (!d.id) l.items.push(it);
    closeSheet(); commit('Saved');
  },
  deleteListItem: (d) => { const l = S.lists.find(x => x.id === d.lid); l.items = l.items.filter(x => x.id !== d.id); closeSheet(); commit('Deleted'); },
  newList: () => listMetaSheet(null),
  listMeta: (d) => listMetaSheet(d.id),
  saveList: (d) => {
    const root = sheetRoot(); const name = val(root, 'name').trim(); if (!name) return toast('Name the list');
    const l = d.id ? S.lists.find(x => x.id === d.id) : { id: uid(), items: [] };
    Object.assign(l, { name, personId: val(root, 'pid'), days: readDays(root) });
    if (!d.id) S.lists.push(l);
    closeSheet(); commit('Saved');
  },
  deleteList: (d) => { if (!confirm('Delete this list?')) return; S.lists = S.lists.filter(l => l.id !== d.id); ui.page = 'lists'; closeSheet(); commit('Deleted'); },

  // routines
  routine: (d) => { closeSheet(); ui.tab = 'more'; ui.page = 'routine'; ui.pageArg = d.id; render(); window.scrollTo(0, 0); },
  newRoutine: () => routineMetaSheet(null),
  routineMeta: (d) => routineMetaSheet(d.id),
  saveRoutineMeta: (d) => {
    const root = sheetRoot(); const name = val(root, 'name').trim(); if (!name) return toast('Name the routine');
    const r = d.id ? routineById(d.id) : { id: uid(), steps: [] };
    Object.assign(r, { name, people: readPeople(root), color: val(root, 'color'), quick: checked(root, 'quick') });
    if (!d.id) S.routines.push(r);
    closeSheet(); if (!d.id) { ui.page = 'routine'; ui.pageArg = r.id; } commit('Saved');
  },
  deleteRoutine: (d) => {
    if (!confirm('Delete this routine and its scheduled times?')) return;
    snapshot();
    S.routines = S.routines.filter(r => r.id !== d.id);
    S.schedule = S.schedule.filter(s => s.routineId !== d.id);
    ui.page = 'routines'; closeSheet(); commit('Deleted', true);
  },
  tplStep: (d) => tplStepSheet(d.rid, d.sid),
  saveTplStep: (d) => {
    const root = sheetRoot(); const r = routineById(d.rid);
    const title = val(root, 'title').trim(); if (!title) return toast('Name the step');
    const st = d.sid ? r.steps.find(s => s.id === d.sid) : { id: uid() };
    Object.assign(st, { title, min: Math.max(0, +val(root, 'min') || 0), people: readPeople(root), optional: checked(root, 'optional'), list: val(root, 'list') || undefined });
    const meb = fromTimeInput(val(root, 'mustEndBy')); if (meb != null) st.mustEndBy = meb; else delete st.mustEndBy;
    if (checked(root, 'limit')) st.days = readDays(root); else delete st.days;
    if (!d.sid) r.steps.push(st);
    snapshot(); closeSheet(); commit('Saved', true);
  },
  deleteTplStep: (d) => { snapshot(); const r = routineById(d.rid); r.steps = r.steps.filter(s => s.id !== d.sid); closeSheet(); commit('Deleted', true); },
  stepMove: (d) => {
    const r = routineById(d.rid); const i = +d.i, j = i + (+d.d);
    if (j < 0 || j >= r.steps.length) return;
    [r.steps[i], r.steps[j]] = [r.steps[j], r.steps[i]];
    commit();
  },

  // people / due / watch
  editPerson: (d) => personSheet(d.id),
  savePerson: (d) => {
    const root = sheetRoot(); const name = val(root, 'name').trim(); if (!name) return toast('Add a name');
    const p = d.id ? person(d.id) : { id: uid() };
    Object.assign(p, { name, color: val(root, 'color'), core: checked(root, 'core'), notes: val(root, 'notes') });
    if (!d.id) S.people.push(p);
    closeSheet(); commit('Saved');
  },
  deletePerson: (d) => { if (!confirm('Delete this person?')) return; S.people = S.people.filter(p => p.id !== d.id); ui.filter = ui.filter.filter(x => x !== d.id); closeSheet(); commit('Deleted'); },
  editDue: (d) => dueSheet(d.id),
  saveDue: (d) => {
    const root = sheetRoot(); const title = val(root, 'title').trim(); if (!title) return toast('Name it');
    const it = d.id ? S.due.find(x => x.id === d.id) : { id: uid() };
    Object.assign(it, { title, people: readPeople(root), everyMonths: Math.max(1, +val(root, 'every') || 12), lastDone: val(root, 'last') || null, notes: val(root, 'notes') });
    if (!d.id) S.due.push(it);
    closeSheet(); commit('Saved');
  },
  dueDone: (d) => { snapshot(); S.due.find(x => x.id === d.id).lastDone = todayKey(); commit('Marked done today', true); },
  deleteDue: (d) => { snapshot(); S.due = S.due.filter(x => x.id !== d.id); closeSheet(); commit('Deleted', true); },
  editWatch: (d) => watchSheet(d.id),
  saveWatch: (d) => {
    const root = sheetRoot(); const title = val(root, 'title').trim(); if (!title) return toast('Name it');
    const w = d.id ? S.watch.find(x => x.id === d.id) : { id: uid(), notes: [] };
    Object.assign(w, { title, usual: val(root, 'usual').trim(), checkOn: val(root, 'checkOn') || '' });
    const nt = val(root, 'nt').trim();
    if (nt) w.notes.push({ year: +val(root, 'ny') || new Date().getFullYear(), text: nt });
    if (!d.id) S.watch.push(w);
    closeSheet(); commit('Saved');
  },
  watchChecked: (d) => { const w = S.watch.find(x => x.id === d.id); w.checkOn = addMonthsKey(w.checkOn || todayKey(), 12); commit('Next check ' + niceDate(w.checkOn) + ' ' + w.checkOn.slice(0, 4)); },
  deleteWatch: (d) => { snapshot(); S.watch = S.watch.filter(x => x.id !== d.id); closeSheet(); commit('Deleted', true); },

  // proton
  proton: (d) => protonSheet(d.key),
  protonAssignTitle: (d) => protonSheet(null, d.title),
  saveProton: (d) => {
    const root = sheetRoot(); const ppl = readPeople(root);
    if (checked(root, 'remember') || !d.uid) S.proton.titleMap[d.title.trim().toLowerCase()] = ppl;
    else S.proton.assign[d.uid] = ppl;
    closeSheet(); commit('Saved');
  },
  forgetTitle: (d) => { delete S.proton.titleMap[d.title]; commit(); },
  protonSave: () => { S.proton.url = val(document, 'purl').trim(); commit('Link saved'); },
  protonFetch: () => protonFetch(),

  // share
  share: (d) => shareSheet(d.mode || 'day'),
  doShare: () => shareOut(val(sheetRoot(), 'stext'), 'Schedule'),
  copyShare: () => copyText(val(sheetRoot(), 'stext')),
  flagShare: (d) => {
    const f = buildDay(ui.date).flags[+d.i];
    const text = 'Heads up for ' + DAY_LONG[fromKey(ui.date).getDay()] + ' ' + niceDate(ui.date) + ': ' + f.text + '. Can you help?';
    openSheet('Message', `<textarea class="preview" name="stext" rows="5">${esc(text)}</textarea>`, `<button class="light" data-act="copyShare">Copy</button><button class="primary" data-act="doShare">Share</button>`);
  },

  // pages
  goto: (d) => { ui.tab = 'more'; ui.page = d.page; ui.pageArg = null; render(); window.scrollTo(0, 0); },
  back: () => {
    if (ui.page === 'routine') ui.page = 'routines';
    else if (ui.page === 'list') ui.page = 'lists';
    else ui.page = null;
    ui.pageArg = null; render(); window.scrollTo(0, 0);
  },
  exportBackup: () => exportBackup(),
  resetAll: () => {
    if (!confirm('Erase everything and start over?')) return;
    if (!confirm('Really erase? Make a backup first if unsure.')) return;
    S = seedState(); S.settings.createdAt = Date.now(); ui.page = null; commit('Reset');
  }
};

document.addEventListener('click', (e) => {
  const tog = e.target.closest('[data-toggle]');
  if (tog) { tog.classList.toggle('on'); return; }
  const sv = e.target.closest('[data-segv]');
  if (sv) {
    const group = sv.closest('[data-seg]');
    $$('button', group).forEach(b => b.classList.toggle('on', b === sv));
    if (group.dataset.seg === 'smode') { ui.shareMode = sv.dataset.segv; const ta = $('textarea.preview'); if (ta) ta.value = shareText(ui.shareMode); }
    if (group.dataset.seg === 'feedEvery') { S.settings.feedEveryMin = +sv.dataset.segv; commit(); }
    return;
  }
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const fn = ACT[t.dataset.act];
  if (fn) { e.preventDefault(); fn(t.dataset, t); }
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  const kind = t.dataset && t.dataset.change;
  if (!kind) return;
  if (kind === 'contacts') { S.settings.contacts = t.value; save(); toast('Saved'); }
  if (kind === 'icsFile' && t.files[0]) importICS(await t.files[0].text(), 'file');
  if (kind === 'restoreFile' && t.files[0]) {
    try {
      const data = JSON.parse(await t.files[0].text());
      if (!data.routines || !data.people) throw new Error('bad');
      if (!confirm('Replace everything with this backup?')) return;
      delete data.exportedAt; delete data.app;
      S = data; migrate(); commit('Restored');
    } catch (err) { toast('That isn\'t a Family Schedule backup'); }
  }
});

// ---------- Start ----------
const APP_VERSION = '1.0.0';
async function start() {
  await loadState();
  render();
  // A calendar file shared to the app from Android's share menu.
  if (location.search.includes('shared=1') && 'caches' in window) {
    try {
      const c = await caches.open('fs-share');
      const r = await c.match('shared-file');
      if (r) { importICS(await r.text(), 'shared file'); await c.delete('shared-file'); }
    } catch (e) { }
    history.replaceState(null, '', location.pathname);
  }
  // Keep "now" current.
  setInterval(() => { if (!ui.sheet && (ui.tab === 'day' || ui.tab === 'care')) render(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !ui.sheet) { if (!ui.dateTouched) ui.date = todayKey(); render(); } });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { });
}
start();
