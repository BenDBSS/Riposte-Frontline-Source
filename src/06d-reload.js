/* ==========================================================================
   MANIEMENT : RECHARGEMENTS, CULASSE, POMPE
   Chaque action d'arme est une chorégraphie en poses clés dont plusieurs sont volontairement
   exagérées (arme basculée vers le joueur, chargeur lancé au loin, claque d'insertion qui fait
   plonger l'arme, dépassement au retour) : c'est ce qui donne l'impression de poids et de vitesse
   des rechargements des jeux de tir modernes. Les temps sont en secondes.

   Une table décrit, pour une arme et un cas (normal, vide) :
     gun : décalage du support d'arme [t, x, y, z, tangage, lacet, roulis]
     lh  : main gauche [t, x, y, z, ancre, fb, pose, porte, repère]
           ancre : 0 espace de l'arme, 1 relatif à la prise du chargeur, 2 espace du corps (caméra),
                   3 relatif à la prise du garde-main
           repère : (facultatif) 1 main à plat contre le flanc gauche (culasse du pistolet)
           fb    : 0 repère du garde-main, 1 repère de prise du chargeur
           porte : 0 rien, 1 chargeur d'origine en main, 2 chargeur de rechange en main
     rh  : main droite (même format, facultatif) ; fbr : 0 prise normale, 1 prise de la culasse
     ev  : événements [t, nom] : son, chargeur lâché, chargeur inséré, etc. L'impact de chaque événement (choc de l'arme,
           secousse de la vue, à-coup du champ de vision) est un réglage de l'arme (VM_ANIM, 06cy-ressorts.js) : il s'ajoute
           à la chorégraphie sans la modifier, les mains restent calées sur l'arme.
     allure : (facultatif) [temps de la chorégraphie, vitesse relative], vitesse interpolée entre les clés. Les gestes francs vont
           plus vite que leurs clés (chargeur arraché, chargeur claqué, levier, glissière, culasse), les trajets entre deux
           ralentissent (la main qui va chercher le chargeur neuf), comme dans Modern Warfare (2019). La durée totale ne change pas
           (vmRythme ramène l'ensemble à dur). Une seule horloge déformée, à vitesse continue, pour l'arme, les deux mains, la
           culasse et les événements : rien ne se décale, la main ne lâche jamais le chargeur (l'essai de poses tenues de la 4.0.3,
           où l'arme figée puis lancée ne suivait plus les mains, a été retiré). Vitesses réglées sur le banc recharge.js : aucune
           main ni aucun chargeur au-delà de 4,2 m/s pour les armes de base ; le trajet de la main vers la ceinture, déjà rapide
           dans les clés, reste au ralenti.
   ========================================================================== */
const _kn = [];
/* interpolation de Catmull-Rom sur des lignes [t, v0, v1, ...] ; renvoie un tableau réutilisé */
function keyN(keys, t) {
  const n = keys.length, m = keys[0].length - 1; _kn.length = m;
  if (t <= keys[0][0]) { for (let j = 0; j < m; j++) _kn[j] = keys[0][j + 1]; return _kn; }
  if (t >= keys[n - 1][0]) { for (let j = 0; j < m; j++) _kn[j] = keys[n - 1][j + 1]; return _kn; }
  let i = 0; while (t > keys[i + 1][0]) i++;
  const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(n - 1, i + 2)];
  const u = (t - p1[0]) / (p2[0] - p1[0]), u2 = u * u, u3 = u2 * u;
  for (let j = 1; j <= m; j++) _kn[j - 1] = 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u3);
  return _kn;
}
/* dernière valeur discrète (pose, porte) dont la clé est passée */
function keyStep(keys, t, idx) { let v = keys[0][idx]; for (const k of keys) { if (k[0] <= t) v = k[idx]; else break; } return v; }

const HAND_POSE_IDS = ['support', 'mag', 'grip', 'open', 'slap', 'pinch', 'trigger', 'relaxed'];
const RELOAD = {};

/* ---------- Fusil d'assaut : chargeur, puis poignée d'armement si le chargeur était vide ---------- */
const RIFLE_BASE = {
  gun: [
    [0, 0, 0, 0, 0, 0, 0],
    [0.14, -0.1, 0.07, 0.02, 0.35, 0.18, -0.55],
    [0.3, -0.15, 0.105, 0.03, 0.55, 0.28, -0.75],
    [0.4, -0.14, 0.088, 0.03, 0.5, 0.25, -0.7],
    [0.55, -0.15, 0.105, 0.03, 0.55, 0.28, -0.75],
    [0.7, -0.153, 0.1, 0.028, 0.57, 0.3, -0.78],
    [0.86, -0.147, 0.097, 0.034, 0.52, 0.26, -0.71],
    [1.0, -0.15, 0.101, 0.03, 0.54, 0.28, -0.74],
    [1.12, -0.145, 0.098, 0.03, 0.53, 0.27, -0.72],
    [1.2, -0.145, 0.062, 0.04, 0.42, 0.27, -0.72],
    [1.29, -0.14, 0.095, 0.03, 0.52, 0.26, -0.72],
  ],
  lh: [
    [0, 0, 0, 0, 3, 0, 0, 0],
    [0.1, 0, 0.0, 0.03, 3, 0.5, 3, 0],
    [0.22, -0.03, 0.02, 0, 1, 1, 1, 0],
    [0.3, 0, 0, 0, 1, 1, 2, 1],
    [0.4, 0, -0.09, -0.012, 1, 1, 2, 1],
    [0.45, 0, -0.14, -0.02, 1, 1, 3, 0],
    // (plus de clé à 0,5 s : la main filait du chargeur lâché vers la ceinture à 6 m/s, puis freinait d'un coup)
    [0.63, -0.2, -0.38, -0.16, 2, 0.8, 3, 0],
    [0.74, -0.21, -0.4, -0.14, 2, 1, 2, 2],
    [0.86, -0.15, -0.2, -0.24, 2, 1, 2, 2],
    [1.0, -0.02, -0.14, -0.02, 1, 1, 2, 2],
    [1.14, 0, -0.04, 0, 1, 1, 2, 2],
    [1.2, 0, 0, 0, 1, 1, 2, 0],
    [1.28, 0, 0.012, 0, 1, 1, 4, 0],
    [1.36, 0, -0.02, 0, 1, 1, 4, 0],
    [1.52, 0, 0.02, 0.05, 3, 0.4, 3, 0],
  ],
  ev: [[0.02, 'leve'], [0.3, 'magout'], [0.44, 'drop'], [0.66, 'spare'], [1.2, 'insert']],
};
/* allure commune du fusil jusqu'au chargeur claqué (voir allure en tête) : départ vif, arrachage du chargeur deux fois et demie plus
   vite que les clés (0,34 à 0,44 s), trajet vers la ceinture et retour au ralenti, chargeur neuf enfoncé à toute vitesse (1,02 à 1,2 s) */
const RIFLE_ALLURE = [[0, 1.2], [0.06, 1.4], [0.2, 1.5], [0.27, 1.8], [0.31, 1.6], [0.35, 2.5], [0.44, 2.5], [0.48, 0.85], [0.62, 0.8], [0.66, 1.2], [0.74, 1.0],
  [0.78, 0.95], [0.98, 1.0], [1.03, 2.5], [1.18, 2.6], [1.22, 1.8]];
RELOAD.rifle = {
  norm: Object.assign({}, RIFLE_BASE, {
    dur: 2.1,
    gun: RIFLE_BASE.gun.concat([[1.6, -0.06, 0.035, 0.01, 0.2, 0.1, -0.3], [1.85, 0.006, -0.008, 0, -0.04, -0.01, 0.06], [2.1, 0, 0, 0, 0, 0, 0]]),
    lh: RIFLE_BASE.lh.concat([[1.82, 0, 0, 0, 3, 0, 0, 0], [2.1, 0, 0, 0, 3, 0, 0, 0]]),
    ev: RIFLE_BASE.ev.concat([[1.8, 'pret']]),
    // après le chargeur claqué : arme remise en joue d'un coup, puis posée
    allure: RIFLE_ALLURE.concat([[1.36, 2], [1.42, 1.8], [1.5, 1.6], [1.6, 1.8], [1.78, 1.6], [1.86, 0.9], [2.1, 0.6]]),
  }),
  // vide : après l'insertion, la main gauche reste au puits de chargeur et remonte d'un coup pour presser le levier d'arrêt de culasse,
  // puis revient au garde-main ; l'arme se redresse plus tôt. (Elle allait tirer la poignée d'armement par-dessus le boîtier : le poing
  // passait devant l'objectif, l'avant-bras masquait l'arme.)
  empty: Object.assign({}, RIFLE_BASE, {
    dur: 2.6,
    gun: RIFLE_BASE.gun.concat([[1.44, -0.135, 0.092, 0.03, 0.5, 0.27, -0.7], [1.53, -0.13, 0.086, 0.036, 0.47, 0.27, -0.68], [1.62, -0.13, 0.09, 0.03, 0.5, 0.26, -0.7],
      [1.98, -0.05, 0.03, 0.01, 0.18, 0.08, -0.25], [2.28, 0.006, -0.008, 0, -0.04, -0.01, 0.06], [2.6, 0, 0, 0, 0, 0, 0]]),
    lh: RIFLE_BASE.lh.filter((k) => k[0] < 1.45).concat([[1.46, 0, 0.035, 0.012, 1, 1, 2, 0], [1.53, -0.004, 0.05, 0.016, 1, 1, 4, 0], [1.6, 0, 0.03, 0.01, 1, 1, 3, 0],
      [1.84, 0, 0.02, 0.05, 3, 0.4, 3, 0], [2.1, 0, 0, 0, 3, 0, 0, 0], [2.6, 0, 0, 0, 3, 0, 0, 0]]),
    ev: RIFLE_BASE.ev.concat([[1.53, 'catch'], [2.24, 'pret']]),
    // même début, puis un temps, le levier frappé d'un coup, et l'arme remise en joue
    allure: RIFLE_ALLURE.concat([[1.36, 1.6], [1.46, 1.2], [1.5, 2.4], [1.56, 2.4], [1.62, 1.4], [1.9, 1.3], [2.0, 1.6], [2.24, 1.6], [2.32, 0.9], [2.6, 0.6]]),
  }),
};
RELOAD.smg = RELOAD.rifle;

/* ---------- Pistolet : arme ramenée vers le buste (à hauteur de poitrine, pas devant les yeux : l'avant-bras ne masque pas
   l'écran), puits de chargeur tourné vers la main gauche, chargeur de rechange pris à la ceinture ---------- */
const PISTOL_BASE = {
  gun: [
    [0, 0, 0, 0, 0, 0, 0],
    [0.14, -0.07, 0.045, 0.05, 0.3, 0.22, -0.55],
    [0.3, -0.09, 0.072, 0.07, 0.4, 0.24, -0.66],
    [0.62, -0.09, 0.072, 0.07, 0.4, 0.24, -0.66],
    [0.84, -0.09, 0.066, 0.07, 0.37, 0.22, -0.63],
    [0.9, -0.09, 0.042, 0.075, 0.29, 0.22, -0.63],
    [0.98, -0.088, 0.068, 0.07, 0.39, 0.23, -0.64],
  ],
  lh: [
    [0, 0, 0, 0, 3, 0, 2, 0],
    [0.1, -0.02, -0.03, 0.03, 3, 0, 3, 0],
    [0.24, -0.17, -0.3, -0.14, 2, 0.6, 3, 0],
    [0.36, -0.21, -0.43, -0.12, 2, 0.9, 1, 0],
    [0.42, -0.21, -0.44, -0.12, 2, 1, 2, 2],
    [0.6, -0.14, -0.26, -0.22, 2, 1, 2, 2],
    [0.78, 0, -0.058, 0.013, 1, 1, 2, 2],
    [0.9, 0, 0, 0, 1, 1, 2, 0],
    [0.95, 0, 0.008, 0, 1, 1, 4, 0],
  ],
  ev: [[0.02, 'leve'], [0.18, 'magout'], [0.22, 'drop'], [0.4, 'spare'], [0.9, 'insert']],
};
/* allure commune du pistolet jusqu'au chargeur claqué : chargeur lâché à la descente de la main, trajet vers la ceinture posé, chargeur neuf
   remonté puis enfoncé d'un coup */
const PISTOL_ALLURE = [[0, 2], [0.1, 1.8], [0.14, 1.4], [0.2, 1.4], [0.24, 1.8], [0.32, 1], [0.42, 0.8], [0.5, 1], [0.6, 1.4], [0.72, 2.4], [0.86, 2.4], [0.9, 1.5], [0.94, 2.2]];
RELOAD.pistol = {
  norm: Object.assign({}, PISTOL_BASE, {
    dur: 1.45,
    gun: PISTOL_BASE.gun.concat([[1.2, -0.04, 0.03, 0.03, 0.15, 0.1, -0.24], [1.35, 0.006, -0.008, 0, -0.05, 0, 0.05], [1.45, 0, 0, 0, 0, 0, 0]]),
    lh: PISTOL_BASE.lh.concat([[1.1, 0, 0.02, 0.03, 3, 0.2, 3, 0], [1.28, 0, 0, 0, 3, 0, 2, 0], [1.45, 0, 0, 0, 3, 0, 2, 0]]),
    ev: PISTOL_BASE.ev.concat([[1.32, 'pret']]),
    allure: PISTOL_ALLURE.concat([[1.1, 1.4], [1.2, 1.6], [1.35, 0.8], [1.45, 0.6]]),
  }),
  empty: Object.assign({}, PISTOL_BASE, {
    dur: 1.75,
    slideHoldUntil: 1.3,
    // vide : le pistolet revient près de la position de tir, la main gauche saisit l'arrière de la glissière par le côté et la lâche
    gun: PISTOL_BASE.gun.concat([[1.1, -0.045, 0.035, 0.03, 0.17, 0.1, -0.25], [1.3, -0.045, 0.031, 0.05, 0.15, 0.1, -0.22], [1.38, -0.045, 0.035, 0.03, 0.17, 0.1, -0.25], [1.56, 0.006, -0.008, 0, -0.05, 0, 0.05], [1.75, 0, 0, 0, 0, 0, 0]]),
    // la main gauche vient du dessous, pose la paume à plat sur le flanc gauche de la glissière (repère 1), la tire de 4 cm
    // puis s'écarte vers la gauche : jamais au-dessus de la glissière
    lh: PISTOL_BASE.lh.concat([[1.03, 0, 0.02, 0.03, 3, 0.2, 3, 0], [1.09, -0.045, 0.0, 0.06, 0, 0, 3, 0], [1.12, -0.045, 0.012, 0.06, 0, 0, 3, 0, 1],
      [1.18, -0.0165, 0.03, 0.034, 0, 1, 4, 0, 1], [1.27, -0.0165, 0.03, 0.075, 0, 1, 4, 0, 1], [1.33, -0.05, 0.02, 0.09, 0, 1, 3, 0, 1], [1.4, -0.05, 0.0, 0.07, 0, 0, 3, 0, 1],
      [1.5, 0, 0, 0, 3, 0, 2, 0, 0], [1.75, 0, 0, 0, 3, 0, 2, 0, 0]]),
    ev: PISTOL_BASE.ev.concat([[1.28, 'slide'], [1.53, 'pret']]),
    // la glissière est tirée et lâchée d'un coup sec
    allure: PISTOL_ALLURE.concat([[1.0, 1.0], [1.1, 1.0], [1.18, 1.6], [1.26, 1.8], [1.29, 1.5], [1.34, 1.6], [1.4, 1.4], [1.48, 1.6], [1.56, 1.8], [1.62, 0.9], [1.75, 0.6]]),
  }),
};

/* ---------- Fusil de précision : mêmes gestes que le fusil, plus lents et plus posés, culasse en fin de rechargement à vide ---------- */
function stretchTable(T, k, gunK) {
  const O = Object.assign({}, T);
  O.dur = T.dur * k;
  O.gun = T.gun.map((r) => { const o = r.slice(); o[0] *= k; for (let j = 1; j <= 6; j++) o[j] *= gunK; return o; });
  O.lh = T.lh.map((r) => { const o = r.slice(); o[0] *= k; return o; });
  if (T.rh) O.rh = T.rh.map((r) => { const o = r.slice(); o[0] *= k; return o; });
  if (T.bolt) O.bolt = T.bolt.map((r) => { const o = r.slice(); o[0] *= k; return o; });
  O.ev = T.ev.map((e) => [e[0] * k, e[1]]);
  if (T.allure) O.allure = T.allure.map((r) => [r[0] * k, r[1]]);
  O.rythme = undefined; // recalculé d'après l'allure étirée (vmRythme)
  return O;
}
/* Cycle de culasse : la poignée se lève, recule, éjecte, revient et se rabaisse ; la main droite quitte la poignée pistolet pour la manœuvrer.
   bolt : [t, angle de relevage, recul] ; rh : ancre 5 = boule de la poignée de culasse */
const BOLT_CYCLE = {
  bolt: [[0, 0, 0], [0.1, 0, 0], [0.24, 1.2, 0], [0.34, 1.2, 0.02], [0.44, 1.2, 0.092], [0.52, 1.2, 0.092], [0.6, 1.2, 0.0], [0.7, 1.2, 0], [0.8, 0, 0], [0.93, 0, 0]],
  rh: [
    [0, 0, -0.055, 0.075, 0, 0, 2, 0], [0.08, 0.05, 0.0, 0.11, 0, 0.5, 5, 0], [0.16, 0.0, 0.0, 0.0, 5, 1, 5, 0],
    [0.3, 0.0, 0.0, 0.0, 5, 1, 5, 0], [0.7, 0.0, 0.0, 0.0, 5, 1, 5, 0], [0.8, 0.02, 0.0, 0.03, 5, 0.8, 3, 0],
    [0.9, 0, -0.055, 0.075, 0, 0, 2, 0], [0.93, 0, -0.055, 0.075, 0, 0, 2, 0],
  ],
};
RELOAD.boltAction = {
  dur: 0.93, bolt: BOLT_CYCLE.bolt, rh: BOLT_CYCLE.rh,
  gun: [[0, 0, 0, 0, 0, 0, 0], [0.12, -0.03, 0.03, 0.03, 0.12, 0.06, -0.28], [0.3, -0.045, 0.045, 0.045, 0.16, 0.08, -0.38], [0.55, -0.045, 0.045, 0.045, 0.16, 0.08, -0.38], [0.72, -0.02, 0.02, 0.02, 0.08, 0.04, -0.18], [0.85, 0.0, -0.004, 0, -0.01, 0, 0.02], [0.93, 0, 0, 0, 0, 0, 0]],
  lh: [[0, 0, 0, 0, 3, 0, 0, 0], [0.93, 0, 0, 0, 3, 0, 0, 0]],
  ev: [[0.16, 'boltsnd'], [0.44, 'eject'], [0.6, 'boltfwd']],
  // poignée levée et culasse tirée d'un trait, un temps culasse ouverte, renvoyée sèchement, puis l'arme se repose
  allure: [[0, 1.4], [0.1, 1.6], [0.24, 1.6], [0.3, 1.8], [0.44, 1.8], [0.48, 0.8], [0.54, 1], [0.58, 2], [0.66, 1.6], [0.8, 1.4], [0.86, 0.6], [0.93, 0.5]],
};
const SNIPER_N = stretchTable(RELOAD.rifle.norm, 1.4286, 0.8);
const SNIPER_E = stretchTable(RELOAD.rifle.norm, 1.6, 0.8);
SNIPER_E.dur = 3.4;
// à vide : après l'insertion (≈ 2,0 s), on arme la culasse pendant que l'arme reste basculée
SNIPER_E.gun = SNIPER_E.gun.filter((r) => r[0] < 2.3).concat([[2.4, -0.12, 0.085, 0.024, 0.45, 0.22, -0.6], [2.75, -0.12, 0.085, 0.03, 0.44, 0.22, -0.62], [3.05, -0.04, 0.03, 0.01, 0.15, 0.08, -0.22], [3.25, 0.006, -0.008, 0, -0.04, -0.01, 0.06], [3.4, 0, 0, 0, 0, 0, 0]]);
SNIPER_E.lh = SNIPER_E.lh.filter((r) => r[0] < 2.3).concat([[2.4, 0, 0.02, 0.05, 3, 0.4, 3, 0], [2.7, 0, 0, 0, 3, 0, 0, 0], [3.4, 0, 0, 0, 3, 0, 0, 0]]);
SNIPER_E.bolt = [[0, 0, 0], [2.2, 0, 0], [2.36, 1.2, 0], [2.48, 1.2, 0.09], [2.6, 1.2, 0.0], [2.72, 1.2, 0], [2.84, 0, 0], [3.4, 0, 0]];
SNIPER_E.rh = [[0, 0, -0.055, 0.075, 0, 0, 2, 0], [2.15, 0, -0.055, 0.075, 0, 0, 2, 0], [2.26, 0.05, 0.0, 0.11, 0, 0.5, 5, 0], [2.36, 0.0, 0.0, 0.0, 5, 1, 5, 0], [2.72, 0.0, 0.0, 0.0, 5, 1, 5, 0], [2.86, 0.02, 0.0, 0.03, 5, 0.8, 3, 0], [3.0, 0, -0.055, 0.075, 0, 0, 2, 0], [3.4, 0, -0.055, 0.075, 0, 0, 2, 0]];
SNIPER_E.ev = SNIPER_E.ev.filter((e) => e[0] < 2.3).concat([[2.38, 'boltsnd'], [2.5, 'eject'], [2.62, 'boltfwd'], [3.22, 'pret']]);
SNIPER_E.allure = SNIPER_E.allure.filter((r) => r[0] < 2).concat([[2.1, 1.2], [2.2, 1.6], [2.5, 1.8], [2.56, 1.2], [2.62, 2], [2.72, 1.4], [2.86, 1.6], [3.05, 1.5], [3.22, 1], [3.4, 0.6]]);
RELOAD.sniper = { norm: SNIPER_N, empty: SNIPER_E };

/* ---------- Fusil à pompe : une navette ceinture, port de chargement, cartouche poussée, puis pompage ---------- */
const SHOTGUN_POSE = [-0.13, 0.1, 0.03, 0.5, 0.26, -0.7];
RELOAD.shotgun = {
  shellStart: {
    dur: 0.32,
    gun: [[0, 0, 0, 0, 0, 0, 0], [0.16, SHOTGUN_POSE[0] * 0.6, SHOTGUN_POSE[1] * 0.6, SHOTGUN_POSE[2], SHOTGUN_POSE[3] * 0.7, SHOTGUN_POSE[4] * 0.7, SHOTGUN_POSE[5] * 0.7], [0.32, ...SHOTGUN_POSE]],
    lh: [[0, 0, 0, 0, 3, 0, 0, 0], [0.1, 0, -0.02, 0.03, 3, 0.3, 3, 0], [0.32, 0.01, -0.05, -0.03, 0, 0.6, 1, 0]],
    ev: [[0.02, 'draw'], [0.02, 'leve']],
    allure: [[0, 1.6], [0.1, 1.8], [0.2, 1.3], [0.32, 0.6]],
  },
  shell: {
    dur: 0.46,
    gun: [[0, ...SHOTGUN_POSE], [0.16, SHOTGUN_POSE[0], SHOTGUN_POSE[1] + 0.006, SHOTGUN_POSE[2], SHOTGUN_POSE[3] + 0.02, SHOTGUN_POSE[4], SHOTGUN_POSE[5]], [0.36, SHOTGUN_POSE[0], SHOTGUN_POSE[1] + 0.004, SHOTGUN_POSE[2], SHOTGUN_POSE[3] + 0.02, SHOTGUN_POSE[4], SHOTGUN_POSE[5]], [0.4, SHOTGUN_POSE[0], SHOTGUN_POSE[1] - 0.022, SHOTGUN_POSE[2] + 0.006, SHOTGUN_POSE[3] - 0.07, SHOTGUN_POSE[4], SHOTGUN_POSE[5]], [0.46, ...SHOTGUN_POSE]],
    lh: [
      [0, 0.01, -0.05, -0.03, 0, 0.6, 1, 0], [0.07, -0.05, -0.085, -0.04, 0, 0.7, 3, 0],
      // de la ceinture au port par en dessous, à vitesse égale (la clé intermédiaire, tout près du port, faisait filer la main à près
      // de 4 m/s puis freiner net)
      [0.18, -0.17, -0.22, -0.2, 2, 0.8, 3, 0], [0.21, -0.19, -0.27, -0.18, 2, 1, 5, 2],
      [0.31, -0.03, -0.17, 0.06, 0, 1, 5, 2], [0.39, 0.01, -0.052, -0.03, 0, 1, 5, 2], [0.42, 0.01, -0.05, -0.03, 0, 0.6, 1, 0],
    ],
    ev: [[0.2, 'spare'], [0.39, 'shellin']],
    // cartouche cueillie à la ceinture, puis enfoncée d'un coup de pouce
    allure: [[0, 1.8], [0.07, 1.6], [0.1, 1.1], [0.2, 1.1], [0.22, 1.4], [0.26, 1.2], [0.33, 1.3], [0.36, 1.9], [0.4, 1.9], [0.42, 0.7], [0.46, 0.5]],
  },
  shellEnd: {
    dur: 0.3,
    gun: [[0, ...SHOTGUN_POSE], [0.12, SHOTGUN_POSE[0] * 0.4, SHOTGUN_POSE[1] * 0.4, SHOTGUN_POSE[2] * 0.5, SHOTGUN_POSE[3] * 0.4, SHOTGUN_POSE[4] * 0.4, SHOTGUN_POSE[5] * 0.4], [0.2, -0.01, 0.006, 0.02, 0.02, 0.01, -0.06], [0.3, 0, 0, 0, 0, 0, 0]],
    lh: [[0, 0.01, -0.05, -0.03, 0, 0.6, 1, 0], [0.1, 0, 0, 0.0, 3, 0.1, 3, 0], [0.16, 0, 0, 0.06, 3, 0, 0, 0], [0.24, 0, 0, -0.012, 3, 0, 0, 0], [0.3, 0, 0, 0, 3, 0, 0, 0]],
    ev: [[0.16, 'pumpsnd']],
    allure: [[0, 0.95], [0.12, 1], [0.15, 1.6], [0.2, 1.5], [0.24, 1], [0.3, 0.7]],
  },
  // pas de pompage si le canon n'était pas vide : la main revient simplement au garde-main
  shellEndQuick: {
    dur: 0.3,
    gun: [[0, ...SHOTGUN_POSE], [0.14, SHOTGUN_POSE[0] * 0.35, SHOTGUN_POSE[1] * 0.35, SHOTGUN_POSE[2] * 0.5, SHOTGUN_POSE[3] * 0.35, SHOTGUN_POSE[4] * 0.35, SHOTGUN_POSE[5] * 0.35], [0.24, -0.008, 0.004, 0.01, 0.015, 0.01, -0.05], [0.3, 0, 0, 0, 0, 0, 0]],
    lh: [[0, 0.01, -0.05, -0.03, 0, 0.6, 1, 0], [0.14, 0, 0, 0.0, 3, 0.1, 3, 0], [0.3, 0, 0, 0, 3, 0, 0, 0]],
    ev: [],
  },
};

/* ---------- Inspection de l'arme (touche I) : l'arme pivote pour montrer son flanc gauche, puis le droit ----------
   Les deux mains restent posées (main gauche ancrée au garde-main) ; léger mouvement de respiration pendant les tenues. */
const INSPECT_LONG = {
  dur: 3.3,
  gun: [[0, 0, 0, 0, 0, 0, 0], [0.4, -0.085, 0.045, 0.05, 0.22, 0.62, 0.72], [0.55, -0.09, 0.048, 0.052, 0.24, 0.66, 0.78], [1.25, -0.088, 0.05, 0.055, 0.2, 0.6, 0.74],
    [1.75, -0.015, 0.055, 0.035, 0.14, -0.22, -0.55], [1.9, -0.016, 0.054, 0.036, 0.15, -0.25, -0.6], [2.55, -0.014, 0.056, 0.037, 0.12, -0.2, -0.52], [3.0, 0.006, -0.006, 0, -0.03, 0.01, 0.04], [3.3, 0, 0, 0, 0, 0, 0]],
  lh: [[0, 0, 0, 0, 3, 0, 0, 0], [3.3, 0, 0, 0, 3, 0, 0, 0]],
  ev: [[0.02, 'draw'], [1.65, 'draw']],
};
const INSPECT_PISTOL = {
  dur: 2.8,
  gun: [[0, 0, 0, 0, 0, 0, 0], [0.35, -0.06, 0.05, 0.08, 0.18, 0.7, 0.9], [1.1, -0.058, 0.052, 0.082, 0.16, 0.66, 0.86], [1.5, -0.03, 0.06, 0.06, 0.1, -0.5, -0.8],
    [2.15, -0.028, 0.058, 0.06, 0.12, -0.46, -0.76], [2.55, 0.004, -0.004, 0, -0.03, 0, 0.03], [2.8, 0, 0, 0, 0, 0, 0]],
  lh: [[0, 0, 0, 0, 3, 0, 2, 0], [0.3, -0.04, -0.05, 0.05, 3, 0, 3, 0], [2.4, -0.04, -0.05, 0.05, 3, 0, 3, 0], [2.8, 0, 0, 0, 3, 0, 2, 0]],
  ev: [[0.02, 'draw'], [1.4, 'draw']],
};

/* ---------- Rechargement vu de l'extérieur (soldats, 06b-soldier.js) ----------
   Même rythme que la vue subjective, en part de la durée : [part écoulée, part du geste]. Arme basculée et chargeur arraché dans le
   premier dixième, trajet vers le porte-chargeurs étiré, chargeur claqué d'un coup, retour posé. */
const RYTHME_3P = [[0, 0], [0.12, 0.3], [0.5, 0.58], [0.58, 0.72], [1, 1]];
function rythme3p(u) { return keyM(RYTHME_3P, clamp(u, 0, 1))[0]; }

/* ---------- Réglages d'ensemble pour une arme donnée ---------- */
const _rl = { gun: [0, 0, 0, 0, 0, 0] };
const _lhG = new V3(), _tmpK = [];

/* Interpolation monotone (PCHIP) : passe par toutes les clés sans dépasser, pour les trajets de main */
const _kp = [];
function pchipSlope(t0, v0, t1, v1, t2, v2) {
  // pente en (t1, v1) d'après ses voisins ; 0 si extremum local (pas de dépassement)
  const d0 = (v1 - v0) / (t1 - t0), d1 = (v2 - v1) / (t2 - t1);
  if (d0 * d1 <= 0) return 0;
  const w1 = 2 * (t2 - t1) + (t1 - t0), w2 = (t2 - t1) + 2 * (t1 - t0);
  return (w1 + w2) / (w1 / d0 + w2 / d1);
}
function keyM(keys, t) {
  const n = keys.length, m = keys[0].length - 1; _kp.length = m;
  if (t <= keys[0][0]) { for (let j = 0; j < m; j++) _kp[j] = keys[0][j + 1]; return _kp; }
  if (t >= keys[n - 1][0]) { for (let j = 0; j < m; j++) _kp[j] = keys[n - 1][j + 1]; return _kp; }
  let i = 0; while (t > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1], h = b[0] - a[0], u = (t - a[0]) / h, u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const pa = keys[i - 1], nb = keys[i + 2];
  for (let j = 1; j <= m; j++) {
    const d = (b[j] - a[j]) / h;
    const m0 = pa ? pchipSlope(pa[0], pa[j], a[0], a[j], b[0], b[j]) : d;
    const m1 = nb ? pchipSlope(a[0], a[j], b[0], b[j], nb[0], nb[j]) : d;
    _kp[j - 1] = h00 * a[j] + h10 * h * m0 + h01 * b[j] + h11 * h * m1;
  }
  return _kp;
}

/* ---------- Application d'une chorégraphie à l'image courante ---------- */
const _rlHand = new V3(), _mqInv = new THREE.Quaternion(), _mvTmp = new V3(), _mg = new V3();
function vmSetMag(m, tbl) {
  // repère de prise du chargeur dans l'espace de l'arme : origine du chargeur + prise
  _mg.copy(m.magHome).add(m.magGrip || _mvTmp.set(0, -0.07, 0));
  return _mg;
}
/* Rythme d'une chorégraphie (calculé une fois) : [temps écoulé, temps de la chorégraphie] tous les 1/50 s de chorégraphie, d'après son
   allure, ramené à sa durée */
function vmRythme(T) {
  if (T.rythme !== undefined) return T.rythme;
  const A = T.allure; if (!A) return (T.rythme = null);
  const N = Math.ceil(T.dur * 50), R = [[0, 0]], f = (t) => keyLin(A, t);
  let s = 0;
  for (let i = 1; i <= N; i++) { const t0 = ((i - 1) * T.dur) / N, t1 = (i * T.dur) / N; s += ((t1 - t0) * 2) / (f(t0) + f(t1)); R.push([s, t1]); }
  for (const r of R) r[0] *= T.dur / s;
  return (T.rythme = R);
}
/* interpolation linéaire d'une table [t, v] */
function keyLin(K, t) {
  if (t <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (t <= K[i][0]) { const a = K[i - 1], b = K[i]; return a[1] + ((b[1] - a[1]) * (t - a[0])) / (b[0] - a[0]); }
  return K[K.length - 1][1];
}
/* Appelée par updateViewmodel : renvoie le décalage d'arme [x, y, z, tangage, lacet, roulis] ou null */
function vmChoreo(name, tFrac, D, def, m) {
  let T = null;
  if (name === 'reload') { const R = RELOAD[def.rig || def.fam]; T = R && (D.empty ? R.empty : R.norm); }
  else if (name === 'bolt' && RELOAD.boltAction) T = RELOAD.boltAction;
  else if (name === 'inspect') T = def.fam === 'pistol' ? INSPECT_PISTOL : INSPECT_LONG;
  else if (RELOAD.shotgun && (name === 'shellStart' || name === 'shell' || name === 'shellEnd')) T = RELOAD.shotgun[name === 'shellEnd' && !D.empty ? 'shellEndQuick' : name];
  if (!T) return null;
  const R = vmRythme(T), ts = R ? keyM(R, tFrac * T.dur)[0] : tFrac * T.dur; // horloge de la chorégraphie, déformée par son allure
  VM.rlT = T; VM.rlS = ts; VM.rlD = D;
  const g = keyN(T.gun, ts);
  _rl.gun[0] = g[0]; _rl.gun[1] = g[1]; _rl.gun[2] = g[2]; _rl.gun[3] = g[3]; _rl.gun[4] = g[4]; _rl.gun[5] = g[5];
  VM.slideHold = !!(T.slideHoldUntil && ts < T.slideHoldUntil);
  // culasse : la poignée se lève et recule ; sa boule sert d'ancre à la main droite
  if (T.bolt && m.bolt) { const b = keyN(T.bolt, ts); m.bolt.rotation.z = b[0]; m.bolt.position.z = 0.07 + b[1]; VM.boltRot = b[0]; VM.boltPull = b[1]; } else { VM.boltRot = 0; VM.boltPull = 0; }
  for (let i = 0; i < T.ev.length; i++) {
    const e = T.ev[i], key = 'e' + i;
    if (!D[key] && ts >= e[0]) { D[key] = 1; vmFire(e[1], m, D, def); }
  }
  return _rl.gun;
}
/* Événements d'animation : effet propre (son, chargeur, douille), puis impact réglé par arme (VM_ANIM) : choc de l'arme,
   secousse de la vue, à-coup du champ de vision */
function vmFire(ev, m, D, def) {
  const C = vmaCfg(def).recharge, I = C.ev[ev];
  if (ev === 'magout') { sfxMech('magout'); D.old = 1; }
  else if (ev === 'drop') D.dropAt = 1; // lâché en fin d'image, depuis la main (vmAttachMags)
  else if (ev === 'spare') { D.spare = 1; }
  else if (ev === 'insert') { D.spare = 0; D.old = 0; sfxMech('magin'); sfxMech('slap', 0.05); }
  else if (ev === 'slide') { VM.slideK = 1; sfxMech('charge'); }
  else if (ev === 'catch') sfxMech('charge');
  else if (ev === 'boltsnd') sfxMech('bolt');
  else if (ev === 'eject') vmShell(def);
  else if (ev === 'boltfwd') sfxMech('charge');
  else if (ev === 'shellin') { D.spare = 0; sfxMech('shell'); }
  else if (ev === 'draw') sfxMech('draw');
  else if (ev === 'pumpsnd') sfxMech('pump');
  if (!I) return;
  vmChoc(I.vm, C);
  vmCamKick(I.cam, I.fov, C.cam * (1 - 0.5 * VM.ads));
}
/* Résolution de la main gauche : appelée par placeHands une fois la pose du support fixée */
function vmLeftHand(m, toGun) {
  const T = VM.rlT; if (!T || !T.lh) return null;
  const keys = T.lh, n = keys.length, ts = VM.rlS;
  const mg = vmSetMag(m);
  while (_tmpK.length < n) _tmpK.push([0, 0, 0, 0, 0]);
  _tmpK.length = n;
  for (let i = 0; i < n; i++) {
    const k = keys[i], row = _tmpK[i];
    _lhG.set(k[1], k[2], k[3]);
    if (k[4] === 1) _lhG.add(mg);
    else if (k[4] === 2) toGun(_lhG);
    else if (k[4] === 3) _lhG.add(m.gripL);
    row[0] = k[0]; row[1] = _lhG.x; row[2] = _lhG.y; row[3] = _lhG.z; row[4] = k[5];
  }
  const v = keyM(_tmpK, ts);
  // 9e colonne facultative : repère de la main à blender (0 prise du chargeur, 1 prise de la culasse du pistolet par le flanc)
  let frame = 0; for (const k of keys) { if (k[0] <= ts) frame = k[8] || 0; else break; }
  return { G: _rlHand.set(v[0], v[1], v[2]), fb: clamp(v[3], 0, 1), pose: HAND_POSE_IDS[keyStep(keys, ts, 6)], carry: keyStep(keys, ts, 7), frame };
}

const _bk = new V3();
/* boule de la poignée de culasse dans l'espace de l'arme, selon l'angle et le recul courants */
function vmBoltKnob(out) {
  const c = Math.cos(VM.boltRot || 0), s = Math.sin(VM.boltRot || 0), kx = 0.058, ky = -0.012;
  return out.set(0.02 + kx * c - ky * s, 0.045 + kx * s + ky * c, 0.07 + (VM.boltPull || 0));
}
function vmRightHand(m) {
  const T = VM.rlT; if (!T || !T.rh) return null;
  const keys = T.rh, n = keys.length, ts = VM.rlS;
  while (_tmpR.length < n) _tmpR.push([0, 0, 0, 0, 0]);
  _tmpR.length = n; vmBoltKnob(_bk);
  for (let i = 0; i < n; i++) {
    const k = keys[i], row = _tmpR[i];
    _lhG.set(k[1], k[2], k[3]);
    if (k[4] === 5) _lhG.add(_bk);
    row[0] = k[0]; row[1] = _lhG.x; row[2] = _lhG.y; row[3] = _lhG.z; row[4] = k[5];
  }
  const v = keyM(_tmpR, ts);
  return { G: _rhV.set(v[0], v[1], v[2]), fb: clamp(v[3], 0, 1), pose: HAND_POSE_IDS[keyStep(keys, ts, 6)] };
}
const _tmpR = [], _rhV = new V3();

/* ---------- Chargeurs : celui d'origine, celui de rechange, ceux qui tombent ---------- */
/* Chargeur lâché : il part de là où il est (dans la main, vmAttachMags) avec l'élan de la main (vel, espace du monde) */
function vmDropMag(m, vel) {
  if (!m.buildMag) return;
  VM.drops = VM.drops || [];
  let d = VM.drops.find((x) => x.t <= 0 && x.owner === m);
  if (!d) {
    if (VM.drops.length > 6) return;
    const g = new THREE.Group(); m.buildMag(g); g.visible = false; vmScene.add(g);
    d = { g, owner: m, t: 0, v: new V3(), w: new V3() }; VM.drops.push(d);
  }
  m.mag.updateWorldMatrix(true, false);
  m.mag.matrixWorld.decompose(d.g.position, d.g.quaternion, d.g.scale);
  const q = VM.holder.getWorldQuaternion(new THREE.Quaternion());
  d.v.set(rand(-0.25, 0.1), -0.25, rand(-0.1, 0.2)).applyQuaternion(q); d.w.set(rand(-6, 6), rand(-4, 4), rand(-9, 9)); d.t = 0.9; d.g.visible = true;
  if (vel) d.v.addScaledVector(vel, 0.8);
}
function vmUpdateDrops(dt) {
  if (!VM.drops) return;
  for (const d of VM.drops) {
    if (d.t <= 0) continue;
    d.t -= dt; d.v.y -= 9.8 * dt; d.g.position.addScaledVector(d.v, dt);
    d.g.rotation.x += d.w.x * dt; d.g.rotation.y += d.w.y * dt; d.g.rotation.z += d.w.z * dt;
    if (d.t <= 0) d.g.visible = false;
  }
}
/* Place un chargeur dans la main gauche : mêmes gestes que la prise d'un chargeur en place */
function vmMagInHand(mag, m, hand) {
  const F = HAND_FRAMES.Lp, gm = m.magGrip || _mvTmp.set(0, -0.07, 0);
  _mqInv.copy(F.q).invert();
  _mvTmp.copy(gm).applyQuaternion(_mqInv);
  mag.position.copy(F.off).sub(_mvTmp).applyQuaternion(hand.quaternion).add(hand.position);
  mag.quaternion.copy(hand.quaternion).multiply(_mqInv);
}
/* Appelée en fin de placeHands : dispose les chargeurs selon l'état de la chorégraphie */
const _lhW = new V3(), _lhV = new V3();
function vmAttachMags(m, carry) {
  const D = VM.rlD, hand = VM.arms.L.hand;
  // élan de la main gauche (monde), pour le chargeur qu'elle lâche
  hand.updateWorldMatrix(true, false); _lhV.setFromMatrixPosition(hand.matrixWorld);
  const dt = VM.handDt || 0, hv = VM.lhOk && dt > 0 ? _lhW.subVectors(_lhV, _lhW).divideScalar(dt) : null;
  if (hv && hv.length() > 3) hv.setLength(3);
  // chargeur lâché : il quitte la main là où elle le tient à cette image (il partait de son puits, 12 cm plus loin, et semblait tomber de la main)
  if (D && D.dropAt) { const inH = D.old === 1 && carry === 1; D.dropAt = 0; if (inH) vmMagInHand(m.mag, m, hand); vmDropMag(m, inH ? hv : null); D.old = 2; }
  _lhW.copy(_lhV); VM.lhOk = true;
  if (!m.spare && m.buildMag) { m.spare = new THREE.Group(); m.buildMag(m.spare); bakeRig(m.spare); m.spare.visible = false; (m.group || VM.holder).add(m.spare); }
  if (m.spare) m.spare.visible = !!(D && D.spare && carry === 2);
  if (m.spare && m.spare.visible) vmMagInHand(m.spare, m, hand);
  if (D && D.old === 1 && carry === 1) { m.mag.visible = true; vmMagInHand(m.mag, m, hand); }
  else if (D && D.old === 2) m.mag.visible = false;
  else { m.mag.position.copy(m.magHome); m.mag.quaternion.identity(); m.mag.visible = !m.tubeFed; }
}
/* Chorégraphie coupée (changement d'arme, couteau, grenade) : la main qui manipulait (chargeur, culasse) revient à sa prise
   en quelques images au lieu d'y sauter. X : état de la main, h : sa cible de chorégraphie de l'image (null si aucune),
   grip : sa prise sur l'arme, rest : pose de la main sur sa prise. Renvoie la cible à suivre, ou null. */
function vmHandExit(X, h, grip, rest) {
  if (h) { X.G.copy(h.G); X.fb = h.fb; X.pose = h.pose; X.frame = h.frame || 0; X.t = 0; X.on = true; return h; }
  if (!X.on) return null;
  X.t += VM.handDt || 0;
  const dur = VM.curDef ? vmaCfg(VM.curDef).annul.mains : 0.12;
  if (X.t >= dur || (X.G.distanceToSquared(grip) < 1e-8 && X.fb < 1e-3)) { X.on = false; return null; }
  const u = X.t / dur, e = 1 - (1 - u) * (1 - u) * (1 - u); // départ vif, arrivée posée
  return { G: X.out.lerpVectors(X.G, grip, e), fb: X.fb * (1 - e), pose: e < 0.5 ? X.pose : rest, carry: 0, frame: X.frame };
}
const VM_HX = { L: { G: new V3(), out: new V3(), fb: 0, pose: 'support', frame: 0, t: 0, on: false }, R: { G: new V3(), out: new V3(), fb: 0, pose: 'trigger', frame: 0, t: 0, on: false } };
/* Remise à zéro de l'état des chargeurs (changement d'arme, fin d'action) */
function vmResetHandling(m) {
  VM.rlT = null; VM.rlD = null; VM.slideHold = false; VM.camK.fill(0); VM.chocO.fill(0); VM.chocV.fill(0); VM_HX.L.on = VM_HX.R.on = false;
  if (m) { m.mag.position.copy(m.magHome); m.mag.quaternion.identity(); m.mag.visible = !m.tubeFed; if (m.spare) m.spare.visible = false; }
}
