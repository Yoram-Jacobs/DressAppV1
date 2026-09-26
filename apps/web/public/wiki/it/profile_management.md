# Profilo, Taglie e Configurazione (`/me`)

Gestite misure corporee, tonalità della pelle, ritagli fotografici a figura intera, preferenze di stile, credenziali dei modelli di IA e integrazioni di sistema nella dashboard del vostro profilo personale.

## Panoramica
La pagina **Profilo e Impostazioni** (`https://dressapp.co/me`) funge da centro di controllo principale per il vostro ecosistema DressApp. Raccoglie i parametri antropometrici, il palcoscenico per la prova virtuale con avatar digitale, i vincoli di stile, le preferenze locali, le chiavi dei modelli di IA e i calendari delle notifiche push.

---

## Prerequisiti
- Un account DressApp attivo.
- (Opzionale) Autorizzazione per la fotocamera del dispositivo per il caricamento di foto a figura intera.
- (Opzionale) Autorizzazione alla geolocalizzazione per il targeting delle campagne degli stylist locali, le preferenze culturali e le previsioni meteo.

---

## Guida Passo dopo Passo: Panoramica Completa della Pagina

### 1. Intestazione della Pagina e Barra di Navigazione Esplora
Posizionate nella parte superiore della dashboard `/me`:
- **Intestazione**: Mostra lo stato e il titolo del vostro account.
- **Schede Esplora**: Scorciatoie rapide per le sezioni principali dell'applicazione:
  - **Trend Scout** (`/trends`): Visualizza le notizie quotidiane sulla moda selezionate dall'IA.
  - **Outfit** (`/outfits`): Accedi al calendario degli outfit salvati.
  - **Esperti** (`/experts`): Esplora stylist e sarti locali.
  - **Guardaroba / Statistiche** (`/me/stats`): Consulta il valore del guardaroba, il costo per utilizzo e l'analisi dei colori.

### 2. Scheda Selezione Lingua e Voce
In evidenza per un accesso rapido:
- **Selettore Lingua**: Scegliete tra 12 lingue supportate (*inglese, spagnolo, francese, tedesco, italiano, portoghese, russo, cinese, giapponese, arabo, hindi, ebraico*). La selezione della lingua aggiorna automaticamente l'interfaccia e imposta la voce predefinita regionale del modello Text-to-Speech (TTS).

---

### 3. Scheda Identità e Dati Personali (`ProfileDetailsCard`)

Include 9 pannelli a fisarmonica espandibili per la gestione dei dati personali, delle taglie e del rendering dell'avatar:

#### Pannello A: Identità
- **Nome e Cognome**: Campi di identificazione personale.
- **Indirizzo Email**: Visualizzazione in sola lettura dell'email registrata.
- **Data di Nascita**: Utilizzata per personalizzare l'attribuzione demografica delle tendenze.
- *Badge Compilazione Automatica Google*: Mostrato automaticamente se il profilo è stato creato tramite Google OAuth.

#### Pannello B: Contatto e Indirizzo di Spedizione
- **Numero di Telefono**: Necessario per ricevere notifiche SMS/Push con le proposte quotidiane del calendario e le offerte degli esperti locali.
- **Indirizzo Linea 1**: Dispone del completamento automatico delle vie con OpenStreetMap (Nominatim). Selezionando un suggerimento vengono compilati automaticamente Indirizzo, Città, Regione, CAP e Paese.
- **Indirizzo Linea 2, Città, Regione, CAP**: Campi manuali per la spedizione sul marketplace.
- **Paese**: Menu a discesa offline con ricerca per nome del Paese o codice ISO-2.

#### Pannello C: Dati Demografici
- **Sesso**: Selezionate *Femmina* o *Maschio* per impostare le misure corporee di base e la tassonomia dei capi.
- **Stato Civile**: Selezionate *Celibe/Nubile*, *Coniugato/a*, *Divorziato/a* o *Vedovo/a*.
- **Professione**: Campo di testo libero (ad es. *Studente*, *Marketing Manager*, *Barista*). Alimenta la classificazione personalizzata di Trend Scout per dare priorità alle notizie di stile pertinenti.

#### Guida Rapida: Sincronizzazione dei Dati Google Mancanti (Nuovo Consenso People API)
Se avete effettuato l'accesso con Google prima che DressApp richiedesse le autorizzazioni per i dettagli del profilo della **People API** (telefono, indirizzo, sesso, data di nascita), questi campi potrebbero risultare vuoti. Potete sincronizzarli con un solo clic:

1. **Aprite la sezione Contatto o Dati Demografici**: Accanto al titolo della sezione è presente il pulsante **"Sincronizza da Google"** (icona di aggiornamento).
2. **Fate clic su "Sincronizza da Google"**: Se i permessi People API necessari non erano stati concessi all'accesso iniziale, DressApp mostrerà una notifica: *"Google richiede l'autorizzazione per accedere ai dettagli del profilo. Verrai reindirizzato a Google per concedere l'accesso."*
3. **Concedete il consenso nella schermata di Google**: Verrete indirizzati alla schermata di autorizzazione di Google OAuth. Selezionate le caselle per **Informazioni del profilo** (nome, email, foto) e **Dati di contatto** (telefono, indirizzo, sesso, data di nascita).
4. **Ritorno automatico e compilazione istantanea**: Dopo l'approvazione, Google vi reindirizzerà a DressApp. La funzione `syncGoogleProfile()` verrà avviata automaticamente chiamando l'endpoint backend `/auth/google/sync-profile` che:
   - Recupera telefono, indirizzo, sesso e data di nascita da Google People API
   - Compila i campi vuoti nelle sezioni **Contatto** (telefono, indirizzo) e **Dati Demografici** (sesso, data di nascita)
   - Salva istantaneamente gli aggiornamenti nel profilo
5. **Completato**: Il profilo è ora completo senza necessità di digitare nulla a mano.

> **Nota**: Il pulsante "Sincronizza da Google" è presente anche nell'intestazione della pagina (accanto al pulsante principale "Sincronizza Profilo Google") e funziona allo stesso modo: sincronizza tutti i dati Google disponibili in un colpo solo.

#### Pannello D: Preferenze e Unità di Misura
- **Unità di Peso**: Passate da Chilogrammi (`kg`) a Libbre (`lb`).
- **Unità di Lunghezza**: Passate da Centimetri (`cm`) a Pollici (`in`).

#### Pannello E: Foto e Palcoscenico dell'Avatar Digitale
- **Colonna Sinistra — Caricamento Foto**:
  - *Foto del Volto*: Caricate un'immagine per l'anteprima dell'avatar.
  - *Foto a Figura Intera*: Caricate una foto a figura intera. Il sistema elabora l'immagine localmente con U2-Net (`rembg`) per rimuovere automaticamente lo sfondo.
  - *Pulsante Rimuovi Foto*: Rimuove il ritaglio fotografico con un clic, ripristinando all'istante il manichino vettoriale 2D SVG senza ritardi nell'interfaccia.
- **Colonna Destra — Avatar Digitale e Camerino Virtuale**:
  - **Selettore Tonalità della Pelle**: Tavolozza interattiva per scegliere il colore della pelle del manichino.
  - **Canvas di Prova dell'Avatar**: Mostra i vestiti sopra il ritaglio della foto o sul manichino vettoriale dinamico di Bézier (`DynamicAvatar.jsx`) con scostamenti anatomici calibrati (`top-[14.5%]` dal colletto alla scollatura e `top-[36.5%]` dal cinturino al punto vita).

#### Pannello F: Profilo di Stile
- **Stile**: Parole chiave separate da virgole (ad es. *Minimalista, Streetwear, Vintage*).
- **Tavolozza dei Colori**: Tonalità preferite (ad es. *Pastello, Colori della terra, Monocromatico*).
- **Da Evitare**: Colori o tipologie di capi da escludere tassativamente dai consigli dell'IA (ad es. *Giallo, Crop Top*).
- **Sobrietà Culturale nell'Abbigliamento**: Scegliete il livello di copertura desiderato (*Casual/Disinvolto*, *Moderato*, *Conservatore*) per guidare la scelta dei capi dell'AI Stylist.

#### Pannello G: Misure Corporee e Taglie (Predittore di Taglie ANSUR II)
- **Modalità Iniziale / Nuovo Inizio**: Inserite 4 valori di base: **Altezza**, **Peso**, **Circonferenza Vita** e **Lunghezza del Piede**. Il modello di regressione multivariata integrato scikit-learn ANSUR II calcola automaticamente 6 misure strutturali:
  - *Spalle*, *Torace / Seno*, *Fianchi*, *Lunghezza Manica*, *Cavallo Interno* e *Lunghezza Esterna Gamba*.
- **Calcolo Automatico delle Taglie**: Una volta ottenute le misure strutturali, algoritmi deterministici calcolano istantaneamente **tutte le taglie commerciali standard**, inclusa la misura delle scarpe:
  - *Taglia Camicia Casual* (da XS a XXL in base alla circonferenza torace)
  - *Girovita Pantaloni* (in pollici, convertito dai cm del girovita)
  - *Misura Scarpe US* (formule uomo/donna basate sulla lunghezza del piede)
  - *Taglia Abito Donna* (US 0–14+ in base alla vita)
  - *Taglia Reggiseno* (sottoseno + coppa calcolati in base a seno e sottoseno)
- **Modalità Modifica Dettagliata**: Dopo la compilazione automatica, potete perfezionare tutti i 15 parametri di taglia (inclusi taglia camicia, pantaloni, scarpe, reggiseno, abito) e gli attributi dei capelli (*Lunghezza, Tipo, Colore, Stile*).
- **Conversione Unità in Tempo Reale**: Passate da *kg/cm* a *lb/in* — tutti i valori si convertono all'istante senza ricalcolare le predizioni.

#### Pannello H: Registrazione nella Directory Professionisti ed Esperti
- **Interruttore Stylist Professionista**: Registratevi come professionisti della moda certificati (stylist, sarti, stilisti).
- **Dati Aziendali**: Inserite Nome Attività, Indirizzo, Telefono, Email, Sito Web e Descrizione per comparire nella directory `/experts` e nel banner delle offerte locali.

#### Pannello I: Impostazioni di Incasso PayPal
- **Email Ricevente PayPal**: Inserite l'indirizzo email PayPal per ricevere i compensi delle vendite sul marketplace e delle campagne attive come esperti.

---

### 4. Scheda a Fisarmonica Preferenze di Sistema

Gestisce le impostazioni di sistema, gli abbonamenti e le integrazioni con l'IA:

- **Configurazione IA**:
  - *Modalità Standard (Motore di Produzione Principale)*: Basata su **Google Gemini 3.5 Flash-Lite** tramite `llm_gateway.py`. Offre styling rapidissimo senza configurazione iniziale e senza necessità di chiavi API personali.
  - *Rete di Sicurezza Quote On-Premises*: Se si superano i limiti dell'API cloud (`429` / `RESOURCE_EXHAUSTED`), le richieste passano in automatico al container ottimizzato e self-hosted **Gemma-4-E4B** sulla porta 7860, evitando interruzioni durante la sessione di styling.
  - *Modalità Chiavi API Personali (BYOK)*: Collegate la vostra chiave API di Google Gemini per usufruire di quote dedicate per sviluppatori e sbloccare strumenti generativi avanzati come il radar Trend Scout e la ricostruzione foto con Nano Banana.
- **Abbonamento e Limiti dell'Armadio**:
  - Controllate il piano attuale (**Free**: limite base di 50 capi vs **Manager** (10\$/mese) o **Professional** (15\$/mese): capi illimitati).
  - Accedete alla **pagina Prezzi** (`/pricing` oppure cliccate sulla scheda del vostro piano) per consultare il riepilogo comparativo dei piani, attivare un abbonamento o acquistare pacchetti di crediti prepagati senza scadenza.
  - Aggiornate il piano tramite PayPal Subscriptions o con il Gateway Atzmai per pagamenti locali in valuta israeliana ILS (Bit / carta di credito).
  - Copia **Link di Invito**: Ricevete +10 spazi permanenti nel guardaroba per ogni amico registrato (fino a un massimo di 150 capi).
- **Pianificatore e Promemoria Push**:
  - Attivate o disattivate le notifiche mattutine con le proposte di outfit.
  - Selezionate frequenza (*Tutti i giorni*, *A giorni alterni*, *Due volte a settimana*, *Nei giorni feriali*), orario (ad es. *07:00*) e stile richiesto (*Casual*, *Formale*, *Sportivo*, *Personalizzato*).
  - Abilitate le notifiche push VAPID nel browser.
- **Preferenze Notifiche Campagne**:
  - Interruttori granulari per *Notifiche/Email Moda Locale*, *Avvisi Saldi*, *Moda Sostenibile*, *Promozioni Luxury* e *Personal Stylist*.
  - Regolate la barra di scorrimento **Distanza Massima Campagne** (da 5 km a 50 km).
- **Collegamento Google Calendar**: Pulsante OAuth per sincronizzare gli eventi del calendario personale con l'AI Stylist.
- **Scheda Servizi di Localizzazione**: Attivate la geolocalizzazione GPS per visualizzare le offerte degli esperti vicini e previsioni meteo iperlocali.
- **Pulsante Invita Amici**: Copiate il vostro link personale di invito.
- **Assistente per lo Shopping**: Consultate i dettagli dell'estensione per Chrome Web Store o create un **Bookmarklet Universale** (`javascript:...`) per confrontare le taglie istantaneamente sui siti di e-commerce.

---

### 5. Azioni sull'Account e Diagnostica
- **Disconnetti**: Termina la sessione corrente.
- **Elimina il mio Account**: Link per cancellare definitivamente tutti i dati del profilo.
- **Pannello per Sviluppatori**: Sezione diagnostica per i test dell'ambiente. Autenticata con Google OAuth (`dressappdeveloper@gmail.com`).

---

## Risultati attesi
- Sincronizzazione immediata di misure corporee, tonalità della pelle e foto ritagliate sul canvas 2D dell'avatar.
- Nessuna richiesta di rete inutile durante la navigazione tra i pannelli delle impostazioni.
- Proposte di outfit dell'AI Stylist personalizzate e conformi alle vostre preferenze di sobrietà e ai vostri impegni.

---

## Risoluzione dei problemi
- **Lo sfondo della foto non viene rimosso**: Assicuratevi che la foto caricata sia a figura intera e con un'illuminazione ben contrastata rispetto allo sfondo.
- **Le notifiche push non arrivano**: Verificate che i permessi di notifica siano abilitati nel browser e che sia stato salvato un recapito telefonico nella sezione *Contatto*.
- **Il completamento automatico dell'indirizzo non risponde**: Verificate che la connessione a Internet sia attiva per le richieste a OpenStreetMap Nominatim.

---

## Limitazioni
- Lo spazio disponibile nel piano Free Tier è limitato a 1150 capi base, salvo ampliamento con i bonus di invito (+10 posti per invitato fino a un massimo di 150 capi) o passaggio ai piani Manager o Professional.
- Le funzionalità generative ad alta intensità di calcolo su cloud (radar Trend Scout e ricostruzione fotografica Nano Banana) richiedono l'inserimento di una chiave API Google Gemini personale fornita dall'utente.
- La modalità con chiave API personale passerà automaticamente al motore locale Gemma-4-E4B in caso di esaurimento della quota presso il fornitore esterno.
