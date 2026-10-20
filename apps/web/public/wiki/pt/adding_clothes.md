# Adicionar Roupas (Adding Clothes)

## Visão Geral
O motor **Adicionar Roupas** do DressApp utiliza três pipelines inteligentes que se adaptam automaticamente à sua foto:
1. **Recorte de Peça Única (`single`)**: Remoção rápida de fundo para uma única peça não vestida (não consome créditos de reconstrução).
2. **Divisão de Look Vestido (`worn`)**: Separa cada peça de uma foto de corpo inteiro e reconstrói cada item em uma foto de estúdio Nano Banana.
3. **Upload de Conjunto de Peças (`mass`) — Digitalização em Massa Revolucionária *(Apenas Manager e Professional)***: Identifica e reconstrói dezenas de peças a partir de uma única foto — roupas penduradas no armário ou em cabides, uma sapateira, uma pilha de camisas ou peças espalhadas na cama.

## O Que o Upload de Conjunto (Cluster) Pode Identificar
Você não precisa espalhar cada peça na cama! Este recurso revolucionário permite fotografar suas roupas diretamente no seu guarda-roupa físico, usar menos fotos e digitalizar seu armário em pouquíssimo tempo:
- **Roupas penduradas no armário ou em cabides** (camisas, jaquetas, casacos, vestidos, calças).
- **Uma sapateira ou prateleira de calçados** (cada par de sapatos é catalogado como um calçado individual).
- **Uma pilha de camisas, suéteres ou calças dobradas**.
- **Várias peças dispostas na cama, mesa ou chão**.

> **Exclusivo para Planos Pagos:** O upload de conjunto de peças (pipeline `mass`) utiliza a reconstrução de IA Nano Banana. Como uma única foto de conjunto pode consumir toda a franquia mensal de reconstrução de IA de um usuário Grátis (Free), deixando muitas peças sem reconstrução, **o upload de conjuntos é proibido para usuários do plano Grátis**. Se um usuário Grátis tentar enviar uma foto de conjunto, o DressApp exibirá uma mensagem sugerindo **Pular a Imagem** ou **Fazer Upgrade do Plano**.

## Limitações do Upload de Conjunto de Peças
Ao usar o upload de conjunto para digitalizar seu armário rapidamente, tenha em mente estas 5 limitações:
1. **Ideal para cores sólidas e padrões simples:** Funciona muito bem para peças lisas ou padrões xadrez e listrados muito simples, mas não consegue analisar estampas ocultas e detalhes finos.
2. **Condição atual da peça:** A imagem de estúdio reconstruída raramente reflete o estado físico atual da roupa (amassados, desgaste ou pequenas manchas).
3. **Pode pular algumas peças:** Peças muito sobrepostas ou escondidas na pilha/cabideiro podem não ser detectadas.
4. **Pode alucinar padrões e cores:** Ao preencher partes ocultas da roupa, a IA pode ocasionalmente inventar padrões ou tons de cores.
5. **Consome créditos de reconstrução:** Cada peça reconstruída consome 1 crédito de reconstrução de IA.

## Instruções Passo a Passo
1. Toque no botão **+ (Adicionar Item)** na barra de navegação inferior.
2. Tire ou selecione suas fotos (peça única, look no corpo ou foto de conjunto do seu armário/sapateira — até 10 fotos).
3. Toque em **Iniciar Análise**.
4. Revise as peças extraídas e reconstruídas, edite as tags se necessário e toque em **Salvar no Guarda-Roupa**.
