# Manuale utente tecnico completo di DressApp

<<<<<<< HEAD
Manuale utente completo e guida di riferimento tecnico per l'ecosistema di guardaroba personale DressApp, il motore di styling, il marketplace circolare e i pannelli di amministrazione.
=======
Manuale utente completo e guida di riferimento tecnica per l'ecosistema di guardaroba personale DressApp, il motore di styling, il mercato circolare e i pannelli di amministrazione.
>>>>>>> 227ad69b4d375d333b9fc7004aded4a49d2e2aad

---

## 1. Panoramica & Stack tecnologico

<<<<<<< HEAD
DressApp è un gestore del guardaroba personale, consulente di stile e marketplace circolare basato sull'intelligenza artificiale. Aiuta gli utenti a gestire i capi di abbigliamento in modo digitale, a ritagliarli e taggarli automaticamente, a ricevere consigli sugli outfit adattati al meteo e al calendario, a scansionare i Passaporti Digitali dei Prodotti (DPP) dell'UE e a scambiare capi.

### Proposta di valore principale
- **Inserimento digitale del guardaroba**: Elaborazione di foto scattate o caricate con rimozione automatica dello sfondo, categorizzazione degli abiti e generazione di tag per le caratteristiche del capo.
- **Stilista virtuale AI**: Un agente conversazionale che analizza contestualmente il tuo guardaroba, gli eventi di Google Calendar e le previsioni meteo locali per suggerire outfit quotidiani.
- **Marketplace circolare**: Acquisto, vendita, scambio e noleggio sicuri di vestiti tra utenti (peer-to-peer) per ridurre i rifiuti della moda veloce (fast fashion).
- **Analisi del costo per utilizzo (CPW)**: Informazioni sul valore totale del guardaroba, tassi di utilizzo e ottimizzazione dell'uso.

### Architettura tecnologica
- **Backend Edge**: Python 3.11 con FastAPI, utilizzando driver asincroni Motor collegati a un cluster MongoDB Atlas.
- **Frontend SPA**: Applicazione a pagina singola React 19 che utilizza store personalizzati `useSyncExternalStore` (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, primitive Shadcn/UI e `react-i18next` con supporto per 12 lingue.
- **Ottimizzazione dello stato e della rete**: Deduplicazione delle richieste attive, memorizzazione nella cache dello store per 15 minuti e convalida al cambio di scheda (`visibilitychange`), con conseguente assenza di richieste GET in background quando inattivo.
- **Machine Learning locale & Taglie**: Elaborazione locale su CPU tramite U2-Net (`rembg`) per la rimozione dello sfondo, segmentazione degli abiti SegFormer-b2, embedding Fashion-CLIP e modello di regressione delle misure corporee fisiche ANSUR II (`body_predictor.py`). Facoltativamente, reindirizza a contenitori GPU self-hosted (SegFormer-b3 + BiRefNet) per operazioni rapide.
- **STT/TTS conversazionale**: Riconoscimento vocale lato client (Web Speech API) come fallback, elaborazione audio multimodale sul server con Gemini 2.5 Flash, e motori Piper/Sherpa-ONNX offline integrati sul dispositivo.
- **Servizi di integrazione esterna**: API OpenWeatherMap per il meteo, Google Calendar OAuth per l'esportazione degli impegni giornalieri, OpenStreetMap (Nominatim) per il completamento automatico degli indirizzi e API REST di PayPal per abbonamenti e pagamenti.
=======
DressApp è un gestore di guardaroba personale guidato dall'IA, un consulente di stile e un mercato circolare. Aiuta gli utenti a gestire i capi di abbigliamento digitalmente, a ritagliarli e a taggarli automaticamente, a ricevere consigli sugli outfit sensibili al meteo e al calendario, a scansionare i passaporti digitali dei prodotti dell'UE (DPP) e a scambiare vestiti.

### Proposta di valore fondamentale
- **Inserimento del guardaroba digitale**: Elaborazione di foto scattate o caricate con rimozione automatica dello sfondo, categorizzazione dei vestiti e generazione di tag degli attributi.
- **AI Virtual Stylist**: Un agente conversazionale che esamina contestualmente il tuo guardaroba, gli eventi di Google Calendar e le previsioni del tempo locali per suggerire outfit quotidiani.
- **Mercato circolare (Circular Marketplace)**: Acquisto, vendita, scambio e noleggio sicuro di vestiti peer-to-peer per ridurre i rifiuti della moda veloce.
- **Analisi del costo per utilizzo (CPW)**: Approfondimenti sul valore del guardaroba, sui tassi di utilizzo e sull'ottimizzazione dell'uso.

### Architettura tecnologica
- **Backend Edge**: Python 3.11 con FastAPI, utilizzando driver Motor asincroni connessi a un cluster MongoDB Atlas.
- **Frontend SPA**: Applicazione a pagina singola React 19 che utilizza store personalizzati `useSyncExternalStore` (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, componenti Shadcn/UI e `react-i18next` che supporta 12 lingue.
- **Ottimizzazione dello stato & della rete**: Deduplicazione delle richieste in corso, memorizzazione nella cache del negozio per 15 minuti e revalidazione delle schede in caso di cambio di visibilità (`visibilitychange`), con conseguente assenza di richieste GET in background quando l'app è inattiva.
- **Apprendimento automatico & calcolo delle taglie locali**: Ritaglio dello sfondo locale U2-Net (`rembg`) tramite CPU, analisi dei vestiti SegFormer-b2, incorporazioni Fashion-CLIP e modello di regressione delle misure corporee fisiche ANSUR II (`body_predictor.py`). Facoltativamente, le richieste vengono reindirizzate a contenitori GPU auto-ospitati (SegFormer-b3 + BiRefNet) per operazioni rapide.
- **STT/TTS conversazionale**: Riconoscimento vocale client Web Speech in fallback, modulazioni Gemini 2.5 Flash lato server e motori Piper/Sherpa-ONNX locali sul dispositivo per il funzionamento offline.
- **Servizi di integrazione esterna**: API OpenWeatherMap per il meteo, Google Calendar OAuth per l'esportazione degli orari giornalieri, OpenStreetMap (Nominatim) per la compilazione automatica degli indirizzi e API REST PayPal Subscriptions/Checkout.
>>>>>>> 227ad69b4d375d333b9fc7004aded4a49d2e2aad

---

## 2. Prerequisiti

<<<<<<< HEAD
### Requisiti dell'ambiente host (Server)
- **Hardware**: Server virtuale (VPS) con un minimo di 4 GB di RAM (ad esempio, il VPS Hetzner che ospita l'ambiente di produzione `dressapp.co`).
- **Dipendenze**: Container Docker e Docker Compose (inclusi backend, frontend e terminazione TLS di Caddy).
- **Variables d'ambiente**: Configurazione delle chiavi API (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` e token OAuth di Google Calendar).

### Requisiti dell'applicazione utente
- **Browser Web**: Google Chrome o Apple Safari (necessari per la compatibilità completa delle funzionalità vocali).
- **Permessi**: Concedere l'accesso alla fotocamera (per le foto dei vestiti e la scansione dei codici QR) e al microfono (per la conversazione vocale).
- **Rete**: Connessione attiva per l'elaborazione del LLM, con memorizzazione IndexedDB per consentire la navigazione del catalogo offline.

---

## 3. Istruzioni passo-passo

### 3.1 Inserimento dei capi (Aggiungere articoli)
MODALITÀ DI INSERIMENTO: Fotografia, Passaporti Digitali dei Prodotti e ricevute di acquisto digitali.

#### A. Fotocamera interattiva e caricamento dei file
1. Vai alla schermata **Aggiungi articolo** (Add Item).
2. Seleziona **Scatta foto** (Take Photo) (avvia la fotocamera nativa del dispositivo mobile) o fai clic su **Carica foto** (Upload Photos) (apre il selettore di file del sistema operativo).
3. Il client calcola nel browser il valore SHA-256 e il dHash (horizontal difference-hash) dell'immagine (~100-180 ms) per verificare la presenza di duplicati nel tuo armadio.
4. Se viene trovata una corrispondenza, si apre la **Finestra di dialogo per la verifica dei duplicati** che mostra le anteprime degli articoli corrispondenti. Seleziona **Salta** (Skip) o **Aggiungi comunque** (Add anyway).
5. Una volta accettato, il server avvia un flusso NDJSON. Verrà visualizzata un'anteprima temporanea entro 5-7 secondi, consentendo di modificare i dettagli dell'articolo immediatamente mentre il backend completa il tagging.
6. Verifica i tag rilevati automaticamente (colore, tessuto, vestibilità, motivo, occasione). Se il ritaglio è errato, cambia la **Categoria** dal menu a discesa; questo attiva SegFormer per ritagliare automaticamente il capo.
7. Fai clic su **Salva** (Save) per aggiungere immediatamente l'articolo alla griglia dell'armadio (~16 ms) mentre la generazione della miniatura WebP si conclude in background.

#### B. Scansione dei codici QR del Passaporto Digitale del Prodotto (DPP) dell'UE
1. Tocca il pulsante **Scansiona QR (DPP)** nella pagina Aggiungi articolo.
2. Concedi i permessi della fotocamera e allinea il codice QR stampato sull'etichetta del capo, oppure carica uno screenshot di un codice QR salvato.
3. Il backend risolve l'URL ed esegue controlli di sicurezza SSRF (bloccando intervalli di IP privati).
4. Il sistema analizza gli schemi JSON-LD per estrarre brand, composizione del materiale, tracciabilità della catena di fornitura, impronta di carbonio e linee guida per la cura del capo.
5. Controlla i dati estratti mostrati nel pannello verde **Verified DPP Data** e fai clic su **Salva**.
=======
### Requisiti dell'ambiente server (Host)
- **Hardware**: Server VPS con un minimo di 4 GB di RAM (ad esempio, VPS Hetzner che ospita l'app in produzione `dressapp.co`).
- **Dipendenze**: Docker e Docker Compose (inclusi backend, frontend e terminazione TLS di Caddy).
- **Variabili d'ambiente**: Configurazione delle chiavi API (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` e token Google Calendar OAuth).

### Requisiti dell'app per l'utente
- **Browser web**: Google Chrome o Apple Safari (necessario per la compatibilità totale delle funzioni vocali).
- **Autorizzazioni**: Concedi l'autorizzazione per la fotocamera (per foto di vestiti e scansione di codici QR) e per il microfono (per conversazioni vocali).
- **Rete**: Connessione attiva per l'elaborazione LLM, con memorizzazione IndexedDB locale che consente la navigazione offline del catalogo.

---

## 3. Istruzioni passo passo

### 3.1 Caricamento dei vestiti (Aggiunta di elementi)
METODI DI CARICAMENTO: Fotografia, Pasaporto Digitale del Prodotto dell'UE (DPP) e Ricevute di acquisto digitali.

#### A. Fotocamera interattiva e caricamento dei file
1. Vai alla schermata **Aggiungi elemento** (Add Item).
2. Seleziona **Scatta foto** (avvia la fotocamera nativa) o fai clic su **Carica foto** (apre il selettore dei file).
3. Il client calcola la firma SHA-256 dell'immagine e il dHash nel browser (~100-180 ms) per verificare eventuali duplicati nel guardaroba.
4. Se viene trovato un duplicato, si apre la **finestra di verifica dei duplicati**. Seleziona **Ignora** o **Aggiungi comunque**.
5. Una volta accettato, il server avvia un flusso NDJSON. Una cornice di anteprima temporanea viene visualizzata entro 5-7 secondi, consentendoti di modificare immediatamente i dettagli dell'articolo mentre il backend completa l'etichettatura.
6. Verifica i tag rilevati automaticamente (colore, tessuto, vestibilità, motivo, occasione). Se il ritaglio non è corretto, modifica il menu a discesa **Categoria**; ciò attiverà SegFormer per ritagliare nuovamente il capo.
7. Fai clic su **Salva** per visualizzare immediatamente l'elemento nella griglia del guardaroba (~16 ms) mentre la generazione della miniatura WebP in background si completa.

#### B. Scansione dei passaporti digitali dei prodotti dell'UE (DPP)
1. Premi il pulsante **Scansiona QR (DPP)** nella pagina di aggiunta degli elementi.
2. Concedi le autorizzazioni della fotocamera e allinea il codice QR stampato sull'etichetta del capo, o carica uno screenshot di un codice QR salvato.
3. Il backend risolve l'URL ed esegue controlli di sicurezza SSRF (bloccando intervalli IP privati).
4. Il sistema analizza gli schemi JSON-LD per estrarre il marchio, la composizione dei materiali, la tracciabilità della catena di fornitura, l'impronta di carbonio e le linee guida per la cura.
5. Esamina i dati estratti visualizzati nel pannello a soffietto verde **Dati DPP verificati** e fai clic su **Salva**.
>>>>>>> 227ad69b4d375d333b9fc7004aded4a49d2e2aad

#### C. Importazione di ricevute di acquisto digitali
1. Apri la scheda **Importazione digitale** (Digital Import).
2. Scegli una modalità: **Incolla testo**, **Carica immagine**, **Carica PDF** o inserisci un **Collegamento web**.
<<<<<<< HEAD
3. Il backend utilizza modelli di visione multimodali per estrarre i dati della transazione (marca, prezzo, taglia, categoria).
4. I campi analizzati vengono bloccati per proteggerli da future analisi visive automatiche. Fai clic su **Salva** per confermare.

---

### 3.2 Stilista virtuale interattivo AI
Descrivi le tue esigenze di stile e ricevi consigli sugli outfit a voce e a mani libere.

1. Vai alla schermata **AI Stylist**.
2. Fai clic sull'icona del microfono `[Microphone]` nella barra di digitazione del chat.
3. Fai la tua richiesta a voce (ad esempio: *"Quale maglia si abbina ai miei pantaloni beige per un pranzo all'aperto sotto la pioggia?"*).
4. Se la tecnologia Web Speech è supportata, la tua voce verrà trascritta in tempo reale nel campo di testo. In caso contrario, l'app registra un file WebM e lo carica sul server.
5. Il backend indirizza la query vocale al contenitore locale di Gemma (utilizzando come alternativa la trascrizione di Gemini 2.5 Flash se offline).
6. Lo stilista analizza la cronologia del tuo guardaroba, le previsioni meteo locali e gli eventi del calendario per formulare una proposta di outfit.
7. Lo stilista legge la risposta ad alta voce utilizzando profili vocali predefiniti (`puck`, `aoede` o `charon`).
8. Tocca **Riproduci risposta** (o **Replay** in modalità ebraica) sulla scheda per riascoltare l'audio della risposta.

---

### 3.3 Profilo, preferenze e dipendenze dei subsistemi
La pagina del profilo funge da pannello di controllo centrale per DressApp. I campi di configurazione influiscono direttamente sulle prestazioni, sull'instradamento e sul comportamento dei moduli derivati.

##### Dipendenze e logica delle sezioni dell'accordino

1. **Sezione Foto & Avatar Digitale (`AvatarViewer2D` e `DynamicAvatar`)**
   - **Perché è importante?**: Mostra la tua identità visiva su tutti i canevas di prova utilizzando un sistema a modalità doppia (ritaglio della foto del corpo reale vs manichino dinamico vettoriale SVG 2D).
   - **Dipendenze del subsistema**: Le foto del corpo vengono ritagliate tramite U2-Net locale (`rembg`) e ridotte nel browser a un massimo di 1280px con un 82% di qualità per rientrare nel limite di 16 MB dei documenti di MongoDB. Il canevas applica punti di riferimento calibrati (`top-[14.5%]` dal colletto alla scollatura, `top-[36.5%]` dalla cintura alla vita, e `bottom-[2%]` sul piano delle calzature) e un ridimensionamento proporzionale di petto e fianchi ($scaleX$). Fai clic su *Rimuovi foto* per tornare immediatamente al manichino vettoriale 2D.

2. **Profilo di stile (Regole di pudore, codice di abbigliamento)**
   - **Perché è importante?**: Imposta limiti personali per gli outfit consigliati, evitando che l'IA generi suggerimenti di stile inappropriati.
   - **Dipendenze del subsistema**: I parametri selezionati (ad esempio, limitazioni di abbigliamento modesto) vengono inviati direttamente nelle istruzioni di styling per Gemini 2.5 Flash, filtrando i risultati del guardaroba prima che vengano visualizzati.

3. **Dettagli (Nome, telefono, occupazione)**
   - **Perché è importante?**: Personalizza il tono della comunicazione e instrada gli avvisi delle notifiche.
   - **Dipendenze del subsistema**: Il nome dell'utente viene inserito dinamicamente nelle e-mail e nelle notifiche push del sistema. Il numero di telefono serve come registro di riserva per gli avvisi pianificati. Il parametro dell'occupazione viene inviato al LLM dello stilista e al classificatore di personalizzazione Trend Scout per personalizzare le proposte.

4. **Misure corporee e taglie (Modello di regressione ANSUR II e predittore di taglia)**
   - **Perché è importante?**: Evita di dover indovinare le taglie, consentendo il calcolo automatico delle taglie commerciali, il confronto delle taglie esterne e la superposizione virtuale esatta dei capi.
   - **Dipendenze del subsistema**: L'inserimento di 4 parametri di base (**Altezza**, **Peso**, **Girovita** e **Lunghezza del piede**) attiva il modello di regressione ANSUR II di scikit-learn (`body_predictor.py`) per stimare automaticamente 6 dimensioni strutturali (*Spalle*, *Petto*, *Fianchi*, *Manica*, *Interno gamba*, *Cucitura esterna*).
     - **Traduzione deterministica delle taglie**: Una volta ottenute le misure stimate, il motore del backend le converte in taglie commerciali: **Taglia camicia** (XS-XXL in base al petto), **Taglia pantaloni** (Girovita in pollici), **Taglia scarpe** (standard US Uomini/Donne e standard UE in base a lunghezza del piede e sesso), **Taglia vestito** (US 0-14+ in base a petto, vita e fianchi) e **Taglia reggiseno** (Sottoseno + Coppa in base al petto e al sottoseno stimato).
     - **Autocompilazione**: Queste taglie raccomandate vengono inserite automaticamente nei campi della *Modalità di modifica dettagliata* nel pannello del profilo.
     - **Integrazioni**: Gli script della Chrome Extension **Shopping Assistant** leggono queste misure per analizzare le tabelle delle taglie sui siti web dei partner (Zara, Asos) e consigliare la taglia ottimale.

5. **Stile di vita (Stato, Sesso)**
   - **Perché è importante?**: Personalizza le raccomandazioni predefinite e influenza gli algoritmi di contenuto.
   - **Dipendenze del subsistema**: La selezione del sesso influisce direttamente sulla logica di posizionamento delle schede giornaliere di Trend Scout. Se una categoria non corrisponde al sesso dell'utente, l'algoritmo applica una penalizzazione di -2.0 punti al punteggio, retrocedendola nel feed.

6. **Configurazione AI (Chiavi SaaS, modalità edge, crediti)**
   - **Perché è importante?**: Determina l'addebito delle query, le prestazioni di risposta e lo stato offline della rete.
   - **Dipendenze del subsistema**: Reindirizza le query di generazione di testo e audio. La configurazione standard consuma crediti del sistema DressApp. L'inserimento di chiavi API personali (Google AI Studio, Anthropic, OpenAI) reindirizza i costi direttamente ai conti sviluppatori dell'utente. Selezionare la modalità edge locale reindirizza le query al contenitore Gemma offline.

7. **Pianificatore e notifiche push (Frequenza, sveglia giornaliera, tema di stile)**
   - **Perché è importante?**: Gestisce l'invio automatico delle proposte di stile giornaliere.
   - **Dipendenze del subsistema**: Attiva le attività cron di `APScheduler` sul backend di FastAPI. Ogni mattina, invia notifiche push tramite `pywebpush` utilizzando le chiavi VAPID del browser del client, in linea con il tema di stile selezionato.

8. **Google Calendar (Sincronizzazione OAuth, regole di esportazione)**
   - **Perché è importante?**: Collega il tuo guardaroba direttamente ai tuoi eventi reali in calendario.
   - **Dipendenze del subsistema**: Autenticazione tramite Google OAuth. Il pianificatore controlla il tuo calendario per identificare gli eventi, compone gli outfit e inserisce gli eventi direttamente nella tua agenda di Google Calendar.

9. **Servizi di localizzazione (Tracciamento GPS, precisione meteo)**
   - **Perché è importante?**: Coordina le proposte adatte al meteo e calcola i filtri di distanza per le transazioni locali.
   - **Dipendenze del subsistema**: Attiva la geolocalizzazione inversa di `navigator.geolocation`. Le coordinate vengono inviate all'API di OpenWeatherMap per regolare le raccomandazioni dello stilista (ad esempio, impermeabili in caso di forti piogge). Calcola anche le distanze per gli annunci del mercato locale ed esperti (ad esempio, controlli del raggio a Lisbona).

10. **Voce e lingua (Selezione della voce dello stilista)**
    - **Perché è importante?**: Configura i file di traduzione e le voci di riproduzione audio.
    - **Dipendenze del subsistema**: Controlla la lingua attiva per le traduzioni tramite `react-i18next`. La selezione della voce assegna i codici BCP-47 (come `he-IL` o `ar-JO`) alle voci di sintesi vocale del browser o a modelli Piper TTS offline.

11. **Invita amici (API di referral)**
    - **Perché è importante?**: Offre una via virale per ottenere spazio extra gratis nell'armadio.
    - **Dipendenze del subsistema**: Aggiunge l'ID MongoDB dell'utente mittente all'URL. Le nuove registrazioni leggono questo ID e incrementano automaticamente il valore `closet_capacity_bonus` del mittente di +10 slot, modificando i limiti di capacità in `closet.py`.

---

### 3.4 Pannello di analisi del guardaroba
Analizza il valore totale del guardaroba, traccia la percentuale di utilizzo e il costo per uso dei vestiti.

1. Vai a **Wardrobe Insights**.
2. **Esaminare le metriche**:
   - *Valore del guardaroba (Closet Worth)*: Somma dinamica dei prezzi d'acquisto.
   - *Utilizzo del guardaroba (Closet Utilization)*: Percentuale di vestiti indossati almeno una volta.
   - *Costo medio per uso (CPW)*: Calcolato come `Prezzo / Numero di utilizzi`.
3. **Grafici di distribuzione**: Cambia scheda per vedere le visualizzazioni di Recharts:
   - *Tavolozza colori*: Distribuzione dei codici esadecimali rilevati.
   - *Materiali*: Distribuzione delle percentuali di tessuto.
   - *Sottocategorie*: Distribuzione per sottocategoria.
4. **Classifica dell'efficienza**: Visualizza i 5 vestiti con il costo per uso (CPW) più basso.

---

### 3.5 Canevas degli outfit & Pianificatore
Crea, stratifica e rivedi gli outfit su un canevas di avatar interattivo in 2D.

1. Apri il pianificatore **Outfit Canvas**.
2. **Capati capispalla (Canevas doppio)**: Se il tuo outfit include un capospalla (ad esempio, una giacca) sopra un capo superiore, la pagina mostra due moduli di canevas verticale: "Con capospalla" (mostrando la giacca sovrapposta) e "Senza capospalla" (mostrando il capo inferiore).
3. **Elementi 2D interattivi**: Tocca direttamente un capo sul corpo dell'avatar. L'app ti reindirizzerà allo schermo dei dettagli di quel capo.
4. **Scheda compatibilità**: Fai clic sul pulsante dei dettagli e seleziona la scheda **Metrics** per visualizzare i punteggi di compatibilità:
   - *Armonia cromatica* (abbinamento di colori neutri)
   - *Compatibilità motivi* (prevenzione dell'accoppiamento eccessivo di stampe)
   - *Vestibilità corporea* (taglie compatibili)
   - *Abbinamento meteo* (adeguatezza alla stagione)
   - *Adeguatezza evento* (appropriato per l'attività)
   - *Adeguatezza luogo* (controlli sulle regole di pudore)
=======
3. Il backend utilizza modelli di visione multimodali per estrarre i dati della transazione (marchio, prezzo, taglia, categoria).
4. I campi analizzati vengono bloccati per proteggerli da future rianalisi visive. Fai clic su **Salva** per confermare.

---

## 3.2 AI Virtual Stylist conversazionale
Descrivi i tuoi dilemmi di stile e ricevi consigli sugli outfit a mani libere.

1. Vai alla schermata **AI Stylist**.
2. Fai clic sull'icona del microfono `[Microphone]` nella barra di input della chat.
3. Pronuncia la tua richiesta (ad esempio, "Quale maglia si abbina ai miei pantaloni beige per un pranzo all'aperto piovoso?").
4. Se la funzione Web Speech è supportata, la tua voce viene trascritta in tempo reale nella casella di input. In caso contrario, l'app registra un file WebM e lo carica.
5. Il backend indirizza la richiesta vocale al contenitore locale Gemma4 (tornando alla trascrizione di Gemini 2.5 Flash se il server è offline).
6. Lo stylist analizza lo storico del tuo guardaroba, le previsioni del tempo locali e gli eventi del calendario per formulare una proposta di stile.
7. Lo stylist pronuncia la risposta utilizzando profili vocali predefiniti (`puck`, `aoede` o `charon`).
8. Premi **Riproduci risposta** (o **Replay** in modalità ebraica) sulla scheda per riascoltare l'audio.

---

## 3.3 Profilo, preferenze e dipendenze dei sottosistemi
La pagina del profilo funge da pannello di controllo centrale per DressApp. I campi di configurazione influiscono direttamente sulle prestazioni e sul comportamento dei moduli derivati.

##### Dipendenze e giustificazione delle sezioni a soffietto

1. **Foto & Arena dell'avatar digitale (`AvatarViewer2D` e `DynamicAvatar`)**
   - **Importanza**: Rappresenta la tua identità visiva su tutte le tele di prova utilizzando una scena a doppia modalità (ritaglio di foto reali rispetto a un manichino vettoriale 2D Bezier SVG dinamico).
   - **Dipendenze**: I ritagli di foto sono elaborati tramite U2-Net (`rembg`) locale e ridotti nel browser a un massimo di 1280px a 82% di qualità per rientrare nel limite di 16 MB dei documenti MongoDB. La scena applica repari di posizione calibrati (`top-[14.5%]` da colletto a scollatura, `top-[36.5%]` da cintura a girovita e `bottom-[2%]` per le calzature) e una scala proporzionale petto/fianchi ($scaleX$). Fai clic su *Rimuovi foto* per tornare immediatamente al manichino vettoriale 2D SVG.

2. **Profilo di stile (Regole di modestia, codice di abbigliamento)**
   - **Importanza**: Stabilisce limiti personali per gli outfit raccomandati, impedendo all'IA di generare suggerimenti inappropriati.
   - **Dipendenze**: I parametri selezionati (ad esempio, le restrizioni di abbigliamento modesto) sono trasmessi direttamente ai prompt dello stylist per Gemini 2.5 Flash, filtrando gli elementi del guardaroba prima di mostrarli.

3. **Dettagli personali (Nome, telefono, occupazione)**
   - **Importanza**: Personalizza il tono della comunicazione e orienta gli avvisi di notifica.
   - **Dipendenze**: Il nome dell'utente è analizzato dinamicamente nelle email e nei push di sistema. Il numero di telefono funge da canale di riserva per gli avvisi pianificati. Il parametro dell'occupazione viene inserito nel LLM dello stylist e nel classificatore di Trend Scout per personalizzare le proposte.

4. **Misure del corpo & Taglie (Modello di regressione ANSUR II e calcolatore taglia)**
   - **Importanza**: Elimina i dubbi sulle taglie, consentendo il calcolo automatico delle taglie, il confronto esterno delle taglie e la sovrapposizione virtuale precisa delle taglie.
   - **Dipendenze**: L'inserimento di 4 parametri di base (**Height** (Altezza), **Weight** (Peso), **Waist** (Circonferenza vita), **Foot Length** (Lunghezza del piede)) attiva il modello di regressione ANSUR II di scikit-learn (`body_predictor.py`) per prevedere automaticamente 6 dimensioni strutturali (*Spalle*, *Petto*, *Fianchi*, *Maniche*, *Cucitura interna*, *Cucitura esterna*).
     - **Traduzione deterministica delle taglie**: Una volta previste le misurazioni strutturali, il motore del backend le converte in taglie commerciali: **Taglia camicia** (XS-XXL in base al petto), **Taglia pantaloni** (Vita in pollici), **Taglia scarpe** (Standard USA uomo/donna ed europeo basato sulla lunghezza del piede e sul sesso), **Taglia vestito** (USA 0-14+ basato su petto, vita e fianchi) e **Taglia reggiseno** (Banda + Coppa basati su petto e sottoseno stimato).
     - **Compilazione automatica**: Queste taglie consigliate vengono inserite automaticamente nei campi di *Detailed Edit Mode* all'interno del profilo.
     - **Integrazioni**: Le misure vengono consultate direttamente dall'Assistente per gli acquisti (estensione Chrome) per leggere le tabelle delle taglie sui siti dei partner (Zara, Asos) e consigliare la migliore vestibilità.

5. **Stile di vita (Stato civile, sesso)**
   - **Importanza**: Personalizza le raccomandazioni predefinite e valuta gli algoritmi di contenuto.
   - **Dipendenze**: La selezione del sesso influisce direttamente sull'algoritmo di classificazione delle schede Trend Scout giornaliere. Se la categoria di una scheda di notizie non corrisponde al sesso dell'utente, l'algoritmo applica una penalizzazione di -2.0 punti, ritardando la sua apparizione nel feed.

6. **Configurazione IA (Chiavi SaaS, modalità edge, crediti)**
   - **Importanza**: Determina la fatturazione, le prestazioni operative e lo stato della connessione di rete.
   - **Dipendenze**: Indirizza le richieste di generazione di testo e voce. Le configurazioni standard consumano crediti di sistema DressApp. L'inserimento di chiavi API personali (Google AI Studio, Anthropic, OpenAI) reindirizza i costi ai conti sviluppatore dell'utente. La selezione della modalità edge locale indirizza le query al contenitore locale di Gemma senza connessione Internet.

7. **Pianificatore & Promemoria (Frequenza, allarme giornaliero, tema di stile)**
   - **Importance**: Gestisce l'invio automatico di avvisi di stile giornalieri.
   - **Dipendenze**: Attiva i compiti di `APScheduler` sul backend FastAPI. Ogni mattina, invia notifiche push tramite `pywebpush` utilizzando le chiavi VAPID del client, in conformità con i parametri di stile configurati.

8. **Google Calendar (Sincronizzazione OAuth, regole di esportazione)**
   - **Importanza**: Collega il tuo guardaroba direttamente agli eventi reali del tuo calendario.
   - **Dipendenze**: Richiede l'autenticazione tramite Google OAuth. Il pianificatore consulta il tuo calendario per identificare gli eventi, generare gli outfit ed esportarli direttamente nella tua agenda di Google Calendar.

9. **Servizi di localizzazione (Meteo & coordinate GPS)**
   - **Importanza**: Coordina proposte adatte al meteo e filtri geografici per le transazioni locali.
   - **Dipendenze**: Attiva la geolocalizzazione inversa `navigator.geolocation`. Le coordinate vengono inviate all'API OpenWeatherMap per regolare i consigli dello stylist (ad esempio, indumenti impermeabili per i temporali). Calcola anche le distanze per gli annunci e gli esperti locali.

10. **Voce e lingua (Selezione della voce dello stylist virtuale)**
    - **Importanza**: Determina la lingua dei testi e il profilo vocale.
    - **Dipendenze**: Controlla la lingua attiva per le traduzioni tramite `react-i18next`. La selezione della voce associa codici vocali BCP-47 (ad esempio, `he-IL` o `ar-JO`) alle voci di sintesi vocale del browser o ai modelli locali Piper TTS.

11. **Invita amici (API di condivisione)**
    - **Importanza**: Fornisce un ciclo virale per l'espansione gratuita del guardaroba.
    - **Dipendenze**: Allega l'ID MongoDB del promotore all'URL. Le nuove registrazioni leggono questo ID e aumentano il `closet_capacity_bonus` del promotore di +10 slot in modo automatico, modificando le barriere del limite dell'armadio in `closet.py`.

---

## 3.4 Dashboard delle statistiche del guardaroba
Analizza il valore totale del guardaroba, il tracciamento dell'uso dei vestiti e i parametri CPW.

1. Vai a **Wardrobe Insights**.
2. **Esamina le metriche**:
   - *Valore del guardaroba (Closet Worth)*: Somma dinamica dei prezzi d'acquisto.
   - *Utilizzo del guardaroba (Closet Utilization)*: Percentuale di vestiti nel guardaroba indossati almeno una volta.
   - *Costo medio per utilizzo (CPW)*: Calcolato come `Prezzo / Numero di utilizzi`.
3. **Grafici di distribuzione**: Alterna tra le schede per visualizzare i grafici Recharts:
   - *Tavolozza dei colori*: Distribuzione dei valori esadecimali dei colori nel guardaroba.
   - *Materiali*: Distribuzione percentuale dei tessuti.
   - *Sottocategorie*: Distribuzione delle sottocategorie.
4. **Classifica dell'efficienza**: Visualizza i 5 capi del guardaroba con i valori CPW più bassi.

---

## 3.5 Tela dell'avatar & Pianificatore di outfit
Crea outfit, combina strati e rivedi le proposte sulla tela interattiva dell'avatar 2D.

1. Apri il pianificatore **Outfit Canvas**.
2. **Strati di abbigliamento esterno (Doppia tela)**: Se il tuo outfit include capispalla (ad esempio, una giacca) sopra una maglia, la pagina mostra due tele di avatar verticali: "With Outerwear" (mostra la giacca nello strato esterno) e "Without Outerwear" (mostra la maglia sotto).
3. **Elementi 2D interattivi**: Fai clic direttamente su un indumento sul corpo dell'avatar per passare direttamente alla schermata di dettagli di quell'articolo.
4. **Scheda delle metriche**: Fai clic sul pulsante dei dettagli e scegli la scheda **Metrics** per vedere i criteri di compatibilità:
   - *Armonia dei colori* (combinazione armoniosa).
   - *Compatibilità dei motivi* (prevenzione di conflitti di stampe).
   - *Vestibilità corporea* (vestibilità delle taglie).
   - *Allineamento climatico* (adeguatezza alla stagione).
   - *Allineamento degli eventi* (adeguatezza all'attività).
   - *Allineamento della posizione* (verifica del rispetto delle regole di modestia).
>>>>>>> 227ad69b4d375d333b9fc7004aded4a49d2e2aad
5. **Rinomina/Descrivi**: Fai clic sull'icona della matita per modificare i nomi e le descrizioni degli outfit.

---

<<<<<<< HEAD
### 3.6 Assistente valigia
Organizza la tua valigia per i viaggi senza caricare pesi inutili.

1. Vai alla pagina **Suitcase** e compila il modulo di contesto del viaggio (destinazione, date, tipo di viaggio, eventi di calendario).
2. L'IA genera una lista di cose da portare personalizzata e una pianificazione degli outfit giornalieri in base al meteo della destinazione.
3. Controlla il progresso della valigia. Se manca un articolo importante (ad esempio, ombrello per pioggia, costume da bagno per mare), il sistema ti avvisa e suggerisce alternative dal mercato o negozi locali.
4. Usa la chat integrata per richiedere modifiche (ad esempio, *"Aggiungi un abito da sera formale per la sera 2"*). L'assistente modifica la valigia mantenendo il resto della lista.
5. Tocca **Approva valigia** (Approve Suitcase) per salvare la lista dei bagagli del tuo viaggio.

---

### 3.7 Pianificatore e promemoria push
Imposta avvisi quotidiani di stile per ricevere consigli sugli outfit in modo automatico.

1. Apri **Profile** e vai su **Scheduler & Push**.
2. Attiva le notifiche, imposta un orario quotidiano, la frequenza settimanale e il tema di stile.
3. Ogni mattina, un'attività cron in background (`APScheduler`) controlla il meteo e invia una notifica push.
4. Tocca la notifica sul tuo dispositivo (o visualizza il Centro notifiche del sito web) per aprire una finestra che mostra 3 proposte di stile.
5. Salva una proposta direttamente nel tuo **Diario del guardaroba** (Wardrobe Diary).

---

## 3.8 Mercato (Vendita, Noleggio, Scambio, Donazione)
Partecipa al mercato circolare di moda tra utenti.

- **Creare un annuncio**: Apri la pagina dei dettagli di un capo, seleziona **Modifica intento** (Edit Intent) e scegli un'opzione pubblica:
  - *In vendita (For Sale)*: Inserisci il prezzo e la valuta (rileva la tua valuta predefinita tramite le impostazioni regionali).
  - *Noleggio (Rent)*: Stabilisci la tariffa giornaliera e le condizioni di prestito.
  - *Scambio (Swap)*: Contrassegna l'articolo come disponibile per lo scambio.
  - *Donare (Donate)*: Pubblica l'articolo gratuitamente.
- **Sincronizzazione in tempo reale**: Gli annunci si propagano sul feed istantaneamente. Il browser utilizza `useSyncExternalStore` e la cache di IndexedDB per eseguire ricerche senza ritardi.
- **Camerino virtuale sandbox**: Gli acquirenti e locatari possono provare l'articolo dell'annuncio sul proprio avatar in combinazione con i propri vestiti prima di pagare.
- **Processo di pagamento**:
  - *Acquistare/Noleggiare*: Completa la transazione in modo sicuro con i pulsanti integrati di PayPal. I webhook aggiornano il venditore, modificano lo stato dell'annuncio in venduto/noleggiato e registrano la transazione nel registro al netto della commissione del 7% della piattaforma.
  - *Baratto (Scambio)*: Gli interessati propongono scambi. Il proprietario riceve e-mail di conferma per accettare o rifiutare l'offerta.

---

### 3.9 Pannello di amministrazione
Monitoraggio della disponibilità del sistema, contabilità finanziaria e gestione dei conti utente.

1. Vai a `/admin` (disponibile solo per ruoli amministratore).
2. **Panoramica**: Controlla i volumi lordi e i resoconti delle commissioni della piattaforma. Ispeziona la **Tabella dell'attività dei fornitori** per vedere lo stato delle API (Gemini, latenza del servizio meteo e percentuali di errore).
3. **Fornitori**: Fai clic su **Verifica chiave** (Verify Key) per inviare una richiesta ping all'API di Gemini. Attiva l'interruttore **Eyes Vision Override** per alternare l'analisi delle immagini tra l'endpoint predefinito di Gemini e un contenitore locale di Gemma.
4. **Utenti**: Visualizza crediti attivi, ruoli e totale pagamenti degli utenti. Utilizza azioni dirette per promuovere o declassare gli utenti.
5. **Annunci**: Controlla lo stato delle inserzioni del mercato e disattiva articoli fraudolenti.
=======
## 3.6 Assistente valigia e viaggi
Organizza la tua lista bagagli per i viaggi in modo intelligente ed evita il sovrappeso.

1. Vai alla pagina **Suitcase** e compila il modulo del contesto di viaggio (destinazione, date di inizio/fine, categoria di viaggio, eventi del calendario).
2. L'IA genera una lista bagagli personalizzata e gli outfit quotidiani in base alla durata del viaggio e alle previsioni del tempo locali.
3. Segui i progressi del bagaglio. Se manca un articolo importante (ad esempio, un ombrello per i giorni di pioggia, un costume da bagno per la spiaggia), il sistema ti avverte e ti suggerisce articoli dal mercato o da negozi locali.
4. Utilizza la chat integrata per regolare i suggerimenti (ad esempio, "Cambia il giorno 2 in abbigliamento da sera informale"). L'assistente aggiornerà la valigia e manterrà il resto della lista.
5. Premi **Approve Suitcase** per la conferma finale del tuo piano di imballaggio.

---

## 3.7 Pianificatore & Promemoria giornalieri
Configura promemoria di stile giornalieri per ricevere automaticamente suggerimenti di outfit sul tuo telefono.

1. Apri **Profile** e vai a **Scheduler & Push**.
2. Attiva le notifiche, imposta l'ora di avviso giornaliera, la frequenza dei giorni della settimana e il tema dello stile.
3. Ogni mattina, il compito in background (`APScheduler`) verifica le previsioni del tempo e invia un'allerta push.
4. Premi l'avviso sul tuo cellulare (o accedi al centro notifiche dell'applicazione web) per aprire una finestra con 3 outfit suggeriti.
5. Salva la proposta selezionata direttamente nel tuo diario di abbigliamento **Wardrobe Diary**.

---

## 3.8 Il mercato circolare (Vendita, Noleggio, Scambio, Donazione)
Partecipa al mercato circolare della moda peer-to-peer.

- **Creare un annuncio**: Apri la pagina dei dettagli di un elemento, seleziona **Edit Intent** e scegli un'opzione pubblica:
  - *For Sale* (In vendita): Inserisci prezzo di vendita e valuta (rileva automaticamente la tua valuta locale tramite le preferenze regionali).
  - *Rent* (Noleggio): Stabilisci la tariffa di noleggio giornaliera e le condizioni di prestito.
  - *Swap* (Scambio): Contrassegna l'articolo come disponibile per lo scambio.
  - *Donate* (Donazione): Pubblica l'articolo come regalo senza alcun costo.
- **Sincronizzazione di stato**: Gli annunci vengono pubblicati automaticamente nel feed del mercato. Il client utilizza `useSyncExternalStore` e la cache IndexedDB locale per caricare i risultati di ricerca senza ritardi.
- **Prova virtuale nel sandbox**: Gli acquirenti/locatari possono effettuare una prova virtuale dell'articolo in vendita rispetto ai vestiti nel proprio guardaroba prima di completare la transazione.
- **Elaborazione delle transazioni**:
  - *Acquisto/Noleggio*: Finalizza la transazione tramite i pulsanti PayPal integrati. I webhook in arrivo notificano il venditore, modificano lo stato dell'annuncio in venduto/noleggiato e registrano la transazione nel libro contabile deducendo la commissione della piattaforma del 7%.
  - *Scambio*: Gli interessati propongono offerte di scambio. Il proprietario riceve email di conferma per accettare o rifiutare.

---

## 3.9 Pannello di amministrazione (Admin Panel)
Verifica del funzionamento del sistema, contabilità finanziaria e gestione dei conti degli utenti.

1. Vai a `/admin` (disponibile per gli utenti con ruolo di amministratore).
2. **Panoramica**: Controlla il volume delle transazioni e le entrate derivanti dalle commissioni della piattaforma. Analizza la tabella **Provider Activity Table** per monitorare i tempi di risposta e i tassi di errore dei servizi esterni (API di Gemini, API del meteo).
3. **Fornitori (Providers)**: Fai clic su **Verify Key** per inviare una prova all'API di Gemini. Cambia l'interruttore **Eyes Vision Override** per reindirizzare l'analisi delle immagini tra l'endpoint di Gemini predefinito e un contenitore locale di Gemma.
4. **Utenti**: Visualizza il saldo dei crediti attivi, i ruoli e i pagamenti totali. Utilizza azioni dirette per promuovere o declassare gli utenti.
5. **Annunci (Listings)**: Visualizza lo stato degli annunci e disattiva gli articoli in caso di frode.
>>>>>>> 227ad69b4d375d333b9fc7004aded4a49d2e2aad

---

## 4. Risultati attesi

<<<<<<< HEAD
- **Inserimento capi**: I vestiti compaiono immediatamente nella griglia del tuo armadio (~16 ms). La rimozione dello sfondo fornisce file PNG trasparenti e puliti.
- **Badge DPP Verificato**: La scansione di passaporti di prodotti validi mostra una scheda informativa verde con i dettagli ecologici.
- **Capispalla sull'avatar**: I cappotti e le giacche si mostrano sovrapposti correttamente sopra le maglie nel canevas 2D senza coprire cappelli o scarpe.
- **Risposta vocale**: I testi generati dallo stilista virtuale vengono riprodotti in audio in modo automatico con un indicatore visivo di onda sonora.
- **Abbonamenti**: L'attivazione dell'account Pro rimuove immediatamente l'avviso di limite di 150 articoli.
=======
- **Caricamento**: Gli articoli appaiono immediatamente nella griglia del guardaroba (~16 ms). La rimozione dello sfondo viene eseguita in modo pulito e genera file PNG trasparenti.
- **Verifica DPP**: La scansione di passaporti di prodotti validi mostra una scheda informativa verde con dettagli di sostenibilità.
- **Avatar a strati**: I vestiti esterni sono rappresentati correttamente sopra le maglie sulla tela dell'avatar 2D senza interferire con scarpe o cappelli.
- **Risposta vocale**: I testi di risposta dell'AI Stylist vengono letti automaticamente e sono accompagnati da un indicatore di onda sonora visivo.
- **Abbonamenti**: L'aggiornamento a un piano Manager o Professional rimuove immediatamente il messaggio di avviso del limite di capacità del guardaroba.
>>>>>>> 227ad69b4d375d333b9fc7004aded4a49d2e2aad

---

## 5. Risoluzione dei problemi

### HTTP 402 Payment Required
<<<<<<< HEAD
- **Problema**: Caricamento capi bloccato. Hai raggiunto il limite di memorizzazione di 150 abiti per l'account gratuito.
- **Soluzione**: Vai a Profilo -> Abbonamento e passa a Pro, oppure condividi il tuo link di invito per ottenere +10 spazi extra per ogni registrazione completata.

### SSRF bloccato / Errore DNS su DPP
- **Problema**: Errore nell'analisi dell'URL del codice QR del passaporto di prodotto.
- **Soluzione**: Il sistema blocca indirizzi IP privati (ad esempio, `127.0.0.1`, `192.168.x.x`) per proteggere la rete interna. Assicurati che i codici QR puntino a domini pubblici.

### Permesso fotocamera o microfono negato
- **Problema**: La schermata di scatto/scansione mostra un errore con una 'X', o la digitazione vocale non funziona.
- **Soluzione**: Apri i permessi del browser, abilita l'accesso alla fotocamera e al microfono per il dominio e ricarica la pagina.

### Errore nella chat dello stilista / Limiti delle chiamate API
- **Problema**: La chat mostra errori o si blocca.
- **Soluzione**: Il server intercetta i limiti delle chiamate di Gemini (`429`) e passa a un algoritmo alternativo basato su regole per selezionare i vestiti. Verifica la tua connessione Internet.

### VPS saturo (Out of Memory - OOM)
- **Problema**: Picchi di utilizzo di CPU o RAM durante il caricamento delle foto.
- **Soluzione**: L'inserimento dei capi utilizza code sequenziali per batch superiori a 5 articoli. Assicurati che il server disponga di almeno 4 GB di RAM.
=======
- **Problema**: Caricamento degli elementi bloccato. Hai raggiunto il limite di base del guardaroba di 50 elementi (o fino a 200 elementi con i bonus di referral).
- **Soluzione**: Vai alla **pagina dei prezzi** (`/pricing`) e abbonati al piano Manager o Professional, o condividi il tuo link di referral per ottenere +10 slot per registrazione (fino a un massimo di 200 articoli).

### SSRF Blocked / DNS Error su DPP
- **Problema**: Errore durante l'analisi dell'URL del codice QR del passaporto del prodotto scansionato.
- **Soluzione**: L'analizzatore blocca gli indirizzi IP privati (come `127.0.0.1` e `192.168.x.x`) per proteggere i server interni della piattaforma. Assicurati che i codici QR puntino a domini pubblici.

### Autorizzazione fotocamera / microfono negata
- **Problema**: La finestra di acquisizione/scansione mostra una schermata di errore con una 'X', o la digitazione vocale fallisce.
- **Soluzione**: Apri le impostazioni delle autorizzazioni del browser, consenti l'accesso alla fotocamera e al microfono per il dominio e ricarica la pagina.

### Chat dello stylist fallita / Limiti di velocità raggiunti
- **Problema**: La chat si blocca o mostra errori.
- **Soluzione**: Il server gestisce gli errori di limite di velocità `429` di Gemini e ricorre a un algoritmo di selezione basato su regole predefinite. Verifica la tua connessione Internet.

### VPS Out of Memory (OOM)
- **Problema**: Carico elevato sulla CPU/memoria del server durante i processi di caricamento dei file.
- **Soluzione**: Il processo di caricamento utilizza una coda sequenziale per i caricamenti di oltre 5 elementi alla volta. Assicurati che il server disponga di almeno 4 GB di RAM disponibili.
>>>>>>> 227ad69b4d375d333b9fc7004aded4a49d2e2aad

---

## 6. Limitazioni

<<<<<<< HEAD
- **APIs Web Speech dei browser**: La sintesi vocale nativa è limitata a Google Chrome e Apple Safari; in altri browser l'app utilizza l'input di testo classico.
- **Sintesi vocale offline**: Il modulo mobile offline Piper ONNX dispone di meno profili di voce rispetto al trattamento audio Gemini del server.
- **Limiti dimensionali delle immagini**: Le immagini del profilo e dell'avatar vengono compresse localmente nel browser a un 82% di qualità per non superare il limite di 16 MB dei documenti in MongoDB.
- **Lettura delle ricevute d'acquisto**: Le ricevute molto sfocate, stropicciate o scritte a mano possono fallire nell'estrazione dei dati.
=======
- **API vocali del browser**: La trascrizione vocale integrata è limitata ai browser Chrome e Safari; altri browser torneranno all'input di testo standard.
- **Output vocale offline**: Il motore locale Piper ONNX sui dispositivi mobili utilizza meno profili vocali rispetto al modello audio Gemini del server.
- **Limiti di dimensione delle immagini**: Le immagini caricate per il profilo o l'avatar vengono compresse localmente nel browser all'82% di qualità per rispettare il limite di 16 MB dei documenti MongoDB.
- **Accuratezza dell'analisi delle ricevute**: Su ricevute molto sfocate, distorte o scritte a mano, l'estrazione dei dati della transazione potrebbe fallire.
>>>>>>> 227ad69b4d375d333b9fc7004aded4a49d2e2aad
