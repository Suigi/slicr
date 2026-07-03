# AGENT Notes

## Repo Setup

- This is a mono-repo using npm workspaces

## Editing Files

- Use the `edit` tool for targeted edits whenever it is available, rather than scripting file modifications through shell/Python.

## Testing

- Prefer `npm run test:llm --workspace=<workspace-name>` when running Vitest tests so output is concise for LLM review.
- Use the normal `test` scripts only when the default Vitest reporter output is specifically needed.
- Before closing LLM implementation sessions, run `npm run validate:llm` from the repo root unless explicitly skipped with a documented reason. This includes Prettier format checking for changed/untracked files, lint, LLM-friendly tests, and typecheck.
- Use `npm run format` from the repo root to apply Prettier formatting to changed/untracked files before final validation when files have been edited.

## Commit Messages

- Use conventional commits. For example:
  ```
  feat(slicr-dcb): Implemented new feature XYZ
  refactor(event-sourcing): Extracted functionality XYZ into its own file
  chore(slicr-dcb): Fixed formatting
  ```
