# 05 — Candidatos de stack para desktop Windows offline e rápido

Type: research
Status: claimed
Blocked by: —

## Question

Quais stacks conseguem, ao mesmo tempo: executável portátil único no Windows, zero rede em runtime,
abertura rápida com aba em menos de 1s, UI fiel ao Geist, e renderização de milhares de sprites
animados sem travar?

Avaliar no mínimo: Tauri v2 (Rust + webview), Electron, .NET 8+ WinUI 3 / WPF com AOT, Avalonia,
Flutter desktop, e Python + Flet (o que o V1 usava). Para cada um: tamanho real do binário
single-file, tempo de cold start medido ou reportado por fonte primária, se produz de fato **um
`.exe` que roda sem runtime pré-instalado**, custo de embutir ~1.400 assets animados, o que é
preciso instalar nesta máquina (há Node 22 e Python 3.13; não há .NET SDK nem Rust), fidelidade
possível ao Geist, e maturidade de tabela virtualizada com dezenas de milhares de células.

Fatos, não opinião: cada número precisa de fonte. Onde não houver número publicado confiável,
dizer `UNCONFIRMED` e propor como medir.

Insumo de *Escolher a stack*; a decisão em si é do usuário.
