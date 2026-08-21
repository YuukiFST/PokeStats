# 19 — Fonte de stats e sprites das megas de Legends: Z-A

> **Verdict:** the best available source for ZA mega stats is the **`smogon/pokemon-showdown` main `data/pokedex.ts`** (all 45 present as `isNonstandard: "Future"`, byte-for-byte the same numbers the Cobbleverse addon ships), cross-checkable against the `zamega` jar itself and PokéAPI; **animated sprites exist for only 9 of the 49 forms** — 26 more have real but single-frame static GIFs and 14 have no Showdown sprite at all (PokéAPI HOME renders cover those), so the animated-sprite gap has to be a conscious decision in *Escopo do Dataset*.

Research date: 2026-08-21. Every claim below was verified by an HTTP request or by reading the artifact; commands are reproducible.

---

## 0. TL;DR — the three sources that matter

| Source | Covers | Stats | Types | Abilities | Sprites | Verdict |
|---|---|---|---|---|---|---|
| `smogon/pokemon-showdown` `data/pokedex.ts` (live at `play.pokemonshowdown.com/data/pokedex.json`) | **49/49 forms** | yes | yes | Showdown's canon (differs from addon on 16 forms) | n/a | **primary source** |
| `zamega-fabric-1.7.3.jar` → `data/cobblemon/species_additions/*` | **48/48 forms** (Meowstic not split by gender) | yes (identical to Showdown, 48/48 diffed) | yes | the addon's actual in-game abilities | 3D bedrock models only | **ground truth for the modpack** |
| PokéAPI (`/api/v2/pokemon/<slug>`) | **47/48 slugs** | yes | yes | partial (DLC ones empty) | **HOME 48/48, official artwork 46/48** | **best art fallback** |

**The count reconciles exactly, four ways:** Cobblemon base ships the 48 canonical megas; the `zamega` addon adds 45 more; 48 + 45 = **93** — the number ticket 01 measured in Cobbleverse 1.7.42, the number the addon's own store page claims ("45 Total, DLC Included"), and the number Bulbapedia gives for the game after the Mega Dimension DLC ("bringing the total up to 93"). Cobbleverse is at exact parity with the game, not adding fan content.

---

## 1. Which Pokémon get new Megas in Legends: Z-A?

**45 new Megas**, spread over 44 base species (Raichu gets two: Mega-X and Mega-Y). Counted as *form entries* it is **49**, because four of them are cosmetic duplicates that exist only because the base species has cosmetic forms: `Magearna-Original-Mega`, `Tatsugiri-Droopy-Mega`, `Tatsugiri-Stretchy-Mega`, and `Meowstic-F-Mega`.

Three independent artifacts agree on exactly this roster:

- `smogon/pokemon-showdown` `data/pokedex.ts` — 98 mega entries live at <https://play.pokemonshowdown.com/data/pokedex.json>; subtracting the 48 canonical Gen 6/7 megas and the one CAP mega (`Crucibelle-Mega`) leaves **49 form entries tagged `isNonstandard: "Future"`**, each with a `requiredItem` mega stone (`Chandelurite`, `Excadrite`, `Meganiumite`, …).
- `zamega-fabric-1.7.3.jar` — **44 files** under `data/cobblemon/species_additions/generation1..9/`, holding **49 mega form blocks** (plus one non-canonical `Floette-Ange` boss form). Downloaded from <https://cdn.modrinth.com/data/2V1Y86sc/versions/x5u68zHH/zamega-fabric-1.7.3.jar>.
- The addon's own Modrinth page states "**Mega Pokémon Included (45 Total, DLC Included)**" — <https://modrinth.com/mod/navas-zamega>.

**Cobblemon's base mod ships none of them.** `common/.../data/cobblemon/species/generation5/chandelure.json` has `"forms": []`, while `generation1/venusaur.json` has `["Mega","Gmax"]` — so the 48 canonical megas are in the mod and the 45 ZA ones come exclusively from the addon. Fetched from <https://gitlab.com/api/v4/projects/31496946/repository/files/common%2Fsrc%2Fmain%2Fresources%2Fdata%2Fcobblemon%2Fspecies%2Fgeneration5%2Fchandelure.json/raw?ref=main> and the `generation1/venusaur.json` equivalent.

### Base game vs. Mega Dimension DLC

**26 with the base game, 19 with the Mega Dimension DLC** (22 DLC rows counting form variations) = 45. Confirmed against the wikis, not inferred:

- "26 Mega Evolutions and their associated Mega Stones were introduced with Pokémon Legends: Z-A, bringing the total up to 74." — <https://bulbapedia.bulbagarden.net/wiki/Mega_Evolution>
- "19 Mega Evolutions (or 22, counting specific variations) and their associated Mega Stones were introduced with the DLC, bringing the total up to 93. Out of the 19 newly-introduced Mega Evolutions, two correspond to Raichu (Mega Raichu X and Mega Raichu Y) and three are Z Mega Evolutions for Absol, Garchomp, and Lucario." — <https://bulbapedia.bulbagarden.net/wiki/Mega_Dimension>
- Per-Pokémon split read directly off Serebii's two tables: <https://www.serebii.net/legendsz-a/megaevolutions.shtml> (base game) and <https://www.serebii.net/legendsz-a/dlc-megaevolutions.shtml> (DLC), corroborated by <https://game8.co/games/Pokemon-Legends-Z-A/archives/564071>.

**Bulbapedia's "total up to 93" is the same 93 ticket 01 measured in Cobbleverse.** The pack is not adding anything extra — it is at exact parity with the game as of the DLC.

**Mega Dimension DLC (19 Megas / 22 rows over 18 base species):** Raichu-X, Raichu-Y, Chimecho, Absol-Z, Staraptor, Garchomp-Z, Lucario-Z, Heatran, Darkrai, Golurk, Meowstic, Crabominable, Golisopod, Magearna (+ Original Color), Zeraora, Scovillain, Glimmora, Tatsugiri (+ Droopy, + Stretchy), Baxcalibur.

**Base game (26):** Barbaracle, Chandelure, Chesnaught, Clefable, Delphox, Dragalge, Dragonite, Drampa, Eelektross, Emboar, Excadrill, Falinks, Feraligatr, Floette, Froslass, Greninja, Hawlucha, Malamar, Meganium, Pyroar, Scolipede, Scrafty, Skarmory, Starmie, Victreebel, Zygarde.

Two counter-intuitive placements worth pinning, because a plausible-looking heuristic gets them wrong:

- **Zygarde is base game**, despite having no Showdown sprite and no Champions-dex entry.
- **Chimecho, Staraptor, Golurk, Meowstic, Crabominable, Scovillain, Glimmora and both Raichus are DLC**, despite having sprites and Champions tiers.

That kills the tempting shortcut of deriving the split from sprite/dex availability — it correlates but is wrong on 9 forms. The `Src` column below uses the wiki split, not the heuristic.

Note on counting conventions in press coverage: some outlets say "22 new Megas, total 96" (e.g. <https://www.pokebeach.com/2025/12/all-22-new-mega-evolutions-in-mega-dimension-revealed-what-to-expect-for-2026s-tcg-sets>). Same data — the +3 is Magearna Original Color and the two extra Tatsugiri forms.

The public source repo <https://github.com/yajatkaul/ZAMegas> is **not** a base/DLC signal either: its `species_additions` folder holds 12 files simply because the other 32 were deleted from the repo on 2026-08-05 (`gh api repos/yajatkaul/ZAMegas/commits` shows a run of "Delete …_mega.json" commits that day). The repo was created 2026-02-09, long after the game shipped.

### The full table

Base stats and types below come from `zamega-fabric-1.7.3.jar`. **All 48 comparable stat blocks were diffed against `pokemon-showdown` `data/pokedex.ts` and came back identical, 0 divergent.** Abilities are shown in both spellings because they *do* differ. Champions tier from Smogon's `dump-basics`. 26 base-game rows + 22 Mega Dimension rows = **48 form entries**, which is exactly the 48 rows of Serebii's table (45 Megas + Magearna Original Color + Tatsugiri Droopy + Tatsugiri Stretchy) — <https://www.serebii.net/legendsz-a/megaevolutions.shtml>. Showdown reports 49 only because it also splits Meowstic into `-M-` and `-F-`.

| Mega form (Showdown name) | Src | Types | HP | Atk | Def | SpA | SpD | Spe | BST | Cobblemon addon ability | Showdown ability | Champions tier |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| Barbaracle-Mega | base | Rock/Fighting | 72 | 140 | 130 | 64 | 106 | 88 | 600 | toughclaws | Tough Claws | UUBL |
| Chandelure-Mega | base | Ghost/Fire | 60 | 75 | 110 | 175 | 110 | 90 | 620 | infiltrator | Infiltrator | UU |
| Chesnaught-Mega | base | Grass/Fighting | 88 | 137 | 172 | 74 | 115 | 44 | 630 | bulletproof | Bulletproof | UU |
| Clefable-Mega | base | Fairy/Flying | 95 | 80 | 93 | 135 | 110 | 70 | 583 | magicbounce | Magic Bounce | OU |
| Delphox-Mega | base | Fire/Psychic | 75 | 69 | 72 | 159 | 125 | 134 | 634 | levitate | Levitate | OU |
| Dragalge-Mega | base | Poison/Dragon | 65 | 85 | 105 | 132 | 163 | 44 | 594 | regenerator | Regenerator | OU |
| Dragonite-Mega | base | Dragon/Flying | 91 | 124 | 115 | 145 | 125 | 100 | 700 | multiscale | Multiscale | OU |
| Drampa-Mega | base | Normal/Dragon | 78 | 85 | 110 | 160 | 116 | 36 | 585 | berserk | Berserk | UU |
| Eelektross-Mega | base | Electric | 85 | 145 | 80 | 135 | 90 | 80 | 615 | hadronengine | Eelevate | UU |
| Emboar-Mega | base | Fire/Fighting | 110 | 148 | 75 | 110 | 110 | 75 | 628 | moldbreaker | Mold Breaker | UU |
| Excadrill-Mega | base | Ground/Steel | 110 | 165 | 100 | 65 | 65 | 103 | 608 | piercingdrill | Piercing Drill | OU |
| Falinks-Mega | base | Fighting | 65 | 135 | 135 | 70 | 65 | 100 | 570 | dauntlessshield | Defiant | UU |
| Feraligatr-Mega | base | Water/Dragon | 85 | 160 | 125 | 89 | 93 | 78 | 630 | dragonize | Dragonize | UU |
| Floette-Mega | base | Fairy | 74 | 85 | 87 | 155 | 148 | 102 | 651 | fairyaura | Fairy Aura | OU |
| Froslass-Mega | base | Ice/Ghost | 70 | 80 | 70 | 140 | 100 | 120 | 580 | snowwarning | Snow Warning | UUBL |
| Greninja-Mega | base | Water/Dark | 72 | 125 | 77 | 133 | 81 | 142 | 630 | protean | Protean | UU |
| Hawlucha-Mega | base | Fighting/Flying | 78 | 137 | 100 | 74 | 93 | 118 | 600 | noguard | No Guard | UU |
| Malamar-Mega | base | Dark/Psychic | 86 | 102 | 88 | 98 | 120 | 88 | 582 | contrary | Contrary | UU |
| Meganium-Mega | base | Grass/Fairy | 80 | 92 | 115 | 143 | 115 | 80 | 625 | megasol | Mega Sol | OU |
| Pyroar-Mega | base | Fire/Normal | 86 | 88 | 92 | 129 | 86 | 126 | 607 | drought | Fire Mane | UU |
| Scolipede-Mega | base | Bug/Poison | 60 | 140 | 149 | 75 | 99 | 62 | 585 | tintedlens | Shell Armor | UU |
| Scrafty-Mega | base | Dark/Fighting | 65 | 130 | 135 | 55 | 135 | 68 | 588 | shedskin | Intimidate | UU |
| Skarmory-Mega | base | Steel/Flying | 65 | 140 | 110 | 40 | 100 | 110 | 565 | stalwart | Stalwart | UU |
| Starmie-Mega | base | Water/Psychic | 60 | 100 | 105 | 130 | 105 | 120 | 620 | hugepower | Huge Power | Uber |
| Victreebel-Mega | base | Grass/Poison | 80 | 125 | 85 | 135 | 95 | 70 | 590 | innardsout | Innards Out | UU |
| Zygarde-Mega | base | Dragon/Ground | 216 | 70 | 91 | 216 | 85 | 100 | 778 | aurabreak | Aura Break | — |
| Absol-Mega-Z | DLC | Dark/Ghost | 65 | 154 | 60 | 75 | 60 | 151 | 565 | technician | Magic Bounce | — |
| Baxcalibur-Mega | DLC | Dragon/Ice | 115 | 175 | 117 | 105 | 101 | 87 | 700 | thermalexchange | Thermal Exchange, Ice Body | — |
| Chimecho-Mega | DLC | Psychic/Steel | 75 | 50 | 110 | 135 | 120 | 65 | 555 | levitate | Levitate | UU |
| Crabominable-Mega | DLC | Fighting/Ice | 97 | 157 | 122 | 62 | 107 | 33 | 578 | ironfist | Iron Fist | UU |
| Darkrai-Mega | DLC | Dark | 70 | 120 | 130 | 165 | 130 | 85 | 700 | darkaura | Bad Dreams | — |
| Garchomp-Mega-Z | DLC | Dragon | 108 | 130 | 85 | 141 | 85 | 151 | 700 | roughskin | Sand Force | — |
| Glimmora-Mega | DLC | Rock/Poison | 83 | 90 | 105 | 150 | 96 | 101 | 625 | adaptability | Adaptability | OU |
| Golisopod-Mega | DLC | Bug/Steel | 75 | 150 | 175 | 70 | 120 | 40 | 630 | heatproof | Emergency Exit | — |
| Golurk-Mega | DLC | Ground/Ghost | 89 | 159 | 105 | 70 | 105 | 55 | 583 | unseenfist | Unseen Fist | UU |
| Heatran-Mega | DLC | Fire/Steel | 91 | 120 | 106 | 175 | 141 | 67 | 700 | filter | Flash Fire, Flame Body | — |
| Lucario-Mega-Z | DLC | Fighting/Steel | 70 | 100 | 70 | 164 | 70 | 151 | 625 | mindseye | Adaptability | — |
| Magearna-Mega | DLC | Steel/Fairy | 80 | 125 | 115 | 170 | 115 | 95 | 700 | soulheart | Soul-Heart | — |
| Magearna-Original-Mega | DLC | Steel/Fairy | 80 | 125 | 115 | 170 | 115 | 95 | 700 | soulheart | Soul-Heart | — |
| Meowstic-M-Mega | DLC | Psychic | 74 | 48 | 76 | 143 | 101 | 124 | 566 | trace | Trace | UU |
| Raichu-Mega-X | DLC | Electric | 60 | 135 | 95 | 90 | 95 | 110 | 585 | levitate | Electric Surge | UU |
| Raichu-Mega-Y | DLC | Electric | 60 | 100 | 55 | 160 | 80 | 130 | 585 | transistor | No Guard | OU |
| Scovillain-Mega | DLC | Grass/Fire | 65 | 138 | 85 | 138 | 85 | 75 | 586 | spicyspray | Spicy Spray | UU |
| Staraptor-Mega | DLC | Fighting/Flying | 85 | 140 | 100 | 60 | 90 | 110 | 585 | toughclaws | Contrary | OU |
| Tatsugiri-Curly-Mega | DLC | Dragon/Water | 68 | 65 | 90 | 135 | 125 | 92 | 575 | drizzle | Commander, Storm Drain | — |
| Tatsugiri-Droopy-Mega | DLC | Dragon/Water | 68 | 65 | 90 | 135 | 125 | 92 | 575 | drizzle | Commander, Storm Drain | — |
| Tatsugiri-Stretchy-Mega | DLC | Dragon/Water | 68 | 65 | 90 | 135 | 125 | 92 | 575 | drizzle | Commander, Storm Drain | — |
| Zeraora-Mega | DLC | Electric | 88 | 157 | 75 | 147 | 80 | 153 | 700 | — | Volt Absorb | — |

**Three special cases — the game-internal Z-A numbers differ from the National Dex numbers.** `pokemon-showdown` carries a dedicated Legends: Z-A mod at `data/mods/gen9legends/`, and its `pokedex.ts` is only 14 lines long, overriding exactly three species (<https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen9legends/pokedex.ts>):

| Form | Z-A in-game (gen9legends mod) | National Dex / Champions / the addon |
|---|---|---|
| Starmie-Mega | 60 / **140** / 105 / 130 / 105 / 120, no ability (BST 660) | 60 / **100** / 105 / 130 / 105 / 120 + Huge Power (BST 620) |
| Mawile-Mega | 50 / **147** / 125 / 55 / 95 / 50, no ability (BST 522) | 50 / **105** / 125 / 55 / 95 / 50 + Huge Power (BST 480) |
| Medicham-Mega | 60 / **140** / 85 / 80 / 85 / 100, no ability (BST 550) | 60 / **100** / 85 / 80 / 85 / 100 + Pure Power (BST 510) |

Bulbapedia confirms the mechanic: "In Pokémon Legends: Z-A only, Mega Mawile is one of three Pokémon, along with Mega Medicham and Mega Starmie, that receive more than 100 points in their base stat total upon Mega Evolving to account for their Abilities" — <https://bulbapedia.bulbagarden.net/wiki/Mawile_(Pok%C3%A9mon)>; the +42/+40/+40 Attack figures are confirmed at <https://rotomlabs.net/dex/legends-z-a/mawile/mega>, <https://rotomlabs.net/dex/legends-z-a/medicham/mega> and <https://rotomlabs.net/dex/legends-z-a/starmie/mega>. Legends: Z-A has no Abilities, so these three get the doubled Attack baked into the stat line instead. **Cobbleverse uses the right-hand column** — the jar ships `starmie` Mega at attack 100 with `hugepower`, and Mawile/Medicham are untouched canonical Cobblemon forms. For a Cobbleverse-facing tool the National Dex numbers are the correct ones; the `gen9legends` values would be wrong.

Note `Zygarde-Mega` at 216/70/91/216/85/100 (BST 778) — it mega-evolves from **Zygarde-Complete only**, not the 50% form: "Zygarde, exclusively in its Complete Forme, can Mega Evolve into Mega Zygarde using the Zygardite. Mega Zygarde has the highest base HP stat of all Mega-Evolved Pokémon, at 216. Mega Zygarde gains only 70 points." — <https://bulbapedia.bulbagarden.net/wiki/Zygarde_(Pok%C3%A9mon)>. The arithmetic checks out: Zygarde-Complete is 216/100/121/91/95/85 (BST 708), and 708 + 70 = 778. Showdown and the addon both model it off the plain `zygarde` entry, so a naive tool would let a 50% Zygarde mega-evolve; the addon changelog for 1.4.6 warns about exactly that bug. Confirmed identically in the jar (`generation6/zygarde_mega.json`), in `pokemon-showdown`, and in PokéAPI (<https://pokeapi.co/api/v2/pokemon/zygarde-mega>).


---

## 2. The ZA Megas addon itself

**Identity.** The addon is **"Navas ZA Megas"** by `yajatkaul`, jar name `zamega-<loader>-<version>.jar`.

- Modrinth: <https://modrinth.com/mod/navas-zamega> — 7,995,652 downloads, 62 versions, loaders `datapack`/`fabric`/`neoforge`, MC 1.21.1, license `LicenseRef-MEGA-SHOWDOWN-LICENSE-v2.1` pointing at <https://github.com/yajatkaul/CobblemonMegaShowdown/blob/main/LICENSE.md>. `source_url` on the Modrinth project is **null**.
- CurseForge: <https://www.curseforge.com/minecraft/mc-mods/navas-za-megas> — same author, 3.1M downloads, latest 1.7.6 (2026-08-15). (CurseForge's JSON API returns 403 to `curl`; the figures come from the rendered page.)
- Latest version is **1.7.6** (2026-08-15); Cobbleverse 1.7.42 pins **1.7.3**, whose file is `zamega-fabric-1.7.3.jar`, 2,387,420 bytes, at <https://cdn.modrinth.com/data/2V1Y86sc/versions/x5u68zHH/zamega-fabric-1.7.3.jar>.
- The Modrinth description notes the original authors abandoned it and handed it to the Mega Showdown moderators, and that since v1.4 it is **a mod, not a datapack**. It also says: "In the 1.5.2 Release they now all use the same abilities as the Legends ZA OU format on Pokemon Showdown." *That is only partly true in 1.7.3* — see the ability delta below.

**Related projects** (do not mix them, per the addon's own README):
- `zamegasearly` — "Z-A Megas Early", the pre-release datapack, 350,210 downloads, <https://modrinth.com/mod/zamegasearly>. Superseded; its content is integrated into `navas-zamega`.
- `project-lazuli-zamegas-compat-patch` — rebalance patch, source at <https://gitlab.com/cobblemonlazuli/CobblemonLazuli> (GitLab project id 59426113). **Changes the stats**, so it is not a source of truth for vanilla ZA numbers.
- `Mega Showdown: Extra Megas!` by RobinFloof — unrelated fan megas, <https://www.curseforge.com/minecraft/mc-mods/mega-showdown-extra-megas>.

### Does it publish `species_additions` openly?

**Partly — and this is the key caveat.** A public source repo exists at <https://github.com/yajatkaul/ZAMegas> (public, created 2026-02-09, default branch `main`, pushed 2026-08-15, license "Other"). But its `common/src/main/resources/data/cobblemon/species_additions/` holds **only 12 of the 44 files** — `absol_mega`, `darkrai_mega`, `garchomp_mega`, `heatran_mega`, `lucario_mega`, `zygarde_mega`, `golisopod_mega`, `magearna_mega`, `zeraora_mega`, `baxcalibur_mega`, `tatsugiri_mega`, plus the non-canonical `floette_ange`. Verified with `gh api repos/yajatkaul/ZAMegas/git/trees/main?recursive=1`.

That subset is **not** a base/DLC boundary — the other 32 were *deleted from the repo* in a run of "Delete …_mega.json" commits on 2026-08-05 (`gh api repos/yajatkaul/ZAMegas/commits`). They are still shipped in the jar; they just no longer have published source.

The repo also carries `data/cobblemon/dex_additions/mega_z.json` (a separate dex tab for the three Mega-Z forms) and 12 `dex_entry_additions/*.json`. So: to get all 45, you must open the jar. It is a plain zip; `zipfile.ZipFile('zamega.jar')` works with no unpacking step.

### Exact schema

Top-level keys observed across all 44 files: **`target`, `features`, `forms`, `implemented`**.
Form-object keys observed: **`abilities`, `aspects`, `baseScale`, `baseStats`, `battleOnly`, `behaviour`, `drops`, `dynamaxBlocked`, `evolutions`, `height`, `hitbox`, `labels`, `maleRatio`, `moves`, `name`, `pokedex`, `primaryType`, `secondaryType`, `weight`**.

Base-stat keys are British-spelled exactly as ticket 01 recorded: **`hp`, `attack`, `defence`, `special_attack`, `special_defence`, `speed`**.

`data/cobblemon/species_additions/generation5/chandelure_mega.json`, verbatim:

```json
{
  "target": "cobblemon:chandelure",
  "features": ["mega_evolution"],
  "forms": [
    {
      "name": "Mega",
      "pokedex": ["cobblemon.species.chandelure-mega.desc"],
      "abilities": ["infiltrator", "infiltrator", "h:infiltrator"],
      "labels": ["gen5", "mega"],
      "aspects": ["mega"],
      "battleOnly": true,
      "dynamaxBlocked": true,
      "baseStats": {
        "hp": 60,
        "attack": 75,
        "defence": 110,
        "special_attack": 175,
        "special_defence": 110,
        "speed": 90
      },
      "baseScale": 1.05,
      "hitbox": { "width": 1.5, "height": 3, "fixed": false },
      "height": 25,
      "weight": 696
    }
  ]
}
```

`data/cobblemon/species_additions/generation9/baxcalibur_mega.json`, verbatim (also readable openly at <https://github.com/yajatkaul/ZAMegas/blob/main/common/src/main/resources/data/cobblemon/species_additions/generation9/baxcalibur_mega.json>):

```json
{
  "target": "cobblemon:baxcalibur",
  "features": ["mega_evolution"],
  "forms": [
    {
      "name": "Mega",
      "pokedex": ["cobblemon.species.baxcalibur-mega.desc"],
      "abilities": ["thermalexchange", "h:thermalexchange"],
      "labels": ["gen9", "mega"],
      "aspects": ["mega"],
      "battleOnly": true,
      "dynamaxBlocked": true,
      "baseStats": {
        "hp": 115, "attack": 175, "defence": 117,
        "special_attack": 105, "special_defence": 101, "speed": 87
      },
      "baseScale": 1.1,
      "hitbox": { "width": 1.5, "height": 4, "fixed": false },
      "height": 21,
      "weight": 3150
    }
  ]
}
```

Schema notes worth carrying into the pipeline:

- `target` is a Cobblemon species id (`cobblemon:chandelure`), and the form is *merged into* that species — so a ZA mega is a **Form of an existing Species**, matching `CONTEXT.md`'s Species/Form split. There is no standalone species file.
- **`primaryType` / `secondaryType` are only present when the Mega changes typing.** 15 of 49 forms carry them; the other 34 inherit the base species' typing silently. A parser that reads only the addition file will produce untyped forms unless it merges against the Cobblemon base species.
- `abilities` is a 3-slot list with `h:` marking the hidden ability; ZA megas repeat the same ability in every slot.
- `battleOnly: true` and `aspects: ["mega"]` on every entry — these forms never exist outside battle, which is the right signal for a "Form" flag in the dataset.
- The jar carries **no 2D sprites**: `assets/cobblemon/bedrock` (375 entries) and `assets/zamega/models` (48) are Bedrock 3D models + textures. Lang files exist for `en_us`, `es_es`, `it_it`, `ko_kr`, `pt_br`.

### Ability delta — addon vs. Showdown

The stats match perfectly but the **abilities do not**, on 16 of 49 forms. Where Showdown invents a ZA-canon ability that Cobblemon cannot run, the addon substitutes an implementable one. Examples (addon → Showdown): Absol-Mega-Z `technician` → Magic Bounce; Garchomp-Mega-Z `roughskin` → Sand Force; Lucario-Mega-Z `mindseye` → Adaptability; Darkrai `darkaura` → Bad Dreams; Heatran `filter` → Flash Fire; Raichu-Mega-X `levitate` → Electric Surge; Raichu-Mega-Y `transistor` → No Guard; Pyroar `drought` → Fire Mane; Eelektross `hadronengine` → Eelevate; Staraptor `toughclaws` → Contrary; Scolipede `tintedlens` → Shell Armor; Scrafty `shedskin` → Intimidate; Falinks `dauntlessshield` → Defiant; Golisopod `heatproof` → Emergency Exit; Tatsugiri `drizzle` → Commander; Zeraora — **empty in the addon**. Several Showdown-invented abilities *are* kept verbatim (`piercingdrill`, `megasol`, `spicyspray`, `dragonize`).

**Consequence for the dataset:** take **base stats and types from Showdown** (or the jar, they are identical) but take **abilities from the jar** if the app is meant to describe what a Cobbleverse player actually gets.


---

## 3. Does `smogon/pokemon-showdown` carry these forms?

**Yes — completely, in the main dex, not in a mod.** This is the headline finding and it reverses the ticket's premise.

- `data/pokedex.ts` (compiled live at <https://play.pokemonshowdown.com/data/pokedex.json>, 1517 entries, 523,823 bytes) contains **98 mega entries**. 48 are canonical, 1 is CAP (`Crucibelle-Mega`), and **49 are the Legends: Z-A set**, each carrying `isNonstandard: "Future"`, a `changesFrom`/`baseSpecies` link, and a `requiredItem` mega stone.
- Diff run: all **48 comparable stat blocks between `zamega-fabric-1.7.3.jar` and `pokedex.json` are byte-identical — 0 divergent, 0 unmatched.** Types agree on every form that declares one.

`data/mods/` listing (via `gh api repos/smogon/pokemon-showdown/contents/data/mods`), relevant entries:

- **`data/mods/gen9legends/`** — the Legends: Z-A mod. `scripts.ts` is `{ gen: 9, inherit: 'gen9' }`; `pokedex.ts` is 417 bytes and overrides only `starmiemega`, `mawilemega`, `medichammega` (the ability-less stat lines from §1); `formats-data.ts` (46,205 bytes) flips `isNonstandard: null` on every Z-A-legal species, including all 48 canonical megas, the 2 primals, and the ZA set. **No ladder format references `mod: 'gen9legends'`** — a code search across the repo finds it only in `test/sim/data.js`, so it is data-complete but not playable.
- **`data/mods/champions/`** (8 files, incl. `formats-data.ts` 74,197 bytes, `abilities.ts`, `items.ts`, `moves.ts`) and **`data/mods/championsregma/`** — the *Pokémon Champions* mod, which is what actually ladders. `config/formats.ts` defines `[Gen 9 Champions] OU / UU / BSS Reg M-A / M-B / VGC 2026 Reg M-A / M-B / Random Battle / Draft / …`.
- `data/mods/gen8legends/` is Legends: Arceus, for contrast.
- Aliases in `data/aliases.ts` lines 18–24: `cou`/`champsou` → `[Gen 9 Champions] OU`, and the *bare* `vgc` and `bss` aliases now resolve to Champions formats.

There is **no `gen10` directory and no `za` directory**; Legends: Z-A is modelled as a Gen 9 sub-mod, and the ZA megas live in the shared Gen 9 dex marked `Future`.


---

## 4. Has Smogon opened a dex for it?

**`champions` is a real, live Smogon dex generation — but it is the *Pokémon Champions* game, not Legends: Z-A.** There is no Legends: Z-A dex.

All requests below sent with a browser `User-Agent`; **without one, `smogon.com/dex/*` returns 400 for every generation including `sv`**, which is a trap worth writing into the scraper.

| URL | HTTP | bytes |
|---|---:|---:|
| `https://www.smogon.com/dex/champions/pokemon/` | **200** | 339,688 |
| `https://www.smogon.com/dex/champions/pokemon/chandelure/` | **200** | 340,683 |
| `https://www.smogon.com/dex/sv/pokemon/` (control) | 200 | 841,515 |
| `https://www.smogon.com/dex/xy/pokemon/` (control) | 200 | 577,631 |
| `https://www.smogon.com/dex/za/pokemon/` | **404** | 1,958 |
| `https://www.smogon.com/dex/legendsza/pokemon/` | **404** | 1,958 |

`POST https://www.smogon.com/dex/_rpc/dump-gens` → 200, and the generation list now ends with Champions:

```json
[{"name":"Red/Blue","shorthand":"RB"}, … ,{"name":"Scarlet/Violet","shorthand":"SV"},{"name":"Champions","shorthand":"Champions"}]
```

`POST https://www.smogon.com/dex/_rpc/dump-basics` with `{"gen":"champions"}` → 200, 337,603 bytes, **323 Pokémon, 76 of them mega forms**. Of the 49 ZA mega forms, **35 have a Champions tier**; the 14 Mega Dimension DLC forms are absent from the Champions dex entirely.

Champions tiers for the 35 that are in (from that dump):

- **Uber:** Starmie-Mega
- **OU:** Clefable, Delphox, Dragalge, Dragonite, Excadrill, Floette, Glimmora, Meganium, Raichu-Mega-Y, Staraptor
- **UUBL:** Barbaracle, Froslass
- **UU:** Chandelure, Chesnaught, Chimecho, Crabominable, Drampa, Eelektross, Emboar, Falinks, Feraligatr, Golurk, Greninja, Hawlucha, Malamar, Meowstic-F, Meowstic-M, Pyroar, Raichu-Mega-X, Scolipede, Scovillain, Scrafty, Skarmory, Victreebel

Caveat: **the Champions dex applies the National-Dex stat line, not the Z-A in-game one** — its `Starmie-Mega` is 60/100/105/130/105/120 with Huge Power and `Mawile-Mega` is 50/105/125/55/95/50 with Huge Power. That is the same convention the Cobbleverse addon uses, so for this project the Champions dex is consistent, not conflicting.

**Practical takeaway:** the Champions dex is the only Smogon *web* surface carrying ZA megas, and it covers 35/49. For the full 49, use the Showdown repo, not the Smogon dex.


---

## 5. Sprites

**Partially. 35 of 49 forms have a GIF on Showdown, but only 9 are actually animated.** This is the finding that has real consequences for R4 ("sprites animados completos são preferidos a qualquer economia de bytes").

Naming, confirmed empirically — both schemes from ticket 02 hold, but **Showdown does *not* fully squash**: it is `<basespecies>-<squashedforme>`, i.e. `charizard-megax`, not `charizardmegax`. Every `charizardmegax.gif`-style URL 404s. Smogon hyphenates fully: `charizard-mega-x`.

| Host | Present | Missing |
|---|---:|---:|
| `play.pokemonshowdown.com/sprites/ani/` | **35 / 49** (9 animated, 26 single-frame static) | 14 |
| `www.smogon.com/dex/media/sprites/xy/` | **24 / 49** | 25 |

Concrete probes (`curl -s -o file -w '%{http_code} %{size_download}'`):

```
ani/charizard-megax.gif      200  113657   (canonical control)
ani/chandelure.gif           200    ~big   (base species control)
ani/dragonite-mega.gif       200  277455   146x121, 90 frames  -> ANIMATED
ani/froslass-mega.gif        200  229958    84x124, 100 frames -> ANIMATED
ani/skarmory-mega.gif        200  210100   156x109, 120 frames -> ANIMATED
ani/starmie-mega.gif         200  122951    79x95,  60 frames  -> ANIMATED
ani/chandelure-mega.gif      200    3124    90x89,   1 frame   -> STATIC
ani/excadrill-mega.gif       200    3253    90x73,   1 frame   -> STATIC
ani/raichu-megax.gif         200    3386    90x89,   1 frame   -> STATIC
ani/zygarde-mega.gif         404    (3803-byte 404 page)
ani/heatran-mega.gif         404
ani/baxcalibur-mega.gif      404
```

The 26 single-frame files are **genuine artwork, not placeholders** — `chandelure-mega.gif` renders a correct Mega Chandelure at 90×89. They are simply not animated yet. Distinguishing them programmatically is cheap: a real animated Showdown GIF has 60–120 Graphic Control Extension blocks; the statics have exactly 1. (Note Showdown returns a **200-status HTML 404 page of 3,803 bytes** for missing sprites in some paths — check the `GIF8` magic, not just the status code.)

**Fully animated (9):** Clefable (60 frames), Dragonite (90), Emboar (60), Feraligatr (65), Froslass (100), Meganium (80), Skarmory (120), Starmie (60), Victreebel (60). All 9 are base-game megas.

**No sprite at all (14):** Absol-Mega-Z, Garchomp-Mega-Z, Lucario-Mega-Z, Baxcalibur, Darkrai, Golisopod, Heatran, Magearna, Magearna-Original, Tatsugiri-Curly, Tatsugiri-Droopy, Tatsugiri-Stretchy, Zeraora, Zygarde.

These are *mostly* Mega Dimension DLC forms — 13 of 14 — but **not the DLC set**: Zygarde is base game, and 10 DLC forms (both Raichus, Chimecho, Staraptor, Golurk, Meowstic ×2, Crabominable, Scovillain, Glimmora) do have sprites. Sprite availability tracks how long Showdown's art team has had the design, not the game's content split.

**The Smogon `xy/` mirror lags Showdown.** It has 24/49 vs Showdown's 35, and it is *no longer byte-identical everywhere* — a correction to ticket 02's finding:

```
starmie-mega      IDENTICAL  md5 08fb8818…
chandelure-mega   IDENTICAL  md5 6c55f563…
clefable-mega     IDENTICAL  md5 957ef01d…
feraligatr-mega   DIFFERENT  ps=864f7740… (196619 B)  smogon=99d76db4… (196811 B)
```

Missing sprites also 404 differently: Smogon returns a 162-byte 404, Showdown a 3,803-byte one. **Recommendation: pull from `play.pokemonshowdown.com/sprites/ani/` as primary, not the Smogon mirror.**

There are **no `gen5/`, `dex/`, or `home/` Showdown fallbacks** for these forms — `sprites/gen5/chandelure-mega.png`, `sprites/dex/chandelure-mega.png` and `sprites/home/chandelure-mega.png` all 404.

### What art *does* exist for all of them

**PokéAPI has complete art coverage** (see §6): 48/48 HOME 3D renders, 46/48 official artwork, 47/48 static pixel sprites. For the 14 forms with no Showdown sprite, the HOME render is the only usable image. Example, Mega Chandelure (PokéAPI id 10291):

- pixel: <https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10291.png> — 200, 1,582 B
- official artwork: <https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10291.png> — 200, 34,408 B
- HOME: <https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/10291.png> — 200, 105,593 B

The `sprites.other.showdown` block in PokéAPI is **all `null`** for these forms, so PokéAPI is not a back-door to animated GIFs.

The `zamega` jar itself contains 3D Bedrock models and textures (`assets/cobblemon/bedrock`, 375 entries; `assets/zamega/models`, 48) — usable in-game, useless as 2D sprites without rendering them.

**Decision this forces on *Escopo do Dataset*:** either accept a mixed art story (9 animated + 26 static GIF + 14 HOME renders), or normalise everything to PokéAPI HOME renders for the ZA megas and keep animated GIFs only for the 1,686 Gen 1–9 forms ticket 02 already measured.


### Sprite availability, per form

| Mega form | PS `sprites/ani/` name | PS status | frames | bytes | Smogon `xy/` name | Smogon status |
|---|---|---|---:|---:|---|---|
| Raichu-Mega-X | `raichu-megax` | 200 | 1 (static) | 3386 | `raichu-mega-x` | 404 |
| Raichu-Mega-Y | `raichu-megay` | 200 | 1 (static) | 3421 | `raichu-mega-y` | 404 |
| Clefable-Mega | `clefable-mega` | 200 | 60 (animated) | 108039 | `clefable-mega` | 200 |
| Victreebel-Mega | `victreebel-mega` | 200 | 60 (animated) | 157666 | `victreebel-mega` | 200 |
| Starmie-Mega | `starmie-mega` | 200 | 60 (animated) | 122951 | `starmie-mega` | 200 |
| Dragonite-Mega | `dragonite-mega` | 200 | 90 (animated) | 277455 | `dragonite-mega` | 200 |
| Meganium-Mega | `meganium-mega` | 200 | 80 (animated) | 214761 | `meganium-mega` | 200 |
| Feraligatr-Mega | `feraligatr-mega` | 200 | 65 (animated) | 196619 | `feraligatr-mega` | 200 |
| Skarmory-Mega | `skarmory-mega` | 200 | 120 (animated) | 210100 | `skarmory-mega` | 200 |
| Chimecho-Mega | `chimecho-mega` | 200 | 1 (static) | 5282 | `chimecho-mega` | 200 |
| Absol-Mega-Z | `absol-megaz` | 404 | — | — | `absol-mega-z` | 404 |
| Staraptor-Mega | `staraptor-mega` | 200 | 1 (static) | 4135 | `staraptor-mega` | 404 |
| Garchomp-Mega-Z | `garchomp-megaz` | 404 | — | — | `garchomp-mega-z` | 404 |
| Lucario-Mega-Z | `lucario-megaz` | 404 | — | — | `lucario-mega-z` | 404 |
| Froslass-Mega | `froslass-mega` | 200 | 100 (animated) | 229958 | `froslass-mega` | 200 |
| Heatran-Mega | `heatran-mega` | 404 | — | — | `heatran-mega` | 404 |
| Darkrai-Mega | `darkrai-mega` | 404 | — | — | `darkrai-mega` | 404 |
| Emboar-Mega | `emboar-mega` | 200 | 60 (animated) | 251307 | `emboar-mega` | 200 |
| Excadrill-Mega | `excadrill-mega` | 200 | 1 (static) | 3253 | `excadrill-mega` | 200 |
| Scolipede-Mega | `scolipede-mega` | 200 | 1 (static) | 3677 | `scolipede-mega` | 404 |
| Scrafty-Mega | `scrafty-mega` | 200 | 1 (static) | 3524 | `scrafty-mega` | 404 |
| Eelektross-Mega | `eelektross-mega` | 200 | 1 (static) | 2793 | `eelektross-mega` | 404 |
| Chandelure-Mega | `chandelure-mega` | 200 | 1 (static) | 3124 | `chandelure-mega` | 200 |
| Golurk-Mega | `golurk-mega` | 200 | 1 (static) | 5006 | `golurk-mega` | 200 |
| Chesnaught-Mega | `chesnaught-mega` | 200 | 1 (static) | 4485 | `chesnaught-mega` | 200 |
| Delphox-Mega | `delphox-mega` | 200 | 1 (static) | 3726 | `delphox-mega` | 200 |
| Greninja-Mega | `greninja-mega` | 200 | 1 (static) | 2547 | `greninja-mega` | 200 |
| Pyroar-Mega | `pyroar-mega` | 200 | 1 (static) | 3830 | `pyroar-mega` | 404 |
| Floette-Mega | `floette-mega` | 200 | 1 (static) | 2325 | `floette-mega` | 200 |
| Meowstic-M-Mega | `meowstic-mmega` | 200 | 1 (static) | 2885 | `meowstic-m-mega` | 200 |
| Meowstic-F-Mega | `meowstic-fmega` | 200 | 1 (static) | 2885 | `meowstic-f-mega` | 200 |
| Malamar-Mega | `malamar-mega` | 200 | 1 (static) | 2874 | `malamar-mega` | 404 |
| Barbaracle-Mega | `barbaracle-mega` | 200 | 1 (static) | 3460 | `barbaracle-mega` | 404 |
| Dragalge-Mega | `dragalge-mega` | 200 | 1 (static) | 3654 | `dragalge-mega` | 404 |
| Hawlucha-Mega | `hawlucha-mega` | 200 | 1 (static) | 3355 | `hawlucha-mega` | 200 |
| Zygarde-Mega | `zygarde-mega` | 404 | — | — | `zygarde-mega` | 404 |
| Crabominable-Mega | `crabominable-mega` | 200 | 1 (static) | 4804 | `crabominable-mega` | 200 |
| Golisopod-Mega | `golisopod-mega` | 404 | — | — | `golisopod-mega` | 404 |
| Drampa-Mega | `drampa-mega` | 200 | 1 (static) | 3273 | `drampa-mega` | 200 |
| Magearna-Mega | `magearna-mega` | 404 | — | — | `magearna-mega` | 404 |
| Magearna-Original-Mega | `magearna-originalmega` | 404 | — | — | `magearna-original-mega` | 404 |
| Zeraora-Mega | `zeraora-mega` | 404 | — | — | `zeraora-mega` | 404 |
| Falinks-Mega | `falinks-mega` | 200 | 1 (static) | 3348 | `falinks-mega` | 404 |
| Scovillain-Mega | `scovillain-mega` | 200 | 1 (static) | 4192 | `scovillain-mega` | 200 |
| Glimmora-Mega | `glimmora-mega` | 200 | 1 (static) | 3849 | `glimmora-mega` | 200 |
| Tatsugiri-Curly-Mega | `tatsugiri-curlymega` | 404 | — | — | `tatsugiri-curly-mega` | 404 |
| Tatsugiri-Droopy-Mega | `tatsugiri-droopymega` | 404 | — | — | `tatsugiri-droopy-mega` | 404 |
| Tatsugiri-Stretchy-Mega | `tatsugiri-stretchymega` | 404 | — | — | `tatsugiri-stretchy-mega` | 404 |
| Baxcalibur-Mega | `baxcalibur-mega` | 404 | — | — | `baxcalibur-mega` | 404 |

---

## 6. PokéAPI

**Yes — PokéAPI already carries Legends: Z-A and the Mega Dimension DLC, with full base stats.** This was not expected and it is the cleanest machine-readable source after Showdown.

- `GET https://pokeapi.co/api/v2/version-group?limit=100` → **32 version groups**, ending `…, 'legends-za', 'mega-dimension', 'champions'`.
- `GET https://pokeapi.co/api/v2/version-group/legends-za` → generation `generation-ix`, pokedexes **`lumiose-city`, `hyperspace`**.
- `GET https://pokeapi.co/api/v2/version-group/mega-dimension` → generation `generation-ix`, pokedex **`hyperspace`**.
- `GET https://pokeapi.co/api/v2/pokedex?limit=60` → 35 pokedexes, ending `'lumiose-city', 'hyperspace', 'champions'`.
- There is still **no `generation-x`**: `GET /api/v2/generation` returns 9. Everything is filed under Gen IX.
- `GET https://pokeapi.co/api/v2/pokemon?limit=1` → `count: 1351`.

Stat spot-checks, all HTTP 200:

```
chandelure-mega   60 75 110 175 110 90   ghost/fire     infiltrator
excadrill-mega   110 165 100  65  65 103 ground/steel   piercing-drill
starmie-mega      60 100 105 130 105 120 water/psychic  huge-power
dragonite-mega    91 124 115 145 125 100 dragon/flying  multiscale
zygarde-mega     216  70  91 216  85 100 dragon/ground  (no abilities listed)
baxcalibur-mega  115 175 117 105 101  87 dragon/ice     (no abilities listed)
heatran-mega      91 120 106 175 141  67 fire/steel     (no abilities listed)
darkrai-mega      70 120 130 165 130  85 dark           (no abilities listed)
```

Every one matches Showdown and the jar exactly. **Abilities are the weak spot**: the DLC forms come back with an empty `abilities` array.

Coverage sweep over all 48 mega slugs: **47/48 resolve**, and the one miss is a naming issue, not a gap — PokéAPI splits Meowstic into `meowstic-male-mega` / `meowstic-female-mega` (both 200) rather than `meowstic-mega` (404). Art coverage on the same 48: **HOME 48/48, official artwork 46/48** (only `tatsugiri-curly-mega` and `tatsugiri-droopy-mega` lack artwork), **pixel `front_default` 47/48**.

`version_group` on `/api/v2/pokemon-form/<slug>` is **`mega-dimension` for every ZA mega**, base-game and DLC alike — so PokéAPI **cannot** be used to split base game from DLC. That split comes from §1's triangulation.

**`PokeAPI/api-data`** (<https://github.com/PokeAPI/api-data>) is live, default branch `master`, last pushed **2026-08-21** — same day as this research. The static dump therefore tracks the live API. If the project wants a fully offline build step (R2 forbids runtime network I/O, but the scraper is a build tool), cloning `api-data` gives the whole thing without rate limits.


---

## 7. Recommendation for the Dataset

1. **Primary stat/type source: `smogon/pokemon-showdown` `data/pokedex.ts`.** One file, already the source for the canonical 48 (ticket 01 diffed 1166/1166 stat blocks against it), and it carries all 49 ZA mega forms marked `isNonstandard: "Future"`. Filter on that tag to select them.
2. **Abilities: read the jar.** 16 of 49 forms differ between Showdown and what Cobbleverse actually runs. Pin the addon version (`zamega-fabric-1.7.3.jar`) to whatever Cobbleverse ships.
3. **Skip `data/mods/gen9legends/`** unless the app ever needs true Legends: Z-A in-game stats. Its only content is 3 stat overrides that would make Starmie/Mawile/Medicham *wrong* for Cobbleverse.
4. **Drop the 4 cosmetic duplicates** (`Magearna-Original-Mega`, `Tatsugiri-Droopy-Mega`, `Tatsugiri-Stretchy-Mega`, `Meowstic-F-Mega`) to land on 45 distinct Megas, consistent with R8's "if it does not exist in the game, it does not go in" logic — they are the same stat block on a cosmetic variant. Also drop `Floette-Ange` (BST 920), a non-canonical addon boss form.
5. **Tier data covers 35 of 49 form entries.** Smogon's Champions dex is the only tier source. The 14 untiered forms are 13 Mega Dimension ones plus Zygarde; they will need an explicit "no tier" state in *Tier por Form*.
6. **Sprites are the real gap, not stats.** Plan for 9 animated + 26 static + 14 PokéAPI HOME renders, or normalise. Feed this into *Escopo do Dataset* and *Fontes de sprite*.

## Verification commands

```bash
# 1. all 49 ZA mega forms from Showdown
curl -s https://play.pokemonshowdown.com/data/pokedex.json \
  | jq '[to_entries[] | select(.value.isNonstandard=="Future" and (.value.name|test("Mega")))] | length'

# 2. the addon jar (plain zip)
curl -sL -o zamega.jar https://cdn.modrinth.com/data/2V1Y86sc/versions/x5u68zHH/zamega-fabric-1.7.3.jar
python -c "import zipfile;print([n for n in zipfile.ZipFile('zamega.jar').namelist() if 'species_additions' in n and n.endswith('.json')])"

# 3. Smogon Champions dex (browser UA is MANDATORY, else 400)
curl -s -A "Mozilla/5.0" -X POST https://www.smogon.com/dex/_rpc/dump-basics \
  -H "Content-Type: application/json" -d '{"gen":"champions"}'

# 4. sprite probe - note the naming: <basespecies>-<squashedforme>
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" \
  https://play.pokemonshowdown.com/sprites/ani/dragonite-mega.gif

# 5. PokeAPI
curl -s https://pokeapi.co/api/v2/pokemon/chandelure-mega | jq '.stats,.types'
```

## Open / unverified

- `UNCONFIRMED`: whether **Mega Meowstic-F** has stats distinct from Mega Meowstic-M. Serebii lists one "Mega Meowstic" row and the `zamega` jar ships one form; Showdown and Game8 split them and give both 74/48/76/143/101/124. The male line is confirmed; the female is very likely identical but was not verified independently.
- `UNCONFIRMED`: whether Serebii's "Mega Floette" row is specifically **Floette-Eternal-Flower**. The 74 base HP only fits Floette-Eternal (74/65/67/125/128/92, BST 551 → 651, exactly +100), and the jar names the form `MegaE`, so the derivation is solid — but no source states it outright.
- `UNCONFIRMED`: **Bulbapedia's raw per-Pokémon stat tables.** `bulbapedia.bulbagarden.net` returns 403 to `curl` (browser UA), to WebFetch, to `r.jina.ai`, and a headed browser session never cleared the Cloudflare Turnstile. Bulbapedia quotations above are verbatim sentences recovered through search-engine extraction of the live pages. Stat verification therefore rests on **Serebii + RotomLabs + Showdown + the jar + PokéAPI**, which agree with each other on all 45.
- Whether Showdown will **animate the remaining 26 static sprites** or add the 14 missing ones — unknowable; re-check before the asset pipeline freezes.
- Whether Smogon will ever open a **Legends: Z-A** dex path. Today `dex/za` and `dex/legendsza` are 404 and the mechanic is folded into Champions.
