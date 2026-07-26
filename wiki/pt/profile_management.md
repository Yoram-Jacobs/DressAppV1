# Perfil, Tamanhos e Configuração (`/me`)

Gerencie medidas corporais, tom de pele, recortes de fotos de corpo inteiro, preferências de estilo, credenciais de modelos de IA e integrações de sistema no seu painel de perfil pessoal.

## Visão Geral
A página **Perfil e Configurações** (`https://dressapp.co/me`) serve como centro de controle central para o seu ecossistema DressApp. Ela abriga seus parâmetros antropométricos físicos, palco de avatar de prova digital, restrições de estilo, preferências localizadas, chaves de modelos de IA e agendas de notificações push.

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
  - *Foto do Rosto*: Upload de miniatura do avatar.
  - *Foto de Corpo Inteiro*: Upload de fotografia de corpo inteiro. O sistema executa automaticamente matting U2-Net local (`rembg`) para remover o fundo.
  - *Botão Remover Foto*: Remoção com um clique do seu recorte de foto, alternando instantaneamente o palco de prova de volta ao manequim vetorial SVG 2D com latência zero na UI.
- **Coluna Direita — Avatar Digital e Palco de Prova**:
  - **Seletor de Tom de Pele**: Paleta de cores interativa para selecionar o tom de pele do manequim.
  - **Canvas de Prova do Avatar**: Renderiza roupas sobre seu recorte de foto ou manequim vetorial Bézier dinâmico (`DynamicAvatar.jsx`) usando offsets de marcos calibrados (`top-[14.5%]` gola-para-decollete e `top-[36.5%]` cintura-para-cintura).

#### Painel F: Perfil de Estilo
- **Estéticas**: Palavras-chave de estilo separadas por vírgula (ex. *Minimalista, Streetwear, Vintage*).
- **Paleta de Cores**: Tons de cor preferidos (ex. *Pastéis, Tons Terra, Monocromático*).
- **Evitar**: Cores ou tipos de peça para excluir estritamente de recomendações de IA (ex. *Amarelo, Cropped Tops*).
- **Conservadorismo de Vestuário Cultural**: Selecione nível de modéstia (*Casual/Relaxado*, *Moderado*, *Conservador*) para orientar cobertura de looks do Estilista IA.

#### Painel G: Medidas Corporais e Tamanhos (Preditor de Tamanhos ANSUR II)
- **Modo Onboarding / Início Novo**: Insira 4 entradas básicas: **Altura**, **Peso**, **Circunferência da Cintura** e **Comprimento do Pé**. O modelo de regressão multi-saída ANSUR II scikit-learn integrado prevê automaticamente 6 medidas estruturais:
  - *Ombros*, *Peito/Busto*, *Quadril*, *Comprimento da Manga*, *Entreperna* e *Comprimento Externo*.
- **Tradução Automática de Tamanhos**: Uma vez previstas as medidas estruturais, algoritmos determinísticos de tamanho preenchem **todos os tamanhos de varejo padrão** instantaneamente até o tamanho do sapato:
  - *Tamanho Camisa Casual* (XS–XXL baseado na circunferência do peito)
  - *Tamanho Cintura Calça* (polegadas, convertido de cintura cm)
  - *Tamanho Sapato US* (Fórmulas Masculino/Feminino do comprimento do pé)
  - *Tamanho Vestido Feminino* (US 0–14+ baseado na cintura)
  - *Tamanho Sutiã Feminino* (faixa + taça calculada de busto/sub-busto)
- **Modo Edição Detalhada**: Após o preenchimento automático, ajuste fino de todos os 15 parâmetros de tamanho (incluindo Tamanho Camisa, Tamanho Calça, Tamanho Sapato, Tamanho Sutiã, Tamanho Vestido) e atributos de cabelo (*Comprimento, Tipo, Cor, Estilo*).
- **Alternância de Unidade ao Vivo**: Alterne entre *kg/cm* e *lb/in* — todos os valores convertem instantaneamente sem re-previsão.

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
  - Ver nível atual da conta (**Grátis**: limite 150 itens vs **Pro**: Itens ilimitados).
  - Atualizar via PayPal Subscriptions REST API ($4.99/mês ou $29.99/ano).
  - Copiar **Link de Indicação**: Concede +10 slots de capacidade do guarda-roupa para cada amigo que se registrar.
- **Agendador e Lembretes Push**:
  - Alternar notificações de propostas de look matinais.
  - Definir frequência (*Diário*, *Dia Sim Dia Não*, *Duas Vezes por Semana*, *Dias da Semana*), hora (ex. *07:00*) e exigências de código de vestimenta (*Casual*, *Formal*, *Esportivo*, *Personalizado*).
  - Ativar alertas push VAPID do navegador.
- **Preferências de Notificação de Campanhas**:
  - Alternâncias granulares para *Push/E-mail Moda Local*, *Alertas de Promoção*, *Moda Sustentável*, *Promos de Luxo* e *Estilista Pessoal*.
  - Ajustar controle deslizante **Distância Máxima de Campanha** (5km a 50km).
- **Conectar Google Calendar**: Botão OAuth para sincronizar eventos de calendário pessoal com o Estilista IA.
- **Cartão de Serviços de Localização**: Alternar permissões GPS para feeds de especialistas por correspondência de distância e clima hiper-local.
- **Botão Convidar Amigos**: Copiar link de indicação compartilhável.
- **Assistente de Compras**: Acessar detalhes da extensão Chrome Web Store ou gerar **Bookmarklet Universal** (`javascript:...`) para comparações instantâneas de tamanhos em e-commerce.

---

### 5. Ações da Conta e Diagnóstico
- **Sair**: Sair da sua sessão atual.
- **Excluir Minha Conta**: Link para limpar dados da conta permanentemente.
- **Painel do Desenvolvedor**: Acordeão de diagnóstico para testes de ambiente.

---

## Resultados Esperados
- Sincronização instantânea de métricas físicas, tom de pele e recortes de foto no canvas de prova de Avatar 2D.
- Zero requisições de rede ociosas ao navegar entre painéis de configurações.
- Propostas de look do Estilista IA personalizadas alinhadas com suas regras de modéstia e agenda.

---

## Solução de Problemas
- **Fundo da foto não removido**: Certifique-se de que sua foto carregada seja de corpo inteiro com iluminação de fundo contrastante.
- **Alertas push não chegando**: Confirme que permissões de notificação do navegador estão ativadas e um número de telefone salvo sob *Contato*.
- **Autocompletar de endereço não responde**: Verifique se a conexão com a internet está ativa para consultas OpenStreetMap Nominatim.

---

## Limitações
- Espaço de conta do nível grátis limitado a 150 itens, a menos que expandido via bônus de indicação (+10 slots por convite) ou assinatura Pro.
- Modo de chave API personalizada requer chaves válidas com quota restante do provedor respectivo.

(Fim do arquivo)