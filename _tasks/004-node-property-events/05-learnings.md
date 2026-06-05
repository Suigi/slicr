# Node Property Events Learnings

- Review persistence plans against the current UI component contract before event modeling. For this feature, reviewing `PropertyEditor`/`PropertyGrid` revealed two prerequisite contract issues: no-example display fallback and optional property IDs.
- When persisted references depend on UI-generated identifiers, make the identifier required and stabilize existing fixture/mockup data before adding event mapping.
- Editable property examples flow through `example`/`exampleValues`/`rows`; do not reintroduce `EditableProperty.value`. The React `PropertyGrid` wrapper should normalize editable arrays from examples only so empty examples render the type fallback.
- For object-list editable properties, row values should use stable nested property IDs as keys. `PropertyGrid` can still fall back to names for legacy display, but new mockups/event mappings should prefer IDs.
- Keep property event import validation structural and additive: validate required schema/example fields, allow extra payload fields for forward compatibility, and reject nested `properties` on non-`Object` schema entries.
- TypeScript recursive complex example values should use an interface with an index signature rather than a recursive `Record` type alias, which fails typecheck in this repo.
- The projected property maps are part of both `ModelGraph` and `RendererGraph`; even empty graph snapshots should carry empty `nodeSchemas` and `nodeExampleValues` maps so downstream hooks can rely on the shape.
