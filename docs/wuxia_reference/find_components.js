const fs = require('fs');

const s = fs.readFileSync('d:/Lap trinh game/ky_bien/docs/wuxia_reference/raw_assets/ExplorationView-CqvcFkD1.js', 'utf8');

// Find all occurrences of agency components
const components = s.match(/[A-Z][a-zA-Z0-9]*Agency[a-zA-Z0-9]*/g) || [];
console.log('--- AGENCY COMPONENTS ---');
console.log([...new Set(components)]);

// Find all occurrences of Mission
const missions = s.match(/[A-Z][a-zA-Z0-9]*Mission[a-zA-Z0-9]*/g) || [];
console.log('--- MISSION COMPONENTS ---');
console.log([...new Set(missions)]);
