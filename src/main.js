import './style.css';
import { Game } from './game.js';

function fatal(msg) {
  const d = document.createElement('div');
  d.id = 'fatal';
  d.innerHTML = `<div><h2>Puttopia could not start</h2><p>${msg}</p></div>`;
  document.getElementById('app').appendChild(d);
  const l = document.getElementById('loading');
  if (l) l.remove();
}

function start() {
  const canvas = document.getElementById('game');
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) {
    fatal('This game needs WebGL 2. Please try a recent version of Chrome, Edge, Firefox or Safari.');
    return;
  }
  try {
    const game = new Game(canvas, document.getElementById('ui'));
    game.start();
    if (import.meta.env.DEV) import('./debug.js').then((d) => d.install(game));
    const l = document.getElementById('loading');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      l.classList.add('out');
      setTimeout(() => l.remove(), 700);
    }));
  } catch (e) {
    console.error(e);
    fatal(`Something went wrong while starting the game.<br><small>${String(e && e.message ? e.message : e)}</small>`);
  }
}

start();
