Aqui está a tradução da documentação para o português, seguindo todas as suas regras:

# Perfil, Medidas e Configuração (`/me`)

Gerencie medidas físicas, tom de pele, recortes de fotos corporais, preferências de estilo, credenciais de modelo de IA e integrações de sistema no seu painel de perfil pessoal.

## Visão Geral
A página de **Perfil e Configurações** (`https://dressapp.co/me`) serve como o centro de controle central para o seu ecossistema DressApp. Ela contém seus parâmetros antropométricos físicos, o palco do avatar de prova digital, restrições de estilo, preferências localizadas, chaves de modelo de IA e programações de notificações push.

---

## Pré-requisitos
- Uma conta DressApp ativa.
- (Opcional) Permissões de câmera do dispositivo para upload de foto de corpo inteiro.
- (Opcional) Permissões de localização para direcionamento de campanhas de estilistas locais e previsão do tempo.

---

## Guia Passo a Passo: Visão Geral da Página de Cima para Baixo

### 1. Cabeçalho da Página e Barra de Navegação Explorar
Localizado na parte superior do painel `/me`:
- **Cabeçalho**: Exibe o status e o título da sua conta.
- **Cards de Exploração**: Atalhos rápidos para as principais seções do aplicativo:
  - **Trend Scout** (`/trends`): Visualize feeds diários de notícias de moda curadas por IA.
  - **Looks** (`/outfits`): Acesse seu calendário de looks salvos.
  - **Especialistas** (`/experts`): Navegue por estilistas e alfaiates de moda locais.
  - **Desempacotado / Estatísticas** (`/me/stats`): Visualize a avaliação do guarda-roupa, métricas de custo por uso e detalhamentos de cores.

### 2. Card de Seleção de Idioma e Voz
Exibido de forma proeminente para acessibilidade imediata:
- **Seletor de Idioma**: Escolha entre 12 idiomas suportados (*English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Arabic, Hindi, Hebrew*). A seleção de um idioma atualiza automaticamente a localidade da interface do usuário e vincula o modelo de voz padrão regional de Text-to-Speech (TTS).

---

### 3. Card de Identidade e Detalhes Pessoais (`ProfileDetailsCard`)

Contém 9 painéis de acordeão expansíveis que gerenciam sua identidade pessoal, medidas e renderização de avatar:

#### Painel A: Identidade
- **Nome e Sobrenome**: Campos de identificação pessoal.
- **Endereço de E-mail**: Exibição somente leitura do seu e-mail registrado.
- **Data de Nascimento**: Usada para personalizar a pontuação de tendências demográficas.
- *Distintivo de Preenchimento Automático do Google*: Exibido automaticamente se seu perfil foi preenchido via Google OAuth.

#### Painel B: Contato e Endereço de Entrega
- **Número de Telefone**: Necessário para receber alertas por SMS/Push para propostas diárias do agendador e campanhas de especialistas locais.
- **Linha de Endereço 1**: Apresenta preenchimento automático de nível de rua do OpenStreetMap (Nominatim). A seleção de uma sugestão preenche automaticamente a Linha 1, Cidade, Região, Código Postal e País.
- **Linha de Endereço 2, Cidade, Região, Código Postal**: Campos de endereço manuais para envio do marketplace.
- **País**: Caixa de combinação offline pesquisável por nome do país ou código ISO-2.

#### Painel C: Demografia
- **Sexo**: Selecione *Feminino* ou *Masculino* para configurar as medidas corporais base e a taxonomia de vestuário.
- **Estado Civil**: Selecione *Solteiro(a)*, *Casado(a)*, *Divorciado(a)* ou *Viúvo(a)*.
- **Ocupação**: Entrada de texto livre (ex: *Estudante*, *Gerente de Marketing*, *Barista*). Alimenta o ranqueador de personalização do Trend Scout para priorizar notícias de estilo relevantes.

#### Guia Resumido: Sincronização de Dados de Perfil do Google Ausentes (Re-consentimento da People API)
Se você fez login com o Google antes de o DressApp solicitar acesso aos detalhes do seu perfil da **People API** (telefone, endereço, sexo, data de nascimento), esses campos podem permanecer vazios. Você pode sincronizá-los com um clique:

1.  **Abra o acordeão Contato ou Demografia** — você verá um botão **"Sincronizar do Google"** (ícone de atualização) ao lado do título da seção.
2.  **Clique em "Sincronizar do Google"** — se os escopos da People API necessários não foram concedidos durante seu login original, o DressApp detecta isso e exibe uma notificação: *"O Google precisa da sua permissão para acessar os detalhes do perfil. Você será redirecionado ao Google para conceder acesso."*
3.  **Conceda consentimento na tela do Google** — você será redirecionado para a tela de consentimento OAuth do Google. Marque as caixas para **Informações do perfil** (nome, e-mail, foto) e **Informações de contato** (telefone, endereço, sexo, aniversário).
4.  **Retorno automático e preenchimento automático** — após o consentimento, o Google redireciona você de volta ao DressApp. A função `syncGoogleProfile()` é executada automaticamente, chamando o endpoint de backend `/auth/google/sync-profile` que:
    - Busca seu telefone, endereço, sexo e data de nascimento na Google People API
    - Preenche os campos vazios nos painéis **Contato** (telefone, endereço) e **Demografia** (sexo, data de nascimento)
    - Salva as atualizações em seu perfil instantaneamente
5.  **Concluído** — seu perfil está agora completo sem digitação manual.

> **Nota**: O botão "Sincronizar do Google" também aparece no cabeçalho da página (ao lado do botão principal "Sincronizar Perfil do Google") e funciona da mesma forma — ele sincroniza todos os dados de perfil do Google disponíveis de uma vez.

#### Painel D: Preferências e Unidades de Medida
- **Unidade de Peso**: Alterne entre Quilogramas (`kg`) e Libras (`lb`).
- **Unidade de Comprimento**: Alterne entre Centímetros (`cm`) e Polegadas (`in`).

#### Painel E: Fotos e Palco do Avatar Digital
- **Coluna Esquerda — Seletores de Foto**:
  - *Foto de Rosto*: Carregue uma miniatura de avatar.
  - *Foto de Corpo Inteiro*: Carregue uma fotografia de corpo inteiro. O sistema executa automaticamente a matting local U2-Net (`rembg`) para remover o fundo.
  - *Botão Remover Foto*: Remoção com um clique do seu recorte de foto, alternando instantaneamente o palco de prova de volta para o manequim vetorial SVG 2D com zero atraso na UI.
- **Coluna Direita — Avatar Digital e Palco de Prova**:
  - **Seletor de Tom de Pele**: Paleta de cores interativa para selecionar o tom de pele do seu manequim.
  - **Canvas de Prova de Avatar**: Renderiza peças de vestuário sobre o seu recorte de foto ou manequim vetorial Bezier dinâmico (`DynamicAvatar.jsx`) usando deslocamentos de marcos calibrados (`top-[14.5%]` de gola ao decote e `top-[36.5%]` de cós à cintura).

#### Painel F: Perfil de Estilo
- **Estética**: Palavras-chave de estilo separadas por vírgulas (ex: *Minimalista, Streetwear, Vintage*).
- **Paleta de Cores**: Tons de cor preferidos (ex: *Pastéis, Tons Terrosos, Monocromático*).
- **Evitar**: Cores ou tipos de peças de vestuário a serem estritamente excluídos das recomendações de IA (ex: *Amarelo, Croppeds*).
- **Nível de Conservadorismo de Vestuário Cultural**: Selecione o nível de modéstia (*Casual/Relaxado*, *Moderado*, *Conservador*) para guiar a cobertura dos looks do AI Stylist.

#### Painel G: Medidas Corporais e Tamanhos (ANSUR II Sizing Predictor)
- **Modo de Integração / Começo do Zero**: Insira 4 dados básicos: **Altura**, **Peso**, **Circunferência da Cintura** e **Comprimento do Pé**. O modelo de regressão multi-output scikit-learn ANSUR II integrado prevê automaticamente 6 medidas estruturais:
  - *Ombros*, *Peito / Busto*, *Quadril*, *Comprimento da Manga*, *Perna Interna* e *Perna Externa*.
- **Tradução Automática de Tamanhos**: Uma vez que as medidas estruturais são previstas, algoritmos de dimensionamento determinísticos preenchem instantaneamente **todos os tamanhos de varejo padrão** até o tamanho do sapato:
  - *Tamanho da Camisa Casual* (XS–XXL com base na circunferência do peito)
  - *Tamanho da Cintura da Calça* (polegadas, convertido de cm de cintura)
  - *Tamanho de Sapato Americano* (fórmulas Masculino/Feminino a partir do comprimento do pé)
  - *Tamanho de Vestido Feminino* (EUA 0–14+ com base na cintura)
  - *Tamanho de Sutiã Feminino* (tamanho da faixa + bojo calculado a partir do busto/sub-busto)
- **Modo de Edição Detalhada**: Após o preenchimento automático, ajuste todos os 15 parâmetros de tamanho (incluindo Tamanho da Camisa, Tamanho da Calça, Tamanho do Sapato, Tamanho do Sutiã, Tamanho do Vestido) e atributos de Cabelo (*Comprimento, Tipo, Cor, Estilo*).
- **Alternância de Unidade ao Vivo**: Alterne entre *kg/cm* e *lb/in* — todos os valores convertem instantaneamente sem repredição.

#### Painel H: Registro no Diretório de Profissionais e Especialistas
- **Alternador de Estilista Profissional**: Registre-se como um profissional de moda verificado (estilista, alfaiate, designer).
- **Detalhes da Empresa**: Insira Nome da Empresa, Endereço, Telefone, E-mail, Site e Descrição para aparecer no diretório `/experts` e no carrossel de campanhas regionais.

#### Painel I: Configurações de Pagamento PayPal
- **E-mail do Recebedor PayPal**: Insira seu e-mail PayPal para receber pagamentos por vendas no marketplace e campanhas ativas de especialistas.

---

### 4. Card de Acordeão de Preferências do Sistema

Gerencia configurações de nível de sistema, assinaturas e integrações de IA:

- **Configuração de IA**:
  - *Modo Padrão*: Usa endpoints Gemini Flash 2.x gerenciados pelo sistema.
  - *Modo de Chaves de API Personalizadas*: Conecte chaves de API personalizadas do Google Gemini, Anthropic, OpenAI ou DeepSeek através de um modal de configuração guiado.
- **Assinatura e Limites do Guarda-Roupa**:
  - Visualize o nível atual da conta (**Grátis**: limite de 50 itens vs **Gerente** ou **Profissional**: itens ilimitados).
  - Atualize via PayPal Subscriptions REST API (Gerente: $5/mês ou $50/ano; Profissional: $10/mês ou $100/ano).
- **Agendador e Lembretes Push**:
  - Ative/desative as notificações de propostas de looks matinais.
  - Defina frequência (*Todos os Dias*, *Dia Sim, Dia Não*, *Duas Vezes por Semana*, *Durante a Semana*), hora (ex: *07:00*) e requisitos de estilo de dress-code (*Casual*, *Formal*, *Atlético*, *Personalizado*).
  - Ative os alertas push VAPID do navegador.
- **Preferências de Notificação de Campanha**:
  - Alternadores granulares para *Push/E-mail de Moda Local*, *Alertas de Venda*, *Moda Sustentável*, *Promoções de Luxo* e *Estilista Pessoal*.
  - Ajuste o controle deslizante de **Distância Máxima da Campanha** (5km a 50km).
- **Conexão com o Google Agenda**: Botão OAuth para sincronizar eventos do calendário pessoal com o AI Stylist.
- **Card de Serviços de Localização**: Ative/desative as permissões de localização GPS para feeds de especialistas correspondentes à distância e previsão do tempo hiperlocal.
- **Botão Convidar Amigos**: Copie o link de indicação compartilhável.
- **Assistente de Compras**: Acesse detalhes da extensão da Chrome Web Store ou gere um **Bookmarklet Universal** (`javascript:...`) para comparações instantâneas de tamanho em e-commerce.

---

### 5. Ações da Conta e Diagnósticos
- **Sair**: Faça logout da sua sessão atual.
- **Excluir minha Conta**: Link para apagar permanentemente os dados da conta.
- **Painel do Desenvolvedor**: Acordeão de diagnóstico para testes de ambiente.

---

## Resultados Esperados
- Sincronização instantânea de métricas físicas, tom de pele e recortes de fotos no Canvas de Prova de Avatar 2D.
- Zero requisições de rede ociosas ao navegar entre os painéis de configurações.
- Propostas de looks personalizados do AI Stylist alinhadas com suas regras de modéstia e agendamento.

---

## Solução de Problemas
- **Fundo da foto não removido**: Certifique-se de que sua foto carregada seja de corpo inteiro com iluminação de fundo contrastante.
- **Alertas push não chegam**: Confirme se as permissões de notificação do navegador estão ativadas e se um número de telefone está salvo em *Contato*.
- **Preenchimento automático de endereço sem resposta**: Verifique se a conexão com a internet está ativa para consultas do OpenStreetMap Nominatim.

---

## Limitações
- O espaço da conta do nível gratuito é limitado a 150 itens, a menos que seja expandido via bônus de indicação (+10 espaços por convite) ou assinatura Pro.
- O modo de chave de API personalizada requer chaves válidas com cota restante do provedor respectivo.
