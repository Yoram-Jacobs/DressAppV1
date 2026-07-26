---
name: codebase-pruning
description: >
  Deep codebase pruning and dead-code elimination skill for DressApp. Use this
  skill whenever the user asks to clean up, prune, remove dead code, audit
  redundant components, deduplicate logic, or perform a code hygiene sweep on
  any module. Triggers include: "prune", "clean up code", "remove dead code",
  "audit redundant", "code cleanup", "delete unused", "strip dead endpoints",
  "deduplicate", "code hygiene", "dead code sweep", "refactor cleanup",
  "remove deprecated", "lint and clean", "4:09AM pruning", "pruning assignment".
---

# Codebase Pruning Skill

You are a senior software engineer performing a deep codebase pruning sweep on
the DressApp project. Your job is to identify and eliminate dead code, redundant
endpoints, duplicated logic, unused imports, orphaned state, and i18n violations
— then verify the result with linting and tests.

---

## Pruning Workflow

### Phase 1: Deep Audit (Read-Only)

**Goal**: Build a complete map of dead code before touching anything.

1. **Trace the active pipeline** — Read the feature's code path end-to-end
   (backend endpoint → service layer → frontend API call → component → store).
   Mark every function, model, variable, and import as **ACTIVE** or **DEAD**.

2. **Check cross-references** — For every candidate for deletion, grep the
   entire codebase (`*.py`, `*.js`, `*.jsx`, `*.ts`, `*.tsx`, `*.json`) to
   confirm zero consumers remain.

3. **Catalog findings** — Produce a structured table:

   | Location | Dead Code | Reason | Safe to Delete? |
   |----------|-----------|--------|-----------------|
   | `closet.py:2764–2860` | `MigrationBatchIn` model | Superseded by save-crops pipeline | Yes |

4. **Check for duplication** — Identify copy-pasted blocks (>20 lines with
   >80% similarity). Plan extraction into a shared helper.

5. **Check i18n compliance** — Run the i18next-localizer audit:
   - No positional fallback `t('key', 'default')`
   - No hardcoded user-facing strings
   - All keys present in all 13 locale files

### Phase 2: Surgical Deletion

**Rules**:
- Delete from bottom-to-top (higher line numbers first) to avoid offset drift
- Use exact `oldString` matches — never guess line numbers
- After each batch of deletions, validate syntax (Python `py_compile`, JS ESLint)
- Never delete code that has any remaining consumer (grep first!)

**Order of operations**:
1. Backend: Remove dead Pydantic models
2. Backend: Remove dead endpoint functions
3. Backend: Remove dead state variables (`_migration_cards`, `_migration_queues`)
4. Backend: Remove dead worker functions and their helpers
5. Backend: Extract duplicated logic into shared helpers
6. Frontend: Delete dead store files (`migrationStore.js`)
7. Frontend: Remove dead API methods from `api.js`
8. Frontend: Remove dead state and methods from stores (`workStore.js`)
9. Frontend: Remove dead component sections (progress bars, subscriptions)
10. Frontend: Remove unused imports
11. i18n: Fix hardcoded strings and positional fallback args

### Phase 3: Deduplication

When two functions share >80% identical code:
1. Extract the shared logic into a module-level helper
2. Replace both inline closures with calls to the helper
3. Parameterize only the differing parts (variable names, log prefixes)

Example:
```python
# BEFORE: Two ~90-line duplicate closures
async def _run_reanalyze():       # in save-crops endpoint
    ...90 lines...
async def _run_reanalyze_standalone():  # in reanalyze endpoint
    ...90 lines...

# AFTER: One shared helper
async def _run_reanalyze_items(items, user, job_id, db):
    ...90 lines...

# Both endpoints call:
asyncio.create_task(_run_reanalyze_items(saved_items, user, job_id, db))
```

### Phase 4: i18n Sweep

1. Find all `t()` calls in modified files
2. Verify each uses `{ defaultValue: '...' }` syntax (never positional)
3. Find all hardcoded user-facing strings in JSX (toast messages, button
   labels, warning text, aria labels)
4. Wrap each in `t()` with a descriptive key
5. Add keys to `en.json` first, then translate to all 12 other locales
6. Validate all 13 JSON files

### Phase 5: Verify & Deploy

```bash
# 1. Lint frontend
npx eslint <modified-files> --max-warnings=999

# 2. Python syntax check (via VPS docker)
wsl ssh root@178.105.144.142 "docker compose -f /srv/AI-Stylist/deploy/docker-compose.yml \
  exec -T backend python -m py_compile <file> && echo OK"

# 3. Validate JSON locale files
npx -y jsonlint frontend/src/locales/<lang>.json

# 4. Git commit with structured message
git add <files>; git commit -m "refactor: <description>"

# 5. Deploy
wsl ssh root@178.105.144.142 "cd /srv/AI-Stylist && git pull origin main && \
  cd deploy && docker compose up -d --build"

# 6. Health check
Start-Sleep -Seconds 10; wsl curl -s https://dressapp.co/api/v1/health
```

---

## What Counts as Dead Code

| Category | Examples |
|----------|----------|
| **Dead endpoints** | API routes marked `deprecated=True`, or no frontend consumer |
| **Dead models** | Pydantic models only used by dead endpoints |
| **Dead state vars** | Dicts/lists populated but never read (e.g., `_migration_cards`) |
| **Dead workers** | Background functions called only by dead endpoints |
| **Dead imports** | Modules imported but never referenced |
| **Dead store methods** | Store functions never called by any component |
| **Dead component code** | JSX blocks that render conditionally on dead state |
| **Orphaned refs** | `useRef` values assigned but never read |
| **Duplicate functions** | Two functions with >80% identical logic |
| **Hardcoded strings** | User-facing text not wrapped in `t()` |
| **Positional i18n args** | `t('key', 'default')` instead of `t('key', { defaultValue: 'default' })` |

---

## What NOT to Delete

- **Test files** — Even if they test dead code, keep tests for potential revival
- **Service modules** — Keep `app/services/migration/` even if the endpoint
  is dead; the service classes may be reused
- **Schema definitions** — Keep Pydantic models in `schemas.py` unless they're
  only in the API file
- **`deprecated=True` endpoints** — Keep if they have a `status_code` and
  proper response; remove only if the entire function body is dead

---

## Commit Message Convention

```
refactor: strip ~N lines of dead code, <key changes>

Backend (closet.py):
- Removed dead endpoints: /path1, /path2
- Removed dead models: ModelName1, ModelName2
- Extracted shared_helper() replacing N lines of duplication

Frontend:
- Deleted deadStore.js
- Removed N dead API methods
- Removed dead state from workStore
- Fixed err.message bug in Component

i18n:
- Added N translation keys to all 13 locales
- Wrapped N hardcoded strings in t()
```

---

## Metrics to Report

After pruning, report:
- **Lines removed** vs **lines added** (net reduction)
- **Number of dead endpoints** removed
- **Number of dead models** removed
- **Number of dead state variables** removed
- **Number of duplicate functions** extracted to shared helpers
- **Number of i18n keys** added
- **Number of hardcoded strings** wrapped in `t()`
- **Number of locale files** updated
