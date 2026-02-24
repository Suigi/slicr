# Diagram Renderer Contract Invariants

- Stable IDs: node keys and edge keys must be deterministic and remain stable across renders for identical diagram inputs.
- Coordinate Space: all scene coordinates are world-space values; renderer-specific viewport/camera transforms must be applied separately.
- Commit-on-end: drag interactions may update optimistic UI state while moving, but commit callbacks fire only at interaction end.
