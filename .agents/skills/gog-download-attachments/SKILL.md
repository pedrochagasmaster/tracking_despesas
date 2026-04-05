---
name: gog-download-attachments
description: Standardize downloading Gmail attachments with the gog CLI, including authentication flow, Gmail query search, bulk attachment extraction, safe filename normalization, and download summaries. Use when tasks involve finding emails and saving attachments (especially by sender domain, file type, or date range) from a Gmail account.
---

Use this skill to run repeatable `gog` workflows for downloading Gmail attachments at scale.

## Follow This Workflow

1. Verify prerequisites.
2. Authenticate the target Gmail account in `gog`.
3. Run bulk download script with a precise Gmail query.
4. Validate output count and summary.

## Verify Prerequisites

Run:

```bash
which gog
which jq
gog --version
```

If auth is missing, run:

```bash
gog auth status --json
gog login <account_email> --services gmail --readonly --remote --step=1 --json
```

Then complete consent in browser and exchange callback URL:

```bash
gog login <account_email> --services gmail --readonly --remote --step=2 --auth-url '<full_callback_url>' --json
```

## Download Attachments in Bulk

Use script:

- `scripts/gog_download_attachments.sh`

Example (CSV from Nubank domain):

```bash
./scripts/gog_download_attachments.sh \
  --account ball.hard.af@gmail.com \
  --query 'from:(@nubank.com.br) has:attachment filename:csv' \
  --since 24h \
  --extensions csv \
  --outdir ./nubank_csv_attachments
```

Script behavior:

- Search all matching messages via `gog gmail messages search --all`.
- Fetch each message via `gog gmail get --format full`.
- Extract attachment metadata from `.attachments[]`.
- Download each attachment via `gog gmail attachment`.
- Save files with safe names.
- Apply exact cutoff filtering with `--since` using message `internalDate`.
- Write `summary.txt` in output directory.

Supported cutoff formats:

- `24h` (last 24 hours)
- `7d` (last 7 days)
- `YYYY-MM-DD`
- Unix epoch seconds

## Naming and Deduplication Rules

Default filename template:

- `YYYY-MM-DD_HH-MM-SS__SUBJECT__MESSAGEID__ORIGINAL_FILENAME`

Alternative template:

- `--name-template original`

When target names collide, append incremental suffixes to preserve all files.

## Query Design

Use `references/gmail_query_patterns.md` for query patterns.

Guidelines:

- Always include `has:attachment`.
- Add file type hints like `filename:csv` where possible.
- Narrow by sender/domain/date to reduce noise.
- Optionally add Gmail-native filters like `newer_than:7d`, but keep `--since` for exact cutoff control.

## Output Validation

After running downloads, check:

```bash
cat <outdir>/summary.txt
find <outdir> -maxdepth 1 -type f | wc -l
```

If counts look wrong:

- Re-check Gmail query specificity.
- Re-run with tighter filters.
- Confirm account has required mailbox visibility.
