# Perfil, Dimensionamento & Configuração (`/me`)

Gerencie suas medições físicas, tom de pele, recortes de fotos corporais, preferências de estilo, credenciais de modelos de IA e integrações de sistemas no seu painel de perfil pessoal.

## Visão Geral
A página **Perfil & Configurações** (`https://dressapp.co/me`) serve como o centro de controle principal para o seu ecossistema DressApp. Ela abriga seus parâmetros físicos antropométricos, palco do avatar virtual para prova digital, restrições de estilo, preferências localizadas, chaves de modelos de IA e cronogramas de notificações push.

---

## Pré-requisitos
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
- Sincronização instantânea de métricas físicas, tom de pele e recortes de fotos na Tela de Prova do Avatar 2D.
- Zero solicitações de rede ociosas ao navegar entre os painéis de configurações.
- Propostas de roupas do AI Stylist personalizadas e alinhadas com suas regras de recato e cronograma.

---

## Solução de Problemas
- **Fundo da foto não removido**: Certifique-se de que a foto carregada seja de corpo inteiro com iluminação de fundo contrastante.
- **Alertas push não chegando**: Confirme se as permissões de notificação do navegador estão ativadas e se um número de telefone está salvo em *Contato*.
- **Preenchimento automático de endereço sem resposta**: Verifique se a conexão com a Internet está ativa para consultas do OpenStreetMap Nominatim.

---

## Limitações
- O espaço da conta do nível gratuito é limitado a 50 itens, a menos que seja expandido via bônus de indicação (+10 vagas por convite até o limite máximo de 200 itens) ou atualizando para o nível Manager ou Professional.
- O modo de chave de API personalizada requer chaves válidas com cota restante do respectivo provedor.
