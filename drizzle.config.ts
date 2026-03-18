import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    "⚠️  DATABASE_URL not set. Run the following to push schema:\n" +
    "   1. Set DATABASE_URL in .env (get one from https://neon.tech)\n" +
    "   2. Run: npm run db:push"
  );
}

export default defineConfig({
  out: "./migrations",
  schema: "./database/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl || "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
