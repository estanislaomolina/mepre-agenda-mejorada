(() => {
  'use strict';

  const DATA_ID = 'mepre-agenda-bridge-data';

  function cleanText(value) {
    const div = document.createElement('div');
    div.innerHTML = String(value || '').replace(/<br\s*\/?>/gi, ' — ');
    return (div.textContent || div.innerText || '')
      .replace(/🔒/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function iso(value) {
    if (!value) return null;
    try {
      if (typeof value.format === 'function') return value.format('YYYY-MM-DDTHH:mm:ss');
      if (value instanceof Date) {
        const p = n => String(n).padStart(2, '0');
        return `${value.getFullYear()}-${p(value.getMonth()+1)}-${p(value.getDate())}T${p(value.getHours())}:${p(value.getMinutes())}:${p(value.getSeconds())}`;
      }
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    } catch (_) {
      return null;
    }
  }

  function extractView($calendar) {
    let view = null;
    try { view = $calendar.fullCalendar('getView'); } catch (_) {}

    let name = view?.name || '';
    if (!name) {
      const node = document.querySelector('#calendar .fc-view');
      if (node?.classList.contains('fc-view-agendaWeek')) name = 'agendaWeek';
      else if (node?.classList.contains('fc-view-month')) name = 'month';
    }

    return {
      name,
      title: view?.title || document.querySelector('#calendar .fc-header-title h2')?.textContent?.trim() || 'Agenda MEPRE',
      start: iso(view?.start),
      end: iso(view?.end),
      visStart: iso(view?.visStart || view?.start),
      visEnd: iso(view?.visEnd || view?.end)
    };
  }

  function extractViaFullCalendar() {
    if (!window.jQuery) return {events: [], view: null};
    const $ = window.jQuery;
    const $calendar = $('#calendar');
    if (!$calendar.length || typeof $calendar.fullCalendar !== 'function') return {events: [], view: null};

    const view = extractView($calendar);
    let source = [];
    try {
      source = $calendar.fullCalendar('clientEvents') || [];
    } catch (_) {
      return {events: [], view};
    }

    const events = source.map((ev, index) => {
      const title = cleanText(ev.title);
      const href = ev.url || '';
      const idFromUrl = /[?&]mepre=(\d+)/i.exec(href)?.[1] || '';
      const displayed = title.match(/MEPRE\s*N[°º]?\s*(\d+)/i)?.[1] || '';
      return {
        id: String(ev.id || idFromUrl || `${displayed}-${index}`),
        mepreId: idFromUrl,
        mepreNumber: displayed,
        title,
        start: iso(ev.start),
        end: iso(ev.end),
        allDay: !!ev.allDay,
        url: href,
        backgroundColor: ev.backgroundColor || ev.color || '',
        textColor: ev.textColor || '',
        source: 'fullcalendar'
      };
    }).filter(ev => ev.start);

    return {events, view};
  }

  function writePayload(payload) {
    let node = document.getElementById(DATA_ID);
    if (!node) {
      node = document.createElement('script');
      node.type = 'application/json';
      node.id = DATA_ID;
      (document.head || document.documentElement).appendChild(node);
    }
    node.textContent = JSON.stringify(payload);
  }

  // MEPRE usa ASP.NET AJAX. Escuchamos su evento oficial de fin de actualización
  // en vez de vigilar todas las mutaciones del documento. Esto mantiene la extensión
  // prácticamente inactiva mientras el usuario trabaja.
  try {
    const prm = window.Sys?.WebForms?.PageRequestManager?.getInstance?.();
    if (prm?.add_endRequest) {
      prm.add_endRequest(() => {
        window.dispatchEvent(new CustomEvent('mepre-agenda-page-updated'));
      });
    }
  } catch (_) {}

  window.addEventListener('mepre-agenda-request', () => {
    let extracted = {events: [], view: null};
    try { extracted = extractViaFullCalendar(); } catch (_) {}
    writePayload({
      events: extracted.events || [],
      view: extracted.view || null,
      title: extracted.view?.title || document.querySelector('#calendar .fc-header-title h2')?.textContent?.trim() || 'Agenda MEPRE',
      generatedAt: new Date().toISOString()
    });
    window.dispatchEvent(new CustomEvent('mepre-agenda-response'));
  });
})();
