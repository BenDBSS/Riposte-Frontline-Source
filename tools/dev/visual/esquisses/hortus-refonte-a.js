/* Retouche de Hortus (chantier des cartes, octobre 2026) : points A et C, B, impasses, marche d'un camp à l'autre. Sur le relevé de la carte
   construite : MAP=floreal node tools/dev/visual/plan.js esquisses/hortus-refonte-a.js -38 38 12 50
   Mesures de départ (audits/floreal.json) : A et C vus de 16 apparitions sur 18 (l'allée des parterres donne en plein sur le parvis et les
   baies de l'orangerie), 2 couverts à 9 m (6 au moins) ; B vu de 3 apparitions par camp (le passage entre les deux parterres de l'ouest
   file droit jusqu'à la serre) ; 17 impasses (2 au plus) ; 87,5 m de marche d'un camp à l'autre (90 au moins).
   1. L'allée devient une allée bordée de charmilles : le bord des deux parterres du milieu, côté allée, monte à 1,8 m (trois tronçons de
      4 m par côté, coupés aux chemins de traverse). A et C (0, ±30,8) : vus de 3 apparitions, 6 couverts, 29,4 m de la base.
   2. Une charmille de 3,2 m sur la pelouse de l'ouest (x -13,3 à -10,1, z ±18,7) coupe la vue des apparitions sur B.
   3. Impasses : le labyrinthe est tressé (chaque cul-de-sac s'ouvre sur la case voisine) ; massifs de buis entre l'orangerie et les remises
      et derrière les remises (renfoncements fermés par le mur d'enceinte) ; établis de rempotage dans les angles du fond de l'orangerie ;
      roche dans les deux alcôves du fond de la grotte du Rocher. 17 à 0.
   4. Deux apparitions du premier rang de l'ouest reculent : (-8, 42,2) à (-6,5, 43,5), (-14,5, 42,4) à (-14,5, 43,5).
   Moitié nord (Alpha), recopiée en miroir au sud. */
module.exports = {
  nom: 'hortus-refonte-a',
  titre: 'Hortus, allée de charmilles, B caché, impasses',
  carte: 'floreal',
  bornes: [-38, 38, 12, 50],
  miroir: 'z',
  objets: [
    { n: 'charmille (1,8 m)', x: -5.375, z: 28.7, w: 0.35, d: 4.0, h: 1.8 }, { n: 'charmille', x: -5.375, z: 33.7, w: 0.35, d: 4.0, h: 1.8 }, { n: 'charmille', x: -5.375, z: 38.7, w: 0.35, d: 4.0, h: 1.8 },
    { n: 'charmille (1,8 m)', x: 5.375, z: 28.7, w: 0.35, d: 4.0, h: 1.8 }, { n: 'charmille', x: 5.375, z: 33.7, w: 0.35, d: 4.0, h: 1.8 }, { n: 'charmille', x: 5.375, z: 38.7, w: 0.35, d: 4.0, h: 1.8 },
    { n: 'charmille de B', x: -11.7, z: 18.65, w: 3.2, d: 0.5, h: 1.8 },
    { n: 'buis (1,6 m)', x: -19.0, z: 47.0, w: 3.4, d: 4.0, h: 1.6 }, { n: 'buis', x: 19.0, z: 47.0, w: 3.4, d: 4.0, h: 1.6 },
    { n: 'buis', x: -35.5, z: 47.0, w: 2.4, d: 4.0, h: 1.6 }, { n: 'buis', x: 35.5, z: 47.0, w: 2.4, d: 4.0, h: 1.6 },
    { n: 'établi', x: -15.35, z: 48.4, w: 2.2, d: 2.15, h: 0.9 }, { n: 'établi', x: 15.35, z: 48.4, w: 2.2, d: 2.15, h: 0.9 },
  ],
  apparitions: { alpha: [[-11.4, 45.6], [-10.0, 47.4], [0, 45.6], [2.3, 45.4], [11.4, 45.6], [12.6, 47.5], [-6.5, 43.5], [-4, 42.4], [4, 42.4], [8, 42.2], [-14.5, 43.5], [14.5, 42.4], [-20, 42.4], [20, 42.4], [-28.7, 46.2], [-25.5, 47.2], [26.3, 46.2], [29.5, 47.2]] },
  domination: [[0, 30.8, 'A'], [-12, 0, 'B'], [0, -30.8, 'C']],
};
