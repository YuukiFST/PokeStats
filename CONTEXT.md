# CONTEXT

Ubiquitous language for PokeStats. Terms here are canonical: code, UI strings, data files and
issue tickets all use these spellings and these meanings. When a term below conflicts with how
Smogon, Bulbapedia or Cobblemon uses it, the divergence is stated explicitly.

## Identity

- **Species** — a Pokémon species, identified by National Dex number. `Charizard` is one Species.
  A Species has a name, a dex number and one or more Forms. It has *no* stats of its own.
- **Form** — a concrete stat-bearing variant of a Species: `Charizard`, `Charizard-Mega-X`,
  `Charizard-Gmax`. Every Form has exactly one BaseStatSpread, one or two Types and its own
  Abilities. **All ranking, comparison and type analysis operates on Forms, not Species.**
  This is the distinction PokeStats V1 collapsed: it had 1,399 rows keyed only by name, with no
  Species concept, so `Charizard-Mega-X` ranked as if it were a separate creature with no way to
  group it back under `Charizard`.
- **Form Id** — the canonical identifier of a Form: its name lowercased, stripped of accents and
  of every non-alphanumeric character. `Charizard-Mega-X` is `charizardmegax`, `Farfetch'd` is
  `farfetchd`, `Flabébé` is `flabebe`. Names for the same Form differ across sources in apostrophe
  style, accent, separator and alias; the Form Id is what makes them one Form. It is never
  displayed — the UI shows the name. A Species is identified by its National Dex number, and every
  Form of a Species carries that same number, which is what groups Forms back under their Species.
- **Base Form** — the Form a Species has with no item, no mega stone, no regional variation and no
  battle-only transformation. Exactly one per Species, and the two counts agree mechanically:
  1,025 Species, 1,025 Forms that carry no forme suffix.
- **Form Trait** — a property that makes a Form filterable: `mega`, `gmax`, `primal`, `regional`,
  `battle-only`. A Form carries a **set** of Form Traits, and that set may be empty — an ordinary
  alternate Form like `Rotom-Wash` or `Deoxys-Attack` has no Trait at all, and that is its correct
  description, not a gap. The set exists because Traits genuinely overlap: `Darmanitan-Galar-Zen`
  is both `regional` and `battle-only`, and a single-valued classifier would have to pick one and
  silently hide the Form from the other filter. Filters like "megas off" test membership in this
  set, never string matching on the name. `base` is not a Trait — it is the absence of a forme
  suffix, and it is spelled `isBaseForm`.
- **Redundant Form** — a Form that repeats its parent Form's BaseStatSpread, Types **and**
  Abilities and owns no Set in any (Dex Generation, Format). Redundant Forms are cut from the
  Dataset and survive only as sprite variants of the parent, which is why a purely cosmetic
  variant never reaches a dex row.
  The rule is mechanical, applies transitively — cutting a Form cuts the Forms derived from it —
  and has exactly one exception: `gmax`, which is stat-identical to its parent by design yet owns
  10 Sets of its own. It cuts 31 Forms, leaving 1,325.
- **CAP** — Create-A-Pokémon, fan-designed Pokémon published on Smogon's dex (`Syclar`,
  `Necturna`, `Volkraken`, ~27 others). They are **not Pokémon** and exist in no game or mod.
  PokeStats excludes them from the dataset entirely. V1 shipped them and its rankings were wrong.

## Stats

- **Base Stat** — one of the six per-Form constants: HP, Atk, Def, SpA, SpD, Spe. Never varies by
  level, nature, IV or EV. The only stat kind PokeStats stores.
- **BST (Base Stat Total)** — the **sum** of the six Base Stats. Not the average. `Total` in V1's
  data file is this sum (`data/api_client.py:74-78`). Ranking by sum and by average are identical
  orderings; PokeStats displays the sum because that is the universal convention.
- **EV / IV / Nature / Level** — inputs that produce a Pokémon's *actual* in-battle stat.
  PokeStats stores them **only as fields of a Set** (see below). PokeStats has no stat calculator
  and computes no level-scaled stats.

## Types

- **Type** — one of the 18 elemental types. The Type Chart is Gen 6+ (Fairy present).
- **Defensive Profile** — for a Form, how much damage each of the 18 attacking Types deals to it,
  accounting for both of its Types. Yields Weaknesses (>1x), Resistances (0<x<1) and
  Immunities (0x). This is all V1 had.
- **Offensive Coverage** — the inverse: given a set of attacking Types, which Forms they hit
  super-effectively and which they cannot touch. New in V2; the Team Builder is built on it.

## Competitive data

Two independent axes. Conflating them is the most likely modelling error in this project.

- **Dex Generation** — which mainline generation's data a page describes, and the Smogon dex path
  segment for it. Ten exist: `rb`, `gs`, `rs`, `dp`, `bw`, `xy`, `sm`, `ss`, `sv`, and `champions`.
  A Form's Base Stats **do** differ between Dex Generations — Gengar has SpD 130 in `rb` and 75 in
  `gs`, Alakazam 135 then 85 then 95 — because Gen 1 had a single Special stat and Gen 6 rebalanced
  several species. V1 read only `sv`.
  The Dataset resolves this as **one Canonical Table plus Overrides**, not as a table keyed by
  (Form, Dex Generation): the Canonical Table is keyed by Form alone and holds the `sv` values plus
  the Legends: Z-A Megas, because Cobbleverse runs a Gen 9 engine and every ranking, comparison and
  Defensive Profile in PokeStats has to agree with the player's game. The historical values live in
  a separate Override table keyed by (Form, Dex Generation) — 173 rows for Base Stats and 29 for
  Types across `rb`..`sv` — and surface only inside a Set belonging to that Dex Generation.
  **Abilities are not versioned**: a Set already names its own Ability when one applies.
- **Format** — a competitive ruleset within one Dex Generation: OU, UU, RU, NU, PU, Ubers, LC,
  Monotype, Doubles OU, VGC. A Form has a different Set in each Format it is played in.
- **Tier** — the Format a Form is *assigned to* by Smogon's usage-based classification, shown as a
  label on the dex page (`OU`, `PUBL`, `UUBL`). Tier is a property of a Form within a Dex
  Generation; Format is the ruleset a Set belongs to. They share vocabulary and are not the same
  field.
- **Set** — a published competitive build for one Form, in one Format, in one Dex Generation:
  a name (`Dragon Dance`), up to 4 Moves (with alternatives), an Item, an Ability, a Nature, an
  EV spread and optionally IVs and a Tera Type. The user calls these "builds"; the canonical
  term is **Set**, matching Smogon.
- **Showdown Export** — a Set rendered as the plain-text block Pokémon Showdown and the mainline
  games accept for import. One-click copy from any Set.

## Application

- **Team** — a user-assembled collection of up to 6 Forms, persisted locally. Its analysis is a
  Defensive Profile aggregated across members plus the team's Offensive Coverage.
- **Dataset** — the frozen, versioned data artifact compiled at build time and embedded in the
  executable. The application never performs network I/O; the scraper that produces the Dataset
  is a separate build-time tool that is never shipped to users.
