# Manual Técnico Completo do Usuário DressApp

Manual abrangente do usuário e guia de referência técnica para o ecossistema de guarda-roupa pessoal DressApp, motor de estilização, mercado circular e painéis de administração.

---

## 1. Visão Geral & Stack de Tecnologia

O DressApp é um gerenciador de guarda-roupa pessoal guiado por IA, consultor de estilo e mercado circular. Ele ajuda os usuários a gerenciar roupas digitalmente, recortá-las e categorizá-las automaticamente, receber recomendações de roupas baseadas no clima e no calendário, escanear Passaportes Digitais de Produtos da UE (DPP) e negociar roupas.

### Proposta de Valor Principal
- **Ingestão de Guarda-Roupa Digital**: Processamento de fotos capturadas ou enviadas com remoção automatizada de fundo, categorização de roupas e geração de etiquetas de atributos.
- **AI Virtual Stylist**: Um agente de conversação que analisa de forma contextual seu guarda-roupa, eventos do Google Calendar e previsões do tempo locais para sugerir roupas diárias.
- **Mercado Circular (Circular Marketplace)**: Compra, venda, troca e aluguel seguro de roupas entre usuários para reduzir o desperdício da moda rápida.
- **Análise do Custo por Uso (CPW)**: Informações sobre o valor de capitalização do guarda-roupa, taxas de utilização e otimização de uso.

### Arquitetura de Tecnologia
- **Backend Edge**: Python 3.11 com FastAPI, utilizando drivers Motor assíncronos conectados a um cluster MongoDB Atlas.
- **Frontend SPA**: Aplicativo de página única React 19 que usa stores personalizadas de `useSyncExternalStore` (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, componentes Shadcn/UI e `react-i18next` com suporte para 12 idiomas locais.
- **Otimização de Estado & Rede**: Eliminação de duplicações de requisições ativas, cache de loja por 15 minutos e revalidação de abas ao mudar a visibilidade (`visibilitychange`), gerando zero requisições GET em segundo plano quando inativo.
- **Aprendizado de Máquina & Dimensionamento Locais**: Remoção de fundo local via CPU U2-Net (`rembg`), análise de roupas SegFormer-b2, incorporações Fashion-CLIP e modelo de regressão de medidas corporais físicas ANSUR II (`body_predictor.py`). Opcionalmente, as consultas são enviadas para contêineres de GPU autohospedados (SegFormer-b3 + BiRefNet) para operações rápidas.
- **STT/TTS Conversacional**: Reconhecimento de voz cliente Web Speech como alternativa, modulações Gemini 2.5 Flash no lado do servidor e mecanismos Piper/Sherpa-ONNX locais no dispositivo para funcionamento offline.
- **Serviços de Integração Externa**: API OpenWeatherMap para clima, Google Calendar OAuth para exportação de agendas diárias, OpenStreetMap (Nominatim) para autocompletar endereços e APIs REST PayPal Subscriptions/Checkout.

---

## 2. Pré-requisitos

### Requisitos do Ambiente do Servidor (Host)
- **Hardware**: Servidor VPS com no mínimo 4 GB de RAM (por exemplo, VPS da Hetzner que hospeda a produção do `dressapp.co`).
- **Dependências**: Docker e Docker Compose (incluindo backend, frontend e terminação TLS do Caddy).
- **Variáveis de Ambiente**: Configuração de chaves API (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` e tokens do Google Calendar OAuth).

### Requisitos do Aplicativo do Usuário
- **Navegador Web**: Google Chrome ou Apple Safari (necessário para total compatibilidade dos recursos de voz).
- **Permissões**: Conceder permissão de câmera (para fotos de roupas e digitalização de códigos QR) e de microfone (for conversações de voz).
- **Rede**: Conexão ativa para processamento do LLM, com armazenamento no IndexedDB que permite a navegação offline do catálogo.

---

## 3. Instruções Passo a Passo

### 3.1 Ingestão de Roupas (Adicionando Itens)
MÉTODOS DE INGESTÃO: Fotografia, Passaporte Digital do Produto da UE e Recibos de Compra Digitais.

#### A. Câmera Interativa e Upload de Arquivos
1. Vá para a tela **Adicionar Item** (Add Item).
2. Selecione **Tirar Foto** (abre a câmera nativa) ou clique em **Enviar Fotos** (abre o seletor de arquivos).
3. O cliente calcula a assinatura SHA-256 da imagem e o dHash no navegador (~100-180 ms) para verificar itens duplicados no guarda-roupa.
4. Se uma duplicata for encontrada, o **diálogo de verificação de duplicados** é aberto. Selecione **Ignorar** ou **Adicionar mesmo assim**.
5. Uma vez aceito, o servidor inicia um fluxo NDJSON. Uma visualização temporária é mostrada em 5-7 segundos, permitindo que você edite os detalhes do item imediatamente enquanto o backend conclui a marcação de etiquetas.
6. Verifique as tags autodetectadas (cor, tecido, ajuste, padrão, ocasião). Se o corte do fundo não estiver correto, altere o menu suspenso **Categoria**; isso acionará o SegFormer para recortar a roupa novamente.
7. Clique em **Salvar** para mostrar de imediato o item na grade do guarda-roupa (~16 ms) enquanto conclui a geração da miniatura WebP em segundo plano.

#### B. Escaneando Passaportes Digitais de Produtos da UE (DPP)
1. Pressione o botão **Scan QR (DPP)** na página de adicionar item.
2. Conceda permissões de câmera e alinhe o código QR impresso na etiqueta da roupa, ou envie uma captura de tela de um código QR salvo.
3. O backend resolve a URL e executa verificações de segurança SSRF (bloqueando faixas de IP privados).
4. O sistema analisa os esquemas JSON-LD para extrair marca, composição dos materiais, rastreabilidade da cadeia de suprimentos, pegada de carbono e instruções de lavagem.
5. Revise os dados extraídos exibidos no painel verde de **Dados DPP Verificados** e clique em **Salvar**.

#### C. Importação de Recibos de Compra Digitais
1. Abra a guia **Importação Digital** (Digital Import).
2. Escolha um método: **Colar Texto**, **Enviar Imagem**, **Enviar PDF** ou insira um **Link da Web**.
3. O backend usa modelos de visão multimodais para extrair os fatos da transação (marca, preço, tamanho, categoria).
4. Os campos analisados são bloqueados para protegê-los de futuras reanálises visuais. Clique em **Salvar** para confirmar.

---

## 3.2 AI Virtual Stylist Conversacional
Descreva seus dilemas de estilo e receba conselhos de roupas falados em viva-voz.

1. Vá para a tela **AI Stylist**.
2. Clique no ícone do microfone `[Microphone]` na barra de entrada do chat.
3. Fale sua solicitação (por exemplo, "Qual blusa combina com minha calça bege para um almoço chuvoso ao ar livre?").
4. Se o Web Speech for compatível, sua voz será transcrita ao vivo na caixa de entrada. Caso contrário, o aplicativo grava um arquivo WebM e o envia.
5. O backend direciona a consulta de voz para o contêiner local Gemma4 (voltando à transcrição do Gemini 2.5 Flash se o servidor estiver offline).
6. O estilista analisa seu histórico de guarda-roupa, previsões do tempo locais e eventos do calendário para formular uma proposta de estilo.
7. O estilista fala a resposta usando perfis de voz pré-selecionados (`puck`, `aoede` ou `charon`).
8. Pressione **Reproduzir resposta** (ou **Replay** no modo hebraico) no cartão para ouvir o áudio de voz novamente.

---

## 3.3 Perfil, Preferências e Dependências de Subsistemas
A página de perfil serve como o painel de controle central para o DressApp. Os campos de configuração afetam diretamente o desempenho e o comportamento dos módulos derivados.

##### Dependências e Justificativa das Seções Sanfonadas

1. **Fotos & Palco do Avatar Digital (`AvatarViewer2D` e `DynamicAvatar`)**
   - **Importância**: Representa sua identidade visual em todas as telas de prova usando uma cena de modo duplo (recorte de foto real versus manequim vetorial 2D Bezier SVG dinâmico).
   - **Dependências**: Os recortes de fotos são processados via U2-Net (`rembg`) local e reduzidos no navegador para no máximo 1280px a 82% de qualidade para caber no limite de 16 MB dos documentos do MongoDB. O palco aplica pontos de referência calibrados (`top-[14.5%]` do colarinho ao decote, `top-[36.5%]` do cós à cintura e `bottom-[2%]` para os calçados) e escala proporcional do peito/quadril ($scaleX$). Clique em *Remover Foto* para voltar imediatamente ao manequim vetorial 2D SVG.

2. **Perfil de Estilo (Regras de recato, código de vestimenta)**
   - **Importância**: Estabelece limites pessoais para as roupas recomendadas, evitando que a IA gere sugestões inadequadas.
   - **Dependências**: Os parâmetros selecionados (por exemplo, restrições de roupas recatadas) são enviados diretamente às prompts do estilista para o Gemini 2.5 Flash, filtrando os itens do guarda-roupa antes de exibi-los.

3. **Detalhes Pessoais (Nome, telefone, ocupação)**
   - **Importância**: Personaliza o tom da comunicação e orienta os alertas de notificação.
   - **Dependências**: O nome do usuário é analisado dinamicamente em e-mails e envios push do sistema. O número de telefone serve como canal de backup para alertas programados. O parâmetro de ocupação é injetado no LLM do estilista e no classificador do Trend Scout para personalizar as propostas.

4. **Medições Corporais & Tamanhos (Modelo de Regressão ANSUR II e Preditor de Tamanhos)**
   - **Importância**: Elimina as dúvidas sobre os tamanhos, permitindo o cálculo automático de tamanhos, a comparação externa de tamanhos e a sobreposição virtual precisa.
   - **Dependências**: A inserção de 4 parâmetros básicos (**Height** (Altura), **Weight** (Peso), **Waist** (Cintura), **Foot Length** (Comprimento do pé)) ativa o modelo de regressão ANSUR II do scikit-learn (`body_predictor.py`) para prever automaticamente 6 dimensões estruturais (*Ombros*, *Peito*, *Quadril*, *Manga*, *Costura interna*, *Costura externa*).
     - **Tradução Determinista de Tamanhos**: Uma vez previstas as medições estruturais, o motor de tamanhos do backend as converte em tamanhos de varejo: **Tamanho da camisa** (XS-XXL baseado no peito), **Tamanho da calça** (Cintura em polegadas), **Tamanho do sapato** (Padrões masculinos/femininos dos EUA e padrão europeu baseado no comprimento do pé e gênero), **Tamanho do vestido** (US 0-14+ baseado no peito, cintura e quadris) e **Tamanho do sutiã** (Faixa + Taça baseados no peito e sob peito estimado).
     - **Preenchimento Automático**: Esses tamanhos recomendados são inseridos automaticamente nos campos de *Detailed Edit Mode* dentro do perfil.
     - **Integrações**: As medidas são consultadas diretamente pelo Assistente de compras (extensão do Chrome) para ler tabelas de tamanhos em sites parceiros (Zara, Asos) e sugerir a melhor opção.

5. **Estilo de Vida (Estado civil, sexo)**
   - **Importância**: Personaliza as recomendações padrão e pontua algoritmos de conteúdo.
   - **Dependências**: A seleção do sexo afeta diretamente o algoritmo de classificação dos cartões do Trend Scout diários. Se a categoria de um cartão de notícias não coincidir com o sexo do usuário, o algoritmo aplica uma penalidade de -2,0 pontos, atrasando seu aparecimento no feed.

6. **Configuração de IA (Chaves SaaS, modo de borda (edge), créditos)**
   - **Importância**: Determina o faturamento, o desempenho operacional e o status da conexão de rede.
   - **Dependências**: Direciona consultas de geração de texto e voz. As configurações padrão consomem créditos do sistema DressApp. A inserção de chaves API pessoais (Google AI Studio, Anthropic, OpenAI) redireciona os custos para as contas de desenvolvedor do usuário. A seleção do modo de borda local direciona as consultas para o contêiner local do Gemma sem conexão com a Internet.

7. **Planejador & Alertas (Frequência, alarme diário, foco de estilo)**
   - **Importância**: Gerencia o envio automático de alertas de estilo diários.
   - **Dependências**: Ativa tarefas de `APScheduler` no backend FastAPI. Todas as manhãs, envia notificações push via `pywebpush` usando as chaves VAPID do cliente, de acordo com os parâmetros de estilo configurados.

8. **Google Calendar (Sincronização OAuth, regras de exportação)**
   - **Importância**: Vincula seu guarda-roupa diretamente aos seus eventos reais do calendário.
   - **Dependências**: Requer autenticação via Google OAuth. O planejador consulta seu calendário para identificar eventos, gerar as roupas e exportá-las diretamente para sua agenda do Google Calendar.

9. **Serviços de Localização (Rastreamento GPS, precisão climática)**
   - **Importância**: Coordena propostas adaptadas ao clima e filtros geográficos para transações locais.
   - **Dependências**: Ativa a geolocalização inversa `navigator.geolocation`. As coordenadas são enviadas à API OpenWeatherMap para ajustar as recomendações do estilista (por exemplo, roupas impermeáveis para temporais). Também calcula distâncias para ofertas e especialistas locais.

10. **Voz e Idioma (Seleção de voz do estilista virtual)**
    - **Importância**: Determina o idioma dos textos e o perfil de voz.
    - **Dependências**: Controla o idioma ativo para traduções via `react-i18next`. A seleção da voz associa códigos de voz BCP-47 (por exemplo, `he-IL` ou `ar-JO`) às vozes de síntese de voz do navegador ou modelos Piper TTS locais.

11. **Convidar Amigos (API de compartilhamento de dados)**
    - **Importância**: Fornece um loop viral para expansão gratuita do guarda-roupa.
    - **Dependências**: Anexa o ID do remetente à URL. Novos registros leem esse ID e incrementam o `closet_capacity_bonus` do remetente em +10 vagas automaticamente, atualizando os limites em `closet.py`.

---

## 3.4 Painel de Estatísticas do Guarda-Roupa
Analise o valor total do guarda-roupa, o rastreamento do uso de roupas e parâmetros CPW.

1. Vá para **Wardrobe Insights**.
2. **Rever Métricas**:
   - *Valor do Guarda-Roupa (Closet Worth)*: Soma dinâmica dos preços de compra.
   - *Utilização do Guarda-Roupa (Closet Utilization)*: Porcentagem de roupas no guarda-roupa usadas pelo menos uma vez.
   - *Custo Médio por Uso (CPW)*: Calculado como `Preço / Quantidade de usos`.
3. **Gráficos de Distribuição**: Alterne entre guias para ver visualizações do Recharts:
   - *Paleta de Cores*: Distribuição dos valores de cores hexadecimais no guarda-roupa.
   - *Materiais*: Distribuição percentual dos tecidos.
   - *Subcategorias*: Distribuição das subcategorias.
4. **Tabela de Classificação de Eficiência**: Mostra as 5 roupas com os valores de CPW mais baixos do guarda-roupa.

---

## 3.5 Tela do Avatar & Planejador de Roupas
Crie roupas, combine camadas e revise propostas na tela interativa do avatar 2D.

1. Abra o planejador **Outfit Canvas**.
2. **Camadas de Roupas Externas (Tela dupla)**: Se o seu conjunto incluir roupas externas (por exemplo, uma jaqueta) sobre uma camisa, a página mostra duas telas de avatar verticais: "With Outerwear" (mostra a jaqueta na camada externa) e "Without Outerwear" (mostra a camisa por baixo).
3. **Elementos 2D Interativos**: Clique diretamente em uma peça de roupa no corpo do avatar para ir de imediato à tela de detalhes desse artigo.
4. **Guia de Métricas**: Clique no botão de detalhes e escolha a guia **Metrics** para ver critérios de compatibilidade:
   - *Harmonia das Cores* (combinação harmoniosa).
   - *Compatibilidade dos Padrões* (prevenção de conflitos de estampas).
   - *Ajuste Corporal* (ajuste de tamanhos).
   - *Alinhamento Climático* (adequação à temporada).
   - *Alinhamento dos Eventos* (adequação à atividade).
   - *Alinhamento de Localização* (verificação do cumprimento de regras de recato).
5. **Renomear/Descrever**: Clique no ícone do lápis para editar nomes de roupas e descrições.

---

## 3.6 Assistente de Mala e Viagens
Organize sua lista de bagagem para viagens de forma inteligente e evite o excesso de peso.

1. Vá para a página **Suitcase** e preencha o formulário de contexto de viagem (destino, datas de início/fim, categoria de viagem, eventos do calendário).
2. A IA gera uma lista de bagagem personalizada e roupas diárias com base na duração da viagem e previsões climáticas locais.
3. Acompanhe o progresso da embalagem. Se faltar um item importante (por exemplo, guarda-chuva para dias chuvosos, traje de banho para a praia), o sistema avisará e sugerirá itens do mercado ou de lojas locais.
4. Use o chat integrado para ajustar sugestões (por exemplo, "Mude o dia 2 para roupa de noite casual"). O assistente atualizará a mala e manterá o resto da lista.
5. Pressione **Approve Suitcase** para confirmação final de seu plano de embalagem.

---

## 3.7 Planejador & Recordações Diárias
Configure alertas diários de estilo para receber recomendações de roupas automaticamente em seu telefone.

1. Abra **Profile** e vá para **Scheduler & Push**.
2. Ative as notificações, defina a hora do alerta diário, a frequência dos dias da semana e o tema de estilo.
3. Todas as manhãs, a tarefa em segundo plano (`APScheduler`) verifica a previsão do tempo e envia um alerta push.
4. Pressione a notificação no seu dispositivo (ou visualize o centro de notificações da Web) para abrir um diálogo com 3 opções de roupas sugeridas.
5. Salve uma sugestão selecionada diretamente em seu diário de roupas **Wardrobe Diary**.

---

## 3.8 Mercado Circular (Venda, Aluguel, Troca, Doação)
Participe do mercado circular de moda peer-to-peer.

- **Criar um anúncio**: Abra a página de detalhes de um item, selecione **Edit Intent** e escolha uma opção pública:
  - *For Sale* (À venda): Insira o preço de venda e moeda (detecta automaticamente sua moeda local via preferências regionais).
  - *Rent* (Aluguel): Estabeleça a tarifa de aluguel diária e as condições de empréstimo.
  - *Swap* (Troca): Marque o item como disponível para troca.
  - *Donate* (Doação): Publique o item como presente sem custo.
- **Sincronização de Estado**: Os anúncios são publicados no feed do mercado automaticamente. O cliente utiliza `useSyncExternalStore` e o cache IndexedDB local para carregar resultados de busca sem atrasos.
- **Visualização Virtual no Sandbox**: Compradores/locatários podem fazer uma visualização virtual do item em relação às roupas do seu próprio guarda-roupa antes de realizar a transação.
- **Processamento de Transações**:
  - *Compra/Aluguel*: Conclua a transação via botões do PayPal integrados. Os webhooks de entrada notificam o vendedor, alteram o estado do anúncio para vendido/alugado e registram a transação no livro contábil da plataforma descontando a taxa de 7%.
  - *Troca*: Interessados propõem ofertas de troca. O proprietário recebe e-mails de confirmação para aceitar ou rejeitar.

---

## 3.9 Painel de Administração (Admin Panel)
Verificação do funcionamento do sistema, contabilidade financeira e gestão de contas do usuário.

1. Vá para `/admin` (disponível para usuários com função de administrador).
2. **Visão Geral**: Audite o volume de transações e resumos das comissões da plataforma. Analise a tabela **Provider Activity Table** para monitorar tempos de resposta e taxas de erro de serviços externos (API do Gemini, API do clima).
3. **Provedores (Providers)**: Clique em **Verify Key** para enviar um teste à API do Gemini. Alterne o interruptor **Eyes Vision Override** para redirecionar o análise de imagens entre o endpoint de Gemini padrão e um contêiner local de Gemma.
4. **Usuários**: Veja o saldo de créditos ativos, funções e pagamentos totais. Use ações diretas para promover ou rebaixar usuários.
5. **Anúncios (Listings)**: Veja o estado dos anúncios e desative itens em caso de suspeita de fraude.

---

## 4. Resultados Esperados

- **Ingestão**: Itens aparecem imediatamente na grade do guarda-roupa (~16 ms). A remoção do fundo é executada limpamente e gera arquivos PNG transparentes.
- **Verificação DPP**: A digitalização de passaportes de produtos válidos mostra um cartão verde de informações com detalhes de sustentabilidade.
- **Camadas de Avatar**: Roupas externas são representadas corretamente sobre camisas na tela do avatar 2D sem clipping em sapatos ou chapéus.
- **Resposta de Voz**: Textos de resposta do AI Stylist são lidos automaticamente e são acompanhados por um indicador de onda de som visual.
- **Assinaturas**: O upgrade para o plano Manager ou Professional remove imediatamente o aviso de limite de capacidade do guarda-roupa.

---

## 5. Solução de Problemas

### HTTP 402 Payment Required
- **Problema**: Ingestão de roupas bloqueada. Você atingiu o limite base de 50 itens (ou até 200 itens com bônus de indicação).
- **Solução**: Vá para a **página de preços** (`/pricing`) e assine o plano Manager ou Professional, ou compartilhe seu link de indicação para obter +10 vagas por registro (até 200 itens no máximo).

### SSRF Blocked / DNS Error no DPP
- **Problema**: Falha ao analisar a URL do QR code do passaporte de produto digitalizado.
- **Solução**: O analisador bloqueia endereços IP privados (como `127.0.0.1` e `192.168.x.x`) para proteger os servidores internos da plataforma. Certifique-se de que os QR codes apontem para domínios públicos.

### Permissão de câmera / microfone negada
- **Problema**: A tela de captura/digitalização mostra um 'X' de erro, ou a digitação por voz falha.
- **Solução**: Abra as permissões do navegador, permita o acesso à câmera e ao microfone para o domínio e recarregue a página.

### Chat do Estilista Falhou / Limites de Velocidade Atingidos
- **Problema**: O chat congela ou mostra erros.
- **Solução**: O servidor gerencia os erros de limite de taxa `429` do Gemini e recorre a um algoritmo de seleção baseado em regras predefinidas. Verifique sua conexão com a Internet.

### Excesso de Memória (OOM) em Servidores VPS
- **Problema**: Carga alta no processador/memória do servidor durante os processos de envio de arquivos.
- **Solução**: O processo de upload usa uma fila sequencial para carregamento de mais de 5 itens de cada vez. Certifique-se de que o servidor tenha pelo menos 4 GB de RAM disponíveis.

---

## 6. Limitações

- **APIs de Voz no Navegador**: A transcrição de voz em texto integrada é limitada aos navegadores Chrome e Safari; outros navegadores voltarão ao teclado de texto padrão.
- **Saída de Voz Offline**: O mecanismo Piper ONNX local em dispositivos móveis usa menos perfis de voz em comparação com o modelo de áudio Gemini do servidor.
- **Limites de Tamanho de Imagem**: Imagens enviadas para o perfil ou o avatar são compactadas localmente no navegador a 82% de qualidade para cumprir o limite de 16 MB dos documentos do MongoDB.
- **Precisão de Análise de Recibos**: Em recibos muito borrados, distorcidos ou escritos à mão, a extração de dados pode falhar.
