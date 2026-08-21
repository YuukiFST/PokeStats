# 11 — Arquitetura de performance e orçamento medido

Type: grilling
Status: —
Blocked by: 06, 08, 09, 10

## Question

Como a aplicação atinge R5 — abertura rápida, aba em menos de 1s, interação instantânea — com o
Dataset e os assets escolhidos, e como isso é medido em vez de afirmado?

Primeiro, transformar R5 em números com método: qual é o alvo de cold start até a UI interativa,
qual o alvo de troca de aba, qual o alvo de busca/filtro/ordenação sobre o dex inteiro, e em que
máquina isso é medido.

Depois, decidir a arquitetura que entrega: quando o Dataset é carregado (tudo no boot, lazy por
aba, memória mapeada); quais índices existem em vez de varredura linear (o V1 fazia duas varreduras
O(n) e duas cópias da lista de 1.399 **a cada tecla digitada**, sem debounce, e ainda truncava o
resultado em 50 itens para não travar); se a lista é virtualizada; o que é pré-computado na build
em vez de em runtime (perfis defensivos, rankings por stat, índice de prefixo de nome); e como o
trabalho pesado sai da thread de UI sem os problemas de thread-safety do V1.

Sair com decisões executáveis e com os gates que *Estratégia de verificação* vai transformar em
teste.
