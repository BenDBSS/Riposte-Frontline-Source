/* Retouche de Val-Blanc (chantier des cartes, octobre 2026) : les impasses. Sur le relevé de la carte construite :
   MAP=givre node tools/dev/visual/plan.js esquisses/val-blanc-refonte-c.js -26 26 -50 50
   Mesures de départ (audits/givre.json) : 8 impasses (2 au plus), en miroir deux par deux :
   - (-23,5, ±47,5) : la bande entre la falaise et le wagon plat de la base, que le wagon (z 37 à 49) ferme contre le mur du fond ;
   - (-4,5, -10,5) et (-5,5, 9,5) : sous la mezzanine de la halle aux marchandises, la poche entre la tête de la rampe, le mur est et la
     rangée de caisses ;
   - (7,5, ±10,5) : dans l'Hôtel du Col, le coin entre la cheminée, la table et le mur ouest ;
   - (21,5, ±9,5) : au sud de la Scierie, derrière la pile de bûches du chalet de la Placette (la ruelle s'arrête au mur de l'est).
   Moitié nord (Alpha), recopiée en miroir au sud. */
module.exports = {
  nom: 'val-blanc-refonte-c',
  titre: 'Val-Blanc, les impasses',
  carte: 'givre',
  bornes: [-26, 26, 0, 50],
  miroir: 'z',
  objets: [
    // 1. les wagons de la voie ouest reculent : le plat (12 m) de z 43 à 41, la citerne de 30,5 à 29,9 (accolée au plat). Entre le bout du plat et le mur du fond,
    //    1,4 m de passage : la bande derrière le wagon rejoint la base par les deux bouts
    { n: 'wagon plat', x: -19.6, z: 41.0, w: 2.7, d: 12.0, h: 2.4 },
    { n: 'wagon-citerne', x: -19.6, z: 29.9, w: 2.7, d: 10.2, h: 3.5 },
    { n: 'passage 1,4 m', poly: [[-24, 47.0], [-18.25, 47.0], [-18.25, 48.4], [-24, 48.4]], type: 'zone' },
    // 2. sous la mezzanine, plus de rangée de caisses le long du mur de la gare : une seule pile dans l'angle ouest (la poche entre la tête de
    //    la rampe, le mur est et la rangée s'ouvre ; il reste l'angle nord-est de la halle, compté comme impasse : 2, le seuil)
    { n: 'caisses', x: -8.05, z: 8.4, w: 1.1, d: 2.4, h: 2.0 },
    // 3. Hôtel du Col : la table du fond glisse de z 11,6 à 12,6 (on passe entre elle et la cheminée)
    { n: 'table et chaises', x: 7.0, z: 12.6, w: 1.8, d: 2.0, h: 0.8 },
    // 4. le chalet de la Placette perd sa pile de bûches côté Scierie, et la pile de planches en travers du fond de la Scierie s'en va : le
    //    bout de la ruelle de 1,8 m s'ouvre sur l'appentis
    // 5. trois apparitions du premier rang de l'ouest reculent (87,4 m de marche d'un camp à l'autre, 90 au moins) : (-15, 41,5) à (-15, 43),
    //    (-10,5, 41,5) à (-10,5, 42,4), (-5, 41,2) à (-8,2, 44,2), à l'ouest de la tente
  ],
  apparitions: { alpha: [[-15, 43.0], [-15.5, 46], [-10.5, 42.4], [-11.5, 45.5], [-8.2, 44.2], [0.5, 41.8], [3.4, 45.4], [5.5, 41.2], [13.5, 41.8], [15.5, 46.5], [20.8, 42.2], [20.5, 46.2]] },
  // les wagons et les caisses d'avant, la pile de bûches
  retirer: [[-21, -18.2, 37, 49], [-21, -18.2, 25.4, 35.6], [-8.55, -3.85, 7.7, 8.95], [6.0, 8.0, 10.8, 12.4], [18, 21, 9.42, 9.97], [21.9, 23.1, 6.1, 8.5]],
  domination: [[-11.5, 33.5, 'A'], [-2, 0, 'B'], [-11.5, -33.5, 'C']],
};
