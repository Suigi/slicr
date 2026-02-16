import { LRLanguage, LanguageSupport, syntaxHighlighting, HighlightStyle } from "@codemirror/language"
import { styleTags, tags as t } from "@lezer/highlight"
import { parser } from "./slicr.parser.js"

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
  { tag: t.constant(t.variableName), class: "dsl-tok-evtName" }
])

export const slicrLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      styleTags({
        "slice": t.keyword,
        "data": t.keyword,
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
        "Identifier": t.variableName,
        "String": t.string,
        "Number": t.number,
        "DependsArrow": t.operator,
        "Colon Comma At": t.punctuation,
        "BracketL BracketR": t.bracket,
        "BraceL BraceR": t.bracket,
        "true false": t.bool,
        "null": t.null,
        "Property/String Property/Identifier": t.propertyName
      })
    ]
  }),
  languageData: {
    closeBrackets: { brackets: ["(", "[", "{", "'", '"'] },
    indentOnInput: /^\s*[}\]]$/
  }
})

export function slicr() {
  return [
    new LanguageSupport(slicrLanguage),
    syntaxHighlighting(slicrHighlightStyle)
  ]
}
