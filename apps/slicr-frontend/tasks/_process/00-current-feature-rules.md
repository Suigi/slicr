# Current Feature Pointer Rules

Use `tasks/_process/current-feature.toml` as the single repo-level pointer to the active feature folder.

## File Shape

The file should use this structure:

```toml
feature_dir = "tasks/003-example-feature"
phase = "implementation"
current_task = "T1"
status = "active"
```

## Resolution Order

When a workflow phase or skill needs a feature folder:

1. If the user explicitly names a feature folder in the current conversation, use that folder.
2. Otherwise, read `tasks/_process/current-feature.toml`.
3. If the pointer is missing, empty, or stale, stop and ask the human instead of scanning `tasks/`.

## Update Rules

- Phase 2 should write `feature_dir` as soon as the feature folder is created.
- Phase 3 should keep the same `feature_dir` and update `phase = "task-breakdown"`.
- Phase 4 should keep the same `feature_dir` and update `phase = "implementation"` plus `current_task` when work starts.
- Phase 6 should either:
  - keep the pointer on the same folder if more tasks remain, or
  - clear `current_task` and set `status = "done"` when the feature closes.

## Staleness Rules

Treat the pointer as stale if:

- `feature_dir` does not exist
- `02-plan.md` or `03-tasks.md` is required for the current phase but missing
- `current_task` names a task that no longer exists

Do not recover by guessing from neighboring feature folders.
