const fs = require('fs');
const path = require('path');

const dir = 'd:/Lap trinh game/ky_bien/docs/wuxia_reference/raw_assets';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

console.log('Searching for translations of agency.missionTracker.kind in all js files:');

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  if (content.includes('agency.missionTracker.kind') || content.includes('HUNT') && content.includes('ESCORT') && content.includes('COURIER')) {
    console.log(`Found in ${file}!`);
    // Find snippets with HUNT, ESCORT, COURIER
    const idx = content.indexOf('COURIER');
    if (idx !== -1) {
      console.log(`[${file}] COURIER snippet:`);
      console.log(content.slice(Math.max(0, idx - 100), idx + 200));
    }
  }
}
