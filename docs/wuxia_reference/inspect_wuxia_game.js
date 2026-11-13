const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'raw_assets');
const files = fs.readdirSync(dir);

console.log('--- WUXIA REFERENCE ASSETS ---');
console.log('Total files:', files.length);

const jsViews = files.filter(f => f.endsWith('.js') && (f.includes('View') || f.includes('Layout') || f.includes('Modal')));
console.log('Views / Layouts:', jsViews);

// Inspect GameLayout
const layoutCode = fs.readFileSync(path.join(dir, files.find(f => f.startsWith('GameLayout') && f.endsWith('.js'))), 'utf8');

// Look for navigation tabs, header, main layout
const routes = layoutCode.match(/to:\"[^\"]+\"|name:\"[^\"]+\"/g) || [];
console.log('Navigation / Routes:', [...new Set(routes)].slice(0, 20));

// Inspect PlayerDashboardView
const dashFile = files.find(f => f.startsWith('PlayerDashboardView') && f.endsWith('.js'));
if (dashFile) {
  const dashCode = fs.readFileSync(path.join(dir, dashFile), 'utf8');
  console.log('Dashboard length:', dashCode.length);
}

// Inspect ExplorationView
const expFile = files.find(f => f.startsWith('ExplorationView') && f.endsWith('.js'));
if (expFile) {
  const expCode = fs.readFileSync(path.join(dir, expFile), 'utf8');
  console.log('Exploration length:', expCode.length);
}

// Inspect BattleView
const battleFile = files.find(f => f.startsWith('BattleView') && f.endsWith('.js'));
if (battleFile) {
  const battleCode = fs.readFileSync(path.join(dir, battleFile), 'utf8');
  console.log('Battle length:', battleCode.length);
}
