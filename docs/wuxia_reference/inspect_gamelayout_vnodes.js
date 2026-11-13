const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'raw_assets');
const layoutJs = fs.readFileSync(path.join(dir, 'GameLayout-gkwrJoHQ.js'), 'utf8');

// Look for JSX or _createElementVNode / _createVNode / _toDisplayString
const vnodes = layoutJs.match(/_createElementVNode\("([^"]+)"/g) || [];
console.log('Elements created in GameLayout:', [...new Set(vnodes)].slice(0, 30));

// Find class names in GameLayout
const classNames = layoutJs.match(/class:\s*"([^"]+)"/g) || [];
console.log('Class names in GameLayout:', [...new Set(classNames)].slice(0, 30));

// Check what children/components GameLayout renders
const components = layoutJs.match(/[A-Z][a-zA-Z0-9]+View|[A-Z][a-zA-Z0-9]+Bar|[A-Z][a-zA-Z0-9]+Nav|[A-Z][a-zA-Z0-9]+Modal/g) || [];
console.log('Referenced components in GameLayout:', [...new Set(components)]);
