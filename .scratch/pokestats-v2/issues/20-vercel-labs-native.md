# 20 — Avaliar Vercel Labs `native` como stack

Type: research
Status: resolved
Blocked by: —

## Question

O `native` da Vercel Labs (https://native-sdk.dev/, `github.com/vercel-labs/native`) consegue
construir este aplicativo no Windows hoje, e qual o risco de apostar nele?

O usuário trouxe esta referência tanto como **candidato de stack** quanto como **referência
visual** — disse gostar do tema do próprio site `native-sdk.dev`.

## Answer

**Relatório completo:** [`research/20-vercel-labs-native.md`](../research/20-vercel-labs-native.md).

**Não consegue construir este aplicativo no Windows hoje.** Mas a pesquisa entregou um achado que
vale mais que o candidato: **o site que o usuário gosta não é feito com o SDK.**

### O que é

Um toolkit de GUI nativa escrito em Zig — nem React Native, nem webview. Views numa gramática de
markup `.native` própria e fechada, mais um "core" em TypeScript compilado AOT, desenhados por um
renderer próprio em janelas reais do SO. Sem navegador, sem runtime de JS no binário. Arquitetura
Elm (`Model`/`Msg`/`update` puro).

### Os dois fatos que o eliminam

1. **Não renderiza GIF animado, nem por perto.** O registro de imagens é fixo em **16 slots de no
   máximo 8 MiB de pixels decodificados cada** (`src/runtime/canvas_limits.zig:109-118`), o SDK
   **não embarca codec de imagem nenhum**, e a palavra "gif" **aparece zero vezes no repo inteiro**.
   A conta: 16 × 8 MiB ÷ 4 = **33,5 milhões de pixels para o aplicativo todo**; 1.700 sprites a
   96×96 já são 15,7 milhões **para um frame cada**. A API é `registerImage` /
   `registerImageBytes` / `unregisterImage`, toda de frame único. Atlas de sprite (v0.9.5) resolve
   estático, não animação.
2. **`native package --target windows` emite um diretório, não um `.exe`.** Doc verbatim:
   *"Windows packaging is in early development"*. Assets nunca são embutidos — o resultado é
   `MyApp.exe` mais uma pasta `assets/` de 155 MB. Isso viola o R3 diretamente.

E um terceiro, para tabela: a `virtual-list` de verdade é **"builder-only"** (só em Zig); a forma em
markup `<list virtualized>` **constrói todas as linhas** — a doc fala em "hundreds, not hundreds of
thousands" — e o `table` **não tem virtualização nenhuma**.

### Maturidade

7.537 estrelas, criado em **2026-05-08**, último push 2026-08-19, Apache-2.0, ativo (157, 21, 6, 24,
24, 30, 24, 41, 33 commits nas últimas nove semanas). Versão **0.9.5**, pré-1.0 declarado:
*"APIs still move."* Já foi renomeado de `zero-native`. **Fator ônibus 1: `ctate` tem 419 commits,
o segundo maior contribuidor tem 3.** 74 issues abertas, **67 PRs abertos**. E a issue #365, aberta
em 2026-08-16, diz que `native init` + `native dev` **falha de cara no Windows 11 com Node 24**.

### O que ele acerta, para registro

Existe um pacote de tema **`geist` oficial** e as fontes Geist vêm embarcadas no engine. O
`themes/geist.zig` bate com o Geist de verdade: `control_height = 40`, `stroke.hairline = 1` com
`pixel_snap.geometry = true`, focus ring de 2px com 2px de offset, hairline dark em branco 14% — que
é exatamente o `--ds-gray-alpha-400`. Faltam duas coisas que este projeto precisa: **nenhum token de
letter-spacing** em `TypographyTokens`, e **nenhuma API de numeral tabular ou de feature OpenType**.

### O achado que importa: o site é um app web comum

`native-sdk.dev` é **Next.js 16 + React 19 + Tailwind v4 + Radix + o pacote npm `geist`**. O
`globals.css` dele tem **212 referências a tokens `--ds-*`**, incluindo literalmente
`--ds-gray-400: #2e2e2e`, `--color-border: var(--ds-gray-alpha-400)` e a rampa de tracking do Geist
(-0.28px a -4.32px) — os mesmos valores que *Como reproduzir exatamente o visual da Vercel* extraiu
do CSS de produção da Vercel. Só os previews de componente são renderizados pelo engine, via
`component-preview.wasm`.

**Ou seja: o visual que o usuário quer é reproduzível hoje com stack web comum** — e a stack web
ainda entrega as duas coisas que o SDK não expressa, tracking e numeral tabular.

### Risco, se fosse adotado

Recuperável em caso de abandono: a lógica de domínio em TypeScript puro. **Irrecuperável: todo
arquivo de view `.native`** — gramática fechada, uma única implementação, sem especificação nem
exportação — mais todo Zig escrito para escapar dos limites da camada TypeScript, e este aplicativo
forçaria muito disso.

**Veredito: não construir sobre ele. Revisitar na 1.0, ou quando o registro de imagens ganhar
história de animação.**
