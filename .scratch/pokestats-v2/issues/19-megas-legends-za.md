# 19 — Fonte de stats e sprites das megas de Legends: Z-A

Type: research
Status: resolved
Blocked by: —

## Question

O Cobbleverse habilita **93 megas** — as 48 canônicas mais ~45 vindas de Pokémon Legends: Z-A pelo
addon `ZA Megas`. Um Dataset montado a partir do Smogon ou do `pokemon-showdown` traz 48. Onde estão
os Base Stats, tipos e habilidades das ~45 restantes, e existe sprite para elas?

Sub-perguntas: quais megas exatamente o addon `ZA Megas` adiciona, e onde ele define os stats; se
`smogon/pokemon-showdown` já carrega essas formas; se o Smogon abriu dex para Legends: Z-A; se
existem sprites animados; e como essas formas se nomeiam nos dois esquemas de nome.

## Answer

**Relatório completo:** [`research/19-megas-legends-za.md`](../research/19-megas-legends-za.md) —
tabela de stats por forma e tabela de disponibilidade de sprite por forma.

**A premissa do ticket estava errada, a favor do projeto: um dataset derivado do Showdown NÃO para
em 48 megas.** O `data/pokedex.ts` principal do `smogon/pokemon-showdown` **já carrega as 45**,
marcadas com `isNonstandard: "Future"`. Não é preciso fonte extra para os stats.

### O roster, confirmado por cinco caminhos independentes

45 megas — 26 do jogo base, 19 de DLC (22 linhas). O Showdown marca com `isNonstandard: "Future"`;
o jar do `zamega` tem 44 arquivos `species_additions` e 48 blocos de forma; a Bulbapedia diz que a
DLC leva o total *"up to 93"*; as tabelas do Serebii têm 48 linhas; a PokéAPI resolve 47 de 48
slugs. Todos concordam. **48 canônicas + 45 = 93**, exatamente o número que *Qual roster o
Cobbleverse realmente tem* mediu — ou seja, o Cobbleverse está em paridade com o jogo, não
adicionando conteúdo fan.

### Stats batem; abilities não

Diff dos 48 blocos comparáveis entre `zamega-fabric-1.7.3.jar` e o `pokedex.json`: **0 divergentes,
0 sem correspondência.** Mas **as abilities divergem em 16 das 49 formas**. Decisão que sai daqui:
**stats e tipos do Showdown, abilities do jar.**

### Três casos especiais que enganam

`data/mods/gen9legends/pokedex.ts` — o mod que é de fato Legends: Z-A, 14 linhas — sobrescreve
apenas Starmie, Mawile e Medicham, embutindo Huge/Pure Power no Attack porque Z-A não tem Abilities.
**O Cobbleverse usa a linha National Dex, não essa.** Usar `gen9legends` deixaria esses três
errados.

### O addon

Nava's ZA Megas, de `yajatkaul` — 8,0M downloads no Modrinth, 3,1M no CurseForge. Existe repo
público em `github.com/yajatkaul/ZAMegas`, mas **32 dos 44 arquivos `species_additions` foram
apagados em 2026-08-05** — o conjunto completo só sai abrindo o jar, que é um zip comum. Schema
confirmado com a grafia britânica `defence` / `special_attack` / `special_defence`.

**Armadilha para o parser:** `primaryType` e `secondaryType` aparecem só nas 15 formas que mudam de
tipagem; as outras 34 herdam em silêncio.

### `champions` do Smogon não é Z-A

`dex/champions/pokemon/` responde 200, mas é **Pokémon Champions**, outro jogo. `dex/za/` e
`dex/legendsza/` dão 404. O `champions` cobre 35 das 49 formas, com tiers.

**Armadilha operacional:** `smogon.com/dex/*` devolve **400 para qualquer requisição sem
User-Agent de navegador**, em toda geração. O V1 não mandava User-Agent nenhum.

### Sprites são a lacuna de verdade

No `ani/` do Showdown: **9 animadas, 26 estáticas de um frame só, 14 ausentes.** O espelho `xy/` do
Smogon está mais atrasado (24 de 49) e **não é mais byte a byte idêntico** — Feraligatr-Mega
difere. Puxar do Showdown, não do espelho.

Nome segue `<species>-<formaEsmagada>` (`charizard-megax`), não totalmente esmagado.

A PokéAPI cobre o buraco: **HOME 48/48, official artwork 46/48.** Ou seja, para estas 45 formas o
sprite animado simplesmente não existe, e a decisão de fallback em *Pipeline de assets* deixa de ser
teórica.

A PokéAPI também tem os version groups `legends-za` e `mega-dimension` com os stats corretos, e o
`PokeAPI/api-data` foi atualizado no mesmo dia desta pesquisa.

### Duas correções a tickets anteriores

1. *Fontes de sprite animado, licença e volume* afirmou que os espelhos Showdown e Smogon são byte a
   byte idênticos. **Isso não vale universalmente** — vale para o dex clássico, não para estas formas.
2. Disponibilidade de sprite ou de entrada no dex é **mau indicador** para separar jogo base de DLC:
   erra em 9 formas. Zygarde é do jogo base e não tem nem sprite nem entrada.
