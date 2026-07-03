#!/bin/sh

set -eu

mode=${1:-check}
case "$mode" in
  check)
    prettier_flag="--check"
    ;;
  write)
    prettier_flag="--write"
    ;;
  *)
    echo "Usage: $0 [check|write]" >&2
    exit 2
    ;;
esac

files=$(mktemp)
trap 'rm -f "$files"' EXIT

{
  git diff --name-only --diff-filter=ACMR HEAD
  git ls-files --others --exclude-standard
} | while IFS= read -r file; do
  if [ -f "$file" ]; then
    printf '%s\n' "$file"
  fi
done | sort -u > "$files"

if [ ! -s "$files" ]; then
  echo "No changed files to format."
  exit 0
fi

xargs npx prettier "$prettier_flag" --ignore-unknown < "$files"
