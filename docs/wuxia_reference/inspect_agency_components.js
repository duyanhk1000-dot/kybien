const fs = require('fs');

const s = fs.readFileSync('d:/Lap trinh game/ky_bien/docs/wuxia_reference/raw_assets/ExplorationView-CqvcFkD1.js', 'utf8');

function inspectComponent(name) {
  const marker = `__name:\`${name}\``;
  const idx = s.indexOf(marker);
  if (idx !== -1) {
    console.log(`=== COMPONENT: ${name} ===`);
    console.log(s.slice(idx, idx + 2500));
  } else {
    console.log(`Component ${name} not found`);
  }
}

inspectComponent('AgencyPanel');
inspectComponent('AgencyActivities');
inspectComponent('AgencyMissionTracker');
