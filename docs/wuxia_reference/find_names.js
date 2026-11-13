const fs = require('fs');

const s = fs.readFileSync('d:/Lap trinh game/ky_bien/docs/wuxia_reference/raw_assets/ExplorationView-CqvcFkD1.js', 'utf8');

const regex = /__name\s*:\s*[`"']([^`"']+)[`"']/g;
let match;
const names = [];
while ((match = regex.exec(s)) !== null) {
  names.push(match[1]);
}
console.log('Components in ExplorationView (with backticks):', names);
