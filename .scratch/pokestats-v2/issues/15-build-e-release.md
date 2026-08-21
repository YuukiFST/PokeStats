# 15 — Build e release do executável portátil

Type: grilling
Status: —
Blocked by: 06, 09, 10, 21

## Question

Como um `.exe` portátil único (R3) é produzido, e como uma release chega aos 4 usuários?

Decidir: o comando único que produz o executável a partir de um clone limpo; como o Dataset e os
assets entram no binário e como o app os endereça em runtime — o V1 resolvia o caminho do cache
contra o diretório de trabalho atual, então o arquivo ia parar onde o usuário lançou o programa e a
escrita falhava em silêncio dentro de Program Files; onde ficam de fato os dados do usuário (R10:
`%APPDATA%\PokeStats\`, com fallback para o diretório do executável); se a build roda em CI ou só
na máquina local, dado que o alvo é Windows; como a release é publicada e versionada no GitHub; e o
que o usuário baixa — um `.exe` cru, ou um zip com README.

Fechar também: o executável não é assinado, então o SmartScreen vai avisar. Decidir o que dizer aos
usuários sobre isso.
