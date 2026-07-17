# Programação matinal e alertas push

Automatize suas escolhas de estilo matinal com alertas de roupas cron.

## Visão geral
O Wardrobe Scheduler oferece notificações push matinais personalizadas contendo três layouts de roupas estilizados. Ele coordena atualizações meteorológicas e eventos do calendário para manter sua aparência renovada e evitar padrões de desgaste repetidos.

## Pré-requisitos
- Permissões de notificação push permitidas no navegador do seu dispositivo.
- Itens guardados em seu armário (pelo menos uma parte superior, inferior e calçado).
- Chaves API Gemini personalizadas (recomendado).

## Passo a passo
1. **Ativar alertas**: Vá para Detalhes do perfil -> Agendador e Push. Ative **Ativar notificações**.
2. **Definir horário**: Escolha a que horas deseja receber seu alerta diário (por exemplo, 07h30).
3. **Sincronização de calendário**: vincule o Google Agenda para que o sistema conheça suas atividades diárias.
4. **Receber sugestão**: Toque na notificação para abrir a lista de roupas.
5. **Confirmar uso**: selecione um layout para salvá-lo em seu diário.

## Resultados esperados
Uma notificação push chegando no horário programado mostrando opções de estilo otimizadas.

## Solução de problemas
- **Nenhuma notificação chegando**: Verifique se seu navegador/sistema operacional desativou as permissões de notificação para DressApp.
- **Repetir roupas sugeridas**: Preencha seu diário de uso dentro do calendário; o algoritmo de rotação requer registros de histórico para filtrar repetições.

## Limitações
- As notificações requerem uma conexão estável à Internet em segundo plano no servidor.