/* Retouche de Kervénec (octobre 2026) : les escaliers de la fabrique de glace. Retour du propriétaire : « les premières marches sont
   vachement proches du mur auquel elles font face ». Sur le relevé de la carte construite :
     node tools/dev/visual/plan.js esquisses/kervenec-escaliers-glace.js 13 30 -11 11
   Aujourd'hui, les deux escaliers longent le mur est (x 24,6 à 26,6) et descendent du milieu (z ±2,2, à l'étage, 3,8 m) jusqu'au mur
   du fond (z ±8,65) : la dernière marche touche le mur, on sort de côté. Ils ne peuvent pas raccourcir : 6,45 m pour 3,8 m, la pente
   (0,59) est déjà près de la limite des bots (0,62 m par mètre).
   Proposition : les deux volées gardent leur longueur et leur pente mais glissent vers le milieu, où leurs têtes se rejoignent sur une
   passerelle de 1,2 m à l'étage (z -0,6 à 0,6, au lieu de 4,4 m). Le pied de chaque volée est à z ±7,05 : 1,6 m de sol libre devant la
   première marche, jusqu'au mur du fond et sa porte (x 21 à 23,6). À l'étage, la trémie suit la volée ; une dalle couvre le bout de la
   bande (z ±7,05 à ±8,65), avec un garde-corps au bord de la trémie. Au sol, sous la passerelle, entre les deux têtes, un passage de
   1,2 m relie la halle au couloir le long du mur est. Moitié nord, recopiée en miroir au sud. */
module.exports = {
  nom: 'kervenec-escaliers-glace',
  titre: 'Kervénec, fabrique de glace : escaliers dégagés du mur du fond',
  carte: 'embruns',
  bornes: [13, 30, -11, 11],
  miroir: 'z',
  objets: [
    { n: 'escalier (monte vers le milieu, 3,8 m)', rampe: [24.6, 26.6, 0.6, 7.05] },
  ],
  // les volées d'aujourd'hui
  retirer: [[24.6, 26.6, 2.2, 8.65]],
};
