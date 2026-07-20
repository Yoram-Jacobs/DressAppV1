# Manuale Utente Tecnico Completo di DressApp

Manuale utente completo e guida di riferimento tecnica per l'ecosistema di guardaroba personale DressApp, motore di styling, marketplace circolare e pannelli di amministrazione.

---

## 1. Panoramica e Architettura Tecnologica

DressApp è un gestore di guardaroba personale guidato dall'IA, consulente di stile e marketplace circolare. Aiuta gli utenti a gestire i capi in modo digitale, a scontornarli e taggarli automaticamente, a ricevere consigli sugli outfit basati sul meteo e sul calendario, a scansionare i Passaporti Digitali dei Prodotti (DPP) dell'UE e a scambiare abiti.

### Proposta di Valore Principale
- **Acquisizione Guardaroba Digitale**: Elaborazione di foto scattate o caricate con rimozione automatica dello sfondo, categorizzazione degli abiti e generazione di tag di attributo.
- **Stylist Virtuale IA**: Un agente conversazionale che esamina in contesto il tuo guardaroba, gli eventi di Google Calendar e le previsioni meteo locali per suggerire outfit giornalieri.
- **Marketplace Circolare**: Compravendita, scambio e noleggio sicuro tra privati di abiti per ridurre gli sprechi della fast fashion.
- **Analisi del Costo per Utilizzo (CPW)**: Informazioni dettagliate sul valore di capitalizzazione del guardaroba, sui tassi di utilizzo e sull'ottimizzazione dell'uso.

### Architettura Tecnologica
- **Backend Edge**: Python 3.11 con FastAPI, utilizzando driver asincroni Motor collegati a un cluster MongoDB Atlas.
- **Frontend SPA**: Single-Page Application in React 19 che utilizza store personalizzati `useSyncExternalStore` (`stylistStore`, `dailySuggestionsStore`, `useOutfitStore`, `useClosetStore`, `useSuitcaseStore`), Tailwind CSS, primitive Shadcn/UI e `react-i18next` con supporto per 12 lingue.
- **Ottimizzazione di Stato e Rete**: Deduplicazione delle richieste in corso, caching degli store per 15 minuti e rivalidazione della scheda al cambio di `visibilitychange`, generando zero richieste GET in background a riposo.
- **Machine Learning Locale e Taglie**: Scontornamento dello sfondo su CPU locale tramite U2-Net (`rembg`), analisi degli abiti con SegFormer-b2, embedding Fashion-CLIP e modello di regressione delle misurazioni corporee ANSUR II (`body_predictor.py`). Instradamento opzionale verso container GPU self-hosted (SegFormer-b3 + BiRefNet) per operazioni rapide.
- **STT/TTS Conversazionale**: Fallback di riconoscimento vocale Web Speech lato client in tempo reale, modulazioni multimodali Gemini 2.5 Flash lato server e motori offline Piper/Sherpa-ONNX sul dispositivo.
- **Servizi di Integrazione Esterna**: API OpenWeatherMap per il meteo, Google Calendar OAuth per l'esportazione degli impegni giornalieri, completamento automatico indirizzi OpenStreetMap (Nominatim) e API REST PayPal Subscriptions/Checkout.

---

## 2. Requisiti Preliminari

### Requisiti dell'Ambiente Host
- **Hardware**: VPS con almeno 4 GB di RAM (ad es. Hetzner VPS che ospita l'ambiente di produzione `dressapp.co`).
- **Dipendenze**: Stack Docker & Docker Compose (inclusi backend, frontend e terminazione TLS Caddy).
- **Variabili di Ambiente**: Configurazione delle chiavi API (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_LIVE_CLIENT_ID/SECRET` e token OAuth di Google Calendar).

### Requisiti dell'App Utente
- **Browser Web**: Google Chrome o Apple Safari (necessari per la piena compatibilità con le funzionalità vocali).
- **Autorizzazioni**: Concedere l'autorizzazione per la Fotocamera (per foto dei capi e scansioni QR) e per il Microfono (per conversazioni vocali).
- **Rete**: Connessione attiva per l'elaborazione LLM, con caching IndexedDB che consente la navigazione del catalogo offline.

---

## 3. Istruzioni Passo dopo Passo

### 3.1 Inserimento Capi (Aggiunta Articoli)
PARADIGMI DI INSERIMENTO: Fotografia, Passaporti Digitali dei Prodotti dell'UE e Ricevute Digitali.

#### A. Fotocamera Interattiva e Caricamento File
1. Navigare alla schermata **Aggiungi articolo**.
2. Selezionare **Scatta foto** (avvia la fotocamera nativa del dispositivo) o fare clic su **Carica foto** (apre il selettore di file del sistema operativo).
3. Il client calcola l'hash SHA-256 e l'hash di differenza orizzontale (dHash) dell'immagine nel browser (~100-180 ms) per verificare l'eventuale presenza nel guardaroba esistente.
4. Se viene trovata una corrispondenza, si apre la finestra **Pre-verifica Duplicati** mostrando le anteprime corrispondenti. Selezionare **Ignora** o **Aggiungi comunque**.
5. Una volta accettato, il server avvia uno stream NDJSON. Un riquadro di anteprima segnaposto viene visualizzato entro 5-7 secondi, consentendo di modificare immediatamente i dettagli dell'articolo mentre il backend completa la taggatura.
6. Verificare i tag rilevati automaticamente (colore, tessuto, vestibilità, fantasia, occasione). Se la forma dello scontornamento è errata, modificare il menu a tendina **Categoria**; questo attiva SegFormer per ritagliare automaticamente il capo.
7. Fare clic su **Salva** per mostrare ottimisticamente l'articolo nella griglia dell'armadio all'istante (~16 ms) mentre la generazione delle miniature WebP si conclude in background.

#### B. Scansione dei Passaporti Digitali dei Prodotti (DPP) dell'UE
1. Toccare il pulsante **Scansiona QR (DPP)** nella pagina Aggiungi articolo.
2. Concedere le autorizzazioni per la fotocamera e inquadrare il codice QR stampato sull'etichetta del capo, oppure caricare uno screenshot salvato del codice QR.
3. Il backend risolve l'URL ed esegue i controlli di sicurezza SSRF (bloccando gli intervalli IP privati).
4. Il sistema analizza gli schemi JSON-LD per estrarre marca, composizione dei materiali, tracciabilità della catena di fornitura, impronta di carbonio e istruzioni di lavaggio.
5. Verificare i dati estratti mostrati nel pannello a fisarmonica verde **Dati DPP Verificati** e fare clic su **Salva**.

#### C. Importazione di Ricevute Digitali
1. Aprire la scheda **Importazione Digitale**.
2. Scegliere una modalità secondaria: **Incolla testo**, **Carica immagine**, **Carica PDF** o inserire un **Link Web**.
3. Il backend utilizza modelli visivi multimodali per estrarre i dati della transazione (marca, prezzo, taglia, categoria).
4. I campi analizzati vengono bloccati in base alla ricevuta per proteggerli da future ri-analisi visive. Fare clic su **Salva** per confermare.

---

### 3.2 Stylist Virtuale IA Conversazionale
Descrivi i tuoi dubbi di stile e ricevi consigli sull'outfit a voce senza usare le mani.

1. Navigare alla schermata **Stylist IA**.
2. Fare clic sull'icona del microfono `[Microphone]` nella barra di input della chat.
3. Pronunciare la richiesta (ad es. "Quale maglia si abbina ai miei pantaloni beige per un pranzo all'aperto sotto la pioggia?").
4. Se Web Speech è supportato, la voce viene trascritta in tempo reale nella casella di input. In caso contrario, l'app registra un file WebM e lo carica.
5. Il backend instrada la richiesta vocale al container locale Gemma4 (con fallback sulla trascrizione Gemini 2.5 Flash in caso di assenza di connessione).
6. Lo stylist elabora la cronologia del guardaroba, le previsioni meteo locali e gli eventi del calendario per formulare una proposta di stile.
7. Lo stylist pronuncia la risposta utilizzando profili vocali preselezionati (`puck`, `aoede` o `charon`).
8. Toccare **Riproduci risposta** (o **Riascolta** in modalità ebraica) sulla scheda per riascoltare l'audio.

---

### 3.3 Profilo, Preferenze e Dipendenze dei Sottosistemi
La pagina Profilo funge da pannello di controllo centrale per DressApp. I campi di configurazione influiscono direttamente su prestazioni, instradamento e comportamento dei moduli a valle.

##### Dipendenze e Motivazioni delle Sezioni a Fisarmonica

1. **Stage Foto & Avatar Digitale (`AvatarViewer2D` e `DynamicAvatar`)**
   - **Perché è importante?**: Renderizza la tua identità visiva su tutte le tele di prova utilizzando uno stage a doppia modalità (ritaglio foto del corpo reale segmentato vs manichino vettoriale Bezier 2D dinamico).
   - **Dipendenze del sottosistema**: I ritagli foto vengono scontornati tramite U2-Net (`rembg`) locale e ridimensionati nel browser a un massimo di 1280px con qualità all'82% per rientrare nel limite di 16 MB dei documenti MongoDB. Lo stage applica punti di riferimento calibrati (`top-[14.5%]` da colletto a scollatura, `top-[36.5%]` da cintura a vita, `bottom-[2%]` piano calzature) e un ridimensionamento proporzionale petto/fianchi ($scaleX$). Fare clic su *Rimuovi foto* per tornare all'istante al manichino vettoriale 2D SVG.

2. **Profilo di Stile (Regole di modestia, Dress code)**
   - **Perché è importante?**: Stabilisce i limiti personali per gli outfit consigliati, impedendo all'IA di generare suggerimenti non appropriati.
   - **Dipendenze del sottosistema**: I parametri selezionati (ad es. vincoli di abbigliamento modesto) vengono inseriti direttamente nei prompt di styling per Gemini 2.5 Flash, filtrando i risultati del guardaroba prima che vengano mostrati.

3. **Dettagli (Nome, Telefono, Occupazione)**
   - **Perché è importante?**: Personalizza il tono di comunicazione e instrada gli avvisi di notifica.
   - **Dipendenze del sottosistema**: Il nome dell'utente viene inserito dinamicamente nelle e-mail e nelle notifiche push di sistema. Il numero di telefono serve come registro di riserva per gli avvisi programmati. Il parametro occupazione viene passato al LLM dello stylist e al ranker di personalizzazione Trend Scout per adattare le proposte.

4. **Misurazioni Corporee e Taglie (Modello di Regressione ANSUR II)**
   - **Perché è importante?**: Elimina le incertezze sulle taglie, consentendo il confronto delle taglie con i dettaglianti esterni e una sovrapposizione virtuale precisa.
   - **Dipendenze del sottosistema**: L'inserimento di 4 parametri base (**Altezza**, **Peso**, **Vita**, **Lunghezza piede**) attiva il modello di regressione ANSUR II di scikit-learn (`body_predictor.py`) per stimare automaticamente 6 dimensioni strutturali (*Spalle*, *Torace*, *Fianchi*, *Manica*, *Cavallo*, *Lunghezza esterna*). Le misurazioni vengono interrogate direttamente dagli script di contenuto dell'estensione Chrome **Assistente Acquisti** per leggere le tabelle taglie sui siti partner (Zara, Asos) e consigliare la taglia adatta.

5. **Stile di Vita (Stato, Sesso)**
   - **Perché è importante?**: Adatta i consigli predefiniti e valuta gli algoritmi dei contenuti.
   - **Dipendenze del sottosistema**: La selezione del sesso influisce direttamente sulla logica di classificazione delle schede giornaliere Trend Scout. Se la categoria di una scheda notizie non corrisponde al sesso dell'utente, l'algoritmo applica una penalità di -2.0 punti, declassandola nel feed.

6. **Configurazione IA (Chiavi SaaS, modalità edge, crediti)**
   - **Perché è importante?**: Determina l'instradamento della fatturazione, le prestazioni operative e lo stato di rete offline.
   - **Dipendenze del sottosistema**: Instrada le richieste di generazione di testo/audio. Le impostazioni standard consumano i crediti di sistema DressApp. L'inserimento di chiavi API personali (Google AI Studio, Anthropic, OpenAI) reindirizza gli addebiti sui conti di fatturazione sviluppatore dell'utente. La selezione della modalità edge locale instrada le richieste al container offline Gemma.

7. **Programmatore & Push (Frequenza, sveglia giornaliera, tema di stile)**
   - **Perché è importante?**: Gestisce gli avvisi giornalieri automatici sullo stile.
   - **Dipendenze del sottosistema**: Attiva i processi cron di `APScheduler` sul backend FastAPI. Ogni mattina, invia notifiche push tramite `pywebpush` utilizzando le chiavi VAPID del client, in base ai parametri del tema di stile selezionati.

8. **Google Calendar (Sincronizzazione OAuth, regole di esportazione)**
   - **Perché è importante?**: Collega direttamente il tuo guardaroba con i tuoi impegni reali nel calendario.
   - **Dipendenze del sottosistema**: Autentica tramite Google OAuth. Il programmatore interroga il tuo calendario per identificare gli eventi, formattare gli outfit e inviare gli impegni direttamente sulla tua agenda di Google Calendar.

9. **Servizi di Localizzazione (Tracciamento GPS, precisione meteo)**
   - **Perché è importante?**: Coordina suggerimenti adatti al meteo e filtri per il raggio delle transazioni locali.
   - **Dipendenze del sottosistema**: Attiva la geocodifica inversa di `navigator.geolocation`. Le coordinate vengono inviate all'API OpenWeatherMap per adeguare i consigli dello stylist (ad es. abbigliamento da pioggia in caso di rovesci). Calcola anche le distanze per gli annunci del Marketplace locale e gli esperti (ad es. verifiche del raggio a Lisbona).

10. **Voce e Lingua (Selezione della voce dello stylist virtuale)**
    - **Perché è importante?**: Stabilisce i dizionari di testo locali e le modulazioni vocali.
    - **Dipendenze del sottosistema**: Controlla la lingua attiva per le traduzioni tramite `react-i18next`. La selezione della voce associa i codici BCP-47 (ad es. `he-IL` o `ar-JO`) alle voci di sintesi Web Speech del client o ai modelli Piper TTS offline.

11. **Invita Amici (API di payload di condivisione)**
    - **Perché è importante?**: Fornisce un ciclo virale per l'espansione gratuita dell'armadio.
    - **Dipendenze del sottosistema**: Aggiunge l'ID MongoDB del referente all'URL. Le nuove registrazioni interrogano dinamicamente questo ID e incrementano in modo atomico il `closet_capacity_bonus` del referente di +10 spazi, modificando i limiti in `closet.py`.

---

## 3.4 Dashboard Analisi Guardaroba
Analizza il valore di capitalizzazione del guardaroba, traccia l'utilizzo dei capi e i parametri del costo per utilizzo.

1. Navigare a **Analisi Guardaroba**.
2. **Esaminare le Metriche**:
   - *Valore del Guardaroba*: Somma dinamica dei prezzi di acquisto.
   - *Utilizzo del Guardaroba*: Percentuale di capi indossati almeno una volta.
   - *Costo Medio per Utilizzo (CPW)*: Calcolato come `Price / Wear Count`.
3. **Grafici di Distribuzione**: Cambiare scheda per visualizzare i grafici Recharts:
   - *Tavolozza Colori*: Distribuzione dei codici esadecimali associati.
   - *Materiali*: Percentuali delle composizioni dei tessuti.
   - *Sottocategorie*: Sottocategorie assegnate.
4. **Classifica di Efficienza**: Visualizza i 5 capi con il punteggio Costo per Utilizzo più basso.

---

## 3.5 Tela Outfit & Pianificatore
Crea, sovrapponi ed esamina le proposte di outfit su una tela avatar 2D interattiva.

1. Aprire il pianificatore **Tela Outfit**.
2. **Sovrapposizione Capi Spalla (Doppia Tela)**: Se l'outfit include un capo spalla (ad es. una giacca) sopra una maglia, la pagina mostra due moduli tela verticali: "Con Capospalla" (con la giacca sovrapposta) e "Senza Capospalla" (che rivela la maglia sottostante).
3. **Elementi 2D Interattivi**: Toccare direttamente qualsiasi capo sul corpo dell'avatar. L'app ti reindirizza direttamente alla schermata di dettaglio di quel capo.
4. **Scheda Esamina Metriche**: Fare clic sul pulsante dettagli e scegliere la scheda **Metriche** per visualizzare le barre di avanzamento dei criteri di compatibilità:
   - *Armonia Colori* (armonia neutra)
   - *Compatibilità Fantasie* (prevenzione contrasto fantasie)
   - *Vestibilità Corporea* (corrispondenza taglia)
   - *Abbinamento Meteo* (idoneità stagionale)
   - *Abbinamento Evento* (idoneità all'attività)
   - *Abbinamento Luogo* (verifiche regole di modestia)
5. **Rinomina/Descrivi**: Fare clic sull'icona a forma di Matita per modificare nomi e descrizioni degli outfit.

---

## 3.6 Assistente Valigia
Organizza le tue esigenze di bagaglio per i viaggi senza portare cose superflue.

1. Vai alla pagina **Valigia** e compila il modulo Contesto del Viaggio (destinazione, date inizio/fine, categoria viaggio, eventi in calendario).
2. L'IA genera una lista bagaglio personalizzata e outfit giornalieri in base alla durata del viaggio e alle previsioni meteo.
3. Esamina l'avanzamento dei preparativi. Se manca un articolo importante (ad es. ombrello per la pioggia, costume da bagno per il mare), il sistema ti avvisa e suggerisce abbinamenti dal marketplace o da negozi locali.
4. Usa la casella di chat integrata per perfezionare i suggerimenti (ad es. "Cambia il giorno 2 in abbigliamento informale da sera"). L'assistente modifica la valigia mantenendo invariato il resto della lista.
5. Toccare **Approva Valigia** per finalizzare il piano.

---

## 3.7 Programmatore e Promemoria Push
Imposta avvisi di stile giornalieri per ricevere automaticamente consigli sugli outfit.

1. Aprire **Profilo** e andare su **Programmatore & Push**.
2. Attivare le notifiche, impostare l'orario della notifica giornaliera, la frequenza nei giorni feriali e il tema del focus di stile.
3. Ogni mattina, il processo cron in background (`APScheduler`) controlla le previsioni meteo e invia una notifica push.
4. Toccare la notifica sul dispositivo (o consultare il Centro Notifiche dell'app web) per aprire una finestra di dialogo che mostra 3 suggerimenti di stile.
5. Salvare un suggerimento direttamente nel tuo **Diario del Guardaroba**.

---

## 3.8 Marketplace (Rivendita, Noleggio, Scambio, Donazione)
Partecipa al marketplace di moda circolare tra privati.

- **Creare un Annuncio**: Aprire la pagina di dettaglio di un articolo, selezionare **Modifica Intenzione** e scegliere un'intenzione non privata:
  - *In vendita*: Inserire il prezzo di listino e la valuta (rileva la valuta predefinita in base alle preferenze regionali).
  - *Noleggio*: Impostare la tariffa di noleggio giornaliera e le condizioni di prestito.
  - *Scambio*: Contrassegnare l'articolo come disponibile per lo scambio.
  - *Donazione*: Pubblicare l'articolo gratuitamente.
- **Sincronizzazione di Stato**: Gli annunci si propagano automaticamente nel feed. Il client utilizza `useSyncExternalStore` e il caching IndexedDB per caricare i parametri di ricerca senza latenza.
- **Sandbox di Prova**: Noleggiatori e acquirenti possono testare l'abbinamento di un annuncio con i capi del proprio armadio privato prima di procedere al pagamento.
- **Procedura di Pagamento**:
  - *Acquisto/Noleggio*: Completare la transazione tramite i pulsanti PayPal integrati. I webhook catturati avvisano il venditore, modificano lo stato dell'annuncio in venduto/noleggiato e registrano le transacciones nel registro detraendo la commissione della piattaforma del 7%.
  - *Baratto (Scambio)*: I potenziali scambiatori propongono offerte. L'inserzionista riceve e-mail di conferma per accettare o rifiutare.

---

## 3.9 Dashboard Pannello di Amministrazione
Validazione dello stato del sistema, contabilità finanziaria e gestione degli account utente.

1. Navigare a `/admin` (disponibile per ruoli di amministratore).
2. **Panoramica**: Verificare i volumi lordi e i riepiloghi dei ricavi dalle commissioni della piattaforma. Ispezionare la **Tabella Attività Fornitori** per visualizzare le statistiche di operatività (API Gemini, latenza del servizio meteo e tassi di errore).
3. **Fornitori**: Fare clic su **Verifica Chiave** per inviare un ping diretto all'API Gemini. Attivare l'interruttore **Eyes Vision Override** per instradare l'analisi dell'immagine tra l'endpoint Gemini predefinito e un container locale Gemma.
4. **Utenti**: Visualizzare crediti attivi, ruoli e pagamenti complessivi. Utilizzare azioni dirette per Promuovere o Retrocedere gli utenti.
5. **Annunci**: Visualizzare lo stato degli annunci e attivare/disattivare gli indicatori di attività per sospendere articoli fraudolenti.

---

## 4. Risultati Attesi

- **Acquisizione**: I capi compaiono immediatamente nella griglia dell'armadio (~16 ms). Lo Scontornamento in background restituisce immagini PNG trasparenti e pulite.
- **Badge DPP Verificato**: La scansione di passaporti validi mostra la scheda informativa verde con i dettagli di sostenibilità.
- **Capospalla su Avatar**: I capi spalla vengono visualizzati correttamente sovrapposti sulle maglie nella tela avatar 2D senza coprire cappelli o scarpe.
- **Risposta Vocale**: Gli output di testo dello Stylist Virtuale riproducono l'audio parlato automaticamente con un indicatore di forma d'onda visibile.
- **Abbonamenti**: L'attivazione di Pro rimuove immediatamente l'avviso per il limite di 150 articoli.

---

## 5. Risoluzione dei Problemi

### HTTP 402 Payment Required
- **Problema**: Acquisizione bloccata. È stato raggiunto il limite massimo di base di 150 articoli nel guardaroba.
- **Soluzione**: Andare su Profilo -> Abbonamento e passare a Pro, oppure condividere il link di invito per ottenere +10 spazi per ogni registrazione.

### SSRF Bloccato / Errore DNS su DPP
- **Problema**: L'URL del codice QR del passaporto scansionato non viene analizzato.
- **Soluzione**: Il parser blocca gli indirizzi IP privati (ad es. `127.0.0.1`, `192.168.x.x`) per proteggere i server interni. Assicurarsi che i codici QR puntino a domini pubblici.

### Autorizzazione Fotocamera / Microfono Negata
- **Problema**: L'area di acquisizione/scansione mostra una schermata di errore 'X', o la digitazione vocale non funziona.
- **Soluzione**: Aprire le autorizzazioni del browser, abilitare l'accesso a Fotocamera e Microfono per il dominio e ricaricare la pagina.

### Errore Chat Stylist / Limiti di Frequenza
- **Problema**: La chat mostra errori o si blocca.
- **Soluzione**: Il server gestisce i limiti di frequenza `429` di Gemini e ricade su un algoritmo di selezione del guardaroba basato su regole. Verificare la connessione Internet.

### Memoria Esaurita (OOM) Picchi VPS
- **Problema**: Picchi di CPU/RAM durante i processi di caricamento.
- **Soluzione**: L'acquisizione utilizza blocchi di coda sequenziali per lotti superiori a 5 articoli. Assicurarsi che il server disponga di almeno 4 GB di RAM.

---

## 6. Limitazioni

- **API Web Speech del Browser**: La conversione vocale nativa da voce a testo è limitata a Chrome e Safari; altri browser utilizzano l'inserimento di testo standard.
- **Modulazioni Client Offline**: La sintesi vocale mobile offline Piper ONNX utilizza meno profili vocali rispetto al modello audio Gemini lato server.
- **Vincoli Dimensioni Immagine**: I caricamenti di avatar e profilo vengono compressi localmente nel browser all'82% di qualità per rientrare nel limite dei documenti MongoDB di 16 MB.
- **Ambito Analisi Ricevute**: Ricevute molto sfocate, distorte o scritte a mano potrebbero non consentire l'estrazione dei dati.
