# Event Sourcing App Migration Learnings

- Focused app tests should use `npm run test --workspace slicr-dcb -- <path>`; `./scripts/test.sh` is still the full-suite wrapper and forwards extra args to every workspace.
- Connection commands intentionally emit no events for self-connections, duplicate active connections, and missing disconnections so invalid or redundant persistent events are not appended.
- Graph projection should derive lanes after replay from the surviving nodes so removals and malformed events cannot leave stale lanes behind.
- Connection lifecycle queries should use normalized `nodeId:<id>` tags for node lookups
- The domain-to-renderer adapter should be the boundary that adds UI dimensions and converts numeric domain lanes to `lane-N` renderer ids.
- Legacy snapshot import should derive domain lane numbers from each node's `lane-N` id; standalone legacy lanes intentionally do not produce events.
