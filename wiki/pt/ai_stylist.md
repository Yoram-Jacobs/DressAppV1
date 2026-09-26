# Estilista com IA conversacional

Interaja com um estilista pessoal inteligente que conhece o seu guarda-roupa, a previsão do tempo e a sua rotina diária.

## Visão geral
O AI Stylist é o seu consultor de moda pessoal. Você pode conversar com ele digitando ou falando em voz alta, como faria com um amigo. O estilista verifica a previsão local, confere os seus compromissos no Google Calendar e sugere looks completos e estilosos montados diretamente com as roupas que você já possui.

A inteligência de estilo do DressApp é estruturada sobre uma arquitetura multinível resiliente:
- **Motor principal de produção (Google Gemini 3.5 Flash-Lite)**: Responsável por todas as conversas principais de estilo nativamente por meio do `llm_gateway.py`. Entrega respostas extremamente rápidas (TTFT abaixo de 350 ms) sem necessidade de configuração prévia nem burocracia — nenhuma chave de API pessoal é necessária para começar a receber sugestões!
- **Eyes no VPS on-premises (`gemma-4-E4B`) — Plano gratuito e rede de proteção de cotas**: Um modelo dedicado e refinado `gemma-4-E4B` executado localmente no contêiner `dressapp-eyes` na porta 7860 do VPS Hetzner CPX32. Garante uma base de custo variável zero para contas Free Tier e atua como fallback transparente. Caso ocorram limites de API no Google Gemini (`429` / `RESOURCE_EXHAUSTED`), as consultas são redirecionadas automaticamente para o Gemma on-premises sem falhas nem erros 500.
- **Programa do grupo de testadores**: Testadores aprovados contam com acesso gratuito ao nível **Professional**, com capacidade ilimitada de closet, feed radar do Trend Scout, agendamento diário de estilo e 100 créditos por ciclo.
- **Modelos em nuvem personalizados (BYOK)**: Opcionalmente, os usuários podem inserir sua própria chave de API do Google Gemini nas configurações de Perfil para acessar modelos superiores (`gemini-2.5-pro`) ou desbloquear recursos generativos avançados (reconstrução de fotos Nano Banana).

## Pré-requisitos
- Pelo menos uma peça superior, uma inferior e um calçado cadastrados no seu closet.
- Permissão de microfone concedida se desejar usar a consultoria de estilo por voz com as mãos livres.
- *(Opcional)* Google Calendar conectado para adequar as sugestões de looks a ocasiões específicas.
- *(Opcional)* Chave de API pessoal do Google Gemini caso queira utilizar sua própria cota de desenvolvedor em nuvem.

## Instruções passo a passo
1. **Abrir o estilista**: Toque na aba **AI Stylist** na barra de navegação inferior.
2. **Falar ou digitar**: Toque no **ícone de microfone** e pergunte o que vestir (por exemplo, *"O que devo vestir para um almoço em uma tarde chuvosa?"* ou *"Sugira um visual formal elegante"*).
3. **Ouvir a recomendação falada**: O estilista responde com orientações personalizadas e apresenta os cards com os looks correspondentes. Toque em **Ouvir resposta** para escutar a orientação por áudio a qualquer momento.
4. **Experimentar o recurso Shuffle**: Quer uma dose de inspiração instantânea? Toque na aba **Shuffle** para girar as peças do armário e descobrir combinações inovadoras que talvez você nunca tivesse pensado em usar juntas!
5. **Refinar a conversa**: Peça ao estilista para trocar os sapatos, substituir uma jaqueta ou se adaptar a variações de temperatura em uma conversa fluida.
6. **Salvar seus looks favoritos**: Toque em **Salvar no diário** para agendar a combinação no calendário do seu guarda-roupa pessoal.

## Resultados esperados
Sugestões de looks personalizadas e apropriadas para o clima exibidas na sua tela, com justificativas faladas explicando por que as peças combinam entre si. Se as cotas de APIs externas forem temporariamente atingidas, um aviso informativo indicará que o estilista on-premises integrado atendeu à sua solicitação perfeitamente.

## Solução de problemas
- **Microfone não capta a fala**: Verifique as permissões do navegador ou do dispositivo para certificar-se de que o DressApp tem autorização para acessar seu microfone.
- **Estilista sugere looks muito repetitivos**: Registre suas roupas diárias no calendário para que o estilista saiba o que você usou recentemente e dê preferência a peças paradas no armário.
- **Aviso "Usando estilista da plataforma (Fallback de cota)"**: Aparece quando os limites de requisições da API externa são atingidos. O aplicativo atendeu sua consulta utilizando o motor Gemma on-premises integrado do DressApp sem interrupções.

## Limitações
- O estilista trabalha estritamente com as roupas do seu closet; ele não sugere peças que ainda não tenham sido cadastradas.
- Usuários do plano Free Tier recebem créditos de estilo de cortesia que se renovam automaticamente, enquanto contas Pro e Testadores contam com cotas mensais ampliadas.
