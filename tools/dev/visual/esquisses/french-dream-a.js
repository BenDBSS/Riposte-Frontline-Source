/* Esquisse de French Dream (nouvelle carte, octobre 2026) : un lotissement pavillonnaire de province, toutes les maisons pareilles, la voiture
   garée devant, les volets roulants baissés. Petite carte de combat rapproché, dans l'esprit de Nuketown.
     node tools/dev/visual/plan.js esquisses/french-dream-a.js
   Le plan : une rue droite d'ouest en est (la rue des Mésanges), qui finit à l'est en raquette de retournement. De part et d'autre, une rangée
   de lots identiques : jardin de devant, pavillon et son garage accolé, jardin de derrière fermé de thuyas. Derrière chaque rangée, la coulée
   verte (chemin, bassin de rétention à sec, lampadaires) où l'on apparaît. Les deux camps se font face par-dessus la rue : la moitié nord
   (Alpha) est recopiée en miroir au sud (Bravo).
   Trois routes :
   - L, le Chantier : le lot 12, une maison en construction (dalle, murs de parpaings à mi-hauteur, plancher de l'étage coulé sur la moitié
     arrière, escalier brut), ouverte à tous les vents ; c'est le poste en hauteur de la moitié ouest.
   - M, la Maison témoin : le seul pavillon ouvert de chaque rangée (meublé, drapeaux « à vendre »). On entre par le garage ouvert, la porte
     d'entrée ou la baie vitrée du jardin ; à l'étage, la chambre donne sur la rue. Au milieu de la rue, le camion de déménagement
     (le bus de Nuketown) coupe la vue d'une maison témoin à l'autre.
   - E, la Raquette : le rond de retournement, son îlot planté et son érable, les conteneurs de tri, le transformateur ; on y descend de la
     coulée verte par la sente piétonne.
   Entre les lots, les allées latérales (3 m et plus) et les trous dans les haies font les liaisons. Pavillons fermés : un bloc plein, toit
   débordant de 40 cm. Murs de la maison témoin et du chantier en traits (25 cm), portes de 1,2 m au moins. */
const PI = Math.PI;
// mur droit de (x0, z0) à (x1, z1), épais de 25 cm (aligné sur x ou sur z)
const mur = (x0, z0, x1, z1, h, o = {}) => ({ n: o.n || 'mur', x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0) || 0.25, d: Math.abs(z1 - z0) || 0.25, h, contre: true, ...o });
// haie de thuyas (2 m, opaque) et haie basse (0,9 m), de (x0, z0) à (x1, z1)
const thuyas = (x0, z0, x1, z1, o = {}) => ({ n: 'thuyas', x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0) || 0.8, d: Math.abs(z1 - z0) || 0.8, h: 2.0, ...o });
const haieBasse = (x0, z0, x1, z1, o = {}) => ({ n: 'haie basse', x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0) || 0.6, d: Math.abs(z1 - z0) || 0.6, h: 0.9, ...o });
const petit = (n, r, h) => (x, z, o = {}) => ({ n, x, z, r, h, ...o });
const boite = petit('boîte aux lettres', 0.2, 1.2), poubelle = petit('poubelle', 0.35, 1.1), lampadaire = petit('lampadaire', 0.12, 4.5), arbuste = petit('jeune arbre', 0.15, 3);
// pavillon fermé : corps de 8,5 m sur 8 (deux niveaux, toit à deux pans qui déborde de 40 cm), garage accolé de 3,2 m sur 6 côté gx
// (+1 à l'est, -1 à l'ouest), le tout posé avec sa façade sur la rue (z0) ; volets roulants baissés
const pavillon = (n, x0, z0, gx) => {
  const gxa = gx > 0 ? x0 + 8.5 : x0 - 3.2;
  return [
    { n, x: x0 + 4.25, z: z0 + 4, w: 8.5, d: 8, h: 7.6, deborde: 0.4 },
    { n: 'garage', x: gxa + 1.6, z: z0 + 3, w: 3.2, d: 6, h: 3.4, contre: true, sous: true },
  ];
};
module.exports = {
  nom: 'french-dream-a',
  titre: 'French Dream, lotissement des Mésanges (moitié nord recopiée au sud)',
  bornes: [-37, 37, -42, 42],
  miroir: 'z',
  zones: [
    ['Coulée verte (Alpha)', -36, 36, 28, 41], ['Coulée verte (Bravo)', -36, 36, -41, -28],
    ['Chantier', -36, -21, 4.5, 28], ['Chantier', -36, -21, -28, -4.5],
    ['Maison témoin', -3.6, 8.3, 9.8, 18.2], ['Maison témoin', -3.6, 8.3, -18.2, -9.8],
    ['Rue des Mésanges', -36, 14, -4.5, 4.5], ['Raquette', 14, 36, -13, 13],
  ],
  objets: [
    // ---- la rue et la raquette, sur l'axe ----
    { n: 'rue des Mésanges (chaussée de 6 m, trottoirs de 1,5 m)', poly: [[-36, -3], [15.5, -3], [15.5, 3], [-36, 3]], type: 'terrain', axe: true },
    { n: 'raquette', ellipse: [24, 0, 9.5, 9.5], type: 'terrain', axe: true },
    { n: 'îlot planté et son érable', x: 24, z: 0, r: 3, h: 0.3, axe: true },
    // le camion de déménagement au milieu de la rue, hayon ouvert vers l'est, cartons sur la rampe
    { n: 'camion de déménagement', x: 2, z: 0, w: 7.2, d: 2.5, h: 3.4, axe: true }, { rampe: [5.6, 7.8, -0.9, 0.9], n: 'hayon', axe: true },
    // deux voitures garées le long du trottoir, une de chaque côté, décalées (on ne les recopie pas en miroir)
    { n: 'voiture', pf: ['car', 'hatch'], x: -15.5, z: 2.0, rot: PI / 2, axe: true }, { n: 'voiture', pf: ['car', 'sedan'], x: 13, z: -2.0, rot: -PI / 2, axe: true },
    { n: 'ralentisseur', x: -24, z: 0, w: 1.2, d: 6, h: 0.1, axe: true },
    lampadaire(-24, 3.9), lampadaire(-6, 3.9), lampadaire(12, 3.9),

    // ---- lot 12, le Chantier (x -34 à -21) ----
    { n: 'dalle (20 cm)', poly: [[-32, 10], [-23, 10], [-23, 18], [-32, 18]], type: 'terrain' },
    mur(-32, 10, -29.2, 10, 2.4, { sous: true }), mur(-26.4, 10, -23, 10, 1.2, { sous: true }), // façade : la baie du séjour (2,8 m) pas encore posée, l'allège basse à l'est
    mur(-32, 10.1, -32, 17.9, 2.4, { sous: true }), // pignon ouest, monté jusqu'au plancher
    mur(-23, 10.1, -23, 13.2, 2.4, { sous: true }), mur(-23, 14.6, -23, 17.9, 1.0, { sous: true }), // pignon est : la porte du garage à venir (1,4 m), puis une allège
    mur(-32, 18, -28.4, 18, 1.2, { sous: true }), mur(-26.8, 18, -23, 18, 2.4, { sous: true }), // arrière : la porte-fenêtre (1,6 m)
    mur(-32, 14, -29.6, 14, 2.4, { sous: true }), // refend de la cuisine
    { n: "plancher de l'étage (2,7 m), muret de 1 m", poly: [[-32, 14], [-23, 14], [-23, 18], [-32, 18]], type: 'zone', contre: true },
    { rampe: [-29.4, -28.2, 10.4, 13.9], n: 'escalier brut' }, // monte vers le nord, débouche sur le plancher
    { n: 'bétonnière', x: -30.5, z: 6.5, r: 0.7, h: 1.4 }, { n: 'palette de parpaings', x: -26.2, z: 6.3, w: 1.2, d: 1.0, h: 1.0 }, { n: 'palette de parpaings', x: -24.6, z: 6.3, w: 1.2, d: 1.0, h: 1.0, contre: true },
    { n: 'tas de sable', x: -33.6, z: 22.5, r: 1.3, h: 0.8 }, { n: 'benne de chantier', x: -27.5, z: 23, w: 3.6, d: 1.8, h: 1.4 },
    { n: 'panneau « lot 12 disponible »', x: -21.8, z: 5.2, r: 0.1, h: 2.2 },
    { n: 'barrière de chantier', x: -33.5, z: 27.5, w: 4, d: 0.15, h: 2 }, { n: 'barrière de chantier', x: -23.3, z: 27.5, w: 3.8, d: 0.15, h: 2, contre: true },

    // ---- n° 10, pavillon fermé (x -19 à -7,3) ----
    ...pavillon('n° 10', -19, 10, 1),
    { n: 'voiture', pf: ['car', 'hatch'], x: -8.9, z: 6.6 }, // devant le garage
    haieBasse(-19, 4.9, -12.6, 4.9), boite(-11.8, 4.9), poubelle(-7, 5.0), poubelle(-6.2, 5.0),
    { n: 'piscine hors-sol', x: -14.2, z: 22.8, r: 2.2, h: 1.25 }, { n: 'abri de jardin', x: -17.8, z: 25.85, w: 2.2, d: 2.0, h: 2.3, contre: true },
    thuyas(-21, 20, -21, 27, { contre: true }), // entre le chantier et le n° 10 (l'allée reste ouverte jusqu'à z = 20)
    thuyas(-5.4, 18.6, -5.4, 21.2, { contre: true }), thuyas(-5.4, 22.6, -5.4, 27, { contre: true }), // entre le n° 10 et la maison témoin : le trou des gamins (1,4 m)

    // ---- n° 8, la Maison témoin (x -3,5 à 8,2) : garage ouvert à l'ouest, corps de deux niveaux ----
    { n: 'toit de la maison témoin', poly: [[-0.7, 9.6], [8.6, 9.6], [8.6, 18.4], [-0.7, 18.4]], type: 'zone', contre: true },
    mur(-3.5, 10, -3.5, 16, 3, { n: 'garage', sous: true }), mur(-3.4, 16, -2.6, 16, 3, { sous: true }), mur(-1.4, 16, -0.4, 16, 3, { sous: true }), // porte du fond (1,2 m)
    mur(-0.3, 10, 2.4, 10, 5.6, { sous: true }), mur(3.6, 10, 8.2, 10, 5.6, { sous: true }), // façade : porte d'entrée (1,2 m)
    mur(-0.3, 10.1, -0.3, 12.6, 5.6, { sous: true }), mur(-0.3, 13.8, -0.3, 17.9, 5.6, { sous: true }), // garage-cellier : porte (1,2 m)
    mur(8.2, 10.1, 8.2, 17.9, 5.6, { sous: true }),
    mur(-0.3, 18, 2.0, 18, 5.6, { sous: true }), mur(4.6, 18, 8.2, 18, 5.6, { sous: true }), // baie vitrée ouverte (2,6 m)
    mur(5.6, 11.6, 5.6, 15.6, 2.6, { n: 'cloison', sous: true }), { rampe: [6.1, 8.0, 10.6, 15.0], n: 'escalier', contre: true }, // l'escalier le long du pignon est
    { n: 'canapé', x: 2.2, z: 15.2, w: 2.0, d: 0.9, h: 0.85, sous: true }, { n: 'îlot de cuisine', x: 3.0, z: 12.4, w: 1.6, d: 0.8, h: 0.95, sous: true },
    { n: "l'étage (2,8 m) : deux chambres, celle de devant sur la rue", poly: [[-0.3, 10], [8.2, 10], [8.2, 18], [-0.3, 18]], type: 'zone', contre: true, sous: true },
    { n: 'voiture', pf: ['car', 'sedan'], x: -1.9, z: 6.4 }, haieBasse(4, 4.9, 8.2, 4.9), boite(3.2, 4.9),
    { n: 'drapeau « à vendre »', x: 9.0, z: 5.4, r: 0.1, h: 4 },
    { n: 'trampoline (filet)', x: 5.2, z: 23.2, r: 1.8, h: 2.6 }, { n: 'salon de jardin', x: 0.6, z: 20.4, r: 0.6, h: 0.75 }, { n: 'barbecue', x: -1.6, z: 19.2, r: 0.35, h: 1 },
    { n: 'séchoir parapluie', x: -1.5, z: 24.6, r: 0.1, h: 1.8 },
    thuyas(9.35, 18.6, 9.35, 27, { contre: true }), // entre la maison témoin et le n° 6

    // ---- n° 6, pavillon fermé contre la raquette (x 10,5 à 22,2) ----
    ...pavillon('n° 6', 10.5, 11, 1),
    poubelle(20.2, 9.6), poubelle(21.0, 9.6), boite(10.8, 10), { n: 'balançoire', x: 15, z: 23.6, w: 3, d: 1.6, h: 2.2 }, { n: 'cabanon', x: 21.5, z: 25.8, w: 2.2, d: 2.2, h: 2.3, contre: true },
    thuyas(23.0, 11.6, 23.0, 27, { contre: true }), // le fond du n° 6 sur la sente

    // ---- la sente piétonne et la raquette (x 23 à 36) ----
    { n: 'transformateur', x: 31.6, z: 18.5, w: 2.6, d: 2.0, h: 2.4 },
    { n: 'conteneurs de tri', x: 29.8, z: 11.6, w: 4.8, d: 1.5, h: 1.7 },
    { n: 'toboggan', x: 28, z: 23.5, w: 1, d: 3.2, h: 2.2 }, { n: 'banc', x: 34, z: 13.5, w: 0.6, d: 1.8, h: 0.8 },
    arbuste(26, 16), arbuste(34.5, 22), arbuste(26.4, 26.5),

    // ---- fond des jardins (thuyas, portillons) et coulée verte ----
    thuyas(-21, 27.3, -15.4, 27.3), thuyas(-14, 27.3, 1.0, 27.3), thuyas(2.4, 27.3, 23.4, 27.3), // portillons du n° 10 et de la maison témoin (1,4 m)
    { n: 'bassin de rétention (à sec, talus doux)', ellipse: [-24, 35.5, 7, 3], type: 'terrain' },
    lampadaire(-12, 30), lampadaire(6, 30), lampadaire(24, 30), { n: 'banc', x: -2, z: 38.5, w: 1.8, d: 0.6, h: 0.8 },
    { n: 'clôture rigide (fin de la carte)', x: 0, z: 41.2, w: 72, d: 0.2, h: 1.8 },
  ],
  apparitions: { alpha: [[-16.5, 31.5], [-12.5, 33.5], [-8.5, 31.5], [-4.5, 33.5], [-0.5, 31.5], [3.5, 33.5], [8.5, 31.5], [12.5, 33.5], [16.5, 31.5], [20.5, 33.5], [-14.5, 36.5], [-6.5, 36.5], [1.5, 36.5], [10.5, 36.5], [18.5, 36.5]] },
  domination: [[-12, 22, 'A'], [2, 0, 'B'], [-12, -22, 'C']], // A et C dans le jardin du n° 10, autour de la piscine (rapprochés des bases à la demande du propriétaire)
  routes: [
    { n: 'L', pts: [[-16, 32], [-26, 26], [-27.8, 16], [-27.6, 10], [-28, 4]] },
    { n: 'M', pts: [[1, 31], [1.7, 27.3], [3.3, 18], [3, 10], [3, 4]] },
    { n: 'E', pts: [[18, 32], [27, 26], [28, 15], [24, 9.5]] },
  ],
};
