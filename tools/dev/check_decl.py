"""Signale les déclarations de premier niveau (const, let, class, function) en double dans src/ : tous les
modules sont concaténés dans un seul script, une seconde déclaration casserait le chargement ou en remplacerait une autre.
api/_lib/filtre.js y est joint aussi (build.py le met dans le jeu, sans ses « export »)."""
import re, glob, collections, sys
names = collections.defaultdict(list)
for f in sorted(glob.glob('src/*.js')) + ['api/_lib/filtre.js']:
    for i, l in enumerate(open(f, encoding='utf-8')):
        l = re.sub(r'^export ', '', l)
        m = re.match(r'^(?:const|let|var)\s+(.*)', l)
        if m:
            depth, cur, parts = 0, '', []
            for ch in m.group(1):
                if ch in '([{': depth += 1
                elif ch in ')]}': depth -= 1
                if ch == ',' and depth == 0: parts.append(cur); cur = ''
                else: cur += ch
            parts.append(cur)
            for p in parts:
                mm = re.match(r'\s*([A-Za-z_$][\w$]*)\s*(=|$|;)', p)
                if mm: names[mm.group(1)].append(f'{f}:{i + 1}')
        m = re.match(r'^(?:async\s+)?(?:function|class)\s+([\w$]+)', l)
        if m: names[m.group(1)].append(f'{f}:{i + 1}')
dup = {k: v for k, v in names.items() if len(v) > 1}
for k, v in dup.items(): print('en double :', k, v)
sys.exit(1 if dup else 0)
