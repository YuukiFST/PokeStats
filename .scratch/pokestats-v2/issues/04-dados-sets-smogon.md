# 04 — Estrutura, volume e termos dos dados de Set do Smogon

Type: research
Status: claimed
Blocked by: —

## Question

Como os Sets competitivos do Smogon são obtidos em escala, e qual é o custo real de cobrir todos?

Sub-perguntas: a estrutura da página de uma Form (ex.: `/dex/sv/pokemon/charizard/`) — os Sets vêm
no payload SSR `dexSettings` como a lista que o V1 lia, ou vêm de um endpoint separado; existe
algum endpoint JSON estável ou é sempre regex sobre HTML; quais Dex Generations o site expõe hoje
(`rb`, `gs`, `rs`, `dp`, `bw`, `xy`, `sm`, `ss`, `sv`) e quais Formats existem dentro de cada uma;
quantas requisições cobrem todas as Forms de uma Dex Generation e qual rate limit / `robots.txt` /
termos de uso o Smogon publica; volume em bytes do resultado por Dex Generation; e a estrutura
exata de um Set (moves com alternativas, item, ability, nature, EVs, IVs, Tera).

Cobrir explicitamente: o repo `smogon/pokemon-showdown` (MIT) e os pacotes `@pkmn/dex` /
`@pkmn/smogon` são fontes possivelmente melhores e de licença clara. Avaliar se substituem a
raspagem por completo — incluindo se trazem Sets de fato, ou só Base Stats e Tiers.

Também responder: o que os termos de uso do Smogon dizem sobre redistribuir os dados dentro de um
executável. Reportar o que as fontes dizem, sem dar parecer jurídico.
