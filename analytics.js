'use strict';

// GOOGLE ANALYTICS 4: měřicí ID webu. Prázdná hodnota analytiku vypne.
const GOOGLE_ANALYTICS_ID = 'G-1DKYKCDZ49';

(() => {
  const id = GOOGLE_ANALYTICS_ID.trim();
  if (!/^G-[A-Z0-9]+$/.test(id)) return;
  if (!['https:', 'http:'].includes(window.location.protocol)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id, {
    // Nepředáváme přezdívku, PIN, identifikátor účtu ani výsledky dětí.
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_title: 'Počítáme',
    page_location: window.location.origin + window.location.pathname,
    page_referrer: ''
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(script);
})();
