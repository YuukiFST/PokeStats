# 12 — Arquitetura de informação: quais telas e o que vive em cada

Type: grilling
Status: —
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
