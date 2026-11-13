const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'raw_assets');
const css = fs.readFileSync(path.join(dir, 'index-CJn87ZYv.css'), 'utf8');

console.log('CSS length:', css.length);

// Extract color variables or root theme
const rootMatch = css.match(/:root\s*\{[^}]+\}/g);
if (rootMatch) {
  console.log('--- ROOT THEME ---');
  console.log(rootMatch[0].slice(0, 500));
}

// Find key UI layout classes
const layoutClasses = css.match(/\.[a-zA-Z0-9_-]*(header|footer|sidebar|nav|tab|dock|hud|card|modal|log|battle|explore)[a-zA-Z0-9_-]*/gi) || [];
console.log('--- KEY UI CLASSES ---');
console.log([...new Set(layoutClasses)].slice(0, 40));

// Check GameLayout template structure
const layoutJs = fs.readFileSync(path.join(dir, 'GameLayout-gkwrJoHQ.js'), 'utf8');
// Find HTML tag patterns in layoutJs
const tags = layoutJs.match(/<[a-z0-9-]+[^>]*>/gi) || [];
console.log('--- GAMELAYOUT TAGS ---');
console.log([...new Set(tags)].slice(0, 30));
