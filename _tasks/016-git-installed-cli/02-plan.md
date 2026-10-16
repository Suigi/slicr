# Git-Installed Slicr CLI

## Summary

Package the Slicr CLI as a versioned, reproducible artifact that an external project can install from a Git-hosted release and run without access to the Slicr monorepo. This is separate from the project-owned model/editor work in Task 012 and the agent-interaction workflow in [015](../015-agent-interaction/02-plan.md).

## Goals

- Produce a versioned npm package artifact with an executable `slicr` entry point and all required runtime code.
- Make the artifact installable by an external project from a Git-hosted release asset.
- Document the supported Node version and installation/use commands.
- Verify the installed CLI discovers the consumer project's `.slicr/`, supports explicit `--path`, and safely handles missing or corrupt stores.
- Keep the root `npm run slicr -- ...` command as a development convenience.

## Non-goals

- Registry publication is not required for this task.
- The installed CLI must not depend on the Slicr checkout, monorepo-relative paths, private workspace packages, or workspace symlinks.
- Do not change event-store format, project initialization behavior, or command semantics.
- Do not silently change dependency versions; any dependency changes require explicit approval.

## Core rules

- Package version and Git release tag must align.
- The package includes its executable and every runtime dependency needed in a clean consumer project.
- CLI behavior and safe failure semantics match the repository's supported CLI commands.
- The project-local `.slicr/` history remains the consumer project's authority; package installation does not initialize or rewrite it.

## Implementation shape

- Select a reproducible bundling/runtime-dependency strategy that avoids private workspace-package assumptions.
- Pack and inspect the artifact, then install it in a clean temporary consumer project.
- Verify commands from outside the monorepo, including default discovery and explicit `--path`.
- Attach the `.tgz` artifact to a Git-hosted release and document installation and supported Node version.

## Test plan

- Inspect the packed file list and executable metadata.
- Install the local packed artifact in a clean consumer project as a pre-release check and run supported read/edit commands against a temporary `.slicr/` model.
- Verify explicit path selection and safe errors for missing/corrupt models.
- Install the release asset in a clean consumer project and repeat the smoke checks without access to the Slicr checkout.

## Deferred follow-up

Publishing to a package registry may be considered separately; this task only requires a Git-hosted release artifact.
