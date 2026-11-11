// First-party aggregate analytics without browser-side identifiers or storage.
(function () {
  'use strict';

  if (window.StickerBenziAnalytics) return;

  const ENDPOINT = '/api/analytics/events';
  const ALLOWED_EVENTS = new Set([
    'page_view', 'view_item', 'add_to_cart',
    'click_whatsapp', 'click_bale', 'begin_checkout'
  ]);

  function send(eventType, productId) {
    if (!ALLOWED_EVENTS.has(eventType)) return;

    const payload = {
      eventType,
      pagePath: window.location.pathname || '/'
    };
    if (productId) payload.productId = String(productId);

    try {
      fetch(ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    } catch (_) {
      // Analytics must never interrupt shopping or checkout.
    }
  }

  window.StickerBenziAnalytics = {
    track(eventType, productId) { send(eventType, productId); }
  };

  document.addEventListener('stickerbenzi:analytics', (event) => {
    const detail = event.detail || {};
    send(detail.eventType, detail.productId);
  });

  document.addEventListener('click', (event) => {
    const link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!link) return;

    let url;
    try { url = new URL(link.href, window.location.href); } catch (_) { return; }
    const host = url.hostname.toLowerCase();
    if (host === 'wa.me' || host === 'api.whatsapp.com' || host === 'web.whatsapp.com') {
      send('click_whatsapp');
    } else if (host === 'ble.ir' || host === 'www.ble.ir') {
      send('click_bale');
    }
  }, true);

  function initialize() {
    send('page_view');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
