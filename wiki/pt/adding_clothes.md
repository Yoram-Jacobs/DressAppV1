# Digitalização e Adição de Roupas

Digitalize seu guarda-roupa físico em segundos com escaneamento multimodal por IA, remoção inteligente de fundo e restauração automática de imagens.

## Visão Geral
Adicione roupas usando fotos da câmera ao vivo, upload em lote da galeria, tags QR de Passaporte Digital do Produto (DPP) ou recibos digitais (OCR de notas fiscais). A IA integrada remove o fundo automaticamente, identifica atributos de moda, avalia a integridade do recorte e reconstrói peças ocluídas ou cortadas.

## Pré-requisitos
- Fotos nítidas e bem iluminadas das peças (selfies no espelho, fotos de look de corpo inteiro ou fotos flat-lay).
- Permissão de acesso à câmera para fotografar peças e ler códigos QR.
- Recibos digitais ou capturas de tela de pedidos (PDF / PNG / JPEG) para compras online.

## Passo a Passo

1. **Captura e Envio Interativo**:
   - Toque em **Add Item** (Adicionar Item) &rarr; selecione **Take Photo** (Tirar Foto) ou envie uma ou mais fotos do seu dispositivo.
   - O detector de duplicados integrado verifica instantaneamente se você já enviou a mesma peça anteriormente.
2. **Segmentação por IA e Detecção de Múltiplos Itens**:
   - O modelo de visão isola peças distintas (jaquetas, blusas, saias, calças, calçados e acessórios) em uma única passagem.
3. **Verificador de Qualidade e Restauração Automática**:
   - O Quality Checker do Gemini inspeciona cada item recortado:
     - **Complete (Completo)**: Peças intactas e sem oclusões têm o fundo removido diretamente.
     - **Image Completion (Complementação de Imagem)**: Se a peça tiver contornos faltando, oclusões (por bolsas ou braços) ou golas/barras cortadas, a IA expande e recria o tecido ausente automaticamente.
     - **Full Studio Reconstruction (Reconstrução Completa em Estúdio)**: Peças muito cortadas (como sapatos mostrando apenas a ponta) são totalmente reconstruídas em fotos de catálogo de estúdio impecáveis.
4. **Etiquetagem Automática de Metadados**:
   - A IA extrai mais de 20 atributos de moda (cores, composição do tecido, subcategoria, dress code, marca e estado de conservação).
5. **Recibos Digitais e Etiquetas DPP**:
   - Mude para **Digital Import** (Importação Digital) para ler e-mails de confirmação de compra ou faturas, fixando o preço pago e o tamanho verificado.
   - Toque em **Scan QR (DPP)** na etiqueta da peça para importar dados de cadeia de suprimentos e instruções de lavagem do Passaporte Digital do Produto da UE.
6. **Salvar no Closet**:
   - Toque em **Save** (Salvar). Os itens aparecem imediatamente na grade do seu Closet, enquanto as restaurações generativas são finalizadas em segundo plano.

## Resultados Esperados
Cada peça aparece no seu guarda-roupa digital como uma foto centralizada e limpa de estúdio, com filtros de busca indexados e etiquetas ricas de taxonomia.

## Solução de Problemas
- **Peças cortadas ou parciais nas fotos**: A IA detecta cortes automaticamente e reconstrói as peças; você também pode tocar em **Repair Photo** (Reparar Foto) no cartão de detalhes do item para acionar a regeneração manual em estúdio.
- **Iluminação e Contraste**: Para obter os melhores resultados em roupas escuras, fotografe contra fundos contrastantes e claros.
- **Divergências no OCR de Recibos**: Use o seletor de área interativo na imagem do recibo para delimitar manualmente a linha exata do produto.

## Limitações
- Uploads em lote de alta resolução (>5 itens) são processados por meio de filas assíncronas em segundo plano para assegurar alta performance sem timeout no navegador.