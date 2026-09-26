# AI Stylist conversazionale

Interagite con uno stylist personale intelligente che conosce il vostro guardaroba, il meteo e i vostri impegni quotidiani.

## Panoramica
L'AI Stylist è il vostro compagno di stile personale. Potete dialogare con lui digitando o parlando ad alta voce, proprio come con un amico. Lo Stylist controlla le previsioni locali, esamina gli appuntamenti del vostro Google Calendar e vi suggerisce outfit completi ed eleganti composti direttamente con i capi che già possedete.

Il motore di styling di DressApp è basato su un'architettura di intelligenza multilivello estremamente resiliente:
- **Motore di produzione principale (Google Gemini 3.5 Flash-Lite)**: Gestisce nativamente tutte le conversazioni di styling tramite `llm_gateway.py`. Fornisce risposte fulminee (TTFT inferiore a 350 ms) senza configurazione iniziale né attriti: nessuna chiave API personale è richiesta per iniziare a ricevere consigli di stile!
- **Eyes su VPS on-premises (`gemma-4-E4B`) — Piano gratuito e rete di sicurezza per le quote**: Un modello dedicato e ottimizzato `gemma-4-E4B` in esecuzione locale nel container `dressapp-eyes` sulla porta 7860 del VPS Hetzner CPX32. Assicura una base a costo variabile zero per gli account Free Tier e funge da fallback trasparente. Qualora vengano raggiunti i limiti dell'API Google Gemini (`429` / `RESOURCE_EXHAUSTED`), le richieste vengono reindirizzate automaticamente al modello Gemma on-premises senza interruzioni né errori 500.
- **Programma per il gruppo di tester**: I tester approvati beneficiano dell'accesso gratuito al piano **Professional**, completo di capienza illimitata per il guardaroba, radar delle tendenze Trend Scout, programmazione quotidiana del look e 100 crediti a ciclo.
- **Modelli Cloud personalizzati (BYOK)**: Nelle impostazioni del Profilo gli utenti possono facoltativamente inserire la propria chiave API di Google Gemini per accedere a modelli di fascia superiore (`gemini-2.5-pro`) o sbloccare strumenti generativi avanzati (ricostruzione fotografica Nano Banana).

## Prerequisiti
- Almeno un top, un pantalone/gonna e un paio di scarpe caricati nell'armadio.
- Autorizzazione all'uso del microfono concessa se desiderate utilizzare i comandi vocali a mani libere.
- *(Opzionale)* Google Calendar collegato per rendere i consigli di outfit consapevoli delle occasioni previste.
- *(Opzionale)* Chiave API personale di Google Gemini se preferite utilizzare la vostra quota di sviluppo su cloud.

## Istruzioni passo dopo passo
1. **Aprire lo stylist**: Toccate la scheda **AI Stylist** nella barra di navigazione inferiore.
2. **Parlare o scrivere**: Toccate l'**icona del microfono** e chiedete cosa indossare (ad esempio, *"Cosa dovrei indossare per un pranzo in un pomeriggio piovoso?"* oppure *"Suggeriscimi un look professionale ed elegante"*).
3. **Ascoltare i consigli vocali**: Lo Stylist risponde con raccomandazioni su misura e mostra le schede degli outfit abbinati. Toccate **Ascolta risposta** per riascoltare i consigli audio in qualsiasi momento.
4. **Provare la funzione Shuffle**: Volete un tocco di ispirazione improvvisa? Toccate la scheda **Shuffle** per far girare i capi del guardaroba e scoprire accostamenti originali a cui non avevate pensato!
5. **Perfezionare con nuove richieste**: Chiedete allo stylist di cambiare le scarpe, sostituire una giacca o adattare l'outfit alle variazioni di temperatura in una conversazione continua e naturale.
6. **Salvare i look preferiti**: Toccate **Salva nel diario** per programmare il look sul calendario del vostro guardaroba personale.

## Risultati attesi
Suggerimenti di outfit personalizzati e adatti al meteo mostrati sullo schermo, completi di spiegazioni vocali che illustrano le ragioni degli abbinamenti. Se le quote delle API esterne dovessero esaurirsi temporaneamente, un banner informativo indicherà che la richiesta è stata gestita senza interruzioni dallo Stylist on-premises integrato.

## Risoluzione dei problemi
- **Il microfono non rileva la voce**: Verificate le autorizzazioni del browser o del dispositivo per assicurarvi che DressApp possa accedere al microfono.
- **Lo stylist suggerisce outfit ripetitivi**: Registrate gli outfit giornalieri nel calendario in modo che lo Stylist conosca i capi indossati di recente e dia priorità a quelli meno utilizzati.
- **Banner "Uso dello stylist della piattaforma (Fallback quote)"**: Compare quando vengono raggiunti i limiti di frequenza dell'API esterna. L'applicazione ha risposto alla vostra richiesta sfruttando il motore Gemma locale integrato di DressApp, senza alcuna interruzione della conversazione.

## Limitazioni
- Lo Stylist lavora esclusivamente con i capi presenti nell'armadio; non può consigliare capi che non siano ancora stati caricati.
- Gli utenti del piano Free Tier ricevono crediti di styling gratuiti che si rinnovano automaticamente, mentre gli account Pro e Tester godono di quote mensili più elevate.
