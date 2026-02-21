import {
  foldInside,
  foldNodeProp,
  foldService,
  HighlightStyle,
  LanguageSupport,
  LRLanguage,
  syntaxHighlighting,
  syntaxTree
} from "@codemirror/language"
import { autocompletion } from "@codemirror/autocomplete"
import {styleTags, tags as t} from "@lezer/highlight"
import {parser} from "./slicr.parser.js"
import { getDependencySuggestions } from "./domain/dslAutocomplete"

type CompletionContextLike = {
  state: { doc: { toString: () => string } }
  pos: number
  matchBefore: (pattern: RegExp) => { from: number; to: number; text: string } | null
}

function slicrCompletionSource(context: CompletionContextLike) {
  const doc = context.state.doc.toString()
  const suggestions = getDependencySuggestions(doc, context.pos)
  if (suggestions.length === 0) {
    return null
  }

  const token = context.matchBefore(/[\w:@#-]*/)
  const from = token ? token.from : context.pos
  return {
    from,
    options: suggestions.map((label) => ({
      label,
      type: completionTypeForLabel(label)
    }))
  }
}

function completionTypeForLabel(label: string) {
  const type = label.split(":", 1)[0]
  if (type === "evt" || type === "cmd" || type === "rm" || type === "ui" || type === "exc" || type === "aut" || type === "ext") {
    return type
  }
  return "variable"
}

export const slicrHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, class: "dsl-tok-keyword" },
  { tag: t.typeName, class: "dsl-tok-typeName" },
  { tag: t.variableName, class: "dsl-tok-variableName" },
  { tag: t.string, class: "dsl-tok-string" },
  { tag: t.number, class: "dsl-tok-number" },
  { tag: t.operator, class: "dsl-tok-operator" },
  { tag: t.punctuation, class: "dsl-tok-punctuation" },
  { tag: t.bracket, class: "dsl-tok-punctuation" },
  { tag: t.attributeName, class: "dsl-tok-attributeName" },
  { tag: t.bool, class: "dsl-tok-bool" },
  { tag: t.null, class: "dsl-tok-null" },
  { tag: t.propertyName, class: "dsl-tok-jsonKey" },

  // Specialized Types
  { tag: t.tagName, class: "dsl-tok-rmType" },
  { tag: t.modifier, class: "dsl-tok-uiType" },
  { tag: t.className, class: "dsl-tok-cmdType" },
  { tag: t.macroName, class: "dsl-tok-evtType" },
  { tag: t.invalid, class: "dsl-tok-excType" },
  { tag: t.labelName, class: "dsl-tok-autType" },
  { tag: t.namespace, class: "dsl-tok-extType" },

  // Specialized Names
  { tag: t.inserted, class: "dsl-tok-rmName" },
  { tag: t.changed, class: "dsl-tok-uiName" },
  { tag: t.function(t.variableName), class: "dsl-tok-cmdName" },
  { tag: t.constant(t.variableName), class: "dsl-tok-evtName" },
  { tag: t.special(t.variableName), class: "dsl-tok-autName" }
])

export const slicrLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      styleTags({
        "slice": t.keyword,
        "data": t.keyword,
        "maps": t.keyword,
        "stream": t.keyword,
        "rmType": t.tagName,
        "uiType": t.modifier,
        "cmdType": t.className,
        "evtType": t.macroName,
        "excType": t.invalid,
        "autType": t.labelName,
        "extType": t.namespace,
        "RmName/Identifier": t.inserted,
        "UiName/Identifier": t.changed,
        "CmdName/Identifier": t.function(t.variableName),
        "EvtName/Identifier": t.constant(t.variableName),
        "AutRef/Identifier": t.special(t.variableName),
        "Identifier": t.variableName,
        "String": t.string,
        "Number": t.number,
        "DependsArrow ForwardArrow": t.operator,
        "Colon Comma At": t.punctuation,
        "BracketL BracketR": t.bracket,
        "BraceL BraceR": t.bracket,
        "true false": t.bool,
        "null": t.null,
        "Property/String Property/Identifier": t.propertyName
      }),
      foldNodeProp.add({
        JsonObject: foldInside
      })
    ]
  }),
  languageData: {
    closeBrackets: { brackets: ["(", "[", "{", "'", '"'] },
    indentOnInput: /^\s*[}\]]$/,
    autocomplete: slicrCompletionSource
  }
})

export function slicr() {
  return [
    new LanguageSupport(slicrLanguage, [
      foldService.of((state, lineStart) => {
        const line = state.doc.lineAt(lineStart)
        const indent = line.text.match(/^\s*/)?.[0].length ?? 0
        
        // Prefer node-based folding if available
        const tree = syntaxTree(state)
        const node = tree.resolveInner(lineStart, 1)
        for (let cur: typeof node | null = node; cur; cur = cur.parent) {
          const prop = cur.type.prop(foldNodeProp)
          if (prop) {
            const range = prop(cur, state)
            if (range && range.from < range.to) return range
          }
        }

        let lastLine = line.number
        for (let i = line.number + 1; i <= state.doc.lines; i++) {
          const nextLine = state.doc.line(i)
          if (nextLine.text.trim().length === 0) {
            if (i === state.doc.lines) break
            continue
          }
          const nextIndent = nextLine.text.match(/^\s*/)?.[0].length ?? 0
          if (nextIndent <= indent) break
          lastLine = i
        }
        if (lastLine > line.number) {
          return { from: line.to, to: state.doc.line(lastLine).to }
        }
        return null
      })
    ]),
    syntaxHighlighting(slicrHighlightStyle),
    autocompletion({
      activateOnTyping: true,
      override: [slicrCompletionSource]
    })
  ]
}
