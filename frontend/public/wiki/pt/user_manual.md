# Manual Técnico Completo do Usuário DressApp

Manual do usuário abrangente e guia de referência técnica para o ecossistema de guarda-roupa pessoal DressApp, motor de estilo, mercado circular e painéis de administração.

---

## 1. Visão Geral & Stack de Tecnologia

O DressApp é um gerenciador de guarda-roupa pessoal, consultor de estilo e mercado circular impulsionado por Inteligência Artificial (IA). Ele ajuda os usuários a gerenciar peças de vestuário digitalmente, recortá-las e etiquetá-las automaticamente, receber recomendações de roupas adaptadas ao clima e ao calendário, escanear Passaportes Digitais de Produtos (DPP) da UE e negociar peças.

### Proposta de Valor Principal
- **Ingestão de Guarda-Roupa Digital**: Processamento de fotos tiradas na hora ou enviadas, com remoção automática de fundo, categorização de roupas e geração de tags de atributos.
- **Estilista Virtual de IA**: Um agente de conversação que analisa contextualmente o seu guarda-roupa, eventos do Google Calendar e previsões do tempo local para sugerir roupas diárias.
- **Mercado Circular**: Compra, venda, troca e aluguel seguros de roupas entre usuários (peer-to-peer) para reduzir o desperdício da moda rápida (fast fashion).
- **Análises de Custo por Uso (CPW)**: Insights sobre o valor total do guarda-roupa, taxas de utilização e otimização do uso.

### Arquitetura Tecnológica
- **Backend Edge**: Python 3.11 com FastAPI, utilizando drivers asíncronos Motor conectados a um cluster MongoDB Atlas.
- **Frontend SPA**: Aplicação de página única React 19 que utiliza stores personalizados `useSyncExternalStore` (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, primitivas Shadcn/UI e `react-i18next` com suporte para 12 idiomas.
- **Otimização de Estado e Rede**: Deduplicação de requisições ativas, cache de store de 15 minutos e revalidação ao alternar de aba (`visibilitychange`), resultando em zero requisições GET em segundo plano quando ocioso.
- **Machine Learning Local & Tamanhos**: Remoção de fundo local em CPU via U2-Net (`rembg`), segmentação de roupas com SegFormer-b2, embeddings Fashion-CLIP e modelo de regressão para medidas corporais físicas ANSUR II (`body_predictor.py`). Opcionalmente, redireciona para contêineres GPU autohospedados (SegFormer-b3 + BiRefNet) para operações rápidas.
- **STT/TTS Conversacional**: Reconhecimento de voz no lado do cliente (Web Speech API) como fallback, processamento no lado do servidor com Gemini 2.5 Flash para modulação de áudio multimodal, e motores Piper/Sherpa-ONNX offline integrados no dispositivo.
- **Serviços de Integração Externa**: API OpenWeatherMap para obtenção de dados climáticos, Google Calendar OAuth para exportação de agendas diárias, OpenStreetMap (Nominatim) para autocompletar endereços e APIs REST do PayPal para assinaturas e pagamentos.

---

## 2. Pré-requisitos

### Requisitos do Ambiente Hospedeiro (Server)
- **Hardware**: Servidor virtual (VPS) com no mínimo 4 GB de RAM (por exemplo, a VPS Hetzner que hospeda o ambiente de produção `dressapp.co`).
- **Dependências**: Docker e Docker Compose (incluindo backend, frontend e terminação TLS do Caddy).
- **Variáveis de Ambiente**: Configuração de chaves de API (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` e tokens OAuth do Google Calendar).

### Requisitos do Aplicativo do Usuário
- **Navegador Web**: Google Chrome ou Apple Safari (necessários para a compatibilidade completa de funções de voz).
- **Permissões**: Conceder acesso à câmera (para fotos de roupas e escaneamento de códigos QR) e ao microfone (para conversa por voz).
- **Rede**: Conexão ativa para o processamento do LLM, com cache de IndexedDB para navegação do catálogo offline.

---

## 3. Instruções Passo a Passo

### 3.1 Ingestão de Roupas (Adicionar Itens)
MÉTODOS DE INGESTÃO: Fotografia, Passaportes Digitais de Produtos e recibos de compra digitais.

#### A. Câmera Interativa e Upload de Arquivos
1. Vá para a tela **Adicionar item** (Add Item).
2. Selecione **Tirar foto** (Take Photo) (inicia a câmera nativa do celular) ou clique em **Enviar fotos** (Upload Photos) (abre o seletor de arquivos do sistema operacional).
3. O cliente calcula no navegador o valor SHA-256 e o hash de diferença horizontal (dHash) da imagem (~100-180 ms) para verificar se já existe no seu guarda-roupa.
4. Se for encontrada uma correspondência, abre-se o **Diálogo de Pré-voo de Duplicados** mostrando visualizações dos itens correspondentes. Selecione **Ignorar** (Skip) ou **Adicionar mesmo assim** (Add anyway).
5. Uma vez aceito, o servidor inicia uma transmissão NDJSON. Uma pré-visualização temporária com marcadores de posição aparecerá em 5-7 segundos, permitindo que você edite os detalhes do item imediatamente enquanto o backend conclui o etiquetamento.
6. Verifique as tags detectadas automaticamente (cor, tecido, ajuste, padrão, ocasião). Se o recorte da imagem estiver incorreto, altere a opção no menu suspenso **Categoria**; isso aciona o SegFormer para recortar a roupa novamente de forma automática.
7. Clique em **Salvar** (Save) para adicionar o item ao guarda-roupa imediatamente (~16 ms) enquanto a geração da miniatura WebP em segundo plano é concluída.

#### B. Escaneamento de Passaportes Digitais de Produtos (DPP) da UE
1. Toque no botão **Escanear QR (DPP)** na página Adicionar Item.
2. Conceda permissões de câmera e alinhe o código QR impresso na etiqueta da roupa, ou envie uma captura de tela de um código QR salvo.
3. O backend resolve a URL e realiza verificações de segurança SSRF (bloqueando faixas de IP privados).
4. O sistema analisa os esquemas JSON-LD para extrair marca, composição dos materiais, rastreabilidade da cadeia de suprimentos, pegada de carbono e diretrizes de cuidado.
5. Revise os dados extraídos exibidos no painel verde **Verified DPP Data** e clique em **Salvar**.

#### C. Importação de Recibos de Compra Digitais
1. Abra a aba **Importação Digital** (Digital Import).
2. Escolha uma opção: **Colar texto**, **Enviar imagem**, **Enviar PDF** ou insira um **Link web**.
3. O backend utiliza modelos de visão multimodais para extrair os dados da transação (marca, preço, tamanho, categoria).
4. Os campos analisados ficam bloqueados para protegê-los de futuras análises visuais automáticas. Clique em **Salvar** para confirmar.

---

### 3.2 Estilista Virtual Interativo de IA
Descreva seus dilemas de estilo e receba conselhos de roupas por voz e com as mãos livres.

1. Vá para a tela **AI Stylist**.
2. Clique no ícone do microfone `[Microphone]` na barra de entrada do chat.
3. Diga o seu pedido em voz alta (por exemplo: *"Qual blusa combina com as minhas calças beges para um almoço ao ar livre sob chuva?"*).
4. Se a tecnologia Web Speech for suportada, a sua voz será transcrita ao vivo no campo de texto. Caso contrário, o app grava um arquivo WebM e envia ao servidor.
5. O backend direciona a consulta de voz para o contêiner local do Gemma (utilizando como alternativa a transcrição de Gemini 2.5 Flash se estiver offline).
6. O estilista analisa o histórico do seu guarda-roupa, previsões do tempo local e eventos do calendário para formular uma proposta de roupa.
7. O estilista reproduz a resposta utilizando perfis de voz pré-selecionados (`puck`, `aoede` ou `charon`).
8. Toque em **Tocar resposta** (ou **Replay** no modo hebraico) no cartão para ouvir o áudio da resposta novamente.

---

### 3.3 Perfil, Preferências e Dependências dos Subsistemas
A página de perfil funciona como o painel de controle central do DressApp. Os campos de configuração têm um impacto direto no desempenho, roteamento e comportamento dos módulos derivados.

##### Dependências e Lógica Técnica das Seções do Acordeão

1. **Seção de Fotos e Avatar Digital (`AvatarViewer2D` e `DynamicAvatar`)**
   - **Por que isso importa?**: Mostra a sua identidade visual em todas as telas de experimentação usando um sistema de modo duplo (recorte de foto do corpo real vs manequim dinâmico vetorial SVG 2D).
   - **Dependências do Subsistema**: As fotos do corpo são recortadas via U2-Net local (`rembg`) e reduzidas no navegador a um máximo de 1280px com 82% de qualidade para caber dentro do limite de documento de 16 MB do MongoDB. O painel aplica pontos de referência calibrados (`top-[14.5%]` do colarinho ao decote, `top-[36.5%]` da cintura à linha da cintura, e `bottom-[2%]` no plano do calçado) e um escalonamento proporcional de peito e quadril ($scaleX$). Clique em *Remover foto* para voltar imediatamente ao maniquim vetorial 2D.

2. **Perfil de Estilo (Regras de modéstia, código de vestimenta)**
   - **Por que isso importa?**: Estabelece limites pessoais para as roupas recomendadas, evitando que a IA gere sugestões de estilo inadequadas.
   - **Dependências do Subsistema**: Os parâmetros selecionados (por exemplo, restrições de roupas modestas) são enviados diretamente nas instruções de estilo para o Gemini 2.5 Flash, filtrando os resultados do guarda-roupa antes que sejam exibidos.

3. **Detalhes (Nome, telefone, ocupação)**
   - **Por que isso importa?**: Personaliza o tom da comunicação e roteia os avisos de notificações.
   - **Dependências do Subsistema**: O nome do usuário é inserido dinamicamente nos e-mails e notificações push do sistema. O número de telefone serve como registro de reserva para alertas agendados. O parâmetro de ocupação é enviado ao LLM do estilista e ao classificador de personalização Trend Scout para ajustar as propostas.

4. **Medidas Corporais e Tamanhos (Modelo de Regressão ANSUR II e Preditor de Tamanho)**
   - **Por que isso importa?**: Evita ter que adivinhar os tamanhos, permitindo o cálculo automático de tamanhos comerciais, comparação de tamanhos externos e superposição virtual exata de peças.
   - **Dependências do Subsistema**: Ao introduzir 4 parâmetros básicos (**Altura**, **Peso**, **Cintura** e **Comprimento do pé**) ativa-se o modelo de regressão ANSUR II do scikit-learn (`body_predictor.py`) para prever automaticamente 6 dimensões estruturais (*Ombros*, *Peito*, *Quadril*, *Manga*, *Entreperna*, *Costura externa*).
     - **Tradução de Tamanhos Determinista**: Uma vez obtidas as medidas estimadas, o motor do backend as converte em tamanhos comerciais: **Tamanho de camisa** (XS-XXL baseado no peito), **Tamanho de calça** (Cintura em polegadas), **Tamanho de sapato** (padrões dos EUA masculino/feminino e padrão da UE baseado no comprimento do pé e sexo), **Tamanho de vestido** (US 0-14+ baseado no peito, cintura e quadris) e **Tamanho de sutiã** (Banda + Taça baseado no peito e sob o busto estimado).
     - **Preenchimento Automático**: Esses tamanhos recomendados são introduzidos automaticamente nos campos do *Modo de edição detalhado* no painel de perfil.
     - **Integrações**: Os scripts do navegador da extensão **Shopping Assistant** para Chrome consultam essas medidas para ler tabelas de tamanhos em sites de parceiros (Zara, Asos) e recomendar a melhor opção.

5. **Estilo de Vida (Status, Sexo)**
   - **Por que isso importa?**: Personaliza as recomendações padrão e pontua algoritmos de conteúdo.
   - **Dependências do Subsistema**: A seleção do sexo afeta diretamente a pontuação dos cartões diários do Trend Scout. Se um cartão de conteúdo não coincidir com o sexo do usuário, o algoritmo aplica uma penalização de -2.0 pontos ao score, rebaixando sua posição no feed.

6. **Configuração de IA (Chaves SaaS, modo local/edge, créditos)**
   - **Por que isso importa?**: Determina a cobrança de consultas, o desempenho de resposta e a disponibilidade sem conexão de rede.
   - **Dependências do Subsistema**: Roteia as consultas de geração de texto e áudio. A configuração padrão consome créditos do sistema DressApp. O uso de chaves de API pessoais (Google AI Studio, Anthropic, OpenAI) redireciona as cobranças diretamente para as contas do desenvolvedor do usuário. Selecionar o modo local roteia as consultas para o contêiner do Gemma sem conexão com a internet.

7. **Agendador e Notificações Push (Frequência, alarme diário, foco de estilo)**
   - **Por que isso importa?**: Gerencia o envio automático de propostas de estilo diárias.
   - **Dependências do Subsistema**: Ativa tarefas de cron do `APScheduler` no backend de FastAPI. Cada manhã, envia notificações push através de `pywebpush` utilizando as chaves VAPID do navegador do cliente, ajustadas ao foco de estilo selecionado.

8. **Google Calendar (Sincronização de OAuth, regras de exportação)**
   - **Por que isso importa?**: Vincula o seu guarda-roupa diretamente aos seus eventos reais do calendário.
   - **Dependências do Subsistema**: Autenticação através de Google OAuth. O agendador consulta o seu calendário para identificar eventos, configura as roupas e exporta eventos diretamente para a sua agenda do Google Calendar.

9. **Serviços de Localização (Rastreamento GPS, precisão do clima)**
   - **Por que isso importa?**: Coordena as sugestões adequadas ao clima e calcula os filtros de distância para transações locais.
   - **Dependências do Subsistema**: Ativa a geolocalização reversa de `navigator.geolocation`. As coordenadas são enviadas à API do OpenWeatherMap para ajustar as sugestões do estilista (por exemplo, capas de chuva em caso de chuva forte). Também calcula distâncias para os anúncios do mercado local e especialistas (por exemplo, verificações de raio em Lisboa).

10. **Voz e Idioma (Seleção de voz do estilista)**
    - **Por que isso importa?**: Configura os arquivos de tradução e as vozes de reprodução de áudio.
    - **Dependências do Subsistema**: Controla o idioma ativo para traduções via `react-i18next`. A seleção de voz mapeia códigos BCP-47 (como `he-IL` ou `ar-JO`) às vozes de síntese de voz do navegador ou a modelos Piper TTS offline.

11. **Convidar Amigos (API de recomendação)**
    - **Por que isso importa?**: Oferece uma via viral de obtenção de espaço grátis no guarda-roupa.
    - **Dependências do Subsistema**: Adiciona o ID de MongoDB do usuário remetente à URL. Os novos registros leem este ID e incrementam automaticamente a variável `closet_capacity_bonus` do remetente em +10 slots, modificando os limites de capacidade em `closet.py`.

---

### 3.4 Painel de Análise de Guarda-Roupa
Analise o valor do guarda-roupa, a taxa de utilização e o custo por uso das roupas.

1. Vá para **Wardrobe Insights**.
2. **Revisar Métricas**:
   - *Valor do guarda-roupa (Closet Worth)*: Soma dinâmica dos preços de compra.
   - *Utilização do guarda-roupa (Closet Utilization)*: Percentual de roupas que foram usadas pelo menos uma vez.
   - *Custo médio por uso (CPW)*: Calculado como `Preço / Quantidade de usos`.
3. **Gráficos de Distribuição**: Altere de aba para ver visualizações do Recharts:
   - *Paleta de Cores*: Distribuição dos códigos hexadecimais detectados.
   - *Materiais*: Distribuição das porcentagens de tecidos.
   - *Subcategorias*: Porcentagem de subcategorias registradas.
4. **Tabela de Eficiência**: Mostra as 5 roupas com o custo por uso (CPW) mais baixo.

---

### 3.5 Painel de Visuais & Planejamento
Crie, sobreponha e revise conjuntos em uma tela de avatar interativa em 2D.

1. Abra o planejador **Outfit Canvas**.
2. **Camadas de Casacos (Tela dupla)**: Se o seu visual inclui roupa de abrigo (por exemplo, uma jaqueta) sobre uma blusa, a página mostra dois módulos de tela vertical: "Com Casaco" (com a jaqueta vestida) e "Sem Casaco" (mostrando apenas a blusa).
3. **Elementos 2D Interativos**: Pressione diretamente qualquer roupa no corpo do avatar. O aplicativo redireciona você para a tela de detalhes daquela peça.
4. **Aba de Métricas de Compatibilidade**: Clique no botão de detalhes e selecione a aba **Metrics** para ver as barras de progresso de compatibilidade:
   - *Harmonia de Cores* (combinação de cores neutras)
   - *Compatibilidade de Estampas* (prevenção de mistura excessiva de estampas)
   - *Ajuste Corporal* (tamanhos compatíveis)
   - *Combinação Climática* (adequado para a estação)
   - *Adequação ao Evento* (apropriado para a atividade)
   - *Combinação de Localização* (verificações de regras de modéstia)
5. **Renomear/Descrever**: Clique no ícone do lápis para alterar os nomes e descrições dos visuais.

---

### 3.6 Assistente de Malas
Organize a sua bagagem para viagens sem levar peso desnecessário.

1. Vá para a página **Suitcase** e preencha o formulário de contexto de viagem (destino, datas, tipo de viagem, eventos de calendário).
2. A IA gera uma lista de bagagem personalizada e um planejamento de roupas diárias com base na duração e na previsão do tempo do destino.
3. Revise o progresso. Se faltar um item importante (por exemplo, guarda-chuva para chuva, roupa de banho para praia), o sistema avisa você e sugere alternativas do mercado ou lojas locais.
4. Use o chat integrado para solicitar mudanças (por exemplo, *"Adicione um vestido formal para a noite 2"*). O assistente altera a mala mantendo o restante da lista.
5. Pressione **Aprovar Mala** (Approve Suitcase) para salvar a lista final.

---

### 3.7 Agendador e Lembretes Automáticos
Programe alertas de estilo para receber recomendações de roupas diariamente de forma automática.

1. Abra o **Profile** e vá para **Scheduler & Push**.
2. Ative as notificações, defina uma hora diária, frequência de dias da semana e o tema de estilo.
3. Cada manhã, uma tarefa cron em segundo plano (`APScheduler`) verifica o clima e envia uma notificação push.
4. Toque na notificação no seu dispositivo (ou vá ao Centro de Notificações do site) para abrir uma janela flutuante que mostra 3 propostas de estilo.
5. Salve uma proposta diretamente no seu **Diário do guarda-roupa** (Wardrobe Diary).

---

## 3.8 Mercado (Venda, Aluguel, Troca, Doação)
Participe do mercado circular de moda entre usuários.

- **Criar um Anúncio**: Abra a página de detalhes de uma roupa, selecione **Editar intenção** (Edit Intent) e escolha uma opção pública:
  - *Para venda (For Sale)*: Insira o preço e a moeda (detecta a sua moeda padrão pelas suas preferências regionais).
  - *Aluguel (Rent)*: Estabeleça a tarifa diária e as condições de empréstimo.
  - *Troca (Swap)*: Marque o artigo como disponível para troca.
  - *Doar (Donate)*: Publique o artigo gratuitamente.
- **Sincronização de Estado**: Os anúncios são publicados no feed de imediato. O navegador utiliza `useSyncExternalStore` e cache do IndexedDB para realizar buscas sem atrasos.
- **Provador Virtual Sandbox**: Os compradores e locatários podem testar o ajuste do anúncio sobre o seu próprio avatar ao lado de suas roupas guardadas antes de pagar.
- **Processo de Pagamento**:
  - *Comprar/Alugar*: Conclua a transação de forma segura com os botões integrados do PayPal. Os webhooks notificam o vendedor, mudam o estado do anúncio para vendido/alugado e registram a transação no livro de caixa descontando a comissão de 7% da plataforma.
  - *Permuta (Troca)*: Os interessados propõem trocas. O proprietário do anúncio recebe e-mails de confirmação para aceitar ou recusar a oferta.

---

### 3.9 Painel de Administração
Monitoramento de disponibilidade do sistema, contabilidade financeira e gestão de contas de usuário.

1. Vá para `/admin` (disponível para contas com papel de administrador).
2. **Resumo Geral**: Audite os volumes brutos e os resumos de renda das taxas da plataforma. Inspecione a **Tabela de Atividade de Provedores** para ver o status das APIs (Gemini, latência do serviço meteorológico e taxa de erros).
3. **Provedores**: Clique em **Verificar Chave** (Verify Key) para testar diretamente a API do Gemini. Ative o interruptor **Eyes Vision Override** para alternar o processamento de imagens entre o ponto de conexão padrão do Gemini e um contêiner local do Gemma.
4. **Usuários**: Consulte créditos ativos, papéis e histórico de pagamentos. Utilize ações diretas para promover ou rebaixar usuários.
5. **Anúncios**: Revise os estados dos anúncios e desative itens suspeitos de fraude.

---

## 4. Resultados Esperados

- **Ingestão**: Os itens aparecem imediatamente na grade do seu guarda-roupa (~16 ms). A remoção de fundo produz arquivos PNG transparentes e limpos.
- **Selo DPP Verificado**: Ao escanear passaportes de produtos válidos é exibido um cartão de informações verde com detalhes de sustentabilidade.
- **Roupas de Abrigo no Avatar**: Os casacos e jaquetas são exibidos sobrepostos corretamente acima das blusas na tela do avatar 2D sem tapar gorros ou sapatos.
- **Resposta de Voz**: Os textos gerados pelo estilista virtual são reproduzidos em áudio de forma automática com um indicador visual de onda sonora.
- **Assinaturas**: Ativar a conta Pro elimina imediatamente o aviso de limite de 150 itens.

---

## 5. Resolução de Problemas

### HTTP 402 Payment Required
- **Problema**: Carga de roupas bloqueada. Você atingiu o limite máximo de armazenamento de 150 peças da conta gratuita.
- **Solução**: Vá para Perfil -> Assinatura e atualize para Pro, ou compartilhe o seu link de convite para obter +10 espaços adicionais por cada registro.

### SSRF Bloqueado / Erro de DNS no DPP
- **Problema**: Erro ao analisar a URL do código QR do passaporte de produto.
- **Solução**: O sistema bloqueia endereços IP privados (por exemplo, `127.0.0.1`, `192.168.x.x`) para proteger a rede interna. Certifique-se de que os códigos QR apontem para domínios públicos.

### Permissão de Câmera ou Microfone Negada
- **Problema**: A tela de fotos ou escaneamento mostra um erro com um 'X', ou falha a digitação por voz.
- **Solução**: Abra as permissões do navegador, habilite o acesso à câmera e ao microfone para o domínio e recarregue a página.

### Erro no Chat do Estilista / Limites de API
- **Problema**: O chat mostra erros ou congela.
- **Solução**: O servidor detecta limites de uso do Gemini (`429`) e passa a usar um algoritmo alternativo baseado em regras para escolher roupas. Verifique a sua conexão com a internet.

### VPS sem Memória (Out of Memory - OOM)
- **Problema**: Picos de uso de CPU/RAM durante o upload de fotos.
- **Solução**: A ingestão de roupas utiliza filas sequenciais para lotes de mais de 5 itens. Certifique-se de que o servidor tenha pelo menos 4 GB de RAM.

---

## 6. Limitações

- **APIs de Voz dos Navegadores**: O reconhecimento de voz nativo está limitado a Chrome e Safari; em outros navegadores o app utiliza a entrada de texto clássica.
- **Sintese de Voz Offline**: O módulo móvel offline Piper ONNX dispõe de menos perfis de voz do que o processamento de áudio do Gemini no servidor.
- **Limites de Tamanho de Imagem**: As fotos do avatar e de perfil são comprimidas localmente no navegador a 82% de qualidade para não ultrapassar o limite de 16 MB de documento no MongoDB.
- **Leitura de Recibos de Compra**: Recibos que estejam muito borrados, distorcidos ou escritos à mão podem falhar na extração de dados.
