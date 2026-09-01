import { describe, expect, it } from "vitest"
import { speciesForms } from "./evolution"
import { makeForm } from "./testFixtures"
import type { Species } from "./types"

const BASE = makeForm({
  id: "abomasnow",
  speciesId: 460,
  name: "Abomasnow",
  isBaseForm: true,
  types: ["Grass", "Ice"],
})
const MEGA = makeForm({
  id: "abomasnowmega",
  speciesId: 460,
  name: "Abomasnow-Mega",
  isBaseForm: false,
  traits: ["mega"],
  types: ["Grass", "Ice"],
})
const SPECIES: Species = { id: 460, name: "Abomasnow", formIds: ["abomasnow", "abomasnowmega"] }
const formsById = new Map([
  [BASE.id, BASE],
  [MEGA.id, MEGA],
])
const speciesById = new Map([[460, SPECIES]])

describe("speciesForms", () => {
  it("lists the Mega and omits the Base Form, whether the open Form is Mega or Base", () => {
    expect(speciesForms("abomasnowmega", formsById, speciesById).map((f) => f.id)).toEqual(["abomasnowmega"])
    expect(speciesForms("abomasnow", formsById, speciesById).map((f) => f.id)).toEqual(["abomasnowmega"])
  })

  it("returns [] for an unknown Form", () => {
    expect(speciesForms("missingno", formsById, speciesById)).toEqual([])
  })

  it("returns [] when the Species has only a Base Form", () => {
    const solo = makeForm({ id: "snover", speciesId: 459, name: "Snover", types: ["Grass", "Ice"] })
    expect(
      speciesForms(
        "snover",
        new Map([[solo.id, solo]]),
        new Map([[459, { id: 459, name: "Snover", formIds: ["snover"] }]]),
      ),
    ).toEqual([])
  })
})
