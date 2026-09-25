# Acquisizione e aggiunta capi

Digitalizza il tuo guardaroba reale in pochi secondi grazie alla scansione AI multimodale, alla rimozione intelligente dello sfondo e al completamento automatico delle immagini.

## Panoramica
Carica i tuoi capi tramite scatti live della fotocamera, caricamento multiplo dalla galleria, codici QR del Passaporto Digitale del Prodotto (DPP) o scontrini digitali (OCR fatture). L'AI integrata nel server rimuove automaticamente gli sfondi, assegna oltre 20 attributi di moda e prepara foto da studio pulite senza bisogno di alcuna chiave API.

## Prerequisiti
- Foto chiare e ben illuminate dei capi (selfie allo specchio, foto a figura intera o capi stesi in piano).
- Autorizzazione all'accesso alla fotocamera per scansionare capi e codici QR.
- Ricevute digitali o screenshot di fatture (PDF / PNG / JPEG) per gli acquisti online.
- *(Facoltativo)* Una chiave Google Gemini API personale per utilizzare la ricostruzione fotografica generativa di Nano Banana.

## Istruzioni passo-passo

1. **Scatto e caricamento interattivo**:
   - Tocca **Aggiungi capo** &rarr; seleziona **Scatta foto** o carica una o più foto dal tuo dispositivo.
   - Il rilevamento duplicati integrato controlla all'istante se il capo è già presente nel guardaroba.
2. **Segmentazione AI e rilevamento capi multipli**:
   - Il modello visivo isola i singoli capi (giacche, maglie, gonne, pantaloni, calzature, accessori) in un unico passaggio.
3. **Scontorno AI e foto da studio perfette**:
   - La pipeline visiva integrata rimuove automaticamente lo sfondo creando immagini PNG trasparenti e nitide per tutti gli account.
4. **Tagging automatico dei metadati**:
   - L'AI locale estrae oltre 20 caratteristiche di moda (colori, composizione dei tessuti, sottocategoria, dress code, brand e condizioni).
5. **Riparazione fotografica generativa avanzata (Nano Banana)**:
   - Per gli utenti con una chiave Google Gemini API personale, Nano Banana analizza parti coperte o tagliate (borse, mani) e ricostruisce il tessuto mancante per ottenere foto da studio complete.
6. **Ricevute digitali e tag DPP**:
   - Passa a **Importazione digitale** per leggere le fatture e memorizzare prezzo d'acquisto e taglie verificate.
   - Tocca **Scansiona QR (DPP)** sull'etichetta per importare la tracciabilità europea e le istruzioni di lavaggio.
7. **Salva nel guardaroba**:
   - Tocca **Salva**. I capi appaiono immediatamente nella griglia del tuo armadio.

## Risultati attesi
Ogni capo viene archiviato come una fotografia da studio centrata e nitida, arricchita da attributi di ricerca indicizzati e categorie dettagliate.

## Risoluzione dei problemi
- **Capi tagliati nella foto**: Centra bene il capo su uno sfondo a contrasto. Con una chiave API configurata, Nano Banana può completare bordi o colletti tagliati in automatico.
- **Illuminazione e contrasto**: Per capi scuri, scatta le foto su uno sfondo chiaro e contrastato.
- **Errori di lettura dello scontrino**: Usa il selettore interattivo sull'immagine dello scontrino per evidenziare manualmente le righe dei prodotti.

## Limitazioni
- I caricamenti multipli ad alta risoluzione (>5 capi) vengono elaborati in background per garantire la fluidità del browser.
- Il ritocco fotografico fotorealistico Nano Banana richiede una chiave Google Gemini API personale.
