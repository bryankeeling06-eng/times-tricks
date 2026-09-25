/* Times Tricks — multiplication street runner. Plain JS, no dependencies. */
(function () {
  'use strict';

  // ---------- storage ----------
  // All small saves go through store. set() returns true only if the write stuck (a full quota,
  // Safari private mode etc. return false instead of throwing).
  var SAVE_V = 2;   // save schema version. Saves from v7 and older have no stamp (= version 1).
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('tt_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('tt_' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    remove: function (k) { try { localStorage.removeItem('tt_' + k); return true; } catch (e) { return false; } }
  };
  // Type-checked loaders: a missing, corrupt or wrong-type saved value falls back to the default.
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function num(v, d) { if (typeof v === 'string' && v.trim() !== '') v = Number(v); return typeof v === 'number' && isFinite(v) ? v : d; }
  function str(v, d) { return typeof v === 'string' ? v : d; }
  // A save written by a NEWER version of the game: read what we understand, but never write gear/stats back
  // (that would throw away whatever the newer version added).
  var saveTooNew = num(store.get('save_v', 0), 0) > SAVE_V || num(obj(store.get('stats', null)).v, 0) > SAVE_V || num(obj(store.get('gear', null)).v, 0) > SAVE_V;
  if (!saveTooNew) store.set('save_v', SAVE_V);

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
    },
    {
      id: 'bmx', name: 'BMX', gearCat: 'bmx', unlock: 'r_bmx',
      hoodie: '#ff9a3d', hoodieDark: '#c8661c', deck: '#ffe04d',
      stance: { feet: [[-9, -14], [5, -18]], hip: [-5, -47], shoulder: [5, -72], hands: [[11, -61], [14, -61]], elbow: [-1, 1] },
      tricks: [
        { id: 'hop', name: 'BUNNY HOP' }, { id: 'tabletop', name: 'TABLETOP' }, { id: 'barspin', name: 'BAR SPIN' },
        { id: 'threesixty', name: '360' }, { id: 'tailwhip', name: 'TAILWHIP' }
      ],
      grinds: [
        { id: 'bdpeg', name: 'DOUBLE-PEG GRIND', grind: true, contact: 14, style: { bodyRot: -0.04 } },
        { id: 'bfeeble', name: 'FEEBLE GRIND', grind: true, contact: 14, style: { boardRot: -0.12, bodyRot: -0.08 } }
      ],
      drawVehicle: drawBMX
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
    { id: 'scooter', name: 'Scooters', rider: 'scooter' },
    { id: 'bmx', name: 'BMX', rider: 'bmx' }
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
    { id: 'shirt_sky', cat: 'shirt', name: 'Sky Tee', price: 30, color: '#6cc6ff', dark: '#3a8fd0', unlock: 'e_streak5' },
    { id: 'shirt_sunrise', cat: 'shirt', name: 'Sunrise Tee', price: 35, color: '#ff9a3d', dark: '#c8661c', unlock: 'e_grind1' },
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
    { id: 'helm_mint', cat: 'helmet', name: 'Mint Racer', price: 30, color: '#7ff0c8', pattern: 'stripe', accent: '#16121f', unlock: 'e_rounds3' },
    { id: 'helm_camo', cat: 'helmet', name: 'Camo', price: 170, color: '#5b6b3a', pattern: 'camo', accent: '#2f3a22', unlock: 'm_acc90' },
    { id: 'helm_diamond', cat: 'helmet', name: 'Diamond', price: 300, color: '#bfefff', pattern: 'diamond', unlock: 'b_perfect5' },
    { id: 'helm_chrome', cat: 'helmet', name: 'Chrome Dome', price: 220, color: '#c9ceda', pattern: 'chrome', unlock: 'l3pb' },
    // Skateboards
    { id: 'board_classic', cat: 'board', name: 'Classic Orange', price: 0, deck: '#ff7a3d', wheel: '#f4e9d8' },
    { id: 'board_black', cat: 'board', name: 'Blackout', price: 40, deck: '#23202e', wheel: '#e8394a', pattern: 'stripe', accent: '#e8394a' },
    { id: 'board_neon', cat: 'board', name: 'Neon Wheels', price: 60, deck: '#19c3c0', wheel: '#9dff3c', wheelGlow: true },
    { id: 'board_split', cat: 'board', name: 'Sunset Split', price: 90, deck: '#ff4f8b', accent: '#ffb35c', pattern: 'split', wheel: '#ffe04d' },
    { id: 'board_checker', cat: 'board', name: 'Checker Deck', price: 110, deck: '#f2f2f7', accent: '#16121f', pattern: 'checker', wheel: '#f2f2f7' },
    { id: 'board_flame', cat: 'board', name: 'Flame Deck', price: 150, deck: '#c7283a', accent: '#ffb35c', pattern: 'flames', wheel: '#ff9a3d' },
    { id: 'board_flamewheels', cat: 'board', name: 'Flame Wheels', price: 170, deck: '#16121f', accent: '#ff7a3d', pattern: 'flames', wheel: '#ff7a3d', wheelGlow: true, unlock: 'm_alllevels' },
    { id: 'board_holo', cat: 'board', name: 'Holo Deck', price: 300, deck: '#ff4f8b', pattern: 'holo', wheel: '#ffffff', wheelGlow: true, unlock: 'b_streak30' },
    { id: 'board_galaxy', cat: 'board', name: 'Galaxy Deck', price: 240, deck: '#3b1f7a', accent: '#ffffff', pattern: 'stars', wheel: '#8ff5ee', wheelGlow: true, unlock: 'grinds10' },
    // Scooters
    { id: 'scoot_classic', cat: 'scooter', name: 'Classic Teal', price: 0, deck: '#19c3c0', bar: '#d9dbe8', wheel: '#16121f' },
    { id: 'scoot_black', cat: 'scooter', name: 'Blackout', price: 40, deck: '#23202e', bar: '#4a4a5c', wheel: '#e8394a' },
    { id: 'scoot_red', cat: 'scooter', name: 'Candy Red', price: 60, deck: '#e8394a', bar: '#f2f2f7', wheel: '#16121f' },
    { id: 'scoot_lime', cat: 'scooter', name: 'Lime Rider', price: 80, deck: '#9be23c', bar: '#23202e', wheel: '#9be23c' },
    { id: 'scoot_purple', cat: 'scooter', name: 'Purple Haze', price: 100, deck: '#8a4dff', bar: '#ffc94d', wheel: '#16121f', pattern: 'stripe', accent: '#ffc94d' },
    { id: 'scoot_checker', cat: 'scooter', name: 'Checker', price: 130, deck: '#f2f2f7', accent: '#16121f', pattern: 'checker', bar: '#16121f', wheel: '#f2f2f7' },
    { id: 'scoot_spark', cat: 'scooter', name: 'Rail Spark', price: 200, deck: '#ff7a3d', accent: '#ffe04d', pattern: 'flames', bar: '#ff7a3d', wheel: '#9dff3c', wheelGlow: true, unlock: 'grinds10' },
    { id: 'scoot_neonbar', cat: 'scooter', name: 'Neon Bars', price: 180, deck: '#23202e', bar: '#39ffd8', barGlow: true, wheel: '#39ffd8', wheelGlow: true, unlock: 'm_grinds25' },
    { id: 'scoot_royal', cat: 'scooter', name: 'Royal Gold', price: 300, deck: '#ffc94d', accent: '#ffffff', pattern: 'stars', bar: '#ffc94d', barGlow: true, wheel: '#ffc94d', wheelGlow: true, unlock: 'b_perfect5' },
    { id: 'scoot_gold', cat: 'scooter', name: 'Gold Rush', price: 250, deck: '#23202e', accent: '#ffc94d', pattern: 'stripe', bar: '#ffc94d', wheel: '#ffc94d', unlock: 'l5acc80' },
    // BMX (frame, tire, optional bar / pattern)
    { id: 'bmx_classic', cat: 'bmx', name: 'Classic Yellow', price: 0, frame: '#ffe04d', tire: '#16121f' },
    { id: 'bmx_black', cat: 'bmx', name: 'Blackout', price: 40, frame: '#23202e', tire: '#e8394a', bar: '#e8394a' },
    { id: 'bmx_red', cat: 'bmx', name: 'Race Red', price: 60, frame: '#e8394a', tire: '#f2f2f7' },
    { id: 'bmx_teal', cat: 'bmx', name: 'Teal Tires', price: 70, frame: '#f2f2f7', tire: '#19c3c0', bar: '#19c3c0' },
    { id: 'bmx_purple', cat: 'bmx', name: 'Purple Stripe', price: 100, frame: '#8a4dff', tire: '#16121f', pattern: 'stripe', accent: '#ffc94d', bar: '#ffc94d' },
    { id: 'bmx_neon', cat: 'bmx', name: 'Neon Tires', price: 130, frame: '#23202e', tire: '#9dff3c', wheelGlow: true, bar: '#9dff3c' },
    { id: 'bmx_holo', cat: 'bmx', name: 'Holo Frame', price: 300, frame: '#ff4f8b', pattern: 'holo', tire: '#ffffff', wheelGlow: true, bar: '#ffffff', unlock: 'b_streak30' }
  ];
  var GEAR_BY_ID = {}; GEAR.forEach(function (g) { GEAR_BY_ID[g.id] = g; });
  function catDefault(cat) { for (var i = 0; i < GEAR.length; i++) if (GEAR[i].cat === cat && GEAR[i].price === 0) return GEAR[i]; }

  // ======================================================================
  // GOALS ladder (Easy / Medium / Big). Each goal: id, tier, text, label, progress(stats) -> [current, goal].
  // Rewards are data-driven: any GEAR item, PLACE or RIDER with unlock: '<goal id>' is its reward.
  // ======================================================================
  var L3_PB_GOAL = 6000;
  var GOAL_TIERS = [{ id: 'easy', name: 'Easy' }, { id: 'medium', name: 'Medium' }, { id: 'big', name: 'Big' }];
  function upTo(v, n) { return [Math.min(v, n), n]; }
  var GOALS = [
    { id: 'e_streak5', tier: 'easy', text: 'Hit your first 5-streak', label: 'Best streak', progress: function (s) { return upTo(s.bestStreak, 5); } },
    { id: 'e_rounds3', tier: 'easy', text: 'Play 3 rounds', label: 'Rounds', progress: function (s) { return upTo(s.rounds, 3); } },
    { id: 'e_grind1', tier: 'easy', text: 'Land your first grind', label: 'Grinds', progress: function (s) { return upTo(s.grinds, 1); } },
    { id: 'grinds10', tier: 'easy', text: 'Land 10 grinds', label: 'Grinds', progress: function (s) { return upTo(s.grinds, 10); } },
    { id: 'p_beach', tier: 'easy', text: 'Play 10 rounds', label: 'Rounds', progress: function (s) { return upTo(s.rounds, 10); } },
    { id: 'm_acc90', tier: 'medium', text: 'Get 90%+ accuracy on any level (8+ answers)', label: 'Best accuracy', unit: '%', progress: function (s) { return upTo(s.bestAcc, 90); } },
    { id: 'm_alllevels', tier: 'medium', text: 'Finish a round on every level (1–5)', label: 'Levels finished', progress: function (s) { return upTo(s.levelsDone.length, 5); } },
    { id: 'r_bmx', tier: 'medium', text: 'Hit a 15-streak', label: 'Best streak', progress: function (s) { return upTo(s.bestStreak, 15); } },
    { id: 'm_grinds25', tier: 'medium', text: 'Land 25 grinds', label: 'Grinds', progress: function (s) { return upTo(s.grinds, 25); } },
    { id: 'streak20', tier: 'medium', text: 'Hit a 20-streak', label: 'Best streak', progress: function (s) { return upTo(s.bestStreak, 20); } },
    { id: 'l5acc80', tier: 'medium', text: 'Finish a Level 5 round with 80%+ accuracy (8+ answers)', label: 'Level 5 best accuracy', unit: '%', progress: function (s) { return [s.l5acc80 ? 80 : Math.min(s.l5bestAcc, 79), 80]; } },
    { id: 'l3pb', tier: 'medium', text: 'Score ' + L3_PB_GOAL.toLocaleString('en-US') + '+ on Level 3', label: 'Level 3 best', progress: function (s) { return upTo(s.best3, L3_PB_GOAL); } },
    // Big streak goal (fix-set 3): a 20-streak on Level 3, 4 or 5. The id stays 'b_streak30' so its rewards and saves
    // carry over; kids who already hit a 30-streak under the old rule keep it (old30, stamped once, see getStats).
    { id: 'b_streak30', tier: 'big', text: 'Hit a 20-streak on Level 3 or higher', label: 'Best streak on Levels 3\u20135', progress: function (s) { return s.old30 ? [20, 20] : upTo(s.streakL3, 20); } },
    { id: 'b_perfect5', tier: 'big', text: 'Perfect round on Level 5 (100%, 8+ answers)', label: 'Perfect Level 5 rounds', progress: function (s) { return upTo(s.l5perfect ? 1 : 0, 1); } },
    { id: 'p_night', tier: 'big', text: 'Land 50 grinds', label: 'Grinds', progress: function (s) { return upTo(s.grinds, 50); } }
  ];
  var ACHIEVEMENTS = {}; GOALS.forEach(function (g) { ACHIEVEMENTS[g.id] = g; });
  // Saved stats (tt_stats). This is the ONLY list of stat fields: getStats() reads them (typed) and saveStats()
  // writes them merged over the raw save, so fields this version doesn't know about survive.
  var STAT_FIELDS = { bestStreak: 'num', grinds: 'num', rounds: 'num', bestAcc: 'num', l5bestAcc: 'num', l5acc80: 'bool', l5perfect: 'bool', levelsDone: 'levels', streakL3: 'num', old30: 'bool' };
  function rawStats() { return obj(store.get('stats', {})); }
  function getBest(id) { return Math.max(0, num(store.get('best_' + id, 0), 0)); }
  function readStat(type, v) {
    if (type === 'bool') return v === true;
    if (type === 'levels') { var out = []; arr(v).forEach(function (L) { L = num(L, 0); if (L >= 1 && L <= LEVELS.length && L === Math.floor(L) && out.indexOf(L) < 0) out.push(L); }); return out; }
    return Math.max(0, num(v, 0));
  }
  function getStats() {
    var s = rawStats(), out = {};
    for (var f in STAT_FIELDS) out[f] = readStat(STAT_FIELDS[f], s[f]);
    // saves from before goals v2 have no level info for their best streak: a stored 30+ keeps the old Big goal (and its
    // reward); nothing else is granted, Levels 3+ streaks are tracked from now. The next save stamps goalsV 2.
    if (num(s.goalsV, 0) < 2) out.old30 = out.bestStreak >= 30;
    for (var L = 1; L <= 5; L++) if (getBest(L) > 0 && out.levelsDone.indexOf(L) < 0) out.levelsDone.push(L);   // migrate older saves
    out.best3 = getBest(3);
    return out;
  }
  function saveStats(stats) {
    if (saveTooNew) return false;
    var updates = { goalsV: 2 }; for (var f in STAT_FIELDS) updates[f] = stats[f];
    return store.set('stats', Object.assign({}, rawStats(), updates, { v: SAVE_V }));
  }
  function rewardsFor(id) {
    var out = [];
    GEAR.forEach(function (it) { if (it.unlock === id) out.push({ type: 'gear', name: it.name, kind: GEAR_CATS.filter(function (c) { return c.id === it.cat; })[0].name.replace(/s$/, ''), item: it }); });
    PLACES.forEach(function (p) { if (p.unlock === id) out.push({ type: 'place', name: p.name, kind: 'Place', place: p }); });
    RIDERS.forEach(function (r) { if (r.unlock === id) out.push({ type: 'ride', name: r.name, kind: 'New ride', rider: r }); });
    return out;
  }
  function achieved(id, stats) { var p = ACHIEVEMENTS[id].progress(stats || getStats()); return p[0] >= p[1]; }
  function isUnlocked(item, stats) { return !item.unlock || achieved(item.unlock, stats); }
  function rideUnlocked(r, stats) { return !r.unlock || achieved(r.unlock, stats); }
  function placeUnlocked(p, stats) { return !p.unlock || achieved(p.unlock, stats); }

  // Coins
  var COINS = { perCorrect: 2, perMultStep: 1, grind: 3, accuracyBonus: 5, accuracyMin: 80, accuracyMinAnswers: 8, bestBonus: 10 };
  function getCoins() { return Math.max(0, Math.floor(num(store.get('coins', 0), 0))); }
  function setCoins(v) { return store.set('coins', Math.max(0, Math.floor(num(v, 0)))); }

  // Owned / equipped. The saved data keeps ids this version doesn't know (items or categories from a newer
  // version); they're only filtered where they're used, and written back untouched.
  var gear = (function () {
    var g = obj(store.get('gear', null)), owned = [];
    arr(g.owned).forEach(function (id) { if (typeof id === 'string' && owned.indexOf(id) < 0) owned.push(id); });
    GEAR.forEach(function (it) { if (it.price === 0 && owned.indexOf(it.id) < 0) owned.push(it.id); });
    var saved = obj(g.equipped), eq = {}, keep = {};
    for (var k in saved) if (typeof saved[k] === 'string' && !GEAR_BY_ID[saved[k]]) keep[k] = saved[k];
    GEAR_CATS.forEach(function (c) { var it = GEAR_BY_ID[saved[c.id]]; eq[c.id] = it && it.cat === c.id && owned.indexOf(it.id) >= 0 ? it.id : catDefault(c.id).id; });
    return { owned: owned, equipped: eq, keepEq: keep };
  })();
  function saveGear() {
    if (saveTooNew) return false;
    var eq = Object.assign({}, gear.equipped, gear.keepEq);
    return store.set('gear', Object.assign({}, obj(store.get('gear', null)), { owned: gear.owned, equipped: eq, v: SAVE_V }));
  }
  function owns(id) { return gear.owned.indexOf(id) >= 0; }

  function lookFor(r, eq) {
    eq = eq || gear.equipped;
    var s = GEAR_BY_ID[eq.shirt] || catDefault('shirt'), h = GEAR_BY_ID[eq.helmet] || catDefault('helmet');
    var v = (r.gearCat && (GEAR_BY_ID[eq[r.gearCat]] || catDefault(r.gearCat))) || {};
    return {
      shirt: s.color || r.hoodie, shirtDark: s.dark || r.hoodieDark, stripe: s.stripe || null, glow: s.glow ? (s.color || r.hoodie) : null,
      helmet: h.color, helmetPattern: h.pattern || 'none', helmetAccent: h.accent || r.deck,
      deck: v.deck || r.deck, deckPattern: v.pattern || 'none', deckAccent: v.accent || '#ffffff',
      wheel: v.wheel || '#f4e9d8', wheelGlow: !!v.wheelGlow, bar: v.bar || '#d9dbe8', barGlow: !!v.barGlow,
      frame: v.frame || r.deck, tire: v.tire || '#16121f', framePattern: v.pattern || 'none', frameAccent: v.accent || '#ffffff'
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
  function validFact(f) { return !!f && typeof f === 'object' && (f.kind === 'm' || f.kind === 'd') && typeof f.a === 'number' && isFinite(f.a) && typeof f.b === 'number' && isFinite(f.b) && num(f.n, 0) > 0; }
  function getMissed() { var m = obj(store.get('missed', {})), out = {}; Object.keys(m).forEach(function (k) { if (k !== '__proto__' && validFact(m[k])) out[k] = m[k]; }); return out; }
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
    rider: str(store.get('rider', 'skate'), 'skate'),
    level: clamp(Math.round(num(store.get('level', 1), 1)), 1, LEVELS.length),
    mode: store.get('mode', 'pad') === 'choices' ? 'choices' : 'pad',
    muted: store.get('muted', false) === true,
    place: str(store.get('place', 'street'), 'street')
  };
  var G = {
    screen: 'menu', phase: 'idle', phaseT: 0, paused: false,
    score: 0, streak: 0, topStreak: 0, correct: 0, wrong: 0, timeLeft: ROUND_SECONDS,
    prob: null, lastKey: null, gateDist: 0, gateTotal: 1, gateState: 'none', gateX: 0, gateFade: 1,
    worldX: 0, speed: BASE_SPEED, input: '', choices: [], roundMissed: [],
    trick: null, trickT: 0, wipeT: -1, particles: [], pops: [], t: 0,
    pendingSnaps: []   // snapshot cards earned this round; rendered + saved after the round ends (never during play)
  };
  window.__tt = { G: G, settings: settings, LEVELS: LEVELS, RIDERS: RIDERS };
  window.__tt.forceGrind = false;
  window.__tt.snap = function (streak, trickId) {   // test hook: save a card now (named trick, else the current trick if new, else the first missing one)
    var r = rider(), t = trickId ? rideTricks(r).filter(function (x) { return x.id === trickId; })[0] : null;
    if (!t) { var miss = missingTricks(r); t = G.trick && miss.some(function (x) { return x.id === G.trick.id; }) ? G.trick : (miss[0] || G.trick || collectible(r)[0]); }
    return takeSnapshot(streak || 5, t);
  };
  window.__tt.snapHold = function () { return !!G.snapHold; };
  window.__tt.collectible = function (id) { return collectible(riderById(id || settings.rider)).map(function (t) { return t.id; }); };
  window.__tt.buy = function (id) { return buyItem(id); };
  window.__tt.equip = function (id) { return equipItem(id); };
  window.__tt.endLocked = function () { return endLocked(); };
  window.__tt.album = function () { return albumRun(function () { return album.list.map(function (e) { return { id: e.id, rider: e.rider, trick: e.trick, streak: e.streak, level: e.level, place: e.place || 'street', kb: e.kb }; }); }); };
  window.__tt.albumImgs = function () { return albumImgs(album.list.map(function (e) { return e.id; })).then(function (o) { return album.list.map(function (e) { return o[e.id] || null; }); }); };
  window.__tt.albumInfo = function () { return albumRun(function () { return albumInfo(); }); };
  window.__tt.albumClear = function () { return albumClear(); };
  window.__tt.goals = function () { var st = getStats(); return GOALS.map(function (g) { return { id: g.id, tier: g.tier, done: achieved(g.id, st), p: g.progress(st), rewards: rewardsFor(g.id).map(function (r) { return r.name; }) }; }); };
  window.__tt.pendingSnaps = function () { return G.pendingSnaps.length; };
  window.__tt.gearApi = function () { return { coins: getCoins(), gear: gear, stats: getStats(), look: lookFor(rider()), GEAR: GEAR }; };

  function level() { return LEVELS[settings.level - 1]; }
  function rider() { return riderById(settings.rider); }
  function multiplier() { var s = G.streak; return s >= 12 ? 5 : s >= 9 ? 4 : s >= 6 ? 3 : s >= 3 ? 2 : 1; }
  function speedFactor() { return 1 + Math.min(G.streak, 15) * 0.03; }

  // ---------- audio (tiny WebAudio beeps, no files) ----------
  var actx = null;
  function audio() {
    if (actx && actx.state === 'closed') actx = null;
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    // iOS Safari reports 'interrupted' (not 'suspended') after an app switch or a call, so resume from any non-running state
    if (actx && actx.state !== 'running') { try { var p = actx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
    return actx;
  }
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
  var cv = $('#cv'), ctx = cv.getContext('2d'), mainCtx = ctx;
  var VW = 400, VH = 400, dpr = 1, scale = 1, TOP = 0, glowK = 1, needRender = true;
  // Canvas pixel ratio is capped at 2: 3x phones cost 2.25x the pixels for a difference you can't see.
  // shadowBlur-style glows are sized in canvas pixels, so glowK keeps their on-screen size the same as before the cap.
  var DPR_CAP = 2;
  function rawDpr() { return Math.min(window.devicePixelRatio || 1, 3); }
  function screenDpr() { return Math.min(rawDpr(), DPR_CAP); }
  function resize() {
    var r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;   // hidden or zero-size: keep the last good size (k = 0 would make VW infinite)
    dpr = screenDpr(); glowK = dpr / rawDpr();
    cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
    var k = Math.min(r.height / VH, r.width / 380);   // keep at least ~380 logical px of street visible
    scale = k * dpr; VW = r.width / k; TOP = -(r.height / k - VH);
    layers = {}; needRender = true; previewsDirty = true; shopDirty = true;
  }

  // ---------- render caches ----------
  // Layers: static parts of the main scene (sky gradient, sun, moon) pre-rendered once per size/place at full canvas
  // resolution with the same transform, then copied 1:1, so they look exactly the same as drawing them every frame.
  var layers = {};
  function layer(key, x0, y0, x1, y1, draw) {
    var L = layers[key];
    if (!L) {
      var s = scale, X0 = Math.floor(x0 * s), Y0 = Math.floor((y0 - TOP) * s), X1 = Math.ceil(x1 * s), Y1 = Math.ceil((y1 - TOP) * s);
      var cnv = document.createElement('canvas'); cnv.width = Math.max(1, X1 - X0); cnv.height = Math.max(1, Y1 - Y0);
      var g = cnv.getContext('2d'), saved = ctx;
      g.setTransform(s, 0, 0, s, -X0, -TOP * s - Y0);
      ctx = g; try { draw(); } finally { ctx = saved; }
      L = layers[key] = { c: cnv, X: X0, Y: Y0 };
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.c, L.X, L.Y); ctx.restore();
  }
  // gradients are made once per context (they live in user space, so they stay valid across frames)
  function grad(c, key, make) { var m = c.__grads || (c.__grads = {}); return m[key] || (m[key] = make(c)); }
  // Glow sprites: canvas shadowBlur is one of the slowest 2D operations (especially on iOS). Each glow is rendered once
  // into a small offscreen canvas at the current pixel scale and reused. A sprite holds ONLY the blurred glow; the crisp
  // shape is still drawn as vectors right after it, in the same order as before, so the picture stays the same.
  var glowCache = {}, glowN = 0;
  function pxScale(c) {
    var m = c.getTransform ? c.getTransform() : null;
    return m ? Math.max(Math.sqrt(m.a * m.a + m.b * m.b), Math.sqrt(m.c * m.c + m.d * m.d)) : scale;
  }
  // glow of shape(g) (drawn in local coords, inside the box x0,y0,w,h) with shadowBlur `blur` in `color`, at the current transform
  function glow(c, key, blur, color, x0, y0, w, h, shape) {
    var s = Math.round(pxScale(c) * 100) / 100; if (!(s > 0)) return;
    var bpx = blur * (c.__card ? 1 : glowK), k = key + '|' + color + '|' + s + '|' + bpx.toFixed(2);
    var sp = glowCache[k];
    if (!sp) {
      if (glowN > 400) { glowCache = {}; glowN = 0; }
      var pad = Math.ceil(bpx * 1.7) + 2, cw = Math.ceil(w * s) + pad * 2, ch = Math.ceil(h * s) + pad * 2, off = cw + 64;
      var cnv = document.createElement('canvas'); cnv.width = cw; cnv.height = ch;
      var g = cnv.getContext('2d');
      // draw the shape just off the left edge and let only its shadow (offset back into view) land on the sprite
      g.shadowColor = color; g.shadowBlur = bpx; g.shadowOffsetX = off;
      g.setTransform(s, 0, 0, s, pad - x0 * s - off, pad - y0 * s);
      shape(g);
      sp = glowCache[k] = { c: cnv, x: x0 - pad / s, y: y0 - pad / s, w: cw / s, h: ch / s }; glowN++;
    }
    c.drawImage(sp.c, sp.x, sp.y, sp.w, sp.h);
  }
  function glowAt(c, x, y, key, blur, color, x0, y0, w, h, shape) { c.translate(x, y); glow(c, key, blur, color, x0, y0, w, h, shape); c.translate(-x, -y); }
  function rectShape(w, h) { return function (g) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }; }
  function circleShape(r) { return function (g) { g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); }; }
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
    if (ctx === mainCtx) layer('sky-street', 0, TOP, VW, GROUND_Y, drawSkyStatic); else drawSkyStatic();
    // a few stars up top
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (var s = 0; s < 14; s++) { var x = (s * 97.3) % VW, y = (s * 37.7) % 90 + 8; if ((Math.sin(t * 2 + s) + 1) > 0.6) ctx.fillRect(x, y, 1.6, 1.6); }
  }
  function drawSkyStatic() {
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
  function drawProps(silhouette) {
    var sil = silhouette || '#1c0f2e';
    var par = 0.6, off = ((G.worldX * par) % TILE + TILE) % TILE, base = GROUND_Y - 4;
    ctx.save();
    for (var rep = 0; rep < Math.ceil(VW / TILE) + 1; rep++) {
      var ox = rep * TILE - off;
      for (var i = 0; i < props.length; i++) {
        var p = props[i], x = ox + p.x; if (x < -120 || x > VW + 120) continue;
        ctx.fillStyle = sil; ctx.strokeStyle = sil;
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
    ctx.fillStyle = grad(ctx, 'ground', function (c) { var g = c.createLinearGradient(0, GROUND_Y, 0, VH); g.addColorStop(0, '#4a3560'); g.addColorStop(1, '#221633'); return g; });
    ctx.fillRect(0, GROUND_Y, VW, VH - GROUND_Y);
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
  function drawLamps(pole, g0, g1) {
    var gap = 300, off = ((G.worldX * 0.85) % gap + gap) % gap;
    for (var x = -off + 40; x < VW + gap; x += gap) {
      ctx.strokeStyle = pole || '#140a22'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, GROUND_Y - 4); ctx.lineTo(x, GROUND_Y - 150); ctx.quadraticCurveTo(x, GROUND_Y - 162, x + 16, GROUND_Y - 162); ctx.stroke();
      ctx.fillStyle = grad(ctx, 'lamp' + g0, function (c) { var gl = c.createRadialGradient(0, 0, 1, 0, 0, 30); gl.addColorStop(0, g0 || 'rgba(255,230,160,0.9)'); gl.addColorStop(1, g1 || 'rgba(255,200,120,0)'); return gl; });
      ctx.translate(x + 18, GROUND_Y - 156); ctx.fillRect(-32, -32, 64, 64); ctx.translate(-(x + 18), -(GROUND_Y - 156));
    }
  }

  // ---------- places (background / props / palette only; gameplay is identical) ----------
  // To add a place: write a draw function (logical coords: ground at GROUND_Y, scroll with G.worldX)
  // and add { id, name, draw, unlock? } to PLACES. unlock = a GOALS id.
  var PLACES = [
    { id: 'street', name: 'Sunset Street', draw: drawStreet, swatch: ['#5b2166', '#ff8a4c'] },
    { id: 'beach', name: 'Beach Boardwalk', draw: drawBeach, unlock: 'p_beach', swatch: ['#3aa8f0', '#f1d49b'] },
    { id: 'night', name: 'Neon Night City', draw: drawNight, unlock: 'p_night', swatch: ['#05030f', '#ff4fd8'], railGlow: '#39ffd8' }
  ];
  var PLACE_BY_ID = {}; PLACES.forEach(function (p) { PLACE_BY_ID[p.id] = p; });
  window.__tt.PLACES = PLACES;
  var curPlace = PLACES[0];
  function drawBackdrop(t, placeId) {
    curPlace = PLACE_BY_ID[placeId || settings.place] || PLACES[0];
    curPlace.draw(t);
  }
  function drawStreet(t) {
    drawSky(t);
    drawCity(farCity, 0.08, GROUND_Y - 10, '#3d1d52', 'rgba(255,190,120,0.35)', 0);
    drawCity(nearCity, 0.25, GROUND_Y - 4, '#26143a', 'rgba(255,210,130,0.55)', 300);
    drawProps(); drawLamps(); drawGround();
  }
  // paint a place into any canvas context (menu thumbnails, goal rewards); bottom = lowest logical y shown
  function paintBackdrop(x, pxW, pxH, placeId, lvw, bottom, worldX) {
    var saved = { ctx: ctx, VW: VW, TOP: TOP, wx: G.worldX, cp: curPlace };
    var k = pxW / lvw, lvh = pxH / k;
    try {
      ctx = x; VW = lvw; TOP = (bottom || 400) - lvh; G.worldX = worldX || 600;
      x.setTransform(k * (x.__dpr || 1), 0, 0, k * (x.__dpr || 1), 0, -TOP * k * (x.__dpr || 1));
      drawBackdrop(3, placeId);
    } finally { ctx = saved.ctx; VW = saved.VW; TOP = saved.TOP; G.worldX = saved.wx; curPlace = saved.cp; }
  }

  // Beach Boardwalk: daytime sky, ocean, pier, lifeguard towers, umbrellas, wooden boardwalk
  var beachProps = []; (function () { var x = 40, types = ['tower', 'palm', 'umbrella', 'surf', 'palm', 'umbrella']; var i = 0; while (x < TILE) { beachProps.push({ x: x, type: types[i % types.length], s: 0.85 + ((i * 37) % 10) / 30, c: ['#ff4f8b', '#19c3c0', '#ffc94d'][i % 3] }); x += 150 + ((i * 53) % 90); i++; } })();
  function drawBeachSky() {
    var hz = GROUND_Y - 96;
    var g = ctx.createLinearGradient(0, Math.min(0, TOP), 0, hz); g.addColorStop(0, '#2f9be8'); g.addColorStop(0.65, '#8fd3ff'); g.addColorStop(1, '#e4f6ff');
    ctx.fillStyle = g; ctx.fillRect(0, TOP, VW, hz - TOP + 1);
    var sx = VW * 0.8, sy = Math.max(TOP + 44, 56);
    var gl = ctx.createRadialGradient(sx, sy, 8, sx, sy, 70); gl.addColorStop(0, 'rgba(255,255,220,0.9)'); gl.addColorStop(1, 'rgba(255,255,220,0)');
    ctx.fillStyle = gl; ctx.fillRect(sx - 70, sy - 70, 140, 140);
    ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.arc(sx, sy, 20, 0, Math.PI * 2); ctx.fill();
  }
  function drawBeach(t) {
    var hz = GROUND_Y - 96, sx = VW * 0.8, sy = Math.max(TOP + 44, 56);
    if (ctx === mainCtx) layer('sky-beach', 0, TOP, VW, Math.max(hz + 1, sy + 70), drawBeachSky); else drawBeachSky();
    // clouds
    var span = VW + 240, coff = (G.worldX * 0.03 + t * 4) % span;
    for (var i = 0; i < 4; i++) {
      var cx = ((i * 170 - coff) % span + span) % span - 120, cy = sy + 10 + (i % 2) * 34 - 30;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.arc(cx + 14, cy - 6, 15, 0, Math.PI * 2); ctx.arc(cx + 30, cy, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx, cy, 30, 11);
    }
    // headland + ocean
    ctx.fillStyle = '#3f8fa8'; ctx.beginPath(); ctx.moveTo(-10, hz); ctx.quadraticCurveTo(VW * 0.18, hz - 20, VW * 0.42, hz); ctx.fill();
    ctx.fillStyle = grad(ctx, 'ocean', function (c) { var og = c.createLinearGradient(0, hz, 0, GROUND_Y - 22); og.addColorStop(0, '#1670bd'); og.addColorStop(1, '#38b9e6'); return og; });
    ctx.fillRect(0, hz, VW, GROUND_Y - 22 - hz);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (var j = 0; j < 5; j++) {
      var yy = hz + 7 + j * 13, wo = ((G.worldX * (0.05 + j * 0.03) + t * 9 * (j % 2 ? 1 : -1)) % 46 + 46) % 46;
      for (var wx = -46; wx < VW + 46; wx += 46) ctx.fillRect(wx - wo + (j * 17) % 46, yy, 12 + j * 2, 1.4);
    }
    // pier
    var P = 900, po = ((G.worldX * 0.12) % P + P) % P;
    for (var rep = -1; rep < Math.ceil(VW / P) + 1; rep++) {
      var px = rep * P - po + 140;
      if (px > VW || px + 320 < 0) continue;
      ctx.fillStyle = '#5a4028'; for (var k = 0; k <= 300; k += 20) ctx.fillRect(px + k, hz + 14, 3, 24);
      ctx.fillStyle = '#7a5a3c'; ctx.fillRect(px, hz + 10, 304, 5); ctx.fillRect(px, hz + 3, 304, 1.5);
      for (var k2 = 0; k2 <= 300; k2 += 25) ctx.fillRect(px + k2, hz + 3, 1.5, 7);
      ctx.fillStyle = '#e8453c'; ctx.fillRect(px + 262, hz - 8, 30, 18); ctx.fillStyle = '#f2f2f7'; ctx.fillRect(px + 262, hz - 2, 30, 4);
      ctx.fillStyle = '#c23228'; ctx.beginPath(); ctx.moveTo(px + 258, hz - 8); ctx.lineTo(px + 277, hz - 18); ctx.lineTo(px + 296, hz - 8); ctx.fill();
    }
    // sand strip with foam
    ctx.fillStyle = '#f1d49b'; ctx.fillRect(0, GROUND_Y - 24, VW, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(0, GROUND_Y - 25, VW, 2);
    drawBeachProps();
    // boardwalk planks + sand below
    ctx.fillStyle = '#b9875a'; ctx.fillRect(0, GROUND_Y - 4, VW, 44);
    ctx.fillStyle = '#e3b682'; ctx.fillRect(0, GROUND_Y - 4, VW, 2);
    ctx.fillStyle = '#8a6038'; var so = G.worldX % 22; for (var x = -so; x < VW + 22; x += 22) ctx.fillRect(x, GROUND_Y - 2, 1.5, 42);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, GROUND_Y + 40, VW, 4);
    ctx.fillStyle = '#e9c98f'; ctx.fillRect(0, GROUND_Y + 44, VW, VH - GROUND_Y - 44);
    ctx.fillStyle = 'rgba(160,120,60,0.35)'; var sdo = G.worldX % 60;
    for (var d = 0; d < 14; d++) { var dx = ((d * 53) % 60) + Math.floor(d / 2) * 60 - sdo; ctx.fillRect(dx, GROUND_Y + 50 + (d * 7) % 26, 2, 2); }
  }
  function drawBeachProps() {
    var off = ((G.worldX * 0.6) % TILE + TILE) % TILE, base = GROUND_Y - 8;
    for (var rep = 0; rep < Math.ceil(VW / TILE) + 1; rep++) {
      var ox = rep * TILE - off;
      for (var i = 0; i < beachProps.length; i++) {
        var p = beachProps[i], x = ox + p.x, s = p.s; if (x < -80 || x > VW + 80) continue;
        if (p.type === 'tower') {
          ctx.strokeStyle = '#efe7d2'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + 8, base - 40); ctx.moveTo(x + 36, base); ctx.lineTo(x + 28, base - 40); ctx.moveTo(x + 4, base - 20); ctx.lineTo(x + 32, base - 20); ctx.stroke();
          ctx.fillStyle = '#d9d2bd'; ctx.fillRect(x + 1, base - 43, 34, 4);
          ctx.fillStyle = '#e8453c'; ctx.fillRect(x + 6, base - 66, 24, 23); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 6, base - 58, 24, 5);
          ctx.fillStyle = '#1b3f66'; ctx.fillRect(x + 11, base - 64, 14, 5);
          ctx.fillStyle = '#c23228'; ctx.beginPath(); ctx.moveTo(x + 1, base - 66); ctx.lineTo(x + 18, base - 78); ctx.lineTo(x + 35, base - 66); ctx.fill();
          ctx.fillStyle = '#9aa0b5'; ctx.fillRect(x + 17, base - 96, 1.5, 18); ctx.fillStyle = '#ffc94d'; ctx.fillRect(x + 18.5, base - 96, 10, 6);
        } else if (p.type === 'palm') {
          var h = 110 * s; ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + 4, base - h * 0.5, x + 12, base - h); ctx.stroke();
          ctx.strokeStyle = '#2f9e4f'; ctx.lineWidth = 4;
          for (var f = 0; f < 7; f++) { var a = -Math.PI / 2 + (f - 3) * 0.5, len = 32 * s, tx = x + 12, ty = base - h; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.7, ty + Math.sin(a) * len * 0.7 - 8, tx + Math.cos(a) * len, ty + Math.sin(a) * len + 12); ctx.stroke(); }
          ctx.fillStyle = '#6b3f1c'; ctx.beginPath(); ctx.arc(x + 12, base - h + 3, 3, 0, Math.PI * 2); ctx.fill();
        } else if (p.type === 'umbrella') {
          ctx.fillStyle = '#e9e4d8'; ctx.fillRect(x - 1, base - 44, 2, 44);
          ctx.save(); ctx.beginPath(); ctx.moveTo(x - 26, base - 38); ctx.quadraticCurveTo(x, base - 64, x + 26, base - 38); ctx.closePath(); ctx.clip();
          for (var st = -26; st < 26; st += 8.7) { ctx.fillStyle = ((st + 26) / 8.7 | 0) % 2 ? '#ffffff' : p.c; ctx.fillRect(x + st, base - 66, 8.7, 30); }
          ctx.restore();
          ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(x + 6, base + 1, 22, 3, 0, 0, Math.PI * 2); ctx.fill();
        } else if (p.type === 'surf') {
          ctx.save(); ctx.translate(x, base - 26); ctx.rotate(0.12);
          ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, 6, 28, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.fillRect(-1, -26, 2, 52); ctx.restore();
          ctx.save(); ctx.translate(x + 14, base - 22); ctx.rotate(-0.1);
          ctx.fillStyle = '#ffc94d'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 23, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      }
    }
  }

  // Neon Night City: dark sky, moon, neon signs, glowing lamps and reflections (rails glow cyan)
  var NEON = ['#ff4fd8', '#39ffd8', '#ffe04d', '#7c8cff'], NEON_TXT = ['ARCADE', 'PIZZA', 'SKATE', '24/7', 'TACOS', 'MATH', 'RADIO', 'DINER'];
  function drawNightSky() {
    var g = ctx.createLinearGradient(0, Math.min(0, TOP), 0, GROUND_Y); g.addColorStop(0, '#04020c'); g.addColorStop(0.6, '#130833'); g.addColorStop(1, '#34115a');
    ctx.fillStyle = g; ctx.fillRect(0, TOP, VW, GROUND_Y - TOP);
  }
  function drawMoon() {
    var mx = VW * 0.22, my = Math.max(TOP + 40, 48);
    var mg = ctx.createRadialGradient(mx, my, 6, mx, my, 50); mg.addColorStop(0, 'rgba(255,240,210,0.45)'); mg.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = mg; ctx.fillRect(mx - 50, my - 50, 100, 100);
    ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.arc(mx, my, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0c0624'; ctx.beginPath(); ctx.arc(mx + 7, my - 4, 13, 0, Math.PI * 2); ctx.fill();
  }
  function dashShape(g) { g.fillStyle = 'rgba(57,255,216,0.75)'; g.fillRect(0, 0, 34, 3); }
  function drawNight(t) {
    var main = ctx === mainCtx;
    if (main) layer('sky-night', 0, TOP, VW, GROUND_Y, drawNightSky); else drawNightSky();
    for (var s = 0; s < 46; s++) {
      var x = (s * 83.7) % VW, y = TOP + ((s * 47.3) % Math.max(60, (GROUND_Y - 150 - TOP)));
      ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + 0.5 * Math.abs(Math.sin(t * 1.7 + s))) + ')'; ctx.fillRect(x, y, s % 5 ? 1.2 : 2, s % 5 ? 1.2 : 2);
    }
    var mx = VW * 0.22, my = Math.max(TOP + 40, 48);
    if (main) layer('moon', mx - 50, my - 50, mx + 50, my + 50, drawMoon); else drawMoon();
    drawCity(farCity, 0.08, GROUND_Y - 10, '#170c38', 'rgba(120,240,255,0.35)', 0);
    drawCity(nearCity, 0.25, GROUND_Y - 4, '#1d1040', 'rgba(255,150,230,0.6)', 300);
    drawNeonSigns(t);
    drawProps('#0b0620');
    drawLamps('#070414', 'rgba(140,250,255,0.95)', 'rgba(60,200,255,0)');
    // ground: dark asphalt with neon reflections
    ctx.fillStyle = '#ff4fd8'; ctx.fillRect(0, GROUND_Y - 4, VW, 1.5);
    ctx.fillStyle = '#1a1236'; ctx.fillRect(0, GROUND_Y - 2.5, VW, 2.5);
    ctx.fillStyle = grad(ctx, 'nground', function (c) { var gg = c.createLinearGradient(0, GROUND_Y, 0, VH); gg.addColorStop(0, '#1f1542'); gg.addColorStop(1, '#0a0716'); return gg; });
    ctx.fillRect(0, GROUND_Y, VW, VH - GROUND_Y);
    for (var r = 0; r < 7; r++) {
      var rx = ((r * 97 - G.worldX * 0.25) % (VW + 60) + VW + 60) % (VW + 60) - 30, col = NEON[r % 4];
      var rg = grad(ctx, 'refl' + col, function (c) { var g2 = c.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + 60); g2.addColorStop(0, col); g2.addColorStop(1, 'rgba(0,0,0,0)'); return g2; });
      ctx.globalAlpha = 0.18; ctx.fillStyle = rg; ctx.fillRect(rx, GROUND_Y, 10, 60); ctx.globalAlpha = 1;
    }
    // glowing road dashes (glow sprite + crisp dash)
    var off2 = G.worldX % 70, x2;
    for (x2 = -off2; x2 < VW + 70; x2 += 70) glowAt(ctx, x2, GROUND_Y + 52, 'dash', 6, '#39ffd8', 0, 0, 34, 3, dashShape);
    ctx.fillStyle = 'rgba(57,255,216,0.75)';
    for (x2 = -off2; x2 < VW + 70; x2 += 70) ctx.fillRect(x2, GROUND_Y + 52, 34, 3);
  }
  function drawNeonSigns(t) {
    var off = ((G.worldX * 0.25 + 300) % TILE + TILE) % TILE, base = GROUND_Y - 4;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 8px ' + fontFam; ctx.lineWidth = 1.6;
    for (var rep = 0; rep < Math.ceil(VW / TILE) + 1; rep++) {
      var ox = rep * TILE - off;
      for (var i = 0; i < nearCity.length; i++) {
        var b = nearCity[i], x = ox + b.x; if (i % 3 !== 1 || b.h < 60 || x > VW || x + b.w < 0) continue;
        var col = NEON[i % 4], w = Math.min(b.w - 8, 46), sy = base - b.h + 12, on = Math.sin(t * 6 + i * 2.3) > -0.93;
        var txt = NEON_TXT[i % NEON_TXT.length];
        ctx.globalAlpha = on ? 1 : 0.35; ctx.strokeStyle = col; ctx.fillStyle = col;
        glowAt(ctx, x + 4, sy, 'sign' + w + txt, 10, col, -2, -2, w + 4, 18, signShape(w, txt));
        roundRect(x + 4, sy, w, 14, 4); ctx.stroke();
        ctx.fillText(txt, x + 4 + w / 2, sy + 7.5);
      }
    }
    ctx.restore();
  }

  function signShape(w, txt) {
    return function (g) { g.lineWidth = 1.6; g.strokeStyle = g.fillStyle = '#000'; g.font = '900 8px ' + fontFam; g.textAlign = 'center'; g.textBaseline = 'middle'; roundRectC(g, 0, 0, w, 14, 4); g.stroke(); g.fillText(txt, w / 2, 7.5); };
  }

  // ---------- gate ----------
  // every piece keeps its glow and draw order: glow sprite, then the crisp shape
  var GATE_W = 76, gatePillar = rectShape(8, 190), gateStrip = rectShape(4, 186);
  function gateBanner(g) { g.fillStyle = '#000'; roundRectC(g, -GATE_W / 2 - 12, -30, GATE_W + 24, 34, 8); g.fill(); }
  function gateBannerLine(g) { g.lineWidth = 3; g.strokeStyle = '#000'; roundRectC(g, -GATE_W / 2 - 12, -30, GATE_W + 24, 34, 8); g.stroke(); }
  function drawGate(x) {
    var st = G.gateState, col = st === 'good' ? '#3ee08f' : st === 'bad' ? '#ff4d5e' : '#19c3c0', col2 = st === 'good' ? '#3ee08f' : st === 'bad' ? '#ff4d5e' : '#ff4f8b';
    var top = GROUND_Y - 190, w = GATE_W;
    ctx.save(); ctx.globalAlpha = G.gateFade;
    ctx.fillStyle = '#1a1030';
    glowAt(ctx, x - w / 2 - 6, top, 'gpil', 14, col, 0, 0, 8, 190, gatePillar); ctx.fillRect(x - w / 2 - 6, top, 8, 190);
    glowAt(ctx, x + w / 2 - 2, top, 'gpil', 14, col, 0, 0, 8, 190, gatePillar); ctx.fillRect(x + w / 2 - 2, top, 8, 190);
    glowAt(ctx, x - w / 2 - 4, top + 2, 'gstr', 14, col, 0, 0, 4, 186, gateStrip); ctx.fillStyle = col; ctx.fillRect(x - w / 2 - 4, top + 2, 4, 186);
    glowAt(ctx, x + w / 2, top + 2, 'gstr', 14, col, 0, 0, 4, 186, gateStrip); ctx.fillStyle = col2; ctx.fillRect(x + w / 2, top + 2, 4, 186);
    // banner
    glowAt(ctx, x, top, 'gban', 18, col, -w / 2 - 12, -30, w + 24, 34, gateBanner);
    ctx.fillStyle = '#1a1030'; roundRect(x - w / 2 - 12, top - 30, w + 24, 34, 8); ctx.fill();
    glowAt(ctx, x, top, 'gbanl', 18, col, -w / 2 - 14, -32, w + 28, 38, gateBannerLine);
    ctx.lineWidth = 3; ctx.strokeStyle = col; roundRect(x - w / 2 - 12, top - 30, w + 24, 34, 8); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '900 22px ' + fontFam; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
    if (L.glow) {   // glow sprite of the same torso shape in its own frame (length rounded to 1/4 unit), then the crisp shirt
      var lq = Math.round(len * 4) / 4;
      c.save(); c.translate(hip[0], hip[1]); c.rotate(Math.atan2(u[1], u[0]));
      glow(c, 'torso' + lq, 12, L.glow, -6, -10, lq + 15, 20, torsoShape(lq)); c.restore();
    }
    torsoPath(c, hip, sh, T); c.fillStyle = L.shirt; c.fill();
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
  function torsoShape(len) {
    return function (g) {
      var T = { u: [1, 0], n: [0, 1], ws: 7.3, wh: 6.3, hc: [1.2, 0] }; T.mid = [T.hc[0] + len * 0.45, 0];
      torsoPath(g, [0, 0], [len, 0], T); g.fillStyle = '#000'; g.fill();
    };
  }
  function helmetShape(g) { g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, 10, Math.PI * 1.02, Math.PI * 2.02); g.closePath(); g.fill(); }
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
    if (pat === 'diamond') glowAt(c, cx, cy, 'helm', 9, '#bfefff', -11, -11, 22, 12, helmetShape);
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
    else if (pat === 'camo') { [[-5, -6, 4, 2.6, 0], [2, -8, 3.6, 2, 1], [5, -3, 3.2, 2.2, 0], [-1, -2, 3.2, 1.8, 1], [-8, -2, 2.6, 2, 1], [7, -8, 2.4, 1.6, 0]].forEach(function (b) { c.fillStyle = b[4] ? '#a3b06a' : ac; c.beginPath(); c.ellipse(cx + b[0], cy + b[1], b[2], b[3], 0.4, 0, Math.PI * 2); c.fill(); }); }
    else if (pat === 'diamond') {
      var fac = [['#e9fcff', [[cx - 10, cy], [cx - 4, cy - 9], [cx - 3, cy]]], ['#8fdcf5', [[cx - 3, cy], [cx - 4, cy - 9], [cx + 3, cy - 9], [cx + 3, cy]]], ['#d2f6ff', [[cx + 3, cy], [cx + 3, cy - 9], [cx + 10, cy]]], ['#ffffff', [[cx - 4, cy - 9], [cx + 3, cy - 9], [cx, cy - 11]]]];
      fac.forEach(function (f) { c.fillStyle = f[0]; c.beginPath(); f[1].forEach(function (pt, i) { if (i) c.lineTo(pt[0], pt[1]); else c.moveTo(pt[0], pt[1]); }); c.closePath(); c.fill(); });
      c.fillStyle = '#ffffff'; starPath(c, cx + 5, cy - 6, 2.4); c.fill();
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
  function rainbowGrad(c, x0, x1) {
    return grad(c, 'rainbow' + x0 + ',' + x1, function () {
      var g = c.createLinearGradient(x0, 0, x1, 0);
      ['#ff4f8b', '#ffb35c', '#ffe04d', '#3ee08f', '#39c6ff', '#8a4dff'].forEach(function (col, i) { g.addColorStop(i / 5, col); });
      return g;
    });
  }
  function ringShape(r, lw) { return function (g) { g.strokeStyle = '#000'; g.lineWidth = lw; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }; }
  function segShape(pts, w) { return function (g) { seg(g, pts, w, '#000'); }; }
  function segBox(pts, w) { var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }); return [x0 - w, y0 - w, x1 - x0 + w * 2, y1 - y0 + w * 2]; }
  // glow for a stroked polyline, then the crisp stroke (same as seg() under shadowBlur before)
  function glowSeg(c, key, blur, gcol, pts, w, col) {
    if (gcol) { var bx = segBox(pts, w); glow(c, key, blur, gcol, bx[0], bx[1], bx[2], bx[3], segShape(pts, w)); }
    seg(c, pts, w, col);
  }
  var WHEEL_R38 = circleShape(3.8), WHEEL_R6 = circleShape(6), HUB_R = circleShape(2.4), BMX_RING = ringShape(12.4, 3.2);
  function bmxWheel(c, p, R, L) {
    if (L.wheelGlow) glowAt(c, p[0], p[1], 'bring', 8, L.tire, -15, -15, 30, 30, R === 14 ? BMX_RING : ringShape(R - 1.6, 3.2));
    c.strokeStyle = L.tire; c.lineWidth = 3.2; c.beginPath(); c.arc(p[0], p[1], R - 1.6, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#c9ceda'; c.lineWidth = 1; c.beginPath(); c.arc(p[0], p[1], R - 3.6, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(220,224,236,0.6)'; c.lineWidth = 0.6; c.beginPath();
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; c.moveTo(p[0], p[1]); c.lineTo(p[0] + Math.cos(a) * (R - 3.8), p[1] + Math.sin(a) * (R - 3.8)); }
    c.stroke();
    c.fillStyle = '#9aa0b5'; c.beginPath(); c.arc(p[0], p[1], 2.2, 0, Math.PI * 2); c.fill();
  }
  // BMX: wheels r=14 touching the ground; pegs at the hubs (used for peg grinds)
  function drawBMX(c, pose, r) {
    var L = r.look || lookFor(r);
    var R = 14, RW = [-21, -14], FW = [21, -14], BB = [-2, -16], ST = [-8, -40], HT = [14, -43], HB = [16, -35];
    c.save(); c.rotate(pose.boardRot || 0);
    if (pose.flipY != null) { c.translate(0, -14); c.scale(1, pose.flipY); c.translate(0, 14); }
    var fs = L.framePattern === 'holo' ? rainbowGrad(c, -30, 22) : L.frame;
    // rear half (spins around the head tube for tailwhips)
    c.save(); c.translate(15, 0); c.scale(pose.spinX == null ? 1 : pose.spinX, 1); c.translate(-15, 0);
    bmxWheel(c, RW, R, L);
    c.fillStyle = '#c9ceda'; c.fillRect(RW[0] - 4, RW[1] - 1.5, 8, 3);                 // rear peg
    seg(c, [RW, BB], 3, fs); seg(c, [RW, ST], 3, fs);
    seg(c, [BB, ST], 3.4, fs); seg(c, [ST, HT], 3.4, fs); seg(c, [BB, HB], 3.8, fs);
    if (L.framePattern === 'stripe') { seg(c, [[BB[0] + 3, BB[1] - 2.6], [HB[0] - 3, HB[1] + 1]], 1.2, L.frameAccent); seg(c, [[ST[0] + 3, ST[1] - 0.4], [HT[0] - 3, HT[1] + 0.4]], 1.2, L.frameAccent); }
    seg(c, [ST, [-8, -43]], 2, '#9aa0b5'); seg(c, [[-13, -44], [-3, -45]], 3.4, '#16121f');   // seat
    c.fillStyle = '#9aa0b5'; c.beginPath(); c.arc(BB[0], BB[1], 3.6, 0, Math.PI * 2); c.fill();
    seg(c, [[BB[0] - 6, BB[1] + 2], [BB[0] + 6, BB[1] - 2]], 2, '#16121f');
    c.restore();
    // front: wheel, fork, head tube, bars (bars spin around the stem)
    bmxWheel(c, FW, R, L);
    c.fillStyle = '#c9ceda'; c.fillRect(FW[0] - 4, FW[1] - 1.5, 8, 3);                 // front peg
    seg(c, [HT, FW], 3, fs); seg(c, [HT, HB], 4.4, fs);
    c.save();
    var bg = L.barGlow ? L.bar : null;
    c.translate(13, 0); c.scale(pose.barX == null ? 1 : pose.barX, 1); c.translate(-13, 0);
    glowSeg(c, 'bb1', 8, bg, [HT, [12, -52]], 3, '#9aa0b5'); glowSeg(c, 'bb2', 8, bg, [[12, -52], [10, -59]], 3, L.bar); glowSeg(c, 'bb3', 8, bg, [[7, -59], [17, -59]], 3, L.bar);
    glowSeg(c, 'bb4', 8, bg, [[13, -59], [18, -59]], 4, '#16121f');
    c.restore();
    c.restore();
  }
  function drawSkateboard(c, pose, r) {
    var L = r.look || lookFor(r);
    c.save(); c.translate(0, -9); c.rotate(pose.boardRot || 0); c.scale(pose.spinX == null ? 1 : pose.spinX, pose.flipY == null ? 1 : pose.flipY);
    c.fillStyle = '#9aa0b5'; c.fillRect(-24, 0, 8, 3); c.fillRect(16, 0, 8, 3);
    c.fillStyle = L.wheel; [-21, 21].forEach(function (x) {
      if (L.wheelGlow) glowAt(c, x, 5, 'swheel', 8, L.wheel, -4, -4, 8, 8, WHEEL_R38);
      c.beginPath(); c.arc(x, 5, 3.8, 0, Math.PI * 2); c.fill();
    });
    seg(c, [[-35, -6], [-27, -1], [27, -1], [35, -6]], 5, L.deckPattern === 'holo' ? rainbowGrad(c, -35, 35) : L.deck);
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
    c.fillStyle = L.deckPattern === 'holo' ? rainbowGrad(c, -26, 22) : L.deck; roundRectC(c, -26, -13, 48, 6, 3); c.fill();
    c.save(); roundRectC(c, -26, -13, 48, 6, 3); c.clip();
    if (L.deckPattern === 'split') { c.fillStyle = L.deckAccent; c.fillRect(-2, -13, 24, 6); }
    else deckPattern(c, L.deckPattern, L.deckAccent, -25, 21, -11.5, 4.5);
    c.restore();
    c.fillStyle = '#16121f'; c.fillRect(-24, -13, 42, 1.5);
    c.fillStyle = '#9aa0b5'; c.fillRect(-31, -14, 8, 2.5);
    wheel(c, -25, -6, L); c.restore();
    // stem, fork, front wheel (with glowing bars, everything from here on glows in the bar color)
    var bg = L.barGlow ? L.bar : null;
    glowSeg(c, 'sstem', 8, bg, [[26, -6], [22, -14], [18, -79]], 4, L.bar);
    wheel(c, 26, -6, L, bg);
    c.save(); c.translate(18, -79); c.scale(pose.barX == null ? 1 : pose.barX, 1);
    glowSeg(c, 'sbar', 8, bg, [[-8, 0], [8, 0]], 4, L.bar); glowSeg(c, 'sgripL', 8, bg, [[-9, 0], [-5, 0]], 5, '#16121f'); glowSeg(c, 'sgripR', 8, bg, [[5, 0], [9, 0]], 5, '#16121f');
    c.restore();
    c.restore();
  }
  function wheel(c, x, y, L, outerGlow) {   // outerGlow: glow color already active around this wheel (scooter bars)
    var col = (L && L.wheel) || '#16121f', gc = L && L.wheelGlow ? col : outerGlow;
    if (gc) glowAt(c, x, y, 'wheel6', 8, gc, -6.5, -6.5, 13, 13, WHEEL_R6);
    c.fillStyle = col; c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill();
    if (outerGlow) glowAt(c, x, y, 'hub', 8, outerGlow, -3, -3, 6, 6, HUB_R);
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
      case 'tabletop': pose.flipY = 1 - 0.62 * Math.sin(Math.PI * q); pose.boardRot = -0.14 * Math.sin(Math.PI * q); pose.bodyRot = -0.1 * Math.sin(Math.PI * q); break;
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
    var gc = curPlace && curPlace.railGlow, rw = Math.round((b - a) * 10) / 10;
    if (gc) glowAt(ctx, a, y - 2, 'rail' + rw, 12, gc, 0, 0, rw, 5, rectShape(rw, 5));
    ctx.fillStyle = gc || '#b8bccf'; ctx.fillRect(a, y - 2, b - a, 5);
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
    menu: $('#menu'), end: $('#end'), pause: $('#pause'), quitAsk: $('#quitAsk'), choices: $$('.choice')
  };

  // ---------- round flow ----------
  function startRound() {
    if (pilotExpired()) { showPilotEnded(); return; }
    audio();
    G.screen = 'play'; G.score = 0; G.streak = 0; G.topStreak = 0; G.correct = 0; G.wrong = 0; G.timeLeft = ROUND_SECONDS;
    G.roundMissed = []; G.lastKey = null; G.particles = []; G.pops = []; G.trick = null; G.wipeT = -1; G.gateState = 'none'; G.prob = null; G.paused = false; G.sinceGrind = 0; G.lastWasGrind = false;
    G.roundGrinds = 0; G.coinParts = { answers: 0, streak: 0, grinds: 0, bonus: 0 }; G.passed = false; G.dusted = false; G.snapHold = false; G.fullTold = false;
    el.menu.classList.remove('show'); el.end.classList.remove('show'); el.pause.classList.remove('show'); el.quitAsk.classList.remove('show');
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
    snapCheck(G.trick);
    el.banner.className = 'right'; flashDisplay('flashR');
    if (settings.mode === 'choices') el.choices.forEach(function (b) { if (Number(b.textContent) === p.answer) b.classList.add('good'); });
    pop('+' + pts + '  ' + G.trick.name, '#ffc94d');
    if (m > 1 && (G.streak === 3 || G.streak === 6 || G.streak === 9 || G.streak === 12)) pop('x' + m + ' MULTIPLIER!', '#ff7a3d');
    sfx.good(); setPhase('boost'); updateHUD();
  }
  function onWrong(reason, val) {
    var p = G.prob; G.streak = 0; G.wrong++; recordMiss(p); G.lastWasGrind = false; G.snapHold = false;
    if (!G.roundMissed.some(function (f) { return f.key === p.key; })) G.roundMissed.push({ key: p.key, text: p.reveal });
    G.gateState = 'bad'; G.wipeT = 0; G.trick = null;
    el.banner.className = 'wrong'; el.prompt.innerHTML = p.revealHTML; flashDisplay('flashW');
    if (settings.mode === 'choices') el.choices.forEach(function (b) { var v = Number(b.textContent); if (v === p.answer) b.classList.add('good'); else if (v === val) b.classList.add('bad'); });
    pop(reason === 'time' ? 'TOO SLOW!' : 'WIPEOUT!', '#ff4d5e');
    sfx.bad(); setPhase('wipe'); updateHUD();
  }
  function endRound() {
    G.screen = 'end'; setPhase('idle'); G.snapHold = false; G.endLockUntil = performance.now() + END_LOCK_MS;
    var before = getStats();
    var lv = level(), bestKey = 'best_' + lv.id, best = getBest(lv.id), isNew = G.score > best && G.score > 0;
    if (isNew) { best = G.score; store.set(bestKey, best); }
    var total = G.correct + G.wrong, acc = total ? Math.round(G.correct / total * 100) : 0;
    $('#eScore').textContent = G.score; $('#eBest').textContent = best; $('#eAcc').textContent = acc + '%'; $('#eStreak').textContent = G.topStreak;
    $('#newBest').classList.toggle('show', isNew);
    $('#eLine').textContent = lv.name + ' · ' + G.correct + ' of ' + total + ' correct';
    // coins + milestone stats (only for finished rounds)
    var cp = G.coinParts;
    if (total >= COINS.accuracyMinAnswers && acc >= COINS.accuracyMin) cp.bonus += COINS.accuracyBonus;
    if (isNew) cp.bonus += COINS.bestBonus;
    var earned = cp.answers + cp.streak + cp.grinds + cp.bonus; setCoins(getCoins() + earned);
    var enough = total >= 8, done = before.levelsDone.slice(); if (done.indexOf(lv.id) < 0) done.push(lv.id);
    var after = Object.assign({}, before, { bestStreak: Math.max(before.bestStreak, G.topStreak), grinds: before.grinds + G.roundGrinds, rounds: before.rounds + 1,
      l5acc80: before.l5acc80 || (lv.id === 5 && enough && acc >= 80), l5bestAcc: lv.id === 5 && enough ? Math.max(before.l5bestAcc, acc) : before.l5bestAcc,
      levelsDone: done, bestAcc: enough ? Math.max(before.bestAcc, acc) : before.bestAcc, l5perfect: before.l5perfect || (lv.id === 5 && enough && acc === 100),
      best3: getBest(3), streakL3: lv.id >= 3 ? Math.max(before.streakL3, G.topStreak) : before.streakL3 });
    saveStats(after);
    $('#eCoins').textContent = '+' + earned;
    var parts = []; if (cp.answers) parts.push(cp.answers + ' answers'); if (cp.streak) parts.push(cp.streak + ' streak bonus'); if (cp.grinds) parts.push(cp.grinds + ' grinds'); if (cp.bonus) parts.push(cp.bonus + ' bonus');
    $('#eCoinLine').textContent = (parts.length ? parts.join(' · ') + ' · ' : '') + 'total ' + getCoins();
    var newGoals = GOALS.filter(function (g) { return !achieved(g.id, before) && achieved(g.id, after); });
    var ul = $('#eUnlock'); ul.innerHTML = '';
    if (newGoals.length) {
      var hd = document.createElement('div'); hd.className = 'ulHead'; hd.textContent = '🔓 UNLOCKED!'; ul.appendChild(hd);
      newGoals.forEach(function (g) {
        var row = document.createElement('div'); row.className = 'ulRow';
        var rw = rewardsFor(g.id).map(function (r) { return '<b>' + r.name + '</b> <small>' + r.kind + '</small>'; }).join(' · ');
        row.innerHTML = '<span class="ulGoal">✓ ' + g.text + '</span><span class="ulRew">' + rw + '</span>'; ul.appendChild(row);
      });
      var ft = document.createElement('div'); ft.className = 'ulFoot'; ft.textContent = 'Gear is in the shop · places and rides on the start screen'; ul.appendChild(ft);
    }
    ul.classList.toggle('show', newGoals.length > 0); G.lastUnlocks = newGoals.map(function (g) { return g.id; });
    var box = $('#eFacts'); box.innerHTML = '';
    G.roundMissed.forEach(function (f) { var d = document.createElement('div'); d.className = 'fact'; d.textContent = f.text; box.appendChild(d); });
    var shown = G.roundMissed.map(function (f) { return f.key; }), m = getMissed();
    var older = Object.keys(m).filter(function (k) { return shown.indexOf(k) < 0 && lv.fits(m[k]); }).sort(function (a, b) { return m[b].n - m[a].n; }).slice(0, Math.max(0, 8 - shown.length));
    older.forEach(function (k) { var f = m[k], d = document.createElement('div'); d.className = 'fact old'; d.textContent = f.a + ' × ' + f.b + ' = ' + (f.a * f.b); box.appendChild(d); });
    if (!box.children.length) box.innerHTML = '<div class="none">Clean round — nothing to practice!</div>';
    el.banner.className = 'hide'; el.end.classList.add('show');
    refreshMenu();
    flushSnaps();
  }
  function toMenu() { G.screen = 'menu'; setPhase('idle'); G.snapHold = false; G.gateState = 'none'; el.end.classList.remove('show'); el.pause.classList.remove('show'); el.quitAsk.classList.remove('show'); el.menu.classList.add('show'); el.banner.className = 'hide'; refreshMenu(); flushSnaps(); }

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
        var d = grindTravel(G.trickT) - grindTravel(t0); if (dt > 0) spd = d / dt;
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
    drawBackdrop(G.t);
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
    if (G.screen === 'goals') { if (e.key === 'Escape') closeGoals(); return; }
    if (G.screen === 'album') { if (e.key === 'Escape') { if (viewing) closeViewer(); else closeAlbum(); } return; }
    if (G.screen === 'menu' && e.key === 'Enter') { startRound(); e.preventDefault(); return; }
    if (G.screen === 'end' && endLocked() && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return; }
    if (G.screen === 'end' && e.key === 'Enter') { startRound(); e.preventDefault(); return; }
    if (G.screen !== 'play') return;
    if (quitAskOpen()) { if (e.key === 'Escape') keepPlaying(); return; }
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

  function quitAskOpen() { return el.quitAsk.classList.contains('show'); }
  function togglePause(force) {
    if (G.screen !== 'play') return;
    var p = force != null ? force : !G.paused;
    if (quitAskOpen()) { if (!p) el.pause.classList.remove('show'); return; }   // the quit question keeps the round paused
    G.paused = p;
    el.pause.classList.toggle('show', G.paused);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) { togglePause(true); flushSnaps(true); } });
  window.addEventListener('pagehide', function () { flushSnaps(true); });
  $('#resumeBtn').addEventListener('click', function () { audio(); togglePause(false); });
  // quit ✕ asks first (the round is paused meanwhile); a mis-tap near the notch no longer throws the round away
  function askQuit() { if (G.screen !== 'play') return; G.paused = true; el.pause.classList.remove('show'); el.quitAsk.classList.add('show'); }
  function keepPlaying() { el.quitAsk.classList.remove('show'); audio(); if (!el.pause.classList.contains('show')) G.paused = false; }
  $('#keepBtn').addEventListener('click', keepPlaying);
  $('#quitYes').addEventListener('click', function () { el.quitAsk.classList.remove('show'); if (G.screen === 'play') { G.paused = false; toMenu(); } });
  // iOS only lets audio resume inside a gesture, and touch pointerdown doesn't count: retry on any touchend
  document.addEventListener('touchend', function () { if (actx && actx.state !== 'running') audio(); }, { passive: true });
  $('#quitBtn').addEventListener('click', askQuit);
  $('#muteBtn').addEventListener('click', function () { settings.muted = !settings.muted; store.set('muted', settings.muted); $('#muteBtn').textContent = settings.muted ? '🔇' : '🔊'; });
  $('#muteBtn').textContent = settings.muted ? '🔇' : '🔊';
  $('#startBtn').addEventListener('click', startRound);
  // Time-up lockout: a tap meant for the game that lands just as the round ends must not hit RIDE AGAIN / MENU and skip
  // the results. End-screen button input (pointer + keyboard) is ignored for END_LOCK_MS after the round ends.
  var END_LOCK_MS = 800;
  function endLocked() { return G.screen === 'end' && performance.now() < (G.endLockUntil || 0); }
  ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchend'].forEach(function (type) {
    el.end.addEventListener(type, function (e) {
      if (!endLocked() || !(e.target.closest && e.target.closest('button'))) return;
      e.stopPropagation(); if (e.cancelable) e.preventDefault();
    }, true);
  });
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
      b.addEventListener('click', function () {
        if (!rideUnlocked(r)) { var g = ACHIEVEMENTS[r.unlock], pr = g.progress(getStats()); $('#lockNote').textContent = '🔒 ' + r.name + ' unlocks when you ' + g.text.charAt(0).toLowerCase() + g.text.slice(1) + ' (' + g.label + ': ' + pr[0] + ' / ' + pr[1] + '). See GOALS.'; return; }
        settings.rider = r.id; store.set('rider', r.id); $('#lockNote').textContent = ''; refreshMenu();
      });
      rp.appendChild(b); previews.push({ c: c, r: r });
    });
    buildPlaces();
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
    previewsDirty = true;
    $$('.rider').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-id') === settings.rider); });
    $$('.lvl').forEach(function (b) {
      var id = Number(b.getAttribute('data-level')), best = getBest(id);
      b.classList.toggle('sel', id === settings.level); b.querySelector('.b').textContent = best ? 'BEST ' + best : '';
    });
    $$('#modePick button').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-mode') === settings.mode); });
    $('#coinTotal').textContent = getCoins(); refreshAlbumCount(); refreshPlacesAndRides();
    var m = getMissed(), n = Object.keys(m).filter(function (k) { return level().fits(m[k]); }).length;
    $('#practiceNote').textContent = n ? n + ' tricky fact' + (n > 1 ? 's' : '') + ' saved for this level — they’ll show up more often.' : 'Missed facts get saved and come back more often until you nail them.';
  }
  function applyMode() { document.body.classList.toggle('mode-choices', settings.mode === 'choices'); }
  var previewsDirty = true;
  function drawPreviews() {
    if (placeThumbsDirty) placeThumbsDirty = !placeThumbs.every(function (p) { return paintPlaceThumb(p.c, p.id); });
    var redrawAll = previewsDirty; previewsDirty = false;
    previews.forEach(function (pv) {
      var sel = pv.r.id === settings.rider, c = pv.c, w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
      if (!sel && !redrawAll && pv.w === w && pv.h === h) return;   // only the selected ride animates; the others are drawn once (again if their size changes)
      pv.w = w; pv.h = h;
      var d = screenDpr(); if (c.width !== Math.round(w * d) || c.height !== Math.round(h * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
      var x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0);
      x.fillStyle = grad(x, 'bg' + h, function () { var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5b2166'); g.addColorStop(0.7, '#e8574a'); g.addColorStop(1, '#ffb35c'); return g; });
      x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,230,150,0.9)'; x.beginPath(); x.arc(w * 0.75, h * 0.62, h * 0.22, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#26143a'; x.fillRect(0, h - 14, w, 14);
      drawRider(x, w / 2 - 4, h - 12, h / 150, dress(pv.r), sel ? trickPose(pv.r.tricks[1].id, (G.t * 0.55) % 1.6 < 0.8 ? ((G.t * 0.55) % 1.6) / 0.8 : 0) : idlePose(G.t));
    });
  }


  // ---------- gear shop UI ----------
  var shopCat = 'shirt', shopCards = [];
  var PREVIEW = { shirt: { k: 1 / 118, gy: 0.93 }, helmet: { k: 1 / 42, gy: 2.3 }, board: { k: 1 / 70, gy: 0.9 }, scooter: { k: 1 / 100, gy: 0.93 }, bmx: { k: 1 / 108, gy: 0.93 } };
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
    $('#shopHint').textContent = cat.rider ? 'For the ' + riderById(cat.rider).name + (rideUnlocked(riderById(cat.rider)) ? '.' : ' (ride unlocks with a goal, see GOALS; gear can be bought now).') : 'Works on every ride. Preview shows your ' + riderById(settings.rider).name.toLowerCase() + '.';
    var grid = $('#shopGrid'); grid.innerHTML = ''; shopCards = []; shopDirty = true;
    var stats = getStats(), coins = getCoins();
    GEAR.filter(function (it) { return it.cat === shopCat; }).forEach(function (it) {
      var card = document.createElement('div'), own = owns(it.id), eq = gear.equipped[it.cat] === it.id, unlocked = isUnlocked(it, stats), rideLock = gearRideLock(it, stats);
      card.className = 'item' + (eq ? ' equipped' : own ? ' owned' : '') + (!unlocked || (rideLock && !eq) ? ' locked' : ''); card.setAttribute('data-id', it.id);
      var cv2 = document.createElement('canvas'); card.appendChild(cv2);
      var nm = document.createElement('div'); nm.className = 'iname'; nm.textContent = it.name; card.appendChild(nm);
      var stt = document.createElement('div'); stt.className = 'istat';
      var btn = document.createElement('button'); btn.className = 'ibtn';
      if (eq) { stt.textContent = 'Equipped'; btn.textContent = 'EQUIPPED'; btn.disabled = true; }
      else if (rideLock) {   // gear for a ride that isn't unlocked yet (BMX): can't be bought or equipped
        var ra = ACHIEVEMENTS[rideLock.unlock], rp = ra.progress(stats);
        stt.innerHTML = '<span class="req">🔒 Unlock the ' + rideLock.name + ' first: ' + ra.text + '</span><span class="prog">' + rp[0].toLocaleString('en-US') + ' / ' + rp[1].toLocaleString('en-US') + (own || !it.price ? '' : ' · then <i class="coin"></i>' + it.price) + '</span>';
        btn.textContent = 'LOCKED'; btn.disabled = true;
      }
      else if (own) { stt.textContent = 'Owned'; btn.textContent = 'EQUIP'; btn.classList.add('equip'); btn.addEventListener('click', function () { if (equipItem(it.id)) { sfx.tap(); buildShop(); } }); }
      else if (!unlocked) {
        var a = ACHIEVEMENTS[it.unlock], pr = a.progress(stats);
        stt.innerHTML = '<span class="req">🔒 ' + a.text + '</span><span class="prog">' + pr[0].toLocaleString('en-US') + (a.unit || '') + ' / ' + pr[1].toLocaleString('en-US') + (a.unit || '') + ' · then <i class="coin"></i>' + it.price + '</span>';
        btn.textContent = 'LOCKED'; btn.disabled = true;
      } else {
        stt.innerHTML = '<i class="coin"></i>' + it.price + (coins < it.price ? ' <span class="need">need ' + (it.price - coins) + ' more</span>' : '');
        btn.innerHTML = 'BUY <i class="coin"></i>' + it.price; btn.classList.add('buy'); btn.disabled = coins < it.price;
        btn.addEventListener('click', function () { if (buyItem(it.id)) { sfx.good(); buildShop(); } });
      }
      card.appendChild(stt); card.appendChild(btn); grid.appendChild(card);
      var eqOverride = {}; for (var k in gear.equipped) eqOverride[k] = gear.equipped[k]; eqOverride[it.cat] = it.id;
      shopCards.push({ c: cv2, r: previewRider(it.cat), eq: eqOverride, cat: it.cat });
    });
  }
  function gearRideLock(it, stats) {   // -> the ride this gear is for if that ride is still locked (BMX gear before the BMX), else null
    var c = GEAR_CATS.filter(function (x) { return x.id === it.cat; })[0], r = c && c.rider ? riderById(c.rider) : null;
    return r && r.id === c.rider && !rideUnlocked(r, stats || getStats()) ? r : null;
  }
  function buyItem(id) {   // the only purchase path (shop button + __tt.buy) -> true if bought
    var it = GEAR_BY_ID[id], coins = getCoins();
    if (!it || coins < it.price || !isUnlocked(it) || gearRideLock(it) || owns(it.id)) return false;
    // save the gear first, then the coins; if either write fails, undo everything so no coins are lost without the item
    var prevOwned = gear.owned.slice();
    gear.owned.push(it.id);
    if (!saveGear()) { gear.owned = prevOwned; purchaseFailed(); return false; }
    if (!setCoins(coins - it.price)) { gear.owned = prevOwned; saveGear(); purchaseFailed(); return false; }
    return true;
  }
  function equipItem(id) {   // -> true if equipped
    var it = GEAR_BY_ID[id];
    if (!it || !owns(it.id) || gearRideLock(it)) return false;
    gear.equipped[it.cat] = it.id; delete gear.keepEq[it.cat]; saveGear(); return true;
  }
  function purchaseFailed() { buildShop(); $('#shopHint').textContent = 'Couldn\u2019t save on this device, so nothing was bought and no coins were spent.'; }
  var shopDirty = true;
  function drawShopPreviews() {   // drawn once per build (buy / equip / tab rebuild the shop), and again if a card's size changes
    var all = shopDirty; shopDirty = false;
    shopCards.forEach(function (pv, i) {
      var c = pv.c, w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
      if (!all && pv.w === w && pv.h === h) return;
      pv.w = w; pv.h = h;
      var d = screenDpr(); if (c.width !== Math.round(w * d) || c.height !== Math.round(h * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
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
  // offscreen canvas as a JPEG data URL (max ALBUM_CAP cards; when full, new cards aren't saved and the kid is told).
  // The card shows the trick actually landed, only if it's new to that ride's album (see snapCheck). Nothing is
  // uploaded anywhere.
  //
  // Storage: images live in IndexedDB (db 'times-tricks', stores 'meta' + 'img', both keyed by card id and
  // always written in one transaction). localStorage only holds a small metadata copy (tt_album_meta) so the
  // count is instant. v7 and older kept whole cards in localStorage (tt_album): on startup they're copied
  // into IndexedDB with put() by id, read back and verified, and only then is tt_album removed. An
  // interrupted migration just re-runs next time (same ids, so no duplicates). Without IndexedDB the album
  // falls back to tt_album in localStorage, kept under ALBUM_LS_BUDGET characters.
  var SNAP_STREAKS = [5, 10, 15, 20], ALBUM_CAP = 30, SNAP_W = 600, SNAP_H = 800, SNAP_Q = 0.72;
  var ALBUM_LS_BUDGET = 900000;
  var META_FIELDS = ['id', 't', 'n', 'rider', 'trick', 'trickName', 'streak', 'level', 'levelName', 'place', 'kb'];
  function metaOf(e) { var m = {}; META_FIELDS.forEach(function (f) { if (e[f] !== undefined) m[f] = e[f]; }); return m; }
  function validMeta(e) { return !!e && typeof e === 'object' && typeof e.id === 'string' && e.id !== '' && typeof e.rider === 'string' && typeof e.trick === 'string'; }
  function sortAlbum(a) { return a.sort(function (x, y) { return (num(x.t, 0) - num(y.t, 0)) || (num(x.n, 0) - num(y.n, 0)); }); }
  function readLegacyAlbum() {   // old-format tt_album -> cards (with img), or null if absent/unreadable (left untouched)
    var raw = null, a;
    try { raw = localStorage.getItem('tt_album'); } catch (e) { return null; }
    if (raw == null) return null;
    try { a = JSON.parse(raw); } catch (e) { return null; }
    if (!Array.isArray(a)) return null;
    var seen = {};
    return a.map(function (e, i) {
      if (!e || typeof e !== 'object' || typeof e.img !== 'string' || e.img.indexOf('data:image') !== 0) return null;
      var c = Object.assign({}, e);
      if (typeof c.id !== 'string' || !c.id) c.id = 'legacy_' + num(c.t, 0) + '_' + i;
      if (seen[c.id]) c.id += '_' + i;   // never let two old cards collapse into one
      seen[c.id] = 1;
      c.t = num(c.t, 0); c.n = num(c.n, i);
      if (typeof c.rider !== 'string') c.rider = 'skate';
      if (typeof c.trick !== 'string') c.trick = '';
      if (!isFinite(c.kb)) c.kb = Math.round(c.img.length * 0.75 / 1024);
      return c;
    }).filter(Boolean);
  }
  var legacyBoot = readLegacyAlbum();
  var album = { mode: 'loading', db: null, list: [], lsImgs: {}, queue: Promise.resolve() };
  (function () {   // instant list (count, trick choice) until the real store is ready
    var seen = {}, list = [];
    arr(store.get('album_meta', [])).concat(legacyBoot || []).forEach(function (e) { if (validMeta(e) && !seen[e.id]) { seen[e.id] = 1; list.push(metaOf(e)); } });
    album.list = sortAlbum(list);
  })();
  function noop() {}
  function albumRun(fn) { var p = album.queue.then(function () { return fn(); }); album.queue = p.then(noop, noop); return p; }   // album changes run in order
  function saveMetaCache() { store.set('album_meta', album.list); }   // failure is harmless: IndexedDB is the source of truth
  function idbOpen() {
    return new Promise(function (res, rej) {
      var done = false, timer = setTimeout(function () { if (!done) { done = true; rej(new Error('IndexedDB open timed out')); } }, 4000);
      var rq = indexedDB.open('times-tricks', 1);
      rq.onupgradeneeded = function () {
        var db = rq.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('img')) db.createObjectStore('img', { keyPath: 'id' });
      };
      rq.onsuccess = function () { var db = rq.result; if (done) { db.close(); return; } done = true; clearTimeout(timer); db.onversionchange = function () { db.close(); }; res(db); };
      rq.onerror = function () { if (!done) { done = true; clearTimeout(timer); rej(rq.error || new Error('IndexedDB open failed')); } };
    });
  }
  function idbTx(db, mode, fn) {   // run fn(metaStore, imgStore) in one transaction; resolves with fn's result once it commits
    return new Promise(function (res, rej) {
      var tx = db.transaction(['meta', 'img'], mode), out;
      tx.oncomplete = function () { res(out); };
      tx.onerror = function () { rej(tx.error || new Error('IndexedDB error')); };
      tx.onabort = function () { rej(tx.error || new Error('IndexedDB transaction aborted')); };
      try { out = fn(tx.objectStore('meta'), tx.objectStore('img')); } catch (e) { try { tx.abort(); } catch (e2) {} rej(e); }
    });
  }
  function migrateLegacy(db, legacy) {
    if (!legacy) return Promise.resolve();
    if (!legacy.length) { store.remove('album'); return Promise.resolve(); }
    return idbTx(db, 'readwrite', function (ms, is) {
      legacy.forEach(function (e) { ms.put(metaOf(e)); is.put({ id: e.id, img: e.img }); });
    }).then(function () {
      return idbTx(db, 'readonly', function (ms, is) {
        var got = {};
        legacy.forEach(function (e) {
          var r1 = ms.get(e.id), r2 = is.get(e.id);
          got[e.id] = 0;
          r1.onsuccess = function () { if (r1.result) got[e.id]++; };
          r2.onsuccess = function () { if (r2.result && r2.result.img === e.img) got[e.id]++; };
        });
        return got;
      });
    }).then(function (got) {
      if (!legacy.every(function (e) { return got[e.id] === 2; })) throw new Error('album migration check failed');
      if (!store.remove('album')) throw new Error('could not remove old album key');   // only now, once every card is verified
    });
  }
  function loadIdbList(db) {
    return idbTx(db, 'readonly', function (ms, is) {
      var box = { list: [], keys: null }, r = ms.getAll();
      r.onsuccess = function () { box.list = r.result || []; };
      if (is.getAllKeys) { var k = is.getAllKeys(); k.onsuccess = function () { box.keys = k.result || []; }; }
      return box;
    }).then(function (box) {
      var has = null; if (box.keys) { has = {}; box.keys.forEach(function (id) { has[id] = 1; }); }
      return box.list.filter(function (e) { return validMeta(e) && (!has || has[e.id]); });
    });
  }
  function useLsAlbum(legacy) {
    var list = []; album.mode = 'ls'; album.lsImgs = {};
    (legacy || []).forEach(function (e) { album.lsImgs[e.id] = e.img; list.push(metaOf(e)); });
    album.list = sortAlbum(list);
  }
  function lsSave(list, adding) {   // fallback: write whole cards to tt_album. Old cards are never dropped: when adding
    // a card would go over the size budget (or storage is full) the write is refused and the caller reports 'full'
    var s = JSON.stringify(list.map(function (m) { return Object.assign({}, m, { img: album.lsImgs[m.id] }); }));
    if (adding && s.length > ALBUM_LS_BUDGET) return null;
    try { localStorage.setItem('tt_album', s); return list.slice(); } catch (e) { return null; }
  }
  function pruneLsImgs() { var keep = {}; album.list.forEach(function (m) { keep[m.id] = album.lsImgs[m.id]; }); album.lsImgs = keep; }
  function albumInit() {
    var legacy = legacyBoot; legacyBoot = null;
    return Promise.resolve().then(function () {
      if (!window.indexedDB) throw new Error('no IndexedDB');
      return idbOpen();
    }).then(function (db) {
      album.db = db;
      return migrateLegacy(db, legacy).then(function () { return loadIdbList(db); }).then(function (list) {
        album.mode = 'idb'; album.list = sortAlbum(list); saveMetaCache();
      });
    }).catch(function (err) {
      if (album.db) { try { album.db.close(); } catch (e) {} album.db = null; }
      console.info('album: using localStorage (' + (err && err.message) + ')');
      useLsAlbum(readLegacyAlbum());
    }).then(function () {
      refreshAlbumCount();
      if (G.screen === 'album' && !viewing) buildAlbum();
    });
  }
  function nextSeq() { var n = 0; album.list.forEach(function (e) { n = Math.max(n, num(e.n, 0)); }); return n + 1; }
  function albumAdd(entry, img) {   // call inside albumRun -> true, false (not saved) or 'full' (album/storage full; nothing dropped)
    if (album.list.length >= ALBUM_CAP) return Promise.resolve('full');
    var meta = metaOf(entry), next = album.list.concat([meta]);
    if (album.mode === 'idb') {
      return idbTx(album.db, 'readwrite', function (ms, is) { ms.put(meta); is.put({ id: meta.id, img: img }); })
        .then(function () { album.list = next; saveMetaCache(); return true; },
          function (e) { console.warn('snapshot not saved', e); if (e && e.name === 'QuotaExceededError') { album.fullHit = true; return 'full'; } return false; });
    }
    album.lsImgs[meta.id] = img;
    var kept = lsSave(next, true);
    if (!kept) { delete album.lsImgs[meta.id]; album.fullHit = true; return Promise.resolve('full'); }
    album.list = kept; return Promise.resolve(true);
  }
  function albumRemove(id) {
    return albumRun(function () {
      var next = album.list.filter(function (m) { return m.id !== id; }); album.fullHit = false;
      if (album.mode === 'idb') {
        return idbTx(album.db, 'readwrite', function (ms, is) { ms.delete(id); is.delete(id); })
          .then(function () { album.list = next; saveMetaCache(); return true; }, function () { return false; });
      }
      var kept = lsSave(next); if (!kept) return false;
      album.list = kept; pruneLsImgs(); return true;
    });
  }
  function albumImgs(ids) {   // -> Promise of { id: dataURL }
    return albumRun(function () {
      var o = {};
      if (album.mode !== 'idb') { ids.forEach(function (id) { if (album.lsImgs[id]) o[id] = album.lsImgs[id]; }); return o; }
      return idbTx(album.db, 'readonly', function (ms, is) {
        ids.forEach(function (id) { var r = is.get(id); r.onsuccess = function () { if (r.result && typeof r.result.img === 'string') o[id] = r.result.img; }; });
        return o;
      }).catch(function () { return {}; });
    });
  }
  function albumInfo() {   // for tests
    var info = { mode: album.mode, count: album.list.length, legacyKey: (function () { try { return localStorage.getItem('tt_album') != null; } catch (e) { return null; } })() };
    if (album.mode !== 'idb') return info;
    return idbTx(album.db, 'readonly', function (ms, is) {
      var r1 = ms.count(), r2 = is.count();
      r1.onsuccess = function () { info.idbMeta = r1.result; }; r2.onsuccess = function () { info.idbImg = r2.result; };
      return info;
    });
  }
  function albumClear() {   // for tests
    return albumRun(function () {
      var done = function () { album.list = []; album.lsImgs = {}; saveMetaCache(); refreshAlbumCount(); };
      if (album.mode === 'idb') return idbTx(album.db, 'readwrite', function (ms, is) { ms.clear(); is.clear(); }).then(done);
      store.remove('album'); done();
    });
  }
  album.queue = albumInit();
  function rideTricks(r) { return r.tricks.concat(r.grinds || []); }
  // Album tricks per ride = everything except the base trick (Ollie / Bunny Hop): it's only done below a 3-streak, so it
  // can never be landed at a snapshot streak. Old Ollie / Bunny Hop cards stay in the album but don't count.
  function collectible(r) { return rideTricks(r).filter(function (t) { return t.id !== r.tricks[0].id; }); }
  function missingTricks(r) {   // collectible tricks not yet in this ride's album (cards waiting to be saved count too)
    var has = {};
    album.list.forEach(function (e) { if (e.rider === r.id) has[e.trick] = 1; });
    G.pendingSnaps.forEach(function (q) { if (q.r.id === r.id && q.performed) has[q.performed.id] = 1; });
    return collectible(r).filter(function (t) { return !has[t.id]; });
  }
  function albumFull() { return album.list.length + G.pendingSnaps.length >= ALBUM_CAP; }
  // Runs on every correct answer. At a snapshot streak the card shows the trick just landed, but only if that trick is
  // new to this ride's album. If not, the capture is held and taken on the next landed trick that is new, in the same
  // streak run (a wrong answer or the end of the round cancels it). A ride that already has every trick is skipped quietly.
  function snapCheck(performed) {
    if (SNAP_STREAKS.indexOf(G.streak) < 0 && !G.snapHold) return;
    var r = rider(), miss = missingTricks(r);
    if (!miss.length) { G.snapHold = false; return; }
    if (!performed || !miss.some(function (t) { return t.id === performed.id; })) { G.snapHold = true; return; }
    G.snapHold = false;
    if (albumFull()) { showAlbumFullToast(); return; }   // never drop old cards to make room
    queueSnap(G.streak, performed);
  }
  function peakPose(trick) { return trick.grind ? grindPose(trick, 0.46) : trickPose(trick.id, trick.id === 'ollie' || trick.id === 'hop' ? 0.42 : 0.5); }
  function fmtDate(ms) { try { return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { var d = new Date(ms); return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear(); } }
  function renderSnapCard(dressedRider, trick, entry) {
    var W = SNAP_W, H = SNAP_H, cnv = document.createElement('canvas'); cnv.width = W; cnv.height = H;
    var x = cnv.getContext('2d'); x.__card = true;
    var saved = { ctx: ctx, VW: VW, TOP: TOP, wx: G.worldX, parts: G.particles, cp: curPlace };
    var LVW = 260, k = W / LVW, LVH = H / k, rx = LVW * 0.5;
    try {
      ctx = x; VW = LVW; TOP = 400 - LVH; G.worldX = 400 + Math.random() * 2600; G.particles = [];
      x.setTransform(k, 0, 0, k, 0, -TOP * k);
      drawBackdrop(entry.t / 1000, entry.place);
      // motion streaks
      x.strokeStyle = 'rgba(255,255,255,0.28)'; x.lineWidth = 1.6; x.lineCap = 'round';
      for (var i = 0; i < 6; i++) { var ly = GROUND_Y - 40 - i * 16, lx = rx - 70 - (i % 3) * 18; x.beginPath(); x.moveTo(lx, ly); x.lineTo(lx - 40 - (i % 2) * 20, ly); x.stroke(); }
      if (trick.grind) {
        drawRailAt(rx - 100, rx + 100, 1);
        x.fillStyle = '#ffe28a';
        for (var s = 0; s < 18; s++) { var sx = rx - 14 - Math.random() * 40, sy = GROUND_Y - GRIND.railH - Math.random() * 14; x.fillRect(sx, sy, 1.6, 1.6); }
      }
      drawRider(x, rx, GROUND_Y, RIDER_SCALE * 1.05, dressedRider, peakPose(trick));
    } finally { ctx = saved.ctx; VW = saved.VW; TOP = saved.TOP; G.worldX = saved.wx; G.particles = saved.parts; curPlace = saved.cp; }
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
  // H2: nothing heavy happens during play. At the streak we only record what's needed to draw the card (ride with its
  // gear, the trick just done, level, place, time) and show the toast; the card is drawn, JPEG-encoded and stored after
  // the round (end screen / menu), one card per idle slot. Leaving the page mid-round saves them right away.
  function snapState() { var r = rider(); return { r: r, dressed: dress(r), level: settings.level, levelName: level().name, place: settings.place, t: Date.now() }; }
  function queueSnap(streak, performed) {
    var s = snapState(); s.streak = streak; s.performed = performed;
    G.pendingSnaps.push(s); showSnapToast();
  }
  var snapBusy = false;
  var whenIdle = window.requestIdleCallback ? function (fn) { window.requestIdleCallback(fn, { timeout: 700 }); } : function (fn) { setTimeout(fn, 80); };
  function flushSnaps(now) {   // now = page is being hidden: save everything immediately
    if (!G.pendingSnaps.length) return;
    if (now) { while (G.pendingSnaps.length) { var q = G.pendingSnaps.shift(); takeSnapshot(q.streak, q.performed, q); } return; }
    if (snapBusy) return;
    snapBusy = true;
    whenIdle(function () {
      if ((G.screen === 'play' && !G.paused) || !G.pendingSnaps.length) { snapBusy = false; return; }   // a round is on: wait for it to end
      var q = G.pendingSnaps.shift();
      var next = function () { snapBusy = false; flushSnaps(); };
      takeSnapshot(q.streak, q.performed, q).then(next, next);
    });
  }
  function takeSnapshot(streak, performed, state) {   // -> Promise of the saved entry (or null); state = captured at the streak
    var s = state || snapState(), r = s.r;
    return albumRun(function () {
      var trick = performed || collectible(r)[0], now = s.t, img;
      var entry = { id: now.toString(36) + Math.random().toString(36).slice(2, 6), t: now, n: nextSeq(), rider: r.id, trick: trick.id, trickName: trick.name, streak: streak, level: s.level, levelName: s.levelName, place: s.place };
      try { img = renderSnapCard(s.dressed, trick, entry); } catch (e) { console.warn('snapshot failed', e); return null; }
      entry.kb = Math.round(img.length * 0.75 / 1024);
      return albumAdd(entry, img).then(function (ok) {
        if (ok === 'full') { showAlbumFullToast(); if (G.screen === 'album' && !viewing) buildAlbum(); return null; }
        if (!ok) return null;
        if (!state) showSnapToast();
        refreshAlbumCount();
        entry.img = img; return entry;
      });
    });
  }
  var toastTimer = null;
  var SNAP_MSG = '\ud83d\udcf8 Snapshot saved!', FULL_MSG = 'Album full! Delete a card to make room for new ones \ud83d\udcf8';
  function showSnapToast(msg, ms) {
    var t = $('#snapToast'); t.textContent = msg || SNAP_MSG; t.classList.toggle('long', !!msg); t.classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 1600);
  }
  function showAlbumFullToast() { if (G.fullTold) return; G.fullTold = true; showSnapToast(FULL_MSG, 2800); }   // once per round
  function refreshAlbumCount() { var n = album.list.length; $('#albumCount').textContent = n; $('#albumCount').classList.toggle('hidden', !n); }

  // album screens
  function openAlbum() {
    if (pilotExpired()) { showPilotEnded(); return; }
    G.screen = 'album'; el.menu.classList.remove('show'); $('#album').classList.add('show'); buildAlbum(); $('#album').scrollTop = 0;
  }
  function closeAlbum() { closeViewer(); $('#album').classList.remove('show'); toMenu(); }
  var albumBuildN = 0;
  function buildAlbum() {
    var a = album.list.slice().reverse(), grid = $('#albumGrid'), token = ++albumBuildN, ims = {}; grid.innerHTML = '';
    var full = a.length >= ALBUM_CAP || (album.fullHit && a.length > 0);
    $('#albumSub').textContent = full ? 'Album full (' + a.length + ' of ' + ALBUM_CAP + ') \u00b7 delete a card to make room for new ones'
      : a.length ? a.length + ' of ' + ALBUM_CAP + ' snapshots · newest first' : '';
    $('#albumSub').classList.toggle('full', full);
    $('#albumEmpty').classList.toggle('hidden', a.length > 0);
    a.forEach(function (e) {
      var b = document.createElement('button'); b.className = 'snap'; b.setAttribute('data-id', e.id);
      var im = document.createElement('img'); im.alt = 'Streak ' + e.streak + ' ' + e.trickName; b.appendChild(im); ims[e.id] = im;
      var cap = document.createElement('span'); cap.textContent = 'STREAK ' + e.streak + ' · ' + e.trickName; b.appendChild(cap);
      b.addEventListener('click', function () { openViewer(e.id, im.getAttribute('src')); });
      grid.appendChild(b);
    });
    albumImgs(a.map(function (e) { return e.id; })).then(function (imgs) {
      if (token !== albumBuildN) return;
      for (var id in ims) if (imgs[id]) ims[id].src = imgs[id];
    });
  }
  var viewing = null, delArmed = false, delTimer = null;
  function openViewer(id, src) {
    var e = album.list.filter(function (x) { return x.id === id; })[0]; if (!e) return;
    viewing = Object.assign({}, e, { img: src || null }); delArmed = false; $('#delSnap').textContent = 'DELETE'; $('#delSnap').classList.remove('armed');
    if (src) $('#viewImg').src = src;
    else albumImgs([id]).then(function (o) { if (viewing && viewing.id === id && o[id]) { viewing.img = o[id]; $('#viewImg').src = o[id]; } });
    $('#viewCap').textContent = 'Streak ' + e.streak + ' · ' + e.trickName + ' · ' + fmtDate(e.t) + ' · Level ' + e.level;
    $('#saveHint').textContent = 'Tip: you can also press and hold the picture to save it.';
    $('#viewer').classList.add('show');
  }
  function closeViewer() { $('#viewer').classList.remove('show'); viewing = null; }
  function dataURLtoBlob(u) { var p = u.split(','), bin = atob(p[1]), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: 'image/jpeg' }); }
  function saveViewing() {
    if (!viewing || !viewing.img) return;
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
    var id = viewing.id; closeViewer();
    albumRemove(id).then(function () { buildAlbum(); refreshAlbumCount(); });
  }
  $('#albumBtn').addEventListener('click', openAlbum);
  $('#albumBack').addEventListener('click', closeAlbum);
  $('#albumClose').addEventListener('click', closeAlbum);
  $('#viewBack').addEventListener('click', closeViewer);
  $('#saveSnap').addEventListener('click', saveViewing);
  $('#delSnap').addEventListener('click', deleteViewing);


  // ---------- place picker + goals screen ----------
  var placeThumbs = [], placeThumbsDirty = true;
  function dprOf() { return screenDpr(); }
  function paintPlaceThumb(cnv, placeId) {
    var w = cnv.clientWidth, h = cnv.clientHeight; if (!w || !h) return false;
    var d = dprOf(); cnv.width = Math.round(w * d); cnv.height = Math.round(h * d);
    var x = cnv.getContext('2d'); x.__dpr = d; paintBackdrop(x, w, h, placeId, 240, 345, 520);
    return true;
  }
  function buildPlaces() {
    var pp = $('#placePick'); pp.innerHTML = ''; placeThumbs = [];
    PLACES.forEach(function (pl) {
      var b = document.createElement('button'); b.className = 'place'; b.setAttribute('data-place', pl.id);
      var c = document.createElement('canvas'); b.appendChild(c);
      var s = document.createElement('span'); s.className = 'pname'; s.textContent = pl.name; b.appendChild(s);
      var lk = document.createElement('span'); lk.className = 'plock'; b.appendChild(lk);
      b.addEventListener('click', function () {
        if (!placeUnlocked(pl)) { var g = ACHIEVEMENTS[pl.unlock], pr = g.progress(getStats()); $('#lockNote').textContent = '🔒 ' + pl.name + ': ' + g.text + ' (' + g.label + ': ' + pr[0] + ' / ' + pr[1] + '). See GOALS.'; return; }
        settings.place = pl.id; store.set('place', pl.id); $('#lockNote').textContent = ''; refreshMenu();
      });
      pp.appendChild(b); placeThumbs.push({ c: c, id: pl.id });
    });
    placeThumbsDirty = true;
  }
  function refreshPlacesAndRides() {
    var st = getStats();
    $$('.place').forEach(function (b) {
      var pl = PLACE_BY_ID[b.getAttribute('data-place')], ok = placeUnlocked(pl, st);
      b.classList.toggle('sel', pl.id === settings.place); b.classList.toggle('locked', !ok);
      b.querySelector('.plock').textContent = ok ? '' : '🔒 ' + ACHIEVEMENTS[pl.unlock].text;
    });
    $$('.rider').forEach(function (b) {
      var r = riderById(b.getAttribute('data-id')), ok = rideUnlocked(r, st);
      b.classList.toggle('locked', !ok);
      b.querySelector('span').textContent = ok ? r.name : '🔒 ' + r.name;
    });
    var n = GOALS.filter(function (g) { return achieved(g.id, st); }).length;
    $('#goalsCount').textContent = n + '/' + GOALS.length;
  }
  function paintReward(cnv, rw) {
    var w = cnv.clientWidth, h = cnv.clientHeight; if (!w || !h) return;
    var d = dprOf(); cnv.width = Math.round(w * d); cnv.height = Math.round(h * d);
    var x = cnv.getContext('2d');
    if (rw.type === 'place') { x.__dpr = d; paintBackdrop(x, w, h, rw.place.id, 240, 345, 520); return; }
    x.setTransform(d, 0, 0, d, 0, 0);
    var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#4a1d5e'); g.addColorStop(0.75, '#d2505a'); g.addColorStop(1, '#ffb35c');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    if (rw.type === 'ride') { x.fillStyle = '#26143a'; x.fillRect(0, h * 0.9, w, h); drawRider(x, w / 2, h * 0.9, h / 118, dress(rw.rider), idlePose(1)); return; }
    var it = rw.item, P = PREVIEW[it.cat] || PREVIEW.shirt, eq = {}; for (var k in gear.equipped) eq[k] = gear.equipped[k]; eq[it.cat] = it.id;
    x.fillStyle = '#26143a'; x.fillRect(0, h * P.gy, w, h);
    drawRider(x, w / 2 - (it.cat === 'helmet' ? 4 : 0), h * P.gy, h * P.k, dress(previewRider(it.cat), eq), idlePose(1));
  }
  function openGoals() {
    if (pilotExpired()) { showPilotEnded(); return; }
    G.screen = 'goals'; el.menu.classList.remove('show'); $('#goals').classList.add('show'); buildGoals(); $('#goals').scrollTop = 0;
  }
  function closeGoals() { $('#goals').classList.remove('show'); toMenu(); }
  function buildGoals() {
    var st = getStats(), list = $('#goalList'), thumbs = []; list.innerHTML = '';
    var doneN = GOALS.filter(function (g) { return achieved(g.id, st); }).length;
    $('#goalsSub').textContent = doneN + ' of ' + GOALS.length + ' goals done · progress counts finished rounds';
    GOAL_TIERS.forEach(function (tier) {
      var h = document.createElement('h2'); h.className = 'tierHead tier-' + tier.id; h.textContent = tier.name; list.appendChild(h);
      GOALS.filter(function (g) { return g.tier === tier.id; }).forEach(function (g) {
        var pr = g.progress(st), done = pr[0] >= pr[1], u = g.unit || '';
        var row = document.createElement('div'); row.className = 'goal' + (done ? ' done' : ''); row.setAttribute('data-goal', g.id);
        var rws = rewardsFor(g.id);
        row.innerHTML = '<div class="gchk">' + (done ? '✓' : '') + '</div>' +
          '<div class="gbody"><div class="gtext">' + g.text + '</div>' +
          '<div class="gbar"><i style="width:' + Math.round(pr[0] / pr[1] * 100) + '%"></i></div>' +
          '<div class="gprog">' + g.label + ': ' + pr[0].toLocaleString('en-US') + u + ' / ' + pr[1].toLocaleString('en-US') + u + '</div>' +
          '<div class="grew">Reward: ' + rws.map(function (r) { return '<b>' + r.name + '</b> <small>(' + r.kind + ')</small>'; }).join(', ') + '</div></div>' +
          '<div class="gthumbs"></div>';
        var th = row.querySelector('.gthumbs');
        rws.slice(0, 2).forEach(function (r) { var c = document.createElement('canvas'); th.appendChild(c); thumbs.push([c, r]); });
        list.appendChild(row);
      });
    });
    requestAnimationFrame(function () { thumbs.forEach(function (t) { paintReward(t[0], t[1]); }); });
  }
  $('#goalsBtn').addEventListener('click', openGoals);
  $('#goalsBack').addEventListener('click', closeGoals);
  $('#goalsClose').addEventListener('click', closeGoals);

  // ---------- loop ----------
  var last = performance.now(), coverAt = 0, covered = false, coverScreen = '';
  // the scene is skipped while the round is paused, or when an open screen's panel covers the whole canvas
  // (the canvas keeps its last picture; the photo viewer is 96% opaque, so it always counts as covering)
  function coveredByOverlay() {
    var r = cv.getBoundingClientRect(); if (!r.width || !r.height) return true;
    var ovs = $$('.overlay.show');
    for (var i = 0; i < ovs.length; i++) {
      if (ovs[i].id === 'viewer' || ovs[i].id === 'pilotEnded') return true;
      var p = ovs[i].querySelector('.panel'); if (!p) continue;
      var q = p.getBoundingClientRect();
      if (q.left <= r.left + 1 && q.top <= r.top + 1 && q.right >= r.right - 1 && q.bottom >= r.bottom - 1) return true;
    }
    return false;
  }
  function sceneHidden(now) {
    if (G.screen === 'play') return G.paused;
    if (now - coverAt > 250 || G.screen !== coverScreen) { coverAt = now; coverScreen = G.screen; covered = coveredByOverlay(); }
    return covered;
  }
  window.__tt.renders = 0;
  function frame(now) {
    var dt = clamp((now - last) / 1000, 0, 0.05); last = now;
    try {
      update(dt);
      if (needRender || !sceneHidden(now)) { render(); needRender = false; window.__tt.renders++; }
      if (G.screen === 'menu') drawPreviews(); else if (G.screen === 'shop') drawShopPreviews();
    } catch (err) { console.error(err); }
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
    [el.menu, el.end, el.pause, el.quitAsk, $('#shop'), $('#album'), $('#viewer'), $('#goals')].forEach(function (o) { o.classList.remove('show'); });
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

  // ---------- startup ----------
  // Each step is guarded so one bad saved value can never stop the game loop from starting.
  function safe(fn) { try { fn(); } catch (err) { console.error('startup:', err); } }
  // saved choices that are no longer valid/unlocked fall back to defaults (older saves migrate cleanly)
  safe(function () { if (riderById(settings.rider).id !== settings.rider || !rideUnlocked(riderById(settings.rider))) settings.rider = 'skate'; });
  safe(function () { if (!PLACE_BY_ID[settings.place] || !placeUnlocked(PLACE_BY_ID[settings.place])) settings.place = 'street'; });
  window.addEventListener('resize', function () { placeThumbsDirty = true; });
  safe(buildMenu); safe(refreshMenu); safe(applyMode); safe(resize); safe(updateHUD); safe(function () { el.banner.className = 'hide'; });
  safe(function () { if (pilotExpired()) showPilotEnded(); });
  requestAnimationFrame(frame);
})();
