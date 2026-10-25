"""Réduction du code de la page (build.py) : retire les commentaires et les blancs inutiles du script et de la feuille de style,
sans rien renommer ni réécrire. Le code reste le même, jeton pour jeton, à l'octet près dans les chaînes, les gabarits `...`
(shaders GLSL, HTML) et les expressions régulières.

Script : découpé en jetons (chaînes, gabarits avec leurs ${...} imbriqués, expressions régulières distinguées de la division
par le jeton qui précède). Entre deux jetons, on n'écrit rien, une espace quand les deux se colleraient en un autre jeton
(deux mots, « + + », « / / »...), ou un saut de ligne quand l'original en avait un et que l'insertion automatique des
points-virgules pourrait en dépendre (après return, après une accolade fermante, avant un mot...). Dans le doute, le saut de
ligne reste : il ne coûte qu'un octet.

Contrôle : tools/dev/check_minif.js compare l'arbre syntaxique du script avant et après (terser, outil de développement)."""
import re

_WS = r"[ \t\f\v ﻿  -   　]"
_NL = "\n\r  "
_TOK = re.compile(r"""
 (?P<ws>(?:[ \t\f\v ﻿  -   　\n\r  ])+)
|(?P<lc>//[^\n\r  ]*)
|(?P<bc>/\*[\s\S]*?\*/)
|(?P<str>'(?:[^'\\\n\r]|\\[\s\S])*'|"(?:[^"\\\n\r]|\\[\s\S])*")
|(?P<num>(?:0[xXbBoO][0-9a-fA-F_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)n?)
|(?P<id>(?:[A-Za-z_$\u0080-￿]|\\u[0-9a-fA-F{])(?:[\w$\u0080-￿]|\\u[0-9a-fA-F{][0-9a-fA-F}]*)*)
|(?P<p>>>>=|\.\.\.|===|!==|\*\*=|<<=|>>=|>>>|&&=|\|\|=|\?\?=|=>|==|!=|<=|>=|&&|\|\||\?\?|\?\.(?!\d)|\+\+|--|\+=|-=|\*=|%=|&=|\|=|\^=|/=|\*\*|<<|>>|[{}()\[\];,<>+\-*/%&|^!~?:=.@#])
""", re.X)
_REGEX = re.compile(r"/(?:[^/\\\[\n\r]|\\.|\[(?:[^\]\\\n\r]|\\.)*\])+/[A-Za-z]*")
# mots après lesquels un « / » ouvre une expression régulière (et pas une division)
_KW_EXPR = {"return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"}
# productions restreintes : un saut de ligne après eux change le sens (return\nx renvoie undefined)
_RESTRICT = {"return", "throw", "break", "continue", "yield", "async", "++", "--"}
# ponctuations après lesquelles l'instruction continue forcément : le saut de ligne qui suit ne sert à rien
_NL_PREV = {"{", "(", "[", ",", ";", ":", "?", "=", "==", "===", "!=", "!==", "<", ">", "<=", ">=", "+", "-", "*", "/", "%", "**",
            "&", "|", "^", "!", "~", "&&", "||", "??", "+=", "-=", "*=", "/=", "%=", "**=", "<<=", ">>=", ">>>=", "&=", "|=", "^=",
            "&&=", "||=", "??=", "<<", ">>", ">>>", "=>", ".", "?.", "..."}
# jetons qui ne peuvent que continuer l'instruction en cours (jamais d'insertion de point-virgule devant eux)...
_NL_NEXT = {")", "]", "}", ",", ";", ":", "?", ".", "?.", "(", "[", "=", "==", "===", "!=", "!==", "<", ">", "<=", ">=", "+", "-",
            "*", "/", "%", "**", "&", "|", "^", "&&", "||", "??", "+=", "-=", "*=", "/=", "%=", "**=", "<<=", ">>=", ">>>=", "&=",
            "|=", "^=", "&&=", "||=", "??=", "<<", ">>", ">>>", "=>", "`"}
# ... sauf après l'accolade fermante d'une fonction fléchée (() => {}\n(x) : deux instructions) : là, seuls ceux-ci
_NL_NEXT_BRACE = {")", "]", "}", ",", ";", ":"}


def _word(c):
    return c.isalnum() or c in "_$\\" or ord(c) > 127


class _Tok:
    __slots__ = ("k", "t", "nl", "gap")

    def __init__(self, k, t, nl, gap):
        self.k = k; self.t = t; self.nl = nl; self.gap = gap


def _tokens(src):
    """Jetons significatifs ; chacun note si un blanc ou un commentaire le précède (gap) et s'il contient un saut de ligne (nl)."""
    out = []; i = 0; n = len(src); gap = False; nl = False
    stack = []          # accolades ouvertes : "{" (bloc ou objet) ou "${" (expression d'un gabarit)
    parens = []         # parenthèses ouvertes : mot qui les précède (if, while, for, with : un « / » après la fermante est une regex)
    prev = None         # dernier jeton significatif
    after_ctrl = False  # le dernier jeton est la parenthèse fermante d'un if/while/for/with

    def regex_ok():
        if prev is None: return True
        if prev.k == "p":
            if prev.t in (")",): return after_ctrl
            return prev.t not in ("]", "}", "++", "--")
        if prev.k == "id": return prev.t in _KW_EXPR
        return False

    def template(j):
        """Gabarit qui commence (ou reprend après un ${...}) à j : retourne la fin du morceau et s'il ouvre une expression."""
        while j < n:
            c = src[j]
            if c == "\\": j += 2; continue
            if c == "`": return j + 1, False
            if c == "$" and j + 1 < n and src[j + 1] == "{": return j + 2, True
            j += 1
        raise ValueError("gabarit non fermé")

    while i < n:
        c = src[i]
        if c == "`" or (c == "}" and stack and stack[-1] == "${"):
            if c == "}": stack.pop()
            j, opens = template(i + 1)
            if opens: stack.append("${")
            prev = _Tok("t", src[i:j], nl, gap); out.append(prev); after_ctrl = False
            i = j; gap = nl = False; continue
        if c == "/" and i + 1 < n and src[i + 1] not in "/*" and regex_ok():
            m = _REGEX.match(src, i)
            if not m: raise ValueError(f"expression régulière illisible vers {src[i:i + 40]!r}")
            prev = _Tok("r", m.group(0), nl, gap); out.append(prev); after_ctrl = False
            i = m.end(); gap = nl = False; continue
        m = _TOK.match(src, i)
        if not m: raise ValueError(f"caractère inattendu {c!r} vers {src[max(0, i - 30):i + 30]!r}")
        k = m.lastgroup; t = m.group(0); i = m.end()
        if k in ("ws", "lc", "bc"):
            gap = True
            if k != "lc" and any(ch in _NL for ch in t): nl = True
            continue
        ctrl = False
        if k == "p":
            if t == "{": stack.append("{")
            elif t == "}":
                if stack: stack.pop()
            elif t == "(": parens.append(prev.t if prev is not None and prev.k == "id" else "")
            elif t == ")": ctrl = bool(parens) and parens.pop() in ("if", "while", "for", "with")
        prev = _Tok("p" if k == "p" else ("id" if k == "id" else k), t, nl, gap); out.append(prev); after_ctrl = ctrl
        gap = nl = False
    if stack: raise ValueError("accolades non équilibrées")
    return out


def _sep(a, b):
    """Faut-il un blanc entre a et b pour qu'ils restent deux jetons distincts ?"""
    x = a.t[-1]; y = b.t[0]
    if (_word(x) or a.k == "r") and _word(y): return True
    if a.k == "num" and y == ".": return True
    if (x == "+" and y == "+") or (x == "-" and y == "-"): return True
    if x == "/" and y in "/*": return True        # division suivie d'une regex, ou fin de regex : jamais un commentaire
    if x == "<" and y in "!/": return True         # ni <!-- ni </script
    if x == "-" and y == ">": return True          # ni -->
    return False


def js(src):
    toks = _tokens(src)
    out = []
    prev = None
    for t in toks:
        if prev is not None:
            if t.nl:
                keep = True
                if prev.t not in _RESTRICT:
                    if prev.k == "p" and prev.t in _NL_PREV: keep = False
                    elif t.k == "p" and t.t in (_NL_NEXT_BRACE if prev.t == "}" else _NL_NEXT): keep = False
                    elif t.k == "t" and prev.t != "}": keep = False
                out.append("\n" if keep else (" " if _sep(prev, t) else ""))
            elif t.gap and _sep(prev, t):
                out.append(" ")
            elif not t.gap and _sep(prev, t):
                out.append(" ")  # déjà collés dans l'original : impossible pour deux mots, possible pour « a+ +b » réécrit
        out.append(t.t)
        prev = t
    return "".join(out)


_CSS_TOK = re.compile(r"""(?P<c>/\*[\s\S]*?\*/)|(?P<s>"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*'|url\((?:[^)"'\\]|\\.)*\))|(?P<w>\s+)|(?P<o>[^\s"'/]+?(?=url\(|[\s"'/]|$)|/)""", re.I)


def css(src):
    """Feuille de style : commentaires retirés, blancs réduits à une espace, rien autour de { } ; , > ni après : et ( ni avant ) !,
    pas de ; devant }. Le blanc entre deux mots (sélecteur descendant, valeurs, calc(a + b)) reste."""
    toks = []
    for m in _CSS_TOK.finditer(src):
        k = m.lastgroup
        if k in ("c", "w"):
            if toks and toks[-1][0] != "w": toks.append(("w", " "))
            continue
        toks.append((k, m.group(0)))
    out = []
    for i, (k, t) in enumerate(toks):
        if k == "w":
            a = out[-1][-1] if out else "{"
            b = toks[i + 1][1][0] if i + 1 < len(toks) else "}"
            if a in "{};,>:(" or b in "{};,>)!": continue
            out.append(" "); continue
        if k == "o":
            t = re.sub(r";+}", "}", t)
            if t[0] == "}" and out and out[-1].endswith(";"): out[-1] = out[-1][:-1]
        out.append(t)
    return "".join(out)
