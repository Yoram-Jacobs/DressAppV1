# ADR 0001: Domain-Driven Restructuring for Codebase Decoupling

* **Status:** Proposed
* **Date:** 2026-07-31
* **Context:** [CONTEXT.md](file:///C:/DressApp_AG/CONTEXT.md)

---

## Context and Problem Statement

The DressApp backend codebase currently follows a monolithic, flat structure:
1. **Monolithic API Routers:** The [closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py) router has grown to ~293 KB and contains overlapping business logic, database queries, bulk queue handling, and image processing.
2. **Flat Services Folder:** All 60+ utility and business logic files reside flat in [backend/app/services](file:///C:/DressApp_AG/backend/app/services). This obscures domain boundaries and makes it difficult to trace dependencies.
3. **Monolithic Schema Model:** All Pydantic validation schemas across all domains are stored in a single large file, [schemas.py](file:///C:/DressApp_AG/backend/app/models/schemas.py).
4. **Ad-hoc Injection Scripts:** Multiple scripts named `inject*.py` exist without a unified structure, creating hidden monkey-patches in development.

These issues increase cognitive load for developers, raise compile/test times, and make the codebase prone to regression.

---

## Decision Drivers

* **Maintainability:** Clear boundaries and isolated files make code easier to refactor and expand.
* **Separation of Concerns:** Business logic should be distinct from REST routing endpoints.
* **Test Isolation:** Independent unit tests should not require loading the entire backend stack unless necessary.
* **Adherence to Domain Guide:** Align directory layout with single-context or multi-context design systems as documented in [domain.md](file:///C:/DressApp_AG/docs/agents/domain.md).

---

## Proposed Decision

We will restructure the backend codebase into Bounded Contexts under a new `backend/app/domains/` package. 

### Key Structural Changes:
1. **Move Services to Bounded Contexts:** group the 60+ service files into folders matching the contexts in [CONTEXT.md](file:///C:/DressApp_AG/CONTEXT.md) (e.g., `domains/closet/services`, `domains/stylist/services`).
2. **Split God Files:** 
   * Segment [schemas.py](file:///C:/DressApp_AG/backend/app/models/schemas.py) into domain-scoped model files (e.g., `domains/experts/models.py`).
   * Extract processing loops, background tasks, and utility functions from [closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py) into standalone service modules.
3. **Unified DI / Bootstrap:** Unify `inject*.py` scripts into a structured setup/bootstrap handler.

---

## Consequences

### Positive:
* Decoupled modules with clear import boundaries.
* Gods files are eliminated, making files smaller and easier to inspect.
* Domain vocabularies (e.g., *Garment*, *Stylist Session*, *Ad Campaign*) map 1-to-1 with file names and directories.

### Negative / Trade-offs:
* **Import Path Changes:** Re-locating files will require updating import statements across the entire backend.
* **Test Maintenance:** Tests in [tests/](file:///C:/DressApp_AG/backend/tests) must be updated to import from the new modular structure. This must be executed incrementally to prevent regressions.
