/* Retouche de Val-Blanc (chantier des cartes, octobre 2026) : repères hauts par moitié et un étage de plus. Sur le relevé :
   MAP=givre node tools/dev/visual/plan.js esquisses/val-blanc-refonte-b.js -34 6 2 46
   Mesures de départ (audits/givre.json) : repère vu de 46,9 % du sol (60 au moins), réseau en hauteur 2,2 % (3 à 10).
   1. Sur le replat de la falaise ouest (hors du jeu, sommet de la roche à 15,5 m), une tour par moitié, même gabarit (3,4 m de côté,
      sommet vers 29 m) : au sud (Alpha) le clocher de la chapelle du col, flèche d'ardoise ; au nord (Bravo) la tour de guet du vieux
      fort, créneaux et drapeau. On sait de quel côté on est en levant les yeux. Mesuré (reperes.js) : la paire vue de 72 % du sol.
   2. Dans chaque halle aux marchandises, une mezzanine de stockage contre le mur de la gare (z 7 à 11,6, plancher à 2,5 m), rampe de
      1,75 m le long du mur est ; sa fenêtre est, relevée à 2,75 m, donne sur la Grand-Rue et la porte nord du hall (B). La porte du quai
      glisse de z 10,5-13,5 à 12-15 (la mezzanine passait au-dessus). Les caisses du mur est (dans la rampe) passent sous la mezzanine.
      Construit : réseau en hauteur 2,2 % -> 3,3 %, repère vu de 46,9 % -> plus de 60 %. */
module.exports = {
  nom: 'val-blanc-refonte-b',
  titre: 'Val-Blanc, tours repères et mezzanine de la halle',
  carte: 'givre',
  bornes: [-34, 24, -48, 48],
  miroir: 'z',
  objets: [
    { n: 'clocher / tour du fort (hors jeu, sur la falaise)', x: -30.5, z: 40, w: 3.4, d: 3.4, h: 13.5, sur: true },
    { n: 'mezzanine (2,5 m)', poly: [[-8.7, 7.0], [-3.3, 7.0], [-3.3, 11.6], [-8.7, 11.6]], type: 'zone' },
    { rampe: [-5.05, -3.3, 11.6, 15.8] },
    { n: 'caisses', x: -4.25, z: 8.3, w: 1.1, d: 1.1, h: 2.0, sous: true },
  ],
  retirer: [[-4.7, -3.5, 11.7, 12.9]],
  domination: [[-11.5, 33.5, 'A'], [-2, 0, 'B'], [-11.5, -33.5, 'C']],
};
