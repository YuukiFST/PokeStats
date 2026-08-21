# 01 — Qual roster o Cobbleverse realmente tem

Type: research
Status: resolved
Blocked by: —

## Question

Se o Dataset embutir Gen 1–9 completo com formas regionais, megas e Gmax, o quanto isso bate com o
que um jogador de Cobbleverse vê no jogo, e qual é a divergência?

Sub-perguntas: quais gerações o Cobblemon implementa hoje e em que versão; quais formas regionais;
se megas / Gmax / primals existem (mod base ou addon); se o modpack Cobbleverse restringe ou
adiciona Pokémon em relação ao Cobblemon; se os Base Stats são os de jogo ou rebalanceados, e onde
vivem no repo; quais mecânicas (Tera, Dynamax, Z-moves) e qual geração de tabela de tipos; contagem
aproximada de Species + Forms. Uma seção curta comparando com Pixelmon.

Fontes de alta confiança primeiro: repo `Cobblemon/Cobblemon` (JSON de species), wiki e site
oficiais, páginas CurseForge/Modrinth do Cobbleverse. Wiki comunitária e Reddit só como último
recurso e rotulados como tal.

## Answer

Um dataset Gen 1–9 vanilla bate ~99% com o que um jogador de Cobbleverse 1.7.42 vê. As
divergências são todas **aditivas** — o Cobbleverse tem coisa a mais, nunca a menos.

**Roster.** Cobblemon 1.7.3 (2026-01-31) implementa as 1025 Species, sem corte de geração —
contado nos arquivos JSON de species do repo. O Cobbleverse 1.7.42 (2026-07-21) empacota o
Cobblemon 1.7.3 sem modificar e **não remove nada**: sem blacklist de espécie, sem entrada de dex
removida. O gating é por **level cap** (`initialLevelCap = 20`, escalando com a série de treinadores
em `overrides/config/rctmod-server.toml`), não por restrição de roster — toda Species é visível
desde o começo.

**Base Stats são vanilla, bit a bit.** Comparação dos 1166 blocos de stat do Cobblemon contra
`play.pokemonshowdown.com/data/pokedex.json`: **1166 iguais, 0 divergentes**, 2 sem mapeamento só
por nome (`Zygarde-10%-C`, `Eiscue-Noice-Face`). O Cobbleverse sobrescreve 14 arquivos de species,
e os 14 mantêm os stats vanilla — as sobrescritas são de spawn e evolução.

**Formas.** As quatro regionais completas. 48 megas, 34 entradas G-Max, 2 primals — todas com stats
corretos nos dados. O mod base tem os dados mas **não** o gatilho: nenhum item de mega stone,
Tera Orb, Dynamax Band ou Z-Crystal existe no lang file base. Os gimmicks vêm de addons que o
Cobbleverse empacota (`Mega Showdown`, `ZA Megas`), e a config do pack liga todos:
`"mega": true, "zMoves": true, "teralization": true, "dynamax": true`.

**A divergência que importa: 93 megas, não 48.** O Cobbleverse soma as 48 canônicas com ~45 megas
de Pokémon Legends: Z-A pelo addon `ZA Megas`. Um dataset vindo do Smogon traz 48. Isso virou o
ticket *Fonte de stats das megas de Legends: Z-A*.

**Divergências menores.** ~14 aspectos `-Bias` do Cobblemon (marcadores internos de herança de
breeding em pré-evoluções, não Pokémon) devem ser ignorados. Três formas não-canônicas do
Cobbleverse — Armored Mewtwo, Shadow Lugia, Shadow Calyrex — ficam de fora ou marcadas como
desconhecidas.

**Mecânica: Gen 9.** `BattleFormat.kt` fixa `gen: Int = 9` e o motor é um Pokémon Showdown embutido
(`data/cobblemon/showdown.zip`), então a tabela de tipos é a Gen 6+ com Fairy.

**Contagem.** 1025 Species + 366 entradas de forma = 1391 entradas; 1168 blocos distintos de base
stat (1025 + 143 formas com stats próprios). Com os extras do Cobbleverse: ~1440 entradas,
~1215 blocos.

**Fato operacional.** O repo do Cobblemon está no **GitLab**, não no GitHub —
`gitlab.com/cable-mc/cobblemon` (project id 31496946). `github.com/Cobblemon/Cobblemon` dá 404.
As chaves do JSON usam grafia britânica: `defence`, `special_attack`, `special_defence`.

**Pixelmon, para comparação:** 9.4.0 (2026-08-17), 1025/1025 Species, regionais 100%, G-Max 33/33,
mas megas só 54/93 nativamente. Confirma que a escolha de mod não muda Base Stats.
