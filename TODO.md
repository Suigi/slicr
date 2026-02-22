## NEXT UP

[ ] Broken data flow
  [X] Evaluate if top-level keys exist in previous nodes
  [ ] Mark fields as [supplied]
      or treat all data keys as supplied
[ ] inherit data somehow?
  [X] Map data from predecessor nodes via simple key names
[ ] "Query" nodes (for reading, similar to how commands are for writing)
[ ] zoom/pan
  [X] pan with left mouse button
  [ ] zoom (somehow)
[ ] documentation tab
[ ] generate code stubs from model
[ ] select multiple nodes
[ ] autocomplete for node names without node type
    [ ] if there's a node evt:concert-scheduled, I want `conc` to autocomplete to evt:concert-scheduled
    [ ] if there's also a node rm:concerts-scheduled, I want `conc` to offer both nodes for autocompletion
[ ] fix edges detaching from nodes when edge was manually edited and the height of the node then changes (e.g. because data was added or removed)
[ ] allow concise flow generation by creating nodes referenced with -> forward arrows
    e.g. `a -> b` creates both nodes `a` and `b` and connects them
    decide, which node gets the data and maps properties in that case (currently it's a)
      a -> b -> c
        data:
          key: value
[ ] Add manual geometry editing of nodes and edges to the DSL text
[ ] Move the Slice header to the right of the first slice divider (if present)
[ ] Fix mobile view
[ ] Add named UI lanes
[ ] Add Event Modeling given-when-thens (GWTs)
[ ] Add data backtracking from `maps`/`uses` to the original `data`
  [ ] Do it across slices
[ ] Better autocomplete / live snippet support for adding nodes that have been added to other slices before
[ ] Offer visualization of how a particular node is used across slices

## DONE

[X] Expand button
[X] Aliases
[X] stream lanes (events in swimlanes)
