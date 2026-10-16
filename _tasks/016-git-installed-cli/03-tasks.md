# Git-Installed Slicr CLI Tasks

## Feature Description

Package and release the CLI so an external project can install and use it independently of the Slicr monorepo. See [./02-plan.md](./02-plan.md).

## Workflow

Tasks should move through these status values in order:

- `[created]`: the task was described, but no work was done to implement it
- `[started]`: an agent sets this status before starting work on a task
- `[done]`: an agent sets this status once the task is complete

**IMPORTANT**: Only ONE task should be `[started]` at a time.

## Learnings

Add feature learnings to `./05-learnings.md` when implementation begins.

## Task 1: Build a self-contained CLI package

### Status

[created]

### Description

Produce a reproducible package artifact with an executable `slicr` entry point and all required runtime code, without relying on monorepo-relative paths, private workspace packages, or workspace symlinks.

### Acceptance Criteria

- The package has an executable CLI entry point and documents its supported Node version.
- The packed contents include all runtime code and dependencies required by a clean consumer project.
- A clean temporary consumer can install the local packed artifact and run supported read/edit commands against a temporary project model.
- The installed CLI supports default project discovery and explicit `--path`, and fails safely for missing or corrupt models.

### Dependencies

- `_tasks/015-agent-interaction` Task 2

### Notes

- Keep root `npm run slicr -- ...` as a development convenience.
- Do not change dependency versions without explicit approval.

## Task 2: Release the Git-hosted CLI artifact

### Status

[created]

### Description

Attach the verified `.tgz` to a Git-hosted release whose tag matches the package version, and document how an external project installs and uses it.

### Acceptance Criteria

- A Git-hosted release asset contains the versioned CLI `.tgz` and the release tag matches the package version.
- Installation instructions identify the release asset and supported Node version.
- A clean consumer project can install the release artifact and run the same discovery, explicit-path, read/edit, and safe-failure checks without access to the Slicr checkout.
- The root development forwarding command remains functional.

### Dependencies

- Task 1

### Notes

- This task does not require publishing to an npm registry.
- Keep release credentials and publishing actions within the authorized release workflow.
