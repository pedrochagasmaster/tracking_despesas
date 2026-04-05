#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage:
  $(basename "$0") -a <account_email> -q <gmail_query> [options]

Required:
  -a, --account        Gmail account for gog (example: me@gmail.com)
  -q, --query          Gmail query (example: 'from:(@nubank.com.br) has:attachment')

Options:
  -o, --outdir         Output directory (default: ./gog_attachments_YYYYmmdd_HHMMSS)
  -x, --extensions     Comma-separated extensions to keep (default: all)
                       Example: csv,pdf
  -s, --since          Cutoff time; only download messages newer than this
                       Examples: 24h, 7d, 2026-02-20, 1708387200
  -n, --name-template  Name format (default: timestamp_subject_messageid_original)
                       Allowed: timestamp_subject_messageid_original | original
  -h, --help           Show this help

Examples:
  $(basename "$0") -a me@gmail.com -q 'from:(@nubank.com.br) has:attachment filename:csv' -x csv
  $(basename "$0") -a me@gmail.com -q 'from:(@nubank.com.br) has:attachment' -x csv --since 24h
  $(basename "$0") -a me@gmail.com -q 'subject:(invoice) has:attachment newer_than:90d' -x pdf,csv
USAGE
}

ACCOUNT=""
QUERY=""
OUTDIR=""
EXTENSIONS=""
SINCE=""
NAME_TEMPLATE="timestamp_subject_messageid_original"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -a|--account)
      ACCOUNT="${2:-}"; shift 2 ;;
    -q|--query)
      QUERY="${2:-}"; shift 2 ;;
    -o|--outdir)
      OUTDIR="${2:-}"; shift 2 ;;
    -x|--extensions)
      EXTENSIONS="${2:-}"; shift 2 ;;
    -s|--since)
      SINCE="${2:-}"; shift 2 ;;
    -n|--name-template)
      NAME_TEMPLATE="${2:-}"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1 ;;
  esac
done

if [[ -z "$ACCOUNT" || -z "$QUERY" ]]; then
  echo "Missing required arguments: --account and --query" >&2
  usage
  exit 1
fi

if ! command -v gog >/dev/null 2>&1; then
  echo "gog not found in PATH" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq not found in PATH" >&2
  exit 1
fi

if [[ "$NAME_TEMPLATE" != "timestamp_subject_messageid_original" && "$NAME_TEMPLATE" != "original" ]]; then
  echo "Invalid --name-template value: $NAME_TEMPLATE" >&2
  exit 1
fi

if [[ -z "$OUTDIR" ]]; then
  OUTDIR="gog_attachments_$(date +%Y%m%d_%H%M%S)"
fi
mkdir -p "$OUTDIR"

SEARCH_JSON="$(mktemp)"
trap 'rm -f "$SEARCH_JSON"' EXIT

gog -a "$ACCOUNT" gmail messages search "$QUERY" --all --json > "$SEARCH_JSON"

jq -r '.messages[]?.id' "$SEARCH_JSON" | sort -u > "$OUTDIR/.message_ids.txt"
MSG_COUNT="$(wc -l < "$OUTDIR/.message_ids.txt" | tr -d ' ')"

sanitize() {
  echo "$1" | sed 's/[^[:alnum:]. _-]/_/g; s/^[_ ]\+//; s/[_ ]\+$//; s/[[:space:]]\+/ /g' | cut -c1-100
}

parse_since_epoch() {
  local raw="$1"

  if [[ -z "$raw" ]]; then
    echo ""
    return 0
  fi

  if [[ "$raw" =~ ^[0-9]+$ ]]; then
    echo "$raw"
    return 0
  fi

  if [[ "$raw" =~ ^([0-9]+)h$ ]]; then
    local hours="${BASH_REMATCH[1]}"
    echo $(( $(date +%s) - hours * 3600 ))
    return 0
  fi

  if [[ "$raw" =~ ^([0-9]+)d$ ]]; then
    local days="${BASH_REMATCH[1]}"
    echo $(( $(date +%s) - days * 86400 ))
    return 0
  fi

  if date -d "$raw" +%s >/dev/null 2>&1; then
    date -d "$raw" +%s
    return 0
  fi

  return 1
}

is_allowed_extension() {
  local filename="$1"
  local ext_csv="$2"

  if [[ -z "$ext_csv" ]]; then
    return 0
  fi

  local filename_lc ext
  filename_lc="$(echo "$filename" | tr '[:upper:]' '[:lower:]')"

  IFS=',' read -r -a parts <<< "$ext_csv"
  for ext in "${parts[@]}"; do
    ext="$(echo "$ext" | tr '[:upper:]' '[:lower:]' | xargs)"
    [[ -z "$ext" ]] && continue
    if [[ "$filename_lc" == *."$ext" ]]; then
      return 0
    fi
  done
  return 1
}

DOWNLOADED=0
SCANNED=0
FAILED=0
SKIPPED_CUTOFF=0

SINCE_EPOCH=""
if [[ -n "$SINCE" ]]; then
  if ! SINCE_EPOCH="$(parse_since_epoch "$SINCE")"; then
    echo "Invalid --since value: $SINCE" >&2
    echo "Use formats like 24h, 7d, 2026-02-20, or unix seconds." >&2
    exit 1
  fi
fi

while IFS= read -r MSG_ID; do
  [[ -z "$MSG_ID" ]] && continue
  SCANNED=$((SCANNED + 1))

  MSG_JSON="$(mktemp)"
  if ! gog -a "$ACCOUNT" gmail get "$MSG_ID" --format full --json > "$MSG_JSON" 2>/dev/null; then
    rm -f "$MSG_JSON"
    FAILED=$((FAILED + 1))
    continue
  fi

  REAL_ID="$(jq -r '.message.id // empty' "$MSG_JSON")"
  [[ -z "$REAL_ID" ]] && REAL_ID="$MSG_ID"

  INTERNAL_DATE="$(jq -r '.message.internalDate // empty' "$MSG_JSON")"
  INTERNAL_EPOCH=""
  if [[ -n "$INTERNAL_DATE" && "$INTERNAL_DATE" != "null" ]]; then
    INTERNAL_EPOCH="$((INTERNAL_DATE/1000))"
  fi

  if [[ -n "$SINCE_EPOCH" ]]; then
    if [[ -z "$INTERNAL_EPOCH" || "$INTERNAL_EPOCH" -lt "$SINCE_EPOCH" ]]; then
      SKIPPED_CUTOFF=$((SKIPPED_CUTOFF + 1))
      rm -f "$MSG_JSON"
      continue
    fi
  fi

  if [[ -n "$INTERNAL_DATE" && "$INTERNAL_DATE" != "null" ]]; then
    TS="$(date -d "@$((INTERNAL_DATE/1000))" +%Y-%m-%d_%H-%M-%S 2>/dev/null || date +%Y-%m-%d_%H-%M-%S)"
  else
    TS="$(date +%Y-%m-%d_%H-%M-%S)"
  fi

  SUBJECT_RAW="$(jq -r '[.message.payload.headers[]? | select((.name|ascii_downcase)=="subject") | .value][0] // "no-subject"' "$MSG_JSON")"
  SUBJECT="$(sanitize "$SUBJECT_RAW")"
  [[ -z "$SUBJECT" ]] && SUBJECT="no-subject"

  ATTACH_LIST="$(jq -r '.attachments[]? | [(.attachmentId // ""), (.filename // "attachment.bin")] | @tsv' "$MSG_JSON")"

  if [[ -n "$ATTACH_LIST" ]]; then
    while IFS=$'\t' read -r ATT_ID ATT_NAME; do
      [[ -z "$ATT_ID" ]] && continue
      SAFE_ATT="$(sanitize "$ATT_NAME")"
      [[ -z "$SAFE_ATT" ]] && SAFE_ATT="attachment.bin"

      if ! is_allowed_extension "$SAFE_ATT" "$EXTENSIONS"; then
        continue
      fi

      if [[ "$NAME_TEMPLATE" == "original" ]]; then
        TARGET="$OUTDIR/$SAFE_ATT"
      else
        TARGET="$OUTDIR/${TS}__${SUBJECT}__${REAL_ID}__${SAFE_ATT}"
      fi

      i=1
      while [[ -e "$TARGET" ]]; do
        if [[ "$NAME_TEMPLATE" == "original" ]]; then
          base="${SAFE_ATT%.*}"
          ext="${SAFE_ATT##*.}"
          if [[ "$base" == "$ext" ]]; then
            TARGET="$OUTDIR/${SAFE_ATT}_${i}"
          else
            TARGET="$OUTDIR/${base}_${i}.${ext}"
          fi
        else
          TARGET="$OUTDIR/${TS}__${SUBJECT}__${REAL_ID}__${i}__${SAFE_ATT}"
        fi
        i=$((i + 1))
      done

      if gog -a "$ACCOUNT" gmail attachment "$REAL_ID" "$ATT_ID" --out "$TARGET" >/dev/null 2>&1; then
        echo "$TARGET"
        DOWNLOADED=$((DOWNLOADED + 1))
      else
        FAILED=$((FAILED + 1))
      fi
    done <<< "$ATTACH_LIST"
  fi

  rm -f "$MSG_JSON"
done < "$OUTDIR/.message_ids.txt"

cat > "$OUTDIR/summary.txt" <<SUMMARY
account=$ACCOUNT
query=$QUERY
messages_found=$MSG_COUNT
messages_scanned=$SCANNED
attachments_downloaded=$DOWNLOADED
failures=$FAILED
since=$SINCE
since_epoch=$SINCE_EPOCH
messages_skipped_cutoff=$SKIPPED_CUTOFF
outdir=$OUTDIR
SUMMARY

echo "SUMMARY messages_found=$MSG_COUNT messages_scanned=$SCANNED messages_skipped_cutoff=$SKIPPED_CUTOFF attachments_downloaded=$DOWNLOADED failures=$FAILED outdir=$OUTDIR"
