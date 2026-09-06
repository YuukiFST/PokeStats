import { describe, expect, it } from "vitest"
import { makeForm } from "./testFixtures"
import { battleMatrix, safeSwitchins, suggestLeads, threatRanking } from "./battle"

// Fire beats Grass, Water beats Fire, Grass beats Water.
const CHAR = makeForm({ id: "char", name: "Char", types: ["Fire"] })
const BLAST = makeForm({ id: "blast", name: "Blast", types: ["Water"] })
const VENUS = makeForm({ id: "venus", name: "Venus", types: ["Grass", "Poison"] })

describe("battleMatrix", () => {
  it("scores every member against every opponent", () => {
    const m = battleMatrix([CHAR, BLAST], [VENUS])
    expect(m.cells.length).toBe(2)
    expect(m.cells[0]![0]!.verdict).toBe("good") // Fire -> Grass 2x
    expect(m.cells[1]![0]!.bestStabMult).toBe(0.5) // Water -> Grass/Poison
  })
})

describe("suggestLeads", () => {
  it("ranks the pressuring member first", () => {
    const leads = suggestLeads(battleMatrix([BLAST, CHAR], [VENUS]))
    expect(leads[0]!.formId).toBe("char")
    expect(leads[0]!.pressures).toEqual(["venus"])
  })
})

describe("threatRanking", () => {
  it("ranks the opponent threatening most members first", () => {
    // Venus (Grass STAB) threatens Blast (Water); Char resists Grass.
    const rank = threatRanking(battleMatrix([CHAR, BLAST], [VENUS, CHAR]))
    expect(rank[0]!.formId).toBe("venus")
    expect(rank[0]!.threatenedCount).toBe(1)
  })
})

describe("degenerate inputs", () => {
  it("returns empty results without crashing", () => {
    expect(battleMatrix([], []).cells).toEqual([])
    expect(suggestLeads(battleMatrix([], []))).toEqual([])
    expect(threatRanking(battleMatrix([], []))).toEqual([])
    expect(safeSwitchins([], VENUS)).toEqual([])
  })
})

describe("safeSwitchins", () => {
  it("keeps only members avoiding 2x+, best pressure first", () => {
    const opts = safeSwitchins([CHAR, BLAST, VENUS], VENUS)
    // Char: Fire resists Grass (0.5), Poison neutral -> safe. Blast: Water weak to Grass -> out.
    expect(opts.map((o) => o.formId)).toContain("char")
    expect(opts.map((o) => o.formId)).not.toContain("blast")
  })
})
