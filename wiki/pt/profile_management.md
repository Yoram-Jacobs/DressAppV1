# Perfil, Medidas & Configuração (`/me`)

Gerencie suas medições físicas, tom de pele, recortes de foto corporal, preferências de estilo, credenciais de modelos de IA e integrações de sistema no seu painel de perfil pessoal.

## Visão Geral
A página de **Perfil & Configurações** (`https://dressapp.co/me`) serve como o hub de controle central para o seu ecossistema DressApp. Ela armazena seus parâmetros antropométricos físicos, o palco de provador virtual do seu avatar, restrições de estilo, preferências regionalizadas, chaves de modelos de IA e agendamentos de notificações push.

---

## Pré-requisitos
- Uma conta DressApp ativa.
- (Opcional) Permissões de câmera no dispositivo para envio de foto de corpo inteiro.
- (Opcional) Permissões de localização para campanhas de estilistas locais e previsão do tempo.

---

## Guia Passo a Passo: Visão Geral da Página de Cima a Baixo

### 1. Cabeçalho da Página e Barra de Navegação Explorar
Localizado no topo do painel `/me`:
- **Cabeçalho (Header)**: Exibe o status da sua conta e o título.
- **Cartões de Exploração (Explore Cards)**: Atalhos rápidos para as seções principais do aplicativo:
  - **Trend Scout** (`/trends`): Veja o feed diário de notícias de moda curado por IA.
  - **Lookbooks / Roupas (Outfits)** (`/outfits`): Acesse seu calendário de roupas salvas.
  - **Especialistas (Experts)** (`/experts`): Navegue por estilistas e alfaiates locais.
  - **Estatísticas (Stats)** (`/me/stats`): Veja a avaliação do guarda-roupa, métricas de custo por uso e detalhamento de cores.

### 2. Cartão de Seleção de Idioma e Voz
Exibido em destaque para acessibilidade imediata:
- **Seletor de Idioma**: Escolha entre 12 idiomas suportados (*Inglês, Espanhol, Francês, Alemão, Italiano, Português, Russo, Chinês, Japonês, Árabe, Hindi, Hebraico*). A seleção de um idioma atualiza automaticamente a interface do usuário e vincula o modelo de voz regional padrão de Conversão de Texto em Fala (TTS).

---

### 3. Cartão de Identidade & Detalhes Pessoais (`ProfileDetailsCard`)

Contém 9 painéis sanfonados expansíveis para gerenciar sua identidade pessoal, medidas e renderização do avatar:

#### Painel A: Identidade
- **Nome & Sobrenome**: Campos de identificação pessoal.
- **Endereço de E-mail**: Exibição somente leitura do seu e-mail registrado.
- **Data de Nascimento**: Usada para personalizar a pontuação de tendências demográficas.
- *Selo de Preenchimento Automático do Google*: Aparece automaticamente se seu perfil foi criado via Google OAuth.

#### Painel B: Contato & Endereço de Entrega
- **Número de Telefone**: Necessário para receber alertas por SMS/Push sobre propostas diárias e campanhas de especialistas locais.
- **Endereço Linha 1**: Possui recurso de autocompletar em nível de rua via OpenStreetMap (Nominatim).
- **Endereço Linha 2, Cidade, Região, Código Postal**: Campos manuais para envios do marketplace.
- **País**: Caixa de seleção offline pesquisável por nome do país ou código ISO-2.

#### Painel C: Demografia
- **Sexo**: Selecione *Feminino* ou *Masculino* para configurar medições corporais básicas e taxonomia de roupas.
- **Estado Civil**: Selecione *Solteiro/a*, *Casado/a*, *Divorciado/a* ou *Viúvo/a*.
- **Ocupação**: Entrada de texto livre (ex.: *Estudante*, *Gerente de Marketing*, *Barista*). Alimenta a personalização do Trend Scout.

#### Painel D: Preferências & Unidades de Medida
- **Unidade de Peso**: Alterne entre Quilogramas (`kg`) e Libras (`lb`).
- **Unidade de Comprimento**: Alterne entre Centímetros (`cm`) e Polegadas (`in`).

#### Painel E: Fotos & Palco do Avatar Digital
- **Coluna Esquerda — Seletores de Foto**:
  - *Foto do Rosto*: Envie uma miniatura de avatar.
  - *Foto de Corpo Inteiro*: Envie uma fotografia de corpo inteiro. O sistema executa automaticamente o recorte local U2-Net (`rembg`) para remover o fundo.
  - *Botão Remover Foto*: Remoção do recorte da sua foto com um único clique, alternando instantaneamente o palco de provador de volta para o manequim vetorial 2D SVG sem atrasos na interface.
- **Coluna Direita — Avatar Digital & Palco de Provador**:
  - **Seletor de Tom de Pele**: Paleta de cores interativa para selecionar o tom de pele do manequim.
  - **Tela de Provador do Avatar**: Renderiza roupas sobre o recorte da sua foto ou sobre o manequim vetorial Bezier (`DynamicAvatar.jsx`) usando deslocamentos calibrados (`top-[14.5%]` da gola ao decote e `top-[36.5%]` do cós à cintura).

#### Painel F: Perfil de Estilo
- **Estética**: Palavras-chave de estilo separadas por vírgula (ex.: *Minimalista, Streetwear, Vintage*).
- **Paleta de Cores**: Tons preferidos (ex.: *Pastel, Tons de Terra, Monocromático*).
- **Evitar**: Cores ou tipos de roupas para excluir estritamente das recomendações de IA.
- **Modéstia Cultural de Vestuário**: Selecione o nível de cobertura (*Casual/Relaxado*, *Moderado*, *Conservador*) para guiar as roupas do AI Stylist.

#### Painel G: Medidas Corporais & Tamanhos (Predictor ANSUR II)
- **Modo Inicial / Novo Começo**: Insira 4 dados básicos: **Altura**, **Peso**, **Circunferência da Cintura** e **Comprimento do Pé**. O modelo de regressão ANSUR II integrado via scikit-learn prevê automaticamente 6 medições estruturais:
  - *Ombros*, *Peito / Busto*, *Quadril*, *Comprimento da Manga*, *Entrepernas* e *Comprimento Externo*.
- **Modo de Edição Detalhada**: Ajuste fino de todos os 15 parâmetros de tamanho e atributos de cabelo.

#### Painel H: Registro no Diretório de Profissionais e Especialistas
- **Botão de Estilista Profissional**: Registre-se como um profissional de moda verificado.
- **Detalhes do Negócio**: Insira Nome da empresa, Endereço, Telefone, E-mail, Website e Descrição para aparecer no diretório `/experts`.

#### Painel I: Configurações de Pagamento do PayPal
- **E-mail do Recebedor PayPal**: Insira seu e-mail do PayPal para receber pagamentos de vendas no marketplace e campanhas.

---

## 4. Cartão Sanfonado de Preferências do Sistema

Gerencia configurações em nível de sistema, assinaturas e integrações de IA:

- **Configuração de IA (AI Configuration)**:
  - *Modo Padrão*: Usa endpoints Gemini Flash 2.x gerenciados pelo sistema.
  - *Modo de Chaves API Personalizadas*: Conecte chaves API próprias do Google Gemini, Anthropic, OpenAI ou DeepSeek.
- **Assinatura & Limites do Guarda-roupa**:
  - Veja o nível de conta atual (**Gratuito**: limite de 150 itens vs **Pro**: itens ilimitados).
  - Atualize através da REST API PayPal Subscriptions ($4.99/mês ou $29.99/ano).
  - Copiar **Link de Indicação**: Concede +10 vagas de capacidade de guarda-roupa para cada amigo registrado.
- **Agendador & Lembretes Push**:
  - Ative notificações de propostas de roupas pela manhã.
  - Defina frequência, horário e requisitos de código de vestimenta.
  - Ative alertas push VAPID do navegador.
- **Preferências de Notificação de Campanhas**:
  - Opções para *Moda Local Push/E-mail*, *Alertas de Promoção*, *Moda Sustentável*, *Promoções de Luxo* e *Estilista Pessoal*.
  - Ajuste o controle deslizante de **Distância Máxima da Campanha** (5 km a 50 km).
- **Conectar ao Google Calendar**: Botão OAuth para sincronizar eventos do calendário pessoal com o estilista de IA.
- **Serviços de Localização**: Ative permissões de localização GPS para encontrar especialistas locais e clima.
- **Botão Convidar Amigos**: Copie o link de indicação compartilhável.
- **Assistente de Compras**: Acesse detalhes da extensão da Chrome Web Store ou gere um **Marcador Universal** (`javascript:...`) para comparações instantâneas de tamanhos em e-commerce.

---

## 5. Ações da Conta & Diagnósticos
- **Sair da Conta**: Encerre a sessão atual.
- **Excluir minha Conta**: Link para apagar permanentemente os dados da conta.
- **Painel do Desenvolvedor**: Painel de diagnóstico para testes de ambiente.

---

## Resultados Esperados
- Sincronização instantânea de métricas físicas, tom de pele e recortes de fotos na tela de provador 2D do avatar.
- Nenhuma requisição de rede desnecessária ao navegar entre os painéis de configurações.
- Propostas de roupas de IA personalizadas alinhadas com suas regras e agenda.

---

## Solução de Problemas
- **Fundo da foto não removido**: Certifique-se de que a foto enviada seja de corpo inteiro com iluminação de fundo contrastante.
- **Alertas push não chegam**: Confirme se as permissões de notificação do navegador estão ativadas e se há um número de telefone salvo.
- **Autocompletar endereço não responde**: Verifique se a conexão com a internet está ativa para consultas ao OpenStreetMap Nominatim.

---

## Limitações
- O espaço da conta gratuita é limitado a 150 itens, a menos que expandido por bônus de indicação (+10 vagas por convite) ou assinatura Pro.
- O modo de chave API personalizada requer chaves válidas com cota restante do respectivo provedor.