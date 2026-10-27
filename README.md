# Puttopia - Adventure Mini Golf

A 3D adventure mini golf game that runs entirely in the browser. Nine themed holes, first-person putting, custom ball physics, toon shading with ink outlines, and synthesised sound. Built with Vite and Three.js.

Everything is generated in code. There are no model, texture or audio files, no backend and no environment variables. Best scores are stored in `localStorage` only.

## Run it locally

You need Node.js 20.19 or newer (Vite 8 requires it).

```bash
npm install
```

```bash
npm run dev
```

Open the address that Vite prints, normally http://localhost:5173.

To make and check a production build:

```bash
npm run build
```

```bash
npm run preview
```

The build is written to `dist/` as plain static files.

## Deploy to Vercel

No configuration is needed. Vercel detects Vite, runs `npm run build` and serves `dist/`.

**From the dashboard**

1. Push this folder to a Git repository.
2. In Vercel choose **Add New > Project** and import the repository.
3. Keep the detected settings (framework Vite, build command `npm run build`, output directory `dist`) and press **Deploy**.

**From the command line**

```bash
npx vercel
```

```bash
npx vercel --prod
```

The first command creates a preview deployment and the second one publishes it.

## How to play

| Action | Control |
| --- | --- |
| Aim | Move the mouse (or use the arrow keys / A and D) |
| Set power | Hold the mouse button and drag back |
| Putt | Release the button. Pull back only a little to cancel |
| Skip the flyover | Click, Space or Enter |
| Restart the hole | R, or the restart button |
| Sound on or off | M, or the speaker button |
| Pause | Esc or P |

On a touch screen drag sideways to aim and drag down to set the power.

- The first click captures the mouse for smooth aiming. Press Esc to free it and open the pause menu.
- Water, lava, goo, the void and out of bounds cost one penalty stroke. The ball goes back to where the last shot was played.
- Every hole ends at 10 strokes.
- **Choose a hole** in the main menu, or **Jump to hole** in the pause menu, takes you straight to any hole. Use **Next hole** to keep playing from there. Only a full round started with **Play 9 holes** counts as a best round.

## The course

| # | Hole | Par | Signature challenge |
| --- | --- | --- | --- |
| 1 | Sunny Meadow | 2 | A mound in the fairway and bouncy mushroom bumpers |
| 2 | Windmill Way | 3 | Putt through the gap under the spinning blades |
| 3 | Pirate Cove | 3 | A narrow bridge, or a full-power ramp jump over the lagoon |
| 4 | Frozen Peak | 3 | A slippery ice chute with a banked hairpin |
| 5 | Dino Valley | 3 | A T-Rex that bites, legs to thread and a sweeping tail |
| 6 | Lava Peak | 3 | A bridge without rails and a cup in the crater of a cone |
| 7 | Clockwork Factory | 4 | Conveyor belts, a spinning gear arm and a shuttle platform |
| 8 | Haunted Hollow | 4 | Swinging pendulums and three portals, only one of them lucky |
| 9 | Cosmic Loop | 5 | Low gravity, a booster, a loop, a leap, bumpers and a sweeper |

## Graphics settings

The **Graphics** button in the main menu switches between auto, high, medium and low. Auto starts high and lowers the render resolution when the frame rate drops below about 47 frames per second.

## Project layout

```
index.html
src/
  main.js          entry point
  game.js          renderer, camera, input, game states and scoring
  physics.js       ball physics: substepped sphere against triangles, solids and moving bodies
  builder.js       course building blocks that create colliders and meshes together
  holes/           the nine holes
  dino.js          the T-Rex
  materials.js     toon materials and floor patterns
  shaders.js       GLSL for sky, water, lava, grass, portals, flags and belts
  postfx.js        outline pass, bloom, tone mapping, FXAA
  particles.js     confetti, splashes, embers, snow
  props.js         scenery pieces
  critters.js      animated animals and other inhabitants
  audio.js         Web Audio sound effects and ambience
  ui.js, style.css menus, HUD and scorecards
  storage.js       localStorage
  solver.js        putting bot used by the checks
tools/
  verify.mjs       headless check of all holes
```

## Checking the holes

```bash
npm run verify
```

This builds every hole without graphics and runs two checks:

- A bot plays each hole and must reach the cup within the stroke limit.
- Random shots are fired at each hole. The run fails if the ball centre ever ends up inside solid geometry or falls through a floor.

You can pass hole numbers and the number of random shots:

```bash
npm run verify -- 5 9 --fuzz 500
```

Two small design helpers live next to it. `node tools/sweep.mjs 6` prints where the first shot of hole 6 ends for each power level. `node tools/cuptest.mjs` prints which arrival speeds the cup captures.

## Technical notes

- **Physics** is custom. The ball moves in substeps no longer than a third of its radius. Contacts are solved deepest first and static geometry is solved last, so a moving obstacle can never push the ball through a wall.
- **Moving obstacles** are functions of time. The same function drives the collider and the visible mesh.
- **Outlines** come from a depth and normal pre-pass with edge detection. Depth edges use the Laplacian of inverse depth, which is zero on any flat surface.
- **Static scenery** is merged by material and coloured per vertex, which keeps each hole at roughly 100 draw calls per pass.
