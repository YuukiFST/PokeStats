import { describe, expect, it } from "vitest"
import { makeForm, makeSet } from "./testFixtures"
import { rankFormSets, resolveSlotSet, setLabel, validateTeam } from "./teamSets"
import type { TeamSlot } from "./types"

const OU = makeSet({ formId: "f", moves: [["Tackle"]], dexGen: "sv", formatId: "gen9ou", name: "Standard" })
const UU = makeSet({ formId: "f", moves: [["Tackle"]], dexGen: "sv", formatId: "gen9uu", name: "Standard" })
const OLD = makeSet({ formId: "f", moves: [["Tackle"]], dexGen: "ss", formatId: "gen8ou", name: "Standard" })

describe("rankFormSets", () => {
  it("prefers latest gen, then OU family, then name", () => {
    expect(rankFormSets([UU, OLD, OU]).map((s) => s.formatId)).toEqual(["gen9ou", "gen9uu", "gen8ou"])
  })
})

describe("resolveSlotSet", () => {
  it("returns the referenced set when it exists", () => {
    const slot: TeamSlot = { formId: "f", setKey: { dexGen: "sv", formatId: "gen9uu", name: "Standard" } }
    expect(resolveSlotSet(slot, [OU, UU])).toBe(UU)
  })
  it("falls back to the best set when the reference is stale", () => {
    const slot: TeamSlot = { formId: "f", setKey: { dexGen: "rb", formatId: "gen1ou", name: "Gone" } }
    expect(resolveSlotSet(slot, [UU, OU])).toBe(OU)
  })
  it("falls back to the best set when the slot has no reference (old saves)", () => {
    expect(resolveSlotSet({ formId: "f" }, [UU, OU])).toBe(OU)
  })
  it("returns null without sets", () => {
    expect(resolveSlotSet({ formId: "f" }, [])).toBeNull()
  })
})

describe("setLabel", () => {
  it("names the set and its origin", () => {
    expect(setLabel(OU)).toBe("Standard · sv/gen9ou")
  })
})

describe("validateTeam", () => {
  const spinner = makeForm({ id: "spinner", types: ["Normal"] })
  const sweeper = makeForm({ id: "sweeper", types: ["Fire"] })
  const megaA = makeForm({ id: "megaa", types: ["Steel"], traits: ["mega"] })
  const megaB = makeForm({ id: "megab", types: ["Dragon"], traits: ["mega"] })

  it("flags duplicate items case-insensitively", () => {
    const v = validateTeam([
      { form: spinner, set: makeSet({ formId: "spinner", moves: [["Rapid Spin"]], item: "Leftovers" }) },
      { form: sweeper, set: makeSet({ formId: "sweeper", moves: [["Tailwind"]], item: "leftovers" }) },
    ])
    expect(v.duplicateItems).toEqual(["Leftovers"])
    expect(v.missingHazardRemoval).toBe(false)
    expect(v.missingSpeedControl).toBe(false)
    expect(v.multiMega).toBe(false)
  })
  it("flags two megas and missing support moves", () => {
    const v = validateTeam([
      { form: megaA, set: makeSet({ formId: "megaa", moves: [["Tackle"]] }) },
      { form: megaB, set: makeSet({ formId: "megab", moves: [["Tackle"]] }) },
    ])
    expect(v.multiMega).toBe(true)
    expect(v.missingHazardRemoval).toBe(true)
    expect(v.missingSpeedControl).toBe(true)
  })
  it("validates clean on empty teams and set-less members", () => {
    expect(validateTeam([])).toEqual({
      duplicateItems: [],
      multiMega: false,
      missingHazardRemoval: false,
      missingSpeedControl: false,
    })
    const v = validateTeam([{ form: spinner, set: null }])
    expect(v.duplicateItems).toEqual([])
  })
})
