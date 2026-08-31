# Política de Privacidade do DressApp

**Data de vigência:** 27 de julho de 2026
**Última atualização:** 27 de julho de 2026

Esta Política de Privacidade descreve como o DressApp ("nós", "nosso" ou "a nós") coleta, utiliza, armazena, compartilha e protege seus dados pessoais quando você usa nosso aplicativo de guarda-roupa digital e estilismo.

Por favor, leia esta política cuidadosamente. Ao usar o DressApp, você concorda com as práticas de dados descritas neste documento. Se não concordar, não use o aplicativo.

---

## 1. Informações que Coletamos

### 1.1 Informações da Conta e Perfil
Quando você cria uma conta ou se conecta por meio de login social, coletamos:

- **Endereço de e-mail** — usado para identificação da conta, autenticação e comunicações transacionais.
- **Senha** — armazenada como hash criptográfico; nunca armazenamos senhas em texto puro.
- **Nome de exibição** — seu nome público escolhido dentro do aplicativo.
- **Primeiro nome e sobrenome** — preenchidos pelo perfil do Google OAuth ou inseridos manualmente; editáveis a qualquer momento.
- **Número de telefone** — opcional; usado para recuperação de conta e notificações.
- **Data de nascimento** — opcional; usado para filtragem de conteúdo por idade.
- **Sexo** — opcional; usado para recomendações de medidas corporais e avatar.
- **Estado civil** — opcional (solteiro, casado, divorciado, viúvo).
- **Endereço** — opcional; estruturado como {linha1, linha2, cidade, região, país, código postal}.
- **Idioma e região preferidos** — usados para localizar a experiência do aplicativo.
- **Voz preferida** — usada para a saída de voz do estilista de IA.
- **Avatar e fotos de perfil** — foto de rosto e foto corporal, armazenadas como URLs de dados base64 no MongoDB (limitadas a ~500 KB cada no lado do cliente).
- **Medidas corporais** — altura, peso, busto, cintura, quadris e outras medidas usadas para geração de avatar e recomendações de caimento de roupas.
- **Perfil de cabelo** — comprimento, tipo, cor e estilo (opcional).
- **Localização de origem** — cidade, país e coordenadas (lat/long), usado para sugestões de looks baseadas no clima e segmentação de campanhas.
- **Perfil de estilo e contexto cultural** — suas preferências de estilo e origem cultural usados para recomendações personalizadas.

### 1.2 Dados de Guarda-Roupa e Mídia
DressApp é um aplicativo de guarda-roupa digital. Os seguintes dados são essenciais para o funcionamento do aplicativo:

- **Fotos do guarda-roupa** — imagens de suas peças de roupa carregadas. São processadas no navegador para remoção de fundo (matting) e depois armazenadas como URLs de dados no MongoDB.
- **Metadados de peças** — categoria (Parte Superior, Parte Inferior, Calçados, Exterior, Vestido, Acessório), marca, cor, tamanho, estação, tradição, código de vestimenta, gênero e tags de subcategoria.
- **Dados de looks** — combinações salvas de peças do guarda-roupa.
- **Anúncios no marketplace** — se você vender ou trocar itens, detalhes do anúncio incluindo fotos, preço e informações de envio.
- **Dados de mala/lista de embalagem** — listas de embalagem para viagens com itens, quantidades e tags de propósito (ex. "Trekking / Ao Ar Livre").

### 1.3 Permissões do Dispositivo
DressApp solicita as seguintes permissões do dispositivo:

- **Câmera** — para capturar fotos de peças de roupa diretamente no aplicativo.
- **Biblioteca de fotos / acesso ao sistema de arquivos** — para selecionar fotos existentes para upload.
- **Geolocalização** — acesso a localização aproximada para obter dados meteorológicos e sugerir looks. Você pode negar ou revogar esta permissão a qualquer momento.
- **Notificações** — notificações push opcionais para atualizações de campanhas e sugestões do estilista.

### 1.4 Processamento de IA e Aprendizado de Máquina
DressApp usa IA no dispositivo e no servidor para os seguintes fins:

- **Remoção de fundo (matting)** — suas fotos de peças carregadas são processadas pelo pipeline `rembg` / u2netp para extrair recortes limpos. Este processamento ocorre no servidor.
- **Previsão corporal** — o modelo SegFormer estima medidas corporais a partir de fotos de look completas.
- **Classificação de peças** — a classificação baseada em CLIP marca itens com categorias, cores e marcas.
- **Recomendações do estilista** — a API Google Gemini processa os dados do seu guarda-roupa para gerar sugestões de looks e conselhos de estilo.
- **Geração de avatar** — parâmetros de forma do avatar 3D são calculados a partir das medidas corporais para prova virtual.

**Importante:** Fotos carregadas por usuários **não** são usadas para treinar modelos de aprendizado de máquina. São processadas apenas para fornecer os recursos principais do aplicativo e não são compartilhadas com pipelines de treinamento de modelos.

### 1.5 Dados de Uso e Análise
Coletamos dados de uso agregados e anônimos para melhorar o aplicativo:

- Padrões de atividade e uso de recursos do aplicativo.
- Dados de interação com itens (visualizações, edições, exclusões).
- Identificadores de dispositivo (endereço IP, versão do sistema operacional, tipo de navegador).
- Análises de campanhas (impressões de anúncios, cliques, visualizações) — vinculadas a IDs de campanha, não a identidades individuais de usuários.

**Não** usamos SDKs de análise de terceiros (não Mixpanel, Firebase Analytics, Amplitude, Sentry, LogRocket ou similares). Todas as análises são gerenciadas internamente.

### 1.6 Dados de Pagamento
Se você usar os recursos de marketplace ou assinatura do DressApp, coletamos:

- **Stripe** — ID da conta Stripe, ID da assinatura e IDs de intenção de pagamento. Números de cartão de crédito nunca são armazenados em nossos servidores; são processados diretamente pelo Stripe.
- **PayPal** — e-mail do destinatário PayPal e IDs de pedido/captura.
- **Apple Pay / Google Play** — tokens de pagamento processados pelos SDKs da plataforma correspondente; não armazenamos detalhes de cartão.

### 1.7 Dados de Autenticação de Terceiros
- **Google OAuth** — quando você faz login com o Google, recebemos e armazenamos um token OAuth criptografado (campo `google_oauth`) usado para acessar seu perfil Google (nome, e-mail, foto) e, opcionalmente, Google Calendar e People API para funções de agendamento e contatos.

---

## 2. Como Usamos Seus Dados

Usamos seus dados para os seguintes fins:

| Finalidade | Base legal (GDPR) | Tipos de dados |
|---|---|---|
| Fornecer recursos principais do aplicativo (organização do guarda-roupa, criação de looks, geração de avatar) | Necessidade contratual | Fotos do guarda-roupa, metadados, medidas corporais |
| Processar remoção de fundo e matting de peças | Necessidade contratual | Fotos de peças carregadas |
| Gerar recomendações do estilista de IA | Interesse legítimo | Metadados do guarda-roupa, perfil de estilo |
| Obter dados meteorológicos para sugestões de looks | Consentimento (permissão de localização) | Localização de origem (aproximada) |
| Autenticar e gerenciar contas de usuário | Necessidade contratual | E-mail, hash de senha, tokens OAuth |
| Enviar e-mails transacionais (confirmações de conta, redefinição de senha, confirmações de exclusão) | Necessidade contratual | Endereço de e-mail |
| Processar pagamentos do marketplace | Necessidade contratual | Tokens Stripe/PayPal, info de faturamento |
| Detectar e prevenir fraude / abuso | Interesse legítimo | Endereço IP, identificadores de dispositivo |
| Melhorar a funcionalidade do aplicativo (análises agregadas) | Interesse legítimo | Dados de uso anônimos |
| Cumprir obrigações legais | Obrigação legal | Todos os dados conforme exigido por lei |

---

## 3. Armazenamento e Segurança de Dados

### 3.1 Armazenamento
- **Banco de dados:** MongoDB Atlas (hospedado na nuvem, camada gratuita M0 ou camada paga dependendo do deployment).
- **Imagens:** Fotos do guarda-roupa são armazenadas como URLs de dados codificadas em base64 dentro de documentos MongoDB. Cada imagem é limitada a ~500 KB no lado do cliente antes do upload.
- **Cache de modelos:** Pesos de modelos de IA (SegFormer, u2netp) são armazenados em cache em volumes Docker persistentes no servidor de produção para evitar downloads repetidos a cada solicitação.
- **Nenhum armazenamento de blob externo** é usado para imagens no momento; todos os dados de imagem residem no MongoDB.

### 3.2 Segurança
- Todos os dados em trânsito são criptografados via **HTTPS/TLS 1.3**.
- Senhas são armazenadas como **hashes bcrypt** — nunca em texto puro.
- Tokens do Google OAuth são armazenados criptografados em repouso.
- Dados de pagamento (tokens Stripe/PayPal) nunca são armazenados em texto puro em nossos servidores; armazenamos apenas IDs de referência.
- MongoDB Atlas fornece **criptografia em repouso** e **criptografia em trânsito** por padrão.
- O acesso ao banco de dados é restrito ao aplicativo backend por meio de credenciais da string de conexão.

### 3.3 Retenção de Dados
- Seus dados são retidos enquanto sua conta estiver ativa.
- Após a exclusão da conta (ver Seção 5), todos os dados pessoais são removidos permanentemente do MongoDB dentro de 30 dias.
- Dados de análise agregados e anônimos podem ser retidos indefinidamente e não podem ser vinculados a usuários individuais.

---

## 4. Compartilhamento de Dados e Terceiros

Compartilhamos seus dados com os seguintes terceiros apenas conforme descrito abaixo:

| Terceiro | Dados compartilhados | Finalidade |
|---|---|---|
| **MongoDB Atlas** | Todos os dados do usuário e imagens do guarda-roupa | Hospedagem de banco de dados na nuvem |
| **Google (OAuth)** | E-mail, nome, foto de perfil | Autenticação e criação de perfil |
| **Google Calendar API** | Dados de eventos do calendário (se conectado) | Funções de agendamento do estilista |
| **Google People API** | Dados de contatos (se conectado) | Funções sociais |
| **Google Gemini API** | Metadados do guarda-roupa e descrições de itens | Recomendações do estilista de IA |
| **Stripe** | Tokens de pagamento, info de faturamento | Processamento de pagamentos |
| **PayPal** | Tokens de pagamento, info de faturamento | Processamento de pagamentos |
| **Resend / SendGrid** | E-mail e nome | Entrega de e-mails transacionais |

**NÃO vendemos seus dados pessoais ou fotos do guarda-roupa para corretores, anunciantes ou agregadores de dados de terceiros.**

---

## 5. Seus Direitos e Exclusão de Conta

Sob o GDPR (UE/EEE), a CCPA (Califórnia) e outras leis de privacidade aplicáveis, você tem os seguintes direitos:

### 5.1 Acesso e Exportação
Você pode solicitar uma cópia de todos os dados pessoais que possuímos sobre você entrando em contato conosco (ver Seção 6). Forneceremos uma exportação JSON dos dados da sua conta, incluindo itens do guarda-roupa, looks e informações do perfil.

### 5.2 Correção
Você pode atualizar ou corrigir as informações do seu perfil a qualquer momento através da página de Configurações do aplicativo. Os campos que você pode editar incluem: nome de exibição, primeiro e último nome, telefone, data de nascimento, endereço, medidas corporais, localização de origem e preferências de estilo.

### 5.3 Exclusão (Direito ao Esquecimento)
Você pode excluir sua conta e todos os dados associados a qualquer momento:

- **No aplicativo:** Vá para Configurações → Conta → Excluir Conta.
- **API:** Envie uma solicitação `POST` para `/api/v1/users/me/delete` (autenticada).

A exclusão da conta aciona uma **exclusão em cascata** em todas as coleções:
- Documento do usuário
- Todos os itens do guarda-roupa (fotos e metadados)
- Todos os looks
- Todos os anúncios no marketplace
- Todas as malas e listas de embalagem
- Todas as sessões e mensagens do estilista
- Todas as recargas de créditos e registros de transações
- Todos os embeddings (dados gerados por IA)
- Todas as assinaturas de notificações push

Um e-mail de confirmação de exclusão é enviado para o seu endereço de e-mail registrado.

### 5.4 Portabilidade de Dados
Você pode solicitar seus dados em um formato estruturado e legível por máquina (JSON) a qualquer momento. Entre em contato conosco usando os detalhes da Seção 6.

### 5.5 Retirar Consentimento
Você pode retirar o consentimento para acesso à localização, acesso à câmera e comunicações de marketing a qualquer momento através das configurações do seu dispositivo ou da página de Configurações do aplicativo. Retirar o consentimento pode limitar determinados recursos do aplicativo (ex. sugestões de looks baseadas no clima).

### 5.6 Direito de Oposição (LGPD Art. 18, GDPR Art. 21)
Sob a LGPD (Brasil) e o GDPR (UE/EEE), você tem o direito de se opor ao processamento de seus dados pessoais para fins específicos, incluindo:
- Processamento baseado em interesse legítimo
- Marketing direto
- Profiling e tomada de decisões automatizadas (incluindo recomendações do estilista baseadas em IA)

Para se opor, entre em contato conosco usando os detalhes da Seção 6.

### 5.7 Transferências Internacionais de Dados
DressApp é um aplicativo internacional. Seus dados podem ser transferidos e processados em países diferentes do seu país de residência, incluindo Israel e os Estados Unidos. Garantimos que todas as transferências sejam regidas por salvaguardas adequadas, incluindo Cláusulas Contratuais Padrão (SCC) quando exigido pela lei aplicável.

---

## 6. Informações de Contato

Para consultas relacionadas à privacidade, solicitações de acesso a dados, solicitações de exclusão ou para relatar uma preocupação com a privacidade, entre em contato conosco em:

**E-mail:** dev@dressapp.co
**Endereço:** DressApp, 11 Hanoter St, 8442711 Be'er-Sheva, Israel

Responderemos a todas as solicitações válidas dentro de 30 dias, conforme exigido pelas leis de privacidade aplicáveis incluindo GDPR, CCPA, LGPD, PIPEDA e outras regulamentações internacionais de proteção de dados.

Para Solicitações de Acesso de Titulares de Dados (DSAR), inclua o endereço de e-mail da sua conta e uma descrição dos dados que deseja acessar ou modificar.

---

## 7. Privacidade de Menores

DressApp não se destina a crianças menores de 16 anos (ou a idade de consentimento digital aplicável na sua jurisdição, o que for maior). Não coletamos conscientemente dados pessoais de ninguém menor desta idade. Se tomarmos conhecimento de que um menor nos forneceu dados pessoais, tomaremos medidas para excluí-los prontamente.

Se você é um pai ou tutor legal e acredita que seu filho nos forneceu dados pessoais, entre em contato conosco em dev@dressapp.co e tomaremos medidas imediatas.

---

## 8. Conformidade Internacional

DressApp é projetado para funcionar em todos os países. Esta Política de Privacidade é redigida para cumprir os seguintes marcos internacionais de proteção de dados:

| Marco | Jurisdição | Disposições-chave cobertas |
|---|---|---|
| **GDPR** | UE/EEE | Base legal, direitos do titular de dados, contato do DPO, transferências internacionais, notificação de violações |
| **CCPA/CPRA** | Califórnia, EUA | Direito de saber, excluir, opt-out de venda, não discriminação |
| **LGPD** | Brasil | Base legal, direitos do titular de dados, DPO, transferências internacionais, consentimento |
| **PIPEDA** | Canadá | Consentimento, acesso, correção, responsabilidade, notificação de violações |
| **POPIA** | África do Sul | Processamento legal, direitos do titular de dados, transferência transfronteiriça |
| **PDPA** | Tailândia | Consentimento, direitos do titular de dados, transferência internacional |
| **PDPL** | Arábia Saudita | Base legal, direitos do titular de dados, transferência internacional |

Quando a lei de uma jurisdição específica exigir direitos ou proteções adicionais além dos descritos nesta política, esses direitos adicionais se aplicarão.

---

## 9. Alterações nesta Política de Privacidade

Podemos atualizar esta Política de Privacidade de tempos em tempos. Notificaremos você sobre alterações materiais por meio de:

- Publicando a política atualizada nesta página com uma "Data de vigência" revisada.
- Enviando uma notificação por e-mail para o seu endereço de e-mail registrado para alterações significativas.
- Exibindo um aviso no aplicativo na próxima vez que você o abrir.

Encorajamos você a revisar esta política periodicamente.

---

## 10. Data de Vigência e Lei Aplicável

Esta Política de Privacidade está em vigor a partir de **27 de julho de 2026**.

DressApp é um aplicativo internacional que opera em todos os países. Esta política é regida pelos princípios do **Regulamento Geral sobre a Proteção de Dados (GDPR)** — UE/EEE, o **California Consumer Privacy Act (CCPA)** — Estados Unidos, a **Lei Geral de Proteção de Dados (LGPD)** — Brasil, a **Lei de Proteção de Informações Pessoais e Documentos Eletrônicos (PIPEDA)** — Canadá e outras leis internacionais aplicáveis de proteção de dados. Em caso de conflito entre estes marcos, o padrão mais protetor para o usuário se aplicará.

---

## 11. Conformidade das Lojas de Aplicativos

Esta Política de Privacidade é hospedada publicamente em:

**https://dressapp.co/privacy**

É referenciada em:
- **Apple App Store Connect** — Seção de Privacidade do App
- **Google Play Console** — Seção de Segurança de Dados
- **Configurações do aplicativo** — um link direto está disponível no menu de Configurações
- **Fluxo de integração** — um aviso de privacidade é exibido durante a configuração inicial da conta

---

*DressApp respeita sua privacidade e está comprometido com práticas de dados transparentes. Se você tiver alguma dúvida sobre esta política ou sobre como lidamos com seus dados, entre em contato conosco em dev@dressapp.co.*