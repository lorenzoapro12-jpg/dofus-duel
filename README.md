# ⚔️ Dofus Duel — Combat 1v1 (Dofus 1.29)

Clone de combat tactique Dofus 1.29, **100% navigateur** (aucun serveur requis — ouvre `index.html`).

## Jouer
Ouvre `index.html` dans un navigateur (Chrome/Firefox). Choisis ta classe (Iop, Cra), ton adversaire (Iop, Cra, ou 7 monstres d'Amakna), et combats au tour par tour : 6 PA pour lancer des sorts, 3 PM pour te déplacer.

## Contenu
- **Combat isométrique style Dofus 1.29** : grille en losanges (SVG) sur la carte d'Amakna, **Clofus animé** (sprite sheet 8 directions, marche animée), minogolems ennemis, rochers en obstacles.
- **2 classes jouables** : Iop (mêlée, Force) et Cra (distance, Agilité) — **20 sorts chacun**, niveaux d'apprentissage réels 1.29 (1 → 100), PA, portées, lignes de vue et éléments authentiques.
- **7 monstres adversaires** : Larve Bleue, Tofu (fuit le contact), Bouftou, Sanglier (repousse), Wabbit, Chafer, Bouftou Royal (boss qui se soigne) — PV, caracs et sorts inspirés des données 1.29.
- **Mécaniques 1.29** : dégâts élémentaires + bonus de carac, résistances (élément + Sagesse), esquive de PA en mêlée, coups critiques, poison, vol de vie (plafonné), buffs % et plats, ralentissement, -esquive, -portée, repousses, téléportation (Bond), zones, soin.
- **Progression** : XP et kamas, niveau max **200** (+5 PV, +1 carac principale, déblocage des sorts).
- **Musiques officielles Dofus 1.29** : Amakna au menu, combat d'Amakna en combat (bouton 🔊).

## Structure
```
index.html          — page (scripts classiques, compatible file://)
css/style.css       — styles (thème Dofus)
js/data.js          — classes, sorts, monstres (données 1.29)
js/game.js          — moteur de combat, IA du bot, menu, progression
assets/music/       — musiques 1.29 (amakna.mp3, combat-amakna.mp3)
assets/img/         — sprites (réserve, non encore utilisés)
```

## Sources des données 1.29
- Sorts, niveaux, PA, portées : base `d2j_static.sql` + `spells.xml` — émulateurs 1.29 **Emudofus/Shivas** et **BotanAtomic/GDCore**
- Monstres (PV, grades, sorts, type d'IA) : `data/monster/templates.xml` — **BotanAtomic/GDCore**
- IA des monstres : classes `ArtificialIntelligence` (Attack, Tofu flee, heal) — **Graviton/GDCore**
- Musiques : Dofus 1.29 (fichiers présents dans le repo TristanBerger6/Dofus-like-game)
- Graphismes (sprites Clofus, minogolems, carte, rochers, polices) : repo TristanBerger6/Dofus-like-game

Les dégâts sont calibrés sur l'échelle PV du jeu (360–1355 PV) : les dés 1.29 bruts (1d4+11) ont été multipliés ~×4 pour rester fidèles aux rapports dégâts/PV.

## Tests
- `node --check` sur data.js / game.js
- Harnais DOM simulé : 15 tests unitaires + 42 combats simulés (2 classes × 7 monstres × 3 niveaux) — tous passent
- Playwright (Chromium) : chargement, menu, combat, IA, musiques — OK
