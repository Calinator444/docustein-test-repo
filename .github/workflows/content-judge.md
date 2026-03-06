---
description: >
  Agent 2 (Judge) of the ContentHawk pipeline.
  Reads a merged snapshot file from main, parses the Agent Configuration and
  Files to Review table, then iterates over every pending row in order.
  For each file it reads the content, judges whether the file needs action
  based on the Intent captured by Agent 1, and either opens a labelled GitHub
  issue or marks the row as Skipped.
  Once all affordable rows have been processed it commits the updated snapshot
  (CheckedDate and CheckResult filled in) to a new branch and opens a pull
  request back to main.
  Stops immediately if a judge PR already exists for this label to avoid
  duplicates. Also stops if the number of open labelled issues already meets
  or exceeds max_open_issues without making any changes.

on:
  workflow_dispatch:
    inputs:
      snapshot_path:
        description: "Repo-relative path to the snapshot file on main (e.g. '.github/ContentHawk/TODO/2026-03-05_Snapshot_archive-legacy-rules.md')."
        required: true
      label_name:
        description: "GitHub label slug that ties this pipeline together (e.g. 'archive-legacy-rules'). Must match the Label field in the snapshot."
        required: true
      max_open_issues:
        description: "Stop opening new issues once this many issues with the label are already open. Defaults to 30."
        required: false
        default: "30"

engine:
  id: copilot
  model: gpt-5-mini

mcp-servers:
  tavily:
    command: npx
    args: ["-y", "tavily-mcp"]
    env:
      TAVILY_API_KEY: "${{ secrets.TAVILY_API_KEY }}"
    allowed: ["tavily_search"]

permissions: read-all

network:
  allowed:
    - defaults
    - "*.tavily.com"

env:
  GIT_AUTHOR_NAME: "content-hawk"
  GIT_AUTHOR_EMAIL: "content-hawk@users.noreply.github.com"
  GIT_COMMITTER_NAME: "content-hawk"
  GIT_COMMITTER_EMAIL: "content-hawk@users.noreply.github.com"
  GH_TOKEN: ${{ github.token }}

concurrency:
  group: "contenthawk-judge-${{ inputs.label_name }}"
  cancel-in-progress: false

safe-outputs:
  create-issue:
    title-prefix: "🦅ContentHawk - Content Audit: "
    max: 30
  create-pull-request:
    title-prefix: "[Content Judge] "
    max: 1
  add-labels:
    target: "*"
    max: 31

tools:
  github:
    toolsets: [default]
  tavily:
    tools: [search, search_news]

post-steps:
  - name: Workflow Summary
    if: always()
    env:
      INPUT_SNAPSHOT_PATH: ${{ inputs.snapshot_path }}
      INPUT_LABEL_NAME: ${{ inputs.label_name }}
      INPUT_MAX_OPEN_ISSUES: ${{ inputs.max_open_issues }}
    run: |
      echo "## ContentHawk — Agent 2 (Judge)" >> "$GITHUB_STEP_SUMMARY"
      echo "" >> "$GITHUB_STEP_SUMMARY"

      echo "### Inputs" >> "$GITHUB_STEP_SUMMARY"
      echo "" >> "$GITHUB_STEP_SUMMARY"
      echo "| Field            | Value |" >> "$GITHUB_STEP_SUMMARY"
      echo "|------------------|-------|" >> "$GITHUB_STEP_SUMMARY"
      echo "| Snapshot Path    | $INPUT_SNAPSHOT_PATH |" >> "$GITHUB_STEP_SUMMARY"
      echo "| Label            | \`$INPUT_LABEL_NAME\` |" >> "$GITHUB_STEP_SUMMARY"
      echo "| Max Open Issues  | $INPUT_MAX_OPEN_ISSUES |" >> "$GITHUB_STEP_SUMMARY"
      echo "" >> "$GITHUB_STEP_SUMMARY"

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
      name: contenthawk-agent2-results
      path: /tmp/gh-aw/
      retention-days: 7
---

## Important context

This workflow is **Agent 2 (Judge)** in a three-agent pipeline called **ContentHawk**:

- **Agent 1 (Detective)**: Catalogs content files, creates a snapshot tracking file on a branch, and opens a PR. That PR is reviewed and merged into `main` before Agent 2 runs.
- **Agent 2 (this workflow)**: Reads the merged snapshot, judges each pending file against the intent, opens issues for files that need fixing, and opens a PR to update the snapshot.
- **Agent 3 (Fixer)**: Reads issues with the intent label and raises PRs to resolve them.

The snapshot file is **self-contained** — it stores every configuration value Agent 1 received, so Agent 2 reads everything it needs directly from the snapshot.

## Inputs provided by the user

| Input            | Value                                  | Used for                              |
|------------------|----------------------------------------|---------------------------------------|
| Snapshot Path    | `${{ inputs.snapshot_path }}`          | Locating the snapshot file on main    |
| Label Name       | `${{ inputs.label_name }}`             | Issues, PR, concurrency guard         |
| Max Open Issues  | `${{ inputs.max_open_issues }}`        | Headroom check before each issue      |

---

### Step 0 — Guard: check for an existing judge PR

Before doing any work, check whether an open PR already exists for this judge run. Use the GitHub toolset to query for open PRs with the label `${{ inputs.label_name }}` and the search term `[Content Judge]`:

If the command returns **any** results, **stop immediately**. Output a message like:

> A judge PR already exists for this intent (PR #\<number\>). Skipping to avoid duplicates.

Do **not** read the snapshot, create issues, or open a PR. End the workflow here.

### Step 1 — Read and parse the snapshot

Read the full content of the file at `${{ inputs.snapshot_path }}` from the `main` branch.

#### 1a. Parse the Agent Configuration table

Extract the following fields from the `## Agent Configuration` table:

- **Intent** — what to look for in each file
- **Issue Preferences** — how to write issues (templates, detail level, max per run, etc.)
- **Label** — the label slug stored in the snapshot

**Validation**: Assert that the `Label` value extracted from the snapshot matches `${{ inputs.label_name }}` exactly (ignoring surrounding backticks). If they do not match, **stop immediately** with an error:

> Snapshot label '<snapshot_label>' does not match the input label '${{ inputs.label_name }}'. Aborting.

#### 1b. Parse the Files to Review table

Collect every row from the `## Files to Review` table where **`CheckResult` is exactly `pending`**. Preserve the exact row order from the table — this is the processing order. Call this list `pending_rows`.

If `pending_rows` is empty (all rows already have a non-pending CheckResult), **stop immediately** with a message:

> No pending rows found in snapshot. Nothing to do.

### Step 2 — Check open-issue headroom

Count the number of currently open issues that carry the label `${{ inputs.label_name }}`:

```bash
gh issue list --label "${{ inputs.label_name }}" --state open --json number | jq 'length'
```

Let this count be `open_count`. Let `max_open_issues` = `${{ inputs.max_open_issues }}` (parsed as an integer).

If `open_count >= max_open_issues`, **stop immediately**. Output a message like:

> Issue limit reached: $open_count open issues already exist with label '${{ inputs.label_name }}' (max: $max_open_issues). Run again after issues are closed.

Do **not** update the snapshot or open a PR.

### Step 3 — Process pending rows in order

Work through `pending_rows` one at a time, **in order**. For each row:

#### 3a. Re-check headroom

Before processing this row, re-count open issues:

```bash
gh issue list --label "${{ inputs.label_name }}" --state open --json number | jq 'length'
```

If `open_count >= max_open_issues`, **stop the loop**. Leave this row and all remaining rows with `CheckResult = pending` and `CheckedDate = -`. Proceed to Step 4 to commit whatever updates have been made so far.

#### 3b. Read the content file

Read the full content of the file at the `Path` value from the row. If the file does not exist inis  the repository, record:
- `CheckResult = Skipped`
- `CheckedDate = <today's date in YYYY-MM-DD>`

Log a warning and continue to the next row.

#### 3c. Judge the file

Evaluate the file's content against the **Intent** extracted in Step 1a. Your judgment must determine:

1. **`needs_action`** (`true` or `false`) — does this file require attention based on the intent?
2. **`issue_summary`** — if `needs_action` is true: a concise description of the specific problem (≤ 10 words, used directly in the issue title). Make it specific to this file, not generic.
3. **`issue_body`** — if `needs_action` is true: a fuller description for the issue body (see Step 3d for required sections). Respect any formatting or template instructions from **Issue Preferences**.

**Using web search during judgment**: If evaluating the file requires external context (e.g. checking whether a technology is deprecated, whether a recommended practice has changed, whether a link or reference is still valid), use the Tavily search tool:
- Formulate targeted queries like `"[technology] deprecated 2025"`, `"[tool] end of life"`, `"[topic] current best practices"`
- Let search results inform whether the file's content is outdated, inaccurate, or in need of the action described in the intent
- If search results are inconclusive, default to `needs_action = false` (do not create spurious issues)

#### 3d. Create an issue (if `needs_action = true`)

Create a GitHub issue using the `create-issue` safe-output tool:

**Title**: `🦅ContentHawk - Content Audit: <issue_summary>`

> Note: the `title-prefix` safe-output setting will prepend `🦅ContentHawk - Content Audit: ` automatically — so only pass the `<issue_summary>` part as the title value.

**Body** (use these exact sections, honouring any formatting instructions from Issue Preferences):

```markdown
### File

`<Path>`

### Intent

<Intent from Agent Configuration>

### Finding

<A clear explanation of why this file needs attention, based on your analysis. Be specific — reference the actual content that triggered the finding.>

### Suggestions

<Concrete, actionable suggestions for how to resolve the issue. If you used web search, include relevant references.>

---
_Created by [ContentHawk Agent 2](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})_
```

After creating the issue, apply the label `${{ inputs.label_name }}` to it using the `add-labels` tool.

Record the created issue number. Update this row:
- `CheckResult = Issue #<number>`
- `CheckedDate = <today's date in YYYY-MM-DD>`

#### 3e. Skip the file (if `needs_action = false`)

Update this row:
- `CheckResult = Skipped`
- `CheckedDate = <today's date in YYYY-MM-DD>`

### Step 4 — Write the updated snapshot

Produce the full updated snapshot file. The content must be identical to the original snapshot **except** for the rows that were processed — only the `CheckedDate` and `CheckResult` columns change for those rows. All other columns (`Path`, `CategoryList`, `Created`, `LastUpdated`) must be preserved **verbatim**, character-for-character.

Rows that were not reached because the loop stopped early retain `CheckResult = pending` and `CheckedDate = -` exactly as they were.

The `## Agent Configuration` table must be preserved entirely unchanged.

### Step 5 — Open a pull request with the updated snapshot

Create a new branch from `main` named:

```
ContentHawk/judge/${{ inputs.label_name }}
```

Commit the updated snapshot file from Step 4 to this branch. The commit message must be:

```
content-hawk[judge]: update snapshot for ${{ inputs.label_name }}
```

Then open a pull request using the `create-pull-request` safe-output tool:

**Title**: `[Content Judge] ${{ inputs.label_name }} — <N> issues opened, <M> skipped`

> Note: the `title-prefix` safe-output setting will prepend `[Content Judge] ` automatically — so only pass `${{ inputs.label_name }} — <N> issues opened, <M> skipped` as the title value.

**Base branch**: `main`

**Body**:

```markdown
## ContentHawk — Agent 2 (Judge) Results

### Summary

| Metric                | Count |
|-----------------------|-------|
| Issues opened         | <N>   |
| Rows skipped          | <M>   |
| Rows still pending    | <P>   |

### Label

`${{ inputs.label_name }}`

### Snapshot file

`${{ inputs.snapshot_path }}`

### Issues opened

<For each issue created, one bullet: `- #<number>: <issue_summary>`>
<If no issues were created, write: _No issues were opened this run._>

### Next steps

- Merge this PR to update the snapshot on `main`.
- If rows are still pending, re-run Agent 2 after closing enough issues to drop below the limit.
- Once all rows are processed, Agent 3 can start resolving the open issues.

---
_Generated by [ContentHawk Agent 2](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})_
```

After the PR is created, apply the label `${{ inputs.label_name }}` to the PR using the `add-labels` tool.
