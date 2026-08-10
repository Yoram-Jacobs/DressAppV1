# Profilo, Taglie & Configurazione (`/me`)

Gestisci le tue misurazioni fisiche, tonalità della pelle, ritagli di foto del corpo, preferenze di stile, credenziali dei modelli di IA e integrazioni di sistema sul tuo pannello del profilo personale.

## Panoramica
La pagina **Profilo & Impostazioni** (`https://dressapp.co/me`) funge da centro di controllo principale per l'ecosistema DressApp. Ospita i tuoi parametri fisici antropometrici, l'arena dell'avatar virtuale per l'indossamento digitale, le restrizioni di stile, le preferenze localizzate, le chiavi dei modelli di IA e i programmi delle notifiche push.

---

## Prerequisiti
- Un account DressApp attivo.
- (Facoltativo) Autorizzazioni della fotocamera del dispositivo per il caricamento di foto a corpo intero.
- (Facoltativo) Autorizzazioni di posizione per il targeting locale di campagne di stylisti, restrizioni culturali e previsioni del tempo.

---

## Guida passo dopo passo: Panoramica della pagina dall'alto verso il basso

### 1. Intestazione della pagina & Barra di navigazione per l'esplorazione
Situata nella parte superiore della dashboard `/me`:
- **Intestazione**: Mostra lo stato e il titolo del tuo account.
- **Schede di esplorazione**: Scorciatoie rapide per le principali sezioni dell'app:
  - **Trend Scout** (`/trends`): Visualizza i feed di notizie quotidiane di moda curate dall'IA.
  - **Outfits** (`/outfits`): Accedi al tuo calendario di outfit salvati.
  - **Experts** (`/experts`): Sfoglia stylisti e sarti di moda locali.
  - **Unpacked / Stats** (`/me/stats`): Visualizza la valutazione del guardaroba, le metriche del costo per utilizzo e l'analisi dei colori.

### 2. Scheda di selezione della lingua e della voce
Mostrata in modo ben visibile per l'accessibilità immediata:
- **Selettore lingua**: Scegli tra 12 lingue supportate (*italiano, inglese, spagnolo, francese, tedesco, portoghese, russo, cinese, giapponese, arabo, hindi, ebraico*). La selezione di una lingua aggiorna automaticamente la localizzazione dell'interfaccia utente e associa il modello vocale di sintesi vocale (TTS) regionale predefinito.

---

### 3. Scheda identità & Dettagli personali (`ProfileDetailsCard`)

Contiene 9 pannelli a soffietto espandibili che gestiscono l'identità personale, la taglia e la rappresentazione dell'avatar:

#### Pannello A: Identità
- **Nome & Cognome**: Campi di identificazione personale.
- **Indirizzo email**: Visualizzazione in sola lettura della tua email registrata.
- **Data di nascita**: Utilizzata per personalizzare la valutazione delle tendenze demografiche.
- *Badge di compilazione automatica Google*: Si visualizza automaticamente se il tuo profilo è stato creato tramite Google OAuth.

#### Pannello B: Contatti & Indirizzo di consegna
- **Numero di telefono**: Richiesto per ricevere avvisi SMS/Push per le proposte giornaliere del pianificatore e le campagne degli esperti locali.
- **Riga indirizzo 1**: Offre il completamento automatico a livello stradale tramite OpenStreetMap (Nominatim). La selezione di un suggerimento compila automaticamente la Riga 1, la città, la regione, il codice postale e il paese.
- **Riga indirizzo 2, Città, Regione, Codice postale**: Campi di indirizzo manuali per la spedizione del mercato.
- **Paese**: Casella combinata offline ricercabile per nome del paese o codice ISO-2.

#### Pannello C: Dati demografici
- **Sesso**: Seleziona *Female* (Femminile) o *Male* (Maschile) per configurare le misurazioni corporee di base e la tassonomia dei vestiti.
- **Stato civile**: Seleziona *Single* (Celibe/Nubile), *Married* (Sposato/a), *Divorced* (Divorziato/a) o *Widowed* (Vedovo/a).
- **Occupazione**: Inserimento di testo libero (es. *Studente*, *Marketing Manager*, *Barista*). Alimenta il classificatore di personalizzazione di Trend Scout per dare la priorità alle notizie di stile pertinenti.

#### Guida riassuntiva: Sincronizzare i dati mancanti del profilo Google (Riconsenso alle People API)
Se hai effettuato l'accesso con Google prima che DressApp richiedesse l'accesso ai dettagli del tuo profilo **People API** (telefono, indirizzo, sesso, data di nascita), questi campi potrebbero rimanere vuoti. Puoi sincronizzarli con un solo clic:

1. **Apri il pannello Contatti o Dati demografici** — vedrai un pulsante **"Sync from Google"** (icona di aggiornamento) accanto al titolo della sezione.
2. **Fai clic su "Sync from Google"** — se i permessi richiesti per le People API non sono stati concessi durante l'accesso originale, DressApp rileva questo e mostra un messaggio: *"Google ha bisogno del tuo permesso per accedere ai dettagli del profilo. Verrai reindirizzato a Google per concedere l'accesso."*
3. **Concedi il consenso sulla schermata di Google** — verrai reindirizzato alla schermata di consenso OAuth di Google. Seleziona le caselle per **Profile info** (nome, email, foto) e **Contact info** (telefono, indirizzo, sesso, data di nascita).
4. **Ritorno automatico & compilazione automatica** — dopo il consenso, Google ti reindirizzerà a DressApp. La funzione `syncGoogleProfile()` si avvia automaticamente, chiamando l'endpoint backend `/auth/google/sync-profile` che:
   - Recupera il telefono, l'indirizzo, il sesso e la data di nascita dalle Google People API.
   - Compila i campi vuoti nei pannelli **Contatti** (telefono, indirizzo) e **Dati demografici** (sesso, data di nascita).
   - Salva gli aggiornamenti sul tuo profilo all'istante.
5. **Fatto** — il tuo profilo è ora completo senza digitazione manuale.

> **Nota**: Il pulsante "Sync from Google" appare anche nell'intestazione della pagina (accanto al pulsante principale "Sincronizza profilo Google") e funziona allo stesso modo — sincronizza tutti i dati del profilo Google disponibili contemporaneamente.

#### Pannello D: Preferenze & Unità di misura
- **Unità di peso**: Alterna tra chilogrammi (`kg`) e libbre (`lb`).
- **Unità di lunghezza**: Alterna tra centimetri (`cm`) e pollici (`in`).

#### Pannello E: Foto & Arena dell'avatar digitale
- **Colonna sinistra — Selettori di foto**:
  - *Foto del viso*: Carica una miniatura dell'avatar.
  - *Foto a corpo intero*: Carica una fotografia a corpo intero. Il sistema esegue automaticamente il ritaglio locale U2-Net (`rembg`) per rimuovere lo sfondo.
  - *Pulsante Rimuovi foto*: Rimozione con un solo clic del ritaglio della foto, passando all'istante la scena dell'avatar al manichino vettoriale 2D SVG senza alcun ritardo dell'interfaccia utente.
- **Colonna destra — Avatar digitale & Scena di prova**:
  - **Selettore tonalità della pelle**: Palette di colori interattiva per selezionare la tonalità della pelle del manichino.
  - **Tela di prova dell'avatar**: Mostra i capi sopra il ritaglio della tua foto o sul manichino vettoriale Bezier dinamico (`DynamicAvatar.jsx`) utilizzando offset calibrati (`top-[14.5%]` da colletto a scollatura e `top-[36.5%]` da cintura a girovita).

#### Pannello F: Profilo di stile
- **Estetiche**: Parole chiave di stile separate da virgola (es. *Minimalist, Streetwear, Vintage*).
- **Tavolozza dei colori**: Toni di colore preferiti (es. *Pastels, Earth Tones, Monochrome*).
- **Evitare**: Colori o tipi di abbigliamento da escludere rigorosamente dalle raccomandazioni dell'IA (es. *Yellow, Crop Tops*).
- **Conservatorismo culturale dell'abbigliamento**: Seleziona il livello di modestia (*Casual/Relaxed*, *Moderate*, *Conservative*) per guidare la copertura degli outfit dell'AI Stylist.

#### Pannello G: Misure del corpo & Taglie (ANSUR II Sizing Predictor)
- **Modalità Onboarding / Nuovo inizio**: Inserisci 4 dati di base: **Height** (Altezza), **Weight** (Peso), **Waist** (Circonferenza vita) e **Foot Length** (Lunghezza del piede). Il modello di regressione ANSUR II di scikit-learn integrato prevede automaticamente 6 misurazioni strutturali:
  - *Spalle*, *Petto / Busto*, *Fianchi*, *Lunghezza della manica*, *Cucitura interna (Inseam)* e *Cucitura esterna (Outseam)*.
- **Traduzione automatica delle taglie**: Una volta previste le misurazioni strutturali, gli algoritmi deterministici delle taglie popolano istantaneamente **tutte le taglie di vendita al dettaglio standard** fino alla taglia delle scarpe:
  - *Taglia camicia casual* (XS–XXL in base alla circonferenza del torace).
  - *Taglia vita dei pantaloni* (pollici, convertita dalla vita in cm).
  - *Taglia scarpe USA* (formule uomo/donna basate sulla lunghezza del piede).
  - *Taglia vestito da donna* (USA 0–14+ in base alla vita).
  - *Taglia reggiseno da donna* (misura sottoseno + coppa calcolate dal torace).
- **Modalità di modifica dettagliata**: Dopo la compilazione automatica, affina tutti i 15 parametri di taglia (inclusi taglia camicia, taglia pantaloni, taglia scarpe, taglia reggiseno, taglia vestito) e attributi dei capelli (*Lunghezza, Tipo, Colore, Stile*).
- **Conversione unità live**: Passa tra *kg/cm* e *lb/in* — tutti i valori si convertono istantaneamente senza una nuova previsione.

#### Pannello H: Registrazione nella directory esperti & professionisti
- **Abilitazione Stylist professionista**: Registrati come professionista della moda verificato (stylista, sarto, designer).
- **Dettagli aziendali**: Inserisci il nome dell'azienda, l'indirizzo, il telefono, l'email, il sito web e la descrizione per apparire nella directory `/experts` e nel ticker delle campagne regionali.

#### Pannello I: Impostazioni di pagamento PayPal
- **Email del destinatario PayPal**: Inserisci la tua email PayPal per ricevere pagamenti per le vendite sul mercato e le campagne di esperti attive.

---

### 4. Scheda a soffietto per le preferenze di sistema

Gestisce le impostazioni a livello di sistema, gli abbonamenti e le integrazioni dell'IA:

- **Configurazione IA**:
  - *Modalità Standard*: Utilizza gli endpoint Gemini Flash 2.x gestiti dal sistema.
  - *Modalità Chiavi API personalizzate*: Collega chiavi API personalizzate di Google Gemini, Anthropic, OpenAI o DeepSeek tramite un modal di configurazione guidato.
- **Abbonamento & Limiti del guardaroba**:
  - Visualizza il livello di abbonamento corrente (**Free**: limite di 50 articoli vs **Manager** o **Professional**: articoli illimitati).
  - Accedi alla **pagina dei prezzi** (`/pricing` o fai clic sulla scheda del piano) per visualizzare la tabella comparativa dei livelli, selezionare un piano e abbonarti.
  - Esegui l'upgrade tramite le API REST di PayPal Subscriptions (Manager: $4.99/mese; Professional: $9.99/mese) o il gateway Atzmai per transazioni locali in ILS.
  - Copia il **link di referral**: Concede +10 slot di capacità del guardaroba extra per ogni amico che si registra (fino a un massimo di 200 articoli).
- **Pianificatore & Promemoria push**:
  - Attiva/disattiva le notifiche mattutine sulle proposte di outfit.
  - Imposta la frequenza (*Tutti i giorni*, *A giorni alterni*, *Due volte a settimana*, *Nei giorni feriali*), l'ora (ad esempio, *07:00*) e le richieste di stile di codice di abbigliamento (*Casual*, *Formal*, *Athletic*, *Custom*).
  - Abilita le notifiche push VAPID del browser.
- **Preferenze per le notifiche della campagna**:
  - Interruttori dettagliati per *Local Fashion Push/Email*, *Sale Alerts*, *Sustainable Fashion*, *Luxury Promos*, e *Personal Stylist*.
  - Regola il cursore della **distanza massima della campagna** (da 5 km a 50 km).
- **Connessione a Google Calendar**: Pulsante OAuth per sincronizzare gli eventi del calendario personale con l'AI Stylist.
- **Servizi di localizzazione**: Abilita le autorizzazioni di localizzazione GPS per i feed degli esperti locali e il meteo preciso.
- **Pulsante Invita amici**: Copia il link di referral condivisibile.
- **Assistente per gli acquisti**: Accedi ai dettagli dell'estensione del Chrome Web Store o genera un **Universal Bookmarklet** (`javascript:...`) per confronti immediati di taglie e-commerce.

---

### 5. Azioni dell'account & Diagnostica
- **Disconnetti**: Esci dalla sessione corrente.
- **Elimina il mio account**: Link per eliminare in modo permanente i dati dell'account.
- **Pannello sviluppatore**: Pannello di diagnostica per i test d'ambiente.

---

## Risultati attesi
- Sincronizzazione istantanea delle metriche fisiche, della tonalità della pelle e dei ritagli di foto sulla tela dell'avatar 2D.
- Nessuna richiesta di rete inattiva durante la navigazione tra i pannelli delle impostazioni.
- Proposte di outfit personalizzate dell'AI Stylist allineate alle tue regole di modestia e al tuo calendario.

---

## Risoluzione dei problemi
- **Sfondo della foto non rimosso**: Assicurati che la foto caricata sia a corpo intero con un'illuminazione di sfondo contrastante.
- **Le notifiche push non arrivano**: Conferma che le autorizzazioni per le notifiche del browser siano abilitate e che sia registrato un numero di telefono sotto *Contatti*.
- **Il completamento automatico dell'indirizzo non risponde**: Verifica che la connessione Internet sia attiva per le query OpenStreetMap Nominatim.

---

## Limitazioni
- Lo spazio dell'account gratuito è limitato a 50 articoli, a meno che non venga espanso tramite bonus di referral (+10 slot per invito fino a un massimo di 200 articoli) o eseguendo l'upgrade al livello Manager o Professional.
- La modalità con chiavi API personalizzate richiede chiavi valide con quota rimanente dal rispettivo provider.
