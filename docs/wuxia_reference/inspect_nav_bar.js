const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'raw_assets');
const layoutJs = fs.readFileSync(path.join(dir, 'GameLayout-gkwrJoHQ.js'), 'utf8');

console.log('Snippet before ExplorationView (length 1500):');
console.log(layoutJs.slice(27500, 29700));
