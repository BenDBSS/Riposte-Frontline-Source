"""Extrait les clés de traduction de src/*.js : textes passés à _t('...') et à _tn(n, '...', '...').
Utilisé par check_i18n.py ; en ligne de commande, liste « fichier:ligne<TAB>clé »."""
import re,glob,os,sys
FRW=re.compile(r"[àâäçéèêëîïôöùûüœÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŒ]|\b(le|la|les|un|une|des|du|de|et|ou|vous|votre|vos|sur|pour|avec|dans|est|pas|plus|par|au|aux|ce|cette|qui|que|en|se|sa|son|ses|il|elle|nous|ne)\b",re.I)
def js_unescape(raw):
    out=[];i=0
    while i<len(raw):
        c=raw[i]
        if c=='\\':
            d=raw[i+1]
            if d=='u':
                if raw[i+2]=='{': e=raw.index('}',i); out.append(chr(int(raw[i+3:e],16))); i=e+1; continue
                out.append(chr(int(raw[i+2:i+6],16))); i+=6; continue
            if d=='x': out.append(chr(int(raw[i+2:i+4],16))); i+=4; continue
            out.append({'n':'\n','t':'\t','r':'\r','0':'\0'}.get(d,d)); i+=2; continue
        out.append(c); i+=1
    return ''.join(out)
def skip_string(src,i):
    c=src[i]; j=i+1; n=len(src)
    while j<n and src[j]!=c:
        if src[j]=='\\': j+=1
        j+=1
    return j+1
def skip_template(src,i):
    n=len(src); j=i+1
    while j<n:
        ch=src[j]
        if ch=='\\': j+=2; continue
        if ch=='`': return j+1
        if ch=='$' and src[j+1:j+2]=='{':
            j+=2; d=1
            while j<n and d>0:
                c2=src[j]
                if c2 in '\'"': j=skip_string(src,j); continue
                if c2=='`': j=skip_template(src,j); continue
                if c2=='{': d+=1
                elif c2=='}': d-=1
                j+=1
            continue
        j+=1
    return n
def regex_start(src,i):
    k=i-1
    while k>=0 and src[k] in ' \t': k-=1
    pc=src[k] if k>=0 else ''
    return pc in '(,=:[!&|?{};' or src[max(0,k-5):k+1].strip().endswith(('return','typeof'))
def literals(src):
    """(début, fin, valeur, genre) de chaque chaîne entre apostrophes ou guillemets, hors commentaires et expressions rationnelles"""
    i=0;n=len(src);res=[]
    while i<n:
        c=src[i]
        if c=='/' and src[i+1:i+2]=='/': j=src.find('\n',i); i=n if j<0 else j; continue
        if c=='/' and src[i+1:i+2]=='*': j=src.find('*/',i+2); i=n if j<0 else j+2; continue
        if c in '\'"':
            j=skip_string(src,i); res.append((i,j,js_unescape(src[i+1:j-1]),'s')); i=j; continue
        if c=='`':
            # modèle : les chaînes de ses expressions sont aussi des littéraux
            j=skip_template(src,i); k=i+1
            while k<j-1:
                if src[k]=='\\': k+=2; continue
                if src[k]=='$' and src[k+1:k+2]=='{':
                    d=1; st=k+2; k=st
                    while k<j and d>0:
                        c2=src[k]
                        if c2 in '\'"': k=skip_string(src,k); continue
                        if c2=='`': k=skip_template(src,k); continue
                        if c2=='{': d+=1
                        elif c2=='}': d-=1
                        k+=1
                    for (a,b,v,g) in literals(src[st:k-1]): res.append((st+a,st+b,v,g))
                    continue
                k+=1
            i=j; continue
        if c=='/' and regex_start(src,i):
            k=i+1; incls=False
            while k<n:
                if src[k]=='\\': k+=2; continue
                if src[k]=='[': incls=True
                elif src[k]==']': incls=False
                elif src[k]=='/' and not incls: break
                elif src[k]=='\n': break
                k+=1
            i=k+1; continue
        i+=1
    return res
CALL=re.compile(r"\b_t\(\s*$|\b_tn\(\s*[^,()]*(?:\([^()]*\))?[^,()]*,\s*$|\b_tn\(\s*[^,()]*(?:\([^()]*\))?[^,()]*,\s*'(?:[^'\\]|\\.)*',\s*$")
def keys_of(src):
    """liste (ligne, clé) des textes passés à _t / _tn"""
    out=[]
    for a,b,v,g in sorted(literals(src)):
        pre=src[max(0,a-200):a]
        if CALL.search(pre): out.append((src.count('\n',0,a)+1,v))
    return out
def all_keys(root='.'):
    d={}
    for f in sorted(glob.glob(os.path.join(root,'src','*.js'))):
        if os.path.basename(f).startswith('00-i18n'): continue
        for ln,k in keys_of(open(f,encoding='utf-8').read()): d.setdefault(k,[]).append(os.path.basename(f)+':'+str(ln))
    return d
if __name__=='__main__':
    d=all_keys()
    for k,w in d.items(): print(w[0]+'\t'+k.replace('\n','\\n'))

def shell_keys(root='.'):
    """Textes statiques de shell.html (nœuds de texte et attributs aria-label, placeholder, title, alt), traduits à l'exécution par i18nDom"""
    from html.parser import HTMLParser
    out={}
    class P(HTMLParser):
        def __init__(s): super().__init__(convert_charrefs=True); s.skip=0; s.stack=[]
        def handle_starttag(s,tag,attrs):
            if tag in ('script','style'): s.skip+=1
            for k,v in attrs:
                if k in ('aria-label','placeholder','title','alt') and v and re.search(r"[A-Za-zÀ-ÿ]{3,}",v): out.setdefault(v.strip(),'attr')
        def handle_endtag(s,tag):
            if tag in ('script','style') and s.skip: s.skip-=1
        def handle_data(s,d):
            if s.skip: return
            v=d.strip()
            if v and re.search(r"[A-Za-zÀ-ÿ]{3,}",v): out.setdefault(re.sub(r"\s+"," ",v),'text')
    P().feed(open(os.path.join(root,'shell.html'),encoding='utf-8').read())
    return out

def template_static(src,i):
    """texte statique d'un modèle commençant en src[i] (les expressions ${...} en sont retirées) et position de fin"""
    n=len(src); j=i+1; out=[]
    while j<n:
        ch=src[j]
        if ch=='\\': out.append(src[j:j+2]); j+=2; continue
        if ch=='`': return ''.join(out),j+1
        if ch=='$' and src[j+1:j+2]=='{':
            out.append(' ')
            j+=2; d=1
            while j<n and d>0:
                c2=src[j]
                if c2 in '\'"': j=skip_string(src,j); continue
                if c2=='`': j=skip_template(src,j); continue
                if c2=='{': d+=1
                elif c2=='}': d-=1
                j+=1
            continue
        out.append(ch); j+=1
    return ''.join(out),n

def templates(src,base=0):
    """tous les modèles de src, imbriqués compris : (position, texte statique, début de ce qui précède)"""
    out=[]; i=0; n=len(src)
    while i<n:
        c=src[i]
        if c=='/' and src[i+1:i+2]=='/': j=src.find('\n',i); i=n if j<0 else j; continue
        if c=='/' and src[i+1:i+2]=='*': j=src.find('*/',i+2); i=n if j<0 else j+2; continue
        if c in '\'"': i=skip_string(src,i); continue
        if c=='`':
            j=skip_template(src,i); st=[]; k=i+1
            while k<j-1:
                if src[k]=='\\': st.append(src[k:k+2]); k+=2; continue
                if src[k]=='$' and src[k+1:k+2]=='{':
                    d=1; s0=k+2; k=s0
                    while k<j and d>0:
                        c2=src[k]
                        if c2 in '\'"': k=skip_string(src,k); continue
                        if c2=='`': k=skip_template(src,k); continue
                        if c2=='{': d+=1
                        elif c2=='}': d-=1
                        k+=1
                    for (p,s,pre) in templates(src[s0:k-1],base+s0): out.append((p,s,pre))
                    st.append(' '); continue
                st.append(src[k]); k+=1
            out.append((base+i,''.join(st),src[max(0,i-200):i])); i=j; continue
        i+=1
    return out
