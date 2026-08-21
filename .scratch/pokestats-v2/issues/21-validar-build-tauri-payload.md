# 21 — Validar o build do Tauri com o payload real de assets

Type: task
Status: —
Blocked by: 06

## Question

Um build de Tauri v2 no Windows aguenta embutir de 155 a 310 MB de GIF animado num `.exe` único, e
o binário resultante abre rápido?

Este é o único fato que pode derrubar a decisão de *Escolher a stack*. O bug aberto **#12403 do
Tauri** quebra builds na casa de 1 GB de assets; a faixa deste projeto nunca foi testada
publicamente. Enquanto isso não for medido, *Pipeline de assets* e *Build e release* estão apoiados
numa suposição.

Não há o que decidir aqui — há trabalho manual a fazer, e ele destrava decisões.

## Checklist

1. **Aprovação do usuário para mudar a máquina.** Instalar `rustup` com toolchain MSVC e as Build
   Tools do Visual Studio com workload C++. Node 22.18.0 já está presente. Não instalar nada antes
   de o usuário aprovar.
2. Baixar um recorte representativo do conjunto `ani/` do Pokémon Showdown — o suficiente para
   chegar perto de 155 MB, incluindo os arquivos extremos medidos em *Fontes de sprite animado,
   licença e volume* (`charizard-gmax.gif` com 593.355 B, `koraidon.gif` com 325.605 B).
3. Montar um Tauri v2 mínimo com React + Vite que embuta esses arquivos no binário e renderize uma
   grade virtualizada com centenas de sprites animados visíveis ao mesmo tempo.
4. Medir e registrar, nesta máquina (i3-9100F sem gráfico integrado, SSD SATA):
   - o build completa, ou falha e com qual erro
   - tempo de build e pico de memória do compilador
   - tamanho final do `.exe`
   - **cold start até o primeiro paint**, com o aplicativo emitindo o próprio timestamp — polling de
     `Process.MainWindowHandle` falha em silêncio em aplicativo multi-processo
   - uso de memória e taxa de quadros com centenas de GIFs animados na tela
   - se compressão de empacotamento está desligada (GIF comprime ~2%; ligada, só custa tempo)
5. Repetir o passo 4 com o dobro do payload (~310 MB), para saber onde está a parede.

## Resultado esperado

Um número por item acima. Se o build falhar, registrar o erro exato e reabrir *Escolher a stack*
com o fato em mãos — plano B é Electron aceitando o custo de tamanho e de abertura, ou reduzir o
payload de sprite.
