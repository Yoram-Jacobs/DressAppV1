---
name: labrrerian
description: Audits, reviews, updates, prunes, and lints the repository documentation to keep docs synchronized with the current implementation.
---

# Labrrerian — Documentation Maintenance Guide

Use this skill to ensure that the repository's documentation is clean, up-to-date, accurate, and properly formatted.

## Steps

### 1. Audit & Scan
Identify all documentation files in the repository:
- Check the root directory for documentation markdown files (e.g., `README.md`, `CHANGELOG.md`, `CONCRETE_FACTS.md`, etc.).
- Check the `/docs/` directory and any subdirectories (like `/docs/notebooks/`).
- Make a list of active documents and trace which code/features they represent.

### 2. Prune Obsolete Files
Analyze documentation files for obsolescence:
- Identify and remove recovery logs, temporary notes, debug sessions, or files with typos in filenames/contents (e.g., `Test_resolts.md`, `Server_Delete.md`).
- Archive historical files in a `quarantine/` directory if they are useful for context but shouldn't clutter the active `/docs/` folder.

### 3. Update Core Documentation
Ensure the main entry points for developers and users are up-to-date:
- **`README.md`**: Update with the latest configuration requirements, setup instructions, active components, and available workflows.
- **`docs/ARCHITECTURE.md`**: Verify that the technical architecture diagram and service descriptions match the current implementation (e.g., check backend/frontend layout, DB configurations, and ML services).
- **`docs/MONGODB_SCHEMA.md`**: Verify schemas against Pydantic models in `backend/app/models/`.

### 4. Markdown Linting & Link Check
Ensure high-quality styling and layout:
- Check for broken or dead relative links (e.g., `[label](docs/file.md)`).
- Ensure markdown heading hierarchies (`#`, `##`, `###`) are consistent.
- Ensure tables, fenced code blocks, and list indentations are formatted correctly.
- Fix spelling and grammar issues.
