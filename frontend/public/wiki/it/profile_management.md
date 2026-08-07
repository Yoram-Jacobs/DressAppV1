Ecco la traduzione della documentazione di DressApp dall'inglese all'italiano, seguendo le tue regole:

# Profilo, Misurazioni e Configurazione (`/me`)

Gestisci le misurazioni fisiche, la tonalità della pelle, i ritagli di foto del corpo, le preferenze di stile, le credenziali del modello AI e le integrazioni di sistema sulla tua dashboard del profilo personale.

## Panoramica
La pagina **Profilo e Impostazioni** (`https://dressapp.co/me`) funge da hub di controllo centrale per il tuo ecosistema DressApp. Ospita i tuoi parametri antropometrici fisici, l'area avatar per la prova virtuale digitale, i vincoli di stile, le preferenze localizzate, le chiavi del modello AI e le pianificazioni delle notifiche push.

---

## Prerequisiti
- Un account DressApp attivo.
- (Opzionale) Permessi della fotocamera del dispositivo per il caricamento di foto a figura intera.
- (Opzionale) Permessi di localizzazione per il targeting di campagne di stilisti locali e le previsioni meteo.

---

## Guida passo-passo: Panoramica della pagina dall'alto verso il basso

### 1. Intestazione della pagina e barra di navigazione Esplora
Situato nella parte superiore della dashboard `/me`:
- **Intestazione**: Visualizza lo stato del tuo account e il titolo.
- **Schede Esplora**: Scorciatoie rapide alle sezioni principali dell'app:
  - **Trend Scout** (`/trends`): Visualizza feed di notizie di moda quotidiani curati dall'AI.
  - **Outfit** (`/outfits`): Accedi al tuo calendario degli outfit salvati.
  - **Esperti** (`/experts`): Sfoglia stilisti e sarti locali.
  - **Unpacked / Statistiche** (`/me/stats`): Visualizza la valutazione del guardaroba, le metriche del costo per utilizzo e le suddivisioni dei colori.

### 2. Scheda di selezione lingua e voce
Messa in evidenza per un'accessibilità immediata:
- **Selettore della Lingua**: Scegli tra 12 lingue supportate (*English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Arabic, Hindi, Hebrew*). La selezione di una lingua aggiorna automaticamente la localizzazione dell'interfaccia utente (UI) e associa il modello vocale Text-to-Speech (TTS) regionale predefinito.

---

### 3. Scheda Dettagli Identità e Personali (`ProfileDetailsCard`)

Contiene 9 pannelli a fisarmonica espandibili che gestiscono la tua identità personale, le misurazioni e il rendering dell'avatar:

#### Pannello A: Identità
- **Nome e Cognome**: Campi di identificazione personale.
- **Indirizzo Email**: Visualizzazione in sola lettura della tua email registrata.
- **Data di Nascita**: Utilizzata per personalizzare il punteggio delle tendenze demografiche.
- *Google Autofill Badge*: Visualizzato automaticamente se il tuo profilo è stato precompilato tramite Google OAuth.

#### Pannello B: Contatto e Indirizzo di Consegna
- **Numero di Telefono**: Richiesto per ricevere avvisi SMS/Push per le proposte di pianificazione giornaliera e le campagne di esperti locali.
- **Indirizzo Linea 1**: Dispone di autocompletamento a livello stradale di OpenStreetMap (Nominatim). La selezione di un suggerimento popola automaticamente Linea 1, Città, Regione, CAP e Paese.
- **Indirizzo Linea 2, Città, Regione, Codice Postale**: Campi indirizzo manuali per la spedizione dal marketplace.
- **Paese**: Combobox offline ricercabile per nome del paese o codice ISO-2.

#### Pannello C: Dati Demografici
- **Sesso**: Seleziona *Femmina* o *Maschio* per configurare le misurazioni corporee di base e la tassonomia dell'abbigliamento.
- **Stato Personale**: Seleziona *Single*, *Sposato/a*, *Divorziato/a* o *Vedovo/a*.
- **Occupazione**: Inserimento a testo libero (es. *Studente*, *Marketing Manager*, *Barista*). Alimenta il ranker di personalizzazione di Trend Scout per dare priorità a notizie di stile pertinenti.

#### Guida Riassuntiva: Sincronizzazione dei Dati del Profilo Google Mancanti (Nuovo Consenso People API)
Se hai effettuato l'accesso con Google prima che DressApp richiedesse l'accesso ai dettagli del tuo profilo **People API** (telefono, indirizzo, sesso, data di nascita), tali campi potrebbero rimanere vuoti. Puoi sincronizzarli con un solo clic:

1.  **Apri il pannello a fisarmonica Contatto o Dati Demografici** — vedrai un pulsante **"Sync from Google"** (icona di aggiornamento) accanto al titolo della sezione.
2.  **Clicca su "Sync from Google"** — se gli ambiti People API richiesti non erano stati concessi durante il tuo accesso originale, DressApp lo rileva e mostra un toast informativo: *"Google needs your permission to access profile details. You will be redirected to Google to grant access."*
3.  **Concedi il consenso sulla schermata di Google** — verrai reindirizzato alla schermata di consenso OAuth di Google. Spunta le caselle per **Profile info** (nome, email, foto) e **Contact info** (telefono, indirizzo, sesso, data di nascita).
4.  **Ritorno automatico e autocompilazione** — dopo il consenso, Google ti reindirizza a DressApp. La funzione `syncGoogleProfile()` viene eseguita automaticamente, richiamando l'endpoint backend `/auth/google/sync-profile` che:
    - Recupera il tuo telefono, indirizzo, sesso e data di nascita da Google People API
    - Popola i campi vuoti nei pannelli **Contatto** (telefono, indirizzo) e **Dati Demografici** (sesso, data di nascita)
    - Salva immediatamente gli aggiornamenti al tuo profilo
5.  **Fatto** — il tuo profilo è ora completo senza digitazione manuale.

> **Nota**: Il pulsante "Sync from Google" appare anche nell'intestazione della pagina (accanto al pulsante principale "Sync Google Profile") e funziona allo stesso modo — sincronizza tutti i dati del profilo Google disponibili in una volta sola.

#### Pannello D: Preferenze e Unità di Misura
- **Unità di Peso**: Alterna tra Chilogrammi (`kg`) e Libbre (`lb`).
- **Unità di Lunghezza**: Alterna tra Centimetri (`cm`) e Pollici (`in`).

#### Pannello E: Foto e Area Avatar Digitale
- **Colonna Sinistra — Selettori Foto**:
  - *Face Photo*: Carica un'immagine del profilo.
  - *Full-body Photo*: Carica una fotografia a figura intera. Il sistema esegue automaticamente la mascheratura locale U2-Net (`rembg`) per rimuovere lo sfondo.
  - *Remove Photo Button*: Rimozione con un clic del ritaglio della tua foto, riportando istantaneamente l'area di prova allo schema vettoriale SVG 2D con latenza dell'interfaccia utente pari a zero.
- **Colonna Destra — Avatar Digitale e Area di Prova**:
  - **Skin Tone Picker**: Palette di colori interattiva per selezionare la tonalità della pelle del tuo manichino.
  - **Avatar Try-On Canvas**: Rappresenta i capi d'abbigliamento sopra il ritaglio della tua foto o il manichino vettoriale di Bezier dinamico (`DynamicAvatar.jsx`) utilizzando offset di riferimento calibrati (`top-[14.5%]` collo-scollatura e `top-[36.5%]` vita-cintura).

#### Pannello F: Profilo di Stile
- **Estetica**: Parole chiave di stile separate da virgole (es. *Minimalista, Streetwear, Vintage*).
- **Palette Colori**: Toni di colore preferiti (es. *Pastello, Toni della Terra, Monocromatico*).
- **Evita**: Colori o tipi di capi da escludere rigorosamente dalle raccomandazioni AI (es. *Giallo, Crop Top*).
- **Conservatorismo nell'Abbigliamento Culturale**: Seleziona il livello di modestia (*Casual/Rilassato*, *Moderato*, *Conservatore*) per guidare la copertura dell'outfit da parte dell'AI Stylist.

#### Pannello G: Misurazioni Corporee e Taglie (Predittore di Taglie ANSUR II)
- **Modalità Onboarding / Inizio Rapido**: Inserisci 4 input di base: **Altezza**, **Peso**, **Circonferenza Vita** e **Lunghezza Piede**. Il modello di regressione multi-output scikit-learn ANSUR II integrato predice automaticamente 6 misurazioni strutturali:
  - *Spalle*, *Petto / Busto*, *Fianchi*, *Lunghezza Manica*, *Cavallo Interno*, e *Cavallo Esterno*.
- **Traduzione Automatica delle Taglie**: Una volta predette le misurazioni strutturali, algoritmi di dimensionamento deterministici popolano istantaneamente **tutte le taglie standard al dettaglio** fino alla taglia di scarpe:
  - *Taglia Camicia Casual* (XS–XXL basata sulla circonferenza del petto)
  - *Taglia Vita Pantaloni* (pollici, convertita da cm di vita)
  - *Taglia Scarpa USA* (formule Uomo/Donna dalla lunghezza del piede)
  - *Taglia Vestito Donna* (USA 0–14+ basata sulla vita)
  - *Taglia Reggiseno Donna* (fascia + coppa calcolati da busto/sottoseno)
- **Modalità di Modifica Dettagliata**: Dopo l'autocompilazione, affina tutti i 15 parametri di dimensionamento (incluse Taglia Camicia, Taglia Pantaloni, Taglia Scarpe, Taglia Reggiseno, Taglia Vestito) e gli attributi Capelli (*Lunghezza, Tipo, Colore, Stile*).
- **Toggle Unità in Tempo Reale**: Passa tra *kg/cm* e *lb/in* — tutti i valori si convertono istantaneamente senza ri-predizione.

#### Pannello H: Registrazione nella Directory Professionisti ed Esperti
- **Toggle Stilista Professionista**: Registrati come professionista della moda verificato (stilista, sarto, designer).
- **Dettagli Commerciali**: Inserisci Nome Attività, Indirizzo, Telefono, Email, Sito Web e Descrizione per apparire nella directory `/experts` e nel ticker delle campagne regionali.

#### Pannello I: Impostazioni Pagamenti PayPal
- **Email Ricevente PayPal**: Inserisci la tua email PayPal per ricevere pagamenti per le vendite sul marketplace e le campagne esperte attive.

---

### 4. Scheda a Fisarmonica Preferenze di Sistema

Gestisce le impostazioni a livello di sistema, gli abbonamenti e le integrazioni AI:

- **Configurazione AI**:
  - *Standard Mode*: Utilizza endpoint Gemini Flash 2.x gestiti dal sistema.
  - *Custom API Keys Mode*: Connetti chiavi API custom di Google Gemini, Anthropic, OpenAI o DeepSeek tramite una modale di configurazione guidata.
- **Limiti Abbonamento e Armadio**:
  - Visualizza il livello attuale dell'account (**Gratuito**: limite di 50 articoli vs **Manager** o **Professionale**: articoli illimitati).
  - Effettua l'upgrade tramite PayPal Subscriptions REST API (Manager: $5/mese o $50/anno; Professionale: $10/mese o $100/anno).
- **Pianificatore e Promemoria Push**:
  - Attiva/Disattiva le notifiche di proposta outfit mattutine.
  - Imposta la frequenza (*Ogni Giorno*, *A Giorni Alterni*, *Due Volte a Settimana*, *Nei Giorni Feriali*), l'ora (es. *07:00*) e le richieste di stile del dress-code (*Casual*, *Formale*, *Atletico*, *Personalizzato*).
  - Abilita gli avvisi push VAPID del browser.
- **Preferenze Notifiche Campagne**:
  - Toggle granulari per *Notifiche Push/Email Moda Locale*, *Avvisi Sconti*, *Moda Sostenibile*, *Promozioni di Lusso* e *Personal Stylist*.
  - Regola il cursore **Distanza Massima Campagna** (da 5km a 50km).
- **Connessione Google Calendar**: Pulsante OAuth per sincronizzare gli eventi del calendario personale con l'AI Stylist.
- **Scheda Servizi di Localizzazione**: Attiva/Disattiva i permessi di localizzazione GPS per i feed di esperti basati sulla distanza e il meteo iper-locale.
- **Pulsante Invita Amici**: Copia il link di riferimento condivisibile.
- **Assistente agli Acquisti**: Accedi ai dettagli dell'estensione Chrome Web Store o genera un **Bookmarklet Universale** (`javascript:...`) per confronti istantanei delle taglie e-commerce.

---

### 5. Azioni Account e Diagnostica
- **Esci**: Disconnetti dalla sessione corrente.
- **Elimina il mio Account**: Link per eliminare permanentemente i dati dell'account.
- **Pannello Sviluppatore**: Pannello a fisarmonica diagnostico per testare l'ambiente.

---

## Risultati Attesi
- Sincronizzazione istantanea delle metriche fisiche, della tonalità della pelle e dei ritagli di foto su tutta l'Area di Prova Avatar 2D.
- Zero richieste di rete inattive durante la navigazione tra i pannelli delle impostazioni.
- Proposte di outfit personalizzate dell'AI Stylist allineate con le tue regole di modestia e la tua pianificazione.

---

## Risoluzione dei Problemi
- **Sfondo della foto non rimosso**: Assicurati che la foto caricata sia a figura intera con un'illuminazione di sfondo contrastante.
- **Avvisi push non arrivano**: Conferma che i permessi di notifica del browser siano abilitati e che un numero di telefono sia salvato sotto *Contatto*.
- **Autocompletamento indirizzo non responsivo**: Verifica che la connessione internet sia attiva per le query OpenStreetMap Nominatim.

---

## Limitazioni
- Lo spazio dell'account gratuito è limitato a 150 articoli, a meno che non venga espanso tramite bonus di referral (+10 slot per invito) o abbonamento Pro.
- La modalità con chiavi API personalizzate richiede chiavi valide con quota rimanente dal rispettivo provider.
