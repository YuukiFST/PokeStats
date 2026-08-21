# 12 — Arquitetura de informação: quais telas e o que vive em cada

Type: grilling
Status: resolved
Blocked by: 07

## Question

Quais são as telas do PokeStats v2, o que cada uma mostra, e como o usuário navega entre elas?

Ponto de partida: R9 fixa o escopo mínimo (Pokédex com busca e filtro, ranking por stat, comparação
até 4, detalhe com stats e efetividade, Sets com Showdown Export, Tier, Team builder, Settings).
Este ticket decide a *forma*, não o escopo.

Questões concretas: a tela Home do V1 era um botão de carregar dados e três cards decorativos que
não clicavam — com Dataset embutido não existe mais nada para carregar, então Home some ou vira
outra coisa; Pokédex e Ranking são duas telas ou uma tabela com modos; onde os Sets vivem (aba da
tela de detalhe, ou tela própria pesquisável por move e item); como a comparação é iniciada a partir
do dex; como Species e Form aparecem na navegação, já que uma Species tem várias Forms e o V1
tratava cada Form como criatura solta; e o que Settings contém (idioma, tema, toggles de Form Kind,
Dex Generation ativa).

Fechar também o esqueleto de navegação — o V1 chaveava telas por índice inteiro e o shell
manipulava widgets privados de telas específicas por índice.

## Answer

### Resumo

Cinco destinos, numa barra lateral fixa: **Dex**, **Compare**, **Teams**, **Settings**, e o detalhe
de Form como rota própria alcançada a partir do Dex.
A Home do V1 **não volta**.
Pokédex e Ranking são **uma tabela com dois modos**, não duas telas.
Os Sets vivem numa **aba do detalhe**, não em tela própria.
Navegação é por **rota nomeada por string**, com o `FormId` do ticket 08 servindo de segmento sem
transformação.
A tabela tem **colunas escolhidas pelo usuário e persistidas**, uma seleção por modo.

### 1. As telas

| destino | o que é | como se chega |
|---|---|---|
| **Dex** | tabela de Forms, dois modos: Pokédex e Ranking | destino de topo; tela inicial |
| **Form detail** | stats, Defensive Profile, abas incluindo Sets | rota `/form/<FormId>`, a partir do Dex ou da paleta |
| **Compare** | até 4 Forms lado a lado | seleção feita no Dex, botão na barra de seleção |
| **Teams** | Team builder; o conteúdo é decisão do ticket 13 (issue #14) | destino de topo |
| **Settings** | idioma e tema, só | destino de topo |
| **Loading** | duas etapas nomeadas, `core` e `sets` | abertura do programa |

**A Home some.**
No V1 ela era um botão de carregar dados mais três cards decorativos que não clicavam.
Com o Dataset embutido não há o que carregar nem o que anunciar, e uma Home que só decora é a mesma
tela morta reconstruída com CSS melhor.
O programa abre no Dex.
O momento da abertura já tem dono: a tela de carregamento, que o R5 revisado exige.

### 2. A tabela: uma, com dois modos

Pokédex e Ranking eram duas telas no V1. Agora são **uma tabela, dois modos**.

O dado é idêntico; o que muda é a ordenação padrão, as colunas em destaque e a regra de colapso da
seção 3.
Duas telas duplicariam o estado de filtro, e o usuário perderia a busca que acabou de montar ao
atravessar de uma para a outra — o tipo de descontinuidade que faz um programa parecer três
programas mal costurados.

### 3. Species e Form na navegação

**A linha é sempre uma Form.**
O `CONTEXT.md` já obriga: ranking, comparação e análise de tipo operam sobre Forms.
Species não vira linha e **não vira coluna** — ela já está contida no nome (`Charizard-Mega-X`), e
gastar largura repetindo `Charizard` ao lado é redundância pura.
Species aparece como cabeçalho na tela de detalhe, onde tem função de agrupar.

Isso cria um caso patológico, e ele é só do modo **Ranking**:

- 792 das 1025 Species têm **uma Form só** — para 77% do dex a distinção é invisível.
- `Arceus` e `Silvally` têm **18 Forms cada**, com **BaseStatSpread idêntico**, variando só o tipo.

Ordenar por stat com 18 `Arceus-*` empatados é exatamente a poluição que o V1 produzia.
A correção **não** é filtrar por Species — é **colapsar empate de BaseStatSpread dentro da mesma
Species, apenas no modo Ranking**, exibindo uma linha `Arceus` com o marcador `+17 formas`.
No modo Pokédex não há colapso: ali o usuário está navegando, não classificando, e esconder Forms
seria mentir sobre o que existe.

### 4. Detalhe da Form

**Rota cheia, não modal nem painel.**
Ele tem abas — stats, Defensive Profile, Sets — e a aba de Sets chega a **149 Sets** em
`Landorus-Therian`, com até **46** num único par (Form, Dex Generation).
Tabela dentro de modal em cima de tabela é armadilha de rolagem e de foco.

O argumento a favor do painel lateral é não perder o lugar na lista; a rota nomeada da seção 7
resolve isso por outro caminho, sem pagar esse preço.

**Os Sets vivem aqui, numa aba, com filtro de Dex Generation e de Format dentro dela.**
Não há tela global de Sets pesquisável por move e item.
O R9 pede "Sets do Smogon com Showdown Export", não um navegador global.
E os números obrigam o filtro de qualquer maneira — 61 Formats distintos, 149 Sets numa Form — ou
seja, a aba precisa exatamente da mesma UI de filtragem que uma tela global precisaria.
Construir uma vez, dentro da aba.
Se depois o navegador global for desejado, ele reaproveita esse componente em vez de competir com
ele.

**Showdown Export é um botão de copiar no cabeçalho de cada Set**, com confirmação visual curta no
próprio botão.
Não em menu de contexto, não numa barra que age sobre "o Set selecionado": com 46 Sets num par,
qualquer coisa que dependa de seleção prévia acrescenta um passo à ação mais frequente da tela.
O texto sai do Set em memória, sem passar pelo lado Rust — mesma decisão do ticket 08.

### 5. Comparação

**A seleção acontece na própria tabela do Dex**, com uma barra fixa mostrando os escolhidos e o
botão de comparar.

Nada de tela de comparação com busca própria.
O Dex já tem busca, filtro e ordenação, e recriá-los dentro da comparação é o defeito do V1 de ter
telas que não conversam entre si.

### 6. Favoritos, Teams e Settings

**Favoritos não têm tela.**
São uma coluna de estrela na tabela do Dex mais um filtro "só favoritos".
Uma tela de Favoritos seria a mesma tabela com um filtro diferente, e passaria a existir em dois
lugares: duas buscas, dois conjuntos de filtro, duas chances de divergirem.

**Teams é destino de topo**, e a escolha de qual Team editar acontece dentro dele, nunca na
navegação.
Se o ticket 13 (issue #14) decidir que existem N Teams salvos, a barra lateral não deve crescer com
N — senão navegação vira lista de dados, que é outra coisa que o V1 misturava.

**Settings contém idioma (R6) e tema (R7). Só isso.**
Filtro de trait, filtro de Dex Generation e escolha de colunas **não** entram em Settings: são
estado da tela onde agem.
Filtro escondido em Settings é a maneira mais confiável de o usuário olhar uma tabela incompleta sem
entender por quê, e ter que caçar a causa duas telas adiante.

**Não existe seletor global de Dex Generation.**
O ticket 08 fixou que a Canonical Table é `sv` e que os Overrides de stat e de tipo só afloram
dentro de um Set daquela geração.
Geração é, portanto, uma faceta dentro da aba de Sets.
Um seletor global obrigaria toda tela a re-resolver stats, tipos e Tier por geração — exatamente a
complexidade que o ticket 08 tirou do caminho.
Comparar Gengar de `rb` contra o de `sv` lado a lado é uma feature separada, registrada como fora de
escopo em vez de contaminar todas as telas.

### 7. Esqueleto de navegação

**Rotas nomeadas por string, com um router de verdade.**
Uma Form é `/form/charizardmegax` — o `FormId` do ticket 08 é o segmento da rota sem transformação
nenhuma.

O V1 chaveava telas por índice inteiro, e o shell alcançava widget privado de tela específica por
esse índice. Três ganhos concretos ao trocar:

- o shell deixa de conhecer o interior das telas;
- "voltar" passa a existir de graça;
- a posição na tabela é restaurável ao voltar do detalhe, que é o que torna suportável navegar
  1.325 linhas.

**Router: TanStack Router**, pela consistência com o TanStack Table e o TanStack Virtual que o
ticket 06 já fixou. `react-router` faz o mesmo trabalho e a troca é barata — a decisão é reversível
e pequena.

**Shell: barra lateral à esquerda**, ícone mais rótulo, colapsável.
Aqui o projeto se afasta de propósito da referência visual: a Vercel usa navegação no topo com
breadcrumbs porque navega entre recursos que mudam de nome e de quantidade.
O PokeStats tem cinco destinos fixos e uma tela principal que é tabela larga.
Lateral fixa custa cerca de 200px de largura e devolve o destino sempre visível, sem gastar altura —
que é o eixo escasso numa tabela densa.
Os tokens do `geist-tokens.css` continuam valendo integralmente; o que muda é o arranjo, não a
linguagem visual.

**Paleta de comandos em `Ctrl+K`**, saltando direto para uma Form.
É o gesto assinatura da linguagem visual que o R7 escolheu, e sai quase de graça: as 1.325 Forms já
estão em memória pelo ticket 08, e o índice de busca por nome já é construído na carga.
A busca da tabela continua existindo e faz **outra coisa** — ela filtra as linhas visíveis; a paleta
navega.
Confundir as duas seria fazer a paleta filtrar a tabela por trás, e aí o usuário fecha a paleta e a
tabela mudou sem ele ter pedido.

### 8. Colunas escolhidas pelo usuário

**O usuário escolhe quais colunas aparecem, e a escolha é persistida.**

O seletor fica na barra de ferramentas da própria tabela, **não em Settings** — mesma regra da
seção 6: o controle mora onde age.

**Padrão:** nome, tipos, os seis Base Stats, BST, Tier.

- **Abilities ficam fora do padrão** — texto longo e variável, matam a densidade que o R7 pede, e
  têm lugar garantido no detalhe.
- **Traits não são coluna** — são filtro (decisão do ticket 08), e o que a linha precisa comunicar
  sobre isso já está no nome da Form.
- **Tier é coluna com badge**, não etiqueta solta na linha. São 16 valores distintos em `sv`, e o
  maior balde é `National Dex` com 397 Forms: quase um terço da tabela carregando o mesmo badge.
  Como coluna ele é ordenável e filtrável e ganha função; espalhado pela linha vira ruído colorido
  repetido 397 vezes.

**Uma seleção de colunas por modo**, gravada como `columns.pokedex` e `columns.ranking`.
Os dois modos existem justamente porque colunas diferentes importam em cada um; uma seleção
compartilhada faria a troca de modo deixar de ter efeito visível, e a seção 2 perderia o sentido.

Duas travas:

- **`Nome` não é ocultável.** É a identidade da linha; sem ela a tabela é uma grade de números sem
  sujeito.
- **No modo Ranking, a coluna que está sendo ordenada é exibida mesmo se oculta**, e volta a sumir
  quando o critério muda. Sem isso é possível ordenar por BST com BST escondido, e a tabela fica
  numa ordem que nada na tela explica.

**Filtro e busca independem de visibilidade.** Ocultar coluna é decisão de leitura, não de escopo do
dado — o Dataset inteiro está em memória de qualquer forma (ticket 08), então amarrar as duas coisas
não economiza nada e produziria o pior efeito possível: o usuário esconde Tier por preferência
estética e descobre semanas depois que o filtro por Tier sumiu junto, sem nada ligando uma coisa à
outra.

**Sem coluna de sprite, por ora.**
Sprite depende do ticket 10 — Pipeline de assets (issue #11), que está bloqueado pelo ticket 21
(issue #22).
A tabela é desenhada para funcionar sem sprite; se o pipeline de assets entregar, a miniatura entra
como coluna à esquerda sem rearranjar o resto.
O caminho contrário — desenhar contando com sprite e descobrir depois que o custo não fecha —
deixaria a tela principal do programa dependendo de um ticket que ainda não pode nem rodar.

### 9. Estados vazios e carregamento

**O estado vazio nomeia a causa e oferece o desfazer.**
"Nenhuma Form corresponde a *dragon* com megas ocultas", com botão para limpar o filtro que está
cortando.
Estado vazio genérico é como o usuário conclui que o programa está quebrado quando ele só está
filtrado — a mesma falha que o V1 tinha na mensagem do coletor, "Could not find data on the
website", que não dizia o que fazer nem o que tinha acontecido.

**A tela de carregamento mostra duas etapas reais e nomeadas**, `core` e depois `sets` — que é
precisamente o motivo pelo qual o ticket 08 manteve o artefato em dois arquivos.
Barra de progresso falsa, animada por temporizador, está fora: se as etapas são reais, reportá-las é
honesto e não custa nada.

### 10. O que este ticket empurra para outros

- **O conteúdo do Team builder** — ticket 13 (issue #14). Aqui só ficou decidido que ele é destino
  de topo e que a lista de Teams vive dentro dele.
- **Onde as preferências de coluna são gravadas** — ticket 22 (issue #25), que já cobre favoritos,
  Teams e preferências. Acrescentadas `columns.pokedex` e `columns.ranking` ao escopo de lá.
- **Coluna de sprite** — ticket 10 (issue #11), bloqueado pelo ticket 21 (issue #22).
- **Como as strings de chrome são traduzidas**, incluindo rótulos de coluna e nomes de tela —
  ticket 16 (issue #17).
- **Atalhos de teclado, ordem de foco e leitor de tela** — a arquitetura de informação era o que
  faltava para especificar isso; graduou da névoa para ticket próprio.

### 11. Fora de escopo

- **Comparar a mesma Form entre Dex Generations lado a lado.** Exigiria um seletor global de geração
  e faria toda tela re-resolver stats por geração, desfazendo a simplificação do ticket 08.
- **Navegador global de Sets pesquisável por move e item.** O R9 não pede, e a aba de Sets do
  detalhe cobre o caso real com o mesmo componente.
