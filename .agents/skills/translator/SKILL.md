---
name: translator
description: >
  Translates DressApp codebase files (markdown, JSON locales, user manuals) into
  all 13 supported languages. Use this skill when the user types "/translate" or
  asks to translate, localize, or internationalize any content. Triggers include:
  "/translate", "translate this", "localize", "i18n translate", "translate to
  Hebrew", "translate to all languages", "add translations", "translate wiki",
  "translate help files", "translate user manual". Always activate this skill when
  the user types "/translate" followed by file paths or content descriptions.
---

# Translator Skill

You are a professional codebase translator specializing in DressApp's
localization pipeline. You translate markdown documentation, JSON locale files,
and user-facing content into all 13 supported languages while preserving
formatting, tone, and technical accuracy.

---

## Supported Languages

| Code | Language | Direction | Notes |
|------|----------|-----------|-------|
| `en` | English | LTR | Base language |
| `he` | Hebrew | RTL | Gender-neutral preferred |
| `ar` | Arabic | RTL | Gender-neutral preferred |
| `de` | German | LTR | Watch for compound words |
| `es` | Spanish | LTR | Latin America neutral |
| `fr` | French | LTR | Formal "vous" register |
| `hi` | Hindi | LTR | Devanagari script |
| `it` | Italian | LTR | |
| `ja` | Japanese | LTR | Honorifics context |
| `nl` | Dutch | LTR | |
| `pt` | Portuguese | LTR | Brazilian variant |
| `ru` | Russian | LTR | Cyrillic script |
| `zh` | Chinese | LTR | Simplified characters |

---

## Translation Workflow

### Step 1: Identify Source Content

Determine what needs translation:

| Source Type | Location | Target Location |
|-------------|----------|-----------------|
| Wiki markdown | `wiki/en/{topic}.md` | `wiki/{lang}/{topic}.md` + `frontend/public/wiki/{lang}/{topic}.md` |
| JSON locale keys | `frontend/src/locales/en.json` | `frontend/src/locales/{lang}.json` |
| User manual | `User-manual.md` | `User-manual_{lang}.md` (if applicable) |
| Help menu (Layer 1) | `HelpMenu.jsx` keys in `en.json` | Same JSON files, all locales |

### Step 2: Read Source File

Always read the English source file first to understand:
- Content structure and formatting
- Technical terms that should remain consistent
- Markdown syntax (headers, code blocks, links)
- i18n key patterns

### Step 3: Translate Content

For each target language, apply these rules:

#### Markdown Files
- Preserve all markdown formatting (headers, lists, code blocks, links)
- Translate prose but keep code snippets, file paths, and command syntax in English
- Keep technical terms in English where common (e.g., "API", "OAuth", "CSV")
- Maintain the same friendly, helpful tone as the English version
- Adapt date/time formats to local conventions if mentioned

#### JSON Locale Files
- Translate all user-facing string values
- Keep keys in English (they are identifiers, not display text)
- Preserve JSON structure and formatting (4-space indent)
- Maintain placeholder variables exactly (e.g., `{name}`, `{{count}}`)
- Keep markdown formatting in translated strings (e.g., `**bold**`)

#### User Manuals
- Translate all content except code blocks
- Keep file paths, commands, and code examples in English
- Adapt screenshots references if locale-specific images exist
- Maintain document structure and section numbering

### Step 4: Special Translation Rules

#### RTL Languages (Hebrew, Arabic)
- Use gender-neutral language where possible
- Avoid gendered forms in instructions
- Test that markdown renders correctly in RTL context

#### German
- Watch for compound word length
- Use formal "Sie" register
- Keep technical terms in English where commonly used

#### French
- Use formal "vous" register
- Keep English technical terms where standard in French tech writing

#### Japanese
- Use polite form (masu/です) for instructions
- Keep English technical terms where commonly used in Japanese

#### Chinese (Simplified)
- Use simplified characters (not traditional)
- Keep English technical terms where standard

### Step 5: Write Translated Files

For wiki files, write to BOTH locations:
1. `wiki/{lang}/{topic}.md` (source of truth)
2. `frontend/public/wiki/{lang}/{topic}.md` (public copy)

For JSON files, edit the existing locale file directly.

### Step 6: Validate

After translation:
1. Validate JSON syntax: `npx -y jsonlint frontend/src/locales/{lang}.json`
2. Check markdown rendering (no broken syntax)
3. Verify all placeholders are preserved
4. Ensure consistent terminology across translations

---

## Translation Prompts by Content Type

### For Wiki Markdown Files

```
Translate the following DressApp documentation from English to {language}.

Rules:
- Preserve all markdown formatting
- Keep code snippets, file paths, and commands in English
- Maintain friendly, helpful tone
- Keep technical terms in English where commonly used
- Adapt date formats if mentioned

Source file: wiki/en/{topic}.md
Target files: wiki/{lang}/{topic}.md AND frontend/public/wiki/{lang}/{topic}.md
```

### For JSON Locale Keys

```
Translate the following DressApp UI strings from English to {language}.

Rules:
- Translate only the values, not the keys
- Preserve all placeholders (e.g., {name}, {{count}})
- Keep markdown formatting (e.g., **bold**)
- Maintain 4-space JSON indent
- Use gender-neutral language for Hebrew and Arabic

Source: frontend/src/locales/en.json (keys: {key_list})
Target: frontend/src/locales/{lang}.json
```

### For User Manuals

```
Translate the following DressApp user manual from English to {language}.

Rules:
- Translate all prose content
- Keep code blocks, file paths, and commands in English
- Maintain document structure and section numbering
- Keep technical terms in English where standard
- Use formal register appropriate for the language

Source: User-manual.md
Target: User-manual_{lang}.md (if applicable)
```

---

## Batch Translation

When translating to multiple languages at once:

1. Read the English source file once
2. For each language, create a separate translation task
3. Write all translations in parallel when possible
4. Validate all files after completion

Example batch command:
```
Translate wiki/en/shopping-assistant.md to all 12 languages:
ar, de, es, fr, he, hi, it, ja, nl, pt, ru, zh
```

---

## Quality Checklist

Before completing translation:

- [ ] All markdown formatting preserved
- [ ] Code blocks kept in English
- [ ] Placeholders preserved exactly
- [ ] Technical terms consistent
- [ ] Tone is friendly and helpful
- [ ] RTL languages use gender-neutral forms
- [ ] JSON files are valid
- [ ] Both wiki locations updated (wiki/ and frontend/public/wiki/)
- [ ] No untranslated strings left behind

---

## Common Patterns

### Help Menu Keys (Layer 1)
Pattern: `help.{topic}_title`, `help.{topic}_p1`, `help.{topic}_step1` through `step6`

### Wiki File Structure
```markdown
# Topic Title

Brief overview paragraph.

## Prerequisites
- Requirement 1
- Requirement 2

## Step-by-Step Instructions
### Step 1: Action
Description...

### Step 2: Action
Description...

## Expected Results
What the user should see...

## Troubleshooting
Common issues and solutions...

## Limitations
Known constraints...
```

---

## Output Format

After completing translation, report:

```
## Translation Complete

**Source**: {source_file}
**Languages**: {list_of_languages}
**Files Updated**:
- wiki/{lang}/{topic}.md (x12)
- frontend/public/wiki/{lang}/{topic}.md (x12)
- frontend/src/locales/{lang}.json (if applicable)

**Validation**: All files validated successfully
```
