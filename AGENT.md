# AGENT Notes

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

## Verified finding (2026-02-16)

Running the build through Nix shell succeeds:

```bash
nix-shell --run 'npm run build'
```

Observed result:

- `tsc -b && vite build` completed successfully.
- Production assets were generated in `dist/`.
- Non-blocking warning seen: missing Nix channels path `/nix/var/nix/profiles/per-user/root/channels`.
