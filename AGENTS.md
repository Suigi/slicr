# AGENT Notes

## Repo Setup

- This is a mono-repo using npm workspaces

## Editing Files

- Use the `edit` tool for targeted edits whenever it is available, rather than scripting file modifications through shell/Python.

## Testing

- Prefer `npm run test:llm --workspace=<workspace-name>` when running Vitest tests so output is concise for LLM review.
- Use the normal `test` scripts only when the default Vitest reporter output is specifically needed.

## Commit Messages

- Use conventional commits. For example:
    ```
    feat(slicr-dcb): Implemented new feature XYZ
    refactor(event-sourcing): Extracted functionality XYZ into its own file
    chore(slicr-dcb): Fixed formatting
    ```