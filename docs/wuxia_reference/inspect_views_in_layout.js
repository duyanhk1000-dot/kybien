const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'raw_assets');
const layoutJs = fs.readFileSync(path.join(dir, 'GameLayout-gkwrJoHQ.js'), 'utf8');

const views = ['ExplorationView', 'BattleView', 'PlayerDashboardView', 'CharacterView'];
for (const v of views) {
  const idx = layoutJs.indexOf(v);
  console.log(`=== ${v} (at ${idx}) ===`);
  if (idx !== -1) {
    console.log(layoutJs.slice(Math.max(0, idx - 150), idx + 250));
  }
}
