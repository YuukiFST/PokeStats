import { describe, expect, it } from "vitest"
import { movesetProfile } from "./moveset"
import { makeMove } from "./testFixtures"
import type { MoveInfo, Set } from "./types"

const MOVES: Record<string, MoveInfo> = {
  Earthquake: makeMove({ name: "Earthquake", type: "Ground", category: "Physical", power: 100 }),
  "Stone Edge": makeMove({ name: "Stone Edge", type: "Rock", category: "Physical", power: 100 }),
  "Ice Beam": makeMove({ name: "Ice Beam", type: "Ice", category: "Special", power: 90 }),
  Thunderbolt: makeMove({ name: "Thunderbolt", type: "Electric", category: "Special", power: 90 }),
  "Swords Dance": makeMove({ name: "Swords Dance", type: "Normal", category: "Status", power: null }),
}

const set = (moves: string[][]): Set => ({ dexGen: "sv", formatId: "gen9ou", name: "S", formId: "x", moves })
const resolve = (name: string) => MOVES[name] ?? null

describe("movesetProfile", () => {
  it("weights each slot's primary above its alternatives and normalizes to 1.0", () => {
    const p = movesetProfile([set([["Earthquake"], ["Stone Edge", "Ice Beam"]])], resolve)
    expect(p.attackingSetCount).toBe(1)
    // slot primaries 1.0 + 1.0, alternative 0.4 -> total 2.4
    expect(p.typeWeights.get("Ground")).toBeCloseTo(1 / 2.4, 6)
    expect(p.typeWeights.get("Rock")).toBeCloseTo(1 / 2.4, 6)
    expect(p.typeWeights.get("Ice")).toBeCloseTo(0.4 / 2.4, 6)
    const sum = [...p.typeWeights.values()].reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 6)
  })

  it("averages the distribution across Sets", () => {
    const p = movesetProfile(
      [set([["Earthquake"], ["Stone Edge", "Ice Beam"]]), set([["Ice Beam"], ["Thunderbolt"]])],
      resolve,
    )
    expect(p.attackingSetCount).toBe(2)
    expect(p.typeWeights.get("Ice")).toBeCloseTo((0.4 / 2.4 + 1 / 2) / 2, 6)
    const sum = [...p.typeWeights.values()].reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 6)
  })

  it("ignores Status Moves and unknown Move names", () => {
    const p = movesetProfile([set([["Swords Dance"], ["Not A Move"]])], resolve)
    expect(p.attackingSetCount).toBe(0)
    expect(p.typeWeights.size).toBe(0)
    expect(p.attackMoves).toHaveLength(0)
  })

  it("dedupes attackMoves by name across Sets", () => {
    const p = movesetProfile([set([["Earthquake"]]), set([["Earthquake"], ["Ice Beam"]])], resolve)
    expect(p.attackMoves.map((m) => m.name).sort()).toEqual(["Earthquake", "Ice Beam"])
  })

  it("computes the physical share of the damaging weight; 0.5 when empty", () => {
    const p = movesetProfile([set([["Earthquake"], ["Stone Edge", "Ice Beam"]])], resolve)
    expect(p.physicalShare).toBeCloseTo(2 / 2.4, 6)
    const none = movesetProfile([set([["Swords Dance"]])], resolve)
    expect(none.physicalShare).toBe(0.5)
  })
})
