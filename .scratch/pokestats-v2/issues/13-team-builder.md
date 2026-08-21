# 13 — Design do Team builder e da análise de cobertura

Type: grilling
Status: —
Blocked by: 08, 12

## Question

O que o Team builder faz, exatamente, e que análise ele mostra?

O V1 só tinha efetividade defensiva de uma Form isolada. Um Team de 6 traz perguntas novas:
como agregar o perfil defensivo de 6 Forms — contagem de fraquezas compartilhadas, buraco onde
ninguém resiste, redundância; como calcular a cobertura ofensiva, dado que o app **não** carrega
movepool (fora de escopo) e portanto a cobertura só pode vir dos moves dos Sets escolhidos ou de
tipos que o usuário seleciona à mão; se um slot do Team é uma Form crua ou uma Form + Set; se o app
sugere o que falta ou apenas reporta; quantos Teams podem ser salvos e como são nomeados; e se
existe importação/exportação no formato de texto do Showdown para o Team inteiro.

Decidir qual visualização comunica um buraco defensivo de forma legível — matriz 18 tipos × 6
membros, ou resumo agregado, ou os dois.
