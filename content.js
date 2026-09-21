(() => {
  'use strict';

  const TOOLBAR_ID = 'mepre-agenda-mejorada-toolbar';
  const PANEL_ID = 'mepre-agenda-mejorada-panel';
  const BRIDGE_DATA_ID = 'mepre-agenda-bridge-data';
  const VIEW_HINT_ID = 'mepre-agenda-mejorada-view-hint';

  const formatterDay = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  const formatterTime = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  function cleanText(value) {
    const div = document.createElement('div');
    div.innerHTML = String(value || '').replace(/<br\s*\/?>/gi, ' — ');
    return (div.textContent || div.innerText || '')
      .replace(/🔒/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseLocal(isoString) {
    if (!isoString) return null;
    const s = String(isoString).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0);
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function normalTitle(ev) {
    return (ev.title || 'Audiencia MEPRE')
      .replace(/\s*[—-]\s*/g, ' — ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parsePx(value) {
    const n = parseFloat(String(value || '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function visibleRect(el) {
    try {
      const r = el.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) return r;
    } catch (_) {}
    return null;
  }

  function findDateByGeometry(eventEl, dayCells) {
    const er = visibleRect(eventEl);
    if (!er) return '';
    const x = er.left + Math.max(1, Math.min(er.width / 2, 20));
    const y = er.top + Math.max(1, Math.min(er.height / 2, 12));

    let best = null;
    for (const cell of dayCells) {
      const r = visibleRect(cell);
      if (!r) continue;
      const insideX = x >= r.left - 2 && x <= r.right + 2;
      const insideY = y >= r.top - 2 && y <= r.bottom + 2;
      if (!insideX || !insideY) continue;
      const distance = Math.abs(x - (r.left + r.width / 2)) + Math.abs(y - (r.top + 12));
      if (!best || distance < best.distance) best = {cell, distance};
    }
    return best?.cell?.dataset?.date || '';
  }

  // Respaldo específico para el FullCalendar antiguo de MEPRE. En la vista mensual,
  // los eventos están posicionados absolutamente y las filas tienen una altura que
  // FullCalendar deja escrita en el propio DOM. Esto permite reconstruir la fecha
  // incluso si el objeto interno de FullCalendar no es accesible desde la extensión.
  function findDateByOldMonthLayout(eventEl, calendar) {
    const weeks = [...calendar.querySelectorAll('tr.fc-week')];
    if (!weeks.length) return '';
    const top = parsePx(eventEl.style.top || getComputedStyle(eventEl).top);
    const left = parsePx(eventEl.style.left || getComputedStyle(eventEl).left);
    if (top == null || left == null) return '';

    const firstCells = weeks[0].querySelectorAll('td.fc-day[data-date]');
    if (!firstCells.length) return '';

    let dayWidth = parsePx(firstCells[0].style.width);
    if (!dayWidth) {
      const r = visibleRect(firstCells[0]);
      dayWidth = r?.width || null;
    }
    if (!dayWidth) dayWidth = 181; // ancho habitual de esta versión de MEPRE/FullCalendar

    const col = Math.max(0, Math.min(firstCells.length - 1, Math.floor((left + dayWidth / 2) / (dayWidth + 1))));

    // En esta versión, la primera franja de eventos comienza a 40 px y cada nueva
    // semana avanza: alto del contenido + 22 px del encabezado/espaciado de fila.
    let rowStart = 40;
    for (const week of weeks) {
      const cells = week.querySelectorAll('td.fc-day[data-date]');
      if (!cells.length) continue;
      const content = cells[0].querySelector('.fc-day-content > div');
      let h = parsePx(content?.style?.height);
      if (!h) {
        const r = visibleRect(cells[0]);
        h = r?.height ? Math.max(1, r.height - 22) : 100;
      }
      const rowEnd = rowStart + h + 22;
      if (top >= rowStart - 2 && top < rowEnd) return cells[col]?.dataset?.date || '';
      rowStart = rowEnd;
    }
    return '';
  }

  function ymd(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function currentViewName(calendar = document.getElementById('calendar')) {
    if (!calendar) return '';
    const view = calendar.querySelector('.fc-view');
    if (view?.classList.contains('fc-view-agendaWeek')) return 'agendaWeek';
    if (view?.classList.contains('fc-view-month')) return 'month';
    if (calendar.querySelector('.fc-button-agendaWeek.fc-state-active')) return 'agendaWeek';
    if (calendar.querySelector('.fc-button-month.fc-state-active')) return 'month';
    return '';
  }

  function viewLabel(name) {
    return name === 'agendaWeek' ? 'Semana' : name === 'month' ? 'Mes' : 'Vista actual';
  }

  const ES_MONTHS = {
    ene: 1, enero: 1,
    feb: 2, febrero: 2,
    mar: 3, marzo: 3,
    abr: 4, abril: 4,
    may: 5, mayo: 5,
    jun: 6, junio: 6,
    jul: 7, julio: 7,
    ago: 8, agosto: 8,
    sep: 9, sept: 9, septiembre: 9,
    oct: 10, octubre: 10,
    nov: 11, noviembre: 11,
    dic: 12, diciembre: 12
  };

  function normalizedSpanish(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function monthNumber(token) {
    const key = normalizedSpanish(token).replace(/[^a-z]/g, '');
    return ES_MONTHS[key] || ES_MONTHS[key.slice(0, 3)] || null;
  }

  function daysBetweenInclusive(start, end, max = 14) {
    const out = [];
    if (!(start instanceof Date) || !(end instanceof Date)) return out;
    const d = new Date(start);
    d.setHours(0,0,0,0);
    const limit = new Date(end);
    limit.setHours(0,0,0,0);
    let guard = 0;
    while (d <= limit && guard++ < max) {
      out.push(ymd(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  // FullCalendar 1.x (el que usa MEPRE) muestra títulos como
  // "14 - 18 de sep. del 2026". Esta función reconstruye el rango sin depender
  // de propiedades internas de FullCalendar.
  function parseWeekTitleDates(title) {
    const raw = normalizedSpanish(title).replace(/[–—]/g, '-');
    let m;

    // Misma semana dentro del mismo mes: 14 - 18 de sep del 2026
    m = raw.match(/(\d{1,2})\s*-\s*(\d{1,2})\s+de\s+([a-z]+)\s+(?:de|del)\s+(\d{4})/);
    if (m) {
      const month = monthNumber(m[3]);
      if (month) {
        return daysBetweenInclusive(
          new Date(+m[4], month - 1, +m[1]),
          new Date(+m[4], month - 1, +m[2])
        );
      }
    }

    // Cruce de mes: 28 de sep - 2 de oct del 2026
    m = raw.match(/(\d{1,2})\s+de\s+([a-z]+)\s*-\s*(\d{1,2})\s+de\s+([a-z]+)\s+(?:de|del)\s+(\d{4})/);
    if (m) {
      const m1 = monthNumber(m[2]);
      const m2 = monthNumber(m[4]);
      if (m1 && m2) {
        let y1 = +m[5], y2 = +m[5];
        if (m2 < m1) y2 += 1;
        return daysBetweenInclusive(
          new Date(y1, m1 - 1, +m[1]),
          new Date(y2, m2 - 1, +m[3])
        );
      }
    }

    // Formato alternativo: 28 sep - 2 oct 2026
    m = raw.match(/(\d{1,2})\s+([a-z]+)\s*-\s*(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if (m) {
      const m1 = monthNumber(m[2]);
      const m2 = monthNumber(m[4]);
      if (m1 && m2) {
        let y1 = +m[5], y2 = +m[5];
        if (m2 < m1) y2 += 1;
        return daysBetweenInclusive(
          new Date(y1, m1 - 1, +m[1]),
          new Date(y2, m2 - 1, +m[3])
        );
      }
    }
    return [];
  }

  function parseWeekHeaderDate(text, yearHint) {
    const raw = normalizedSpanish(text);
    let m = raw.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})(?:\s*[\/\-]\s*(\d{2,4}))?/);
    if (m) {
      let year = +(m[3] || yearHint || 0);
      if (year && year < 100) year += 2000;
      if (year) return ymd(new Date(year, +m[2] - 1, +m[1]));
    }
    m = raw.match(/(\d{1,2})\s+(?:de\s+)?([a-z]+)/);
    if (m) {
      const month = monthNumber(m[2]);
      if (month && yearHint) return ymd(new Date(+yearHint, month - 1, +m[1]));
    }
    return '';
  }

  function weekHeaderDates(calendar, viewInfo) {
    const agendaView = calendar.querySelector('.fc-view-agendaWeek, .fc-agenda') || calendar;
    let headers = [...agendaView.querySelectorAll('th.fc-day-header')];

    // Algunas compilaciones antiguas no usan fc-day-header en agendaWeek.
    if (!headers.length) {
      headers = [...agendaView.querySelectorAll('.fc-agenda-days thead th')]
        .filter(el => !el.classList.contains('fc-agenda-axis') && !el.classList.contains('fc-agenda-gutter'));
    }
    headers = headers.filter((el, i, arr) => arr.indexOf(el) === i && visibleRect(el));

    const title = viewInfo?.title || document.querySelector('#calendar .fc-header-title h2')?.textContent?.trim() || '';
    const yearHint = +(String(title).match(/\b(20\d{2})\b/)?.[1] || 0);
    const titleDates = parseWeekTitleDates(title);

    // Si FullCalendar expone el inicio de la vista, también lo usamos como respaldo.
    let base = parseLocal(viewInfo?.visStart || viewInfo?.start || '');
    if (base) base.setHours(0,0,0,0);

    const dowClasses = [
      ['fc-sun',0], ['fc-mon',1], ['fc-tue',2], ['fc-wed',3],
      ['fc-thu',4], ['fc-fri',5], ['fc-sat',6]
    ];

    const dates = headers.map((header, i) => {
      // La cabecera semanal normalmente contiene "lun. 14/9".
      const explicit = parseWeekHeaderDate(header.textContent, yearHint || base?.getFullYear());
      if (explicit) return explicit;

      const found = dowClasses.find(([cls]) => header.classList.contains(cls));
      const targetDow = found ? found[1] : null;

      // El título es nuestro respaldo más estable para MEPRE.
      if (titleDates.length) {
        if (targetDow != null) {
          const byDow = titleDates.find(ds => parseLocal(ds)?.getDay() === targetDow);
          if (byDow) return byDow;
        }
        if (titleDates[i]) return titleDates[i];
      }

      if (base) {
        const candidate = new Date(base);
        if (targetDow != null) {
          let guard = 0;
          while (candidate.getDay() !== targetDow && guard++ < 8) candidate.setDate(candidate.getDate() + 1);
          return ymd(candidate);
        }
        candidate.setDate(candidate.getDate() + i);
        return ymd(candidate);
      }
      return '';
    });

    // En caso extremo, aunque no podamos localizar las cabeceras, devolvemos el
    // rango derivado del título para que la geometría por columnas pueda usarlo.
    return {headers, dates, titleDates};
  }

  function weekDayColumns(calendar) {
    const agendaView = calendar.querySelector('.fc-view-agendaWeek, .fc-agenda') || calendar;
    let cols = [...agendaView.querySelectorAll('.fc-agenda-days tbody td[class*="fc-col"]')];
    if (!cols.length) {
      cols = [...agendaView.querySelectorAll('.fc-agenda-days tbody td.fc-widget-content')]
        .filter(el => !el.classList.contains('fc-agenda-axis') && !el.classList.contains('fc-agenda-gutter'));
    }
    return cols.filter((el, i, arr) => arr.indexOf(el) === i && visibleRect(el));
  }

  function findDateByWeekLayout(eventEl, calendar, viewInfo) {
    const {headers, dates, titleDates} = weekHeaderDates(calendar, viewInfo);
    const usableDates = dates.some(Boolean) ? dates : titleDates;
    if (!usableDates.length) return '';

    // En varias versiones 1.x el evento vive dentro de un contenedor fc-colN.
    let p = eventEl;
    while (p && p !== calendar) {
      const match = [...p.classList].join(' ').match(/(?:^|\s)fc-col(\d+)(?:\s|$)/);
      if (match) {
        const idx = +match[1];
        if (usableDates[idx]) return usableDates[idx];
      }
      p = p.parentElement;
    }

    const er = visibleRect(eventEl);
    if (er) {
      const x = er.left + er.width / 2;

      // Preferimos las cabeceras: comparten exactamente los límites X de cada día.
      if (headers.length) {
        let bestIndex = -1;
        let bestDistance = Infinity;
        headers.forEach((header, i) => {
          const r = visibleRect(header);
          if (!r) return;
          if (x >= r.left - 3 && x <= r.right + 3) {
            bestIndex = i;
            bestDistance = 0;
            return;
          }
          const distance = Math.abs(x - (r.left + r.width / 2));
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = i;
          }
        });
        if (bestIndex >= 0 && usableDates[bestIndex]) return usableDates[bestIndex];
      }

      // Respaldo: usar las columnas del cuerpo de agendaWeek.
      const cols = weekDayColumns(calendar);
      if (cols.length) {
        let bestIndex = -1;
        let bestDistance = Infinity;
        cols.forEach((col, i) => {
          const r = visibleRect(col);
          if (!r) return;
          if (x >= r.left - 3 && x <= r.right + 3) {
            bestIndex = i;
            bestDistance = 0;
            return;
          }
          const distance = Math.abs(x - (r.left + r.width / 2));
          if (distance < bestDistance) { bestDistance = distance; bestIndex = i; }
        });
        if (bestIndex >= 0 && usableDates[bestIndex]) return usableDates[bestIndex];
      }
    }

    // Último respaldo: estilos left/width relativos al área de los días.
    const left = parsePx(eventEl.style.left || getComputedStyle(eventEl).left);
    if (left != null && headers.length) {
      const eventWidth = parsePx(eventEl.style.width || getComputedStyle(eventEl).width) || 1;
      const eventCenter = left + eventWidth / 2;
      const widths = headers.map(h => parsePx(h.style.width) || visibleRect(h)?.width || 0);
      if (widths.some(Boolean)) {
        let cursor = 0, best = 0, bestDist = Infinity;
        widths.forEach((w, i) => {
          if (!w) return;
          const center = cursor + w / 2;
          const dist = Math.abs(eventCenter - center);
          if (dist < bestDist) { bestDist = dist; best = i; }
          cursor += w;
        });
        return usableDates[best] || '';
      }
    }
    return '';
  }

  function extractRenderedCalendar(viewInfo = null) {
    const calendar = document.getElementById('calendar');
    if (!calendar) return [];

    const activeView = viewInfo?.name || currentViewName(calendar);
    const dayCells = [...calendar.querySelectorAll('td.fc-day[data-date]')];
    const eventEls = [...calendar.querySelectorAll('.fc-event')];
    const events = [];

    for (let index = 0; index < eventEls.length; index++) {
      const el = eventEls[index];
      const href = el.getAttribute('href') || '';
      const titleNode = el.querySelector('.fc-event-title');
      const title = cleanText(titleNode ? titleNode.innerHTML : el.textContent);
      const timeText = (el.querySelector('.fc-event-time')?.textContent || '').trim();
      const timeMatch = timeText.match(/(\d{1,2}):(\d{2})/);
      const rangeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
      const time = timeMatch ? `${String(+timeMatch[1]).padStart(2, '0')}:${timeMatch[2]}` : '00:00';
      const endTime = rangeMatch ? `${String(+rangeMatch[3]).padStart(2, '0')}:${rangeMatch[4]}` : '';

      let date = '';
      if (activeView === 'agendaWeek') {
        date = findDateByWeekLayout(el, calendar, viewInfo);
      } else {
        date = findDateByGeometry(el, dayCells);
        if (!date) date = findDateByOldMonthLayout(el, calendar);
      }
      // Si FullCalendar no expuso el nombre de la vista, probamos ambos métodos.
      if (!date) date = findDateByGeometry(el, dayCells);
      if (!date) date = findDateByOldMonthLayout(el, calendar);
      if (!date) date = findDateByWeekLayout(el, calendar, viewInfo);
      if (!date) continue;

      const idFromUrl = /[?&]mepre=(\d+)/i.exec(href)?.[1] || '';
      const displayed = title.match(/MEPRE\s*N[°º]?\s*(\d+)/i)?.[1] || '';
      const bg = el.style.backgroundColor || getComputedStyle(el).backgroundColor || '';

      events.push({
        id: String(idFromUrl || `${displayed || 'evento'}-${date}-${time}-${index}`),
        mepreId: idFromUrl,
        mepreNumber: displayed,
        title,
        start: `${date}T${time}:00`,
        end: endTime ? `${date}T${endTime}:00` : null,
        allDay: !timeMatch,
        url: href,
        backgroundColor: bg,
        textColor: el.style.color || '',
        source: 'dom'
      });
    }
    return events;
  }

  function readBridgePayload() {
    const node = document.getElementById(BRIDGE_DATA_ID);
    if (!node?.textContent) return null;
    try {
      const payload = JSON.parse(node.textContent);
      if (!payload || !Array.isArray(payload.events)) return null;
      return payload;
    } catch (_) {
      return null;
    }
  }

  function unique(events) {
    const out = [];
    const seen = new Set();
    for (const ev of events || []) {
      if (!ev?.start || !parseLocal(ev.start)) continue;
      const key = [ev.mepreId || ev.mepreNumber || ev.id || '', ev.start, normalTitle(ev)].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ev);
    }
    return out.sort((a, b) => String(a.start).localeCompare(String(b.start)));
  }

  function filterToCurrentView(events, viewInfo) {
    const start = parseLocal(viewInfo?.visStart || viewInfo?.start || '');
    const end = parseLocal(viewInfo?.visEnd || viewInfo?.end || '');
    if (!start || !end || end <= start) return events || [];
    return (events || []).filter(ev => {
      const d = parseLocal(ev.start);
      return d && d >= start && d < end;
    });
  }

  function requestEvents(timeout = 900) {
    return new Promise(resolve => {
      let finished = false;
      const finish = bridgePayload => {
        if (finished) return;
        finished = true;
        window.removeEventListener('mepre-agenda-response', handler);

        // El DOM visible es el respaldo principal porque MEPRE usa una versión antigua
        // de FullCalendar y, según cómo se cargue la página, clientEvents puede no exponer
        // fechas a una extensión de Chrome.
        const view = bridgePayload?.view || {name: currentViewName()};
        const domEvents = extractRenderedCalendar(view);
        const bridgeEvents = bridgePayload?.events || [];
        const events = unique(filterToCurrentView([...bridgeEvents, ...domEvents], view));
        resolve({
          events,
          view,
          title: bridgePayload?.title || document.querySelector('#calendar .fc-header-title h2')?.textContent?.trim() || 'Agenda MEPRE',
          generatedAt: new Date().toISOString()
        });
      };

      const handler = () => finish(readBridgePayload());
      window.addEventListener('mepre-agenda-response', handler, {once: true});
      window.dispatchEvent(new CustomEvent('mepre-agenda-request'));
      setTimeout(() => finish(readBridgePayload()), timeout);
    });
  }

  function statusClass(ev) {
    const text = normalTitle(ev).toLowerCase();
    if (text.includes('programada')) return 'mepre-status-programada';
    if (text.includes('desist')) return 'mepre-status-desistida';
    return 'mepre-status-audiencia';
  }

  function groupEvents(events) {
    const groups = new Map();
    for (const ev of events || []) {
      const d = parseLocal(ev.start);
      if (!d) continue;
      const key = [d.getFullYear(), String(d.getMonth() + 1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ev);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function buildAgenda(payload) {
    const panel = document.getElementById(PANEL_ID) || document.createElement('section');
    panel.id = PANEL_ID;
    panel.innerHTML = '';

    const heading = document.createElement('div');
    heading.className = 'mepre-panel-heading';
    const activeLabel = viewLabel(payload.view?.name || currentViewName());
    heading.innerHTML = `<div><h2>Agenda mejorada</h2><p>${escapeHtml(payload.title || '')} · ${escapeHtml(activeLabel)} · ${payload.events.length} evento${payload.events.length === 1 ? '' : 's'}</p></div><button type="button" class="mepre-close" aria-label="Cerrar">×</button>`;
    heading.querySelector('.mepre-close').addEventListener('click', () => panel.remove());
    panel.appendChild(heading);

    const groups = groupEvents(payload.events);
    if (!groups.length) {
      const empty = document.createElement('div');
      empty.className = 'mepre-empty';
      empty.textContent = 'No pude asociar los eventos con sus fechas. Cerrá esta vista, dejá MEPRE en “Mes” o “Semana” y volvé a pulsar “Ver lista”.';
      panel.appendChild(empty);
    } else {
      for (const [, events] of groups) {
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

  function pad(n) { return String(n).padStart(2, '0'); }

  function icsDate(d) {
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function icsUtcDate(d) {
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  }

  function icsEscape(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  function foldLine(line) {
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
      lines.push(`DTSTAMP:${icsUtcDate(now)}`);
      lines.push(`DTSTART;TZID=America/Argentina/Buenos_Aires:${icsDate(start)}`);
      if (ev.end) {
        const end = parseLocal(ev.end);
        if (end) lines.push(`DTEND;TZID=America/Argentina/Buenos_Aires:${icsDate(end)}`);
      }
      lines.push(`SUMMARY:${icsEscape(normalTitle(ev))}`);
      const desc = ['Agenda MEPRE', ev.mepreNumber ? `MEPRE N° ${ev.mepreNumber}` : '', ev.url || ''].filter(Boolean).join('\n');
      lines.push(`DESCRIPTION:${icsEscape(desc)}`);
      if (ev.url) lines.push(`URL:${icsEscape(ev.url)}`);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.map(foldLine).join('\r\n') + '\r\n';
  }

  function downloadICS(payload) {
    if (!payload.events.length) return alert('No encontré eventos para exportar en la vista actual. Probá con “Mes” o “Semana” e intentá nuevamente.');
    const data = makeICS(payload.events);
    const blob = new Blob([data], {type: 'text/calendar;charset=utf-8'});
    const a = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = `MEPRE-agenda-${new Date().toISOString().slice(0,10)}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  }

  function printAgenda(payload) {
    if (!payload.events.length) return alert('No encontré eventos para imprimir en la vista actual. Probá con “Mes” o “Semana” e intentá nuevamente.');
    const groups = groupEvents(payload.events);
    if (!groups.length) return alert('Encontré eventos, pero no pude leer sus fechas. Probá con “Mes” o “Semana” e intentá nuevamente.');

    const rows = groups.map(([, events]) => {
      const d = parseLocal(events[0].start);
      const items = events.map(ev => `<tr><td class="time">${formatterTime.format(parseLocal(ev.start))}</td><td>${escapeHtml(normalTitle(ev))}</td><td class="notes"></td></tr>`).join('');
      return `<section><h2>${escapeHtml(capitalize(formatterDay.format(d)))}</h2><table><thead><tr><th>Hora</th><th>Audiencia</th><th>Anotaciones</th></tr></thead><tbody>${items}</tbody></table></section>`;
    }).join('');

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
    const activeLabel = viewLabel(payload.view?.name || currentViewName());
    doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Agenda MEPRE</title><style>
      @page{size:A4;margin:12mm} body{font-family:Arial,sans-serif;color:#111;margin:0} header{border-bottom:2px solid #222;margin-bottom:14px;padding-bottom:8px} h1{font-size:20px;margin:0 0 3px} header p{margin:0;color:#555;font-size:12px} section{break-inside:avoid;margin:0 0 16px} h2{font-size:15px;margin:0 0 5px;background:#eee;padding:6px 8px} table{border-collapse:collapse;width:100%;font-size:12px} th,td{border:1px solid #bbb;padding:7px 8px;text-align:left;vertical-align:top} th{background:#f5f5f5}.time{width:55px;font-weight:bold}.notes{width:32%;height:28px} footer{font-size:9px;color:#777;margin-top:12px}
    </style></head><body><header><h1>Agenda MEPRE</h1><p>${escapeHtml(payload.title || '')} · ${escapeHtml(activeLabel)} · ${payload.events.length} eventos</p></header>${rows}<footer>Generado desde MEPRE Agenda Mejorada · ${new Date().toLocaleString('es-AR')}</footer></body></html>`);
    doc.close();

    const cleanup = () => setTimeout(() => frame.remove(), 500);
    try {
      w.onafterprint = cleanup;
      setTimeout(() => {
        try {
          w.focus();
          w.print();
          setTimeout(() => { if (frame.isConnected) frame.remove(); }, 60000);
        } catch (_) {
          frame.remove();
          alert('No pude abrir el cuadro de impresión. Probá nuevamente.');
        }
      }, 150);
    } catch (_) {
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

  function updateToolbarView() {
    const hint = document.getElementById(VIEW_HINT_ID);
    if (!hint) return;
    const name = currentViewName();
    hint.textContent = `Vista actual: ${viewLabel(name)}`;
  }

  function installToolbar() {
    const existing = document.getElementById(TOOLBAR_ID);
    if (existing) {
      updateToolbarView();
      return;
    }
    const calendar = document.getElementById('calendar');
    if (!calendar) return;

    const toolbar = document.createElement('div');
    toolbar.id = TOOLBAR_ID;
    const label = document.createElement('strong');
    label.textContent = 'Agenda mejorada';
    toolbar.appendChild(label);

    const hint = document.createElement('span');
    hint.id = VIEW_HINT_ID;
    hint.className = 'mepre-view-hint';
    toolbar.appendChild(hint);

    toolbar.appendChild(makeButton('Ver lista', buildAgenda, true));
    toolbar.appendChild(makeButton('Imprimir A4', printAgenda));
    toolbar.appendChild(makeButton('Exportar .ics', downloadICS));

    calendar.parentNode.insertBefore(toolbar, calendar);
    updateToolbarView();
  }

  installToolbar();

  // No observamos todo el DOM: MEPRE/ASP.NET realiza muchas mutaciones y un
  // MutationObserver global puede volver lenta la página. El bridge nos avisa
  // únicamente después de una actualización parcial de ASP.NET.
  window.addEventListener('mepre-agenda-page-updated', () => {
    setTimeout(installToolbar, 80);
  });

  document.addEventListener('click', e => {
    const el = e.target.closest?.('#lbVerAGenda, .mostrarAgenda, .fc-button-prev, .fc-button-next, .fc-button-today, .fc-button-month, .fc-button-agendaWeek');
    if (!el) return;
    // FullCalendar actualiza su vista de forma síncrona/rápida. Sólo refrescamos
    // la etiqueta y reinstalamos la barra si MEPRE la hubiera reemplazado.
    setTimeout(() => {
      installToolbar();
      updateToolbarView();
    }, 120);
  }, true);
})();
