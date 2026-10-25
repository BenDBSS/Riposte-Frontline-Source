/* Retouche de Val-Blanc (chantier des cartes, octobre 2026) : la cour du poste-frontière, A, et le hall de la gare, B. Sur le relevé de la carte
   construite : MAP=givre node tools/dev/visual/plan.js esquisses/val-blanc-refonte-a.js -24 10 16 48 (la cour), ... -12 8 -9 9 (le hall)
   Mesures de départ (audits/givre.json) : A vu de 10 apparitions d'Alpha sur 12 (celui qui le prend tire dans la base), 19,8 m de marche
   depuis la base, 4 couverts à 9 m, 2 entrées ; B praticable à 67 % (le guichet occupe le milieu du hall), 5 portes au hall.
   Moitié nord (Alpha), recopiée en miroir au sud ; le hall (axe: true) est au milieu. */
const PI = Math.PI;
const caisse = (x, z, s = 1.0, o = {}) => ({ n: 'caisses', x, z, w: s, d: s, h: 1.1, ...o });
module.exports = {
  nom: 'val-blanc-refonte-a',
  titre: 'Val-Blanc, la cour du poste-frontière (A) et le hall (B)',
  carte: 'givre',
  bornes: [-24, 24, -48, 48],
  miroir: 'z',
  objets: [
    // 1. le bureau de la douane : la cour s'appelle « Border post yard » et n'avait pas de poste. Il ferme la vue de la base sur A (les
    //    apparitions de l'ouest et du centre), traversant nord-sud par une porte de 1,4 m (une entrée de plus pour A), toit plat
    { n: 'douane (3,2 m)', x: -11.25, z: 38.85, w: 4.5, d: 2.5, h: 3.2 },
    { n: 'douane', x: -6.3, z: 38.85, w: 2.6, d: 2.5, h: 3.2 },
    { n: 'passage 1,4 m', poly: [[-9.0, 37.6], [-7.6, 37.6], [-7.6, 40.1], [-9.0, 40.1]], type: 'zone' },
    // 2. une pile de grumes enneigées à l'est de la cour : écran face aux apparitions de l'est (la Grand-Rue), couvert haut pour A
    { n: 'grumes (2,4 m)', x: -2.0, z: 37.2, w: 3.0, d: 1.6, h: 2.4 },
    // 3. couverts devant A, du côté où l'on arrive du centre (les voies, le passage du poste d'aiguillage) : la défense tient en avant du point
    { n: 'chariot à bagages', x: -12.8, z: 29.4, w: 1.2, d: 2.4, h: 1.1 },
    caisse(-6.2, 34.3), caisse(-5.2, 34.4, 0.8),
    // 4. le hall : un guichet plus petit (2,6 x 2,1 m au lieu de 3 x 2,6), et la porte est murée (cinq portes, une de trop pour tenir B)
    { n: 'guichet 2,6 x 2,1', x: 1.3, z: 0, w: 2.6, d: 2.1, h: 2.6, axe: true },
    { n: 'porte est murée', x: 4.775, z: 0, w: 0.45, d: 2.4, h: 4.4, axe: true },
  ],
  // le banc posé devant la douane (un prop) se range contre sa façade ouest, hors du passage ; l'ancien guichet ; la porte est du hall
  retirer: [[-9.3, -7.3, 39.0, 40.0], [-0.3, 2.7, -1.3, 1.3], [4.55, 5.0, -1.2, 1.2]],
  // A recule de 1,5 m vers l'ouest (la douane prend le nord de son disque) ; B au milieu du hall, comme avant
  domination: [[-11.5, 33.5, 'A'], [-2, 0, 'B'], [-11.5, -33.5, 'C']],
  routes: [
    { n: 'L', pts: [[-15, 44], [-15.5, 34], [-14.5, 20], [-14.5, 8]] },
    { n: 'M', pts: [[-8.3, 42], [-8.3, 38.8], [-11.5, 33.5], [-6, 22], [-4, 9]] },
    { n: 'E', pts: [[6, 42], [2, 34], [1, 20], [2, 9]] },
  ],
};
