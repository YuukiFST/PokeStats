import { describe, expect, it } from "vitest"
import { makeForm, makeSet } from "./domain/testFixtures"
import { buildShowdownExport, parseShowdownTeam } from "./showdown"
import type { LoadedDataset } from "./dataset/load"

const BULK = makeForm({ id: "bulkworm", name: "Bulkworm", types: ["Electric", "Water"] })
const SPIN = makeForm({ id: "spinner", name: "Spinner", types: ["Normal"] })
const OU_SET = makeSet({
  formId: "bulkworm",
  moves: [["Hydro Pump"], ["Thunderbolt"]],
  item: "Leftovers",
  ability: "Levitate",
  evs: { hp: 252 },
  nature: "Modest",
  dexGen: "sv",
  formatId: "gen9ou",
  name: "Standard",
})
const UU_SET = makeSet({
  formId: "bulkworm",
  moves: [["Thunderbolt"]],
  item: "Choice Specs",
  dexGen: "sv",
  formatId: "gen9uu",
  name: "Specs",
})

const data = {
  formsById: new Map([
    ["bulkworm", BULK],
    ["spinner", SPIN],
  ]),
  setsByFormId: new Map([
    ["bulkworm", [OU_SET, UU_SET]],
    ["spinner", []],
  ]),
  core: { forms: [BULK, SPIN] },
} as unknown as LoadedDataset

describe("buildShowdownExport", () => {
  it("exports the referenced set instead of the best-ranked one", () => {
    const out = buildShowdownExport(
      {
        id: "t",
        name: "T",
        slots: [{ formId: "bulkworm", setKey: { dexGen: "sv", formatId: "gen9uu", name: "Specs" } }, null, null, null, null, null],
        createdWithDatasetVersion: "x",
      },
      data,
    )
    expect(out).toContain("Bulkworm @ Choice Specs")
    expect(out).not.toContain("Leftovers")
  })
  it("falls back to the best set for reference-less slots", () => {
    const out = buildShowdownExport(
      {
        id: "t",
        name: "T",
        slots: [{ formId: "bulkworm" }, { formId: "spinner" }, null, null, null, null],
        createdWithDatasetVersion: "x",
      },
      data,
    )
    expect(out).toContain("Bulkworm @ Leftovers")
    expect(out).toContain("Ability: Levitate")
    expect(out).toContain("Spinner")
  })
})

describe("parseShowdownTeam", () => {
  it("matches species, nicknames and items back to slots", () => {
    const parsed = parseShowdownTeam(
      `=== T ===\n\nBulkworm @ Leftovers\nAbility: Levitate\n\nSparky (Spinner)\n- Tackle\n\nMissingno @ Focus Sash\n`,
      data,
    )
    expect(parsed.name).toBe("T")
    expect(parsed.slots[0]).toEqual({ formId: "bulkworm", setKey: { dexGen: "sv", formatId: "gen9ou", name: "Standard" } })
    expect(parsed.slots[1]).toEqual({ formId: "spinner" })
    expect(parsed.warnings).toEqual(["Missingno"])
  })
})
