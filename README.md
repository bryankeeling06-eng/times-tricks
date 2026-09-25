# Times Tricks

A multiplication street-runner for ages 10–11. Pick a skateboard or scooter, roll through a sunset skatepark, and answer each times-table problem before you hit the gate. Right answer = trick + points. Wrong answer = wipeout (and you see the right answer).

**Play:** https://bryankeeling06-eng.github.io/times-tricks/

Plain static HTML/CSS/JS with no build step, no external requests, no ads, no trackers.

## How to play

1. Pick a ride, a level, and an answer mode (number pad or 3 choices).
2. Tap **Drop In** (or press Enter).
3. Type the answer on the pad (or keyboard digits + Enter) before the gate bar runs out. In choices mode tap an answer (or press 1 / 2 / 3).
4. About 1 in 4 tricks is a **rail grind**: a rail pops up, you ollie onto it, slide with sparks, and hop off. Skateboard: 50-50 or boardslide. Scooter: feeble or 50-50. On a streak of 3+ a grind adds a small bonus (+50 × multiplier).
5. Rounds last 75 seconds. Streaks raise the multiplier (x2 at 3, x3 at 6, x4 at 9, x5 at 12) and speed things up slightly.

## Preview links that expire

Same style as Math Trail's pilot links: add `?pilot=<name>&until=YYYY-MM-DD`.

- Example: `https://bryankeeling06-eng.github.io/times-tricks/?pilot=preview&until=2026-09-29`
- The link plays through **11:59:59 PM US Central time** on the `until` date, then shows a "This preview link has expired" screen instead of the game. An open tab is re-checked every 30 s (between rounds).
- If `pilot` or a valid `until` is missing, the game plays normally. The bare URL is **not** locked (same as Math Trail), so this is a soft, client-side expiry, not access control.

## Levels

1. Tables 2–5
2. Tables 6–9
3. Mixed up to 12 × 12
4. Missing factor (`? × 7 = 56`)
5. 2-digit × 1-digit

## Coins and the gear shop

In-game coins only. No real money, no purchases, no accounts, nothing leaves the device.

- **Earning** (added at the end of a finished round; quitting early forfeits them): 2 per correct answer, +1 per multiplier step above x1 (so a x3 answer gives 4), +3 per grind, +5 for 80%+ accuracy with 8+ answers, +10 for a new personal best. A decent 75-second round earns ~50–70 coins.
- **Shop** (start screen → GEAR SHOP): Shirts, Helmets, Boards (skateboard only), Scooters (scooter only), BMX (frame + tire colours). Defaults are free and owned. Buy, then Equip. Every card shows a live preview of the rider using that item. Equipped gear shows in gameplay, tricks, grinds, wipeouts, the rider picker and snapshots.
- **Goal items** are locked until their goal is done (see Goals below), then bought with coins.

## Goals, places and rides

**★ GOALS** on the start screen lists every goal grouped Easy / Medium / Big, with a progress bar ("Grinds: 7 / 10"), a picture of the reward, and a ✓ when done. Progress only counts **finished** rounds. When a round unlocks something, the end screen shows an **UNLOCKED!** banner.

| Tier | Goal | Reward |
|---|---|---|
| Easy | Hit your first 5-streak | Sky Tee (shirt, 30) |
| Easy | Play 3 rounds | Mint Racer (helmet, 30) |
| Easy | Land your first grind | Sunrise Tee (shirt, 35) |
| Easy | Land 10 grinds | Galaxy Deck (board), Rail Spark (scooter) |
| Easy | Play 10 rounds | **Beach Boardwalk** place |
| Medium | 90%+ accuracy on any level (8+ answers) | Camo helmet (170) |
| Medium | Finish a round on every level (1–5) | Flame Wheels board (170) |
| Medium | Hit a 15-streak | **BMX** ride |
| Medium | Land 25 grinds | Neon Bars scooter (180) |
| Medium | Hit a 20-streak | Gold Jersey |
| Medium | Level 5 round with 80%+ accuracy (8+ answers) | Gold Rush scooter |
| Medium | Score 6,000+ on Level 3 | Chrome Dome helmet |
| Big | Hit a 30-streak | Holo Deck (board, 300), Holo Frame (BMX, 300) |
| Big | Perfect Level 5 round (100%, 8+ answers) | Diamond helmet (300), Royal Gold scooter (300) |
| Big | Land 50 grinds | **Neon Night City** place |

**Places** (start screen → PLACE): Sunset Street (default), Beach Boardwalk (sand, ocean, pier, lifeguard towers, daytime) and Neon Night City (dark sky, neon signs, glowing rails). Places only change the background, props and colours. Gameplay is identical. Snapshot cards use the place you were riding in.

**Rides:** Skateboard, Scooter, and BMX (unlocked by the 15-streak goal). BMX tricks: Bunny Hop, Tabletop, Bar Spin, 360, Tailwhip. BMX grinds: Double-Peg Grind, Feeble Grind. The snapshot "no repeat" rule works per ride.

**Adding a goal:** add an object to `GOALS` in `game.js`: `{ id, tier: 'easy'|'medium'|'big', text, label, unit?, progress: function (stats) { return [current, target]; } }`. Put `unlock: '<goal id>'` on any gear item, place or rider to make that goal its reward. Stats come from `getStats()` (saved in `tt_stats` at the end of each finished round in `endRound`); add a new counter there if you need one.

**Adding a place:** add an entry to `PLACES` (`{ id, name, unlock?, draw: function (t) {...}, railGlow? }`). The draw function paints the sky/background/props for the current camera (`G.worldX`); see `drawBeach` / `drawNight`. The picker thumbnails and snapshot cards use it automatically.

### Adding gear

Everything is data in `game.js`:

- **New item:** add one object to `GEAR`, e.g.
  `{ id: 'shirt_orange', cat: 'shirt', name: 'Traffic Cone', price: 70, color: '#ff7a3d', dark: '#c2521f' }`.
  Look fields per category: shirts `color, dark, stripe?, glow?`; helmets `color, pattern, accent?` (`none, stripe, double, bolt, star, checker, flames, chrome, spikes, camo, diamond`); boards/scooters `deck, wheel, pattern?, accent?, wheelGlow?` plus `bar`/`barGlow` for scooters (`none, stripe, split, checker, flames, stars, holo`); BMX items use `frame, tire, framePattern?, frameAccent?`.
- **Lock it behind a goal:** add `unlock: '<goal id>'` (goals live in `GOALS`).
- **New category:** add to `GEAR_CATS`. A category with `rider: '<id>'` applies to that ride; set `gearCat` on the rider.
- **Coin tuning:** the `COINS` object.

## Snapshot album

- Hitting a **5, 10, 15 or 20 streak** in a round takes a snapshot: a 600×800 photo card of the rider in their equipped gear, frozen at the peak of a trick, with a STREAK badge, trick name, date and level. A small "📸 Snapshot saved!" toast shows and play carries on.
- The trick on the card is always one that isn't in the album yet for that ride (4 tricks + 2 grinds each). Once all six are used it only avoids repeating the most recent one.
- **ALBUM** on the start screen shows the grid. Tap a card to open it full screen, then **Save to Photos** (opens the iOS/Android share sheet with the image, where "Save Image" puts it in Photos; on desktop it downloads) or **Delete** (tap twice). Press-and-hold on the picture also works on iPhone.
- Cards are JPEG data URLs (~45 KB each) in `tt_album`, capped at 30 (oldest dropped, and also dropped if storage is full). Nothing is uploaded. Tune with `SNAP_STREAKS`, `ALBUM_CAP` and `SNAP_Q` in `game.js`.

## Saved in the browser (localStorage, `tt_` prefix)

- Chosen rider (`tt_rider`), place (`tt_place`), level, and answer mode (a locked or unknown saved rider/place falls back to Skateboard / Sunset Street)
- Coins (`tt_coins`), owned/equipped gear (`tt_gear`), goal stats (`tt_stats`: best streak, grinds, rounds, levels finished, best accuracy, Level 5 results; older saves are migrated, with levels finished rebuilt from personal bests), snapshot album (`tt_album`)
- Personal best per level (`tt_best_<level>`)
- Missed facts (`tt_missed`): missed facts come back more often in later rounds until you get them right a few times. The end screen lists them under "Facts to practice".

## Adding a new rider

Add an entry to `RIDERS` in `game.js`: colours, a `stance` (foot/hip/hand positions), a list of `tricks`, optional `grinds` (with the rail contact height), and a `drawVehicle(ctx, pose, rider)` function. Optional `gearCat` (its shop category) and `unlock` (a goal id). The picker, shop, saving, snapshots and gameplay pick it up automatically.

## Files

- `index.html`: layout and screens
- `style.css`: styles (portrait-first, safe-area aware)
- `game.js`: the game (canvas scene, riders, problems, scoring)
