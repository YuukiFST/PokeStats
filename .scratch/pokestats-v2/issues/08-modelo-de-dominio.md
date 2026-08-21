# 08 — Modelo de domínio e schema do Dataset

Type: grilling
Status: resolved
Blocked by: 07

## Question

Qual é a estrutura de dados que representa Species, Form, Base Stats, Tier, Set, Type Chart e Team?

Partir do glossário em `CONTEXT.md` e transformá-lo em schema concreto: chaves de identidade (dex
number para Species, slug estável para Form — o V1 usava só o nome e por isso não conseguia
agrupar `Charizard-Mega-X` sob `Charizard`), como Base Stats variam por Dex Generation, como Tier
se liga a (Form, Dex Generation), como um Set se liga a (Form, Dex Generation, Format), e como um
Team salvo referencia Forms de forma estável entre versões do Dataset.

Decidir também o formato de serialização do artefato embutido — JSON, SQLite, binário colunar,
estruturas pré-indexadas — junto de *Pipeline de dados* e sob a pressão de *Arquitetura de
performance*.

Usar `domain-modeling` e `codebase-design`. Atualizar `CONTEXT.md` com o que se firmar.

## Answer

### Resumo

O Dataset é **JSON minificado sem compressão**, embutido como asset e parseado uma vez na WebView,
onde fica em memória JS pelo resto da execução.
A identidade da Form é o **slug canônico**, que não precisou ser inventado: a chave que o Showdown
já usa é exatamente ele, em 1517 de 1517 entradas.
O `Form Kind` de valor único do glossário foi **substituído por um conjunto de Form Traits**, porque
a medição mostrou que ele não fechava nem por cima nem por baixo.
Nada derivável entra no artefato — Type Chart, BST e Defensive Profile são calculados na carga.
O corte do Format `cap`, que este ticket descobriu ser necessário, fecha a integridade referencial:
as 1.118 Forms com Set têm todas linha na tabela final.

### 1. Identidade

**A Form é identificada por slug canônico**: nome em minúsculas, sem acento, só alfanumérico.
`Charizard-Mega-X` vira `charizardmegax`, `Farfetchd` vira `farfetchd`, `Flabébé` vira `flabebe`,
`Necrozma-Dusk-Mane` vira `necrozmaduskmane`.

O ticket 07 entregou essa regra como necessária para conciliar fontes que divergem em apóstrofo,
acento, separador e alias.
A medição mostra que ela é mais forte do que isso: **a chave de objeto que o Showdown já usa é
idêntica ao slug em todas as 1517 entradas do `ps_pokedex.ts`**, e entre as 1.159 Forms que possuem
Set não há **nenhuma** colisão de slug e **nenhuma** que deixe de casar com o pokedex.
Então o coletor não inventa chave: adota a do Showdown e recalcula o slug em paralelo, quebrando o
build se os dois divergirem.
Adotar sem conferir seria fé; recalcular sem adotar seria trabalho perdido.

**A Species é identificada pelo número da National Dex**, inteiro de 1 a 1025 — medi exatamente
1025 valores positivos distintos, máximo 1025.
É esse número que agrupa Forms sob a Species: `num: 6` traz `Charizard`, `Charizard-Mega-X`,
`Charizard-Mega-Y` e `Charizard-Gmax` juntas, precisamente o agrupamento que o V1 não sabia fazer.
CAP e `MissingNo.` caem por `num <= 0`, filtro mecânico — nada de casar string contra uma lista de
nomes de CAP, que é como o V1 errava.

**Um Set é identificado pela chave natural composta** (Form, Dex Generation, Format, nome do Set).
A unicidade é garantida por construção: na fonte esses quatro níveis são chaves de objeto aninhadas.
Não há id sintético. Id sintético só se paga quando algo *persiste* uma referência a um Set, e se um
slot de Team vai referenciar Set é decisão do ticket 13 — Team builder (issue #14).
Se aquele ticket disser que sim, a chave natural quebra na primeira vez que o Smogon renomear um
Set, e este ticket precisa ser revisitado.
Fica registrado como risco conhecido, não como omissão.

### 2. Form Trait substitui Form Kind

O `CONTEXT.md` dizia que uma Form carrega **exatamente um** Form Kind, entre sete valores.
A medição derruba isso pelos dois lados, e nenhum dos dois é caso de canto:

- **132 Forms com `num > 0` não casam com nenhum dos sete**, e **84 delas têm Set**, logo não são
  cortáveis. São `Deoxys-Attack`, `Rotom-Wash`, `Giratina-Origin`, os 18 `Arceus-*`, os 18
  `Silvally-*`, `Kyurem-Black` e `Kyurem-White`, o trio `Therian`, `Calyrex-Ice` e `Calyrex-Shadow`,
  `Ogerpon-*`, `Necrozma-Dusk-Mane`, `Lycanroc-Midnight` e `Lycanroc-Dusk`, `Ursaluna-Bloodmoon`,
  entre outras.
- **11 Forms casam com dois ao mesmo tempo.** `Darmanitan-Galar-Zen` é regional **e** battle-only.
  `Toxtricity-Low-Key-Gmax` e `Urshifu-Rapid-Strike-Gmax` são gmax **e** battle-only.

E `cosmetic` era vocabulário morto: o glossário o listava como Kind e na frase seguinte dizia que
Form cosmética nunca vira linha do dex.
As 37 entradas `isCosmeticForme` de fato não têm `num` e caem antes de qualquer classificação.

**Decisão: `traits`, um conjunto, mais um `isBaseForm` derivado.**
Os valores são `mega`, `gmax`, `primal`, `regional`, `battle-only`, e o conjunto **pode ser vazio**.
`cosmetic` sai do vocabulário.
`base` deixa de ser um valor e vira `isBaseForm`, derivado da ausência de sufixo de forma — 1025
Forms sem sufixo contra 1025 Species, invariante mecânica.

O motivo não é elegância, é correção de filtro.
Todo filtro da UI é uma pergunta de pertinência, e um conjunto responde todas corretamente.
Um enum só acerta quando por acaso escolheu o valor que aquele filtro procura: classificado
`battle-only`, `Darmanitan-Galar-Zen` desaparece do filtro "regionais" sem que o usuário tenha como
perceber que sumiu.
O conjunto também elimina a necessidade de definir precedência entre regras, e dá às 132 Forms sem
trait a resposta honesta — conjunto vazio, uma Form alternativa comum — em vez de um Kind
guarda-chuva inventado para tapar buraco.

A proibição de string matching continua valendo onde importa: **o filtro opera sobre `traits`**,
nunca sobre o nome.
Derivar `traits` de campos da fonte no build é outra coisa, e está coberto pelas asserções de
contagem da seção 8.

**Traits novas não nascem aqui.**
Há agrupamentos grandes entre as Forms sem trait — 18 `Arceus-*`, 18 `Silvally-*` e 4 `Genesect-*`
são variação de tipo dirigida por item; há 9 `*-Totem` e 4 variações de gênero.
Trait existe para servir filtro, e quais filtros a UI oferece é decisão do ticket 12 — Arquitetura
de informação (issue #13).
Adiar custa zero: `traits` é conjunto em campo normalizado, então acrescentar uma trait depois é
aditivo — não muda schema, não invalida artefato, não obriga a recoletar.

### 3. O que é coletado e o que é derivado

**Regra: o artefato guarda apenas o que foi coletado. Tudo que é derivável é derivado na carga.**

Fica **fora** do artefato:

- **Type Chart.** A matriz 18×18 de Gen 6+ é constante, não vem do Smogon, não muda com release do
  Dataset e cabe em algumas centenas de bytes. É constante no código-fonte, onde é testável sem
  carregar artefato nenhum.
- **BST.** É a soma dos seis Base Stats. Guardá-lo permite que ele divirja dos stats exibidos ao
  lado dele na mesma tela.
- **Defensive Profile.** 18 multiplicadores por 1.325 Forms, calculáveis a partir do Type Chart em
  tempo desprezível.
- **Índice de busca por nome.** Construído na carga.

A regra útil não é "todo dado no Dataset", é **"todo dado *coletado* no Dataset"**.
Dado derivado dentro do artefato é uma cópia que pode envelhecer em relação à sua própria entrada, e
o sintoma disso é a UI mostrando um BST que não bate com os stats logo abaixo.

### 4. Serialização e onde o Dataset vive

**JSON minificado, sem compressão, embutido como asset, parseado uma vez na WebView e mantido em
memória JS. O lado Rust nunca toca no dado.**

Dois arquivos: `core.json`, com Species, Forms, Traits, stats, tipos, tiers, abilities e as tabelas
de Override; e `sets.json`, com os Sets.

Medições nesta máquina, Node 22 / V8, mesma engine da WebView2, sobre o payload de Sets:

| medida | valor |
|---|---|
| `JSON.parse` do payload inteiro | 53,5 ms (mediana de 7; mínimo 47,5) |
| `eval` do mesmo conteúdo como literal JS | 68,0 ms |
| descompressão brotli | 8,9 ms |
| minificado, após cortar `cap` e `letsgoou` | 3.815.968 B |
| brotli q11, mesmo payload | 364.304 B |

Cada alternativa cai por um número, não por preferência:

- **Carga preguiçosa** — o payload inteiro parseia em 53,5 ms. Não há o que adiar.
- **SQLite embutido** — acrescenta dependência Rust e um round-trip de IPC por consulta, para servir
  TanStack Table, que quer array JS. Paga latência de interação para resolver um problema de memória
  que 3,8 MB não tem. O R5 revisado, que exige interação extremamente responsiva, torna esse custo
  pior, não melhor.
- **Binário colunar ou `bincode`** — `JSON.parse` é caminho nativo em C++ dentro da V8. Um
  decodificador escrito em JS competiria com isso partindo de trás, e o `eval` de literal JS já
  perde por 14,5 ms.
- **Brotli** — economiza cerca de 3,45 MB no `.exe`, mas o **R4 declara que não há teto de
  tamanho**, então essa economia não compra nada, e custa 8,9 ms mais um caminho de código de
  descompressão. Comprimir aqui é otimizar exatamente a métrica que o projeto declarou irrelevante.

**Sobre o split `core` e `sets`:** a justificativa original era antecipar a primeira pintura.
O R5 revisado — abertura pode demorar desde que haja tela de carregamento — remove essa
justificativa.
O split fica assim mesmo, por outro motivo: a tela de carregamento precisa de etapas para reportar,
e dois arquivos dão duas etapas honestas em vez de uma barra falsa.

### 5. Versionamento

A pergunta original supunha que app e Dataset pudessem estar em versões diferentes.
O R2 e o R3 já haviam matado essa possibilidade: **o Dataset é embutido no `.exe` e o app nunca
busca dado na rede, logo os dois embarcam juntos e a incompatibilidade entre eles é impossível por
construção.**

Não há verificação de versão a fazer no boot.
O artefato carrega `schemaVersion`, `datasetVersion`, `generatedAt` e as revisões das fontes
puramente como proveniência, para depuração e para o diff do coletor.

**A única versão que carrega peso é a do arquivo de Team em `%APPDATA%`** (R10), porque esse
versiona de fato independente do binário.

### 6. Persistência do Team

Um Team salvo guarda **`FormId` cru** mais a versão do Dataset em que foi criado, nunca uma
referência já resolvida.

Quando o usuário atualiza o programa e um `FormId` não resolve mais, **o slot vira lápide**: o Team
carrega, o slot mostra o id que não resolveu com um aviso, e nada é apagado em silêncio.

As alternativas são piores por motivos concretos.
Descartar o slot destrói dado do usuário sem ele ter pedido.
Recusar carregar o Team inteiro por causa de um slot transforma uma atualização de rotina em perda
de dados.

### 7. Schema

```ts
// ---------- identity ----------

/** National Dex number, 1..1025. */
type SpeciesId = number;

/** Canonical slug: lowercase, unaccented, alphanumeric only. `charizardmegax`. */
type FormId = string;

type DexGeneration = 'rb' | 'gs' | 'rs' | 'dp' | 'bw' | 'xy' | 'sm' | 'ss' | 'sv';

type FormTrait = 'mega' | 'gmax' | 'primal' | 'regional' | 'battle-only';

type TypeName =
  | 'Normal' | 'Fire' | 'Water' | 'Electric' | 'Grass' | 'Ice' | 'Fighting' | 'Poison' | 'Ground'
  | 'Flying' | 'Psychic' | 'Bug' | 'Rock' | 'Ghost' | 'Dragon' | 'Dark' | 'Steel' | 'Fairy';

// ---------- collected data ----------

interface BaseStatSpread {
  hp: number; atk: number; def: number; spa: number; spd: number; spe: number;
}

/** Slot names mirror the source. Only `slot0` is always present. */
interface AbilitySlots {
  slot0: string;
  slot1?: string;
  hidden?: string;
  special?: string;
}

interface Species {
  id: SpeciesId;
  name: string;
  /** Every Form of this Species. The Base Form is always first. */
  formIds: FormId[];
}

interface Form {
  id: FormId;
  speciesId: SpeciesId;
  name: string;
  isBaseForm: boolean;
  /** May be empty — an ordinary alternate Form carries no Trait. */
  traits: FormTrait[];
  /** Canonical values: `sv`, plus the Legends: Z-A Megas. */
  baseStats: BaseStatSpread;
  types: [TypeName] | [TypeName, TypeName];
  abilities: AbilitySlots;
  /** Canonical `sv` Tier. Null for the Z-A Megas `champions` does not cover. */
  tier: string | null;
}

/** Historical values, surfaced only inside a Set belonging to that Dex Generation. */
interface StatOverride { formId: FormId; gen: DexGeneration; baseStats: BaseStatSpread }
interface TypeOverride { formId: FormId; gen: DexGeneration; types: [TypeName] | [TypeName, TypeName] }
interface TierOverride { formId: FormId; gen: DexGeneration; tier: string | null }

/**
 * A published competitive build. Named `PokemonSet`, not `Set`, because `Set` is a JavaScript
 * built-in — the domain term stays "Set" in CONTEXT.md, in the UI and in every ticket.
 */
interface PokemonSet {
  formId: FormId;
  gen: DexGeneration;
  format: string;
  name: string;
  /** One entry per move slot; more than one element means the source lists alternatives. */
  moves: string[][];
  item?: string;
  ability?: string;
  nature?: string;
  evs?: Partial<BaseStatSpread>;
  ivs?: Partial<BaseStatSpread>;
  teraType?: string;
}

// ---------- artifacts on disk ----------

interface Provenance {
  schemaVersion: number;
  datasetVersion: string;
  generatedAt: string;
  sources: Record<string, string>;
}

interface CoreArtifact extends Provenance {
  species: Species[];
  forms: Form[];
  statOverrides: StatOverride[];
  typeOverrides: TypeOverride[];
  tierOverrides: TierOverride[];
}

interface SetsArtifact extends Provenance {
  sets: PokemonSet[];
}

// ---------- in memory ----------

/** The one seam between the wire format and everything else. Every join lives behind it. */
declare function loadDataset(core: CoreArtifact, sets: SetsArtifact): Dataset;

interface Dataset {
  speciesById: ReadonlyMap<SpeciesId, Species>;
  formById: ReadonlyMap<FormId, Form>;
  setsByFormId: ReadonlyMap<FormId, readonly PokemonSet[]>;
  /** Derived on load, never stored. */
  bstByFormId: ReadonlyMap<FormId, number>;
  statsFor(formId: FormId, gen: DexGeneration): BaseStatSpread;
  typesFor(formId: FormId, gen: DexGeneration): readonly TypeName[];
}

// ---------- user data, versioned independently (R10) ----------

interface TeamFile {
  schemaVersion: number;
  teams: Team[];
}

interface Team {
  id: string;
  name: string;
  /** Up to 6 slots. Stores the raw FormId — never a resolved reference. */
  slots: (TeamSlot | null)[];
}

interface TeamSlot {
  formId: FormId;
  /** Dataset version this slot was saved against. */
  savedWith: string;
}
```

O artefato guarda tabelas **normalizadas**; a memória guarda a visão **desnormalizada**; entre os
dois há um único módulo, `loadDataset`.
Com 1.325 Forms o join custa microssegundos, o artefato continua legível e diffável no PR do
coletor, e nenhuma tela da UI jamais escreve um join.
É o módulo profundo deste ticket: muita mecânica atrás de uma assinatura estreita.

Os tipos TypeScript são a fonte da verdade da forma.
**Validação de runtime existe só no coletor, no build. O aplicativo não valida nada** — o artefato é
congelado e viaja no mesmo binário; validá-lo no boot é conferir o próprio bolso.
Qual biblioteca de validação usar não é decidido aqui: quem tem o coletor é o ticket 09 — Pipeline
de dados (issue #10).

### 8. Asserções de build — herdadas pelo ticket 09 (issue #10)

Todas medidas nos arquivos de `.scratch/pokestats-v2/research/`.
O build quebra se qualquer uma falhar.

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

A A11 vem do ticket 19 e **nunca foi medida de novo** — é a única da tabela nessa condição.

**Identificação das Megas de Legends: Z-A — dois seletores independentes que concordam.**

1. **`isNonstandard: "Future"` no `ps_formatsdata.ts`** — 49 entradas.
2. **Predicado derivado:** o nome casa `-Mega` no `ps_pokedex.ts` **e** a Form está ausente do
   `basics_sv` filtrado por `Standard` e `NatDex` — 49 entradas.

Os dois conjuntos são **idênticos**: zero divergência nos dois sentidos.
O coletor usa o primeiro como fonte e o segundo como asserção cruzada, o que é mais forte do que
qualquer um sozinho.

*Correção registrada:* a primeira redação deste ticket afirmava que o seletor `isNonstandard`
documentado pelo ticket 19 **não existia**. Ele existe — no `ps_formatsdata.ts`, arquivo irmão do
`ps_pokedex.ts` e igualmente presente em `research/`. O erro foi procurá-lo no `pokedex.ts`, onde de
fato não aparece nenhuma vez, porque no modelo de dados do Showdown `isNonstandard` é um campo de
`FormatsData`, não de `Pokedex`. A distribuição completa lá é `Past` 452, `CAP` 82, `Future` 49,
`Custom` 19, `LGPE` 2.

A exclusão de CAP tem, pelo mesmo motivo, dois caminhos que concordam: `num <= 0` no `pokedex.ts`
(100 entradas, incluindo `MissingNo.`) e `isNonstandard: "CAP"` no `ps_formatsdata.ts` (82), o mesmo
82 que o `basics_sv` reporta.

O `ps_formatsdata.ts` também traz `tier`, `natDexTier` e `doublesTier` por Form, e é uma fonte de
Tier mais fina que o `basics_sv` para as Megas — `charizardmegax` sai como `natDexTier: "UUBL"` ali,
enquanto no `basics_sv` ele cai no balde genérico `National Dex`, que cobre 397 Forms. Qual fonte
alimenta qual campo é decisão do ticket 09 — Pipeline de dados (issue #10).

### 9. O que não foi decidido aqui

- **Qual biblioteca de validação** o coletor usa — ticket 09 (issue #10).
- **Quais filtros a UI oferece**, e portanto se alguma trait nova nasce — ticket 12 (issue #13).
- **Se um slot de Team referencia Form crua ou Form mais Set** — ticket 13 (issue #14). Se for Form
  mais Set, a chave natural de Set da seção 1 precisa ser revisitada.
- **Números exatos de orçamento de performance e método de medição** — ticket 11 (issue #12), que
  segue bloqueado pelo ticket 21 (issue #22).

### 10. Correções que este ticket fez em decisões já fechadas

- **Format `cap` cortado**, 360 Sets em 6 pares. O ticket 07 mantivera todos os Formats menos
  `letsgoou`, mas o `cap` só contém Forms CAP, que o R8 corta — 238 dos seus 360 Sets apontavam para
  Forms inexistentes. O total de Sets vai de 19.524 para **19.164**, em 162 pares.
- **`CONTEXT.md`**: `Form Kind` de valor único vira `Form Trait` de conjunto, `cosmetic` sai do
  vocabulário, `Form Id` entra como termo, e `Base Form` ganha a invariante mecânica 1025 = 1025.
- **Ticket 19**: nada a corrigir. O seletor `isNonstandard: "Future"` existe e rende as 49 Megas de
  Z-A exatamente — ele mora em `ps_formatsdata.ts`, não em `ps_pokedex.ts`. Uma redação anterior
  deste ticket afirmava o contrário; ver a correção na seção 8.
- **R5 revisado pelo usuário** durante este ticket: a abertura do programa pode demorar desde que
  haja tela de carregamento com feedback visual; o que tem de ser extremamente responsivo é toda
  ação do usuário. Reforça a rejeição do SQLite e muda a justificativa do split `core` e `sets`.
