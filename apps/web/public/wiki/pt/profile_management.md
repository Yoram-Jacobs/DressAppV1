# Perfil, Medidas e Configurações (`/me`)

Gerencie medidas físicas, tom de pele, recortes de fotos de corpo inteiro, preferências de estilo, credenciais de modelos de IA e integrações do sistema no seu painel de perfil pessoal.

## Visão geral
A página de **Perfil e Configurações** (`https://dressapp.co/me`) funciona como a central de controle do seu ecossistema DressApp. Ela reúne seus parâmetros antropométricos físicos, o palco do avatar digital para prova virtual, restrições de estilo, preferências regionais, configuração de modelos de IA e agendamentos de notificações push.

---

## Pré-requisitos
- Uma conta ativa no DressApp.
- (Opcional) Permissões de câmera do dispositivo para envio de foto de corpo inteiro.
- (Opcional) Permissões de localização para segmentação de campanhas de estilistas locais, restrições culturais e previsão do tempo.

---

## Guia Passo a Passo: Visão Geral Completa da Página

### 1. Cabeçalho da Página e Barra de Navegação Explorar
Localizados na parte superior do painel `/me`:
- **Cabeçalho**: Exibe o status e o título da sua conta.
- **Cards Explorar**: Atalhos rápidos para as seções principais do aplicativo:
  - **Trend Scout** (`/trends`): Veja feeds diários de notícias de moda selecionados por IA.
  - **Looks** (`/outfits`): Acesse seu calendário de combinações salvas.
  - **Especialistas** (`/experts`): Procure estilistas de moda e alfaiates locais.
  - **Desempacotado / Estatísticas** (`/me/stats`): Veja a avaliação do guarda-roupa, métricas de custo por uso e distribuição de cores.

### 2. Card de Seleção de Idioma e Voz
Exibido em destaque para acessibilidade imediata:
- **Seletor de Idioma**: Escolha entre 12 idiomas suportados (*inglês, espanhol, francês, alemão, italiano, português, russo, chinês, japonês, árabe, híndi, hebraico*). Selecionar um idioma atualiza automaticamente o idioma da interface e vincula o modelo regional padrão de voz Text-to-Speech (TTS).

---

### 3. Card de Identidade e Dados Pessoais (`ProfileDetailsCard`)

Contém 9 painéis expansíveis em sanfona que gerenciam sua identidade pessoal, tamanhos e renderização do avatar:

#### Painel A: Identidade
- **Nome e Sobrenome**: Campos de identificação pessoal.
- **Endereço de E-mail**: Exibição somente leitura do seu e-mail cadastrado.
- **Data de Nascimento**: Utilizada para personalizar a pontuação demográfica de tendências.
- *Selo de Preenchimento Automático do Google*: Exibido automaticamente caso seu perfil tenha sido preenchido via Google OAuth.

#### Painel B: Contato e Endereço de Entrega
- **Número de Telefone**: Necessário para receber alertas por SMS/Push com propostas diárias do agendador e campanhas de especialistas locais.
- **Endereço Linha 1**: Conta com preenchimento automático em nível de rua via OpenStreetMap (Nominatim). Ao selecionar uma sugestão, preenche automaticamente Linha 1, Cidade, Estado/Região, CEP e País.
- **Endereço Linha 2, Cidade, Estado/Região, CEP**: Campos de endereço manuais para envio no marketplace.
- **País**: Menu de seleção offline pesquisável por nome do país ou código ISO-2.

#### Painel C: Dados Demográficos
- **Sexo**: Selecione *Feminino* ou *Masculino* para configurar as medidas corporais básicas e a taxonomia de roupas.
- **Estado Civil**: Selecione *Solteiro(a)*, *Casado(a)*, *Divorciado(a)* ou *Viúvo(a)*.
- **Profissão**: Entrada de texto livre (ex.: *Estudante*, *Gerente de Marketing*, *Barista*). Alimenta o classificador de personalização do Trend Scout para priorizar notícias de estilo relevantes.

#### Guia Resumido: Sincronizando Dados Ausentes do Perfil Google (Reconsentimento da People API)
Se você entrou com o Google antes de o DressApp solicitar acesso aos detalhes de perfil na **People API** (telefone, endereço, gênero, data de nascimento), esses campos podem estar vazios. Você pode sincronizá-los com um clique:

1. **Abra a sanfona Contato ou Dados Demográficos** — você verá um botão **"Sincronizar com o Google"** (ícone de atualização) ao lado do título da seção.
2. **Clique em "Sincronizar com o Google"** — se os escopos necessários da People API não tiverem sido concedidos durante seu login original, o DressApp detectará isso e mostrará um aviso: *"O Google precisa da sua permissão para acessar os detalhes do perfil. Você será redirecionado ao Google para conceder o acesso."*
3. **Conceda o consentimento na tela do Google** — você será redirecionado para a tela de consentimento OAuth do Google. Marque as caixas de **Informações do perfil** (nome, e-mail, foto) e **Informações de contato** (telefone, endereço, gênero, data de nascimento).
4. **Retorno automático e preenchimento automático** — após o consentimento, o Google redireciona você de volta ao DressApp. A função `syncGoogleProfile()` é executada automaticamente, chamando o endpoint `/auth/google/sync-profile` do backend, que:
   - Busca seu telefone, endereço, gênero e data de nascimento na Google People API
   - Preenche os campos vazios nos painéis **Contato** (telefone, endereço) e **Dados Demográficos** (sexo, data de nascimento)
   - Salva as atualizações no seu perfil instantaneamente
5. **Pronto** — seu perfil agora está completo sem digitação manual.

> **Nota**: O botão "Sincronizar com o Google" também aparece no cabeçalho da página (ao lado do botão principal "Sincronizar Perfil Google") e funciona da mesma forma — sincronizando todos os dados disponíveis do perfil Google de uma só vez.

#### Painel D: Preferências e Unidades de Medida
- **Unidade de Peso**: Alterne entre Quilogramas (`kg`) e Libras (`lb`).
- **Unidade de Comprimento**: Alterne entre Centímetros (`cm`) e Polegadas (`in`).

#### Painel E: Fotos e Palco do Avatar Digital
- **Coluna da Esquerda — Seletores de Fotos**:
  - *Foto de Rosto*: Envie uma miniatura de avatar.
  - *Foto de Corpo Inteiro*: Envie uma fotografia de corpo inteiro. O sistema executa automaticamente o recorte local U2-Net (`rembg`) para remover o fundo.
  - *Botão Remover Foto*: Remoção com um clique do recorte da sua foto, voltando instantaneamente o palco de prova para o manequim vetorial SVG 2D sem atraso na interface.
- **Coluna da Direita — Avatar Digital e Palco de Prova Virtual**:
  - **Seletor de Tom de Pele**: Paleta de cores interativa para selecionar o tom de pele do seu manequim.
  - **Canvas de Prova do Avatar**: Renderiza peças sobre sua foto recortada ou sobre o manequim vetorial Bézier dinâmico (`DynamicAvatar.jsx`) usando deslocamentos anatômicos calibrados (`top-[14.5%]` do colarinho ao decote e `top-[36.5%]` do cós à cintura).

#### Painel F: Perfil de Estilo
- **Estética**: Palavras-chave de estilo separadas por vírgula (ex.: *Minimalista, Streetwear, Vintage*).
- **Paleta de Cores**: Tons de cores preferidos (ex.: *Tons Pastéis, Tons Terrosos, Monocromático*).
- **Evitar**: Cores ou tipos de peças para excluir estritamente das recomendações da IA (ex.: *Amarelo, Top Cropped*).
- **Recato Cultural no Vestuário**: Selecione o nível de modéstia (*Casual/Despojado*, *Moderado*, *Conservador*) para orientar a cobertura dos looks no AI Stylist.

#### Painel G: Medidas Corporais e Tamanhos (Preditor de Medidas ANSUR II)
- **Modo Inicial / Começar do Zero**: Insira 4 medidas básicas: **Altura**, **Peso**, **Circunferência da Cintura** e **Comprimento do Pé**. O modelo integrado de regressão de múltiplas saídas scikit-learn ANSUR II prevê automaticamente 6 medidas estruturais:
  - *Ombros*, *Tórax / Busto*, *Quadril*, *Comprimento da Manga*, *Entrepernas* e *Costura Externa*.
- **Conversão Automática de Tamanhos**: Assim que as medidas estruturais são previstas, algoritmos determinísticos de tamanho preenchem instantaneamente **todos os tamanhos comerciais padrão**, até o tamanho do calçado:
  - *Tamanho de Camisa Casual* (XS–XXL com base na circunferência do tórax)
  - *Tamanho de Cintura de Calça* (polegadas, convertidas de cm da cintura)
  - *Tamanho de Calçado US* (fórmulas masculinas/femininas a partir do comprimento do pé)
  - *Tamanho de Vestido Feminino* (US 0–14+ com base na cintura)
  - *Tamanho de Sutiã Feminino* (faixa + taça calculadas a partir do busto/abaixo do busto)
- **Modo de Edição Detalhada**: Após o preenchimento automático, ajuste com precisão todos os 15 parâmetros de tamanho (incluindo Tamanho de Camisa, Tamanho de Calça, Tamanho de Calçado, Tamanho de Sutiã, Tamanho de Vestido) e atributos de Cabelo (*Comprimento, Tipo, Cor, Estilo*).
- **Alternância de Unidades ao Vivo**: Mude entre *kg/cm* e *lb/in* — todos os valores são convertidos instantaneamente sem necessidade de nova previsão.

#### Painel H: Registro no Diretório Profissional e de Especialistas
- **Botão Estilista Profissional**: Registre-se como um profissional de moda verificado (estilista, alfaiate, designer).
- **Detalhes Comerciais**: Insira Nome da Empresa, Endereço, Telefone, E-mail, Website e Descrição para aparecer no diretório `/experts` e no banner de campanhas regionais.

#### Painel I: Configurações de Recebimento via PayPal
- **E-mail de Recebimento do PayPal**: Insira seu e-mail do PayPal para receber pagamentos por vendas no marketplace e campanhas ativas de especialistas.

---

### 4. Card em Sanfona de Preferências do Sistema

Gerencia configurações em nível de sistema, assinaturas e integrações de IA:

- **Roteamento de Modelos de IA (Arquitetura em Níveis — Zero BYOK)**:
  - *Plano Gratuito (Eyes Local On-Premises)*: Os usuários do plano gratuito são atendidos pelo motor **Eyes** local auto-hospedado do DressApp (atualmente um modelo **Qwen 2.5 VL 3B** ajustado) na porta 7860, sem necessidade de chaves de API pessoais.
  - *Planos Manager e Professional (Modelo Rápido em Nuvem)*: Os assinantes dos planos **Manager** e **Professional** contam com roteamento prioritário para o modelo rápido de IA em nuvem (atualmente **Google Gemini 3.5 Flash** via `llm_gateway.py`).
  - *Rede de Proteção de Cotas Local*: Caso os limites de taxa da nuvem externa (`429` / `RESOURCE_EXHAUSTED`) sejam atingidos, as consultas passam automaticamente para o contêiner auto-hospedado **Eyes** (`Qwen 2.5 VL 3B`) na porta 7860, garantindo que sua conversa de estilo nunca seja interrompida.
- **Assinatura e Limites do Guarda-Roupa**:
  - Veja o nível atual da conta (**Free**: limite base de 150 itens vs **Manager** (\$10/mês) ou **Professional** (\$15/mês): itens ilimitados + modelo rápido de IA em nuvem).
  - Acesse a **página de Preços** (`/pricing` ou clique no card do seu plano) para ver a tabela comparativa de planos, escolher uma assinatura ou comprar pacotes de créditos pré-pagos que não expiram.
  - Faça upgrade via PayPal Subscriptions ou pela Atzmai Gateway para transações locais em Israel em ILS (Bit / cartão de crédito).
  - Copiar **Link de Indicação**: Concede +10 espaços de capacidade no guarda-roupa para cada amigo que se cadastrar (até o máximo de 150 itens).
- **Agendador e Lembretes Push**:
  - Ative ou desative notificações matinais de propostas de looks.
  - Defina a frequência (*Todos os dias*, *Dia sim, dia não*, *Duas vezes por semana*, *Dias úteis*), o horário (ex.: *07:00*) e as exigências de estilo por código de vestimenta (*Casual*, *Formal*, *Esportivo*, *Personalizado*).
  - Ative alertas push VAPID no navegador.
- **Preferências de Notificação de Campanhas**:
  - Controles granulares para *Push/E-mail de Moda Local*, *Alertas de Promoções*, *Moda Sustentável*, *Promoções de Luxo* e *Estilista Pessoal*.
  - Ajuste o controle deslizante de **Distância Máxima da Campanha** (5 km a 50 km).
- **Conectar Google Calendar**: Botão OAuth para sincronizar eventos da agenda pessoal com o AI Stylist.
- **Card de Serviços de Localização**: Ative ou desative permissões de localização GPS para feeds de especialistas por distância e clima hiperlocal.
- **Botão Convidar Amigos**: Copie o link compartilhável de indicação.
- **Assistente de Compras**: Acesse os detalhes da extensão na Chrome Web Store ou gere um **Bookmarklet Universal** (`javascript:...`) para comparações instantâneas de tamanho em lojas de e-commerce.

---

### 5. Ações da Conta e Diagnósticos
- **Sair da Conta**: Encerre sua sessão atual.
- **Excluir Minha Conta**: Link para apagar permanentemente os dados da conta.
- **Painel do Desenvolvedor**: Visão de diagnóstico para testes de ambiente. Autenticado via Google OAuth (`dressappdeveloper@gmail.com`).

---

## Resultados esperados
- Sincronização instantânea de métricas físicas, tom de pele e recortes de fotos no Canvas de Prova do Avatar 2D.
- Zero requisições de rede ociosas ao navegar entre os painéis de configuração.
- Propostas personalizadas de looks do AI Stylist alinhadas às suas regras de modéstia e à sua agenda.

---

## Solução de problemas
- **O fundo da foto não foi removido**: Certifique-se de que a foto enviada seja de corpo inteiro e tenha iluminação de fundo com bom contraste.
- **Os alertas push não chegam**: Confirme se as permissões de notificação do navegador estão ativadas e se há um número de telefone salvo em *Contato*.
- **O preenchimento automático de endereço não responde**: Verifique se a conexão com a Internet está ativa para consultas ao OpenStreetMap Nominatim.

---

## Limitações
- O espaço da conta no plano gratuito (Free) é limitado a 150 itens e utiliza o modelo Eyes local (`Qwen 2.5 VL 3B`), a menos que seja feito upgrade para o plano **Manager** ou **Professional** para obter armazenamento ilimitado e o modelo rápido em nuvem (`Gemini 3.5 Flash`).
- Caso as cotas da nuvem sejam temporariamente atingidas, as solicitações passam de forma transparente para o motor Eyes local (`Qwen 2.5 VL 3B`) integrado sem interromper a sessão.
