// Design helper: sweeps power (and optionally yaw) for the first shot of a hole
// and prints where the ball ends up.
//   node tools/sweep.mjs <hole> [yawDeg=auto] [yawSpreadDeg=0] [delay=0]
import { HOLES } from '../src/holes/index.js';
import { simulate } from '../src/solver.js';
import { Ball, BALL_R } from '../src/physics.js';

const idx = Number(process.argv[2] || 1) - 1;
const hole = HOLES[idx].build({ visual: false });
const tee = hole.info.tee, cup = hole.info.cup;
const from = process.argv[6] ? process.argv[6].split(',').map(Number) : [tee[0], tee[1] + BALL_R + 0.001, tee[2]];
const auto = Math.atan2(cup[0] - from[0], -(cup[2] - from[2]));
const yaw0 = process.argv[3] && process.argv[3] !== 'auto' ? (Number(process.argv[3]) * Math.PI) / 180 : auto;
const spread = Number(process.argv[4] || 0);
const delay = Number(process.argv[5] || 0);
const ball = new Ball();
ball.place(from[0], from[1], from[2]);
// let the ball settle on the ground first
const yaws = spread > 0 ? [-spread, -spread / 2, 0, spread / 2, spread] : [0];
console.log(`hole ${idx + 1} ${hole.info.name}: from ${from.map((v) => v.toFixed(2))} yaw ${(yaw0 * 180 / Math.PI).toFixed(1)} deg`);
for (const dy of yaws) {
  const row = [];
  for (let p = 0.1; p <= 1.001; p += 0.05) {
    const r = simulate(hole.world, ball, 0, yaw0 + (dy * Math.PI) / 180, p, delay, 30);
    const d = Math.hypot(r.ball.px - cup[0], r.ball.pz - cup[2]);
    row.push(`${p.toFixed(2)}:${r.holed ? 'HOLE' : r.hazard ? r.hazard.slice(0, 4) : d.toFixed(1)}`);
  }
  console.log(`  yaw ${dy >= 0 ? '+' : ''}${dy}: ${row.join(' ')}`);
}
