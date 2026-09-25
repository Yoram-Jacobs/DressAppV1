# Estilista conversacional com Inteligência Artificial

Converse com um estilista pessoal inteligente que conhece seu guarda-roupa, a previsão do tempo e sua rotina diária.

## Visão Geral
O Estilista IA é o seu consultor de moda pessoal no DressApp. Você pode conversar com ele digitando ou falando naturalmente como com um amigo. O estilista verifica o clima local, consulta seus eventos do Google Agenda e sugere looks completos e sofisticados usando exclusivamente roupas que você já possui.

O motor de estilo do DressApp é alimentado pelo modelo local refinado **Gemma-4-E4B**, disponível para todos os usuários do plano gratuito sem necessidade de configurar nenhuma chave de API. Para quem prefere usar uma chave própria do Google Gemini, o DressApp oferece o recurso de **Contingência Automática de Cota (Quota Fallback)**: caso sua chave exceda os limites de requisições ou esgote a cota, o sistema redireciona a consulta imediatamente para o modelo local Gemma com um banner informativo, garantindo que sua conversa nunca seja interrompida por erros.

## Pré-requisitos
- Pelo menos uma peça superior, uma inferior e um par de sapatos cadastrados no guarda-roupa.
- Permissão de microfone ativada para pedidos de estilo por voz com mãos livres.
- *(Opcional)* Google Agenda conectado para sugestões adaptadas aos seus compromissos.
- *(Opcional)* Chave de API pessoal do Google Gemini para usar sua própria cota na nuvem.

## Instruções Passo a Passo
1. **Abrir o Estilista**: Toque na aba **AI Stylist** na barra de navegação inferior.
2. **Fale ou Digite**: Toque no **ícone do microfone** e pergunte o que vestir (ex.: *"O que devo vestir para um almoço em um dia de chuva?"* ou *"Sugira um look elegante para o trabalho"*).
3. **Ouça a Resposta por Voz**: O estilista responde com conselhos personalizados e exibe cartões de roupas combinadas. Toque em **Reproduzir resposta** para ouvir o áudio novamente a qualquer momento.
4. **Ferramenta Shuffle**: Quer inspiração espontânea? Toque na aba **Shuffle** para girar seu guarda-roupa e descobrir combinações inéditas!
5. **Salvar no Diário**: Toque em **Salvar no Diário** para agendar o look no seu calendário de estilo.

## Resultados Esperados
Sugestões de looks personalizadas e adaptadas ao clima na tela, com explicações faladas sobre o porquê das peças combinarem. Se sua chave de API atingir a cota, um banner avisará que o motor local atendeu o pedido perfeitamente.

## Solução de Problemas
- **Microfone não captura a voz**: Verifique as permissões do seu navegador ou dispositivo para garantir o acesso ao microfone.
- **O estilista repete looks com frequência**: Registre seus looks usados no calendário para que o estilista priorize peças não vestidas recentemente.
- **Aviso "Usando Estilista da Plataforma (Quota Fallback)"**: Aparece quando sua chave pessoal do Gemini atinge o limite. Sua solicitação foi concluída com sucesso pela nossa IA interna.

## Limitações
- O estilista trabalha estritamente com as roupas já cadastradas no seu guarda-roupa digital.
- Usuários do plano gratuito recebem 10 créditos diários de estilo que são repostos a cada 24 horas.
