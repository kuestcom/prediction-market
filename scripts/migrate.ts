#!/usr/bin/env node

const MIGRATION_LOCK_NAMESPACE = 20817
const MIGRATION_LOCK_KEY = 1

type NodeFs = typeof import('node:fs')
type NodePath = typeof import('node:path')
type Postgres = typeof import('postgres')
type ResolveSiteUrl = (env?: NodeJS.ProcessEnv) => string
type Sql = ReturnType<Postgres>
type ReservedSql = Awaited<ReturnType<Sql['reserve']>>
const SITE_URL_MODULE_PATH = '../src/lib/site-url.ts'

let fs: NodeFs
let path: NodePath
let postgres: Postgres
let resolveSiteUrl: ResolveSiteUrl
let scriptDirname: string

interface SyncCronOptions {
  jobName: string
  schedule: string
  endpointPath: string
  siteUrl: string
  cronSecret: string
  timeoutMilliseconds?: number
}

interface MigrationRow {
  version: string
}

interface CronExtensionCapabilitiesRow {
  has_pg_cron: boolean
  has_pg_net: boolean
}

interface CronExtensionCapabilities {
  hasPgCron: boolean
  hasPgNet: boolean
}

async function loadScriptDependencies(): Promise<void> {
  const [fsModule, pathModule, urlModule, postgresModule, siteUrlModule] = await Promise.all([
    import('node:fs'),
    import('node:path'),
    import('node:url'),
    import('postgres'),
    import(SITE_URL_MODULE_PATH),
  ])
  const postgresImport = postgresModule as unknown as { default?: Postgres } & Postgres
  const siteUrlImport = siteUrlModule as unknown as {
    default?: ResolveSiteUrl
    resolveSiteUrl?: ResolveSiteUrl
  }

  fs = fsModule
  path = pathModule
  postgres = postgresImport.default ?? postgresImport
  scriptDirname = path.dirname(urlModule.fileURLToPath(import.meta.url))
  const importedResolveSiteUrl = siteUrlImport.default ?? siteUrlImport.resolveSiteUrl

  if (!importedResolveSiteUrl) {
    throw new Error('Failed to load resolveSiteUrl from src/lib/site-url.ts')
  }

  resolveSiteUrl = importedResolveSiteUrl
}

function escapeSqlLiteral(value: unknown): string {
  return String(value).replace(/'/g, '\'\'')
}

function joinSiteUrlPath(siteUrl: string, endpointPath: string): string {
  const normalizedSiteUrl = String(siteUrl).trim().replace(/\/+$/, '')
  const normalizedEndpointPath = String(endpointPath).trim().replace(/^\/+/, '')

  if (!normalizedEndpointPath) {
    return normalizedSiteUrl
  }

  return `${normalizedSiteUrl}/${normalizedEndpointPath}`
}

function buildSyncCronSql({
  jobName,
  schedule,
  endpointPath,
  siteUrl,
  cronSecret,
  timeoutMilliseconds = 20000,
}: SyncCronOptions): string {
  const endpointUrl = joinSiteUrlPath(siteUrl, endpointPath)
  const escapedJobName = escapeSqlLiteral(jobName)
  const escapedSchedule = escapeSqlLiteral(schedule)
  const escapedEndpointUrl = escapeSqlLiteral(endpointUrl)
  const normalizedTimeout = Number.isFinite(Number(timeoutMilliseconds))
    ? Math.max(1000, Math.trunc(Number(timeoutMilliseconds)))
    : 20000
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
        headers := '${escapedHeaders}',
        timeout_milliseconds := ${normalizedTimeout}
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

function resolveSupabaseMode(env: NodeJS.ProcessEnv = process.env): boolean {
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

function rewriteMigrationSqlForMode(migrationSql: string, isSupabase: boolean): string {
  if (isSupabase) {
    return migrationSql
  }

  return migrationSql
    .replace(/\bTO\s+(?:"service_role"|service_role\b)/gi, 'TO CURRENT_USER')
}

async function withReservedTransaction<T>(
  sql: ReservedSql,
  fn: (tx: ReservedSql) => Promise<T>,
): Promise<T> {
  await sql`BEGIN`

  try {
    const result = await fn(sql)
    await sql`COMMIT`
    return result
  }
  catch (error) {
    try {
      await sql`ROLLBACK`
    }
    catch (rollbackError) {
      console.error('Failed to roll back migration transaction:', rollbackError)
    }

    throw error
  }
}

async function applyMigrations(sql: ReservedSql, isSupabase: boolean): Promise<void> {
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
  `, []).simple()
  console.log('Migrations table ready')

  const migrationsDir = path.join(scriptDirname, '../src/lib/db/migrations')
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort()

  console.log(`Found ${migrationFiles.length} migration files`)

  const appliedMigrationRows = await sql<MigrationRow[]>`SELECT version FROM migrations`
  const appliedMigrationVersions = new Set(appliedMigrationRows.map(row => row.version))
  const pendingMigrationFiles = migrationFiles.filter((file) => {
    const version = file.replace('.sql', '')
    return !appliedMigrationVersions.has(version)
  })

  const skippedMigrationCount = migrationFiles.length - pendingMigrationFiles.length

  if (skippedMigrationCount > 0) {
    console.log(`⏭️ Skipping ${skippedMigrationCount} already applied migrations`)
  }

  if (pendingMigrationFiles.length === 0) {
    console.log('No pending migrations')
    return
  }

  for (const file of pendingMigrationFiles) {
    const version = file.replace('.sql', '')

    console.log(`🔄 Applying ${file}`)
    const rawMigrationSql = fs.readFileSync(
      path.join(migrationsDir, file),
      'utf8',
    )
    const migrationSql = rewriteMigrationSqlForMode(rawMigrationSql, isSupabase)

    if (!isSupabase && rawMigrationSql !== migrationSql) {
      console.log(`ℹ️ Applied compatibility rewrite for ${file} (service_role -> CURRENT_USER)`)
    }

    await withReservedTransaction(sql, async (tx) => {
      await tx.unsafe(migrationSql, []).simple()
      await tx`INSERT INTO migrations (version) VALUES (${version})`
    })

    console.log(`✅ Applied ${file}`)
  }

  console.log('✅ All migrations applied successfully')
}

async function createCleanCronDetailsCron(sql: ReservedSql): Promise<void> {
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

  await sql.unsafe(sqlQuery, []).simple()
  console.log('✅ Cron clean-cron-details created successfully')
}

async function createCleanJobsCron(sql: ReservedSql): Promise<void> {
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

  await sql.unsafe(sqlQuery, []).simple()
  console.log('✅ Cron clean-jobs created successfully')
}

async function createSyncCron(sql: ReservedSql, options: SyncCronOptions): Promise<void> {
  const sqlQuery = buildSyncCronSql(options)
  console.log(`Creating ${options.jobName} cron job...`)
  await sql.unsafe(sqlQuery, []).simple()
  console.log(`✅ Cron ${options.jobName} created successfully`)
}

async function createSyncEventsCron(
  sql: ReservedSql,
  siteUrl: string,
  cronSecret: string,
): Promise<void> {
  await createSyncCron(sql, {
    jobName: 'sync-events',
    schedule: '2,11,20,29,38,47,56 * * * *',
    endpointPath: '/api/sync/events',
    siteUrl,
    cronSecret,
  })
}

async function createSyncVolumeCron(
  sql: ReservedSql,
  siteUrl: string,
  cronSecret: string,
): Promise<void> {
  await createSyncCron(sql, {
    jobName: 'sync-volume-enqueue',
    schedule: '*/10 * * * *',
    endpointPath: '/api/sync/volume/enqueue',
    siteUrl,
    cronSecret,
    timeoutMilliseconds: 10000,
  })

  await createSyncCron(sql, {
    jobName: 'sync-volume',
    schedule: '*/5 * * * *',
    endpointPath: '/api/sync/volume',
    siteUrl,
    cronSecret,
    timeoutMilliseconds: 30000,
  })
}

async function createSyncTranslationsCron(
  sql: ReservedSql,
  siteUrl: string,
  cronSecret: string,
): Promise<void> {
  await createSyncCron(sql, {
    jobName: 'sync-translations-enqueue',
    schedule: '17 * * * *',
    endpointPath: '/api/sync/translations/enqueue',
    siteUrl,
    cronSecret,
    timeoutMilliseconds: 20000,
  })

  await createSyncCron(sql, {
    jobName: 'sync-translations',
    schedule: '18 * * * *',
    endpointPath: '/api/sync/translations',
    siteUrl,
    cronSecret,
    timeoutMilliseconds: 30000,
  })
}

async function createSyncResolutionCron(
  sql: ReservedSql,
  siteUrl: string,
  cronSecret: string,
): Promise<void> {
  await createSyncCron(sql, {
    jobName: 'sync-resolution',
    schedule: '5-55/10 * * * *',
    endpointPath: '/api/sync/resolution',
    siteUrl,
    cronSecret,
  })
}

async function createSyncSportsScoresCron(
  sql: ReservedSql,
  siteUrl: string,
  cronSecret: string,
): Promise<void> {
  await createSyncCron(sql, {
    jobName: 'sync-sports-scores',
    schedule: '* * * * *',
    endpointPath: '/api/sync/sports-scores',
    siteUrl,
    cronSecret,
    timeoutMilliseconds: 30000,
  })
}

async function createSyncEventCreationsCron(
  sql: ReservedSql,
  siteUrl: string,
  cronSecret: string,
): Promise<void> {
  await createSyncCron(sql, {
    jobName: 'sync-event-creations-enqueue',
    schedule: '0,30 * * * *',
    endpointPath: '/api/sync/event-creations/enqueue',
    siteUrl,
    cronSecret,
    timeoutMilliseconds: 10000,
  })

  await createSyncCron(sql, {
    jobName: 'sync-event-creations',
    schedule: '1,31 * * * *',
    endpointPath: '/api/sync/event-creations',
    siteUrl,
    cronSecret,
  })
}

async function resolveCronExtensionCapabilities(sql: ReservedSql): Promise<CronExtensionCapabilities> {
  const result = await sql<CronExtensionCapabilitiesRow[]>`
    SELECT
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS has_pg_cron,
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') AS has_pg_net
  `

  return {
    hasPgCron: Boolean(result[0]?.has_pg_cron),
    hasPgNet: Boolean(result[0]?.has_pg_net),
  }
}

async function configureSupabaseScheduler(
  sql: ReservedSql,
  siteUrl: string,
  cronSecret: string,
): Promise<void> {
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
  await createSyncEventCreationsCron(sql, siteUrl, cronSecret)
  await createSyncTranslationsCron(sql, siteUrl, cronSecret)
  await createSyncResolutionCron(sql, siteUrl, cronSecret)
  await createSyncSportsScoresCron(sql, siteUrl, cronSecret)
  await createSyncVolumeCron(sql, siteUrl, cronSecret)
}

function resolveMigrationConnectionString(): string | null {
  const migrationUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL

  if (!migrationUrl) {
    return null
  }

  return migrationUrl.replace('require', 'disable')
}

async function acquireMigrationLock(sql: ReservedSql): Promise<void> {
  await sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_NAMESPACE}, ${MIGRATION_LOCK_KEY})`
}

async function releaseMigrationLock(sql: ReservedSql): Promise<void> {
  await sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_NAMESPACE}, ${MIGRATION_LOCK_KEY})`
}

async function run(): Promise<void> {
  const connectionString = resolveMigrationConnectionString()
  if (!connectionString) {
    console.log('Skipping db:push because required env vars are missing: POSTGRES_URL_NON_POOLING or POSTGRES_URL')
    return
  }

  await loadScriptDependencies()

  const sql = postgres(connectionString, {
    max: 1,
    connect_timeout: 30,
    idle_timeout: 5,
  })
  let reserved: ReservedSql | null = null
  let lockAcquired = false

  try {
    const isSupabaseMode = resolveSupabaseMode(process.env)
    const siteUrl = resolveSiteUrl(process.env)
    const cronSecret = process.env.CRON_SECRET?.trim() || ''

    console.log('Connecting to database...')
    reserved = await sql.reserve()
    await reserved`SELECT 1`
    console.log('Connected to database successfully')

    console.log('Acquiring migration lock...')
    await acquireMigrationLock(reserved)
    lockAcquired = true
    console.log('Migration lock acquired')

    console.log(`Migration mode: ${isSupabaseMode ? 'Supabase' : 'Postgres+S3'}`)
    await applyMigrations(reserved, isSupabaseMode)

    if (isSupabaseMode) {
      await configureSupabaseScheduler(reserved, siteUrl, cronSecret)
    }
    else {
      console.log('Skipping database scheduler setup because Supabase mode is not configured. Use the external scheduler contract from https://docs.kuest.com/manual-installation/scheduler-jobs.')
    }
  }
  catch (error) {
    console.error('An error occurred:', error)
    process.exitCode = 1
  }
  finally {
    if (reserved) {
      if (lockAcquired) {
        try {
          console.log('Releasing migration lock...')
          await releaseMigrationLock(reserved)
          console.log('Migration lock released')
        }
        catch (error) {
          console.error('Failed to release migration lock:', error)
        }
      }

      try {
        await reserved.release()
      }
      catch (error) {
        console.error('Failed to release reserved connection:', error)
      }
    }

    console.log('Closing database connection...')
    await sql.end()
    console.log('Connection closed.')
  }
}

run()
