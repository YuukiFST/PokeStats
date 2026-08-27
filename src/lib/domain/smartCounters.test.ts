import { describe, expect, it } from "vitest"
import { buildSmartCounterIndex, representativeSet, suggestSmartCounters } from "./smartCounters"
import { BULKWORM, BULKWORM_SET, FRAILBIRD, GOLDEN_MOVES, NATURES, OPP, OPP_SET, makeForm } from "./testFixtures"
import type { Form, Set } from "./types"

function index(): ReturnType<typeof buildSmartCounterIndex> {
  return buildSmartCounterIndex(
    [OPP, FRAILBIRD, BULKWORM] as Form[],
    [OPP_SET, BULKWORM_SET] as Set[],
    new Map(Object.entries(GOLDEN_MOVES)),
    new Map(Object.entries(NATURES)),
  )
}

describe("representativeSet", () => {
  it("prefers OU-family Formats, then name", () => {
    const uu = { dexGen: "sv", formatId: "gen9uu", name: "B", formId: "x", moves: [] } as Set
    const ou = { dexGen: "sv", formatId: "gen9ou", name: "A", formId: "x", moves: [] } as Set
    expect(representativeSet([uu, ou])).toBe(ou)
    const a = { dexGen: "sv", formatId: "gen9ou", name: "A", formId: "x", moves: [] } as Set
    const b = { dexGen: "sv", formatId: "gen9ou", name: "B", formId: "x", moves: [] } as Set
    expect(representativeSet([b, a])).toBe(a)
  })
})

describe("suggestSmartCounters (golden: frail bird must not top a Ground+Rock coverage opponent)", () => {
  it("ranks the bulky Levitate Set carrier above the frail no-Set bird — opposite of v1", () => {
    const result = suggestSmartCounters(OPP, index(), [FRAILBIRD, BULKWORM, OPP], new Set(["sandlord"]))
    expect(result.map((r) => r.form.id)).toEqual(["bulkworm", "frailbird"])
    // baseline 0.02575 + walls 1.25 + 3hko 0.25 + OHKO back 1.5 + meta 0.12 + bulk 0.54 + offense 0.4038
    expect(result[0]!.score).toBeCloseTo(4.0896, 4)
    expect(result[0]!.noSets).toBe(false)
    // baseline 2.27375 + walls 1.25 - Rock OHKO 1.5 + bulk 0.36 + offense 0.3269 = 2.7107;
    // frailty gate x0.5 -> 1.3553; no-Sets cap x0.6 -> 0.8132
    expect(result[1]!.score).toBeCloseTo(0.8132, 4)
    expect(result[1]!.noSets).toBe(true)
  })

  it("displays highest-BST candidates first even with a lower Smart score", () => {
    // BST 600, neutral type math vs Ground -> mediocre score, but leads the window
    const bigmon = makeForm({
      id: "bigmon",
      types: ["Normal"],
      baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    })
    const forms = [bigmon, FRAILBIRD, BULKWORM, OPP] as Form[]
    const idx = buildSmartCounterIndex(forms, [OPP_SET, BULKWORM_SET] as Set[], new Map(Object.entries(GOLDEN_MOVES)), new Map(Object.entries(NATURES)))
    const result = suggestSmartCounters(OPP, idx, forms, new Set(["sandlord"]))
    expect(result[0]!.form.id).toBe("bigmon")
    expect(result.map((r) => r.form.id)).toEqual(["bigmon", "bulkworm", "frailbird"])
  })

  it("rotates the BST-ordered pool by offset", () => {
    const forms = [FRAILBIRD, BULKWORM, OPP]
    const exclude = new Set(["sandlord"])
    expect(suggestSmartCounters(OPP, index(), forms, exclude, { limit: 1 })[0]!.form.id).toBe("bulkworm")
    expect(suggestSmartCounters(OPP, index(), forms, exclude, { limit: 1, offset: 1 })[0]!.form.id).toBe("frailbird")
  })

  it("reasons: bulkworm walls Ground and carries Water; frailbird flagged frail to Rock", () => {
    const result = suggestSmartCounters(OPP, index(), [FRAILBIRD, BULKWORM, OPP], new Set(["sandlord"]))
    expect(result[0]!.reasons).toContainEqual({ kind: "walls", type: "Ground" })
    expect(result[0]!.reasons).toContainEqual({ kind: "carries", type: "Water" })
    expect(result[1]!.reasons).toContainEqual({ kind: "walls", type: "Ground" })
    expect(result[1]!.reasons).toContainEqual({ kind: "frail", type: "Rock" })
  })

  it("caps the meta signal: 12 Sets beat 1 Set by the saturated 0.48, not log-scaled more", () => {
    const manySets = Array.from({ length: 12 }, (_, i) => ({
      ...BULKWORM_SET,
      name: `S${String(i).padStart(2, "0")}`,
      formId: "manysets",
    }))
    const manyForm = { ...BULKWORM, id: "manysets" }
    const forms = [OPP, BULKWORM, manyForm] as Form[]
    const sets = [OPP_SET, BULKWORM_SET, ...manySets] as Set[]
    const idx = buildSmartCounterIndex(forms, sets, new Map(Object.entries(GOLDEN_MOVES)), new Map(Object.entries(NATURES)))
    const result = suggestSmartCounters(OPP, idx, forms, new Set(["sandlord"]))
    const byId = new Map(result.map((r) => [r.form.id, r.score]))
    expect(byId.get("manysets")! - byId.get("bulkworm")!).toBeCloseTo(0.48, 6) // 0.6 x (1 - 1/5), saturated
  })

  it("Tier quality: the same Form in OU outranks its PU clone by TIER_WEIGHT x (1 - 0.25)", () => {
    const ou = { ...BULKWORM, id: "ouworm", tier: "OU" }
    const pu = { ...BULKWORM, id: "puworm", tier: "PU" }
    const forms = [OPP, ou, pu] as Form[]
    const sets = [OPP_SET, { ...BULKWORM_SET, formId: "ouworm" }, { ...BULKWORM_SET, formId: "puworm" }] as Set[]
    const idx = buildSmartCounterIndex(forms, sets, new Map(Object.entries(GOLDEN_MOVES)), new Map(Object.entries(NATURES)))
    const result = suggestSmartCounters(OPP, idx, forms, new Set(["sandlord"]))
    const byId = new Map(result.map((r) => [r.form.id, r.score]))
    expect(byId.get("ouworm")! - byId.get("puworm")!).toBeCloseTo(0.3, 6)
  })
})
