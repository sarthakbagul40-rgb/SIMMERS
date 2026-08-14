# SIMMERS Backend - Development & Operational Workflow

This document details the development lifecycle, git branching strategy, testing methodology, CI/CD pipeline, and deployment procedures for the SIMMERS REST API backend.

---

## 1. Local Development Cycle

### Daily Development Loop
1. **Environment Setup**: Ensure Node.js (LTS), PostgreSQL (or SQLite local fallback), and dependencies are installed.
2. **Start Dev Server**: Run `npm run dev` (using `ts-node-dev` or `tsx` for hot-reloading).
3. **Database Management**:
   - Run `npx prisma migrate dev` whenever updating `prisma/schema.prisma`.
   - Run `npx prisma studio` to inspect and interact with database records via visual web UI.
4. **Code Quality Checks**: Run `npm run lint` and `npm test` before committing changes.

---

## 2. Git Commit & Branching Strategy

To maintain clean, professional commit history for code review and portfolio evaluation:

- **Branch Naming**: Feature branches named `feature/<feature-name>` (e.g., `feature/auth`, `feature/households`).
- **Incremental Commits**: Commit at each completed phase rather than making single giant commits:
  - `feat(setup): initialize Express, TypeScript, and health check`
  - `feat(db): design Prisma schema and generate initial migration`
  - `feat(auth): add signup, login, JWT middleware, and password hashing`
  - `feat(households): implement household creation, invite codes, and authorization`
  - `feat(pantry): add pantry item CRUD endpoints`
  - `feat(ai): add server-side Gemini OCR scan endpoint`
  - `test(unit): add Vitest unit tests for auth and invite code logic`
  - `test(integration): add Supertest integration tests for full API flow`
  - `ci: configure GitHub Actions workflow for linting and testing`
  - `docs: add API documentation and environment setup guide`

---

## 3. Testing Workflow

### A. Unit Testing Strategy
- Focus: Testing pure, isolated helper functions without external network/database calls.
- Location: `tests/unit/`
- Coverage targets:
  - Password hashing & verification (`bcrypt`)
  - JWT token generation, expiration, and payload decoding
  - Random invite code generator (uniqueness and format check)

### B. Integration Testing Strategy
- Focus: End-to-end HTTP request testing using Supertest against an Express app instance.
- Location: `tests/integration/`
- Flow Scenarios Covered:
  - User Signup -> User Login -> Fetch Authenticated Profile (`/auth/me`)
  - Create Household -> Member Join using Invite Code -> Verify Non-Member Access Rejection (403 Forbidden)
  - Add Pantry Item -> List Household Items -> Update Item -> Delete Item
  - OCR Scan Endpoint using mocked Gemini AI service responses (never hitting real external API during automated tests)

---

## 4. CI/CD Workflow (GitHub Actions)

Every pull request or push to `main` triggers `.github/workflows/ci.yml`:

```
[ Push / PR ] ──► [ Checkout Code ] ──► [ Setup Node.js ] ──► [ Install Deps ]
                                                                   │
                                                                   ▼
[ Build Success ] ◄── [ Run Vitest Tests ] ◄── [ Run ESLint ] ◄────┘
```

1. **Lint Stage**: Fails if ESLint rules are violated.
2. **Build Stage**: Compiles TypeScript (`tsc --noEmit`).
3. **Test Stage**: Runs `npm test` (unit + integration test suites).

---

## 5. Deployment Workflow (Render / Railway)

1. **Environment Provisioning**: Create PostgreSQL instance on Render/Railway/Supabase.
2. **Environment Variables**: Configure variables in cloud console (`DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `PORT`, `NODE_ENV=production`).
3. **Build Command**: `npm install && npx prisma migrate deploy && npm run build`
4. **Start Command**: `node dist/server.js`
5. **Health Verification**: Ping `GET /health` to confirm successful deployment.
