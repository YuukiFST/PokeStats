import { describe, expect, it } from "vitest"
import { estimateBattleState, estimateDamage } from "./damage"
import { makeForm, makeMove, makeSet, NATURES } from "./testFixtures"

const resolveNature = (name: string | undefined) => (name ? (NATURES[name] ?? null) : null)
const plainForm = () => makeForm({ id: "plain", types: ["Normal"] })

describe("estimateBattleState", () => {
  it("no Set: level 100, 31 IVs, 0 EVs, neutral nature", () => {
    const s = estimateBattleState(plainForm(), undefined, resolveNature)
    expect(s.level).toBe(100)
    expect(s.stats.hp).toBe(341)
    expect(s.stats.atk).toBe(236)
    expect(s.ability).toBe("Pressure")
  })

  it("applies Set EVs, IVs and nature", () => {
    const set = makeSet({
      formId: "plain",
      moves: [[]],
      evs: { hp: 252, atk: 252 },
      ivs: { atk: 0 },
      nature: "Adamant",
    })
    const s = estimateBattleState(plainForm(), set, resolveNature)
    expect(s.stats.hp).toBe(404)
    // atk: 2*100 + 0 IV + 63 EV + 5 = 268, Adamant x1.1
    expect(s.stats.atk).toBe(294)
    // spa: 236 base, Adamant x0.9
    expect(s.stats.spa).toBe(212)
  })

  it("honors Set level", () => {
    const set = makeSet({ formId: "plain", moves: [[]], level: 50 })
    const s = estimateBattleState(plainForm(), set, resolveNature)
    expect(s.level).toBe(50)
    expect(s.stats.hp).toBe(175)
  })

  it("preserves 1-HP bases (Shedinja rule)", () => {
    const shed = makeForm({ id: "shed", types: ["Bug"], baseStats: { hp: 1, atk: 90, def: 45, spa: 30, spd: 30, spe: 40 } })
    const s = estimateBattleState(shed, undefined, resolveNature)
    expect(s.stats.hp).toBe(1)
  })
})

describe("estimateDamage", () => {
  const attacker = (over: object) =>
    estimateBattleState(
      makeForm({ id: "atk", types: ["Fire"], ...over }),
      makeSet({ formId: "atk", moves: [[]], evs: { atk: 252, spa: 252 } }),
      resolveNature,
    )
  const defender = (over: object) => estimateBattleState(makeForm({ id: "def", types: ["Normal"], ...over }), undefined, resolveNature)
  const tackle = makeMove({ name: "Tackle", type: "Normal", category: "Physical", power: 80 })
  const flame = makeMove({ name: "Flamethrower", type: "Fire", category: "Special", power: 90 })
  const quake = makeMove({ name: "Earthquake", type: "Ground", category: "Physical", power: 100 })

  it("neutral physical hit, no STAB: 87 damage, chip", () => {
    // floor(floor(42*80*299/236)/50)+2 = 87
    const est = estimateDamage(tackle, attacker({}), defender({}))
    expect(est.damage).toBe(87)
    expect(est.ko).toBe("chip")
  })

  it("STAB: 130 damage, 3HKO", () => {
    const est = estimateDamage(tackle, attacker({ types: ["Normal"] }), defender({}))
    expect(est.damage).toBe(130)
    expect(est.ko).toBe("3hko")
  })

  it("super-effective STAB special: 290 damage, 2HKO", () => {
    // floor(floor(42*90*299/236)/50)+2 = 97; x1.5 STAB x2 SE = 290
    const est = estimateDamage(flame, attacker({}), defender({ types: ["Grass"] }))
    expect(est.damage).toBe(290)
    expect(est.ko).toBe("2hko")
  })

  it("defensive Ability immunity blanks the hit", () => {
    const flashFire = estimateBattleState(makeForm({ id: "ff", types: ["Normal"] }), undefined, resolveNature)
    flashFire.ability = "Flash Fire"
    expect(estimateDamage(flame, attacker({}), flashFire).ko).toBe("none")
    const levitate = estimateBattleState(makeForm({ id: "lv", types: ["Rock"] }), undefined, resolveNature)
    levitate.ability = "Levitate"
    expect(estimateDamage(quake, attacker({}), levitate).ko).toBe("none")
  })

  it("category-based defensive Abilities halve the matching side (Ice Scales)", () => {
    const scales = estimateBattleState(makeForm({ id: "is", types: ["Normal"] }), undefined, resolveNature)
    scales.ability = "Ice Scales"
    const est = estimateDamage(flame, attacker({}), scales)
    expect(est.damage).toBe(72) // floor(97 x 1.5 STAB) = 145, x 0.5 = 72
  })

  it("offensive Ability boosts apply (Huge Power, Adaptability)", () => {
    const huge = estimateDamage(tackle, attacker({ abilities: { slot0: "Huge Power" } }), defender({}))
    expect(huge.damage).toBe(174)
    const adapt = estimateDamage(tackle, attacker({ types: ["Normal"], abilities: { slot0: "Adaptability" } }), defender({}))
    expect(adapt.damage).toBe(174)
  })

  it("Dry Skin: Water immune, Fire 1.25x", () => {
    const dry = estimateBattleState(makeForm({ id: "dry", types: ["Normal"] }), undefined, resolveNature)
    dry.ability = "Dry Skin"
    expect(estimateDamage(makeMove({ name: "Surf", type: "Water", category: "Special", power: 90 }), attacker({}), dry).ko).toBe("none")
    expect(estimateDamage(flame, attacker({}), dry).damage).toBe(181) // floor(97 x 1.5 x 1.25)
  })

  it("Status Moves never damage", () => {
    const wisp = makeMove({ name: "Will-O-Wisp", type: "Fire", category: "Status", power: null })
    expect(estimateDamage(wisp, attacker({}), defender({})).ko).toBe("none")
  })
})
