# Perfil, Tamanhos e Configuração (`/me`)

Gerencie medidas corporais, tom de pele, recortes de fotos de corpo inteiro, preferências de estilo, credenciais de modelos de IA e integrações de sistema no seu painel de perfil pessoal.

## Visão Geral
A página **Perfil e Configurações** (`https://dressapp.co/me`) serve como centro de controle central para o seu ecossistema DressApp. Ela abriga seus parâmetros antropométricos físicos, palco de avatar de prova digital, restrições de estilo, preferências localizadas, chaves de modelos de IA e agendas de notificações push.
# Perfil, Dimensionamento & Configuração (`/me`)

Gerencie suas medições físicas, tom de pele, recortes de fotos corporais, preferências de estilo, credenciais de modelos de IA e integrações de sistemas no seu painel de perfil pessoal.

## Visão Geral
A página **Perfil & Configurações** (`https://dressapp.co/me`) serve como o centro de controle principal para o seu ecossistema DressApp. Ela abriga seus parâmetros físicos antropométricos, palco do avatar virtual para prova digital, restrições de estilo, preferências localizadas, chaves de modelos de IA e cronogramas de notificações push.

---

## Pré-requisitos
- Uma conta DressApp ativa.
- (Opcional) Permissões de câmera do dispositivo para upload de foto de corpo inteiro.
- (Opcional) Permissões de localização para segmentação de campanhas de estilistas locais e previsão do tempo.

---

## Guia Passo a Passo: Visão Geral da Página de Cima para Baixo

### 1. Cabeçalho da Página e Barra de Navegação Explorar
Localizado no topo do dashboard `/me`:
- **Cabeçalho**: Exibe o status e título da sua conta.
- **Cartões Explorar**: Atalhos rápidos para seções principais do app:
  - **Trend Scout** (`/trends`): Ver feeds diários de notícias de moda curados por IA.
  - **Looks** (`/outfits`): Acessar seu calendário de looks salvos.
  - **Especialistas** (`/experts`): Navegar por estilistas e alfaiates de moda locais.
  - **Unpacked / Estatísticas** (`/me/stats`): Ver avaliação do guarda-roupa, métricas de custo por uso e detalhamento de cores.

### 2. Cartão de Seleção de Idioma e Voz
Exibido proeminentemente para acessibilidade imediata:
- **Seletor de Idioma**: Escolha entre 12 idiomas suportados (*Inglês, Espanhol, Francês, Alemão, Italiano, Português, Russo, Chinês, Japonês, Árabe, Hindi, Hebraico*). Selecionar um idioma atualiza automaticamente a locale da UI e vincula o modelo de voz Text-to-Speech (TTS) regional padrão.

---

### 3. Cartão de Identidade e Detalhes Pessoais (`ProfileDetailsCard`)

Contém 9 painéis acordeão expansíveis gerenciando sua identidade pessoal, tamanhos e renderização de avatar:

#### Painel A: Identidade
- **Nome e Sobrenome**: Campos de identificação pessoal.
- **Endereço de E-mail**: Exibição somente leitura do seu e-mail registrado.
- **Data de Nascimento**: Usada para personalizar pontuação de tendências demográficas.
- *Badge de Preenchimento Automático do Google*: Exibido automaticamente se seu perfil foi criado via Google OAuth.

#### Painel B: Contato e Endereço de Entrega
- **Número de Telefone**: Necessário para receber alertas SMS/Push para propostas do agendador diário e campanhas de especialistas locais.
- **Linha de Endereço 1**: Apresenta autocomplete em nível de rua do OpenStreetMap (Nominatim). Selecionar uma sugestão preenche automaticamente Linha 1, Cidade, Região, CEP e País.
- **Linha de Endereço 2, Cidade, Região, CEP**: Campos de endereço manuais para envio do marketplace.
- **País**: Combobox offline pesquisável por nome do país ou código ISO-2.

#### Painel C: Demografia
- **Sexo**: Selecione *Feminino* ou *Masculino* para configurar medidas base do corpo e taxonomia de roupas.
- **Estado Civil**: Selecione *Solteiro*, *Casado*, *Divorciado* ou *Viúvo*.
- **Ocupação**: Entrada de texto livre (ex. *Estudante*, *Gerente de Marketing*, *Barista*). Alimenta o ranker de personalização do Trend Scout para priorizar notícias de estilo relevantes.

#### Painel D: Preferências e Unidades de Medida
- **Unidade de Peso**: Alternar entre Quilogramas (`kg`) e Libras (`lb`).
- **Unidade de Comprimento**: Alternar entre Centímetros (`cm`) e Polegadas (`in`).

#### Painel E: Fotos e Palco de Avatar Digital
- **Coluna Esquerda — Seletores de Foto**:
  - *Foto do Rosto*: Carregar miniatura do avatar.
  - *Foto de Corpo Inteiro*: Carregar fotografia de corpo inteiro. O sistema executa automaticamente matting U2-Net local (`rembg`) para remover o fundo.
  - *Botão Remover Foto*: Remoção com um clique do seu recorte de foto, alternando instantaneamente o palco de prova para o manequim vetorial SVG 2D com zero latência de UI.
- **Coluna Direita — Avatar Digital e Palco de Prova**:
  - **Seletor de Tom de Pele**: Paleta de cores interativa para selecionar o tom de pele do manequim.
  - **Canvas de Prova do Avatar**: Renderiza roupas sobre seu recorte de foto ou manequim vetorial Bézier dinâmico (`DynamicAvatar.jsx`) usando offsets de pontos de referência calibrados (`top-[14.5%]` colarinho-a-gola e `top-[36.5%]` cinto-a-cintura).

#### Painel F: Perfil de Estilo
- **Estéticas**: Palavras-chave de estilo separadas por vírgula (ex. *Minimalista, Streetwear, Vintage*).
- **Paleta de Cores**: Tons de cor preferidos (ex. *Pastéis, Tons Terra, Monocromático*).
- **Evitar**: Cores ou tipos de roupa a excluir estritamente de recomendações de IA (ex. *Amarelo, Cropped Tops*).
- **Conservadorismo de Vestuário Cultural**: Selecione nível de modéstia (*Casual/Relaxado*, *Moderado*, *Conservador*) para orientar a cobertura de looks do Estilista IA.

#### Painel G: Medidas Corporais e Tamanhos (Preditor de Tamanhos ANSUR II)
- **Modo Onboarding / Novo Início**: Insira 4 entradas básicas: **Altura**, **Peso**, **Circunferência da Cintura** e **Comprimento do Pé**. O modelo de regressão multi-saída ANSUR II scikit-learn integrado prevê automaticamente 6 medidas estruturais:
  - *Ombros*, *Peito/Busto*, *Quadril*, *Comprimento da Manga*, *Entrepernas* e *Comprimento Externo*.
- **Tradução Automática de Tamanhos**: Uma vez previstas as medidas estruturais, algoritmos determinísticos de tamanhos preenchem instantaneamente **todos os tamanhos padrão de varejo** até o tamanho do sapato:
  - *Tamanho Camisa Casual* (XS–XXL baseado na circunferência do peito)
  - *Tamanho Cintura Calça* (polegadas, convertido de cintura cm)
  - *Tamanho Sapato US* (fórmulas Masculino/Feminino de comprimento do pé)
  - *Tamanho Vestido Feminino* (US 0–14+ baseado na cintura)
  - *Tamanho Sutiã Feminino* (faixa + taça calculada de busto/sub-busto)
- **Modo Edição Detalhada**: Após o preenchimento automático, ajuste fino de todos os 15 parâmetros de tamanho (incluindo Tamanho Camisa, Tamanho Calça, Tamanho Sapato, Tamanho Sutiã, Tamanho Vestido) e atributos de cabelo (*Comprimento, Tipo, Cor, Estilo*).
- **Alternância de Unidades ao Vivo**: Alterne entre *kg/cm* e *lb/in* — todos os valores convertem instantaneamente sem re-previsão.

#### Painel H: Registro no Diretório Profissional e de Especialistas
- **Alternância Estilista Profissional**: Registre-se como profissional de moda verificado (estilista, alfaiate, designer).
- **Detalhes do Negócio**: Insira Nome do Negócio, Endereço, Telefone, E-mail, Site e Descrição para aparecer no diretório `/experts` e ticker de campanhas regionais.

#### Painel I: Configurações de Pagamento PayPal
- **E-mail Receptor PayPal**: Insira seu e-mail do PayPal para receber pagamentos por vendas no marketplace e campanhas ativas de especialistas.

---

### 4. Cartão Acordeão de Preferências do Sistema

Gerencia configurações em nível de sistema, assinaturas e integrações de IA:

- **Configuração de IA**:
  - *Modo Padrão*: Usa endpoints Gemini Flash 2.x gerenciados pelo sistema.
  - *Modo Chaves API Personalizadas*: Conecte chaves Google Gemini, Anthropic, OpenAI ou DeepSeek API personalizadas via modal de configuração guiada.
- **Assinatura e Limites do Guarda-Roupa**:
  - Visualize nível atual da conta (**Grátis**: limite 150 itens vs **Pro**: Itens ilimitados).
  - Atualize via PayPal Subscriptions REST API ($4.99/mês ou $29.99/ano).
  - Copie **Link de Indicação**: Concede +10 slots de capacidade do guarda-roupa para cada amigo que se registrar.
- **Agendador e Lembretes Push**:
  - Alterne notificações de propostas de look matinais.
  - Defina frequência (*Diário*, *Dia Sim Dia Não*, *Duas Vezes por Semana*, *Dias Úteis*), hora (ex. *07:00*) e exigências de dress-code (*Casual*, *Formal*, *Esportivo*, *Personalizado*).
  - Ative alertas push VAPID do navegador.
- **Preferências de Notificação de Campanhas**:
  - Alternâncias granulares para *Push/E-mail Moda Local*, *Alertas de Promoção*, *Moda Sustentável*, *Promoções de Luxo* e *Estilista Pessoal*.
  - Ajuste controle deslizante **Distância Máxima da Campanha** (5km a 50km).
- **Conectar Google Calendar**: Botão OAuth para sincronizar eventos de calendário pessoal com o Estilista IA.
- **Cartão de Serviços de Localização**: Alterne permissões GPS para feeds de especialistas por correspondência de distância e clima hiperlocal.
- **Botão Convidar Amigos**: Copie link de indicação compartilhável.
- **Assistente de Compras**: Acesse detalhes da extensão Chrome Web Store ou gere **Bookmarklet Universal** (`javascript:...`) para comparações instantâneas de tamanhos no e-commerce.

---

### 5. Ações da Conta e Diagnóstico
- **Sair**: Saia da sua sessão atual.
- **Excluir Minha Conta**: Link para excluir permanentemente os dados da conta.
- **Painel do Desenvolvedor**: Acordeão de diagnóstico para testes de ambiente.
- Uma conta ativa do DressApp.
- (Opcional) Permissões de câmera do dispositivo para upload de fotos de corpo inteiro.
- (Opcional) Permissões de localização para direcionamento de campanhas de estilistas locais, restrições culturais e previsão do tempo.

---

## Guia Passo a Passo: Visão Geral da Página de Cima a Baixo

### 1. Cabeçalho da Página & Barra de Navegação de Exploração
Localizada no topo do painel `/me`:
- **Cabeçalho**: Exibe o status e o título da sua conta.
- **Cartões de Exploração**: Atalhos rápidos para as principais seções do aplicativo:
  - **Trend Scout** (`/trends`): Veja feeds de notícias de moda diárias com curadoria de IA.
  - **Outfits** (`/outfits`): Acesse seu calendário de roupas salvas.
  - **Experts** (`/experts`): Navegue por estilistas e alfaiates locais.
  - **Unpacked / Stats** (`/me/stats`): Veja a avaliação do guarda-roupa, métricas de custo por uso (cost-per-wear) e análises de cores.

### 2. Cartão de Seleção de Idioma & Voz
Exibido em destaque para acessibilidade imediata:
- **Seletor de Idioma**: Escolha entre 12 idiomas suportados (*português, inglês, espanhol, francês, alemão, italiano, russo, chinês, japonês, árabe, híndi, hebraico*). A seleção de um idioma atualiza automaticamente o local da interface do usuário e vincula o modelo de voz Text-to-Speech (TTS) padrão da região.

---

### 3. Cartão de Identidade & Detalhes Pessoais (`ProfileDetailsCard`)

Contém 9 painéis sanfonados expansíveis que gerenciam sua identidade pessoal, dimensionamento e renderização do avatar:

#### Painel A: Identidade
- **Nome & Sobrenome**: Campos de identificação pessoal.
- **Endereço de E-mail**: Exibição somente leitura do seu e-mail registrado.
- **Data de Nascimento**: Usada para personalizar a pontuação de tendências demográficas.
- *Selo de Preenchimento Automático do Google*: Exibido automaticamente se o seu perfil foi criado via Google OAuth.

#### Painel B: Endereço de Contato & Entrega
- **Número de Telefone**: Necessário para receber alertas de SMS/Push para propostas diárias do planejador e campanhas de especialistas locais.
- **Linha de Endereço 1**: Apresenta autocompletar no nível da rua via OpenStreetMap (Nominatim). A seleção de uma sugestão preenche automaticamente a Linha 1, Cidade, Região, CEP e País.
- **Linha de Endereço 2, Cidade, Região, CEP**: Campos de endereço manuais para remessas do mercado.
- **País**: Caixa de combinação offline pesquisável por nome do país ou código ISO-2.

#### Painel C: Dados Demográficos
- **Sexo**: Selecione *Female* (Feminino) ou *Male* (Masculino) para configurar as medidas corporais básicas e a taxonomia das roupas.
- **Estado Civil**: Selecione *Single* (Solteiro/a), *Married* (Casado/a), *Divorced* (Divorciado/a) ou *Widowed* (Viúvo/a).
- **Ocupação**: Entrada de texto livre (por exemplo, *Estudante*, *Gerente de Marketing*, *Barista*). Alimenta o classificador de personalização do Trend Scout para priorizar notícias de estilo relevantes.

#### Guia Resumido: Sincronizando Dados do Perfil do Google Ausentes (Reconsentimento da People API)
Se você fez login com o Google antes de o DressApp solicitar acesso aos detalhes do perfil da **People API** (telefone, endereço, gênero, data de nascimento), esses campos podem permanecer vazios. Você pode sincronizá-los com um clique:

1. **Abra o painel de Contato ou Dados Demográficos** — você verá um botão **"Sync from Google"** (ícone de atualização) ao lado do título da seção.
2. **Clique em "Sync from Google"** — se as permissões necessárias da People API não foram concedidas durante o login original, o DressApp detecta isso e mostra um aviso: *"O Google precisa da sua permissão para acessar os detalhes do perfil. Você será redirecionado para o Google para conceder acesso."*
3. **Conceda consentimento na tela do Google** — você será redirecionado para a tela de consentimento do OAuth do Google. Marque as caixas para **Profile info** (nome, e-mail, foto) e **Contact info** (telefone, endereço, sexo, aniversário).
4. **Retorno automático & preenchimento automático** — após o consentimento, o Google o redireciona de volta para o DressApp. A função `syncGoogleProfile()` é executada automaticamente, chamando o endpoint do backend `/auth/google/sync-profile` que:
   - Busca seu telefone, endereço, gênero e data de nascimento da Google People API.
   - Preenche os campos vazios nos painéis de **Contato** (telefone, endereço) e **Dados Demográficos** (sexo, data de nascimento).
   - Salva as atualizações no seu perfil instantaneamente.
5. **Pronto** — seu perfil está completo sem digitação manual.

> **Nota**: O botão "Sync from Google" também aparece no cabeçalho da página (ao lado do botão principal "Sincronizar Perfil do Google") e funciona da mesma forma — sincroniza todos os dados de perfil do Google disponíveis de uma vez.

#### Painel D: Preferências & Unidades de Medida
- **Unidade de Peso**: Alterne entre Quilogramas (`kg`) e Libras (`lb`).
- **Unidade de Comprimento**: Alterne entre Centímetros (`cm`) e Polegadas (`in`).

#### Painel E: Fotos & Palco do Avatar Digital
- **Coluna Esquerda — Seletores de Fotos**:
  - *Foto do Rosto*: Faça upload de uma miniatura do avatar.
  - *Foto de Corpo Inteiro*: Faça upload de uma fotografia de corpo inteiro. O sistema executa automaticamente a remoção de fundo local U2-Net (`rembg`).
  - *Botão Remover Foto*: Remoção do recorte da foto com um único clique, alternando instantaneamente o palco de prova de volta para o manequim vetorial 2D SVG sem atrasos de interface.
- **Coluna Direita — Avatar Digital & Palco de Prova**:
  - **Seletor de Tom de Pele**: Paleta de cores interativa para selecionar o tom de pele do maniquí.
  - **Tela de Prova do Avatar**: Renderiza roupas em cima do recorte da sua foto ou do manequim vetorial Bezier dinâmico (`DynamicAvatar.jsx`) usando desvios calibrados (`top-[14.5%]` do colarinho ao decote e `top-[36.5%]` do cós à cintura).

#### Painel F: Perfil de Estilo
- **Estética**: Palavras-chave de estilo separadas por vírgulas (por exemplo, *Minimalist, Streetwear, Vintage*).
- **Paleta de Cores**: Tons de cores preferidos (por exemplo, *Pastels, Earth Tones, Monochrome*).
- **Evitar**: Cores ou tipos de roupas a serem estritamente excluídos das recomendações de IA (por exemplo, *Yellow, Crop Tops*).
- **Conservadorismo Cultural das Roupas**: Selecione o nível de recato (*Casual/Relaxed*, *Moderate*, *Conservative*) para guiar as recomendações de cobertura de roupas do AI Stylist.

#### Painel G: Medições Corporais & Dimensionamento (ANSUR II Sizing Predictor)
- **Modo Onboarding / Novo Começo**: Insira 4 dados básicos: **Height** (Altura), **Weight** (Peso), **Waist** (Circunferência da cintura) e **Foot Length** (Comprimento do pé). O modelo de regressão de saída múltipla ANSUR II do scikit-learn integrado prevê automaticamente 6 medições estruturais:
  - *Ombros*, *Peito / Busto*, *Quadril*, *Comprimento da manga*, *Costura interna do pantalão (Inseam)* e *Costura externa (Outseam)*.
- **Tradução Automática de Tamanhos**: Assim que as medições estruturais são previstas, algoritmos de dimensionamento determinísticos preenchem instantaneamente **todos os tamanhos de varejo padrão** até o tamanho do sapato:
  - *Tamanho de camisa casual* (XS–XXL baseado na circunferência do peito).
  - *Tamanho da cintura da calça* (polegadas, convertidas a partir de cintura em cm).
  - *Tamanho do sapato nos EUA* (fórmulas masculinas/femininas a partir do comprimento do pé).
  - *Tamanho de vestido feminino* (US 0-14+ baseado na cintura).
  - *Tamanho de sutiã feminino* (faixa + taça calculados a partir do peito/tórax).
- **Modo de Edição Detalhado**: Após o preenchimento automático, ajuste todos os 15 parâmetros de tamanho (incluindo tamanho da camisa, tamanho da calça, tamanho do sapato, tamanho do sutiã, tamanho do vestido) e atributos do cabelo (*Comprimento, Tipo, Cor, Estilo*).
- **Alternar Unidades ao Vivo**: Alterne entre *kg/cm* e *lb/in* — todos os valores são convertidos instantaneamente sem nova previsão.

#### Painel H: Registro no Diretório de Profissionais & Especialistas
- **Alternador de Estilista Profissional**: Registre-se como um profissional de moda verificado (estilista, alfaiate, designer).
- **Detalhes do Negócio**: Insira o Nome da Empresa, Endereço, Telefone, E-mail, Website e Descrição para aparecer no diretório `/experts` e no indicador de campanhas regionais.

#### Painel I: Configurações de Pagamento PayPal
- **E-mail do Recebedor do PayPal**: Insira seu e-mail do PayPal para receber pagamentos por vendas no mercado e campanhas de especialistas ativas.

---

### 4. Cartão Sanfonado de Preferências do Sistema

Gerencia configurações no nível do sistema, assinaturas e integrações de IA:

- **Configuração de IA**:
  - *Modo Padrão*: Usa endpoints do Gemini Flash 2.x gerenciados pelo sistema.
  - *Modo de Chaves de API Personalizadas*: Conecte chaves de API personalizadas do Google Gemini, Anthropic, OpenAI ou DeepSeek através de um modal de configuração guiado.
- **Assinatura & Limites do Guarda-Roupa**:
  - Visualize o nível de conta atual (**Free**: limite de 50 itens versus **Manager** ou **Professional**: itens ilimitados).
  - Acesse a **página de preços** (`/pricing` ou clique no cartão do seu plano) para ver a tabela de comparação de níveis, selecionar um plano e se inscrever.
  - Atualize através da API REST de PayPal Subscriptions (Manager: $4.99/mês; Professional: $9.99/mês) ou gateway Atzmai para transações locais em ILS.
  - Copiar **link de indicação**: Concede +10 vagas de capacidade de guarda-roupa para cada amigo que se registrar (até 200 itens no máximo).
- **Planejador & Recordações Push (Push-Erinnerungen)**:
  - Ative/desative notificações diárias de propostas de roupas pela manhã.
  - Defina a frequência (*Todos os dias*, *Dia sim, dia não*, *Duas vezes por semana*, *Nos dias úteis*), horário (por exemplo, *07:00*) e demandas de estilo de código de vestimenta (*Casual*, *Formal*, *Athletic*, *Custom*).
  - Ative alertas push VAPID do navegador.
- **Preferências de Notificações de Campanhas**:
  - Alternâncias granulares para *Local Fashion Push/Email*, *Sale Alerts*, *Sustainable Fashion*, *Luxury Promos* e *Personal Stylist*.
  - Ajuste o controle deslizante de **distância máxima de campanha** (5 km a 50 km).
- **Conexão ao Google Calendar**: Botão OAuth para sincronizar eventos do calendário pessoal com o AI Stylist.
- **Serviços de Localização**: Ative permissões de localização GPS para feeds de especialistas locais e clima correspondentes por distância.
- **Botão Convidar Amigos**: Copie o link de indicação compartilhável.
- **Assistente de Compras**: Acesse detalhes da extensão da Chrome Web Store ou gere um **Universal Bookmarklet** (`javascript:...`) para comparações instantâneas de tamanho no comércio eletrônico.

---

### 5. Ações da Conta & Diagnósticos
- **Sair**: Sair da sua sessão atual.
- **Excluir minha conta**: Link para purgar permanentemente os dados da conta.
- **Painel do Desenvolvedor**: Sanfona de diagnóstico para testes de ambiente.

---

## Resultados Esperados
- Sincronização instantânea de métricas físicas, tom de pele e recortes de foto no canvas de prova do Avatar 2D.
- Zero requisições de rede ociosas ao navegar entre painéis de configurações.
- Propostas de look do Estilista IA personalizadas alinhadas com suas regras de modéstia e agenda.
- Sincronização instantânea de métricas físicas, tom de pele e recortes de fotos na Tela de Prova do Avatar 2D.
- Zero solicitações de rede ociosas ao navegar entre os painéis de configurações.
- Propostas de roupas do AI Stylist personalizadas e alinhadas com suas regras de recato e cronograma.

---

## Solução de Problemas
- **Fundo da foto não removido**: Certifique-se de que sua foto carregada seja de corpo inteiro com iluminação de fundo contrastante.
- **Alertas push não chegam**: Confirme que as permissões de notificação do navegador estão ativadas e um número de telefone salvo em *Contato*.
- **Autocompletar de endereço não responde**: Verifique se a conexão com a internet está ativa para consultas OpenStreetMap Nominatim.
- **Fundo da foto não removido**: Certifique-se de que a foto carregada seja de corpo inteiro com iluminação de fundo contrastante.
- **Alertas push não chegando**: Confirme se as permissões de notificação do navegador estão ativadas e se um número de telefone está salvo em *Contato*.
- **Preenchimento automático de endereço sem resposta**: Verifique se a conexão com a Internet está ativa para consultas do OpenStreetMap Nominatim.

---

## Limitações
- Espaço da conta nível grátis limitado a 150 itens, a menos que expandido via bônus de indicação (+10 slots por convite) ou assinatura Pro.
- Modo chave API personalizada requer chaves válidas com cota restante do respectivo provedor.

(Fim do arquivo)
- O espaço da conta do nível gratuito é limitado a 50 itens, a menos que seja expandido via bônus de indicação (+10 vagas por convite até o limite máximo de 200 itens) ou atualizando para o nível Manager ou Professional.
- O modo de chave de API personalizada requer chaves válidas com cota restante do respectivo provedor.
