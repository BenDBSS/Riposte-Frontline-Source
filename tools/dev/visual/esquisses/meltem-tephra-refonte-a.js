/* Retouche de Meltem et de Tephra (chantier des cartes, octobre 2026) : le point B des deux cartes. Sur les relevés des cartes construites :
   MAP=meltem node tools/dev/visual/plan.js esquisses/meltem-tephra-refonte-a.js -16 0 -10 10
   Meltem, mesures de départ (audits/meltem.json) : B pas à égalité de marche (56,4 et 63 m, 5 d'écart au plus). B est sur la margelle du
   platane ; la collision du tronc (un carré de 1,24 m) fermait les cases de la margelle de part et d'autre de l'axe, et le nœud du point
   ne tenait que d'un côté. Tronc en octogone de 1,2 m : 58,8 et 57,8 m, 75 % praticable. Il s'ouvrait alors une cinquième entrée (le
   parvis de l'église) : la jardinière de l'angle nord-est de la place (et sud-est) s'en va, le nord et le parvis ne font plus qu'une
   entrée : 3 entrées.
   Tephra (MAP=tephra, -30 0 -14 14) : B a 5 entrées (2 à 4). Le bac de mousse de l'ouest (3,2 x 1,1 m en travers, z ±7,2) coupait en deux
   l'accès du nord-ouest et celui du nord ; tourné dans l'axe du point (1,1 x 3,2 m, z ±7,6) : 3 entrées.
   Reste à Meltem : 12 carrefours sur la route la plus courte (8 au plus), qui tient au plan serré du village. */
module.exports = {
  nom: 'meltem-tephra-refonte-a',
  titre: 'Meltem et Tephra, le point B',
  carte: 'meltem',
  bornes: [-16, 0, -10, 10],
  miroir: 'z',
  objets: [
    { n: 'tronc du platane (octogone)', x: -8.5, z: 0, w: 1.2, d: 1.2, h: 5 },
  ],
  // la jardinière de l'angle de la place
  retirer: [[-7.7, -6.7, 5.1, 6.9]],
  domination: [[-9, 34, 'A'], [-8.5, 0, 'B'], [-9, -34, 'C']],
};
