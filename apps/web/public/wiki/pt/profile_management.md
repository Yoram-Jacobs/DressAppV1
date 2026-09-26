# Perfil, Medidas e Configurações (`/me`)

Gerencie medidas corporais, tom de pele, fotos de corpo inteiro sem fundo, preferências de estilo, credenciais de modelos de IA e integrações de sistema no seu painel de perfil pessoal.

## Visão geral
A página de **Perfil e Configurações** (`https://dressapp.co/me`) funciona como a central de controle do seu ecossistema DressApp. Nela ficam reunidos seus parâmetros antropométricos físicos, o provador virtual com avatar digital, restrições de estilo, preferências regionais, chaves de modelos de IA e agendamentos de notificações push.

---

## Pré-requisitos
- Uma conta ativa no DressApp.
- (Opcional) Permissão de acesso à câmera do dispositivo para envio de fotos de corpo inteiro.
- (Opcional) Permissão de localização para direcionamento de campanhas de estilistas locais, preferências culturais e previsão do tempo.

---

## Passo a Passo: Visão Geral Completa da Página

### 1. Cabeçalho da Página e Barra de Navegação Explorar
Localizados na parte superior do painel `/me`:
- **Cabeçalho**: Exibe o status da sua conta e o título do perfil.
- **Cards Explorar**: Atalhos rápidos para as principais áreas do app:
  - **Trend Scout** (`/trends`): Veja os feeds diários de tendências da moda com curadoria de IA.
  - **Looks** (`/outfits`): Acesse o calendário de combinações salvas.
  - **Especialistas** (`/experts`): Conheça estilistas e alfaiates locais.
  - **Desempacotado / Estatísticas** (`/me/stats`): Veja a avaliação do guarda-roupa, custo por uso e distribuição de cores.

### 2. Card de Seleção de Idioma e Voz
Exibido em destaque para acesso imediato:
- **Seletor de Idioma**: Escolha entre 12 idiomas disponíveis (*inglês, espanhol, francês, alemão, italiano, português, russo, chinês, japonês, árabe, híndi, hebraico*). A escolha do idioma atualiza a interface e define automaticamente o modelo regional de voz Text-to-Speech (TTS).

---

### 3. Card de Identidade e Dados Pessoais (`ProfileDetailsCard`)

Composto por 9 painéis expansíveis em sanfona para administrar identidade, tamanhos e renderização de avatar:

#### Painel A: Identidade
- **Nome e Sobrenome**: Campos de identificação pessoal.
- **Endereço de E-mail**: Exibição somente leitura do seu e-mail cadastrado.
- **Data de Nascimento**: Utilizada para personalizar a classificação demográfica de tendências.
- *Selo de Preenchimento Automático do Google*: Exibido automaticamente se o perfil foi criado pelo Google OAuth.

#### Painel B: Contato e Endereço de Entrega
- **Número de Telefone**: Necessário para receber alertas por SMS/Push sobre sugestões diárias de looks e campanhas de especialistas locais.
- **Endereço Linha 1**: Conta com preenchimento automático de logradouros via OpenStreetMap (Nominatim). Ao selecionar uma sugestão, os campos Linha 1, Cidade, Estado, CEP e País são preenchidos automaticamente.
- **Endereço Linha 2, Cidade, Estado, CEP**: Campos manuais para envios e fretes do marketplace.
- **País**: Menu de seleção offline pesquisável por nome do país ou código ISO-2.

#### Painel C: Dados Demográficos
- **Sexo**: Selecione *Feminino* ou *Masculino* para definir medidas corporais de referência e a categorização das roupas.
- **Estado Civil**: Escolha entre *Solteiro(a)*, *Casado(a)*, *Divorciado(a)* ou *Viúvo(a)*.
- **Profissão**: Campo de texto livre (ex.: *Estudante*, *Gerente de Marketing*, *Barista*). Alimenta o ranking de personalização do Trend Scout para priorizar novidades relevantes.

#### Guia Rápido: Sincronizar Dados Pendentes do Perfil Google (Novo Consentimento da People API)
Se você fez login com o Google antes de o DressApp solicitar acesso às informações de perfil da **People API** (telefone, endereço, gênero, data de nascimento), esses campos podem ficar em branco. Você pode sincronizá-los com apenas um clique:

1. **Abra o painel Contato ou Dados Demográficos** — você verá o botão **"Sincronizar com o Google"** (ícone de atualização) ao lado do título da seção.
2. **Clique em "Sincronizar com o Google"** — caso as permissões da People API não tenham sido concedidas no login original, o DressApp avisa: *"O Google precisa da sua permissão para acessar os detalhes do perfil. Você será redirecionado para autorizar o acesso."*
3. **Conceda as permissões na tela do Google** — na tela de consentimento do Google OAuth, marque as opções de **Informações do perfil** (nome, e-mail, foto) e **Informações de contato** (telefone, endereço, gênero, data de nascimento).
4. **Retorno automático e preenchimento imediato** — após a autorização, você volta automaticamente para o DressApp. A função `syncGoogleProfile()` é executada e chama o endpoint `/auth/google/sync-profile` no backend, que:
   - Coleta telefone, endereço, gênero e data de nascimento na Google People API
   - Preenche os campos em branco em **Contato** (telefone, endereço) e **Dados Demográficos** (sexo, data de nascimento)
   - Salva as alterações no seu perfil instantaneamente
5. **Concluído** — seu perfil fica completo sem precisar digitar nada.

> **Observação**: O botão "Sincronizar com o Google" também fica disponível no topo da página (ao lado do botão principal "Sincronizar Perfil Google") e funciona exatamente da mesma maneira — sincroniza todas as informações do Google de uma só vez.

#### Painel D: Preferências e Unidades de Medida
- **Unidade de Peso**: Alterne entre Quilos (`kg`) e Libras (`lb`).
- **Unidade de Comprimento**: Alterne entre Centímetros (`cm`) e Polegadas (`in`).

#### Painel E: Fotos e Palco do Avatar Digital
- **Coluna da Esquerda — Seletores de Fotos**:
  - *Foto de Rosto*: Envie uma foto para a miniatura do perfil.
  - *Foto de Corpo Inteiro*: Envie uma foto de corpo inteiro. O sistema usa o modelo local U2-Net (`rembg`) para remover o fundo automaticamente.
  - *Botão Remover Foto*: Remove a foto recortada com um clique, voltando o provador virtual para o manequim vetorial SVG 2D sem travamentos na tela.
- **Coluna da Direita — Avatar Digital e Provador Virtual**:
  - **Seletor de Tom de Pele**: Paleta interativa para definir a cor da pele do manequim.
  - **Canvas de Prova do Avatar**: Renderiza as roupas sobre sua foto recortada ou sobre o manequim vetorial dinâmico de Bézier (`DynamicAvatar.jsx`) com alinhamentos anatômicos calibrados (`top-[14.5%]` da gola ao decote e `top-[36.5%]` do cós à cintura).

#### Painel F: Perfil de Estilo
- **Estilos**: Palavras-chave separadas por vírgula (ex.: *Minimalista, Streetwear, Vintage*).
- **Paleta de Cores**: Tons preferidos (ex.: *Tons Pastéis, Tons Terrosos, Monocromático*).
- **Evitar**: Cores ou tipos de peças que não devem ser sugeridos pela IA (ex.: *Amarelo, Top Cropped*).
- **Recato Cultural no Vestuário**: Defina o nível de modéstia (*Casual/Despojado*, *Moderado*, *Conservador*) para guiar a cobertura das peças nas sugestões do AI Stylist.

#### Painel G: Medidas Corporais e Tamanhos (Preditor de Medidas ANSUR II)
- **Modo Inicial / Começar do Zero**: Preencha apenas 4 medidas básicas: **Altura**, **Peso**, **Circunferência da Cintura** e **Comprimento do Pé**. O modelo integrado de regressão scikit-learn ANSUR II prevê automaticamente 6 medidas estruturais:
  - *Ombros*, *Tórax / Busto*, *Quadril*, *Comprimento da Manga*, *Entrepernas* e *Comprimento Lateral*.
- **Conversão Automática de Tamanhos**: A partir dessas medidas estruturais, algoritmos determinísticos calculam instantaneamente **todos os tamanhos comerciais de roupas**, incluindo sapatos:
  - *Tamanho de Camisa Casual* (de XS a XXL pelo tórax)
  - *Cintura da Calça* (em polegadas, convertida a partir da cintura em cm)
  - *Tamanho de Sapato US* (fórmulas masculinas/femininas pelo comprimento do pé)
  - *Tamanho de Vestido Feminino* (US 0–14+ pela cintura)
  - *Tamanho de Sutiã* (tórax + taça a partir do busto e abaixo do busto)
- **Modo de Edição Detalhada**: Depois do preenchimento automático, ajuste livremente os 15 parâmetros de medidas (incluindo tamanho de camisa, calça, sapato, sutiã e vestido) e características do cabelo (*Comprimento, Tipo, Cor, Estilo*).
- **Troca Rápida de Unidades**: Mude entre *kg/cm* e *lb/in* — as medidas são convertidas na hora, sem recalcular as estimativas.

#### Painel H: Cadastro no Diretório Profissional e de Especialistas
- **Botão Estilista Profissional**: Cadastre-se como profissional de moda verificado (estilista, alfaiate, designer).
- **Dados do Negócio**: Informe Nome Comercial, Endereço, Telefone, E-mail, Site e Descrição para aparecer no diretório `/experts` e no painel de campanhas regionais.

#### Painel I: Configurações de Recebimento no PayPal
- **E-mail de Recebimento do PayPal**: Cadastre seu e-mail do PayPal para receber os repasses de vendas no marketplace e campanhas profissionais ativas.

---

### 4. Card em Sanfona de Preferências do Sistema

Gerencia configurações globais, planos de assinatura e integrações de IA:

- **Configuração de IA**:
  - *Modo Padrão (Motor Principal de Produção)*: Movido pelo **Google Gemini 3.5 Flash-Lite** via `llm_gateway.py`. Entrega consultoria de estilo super-rápida, sem instalação prévia e sem precisar de chaves de API pessoais.
  - *Rede de Proteção de Cotas On-Premises*: Caso ocorram limites de requisição na nuvem (`429` / `RESOURCE_EXHAUSTED`), as perguntas são atendidas automaticamente pelo contêiner local e otimizado **Gemma-4-E4B** na porta 7860, sem interrupções.
  - *Modo Chave de API Própria (BYOK)*: Insira sua chave de API do Google Gemini para ter cotas dedicadas de desenvolvedor e usar recursos generativos avançados, como o radar diário do Trend Scout e a reconstrução de fotos do Nano Banana.
- **Assinatura e Limites do Guarda-Roupa**:
  - Acompanhe o plano atual da conta (**Free**: base de 150 peças vs **Manager** (\$4.99/mês) ou **Professional** (\$9.99/mês): peças ilimitadas).
  - Acesse a **página de Preços** (`/pricing` ou clique no card do seu plano) para ver a tabela comparativa, escolher um plano ou comprar pacotes pré-pagos de créditos sem validade.
  - Faça upgrade via PayPal Subscriptions ou pela Atzmai Gateway para pagamentos locais em Israel em ILS (Bit / cartão de crédito).
  - Copiar **Link de Indicação**: Ganhe +10 vagas permanentes no armário para cada amigo cadastrado (até o limite de 150 peças).
- **Programador e Lembretes por Notificação**:
  - Ative ou desative avisos de sugestões matinais de looks.
  - Escolha a frequência (*Todos os dias*, *Dia sim, dia não*, *Duas vezes por semana*, *Dias úteis*), o horário (ex.: *07:00*) e o estilo desejado (*Casual*, *Formal*, *Esportivo*, *Personalizado*).
  - Ative notificações push VAPID no navegador.
- **Preferências de Notificações de Campanhas**:
  - Controles independentes para *Push/E-mail de Moda Local*, *Alertas de Promoções*, *Moda Sustentável*, *Ofertas de Luxo* e *Estilista Pessoal*.
  - Ajuste a barra de **Distância Máxima de Campanhas** (de 5 km a 50 km).
- **Conexão com Google Calendar**: Botão OAuth para sincronizar compromissos do calendário com o AI Stylist.
- **Card de Serviços de Localização**: Ative a localização GPS para receber ofertas de especialistas próximos e previsão do tempo hiperlocal.
- **Botão Convidar Amigos**: Copie o link exclusivo de indicação.
- **Assistente de Compras**: Acesse detalhes da extensão na Chrome Web Store ou gere um **Bookmarklet Universal** (`javascript:...`) para comparar tamanhos instantaneamente em lojas online.

---

### 5. Ações da Conta e Diagnósticos
- **Sair da Conta**: Encerre sua sessão atual.
- **Excluir Minha Conta**: Opção para apagar definitivamente todos os dados da conta.
- **Painel do Desenvolvedor**: Área de testes e diagnósticos do sistema. Autenticada pelo Google OAuth (`dressappdeveloper@gmail.com`).

---

## Resultados esperados
- Sincronização imediata de medidas corporais, tom de pele e recortes de fotos no provador virtual 2D.
- Ausência de requisições de rede ociosas ao alternar entre os painéis de configuração.
- Sugestões de looks do AI Stylist alinhadas às suas regras de modéstia e aos seus compromissos.

---

## Solução de problemas
- **Fundo da foto não foi removido**: Certifique-se de que a foto enviada mostre o corpo inteiro e tenha boa iluminação com contraste em relação ao fundo.
- **Notificações push não estão chegando**: Verifique se as permissões de notificação estão ativadas no navegador e se o telefone foi salvo no painel *Contato*.
- **Preenchimento de endereço não responde**: Confira se a conexão com a Internet está funcionando para consultar o OpenStreetMap Nominatim.

## Limitações
- O limite do plano Free Tier é de 1150 peças por padrão, a menos que seja ampliado por indicações (+10 vagas por convidado até o limite de 150 peças) ou por upgrade para Manager ou Professional.
- Recursos generativos avançados na nuvem (radar Trend Scout e reconstrução de fotos Nano Banana) exigem chave de API pessoal do Google Gemini fornecida pelo usuário.
- O modo com chave de API própria usará automaticamente o motor local Gemma-4-E4B caso os limites do provedor externo sejam atingidos.
