# Solução de Problemas e Dicas Úteis

Soluções rápidas e simples para dúvidas comuns, permissões e limites do aplicativo.

## Visão geral
Encontre respostas rápidas sobre acesso à câmera, velocidade de envio, limites de capacidade do guarda-roupa, configurações de áudio e avisos de IA para que você possa voltar a montar seus looks sem esforço.

## Pré-requisitos
- Uma conexão ativa com a Internet.
- Um navegador web moderno (recomendamos Google Chrome ou Apple Safari) ou o aplicativo móvel do DressApp.

## Instruções passo a passo
1. **A câmera não liga**:
   - Abra as configurações do seu navegador ou dispositivo, localize o **DressApp** e certifique-se de que as permissões de **Câmera** estejam definidas como "Permitir". Recarregue a página.
2. **Mensagem "Capacidade do guarda-roupa atingida"**:
   - As contas gratuitas armazenam até **150 peças de roupa** como base.
   - Você pode convidar amigos para ganhar **+10 vagas extras** por cadastro (até o limite máximo de 150 itens), excluir roupas não usadas ou tocar em **Fazer upgrade para Manager** (\$10/mês) ou **Professional** (\$15/mês) para armazenamento ilimitado.
3. **Digitação por voz ou reprodução de áudio não funcionam**:
   - Verifique se as permissões de microfone estão autorizadas nas configurações do seu navegador.
   - Confira se o volume do seu celular ou computador está aumentado e não está no mudo nem no modo "Não perturbe".
4. **Fotos demorando para processar**:
   - Looks com várias peças levam alguns instantes enquanto a IA recorta os fundos, inspeciona a integridade da imagem e extrai as etiquetas de roupa. Os itens são processados suavemente um a um; você pode continuar navegando pelo aplicativo enquanto eles terminam!
5. **Aviso "Usando estilista da plataforma (Fallback de cota)"**:
   - Se o modelo externo de IA em nuvem atingir temporariamente um limite de requisições `429 Too Many Requests`, o DressApp detecta isso automaticamente e conclui seu pedido de estilo usando nosso modelo **Eyes** local (on-premises) integrado (atualmente um modelo `Qwen 2.5 VL 3B` ajustado). Seu pedido de estilo nunca travará nem falhará com erro!
6. **Acesso à IA rápida em nuvem e ao Trend Scout**:
   - Os usuários gratuitos contam com o modelo **Eyes** local (`Qwen 2.5 VL 3B`) do DressApp sem nenhuma configuração. Fazer upgrade para o plano **Manager** (\$10/mês) ou **Professional** (\$15/mês) desbloqueia o roteamento prioritário para o modelo rápido de IA em nuvem (atualmente **Google Gemini 3.5 Flash**) e o acesso completo à inteligência diária de moda do Trend Scout.
7. **Conectar Google Calendar**:
   - Vá até **Perfil** &rarr; **Google Calendar** e toque em **Conectar**. Autorize as permissões de agenda para que o estilista possa verificar seus compromissos diários.

## Resultados esperados
Resolução rápida de problemas comuns para que o seu guarda-roupa digital funcione perfeitamente.

## Solução de problemas
- **Ainda está enfrentando problemas?** Saia da sua conta e entre novamente, ou limpe o cache do navegador para atualizar sua sessão.
- **Exibição em idiomas RTL**: Em hebraico e árabe, os textos e abas são espelhados automaticamente para a direita para uma leitura natural.

## Limitações
- As importações de guarda-roupas digitais de aplicativos concorrentes exigem um navegador de computador e não podem ser iniciadas pelo celular.
- O roteamento para o modelo rápido em nuvem (`Gemini 3.5 Flash`) e os canais completos de moda do Trend Scout exigem um plano **Manager** ou **Professional** ativo.
