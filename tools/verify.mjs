// Headless check: builds every hole without graphics, lets a bot play it and
// fires random shots to make sure the ball never escapes through geometry.
//   npm run verify              all holes
//   npm run verify -- 3 5       only holes 3 and 5
//   npm run verify -- --fuzz 400
import { HOLES } from '../src/holes/index.js';
import { solveHole, simulate } from '../src/solver.js';
import { Ball, BALL_R } from '../src/physics.js';

const args = process.argv.slice(2);
let fuzz = 150;
const only = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--fuzz') fuzz = Number(args[++i]);
  else only.push(Number(args[i]) - 1);
}

let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

let failed = 0;
for (let i = 0; i < HOLES.length; i++) {
  if (only.length && !only.includes(i)) continue;
  const t0 = Date.now();
  const hole = HOLES[i].build({ visual: false });
  const w = hole.world;
  const res = solveHole(hole);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const tag = res.ok ? 'OK  ' : 'FAIL';
  if (!res.ok) failed++;
  console.log(`${tag} hole ${i + 1} ${hole.info.name.padEnd(18)} par ${hole.info.par}  bot: ${res.strokes} strokes  (${w.triMat.length} tris, ${w.statics.length} solids, ${w.bodies.length} movers, ${secs}s)`);
  for (const s of res.shots) {
    const end = s.holed ? 'IN THE CUP' : s.hazard ? `hazard:${s.hazard}` : `rest at ${s.end.join(', ')}`;
    console.log(`       yaw ${s.yaw.toFixed(2).padStart(6)} power ${s.power.toFixed(2)} wait ${s.delay.toFixed(1)} -> ${end}`);
  }

  // fuzz: random shots from the tee and from wherever they end
  const tee = hole.info.tee;
  let bad = 0, hazards = 0, holed = 0, timeouts = 0, maxInside = 0;
  const notes = [];
  const ball = new Ball();
  ball.place(tee[0], tee[1] + BALL_R + 0.001, tee[2]);
  let t = 0;
  for (let k = 0; k < fuzz; k++) {
    const yaw = rnd() * Math.PI * 2, power = 0.1 + rnd() * 0.9;
    let worst = 0;
    let where = null;
    const r = simulate(w, ball, t, yaw, power, 0, 30, (b, world) => {
      // the centre must never sit inside solid static geometry
      const c = world.cup;
      if (c && Math.hypot(b.px - c.x, b.pz - c.z) < 0.4 && b.py < c.y + 0.12) return;
      if (world.overlaps(b.px, b.py, b.pz, 0.015)) { worst++; where = [b.px, b.py, b.pz]; }
    });
    if (worst > 2) {
      bad++;
      maxInside = Math.max(maxInside, worst);
      if (notes.length < 4) notes.push(`inside geometry near ${where.map((v) => v.toFixed(2)).join(', ')} (${worst} steps)`);
    }
    if (r.timeout) timeouts++;
    if (r.hazard) {
      hazards++;
      // a ball lost just under a floor it should be standing on means it tunnelled
      const g = w.groundAt(r.ball.px, r.ball.pz, 60, r.ball.py + BALL_R * 0.5);
      if (g && !g.mat.hazard && r.hazard !== 'water' && r.hazard !== 'lava' && g.y - r.ball.py > 0.2 && g.y - r.ball.py < 0.6) {
        bad++;
        if (notes.length < 4) notes.push(`fell through floor near ${r.ball.px.toFixed(2)}, ${r.ball.pz.toFixed(2)}`);
      }
    }
    if (r.holed) holed++;
    t = r.time;
    if (r.hazard || r.holed || r.timeout || rnd() < 0.15) {
      ball.place(tee[0], tee[1] + BALL_R + 0.001, tee[2]);
    } else {
      ball.copy(r.ball);
    }
  }
  console.log(`       fuzz ${fuzz} shots: ${holed} holed, ${hazards} hazards, ${timeouts} timeouts, ${bad} suspicious`);
  for (const n of notes) console.log(`         - ${n}`);
  if (bad > 0) failed++;
}
if (failed) {
  console.log(`\n${failed} problem(s) found`);
  process.exit(1);
}
console.log('\nAll holes can be completed.');
