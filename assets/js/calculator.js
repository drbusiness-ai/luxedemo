/* True Cost Calculator · all figures are estimates. Fee model as of Oct 2026:
   DLD transfer 4% of price · DLD admin AED 580 · trustee office AED 4,000 + 5% VAT (price >= AED 500k, else AED 2,000 + VAT)
   agency 2% + 5% VAT · mortgage registration 0.25% of loan + AED 290 · bank arrangement up to 1% of loan + 5% VAT · valuation AED 3,000 + 5% VAT
   off-plan: no trustee office fee (the developer charges its own Oqood admin fee, not modelled), cash only, agency usually paid by the developer
   net yield = (rent - service charge - maintenance - management) / (price + purchase costs)
   until the visitor edits them, rent follows the price at a 6% gross yield and size follows it at about AED 1,875 per sq ft */
(() => {
  const LH = window.LH || {};
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const reduce = LH.reduce;
  const MINUS = '\u2212';
  const fmt = n => { const r = Math.round(Math.abs(n)); return (n < 0 && r > 0 ? MINUS : '') + r.toLocaleString('en-US'); };
  const aed = n => (n < 0 && Math.round(Math.abs(n)) > 0 ? MINUS : '') + 'AED ' + fmt(Math.abs(n));
  const pct = (n, d = 2) => { const v = isFinite(n) ? n * 100 : 0; return (v < 0 && Math.abs(v) >= 0.5 * Math.pow(10, -d) ? MINUS : '') + Math.abs(v).toFixed(d) + '%'; };
  /* money fields: "3,000,000", "1.5M", "750k" */
  const money = str => {
    const m = String(str).toLowerCase().replace(/[\s,]/g, '').match(/^(\d*\.?\d+)(k|m)?/);
    if (!m) return 0;
    const v = parseFloat(m[1]) * (m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1);
    return isFinite(v) ? v : 0;
  };
  const num = el => money(el.value);
  /* rates and percentages: "4.25", "4,25" (a single comma with no point is a decimal comma), clamped */
  const dec = (el, max) => {
    let t = String(el.value).trim();
    if (/^\d*,\d+$/.test(t)) t = t.replace(',', '.');
    const v = parseFloat(t.replace(/[^0-9.]/g, ''));
    return Math.min(Math.max(isFinite(v) ? v : 0, 0), max);
  };
  const MIN_PRICE = 100000;
  const C = 2 * Math.PI * 50;

  const el = {
    price: $('#c-price'), priceR: $('#c-price-r'), ltv: $('#c-ltv'), ltvOut: $('#c-ltv-out'), rate: $('#c-rate'), arr: $('#c-arr'),
    years: $('#c-years'), yearsOut: $('#c-years-out'), rent: $('#c-rent'), scRate: $('#c-sc-rate'), scSize: $('#c-sc-size'), scFlat: $('#c-sc-flat'),
    maint: $('#c-maint'), mgmt: $('#c-mgmt'), comm: $('#c-comm')
  };
  if (!el.price) return;
  const st = { status: 'ready', pay: 'cash', sc: 'sqft' };
  let commBeforeOffplan = 2, commEditedOffplan = false, rentTouched = false, sizeTouched = false;

  /* tween displayed numbers so changes are easy to follow */
  const shown = new Map();
  function setNum(node, value, render) {
    if (!node) return;
    const from = shown.has(node) ? shown.get(node) : value;
    shown.set(node, value);
    if (reduce || from === value) { node.textContent = render(value); return; }
    const t0 = performance.now(), dur = 420;
    node._tw = t0;
    const step = now => {
      if (node._tw !== t0) return;
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      node.textContent = render(from + (value - from) * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const txt = (sel, s) => { const n = $(sel); if (n) n.textContent = s; };

  function compute() {
    const price = num(el.price);
    const valid = price >= MIN_PRICE;
    const offplan = st.status === 'offplan';
    const mortgage = st.pay === 'mortgage' && !offplan;
    const ltv = mortgage ? Math.min(+el.ltv.value, ltvCap(price)) / 100 : 0;
    const loan = price * ltv;
    const dld = price * 0.04;
    const admin = 580;
    const trustee = offplan ? 0 : (price >= 500000 ? 4000 : 2000) * 1.05;
    const commPct = dec(el.comm, 10) / 100;
    const comm = price * commPct * 1.05;
    const mreg = mortgage ? loan * 0.0025 + 290 : 0;
    const arrPct = dec(el.arr, 1) / 100;
    const arr = mortgage ? loan * arrPct * 1.05 : 0;
    const val = mortgage ? 3000 * 1.05 : 0;
    const fees = dld + admin + trustee + comm + mreg + arr + val;
    const down = price - loan;
    const upfront = down + fees;
    const years = +el.years.value || 25, ratePct = dec(el.rate, 15), rate = ratePct / 100 / 12, n = years * 12;
    const monthly = mortgage && loan > 0 ? (rate > 0 ? loan * rate / (1 - Math.pow(1 + rate, -n)) : loan / n) : 0;
    const rent = num(el.rent);
    const sc = st.sc === 'sqft' ? dec(el.scRate, 500) * num(el.scSize) : num(el.scFlat);
    const maint = price * dec(el.maint, 10) / 100;
    const mgmt = rent * dec(el.mgmt, 10) / 100;
    const netIncome = rent - sc - maint - mgmt;
    const invested = price + fees;
    const gross = price ? rent / price : 0;
    const net = invested ? netIncome / invested : 0;
    const cashflow = netIncome - monthly * 12;
    const coc = upfront ? cashflow / upfront : 0;
    return { price, valid, offplan, mortgage, ltv, loan, dld, admin, trustee, commPct, comm, mreg, arrPct, arr, val, fees, down, upfront, years, ratePct, monthly, rent, owner: rent <= 0, sc, maint, mgmt, netIncome, invested, gross, net, cashflow, coc, gv: price >= 2000000 };
  }
  const ltvCap = price => (price > 5000000 ? 70 : 80);
  const dash = (sel) => { const n = $(sel); if (n) { shown.delete(n); n.textContent = '\u2014'; } };

  function render() {
    const r = compute();
    LH.lastCalc = r;
    setNum($('#r-upfront'), r.upfront, aed);
    setNum($('#r-extra'), r.fees, aed);
    txt('#r-extra-pct', r.valid ? (r.fees / r.price * 100).toFixed(1) + '%' : '\u2014');
    txt('#r-upfront-l', r.offplan ? 'Total cost, price plus purchase costs' : 'Total cash needed upfront');
    txt('#row-sum-l', r.offplan ? 'Total cost' : 'Cash needed upfront');
    txt('#calcbar-v', r.valid ? aed(r.upfront) : '\u2014');
    setNum($('#d-total'), r.fees, fmt);

    /* cost split donut, 3 groups, 2px surface gap between segments */
    const groups = [r.dld + r.admin + r.trustee, r.comm, r.mreg + r.arr + r.val];
    const total = groups.reduce((a, b) => a + b, 0) || 1;
    let start = 0;
    groups.forEach((g, i) => {
      const c = $('#d' + (i + 1)), len = (g / total) * C, gap = g > 0 && g < total ? 2 : 0;
      c.setAttribute('stroke-dasharray', `${Math.max(0, len - gap)} ${C}`);
      c.setAttribute('stroke-dashoffset', String(-start));
      start += len;
      setNum($('#l' + (i + 1)), g, fmt);
      $('#lg' + (i + 1)).classList.toggle('is-off', g <= 0);
    });

    /* line items */
    $$('#rows [data-m]').forEach(li => (li.hidden = !r.mortgage));
    setNum($('#row-price'), r.price, fmt);
    setNum($('#row-loan'), r.loan, fmt);
    txt('#row-loan-s', Math.round(r.ltv * 100) + '% of value');
    setNum($('#row-down'), r.down, fmt);
    setNum($('#row-dld'), r.dld, fmt);
    setNum($('#row-admin'), r.admin, fmt);
    txt('#row-trustee-l', r.offplan ? 'Oqood / developer admin fee' : 'Trustee office fee');
    txt('#row-trustee-s', r.offplan ? 'Varies, confirm with the developer. Not in this total.' : r.price >= 500000 ? 'AED 4,000 + 5% VAT' : 'AED 2,000 + 5% VAT, under AED 500k');
    setNum($('#row-trustee'), r.trustee, fmt);
    txt('#row-comm-s', r.commPct > 0 ? (r.commPct * 100).toFixed(r.commPct * 100 % 1 ? 1 : 0) + '% + 5% VAT' : (r.offplan ? 'Paid by developer' : 'None'));
    setNum($('#row-comm'), r.comm, fmt);
    setNum($('#row-mreg'), r.mreg, fmt);
    txt('#row-arr-s', (r.arrPct * 100).toFixed(2).replace(/\.?0+$/, '') + '% of loan + 5% VAT');
    setNum($('#row-arr'), r.arr, fmt);
    setNum($('#row-val'), r.val, fmt);
    setNum($('#row-sum'), r.upfront, fmt);

    /* holding numbers */
    if (r.mortgage) {
      setNum($('#k-monthly'), r.monthly, aed);
      txt('#k-monthly-p', `Over ${r.years} years at ${r.ratePct}%, on a loan of ${aed(r.loan)}.`);
    } else { shown.delete($('#k-monthly')); txt('#k-monthly', 'Cash'); txt('#k-monthly-p', r.offplan ? 'Off-plan is modelled as cash. Mortgages come near completion.' : 'No loan in this scenario.'); }
    if (r.owner) {
      /* owner-occupied: show what it costs to hold, not a negative income or yield */
      txt('#k-income-l', 'Annual holding cost');
      setNum($('#k-income'), Math.max(0, -r.netIncome), aed);
      txt('#k-income-p', 'A year: service charge, maintenance and management.');
    } else {
      txt('#k-income-l', 'Net rental income');
      setNum($('#k-income'), r.netIncome, aed);
      txt('#k-income-p', 'A year, after service charge, maintenance and management.');
    }
    const showYield = r.valid && !r.owner;
    if (showYield) {
      setNum($('#k-gross'), r.gross, v => pct(v));
      setNum($('#k-net'), r.net, v => pct(v));
    } else { dash('#k-gross'); dash('#k-net'); }
    $('#k-gross').nextElementSibling.textContent = r.owner && r.valid ? 'Not applicable, owner-occupied.' : 'Rent ÷ price. The number most listings quote.';
    $('#k-net').nextElementSibling.textContent = r.owner && r.valid ? 'Not applicable, owner-occupied.' : 'Net income ÷ total invested, including purchase costs.';
    const scale = Math.max(r.gross, r.net, 0.08);
    $('#yb-gross').style.transform = `scaleX(${showYield ? Math.min(1, Math.max(0, r.gross / scale)) : 0})`;
    $('#yb-net').style.transform = `scaleX(${showYield ? Math.min(1, Math.max(0, r.net / scale)) : 0})`;
    txt('#yb-gross-v', showYield ? pct(r.gross) : '\u2014'); txt('#yb-net-v', showYield ? pct(r.net) : '\u2014');
    $('#k-note').hidden = !(showYield && (r.gross > 0.12 || r.gross < 0.03));
    $('#k-coc-w').hidden = !r.mortgage;
    if (r.mortgage) {
      setNum($('#k-coc'), r.cashflow, aed);
      txt('#k-coc-p', r.owner ? 'A year, holding costs plus mortgage payments.' : `A year after mortgage payments: ${pct(r.coc, 1)} on the ${aed(r.upfront)} cash you put in.`);
    }

    /* Golden Visa */
    const gv = $('#gv');
    if (!r.valid) {
      gv.classList.remove('is-yes', 'is-no');
      gv.querySelector('use').setAttribute('href', '#i-info');
      txt('#gv-h', 'Golden Visa check \u2014'); txt('#gv-p', 'Enter a property price of AED 100,000 or more to see the numbers.');
      txt('#send-summary', '\u2014');
      return;
    }
    gv.classList.toggle('is-yes', r.gv); gv.classList.toggle('is-no', !r.gv);
    gv.querySelector('use').setAttribute('href', r.gv ? '#i-check' : '#i-info');
    if (r.gv) {
      txt('#gv-h', 'Meets the Golden Visa property threshold');
      txt('#gv-p', `At ${aed(r.price)}, this property is above the AED 2M value that can support a 10-year Golden Visa application. Conditions apply to mortgaged and off-plan property, and the final decision rests with the authorities.`);
    } else {
      txt('#gv-h', 'Below the Golden Visa property threshold');
      txt('#gv-p', `${aed(2000000 - r.price)} more in property value would reach AED 2M, the level that can support a 10-year Golden Visa application.`);
    }
    txt('#send-summary', `${aed(r.price)} · ${st.status === 'ready' ? 'Ready' : 'Off-plan'} · ${r.mortgage ? 'Mortgage ' + Math.round(r.ltv * 100) + '%' : 'Cash'} · ${r.offplan ? 'total' : 'upfront'} ${aed(r.upfront)}`);
  }

  /* inputs */
  const formatMoney = input => { const v = num(input); input.value = v ? fmt(v) : '0'; };
  const fill = r => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min)) * 100 + '%');
  /* price drives the defaults the visitor has not touched: rent (6% gross), size (AED 1,875 / sq ft), loan-to-value cap */
  function followPrice() {
    const v = num(el.price);
    el.priceR.value = Math.min(Math.max(v, +el.priceR.min), +el.priceR.max);
    fill(el.priceR);
    if (v < MIN_PRICE) return;
    if (!rentTouched) el.rent.value = fmt(Math.round(v * 0.06 / 500) * 500);
    if (!sizeTouched) el.scSize.value = fmt(Math.max(100, Math.round(v / 1875 / 10) * 10));
    const cap = ltvCap(v);
    el.ltv.max = String(cap);
    if (+el.ltv.value > cap) el.ltv.value = String(cap);
    el.ltvOut.textContent = el.ltv.value + '%';
    fill(el.ltv);
  }
  let priceT = null;
  el.price.addEventListener('input', () => { clearTimeout(priceT); priceT = setTimeout(() => { followPrice(); render(); }, 250); });
  el.price.addEventListener('change', () => { clearTimeout(priceT); followPrice(); render(); });
  el.priceR.addEventListener('input', () => { el.price.value = fmt(+el.priceR.value); followPrice(); render(); });
  el.rent.addEventListener('input', () => { rentTouched = true; });
  el.scSize.addEventListener('input', () => { sizeTouched = true; });
  el.comm.addEventListener('input', () => { if (st.status === 'offplan') commEditedOffplan = true; });
  [el.rent, el.scSize, el.scFlat, el.price].forEach(i => i.addEventListener('blur', () => { formatMoney(i); }));
  [el.rate, el.arr, el.rent, el.scRate, el.scSize, el.scFlat, el.maint, el.mgmt, el.comm].forEach(i => i.addEventListener('input', render));
  el.ltv.addEventListener('input', () => { el.ltvOut.textContent = el.ltv.value + '%'; render(); });
  el.years.addEventListener('input', () => { el.yearsOut.textContent = el.years.value + ' years'; render(); });

  const showCollapse = (node, on) => { node.hidden = !on; };
  const payBtns = [...document.querySelectorAll('[data-seg="pay"] button')];
  document.querySelector('[data-seg="status"]').addEventListener('segchange', e => {
    st.status = e.detail;
    const off = st.status === 'offplan';
    showCollapse($('#c-offplan-note'), off);
    if (off) { commBeforeOffplan = dec(el.comm, 10); commEditedOffplan = false; el.comm.value = '0'; }
    else if (!commEditedOffplan) el.comm.value = String(commBeforeOffplan);
    /* off-plan is modelled as cash: mortgages are arranged near completion */
    if (off) { st.pay = 'cash'; showCollapse($('#c-mort'), false); }
    payBtns.forEach(b => {
      if (off) b.setAttribute('aria-pressed', String(b.dataset.v === 'cash'));
      if (b.dataset.v === 'mortgage') { b.disabled = off; b.title = off ? 'Mortgages are usually arranged near completion' : ''; }
    });
    $('#c-pay-h').hidden = !off;
    render();
  });
  document.querySelector('[data-seg="pay"]').addEventListener('segchange', e => { st.pay = e.detail; showCollapse($('#c-mort'), st.pay === 'mortgage'); render(); });
  document.querySelector('[data-seg="sc"]').addEventListener('segchange', e => {
    st.sc = e.detail;
    $('#c-sc-sqft').hidden = st.sc !== 'sqft';
    $('#c-sc-flat-w').hidden = st.sc !== 'flat';
    if (st.sc === 'flat') el.scFlat.value = fmt(num(el.scRate) * num(el.scSize));
    render();
  });

  LH.leadContext = LH.leadContext || {};
  LH.leadContext.calculator = () => { const r = compute(); return r.valid ? { price: r.price, fees: r.fees, upfront: r.upfront, net: r.owner ? 'Owner-occupied' : pct(r.net), pay: r.mortgage ? 'Mortgage' : 'Cash' } : { pay: r.mortgage ? 'Mortgage' : 'Cash' }; };
  LH.calc = compute;

  /* mobile: a slim bar with the live total, hidden once the send form is on screen */
  const cbar = $('#calcbar'), calcEl = $('#calculator'), sendEl = $('#send'), totalEl = $('.results .total');
  if (cbar && calcEl && sendEl && 'IntersectionObserver' in window) {
    const seen = new Map();
    const upd = () => cbar.classList.toggle('is-on', !!seen.get(calcEl) && !seen.get(sendEl) && !seen.get(totalEl));
    const ob = new IntersectionObserver(en => { en.forEach(x => seen.set(x.target, x.isIntersecting)); upd(); }, { threshold: 0 });
    [calcEl, sendEl, totalEl].forEach(n => n && ob.observe(n));
  }
  followPrice();
  render();
})();
