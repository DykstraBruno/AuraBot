import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  migrate: {
    seed: {
      run: 'npx tsx prisma/seed.ts',
    },
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
