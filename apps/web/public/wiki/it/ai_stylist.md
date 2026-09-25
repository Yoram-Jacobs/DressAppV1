# Stylist conversazionale con intelligenza artificiale

Interagisci con uno stylist personale intelligente che conosce il tuo guardaroba, le previsioni meteo e i tuoi impegni giornalieri.

## Panoramica
L'AI Stylist è il tuo assistente di moda in DressApp. Puoi dialogare scrivendo o parlando a voce in modo del tutto naturale. Lo stylist analizza il meteo locale, consulta i tuoi eventi di Google Calendar e suggerisce completi eleganti composti direttamente dai vestiti presenti nel tuo armadio.

Il motore di styling di DressApp è alimentato dal modello locale ottimizzato **Gemma-4-E4B**, disponibile immediatamente per tutti gli utenti gratuiti senza richiedere alcuna chiave API. Per gli utenti che configurano una chiave personale Google Gemini, DressApp include il **Quota Fallback automatico**: se la tua chiave esaurisce la quota giornaliera o supera i limiti di richieste, il sistema instrada la domanda al modello locale Gemma con un avviso informativo, garantendo che la sessione non si interrompa mai.

## Prerequisiti
- Almeno un capo superiore, uno inferiore e un paio di scarpe nel tuo armadio.
- Permesso del microfono abilitato per le richieste vocali a mani libere.
- *(Facoltativo)* Connessione a Google Calendar per suggerimenti coordinati con la tua agenda.
- *(Facoltativo)* Chiave Google Gemini API personale per utilizzare le tue quote cloud.

## Istruzioni passo passo
1. **Apri lo Stylist**: Tocca la scheda **AI Stylist** nella barra di navigazione inferiore.
2. **Parla o scrivi**: Tocca l'**icona del microfono** e chiedi cosa indossare (es.: *"Cosa posso indossare per un pranzo di lavoro all'aperto con la pioggia?"* o *"Suggerisci un look formale ma moderno"*).
3. **Ascolta i consigli vocali**: Lo stylist risponde a voce e mostra le schede degli outfit abbinati. Tocca **Riproduci risposta** per riascoltare l'audio.
4. **Funzione Shuffle**: Vuoi scoprire nuove combinazioni? Tocca la scheda **Shuffle** per rimescolare i tuoi capi e trovare abbinamenti a cui non avevi pensato!
5. **Salva nel diario**: Tocca **Salva nel diario** per pianificare l'outfit sul tuo calendario personale.

## Risultati attesi
Outfit personalizzati e adatti al clima con spiegazioni vocali. Se la tua chiave API personale termina la quota, un banner ti avvertirà che l'IA on-premise di DressApp ha completato la richiesta senza interruzioni.

## Risoluzione dei problemi
- **Il microfono non rileva le parole**: Controlla i permessi del browser per assicurarti che DressApp possa accedere al microfono.
- **Lo stylist suggerisce troppi outfit ripetitivi**: Registra i tuoi outfit quotidiani nel calendario per far sapere allo stylist cosa hai indossato di recente.
- **Avviso "Utilizzo dello Stylist della Piattaforma (Quota Fallback)"**: Appare quando la tua chiave Gemini personale supera i limiti. La richiesta è stata completata con successo dall'IA interna.

## Limitazioni
- Lo stylist consiglia solo capi già presenti e fotografati nel tuo armadio digitale.
- Gli utenti del piano gratuito ricevono 10 crediti di styling giornalieri gratuiti rinnovati ogni 24 ore.
