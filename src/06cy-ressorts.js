/* ==========================================================================
   VUE SUBJECTIVE : IMPACT DU MANIEMENT ET RÉGLAGES PAR ARME
   Les chorégraphies (rechargements, culasse, pompe : 06d-reload.js) gardent leurs trajets lissés, l'arme et les mains
   calées l'une sur l'autre. L'impact vient d'une couche à part, déclenchée au moment exact de chaque événement de la
   chorégraphie (chargeur arraché, chargeur claqué, culasse qui part, arme remise en place) :
     - un choc sur l'arme : un ressort amorti sur ses six axes (position et rotation du support d'arme), lancé d'un coup,
       qui dépasse puis revient. Les mains, posées sur l'arme, suivent le choc sans se décaler ;
     - une secousse de la vue (ressorts de la caméra, applyCamera dans 08-player.js) ;
     - un à-coup du champ de vision (négatif : la vue se resserre un instant).
   Les ampleurs se règlent en centimètres et en degrés : ce sont les écarts maximaux atteints, quel que soit le ressort.
   ========================================================================== */

/* Réglages par arme. base : valeurs communes ; fam : par famille (celle de la chorégraphie : rig, sinon fam) ;
   arme : par arme (identifiant de WEAPONS). Une arme reprend sa famille, qui reprend base ; seules les clés données
   changent.
   recharge
     ressort : [fréquence (Hz), amortissement] du choc de l'arme (fréquence plus basse : arme plus lourde, choc plus lent ;
               amortissement 0 : oscille sans fin, 1 : aucun rebond)
     choc    : force des chocs de l'arme (1 : les ampleurs ci-dessous)
     cam     : force des secousses de la vue et des à-coups du champ de vision
     ev      : par événement de la chorégraphie
               vm  : choc de l'arme [droite (cm), hauteur (cm), vers le joueur (cm), canon vers le haut (°),
                     canon vers la gauche (°), roulis (°, positif : le dessus de l'arme part à gauche)]
               cam : secousse de la vue [vers le haut (°), vers la gauche (°), roulis (°)]
               fov : à-coup du champ de vision (degrés ; négatif : la vue se resserre)
   annul (une chorégraphie coupée ou remplacée par une autre)
     ressort : [fréquence (Hz), amortissement] du retour de l'arme vers sa nouvelle pose
     inertie : part de la vitesse de l'arme qu'elle garde au moment de la coupure (0 : repart à l'arrêt)
     mains   : durée (s) du retour de la main qui manipulait (chargeur, culasse) vers sa prise */
const VM_ANIM = {
  base: {
    recharge: {
      // 5.1, plus franc (retour du propriétaire : « animations très franches et impactantes, comme les Call of Duty récents ») : ressort plus
      // raide et moins amorti (7 Hz et 0,42 avant), chocs et secousses 35 % plus forts
      ressort: [8.5, 0.36], choc: 1.35, cam: 1.35,
      ev: {
        leve: { cam: [-0.5, 0.15, 0.9] }, // l'arme bascule : le buste suit
        magout: { vm: [0, -1.4, 0.35, -2.4, 0.45, 3.3], cam: [-0.8, 0.1, 0.8], fov: -0.4 }, // chargeur arraché : l'arme suit la main vers le bas (choc réduit à la 5.1, avec les chocs plus forts : le chargeur reste sous 4,2 m/s, recharge.js)
        insert: { vm: [0, -3, 1.2, 5.5, 0, -3.5], cam: [-2.2, 0.3, -1.1], fov: -2 }, // chargeur claqué
        catch: { vm: [0, 0.7, 2.3, 4.5, 0, -2.6], cam: [1.7, -0.25, 0.8], fov: -1.4 }, // levier d'arrêt : la culasse part
        slide: { vm: [0, 0.6, 2.3, 5, 0, 2], cam: [1.4, 0, 0.6], fov: -1.3 }, // glissière lâchée
        boltsnd: { vm: [0, 0.3, 0.6, 1.5, 0, -1.2], cam: [0.3, 0, 0.3] }, // poignée de culasse levée
        boltfwd: { vm: [0, 0, 1.6, 2.6, 0, 0], cam: [0.5, 0, 0.15], fov: -0.5 }, // culasse refermée (fusil à verrou)
        shellin: { vm: [0, -1.9, 0.8, 3.3, 0, 0], cam: [-0.8, 0, -0.3], fov: -0.6 }, // cartouche poussée dans le tube
        pumpsnd: { vm: [0, 0, 2.3, 3.5, 0, 0], cam: [1, 0, 0.4], fov: -1 }, // pompe
        pret: { vm: [0, -0.8, 1, -2, 0, 1.3], cam: [0.5, 0, -0.4] }, // arme remise en place, prête à tirer
        sortie: { vm: [0, -1, 1.4, 3.5, 0, -1.8], cam: [-0.9, 0.2, -0.9], fov: -1.2 }, // arme sortie (changement d'arme) : elle arrive en place et s'y plante
        visee: { vm: [0, -0.35, 0.7, 1.1, 0, 0], cam: [-0.3, 0, 0.1], fov: -0.5 }, // mise en joue : la crosse se cale dans l'épaule
        rangee: { cam: [0.3, -0.1, 0.5] }, // arme rangée (changement d'arme) : le buste accompagne le geste
      },
    },
    annul: { ressort: [5, 0.8], inertie: 0.4, mains: 0.12 },
  },
  fam: {
    pistol: { recharge: { ressort: [10, 0.36] } },
    sniper: { recharge: { ressort: [6.5, 0.4], choc: 1.45, cam: 1.45 } },
    shotgun: { recharge: { ressort: [7.5, 0.36], choc: 1.45 } },
  },
  arme: {
    ak47: { recharge: { choc: 1.15, cam: 1.15 } },
    scarh: { recharge: { choc: 1.15, cam: 1.15 } },
    aa12: { recharge: { ressort: [6, 0.45], choc: 1.25, cam: 1.25 } },
    svd: { recharge: { ressort: [6, 0.45], choc: 1.1 } },
    m82: { recharge: { ressort: [5, 0.48], choc: 1.3, cam: 1.5 } },
    deagle: { recharge: { choc: 1.2, cam: 1.4 } },
    mp7: { recharge: { choc: 0.85 } },
    vector: { recharge: { choc: 0.85 } },
  },
};
const _vmaC = {};
function vmaMerge(a, b) {
  const o = Object.assign({}, a);
  for (const k in b) { const v = b[k]; o[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? vmaMerge(a[k], v) : v; }
  return o;
}
/* réglages d'une arme (def de WEAPONS ou dérivée avec accessoires) */
function vmaCfg(def) {
  const fam = def.rig || def.fam, key = fam + ':' + def.id;
  return _vmaC[key] || (_vmaC[key] = vmaMerge(vmaMerge(VM_ANIM.base, VM_ANIM.fam[fam] || {}), VM_ANIM.arme[def.id] || {}));
}

/* Écart maximal atteint par un ressort amorti (pulsation w, amortissement z) lancé à vitesse 1 depuis le repos : pour
   obtenir un écart A, on le lance à la vitesse A / vmaPeak(w, z) */
function vmaPeak(w, z) {
  z = clamp(z, 0.05, 0.98);
  const wd = w * Math.sqrt(1 - z * z), zw = z * w, t = Math.atan2(wd, zw) / wd;
  return (Math.exp(-zw * t) * Math.sin(wd * t)) / wd;
}
/* Ressort amorti sur un tableau de valeurs (o : écarts, v : vitesses) ; R : [fréquence (Hz), amortissement]. Pas de
   1/120 s au plus : stable même à 30 images par seconde sur téléphone. */
function vmaSpring(o, v, R, dt) {
  const w = TAU * R[0], k = w * w, c = 2 * R[1] * w, n = Math.max(1, Math.ceil(dt * 120)), h = dt / n;
  for (let s = 0; s < n; s++) for (let j = 0; j < o.length; j++) { v[j] += (-k * o[j] - c * v[j]) * h; o[j] += v[j] * h; }
}

/* Choc de l'arme : vm en cm et degrés (voir VM_ANIM), C : réglages recharge de l'arme ; repris par updateViewmodel */
const _vmaU = [0.01, 0.01, 0.01, Math.PI / 180, Math.PI / 180, Math.PI / 180];
function vmChoc(vm, C) {
  if (!vm) return;
  const k = C.choc / vmaPeak(TAU * C.ressort[0], C.ressort[1]);
  for (let j = 0; j < 6; j++) VM.chocV[j] += vm[j] * _vmaU[j] * k;
}
/* Secousse de la vue (degrés) et à-coup du champ de vision, repris par applyCamera (08-player.js). Les ressorts de la vue
   y sont fixes : tangage et lacet raideur 180, amortissement 16 ; roulis 150 et 15. */
const VMA_CAM = [vmaPeak(Math.sqrt(180), 8 / Math.sqrt(180)), vmaPeak(Math.sqrt(180), 8 / Math.sqrt(180)), vmaPeak(Math.sqrt(150), 7.5 / Math.sqrt(150))];
function vmCamKick(cam, fov, k) {
  const K = VM.camK;
  if (cam) for (let j = 0; j < 3; j++) K[j] += ((cam[j] * Math.PI) / 180 / VMA_CAM[j]) * k;
  if (fov) K[3] += fov * k;
}
