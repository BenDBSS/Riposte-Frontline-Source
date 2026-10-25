/* Esquisse d'exemple : la moitié nord de Simoun (camp A, base Alpha, casse, poste de guet, campement bédouin) telle qu'elle est construite
   depuis la 4.6.x. Elle sert de modèle du format ; une nouvelle carte commence par un fichier comme celui-ci, avant le moindre asset.
     node tools/dev/visual/plan.js esquisses/exemple-simoun-nord.js [x0 x1 z0 z1]
   Format (module CommonJS ; tout est en mètres, x vers l'est, z vers le nord, rot en radians comme DECOR.place) :
     nom, titre          nom du fichier produit (plans/<nom>.png) et titre du dessin
     bornes              [x0, x1, z0, z1] du dessin
     miroir: 'z'         facultatif : chaque objet est recopié en miroir (z -> -z, rot -> PI - rot, comme rot() des plans en miroir), sauf
                         ceux marqués axe: true ; les apparitions Bravo aussi, si elles ne sont pas données
     cercle              { r, dur } : zone ronde (la zone de jeu d'une arène)
     zones               [[nom, x0, x1, z0, z1], ...] : les zones de la minicarte
     objets              un objet est l'un de :
       { pf: ['car'], x, z, rot }                     prefab du jeu (PF.car(), PF.smBedouin(7.5, 4.6, 1)...) : son emprise (tous ses sommets :
                                                       haubans, toit) et ses collisions (celles du prefab, ou SM_COLS) sont lues sur le modèle
       { n, x, z, rot, w, d, h, deborde }             construction à la main : rectangle plein w x d, haut de h ; deborde (m, ou [mx, mz]) :
                                                       toit ou haubans qui dépassent, en tirets
       { n, x, z, rot, w, d, vide: true, perches: true }  bâche : rien de plein sous la toile, une perche à chaque coin
       { n, x, z, r, h }                              cercle plein (fût, tronc, pied d'antenne)
       { rampe: [x0, x1, z0, z1] }                    escalier ou rampe (contre son palier par défaut)
       { corde: [[xa, za], [xb, zb]] }                corde à linge entre deux perches (le linge pend jusqu'à 0,5 m du sol)
       { n, poly: [[x, z], ...] | ellipse: [cx, cz, rx, rz], type }  polygone convexe : 'plein' (par défaut), 'zone' (débord seul),
                                                       'eau' ou 'terrain' (dessinés, sans contrôle : une dune, une sebkha)
       drapeaux : sous: true (posé exprès sous une bâche, un toit ou dans des haubans), contre: true (accolé exprès à un autre objet :
       pas de passage à garder), axe: true (sur l'axe, pas recopié en miroir)
     apparitions         { alpha: [[x, z], ...], bravo: [...] }
     domination          [[x, z, 'A'], ...]
     routes              [{ n: 'L' | 'M' | 'E', pts: [[x, z], ...] }, ...] : les couloirs, en tirets de couleur
   Couleurs des pleins : jaune, couvert bas (jusqu'à 1,3 m : on tire par-dessus) ; orange, couvert haut (jusqu'à 2,4 m) ; brun, plus haut. */
const PI = Math.PI;
const sacs = (x, z, axe, long, rangs = 3) => ({ n: 'sacs', x, z, w: axe === 'x' ? long : 0.5, d: axe === 'x' ? 0.5 : long, h: rangs * 0.22 + 0.2 });
const fût = (x, z, o = {}) => ({ n: 'fût', x, z, r: 0.3, h: 0.9, ...o });
const caisse = (x, z, s = 0.9, o = {}) => ({ n: 'caisse', x, z, w: s, d: s, h: s, ...o });
const petit = (n, r, h) => (x, z, o = {}) => ({ n, x, z, r, h, ...o });
const bidon = petit('bidon', 0.2, 0.45), pneu = petit('pneu', 0.4, 0.2), jarre = petit('jarre', 0.25, 0.6), sac = petit('sac', 0.35, 0.5), tronc = petit('arbre', 0.2, 4);
// cabane de tôle (smShack) : le toit déborde de 25 cm sur les côtés et de 30 cm devant et derrière
const cabane = (x, z, rot, w, d, h) => ({ n: 'cabane', x, z, rot, w, d, h, deborde: [0.25, 0.3] });
// mirador (smWatchtower) : plate-forme de 3,2 m à 3 m, toit qui déborde ; son escalier part du côté dir, sur la moitié x > x0
const mirador = (x, z, dir) => [{ n: 'mirador', x, z, w: 3.4, d: 3.4, h: 5.3, deborde: 0.3, contre: true }, { rampe: [x, x + 1.6, Math.min(z + dir * 1.6, z + dir * 7.8), Math.max(z + dir * 1.6, z + dir * 7.8)] }];
module.exports = {
  nom: 'exemple-simoun-nord',
  titre: 'Simoun, moitié nord (exemple)',
  bornes: [-40, 50, 16, 72],
  cercle: { r: 70, dur: 80 },
  zones: [['Base Alpha', -70, 70, 48, 82], ['Camp nord', -20, 20, 19, 46], ['Campement', 26, 50, 34, 52]],
  objets: [
    // le relief à grands traits
    { n: 'dune (2,6 m) : la base ne voit pas A', ellipse: [0, 44.5, 16, 5.5], type: 'terrain' },
    // camp A : cabanes traversantes, conteneur ouvert, tente, mirador, pick-up, bâche
    cabane(-7.5, 34.5, PI / 2, 4.0, 3.4, 2.6), cabane(8.5, 35.5, -PI / 2, 4.4, 3.4, 2.7), cabane(-10.5, 25.5, 0, 3.6, 3.2, 2.5),
    { n: 'conteneur', pf: ['container', true], x: -4.5, z: 24.5, rot: PI / 2 },
    { n: 'tente', pf: ['tent'], x: 7.5, z: 24.5 }, ...mirador(12.5, 30.5, -1),
    { n: 'citerne', pf: ['waterTank'], x: -12.5, z: 31.5 }, { n: 'groupe', pf: ['generator'], x: -2.5, z: 38.5 },
    { n: 'bâche', x: 0.5, z: 35.2, w: 5.4, d: 3.2, vide: true, perches: true },
    { n: 'pick-up', pf: ['car'], x: 7.5, z: 30.2, rot: 1.4 },
    { ...sacs(-0.5, 23.0, 'x', 3.6), contre: true }, sacs(3.5, 31.2, 'z', 2.4), sacs(-16.0, 29.5, 'z', 3.0), sacs(-4.0, 30.5, 'z', 2.4), sacs(1.5, 27.0, 'x', 2.4, 2),
    fût(-9.6, 30.2), fût(-9.0, 29.4), fût(3.3, 28.4), fût(-3.6, 33.6),
    caisse(3.2, 26.4), caisse(-5.2, 37.2, 0.9, { contre: true }), caisse(15.6, 33.8),
    bidon(-0.9, 38.9), bidon(6.4, 38.6), bidon(-8.4, 28.2), pneu(15.8, 25.4), pneu(-14.2, 34.6),
    { corde: [[4.6, 33.9], [5.8, 37.6]] },
    // poste de guet de l'ouest
    ...mirador(-27.5, 29.5, -1), cabane(-32.5, 28.5, -PI / 2, 3.4, 3.0, 2.5),
    sacs(-22.5, 25.5, 'z', 3.0), sacs(-23.0, 30.0, 'z', 2.4), sacs(-30.0, 32.6, 'x', 3.0, 2),
    { n: 'bâche', x: -31.0, z: 23.5, rot: 0.2, w: 3.6, d: 2.6, vide: true, perches: true }, caisse(-30.4, 23.6, 0.9, { sous: true }),
    fût(-34.8, 24.2), fût(-35.3, 24.9), fût(-24.5, 22.5), tronc(-20, 22), { pf: ['smRock', 1.5, 5], x: -33.5, z: 35.5 },
    // la casse de l'est
    { n: 'camion', pf: ['truck'], x: 28.0, z: 27.0, rot: 0.35 }, { n: 'épave', pf: ['car'], x: 21.5, z: 23.3, rot: -1.1 }, { n: 'épave', pf: ['car'], x: 30.5, z: 20.8, rot: 2.6 },
    pneu(24.6, 26.8), pneu(25.4, 28.2), pneu(31.2, 24.0), pneu(21.6, 26.4), caisse(22.6, 20.0), caisse(31.2, 27.4), fût(26.2, 20.4), tronc(24, 21),
    // le campement bédouin, deux tentes ouvertes sur le foyer, un enclos de pierre sèche
    { n: 'tente bédouine', pf: ['smBedouin', 7.5, 4.6, 1], x: 32.0, z: 47.1, rot: 2.5 }, { n: 'tente bédouine', pf: ['smBedouin', 6, 4.2, 2], x: 40.5, z: 38.5, rot: -0.79 },
    { n: 'foyer', x: 36.5, z: 43.5, r: 0.7, h: 0.3 },
    { n: 'muret', x: 41.0, z: 49.5, w: 6, d: 0.5, h: 0.9, contre: true }, { n: 'muret', x: 44.0, z: 47.625, w: 0.5, d: 3.25, h: 0.9, contre: true },
    { n: 'charrette', pf: ['smCart'], x: 29.6, z: 40.4, rot: -2.36 }, tronc(42.6, 46.6),
    jarre(34.8, 40.2), jarre(35.4, 39.6), jarre(38.8, 46.2), sac(33.6, 41.0), sac(39.5, 45.0),
    { n: 'bâche', x: 33.0, z: 38.0, rot: 0.25, w: 4.0, d: 2.6, vide: true, perches: true },
    { corde: [[38.4, 48.6], [41.6, 48.6]] },
    { n: 'rocher', poly: [[41.5, 24.5], [46.5, 24.5], [46.5, 29.5], [41.5, 29.5]], h: 6.5 }, { pf: ['smRock', 1.6, 1], x: 38.5, z: 21.5 }, { pf: ['smRock', 1.7, 7], x: 22.5, z: 60.5 },
    // base Alpha : un convoi à l'arrêt
    { n: 'camion', pf: ['truck'], x: -9.5, z: 64.0, rot: 0.25 }, { n: 'camion', pf: ['truck'], x: 11.0, z: 63.5, rot: -0.25 }, { n: 'voiture', pf: ['car'], x: 16.5, z: 53.5, rot: -0.9 },
    { n: 'tente', pf: ['tent'], x: -16.5, z: 57.5, rot: PI / 2 }, { n: 'tente', pf: ['tent'], x: 0.5, z: 65.5 }, { n: 'antenne', pf: ['antenna'], x: -4.5, z: 64.5 },
    { n: 'groupe', pf: ['generator'], x: 5.5, z: 65.5, rot: 0.2, contre: true }, // accolé à la tente
    { ...sacs(-6.5, 51.0, 'x', 3.6) }, sacs(7.0, 50.5, 'x', 3.6), { ...sacs(-15.5, 52.0, 'z', 3.0), contre: true }, sacs(17.5, 59.5, 'z', 3.0),
    fût(-13.4, 61.7), fût(-12.8, 62.4), fût(-13.7, 62.6), fût(15.8, 61.0), fût(16.4, 60.3),
    caisse(-4.6, 60.4, 1.0, { sous: true }), caisse(7.0, 61.8, 1.0), caisse(-18.6, 53.0, 1.0),
    { n: 'bâche', x: -6.0, z: 61.0, rot: 0.25, w: 4.4, d: 3.2, vide: true, perches: true, contre: true }, // le long du camion
    { n: 'drapeau', x: -1.5, z: 51.5, r: 0.05, h: 5.2 },
  ],
  apparitions: { alpha: [[-12.5, 53.5], [-8.5, 54.5], [-4.5, 53.5], [-0.5, 54.5], [3.5, 53.5], [7.5, 54.5], [11.5, 53.5], [-11.5, 57.5], [-6.5, 57.5], [-2.5, 58.5], [1.5, 57.5], [5.5, 58.5], [9.5, 57.5], [13.5, 56.5], [-1.5, 61.5]] },
  domination: [[0.5, 31.5, 'A']],
  routes: [
    { n: 'L', pts: [[-12, 56], [-20, 44], [-27, 33], [-30, 18]] },
    { n: 'M', pts: [[0, 56], [0, 46], [0.5, 31.5], [0, 18]] },
    { n: 'E', pts: [[12, 56], [24, 46], [37, 41], [40, 30], [38, 18]] },
  ],
};
