const fs = require('fs');

const s = fs.readFileSync('d:/Lap trinh game/ky_bien/docs/wuxia_reference/raw_assets/ExplorationView-CqvcFkD1.js', 'utf8');

// Search for all strings matching agency.* or mission.*
const translationKeys = s.match(/(agency\.[a-zA-Z0-9_.]+)/g) || [];
console.log('--- AGENCY TRANSLATION KEYS ---');
console.log([...new Set(translationKeys)].join('\n'));

// Search for mission kinds and types
const missionKinds = s.match(/agency\.missiontracker\.kind\.[a-zA-Z0-9_.]+/g) || [];
console.log('--- MISSION KINDS ---');
console.log([...new Set(missionKinds)].join('\n'));
