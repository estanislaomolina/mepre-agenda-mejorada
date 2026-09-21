(() => {
  'use strict';

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
      if (typeof value.toISOString === 'function') return value.toISOString();
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    } catch (_) {
      return null;
    }
  }

  function extractViaFullCalendar() {
    if (!window.jQuery) return [];
    const $ = window.jQuery;
    const $calendar = $('#calendar');
    if (!$calendar.length || typeof $calendar.fullCalendar !== 'function') return [];

    let source = [];
    try {
      source = $calendar.fullCalendar('clientEvents') || [];
    } catch (_) {
      return [];
    }

    return source.map((ev, index) => {
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
        textColor: ev.textColor || ''
      };
    }).filter(ev => ev.start);
  }

  function extractFromRenderedElements() {
    // Respaldo: algunas versiones de FullCalendar guardan el evento original
    // dentro de los datos jQuery del nodo renderizado.
    if (!window.jQuery) return [];
    const $ = window.jQuery;
    const out = [];
    $('#calendar .fc-event').each(function(index) {
      const $el = $(this);
      let ev = null;
      const data = $el.data() || {};
      for (const key of Object.keys(data)) {
        const candidate = data[key];
        if (candidate && typeof candidate === 'object') {
          if (candidate.event && candidate.event.start) ev = candidate.event;
          else if (candidate.start && (candidate.title || candidate.url)) ev = candidate;
          if (ev) break;
        }
      }
      if (!ev) return;
      const href = ev.url || $el.attr('href') || '';
      const title = cleanText(ev.title || $el.find('.fc-event-title').html() || $el.text());
      out.push({
        id: String(ev.id || /[?&]mepre=(\d+)/i.exec(href)?.[1] || index),
        mepreId: /[?&]mepre=(\d+)/i.exec(href)?.[1] || '',
        mepreNumber: title.match(/MEPRE\s*N[°º]?\s*(\d+)/i)?.[1] || '',
        title,
        start: iso(ev.start),
        end: iso(ev.end),
        allDay: !!ev.allDay,
        url: href,
        backgroundColor: ev.backgroundColor || ev.color || $el.css('background-color') || '',
        textColor: ev.textColor || $el.css('color') || ''
      });
    });
    return out.filter(ev => ev.start);
  }

  function unique(events) {
    const seen = new Set();
    return events.filter(ev => {
      const key = [ev.mepreId || ev.mepreNumber || ev.id, ev.start, ev.title].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function readCalendar() {
    let events = extractViaFullCalendar();
    if (!events.length) events = extractFromRenderedElements();
    return unique(events).sort((a, b) => String(a.start).localeCompare(String(b.start)));
  }

  window.addEventListener('mepre-agenda-request', () => {
    const events = readCalendar();
    window.dispatchEvent(new CustomEvent('mepre-agenda-response', {
      detail: {
        events,
        title: document.querySelector('#calendar .fc-header-title h2')?.textContent?.trim() || 'Agenda MEPRE',
        generatedAt: new Date().toISOString()
      }
    }));
  });
})();
