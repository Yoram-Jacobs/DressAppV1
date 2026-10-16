# Política de Privacidade do DressApp

**Data de Vigência:** 23 de setembro de 2026  
**Última Atualização:** 16 de outubro de 2026  
**Versão da Aplicação:** 1.0.5  
**Website Oficial:** [https://dressapp.co](https://dressapp.co)  
**URL Dedicada à Privacidade:** [https://dressapp.co/privacy](https://dressapp.co/privacy)  

Bem-vindo ao **DressApp** ("nós", "nosso", "conosco" ou "a Aplicação"). O DressApp é uma plataforma inteligente de guarda-roupa digital, planeamento de estilo e estilista pessoal com IA desenvolvida e operada pela **DressApp Ltd.**

Esta Política de Privacidade explica detalhadamente como acedemos, recolhemos, utilizamos, processamos, armazenamos, divulgamos, retemos e protegemos as informações pessoais quando você utiliza a nossa plataforma web, aplicações móveis e serviços conectados. Por favor, leia este documento com atenção. Ao criar uma conta ou utilizar o DressApp, você reconhece e concorda com as práticas descritas nesta política.

---

## 1. Informações que Recolhemos e às Quais Acedemos

Recolhemos informações que você nos fornece diretamente, informações recolhidas automaticamente através da interação com o dispositivo e informações obtidas através de integrações autorizadas de terceiros.

### 1.1 Informações de Conta e Identidade
- **Credenciais de Autenticação:** Endereço de e-mail e palavras-passe/senhas criptografadas com hash (com salt gerado via bcrypt). Nunca armazenamos palavras-passe em texto simples.
- **Detalhes do Perfil:** Nome de exibição, nome próprio, apelido/sobrenome, número de telefone (opcional), data de nascimento (opcional) e género (opcional, utilizado para consultoria de estilo personalizada e geometria do avatar).
- **Dados Demográficos e de Medidas:** Medidas corporais (altura, peso, peito/busto, cintura, ancas/quadril, entrepernas, comprimento do braço), preferência de tom de pele e perfil de cabelo (opcional) para gerar avatares de prova virtual e recomendações precisas de caimento.
- **Informações de Localização:** Cidade, país e coordenadas geográficas aproximadas (latitude/longitude) fornecidas com o seu consentimento para obter condições meteorológicas locais para recomendações diárias de looks adequados ao clima.

### 1.2 Guarda-Roupa Digital, Multimédia e Looks
- **Fotos de Peças de Vestuário:** Imagens de artigos de vestuário que você fotografa ou carrega para o seu armário digital.
- **Metadados das Peças:** Categoria do artigo (Parte Superior, Parte Inferior, Calçado, Agasalho/Exterior, Vestido, Acessório), marca, paleta de cores, composição do tecido, formalidade/código de vestimenta, estação e etiquetas de estado de conservação.
- **Looks e Combinações:** Combinações de roupas criadas pelo utilizador, looks agendados no calendário e listas de bagagem para malas de viagem.
- **Conteúdo do Marketplace:** Anúncios de artigos criados para venda, troca ou doação, incluindo descrições, preços pedidos e preferências de entrega.

### 1.3 Permissões do Dispositivo
- **Câmara:** Utilizada estritamente quando você tira fotografias de peças de vestuário diretamente na aplicação.
- **Galeria de Fotos:** Utilizada estritamente quando você escolhe fotografias existentes de peças ou avatares de perfil para carregar.
- **Notificações Push:** Utilizadas apenas com a sua permissão para enviar lembretes diários de looks, atualizações do assistente de mala e alertas de segurança importantes.

---

## 2. Dados de Utilizador do Google e Declaração de Uso Limitado

O DressApp disponibiliza integrações opcionais com o Google para facilitar o início de sessão do utilizador e o agendamento personalizado. Esta secção detalha explicitamente quais os dados de utilizador do Google a que acedemos, como são utilizados, como são armazenados e a nossa adesão aos rigorosos padrões de privacidade do Google.

> ### Política de Dados do Utilizador dos Serviços de API do Google — Declaração de Uso Limitado
> **A utilização e transferência pelo DressApp para qualquer outra aplicação de informações recebidas das APIs do Google cumprirão a [Política de Dados do Utilizador dos Serviços de API do Google](https://developers.google.com/terms/api-services-user-data-policy), incluindo os requisitos de Uso Limitado.**

### 2.1 A Que Dados de Utilizador do Google Acedemos

| Âmbito da API do Google (Scope) | Dados Acedidos | Finalidade Específica no DressApp |
|---|---|---|
| `openid`<br>`userinfo.email`<br>`userinfo.profile` | ID de utilizador do Google, endereço de e-mail principal, nome completo e URL da imagem de avatar do perfil. | Para autenticar a sua identidade, criar e proteger a sua conta de utilizador no DressApp e exibir o seu nome e avatar de perfil no painel do seu guarda-roupa pessoal. |
| `https://www.googleapis.com/auth/calendar.events.readonly` | Resumos de eventos do Google Calendar, carimbos de data/hora de início e fim dos eventos, localizações e descrições dos eventos. | Acesso apenas de leitura utilizado exclusivamente pela funcionalidade AI Stylist para basear as sugestões de looks na sua agenda real (por exemplo, sugerir vestuário executivo para reuniões agendadas, roupa desportiva para treinos ou trajes formais para eventos noturnos). |
| `https://www.googleapis.com/auth/user.birthday.read`<br>`https://www.googleapis.com/auth/user.gender.read` | Data de nascimento e género (se preenchidos no seu perfil Google e concedidos explicitamente). | Utilizados para calibrar algoritmos de tamanho do avatar corporal, conselhos de estilo adequados à idade e recomendações de caimento. |
| `https://www.googleapis.com/auth/user.phonenumbers.read`<br>`https://www.googleapis.com/auth/user.addresses.read` | Número de telefone e endereço (se preenchidos no seu perfil Google e concedidos explicitamente). | Utilizados apenas para pré-preencher endereços de envio em transações no marketplace e recuperação de conta, mediante confirmação explícita do utilizador. |

### 2.2 Como Utilizamos os Dados de Utilizador do Google
- Os dados de utilizador do Google são utilizados **estritamente para fornecer e melhorar funcionalidades voltadas para o utilizador** da aplicação DressApp (autenticação, configuração do perfil de utilizador e recomendações de looks baseadas na agenda).
- Processamos os títulos e horários dos eventos do Google Calendar em memória transitória para gerar recomendações diárias de guarda-roupa e listas de viagem.

### 2.3 Proibições e Proteções Estritas sobre os Dados de Utilizador do Google
- **Sem Treinamento de Modelos:** Os dados de utilizador do Google e os dados das APIs do Google Workspace **NÃO** são utilizados para desenvolver, melhorar ou treinar modelos generalizados ou não personalizados de Inteligência Artificial (IA) ou Aprendizagem Automática (ML).
- **Sem Publicidade:** **NÃO** utilizamos, transferimos nem divulgamos dados de utilizador do Google para veicular anúncios publicitários, incluindo publicidade direcionada, personalizada, de retargeting ou baseada em interesses.
- **Sem Corretores de Dados ou Revenda:** **NÃO** vendemos, alugamos, licenciamos nem negociamos dados de utilizador do Google com terceiros, corretores de dados ou revendedores de informação sob quaisquer circunstâncias.
- **Sem Avaliação de Crédito ou Empréstimos:** Os dados de utilizador do Google nunca são utilizados para determinar a solvência financeira ou para fins de concessão de crédito.
- **Restrições de Acesso Humano:** Colaboradores, contratados e programadores humanos **NÃO** leem os seus dados de utilizador do Google, a menos que:
  1. Você tenha fornecido consentimento afirmativo explícito para uma sessão específica de suporte técnico;
  2. Seja estritamente necessário para investigações de segurança (tais como investigar abusos, fraudes ou malware);
  3. Seja exigido para cumprir a legislação estatutária aplicável ou ordens governamentais válidas; ou
  4. Os dados sejam agregados e anonimizados para operações técnicas internas.

---

## 3. Como Processamos e Utilizamos os Dados Gerais

Processamos informações pessoais não provenientes do Google com base nos seguintes fundamentos legais:

| Atividade de Processamento | Base Legal (RGPD / Padrões Globais) | Categorias de Dados Utilizadas |
|---|---|---|
| Indexação, catalogação do guarda-roupa digital e criação de looks | Execução de contrato | Fotografias de peças, categorias, cores, metadados |
| Remoção de fundo por IA e extração de recortes transparentes | Execução de contrato | Fotografias de vestuário carregadas |
| Recomendações de looks e consultoria do AI Stylist | Interesse legítimo / Consentimento | Metadados do guarda-roupa, preferências de estilo |
| Planeamento de looks adaptado à meteorologia | Consentimento (permissão de localização) | Localização aproximada (cidade/coordenadas) |
| Comunicações transacionais (alertas de segurança, redefinição de palavra-passe) | Execução de contrato | Endereço de e-mail da conta |
| Transações no marketplace e facilitação de pagamentos | Execução de contrato | Tokens do processador de pagamentos (Stripe/PayPal), histórico de transações |

---

## 4. Armazenamento de Dados, Segurança e Mecanismos de Proteção

Implementamos medidas de segurança administrativas, técnicas e físicas robustas concebidas para proteger os seus dados sensíveis contra acesso não autorizado, alteração, divulgação ou destruição:

- **Encriptação em Trânsito:** 100% dos dados transmitidos entre o seu navegador/aplicação e os nossos servidores são encriptados utilizando protocolos modernos **HTTPS e Transport Layer Security (TLS 1.3 / TLS 1.2)**.
- **Proteção de Armazenamento e Base de Dados Local Auto-Hospedada Isolada:** Todos os registos da base de dados, metadados do guarda-roupa, dados de perfil e credenciais OAuth encriptadas são armazenados na **base de dados MongoDB 7.0 local (on-premises)** isolada e autogerida do DressApp, alojada em armazenamento NVMe dedicado na **Hetzner Cloud (UE)**, isolada dentro de uma rede privada interna de contentores sem exposição pública da porta da base de dados e protegida por encriptação AES-256 para tokens sensíveis e cópias de segurança locais automatizadas.
- **Proteção Criptográfica de Palavras-Passe:** As palavras-passe dos utilizadores são protegidas com hash bcrypt incorporando salts individuais por utilizador.
- **Controlo de Acesso:** O acesso à infraestrutura de produção é estritamente restrito através de autenticação por chave SSH, autenticação multifator (MFA), controlos de acesso baseados em funções de menor privilégio (RBAC) e registo contínuo de auditoria.

---

## 5. Retenção e Eliminação de Dados

### 5.1 Período de Retenção
- Retemos os seus dados pessoais e registos do guarda-roupa enquanto a sua conta de utilizador no DressApp permanecer ativa.
- Os tokens de acesso do Google OAuth e a cache do calendário são retidos apenas enquanto a integração com o Google permanecer ativa e autorizada por si.

### 5.2 Desconectar Integrações do Google
- Pode desconectar a sua conta Google ou a integração com o Google Calendar a qualquer momento diretamente na aplicação através de **Configurações → Integrações → Desconectar Google**.
- Também pode revogar as permissões do DressApp diretamente nas [Configurações de Segurança da sua Conta Google](https://myaccount.google.com/permissions).
- Após a desconexão, os tokens Google OAuth armazenados e os registos em cache de eventos do calendário são imediatamente eliminados dos nossos sistemas ativos.

### 5.3 Eliminação de Conta e Direito ao Esquecimento
Você tem o direito absoluto de eliminar a sua conta e todos os dados associados a qualquer momento:
- **Eliminação com Um Clique na Aplicação:** Navegue até **Configurações → Conta → Excluir Conta**.
- **Por Solicitação via E-mail:** Envie um e-mail a partir do seu endereço registado para [dev@dressapp.co](mailto:dev@dressapp.co) com o assunto "Delete My Account" ("Excluir Minha Conta").

A eliminação da conta executa uma exclusão em cascata imediata e irreversível em todas as bases de dados, apagando permanentemente:
- O seu perfil de utilizador, registos de identidade e credenciais de autenticação;
- Todas as peças do guarda-roupa, fotografias carregadas e imagens com fundo removido;
- Todos os looks guardados, entradas do diário de estilo e listas de viagem;
- Todos os anúncios no marketplace e referências de transações;
- Todo o histórico de conversas com o estilista de IA, vetores de incorporação (embeddings) e tokens do Google.

Todos os dados são completamente destruídos no prazo de 30 dias após o pedido de eliminação.

---

## 6. Partilha de Dados, Divulgações e Terceiros

Não vendemos, alugamos nem comercializamos os seus dados pessoais. O armazenamento principal da base de dados e o motor base de visão computacional ("The Eyes") são operados diretamente pelo DressApp na nossa infraestrutura de servidores próprios (on-premises) isolada e autogerida, sem intermediários externos de base de dados SaaS. Divulgamos informações apenas a fornecedores verificados de infraestrutura e serviços que nos auxiliam na operação da plataforma, estritamente vinculados por acordos de processamento de dados:

| Prestador de Serviços | Dados Divulgados | Finalidade |
|---|---|---|
| **Hetzner Online GmbH (Infraestrutura na UE)** | Volumes de servidor encriptados que alojam a base de dados MongoDB local autogerida do DressApp, ficheiros multimédia do guarda-roupa e inferência de IA local (on-premises) | Servidor privado virtual (VPS) europeu dedicado e infraestrutura de armazenamento NVMe (centro de dados na UE em conformidade com o RGPD) |
| **Google Cloud Platform / APIs do Google** | Tokens de autenticação OAuth, prompts de consultas de estilo | Autenticação de utilizadores e análise de estilo com IA Gemini |
| **Stripe / PayPal** | Tokens de transações de pagamento, metadados de faturação | Processamento de pagamentos em conformidade com PCI (os números de cartão nunca tocam nos nossos servidores) |
| **Resend / Serviço de E-mail Transacional** | Endereço de e-mail, nome de exibição do utilizador | Envio de avisos críticos do sistema e redefinição de palavras-passe |

---

## 7. Direitos Internacionais de Privacidade (RGPD, CCPA/CPRA, LGPD, PIPEDA)

Dependendo da sua localização geográfica, você usufrui de direitos legais específicos de privacidade:
- **Direito de Acesso / Portabilidade:** Pode solicitar uma cópia completa, em formato JSON legível por máquina, de todos os dados pessoais que detemos sobre si.
- **Direito de Retificação:** Pode atualizar ou corrigir qualquer informação pessoal inexata a qualquer momento nas configurações da aplicação.
- **Direito à Eliminação:** Pode solicitar a exclusão permanente dos seus dados pessoais conforme descrito na Secção 5.
- **Direito de Restrição ou Oposição:** Pode opor-se à definição automatizada de perfis ou retirar o consentimento para o processamento de localização/câmara a qualquer momento.
- **Não Discriminação:** Nunca o discriminaremos, negaremos serviços ou alteraremos preços por você ter exercido os seus direitos de privacidade.

---

## 8. Privacidade de Menores

O DressApp destina-se estritamente a indivíduos com pelo menos 16 anos de idade (ou a idade mínima legal de consentimento digital na sua jurisdição). Não solicitamos nem recolhemos intencionalmente informações pessoais de menores de 16 anos. Se descobrirmos que um menor de 16 anos nos forneceu informações pessoais, eliminaremos imediatamente esses dados dos nossos servidores.

---

## 9. Alterações a Esta Política de Privacidade

Podemos atualizar periodicamente esta Política de Privacidade para refletir alterações nos nossos serviços, avanços tecnológicos ou requisitos legais. Quando ocorrerem atualizações, reveremos a data da "Última Atualização" no topo desta política e notificaremos os utilizadores através de um aviso na aplicação ou notificação por e-mail em caso de alterações substanciais. Recomendamos que consulte esta página regularmente.

---

## 10. Informações de Contacto e Questões sobre Proteção de Dados

Se tiver dúvidas, preocupações, comentários ou solicitações relativamente a esta Política de Privacidade ou aos seus dados pessoais, entre em contacto com a nossa equipa de Proteção de Dados:

- **Organização:** DressApp Ltd.
- **Contacto Principal de Privacidade:** [dev@dressapp.co](mailto:dev@dressapp.co)
- **Contacto de Suporte ao Utilizador:** [lokoprod@gmail.com](mailto:lokoprod@gmail.com)
- **Endereço Postal:** DressApp Ltd., 11 Hanoter St, 8442711 Be'er-Sheva, Israel
- **Website Oficial:** [https://dressapp.co](https://dressapp.co)
- **URL Dedicada à Privacidade:** [https://dressapp.co/privacy](https://dressapp.co/privacy)

Estamos empenhados em analisar e resolver todas as questões de privacidade prontamente e no prazo máximo de trinta (30) dias após a receção.