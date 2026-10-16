# Profilo, Taglie e Configurazione (`/me`)

Gestisci misure fisiche, tonalità della pelle, ritagli fotografici a figura intera, preferenze di stile, impostazioni dei modelli IA e integrazioni di sistema nella dashboard del tuo profilo personale.

## Panoramica
La pagina **Profilo e Impostazioni** (`https://dressapp.co/me`) funge da centro di controllo principale per il tuo ecosistema DressApp. Ospita i tuoi parametri antropometrici fisici, il palcoscenico di prova virtuale dell'avatar digitale, i vincoli di stile, le preferenze localizzate, le impostazioni dei modelli IA e le pianificazioni delle notifiche push.

---

## Prerequisiti
- Un account DressApp attivo.
- (Facoltativo) Autorizzazioni per la fotocamera del dispositivo per il caricamento di foto a figura intera.
- (Facoltativo) Autorizzazioni di localizzazione per il targeting delle campagne degli stylist locali, le restrizioni culturali e le previsioni meteo.

---

## Guida passo dopo passo: Panoramica della pagina dall'alto verso il basso

### 1. Intestazione della pagina e barra di navigazione Esplora
Situate nella parte superiore della dashboard `/me`:
- **Intestazione**: Mostra lo stato e il titolo del tuo account.
- **Schede Esplora**: Scorciatoie rapide verso le sezioni principali dell'app:
  - **Trend Scout** (`/trends`): Visualizza i feed giornalieri di notizie sulla moda curati dall'IA.
  - **Outfit** (`/outfits`): Accedi al tuo calendario degli outfit salvati.
  - **Esperti** (`/experts`): Sfoglia gli stylist e i sarti locali.
  - **Guardaroba / Statistiche** (`/me/stats`): Visualizza il valore del guardaroba, le metriche del costo per utilizzo e la ripartizione dei colori.

### 2. Scheda di selezione lingua e voce
In primo piano per un'accessibilità immediata:
- **Selettore lingua**: Scegli tra 12 lingue supportate (*inglese, spagnolo, francese, tedesco, italiano, portoghese, russo, cinese, giapponese, arabo, hindi, ebraico*). La selezione di una lingua aggiorna automaticamente la lingua dell'interfaccia e associa il modello vocale Text-to-Speech (TTS) regionale predefinito.

---

### 3. Scheda Identità e Dati Personali (`ProfileDetailsCard`)

Contiene 9 pannelli espandibili a fisarmonica che gestiscono la tua identità personale, le taglie e il rendering dell'avatar:

#### Pannello A: Identità
- **Nome e Cognome**: Campi di identificazione personale.
- **Indirizzo Email**: Visualizzazione di sola lettura della tua email registrata.
- **Data di nascita**: Utilizzata per personalizzare il punteggio demografico delle tendenze.
- *Badge di compilazione automatica Google*: Viene visualizzato automaticamente se il tuo profilo è stato inizializzato tramite Google OAuth.

#### Pannello B: Contatto e indirizzo di consegna
- **Numero di telefono**: Necessario per ricevere avvisi SMS/Push per le proposte del pianificatore giornaliero e le campagne degli esperti locali.
- **Indirizzo Riga 1**: Include il completamento automatico a livello stradale tramite OpenStreetMap (Nominatim). Selezionando un suggerimento vengono compilati automaticamente Riga 1, Città, Regione, CAP e Paese.
- **Indirizzo Riga 2, Città, Regione, CAP**: Campi indirizzo manuali per le spedizioni del marketplace.
- **Paese**: Menu combinato offline ricercabile per nome del paese o codice ISO-2.

#### Pannello C: Dati demografici
- **Sesso**: Seleziona *Femmina* o *Maschio* per configurare le misure corporee di base e la tassonomia dell'abbigliamento.
- **Stato civile**: Seleziona *Celibe/Nubile*, *Coniugato/a*, *Divorziato/a* o *Vedovo/a*.
- **Occupazione**: Inserimento a testo libero (ad es. *Studente*, *Marketing Manager*, *Barista*). Alimenta il classificatore di personalizzazione di Trend Scout per dare priorità alle notizie di stile pertinenti.

#### Guida in sintesi: Sincronizzazione dei dati mancanti del profilo Google (Nuovo consenso People API)
Se hai effettuato l'accesso con Google prima che DressApp richiedesse l'accesso ai dettagli del tuo profilo tramite **People API** (telefono, indirizzo, genere, data di nascita), tali campi potrebbero essere rimasti vuoti. Puoi sincronizzarli con un clic:

1. **Apri il pannello a fisarmonica Contatto o Dati demografici** — vedrai un pulsante **"Sincronizza da Google"** (icona di aggiornamento) accanto al titolo della sezione.
2. **Fai clic su "Sincronizza da Google"** — se gli ambiti richiesti per People API non erano stati concessi durante l'accesso originale, DressApp lo rileva e mostra un messaggio informativo: *"Google ha bisogno della tua autorizzazione per accedere ai dettagli del profilo. Verrai reindirizzato a Google per concedere l'accesso."*
3. **Concedi il consenso nella schermata di Google** — verrai reindirizzato alla schermata di consenso OAuth di Google. Seleziona le caselle per **Informazioni del profilo** (nome, email, foto) e **Informazioni di contatto** (telefono, indirizzo, genere, compleanno).
4. **Ritorno automatico e compilazione automatica** — dopo il consenso, Google ti reindirizza a DressApp. La funzione `syncGoogleProfile()` viene eseguita automaticamente, chiamando l'endpoint di backend `/auth/google/sync-profile` che:
   - Recupera telefono, indirizzo, genere e data di nascita da Google People API
   - Compila i campi vuoti nei pannelli **Contatto** (telefono, indirizzo) e **Dati demografici** (sesso, data di nascita)
   - Salva istantaneamente gli aggiornamenti nel tuo profilo
5. **Fatto** — il tuo profilo è ora completo senza bisogno di digitare manualmente.

> **Nota**: Il pulsante "Sincronizza da Google" appare anche nell'intestazione della pagina (accanto al pulsante principale "Sincronizza profilo Google") e funziona allo stesso modo: sincronizza tutti i dati disponibili del profilo Google in un'unica operazione.

#### Pannello D: Preferenze e unità di misura
- **Unità di peso**: Passa tra Chilogrammi (`kg`) e Libbre (`lb`).
- **Unità di lunghezza**: Passa tra Centimetri (`cm`) e Pollici (`in`).

#### Pannello E: Foto e palcoscenico dell'avatar digitale
- **Colonna sinistra — Selettori foto**:
  - *Foto del viso*: Carica una miniatura per l'avatar.
  - *Foto a figura intera*: Carica una fotografia a figura intera. Il sistema esegue automaticamente lo scontorno locale U2-Net (`rembg`) per rimuovere lo sfondo.
  - *Pulsante Rimuovi foto*: Rimozione con un solo clic del ritaglio fotografico, riportando istantaneamente la scena di prova al manichino vettoriale 2D SVG senza alcun ritardo dell'interfaccia.
- **Colonna destra — Avatar digitale e scena di prova**:
  - **Selettore tonalità della pelle**: Tavolozza di colori interattiva per selezionare la tonalità della pelle del tuo manichino.
  - **Canvas di prova dell'avatar**: Visualizza i capi sopra il ritaglio della tua foto o sul manichino vettoriale dinamico di Bézier (`DynamicAvatar.jsx`) utilizzando offset di riferimento calibrati (`top-[14.5%]` dal colletto allo scollo e `top-[36.5%]` dalla cintura al punto vita).

#### Pannello F: Profilo di stile
- **Estetica**: Parole chiave di stile separate da virgole (ad es. *Minimalista, Streetwear, Vintage*).
- **Tavolozza colori**: Tonalità di colore preferite (ad es. *Pastello, Toni della terra, Monocromatico*).
- **Da evitare**: Colori o tipologie di capi da escludere rigorosamente dalle raccomandazioni dell'IA (ad es. *Giallo, Crop Top*).
- **Sobrietà culturale nell'abbigliamento**: Seleziona il livello di sobrietà (*Casual/Rilassato*, *Moderato*, *Conservatore*) per guidare il grado di copertura degli outfit dell'AI Stylist.

#### Pannello G: Misure corporee e taglie (Predittore di taglie ANSUR II)
- **Modalità Onboarding / Nuovo inizio**: Inserisci 4 dati di base: **Altezza**, **Peso**, **Circonferenza vita** e **Lunghezza del piede**. Il modello di regressione multi-output integrato scikit-learn ANSUR II predice automaticamente 6 misure strutturali:
  - *Spalle*, *Torace / Seno*, *Fianchi*, *Lunghezza manica*, *Interno gamba (Inseam)* e *Lunghezza esterna gamba (Outseam)*.
- **Conversione automatica delle taglie**: Una volta predette le misure strutturali, algoritmi deterministici compilano istantaneamente **tutte le taglie commerciali standard** fino al numero di scarpe:
  - *Taglia camicia casual* (XS–XXL in base alla circonferenza del torace)
  - *Taglia girovita pantaloni* (in pollici, convertita dai cm del girovita)
  - *Numero di scarpe US* (formule Uomo/Donna basate sulla lunghezza del piede)
  - *Taglia abito donna* (US 0–14+ in base al girovita)
  - *Taglia reggiseno donna* (fascia + coppa calcolate da seno/sottoseno)
- **Modalità di modifica dettagliata**: Dopo la compilazione automatica, perfeziona tutti i 15 parametri delle taglie (inclusi Taglia camicia, Taglia pantaloni, Numero scarpe, Taglia reggiseno, Taglia abito) e gli attributi dei capelli (*Lunghezza, Tipo, Colore, Stile*).
- **Cambio unità in tempo reale**: Passa tra *kg/cm* e *lb/in* — tutti i valori si convertono istantaneamente senza necessità di un nuovo calcolo.

#### Pannello H: Registrazione nella directory Professionisti ed Esperti
- **Interruttore Stylist Professionista**: Registrati come professionista della moda verificato (stylist, sarto, designer).
- **Dettagli attività**: Inserisci Nome attività, Indirizzo, Telefono, Email, Sito web e Descrizione per apparire nella directory `/experts` e nel ticker delle campagne regionali.

#### Pannello I: Impostazioni di pagamento PayPal
- **Email destinatario PayPal**: Inserisci la tua email PayPal per ricevere i compensi per le vendite sul marketplace e le campagne esperti attive.

---

### 4. Scheda a fisarmonica Preferenze di Sistema

Gestisce le impostazioni a livello di sistema, gli abbonamenti e le integrazioni IA:

- **Routing dei modelli IA (Architettura multilivello — Zero BYOK)**:
  - *Piano Gratuito (Motore Eyes On-Premises)*: Gli utenti del piano gratuito sono serviti dal motore on-premises self-hosted **Eyes** di DressApp (attualmente un modello **Qwen 2.5 VL 3B** ottimizzato) sulla porta 7860, senza necessità di alcuna chiave API personale.
  - *Piani Manager e Professional (Modello Cloud Veloce)*: Gli abbonati ai piani **Manager** e **Professional** usufruiscono dell'instradamento prioritario verso il modello IA Cloud veloce (attualmente **Google Gemini 3.5 Flash** tramite `llm_gateway.py`).
  - *Rete di sicurezza on-premises per le quote*: Qualora vengano raggiunti i limiti di frequenza cloud esterni (`429` / `RESOURCE_EXHAUSTED`), le richieste passano automaticamente al container self-hosted **Eyes** (`Qwen 2.5 VL 3B`) sulla porta 7860, garantendo che la tua conversazione di styling non venga mai interrotta.
- **Abbonamento e limiti del guardaroba**:
  - Visualizza il livello attuale dell'account (**Free**: limite base di 150 capi rispetto a **Manager** ($10/mese) o **Professional** ($15/mese): capi illimitati + modello IA Cloud veloce).
  - Accedi alla **pagina Prezzi** (`/pricing` o fai clic sulla scheda del tuo piano) per visualizzare la tabella comparativa dei livelli, selezionare un piano o acquistare pacchetti di crediti prepagati senza scadenza.
  - Effettua l'upgrade tramite PayPal Subscriptions o il gateway Atzmai per le transazioni locali israeliane in ILS (Bit / carta di credito).
  - Copia il **Link di invito (Referral)**: Concede +10 slot di capacità del guardaroba per ogni amico che si registra (fino a un massimo di 150 capi).
- **Pianificatore e promemoria Push**:
  - Attiva o disattiva le notifiche mattutine con le proposte di outfit.
  - Imposta la frequenza (*Ogni giorno*, *A giorni alterni*, *Due volte a settimana*, *Nei giorni feriali*), l'orario (ad es. *07:00*) e le preferenze di dress code (*Casual*, *Formale*, *Sportivo*, *Personalizzato*).
  - Abilita gli avvisi push VAPID del browser.
- **Preferenze di notifica delle campagne**:
  - Interruttori granulari per *Push/Email moda locale*, *Avvisi saldi*, *Moda sostenibile*, *Promo di lusso* e *Personal Stylist*.
  - Regola il cursore **Distanza massima campagna** (da 5 km a 50 km).
- **Connessione Google Calendar**: Pulsante OAuth per sincronizzare gli eventi del calendario personale con l'AI Stylist.
- **Scheda Servizi di localizzazione**: Attiva o disattiva i permessi di posizione GPS per i feed degli esperti basati sulla distanza e il meteo iperlocale.
- **Pulsante Invita amici**: Copia il link di invito condivisibile.
- **Shopping Assistant**: Accedi ai dettagli dell'estensione del Chrome Web Store o genera un **Bookmarklet universale** (`javascript:...`) per confrontare istantaneamente le taglie sui siti e-commerce.

---

### 5. Azioni account e diagnostica
- **Esci (Sign Out)**: Disconnettiti dalla sessione corrente.
- **Elimina il mio account**: Link per cancellare definitivamente i dati dell'account.
- **Pannello sviluppatore**: Vista diagnostica per i test dell'ambiente. Autenticata tramite Google OAuth (`dressappdeveloper@gmail.com`).

---

## Risultati attesi
- Sincronizzazione istantanea di parametri fisici, tonalità della pelle e ritagli fotografici sul Canvas di prova dell'avatar 2D.
- Zero richieste di rete inattive durante la navigazione tra i pannelli delle impostazioni.
- Proposte di outfit dell'AI Stylist personalizzate e allineate alle tue regole di sobrietà e ai tuoi impegni.

---

## Risoluzione dei problemi
- **Lo sfondo della foto non viene rimosso**: Assicurati che la foto caricata sia a figura intera e con un'illuminazione di sfondo ben contrastata.
- **Gli avvisi push non arrivano**: Verifica che i permessi di notifica del browser siano abilitati e che un numero di telefono sia salvato nella sezione *Contatto*.
- **Il completamento automatico dell'indirizzo non risponde**: Controlla che la connessione Internet sia attiva per le query a OpenStreetMap Nominatim.

---

## Limitazioni
- Lo spazio dell'account nel piano Gratuito è limitato a 150 capi e utilizza il modello Eyes on-premises (`Qwen 2.5 VL 3B`), a meno che non si effettui l'upgrade al piano **Manager** o **Professional** per ottenere spazio di archiviazione illimitato e il modello Cloud veloce (`Gemini 3.5 Flash`).
- Se le quote cloud vengono temporaneamente raggiunte, le richieste passano in modo trasparente al motore integrato Eyes on-premises (`Qwen 2.5 VL 3B`) senza interrompere la sessione.
