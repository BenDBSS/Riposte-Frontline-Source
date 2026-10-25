#!/usr/bin/env python3
"""Contrôle des langues : python3 tools/dev/check_i18n.py
- chaque texte passé à _t() / _tn() dans src/ et chaque texte de shell.html a une traduction dans i18n/en.txt ;
- chaque entrée de i18n/en.txt sert (sinon : à retirer) ;
- les paramètres {0}, {1}... sont les mêmes des deux côtés ;
- aucun texte français n'est resté en clair dans src/ (littéral ou texte d'un modèle HTML) hors de _t() ; les textes voulus en français
  (décor des cartes, rapport de connexion, journaux) sont listés dans i18n/ignore.txt ou se trouvent dans une ligne de journal.
Sortie 0 si tout va bien, 1 sinon."""
import glob,os,re,sys
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')
sys.path.insert(0,os.path.join(ROOT,'tools')); sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import i18n,i18n_keys as K
os.chdir(ROOT)
errs=[]; warn=[]
en,e=i18n.load_en(); errs+=e
keys=K.all_keys(); shell=K.shell_keys()
SHELL_SAME={'Riposte: Frontline','Khamsin','Place','CODE','Alpha','Bravo','UAV','Killcam','Solo'}  # noms propres ou textes remplacés par le jeu
need={k:w for k,w in keys.items()}
for k in shell:
    if k not in SHELL_SAME: need.setdefault(k,['shell.html'])
for k,w in need.items():
    if k not in en: errs.append(f"sans traduction anglaise : {k[:90]!r}  ({w[0]})")
for k in en:
    if k not in need: errs.append(f"entrée inutile dans i18n/en.txt : {k[:90]!r}")
PH=re.compile(r"\{\d+\}")
for k,v in en.items():
    if sorted(PH.findall(k))!=sorted(PH.findall(v)): errs.append(f"paramètres différents : {k[:70]!r} / {v[:70]!r}")
    if re.search(r"\s$|^\s",k) or re.search(r"\s$|^\s",v): errs.append(f"espace en début ou fin : {k[:70]!r}")
# textes français restés en clair
FRW=K.FRW
ignore=[l.rstrip('\n') for l in open('i18n/ignore.txt',encoding='utf-8')] if os.path.exists('i18n/ignore.txt') else []
ignore=[l for l in ignore if l.strip() and not l.startswith('#')]
EXCL_CTX=re.compile(r"(netd\w+\(|console\.\w+\(|new Error\(|throw |===|!==|\.includes\(|\.startsWith\(|\.test\(|\.match\(|querySelector\w*\(|getElementById\(|classList\.\w+\(|setAttribute\(|addEventListener\()[^()]*$")
def is_fr(s):
    t=re.sub(r"\{\d+\}","",s)
    if not re.search(r"[A-Za-zÀ-ÿ]{3,}",t): return False
    if re.search(r"[àâäçéèêëîïôöùûüœÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŒ]",t): return True
    return bool(FRW.search(t)) and ' ' in t.strip()
def ignored(f,s): return any(l.startswith(f+': ') and l[len(f)+2:] in s for l in ignore)
for f in sorted(glob.glob('src/*.js')):
    b=os.path.basename(f)
    if b.startswith('00-i18n') or b.startswith('01-core') or (b.startswith('02') and b!='02-map.js' and not re.match(r"02[a-z]*-",b) is None and b not in ()): 
        # décor des cartes : seuls les noms de lieux sont traduits (_t dans leurs listes de zones) ; le reste est le décor, dans la langue de la carte
        continue
    src=open(f,encoding='utf-8').read()
    for a,e_,v,g in sorted(K.literals(src)):
        pre=src[max(0,a-200):a]
        if K.CALL.search(pre) or re.search(r"\b_t\(\s*$",pre[-12:]): continue
        if not is_fr(v): continue
        if EXCL_CTX.search(pre[-60:]): continue
        if ignored(b,v): continue
        errs.append(f"texte français en clair : {b}:{src.count(chr(10),0,a)+1} {v[:70]!r}")
    # texte statique des modèles HTML
    i=0;n=len(src)
    while i<n:
        c=src[i]
        if c=='/' and src[i+1:i+2]=='/': j=src.find('\n',i); i=n if j<0 else j; continue
        if c=='/' and src[i+1:i+2]=='*': j=src.find('*/',i+2); i=n if j<0 else j+2; continue
        if c in '\'"': i=K.skip_string(src,i); continue
        if c=='`':
            st,j=K.template_static(src,i)
            if re.search(r"</?[a-z][^>]*>",st):
                txt=re.sub(r"<[^>]*>"," ",st)
                for run in re.split(r"\s{2,}|\n",txt):
                    if is_fr(run) and not ignored(b,run.strip()): errs.append(f"texte français en clair (modèle HTML) : {b}:{src.count(chr(10),0,i)+1} {run.strip()[:70]!r}")
            i=j; continue
        i+=1
# texte écrit dans le CSS de shell.html (content: "...") : il doit passer par une variable --t-... posée par le jeu
for m in re.finditer(r"content:\s*(?!var\()[\"'](?:\s*)([^\"']*[A-Za-zÀ-ÿ]{3,}[^\"']*)[\"']",open('shell.html',encoding='utf-8').read()):
    errs.append(f"texte dans le CSS de shell.html (utiliser var(--t-...), voir src/09e-menus.js) : {m.group(1)!r}")
# messages d'erreur de l'API (api/_lib/*.js) : chacun a sa version anglaise dans api/_lib/i18n.js (absente de la copie publique du code)
def jsstr(x): return K.js_unescape(x)
api_en=set(jsstr(m.group(1)) for m in re.finditer(r"^  '((?:[^'\\]|\\.)*)':",open('api/_lib/i18n.js',encoding='utf-8').read() if os.path.exists('api/_lib/i18n.js') else '',re.M))
for f in sorted(glob.glob('api/_lib/*.js')+glob.glob('api/*.js')):
    if f.endswith('i18n.js'): continue
    for m in re.finditer(r"HttpError\(\d+,\s*'((?:[^'\\]|\\.)*)'",open(f,encoding='utf-8').read()):
        k=jsstr(m.group(1))
        if k not in api_en and k != 'Résumé de partie refusé : ': errs.append(f"message d'API sans traduction anglaise : {k[:80]!r}  ({f})")
for w in warn: print('avertissement :',w)
for x in errs: print('erreur :',x)
print(f"{len(en)} entrées anglaises, {len(need)} textes à traduire, {len(errs)} erreur(s)")
sys.exit(1 if errs else 0)
