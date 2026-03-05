---
description: >
  Agent 1 (Detective) of the ContentHawk pipeline.
  Scans content files based on user-provided search scope, extracts category
  and date metadata from each file, sorts them by the user's processing
  priority, and commits a markdown snapshot tracking file to a new branch,
  then opens a pull request.
  The snapshot is a markdown table listing every file with its metadata so
  Agent 2 can iterate over rows to find issues and Agent 3 can raise PRs
  grouped by the intent label.
  Also creates a custom GitHub label derived from the user's intent for
  Agent 2 to inject into issues and Agent 3 to bundle PRs.
  Stops immediately if an open catalog-tracking PR already exists for this
  intent to avoid duplicates.

on:
  workflow_dispatch:
    inputs:
      search_scope:
        description: "Which content files to scan and how to filter them (e.g. '.NET rules under content/rules that are not archived', 'all public pages in content folder')."
        required: true
      processing_priority:
        description: "How to sort the file list for processing order (e.g. 'first sort by created date ascending, then by lastUpdated descending')."
        required: true
      intent:
        description: "What Agent 2 should look for and act on (e.g. 'archive all legacy rules and populate archive reason including modern rule reference')."
        required: true
      issue_preferences:
        description: "Preferences for how Agent 2 creates issues (e.g. 'use template .github/ISSUE_TEMPLATE/content-review.md, max 20 issues per run')."
        required: true
      pr_preferences:
        description: "Preferences for how Agent 3 creates PRs (e.g. 'use template .github/PULL_REQUEST_TEMPLATE/content-fix.md, bundle up to 5 related issues per PR')."
        required: true
      label_name:
        description: "GitHub label slug to tie the pipeline together (e.g. 'archive-legacy-rules'). Agent 2 applies it to issues, Agent 3 queries by it."
        required: true

engine:
  id: copilot
  model: gpt-5.1-codex-mini

permissions: read-all

safe-outputs:
  create-pull-request:
    title-prefix: "[Content Catalog] "
    labels: ["catalog-tracking"]
    max: 1

tools:
  github:
    toolsets: [default]

post-steps:
  - name: Workflow Summary
    if: always()
    env:
      INPUT_SEARCH_SCOPE: ${{ inputs.search_scope }}
      INPUT_PROCESSING_PRIORITY: ${{ inputs.processing_priority }}
      INPUT_INTENT: ${{ inputs.intent }}
      INPUT_LABEL_NAME: ${{ inputs.label_name }}
    run: |
      echo "## ContentHawk — Agent 1 (Detective)" >> "$GITHUB_STEP_SUMMARY"
      echo "" >> "$GITHUB_STEP_SUMMARY"

      # Show the inputs that were provided
      echo "### Inputs" >> "$GITHUB_STEP_SUMMARY"
      echo "" >> "$GITHUB_STEP_SUMMARY"
      echo "| Field               | Value |" >> "$GITHUB_STEP_SUMMARY"
      echo "|---------------------|-------|" >> "$GITHUB_STEP_SUMMARY"
      echo "| Search Scope        | $INPUT_SEARCH_SCOPE |" >> "$GITHUB_STEP_SUMMARY"
      echo "| Processing Priority | $INPUT_PROCESSING_PRIORITY |" >> "$GITHUB_STEP_SUMMARY"
      echo "| Intent              | $INPUT_INTENT |" >> "$GITHUB_STEP_SUMMARY"
      echo "| Label               | \`$INPUT_LABEL_NAME\` |" >> "$GITHUB_STEP_SUMMARY"
      echo "" >> "$GITHUB_STEP_SUMMARY"

      # List any files the agent created or modified
      echo "### Agent Output" >> "$GITHUB_STEP_SUMMARY"
      echo "" >> "$GITHUB_STEP_SUMMARY"
      if [ -d /tmp/gh-aw ]; then
        echo "\`\`\`" >> "$GITHUB_STEP_SUMMARY"
        find /tmp/gh-aw -type f | head -30 >> "$GITHUB_STEP_SUMMARY"
        echo "\`\`\`" >> "$GITHUB_STEP_SUMMARY"
      else
        echo "_No agent output directory found._" >> "$GITHUB_STEP_SUMMARY"
      fi

  - name: Upload Agent Artifacts
    if: always()
    uses: actions/upload-artifact@v4
    with:
      name: contenthawk-agent1-results
      path: /tmp/gh-aw/
      retention-days: 7
---

## Important context

This workflow is **Agent 1 (Detective)** in a three-agent pipeline called **ContentHawk**:

- **Agent 1 (this workflow)**: Catalogs content files and creates a snapshot tracking file. Creates a label for the intent.
- **Agent 2**: Reads the snapshot, checks each file against the intent, and opens GitHub issues for files that match. Uses the label and issue preferences captured here.
- **Agent 3**: Reads issues with the intent label and raises PRs to resolve them. Uses the PR preferences captured here.

The snapshot file you create must contain **all the information** Agent 2 and Agent 3 need — every user prompt is persisted into the snapshot so downstream agents are self-contained.

## Inputs provided by the user

All six prompts are captured and must be written into the snapshot file:

| Prompt              | Value                                | Used by        |
|---------------------|--------------------------------------|----------------|
| Search Scope        | `${{ inputs.search_scope }}`         | Agent 1        |
| Processing Priority | `${{ inputs.processing_priority }}`  | Agent 1        |
| Intent              | `${{ inputs.intent }}`               | Agents 1, 2, 3 |
| Issue Preferences   | `${{ inputs.issue_preferences }}`    | Agent 2        |
| PR Preferences      | `${{ inputs.pr_preferences }}`       | Agent 3        |
| Label Name          | `${{ inputs.label_name }}`           | Agents 1, 2, 3 |

---

### Step 0 — Check for an existing catalog PR

Before doing any work, check whether an open pull request already exists for this intent. Run:

```bash
gh pr list --label "catalog-tracking" --state open --search "[Content Catalog] ${{ inputs.intent }}" --json number,title
```

If the command returns **any** results, **stop immediately**. Output a message like:

> A catalog PR already exists for this intent (PR #\<number\>). Skipping to avoid duplicates.

Do **not** create a label, snapshot file, or pull request. End the workflow here.

### Step 1 — Create the intent label

Create a GitHub label named exactly `${{ inputs.label_name }}` with a distinguishing color and the intent as its description. Use the `--force` flag so re-runs update rather than fail:

```bash
gh label create "${{ inputs.label_name }}" --color "D93F0B" --description "${{ inputs.intent }}" --force
```

### Step 2 — Discover, filter, and sort content files

The user's search scope describes **exactly** which files belong in the snapshot:

```
${{ inputs.search_scope }}
```

The search scope is a free-text prompt. Interpret it to determine **all** of the following:

1. **Directory and file-type scope** — which directories to scan and which extensions to include (e.g. "all .mdx files under content/posts").
2. **Content-level filter** — any conditions about the file's contents, front-matter, or metadata that a file must satisfy to be included (e.g. "files that contain lorem ipsum", "non-archived files", "files with category X"). **You must read each candidate file and evaluate whether it meets these conditions.** Files that do not satisfy every condition in the search scope must be **excluded** from the snapshot.

**Only files that pass both the directory/type scope AND the content-level filter belong in the snapshot.** Do not include files that merely live in the right directory but fail the content-level criteria. If the search scope says "files that contain lorem ipsum", a file without lorem ipsum must not appear in the table. If the search scope says "non-archived", a file marked as archived must not appear. Be strict — when in doubt, read the file and check.

**Verification**: Before adding any file to the snapshot, confirm: Does this file match what the user is looking for:

Here is the user's intent again for reference:
```
${{ inputs.intent }}
```

For **each** file that passes all filters:

1. Read the file content (if you have not already done so during filtering).
2. Extract a **CategoryList** — look for any categorisation mechanism the file uses (front-matter tags, categories, labels, folder structure, etc.). If the file has a recognisable list of categories or tags, extract them as a comma-separated string. If none are found, use `uncategorized`.
3. Extract a **Created** date — look for any date field in front-matter that represents when the content was originally created or published (e.g. `date`, `created`, `publishedAt`). Use the format `YYYY-MM-DD`. If no such field exists, use `-`.
4. Extract a **LastUpdated** date — look for any date field in front-matter that represents the last modification (e.g. `lastUpdated`, `updatedAt`, `modified`, `lastChecked`). If no such field exists, use `-`.

After collecting all files, **sort them** according to the user's processing priority:

```
${{ inputs.processing_priority }}
```

Interpret this as a sort specification. For example, "first sort by created then lastUpdated" means sort primarily by Created date, then break ties with LastUpdated date. Apply ascending order unless the user explicitly says descending. Rows with `-` dates sort last.

### Step 3 — Write the snapshot tracking file

Determine today's date in `YYYY-MM-DD` format. Create the file:

```
.github/ContentHawk/TODO/<todays-date>_Snapshot_${{ inputs.label_name }}.md
```

For example: `.github/ContentHawk/TODO/2026-03-05_Snapshot_archive-legacy-rules.md`

The file must follow this **exact** structure:

```markdown
# Content Catalog Snapshot

## Agent Configuration

| Field               | Value                                           |
|---------------------|-------------------------------------------------|
| Intent              | ${{ inputs.intent }}                            |
| Search Scope        | ${{ inputs.search_scope }}                      |
| Processing Priority | ${{ inputs.processing_priority }}               |
| Issue Preferences   | ${{ inputs.issue_preferences }}                 |
| PR Preferences      | ${{ inputs.pr_preferences }}                    |
| Label               | `${{ inputs.label_name }}`                      |
| Created             | <today's date in YYYY-MM-DD>                    |

## Files to Review

| Path        | CategoryList   | Created    | LastUpdated   | CheckedDate | CheckResult |
|-------------|----------------|------------|---------------|-------------|-------------|
| <file-path> | <CategoryList> | <Created>  | <LastUpdated> | -           | pending     |
```

Rules for the table:

- One row per non-skipped file from Step 2.
- Rows are in the sort order determined by the processing priority (NOT alphabetical unless that is what the user requested).
- `CheckedDate` is always `-` (Agent 2 fills this in later).
- `CheckResult` is always `pending` (Agent 2 updates this later).

### Step 4 — Open the pull request

Create a pull request with the title `[Content Catalog] ${{ inputs.intent }}` from a branch named `ContentHawk/TODO/${{ inputs.label_name }}` into `main`.

Use this PR body:

```markdown
## Intent

${{ inputs.intent }}

## Search Scope

${{ inputs.search_scope }}

## Processing Priority

${{ inputs.processing_priority }}

## Label for flagged issues

`${{ inputs.label_name }}`

## Issue Preferences (for Agent 2)

${{ inputs.issue_preferences }}

## PR Preferences (for Agent 3)

${{ inputs.pr_preferences }}

## Snapshot file

The full file list with metadata is in `.github/ContentHawk/TODO/<todays-date>_Snapshot_${{ inputs.label_name }}.md` on this branch.

- **Agent 2** will iterate over the table rows in order, check each file against the intent, update `CheckedDate` and `CheckResult`, and open issues with the `${{ inputs.label_name }}` label.
- **Agent 3** will read issues labelled `${{ inputs.label_name }}` and raise PRs to resolve them.
```
