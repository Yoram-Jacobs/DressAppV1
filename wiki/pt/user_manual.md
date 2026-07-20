# Manual do Utilizador Técnico Completo do DressApp

Manual do utilizador abrangente e guia de referência técnica para o ecossistema de guarda-roupa pessoal DressApp, motor de styling, mercado circular e painéis de administração.

---

## 1. Visão Geral e Arquitetura Tecnológica

O DressApp é um gestor de guarda-roupa pessoal movido a IA, consultor de estilo e mercado circular. Ajuda os utilizadores a gerir peças de roupa digitalmente, recortar e etiquetá-las automaticamente, receber recomendações de roupas adaptadas ao clima e ao calendário, digitalizar Passaportes Digitais de Produtos da UE (DPP) e negociar vestuário.

### Proposta de Valor Principal
- **Ingestão de Guarda-Roupa Digital**: Processamento de fotos tiradas ou carregadas com remoção automatizada do fundo, categorização de roupas e geração de etiquetas de atributos.
- **Estilista Virtual IA**: Um agente conversacional que analisa contextualmente o seu guarda-roupa, eventos do Google Calendar e previsões meteorológicas locais para sugerir roupas diárias.
- **Mercado Circular**: Compra, venda, troca e aluguer seguro de roupas entre pares para reduzir o desperdício da moda rápida (fast fashion).
- **Análise do Custo por Utilização (CPW)**: Informações detalhadas sobre o valor de capitalização do guarda-roupa, taxas de utilização e otimização de uso.

### Arquitetura Tecnológica
- **Backend Edge**: Python 3.11 com FastAPI, utilizando drivers assíncronos Motor conectados a um cluster MongoDB Atlas.
- **Frontend SPA**: Aplicação de página única em React 19 que utiliza stores personalizadas `useSyncExternalStore` (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, primitivas Shadcn/UI e `react-i18next` com suporte para 12 idiomas.
- **Otimização de Estado e Rede**: Deduplicação de pedidos em curso, conversão em cache das stores durante 15 minutos e revalidação de separador ao alterar `visibilitychange`, resultando em zero pedidos GET em segundo plano quando inativo.
- **Machine Learning Local e Tamanhos**: Recorte de fundo local na CPU via U2-Net (`rembg`), análise de roupas com SegFormer-b2, embeddings Fashion-CLIP e modelo de regressão de medições corporais ANSUR II (`body_predictor.py`). Opcionalmente encaminha para contentores GPU auto-hospedados (SegFormer-b3 + BiRefNet) para operações rápidas.
- **STT/TTS Conversacional**: Fallback de reconhecimento de voz Web Speech no cliente em tempo real, modulações multimodais Gemini 2.5 Flash no servidor e motores offline Piper/Sherpa-ONNX no dispositivo.
- **Serviços de Integração Externa**: API OpenWeatherMap para obtenção do tempo, OAuth do Google Calendar para exportação de agendas diárias, autocompletar endereços OpenStreetMap (Nominatim) e APIs REST de Subscrições/Checkout do PayPal.

---

## 2. Pré-requisitos

### Requisitos do Ambiente de Hospedagem
- **Hardware**: VPS com no mínimo 4 GB de RAM (ex.: Hetzner VPS a hospedar o ambiente de produção `dressapp.co`).
- **Dependências**: Stack Docker & Docker Compose (incluindo backend, frontend e terminação TLS Caddy).
- **Variáveis de Ambiente**: Configuração de chaves API (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` e tokens OAuth do Google Calendar).

### Requisitos da Aplicação do Utilizador
- **Navegador Web**: Google Chrome ou Apple Safari (necessário para compatibilidade total com funcionalidades de voz).
- **Permissões**: Conceder permissão de Câmara (para capturas de roupas e digitalizações de QR) e permissão de Microfone (para conversação por voz).
- **Rede**: Conexão ativa para processamento LLM, com suporte de cache IndexedDB para navegação no catálogo offline.

---

## 3. Instruções Passo a Passo

### 3.1 Ingestão de Peças de Roupa (Adicionar Itens)
PARADIGMAS DE INGESTÃO: Fotografia, Passaportes Digitais de Produtos da UE e Recibos de Comércio Digital.

#### A. Câmara Interativa e Carregamento de Ficheiros
1. Navegue até ao ecrã **Adicionar Item**.
2. Selecione **Tirar Foto** (inicia a câmara nativa do telemóvel) ou clique em **Carregar Fotos** (abre o seletor de ficheiros do SO).
3. O cliente calcula o hash SHA-256 e o hash de diferença horizontal (dHash) da imagem no navegador (~100-180 ms) para verificar contra o seu guarda-roupa existente.
4. Se for encontrada uma correspondência, abre-se a caixa de diálogo **Pré-verificação de Duplicados** mostrando pré-visualizações correspondentes. Selecione **Ignorar** ou **Adicionar de qualquer forma**.
5. Assim que aceite, o servidor inicia um fluxo NDJSON. Um quadro de pré-visualização temporário é exibido dentro de 5-7 segundos, permitindo editar os detalhes do item imediatamente enquanto o backend conclui a etiquetagem.
6. Verifique as etiquetas detetadas automaticamente (cor, tecido, ajuste, padrão, ocasião). Se a forma do recorte estiver incorreta, altere o menu suspenso **Categoria**; isto aciona o SegFormer para recortar automaticamente a peça de roupa.
7. Clique em **Guardar** para pintar otimistamente o item na grelha do guarda-roupa de imediato (~16 ms) enquanto a geração de miniaturas WebP em segundo plano é concluída.

#### B. Digitalização de Passaportes Digitais de Produtos (DPP) da UE
1. Toque no botão **Digitalizar QR (DPP)** na página Adicionar Item.
2. Conceda permissões de câmara e alinhe o código QR impresso na etiqueta da peça de roupa, ou carregue uma captura de ecrã de QR guardada.
3. O backend resolve o URL e executa verificações de segurança SSRF (bloqueando intervalos de IP privados).
4. O sistema analisa os esquemas JSON-LD para extrair marca, composição de materiais, rastreabilidade da cadeia de abastecimento, pegada de carbono e instruções de lavagem.
5. Reveja os dados extraídos exibidos no painel verde acordeão **Dados DPP Verificados** e clique em **Guardar**.

#### C. Importação de Recibos de Comércio Digital
1. Abra o separador **Importação Digital**.
2. Escolha um submodo: **Colar Texto**, **Carregar Imagem**, **Carregar PDF**, ou insira um **Link Web**.
3. O backend utiliza modelos de visão multimodal para extrair dados da transação (marca, preço, tamanho, categoria).
4. Os campos analisados ficam bloqueados com base no recibo para os proteger de futuras reanálises visuais. Clique em **Guardar** para confirmar.

---

### 3.2 Estilista Virtual IA Conversacional
Descreva dilemas de estilo e receba conselhos de roupa falados sem usar as mãos.

1. Navegue até ao ecrã **Estilista IA**.
2. Clique no ícone de microfone `[Microphone]` na barra de entrada do chat.
3. Pronuncie o seu pedido (ex.: "Qual parte de cima combina com as minhas calças bege para um almoço ao ar livre num dia de chuva?").
4. Se o Web Speech for suportado, a sua voz é transcrita em direto na caixa de entrada. Caso contrário, a aplicação grava um ficheiro WebM e carrega-o.
5. O backend encaminha a consulta de voz para o contentor local Gemma4 (recorrendo à transcrição do Gemini 2.5 Flash se estiver offline).
6. O estilista processa o histórico do seu guarda-roupa, previsões meteorológicas locais e eventos do calendário para formular uma proposta de estilo.
7. O estilista fala a resposta utilizando perfis de voz pré-selecionados (`puck`, `aoede` ou `charon`).
8. Toque em **Reproduzir resposta** (ou **Reiterar** no modo hebraico) no cartão para ouvir novamente o áudio.

---

### 3.3 Perfil, Preferências e Dependências de Subsistemas
A página de Perfil serve como o painel de controlo principal do DressApp. Os campos de configuração impactam diretamente o desempenho, encaminhamento e comportamento dos módulos derivados.

##### Dependências e Razões de Ser das Secções Acordeão

1. **Palco de Fotos e Avatar Digital (`AvatarViewer2D` e `DynamicAvatar`)**
   - **Por que é importante?**: Renderiza a sua identidade visual em todas as telas de prova utilizando um palco de modo duplo (recorte de foto de corpo real segmentado vs manequim vetorial SVG Bezier 2D dinâmico).
   - **Dependências de subsistemas**: Os recortes de fotos são processados via U2-Net (`rembg`) local e reduzidos no navegador para um máximo de 1280px com 82% de qualidade para ficar dentro do limite de 16 MB dos documentos MongoDB. O palco aplica pontos de referência calibrados (`top-[14.5%]` do colarinho ao decote, `top-[36.5%]` da cintura à linha da cintura, `bottom-[2%]` plano do calçado) e um dimensionamento proporcional do peito/ancas ($scaleX$). Clique em *Remover foto* para voltar imediatamente ao manequim vetorial 2D SVG.

2. **Perfil de Estilo (Regras de modéstia, Código de vestuário)**
   - **Por que é importante?**: Estabelece limites pessoais para as roupas recomendadas, impedindo a IA de gerar sugestões inadequadas.
   - **Dependências de subsistemas**: Os parâmetros selecionados (ex.: restrições de vestuário modesto) são inseridos diretamente nos prompts de styling para o Gemini 2.5 Flash, filtrando os resultados do guarda-roupa antes de serem exibidos.

3. **Detalhes (Nome, Telefone, Ocupação)**
   - **Por que é importante?**: Personaliza o tom de comunicação e encaminha alertas de notificação.
   - **Dependências de subsistemas**: O nome do utilizador é inserido dinamicamente em e-mails e notificações push do sistema. O número de telefone serve como registo de reserva para alertas agendados. O parâmetro ocupação é passado ao LLM do estilista e ao classificador de personalização Trend Scout para ajustar as propostas.

4. **Medições Corporais e Tamanhos (Modelo de Regressão ANSUR II)**
   - **Por que é importante?**: Elimina dúvidas sobre tamanhos, permitindo a comparação de tamanhos em retalhistas externos e uma sobreposição virtual precisa.
   - **Dependências de subsistemas**: Inserir 4 parâmetros básicos (**Altura**, **Peso**, **Cintura**, **Comprimento do pé**) ativa o modelo de regressão ANSUR II do scikit-learn (`body_predictor.py`) para prever automaticamente 6 dimensões estruturais (*Ombros*, *Peito*, *Ancas*, *Manga*, *Entrepernas*, *Comprimento externo*). As medições são consultadas diretamente pelos scripts de conteúdo da extensão do Chrome **Assistente de Compras** para ler tabelas de tamanhos em sites parceiros (Zara, Asos) e recomendar tamanhos.

5. **Estilo de Vida (Estado, Sexo)**
   - **Por que é importante?**: Adapta as recomendações padrão e pontua os algoritmos de conteúdo.
   - **Dependências de subsistemas**: A seleção do sexo afeta diretamente a lógica de classificação dos cartões diários do Trend Scout. Se a categoria de um cartão de notícias não coincidir com o sexo do utilizador, o algoritmo aplica uma penalização de -2.0 pontos, despromovendo-o no feed.

6. **Configuração de IA (Chaves SaaS, modo edge, créditos)**
   - **Por que é importante?**: Determina o encaminhamento de faturação, o desempenho operacional e o estado offline da rede.
   - **Dependências de subsistemas**: Encaminha pedidos de geração de texto/áudio. As configurações padrão consomem créditos do sistema DressApp. Inserir chaves API pessoais (Google AI Studio, Anthropic, OpenAI) redireciona os custos para as contas de faturação de programador do utilizador. Selecionar o modo local edge encaminha os pedidos para o contentor offline Gemma.

7. **Agendador e Push (Frequência, alarme diário, foco de estilo)**
   - **Por que é importante?**: Gere avisos diários automáticos de estilo.
   - **Dependências de subsistemas**: Ativa tarefas cron do `APScheduler` no backend FastAPI. Todas as manhãs, dispara notificações push via `pywebpush` utilizando as chaves VAPID do cliente, de acordo com os parâmetros de foco de estilo selecionados.

8. **Google Calendar (Sincronização OAuth, regras de exportação)**
   - **Por que é importante?**: Liga o seu guarda-roupa diretamente aos seus eventos reais do calendário.
   - **Dependências de subsistemas**: Autentica via Google OAuth. O agendador consulta o seu calendário para identificar eventos, formatar roupas e enviar eventos diretamente para a sua agenda do Google Calendar.

9. **Serviços de Localização (Rastreio GPS, precisão meteorológica)**
   - **Por que é importante?**: Coordena sugestões adequadas ao tempo e filtros de raio de transações locais.
   - **Dependências de subsistemas**: Dispara a geocodificação inversa `navigator.geolocation`. As coordenadas são enviadas para a API OpenWeatherMap para ajustar as recomendações do estilista (ex.: roupa de chuva em caso de aguaceiros). Também calcula distâncias para anúncios do Mercado local e especialistas (ex.: verificações de raio em Lisboa).

10. **Voz e Idioma (Seleção de voz do estilista virtual)**
    - **Por que é importante?**: Estabelece os dicionários de texto e modulações de voz.
    - **Dependências de subsistemas**: Controla o idioma ativo para traduções via `react-i18next`. A seleção de voz associa códigos de voz BCP-47 (ex.: `he-IL` ou `ar-JO`) a vozes de síntese Web Speech do cliente ou modelos Piper TTS offline.

11. **Convidar Amigos (API de partilha)**
    - **Por que é importante?**: Fornece um ciclo viral para a expansão gratuita do guarda-roupa.
    - **Dependências de subsistemas**: Anexa o ID MongoDB do referente ao URL. Os novos registos consultam dinamicamente este ID e incrementam atomicamente o `closet_capacity_bonus` do referente em +10 vagas, modificando os limites em `closet.py`.

---

## 3.4 Painel de Análise do Guarda-Roupa
Análise o valor de capitalização do guarda-roupa, acompanhe a utilização das peças e os parâmetros de custo por utilização.

1. Navegue até **Análise do Guarda-Roupa**.
2. **Rever Métricas**:
   - *Valor do Guarda-Roupa*: Soma dinâmica dos preços de compra.
   - *Utilização do Guarda-Roupa*: Percentagem de peças do guarda-roupa usadas pelo menos uma vez.
   - *Custo Médio por Utilização (CPW)*: Calculado como `Price / Wear Count`.
3. **Gráficos de Distribuição**: Alterne entre separadores para ver visualizações do Recharts:
   - *Paleta de Cores*: Distribuição de códigos hexadecimais mapeados.
   - *Materiais*: Distribuição de percentagens de tecidos.
   - *Subcategorias*: Subcategorias mapeadas.
4. **Tabela de Eficiência**: Veja as 5 principais peças de roupa com as pontuações de Custo por Utilização mais baixas.

---

## 3.5 Tela de Roupas e Planeador
Crie, sobreponha e reveja propostas de roupas numa tela interativa de avatar 2D.

1. Abra o planeador **Tela de Roupas**.
2. **Sobreposição de Roupas Exteriores (Tela Dupla)**: Se a sua roupa incluir peças exteriores (ex.: um casaco) sobre uma peça superior, a página renderiza dois módulos de tela verticais: "Com Roupa Exterior" (mostrando o casaco sobreposto) e "Sem Roupa Exterior" (revelando a peça inferior).
3. **Elementos 2D Interativos**: Toque diretamente em qualquer peça de roupa no corpo do avatar. A aplicação encaminha-o diretamente para o ecrã de detalhes dessa peça.
4. **Separador de Revisão de Métricas**: Clique no botão de detalhes e escolha o separador **Métricas** para ver barras de progresso dos critérios de compatibilidade:
   - *Harmonia de Cores* (harmonia neutra)
   - *Compatibilidade de Padrões* (prevenção de conflito de padrões)
   - *Ajuste Corporal* (correspondência de tamanho)
   - *Adaptação ao Tempo* (adequação à estação)
   - *Adaptação ao Evento* (adequação à atividade)
   - *Adaptação à Localização* (verificações de regras de modéstia)
5. **Renomear/Descrever**: Clique no ícone do Lápis para editar nomes e descrições das roupas.

---

## 3.6 Assistente de Mala
Organize as suas necessidades de bagagem para viagens sem levar peso excessivo.

1. Vá para a página **Mala** e preencha o formulário Contexto da Viagem (destino, datas de início/fim, categoria de viagem, eventos da agenda).
2. A IA gera uma lista de bagagem personalizada e roupas diárias com base na duração da viagem e nas previsões meteorológicas.
3. Reveja o progresso da bagagem. Se faltar um item importante (ex.: guarda-chuva para a chuva, fato de banho para a praia), o sistema alerta-o e sugere correspondências do mercado ou lojas locais.
4. Utilize a caixa de chat integrada para refinar as sugestões (ex.: "Mudar o dia 2 para roupa informal de noite"). O assistente edita a mala mantendo o restante da lista.
5. Toque em **Aprovar Mala** para finalizar o seu plano.

---

## 3.7 Agendador e Lembretes Push
Defina alertas diários de estilo para receber recomendações de roupas automaticamente.

1. Abra o **Perfil** e vá para **Agendador & Push**.
2. Ative as notificações, defina uma hora de notificação diária, frequência nos dias da semana e o tema de foco de estilo.
3. Todas as manhãs, a tarefa cron em segundo plano (`APScheduler`) verifica as previsões meteorológicas e envia uma notificação push.
4. Toque na notificação no seu dispositivo (ou consulte o Centro de Notificações da aplicação web) para abrir uma caixa de diálogo mostrando 3 sugestões estilizadas.
5. Guarde uma sugestão diretamente no seu **Diário do Guarda-Roupa**.

---

## 3.8 Mercado (Revenda, Aluguer, Troca, Doação)
Participe no mercado de moda circular entre pares.

- **Criar um Anúncio**: Abra a página de detalhes de um item, selecione **Editar Intenção** e escolha uma intenção não privada:
  - *Para venda*: Insira o preço de lista e a moeda (deteta a sua moeda padrão via preferências regionais).
  - *Alugar*: Defina a tarifa de aluguer diária e as condições de empréstimo.
  - *Trocar*: Marque o item como disponível para troca.
  - *Doar*: Publique o item gratuitamente.
- **Sincronização de Estado**: Os anúncios são propagados para o feed automaticamente. O cliente utiliza `useSyncExternalStore` e cache IndexedDB para carregar parâmetros de pesquisa sem latência.
- **Sandbox de Experimentação**: Os locatários/compradores podem testar a combinação de um anúncio com peças do seu guarda-roupa privado antes de finalizar a compra.
- **Checkout da Transação**:
  - *Compra/Aluguer*: Conclua a transação através dos botões PayPal integrados. Os webhooks capturados notificam o vendedor, alteram o estado do anúncio para vendido/alugado e registam as transações no livro-razão subtraindo a taxa de plataforma de 7%.
  - *Permuta (Troca)*: Os interessados propõem trocas. O anunciante recebe e-mails de confirmação para aceitar ou recusar.

---

## 3.9 Painel de Administração
Validação do estado do sistema, contabilidade financeira e gestão de contas de utilizador.

1. Navegue até `/admin` (disponível para funções de administrador).
2. **Visão Geral**: Audite os Volumes Brutos e resumos de receitas de taxas de plataforma. Inspecione a **Tabela de Atividade dos Provedores** para ver estatísticas de disponibilidade (API Gemini, latência do serviço meteorológico e taxas de erro).
3. **Provedores**: Clique em **Verificar Chave** para enviar um ping direto para a API Gemini. Ative o interruptor **Eyes Vision Override** para encaminhar a análise de imagem entre o endpoint Gemini padrão e um contentor local Gemma.
4. **Utilizadores**: Veja créditos ativos, funções e pagamentos acumulados. Utilize ações diretas para Promover ou Despromover utilizadores.
5. **Anúncios**: Veja os estados dos anúncios e altere os sinalizadores ativos para suspender itens fraudados.

---

## 4. Resultados Esperados

- **Ingestão**: Os itens aparecem imediatamente na grelha do guarda-roupa (~16 ms). O recorte em segundo plano produz resultados PNG transparentes e limpos.
- **Crachá DPP Verificado**: A digitalização de passaportes válidos exibe o cartão de informação verde com detalhes de sustentabilidade.
- **Roupa Exterior no Avatar**: A roupa exterior é exibida corretamente sobreposta sobre as peças superiores na tela do avatar 2D sem ocultar chapéus ou calçado.
- **Resposta de Voz**: As saídas de texto do Estilista Virtual reproduzem o áudio falado automaticamente com um indicador de forma de onda visível.
- **Subscrições**: Ativar o Pro remove imediatamente o aviso de limite de 150 itens.

---

## 5. Resolução de Problemas

### HTTP 402 Payment Required
- **Problema**: Ingestão bloqueada. Atingiu o limite máximo de base de 150 itens no guarda-roupa.
- **Solução**: Vá a Perfil -> Subscrição e atualize para Pro, ou partilhe o seu link de convite para obter +10 vagas por registo.

### SSRF Bloqueado / Erro de DNS no DPP
- **Problema**: O URL do passaporte QR digitalizado não é analisado.
- **Solução**: O analisador bloqueia endereços IP privados (ex.: `127.0.0.1`, `192.168.x.x`) para proteger os servidores internos. Certifique-se de que os códigos QR apontam para domínios públicos.

### Permissão de Câmara / Microfone Negada
- **Problema**: A visualização de captura/digitalização exibe um ecrã de erro 'X', ou a dactilografia por voz falha.
- **Solução**: Abra as permissões do navegador, ative o acesso à câmara e ao microfone para o domínio e recarregue a página.

### Falha no Chat do Estilista / Limites de Taxa
- **Problema**: O chat mostra erros ou congela.
- **Solução**: O servidor captura os limites de taxa `429` do Gemini e recorre a um algoritmo de seleção de guarda-roupa baseado em regras. Verifique a sua ligação à Internet.

### Memória Esgotada (OOM) Picos no VPS
- **Problema**: Picos de CPU/RAM durante os processos de carregamento.
- **Solução**: A ingestão utiliza bloqueios de fila sequenciais para lotes superiores a 5 itens. Certifique-se de que o servidor possui pelo menos 4 GB de RAM.

---

## 6. Limitações

- **APIs de Web Speech do Navegador**: A conversão nativa de Voz para Texto está restrita ao Chrome e Safari; outros navegadores recorrem à entrada de texto padrão.
- **Modulações Offline do Cliente**: A síntese de voz Piper ONNX offline em telemóveis utiliza menos perfis de voz do que o modelo de áudio Gemini do servidor.
- **Restrições de Tamanho de Imagem**: Os carregamentos de avatar e perfil são comprimidos localmente no navegador para 82% de qualidade para não ultrapassar o limite de 16 MB dos documentos MongoDB.
- **Alcance da Análise de Recibos**: Recibos muito desfocados, distorcidos ou manuscritos podem falhar na extração de dados.
