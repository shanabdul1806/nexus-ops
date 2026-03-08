# Contributing to Nexus Ops

Thank you for taking the time to contribute! This document covers everything you need to get started.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Adding a New Connector](#adding-a-new-connector)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating you agree to uphold it.

---

## Ways to Contribute

- **Bug reports** — open an issue using the Bug Report template
- **Feature requests** — open an issue using the Feature Request template
- **Code contributions** — fork the repo, make changes, open a pull request
- **Documentation** — improve the README, add examples, fix typos
- **Testing** — add or improve test coverage in `backend/src/__tests__/`

---

## Development Setup

### Prerequisites

- Node.js 20+
- Docker + Docker Compose
- An AI provider key (Anthropic or OpenAI) for AI features

### Local setup

```bash
# 1. Clone the repo
git clone https://github.com/ccdlvc/nexus-ops.git
cd nexus-ops

# 2. Configure environment
cd backend
cp .env.example .env
# Edit .env — at minimum set ANTHROPIC_API_KEY or OPENAI_API_KEY

# 3. Install dependencies
npm install
cd ../dashboard && npm install
cd ../extension && npm install

# 4. Run the full stack
cd ..
docker compose up -d

# 5. Run backend in dev mode (hot reload)
cd backend && npm run dev

# 6. Run dashboard in dev mode (Vite HMR)
cd dashboard && npm run dev
```

### Running tests

```bash
cd backend
npm test                  # all tests
npm run test:coverage     # with coverage report
```

---

## Submitting Changes

1. **Fork** the repository and create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   # or
   git checkout -b fix/my-bug
   ```

2. **Make your changes** and write/update tests where applicable.

3. **Check that tests pass:**
   ```bash
   cd backend && npm test
   ```

4. **Check TypeScript compiles cleanly:**
   ```bash
   cd backend && npm run build
   ```

5. **Open a pull request** against `main`. Fill in the PR template — describe what changed and why.

### Commit message format

```
<type>: <short summary>

Types: feat | fix | docs | refactor | test | chore
```

Examples:
```
feat: add Datadog connector
fix: azure cost API property name typo
docs: add GCP service account setup guide
```

---

## Coding Standards

- **TypeScript strict mode** — no `any` unless there is no alternative
- **No secrets in code** — all credentials via environment variables
- **Configuration guards** — every optional connector route must check its env vars and return HTTP 503 if not configured
- **Error handling** — connector errors should be caught and returned as structured JSON, never crash the server
- **Tests** — new connectors must have a test file in `backend/src/__tests__/`

### Adding a new connector

Follow the pattern documented in the README under **Adding a new connector**. In summary:

1. `backend/src/connectors/myservice.ts` — connector class
2. `shared/types/index.ts` — add shared types
3. `backend/src/routes/connectors.ts` — add routes with config guard
4. `backend/src/routes/query.ts` — add `case 'myservice'` to natural language query
5. `backend/src/alerts/monitor.ts` — add metric computation if applicable
6. `backend/src/storage/db.ts` — add default alert rules if applicable
7. `dashboard/src/services/api.ts` — add API methods
8. `dashboard/src/pages/MyServicePage.tsx` — UI page
9. `dashboard/src/App.tsx` + `dashboard/src/components/Sidebar.tsx` — register route and nav link
10. `backend/src/__tests__/myservice.test.ts` — tests

---

## Questions?

Open a [GitHub Discussion](https://github.com/ccdlvc/nexus-ops/discussions) or file an issue. We're happy to help.
