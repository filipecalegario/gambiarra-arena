import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // Create test session with PIN 123456
  const pin = '123456';
  const pinHash = await bcrypt.hash(pin, 10);

  const session = await prisma.session.create({
    data: {
      pinHash,
      status: 'active',
    },
  });

  console.log(`✅ Session created: ${session.id}`);
  console.log(`🔑 PIN: ${pin}`);

  // Create test participants
  const participants = [
    {
      id: 'ana-desktop',
      nickname: 'Ana',
      runner: 'ollama',
      model: 'llama3.1:8b',
    },
    {
      id: 'bruno-laptop',
      nickname: 'Bruno',
      runner: 'lmstudio',
      model: 'mistral-7b',
    },
    {
      id: 'carla-workstation',
      nickname: 'Carla',
      runner: 'ollama',
      model: 'phi3:medium',
    },
  ];

  for (const p of participants) {
    await prisma.participant.create({
      data: {
        ...p,
        sessionId: session.id,
      },
    });
    console.log(`👤 Participant created: ${p.nickname} (${p.id})`);
  }

  // Create test round
  const round = await prisma.round.create({
    data: {
      sessionId: session.id,
      index: 1,
      prompt: 'Escreva uma poesia em métrica de xote pernambucano sobre inteligência artificial',
      maxTokens: 400,
      temperature: 0.8,
      deadlineMs: 90000,
      seed: 1234,
    },
  });

  console.log(`📝 Round created: Round ${round.index}`);

  console.log('\n✨ Seed completed!');
  console.log(`\nConnect participants with: --url ws://localhost:3000/ws --pin ${pin}\n`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
