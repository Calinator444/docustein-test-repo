---
description: >
  Phase 1 of the content catalog pipeline. Scans a content directory for all
  non-archived, non-draft files, extracts their category tags and git history,
  and commits a tracking file to a new branch, then opens a pull request.
  The tracking file lists every file with its full metadata as a task-list so
  Agent 2 can check off rows as it processes them. Also creates a custom GitHub
  label derived from the user's intent for Agent 2 to inject into raised issues.
  Safe to re-run — if an open catalog-tracking PR already exists with unchecked
  rows it stops immediately without creating duplicates.

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
      # collection_path:
      #   description: "Repo path to scan for .md/.mdx content files"
      #   required: false
      #   default: "content/posts"

permissions: read-all

safe-outputs:
  create-pull-request:
    title-prefix: "[Content Catalog] "
    labels: ["catalog-tracking"]
    max: 1

tools:
  github:
    toolsets: [default]
---



<!-- TODO - this part of the flow may not need to be agentic -->
<!-- It's only creating a json file with all files in the repo -->
### Step 1 - Cataloging

Create a json file in the folder .github/content-hawk/todo/ with the name <intent_name>.json

Then add a json file to it with the following:

```
{
  "original_intent": `${{ inputs.intent }}`,
}

```



### Step 2


Agregate all markdown files in the repo in the `content` folder. Once you've aggregated all of these files add a new property to the json file created in step 1 with the following format:

{
  "files": [
    {
      "path": "<file_path>",
    },
  ]
}


### Step 3

Create a pull request with the title [Content Catalog] <intent> using a branch called content-hawk/todo/<intent_name>. Include the file created in step 1 in the pull request.
<!-- End testing changes to steps -->

<!-- ### Step 1 — Create the intent label

Create a GitHub label named exactly as the `label_name` input value, using `#<label_color>` as the color and the `intent` input as the description. Run:

```bash
gh label create "$LABEL_NAME" --color "#$LABEL_COLOR" --description "$INTENT" --force
```

The `--force` flag updates an existing label rather than failing, making this step idempotent.

### Step 2 — Discover all content files

List every `.md` and `.mdx` file under the `collection_path` directory (recursive). For each file:

1. Read its YAML front-matter.
2. **Skip** the file if front-matter contains `archived: true` or `draft: true`.
3. Extract the **CategoryList**: read the `tags` array. Each tag entry is a file path like `content/tags/tinacms.mdx` — extract just the stem (the filename without extension). If no tags exist, use `uncategorized`. Join multiple stems with commas.
4. Retrieve git history dates via bash:
   - **Created** (first commit date):
     ```bash
     git log --follow --format='%as' -- <path> | tail -1
     ```
   - **LastUpdated** (most recent commit date):
     ```bash
     git log --follow --format='%as' -1 -- <path>
     ```
   If git returns no output (untracked file), use `-` for both dates. -->

<!-- ### Step 3 — Write the tracking file

Create the file `.github/content-catalog/tracking.md` using the edit tool. Its content must follow this exact structure:

```
## Configuration

| Field      | Value                     |
|------------|---------------------------|
| Intent     | <intent input>            |
| Label      | `<label_name input>`      |
| Collection | <collection_path input>   |
| Created    | <today's ISO timestamp>   |

## Files to Review

<one row per non-skipped file, sorted alphabetically by path>
- [ ] `<file-path>` | categories: <CategoryList> | created: <Created> | last-updated: <LastUpdated> | checked: - | result: pending
``` -->

<!-- ### Step 4 — Open the pull request

Create a pull request from `content-catalog/active` into `main`. The title prefix `[Content Catalog] ` is added automatically — use only the `intent` input as the title body.

Use this exact PR body:

```
## Intent

<intent input>

## Label for flagged issues

`<label_name input>`

## Tracking file

The full file list with metadata is in `.github/content-catalog/tracking.md` on this branch.
Agent 2 will check off each row as it processes files and update the `checked` date and `result` fields.

## Configuration

| Field      | Value                     |
|------------|---------------------------|
| Intent     | <intent input>            |
| Label      | `<label_name input>`      |
| Collection | <collection_path input>   |
| Created    | <today's ISO timestamp>   |
``` -->
