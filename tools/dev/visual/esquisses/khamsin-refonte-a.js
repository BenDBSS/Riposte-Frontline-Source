/* Retouche de Khamsin (chantier des cartes, octobre 2026) : vues de plus de 60 m et impasses. Sur le relevé de la carte construite :
   MAP=sable node tools/dev/visual/plan.js esquisses/khamsin-refonte-a.js -40 40 -6 56
   Mesures de départ (audits/sable.json) : 13,1 % des vues au sol de plus de 60 m (10 au plus), 8 impasses (2 au plus).
   1. Les vues de plus de 60 m passent par les ouvertures du milieu : l'arche du Portail (x -32 à -28) sur le Long (la voiture brûlée,
      basse, laissait passer la vue au-dessus d'elle), la porte de la Rue centrale (x -4,1 à -1,6), et une rangée est-ouest à z = 14,5 par
      le Passage. Le Long reste une rue de tireur jusqu'au Portail (une trentaine de mètres depuis la base).
   2. Impasses : la bande derrière la tente de la base (le groupe électrogène en bouchait la sortie est), l'angle nord-est du hangar (le chariot
      élévateur fermait une poche contre les murs), le coin de l'arrière-cour derrière la benne, le dessous du palier de l'escalier de la Maison.
   Moitié nord (Alpha), recopiée en miroir au sud. */
module.exports = {
  nom: 'khamsin-refonte-a',
  titre: 'Khamsin, longues vues du milieu et impasses',
  carte: 'sable',
  bornes: [-40, 40, -6, 56],
  miroir: 'z',
  objets: [
    // 1. un camion arrêté en travers devant le Portail (x -33,2 à -25,8), à la place de la voiture brûlée : on le contourne par les deux bouts
    //    (1,6 m à l'ouest, 1,9 m à l'est) ; la « xbox » devant les Portes prend une caisse en haut sur sa moitié est ; une pile de caisses de
    //    2,1 m à la sortie du Passage, dans la cour des conteneurs (la rangée de z = 14,5 filait jusqu'au Long)
    { n: 'camion', x: -29.5, z: 7.2, w: 7.4, d: 2.5, h: 3.1 },
    { n: 'caisse haute', x: -2.2, z: 3.3, w: 0.9, d: 0.9, h: 1.9 },
    { n: 'caisses (2,1 m)', x: 22.6, z: 15.15, w: 1.2, d: 2.4, h: 2.1 },
    // 2. le groupe électrogène glisse de 2 m vers l'est : la bande derrière la tente sort des deux côtés
    { n: 'groupe électrogène', x: -11.5, z: 49.3, w: 1.9, d: 1.1, h: 1.4 },
    // le chariot élévateur quitte l'angle du hangar pour l'arrière-cour ; la benne passe au fond de l'arrière-cour, contre la base
    { n: 'chariot élévateur', x: 30.5, z: 39.2, w: 1.6, d: 2.2, h: 1.5 },
    { n: 'benne', x: 34.9, z: 39.8, w: 2.0, d: 1.2, h: 1.4 },
    // sous le palier de la Maison, trois caisses (le recoin n'est plus praticable)
    { n: 'caisses', x: -15.3, z: 27.6, w: 1.1, d: 3.5, h: 1.1 },
  ],
  // la voiture brûlée, le groupe, le chariot, la benne d'avant
  retirer: [[-33.8, -31.2, 5.0, 9.0], [-14.45, -12.55, 48.75, 49.85], [33.2, 34.8, 27.5, 29.7], [33.1, 35.3, 36.4, 37.6]],
  domination: [[1, 31, 'A'], [11, 0, 'B'], [1, -31, 'C']],
};
