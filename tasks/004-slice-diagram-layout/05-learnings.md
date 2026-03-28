# Slice Diagram Layout Learnings

- Reusing `buildElkLaneMeta` keeps slice lane semantics in one place while the layout engine changes underneath.
- Parsed slice boundaries already resolve to the node that precedes `---`, so group derivation should split after that key rather than re-parsing separator lines.
- `layout-lib` slice results start at `x = 0`, so the translation layer must normalize the left edge back to the renderer's existing 50px padding to avoid shifting the whole diagram contract.
- When swapping slice layout engines, keep contract tests and exact-geometry harness baselines separate: contract-level consumers can stay correct while snapshot-style geometry tests legitimately need a follow-up rebaseline task.
- For slice diagrams, the intended async contract is "measure first, then layout". Height-sensitive regression tests should pass explicit measured `nodeDimensions` rather than assuming the async engine will reconstruct content-based heights on its own.
- Harness tests that lock in measured async slice geometry should supply only the node sizes that materially affect the case; leaving unrelated cases unmeasured avoids hiding genuine routing drift behind incidental harness setup.
- The slice render hook is the contract seam for async edge geometry: pass `engineLayout.precomputedEdges` through there for settled slice layouts, and keep manual edge-point overrides as the final layer on top.
