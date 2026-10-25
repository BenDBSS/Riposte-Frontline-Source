#!/usr/bin/env python3
"""Contrôle du style des textes vus par le joueur : python3 tools/dev/check_texte.py
Chasse les tournures qui sonnent « écrites par une IA » (règles : CLAUDE.md et README, « Style des textes »). Sont contrôlés les
textes passés à _t() / _tn() dans src/, le texte de shell.html, les entrées de changelog.json et les traductions de i18n/en.txt.
Sortie 0 si tout va bien, 1 sinon. build.py l'appelle aussi."""
import json,os,re,sys
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')
sys.path.insert(0,os.path.join(ROOT,'tools')); sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import i18n,i18n_keys as K
os.chdir(ROOT)

# (nom, expression, conseil)
SIGNES=[
 ('tiret cadratin ou demi-cadratin', r"[\u2013\u2014\u2015]", "virgule, point ou parenthèses"),
 ('points de suspension en un seul caractère', r"\u2026", "trois points ASCII (...)"),
 ('guillemets ou apostrophe typographiques', r"[\u2018\u2019\u201c\u201d\u00ab\u00bb]", "guillemets droits \" \" et apostrophe droite '"),
 ('flèche', r"[\u2190-\u21ff\u27a1\u2794\u279c\u25b6\u25ba]", "un verbe ou une virgule"),
 ('symbole ou émoji', r"[\u2248\u2260\u00d7\u2713\u2714\u2705\u274c\u2b50\u26a0\u2728\U0001f300-\U0001faff\u2600-\u27bf\ufe0f]", "écrire en lettres (x pour une dimension)"),
 ('mise en forme Markdown', r"\*\*|`|^#+\s|^[-*]\s|^---", "du texte simple"),
 ('formule d\'introduction ou de conclusion', r"^Voici\b|^Here (is|are)\b|\bEn résumé\b|\bEn conclusion\b|\bIn (summary|conclusion)\b|\bil est important de noter\b|\bit is (important|worth) (to note|noting)\b", "dire la chose directement"),
 ('\u00ab Ce n\'est pas X, c\'est Y \u00bb', r"\bce n.est pas\b[^.]{0,80}\bc.est\b|\bit.s not\b[^.]{0,80}\bit.s\b|\bnot just\b[^.]{0,60}\bbut\b", "dire seulement Y"),
 ('mot à la mode', r"\b(plonger? dans|plongez dans|crucial\w*|essentiel(le)?s?|tiss(er|e|ons|ez|ent|ant)|levier\w*|robuste\w*|fluid\w+|seamless\w*|delve\w*|tapestry|leverage\w*|robust|unlock the power|game.?changer|redéfin\w+|incontournable\w*|immersi\w+)\b", "un mot simple et précis"),
]
# Contrôlées seulement sur les textes récents (les anciennes entrées du journal sont de l'histoire)
TOURNURES=('mot à la mode','formule d\'introduction ou de conclusion','« Ce n\'est pas X, c\'est Y »')
def lisibles():
    """(origine, texte) de chaque texte vu par le joueur"""
    keys=K.all_keys()
    for k,w in keys.items(): yield w[0],k
    for k in K.shell_keys(): yield 'shell.html',k
    # messages d'erreur de l'API (api/_lib/i18n.js : français, puis anglais ; absents de la copie publique du code)
    for m in re.finditer(r"^  '((?:[^'\\]|\\.)*)':\s*'((?:[^'\\]|\\.)*)'",open('api/_lib/i18n.js',encoding='utf-8').read() if os.path.exists('api/_lib/i18n.js') else '',re.M):
        yield 'api/_lib/i18n.js',K.js_unescape(m.group(1)); yield 'api/_lib/i18n.js',K.js_unescape(m.group(2))
    en,_=i18n.load_en()
    for k,v in en.items(): yield (keys[k][0] if k in keys else 'shell.html'),v
    # journal : les caractères sont contrôlés partout, le reste (ponctuation, mots) seulement sur l'entrée la plus récente,
    # les anciennes sont de l'histoire (marquées « ancien »)
    for i,e in enumerate(json.load(open('changelog.json',encoding='utf-8'))):
        o='changelog.json '+e['version']+('' if i==0 else ' (ancien)')
        for f in ('title','title_en'):
            if e.get(f): yield o,e[f]
        for c in e.get('changes',[]):
            for f in ('x','x_en'):
                if c.get(f): yield o,c[f]
def sans_balises(s): return re.sub(r"<[^>]*>"," ",s)
# Le mot « paysage » (orientation de l'écran) et « expérience » (XP) sont de l'usage courant ici : ils ne sont pas dans la liste.
# Mentions légales : leur ponctuation de liste (deux-points, point-virgule) est de rigueur.
LEGAL=('09k-legal.js',)
def deux_points_explicatif(s):
    """un deux-points qui suit une proposition (3 mots ou plus) et précède une minuscule : une explication, pas une étiquette
    (une suite d'étiquettes, « Haut : UAV, droite : frappe aérienne... », n'en est pas une)"""
    if s.count(':')>=3: return False
    s=sans_balises(s)
    for m in re.finditer(r"([^.!?:;]*?)\s?:\s+(?=[a-zà-ÿ])",s):
        if s[:m.end(1)].count('(')>s[:m.end(1)].count(')'): continue   # « (Retour arrière : remettre... ) » : une étiquette entre parenthèses
        avant=re.sub(r"\{\d+\}","X",m.group(1)).strip()
        if len(avant.split())>=3: return True
    return False
def controle():
    errs=[];vus=set()
    for orig,s in lisibles():
        t=sans_balises(s)
        ancien=orig.endswith('(ancien)')
        for nom,p,conseil in SIGNES:
            if ancien and nom in TOURNURES: continue
            if re.search(p,t,re.I|re.M):
                a=(orig,nom,s)
                if a not in vus: vus.add(a); errs.append(f"{nom} : {orig} {s[:90]!r} (préférer : {conseil})")
        if not orig.startswith(LEGAL) and not ancien:
            if ';' in t.replace('&amp;','').replace('&nbsp;',''):
                errs.append(f"point-virgule : {orig} {s[:90]!r} (préférer : un point ou une virgule)")
            if deux_points_explicatif(t):
                errs.append(f"deux-points qui introduit une explication : {orig} {s[:90]!r} (préférer : un point ou une virgule)")
    return errs
if __name__=='__main__':
    errs=controle()
    for e in errs: print('erreur :',e)
    print(f"{len(errs)} problème(s) de style" if errs else "style des textes : rien à signaler")
    sys.exit(1 if errs else 0)
