/* Planche des armes en vue subjective : chaque arme est équipée comme en partie (mains, hanche, visée, rechargement) et
   photographiée par le vrai rendu du jeu (post-traitement compris), sans carte. Vues « gauche », « droite » et « dessus » :
   l'arme seule (sans mains) vue de côté, pour juger le modèle.
   node armes.js [--dossier d] [--armes m4,ak47|toutes] [--vues hanche,ads,gauche,droite,dessus,recharge,inspect]
                 [--acc red,sil] [--camo desert] [--w 960] [--h 540] [--qualite medium] [--essai fichier.js] [--carte sable --pos x,y,z,cap]
   --essai : script exécuté dans la page avant les vues (essayer un réglage sans reconstruire le jeu) ; PAGE=autre/version.html pour
   comparer à une autre version. --carte : sur une vraie carte (ciel, reflets du décor, halo lumineux) plutôt que sur un fond gris,
   l'œil en --pos (mètres, cap en degrés ; 0, 1,6, 0 par défaut) : pour juger une matière qui brille (camouflage Holo).
   Sortie : <dossier>/<arme>-<vue>.png ; assembler avec montage (ImageMagick) si besoin. */
const fs = require('fs'), path = require('path');
const { openGame } = require('./common');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const out = opt('dossier', path.join(__dirname, 'shots-armes'));
const wanted = opt('armes', 'toutes');
const views = opt('vues', 'hanche,ads,gauche,droite,dessus').split(',');
const acc = opt('acc', ''), camo = opt('camo', '');
const W = +opt('w', 960), H = +opt('h', 540), carte = opt('carte', ''), pos = opt('pos', '0,1.6,0,0').split(',').map(Number);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, logs } = await openGame({ w: W, h: H, settings: Object.assign({ quality: opt('qualite', 'medium'), dynres: false }, carte ? { map: carte } : {}), noMap: !carte, noHdri: !carte, page: process.env.PAGE });
  if (opt('essai', '')) await page.addScriptTag({ content: fs.readFileSync(opt('essai', ''), 'utf8') });
  const ids = await page.evaluate((wanted) => (wanted === 'toutes' ? Object.keys(WEAPONS) : wanted.split(',')), wanted);
  await page.evaluate(([carte, pos]) => {
    MATCH.state = 'capture';
    document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; });
    for (const e of entities) if (e.model) e.model.root.visible = false;
    VM.root.visible = true; VM.knifeRig.visible = false; VM.nadeRig.visible = false;
    if (!carte) { if (typeof sky !== 'undefined') sky.visible = false; scene.background = new THREE.Color(0x8a939c); }
    if (typeof skyMat !== 'undefined') skyMat.uniforms.uTime.value = 0;
    window.__armeSetup = (id, spec, view) => {
      const def = typeof weaponDef === 'function' ? weaponDef(id, spec.acc, spec.camo) : WEAPONS[id];
      vmEquip(def); VM.holder.visible = true; VM.lower = 0; VM.lowerTarget = 0; VM.action = null;
      const S = { ads: view === 'ads', sprint: false, speed: 0, grounded: true, crouch: false, empty: false, lat: 0, fwd: 0, fire: false, wall: 0, slide: 0 };
      const free = view === 'gauche' || view === 'droite' || view === 'dessus';
      camera.position.set(pos[0], pos[1], pos[2]); camera.rotation.set(0, (pos[3] || 0) * Math.PI / 180, 0, 'YXZ'); camera.fov = Settings.fov; camera.updateProjectionMatrix();
      vmCamera.position.set(0, 0, 0); vmCamera.rotation.set(0, 0, 0); vmCamera.up.set(0, 1, 0);
      for (let i = 0; i < 70; i++) updateViewmodel(1 / 30, S);
      VM.__S = S;
      if (free) {
        // arme seule, vue de côté : les mains sont masquées, la caméra tourne autour du support
        setArmVisible(VM.arms.R, false); setArmVisible(VM.arms.L, false);
        VM.holder.position.set(0, 0, 0); VM.holder.rotation.set(0, 0, 0); VM.holder.updateMatrixWorld(true);
        const m = VM.cur, box = new THREE.Box3().setFromObject(m.group), c = box.getCenter(new V3()), sz = box.getSize(new V3());
        vmCamera.fov = 28; vmCamera.updateProjectionMatrix();
        const asp = vmCamera.aspect, t = Math.tan(THREE.MathUtils.degToRad(14));
        const d = Math.max(view === 'dessus' ? sz.z : sz.z, (view === 'dessus' ? sz.x : sz.y) * asp) / 0.82 / (2 * t * asp) * 1.0;
        if (view === 'droite') vmCamera.position.set(c.x + d, c.y, c.z); else if (view === 'gauche') vmCamera.position.set(c.x - d, c.y, c.z); else { vmCamera.position.set(c.x, c.y + d, c.z + 0.001); }
        vmCamera.lookAt(c);
        VM.__free = true;
      } else {
        // champ de la vue subjective comme en partie (08-player.js) : 44° en visée, moins pour une optique qui grossit (vmFovAt) ; sans
        // quoi la mire paraît plus petite qu'en jeu
        vmCamera.fov = typeof vmFovAt === 'function' ? vmFovAt(VM.fovHip, VM.ads) : VM.fovHip + (44 - VM.fovHip) * VM.ads; vmCamera.updateProjectionMatrix();
        VM.__free = false;
      }
    };
    window.__armeStep = (view) => {
      if (VM.__free) return;
      const S = VM.__S; if (!S) return;
      updateViewmodel(1 / 60, S);
    };
  }, [carte, pos]);
  for (const id of ids) {
    for (const view of views) {
      await page.evaluate(([id, spec, view]) => window.__armeSetup(id, spec, view), [id, { acc: acc ? acc.split(',') : [], camo: camo || null }, view]);
      if (view === 'recharge' || view === 'inspect') {
        // figé à 4 instants de l'action : on la relance, on place son horloge, une seule mise à jour pose la pose
        for (const f of [0.2, 0.4, 0.6, 0.8]) {
          await page.evaluate(([view, f]) => {
            const T = view === 'recharge' ? VM.curDef.reload : 3.3;
            vmStartAction(view === 'recharge' ? 'reload' : 'inspect', T, { empty: false });
            VM.actionT = T * f - 0.0006; VM.actionDur = T;
            updateViewmodel(0.0005, VM.__S); VM.popO.fill(0); VM.popV.fill(0); VM.chocO.fill(0); VM.chocV.fill(0); updateViewmodel(0.0005, VM.__S); // sans ressort d'enchaînement ni choc (pose de l'instant seule)
          }, [view, f]);
          await page.waitForTimeout(200);
          await page.screenshot({ path: path.join(out, `${id}-${view}-${String(f).replace('.', '_')}.png`), timeout: 240000 });
        }
        continue;
      }
      await page.waitForTimeout(250);
      await page.evaluate((view) => window.__armeStep(view), view);
      await page.screenshot({ path: path.join(out, `${id}-${view}.png`), timeout: 240000 });
    }
  }
  const bad = logs.filter((l) => !l.includes('HDRI'));
  if (bad.length) console.log(bad.slice(0, 15).join('\n'));
  await browser.close();
})();
