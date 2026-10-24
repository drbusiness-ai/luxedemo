/* =========================================================
   AS BUILT · theme + brand boot. Designed and built by MAFSAN.
   Loaded in <head>, synchronously, after brands.js, so the right theme is set before the first paint.
   - Theme: the visitor's choice (localStorage "mf-theme"), else the system setting, else dark.
   - Brand: ?client=<key> picks a config from MF_BRANDS and is remembered; ?client=default resets.
     MFBrand.apply() (called at the end of <body>, before site.js) swaps the neutral text for the client's.
   ========================================================= */
(function () {
  var html = document.documentElement, store = {};
  try { store = window.localStorage; } catch (e) { store = null; }
  var get = function (k) { try { return store && store.getItem(k); } catch (e) { return null; } };
  var set = function (k, v) { try { if (store) v == null ? store.removeItem(k) : store.setItem(k, v); } catch (e) { /* private mode */ } };

  /* ---------- theme ---------- */
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  var chosen = get('mf-theme');
  var theme = chosen === 'light' || chosen === 'dark' ? chosen : (mq && mq.matches ? 'light' : 'dark');
  html.setAttribute('data-theme', theme);
  var tc = document.querySelector('meta[name="theme-color"]');
  if (tc && theme === 'light') tc.setAttribute('content', '#F4EFE6');
  function setTheme(t, remember) {
    if (t === html.getAttribute('data-theme')) return;
    html.classList.add('theme-switching');
    html.setAttribute('data-theme', t);
    if (remember) set('mf-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'light' ? '#F4EFE6' : '#070B1C');
    document.dispatchEvent(new CustomEvent('mf:theme', { detail: t }));
    setTimeout(function () { html.classList.remove('theme-switching'); }, 700);
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', function (e) { if (!get('mf-theme')) setTheme(e.matches ? 'light' : 'dark', false); });
  window.MFTheme = {
    get: function () { return html.getAttribute('data-theme'); },
    set: function (t) { setTheme(t, true); },
    toggle: function () { setTheme(html.getAttribute('data-theme') === 'light' ? 'dark' : 'light', true); }
  };

  /* ---------- brand ---------- */
  var BR = window.MF_BRANDS || {}, base = BR.mafsan || {};
  var q = null;
  try { q = new URLSearchParams(location.search).get('client'); } catch (e) { /* old browser */ }
  if (q === 'default' || q === '') { set('mf-client', null); q = null; }
  if (q && BR[q]) set('mf-client', q);
  var key = (q && BR[q]) ? q : (BR[get('mf-client')] ? get('mf-client') : (window.MF_DEFAULT_CLIENT || 'mafsan'));
  var B = {}, k;
  for (k in base) B[k] = base[k];
  for (k in (BR[key] || {})) B[k] = BR[key][k];
  B.key = key;
  window.MF_BRAND = B;
  html.setAttribute('data-client', key);
  var swap = key !== 'mafsan';
  if (swap) html.classList.add('mf-brand-pending');

  var ATTRS = ['alt', 'aria-label', 'content', 'title', 'href', 'placeholder', 'data-cursor'];
  /* fields swapped only inside [data-brand-area] (address lines), never page-wide: the community guide keeps its area name */
  var SCOPED = ['area', 'developer'];
  function apply(root) {
    root = root || document;
    var map = {}, list = [], name;
    if (swap) {
      for (name in base) {
        if (SCOPED.indexOf(name) !== -1) continue;
        if (typeof base[name] !== 'string' || base[name] === B[name] || !base[name]) continue;
        map[base[name]] = B[name]; list.push(base[name]);
      }
    }
    list.sort(function (a, b) { return b.length - a.length; });
    var re = list.length ? new RegExp(list.map(function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|'), 'g') : null;
    var fix = function (s) { return re ? s.replace(re, function (m) { return map[m]; }) : s; };
    if (re) {
      var w = document.createTreeWalker(root.body || root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) { return n.parentNode && n.parentNode.closest && n.parentNode.closest('[data-nobrand],script,style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
      }), n;
      while ((n = w.nextNode())) { var v = fix(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
      var scope = root === document ? document : root;
      scope.querySelectorAll('[' + ATTRS.join('],[') + ']').forEach(function (el) {
        if (el.closest('[data-nobrand]')) return;
        ATTRS.forEach(function (a) { var o = el.getAttribute(a); if (o) { var v2 = fix(o); if (v2 !== o) el.setAttribute(a, v2); } });
      });
      if (root === document) document.title = fix(document.title);
    }
    /* the footer wordmark, one span per letter */
    document.querySelectorAll('[data-brand-word]').forEach(function (el) {
      var t = (B.wordmark || [B.short]).join(' ').toUpperCase(), h = '';
      for (var i = 0; i < t.length; i++) h += t[i] === ' ' ? '<span class="sp"></span>' : '<span>' + t[i] + '</span>';
      el.innerHTML = h;
      /* long wordmarks shrink to fit one line: letters count 1, spaces .4 */
      el.style.setProperty('--wm-n', String(t.replace(/ /g, '').length + (t.split(' ').length - 1) * 0.4));
    });
    /* brand motif: the wolf pack gets a moon and a few pairs of eyes in the evening footer */
    var fi = document.querySelector('.foot__inner');
    if (B.motif === 'wolf' && fi && !fi.querySelector('.wolf-moon')) {
      var moon = document.createElement('div'); moon.className = 'wolf-moon'; moon.setAttribute('aria-hidden', 'true');
      var eyes = document.createElement('div'); eyes.className = 'wolf-eyes'; eyes.setAttribute('aria-hidden', 'true');
      eyes.innerHTML = '<i style="--x:14%;--y:9%;--d:0s"></i><i style="--x:31%;--y:5%;--d:2.3s"></i><i style="--x:63%;--y:7%;--d:4.1s"></i><i style="--x:84%;--y:11%;--d:1.2s"></i>';
      fi.insertBefore(moon, fi.firstChild); fi.appendChild(eyes);
    }
    /* address-only swaps (area, developer) inside elements marked data-brand-area, text and attributes */
    if (swap) {
      var smap = {}, slist = [];
      SCOPED.forEach(function (f) { if (base[f] && B[f] && base[f] !== B[f]) { smap[base[f]] = B[f]; slist.push(base[f]); } });
      if (slist.length) {
        slist.sort(function (a, b) { return b.length - a.length; });
        var sre = new RegExp(slist.map(function (x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|'), 'g');
        var sfix = function (str) { return str.replace(sre, function (m) { return smap[m]; }); };
        document.querySelectorAll('[data-brand-area]').forEach(function (el) {
          var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), tn;
          while ((tn = tw.nextNode())) { var tv = sfix(tn.nodeValue); if (tv !== tn.nodeValue) tn.nodeValue = tv; }
          ATTRS.forEach(function (a) { var o2 = el.getAttribute(a); if (o2) { var v3 = sfix(o2); if (v3 !== o2) el.setAttribute(a, v3); } });
        });
      }
    }
    /* the tower photo: hidden when the client sits in another building */
    if (B.towerPhoto === '') document.querySelectorAll('[data-brand-tower-photo]').forEach(function (f) { f.remove(); });
    /* the reception photo */
    document.querySelectorAll('[data-brand-photo]').forEach(function (fig) {
      var im = fig.querySelector('img'), cap = fig.querySelector('figcaption');
      if (!B.receptionPhoto) { fig.remove(); return; }
      if (im && im.getAttribute('src') !== B.receptionPhoto) im.setAttribute('src', B.receptionPhoto);
      if (cap) cap.textContent = B.receptionCaption || '';
      if (im) im.setAttribute('alt', B.receptionCaption || '');
    });
    html.classList.remove('mf-brand-pending');
  }
  setTimeout(function () { html.classList.remove('mf-brand-pending'); }, 2500);
  window.MFBrand = { apply: apply };
})();
