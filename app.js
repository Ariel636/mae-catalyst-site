(function () {
'use strict';
const STILL = document.documentElement.classList.contains('still');
const $ = (s, r = document) => r.querySelector(s);
const nf = (n, d) => n.toLocaleString('ru-RU', { maximumFractionDigits: d == null ? 2 : d, minimumFractionDigits: d || 0 });
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const A = 'assets/';
const DIA = '<span class="dia">Ø</span>';
const TOUCH = matchMedia('(pointer: coarse)').matches;

/* ================= STORY ================= */
// clean photos, Esri bboxes: overview 51.840,47.150-51.905,47.182; park 51.8640,47.1625-51.8770,47.1700 (both 1400x1000)
// so the park sits at x 516.9, y 375 of the overview, scaled 0.2 across and 0.2344 down
const KX = 0.013 / 0.065, KY = 0.0075 / 0.032, OFF = [(51.864 - 51.84) / 0.065 * 1400, (47.182 - 47.17) / 0.032 * 1000];
const FOCAL = [OFF[0] + 960 * KX, OFF[1] + 520 * KY];
// six similar small tanks in clean/1_park.jpg pixels (2 columns x 3 rows), collector, gasholder, ejector, furnace
const TANKS = [[798, 615], [878, 638], [763, 742], [843, 767], [740, 825], [820, 848]];
const TA = [776, 885], TB = [846, 585], WP = [975, 548], DOME = [1095, 330], DR = 40, EJ = [1150, 470], FURN = [1185, 650];

function foot(p) { // projection of p onto segment TA-TB
  const dx = TB[0] - TA[0], dy = TB[1] - TA[1];
  const t = clamp(((p[0] - TA[0]) * dx + (p[1] - TA[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  return [TA[0] + dx * t, TA[1] + dy * t];
}
function sample(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / step));
    for (let j = 0; j < n; j++) out.push([lerp(x0, x1, j / n), lerp(y0, y1, j / n)]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const TANK_PATHS = TANKS.map(t => sample([t, foot(t), TB, WP, DOME], 3));
const OUT_PATH = sample([DOME, EJ, FURN], 3);

// sky over the steppe through a day: [hour, multiply colour, multiply alpha, screen colour, screen alpha]
// night palette: the day never gets bright, the steppe reads as dusk in navy and sodium amber
const SKY = [
  [0, '#0F1B2D', .9, '#000000', 0], [4, '#172943', .84, '#000000', 0], [6, '#2B4366', .62, '#F4A940', .16],
  [9, '#3d5a85', .44, '#F3E9D8', .06], [13, '#4a6a96', .36, '#F3E9D8', .1], [17, '#2B4366', .5, '#F4A940', .18],
  [19.5, '#172943', .72, '#F4A940', .1], [22, '#0F1B2D', .86, '#000000', 0], [24, '#0F1B2D', .9, '#000000', 0]];
const hex = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
const HOURS = [[0, 5], [.3, 5], [.45, 13], [.56, 20], [.63, 26], [.72, 31], [.82, 37], [1, 41]];
function hourAt(p) { let i = 0; while (i < HOURS.length - 2 && HOURS[i + 1][0] < p) i++; const a = HOURS[i], b = HOURS[i + 1]; return lerp(a[1], b[1], clamp((p - a[0]) / (b[0] - a[0]), 0, 1)); }
function breath(h) { h = ((h % 24) + 24) % 24; return h > 6 && h < 20 ? Math.sin(Math.PI * (h - 6) / 14) : 0; }
function dayWord(h) {
  h = ((h % 24) + 24) % 24;
  return h < 5 ? 'ночь, резервуары вдыхают' : h < 8 ? 'рассвет' : h < 11 ? 'утро, крыши нагреваются' : h < 16 ? 'день, до +30 °C' : h < 19 ? 'вечер' : h < 21.5 ? 'сумерки' : 'ночь, резервуары вдыхают';
}
function holderLevel(p) { // % of gasholder, scripted to show 80 % on / 55 % off
  if (p < .66) return 15;
  if (p < .82) return lerp(15, 80, smooth(.66, .82, p));
  if (p < .86) return 80;
  return lerp(80, 55, smooth(.86, .97, p));
}

function makeSprite(rgb) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(.45, `rgba(${rgb},.45)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
}
const SPR_V = makeSprite('179,148,238'), SPR_C = makeSprite('57,211,195'), SPR_L = makeSprite('244,169,64');
// sodium lamps around the park, photo1 pixel coords
const LAMPS = [[700, 560], [930, 590], [900, 900], [680, 880], [990, 470], [1150, 380], [1250, 560], [520, 300], [420, 820], [1140, 760]];

function buildPipes(svg) {
  const stubs = TANKS.map(t => { const f = foot(t); return `<path class="pipe stub" pathLength="1" d="M${t[0]} ${t[1]}L${f[0].toFixed(1)} ${f[1].toFixed(1)}"/>`; }).join('');
  const ang = Math.atan2(WP[1] - DOME[1], WP[0] - DOME[0]);
  const end = [DOME[0] + Math.cos(ang) * DR, DOME[1] + Math.sin(ang) * DR];
  svg.innerHTML = `<defs><clipPath id="dc"><circle cx="${DOME[0]}" cy="${DOME[1]}" r="${DR - 3}"/></clipPath></defs>
  <g class="tanks"><path class="ring" d="M772 572L930 602L875 895L695 868Z"/><text class="lbl" x="712" y="596" text-anchor="end">6 × РВС-5000</text></g>
  <g class="net">${stubs}<path class="pipe" pathLength="1" d="M${TA[0]} ${TA[1]}L${TB[0]} ${TB[1]}L${WP[0]} ${WP[1]}L${end[0].toFixed(1)} ${end[1].toFixed(1)}"/></g>
  <g class="gh"><circle class="dome" cx="${DOME[0]}" cy="${DOME[1]}" r="${DR}"/>
  <rect class="domefill" clip-path="url(#dc)" x="${DOME[0] - DR}" width="${2 * DR}" y="${DOME[1] + DR}" height="0"/>
  <text class="lbl" x="${DOME[0] - DR - 14}" y="${DOME[1] + 9}" text-anchor="end">GH-1 <tspan class="lvl">15 %</tspan></text></g>
  <g class="out"><path class="hot" d="M${DOME[0] + DR} ${DOME[1]}L${EJ[0]} ${EJ[1]}L${FURN[0]} ${FURN[1]}"/>
  <rect class="ejbox" x="${EJ[0] - 14}" y="${EJ[1] - 14}" width="28" height="28" rx="3"/>
  <text class="lbl" x="${EJ[0] + 22}" y="${EJ[1] + 8}">EJ-1</text>
  <text class="lbl sm ejtag" x="${EJ[0] + 22}" y="${EJ[1] + 38}">работает до 55 %</text>
  <text class="lbl" x="${FURN[0] - 22}" y="${FURN[1] + 8}" text-anchor="end">печь П-1</text></g>`;
}

// night tint as plain opacity overlays (no blend modes): navy darkens, amber warms dawn/dusk, white lifts noon
const NAVY_L = .07, C_N = [15, 27, 45], C_A = [244, 169, 64], C_W = [243, 233, 216];
const lum = c => { const [r, g, b] = hex(c); return (.2126 * r + .7152 * g + .0722 * b) / 255; };
const TINT = SKY.map(([h, mc, ma, sc, sa]) => [h, Math.min(.95, ma * (1 - lum(mc)) / (1 - NAVY_L)), sc === '#F4A940' ? sa * .6 : 0, sc === '#F3E9D8' ? sa * .5 : 0]);
function tint(h) {
  h = ((h % 24) + 24) % 24;
  let i = 0; while (TINT[i + 1][0] < h) i++;
  const a = TINT[i], b = TINT[i + 1], t = (h - a[0]) / (b[0] - a[0]);
  return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
}
// write a style only when it changed: style writes every frame were the main paint cost
function setS(el, prop, v) { const c = el._s || (el._s = {}); if (c[prop] !== v) { c[prop] = v; el.style[prop] = v; } }
function setA(el, name, v) { const c = el._a || (el._a = {}); if (c[name] !== v) { c[name] = v; el.setAttribute(name, v); } }
function setT(el, v) { if (el._t !== v) { el._t = v; el.textContent = v; } }
const r3 = v => Math.round(v * 1000) / 1000;

const MAXP = 420, CVR = .5; // particle cap; plume backing at half screen resolution (soft sprites, 4x fewer pixels to fill)
// the plume canvas is screen-sized at 1x: drawing it inside the 5x-zoomed photo layer was the main frame cost
function Stage(el) {
  const world = $('.world', el), inner = $('.inner', el), ph1 = $('.ph1', el), svg = $('.pipes', el), cv = $('.plume', el);
  // static screenshots: a CPU canvas, which headless Chrome paints reliably in very tall windows
  const ctx = cv.getContext('2d', { willReadFrequently: document.documentElement.classList.contains('static') });
  let view = [1, 0, 0]; // current S, tx, ty of the photo world
  const ph0 = $('.ph0', el), hud = $('.hud', el);
  let tintBg = ''; // night tint, painted as the first fill of the plume canvas (one full-screen layer instead of two)
  const clock = $('.hud__clock', el), what = $('.hud__what', el), panels = [...el.querySelectorAll('.panel')].map(pn => ({ pn, f: +pn.dataset.from, t: +pn.dataset.to }));
  inner.style.transform = `translate(${OFF[0]}px,${OFF[1]}px) scale(${KX},${KY})`;
  const ovl = $('.ovl', el);
  buildPipes(svg);
  const net = [...svg.querySelectorAll('.net path')], gh = $('.gh', svg), out = $('.out', svg), fill = $('.domefill', svg), lvl = $('.lvl', svg), ejb = $('.ejbox', svg);
  const hot = $('.hot', out), tanksG = $('.tanks', svg), ejtag = $('.ejtag', svg);
  net.forEach(n => { n.style.strokeDasharray = 1; });
  let parts = [], acc = 0, W = 0, H = 0, drawn = false, frozenAt = null;
  let slow = 16, lastT = performance.now(), odd = false;
  const measure = () => { W = el.clientWidth; H = el.clientHeight; el.classList.toggle('portrait', W / H < 1); const cw = Math.ceil(W * CVR), chh = Math.ceil(H * CVR); if (cv.width !== cw || cv.height !== chh) { cv.width = cw; cv.height = chh; if (frozenAt != null) api.freeze(frozenAt); } }; // resizing clears the canvas, so only when the size really changed
  measure(); new ResizeObserver(measure).observe(el);

  function layout(p) {
    const s0 = Math.max(W / 1400, H / 1000);
    // landscape: the park photo covers the screen; portrait: show ~620 park px across (tanks, GH-1, EJ-1)
    const Sf = W / H < 1 ? W / (620 * KX) : Math.max(W / (1400 * KX), H / (1000 * KY)) * 1.02;
    const zt = smooth(.02, .3, p), S = Math.exp(lerp(Math.log(s0), Math.log(Sf), zt));
    const fx = lerp(700, FOCAL[0] + (W / H < 1 ? 70 * KX : 0), zt), fy = lerp(500, FOCAL[1] - (W / H < 1 ? 160 * KY : 0), zt);
    let tx = clamp(W / 2 - fx * S, W - 1400 * S, 0), ty = clamp(H / 2 - fy * S, H - 1000 * S, 0);
    // once zoomed in, keep the park photo edge off screen (no seam against the low-res overview)
    const k = smooth(.1, .2, p), px0 = -OFF[0] * S, px1 = W - (OFF[0] + 1400 * KX) * S, py0 = -OFF[1] * S, py1 = H - (OFF[1] + 1000 * KY) * S;
    if (px1 <= px0) tx = lerp(tx, clamp(tx, px1, px0), k);
    if (py1 <= py0) ty = lerp(ty, clamp(ty, py1, py0), k);
    setS(world, 'transform', `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${S.toFixed(4)})`);
    view = [S, tx, ty];
    // pipes sit above the plume canvas, in park-photo pixels
    setS(svg, 'transform', `translate(${(tx + S * OFF[0]).toFixed(1)}px,${(ty + S * OFF[1]).toFixed(1)}px) scale(${(S * KX).toFixed(4)},${(S * KY).toFixed(4)})`);
    setS(ph1, 'opacity', r3(smooth(.15, .26, p)));
    setS(ovl, 'opacity', r3(smooth(.15, .18, p) * (1 - smooth(.22, .27, p))));
  }

  function step(p) {
    const h = hourAt(p), vis = smooth(.2, .3, p), cap = smooth(.64, .72, p), br = breath(h), ejOn = p > .84 && p < .975;
    acc += (0.12 + 1.5 * br) * vis * 1.6; // fewer, denser puffs: drawImage fill was the main cost
    while (acc >= 1) {
      acc -= 1;
      if (parts.length >= MAXP) { acc = 0; break; }
      const i = (Math.random() * 6) | 0, t = TANKS[i];
      if (Math.random() < cap) parts.push({ m: 1, i, s: 0, v: 2 + Math.random() * .8, life: 1e9, age: 0, x: 0, y: 0, vx: 0, vy: 0 });
      else parts.push({ m: 0, i, s: 0, v: 0, x: t[0] + (Math.random() - .5) * 34, y: t[1] + (Math.random() - .5) * 22, vx: .35 + Math.random() * .4, vy: -(.45 + Math.random() * .6), age: 0, life: 150 + Math.random() * 90 });
    }
    if (ejOn && Math.random() < .7 && parts.length < MAXP) parts.push({ m: 2, i: 0, s: 0, v: 2.4, life: 1e9, age: 0, x: 0, y: 0, vx: 0, vy: 0 });
    let n = 0; // compact in place, no new array per frame
    for (const q of parts) {
      q.age++;
      if (q.m === 0) { q.x += q.vx; q.y += q.vy; q.vy *= .997; q.vx += .002; }
      else { q.s += q.v; const P = q.m === 1 ? TANK_PATHS[q.i] : OUT_PATH; if (q.s >= P.length - 1) q.age = q.life + 1; }
      if (q.age < q.life) parts[n++] = q;
    }
    parts.length = n;
  }

  function draw(p) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    if (tintBg) { ctx.fillStyle = tintBg; ctx.fillRect(0, 0, cv.width, cv.height); }
    if (p < .15) { drawn = !!tintBg; return; } // no plume before the zoom
    drawn = true;
    const [S, tx, ty] = view; // park-photo pixels -> screen
    ctx.setTransform(CVR * S * KX, 0, 0, CVR * S * KY, CVR * (tx + S * OFF[0]), CVR * (ty + S * OFF[1]));
    const nightK = (1 - breath(hourAt(p))) * smooth(.2, .3, p);
    if (nightK > .02) for (const [x, y] of LAMPS) {
      ctx.globalAlpha = .55 * nightK; ctx.drawImage(SPR_L, x - 34, y - 34, 68, 68);
      ctx.globalAlpha = nightK; ctx.drawImage(SPR_L, x - 7, y - 7, 14, 14);
    }
    // vented methane: strong while the day panel talks about it, fades to ~5 % once capture is on
    const ventK = lerp(1, .05, smooth(.64, .72, p)), halo = smooth(.34, .37, p) * (1 - smooth(.5, .53, p));
    if (halo > .01) for (const [x, y] of TANKS) { ctx.globalAlpha = .55 * halo; ctx.drawImage(SPR_V, x - 50, y - 74, 100, 100); }
    for (const q of parts) {
      if (q.m === 0) {
        const k = q.age / q.life, a = Math.min(1, k * 6) * (1 - k), r = 14 + k * 80;
        ctx.globalAlpha = Math.min(1, a * .62) * ventK; ctx.drawImage(SPR_V, q.x - r, q.y - r, r * 2, r * 2);
      } else {
        const P = q.m === 1 ? TANK_PATHS[q.i] : OUT_PATH, pt = P[Math.min(P.length - 1, q.s | 0)];
        ctx.globalAlpha = .9; ctx.drawImage(SPR_C, pt[0] - 12, pt[1] - 12, 24, 24);
      }
    }
    ctx.globalAlpha = 1;
  }

  function overlay(p) {
    const h = hourAt(p), k = smooth(.22, .3, p), [na, aa, wa] = tint(h);
    // navy, amber and white overlays merged into one solid colour (normal "over" blending is associative)
    const a1 = na * k, a2 = aa * k, a3 = wa * k, A = 1 - (1 - a1) * (1 - a2) * (1 - a3);
    const w1 = a1 * (1 - a2) * (1 - a3), w2 = a2 * (1 - a3), w3 = a3;
    const ch = i => Math.round((C_N[i] * w1 + C_A[i] * w2 + C_W[i] * w3) / A);
    const bg = A > .002 ? `rgba(${[0, 1, 2].map(ch).join(',')},${r3(A)})` : 'transparent';
    tintBg = A > .002 ? bg : '';
    // once the park photo covers the screen, the overview is hidden (less to composite each frame)
    setS(ph0, 'visibility', p > .27 && !el.classList.contains('portrait') ? 'hidden' : 'visible');
    setS(hud, 'opacity', r3(smooth(.2, .24, p)));
    const hh = Math.floor(((h % 24) + 24) % 24), mm = Math.floor((h % 1) * 6) * 10;
    setT(clock, `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    setT(what, dayWord(h));
    const d = r3(1 - smooth(.62, .7, p));
    net.forEach(n => setS(n, 'strokeDashoffset', d));
    setS(gh, 'opacity', r3(smooth(.6, .66, p)));
    const L = holderLevel(p), fh = Math.round(2 * DR * L) / 100, ejOn = p > .84 && p < .975;
    setA(fill, 'y', DOME[1] + DR - fh); setA(fill, 'height', fh);
    setT(lvl, Math.round(L) + ' %');
    setS(out, 'opacity', r3(smooth(.78, .84, p)));
    setS(hot, 'opacity', ejOn ? 1 : .25);
    if (ejb._on !== ejOn) { ejb._on = ejOn; ejb.classList.toggle('on', ejOn); }
    setS(ejtag, 'opacity', ejOn ? 1 : 0);
    setS(tanksG, 'opacity', r3(smooth(.2, .26, p) * (1 - .6 * smooth(.62, .7, p))));
    for (const P of panels) {
      const o = r3((P.f <= 0 ? 1 : smooth(P.f, P.f + .025, p)) * (1 - smooth(P.t - .025, P.t, p)));
      setS(P.pn, 'opacity', o); setS(P.pn, 'transform', `translateY(${((1 - o) * 14).toFixed(1)}px)`);
      const on = o > .5; if (P.on !== on) { P.on = on; P.pn.classList.toggle('on', on); P.pn.setAttribute('aria-hidden', !on); }
    }
  }

  const api = {
    clock, what,
    // on a slow machine (frames over ~22 ms) the plume is redrawn every other frame; the photo and captions still move every frame
    render(p, sim) {
      layout(p); overlay(p);
      const now = performance.now(); slow = slow * .9 + (now - lastT) * .1; lastT = now; odd = !odd;
      if (sim && (p >= .15 || drawn || tintBg) && (slow < 22 || odd)) { step(p); if (slow >= 22) step(p); draw(p); }
    },
    freeze(p) { frozenAt = p; layout(p); overlay(p); parts = []; for (let i = 0; i < 300; i++) step(p); draw(p); }
  };
  return api;
}

const track = $('.story__track'), stage0 = $('.stage');
const nav = $('.nav');
const STATIC = document.documentElement.classList.contains('static');
const bar = $('#autobar'), startBtn = $('#autostart');
let autoplay = null; // set below for the live story or the reduced-motion frames
if (STILL) {
  // static version of the story: six fixed frames
  const ps = [0, .27, .46, .58, .74, .9];
  ps.slice(1).forEach(() => track.appendChild(stage0.cloneNode(true)));
  const stages = [...track.querySelectorAll('.stage')].map(s => Stage(s));
  const freezeAll = () => stages.forEach((s, i) => s.freeze(ps[i]));
  freezeAll(); addEventListener('resize', freezeAll);
  [...track.querySelectorAll('.stage')].slice(1).forEach(s => s.querySelectorAll('h1, #autostart').forEach(h => h.tagName === 'H1' ? h.outerHTML = `<p class="statement">${h.innerHTML}</p>` : h.remove()));
  // reduced motion: autoplay steps through the six frames on a timer
  if (!STATIC) autoplay = FrameAuto([...track.querySelectorAll('.stage')], stages);
} else {
  const st = Stage(stage0);
  const len = () => track.offsetHeight - stage0.clientHeight;
  const scrollP = () => clamp((scrollY - track.offsetTop) / len(), 0, 1);
  const posOf = p => track.offsetTop + p * len();
  const A_ = { on: false, playing: false, p: 0, speed: 1, last: 0, setY: 0, sync: 0 };
  const DUR = 40000; // whole day at 1x, ms (user asked for twice the original pace)
  const tick = now => {
    let p;
    if (A_.playing) {
      const dt = Math.min(100, now - A_.last); A_.last = now;
      A_.p = Math.min(1, A_.p + dt * A_.speed / DUR); p = A_.p;
      // the user scrolled the page (scrollbar, nav link): hand control back to scrolling
      if (Math.abs(scrollY - A_.setY) > 40) { handoff(); p = scrollP(); }
      // park the window at the matching position now and then; the stage is pinned, so this is invisible
      else if (now - A_.sync > 500) { A_.sync = now; A_.setY = Math.round(posOf(p)); scrollTo({ top: A_.setY, behavior: 'instant' }); }
      if (A_.p >= 1) finish();
      st.render(p, true); paintBar(p);
    } else {
      const r = track.getBoundingClientRect();
      p = clamp(-r.top / (r.height - stage0.clientHeight), 0, 1);
      if (r.bottom > 0 && r.top < innerHeight) { st.render(p, true); if (A_.on) paintBar(p); }
    }
    requestAnimationFrame(tick);
  };
  st.render(0, false); requestAnimationFrame(tick);
  // ?p=0.75 opens the story at that moment (deep link for the presenter)
  const qp = +new URLSearchParams(location.search).get('p');
  if (qp) addEventListener('load', () => scrollTo({ top: posOf(qp), behavior: 'instant' }));

  const fill = $('.ab__fill', bar), clk = $('.ab__clock', bar), pauseB = $('#abPause'), speedB = $('#abSpeed'), nextB = $('#abNext');
  function paintBar(p) { setS(fill, 'transform', `scaleX(${r3(p)})`); setT(clk, st.clock.textContent + ', ' + st.what.textContent); }
  function setPlaying(v) { A_.playing = v; A_.last = performance.now(); pauseB.textContent = v ? 'Пауза' : 'Продолжить'; pauseB.setAttribute('aria-pressed', !v); }
  function handoff() { if (!A_.playing) return; setPlaying(false); A_.setY = Math.round(posOf(A_.p)); scrollTo({ top: A_.setY, behavior: 'instant' }); }
  function finish() { A_.p = 1; handoff(); nextB.hidden = false; pauseB.hidden = true; nextB.focus({ preventScroll: true }); }
  function start() {
    A_.on = true; bar.hidden = false; nextB.hidden = true; pauseB.hidden = false;
    let p = scrollP(); if (p >= .99) p = 0;
    A_.p = p; A_.setY = Math.round(posOf(p)); scrollTo({ top: A_.setY, behavior: 'instant' });
    setPlaying(true); pauseB.focus({ preventScroll: true });
  }
  function resume() { if (A_.p >= 1 && !A_.playing) return; A_.p = scrollP(); A_.setY = Math.round(posOf(A_.p)); setPlaying(true); }
  function stop() { handoff(); A_.on = false; bar.hidden = true; startBtn.focus({ preventScroll: true }); }
  autoplay = {
    start, stop, active: () => A_.on,
    toggle() { A_.playing ? handoff() : resume(); },
    speed() { A_.speed = A_.speed === 1 ? 2 : 1; speedB.textContent = A_.speed + '×'; speedB.setAttribute('aria-label', `Скорость ${A_.speed}×`); },
    next() { stop(); scrollTo({ top: posOf(1), behavior: 'instant' }); $('#problem').scrollIntoView({ behavior: 'smooth' }); },
    userInput() { handoff(); }
  };
}

// autoplay controls, shared by the live story and the reduced-motion frames
function FrameAuto(frames, stages) {
  let i = 0, timer = 0, on = false, speed = 1;
  const fill = $('.ab__fill', bar), clk = $('.ab__clock', bar), pauseB = $('#abPause'), speedB = $('#abSpeed'), nextB = $('#abNext');
  const show = () => { frames[i].scrollIntoView({ behavior: 'instant' }); fill.style.transform = `scaleX(${i / (frames.length - 1)})`; clk.textContent = `Кадр ${i + 1} из ${frames.length}`; };
  const play = v => { clearInterval(timer); pauseB.textContent = v ? 'Пауза' : 'Продолжить'; pauseB.setAttribute('aria-pressed', !v); if (v) timer = setInterval(() => { if (i >= frames.length - 1) { play(false); nextB.hidden = false; pauseB.hidden = true; nextB.focus({ preventScroll: true }); return; } i++; show(); }, 4500 / speed); timer = v ? timer : 0; };
  return {
    start() { on = true; bar.hidden = false; nextB.hidden = true; pauseB.hidden = false; i = 0; show(); play(true); pauseB.focus({ preventScroll: true }); },
    stop() { play(false); on = false; bar.hidden = true; },
    active: () => on,
    toggle() { play(!timer); },
    speed() { speed = speed === 1 ? 2 : 1; speedB.textContent = speed + '×'; if (timer) play(true); },
    next() { this.stop(); $('#problem').scrollIntoView({ behavior: 'instant' }); },
    userInput() { if (timer) play(false); }
  };
}

// keep the photo credit clear of the control bar
new MutationObserver(() => document.documentElement.classList.toggle('autoplay-on', !bar.hidden)).observe(bar, { attributes: true, attributeFilter: ['hidden'] });
if (autoplay) {
  startBtn.addEventListener('click', () => autoplay.start());
  $('#abPause').addEventListener('click', () => autoplay.toggle());
  $('#abSpeed').addEventListener('click', () => autoplay.speed());
  $('#abStop').addEventListener('click', () => autoplay.stop());
  $('#abNext').addEventListener('click', () => autoplay.next());
  // the presenter is never fighting the page: any scroll gesture pauses
  ['wheel', 'touchstart'].forEach(t => addEventListener(t, () => { if (autoplay.active()) autoplay.userInput(); }, { passive: true }));
  addEventListener('keydown', e => {
    if (!autoplay.active()) return;
    const tag = e.target.tagName;
    if (e.key === 'Escape') { autoplay.stop(); return; }
    if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'A') { e.preventDefault(); autoplay.toggle(); return; }
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(e.key) && tag !== 'INPUT') autoplay.userInput();
  });
} else startBtn.remove();

const navTone = () => nav.classList.toggle('light', track.getBoundingClientRect().bottom < 60);
addEventListener('scroll', navTone, { passive: true }); navTone();
// phone: "Разделы" menu
const navBtn = $('.nav__toggle');
navBtn.addEventListener('click', () => navBtn.setAttribute('aria-expanded', nav.classList.toggle('open')));
$('#navlinks').addEventListener('click', e => { if (e.target.closest('a')) { nav.classList.remove('open'); navBtn.setAttribute('aria-expanded', 'false'); } });
addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { nav.classList.remove('open'); navBtn.setAttribute('aria-expanded', 'false'); navBtn.focus(); } });
if (TOUCH) {
  $('#pidIntro').textContent = 'Нажмите на тег. Два пальца: масштаб.';
  $('#dwIntro').textContent = 'Два пальца или двойное касание: масштаб. Штамп SolidWorks, английский.';
}
// scroll-spy
const links = [...document.querySelectorAll('#navlinks a')];
const spy = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  links.forEach(a => a.getAttribute('href') === '#' + e.target.id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'));
}), { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('main > section, #hero').forEach(sec => spy.observe(sec));

// numbers and units never split across lines: "1 500 м³", "+0,5 кПа"
const nb = t => t.replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00a0').replace(/(\d) (?=[%°мкбтМ×])/g, '$1\u00a0');
function nbsp(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) { const v = nb(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
}
const sub2 = t => esc(t).replace(/\b(O|CO)2\b/g, '$1<sub>2</sub>');

/* ================= DATA SECTIONS ================= */
fetch(A + 'data.json').then(r => r.json()).then(D => {
  how(D); pid(D); cad(D); drawings(D); calc(D); econ(D); delivery(D);
  nbsp(document.body);
}).catch(e => { console.error(e); });

function how(D) {
  const S = D.setpoints, C = D.calc;
  // short anchors for the speaker; all figures from data.json
  $('#steps').innerHTML = [
    ['Резервуары дышат', 'Пары в коллектор Г-150'],
    ['Газгольдер копит', `${nf(S.gasholder_m3)} м³, +${nf(S.holder_kpa)} кПа`],
    ['Эжектор по уровню', `Пуск ${S.ejector_on_pct} %, стоп ${S.ejector_off_pct} %. ${C.motive_liquid[0].toUpperCase() + C.motive_liquid.slice(1)} ${C.motive_flow_m3h} м³/ч, ${nf(C.nozzle_pressure_bar_g)} бар`],
    ['Сепаратор делит', 'Газ в печь П-1, C3–C4 в дизтопливо'],
    ['Защиты', `O<sub>2</sub> ${S.o2_alarm_pct} / ${S.o2_trip_pct} %, XV-1, ${D.interlocks.length} блокировок`]
  ].map(([a, b]) => `<li><h3>${a}</h3><p>${b}</p></li>`).join('');
  $('#setp').innerHTML = [
    ['Давление в коллекторе', `+${nf(S.holder_kpa)} кПа`], ['Сброс PSV-100', `+${nf(S.relief_kpa)} кПа`],
    ['Дыхательные клапаны', `+${nf(S.tank_breather_kpa[0])} / ${nf(S.tank_breather_kpa[1]).replace('-', '−')} кПа`],
    ['Эжектор, номинал', `${S.ejector_capacity_m3h} м³/ч (расчёт ${C.gas_suction_m3h})`], ['O<sub>2</sub> сигнал / останов', `${S.o2_alarm_pct} / ${S.o2_trip_pct} %`],
    ['Газгольдер', `${nf(S.gasholder_m3)} м³`]].map(([a, b]) => `<li>${a}: <b>${b}</b></li>`).join('');
  const SE = D.seasons;
  $('#seasons').innerHTML = [['Весна и осень', SE.spring_autumn], ['Лето', SE.summer.replace(/,.*$/, ', паров ×1,5')], ['Зима', SE.winter + ', паров меньше']]
    .map(([a, b]) => `<div><h3>${a}</h3><p>${esc(b.replace('-', '−'))}</p></div>`).join('');
  $('#locks tbody').innerHTML = D.interlocks.map(r => `<tr>${r.map(c => `<td>${sub2(c)}</td>`).join('')}</tr>`).join('');

  // gasholder hysteresis toy
  const on80 = S.ejector_on_pct, off55 = S.ejector_off_pct, lv = $('#lvl'), out = $('#lvlOut'), st = $('#lvlState');
  const yAt = v => 200 - 130 * v / 100;
  [['#m80', '#t80', on80], ['#m55', '#t55', off55]].forEach(([m, t, v]) => { $(m).setAttribute('y1', yAt(v)); $(m).setAttribute('y2', yAt(v)); $(t).setAttribute('y', yAt(v) + 4); });
  let on = false;
  const upd = () => {
    const v = +lv.value;
    if (v >= on80) on = true; if (v <= off55) on = false;
    out.textContent = v + ' %';
    $('#lvlFill').setAttribute('y', yAt(v)); $('#lvlFill').setAttribute('height', 130 * v / 100);
    $('#ejg .ej').classList.toggle('on', on);
    st.textContent = on
      ? `EJ-1 работает до ${off55} %, газ в печь`
      : `EJ-1 стоит, пуск при ${on80} %`;
  };
  lv.addEventListener('input', upd); upd();
  // the live isometric runs its own animation loop: load it only near the screen, unload when far
  const fr = $('.live iframe');
  if (document.documentElement.classList.contains('static')) fr.src = fr.dataset.src;
  else new IntersectionObserver(es => {
    const near = es[0].isIntersecting;
    if (near && fr.getAttribute('src') !== fr.dataset.src) fr.src = fr.dataset.src;
    if (!near && fr.getAttribute('src') === fr.dataset.src) fr.src = 'about:blank';
  }, { rootMargin: '400px 0px' }).observe(fr);
}

/* ---- pan / zoom viewer (from c2_sheet) ---- */
function Viewer(root, label) {
  root.innerHTML = `<div class="vp" tabindex="0" aria-label="${esc(label)}. Плюс и минус меняют масштаб, стрелки двигают лист"><div class="layer"><img alt="" draggable="false"></div></div>
  <p class="vhint">${TOUCH ? 'Нажмите на тег, сведите пальцы для масштаба' : 'Щёлкните по схеме, чтобы масштабировать'}</p>
  <div class="vtools"><button type="button" aria-label="Увеличить">+</button><button type="button" aria-label="Уменьшить">−</button><button type="button" aria-label="Вписать лист">□</button></div><div class="vscale">× 1</div>`;
  const vp = root.querySelector('.vp'), layer = root.querySelector('.layer'), img = layer.querySelector('img'), sc = root.querySelector('.vscale');
  const [bIn, bOut, bFit] = root.querySelectorAll('.vtools button');
  const used = () => root.classList.add('used'); // hide the hint after the first interaction
  ['pointerdown', 'wheel', 'keydown'].forEach(t => root.addEventListener(t, used, { once: true, passive: true }));
  let s = 1, x = 0, y = 0, W = 0, H = 0, svgSrc = null, vec = false, overlay = null;
  const MAX = 6;
  const measure = () => { W = vp.clientWidth; H = vp.clientHeight; };
  const apply = () => {
    x = clamp(x, W - W * s, 0); y = clamp(y, H - H * s, 0);
    layer.style.width = W * s + 'px'; layer.style.height = H * s + 'px';
    layer.style.transform = `translate(${x}px,${y}px)`;
    sc.textContent = `× ${nf(s, 1)}`;
    if (!vec && svgSrc && s >= 2.2) { vec = true; img.src = svgSrc; } // vector sheet for deep zoom
  };
  const zoomAt = (f, cx = W / 2, cy = H / 2) => { const ns = clamp(s * f, 1, MAX); x = cx - (cx - x) * ns / s; y = cy - (cy - y) * ns / s; s = ns; apply(); };
  const local = e => { const r = vp.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  vp.addEventListener('wheel', e => { if (document.activeElement !== vp && !vp.contains(document.activeElement)) return; e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.0018), ...local(e)); }, { passive: false });
  const pts = new Map(); let moved = 0, pinch0 = 0, s0 = 1;
  vp.addEventListener('pointerdown', e => {
    if (e.button && e.pointerType === 'mouse') return;
    pts.set(e.pointerId, local(e)); moved = 0;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); s0 = s; }
    if (!e.target.closest('.hs')) vp.focus({ preventScroll: true });
  });
  vp.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const p = local(e), q = pts.get(e.pointerId);
    if (pts.size === 1) {
      moved += Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]);
      if (moved > 4) { if (!vp.hasPointerCapture(e.pointerId)) vp.setPointerCapture(e.pointerId); vp.classList.add('drag'); x += p[0] - q[0]; y += p[1] - q[1]; apply(); }
    } else if (pts.size === 2) {
      pts.set(e.pointerId, p); moved = 99;
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      zoomAt((s0 * d / pinch0) / s, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); return;
    }
    pts.set(e.pointerId, p);
  });
  const up = e => { pts.delete(e.pointerId); vp.classList.remove('drag'); };
  vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up);
  vp.addEventListener('click', e => { if (moved > 4) { e.stopPropagation(); e.preventDefault(); } }, true);
  vp.addEventListener('dblclick', e => { if (!e.target.closest('.hs')) zoomAt(2, ...local(e)); });
  vp.addEventListener('keydown', e => {
    if (e.target !== vp) return;
    const k = e.key, st = 80;
    if (k === '+' || k === '=') zoomAt(1.4); else if (k === '-') zoomAt(1 / 1.4); else if (k === '0') { s = 1; apply(); }
    else if (k === 'ArrowLeft') { x += st; apply(); } else if (k === 'ArrowRight') { x -= st; apply(); }
    else if (k === 'ArrowUp') { y += st; apply(); } else if (k === 'ArrowDown') { y -= st; apply(); } else return;
    e.preventDefault();
  });
  bIn.onclick = () => zoomAt(1.5); bOut.onclick = () => zoomAt(1 / 1.5); bFit.onclick = () => { s = 1; apply(); };
  new ResizeObserver(() => { const ow = W; measure(); if (ow) { x *= W / ow; y *= W / ow; } apply(); }).observe(vp);
  measure(); apply();
  return {
    load(png, svg, alt) { svgSrc = svg; vec = false; img.src = png; img.alt = alt; s = 1; x = y = 0; apply(); if (overlay) { overlay.remove(); overlay = null; } },
    setOverlay(el) { overlay = el; layer.appendChild(el); },
    focusOn(mx, my, ns) { measure(); s = ns; x = W / 2 - mx * W * s; y = H / 2 - my * H * s; apply(); } // mx,my: 0..1 of sheet
  };
}

/* ---- P&ID with revision clouds (from c2_sheet) ---- */
const NS = 'http://www.w3.org/2000/svg';
const S = (tag, at = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (parent) parent.appendChild(e); return e; };
function cloudPath(x, y, w, h, r) {
  const pts = [], edge = (ax, ay, bx, by) => { const L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / (r * 1.6))); for (let i = 0; i < n; i++) pts.push([ax + (bx - ax) * i / n, ay + (by - ay) * i / n]); };
  edge(x, y, x + w, y); edge(x + w, y, x + w, y + h); edge(x + w, y + h, x, y + h); edge(x, y + h, x, y);
  pts.push(pts[0]);
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) { const [a, b] = pts[i], rr = Math.hypot(a - pts[i - 1][0], b - pts[i - 1][1]) * 0.56; d += `A${rr.toFixed(2)} ${rr.toFixed(2)} 0 0 1 ${a.toFixed(2)} ${b.toFixed(2)}`; }
  return d;
}
function pid(D) {
  const v = Viewer($('#pid-viewer'), 'Технологическая схема VD-00-001');
  v.load(A + 'drawings/pid.png', A + 'drawings/pid.svg', 'Технологическая схема, лист VD-00-001');
  fetch(A + 'drawings/pid_tags.json').then(r => r.json()).then(J => {
    const [SW, SH] = J.sheet_mm;
    const ov = S('svg', { viewBox: `0 0 ${SW} ${SH}`, 'aria-label': 'Теги оборудования и КИП' });
    const pick = $('#pid-find'), info = $('#pid-info');
    const re = t => new RegExp('(^|[^A-ZА-Я0-9-])' + t.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&') + '(?![0-9])');
    const items = J.tags.map((t, i) => {
      const [x1, y1, x2, y2] = t.bbox_mm, pad = 2.2;
      const x = x1 - pad, y = SH - y2 - pad, w = x2 - x1 + 2 * pad, h = y2 - y1 + 2 * pad;
      const g = S('g', { class: 'hs' + (t.kind === 'equipment' ? ' eq' : ''), tabindex: 0, role: 'button', 'aria-label': `${t.tag}: ${t.desc}` }, ov);
      S('rect', { class: 'hit', x, y, width: w, height: h }, g);
      S('path', { class: 'cloud', d: cloudPath(x, y, w, h, 1.5) }, g);
      const left = x + w > SW - 50, ex = left ? x : x + w, sx = left ? -1 : 1;
      S('polyline', { class: 'lead', points: `${ex},${y} ${ex + 5 * sx},${y - 6} ${ex + 27 * sx},${y - 6}` }, g);
      const lt = S('text', { class: 'ltxt', x: ex + 6 * sx, y: y - 7, 'text-anchor': left ? 'end' : 'start' }, g); lt.textContent = t.tag;
      S('circle', { class: 'dot', cx: x + w, cy: y, r: 0.8 }, g);
      pick.insertAdjacentHTML('beforeend', `<option value="${i}">${esc(t.tag)}</option>`);
      const it = { t, g, cx: (x + w / 2) / SW, cy: (y + h / 2) / SH };
      g.addEventListener('click', () => select(it));
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(it); } });
      g.addEventListener('mouseenter', () => show(it));
      g.addEventListener('focus', () => show(it));
      return it;
    });
    pick.addEventListener('change', () => { const it = items[+pick.value]; if (it) { select(it); v.focusOn(it.cx, it.cy, 2.6); } });
    let sel = null;
    function show(it) {
      const t = it.t, ils = D.interlocks.filter(r => re(t.tag).test(r[1] + ' ' + r[2]));
      info.innerHTML = `<p class="tag">${esc(t.tag)}</p><p class="kind">${t.kind === 'equipment' ? 'Оборудование' : 'Прибор КИП'}</p><p>${sub2(t.desc)}</p>${ils.length ? `<ul>${ils.map(r => `<li>${r[0]}: ${sub2(r[1])}, ${sub2(r[2])}</li>`).join('')}</ul>` : ''}`;
      nbsp(info);
    }
    function select(it) {
      if (sel) sel.g.classList.remove('sel');
      sel = it; it.g.classList.add('sel'); show(it); pick.value = items.indexOf(it);
    }
    ov.addEventListener('mouseleave', () => sel ? show(sel) : null);
    v.setOverlay(ov);
    const gh = items.find(i => i.t.tag === 'GH-1'); if (gh) select(gh);
  });
}

/* ---- "Это спроектировано": isometric draws itself, then becomes the model (from c2_sheet) ---- */
function cad(D) {
  const stage = $('#stage'), host = $('#stage-draw'), mv = $('#mv'), bar = $('#stagebar');
  const STATIC = document.documentElement.classList.contains('static');
  if (STATIC) mv.setAttribute('reveal', 'manual'); // screenshot mode: keep the rendered still as poster
  if (!STILL) mv.setAttribute('auto-rotate', '');
  bar.innerHTML = [`<button type="button" data-m="draw" aria-pressed="true">Чертёж VD-01-000, лист 3</button>`]
    .concat(D.cad.models.map((m, i) => `<button type="button" data-m="${i}" aria-pressed="false">${esc(m.name)}</button>`)).join('');
  let userChose = false, cur = 0;
  const setMode = (m, user) => {
    if (user) userChose = true;
    if (m !== 'draw' && +m !== cur) { const M = D.cad.models[+m]; cur = +m; mv.poster = A + M.still.replace(".png", "_dark.png"); mv.src = A + M.glb; mv.alt = '3D-модель: ' + M.name; }
    stage.dataset.mode = m === 'draw' ? 'draw' : 'model';
    bar.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === String(m)));
  };
  bar.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.m, true); });
  // model-viewer keeps a render loop while attached: detach it when the CAD section is far away
  if (!STATIC) new IntersectionObserver(es => {
    if (es[0].isIntersecting) { if (!mv.isConnected) stage.appendChild(mv); } else if (mv.isConnected) mv.remove();
  }, { rootMargin: '600px 0px' }).observe($('#cad'));
  fetch(A + 'drawings/ga3.svg').then(r => r.text()).then(txt => {
    const svg = new DOMParser().parseFromString(txt, 'image/svg+xml').documentElement;
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.setAttribute('viewBox', '92 108 456 608'); // crop the isometric view out of sheet 3
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    host.appendChild(document.importNode(svg, true));
    if (STILL) return;
    const paths = host.querySelectorAll('path'), n = paths.length;
    paths.forEach((p, i) => { p.setAttribute('pathLength', '1'); p.style.animationDelay = (i / n * 1.8).toFixed(3) + 's'; });
    host.classList.add('wait');
    // draw when the jury scrolls to it, then hand over to the model
    new IntersectionObserver((es, io) => {
      if (!es[0].isIntersecting) return;
      io.disconnect(); host.classList.replace('wait', 'draw');
      setTimeout(() => { if (!userChose) setMode('0'); }, 5200);
    }, { threshold: .45 }).observe(stage);
  });
  const STAT = document.documentElement.classList.contains('static');
  $('#videos').innerHTML = D.cad.videos.map(v => `<figure><video src="${A + v.mp4.replace('.mp4', '_dark.mp4')}" poster="${A + v.poster.replace('_poster.png', '_dark_poster.png')}" muted loop playsinline preload="${STILL ? 'none' : 'metadata'}" aria-label="${esc(v.name)}"></video><figcaption><button type="button" class="vbtn" aria-pressed="false">${STILL ? 'Играть' : 'Пауза'}</button>${esc(v.name)}, ${v.seconds} с</figcaption></figure>`).join('');
  document.querySelectorAll('#videos figure').forEach(f => {
    const vd = f.querySelector('video'), b = f.querySelector('.vbtn');
    let user = STILL; // reduced motion and static: never start by itself
    const label = () => { b.textContent = vd.paused ? 'Играть' : 'Пауза'; };
    vd.addEventListener('play', label); vd.addEventListener('pause', label);
    b.onclick = () => { if (vd.paused) { user = false; vd.play().catch(() => {}); } else { user = true; vd.pause(); } };
    new IntersectionObserver(es => { if (es[0].isIntersecting && !user) vd.play().catch(() => {}); else vd.pause(); }, { threshold: .5 }).observe(vd);
  });
}

/* ---- drawings: 7 sheets on the light table (from c2_sheet) ---- */
function drawings(D) {
  const short = { 'VD-00-001': 'P&ID', 'VD-00-002': 'Генплан', 'VD-01-000': 'Блок эжектора', 'VD-01-100': 'Эжектор EJ-1', 'VD-01-300': 'Сепаратор V-1' };
  const sheets = [];
  D.drawings.forEach(d => {
    const pngs = d.files.filter(f => f.endsWith('.png')), pdf = d.files.find(f => f.endsWith('.pdf'));
    pngs.forEach((f, i) => sheets.push({ d, png: A + f, svg: A + f.replace('.png', '.svg'), pdf: A + pdf, n: i + 1, of: pngs.length }));
  });
  const v = Viewer($('#dw-viewer'), 'Просмотр чертежа');
  const tabs = $('#dw-tabs');
  const pick = i => {
    const s = sheets[i];
    tabs.querySelectorAll('button').forEach((b, j) => { b.setAttribute('aria-selected', i === j); b.tabIndex = i === j ? 0 : -1; });
    v.load(s.png, s.svg, `${s.d.no} ${s.d.title}, лист ${s.n}`);
    $('#dw-tb').innerHTML = `<div class="tb__name"><span>Наименование</span>${esc(s.d.title)}</div><div><span>Обозначение</span>${s.d.no}</div><div><span>Лист</span>${s.n} из ${s.of}</div><div class="tb__pdf"><a href="${s.pdf}" target="_blank" rel="noopener">Открыть PDF</a></div>`;
  };
  sheets.forEach((s, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab');
    b.innerHTML = `<small>${s.d.no}${s.of > 1 ? `, лист ${s.n}` : ''}</small>${short[s.d.no] || s.d.title}`;
    b.onclick = () => pick(i);
    b.onkeydown = e => { const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (k) { const j = (i + k + sheets.length) % sheets.length; pick(j); tabs.children[j].focus(); } };
    tabs.appendChild(b);
  });
  pick(2);
}

function calc(D) {
  const C = D.calc, S = C.separator;
  $('#calcSrc').textContent = `Независимая проверка расчёта, ред. 2. Рабочая жидкость: ${C.motive_liquid}`;
  const kv = (el, rows) => $(el).innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  kv('#kvEj', [['Сопло', `${DIA} ${nf(C.nozzle_d_mm)} мм`], ['Горловина', `${DIA} ${nf(C.throat_d_mm)} мм`], ['Отношение площадей m', C.area_ratio_m], ['Длина горловины', `${C.throat_length_mm} мм`],
    ['Зазор сопло–горловина', `${C.gap_mm} мм`], ['Конфузор / диффузор', `${C.inlet_cone_deg}° / ${C.diffuser_deg}°`], ['Скорость в сопле', `${nf(C.nozzle_velocity_ms)} м/с`],
    ['Рабочий поток', `${C.motive_flow_m3h} м³/ч при ${nf(C.nozzle_pressure_bar_g)} бар изб.`], ['Всас газа, расчётный', `${C.gas_suction_m3h} м³/ч`], ['Номинал в уставках', `${D.setpoints.ejector_capacity_m3h} м³/ч, с запасом`], ['Нагнетание', `${nf(C.discharge_bar_a)} бар абс.`],
    ['Коэффициент эжекции', nf(C.entrainment_ratio)], ['КПД нужный / расчётный', `${nf(C.efficiency_required_pct)} / ${C.efficiency_design_pct} %`]]);
  kv('#kvSep', [['Внутренний диаметр', `${S.id_mm} мм`], ['Стенка', `${S.wall_mm} мм`], ['Длина T-T', `${nf(S.tt_mm)} мм`], ['Объём', `${nf(S.volume_m3)} м³`],
    ['Расчётные условия', `${nf(S.design_mpa)} МПа, ${S.design_c} °C`], ['Испытание', `${nf(S.test_mpa)} МПа`], ['Сталь', S.steel], ['Масса', `${nf(S.mass_kg)} кг`],
    ...Object.entries(S.levels_mm).map(([a, b]) => [`Уровень ${a}`, `${nf(b)} мм`])]);
  kv('#kvPump', [['Подача', `${C.pump.flow_m3h} м³/ч`], ['Напор', `${C.pump.head_m} м`], ['Мощность на валу', `${nf(C.pump.shaft_kw)} кВт`], ['Двигатель', `${C.pump.motor_kw} кВт, Ex`], ['Охладитель контура', `${nf(C.cooler_kw)} кВт`]]);

  // schematic, not to scale: lengths 0.5 px/mm, diameters exaggerated
  const cy = 140, th = C.throat_d_mm / 2, nz = C.nozzle_d_mm / 2, x0 = 250, x1 = x0 + C.throat_length_mm * .5, x2 = x1 + 230, dh = th + 230 * Math.tan(C.diffuser_deg / 2 * Math.PI / 180);
  const nzx = x0 - C.gap_mm * .5;
  $('#ejsvg').innerHTML = `
  <rect class="gas" x="150" y="22" width="44" height="58"/>
  <path class="body" d="M100 ${cy - 62}H150V22H194V${cy - 62}H205L${x0} ${cy - th}H${x1}L${x2} ${cy - dh}H980V${cy + dh}H${x2}L${x1} ${cy + th}H${x0}L205 ${cy + 62}H100Z"/>
  <path class="gas" d="M104 ${cy - 58}H201L${x0} ${cy - th + 3}V${cy + th - 3}L201 ${cy + 58}H104Z" opacity=".55"/>
  <path class="body" d="M20 ${cy - 16}H130L${nzx} ${cy - nz}V${cy + nz}L130 ${cy + 16}H20Z"/>
  <path class="jet" d="M${nzx} ${cy - nz + 2}L${x1} ${cy - th + 3}L${x2} ${cy - dh + 4}H975V${cy + dh - 4}H${x2}L${x1} ${cy + th - 3}L${nzx} ${cy + nz - 2}Z" opacity=".75"/>
  <path class="dim" d="M${x0} ${cy - th - 8}V58M${x1} ${cy - th - 8}V58M${x0} 64H${x1}"/>
  <text x="${(x0 + x1) / 2}" y="54" text-anchor="middle">горловина <tspan class="dia">Ø</tspan> ${nf(C.throat_d_mm)}, длина ${C.throat_length_mm} мм</text>
  <path class="dim" d="M${nzx} ${cy + nz + 4}V${cy + 92}M${x0} ${cy + th + 4}V${cy + 92}"/>
  <text x="${nzx - 6}" y="${cy + 108}" text-anchor="end">сопло <tspan class="dia">Ø</tspan> ${nf(C.nozzle_d_mm)}, зазор ${C.gap_mm} мм</text>
  <text x="${x1 + 115}" y="${cy - dh - 12}" text-anchor="middle">диффузор ${C.diffuser_deg}°</text>
  <text x="${x0 + 12}" y="104">конфузор ${C.inlet_cone_deg}°</text>
  <text x="200" y="16" class="t2">газ до ${C.gas_suction_m3h} м³/ч</text>
  <text x="20" y="${cy + 84}" class="t2">${C.motive_liquid} ${C.motive_flow_m3h} м³/ч, ${nf(C.nozzle_pressure_bar_g)} бар</text>
  <text x="980" y="${cy + dh + 22}" text-anchor="end" class="t2">к сепаратору V-1, ${nf(C.discharge_bar_a)} бар абс.</text>
  <text x="980" y="250" text-anchor="end" class="t2">схема, не в масштабе</text>`;
}

function econ(D) {
  const B = D.bom, E = D.economics, k = n => Math.round(n / 1000);
  $('#capexLine').textContent = `CAPEX $${k(B.capex_usd[0])}–${k(B.capex_usd[1])} тыс., ${B.capex_kzt_mln[0]}–${B.capex_kzt_mln[1]} млн ₸, ${B.vat_note}. 1 $ = ${nf(B.rate.USD_KZT)} ₸, ${B.rate.date}`;
  const mx = 190000;
  $('#capexBars').innerHTML = B.groups_usd.map(g => `<div class="bar"><span>${esc(g.name)}</span><span class="bar__t"><i class="min" style="left:0;width:${g.min / mx * 100}%"></i><i style="left:${g.min / mx * 100}%;width:${(g.max - g.min) / mx * 100}%"></i></span><span class="bar__v">${k(g.min)}–${k(g.max)}</span></div>`).join('');
  // key prices converted to $ at the National Bank rate in data.json
  const R = B.rate, toUsd = { EUR: R.EUR_KZT / R.USD_KZT, RUB: R.RUB_KZT / R.USD_KZT, USD: 1 };
  const usd = str => { const m = str.match(/^(.+?)\s+([A-Z]{3})$/); const f = toUsd[m[2]]; return m[1].split('-').map(x => '$' + nf(Math.round(+x.replace(/\s/g, '') * f / 10) * 10, 0)).join('–'); };
  $('#bomNote').innerHTML = `<p>Яркая часть: минимум. Смета: ${B.items_total} позиций, ${B.items_with_found_price} с ценами поставщиков</p>
    <table class="prices"><thead><tr><th>Позиция</th><th>Цена поставщика</th><th>≈ в долларах</th></tr></thead><tbody>${B.key_prices.map(p => `<tr><td>${sub2(p[0])}</td><td class="num">${esc(p[1].replace('-', '–'))}</td><td class="num">${usd(p[1])}</td></tr>`).join('')}</tbody></table>`;

  const v = D.variants.find(x => x.id === 4), T = D.project.co2e_reduction_t_per_year, sl = $('#co2'), out = $('#co2Out');
  // true minus, and no "−0"
  const sgn = n => { n = Math.round(n); return n < 0 ? '−' + nf(-n, 0) : nf(n || 0, 0); };
  const upd = () => {
    const c = +sl.value; out.textContent = '$' + c;
    // methane is priced through its CO2 equivalent: 1 t CH4 = GWP100 27.2 t CO2-eq
    $('#ch4eq').textContent = c ? `≈ $${nf(Math.round(c * 27.2), 0)} за т метана` : 'выбросы не оплачиваются';
    const carbon = c * T / 1000; // тыс. $
    const best = v.revenue_usd_k[1] + carbon - v.opex_usd_k[0], worst = v.revenue_usd_k[0] + carbon - v.opex_usd_k[1];
    const pb = $('#pb');
    if (best <= 0) pb.textContent = 'не окупается';
    else if (worst <= 0) { const a = v.capex_usd_k[0] / best; pb.textContent = a > 30 ? 'не окупается' : `от ${nf(a, 1)} года, в худшем случае не окупается`; }
    else { const a = v.capex_usd_k[0] / best, b = v.capex_usd_k[1] / worst; pb.textContent = a > 30 ? 'больше 30 лет' : `${nf(a, 1)}–${b > 30 ? '30+' : nf(b, 1)} года`; }
    $('#pbsub').textContent = `Эффект ${sgn(worst)}…${sgn(best)} тыс. $/год: топливо ${v.revenue_usd_k.join('–')} + $${c} × ${nf(T)} т CO₂-экв (175,2 т метана × 27,2) − OPEX ${v.opex_usd_k.join('–')}`;
    document.querySelectorAll('.ticks button').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === sl.value));
  };
  sl.addEventListener('input', upd);
  document.querySelectorAll('.ticks button').forEach(b => b.onclick = () => { sl.value = b.dataset.c; upd(); });
  upd();
  // one payback figure on the page: the calculator above; the note only says why it needs a carbon price
  $('#honest').textContent = `Без платы за выбросы не окупается: ${sgn(v.revenue_usd_k[0] - v.opex_usd_k[1])}…${sgn(v.revenue_usd_k[1] - v.opex_usd_k[0])} тыс. $/год. Метан ${E.methane_in_kz_ets ? 'в' : 'вне'} KZ ETS, там ~$${E.carbon_price_usd_t.kz_ets_now}/т`;
  const vru = D.variants.find(x => x.id === 1), r2 = a => `${a[0]}–${a[1]}`;
  const opexV = v.opex_usd_k, opexR = vru.opex_usd_k;
  // the honest comparison with VRU, as anchors
  $('#vsvru').innerHTML = [`CAPEX как у VRU: $${r2(v.capex_usd_k)} и $${r2(vru.capex_usd_k)} тыс.`, `OPEX ниже: $${r2(opexV)} тыс./год, у VRU $${r2(opexR)} тыс.`,
    `Выручка от газа меньше: $${r2(v.revenue_usd_k)} тыс., у VRU $${r2(vru.revenue_usd_k)} тыс.`, `Без компрессора, сделано в Казахстане`, `Улавливание у обоих ${v.reduction_pct} %`].map(x => `<li>${x}</li>`).join('');
  // closing section: four numbers, payback at the $20/t shadow price from the same calculator
  const c20 = E.carbon_price_usd_t.shadow_default, eff = c20 * T / 1000;
  const pb20 = `${nf(v.capex_usd_k[0] / (v.revenue_usd_k[1] + eff - v.opex_usd_k[0]), 1)}–${nf(v.capex_usd_k[1] / (v.revenue_usd_k[0] + eff - v.opex_usd_k[1]), 1)}`;
  $('#sum').innerHTML = [[`${v.reduction_pct} %`, 'улавливание метана'], [`$${r2(v.capex_usd_k)} тыс.`, 'CAPEX без НДС'], [`${pb20} года`, `окупаемость при $${c20} за т CO<sub>2</sub>-экв`], [`${r2(D.delivery.months)} мес.`, 'до пуска']]
    .map(([n, t]) => `<div><dt>${t}</dt><dd>${n}</dd></div>`).join('');
  $('#why').innerHTML = [`Без компрессора и вращающихся газовых машин`, `OPEX $${r2(opexV)} тыс./год, у VRU $${r2(opexR)} тыс.`,
    `Эжектор, рама, сепаратор из Казахстана`, `CAPEX как у VRU, выручка от газа меньше`].map(x => `<li>${x}</li>`).join('');

  const rng = a => Array.isArray(a) ? (a[0] === a[1] ? nf(a[0]) : `${a[0]}–${a[1]}`) : a;
  $('#vars tbody').innerHTML = D.variants.map(x => `<tr class="${x.id === 4 ? 'ours' : ''}"><td class="vname">${x.id === 4 ? 'Газгольдер + эжектор' : esc(x.name)}</td><td class="num" data-l="CAPEX, тыс. $">${rng(x.capex_usd_k)}</td>
    <td class="rng"><div class="rbar"><i style="left:${x.capex_usd_k[0] / 9}%;width:${(x.capex_usd_k[1] - x.capex_usd_k[0]) / 9}%"></i></div></td>
    <td class="num" data-l="OPEX, тыс. $/год">${rng(x.opex_usd_k)}</td><td data-l="Доход, тыс. $/год">${x.revenue_usd_k[1] ? rng(x.revenue_usd_k) + (x.revenue_note ? ', топливо печи' : '') : 'нет'}</td><td class="num" data-l="Снижение выбросов">${rng(x.reduction_pct)} %</td></tr>`).join('');
}

function delivery(D) {
  const L = D.delivery, M = 16;
  $('#delH').textContent = `${L.months[0]}–${L.months[1]} месяцев до пуска`;
  let s = 0;
  const rows = L.phases.map(([n, a, b]) => { const r = `<div class="g"><span>${esc(n)}, ${a}–${b} мес.</span><div class="g__t"><i style="left:${s / M * 100}%;width:${a / M * 100}%"></i><i class="x" style="left:${(s + a) / M * 100}%;width:${(b - a) / M * 100}%"></i></div></div>`; s += a; return r; });
  rows.push(`<div class="g"><span><b>Всего</b></span><div class="g__t"><i style="left:0;width:${L.months[0] / M * 100}%"></i><i class="x" style="left:${L.months[0] / M * 100}%;width:${(L.months[1] - L.months[0]) / M * 100}%"></i></div></div>`);
  rows.push(`<div class="g__scale"><span>месяцы; сплошная: быстро, штриховка: запас</span><div>${Array.from({ length: M / 2 + 1 }, (_, i) => `<span style="left:${i * 2 / M * 100}%">${i * 2}</span>`).join('')}</div></div>`);
  $('#gantt').innerHTML = rows.join('');
  $('#kzMade').innerHTML = L.made_in_kz.map(x => `<li>${esc(x)}</li>`).join('');
  $('#kzBought').innerHTML = L.bought.map(x => `<li>${esc(x)}</li>`).join('');
}
})();
