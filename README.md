# Lumen Loop

An original 3D table tennis game for the browser. Move the paddle to the ball
and it plays the stroke; flick the mouse or finger as you meet it to add pace.
Flick speed sets power, flick angle sets direction and sidespin, and the
stroke style (auto, loop, chop) sets topspin or backspin. The ball obeys
drag, Magnus lift and spin-dependent bounces on a fixed 240 Hz Rapier step.

## Run

```sh
npm ci
npm run dev      # http://localhost:5183
```

If `node` is not on your PATH, this workspace bundles one:
`export PATH="$PWD/../tools/node/bin:$PATH"`.

```sh
npm run build    # typecheck + production build
npm test         # unit tests
npm run test:e2e # Playwright screenshot checks
```

## How to play

| Action | Mouse | Touch | Player 1 keys | Player 2 keys |
| --- | --- | --- | --- | --- |
| Move paddle | Move the mouse | Drag | A / D | Left / Right |
| Serve toss | Click | Tap | Space | Enter |
| Hit | Be near the ball (soft return); flick up the screen for pace | Same, with a swipe | Hold W | Hold Down |
| Aim | Angle the swing left or right | Angle the swipe | A / D while swinging | Left / Right while swinging |
| Topspin loop | Hold left button | Hold LOOP | F | `.` |
| Backspin chop | Hold right button | Hold CHOP | G | `,` |
| Pause / mute / restart | Esc or P / M / R | HUD buttons | same | same |

A gold ring on your half shows where the ball will land, and the paddle is
drawn onto the ball's line when you are close. Holding still returns a soft,
safe push; faster flicks drive with topspin but land less precisely. A click
alone serves; flick as the ball drops for a faster serve. Games are to 11, win by 2, serve changes every 2 points (every
point from 10-10), matches are best of 3 or 5.

Modes: Quick Match (Easy / Normal / Hard), Tournament (four opponents with
different styles), and Local 2-Player.

Local 2-Player shares one screen: Player 1 is the near side (mouse or keys),
Player 2 the far side (arrow keys). A match-winning point is replayed in slow
motion from several camera angles; click or press Esc to skip it.

See `AGENTS.md` for architecture and rules, `ASSETS.md` for asset licences.
