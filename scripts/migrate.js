#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const postgres = require('postgres')
const { resolveSiteUrl } = require('../src/lib/site-url')

function escapeSqlLiteral(value) {
  return String(value).replace(/'/g, '\'\'')
}

function buildSyncCronSql({
  jobName,
  schedule,
  endpointPath,
  siteUrl,
  cronSecret,
}) {
  const endpointUrl = `${siteUrl}/${endpointPath}`
  const escapedJobName = escapeSqlLiteral(jobName)
  const escapedSchedule = escapeSqlLiteral(schedule)
  const escapedEndpointUrl = escapeSqlLiteral(endpointUrl)
  const escapedHeaders = escapeSqlLiteral(JSON.stringify({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${cronSecret}`,
  }))

  return `
  DO $$
  DECLARE
    job_id int;
    cmd text := $c$
      SELECT net.http_get(
        url := '${escapedEndpointUrl}',
        headers := '${escapedHeaders}'
      );
    $c$;
  BEGIN
    SELECT jobid INTO job_id FROM cron.job WHERE jobname = '${escapedJobName}';

    IF job_id IS NOT NULL THEN
      PERFORM cron.unschedule(job_id);
    END IF;

    PERFORM cron.schedule('${escapedJobName}', '${escapedSchedule}', cmd);
  END $$;`
}

function resolveSupabaseMode(env = process.env) {
  const supabaseUrl = env.SUPABASE_URL?.trim()
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  const hasAnySupabaseConfig = Boolean(supabaseUrl || supabaseServiceRoleKey)
  if (!hasAnySupabaseConfig) {
    return false
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set together when configuring Supabase mode.')
  }

  return true
}

function rewriteMigrationSqlForMode(migrationSql, isSupabase) {
  if (isSupabase) {
    return migrationSql
  }

  return migrationSql
    .replace(/\bTO\s+"service_role"\b/gi, 'TO CURRENT_USER')
    .replace(/\bTO\s+service_role\b/gi, 'TO CURRENT_USER')
}

async function applyMigrations(sql, isSupabase) {
  console.log('Applying migrations...')

  console.log('Creating migrations tracking table...')
  const migrationsPolicyRole = isSupabase ? 'service_role' : 'CURRENT_USER'
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
          CREATE POLICY "service_role_all_migrations" ON migrations FOR ALL TO ${migrationsPolicyRole} USING (TRUE) WITH CHECK (TRUE);
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
    const rawMigrationSql = fs.readFileSync(
      path.join(migrationsDir, file),
      'utf8',
    )
    const migrationSql = rewriteMigrationSqlForMode(rawMigrationSql, isSupabase)

    if (!isSupabase && rawMigrationSql !== migrationSql) {
      console.log(`ℹ️ Applied compatibility rewrite for ${file} (service_role -> CURRENT_USER)`)
    }

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

async function createCleanJobsCron(sql) {
  console.log('Creating clean-jobs cron job...')
  const sqlQuery = `
  DO $$
  DECLARE
    job_id int;
    cmd text := $c$
      UPDATE jobs
      SET
        status = 'pending',
        available_at = NOW(),
        reserved_at = NULL,
        last_error = CASE
          WHEN COALESCE(last_error, '') = '' THEN '[Recovered stale processing job]'
          ELSE last_error || ' [Recovered stale processing job]'
        END
      WHERE status = 'processing'
        AND (
          reserved_at IS NULL
          OR reserved_at < NOW() - interval '30 minutes'
        );

      DELETE FROM jobs
      WHERE status = 'completed'
        AND updated_at < NOW() - interval '14 days';

      DELETE FROM jobs
      WHERE status = 'failed'
        AND updated_at < NOW() - interval '30 days';
    $c$;
  BEGIN
    SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'clean-jobs';

    IF job_id IS NOT NULL THEN
      PERFORM cron.unschedule(job_id);
    END IF;

    PERFORM cron.schedule('clean-jobs', '15 * * * *', cmd);
  END $$;`

  await sql.unsafe(sqlQuery, [], { simple: true })
  console.log('✅ Cron clean-jobs created successfully')
}

async function createSyncCron(sql, options) {
  const sqlQuery = buildSyncCronSql(options)
  console.log(`Creating ${options.jobName} cron job...`)
  await sql.unsafe(sqlQuery, [], { simple: true })
  console.log(`✅ Cron ${options.jobName} created successfully`)
}

async function createSyncEventsCron(sql, siteUrl, cronSecret) {
  await createSyncCron(sql, {
    jobName: 'sync-events',
    schedule: '1-59/5 * * * *',
    endpointPath: '/api/sync/events',
    siteUrl,
    cronSecret,
  })
}

async function createSyncVolumeCron(sql, siteUrl, cronSecret) {
  await createSyncCron(sql, {
    jobName: 'sync-volume',
    schedule: '14,44 * * * *',
    endpointPath: '/api/sync/volume',
    siteUrl,
    cronSecret,
  })
}

async function createSyncTranslationsCron(sql, siteUrl, cronSecret) {
  await createSyncCron(sql, {
    jobName: 'sync-translations',
    schedule: '*/10 * * * *',
    endpointPath: '/api/sync/translations',
    siteUrl,
    cronSecret,
  })
}

async function createSyncResolutionCron(sql, siteUrl, cronSecret) {
  await createSyncCron(sql, {
    jobName: 'sync-resolution',
    schedule: '3-59/5 * * * *',
    endpointPath: '/api/sync/resolution',
    siteUrl,
    cronSecret,
  })
}

async function resolveCronExtensionCapabilities(sql) {
  const result = await sql`
    SELECT
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS has_pg_cron,
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') AS has_pg_net
  `

  return {
    hasPgCron: Boolean(result[0]?.has_pg_cron),
    hasPgNet: Boolean(result[0]?.has_pg_net),
  }
}

async function configureSupabaseScheduler(sql, siteUrl, cronSecret) {
  const { hasPgCron, hasPgNet } = await resolveCronExtensionCapabilities(sql)

  if (!hasPgCron) {
    console.log('Skipping scheduler setup because pg_cron is not installed in this database.')
    return
  }

  await createCleanCronDetailsCron(sql)
  await createCleanJobsCron(sql)

  if (!hasPgNet) {
    console.log('Skipping sync endpoint cron setup because pg_net is not installed. Configure scheduler externally.')
    return
  }

  if (!cronSecret) {
    console.log('Skipping sync endpoint cron setup because CRON_SECRET is missing. Configure scheduler externally or rerun db:push with CRON_SECRET.')
    return
  }

  await createSyncEventsCron(sql, siteUrl, cronSecret)
  await createSyncTranslationsCron(sql, siteUrl, cronSecret)
  await createSyncResolutionCron(sql, siteUrl, cronSecret)
  await createSyncVolumeCron(sql, siteUrl, cronSecret)
}

function resolveMigrationConnectionString() {
  const migrationUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL

  if (!migrationUrl) {
    return null
  }

  return migrationUrl.replace('require', 'disable')
}

async function run() {
  const connectionString = resolveMigrationConnectionString()
  if (!connectionString) {
    console.log('Skipping db:push because required env vars are missing: POSTGRES_URL_NON_POOLING or POSTGRES_URL')
    return
  }

  const sql = postgres(connectionString, {
    max: 1,
    connect_timeout: 30,
    idle_timeout: 5,
  })

  try {
    const isSupabaseMode = resolveSupabaseMode(process.env)
    const siteUrl = resolveSiteUrl(process.env)
    const cronSecret = process.env.CRON_SECRET?.trim() || ''

    console.log('Connecting to database...')
    await sql`SELECT 1`
    console.log('Connected to database successfully')

    console.log(`Migration mode: ${isSupabaseMode ? 'supabase' : 'postgres+s3 (no Supabase cron/storage dependencies)'}`)
    await applyMigrations(sql, isSupabaseMode)

    if (isSupabaseMode) {
      await configureSupabaseScheduler(sql, siteUrl, cronSecret)
    }
    else {
      console.log('Skipping database scheduler setup because Supabase mode is not configured. Use external scheduler contract from infra/scheduler-contract.md.')
    }
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
