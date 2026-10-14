# ACMP Analyzer

Next.js analytics, teacher rosters, gift milestones, shared group standings, and Kazakhstan ranklists. Saved application records use **Supabase Postgres**.

## Database setup

The ACMP schema has been installed in Supabase project `ppzqwpwcfhisgjccfdpa`:
[Open the project](https://supabase.com/dashboard/project/ppzqwpwcfhisgjccfdpa).
Tables are in the private `acmp` schema, so choose that schema in the Supabase Table Editor.

1. Install dependencies with `npm ci` (Node 22.13 or later).
2. Copy `.env.example` to `.env.local` and set `DATABASE_URL` and `AUTH_SECRET`.
3. Use the **Transaction pooler** URI from the Supabase **Connect** panel for serverless hosting. For the app role, replace `postgres.PROJECT_REF` with `acmp_app.PROJECT_REF` and use the app role's own password. For a direct connection, the username is simply `acmp_app`.
4. Start with `npm run dev` and open http://localhost:3000.

Database credentials belong only in the server environment. `.env.local`, database files, and secrets are excluded from Git. No Supabase secret or service-role key is required by this implementation.

For another Supabase project, apply `supabase/migrations/20261014062319_acmp_schema.sql` using its SQL Editor. It creates a restricted `acmp_app` role with no login until you set its password:

```sql
ALTER ROLE acmp_app WITH LOGIN PASSWORD 'REPLACE_WITH_A_LONG_RANDOM_APP_PASSWORD';
```

Alternatively, set a temporary `DATABASE_ADMIN_URL` and run `npm run db:apply`. Remove the admin connection from the runtime environment afterward. The running app needs only the restricted `DATABASE_URL`.

## Existing SQLite records

To move records from a previous installation into an **empty** cloud database, set `DATABASE_ADMIN_URL`, then:

```powershell
npm run db:import -- "C:\path\to\data\acmp-visualizer.db"
```

The import runs in one transaction and keeps teacher password hashes, IDs, student metadata, gift photos/checkpoints, groups, memberships, and ranklist entries. It opens the SQLite source read-only and refuses to import over existing cloud records. The separate admin login remains separate from teacher accounts. Remove `DATABASE_ADMIN_URL` after the import.

## Access model

Teachers register at `/register` and sign in at `/login`. Existing bcrypt password hashing and signed HTTP-only sessions are preserved. The separate admin username is `admin`. Server routes enforce teacher ownership or admin permissions before accessing records.

The private schema is not exposed through Supabase's Data API. All six tables have RLS enabled; only the restricted backend `acmp_app` role has data access. Browser `anon` and `authenticated` roles cannot read the schema. Public standings are assembled by server routes and reveal only the intended display fields and delivered gifts.

Groups are managed from `/dashboard`. Regional membership is managed at `/ranklists/manage`; public ranklists are at `/ranklist/south`, `/ranklist/north`, `/ranklist/east`, `/ranklist/west`, and `/ranklist/kazakhstan`.

## Hosting

Configure `DATABASE_URL` and a random `AUTH_SECRET` in the hosting provider's server environment. The app no longer needs a persistent local filesystem or a native SQLite dependency. Gift images continue to be stored with reward records.

## Verification

```powershell
npm run test:database
npm run build
```

With the development server running on port 3100 and `DATABASE_URL` configured, `npm run test:database:live` checks the real API against Supabase using disposable test accounts, then removes those accounts and their records. Set `TEST_ORIGIN` to test another local port.

The database test executes the migration against local Postgres and checks case-insensitive teacher uniqueness, ownership-scoped queries, parameterized strings, gift delivery updates, group transaction rollback, region checks, cascades, and denied browser-role access.

Supabase's connection guidance: https://supabase.com/docs/guides/database/connecting-to-postgres
