# Acquisizione e Aggiunta di Capi

Digitalizza il tuo guardaroba fisico in pochi secondi grazie alla scansione IA multimodale, alla rimozione intelligente dello sfondo e al completamento automatico delle immagini.

## Panoramica
Carica i tuoi capi tramite scatti dal vivo della fotocamera, caricamenti multipli dalla galleria, codici QR del Passaporto Digitale del Prodotto (DPP) o ricevute digitali (OCR delle fatture). L'IA on-premises integrata rimuove automaticamente gli sfondi, assegna oltre 20 attributi di moda e prepara ritagli di qualità da studio senza richiedere alcuna chiave API.

## Prerequisiti
- Foto chiare e ben illuminate dei capi (selfie allo specchio, foto di outfit a figura intera o capi stesi in piano).
- Autorizzazione di accesso alla fotocamera per scansionare capi fisici e codici QR.
- Ricevute digitali o screenshot di fatture (PDF / PNG / JPEG) per gli acquisti e-commerce.

## Istruzioni passo dopo passo

1. **Scatto e caricamento interattivo**:
   - Tocca **Aggiungi capo** &rarr; seleziona **Scatta foto** o carica una o più foto di outfit dal tuo dispositivo.
   - Il rilevamento duplicati integrato verifica all'istante se hai già caricato lo stesso indumento.
2. **Segmentazione IA e rilevamento multi-capo**:
   - Il modello visivo isola i singoli capi distinti (giacche, top, gonne, pantaloni, calzature, accessori) in un unico passaggio.
3. **Scontorno IA e foto da studio nitide**:
   - La pipeline visiva integrata rimuove automaticamente gli sfondi creando immagini PNG trasparenti e nitide per tutti gli account.
4. **Etichettatura automatica dei metadati**:
   - Gli account del piano Gratuito (Free Tier) utilizzano il motore on-premises **Eyes** di DressApp (attualmente un modello `Qwen 2.5 VL 3B` ottimizzato), mentre gli utenti dei piani **Manager** e **Professional** usufruiscono del modello Cloud veloce (`Google Gemini 3.5 Flash`) per estrarre oltre 20 attributi di moda (colori, composizione dei tessuti, sottocategoria, dress code, marchio e condizioni).
5. **Riparazione fotografica generativa avanzata (Nano Banana)**:
   - Nano Banana ispeziona i capi ritagliati per rilevare occlusioni (borse, mani) e bordi dell'inquadratura, ricostruendo e completando automaticamente il tessuto mancante per ottenere fotografie da studio complete senza alcuna chiave API esterna richiesta.
6. **Ricevute digitali e tag DPP**:
   - Passa a **Importazione digitale** per analizzare le email di conferma d'ordine o le fatture, salvando in modo verificato prezzo d'acquisto e taglie.
   - Tocca **Scansiona QR (DPP)** sull'etichetta per importare i dati sulla filiera del Passaporto Digitale del Prodotto dell'UE e le istruzioni di lavaggio.
7. **Salva nel guardaroba**:
   - Tocca **Salva**. I capi appaiono immediatamente nella griglia del tuo guardaroba.

## Risultati attesi
Ogni capo appare nel tuo guardaroba digitale come una fotografia centrata, pulita e di qualità da studio, completa di attributi di ricerca indicizzati e ricchi tag tassonomici.

## Risoluzione dei problemi
- **Capi tagliati o parziali nelle foto**: Centra bene il capo su uno sfondo a contrasto. Nano Banana può ricostruire automaticamente colletti o orli tagliati.
- **Illuminazione e contrasto**: Per risultati ottimali sui capi scuri, scatta le foto su uno sfondo chiaro a contrasto.
- **Errori OCR sulle ricevute**: Usa il selettore di riquadro interattivo sulle immagini delle ricevute per indicare manualmente le singole righe di prodotto.

## Limitazioni
- I caricamenti multipli ad alta risoluzione (> 5 capi) vengono elaborati tramite code asincrone in background per garantire prestazioni fluide senza timeout del browser.
