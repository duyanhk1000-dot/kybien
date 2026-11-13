const fs = require('fs');

const s = fs.readFileSync('d:/Lap trinh game/ky_bien/docs/wuxia_reference/raw_assets/ExplorationView-CqvcFkD1.js', 'utf8');

const marker = `__name:\`AgencyPanel\``;
const idx = s.indexOf(marker);
if (idx !== -1) {
  // Let's print the template return function
  console.log(s.slice(idx + 2500, idx + 7000));
}
