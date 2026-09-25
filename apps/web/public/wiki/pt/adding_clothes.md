# Cadastrar e adicionar roupas

Digitalize seu guarda-roupa físico em segundos com escaneamento por IA multimodal, remoção inteligente de fundo e conclusão automática de imagens.

## Visão geral
Cadastre roupas usando fotos da câmera ao vivo, upload múltiplo da galeria, códigos QR do Passaporte Digital do Produto (DPP) ou recibos digitais (OCR de notas). A IA integrada no servidor remove fundos automaticamente, identifica mais de 20 atributos de moda e gera fotos de estúdio limpas sem precisar de chaves de API.

## Pré-requisitos
- Fotos nítidas e bem iluminadas das peças (selfies no espelho, fotos de corpo inteiro ou roupas estendidas).
- Permissão de acesso à câmera para escanear peças e códigos QR.
- Recibos digitais ou capturas de comprovantes de compra (PDF / PNG / JPEG).
- *(Opcional)* Uma chave pessoal da Google Gemini API caso deseje utilizar a reconstrução fotográfica generativa do Nano Banana.

## Instruções passo a passo

1. **Captura e upload interativo**:
   - Toque em **Adicionar item** &rarr; selecione **Tirar foto** ou envie imagens do seu dispositivo.
   - O detector de duplicatas verifica imediatamente se você já havia cadastrado a mesma peça.
2. **Segmentação por IA e detecção múltipla**:
   - O modelo de visão isola peças individuais (jaquetas, blusas, saias, calças, sapatos, acessórios) em uma única análise.
3. **Recorte com IA e fotos profissionais**:
   - O pipeline integrado remove fundos automaticamente gerando imagens PNG transparentes e nítidas para todas as contas.
4. **Extração automática de metadados**:
   - A IA local reconhece mais de 20 atributos de moda (cores, composição do tecido, subcategoria, estilo, marca e estado de conservação).
5. **Restauração fotográfica avançada (Nano Banana)**:
   - Para usuários com chave própria da Google Gemini API, o Nano Banana analisa partes cortadas ou cobertas (bolsas, mãos) e reconstrói o tecido ausente em fotos de estúdio completas.
6. **Comprovantes digitais e etiquetas DPP**:
   - Mude para **Importação digital** para ler recibos e salvar preço de compra e tamanhos certificados.
   - Toque em **Escanear QR (DPP)** na etiqueta da peça para importar dados de cadeia de suprimentos e cuidados do Passaporte Digital Europeu.
7. **Salvar no closet**:
   - Toque em **Salvar**. As peças aparecem imediatamente na grade do seu armário.

## Resultados esperados
Cada peça fica armazenada como uma foto limpa de estúdio, perfeitamente centralizada e categorizada com etiquetas detalhadas de busca.

## Solução de problemas
- **Roupas cortadas na foto**: Centralize a peça contra um fundo com bom contraste. Se tiver uma chave de API configurada, o Nano Banana completará bainhas ou golas cortadas automaticamente.
- **Iluminação e contraste**: Para roupas escuras, fotografe contra fundos claros e bem iluminados.
- **Inconsistências em recibos**: Use a ferramenta de seleção sobre a imagem da nota fiscal para indicar manualmente as linhas de produtos.

## Limitações
- Envios em lote com mais de 5 itens são processados em segundo plano para manter a navegação ágil.
- A reconstrução fotorrealista de imagens com Nano Banana requer uma chave Google Gemini API configurada pelo usuário.
