# Node Property Events Learnings

- Review persistence plans against the current UI component contract before event modeling. For this feature, reviewing `PropertyEditor`/`PropertyGrid` revealed two prerequisite contract issues: no-example display fallback and optional property IDs.
- When persisted references depend on UI-generated identifiers, make the identifier required and stabilize existing fixture/mockup data before adding event mapping.
