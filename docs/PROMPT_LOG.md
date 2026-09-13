# Prompt log

Rohit's Road was built in a single agent session from four short prompts. Those
prompts were terse — the first one alone asked for the entire game — so what
follows is a rewritten version: the same intent, split into discrete steps and
spelled out the way you would write them if you were starting over and wanted
predictable results.

Read this as a recipe, not a transcript. The verbatim originals are in the
appendix at the bottom.

---

## Phase 1 — Plan before writing code

> Recreate *Crossy Road* as a browser game called **Rohit's Road**. Before
> writing any code, survey the workspace and give me a written plan covering the
> tech stack, the file layout, the rendering approach, and the gameplay systems
> you intend to build. I want to see the plan first, then have you implement it.

> Three non-negotiables for the whole build: it has to run seamlessly with no
> hitches or loading screens, it has to fill the entire browser window at any
> aspect ratio, and the visuals have to be as close to the original as you can
> get them.

## Phase 2 — Project scaffold

> Set up a Vite project with Three.js as the only runtime dependency. Use plain
> ES modules, no framework and no TypeScript. Split the source into one file per
> concern rather than one large file.

> Create a full-window canvas with no scrollbars, no text selection and no
> touch-scroll bounce. Handle resize and device pixel ratio, capping DPR at 2.
> Run everything from a single `requestAnimationFrame` loop with the delta time
> clamped so a backgrounded tab cannot teleport the world on return.

## Phase 3 — Camera and lighting

> Use an orthographic camera at a fixed angle so the world reads as a flat toy
> diorama with no perspective divergence. The camera follows the player with
> smoothed, frame-rate independent damping, leads slightly ahead of them, and
> limits how far it pans sideways.

> Size the frustum in world units rather than pixels, and widen it on tall
> screens so a phone in portrait never sees an unplayably narrow slice of the
> board.

> Light the scene flat and bright: ambient plus a hemisphere fill plus one
> directional sun with a soft shadow map. Have the sun and its shadow frustum
> follow the camera so shadows stay sharp wherever the player is. Give the scene
> a vertical sky gradient generated on a canvas, not an image file.

## Phase 4 — Models, all generated in code

> Build every model out of boxes and simple primitives at runtime. No external
> art assets at all — the game should load instantly and work offline.

> Model a chicken with a body, wings, tail, head, orange beak and feet, a red
> comb and wattle, and dark eyes, facing away from the camera.

> Model cars with a coloured body, matching cabin, dark glass on all four sides,
> visible wheels, and headlights and tail lights. Give cars a palette of
> saturated colours picked at random. Model box trucks with a light cab, a
> separate trailer and three axles.

> Model tiered trees whose height varies from one to three blocks, faceted
> cylindrical logs with darker end caps, lily pads, rocks, coins, multi-car
> trains, rails with crossing signals, and a swooping eagle with wings on
> pivots so they can flap.

> Cache and share every geometry and material. For repeating detail like lane
> dashes and rail sleepers, draw a canvas texture and tile it across the row
> slab instead of spawning hundreds of small meshes.

## Phase 5 — The endless world

> Generate the world one row at a time in four types: grass, road, river and
> railroad. Stream rows in ahead of the player and recycle them behind.

> Generate in bands rather than per row. Commit to a run of one to four roads or
> one to three river rows at a time, then insert grass as breathing room. Roads
> may sit directly against each other; rivers and railroads must not. Ramp
> difficulty over roughly the first 170 rows.

> Keep the first few rows empty so the player never starts trapped, and cap the
> number of trees per grass row so a row can never be fully walled off.

> Wall off the playfield with a treeline: two real trees at the boundary and a
> single scaled hedge block covering everything beyond, so wide monitors never
> see the edge of the world but the mesh count stays flat.

## Phase 6 — Traffic, rivers and trains

> Model traffic as wrapping convoys. Each road picks a direction, a speed and a
> vehicle type, then spaces N vehicles evenly around a fixed-length loop with a
> little jitter. Advance them with one phase value per row and wrap. Spacing
> baked in at generation time means a car can never spawn on top of another, and
> traffic entering the screen looks like it has been driving all along.

> Use the same convoy model for river logs at slower speeds, and alternate the
> direction of consecutive river rows so crossings stay fair. Some rivers should
> use static lily pads instead of logs.

> Give each railroad row an idle → warning → train cycle. Alternate the crossing
> signal lamps for about a second and a half before the train crosses fast.

## Phase 7 — The player

> Movement is discrete grid hops on a short timer, with a parabolic arc and
> squash-and-stretch. Buffer one queued input so a fast second press during a
> hop still registers. Turn the chicken to face the direction it is moving,
> taking the shorter way round.

> Landing on a log attaches the player at a fixed offset so they ride at a
> fractional column; hopping off snaps to the nearest lane. Drifting past the
> edge of the playfield kills you, as does landing in open water.

> Trees and rocks block movement rather than ending the run.

## Phase 8 — Game rules and feel

> Score is the furthest row reached, counting forward progress only.

> Scroll the camera forward on its own once the player makes their first move,
> faster as the score climbs, and never let it lag more than a few rows behind
> them. If the player falls too far behind the scroll line, send in the eagle to
> snatch them.

> Give each death its own treatment: flatten the chicken under traffic and
> trains, sink it in water, and have the eagle carry it off screen. Show the
> cause of death on the game over screen.

> Synthesise all sound effects with the Web Audio API — hopping, coins,
> splashes, crashes, the eagle screech and a train horn. No audio files. Include
> a mute toggle that persists.

## Phase 9 — Interface

> Build the HUD in DOM over the canvas, not in the 3D scene: a chunky outlined
> score, best score, coin counter and mute button, with a title screen and a
> game over panel.

> Support keyboard and touch. Arrow keys or WASD to move, space to hop forward,
> tap to hop forward, swipe to hop in a direction. Swallow input briefly after a
> death so the tap that killed you does not skip the game over screen.

> Persist best score, coin total and the mute setting in `localStorage`.
> Restarting must not reload the page.

## Phase 10 — Tuning pass

> Make the cars travel a little slower and appear less frequently. Widen the
> gaps between vehicles and lower the top speed the difficulty ramp can reach,
> so busy lanes stay readable instead of becoming a solid wall of traffic.

## Phase 11 — Ship it

> Save this project and push it to GitHub. Add a `.gitignore` first so
> dependencies and environment files stay out, show me what will be committed
> before you commit it, and let me handle the sign-in myself.

## Phase 12 — Document it

> Write a README covering how to run the game, the controls, and how the code is
> organised, including the reasoning behind the camera, the world streaming, the
> object pooling and the convoy traffic model. Be honest about what does not yet
> match the original.

> Write a prompt log of everything I asked for, rephrased and broken into
> discrete steps.

---

## What would have been worth asking for up front

Things that only surfaced mid-build, and that would have saved a pass if they
had been in the first prompt:

- **Measure the reference, do not eyeball it.** "Match the visuals" is not
  actionable. Pulling a real screenshot and measuring the row angle, the tile
  spacing and the exact palette turns it into numbers. Doing that late meant
  building the camera twice.
- **Say where the tuning constants live.** Asking for speeds, gaps, colours and
  difficulty curves to sit in one constants file makes every later "a bit
  slower, a bit less often" request a one-line change.
- **Name the performance rule explicitly.** "Seamless" became useful only once
  it was restated as: allocate nothing during play, pool every object, share
  every geometry and material.

---

## Appendix: the original prompts

Verbatim, in order, for provenance.

1. > recreate crossy road. name it rohit's road. plan it out first. make sure
   > its seamless, takes up the whole screen, and has nearly identical visuals
2. > make the cars go a little slower and less frequently
3. > push this to git andsave it
4. > put a readme and a prompt log of all the prompts that I gave you to
   > generate this game. rephrase them and break it up.

Phases 2 through 9 above are all unpacked from prompt 1.
