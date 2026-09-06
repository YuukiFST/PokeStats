import { describe, expect, it } from "vitest"
import { calcHPStat, calcStat, damageRange, evTotal, finalStats } from "./calc"
import { makeForm, makeMove } from "./testFixtures"
import type { NatureInfo } from "./types"

const ADAMANT: NatureInfo = { name: "Adamant", plus: "atk", minus: "spa" }

describe("stat formula", () => {
  it("matches the standard formula (base 100, level 100, 31 IV, 252 EV)", () => {
    // HP: floor((200+31+63)*100/100)+100+10 = 404
    expect(calcHPStat(100, 31, 252, 100)).toBe(404)
    // Atk neutral: floor(294+5) = 299
    expect(calcStat(100, 31, 252, 100, 1)).toBe(299)
    // Atk Adamant: floor(299*1.1) = 328
    expect(calcStat(100, 31, 252, 100, 1.1)).toBe(328)
    // SpA Adamant minus: floor(299*0.9) = 269
    expect(calcStat(100, 31, 252, 100, 0.9)).toBe(269)
  })
  it("computes a full spread with per-stat clamping", () => {
    const stats = finalStats(
      { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
      { level: 50, nature: ADAMANT, evs: { atk: 999, spe: 252 }, ivs: {} },
    )
    // Level 50, 252 EV: floor((200+31+63)*50/100)+5 = 152; Adamant atk floor(152*1.1)=167
    expect(stats.atk).toBe(167)
    // HP with 0 EV: floor(231*50/100)+50+10 = 115+60 = 175
    expect(stats.hp).toBe(175)
  })
  it("sums EVs", () => {
    expect(evTotal({ atk: 252, spe: 252, hp: 6 })).toBe(510)
  })
})

describe("damageRange", () => {
  const attacker = makeForm({ id: "atk", types: ["Water"] })
  const defender = makeForm({ id: "def", types: ["Fire"] })
  const atkStats = { hp: 300, atk: 200, def: 150, spa: 250, spd: 150, spe: 200 }
  const defStats = { hp: 300, atk: 150, def: 200, spa: 150, spd: 200, spe: 150 }

  it("applies STAB and super-effectiveness", () => {
    const est = damageRange(
      makeMove({ name: "Hydro Pump", type: "Water", category: "Special", power: 110 }),
      { form: attacker, stats: atkStats, level: 100 },
      { form: defender, stats: defStats },
    )
    expect(est.stab).toBe(true)
    expect(est.effectiveness).toBe(2)
    expect(est.min).toBeLessThan(est.max!)
    // base = floor(floor(floor(84*110*1.25)/50)+2) = floor(231)+2... check exact:
    // floor((2*100/5+2)*110*(250/200)/50)+2 = floor(42*110*1.25/50)+2 = floor(115.5)+2 = 117
    // max = floor(117*3.0) = 351, min = floor(117*3.0*0.85) = 298
    expect(est.max).toBe(351)
    expect(est.min).toBe(298)
    // min roll 298 falls short of 300 HP: 15 of 16 rolls KO
    expect(est.koChance).toBe(15 / 16)
  })
  it("returns null damage for Status moves", () => {
    const est = damageRange(
      makeMove({ name: "Swords Dance", type: "Normal", category: "Status", power: null }),
      { form: attacker, stats: atkStats, level: 100 },
      { form: defender, stats: defStats },
    )
    expect(est.min).toBeNull()
    expect(est.koChance).toBeNull()
  })
  it("reports zero against immunities", () => {
    const ghost = makeForm({ id: "ghost", types: ["Ghost"] })
    const est = damageRange(
      makeMove({ name: "Tackle", type: "Normal", category: "Physical", power: 40 }),
      { form: makeForm({ id: "a", types: ["Normal"] }), stats: atkStats, level: 100 },
      { form: ghost, stats: defStats },
    )
    expect(est.effectiveness).toBe(0)
    expect(est.min).toBe(0)
    expect(est.max).toBe(0)
    expect(est.koChance).toBe(0)
  })
})
