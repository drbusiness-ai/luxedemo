/* Business Bay guide · price per sq ft trend (ILLUSTRATIVE DATA for the preview;
   the live site replaces DATA with Dubai Land Department transactions). */
(() => {
  const host = document.getElementById('bb-chart');
  if (!host) return;
  const reduce = window.LH && window.LH.reduce;
  const DATA = [
    ['Q1 2022', 1320], ['Q2 2022', 1390], ['Q3 2022', 1450], ['Q4 2022', 1520],
    ['Q1 2023', 1600], ['Q2 2023', 1690], ['Q3 2023', 1760], ['Q4 2023', 1830],
    ['Q1 2024', 1910], ['Q2 2024', 1990], ['Q3 2024', 2060], ['Q4 2024', 2120],
    ['Q1 2025', 2190], ['Q2 2025', 2250], ['Q3 2025', 2300], ['Q4 2025', 2340],
    ['Q1 2026', 2380], ['Q2 2026', 2410], ['Q3 2026', 2430]
  ];
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const tbody = document.querySelector('#bb-chart-table tbody');
  if (tbody) tbody.innerHTML = DATA.map(([q, v]) => `<tr><td>${q}</td><td class="num">${fmt(v)}</td></tr>`).join('');

  const tip = document.createElement('div');
  tip.className = 'tip'; tip.setAttribute('aria-hidden', 'true');
  let drawn = false;

  function render() {
    const w = Math.max(300, host.clientWidth);
    const narrow = w < 600;
    const h = narrow ? 240 : 330;
    const m = { l: narrow ? 40 : 52, r: narrow ? 46 : 64, t: 18, b: 36 };
    const iw = w - m.l - m.r, ih = h - m.t - m.b;
    const yMin = 1200, yMax = 2600;
    const x = i => m.l + (i / (DATA.length - 1)) * iw;
    const y = v => m.t + ih - ((v - yMin) / (yMax - yMin)) * ih;
    const ticks = [1600, 2000, 2400];
    const pts = DATA.map(([, v], i) => [x(i), y(v)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    const area = line + `L${x(DATA.length - 1).toFixed(1)} ${m.t + ih}L${m.l} ${m.t + ih}Z`;
    const years = ['2022', '2023', '2024', '2025', '2026'];
    const last = pts[pts.length - 1];
    host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Line chart: illustrative average apartment price per sq ft in Business Bay, rising from AED 1,320 in Q1 2022 to AED 2,430 in Q3 2026.">
      <defs><linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c9a46a" stop-opacity=".26"/><stop offset="1" stop-color="#c9a46a" stop-opacity="0"/></linearGradient></defs>
      <g class="grid">${ticks.map(t => `<line x1="${m.l}" x2="${m.l + iw}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}</g>
      <g class="axis">${ticks.map(t => `<text x="${m.l - 10}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('')}
        ${years.map(yr => { const i = DATA.findIndex(d => d[0].endsWith(yr)); return `<text x="${i === 0 ? x(i) + 6 : x(i)}" y="${h - 8}" text-anchor="${i === 0 ? 'start' : 'middle'}">${yr}</text>`; }).join('')}</g>
      <path class="area" d="${area}"/>
      <path class="lineP" d="${line}"/>
      <circle class="dot" cx="${last[0]}" cy="${last[1]}" r="5"/>
      <text class="endlab" x="${last[0] + 10}" y="${last[1] + 4}">${fmt(DATA[DATA.length - 1][1])}</text>
      <line class="cross" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/>
      <circle class="dot hov" r="5" visibility="hidden"/>
      <rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/>
    </svg>`;
    host.appendChild(tip);
    const svg = host.querySelector('svg'), cross = svg.querySelector('.cross'), hov = svg.querySelector('.hov'), hit = svg.querySelector('.hit');
    const path = svg.querySelector('.lineP'), areaEl = svg.querySelector('.area');
    if (!drawn && !reduce) {
      const len = path.getTotalLength();
      path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
      areaEl.style.opacity = 0;
      new IntersectionObserver((en, ob) => {
        if (!en[0].isIntersecting) return;
        ob.disconnect(); drawn = true;
        path.style.transition = 'stroke-dashoffset 2.2s cubic-bezier(.16,1,.3,1)'; path.style.strokeDashoffset = 0;
        areaEl.style.transition = 'opacity 1.2s ease .8s'; areaEl.style.opacity = 1;
      }, { threshold: 0.3 }).observe(host);
    }
    const show = e => {
      const r = svg.getBoundingClientRect();
      const px = (e.clientX - r.left) * (w / r.width);
      const i = Math.max(0, Math.min(DATA.length - 1, Math.round(((px - m.l) / iw) * (DATA.length - 1))));
      const [qx, qy] = pts[i];
      cross.setAttribute('x1', qx); cross.setAttribute('x2', qx); cross.setAttribute('visibility', 'visible');
      hov.setAttribute('cx', qx); hov.setAttribute('cy', qy); hov.setAttribute('visibility', 'visible');
      tip.innerHTML = `${DATA[i][0]}<b>AED ${fmt(DATA[i][1])} / sq ft</b>illustrative`;
      tip.style.left = Math.min(Math.max(qx * (r.width / w), 70), r.width - 70) + 'px';
      tip.style.top = qy * (r.height / h) + 'px';
      tip.classList.add('is-on');
    };
    const hide = () => { cross.setAttribute('visibility', 'hidden'); hov.setAttribute('visibility', 'hidden'); tip.classList.remove('is-on'); };
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', hide);
  }
  render();
  let rw = host.clientWidth, t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (Math.abs(host.clientWidth - rw) > 20) { rw = host.clientWidth; render(); } }, 200); });
})();
