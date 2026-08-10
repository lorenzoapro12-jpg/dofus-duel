/* ============================================================
   Dofus Duel — DONNÉES (classes, sorts, adversaires, monstres)
   Données réelles Dofus 1.29 : base d2j_static + spells.xml
   des émulateurs 1.29 (Emudofus/Shivas, BotanAtomic/GDCore).
   ============================================================ */
/* ---------------- Définitions — Dofus 1.29 (données réelles) ----------------
   Arsenal complet 1.29 : 20 sorts par classe, niveaux d'apprentissage réels
   (1,1,1,3,6,9,13,17,21,26,31,36,42,48,54,60,70,80,90,100), PA, portées,
   lignes de vue, éléments et effets fidèles aux données 1.29 (source :
   base d2j_static des émulateurs 1.29). Dégâts calibrés sur l'échelle PV du jeu.
   ------------------------------------------------------------------ */
var CLASSES = {
  iop: { n: 'Iop', icon: '⚔️', img: 'clofus.webp', hp: 360, el: 'Terre', mainStat: 'force',
    stats: { force: 30, intel: 10, chance: 10, agi: 10, vita: 40, sag: 15 },
    res: { Neutre: 0, Terre: 15, Feu: 0, Eau: 0, Air: -10 },
    style: 'melee', desc: 'Guerrier 1.29. Force brute : mêlée, buffs de dégâts, Bond, repousses, gros sorts Terre.',
    spells: [
      { id: 'pression', n: 'Pression', i: '👊', lvl: 1, cost: 2, min: 1, max: 2, d: [10, 14], el: 'Terre', los: true, type: 'dmg', desc: 'Coup Terre de base' },
      { id: 'bond', n: 'Bond', i: '🌀', lvl: 1, cost: 5, min: 1, max: 6, el: 'Neutre', los: false, type: 'tp', desc: 'Se téléporte jusqu\'à 6 cases' },
      { id: 'intimidation', n: 'Intimidation', i: '💨', lvl: 1, cost: 2, min: 1, max: 1, d: [6, 10], el: 'Neutre', los: true, type: 'dmg', push: 1, desc: 'Dégâts + repousse de 1 case' },
      { id: 'compulsion', n: 'Compulsion', i: '💪', lvl: 3, cost: 2, min: 0, max: 0, el: 'Neutre', los: false, type: 'self', self: 'flat', flat: { v: 8, turns: 3 }, desc: '+8 dégâts pendant 3 tours' },
      { id: 'divine', n: 'Épée Divine', i: '⚜️', lvl: 6, cost: 3, min: 1, max: 1, d: [12, 20], el: 'Air', los: true, type: 'dmg', selfZone: true, flat: { v: 3, turns: 2 }, desc: 'Dégâts Air autour de toi, +3 dégâts 2 tours' },
      { id: 'destin', n: 'Épée du Destin', i: '🌠', lvl: 9, cost: 4, min: 1, max: 1, d: [12, 18], el: 'Feu', los: true, type: 'dmg', desc: 'Frappe Feu' },
      { id: 'guide', n: 'Guide de Bravoure', i: '🗡️', lvl: 13, cost: 2, min: 0, max: 0, el: 'Neutre', los: false, type: 'self', self: 'flat', flat: { v: 6, turns: 3 }, desc: '+6 dégâts pendant 3 tours' },
      { id: 'amplification', n: 'Amplification', i: '🔥', lvl: 17, cost: 1, min: 0, max: 0, el: 'Neutre', los: false, type: 'self', self: 'flat', flat: { v: 8, turns: 1 }, desc: '+8 dégâts ce tour' },
      { id: 'destructrice', n: 'Épée Destructrice', i: '💥', lvl: 21, cost: 4, min: 1, max: 2, d: [14, 24], el: 'Feu', los: true, type: 'dmg', desc: 'Frappe Feu dévastatrice' },
      { id: 'couper', n: 'Couper', i: '⚔️', lvl: 26, cost: 3, min: 1, max: 3, d: [12, 16], el: 'Feu', los: true, type: 'dmg', paDodgeDown: true, desc: 'Dégâts Feu, la cible esquive moins les PA' },
      { id: 'souffle', n: 'Souffle', i: '🌪️', lvl: 31, cost: 2, min: 2, max: 8, el: 'Neutre', los: false, type: 'push', push: 2, desc: 'Repousse de 2 cases, sans dégâts' },
      { id: 'vitalite', n: 'Vitalité', i: '💚', lvl: 36, cost: 3, min: 0, max: 0, el: 'Neutre', los: false, type: 'self', self: 'vita', vita: { v: 120, turns: 5 }, desc: '+120 PV max pendant 5 tours' },
      { id: 'jugement', n: 'Épée du Jugement', i: '⚡', lvl: 42, cost: 4, min: 1, max: 3, d: [16, 28], el: 'Air', los: false, type: 'dmg', steal: 0.5, desc: 'Dégâts Air sans LoS, vole 50% des dégâts en PV' },
      { id: 'puissance', n: 'Puissance', i: '🔱', lvl: 48, cost: 4, min: 0, max: 0, el: 'Neutre', los: false, type: 'self', self: 'powerPct', pct: { v: 0.5, turns: 3 }, desc: '+50% dégâts pendant 3 tours' },
      { id: 'mutilation', n: 'Mutilation', i: '🩸', lvl: 54, cost: 2, min: 0, max: 0, el: 'Neutre', los: false, type: 'self', self: 'flat', flat: { v: 15, turns: 3 }, pct: { v: 0.25, turns: 3 }, desc: '+15 dégâts et +25% pendant 3 tours' },
      { id: 'tempete', n: 'Tempête de Puissance', i: '🌩️', lvl: 60, cost: 3, min: 3, max: 5, d: [30, 38], el: 'Feu', los: true, type: 'dmg', desc: 'Rafale Feu' },
      { id: 'celeste', n: 'Épée Céleste', i: '✨', lvl: 70, cost: 4, min: 0, max: 4, d: [22, 32], el: 'Air', los: true, type: 'dmg', aoe: 1, desc: 'Dégâts Air en zone (rayon 1)' },
      { id: 'concentration', n: 'Concentration', i: '🎯', lvl: 80, cost: 2, min: 1, max: 1, d: [12, 18], el: 'Terre', los: true, type: 'dmg', desc: 'Frappe Terre rapide' },
      { id: 'epeedeiop', n: 'Épée de Iop', i: '🗡️', lvl: 90, cost: 4, min: 1, max: 4, d: [18, 30], el: 'Terre', los: true, type: 'dmg', desc: 'La grande frappe de l\'Iop' },
      { id: 'colere', n: 'Colère de Iop', i: '😡', lvl: 100, cost: 6, min: 1, max: 1, d: [40, 55], el: 'Terre', los: true, type: 'dmg', desc: 'Le coup ultime de l\'Iop (7 PA en 1.29, 6 ici)' }
    ] },
  cra: { n: 'Cra', icon: '🏹', img: 'clofus.webp', hp: 300, el: 'Air', mainStat: 'agi',
    stats: { force: 10, intel: 10, chance: 10, agi: 35, vita: 30, sag: 15 },
    res: { Neutre: 0, Terre: -10, Feu: 0, Eau: 0, Air: 15 },
    style: 'ranged', desc: 'Archer 1.29. Agilité : reste à distance, flèches variées, contrôle et poison.',
    spells: [
      { id: 'magique', n: 'Flèche Magique', i: '🏹', lvl: 1, cost: 4, min: 2, max: 9, d: [16, 20], el: 'Feu', los: true, type: 'dmg', desc: 'Tir Feu de base' },
      { id: 'empoisonnee', n: 'Flèche Empoisonnée', i: '☠️', lvl: 1, cost: 4, min: 2, max: 7, d: [8, 10], el: 'Neutre', los: true, type: 'dmg', poison: { d: 8, turns: 2 }, desc: 'Dégâts + poison 8 PV/tour pendant 2 tours' },
      { id: 'recul', n: 'Flèche de Recul', i: '💨', lvl: 1, cost: 4, min: 1, max: 5, d: [16, 20], el: 'Air', los: true, type: 'dmg', push: 1, desc: 'Dégâts Air + repousse de 1 case' },
      { id: 'glacee', n: 'Flèche Glacée', i: '❄️', lvl: 3, cost: 3, min: 1, max: 7, d: [9, 11], el: 'Feu', los: true, type: 'dmg', paDodgeDown: true, desc: 'Dégâts Feu, la cible esquive moins les PA' },
      { id: 'enflammee', n: 'Flèche Enflammée', i: '🔥', lvl: 6, cost: 4, min: 1, max: 8, d: [18, 22], el: 'Feu', los: true, type: 'dmg', push: 1, desc: 'Dégâts Feu + repousse' },
      { id: 'eloigne', n: 'Tir Éloigné', i: '👁️', lvl: 9, cost: 2, min: 0, max: 0, el: 'Neutre', los: false, type: 'self', self: 'rangeUp', desc: '+2 portée pendant 3 tours' },
      { id: 'expiation', n: 'Flèche d\'Expiation', i: '🌠', lvl: 13, cost: 4, min: 6, max: 10, d: [28, 34], el: 'Eau', los: true, type: 'dmg', desc: 'Flèche Eau de très longue portée' },
      { id: 'taupe', n: 'Œil de Taupe', i: '🦉', lvl: 17, cost: 3, min: 1, max: 7, d: [12, 16], el: 'Air', los: true, type: 'dmg', steal: 0.5, subRange: 2, desc: 'Dégâts Air, vole 50% des dégâts en PV, -2 portée cible' },
      { id: 'critique', n: 'Tir Critique', i: '🎯', lvl: 21, cost: 2, min: 0, max: 0, el: 'Neutre', los: false, type: 'self', self: 'critUp', desc: '+15% coups critiques et +20% dégâts pendant 3 tours' },
      { id: 'immobilisation', n: 'Flèche d\'Immobilisation', i: '🪤', lvl: 26, cost: 2, min: 1, max: 8, d: [8, 10], el: 'Eau', los: true, type: 'dmg', slow: true, desc: 'Dégâts Eau, la cible a -1 PM à son prochain tour' },
      { id: 'punitive', n: 'Flèche Punitive', i: '🏹', lvl: 31, cost: 4, min: 5, max: 8, d: [26, 30], el: 'Terre', los: true, type: 'dmg', push: 1, desc: 'Dégâts Terre + repousse' },
      { id: 'puissant', n: 'Tir Puissant', i: '⚡', lvl: 36, cost: 3, min: 0, max: 0, el: 'Neutre', los: false, type: 'self', self: 'powerPct', pct: { v: 0.75, turns: 3 }, desc: '+75% dégâts pendant 3 tours' },
      { id: 'harcelante', n: 'Flèche Harcelante', i: '💫', lvl: 42, cost: 3, min: 1, max: 8, d: [12, 15], el: 'Air', los: false, type: 'dmg', desc: 'Dégâts Air qui ignorent la ligne de vue' },
      { id: 'cinglante', n: 'Flèche Cinglante', i: '🌪️', lvl: 48, cost: 3, min: 1, max: 7, d: [12, 14], el: 'Terre', los: true, type: 'dmg', slow: true, desc: 'Dégâts Terre, la cible a -1 PM à son prochain tour' },
      { id: 'persecutrice', n: 'Flèche Persécutrice', i: '🎯', lvl: 54, cost: 3, min: 4, max: 7, d: [10, 12], d2: [10, 12], el: 'Air', el2: 'Feu', los: true, type: 'dmg', desc: 'Double frappe Air + Feu' },
      { id: 'destructrice', n: 'Flèche Destructrice', i: '☄️', lvl: 60, cost: 4, min: 4, max: 7, d: [22, 26], el: 'Terre', los: true, type: 'dmg', desc: 'Grosse flèche Terre' },
      { id: 'absorbante', n: 'Flèche Absorbante', i: '🩸', lvl: 70, cost: 4, min: 4, max: 7, d: [24, 30], el: 'Air', los: true, type: 'dmg', steal: 1, desc: 'Dégâts Air, vole 100% des dégâts en PV' },
      { id: 'ralentissante', n: 'Flèche Ralentissante', i: '🐌', lvl: 80, cost: 4, min: 1, max: 8, d: [18, 22], el: 'Eau', los: true, type: 'dmg', paDodgeDown: true, desc: 'Dégâts Eau, la cible esquive moins les PA' },
      { id: 'explosive', n: 'Flèche Explosive', i: '💣', lvl: 90, cost: 4, min: 1, max: 8, d: [18, 24], el: 'Feu', los: true, type: 'dmg', aoe: 1, desc: 'Dégâts Feu en zone (rayon 1)' },
      { id: 'maitrise', n: 'Maîtrise de l\'Arc', i: '🏹', lvl: 100, cost: 2, min: 0, max: 0, el: 'Neutre', los: false, type: 'self', self: 'flat', flat: { v: 20, turns: 3 }, desc: '+20 dégâts pendant 3 tours' }
    ] }
};

var ADVERSARIES = {
  iop: Object.assign({}, CLASSES.iop, { desc: 'Guerrier 1.29. Charge au contact, buffs ses dégâts et frappe très fort.' }),
  cra: Object.assign({}, CLASSES.cra, { desc: 'Archer 1.29. Garde la distance, te contrôle et t\'empoisonne.' })
};

/* ---------------- Monstres 1.29 (données réelles : GDCore monsters.xml + spells.xml)
   PV/caracs/résistances inspirés des grades 1.29, sorts réels (IDs GDCore),
   dégâts calibrés sur l'échelle PV du jeu. IA : 1=attack, 7=flee (Tofu), heal (Royal).
   ------------------------------------------------------------------ */
var MONSTRES = {
  larve: { n: 'Larve Bleue', icon: '🐛', img: 'minogolem-green.webp', hp: 120, el: 'Eau', mainStat: 'agi',
    stats: { force: 10, intel: 10, chance: 20, agi: 20, vita: 20, sag: 5 },
    res: { Neutre: 0, Terre: -20, Feu: 0, Eau: 10, Air: 0 },
    style: 'melee', ia: 'attack',
    desc: 'Petit monstre d\'Amakna. Mords (Terre) et crache (Eau) en affaiblissant l\'esquive.',
    spells: [
      { id: 'morsure', n: 'Morsure', i: '🦷', lvl: 1, cost: 3, min: 1, max: 1, d: [12, 18], el: 'Terre', los: true, type: 'dmg', desc: 'Morsure Terre (sort 213)' },
      { id: 'crachat', n: 'Crachat', i: '💧', lvl: 1, cost: 3, min: 1, max: 6, d: [8, 12], el: 'Eau', los: true, type: 'dmg', paDodgeDown: true, desc: 'Crachat Eau, la cible esquive moins les PA (sort 212)' }
    ] },
  tofu: { n: 'Tofu', icon: '🐦', img: 'minogolem-grey.webp', hp: 100, el: 'Air', mainStat: 'agi',
    stats: { force: 5, intel: 5, chance: 10, agi: 35, vita: 15, sag: 5 },
    res: { Neutre: 0, Terre: -20, Feu: 0, Eau: 0, Air: 20 },
    style: 'ranged', ia: 'flee',
    desc: 'Oiseau agressif d\'Amakna. Frappe à l\'Air et fuit le contact (IA 7).',
    spells: [
      { id: 'piqure', n: 'Piqure', i: '🪶', lvl: 1, cost: 4, min: 1, max: 3, d: [14, 20], el: 'Air', los: true, type: 'dmg', paDodgeDown: true, desc: 'Piqure Air + -esquive PA (sort 1999)' }
    ] },
  bouftou: { n: 'Bouftou', icon: '🐑', img: 'minogolem-blue.webp', hp: 200, el: 'Neutre', mainStat: 'force',
    stats: { force: 30, intel: 5, chance: 5, agi: 5, vita: 40, sag: 5 },
    res: { Neutre: 10, Terre: -10, Feu: 0, Eau: 0, Air: 0 },
    style: 'melee', ia: 'attack',
    desc: 'Le mouton d\'Amakna. Charge et frappe fort au Neutre (sort 2000).',
    spells: [
      { id: 'coup', n: 'Coup de Bouftou', i: '🐏', lvl: 1, cost: 4, min: 1, max: 1, d: [20, 28], el: 'Neutre', los: true, type: 'dmg', desc: 'Coup Neutre (sort 2000)' }
    ] },
  sanglier: { n: 'Sanglier', icon: '🐗', img: 'minogolem-red.webp', hp: 180, el: 'Neutre', mainStat: 'force',
    stats: { force: 35, intel: 5, chance: 5, agi: 10, vita: 30, sag: 5 },
    res: { Neutre: 0, Terre: 10, Feu: 0, Eau: 0, Air: -10 },
    style: 'melee', ia: 'attack',
    desc: 'Charge sauvage : dégâts Neutre et te repousse (sort 2002).',
    spells: [
      { id: 'charge', n: 'Charge', i: '💨', lvl: 1, cost: 4, min: 1, max: 1, d: [16, 24], el: 'Neutre', los: true, type: 'dmg', push: 1, desc: 'Dégâts Neutre + repousse de 1 case (sort 2002)' }
    ] },
  wabbit: { n: 'Wabbit', icon: '🐰', img: 'minogolem-green.webp', hp: 220, el: 'Terre', mainStat: 'force',
    stats: { force: 25, intel: 5, chance: 10, agi: 15, vita: 35, sag: 5 },
    res: { Neutre: 0, Terre: 10, Feu: -10, Eau: 0, Air: 0 },
    style: 'melee', ia: 'attack',
    desc: 'Lapin-guerrier. Frappe à la Terre (sort 213).',
    spells: [
      { id: 'coup', n: 'Coup de patte', i: '🥊', lvl: 1, cost: 3, min: 1, max: 1, d: [14, 20], el: 'Terre', los: true, type: 'dmg', desc: 'Coup Terre (sort 213)' }
    ] },
  chafer: { n: 'Chafer', icon: '💀', img: 'minogolem-grey.webp', hp: 320, el: 'Terre', mainStat: 'force',
    stats: { force: 45, intel: 5, chance: 5, agi: 10, vita: 50, sag: 10 },
    res: { Neutre: 0, Terre: 20, Feu: -20, Eau: 0, Air: 0 },
    style: 'melee', ia: 'attack',
    desc: 'Squelette soldat des Chafers. Frappe Terre très lourd (sort 268).',
    spells: [
      { id: 'epee', n: 'Épée du Chafer', i: '⚔️', lvl: 1, cost: 3, min: 1, max: 1, d: [30, 42], el: 'Terre', los: true, type: 'dmg', desc: 'Dégâts Terre (sort 268)' }
    ] },
  royal: { n: 'Bouftou Royal', icon: '👑', img: 'minogolem-red.webp', hp: 400, el: 'Neutre', mainStat: 'force',
    stats: { force: 50, intel: 10, chance: 10, agi: 5, vita: 60, sag: 15 },
    res: { Neutre: 10, Terre: 20, Feu: 0, Eau: 0, Air: -20 },
    style: 'melee', ia: 'heal',
    desc: 'Le boss d\'Amakna. Se soigne, frappe et écrase très fort (sorts 252/202/251).',
    spells: [
      { id: 'soin', n: 'Bêlement Soignant', i: '💚', lvl: 1, cost: 3, min: 0, max: 0, d: [40, 60], el: 'Neutre', los: false, type: 'self', self: 'heal', desc: 'Se soigne de 40-60 PV (sort 252)' },
      { id: 'coup', n: 'Coup Royal', i: '🐏', lvl: 1, cost: 4, min: 1, max: 1, d: [30, 40], el: 'Neutre', los: true, type: 'dmg', desc: 'Coup Neutre (sort 202)' },
      { id: 'ecrase', n: 'Écrasement', i: '💥', lvl: 1, cost: 3, min: 1, max: 4, d: [90, 120], el: 'Neutre', los: true, type: 'dmg', desc: 'Écrasement Neutre dévastateur (sort 251)' }
    ] }
};

// Monstres disponibles comme adversaires (IA : attack par défaut)
ADVERSARIES.larve = MONSTRES.larve;
ADVERSARIES.tofu = MONSTRES.tofu;
ADVERSARIES.bouftou = MONSTRES.bouftou;
ADVERSARIES.sanglier = MONSTRES.sanglier;
ADVERSARIES.wabbit = MONSTRES.wabbit;
ADVERSARIES.chafer = MONSTRES.chafer;
ADVERSARIES.royal = MONSTRES.royal;
