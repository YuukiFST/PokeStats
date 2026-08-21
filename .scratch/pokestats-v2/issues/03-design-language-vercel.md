# 03 — Como reproduzir exatamente o visual da Vercel

Type: research
Status: resolved
Blocked by: —

## Question

Quais são os valores concretos do design system Geist (Vercel) — não adjetivos — suficientes para
reproduzir aquele visual num aplicativo desktop de alta densidade de dados?

Sub-perguntas: tipografia (Geist Sans/Mono, licença para embutir em binário distribuído, escala de
tamanhos/pesos/entrelinhas); cores (escala dark real em hex/oklch: fundos em camadas, níveis de
texto, bordas, escalas semânticas), e se o tema claro é inversão direta; espaçamento, raio de borda
e como a Vercel trata elevação (sombra versus borda de 1px + camada de fundo); traços visuais
assinatura (tratamento de hover, focus ring, monospace para números, badges, estilo de tabela,
empty states); movimento (durações e curvas); **estilo de tabela em detalhe** — altura de linha,
separadores, cabeçalho, afordância de ordenação, já que a tela principal do PokeStats é tabela;
fidelidade alcançável fora da web (webview versus WinUI/WPF versus Flutter versus Win32), com os
bloqueios específicos de cada; e quais bibliotecas open source já implementam Geist, oficiais
versus comunitárias, com licença e data do último commit.

Saída inclui um bloco de custom properties CSS com os tokens dark reais. Valor não confirmado é
marcado `UNCONFIRMED` — token de design inventado é pior que lacuna.

## Answer

**Asset:** [`research/geist-tokens.css`](../research/geist-tokens.css) — bloco completo e copiável:
paleta dark e light, sombras, motion, espaçamento, raios, escala tipográfica e a implementação
exata da tabela. Este arquivo é a saída principal do ticket.

**Método.** Os docs do Geist (`vercel.com/geist/*`) documentam estrutura e uso mas **não publicam
valor nenhum de token**. Todo hex, px e cubic-bezier saiu do CSS de produção da própria Vercel,
lido em 2026-08-21 nos chunks `vercel.com/vc-ap-b3331f/_next/static/immutable/chunks/*.css`. As
URLs são hasheadas e rotacionam — para re-extrair, buscar qualquer página `vercel.com/geist/*` e
grepar os stylesheets por `--ds-`.

### Tipografia — a fonte é livre para embutir

Geist Sans, Geist Mono e Geist Pixel, sob **SIL Open Font License 1.1**, e "embed" está literalmente
na concessão: *"Permission is hereby granted… to use, study, copy, merge, **embed**, modify,
redistribute…"*. Três fatos que importam para um `.exe`: a OFL **não é copyleft sobre o
aplicativo** (o código pode ser fechado); a obrigação é distribuir o texto da licença junto, num
arquivo de third-party notices; e **não há Reserved Font Name** declarado em nenhuma das cópias
autoritativas, então até um derivado subsetado pode manter o nome.

Baixar o `.otf` do release do repo — v1.7.2, 2026-06-01 — e não o pacote npm, que omite `.otf` e
tem nomes de peso inconsistentes.

Eixo variável `wght` 100–900 em Sans e Mono. **A UI da Vercel usa só três pesos:** 400, 500, 600.

A escala tem quatro rampas — `heading` (600, tracking negativo), `copy` (400, tracking zero),
`label` (400, entrelinha apertada), `button` (500). **O tracking negativo é só de heading e escala
de forma não linear** (~-2% do tamanho até 20px, saltando para -4%/-6% em 24px+). É o detalhe mais
comumente errado.

Também obrigatório, no `html`: `font-feature-settings: "rlig" 1, "calt" 0, "ss11" 1` — alternativas
contextuais **desligadas**, stylistic set 11 ligado — mais `font-synthesis: none`.

### Cor

Escalas numeradas 100→1000 com contrato fixo: 100–300 fundo de componente, **400–600 borda**,
700–800 fundo sólido, 900–1000 texto. Dez escalas. Valores no CSS anexo.

Uma ambiguidade honesta na fonte: `--ds-background-100` é declarado duas vezes, como `#000` e como
hsl 4%. Pela ordem da cascata vence `#0a0a0a`, e a variante `striped` da tabela corrobora — ela
pinta linhas ímpares com `background-200`, que seria invisível se ambos fossem `#000`. Registrado
como AMBÍGUO no CSS, com recomendação de conferir contra screenshot.

**Tema claro não é inversão.** Três provas: `gray-700` e `gray-800` são idênticos byte a byte nos
dois temas; a rampa clara é não monotônica (`gray-300` #e6e6e6 é mais escuro que `gray-400`
#eaeaea); e a direção de camadas inverte — no claro `background-200` é mais claro que `gray-100`,
no escuro é mais escuro.

### Elevação — borda, não sombra

O fato estrutural mais importante do estilo. Superfícies na página **não têm sombra nenhuma** — têm
borda de 1px em `--ds-gray-400` (#2e2e2e) mais troca de camada de fundo. Sombra existe só para o
que flutua acima da página, e **todo token de sombra começa com um anel de 1px**, não com blur. Os
alfas de blur são baixíssimos (2% e 4%): se a sombra é visível como sombra, passou do ponto.

Espaçamento base 4px. **Raio canônico 6px.** Alturas de controle: small 32, medium 36, large 40.

### Motion

`--ds-motion-timing-swift: cubic-bezier(.175,.885,.32,1.1)` — termina em **1.1**, overshoot
deliberado. Overlay entra escalando de 0.96 em 300ms; popover em 200ms. Hover e foco: 150–200ms
`ease-in-out` **só em propriedades de cor**. Nada de transform, nada de lift, nada de scale — as
linhas de tabela carregam apenas `transition-colors`.

### A tabela, que é a tela principal do PokeStats

Valores lidos do markup renderizado do componente, não da prosa:

- Corpo **14px/20px em `--ds-gray-900` (#a0a0a0)** — **não branco**. Só células enfatizadas sobem
  para `gray-1000` + peso 500.
- **Cabeçalho tem a mesma cor apagada do corpo**, peso 500, altura 36px — e é **mais baixo** que as
  linhas do corpo, que têm 40px (padding 10px + 20px de entrelinha).
- **Separadores de linha são opt-in**, não padrão. A tabela padrão tem só o sublinhado do cabeçalho.
  Quando ligados, `:not(:last-child)` — sem borda na última linha.
- **Zebra é opt-in, pinta as linhas ÍMPARES, e vai mais ESCURO** (`#000` sobre página `#0a0a0a`).
- **Hover é troca plana de fundo para `gray-100` (#1a1a1a).** Sem mudança de borda, sem sombra, sem
  transform.
- Primeira e última célula com raio de 4px, então a linha em hover lê como pílula arredondada.
- **Última coluna alinhada à direita por padrão**, em `th` e `td`.
- Colunas com largura percentual fixa + `whitespace-nowrap`: tabelas Geist **truncam, não refluem**.
- **`tnum` obrigatório em coluna numérica** — doc verbatim: *"Apply `tabular-nums` (or Geist Mono)
  to numeric columns so digits align across rows for comparison."*
- Célula vazia é **`—`**, verbatim: *"Do not substitute `N/A`, `null`, or an empty string."*
- Cabeçalho ordenável é um `<button>` de verdade, com o focus ring; o rótulo **não** muda de caixa
  nem de peso ao ordenar — só uma seta pequena indica direção.
- `virtualize` é prop de primeira classe. 1.300 linhas está muito abaixo do limite.

Foco é anel duplo com gap na cor do fundo, e só em `:focus-visible` — clique de mouse nunca mostra
anel.

**Contradição com a recomendação da Q20:** o doc de marca da Vercel (`vercel.com/design.md`)
**rejeita explicitamente** *"decorative gradients"*, junto de all-caps, grades de card, painéis
aninhados e ícones decorativos. Os gradientes que se vê são de páginas de marketing, não de
superfície de produto. "Estilo Vercel" em produto é mais austero do que a home sugere.

### Reprodutibilidade por stack — insumo direto de *Escolher a stack*

Bloqueio comum a tudo que não é web: **o Geist não exporta tokens em formato neutro.** Não há
`tokens.json`, nem Style Dictionary. Os componentes oficiais `@vercel/geistcn` e
`@vercel/geistcn-assets` são citados verbatim nos docs com exemplos de import, mas **ambos dão 404
no npm público** — só a documentação e as fontes são públicas. Os arquivos do Figma que aparecem
são reconstruções da comunidade. Logo, fora da web todo caminho começa transcrevendo à mão os ~90
hexes — que é exatamente o que o CSS anexo já fez.

- **Tauri v2 / Electron — 1:1, literalmente.** Tailwind + shadcn/ui roda sem alteração; dá para
  copiar valor computado direto do DevTools do painel da Vercel. No Windows os dois são Chromium
  (WebView2), então Tauri não perde nada.
- **Flutter — ~90%, melhor opção não-web.** Fontes variáveis via `fontVariations`, `tnum` via
  `FontFeature.tabularFigures()`, `letterSpacing` negativo — toda a metade tipográfica funciona.
  Impeller rasteriza diferente do Chromium (lê como peso levemente diferente, não como texto
  errado). `DataTable` é inutilizável aqui: mede o conteúdo duas vezes e constrói linhas fora da
  tela. O widget certo é `TableView` de `two_dimensional_scrollables`. Hairline exige snapping
  manual — não existe equivalente global de `UseLayoutRounding`.
- **WinUI 3 — falha nos dois pontos que mais importam.** Borda de 1px com `CornerRadius` renderiza
  borrada, e traço de 1px borra em qualquer escala acima de 100%; `UseLayoutRounding` já é `true`
  por padrão e **não resolve** (defeito aberto no `microsoft-ui-xaml`). E **não há DataGrid
  first-party**: o do Community Toolkit está arquivado, fora do WCT 8.0+, sem plano de port, e a
  alternativa é um pacote de um mantenedor só. Duas apostas estruturais contra exatamente as duas
  coisas de que este app é feito.
- **WPF — descartado na tipografia.** Não suporta fontes variáveis e **não tem propriedade de
  letter-spacing**: não existe `CharacterSpacing` em `TextBlock`, e a alternativa é emitir
  `GlyphRun` com advance widths manuais. O tracking negativo do Geist não é opcional neste estilo.
- **Win32 puro — não.** Sem conceito de border-radius, dark mode em common controls só por ordinais
  não exportados do `uxtheme.dll`, e o GDI arredonda advance width para pixel inteiro, destruindo o
  tracking. O único caminho real seria uma lista virtual custom em Direct2D + DirectWrite — ficaria
  excelente, e é construir um framework de renderização para exibir base stats.

**Ponto de partida prático:** shadcn/ui (MIT, ativo, autor é design engineer da Vercel) + as fontes
Geist + o bloco de tokens anexo. O shadcn é a aproximação mais próxima **do estilo, não o estilo** —
o padrão dele é Radix-gray com `--radius: 0.5rem`, e precisa ser sobrescrito. Duas armadilhas:
`@geist-ui/core` está **arquivado** desde 2022 e o próprio README diz *"It is time to say
goodbye"*; e existe um pacote squatter chamado `geist-ui` sem relação com a Vercel.
