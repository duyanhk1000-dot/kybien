const fs = require('fs');

const s = fs.readFileSync('d:/Lap trinh game/ky_bien/docs/wuxia_reference/raw_assets/ExplorationView-CqvcFkD1.js', 'utf8');

// Find occurrences of missionTracker or kinds
const idx = s.indexOf('agency.missionTracker.kind.');
if (idx !== -1) {
  console.log('--- MISSION KINDS SNIPPET ---');
  console.log(s.slice(idx - 100, idx + 500));
}

// Search for mission types in the code
const kindMatches = s.match(/kind\s*:\s*["'][A-Za-z0-9_-]+["']/g) || [];
console.log('--- KIND MATCHES ---');
console.log([...new Set(kindMatches)]);

// Search for mission board properties or types
const boardIdx = s.indexOf('active_mission');
if (boardIdx !== -1) {
  console.log('--- ACTIVE MISSION SNIPPET ---');
  console.log(s.slice(boardIdx - 200, boardIdx + 800));
}
