# Programação Matinal e Alertas Push

Comece o seu dia com recomendações de estilo automáticas e adequadas ao clima, entregues diretamente no seu dispositivo.

## Visão Geral
O Programador Matinal automatiza a seleção do seu visual, fornecendo sugestões de estilo personalizadas todas as manhãs. Ele verifica a previsão do tempo local e as suas atividades diárias (via Google Agenda) para gerar três opções de combinação. Toque na notificação para ver as opções no seu avatar pessoal, salvar a sua escolha favorita e visualizar instantaneamente as pontuações de compatibilidade com o clima.

## Pré-requisitos
- **Notificações permitidas**: As notificações push devem estar ativas para o DressApp nas configurações do seu dispositivo ou navegador.
- **Itens no armário**: Você deve ter pelo menos uma peça superior, uma peça inferior e um calçado enviados para o seu armário.
- **Google Agenda**: Uma conta vinculada do Google Agenda (opcional, mas recomendada para que as sugestões considerem os seus eventos).
- **Chave do Gemini**: Uma chave de API personalizada do Gemini configurada em suas definições.

## Instruções Passo a Passo
1. **Ativar alertas**: Vá para **Configurações do perfil** -> **Programador e Push**. Mude o botão de notificação para ativado.
2. **Definir horário**: Defina a hora e o minuto exatos em que deseja receber a sua sugestão (por exemplo, 07:30).
3. **Vincular agenda**: Em Configurações de agenda, conecte a sua conta do Google Agenda para que a IA conheça a sua programação.
4. **Abrir sugestão**: Quando o alerta push matinal chegar, clique nele. Você será direcionado diretamente para a guia **Sugestão Diária** (Match) em **Estilista** (Stylist).
5. **Visualizar opções**: O seletor **Agendar visual** será aberto automaticamente, mostrando as suas três combinações de estilo aplicadas diretamente no seu avatar.
6. **Salvar e revisar**: Toque em qualquer uma das sugestões diárias para agendá-la no seu calendário. O aplicativo salvará o visual e abrirá imediatamente um painel de detalhes mostrando as métricas de compatibilidade com o clima (harmonia de cores, ajuste de temperatura e consistência de estilo).

## Resultados Esperados
Uma notificação é entregue diariamente no horário escolhido. Clicar nela abre o aplicativo, exibe três opções no seu avatar e permite que você salve uma no seu calendário com todos os detalhes de compatibilidade.

## Resolução de Problemas
- **Nenhuma notificação chega**: 
  - Certifique-se de que as notificações estão permitidas para o site do DressApp nas configurações do site do seu navegador ou nas configurações do seu sistema operacional.
  - Verifique se o seu dispositivo não está no modo "Não perturbe" ou "Foco" durante o horário agendado da notificação.
- **Falta de itens de vestuário no avatar**: 
  - Certifique-se de ter roupas em todas as categorias básicas (peças superiores, peças inferiores, sapatos) no seu guarda-roupa para que o programador consiga vestir o avatar corretamente.
- **Recomendações genéricas**: 
  - Vincule o seu Google Agenda para que as sugestões correspondam aos seus eventos diários específicos.

## Limitações
- Você pode agendar até um visual por dia em seu calendário.
- As atualizações meteorológicas exigem uma conexão ativa de internet no servidor.
