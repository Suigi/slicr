# DCB Node Size Measurement Learnings

- During planning, explicitly decide whether measurement should reflect stable content or the currently visible node UI. For this feature, measurement must follow the current visible `GraphNodeView` state while still running off-canvas and unzoomed.
- When measured dimensions feed layout and export, define a settled-state rule up front so export behavior is deterministic after graph changes.
- Keep the DCB measurement helper pure and app-specific: use a shared selector plus `data-node-id`, and filter invalid DOMRect values before they can influence layout state.
