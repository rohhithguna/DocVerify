# Database Setup Guide

## Quick Start

### Option 1: Neon (Recommended - Free, No Install)

1. **Sign up at** https://neon.tech
2. **Create a new project** → get connection string
3. **Add to .env:**
   ```bash
   DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/docuverify?sslmode=require
   ```

4. **Run migrations:**
   ```bash
   npm run db:push
   ```

### Option 2: Local PostgreSQL

1. **Install PostgreSQL:**
   ```bash
   # macOS
   brew install postgresql@15
   brew services start postgresql@15
   
   # Ubuntu
   sudo apt-get install postgresql postgresql-contrib
   sudo systemctl start postgresql
   ```

2. **Create database:**
   ```bash
   psql postgres
   CREATE DATABASE docuverify;
   CREATE USER docuverify_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE docuverify TO docuverify_user;
   \q
   ```

3. **Add to .env:**
   ```bash
   DATABASE_URL=postgresql://docuverify_user:your_password@localhost:5432/docuverify
   ```

4. **Run migrations:**
   ```bash
   npm run db:push
   ```

---

## Database Schema

The migrations will create these tables:

### document_batches
- `id` (UUID, primary key)
- `batch_name` (text)
- `issuer_id` (text)
- `issuer_name` (text)
- `file_name` (text)
- `document_count` (integer)
- `grouping_criterion` (text)
- `merkle_root` (text, nullable)
- `blockchain_tx_hash` (text, nullable)
- `block_number` (text, nullable)
- `status` (text)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### documents
- `id` (UUID, primary key)
- `batch_id` (UUID, foreign key → document_batches.id)
- `document_hash` (text)
- `digital_signature` (text, nullable)
- `original_data` (jsonb)
- `merkle_proof` (jsonb, nullable)
- `created_at` (timestamp)

### verifications
- `id` (UUID, primary key)
- `verifier_id` (text)
- `file_name` (text)
- `document_hash` (text)
- `digital_signature_valid` (boolean, nullable)
- `merkle_proof_valid` (boolean, nullable)
- `blockchain_verified` (boolean, nullable)
- `confidence_score` (integer, nullable)
- `matched_batch_id` (UUID, foreign key, nullable)
- `matched_document_id` (UUID, foreign key, nullable)
- `status` (text)
- `error_message` (text, nullable)
- `verification_data` (jsonb, nullable)
- `created_at` (timestamp)

### blockchain_status
- `id` (UUID, primary key)
- `network` (text)
- `block_height` (text, nullable)
- `gas_price` (text, nullable)
- `status` (text)
- `last_updated` (timestamp)

---

## Testing Database Persistence

### 1. Upload a batch
```bash
# Start server
npm run dev

# Upload CSV as issuer
# Note the batch ID
```

### 2. Restart server
```bash
# Stop server (Ctrl+C)
# Start again
npm run dev
```

### 3. Verify data persists
```bash
# Navigate to issuer dashboard
# Your batch should still be there!
```

### 4. Test verification after restart
```bash
# Upload same CSV row as verifier
# Should still verify successfully
# Confidence score: 100%
```

---

## Database Commands

### View all batches
```bash
psql $DATABASE_URL -c "SELECT id, batch_name, status, created_at FROM document_batches;"
```

### View verifications
```bash
psql $DATABASE_URL -c "SELECT file_name, confidence_score, status FROM verifications ORDER BY created_at DESC LIMIT 10;"
```

### Count records
```bash
psql $DATABASE_URL -c "
SELECT 
  (SELECT COUNT(*) FROM document_batches) as batches,
  (SELECT COUNT(*) FROM documents) as documents,
  (SELECT COUNT(*) FROM verifications) as verifications;"
```

### Reset database (caution!)
```bash
psql $DATABASE_URL -c "
DROP TABLE IF EXISTS verifications CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS document_batches CASCADE;
DROP TABLE IF EXISTS blockchain_status CASCADE;"

# Then re-run migrations
npm run db:push
```

---

## Troubleshooting

### "Missing DATABASE_URL environment variable"
**Solution:** Add DATABASE_URL to your .env file

### "Connection refused"
**Solution:** 
- Check PostgreSQL is running: `brew services list` or `systemctl status postgresql`
- Verify port 5432 is open
- Test connection: `psql $DATABASE_URL`

### "Permission denied"
**Solution:** Grant privileges to your database user:
```sql
GRANT ALL PRIVILEGES ON DATABASE docuverify TO docuverify_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO docuverify_user;
```

### "SSL connection required"
**Solution:** Add `?sslmode=require` to Neon/Supabase URLs

### Data not persisting
**Check:**
1. DATABASE_URL is set correctly
2. Server logs show "✓ Database connection established"
3. Migrations were run: `npm run db:push`
4. Check database: `psql $DATABASE_URL -c "\dt"`

---

## Migration Workflow

### Apply schema changes
```bash
npm run db:push
```

### Generate migration files
```bash
npx drizzle-kit generate:pg
```

### View current schema
```bash
npx drizzle-kit introspect:pg
```

---

## Performance Tips

### Add indexes (after initial setup)
```sql
-- Speed up document hash lookups
CREATE INDEX idx_documents_hash ON documents(document_hash);

-- Speed up batch queries
CREATE INDEX idx_batches_issuer ON document_batches(issuer_id);

-- Speed up verification queries
CREATE INDEX idx_verifications_verifier ON verifications(verifier_id);
CREATE INDEX idx_verifications_batch ON verifications(matched_batch_id);
```

### Monitor query performance
```sql
EXPLAIN ANALYZE SELECT * FROM documents WHERE document_hash = 'abc123...';
```

---

## Backup & Recovery

### Backup database
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Restore from backup
```bash
psql $DATABASE_URL < backup_20251204.sql
```

### Export specific table
```bash
psql $DATABASE_URL -c "\COPY document_batches TO 'batches.csv' CSV HEADER;"
```

---

## Success Checklist

- [ ] DATABASE_URL set in .env
- [ ] `npm run db:push` completed successfully
- [ ] Server shows "✓ Database connection established"
- [ ] Upload batch as issuer
- [ ] Restart server
- [ ] Batch still appears in dashboard
- [ ] Verification works after restart
- [ ] No "⚠️ Using in-memory storage" warning

---

**Status:** ✅ Database persistence implemented (BUG #1 fixed)
