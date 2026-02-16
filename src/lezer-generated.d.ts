declare module '*.parser.js' {
  import type { LRParser } from '@lezer/lr';

  export const parser: LRParser;
}

declare module '*.parser.terms.js' {
  export const SliceStatement: number;
  export const NodeStatement: number;
  export const DataStatement: number;
}
