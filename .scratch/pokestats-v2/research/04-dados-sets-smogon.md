# Ticket 04 — Smogon Sets + Base Stats at scale (offline desktop app, data embedded at build time)

Investigation date: 2026-08-21. Every claim below was verified by fetching the resource; the URL follows the claim.

---

## 1. Per-Pokémon page structure — where the Sets live

**Sets are in the same `dexSettings` SSR blob**, but they are *also* served by a standalone JSON-RPC endpoint, which is far cheaper to consume.

`GET https://www.smogon.com/dex/sv/pokemon/charizard/` returns **885,413 bytes** of HTML.
Applying the old regex `dexSettings\s*=\s*(\{.*?\});?\s*</script>` yields a JSON object with top-level keys `['injectRpcs', 'route', 'procSettings', 'showEditorUI', 'ads']`.
(Source: `https://www.smogon.com/dex/sv/pokemon/charizard/`)

`injectRpcs` is an array of `[rpcKeyJSON, payload]` pairs. On a per-Pokémon page there are **three**:

| index | key | payload keys |
|---|---|---|
| 0 | `["dump-gens",{}]` | array of `{name, shorthand}` |
| 1 | `["dump-basics",{"gen":"sv"}]` | `pokemon, formats, natures, abilities, moveflags, moves, types, items` |
| 2 | `["dump-pokemon",{"alias":"charizard","gen":"sv","language":"en"}]` | `languages, learnset, strategies, formeStrategies` |

The old Python app read `injectRpcs[1][1]["pokemon"]` — that is index 1, `dump-basics`. **The Sets are at index 2, `strategies`.**
(Source: parsed from `https://www.smogon.com/dex/sv/pokemon/charizard/`)

### The separate RPC endpoint (confirmed live)

```
POST https://www.smogon.com/dex/_rpc/dump-pokemon
Content-Type: application/json
{"alias":"charizard","gen":"sv","language":"en"}
```

→ `HTTP 200`, `Content-Type: application/json; charset=utf-8`, **43,691 bytes** (vs 885,413 for the HTML page — ~20x smaller). Server header is `nginx`. No auth, no CSRF token, no cookie, no `Referer` required.
(Verified: `curl -X POST https://www.smogon.com/dex/_rpc/dump-pokemon -d '{"alias":"charizard","gen":"sv","language":"en"}'` -> 200 / 43691 bytes)

Sibling endpoints, both verified live:

| Endpoint | Body | Response |
|---|---|---|
| `POST /dex/_rpc/dump-gens` | `{}` | 400 bytes — the generation list |
| `POST /dex/_rpc/dump-basics` | `{"gen":"sv"}` | 839,458 bytes — all species base stats + all formats/moves/items/abilities/natures/types |
| `POST /dex/_rpc/dump-pokemon` | `{"alias":..., "gen":..., "language":"en"}` | per-species learnset + strategies |

`alias` = display name lowercased, spaces -> `-`, apostrophes and `.` and `%` stripped. Verified: `great-tusk` (200/179454), `landorus-therian` (200/158110), `mr-mime-galar` (200/1518), `oricorio-pau` (200/1287 — note `oricorio-pa'u` with the apostrophe returns an empty 44-byte body).

### Real fragment of the Set structure (from the live response)

```json
{
  "format": "PU",
  "outdated": null,
  "overview": "",
  "comments": "",
  "movesets": [
    {
      "name": "Sun Wallbreaker",
      "pokemon": "Charizard",
      "shiny": false,
      "gender": "DC",
      "levels": [],
      "description": "<p>Sample set. Stay tuned for updates!</p>",
      "abilities": ["Solar Power"],
      "items": ["Choice Specs", "Heavy-Duty Boots"],
      "teratypes": ["Fire"],
      "moveslots": [
        [{"move": "Weather Ball", "type": null}],
        [{"move": "Solar Beam", "type": null}],
        [{"move": "Focus Blast", "type": null}, {"move": "Scorching Sands", "type": null}],
        [{"move": "Flamethrower", "type": null}, {"move": "Fire Blast", "type": null}]
      ],
      "evconfigs": [{"hp":0,"atk":0,"def":4,"spa":252,"spd":0,"spe":252}],
      "ivconfigs": [],
      "natures": ["Timid"]
    }
  ],
  "credits": {"writtenBy": [], "teams": []}
}
```

A richer real example from the same response (National Dex format), showing populated `ivconfigs`, multiple `evconfigs`, and a typed Hidden Power slot:

```json
{
  "abilities": ["Blaze"],
  "items": ["Charizardite Y"],
  "teratypes": [],
  "moveslots": [
    [{"move":"Flamethrower","type":null},{"move":"Fire Blast","type":null}],
    [{"move":"Solar Beam","type":null}],
    [{"move":"Focus Blast","type":null},{"move":"Scorching Sands","type":null}],
    [{"move":"Roost","type":null},{"move":"Hidden Power","type":"Electric"}]
  ],
  "evconfigs": [{"hp":0,"atk":0,"def":0,"spa":252,"spd":4,"spe":252}],
  "ivconfigs": [{"hp":31,"atk":0,"def":31,"spa":31,"spd":31,"spe":31}],
  "natures": ["Timid"]
}
```

`credits` carries real contributor data:

```json
"credits": {
  "writtenBy": [{"user_id":574288,"username":"Giyu"},{"user_id":602431,"username":"CaptainDaimyo"}],
  "teams": [{"name":"Quality checked by","members":[{"user_id":542526,"username":"Neko"}]},
            {"name":"Grammar checked by","members":[]}]
}
```

`formeStrategies` is `[{formeName, forme, strategies}]` — e.g. `Charizard-Mega-Y` / `Charizard-Mega-X`. **Formes ship inside the parent species' response**, so one request per base species covers its formes.
(Source: `POST https://www.smogon.com/dex/_rpc/dump-pokemon` with `{"alias":"charizard","gen":"sv","language":"en"}`)

### Tiers and dex numbers are in `dump-basics`, not `dump-pokemon`

Each entry of `dump-basics.pokemon` looks like:

```json
{"name":"Syclar","hp":40,"atk":76,"def":45,"spa":74,"spd":39,"spe":91,
 "weight":4,"height":0.2,"types":["Ice","Bug"],
 "abilities":["Compound Eyes","Snow Cloak","Ice Body"],
 "formats":[], "isNonstandard":"CAP",
 "oob":{"dex_number":-1,"evos":["Syclant"],"alts":[],"genfamily":["DP","BW","XY","SM","SS","SV"]}}
```

- `oob.dex_number` -> the National Dex number the old scraper lacked. Verified: Charizard `6`, Great Tusk `984`, Landorus-Therian `645`, Pikachu `25`.
- `formats` -> **the tier label**. Verified: Charizard SV `["ZUBL"]`, Great Tusk `["OU"]`, Urshifu-Rapid-Strike `["Uber"]`, Pikachu `["ZU"]`. It is always 0 or 1 entry (0 multi-format entries across all 9 gens).
- `oob.alts` -> alternate formes; `oob.genfamily` -> which gens the species exists in.
(Source: `POST https://www.smogon.com/dex/_rpc/dump-basics` with `{"gen":"sv"}`)

---

## 2. Dex generations available, and per-gen base stats

`POST /dex/_rpc/dump-gens` returns exactly ten generations:

```json
[{"name":"Red/Blue","shorthand":"RB"},{"name":"Gold/Silver","shorthand":"GS"},
 {"name":"Ruby/Sapphire","shorthand":"RS"},{"name":"Diamond/Pearl","shorthand":"DP"},
 {"name":"Black/White","shorthand":"BW"},{"name":"X/Y","shorthand":"XY"},
 {"name":"Sun/Moon","shorthand":"SM"},{"name":"Sword/Shield","shorthand":"SS"},
 {"name":"Scarlet/Violet","shorthand":"SV"},{"name":"Champions","shorthand":"Champions"}]
```

(Source: `POST https://www.smogon.com/dex/_rpc/dump-gens`)

**There is a tenth path the ticket did not list: `/dex/champions/`.** All ten verified with `GET`:

| Path | HTTP | HTML bytes | `dump-basics` bytes | species | formats | moves | items | abilities | natures |
|---|---|---|---|---|---|---|---|---|---|
| `/dex/rb/pokemon/` | 200 | 105,580 | 103,523 | 151 | 33 | 165 | 10 | 0 | 0 |
| `/dex/gs/pokemon/` | 200 | 172,580 | 170,523 | 251 | 14 | 251 | 64 | 0 | 0 |
| `/dex/rs/pokemon/` | 200 | 281,287 | 279,230 | 392 | 18 | 354 | 117 | 76 | 25 |
| `/dex/dp/pokemon/` | 200 | 392,805 | 390,748 | 550 | 19 | 469 | 214 | 126 | 25 |
| `/dex/bw/pokemon/` | 200 | 500,660 | 498,603 | 747 | 29 | 561 | 251 | 167 | 25 |
| `/dex/xy/pokemon/` | 200 | 577,631 | 575,574 | 881 | 48 | 623 | 315 | 194 | 25 |
| `/dex/sm/pokemon/` | 200 | 672,060 | 670,003 | 1,049 | 41 | 726 | 377 | 236 | 25 |
| `/dex/ss/pokemon/` | 200 | 772,832 | 770,775 | 1,215 | 47 | 830 | 504 | 270 | 25 |
| `/dex/sv/pokemon/` | 200 | 841,515 | 839,458 | 1,355 | 60 | 872 | 525 | 313 | 25 |
| `/dex/champions/pokemon/` | 200 | 339,688 | 337,603 | 323 | 42 | 500 | 151 | 201 | 25 |

Note: the SV species count is **1,355** today vs the **1,399** the prior app captured. Cause `UNCONFIRMED` — possibly a pre-cleanup snapshot or a different gen.

### Base stats DO differ between generations — concrete examples

Pulled from `dump-basics` per gen (`hp/atk/def/spa/spd/spe`):

| Species | RB | GS | BW | XY | SV |
|---|---|---|---|---|---|
| **Gengar** | 60/65/60/130/**130**/110 | 60/65/60/130/**75**/110 | 60/65/60/130/75/110 | same | same |
| **Alakazam** | 55/50/45/135/**135**/120 | 55/50/45/135/**85**/120 | 55/50/45/135/85/120 | 55/50/45/135/**95**/120 | same |
| **Clefable** | 95/70/73/**85**/85/60 | 95/70/73/85/**90**/60 | 95/70/73/85/90/60 | 95/70/73/**95**/90/60 | same |
| **Pikachu** | 35/55/**30**/50/**50**/90 | 35/55/30/50/**40**/90 | 35/55/30/50/40/90 | 35/55/**40**/50/**50**/90 | same |
| **Golem** | 80/**110**/130/55/**55**/45 | 80/110/130/55/**65**/45 | same | 80/**120**/130/55/65/45 | same |
| **Charizard** | 78/84/78/**85**/85/100 | 78/84/78/**109**/85/100 | same | same | same |
| **Butterfree** | 60/45/50/**80**/80/70 | same | same | 60/45/50/**90**/80/70 | same |

Two distinct causes: (a) Gen 1 had a single "Special" stat that Smogon renders as identical `spa`/`spd`; (b) Game Freak's Gen 6 (XY) stat buffs.
(Source: `POST https://www.smogon.com/dex/_rpc/dump-basics` for each of `rb, gs, rs, dp, bw, xy, sm, ss, sv`)

Pokémon Showdown encodes the same thing as per-gen override files — `data/mods/gen1/pokedex.ts` contains:

```ts
gengar: { inherit: true, baseStats: { hp: 60, atk: 65, def: 60, spa: 130, spd: 130, spe: 110 } },
```

(Source: `https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen1/pokedex.ts`)

**Implication: a single `pokedex.ts` / single `dump-basics` snapshot is wrong for any multi-generation feature. Base stats must be keyed by (species, generation).**

---

## 3. Formats per generation

### SV — 60 formats

`1v1, 2v2, AG, Almost Any Ability, Battle Stadium Singles, BH, BSS Series 1, BSS Series 2, Camomons, CAP, CC1v1, Doubles, Doubles Ubers, Doubles UU, Draft, Godly Gift, Inheritance, LC, Leader's Choice, Metronome Battle, Mix and Mega, Monotype, National Dex, National Dex Doubles, National Dex Monotype, National Dex Rotational, National Dex RU, National Dex Ubers, National Dex UU, NFE, NU, NUBL, OMM Spotlight, OMotM, OU, Partners in Crime, PU, PUBL, Random Battle, Random Doubles, RU, RUBL, Shared Power, SSB, STABmons, Uber, Ubers UU, UU, UUBL, VGC, VGC23 Series 1, VGC23 Series 2, VGC23 Series 3, VGC23 Series 4, VGC24 Regulation E, VGC24 Regulation F, VGC24 Regulation G, VGC25 Regulation I, ZU, ZUBL`

### SS — 47 formats

`1v1, 2v2, AG, Almost Any Ability, Battle Stadium Singles, BDSP OU, BH, BSS Series 10, BSS Series 12, BSS Series 13, Camomons, CAP, CC1v1, Doubles, Doubles Ubers, Doubles UU, Draft, Godly Gift, LC, Mix and Mega, Monotype, National Dex, National Dex AG (DLC1), National Dex Monotype, National Dex RU, National Dex UU, NFE, NU, NUBL, OU, PU, PUBL, Random Battle, Random Doubles, RU, RUBL, STABmons, Tier Shift, Uber, UU, UUBL, VGC20, VGC21, VGC22, VGC22 Series 13, ZU, ZUBL`

### SM — 41 formats

`1v1, 2v2, AG, Almost Any Ability, Averagemons, Battle Spot Doubles, Battle Spot Singles, BH, Camomons, CAP, CC1v1, Doubles, Doubles Ubers, Doubles UU, Draft, Godly Gift, LC, LGPE OU, Mix and Mega, Monotype, NFE, NU, NUBL, OU, PU, PUBL, Random Battle, Random Doubles, RU, RUBL, Sketchmons, STABmons, Tier Shift, Uber, UU, UUBL, VGC17, VGC18, VGC19, ZU, ZUBL`

### XY — 48 formats

`1v1, 2v2, AG, Almost Any Ability, Averagemons, Battle Spot Doubles, Battle Spot Singles, Battle Spot Triples, BH, CAP, CC1v1, Doubles, Doubles Ubers, Doubles UU, Draft, Godly Gift, Hackmons Cup, Inverse Battle, LC, Middle Cup, Mix and Mega, Monotype, Monotype Random Battle, NFE, NU, NUBL, OU, PU, PUBL, Pure Hackmons, Random Battle, Random Doubles, Random Triples, RU, RUBL, Seasonal, Sketchmons, STABmons, Tier Shift, Triples, Uber, UU, UUBL, VGC14, VGC15, VGC16, ZU, ZUBL`

Also RB 33, GS 14, RS 18, DP 19, BW 29, Champions 42.
(Source: `formats` array of `POST https://www.smogon.com/dex/_rpc/dump-basics` per gen; each entry carries `{name, shorthand, genfamily}` so the cross-gen availability matrix is derivable from any single response.)

**Caution:** a format appearing in `dump-basics.formats` means the *format exists for that gen*, not that any Pokémon has a published analysis in it. `Random Battle`, `CC1v1`, `SSB`, `Metronome Battle` etc. carry no curated movesets.

### Tier distribution (from `pokemon.formats`)

| Gen | Top tiers by species count |
|---|---|
| RB | LC 45, ZU 26, NU 22, UU 18, PU 14, OU 11, NFE 11, ZUBL 2, Uber 2 |
| XY | LC 241, ZU 106, NFE 68, PU 67, UU 65, Uber 61, NU 59, OU 58, RU 54, CAP 23 |
| SM | LC 261, ZU 197, NFE 95, Uber 68, RU 63, NU 58, UU 57, OU 54, PU 53, CAP 29 |
| SS | National Dex 340, LC 210, ZU 166, NFE 84, Uber 45, PU 42, UU 42, RU 38, AG 36 |
| SV | National Dex 397, LC 227, ZU 188, NFE 108, Uber 73, PU 48, RU 44, CAP 41, OU 40 |

---

## 4. Scrape cost for one generation

### robots.txt — the entire file is 32 bytes

```
User-agent: Amazonbot
Allow: /
```

(Source: `https://www.smogon.com/robots.txt`, `HTTP 200`, `size_download=32`)

There is **no `User-agent: *` block, no `Disallow`, no `Crawl-delay`, and no `Sitemap`**. The only directive is an explicit allow for Amazon's crawler. No rate limit is published anywhere on the site; `UNCONFIRMED` whether one exists at the edge (nginx / CDN). No `Retry-After`, `X-RateLimit-*`, or `429` was observed across roughly 90 requests issued during this investigation.

### Request count for SV

- SV `dump-basics` lists **1,355 entries**; **77** of those are listed in another entry's `oob.alts` (Megas etc.), leaving **1,278 base species**. Alt formes come back inside the parent's `formeStrategies`, so **1,278 `dump-pokemon` requests** cover the whole generation.
- Plus 1 x `dump-basics` and 1 x `dump-gens` -> **1,280 requests total**.

### Payload

Random sample of 25 SV base species (seed 7), `POST /dex/_rpc/dump-pokemon`:

```
audino 5128     celebi 15022    keldeo 82533    poltchageist 519   pinsir 7414
polteageist-antique 654         feraligatr 21165  charizard 43691  dolliv 508
exeggutor 8787  blacephalon 20706  walrein 1029  ramnarok 1681     dratini 708
trevenant 7436  spritzee 832    mr-mime-galar 1518  cranidos 4203  cyndaquil 637
arctozolt 2734  helioptile 820  marowak 1306    ursaluna 107507    qwilfish 19022
ninetales-alola 85868
```

n=25, total 441,428 B, **mean 17,657 B/request**, elapsed 26 s -> **~1.05 s/request serial**.

| Approach | Requests | Est. bytes / gen | Est. serial wall time |
|---|---|---|---|
| `dump-pokemon` RPC (recommended if scraping) | 1,280 | **~22.6 MB** (1,278 x 17.7 KB + 0.84 MB basics) | **~22 min** |
| Full HTML pages + regex (prior app's method) | 1,280 | **~1.13 GB** (1,278 x 885 KB) | 40 min+ |
| All 9 gens via RPC | ~7,000 (rough; fewer species in old gens) | ~80-110 MB | ~2 h |

### The zero-request alternative

`https://data.pkmn.cc/sets/gen9.json` = **1,090,060 bytes uncompressed / 150,233 gzip** for *every SV set in every published format*. All nine generations of sets: **4,358,358 B raw / 618,041 B gzip** — one HTTP request per generation, nine for the lot.
(Source: `https://data.pkmn.cc/sets/index.json`)

---

## 5. THE KEY QUESTION — licensed / pre-built datasets

### 5a. `github.com/smogon/pokemon-showdown` — `data/`

`LICENSE`: **MIT**, "Copyright (c) 2011-2026 Guangcong Luo and other contributors http://pokemonshowdown.com/".
(Source: `gh api repos/smogon/pokemon-showdown/contents/LICENSE`)

Directory listing (`gh api repos/smogon/pokemon-showdown/contents/data`):

| File | Size | Contents |
|---|---|---|
| `pokedex.ts` | 537,919 | Species data: `num`, `name`, `types`, `genderRatio`, **`baseStats`**, `abilities`, `heightm`, `weightkg`, `color`, `prevo`/`evos`/`evoLevel`, `eggGroups`, `otherFormes`, `formeOrder`, `canGigantamax`. **Current-gen values only.** |
| `formats-data.ts` | 93,264 | **Yes — tier assignments.** `charizard: { tier: "ZUBL", doublesTier: "(DUU)", natDexTier: "RU" }`. Also `isNonstandard`. **Current-gen only.** |
| `learnsets.ts` | 3,723,952 | move -> array of source codes (`"3L1"`, `"9M"`, ...), all gens in one table |
| `moves.ts` | 484,593 | move data **plus battle-engine callbacks** — not pure data |
| `items.ts` | 163,613 | item data **plus callbacks** (`onSetAbility(...)`, `onTakeItem(...)`) |
| `abilities.ts` | 156,527 | ability data + callbacks |
| `natures.ts` | 1,490 | 25 natures |
| `typechart.ts`, `aliases.ts`, `tags.ts`, `rulesets.ts`, `conditions.ts`, `pokemongo.ts`, `FORMES.md` | — | supporting |
| `mods/` (dir) | — | **47 sub-mods** including `gen1`...`gen9dlc1`. Each has its own `pokedex.ts` + `formats-data.ts` carrying `inherit: true` overrides -> this is where **per-generation base stats and per-generation tiers** live. |
| `random-battles/` (dir) | — | 21 sub-dirs (`gen1`...`gen9`, `gen9cap`, `champions`, ...) |
| `text/` (dir) | — | descriptions |

**Does anything there carry curated Sets?** No.
`data/random-battles/gen9/` contains `sets.json` (267,527 B), `factory-sets.json` (218,043), `bss-factory-sets.json` (199,931), `doubles-sets.json` (244,265), `1v1-factory-sets.json` (72,890), `draft-factory-matchups.json` (920,906), `teams.ts`. These are **Random Battle / Battle Factory generation tables** used by the simulator's team generator — algorithmically-derived move pools, *not* Smogon Dex analyses. A code search for `filename:sets.json` across the repo returns only `data/mods/afd/sets.json` and `data/random-battles/gen*/sets.json`.
(Source: `gh api repos/smogon/pokemon-showdown/contents/data/random-battles/gen9`; `gh api "search/code?q=repo:smogon/pokemon-showdown+filename:sets.json"`)

**Verdict on this repo: Base Stats yes (per-gen, via `mods/`), Tiers yes (per-gen, via `mods/`), dex numbers yes (`num`), height yes (`heightm`), curated Smogon Sets NO.**

### 5b. The `@pkmn/*` npm ecosystem

`npm view <pkg> version description license`:

| Package | Version | License | Description | Repo |
|---|---|---|---|---|
| `@pkmn/dex` | 0.10.11 | MIT | "A unification of Pokémon Showdown's client's and server's data layers" | github.com/pkmn/ps |
| `@pkmn/data` | 0.10.11 | MIT | "A forked implementation of the Pokémon Showdown client's data layer" | github.com/pkmn/ps |
| `@pkmn/sets` | 5.2.0 | MIT | "Parsing logic for Pokémon Showdown sets and teams" | github.com/pkmn/ps |
| `@pkmn/smogon` | 0.5.31 | MIT | "A rich client for processed and aggregated Smogon analysis and moveset information" | github.com/pkmn/smogon |
| `@pkmn/sim` | 0.10.11 | MIT | simulator extraction | github.com/pkmn/ps |
| `@pkmn/mods` | 0.10.11 | MIT | non-standard mods | github.com/pkmn/ps |
| `smogon` | 5.0.1 | MIT | "Low-level wrapper around Smogon's analyses and usage statistics" | github.com/pkmn/smogon |
| `@smogon/sets` | 2.0.0 | **UNLICENSED** | "Set data imported from Smogon.com and used on Pokémon Showdown" | github.com/smogon/sets |

#### `@pkmn/dex` — verified capabilities

Installed 0.10.11 (tarball 4.6 MB, 52 MB unpacked incl. sourcemaps) and ran it:

```js
const {Dex} = require('@pkmn/dex');
Dex.forGen(1).species.get('gengar').baseStats  // {hp:60,atk:65,def:60,spa:130,spd:130,spe:110}
Dex.forGen(2).species.get('gengar').baseStats  // {hp:60,atk:65,def:60,spa:130,spd:75, spe:110}
Dex.forGen(9).species.get('charizard')
// num:6, types:["Fire","Flying"], baseStats:{78,84,78,109,85,100},
// abilities:{0:"Blaze",H:"Solar Power"}, weightkg:90.5,
// tier:"ZU", doublesTier:"(DUU)", natDexTier:"RU"
Dex.forGen(9).species.all().length            // 1517
```

- **Per-generation base stats: yes.** `Dex.forGen(n)` applies the mod overrides. Gengar's Gen 1 SpD=130 vs Gen 2+ SpD=75 reproduced exactly.
- **Dex numbers: yes** (`num`). **Tiers: yes** (`tier` / `doublesTier` / `natDexTier`).
- **Height: NO.** The stored species record is `{num, name, types, genderRatio, baseStats, abilities, weightkg, prevo, evoLevel, eggGroups, otherFormes, formeOrder, canGigantamax}` — `heightm` and `color` are stripped. If PokeStats keeps the Height column it must come from `smogon/pokemon-showdown`'s `data/pokedex.ts` (`heightm`) or Smogon's `dump-basics` (`height`).
- **Staleness caveat:** `@pkmn/dex` 0.10.11 reports Charizard SV `tier: "ZU"`, whereas both `smogon/pokemon-showdown@master` `formats-data.ts` and Smogon's live `dump-basics` say **`ZUBL`**. Tier data drifts with the npm release cadence; if tiers must be current, read them from Showdown master or Smogon directly at build time.
- README states: "only the **data** from Pokémon Showdown is included, none of the mechanics implementation logic" and "all of the data files are encoded in JSON instead of JS". No runtime deps.
(Sources: `npm pack @pkmn/dex`; `https://github.com/pkmn/ps/blob/main/dex/README.md`)

#### `@pkmn/sets` — parsing only, no data

"Parsing logic for Pokémon Showdown's sets export format." Provides `Sets.importSet(...)` / `Sets.unpack(...)` to convert between the human-readable export block and the packed wire format. **Ships no set data.** Useful as the target schema if PokeStats wants to render/export in PS format.
(Source: `https://github.com/pkmn/ps/blob/main/sets/README.md`)

#### `@pkmn/smogon` — YES, it serves Smogon analyses/sets from a static endpoint

Repo: `github.com/pkmn/smogon`. README, verbatim on the critical points:

> "**Smogon does not officially provide any API for third party developers**, and is at liberty to make breaking changes to its internal data representations at any point - this project attempts to provide a stable way of accessing the data Smogon exposes on its site."

> "[data.pkmn.cc](https://data.pkmn.cc) contains several curated datasets pulled from Smogon and Pokémon Showdown which have been processed to allow for efficient batch access of analysis, sets, teams, and statistics data by format or generation. Analysis and set data is refreshed automatically every 24 hours ..."

> "While this project's code is distributed under the terms of the [MIT License] and the aggregated stats information is freely available in the public domain, **the set and analysis data is copyrighted by Smogon and its contributors.**"

The package itself contains **no data** — it takes a `fetch` implementation and pulls from `data.pkmn.cc`:

```ts
import {Dex} from '@pkmn/dex';
import {Generations} from '@pkmn/data';
import {Smogon} from '@pkmn/smogon';
const smogon = new Smogon(fetch);
smogon.sets(gens.get(8), 'Dragapult');
smogon.analyses(gens.get(4), 'Jirachi');
smogon.stats(gens.get(1), 'Snorlax');
```

(Sources: `https://github.com/pkmn/smogon/blob/main/README.md`, `https://github.com/pkmn/smogon/blob/main/pkmn/README.md`)

`@smogon/sets` (the Smogon-org one) is **UNLICENSED** and **stale**: latest publish 2.0.0 on **2021-07-02**, i.e. Gen 8 era, no SV data. `@pkmn/smogon`'s README describes the difference: `@smogon/sets` embeds preprocessed+validated `PokemonSet` data updated "approximately monthly when a new package is released", while `@pkmn/smogon` fetches fresh `Moveset` data. Given the 5-year publishing gap and the `UNLICENSED` field, it is not a viable source for an SV app.
(Sources: `npm view @smogon/sets time --json`, `npm view @smogon/sets license`)

### 5c. `data.pkmn.cc` — verified live and complete

`https://data.pkmn.cc/` -> `301` -> `https://pkmn.github.io/smogon/data/` (GitHub Pages). Six endpoints: `/analyses`, `/formats`, `/imgs`, `/sets`, `/stats`, `/teams`.

Verified live responses:

| URL | HTTP | Bytes |
|---|---|---|
| `https://data.pkmn.cc/sets/gen9ou.json` | 200 | 53,261 |
| `https://data.pkmn.cc/sets/gen9.json` | 200 | 1,090,060 |
| `https://data.pkmn.cc/analyses/gen9ou.json` | 200 | 813,500 |
| `https://data.pkmn.cc/stats/gen9ou.json` | 200 | 2,997,271 |
| `https://data.pkmn.cc/sets/index.json` | 200 | 6,448 |
| `https://data.pkmn.cc/analyses/index.json` | 200 | 17,553 |
| `https://data.pkmn.cc/formats/index.json` | 200 | 17,553 |

Repo inventory (`gh api repos/pkmn/smogon/git/trees/main?recursive=1`):

| Directory | Files | Total size |
|---|---|---|
| `data/sets/` | 180 | **8.67 MB** |
| `data/analyses/` | 180 | 132.10 MB |
| `data/stats/` | 154 | 147.32 MB |
| `data/teams/` | 98 | 1.22 MB |
| `data/formats/` | 2 | 0.02 MB |

**Sets payload, all nine generations** (`/sets/index.json`, `[uncompressed, gzip]`):

| File | Uncompressed | Gzip |
|---|---|---|
| gen1.json | 68,796 | 9,737 |
| gen2.json | 67,798 | 10,793 |
| gen3.json | 206,378 | 28,207 |
| gen4.json | 351,871 | 49,309 |
| gen5.json | 531,796 | 75,059 |
| gen6.json | 650,543 | 94,109 |
| gen7.json | 612,415 | 91,840 |
| gen8.json | 778,701 | 108,754 |
| gen9.json | 1,090,060 | 150,233 |
| **TOTAL** | **4,358,358 (4.36 MB)** | **618,041 (0.62 MB)** |

Analyses (the prose) are much heavier: **66.2 MB raw / 18.7 MB gzip** across all nine gens (gen7 alone is 14.96 MB raw).

**Update cadence, verified from CI:** `.github/workflows/update-sets.yml` runs `cron: '12 0 * * *'` — daily at 00:12 UTC, committing "Analyses & Sets (YYYY-MM-DD)".
(Source: `https://github.com/pkmn/smogon/blob/main/.github/workflows/update-sets.yml`)

**Fidelity check** — pkmn's `gen9.json -> Charizard -> pu` vs Smogon's live RPC:

```json
"Sun Wallbreaker": {
  "moves": ["Weather Ball","Solar Beam",["Focus Blast","Scorching Sands"],["Flamethrower","Fire Blast"]],
  "ability": "Solar Power",
  "item": ["Choice Specs","Heavy-Duty Boots"],
  "nature": "Timid",
  "evs": {"def":4,"spa":252,"spe":252},
  "teratypes": "Fire"
}
```

Identical content to the `dump-pokemon` PU moveset in section 1 (zero EVs elided, single-element arrays collapsed to scalars).

**Coverage gap (important).** Smogon's live SV dex exposes 60 formats; `data.pkmn.cc` publishes **32** gen9 set files. Verified 404s: `gen92v2doubles`, `gen9camomons`, `gen9doublesubers`, `gen9doublesuu`, **`gen9draft`**, `gen9metronomebattle`, `gen9nationaldexrotational`, `gen9randombattle`, `gen9sharedpower`, `gen9ssb`. Charizard's live Smogon page carries a **Draft** analysis that pkmn's dump does not include (`Charizard` in `gen9.json` has `pu, vgc2025, nationaldexmonotype, nationaldexdoubles, nationaldex` — no `draft`). VGC is aggregated by year (`gen9vgc2023/2024/2025`) rather than per-regulation, which the README explains as deliberate.

pkmn gen9 set files (32): `gen91v1, gen9almostanyability, gen9anythinggoes, gen9balancedhackmons, gen9battlestadiumsingles, gen9cap, gen9doublesou, gen9godlygift, gen9inheritance, gen9lc, gen9mixandmega, gen9monotype, gen9nationaldex, gen9nationaldexdoubles, gen9nationaldexmonotype, gen9nationaldexru, gen9nationaldexubers, gen9nationaldexuu, gen9nfe, gen9nu, gen9ou, gen9partnersincrime, gen9pu, gen9ru, gen9stabmons, gen9ubers, gen9ubersuu, gen9uu, gen9vgc2023, gen9vgc2024, gen9vgc2025, gen9zu`

Per-gen file counts (excluding the `genN.json` aggregate): gen1 18, gen2 7, gen3 10, gen4 12, gen5 16, gen6 23, gen7 22, gen8 30, gen9 32.

**`data.pkmn.cc` contains no base stats, no dex numbers, no tier labels.** It is sets + analyses + stats + teams only. Base stats/tiers/dex numbers come from `@pkmn/dex` or `smogon/pokemon-showdown`. This is by design — `API.md`: "the data exposed as been carefully crafted to **avoid requiring a data dependency** ... and to **remove any fields which can be programmatically deduced**."

---

## 6. Exact Set structure as published

Two published shapes. Pick one; do not invent a third.

### 6a. Smogon's own `dump-pokemon` moveset (raw, richest)

```
strategies: [
  {
    format:   string          // "PU", "National Dex", "VGC", "Draft", ...
    outdated: null | <flag>
    overview: string          // sanitized HTML, may be ""
    comments: string          // sanitized HTML, may be ""
    credits:  { writtenBy: [{user_id, username}], teams: [{name, members:[{user_id,username}]}] }
    movesets: [
      {
        name:        string   // "Sun Wallbreaker", "Choice Scarf", "Defensive"
        pokemon:     string   // "Charizard"
        shiny:       boolean
        gender:      string   // "DC" = don't care; else "M"/"F"
        levels:      number[] // [] when default (100); e.g. [27,30] in Gen 1 Petit Cup
        description: string   // sanitized HTML, per-set prose
        abilities:   string[] // alternatives
        items:       string[] // alternatives
        teratypes:   string[] // alternatives; [] pre-Gen 9
        moveslots:   Array<Array<{move: string, type: string|null}>>
        evconfigs:   Array<{hp,atk,def,spa,spd,spe}>   // full 6 keys, zeros explicit
        ivconfigs:   Array<{hp,atk,def,spa,spd,spe}>   // [] when all 31
        natures:     string[]
      }
    ]
  }
]
formeStrategies: [ {formeName: string, forme: string, strategies: [...same shape...]} ]
```

- **Slashed alternatives ("Dragon Claw / Roost")** -> `moveslots` is an array of **four slots**; each slot is an **array of alternatives**. `[[{Flamethrower}, {Fire Blast}]]` renders as "Flamethrower / Fire Blast". Same idea for `abilities`, `items`, `teratypes`, `natures` — a slashed row is a multi-element array.
- **Hidden Power** carries the type in the slot: `{"move":"Hidden Power","type":"Electric"}`. Every other move has `"type": null`.
- **EVs**: `evconfigs` is a **list** — more than one entry means Smogon published alternative spreads. All six keys always present, zeros included: `{"hp":0,"atk":0,"def":4,"spa":252,"spd":0,"spe":252}`.
- **IVs**: `ivconfigs` — `[]` means "all 31". A populated entry gives all six explicitly: `{"hp":31,"atk":0,"def":31,"spa":31,"spd":31,"spe":31}` (the classic 0 Atk).
- **Tera**: `teratypes: ["Fire"]` — plain type-name strings, empty array for pre-Gen 9 analyses.
- **Level**: `levels: []` for the default; `[27, 30]` for Gen 1 Petit Cup.

### 6b. pkmn's `Moveset` at `data.pkmn.cc/sets` (compact)

```
{ <Species Display Name>: { <tierId>: { <Set Name>: Moveset } } }      // genN.json
{ <Species Display Name>: { <Set Name>: Moveset } }                    // genNou.json
```

*Note:* `data/sets/index.md` states the whole-generation file has "an initial layer for each tier ID"; the actual `gen9.json` is **species-first, then tier** (verified: `gen9.json["Great Tusk"]` has keys `ubersuu, 1v1, monotype, battlestadiumsingles, inheritance, stabmons, nationaldex, godlygift, mixandmega, almostanyability, ubers, ou, nationaldexmonotype`). Trust the data, not the doc sentence.

`Moveset` fields — exhaustive frequency count across all 9 generations x all 180 files (19,582 sets total):

| Field | Occurrences | Types observed |
|---|---|---|
| `moves` | 19,582 | `list` (always) |
| `item` | 18,864 | `str` 14,911 / `list` 3,953 |
| `nature` | 18,445 | `str` 15,804 / `list` 2,641 |
| `evs` | 18,390 | `dict` 18,040 / `list` 350 |
| `ability` | 7,899 | `str` 7,175 / `list` 724 |
| `ivs` | 3,045 | `dict` 3,036 / `list` 9 |
| `teratypes` | 2,480 | `str` 1,069 / `list` 1,411 |
| `level` | 46 | `list` (always) |

**No other field exists.** In particular `gender`, `shiny`, `happiness`, `gigantamax` and the per-set `description` are dropped (description moves to `/analyses`).

Encoding rules, each with a verified real example:

- **Slashed alternatives inside a move slot** -> nested array. Scalar = single option.
  ```json
  "moves": ["Headlong Rush","Ice Spinner","Rapid Spin",["Close Combat","Stealth Rock","Knock Off"]]
  ```
  (`gen9ou.json -> Great Tusk -> "Offensive Utility"`)
- **Alternatives on any other field** -> array vs scalar, same convention:
  ```json
  "item": ["Heavy-Duty Boots","Rocky Helmet","Booster Energy"],
  "item": "Choice Scarf",
  "teratypes": ["Steel","Fighting","Ice"],
  "teratypes": "Ghost",
  "nature": ["Calm","Timid"],
  "ability": ["Damp","Water Absorb"]
  ```
- **EVs** — sparse dict, **zeros omitted** (unlike Smogon's raw form). Multiple published spreads -> array of dicts:
  ```json
  "evs": {"atk":252,"def":4,"spe":252}
  "evs": [{"hp":252,"spd":240,"spe":16},{"hp":252,"spa":4,"spe":252}]   // gen3 Raichu RU "Wish"
  ```
- **IVs** — same sparse convention; **absent entirely when all 31**:
  ```json
  "ivs": {"hp":6,"atk":28,"def":28}                                    // gen1 Diglett LC
  "ivs": [{"atk":3,"spa":30,"spd":30},{"atk":2,"spa":30,"spe":30}]      // gen5 Cresselia VGC13
  "ivs": []                                                            // 9 occurrences, degenerate; treat as absent
  ```
- **Tera types** — plain type names, `str` or `str[]`.
- **Level** — always an array, only 46 sets in the whole corpus have it:
  ```json
  "level": [27,30]        // gen1 Bulbasaur petitcup
  "level": [55,52,50]     // gen1 Charizard nc1997
  ```

**Data-quality caveat:** `teratypes` appears on **pre-Gen-9 sets** (e.g. `gen4 Quagsire pu "Defensive"` carries `"teratypes":"Water"`). That is an upstream Smogon data-entry artifact passed through verbatim. Strip `teratypes` for gen < 9 at build time.

**Validity caveat, verbatim from the docs:** "Smogon's movesets are **not** guaranteed to be valid on Pokémon Showdown - most of the fields can either be atomic or composite values, with the latter being used to reflect the 'slash options' present in Smogon's data."
(Source: `https://github.com/pkmn/smogon/blob/main/data/sets/index.md`)

---

## 7. Terms of use — what the sources say, verbatim

**No verdict or legal advice is offered here. These are the primary sources, quoted.**

### `https://www.smogon.com/robots.txt` — the complete file

```
User-agent: Amazonbot
Allow: /
```

32 bytes. No `User-agent: *` block, no `Disallow`, no `Crawl-delay`, no `Sitemap`. Nothing in it addresses redistribution.

### `https://www.smogon.com/` — site footer, verbatim

> "All guides and strategy information are &copy; 2004 Smogon.com and its contributors. Pok&eacute;mon is &copy; 1995 Nintendo."

(rendered: "All guides and strategy information are (c) 2004 Smogon.com and its contributors. Pokémon is (c) 1995 Nintendo.")

The footer links to a Privacy Policy. No "Terms of Use" or "API" link is present in the footer.

### `https://www.smogon.com/forums/help/terms/` — Terms and Rules (HTTP 200)

These are the **forum** terms (XenForo). Relevant clauses as returned by fetch:

> "You are granting us with a non-exclusive, permanent, irrevocable, unlimited license to use, publish, or re-publish your Content in connection with the Service. You retain copyright over the Content."

> "All content you submit, upload, or otherwise make available to the Service may be reviewed by staff members."

> The service providers "may remove or modify any Content submitted at any time, with or without cause, with or without notice."

**The document does not address web scraping, automated access, redistribution, or commercial use.** `https://www.smogon.com/forums/pages/terms/` returns 404. No separate site-wide ToS, API terms, or data-licence page was found.

### `https://github.com/pkmn/smogon` README — verbatim

> "**Smogon does not officially provide any API for third party developers**, and is at liberty to make breaking changes to its internal data representations at any point"

> "While this project's code is distributed under the terms of the [MIT License](https://github.com/pkmn/smogon/tree/main/LICENSE) and the aggregated stats information is freely available in the public domain, **the set and analysis data is copyrighted by Smogon and its contributors.**"

`pkmn/smogon`'s `LICENSE` file is MIT, "Copyright (c) 2020-2025 pkmn contributors" — it covers the **code**, and the README explicitly carves the set/analysis data out of that grant.

### `github.com/smogon/pokemon-showdown` LICENSE — verbatim opening

> "The MIT License (MIT)
> Copyright (c) 2011-2026 Guangcong Luo and other contributors http://pokemonshowdown.com/"

Full standard MIT text follows, with no additional data carve-out in the file.

### `@smogon/sets` npm metadata

`license: UNLICENSED`. (`npm view @smogon/sets license`)

**What the sources establish:** the Showdown *engine data* (base stats, tiers, dex numbers, learnsets, moves, items, abilities) sits under a plain MIT grant from Smogon's own org. The *curated Set and analysis text* is separately asserted as "copyrighted by Smogon and its contributors" by the maintainer who republishes it, and Smogon's own footer asserts copyright over "all guides and strategy information". Nothing published states permission or prohibition for embedding that set data in a downloadable binary. Escalate the redistribution decision to a human.

---

## Recommendation table

| Source | Gives Sets? | Gives Base Stats? | Gives Tiers? | Per-generation? | License | Scraping needed? |
|---|---|---|---|---|---|---|
| **`data.pkmn.cc/sets/genN.json`** (via `@pkmn/smogon` or plain `curl`) | YES — all formats with published analyses (32/60 in SV; no Draft, Doubles UU/Ubers, 2v2, Camomons, Shared Power, Rotational) | No | No | YES `gen1`-`gen9`, plus per-format files | Code MIT; **set data "copyrighted by Smogon and its contributors"** | **No** — 9 GET requests, 4.36 MB raw / 0.62 MB gzip for all gens |
| **`data.pkmn.cc/analyses/genN.json`** | Prose only (`description`, `overview`, `comments`, `credits`) — no moves | No | No | YES | same as above | No — 66.2 MB raw / 18.7 MB gzip all gens |
| **`@pkmn/dex` (npm 0.10.11)** | No | YES per-gen, verified (Gengar G1 SpD 130 -> G2 75) | YES `tier`/`doublesTier`/`natDexTier` — but 0.10.11 says Charizard SV `ZU` where live says `ZUBL` | YES `Dex.forGen(1..9)` | MIT | No. **Missing `heightm` and `color`** |
| **`smogon/pokemon-showdown` `data/`** | No (only Random Battle / Battle Factory tables) | YES `pokedex.ts` current-gen + `data/mods/genN/pokedex.ts` overrides; includes `heightm` | YES `formats-data.ts` + `data/mods/genN/formats-data.ts` | YES via `mods/` (47 mods) | MIT | No — git clone / raw.githubusercontent |
| **Smogon `POST /dex/_rpc/dump-basics`** | No | YES + `weight`, `height`, types, abilities | YES (`pokemon.formats`, e.g. `["ZUBL"]`) + `oob.dex_number` | YES one call per gen (10 gens incl. `champions`) | Site footer: "(c) 2004 Smogon.com and its contributors" | Yes, but only **1 request/gen**, <= 840 KB |
| **Smogon `POST /dex/_rpc/dump-pokemon`** | YES **complete** — every format incl. Draft; plus `shiny`, `gender`, `levels`, per-set `description`, `credits`, `learnset` | No | No | YES `gen` param | same as above | **Yes** — 1,278 req/gen, ~22.6 MB, ~22 min serial |
| **Smogon HTML page + `dexSettings` regex** (prior app's method) | YES same content as the RPC | YES (whole `dump-basics` embedded in every page) | YES | YES | same as above | **Yes** — 1,278 req/gen, **~1.13 GB**. Strictly worse than the RPC |
| **`@smogon/sets` (npm 2.0.0)** | YES but frozen at 2021-07-02 (Gen 8, no SV) | No | No | YES by format+gen | **UNLICENSED** | No — but unusable for SV |
| **`@pkmn/sets` (npm 5.2.0)** | No — parser only, ships no data | No | No | n/a | MIT | n/a |
| **`@pkmn/data` (npm 0.10.11)** | No — wrapper only, needs `@pkmn/dex` | via `@pkmn/dex` | via `@pkmn/dex` | YES `Generations` | MIT | No |
| **`smogon` (npm 5.0.1)** | YES — fetches from smogon.com at runtime | No | No | YES | MIT (code) | Yes — it *is* the scraper |
| **`data.pkmn.cc/stats/`** | No — usage statistics only | No | No | YES | README: "aggregated stats information is freely available in the public domain" | No — 147 MB total |

### Suggested build-time pipeline (three sources, ~5 MB embedded, zero scraping)

1. **Base stats + dex numbers + tiers, per generation** -> `@pkmn/dex` (`Dex.forGen(1..9)`), MIT, no scraping.
2. **Height** (absent from `@pkmn/dex`) -> `smogon/pokemon-showdown` `data/pokedex.ts` `heightm`, MIT.
3. **Sets** -> `https://data.pkmn.cc/sets/gen{1..9}.json`, 9 requests, 4.36 MB raw / 0.62 MB gzip, refreshed daily at 00:12 UTC.
4. *Optional prose* -> `https://data.pkmn.cc/analyses/gen{1..9}.json` (66 MB raw — prefer per-format files or gzip-at-rest).

Fall back to `POST /dex/_rpc/dump-pokemon` **only** for the formats `data.pkmn.cc` omits (Draft, Doubles UU, Doubles Ubers, 2v2, Camomons, Shared Power, National Dex Rotational) and only if PokeStats actually surfaces them — a targeted ~1,278-request crawl, not a full scrape.

Before shipping item 3 or 4 inside a downloadable binary, resolve section 7 with a human: the set/analysis text is asserted as Smogon-copyrighted by both Smogon's footer and by `pkmn/smogon`'s README, and no published term grants or denies redistribution.

---

## Artifacts captured during this investigation

All under `C:\Users\tisao\Desktop\PokeStats\.scratch\pokestats-v2\research\`:

- `robots.txt` — the 32-byte file
- `charizard.html` (885 KB), `charizard_dexsettings.json` (884 KB) — SSR blob
- `dp_charizard.json`, `dp_rb_charizard.json` — `dump-pokemon` responses (SV and RB)
- `basics_{rb,gs,rs,dp,bw,xy,sm,ss,sv,champions}.json` — `dump-basics` per generation
- `sets_gen{1..9}.json`, `sets_gen9ou.json`, `sets_index.json`, `an_gen9ou.json`, `an_index.json` — data.pkmn.cc dumps
- `pkmn_smogon_tree.json` — full `pkmn/smogon` git tree with file sizes
- `ps_pokedex.ts`, `ps_formatsdata.ts` — Showdown master data files
- `base_sv.txt` (1,278 base species), `sample_sv.txt` (the 25-species timing sample)
