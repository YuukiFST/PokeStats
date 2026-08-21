# 04 — Estrutura, volume e termos dos dados de Set do Smogon

Type: research
Status: resolved
Blocked by: —

## Question

Como os Sets competitivos do Smogon são obtidos em escala, e qual o custo real de cobrir todos?

Sub-perguntas: a estrutura da página de uma Form (ex.: `/dex/sv/pokemon/charizard/`) — os Sets vêm
no payload SSR `dexSettings` como a lista que o V1 lia, ou vêm de um endpoint separado; existe
algum endpoint JSON estável ou é sempre regex sobre HTML; quais Dex Generations o site expõe hoje
e quais Formats existem dentro de cada uma; quantas requisições cobrem todas as Forms de uma Dex
Generation e qual rate limit / `robots.txt` / termos de uso o Smogon publica; volume em bytes do
resultado por Dex Generation; e a estrutura exata de um Set.

Cobrir explicitamente: o repo `smogon/pokemon-showdown` (MIT) e os pacotes `@pkmn/dex` /
`@pkmn/smogon` são fontes possivelmente melhores e de licença clara. Avaliar se substituem a
raspagem por completo — incluindo se trazem Sets de fato, ou só Base Stats e Tiers.

Também responder: o que os termos de uso do Smogon dizem sobre redistribuir os dados dentro de um
executável. Reportar o que as fontes dizem, sem dar parecer jurídico.

## Answer

**Relatório completo:** [`research/04-dados-sets-smogon.md`](../research/04-dados-sets-smogon.md).

**Veredito: raspar o Smogon é desnecessário.** Existe um pipeline de build de ~5 MB embutidos, com
zero raspagem, montado só com fontes MIT mais um dump estático mantido diariamente.

### O V1 leu o índice errado, não a fonte errada

Os Sets **estavam** no mesmo blob `dexSettings` o tempo todo. `injectRpcs` tem **três** entradas:
`[0]` `dump-gens`, `[1]` `dump-basics` — a que o V1 lia — e `[2]` `dump-pokemon`, que contém
`{languages, learnset, strategies, formeStrategies}`. **Os Sets vivem em
`injectRpcs[2][1].strategies`.**

E existe endpoint JSON-RPC de verdade, sem auth, cookie ou referer:

```
POST https://www.smogon.com/dex/_rpc/dump-pokemon
Content-Type: application/json
{"alias":"charizard","gen":"sv","language":"en"}
→ 200, application/json, 43.691 bytes   (20x menor que a página HTML)
```

Irmãos verificados: `dump-gens` `{}` → 400 B; `dump-basics` `{"gen":"sv"}` → 839.458 B. Ou seja, o
regex sobre HTML cru do V1 era desnecessário desde o começo.

### Dez Dex Generations, não nove — e `Champions` é uma delas

`dump-gens` devolve RB, GS, RS, DP, BW, XY, SM, SS, SV **e `Champions`**, com `/dex/champions/`
respondendo 200. Contagem de espécies: 151 / 251 / 392 / 550 / 747 / 881 / 1049 / 1215 / **1355** /
323.

**Base Stats mudam entre gerações — verificado**, então versionar stats por Dex Generation não é
teoria:

| Espécie | RB | GS | XY→SV |
|---|---|---|---|
| Gengar | 60/65/60/130/**130**/110 | .../**75**/110 | igual |
| Alakazam | 55/50/45/135/**135**/120 | .../**85**/120 | .../**95**/120 |
| Clefable | 95/70/73/**85**/85/60 | .../**90**/60 | .../**95**/90/60 |
| Golem | 80/**110**/130/55/**55**/45 | .../**65**/45 | 80/**120**/... |

Duas causas: o stat Special único da Gen 1, e os buffs de stat da Gen 6.

Formats por geração: SV **60**, SS **47**, SM **41**, XY **48**, Champions **42**. Cuidado: estar
em `formats` não significa ter análise publicada — Random Battle, CC1v1, SSB e Metronome não têm
moveset.

### Custo de raspar, se fosse preciso

`robots.txt` tem 32 bytes, na íntegra: `User-agent: Amazonbot` / `Allow: /`. Sem `User-agent: *`,
sem `Disallow`, sem `Crawl-delay`. Nenhum rate limit publicado, nenhum atingido em ~90 requisições.

| Abordagem | Requisições | Bytes por geração | Tempo serial |
|---|---|---|---|
| RPC `dump-pokemon` | 1.280 | ~22,6 MB | ~22 min |
| HTML + regex (método do V1) | 1.280 | ~1,13 GB | 40 min+ |
| `data.pkmn.cc/sets/gen9.json` | **1** | **1,09 MB cru / 150 KB gzip** | ~1 s |

### As fontes licenciadas

**`smogon/pokemon-showdown` (MIT).** `pokedex.ts` traz baseStats, num, types, abilities, `heightm`,
`weightkg` e cadeia evolutiva. `formats-data.ts` traz **Tiers**:
`charizard: { tier: "ZUBL", doublesTier: "(DUU)", natDexTier: "RU" }`. Base stats e tiers por
geração vivem em `data/mods/gen1..gen9*/` como overrides `inherit: true`. **Não tem Set curado
nenhum** — `random-battles/gen9/sets.json` são tabelas de geração de Random Battle, não análises do
dex.

**`@pkmn/dex` 0.10.11 (MIT).** Executado direto: `Dex.forGen(1).species.get("gengar").baseStats` dá
SpD **130**; `forGen(2)` dá **75**. Entrega base stats por geração, `num`, e os três campos de tier.
Duas ressalvas: **descarta `heightm`** e está defasado — diz Charizard SV `ZU` onde o master do
Showdown e o Smogon ao vivo dizem `ZUBL`.

**`data.pkmn.cc` é a resposta para os Sets.** 180 arquivos, 8,67 MB no total; as nove gerações somam
**4.358.358 B crus / 618.041 B em gzip**. Atualizado **diariamente às 00:12 UTC**. Fidelidade
conferida: o set `gen9.json → Charizard → pu` é byte a byte igual ao do RPC ao vivo.

Lacuna dele: cobre 32 dos 60 formats de SV. Faltam confirmadamente `gen9draft`, `gen9doublesuu`,
`gen9doublesubers`, `gen92v2doubles`, `gen9camomons`, `gen9sharedpower`,
`gen9nationaldexrotational`, `gen9ssb`, `gen9metronomebattle`. E **não traz base stats, dex number
nem tier**, por decisão de projeto.

Dois becos sem saída: `@smogon/sets` 2.0.0 é **UNLICENSED** e parou em 2021 (Gen 8, sem SV);
`@pkmn/sets` é só parser, não embarca dado.

### Estrutura de um Set

**Cru do Smogon** (`strategies[].movesets[]`): `name, pokemon, shiny, gender, levels[],
description (HTML), abilities[], items[], teratypes[], moveslots, evconfigs[], ivconfigs[],
natures[]`. `moveslots` são 4 slots, **cada um uma lista de alternativas** — é isso que a barra do
"Dragon Claw / Roost" significa. Hidden Power carrega o tipo no slot; todo outro move tem
`"type": null`.

**Compacto do pkmn**, com censo exaustivo de campos sobre 9 gerações / 180 arquivos / 19.582 sets —
**oito campos e nenhum outro**: `moves` (sempre lista), `item`, `nature`, `evs`, `ability`, `ivs`,
`teratypes`, `level`. Regra de codificação uniforme: **escalar = opção única, array = alternativas
separadas por barra**. EVs e IVs são dicts esparsos com zeros omitidos; **array de dicts** significa
que o Smogon publicou spreads alternativos. `ivs` ausente = todos 31. `gender`, `shiny`, `happiness`
e a descrição por set são descartados.

**Bug de qualidade a limpar na build:** `teratypes` aparece em sets pré-Gen-9 (`gen4 Quagsire pu
"Defensive"` tem `"teratypes":"Water"`) — artefato de entrada do lado do Smogon.

### Termos de uso, verbatim

- `robots.txt` completo: `User-agent: Amazonbot` / `Allow: /`. Não diz nada sobre reuso.
- Rodapé do site: *"All guides and strategy information are © 2004 Smogon.com and its contributors.
  Pokémon is © 1995 Nintendo."*
- `smogon.com/forums/help/terms/` é o termo do fórum XenForo e **não trata de raspagem, acesso
  automatizado, redistribuição ou uso comercial**. Não há página de ToS ou de licença de dados no
  site.
- README do `pkmn/smogon`: *"Smogon does not officially provide any API for third party
  developers…"* e *"While this project's code is distributed under the terms of the MIT License and
  the aggregated stats information is freely available in the public domain, **the set and analysis
  data is copyrighted by Smogon and its contributors.**"*
- `smogon/pokemon-showdown`: MIT puro, sem ressalva sobre dados.

### Pipeline recomendado — ~5 MB embutidos, zero raspagem

1. Base stats, dex numbers e tiers por geração, de **`@pkmn/dex`** (MIT).
2. **Altura** do `data/pokedex.ts` do Showdown (`heightm`), porque o `@pkmn/dex` descarta.
3. Sets de **`data.pkmn.cc/sets/gen{1..9}.json`** — 9 requisições, 4,36 MB crus / 0,62 MB gzip.
4. Prosa de análise opcional, de `/analyses` (66 MB crus — preferir por format, ou gzip em repouso).

Cair para o RPC `dump-pokemon` só nos formats que o pkmn omite, e só se o PokeStats os expuser.

**Item aberto para decisão humana:** o texto de set e análise é declarado como copyright do Smogon
tanto pelo rodapé do site quanto pelo README do `pkmn/smogon`, e nenhum termo publicado concede nem
nega embutir isso num binário distribuído. Mesma forma do problema dos sprites, decidido em
*Pipeline de dados* e *Pipeline de assets*.
