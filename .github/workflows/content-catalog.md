---
description: >
  Phase 1 of the content catalog pipeline. Scans a content directory for all
  non-archived, non-draft files, extracts their category tags and git history,
  and creates a tracking issue listing every file with its full metadata.
  Also creates a custom GitHub label derived from the user's intent so that
  the downstream agent (Phase 2) can inject it into any issues it raises.
  Safe to re-run — if an open tracking issue already exists it dispatches
  Phase 2 immediately without creating a duplicate.

on:
  workflow_dispatch:
    inputs:
      intent:
        description: "What Agent 2 should look for (e.g. 'archive all legacy TFS version-control posts')"
        required: true
      label_name:
        description: "GitHub label slug to attach to flagged issues (e.g. 'archive-legacy-rules')"
        required: true
      label_color:
        description: "Hex color for the label, without the # prefix (e.g. 'e4e669')"
        required: false
        default: "e4e669"
      collection_path:
        description: "Repo path to scan for .md/.mdx content files"
        required: false
        default: "content/posts"

permissions: read-all

safe-outputs:
  create-issue:
    title-prefix: "[Content Catalog] "
    labels: ["catalog-tracking"]
    max: 1
    close-older-issues: false

tools:
  github:
    toolsets: [default]
---

## Phase 1 — Build the Content Catalog

Work through the steps below in order.

### Step 1 — Resume check

Search open GitHub issues with the label `catalog-tracking`. If one exists and its body contains any lines beginning with `- [ ]`, a catalog run is already in progress — skip to Step 6 immediately and do not scan files or create a new issue.

### Step 2 — Create the intent label

Create a GitHub label named exactly as the `label_name` input value. Use `#` + the `label_color` input value as the color (e.g. `label_color: e4e669` → color `#e4e669`). Set the description to the `intent` input value.

If a label with that name already exists, skip creation silently.

Use the following bash command:

```bash
gh label create "$LABEL_NAME" --color "#$LABEL_COLOR" --description "$INTENT" --force
```

The `--force` flag updates an existing label rather than failing, so this step is always idempotent.

### Step 3 — Discover all content files

List every `.md` and `.mdx` file under the `collection_path` directory (recursive). For each file:

1. Read its YAML front-matter.
2. **Skip** the file if it has `archived: true` or `draft: true` in front-matter.
3. Extract the **CategoryList**: read the `tags` array. Each tag entry is a file reference like `content/tags/tinacms.mdx` — extract just the stem (the part before the `.` extension and after the last `/`). If no tags exist, use `uncategorized`. Join multiple tags with commas.
4. Run bash to get git history dates:
   - **Created** — date of the first commit for this file:
     ```bash
     git log --follow --format='%as' -- <path> | tail -1
     ```
   - **LastUpdated** — date of the most recent commit:
     ```bash
     git log --follow --format='%as' -1 -- <path>
     ```
   If git returns no output for a file (e.g. untracked), use `-` for both dates.

### Step 4 — Build the file list

Compile all non-skipped files into a task-list. Each row must follow this exact format (no trailing spaces):

```
- [ ] `<file-path>` | categories: <CategoryList> | created: <Created> | last-updated: <LastUpdated> | checked: - | result: pending
```

Sort the rows alphabetically by file path as the default order.

### Step 5 — Create the tracking issue

Create a GitHub issue. The title prefix `[Content Catalog] ` is added automatically — write only the `intent` input value as the title body.

Use this exact body structure:

```
## Configuration

| Field      | Value                     |
|------------|---------------------------|
| Intent     | <intent input>            |
| Label      | `<label_name input>`      |
| Collection | <collection_path input>   |
| Created    | <today's ISO timestamp>   |

## Files to Review

<task-list rows from Step 4, one per line>
```

### Step 6 — Confirm completion

After the tracking issue is created (or if one already existed from Step 1), post no further output. The catalog is ready for Phase 2 to process.
