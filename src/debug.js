// Development-only helpers (never bundled into the production build).
// They let automated checks drive the real game: window.__golf
import * as THREE from 'three';
import { findShot } from './solver.js';

export function install(game) {
  const g = game;

  g.debug = () => {
    const b = g.ball;
    return {
      state: g.state, hole: g.holeIndex, strokes: g.strokes, scores: g.scores.slice(), paused: g.paused, mode: g.mode,
      ball: { x: +b.px.toFixed(3), y: +b.py.toFixed(3), z: +b.pz.toFixed(3), stopped: b.stopped, holed: b.holed, speed: +b.speed().toFixed(3) },
      yaw: g.aimYaw, calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles,
    };
  };

  /** Runs the simulation forward without waiting for real time. */
  g.debugAdvance = (seconds, step = 1 / 60) => {
    const n = Math.ceil(seconds / step);
    for (let i = 0; i < n; i++) g.update(step);
    g.render(step);
    return g.debug();
  };

  g.debugCam = (pos, look) => {
    g.state = 'debugcam';
    const p = new THREE.Vector3(...pos), l = new THREE.Vector3(...look);
    g.debugHook = () => { g.camera.position.copy(p); g.camera.lookAt(l); };
    g.ui.hideIntro();
    g.update(1 / 60);
    g.render(1 / 60);
  };

  g.debugSkipIntro = () => {
    if (g.state === 'flyover') { g.ui.hideIntro(); g.enterAim(true); g.camBlend = 1; }
  };

  g.debugShoot = (yaw, power, instant = false) => {
    g.debugSkipIntro();
    if (g.state !== 'aim') return false;
    g.aimYaw = yaw;
    g.beginSwing(power);
    if (instant) g.stateT = 1;
    return true;
  };

  /** Lets the bot play one stroke through the real game loop. */
  g.debugAuto = (maxWait = 40) => {
    g.debugSkipIntro();
    if (g.state !== 'aim') return { ok: false, state: g.state };
    const t = g.world.time;
    const shot = findShot(g.hole, g.ball, t);
    g.world.setTime(t);
    g.world.events.length = 0;
    if (shot.delay > 0) g.debugAdvance(shot.delay, 1 / 120);
    g.debugShoot(shot.yaw, shot.power, true);
    let waited = 0;
    while ((g.state === 'swing' || g.state === 'roll' || g.state === 'hazard') && waited < maxWait) {
      g.debugAdvance(0.25, 1 / 120);
      waited += 0.25;
    }
    return { ok: true, yaw: shot.yaw, power: shot.power, delay: shot.delay, predicted: shot.result.holed ? 'holed' : shot.result.hazard || 'rest', ...g.debug() };
  };

  window.__golf = g;
}
