import { prisma } from '../utils/prisma.js';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🔍 DUMPING ALL PUZZLES FROM SUPABASE POSTGRESQL...\n');

  const puzzles = await prisma.puzzle.findMany({
    orderBy: { id: 'asc' },
  });

  console.log(`Fetched ${puzzles.length} puzzles from database.`);

  const dump = puzzles.map(p => ({
    id: p.id,
    order_index: p.order_index,
    title: p.title,
    fen: p.fen,
    status: p.status,
    tier: p.tier,
    solution_tree_length: p.solution_tree ? p.solution_tree.length : 0,
    solution_tree_parsed: p.solution_tree ? JSON.parse(p.solution_tree) : null,
  }));

  const outPath = path.join(process.cwd(), 'db_puzzles_dump.json');
  fs.writeFileSync(outPath, JSON.stringify(dump, null, 2), 'utf8');
  console.log(`Dump written to ${outPath}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Failed to dump DB puzzles:', err);
  process.exit(1);
});
