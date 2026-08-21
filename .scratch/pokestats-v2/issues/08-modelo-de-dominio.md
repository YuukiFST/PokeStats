# 08 — Modelo de domínio e schema do Dataset

Type: grilling
Status: —
Blocked by: 07

## Question

Qual é a estrutura de dados que representa Species, Form, Base Stats, Tier, Set, Type Chart e Team?

Partir do glossário em `CONTEXT.md` e transformá-lo em schema concreto: chaves de identidade (dex
number para Species, slug estável para Form — o V1 usava só o nome e por isso não conseguia
agrupar `Charizard-Mega-X` sob `Charizard`), como Base Stats variam por Dex Generation, como Tier
se liga a (Form, Dex Generation), como um Set se liga a (Form, Dex Generation, Format), e como um
Team salvo referencia Forms de forma estável entre versões do Dataset.

Decidir também o formato de serialização do artefato embutido — JSON, SQLite, binário colunar,
estruturas pré-indexadas — junto de *Pipeline de dados* e sob a pressão de *Arquitetura de
performance*.

Usar `domain-modeling` e `codebase-design`. Atualizar `CONTEXT.md` com o que se firmar.
