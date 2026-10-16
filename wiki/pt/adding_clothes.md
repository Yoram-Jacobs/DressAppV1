# Cadastrar e Adicionar Roupas

Digitalize seu guarda-roupa físico em segundos com escaneamento por IA multimodal, remoção inteligente de fundo e reconstrução automática de imagens.

## Visão geral
Cadastre roupas usando fotos da câmera ao vivo, envio múltiplo da galeria, códigos QR do Passaporte Digital do Produto (DPP) ou recibos digitais (OCR de notas fiscais). A IA local (on-premises) integrada remove fundos automaticamente, identifica mais de 20 atributos de moda e prepara recortes limpos com qualidade de estúdio sem precisar de nenhuma chave de API.

## Pré-requisitos
- Fotos nítidas e bem iluminadas das peças (selfies no espelho, fotos de corpo inteiro ou roupas estendidas).
- Permissão de acesso à câmera para escanear peças físicas e códigos QR.
- Recibos digitais ou capturas de comprovantes de compra (PDF / PNG / JPEG) de compras online.

## Instruções passo a passo

1. **Captura e envio interativo**:
   - Toque em **Adicionar item** &rarr; selecione **Tirar foto** ou envie uma ou mais fotos de looks do seu dispositivo.
   - A detecção integrada de duplicatas verifica instantaneamente se você já havia enviado a mesma peça anteriormente.
2. **Segmentação por IA e detecção de múltiplos itens**:
   - O modelo de visão isola peças distintas (jaquetas, blusas, saias, calças, calçados, acessórios) em uma única análise.
3. **Recorte com IA e fotos limpas de estúdio**:
   - O pipeline de visão integrado remove automaticamente os fundos, gerando imagens PNG transparentes e nítidas para todas as contas.
4. **Marcação automática de metadados**:
   - As contas do plano gratuito (Free Tier) utilizam o motor **Eyes** local (on-premises) do DressApp (atualmente um modelo `Qwen 2.5 VL 3B` ajustado), enquanto os usuários dos planos **Manager** e **Professional** contam com o modelo rápido em nuvem (`Google Gemini 3.5 Flash`) para extrair mais de 20 atributos de moda (cores, composição do tecido, subcategoria, código de vestimenta, marca e estado de conservação).
5. **Restauração fotográfica generativa avançada (Nano Banana)**:
   - O Nano Banana inspeciona peças recortadas em busca de oclusões (bolsas, mãos) e cortes nas bordas, reconstruindo e preenchendo automaticamente o tecido ausente para criar fotografias de estúdio completas sem necessidade de chaves de API externas.
6. **Comprovantes digitais e etiquetas DPP**:
   - Alterne para **Importação digital** para analisar e-mails de confirmação de pedidos ou notas fiscais, registrando o preço de compra e os tamanhos verificados.
   - Toque em **Escanear QR (DPP)** na etiqueta para importar dados da cadeia de suprimentos e instruções de cuidado do Passaporte Digital de Produto da UE.
7. **Salvar no guarda-roupa**:
   - Toque em **Salvar**. Os itens aparecem imediatamente na grade do seu guarda-roupa.

## Resultados esperados
Cada peça aparece no seu guarda-roupa digital como uma fotografia centralizada e limpa com qualidade de estúdio, com atributos de busca totalmente indexados e etiquetas taxonômicas detalhadas.

## Solução de problemas
- **Peças cortadas ou parciais nas fotos**: Centralize bem a peça contra um fundo com bom contraste. O Nano Banana consegue reconstruir golas ou bainhas cortadas automaticamente.
- **Iluminação e contraste**: Para obter melhores resultados em peças escuras, fotografe contra fundos claros com bom contraste.
- **Inconsistências no OCR de recibos**: Use o seletor interativo sobre a imagem do comprovante para indicar manualmente cada linha de produto.

## Limitações
- Envios em lote de alta resolução (>5 itens) são processados por filas assíncronas em segundo plano para garantir um desempenho ágil sem limite de tempo esgotado no navegador.
