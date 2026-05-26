# Development Setup

## Prerequisites

- Node.js LTS (v20+)
- pnpm (install with `corepack enable && corepack prepare pnpm@latest --activate`)
- PostgreSQL 16+
- Docker (optional, for containerized deployment)

---

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> claim-submission
cd claim-submission
pnpm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your real values (see below)

# 3. Set up the database
createdb claim_submission
pnpm prisma migrate dev

# 4. Start development server
pnpm dev
```

The app is now running at `http://localhost:3000`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `DATABASE_URL` | No | — | PostgreSQL connection string (e.g., `postgresql://user:pass@localhost:5432/claim_submission`) |
| `DOCUSEAL_API_KEY` | Yes | — | DocuSeal API key (from DocuSeal Account → API) |
| `DOCUSEAL_API_URL` | No | `https://sign.plpas.com/api` | DocuSeal API base URL |
| `GEOAPIFY_API_KEY` | Yes | — | Geoapify API key (from Geoapify Dashboard) |
| `SESSION_SECRET` | Yes | — | JWT signing secret — generate with: `openssl rand -base64 32` |
| `API_SHARED_SECRET` | Yes | — | Shared API key for programmatic access — generate with: `openssl rand -base64 32` |

### Generating secrets

```bash
SESSION_SECRET=$(openssl rand -base64 32)
API_SHARED_SECRET=$(openssl rand -base64 32)
echo "SESSION_SECRET=$SESSION_SECRET"
echo "API_SHARED_SECRET=$API_SHARED_SECRET"
```

---

## Database

### PostgreSQL Setup

```bash
# Create the database (adjust for your PostgreSQL setup)
createdb claim_submission

# Verify connection
psql -d claim_submission -c "SELECT 1"
```

### Prisma Commands

```bash
# Generate Prisma Client (after schema changes)
pnpm prisma generate

# Push schema to database (development, no migration file)
pnpm prisma db push

# Create and apply a new migration
pnpm prisma migrate dev --name describe_change

# Create migration without applying (for review)
pnpm prisma migrate dev --create-only --name describe_change

# Apply pending migrations (production)
pnpm prisma migrate deploy

# Reset database (drops and re-applies all migrations)
pnpm prisma migrate reset

# Open Prisma Studio GUI
pnpm prisma studio
```

### Migration naming convention

```
000_init                    # Initial schema
001_add_claim_status        # Add a field
002_add_claim_documents     # Add a relation
```

### Seed Data

To add seed data, create `prisma/seed.ts`:

```ts
import { prisma } from '@/lib/db'

async function main() {
  // Create seed data
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo PA Firm',
      subdomain: 'demo',
      secretKey: 'demo-secret',
    },
  })
  console.log('Seeded:', tenant.id)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

Then run:

```bash
pnpm prisma db seed
```

Add to `package.json`:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

---

## Available Scripts

```bash
pnpm dev              # Next.js development server (port 3000)
pnpm build            # Production build
pnpm start            # Start production server (requires build first)
pnpm lint             # Check code with Biome
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Format all files with Biome
pnpm check            # Full Biome check (lint + format + imports)
pnpm prisma generate  # Regenerate Prisma Client
pnpm prisma migrate   # Run Prisma migrations
```

---

## Docker

### Build and Run

```bash
# Build and start
docker compose up --build

# Or build individually
docker build -t claim-submission .
docker run -p 3000:3000 --env-file .env claim-submission
```

### Docker Compose with PostgreSQL

For local development with PostgreSQL in Docker, extend `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: claim_submission
      POSTGRES_USER: app
      POSTGRES_PASSWORD: devpassword
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    build: .
    container_name: claim-submission
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - db

volumes:
  pgdata:
```

Then update `DATABASE_URL` in `.env`:

```
DATABASE_URL=postgresql://app:devpassword@db:5432/claim_submission
```

### Production Build Details

The Dockerfile uses a multi-stage build:

1. **Build stage** (`node:lts-alpine`): Installs all deps, builds Next.js, prunes dev dependencies.
2. **Production stage** (`node:lts-alpine`): Copies only `.next`, `node_modules`, `package.json`, `next.config.mjs`. Runs as non-root `appuser`. Exposes port 3000.

---

## Project Conventions

### File Naming

- **API routes**: `app/api/<name>/route.ts`
- **Components**: PascalCase, one component per file (`ClaimForm.tsx`)
- **Server libs**: camelCase (`auth.ts`, `docuseal.ts`)
- **Prisma models**: snake_case file names (`assignmentContact.prisma`)

### Code Style

Formatted and linted with Biome. Run `pnpm check` before committing.

### Import Style

```ts
import { something } from '@/lib/something'  // Absolute (preferred)
import { Component } from './Component'       // Relative for close siblings
```

### Path Aliases

`@/` maps to the project root (configured in `tsconfig.json`).

---

## Troubleshooting

### Prisma Client not found

```bash
pnpm prisma generate
```

### Migration conflicts

```bash
pnpm prisma migrate reset   # Reset database
pnpm prisma migrate dev     # Re-apply migrations
```

### Port already in use

```bash
# Change port in .env
PORT=3001 pnpm dev
```

### Windows (WSL)

```bash
# Ensure PostgreSQL is running in WSL
sudo service postgresql start
# Or connect to Windows PostgreSQL via host IP
DATABASE_URL=postgresql://user:pass@$(hostname).local:5432/claim_submission
```
