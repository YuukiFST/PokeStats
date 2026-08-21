# 07 — Escopo do Dataset: quais Dex Generations, Formats e Forms

Type: grilling
Status: resolved
Blocked by: 01, 04, 19

## Question

O que exatamente entra no Dataset embutido?

Três eixos independentes, decididos juntos:

1. **Dex Generation** — o V1 lia só `sv`. O usuário pediu `xy`, `sm`, `ss` e `Champions`, e
   *Estrutura, volume e termos dos dados de Set do Smogon* confirmou que **as quatro existem**: o
   Smogon expõe dez gerações, `Champions` inclusive (323 espécies). Também confirmou que **Base
   Stats de fato diferem entre gerações** — Gengar tem SpD 130 em RB e 75 em GS —, então embutir
   várias significa versionar stats por geração, não só Sets. Quais entram?
2. **Format** — quais rulesets têm Sets embutidos (OU, UU, Ubers, LC, Monotype, Doubles, VGC).
   Multiplica volume e requisições.
3. **Form** — confirmar contra o achado de *Qual roster o Cobbleverse realmente tem*: quais Form
   Kinds entram (`mega`, `gmax`, `regional`, `battle-only`, `cosmetic`), lembrando que R8 já corta
   CAP e que formas cosméticas podem inflar o dex sem informação nova.

Sair com números: quantas Forms, quantos Sets, quantos MB.

## Answer

O Dataset embutido tem **1.325 Forms**, **19.164 Sets** em **162 pares (Dex Generation, Format)**.

> **Corrigido pelo ticket 08 — Modelo de domínio e schema do Dataset (issue #9).**
> Os números originais eram 19.524 Sets em 168 pares, e mantinham o Format `cap`.
> O `cap` só contém Forms CAP, que o R8 corta, então 238 dos seus 360 Sets ficavam apontando para
> Forms inexistentes. Cortá-lo inteiro leva junto 122 Sets de Pokémon reais jogados no metagame
> CAP — pelo mesmo argumento que o `letsgoou` já tinha recebido neste ticket.
> Depois do corte, as **1.118 Forms que possuem Set têm todas linha na tabela final**: nenhum Set
> órfão. O payload bruto de Sets pós-corte mede 3.815.968 B minificados e 364.304 B em brotli.
> A projeção de 4,68 MB abaixo era do schema esboçado aqui e foi superada pelo schema fixado no
> ticket 08; o tamanho definitivo sai do coletor, no ticket 09 — Pipeline de dados (issue #10).

Projeção original, mantida como registro: **4,68 MB** de JSON minificado — 0,66 MB em gzip,
0,43 MB em brotli. Os Sets seriam 4,34 MB desses 4,68 MB; todo o resto somado não passava de 450 KB.
Contra o payload de sprite de 155–310 MB medido em *Fontes de sprite animado*, dado é ruído,
e foi esse fato que decidiu quase todos os eixos abaixo.

### Eixo 1 — Dex Generation: as nove, `rb` a `sv`

Entram `rb`, `gs`, `rs`, `dp`, `bw`, `xy`, `sm`, `ss`, `sv`.
O custo marginal de ir de quatro gerações para nove é zero em requisições — o `data.pkmn.cc`
entrega uma geração inteira por arquivo, então são 9 requisições de qualquer maneira — e 1,4 MB
em bytes.
O incômodo real de ter Sets de `rb` numa busca é filtro padrão da UI, decisão de *Arquitetura de
informação*, não motivo para cortar dado que não dá para re-obter sem raspar de novo.

**`champions` fica de fora**, contrariando o pedido original do ticket.
O research mediu o que ela custa e o que ela entrega:
202 Sets, 77 species, 4 Formats (OU 77, Battle Stadium Singles 68, VGC26 Regulation M-A 42,
VGC26 Regulation M-B 15), e nenhum endpoint em massa — `data.pkmn.cc` dá 404 em toda variação,
então são 81 requisições contra as 9 que trazem gen1–gen9 inteiras.
A forma do Set também é outra: `moveslots`/`items`/`natures`/`abilities`/`evconfigs` em vez de
`moves`/`item`/`nature`/`evs`.
E `evconfigs` **não são EVs** — são Stat Points de Champions, somando 65 ou 66 com máximo 32 por
stat, contra ~508 e máximo 252 de um EV spread.
Enfiar isso num campo tipado como EV produz um spread plausível e completamente errado.
Pagar um tipo novo no modelo de domínio, um segundo scraper e um segundo parser por 1,03% do
corpus, vindo de um jogo que não é o que o Cobbleverse roda (motor Gen 9, `BattleFormat.kt` fixa
`gen: Int = 9`), não se sustenta.
O `basics_champions.json` continua em uso — ver Eixo 3.

**Base Stats não são versionados como eixo do aplicativo.**
Existe uma Canonical Table keyed por Form, com os valores de `sv` mais as Megas de Z-A, porque
ranking, comparação, BST, Defensive Profile e Team Builder têm de concordar com o jogo do usuário.
Os valores históricos viram Override keyed por (Form, Dex Generation) e aparecem só dentro de um
Set daquela geração.
A conta que sustenta isso: a deriva de stats entre gerações consecutivas é 111 Forms em `rb`→`gs`
(split do Special), **0** em `gs`→`rs`→`dp`→`bw`, 29 em `bw`→`xy`, 26 em `xy`→`sm`, 2 em `sm`→`ss`
(Aegislash) e 5 em `ss`→`sv` (Cresselia, Zacian ×2, Zamazenta ×2) — **173 linhas de override no
total**.
Types seguem o mesmo desenho, com 29 overrides (Magnemite e Magneton em `rb`→`gs`, as formas do
Rotom em `dp`→`bw`, a linha da Clefairy e mais em `bw`→`xy`; depois de XY, zero).
Abilities **não** são versionadas: a deriva ali é quase toda ausência, não mudança — Gen 1 e 2 não
tinham abilities e Gen 5 adicionou as hidden — e cada Set já traz sua própria `ability` como string
justamente nas gerações em que isso importa (7.899 dos 19.582 Sets).

Tier é guardado para as nove gerações, 6.250 pares (Form, Dex Generation), mas o badge exibido na
Form é o de `sv`.
Um badge que muda de valor conforme um filtro distante é estado implícito, e o histórico aparece
onde é relevante: no contexto de um Set.

### Eixo 2 — Format: todos, classificados, menos um

Todos os Formats entram, porque o arquivo por geração do `data.pkmn.cc` já os contém — cortar
Format não economiza um byte nem uma requisição.
Cada Format ganha uma classe (`singles-tier`, `doubles`, `vgc`, `other-metagame`, `special/retro`)
e o filtro padrão da UI mostra singles-tier, VGC e Doubles.
Isso resolve por apresentação o problema real dos Other Metagames — `godlygift` (237 Sets),
`stabmons` (225), `almostanyability` (132), `partnersincrime` (63), `inheritance` (55),
`mixandmega` (53), `purehackmons`, `balancedhackmons`, `camomons` — cujos Sets pressupõem regras
que não existem no Cobbleverse.

**Duas exceções saem inteiras: `letsgoou`, 58 Sets, e `cap`, 360 Sets** (o `cap` foi acrescentado
pelo ticket 08 — ver a nota de correção no topo).
Ele descreve Let's Go Pikachu/Eevee, que não é mainline nem Cobbleverse, e as duas Forms mascote
dele (`Eevee-Starter`, `Pikachu-Starter`, 1 Set cada) são as únicas do corpus inteiro sem linha na
Canonical Table.
Manter 56 Sets de um Format cujas mascotes foram descartadas seria uma coerência estranha.

### Eixo 3 — Form: 1.325

A tabela candidata tem 1.356 entradas: 1.273 de `sv` com CAP já removido por R8 (82 entradas),
34 Gmax vindos de `ss` (a única geração onde eles existem) e 49 entradas de forma das Megas de
Legends: Z-A.

**Regra de corte, mecânica e verificável:** uma Form é cortada se repete BaseStatSpread, Types
**e** Abilities da sua forma-pai imediata **e** não tem nenhum Set em nenhum par (Dex Generation,
Format).
A regra é transitiva — cortar uma Form corta as que derivam dela — e tem **uma** exceção: `gmax`.
Os 34 Gmax são stat-idênticos à Base Form por construção (Gmax no Showdown é aparência mais G-Max
Move, não stats), mas 10 deles têm Set próprio na `gen8`, e uma dex com 10 Gmax e 24 faltando é
pior que qualquer extremo.
Como o Cobbleverse liga `"dynamax": true` e traz as 34 entradas, todas entram.

A regra corta **31 Forms**:
os 7 bonés do Pikachu mais `Pikachu-Alola` e `Pikachu-Original`, `Vivillon-Fancy`,
`Vivillon-Pokeball`, os 4 drives do Genesect, `Keldeo-Resolute`, `Poltchageist-Artisan`,
`Sinistea-Antique`, `Polteageist-Antique`, `Squawkabilly-Blue`, `Magearna-Original`,
`Tatsugiri-Droopy`, `Tatsugiri-Stretchy`, `Dudunsparce-Three-Segment`, `Cherrim-Sunshine`,
`Mimikyu-Busted`, `Cramorant-Gulping`, `Cramorant-Gorging`, `Morpeko-Hangry`,
e por transitividade `Magearna-Original-Mega`, `Tatsugiri-Droopy-Mega`, `Tatsugiri-Stretchy-Mega`.

As cinco formas `battle-only` da lista caem porque a medição mostrou que elas não diferem em nada —
nem stats, nem tipos, nem abilities — e não têm Set.
`Meowstic-F-Mega` e `Meowstic-M-Mega` ficam, apesar de idênticas entre si, porque `Meowstic-F` e
`Meowstic-M` ficam: as abilities delas divergem de verdade, e tirar uma das duas deixaria uma forma
de gênero sem Mega enquanto a outra tem.
`Basculin-Blue-Striped`, `Basculin-White-Striped`, `Rockruff-Dusk`, `Greninja-Bond` e
`Toxtricity-Low-Key` também ficam, todas por ability própria.

**As 49 formas de Legends: Z-A entram como Form Kind `mega`**, com cada campo vindo da fonte que é
verdade para ele:

| Campo | Fonte | Cobertura |
|---|---|---|
| Base Stats, Types | `data/pokedex.ts` do `smogon/pokemon-showdown` | 49/49 |
| Abilities | `zamega-fabric-1.7.3.jar`, `data/cobblemon/species_additions/` | 49/49, diverge do Showdown em 16 |
| Tier | `dump-basics` de `champions` | **35/49**, `null` nas outras 14 |

O achado que fixou a última linha: `basics_champions.json` tem **76 Megas**, e 35 das 45 de Z-A
estão lá com dado nativo do Smogon, Tier inclusive.
Conferido contra a tabela do research 19 e bate exato — `Dragonite-Mega` Dragon/Flying
91/124/115/145/125/100, BST 700, Multiscale, Tier OU; idem `Clefable-Mega`, `Hawlucha-Mega`,
`Scolipede-Mega`, `Eelektross-Mega`, `Feraligatr-Mega` e `Emboar-Mega`.
As 14 sem Tier são `Absol-Mega-Z`, `Garchomp-Mega-Z`, `Lucario-Mega-Z`, `Baxcalibur-Mega`,
`Darkrai-Mega`, `Golisopod-Mega`, `Heatran-Mega`, `Magearna-Mega`, `Magearna-Original-Mega`,
`Tatsugiri-Curly-Mega`, `Tatsugiri-Droopy-Mega`, `Tatsugiri-Stretchy-Mega`, `Zeraora-Mega` e
`Zygarde-Mega`.
O badge dessas 35 tem de dizer de onde veio — `OU · Champions` — porque `sv` não tem opinião sobre
elas e "OU" sozinho faz o usuário achar que é OU no jogo dele.

Stats vêm do Showdown e não do jar porque as três fontes empatam (o research 19 diffou 48/48, 0
divergências) e uma URL pública é melhor dependência de pipeline que um jar do Modrinth.
Abilities vêm do jar porque ele é a verdade do modpack e diverge do Showdown em 16 formas.

**As três formas não-canônicas do Cobbleverse ficam de fora**: `Armored Mewtwo`, `Shadow Lugia` e
`Shadow Calyrex`.
Não existem em jogo nenhum, só no pack — R8 já fixou o princípio, e diferente das Z-A elas não têm
nem Tier, nem Set, nem sprite no Showdown.
Os ~14 aspectos `-Bias` do Cobblemon são marcadores internos de herança de breeding, não Pokémon,
e são ignorados.

### Eixo 4 — Tabelas de apoio: nome e tipo de move, só

Entram os 872 moves como par (nome, Type), para pintar o ícone de tipo ao lado do move num Set,
mais os nomes de 525 items, 313 abilities e 25 natures.
**Não** entram descrição, power, accuracy nem category.
Descrição e efeito seriam agradáveis, mas power/accuracy são exatamente o que a seção *Fora de
escopo* do mapa nomeia ao descartar a Calculadora de dano.
Embutir agora não constrói a calculadora — apaga a fronteira e convida o próximo ticket a
atravessá-la.

### Achado operacional para o *Modelo de domínio*

Os nomes do `data.pkmn.cc` e do `dump-basics` do Smogon **não casam por string**.
Apóstrofo curvo contra reto (`Farfetch’d` contra `Farfetch'd`, idem `Sirfetch’d` e
`Farfetch’d-Galar`), acento (`Flabébé` contra `Flabebe`), separador (`Necrozma-Dusk-Mane` contra
`Necrozma-Dusk Mane`), e `Meowstic` avulso contra `Meowstic-M`/`Meowstic-F`.
A chave de junção tem de ser um slug canônico — minúsculas, sem acento, só alfanumérico — nunca o
nome exibido.
Normalizando assim e aceitando `sv` mais os 34 Gmax de `ss` como Canonical Table, das 1.159 Forms
com Set em alguma geração sobram exatamente 3 órfãs, e as três são explicadas: `Meowstic` é alias
de `Meowstic-M`, `Eevee-Starter` e `Pikachu-Starter` saem com o `letsgoou`.

### Correção a uma decisão anterior

O research 01 concluiu que o Cobbleverse empacota o addon `ZA Megas`, e estava certo, mas o
raciocínio dele não era prova — leu `"mega": true` num config e fechou uma contagem.
A prova é o manifest: `modrinth.index.json` de dentro do `COBBLEVERSE 1.7.42.mrpack` (238.975.006
bytes, projeto Modrinth `Jkb29YJU`, versão `4SKGla61`) lista `mods/zamega-fabric-1.7.3.jar` com
`env` `required` em client e server, junto da sua dependência dura
`mega_showdown-fabric-1.8.4+1.7.3+1.21.1.jar`.
São 168 arquivos no manifest, 136 mods.
`Mega Dragonite` está no jar como
`data/cobblemon/species_additions/generation1/dragonite_mega.json`, com modelo e textura próprios.
Um jogador que instala só o Cobbleverse vê as 93 Megas e os 34 Gmax, sem instalar mais nada.
Correção menor ao research 19: são 45 Megas de Z-A sobre **44** species, porque Raichu tem duas
pedras (`raichunitex.json`, `raichunitey.json`).
