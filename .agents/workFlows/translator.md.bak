---
description: Invokes the translator subagent to translate any codebase markdown files, user manuals, or JSON locale files into 12 supported languages.
---

# Translator Workflow

This workflow automates codebase translation and localization using the specialized `translator` subagent.

## Usage

When this command is triggered, you must delegate the task to the `translator` subagent using the `invoke_subagent` tool:

- **Type Name**: `translator`
- **Role**: `Codebase Translator`
- **Prompt**: Pass the file paths to translate, target languages, and target directories.

### Example Invocation Prompt

```json
{
  "Subagents": [
    {
      "TypeName": "translator",
      "Role": "Codebase Translator",
      "Prompt": "Translate the user manual located at 'C:\\DressApp_AG\\User-manual.md' into Hebrew, Arabic, and French, applying gender-neutral sensitivity rules for Hebrew and Arabic. Output files to the same directory."
    }
  ]
}
```
