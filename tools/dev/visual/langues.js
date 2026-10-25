/* Parcours des écrans du jeu dans une langue : node tools/dev/visual/langues.js en|fr [dossier de captures]
   Relève le texte visible de chaque écran et signale, en anglais, ce qui ressemble encore à du français, ainsi que les clés
   absentes du dictionnaire (I18N_MISS). Sert de contrôle après tout ajout de texte (README, « Langues »). */
const { openGame } = require('./common');
const path = require('path');
const lang = process.argv[2] === 'fr' ? 'fr' : 'en', out = process.argv[3];
/* Mots français : ceux des clés de i18n/en.txt qui ne figurent dans aucune traduction anglaise ; toute ligne qui en contient un est suspecte */
const fs = require('fs');
const pairs = fs.readFileSync(path.join(__dirname, '../../../i18n/en.txt'), 'utf8').split('\n').filter((l) => l && !l.startsWith('#') && l.includes(' ⇒ ')).map((l) => l.split(' ⇒ ')).map(([k, v]) => [k, v === '=' ? k : v]);
const words = (t) => (t.toLowerCase().match(/[a-zà-ÿœ]{3,}/g) || []);
const enWords = new Set(pairs.flatMap(([, v]) => words(v)));
const frWords = new Set(pairs.flatMap(([k]) => words(k)).filter((w) => !enWords.has(w)));
const FR = { test: (v) => /[àâçéèêëîïôùûœ]/i.test(v) || words(v.replace(/<[^>]*>/g, ' ')).some((w) => frWords.has(w)) };
const OK = /Kervénec|Hôtel du Col|Café de la Marine|Français|Riposte: Frontline|\[Nom ou raison|\[Adresse|\[région/;
(async () => {
  const { browser, page, logs } = await openGame({ w: 1280, h: 800, settings: { quality: 'low', lang, map: 'sable' }, noHdri: true });
  const seen = new Set(), left = [];
  const shot = async (name) => { if (out) await page.screenshot({ path: path.join(out, `${lang}-${name}.png`) }); };
  const scan = async (name, all) => {
    const t = await page.evaluate((all) => {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), r = [];
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const p = n.parentElement; if (!p || /SCRIPT|STYLE/.test(p.tagName)) continue;
        const cs = getComputedStyle(p); let ok = true;
        for (let e = p; !all && e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || e.hidden || +s.opacity === 0) { ok = false; break; } }
        const v = n.nodeValue.trim(); if (ok && v) r.push(v);
      }
      document.querySelectorAll('[placeholder],[aria-label],[title]').forEach((e) => { for (const a of ['placeholder', 'aria-label', 'title']) { const v = e.getAttribute(a); if (v) r.push(v); } });
      return r;
    }, !!all);
    for (const v of t) if (lang === 'en' && FR.test(v) && !OK.test(v) && !seen.has(v)) { seen.add(v); left.push(`${name}: ${v.slice(0, 110)}`); }
    await shot(name);
  };
  await page.evaluate(() => { const b = document.getElementById('wnOk'); if (b) b.click(); });
  await page.waitForTimeout(300);
  const lg = await page.evaluate(() => [document.documentElement.lang, LANG]); console.log('langue de la page :', lg.join(' / '));
  await scan('main');
  for (const s of ['solo', 'multi', 'profile', 'legal', 'classes', 'options', 'news']) {
    await page.evaluate((s) => uiGo(s), s); await page.waitForTimeout(500); await scan(s);
  }
  // sous-écrans : modes de jeu, onglets d'Options, textes légaux, profil (création de compte, mot de passe oublié, code de secours)
  await page.evaluate(() => uiGo('solo'));
  for (const m of ['ffa', 'dom', 'tdm']) { await page.evaluate((m) => { Settings.mode = m; renderSolo(); }, m); await scan('solo-' + m); }
  for (const pg of ['map', 'setup']) { await page.evaluate((pg) => { lmReset(LM.scr.solo); lmPush(LM.scr.solo, pg); }, pg); await page.waitForTimeout(250); await scan('solo-' + pg); } // sous-menus du Solo
  await page.evaluate(() => lmReset(LM.scr.solo));
  await page.evaluate(() => uiGo('options'));
  for (let i = 0; i < 4; i++) { await page.evaluate((i) => document.querySelectorAll('#optMenu .tabs button')[i].click(), i); await scan('options-' + i); }
  await page.evaluate(() => uiGo('legal'));
  for (const t of ['terms', 'notice', 'privacy']) { await page.evaluate((t) => { LEGAL.tab = t; legalRender(); }, t); await scan('legal-' + t); }
  await page.evaluate(() => { uiGo('profile'); ACCT.state = 'ready'; ACCT.user = null; ACCT.view = 'register'; acctRender(); }); await scan('profile-register');
  for (const v of ['recover', 'login']) { await page.evaluate((v) => { ACCT.view = v; acctRender(); }, v); await scan('profile-' + v); }
  await page.evaluate(() => { ACCT.state = 'off'; acctRender(); }); await scan('profile-off');
  await page.evaluate(() => {
    ACCT.state = 'ready'; ACCT.view = 'login';
    ACCT.user = { username: 'tester', displayName: 'Tester', hasPassword: true, hasRecovery: false };
    ACCT.level = { level: 4, into: 40, need: 200, xp: 900 }; ACCT.stats = { matches: 5, wins: 2, kills: 40, deaths: 20, assists: 3, hits: 50, shots: 100, headshots: 8, bestStreak: 6, seconds: 3600 };
    ACCT.recent = [{ map: 'sable', mode: 'tdm', result: 'win', online: true, kills: 9, deaths: 3, xp: 120, played_at: '2026-10-01T10:00:00Z' }, { map: 'givre', mode: 'ffa', result: 'quit', online: false, kills: 2, deaths: 5, xp: 10, played_at: '2026-10-02T10:00:00Z' }];
    acctRender();
  }); await scan('profile-user');
  await page.evaluate(() => { ACCT.code = 'ABCDE-FGHJK-LMNPQ-RSTUV'; ACCT.codeNote = _t('Compte créé : bienvenue !'); acctRender(); }); await scan('profile-code');
  await page.evaluate(() => { ACCT.code = ''; ACCT.codeNote = ''; ACCT.user = null; ACCT.view = 'login'; acctRender(); });
  // atelier : une classe personnalisée
  await page.evaluate(() => { uiGo('classes'); });
  await page.waitForTimeout(400); await scan('classes');
  // partie : lancement, déploiement, HUD, pause, fin
  await page.evaluate(() => { toMenu('solo'); menuLaunch({ online: false, map: Settings.map, deploy: () => startMatch() }); });
  await page.waitForFunction("UI.screen==='deploy'", null, { timeout: 120000 }); await page.waitForTimeout(500); await scan('deploy');
  await page.evaluate(() => document.getElementById('depGo').click()); await page.waitForTimeout(3500); await scan('hud');
  await page.evaluate(() => { hudMsg(_t('Hélicoptère ennemi en approche ! Mettez-vous à couvert'), 'enemy', 2); xpPopup('+100', _t('Hélicoptère abattu')); }); await page.waitForTimeout(300); await scan('hud-msg');
  await page.evaluate(() => { try { pauseOpen && pauseOpen(); } catch (e) { /* ignoré */ } }); await page.waitForTimeout(500); await scan('pause');
  await page.evaluate(() => { try { showScoreboard(true); } catch (e) { /* ignoré */ } }); await page.waitForTimeout(300); await scan('board');
  await page.evaluate(() => { try { showScoreboard(false); } catch (e) { /* ignoré */ } });
  // mort (tueur, arme, distance, tête, invite de réapparition), puis déblocage et montée de niveau dans le couloir des annonces
  await page.evaluate(() => { try { const b = entities.find((x) => !x.isPlayer && !allied(x, PL.ent)); KC.pending = null; showDeathScreen(b, 'AK-47', true); } catch (e) { /* ignoré */ } }); await page.waitForTimeout(300); await scan('death');
  await page.evaluate(() => { try { hideDeathScreen(); arsNotify({ weapon: 'm4', up: true, level: 4, items: [] }); } catch (e) { /* ignoré */ } }); await page.waitForTimeout(500); await scan('arsup');
  await page.evaluate(() => { try { rankUpShow(12, 2); } catch (e) { /* ignoré */ } }); await page.waitForTimeout(800); await scan('rankup');
  await page.evaluate(() => { try { rankUpClear(); arsShowClear(); } catch (e) { /* ignoré */ } });
  await page.evaluate(() => { try { pauseGame(); } catch (e) { /* ignoré */ } }); await page.waitForTimeout(500); await scan('pause');
  for (const v of ['class', 'options']) { await page.evaluate((v) => { const b = document.querySelector(`[data-pm="${v}"]`); if (b) b.click(); }, v); await page.waitForTimeout(400); await scan('pause-' + v); }
  await page.evaluate(() => { try { resumeGame(); } catch (e) { /* ignoré */ } });
  await page.evaluate(() => { try { MATCH.score[0] = MATCH.limit; endMatch(); } catch (e) { /* ignoré */ } }); await page.waitForTimeout(6000); await scan('end');
  await scan('static', true);
  console.log(left.length ? 'RESTE DU FRANÇAIS EN ANGLAIS :\n  ' + left.join('\n  ') : 'aucun texte français détecté');
  const miss = await page.evaluate(() => [...I18N_MISS]);
  console.log(lang === 'en' ? (miss.length ? 'CLÉS SANS TRADUCTION :\n  ' + miss.map((k) => JSON.stringify(k.slice(0, 100))).join('\n  ') : 'aucune clé sans traduction') : '(français : pas de contrôle de clés)');
  console.log(logs.filter((l) => !l.includes('HDRI') && !l.includes('ERR_')).slice(0, 12).join('\n'));
  await browser.close();
})();
