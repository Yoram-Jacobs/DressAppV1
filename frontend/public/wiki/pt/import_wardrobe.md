# Importar seu guarda-roupa de outros aplicativos (Migração de concorrentes)

## Visão geral
Se você já tem suas roupas catalogadas em outro aplicativo de guarda-roupa (como Whering, Acloset ou Stylebook), não precisa começar do zero. O DressApp possui um **Desktop Wardrobe Migration Agent** inteligente (via bookmarklet de navegador) que varre a página do seu antigo guarda-roupa, captura os cartões das suas peças e as envia automaticamente para o DressApp. Nossa IA trabalha em segundo plano para identificar de forma automática as cores, marcas, tecidos e categorias das suas roupas.

## Pré-requisitos
- **Computador desktop**: O bookmarklet de migração requer recursos de navegadores de desktop (Chrome, Edge ou Safari). Ele não é compatível com dispositivos móveis ou tablets.
- **Contas ativas**: Você deve estar conectado tanto à sua conta do DressApp quanto à sua conta do guarda-roupa concorrente no mesmo navegador.
- **Barra de favoritos**: A barra de favoritos do seu navegador deve estar visível (Ctrl+Shift+B no Windows, Cmd+Shift+B no macOS).

## Instruções passo a passo
1. Abra a página de **Perfil** do DressApp no seu computador desktop e clique em **Import Wardrobe**.
2. Selecione seu antigo aplicativo na lista (Whering, Acloset, Stylebook, Smartli, BeautyAI etc.) ou digite um nome personalizado.
3. Arraste o botão do bookmarklet **Share & Start Agent** da tela diretamente para a barra de favoritos do seu navegador.
4. Abra uma nova guia, acesse a versão web do seu antigo aplicativo de guarda-roupa e faça login. Vá para a página onde todas as suas roupas são exibidas em uma grade.
5. Clique no bookmarklet **Share & Start Agent** na sua barra de favoritos.
6. O agente começará a rolar a página, detectando imagens de roupas e transmitindo-as para o DressApp em lotes de 15. Não feche a guia do DressApp durante esse processo.
7. Assim que a transmissão for concluída, verifique a página do seu Closet no DressApp. O AI Stylist processará os itens em segundo plano para preencher os atributos das roupas automaticamente.

## Resultados esperados
- Os cartões das peças aparecerão imediatamente na grade do seu guarda-roupa no DressApp.
- Os fundos são removidos de forma automática, deixando miniaturas limpas e transparentes.
- Os campos de tags (categoria, cor, caimento, tecido) serão preenchidos automaticamente em poucos minutos após a importação.

## Solução de problemas
- **O bookmarklet não instala**: Certifique-se de que a barra de favoritos do seu navegador esteja habilitada. Se as configurações de segurança bloquearem o arrasto, clique com o botão direito no botão, selecione "Copiar endereço do link", crie um novo favorito manualmente e cole o código no campo de URL.
- **O agente para de rolar**: Certifique-se de que a página do guarda-roupa concorrente esteja ativa e não minimizada. Se travar, atualize a página do concorrente e clique no bookmarklet novamente.
- **Itens duplicados**: O importador verifica as assinaturas das imagens (dHash) para filtrar uploads duplicados automaticamente.

## Limitações
- **Apenas desktop**: Não pode ser executado em navegadores móveis devido a restrições de API.
- **Clareza visual**: Disposições de roupas muito distorcidas, escuras ou sobrepostas no aplicativo concorrente podem falhar na extração de corte visual e exigir ajustes manuais nas fotos posteriormente.