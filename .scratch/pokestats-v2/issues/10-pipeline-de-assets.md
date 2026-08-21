# 10 — Pipeline de assets: sprites animados

Type: grilling
Status: —
Blocked by: 02, 06, 21

## Question

Qual conjunto de sprites o PokeStats usa, em que formato, e como ele é empacotado?

R4 removeu o teto de tamanho, então a preferência é sprite animado em todo lugar. Decidir com base
em *Fontes de sprite animado, licença e volume*: qual conjunto, e qual fallback para as Forms que o
conjunto animado não cobre — se os animados pararem na Gen 5, a maior parte do dex moderno fica
sem; se há conversão de formato na build (GIF para WebP animado, por exemplo) e o custo disso; como
os arquivos são embutidos e endereçados a partir de um slug de Form; como a licença encontrada é
respeitada e atribuída; e o que aparece quando um sprite está ausente.

Fechar também: sprite animado numa lista de centenas de linhas é caro em CPU — decidir se a
listagem usa estático e a tela de detalhe usa animado, ou se tudo anima e a virtualização segura.
Cruza com *Arquitetura de performance*.

**Nota vinda de *Fontes de sprite animado, licença e volume* (fechado):** o conjunto que o Smogon
usa é `ani/`, GIF animado, 1.686 arquivos, **154,63 MB só de frente**, e comprimir não ajuda (2%).
Nenhuma fonte concede direito de redistribuição dentro de um binário; o `smogon/sprites` pede
contato prévio por e-mail. Este ticket precisa fechar **duas** decisões separadas: qual conjunto
técnico, e o que fazer diante da licença — usar assim mesmo, escrever para
`staff@pokemonshowdown.com` antes, ou trocar por outra fonte. A segunda é decisão do usuário, não
do agente.
