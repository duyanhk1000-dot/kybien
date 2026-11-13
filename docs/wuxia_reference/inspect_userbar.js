const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'raw_assets');
const layoutJs = fs.readFileSync(path.join(dir, 'GameLayout-gkwrJoHQ.js'), 'utf8');

// Find snippets around GlobalUserBar
const idx = layoutJs.indexOf('GlobalUserBar');
if (idx !== -1) {
  console.log('--- GLOBAL USER BAR SNIPPET ---');
  console.log(layoutJs.slice(Math.max(0, idx - 200), idx + 500));
}

// Find snippets around Navigation / Tabs in GameLayout
const navMatches = layoutJs.match(/(activeTab|currentTab|tab\s*===|view\s*===)[^;]+/g) || [];
console.log('--- TAB / VIEW SWITCHING ---');
console.log(navMatches.slice(0, 15));
