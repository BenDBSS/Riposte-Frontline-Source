/* ==========================================================================
   SON DE MONTÉE DE NIVEAU : fanfare de 4 s fournie par le propriétaire du dépôt (fichier « Rank_Up.mp3 », créée avec Suno), jouée à chaque niveau du joueur gagné en
   partie (pas aux déblocages d'accessoires). MP3 stéréo 48 kHz, 162 kb/s, sans pochette ni étiquettes (assets/rankup.mp3), livré en base64 dans le socle
   (window.SOCLE, dist/tex/socle.<condensat>.js, voir build.py). Décodé une fois, au démarrage du son (initAudio) ; sans décodage possible (navigateur sans MP3,
   socle absent), le jeu reste muet à cet endroit.
   ========================================================================== */
const RANKUP_MP3 = (window.SOCLE || {}).rankup || '';
function rankUpPrepare() {
  if (!AU.ctx || AU.rankBuf !== undefined) return;
  AU.rankBuf = null; AU.rankPending = true;
  const done = (b) => { AU.rankPending = false; if (b) AU.rankBuf = b; if (b && AU.rankWant) { AU.rankWant = false; rankUpSound(); } };
  try {
    const bin = atob(RANKUP_MP3), u = new Uint8Array(bin.length); for (let i = 0; i < u.length; i++) u[i] = bin.charCodeAt(i);
    const p = AU.ctx.decodeAudioData(u.buffer, done, () => done(null)); if (p && p.catch) p.catch(() => done(null)); // (Safari ancien : seulement les rappels)
  } catch (e) { done(null); }
}
/* Joue la fanfare : directement sur le mix (pas d'assourdissement ni d'espace), au niveau du volume général ; pas encore décodée : elle part dès qu'elle l'est.
   Gain 2 (+6 dB, 3.1.0 : « à rehausser », retour du propriétaire) : comme les musiques de fin de partie (END_MUSIC), voir README « Niveaux » */
function rankUpSound() {
  if (!AU.ready || !AU.ctx) return;
  if (AU.rankBuf === undefined) rankUpPrepare();
  if (AU.rankBuf) { const s = AU.ctx.createBufferSource(); s.buffer = AU.rankBuf; s.connect(uiOut(2)); s.start(); }
  else if (AU.rankPending) AU.rankWant = true;
}
