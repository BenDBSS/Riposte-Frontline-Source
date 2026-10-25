"""Bibliothèques tierces servies par le site lui-même (plus de jsDelivr) : refait assets/vendor/ depuis tools/dev/node_modules
(cd tools/dev && npm ci), à relancer seulement si une version change dans tools/dev/package.json.
- assets/vendor/three-r147.js : three.js r147 et les modules d'exemples dont le jeu se sert, mis bout à bout (licence MIT, en tête) ;
  build.py en fait dist/tex/three.<condensat>.js, chargé par une balise script avant le code du jeu.
- assets/vendor/hdri/<nom>.exr : les HDRI de Poly Haven (CC0) empaquetées par @pmndrs/assets, remises en binaire ; build.py en fait
  des paquets texPack (clé hdri_<nom>), chargés au lancement de la carte qui en demande une (src/01-core.js, loadHDRIEnvironment).
Un script tiers chargé depuis un autre hôte tournerait avec la session du joueur : servi d'ici, il ne change qu'avec le dépôt."""
import base64,os,re
NM="tools/dev/node_modules/"
LIBS=["build/three.min.js","examples/js/shaders/CopyShader.js","examples/js/shaders/LuminosityHighPassShader.js","examples/js/postprocessing/EffectComposer.js",
      "examples/js/postprocessing/RenderPass.js","examples/js/postprocessing/ShaderPass.js","examples/js/postprocessing/UnrealBloomPass.js",
      "examples/js/csm/CSMFrustum.js","examples/js/csm/CSMShader.js","examples/js/csm/CSM.js","examples/js/geometries/RoundedBoxGeometry.js",
      "examples/js/libs/fflate.min.js","examples/js/loaders/EXRLoader.js","examples/js/math/SimplexNoise.js","examples/js/shaders/SSAOShader.js",
      "examples/js/postprocessing/SSAOPass.js"]
HDRI=["park","sky","sunset"]
def main():
    if not os.path.isdir(NM+"three"): raise SystemExit("tools/dev/node_modules absent : cd tools/dev && npm ci")
    ver=re.search(r'"version":\s*"([^"]+)"',open(NM+"three/package.json",encoding="utf-8").read()).group(1)
    lic=open(NM+"three/LICENSE",encoding="utf-8").read().strip()
    out=["/* three.js "+ver+" (https://github.com/mrdoob/three.js), fichiers du paquet npm mis bout à bout par tools/vendor.py :\n   "
         +", ".join(LIBS)+"\n\n"+lic+"\n*/"]
    for l in LIBS:
        s=open(NM+"three/"+l,encoding="utf-8").read()
        if "</script" in s.lower(): raise SystemExit(l+" contient </script")
        out.append("/* "+l+" */\n"+s.rstrip()+"\n;")
    os.makedirs("assets/vendor/hdri",exist_ok=True)
    open("assets/vendor/three-r147.js","w",encoding="utf-8").write("\n".join(out)+"\n")
    for n in HDRI:
        s=open(NM+"@pmndrs/assets/hdri/"+n+".exr.js",encoding="utf-8").read()
        m=re.search(r"base64,([A-Za-z0-9+/=]+)'",s)
        if not m: raise SystemExit("hdri/"+n+".exr.js : données introuvables")
        open("assets/vendor/hdri/"+n+".exr","wb").write(base64.b64decode(m.group(1)))
    print("assets/vendor :",os.path.getsize("assets/vendor/three-r147.js")//1024,"Ko de three.js,",len(HDRI),"HDRI")
main()
