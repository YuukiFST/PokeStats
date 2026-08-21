# 02 — Fontes de sprite animado, licença e volume

Type: research
Status: resolved
Blocked by: —

## Question

De onde vêm sprites animados de Pokémon que possam ser embutidos num executável offline, e qual é o
custo e a licença de cada opção?

Sub-perguntas: o que exatamente a página do dex do Smogon renderiza (URL real, formato, host —
Smogon ou play.pokemonshowdown.com); quais conjuntos existem em
`play.pokemonshowdown.com/sprites/` (`ani`, `ani-back`, `gen5`, `gen5ani`, `dex`), formato,
dimensões, tamanho por arquivo e cobertura de geração — em especial se os animados cobrem Gen 6–9
ou param na Gen 5; cobertura de megas, Gmax e formas regionais e a convenção de nome de URL;
tamanho total estimado para ~1.400 Forms com aritmética explícita; o que o repo `PokeAPI/sprites`
carrega e sob qual licença; onde vive a official artwork e seu volume; e, por fonte, quais termos
governam **redistribuição dentro de um binário baixável** — separando "o que projetos fan fazem" de
"o que é de fato licenciado". Por fim, uma linha por framework (Electron/webview, WPF/WinUI,
Flutter, Tauri) sobre renderizar GIF animado nativamente.

Alimenta *Pipeline de assets: sprites animados* e é insumo secundário de *Escolher a stack*.

## Answer

**O que o Smogon renderiza.** A página do dex monta a URL do sprite em JavaScript, no bundle da SPA
— não há `<img>` no HTML cru, e nada aponta para `pokemonshowdown.com`. A função é:

```js
function spritePath(pkmn) {
  let alias = pkmn.alias, gen = pkmn.gen.alias, dir = gen, ext = "png";
  if (gen == "gs")                       { dir = "c";  ext = "gif"; }
  else if (gen === "bw" || gen === "xy") { ext = "gif"; }
  else if (gen === "sm" || gen === "ss" || gen === "sv" || gen === "champions")
                                         { dir = "xy"; ext = "gif"; }
  return `/dex/media/sprites/${dir}/${alias}.${ext}`;
}
```

Ou seja, para SV/SS/SM: `https://www.smogon.com/dex/media/sprites/xy/<alias>.gif`, aplicado como
`background-image` num `div.PokemonAltInfo-sprite`. **GIF animado**, não WebP nem APNG.
`charizard.gif` = 84.175 bytes, 133×140, ~47 frames.

**São os mesmos bytes do Pokémon Showdown.** `play.pokemonshowdown.com/sprites/ani/charizard.gif`
também tem 84.175 bytes. Ambos são alvos de deploy do mesmo repo de build, `github.com/smogon/sprites`.

**Os animados NÃO param na Gen 5.** `ani/` cobre Gen 1–9 — confirmado HTTP 200 para `greninja`,
`dragapult`, `koraidon`, `gholdengo`, `meowscarada`, `greattusk`, `archaludon` e ~40 outros
modernos. A cauda: ~6 espécies recentes (`miraidon`, `ogerpon`, `terapagos`, `pecharunt`,
`ironvaliant`, `ironbundle`) dão 404 no Showdown e resolvem no espelho do Smogon como **GIF
estático de 1 frame**. Então: animado em quase tudo, fallback estático numa ponta pequena.

**Cobertura de formas em `ani/` (1.686 arquivos).** 79 `-mega`, 3 `-megax` + 3 `-megay`, 27
`-gmax`, 19 `-alola`, 19 `-galar`, 16 `-hisui`, 4 paldeanas, 95 `-f`, 9 `-totem`, mais primals,
Origin, Ultra, Crowned.

**Dois esquemas de nome incompatíveis** — isto vira decisão de chaveamento:

| Conceito | Showdown `ani/` | Smogon `xy/` |
|---|---|---|
| Mega Charizard X | `charizard-megax.gif` | `charizard-mega-x.gif` |
| Great Tusk | `greattusk.gif` | `great-tusk.gif` |
| Iron Valiant | 404 | `iron-valiant.gif` (estático) |
| Tauros Paldea Combat | `tauros-paldeacombat.gif` | `tauros-paldea-combat.gif` |

O espelho `PokeAPI/sprites` em `other/showdown/` é **byte a byte idêntico ao `ani/`** e chaveado
por **número de dex** (`6.gif`, forma = id alto como `10034.gif`) — junção mais fácil que qualquer
um dos dois esquemas de nome, ao custo de estar levemente defasado (1.477 contra 1.686 arquivos).

**Volumes reais** (soma dos índices de diretório, não estimativa):

| Conjunto | Arquivos | Total | Animado |
|---|---|---|---|
| `ani/` (frente) | 1.686 | **154,63 MB** | sim, GIF |
| `ani/` + `ani-shiny/` | 3.329 | 307,94 MB | sim |
| `gen5ani/` (frente, estilo BW) | 1.255 | 61,06 MB | sim |
| `dex/` 120×120 PNG | 1.457 | 6,38 MB | não |
| `gen5/` 96×96 PNG | 1.667 | 1,69 MB | não |
| official artwork 475×475 | 1.339 | 162,44 MB | não |

**Comprimir não adianta.** Medido em 10 GIFs reais (748.383 B crus): `gzip -9` chega a 97,8%,
`xz -9` a 97,9%. LZW do GIF já está comprimido — o número cru é o número final.

**Renderizar GIF animado:** nativo em Electron, Tauri/WebView2, Flutter e WinUI 3. **WPF não** —
`Image` mostra só o primeiro frame, precisa do pacote `WpfAnimatedGif`. Com ~1.700 GIFs embutidos,
qualquer stack precisa de decode preguiçoso.

### Licença — o achado incômodo

Nenhuma fonte encontrada concede direito de redistribuir estes sprites dentro de um binário
distribuído.

- `github.com/smogon/sprites` não tem LICENSE na raiz. O README diz: o **MIT cobre só o código**;
  os sprites são *"property of Nintendo / Game Freak / The Pokémon Company"*; e sobre os sprites
  estilo Black & White desenhados pela comunidade para gerações posteriores — exatamente os que
  interessam — *"The license for these community-created sprites is still being determined and may
  change in the future, but in the meantime please talk to use [sic] first before using them."*
- `PokeAPI/sprites` tem `LICENCE.txt` declarando **CC0 1.0**, precedido literalmente por
  `All image contents within are Copyright The Pokémon Company.` O arquivo se contradiz: CC0 só
  renuncia direitos que o declarante possui, e a primeira linha diz que ele não os possui. E o
  conteúdo é espelho dos GIFs do Showdown, não obra do PokéAPI.
- Official artwork e renders HOME são reprodução direta de arte oficial da TPC.

Distinguindo o que projetos fan fazem do que é licenciado: baixar o repo inteiro é comum e o
próprio README do PokeAPI convida a isso; hotlink em runtime é onipresente (e incompatível com R2).
Licenciado para redistribuição num `.exe`: **nenhuma fonte afirma isso**. O único caminho apontado
por fonte é escrever para `staff@pokemonshowdown.com`, como o `smogon/sprites` pede.

Isto não é parecer jurídico — é o que as fontes dizem. A decisão fica em *Pipeline de assets*.
