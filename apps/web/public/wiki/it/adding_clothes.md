# Acquisizione e Aggiunta di Vestiti

Digitalizza il tuo guardaroba fisico in pochi secondi grazie al routing automatico a 3 pipeline, alla rimozione intelligente dello sfondo e al completamento generativo delle immagini.

## Panoramica
Aggiungi i vestiti usando scatti dal vivo con la fotocamera, caricamenti multipli dalla galleria (inclusi lotti misti di capi singoli, outfit indossati e gruppi di abiti), codici QR del Passaporto Digitale del Prodotto (DPP) o ricevute digitali (OCR fatture). L'IA locale integrata rileva automaticamente le caratteristiche di ogni foto, rimuove gli sfondi, assegna oltre 20 attributi moda (inclusi felpe/hoodie e oltre 60 abiti tradizionali e culturali) e prepara ritagli da studio nitidi senza bisogno di chiavi API.

## Prerequisiti
- Foto chiare e ben illuminate dei capi (capi singoli, selfie allo specchio a figura intera, manichini o composizioni flat-lay di più capi).
- Accesso alla fotocamera per scansionare capi fisici e codici QR.
- Ricevute digitali o screenshot di fatture (PDF / PNG / JPEG) per gli acquisti e-commerce.

## Istruzioni Passo-Passo

1. **Caricamento Interattivo e Lotti Misti**:
   - Tocca **Aggiungi capo** → seleziona **Scatta foto** o **Carica foto** per selezionare una o più foto dal dispositivo. Puoi mescolare liberamente nello stesso caricamento foto di capi singoli, outfit completi indossati e pile/gruppi di vestiti senza selezionare alcuna scheda di modalità!
   - Il rilevamento duplicati integrato controlla all'istante se hai già caricato lo stesso capo in precedenza.
2. **Routing Automatico a 3 Pipeline (`GarmentVision`)**:
   - **GarmentVision** ispeziona automaticamente ogni foto e la indirizza alla pipeline corretta:
     - **Capo Singolo (`Single`)**: Isola un singolo capo con scontorno alfa da studio.
     - **Outfit Multi-Capo (`Multi-Garment`)**: Suddivide gli outfit completi indossati da una persona o manichino in schede separate per top, pantaloni/gonne, capispalla, calzature e accessori.
     - **Cluster di Capi (`Mass Cluster`)**: Separa gruppi di vestiti non indossati disposti uno accanto all'altro o appesi a ganci in singoli elementi dell'armadio.
3. **Scontorno IA e Foto Studio Pulite**:
   - La pipeline di visione integrata rimuove automaticamente gli sfondi generando immagini PNG trasparenti e nitide per tutti gli account.
4. **Tagging Automatico di Metadati, Hoodie e Abiti Tradizionali**:
   - Gli account del Piano Gratuito utilizzano il motore locale **Eyes** di DressApp (`Qwen 2.5 VL 3B` ottimizzato), mentre gli abbonati ai piani **Manager** ($10/mese) e **Professional** ($15/mese) usufruiscono del modello Cloud veloce (`Google Gemini 3.5 Flash`) per estrarre oltre 20 attributi moda—distinguendo con precisione **Felpe e Hoodie** da **T-Shirt** e riconoscendo oltre 60 **capi tradizionali e culturali** (Sari, Kimono, Thobe, Kaftan, Hanbok, Cheongsam, Ao Dai, Dirndl, Kilt e altri) in tutte le 13 lingue.
5. **Riparazione Fotografica Generativa Avanzata (Nano Banana)**:
   - Nano Banana ispeziona i capi ritagliati per individuare occlusioni (borse, mani) e bordi tagliati, ricostruendo automaticamente il tessuto mancante in fotografie da studio complete senza chiavi API esterne.
6. **Ricevute Digitali e Tag DPP**:
   - Passa a **Importazione digitale** per analizzare email di conferma d'ordine o fatture, bloccando il prezzo d'acquisto e le taglie verificate.
   - Tocca **Scansiona QR (DPP)** sull'etichetta per importare i dati della filiera e le istruzioni di lavaggio del Passaporto Digitale del Prodotto UE.
7. **Salva nell'Armadio**:
   - Tocca **Salva**. I capi appaiono immediatamente nella griglia del tuo Armadio.

## Risultati Attesi
Ogni capo appare nel tuo guardaroba digitale come una fotografia da studio centrata e pulita, con etichette di categoria/sottocategoria accurate, tag culturali e attributi di ricerca completamente indicizzati.

## Risoluzione dei Problemi
- **Capi Tagliati o Parziali nelle Foto**: Centra bene il capo su uno sfondo contrastante. Nano Banana può ricostruire automaticamente colletti o orli tagliati.
- **Illuminazione e Contrasto**: Per risultati ottimali sui capi scuri, fotografali su sfondi chiari a contrasto.
- **Errori OCR sulle Ricevute**: Usa il selettore a riquadri interattivo sulle immagini delle ricevute per indicare manualmente le singole righe di prodotto.

## Limitazioni
- I caricamenti in blocco ad alta risoluzione (>5 capi) vengono elaborati tramite code asincrone in background per garantire prestazioni reattive senza timeout del browser.
