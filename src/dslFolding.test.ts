// @vitest-environment jsdom

import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { foldable } from '@codemirror/language';
import { describe, expect, it } from 'vitest';
import { slicr } from './slicrLanguage';

describe('DSL folding', () => {
  it('identifies foldable ranges for indented data blocks', () => {
    const doc = `evt:room-opened
  data:
    room-number: 101
    capacity: 2
cmd:next-command`;
    
    const state = EditorState.create({
      doc,
      extensions: [slicr()]
    });

    // Check folding at "  data:" line (line 2, index 16 to 23 approx)
    // "evt:room-opened\n" is length 16.
    // Line 2 starts at 16.
    const foldRange = foldable(state, 16, 23);
    expect(foldRange).not.toBeNull();
    // The range should cover from end of line 2 to end of line 4.
    // Line 2: "  data:\n" -> ends at 16 + 8 = 24
    // Line 3: "    room-number: 101\n" -> length 21
    // Line 4: "    capacity: 2\n" -> length 16
    // Total doc length: 16 + 8 + 21 + 16 + 16 = 77
    // next-command starts at 16+8+21+16 = 61
    expect(foldRange?.from).toBe(state.doc.line(2).to);
    expect(foldRange?.to).toBe(state.doc.line(4).to);
  });

  it('identifies foldable ranges for JsonObject', () => {
    const doc = `evt:room-opened
  data: {
    "room": 101
  }`;
    
    const state = EditorState.create({
      doc,
      extensions: [slicr()]
    });

    // Line 2: "  data: {\n"
    // JsonObject starts at "{" which is at position 16 + 8 = 24
    const foldRange = foldable(state, 24, 25);
    expect(foldRange).not.toBeNull();
    expect(foldRange?.from).toBeGreaterThan(24);
    // expect(foldRange?.to).toBe(state.doc.line(4).to - 1); // inside "}"
  });
});
