#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const postgres = require('postgres')

function readPositiveInt(name, fallback) {
  const value = Number.parseInt(process.env[name] || '', 10)
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isConnectionLimitError(error) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const code = typeof error.code === 'string' ? error.code : ''
  const message = typeof error.message === 'string' ? error.message : ''

  if (code === '53300') {
    return true
  }

  if (code === 'XX000' && /max client connections reached/i.test(message)) {
    return true
  }

  return /too many clients/i.test(message)
}

async function withRetry(label, fn, attempts, baseDelayMs) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    }
    catch (error) {
      const shouldRetry = isConnectionLimitError(error) && attempt < attempts
      if (!shouldRetry) {
        throw error
      }

      const delay = baseDelayMs * attempt
      console.warn(
        `${label} failed due to DB connection limits (attempt ${attempt}/${attempts}). Retrying in ${delay}ms...`,
      )
      await sleep(delay)
    }
  }
}

async function applyMigrations(sql) {
  console.log('Applying migrations...')

  console.log('Creating migrations tracking table...')
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE migrations ENABLE ROW LEVEL SECURITY;

    DO
    $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_migrations' AND tablename = 'migrations') THEN
          CREATE POLICY "service_role_all_migrations" ON migrations FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
        END IF;
      END
    $$;
  `, [], { simple: true })
  console.log('Migrations table ready')

  const migrationsDir = path.join(__dirname, '../src/lib/db/migrations')
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort()

  console.log(`Found ${migrationFiles.length} migration files`)

  for (const file of migrationFiles) {
    const version = file.replace('.sql', '')

    const result = await sql`
      SELECT version FROM migrations WHERE version = ${version}
    `

    if (result.length > 0) {
      console.log(`⏭️ Skipping ${file} (already applied)`)
      continue
    }

    console.log(`🔄 Applying ${file}`)
    const migrationSql = fs.readFileSync(
      path.join(migrationsDir, file),
      'utf8',
    )

    await sql.begin(async (tx) => {
      await tx.unsafe(migrationSql, [], { simple: true })
      await tx`INSERT INTO migrations (version) VALUES (${version})`
    })

    console.log(`✅ Applied ${file}`)
  }

  console.log('✅ All migrations applied successfully')
}

async function createCleanCronDetailsCron(sql) {
  console.log('Creating clean cron details job...')
  const sqlQuery = `
  DO $$
  DECLARE
    job_id int;
    cmd text := $c$
      DELETE FROM cron.job_run_details
      WHERE start_time < now() - interval '1 day';
    $c$;
  BEGIN
    SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'clean-cron-details';

    IF job_id IS NOT NULL THEN
      PERFORM cron.unschedule(job_id);
    END IF;

    PERFORM cron.schedule('clean-cron-details', '0 0 * * *', cmd);
  END $$;`

  await sql.unsafe(sqlQuery, [], { simple: true })
  console.log('✅ Cron clean-cron-details created successfully')
}

async function createSyncEventsCron(sql) {
  console.log('Creating sync-events cron job...')
  const sqlQuery = `
  DO $$
  DECLARE
    job_id int;
    cmd text := $c$
      SELECT net.http_get(
        url := 'https://<<VERCEL_URL>>/api/sync/events',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer <<CRON_SECRET>>"}'
      );
    $c$;
  BEGIN
    SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'sync-events';

    IF job_id IS NOT NULL THEN
      PERFORM cron.unschedule(job_id);
    END IF;

    PERFORM cron.schedule('sync-events', '*/5 * * * *', cmd);
  END $$;`

  const updatedSQL = sqlQuery
    .replace('<<VERCEL_URL>>', process.env.VERCEL_PROJECT_PRODUCTION_URL)
    .replace('<<CRON_SECRET>>', process.env.CRON_SECRET)

  await sql.unsafe(updatedSQL, [], { simple: true })
  console.log('✅ Cron sync-events created successfully')
}

async function createSyncVolumeCron(sql) {
  console.log('Creating sync-volume cron job...')
  const sqlQuery = `
  DO $$
  DECLARE
    job_id int;
    cmd text := $c$
      SELECT net.http_get(
        url := 'https://<<VERCEL_URL>>/api/sync/volume',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer <<CRON_SECRET>>"}'
      );
    $c$;
  BEGIN
    SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'sync-volume';

    IF job_id IS NOT NULL THEN
      PERFORM cron.unschedule(job_id);
    END IF;

    PERFORM cron.schedule('sync-volume', '*/30 * * * *', cmd);
  END $$;`

  const updatedSQL = sqlQuery
    .replace('<<VERCEL_URL>>', process.env.VERCEL_PROJECT_PRODUCTION_URL)
    .replace('<<CRON_SECRET>>', process.env.CRON_SECRET)

  await sql.unsafe(updatedSQL, [], { simple: true })
  console.log('✅ Cron sync-volume created successfully')
}

function shouldSkip(requiredEnvVars) {
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar])
  if (missing.length === 0) {
    return false
  }

  console.log(`Skipping db:push because required env vars are missing: ${missing.join(', ')}`)
  return true
}

async function run() {
  const requiredEnvVars = ['POSTGRES_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'CRON_SECRET']
  if (shouldSkip(requiredEnvVars)) {
    return
  }

  const maxConnections = readPositiveInt('DB_PUSH_MAX_CONNECTIONS', 1)
  const retryAttempts = readPositiveInt('DB_PUSH_MAX_RETRIES', 8)
  const retryDelayMs = readPositiveInt('DB_PUSH_RETRY_DELAY_MS', 1000)

  const connectionString = process.env.POSTGRES_URL.replace('require', 'disable')
  const sql = postgres(connectionString, {
    max: maxConnections,
    connect_timeout: 30,
    idle_timeout: 5,
  })

  try {
    console.log('Connecting to database...')
    await withRetry(
      'Database ping',
      async () => {
        await sql`SELECT 1`
      },
      retryAttempts,
      retryDelayMs,
    )
    console.log('Connected to database successfully')

    await withRetry('Apply migrations', async () => applyMigrations(sql), retryAttempts, retryDelayMs)
    await withRetry('Create clean cron', async () => createCleanCronDetailsCron(sql), retryAttempts, retryDelayMs)
    await withRetry('Create sync-events cron', async () => createSyncEventsCron(sql), retryAttempts, retryDelayMs)
    await withRetry('Create sync-volume cron', async () => createSyncVolumeCron(sql), retryAttempts, retryDelayMs)
  }
  catch (error) {
    console.error('An error occurred:', error)
    process.exitCode = 1
  }
  finally {
    console.log('Closing database connection...')
    await sql.end()
    console.log('Connection closed.')
  }
}

run()
