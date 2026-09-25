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
- **Shop** (start screen → GEAR SHOP): Shirts, Helmets, Boards (skateboard only), Scooters (scooter only). Defaults are free and owned. Buy, then Equip. Every card shows a live preview of the rider using that item. Equipped gear shows in gameplay, tricks, grinds, wipeouts and the rider picker.
- **Milestone items** are locked until an achievement, then bought with coins:
  - Gold Jersey: 20-answer streak
  - Chrome Dome helmet: score 6,000+ on Level 3
  - Galaxy Deck and Rail Spark scooter: land 10 grinds (finished rounds)
  - Gold Rush scooter: finish a Level 5 round with 80%+ accuracy (8+ answers)

### Adding gear

Everything is data in `game.js`:

- **New item:** add one object to `GEAR`, e.g.
  `{ id: 'shirt_orange', cat: 'shirt', name: 'Traffic Cone', price: 70, color: '#ff7a3d', dark: '#c2521f' }`.
  Look fields per category: shirts `color, dark, stripe?, glow?`; helmets `color, pattern, accent?` (`none, stripe, double, bolt, star, checker, flames, chrome, spikes`); boards/scooters `deck, wheel, pattern?, accent?, wheelGlow?` plus `bar` for scooters (`none, stripe, split, checker, flames, stars`).
- **Lock it behind a milestone:** add `unlock: '<achievement id>'`. Achievements live in `ACHIEVEMENTS` (text + a `progress(stats)` returning `[current, goal]`).
- **New category:** add to `GEAR_CATS`. A category with `rider: '<id>'` applies to that ride; set `gearCat` on the rider.
- **Coin tuning:** the `COINS` object.

## Snapshot album

- Hitting a **5, 10, 15 or 20 streak** in a round takes a snapshot: a 600×800 photo card of the rider in their equipped gear, frozen at the peak of a trick, with a STREAK badge, trick name, date and level. A small "📸 Snapshot saved!" toast shows and play carries on.
- The trick on the card is always one that isn't in the album yet for that ride (4 tricks + 2 grinds each). Once all six are used it only avoids repeating the most recent one.
- **ALBUM** on the start screen shows the grid. Tap a card to open it full screen, then **Save to Photos** (opens the iOS/Android share sheet with the image, where "Save Image" puts it in Photos; on desktop it downloads) or **Delete** (tap twice). Press-and-hold on the picture also works on iPhone.
- Cards are JPEG data URLs (~45 KB each) in `tt_album`, capped at 30 (oldest dropped, and also dropped if storage is full). Nothing is uploaded. Tune with `SNAP_STREAKS`, `ALBUM_CAP` and `SNAP_Q` in `game.js`.

## Saved in the browser (localStorage, `tt_` prefix)

- Chosen rider, level, and answer mode
- Coins (`tt_coins`), owned/equipped gear (`tt_gear`), milestone stats (`tt_stats`), snapshot album (`tt_album`)
- Personal best per level (`tt_best_<level>`)
- Missed facts (`tt_missed`): missed facts come back more often in later rounds until you get them right a few times. The end screen lists them under "Facts to practice".

## Adding a new rider

Add an entry to `RIDERS` in `game.js`: colours, a `stance` (foot/hip/hand positions), a list of `tricks`, optional `grinds` (with the rail contact height), and a `drawVehicle(ctx, pose, rider)` function. The picker, saving, and gameplay pick it up automatically.

## Files

- `index.html`: layout and screens
- `style.css`: styles (portrait-first, safe-area aware)
- `game.js`: the game (canvas scene, riders, problems, scoring)
