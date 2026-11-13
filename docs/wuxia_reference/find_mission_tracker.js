const fs = require('fs');

const s = fs.readFileSync('d:/Lap trinh game/ky_bien/docs/wuxia_reference/raw_assets/ExplorationView-CqvcFkD1.js', 'utf8');

// Find where agency.missionTracker is used
let idx = 0;
while ((idx = s.indexOf('missionTracker', idx)) !== -1) {
  console.log('--- AT IDX ' + idx + ' ---');
  console.log(s.slice(Math.max(0, idx - 150), idx + 250));
  idx += 'missionTracker'.length;
}
