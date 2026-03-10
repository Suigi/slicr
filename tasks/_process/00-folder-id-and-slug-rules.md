# Folder Id And Slug Rules

Use these rules before creating `tasks/_process/<three-digit-id>-<slug>/`.

## Three-Digit Id

- Scan the existing immediate subfolders under `tasks/_process`.
- Use the next available numeric id greater than every existing three-digit prefix.
- Treat ids as global within `tasks/_process`.
- Do not reuse gaps unless the user explicitly asks for that behavior.
- Always zero-pad to three digits.

Examples:

- `001-example-feature`
- `002-project-overview`
- `017-parser-cleanup`

## Slug

- Use lowercase letters, numbers, and hyphens only.
- Keep it short, stable, and specific.
- Prefer 2 to 5 meaningful words.
- Base it on the feature outcome, not the implementation mechanism.
- Avoid vague slugs such as `refactor`, `cleanup`, `improvements`, or `misc`.
- Avoid adding the numeric id into the slug itself.

Good examples:

- `slice-connections`
- `overview-scenario-groups`
- `theme-bootstrap`

Weak examples:

- `feature-work`
- `refactor`
- `diagram-stuff`

## Agent Action

When starting Phase 2:

1. Suggest the slug.
2. Determine the next three-digit id.
3. Create the feature folder.
4. Use that same folder consistently for all later files.
