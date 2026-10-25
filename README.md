<h1 align="center"><img src="assets/logo.webp" alt="Riposte: Frontline" width="640"></h1>

**Riposte: Frontline** est un jeu de tir à la première personne gratuit, joué dans le navigateur, sur ordinateur comme sur téléphone,
dans l'esprit des Call of Duty modernes : https://www.playriposte.com

Ce dépôt est la copie publique du code du jeu, version 5.6.0, mise à jour à chaque nouvelle version. Vous pouvez le lire, le
récupérer et vous en servir pour vos propres jeux selon la licence MIT (`LICENSE`), à l'exception des éléments listés dans `NOTICE.md`
(nom et logo, musiques, animations des soldats, certains sons). Le développement se fait ailleurs : les pull requests ne sont pas
reprises. Pour signaler un problème, passez par l'espace Communauté du jeu.

*English below.*

## Ce qu'il y a dedans

Le jeu entier : moteur de rendu (three.js), cartes, décors, armes, soldats et tenues, bots, physique, sons, menus, commandes au
clavier, à la souris, à la manette et à l'écran tactile, multijoueur entre navigateurs. Toute la géométrie est construite par le
code, sans modèle 3D importé.

Le côté serveur du site officiel n'en fait pas partie : comptes, progression enregistrée, classement, amis, communauté, modération
et serveur de jeu des salons en ligne. Sans lui, le jeu marche en solo, et les parties en ligne passent de navigateur à navigateur
(PeerJS). Les écrans de compte indiquent que les comptes ne sont pas disponibles.

## Jouer et construire

Aucune dépendance à installer, Python 3 suffit :

```bash
python3 build.py
```

Le script assemble `dist/riposte-frontline.html`, la page du jeu, et `dist/tex/`, `dist/sfx/` (textures et sons, chargés au
lancement d'une carte). Ouvrez `dist/riposte-frontline.html` dans un navigateur récent (Chrome, Edge, Firefox), en gardant ces
dossiers à côté. Le dossier `dist/` de ce dépôt est déjà construit.

## Organisation du code

`src/*.js` est mis bout à bout dans l'ordre alphabétique, puis injecté dans `shell.html` (page, styles et menus). Une fonction n'y est
déclarée qu'une fois (`python3 tools/dev/check_decl.py`).

| Fichiers | Contenu |
| --- | --- |
| `src/00-*`, `src/01-*` | traductions, démarrage, rendu et réglages du GPU |
| `src/02-*` | cartes et décor : relief, matériaux, lumière, eau, végétation, kits de chaque carte |
| `src/03-*`, `src/07-*` | navigation et intelligence des bots |
| `src/04-*` | effets, physique des objets |
| `src/05-*` | son |
| `src/06-*` | armes et leurs modèles, soldats, animations, tenues, ragdolls |
| `src/08-*` | joueur, commandes, séries d'éliminations, véhicules |
| `src/09-*` | partie, chargement, réseau, menus, commandes tactiles et manette, interface |
| `i18n/en.txt` | textes anglais (le jeu est écrit en français, l'anglais est la langue par défaut) |
| `assets/` | textures, sons, animations cuites, icônes |
| `tools/` | fabrication des assets (`build_*.py`), contrôles et tests visuels (`tools/dev/`) |

Les tests visuels de `tools/dev/visual/` ouvrent le jeu dans Chromium (`cd tools/dev && npm ci`, puis par exemple
`node tools/dev/visual/menus.js`).

---

## English

**Riposte: Frontline** is a free first-person shooter played in the browser, on desktop and on phones, in the spirit of modern
Call of Duty games: https://www.playriposte.com

This repository is the public copy of the game's source code, version 5.6.0, updated with each new version. You can read it,
download it and use it for your own games under the MIT License (`LICENSE`), except for the items listed in `NOTICE.md` (name and
logo, music, soldier animations, some sounds). Development happens elsewhere, so pull requests are not merged. To report a problem,
use the Community space in the game.

**What is inside.** The whole game: renderer (three.js), maps, scenery, weapons, soldiers and outfits, bots, physics, sound, menus,
keyboard, mouse, gamepad and touch controls, browser to browser multiplayer. All geometry is built by code, with no imported 3D model.
The server side of the official site is not included (accounts, saved progress, leaderboard, friends, community, moderation and the
game server for online lobbies). Without it, the game runs solo and online matches go from browser to browser (PeerJS).

**Build and play.** Python 3 is all you need: `python3 build.py` assembles `dist/riposte-frontline.html`, then open it in a recent
browser with `dist/tex/` and `dist/sfx/` next to it. The `dist/` folder of this repository is already built. The code, its comments
and its documentation are in French. The table above maps the `src/` files by number: setup and GPU (00, 01), maps and scenery (02),
bots (03, 07), effects and physics (04), sound (05), weapons, soldiers and outfits (06), player, controls and vehicles (08), match,
network, menus and interface (09).
