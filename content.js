(() => {
  'use strict';

  const TOOLBAR_ID = 'mepre-agenda-mejorada-toolbar';
  const PANEL_ID = 'mepre-agenda-mejorada-panel';
  let latestPayload = null;

  const formatterDay = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  const formatterTime = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  function parseLocal(isoString) {
    if (!isoString) return null;
    // FullCalendar antiguo suele devolver hora local sin zona. Evitamos convertirla a UTC.
    const m = String(isoString).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    const d = new Date(isoString);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function requestEvents(timeout = 1200) {
    return new Promise(resolve => {
      let finished = false;
      const done = payload => {
        if (finished) return;
        finished = true;
        window.removeEventListener('mepre-agenda-response', handler);
        latestPayload = payload || {events: [], title: 'Agenda MEPRE'};
        resolve(latestPayload);
      };
      const handler = e => done(e.detail);
      window.addEventListener('mepre-agenda-response', handler, {once: true});
      window.dispatchEvent(new CustomEvent('mepre-agenda-request'));
      setTimeout(() => done({events: [], title: 'Agenda MEPRE'}), timeout);
    });
  }

  function normalTitle(ev) {
    return (ev.title || 'Audiencia MEPRE')
      .replace(/\s*[—-]\s*/g, ' — ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function statusClass(ev) {
    const text = normalTitle(ev).toLowerCase();
    if (text.includes('programada')) return 'mepre-status-programada';
    return 'mepre-status-audiencia';
  }

  function groupEvents(events) {
    const groups = new Map();
    for (const ev of events) {
      const d = parseLocal(ev.start);
      if (!d) continue;
      const key = [d.getFullYear(), String(d.getMonth() + 1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ev);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }

  function buildAgenda(payload) {
    const panel = document.getElementById(PANEL_ID) || document.createElement('section');
    panel.id = PANEL_ID;
    panel.innerHTML = '';

    const heading = document.createElement('div');
    heading.className = 'mepre-panel-heading';
    heading.innerHTML = `<div><h2>Agenda mejorada</h2><p>${escapeHtml(payload.title || '')}</p></div><button type="button" class="mepre-close" aria-label="Cerrar">×</button>`;
    heading.querySelector('.mepre-close').addEventListener('click', () => panel.remove());
    panel.appendChild(heading);

    if (!payload.events.length) {
      const empty = document.createElement('div');
      empty.className = 'mepre-empty';
      empty.textContent = 'No pude leer eventos del calendario en este momento. Probá cambiar de mes/semana o volver a abrir “Ver Agenda”.';
      panel.appendChild(empty);
    } else {
      for (const [, events] of groupEvents(payload.events)) {
        const firstDate = parseLocal(events[0].start);
        const section = document.createElement('div');
        section.className = 'mepre-day';
        const h3 = document.createElement('h3');
        h3.textContent = capitalize(formatterDay.format(firstDate));
        section.appendChild(h3);

        const list = document.createElement('div');
        list.className = 'mepre-event-list';
        events.sort((a,b) => String(a.start).localeCompare(String(b.start))).forEach(ev => {
          const d = parseLocal(ev.start);
          const row = document.createElement(ev.url ? 'a' : 'div');
          if (ev.url) {
            row.href = ev.url;
            row.target = '_self';
          }
          row.className = `mepre-event-row ${statusClass(ev)}`;
          row.innerHTML = `<span class="mepre-time">${formatterTime.format(d)}</span><span class="mepre-event-title">${escapeHtml(normalTitle(ev))}</span>`;
          list.appendChild(row);
        });
        section.appendChild(list);
        panel.appendChild(section);
      }
    }

    const agendaHost = document.getElementById('divAgenda') || document.body;
    agendaHost.appendChild(panel);
    panel.scrollIntoView({behavior:'smooth', block:'start'});
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function icsDate(d) {
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function icsEscape(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  function foldLine(line) {
    // Plegado simple de iCalendar; suficiente para títulos cortos de MEPRE.
    const max = 73;
    if (line.length <= max) return line;
    const chunks = [];
    let rest = line;
    while (rest.length > max) {
      chunks.push(rest.slice(0, max));
      rest = rest.slice(max);
    }
    chunks.push(rest);
    return chunks.join('\r\n ');
  }

  function makeICS(events) {
    const now = new Date();
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MEPRE Agenda Mejorada//AR//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:MEPRE',
      'X-WR-TIMEZONE:America/Argentina/Buenos_Aires'
    ];

    for (const ev of events) {
      const start = parseLocal(ev.start);
      if (!start) continue;
      const key = ev.mepreId || ev.mepreNumber || ev.id || 'evento';
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${icsEscape(`mepre-${key}-${icsDate(start)}@agenda-mejorada`)}`);
      lines.push(`DTSTAMP:${icsDate(now)}Z`);
      lines.push(`DTSTART;TZID=America/Argentina/Buenos_Aires:${icsDate(start)}`);
      if (ev.end) {
        const end = parseLocal(ev.end);
        if (end) lines.push(`DTEND;TZID=America/Argentina/Buenos_Aires:${icsDate(end)}`);
      }
      lines.push(`SUMMARY:${icsEscape(normalTitle(ev))}`);
      const desc = ['Agenda MEPRE', ev.mepreNumber ? `MEPRE N° ${ev.mepreNumber}` : '', ev.url || ''].filter(Boolean).join('\\n');
      lines.push(`DESCRIPTION:${icsEscape(desc)}`);
      if (ev.url) lines.push(`URL:${icsEscape(ev.url)}`);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.map(foldLine).join('\r\n') + '\r\n';
  }

  function downloadICS(payload) {
    if (!payload.events.length) return alert('No encontré eventos para exportar.');
    const data = makeICS(payload.events);
    const blob = new Blob([data], {type: 'text/calendar;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `MEPRE-agenda-${new Date().toISOString().slice(0,10)}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function printAgenda(payload) {
    if (!payload.events.length) return alert('No encontré eventos para imprimir.');
    const groups = groupEvents(payload.events);
    const rows = groups.map(([, events]) => {
      const d = parseLocal(events[0].start);
      const items = events.map(ev => `<tr><td class="time">${formatterTime.format(parseLocal(ev.start))}</td><td>${escapeHtml(normalTitle(ev))}</td><td class="notes"></td></tr>`).join('');
      return `<section><h2>${escapeHtml(capitalize(formatterDay.format(d)))}</h2><table><thead><tr><th>Hora</th><th>Audiencia</th><th>Anotaciones</th></tr></thead><tbody>${items}</tbody></table></section>`;
    }).join('');

    // Imprimimos dentro de un iframe temporal. Así no dependemos de ventanas
    // emergentes, que Chrome puede bloquear porque primero esperamos la lectura
    // asíncrona de los eventos de FullCalendar.
    const oldFrame = document.getElementById('mepre-agenda-print-frame');
    if (oldFrame) oldFrame.remove();

    const frame = document.createElement('iframe');
    frame.id = 'mepre-agenda-print-frame';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '1px';
    frame.style.height = '1px';
    frame.style.border = '0';
    frame.style.opacity = '0';
    frame.style.pointerEvents = 'none';
    document.body.appendChild(frame);

    const w = frame.contentWindow;
    const doc = frame.contentDocument || w.document;
    doc.open();
    doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Agenda MEPRE</title><style>
      @page{size:A4;margin:12mm} body{font-family:Arial,sans-serif;color:#111;margin:0} header{border-bottom:2px solid #222;margin-bottom:14px;padding-bottom:8px} h1{font-size:20px;margin:0 0 3px} header p{margin:0;color:#555;font-size:12px} section{break-inside:avoid;margin:0 0 16px} h2{font-size:15px;margin:0 0 5px;background:#eee;padding:6px 8px} table{border-collapse:collapse;width:100%;font-size:12px} th,td{border:1px solid #bbb;padding:7px 8px;text-align:left;vertical-align:top} th{background:#f5f5f5}.time{width:55px;font-weight:bold}.notes{width:32%;height:28px} footer{font-size:9px;color:#777;margin-top:12px}
    </style></head><body><header><h1>Agenda MEPRE</h1><p>${escapeHtml(payload.title || '')}</p></header>${rows}<footer>Generado desde MEPRE Agenda Mejorada · ${new Date().toLocaleString('es-AR')}</footer></body></html>`);
    doc.close();

    const cleanup = () => setTimeout(() => frame.remove(), 500);
    try {
      w.onafterprint = cleanup;
      setTimeout(() => {
        try {
          w.focus();
          w.print();
          // Respaldo por si el navegador no dispara afterprint.
          setTimeout(() => { if (frame.isConnected) frame.remove(); }, 60000);
        } catch (err) {
          frame.remove();
          alert('No pude abrir el cuadro de impresión. Probá nuevamente.');
        }
      }, 100);
    } catch (err) {
      frame.remove();
      alert('No pude preparar la impresión. Probá nuevamente.');
    }
  }

  function makeButton(text, action, primary=false) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `mepre-tool-button${primary ? ' primary' : ''}`;
    b.textContent = text;
    b.addEventListener('click', async () => {
      b.disabled = true;
      const old = b.textContent;
      b.textContent = 'Leyendo…';
      try {
        const payload = await requestEvents();
        await action(payload);
      } finally {
        b.textContent = old;
        b.disabled = false;
      }
    });
    return b;
  }

  function installToolbar() {
    if (document.getElementById(TOOLBAR_ID)) return;
    const calendar = document.getElementById('calendar');
    if (!calendar) return;

    const toolbar = document.createElement('div');
    toolbar.id = TOOLBAR_ID;
    const label = document.createElement('strong');
    label.textContent = 'Agenda mejorada';
    toolbar.appendChild(label);
    toolbar.appendChild(makeButton('Ver lista', buildAgenda, true));
    toolbar.appendChild(makeButton('Imprimir A4', printAgenda));
    toolbar.appendChild(makeButton('Exportar .ics', downloadICS));

    calendar.parentNode.insertBefore(toolbar, calendar);
  }

  installToolbar();

  // MEPRE usa ASP.NET AJAX y puede reemplazar la agenda sin recargar la página.
  const observer = new MutationObserver(() => installToolbar());
  observer.observe(document.documentElement, {childList:true, subtree:true});

  document.addEventListener('click', e => {
    const el = e.target.closest?.('#lbVerAGenda, .mostrarAgenda, .fc-button-prev, .fc-button-next, .fc-button-today, .fc-button-month, .fc-button-agendaWeek');
    if (el) setTimeout(installToolbar, 500);
  }, true);
})();
