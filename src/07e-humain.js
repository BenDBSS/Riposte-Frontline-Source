/* ==========================================================================
   MOUVEMENT HUMAIN DES BOTS
   Ce qui sépare un soldat qui « suit un chemin » d'un joueur : il voit ses murs (pas chassés et reculs ne s'y jettent pas), il sent quand le
   décor l'arrête (botBump : part du déplacement voulu que les collisions reprennent) et s'en sort en quelques dixièmes de seconde par paliers
   (botUnstick : pas de côté, saut par-dessus un muret, retour sur un nœud libre du réseau, nouveau but) au lieu de rester le nez contre une cloison.
   ========================================================================== */
/* Place libre pour le corps d'un bot en (x, z), pieds à la hauteur y : aucune boîte ne l'arrête (mêmes règles que collideCircle) */
function botSpotFree(x, z, y, crouch) {
  const r = 0.3, h = crouch ? 1.2 : 1.75, arr = queryBoxes(x - r, z - r, x + r, z + r); // un peu moins que le rayon du corps (0,34) : un bot collé à un mur n'est pas « coincé » pour autant
  for (let k = 0; k < arr.length; k++) {
    const c = arr[k];
    if (c.ray || c.y1 <= y + STEP || c.y0 >= y + h) continue;
    const dx = x - clamp(x, c.x0, c.x1), dz = z - clamp(z, c.z0, c.z1);
    if (dx * dx + dz * dz < r * r) return false;
  }
  return true;
}
/* Longueur libre (m, au plus len) devant le bot dans la direction (dx, dz) unitaire : s'arrête au premier obstacle, à une marche trop haute et
   à un vide ou une chute de plus de 0,7 m (on ne chasse pas au bord d'un toit, d'une île ou d'un bassin) */
function botRoom(b, dx, dz, len) {
  let y = b.pos.y;
  for (let s = 0.4; s <= len + 0.01; s += 0.4) {
    const x = b.pos.x + dx * s, z = b.pos.z + dz * s;
    if (!botSpotFree(x, z, y, b.crouch)) return s - 0.4;
    const g = groundHeight(x, z, y + 0.05, 0.3);
    if (g < y - 0.7 || (VOID.on && g <= VOID.floor + 1)) return s - 0.4;
    y = Math.max(g, y - 0.2);
  }
  return len;
}
/* Côté du pas chassé : prefer (-1 ou 1) si le bot y a au moins 1,3 m de place, sinon l'autre côté, sinon 0 (rester en place). Le côté droit du
   regard (yaw) est (cos, -sin), comme dans updateBot. */
function botSide(b, yaw, prefer) {
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  if (botRoom(b, rx * prefer, rz * prefer, 1.3) >= 1.2) return prefer;
  if (botRoom(b, -rx * prefer, -rz * prefer, 1.3) >= 1.2) return -prefer;
  return 0;
}
/* Nœud libre du réseau le plus proche qu'on rejoint en ligne droite (renvoie son indice, -1 si aucun) */
function botNearNode(b) {
  const cx0 = Math.floor(b.pos.x - NAV.x0), cz0 = Math.floor(b.pos.z - NAV.z0);
  let best = -1, bd = 1e9;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const cx = cx0 + dx, cz = cz0 + dz; if (cx < 0 || cz < 0 || cx >= NAV.W || cz >= NAV.H) continue;
    const cell = NAV.cells[cz * NAV.W + cx];
    for (let i = 0; i < cell.length; i++) {
      const id = cell[i], dy = NAV.ny[id] - b.pos.y; if (dy > 0.6 || dy < -0.8 || NAV.comp[id] !== NAV.mainComp) continue;
      const ex = NAV.nx[id] - b.pos.x, ez = NAV.nz[id] - b.pos.z, d = Math.sqrt(ex * ex + ez * ez); if (d >= bd) continue;
      if (d > 0.3 && botRoom(b, ex / d, ez / d, d) < d - 0.05) continue;
      bd = d; best = id;
    }
  }
  return best;
}

/* ---------- Le décor arrête le bot ---------- */
const BUMP = { tc: 0.18, lost: 0.5, minV: 1.2, hold: 0.28 };
/* Appelé après ctlMove : b.bump suit (lissé) la part du pas voulu (b.vel, avant collision) que le décor a reprise, 0 libre à 1 contre un mur
   de face ; au-delà de la moitié pendant BUMP.hold secondes en marchant, le bot cherche une issue */
function botBump(b, dt, x0, z0, now) {
  const cx = b.vel.x * dt, cz = b.vel.z * dt, c2 = cx * cx + cz * cz;
  let lost = 0;
  if (c2 > 1e-6 && b.edgeT !== MATCH.time && now - b.spawnAt > 0.6) lost = clamp(1 - ((b.pos.x - x0) * cx + (b.pos.z - z0) * cz) / c2, 0, 1);
  b.bump += (lost - b.bump) * (1 - Math.exp(-dt / BUMP.tc));
  if (b.bump > BUMP.lost && c2 > BUMP.minV * BUMP.minV * dt * dt) b.bumpT += dt; else b.bumpT = Math.max(0, b.bumpT - dt * 2);
  if (b.bumpT > BUMP.hold) { b.bumpT = 0; botUnstick(b, now); }
}
/* Sortie de blocage, par paliers (b.unstickN remonte tant qu'un nouveau blocage vient moins de 3 s après le précédent) :
   0 chemin neuf et pas de côté du côté dégagé ; 1 saut si un muret bas est devant (pas en combat), sinon retour sur un nœud libre ; 2 retour sur un nœud libre,
   nouveau but, sortie du couvert ; 3 et plus recul puis nouveau but ; 6 : posé sur le nœud libre le plus proche (dernier recours, jamais vu en
   pratique : le palier 3 suffit) */
function botUnstick(b, now) {
  const n = now - b.unstickAt < 3 ? b.unstickN + 1 : 0;
  b.unstickN = n; b.unstickAt = now; b.bump = 0;
  b.path = null; b.repathT = 0;
  const hl = hyp(b.vel.x, b.vel.z) || 1, hx = b.vel.x / hl, hz = b.vel.z / hl;
  if (b.tactic === 'fight') { b.strafeDir = -(b.strafeDir || 1); b.moveT = Math.min(b.moveT || 0, 0.15); }
  if (n === 0) {
    const s = botSide(b, Math.atan2(-hx, -hz), Math.random() < 0.5 ? 1 : -1); // à droite ou à gauche du cap, du côté où il y a de la place
    b.sideDir = s; b.sideT = s ? 0.45 : 0;
    if (!s) b.backT = 0.5;
    return;
  }
  if (n === 1 && b.tactic !== 'fight' && botLedge(b, hx, hz) > 0) { b.jumpT = 0.3; return; } // en combat, un muret buté en pas chassé ne vaut pas un saut
  if (n <= 2 || n === 5) {
    const id = botNearNode(b);
    if (id >= 0) { b.recX = NAV.nx[id]; b.recZ = NAV.nz[id]; b.recT = 1.0; }
    if (n === 2) { b.goal = null; if (b.tactic === 'cover') { releaseCover(b); b.tactic = 'fight'; } b.forceDecide = true; }
    return;
  }
  b.backT = 0.7; b.goal = null; if (b.cover) releaseCover(b); b.forceDecide = true;
  if (n >= 6) { const id = botNearNode(b); if (id >= 0) { b.pos.x = NAV.nx[id]; b.pos.z = NAV.nz[id]; b.pos.y = NAV.ny[id]; b.vel.set(0, 0, 0); b.vy = 0; b.unstickN = 0; } }
}
/* Hauteur du muret franchissable en sautant juste devant (direction unitaire (hx, hz)), -1 s'il n'y en a pas : une boîte entre la marche
   automatique et 1,05 m (le saut monte de 1,04 m), assez large pour qu'on se pose dessus, sans plafond bas au-dessus */
function botLedge(b, hx, hz) {
  const x = b.pos.x + hx * 0.75, z = b.pos.z + hz * 0.75, y = b.pos.y;
  let top = -1;
  const arr = queryBoxes(x - 0.2, z - 0.2, x + 0.2, z + 0.2);
  for (let k = 0; k < arr.length; k++) {
    const c = arr[k];
    if (c.ray || c.inv || x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) continue;
    if (c.y1 > y + STEP + 0.03 && c.y1 <= y + 1.05 && c.y0 < y + STEP) top = Math.max(top, c.y1);
  }
  if (top < 0) return -1;
  const x2 = b.pos.x + hx * 1.5, z2 = b.pos.z + hz * 1.5;                       // de quoi se poser, et la tête passe
  if (Math.abs(groundHeight(x2, z2, top + 0.05, 0.2) - top) > 0.05 || ceilingAbove(x2, z2, top + 0.3, 0.3) < top + 1.8 || ceilingAbove(b.pos.x, b.pos.z, y + 0.3, 0.3) < y + 2.9) return -1;
  return top - y;
}

/* ---------- Tempérament ----------
   Chaque bot a le sien pour toute la partie, comme un joueur a ses habitudes : le fonceur glisse, le méthodique regarde autour de lui
   et avance posément, le prudent ne force rien. slide : goût de la glissade ; scan : regards autour de lui en marchant et allure prudente.
   Les valeurs bougent un peu d'un bot à l'autre, et l'arme pèse : un tireur d'élite ne gigote pas, un fusil à pompe ou un pistolet-mitrailleur
   fonce. Le niveau de difficulté pèse aussi (DIFF.flair) : une Recrue glisse peu. */
const BOT_STYLES = [
  { w: 1.0, slide: 0.85, scan: 0.3 },  // fonceur
  { w: 1.2, slide: 0.4, scan: 0.9 },   // méthodique
  { w: 1.6, slide: 0.6, scan: 0.55 },  // polyvalent
  { w: 0.9, slide: 0.2, scan: 0.75 },  // prudent
];
function botPers() {
  let r = Math.random() * BOT_STYLES.reduce((a, s) => a + s.w, 0), st = BOT_STYLES[0];
  for (const s of BOT_STYLES) { st = s; r -= s.w; if (r <= 0) break; }
  return { slide: clamp(st.slide + rand(-0.15, 0.15), 0, 1), scan: clamp(st.scan + rand(-0.15, 0.15), 0.1, 1) };
}
/* Goût d'un mouvement ('slide') compte tenu de l'arme tenue */
function botFlair(b, k) {
  const ai = b.weapon.ai, m = ai.sniper ? 0.25 : ai.shotgun ? 1.25 : ai.rush ? 1.15 : 1;
  return b.pers[k] * m * botDiff().flair;
}
/* Glissade dans la direction de la course, s'il y a la place (4,6 m libres, ni mur, ni vide, ni chute) et si le bot court assez vite ;
   un bot ne glisse pas plus d'une fois toutes les 5 s. Renvoie vrai si la demande est faite (le contrôleur la prend au sprint). */
function botTrySlide(b, now) {
  const v = Math.sqrt(b.vel.x * b.vel.x + b.vel.z * b.vel.z);
  if (v < 4.2 || !b.onGround || b.crouch || b.slideT > 0 || b.slideCd > 0 || now - b.slideAt < 5) return false;
  if (botRoom(b, b.vel.x / v, b.vel.z / v, 5) < 4.6) return false;
  b.input.slide = true; b.slideAt = now; return true;
}

/* Faut-il sauter maintenant pour franchir le lien de saut (a, p) du chemin (03-nav.js, navLeaps) ? p.lead est la distance, depuis a, où le corps touche
   l'obstacle ; le bot saute un peu avant, d'autant plus tôt qu'il court vite : il doit avoir quitté le sol quand il arrive au pied du muret.
   Seulement s'il va vers l'obstacle et ne l'a pas dépassé : un bot qui passe à côté, recule ou fait autre chose ne saute pas pour rien */
function botLeapNow(b, a, p) {
  if (!p.jump || !b.onGround || b.crouch) return false;
  const ux = p.x - a.x, uz = p.z - a.z, L = Math.sqrt(ux * ux + uz * uz) || 1, rx = b.pos.x - a.x, rz = b.pos.z - a.z;
  const s = (rx * ux + rz * uz) / L, side = Math.abs(rx * uz - rz * ux) / L, v = Math.sqrt(b.vel.x * b.vel.x + b.vel.z * b.vel.z);
  return side < 0.7 && p.lead - s < 0.25 + 0.1 * v && s < p.lead + 0.8 && (b.vel.x * ux + b.vel.z * uz) / L > 0.8;
}

/* ---------- Oreilles ----------
   Des pas qui courent, une glissade, quelqu'un qui marche tout près : un joueur les entend sans les voir. La jauge d'attention monte (jamais
   jusqu'au repérage : il faut voir pour tirer), le bot tourne la tête vers le bruit et, une fois sur deux s'il se baladait, va voir. Marcher
   accroupi ou lentement ne s'entend pas. Renvoie la jauge. */
function botEars(b, e, d, aw, dt, now, D) {
  const sp = Math.sqrt(e.vel.x * e.vel.x + e.vel.z * e.vel.z), R = e.slideT > 0 ? 12 : sp > 4.6 ? 11 : sp > 2.4 && !e.crouch ? 5 : 0;
  if (R === 0 || d > R || Math.abs(e.pos.y - b.pos.y) > 3.5) return aw;
  aw = Math.min(0.9, aw + 1.1 * (1 - d / R) * D.see * dt);
  if (aw > 0.45 && now - b.stepHeardT > 2) {
    b.stepHeardT = now; botLookAt(b, e.pos, now, 0.9); b.warnT = now + 8;
    if (b.tactic === 'roam' && Math.random() < 0.45) { b.lastKnown.copy(botGuess(b.pos, e.pos, 2, 0.2)); b.lastSeenT = now - 2.2; b.target = null; b.decideT = Math.min(b.decideT, 0.3); }
    else if ((b.tactic === 'hunt' || b.tactic === 'search') && e === b.chaseE) { b.lastKnown.copy(botGuess(b.pos, e.pos, 2, 0.15)); if (b.tactic === 'search') b.tactic = 'hunt'; } // celui qu'il cherche s'est trahi : il suit le bruit
  }
  return aw;
}
/* Mort d'un soldat : le bot tué retient d'où venait le coup (il y retournera peut-être, voir initTactics), ses coéquipiers proches se tournent
   vers l'agresseur et se méfient un moment */
function botDeathNote(v, a) {
  const now = MATCH.time;
  if (!v.isPlayer && !v.isRemote && a && a !== v) v.grudge = { x: a.pos.x, z: a.pos.z, t: now };
  if (!a || a === v || allied(a, v)) return;
  for (const o of entities) {
    if (o === v || o.isPlayer || o.isRemote || !o.alive || o.off || o.visible || !allied(o, v) || o.pos.distanceTo(v.pos) > 25) continue;
    botLookAt(o, botGuess(o.pos, a.pos, 4, 0.12), now, 1.2); o.warnT = now + 10; o.fear = Math.min(2, o.fear + 0.25); o.decideT = Math.min(o.decideT, rand(0.3, 0.7));
  }
}
/* Grenade : la trajectoire (en cloche) a-t-elle la place de passer ? Le milieu du trajet, deux mètres plus haut, est en vue du lanceur et de la cible */
const _ne = new V3(), _na = new V3(), _nt = new V3();
function botNadeClear(b, t) {
  entEye(b, _ne); _na.set((_ne.x + t.x) / 2, Math.max(_ne.y, t.y) + 2.2, (_ne.z + t.z) / 2); _nt.set(t.x, t.y + 0.6, t.z);
  return lineClear(_ne, _na) && lineClear(_na, _nt);
}
/* Fuite devant une grenade : de huit directions, celle qui éloigne du danger (jamais vers lui) et qui a de la place (jusqu'à 5 m), plutôt que la
   droite exacte qui jette un bot contre le mur d'en face. Le résultat est dans b.fleeX, b.fleeZ (vecteur unitaire). */
function botFlee(b, from) {
  const ax = b.pos.x - from.x, az = b.pos.z - from.z, al = Math.sqrt(ax * ax + az * az) || 1;
  let best = -1e9, bx = ax / al, bz = az / al;
  for (let k = 0; k < 8; k++) {
    const a = k * 0.7854, dx = Math.cos(a), dz = Math.sin(a), away = (dx * ax + dz * az) / al;
    if (away < -0.2) continue;
    const room = botRoom(b, dx, dz, 5), sc = room * 0.7 + away * 3 + (room > 3.5 ? 1 : 0);
    if (sc > best) { best = sc; bx = dx; bz = dz; }
  }
  b.fleeX = bx; b.fleeZ = bz;
}
