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
  // Only fixed, low-cardinality product settings are allowed into GA.
  const events = new Set(['pocitej_open','view_section','settings_change','practice_start','practice_complete','battle_start','battle_complete','battle_pause','battle_resume','battle_tool','activity_error']);
  const allowed = {
    screen: ['math','battle','settings','stats','rewards','leaderboard'],
    setting: ['operation','range','multiplicationLimit','count','largeText'],
    tool: ['potion','shield','special'],
    error_kind: ['battle_load','battle_answer']
  };
  let opened = false;
  function activity(name, params = {}) {
    try {
      if (!events.has(name) || window['ga-disable-' + id] || !document.body.classList.contains('signed-in')) return;
      if (name === 'pocitej_open') { if (opened) return; opened = true; }
      else if (!opened) activity('pocitej_open');
      const p = window.AppSettings?.getPreferences() || {};
      const data = {account_mode: document.body.classList.contains('guest-mode') ? 'guest' : 'profile'};
      if (['addition','subtraction','multiplication'].includes(p.operation)) data.operation = p.operation;
      if ([10,20].includes(p.range)) data.number_range = String(p.range);
      if ([20,50,100].includes(p.multiplicationLimit)) data.multiplication_limit = String(p.multiplicationLimit);
      if ([6,9,12].includes(p.count)) data.exercise_count = String(p.count);
      if (typeof p.largeText === 'boolean') data.large_text = p.largeText ? 'on' : 'off';
      for (const [key, values] of Object.entries(allowed)) if (values.includes(params[key])) data[key] = params[key];
      // Deliberately exclude names, IDs, gender, answers, scores and error text.
      window.gtag('event', name, data);
    } catch { /* Analytics must never interrupt practice or a battle. */ }
  }
  window.UsageAnalytics = {activity};
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-view],[data-operation],[data-range],[data-multiplication-limit],[data-count]');
    if (!button) return;
    const view = button.dataset.view;
    const before = window.AppSettings?.getPreferences();
    setTimeout(() => {
      if (view) {
        const target = document.querySelector(view === 'battle' ? '#battle-view' : view === 'math' ? '#math-view' : view === 'settings' ? '#settings-view' : '#secondary-view');
        if (target && !target.hidden) activity('view_section', {screen:view});
      } else {
        const after = window.AppSettings?.getPreferences();
        for (const key of ['operation','range','multiplicationLimit','count']) if (before && after && before[key] !== after[key]) activity('settings_change', {setting:key});
      }
    });
  }, true);
  document.addEventListener('change', event => {
    if (event.target.id === 'large-text') activity('settings_change', {setting:'largeText'});
  });
  document.addEventListener('DOMContentLoaded', () => activity('pocitej_open'));
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(script);
})();
