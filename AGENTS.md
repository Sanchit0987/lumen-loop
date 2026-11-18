# AGENTS.md — Lumen Loop

Guidance for agents and contributors working in this folder.

## What this is

**Lumen Loop** is an original 3D browser table tennis game: spin-accurate ball
physics, a rigged robot athlete, three AI levels, tournament and local 2-player
modes. Title, characters, UI art and all sound are original; third-party assets
are CC0 only and logged in `ASSETS.md`.

## Stack

- Vite + strict TypeScript.
- Babylon.js (`@babylonjs/core`, WebGPU first, WebGL2 fallback) for rendering.
- Rapier (`@dimforge/rapier3d-compat`, WASM) for rigid bodies, collision and CCD.
- Vitest for unit tests, Playwright for screenshot checks.
- Dev server on strict port **5183**. Node 22+ (workspace bundles Node at
  `../tools/node/bin`; prepend it to `PATH` if `node` is missing).

## Commands

```sh
npm ci
npm run dev        # http://localhost:5183
npm run build      # tsc --noEmit + vite build
npm test           # vitest (physics, scoring, referee, stroke solver, AI, headless matches)
npm run test:e2e   # needs a GPU; also prints measured FPS per quality preset
```

## Architecture (one-way dependencies, top to bottom)

| Folder | Role | May import |
| --- | --- | --- |
| `src/config/` | Every tunable number, colour, string table | nothing |
| `src/math/` | Plain `{x,y,z}` vectors, seeded RNG | config |
| `src/physics/` | Aerodynamics, contact model, flight predictor, Rapier world | math, config |
| `src/rules/` | Scoring and rally referee (pure) | config |
| `src/stroke/` | Swing -> stroke intent, paddle-face solver | physics |
| `src/ai/` | Intercept prediction, shot selection, AI controller | stroke, physics |
| `src/input/` | Pointer/touch/keyboard -> paddle commands | stroke |
| `src/sim/` | `MatchSimulation`: headless, deterministic, no Babylon/DOM | all of the above |
| `src/render/` | Babylon scene, materials, rig, camera, post FX, replay | sim types, config |
| `src/audio/` | Web Audio synthesis with spatial panners | config |
| `src/ui/` | DOM menus and HUD | config |
| `src/game/` | App state machine, modes, tournament, settings, loop | everything |

`src/sim/` and below must stay free of Babylon and DOM so the whole match can
run inside Vitest.

## Hard rules

1. **No magic numbers.** Tunables live in `src/config/`. Only structural
   constants (0, 1, 2, 0.5, array indices, unit conversions named in config)
   may appear in logic.
2. **Small modules.** Keep files focused and under ~220 lines; split first.
3. **Physics contract.** Rapier owns the bodies, integration, gravity and
   continuous collision detection on a fixed 240 Hz step: `physics/world.ts`
   feeds drag and Magnus in as forces and uses Rapier shape casts to find the
   first impact inside each step. The impact itself (restitution, Coulomb
   friction, spin transfer) is resolved by `physics/contact.ts`; Rapier's own
   solver only handles resting and rolling contact. Rapier clamps angular
   velocity near 188 rad/s at this step, so `PhysicsWorld` keeps the
   authoritative spin itself above that. The pure predictor in
   `physics/flight.ts` must use the same formulas (tests compare them).
4. **Tests are required** for spin physics, scoring, referee and AI shot
   selection. Run `npm test` and `npm run build` before claiming completion,
   and look at fresh Playwright screenshots after visual changes.
5. **No copyrighted assets or names.** CC0 downloads only, each logged in
   `ASSETS.md` with source URL and licence. Everything else is procedural.
6. **Performance.** 60 FPS on the medium preset is the target; expensive
   effects must be gated by `config/graphics.ts` presets.
7. Report measured results only. If a check was not run, say so.

## Handling model (human player)

`input/human.ts` is deliberately forgiving, in the style of touch and mouse
table tennis games: the paddle is taken to a playable point on the ball's
predicted flight (depth chosen automatically, x pulled onto the ball's line
within `INPUT.assistReach`), the stroke always returns the ball with at least
`SWING.minPower`, and power comes from the cursor's on-screen flick speed
(`input/pointer.ts`), not from paddle travel. Risk comes from `SWING.powerScatter`
(hard swings land less precisely) and `PADDLE.humanSpeed` (wide fast balls can
get past). `tests/unit/human.test.ts` plays scripted hands against each level;
keep it passing when retuning.

## Known exceptions

- Canvas-drawing proportions in `render/textures.ts` and all CSS values are
  written inline rather than in `src/config/`.
- URL switches for testing: `?renderer=webgl2`, `?quality=low|medium|high`,
  `?autoplay=1` (AI plays the near side), `?seed=N`. `window.lumenLoop`
  exposes the app for Playwright.

## Conventions

- Right-handed scene, metres, seconds, radians. Table centre is the origin,
  +Y up. Player 0 stands at +Z and hits towards -Z; player 1 mirrors that.
- Angular velocity is in rad/s; topspin is positive in `physics/spin.ts`.
- Simulation code is deterministic given a seed: use `math/random.ts`, never
  `Math.random`, below `src/game/`.
