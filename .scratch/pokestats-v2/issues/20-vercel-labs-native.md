# 20 — Avaliar Vercel Labs `native` como stack

Type: research
Status: claimed
Blocked by: —

## Question

O `native` da Vercel Labs (https://native-sdk.dev/, `github.com/vercel-labs/native`) consegue
construir este aplicativo no Windows hoje, e qual o risco de apostar nele?

O usuário trouxe esta referência tanto como **candidato de stack** quanto como **referência
visual** — disse gostar do tema do próprio site `native-sdk.dev`.

Sub-perguntas: o que é exatamente e com o que renderiza (React Native, webview, renderer próprio);
maturidade real — estrelas, primeiro e último commit, releases, versão publicada no npm, se é
rotulado experimental, e cadência de commit nos últimos 3 meses, já que projetos do Vercel Labs são
frequentemente abandonados; **se suporta Windows**, porque isso sozinho decide; se produz um `.exe`
único autocontido e de que tamanho; implicações de renderização para cold start, tabela virtualizada
e ~1.700 GIFs animados; se os tokens do Geist são reproduzíveis (CSS, subconjunto de CSS, ou API de
objeto de estilo) e se Tailwind/shadcn funcionam; com o que o site `native-sdk.dev` é feito e se o
visual dele é Geist ou outra coisa; e o risco concreto de abandono para um dev solo sem prazo.

Insumo de *Escolher a stack*, junto de *Candidatos de stack para desktop Windows offline e rápido*.
