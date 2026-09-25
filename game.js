/* Times Tricks — multiplication street runner. Plain JS, no dependencies. */
(function () {
  'use strict';

  // ---------- storage ----------
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('tt_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('tt_' + k, JSON.stringify(v)); } catch (e) {} }
  };

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var randInt = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
  var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  var shuffle = function (arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

  // ---------- config ----------
  var ROUND_SECONDS = 75;
  var BASE_SPEED = 170;          // logical px / second (scene is 400 logical px tall)
  var GROUND_Y = 318;

  // ---------- riders (add a new ride by adding an entry here) ----------
  // Each rider: id, name, accent colours, stance (body joint targets in local units,
  // origin = ground contact, ~100 units tall), tricks list, and drawVehicle(ctx, pose, rider).
  var RIDERS = [
    {
      id: 'skate', name: 'Skateboard',
      hoodie: '#19c3c0', hoodieDark: '#0f8f8c', deck: '#ff7a3d',
      stance: { feet: [[-15, -13], [15, -13]], hip: [0, -45], shoulder: [3, -71], hands: [[-24, -56], [27, -60]], elbow: [1, -1] },
      tricks: [
        { id: 'ollie', name: 'OLLIE' }, { id: 'kickflip', name: 'KICKFLIP' },
        { id: 'shuvit', name: 'SHOVE-IT' }, { id: 'heelflip', name: 'HEELFLIP' }
      ],
      drawVehicle: drawSkateboard
    },
    {
      id: 'scooter', name: 'Scooter',
      hoodie: '#ff4f8b', hoodieDark: '#c22e63', deck: '#19c3c0',
      stance: { feet: [[-15, -14], [2, -14]], hip: [-6, -47], shoulder: [5, -71], hands: [[16, -77], [20, -77]], elbow: [-1, 1] },
      tricks: [
        { id: 'hop', name: 'BUNNY HOP' }, { id: 'tailwhip', name: 'TAILWHIP' },
        { id: 'barspin', name: 'BAR SPIN' }, { id: 'threesixty', name: '360' }
      ],
      drawVehicle: drawScooter
    }
  ];
  function riderById(id) { for (var i = 0; i < RIDERS.length; i++) if (RIDERS[i].id === id) return RIDERS[i]; return RIDERS[0]; }

  // ---------- levels ----------
  function factKey(kind, a, b) { return kind === 'm' ? 'm:' + Math.min(a, b) + 'x' + Math.max(a, b) : 'd:' + a + 'x' + b; }
  function makeMult(a, b, kind) {
    if (kind === 'm' && Math.random() < 0.5) { var t = a; a = b; b = t; }
    return { kind: kind, a: a, b: b, answer: a * b, prompt: a + ' × ' + b + ' = ?', revealHTML: a + ' × ' + b + ' = <span class="ans">' + (a * b) + '</span>', reveal: a + ' × ' + b + ' = ' + (a * b), key: factKey(kind, a, b) };
  }
  function makeMissing(a, b) { // a is hidden
    var c = a * b, p;
    if (Math.random() < 0.5) p = { prompt: '? × ' + b + ' = ' + c, revealHTML: '<span class="ans">' + a + '</span> × ' + b + ' = ' + c, reveal: a + ' × ' + b + ' = ' + c };
    else p = { prompt: b + ' × ? = ' + c, revealHTML: b + ' × <span class="ans">' + a + '</span> = ' + c, reveal: b + ' × ' + a + ' = ' + c };
    p.kind = 'm'; p.a = a; p.b = b; p.answer = a; p.missing = true; p.key = factKey('m', a, b);
    return p;
  }
  var inRange = function (v, a, b) { return v >= a && v <= b; };
  var LEVELS = [
    { id: 1, name: 'Tables 2–5', desc: '2× to 5× tables', time: 7,
      gen: function () { return makeMult(randInt(2, 5), randInt(2, 12), 'm'); },
      fits: function (f) { return f.kind === 'm' && Math.max(f.a, f.b) <= 12 && (inRange(f.a, 2, 5) || inRange(f.b, 2, 5)); },
      build: function (f) { return makeMult(f.a, f.b, 'm'); } },
    { id: 2, name: 'Tables 6–9', desc: '6× to 9× tables', time: 7.5,
      gen: function () { return makeMult(randInt(6, 9), randInt(2, 12), 'm'); },
      fits: function (f) { return f.kind === 'm' && Math.max(f.a, f.b) <= 12 && (inRange(f.a, 6, 9) || inRange(f.b, 6, 9)); },
      build: function (f) { return makeMult(f.a, f.b, 'm'); } },
    { id: 3, name: 'Mixed to 12×12', desc: 'Anything up to 12 × 12', time: 7.5,
      gen: function () { return makeMult(randInt(2, 12), randInt(2, 12), 'm'); },
      fits: function (f) { return f.kind === 'm' && Math.max(f.a, f.b) <= 12; },
      build: function (f) { return makeMult(f.a, f.b, 'm'); } },
    { id: 4, name: 'Missing factor', desc: '? × 7 = 56', time: 8.5,
      gen: function () { return makeMissing(randInt(2, 12), randInt(2, 12)); },
      fits: function (f) { return f.kind === 'm' && Math.max(f.a, f.b) <= 12; },
      build: function (f) { return Math.random() < 0.5 ? makeMissing(f.a, f.b) : makeMissing(f.b, f.a); } },
    { id: 5, name: '2-digit × 1-digit', desc: 'Like 23 × 4', time: 13,
      gen: function () { return makeMult(randInt(12, 99), randInt(2, 9), 'd'); },
      fits: function (f) { return f.kind === 'd'; },
      build: function (f) { return makeMult(f.a, f.b, 'd'); } }
  ];

  // ---------- missed-facts memory ----------
  function getMissed() { return store.get('missed', {}); }
  function recordMiss(p) {
    var m = getMissed(); var e = m[p.key] || { kind: p.kind, a: p.kind === 'm' ? Math.min(p.a, p.b) : p.a, b: p.kind === 'm' ? Math.max(p.a, p.b) : p.b, n: 0 };
    e.n = Math.min(e.n + 2, 6); m[p.key] = e; store.set('missed', m);
  }
  function recordHit(p) {
    var m = getMissed(); var e = m[p.key]; if (!e) return;
    e.n -= 1; if (e.n <= 0) delete m[p.key]; else m[p.key] = e; store.set('missed', m);
  }
  function nextProblem(level, lastKey) {
    var m = getMissed(), pool = [], total = 0;
    Object.keys(m).forEach(function (k) { var f = m[k]; if (level.fits(f) && k !== lastKey) { pool.push(f); total += f.n; } });
    var p, tries = 0;
    if (pool.length && Math.random() < 0.35) {
      var r = Math.random() * total;
      for (var i = 0; i < pool.length; i++) { r -= pool[i].n; if (r <= 0) { p = level.build(pool[i]); break; } }
      if (!p) p = level.build(pool[pool.length - 1]);
      p.review = true;
    }
    while (!p || (p.key === lastKey && tries < 6)) { p = level.gen(); tries++; }
    return p;
  }
  function distractors(p) {
    var ans = p.answer, near = [], far = [];
    if (p.missing) { near = [ans - 1, ans + 1]; far = [ans + 2, ans - 2]; }
    else if (p.kind === 'd') { near = [ans + p.b, ans - p.b, ans + 10, ans - 10]; far = [ans + 1, ans - 1, ans + 20]; }
    else { near = [(p.a + 1) * p.b, (p.a - 1) * p.b, p.a * (p.b + 1), p.a * (p.b - 1)]; far = [ans + 1, ans - 1, ans + 2]; }
    var ok = function (v, list) { return v > 0 && v !== ans && list.indexOf(v) < 0; };
    var out = [];
    shuffle(near).forEach(function (v) { if (out.length < 2 && ok(v, out)) out.push(v); });
    far.forEach(function (v) { if (out.length < 2 && ok(v, out)) out.push(v); });
    return shuffle([ans].concat(out));
  }

  // ---------- state ----------
  var settings = {
    rider: store.get('rider', 'skate'),
    level: clamp(store.get('level', 1), 1, LEVELS.length),
    mode: store.get('mode', 'pad') === 'choices' ? 'choices' : 'pad',
    muted: !!store.get('muted', false)
  };
  var G = {
    screen: 'menu', phase: 'idle', phaseT: 0, paused: false,
    score: 0, streak: 0, topStreak: 0, correct: 0, wrong: 0, timeLeft: ROUND_SECONDS,
    prob: null, lastKey: null, gateDist: 0, gateTotal: 1, gateState: 'none', gateX: 0, gateFade: 1,
    worldX: 0, speed: BASE_SPEED, input: '', choices: [], roundMissed: [],
    trick: null, trickT: 0, wipeT: -1, particles: [], pops: [], t: 0
  };
  window.__tt = { G: G, settings: settings, LEVELS: LEVELS, RIDERS: RIDERS };

  function level() { return LEVELS[settings.level - 1]; }
  function rider() { return riderById(settings.rider); }
  function multiplier() { var s = G.streak; return s >= 12 ? 5 : s >= 9 ? 4 : s >= 6 ? 3 : s >= 3 ? 2 : 1; }
  function speedFactor() { return 1 + Math.min(G.streak, 15) * 0.03; }

  // ---------- audio (tiny WebAudio beeps, no files) ----------
  var actx = null;
  function audio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (actx && actx.state === 'suspended') actx.resume(); return actx; }
  function tone(freq, dur, type, vol, delay) {
    if (settings.muted) return; var a = audio(); if (!a) return;
    var t0 = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  var sfx = {
    good: function () { tone(660, 0.09, 'square', 0.06); tone(990, 0.14, 'square', 0.06, 0.08); },
    bad: function () { tone(160, 0.3, 'sawtooth', 0.07); tone(110, 0.35, 'sawtooth', 0.06, 0.1); },
    tap: function () { tone(420, 0.03, 'triangle', 0.03); },
    go: function () { tone(520, 0.1, 'square', 0.05); tone(780, 0.18, 'square', 0.05, 0.12); }
  };

  // ---------- canvas setup ----------
  var cv = $('#cv'), ctx = cv.getContext('2d');
  var VW = 400, VH = 400, dpr = 1, scale = 1, TOP = 0;
  function resize() {
    var r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
    var k = Math.min(r.height / VH, r.width / 380);   // keep at least ~380 logical px of street visible
    scale = k * dpr; VW = r.width / k; TOP = -(r.height / k - VH);
  }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(cv);

  // ---------- scenery (procedural, generated once) ----------
  var TILE = 1400;
  function genSkyline(n, minH, maxH, minW, maxW) {
    var arr = [], x = 0;
    while (x < TILE) {
      var w = randInt(minW, maxW), h = randInt(minH, maxH), win = [];
      for (var wy = 8; wy < h - 6; wy += 11) for (var wx = 5; wx < w - 5; wx += 9) if (Math.random() < n) win.push([wx, wy]);
      arr.push({ x: x, w: w, h: h, win: win, tower: Math.random() < 0.15 }); x += w + randInt(0, 10);
    }
    return arr;
  }
  var farCity = genSkyline(0.12, 60, 150, 30, 70);
  var nearCity = genSkyline(0.2, 40, 110, 40, 90);
  var props = []; (function () { var x = 60; while (x < TILE) { props.push({ x: x, type: pick(['palm', 'palm', 'qp', 'rail', 'fence', 'palm2']), s: 0.8 + Math.random() * 0.4 }); x += randInt(140, 260); } })();

  function drawSky(t) {
    var g = ctx.createLinearGradient(0, Math.min(0, TOP * 0.5), 0, GROUND_Y);
    g.addColorStop(0, '#24123f'); g.addColorStop(0.35, '#5b2166'); g.addColorStop(0.62, '#c43d5c'); g.addColorStop(0.85, '#ff8a4c'); g.addColorStop(1, '#ffc46b');
    ctx.fillStyle = g; ctx.fillRect(0, TOP, VW, GROUND_Y - TOP);
    // sun with retro stripes
    var sx = VW * 0.68, sy = GROUND_Y - 78, sr = 58;
    var glow = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 2.4);
    glow.addColorStop(0, 'rgba(255,210,120,0.55)'); glow.addColorStop(1, 'rgba(255,120,80,0)');
    ctx.fillStyle = glow; ctx.fillRect(sx - sr * 2.5, sy - sr * 2.5, sr * 5, sr * 5);
    ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.clip();
    var sg = ctx.createLinearGradient(0, sy - sr, 0, sy + sr); sg.addColorStop(0, '#fff1a8'); sg.addColorStop(0.6, '#ffae5a'); sg.addColorStop(1, '#ff5f6d');
    ctx.fillStyle = sg; ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    ctx.fillStyle = '#c43d5c';
    for (var i = 0; i < 6; i++) { var yy = sy + 8 + i * 9; ctx.fillRect(sx - sr, yy, sr * 2, 1.5 + i * 0.9); }
    ctx.restore();
    // a few stars up top
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (var s = 0; s < 14; s++) { var x = (s * 97.3) % VW, y = (s * 37.7) % 90 + 8; if ((Math.sin(t * 2 + s) + 1) > 0.6) ctx.fillRect(x, y, 1.6, 1.6); }
  }
  function drawCity(arr, par, base, col, winCol, parOffset) {
    var off = ((G.worldX * par + parOffset) % TILE + TILE) % TILE;
    for (var rep = 0; rep < Math.ceil(VW / TILE) + 1; rep++) {
      var ox = rep * TILE - off;
      for (var i = 0; i < arr.length; i++) {
        var b = arr[i], x = ox + b.x; if (x > VW || x + b.w < 0) continue;
        ctx.fillStyle = col; ctx.fillRect(x, base - b.h, b.w, b.h);
        if (b.tower) { ctx.fillRect(x + b.w * 0.3, base - b.h - 14, 12, 14); ctx.fillRect(x + b.w * 0.3 + 5, base - b.h - 28, 2, 14); }
        ctx.fillStyle = winCol;
        for (var j = 0; j < b.win.length; j++) ctx.fillRect(x + b.win[j][0], base - b.h + b.win[j][1], 4, 5);
      }
    }
  }
  function drawProps() {
    var par = 0.6, off = ((G.worldX * par) % TILE + TILE) % TILE, base = GROUND_Y - 4;
    ctx.save();
    for (var rep = 0; rep < Math.ceil(VW / TILE) + 1; rep++) {
      var ox = rep * TILE - off;
      for (var i = 0; i < props.length; i++) {
        var p = props[i], x = ox + p.x; if (x < -120 || x > VW + 120) continue;
        ctx.fillStyle = '#1c0f2e'; ctx.strokeStyle = '#1c0f2e';
        if (p.type === 'palm' || p.type === 'palm2') {
          var h = 120 * p.s, lean = p.type === 'palm' ? 14 : -10;
          ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + lean * 0.2, base - h * 0.5, x + lean, base - h); ctx.stroke();
          var tx = x + lean, ty = base - h;
          for (var f = 0; f < 7; f++) {
            var a = -Math.PI / 2 + (f - 3) * 0.5, len = 34 * p.s;
            ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(tx, ty);
            ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.7, ty + Math.sin(a) * len * 0.7 - 8, tx + Math.cos(a) * len, ty + Math.sin(a) * len + 12);
            ctx.stroke();
          }
        } else if (p.type === 'qp') {
          ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + 70, base); ctx.lineTo(x + 70, base - 46); ctx.quadraticCurveTo(x + 66, base - 2, x, base); ctx.fill();
          ctx.fillRect(x + 66, base - 50, 12, 4);
        } else if (p.type === 'rail') {
          ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, base - 18); ctx.lineTo(x + 80, base - 18); ctx.moveTo(x + 8, base); ctx.lineTo(x + 8, base - 18); ctx.moveTo(x + 72, base); ctx.lineTo(x + 72, base - 18); ctx.stroke();
        } else if (p.type === 'fence') {
          ctx.lineWidth = 1; ctx.globalAlpha = 0.8;
          for (var k = 0; k <= 100; k += 8) { ctx.beginPath(); ctx.moveTo(x + k, base); ctx.lineTo(x + k + 20, base - 40); ctx.moveTo(x + k + 20, base); ctx.lineTo(x + k, base - 40); ctx.stroke(); }
          ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, base - 40); ctx.lineTo(x + 120, base - 40); ctx.stroke(); ctx.globalAlpha = 1;
        }
      }
    }
    ctx.restore();
  }
  function drawGround() {
    // curb top highlight + ride surface + road
    ctx.fillStyle = '#3a2a52'; ctx.fillRect(0, GROUND_Y - 4, VW, 4);
    ctx.fillStyle = '#ff9a6b'; ctx.fillRect(0, GROUND_Y - 4, VW, 1.5);
    var g = ctx.createLinearGradient(0, GROUND_Y, 0, VH); g.addColorStop(0, '#4a3560'); g.addColorStop(1, '#221633');
    ctx.fillStyle = g; ctx.fillRect(0, GROUND_Y, VW, VH - GROUND_Y);
    // expansion joints on the concrete
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5;
    var off = G.worldX % 90;
    for (var x = -off; x < VW + 90; x += 90) { ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x - 26, GROUND_Y + 30); ctx.stroke(); }
    // road dashes
    ctx.fillStyle = 'rgba(255,201,77,0.55)';
    var off2 = G.worldX % 70;
    for (var x2 = -off2; x2 < VW + 70; x2 += 70) ctx.fillRect(x2, GROUND_Y + 52, 34, 4);
    // warm sun reflection
    ctx.fillStyle = 'rgba(255,170,100,0.10)'; ctx.fillRect(0, GROUND_Y, VW, 12);
  }
  function drawLamps() {
    var gap = 300, off = ((G.worldX * 0.85) % gap + gap) % gap;
    for (var x = -off + 40; x < VW + gap; x += gap) {
      ctx.strokeStyle = '#140a22'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, GROUND_Y - 4); ctx.lineTo(x, GROUND_Y - 150); ctx.quadraticCurveTo(x, GROUND_Y - 162, x + 16, GROUND_Y - 162); ctx.stroke();
      var gl = ctx.createRadialGradient(x + 18, GROUND_Y - 156, 1, x + 18, GROUND_Y - 156, 30);
      gl.addColorStop(0, 'rgba(255,230,160,0.9)'); gl.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = gl; ctx.fillRect(x - 14, GROUND_Y - 188, 64, 64);
    }
  }

  // ---------- gate ----------
  function drawGate(x) {
    var st = G.gateState, col = st === 'good' ? '#3ee08f' : st === 'bad' ? '#ff4d5e' : '#19c3c0', col2 = st === 'good' ? '#3ee08f' : st === 'bad' ? '#ff4d5e' : '#ff4f8b';
    var top = GROUND_Y - 190, w = 76;
    ctx.save(); ctx.globalAlpha = G.gateFade;
    ctx.shadowColor = col; ctx.shadowBlur = 14;
    ctx.fillStyle = '#1a1030'; ctx.fillRect(x - w / 2 - 6, top, 8, 190); ctx.fillRect(x + w / 2 - 2, top, 8, 190);
    ctx.fillStyle = col; ctx.fillRect(x - w / 2 - 4, top + 2, 4, 186); ctx.fillStyle = col2; ctx.fillRect(x + w / 2, top + 2, 4, 186);
    // banner
    ctx.shadowBlur = 18; ctx.fillStyle = '#1a1030'; roundRect(x - w / 2 - 12, top - 30, w + 24, 34, 8); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = col; roundRect(x - w / 2 - 12, top - 30, w + 24, 34, 8); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '900 22px ' + fontFam; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(st === 'good' ? '✓' : st === 'bad' ? '✗' : '?', x, top - 12);
    // cones
    drawCone(x - w / 2 - 16, GROUND_Y); drawCone(x + w / 2 + 16, GROUND_Y);
    ctx.restore();
  }
  function drawCone(x, y) {
    ctx.fillStyle = '#ff7a3d'; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x, y - 20); ctx.lineTo(x + 7, y); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 4, y - 11, 8, 3);
    ctx.fillStyle = '#2a1c47'; ctx.fillRect(x - 9, y - 2, 18, 2);
  }
  var fontFam = '"Avenir Next","Segoe UI",Roboto,Arial,sans-serif';
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // ---------- rider drawing ----------
  function ik(a, b, l1, l2, sign) {
    var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01), ang = Math.atan2(dy, dx);
    var c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * Math.max(d, 0.01)), off = Math.acos(clamp(c, -1, 1)), t = ang + sign * off;
    return [a[0] + Math.cos(t) * l1, a[1] + Math.sin(t) * l1];
  }
  function seg(c, pts, w, col) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke(); }
  function drawPerson(c, r, pose) {
    var st = r.stance, cr = pose.crouch || 0;
    var hip = [st.hip[0] - cr * 2, st.hip[1] + cr * 11], sh = [st.shoulder[0] + cr * 5, st.shoulder[1] + cr * 13];
    var head = [sh[0] + 3, sh[1] - 13];
    var hands = st.hands.map(function (h) { return [h[0] + cr * 3, h[1] + cr * 11 + (pose.armsUp || 0) * -18]; });
    // back arm
    var e0 = ik(sh, hands[0], 14, 14, st.elbow[0]); seg(c, [sh, e0, hands[0]], 6, r.hoodieDark);
    // legs
    st.feet.forEach(function (f) {
      var k = ik(hip, f, 19, 19, -1); seg(c, [hip, k, f], 8.5, '#2b2f4a');
      c.fillStyle = '#f2f2f7'; c.beginPath(); c.ellipse(f[0] + 2, f[1] + 1, 6.5, 3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#16121f'; c.fillRect(f[0] - 4.5, f[1] + 2.5, 13, 1.5);
    });
    // torso (hoodie)
    seg(c, [hip, sh], 14, r.hoodie);
    c.fillStyle = r.hoodieDark; c.beginPath(); c.arc(hip[0], hip[1], 7, 0, Math.PI * 2); c.fill();
    // head + helmet
    c.fillStyle = '#c98b5e'; c.beginPath(); c.arc(head[0], head[1], 8.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#16121f'; c.beginPath(); c.arc(head[0], head[1] - 1, 10, Math.PI * 1.02, Math.PI * 2.02); c.fill();
    c.fillRect(head[0] - 10, head[1] - 2, 20, 3);
    c.fillStyle = r.deck; c.fillRect(head[0] - 3, head[1] - 10.5, 3, 9);
    c.fillStyle = '#16121f'; c.fillRect(head[0] + 5, head[1] + 1, 3, 2);  // eye/shades
    // front arm
    var e1 = ik(sh, hands[1], 14, 14, st.elbow[1]); seg(c, [sh, e1, hands[1]], 6, r.hoodie);
    c.fillStyle = '#c98b5e'; hands.forEach(function (h) { c.beginPath(); c.arc(h[0], h[1], 3, 0, Math.PI * 2); c.fill(); });
  }
  function drawSkateboard(c, pose, r) {
    c.save(); c.translate(0, -9); c.rotate(pose.boardRot || 0); c.scale(pose.spinX == null ? 1 : pose.spinX, pose.flipY == null ? 1 : pose.flipY);
    c.fillStyle = '#9aa0b5'; c.fillRect(-24, 0, 8, 3); c.fillRect(16, 0, 8, 3);
    c.fillStyle = '#f4e9d8'; [-21, 21].forEach(function (x) { c.beginPath(); c.arc(x, 5, 3.8, 0, Math.PI * 2); c.fill(); });
    seg(c, [[-35, -6], [-27, -1], [27, -1], [35, -6]], 5, r.deck);
    seg(c, [[-34, -8], [-27, -3.5], [27, -3.5], [34, -8]], 1.5, '#16121f');
    c.restore();
  }
  function drawScooter(c, pose, r) {
    c.save(); c.rotate(pose.boardRot || 0);
    // deck + rear wheel spin around the stem (tailwhip)
    c.save(); c.translate(23, 0); c.scale(pose.spinX == null ? 1 : pose.spinX, 1); c.translate(-23, 0);
    c.fillStyle = r.deck; roundRectC(c, -26, -13, 48, 6, 3); c.fill();
    c.fillStyle = '#16121f'; c.fillRect(-24, -13, 42, 1.5);
    c.fillStyle = '#9aa0b5'; c.fillRect(-31, -14, 8, 2.5);
    wheel(c, -25, -6); c.restore();
    // stem, fork, front wheel
    seg(c, [[26, -6], [22, -14], [18, -79]], 4, '#d9dbe8');
    wheel(c, 26, -6);
    c.save(); c.translate(18, -79); c.scale(pose.barX == null ? 1 : pose.barX, 1);
    seg(c, [[-8, 0], [8, 0]], 4, '#d9dbe8'); seg(c, [[-9, 0], [-5, 0]], 5, '#16121f'); seg(c, [[5, 0], [9, 0]], 5, '#16121f');
    c.restore();
    c.restore();
  }
  function wheel(c, x, y) { c.fillStyle = '#16121f'; c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = '#9aa0b5'; c.beginPath(); c.arc(x, y, 2.4, 0, Math.PI * 2); c.fill(); }
  function roundRectC(c, x, y, w, h, rr) { c.beginPath(); c.moveTo(x + rr, y); c.arcTo(x + w, y, x + w, y + h, rr); c.arcTo(x + w, y + h, x, y + h, rr); c.arcTo(x, y + h, x, y, rr); c.arcTo(x, y, x + w, y, rr); c.closePath(); }

  function drawRider(c, x, y, sc, r, pose) {
    c.save(); c.translate(x, y); c.scale(sc, sc);
    // shadow
    var air = pose.air || 0;
    c.fillStyle = 'rgba(0,0,0,' + (0.35 - Math.min(air, 60) / 250) + ')';
    c.beginPath(); c.ellipse((pose.vx || 0) * 0.5, 1, 30 - air * 0.15, 4, 0, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(pose.vx || 0, -air + (pose.vy || 0)); if (pose.vrot) { c.translate(0, -9); c.rotate(pose.vrot); c.translate(0, 9); }
    c.scale(pose.bodyScaleX == null ? 1 : pose.bodyScaleX, 1); r.drawVehicle(c, pose, r); c.restore();
    c.save(); c.translate(pose.px || 0, -air - (pose.feetLift || 0) + (pose.py || 0));
    if (pose.bodyRot) { c.translate(0, -12); c.rotate(pose.bodyRot); c.translate(0, 12); }
    c.scale(pose.bodyScaleX == null ? 1 : pose.bodyScaleX, 1); drawPerson(c, r, pose); c.restore();
    c.restore();
  }

  // ---------- poses ----------
  function idlePose(t) { return { crouch: 0.15 + Math.sin(t * 5) * 0.06 }; }
  function trickPose(id, p) {
    var pose = { air: Math.sin(Math.PI * p) * 50, crouch: p < 0.12 ? 0.3 + p / 0.12 * 0.7 : p > 0.82 ? (1 - p) / 0.18 * 0.8 : 0.35 };
    var q = clamp((p - 0.12) / 0.6, 0, 1), spin = Math.cos(2 * Math.PI * q);
    switch (id) {
      case 'ollie': pose.boardRot = p < 0.5 ? -0.45 * Math.sin(Math.PI * p * 2) : 0; pose.armsUp = Math.sin(Math.PI * p) * 0.5; break;
      case 'kickflip': case 'heelflip': pose.flipY = id === 'kickflip' ? spin : Math.cos(-2 * Math.PI * q); pose.feetLift = Math.sin(Math.PI * q) * 12; pose.armsUp = 0.6 * Math.sin(Math.PI * p); break;
      case 'shuvit': pose.spinX = spin; pose.feetLift = Math.sin(Math.PI * q) * 10; break;
      case 'hop': pose.boardRot = p < 0.5 ? -0.25 * Math.sin(Math.PI * p * 2) : 0; break;
      case 'tailwhip': pose.spinX = spin; pose.feetLift = Math.sin(Math.PI * q) * 12; break;
      case 'barspin': pose.barX = spin; break;
      case 'threesixty': pose.bodyScaleX = spin; break;
    }
    return pose;
  }
  function wipePose(p) {
    var hit = clamp(p / 0.22, 0, 1), rec = clamp((p - 0.78) / 0.22, 0, 1);
    var fall = easeOut(hit) * (1 - rec);
    return {
      vx: easeOut(clamp(p / 0.5, 0, 1)) * 80 * (1 - rec), vy: -Math.sin(clamp(p / 0.45, 0, 1) * Math.PI) * 28,
      vrot: clamp(p / 0.5, 0, 1) * Math.PI * 3 * (1 - rec),
      bodyRot: fall * 1.42, px: fall * 26, py: fall * 4, crouch: 0.4 * (1 - rec), armsUp: fall
    };
  }

  // ---------- particles & pops ----------
  function burst(x, y, n, cols, spd) {
    for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, s = (0.4 + Math.random()) * spd; G.particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - spd * 0.5, life: 0.7 + Math.random() * 0.4, t: 0, c: pick(cols), r: 1.5 + Math.random() * 2.5 }); }
  }
  function pop(text, color) { G.pops.push({ text: text, color: color, t: 0 }); }

  // ---------- DOM refs ----------
  var el = {
    score: $('#score'), streak: $('#streak'), mult: $('#mult'), multChip: $('#multChip'), time: $('#time'), timeBar: $('#timeBar'), timeChip: $('.timeChip'),
    banner: $('#banner'), prompt: $('#prompt'), gateBar: $('#gateBar i'), typed: $('#typed'), display: $('#display'),
    menu: $('#menu'), end: $('#end'), pause: $('#pause'), choices: $$('.choice')
  };

  // ---------- round flow ----------
  function startRound() {
    audio();
    G.screen = 'play'; G.score = 0; G.streak = 0; G.topStreak = 0; G.correct = 0; G.wrong = 0; G.timeLeft = ROUND_SECONDS;
    G.roundMissed = []; G.lastKey = null; G.particles = []; G.pops = []; G.trick = null; G.wipeT = -1; G.gateState = 'none'; G.prob = null; G.paused = false;
    el.menu.classList.remove('show'); el.end.classList.remove('show'); el.pause.classList.remove('show');
    setPhase('ready'); el.banner.className = ''; el.prompt.textContent = 'READY…'; el.gateBar.style.width = '0%';
    clearInput(); updateHUD(); applyMode();
  }
  function setPhase(p) { G.phase = p; G.phaseT = 0; document.body.classList.toggle('locked', p !== 'ask'); }
  function newProblem() {
    var p = nextProblem(level(), G.lastKey); G.prob = p; G.lastKey = p.key;
    var sf = speedFactor(); G.speed = BASE_SPEED * sf;
    var tAllowed = level().time / sf; G.gateTotal = G.gateDist = G.speed * tAllowed;
    G.gateState = 'pending'; G.gateFade = 1;
    el.banner.className = ''; el.prompt.textContent = p.prompt; el.gateBar.style.width = '100%';
    clearInput();
    if (settings.mode === 'choices') {
      G.choices = distractors(p);
      el.choices.forEach(function (b, i) { b.textContent = G.choices[i]; b.className = 'choice'; b.setAttribute('data-hint', i + 1); });
    }
    setPhase('ask');
  }
  function submit(val) {
    if (G.screen !== 'play' || G.phase !== 'ask' || G.paused) return;
    if (val === '' || val == null || isNaN(val)) return;
    var p = G.prob, ok = Number(val) === p.answer;
    if (ok) onCorrect(); else onWrong('wrong', Number(val));
  }
  function onCorrect() {
    var p = G.prob, frac = clamp(G.gateDist / G.gateTotal, 0, 1);
    G.streak++; G.topStreak = Math.max(G.topStreak, G.streak); G.correct++;
    var m = multiplier(), pts = Math.round((100 + Math.round(frac * 100)) * m);
    G.score += pts; recordHit(p);
    var r = rider(); G.trick = G.streak < 3 ? r.tricks[0] : pick(r.tricks.slice(1)); G.trickT = 0;
    G.gateState = 'good'; G.boostSpeed = Math.max(G.speed, G.gateDist / 0.38);
    el.banner.className = 'right'; flashDisplay('flashR');
    if (settings.mode === 'choices') el.choices.forEach(function (b) { if (Number(b.textContent) === p.answer) b.classList.add('good'); });
    pop('+' + pts + '  ' + G.trick.name, '#ffc94d');
    if (m > 1 && (G.streak === 3 || G.streak === 6 || G.streak === 9 || G.streak === 12)) pop('x' + m + ' MULTIPLIER!', '#ff7a3d');
    sfx.good(); setPhase('boost'); updateHUD();
  }
  function onWrong(reason, val) {
    var p = G.prob; G.streak = 0; G.wrong++; recordMiss(p);
    if (!G.roundMissed.some(function (f) { return f.key === p.key; })) G.roundMissed.push({ key: p.key, text: p.reveal });
    G.gateState = 'bad'; G.wipeT = 0; G.trick = null;
    el.banner.className = 'wrong'; el.prompt.innerHTML = p.revealHTML; flashDisplay('flashW');
    if (settings.mode === 'choices') el.choices.forEach(function (b) { var v = Number(b.textContent); if (v === p.answer) b.classList.add('good'); else if (v === val) b.classList.add('bad'); });
    pop(reason === 'time' ? 'TOO SLOW!' : 'WIPEOUT!', '#ff4d5e');
    sfx.bad(); setPhase('wipe'); updateHUD();
  }
  function endRound() {
    G.screen = 'end'; setPhase('idle');
    var lv = level(), bestKey = 'best_' + lv.id, best = store.get(bestKey, 0), isNew = G.score > best && G.score > 0;
    if (isNew) { best = G.score; store.set(bestKey, best); }
    var total = G.correct + G.wrong, acc = total ? Math.round(G.correct / total * 100) : 0;
    $('#eScore').textContent = G.score; $('#eBest').textContent = best; $('#eAcc').textContent = acc + '%'; $('#eStreak').textContent = G.topStreak;
    $('#newBest').classList.toggle('show', isNew);
    $('#eLine').textContent = lv.name + ' · ' + G.correct + ' of ' + total + ' correct';
    var box = $('#eFacts'); box.innerHTML = '';
    G.roundMissed.forEach(function (f) { var d = document.createElement('div'); d.className = 'fact'; d.textContent = f.text; box.appendChild(d); });
    var shown = G.roundMissed.map(function (f) { return f.key; }), m = getMissed();
    var older = Object.keys(m).filter(function (k) { return shown.indexOf(k) < 0 && lv.fits(m[k]); }).sort(function (a, b) { return m[b].n - m[a].n; }).slice(0, Math.max(0, 8 - shown.length));
    older.forEach(function (k) { var f = m[k], d = document.createElement('div'); d.className = 'fact old'; d.textContent = f.a + ' × ' + f.b + ' = ' + (f.a * f.b); box.appendChild(d); });
    if (!box.children.length) box.innerHTML = '<div class="none">Clean round — nothing to practice!</div>';
    el.banner.className = 'hide'; el.end.classList.add('show');
    refreshMenu();
  }
  function toMenu() { G.screen = 'menu'; setPhase('idle'); G.gateState = 'none'; el.end.classList.remove('show'); el.pause.classList.remove('show'); el.menu.classList.add('show'); el.banner.className = 'hide'; refreshMenu(); }

  // ---------- update ----------
  function update(dt) {
    G.t += dt;
    var playing = G.screen === 'play' && !G.paused;
    if (G.paused) return;
    G.phaseT += dt;
    var spd = G.screen === 'play' ? G.speed : BASE_SPEED * 0.8;
    if (playing) {
      G.timeLeft -= dt;
      if (G.timeLeft <= 0) { G.timeLeft = 0; updateHUD(); endRound(); return; }
      if (G.phase === 'ready') {
        G.speed = BASE_SPEED; if (G.phaseT > 0.6 && el.prompt.textContent !== 'GO!') { el.prompt.textContent = 'GO!'; sfx.go(); }
        if (G.phaseT > 1.1) newProblem();
      } else if (G.phase === 'ask') {
        G.gateDist -= G.speed * dt; el.gateBar.style.width = (clamp(G.gateDist / G.gateTotal, 0, 1) * 100) + '%';
        if (G.gateDist <= 0) { G.gateDist = 0; onWrong('time'); }
      } else if (G.phase === 'boost') {
        spd = G.gateDist > 0 ? G.boostSpeed : G.speed + (G.boostSpeed - G.speed) * Math.max(0, 1 - G.phaseT * 3);
        G.gateDist -= spd * dt; G.trickT += dt;
        if (G.gateDist <= 0 && !G.passed) { G.passed = true; burst(riderX() + 10, GROUND_Y - 70, 22, ['#19c3c0', '#ffc94d', '#ff4f8b', '#fff'], 120); }
        if (G.phaseT > 0.85) { G.passed = false; G.trick = null; newProblem(); }
      } else if (G.phase === 'wipe') {
        G.wipeT += dt; spd = G.speed * Math.max(0, 1 - G.phaseT * 2.5);
        G.gateDist -= spd * dt;
        if (G.phaseT > 0.25 && !G.dusted) { G.dusted = true; burst(riderX() + 30, GROUND_Y - 4, 16, ['#b9a8d8', '#8a7aa8', '#ffcf9a'], 70); }
        if (G.phaseT > 1.3) G.gateFade = Math.max(0, 1 - (G.phaseT - 1.3) / 0.3);
        if (G.phaseT > 1.7) { G.dusted = false; G.wipeT = -1; newProblem(); }
      }
      if (Math.ceil(G.timeLeft) !== G._lastSec) { G._lastSec = Math.ceil(G.timeLeft); updateHUD(); }
    }
    G.worldX += spd * dt;
    for (var i = G.particles.length - 1; i >= 0; i--) { var q = G.particles[i]; q.t += dt; q.x += q.vx * dt - spd * dt * 0.3; q.y += q.vy * dt; q.vy += 260 * dt; if (q.t > q.life) G.particles.splice(i, 1); }
    for (var j = G.pops.length - 1; j >= 0; j--) { G.pops[j].t += dt; if (G.pops[j].t > 1.3) G.pops.splice(j, 1); }
  }
  function riderX() { return Math.min(VW * 0.28, 150); }
  var RIDER_SCALE = 1.25;

  // ---------- render ----------
  function render() {
    ctx.setTransform(scale, 0, 0, scale, 0, -TOP * scale);
    drawSky(G.t);
    drawCity(farCity, 0.08, GROUND_Y - 10, '#3d1d52', 'rgba(255,190,120,0.35)', 0);
    drawCity(nearCity, 0.25, GROUND_Y - 4, '#26143a', 'rgba(255,210,130,0.55)', 300);
    drawProps(); drawLamps(); drawGround();
    var rx = riderX();
    if (G.screen === 'play' && G.gateState !== 'none' && G.gateState !== undefined && G.prob) {
      var gx = rx + 12 + G.gateDist;
      if (gx < VW + 80 && gx > -80) drawGate(gx);
    }
    var r = rider(), pose;
    if (G.phase === 'wipe' && G.wipeT >= 0) pose = wipePose(clamp(G.wipeT / 1.7, 0, 1));
    else if (G.trick && G.phase === 'boost') pose = trickPose(G.trick.id, clamp(G.trickT / 0.8, 0, 1));
    else pose = idlePose(G.t);
    drawRider(ctx, rx, GROUND_Y, RIDER_SCALE, r, pose);
    // speed lines at high streak
    if (G.screen === 'play' && G.streak >= 6) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
      for (var k = 0; k < 5; k++) { var ly = GROUND_Y - 20 - k * 17, lx = ((G.t * 600 + k * 131) % (VW + 100)); ctx.beginPath(); ctx.moveTo(VW - lx, ly); ctx.lineTo(VW - lx + 40, ly); ctx.stroke(); }
    }
    G.particles.forEach(function (q) { ctx.globalAlpha = 1 - q.t / q.life; ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y, q.r, q.r); });
    ctx.globalAlpha = 1;
    G.pops.forEach(function (pp, i) {
      var a = pp.t < 1 ? 1 : 1 - (pp.t - 1) / 0.3, y = GROUND_Y - 215 - pp.t * 40 - i * 26;
      ctx.globalAlpha = Math.max(0, a); ctx.font = 'italic 900 24px ' + fontFam; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var tw = ctx.measureText(pp.text).width, px = clamp(rx + 70, tw / 2 + 8, VW - tw / 2 - 8);
      ctx.lineWidth = 5; ctx.strokeStyle = '#1a1030'; ctx.strokeText(pp.text, px, y); ctx.fillStyle = pp.color; ctx.fillText(pp.text, px, y);
    });
    ctx.globalAlpha = 1;
  }

  // ---------- HUD ----------
  function updateHUD() {
    el.score.textContent = G.score; el.streak.textContent = G.streak; var m = multiplier(); el.mult.textContent = 'x' + m;
    el.multChip.classList.toggle('hot', m > 1);
    var s = Math.ceil(G.timeLeft); el.time.textContent = s; el.timeBar.style.width = (G.timeLeft / ROUND_SECONDS * 100) + '%';
    el.timeChip.classList.toggle('low', s <= 10);
  }

  // ---------- input ----------
  function clearInput() { G.input = ''; el.typed.textContent = ''; }
  function typeDigit(d) { if (G.screen !== 'play' || G.phase !== 'ask' || G.paused) return; if (G.input.length >= 4) return; G.input += d; el.typed.textContent = G.input; sfx.tap(); }
  function backspace() { if (G.phase !== 'ask') return; G.input = G.input.slice(0, -1); el.typed.textContent = G.input; }
  function flashDisplay(c) { el.display.classList.remove('flashR', 'flashW'); el.display.classList.add(c); setTimeout(function () { el.display.classList.remove(c); }, 600); }
  function press(btn) { btn.classList.add('pressed'); setTimeout(function () { btn.classList.remove('pressed'); }, 110); }

  function onPointer(target, fn) {
    target.addEventListener('pointerdown', function (e) { e.preventDefault(); fn(e); });
    target.addEventListener('click', function (e) { e.preventDefault(); }); // no double-fire
  }
  $$('.key').forEach(function (b) {
    onPointer(b, function () {
      press(b); var k = b.getAttribute('data-k');
      if (k === 'del') backspace(); else if (k === 'go') submit(G.input); else typeDigit(k);
    });
  });
  el.choices.forEach(function (b, i) { onPointer(b, function () { press(b); chooseIdx(i); }); });
  function chooseIdx(i) { if (G.phase === 'ask' && G.choices[i] != null) submit(G.choices[i]); }

  document.addEventListener('keydown', function (e) {
    if (G.screen === 'menu' && e.key === 'Enter') { startRound(); e.preventDefault(); return; }
    if (G.screen === 'end' && e.key === 'Enter') { startRound(); e.preventDefault(); return; }
    if (G.screen !== 'play') return;
    if (e.key === 'Escape' || e.key === 'p') { togglePause(); return; }
    if (settings.mode === 'choices') { if (e.key >= '1' && e.key <= '3') { chooseIdx(Number(e.key) - 1); press(el.choices[Number(e.key) - 1]); } return; }
    if (/^[0-9]$/.test(e.key)) { typeDigit(e.key); var kb = $('.key[data-k="' + e.key + '"]'); if (kb) press(kb); }
    else if (e.key === 'Backspace') { backspace(); e.preventDefault(); }
    else if (e.key === 'Enter') { submit(G.input); e.preventDefault(); }
  });

  // block pinch / double-tap zoom and page bounce on iOS
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false }); });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', function (e) { if (!e.target.closest('.overlay')) e.preventDefault(); }, { passive: false });

  function togglePause(force) {
    if (G.screen !== 'play') return;
    G.paused = force != null ? force : !G.paused;
    el.pause.classList.toggle('show', G.paused);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) togglePause(true); });
  $('#resumeBtn').addEventListener('click', function () { togglePause(false); });
  $('#quitBtn').addEventListener('click', function () { if (G.screen === 'play') toMenu(); });
  $('#muteBtn').addEventListener('click', function () { settings.muted = !settings.muted; store.set('muted', settings.muted); $('#muteBtn').textContent = settings.muted ? '🔇' : '🔊'; });
  $('#muteBtn').textContent = settings.muted ? '🔇' : '🔊';
  $('#startBtn').addEventListener('click', startRound);
  $('#againBtn').addEventListener('click', startRound);
  $('#menuBtn').addEventListener('click', toMenu);

  // ---------- menu ----------
  var previews = [];
  function buildMenu() {
    var rp = $('#riderPick'); rp.innerHTML = '';
    RIDERS.forEach(function (r) {
      var b = document.createElement('button'); b.className = 'rider'; b.setAttribute('data-id', r.id);
      var c = document.createElement('canvas'); b.appendChild(c);
      var s = document.createElement('span'); s.textContent = r.name; b.appendChild(s);
      b.addEventListener('click', function () { settings.rider = r.id; store.set('rider', r.id); refreshMenu(); });
      rp.appendChild(b); previews.push({ c: c, r: r });
    });
    var lp = $('#levelPick'); lp.innerHTML = '';
    LEVELS.forEach(function (lv) {
      var b = document.createElement('button'); b.className = 'lvl'; b.setAttribute('data-level', lv.id);
      b.innerHTML = '<span class="n">' + lv.id + '</span><span class="t">' + lv.name + '<small>' + lv.desc + '</small></span><span class="b"></span>';
      b.addEventListener('click', function () { settings.level = lv.id; store.set('level', lv.id); refreshMenu(); });
      lp.appendChild(b);
    });
    $$('#modePick button').forEach(function (b) { b.addEventListener('click', function () { settings.mode = b.getAttribute('data-mode'); store.set('mode', settings.mode); refreshMenu(); applyMode(); }); });
  }
  function refreshMenu() {
    $$('.rider').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-id') === settings.rider); });
    $$('.lvl').forEach(function (b) {
      var id = Number(b.getAttribute('data-level')), best = store.get('best_' + id, 0);
      b.classList.toggle('sel', id === settings.level); b.querySelector('.b').textContent = best ? 'BEST ' + best : '';
    });
    $$('#modePick button').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-mode') === settings.mode); });
    var m = getMissed(), n = Object.keys(m).filter(function (k) { return level().fits(m[k]); }).length;
    $('#practiceNote').textContent = n ? n + ' tricky fact' + (n > 1 ? 's' : '') + ' saved for this level — they’ll show up more often.' : 'Missed facts get saved and come back more often until you nail them.';
  }
  function applyMode() { document.body.classList.toggle('mode-choices', settings.mode === 'choices'); }
  function drawPreviews() {
    previews.forEach(function (pv) {
      var c = pv.c, w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
      var d = Math.min(window.devicePixelRatio || 1, 3); if (c.width !== Math.round(w * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
      var x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0);
      var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5b2166'); g.addColorStop(0.7, '#e8574a'); g.addColorStop(1, '#ffb35c');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,230,150,0.9)'; x.beginPath(); x.arc(w * 0.75, h * 0.62, h * 0.22, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#26143a'; x.fillRect(0, h - 14, w, 14);
      var sel = pv.r.id === settings.rider;
      drawRider(x, w / 2 - 4, h - 12, h / 150, pv.r, sel ? trickPose(pv.r.tricks[1].id, (G.t * 0.55) % 1.6 < 0.8 ? ((G.t * 0.55) % 1.6) / 0.8 : 0) : idlePose(G.t));
    });
  }

  // ---------- loop ----------
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    try { update(dt); render(); if (G.screen === 'menu') drawPreviews(); } catch (err) { console.error(err); }
    requestAnimationFrame(frame);
  }
  buildMenu(); refreshMenu(); applyMode(); resize(); updateHUD(); el.banner.className = 'hide';
  requestAnimationFrame(frame);
})();
