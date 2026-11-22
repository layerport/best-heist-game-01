# The Midnight Vault — Best Heist Game

[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/c/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/layerport/best-heist-game-01/rank.svg)](https://make.fun/c/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/layerport/best-heist-game-01/reward.svg)](https://make.fun/c/best-heist-game-20261122-0559)

A one-room stealth heist game for the [make.fun best-heist-game-20261122-0559](https://make.fun/c/best-heist-game-20261122-0559) bounty, built as `@layerport`.

Steal the **Star of Meridia** diamond from a museum at night and reach the green EXIT before the alarm fills. Two guards patrol with sweeping vision cones, two wall cameras sweep the hall, and display cases, crates and pillars are the only things between you and a spotlight.

## How to play

- **Move:** WASD / arrow keys, or click anywhere to sneak there.
- **Tools (buy with coins):** `1` smoke pellet (2¢, hide inside the cloud) • `2` noise-maker (1¢, lures the nearest guard to your mouse) • `3` camera jammer (2¢, blinds both cameras for 5s).
- **Coins:** walk over gold coins to pocket them; you start with 3¢.
- **Alarm:** rises while a guard or camera sees you, drains while you stay hidden. At 100% the museum locks down and you are caught. A guard touching you ends the run on the spot.
- **Win:** grab the diamond, then reach the green EXIT door. Your rating (S/A/B/C) depends on time and how often you were spotted.
- **Keys:** `P` pause • `M` mute • `R` restart after a win or a capture.

## Run it

```sh
node serve.ts        # then open http://localhost:8080/
```

## Layout

- `game/index.html` — the page; `game/css/style.css` — page chrome.
- `game/js/config.js` — every tunable number (speeds, cones, alarm, tools).
- `game/js/levels.js` — the room: cover, pillars, coins, loot, exit, routes.
- `game/js/audio.js` — WebAudio sounds, no audio files.
- `game/js/guards.js` — guard patrols, cameras, vision-cone checks.
- `game/js/game.js` — state, input, rules, rendering, HUD.
- `game/js/shots.js` — `?shot=` staging for screenshots.
- `main.ts` — copies `game/` + `screenshots/` to the output and writes `dossier.json`.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

## Screenshots

Four real renders of the game's own code, under `screenshots/`: the cover
shows a stealth approach mid-room, then a cone closing in with smoke out,
the diamond stolen on the run to the getaway, and the title screen.
