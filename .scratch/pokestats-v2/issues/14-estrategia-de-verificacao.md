# 14 — Estratégia de verificação: oráculos e gates

Type: grilling
Status: —
Blocked by: 06, 11

## Question

Como se prova que o PokeStats v2 está correto e rápido, sem depender de alguém clicar no programa?

Usar a skill `prove`. O V1 tinha zero testes, zero CI e nenhum type checking — e embarcava um bug
grosseiro (a classe `CompareView` definida duas vezes no mesmo arquivo, a segunda sombreando a
primeira) que qualquer lint teria pego.

Decidir: quais oráculos existem para a lógica de domínio (tabela de tipos, agregação defensiva,
ordenações, BST) e se propriedades matemáticas cabem — por exemplo, efetividade de um tipo contra
uma Form dual é o produto dos dois multiplicadores, e a soma dos seis Base Stats é o BST; que
validação de Dataset roda como gate na build (contagem de Forms, zero CAP, toda Form com seis
stats e ao menos um tipo, todo Set apontando para Form existente); como o orçamento de performance
de *Arquitetura de performance* vira um teste que falha com exit code diferente de zero em vez de
uma promessa; qual a fatia de teste de UI, se houver; e o que roda em CI dado que o alvo é Windows.
