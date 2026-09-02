# Planeador de Conjuntos e Lona

Componha, sobreponha e reveja esquemas coordenados.

## Visão Geral
O Planeador de Conjuntos oferece uma lona visual de avatar 2D (suportando tanto recortes de fotos reais do corpo do utilizador como manequins vetoriais dinâmicos SVG) com desvios de pontos de referência calibrados (`top-[14.5%]` do colar ao decote e `top-[36.5%]` da cintura à linha da cintura) para sobrepor peças superiores, inferiores, agasalhos e calçado perfeitamente alinhados com os limites do corpo.

## Pré-requisitos
- Itens de guarda-roupa guardados.

## Passo a Passo
1. **Selecionar Lona**: Abra o Planeador e clique num dia ou num novo rascunho.
2. **Sobrepor Itens**: Arraste vestuário sobre o avatar 2D. Os agasalhos ficam automaticamente sobrepostos às t-shirts interiores.
3. **Avaliar Ajuste**: Verifique as pontuações de compatibilidade e avisos (ex.: conflitos de cores ou alertas meteorológicos).
4. **Guardar**: Defina um título e agende o look no seu diário de guarda-roupa. As atualizaciones são transmitidas de forma segura através de `useOutfitStore`.

## Resultados Esperados
Composições de conjuntos sobrepostas com elegância guardadas no seu calendário e visíveis como pré-visualizações em cartões de grelha sem ciclos de consultas de rede em segundo plano.

## Resolução de Problemas
- **Ordem das camadas incorreta**: Reverifique a categoria do item; os agasalhos devem ser classificados como "Outerwear" para sobrepor corretamente.
- **Alertas de sobreposição**: Se o avatar avisar sobre uso repetido, verifique se vestiu o mesmo conjunto no mesmo local recentemente.

## Limitações
- As camadas são geridas automaticamente com base nas etiquetas de categoria; a substituição manual de z-index não é suportada.