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
