# Assistente de organização de malas

Faça as malas com eficiência e sem estresse para qualquer destino, com previsões meteorológicas baseadas em IA e ajuste conversacional da lista de verificação.

## Visão geral
O Assistente de organização de malas elimina a ansiedade do planejamento de viagens analisando seu itinerário, o clima no destino e o catálogo do seu guarda-roupa pessoal para montar uma lista de bagagem personalizada dia a dia. Movido pelo **Google Gemini 3.5 Flash-Lite** via `llm_gateway.py`, o assistente gera planos de bagagem completos em segundos e permite refinar os itens de forma interativa por meio de chat conversacional.

## Pré-requisitos
- Nome da cidade de destino e datas de ida e volta.
- Um inventário ativo no closet com pelo menos algumas peças básicas.
- Conexão com a Internet para consultar as previsões meteorológicas do destino.

## Instruções passo a passo
1. **Criar uma viagem**: Abra a aba Mala, toque em **Nova viagem** e informe a cidade de destino, as datas de início e término e o objetivo da viagem (por exemplo, *Negócios*, *Férias na praia*, *Turismo urbano casual*).
2. **Gerar plano de bagagem**: Toque em **Gerar lista**. A IA busca as temperaturas e condições previstas para o destino, cruza com as roupas do seu closet e cria uma lista de bagagem equilibrada.
3. **Revisar looks diários**: Inspecione as combinações sugeridas para cada dia, garantindo camadas adequadas para manhãs frescas e tardes mais quentes.
4. **Refinar pelo chat conversacional**: Precisa de mais opções? Converse diretamente com o assistente (por exemplo, *"Adicione tênis confortáveis para caminhada"* ou *"Inclua um vestido de festa para o jantar"*). A lista é atualizada dinamicamente.
5. **Marcar itens embalados**: Use as caixas de seleção interativas conforme guarda os pertences na mala para acompanhar o que já foi embalado.
6. **Salvar para acesso offline**: Salve o plano de viagem concluído para acessá-lo com rapidez no seu dispositivo, mesmo sem sinal de Internet durante o trajeto.

## Resultados esperados
Uma lista de bagagem abrangente e otimizada para o clima, organizada por categorias de roupas (partes de cima, partes de baixo, casacos, calçados, essenciais) sem peças duplicadas ou desnecessárias.

## Solução de problemas
- **Previsão do tempo indisponível**: Confira a grafia da cidade de destino; para locais remotos, tente indicar a cidade polo mais próxima.
- **A lista exibe poucos itens**: Certifique-se de ter cadastrado no seu closet roupas suficientes e adequadas à estação e às temperaturas esperadas.
- **Ajustes não estão sendo salvos**: Confirme se sua conexão com a Internet está ativa ao adicionar notas personalizadas pelo chat.

## Limitações
- As previsões meteorológicas automáticas atendem a viagens programadas com até 14 dias de antecedência; viagens para períodos mais distantes utilizam médias climáticas sazonais históricas.