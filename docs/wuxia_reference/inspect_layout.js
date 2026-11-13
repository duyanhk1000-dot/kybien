const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'raw_assets');
const layoutCode = fs.readFileSync(path.join(dir, 'GameLayout-gkwrJoHQ.js'), 'utf8');

// Find string literals in layout
const strings = layoutCode.match(/"([^"\\]|\\.)*"/g) || [];
const uniqueStrings = [...new Set(strings.map(s => s.slice(1, -1)))].filter(s => s.length > 2 && s.length < 50);

console.log('--- GAMELAYOUT STRINGS ---');
console.log(uniqueStrings.filter(s => 
  s.includes('nav') || s.includes('header') || s.includes('tab') || s.includes('bar') || 
  s.includes('view') || s.includes('modal') || s.includes('character') || s.includes('battle') ||
  s.includes('explore') || s.includes('inventory')
).slice(0, 40));

// Check index-Di0RD3h2.js (router or app entry)
const indexCode = fs.readFileSync(path.join(dir, 'index-Di0RD3h2.js'), 'utf8');
const indexStrings = indexCode.match(/"([^"\\]|\\.)*"/g) || [];
const routes = [...new Set(indexStrings.map(s => s.slice(1, -1)))].filter(s => s.startsWith('/') || s.includes('path') || s.includes('name'));
console.log('--- ROUTES / ENTRY ---');
console.log(routes.slice(0, 30));
