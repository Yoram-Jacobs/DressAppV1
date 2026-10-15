# Assistente de organização de malas

Faça as malas com eficiência, segurança e respeito para qualquer destino global com previsões meteorológicas baseadas em IA, diretrizes geopolíticas e religiosas de código de vestimenta e ajuste conversacional da lista de verificação.

## Visão geral
O Assistente de organização de malas elimina a ansiedade do planejamento de viagens analisando seu itinerário de viagem, o clima no destino, os eventos do calendário e o catálogo do seu guarda-roupa pessoal para montar uma lista de bagagem personalizada dia a dia. Movido pelo **Google Gemini 3.5 Flash-Lite** e pelo **DressApp Eyes (`Qwen2.5-VL-3B-Instruct`)** via `llm_gateway.py` e apoiado por `travel_safety_knowledge.md`, o assistente gera planos de bagagem completos em segundos, alerta sobre leis de código de vestimenta ou zonas de perigo no destino e permite refinar os itens de forma interativa por meio de chat conversacional.

## Pré-requisitos
- Nome da cidade ou país de destino e datas de ida e volta.
- Um inventário ativo no closet com peças essenciais.
- Conexão com a Internet para consultar as previsões meteorológicas do destino.

## Diretrizes geopolíticas, legais e georreligiosas de código de vestimenta
O DressApp cruza seu destino e as atividades programadas com um banco de dados global de segurança selecionado (`travel_safety_knowledge.md`) que abrange sete domínios de restrição:

1. **Regimes de modéstia religiosa e decência pública exigidos pelo Estado**:
   - **Irã e Afeganistão**: Impõe o uso obrigatório de lenços de cabeça e túnicas folgadas até a altura do joelho (*manteau* / *abaya*) sobre partes de baixo até o tornozelo para mulheres (além de *chador* longo dentro de santuários sagrados iranianos), e bloqueia estritamente bermudas/shorts e blusas sem mangas para homens.
   - **Arábia Saudita, Catar, Kuwait, Omã, Bahrein, Emirados Árabes Unidos (Sharjah/Dubai/Abu Dhabi), Brunei, Aceh (Indonésia) e Malásia (Kelantan/Terengganu)**: Impõe modéstia pública dos ombros aos joelhos, proíbe roupas justas ou transparentes em shoppings e souqs, aplica proibições ao uso de roupas do sexo oposto onde previsto em lei e fornece regras de *Ihram* para Meca e Medina.
   - **Maldivas (Ilhas locais habitadas)**: Alerta os viajantes de que biquínis e trajes de banho sem camisa são estritamente ilegais em ilhas locais habitadas (por exemplo, Maafushi, Thoddoo) fora das "Bikini Beaches" cercadas e designadas.
2. **Proibições legais ao uso civil de camuflagem e vestuário militar**:
   - Bloqueia rigorosamente roupas, chapéus/bonés, calçados e mochilas com estampa camuflada em **nações caribenhas** (Barbados, Jamaica, Trinidad e Tobago, Santa Lúcia, São Vicente, Antígua e Barbuda, Granada, Dominica, São Cristóvão e Névis, Bahamas, Guiana), **nações africanas** (Nigéria, Uganda — incluindo boinas vermelhas, Zimbábue, Zâmbia, Gana, Quênia, África do Sul, Ruanda) e **Filipinas, Omã e Arábia Saudita**, onde o uso civil de camuflagem é crime.
3. **Leis de vestuário autoritárias, socialistas e de identidade estatal**:
   - Abrange **Coreia do Norte (RPDC)** (proibições a calças jeans azuis/rasgadas/skinny e sobretudos de couro; ternos/vestidos formais obrigatórios no Palácio Kumsusan e em Mansudae), **Turcomenistão** (proibições em Asgabate a bermudas masculinas e vestidos justos), **Butão** (regras do *Driglam Namzha* exigindo camisa de manga comprida com gola e parte de baixo até o tornozelo, sem chapéus ou guarda-chuvas dentro dos Dzongs), **China** (proibições a véus faciais em Xinjiang e proibições na RPC a uniformes imperiais japoneses), **Chechênia** (proibição em Grozny a bermudas masculinas) e proibições legais de símbolos na **Rússia, Uganda e Nigéria**.
4. **Proibições seculares de cobertura facial (Burca/Niqab) e laicidade pública**:
   - Alerta os viajantes sobre proibições legais de cobertura facial em público na **França, Suíça, Áustria, Bélgica, Dinamarca, Bulgária, Países Baixos** (transporte público, escolas, hospitais, prédios governamentais) e **Quebec, Canadá** (serviços públicos sob a Lei 21), bem como regras de piscinas municipais francesas (proibição de burquinis e bermudas de banho masculinas folgadas).
5. **Proibições de lesa-majestade real, bandeira nacional e símbolos políticos/totalitários**:
   - Protege os viajantes na **Tailândia** (*Lèse-Majesté* Art. 112, proibição de estampas da bandeira tailandesa em calçados/parte inferior do corpo, proibição de estampas de Buda/tatuagens na parte inferior do corpo), **Alemanha e Áustria** (*StGB § 86a* símbolos inconstitucionais), **Ucrânia, Estados Bálticos, Polônia, Geórgia e Moldávia** (proibições à foice e martelo soviéticos, fita de São Jorge e símbolos militares russos 'Z'/'V'), **Indonésia** (proibição anticomunista rigorosa da foice e martelo) e **Hong Kong** (proibições de slogans sediciosos sob a Lei de Segurança Nacional).
6. **Zonas de perigo de gangues, cartéis, grupos paramilitares e facções territoriais**:
   - Alerta os viajantes contra identificadores letais de facções em **favelas brasileiras** (três listras da Adidas associadas ao TCP/BDM *Tudo 3* vs. vermelho sólido/Nike associados ao CV *Tudo 2*, camisetas do Mickey Mouse, tatuagens de Coringa/palhaço e remoção obrigatória de capacete de motocicleta), **El Salvador, Honduras e Guatemala** (números `13`, `18`, `XIII`, `XVIII`, tênis Nike Cortez e tatuagens em estilo gótico sob o *Régimen de Excepción*), **Colômbia** (camuflagem em áreas rurais e botas de borracha de selva), **México** (bonés com siglas de cartéis `JGL`, `701`, `MZ`, `Chapiza`, `CJNG` e bolsas táticas de peito *pecheras*), **Jamaica** (zonas de guarnição em Kingston: verde do JLP vs. laranja do PNP) e **Irlanda do Norte / Glasgow** (camisas de futebol sectárias em zonas de interface).
7. **Recintos sagrados rigorosos e instituições religiosas em todo o mundo**:
   - Aplica protocolos exatos de entrada para a **Cidade do Vaticano e Duomos italianos** (ombros e joelhos cobertos; proibido vestir branco em Audiências Papais), **Monte Atos** (*Avaton* legal permitindo entrada apenas de homens; mangas compridas e calças), **Mosteiros Ortodoxos Orientais** (Meteora, Rússia, Geórgia, Sérvia — saias até o tornozelo e lenços de cabeça para mulheres; proibição de calças para mulheres), **Igrejas Ortodoxas Etíopes** (pés descalços + xale branco *Netela*), **Jerusalém** (*Kippah* e modéstia no Muro das Lamentações; cobertura folgada até os tornozelos e pulsos e proibição de itens de oração não muçulmanos no Monte do Templo / Al-Aqsa; *Tzniut* em Mea Shearim), **Grandes Mesquitas e Santuários Xiitas** (Sheikh Zayed em Abu Dhabi, Mascate, Casablanca, Istambul, *Chador* em Mashhad/Qom, *Abaya iraquiana* preta em Karbala/Najaf), **Templos Hindus e Jainistas** (regra rigorosa de *Ahimsa* com zero couro para cintos/carteiras/bolsas; regra do *Mundu* com torso nu para homens em Kerala; sarongue *Kamben* e faixa *Selendang* em Bali), **Pagodes Budistas** (regra de proibição de sarongue sobre shorts no Grande Palácio de Bangkok; regra de zero sapatos e zero meias em Shwedagon, Mianmar; trajes brancos em Kandy), **Gurdwaras Sikhs** (cobertura de cabeça obrigatória *Rumāl*/*Dastar*, lavagem dos pés descalços, zero tabaco/álcool nos bolsos) e **Onsen japoneses** (proibição rigorosa de tatuagens, exigindo adesivos de cobertura).

## Instruções passo a passo
1. **Criar uma viagem**: Abra a aba Mala, toque em **Nova viagem** e informe a cidade/país de destino, as datas de início e término e o objetivo da viagem (por exemplo, *Negócios*, *Férias na praia*, *Tour cultural e de templos*).
2. **Gerar plano de bagagem**: Toque em **Gerar lista**. A IA busca as temperaturas previstas, eventos do calendário e regras de segurança e religião do destino, cruza com os itens do seu closet e constrói uma lista de bagagem equilibrada.
3. **Revisar alertas culturais e de segurança**: Leia os banners de **Etiqueta Cultural** e **Zonas de Perigo / Avisos Legais** para garantir que os looks na sua mala cumpram as leis locais e os códigos de vestimenta de locais sagrados.
4. **Revisar looks diários**: Inspecione as combinações sugeridas para cada dia, garantindo camadas adequadas para manhãs frescas, tardes quentes e atividades programadas.
5. **Refinar pelo chat conversacional**: Converse diretamente com o assistente de bagagem (por exemplo, *"Adicione uma saia longa de linho modesta para visitas a templos"* ou *"Substitua a bermuda camuflada por calças chino bege"*). A lista é atualizada dinamicamente.
6. **Marcar itens embalados e salvar para viagem offline**: Use as caixas de seleção interativas conforme guarda os pertences na mala e salve o plano de viagem concluído para acesso offline durante o trajeto.

## Resultados esperados
Uma lista de bagagem abrangente, otimizada para o clima e em conformidade legal e cultural, organizada por categorias de roupas (partes de cima, partes de baixo, casacos, calçados, essenciais) sem nenhuma peça proibida ou desnecessária.

## Solução de problemas
- **Previsão do tempo indisponível**: Confira a grafia da cidade de destino; para locais remotos, indique a cidade principal mais próxima.
- **Falta de peças modestas ou específicas para o clima**: Consulte a seção **Itens Faltantes** para ver sugestões específicas de compras e lojas locais no destino onde você pode adquirir a vestimenta necessária (por exemplo, um lenço de cabeça, *sarongue* ou calças formais).
- **Ajustes não estão sendo salvos**: Confirme se sua conexão de rede está ativa ao salvar atualizações personalizadas feitas pelo chat.

## Limitações
- As previsões meteorológicas automáticas atendem a viagens programadas com até 14 dias de antecedência; viagens para períodos mais distantes utilizam médias climáticas sazonais históricas.