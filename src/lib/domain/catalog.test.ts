import { describe, expect, it } from "vitest"
import { itemIdForName, itemKindFromShowdown, setsUsingItem } from "./items"
import { natureAt, natureCellStats, natureFactor, NATURES } from "./natures"
import { matchupBands, offensiveBands } from "./typeChart"

describe("itemKindFromShowdown", () => {
  it("classifies leftovers as utility", () => {
    expect(itemKindFromShowdown({ name: "Leftovers" })).toBe("utility")
  })
  it("classifies Choice Band by name prefix", () => {
    expect(itemKindFromShowdown({ name: "Choice Band" })).toBe("choice")
  })
  it("classifies Sitrus Berry by isBerry", () => {
    expect(itemKindFromShowdown({ name: "Sitrus Berry", isBerry: true })).toBe("berry")
  })
  it("classifies Charizardite X as mega", () => {
    expect(itemKindFromShowdown({ name: "Charizardite X", megaStone: { Charizard: "Charizard-Mega-X" } })).toBe("mega")
  })
  it("classifies Normalium Z as zcrystal before mega-like fields", () => {
    expect(itemKindFromShowdown({ name: "Normalium Z", zMoveType: "Normal" })).toBe("zcrystal")
  })
  it("classifies Absolite Z by trailing Z even with megaStone", () => {
    expect(itemKindFromShowdown({ name: "Absolite Z", megaStone: { Absol: "Absol-Mega-Z" } })).toBe("zcrystal")
  })
  it("classifies Flame Plate by onPlate", () => {
    expect(itemKindFromShowdown({ name: "Flame Plate", onPlate: "Fire" })).toBe("plate")
  })
})

describe("itemIdForName", () => {
  it("strips hyphens like Showdown toID", () => {
    expect(itemIdForName("Heavy-Duty Boots")).toBe("heavydutyboots")
  })
})

describe("setsUsingItem", () => {
  it("matches primary and option slots", () => {
    const sets = [
      { formId: "a", dexGen: "sv" as const, formatId: "gen9ou", name: "A", moves: [], item: "Leftovers" },
      { formId: "b", dexGen: "sv" as const, formatId: "gen9ou", name: "B", moves: [], itemOptions: ["Choice Band", "Leftovers"] },
      { formId: "c", dexGen: "sv" as const, formatId: "gen9ou", name: "C", moves: [], item: "Life Orb" },
    ]
    expect(setsUsingItem(sets, "Leftovers").map((s) => s.name)).toEqual(["A", "B"])
  })
})

describe("natureAt", () => {
  it("resolves Timid as +Spe −Atk", () => {
    expect(natureAt("spe", "atk")?.name).toBe("Timid")
  })
  it("resolves Hardy on the Atk diagonal", () => {
    expect(natureAt("atk", "atk")?.name).toBe("Hardy")
  })
  it("round-trips every named nature through the grid", () => {
    for (const n of NATURES) {
      const cell = natureCellStats(n)
      expect(cell).not.toBeNull()
      expect(natureAt(cell!.plus, cell!.minus)?.name).toBe(n.name)
    }
  })
})

describe("natureFactor", () => {
  it("Timid is +Spe −Atk", () => {
    const timid = NATURES.find((n) => n.name === "Timid")!
    expect(natureFactor(timid, "spe")).toBe(1.1)
    expect(natureFactor(timid, "atk")).toBe(0.9)
    expect(natureFactor(timid, "spa")).toBe(1)
    expect(natureFactor(timid, "hp")).toBe(1)
  })
  it("Hardy is 1.0 on every stat", () => {
    const hardy = NATURES.find((n) => n.name === "Hardy")!
    for (const stat of ["hp", "atk", "def", "spa", "spd", "spe"] as const) {
      expect(natureFactor(hardy, stat)).toBe(1)
    }
  })
})

describe("matchupBands", () => {
  it("Fire/Flying: Ground 0, Rock 4, Electric 2, Water 2", () => {
    const bands = matchupBands(["Fire", "Flying"])
    const byMult = Object.fromEntries(bands.map((b) => [String(b.mult), b.types]))
    expect(byMult["0"]).toContain("Ground")
    expect(byMult["4"]).toEqual(["Rock"])
    expect(byMult["2"]).toEqual(expect.arrayContaining(["Electric", "Water"]))
  })
})

describe("offensiveBands", () => {
  it("Fire is super-effective vs Grass and Steel, immune to none", () => {
    const bands = offensiveBands("Fire")
    expect(bands.find((b) => b.mult === 2)?.types).toEqual(expect.arrayContaining(["Grass", "Steel", "Bug", "Ice"]))
    expect(bands.find((b) => b.mult === 0)).toBeUndefined()
  })
})
