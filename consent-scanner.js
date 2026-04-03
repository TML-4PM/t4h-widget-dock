// ConsentX Consent Scanner — Content Script
// Injected by Snaps extension into every page
// Detects consent events, sends to service worker for wallet capture

(function() {
  'use strict';

  const CX_VERSION = '1.1.0';
  const SUPABASE_URL = 'https://lzfgigiyqpuuxslsygjt.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmdpZ2l5cXB1dXhzbHN5Z2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0MTc0NjksImV4cCI6MjA1OTk5MzQ2OX0.placeholder';

  // ── DETECTION PATTERNS ──────────────────────────────────────────────
  const PATTERNS = {
    // CSS selectors for consent UI elements
    selectors: [
      { sel: '#onetrust-accept-btn-handler',     label: 'Cookie Consent — OneTrust',           sensitivity: 'low',    sector: 'platform', type: 'Cookie' },
      { sel: '#accept-cookies',                   label: 'Cookie Accept',                       sensitivity: 'low',    sector: 'platform', type: 'Cookie' },
      { sel: '.cookie-accept',                    label: 'Cookie Accept',                       sensitivity: 'low',    sector: 'platform', type: 'Cookie' },
      { sel: '[data-testid="cookie-accept"]',     label: 'Cookie Accept',                       sensitivity: 'low',    sector: 'platform', type: 'Cookie' },
      { sel: '.gdpr-banner__accept',              label: 'GDPR Cookie Banner',                  sensitivity: 'medium', sector: 'platform', type: 'Cookie' },
      { sel: '[aria-label*="Accept all cookies"]',label: 'Accept All Cookies',                  sensitivity: 'medium', sector: 'platform', type: 'Cookie' },
      { sel: '[id*="consent-accept"]',            label: 'Consent Accept',                      sensitivity: 'medium', sector: 'platform', type: 'Cookie' },
    ],

    // Domain-based detection
    domains: [
      { domain: 'westpac.com.au',         label: 'Westpac Banking',       sensitivity: 'high', sector: 'banking' },
      { domain: 'commbank.com.au',        label: 'CommBank',              sensitivity: 'high', sector: 'banking' },
      { domain: 'anz.com.au',            label: 'ANZ Bank',              sensitivity: 'high', sector: 'banking' },
      { domain: 'nab.com.au',            label: 'NAB Banking',           sensitivity: 'high', sector: 'banking' },
      { domain: 'myhealth.gov.au',       label: 'My Health Record',      sensitivity: 'high', sector: 'health' },
      { domain: 'my.gov.au',            label: 'myGov',                 sensitivity: 'high', sector: 'government' },
      { domain: 'ato.gov.au',           label: 'ATO Portal',            sensitivity: 'high', sector: 'government' },
      { domain: 'centrelink.gov.au',    label: 'Centrelink',            sensitivity: 'high', sector: 'government' },
      { domain: 'schoolbox.com.au',     label: 'Schoolbox LMS',         sensitivity: 'medium', sector: 'education' },
      { domain: 'canvas.net',           label: 'Canvas LMS',            sensitivity: 'medium', sector: 'education' },
      { domain: 'sportsground.com.au',  label: 'Sportsground',          sensitivity: 'medium', sector: 'sport' },
      { domain: 'myrugby.com.au',       label: 'MyRugby Registration',  sensitivity: 'medium', sector: 'sport' },
    ],

    // Keyword patterns in page text / form labels
    keywords: [
      { kw: 'open banking',             label: 'Open Banking CDR Consent',           sensitivity: 'high',   sector: 'banking',     type: 'Explicit' },
      { kw: 'consumer data right',      label: 'Consumer Data Right',                sensitivity: 'high',   sector: 'banking',     type: 'Explicit' },
      { kw: 'cdr consent',              label: 'CDR Data Sharing Consent',           sensitivity: 'high',   sector: 'banking',     type: 'Explicit' },
      { kw: 'credit assessment',        label: 'Credit Assessment Data Sharing',     sensitivity: 'high',   sector: 'banking',     type: 'Explicit' },
      { kw: 'informed consent',         label: 'Medical Informed Consent',           sensitivity: 'high',   sector: 'health',      type: 'Informed' },
      { kw: 'my health record',         label: 'My Health Record Access',            sensitivity: 'high',   sector: 'health',      type: 'Explicit' },
      { kw: 'medicare',                 label: 'Medicare Data',                      sensitivity: 'high',   sector: 'health',      type: 'Explicit' },
      { kw: 'working with children',    label: 'Working With Children Check',        sensitivity: 'high',   sector: 'sport',       type: 'Proxy' },
      { kw: 'medical treatment authorisation', label: 'Medical Treatment Authorisation', sensitivity: 'high', sector: 'sport',    type: 'Proxy' },
      { kw: 'photo consent',            label: 'Photo/Video Release',                sensitivity: 'medium', sector: 'education',   type: 'Explicit' },
      { kw: 'excursion',                label: 'School Excursion Consent',           sensitivity: 'medium', sector: 'education',   type: 'Proxy' },
      { kw: 'i agree to the terms',     label: 'Terms of Service Agreement',         sensitivity: 'medium', sector: 'platform',    type: 'Implicit' },
      { kw: 'terms and conditions',     label: 'Terms & Conditions',                 sensitivity: 'medium', sector: 'platform',    type: 'Implicit' },
      { kw: 'privacy policy',           label: 'Privacy Policy Agreement',           sensitivity: 'medium', sector: 'platform',    type: 'Implicit' },
      { kw: 'by continuing you agree',  label: 'Implied Consent — Browsing',        sensitivity: 'low',    sector: 'platform',    type: 'Implied' },
      { kw: 'mygov',                   label: 'myGov Data Linking',                 sensitivity: 'high',   sector: 'government',  type: 'Explicit' },
      { kw: 'ato tax agent',            label: 'ATO Tax Agent Authorisation',        sensitivity: 'high',   sector: 'government',  type: 'Explicit' },
      { kw: 'biometric',               label: 'Biometric Data Consent',             sensitivity: 'high',   sector: 'platform',    type: 'Explicit' },
      { kw: 'face recognition',         label: 'Face Recognition Consent',           sensitivity: 'high',   sector: 'platform',    type: 'Explicit' },
      { kw: 'location services',        label: 'Location Data Consent',              sensitivity: 'medium', sector: 'platform',    type: 'Explicit' },
      { kw: 'marketing communications', label: 'Marketing Communications Opt-in',   sensitivity: 'low',    sector: 'platform',    type: 'Explicit' },
      { kw: 'superannuation',           label: 'Superannuation Data Consent',        sensitivity: 'high',   sector: 'banking',     type: 'Explicit' },
    ],

    // Form submission patterns
    forms: [
      { action: '/consent',       label: 'Consent Form Submission',  sensitivity: 'medium' },
      { action: '/authorize',     label: 'OAuth Authorisation',       sensitivity: 'high' },
      { action: '/oauth/token',   label: 'OAuth Token Grant',         sensitivity: 'high' },
      { action: '/privacy',       label: 'Privacy Settings Form',     sensitivity: 'medium' },
      { action: '/settings/data', label: 'Data Settings Form',        sensitivity: 'medium' },
    ]
  };

  // ── STATE ────────────────────────────────────────────────────────────
  let detected = [];
  let notified = new Set();
  let walletHandle = null;
  let isEnabled = true;

  // ── INIT ─────────────────────────────────────────────────────────────
  chrome.storage.local.get(['cx_wallet_handle','cx_enabled'], (res) => {
    walletHandle = res.cx_wallet_handle || null;
    isEnabled = res.cx_enabled !== false;
    if (isEnabled) scanPage();
  });

  // ── SCAN ─────────────────────────────────────────────────────────────
  function scanPage() {
    detected = [];
    const url = window.location.href;
    const domain = window.location.hostname.replace('www.','');
    const pageText = document.body ? document.body.innerText.toLowerCase() : '';
    const pageTitle = document.title || '';

    // 1. Domain scan
    PATTERNS.domains.forEach(d => {
      if (domain.includes(d.domain) || d.domain.includes(domain)) {
        addDetection({
          type: 'domain_match',
          consent_type: 'Explicit',
          consent_label: d.label,
          sensitivity: d.sensitivity,
          sector: d.sector,
          domain, url, pageTitle,
          confidence: 'high'
        });
      }
    });

    // 2. Keyword scan
    PATTERNS.keywords.forEach(k => {
      if (pageText.includes(k.kw.toLowerCase())) {
        addDetection({
          type: 'keyword',
          consent_type: k.type || 'Explicit',
          consent_label: k.label,
          sensitivity: k.sensitivity,
          sector: k.sector,
          domain, url, pageTitle,
          confidence: 'medium',
          matched_keyword: k.kw
        });
      }
    });

    // 3. Selector scan
    PATTERNS.selectors.forEach(s => {
      try {
        const el = document.querySelector(s.sel);
        if (el) {
          addDetection({
            type: 'ui_element',
            consent_type: s.type || 'Cookie',
            consent_label: s.label,
            sensitivity: s.sensitivity,
            sector: s.sector,
            domain, url, pageTitle,
            confidence: 'high',
            element_selector: s.sel
          });
        }
      } catch(e) {}
    });

    // 4. Form action scan
    document.querySelectorAll('form[action]').forEach(form => {
      const action = form.getAttribute('action') || '';
      PATTERNS.forms.forEach(f => {
        if (action.includes(f.action)) {
          addDetection({
            type: 'form',
            consent_type: 'Explicit',
            consent_label: f.label,
            sensitivity: f.sensitivity,
            sector: 'platform',
            domain, url, pageTitle,
            confidence: 'medium'
          });
        }
      });
    });

    if (detected.length > 0) {
      notifyServiceWorker();
    }
  }

  function addDetection(event) {
    const key = `${event.domain}:${event.consent_label}`;
    if (!notified.has(key)) {
      detected.push({ ...event, detected_at: new Date().toISOString() });
    }
  }

  function notifyServiceWorker() {
    chrome.runtime.sendMessage({
      type: 'CX_CONSENT_DETECTED',
      payload: {
        detected,
        wallet_handle: walletHandle,
        page_url: window.location.href,
        page_title: document.title
      }
    }).catch(() => {});
  }

  // ── LISTEN for capture trigger from popup/sidepanel ──────────────────
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (msg.type === 'CX_GET_DETECTED') {
      reply({ detected, url: window.location.href });
    }
    if (msg.type === 'CX_SCAN_NOW') {
      scanPage();
      reply({ detected });
    }
    if (msg.type === 'CX_SET_WALLET') {
      walletHandle = msg.wallet_handle;
      chrome.storage.local.set({ cx_wallet_handle: msg.wallet_handle });
      reply({ ok: true });
    }
  });

  // ── MUTATION OBSERVER — catch dynamically loaded consent UI ──────────
  const observer = new MutationObserver(() => {
    PATTERNS.selectors.forEach(s => {
      try {
        const el = document.querySelector(s.sel);
        const key = `${window.location.hostname}:${s.label}`;
        if (el && !notified.has(key)) {
          notified.add(key);
          addDetection({
            type: 'ui_element_dynamic',
            consent_type: s.type || 'Cookie',
            consent_label: s.label,
            sensitivity: s.sensitivity,
            sector: s.sector,
            domain: window.location.hostname,
            url: window.location.href,
            pageTitle: document.title,
            confidence: 'high'
          });
          notifyServiceWorker();
        }
      } catch(e) {}
    });
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

})();
