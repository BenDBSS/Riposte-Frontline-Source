/* ==========================================================================
   RECUL DE LA VISÉE DU JOUEUR
   Retour du propriétaire : le recul était trop discret (l'esprit des anciens Call of Duty), il doit donner plus de patate, sans simulation militaire, dans l'esprit
   des Battlefield récents. Le joueur seulement : les bots gardent l'ancien recul (ctlShoot), leur gâchette attend déjà que leur visée revienne (07b-tactics.js), et
   les durcir les rendrait moins dangereux sans raison.
   - Chaque coup relève la visée (RECOIL.cat.mul fois le recul vertical v et horizontal h de l'arme, accessoires compris : weaponDef les a déjà appliqués à
     d.recoil). Le premier coup d'une rafale est un peu plus doux, puis le recul monte sur cinq coups jusqu'à son plein (fusils : motif « climb », qui
     monte puis serpente ; pistolets-mitrailleurs : sautillant ; le reste : au hasard).
   - Ce qui l'adoucit : la visée à l'épaule (x0,66), l'accroupi (x0,75). Ce qui l'aggrave : courir ou pousser le stick (x1,2), être en l'air (x1,5). Au doigt
     (x0,75) et à la manette (x0,85) le recul est un peu plus faible : on ne contre pas un recul avec un pouce comme avec une souris, et le tir automatique
     du doigt perdrait sa cible à chaque coup.
   - Retour de la visée (recoilTick) : quand on lâche la gâchette (0,1 s après le dernier coup), la visée redescend d'elle-même sur la part du recul que
     l'on n'a pas déjà reprise à la main (RECOIL.cat.back : 70 % pour un fusil, 90 % pour un fusil de précision ou à pompe, dont le coup unique est un
     sursaut), en une demi-seconde à peu près. Une rafale tenue monte donc toujours, deux ou trois rafales brèves reviennent sur la cible : tirer court paie.
   - Le modèle de l'arme et la vue (vmKick, playerShotFx) bougent aussi plus (RECOIL.vis) : le coup se voit autant qu'il se contrôle.
   Contrôle : node tools/dev/visual/recul.js (tableau par arme : relèvement après 1, 5, 10 coups et un chargeur, à la hanche, à l'épaule, accroupi, en
   courant ; retour de la visée ; bots inchangés).
   ========================================================================== */
const RECOIL = {
  cat: { ar: { mul: 1.55, back: 0.7 }, smg: { mul: 1.45, back: 0.7 }, pistol: { mul: 1.3, back: 0.85 }, sniper: { mul: 1.15, back: 0.9 }, shotgun: { mul: 1.15, back: 0.9 } },
  ads: 0.66, crouch: 0.75, move: 1.2, air: 1.5, input: { kb: 1, pad: 0.85, touch: 0.75 },
  first: 0.85, peak: 1.25, ramp: 5, // coefficient du premier coup d'une rafale, du plein recul, nombre de coups pour y arriver
  delay: 0.1, rate: 7, vis: 1.45, // délai avant le retour (s), vitesse du retour (1/s), force du recul visible du modèle et de la vue (1,3 avant la 5.1)
};
/* Relèvement vertical et dérive horizontale (rad) d'un coup du joueur : n est le rang du coup dans la rafale (0 : le premier), ads la mise à l'épaule (0 à 1),
   spd la vitesse au sol (m/s) */
function recoilShot(ent, d, n, ads, spd) {
  const K = RECOIL.cat[d.cat] || RECOIL.cat.ar, R = d.recoil;
  let m = K.mul * lerp(1, RECOIL.ads, ads) * (ent.crouch ? RECOIL.crouch : 1) * (RECOIL.input[inputMode()] || 1);
  if (spd > 2.5) m *= RECOIL.move;
  if (!ent.onGround) m *= RECOIL.air;
  if (d.bipod && ent.crouch && spd < 0.4) m *= 0.5; // bipied posé (accroupi et immobile) : le recul est presque annulé
  let kv = R.v * m * rand(0.9, 1.1), kh;
  if (d.pattern === 'climb') { kv *= lerp(RECOIL.first, RECOIL.peak, Math.min(1, n / RECOIL.ramp)); kh = (Math.sin(n * 0.55 + 0.6) * 1.2 + (Math.random() - 0.5) * 0.6) * R.h; }
  else if (d.pattern === 'smg') { kv *= n ? 1 : RECOIL.first + 0.1; kh = (Math.random() - 0.5) * 2.6 * R.h; }
  else kh = (Math.random() - 0.5) * 2 * R.h;
  return { kv, kh: kh * m };
}
/* Retour de la visée, à chaque image du joueur vivant, après l'application du regard. manual : de combien le joueur vient de faire bouger la visée à la main
   (négatif : vers le bas), qui compte comme du recul déjà repris */
function recoilTick(dt, now, manual) {
  const A = PL.ent.arms;
  if (!(A.recPend > 0)) { A.recPend = 0; return; }
  if (manual < 0) A.recPend = Math.max(0, A.recPend + manual);
  if (now - A.lastShotAt < RECOIL.delay) { A.recArm = false; return; }
  if (!A.recArm) { A.recArm = true; A.recPend *= (RECOIL.cat[armsW(PL.ent).def.cat] || RECOIL.cat.ar).back; } // seule la part « retournable » revient, le reste est resté
  const dp = A.recPend * (1 - Math.exp(-RECOIL.rate * dt));
  PL.pitch -= dp; A.recPend -= dp;
  if (A.recPend < 1e-4) A.recPend = 0;
}
