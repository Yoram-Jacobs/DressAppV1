# Manuale Utente Tecnico Completo di DressApp

Manuale utente completo e guida di riferimento tecnico per l'ecosistema del guardaroba personale DressApp, il motore di styling, il marketplace circolare e i pannelli di amministrazione.

---

## 1. Panoramica e Stack Tecnologico

DressApp è un gestore di guardaroba personale basato su IA, un consulente di stile e un marketplace circolare. Aiuta gli utenti a gestire digitalmente i capi di abbigliamento, scontornarli e taggarli automaticamente, ricevere consigli di outfit basati sul meteo e sul calendario, scansionare i Passaporti Digitali dei Prodotti dell'UE (DPP) e scambiare o vendere capi.

### Proposta di Valore Principale
- **Acquisizione del Guardaroba Digitale**: Elaborazione di foto scattate dal vivo o caricate con rimozione automatizzata dello sfondo, categorizzazione dei capi e generazione di tag degli attributi.
- **AI Virtual Stylist**: Un agente conversazionale che esamina contestualmente il tuo guardaroba, gli eventi di Google Calendar e le previsioni meteo locali per suggerire outfit giornalieri.
- **Marketplace Circolare (Circular Marketplace)**: Acquisto, vendita, scambio e noleggio sicuri di abbigliamento peer-to-peer per ridurre gli sprechi del fast fashion.
- **Analisi del Costo per Utilizzo (CPW)**: Approfondimenti sul valore di capitalizzazione del guardaroba, sui tassi di utilizzo e sull'ottimizzazione dell'uso dei capi.

### Architettura Tecnologica
- **Backend Edge**: Python 3.11 con FastAPI, che utilizza driver asincroni Motor connessi a un database dedicato MongoDB 7.0 on-premises su storage NVMe.
- **Frontend SPA**: Applicazione a pagina singola (SPA) in React 19 che utilizza store personalizzati basati su `useSyncExternalStore` (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, primitive Shadcn/UI e `react-i18next` con supporto per 13 lingue.
- **Ottimizzazione dello Stato e della Rete**: Deduplicazione delle richieste in volo, caching dello store per 15 minuti e rivalidazione della scheda tramite evento `visibilitychange`, garantendo zero richieste GET in background durante l'inattività.
- **Machine Learning Locale e Calcolo delle Taglie**: Scontorno dello sfondo locale su CPU tramite U2-Net (`rembg`), parsing dell'abbigliamento con SegFormer-b2, embedding Fashion-CLIP e modello di regressione delle misure corporee fisiche ANSUR II (`body_predictor.py`). Include il container dedicato on-premises `dressapp-eyes` che esegue un modello ottimizzato `Qwen 2.5 VL 3B` (`Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf` + `mmproj`) sulla porta 7860 per gli utenti del piano Gratuito (Free Tier) e per il fallback automatico delle quote.
- **STT/TTS Conversazionale**: Riconoscimento vocale Web Speech lato client in tempo reale, modulazioni multimodali Gemini lato server e motori offline integrati sul dispositivo Piper/Sherpa-ONNX.
- **Servizi di Integrazione Esterna**: API OpenWeatherMap per il recupero dei dati meteo, Google Calendar OAuth per la sincronizzazione del programma giornaliero, completamento automatico degli indirizzi OpenStreetMap (Nominatim) e API REST PayPal Subscriptions/Checkout.

---

## 2. Prerequisiti

### Requisiti dell'Ambiente Host
- **Hardware**: VPS con almeno 8 GB di RAM (ad es. VPS Hetzner CPX32 che ospita l'ambiente di produzione `dressapp.co`).
- **Dipendenze**: Stack Docker e Docker Compose (inclusi MongoDB 7.0 on-premises, backend, server di inferenza eyes, frontend e terminazione TLS Caddy).
- **Variabili d'Ambiente**: Configurazione delle chiavi API (`GEMINI_API_KEY`, `EYES_API_TOKEN`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` e token Google Calendar OAuth).

### Requisiti dell'App per l'Utente
- **Browser Web**: Google Chrome o Apple Safari (necessari per la piena compatibilità con le funzionalità vocali).
- **Autorizzazioni**: Concedere l'autorizzazione per la Fotocamera (per scatti di abbigliamento e scansioni QR) e per il Microfono (per le conversazioni vocali).
- **IA Multilivello Zero-BYOK**: Gli utenti gratuiti utilizzano il modello on-premises Eyes (`Qwen 2.5 VL 3B`) di DressApp; gli utenti dei piani Manager e Professional usufruiscono del modello Cloud veloce (`Gemini 3.5 Flash`). Non è necessaria alcuna chiave API fornita dall'utente.
- **Rete**: Connessione attiva per l'elaborazione LLM, con caching IndexedDB che garantisce la consultazione offline del catalogo.

---

## 3. Istruzioni Passo dopo Passo

### 3.1 Acquisizione dei Capi (Aggiunta di Articoli)
PARADIGMI DI ACQUISIZIONE: Fotografia, Passaporti Digitali dei Prodotti dell'UE e Ricevute di Commercio Digitale.

#### A. Fotocamera Interattiva, Caricamento Lotti Misti e Routing Automatico a 3 Pipeline
1. Vai alla schermata **Aggiungi capo** (*Add Item*).
2. Seleziona **Scatta foto** (avvia la fotocamera nativa) o fai clic su **Carica foto** (apre il selettore file). Puoi caricare più foto con caratteristiche miste in un unico lotto (capi singoli, outfit completi su persona/manichino e pile/cluster di capi non indossati) senza dover selezionare schede manuali di pipeline.
3. Il client calcola nel browser l'hash SHA-256 e il dHash orizzontale (~100-180 ms) di ogni immagine per verificare eventuali duplicati nel guardaroba.
4. Se viene trovata una corrispondenza, si apre la **Finestra di controllo duplicati** con le anteprime corrispondenti. Seleziona **Salta** (*Skip*) o **Aggiungi comunque** (*Add anyway*).
5. **Routing Automatico a 3 Pipeline (`detect_photo_pipeline`)**: Per ogni foto accettata, `clothing_parser.py` ispeziona le maschere semantiche SegFormer (`face_skin_ratio`, `anatomical_stack`, componenti connesse) e invia automaticamente la foto a:
   - **Pipeline `single`**: Singolo capo isolato con scontorno alfa da studio (`rembg` + intersezione maschera SegFormer).
   - **Pipeline `multi`**: Outfit multi-capo indossato da un modello o manichino, con estrazione separata di top, pantaloni/gonne, capispalla, calzature e accessori.
   - **Pipeline `mass`**: Cluster di capi non indossati, composizioni flat-lay o capi multipli appesi a ganci (`parse_unworn_cluster`), separando le componenti disconnesse ed eseguendo la separazione cromatica watershed proteggendo le stampe grafiche.
6. Il server trasmette frame NDJSON progressivi (`detect`, `field`, `item`, `done`) in pochi secondi, consentendoti di modificare subito i dettagli mentre il backend completa il tagging—inclusa la classificazione precisa tra **Felpe e Hoodie** (*Sweatshirts & Hoodies*) rispetto a **T-Shirt** e oltre 60 **abiti tradizionali e culturali** in tutte le 13 lingue.
7. Verifica i tag rilevati automaticamente (colore, tessuto, vestibilità, fantasia, dress code, occasione). Se la forma del ritaglio non è corretta, modifica il menu a tendina **Categoria**; questo attiva SegFormer per ritagliare nuovamente il capo in automatico.
8. Fai clic su **Salva** per visualizzare immediatamente il capo nella griglia dell'armadio (~16 ms) mentre la generazione di miniature WebP e i completamenti generativi Nano Banana terminano in background.

#### B. Scansione dei Passaporti Digitali dei Prodotti dell'UE (DPP)
1. Tocca il pulsante **Scansiona QR (DPP)** nella pagina Aggiungi capo.
2. Concedi le autorizzazioni per la fotocamera e inquadra il codice QR stampato sull'etichetta del capo, oppure carica lo screenshot di un codice QR salvato.
3. Il backend risolve l'URL ed esegue controlli di sicurezza SSRF (bloccando gli intervalli di indirizzi IP privati).
4. Il sistema analizza gli schemi JSON-LD per estrarre marchio, composizione dei materiali, tracciabilità della filiera, impronta di carbonio e istruzioni per la cura.
5. Esamina i dati estratti mostrati nel pannello a fisarmonica verde **Dati DPP verificati** e fai clic su **Salva**.

#### C. Importazione di Ricevute di Commercio Digitale
1. Apri la scheda **Importazione digitale (Digital Import)**.
2. Scegli una sottomodalità: **Incolla testo**, **Carica immagine**, **Carica PDF** o inserisci un **Link Web**.
3. Il backend utilizza modelli di visione multimodali per estrarre i dati della transazione (marchio, prezzo, taglia, categoria).
4. I campi estratti vengono bloccati tramite ricevuta per proteggerli da future rianalisi visive. Fai clic su **Salva** per confermare.

---

### 3.2 AI Virtual Stylist Conversazionale
Descrivi i tuoi dubbi di stile e ricevi consigli vocali sugli outfit a mani libere.

1. Accedi alla schermata **AI Stylist**.
2. Fai clic sull'icona del microfono `[Microphone]` nella barra di inserimento della chat.
3. Pronuncia la tua richiesta (ad es. "Quale maglia si abbina ai miei pantaloni beige per un pranzo all'aperto sotto la pioggia?").
4. Se Web Speech è supportato, la tua voce viene trascritta dal vivo nella casella di testo. In caso contrario, l'app registra un file WebM e lo carica.
5. Il backend instrada le richieste degli utenti Gratuiti al container on-premises Eyes (`Qwen 2.5 VL 3B` ottimizzato) e quelle degli utenti dei piani Manager e Professional al modello Cloud veloce (`Google Gemini 3.5 Flash`), con fallback automatico su Eyes on-premises in caso di limiti di frequenza cloud.
6. Lo stylist elabora lo storico del tuo guardaroba, le previsioni meteo locali e gli eventi in calendario per formulare una proposta di stile.
7. Lo stylist pronuncia la risposta utilizzando profili vocali preselezionati (`puck`, `aoede` o `charon`).
8. Tocca **Ascolta risposta** (o **Replay** in modalità ebraica) sulla scheda per riascoltare l'audio vocale.

---

### 3.3 Profilo, Preferenze e Dipendenze dei Sottosistemi
La pagina Profilo funge da pannello di controllo principale per DressApp. I campi di configurazione influenzano direttamente le prestazioni, il routing e il comportamento dei moduli a valle.

##### Dipendenze e Razionale delle Sezioni a Fisarmonica

1. **Foto e Palcoscenico dell'Avatar Digitale (`AvatarViewer2D` e `DynamicAvatar`)**
   - **Perché è importante?**: Visualizza la tua identità visiva su tutti i canvas di prova utilizzando una scena a doppia modalità (ritaglio fotografico del corpo reale segmentato rispetto al manichino vettoriale dinamico 2D Bezier SVG).
   - **Dipendenze dei sottosistemi**: I ritagli fotografici vengono scontornati tramite U2-Net (`rembg`) locale e ridimensionati nel browser a un massimo di 1280px all'82% di qualità per rientrare nel limite di 16 MB dei documenti MongoDB. La scena applica punti di riferimento posizionali calibrati (`top-[14.5%]` dal colletto allo scollo, `top-[36.5%]` dalla cintura al punto vita, `bottom-[2%]` per il piano delle calzature) e una scala proporzionale torace/fianchi ($scaleX$). Fai clic su *Rimuovi foto* per tornare istantaneamente al manichino vettoriale 2D SVG.

2. **Profilo di Stile (Regole di sobrietà, codice di abbigliamento)**
   - **Perché è importante?**: Stabilisce confini personali per gli outfit consigliati, impedendo all'IA di generare suggerimenti di stile inappropriati.
   - **Dipendenze dei sottosistemi**: I parametri selezionati (ad es. vincoli di abbigliamento sobrio) vengono inseriti direttamente nei prompt di styling per Gemini 2.5 Flash, filtrando gli output del guardaroba corrispondenti prima che vengano mostrati.

3. **Dettagli (Nome, Telefono, Occupazione)**
   - **Perché è importante?**: Personalizza il tono delle comunicazioni e instrada gli avvisi di notifica.
   - **Dipendenze dei sottosistemi**: Il nome dell'utente viene inserito dinamicamente nelle email e nelle notifiche push di sistema. Il numero di telefono funge da recapito di riserva per gli avvisi programmati. Il parametro dell'occupazione viene passato all'LLM dello stylist e al classificatore di personalizzazione di Trend Scout per adattare le proposte.

4. **Misure Corporee e Taglie (Modello di Regressione ANSUR II e Predittore di Taglie)**
   - **Perché è importante?**: Elimina le incertezze sulle taglie, consentendo il calcolo automatico delle taglie commerciali, il confronto sulle tabelle esterne dei negozi e una sovrapposizione virtuale accurata.
   - **Dipendenze dei sottosistemi**: L'inserimento di 4 parametri di base (**Altezza**, **Peso**, **Vita**, **Lunghezza del piede**) attiva il modello di regressione scikit-learn ANSUR II (`body_predictor.py`) per predire automaticamente 6 dimensioni strutturali (*Spalle*, *Torace*, *Fianchi*, *Manica*, *Interno gamba*, *Lunghezza esterna gamba*).
     - **Conversione Deterministica delle Taglie**: Una volta predette le misure continue, il motore delle taglie del backend le converte dinamicamente in taglie di abbigliamento commerciali: **Taglia Camicia** (XS-XXL in base al torace), **Taglia Pantaloni** (Girovita in pollici), **Numero Scarpe** (standard US Uomo/Donna ed UE basati su lunghezza del piede e genere), **Taglia Abito** (US 0-14+ in base a torace, vita e fianchi) e **Taglia Reggiseno** (Fascia + Coppa basate su torace e sottoseno stimato).
     - **Compilazione Automatica**: Queste taglie commerciali consigliate vengono inserite automaticamente nei campi della *Modalità di modifica dettagliata* all'interno della dashboard del profilo.
     - **Integrazioni**: Le misure vengono interrogate direttamente dagli script di contenuto dell'estensione Chrome **Shopping Assistant** per leggere le tabelle delle taglie sui siti web partner (Zara, Asos) e consigliare la taglia ideale.

5. **Stile di Vita (Stato civile, Sesso)**
   - **Perché è importante?**: Personalizza le raccomandazioni predefinite e assegna un punteggio agli algoritmi dei contenuti.
   - **Dipendenze dei sottosistemi**: La selezione del sesso influisce direttamente sulla logica di classificazione delle schede giornaliere di Trend Scout. Se la categoria di una scheda notizia non corrisponde al sesso dell'utente, l'algoritmo applica una penalità di punteggio pari a -2,0, facendola scendere nel feed.

6. **Routing dei Modelli IA e Piani di Abbonamento (Routing Multilivello Zero-BYOK e Crediti)**
   - **Perché è importante?**: Determina il routing multilivello dei modelli e il consumo dei crediti senza alcuna chiave API utente richiesta.
   - **Dipendenze dei sottosistemi**: Gli utenti del piano Gratuito vengono instradati al container on-premises Eyes (`Qwen 2.5 VL 3B` ottimizzato). Gli abbonati ai piani Manager e Professional vengono instradati al modello Cloud veloce (`Google Gemini 3.5 Flash`), con fallback automatico delle quote verso Eyes on-premises.

7. **Pianificatore e Promemoria Push (Frequenza, sveglia giornaliera, focus di stile)**
   - **Perché è importante?**: Gestisce l'invio automatico di notifiche push giornaliere con proposte di stile.
   - **Dipendenze dei sottosistemi**: Attiva i cron job di `APScheduler` sul backend FastAPI. Ogni mattina invia notifiche push tramite `pywebpush` utilizzando le chiavi VAPID del client, in linea con i parametri di focus di stile selezionati.

8. **Google Calendar (Sincronizzazione OAuth, regole di esportazione)**
   - **Perché è importante?**: Collega direttamente il tuo guardaroba agli impegni reali del tuo calendario.
   - **Dipendenze dei sottosistemi**: Esegue l'autenticazione tramite Google OAuth. Il pianificatore interroga il calendario per identificare gli eventi, compone gli outfit e invia gli eventi di abbigliamento direttamente alla tua agenda di Google Calendar.

9. **Servizi di Localizzazione (Tracciamento GPS, precisione meteo)**
   - **Perché è importante?**: Coordina i suggerimenti adatti al meteo e i filtri del raggio geografico per le transazioni locali.
   - **Dipendenze dei sottosistemi**: Attiva il reverse-geocoding tramite `navigator.geolocation`. Le coordinate vengono inviate all'API OpenWeatherMap per adeguare i consigli dello stylist (ad es. abbigliamento antipioggia in caso di acquazzoni). Calcola inoltre le distanze per gli annunci locali del Marketplace e gli esperti (ad es. controlli sul raggio nell'area di Lisbona).

10. **Voce e Lingua (Selezione della voce dello stylist virtuale)**
    - **Perché è importante?**: Definisce i dizionari di testo localizzati e le modulazioni vocali.
    - **Dipendenze dei sottosistemi**: Controlla la lingua attiva per le traduzioni tramite `react-i18next`. La selezione della voce associa i codici vocali BCP-47 (ad es. `he-IL` o `ar-JO`) alle voci di sintesi Web Speech del client o ai modelli offline Piper TTS.

11. **Invita Amici (API di condivisione referral)**
    - **Perché è importante?**: Fornisce un ciclo virale per l'espansione gratuita del guardaroba.
    - **Dipendenze dei sottosistemi**: Aggiunge l'ID MongoDB del referente all'URL. Le nuove registrazioni interrogano dinamicamente questo ID e incrementano in modo atomico il campo `closet_capacity_bonus` del referente di +10 slot, modificando i controlli di limite in `closet.py`.

---

### 3.4 Dashboard Statistiche del Guardaroba (Wardrobe Insights)
Analizza il valore di capitalizzazione del guardaroba, monitorando l'utilizzo dei capi e i parametri del costo per utilizzo.

1. Accedi a **Statistiche del Guardaroba (Wardrobe Insights)**.
2. **Esamina le Metriche**:
   - *Valore del guardaroba (Closet Worth)*: Somma dinamica dei prezzi di acquisto.
   - *Utilizzo del guardaroba (Closet Utilization)*: Percentuale di capi dell'armadio indossati almeno una volta.
   - *Costo medio per utilizzo (CPW)*: Calcolato come `Prezzo / Numero di utilizzi`.
3. **Grafici di Distribuzione**: Passa tra le schede per visualizzare i grafici Recharts:
   - *Tavolozza colori*: Distribuzione dei codici esadecimali mappati.
   - *Materiali*: Distribuzione percentuale dei tessuti.
   - *Sottocategorie*: Sottocategorie mappate.
4. **Classifica di Efficienza**: Visualizza i primi 5 capi che presentano i punteggi di Costo per Utilizzo più bassi.

---

### 3.5 Outfit Canvas e Pianificatore
Crea, sovrapponi a strati ed esamina le proposte di outfit su un canvas interattivo con avatar 2D.

1. Apri il pianificatore **Outfit Canvas**.
2. **Sovrapposizione Capispalla (Doppio Canvas)**: Se il tuo outfit include un capospalla (ad es. una giacca) sopra un top, la pagina visualizza due moduli canvas verticali: "Con Capospalla" (che mostra la giacca sovrapposta) e "Senza Capospalla" (che mostra il top sottostante).
3. **Elementi 2D Interattivi**: Tocca direttamente qualsiasi capo di abbigliamento sul corpo dell'avatar. L'app ti indirizza subito alla schermata di dettaglio di quel capo.
4. **Scheda Metriche (Metrics)**: Fai clic sul pulsante dei dettagli e scegli la scheda **Metrics** per visualizzare le barre di avanzamento dei criteri di compatibilità:
   - *Armonia dei colori* (armonia cromatica)
   - *Compatibilità delle fantasie* (prevenzione di contrasti tra stampe)
   - *Vestibilità corporea* (corrispondenza delle taglie)
   - *Compatibilità meteo* (adeguatezza alla stagione)
   - *Compatibilità con l'evento* (appropriatezza all'attività)
   - *Compatibilità con il luogo* (controlli sulle regole di sobrietà)
5. **Rinomina / Descrivi**: Fai clic sull'icona della Matita per modificare nomi e descrizioni degli outfit.

---

### 3.6 Assistente Valigia (Suitcase Assistant)
Organizza il necessario per i tuoi viaggi senza riempire eccessivamente i bagagli.

1. Vai alla pagina **Valigia (Suitcase)** e compila il modulo Contesto del Viaggio (destinazione, date di inizio/fine, categoria del viaggio, eventi in calendario).
2. L'IA genera una lista personalizzata per la valigia e gli outfit giornalieri in base alla durata del viaggio e alle previsioni meteo.
3. Controlla l'avanzamento della preparazione. Se manca un articolo importante (ad es. un ombrello per la pioggia, un costume da bagno per la spiaggia), il sistema ti avvisa e suggerisce articoli corrispondenti dal marketplace o dai negozi locali.
4. Usa la casella di chat integrata per perfezionare i suggerimenti (ad es. "Cambia il giorno 2 con un abbigliamento serale casual"). L'assistente modifica la valigia preservando il resto della lista.
5. Tocca **Approva Valigia (Approve Suitcase)** per finalizzare il tuo piano.

---

### 3.7 Pianificatore e Promemoria Push
Imposta avvisi di stile giornalieri per ricevere automaticamente raccomandazioni sugli outfit.

1. Apri **Profilo** e vai su **Pianificatore e Push (Scheduler & Push)**.
2. Attiva le notifiche, imposta un orario di notifica giornaliero, la frequenza settimanale e il tema di stile preferito.
3. Ogni mattina, l'attività pianificata in background (`APScheduler`) controlla le previsioni meteo e invia una notifica push.
4. Tocca la notifica sul tuo dispositivo (o visualizza il Centro Notifiche dell'app web) per aprire una finestra di proposta che mostra 3 suggerimenti di stile.
5. Salva un suggerimento direttamente nel tuo **Diario del Guardaroba (Wardrobe Diary)**.

---

### 3.8 Marketplace (Rivendita, Noleggio, Scambio, Donazione)
Partecipa al marketplace di moda circolare peer-to-peer.

- **Crea un Annuncio**: Apri la pagina di dettaglio di un capo, seleziona **Modifica intenzione (Edit Intent)** e scegli un'opzione non privata:
  - *In vendita (For Sale)*: Inserisci il prezzo di listino e la valuta (rileva la tua valuta predefinita tramite le preferenze di localizzazione regionale).
  - *Noleggio (Rent)*: Imposta la tariffa giornaliera di noleggio e le condizioni di prestito.
  - *Scambio (Swap)*: Contrassegna il capo come aperto al baratto.
  - *Donazione (Donate)*: Pubblica il capo gratuitamente.
- **Sincronizzazione dello Stato**: Gli annunci si propagano automaticamente nel feed. Il client utilizza `useSyncExternalStore` e il caching IndexedDB per caricare i parametri di ricerca a latenza zero.
- **Sandbox di Prova (Try-On Sandbox)**: I locatari e gli acquirenti possono provare virtualmente un articolo in vendita abbinandolo ai capi del proprio guardaroba privato prima di procedere al checkout.
- **Checkout Transazionale**:
  - *Acquisto / Noleggio*: Completa la transazione tramite i pulsanti PayPal integrati. I webhook acquisiti notificano il venditore, aggiornano lo stato dell'annuncio su venduto/noleggiato e registrano le transazioni nel libro mastro al netto della commissione di piattaforma del 7%.
  - *Baratto (Scambio)*: Gli utenti interessati propongono scambi. Chi ha pubblicato l'annuncio riceve email di conferma per accettare o rifiutare.

---

### 3.9 Dashboard del Pannello di Amministrazione
Validazione dell'operatività del sistema, contabilità finanziaria e gestione degli account utente.

1. Accedi a `/admin` (disponibile per i ruoli di amministratore).
2. **Panoramica (Overview)**: Controlla i volumi lordi e i riepiloghi delle entrate derivanti dalle commissioni di piattaforma. Ispeziona la **Tabella Attività Fornitori (Provider Activity Table)** per visualizzare le statistiche di operatività a valle (API Gemini, latenza del servizio meteo e tassi di errore).
3. **Fornitori (Providers)**: Fai clic su **Verifica Chiave (Verify Key)** per inviare un ping diretto all'API Gemini. Attiva o disattiva l'interruttore **Eyes Vision Override** per instradare l'analisi delle immagini tra l'endpoint Gemini predefinito e un container locale.
4. **Utenti (Users)**: Visualizza crediti attivi, ruoli e pagamenti complessivi. Usa le azioni dirette per promuovere o declassare gli utenti.
5. **Annunci (Listings)**: Visualizza gli stati degli annunci e attiva/disattiva i flag per sospendere eventuali articoli fraudolenti.

---

## 4. Risultati Attesi

- **Acquisizione**: I capi popolano immediatamente la griglia del guardaroba (~16 ms). Gli scontorni dello sfondo producono risultati PNG trasparenti e nitidi.
- **Badge DPP Verificato**: La scansione di passaporti validi mostra la scheda informativa verde con i dettagli sulla sostenibilità.
- **Capispalla sull'Avatar**: I capispalla vengono visualizzati correttamente sovrapposti ai top sul canvas dell'avatar 2D senza tagliare copricapi o calzature.
- **Risposta Vocale**: Gli output testuali del Virtual Stylist riproducono automaticamente l'audio parlato con un indicatore visivo della forma d'onda.
- **Abbonamenti**: L'upgrade a un piano Manager o Professional rimuove immediatamente l'avviso relativo al limite di capienza del guardaroba.

---

## 5. Risoluzione dei Problemi

### Errore HTTP 402 Payment Required
- **Problema**: Acquisizione bloccata. Hai raggiunto il limite base di 50 capi nel guardaroba (o fino a 150 capi con i bonus di invito).
- **Soluzione**: Vai alla **pagina Prezzi** (`/pricing`) e abbonati al piano Manager o Professional, oppure condividi il tuo link di invito per ottenere +10 slot per ogni registrazione (fino a un massimo di 150 capi).

### Blocco SSRF / Errore DNS su DPP
- **Problema**: L'URL del passaporto QR scansionato non riesce a essere analizzato.
- **Soluzione**: Il parser blocca gli indirizzi IP privati (ad es. `127.0.0.1`, `192.168.x.x`) per proteggere i server interni. Assicurati che i codici QR puntino a domini pubblici.

### Autorizzazione Fotocamera / Microfono Negata
- **Problema**: Il riquadro di acquisizione/scansione mostra una schermata di errore con una 'X', oppure la digitazione vocale non funziona.
- **Soluzione**: Apri le autorizzazioni del browser, abilita l'accesso a Fotocamera e Microfono per il dominio e ricarica la pagina.

### Errore nella Chat dello Stylist / Limiti di Frequenza
- **Problema**: La chat mostra errori o si blocca.
- **Soluzione**: Il server intercetta i limiti di frequenza `429` di Gemini e passa a un algoritmo di selezione del guardaroba basato su regole o al motore locale Eyes. Verifica la tua connessione Internet.

### Picchi di Memoria Esaurita (OOM) sul VPS
- **Problema**: Picchi di utilizzo CPU/RAM durante i processi di caricamento.
- **Soluzione**: L'acquisizione utilizza blocchi di coda sequenziali per i lotti > 5 articoli. Assicurati che il server disponga di almeno 4 GB di RAM.

---

## 6. Limitazioni

- **API Web Speech del Browser**: La trascrizione nativa Speech-to-Text è limitata a Chrome e Safari; gli altri browser passano all'inserimento di testo standard.
- **Modulazioni Client Offline**: La sintesi vocale mobile offline Piper ONNX utilizza un numero inferiore di profili vocali rispetto al modello audio Gemini lato server.
- **Vincoli sulle Dimensioni delle Immagini**: I caricamenti dell'avatar e del profilo vengono compressi localmente nel browser all'82% di qualità per rientrare nel limite di 16 MB dei documenti MongoDB.
- **Ambito di Analisi delle Ricevute**: Ricevute molto sfocate, distorte o scritte a mano potrebbero non consentire l'estrazione dei dati.
