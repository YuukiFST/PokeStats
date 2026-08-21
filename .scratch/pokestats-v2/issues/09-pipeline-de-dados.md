# 09 — Pipeline de dados: coletor de build e artefato embutido

Type: grilling
Status: —
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
