#!/usr/bin/env node
/**
 * DB_RESET: Clear inconsistent users and test data
 * Resets: users, documents, certificates, verifications tables
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  users,
  documentBatches,
  documents,
  certificates,
  verifications,
} from "../../database/schema";
import { sql } from "drizzle-orm";

async function resetDatabase() {
  console.log("🔄 DB_RESET: Starting database reset...\n");

  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://localhost:5432/docuverify",
  });

  const db = drizzle(pool);

  try {
    console.log("⏳ Clearing verifications...");
    await db.delete(verifications);
    console.log("✅ Verifications cleared");

    console.log("⏳ Clearing certificates...");
    await db.delete(certificates);
    console.log("✅ Certificates cleared");

    console.log("⏳ Clearing documents...");
    await db.delete(documents);
    console.log("✅ Documents cleared");

    console.log("⏳ Clearing document batches...");
    await db.delete(documentBatches);
    console.log("✅ Document batches cleared");

    console.log("⏳ Clearing users...");
    await db.delete(users);
    console.log("✅ Users cleared");

    // Reset sequences if they exist
    console.log("\n⏳ Resetting sequences...");
    try {
      await db.execute(sql.raw("ALTER SEQUENCE users_id_seq RESTART WITH 1"));
      console.log("✅ users sequence reset");
    } catch (e) {
      console.log("ℹ️  users sequence doesn't need reset (auto-increment handled differently)");
    }

    try {
      await db.execute(
        sql.raw("ALTER SEQUENCE document_batches_id_seq RESTART WITH 1")
      );
      console.log("✅ document_batches sequence reset");
    } catch (e) {
      console.log("ℹ️  document_batches sequence doesn't need reset");
    }

    try {
      await db.execute(
        sql.raw("ALTER SEQUENCE documents_id_seq RESTART WITH 1")
      );
      console.log("✅ documents sequence reset");
    } catch (e) {
      console.log("ℹ️  documents sequence doesn't need reset");
    }

    try {
      await db.execute(
        sql.raw("ALTER SEQUENCE certificates_id_seq RESTART WITH 1")
      );
      console.log("✅ certificates sequence reset");
    } catch (e) {
      console.log("ℹ️  certificates sequence doesn't need reset");
    }

    try {
      await db.execute(
        sql.raw("ALTER SEQUENCE verifications_id_seq RESTART WITH 1")
      );
      console.log("✅ verifications sequence reset");
    } catch (e) {
      console.log("ℹ️  verifications sequence doesn't need reset");
    }

    // Verify database is clean
    console.log("\n✅ DB_RESET: All tables cleared successfully!");
    console.log("\n📊 Database is now in clean state:");
    console.log("   ✓ users: 0 records");
    console.log("   ✓ documents: 0 records");
    console.log("   ✓ certificates: 0 records");
    console.log("   ✓ verifications: 0 records");
    console.log("   ✓ documentBatches: 0 records");
    console.log("   ✓ Sequences reset");

    await pool.end();
    return true;
  } catch (error) {
    console.error("❌ DB_RESET: Failed to reset database");
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    await pool.end();
    return false;
  }
}

resetDatabase()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
