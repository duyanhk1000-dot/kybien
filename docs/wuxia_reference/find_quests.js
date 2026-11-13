const fs = require('fs');
const path = require('path');

const dir = 'd:/Lap trinh game/ky_bien/docs/wuxia_reference/raw_assets';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

console.log('Searching for quest/exploration/mission patterns across raw_assets:');

const keywords = ['quest', 'mission', 'bounty', 'expedition', 'agency', 'commission', 'destination', 'journey', 'task'];

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  for (const kw of keywords) {
    const regex = new RegExp(`[a-zA-Z0-9_.-]*${kw}[a-zA-Z0-9_.-]*`, 'gi');
    const matches = content.match(regex);
    if (matches && matches.length > 5) {
      const unique = [...new Set(matches.map(m => m.toLowerCase()))];
      console.log(`[${file}] matched "${kw}": ${unique.slice(0, 10).join(', ')} (count: ${matches.length})`);
    }
  }
}
