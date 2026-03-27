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

command='npm run test --workspaces --if-present'

extra_args=''

for arg in "$@"; do
  extra_args="$extra_args $(shell_quote "$arg")"
done

if [ -n "$extra_args" ]; then
  command="$command --$extra_args"
fi

exec nix-shell --run "$command"
