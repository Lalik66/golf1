Give this game a completely new color scheme so it looks like a different game. Change colors only: don't touch layout, hole shapes, physics, gameplay, text or sizes.
>
> New look: **[pick one: warm sunset pastels / dark neon night / autumn forest / candy pink and mint / your own idea]**.
>
> 1. Interface: replace the palette in the `:root` block of `src/style.css` (`--ink`, `--paper`, `--sun`, `--sun-deep`, `--grass`, `--grass-deep`, `--sky`, `--berry`, `--grape`). Also update the hex colors written directly in `src/style.css` (gradients, the `html, body` background, hover colors) so they match.
> 2. Hole cards: give each hole a new `accent` color in `src/holes/index.js` that fits the new scheme.
> 3. 3D scenes: in each `src/holes/hole1.js` to `hole9.js`, shift the `b.theme()` colors (`skyTop`, `skyHorizon`, `skyBottom`, `fog`, `hemiSky`, `hemiGround`, `sunColor`). Also change the main floor, wall and turf colors toward the new scheme. Keep each hole's own identity: lava still reads as hot, ice as cold.
> 4. Keep text readable, with strong contrast between text and its background.
Do it in two steps if you want more control.** First ask for only the interface (step 1) and look at it. Then ask for the 3D scenes.
