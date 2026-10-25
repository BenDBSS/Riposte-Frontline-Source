"""Assemble le jeu en un seul fichier HTML : dist/riposte-frontline.html
three.js r147 est servi par le site (assets/vendor, tools/vendor.py) ; les modules de src/ sont concaténés dans l'ordre alphabétique.
Les images (assets/menu-bg.webp et sa carte de profondeur assets/menu-depth.webp, assets/logo.webp) sont intégrées en data URI, et
changelog.json (journal des mises à jour, validé ici) dans shell.html, à la place des marqueurs qui y figurent. La musique
des menus, dist/menu-theme.mp3, reste un fichier à côté du HTML : build.py n'en met que l'adresse (avec un condensat) dans
la page. Les textures photo des cartes aussi (un fichier par surface dans dist/tex/, chargé au lancement d'une carte),
et leurs illustrations (dist/maps/).
Écrit aussi dist/version.json : l'identifiant de la version construite, que le jeu consulte pour se mettre à jour."""
import base64,datetime,glob,hashlib,html as _html,json,os,re,shutil,subprocess,sys,tempfile
sys.path.insert(0,"tools")
import i18n,minif
tags="" # three.js : dist/tex/three.<condensat>.js (socle, plus bas), servi par le site comme le reste
# Relais des salons en ligne (serveur de jeu, voir serveur/README.md) : COD_RELAY_URL, sinon le fichier relay.url.
# Avec un relais, tout passe par lui (netViaServer, src/09d-netrelay.js) et PeerJS n'est pas chargé : aucune connexion directe
# entre joueurs, aucun ne voit l'adresse IP d'un autre. Vide : pas de relais, salons en pair à pair seul (PeerJS, WebRTC).
relay=os.environ.get("COD_RELAY_URL","").strip()
if not relay and os.path.exists("relay.url"):
    relay=next((l.strip() for l in open("relay.url",encoding="utf-8") if l.strip() and not l.lstrip().startswith("#")),"")
if relay and not re.fullmatch(r"wss?://[^\s\"<>]+",relay):
    raise SystemExit("adresse du relais invalide (attendu : wss://... ) : "+relay)
if not relay: # PeerJS : connexions WebRTC entre joueurs (voir src/09c-net.js) ; empreinte vérifiée (SRI) : jsDelivr ne peut pas en changer le code
    tags+='\n<script src="https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js" integrity="sha384-x0YgkOr/3UOZP2CRDxGW9e0Q+2Qjyr3uJrm4xU32Y7ZCNAo7Cc7bjhrZMi/dwczu" crossorigin="anonymous"></script>'
js="\n".join(open(f,encoding="utf-8").read() for f in sorted(glob.glob("src/*.js")))
# Filtre des mots (noms, discussion) : le même fichier sert au serveur des comptes (module) ; joint au jeu sans ses « export »
js=re.sub(r"^export ","",open("api/_lib/filtre.js",encoding="utf-8").read(),flags=re.M)+"\n"+js
def data_uri(path):
    return "data:image/"+("png" if path.endswith(".png") else "webp")+";base64,"+base64.b64encode(open(path,"rb").read()).decode("ascii")
# Textures photo CC0 (assets/tex/<surface>/map, normal, rough .webp, produites par tools/build_assets.py) : elles ne sont
# plus dans la page. Chaque surface devient un petit script à côté du HTML, dist/tex/<surface>.<condensat>.js, qui appelle
# texPack(clé, données) ; le jeu ne le charge qu'au lancement de la première carte qui s'en sert. Le condensat change
# avec le contenu : le fichier peut rester en cache indéfiniment (vercel.json). Une balise script marche aussi en file://.
packs={}
os.makedirs("dist/tex",exist_ok=True)
for d in sorted(glob.glob("assets/tex/*/")):
    key=os.path.basename(os.path.normpath(d))
    parts={}
    for kind in ("map","normal","rough"):
        f=os.path.join(d,kind+".webp")
        if not os.path.exists(f): raise SystemExit(f"assets/tex/{key} : {kind}.webp manquant")
        parts[kind]=data_uri(f)
    body="texPack("+json.dumps(key)+","+json.dumps(parts)+");\n"
    name="tex/"+key+"."+hashlib.sha1(body.encode("utf-8")).hexdigest()[:8]+".js"
    packs[key]=name
    if not os.path.exists("dist/"+name): open("dist/"+name,"w",encoding="utf-8").write(body)
# Ciels photographiés (assets/sky/<nom>.webp : moitié haute d'un panorama, de l'horizon au zénith ; <nom>_lo pour la qualité Basse) :
# même emballage, clé sky_<nom>, chargés au lancement de la carte qui en demande un (skyPhoto de sa définition)
for f in sorted(glob.glob("assets/sky/*.webp")):
    key="sky_"+os.path.splitext(os.path.basename(f))[0]
    body="texPack("+json.dumps(key)+","+json.dumps({"map":data_uri(f)})+");\n"
    name="tex/"+key+"."+hashlib.sha1(body.encode("utf-8")).hexdigest()[:8]+".js"
    packs[key]=name
    if not os.path.exists("dist/"+name): open("dist/"+name,"w",encoding="utf-8").write(body)
# Textures d'effets (assets/fx/<nom>.webp, une seule image : fractures des cristaux de Stratus...) : même emballage, clé fx_<nom>, chargées
# par la carte ou l'effet qui les demande (fetchTexPack)
for f in sorted(glob.glob("assets/fx/*.webp")):
    key="fx_"+os.path.splitext(os.path.basename(f))[0]
    body="texPack("+json.dumps(key)+","+json.dumps({"map":data_uri(f)})+");\n"
    name="tex/"+key+"."+hashlib.sha1(body.encode("utf-8")).hexdigest()[:8]+".js"
    packs[key]=name
    if not os.path.exists("dist/"+name): open("dist/"+name,"w",encoding="utf-8").write(body)
# HDRI d'éclairage (assets/vendor/hdri/<nom>.exr, tools/vendor.py) : même emballage, clé hdri_<nom>, la chaîne base64 du fichier EXR,
# chargée au lancement de la carte qui en demande une (src/01-core.js, loadHDRIEnvironment)
for f in sorted(glob.glob("assets/vendor/hdri/*.exr")):
    key="hdri_"+os.path.splitext(os.path.basename(f))[0]
    body="texPack("+json.dumps(key)+","+json.dumps(base64.b64encode(open(f,"rb").read()).decode("ascii"))+");\n"
    name="tex/"+key+"."+hashlib.sha1(body.encode("utf-8")).hexdigest()[:8]+".js"
    packs[key]=name
    if not os.path.exists("dist/"+name): open("dist/"+name,"w",encoding="utf-8").write(body)
# Socle de la page : les données du démarrage qui ne changent presque jamais d'une version à l'autre (740 Ko en base64), livrées dans
# deux scripts à condensat à côté de la page plutôt que dedans : une mise à jour du jeu ne les fait pas retélécharger (cache immuable,
# vercel.json et le service worker). Une balise script marche aussi en file:// (une image chargée depuis un fichier ne pourrait pas
# aller dans WebGL). socle-ui, en tête de page, avant le premier affichage : l'illustration des menus et le logo, posés en variables CSS
# (--key-art, --logo). socle, juste avant le code du jeu : window.SOCLE, avec la carte de profondeur du fond animé (depth,
# src/09w-fond.js), l'usure des armes (grain : assets/arme/surface.webp, python3 tools/build_armes.py, lue par src/06-weapons.js), les
# scans de tissu des tenues (tissus et teinte : assets/tenue/, python3 tools/build_tenues.py, lus par src/06e-gear.js), les animations
# cuites (anim : assets/anim/clips.bin et clips.json, node tools/dev/anim/cuire.mjs depuis le pack Mixamo hors dépôt, lues par
# src/06ab-anim.js) et la fanfare de montée de niveau (rankup, assets/rankup.mp3, src/05b-rankup-sound.js). Absent (réseau coupé) : le jeu
# démarre sans eux, avec ses replis.
grain="assets/arme/surface.webp"
anim=None
if os.path.exists("assets/anim/clips.json"):
    anim=json.load(open("assets/anim/clips.json",encoding="utf-8")); anim.pop("layout",None)
    anim["b"]=base64.b64encode(open("assets/anim/clips.bin","rb").read()).decode("ascii")
    print("animations cuites :",len(anim["clips"]),"clips,",len(anim["b"])//1024,"Ko")
socle={}
def socle_js(key,body):
    name="tex/"+key+"."+hashlib.sha1(body.encode("utf-8")).hexdigest()[:8]+".js"
    if not os.path.exists("dist/"+name): open("dist/"+name,"w",encoding="utf-8").write(body)
    socle[key]=name
socle_js("socle-ui","(function(s){s.setProperty('--key-art',"+json.dumps("url("+data_uri("assets/menu-bg.webp")+")")+");s.setProperty('--logo',"+json.dumps("url("+data_uri("assets/logo.webp")+")")+")})(document.documentElement.style);\n")
tissus={k:data_uri(f"assets/tenue/{k}.webp") if os.path.exists(f"assets/tenue/{k}.webp") else "" for k in ("tissus","teinte")}
socle_js("socle","window.SOCLE="+json.dumps({"depth":data_uri("assets/menu-depth.webp"),"grain":data_uri(grain) if os.path.exists(grain) else "",**tissus,"anim":anim,
    "rankup":base64.b64encode(open("assets/rankup.mp3","rb").read()).decode("ascii")},separators=(",",":"))+";\n")
# three.js r147 et ses modules d'exemples (assets/vendor/three-r147.js, tools/vendor.py) : même emballage, chargé juste avant le code du jeu
three=open("assets/vendor/three-r147.js",encoding="utf-8").read()
if "</script" in three.lower(): raise SystemExit("assets/vendor/three-r147.js contient </script")
socle_js("three",three)
print("socle :",", ".join(f"{n} ({os.path.getsize('dist/'+n)//1024} Ko)" for n in socle.values()))
for f in glob.glob("dist/tex/*.js"):
    if "tex/"+os.path.basename(f) not in list(packs.values())+list(socle.values()): os.remove(f) # versions précédentes
print("textures photo :",len(packs),"fichiers dans dist/tex,",sum(os.path.getsize("dist/"+n) for n in packs.values())//1024,"Ko")
# Sons enregistrés (assets/sfx/<paquet>/*.mp3 et meta.json, produits par tools/build_sfx.py) : comme les textures, un petit script
# par paquet à côté de la page, dist/sfx/<paquet>.<condensat>.js, qui appelle sfxPack(clé, données) (voir src/05a-sfx.js) ; le jeu
# charge les paquets communs au démarrage du son et l'ambiance d'une carte au lancement de cette carte. Sans eux : sons synthétisés.
sfx={}
os.makedirs("dist/sfx",exist_ok=True)
for d in sorted(glob.glob("assets/sfx/*/")):
    key=os.path.basename(os.path.normpath(d)); mp=os.path.join(d,"meta.json")
    if not os.path.exists(mp): raise SystemExit(f"assets/sfx/{key} : meta.json manquant (python3 tools/build_sfx.py)")
    meta=json.load(open(mp,encoding="utf-8")); s={}
    for f in sorted(glob.glob(os.path.join(d,"*.mp3"))):
        sid=os.path.splitext(os.path.basename(f))[0]
        if sid not in meta["s"]: raise SystemExit(f"assets/sfx/{key}/{sid}.mp3 absent de meta.json")
        s[sid]=meta["s"][sid]+[base64.b64encode(open(f,"rb").read()).decode("ascii")]
    if not s: continue
    body="sfxPack("+json.dumps(key)+","+json.dumps({"rate":meta["rate"],"s":s},separators=(",",":"))+");\n"
    name="sfx/"+key+"."+hashlib.sha1(body.encode("utf-8")).hexdigest()[:8]+".js"
    sfx[key]=name
    if not os.path.exists("dist/"+name): open("dist/"+name,"w",encoding="utf-8").write(body)
for f in glob.glob("dist/sfx/*.js"):
    if "sfx/"+os.path.basename(f) not in sfx.values(): os.remove(f)
print("sons :",len(sfx),"paquets dans dist/sfx,",sum(os.path.getsize("dist/"+n) for n in sfx.values())//1024,"Ko")
# Illustrations des cartes pour les menus (assets/maps/<id>.webp, node tools/dev/illustrations.js) : comme les textures,
# un fichier à côté de la page, dist/maps/<id>.<condensat>.webp, en cache indéfiniment ; une carte de plus n'alourdit pas la page.
art={}
os.makedirs("dist/maps",exist_ok=True)
for f in sorted(glob.glob("assets/maps/*.webp")):
    key=os.path.splitext(os.path.basename(f))[0]; data=open(f,"rb").read()
    name="maps/"+key+"."+hashlib.sha1(data).hexdigest()[:8]+".webp"
    art[key]=name
    if not os.path.exists("dist/"+name): open("dist/"+name,"wb").write(data)
for f in glob.glob("dist/maps/*.webp"):
    if "maps/"+os.path.basename(f) not in art.values(): os.remove(f)
print("illustrations des cartes :",", ".join(f"{k} ({os.path.getsize('dist/'+v)//1024} Ko)" for k,v in art.items()) or "aucune")
# Dictionnaire anglais (i18n/en.txt, voir src/00-i18n.js) : clé française, traduction
en_dict,en_errs=i18n.load_en()
if en_errs: raise SystemExit("i18n/en.txt :\n  "+"\n  ".join(en_errs))
print("dictionnaire anglais :",len(en_dict),"entrées")
for mark,val in (("/*__I18N_EN__*/ {}",json.dumps(en_dict,ensure_ascii=False,separators=(",",":")).replace("<","\\u003c")),("/*__TEX_PACKS__*/ {}",json.dumps(packs)),("/*__SFX_PACKS__*/ {}",json.dumps(sfx)),("/*__MAP_ART__*/ {}",json.dumps(art))):
    if js.count(mark)!=1: raise SystemExit("marqueur introuvable ou en double dans src/ : "+mark)
    js=js.replace(mark,val)
# Syntaxe du script assemblé (node --check) : une erreur de syntaxe passait sans bruit, et la page restait blanche au chargement (les outils
# de tools/dev/visual attendaient le menu jusqu'à leur délai). Sautée si node n'est pas installé.
if shutil.which("node"):
    with tempfile.NamedTemporaryFile("w",suffix=".js",delete=False,encoding="utf-8") as tf: tf.write(js); tmp_js=tf.name
    chk=subprocess.run(["node","--check",tmp_js],capture_output=True,text=True); os.unlink(tmp_js)
    if chk.returncode: raise SystemExit("erreur de syntaxe dans le script assemblé (src/) :\n"+"\n".join(chk.stderr.strip().split("\n")[:6]))
    print("syntaxe du script : correcte")
shell=open("shell.html",encoding="utf-8").read()
# Réduction (tools/minif.py) : commentaires et blancs inutiles retirés du script et de la feuille de style, rien de renommé ni de
# réécrit (même arbre syntaxique : node tools/dev/check_minif.js). RIPOSTE_LISIBLE=1 python3 build.py garde le code tel quel, pour
# lire une pile d'appels ou déboguer dans le navigateur ; à ne pas commiter (dist/ suit toujours la construction réduite).
if not os.environ.get("RIPOSTE_LISIBLE"):
    n0=len(js); js=minif.js(js)
    a=shell.index("<style>")+len("<style>"); b=shell.index("</style>",a); n1=b-a
    shell=shell[:a]+minif.css(shell[a:b])+shell[b:]
    print("réduction : script",n0//1024,"Ko ->",len(js)//1024,"Ko, style",n1//1024,"Ko ->",(shell.index("</style>")-a)//1024,"Ko")
else: print("réduction : aucune (RIPOSTE_LISIBLE)")
if shell.count("<!--SOCLE_UI-->")!=1: raise SystemExit("marqueur <!--SOCLE_UI--> introuvable ou en double dans shell.html")
if re.search(r"</script",js,re.I): raise SystemExit("le code du jeu contient </script : il fermerait la balise qui le porte")
html=shell.replace("<!--SOCLE_UI-->",'<script src="'+socle["socle-ui"]+'"></script>').replace("<!--SCRIPTS-->", '<script src="'+socle["socle"]+'"></script>\n<script src="'+socle["three"]+'"></script>'+tags+"\n<script>\n"+js+"\n</script>")
# Icône du jeu (assets/icon/) : le favicon est intégré à la page (il marche aussi hors ligne), les autres tailles sont des fichiers à côté
# du HTML, dist/icons/<nom>.<condensat>.png, en cache indéfiniment (icône d'écran d'accueil, onglets épinglés, manifeste).
icons={}
os.makedirs("dist/icons",exist_ok=True)
for f in sorted(glob.glob("assets/icon/*.png")):
    key=os.path.splitext(os.path.basename(f))[0]; data=open(f,"rb").read()
    icons[key]="icons/"+key+"."+hashlib.sha1(data).hexdigest()[:8]+".png"
    if not os.path.exists("dist/"+icons[key]): open("dist/"+icons[key],"wb").write(data)
for f in glob.glob("dist/icons/*.png"):
    if "icons/"+os.path.basename(f) not in icons.values(): os.remove(f)
for k in ("favicon-64","favicon-96","apple-touch-icon","icon-192","icon-512"):
    if k not in icons: raise SystemExit("icône manquante : assets/icon/"+k+".png")
# Aperçu des liens partagés (balises og: de shell.html) : assets/apercu.jpg (composée par tools/dev/apercu.py), copiée comme les icônes avec
# une empreinte (cache indéfini). SITE est l'adresse publique de référence du jeu (lien canonique, og:url, og:image) : les autres
# adresses (sans www, préversions, anciennes adresses .vercel.app) y renvoient ou n'ont pas à être référencées.
SITE="https://www.playriposte.com"
data=open("assets/apercu.jpg","rb").read(); apercu="icons/apercu."+hashlib.sha1(data).hexdigest()[:8]+".jpg"
if not os.path.exists("dist/"+apercu): open("dist/"+apercu,"wb").write(data)
for f in glob.glob("dist/icons/apercu.*.jpg"):
    if "icons/"+os.path.basename(f)!=apercu: os.remove(f)
html=html.replace("__SITE__",SITE).replace("__APERCU__",apercu)
# Manifeste de l'application installable (Android : « Ajouter à l'écran d'accueil » ouvre le jeu en plein écran, en paysage, sans barre d'adresse)
for k in ("maskable-192","maskable-512"):
    if k not in icons: raise SystemExit("icône manquante : assets/icon/"+k+".png")
json.dump({"id":"/","name":"Riposte: Frontline","short_name":"Riposte","description":"FPS en ligne dans le navigateur : solo contre des bots ou en ligne entre amis.",
    "start_url":"./","scope":"./","display":"fullscreen","display_override":["fullscreen","standalone"],"orientation":"landscape","categories":["games"],
    "background_color":"#0E110D","theme_color":"#0E110D","prefer_related_applications":False,
    "icons":[{"src":icons["icon-192"],"sizes":"192x192","type":"image/png","purpose":"any"},{"src":icons["icon-512"],"sizes":"512x512","type":"image/png","purpose":"any"},
             {"src":icons["maskable-192"],"sizes":"192x192","type":"image/png","purpose":"maskable"},{"src":icons["maskable-512"],"sizes":"512x512","type":"image/png","purpose":"maskable"}]},
    open("dist/manifest.webmanifest","w",encoding="utf-8"),ensure_ascii=False,indent=1)
# Service worker (assets/pwa/sw.js) : à la racine de dist/ pour couvrir tout le site
shutil.copyfile("assets/pwa/sw.js","dist/sw.js")
# Steam Deck (README « Steam Deck ») : l'installeur et les images du raccourci Steam (python3 tools/dev/deck_art.py), à adresse fixe
# dans dist/deck/ (l'installeur les télécharge par leur nom)
DECK=("installer.sh","jaquette.jpg","capsule.jpg","hero.jpg","logo.png","icone.png")
os.makedirs("dist/deck",exist_ok=True)
for f in glob.glob("dist/deck/*"):
    if os.path.basename(f) not in DECK: os.remove(f)
for f in DECK:
    if not os.path.exists("assets/deck/"+f): raise SystemExit("assets/deck/"+f+" manquant (python3 tools/dev/deck_art.py pour les images)")
    shutil.copyfile("assets/deck/"+f,"dist/deck/"+f)
shutil.copyfile("assets/icon/favicon.ico","dist/favicon.ico")  # /favicon.ico : chemin par défaut que les moteurs de recherche essaient
html=html.replace("__ICON_FAVICON96__",icons["favicon-96"]).replace("__ICON_FAVICON__",data_uri("assets/icon/favicon-64.png")).replace("__ICON_APPLE__",icons["apple-touch-icon"])
print("icônes :",", ".join(icons))
# Journal des mises à jour : du plus récent au plus ancien ; chaque publication en production y ajoute une entrée (voir README)
log=json.load(open("changelog.json",encoding="utf-8"))
def vkey(v): return tuple(int(x) for x in v.split("."))
if not isinstance(log,list) or not log: raise SystemExit("changelog.json : liste non vide attendue")
for i,e in enumerate(log):
    if not re.fullmatch(r"\d+\.\d+\.\d+",str(e.get("version",""))): raise SystemExit(f"changelog.json : version invalide (entrée {i+1})")
    try: datetime.date.fromisoformat(e.get("date",""))
    except ValueError: raise SystemExit(f"changelog.json : date invalide pour {e['version']} (AAAA-MM-JJ attendu)")
    # un titre n'existe que pour une grande version (X.0.0, annoncée en plein écran) ; les autres entrées n'ont que leur numéro et leur liste
    major=bool(re.fullmatch(r"\d+\.0\.0",e["version"]))
    if major and not str(e.get("title","")).strip(): raise SystemExit(f"changelog.json : titre manquant pour la grande version {e['version']}")
    if str(e.get("title","")).strip() and not str(e.get("title_en","")).strip(): raise SystemExit(f"changelog.json : titre anglais (title_en) manquant pour {e['version']}")
    if not e.get("changes"): raise SystemExit(f"changelog.json : aucun changement pour {e['version']}")
    for c in e["changes"]:
        if c.get("t") not in ("new","improved","fixed") or not str(c.get("x","")).strip(): raise SystemExit(f"changelog.json : changement invalide pour {e['version']} (t : new, improved ou fixed)")
        if not str(c.get("x_en","")).strip(): raise SystemExit(f"changelog.json : texte anglais (x_en) manquant pour {e['version']}")
    if i and vkey(log[i-1]["version"])<=vkey(e["version"]): raise SystemExit(f"changelog.json : versions à ranger de la plus récente à la plus ancienne ({e['version']})")
html=html.replace("__CHANGELOG__",json.dumps(log,ensure_ascii=False,separators=(",",":")).replace("<","\\u003c"))
print("version :",log[0]["version"])
# Référencement (README « Référencement ») : la fiche structurée de shell.html doit rester un JSON valide (sinon les moteurs l'ignorent
# sans rien dire) ; robots.txt et sitemap.xml sont servis tels quels (exclus de la réécriture vers la page dans vercel.json).
# Les préversions de Vercel portent d'elles-mêmes « X-Robots-Tag: noindex » : seule l'adresse SITE est référencée.
for bloc in re.findall(r'<script type="application/ld\+json">(.*?)</script>',html,re.S): json.loads(bloc)
open("dist/robots.txt","w",encoding="utf-8").write("User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: "+SITE+"/sitemap.xml\n")
open("dist/sitemap.xml","w",encoding="utf-8").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    '  <url><loc>'+SITE+'/</loc><lastmod>'+log[0]["date"]+'</lastmod></url>\n</urlset>\n')
html=html.replace('<meta name="cod-relay" content="">','<meta name="cod-relay" content="'+_html.escape(relay,quote=True)+'">')
print("salons en ligne :",("tout par le serveur de jeu, "+relay) if relay else "pair à pair (PeerJS), sans relais")
# Musique des menus : dist/menu-theme.mp3 est livré à côté du HTML (pas embarqué) ; l'adresse porte un condensat pour le cache. Absent : pas de musique.
music=""
if os.path.exists("dist/menu-theme.mp3"):
    music="menu-theme.mp3?v="+hashlib.sha1(open("dist/menu-theme.mp3","rb").read()).hexdigest()[:8]
html=html.replace("__MENU_MUSIC__",music)
print("musique des menus :",music or "aucune")
# Identifiant de version : condensat de la page elle-même (marqueur compris), inscrit dans la page et dans dist/version.json.
# Le jeu compare les deux pour se recharger quand une nouvelle version est en ligne (voir src/09h-update.js et vercel.json).
build_id=hashlib.sha1(html.encode("utf-8")).hexdigest()[:12]
html=html.replace("__BUILD_ID__",build_id)
print("identifiant de version :",build_id)
# Politique de sécurité du contenu (CSP, balise meta en tête : elle suit chaque construction) : scripts du site seulement, plus les
# scripts en ligne de la page désignés par leur empreinte ; un script glissé dans la page par une faille (attribut onerror, balise
# injectée) ne s'exécute pas, et les données ne partent que vers le site et le serveur de jeu. frame-ancestors et X-Frame-Options ne
# valent qu'en en-tête : vercel.json. Les attributs style="" des gabarits demandent 'unsafe-inline' pour les styles (sans risque d'exécution).
inline=re.findall(r"<script>(.*?)</script>",html,re.S)
if len(inline)<2: raise SystemExit("CSP : scripts en ligne attendus (code du jeu, Vercel Analytics)")
sha=" ".join("'sha256-"+base64.b64encode(hashlib.sha256(x.encode("utf-8")).digest()).decode("ascii")+"'" for x in inline)
if relay:
    host=re.match(r"wss?://([^/]+)",relay).group(1); net="https://"+host+" wss://"+host
    peer=""
else: net="https://*.peerjs.com wss://*.peerjs.com stun: turn:"; peer=" https://cdn.jsdelivr.net/npm/peerjs@1.5.5/"
csp=("default-src 'self'; script-src 'self' "+sha+peer+"; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
     "font-src https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self' "+net+"; "
     "manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'")
if html.count('<meta charset="utf-8">')!=1: raise SystemExit("shell.html : <meta charset=\"utf-8\"> attendu une fois")
html=html.replace('<meta charset="utf-8">','<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="'+csp+'">')
print("CSP :",len(inline),"scripts en ligne,",("relais "+host) if relay else "PeerJS")
os.makedirs("dist", exist_ok=True)
open("dist/riposte-frontline.html","w",encoding="utf-8").write(html)
with open("dist/version.json","w",encoding="utf-8") as f: f.write(json.dumps({"build":build_id,"version":log[0]["version"]})+"\n")
# Serveur de jeu (serveur/, voir serveur/README.md) : son code est publié avec le jeu dans dist/serveur/ (le serveur s'y met à
# jour seul, riposte-maj), et serveur/installer.sh, le script à coller à la création du serveur, est refait ici : il embarque
# le même code. Version : condensat des fichiers. Absent (copie publique du code,
# README « Code source public ») : le jeu se construit sans lui.
def serveur_de_jeu():
    SRV=("relais.js","package.json","package-lock.json")
    srv={f:open("serveur/"+f,"rb").read() for f in SRV}
    # les salons permanents du serveur font tourner les cartes du jeu : sa liste (CARTES) doit être celle des cartes jouables (MAPS, src/02-map.js)
    cartes_jeu=re.findall(r"\{ id: '([a-z0-9_-]+)'[^\n]*\bok: true",open("src/02-map.js",encoding="utf-8").read())
    m_cartes=re.search(r"const CARTES = \[([^\]]*)\]",srv["relais.js"].decode())
    if not m_cartes or re.findall(r"'([a-z0-9_-]+)'",m_cartes.group(1))!=cartes_jeu: raise SystemExit("serveur/relais.js : CARTES doit lister les cartes jouables de src/02-map.js, dans l'ordre : "+", ".join(cartes_jeu))
    srv_ver=hashlib.sha256(b"".join(f.encode()+b"\0"+srv[f]+b"\0" for f in SRV)).hexdigest()[:12]
    os.makedirs("dist/serveur",exist_ok=True)
    for f in glob.glob("dist/serveur/*"):
        if os.path.basename(f) not in SRV+("version.json",): os.remove(f)
    for f in SRV: open("dist/serveur/"+f,"wb").write(srv[f])
    with open("dist/serveur/version.json","w",encoding="utf-8") as fh:
        fh.write(json.dumps({"version":srv_ver,"fichiers":{f:hashlib.sha256(srv[f]).hexdigest() for f in SRV}},indent=1)+"\n")
    inst=open("serveur/installer.in.sh",encoding="utf-8").read()
    # relais.js réduit (tools/minif.py : commentaires et blancs ôtés, rien d'autre), compressé (gzip sans date) puis en base64 sur une ligne :
    # le script tient dans les 32 Ko de « Cloud config ». Le serveur installé tourne sur cette copie réduite, le même code, jusqu'à la mise
    # à jour suivante (riposte-maj prend alors le fichier publié tel quel) ; empreintes vérifiées sur le serveur
    import gzip,subprocess,tempfile
    relais_min=minif.js(srv["relais.js"].decode("utf-8")).encode("utf-8")
    with tempfile.NamedTemporaryFile("wb",suffix=".js",delete=False) as fh: fh.write(relais_min)
    try:
        if shutil.which("node") and subprocess.run(["node","--check",fh.name],capture_output=True).returncode: raise SystemExit("serveur/relais.js réduit pour installer.sh : syntaxe refusée par node --check")
    finally: os.remove(fh.name)
    gz=base64.b64encode(gzip.compress(relais_min,compresslevel=9,mtime=0)).decode("ascii")
    ecrit=lambda f: open("serveur/"+f,"rb").read().rstrip(b"\n")+b"\n" # ce qu'écrit un bloc « cat <<'FIN' » du script
    sommes="\n".join(f"{hashlib.sha256(relais_min if f=='relais.js' else ecrit(f)).hexdigest()}  /opt/riposte/neuf/{f}" for f in SRV)
    for mark,val in (("__RELAIS_JS_GZ__",gz),("__SOMMES__",sommes)):
        if inst.count(mark)!=1: raise SystemExit("marqueur introuvable ou en double dans serveur/installer.in.sh : "+mark)
        inst=inst.replace(mark,val)
    for mark,f in (("__PACKAGE_JSON__","serveur/package.json"),("__PACKAGE_LOCK_JSON__","serveur/package-lock.json"),("__RIPOSTE_MAJ__","serveur/riposte-maj.sh"),("__RIPOSTE_CADDY__","serveur/riposte-caddy.sh")):
        body=open(f,encoding="utf-8").read().rstrip("\n")
        if "\nFIN_DU_FICHIER\n" in "\n"+body+"\n": raise SystemExit(f+" contient la ligne FIN_DU_FICHIER, qui termine son bloc dans installer.sh")
        if inst.count(mark)!=1: raise SystemExit("marqueur introuvable ou en double dans serveur/installer.in.sh : "+mark)
        inst=inst.replace(mark,body)
    inst=inst.replace("__VERSION__",srv_ver).replace("# __AVERTISSEMENT__","# Fichier produit par build.py (modèle : serveur/installer.in.sh, code : serveur/) : ne pas le modifier à la main.")
    with open("serveur/installer.sh","w",encoding="utf-8",newline="\n") as fh: fh.write(inst)
    print("serveur de jeu : version",srv_ver,"(dist/serveur/, serveur/installer.sh,",len(inst.encode())//1024,"Ko)")
    if len(inst.encode())>32*1024: raise SystemExit("serveur/installer.sh dépasse 32 Ko, la taille maximale du champ « Cloud config » de Hetzner")
if os.path.isdir("serveur"): serveur_de_jeu()
bad=[(i+1) for i,l in enumerate(html.split("\n")) if re.search("[\u2013\u2014\u2015]",l)]
if "[Nom ou raison sociale" in html: print("ATTENTION : mentions légales à compléter (src/09k-legal.js : LEGAL.name, address, email) avant la mise en production")
print("taille",len(html),"lignes avec tirets interdits:",bad)
# style des textes vus par le joueur (tools/dev/check_texte.py, README « Style des textes ») : le build échoue au moindre écart
import sys as _sys
_sys.path.insert(0,"tools/dev")
import check_texte
style=check_texte.controle()
for e in style: print("style :",e)
if style: raise SystemExit(f"{len(style)} problème(s) de style dans les textes du joueur (python3 tools/dev/check_texte.py, README « Style des textes »)")
print("style des textes : rien à signaler")
# liste des assets (docs/assets.md, tools/dev/assets.py) : refaite à chaque construction à partir du code, elle le suit sans qu'on y pense
import assets as _assets
_res,_dbl=_assets.ecrire()
print("liste des assets :",_res)
for _k,_v in _dbl.items(): print(f"ATTENTION : prefab défini deux fois, PF.{_k} ({', '.join(_v)}) : la dernière définition remplace l'autre")
