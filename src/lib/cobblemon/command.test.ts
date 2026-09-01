import { describe, expect, it } from "vitest"
import type { Form, Set, Species } from "@/lib/domain/types"
import { buildPokemonEditCommand, cobblemonFormFlags, cobblemonSlug, cobblemonSnake, defaultCommandIvs, formSuffix } from "./command"

const slakingSpecies: Species = { id: 289, name: "Slaking", formIds: ["slaking"] }
const slaking: Form = {
  id: "slaking",
  speciesId: 289,
  name: "Slaking",
  isBaseForm: true,
  traits: [],
  baseStats: { hp: 150, atk: 160, def: 100, spa: 95, spd: 65, spe: 100 },
  types: ["Normal"],
  abilities: { slot0: "Truant" },
  tier: "ZU",
}

const charizardSpecies: Species = { id: 6, name: "Charizard", formIds: ["charizard", "charizardmegax", "charizardgmax"] }
const charizardMegaX: Form = {
  id: "charizardmegax",
  speciesId: 6,
  name: "Charizard-Mega-X",
  isBaseForm: false,
  traits: ["mega"],
  baseStats: { hp: 78, atk: 130, def: 111, spa: 130, spd: 85, spe: 100 },
  types: ["Fire", "Dragon"],
  abilities: { slot0: "Tough Claws" },
  tier: "UUBL",
}
const charizardGmax: Form = { ...charizardMegaX, id: "charizardgmax", name: "Charizard-Gmax", traits: ["gmax"] }

const band: Set = {
  formId: "slaking",
  dexGen: "sv",
  formatId: "ou",
  name: "Choice Band",
  ability: "Truant",
  nature: "Adamant",
  item: "Choice Band",
  level: 50,
  teraType: "Ghost",
  evs: { hp: 4, atk: 252, spe: 252 },
  ivs: { spa: 0 },
  moves: [["Earthquake"], ["Giga Impact"], ["U-turn"], ["Fire Punch"]],
}

const mixed: Set = {
  ...band,
  item: "Eject Pack",
  itemOptions: ["Eject Pack", "Heavy-Duty Boots"],
  moves: [["Earthquake"], ["Giga Impact", "Knock Off"], ["U-turn"], ["Fire Punch"]],
}

describe("cobblemon ids", () => {
  it("snakes items and species, slugs abilities and moves", () => {
    expect(cobblemonSnake("Mr. Mime")).toBe("mr_mime")
    expect(cobblemonSnake("Choice Specs")).toBe("choice_specs")
    expect(cobblemonSnake("Never-Melt Ice")).toBe("never_melt_ice")
    expect(cobblemonSlug("Rough Skin")).toBe("roughskin")
    expect(cobblemonSlug("U-turn")).toBe("uturn")
  })
})

describe("form flags", () => {
  it("omits flags on the base form", () => {
    expect(formSuffix(slaking, slakingSpecies)).toBeNull()
    expect(cobblemonFormFlags(slaking, slakingSpecies)).toEqual([])
  })

  it("maps mega-x and gmax suffixes", () => {
    expect(formSuffix(charizardMegaX, charizardSpecies)).toBe("megax")
    expect(cobblemonFormFlags(charizardMegaX, charizardSpecies)).toEqual(["aspect=mega-x"])
    expect(cobblemonFormFlags(charizardGmax, charizardSpecies)).toEqual(["gmax_factor=true"])
  })
})

describe("defaultCommandIvs", () => {
  it("sets 31 only on 252 EV stats and keeps listed IVs, omitting the rest", () => {
    expect(defaultCommandIvs(band)).toEqual({ atk: 31, spe: 31, spa: 0 })
  })

  it("does not invent 0 IVs for leftover EV crumbs", () => {
    expect(defaultCommandIvs({ ...band, ivs: undefined })).toEqual({ atk: 31, spe: 31 })
  })
})

describe("buildPokemonEditCommand", () => {
  it("builds a party-slot edit from a competitive set", () => {
    expect(buildPokemonEditCommand({ slot: 1, species: slakingSpecies, form: slaking, set: band })).toBe(
      "/pokemonedit 1 slaking level=50 ability=truant nature=adamant helditem=cobblemon:choice_band moves=earthquake,gigaimpact,uturn,firepunch hp_ev=4 attack_ev=252 speed_ev=252 attack_iv=31 special_attack_iv=0 speed_iv=31 tera_type=ghost",
    )
  })

  it("uses the picked item and move alternatives", () => {
    const cmd = buildPokemonEditCommand({
      slot: 1,
      species: slakingSpecies,
      form: slaking,
      set: mixed,
      item: "Heavy-Duty Boots",
      moves: ["Earthquake", "Knock Off", "U-turn", "Fire Punch"],
    })
    expect(cmd).toContain("helditem=cobblemon:heavy_duty_boots")
    expect(cmd).toContain("moves=earthquake,knockoff,uturn,firepunch")
  })

  it("omits IVs the user left empty", () => {
    const cmd = buildPokemonEditCommand({
      slot: 1,
      species: slakingSpecies,
      form: slaking,
      set: band,
      ivs: { atk: 31 },
    })
    expect(cmd).toContain("attack_iv=31")
    expect(cmd).not.toContain("speed_iv=")
    expect(cmd).not.toContain("special_attack_iv=")
  })

  it("clamps slot to 1..6", () => {
    expect(buildPokemonEditCommand({ slot: 0, species: slakingSpecies, form: slaking, set: band }).startsWith("/pokemonedit 1 ")).toBe(true)
    expect(buildPokemonEditCommand({ slot: 9, species: slakingSpecies, form: slaking, set: band }).startsWith("/pokemonedit 6 ")).toBe(true)
  })
})
