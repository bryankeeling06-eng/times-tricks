# Times Tricks

A multiplication street-runner for ages 10–11. Pick a skateboard or scooter, roll through a sunset skatepark, and answer each times-table problem before you hit the gate. Right answer = trick + points. Wrong answer = wipeout (and you see the right answer).

**Play:** https://bryankeeling06-eng.github.io/times-tricks/

Plain static HTML/CSS/JS with no build step, no external requests, no ads, no trackers.

## How to play

1. Pick a ride, a level, and an answer mode (number pad or 3 choices).
2. Tap **Drop In** (or press Enter).
3. Type the answer on the pad (or keyboard digits + Enter) before the gate bar runs out. In choices mode tap an answer (or press 1 / 2 / 3).
4. Rounds last 75 seconds. Streaks raise the multiplier (x2 at 3, x3 at 6, x4 at 9, x5 at 12) and speed things up slightly.

## Levels

1. Tables 2–5
2. Tables 6–9
3. Mixed up to 12 × 12
4. Missing factor (`? × 7 = 56`)
5. 2-digit × 1-digit

## Saved in the browser (localStorage, `tt_` prefix)

- Chosen rider, level, and answer mode
- Personal best per level (`tt_best_<level>`)
- Missed facts (`tt_missed`): missed facts come back more often in later rounds until you get them right a few times. The end screen lists them under "Facts to practice".

## Adding a new rider

Add an entry to `RIDERS` in `game.js`: colours, a `stance` (foot/hip/hand positions), a list of `tricks`, and a `drawVehicle(ctx, pose, rider)` function. The picker, saving, and gameplay pick it up automatically.

## Files

- `index.html`: layout and screens
- `style.css`: styles (portrait-first, safe-area aware)
- `game.js`: the game (canvas scene, riders, problems, scoring)
