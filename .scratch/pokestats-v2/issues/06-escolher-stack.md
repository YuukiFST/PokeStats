# 06 — Escolher a stack

Type: grilling
Status: —
Blocked by: 02, 03, 05, 20

## Question

Qual stack o PokeStats v2 usa?

A decisão amarra quase tudo depois dela: arquitetura de performance, pipeline de assets, i18n,
build e release, e o quanto o protótipo de UI pode ser fiel ao Geist.

Levar ao usuário os candidatos sobreviventes de *Candidatos de stack para desktop Windows offline e
rápido* com o trade-off explícito de cada um (tamanho, cold start, fidelidade visual, toolchain a
instalar, risco), recomendar um, e fechar.

Fechar junto: linguagem, gerenciador de pacotes, e se o projeto instala uma toolchain nova nesta
máquina.

**Delegação (R12):** o usuário passou esta decisão ao agente, com o critério explícito de priorizar
performance sem abrir mão da elegância da UI. O ticket continua exigindo que a escolha seja
**apresentada com os fatos decisivos**, não anunciada — quem decide delegou, não abdicou de
entender. Candidato extra trazido pelo usuário: Vercel Labs `native`, avaliado em
*Avaliar Vercel Labs `native` como stack*.
