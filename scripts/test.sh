#!/bin/sh

set -eu

shell_quote() {
  value=$1
  quoted="'"

  while [ -n "$value" ]; do
    char=${value%"${value#?}"}
    value=${value#?}

    if [ "$char" = "'" ]; then
      quoted="${quoted}'\\''"
    else
      quoted="${quoted}${char}"
    fi
  done

  printf "%s'" "$quoted"
}

if command -v npx >/dev/null 2>&1; then
  exec npx vitest run --reporter vitest-llm-reporter "$@"
fi

command='npx vitest run --reporter vitest-llm-reporter'

for arg in "$@"; do
  command="$command $(shell_quote "$arg")"
done

exec nix-shell --run "$command"
