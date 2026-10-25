/* Retouche de Kervénec (chantier des cartes, octobre 2026) : points A, B, C, réseau en hauteur, impasses. Sur le relevé de la carte
   construite : MAP=embruns node tools/dev/visual/plan.js esquisses/kervenec-refonte-a.js -40 40 -6 52
   Mesures de départ (audits/embruns.json) : A et C vus de 11 apparitions sur 12 de leur camp (la base donne en plein sur la rue du
   Port, A à 7 m de son bord) ; B praticable à 42 % (70 au moins : le tapis de vente, trois gradins de 0,8 m et leur mur de dossier) ;
   réseau en hauteur 3,9 % (5 à 12) ; 4 impasses (2 au plus).
   1. A et C passent de (8, ±33) à (8,5, ±30,5), et une pile de caisses de 2,1 m en travers de la rue du Port (x 5,4 à 7,6, z ±34) les
      cache à la base : 3 apparitions sur 12 (4 au plus). Mesuré avant de construire (leveldesign.js, DOM=...).
   2. B reste au milieu de la vente : deux gradins de 0,9 m sans mur de dossier (praticables), l'enseigne « Ventes » pend de la
      charpente. 74 % praticable (leveldesign.js, qui compte les gradins ; plan.js ne compte que le sol : 58 %).
   3. Le conteneur de la base (x 18,5 à 24,5, z ±45,6) devient une vigie sur la rue du Port : rampe de chargement côté rue, palier sur
      poteaux au niveau du toit (2,6 m) ; le sol reste praticable sous le palier. Réseau en hauteur 5,1 %.
   4. Impasses : un étal comble le fond de la bande entre l'escalier de la mezzanine de la Criée et le mur est (au-delà, la porte de
      z = ±11) ; il reste le bout des estacades sur pieux des bases, voulu (2).
   Moitié nord (Alpha), recopiée en miroir au sud ; la Criée (axe) au milieu. */
module.exports = {
  nom: 'kervenec-refonte-a',
  titre: 'Kervénec, points A, B, C, vigie de la base et impasses',
  carte: 'embruns',
  bornes: [-40, 40, -6, 52],
  miroir: 'z',
  objets: [
    { n: 'caisses (2,1 m)', x: 6.5, z: 34.0, w: 2.3, d: 1.2, h: 2.1 },
    { n: 'gradins (0,4 et 0,8 m)', x: -5, z: 2.1, w: 10, d: 1.8, h: 0.8, sous: true },
    { n: 'rampe vers le toit du conteneur', rampe: [18.5, 23.4, 42.95, 44.35] },
    { n: 'palier sur poteaux (2,6 m)', x: 24.5, z: 43.2, w: 2.2, d: 2.4, h: 2.6, sur: true },
    { n: 'étal', x: 7.6, z: 7.5, w: 1.1, d: 2.4, h: 0.9 },
  ],
  // le troisième gradin et le mur de dossier de la vente
  retirer: [[-10, 0, 3.0, 3.85]],
  domination: [[8.5, 30.5, 'A'], [-3, 0, 'B'], [8.5, -30.5, 'C']],
};
