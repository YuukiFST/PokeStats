# 06 — Escolher a stack

Type: grilling
Status: resolved
Blocked by: 02, 03, 05, 20

## Question

Qual stack o PokeStats v2 usa?

A decisão amarra quase tudo depois dela: arquitetura de performance, pipeline de assets, i18n,
build e release, e o quanto o protótipo de UI pode ser fiel ao Geist.

Levar ao usuário os candidatos sobreviventes de *Candidatos de stack para desktop Windows offline e
rápido* com o trade-off explícito de cada um (tamanho, cold start, fidelidade visual, toolchain a
instalar, risco), recomendar um, e fechar.

Fechar junto: linguagem, gerenciador de pacotes, e se o projeto instala uma toolchain nova nesta
máquina.

**Delegação (R12):** o usuário passou esta decisão ao agente, com o critério explícito de priorizar
performance sem abrir mão da elegância da UI. O ticket continua exigindo que a escolha seja
**apresentada com os fatos decisivos**, não anunciada — quem decide delegou, não abdicou de
entender. Candidato extra trazido pelo usuário: Vercel Labs `native`, avaliado em
*Avaliar Vercel Labs `native` como stack*.

## Answer

**Decisão: Tauri v2, com React + TypeScript + Vite no frontend, Tailwind v4 + shadcn/ui
re-tematizado com os tokens Geist, e TanStack Table + TanStack Virtual para a grade.**

### Como os candidatos caíram

**WPF caiu na tipografia.** *Como reproduzir exatamente o visual da Vercel* é específico: o WPF
**não tem propriedade de letter-spacing** — `CharacterSpacing` não existe em `TextBlock`, e a
alternativa é emitir `GlyphRun` com advance widths manuais — e **não suporta fonte variável**. O
tracking negativo de heading é traço assinatura do Geist, não enfeite. Isso resolve a tensão que
*Candidatos de stack* deixou aberta ao classificar o WPF como "próximo, não 1:1": a leitura mais
dura vence, e o WPF sai. Flutter, WinUI 3, Avalonia e Flet já haviam caído com fato próprio.

**Vercel `native` caiu duas vezes:** não renderiza GIF animado — sem codec, 16 slots de imagem, a
palavra "gif" não existe no repo — e `native package --target windows` emite um **diretório**, não
um `.exe`, violando o R3. Some fator ônibus 1 e o quickstart quebrado no Windows 11.

Restaram **Tauri v2** e **Electron**, que são a mesma arquitetura: webview Chromium com frontend web.
Essa igualdade é o ponto — só stack de webview reproduz o Geist 1:1, com eixo de fonte variável,
hairline exato e `tnum`.

### Por que Tauri e não Electron

O critério do R12 é performance sem perder elegância. Os dois empatam em elegância: no Windows os
dois são Chromium, então a fidelidade visual é idêntica. **Desempatam em performance, e não é
perto.**

| | Tauri v2 | Electron |
|---|---|---|
| Tamanho do binário | ~165–175 MB | ~400 MB |
| Payload de assets | recurso embutido no PE, **paginado por demanda, ~0 ms** | modo `portable` materializa em `%TEMP%` |
| Cold start | sem extração em massa | **~10 s reportado** para hello-world portable |
| WebView2 | **já presente nesta máquina** (151.0.4129.93, por máquina) | Chromium fixado, embarcado |
| Toolchain a instalar | **Rust + MSVC C++** | nenhuma |

O número decisivo veio de *Candidatos de stack*, medido nesta máquina: **escrever os 1.686 GIFs
(154,4 MB) em `%TEMP%` leva 2.801 ms** — em SSD, com Defender desligado, antes de uma linha do app
rodar. É mais que o dobro de todo o orçamento de aba do R5. Recurso embutido num PE de 64 bits é
paginado por demanda e custa ~0 ms; é documentado pela Microsoft. Tauri fica do lado certo dessa
linha, o Electron `portable` não.

O preço do Tauri é instalar Rust e o build tools do MSVC. É custo de máquina, uma vez, e não aparece
no binário nem no tempo de abertura — exatamente o tipo de custo que o critério do R12 manda pagar.

### O que fica travado junto

- **Frontend:** React 19 + TypeScript + Vite. `pnpm` como gerenciador.
- **Estilo:** Tailwind v4 + shadcn/ui, **sobrescrito** com
  [`research/geist-tokens.css`](../research/geist-tokens.css). O shadcn é ponto de partida, não o
  estilo — o padrão dele é Radix-gray com `--radius: 0.5rem`. Confirmação forte dessa escolha:
  *Avaliar Vercel Labs `native` como stack* descobriu que o próprio `native-sdk.dev`, o site que o
  usuário citou como referência visual, é Next.js + Tailwind + o pacote `geist`, com 212 referências
  a tokens `--ds-*` no `globals.css`, incluindo `--ds-gray-400: #2e2e2e`. O visual desejado é
  literalmente construído com esta stack.
- **Fonte:** Geist Sans e Mono em `.otf` do release do repo, embutidas. OFL 1.1 permite embutir; o
  texto da licença acompanha num arquivo de third-party notices.
- **Grade:** TanStack Table + TanStack Virtual, ambos MIT.
- **Backend Rust:** só o que precisa ser rápido ou tocar o sistema de arquivos — carregamento do
  Dataset, índices de busca, leitura de assets, caminho de `%APPDATA%`. A lógica de domínio fica em
  TypeScript, testável sem GUI.
- **Toolchain a instalar nesta máquina:** Rust (via `rustup`, toolchain MSVC) e as Build Tools do
  Visual Studio com o workload C++. Node 22.18.0 já está presente. **Instalar depende de aprovação
  do usuário** — é mudança de máquina, não de projeto.

### O risco que sobra, e como ele é retirado

*Candidatos de stack* levantou um item que não pôde medir: o bug aberto **#12403 do Tauri quebra
builds na casa de 1 GB de assets**, e a faixa de 155–310 MB é território não testado. Esse é o único
fato que poderia derrubar esta decisão.

Não fica como esperança: virou o ticket *Validar o build do Tauri com o payload real de assets*,
que roda **antes** de o pipeline de assets e o de build dependerem da escolha. Se o build não
aguentar, o plano B é Electron aceitando o custo de tamanho e de abertura, ou reduzir o payload de
sprite — e nesse caso esta decisão é reaberta com o fato na mão, não refeita no escuro.

### Nota de método para os tickets seguintes

*Candidatos de stack* descobriu que medir cold start por polling de `Process.MainWindowHandle`
**falha em silêncio para aplicativos multi-processo**, o que inclui todo webview. O aplicativo tem
de emitir seu próprio timestamp de primeiro paint. Isso é requisito de *Arquitetura de performance*
e vira gate em *Estratégia de verificação*.
