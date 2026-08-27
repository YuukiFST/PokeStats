import { describe, expect, it } from "vitest"
import { bestSwapTargets, suggestCounters, suggestImprovementPlan, typeMathCounterScore } from "./recommend"
import { BULKWORM, FRAILBIRD, OPP, makeForm } from "./testFixtures"
import type { BaseStatSpread } from "./types"

function uniformStats(v: number): BaseStatSpread {
  return { hp: v, atk: v, def: v, spa: v, spd: v, spe: v }
}

describe("suggestCounters (v1 type math — scores unchanged, display windowed BST-first)", () => {
  it("scores stay pure type math; the window leads with the highest BST", () => {
    const result = suggestCounters(["Ground"], [FRAILBIRD, BULKWORM, OPP], new Set(["sandlord"]))
    expect(result.map((r) => r.form.id)).toEqual(["bulkworm", "frailbird"])
    // immune +2.5, Water SE +2, BST 475/10000
    expect(result[0]!.score).toBeCloseTo(0.0515, 6)
    // 2x Ground-weak (-1 -1), Water SE +2, BST 515/10000
    expect(result[1]!.score).toBeCloseTo(4.5475, 6)
  })

  it("typeMathCounterScore exposes the same inner score", () => {
    expect(typeMathCounterScore(FRAILBIRD, ["Ground"]).score).toBeCloseTo(4.5475, 6)
    expect(typeMathCounterScore(FRAILBIRD, ["Ground"]).reasons).toEqual([
      { kind: "immune", type: "Ground" },
      { kind: "cover", type: "Water" },
    ])
  })

  it("rotates the BST-ordered pool by offset", () => {
    const forms = [FRAILBIRD, BULKWORM, OPP]
    const exclude = new Set(["sandlord"])
    expect(suggestCounters(["Ground"], forms, exclude, { limit: 1 })[0]!.form.id).toBe("bulkworm")
    expect(suggestCounters(["Ground"], forms, exclude, { limit: 1, offset: 1 })[0]!.form.id).toBe("frailbird")
    // wraps back around after the last window
    expect(suggestCounters(["Ground"], forms, exclude, { limit: 1, offset: 2 })[0]!.form.id).toBe("bulkworm")
  })

  it("pinned counters render first and are not duplicated by the pool", () => {
    const result = suggestCounters(["Ground"], [FRAILBIRD, BULKWORM, OPP], new Set(["sandlord"]), {
      pinnedIds: new Set(["frailbird"]),
    })
    expect(result.map((r) => r.form.id)).toEqual(["frailbird", "bulkworm"])
    // stale pins (Form no longer a candidate) are ignored
    const stale = suggestCounters(["Ground"], [FRAILBIRD, BULKWORM, OPP], new Set(["sandlord", "frailbird"]), {
      pinnedIds: new Set(["frailbird"]),
    })
    expect(stale.map((r) => r.form.id)).toEqual(["bulkworm"])
  })
})

describe("bestSwapTargets", () => {
  const rainmaker = makeForm({ id: "rainmaker", types: ["Water"] })

  it("replaces the redundant weaker twin, keeping the stronger duplicate", () => {
    const weakTwin = makeForm({ id: "fire-a", types: ["Fire"], baseStats: uniformStats(50) })
    const strongTwin = makeForm({
      id: "fire-b",
      types: ["Fire"],
      baseStats: { hp: 100, atk: 100, def: 75, spa: 75, spd: 75, spe: 75 },
    })
    const targets = bestSwapTargets([weakTwin, strongTwin], [rainmaker])
    expect(targets.get("rainmaker")!.memberId).toBe("fire-a")
    expect(targets.get("rainmaker")!.delta).toBeGreaterThan(0)
  })

  it("breaks ties toward the lowest slot index", () => {
    const ember1 = makeForm({ id: "ember-1", types: ["Fire"] })
    const ember2 = makeForm({ id: "ember-2", types: ["Fire"] })
    expect(bestSwapTargets([ember1, ember2], [rainmaker]).get("rainmaker")!.memberId).toBe("ember-1")
  })

  it("returns an empty map for empty rosters or candidates", () => {
    const fire = makeForm({ id: "fire-a", types: ["Fire"] })
    expect(bestSwapTargets([], [fire]).size).toBe(0)
    expect(bestSwapTargets([fire], []).size).toBe(0)
  })

  it("skips protected slots and falls back to the next-best member", () => {
    const weakTwin = makeForm({ id: "fire-a", types: ["Fire"], baseStats: uniformStats(50) })
    const strongTwin = makeForm({
      id: "fire-b",
      types: ["Fire"],
      baseStats: { hp: 100, atk: 100, def: 75, spa: 75, spd: 75, spe: 75 },
    })
    const targets = bestSwapTargets([weakTwin, strongTwin], [rainmaker], { protectedIds: new Set(["fire-a"]) })
    expect(targets.get("rainmaker")!.memberId).toBe("fire-b")
  })

  it("returns no targets when every member is protected", () => {
    const ember1 = makeForm({ id: "ember-1", types: ["Fire"] })
    const ember2 = makeForm({ id: "ember-2", types: ["Fire"] })
    const allLocked = bestSwapTargets([ember1, ember2], [rainmaker], {
      protectedIds: new Set(["ember-1", "ember-2"]),
    })
    expect(allLocked.size).toBe(0)
  })
})

describe("suggestImprovementPlan", () => {
  // Three interchangeable Fires; the pool offers two Waters that patch the shared holes.
  const fireA = makeForm({ id: "fire-a", types: ["Fire"] })
  const fireB = makeForm({ id: "fire-b", types: ["Fire"] })
  const fireKeeper = makeForm({ id: "fire-keeper", types: ["Fire"] })
  const tideA = makeForm({ id: "tide-a", types: ["Water"] })
  const tideB = makeForm({ id: "tide-b", types: ["Water"] })

  it("removes two unprotected members and refills from the pool, honoring locks", () => {
    const plan = suggestImprovementPlan([fireA, fireB, fireKeeper], [tideA, tideB], {
      protectedIds: new Set(["fire-keeper"]),
    })
    expect(plan).not.toBeNull()
    expect(plan!.removeIds).toEqual(["fire-a", "fire-b"])
    // greedy refill picks the lowest-id twin first on equal scores
    expect(plan!.addIds).toEqual(["tide-a", "tide-b"])
    expect(plan!.delta).toBeGreaterThan(0)
  })

  it("never removes a protected member", () => {
    const plan = suggestImprovementPlan([fireA, fireB, fireKeeper], [tideA, tideB], {
      protectedIds: new Set(["fire-b"]),
    })
    expect(plan).not.toBeNull()
    expect(plan!.removeIds).not.toContain("fire-b")
  })

  it("returns null when everyone is protected or the pool is empty", () => {
    const allLocked = suggestImprovementPlan([fireA, fireB, fireKeeper], [tideA, tideB], {
      protectedIds: new Set(["fire-a", "fire-b", "fire-keeper"]),
    })
    expect(allLocked).toBeNull()
    expect(suggestImprovementPlan([fireA, fireB, fireKeeper], [], { protectedIds: new Set(["fire-keeper"]) })).toBeNull()
  })
})
