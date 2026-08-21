# 05 — Candidatos de stack para desktop Windows offline e rápido

Type: research
Status: resolved
Blocked by: —

## Question

Quais stacks conseguem, ao mesmo tempo: executável portátil único no Windows, zero rede em runtime,
abertura rápida com aba em menos de 1s, UI fiel ao Geist, e renderização de milhares de sprites
animados sem travar?

Avaliar no mínimo: Tauri v2 (Rust + webview), Electron, .NET 8+ WinUI 3 / WPF com AOT, Avalonia,
Flutter desktop, e Python + Flet (o que o V1 usava). Para cada um: tamanho real do binário
single-file, tempo de cold start medido ou reportado por fonte primária, se produz de fato **um
`.exe` que roda sem runtime pré-instalado**, custo de embutir ~1.400 assets animados, o que é
preciso instalar nesta máquina, fidelidade possível ao Geist, e maturidade de tabela virtualizada.

Insumo de *Escolher a stack*; a decisão em si é do usuário.

## Answer

**Relatório completo:** [`research/05-candidatos-de-stack.md`](../research/05-candidatos-de-stack.md)
(em inglês — o formato de saída foi especificado em inglês; o conteúdo é o mesmo).

### A máquina alvo, inventariada em vez de suposta

Win11 Pro 22631, **i3-9100F sem iGPU**, 15,9 GB de RAM, SSD SATA ADATA SU630, Node 22.18.0,
Python 3.13.6, **WebView2 Runtime 151.0.4129.93 já presente por máquina**, `vcruntime140.dll`
presente. **Sem .NET, sem Rust, sem Flutter, sem MSVC.** Proteção em tempo real do Defender
desligada.

Correção de premissa: o payload não é 400 MB. *Fontes de sprite animado, licença e volume* já mediu
— `ani/` de frente são **154,63 MB em 1.686 arquivos**; com shiny, 307,94 MB. E como GIF comprime
~2%, **toda compressão de empacotamento deve ser desligada** em qualquer stack.

### O fato que decide quase tudo

Escrever os 1.686 arquivos (154,4 MB) em `%TEMP%` nesta máquina leva **2.801 ms** — em SSD, com
antivírus desligado. Esse é o piso de qualquer stack que materialize o payload no lançamento, antes
de uma linha de código do app rodar, e é mais de **duas vezes** todo o orçamento de aba do R5.

O mecanismo oposto é documentado pela Microsoft: recurso embutido num PE de 64 bits reserva espaço
de endereçamento mas é **paginado por demanda** — a página só entra quando tocada, então 155 MB
dentro do binário custam ~0 ms na abertura. **Tauri e WPF ganham isso. Electron `portable`,
PyInstaller onefile e WinUI 3 single-file não.**

### Comparação

| Stack | Tamanho | Cold start | Sem runtime? | Geist | GIF | Grid | Toolchain a instalar |
|---|---|---|---|---|---|---|---|
| **Tauri v2** | ~165–175 MB | `UNCONFIRMED`; sem extração em massa | **Sim no Win11** (WebView2 é componente do SO, verificado aqui) | **1:1**, eixos variáveis | nativo | TanStack / AG Grid, MIT | **Rust + MSVC C++** |
| **Electron** | ~400 MB | **~10 s reportado para hello-world portable** | Sim, absolutamente | **1:1**, Chromium fixado | nativo | idem, MIT | **nenhuma** |
| **.NET 9 WPF** | ~305 MB | **2–3 s medido** (em CPU mais rápida) | **Sim** — payload fica memory-mapped | próximo, não 1:1 | precisa `XamlAnimatedGif` | `DataGrid` maduro | .NET SDK |
| **WinUI 3** | ~385 MB | `UNCONFIRMED`; extrai ~385 MB pro `%TEMP%` | **frágil** | lacunas, sem kit | nativo | **nenhum mantido** | VS + workload WinUI |
| **Avalonia** | ~175–235 MB | `UNCONFIRMED` | sim, com ressalvas | **hairlines piores de todos** | `Labs.Gif` | `TableView` (12.1, novo) | .NET SDK |
| **Flutter** | **N/A** | — | **não** | melhor não-web, sem ClearType | nativo | fraco | Flutter SDK + VS |
| **Flet** | ~235 MB | **o pior** | sem Python, mas 0.25.1 chamava a rede | Material, fonte estática | nativo | **nenhum** | nenhuma |

### Eliminados, e o fato que matou cada um

- **Flet** — PyInstaller `--onefile` extrai tudo pro `%TEMP%` **a cada lançamento, sem cache** (três
  feature requests abertas pedindo cache). Os 2.801 ms medidos aqui. É literalmente o que o V1 fazia.
- **Flutter** — exe único foi fechado como **not planned** (#105655), com bloqueio no nível do
  engine (#57875). Assets são pasta por design.
- **WinUI 3** — o caminho suportado de exe único exige `IncludeAllContentForSelfExtract`, **duas
  docs atuais da Microsoft se contradizem** sobre ele, e o bug de lançamento está **aberto desde
  2024-11-16** (#10173). Somado a não ter grid mantido desde 2021.
- **Avalonia** — **borda de 1px fica invisível em 125% de DPI** (#8867). Para um design que *é*
  hairline de 1px e tabela densa, isso é o requisito, não um detalhe.

### Shortlist: Tauri v2, Electron, .NET 9 WPF

Os dois primeiros são a mesma arquitetura — e esse é o achado: **só stack de webview reproduz o
Geist 1:1** (eixos de fonte variável, hairline exato, shadcn/ui de graça). Todo stack não-web perde
fonte variável e o antialiasing de navegador.

### Duas medições que *Escolher a stack* precisa antes de fechar

1. **Reuso do diretório temporário do Electron `portable`** — `unpackDirName` usa por padrão um UUID
   de build, que deveria persistir entre lançamentos, mas relatos de campo contradizem. Esse número
   decide Electron (zero instalação) contra Tauri (Rust + MSVC).
2. **Build do Tauri no tamanho real de payload** — o bug aberto #12403 quebra builds na casa de 1 GB
   de assets; 155–310 MB é território não testado.

### Nota metodológica

A tentativa óbvia de medir cold start (`Process.MainWindowHandle` em polling) **falha em silêncio
para aplicativos multi-processo** — o que inclui todo stack de webview. O app precisa emitir um
timestamp de primeiro paint por conta própria. Isso vira requisito em *Arquitetura de performance* e
*Estratégia de verificação*.

### Tensão a resolver em *Escolher a stack*

Este ticket classifica o WPF como "próximo, não 1:1" no Geist. *Como reproduzir exatamente o visual
da Vercel* é mais específico e mais duro: o WPF **não tem propriedade de letter-spacing** — não
existe `CharacterSpacing` em `TextBlock` — e não suporta fonte variável. Como o tracking negativo de
heading é traço assinatura do Geist, a leitura mais dura provavelmente vence. Registrar a decisão
explicitamente em vez de deixar as duas avaliações coexistirem.
