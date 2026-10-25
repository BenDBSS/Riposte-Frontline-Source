/* Contrôle de la réduction du code (tools/minif.py, appelée par build.py) : le script du jeu, assemblé comme le fait build.py
   (le filtre des mots puis src/*.js), doit donner le même arbre syntaxique avant et après réduction. Seules les positions
   changent. À relancer après toute retouche de tools/minif.py, ou si une construction se comporte autrement qu'avant.
   node check_minif.js (dans tools/dev, après npm install). Sortie : « identique » ou le premier écart (code 1). */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const acorn = require('acorn');
const REPO = path.resolve(__dirname, '../..');

const filtre = fs.readFileSync(path.join(REPO, 'api/_lib/filtre.js'), 'utf8').replace(/^export /gm, '');
const files = fs.readdirSync(path.join(REPO, 'src')).filter((f) => f.endsWith('.js')).sort();
const src = filtre + '\n' + files.map((f) => fs.readFileSync(path.join(REPO, 'src', f), 'utf8')).join('\n');
const min = execFileSync('python3', ['-c', 'import sys;sys.path.insert(0,"tools");import minif;sys.stdout.write(minif.js(sys.stdin.read()))'],
  { cwd: REPO, input: src, encoding: 'utf8', maxBuffer: 1 << 28 });

const parse = (code) => acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true });
const a = parse(src), b = parse(min);
const SKIP = new Set(['start', 'end', 'loc', 'range']);
const where = (n, code) => (n && typeof n.start === 'number' ? JSON.stringify(code.slice(n.start, n.start + 80)) : '');
function same(x, y, trail) {
  if (x === y) return true;
  if (typeof x !== typeof y || x === null || y === null || typeof x !== 'object') {
    console.log('écart en', trail, ':', JSON.stringify(x), 'devient', JSON.stringify(y)); return false;
  }
  if (Array.isArray(x)) {
    if (!Array.isArray(y) || x.length !== y.length) { console.log('écart en', trail, ': longueurs', x.length, y && y.length); return false; }
    for (let i = 0; i < x.length; i++) if (!same(x[i], y[i], trail + '[' + i + ']')) return false;
    return true;
  }
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
    if (SKIP.has(k)) continue;
    if (!same(x[k], y[k], trail + '.' + k)) { console.log('  avant :', where(x, src), '\n  après :', where(y, min)); return false; }
  }
  return true;
}
const ok = same(a, b, 'Program');
console.log(ok ? 'identique' : 'DIFFÉRENT', '(' + src.length + ' caractères, ' + min.length + ' une fois réduit)');
process.exit(ok ? 0 : 1);
