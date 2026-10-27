// A simple putting bot. It is used by tools/verify.mjs to prove that every
// hole can be completed, and by the debug hooks of the game.
import { Ball, FIXED_DT } from './physics.js';
import { powerToSpeed } from './rules.js';

function pathProgress(path, x, y, z) {
  let best = -1e9, acc = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const l2 = dx * dx + dy * dy + dz * dz;
    const len = Math.sqrt(l2);
    let t = l2 > 0 ? ((x - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = a[0] + dx * t, py = a[1] + dy * t, pz = a[2] + dz * t;
    const d = Math.hypot(x - px, (y - py) * 3, z - pz);
    const s = acc + len * t - d * 1.2;
    if (s > best) best = s;
    acc += len;
  }
  return best;
}

/** Simulates one shot. Returns the outcome and the final ball state. */
export function simulate(world, ball0, t0, yaw, power, delay = 0, maxTime = 26, trace = null) {
  world.setTime(t0);
  world.events.length = 0;
  const ball = new Ball().copy(ball0);
  let moved = false;
  const waitSteps = Math.round(delay / FIXED_DT);
  for (let i = 0; i < waitSteps; i++) {
    world.step(ball, FIXED_DT);
    if (!ball.stopped) moved = true;
  }
  world.events.length = 0;
  let holed = false, hazard = null, steps = 0;
  if (!moved) world.shoot(ball, Math.sin(yaw), -Math.cos(yaw), powerToSpeed(power));
  const maxSteps = Math.round(maxTime / FIXED_DT);
  while (steps < maxSteps) {
    world.step(ball, FIXED_DT);
    steps++;
    if (trace) trace(ball, world);
    if (ball.holed) { holed = true; break; }
    if (ball.hazard) { hazard = ball.hazard; break; }
    if (ball.stopped) break;
  }
  world.events.length = 0;
  return { holed, hazard, ball, time: world.time, timeout: steps >= maxSteps };
}

function score(res, path) {
  if (res.holed) return 1e6 - res.time;
  if (res.hazard) return -1e6;
  if (res.timeout) return -5e5;
  return pathProgress(path, res.ball.px, res.ball.py, res.ball.pz);
}

/**
 * Finds a good shot from the current state. Returns {yaw, power, delay, result, score}.
 */
export function findShot(hole, ball, t0, opts = {}) {
  const world = hole.world;
  const path = hole.info.path.map((p) => [p[0], p[1] + 0.1, p[2]]);
  const timed = world.bodies.length > 0;
  const delays = timed ? (opts.delays || hole.info.solverDelays || [0, 0.7, 1.4, 2.1, 2.8, 3.5]) : [0];
  const yawStep = opts.yawStep || 6;
  const powers = opts.powers || [0.08, 0.16, 0.25, 0.35, 0.47, 0.6, 0.75, 0.9, 1.0];
  const cup = hole.info.cup;
  const toCup = Math.atan2(cup[0] - ball.px, -(cup[2] - ball.pz));
  const cands = [];
  const test = (yaw, power, delay) => {
    const result = simulate(world, ball, t0, yaw, power, delay, opts.maxTime || 24);
    const sc = score(result, path);
    cands.push({ yaw, power, delay, result, score: sc });
    return sc;
  };
  for (let a = 0; a < 360; a += yawStep) {
    const yaw = toCup + (a * Math.PI) / 180;
    for (const p of powers) {
      for (const d of delays) test(yaw, p, d);
    }
  }
  cands.sort((a, b) => b.score - a.score);
  // refine around the most promising candidates
  const top = cands.slice(0, opts.refine || 6);
  for (const c of top) {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (const dp of [-0.06, -0.03, 0, 0.03, 0.06]) {
        if (dy === 0 && dp === 0) continue;
        const p = Math.max(0.03, Math.min(1, c.power + dp));
        test(c.yaw + (dy * Math.PI) / 180, p, c.delay);
      }
    }
  }
  cands.sort((a, b) => b.score - a.score);
  return cands[0];
}

/** Plays a whole hole. Returns the list of shots and the stroke count. */
export function solveHole(hole, opts = {}) {
  const tee = hole.info.tee;
  const ball = new Ball();
  ball.place(tee[0], tee[1] + 0.101, tee[2]);
  let t = 0;
  let strokes = 0;
  const shots = [];
  let safe = [ball.px, ball.py, ball.pz];
  const cap = opts.cap || 10;
  while (strokes < cap) {
    const shot = findShot(hole, ball, t, opts);
    strokes++;
    const r = shot.result;
    shots.push({
      yaw: +shot.yaw.toFixed(3), power: +shot.power.toFixed(2), delay: shot.delay,
      end: [+r.ball.px.toFixed(2), +r.ball.py.toFixed(2), +r.ball.pz.toFixed(2)],
      holed: r.holed, hazard: r.hazard,
    });
    t = r.time;
    if (r.holed) return { ok: true, strokes, shots };
    if (r.hazard) {
      strokes++;
      ball.place(safe[0], safe[1], safe[2]);
    } else {
      ball.copy(r.ball);
      if (!ball.rider) safe = [ball.px, ball.py, ball.pz];
    }
  }
  return { ok: false, strokes, shots };
}
