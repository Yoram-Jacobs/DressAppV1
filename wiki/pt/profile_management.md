# Perfil, Tamanhos e Configuração

Ajuste com precisão as suas medidas, restrições de modéstia e credenciais de IA.

## Visão Geral
A secção Perfil mantém o seu contexto de estilo atualizado, gerindo métricas corporais físicas, seleção da paleta de tons de pele, recortes de fotos de corpo inteiro, regras de estilo, chaves API de IA personalizadas, notificações de campanhas e configurações da região local.

## Pré-requisitos
- Conta de utilizador ativa no DressApp.

## Passo a Passo
1. **Introduzir Métricas e Tamanhos ANSUR II**: Introduza os parâmetros físicos básicos (Altura, Peso, Cintura, Comprimento do Pé). O modelo de regressão ANSUR II calcula automaticamente as suas 6 dimensões estruturais (Ombros, Peito, Anca, Comprimento do Braço, Entreperna, Comprimento Exterior).
2. **Tom de Pele e Recorte de Foto Corporal**: Selecione o seu tom de pele na paleta de cores ou carregue uma fotografia de corpo inteiro. O sistema realiza automaticamente o recorte de fundo U2-Net para exibir pré-visualizações de prova no corpo real. Clique em *Remover Foto* para voltar instantaneamente ao manequim vetorial 2D SVG.
3. **Especificar Regras**: Selecione elementos a evitar (ex.: "evitar amarelo") e níveis de modéstia.
4. **Configuração de IA**: Introduza as suas chaves personalizadas do Google AI Studio ou selecione o modo de fornecedor padrão.
5. **Notificações de Campanhas**: Expanda o acordeão *Notificações de Campanhas* para ativar notificações por e-mail ou push para promoções locais, saldos e novos estilistas na sua área, e personalize a frequência (Instantânea, Diária, Semanal) e a distância máxima (5km, 10km, 25km, 50km).
6. **Gerir Conta**: Visualize o seu nível de subscrição (Pro vs. limite Free de 150 itens) ou solicite a eliminação da conta.

## Resultados Esperados
- Avatar 2D personalizado e esquemas de conjuntos ajustados exatamente à sua forma, tom de pele e preferências de estilo de vestuário.
- Notificações entregues nos seus canais selecionados quando as campanhas ativas corresponderem às suas regras de estilo e estiverem dentro do raio de distância selecionado.

## Resolução de Problemas
- **Chave API inválida**: Verifique se copiou a chave corretamente do Google AI Studio sem espaços adicionais.
- **Fundo da foto não limpo**: Certifique-se de que a sua foto de corpo inteiro tem iluminação clara sobre um fundo contrastante.
- **Calendário não sincroniza**: Desvincule e volte a autenticar a sua conta Google para atualizar os tokens.
- **Não recebe campanhas**: Certifique-se de que os seus *Serviços de Localização* estão ativados e que a configuração de distância máxima cobre a localização do negócio local.

## Limitações
- As regras personalizadas são aplicadas estritamente; se as suas regras forem demasiado rígidas, o estilista poderá não encontrar conjuntos correspondentes.
- Os alertas push de campanha requerem permissões de notificação do navegador. Se bloqueados, apenas receberá notificações por e-mail.