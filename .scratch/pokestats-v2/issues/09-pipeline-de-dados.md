# 09 — Pipeline de dados: coletor de build e artefato embutido

Type: grilling
Status: resolved
Blocked by: 07, 08

## Question

Como o Dataset é produzido, validado e embutido, dado que o aplicativo nunca acessa a rede (R2)?

Decidir: se a fonte é raspagem do Smogon ou um pacote licenciado como `@pkmn/*` (conforme
*Estrutura, volume e termos dos dados de Set do Smogon*); onde vive o coletor (ferramenta de build
separada, nunca embarcada); como ele evita a fragilidade que matou o V1 — regex sobre HTML cru e
índices mágicos `injectRpcs[1][1]`, que quebram na primeira mudança de layout e reportam só
"Could not find data on the website."; que validação roda sobre o artefato antes de virar release
(contagem de Forms, ausência de CAP, integridade da tabela de tipos, nenhuma Form sem stats); como
o Dataset é versionado; e o que acontece com dados do usuário quando o Dataset muda entre versões.

Definir também o comportamento quando a coleta falha parcialmente: build quebra, ou artefato sai
incompleto com aviso.

**Fatos já fechados que este ticket herda:** *Estrutura, volume e termos dos dados de Set do Smogon*
mostrou que raspagem é dispensável — `@pkmn/dex` (MIT) dá stats por geração e tiers,
`data.pkmn.cc/sets/gen{1..9}.json` dá 19.582 Sets em 9 requisições, e a altura sai do `heightm` do
`pokedex.ts` do Showdown. *Fonte de stats e sprites das megas de Legends: Z-A* acrescentou: as 45
megas Z-A já estão no `pokedex.ts` marcadas `isNonstandard: "Future"`, mas **as abilities delas
precisam vir do jar do addon**, que diverge do Showdown em 16 de 49 formas, e o parser tem de tratar
`primaryType`/`secondaryType` como herdados quando ausentes. Se alguma raspagem sobrar como
fallback, ela **precisa mandar User-Agent de navegador** — `smogon.com/dex/*` devolve 400 sem ele,
que é uma das razões pelas quais o coletor do V1 era frágil.

## Answer

### Resumo

O coletor é **TypeScript no mesmo repo**, em `tools/dataset/`, com um módulo profundo puro no meio e
I/O só nas pontas.
As fontes cruas ficam atrás de um seam `SourceReader`, e as respostas cruas são **commitadas**.
**Falha parcial quebra o build, sempre** — é isso que autoriza o ticket 08 a não validar nada no boot
do aplicativo.
Cada campo tem **uma** fonte, sem fallback silencioso, e o Tier é resolvido por uma **escada de
quatro degraus mais `null`**, medida forma a forma nas 1.325 Forms finais.
**Nenhuma biblioteca de validação entra** — as asserções de domínio já derrubam o build com mensagem
melhor, e o único buraco que elas não cobriam virou asserção nova.
O artefato sai em `public/dataset/{core,sets}.json`, buscado com `fetch` em runtime e nunca importado
como módulo.
`dataset:fetch` e `dataset:build` são **dois comandos**, o que torna "o build não usa rede" um fato
estrutural em vez de uma promessa.

### 1. Onde vive o coletor

**TypeScript, mesmo repo, `tools/dataset/`.** Não é pacote separado nem script Python ao lado.

Três razões, em ordem de peso:

As fontes do Showdown **são** módulos TypeScript — `pokedex.ts` e `formats-data.ts` não são JSON, são
código com tipos.
Os tipos do schema do ticket 08 são TS e precisam ser **os mesmos** que o aplicativo consome; duas
declarações do mesmo schema em duas linguagens divergem na primeira mudança.
E mesmo repo faz artefato e consumidor **versionarem juntos** — que é exatamente o que torna segura a
decisão do ticket 08 de o aplicativo não validar nada no boot.
Um coletor fora do repo transformaria essa decisão numa aposta.

O coletor **nunca é embarcado**. Vive em `tools/`, fora de `src/`, e o `tauri.conf.json` não o inclui
em recurso nenhum.

### 2. Fontes e o seam `SourceReader`

Um seam `SourceReader` recebe arquivo cru e devolve **registros de fonte tipados**.
Atrás dele ficam **os arquivos crus**, não um pacote.

Os arquivos crus entregam tudo que o ticket 08 pediu, incluindo os campos de que a regra de corte e a
derivação de `traits` dependem: `placeholderFor`, `canGigantamax`, `battleOnly`, `changesFrom`,
`baseSpecies`, `forme`, `num`.

**`@pkmn/dex` não foi escolhido porque a superfície dele não pôde ser medida.**
Medir exigiria `npm install`, proibido na sessão em que a decisão foi tomada, e este projeto não
adota dependência cuja superfície ninguém olhou.
Isso não é veredito contra o pacote: com o seam no lugar, trocar o adaptador depois é **uma classe**,
não uma reescrita, e a suíte de regras nem toma conhecimento.

### 3. Os dados do jar `zamega`

**Extrair uma vez e commitar o JSON derivado**, com a versão do jar e o checksum ao lado.

O jar é mod de Minecraft, não API: não tem contrato de estabilidade, não tem versionamento semântico
e ninguém promete que o layout interno sobrevive à próxima release.
E o alvo é fixo — o Cobbleverse 1.7.42 fixa **`zamega-fabric-1.7.3.jar`**, enquanto a mais recente do
addon é 1.7.6.
Reextrair a cada build acoplaria o build a um artefato que não devia mudar e que, se mudar, não devia
mudar em silêncio.

O checksum ao lado é o que faz uma troca de jar aparecer como diff, e não como stat diferente numa
tabela.

### 4. Respostas cruas são commitadas

Todas as respostas de rede vão para o repo, cruas.

É o que `research/` já é na prática, e paga três coisas: build **determinístico** a partir do repo,
diff legível na PR do coletor quando o upstream mexe em alguma coisa, e asserção que falha apontando
**qual entrada mudou** em vez de "o número não bate".

O repo é privado, o que cobre a ressalva de copyright que o ticket 04 levantou sobre o texto dos Sets
do Smogon.

### 5. Coleta parcialmente falha quebra o build

**Sempre, sem opção de continuar.** Não existe flag `--allow-partial`, nem artefato incompleto com
aviso, nem campo faltando preenchido com valor neutro.

Isso não é rigor por gosto: o ticket 08 só pôde dispensar validação no boot do aplicativo porque o
**build** garante o artefato.
Se o build pode emitir artefato incompleto, a validação volta para o runtime e o custo de abertura
volta junto.

O V1 falhava do jeito oposto — capturava a exceção, mostrava "Could not find data on the website." e
seguia com dado pela metade.

### 6. Fonte por campo, uma fonte por campo, sem fallback silencioso

| campo | fonte |
|---|---|
| Base Stats, Types, `num`, `forme`, `baseSpecies`, altura | `pokedex.ts` do Showdown |
| Abilities das Forms comuns | `pokedex.ts` do Showdown |
| Abilities das 49 Megas de Z-A | JSON derivado do jar `zamega` (seção 3) |
| Identificação das Megas de Z-A | `isNonstandard: "Future"` no `formats-data.ts` |
| Sets | `data.pkmn.cc/sets/gen{1..9}.json` |
| Tier | escada da seção 7 |
| Lista e gerações de Format | array `formats` do `dump-basics` |
| Classe de Format | constante de curadoria no coletor (seção 15) |

**Sem fallback silencioso**: quando a fonte designada não tem o campo, o coletor não vai procurar em
outra e não inventa valor — ou existe degrau explícito e medido, como no Tier, ou a asserção quebra o
build.

### 7. A regra de Tier, em quatro degraus mais `null`

A regra da primeira rodada tinha dois degraus, ganhou um terceiro na medição seguinte, e **ganhou um
quarto aqui** por causa de um buraco que ninguém tinha visto.

```
1. formats-data.ts        .tier          quando != "Illegal"
2. formats-data.ts        .natDexTier
3. basics_sv.json         .formats[0]    ignorando o literal "National Dex"
4. basics_champions.json  .formats[0]
5. null
```

Aplicada às 1.325 Forms finais:

| degrau | fonte | Forms |
|---|---|---|
| 1 | `formats-data.tier` | 816 |
| 2 | `formats-data.natDexTier` | 378 |
| 3 | `basics_sv.formats` | 37 |
| 4 | `basics_champions.formats` | 42 |
| 5 | `null` | 52 |
| | **total** | **1325** |

#### Por que o degrau 3 existe

**52 Forms do `basics_sv` não têm entrada nenhuma no `formats-data.ts`** — não é `tier: "Illegal"`, é
ausência do objeto.
São 27 Species, com os 17 tipos do `Arceus` e as 4 `Ogerpon-Tera` respondendo por 21 delas, mais
`Terapagos-Terastal`, `Basculin` listrado, `Squawkabilly`, `Meowstic-F`, `Meowstic-M`,
`Greninja-Bond`, `Toxtricity-Low-Key`, `Zarude-Dada` e outras.

A escada de três degraus lia `tier` e `natDexTier` de um objeto inexistente e caía direto em `null`.
O resultado visível seria `Arceus` marcado `Uber` e `Arceus-Fire` sem Tier nenhum, na mesma tabela.

O `basics_sv` carrega o Tier dessas Forms, e **concorda com o `formats-data` onde os dois existem:
824 Forms comparáveis, 824 iguais, zero divergência**.
O degrau só dispara onde o `formats-data` não tem entrada — não é fonte concorrente, é a mesma
informação preenchendo o buraco que a outra deixou.

O literal **`"National Dex"` tem de ser ignorado**: ele aparece em 397 das 1.273 entradas do
`basics_sv` e não é um Tier, é a seção do dex em que a Form está listada.
Tratá-lo como Tier carimbaria "National Dex" em toda mega clássica.

`basics_sv.json` já é fonte buscada — o ticket 07 usou, e o ticket 12 usa o array `formats` dele para
a tabela de Formats.
O degrau custa **zero requisição nova**.

#### Por que o degrau 3 vem antes do degrau 4

`Meowstic-F` e `Meowstic-M` estão nos dois dumps.
Num aplicativo cuja Canonical Table é `sv`, o Tier de SV ganha do Tier de Champions.

#### O degrau 4 não é restrito às Megas de Z-A

Ele resolve 42 Forms: **35 das 46 Megas de Z-A** que sobrevivem ao corte, e mais 7 que não são Z-A —
`Gourgeist-Large/Small/Super`, `Castform-Sunny/Rainy/Snowy` e `Aegislash-Blade`.

Foi considerado restringir o degrau a `isNonstandard === "Future"` e deixar essas 7 em `null`.
**Não foi feito**: filtrar fonte por procedência é caso especial disfarçado de regra, e o
`basics_champions` traz Tier de verdade nas 323 entradas dele — os valores são `UU` (255), `OU` (50),
`UUBL` (9), `Uber` (8) e `NFE` (1), sem nenhuma contaminação do tipo `"National Dex"`.

#### A premissa dos "56 megas clássicos" era falsa

A rodada anterior anotou que 56 megas clássicos ficariam sem Tier e pediu confirmação.
A medição desfaz a pergunta: **nenhum mega clássico está nesse grupo**.

O balde de 56 era `tier: "Illegal"` **e** `isNonstandard: "Past"` **e** sem `natDexTier`, e é composto
de 34 Gmax, 12 formas Totem, 7 formas de fantasia do Pikachu e do Pichu, mais `Greninja-Ash`,
`Floette-Eternal` e `Eternatus-Eternamax`.
Vinte e uma delas nem entram na tabela candidata — Totem e Cosplay não estão no `basics_sv`.

**Os 48 megas clássicos da tabela final resolvem todos no degrau 2**, sem exceção.
Somados às 46 Megas de Z-A que sobrevivem ao corte, dão os 94 do trait `mega` da asserção A6.

#### As 52 Forms que terminam em `null`

| grupo | Forms |
|---|---|
| Gmax | 34 |
| Megas de Z-A fora do `basics_champions` | 11 |
| battle-only e variação de tamanho | 7 |

As 7 são `Pumpkaboo-Large/Small/Super`, `Darmanitan-Zen`, `Darmanitan-Galar-Zen`, `Greninja-Ash` e
`Wishiwashi-School`.
As 11 Megas de Z-A são `Absol-Mega-Z`, `Garchomp-Mega-Z`, `Lucario-Mega-Z`, `Heatran-Mega`,
`Darkrai-Mega`, `Zygarde-Mega`, `Golisopod-Mega`, `Magearna-Mega`, `Zeraora-Mega`,
`Baxcalibur-Mega` e `Tatsugiri-Curly-Mega` — reconciliando com o ticket 08, que já dissera que o
`champions` cobre 35 das 49 e o resto fica sem Tier.

`tier` fica **`null` no artefato**, nunca a string `"—"`.
Carimbar a string transformaria dado ausente em dado presente e quebraria qualquer filtro por Tier: a
UI decide como desenhar ausência, o Dataset só informa que não há.

A asserção de que **nenhuma Form sai com Tier `"Illegal"`** continua valendo.

### 8. Validação: nenhuma biblioteca

**Nenhuma.** Sem Zod, sem Valibot, sem Typebox.

As asserções da seção 16 rodam sobre o artefato **construído**, que fica a jusante de todo parse.
Qualquer deriva que importe aparece como `esperava 1325 Forms, vieram 1189` em vez de
`expected string at sets[3].item`.
O primeiro nomeia o problema no vocabulário do `CONTEXT.md`; o segundo nomeia o sintoma no
vocabulário do validador.
Num utilitário de build que roda um humano por vez, isso é a diferença entre diagnosticar em um
minuto e em vinte.

**A objeção honesta, e o que foi feito com ela.**
Asserção de contagem não pega deriva de campo que não muda contagem.
Se o `data.pkmn.cc` renomear `item` para `items`, saem os mesmos 19.164 Sets com `item` `undefined`
em todos, e A9 e A10 passam felizes.
Esse buraco é real e não é hipotético — é o modo de falha mais provável de uma fonte comunitária.

A resposta não é biblioteca, é **asserção A14, presença de campo por Set**, com os números medidos
sobre os 19.164 Sets que ficam depois de cortar `cap` e `letsgoou`:

```
moves 19164 | item 18494 | evs 18030 | nature 18027 | ability 7729 | ivs 3017 | teratypes 2429 | level 46
```

Congelados. Um campo que some derruba o build, na mesma tabela e no mesmo vocabulário das outras
treze, sem dependência nova e sem `npm install`.

### 9. As asserções rodam dentro do coletor

As asserções não são suíte de teste ao lado: rodam **no caminho de emissão**, dentro do coletor,
antes de escrever qualquer arquivo.

Suíte de teste pode ser pulada — `--skip-tests`, CI vermelho que alguém mergeia assim mesmo, hook
desinstalado.
Coletor que se recusa a escrever não pode.

Elas vivem em módulo próprio, `assert/`, com testes próprios: é seam interno, e a asserção também
pode estar errada.

### 10. Versão do Dataset e cadência

`datasetVersion` é **data da coleta mais hash curto**: `2026-08-21.a3f91c`.
Sem semver — semver comunica compatibilidade de API, e isto é um instantâneo de dado de terceiro.

**Cadência manual, sem agendamento.**
São ~4 usuários e distribuição manual por GitHub Release (R3); um cron produziria fila de PRs que
ninguém revisa, e a primeira delas com asserção quebrada ficaria aberta indefinidamente.
Quem quer Dataset novo roda `dataset:fetch`, olha o diff e abre a PR.

*Isto resolve a névoa "Cadência de atualização do Dataset" do mapa.*

Sobre dados do usuário quando o Dataset muda entre versões: favoritos e Teams referenciam `FormId`, e
o `FormId` é o slug canônico, estável por construção (A1).
O caso que sobra — uma Form desaparecer do upstream — é decisão de persistência, e vai para o
ticket 22 (issue #25) junto com o resto do arquivo do usuário.

### 11. Forma do coletor

Módulo profundo puro no meio, I/O só nas pontas:

```
tools/dataset/
  fetch/   adaptadores de rede, um por fonte; escrevem arquivo cru e nada mais
  read/    seam SourceReader: arquivo cru -> registros de fonte tipados
  build/   registros -> { core, sets }.  Função PURA. Sem rede, sem disco.
  assert/  as invariantes do ticket 08 mais as da seção 16
  emit/    escreve os dois JSON
  main.ts  liga as pontas
```

O peso está em `build`, atrás de uma interface de **uma assinatura**:

```ts
buildDataset(sources: SourceRecords): { core: CoreDataset; sets: SetsDataset }
```

Teste da deleção: apague `build` e a regra de corte das Redundant Forms, a derivação de `traits`, a
extração dos Overrides e a escada de Tier reaparecem espalhadas pelos chamadores.

Sendo puro, **a suíte inteira de regras testa sem rede e sem disco** — é o que torna a escada da
seção 7 verificável linha a linha em vez de verificável só depois de baixar 5 MB.

### 12. Saída e carregamento

Dois arquivos: **`public/dataset/core.json`** e **`public/dataset/sets.json`**, buscados com `fetch`
em runtime.
**Nunca importados como módulo.**

Importar JSON no Vite o transforma em módulo JS, e o ticket 08 mediu literal JS em **68,0 ms** contra
**53,5 ms** do `JSON.parse` sobre a mesma carga.
Importar seria escolher o caminho 27% mais lento contra a decisão que o próprio ticket 08 tomou com
esse número na mão.

JSON minificado, sem compressão, como o ticket 08 fixou.
O Rust nunca toca no dado.

### 13. Política de rede

User-Agent de navegador — **obrigatório**, `smogon.com/dex/*` devolve 400 sem ele, e essa é uma das
razões pelas quais o coletor do V1 era frágil.
Timeout explícito.
**Zero retry.**

A seção 5 já quebra o build na falha; retry só atrasaria o diagnóstico e mascararia rate limit como
lentidão.
São 9 requisições ao `data.pkmn.cc` e 9 ao `dump-basics` do Smogon, rodadas por um humano que está
olhando.

### 14. Dois comandos, não um com flag

`dataset:fetch` e `dataset:build` são **dois comandos**.

Com uma flag, "o build não usa rede" é promessa que alguém quebra ao acrescentar um `if`.
Com dois comandos é **fato estrutural**: `build` não tem adaptador de rede no grafo de imports, e
reconstruir o artefato a partir do repo é reprodutível por construção.

### 15. Tabela de Formats no artefato

O artefato carrega uma **tabela de Formats**: id, nome, gerações em que existe, e classe.

Buraco encontrado aqui: o ticket 07 classificou os Formats em singles-tier, doubles, other-metagame e
special-retro, mas isso só existia em prosa, e o ticket 12 decidiu que a aba de Sets filtra por
Format — com **61 Formats distintos**.
Lista plana de 61 não é filtro.

A lista e as gerações são **coletadas** (array `formats` do `dump-basics`).
A classe é **curadoria do projeto**: mora como constante no coletor e é carimbada na linha.
Daí a asserção A12.

### 16. Asserções de build

As onze do ticket 08 mais três novas.
Todas rodam dentro do coletor, no caminho de emissão (seção 9).

| # | Asserção | Valor esperado |
|---|---|---|
| A1 | chave do `ps_pokedex.ts` igual ao slug do nome, em toda entrada | 1517 de 1517 |
| A2 | tabela candidata = `basics_sv` (`Standard` + `NatDex`) + Gmax + Megas Z-A | 1273 + 34 + 49 = 1356 |
| A3 | Redundant Forms cortadas pela regra mecânica, transitivamente | 31 |
| A4 | Forms no Dataset final | 1325 |
| A5 | Forms com `isBaseForm` igual a Species distintas | 1025 = 1025 |
| A6 | contagem por trait | mega 94, gmax 34, regional 58, battle-only 29, primal 2 |
| A7 | Forms por número de traits | 0 tem 1116, 1 tem 201, 2 tem 8 |
| A8 | combinações de slot de ability, soma igual a A4 | 0:363, 0H:355, 01H:603, 0S:2, 0HS:1, 01HS:1 |
| A9 | Sets após cortar `cap` e `letsgoou` | 19.164 em 162 pares |
| A10 | **todo Set referencia uma Form existente** | 1118 Forms com Set, 0 órfãs |
| A11 | divergência de abilities entre o jar `zamega` e o `pokedex.ts` | exatamente 16 formas |
| A12 | **todo Format tem classe** | 61 de 61 |
| A13 | **Tier por degrau da escada da seção 7** | 816 / 378 / 37 / 42 / 52 |
| A14 | **presença de campo por Set** | moves 19164, item 18494, evs 18030, nature 18027, ability 7729, ivs 3017, teratypes 2429, level 46 |

Duas asserções extras que caem de graça e valem o custo zero:

- **nenhuma Form sai com Tier `"Illegal"`** — consequência da escada, e a sentinela de que o degrau 2
  não foi removido por engano.
- **`formats-data.tier` e `basics_sv.formats` concordam onde os dois existem** — 824 de 824. É
  asserção cruzada: se um dia divergirem, uma das duas fontes mudou de significado, e o degrau 3
  passa a ser uma escolha em vez de um preenchimento.

A **A11 vem do ticket 19 e nunca foi medida de novo** — é a única da tabela nessa condição, e depende
do jar (seção 18).

### 17. O que este ticket empurra para outros

- **Como o artefato entra no `.exe` e o que a tela de carregamento mostra enquanto ele é parseado** —
  ticket 15 (issue #16), build e release.
- **Qual gate roda no CI e o que acontece com uma asserção vermelha numa PR** — ticket 14
  (issue #15), estratégia de verificação.
- **O que acontece com favoritos e Teams quando uma Form some do upstream** — ticket 22 (issue #25),
  persistência do usuário.
- **Como a ausência de Tier é desenhada na tabela e no detalhe** — 52 Forms com `tier: null` não são
  um caso de borda decorativo, são 4% das linhas. Fica para o protótipo de UI, ticket 17 (issue #18).

### 18. Bloqueio de execução, não de decisão

O `zamega-fabric-1.7.3.jar` **não está em `research/`**: `champ/` está vazio e não há `.jar` no repo.

As abilities das 49 Megas de Z-A dependem dele, e a A11 — divergência de exatamente 16 formas — veio
do ticket 19 e nunca foi remedida.

**Decidir o pipeline não exige o jar. Rodar o coletor exige.**
Este ticket fecha; a execução espera o arquivo.
