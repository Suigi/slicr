# AGENT Notes

## Tests and Test-Driven Development

- **ALWAYS** run tests via the `./scripts/test.sh` script. It is a wrapper for `vitest` and forwards all arguments.
- Use the $ptdd skill when adding or changing behavior.

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

## Collaboration Workflow (How We Work Together)

- Start with TDD by default:
  - Write/adjust tests first.
  - Run tests and confirm they fail for the expected reason.
  - Implement the smallest change to move behavior forward.
  - Re-run tests and confirm failures change in the expected direction until green.
- While iterating, focused tests are OK for speed, but before closing a task:
  - run lint,
  - run full tests,
  - run `npx tsc -b`.
- Before any commit, run full production build once:
  - run `npm run build`.
- Commit discipline:
  - Commit after each completed task/milestone.
  - Use clear commit messages describing behavioral outcome.
  - Avoid batching unrelated changes in one commit.
  - When I say "commit", propose a list of staged files and a concise commit message. After I've reviewed and approved, execute the commit.
- Regression safety:
  - Add a regression test for each bug fixed.
  - If a fix changes behavior in key editing flows (autocomplete, keybindings, parsing), include targeted tests for that flow.
- Communication style in sessions:
  - Keep updates short and frequent.
  - State what is being changed next, then report test/build outcomes.

## Skills

- Use [$feature-process-init](./.codex/skills/feature-process-init/SKILL.md) when starting a new feature with the repo's feature-process workflow: clarify the request, suggest the slug, create `tasks/_process/<three-digit-id>-<slug>/`, write `02-plan.md`, and create `03-tasks.md` before implementation starts.
- Use [$feature-process-execute-task](./.codex/skills/feature-process-execute-task/SKILL.md) when a feature folder already exists and the next step is to implement exactly one planned task with PTDD, validation, and learnings updates.
