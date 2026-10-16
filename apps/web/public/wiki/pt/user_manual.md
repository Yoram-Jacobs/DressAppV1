# Manual Técnico Completo do Usuário DressApp

Manual abrangente do usuário e guia de referência técnica para o ecossistema de guarda-roupa pessoal DressApp, motor de estilo, mercado circular e painéis de administração.

---

## 1. Visão Geral e Stack de Tecnologia

O DressApp é um gerenciador de guarda-roupa pessoal, consultor de estilo e mercado circular impulsionado por IA. Ele ajuda os usuários a gerenciar peças de roupa digitalmente, recortá-las e categorizá-las automaticamente, receber recomendações de looks baseadas no clima e na agenda, escanear Passaportes Digitais de Produtos da UE (DPP) e comercializar ou trocar peças.

### Proposta de Valor Principal
- **Digitalização de Guarda-Roupa**: Processamento de fotos capturadas ou enviadas com remoção automatizada de fundo, categorização de roupas e geração de etiquetas de atributos.
- **AI Virtual Stylist**: Um agente conversacional que analisa de forma contextual seu guarda-roupa, eventos do Google Calendar e previsões meteorológicas locais para sugerir looks diários.
- **Mercado Circular (Circular Marketplace)**: Compra, venda, troca e aluguel seguro de roupas ponto a ponto (peer-to-peer) para reduzir o desperdício do fast fashion.
- **Análise de Custo por Uso (CPW)**: Insights sobre o valor de capitalização do guarda-roupa, taxas de utilização e otimização de uso.

### Arquitetura de Tecnologia
- **Backend Edge**: Python 3.11 com FastAPI, utilizando drivers assíncronos Motor conectados a um banco de dados dedicado MongoDB 7.0 local (on-premises) em armazenamento NVMe.
- **Frontend SPA**: Aplicativo de página única (SPA) em React 19 utilizando stores personalizadas com `useSyncExternalStore` (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, componentes Shadcn/UI e `react-i18next` com suporte para 13 idiomas.
- **Otimização de Estado e Rede**: Deduplicação de requisições em andamento, cache de store de 15 minutos e revalidação de abas via `visibilitychange`, gerando zero requisições GET em segundo plano quando ocioso.
- **Aprendizado de Máquina Local e Dimensionamento**: Recorte de fundo local em CPU via U2-Net (`rembg`), segmentação de roupas SegFormer-b2, embeddings Fashion-CLIP e modelo de regressão de medidas corporais físicas ANSUR II (`body_predictor.py`). Inclui o contêiner dedicado local (on-premises) `dressapp-eyes` executando um modelo ajustado `Qwen 2.5 VL 3B` (`Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf` + `mmproj`) na porta 7860 para usuários do plano gratuito (Free Tier) e como fallback automático de cota.
- **STT/TTS Conversacional**: Reconhecimento de voz Web Speech em tempo real no cliente como alternativa, modulações multimodais do Gemini no servidor e motores offline Piper/Sherpa-ONNX no dispositivo.
- **Serviços de Integração Externa**: API OpenWeatherMap para dados meteorológicos, Google Calendar OAuth para exportação da agenda diária, preenchimento automático de endereço com OpenStreetMap (Nominatim) e APIs REST PayPal Subscriptions/Checkout.

---

## 2. Pré-requisitos

### Requisitos do Ambiente do Servidor (Host)
- **Hardware**: VPS com no mínimo 8 GB de RAM (ex.: VPS Hetzner CPX32 hospedando a produção `dressapp.co`).
- **Dependências**: Stack Docker e Docker Compose (incluindo MongoDB 7.0 local on-premises, backend, servidor de inferência eyes, frontend e terminação TLS do Caddy).
- **Variáveis de Ambiente**: Configuração de chaves de API (`GEMINI_API_KEY`, `EYES_API_TOKEN`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` e tokens OAuth do Google Calendar).

### Requisitos do Aplicativo para o Usuário
- **Navegador Web**: Google Chrome ou Apple Safari (necessários para compatibilidade completa com os recursos de voz).
- **Permissões**: Conceder permissão de Câmera (para fotos de roupas e leitura de códigos QR) e permissão de Microfone (para conversas por voz).
- **IA em Níveis Zero-BYOK**: Usuários gratuitos utilizam o modelo Eyes local (`Qwen 2.5 VL 3B`) do DressApp; usuários dos planos Manager e Professional contam com o modelo rápido em nuvem (`Gemini 3.5 Flash`). Nenhuma chave de API fornecida pelo usuário é necessária.
- **Rede**: Conexão ativa para processamento de LLM, com cache IndexedDB permitindo navegação offline pelo catálogo.

---

## 3. Instruções Passo a Passo

### 3.1 Cadastrando Roupas (Adicionando Itens)
PARADIGMAS DE CADASTRO: Fotografia, Passaportes Digitais de Produtos da UE e Recibos de Comércio Digital.

#### A. Câmera Interativa e Upload de Arquivos
1. Navegue até a tela **Adicionar Item** (*Add Item*).
2. Selecione **Tirar Foto** (abre a câmera nativa do celular) ou clique em **Enviar Fotos** (abre o seletor de arquivos do sistema).
3. O cliente calcula o hash SHA-256 e o hash de diferença horizontal (dHash) da imagem no navegador (~100-180 ms) para verificar no seu guarda-roupa existente.
4. Se uma correspondência for encontrada, o **Diálogo de Verificação de Duplicatas** será aberto mostrando as prévias correspondentes. Selecione **Pular** ou **Adicionar mesmo assim**.
5. Uma vez aceito, o servidor inicia um fluxo NDJSON. Um quadro de pré-visualização provisório é exibido em 5-7 segundos, permitindo editar os detalhes do item imediatamente enquanto o backend conclui a etiquetagem.
6. Verifique as tags detectadas automaticamente (cor, tecido, caimento, estampa, ocasião). Se o formato do recorte estiver incorreto, altere o menu suspenso **Categoria**; isso aciona o SegFormer para recortar a peça novamente de forma automática.
7. Clique em **Salvar** para exibir o item de forma otimista na grade do guarda-roupa imediatamente (~16 ms) enquanto a geração de miniaturas WebP em segundo plano é concluída.

#### B. Escaneando Passaportes Digitais de Produtos da UE (DPP)
1. Toque no botão **Escanear QR (DPP)** na página Adicionar Item.
2. Conceda permissão de câmera e alinhe o código QR impresso na etiqueta da roupa, ou envie uma captura de tela salva do código QR.
3. O backend resolve a URL e executa verificações de segurança SSRF (bloqueando faixas de IP privados).
4. O sistema extrai os esquemas JSON-LD para obter marca, composição de materiais, rastreabilidade da cadeia de suprimentos, pegada de carbono e instruções de lavagem.
5. Revise os dados extraídos exibidos no painel sanfonado verde **Dados DPP Verificados** e clique em **Salvar**.

#### C. Importando Recibos de Comércio Digital
1. Abra a aba **Importação Digital** (*Digital Import*).
2. Escolha um submodo: **Colar Texto**, **Enviar Imagem**, **Enviar PDF** ou inserir um **Link da Web**.
3. O backend utiliza modelos de visão multimodal para extrair os dados da transação (marca, preço, tamanho, categoria).
4. Os campos extraídos são bloqueados por recibo para protegê-los contra futuras reanálises visuais. Clique em **Salvar** para confirmar.

---

### 3.2 AI Virtual Stylist Conversacional
Descreva seus dilemas de estilo e receba sugestões faladas de looks com as mãos livres.

1. Navegue até a tela **AI Stylist**.
2. Clique no ícone de microfone `[Microphone]` na barra de entrada do chat.
3. Fale sua solicitação (ex.: "Qual blusa combina com minha calça bege para um almoço ao ar livre em um dia chuvoso?").
4. Se o Web Speech for suportado, sua voz será transcrita ao vivo na caixa de texto. Caso contrário, o aplicativo grava um arquivo WebM e faz o envio.
5. O backend direciona as consultas de usuários gratuitos para o contêiner Eyes local (`Qwen 2.5 VL 3B` ajustado) e direciona os usuários dos planos Manager e Professional para o modelo rápido em nuvem (`Google Gemini 3.5 Flash`), com fallback automático para o motor Eyes local caso ocorram limites de requisições na nuvem.
6. O estilista processa o histórico do seu guarda-roupa, previsões meteorológicas locais e eventos da agenda para formular uma proposta de estilo.
7. O estilista fala a resposta usando perfis de voz pré-selecionados (`puck`, `aoede` ou `charon`).
8. Toque em **Ouvir resposta** (ou **Replay** no modo hebraico) no card para ouvir o áudio novamente.

---

### 3.3 Perfil, Preferências e Dependências de Subsistemas
A página de Perfil funciona como o painel de controle central do DressApp. Os campos de configuração impactam diretamente o desempenho, o roteamento e o comportamento dos módulos seguintes.

##### Dependências e Justificativa das Seções em Sanfona

1. **Fotos e Palco do Avatar Digital (`AvatarViewer2D` e `DynamicAvatar`)**
   - **Por que isso importa?**: Renderiza sua identidade visual em todas as telas de prova usando um palco de modo duplo (recorte de foto real segmentada vs manequim vetorial SVG Bézier 2D dinâmico).
   - **Dependências do subsistema**: Os recortes de fotos têm o fundo removido via U2-Net (`rembg`) local e são reduzidos no navegador para no máximo 1280px com 82% de qualidade para caber no limite de documento de 16 MB do MongoDB. O palco aplica pontos anatômicos calibrados (`top-[14.5%]` do colarinho ao decote, `top-[36.5%]` do cós à cintura, `bottom-[2%]` para o plano dos calçados) e escala proporcional de tórax/quadril ($scaleX$). Clique em *Remover Foto* para alternar instantaneamente de volta para o manequim vetorial SVG 2D.

2. **Perfil de Estilo (Regras de recato, Código de vestimenta)**
   - **Por que isso importa?**: Estabelece limites pessoais para os looks recomendados, evitando que a IA gere sugestões de estilo inadequadas.
   - **Dependências do subsistema**: Os parâmetros selecionados (ex.: restrições de vestimenta modesta) são enviados diretamente para os prompts de estilo do Gemini 2.5 Flash, filtrando as peças compatíveis do guarda-roupa antes de serem exibidas.

3. **Dados Pessoais (Nome, Telefone, Profissão)**
   - **Por que isso importa?**: Personaliza o tom de comunicação e direciona alertas de notificação.
   - **Dependências do subsistema**: O nome do usuário é inserido dinamicamente em e-mails e notificações push do sistema. O número de telefone serve como registro de contingência para alertas agendados. O parâmetro de profissão alimenta o LLM do estilista e o classificador de personalização do Trend Scout para adaptar as propostas.

4. **Medidas Corporais e Tamanhos (Modelo de Regressão ANSUR II e Preditor de Tamanhos)**
   - **Por que isso importa?**: Elimina dúvidas sobre tamanhos, permitindo o cálculo automático de tamanhos comerciais, comparação de medidas em lojas externas e sobreposição virtual precisa de camadas.
   - **Dependências do subsistema**: Inserir 4 parâmetros básicos (**Altura**, **Peso**, **Cintura**, **Comprimento do Pé**) aciona o modelo de regressão ANSUR II do scikit-learn (`body_predictor.py`) para prever automaticamente 6 dimensões estruturais (*Ombros*, *Tórax*, *Quadril*, *Manga*, *Entrepernas*, *Costura Externa*).
     - **Conversão Determinística de Tamanhos**: Uma vez previstas as medidas contínuas, o motor de tamanhos do backend as converte dinamicamente em tamanhos comerciais de varejo: **Tamanho de Camisa** (XS-XXL com base no tórax), **Tamanho de Calça** (Cintura em polegadas), **Tamanho de Calçado** (padrões masculino/feminino dos EUA e padrão da UE com base no comprimento do pé e gênero), **Tamanho de Vestido** (EUA 0-14+ com base no tórax, cintura e quadril) e **Tamanho de Sutiã** (Faixa + Taça com base no tórax e abaixo do busto estimado).
     - **Preenchimento Automático**: Esses tamanhos comerciais recomendados são preenchidos automaticamente nos campos do *Modo de Edição Detalhada* dentro do painel de perfil.
     - **Integrações**: As medidas são consultadas diretamente pelos scripts de conteúdo da extensão do Chrome **Assistente de Compras** (*Shopping Assistant*) para ler tabelas de medidas em sites parceiros (Zara, Asos) e recomendar tamanhos.

5. **Estilo de Vida (Estado civil, Sexo)**
   - **Por que isso importa?**: Personaliza as recomendações padrão e pontua os algoritmos de conteúdo.
   - **Dependências do subsistema**: A seleção de sexo afeta diretamente a lógica de classificação dos cards diários do Trend Scout. Se a categoria de um card de notícia não corresponder ao sexo do usuário, o algoritmo aplica uma penalidade de -2.0 pontos, reduzindo sua prioridade no feed.

6. **Roteamento de Modelos de IA e Planos de Assinatura (Roteamento em Níveis Zero-BYOK e Créditos)**
   - **Por que isso importa?**: Determina o roteamento de modelos por nível de assinatura e o consumo de créditos sem exigir nenhuma chave de API do usuário.
   - **Dependências do subsistema**: Usuários do plano gratuito são direcionados ao contêiner Eyes local (`Qwen 2.5 VL 3B` ajustado). Assinantes dos planos Manager e Professional são direcionados ao modelo rápido em nuvem (`Google Gemini 3.5 Flash`), com fallback automático de cota para o motor Eyes local.

7. **Agendador e Notificações Push (Frequência, alarme diário, foco de estilo)**
   - **Por que isso importa?**: Gerencia os envios automáticos diários de sugestões de estilo.
   - **Dependências do subsistema**: Ativa tarefas agendadas (`APScheduler`) no backend FastAPI. Todas as manhãs, dispara notificações push via `pywebpush` utilizando as chaves VAPID do cliente, correspondendo aos parâmetros de foco de estilo selecionados.

8. **Google Calendar (Sincronização OAuth, regras de exportação)**
   - **Por que isso importa?**: Conecta seu guarda-roupa diretamente aos seus compromissos reais da agenda.
   - **Dependências do subsistema**: Autentica via Google OAuth. O agendador consulta seu calendário para identificar eventos, formata os looks e envia os eventos diretamente para sua agenda do Google Calendar.

9. **Serviços de Localização (Rastreamento GPS, precisão meteorológica)**
   - **Por que isso importa?**: Coordena sugestões adequadas ao clima e filtros de raio para transações locais.
   - **Dependências do subsistema**: Aciona a geocodificação reversa via `navigator.geolocation`. As coordenadas são enviadas à API OpenWeatherMap para ajustar as recomendações do estilista (ex.: capa de chuva para tempestades). Também calcula distâncias para anúncios locais no Marketplace e especialistas (ex.: verificação de raio em Lisboa).

10. **Voz e Idioma (Seleção de voz do estilista virtual)**
    - **Por que isso importa?**: Define os dicionários regionais de texto e as modulações de voz.
    - **Dependências do subsistema**: Controla o idioma ativo para traduções via `react-i18next`. A seleção de voz mapeia códigos BCP-47 (ex.: `he-IL` ou `ar-JO`) para vozes de síntese Web Speech do cliente ou modelos offline Piper TTS.

11. **Convidar Amigos (API de compartilhamento de convite)**
    - **Por que isso importa?**: Oferece um ciclo viral para expansão gratuita da capacidade do guarda-roupa.
    - **Dependências do subsistema**: Anexa o ID do MongoDB de quem indicou à URL. Novos cadastros consultam dinamicamente esse ID e incrementam de forma atômica o campo `closet_capacity_bonus` do indicador em +10 vagas, atualizando os limites em `closet.py`.

---

### 3.4 Painel de Estatísticas do Guarda-Roupa (Wardrobe Insights)
Analise o valor de capitalização do guarda-roupa, acompanhando a utilização das peças e parâmetros de custo por uso.

1. Navegue até **Estatísticas do Guarda-Roupa** (*Wardrobe Insights*).
2. **Revisar Métricas**:
   - *Valor do Guarda-Roupa (Closet Worth)*: Soma dinâmica dos preços de compra.
   - *Utilização do Guarda-Roupa (Closet Utilization)*: Porcentagem de peças do armário usadas pelo menos uma vez.
   - *Custo Médio por Uso (CPW)*: Calculado como `Preço / Quantidade de Usos`.
3. **Gráficos de Distribuição**: Alterne as abas para ver visualizações Recharts:
   - *Paleta de Cores*: Distribuição dos códigos hexadecimais mapeados.
   - *Materiais*: Distribuição percentual de tecidos.
   - *Subcategorias*: Subcategorias mapeadas.
4. **Ranking de Eficiência**: Veja as 5 peças com as menores pontuações de Custo por Uso (CPW).

---

### 3.5 Tela e Planejador de Looks (Outfit Canvas)
Monte, sobreponha em camadas e revise propostas de looks em uma tela de avatar 2D interativa.

1. Abra o planejador **Outfit Canvas**.
2. **Camadas de Agasalhos (Tela Dupla)**: Se o seu look incluir agasalho/peça externa (ex.: uma jaqueta) sobre uma blusa, a página renderiza dois módulos verticais: "Com Agasalho" (*With Outerwear*, mostrando a jaqueta sobreposta) e "Sem Agasalho" (*Without Outerwear*, revelando a peça de baixo).
3. **Elementos 2D Interativos**: Toque diretamente em qualquer peça de roupa no corpo do avatar. O aplicativo leva você direto para a tela de detalhes daquela peça.
4. **Aba de Métricas**: Clique no botão de detalhes e escolha a aba **Métricas** (*Metrics*) para ver barras de progresso dos critérios de compatibilidade:
   - *Harmonia de Cores* (harmonia neutra)
   - *Compatibilidade de Estampas* (prevenção de conflito de padrões)
   - *Caimento Corporal* (correspondência de tamanho)
   - *Adequação ao Clima* (adequação à estação)
   - *Adequação ao Evento* (adequação à atividade)
   - *Adequação ao Local* (verificação das regras de modéstia)
5. **Renomear/Descrever**: Clique no ícone de lápis para editar nomes e descrições dos looks.

---

### 3.6 Assistente de Mala (Suitcase Assistant)
Organize sua bagagem para viagens sem levar peso desnecessário.

1. Vá até a página **Mala** (*Suitcase*) e preencha o formulário de Contexto da Viagem (destino, datas de início/fim, categoria da viagem, eventos da agenda).
2. A IA gera uma lista de bagagem personalizada e looks diários com base na duração da viagem e nas previsões do tempo.
3. Revise o progresso da mala. Se faltar um item importante (ex.: guarda-chuva para chuva, roupa de banho para praia), o sistema avisa você e sugere opções compatíveis do marketplace ou de lojas locais.
4. Use o chat integrado para refinar as sugestões (ex.: "Mude o dia 2 para roupa casual noturna"). O assistente edita a mala preservando o restante da lista.
5. Toque em **Aprovar Mala** (*Approve Suitcase*) para finalizar seu plano.

---

### 3.7 Agendador e Lembretes Push
Configure alertas diários de estilo para receber recomendações de looks automaticamente.

1. Abra **Perfil** e vá até **Agendador e Push** (*Scheduler & Push*).
2. Ative as notificações, defina um horário diário, a frequência semanal e o tema de foco de estilo.
3. Todas as manhãs, a tarefa agendada em segundo plano (`APScheduler`) verifica a previsão do tempo e envia uma notificação push.
4. Toque na notificação no seu aparelho (ou veja na Central de Notificações do aplicativo web) para abrir uma janela com 3 sugestões de looks.
5. Salve uma sugestão diretamente no seu **Diário do Guarda-Roupa** (*Wardrobe Diary*).

---

### 3.8 Marketplace (Revenda, Aluguel, Troca e Doação)
Participe do marketplace circular de moda ponto a ponto (peer-to-peer).

- **Criar um Anúncio**: Abra a página de detalhes de um item, selecione **Editar Intenção** (*Edit Intent*) e escolha uma opção pública:
  - *À Venda (For Sale)*: Informe o preço anunciado e a moeda (detecta sua moeda padrão pelas preferências regionais).
  - *Aluguel (Rent)*: Defina a diária de locação e as condições de empréstimo.
  - *Troca (Swap)*: Marque o item como aberto para permuta.
  - *Doação (Donate)*: Publique o item gratuitamente.
- **Sincronização de Estado**: Os anúncios são propagados para o feed automaticamente. O cliente utiliza `useSyncExternalStore` e cache IndexedDB para carregar parâmetros de busca com latência zero.
- **Sandbox de Prova Virtual**: Locatários e compradores podem testar como um item anunciado combina com as peças do seu próprio armário privado antes de finalizar a compra.
- **Checkout Transacional**:
  - *Compra/Aluguel*: Conclua a transação através dos botões integrados do PayPal. Os webhooks capturados notificam o vendedor, alteram o estado do anúncio para vendido/alugado e registram a transação no livro-razão descontando a taxa de 7% da plataforma.
  - *Permuta (Troca)*: Os interessados propõem trocas. O anunciante recebe e-mails de confirmação para aceitar ou recusar.

---

### 3.9 Painel de Administração (Admin Panel)
Validação de disponibilidade do sistema, escrituração financeira e gerenciamento de contas de usuários.

1. Navegue até `/admin` (disponível para perfis de administrador).
2. **Visão Geral (Overview)**: Audite os Volumes Brutos e os resumos de receita de Taxas da Plataforma. Inspecione a **Tabela de Atividade de Provedores** (*Provider Activity Table*) para ver estatísticas de disponibilidade (API do Gemini, latência do serviço de clima e taxas de erro).
3. **Provedores (Providers)**: Clique em **Verificar Chave** (*Verify Key*) para enviar um ping direto à API do Gemini. Alterne a chave **Substituição de Visão Eyes** (*Eyes Vision Override*) para direcionar a análise de imagens entre o endpoint padrão do Gemini e um contêiner local.
4. **Usuários (Users)**: Veja créditos ativos, funções e pagamentos acumulados. Use ações diretas para Promover ou Rebaixar usuários.
5. **Anúncios (Listings)**: Visualize os estados dos anúncios e alterne sinalizadores ativos para suspender itens fraudulentos.

---

## 4. Resultados Esperados

- **Cadastro de Peças**: Os itens preenchem imediatamente a grade do guarda-roupa (~16 ms). Os recortes de fundo geram resultados PNG limpos e transparentes.
- **Selo Verificado DPP**: Escanear passaportes válidos exibe o card informativo verde com detalhes de sustentabilidade.
- **Agasalhos no Avatar**: Peças externas são exibidas corretamente sobrepostas às blusas na tela do avatar 2D sem cortar chapéus ou calçados.
- **Resposta por Voz**: As respostas em texto do Estilista Virtual reproduzem áudio falado automaticamente com um indicador visual de onda sonora.
- **Assinaturas**: Fazer upgrade para um plano Manager ou Professional remove imediatamente o aviso de limite de capacidade do guarda-roupa.

---

## 5. Solução de Problemas

### Erro HTTP 402 Payment Required
- **Problema**: Cadastro bloqueado. Você atingiu o limite básico de 50 itens no guarda-roupa (ou até 150 itens com bônus de indicação).
- **Solução**: Acesse a **página de Preços** (`/pricing`) e assine o plano Manager ou Professional, ou compartilhe seu link de convite para ganhar +10 vagas por cadastro (até o máximo de 150 itens).

### Bloqueio SSRF / Erro de DNS no DPP
- **Problema**: A URL escaneada do passaporte QR falha ao ser analisada.
- **Solução**: O analisador bloqueia endereços IP privados (ex.: `127.0.0.1`, `192.168.x.x`) para proteger servidores internos. Certifique-se de que os códigos QR apontem para domínios públicos.

### Permissão de Câmera / Microfone Negada
- **Problema**: A janela de captura/leitura exibe uma tela de erro com 'X', ou a digitação por voz falha.
- **Solução**: Abra as permissões do navegador, habilite o acesso à Câmera e ao Microfone para o domínio e recarregue a página.

### Falha no Chat do Estilista / Limites de Requisição
- **Problema**: O chat exibe erros ou congela.
- **Solução**: O servidor intercepta os limites de taxa `429` do Gemini e recorre a um algoritmo de seleção baseado em regras ou ao motor local Eyes. Verifique sua conexão com a Internet.

### Picos de Falta de Memória (OOM) no VPS
- **Problema**: Picos de CPU/RAM durante processos de envio.
- **Solução**: O cadastro utiliza travas de fila sequenciais para lotes >5 itens. Certifique-se de que o servidor tenha pelo menos 4 GB de RAM.

---

## 6. Limitações

- **APIs Web Speech do Navegador**: A transcrição nativa de fala para texto é restrita ao Chrome e Safari; outros navegadores utilizam a entrada de texto padrão.
- **Modulações Offline no Cliente**: A síntese de voz offline Piper ONNX em dispositivos móveis utiliza menos perfis de voz do que o módulo de áudio Gemini no servidor.
- **Restrições de Tamanho de Imagem**: Envios de avatar e perfil são compactados localmente no navegador a 82% de qualidade para caber dentro do limite de documento de 16 MB do MongoDB.
- **Escopo de Leitura de Recibos**: Recibos muito borrados, distorcidos ou manuscritos podem falhar na extração de dados.
