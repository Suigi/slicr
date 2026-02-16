import { ExternalTokenizer } from "@lezer/lr"
import { LabelContent } from "./slicr.parser.terms.js"

export const labelContent = new ExternalTokenizer(input => {
  let start = input.pos
  while (input.next != -1 && input.next != 93) { // 93 is ']'
    input.advance()
  }
  if (input.pos > start) {
    input.acceptToken(LabelContent)
  }
})
