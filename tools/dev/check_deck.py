"""Contrôle de l'installeur Steam Deck (dist/deck/installer.sh, README « Steam Deck ») sur n'importe quel Linux : faux dossier personnel,
faux Steam (un raccourci déjà là, une disposition de commandes déjà choisie, des modèles de disposition), dist/ servi en local, installeur en
mode RIPOSTE_DECK_TEST (sans Flatpak, sans arrêt de Steam ni retour au mode Jeu). Vérifie avec une lecture indépendante (paquet vdf) :
raccourci, identifiant, images, disposition, lanceur ; une seconde installation sans doublon ; la désinstallation qui rend le fichier
d'origine octet pour octet ; un fichier inconnu laissé tel quel ; le premier raccourci d'un appareil.
python3 tools/dev/check_deck.py (après python3 build.py ; une fois : pip install --user vdf). Code de sortie 1 au moindre échec."""
import os, sys, shutil, subprocess, zlib, http.server, threading, functools, filecmp, tempfile
try:
    import vdf
except ImportError:
    sys.exit('paquet vdf absent : pip install --user vdf')
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
T = tempfile.mkdtemp(prefix='riposte-deck-')
HOME = os.path.join(T, 'home'); STEAM = os.path.join(HOME, '.local/share/Steam')
U = os.path.join(STEAM, 'userdata/12345/config'); os.makedirs(U)
os.makedirs(os.path.join(STEAM, 'userdata/0'))  # dossier « 0 » à ignorer
other = {'appid': -1999999999, 'AppName': 'Émulateur', 'Exe': '"/usr/bin/retroarch"', 'StartDir': '"/usr/bin/"', 'icon': '', 'ShortcutPath': '',
         'LaunchOptions': '-f', 'IsHidden': 0, 'AllowDesktopConfig': 1, 'AllowOverlay': 1, 'OpenVR': 0, 'Devkit': 0, 'DevkitGameID': '',
         'DevkitOverrideAppID': 0, 'LastPlayTime': 1700000000, 'FlatpakAppID': '', 'tags': {'0': 'favorite'}}
orig = vdf.binary_dumps({'shortcuts': {'0': other}})
open(os.path.join(U, 'shortcuts.vdf'), 'wb').write(orig)
TPL = os.path.join(STEAM, 'controller_base/templates'); os.makedirs(TPL)
for f in ('controller_neptune_gamepad_joystick.vdf', 'controller_neptune_gamepad+mouse.vdf', 'controller_neptune_gamepad_fps.vdf', 'controller_ps5_gamepad+mouse.vdf'): open(os.path.join(TPL, f), 'w').write('"controller_mappings"\n{\n}\n')
CC = os.path.join(STEAM, 'steamapps/common/Steam Controller Configs/12345/config'); os.makedirs(CC)
open(os.path.join(CC, 'configset_controller_neptune.vdf'), 'w').write('"controller_config"\n{\n\t"emulateur"\n\t{\n\t\t"template"\t\t"controller_neptune_gamepad_fps.vdf"\n\t}\n}\n')
# page servie en local
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(H, directory=os.path.join(REPO, 'dist')))
threading.Thread(target=srv.serve_forever, daemon=True).start()
SITE = 'http://127.0.0.1:%d' % srv.server_port
fails = 0
def ok(c, m):
    global fails
    print(('ok    : ' if c else 'ECHEC : ') + m); fails += 0 if c else 1
def run(*args, env=None):
    e = dict(os.environ, HOME=HOME, RIPOSTE_DECK_TEST='1', LANG='fr_FR.UTF-8'); e.update(env or {})
    p = subprocess.run(['bash', os.path.join(REPO, 'dist/deck/installer.sh'), SITE, *args], env=e, capture_output=True, text=True, stdin=subprocess.DEVNULL)
    return p.returncode, p.stdout + p.stderr
D = os.path.join(HOME, '.local/share/riposte-frontline')
exe = '"%s/riposte.sh"' % D; appid = zlib.crc32((exe + 'Riposte: Frontline').encode()) | 0x80000000
def state():
    sc = vdf.binary_loads(open(os.path.join(U, 'shortcuts.vdf'), 'rb').read())['shortcuts']
    cs = vdf.loads(open(os.path.join(CC, 'configset_controller_neptune.vdf')).read())['controller_config']
    return sc, cs
for n in (1, 2):
    rc, out = run()
    ok(rc == 0, f'installation {n} : code {rc}' + ('' if rc == 0 else '\n' + out))
    sc, cs = state()
    ok(len(sc) == 2, f'installation {n} : deux raccourcis (le nôtre et l\'existant), pas de doublon ({len(sc)})')
    ok(sc['0'] == other, f'installation {n} : raccourci existant intact')
    me = sc['1']
    ok(me['AppName'] == 'Riposte: Frontline' and me['Exe'] == exe and me['appid'] & 0xffffffff == appid, f'installation {n} : notre raccourci (nom, lanceur, identifiant {appid})')
    ok(me['icon'] == D + '/icone.png' and os.path.exists(me['icon']), f'installation {n} : icône')
    G = os.path.join(U, 'grid')
    for src, dst in (('jaquette.jpg', '%dp.jpg'), ('capsule.jpg', '%d.jpg'), ('hero.jpg', '%d_hero.jpg'), ('logo.png', '%d_logo.png')):
        f = os.path.join(G, dst % appid); ok(os.path.exists(f) and filecmp.cmp(f, os.path.join(REPO, 'dist/deck', src), shallow=False), f'installation {n} : image {dst % appid}')
    ok(cs.get('emulateur', {}).get('template') == 'controller_neptune_gamepad_fps.vdf', f'installation {n} : disposition existante intacte')
    ok(cs.get('riposte: frontline', {}).get('template') == 'controller_neptune_gamepad+mouse.vdf' and cs.get('riposte frontline', {}).get('template') == 'controller_neptune_gamepad+mouse.vdf', f'installation {n} : disposition manette avec souris')
    sh = open(os.path.join(D, 'riposte.sh')).read()
    ok(f'"{SITE}/?deck=1"' in sh and '--kiosk' in sh and 'com.google.Chrome' in sh and os.access(os.path.join(D, 'riposte.sh'), os.X_OK), f'installation {n} : lanceur exécutable, ouvre {SITE}/?deck=1 en plein écran')
ok(open(os.path.join(U, 'shortcuts.vdf.riposte-sauvegarde'), 'rb').read() == orig, 'sauvegarde du fichier d\'origine')
# désinstallation : on revient exactement au fichier d'origine
rc, out = run('--desinstaller')
ok(rc == 0, 'désinstallation : code %d' % rc + ('' if rc == 0 else '\n' + out))
ok(open(os.path.join(U, 'shortcuts.vdf'), 'rb').read() == orig, 'désinstallation : fichier des raccourcis identique à l\'origine, octet pour octet')
ok(not [f for f in os.listdir(os.path.join(U, 'grid')) if f.startswith(str(appid))], 'désinstallation : images retirées')
sc, cs = state()
ok(set(cs) == {'emulateur'}, 'désinstallation : disposition retirée, l\'autre gardée')
ok(not os.path.exists(D), 'désinstallation : lanceur retiré')
# fichier illisible : rien n'est écrit
bad = orig[:-1] + b'\x05\x08'
open(os.path.join(U, 'shortcuts.vdf'), 'wb').write(bad)
rc, out = run()
ok(rc != 0 and open(os.path.join(U, 'shortcuts.vdf'), 'rb').read() == bad and 'SKIP' in out, 'fichier inconnu : installation refusée, fichier laissé tel quel')
# premier raccourci de l'appareil (pas de shortcuts.vdf) et sans modèle de manette
os.remove(os.path.join(U, 'shortcuts.vdf')); shutil.rmtree(TPL)
rc, out = run(env={'LANG': 'en_US.UTF-8'})
sc = vdf.binary_loads(open(os.path.join(U, 'shortcuts.vdf'), 'rb').read())['shortcuts']
ok(rc == 0 and len(sc) == 1 and sc['0']['AppName'] == 'Riposte: Frontline', 'sans raccourci existant : fichier créé avec le nôtre')
ok('Gamepad with Mouse Trackpad' in out, 'sans modèle de manette : le message dit quelle disposition choisir (en anglais)')
srv.shutdown(); shutil.rmtree(T, ignore_errors=True)
print('tout est bon' if not fails else '%d échec(s)' % fails); sys.exit(1 if fails else 0)
