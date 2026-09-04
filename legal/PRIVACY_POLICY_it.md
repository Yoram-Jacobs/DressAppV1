# Informativa sulla Privacy di DressApp

**Data di entrata in vigore:** 27 luglio 2026
**Ultimo aggiornamento:** 27 luglio 2026

Questa Informativa sulla Privacy descrive come DressApp ("noi", "nostro" o "ci") raccoglie, utilizza, archivia, condivide e protegge i suoi dati personali quando utilizza la nostra applicazione di guardaroba digitale e styling.

La preghiamo di leggere attentamente questa informativa. Utilizzando DressApp, accetta le pratiche relative ai dati descritte in questo documento. Se non è d'accordo, non utilizzi l'applicazione.

---

## 1. Informazioni che Raccogliamo

### 1.1 Informazioni sul Account e Profilo
Quando crea un account o si connette tramite accesso sociale, raccogliamo:

- **Indirizzo e-mail** — utilizzato per l'identificazione dell'account, autenticazione e comunicazioni transazionali.
- **Password** — archiviata come hash crittografico; non memorizziamo mai password in testo in chiaro.
- **Nome visualizzato** — il nome pubblico scelto all'interno dell'app.
- **Nome e cognome** — compilati dal profilo Google OAuth o inseriti manualmente; modificabili in qualsiasi momento.
- **Numero di telefono** — facoltativo; utilizzato per il recupero dell'account e le notifiche.
- **Data di nascita** — facoltativa; utilizzata per il filtraggio dei contenuti per età.
- **Sesso** — facoltativo; utilizzato per le raccomandazioni sulle misure corporee e l'avatar.
- **Stato civile** — facoltativo (single, sposato, divorziato, vedovo).
- **Indirizzo** — facoltativo; strutturato come {linea1, linea2, città, regione, paese, CAP}.
- **Lingua e regione preferite** — utilizzate per localizzare l'esperienza dell'app.
- **Voce preferita** — utilizzata per l'output vocale dello stylist AI.
- **Avatar e foto del profilo** — foto del viso e del corpo, archiviate come URL di dati base64 in MongoDB (limitate a ~500 KB ciascuna lato client).
- **Misure corporee** — altezza, peso, petto, vita, fianchi e altre misure utilizzate per la generazione dell'avatar e le raccomandazioni di vestibilità.
- **Profilo dei capelli** — lunghezza, tipo, colore e stile (facoltativo).
- **Posizione di origine** — città, paese e coordinate (lat/long), utilizzata per suggerimenti di outfit basati sul meteo e per il targeting delle campagne.
- **Profilo dello stile e contesto culturale** — le sue preferenze di stile e origine culturale utilizzate per raccomandazioni personalizzate.

### 1.2 Dati del Guardaroba e Multimediali
DressApp è un'applicazione di guardaroba digitale. I seguenti dati sono fondamentali per il funzionamento dell'app:

- **Foto del guardaroba** — immagini dei suoi indumenti caricati. Vengono elaborate nel browser per la rimozione dello sfondo (matting) e successivamente archiviate come URL di dati in MongoDB.
- **Metadati degli indumenti** — categoria (Parte superiore, Parte inferiore, Calzature, Esterno, Vestito, Accessorio), marca, colore, taglia, stagione, tradizione, codice di abbigliamento, genere ed etichette di sotto-categoria.
- **Dati degli outfit** — combinazioni salvate di indumenti del guardaroba.
- **Annunci del marketplace** — se vende o scambia articoli, dettagli dell'annuncio inclusi foto, prezzo e informazioni sulla spedizione.
- **Dati della valigia/lista di imballaggio** — liste di imballaggio per viaggi con articoli, quantità ed etichette di scopo (es. "Trekking / All'aperto").

### 1.3 Autorizzazioni del Dispositivo
DressApp richiede le seguenti autorizzazioni del dispositivo:

- **Fotocamera** — per catturare foto di indumenti direttamente nell'app.
- **Libreria di foto / accesso al file system** — per selezionare foto esistenti da caricare.
- **Geolocalizzazione** — accesso alla posizione approssimativa per ottenere dati meteorologici e suggerire outfit. È possibile negare o revocare questa autorizzazione in qualsiasi momento.
- **Notifiche** — notifiche push opzionali per aggiornamenti delle campagne e suggerimenti dello stylist.

### 1.4 Elaborazione di IA e Apprendimento Automatico
DressApp utilizza l'IA sul dispositivo e sul server per i seguenti scopi:

- **Rimozione dello sfondo (matting)** — le sue foto di indumenti caricate vengono elaborate tramite il pipeline `rembg` / u2netp per estrarre ritagli puliti. Questa elaborazione avviene sul server.
- **Predizione corporea** — il modello SegFormer stima le misure corporee dalle foto di outfit completi.
- **Classificazione degli indumenti** — la classificazione basata su CLIP etichetta gli articoli con categorie, colori e marchi.
- **Raccomandazioni dello stylist** — l'API Google Gemini elabora i dati del suo guardaroba per generare suggerimenti di outfit e consigli di stile.
- **Generazione dell'avatar** — i parametri di forma dell'avatar 3D vengono calcolati dalle misure corporee per la prova virtuale.

**Importante:** Le foto caricate dagli utenti **non** vengono utilizzate per addestrare alcun modello di apprendimento automatico. Vengono elaborate esclusivamente per fornire le funzionalità principali dell'app e non vengono condivise con pipeline di addestramento di modelli.

### 1.5 Dati di Utilizzo e Analisi
Raccogliamo dati di utilizzo aggregati e anonimi per migliorare l'app:

- Modelli di attività e utilizzo delle funzionalità dell'app.
- Dati di interazione con gli articoli (visualizzazioni, modifiche, eliminazioni).
- Identificatori del dispositivo (indirizzo IP, versione del sistema operativo, tipo di browser).
- Analisi delle campagne (impressioni pubblicitarie, clic, visualizzazioni) — collegate agli ID della campagna, non alle identità individuali degli utenti.

**Non** utilizziamo SDK di analisi di terze parti (nessun Mixpanel, Firebase Analytics, Amplitude, Sentry, LogRocket o simili). Tutte le analisi sono gestite internamente.

### 1.6 Dati di Pagamento
Se utilizza le funzionalità di marketplace o abbonamento di DressApp, raccogliamo:

- **Stripe** — ID account Stripe, ID abbonamento e ID delle intenzioni di pagamento. I numeri delle carte di credito non vengono mai archiviati sui nostri server; sono gestiti direttamente da Stripe.
- **PayPal** — e-mail del destinatario PayPal e ID di ordine/cattura.
- **Apple Pay / Google Play** — token di pagamento gestiti dai rispettivi SDK della piattaforma; non archiviamo i dettagli della carta.

### 1.7 Dati di Autenticazione di Terze Parti
- **Google OAuth** — quando effettua l'accesso con Google, riceviamo e archiviamo un token OAuth crittografato (campo `google_oauth`) utilizzato per accedere al suo profilo Google (nome, e-mail, foto) e, opzionalmente, Google Calendar e People API per le funzioni di pianificazione e contatti.

---

## 2. Come Utilizziamo i Suoi Dati

Utilizziamo i suoi dati per i seguenti scopi:

| Scopo | Base giuridica (GDPR) | Tipi di dati |
|---|---|---|
| Fornire le funzionalità principali dell'app (organizzazione del guardaroba, creazione di outfit, generazione dell'avatar) | Necessità contrattuale | Foto del guardaroba, metadati, misure corporee |
| Elaborare la rimozione dello sfondo e il matting degli indumenti | Necessità contrattuale | Foto di indumenti caricati |
| Generare raccomandazioni dello stylist AI | Interesse legittimo | Metadati del guardaroba, profilo dello stile |
| Ottenere dati meteorologici per suggerimenti di outfit | Consenso (autorizzazione alla posizione) | Posizione di origine (approssimativa) |
| Autenticare e gestire gli account utente | Necessità contrattuale | E-mail, hash della password, token OAuth |
| Inviare e-mail transazionali (conferme dell'account, reimpostazione della password, conferme di eliminazione) | Necessità contrattuale | Indirizzo e-mail |
| Elaborare i pagamenti del marketplace | Necessità contrattuale | Token Stripe/PayPal, info di fatturazione |
| Rilevare e prevenire frodi / abusi | Interesse legittimo | Indirizzo IP, identificatori del dispositivo |
| Migliorare la funzionalità dell'app (analisi aggregate) | Interesse legittimo | Dati di utilizzo anonimi |
| Conformarsi agli obblighi legali | Obbligo legale | Tutti i dati secondo quanto richiesto dalla legge |

---

## 3. Archiviazione e Sicurezza dei Dati

### 3.1 Archiviazione
- **Database:** MongoDB Atlas (ospitato nel cloud, livello gratuito M0 o livello a pagamento a seconda del deployment).
- **Immagini:** Le foto del guardaroba sono archiviate come URL di dati codificati in base64 all'interno dei documenti MongoDB. Ogni immagine è limitata a ~500 KB lato client prima del caricamento.
- **Cache dei modelli:** I pesi dei modelli di IA (SegFormer, u2netp) sono archiviati nella cache su volumi Docker persistenti sul server di produzione per evitare scaricamenti ripetuti ad ogni richiesta.
- **Nessun archivio di blob esterno** è utilizzato per le immagini al momento; tutti i dati delle immagini risiedono in MongoDB.

### 3.2 Sicurezza
- Tutti i dati in transito sono crittografati tramite **HTTPS/TLS 1.3**.
- Le password sono archiviate come **hash bcrypt** — mai in testo in chiaro.
- I token Google OAuth sono archiviati crittografati a riposo.
- I dati di pagamento (token Stripe/PayPal) non vengono mai archiviati in testo in chiaro sui nostri server; archiviamo solo ID di riferimento.
- MongoDB Atlas fornisce **crittografia a riposo** e **crittografia in transito** per impostazione predefinita.
- L'accesso al database è limitato all'applicazione backend tramite credenziali della stringa di connessione.

### 3.3 Conservazione dei Dati
- I suoi dati sono conservati per tutta la durata della sua attività.
- Dopo l'eliminazione dell'account (vedi Sezione 5), tutti i dati personali vengono rimossi permanentemente da MongoDB entro 30 giorni.
- I dati di analisi aggregati e anonimi possono essere conservati indefinitamente e non possono essere ricondotti a singoli utenti.

---

## 4. Condivisione dei Dati e Terze Parti

Condividiamo i suoi dati con le seguenti terze parti solo come descritto di seguito:

| Terza parte | Dati condivisi | Scopo |
|---|---|---|
| **MongoDB Atlas** | Tutti i dati utente e immagini del guardaroba | Hosting del database cloud |
| **Google (OAuth)** | E-mail, nome, foto del profilo | Autenticazione e creazione del profilo |
| **Google Calendar API** | Dati degli eventi del calendario (se collegato) | Funzioni di pianificazione dello stylist |
| **Google People API** | Dati dei contatti (se collegato) | Funzioni social |
| **Google Gemini API** | Metadati del guardaroba e descrizioni degli articoli | Raccomandazioni dello stylist AI |
| **Stripe** | Token di pagamento, info di fatturazione | Elaborazione dei pagamenti |
| **PayPal** | Token di pagamento, info di fatturazione | Elaborazione dei pagamenti |
| **Resend / SendGrid** | E-mail e nome | Consegna di e-mail transazionali |

**NON vendiamo i suoi dati personali o le sue foto del guardaroba a intermediari, inserzionisti o aggregatori di dati di terze parti.**

---

## 5. I Suoi Diritti e Cancellazione dell'Account

In base al GDPR (UE/SEE), alla CCPA (California) e ad altre leggi sulla privacy applicabili, ha i seguenti diritti:

### 5.1 Accesso ed Esportazione
Può richiedere una copia di tutti i dati personali che deteniamo su di lei contattandoci (vedere Sezione 6). Forniremo un'esportazione JSON dei dati del suo account, inclusi articoli del guardaroba, outfit e informazioni del profilo.

### 5.2 Correzione
Può aggiornare o correggere le informazioni del suo profilo in qualsiasi momento tramite la pagina Impostazioni dell'app. I campi che può modificare includono: nome visualizzato, nome e cognome, telefono, data di nascita, indirizzo, misure corporee, posizione di origine e preferenze di stile.

### 5.3 Cancellazione (Diritto all'oblio)
Può eliminare il suo account e tutti i dati associati in qualsiasi momento:

- **Nell'app:** Vai su Impostazioni → Account → Elimina account.
- **API:** Inviare una richiesta `POST` a `/api/v1/users/me/delete` (autenticata).

L'eliminazione dell'account attiva una **cancellazione a cascata** su tutte le raccolte:
- Documento utente
- Tutti gli articoli del guardaroba (foto e metadati)
- Tutti gli outfit
- Tutti gli annunci del marketplace
- Tutte le valigie e le liste di imballaggio
- Tutte le sessioni e i messaggi dello stylist
- Tutti i ricaricamenti di crediti e i registri delle transazioni
- Tutti gli embedding (dati generati da IA)
- Tutte le sottoscrizioni di notifiche push

Viene inviata un'e-mail di conferma di eliminazione al suo indirizzo e-mail registrato.

### 5.4 Portabilità dei Dati
Può richiedere i suoi dati in un formato strutturato e leggibile dalla macchina (JSON) in qualsiasi momento. Contattici utilizzando i dettagli della Sezione 6.

### 5.5 Revoca del Consenso
Può revocare il consenso per l'accesso alla posizione, l'accesso alla fotocamera e le comunicazioni di marketing in qualsiasi momento tramite le impostazioni del dispositivo o la pagina Impostazioni dell'app. La revoca del consenso può limitare alcune funzionalità dell'app (es. suggerimenti di outfit basati sul meteo).

### 5.6 Diritto di Opposizione (LGPD Art. 18, GDPR Art. 21)
Sotto la LGPD (Brasile) e il GDPR (UE/SEE), ha il diritto di opporsi all'elaborazione dei suoi dati personali per scopi specifici, tra cui:
- Elaborazione basata sull'interesse legittimo
- Marketing diretto
- Profilazione e decisioni automatizzate (inclusi i suggerimenti dello stylist basati su IA)

Per opporsi, contattici utilizzando i dettagli della Sezione 6.

### 5.7 Trasferimenti Internazionali di Dati
DressApp è un'applicazione internazionale. I suoi dati possono essere trasferiti e elaborati in paesi diversi dal suo paese di residenza, inclusi Israele e gli Stati Uniti. Garantiamo che tutti i trasferimenti siano governati da adeguate garanzie, incluse le Clausole Contrattuali Standard (SCC) quando richiesto dalla legge applicabile.

---

## 6. Informazioni di Contatto

Per richieste relative alla privacy, richieste di accesso ai dati, richieste di cancellazione o per segnalare una preoccupazione sulla privacy, contattaci a:

**E-mail:** dev@dressapp.co
**Indirizzo:** DressApp, 11 Hanoter St, 8442711 Be'er-Sheva, Israele

Risponderemo a tutte le richieste valide entro 30 giorni, come richiesto dalle leggi sulla privacy applicabili incluse GDPR, CCPA, LGPD, PIPEDA e altre normative internazionali sulla protezione dei dati.

Per le Richieste di Accesso dei Soggetti dei Dati (DSAR), includere l'indirizzo e-mail del suo account e una descrizione dei dati che desidera accedere o modificare.

---

## 7. Privacy dei Minori

DressApp non è destinata ai bambini sotto i 16 anni (o l'età del consenso digitale applicabile nella sua giurisdizione, la più alta delle due). Non raccogliamo consapevolmente dati personali da nessuno di età inferiore a questa. Se venissimo a conoscenza che un minore ci ha fornito dati personali, adotteremo misure per eliminarli prontamente.

Se è un genitore o tutore legale e ritiene che suo figlio ci abbia fornito dati personali, la preghiamo di contattarci all'indirizzo dev@dressapp.co e adotteremo provvedimenti immediati.

---

## 8. Conformità Internazionale

DressApp è progettata per funzionare in tutti i paesi. Questa Informativa sulla Privacy è redatta per conformarsi ai seguenti quadri internazionali di protezione dei dati:

| Quadro | Giurisdizione | Disposizioni chiave coperte |
|---|---|---|
| **GDPR** | UE/SEE | Base legale, diritti dell'interessato, contatto DPO, trasferimenti internazionali, notifica delle violazioni |
| **CCPA/CPRA** | California, USA | Diritto di sapere, cancellare, rinunciare alla vendita, non discriminazione |
| **LGPD** | Brasile | Base legale, diritti dell'interessato, DPO, trasferimenti internazionali, consenso |
| **PIPEDA** | Canada | Consenso, accesso, correzione, responsabilità, notifica delle violazioni |
| **POPIA** | Sudafrica | Elaborazione legale, diritti dell'interessato, trasferimento transfrontaliero |
| **PDPA** | Thailandia | Consenso, diritti dell'interessato, trasferimento internazionale |
| **PDPL** | Arabia Saudita | Base legale, diritti dell'interessato, trasferimento internazionale |

Quando la legge di una giurisdizione specifica richiede diritti o protezioni aggiuntivi oltre a quelli descritti in questa politica, tali diritti aggiuntivi si applicano.

---

## 9. Modifiche a Questa Informativa sulla Privacy

Possiamo aggiornare questa Informativa sulla Privacy di tanto in tanto. Notificheremo le modifiche sostanziali tramite:

- Pubblicando l'informativa aggiornata su questa pagina con una "Data di entrata in vigore" rivista.
- Inviando una notifica via e-mail al suo indirizzo e-mail registrato per modifiche significative.
- Visualizzando un avviso nell'app la prossima volta che la apre.

La incoraggiamo a rivedere questa politica periodicamente.

---

## 10. Data di Entrata in Vigore e Legge Applicabile

Questa Informativa sulla Privacy è in vigore a partire dal **27 luglio 2026**.

DressApp è un'applicazione internazionale che opera in tutti i paesi. Questa politica è governata dai principi del **Regolamento Generale sulla Protezione dei Dati (GDPR)** — UE/SEE, il **California Consumer Privacy Act (CCPA)** — Stati Uniti, la **Lei Geral de Proteção de Dados (LGPD)** — Brasile, il **Personal Information Protection and Electronic Documents Act (PIPEDA)** — Canada e altre leggi internazionali applicabili sulla protezione dei dati. In caso di conflitto tra questi quadri, si applicherà lo standard più protettivo per l'utente.

---

## 11. Conformità degli Store di Applicazioni

Questa Informativa sulla Privacy è ospitata pubblicamente su:

**https://dressapp.co/privacy**

È referenziata in:
- **Apple App Store Connect** — Sezione Privacy dell'App
- **Google Play Console** — Sezione Sicurezza dei Dati
- **Impostazioni dell'app** — un collegamento diretto è disponibile nel menu Impostazioni
- **Flusso di onboarding** — un avviso sulla privacy viene mostrato durante la configurazione iniziale dell'account

---

*DressApp rispetta la sua privacy e si impegna per pratiche trasparenti sui dati. Se ha domande su questa politica o su come gestiamo i suoi dati, la preghiamo di contattarci all'indirizzo dev@dressapp.co.*