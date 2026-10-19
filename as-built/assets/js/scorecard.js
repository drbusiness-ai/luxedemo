/* Off-plan scorecard · sample gauge + payment-plan estimator (estimates only). */
(() => {
  const LH = window.LH || {};
  const reduce = LH.reduce;
  const $ = s => document.querySelector(s);
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const num = el => { const v = parseFloat(String(el.value).replace(/[^0-9.]/g, '')); return isFinite(v) ? v : 0; };

  /* gauge for the fictional sample (78 / 100) */
  const arc = $('#gauge-arc');
  if (arc) {
    const C = 2 * Math.PI * 52, score = 78;
    const set = () => arc.setAttribute('stroke-dasharray', `${(score / 100) * C} ${C}`);
    if (reduce) set();
    else {
      arc.style.transition = 'stroke-dasharray 1.8s cubic-bezier(.16,1,.3,1)';
      new IntersectionObserver((en, ob) => { if (en[0].isIntersecting) { ob.disconnect(); setTimeout(set, 150); } }, { threshold: 0.3 }).observe($('#gauge'));
    }
    const sc = document.querySelector('.sc');
    if (sc) new IntersectionObserver((en, ob) => { if (en[0].isIntersecting) { ob.disconnect(); sc.querySelectorAll('.scrow').forEach(r => r.classList.add('is-in')); } }, { threshold: 0.15 }).observe(sc);
  }

  /* payment plan */
  const price = $('#pp-price'), dep = $('#pp-dep'), months = $('#pp-months'), bars = $('#pp-bars');
  if (!price) return;
  let pre = 60;
  const seg = document.querySelector('[data-seg="plan"]');
  seg.addEventListener('segchange', e => { pre = +e.detail; render(); });
  const depErr = $('#pp-dep-err');
  function render() {
    const P = num(price), M = +months.value;
    dep.setAttribute('max', String(pre));
    const asked = num(dep), over = asked > pre;
    if (depErr) depErr.textContent = over ? `Deposit can't exceed the ${pre}% due before handover.` : '';
    dep.setAttribute('aria-invalid', over ? 'true' : 'false');
    dep.closest('.money').classList.toggle('is-bad', over);
    const depPct = Math.min(Math.max(asked, 0), pre);
    const n = Math.max(1, Math.floor((M - 3) / 3));
    const instTotal = P * (pre - depPct) / 100;
    const inst = instTotal / n;
    const booking = P * depPct / 100, dldFee = P * 0.04, hand = P * (100 - pre) / 100;
    const items = [{ m: 0, v: booking + dldFee, k: 'key', l: `Booking: deposit + DLD fee, AED ${fmt(booking + dldFee)}` }];
    if (instTotal > 0) for (let i = 1; i <= n; i++) items.push({ m: i * 3, v: inst, k: '', l: `Month ${i * 3}: instalment, AED ${fmt(inst)}` });
    items.push({ m: M, v: hand, k: 'hand', l: `Month ${M}, handover: AED ${fmt(hand)}` });
    const max = Math.max(...items.map(i => i.v)) || 1;
    bars.innerHTML = items.map(i => `<button type="button" class="${i.k ? 'is-' + i.k : ''}" title="${i.l}" aria-label="${i.l}"><i style="height:${Math.max(2, (i.v / max) * 100)}%"></i></button>`).join('');
    $('#pp-months-out').textContent = M;
    $('#pp-end').textContent = `Handover, month ${M}`;
    $('#pp-t-dep-s').textContent = depPct + '%';
    $('#pp-t-dep').textContent = fmt(booking);
    $('#pp-t-dld').textContent = fmt(dldFee);
    $('#pp-t-inst-r').hidden = instTotal <= 0;
    $('#pp-t-inst-s').textContent = `${n} quarterly instalments of ${((pre - depPct) / n).toFixed(2)}%`;
    $('#pp-t-inst').textContent = fmt(instTotal);
    $('#pp-t-pre').textContent = fmt(booking + dldFee + instTotal);
    $('#pp-t-hand-s').textContent = (100 - pre) + '%';
    $('#pp-t-hand').textContent = fmt(hand);
    $('#pp-t-avg').textContent = fmt(instTotal / M);
  }
  price.addEventListener('input', render);
  price.addEventListener('blur', () => { price.value = fmt(num(price)); });
  dep.addEventListener('input', render);
  months.addEventListener('input', render);
  render();
})();
