# Mapa: PokeStats v2

> **O tracker canônico é o GitHub Issues deste repo, não este arquivo.**
> O mapa é a issue [#1](https://github.com/YuukiFST/PokeStats/issues/1); cada ticket é uma
> sub-issue dela, com label `wayfinder:<tipo>` e as dependências nativas do GitHub como arestas de
> bloqueio. Ticket NN corresponde à issue **#NN+1** (ticket 01 = #2, ticket 21 = #22).
>
> Esta pasta permanece como **arquivo de pesquisa**: `research/` guarda os relatórios completos e o
> `geist-tokens.css`, que as issues referenciam por link. Os `.md` em `issues/` são o snapshot de
> onde o mapa estava na migração — ao trabalhar o mapa, ler e escrever nas issues do GitHub.

## Destino

Uma **spec de implementação completa do PokeStats v2** — stack, arquitetura, modelo de dados,
pipeline de dados e de assets, arquitetura de informação, orçamento de performance e estratégia de
verificação — pronta para um agente construir do zero, acompanhada de um **protótipo de UI
validado pelo usuário**. O mapa termina quando não sobrar nenhuma decisão pendente. Construir o
programa é trabalho posterior, fora deste mapa.

## Notas

**Domínio:** aplicativo desktop Windows de consulta a dados competitivos de Pokémon, para
jogadores de Cobbleverse/Cobblemon. Reescrita total de um projeto V1 em Python + Flet.

**Glossário canônico:** `CONTEXT.md` na raiz do repo. Species vs Form, Dex Generation vs Format vs
Tier, e Set (não "build") são termos travados — qualquer ticket que os use segue aquele arquivo.

**Skills a consultar em toda sessão:** `grilling` e `domain-modeling` por padrão; `codebase-design`
em qualquer decisão de arquitetura; `prototype` no ticket de UI; `prove` no ticket de verificação;
`research` nos tickets AFK.

**Idioma:** mapa e tickets em pt-BR. `CONTEXT.md`, código, commits e a UI do programa em inglês.

### Restrições já fixadas (vieram do grilling de abertura, não de tickets)

| # | Restrição |
|---|---|
| R1 | Reescrita **do absoluto zero**. Nada do código V1 é reaproveitado. Só o comportamento serve de referência. |
| R2 | **100% offline.** O aplicativo nunca faz I/O de rede. Dados e assets são embutidos no binário. |
| R3 | **Um `.exe` portátil único.** Sem instalador, sem auto-update, sem telemetria. Distribuído por GitHub Release para ~4 usuários. |
| R4 | **Sem teto de tamanho** para o executável. Sprites animados completos são preferidos a qualquer economia de bytes. |
| R5 | Orçamento de performance: **abas carregam em < 1s**, abertura do programa rápida, interação (busca/filtro/ordenação) percebida como instantânea. Números exatos e método de medição são decididos em *Arquitetura de performance*. |
| R6 | UI em **inglês por padrão**, com botão em Settings para **pt-BR**. Nomes de Pokémon, tipos, movimentos, itens e habilidades permanecem em inglês nos dois idiomas. |
| R7 | Direção visual: **estilo Vercel / design system Geist**, tema escuro padrão, tema claro opcional. Densidade de dados alta nas tabelas. |
| R8 | **Fakemon CAP são cortados do dataset**, não marcados. Se não existe no jogo, não entra. |
| R9 | Escopo mínimo de features = paridade com o V1 (Pokédex com busca e filtro, ranking por stat, comparação até 4, tela de detalhe com stats e efetividade defensiva) **mais**: sprites, Sets do Smogon com Showdown Export, Tier por Form, e montador de Team com cobertura de tipos. |
| R10 | Configurações e dados do usuário em `%APPDATA%\PokeStats\`, com fallback para o diretório do executável se `%APPDATA%` não for gravável. Guarda idioma, tema, favoritos e Teams. |
| R11 | Sem calculadora de stats por nível/natureza/IV/EV. EVs, IVs e Nature aparecem apenas como campos de um Set. |
| R12 | **A escolha de stack foi delegada ao agente** pelo usuário, com o critério: melhor performance possível sem perder a elegância da UI. A decisão ainda é apresentada com os fatos que a sustentam. Referência visual adicional trazida pelo usuário: `native-sdk.dev`. |

## Decisões até agora

<!-- índice: uma linha por ticket fechado -->

- [01 — Qual roster o Cobbleverse realmente tem](issues/01-roster-cobbleverse.md) — Gen 1–9 vanilla
  bate ~99%: Base Stats idênticos aos do jogo (1166/1166 conferidos), 1025 Species, nada removido,
  gating por level cap. Divergência única que importa: o pack habilita **93 megas**, não 48.
- [02 — Fontes de sprite animado, licença e volume](issues/02-fontes-sprites.md) — o Smogon serve
  `dex/media/sprites/xy/<alias>.gif`, bytes idênticos ao `ani/` do Showdown; GIF animado cobre
  Gen 1–9, 1.686 arquivos, **154,63 MB** de frente, incompressível. Nenhuma fonte concede direito de
  redistribuição em binário.
- [03 — Como reproduzir exatamente o visual da Vercel](issues/03-design-language-vercel.md) — tokens
  reais extraídos do CSS de produção da Vercel, em [`research/geist-tokens.css`](research/geist-tokens.css).
  Fonte Geist é OFL 1.1 e permite embutir. Elevação é borda de 1px, não sombra. Não existe biblioteca
  de componentes Geist pública. Fora da webview, WPF e Win32 estão descartados e WinUI 3 falha em
  hairline e em grid.
- [04 — Estrutura, volume e termos dos dados de Set do Smogon](issues/04-dados-sets-smogon.md) —
  raspar é desnecessário: `@pkmn/dex` (MIT) dá base stats por geração e tiers, `data.pkmn.cc` dá
  19.582 Sets em 9 requisições, total ~5 MB embutidos. **`Champions` É uma Dex Generation do Smogon**
  (10 no total) e **Base Stats mudam entre gerações**. Texto dos Sets é copyright declarado do Smogon.
- [05 — Candidatos de stack para desktop Windows offline e rápido](issues/05-candidatos-de-stack.md)
  — extrair 154 MB para `%TEMP%` nesta máquina custa **2.801 ms**, o que mata Flet e qualquer onefile
  que materialize o payload; recurso embutido em PE é paginado por demanda e custa ~0 ms. Shortlist:
  Tauri v2, Electron, .NET 9 WPF. Só webview reproduz Geist 1:1. Flutter, WinUI 3 e Avalonia
  eliminados por fato específico cada.
- [19 — Fonte de stats e sprites das megas de Legends: Z-A](issues/19-megas-legends-za.md) — premissa
  errada a favor do projeto: o `pokedex.ts` do Showdown **já traz as 45**, marcadas
  `isNonstandard: "Future"`, stats idênticos ao jar do addon (0 divergências). Abilities divergem em
  16 formas — tirar do jar. **Sprite animado existe para só 9 de 49**; PokéAPI HOME cobre 48/48.
- [20 — Avaliar Vercel Labs `native` como stack](issues/20-vercel-labs-native.md) — não constrói este
  app: sem codec de GIF (a palavra não existe no repo), 16 slots de imagem, e `package --target
  windows` emite diretório, não `.exe`. Achado que compensa: o site `native-sdk.dev` é Next.js +
  Tailwind + `geist`, com 212 tokens `--ds-*` — o visual desejado é stack web comum.
- [06 — Escolher a stack](issues/06-escolher-stack.md) — **Tauri v2** + React + TypeScript + Vite,
  Tailwind + shadcn re-tematizado com os tokens Geist, TanStack Table + Virtual. WPF caiu por não ter
  letter-spacing; Electron perdeu por ~400 MB e extração em `%TEMP%`. Exige instalar Rust + MSVC.

## Ainda não especificado

<!-- névoa: em escopo, ainda sem nitidez para virar ticket -->

- **Persistência do usuário em detalhe** — formato do arquivo de favoritos e Teams, versionamento
  de schema, o que acontece quando o Dataset embutido muda e um Team salvo referencia uma Form que
  sumiu. Fica nítido depois do modelo de domínio.
- **Erros e diagnóstico num executável sem console** — o V1 mandava `print()` para um build
  `console=False`, ou seja, para lugar nenhum. Precisa de uma história de log, mas o formato
  depende da stack.
- **Cadência de atualização do Dataset** — quem roda o scraper, com que frequência, e como uma
  release nova é publicada. Depende do pipeline de dados.
- **Acessibilidade e navegação por teclado** — atalhos, foco, leitor de tela. Depende da stack e da
  arquitetura de informação.
- **Assets além de sprites** — ícones de tipo, ícones de item, ícones de Tera type. Volume e fonte
  desconhecidos até o research de assets fechar.
- **Ícone, nome de janela e identidade visual do aplicativo** — trivial, mas ninguém decidiu.

## Fora de escopo

<!-- ruled out deste esforço; não graduam -->

- **Calculadora de dano** — dataset de movimentos com power/accuracy/efeitos, mais a fórmula
  completa com todos os modificadores. Outro problema, ordem de magnitude maior.
- **Navegador de movepool completo** — quais movimentos cada Form aprende, por nível/TM/ovo.
  Multiplica o dataset. Os movimentos aparecem só dentro de um Set.
- **Dados específicos de Pixelmon** — o usuário confirmou que a diferença entre os mods não importa
  para stats. Se o roster divergir de fato, isso volta como esforço novo.
- **Auto-update, instalador, telemetria, assinatura de código** — 4 usuários, distribuição manual
  por GitHub Release.
- **Qualquer I/O de rede em runtime** — decorre de R2. O scraper é ferramenta de build, nunca
  embarca no aplicativo.
