import { describe, expect, it } from "vitest"
import { emptyEntry, entryFor, parseCollection, serializeCollection, toggleFlag } from "./store"

describe("toggleFlag", () => {
  it("adds a marked row for unknown forms", () => {
    expect(toggleFlag([], "pikachu", "owned")).toEqual([{ formId: "pikachu", owned: true, shiny: false, wanted: false }])
  })
  it("flips flags and drops fully-empty rows", () => {
    const one = toggleFlag([], "pikachu", "owned")
    const two = toggleFlag(one, "pikachu", "shiny")
    expect(two).toEqual([{ formId: "pikachu", owned: true, shiny: true, wanted: false }])
    expect(toggleFlag(toggleFlag(two, "pikachu", "owned"), "pikachu", "shiny")).toEqual([])
  })
})

describe("entryFor", () => {
  it("returns an empty entry for unmarked forms", () => {
    expect(entryFor([], "x")).toEqual(emptyEntry("x"))
  })
})

describe("round-trip", () => {
  it("serializes and parses back", () => {
    const entries = toggleFlag(toggleFlag([], "a", "wanted"), "b", "shiny")
    expect(parseCollection(serializeCollection(entries))).toEqual(entries)
  })
  it("rejects corrupt payloads", () => {
    expect(parseCollection("nope")).toEqual([])
    expect(parseCollection(JSON.stringify({ v: 999 }))).toEqual([])
    expect(parseCollection(null)).toEqual([])
  })
})
