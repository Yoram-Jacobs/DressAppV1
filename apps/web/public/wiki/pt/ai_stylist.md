# Estilista de IA Conversacional

Interaja com um estilista pessoal inteligente que conhece o seu guarda-roupa, o tempo e a sua agenda.

## Visão Geral
O Estilista de IA processa consultas de estilo por voz ou texto em linguagem natural, integrando automaticamente condições meteorológicas, eventos do calendário e notificações push através de stores personalizados `useSyncExternalStore` seguros para threads (`stylistStore` e `dailySuggestionsStore`) com cache de 15 minutos e eliminação de pedidos duplicados em curso.

## Pré-requisitos
- Uma chave API Gemini (ou créditos padrão do sistema).
- Eventos de calendário ligados.

## Passo a Passo
1. **Iniciar Sessão**: Abra o separador Stylist e selecione Chat, Shuffle ou Match.
2. **Entrada de Voz**: Toque no microfone, fale a sua consulta (ex.: "Sugere um conjunto para um dia de chuva") e toque para enviar.
3. **Reprodução de Áudio**: Ouça a explicação de estilo gerada através do reprodutor de voz de alta fidelidade.
4. **Misturar (Shuffle)**: Clique no botão Sparkles para rodar a máquina; a IA alinha automaticamente os itens correspondentes em foco.
5. **Navegação sem Espera**: A navegação entre o Stylist e outros separadores utiliza preferências em memória sem acionar ciclos de pedidos GET à base de dados.

## Resultados Esperados
Esquemas de conjuntos personalizados criados em torno das suas preferências pessoais, restrições sazonais e agenda.

## Resolução de Problemas
- **Áudio reproduz demasiado devagar**: Alterne entre o Gemini TTS e o recurso Web Speech API nas definições de Profile.
- **Sugestões repetidas**: Certifique-se de que o seu histórico do calendário de conjuntos está atualizado para que o algoritmo de rotação possa bloquear o uso repetido de peças.

## Limitações
- As recomendações requerem pelo menos uma peça superior, uma peça inferior e um par de sapatos no guarda-roupa para completar um look.
- A transcrição de voz pode recorrer à introdução de texto padrão em dispositivos não suportados.