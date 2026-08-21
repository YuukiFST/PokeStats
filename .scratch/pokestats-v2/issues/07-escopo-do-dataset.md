# 07 — Escopo do Dataset: quais Dex Generations, Formats e Forms

Type: grilling
Status: —
Blocked by: 01, 04, 19

## Question

O que exatamente entra no Dataset embutido?

Três eixos independentes, decididos juntos:

1. **Dex Generation** — o V1 lia só `sv`. O usuário pediu `xy`, `sm`, `ss` e `Champions`, e
   *Estrutura, volume e termos dos dados de Set do Smogon* confirmou que **as quatro existem**: o
   Smogon expõe dez gerações, `Champions` inclusive (323 espécies). Também confirmou que **Base
   Stats de fato diferem entre gerações** — Gengar tem SpD 130 em RB e 75 em GS —, então embutir
   várias significa versionar stats por geração, não só Sets. Quais entram?
2. **Format** — quais rulesets têm Sets embutidos (OU, UU, Ubers, LC, Monotype, Doubles, VGC).
   Multiplica volume e requisições.
3. **Form** — confirmar contra o achado de *Qual roster o Cobbleverse realmente tem*: quais Form
   Kinds entram (`mega`, `gmax`, `regional`, `battle-only`, `cosmetic`), lembrando que R8 já corta
   CAP e que formas cosméticas podem inflar o dex sem informação nova.

Sair com números: quantas Forms, quantos Sets, quantos MB.
