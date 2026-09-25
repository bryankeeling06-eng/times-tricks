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
      id: 'skate', name: 'Skateboard', gearCat: 'board',
      hoodie: '#19c3c0', hoodieDark: '#0f8f8c', deck: '#ff7a3d',
      stance: { feet: [[-15, -13], [15, -13]], hip: [0, -45], shoulder: [3, -71], hands: [[-24, -56], [27, -60]], elbow: [1, -1] },
      tricks: [
        { id: 'ollie', name: 'OLLIE' }, { id: 'kickflip', name: 'KICKFLIP' },
        { id: 'shuvit', name: 'SHOVE-IT' }, { id: 'heelflip', name: 'HEELFLIP' }
      ],
      // grinds: contact = local height (rider units) of the part that sits on the rail
      grinds: [
        { id: 'g5050', name: '50-50 GRIND', grind: true, contact: 6, style: { boardRot: 0, bodyRot: -0.05 } },
        { id: 'gboard', name: 'BOARDSLIDE', grind: true, contact: 8, style: { spinX: 0.26, bodyRot: -0.1, px: -2 } }
      ],
      drawVehicle: drawSkateboard
    },
    {
      id: 'scooter', name: 'Scooter', gearCat: 'scooter',
      hoodie: '#ff4f8b', hoodieDark: '#c22e63', deck: '#19c3c0',
      stance: { feet: [[-15, -14], [2, -14]], hip: [-6, -47], shoulder: [5, -71], hands: [[16, -77], [20, -77]], elbow: [-1, 1] },
      tricks: [
        { id: 'hop', name: 'BUNNY HOP' }, { id: 'tailwhip', name: 'TAILWHIP' },
        { id: 'barspin', name: 'BAR SPIN' }, { id: 'threesixty', name: '360' }
      ],
      grinds: [
        { id: 'gfeeble', name: 'FEEBLE GRIND', grind: true, contact: 5, style: { boardRot: -0.13, bodyRot: -0.08 } },
        { id: 's5050', name: '50-50 GRIND', grind: true, contact: 7, style: { boardRot: 0, bodyRot: -0.04 } }
      ],
      drawVehicle: drawScooter
    }
  ];
  function riderById(id) { for (var i = 0; i < RIDERS.length; i++) if (RIDERS[i].id === id) return RIDERS[i]; return RIDERS[0]; }

  // ======================================================================
  // GEAR SHOP: all data-driven. To add an item, add one object to GEAR.
  //   id (unique), cat (a GEAR_CATS id), name, price (coins; 0 = free starter, owned by default),
  //   optional unlock (an ACHIEVEMENTS id), plus the look fields for that category:
  //   shirt:   color, dark, [stripe], [glow]
  //   helmet:  color, pattern ('none'|'stripe'|'double'|'bolt'|'star'|'checker'|'flames'|'chrome'|'spikes'), [accent]
  //   board / scooter: deck, wheel, [pattern ('none'|'stripe'|'split'|'checker'|'flames'|'stars')], [accent], [wheelGlow], [bar] (scooter)
  // A category with `rider` only applies to that ride (its rider has gearCat = that category id).
  // ======================================================================
  var GEAR_CATS = [
    { id: 'shirt', name: 'Shirts' },
    { id: 'helmet', name: 'Helmets' },
    { id: 'board', name: 'Boards', rider: 'skate' },
    { id: 'scooter', name: 'Scooters', rider: 'scooter' }
  ];
  var GEAR = [
    // Shirts (color null = the ride's own hoodie color)
    { id: 'shirt_classic', cat: 'shirt', name: 'Classic Hoodie', price: 0 },
    { id: 'shirt_black', cat: 'shirt', name: 'Street Black', price: 40, color: '#34344a', dark: '#1c1c2a' },
    { id: 'shirt_red', cat: 'shirt', name: 'Hot Red', price: 50, color: '#e8394a', dark: '#a81f2e' },
    { id: 'shirt_lime', cat: 'shirt', name: 'Lime Zest', price: 60, color: '#9be23c', dark: '#5f9a1c' },
    { id: 'shirt_blue', cat: 'shirt', name: 'Ocean Blue', price: 80, color: '#2f7cf6', dark: '#1b4fb0' },
    { id: 'shirt_purple', cat: 'shirt', name: 'Royal Stripe', price: 100, color: '#8a4dff', dark: '#5a2bb8', stripe: '#ffc94d' },
    { id: 'shirt_neon', cat: 'shirt', name: 'Neon Glow', price: 150, color: '#39ffd8', dark: '#14b89a', glow: true },
    { id: 'shirt_gold', cat: 'shirt', name: 'Gold Jersey', price: 180, color: '#ffc94d', dark: '#c8931f', stripe: '#ffffff', unlock: 'streak20' },
    // Helmets (accent null = the ride's accent color)
    { id: 'helm_classic', cat: 'helmet', name: 'Classic Black', price: 0, color: '#16121f', pattern: 'stripe' },
    { id: 'helm_white', cat: 'helmet', name: 'White Racer', price: 40, color: '#f2f2f7', pattern: 'double', accent: '#e8394a' },
    { id: 'helm_red', cat: 'helmet', name: 'Matte Red', price: 50, color: '#c7283a', pattern: 'none' },
    { id: 'helm_star', cat: 'helmet', name: 'Star Sticker', price: 80, color: '#2f3a8f', pattern: 'star', accent: '#ffc94d' },
    { id: 'helm_bolt', cat: 'helmet', name: 'Lightning', price: 90, color: '#19c3c0', pattern: 'bolt', accent: '#ffe04d' },
    { id: 'helm_checker', cat: 'helmet', name: 'Checkered', price: 120, color: '#f2f2f7', pattern: 'checker', accent: '#16121f' },
    { id: 'helm_flames', cat: 'helmet', name: 'Hot Flames', price: 150, color: '#16121f', pattern: 'flames', accent: '#ff7a3d' },
    { id: 'helm_spikes', cat: 'helmet', name: 'Spike Crown', price: 160, color: '#23202e', pattern: 'spikes', accent: '#d5d9e6' },
    { id: 'helm_chrome', cat: 'helmet', name: 'Chrome Dome', price: 220, color: '#c9ceda', pattern: 'chrome', unlock: 'l3pb' },
    // Skateboards
    { id: 'board_classic', cat: 'board', name: 'Classic Orange', price: 0, deck: '#ff7a3d', wheel: '#f4e9d8' },
    { id: 'board_black', cat: 'board', name: 'Blackout', price: 40, deck: '#23202e', wheel: '#e8394a', pattern: 'stripe', accent: '#e8394a' },
    { id: 'board_neon', cat: 'board', name: 'Neon Wheels', price: 60, deck: '#19c3c0', wheel: '#9dff3c', wheelGlow: true },
    { id: 'board_split', cat: 'board', name: 'Sunset Split', price: 90, deck: '#ff4f8b', accent: '#ffb35c', pattern: 'split', wheel: '#ffe04d' },
    { id: 'board_checker', cat: 'board', name: 'Checker Deck', price: 110, deck: '#f2f2f7', accent: '#16121f', pattern: 'checker', wheel: '#f2f2f7' },
    { id: 'board_flame', cat: 'board', name: 'Flame Deck', price: 150, deck: '#c7283a', accent: '#ffb35c', pattern: 'flames', wheel: '#ff9a3d' },
    { id: 'board_galaxy', cat: 'board', name: 'Galaxy Deck', price: 240, deck: '#3b1f7a', accent: '#ffffff', pattern: 'stars', wheel: '#8ff5ee', wheelGlow: true, unlock: 'grinds10' },
    // Scooters
    { id: 'scoot_classic', cat: 'scooter', name: 'Classic Teal', price: 0, deck: '#19c3c0', bar: '#d9dbe8', wheel: '#16121f' },
    { id: 'scoot_black', cat: 'scooter', name: 'Blackout', price: 40, deck: '#23202e', bar: '#4a4a5c', wheel: '#e8394a' },
    { id: 'scoot_red', cat: 'scooter', name: 'Candy Red', price: 60, deck: '#e8394a', bar: '#f2f2f7', wheel: '#16121f' },
    { id: 'scoot_lime', cat: 'scooter', name: 'Lime Rider', price: 80, deck: '#9be23c', bar: '#23202e', wheel: '#9be23c' },
    { id: 'scoot_purple', cat: 'scooter', name: 'Purple Haze', price: 100, deck: '#8a4dff', bar: '#ffc94d', wheel: '#16121f', pattern: 'stripe', accent: '#ffc94d' },
    { id: 'scoot_checker', cat: 'scooter', name: 'Checker', price: 130, deck: '#f2f2f7', accent: '#16121f', pattern: 'checker', bar: '#16121f', wheel: '#f2f2f7' },
    { id: 'scoot_spark', cat: 'scooter', name: 'Rail Spark', price: 200, deck: '#ff7a3d', accent: '#ffe04d', pattern: 'flames', bar: '#ff7a3d', wheel: '#9dff3c', wheelGlow: true, unlock: 'grinds10' },
    { id: 'scoot_gold', cat: 'scooter', name: 'Gold Rush', price: 250, deck: '#23202e', accent: '#ffc94d', pattern: 'stripe', bar: '#ffc94d', wheel: '#ffc94d', unlock: 'l5acc80' }
  ];
  var GEAR_BY_ID = {}; GEAR.forEach(function (g) { GEAR_BY_ID[g.id] = g; });
  function catDefault(cat) { for (var i = 0; i < GEAR.length; i++) if (GEAR[i].cat === cat && GEAR[i].price === 0) return GEAR[i]; }

  // Milestones that unlock premium items. progress(stats) -> [current, goal].
  var L3_PB_GOAL = 6000;
  var ACHIEVEMENTS = {
    streak20: { text: 'Hit a 20-answer streak', progress: function (s) { return [Math.min(s.bestStreak, 20), 20]; } },
    grinds10: { text: 'Land 10 grinds (finished rounds)', progress: function (s) { return [Math.min(s.grinds, 10), 10]; } },
    l5acc80: { text: 'Finish a Level 5 round with 80%+ accuracy (8+ answers)', progress: function (s) { return [s.l5acc80 ? 80 : Math.min(s.l5bestAcc, 79), 80]; }, unit: '%' },
    l3pb: { text: 'Score ' + L3_PB_GOAL.toLocaleString('en-US') + '+ on Level 3', progress: function () { return [Math.min(store.get('best_3', 0), L3_PB_GOAL), L3_PB_GOAL]; } }
  };
  function getStats() { var s = store.get('stats', {}); return { bestStreak: s.bestStreak || 0, grinds: s.grinds || 0, l5acc80: !!s.l5acc80, l5bestAcc: s.l5bestAcc || 0, rounds: s.rounds || 0 }; }
  function achieved(id, stats) { var p = ACHIEVEMENTS[id].progress(stats || getStats()); return p[0] >= p[1]; }
  function isUnlocked(item, stats) { return !item.unlock || achieved(item.unlock, stats); }

  // Coins
  var COINS = { perCorrect: 2, perMultStep: 1, grind: 3, accuracyBonus: 5, accuracyMin: 80, accuracyMinAnswers: 8, bestBonus: 10 };
  function getCoins() { return Math.max(0, store.get('coins', 0) | 0); }
  function setCoins(v) { store.set('coins', Math.max(0, v | 0)); }

  // Owned / equipped
  var gear = (function () {
    var g = store.get('gear', null) || {}, owned = Array.isArray(g.owned) ? g.owned.filter(function (id) { return GEAR_BY_ID[id]; }) : [];
    GEAR.forEach(function (it) { if (it.price === 0 && owned.indexOf(it.id) < 0) owned.push(it.id); });
    var eq = g.equipped || {};
    GEAR_CATS.forEach(function (c) { var it = GEAR_BY_ID[eq[c.id]]; if (!it || it.cat !== c.id || owned.indexOf(it.id) < 0) eq[c.id] = catDefault(c.id).id; });
    return { owned: owned, equipped: eq };
  })();
  function saveGear() { store.set('gear', gear); }
  function owns(id) { return gear.owned.indexOf(id) >= 0; }

  function lookFor(r, eq) {
    eq = eq || gear.equipped;
    var s = GEAR_BY_ID[eq.shirt] || catDefault('shirt'), h = GEAR_BY_ID[eq.helmet] || catDefault('helmet');
    var v = (r.gearCat && (GEAR_BY_ID[eq[r.gearCat]] || catDefault(r.gearCat))) || {};
    return {
      shirt: s.color || r.hoodie, shirtDark: s.dark || r.hoodieDark, stripe: s.stripe || null, glow: s.glow ? (s.color || r.hoodie) : null,
      helmet: h.color, helmetPattern: h.pattern || 'none', helmetAccent: h.accent || r.deck,
      deck: v.deck || r.deck, deckPattern: v.pattern || 'none', deckAccent: v.accent || '#ffffff',
      wheel: v.wheel || '#f4e9d8', wheelGlow: !!v.wheelGlow, bar: v.bar || '#d9dbe8'
    };
  }
  function dress(r, eq) { var o = Object.create(r); o.look = lookFor(r, eq); return o; }

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
  window.__tt.forceGrind = false;
  window.__tt.snap = function (streak) { return takeSnapshot(streak || 5, G.trick); };
  window.__tt.album = function () { return getAlbum().map(function (e) { return { id: e.id, rider: e.rider, trick: e.trick, streak: e.streak, level: e.level, kb: Math.round(e.img.length * 0.75 / 1024) }; }); };
  window.__tt.gearApi = function () { return { coins: getCoins(), gear: gear, stats: getStats(), look: lookFor(rider()), GEAR: GEAR }; };

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
    var L = r.look || lookFor(r);
    var st = r.stance, cr = pose.crouch || 0;
    var hip = [st.hip[0] - cr * 2, st.hip[1] + cr * 11], sh = [st.shoulder[0] + cr * 5, st.shoulder[1] + cr * 13];
    var head = [sh[0] + 3, sh[1] - 13];
    var hands = st.hands.map(function (h) { return [h[0] + cr * 3, h[1] + cr * 11 + (pose.armsUp || 0) * -18]; });
    // back arm
    var e0 = ik(sh, hands[0], 14, 14, st.elbow[0]); seg(c, [sh, e0, hands[0]], 6, L.shirtDark);
    // legs
    st.feet.forEach(function (f) {
      var k = ik(hip, f, 19, 19, -1); seg(c, [hip, k, f], 8.5, '#2b2f4a');
      c.fillStyle = '#f2f2f7'; c.beginPath(); c.ellipse(f[0] + 2, f[1] + 1, 6.5, 3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#16121f'; c.fillRect(f[0] - 4.5, f[1] + 2.5, 13, 1.5);
    });
    // torso: tapered shirt with rounded shoulders and a curved hem over the pants (no hip ball)
    drawTorso(c, hip, sh, L);
    // head + helmet
    c.fillStyle = '#c98b5e'; c.beginPath(); c.arc(head[0], head[1], 8.5, 0, Math.PI * 2); c.fill();
    drawHelmet(c, head[0], head[1], L);
    c.fillStyle = '#16121f'; c.fillRect(head[0] + 5, head[1] + 1, 3, 2);  // eye/shades
    // front arm
    var e1 = ik(sh, hands[1], 14, 14, st.elbow[1]); seg(c, [sh, e1, hands[1]], 6, L.shirt);
    c.fillStyle = '#c98b5e'; hands.forEach(function (h) { c.beginPath(); c.arc(h[0], h[1], 3, 0, Math.PI * 2); c.fill(); });
  }
  function torsoPath(c, hip, sh, T) {
    c.beginPath();
    c.moveTo(T.hc[0] + T.n[0] * T.wh, T.hc[1] + T.n[1] * T.wh);
    c.quadraticCurveTo(T.mid[0] + T.n[0] * (T.ws + 0.8), T.mid[1] + T.n[1] * (T.ws + 0.8), sh[0] + T.n[0] * T.ws, sh[1] + T.n[1] * T.ws);
    c.arc(sh[0], sh[1], T.ws, Math.atan2(T.n[1], T.n[0]), Math.atan2(-T.n[1], -T.n[0]), true);   // rounded shoulders
    c.quadraticCurveTo(T.mid[0] - T.n[0] * (T.ws + 0.4), T.mid[1] - T.n[1] * (T.ws + 0.4), T.hc[0] - T.n[0] * T.wh, T.hc[1] - T.n[1] * T.wh);
    c.quadraticCurveTo(T.hc[0] - T.u[0] * 3.4, T.hc[1] - T.u[1] * 3.4, T.hc[0] + T.n[0] * T.wh, T.hc[1] + T.n[1] * T.wh);   // curved hem
    c.closePath();
  }
  function drawTorso(c, hip, sh, L) {
    var dx = sh[0] - hip[0], dy = sh[1] - hip[1], len = Math.hypot(dx, dy) || 1, u = [dx / len, dy / len], n = [-u[1], u[0]];
    var T = { u: u, n: n, ws: 7.3, wh: 6.3, hc: [hip[0] + u[0] * 1.2, hip[1] + u[1] * 1.2] };
    T.mid = [T.hc[0] + dx * 0.45, T.hc[1] + dy * 0.45];
    // pants seat: one smooth rounded block joining both thighs under the hem (same color as the legs)
    seg(c, [[hip[0] - u[0] * 0.5, hip[1] - u[1] * 0.5], [hip[0] + u[0] * 5, hip[1] + u[1] * 5]], 10.5, '#2b2f4a');
    c.save();
    if (L.glow) { c.shadowColor = L.glow; c.shadowBlur = 12; }
    torsoPath(c, hip, sh, T); c.fillStyle = L.shirt; c.fill();
    c.restore();
    c.save(); torsoPath(c, hip, sh, T); c.clip();
    if (L.stripe) seg(c, [[T.hc[0] - u[0] * 4 + n[0] * 0.6, T.hc[1] - u[1] * 4 + n[1] * 0.6], [sh[0] + u[0] * 9 + n[0] * 0.6, sh[1] + u[1] * 9 + n[1] * 0.6]], 3, L.stripe);
    // waistband / hem band in the darker shirt shade, following the curved hem
    c.strokeStyle = L.shirtDark; c.lineWidth = 2.6; c.lineCap = 'butt'; c.beginPath();
    var b0 = [T.hc[0] + u[0] * 0.9, T.hc[1] + u[1] * 0.9];
    c.moveTo(b0[0] + n[0] * (T.wh + 1), b0[1] + n[1] * (T.wh + 1));
    c.quadraticCurveTo(b0[0] - u[0] * 3.4, b0[1] - u[1] * 3.4, b0[0] - n[0] * (T.wh + 1), b0[1] - n[1] * (T.wh + 1));
    c.stroke();
    c.restore();
  }
  // mohawk row of short, round-tipped metal spikes along the top of the helmet (side view)
  function drawSpikes(c, cx, cy, R, col) {
    var N = 6, a0 = Math.PI * 1.2, a1 = Math.PI * 1.8, half = 0.075 * Math.PI;
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    for (var i = 0; i < N; i++) {
      var a = a0 + (a1 - a0) * i / (N - 1), hgt = 4.2 + Math.sin(Math.PI * i / (N - 1)) * 1.6;
      var p1 = [cx + Math.cos(a - half) * (R - 0.6), cy + Math.sin(a - half) * (R - 0.6)], p2 = [cx + Math.cos(a + half) * (R - 0.6), cy + Math.sin(a + half) * (R - 0.6)];
      var tip = [cx + Math.cos(a) * (R + hgt), cy + Math.sin(a) * (R + hgt)];
      c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(tip[0], tip[1]); c.lineTo(p2[0], p2[1]); c.closePath();
      c.fillStyle = col; c.fill(); c.strokeStyle = col; c.lineWidth = 1.6; c.stroke();   // stroke rounds the tip
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 0.7; c.beginPath();       // shine
      c.moveTo((p1[0] * 2 + tip[0]) / 3, (p1[1] * 2 + tip[1]) / 3); c.lineTo((p1[0] + tip[0] * 2) / 3 + (p2[0] - p1[0]) * 0.1, (p1[1] + tip[1] * 2) / 3 + (p2[1] - p1[1]) * 0.1); c.stroke();
    }
    c.fillStyle = '#8a90a8'; c.beginPath(); c.arc(cx, cy, R - 0.2, a0 - half, a1 + half); c.arc(cx, cy, R - 1.8, a1 + half, a0 - half, true); c.closePath(); c.fill();  // metal base strip
    c.restore();
  }
  function starPath(c, x, y, R) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.45 : R; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); }
  function drawHelmet(c, hx, hy, L) {
    var cx = hx, cy = hy - 1, R = 10, pat = L.helmetPattern, ac = L.helmetAccent;
    c.save();
    c.beginPath(); c.arc(cx, cy, R, Math.PI * 1.02, Math.PI * 2.02); c.closePath();
    if (pat === 'chrome') { var g = c.createLinearGradient(cx - R, cy - R, cx + R, cy); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#c9ceda'); g.addColorStop(0.7, '#6f7390'); g.addColorStop(1, '#e9ecf5'); c.fillStyle = g; }
    else c.fillStyle = L.helmet;
    c.fill(); c.clip();
    c.fillStyle = ac;
    if (pat === 'stripe') c.fillRect(cx - 3, cy - R - 0.5, 3, R);
    else if (pat === 'double') { c.fillRect(cx - 5, cy - R, 2, R); c.fillRect(cx - 1, cy - R, 2, R); }
    else if (pat === 'bolt') { c.beginPath(); c.moveTo(cx - 1, cy - 10); c.lineTo(cx + 4, cy - 10); c.lineTo(cx + 1, cy - 5.5); c.lineTo(cx + 5, cy - 5.5); c.lineTo(cx - 3, cy + 0.5); c.lineTo(cx - 0.5, cy - 4); c.lineTo(cx - 4, cy - 4); c.closePath(); c.fill(); }
    else if (pat === 'star') { starPath(c, cx - 1, cy - 5, 4); c.fill(); }
    else if (pat === 'checker') { for (var i = -12; i < 12; i += 3) for (var j = -12; j < 1; j += 3) if (((i + j) / 3 & 1) === 0) c.fillRect(cx + i, cy + j, 3, 3); }
    else if (pat === 'flames') {
      [[ac, 0], ['#ffe04d', 2.2]].forEach(function (f) {
        c.fillStyle = f[0]; c.beginPath(); c.moveTo(cx + R, cy);
        for (var k = 0; k < 4; k++) { var bx = cx + R - 4 - k * 4.2; c.lineTo(bx + 1, cy - 7 + k * 0.6 + f[1]); c.lineTo(bx - 1.2, cy - 1.5 + f[1] * 0.4); }
        c.lineTo(cx - R, cy); c.closePath(); c.fill();
      });
    }
    else if (pat === 'chrome') { c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 1.6; c.beginPath(); c.arc(cx - 1, cy - 1, 6.5, Math.PI * 1.15, Math.PI * 1.55); c.stroke(); }
    c.restore();
    if (pat === 'spikes') drawSpikes(c, cx, cy, R, ac);
    c.fillStyle = pat === 'chrome' ? '#8a90a8' : L.helmet; c.fillRect(cx - 10, cy - 1, 20, 3);
  }
  function deckPattern(c, pat, ac, x0, x1, yTop, h) { // pattern on a straight deck section
    c.fillStyle = ac;
    if (pat === 'stripe') c.fillRect(x0 + 2, yTop + h / 2 - 0.7, x1 - x0 - 4, 1.4);
    else if (pat === 'checker') { for (var x = x0 + 1, k = 0; x < x1 - 1; x += 3, k++) { c.fillRect(x, yTop + (k & 1 ? h / 2 : 0), 3, h / 2); } }
    else if (pat === 'flames') { for (var fx = x0 + 3; fx < x1 - 8; fx += 10) { c.beginPath(); c.moveTo(fx, yTop + h); c.lineTo(fx + 9, yTop + h); c.lineTo(fx + 1, yTop + 0.5); c.closePath(); c.fill(); } }
    else if (pat === 'stars') { [[0.12, 0.3], [0.3, 0.7], [0.47, 0.25], [0.63, 0.65], [0.82, 0.35], [0.93, 0.7]].forEach(function (p) { c.fillRect(x0 + (x1 - x0) * p[0], yTop + h * p[1] - 0.6, 1.3, 1.3); }); }
  }
  function drawSkateboard(c, pose, r) {
    var L = r.look || lookFor(r);
    c.save(); c.translate(0, -9); c.rotate(pose.boardRot || 0); c.scale(pose.spinX == null ? 1 : pose.spinX, pose.flipY == null ? 1 : pose.flipY);
    c.fillStyle = '#9aa0b5'; c.fillRect(-24, 0, 8, 3); c.fillRect(16, 0, 8, 3);
    if (L.wheelGlow) { c.save(); c.shadowColor = L.wheel; c.shadowBlur = 8; }
    c.fillStyle = L.wheel; [-21, 21].forEach(function (x) { c.beginPath(); c.arc(x, 5, 3.8, 0, Math.PI * 2); c.fill(); });
    if (L.wheelGlow) c.restore();
    seg(c, [[-35, -6], [-27, -1], [27, -1], [35, -6]], 5, L.deck);
    if (L.deckPattern === 'split') seg(c, [[0, -1], [27, -1], [35, -6]], 5, L.deckAccent);
    else deckPattern(c, L.deckPattern, L.deckAccent, -27, 27, -3.5, 5);
    seg(c, [[-34, -8], [-27, -3.5], [27, -3.5], [34, -8]], 1.5, '#16121f');
    c.restore();
  }
  function drawScooter(c, pose, r) {
    var L = r.look || lookFor(r);
    c.save(); c.rotate(pose.boardRot || 0);
    // deck + rear wheel spin around the stem (tailwhip)
    c.save(); c.translate(23, 0); c.scale(pose.spinX == null ? 1 : pose.spinX, 1); c.translate(-23, 0);
    c.fillStyle = L.deck; roundRectC(c, -26, -13, 48, 6, 3); c.fill();
    c.save(); roundRectC(c, -26, -13, 48, 6, 3); c.clip();
    if (L.deckPattern === 'split') { c.fillStyle = L.deckAccent; c.fillRect(-2, -13, 24, 6); }
    else deckPattern(c, L.deckPattern, L.deckAccent, -25, 21, -11.5, 4.5);
    c.restore();
    c.fillStyle = '#16121f'; c.fillRect(-24, -13, 42, 1.5);
    c.fillStyle = '#9aa0b5'; c.fillRect(-31, -14, 8, 2.5);
    wheel(c, -25, -6, L); c.restore();
    // stem, fork, front wheel
    seg(c, [[26, -6], [22, -14], [18, -79]], 4, L.bar);
    wheel(c, 26, -6, L);
    c.save(); c.translate(18, -79); c.scale(pose.barX == null ? 1 : pose.barX, 1);
    seg(c, [[-8, 0], [8, 0]], 4, L.bar); seg(c, [[-9, 0], [-5, 0]], 5, '#16121f'); seg(c, [[5, 0], [9, 0]], 5, '#16121f');
    c.restore();
    c.restore();
  }
  function wheel(c, x, y, L) {
    var col = (L && L.wheel) || '#16121f';
    if (L && L.wheelGlow) { c.save(); c.shadowColor = col; c.shadowBlur = 8; }
    c.fillStyle = col; c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill();
    if (L && L.wheelGlow) c.restore();
    c.fillStyle = '#9aa0b5'; c.beginPath(); c.arc(x, y, 2.4, 0, Math.PI * 2); c.fill();
  }
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
  // ---------- grinds ----------
  // Timeline (seconds): pop 0-0.12, ollie up 0.12-0.28, slide 0.28-0.68, hop off 0.68-0.92.
  var GRIND = { pop: 0.12, land: 0.28, off: 0.68, done: 0.92, phase: 0.98, railH: 34, chance: 0.24, pity: 4, streakBonus: 50 };
  function grindTravel(t) { // distance covered since grind start
    var v = G.grindV, s = G.speed; if (t <= 0.7) return v * t;
    var u = Math.min(t - 0.7, 0.3); return v * 0.7 + v * u + (s - v) * u * u / 0.6 + (t > 1 ? s * (t - 1) : 0);
  }
  function startGrind() {
    G.grindV = clamp(G.gateDist / 0.5, G.speed, G.speed * 2.2);
    G.grindTrav = 0;
    G.railL = grindTravel(GRIND.land) - 18;   // rail in "travel" coords, rider contact = 0
    G.railR = grindTravel(GRIND.off) + 18;
  }
  function grindPose(g, t) {
    var A = GRIND.railH / RIDER_SCALE - g.contact, st = g.style, pose = { crouch: 0.4 }, k = 0;
    if (t < GRIND.pop) { pose.crouch = 0.3 + t / GRIND.pop * 0.7; pose.air = 0; }
    else if (t < GRIND.land) { var u = (t - GRIND.pop) / (GRIND.land - GRIND.pop); pose.air = A * easeOut(u) + Math.sin(Math.PI * u) * 12; pose.boardRot = -0.35 * Math.sin(Math.PI * u); k = u; pose.armsUp = 0.3 * u; }
    else if (t < GRIND.off) { pose.air = A + Math.sin(t * 90) * 0.35; pose.crouch = 0.5; k = 1; pose.armsUp = 0.35; }
    else if (t < GRIND.done) { var w = (t - GRIND.off) / (GRIND.done - GRIND.off); pose.air = A * (1 - w) + Math.sin(Math.PI * w) * 16; k = Math.max(0, 1 - w * 2.5); pose.boardRot = w < 0.4 ? -0.3 * Math.sin(Math.PI * w / 0.4) : 0; pose.crouch = w > 0.8 ? 0.7 : 0.35; pose.armsUp = 0.3 * (1 - w); }
    else { pose.air = 0; pose.crouch = 0.5; }
    if (k > 0) {
      if (st.spinX != null) pose.spinX = 1 + (st.spinX - 1) * k;
      if (st.boardRot) pose.boardRot = (pose.boardRot || 0) * (1 - k) + st.boardRot * k;
      if (st.bodyRot) pose.bodyRot = st.bodyRot * k;
      if (st.px) pose.px = st.px * k;
    }
    return pose;
  }
  function drawRail(rx) { drawRailAt(rx + (G.railL - G.grindTrav), rx + (G.railR - G.grindTrav), clamp(G.trickT / 0.08, 0, 1)); }
  function drawRailAt(a, b, alpha) {
    var y = GROUND_Y - GRIND.railH;
    if (b < -20 || a > VW + 20) return;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(a, GROUND_Y - 2, b - a, 3);
    ctx.fillStyle = '#1a1030';
    var n = Math.max(2, Math.round((b - a) / 55));
    for (var i = 0; i <= n; i++) { var px = a + 6 + (b - a - 12) * i / n; ctx.fillRect(px - 2.5, y, 5, GRIND.railH - 2); ctx.fillRect(px - 6, GROUND_Y - 4, 12, 3); }
    ctx.fillStyle = '#b8bccf'; ctx.fillRect(a, y - 2, b - a, 5);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(a, y - 2, b - a, 1.4);
    ctx.fillStyle = '#ff7a3d'; ctx.fillRect(a, y + 2, b - a, 1.2);
    ctx.fillStyle = '#6f7390'; ctx.fillRect(a - 1, y - 3, 3, 7); ctx.fillRect(b - 2, y - 3, 3, 7);
    ctx.restore();
  }
  function sparks(x, y, n) {
    for (var i = 0; i < n; i++) G.particles.push({ x: x + (Math.random() - 0.5) * 16, y: y, vx: -60 - Math.random() * 140, vy: -40 - Math.random() * 90, life: 0.25 + Math.random() * 0.25, t: 0, c: pick(['#fff3b0', '#ffc94d', '#ff9a3d', '#ffffff']), r: 1.8 + Math.random() * 2 });
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
    if (pilotExpired()) { showPilotEnded(); return; }
    audio();
    G.screen = 'play'; G.score = 0; G.streak = 0; G.topStreak = 0; G.correct = 0; G.wrong = 0; G.timeLeft = ROUND_SECONDS;
    G.roundMissed = []; G.lastKey = null; G.particles = []; G.pops = []; G.trick = null; G.wipeT = -1; G.gateState = 'none'; G.prob = null; G.paused = false; G.sinceGrind = 0; G.lastWasGrind = false;
    G.roundGrinds = 0; G.coinParts = { answers: 0, streak: 0, grinds: 0, bonus: 0 };
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
    var r = rider(), grinds = r.grinds || [];
    var doGrind = grinds.length && G.lastWasGrind !== true && (window.__tt.forceGrind || Math.random() < GRIND.chance || G.sinceGrind >= GRIND.pity);
    if (doGrind) {
      G.trick = pick(grinds); G.sinceGrind = 0; G.lastWasGrind = true; G.roundGrinds++; G.coinParts.grinds += COINS.grind;
      if (G.streak >= 3) pts += GRIND.streakBonus * m;   // small grind bonus on longer streaks
    } else {
      G.trick = G.streak < 3 ? r.tricks[0] : pick(r.tricks.slice(1)); G.sinceGrind = (G.sinceGrind || 0) + 1; G.lastWasGrind = false;
    }
    G.score += pts; recordHit(p); G.trickT = 0;
    G.coinParts.answers += COINS.perCorrect; G.coinParts.streak += (m - 1) * COINS.perMultStep;
    G.gateState = 'good'; G.boostSpeed = Math.max(G.speed, G.gateDist / 0.38);
    if (G.trick.grind) startGrind();
    if (SNAP_STREAKS.indexOf(G.streak) >= 0) { var snapStreak = G.streak, perf = G.trick; setTimeout(function () { takeSnapshot(snapStreak, perf); }, 60); }
    el.banner.className = 'right'; flashDisplay('flashR');
    if (settings.mode === 'choices') el.choices.forEach(function (b) { if (Number(b.textContent) === p.answer) b.classList.add('good'); });
    pop('+' + pts + '  ' + G.trick.name, '#ffc94d');
    if (m > 1 && (G.streak === 3 || G.streak === 6 || G.streak === 9 || G.streak === 12)) pop('x' + m + ' MULTIPLIER!', '#ff7a3d');
    sfx.good(); setPhase('boost'); updateHUD();
  }
  function onWrong(reason, val) {
    var p = G.prob; G.streak = 0; G.wrong++; recordMiss(p); G.lastWasGrind = false;
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
    // coins + milestone stats (only for finished rounds)
    var before = getStats(), cp = G.coinParts;
    if (total >= COINS.accuracyMinAnswers && acc >= COINS.accuracyMin) cp.bonus += COINS.accuracyBonus;
    if (isNew) cp.bonus += COINS.bestBonus;
    var earned = cp.answers + cp.streak + cp.grinds + cp.bonus; setCoins(getCoins() + earned);
    var after = { bestStreak: Math.max(before.bestStreak, G.topStreak), grinds: before.grinds + G.roundGrinds, rounds: before.rounds + 1,
      l5acc80: before.l5acc80 || (lv.id === 5 && total >= 8 && acc >= 80), l5bestAcc: lv.id === 5 && total >= 8 ? Math.max(before.l5bestAcc, acc) : before.l5bestAcc };
    store.set('stats', after);
    $('#eCoins').textContent = '+' + earned;
    var parts = []; if (cp.answers) parts.push(cp.answers + ' answers'); if (cp.streak) parts.push(cp.streak + ' streak'); if (cp.grinds) parts.push(cp.grinds + ' grinds'); if (cp.bonus) parts.push(cp.bonus + ' bonus');
    $('#eCoinLine').textContent = (parts.length ? parts.join(' · ') + ' · ' : '') + 'total ' + getCoins();
    var newly = GEAR.filter(function (it) { return it.unlock && !achieved(it.unlock, before) && achieved(it.unlock, after); });
    var ul = $('#eUnlock'); ul.textContent = newly.length ? 'UNLOCKED in the shop: ' + newly.map(function (it) { return it.name; }).join(', ') + '!' : ''; ul.classList.toggle('show', newly.length > 0);
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
      // grinds run slightly longer than other tricks; don't charge the round clock for the extra
      if (!(G.phase === 'boost' && G.trick && G.trick.grind && G.phaseT > 0.85)) G.timeLeft -= dt;
      if (G.timeLeft <= 0) { G.timeLeft = 0; updateHUD(); endRound(); return; }
      if (G.phase === 'ready') {
        G.speed = BASE_SPEED; if (G.phaseT > 0.6 && el.prompt.textContent !== 'GO!') { el.prompt.textContent = 'GO!'; sfx.go(); }
        if (G.phaseT > 1.1) newProblem();
      } else if (G.phase === 'ask') {
        G.gateDist -= G.speed * dt; el.gateBar.style.width = (clamp(G.gateDist / G.gateTotal, 0, 1) * 100) + '%';
        if (G.gateDist <= 0) { G.gateDist = 0; onWrong('time'); }
      } else if (G.phase === 'boost' && G.trick && G.trick.grind) {
        var t0 = G.trickT; G.trickT += dt;
        var d = grindTravel(G.trickT) - grindTravel(t0); spd = d / dt;
        G.grindTrav += d; G.gateDist -= d;
        if (G.gateDist <= 0 && !G.passed) { G.passed = true; burst(riderX() + 10, GROUND_Y - 70, 18, ['#19c3c0', '#ffc94d', '#ff4f8b', '#fff'], 110); }
        if (G.trickT > GRIND.land && G.trickT < GRIND.off) sparks(riderX() - 10, GROUND_Y - GRIND.railH, 4);
        if (G.trickT >= GRIND.land && t0 < GRIND.land) { sparks(riderX(), GROUND_Y - GRIND.railH, 10); tone(1400, 0.05, 'square', 0.03); }
        if (G.gateDist > 0 && G.phaseT > 0.7) G.gateFade = Math.max(0, 1 - (G.phaseT - 0.7) / 0.25);
        if (G.phaseT > GRIND.phase) { G.passed = false; G.trick = null; newProblem(); }
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
    if (G.phase === 'boost' && G.trick && G.trick.grind) drawRail(rx);
    var r = dress(rider()), pose;
    if (G.phase === 'wipe' && G.wipeT >= 0) pose = wipePose(clamp(G.wipeT / 1.7, 0, 1));
    else if (G.trick && G.phase === 'boost' && G.trick.grind) pose = grindPose(G.trick, G.trickT);
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
    if (G.screen === 'expired') return;
    if (G.screen === 'shop') { if (e.key === 'Escape') closeShop(); return; }
    if (G.screen === 'album') { if (e.key === 'Escape') { if (viewing) closeViewer(); else closeAlbum(); } return; }
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
    $('#coinTotal').textContent = getCoins(); refreshAlbumCount();
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
      drawRider(x, w / 2 - 4, h - 12, h / 150, dress(pv.r), sel ? trickPose(pv.r.tricks[1].id, (G.t * 0.55) % 1.6 < 0.8 ? ((G.t * 0.55) % 1.6) / 0.8 : 0) : idlePose(G.t));
    });
  }


  // ---------- gear shop UI ----------
  var shopCat = 'shirt', shopCards = [];
  var PREVIEW = { shirt: { k: 1 / 118, gy: 0.93 }, helmet: { k: 1 / 42, gy: 2.3 }, board: { k: 1 / 70, gy: 0.9 }, scooter: { k: 1 / 100, gy: 0.93 } };
  function previewRider(cat) { var c = GEAR_CATS.filter(function (x) { return x.id === cat; })[0]; return riderById(c && c.rider ? c.rider : settings.rider); }
  function openShop() {
    if (pilotExpired()) { showPilotEnded(); return; }
    G.screen = 'shop'; el.menu.classList.remove('show'); $('#shop').classList.add('show'); buildShop();
  }
  function closeShop() { $('#shop').classList.remove('show'); toMenu(); }
  function buildShop() {
    $('#shopCoins').textContent = getCoins();
    var tabs = $('#shopTabs'); tabs.innerHTML = '';
    GEAR_CATS.forEach(function (c) {
      var b = document.createElement('button'); b.textContent = c.name; b.setAttribute('data-cat', c.id); if (c.id === shopCat) b.className = 'sel';
      b.addEventListener('click', function () { shopCat = c.id; buildShop(); $('#shopGrid').scrollTop = 0; });
      tabs.appendChild(b);
    });
    var cat = GEAR_CATS.filter(function (x) { return x.id === shopCat; })[0];
    $('#shopHint').textContent = cat.rider ? 'For the ' + riderById(cat.rider).name.toLowerCase() + '.' : 'Works on every ride. Preview shows your ' + riderById(settings.rider).name.toLowerCase() + '.';
    var grid = $('#shopGrid'); grid.innerHTML = ''; shopCards = [];
    var stats = getStats(), coins = getCoins();
    GEAR.filter(function (it) { return it.cat === shopCat; }).forEach(function (it) {
      var card = document.createElement('div'), own = owns(it.id), eq = gear.equipped[it.cat] === it.id, unlocked = isUnlocked(it, stats);
      card.className = 'item' + (eq ? ' equipped' : own ? ' owned' : '') + (!unlocked ? ' locked' : ''); card.setAttribute('data-id', it.id);
      var cv2 = document.createElement('canvas'); card.appendChild(cv2);
      var nm = document.createElement('div'); nm.className = 'iname'; nm.textContent = it.name; card.appendChild(nm);
      var stt = document.createElement('div'); stt.className = 'istat';
      var btn = document.createElement('button'); btn.className = 'ibtn';
      if (eq) { stt.textContent = 'Equipped'; btn.textContent = 'EQUIPPED'; btn.disabled = true; }
      else if (own) { stt.textContent = 'Owned'; btn.textContent = 'EQUIP'; btn.classList.add('equip'); btn.addEventListener('click', function () { gear.equipped[it.cat] = it.id; saveGear(); sfx.tap(); buildShop(); }); }
      else if (!unlocked) {
        var a = ACHIEVEMENTS[it.unlock], pr = a.progress(stats);
        stt.innerHTML = '<span class="req">🔒 ' + a.text + '</span><span class="prog">' + pr[0].toLocaleString('en-US') + (a.unit || '') + ' / ' + pr[1].toLocaleString('en-US') + (a.unit || '') + ' · then <i class="coin"></i>' + it.price + '</span>';
        btn.textContent = 'LOCKED'; btn.disabled = true;
      } else {
        stt.innerHTML = '<i class="coin"></i>' + it.price + (coins < it.price ? ' <span class="need">need ' + (it.price - coins) + ' more</span>' : '');
        btn.innerHTML = 'BUY <i class="coin"></i>' + it.price; btn.classList.add('buy'); btn.disabled = coins < it.price;
        btn.addEventListener('click', function () {
          if (getCoins() < it.price || !isUnlocked(it) || owns(it.id)) return;
          setCoins(getCoins() - it.price); gear.owned.push(it.id); saveGear(); sfx.good(); buildShop();
        });
      }
      card.appendChild(stt); card.appendChild(btn); grid.appendChild(card);
      var eqOverride = {}; for (var k in gear.equipped) eqOverride[k] = gear.equipped[k]; eqOverride[it.cat] = it.id;
      shopCards.push({ c: cv2, r: previewRider(it.cat), eq: eqOverride, cat: it.cat });
    });
  }
  function drawShopPreviews() {
    shopCards.forEach(function (pv, i) {
      var c = pv.c, w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
      var d = Math.min(window.devicePixelRatio || 1, 3); if (c.width !== Math.round(w * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
      var x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0);
      var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#4a1d5e'); g.addColorStop(0.75, '#d2505a'); g.addColorStop(1, '#ffb35c');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      var P = PREVIEW[pv.cat] || PREVIEW.shirt, gy = h * P.gy;
      x.fillStyle = '#26143a'; x.fillRect(0, gy, w, h);
      drawRider(x, w / 2 - (pv.cat === 'helmet' ? 6 : 2), gy, h * P.k, dress(pv.r, pv.eq), idlePose(G.t + i * 0.7));
    });
  }
  $('#shopBtn').addEventListener('click', openShop);
  $('#shopBack').addEventListener('click', closeShop);
  $('#shopClose').addEventListener('click', closeShop);


  // ---------- snapshot album ----------
  // At streaks in SNAP_STREAKS a photo card of the rider (equipped gear, frozen mid-trick) is drawn on an
  // offscreen canvas, saved as a JPEG data URL in localStorage (tt_album, max ALBUM_CAP, oldest dropped).
  // The trick on the card is always one not yet in the album for that ride; once all are used,
  // it just avoids repeating the most recent one. Nothing is uploaded anywhere.
  var SNAP_STREAKS = [5, 10, 15, 20], ALBUM_CAP = 30, SNAP_W = 600, SNAP_H = 800, SNAP_Q = 0.72;
  function getAlbum() { try { var a = JSON.parse(localStorage.getItem('tt_album') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function saveAlbum(a) {
    while (a.length > ALBUM_CAP) a.shift();
    for (;;) {
      try { localStorage.setItem('tt_album', JSON.stringify(a)); return true; }
      catch (e) { if (a.length <= 1) return false; a.shift(); }   // storage full: drop oldest and retry
    }
  }
  function rideTricks(r) { return r.tricks.concat(r.grinds || []); }
  function chooseSnapTrick(r, performed, album) {
    var all = rideTricks(r), mine = album.filter(function (e) { return e.rider === r.id; });
    var used = mine.map(function (e) { return e.trick; });
    var opts = all.filter(function (t) { return used.indexOf(t.id) < 0; });
    if (!opts.length) { var lastId = mine.length ? mine[mine.length - 1].trick : null; opts = all.filter(function (t) { return t.id !== lastId; }); }
    for (var i = 0; i < opts.length; i++) if (performed && opts[i].id === performed.id) return opts[i];
    return pick(opts);
  }
  function peakPose(trick) { return trick.grind ? grindPose(trick, 0.46) : trickPose(trick.id, trick.id === 'ollie' || trick.id === 'hop' ? 0.42 : 0.5); }
  function fmtDate(ms) { try { return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { var d = new Date(ms); return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear(); } }
  function renderSnapCard(dressedRider, trick, entry) {
    var W = SNAP_W, H = SNAP_H, cnv = document.createElement('canvas'); cnv.width = W; cnv.height = H;
    var x = cnv.getContext('2d');
    var saved = { ctx: ctx, VW: VW, TOP: TOP, wx: G.worldX, parts: G.particles };
    var LVW = 260, k = W / LVW, LVH = H / k, rx = LVW * 0.5;
    try {
      ctx = x; VW = LVW; TOP = 400 - LVH; G.worldX = 400 + Math.random() * 2600; G.particles = [];
      x.setTransform(k, 0, 0, k, 0, -TOP * k);
      drawSky(entry.t / 1000);
      drawCity(farCity, 0.08, GROUND_Y - 10, '#3d1d52', 'rgba(255,190,120,0.35)', 0);
      drawCity(nearCity, 0.25, GROUND_Y - 4, '#26143a', 'rgba(255,210,130,0.55)', 300);
      drawProps(); drawLamps(); drawGround();
      // motion streaks
      x.strokeStyle = 'rgba(255,255,255,0.28)'; x.lineWidth = 1.6; x.lineCap = 'round';
      for (var i = 0; i < 6; i++) { var ly = GROUND_Y - 40 - i * 16, lx = rx - 70 - (i % 3) * 18; x.beginPath(); x.moveTo(lx, ly); x.lineTo(lx - 40 - (i % 2) * 20, ly); x.stroke(); }
      if (trick.grind) {
        drawRailAt(rx - 100, rx + 100, 1);
        x.fillStyle = '#ffe28a';
        for (var s = 0; s < 18; s++) { var sx = rx - 14 - Math.random() * 40, sy = GROUND_Y - GRIND.railH - Math.random() * 14; x.fillRect(sx, sy, 1.6, 1.6); }
      }
      drawRider(x, rx, GROUND_Y, RIDER_SCALE * 1.05, dressedRider, peakPose(trick));
    } finally { ctx = saved.ctx; VW = saved.VW; TOP = saved.TOP; G.worldX = saved.wx; G.particles = saved.parts; }
    // overlays in pixel space
    x.setTransform(1, 0, 0, 1, 0, 0);
    var tg = x.createLinearGradient(0, 0, 0, 200); tg.addColorStop(0, 'rgba(20,10,38,0.75)'); tg.addColorStop(1, 'rgba(20,10,38,0)'); x.fillStyle = tg; x.fillRect(0, 0, W, 200);
    var bg = x.createLinearGradient(0, H - 190, 0, H); bg.addColorStop(0, 'rgba(20,10,38,0)'); bg.addColorStop(0.45, 'rgba(20,10,38,0.8)'); bg.addColorStop(1, 'rgba(20,10,38,0.95)'); x.fillStyle = bg; x.fillRect(0, H - 190, W, 190);
    // streak badge
    var bgrad = x.createLinearGradient(0, 28, 0, 100); bgrad.addColorStop(0, '#ffb35c'); bgrad.addColorStop(1, '#ff4f8b');
    x.save(); x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = 14; x.shadowOffsetY = 4;
    roundRectC(x, 28, 28, 300, 74, 18); x.fillStyle = bgrad; x.fill(); x.restore();
    x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,0.8)'; roundRectC(x, 28, 28, 300, 74, 18); x.stroke();
    x.fillStyle = '#fff'; x.font = 'italic 900 46px ' + fontFam; x.textBaseline = 'middle'; x.textAlign = 'center';
    x.fillText('STREAK ' + entry.streak, 178, 67);
    // trick name
    x.textAlign = 'left'; x.font = 'italic 900 50px ' + fontFam; x.lineWidth = 8; x.strokeStyle = '#1a1030'; x.lineJoin = 'round';
    var tn = trick.name; while (x.measureText(tn).width > W - 60 && parseInt(x.font.match(/(\d+)px/)[1], 10) > 26) x.font = 'italic 900 ' + (parseInt(x.font.match(/(\d+)px/)[1], 10) - 4) + 'px ' + fontFam;
    x.strokeText(tn, 30, 150); x.fillStyle = '#ffc94d'; x.fillText(tn, 30, 150);
    // footer
    var lg = x.createLinearGradient(0, H - 110, 0, H - 70); lg.addColorStop(0, '#ffe08a'); lg.addColorStop(1, '#ff7a3d');
    x.font = 'italic 900 34px ' + fontFam; x.fillStyle = lg; x.fillText('TIMES', 30, H - 92);
    var w1 = x.measureText('TIMES ').width, lg2 = x.createLinearGradient(0, H - 110, 0, H - 70); lg2.addColorStop(0, '#8ff5ee'); lg2.addColorStop(1, '#19c3c0');
    x.fillStyle = lg2; x.fillText('TRICKS', 30 + w1, H - 92);
    x.font = '700 22px ' + fontFam; x.fillStyle = '#e6dcf7';
    x.fillText(fmtDate(entry.t) + '  ·  Level ' + entry.level + ': ' + entry.levelName, 30, H - 52);
    x.textAlign = 'right'; x.font = '800 20px ' + fontFam; x.fillStyle = '#b9a8d8'; x.fillText(dressedRider.name.toUpperCase(), W - 30, H - 92);
    // frame
    x.lineWidth = 4; x.strokeStyle = 'rgba(255,255,255,0.35)'; roundRectC(x, 10, 10, W - 20, H - 20, 22); x.stroke();
    return cnv.toDataURL('image/jpeg', SNAP_Q);
  }
  function takeSnapshot(streak, performed) {
    var r = rider(), album = getAlbum(), trick = chooseSnapTrick(r, performed, album), now = Date.now();
    var entry = { id: now.toString(36) + Math.random().toString(36).slice(2, 6), t: now, rider: r.id, trick: trick.id, trickName: trick.name, streak: streak, level: settings.level, levelName: level().name };
    try { entry.img = renderSnapCard(dress(r), trick, entry); } catch (e) { console.warn('snapshot failed', e); return null; }
    album.push(entry);
    if (!saveAlbum(album)) return null;
    showSnapToast(); refreshAlbumCount();
    return entry;
  }
  var toastTimer = null;
  function showSnapToast() {
    var t = $('#snapToast'); t.classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }
  function refreshAlbumCount() { var n = getAlbum().length; $('#albumCount').textContent = n; $('#albumCount').classList.toggle('hidden', !n); }

  // album screens
  function openAlbum() {
    if (pilotExpired()) { showPilotEnded(); return; }
    G.screen = 'album'; el.menu.classList.remove('show'); $('#album').classList.add('show'); buildAlbum();
  }
  function closeAlbum() { closeViewer(); $('#album').classList.remove('show'); toMenu(); }
  function buildAlbum() {
    var a = getAlbum().slice().reverse(), grid = $('#albumGrid'); grid.innerHTML = '';
    $('#albumSub').textContent = a.length ? a.length + ' of ' + ALBUM_CAP + ' snapshots · newest first' : '';
    $('#albumEmpty').classList.toggle('hidden', a.length > 0);
    a.forEach(function (e) {
      var b = document.createElement('button'); b.className = 'snap'; b.setAttribute('data-id', e.id);
      var im = document.createElement('img'); im.src = e.img; im.alt = 'Streak ' + e.streak + ' ' + e.trickName; b.appendChild(im);
      var cap = document.createElement('span'); cap.textContent = 'STREAK ' + e.streak + ' · ' + e.trickName; b.appendChild(cap);
      b.addEventListener('click', function () { openViewer(e.id); });
      grid.appendChild(b);
    });
  }
  var viewing = null, delArmed = false, delTimer = null;
  function openViewer(id) {
    var e = getAlbum().filter(function (x) { return x.id === id; })[0]; if (!e) return;
    viewing = e; delArmed = false; $('#delSnap').textContent = 'DELETE'; $('#delSnap').classList.remove('armed');
    $('#viewImg').src = e.img;
    $('#viewCap').textContent = 'Streak ' + e.streak + ' · ' + e.trickName + ' · ' + fmtDate(e.t) + ' · Level ' + e.level;
    $('#saveHint').textContent = 'Tip: you can also press and hold the picture to save it.';
    $('#viewer').classList.add('show');
  }
  function closeViewer() { $('#viewer').classList.remove('show'); viewing = null; }
  function dataURLtoBlob(u) { var p = u.split(','), bin = atob(p[1]), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: 'image/jpeg' }); }
  function saveViewing() {
    if (!viewing) return;
    var name = 'times-tricks-streak' + viewing.streak + '-' + viewing.trick + '.jpg', file = null;
    try { file = new File([dataURLtoBlob(viewing.img)], name, { type: 'image/jpeg' }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Times Tricks snapshot' }).catch(function () {});  // share sheet → "Save Image"
      return;
    }
    var a = document.createElement('a'); a.href = viewing.img; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) $('#saveHint').textContent = 'Press and hold the picture, then tap “Save to Photos”.';
    else $('#saveHint').textContent = 'Saved to your downloads.';
  }
  function deleteViewing() {
    if (!viewing) return;
    if (!delArmed) { delArmed = true; $('#delSnap').textContent = 'TAP AGAIN TO DELETE'; $('#delSnap').classList.add('armed'); clearTimeout(delTimer); delTimer = setTimeout(function () { delArmed = false; $('#delSnap').textContent = 'DELETE'; $('#delSnap').classList.remove('armed'); }, 3000); return; }
    var id = viewing.id; saveAlbum(getAlbum().filter(function (x) { return x.id !== id; }));
    closeViewer(); buildAlbum(); refreshAlbumCount();
  }
  $('#albumBtn').addEventListener('click', openAlbum);
  $('#albumBack').addEventListener('click', closeAlbum);
  $('#albumClose').addEventListener('click', closeAlbum);
  $('#viewBack').addEventListener('click', closeViewer);
  $('#saveSnap').addEventListener('click', saveViewing);
  $('#delSnap').addEventListener('click', deleteViewing);

  // ---------- loop ----------
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    try { update(dt); render(); if (G.screen === 'menu') drawPreviews(); else if (G.screen === 'shop') drawShopPreviews(); } catch (err) { console.error(err); }
    requestAnimationFrame(frame);
  }
  // ===== PILOT / PREVIEW LINK GATE =====
  // Same style as Math Trail: ?pilot=<name>&until=YYYY-MM-DD. The link works through the END of the
  // `until` day in US Central time (America/Chicago), then shows an "expired" screen instead of the game.
  // Without both params (or with a malformed date) the game plays normally, exactly like Math Trail.
  var PILOT_TZ = 'America/Chicago';
  function tzOffsetMs(ms, tz) { // (wall-clock time in tz) - UTC, in ms
    var f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var p = {}; f.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
  }
  function parseUntil(raw) {
    if (!raw) return null;
    var m = String(raw).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3], chk = new Date(Date.UTC(y, mo - 1, d));
    if (chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== d) return null;
    var nextMidnightUTC = Date.UTC(y, mo - 1, d + 1, 0, 0, 0), off;
    try { off = tzOffsetMs(nextMidnightUTC - 6 * 3600e3, PILOT_TZ); } catch (e) { off = -5 * 3600e3; } // fallback CDT
    return { ms: nextMidnightUTC - off - 1, y: y, mo: mo, d: d };   // 23:59:59.999 Central on the until day
  }
  var pilot = null;
  (function () {
    var q; try { q = new URLSearchParams(window.location.search || ''); } catch (e) { return; }
    var name = q.get('pilot'), until = parseUntil(q.get('until'));
    if (name && until) pilot = { name: name, until: until };
  })();
  function pilotExpired() { return !!pilot && Date.now() > pilot.until.ms; }
  function showPilotEnded() {
    G.screen = 'expired'; setPhase('idle');
    [el.menu, el.end, el.pause, $('#shop'), $('#album'), $('#viewer')].forEach(function (o) { o.classList.remove('show'); });
    el.banner.className = 'hide'; $('#pilotEnded').classList.add('show');
  }
  function pilotLabel() {
    var u = pilot.until, dt = new Date(Date.UTC(u.y, u.mo - 1, u.d, 12));
    var s; try { s = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }); } catch (e) { s = u.mo + '/' + u.d; }
    return 'Preview link · plays through ' + s + ' (Central time)';
  }
  window.__tt.pilot = function () { return pilot && { name: pilot.name, untilISO: new Date(pilot.until.ms).toISOString(), expired: pilotExpired() }; };
  if (pilot && !pilotExpired()) { var pb = $('#pilotBanner'); pb.textContent = pilotLabel(); pb.classList.remove('hidden'); }
  // re-check every 30s so an open tab stops at the deadline (between rounds, never mid-round)
  if (pilot) setInterval(function () { if (pilotExpired() && G.screen !== 'play' && G.screen !== 'expired') showPilotEnded(); }, 30000);

  buildMenu(); refreshMenu(); applyMode(); resize(); updateHUD(); el.banner.className = 'hide';
  if (pilotExpired()) showPilotEnded();
  requestAnimationFrame(frame);
})();
