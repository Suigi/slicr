# AGENT Notes

## Tests and Test-Driven Development

- **ALWAYS** run all the tests (`npm test`) instead of just the task-specific ones.
- **ALWAYS** write a failing test before adding or changing behavior. Run the tests to see it fail in the expected way. Only then, implement the feature.

## Running npm in this repo

`npm` is expected to run inside the Nix shell.

- Environment entrypoint: `.envrc` contains `use nix`.
- Shell definition: `default.nix` provides `nodejs_24` (and related tooling).

Use this pattern for Node commands:

```bash
nix-shell --run 'npm <command>'
```

Examples:

```bash
nix-shell --run 'npm run dev'
nix-shell --run 'npm run build'
```

## Testing policy

Always run the full test suite for validation, not only task-specific tests.

Use:

```bash
nix-shell --run 'npm test'
```
