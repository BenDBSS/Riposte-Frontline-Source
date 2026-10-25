#!/bin/bash
# Riposte: Frontline sur Steam Deck : installation dans Steam, en mode Bureau (README « Steam Deck »).
# Lancé par le fichier « Installer Riposte » que le jeu télécharge (bouton du menu principal sur Steam Deck), ou à la main :
#   curl -fsSL https://www.playriposte.com/deck/installer.sh | bash
#   bash installer.sh [adresse du jeu] [--desinstaller]
# Il installe Chrome (Flathub, pour l'utilisateur, sans mot de passe) et lui donne accès à la manette, écrit un lanceur qui ouvre le jeu en
# ligne en plein écran (?deck=1 : mode Deck du jeu), ferme Steam, ajoute le raccourci (shortcuts.vdf) avec ses images (dossier grid) et la
# disposition « manette » des commandes, puis revient au mode Jeu. Le jeu se met à jour comme la version web : le lanceur ouvre le site.
# Le fichier des raccourcis n'est réécrit que si sa relecture redonne exactement les mêmes octets (sinon rien n'est touché), avec une
# sauvegarde à côté. Relancer l'installation remplace le raccourci au lieu d'en ajouter un. RIPOSTE_DECK_TEST=1 : sans Flatpak, sans
# arrêt de Steam ni retour au mode Jeu (contrôle hors Steam Deck).
set -u
SITE="https://www.playriposte.com"
MODE=install
for a in "$@"; do
  case "$a" in
    --desinstaller|--uninstall) MODE=uninstall ;;
    http://*|https://*) SITE="${a%/}" ;;
  esac
done
# https seulement (http pour un essai sur cette machine : tools/dev/check_deck.py) : le lanceur et ce qu'il télécharge ne passent pas en clair
if ! [[ "$SITE" =~ ^https://[A-Za-z0-9.:-]+$ || "$SITE" =~ ^http://(127\.0\.0\.1|localhost)(:[0-9]+)?$ ]]; then echo "Adresse invalide : $SITE"; exit 1; fi
APP="Riposte: Frontline"
DIR="$HOME/.local/share/riposte-frontline"
TEST="${RIPOSTE_DECK_TEST:-}"
FR=; case "${LANG:-}${LC_ALL:-}" in fr*|*fr_*) FR=1 ;; esac
t() { if [ -n "$FR" ]; then printf '%s\n' "$1"; else printf '%s\n' "$2"; fi; }
pause() { [ -n "$TEST" ] && return; [ -t 0 ] || [ -e /dev/tty ] || return; t "Appuyez sur Entrée pour fermer cette fenêtre." "Press Enter to close this window."; read -r _ < /dev/tty || true; }
fail() { echo; t "ÉCHEC : $1" "FAILED: $2"; pause; exit 1; }

echo "=== $APP ==="
command -v python3 >/dev/null || fail "python3 introuvable." "python3 not found."
command -v curl >/dev/null || fail "curl introuvable." "curl not found."

# Steam : l'installation habituelle de SteamOS, sinon ~/.steam/steam
STEAM=""
for d in "$HOME/.local/share/Steam" "$HOME/.steam/steam"; do [ -d "$d/userdata" ] && { STEAM="$(readlink -f "$d")"; break; }; done
[ -n "$STEAM" ] || fail "Steam introuvable. Lancez Steam une fois, connectez-vous, puis relancez l'installation." "Steam not found. Start Steam once, sign in, then run the installer again."

if [ "$MODE" = install ]; then
  # 1. Chrome (Flatpak) et la manette
  if [ -z "$TEST" ]; then
    command -v flatpak >/dev/null || fail "Flatpak introuvable." "Flatpak not found."
    if ! flatpak info com.google.Chrome >/dev/null 2>&1; then
      t "Installation de Google Chrome depuis Flathub (quelques minutes)..." "Installing Google Chrome from Flathub (a few minutes)..."
      flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo || fail "Flathub injoignable." "Cannot reach Flathub."
      flatpak install --user -y flathub com.google.Chrome || fail "l'installation de Chrome a échoué." "Chrome installation failed."
    fi
    # sans accès à /run/udev, Chrome en Flatpak ne voit pas la manette du Steam Deck
    flatpak override --user --filesystem=/run/udev:ro com.google.Chrome || fail "accès de Chrome à la manette refusé." "Could not give Chrome access to the controller."
  fi

  # 2. Lanceur et images
  mkdir -p "$DIR" || fail "dossier $DIR impossible à créer." "Cannot create $DIR."
  t "Téléchargement des images du jeu..." "Downloading the game artwork..."
  for f in jaquette.jpg capsule.jpg hero.jpg logo.png icone.png; do
    curl -fsSL "$SITE/deck/$f" -o "$DIR/$f" || fail "téléchargement de $f impossible." "Could not download $f."
  done
  # profil de Chrome réservé au jeu : sa progression et ses réglages à part, et une fenêtre à lui (un Chrome déjà ouvert ne la prend pas)
  cat > "$DIR/riposte.sh" <<EOF
#!/bin/bash
# Lanceur de $APP sur Steam Deck, écrit par l'installeur ($SITE/deck/installer.sh) : le jeu en ligne, en plein écran, à la manette.
exec flatpak run --branch=stable --arch=x86_64 --command=/app/bin/chrome com.google.Chrome \\
  --user-data-dir="\$HOME/.var/app/com.google.Chrome/data/riposte-frontline" --kiosk --no-first-run --no-default-browser-check \\
  --password-store=basic --autoplay-policy=no-user-gesture-required --hide-crash-restore-bubble --disable-features=Translate \\
  "$SITE/?deck=1"
EOF
  chmod +x "$DIR/riposte.sh"
  # aussi dans le menu des applications du mode Bureau
  mkdir -p "$HOME/.local/share/applications"
  cat > "$HOME/.local/share/applications/riposte-frontline.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=$APP
Exec="$DIR/riposte.sh"
Icon=$DIR/icone.png
Categories=Game;
EOF
fi

# 3. Steam fermé pendant l'écriture (il réécrit ses fichiers en quittant)
if [ -z "$TEST" ] && pgrep -x steam >/dev/null; then
  t "Fermeture de Steam..." "Closing Steam..."
  steam -shutdown >/dev/null 2>&1 &
  for _ in $(seq 60); do pgrep -x steam >/dev/null || break; sleep 1; done
  pgrep -x steam >/dev/null && fail "Steam ne s'est pas fermé. Quittez Steam puis relancez l'installation." "Steam did not close. Quit Steam, then run the installer again."
fi

# 4. Raccourci, images, disposition des commandes (Python : le fichier des raccourcis est binaire)
PY="$(mktemp)"
cat > "$PY" <<'PYEOF'
import glob, os, re, shutil, struct, sys, zlib
mode, steam, d, app = sys.argv[1:5]
exe = '"%s/riposte.sh"' % d
appid = zlib.crc32((exe + app).encode('utf-8')) | 0x80000000  # identifiant du raccourci, écrit dans shortcuts.vdf : les images en portent le nom
names = [app.lower(), app.lower().replace(':', '')]            # clé du raccourci dans les dispositions des commandes (sans le deux-points selon les versions)

# --- VDF binaire (shortcuts.vdf) : 00 table, 01 chaîne, 02 entier 32 bits, 03 flottant, 07 entier 64 bits, 08 fin de table
def bparse(b):
    pos = 0
    def rmap():
        nonlocal pos
        out = []
        while True:
            ty = b[pos]; pos += 1
            if ty == 8: return out
            e = b.index(b'\0', pos); k = b[pos:e]; pos = e + 1
            if ty == 0: out.append([k, 0, rmap()])
            elif ty == 1: e = b.index(b'\0', pos); out.append([k, 1, b[pos:e]]); pos = e + 1
            elif ty in (2, 3): out.append([k, ty, b[pos:pos + 4]]); pos += 4
            elif ty == 7: out.append([k, ty, b[pos:pos + 8]]); pos += 8
            else: raise ValueError('type %d' % ty)
    root = rmap()
    if pos != len(b): raise ValueError('fin inattendue')
    return root
def bdump(m):
    o = bytearray()
    for k, ty, v in m:
        o.append(ty); o += k + b'\0'
        o += bdump(v) if ty == 0 else (v + b'\0' if ty == 1 else v)
    o.append(8); return bytes(o)
def field(e, name):
    for f in e:
        if f[0].decode('utf-8', 'replace').lower() == name.lower(): return f
    return None

# --- VDF texte (dispositions des commandes) : chaînes entre guillemets et accolades, gardées telles quelles
def tparse(s):
    toks = re.findall(r'"((?:[^"\\]|\\.)*)"|([{}])', re.sub(r'//[^\n]*', '', s))
    pos = 0
    def rmap():
        nonlocal pos
        out = []
        while pos < len(toks):
            q, br = toks[pos]; pos += 1
            if br == '}': return out
            nq, nbr = toks[pos]; pos += 1
            out.append([q, rmap()] if nbr == '{' else [q, nq])
        return out
    return rmap()
def tdump(m, ind=0):
    o = ''
    for k, v in m:
        if isinstance(v, list): o += '\t' * ind + '"%s"\n' % k + '\t' * ind + '{\n' + tdump(v, ind + 1) + '\t' * ind + '}\n'
        else: o += '\t' * ind + '"%s"\t\t"%s"\n' % (k, v)
    return o

def backup(f):
    if os.path.exists(f) and not os.path.exists(f + '.riposte-sauvegarde'): shutil.copyfile(f, f + '.riposte-sauvegarde')

users = [u for u in glob.glob(os.path.join(steam, 'userdata', '*')) if os.path.basename(u).isdigit() and os.path.basename(u) != '0']
if not users: print('NOUSER'); sys.exit(3)
# disposition « manette avec trackpad souris » : prise parmi les modèles de cette installation de Steam (le nom varie selon les versions)
tpl = sorted(os.path.basename(f) for f in glob.glob(os.path.join(steam, 'controller_base', 'templates', '*.vdf')))
pick = next((f for f in tpl if 'neptune' in f and 'gamepad' in f and 'mouse' in f), None)
ok = 0
for u in users:
    uid = os.path.basename(u)
    cfg = os.path.join(u, 'config'); os.makedirs(cfg, exist_ok=True)
    sf = os.path.join(cfg, 'shortcuts.vdf')
    raw = open(sf, 'rb').read() if os.path.exists(sf) else b'\x00shortcuts\x00\x08\x08'
    try:
        root = bparse(raw)
        if bdump(root) != raw: raise ValueError('relecture différente')
        if not root or root[0][1] != 0: raise ValueError('pas de table shortcuts')
        sc = root[0][2]
    except Exception as e:
        print('SKIP %s %s' % (uid, e)); continue
    # notre raccourci : par son nom ou par son lanceur
    mine = [e for e in sc if e[1] == 0 and ((field(e[2], 'AppName') and field(e[2], 'AppName')[2].decode('utf-8', 'replace').lower() == app.lower())
            or (field(e[2], 'Exe') and b'riposte-frontline/riposte.sh' in field(e[2], 'Exe')[2]))]
    olds = [struct.unpack('<I', field(e[2], 'appid')[2])[0] for e in mine if field(e[2], 'appid')]
    sc[:] = [e for e in sc if e not in mine]
    if mode == 'install':
        s = lambda v: v.encode('utf-8')
        i32 = lambda v: struct.pack('<I', v & 0xffffffff)
        entry = [[b'appid', 2, i32(appid)], [b'AppName', 1, s(app)], [b'Exe', 1, s(exe)], [b'StartDir', 1, s('"%s"' % d)],
                 [b'icon', 1, s(d + '/icone.png')], [b'ShortcutPath', 1, b''], [b'LaunchOptions', 1, b''], [b'IsHidden', 2, i32(0)],
                 [b'AllowDesktopConfig', 2, i32(1)], [b'AllowOverlay', 2, i32(1)], [b'OpenVR', 2, i32(0)], [b'Devkit', 2, i32(0)],
                 [b'DevkitGameID', 1, b''], [b'DevkitOverrideAppID', 2, i32(0)], [b'LastPlayTime', 2, i32(0)], [b'FlatpakAppID', 1, b''],
                 [b'tags', 0, []]]
        sc.append([b'', 0, entry])
    for n, e in enumerate(sc): e[0] = str(n).encode()  # index 0, 1, 2... sans trou
    backup(sf)
    open(sf + '.tmp', 'wb').write(bdump(root)); os.replace(sf + '.tmp', sf)
    # images : jaquette (p), capsule horizontale, bandeau (_hero), logo ; celles d'un ancien identifiant sont retirées
    grid = os.path.join(cfg, 'grid'); os.makedirs(grid, exist_ok=True)
    for a in set(olds) | {appid}:
        for f in glob.glob(os.path.join(grid, '%d*' % a)):
            if re.fullmatch(r'%d(p|_hero|_logo)?\.(png|jpg|jpeg|webp)' % a, os.path.basename(f)): os.remove(f)
    if mode == 'install':
        for src, dst in (('jaquette.jpg', '%dp.jpg'), ('capsule.jpg', '%d.jpg'), ('hero.jpg', '%d_hero.jpg'), ('logo.png', '%d_logo.png')):
            shutil.copyfile(os.path.join(d, src), os.path.join(grid, dst % appid))
    # disposition des commandes : sans elle, Steam peut donner au raccourci une disposition clavier et souris, que Chrome ne lit pas
    cc = os.path.join(steam, 'steamapps', 'common', 'Steam Controller Configs', uid, 'config')
    cf = os.path.join(cc, 'configset_controller_neptune.vdf')
    if pick or os.path.exists(cf):
        try:
            m = tparse(open(cf, encoding='utf-8').read()) if os.path.exists(cf) else [['controller_config', []]]
            body = m[0][1]
            body[:] = [kv for kv in body if kv[0] not in names]
            if mode == 'install' and pick:
                for n in names: body.append([n, [['template', pick]]])
            os.makedirs(cc, exist_ok=True); backup(cf)
            open(cf + '.tmp', 'w', encoding='utf-8').write(tdump(m)); os.replace(cf + '.tmp', cf)
        except Exception as e:
            print('NOTPL %s %s' % (uid, e))
    ok += 1
print('APPID %d' % appid)
print('TEMPLATE %s' % (pick or '-'))
print('USERS %d' % ok)
sys.exit(0 if ok else 4)
PYEOF
OUT="$(python3 "$PY" "$MODE" "$STEAM" "$DIR" "$APP")"; RC=$?
rm -f "$PY"
echo "$OUT" | grep -E '^(SKIP|NOTPL)' || true
[ $RC -eq 3 ] && fail "aucun compte Steam sur cet appareil. Connectez-vous à Steam une fois, puis relancez l'installation." "No Steam account on this device. Sign in to Steam once, then run the installer again."
[ $RC -ne 0 ] && fail "le raccourci Steam n'a pas pu être écrit." "The Steam shortcut could not be written."
if [ "$MODE" = uninstall ]; then
  rm -rf "$DIR" "$HOME/.local/share/applications/riposte-frontline.desktop"
  t "$APP est retiré de Steam." "$APP has been removed from Steam."
else
  echo "$OUT" | grep -q '^TEMPLATE -$' && t "Disposition des commandes : à choisir dans Steam (Manette avec trackpad souris) si la manette ne répond pas en jeu." "Controller layout: pick Gamepad with Mouse Trackpad in Steam if the controller does not respond in game."
  t "$APP est installé dans Steam." "$APP is installed in Steam."
fi

# 5. Retour au mode Jeu (SteamOS), sinon Steam relancé
[ -n "$TEST" ] && exit 0
if command -v steamos-session-select >/dev/null; then
  t "Retour au mode Jeu dans 5 secondes..." "Returning to Gaming Mode in 5 seconds..."
  sleep 5
  steamos-session-select
else
  (setsid steam >/dev/null 2>&1 &)
  pause
fi
