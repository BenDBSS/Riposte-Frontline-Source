/* Filtre des mots : noms (d'utilisateur, d'affichage, pseudo en ligne) et discussion des salons. Un seul fichier pour le serveur des
   comptes, qui refuse un nom (register, profile), et pour le jeu, qui masque un mot dans la discussion et remplace un pseudo : build.py
   le joint au script du jeu en retirant les « export » (il n'y fait que déclarer ; tools/dev/check_decl.py le compte avec src/).
   Le texte est d'abord ramené à des lettres simples : minuscules, accents ôtés, chiffres et symboles qui imitent une lettre (4 → a, 3 → e,
   0 → o, 1 → i, 5 → s, 7 → t, @ → a, $ → s), quelques lettres cyrilliques et grecques qui ressemblent aux latines ; une lettre répétée compte une fois
   de plus (« fuuuck »). Chaque entrée dit où et comment elle vaut :
   - p : partout, n'importe où dans un mot (insultes et injures sans sens innocent) ;
   - n : dans la discussion, le mot entier ; dans un nom, n'importe où (« nazi » : pas « nazionale » dans la discussion) ;
   - m : partout, le mot entier seulement (mots courts qui se cachent dans des mots innocents : « pute » dans « députe ») ;
   - N : dans les noms seulement, n'importe où (gros mots courants, laissés à la discussion) ;
   - M : dans les noms seulement, le mot entier.
   Les noms et codes de l'extrême droite sont refusés aussi (figures nazies, slogans, Combat 18, 1488 : choix du propriétaire ; « 88 » seul
   reste permis, trop de joueurs nés en 1988 l'ont dans leur nom). Un mot entier admet un pluriel (s, x) ou un e final. Les lettres espacées (« n i g g e r ») sont recollées. Le filtre ne voit pas tout
   (fautes volontaires, autres alphabets) : le bouton « Signaler » et la modération font le reste. */
export const FILTRE_MOTS = {
  p: 'nigger nigga faggot fuck asshole arsehole bitch whore slut pussy dickhead cocksuck blowjob handjob cumshot dildo jizz tranny shemale '
    + 'rapist wetback killyourself hitler auschwitz siegheil whitepower kkk pedophil pedofil paedophil '
    + 'encule salope connard connasse conasse filsdepute niquetamere sucemabite pouffiasse grognasse enfoire batard branl gouine fiotte '
    + 'tarlouze negre bougnoul youpin bamboula salearabe salejuif salenoir '
    + 'hurensohn fotze wichser schwuchtel arschloch missgeburt hijodeputa maricon pendejo gilipollas vaffanculo stronzo frocio puttana cazzo '
    + 'caralho viado '
    // extrême droite (aucun signe accepté : choix du propriétaire)
    + 'himmler goebbels heydrich mengele eichmann fuhrer fuehrer totenkopf waffenss whitepride wpww bloodandhonour bloodhonour '
    + 'nationalsocialis aryannation aryanbrotherhood kukluxklan remigration grandremplacement',
  n: 'nazi cunt twat penis vagina vagin porn porno wank wanker',
  m: 'pute pd pede tapette nique niquer ntm fdp suce catin teub fag spic chink kike gook paki rape raped pedo kys neger heil spast puta '
    + 'zorra cabron',
  N: 'putain merde shit couille hentai nsfw onlyfans boobs bastard mierda mussolini petain aryen generationidentitaire '
    + 'wehrmacht',
  M: 'bite chatte dick cock tits sex sexe negro adolf reich duce',
};
const FILTRE_SUB = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '€': 'e', '!': 'i', '|': 'i',
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'к': 'k', 'м': 'm', 'т': 't', 'н': 'h', 'в': 'b',
  'α': 'a', 'β': 'b', 'ε': 'e', 'η': 'n', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'ο': 'o', 'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x', 'ı': 'i' };
/* Lettres simples d'un texte (sans espaces ni ponctuation) */
export function filtreNorm(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[0134578@$€!|аеорсухіјѕкмтнвαβεηικνορτυχı]/g, (c) => FILTRE_SUB[c] || c).replace(/[^a-z]/g, '');
}
let FILTRE_RE = null;
function filtreRes() {
  if (FILTRE_RE) return FILTRE_RE;
  const re = (w) => w.split('').map((c) => c + '+').join(''); // chaque lettre peut se répéter
  const any = (k) => FILTRE_MOTS[k].split(' ').filter(Boolean).map(re).join('|');
  FILTRE_RE = {
    chatIn: new RegExp('(' + any('p') + ')'),                                         // n'importe où dans un mot de la discussion
    chatWord: new RegExp('^(' + any('n') + '|' + any('m') + ')(s|x|e)?$'),           // mot entier de la discussion
    nameIn: new RegExp('(' + any('p') + '|' + any('n') + '|' + any('N') + ')'),      // n'importe où dans un nom
    nameWord: new RegExp('^(' + any('m') + '|' + any('M') + ')(s|x|e)?$'),           // mot entier d'un nom
  };
  return FILTRE_RE;
}
// codes des néonazis (1488, Combat 18, « 14 words »), séparateurs compris ; masqués dans la discussion même coupés par une espace
const FILTRE_HATE = /1[\s_.-]*4[\s_.-]*8[\s_.-]*8|combat[\s_.-]*18|\b14[\s_.-]*words/gi;
const filtreHate = (s) => { FILTRE_HATE.lastIndex = 0; return FILTRE_HATE.test(String(s)); };

/* Le nom (d'utilisateur ou d'affichage, pseudo) est-il refusé ? Mots séparés par tout ce qui n'est pas une lettre ; le nom entier est
   aussi lu d'un bloc (« Big_D1ck » : « bigdick » ; « n a z i ») */
export function filtreNom(s) {
  const R = filtreRes(), t = String(s == null ? '' : s);
  if (filtreHate(t)) return true;
  const words = t.toLowerCase().normalize('NFKD').split(/[^a-z0-9@$€!|̀-ͯаеорсухіјѕкмтнвαβεηικνορτυχı]+/).map(filtreNorm).filter(Boolean);
  return R.nameIn.test(filtreNorm(t)) || words.some((w) => R.nameWord.test(w) || R.chatWord.test(w));
}
/* Message de la discussion, mots refusés remplacés par des astérisques (autant que de lettres, 8 au plus) */
export function filtreTexte(s) {
  const R = filtreRes(), parts = String(s == null ? '' : s).replace(FILTRE_HATE, (m) => m.replace(/\S/g, '*')).split(/(\s+)/);
  const bad = parts.map((w) => !/^\s*$/.test(w) && (filtreHate(w) || (() => { const k = filtreNorm(w); return !!k && (R.chatIn.test(k) || R.chatWord.test(k)); })()));
  // lettres espacées : trois mots d'une lettre ou plus à la suite sont relus ensemble
  for (let i = 0; i < parts.length; i += 2) {
    let j = i; while (j < parts.length && filtreNorm(parts[j]).length === 1) j += 2;
    if (j - i >= 6) { const k = filtreNorm(parts.slice(i, j).join('')); if (R.chatIn.test(k) || R.chatWord.test(k)) for (let x = i; x < j; x += 2) bad[x] = true; }
    if (j > i) i = j - 2;
  }
  return parts.map((w, i) => (bad[i] ? '*'.repeat(Math.min(8, Math.max(1, w.length))) : w)).join('');
}
