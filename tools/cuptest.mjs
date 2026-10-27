// Design helper: which arrival speeds / offsets does the cup capture?
import { World, Ball, MAT, BALL_R, FIXED_DT } from '../src/physics.js';

function run(speedAtCup, offset) {
  const w = new World();
  w.addQuadUp([-10, 0, -10], [10, 0, -10], [10, 0, 10], [-10, 0, 10], MAT.green);
  w.setCup(0, 0, 0);
  w.killY = -3;
  w.finalize();
  const b = new Ball();
  // start 1 unit before the cup with the speed it should roughly have on arrival
  b.place(offset, BALL_R + 0.001, 1.0);
  w.shoot(b, 0, -1, speedAtCup + 0.18);
  for (let i = 0; i < 120 * 12; i++) {
    w.step(b, FIXED_DT);
    if (b.holed) return 'IN ';
    if (b.stopped) break;
  }
  return Math.hypot(b.px, b.pz).toFixed(1).padStart(3);
}

const offsets = [0, 0.05, 0.1, 0.15, 0.2, 0.25];
console.log(`speed  ${offsets.map((o) => `off ${o.toFixed(2)}`).join('  ')}`);
for (let v = 1; v <= 10.01; v += 0.5) {
  console.log(`${v.toFixed(1).padStart(5)}  ${offsets.map((o) => run(v, o).padEnd(8)).join('  ')}`);
}
