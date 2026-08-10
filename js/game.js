
'use strict';
/* ============================================================
   Dofus Duel — combat 1v1 tactique (hommage à Dofus 1.29)
   Classes jouables : 12 classes 1.29 — arsenal complet
   Adversaires : 12 classes + 7 monstres
   Caractéristiques 1.29 : Force / Intelligence / Chance /
   Agilité / Vitalité / Sagesse — +1 dégât de l'élément par
   tranche de 5 points, esquive & critique basés sur l'Agilité,
   résistance issue de la Sagesse, initiative calculée des stats.
   Tous les sorts débloqués d'office (niv 200).
   Mécaniques : PA/PM (6/3), portées, ligne de vue, esquive de
   PM en mêlée, esquive de PA, résistances élémentaires,
   boucliers, poison, vulnérabilité, immobilisation, zones.
   ============================================================ */

var COLS = 19, ROWS = 11;
var OBST = { '3,1':1, '9,1':1, '15,1':1, '6,2':1, '12,2':1, '5,3':1, '13,3':1,
             '4,5':1, '14,5':1, '3,6':1, '9,6':1, '15,6':1, '6,8':1, '12,8':1,
             '3,9':1, '9,9':1, '15,9':1 };

/* ---------------- Tous niveau 200, tout débloqué ---------------- */
var MAX_LVL = 200;
function statBonus(mainStat) {
  var s = { force: 0, intel: 0, chance: 0, agi: 0, vita: 0, sag: 0 };
  if (mainStat) s[mainStat] = MAX_LVL - 1;
  return s;
}
function pMax(sp, u) {
  var m = sp.max;
  if ((sp.type === 'dmg' || sp.type === 'debuff' || sp.type === 'push') && u.rangeUpTurns > 0) m = sp.max + u.rangeUpBonus;
  if (u.subRangeTurns > 0) m = Math.max(sp.min, m - u.subRangeBonus);
  return m;
}

/* ---------------- État ---------------- */
var grid = [];
var cellEls = [];
var unitP = null, unitB = null;
var S = null;
var busy = false;
var SEL = { cls: 'iop', adv: 'cra' };

/* Timers de tour — annulables pour éviter les courses entre parties */
var turnTimers = [];
function later(fn, ms) { var id = setTimeout(function () { fn(); }, ms); turnTimers.push(id); return id; }
function clearTurnTimers() { for (var i = 0; i < turnTimers.length; i++) clearTimeout(turnTimers[i]); turnTimers = []; }

/* ---------------- Utilitaires ---------------- */
function inGrid(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }
function dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function cellBlocked(x, y) { return !inGrid(x, y) || grid[y][x] === 1; }
function occupiedBy(x, y) {
  if (!S) return false; // menu, pas encore en combat
  if (S.player && S.player.x === x && S.player.y === y) return true;
  if (S.bot && S.bot.x === x && S.bot.y === y) return true;
  // Check minions
  if (S.player.minions) for (var i = 0; i < S.player.minions.length; i++)
    if (S.player.minions[i].x === x && S.player.minions[i].y === y) return true;
  if (S.bot.minions) for (var i = 0; i < S.bot.minions.length; i++)
    if (S.bot.minions[i].x === x && S.bot.minions[i].y === y) return true;
  return false;
}
function log(msg, cls) {
  var el = document.getElementById('log');
  var d = document.createElement('div');
  if (cls) d.className = cls;
  d.innerHTML = msg;
  el.appendChild(d);
  while (el.children.length > 60) el.removeChild(el.firstChild);
  el.scrollTop = el.scrollHeight;
}

/* ---------------- Fiches de sorts & aide ---------------- */
function formatSpell(sp) {
  var parts = [];
  parts.push(sp.cost + ' PA');
  if (sp.type !== 'self') parts.push('Portée ' + sp.min + (sp.max > sp.min ? '-' + sp.max : ''));
  if (sp.type === 'dmg' || sp.type === 'debuff') parts.push(sp.los ? 'Ligne de vue requise' : 'Sans ligne de vue');
  if (sp.el) parts.push(sp.el);
  if (sp.lvl) parts.push('Niv ' + sp.lvl);
  if (sp.type === 'dmg') {
    parts.push(sp.d[0] + '-' + sp.d[1] + ' dégâts' + (sp.d2 ? ' + ' + sp.d2[0] + '-' + sp.d2[1] + ' ' + sp.el2 : ''));
    if (sp.aoe) parts.push('Zone (rayon ' + sp.aoe + ')');
    if (sp.push) parts.push('💨 repousse de ' + sp.push + (sp.push > 1 ? ' cases' : ' case'));
    if (sp.steal) parts.push('🩸 vole ' + (sp.steal === 1 ? '100%' : Math.round(sp.steal * 100) + '%') + ' des dégâts en PV');
    if (sp.slow) parts.push('❄️ la cible a -1 PM');
    if (sp.paDodgeDown) parts.push('🎯 la cible esquive moins les PA');
    if (sp.subRange) parts.push('👁️ -' + sp.subRange + ' portée cible');
    if (sp.poison) parts.push('☠️ poison ' + sp.poison.d + ' PV/tour x' + sp.poison.turns);
    if (sp.flat) parts.push('💪 +' + sp.flat.v + ' dégâts ' + sp.flat.turns + ' tours');
  } else if (sp.type === 'self') {
    if (sp.self === 'heal') parts.push('Soigne ' + sp.d[0] + '-' + sp.d[1] + ' PV');
    else if (sp.self === 'flat') parts.push('+' + sp.flat.v + ' dégâts' + (sp.pct ? ' et +' + Math.round(sp.pct.v * 100) + '%' : '') + ' pendant ' + sp.flat.turns + ' tour' + (sp.flat.turns > 1 ? 's' : ''));
    else if (sp.self === 'powerPct') parts.push('+' + Math.round(sp.pct.v * 100) + '% dégâts pendant ' + sp.pct.turns + ' tours');
    else if (sp.self === 'critUp') parts.push('+15% coups critiques et +20% dégâts pendant 3 tours');
    else if (sp.self === 'vita') parts.push('+' + sp.vita.v + ' PV max pendant ' + sp.vita.turns + ' tours');
    else if (sp.self === 'rangeUp') parts.push('+2 portée pendant 3 tours');
  } else if (sp.type === 'push') {
    parts.push('💨 repousse de ' + sp.push + (sp.push > 1 ? ' cases' : ' case'));
  } else if (sp.type === 'tp') {
    parts.push('Téléportation vers une case en portée');
  } else if (sp.type === 'debuff') {
    if (sp.vuln) parts.push('💔 -' + sp.vuln.pct + '% résistances ' + sp.vuln.turns + ' tours');
  }
  if (sp.desc) parts.push(sp.desc);
  return parts.join(' · ');
}
function showSpellInfo(sp, owner) {
  var el = document.getElementById('spellInfo');
  if (!sp) {
    el.className = 'placeholder';
    el.innerHTML = 'Survole ou sélectionne un sort pour voir ses détails (PA, portée, ligne de vue…).';
    return;
  }
  el.className = '';
  el.innerHTML = '<div class="siHead">' + sp.i + ' ' + sp.n +
    '<span class="siCost">' + sp.cost + ' PA</span>' +
    (owner ? '<span style="color:#ffa8a8;font-size:10px;margin-left:8px">sort de ' + owner + '</span>' : '') +
    '</div><div class="siBody">' + formatSpell(sp) + '</div>';
}
function updateHint() {
  var el = document.getElementById('hint');
  if (!S || S.over) { el.textContent = ''; return; }
  if (S.turn === 'b') {
    el.textContent = '🤖 ' + S.bot.n + ' joue… suis son sort dans le journal ci-dessous.';
    return;
  }
  if (S.phase === 'spell' && S.spell) {
    var sp = S.spell;
    var t = '🟠 Clique une case <b>orange</b> pour lancer « ' + sp.n + ' ».';
    if (sp.los) t += ' Ce sort exige une <b>ligne de vue</b> : les arbres bloquent (cible rouge = bloquée).';
    el.innerHTML = t;
    return;
  }
  if (S.player.pm > 0 && S.player.pa > 0) {
    el.innerHTML = '🟢 Clique une case <b>verte</b> pour te déplacer (chiffre = PM nécessaires, liseré rouge = zone de danger à 2 PM). Puis choisis un sort ci-dessous.';
  } else if (S.player.pm > 0) {
    el.innerHTML = '🟢 Clique une case <b>verte</b> pour te déplacer.';
  } else if (S.player.pa > 0) {
    el.innerHTML = '🟠 Choisis un sort dans la barre ci-dessous, puis clique une cible orange.';
  } else {
    el.textContent = '⏭ Plus de PA ni de PM — le tour se termine automatiquement.';
  }
}
function buffsOf(u) {
  var b = [];
  if (u.shield > 0) b.push('🛡️' + u.shield);
  if (u.powerPctTurns > 0) b.push('🔱' + u.powerPctTurns);
  if (u.flatTurns > 0) b.push('💪' + u.flatTurns);
  if (u.critUpTurns > 0) b.push('🎯' + u.critUpTurns);
  if (u.vitaTurns > 0) b.push('💚' + u.vitaTurns);
  if (u.rangeUpTurns > 0) b.push('👁️' + u.rangeUpTurns);
  if (u.slowTurns > 0) b.push('❄️');
  if (u.paDodgeDownTurns > 0) b.push('🎯-esq');
  if (u.subRangeTurns > 0) b.push('👁️-port');
  if (u.vulnTurns > 0) b.push('💔' + u.vulnTurns);
  if (u.poisonTurns > 0) b.push('☠️' + u.poisonTurns);
  if (u.immobilized) b.push('🪤');
  return b;
}
function setUnitBuffs(unit, arr) {
  var box = unit.querySelector('.uBuffs');
  if (!box) {
    box = document.createElement('div');
    box.className = 'uBuffs';
    unit.appendChild(box);
  }
  box.innerHTML = '';
  for (var i = 0; i < arr.length; i++) {
    var s = document.createElement('span');
    s.textContent = arr[i];
    box.appendChild(s);
  }
}

/* ---------------- Ligne de vue (Bresenham) ---------------- */
function los(ax, ay, bx, by) {
  var x0 = ax, y0 = ay, x1 = bx, y1 = by;
  var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  var err = dx - dy;
  while (true) {
    if (x0 === x1 && y0 === y1) return true;
    if ((x0 !== ax || y0 !== ay) && grid[y0][x0] === 1) return false;
    var e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

/* ---------------- Chemins pondérés (esquive de PM) ---------------- */
function dijkstra(sx, sy, maxPm, enemy) {
  var dist = {}, prev = {};
  dist[sx + ',' + sy] = 0; prev[sx + ',' + sy] = null;
  var done = {};
  var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  while (true) {
    var cur = null, best = Infinity;
    for (var k in dist) { if (!done[k] && dist[k] < best) { best = dist[k]; cur = k; } }
    if (!cur || best > maxPm) break;
    done[cur] = true;
    var c = cur.split(','); var cx = parseInt(c[0], 10), cy = parseInt(c[1], 10);
    for (var i = 0; i < 4; i++) {
      var nx = cx + dirs[i][0], ny = cy + dirs[i][1];
      if (cellBlocked(nx, ny) || occupiedBy(nx, ny)) continue;
      var mc = 1;
      // Tacle Dofus 1.29 (Graviton) : coût basé sur l'agilité relative
      if (Math.abs(cx - enemy.x) + Math.abs(cy - enemy.y) === 1 ||
          Math.abs(nx - enemy.x) + Math.abs(ny - enemy.y) === 1) {
        var enAgi = (enemy.stats && enemy.stats.agi) || 0;
        // L'agilité du déplaceur est dans S (pour le bot c'est S.bot, pour le joueur c'est S.player)
        // On utilise une valeur par défaut de 30 si pas dispo
        var myAgi = 30;
        mc = Math.max(1, Math.round(1 + enAgi / (myAgi + 50)));
        if (mc > 3) mc = 3; // plafond à 3 PM
      }
      var nk = nx + ',' + ny;
      var nd = best + mc;
      if (dist[nk] === undefined || nd < dist[nk]) { dist[nk] = nd; prev[nk] = cur; }
    }
  }
  return { dist: dist, prev: prev };
}
function reachCosts(sx, sy, pm, enemy) {
  var r = dijkstra(sx, sy, pm, enemy);
  var out = {};
  for (var k in r.dist) { if (r.dist[k] > 0 && r.dist[k] <= pm) out[k] = r.dist[k]; }
  return out;
}
function pathToCosts(sx, sy, tx, ty, pm, enemy) {
  var r = dijkstra(sx, sy, pm, enemy);
  var key = tx + ',' + ty;
  if (r.dist[key] === undefined) return null;
  var path = [], cur = key;
  while (cur) {
    var c = cur.split(',');
    path.unshift([parseInt(c[0], 10), parseInt(c[1], 10)]);
    cur = r.prev[cur];
  }
  path.shift();
  return { path: path, cost: r.dist[key] };
}

/* ---------------- Audio ---------------- */
var actx = null, sfxg = null, musicOn = true;
function initAudio() {
  if (actx) {
    if (actx.state === 'suspended') actx.resume();
    return;
  }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    sfxg = actx.createGain(); sfxg.gain.value = 2.5; sfxg.connect(actx.destination);
  } catch (e) {}
}
function tone(f, dur, vol, type, slide, dest) {
  if (!actx) return;
  var t = actx.currentTime;
  var o = actx.createOscillator(), g = actx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest || sfxg);
  o.start(t); o.stop(t + dur + 0.03);
}
function sfx(name) {
  if (!actx || !musicOn) return;
  if (name === 'hit') tone(190, 0.13, 0.35, 'square', -120);
  else if (name === 'crit') { tone(660, 0.08, 0.30, 'square'); tone(990, 0.14, 0.26, 'square'); }
  else if (name === 'heal') tone(520, 0.14, 0.22, 'triangle', 160);
  else if (name === 'cast') tone(420, 0.10, 0.18, 'triangle');
  else if (name === 'move') tone(300, 0.07, 0.14, 'sine');
  else if (name === 'buff') tone(300, 0.12, 0.22, 'triangle', 220);
  else if (name === 'shield') tone(240, 0.14, 0.20, 'triangle', -60);
  else if (name === 'freeze') tone(900, 0.25, 0.22, 'sine', -520);
  else if (name === 'push') tone(220, 0.16, 0.24, 'sawtooth', -110);
  else if (name === 'poison') { tone(320, 0.28, 0.22, 'sawtooth', -220); tone(160, 0.30, 0.18, 'square', -80); }
  else if (name === 'error') tone(140, 0.10, 0.22, 'square');
  else if (name === 'win') { tone(523, 0.14, 0.28, 'square'); setTimeout(function(){ tone(659, 0.14, 0.28, 'square'); }, 140);
    setTimeout(function(){ tone(784, 0.14, 0.28, 'square'); }, 280); setTimeout(function(){ tone(1046, 0.3, 0.28, 'square'); }, 420); }
  else if (name === 'lose') { tone(320, 0.3, 0.26, 'sawtooth', -180); setTimeout(function(){ tone(160, 0.5, 0.26, 'sawtooth', -80); }, 320); }
}
/* Musiques officielles Dofus 1.29 (MP3, assets/music) — bascule menu/combat */
var MUS_IDS = ['musMenu', 'musFight'];
function playMusic(id) {
  if (!musicOn) return;
  try {
    for (var i = 0; i < MUS_IDS.length; i++) {
      var el = document.getElementById(MUS_IDS[i]);
      if (!el || !el.pause || !el.play) continue;
      if (MUS_IDS[i] === id) {
        if (el.paused) { var p = el.play(); if (p && p.catch) p.catch(function () {}); }
      } else { el.pause(); }
    }
  } catch (e) {}
}
function stopMusic() {
  try {
    for (var i = 0; i < MUS_IDS.length; i++) {
      var el = document.getElementById(MUS_IDS[i]);
      if (el && el.pause) el.pause();
    }
  } catch (e) {}
}
document.getElementById('btnSound').onclick = function () {
  initAudio();
  musicOn = !musicOn;
  this.textContent = musicOn ? '🔊' : '🔇';
  if (musicOn) playMusic(S && !S.over ? 'musFight' : 'musMenu');
  else stopMusic();
};

/* ---------------- Rendu ---------------- */
/* ---------------- Rendu isométrique (style Dofus 1.29) ---------------- */
var SW = 52, SH = 26; // demi-losange (largeur/hauteur) — ajusté pour 19×11
var GX0 = 0, GY0 = 0, GRID_W = 960, GRID_H = 480;
function isoX(x, y) { return (x - y) * SW + GX0; }
function isoY(x, y) { return (x + y) * SH + GY0; }
function isoPctX(x, y) { return (isoX(x, y) / GRID_W * 100) + '%'; }
function isoPctY(x, y, off) { return ((isoY(x, y) + (off || 0)) / GRID_H * 100) + '%'; }
function buildGrid() {
  var g = document.getElementById('grid');
  g.innerHTML = '';
  var ns = 'http://www.w3.org/2000/svg';
  GX0 = (ROWS - 1) * SW + 24;
  GY0 = 24;
  GRID_W = (COLS - 1) * SW + GX0 + SW + 24;
  GRID_H = ((COLS - 1) + (ROWS - 1)) * SH + GY0 + SH + 24;
  g.setAttribute('viewBox', '0 0 ' + GRID_W + ' ' + GRID_H);
  grid = []; cellEls = [];
  for (var y = 0; y < ROWS; y++) {
    grid.push([]); cellEls.push([]);
    for (var x = 0; x < COLS; x++) {
      var cx = isoX(x, y), cy = isoY(x, y);
      var poly = document.createElementNS(ns, 'polygon');
      poly.setAttribute('points', (cx - SW) + ',' + cy + ' ' + cx + ',' + (cy - SH) + ' ' + (cx + SW) + ',' + cy + ' ' + cx + ',' + (cy + SH));
      poly.setAttribute('data-x', x); poly.setAttribute('data-y', y);
      poly.className.baseVal = 'cell ' + ((x + y) % 2 ? 'odd' : 'even');
      g.appendChild(poly);
      grid[y].push(OBST[x + ',' + y] ? 1 : 0);
      cellEls[y].push(poly);
      if (grid[y][x] === 1) {
        poly.className.baseVal += ' obs';
        var img = document.createElementNS(ns, 'image');
        img.setAttribute('href', 'assets/img/rocks.webp');
        img.setAttribute('x', cx - 24); img.setAttribute('y', cy - 24);
        img.setAttribute('width', 48); img.setAttribute('height', 48);
        g.appendChild(img);
      }
    }
  }
  unitP = document.createElement('div');
  unitP.className = 'unit uP';
  unitP.innerHTML = '<span class="uIco"></span><div class="hpbar"><i></i></div><div class="hplabel"></div>';
  unitB = document.createElement('div');
  unitB.className = 'unit uB';
  unitB.innerHTML = '<span class="uIco"></span><div class="hpbar"><i></i></div><div class="hplabel"></div>';
  var wrap = document.getElementById('gridWrap');
  wrap.appendChild(unitP); wrap.appendChild(unitB);
  
  // Calque FX pour les animations de sorts
  var fxGroup = document.createElementNS(ns, 'g');
  fxGroup.setAttribute('id', 'fxLayer');
  g.appendChild(fxGroup);
}
function placeUnit(unit, x, y) {
  unit.style.left = isoPctX(x, y);
  unit.style.top = isoPctY(x, y, -2);
}

/* ---------------- Animations de sorts SVG ---------------- */
var ns_ = 'http://www.w3.org/2000/svg';
function fxEl(tag) { return document.createElementNS(ns_, tag); }
function fxLayer() { return document.getElementById('fxLayer'); }

function animCast(x, y, el) {
  var colors = { Terre: '#c49a3c', Feu: '#ff6622', Eau: '#3399ff', Air: '#88dd44', Neutre: '#cccccc' };
  var c = colors[el] || '#ffd75e';
  var cx = isoX(x, y), cy = isoY(x, y);
  var circle = fxEl('circle');
  circle.setAttribute('cx', cx); circle.setAttribute('cy', cy);
  circle.setAttribute('r', 8); circle.setAttribute('fill', c); circle.setAttribute('opacity', '0.8');
  fxLayer().appendChild(circle);
  var start = performance.now();
  (function tick() {
    var t = (performance.now() - start) / 400;
    if (t >= 1) { circle.remove(); return; }
    circle.setAttribute('r', 8 + t * 20);
    circle.setAttribute('opacity', 0.8 * (1 - t));
    requestAnimationFrame(tick);
  })();
}

function animImpact(x, y, el) {
  var cx = isoX(x, y), cy = isoY(x, y);
  if (el === 'Feu') {
    // Flammes : particules montantes
    for (var i = 0; i < 8; i++) {
      (function (angle, dist) {
        var c = fxEl('circle');
        c.setAttribute('cx', cx); c.setAttribute('cy', cy);
        c.setAttribute('r', 3 + Math.random() * 4);
        c.setAttribute('fill', i % 2 ? '#ff6622' : '#ffaa00');
        fxLayer().appendChild(c);
        var start = performance.now();
        (function tick() {
          var t = (performance.now() - start) / 400;
          if (t >= 1) { c.remove(); return; }
          var len = dist + t * 30;
          c.setAttribute('cx', cx + Math.cos(angle) * len * 0.6);
          c.setAttribute('cy', cy + Math.sin(angle) * len * 0.4 - t * 25);
          c.setAttribute('opacity', 1 - t);
          c.setAttribute('r', 3 - t * 3);
          requestAnimationFrame(tick);
        })();
      })(Math.random() * Math.PI * 2, 4 + Math.random() * 12);
    }
  } else if (el === 'Eau') {
    // Gouttes qui éclaboussent
    for (var i = 0; i < 6; i++) {
      (function (angle) {
        var c = fxEl('circle');
        c.setAttribute('cx', cx); c.setAttribute('cy', cy);
        c.setAttribute('r', 2 + Math.random() * 3);
        c.setAttribute('fill', '#66bbff');
        fxLayer().appendChild(c);
        var start = performance.now();
        (function tick() {
          var t = (performance.now() - start) / 350;
          if (t >= 1) { c.remove(); return; }
          var len = t * 22;
          var ax = cx + Math.cos(angle) * len;
          var ay = cy + Math.sin(angle) * len + t * 10;
          c.setAttribute('cx', ax); c.setAttribute('cy', ay);
          c.setAttribute('opacity', 1 - t);
          requestAnimationFrame(tick);
        })();
      })(i * Math.PI / 3 + Math.random() * 0.4);
    }
  } else if (el === 'Air') {
    // Tourbillons
    for (var i = 0; i < 4; i++) {
      (function (angle) {
        var line = fxEl('line');
        line.setAttribute('x1', cx); line.setAttribute('y1', cy);
        line.setAttribute('x2', cx); line.setAttribute('y2', cy);
        line.setAttribute('stroke', i % 2 ? '#aaff44' : '#88dd44');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-linecap', 'round');
        fxLayer().appendChild(line);
        var start = performance.now();
        (function tick() {
          var t = (performance.now() - start) / 300;
          if (t >= 1) { line.remove(); return; }
          var len = t * 24;
          var swirl = angle + t * 2;
          line.setAttribute('x2', cx + Math.cos(swirl) * len);
          line.setAttribute('y2', cy + Math.sin(swirl) * len * 0.5);
          line.setAttribute('opacity', 1 - t);
          requestAnimationFrame(tick);
        })();
      })(i * Math.PI / 2 + Math.random() * 0.5);
    }
  } else if (el === 'Terre') {
    // Éclats de roche
    for (var i = 0; i < 6; i++) {
      (function (angle) {
        var poly = fxEl('polygon');
        var size = 4 + Math.random() * 6;
        var pts = '0,' + (-size) + ' ' + size + ',0 0,' + size + ' ' + (-size) + ',0';
        poly.setAttribute('points', pts);
        poly.setAttribute('fill', '#c49a3c');
        poly.setAttribute('stroke', '#8a6d2b');
        poly.setAttribute('stroke-width', '1');
        fxLayer().appendChild(poly);
        var start = performance.now();
        (function tick() {
          var t = (performance.now() - start) / 350;
          if (t >= 1) { poly.remove(); return; }
          var len = t * 25;
          poly.setAttribute('transform', 'translate(' + (cx + Math.cos(angle) * len) + ',' + (cy + Math.sin(angle) * len) + ') rotate(' + t * 120 + ')');
          poly.setAttribute('opacity', 1 - t);
          requestAnimationFrame(tick);
        })();
      })(i * Math.PI / 3 + Math.random() * 0.3);
    }
  } else {
    // Neutre : éclat simple
    var c = '#999999';
    for (var i = 0; i < 4; i++) {
      (function (angle) {
        var line = fxEl('line');
        line.setAttribute('x1', cx); line.setAttribute('y1', cy);
        line.setAttribute('x2', cx); line.setAttribute('y2', cy);
        line.setAttribute('stroke', c); line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-linecap', 'round');
        fxLayer().appendChild(line);
        var start = performance.now();
        (function tick() {
          var t = (performance.now() - start) / 300;
          if (t >= 1) { line.remove(); return; }
          var len = t * 20;
          line.setAttribute('x2', cx + Math.cos(angle) * len);
          line.setAttribute('y2', cy + Math.sin(angle) * len);
          line.setAttribute('opacity', 1 - t);
          requestAnimationFrame(tick);
        })();
      })(i * Math.PI / 2 + Math.random() * 0.3);
    }
  }
}

function animProjectile(fx, fy, tx, ty, el) {
  var colors = { Terre: '#c49a3c', Feu: '#ff6622', Eau: '#66bbff', Air: '#aaff44', Neutre: '#dddddd' };
  var c = colors[el] || '#ffd75e';
  var sx = isoX(fx, fy), sy = isoY(fx, fy);
  var ex = isoX(tx, ty), ey = isoY(tx, ty);
  var dot = fxEl('circle');
  dot.setAttribute('cx', sx); dot.setAttribute('cy', sy);
  dot.setAttribute('r', 4); dot.setAttribute('fill', c);
  fxLayer().appendChild(dot);
  var start = performance.now();
  (function tick() {
    var t = (performance.now() - start) / 250;
    if (t >= 1) { dot.remove(); return; }
    dot.setAttribute('cx', sx + (ex - sx) * t);
    dot.setAttribute('cy', sy + (ey - sy) * t);
    requestAnimationFrame(tick);
  })();
}

function animHeal(x, y) {
  var cx = isoX(x, y), cy = isoY(x, y);
  for (var i = 0; i < 3; i++) {
    setTimeout(function (idx) {
      var plus = fxEl('text');
      plus.textContent = '+'; plus.setAttribute('x', cx);
      plus.setAttribute('y', cy - idx * 6); plus.setAttribute('fill', '#51cf66');
      plus.setAttribute('font-size', '14'); plus.setAttribute('font-weight', 'bold');
      plus.setAttribute('text-anchor', 'middle');
      fxLayer().appendChild(plus);
      var start = performance.now();
      (function tick() {
        var t = (performance.now() - start) / 500;
        if (t >= 1) { plus.remove(); return; }
        plus.setAttribute('y', cy - idx * 8 - t * 20);
        plus.setAttribute('opacity', 1 - t);
        requestAnimationFrame(tick);
      })();
    }, i * 80, i);
  }
}

function animBuff(x, y) {
  var cx = isoX(x, y), cy = isoY(x, y);
  for (var i = 0; i < 3; i++) {
    setTimeout(function () {
      var ring = fxEl('circle');
      ring.setAttribute('cx', cx); ring.setAttribute('cy', cy);
      ring.setAttribute('r', 5); ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', '#ffd75e'); ring.setAttribute('stroke-width', '2');
      fxLayer().appendChild(ring);
      var start = performance.now();
      (function tick() {
        var t = (performance.now() - start) / 400;
        if (t >= 1) { ring.remove(); return; }
        ring.setAttribute('r', 5 + t * 16);
        ring.setAttribute('opacity', 1 - t);
        requestAnimationFrame(tick);
      })();
    }, i * 100);
  }
}

function setUnitHp(unit, cur, max) {
  unit.querySelector('.hpbar i').style.width = Math.max(0, cur / max * 100) + '%';
  unit.querySelector('.hplabel').textContent = cur + ' / ' + max;
}
function dots(val, max, cls) {
  var s = '';
  for (var i = 0; i < max; i++) s += '<div class="dot ' + cls + (i < val ? '' : ' off') + '"></div>';
  return s;
}
function setUnitImg(unit, src) {
  var ico = unit.querySelector('.uIco');
  if (!ico) return;
  if (src === 'clofus.webp') {
    if (!ico.querySelector('.sprite')) {
      ico.innerHTML = '';
      var sp = document.createElement('div');
      sp.className = 'sprite';
      ico.appendChild(sp);
      setSpriteFrame(sp, 0, unit === unitP ? 7 : 3);
    }
    return;
  }
  if (!ico.querySelector('img')) {
    ico.innerHTML = '';
    var im = document.createElement('img');
    ico.appendChild(im);
  }
  ico.querySelector('img').src = 'assets/img/' + src;
}
var SPRITE_FRAMES = null;
function setSpriteFrame(el, col, row) {
  // Sprite sheet 11 colonnes × 8 rangées, background-size: 1100% 800%
  // background-position en % : le point X% de l'image s'aligne avec X% de l'élément.
  // Décalage px = (élément - image) × pct/100. Pour montrer la frame (col,row) :
  //   horizontal : pct = col × 100/(11-1) = col × 10
  //   vertical   : pct = row × 100/(8-1)  = row × 14.2857
  el.style.backgroundPosition = (col * 10) + '% ' + (row * (100 / 7)) + '%';
}
function spriteRowFor(dx, dy) {
  if (dx > 0) return 7;  // droite
  if (dx < 0) return 3;  // gauche
  if (dy > 0) return 1;  // bas
  if (dy < 0) return 5;  // haut
  return 7;
}
function animUnitMove(unit, u, ox, oy) {
  var sp = unit.querySelector('.sprite');
  if (!sp) return;
  var row = spriteRowFor(u.x - ox, u.y - oy);
  if (SPRITE_FRAMES) { clearInterval(SPRITE_FRAMES); SPRITE_FRAMES = null; }
  var frames = [1, 2, 3, 2, 1], i = 0;
  setSpriteFrame(sp, frames[i], row);
  SPRITE_FRAMES = setInterval(function () {
    if (!sp.isConnected) { clearInterval(SPRITE_FRAMES); SPRITE_FRAMES = null; return; }
    i++;
    if (i >= frames.length) {
      clearInterval(SPRITE_FRAMES); SPRITE_FRAMES = null;
      setSpriteFrame(sp, 0, row);
    } else setSpriteFrame(sp, frames[i], row);
  }, 85);
}
function render() {
  if (!S) return;
  var i, k, x, y;

  setUnitImg(unitP, S.player.img || 'clofus.webp');
  setUnitImg(unitB, S.bot.img || 'clofus.webp');
  placeUnit(unitP, S.player.x, S.player.y);
  placeUnit(unitB, S.bot.x, S.bot.y);
  setUnitHp(unitP, S.player.hp, S.player.maxHp);
  setUnitHp(unitB, S.bot.hp, S.bot.maxHp);

  var reach = {}, targets = {}, rangeSet = {}, nlosSet = {};
  if (!busy && S.turn === 'p' && !S.over) {
    if (S.phase === 'move' && S.player.pm > 0) reach = reachCosts(S.player.x, S.player.y, S.player.pm, S.bot);
    if (S.phase === 'spell' && S.spell) {
      var sp = S.spell;
      targets = spellTargets(sp);
      var pmax = pMax(sp, S.player);
      for (var yy = 0; yy < ROWS; yy++) {
        for (var xx = 0; xx < COLS; xx++) {
          var dd = Math.abs(S.player.x - xx) + Math.abs(S.player.y - yy);
          if (dd >= sp.min && dd <= pmax) rangeSet[xx + ',' + yy] = 1;
        }
      }
      if ((sp.type === 'dmg' || sp.type === 'debuff') &&
          !targets[S.bot.x + ',' + S.bot.y] && sp.los && !sp.aoe) {
        var db = dist(S.player, S.bot);
        if (db >= sp.min && db <= pmax && !los(S.player.x, S.player.y, S.bot.x, S.bot.y)) {
          nlosSet[S.bot.x + ',' + S.bot.y] = 1;
        }
      }
    }
  }
  var wrapEl = document.getElementById('gridWrap');
  var oldLabels = wrapEl.querySelectorAll('.costLabel');
  for (var li = 0; li < oldLabels.length; li++) oldLabels[li].remove();
  for (y = 0; y < ROWS; y++) {
    for (x = 0; x < COLS; x++) {
      var c = cellEls[y][x];
      c.classList.remove('mv', 'sp', 'range', 'nlos', 'danger');
      if (grid[y][x] === 1) continue;
      k = x + ',' + y;
      if (reach[k]) {
        c.classList.add('mv');
        if (reach[k] > 1) {
          var lb = document.createElement('span');
          lb.className = 'costLabel';
          lb.textContent = reach[k];
          lb.style.left = isoPctX(x, y);
          lb.style.top = isoPctY(x, y, -14);
          wrapEl.appendChild(lb);
          c.classList.add('danger');
        }
      } else if (targets[k]) c.classList.add('sp');
      else if (nlosSet[k]) c.classList.add('nlos');
      else if (rangeSet[k]) c.classList.add('range');
    }
  }

  setUnitBuffs(unitP, buffsOf(S.player));
  setUnitBuffs(unitB, buffsOf(S.bot));

  // HUD joueur
  document.getElementById('pName').textContent = S.player.icon + ' ' + S.player.n;
  document.getElementById('pBar').style.width = Math.max(0, S.player.hp / S.player.maxHp * 100) + '%';
  document.getElementById('pHp').textContent = S.player.hp + ' / ' + S.player.maxHp;
  document.getElementById('pPa').innerHTML = dots(S.player.pa, S.player.paMax, 'pa');
  document.getElementById('pPm').innerHTML = dots(S.player.pm, S.player.pmMax, 'pm');
  document.getElementById('pPaNum').textContent = S.player.pa + '/' + S.player.paMax;
  document.getElementById('pPmNum').textContent = S.player.pm + '/' + S.player.pmMax;
  var buffs = '';
  if (S.player.shield > 0) buffs += '<span class="shieldBadge">🛡️' + S.player.shield + '</span> ';
  if (S.player.powerPctTurns > 0) buffs += '🔱' + S.player.powerPctTurns + ' ';
  if (S.player.flatTurns > 0) buffs += '💪' + S.player.flatTurns + ' ';
  if (S.player.critUpTurns > 0) buffs += '🎯' + S.player.critUpTurns + ' ';
  if (S.player.vitaTurns > 0) buffs += '💚' + S.player.vitaTurns + ' ';
  if (S.player.rangeUpTurns > 0) buffs += '👁️' + S.player.rangeUpTurns + ' ';
  if (S.player.slowTurns > 0) buffs += '❄️-Ralenti ';
  if (S.player.paDodgeDownTurns > 0) buffs += '🎯-esq ';
  if (S.player.subRangeTurns > 0) buffs += '👁️-port ';
  if (S.player.vulnTurns > 0) buffs += '💔' + S.player.vulnTurns + ' ';
  if (S.player.poisonTurns > 0) buffs += '☠️' + S.player.poisonTurns + ' ';
  if (S.player.immobilized) buffs += '🪤Immobile ';
  document.getElementById('pBuffs').innerHTML = buffs;
  document.getElementById('bName').textContent = S.bot.icon + ' ' + S.bot.n;
  document.getElementById('bBar').style.width = Math.max(0, S.bot.hp / S.bot.maxHp * 100) + '%';
  document.getElementById('bHp').textContent = S.bot.hp + ' / ' + S.bot.maxHp;
  var bb = '';
  if (S.bot.shield > 0) bb += '<span class="shieldBadge">🛡️' + S.bot.shield + '</span> ';
  if (S.bot.powerPctTurns > 0) bb += '🔱' + S.bot.powerPctTurns + ' ';
  if (S.bot.flatTurns > 0) bb += '💪' + S.bot.flatTurns + ' ';
  if (S.bot.critUpTurns > 0) bb += '🎯' + S.bot.critUpTurns + ' ';
  if (S.bot.vitaTurns > 0) bb += '💚' + S.bot.vitaTurns + ' ';
  if (S.bot.rangeUpTurns > 0) bb += '👁️' + S.bot.rangeUpTurns + ' ';
  if (S.bot.slowTurns > 0) bb += '❄️-Ralenti ';
  if (S.bot.paDodgeDownTurns > 0) bb += '🎯-esq ';
  if (S.bot.subRangeTurns > 0) bb += '👁️-port ';
  if (S.bot.vulnTurns > 0) bb += '💔' + S.bot.vulnTurns + ' ';
  if (S.bot.poisonTurns > 0) bb += '☠️' + S.bot.poisonTurns + ' ';
  document.getElementById('bBuffs').innerHTML = bb;
  var tb = document.getElementById('turnBanner');
  if (S.over) { tb.textContent = 'FIN DU COMBAT'; tb.className = ''; }
  else if (S.turn === 'p') { tb.textContent = 'Tour ' + S.round + ' — À TON TOUR'; tb.className = 'mine'; }
  else { tb.textContent = 'Tour ' + S.round + ' — ' + S.bot.n + ' JOUE…'; tb.className = 'theirs'; }
  updateHint();

  var btns = document.querySelectorAll('.spellBtn');
  for (i = 0; i < btns.length; i++) {
    var sp = S.player.spells[i];
    var dis = busy || S.turn !== 'p' || S.player.pa < sp.cost || S.over;
    btns[i].disabled = dis;
    btns[i].classList.toggle('active', S.phase === 'spell' && S.spell === sp);
  }
  document.getElementById('btnEnd').disabled = busy || S.turn !== 'p' || S.over;
}
/* ---------------- Zones de sorts (Dofus 1.29) ---------------- */
function getZoneCells(caster, tx, ty, zoneType, radius) {
  var cells = {};
  if (zoneType === 'circle' || zoneType === 'aoe') {
    // Cercle : BFS en distance Manhattan depuis le point d'impact
    var r = radius || 1;
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= r) {
          var nx = tx + dx, ny = ty + dy;
          if (inGrid(nx, ny) && !cellBlocked(nx, ny)) cells[nx + ',' + ny] = 1;
        }
      }
    }
  } else if (zoneType === 'line') {
    // Ligne : direction caster→cible, 'radius' cellules au-delà
    var dx = tx - caster.x, dy = ty - caster.y;
    var steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) { cells[tx + ',' + ty] = 1; return cells; }
    var len = radius || 3;
    var sx = dx / steps, sy = dy / steps;
    for (var i = 0; i <= len; i++) {
      var lx = Math.round(caster.x + sx * (steps + i));
      var ly = Math.round(caster.y + sy * (steps + i));
      if (inGrid(lx, ly) && !cellBlocked(lx, ly)) cells[lx + ',' + ly] = 1;
    }
  } else if (zoneType === 'cross') {
    // Croix : 4 directions cardinales depuis le point d'impact
    var len = radius || 2;
    var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    cells[tx + ',' + ty] = 1;
    for (var d = 0; d < 4; d++) {
      for (var i = 1; i <= len; i++) {
        var cx = tx + dirs[d][0] * i, cy = ty + dirs[d][1] * i;
        if (inGrid(cx, cy) && !cellBlocked(cx, cy)) cells[cx + ',' + cy] = 1;
      }
    }
  }
  return cells;
}

function spellTargets(sp) {
  var out = {};
  var d = dist(S.player, S.bot);
  if (sp.type === 'dmg' || sp.type === 'debuff' || sp.type === 'push') {
    var pmax = pMax(sp, S.player);
    if (sp.aoe || sp.zone) {
      // Zone : on met toutes les cellules en portée en orange,
      // le clic sur une cellule déclenche la zone
      for (var y = 0; y < ROWS; y++) {
        for (var x = 0; x < COLS; x++) {
          var d2 = Math.abs(S.player.x - x) + Math.abs(S.player.y - y);
          if (d2 >= sp.min && d2 <= pmax) out[x + ',' + y] = 1;
        }
      }
    } else if (sp.type === 'push' && d >= sp.min && d <= pmax) {
      out[S.bot.x + ',' + S.bot.y] = 1;
    } else if (d >= sp.min && d <= pmax && (!sp.los || los(S.player.x, S.player.y, S.bot.x, S.bot.y))) {
      out[S.bot.x + ',' + S.bot.y] = 1;
    }
  } else if (sp.type === 'tp') {
    for (var y2 = 0; y2 < ROWS; y2++) {
      for (var x2 = 0; x2 < COLS; x2++) {
        var d3 = Math.abs(S.player.x - x2) + Math.abs(S.player.y - y2);
        if (d3 >= sp.min && d3 <= sp.max && !cellBlocked(x2, y2) && !occupiedBy(x2, y2)) out[x2 + ',' + y2] = 1;
      }
    }
  }
  return out;
}
function showDmg(unit, x, y, text, cls) {
  var d = document.createElement('div');
  d.className = 'dmg' + (cls ? ' ' + cls : '');
  d.textContent = text;
  d.style.left = isoPctX(x, y);
  d.style.top = isoPctY(x, y, -40);
  document.getElementById('gridWrap').appendChild(d);
  setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1000);
}
function showMsg(x, y, text) {
  var d = document.createElement('div');
  d.className = 'msg';
  d.textContent = text;
  d.style.left = isoPctX(x, y);
  d.style.top = isoPctY(x, y, -34);
  document.getElementById('gridWrap').appendChild(d);
  setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1200);
}
function flashCell(x, y) {
  var c = cellEls[y][x];
  c.classList.remove('flash');
  void c.offsetWidth;
  c.classList.add('flash');
}
function bounceUnit(unit) {
  unit.classList.remove('bounce');
  void unit.offsetWidth;
  unit.classList.add('bounce');
}

/* ---------------- Dégâts / soins ---------------- */
function elBonus(caster, el) {
  // Dofus 1.29: caractéristique × 1% dans le multiplicateur
  // Neutre/Terre→Force, Feu→Intel, Eau→Chance, Air→Agi
  var s = caster.stats || {};
  var v = el === 'Feu' ? s.intel : el === 'Eau' ? s.chance : el === 'Air' ? s.agi : s.force;
  return (v || 0) / 100; // retourne le facteur multiplicateur
}
function computeDmg(caster, spell) {
  // Formule Dofus 1.29 (Graviton) :
  // dmg = (base + boost) × (100 + caractéristique%) / 100 + flatBonus
  // puis × (1 + powerPct) si buff actif
  var d = rand(spell.d[0], spell.d[1]);
  var crit = Math.random() < (0.05 + (caster.stats.agi || 0) * 0.001 + (caster.critUpTurns > 0 ? caster.critUpBonus : 0));
  if (crit) {
    var critMult = 1.5;
    if (caster.critUpTurns > 0) critMult += caster.critUpBonus;
    d = Math.round(d * critMult);
  }
  // Multiplicateur de caractéristique (Force/Terre, Intel/Feu, Chance/Eau, Agi/Air)
  var statMult = 1 + elBonus(caster, spell.el);
  d = Math.round(d * statMult);
  // Bonus plat (Compulsion, Guide, etc.)
  if (caster.flatTurns > 0) d += caster.flatBonus;
  // Bonus % (Puissance, Tir Puissant, etc.)
  if (caster.powerPctTurns > 0) d = Math.round(d * (1 + caster.powerPctBonus));
  return { d: Math.max(1, d), crit: crit };
}
function applyDamage(target, d, el) {
  // Formule Dofus 1.29 : résistances % d'abord, puis fixes, puis armure
  var resisted = false;
  if (target.vulnTurns > 0) d = Math.round(d * (1 + (target.vulnPct || 0) / 100));
  // Résistance % (combinée : res élémentaire + sagesse/2)
  var res = (target.res[el] || 0);
  if (target.stats && target.stats.sag) res += Math.floor(target.stats.sag / 2);
  if (res > 0) { d = Math.round(d * (1 - res / 100)); resisted = true; }
  else if (res < 0) { d = Math.round(d * (1 - res / 100)); } // faiblesse amplifie
  d = Math.max(1, d);
  // Armure (bouclier)
  var shielded = 0;
  if (target.shield > 0) {
    shielded = Math.min(target.shield, d);
    target.shield -= shielded;
    d -= shielded;
  }
  target.hp -= d;
  return { d: d, resisted: resisted, shielded: shielded };
}
function healUnit(unit, amount) {
  // Dofus 1.29 : heal = base × (100 + Intelligence) / 100
  var intel = unit.stats && unit.stats.intel ? unit.stats.intel : 0;
  amount = Math.round(amount * (100 + intel) / 100);
  amount = Math.min(amount, unit.maxHp - unit.hp);
  if (amount <= 0) { showMsg(unit.x, unit.y, 'PV max'); return 0; }
  unit.hp += amount;
  sfx('heal');
  showDmg(unit, unit.x, unit.y, '+' + amount, 'heal');
  return amount;
}
function tickPoison(u, who) {
  if (!u.poisonTurns) return true;
  var d = Math.max(1, u.poisonDmg);
  u.hp -= d;
  sfx('poison');
  showDmg(u, u.x, u.y, '-' + d, 'poison');
  log('<span class="' + who + '">☠️ ' + u.n + '</span> subit <b>' + d + '</b> dégâts de poison.', who);
  u.poisonTurns--;
  if (u.hp <= 0) { u.hp = 0; endGame(u === S.player ? S.bot : S.player); return false; }
  return true;
}

/* ---------------- Combat ---------------- */
function makeUnit(def, isPlayer) {
  var bonus = statBonus(def.mainStat);
  var stats = {};
  for (var k in def.stats) stats[k] = def.stats[k] + (bonus[k] || 0);
  var spells = []; for (var i = 0; i < def.spells.length; i++) spells.push(def.spells[i]);
  return {
    n: def.n, icon: def.icon, img: def.img || 'clofus.webp', x: isPlayer ? 1 : 12, y: 5,
    hp: def.hp + (MAX_LVL - 1) * 5, maxHp: def.hp + (MAX_LVL - 1) * 5,
    pa: 6, paMax: 6, pm: 3, pmMax: 3,
    res: def.res, el: def.el, style: def.style, stats: stats,
    spells: spells, dmgBonus: 1, ia: def.ia || 'attack',
    powerPctTurns: 0, powerPctBonus: 0,
    flatTurns: 0, flatBonus: 0,
    critUpTurns: 0, critUpBonus: 0,
    vitaTurns: 0, vitaBonus: 0,
    rangeUpTurns: 0, rangeUpBonus: 2,
    slowTurns: 0, paDodgeDownTurns: 0, subRangeTurns: 0, subRangeBonus: 2,
    vulnTurns: 0, vulnPct: 0,
    poisonTurns: 0, poisonDmg: 0,
    shield: 0, immobilized: false, minions: []
  };
}

/* ---------------- Invocations ---------------- */
function summonMinion(owner, summonDef) {
  // Find free adjacent cell
  var dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
  var mx = owner.x, my = owner.y;
  var placed = false;
  for (var i = 0; i < dirs.length; i++) {
    var nx = owner.x + dirs[i][0], ny = owner.y + dirs[i][1];
    if (inGrid(nx, ny) && !cellBlocked(nx, ny) && !occupiedBy(nx, ny)) {
      // Also check not occupied by another minion
      var free = true;
      var allUnits = [S.player, S.bot];
      for (var u = 0; u < allUnits.length; u++) {
        if (allUnits[u].minions) {
          for (var m = 0; m < allUnits[u].minions.length; m++) {
            if (allUnits[u].minions[m].x === nx && allUnits[u].minions[m].y === ny) { free = false; break; }
          }
        }
      }
      if (free) { mx = nx; my = ny; placed = true; break; }
    }
  }
  if (!placed) { log("Pas de place pour l'invocation !", 'c'); return null; }
  
  var m = {
    n: summonDef.n, icon: summonDef.icon, x: mx, y: my,
    hp: summonDef.hp, maxHp: summonDef.hp,
    pa: 4, paMax: 4, pm: 3, pmMax: 3,
    res: summonDef.res || { Neutre: 0, Terre: 0, Feu: 0, Eau: 0, Air: 0 },
    el: summonDef.el || 'Neutre', stats: summonDef.stats || { force: 10, intel: 10, chance: 10, agi: 10, vita: 10, sag: 5 },
    spells: summonDef.spells || [],
    owner: owner, isMinion: true,
    flatTurns: 0, flatBonus: 0, powerPctTurns: 0, powerPctBonus: 0,
    slowTurns: 0, poisonTurns: 0, shield: 0, immobilized: false
  };
  owner.minions.push(m);
  // Render minion unit
  renderMinion(m);
  sfx('cast');
  log(owner.n + ' invoque <b>' + m.n + '</b> !', owner === S.player ? 'p' : 'c');
  return m;
}

function removeMinion(m) {
  if (m.el) { m.el.remove(); m.el = null; }
  var idx = m.owner.minions.indexOf(m);
  if (idx >= 0) m.owner.minions.splice(idx, 1);
}

function renderMinion(m) {
  if (m.el) m.el.remove();
  var el = document.createElement('div');
  el.className = 'unit minion';
  el.innerHTML = '<span class="uIco">' + (m.icon || '🐾') + '</span><div class="hpbar"><i></i></div><div class="hplabel"></div>';
  var wrap = document.getElementById('gridWrap');
  wrap.appendChild(el);
  m.el = el;
  placeUnit(el, m.x, m.y);
  setUnitHp(el, m.hp, m.maxHp);
}

function refreshMinions() {
  var all = [];
  if (S.player.minions) all = all.concat(S.player.minions);
  if (S.bot.minions) all = all.concat(S.bot.minions);
  for (var i = all.length - 1; i >= 0; i--) {
    if (all[i].hp <= 0) removeMinion(all[i]);
    else if (all[i].el) {
      placeUnit(all[i].el, all[i].x, all[i].y);
      setUnitHp(all[i].el, all[i].hp, all[i].maxHp);
    }
  }
}

function minionTurn(owner) {
  if (!owner.minions || !owner.minions.length) return;
  var enemy = owner === S.player ? S.bot : S.player;
  for (var i = 0; i < owner.minions.length; i++) {
    var m = owner.minions[i];
    if (m.hp <= 0) continue;
    m.pa = m.paMax; m.pm = m.pmMax;
    
    // Move toward enemy
    var reach = reachCosts(m.x, m.y, m.pm, enemy);
    var bestD = dist(m, enemy), bestPos = [m.x, m.y];
    for (var k in reach) {
      var c = k.split(','), cx = parseInt(c[0],10), cy = parseInt(c[1],10);
      var nd = Math.abs(cx - enemy.x) + Math.abs(cy - enemy.y);
      if (nd < bestD) { bestD = nd; bestPos = [cx, cy]; }
    }
    if (bestPos[0] !== m.x || bestPos[1] !== m.y) {
      var pc = pathToCosts(m.x, m.y, bestPos[0], bestPos[1], m.pm, enemy);
      if (pc && pc.path.length) {
        var last = pc.path[Math.min(m.pm, pc.path.length) - 1];
        m.x = last[0]; m.y = last[1]; m.pm -= pc.cost;
      }
    }
    
    // Attack if adjacent
    if (dist(m, enemy) <= 1) {
      var dmg = rand(10, 18);
      dmg = Math.round(dmg * (1 + (m.stats.force || 0) / 100));
      var dmgRes = applyDamage(enemy, dmg, m.el || 'Neutre');
      sfx('hit');
      animImpact(enemy.x, enemy.y, m.el || 'Neutre');
      bounceUnit(enemy === S.player ? unitP : unitB);
      showDmg(enemy, enemy.x, enemy.y, '-' + dmgRes.d, null);
      log(m.n + ' attaque ' + enemy.n + ' : <b>' + dmgRes.d + ' dégâts</b> !', m.owner === S.player ? 'p' : 'c');
    }
    renderMinion(m);
  }
  refreshMinions();
  render();
}
function newGame() {
  clearTurnTimers();
  playMusic('musFight');
  S = {
    player: makeUnit(CLASSES[SEL.cls], true),
    bot: makeUnit(ADVERSARIES[SEL.adv], false),
    turn: 'p', round: 1, phase: 'move', spell: null, over: false
  };
  busy = false;
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('log').innerHTML = '';
  buildSpellButtons();
  buildBotSpells();
  var initP = Math.floor((S.player.stats.force + S.player.stats.intel + S.player.stats.chance + S.player.stats.agi) / 2 + S.player.stats.sag) + rand(-20, 20);
  var initB = Math.floor((S.bot.stats.force + S.bot.stats.intel + S.bot.stats.chance + S.bot.stats.agi) / 2 + S.bot.stats.sag) + rand(-20, 20);
  var first = initB > initP ? 'b' : (initP > initB ? 'p' : (Math.random() < 0.5 ? 'p' : 'b'));
  log('<span class="t">⚔️ Combat !</span> ' + S.player.n + ' <b>vs</b> ' + S.bot.n);
  if (first === 'b') {
    log(S.bot.n + ' remporte l\'initiative (' + initB + ') et commence !', 'c');
    S.turn = 'b';
  } else {
    log(S.player.n + ' remporte l\'initiative (' + initP + '). À toi de jouer !', 'p');
  }
  render();
  if (S.turn === 'b') {
    busy = true;
    later(botTurn, 900);
  }
}
function playerTurn() {
  S.turn = 'p'; S.phase = 'move'; S.spell = null;
  S.player.paMax = 6;
  S.player.pmMax = S.player.immobilized ? 0 : (S.player.slowTurns > 0 ? 2 : 3);
  S.player.pa = S.player.paMax;
  S.player.pm = S.player.pmMax;
  if (S.player.slowTurns > 0) { log('❄️ Ralenti — 2 PM ce tour !', 'c'); S.player.slowTurns = 0; }
  if (S.player.immobilized) log('🪤 Immobilisé — tu ne peux pas bouger ce tour !', 'c');
  S.player.immobilized = false;
  if (!tickPoison(S.player, 'p')) return;
  log('<span class="t">— Tour ' + S.round + ' —</span> À toi de jouer.', 'p');
  render();
}
function endPlayerTurn() {
  if (busy || S.turn !== 'p' || S.over) return;
  if (S.player.powerPctTurns > 0) S.player.powerPctTurns--;
  if (S.player.flatTurns > 0) S.player.flatTurns--;
  if (S.player.critUpTurns > 0) S.player.critUpTurns--;
  if (S.player.rangeUpTurns > 0) S.player.rangeUpTurns--;
  if (S.player.vitaTurns > 0) {
    S.player.vitaTurns--;
    if (!S.player.vitaTurns) { S.player.maxHp -= S.player.vitaBonus; S.player.hp = Math.min(S.player.hp, S.player.maxHp); }
  }
  if (S.bot.vulnTurns > 0) S.bot.vulnTurns--;
  if (S.bot.paDodgeDownTurns > 0) S.bot.paDodgeDownTurns--;
  if (S.bot.subRangeTurns > 0) S.bot.subRangeTurns--;
  busy = true;
  S.phase = 'move'; S.spell = null;
  minionTurn(S.player);
  log('<span class="t">— Fin de ton tour —</span> ' + S.bot.n + ' réfléchit…', 'c');
  render();
  later(botTurn, 800);
}
function paDodge(caster, spell, enemy) {
  // Dofus 1.29 (Graviton) : esquive probabiliste par PA, à paliers
  // chance = CEIL(dodgeFactor × PA_restants/PA_total × 50) %
  var d = Math.abs(caster.x - enemy.x) + Math.abs(caster.y - enemy.y);
  if (d !== 1) return false; // esquive PA uniquement en mêlée (case adjacente)
  if (enemy.paDodgeDownTurns > 0) return false; // -esquive PA annule l'esquive
  var dodgeFactor = 1;
  var agiCaster = (caster.stats && caster.stats.agi) || 0;
  var agiEnemy = (enemy.stats && enemy.stats.agi) || 0;
  if (agiEnemy > 0) dodgeFactor = Math.max(1, agiEnemy / Math.max(1, agiCaster));
  var paRatio = caster.pa / Math.max(1, caster.paMax);
  var chance = Math.ceil(dodgeFactor * paRatio * 50);
  return Math.random() * 100 < chance;
}

function resolveSpell(caster, spell, tx, ty) {
  var target = (caster === S.player) ? S.bot : S.player;
  var whoCls = (caster === S.player) ? 'p' : 'c';

  // esquive de PA en mêlée — en 1.29, le sort est annulé et le PA est perdu
  if (paDodge(caster, spell, target)) {
    caster.pa -= 1;
    log('<span class="' + whoCls + '">⚡ ' + caster.n + '</span> perd un PA et rate <b>' + spell.n + '</b> (esquive en mêlée !)', whoCls);
    sfx('error');
    showMsg(target.x, target.y, '⚡ Esquive');
    render();
    return false;
  }
  // Échec critique (Dofus 1.29)
  if (spell.critFailRate && Math.random() * 100 < spell.critFailRate) {
    log('<span class=\"' + whoCls + '\">💥 ' + caster.n + '</span> rate <b>' + spell.n + '</b> — échec critique !', whoCls);
    sfx('error');
    showMsg(caster.x, caster.y, '💥 ÉCHEC');
    if (spell.endsTurnOnFailure) { caster.pa = 0; caster.pm = 0; }
    caster.pa -= spell.cost;
    render();
    return false;
  }
  caster.pa -= spell.cost;

  if (spell.type === 'self') {
    if (spell.self === 'heal') {
      var h1 = rand(spell.d[0], spell.d[1]);
      var healed = healUnit(caster, h1);
      sfx('heal');
      animHeal(caster.x, caster.y);
      log('<span class="' + whoCls + '">' + caster.n + '</span> lance <b>' + spell.i + ' ' + spell.n + '</b> (' + spell.cost + ' PA) : +' + healed + ' PV.');
      render();
    } else if (spell.self === 'flat') {
      if (spell.flat) { caster.flatTurns = spell.flat.turns; caster.flatBonus = spell.flat.v; }
      if (spell.pct) { caster.powerPctTurns = spell.pct.turns; caster.powerPctBonus = spell.pct.v; }
      sfx('buff'); animBuff(caster.x, caster.y);
      showMsg(caster.x, caster.y, '💪 +' + spell.flat.v);
      log('<span class="' + whoCls + '">' + caster.n + '</span> lance <b>' + spell.i + ' ' + spell.n + '</b> (' + spell.cost + ' PA) : +' + spell.flat.v + ' dégâts' + (spell.pct ? ' et +' + Math.round(spell.pct.v * 100) + '%' : '') + ' pendant ' + spell.flat.turns + ' tour' + (spell.flat.turns > 1 ? 's' : '') + ' !');
      render();
    } else if (spell.self === 'powerPct') {
      if (caster.powerPctTurns > 0) { log('Déjà sous l\'effet d\'un bonus de dégâts !', whoCls); sfx('error'); caster.pa += spell.cost; return false; }
      caster.powerPctTurns = spell.pct.turns;
      caster.powerPctBonus = spell.pct.v;
      sfx('buff'); animBuff(caster.x, caster.y);
      showMsg(caster.x, caster.y, '🔱 +' + Math.round(spell.pct.v * 100) + '%');
      log('<span class="' + whoCls + '">' + caster.n + '</span> lance <b>' + spell.i + ' ' + spell.n + '</b> (' + spell.cost + ' PA) : +' + Math.round(spell.pct.v * 100) + '% de dégâts pendant ' + spell.pct.turns + ' tours !');
      render();
    } else if (spell.self === 'critUp') {
      if (caster.critUpTurns > 0) { log('Tir Critique déjà actif !', whoCls); sfx('error'); caster.pa += spell.cost; return false; }
      caster.critUpTurns = 3;
      caster.critUpBonus = 0.15;
      sfx('buff'); animBuff(caster.x, caster.y);
      showMsg(caster.x, caster.y, '🎯 +15% critique');
      log('<span class="' + whoCls + '">' + caster.n + '</span> lance <b>' + spell.i + ' ' + spell.n + '</b> (' + spell.cost + ' PA) : +15% coups critiques et +20% dégâts pendant 3 tours !');
      render();
    } else if (spell.self === 'vita') {
      if (caster.vitaTurns > 0) { log('Vitalité déjà active !', whoCls); sfx('error'); caster.pa += spell.cost; return false; }
      caster.vitaTurns = spell.vita.turns;
      caster.vitaBonus = spell.vita.v;
      caster.maxHp += spell.vita.v;
      caster.hp = Math.min(caster.maxHp, caster.hp + spell.vita.v);
      sfx('buff'); animBuff(caster.x, caster.y);
      showMsg(caster.x, caster.y, '💚 +' + spell.vita.v);
      log('<span class="' + whoCls + '">' + caster.n + '</span> lance <b>' + spell.i + ' ' + spell.n + '</b> (' + spell.cost + ' PA) : +' + spell.vita.v + ' PV max pendant ' + spell.vita.turns + ' tours !');
      render();
    } else if (spell.self === 'rangeUp') {
      if (caster.rangeUpTurns > 0) { log('Tir Éloigné déjà actif !', whoCls); sfx('error'); caster.pa += spell.cost; return false; }
      caster.rangeUpTurns = 3;
      caster.rangeUpBonus = 2;
      sfx('buff'); animBuff(caster.x, caster.y);
      showMsg(caster.x, caster.y, '👁️ +2');
      log('<span class="' + whoCls + '">' + caster.n + '</span> lance <b>' + spell.i + ' ' + spell.n + '</b> (' + spell.cost + ' PA) : +2 de portée pendant 3 tours !');
      render();
    }
    if (caster.pa >= spell.cost) S.spell = spell;
    else S.spell = null;
    return true;
  }
  if (spell.type === 'summon') {
    var sd = spell.summon;
    var m = summonMinion(caster, sd);
    if (m) {
      log('<span class="' + whoCls + '">' + caster.n + '</span> lance <b>' + spell.i + ' ' + spell.n + '</b> (' + spell.cost + ' PA) : invoque ' + m.n + ' !');
    }
    render();
    if (caster.pa >= spell.cost) S.spell = spell;
    else S.spell = null;
    return true;
  }
  if (spell.type === 'tp') {
    var tpx = caster.x, tpy = caster.y, tox = target.x, toy = target.y;
    // Bond : téléportation symétrique par rapport à la cible
    var bdx = tx - target.x, bdy = ty - target.y;
    var bx = target.x - bdx, by = target.y - bdy;
    if (cellBlocked(bx, by) || occupiedBy(bx, by)) {
      // tombe sur une case libre adjacente
      var fallback = false;
      var bdirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
      for (var bi = 0; bi < bdirs.length; bi++) {
        var fnx = target.x - bdx + bdirs[bi][0], fny = target.y - bdy + bdirs[bi][1];
        if (!cellBlocked(fnx, fny) && !occupiedBy(fnx, fny)) {
          bx = fnx; by = fny; fallback = true; break;
        }
      }
      if (!fallback) bx = caster.x, by = caster.y;
    }
    caster.x = bx; caster.y = by;
    sfx('move');
    flashCell(bx, by);
    animUnitMove(caster === S.player ? unitP : unitB, caster, tpx, tpy);
    log('<span class="' + whoCls + '">' + caster.n + '</span> lance <b>' + spell.i + ' ' + spell.n + '</b> (' + spell.cost + ' PA) et se téléporte !');
    if (caster.pa >= spell.cost) S.spell = spell;
    else S.spell = null;
    render();
    return true;
  }
  if (spell.type === 'push') {
    var ppx = target.x, ppy = target.y;
    var pushed = pushUnit(caster, target, spell.push);
    if (pushed > 0) animUnitMove(target === S.player ? unitP : unitB, target, ppx, ppy);
    sfx('push');
    log('<span class="' + whoCls + '">' + caster.n + '</span> lance <b>' + spell.i + ' ' + spell.n + '</b> (' + spell.cost + ' PA) : 💨 repoussé' + (pushed > 1 ? ' x' + pushed : '') + (pushed === 0 ? ' (bloqué)' : '') + '.');
    if (caster.pa >= spell.cost) S.spell = spell;
    else S.spell = null;
    render();
    return true;
  }
  if (spell.type === 'debuff' && spell.vuln) {
    target.vulnTurns = spell.vuln.turns;
    target.vulnPct = spell.vuln.pct;
    sfx('cast');
    showMsg(target.x, target.y, '💔 -' + spell.vuln.pct + '%');
    log('<span class="' + whoCls + '">' + caster.n + '</span> lance <b>' + spell.i + ' ' + spell.n + '</b> (' + spell.cost + ' PA) : ' + target.n + ' est vulnérable (-' + spell.vuln.pct + '% résistances, ' + spell.vuln.turns + ' tours) !');
    if (caster.pa >= spell.cost) S.spell = spell;
    else S.spell = null;
    render();
    return true;
  }

  // dégâts — simple ou zone (cercle/ligne/croix)
  var hits = [];
  if (spell.selfZone) {
    // Zone centrée sur le lanceur (rayon 1) — touche l'adversaire s'il est adjacent
    if (Math.abs(caster.x - target.x) + Math.abs(caster.y - target.y) <= 1) hits.push(target);
  } else if (spell.aoe || spell.zone) {
    // Détermine le type de zone : aoe=1 → cercle, zone='line' → ligne, zone='cross' → croix
    var zType = spell.zone || 'circle';
    var zRadius = spell.aoe || spell.zoneRadius || 1;
    var zoneCells = getZoneCells(caster, tx, ty, zType, zRadius);
    // Collecte les unités touchées
    var allTargets = [S.player, S.bot];
    // Ajoute les minions
    if (S.player.minions) allTargets = allTargets.concat(S.player.minions);
    if (S.bot.minions) allTargets = allTargets.concat(S.bot.minions);
    for (var ti = 0; ti < allTargets.length; ti++) {
      var t = allTargets[ti];
      if (t.hp <= 0) continue;
      if (zoneCells[t.x + ',' + t.y]) hits.push(t);
    }
  } else {
    hits.push(target);
  }
  if (!hits.length) {
    log('<span class="' + whoCls + '">' + caster.n + '</span> lance <b>' + spell.i + ' ' + spell.n + '</b> (' + spell.cost + ' PA)… dans le vide !', whoCls);
    sfx('cast');
    render();
    return true;
  }
  animCast(caster.x, caster.y, spell.el || 'Neutre');
  for (var h = 0; h < hits.length; h++) {
    var vict = hits[h];
    var calc = computeDmg(caster, spell);
    var dmgRes = applyDamage(vict, calc.d, spell.el);
    if (h === 0 && dist(caster, vict) > 1) animProjectile(caster.x, caster.y, vict.x, vict.y, spell.el);
    var extra = '';
    if (spell.d2) {
      var calc2 = computeDmg(caster, { d: spell.d2, el: spell.el2 });
      var dmgRes2 = applyDamage(vict, calc2.d, spell.el2);
      extra += ' + <b>' + dmgRes2.d + '</b> ' + spell.el2;
      if (dmgRes2.resisted) extra += ' (résiste)';
    }
    sfx(calc.crit ? 'crit' : 'hit');
    bounceUnit(vict === S.player ? unitP : unitB);
    showDmg(vict, vict.x, vict.y, '-' + dmgRes.d, calc.crit ? 'crit' : null);
    animImpact(vict.x, vict.y, spell.el);
    if (spell.push && vict === target) {
      var pushed = pushUnit(caster, target, spell.push);
      if (pushed > 0) { extra += ' 💨 Repoussé' + (pushed > 1 ? ' x' + pushed : ''); sfx('push'); }
    }
    if (spell.steal && vict === target && dmgRes.d > 0) {
      var steal = Math.max(1, Math.round(dmgRes.d * spell.steal));
      if (steal > 25) steal = 25; // limite de vol de vie (anti-stalemate, esprit 1.29)
      var st = healUnit(caster, steal);
      extra += ' 🩸 +' + st + ' PV volés';
    }
    if (spell.slow && vict === target) {
      target.slowTurns = 1;
      extra += ' ❄️ Ralenti';
      sfx('freeze');
    }
    if (spell.paDodgeDown && vict === target) {
      target.paDodgeDownTurns = 2;
      extra += ' 🎯 -esquive PA';
    }
    if (spell.subRange && vict === target) {
      target.subRangeTurns = 2;
      target.subRangeBonus = spell.subRange;
      extra += ' 👁️ -' + spell.subRange + ' portée';
    }
    if (spell.flat && vict === target) {
      caster.flatTurns = spell.flat.turns;
      caster.flatBonus = spell.flat.v;
      extra += ' 💪 +' + spell.flat.v + ' dégâts';
      sfx('buff'); animBuff(caster.x, caster.y);
    }
    if (spell.poison && vict === target && !target.poisonTurns) {
      target.poisonTurns = spell.poison.turns;
      target.poisonDmg = spell.poison.d;
      extra += ' ☠️ Empoisonné';
      sfx('cast');
    }
    if (dmgRes.resisted) extra += ' (résiste)';
    if (dmgRes.shielded > 0) extra += ' (🛡️' + dmgRes.shielded + ')';
    log('<span class="' + whoCls + '">' + caster.n + '</span> lance <b>' + spell.i + ' ' + spell.n + '</b> (' + spell.cost + ' PA · ' + spell.el + ') : <b>' + dmgRes.d + ' dégâts</b>' +
        (calc.crit ? ' <span style="color:#ff6b6b">CRITIQUE !</span>' : '') + extra + '.');
    if (vict.hp <= 0) {
      vict.hp = 0;
      endGame(vict === S.player ? S.bot : S.player);
      return true;
    }
  }
  if (caster.pa >= spell.cost) S.spell = spell;
  else S.spell = null;
  render();
  return true;
}
function pushUnit(caster, target, maxCells) {
  var dx = target.x - caster.x, dy = target.y - caster.y;
  var sx = dx !== 0 ? (dx > 0 ? 1 : -1) : 0;
  var sy = dy !== 0 ? (dy > 0 ? 1 : -1) : 0;
  var pushed = 0;
  for (var i = 0; i < maxCells; i++) {
    var nx = target.x + sx, ny = target.y + sy;
    if (cellBlocked(nx, ny) || occupiedBy(nx, ny)) break;
    target.x = nx; target.y = ny;
    pushed++;
  }
  if (pushed > 0) flashCell(target.x, target.y);
  else showMsg(target.x, target.y, '🛡️ Bloqué');
  return pushed;
}
function endGame(winner) {
  S.over = true; busy = true;
  render();
  var ov = document.getElementById('overlay');
  var box = document.getElementById('ovBox');
  var title, color, sub;
  if (winner === S.player) {
    title = '🏆 VICTOIRE !';
    color = '#ffd75e';
    sub = S.bot.n + ' est tombé en ' + S.round + ' tour' + (S.round > 1 ? 's' : '') + '.';
    sfx('win');
  } else {
    title = '💀 DÉFAITE…';
    color = '#ff6b6b';
    sub = S.bot.n + ' t\'a eu en ' + S.round + ' tour' + (S.round > 1 ? 's' : '') + '.';
    sfx('lose');
  }
  var html = '<div id="ovTitle" style="color:' + color + '">' + title + '</div>';
  html += '<div id="ovMsg">' + sub + '</div>';
  html += '<button id="btnAgain">🔁 Rejouer</button> <button id="btnMenu">🏠 Changer</button>';
  box.innerHTML = html;
  document.getElementById('btnAgain').onclick = function () { newGame(); };
  document.getElementById('btnMenu').onclick = function () { renderMenu(); };
  ov.classList.remove('hidden');
}

/* ---------------- Menu ---------------- */
function classSub(c) {
  var s = c.stats;
  return c.hp + ' PV · ' + c.el + ' · Force ' + s.force + ' / Intel ' + s.intel + ' / Chance ' + s.chance + ' / Agi ' + s.agi + ' / Vita ' + s.vita + ' / Sag ' + s.sag +
    '<br>' + c.desc +
    '<br>Sorts (niv requis) : ' + c.spells.map(function (sp) { return sp.i + sp.lvl; }).join(' ');
}
function renderMenu() {
  clearTurnTimers();
  playMusic('musMenu');
  busy = false;
  document.getElementById('overlay').classList.remove('hidden');
  var box = document.getElementById('ovBox');
  var html = '<div class="menuLogo"></div><div id="ovTitle" style="color:#ffd75e">⚔️ DOFUS DUEL — 1.29</div>';
  html += '<div id="ovMsg">Choisis ta classe et ton adversaire. Les sorts s\'apprennent avec ton niveau (comme en 1.29).</div>';
  html += '<div class="menuRow">';
  html += '<div class="menuCol"><h3>Ta classe</h3>';
  for (var k in CLASSES) {
    var c = CLASSES[k];
    html += '<button class="opt' + (SEL.cls === k ? ' sel' : '') + '" data-cls="' + k + '">';
    html += '<span class="oIco">' + c.icon + '</span>' + c.n;
    html += '<span class="oSub">' + classSub(c) + '</span>';
    html += '</button>';
  }
  html += '</div><div class="menuCol"><h3>Adversaire</h3>';
  for (var a in ADVERSARIES) {
    var ad = ADVERSARIES[a];
    html += '<button class="opt' + (SEL.adv === a ? ' sel' : '') + '" data-adv="' + a + '">';
    html += '<span class="oIco">' + ad.icon + '</span>' + ad.n;
    html += '<span class="oSub">' + classSub(ad) + '</span>';
    html += '</button>';
  }
  html += '</div></div>';
  html += '<button id="btnFight">⚔️ COMBATTRE</button> <button id="btnHelpMenu">❓ Guide</button>';
  box.innerHTML = html;
  document.getElementById('btnFight').onclick = function () { newGame(); };
  document.getElementById('btnHelpMenu').onclick = function () { renderHelp(); };

  var clsBtns = box.querySelectorAll('.opt[data-cls]');
  for (var i = 0; i < clsBtns.length; i++) {
    (function (b) {
      b.onclick = function () {
        SEL.cls = b.getAttribute('data-cls');
        for (var j = 0; j < clsBtns.length; j++) clsBtns[j].classList.remove('sel');
        b.classList.add('sel');
      };
    })(clsBtns[i]);
  }
  var advBtns = box.querySelectorAll('.opt[data-adv]');
  for (var k2 = 0; k2 < advBtns.length; k2++) {
    (function (b) {
      b.onclick = function () {
        SEL.adv = b.getAttribute('data-adv');
        for (var j2 = 0; j2 < advBtns.length; j2++) advBtns[j2].classList.remove('sel');
        b.classList.add('sel');
      };
    })(advBtns[k2]);
    }
    }
    function renderHelp() {
  clearTurnTimers();
  playMusic('musMenu');
  busy = false;
  document.getElementById('overlay').classList.remove('hidden');
  var box = document.getElementById('ovBox');
  var html = '<div class="menuLogo"></div><div id="ovTitle" style="color:#ffd75e">📖 GUIDE DU DUEL</div>';
  html += '<div id="ovMsg">Tout ce qu\'il faut savoir avant de combattre.</div>';
  html += '<div class="helpBlock"><h4>🎯 Objectif</h4><p>Réduis les PV de l\'adversaire à 0. Chaque tour : <b>6 PA</b> (lancer des sorts) et <b>3 PM</b> (se déplacer).</p></div>';
  html += '<div class="helpBlock"><h4>📜 Sorts & niveau</h4><p>Comme en Dofus 1.29, les 20 sorts de ta classe s\'apprennent avec le niveau (1, 3, 6, 9, 13, 17, 21, 26, 31, 36, 42, 48, 54, 60, 70, 80, 90, 100) — les plus puissants (Épée de Iop, Colère de Iop, Maîtrise de l\'Arc) arrivent au niv 90-100. Le niveau max est 200 : après 100, tu gagnes encore PV et dégâts. Ton adversaire a le même niveau que toi.</p></div>';
  html += '<div class="helpBlock"><h4>💪 Caractéristiques 1.29</h4><p>Force / Intelligence / Chance / Agilité / Vitalité / Sagesse. Tous les 5 points dans une carac = +1 dégât de son élément (Force→Terre/Neutre, Intel→Feu, Chance→Eau, Agi→Air). L\'Agilité booste esquive et coups critiques, la Sagesse donne de la résistance. Chaque niveau : +5 PV et +1 dans ta carac principale (Force pour l\'Iop, Agilité pour le Cra).</p></div>';
  html += '<div class="helpBlock"><h4>🟢 Se déplacer</h4><p>Clique une case <b>verte</b>. Le chiffre affiché = PM nécessaires. Entrer <b>à côté d\'un ennemi</b> coûte 2 PM (liseré rouge = zone de danger).</p></div>';
  html += '<div class="helpBlock"><h4>🟠 Lancer un sort</h4><p>Clique un sort dans la barre : sa <b>portée</b> s\'affiche en clair sur la grille. Clique la cible <b>orange</b>. Certains sorts exigent une <b>ligne de vue</b> : si un arbre te bloque, la cible devient <b>rouge</b>. Les sorts <b>Zone</b> (Épée Céleste, Flèche Explosive) touchent la cible et les cases voisines. Le <b>Bond</b> téléporte vers une case en portée.</p></div>';
  html += '<div class="helpBlock"><h4>⚡ Mêlée</h4><p>Lancer un sort à côté d\'un ennemi risque de te faire perdre des PA (esquive). Les sorts de mêlée (portée 1) sont moins risqués.</p></div>';
  html += '<div class="helpBlock"><h4>🧱 Résistances</h4><p>L\'Iop résiste à la Terre mais craint l\'Air. Le Cra résiste à l\'Air mais craint la Terre. La Sagesse ajoute de la résistance générale.</p></div>';
  html += '<div class="helpBlock"><h4>✨ Effets</h4><p>Les icônes au-dessus des personnages montrent leurs états : 🔱 bonus % dégâts, 💪 bonus dégâts, 🎯 critique, 💚 PV max, 👁️ portée, ❄️ ralenti, 🎯-esq (esquive PA réduite), 👁️-port (portée réduite), ☠️ empoisonné.</p></div>';
  html += '<div class="helpBlock"><h4>⚔️ L\'Iop</h4><p>Mêlée, gros PV, Force. Compulsion/Puissance/Mutilation avant de frapper, Bond pour sauter au contact, Souffle pour repousser, Épée du Jugement vole de la vie, Épée de Iop et Colère de Iop pour finir.</p></div>';
  html += '<div class="helpBlock"><h4>🏹 Le Cra</h4><p>Distance, Agilité. Reste à 4-8 cases : Flèche Magique en cadence, Tir Puissant et Tir Critique pour buff, Empoisonnée pour saigner, Immobilisation/Cinglante pour ralentir, Absorbante vole la vie, Explosive frappe en zone.</p></div>';
  
  html += '<button id="btnHelpGo">✅ C\'est parti !</button>';
  box.innerHTML = html;
  document.getElementById('btnHelpGo').onclick = function () {
    try { localStorage.setItem('dofus_help', '1'); } catch (e) {}
    renderMenu();
  };
}

/* ---------------- Actions joueur ---------------- */
function buildSpellButtons() {
  var wrap = document.getElementById('spells');
  wrap.innerHTML = '';
  for (var i = 0; i < S.player.spells.length; i++) {
    var sp = S.player.spells[i];
    var b = document.createElement('button');
    b.className = 'spellBtn';
    b.innerHTML = '<span class="ico">' + sp.i + '</span>' + sp.n + '<span class="cost">' + sp.cost + ' PA</span>';
    (function (s) {
      b.onclick = function () { selectSpell(s); };
      b.onmouseenter = function () { showSpellInfo(s); };
      b.onmouseleave = function () { showSpellInfo(S.spell || null); };
    })(sp);
    wrap.appendChild(b);
  }
}
function buildBotSpells() {
  var wrap = document.getElementById('bSpells');
  wrap.innerHTML = '';
  if (!S) return;
  for (var i = 0; i < S.bot.spells.length; i++) {
    var sp = S.bot.spells[i];
    var b = document.createElement('div');
    b.className = 'bSpell';
    b.innerHTML = sp.i + '<small>' + sp.cost + ' PA</small>';
    b.title = sp.n;
    (function (s) {
      b.onmouseenter = function () { showSpellInfo(s, S.bot.n); };
      b.onclick = function () { showSpellInfo(s, S.bot.n); };
    })(sp);
    wrap.appendChild(b);
  }
}
function selectSpell(sp) {
  if (busy || S.turn !== 'p' || S.over) return;
  if (S.player.pa < sp.cost) { log('Pas assez de PA pour <b>' + sp.n + '</b> !', 'c'); sfx('error'); return; }
  if (sp.type === 'self') {
    resolveSpell(S.player, sp, 0, 0);
    afterPlayerAction();
    return;
  }
  if (S.phase === 'spell' && S.spell === sp) {
    S.phase = 'move'; S.spell = null;
  } else {
    S.phase = 'spell'; S.spell = sp;
  }
  render();
}
function clickCell(x, y) {
  if (busy || S.turn !== 'p' || S.over) return;
  if (S.phase === 'spell' && S.spell) {
    var sp = S.spell;
    var pmax = pMax(sp, S.player);
    var d = dist(S.player, S.bot);
    if (sp.type === 'dmg' || sp.type === 'debuff' || sp.type === 'push') {
      var ok = false;
      if (sp.aoe) {
        var da = Math.abs(S.player.x - x) + Math.abs(S.player.y - y);
        ok = da >= sp.min && da <= pmax;
      } else if (sp.type === 'push') {
        ok = (x === S.bot.x && y === S.bot.y) && d >= sp.min && d <= pmax;
      } else {
        ok = (x === S.bot.x && y === S.bot.y) && d >= sp.min && d <= pmax &&
             (!sp.los || los(S.player.x, S.player.y, S.bot.x, S.bot.y));
      }
      if (ok) {
        resolveSpell(S.player, sp, x, y);
        // S.spell gardé pour tir en rafale (si PA restants)
        S.phase = 'move';
        afterPlayerAction();
      } else {
        log('Hors de portée ou pas de ligne de vue pour <b>' + sp.n + '</b>.', 'c');
        sfx('error');
        S.phase = 'move';
        render();
      }
    } else if (sp.type === 'tp') {
      var d2 = Math.abs(S.player.x - x) + Math.abs(S.player.y - y);
      if (d2 >= sp.min && d2 <= sp.max && !cellBlocked(x, y) && !occupiedBy(x, y)) {
        resolveSpell(S.player, sp, x, y);
        // S.spell gardé pour tir en rafale (si PA restants)
        S.phase = 'move';
        afterPlayerAction();
      } else {
        log('Destination invalide pour <b>' + sp.n + '</b>.', 'c');
        sfx('error');
        S.phase = 'move';
        render();
      }
    }
  } else {
    var pc = pathToCosts(S.player.x, S.player.y, x, y, S.player.pm, S.bot);
    if (pc) {
      var ox = S.player.x, oy = S.player.y;
      S.player.x = x; S.player.y = y;
      S.player.pm -= pc.cost;
      sfx('move');
      flashCell(x, y);
      animUnitMove(unitP, S.player, ox, oy);
      render();
    }
  }
}
function afterPlayerAction() {
  render();
}

/* ---------------- IA du bot (multi-sorts, buff→attaque, repli) ---------------- */
function botTurn() {
  S.turn = 'b';
  S.bot.paMax = 6;
  S.bot.pmMax = S.bot.immobilized ? 0 : (S.bot.slowTurns > 0 ? 2 : 3);
  S.bot.pa = S.bot.paMax;
  S.bot.pm = S.bot.pmMax;
  if (S.bot.slowTurns > 0) { log('❄️ ' + S.bot.n + ' est ralenti — 2 PM ce tour !', 'c'); S.bot.slowTurns = 0; }
  if (S.bot.immobilized) log('🪤 ' + S.bot.n + ' est immobilisé et ne peut pas bouger !', 'c');
  S.bot.immobilized = false;
  if (!tickPoison(S.bot, 'c')) return;
  render();

  // Move to optimal position
  var d = dist(S.bot, S.player);
  var hpRatio = S.bot.hp / S.bot.maxHp;
  var enemyLow = S.player.hp < S.player.maxHp * 0.4;
  var botBest = 3, botMin = 1;
  for (var bi = 0; bi < S.bot.spells.length; bi++) {
    var bs = S.bot.spells[bi];
    if ((bs.type === 'dmg' || bs.type === 'debuff') && bs.max > botBest) botBest = bs.max;
    if ((bs.type === 'dmg' || bs.type === 'debuff') && bs.min < botMin) botMin = bs.min;
  }
  var fireLo = Math.max(1, botMin), fireHi = botBest;

  var reach = reachCosts(S.bot.x, S.bot.y, S.bot.pm, S.player);
  var best = null, bestScore = -1e9;
  var canReach = false;
  for (var k in reach) {
    var c = k.split(','), cx = parseInt(c[0], 10), cy = parseInt(c[1], 10);
    var nd = Math.abs(cx - S.player.x) + Math.abs(cy - S.player.y);
    var canFire = los(cx, cy, S.player.x, S.player.y);
    var sc = 0;
    if (nd >= fireLo && nd <= fireHi && canFire) { canReach = true; sc += 120; }
    if (S.bot.style === 'ranged') {
      if (nd < fireLo) sc -= 50;
      if (hpRatio < 0.3 && nd < 3) sc -= 80; // retreat when critically low
      if (nd >= 2 && nd <= fireHi && canFire) sc += 30;
      if (S.bot.ia === 'flee' && nd <= 2) sc -= 100;
    } else {
      if (nd <= 1) sc += 100;
      if (nd <= 2) sc += 50;
      if (nd >= 4) sc -= 30;
      if (hpRatio < 0.25 && nd <= 1) sc -= 40; // melee retreat when dying
      if (enemyLow && nd <= 1) sc += 60; // finish off low enemy
    }
    sc += Math.random() * 6;
    if (sc > bestScore) { bestScore = sc; best = [cx, cy]; }
  }
  
  if (best && S.bot.pm > 0) {
    var pc = pathToCosts(S.bot.x, S.bot.y, best[0], best[1], S.bot.pm, S.player);
    if (pc && pc.path.length) {
      var last = pc.path[Math.min(S.bot.pm, pc.path.length) - 1];
      var bpx = S.bot.x, bpy = S.bot.y;
      S.bot.x = last[0]; S.bot.y = last[1];
      S.bot.pm -= pc.cost;
      sfx('move');
      flashCell(S.bot.x, S.bot.y);
      animUnitMove(unitB, S.bot, bpx, bpy);
      render();
    }
  }
  later(botAct, 400);
}

function botAct() {
  if (S.over) return;
  var d = dist(S.bot, S.player);
  var i, sp, best = null, bestScore = -1e9, avg, sc, tx = S.player.x, ty = S.player.y;
  var hpRatio = S.bot.hp / S.bot.maxHp;

  // Recompute max range for positioning checks
  var fireHi = 3;
  for (var bi = 0; bi < S.bot.spells.length; bi++) {
    var bs = S.bot.spells[bi];
    if ((bs.type === 'dmg' || bs.type === 'debuff') && bs.max > fireHi) fireHi = bs.max;
  }

  // Priority: heal/shield when low, buff when safe, attack otherwise
  var priorityHeal = hpRatio < 0.55 && !S.bot.vitaTurns && !S.bot.rangeUpTurns;
  var priorityBuff = !S.bot.powerPctTurns && !S.bot.flatTurns && S.bot.pa >= 5;

  for (i = 0; i < S.bot.spells.length; i++) {
    sp = S.bot.spells[i];
    if (S.bot.pa < sp.cost) continue;

    if (sp.type === 'self') {
      if (sp.self === 'heal' && S.bot.hp < S.bot.maxHp * 0.55) {
        var healAvg = sp.d ? (sp.d[0] + sp.d[1]) / 2 : 30;
        var need = S.bot.maxHp - S.bot.hp;
        sc = Math.min(healAvg, need) * 2 + 40;
        if (sc > bestScore) { bestScore = sc; best = sp; }
      }
      if (sp.self === 'vita' && !S.bot.vitaTurns && hpRatio < 0.6) {
        if (55 > bestScore) { bestScore = 55; best = sp; }
      }
      if (sp.self === 'powerPct' && !S.bot.powerPctTurns) {
        var okDist = S.bot.style === 'ranged' ? (d >= 2 && d <= fireHi) : (d <= 3);
        if (okDist && 62 > bestScore) { bestScore = 62; best = sp; }
      }
      if (sp.self === 'flat' && !S.bot.flatTurns) {
        var okDist2 = S.bot.style === 'ranged' ? d >= 2 : d <= 3;
        if (okDist2 && 50 > bestScore) { bestScore = 50; best = sp; }
      }
      if (sp.self === 'critUp' && !S.bot.critUpTurns && S.bot.style === 'ranged' && d >= 2) {
        if (42 > bestScore) { bestScore = 42; best = sp; }
      }
      if (sp.self === 'rangeUp' && !S.bot.rangeUpTurns && S.bot.style === 'ranged') {
        if (38 > bestScore) { bestScore = 38; best = sp; }
      }
      continue;
    }
    if (sp.type === 'tp') {
      if (S.bot.style === 'melee' && d > 2 && S.bot.pa >= sp.cost + 2) {
        var bestTp = null, bestTpD = 1e9;
        for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
          var dd = Math.abs(S.bot.x - x) + Math.abs(S.bot.y - y);
          var dj = Math.abs(S.player.x - x) + Math.abs(S.player.y - y);
          if (dd >= sp.min && dd <= sp.max && !cellBlocked(x, y) && !occupiedBy(x, y) && dj < bestTpD) {
            bestTpD = dj; bestTp = [x, y];
          }
        }
        if (bestTp && bestTpD <= 1) {
          var tpSc = 80 - d * 3;
          if (tpSc > bestScore) { bestScore = tpSc; best = sp; tx = bestTp[0]; ty = bestTp[1]; }
        }
      }
      continue;
    }
    if (sp.type === 'push') {
      if ((S.bot.style === 'ranged' || hpRatio < 0.3) && d <= 2) {
        if (35 > bestScore) { bestScore = 35; best = sp; }
      }
      continue;
    }
    if (sp.type !== 'dmg' && sp.type !== 'debuff') continue;
    if (d < sp.min || d > pMax(sp, S.bot)) continue;
    if (sp.los && !los(S.bot.x, S.bot.y, S.player.x, S.player.y)) continue;
    if (sp.type === 'dmg') {
      avg = (sp.d[0] + sp.d[1]) / 2;
      if (sp.d2) avg += (sp.d2[0] + sp.d2[1]) / 2;
      // Apply stat multiplier (same as computeDmg)
      avg *= (1 + elBonus(S.bot, sp.el));
      // Scale by current buffs
      if (S.bot.powerPctTurns > 0) avg *= (1 + S.bot.powerPctBonus);
      if (S.bot.flatTurns > 0) avg += S.bot.flatBonus;
      sc = avg / sp.cost * 20;
      // Bonus for exploiting weakness
      var tres = S.player.res[sp.el] || 0;
      if (tres < -5) sc += 25;
      else if (tres < 0) sc += 12;
      // Penalty for strong resistance
      if (tres > 10) sc -= 20;
      if (sp.aoe && d <= sp.aoe) sc -= 40;
      if (sp.push && d === 1 && S.bot.style === 'ranged') sc += 25;
      if (sp.slow && !S.player.slowTurns) sc += 18;
      if (sp.poison && !S.player.poisonTurns) sc += 20;
      if (sp.steal) sc += 8;
      if (sp.subRange && !S.player.subRangeTurns) sc += 10;
      if (sp.paDodgeDown && !S.player.paDodgeDownTurns) sc += 8;
      if (!sp.los) sc += 6;
      // Finish off low enemy
      if (S.player.hp < S.player.maxHp * 0.25 && avg >= S.player.hp * 0.5) sc += 40;
      if (sc > bestScore) { bestScore = sc; best = sp; }
    } else if (sp.vuln && !S.player.vulnTurns) {
      if (20 > bestScore) { bestScore = 20; best = sp; }
    }
  }

  if (best) {
    resolveSpell(S.bot, best, tx, ty);
    render();
    // Chain: if still has PA, attack again after short delay
    if (S.bot.pa > 0 && !S.over) {
      later(botAct, 300);
    } else {
      later(endBotTurn, 350);
    }
  } else {
    // No valid action found — end turn
    log(S.bot.n + ' n\'a plus rien à faire.', 'c');
    later(endBotTurn, 350);
  }
}
function endBotTurn() {
  if (S.over) return;
  if (S.bot.powerPctTurns > 0) S.bot.powerPctTurns--;
  if (S.bot.flatTurns > 0) S.bot.flatTurns--;
  if (S.bot.critUpTurns > 0) S.bot.critUpTurns--;
  if (S.bot.rangeUpTurns > 0) S.bot.rangeUpTurns--;
  if (S.bot.vitaTurns > 0) {
    S.bot.vitaTurns--;
    if (!S.bot.vitaTurns) { S.bot.maxHp -= S.bot.vitaBonus; S.bot.hp = Math.min(S.bot.hp, S.bot.maxHp); }
  }
  if (S.player.vulnTurns > 0) S.player.vulnTurns--;
  if (S.player.paDodgeDownTurns > 0) S.player.paDodgeDownTurns--;
  if (S.player.subRangeTurns > 0) S.player.subRangeTurns--;
  S.round++;
  minionTurn(S.bot);
  busy = false;
  playerTurn();
}

/* ---------------- Init ---------------- */
document.getElementById('grid').addEventListener('click', function (e) {
  var c = e.target;
  while (c && c !== this && !c.classList.contains('cell')) c = c.parentNode;
  if (c && c.classList.contains('cell')) {
    clickCell(parseInt(c.getAttribute('data-x'), 10), parseInt(c.getAttribute('data-y'), 10));
  }
});
document.getElementById('grid').addEventListener('mouseover', function (e) {
  var c = e.target;
  while (c && c !== this && !c.classList.contains('cell')) c = c.parentNode;
  if (c && c.classList.contains('cell') && !c.classList.contains('obs')) c.classList.add('hov');
});
document.getElementById('grid').addEventListener('mouseout', function (e) {
  var c = e.target;
  while (c && c !== this && !c.classList.contains('cell')) c = c.parentNode;
  if (c && c.classList.contains('cell')) c.classList.remove('hov');
});
document.getElementById('btnEnd').onclick = function () { endPlayerTurn(); };
document.body.addEventListener('click', function () { initAudio(); if (musicOn) playMusic(S && !S.over ? 'musFight' : 'musMenu'); }, { once: true });

buildGrid();
document.getElementById('btnHelp').onclick = function () { renderHelp(); };
renderMenu();
