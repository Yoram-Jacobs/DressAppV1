# Informativa sulla Privacy di DressApp

**Data di entrata in vigore:** 23 settembre 2026  
**Ultimo aggiornamento:** 16 ottobre 2026  
**Versione dell'app:** 1.0.5  
**Sito web ufficiale:** [https://dressapp.co](https://dressapp.co)  
**URL dedicato alla privacy:** [https://dressapp.co/privacy](https://dressapp.co/privacy)  

Benvenuti su **DressApp** ("noi", "nostro", "ci" o "l'Applicazione"). DressApp è una piattaforma intelligente di guardaroba digitale, pianificazione dello stile e personal stylist basato su IA sviluppata e gestita da **DressApp Ltd.**

La presente Informativa sulla Privacy illustra in dettaglio come accediamo, raccogliamo, utilizziamo, elaboriamo, archiviamo, divulghiamo, conserviamo e proteggiamo le informazioni personali quando l'utente utilizza la nostra piattaforma web, le applicazioni mobili e i servizi connessi. Si prega di leggere attentamente questo documento. Creando un account o utilizzando DressApp, l'utente dichiara di aver compreso e accettato le pratiche descritte nella presente informativa.

---

## 1. Informazioni che Raccogliamo e a cui Accediamo

Raccogliamo le informazioni fornite direttamente dall'utente, quelle acquisite automaticamente tramite l'interazione con il dispositivo e quelle ottenute attraverso integrazioni autorizzate di terze parti.

### 1.1 Informazioni sull'Account e sull'Identità
- **Credenziali di Autenticazione:** Indirizzo email e password sottoposte a hashing crittografico (con salt tramite bcrypt). Non memorizziamo mai password in chiaro.
- **Dettagli del Profilo:** Nome visualizzato, nome, cognome, numero di telefono (facoltativo), data di nascita (facoltativa) e genere (facoltativo, utilizzato per personalizzare lo styling e la geometria dell'avatar).
- **Dati Demografici e sulle Taglie:** Misure corporee (altezza, peso, torace, vita, fianchi, interno gamba, lunghezza del braccio), preferenza sulla tonalità della pelle e profilo dei capelli (facoltativo) per generare avatar di prova virtuale e consigli accurati sulla vestibilità.
- **Informazioni sulla Posizione:** Città, paese e coordinate geografiche approssimative (latitudine/longitudine) fornite con il consenso dell'utente per recuperare le condizioni meteorologiche locali e offrire consigli quotidiani sugli outfit adatti al meteo.

### 1.2 Guardaroba Digitale, Contenuti Multimediali e Outfit
- **Foto dei Capi:** Immagini dei capi di abbigliamento fotografati o caricati nel guardaroba digitale.
- **Metadati dei Capi:** Categoria dell'articolo (Top, Pantaloni/Gonne, Calzature, Capispalla, Abito, Accessorio), marchio, palette di colori, composizione del tessuto, formalità/codice di abbigliamento, stagione ed etichette sulle condizioni.
- **Outfit e Look:** Abbinamenti di outfit creati dall'utente, look programmati nel calendario e liste per la valigia.
- **Contenuti del Marketplace:** Annunci di articoli creati per la vendita, lo scambio o la donazione, inclusi descrizioni, prezzi richiesti e preferenze di consegna.

### 1.3 Autorizzazioni del Dispositivo
- **Fotocamera:** Utilizzata esclusivamente quando si scattano foto di capi di abbigliamento direttamente all'interno dell'app.
- **Libreria Foto:** Utilizzata esclusivamente quando si sceglie di caricare foto esistenti di capi o avatar del profilo.
- **Notifiche Push:** Utilizzate solo con il permesso dell'utente per inviare promemoria giornalieri sugli outfit, aggiornamenti dell'assistente valigia e importanti avvisi di sicurezza.

---

## 2. Dati Utente Google e Informativa sull'Utilizzo Limitato (Limited Use)

DressApp offre integrazioni facoltative con Google per facilitare l'accesso degli utenti e la pianificazione personalizzata. Questa sezione descrive in modo esplicito a quali dati utente Google si accede, come vengono utilizzati e archiviati e la nostra conformità ai rigorosi standard sulla privacy di Google.

> ### Politica sui Dati Utente dei Servizi API di Google — Dichiarazione di Utilizzo Limitato
> **L'utilizzo e il trasferimento da parte di DressApp a qualsiasi altra app delle informazioni ricevute dalle API di Google rispetteranno la [Politica sui Dati Utente dei Servizi API di Google](https://developers.google.com/terms/api-services-user-data-policy), inclusi i requisiti di Utilizzo Limitato (Limited Use).**

### 2.1 A Quali Dati Utente Google Accediamo

| Ambito (Scope) API Google | Dati Consultati | Finalità Specifica in DressApp |
|---|---|---|
| `openid`<br>`userinfo.email`<br>`userinfo.profile` | ID utente Google, indirizzo email principale, nome completo e URL dell'immagine avatar del profilo. | Autenticare l'identità dell'utente, creare e proteggere l'account DressApp e mostrare il nome e l'avatar del profilo nella dashboard personale del guardaroba. |
| `https://www.googleapis.com/auth/calendar.events.readonly` | Riepiloghi degli eventi di Google Calendar, orari di inizio/fine, luoghi e descrizioni degli eventi. | Accesso di sola lettura utilizzato esclusivamente dalla funzione AI Stylist per basare i suggerimenti di outfit sugli impegni reali dell'utente (ad es. consigliando abbigliamento formale da lavoro per riunioni in programma, abbigliamento sportivo per l'allenamento o abiti eleganti per eventi serali). |
| `https://www.googleapis.com/auth/user.birthday.read`<br>`https://www.googleapis.com/auth/user.gender.read` | Data di nascita e genere (se presenti nel profilo Google ed esplicitamente autorizzati). | Utilizzati per calibrare gli algoritmi delle taglie dell'avatar corporeo, consigli di stile adatti all'età e raccomandazioni sulla vestibilità. |
| `https://www.googleapis.com/auth/user.phonenumbers.read`<br>`https://www.googleapis.com/auth/user.addresses.read` | Numero di telefono e indirizzo (se presenti nel profilo Google ed esplicitamente autorizzati). | Utilizzati esclusivamente per precompilare gli indirizzi di spedizione per le transazioni sul marketplace e per il recupero dell'account, previa conferma esplicita dell'utente. |

### 2.2 Come Utilizziamo i Dati Utente Google
- I dati utente Google vengono utilizzati **esclusivamente per fornire e migliorare le funzionalità rivolte all'utente** dell'applicazione DressApp (autenticazione, configurazione del profilo utente e consigli di outfit basati sugli impegni in calendario).
- Elaboriamo i titoli e gli orari degli eventi di Google Calendar nella memoria temporanea per generare raccomandazioni giornaliere sul guardaroba e liste per la valigia.

### 2.3 Divieti Rigorosi e Tutele sui Dati Utente Google
- **Nessun Addestramento di Modelli:** I dati utente Google e i dati delle API di Google Workspace **NON** vengono utilizzati per sviluppare, migliorare o addestrare modelli di Intelligenza Artificiale (IA) o Apprendimento Automatico (ML) generalizzati o non personalizzati.
- **Nessuna Pubblicità:** **NON** utilizziamo, trasferiamo né divulghiamo i dati utente Google per erogare annunci pubblicitari, inclusa la pubblicità mirata, personalizzata, di retargeting o basata sugli interessi.
- **Nessun Data Broker / Rivendita:** **NON** vendiamo, noleggiamo, concediamo in licenza né scambiamo i dati utente Google con terze parti, broker di dati o rivenditori di informazioni in nessuna circostanza.
- **Nessuna Valutazione del Credito o Prestiti:** I dati utente Google non vengono mai utilizzati per determinare l'affidabilità creditizia o per finalità di concessione di prestiti.
- **Limitazioni all'Accesso Umano:** Dipendenti, collaboratori e sviluppatori **NON** leggono i dati utente Google a meno che:
  1. L'utente non abbia fornito il proprio consenso esplicito e affermativo per una specifica sessione di assistenza tecnica;
  2. Non sia strettamente necessario per indagini di sicurezza (come l'accertamento di abusi, frodi o malware);
  3. Non sia richiesto per adempiere a leggi vigenti o a ordini vincolanti delle autorità; oppure
  4. I dati non siano aggregati e resi anonimi per operazioni tecniche interne.

---

## 3. Come Elaboriamo e Utilizziamo i Dati Generali

Trattiamo le informazioni personali non provenienti da Google sulle seguenti basi giuridiche:

| Attività di Trattamento | Base Giuridica (GDPR / Standard Globali) | Categorie di Dati Utilizzate |
|---|---|---|
| Indicizzazione, catalogazione del guardaroba digitale e creazione di outfit | Necessità contrattuale | Foto dei capi, categorie, colori, metadati |
| Rimozione dello sfondo tramite IA ed estrazione di ritagli trasparenti dei capi | Necessità contrattuale | Fotografie di abbigliamento caricate |
| Consigli di look e consulenza di stile dell'AI Stylist | Legittimo interesse / Consenso | Metadati del guardaroba, preferenze di stile |
| Pianificazione degli outfit in base al meteo | Consenso (autorizzazione alla posizione) | Posizione approssimativa (città/coordinate) |
| Comunicazioni transazionali (avvisi di sicurezza, reimpostazione password) | Necessità contrattuale | Indirizzo email dell'account |
| Transazioni sul marketplace e gestione dei pagamenti | Necessità contrattuale | Token dei fornitori di pagamento (Stripe/PayPal), storico delle transazioni |

---

## 4. Archiviazione dei Dati, Sicurezza e Meccanismi di Protezione

Adottiamo solide misure di sicurezza amministrative, tecniche e fisiche progettate per proteggere i dati sensibili da accessi non autorizzati, alterazioni, divulgazioni o distruzioni:

- **Crittografia in Transito:** Il 100% dei dati trasmessi tra il browser/l'app dell'utente e i nostri server è crittografato utilizzando i moderni protocolli **HTTPS e Transport Layer Security (TLS 1.3 / TLS 1.2)**.
- **Protezione del Database e dello Storage Isolati Self-Hosted:** Tutti i record del database, i metadati del guardaroba, le voci del profilo e le credenziali OAuth crittografate sono archiviati nel **database MongoDB 7.0 on-premises** isolato e autogestito di DressApp, ospitato su storage NVMe dedicato presso **Hetzner Cloud (UE)**, isolato all'interno di una rete privata interna di container senza esposizione pubblica delle porte del database e protetto da crittografia AES-256 per i token sensibili e da backup locali automatizzati.
- **Protezione Crittografica delle Password:** Le password degli utenti sono protette tramite hashing bcrypt con salt univoco per ciascun utente.
- **Controllo degli Accessi:** L'accesso all'infrastruttura di produzione è rigorosamente limitato tramite autenticazione con chiave SSH, autenticazione a più fattori (MFA), controlli di accesso basati sui ruoli (RBAC) secondo il principio del privilegio minimo e registrazione continua di audit (audit logging).

---

## 5. Conservazione e Cancellazione dei Dati

### 5.1 Durata della Conservazione
- Conserviamo i dati personali e i record del guardaroba finché l'account utente DressApp rimane attivo.
- I token di accesso Google OAuth e la cache del calendario vengono conservati esclusivamente finché l'integrazione con Google rimane attiva e autorizzata dall'utente.

### 5.2 Disconnessione delle Integrazioni Google
- È possibile disconnettere il proprio account Google o l'integrazione con Google Calendar in qualsiasi momento direttamente nell'app tramite **Impostazioni → Integrazioni → Disconnetti Google**.
- È inoltre possibile revocare le autorizzazioni concesse a DressApp direttamente tramite le [Impostazioni di sicurezza dell'Account Google](https://myaccount.google.com/permissions).
- Al momento della disconnessione, i token Google OAuth memorizzati e i record degli eventi del calendario nella cache vengono immediatamente eliminati dai nostri sistemi attivi.

### 5.3 Cancellazione dell'Account e Diritto alla Cancellazione (Oblio)
L'utente ha il diritto assoluto di eliminare il proprio account e tutti i dati associati in qualsiasi momento:
- **Eliminazione in-app con un clic:** Accedere a **Impostazioni → Account → Elimina account**.
- **Tramite richiesta via email:** Inviare un'email dall'indirizzo registrato a [dev@dressapp.co](mailto:dev@dressapp.co) con oggetto "Delete My Account" (Elimina il mio account).

L'eliminazione dell'account avvia una cancellazione a cascata immediata e irreversibile su tutti i database, rimuovendo definitivamente:
- Il profilo utente, i dati identificativi e le credenziali di autenticazione;
- Tutti i capi del guardaroba, le fotografie caricate e le immagini scontornate;
- Tutti gli outfit salvati, le voci del lookbook e le liste per la valigia;
- Tutti gli annunci del marketplace e i riferimenti alle transazioni;
- Tutte le cronologie delle conversazioni con l'AI Stylist, gli embedding vettoriali e i token Google.

Tutti i dati vengono completamente distrutti entro 30 giorni dalla richiesta di cancellazione.

---

## 6. Condivisione dei Dati, Divulgazioni e Terze Parti

Non vendiamo, non noleggiamo né scambiamo i dati personali dell'utente. L'archiviazione principale del database e il sistema di visione artificiale di base ("The Eyes") sono gestiti direttamente da DressApp sulla nostra infrastruttura server on-premises isolata e autogestita, senza intermediari SaaS di database di terze parti. Divulghiamo le informazioni esclusivamente a fornitori selezionati di infrastrutture e servizi che ci assistono nella gestione della piattaforma, rigorosamente vincolati da accordi sul trattamento dei dati:

| Fornitore di Servizi | Dati Divulgati | Finalità |
|---|---|---|
| **Hetzner Online GmbH (Infrastruttura UE)** | Volumi server crittografati che ospitano il database MongoDB on-premises autogestito di DressApp, i file multimediali del guardaroba e l'inferenza IA on-premises | Infrastruttura europea dedicata di server privato virtuale (VPS) e storage NVMe (data center UE conforme al GDPR) |
| **Google Cloud Platform / API Google** | Token di autenticazione OAuth, prompt delle richieste di styling | Autenticazione degli utenti e analisi di styling tramite IA Gemini |
| **Stripe / PayPal** | Token delle transazioni di pagamento, metadati di fatturazione | Elaborazione dei pagamenti conforme allo standard PCI (i numeri delle carte non transitano mai sui nostri server) |
| **Resend / Servizio Email Transazionale** | Indirizzo email, nome visualizzato dell'utente | Invio di avvisi di sistema critici e reimpostazione delle password |

---

## 7. Diritti Internazionali sulla Privacy (GDPR, CCPA/CPRA, LGPD, PIPEDA)

A seconda della propria posizione geografica, l'utente gode di specifici diritti di legge in materia di privacy:
- **Diritto di Accesso / Portabilità:** È possibile richiedere una copia completa in formato JSON leggibile da dispositivo automatico di tutti i dati personali in nostro possesso.
- **Diritto di Rettifica:** È possibile aggiornare o correggere qualsiasi informazione personale inesatta in qualsiasi momento nelle impostazioni dell'app.
- **Diritto alla Cancellazione:** È possibile richiedere la cancellazione definitiva dei propri dati personali come indicato nella Sezione 5.
- **Diritto di Limitazione o Opposizione:** È possibile opporsi alla profilazione automatizzata o revocare il consenso per l'elaborazione della posizione o della fotocamera in qualsiasi momento.
- **Non Discriminazione:** Non discrimineremo mai l'utente, né negheremo servizi o modificheremo i prezzi per aver esercitato i propri diritti sulla privacy.

---

## 8. Privacy dei Minori

DressApp è destinata esclusivamente a persone di almeno 16 anni di età (o l'età minima legale per il consenso digitale nella propria giurisdizione). Non sollecitiamo né raccogliamo consapevolmente informazioni personali da minori di 16 anni. Qualora scoprissimo che un minore di 16 anni ci ha fornito informazioni personali, provvederemo a eliminare immediatamente tali dati dai nostri server.

---

## 9. Modifiche alla Presente Informativa sulla Privacy

Potremmo aggiornare periodicamente la presente Informativa sulla Privacy per riflettere modifiche ai nostri servizi, progressi tecnologici o requisiti di legge. In caso di aggiornamenti, modificheremo la data di "Ultimo aggiornamento" in cima alla presente informativa e avviseremo gli utenti tramite un annuncio nell'app o una notifica via email per le modifiche sostanziali. Invitiamo a consultare regolarmente questa pagina.

---

## 10. Informazioni di Contatto e Richieste sulla Protezione dei Dati

Per qualsiasi domanda, dubbio, commento o richiesta riguardante la presente Informativa sulla Privacy o i propri dati personali, è possibile contattare il nostro team per la Protezione dei Dati:

- **Organizzazione:** DressApp Ltd.
- **Contatto Principale per la Privacy:** [dev@dressapp.co](mailto:dev@dressapp.co)
- **Contatto Supporto Utenti:** [lokoprod@gmail.com](mailto:lokoprod@gmail.com)
- **Indirizzo Postale:** DressApp Ltd., 11 Hanoter St, 8442711 Be'er-Sheva, Israele
- **Sito Web Ufficiale:** [https://dressapp.co](https://dressapp.co)
- **URL Dedicato alla Privacy:** [https://dressapp.co/privacy](https://dressapp.co/privacy)

Ci impegniamo a esaminare e risolvere tempestivamente tutte le richieste relative alla privacy entro trenta (30) giorni dal ricevimento.