// Minimal iCalendar (.ics) reader for Proton exports.
// Handles: VEVENT, DTSTART/DTEND (UTC, TZID, floating, all-day), DURATION,
// RRULE (DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYDAY), EXDATE,
// RECURRENCE-ID overrides, STATUS:CANCELLED.

const ICS = (() => {
  function unfold(text) {
    return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  }
  function unescape(v) {
    return v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
  }
  function parseLine(line) {
    const i = line.indexOf(':');
    if (i < 0) return null;
    const head = line.slice(0, i);
    const value = line.slice(i + 1);
    const parts = head.split(';');
    const params = {};
    for (const p of parts.slice(1)) {
      const [k, v] = p.split('=');
      if (k) params[k.toUpperCase()] = (v || '').replace(/^"|"$/g, '');
    }
    return { name: parts[0].toUpperCase(), params, value };
  }

  // Wall-clock time in a named zone -> real Date.
  function zonedToDate(y, mo, d, h, mi, s, tz) {
    const guess = Date.UTC(y, mo - 1, d, h, mi, s);
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      const offsetAt = (ms) => {
        const p = {};
        for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value;
        const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
        return asUTC - ms;
      };
      let off = offsetAt(guess);
      let ms = guess - off;
      const off2 = offsetAt(ms);
      if (off2 !== off) ms = guess - off2;
      return new Date(ms);
    } catch (e) {
      return new Date(y, mo - 1, d, h, mi, s);
    }
  }

  function parseDate(prop) {
    if (!prop) return null;
    const v = prop.value.trim();
    const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
    if (!m) return null;
    const [, y, mo, d, h, mi, s, z] = m;
    if (prop.params.VALUE === 'DATE' || h === undefined) {
      return { date: new Date(+y, +mo - 1, +d), allDay: true };
    }
    if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0))), allDay: false };
    if (prop.params.TZID) return { date: zonedToDate(+y, +mo, +d, +h, +mi, +(s || 0), prop.params.TZID), allDay: false };
    return { date: new Date(+y, +mo - 1, +d, +h, +mi, +(s || 0)), allDay: false };
  }

  function parseDuration(v) {
    const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
    if (!m) return 0;
    const [, sign, w, d, h, mi, s] = m;
    const ms = (((+w || 0) * 7 + (+d || 0)) * 86400 + (+h || 0) * 3600 + (+mi || 0) * 60 + (+s || 0)) * 1000;
    return sign === '-' ? -ms : ms;
  }

  function parse(text) {
    const lines = unfold(text).split('\n');
    const events = [];
    let cur = null;
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (line === 'BEGIN:VEVENT') { cur = { exdates: [] }; continue; }
      if (line === 'END:VEVENT') { if (cur) events.push(finish(cur)); cur = null; continue; }
      if (!cur) continue;
      const p = parseLine(line);
      if (!p) continue;
      switch (p.name) {
        case 'UID': cur.uid = p.value.trim(); break;
        case 'SUMMARY': cur.title = unescape(p.value).trim(); break;
        case 'DESCRIPTION': cur.notes = unescape(p.value); break;
        case 'LOCATION': cur.location = unescape(p.value); break;
        case 'STATUS': cur.status = p.value.trim().toUpperCase(); break;
        case 'DTSTART': cur.dtstart = parseDate(p); break;
        case 'DTEND': cur.dtend = parseDate(p); break;
        case 'DURATION': cur.duration = parseDuration(p.value.trim()); break;
        case 'RRULE': cur.rrule = p.value.trim(); break;
        case 'EXDATE':
          for (const v of p.value.split(',')) {
            const d = parseDate({ value: v, params: p.params });
            if (d) cur.exdates.push(d.date.getTime());
          }
          break;
        case 'RECURRENCE-ID': { const d = parseDate(p); if (d) cur.recurrenceId = d.date.getTime(); break; }
      }
    }
    return events.filter(e => e && e.start != null);
  }

  function finish(c) {
    if (!c.dtstart) return null;
    const start = c.dtstart.date.getTime();
    let end;
    if (c.dtend) end = c.dtend.date.getTime();
    else if (c.duration) end = start + c.duration;
    else end = start + (c.dtstart.allDay ? 86400000 : 3600000);
    return {
      uid: c.uid || ('noid-' + start + '-' + (c.title || '')),
      title: c.title || '(No title)',
      notes: c.notes || '', location: c.location || '',
      start, end, allDay: c.dtstart.allDay,
      rrule: c.rrule || null, exdates: c.exdates, recurrenceId: c.recurrenceId || null,
      cancelled: c.status === 'CANCELLED'
    };
  }

  const DAYMAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  function parseRule(r) {
    const o = {};
    for (const part of r.split(';')) {
      const [k, v] = part.split('=');
      o[k.toUpperCase()] = v;
    }
    return o;
  }

  // Occurrence start times (ms) of event e that start on or overlap local day [dayStart, dayEnd).
  function occurrencesOn(e, dayStart, dayEnd) {
    const len = e.end - e.start;
    const hits = (s) => s < dayEnd && s + len > dayStart && (!e.allDay || s >= dayStart || s + len > dayStart);
    if (!e.rrule) return hits(e.start) ? [e.start] : [];
    const r = parseRule(e.rrule);
    const freq = r.FREQ;
    const interval = Math.max(1, +(r.INTERVAL || 1));
    const count = r.COUNT ? +r.COUNT : Infinity;
    let until = Infinity;
    if (r.UNTIL) { const u = parseDate({ value: r.UNTIL, params: {} }); if (u) until = u.date.getTime() + (u.allDay ? 86400000 - 1 : 0); }
    const byday = r.BYDAY ? r.BYDAY.split(',').map(x => x.replace(/^[+-]?\d+/, '')).map(x => DAYMAP[x]).filter(x => x !== undefined) : null;
    const s0 = new Date(e.start);
    const out = [];
    let n = 0;
    const consider = (d) => {
      const t = d.getTime();
      if (t < e.start) return true;
      if (t > until || n >= count) return false;
      n++;
      if (!e.exdates.includes(t) && hits(t)) out.push(t);
      return t < dayEnd;
    };
    const mk = (y, mo, d) => new Date(y, mo, d, s0.getHours(), s0.getMinutes(), s0.getSeconds());
    let guard = 0;
    if (freq === 'DAILY') {
      for (let i = 0; guard++ < 20000; i += interval) {
        if (!consider(mk(s0.getFullYear(), s0.getMonth(), s0.getDate() + i))) break;
      }
    } else if (freq === 'WEEKLY') {
      const days = byday && byday.length ? byday.slice().sort() : [s0.getDay()];
      const weekStart = mk(s0.getFullYear(), s0.getMonth(), s0.getDate() - s0.getDay());
      for (let w = 0; guard++ < 5000; w += interval) {
        let cont = true;
        for (const dd of days) {
          const d = mk(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + w * 7 + dd);
          if (!consider(d)) { cont = false; break; }
        }
        if (!cont) break;
      }
    } else if (freq === 'MONTHLY') {
      for (let i = 0; guard++ < 2000; i += interval) {
        const d = mk(s0.getFullYear(), s0.getMonth() + i, s0.getDate());
        if (d.getDate() !== s0.getDate()) continue;
        if (!consider(d)) break;
      }
    } else if (freq === 'YEARLY') {
      for (let i = 0; guard++ < 200; i += interval) {
        const d = mk(s0.getFullYear() + i, s0.getMonth(), s0.getDate());
        if (!consider(d)) break;
      }
    } else if (hits(e.start)) out.push(e.start);
    return out;
  }

  // All event instances overlapping a local day.
  function eventsOn(events, date) {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayEnd = dayStart + 86400000;
    const overrides = {};
    for (const e of events) if (e.recurrenceId) overrides[e.uid + '|' + e.recurrenceId] = e;
    const out = [];
    for (const e of events) {
      if (e.recurrenceId) continue;
      for (const t of occurrencesOn(e, dayStart, dayEnd)) {
        const ov = overrides[e.uid + '|' + t];
        if (ov) continue;
        if (e.cancelled) continue;
        out.push({ uid: e.uid, title: e.title, notes: e.notes, location: e.location, start: t, end: t + (e.end - e.start), allDay: e.allDay });
      }
    }
    for (const ov of Object.values(overrides)) {
      if (ov.cancelled) continue;
      if (ov.start < dayEnd && ov.end > dayStart) out.push({ uid: ov.uid, title: ov.title, notes: ov.notes, location: ov.location, start: ov.start, end: ov.end, allDay: ov.allDay });
    }
    return out;
  }

  return { parse, eventsOn };
})();
