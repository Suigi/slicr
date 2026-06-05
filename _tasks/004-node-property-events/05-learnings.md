# Node Property Events Learnings

- Review persistence plans against the current UI component contract before event modeling. For this feature, reviewing `PropertyEditor`/`PropertyGrid` revealed two prerequisite contract issues: no-example display fallback and optional property IDs.
- When persisted references depend on UI-generated identifiers, make the identifier required and stabilize existing fixture/mockup data before adding event mapping.
- Editable property examples flow through `example`/`exampleValues`/`rows`; do not reintroduce `EditableProperty.value`. The React `PropertyGrid` wrapper should normalize editable arrays from examples only so empty examples render the type fallback.
