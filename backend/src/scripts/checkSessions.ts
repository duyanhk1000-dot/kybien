import { prisma } from '../utils/prisma.js';

async function main() {
  const sessions = await prisma.puzzleSession.findMany({
    where: { puzzle_id: 107 },
    orderBy: { created_at: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(sessions, null, 2));
}

main().finally(() => prisma.$disconnect());
