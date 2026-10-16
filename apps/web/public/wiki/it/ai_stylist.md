# AI Stylist Conversazionale

Interagisci con uno stylist personale intelligente che conosce il tuo guardaroba, il meteo e i tuoi impegni quotidiani.

## Panoramica
L'AI Stylist è il tuo compagno di moda personale. Puoi chattare con lui scrivendo o parlando ad alta voce proprio come faresti con un amico. Lo Stylist controlla le previsioni meteo locali, dà un'occhiata agli eventi del tuo Google Calendar e suggerisce outfit completi ed eleganti composti direttamente con i vestiti che già possiedi.

Il cervello stilistico di DressApp è guidato da un'architettura di intelligenza multilivello resiliente e senza chiavi API personali (Zero-BYOK):
- **Piani Manager e Professional — Modello Cloud Veloce (Google Gemini 3.5 Flash)**: Gli abbonati ai piani **Manager** e **Professional** usufruiscono dell'instradamento prioritario verso il modello IA Cloud veloce (attualmente **Google Gemini 3.5 Flash** tramite `llm_gateway.py`), che offre risposte fulminee (TTFT inferiore a 350 ms) senza alcuna configurazione richiesta.
- **Piano Gratuito (Free Tier) — Motore Eyes On-Premises (`Qwen 2.5 VL 3B`) e Rete di Sicurezza per le Quote**: Gli utenti del piano gratuito sono serviti dal modello dedicato e ottimizzato **Qwen 2.5 VL 3B** di DressApp, in esecuzione locale nel container `dressapp-eyes` sulla porta 7860 del VPS Hetzner CPX32. Funge inoltre da fallback di sicurezza trasparente per i piani a pagamento: se vengono raggiunti i limiti di frequenza dell'API cloud (`429` / `RESOURCE_EXHAUSTED`), le richieste vengono reindirizzate automaticamente al motore Eyes on-premises senza interruzioni né errori 500.

## Prerequisiti
- Almeno un capo superiore (top), un capo inferiore (pantaloni/gonna) e un paio di calzature caricati nel guardaroba.
- Autorizzazione per il microfono abilitata se desideri utilizzare lo styling vocale a mani libere.
- *(Facoltativo)* Google Calendar collegato per rendere i suggerimenti di outfit consapevoli delle tue occasioni.

## Istruzioni passo dopo passo
1. **Apri lo Stylist**: Tocca la scheda **AI Stylist** nella barra di navigazione inferiore.
2. **Parla o scrivi**: Tocca l'**icona del microfono** e chiedi cosa indossare (ad es., *"Cosa dovrei indossare per un pranzo in un pomeriggio piovoso?"* oppure *"Suggeriscimi un look aziendale chic"*).
3. **Ascolta i consigli vocali**: Lo Stylist risponde a voce con consigli su misura e mostra le schede degli outfit abbinati. Tocca **Ascolta risposta** per riascoltare i consigli audio in qualsiasi momento.
4. **Prova lo strumento Shuffle**: Vuoi un'ispirazione immediata? Tocca la scheda **Shuffle** per far girare il tuo guardaroba e scoprire nuove combinazioni a cui potresti non aver mai pensato!
5. **Perfeziona con domande successive**: Chiedi allo stylist di cambiare le scarpe, sostituire una giacca o adattare il look ai cambiamenti di temperatura in un flusso conversazionale continuo.
6. **Salva i tuoi preferiti**: Tocca **Salva nel diario** per programmare il look sul calendario personale del tuo guardaroba.

## Risultati attesi
Suggerimenti di outfit personalizzati e adatti al meteo visualizzati sullo schermo, completi di spiegazioni vocali che illustrano perché i capi si abbinano tra loro. Se le quote delle API cloud esterne sono temporaneamente esaurite, un banner informativo indica che lo Stylist integrato Eyes on-premises ha gestito la tua richiesta senza interruzioni.

## Risoluzione dei problemi
- **Il microfono non rileva le parole**: Controlla le autorizzazioni del browser o del dispositivo per assicurarti che DressApp disponga del permesso di accedere al microfono.
- **Lo Stylist suggerisce troppi outfit ripetuti**: Registra i tuoi outfit giornalieri nel calendario in modo che lo Stylist sappia cosa hai indossato di recente e dia priorità ai capi non ancora indossati.
- **Banner "Utilizzo dello Stylist della Piattaforma (Quota Fallback)"**: Appare quando vengono raggiunti i limiti di frequenza dell'API cloud esterna. L'app ha risposto senza problemi alla tua domanda utilizzando il motore integrato Eyes on-premises (`Qwen 2.5 VL 3B`) di DressApp, senza alcuna interruzione della conversazione.

## Limitazioni
- Lo Stylist lavora esclusivamente con gli articoli presenti nel tuo guardaroba; non può consigliare capi che non hai ancora caricato.
- Gli utenti del piano Gratuito utilizzano il modello Eyes on-premises con crediti di styling gratuiti che si ricaricano automaticamente, mentre gli account Manager e Professional usufruiscono del modello Cloud veloce (`Gemini 3.5 Flash`) e di quote mensili più elevate.
