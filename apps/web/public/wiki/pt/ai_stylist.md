# Estilista Conversacional com IA

Interaja com um estilista pessoal inteligente que conhece o seu guarda-roupa, a previsão do tempo e a sua agenda diária.

## Visão geral
O AI Stylist é o seu consultor de moda pessoal. Você pode conversar com ele digitando ou falando em voz alta, exatamente como faria com um amigo. O estilista consulta a previsão do tempo local, confere os seus eventos no Google Calendar e sugere looks completos e elegantes montados diretamente com as roupas que você já possui.

O cérebro de estilo do DressApp é impulsionado por uma arquitetura de inteligência multinível resiliente e sem necessidade de chaves próprias (zero-BYOK):
- **Planos Manager e Professional — Modelo Rápido em Nuvem (Google Gemini 3.5 Flash)**: Os assinantes dos planos **Manager** e **Professional** contam com roteamento prioritário para o modelo rápido de IA em nuvem (atualmente **Google Gemini 3.5 Flash** via `llm_gateway.py`), entregando respostas ultrarrápidas (TTFT abaixo de 350 ms) sem nenhuma configuração necessária.
- **Plano Gratuito — Motor Local Eyes (`Qwen 2.5 VL 3B`) e Rede de Proteção de Cotas**: Os usuários do plano gratuito são atendidos pelo modelo dedicado e ajustado **Qwen 2.5 VL 3B** do DressApp, executado localmente no contêiner `dressapp-eyes` na porta 7860 do VPS Hetzner CPX32. Ele também atua como um fallback de segurança transparente para os planos pagos: caso os limites de taxa da API em nuvem (`429` / `RESOURCE_EXHAUSTED`) sejam atingidos, as consultas são redirecionadas automaticamente para o motor Eyes local sem falhar nem gerar erros 500.

## Pré-requisitos
- Pelo menos uma peça superior, uma peça inferior e um calçado cadastrados no seu guarda-roupa.
- Permissão de microfone ativada se desejar usar a consultoria de estilo por voz com as mãos livres.
- *(Opcional)* Google Calendar conectado para tornar as sugestões de looks adaptadas às suas ocasiões.

## Instruções passo a passo
1. **Abrir o estilista**: Toque na aba **AI Stylist** na barra de navegação inferior.
2. **Falar ou digitar**: Toque no **ícone de microfone** e pergunte o que vestir (por exemplo, *"O que devo vestir para um almoço em uma tarde chuvosa?"* ou *"Sugira um visual executivo elegante"*).
3. **Ouvir a recomendação falada**: O estilista responde com orientações personalizadas e exibe os cards de looks correspondentes. Toque em **Ouvir resposta** para escutar a recomendação em áudio novamente a qualquer momento.
4. **Experimentar a ferramenta Shuffle**: Quer inspiração instantânea? Toque na aba **Shuffle** para girar o seu guarda-roupa e descobrir combinações novas que talvez você não tivesse pensado em usar juntas!
5. **Refinar com perguntas adicionais**: Peça ao estilista para trocar os sapatos, substituir uma jaqueta ou se adaptar a mudanças de temperatura em um fluxo contínuo de conversa.
6. **Salvar seus favoritos**: Toque em **Salvar no diário** para agendar o look no calendário do seu guarda-roupa pessoal.

## Resultados esperados
Sugestões de looks personalizadas e adequadas ao clima exibidas na sua tela, completas com explicações faladas sobre por que as peças combinam. Se as cotas da API externa em nuvem forem temporariamente esgotadas, um aviso informativo indicará que o estilista Eyes local integrado atendeu à sua solicitação sem interrupções.

## Solução de problemas
- **O microfone não capta as palavras**: Verifique as permissões do navegador ou do dispositivo para garantir que o DressApp tenha permissão para acessar seu microfone.
- **O estilista sugere muitos looks repetidos**: Registre seus looks diários no calendário para que o estilista saiba o que você vestiu recentemente e priorize roupas ainda não usadas.
- **Aviso "Usando estilista da plataforma (Fallback de cota)"**: Aparece quando os limites de requisições da API externa em nuvem são atingidos. O aplicativo respondeu à sua pergunta perfeitamente usando o motor Eyes local (`Qwen 2.5 VL 3B`) integrado do DressApp, sem interromper sua conversa.

## Limitações
- O estilista trabalha estritamente com os itens do seu guarda-roupa; ele não pode recomendar peças que você ainda não tenha enviado.
- Os usuários do plano gratuito (Free Tier) utilizam o modelo Eyes local com créditos de estilo de cortesia que se renovam automaticamente, enquanto as contas Manager e Professional desfrutam do modelo rápido em nuvem (`Gemini 3.5 Flash`) e de cotas mensais ampliadas.
