// DOM user interface: menus, HUD, scorecards. The 3D canvas sits underneath.
import { fmtScore } from './utils.js';

const ICON = {
  restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-4.9 6H5.1A7 7 0 1 0 12 5z"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4 4 0 0 0-2.2-3.6v7.2a4 4 0 0 0 2.2-3.6zM14.3 4.3v2.1a6 6 0 0 1 0 11.2v2.1a8 8 0 0 0 0-15.4z"/></svg>',
  mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm17.3.1-1.4-1.4L17.5 10l-2.4-2.3-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4-2.4-2.4 2.4-2.4z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2.4H4zm0 4.8h16v2.4H4zm0 4.8h16V18H4z"/></svg>',
  flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h2v20H6zm3 1 10 4.5L9 12z"/></svg>',
};

const $ = (sel, root = document) => root.querySelector(sel);

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function scoreLabel(strokes, par) {
  if (strokes === 1) return 'HOLE IN ONE!';
  const d = strokes - par;
  if (d <= -3) return 'ALBATROSS!';
  if (d === -2) return 'EAGLE!';
  if (d === -1) return 'BIRDIE!';
  if (d === 0) return 'PAR';
  if (d === 1) return 'BOGEY';
  if (d === 2) return 'DOUBLE BOGEY';
  if (d === 3) return 'TRIPLE BOGEY';
  return `+${d}`;
}

function scoreClass(strokes, par) {
  if (strokes === undefined || strokes === null) return '';
  if (strokes === 1) return 'ace';
  const d = strokes - par;
  if (d <= -2) return 'eagle';
  if (d === -1) return 'birdie';
  if (d === 0) return 'par';
  if (d === 1) return 'bogey';
  return 'double';
}

export class UI {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers;
    this.holes = [];
    this.build();
  }

  build() {
    const r = this.root;
    r.innerHTML = `
      <div id="hud" class="layer hidden">
        <div class="hud-left">
          <div class="pill hole-pill"><span class="ico">${ICON.flag}</span><span id="hud-hole">HOLE 1</span></div>
          <div class="hole-name" id="hud-name"></div>
        </div>
        <div class="hud-mid">
          <div class="stat"><span class="k">PAR</span><span class="v" id="hud-par">3</span></div>
          <div class="stat big"><span class="k">STROKES</span><span class="v" id="hud-strokes" aria-live="polite">0</span></div>
          <div class="stat"><span class="k">TOTAL</span><span class="v" id="hud-total">E</span></div>
        </div>
        <div class="hud-right">
          <button class="icon-btn" id="btn-restart" title="Restart hole (R)">${ICON.restart}<span class="key">R</span></button>
          <button class="icon-btn" id="btn-mute" title="Sound on or off (M)"><span id="mute-ico">${ICON.sound}</span><span class="key">M</span></button>
          <button class="icon-btn" id="btn-menu" title="Pause (Esc)">${ICON.menu}<span class="key">Esc</span></button>
        </div>
        <div id="power" class="hidden">
          <div class="power-label">POWER</div>
          <div class="power-track"><div class="power-fill" id="power-fill"></div><div class="power-ticks"></div></div>
          <div class="power-val" id="power-val">0%</div>
        </div>
        <div id="hint" class="hidden"></div>
        <div id="toast" class="hidden" role="status" aria-live="assertive" aria-atomic="true"></div>
      </div>

      <div id="banner" class="hidden" role="status" aria-live="assertive" aria-atomic="true"><div class="banner-main" id="banner-main"></div><div class="banner-sub" id="banner-sub"></div></div>
      <div id="intro" class="hidden">
        <div class="intro-card">
          <div class="intro-num" id="intro-num">HOLE 1</div>
          <div class="intro-name" id="intro-name"></div>
          <div class="intro-par" id="intro-par">PAR 3</div>
          <div class="intro-hint" id="intro-hint"></div>
        </div>
        <div class="skip">Click or press <b>Space</b> to skip</div>
      </div>

      <div id="menu" class="layer screen hidden">
        <div class="menu-inner">
          <div class="logo">
            <div class="logo-top">ADVENTURE MINI GOLF</div>
            <div class="logo-main"><span>P</span><span>U</span><span>T</span><span>T</span><span class="ball-o"></span><span>P</span><span>I</span><span>A</span></div>
            <div class="logo-sub">Nine wild holes. One tiny ball.</div>
          </div>
          <div class="menu-buttons" id="menu-main">
            <button class="btn primary" id="m-play">Play 9 holes</button>
            <button class="btn" id="m-practice">Choose a hole</button>
            <button class="btn" id="m-help">How to play</button>
          </div>
          <div class="menu-foot">
            <div class="best" id="m-best"></div>
            <div class="toggles">
              <button class="chip" id="m-sound">Sound: on</button>
              <button class="chip" id="m-quality">Graphics: auto</button>
            </div>
          </div>
        </div>
      </div>

      <div id="select" class="layer screen hidden" role="dialog" aria-modal="true" aria-label="Choose a hole">
        <div class="panel wide" tabindex="-1">
          <h2>Choose a hole</h2>
          <div class="select-note" id="select-note">Jump straight to any hole. Play on from there with Next hole.</div>
          <div class="grid" id="select-grid"></div>
          <div class="row"><button class="btn" id="s-back">Back</button></div>
        </div>
      </div>

      <div id="help" class="layer screen hidden" role="dialog" aria-modal="true" aria-label="How to play">
        <div class="panel" tabindex="-1">
          <h2>How to play</h2>
          <ul class="help-list">
            <li><b>Aim</b> Move the mouse to look around and line up your shot.</li>
            <li><b>Power</b> Hold the mouse button and drag back. The further you pull, the harder the putt.</li>
            <li><b>Putt</b> Release to strike the ball. Pull back only a little to cancel.</li>
            <li><b>Hazards</b> Water, lava and out of bounds cost one stroke and return the ball to its last spot.</li>
            <li><b>Limit</b> Each hole stops at 10 strokes.</li>
            <li><b>Keys</b> R restarts the hole, M mutes the sound, Esc pauses, Space skips the flyover.</li>
          </ul>
          <div class="row"><button class="btn primary" id="h-back">Got it</button></div>
        </div>
      </div>

      <div id="pause" class="layer screen hidden" role="dialog" aria-modal="true" aria-label="Paused">
        <div class="panel" tabindex="-1">
          <h2>Paused</h2>
          <div class="menu-buttons">
            <button class="btn primary" id="p-resume">Resume</button>
            <button class="btn" id="p-restart">Restart hole</button>
            <button class="btn" id="p-jump">Jump to hole</button>
            <button class="btn" id="p-sound">Sound: on</button>
            <button class="btn" id="p-quit">Main menu</button>
          </div>
        </div>
      </div>

      <div id="card" class="layer screen hidden" role="dialog" aria-modal="true" aria-label="Scorecard">
        <div class="panel wide card-panel" tabindex="-1">
          <div class="card-head">
            <div class="card-title" id="card-title">BIRDIE!</div>
            <div class="card-sub" id="card-sub"></div>
          </div>
          <div class="card-table-wrap"><table class="card-table" id="card-table"></table></div>
          <div class="card-foot" id="card-foot"></div>
          <div class="row" id="card-buttons"></div>
        </div>
      </div>
    `;

    this.hud = $('#hud', r);
    this.menu = $('#menu', r);
    this.select = $('#select', r);
    this.help = $('#help', r);
    this.pause = $('#pause', r);
    this.card = $('#card', r);
    this.banner = $('#banner', r);
    this.intro = $('#intro', r);
    this.power = $('#power', r);
    this.hint = $('#hint', r);
    this.toastEl = $('#toast', r);

    const click = (id, fn) => $(id, r).addEventListener('click', (e) => { e.stopPropagation(); this.h.click(); fn(e); });
    click('#m-play', () => this.h.play());
    click('#m-practice', () => this.showSelect('menu'));
    click('#p-jump', () => this.showSelect('pause'));
    click('#m-help', () => { this.hide(this.menu); this.show(this.help); });
    click('#h-back', () => { this.hide(this.help); this.show(this.menu); });
    click('#s-back', () => { this.hide(this.select); this.show(this.selectFrom === 'pause' ? this.pause : this.menu); });
    click('#m-sound', () => this.h.toggleMute());
    click('#p-sound', () => this.h.toggleMute());
    click('#m-quality', () => this.h.cycleQuality());
    click('#btn-restart', () => this.h.restart());
    click('#btn-mute', () => this.h.toggleMute());
    click('#btn-menu', () => this.h.pause());
    click('#p-resume', () => this.h.resume());
    click('#p-restart', () => this.h.restart());
    click('#p-quit', () => this.h.quit());
    for (const b of r.querySelectorAll('button')) {
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('mousedown', (e) => e.stopPropagation());
    }
  }

  show(e) { e.classList.remove('hidden'); }

  hide(e) { e.classList.add('hidden'); }

  /** Move focus into a freshly-opened dialog so keyboard/AT users land inside it. */
  focus(screen) {
    const p = screen.querySelector('.panel');
    if (p) { try { p.focus({ preventScroll: true }); } catch (e) { p.focus(); } }
  }

  setHoles(list) { this.holes = list; }

  // ------------------------------------------------------------ menu
  showMenu(save) {
    this.hideAll();
    this.show(this.menu);
    const best = $('#m-best', this.root);
    if (save.bestTotal !== null && save.bestTotal !== undefined) {
      const par = this.holes.reduce((a, h) => a + h.par, 0);
      best.innerHTML = `Best round <b>${save.bestTotal}</b> <span class="muted">(${fmtScore(save.bestTotal - par)})</span>`;
    } else {
      best.innerHTML = 'No round finished yet';
    }
  }

  showSelect(from = 'menu') {
    this.selectFrom = from;
    this.hide(this.menu);
    this.hide(this.pause);
    this.show(this.select);
    const grid = $('#select-grid', this.root);
    grid.innerHTML = '';
    const save = this.h.save();
    this.holes.forEach((h, i) => {
      const best = save.bestHoles[i];
      const c = el('button', 'hole-card', `
        <div class="hc-num">${i + 1}</div>
        <div class="hc-name">${h.name}</div>
        <div class="hc-meta">Par ${h.par}${best ? ` · Best ${best}` : ''}</div>`);
      c.style.setProperty('--accent', h.accent || '#ffd23f');
      if (i === this.currentIndex && from === 'pause') c.classList.add('current');
      c.addEventListener('click', () => { this.h.click(); this.h.practice(i); });
      grid.appendChild(c);
    });
    this.focus(this.select);
  }

  setMuted(m) {
    $('#m-sound', this.root).textContent = `Sound: ${m ? 'off' : 'on'}`;
    $('#p-sound', this.root).textContent = `Sound: ${m ? 'off' : 'on'}`;
    $('#mute-ico', this.root).innerHTML = m ? ICON.mute : ICON.sound;
  }

  setQuality(q) { $('#m-quality', this.root).textContent = `Graphics: ${q}`; }

  hideAll() {
    for (const e of [this.hud, this.menu, this.select, this.help, this.pause, this.card, this.banner, this.intro]) this.hide(e);
  }

  // ------------------------------------------------------------ hud
  showHud(info, index, count, practice) {
    this.currentIndex = index;
    this.show(this.hud);
    $('#hud-hole', this.root).textContent = `HOLE ${index + 1} / ${count}`;
    $('#hud-name', this.root).textContent = info.name;
    $('#hud-par', this.root).textContent = info.par;
  }

  setStrokes(n, totalDiff) {
    const e = $('#hud-strokes', this.root);
    if (e.textContent !== String(n)) {
      e.textContent = n;
      e.classList.remove('pop');
      void e.offsetWidth;
      e.classList.add('pop');
    }
    $('#hud-total', this.root).textContent = totalDiff === null ? '-' : fmtScore(totalDiff);
  }

  setPower(p, active) {
    if (!active) { this.hide(this.power); return; }
    this.show(this.power);
    $('#power-fill', this.root).style.width = `${Math.round(p * 100)}%`;
    $('#power-val', this.root).textContent = p < 0.03 ? 'cancel' : `${Math.round(p * 100)}%`;
    this.power.classList.toggle('max', p > 0.97);
  }

  setHint(text) {
    if (!text) { this.hide(this.hint); return; }
    this.hint.innerHTML = text;
    this.show(this.hint);
  }

  toast(text, kind = '', ms = 1900) {
    const t = this.toastEl;
    t.className = `toast ${kind}`;
    t.innerHTML = text;
    void t.offsetWidth;
    t.classList.add('in');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.classList.remove('in'); }, ms);
  }

  showIntro(info, index, practice) {
    $('#intro-num', this.root).textContent = `HOLE ${index + 1}`;
    $('#intro-name', this.root).textContent = info.name;
    $('#intro-par', this.root).textContent = `PAR ${info.par}`;
    $('#intro-hint', this.root).textContent = info.hint || '';
    this.show(this.intro);
    this.intro.classList.remove('in');
    void this.intro.offsetWidth;
    this.intro.classList.add('in');
  }

  hideIntro() { this.hide(this.intro); }

  showBanner(main, sub = '', kind = '') {
    $('#banner-main', this.root).textContent = main;
    $('#banner-sub', this.root).textContent = sub;
    this.banner.className = `banner ${kind}`;
    void this.banner.offsetWidth;
    this.banner.classList.add('in');
  }

  hideBanner() { this.banner.className = 'hidden'; }

  showPause() { this.show(this.pause); this.focus(this.pause); }

  hidePause() { this.hide(this.pause); }

  // ------------------------------------------------------------ scorecard
  /**
   * o: scores [n|undefined x9], current (index), title, sub, final, practice, best, newBest, buttons [{label, primary, fn}]
   */
  showCard(o) {
    this.hideBanner();
    this.show(this.card);
    $('#card-title', this.root).textContent = o.title;
    $('#card-title', this.root).className = `card-title ${o.kind || ''}`;
    $('#card-sub', this.root).innerHTML = o.sub || '';
    const holes = this.holes;
    let played = 0, parPlayed = 0;
    const parTotal = holes.reduce((a, h) => a + h.par, 0);
    let head = '<tr><th class="rowh">Hole</th>';
    let par = '<tr><th class="rowh">Par</th>';
    let sc = '<tr><th class="rowh">Score</th>';
    holes.forEach((h, i) => {
      const s = o.scores[i];
      const cur = i === o.current ? ' cur' : '';
      head += `<th class="${cur}">${i + 1}</th>`;
      par += `<td class="${cur}">${h.par}</td>`;
      if (s !== undefined && s !== null) {
        played += s; parPlayed += h.par;
        sc += `<td class="${cur}"><span class="mark ${scoreClass(s, h.par)}">${s}</span></td>`;
      } else {
        sc += `<td class="${cur} empty">·</td>`;
      }
    });
    head += '<th class="tot">Total</th></tr>';
    par += `<td class="tot">${parTotal}</td></tr>`;
    sc += `<td class="tot"><b>${played || '-'}</b></td></tr>`;
    $('#card-table', this.root).innerHTML = head + par + sc;
    const foot = $('#card-foot', this.root);
    const bits = [];
    if (!o.practice) {
      if (parPlayed > 0) bits.push(`<div class="foot-item"><span>${o.final ? 'Final score' : 'So far'}</span><b>${fmtScore(played - parPlayed)}</b></div>`);
      if (o.final) bits.push(`<div class="foot-item"><span>Strokes</span><b>${played}</b></div>`);
      if (o.best !== null && o.best !== undefined) bits.push(`<div class="foot-item ${o.newBest ? 'gold' : ''}"><span>${o.newBest ? 'New best round' : 'Best round'}</span><b>${o.best}</b></div>`);
    } else if (o.bestHole) {
      bits.push(`<div class="foot-item ${o.newBest ? 'gold' : ''}"><span>${o.newBest ? 'New best on this hole' : 'Best on this hole'}</span><b>${o.bestHole}</b></div>`);
    }
    foot.innerHTML = bits.join('');
    const row = $('#card-buttons', this.root);
    row.innerHTML = '';
    o.buttons.forEach((b) => {
      const btn = el('button', `btn ${b.primary ? 'primary' : ''}`, b.label);
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('mousedown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.h.click(); b.fn(); });
      row.appendChild(btn);
    });
    this.card.classList.remove('in');
    void this.card.offsetWidth;
    this.card.classList.add('in');
    this.focus(this.card);
  }

  hideCard() { this.hide(this.card); }
}
