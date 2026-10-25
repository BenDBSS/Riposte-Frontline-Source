/* ==========================================================================
   MARQUEURS D'ALLIÉS
   Reconnaître un ennemi au premier coup d'œil est difficile dans un décor chargé (Hortus : feuillage, serre, parterres) ; les
   tenues des deux camps ne suffisent plus. Plutôt que de surligner les ennemis ou de retoucher les modèles, ce sont les alliés qui
   se signalent, comme dans la plupart des jeux de tir par équipes : un chevron vert au-dessus de la tête, avec le nom de près. Tout
   soldat sans marqueur est donc un adversaire, et la vue des ennemis reste naturelle (aucun contour, aucune lueur).
   - Le marqueur suit la tête (projetée à l'écran), garde une taille lisible qui diminue avec la distance (jusqu'à 120 m) et s'efface
     tout près (moins de 6 m) pour ne pas gêner la visée.
   - Un allié caché derrière le décor reste marqué, plus pâle : on sait où est son équipe sans qu'il soit visible. La visibilité est
     testée toutes les 150 ms environ par allié (et seulement s'il est à l'écran), le fondu CSS lisse les changements.
   - Rien en match à mort (personne n'est allié), en lunette, en killcam, mort ou hors partie. Réglage « Marqueurs d'alliés » (Jeu).
   - Éléments du HUD (#allyMarks), un par allié, créés à la demande puis réutilisés ; ils ne s'écrivent que si leur valeur change
     (hudText, hudStyle) et bougent par transformation. Appelé juste avant le rendu : la caméra a alors sa position définitive.
   ========================================================================== */
const AM = { els: [], root: null, shown: 0, range: 120, nameRange: 32 };
const _amP = new V3(), _amH = new V3(), _amC = new V3();

/* Éléments du marqueur n° i (créés à la première demande) */
function amEl(i) {
  if (!AM.root) AM.root = $('allyMarks');
  while (AM.els.length <= i) {
    const el = document.createElement('div'); el.className = 'am';
    el.innerHTML = '<b></b><svg viewBox="0 0 22 16" aria-hidden="true"><path d="M2.5 2.5h17L11 14z"/></svg>';
    AM.root.appendChild(el); AM.els.push({ el, nm: el.firstChild });
  }
  return AM.els[i];
}
function allyMarksHide() {
  if (!AM.shown) return;
  AM.shown = 0;
  for (const m of AM.els) hudStyle(m.el, 'opacity', '0');
}
function allyMarksUpdate() {
  const me = PL.ent;
  if (!Settings.allyMarks || MATCH.mode === 'ffa' || !me.alive || (MATCH.state !== 'playing' && MATCH.state !== 'paused') || $('scope').classList.contains('on')) return allyMarksHide();
  camera.updateMatrixWorld();
  const W = VIEW.w, H = VIEW.h, cp = camera.position;
  const now = performance.now();
  let n = 0;
  for (const o of entities) {
    if (o === me || !o.alive || o.off || !allied(o, me)) continue;
    const m = amEl(n++);
    entHead(o, _amH); _amH.y += 0.35; // au-dessus de la tête
    const d = _amH.distanceTo(cp);
    _amP.copy(_amH).project(camera);
    let a = 0;
    if (d > 0.5 && d < AM.range && _amP.z < 1 && Math.abs(_amP.x) < 1.04 && Math.abs(_amP.y) < 1.04) {
      // visibilité (tête, sinon poitrine) : testée par intervalles, la valeur reste entre deux tests
      if (o.markT === undefined || now - o.markT > 150) { o.markT = now - Math.random() * 40; o.markVis = lineClear(cp, _amH) || (entChest(o, _amC), lineClear(cp, _amC)); }
      a = (o.markVis ? 0.9 : 0.42) * clamp((d - 3) / 3, 0, 1); // tout près : il s'efface
    }
    if (a <= 0) { hudStyle(m.el, 'opacity', '0'); continue; }
    const s = lerp(1, 0.62, clamp((d - 14) / 70, 0, 1)), px = Math.round((_amP.x * 0.5 + 0.5) * W), py = Math.round((-_amP.y * 0.5 + 0.5) * H);
    hudStyle(m.el, 'transform', `translate3d(${px}px,${py}px,0) translate(-50%,-100%) scale(${s.toFixed(2)})`);
    hudStyle(m.el, 'opacity', a.toFixed(2));
    hudText(m.nm, o.name);
    hudStyle(m.nm, 'opacity', clamp((AM.nameRange - d) / 8, 0, 1).toFixed(1)); // le nom ne s'affiche que de près
  }
  for (let i = n; i < AM.els.length; i++) hudStyle(AM.els[i].el, 'opacity', '0');
  AM.shown = n;
}
