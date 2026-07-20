# Profilo, Misure e Configurazione (`/me`)

Gestisci le tue misurazioni fisiche, la tonalità della pelle, i ritagli fotografici del corpo, le preferenze di stile, le credenziali dei modelli di IA e le integrazioni di sistema nella tua dashboard del profilo personale.

## Panoramica
La pagina **Profilo e Impostazioni** (`https://dressapp.co/me`) funge da hub di controllo centrale per il tuo ecosistema DressApp. Raccoglie i tuoi parametri antropometrici, lo stadio di prova virtuale del tuo avatar, i vincoli di stile, le preferenze localizzate, le chiavi API per l'IA e la programmazione delle notifiche push.

---

## Prerequisiti
- Un account DressApp attivo.
- (Opzionale) Permessi per la fotocamera del dispositivo per il caricamento della foto a figura intera.
- (Opzionale) Permessi di geolocalizzazione per campagne di stylist locali e previsioni meteo.

---

## Guida Passo-Passo: Panoramica della Pagina dall'Alto verso il Basso

### 1. Intestazione Pagina e Barra di Navigazione Esplora
Posizionata nella parte superiore della dashboard `/me`:
- **Intestazione (Header)**: Mostra lo stato e il titolo del tuo account.
- **Schede Esplora (Explore Cards)**: Scorciatoie rapide per le sezioni principali dell'app:
  - **Trend Scout** (`/trends`): Visualizza le notizie quotidiane sulla moda selezionate dall'IA.
  - **Outfits** (`/outfits`): Accedi al tuo calendario di outfit salvati.
  - **Esperti (Experts)** (`/experts`): Esplora stylist di moda e sarti locali.
  - **Statistiche (Stats)** (`/me/stats`): Visualizza la valutazione del guardaroba, le metriche di costo per utilizzo e i dettagli sui colori.

### 2. Scheda Selezione Lingua e Voce
Mostrata in primo piano per un'accessibilità immediata:
- **Selettore Lingua**: Scegli tra 12 lingue supportate (*Inglese, Spagnolo, Francese, Tedesco, Italiano, Portoghese, Russo, Cinese, Giapponese, Arabo, Hindi, Ebraico*). La selezione di una lingua aggiorna automaticamente l'interfaccia utente e imposta il modello vocale regionale di Sintesi Vocale (TTS).

---

### 3. Scheda Identità e Dettagli Personali (`ProfileDetailsCard`)

Contiene 9 pannelli a fisarmonica espandibili per gestire l'identità personale, le misure e il rendering dell'avatar:

#### Pannello A: Identità
- **Nome e Cognome**: Campi di identificazione personale.
- **Indirizzo Email**: Visualizzazione in sola lettura della tua email registrata.
- **Data di Nascita**: Utilizzata per personalizzare i punteggi delle tendenze demografiche.
- *Badge di Autocompletamento Google*: Viene visualizzato automaticamente se il profilo è stato creato tramite Google OAuth.

#### Pannello B: Contatti e Indirizzo di Spedizione
- **Numero di Telefono**: Richiesto per ricevere avvisi SMS/Push per le proposte giornaliere e le campagne degli esperti.
- **Indirizzo Riga 1**: Dispone di autocompletamento a livello stradale tramite OpenStreetMap (Nominatim).
- **Indirizzo Riga 2, Città, Regione, Codice Postale**: Campi indirizzo manuali per le spedizioni del marketplace.
- **Paese**: Menu a tendina offline ricercabile per nome del paese o codice ISO-2.

#### Pannello C: Dati Demografici
- **Sesso**: Seleziona *Femmina* o *Maschio* per configurare le misurazioni corporee di base e la tassonomia dei capi.
- **Stato Civile**: Seleziona *Single*, *Coniugato/a*, *Divorziato/a* o *Vedovo/a*.
- **Occupazione**: Inserimento di testo libero (es. *Studente*, *Marketing Manager*, *Barista*). Alimenta l'algoritmo di personalizzazione di Trend Scout.

#### Pannello D: Preferenze e Unità di Misura
- **Unità di Peso**: Passa da Chilogrammi (`kg`) a Libbre (`lb`).
- **Unità di Lunghezza**: Passa da Centimetri (`cm`) a Pollici (`in`).

#### Pannello E: Foto e Palcoscenico Avatar Digitale
- **Colonna Sinistra — Selettori Foto**:
  - *Foto Viso*: Carica una miniatura dell'avatar.
  - *Foto a Figura Intera*: Carica una fotografia a figura intera. Il sistema esegue automaticamente il ritaglio locale U2-Net (`rembg`) per rimuovere lo sfondo.
  - *Pulsante Rimuovi Foto*: Rimuove il ritaglio della foto con un singolo clic, ripristinando all'istante il manichino vettoriale SVG 2D senza ritardi.
- **Colonna Destra — Avatar Digitale e Stadio di Prova**:
  - **Selettore Tonalità della Pelle**: Palette di colori interattiva per selezionare la tonalità di pelle del manichino.
  - **Tela di Prova dell'Avatar**: Renderizza i capi sopra il ritaglio della foto o sul manichino vettoriale Bezier (`DynamicAvatar.jsx`) utilizzando offset calibrati (`top-[14.5%]` dal colletto alla scollatura e `top-[36.5%]` dalla cintura alla vita).

#### Pannello F: Profilo di Stile
- **Estetica**: Parole chiave di stile separate da virgole (es. *Minimalista, Streetwear, Vintage*).
- **Tavolozza dei Colori**: Tonalità preferite (es. *Pastello, Toni della Terra, Monocromatico*).
- **Da Evitare**: Colori o tipi di capi da escludere dalle raccomandazioni dell'IA.
- **Modestia nell'Abbigliamento**: Seleziona il livello di modestia (*Casual*, *Moderato*, *Conservatore*) per guidare lo stylist IA.

#### Pannello G: Misurazioni Corporee e Taglie (Predittore ANSUR II)
- **Modalità Iniziale / Nuovo Inizio**: Inserisci 4 dati di base: **Altezza**, **Peso**, **Circonferenza Vita** e **Lunghezza del Piede**. Il modello di regressione ANSUR II integrato tramite scikit-learn predice automaticamente 6 misurazioni strutturali:
  - *Spalle*, *Petto / Busto*, *Fianchi*, *Lunghezza Manica*, *Cavallo* e *Lunghezza Esterna*.
- **Modalità Modifica Dettagliata**: Regola finemente tutti i 15 parametri delle taglie e gli attributi dei capelli.

#### Pannello H: Registrazione nella Directory Professionale e degli Esperti
- **Interruttore Stylist Professionista**: Registrati come professionista verificato della moda.
- **Dettagli Aziendali**: Inserisci Nome azienda, Indirizzo, Telefono, Email, Sito web e Descrizione per apparire in `/experts`.

#### Pannello I: Impostazioni di Pagamento PayPal
- **Email Ricevente PayPal**: Inserisci la tua email PayPal per ricevere i pagamenti per le vendite e le campagne.

---

## 4. Scheda a Fisarmonica Preferenze di Sistema

Gestisce le impostazioni a livello di sistema, gli abbonamenti e le integrazioni di IA:

- **Configurazione IA (AI Configuration)**:
  - *Modalità Standard*: Utilizza gli endpoint Gemini Flash 2.x gestiti dal sistema.
  - *Modalità Chiavi API Personalizzate*: Connetti le tue chiavi API Google Gemini, Anthropic, OpenAI o DeepSeek.
- **Abbonamento e Limiti Armadio**:
  - Visualizza il livello di account attuale (**Gratuito**: limite di 150 articoli vs **Pro**: articoli illimitati).
  - Aggiorna tramite la REST API di PayPal Subscriptions ($4.99/mese o $29.99/anno).
  - Copia **Link di Invito**: Concede +10 spazi di capacità nell'armadio per ogni amico registrato.
- **Pianificatore e Promemoria Push**:
  - Attiva le notifiche con le proposte di outfit ogni mattina.
  - Imposta frequenza, orario e requisiti di stile.
  - Abilita gli avvisi push VAPID del browser.
- **Preferenze di Notifica delle Campagne**:
  - Interruttori per *Moda Locale Push/Email*, *Avvisi Saldi*, *Moda Sostenibile*, *Promozioni di Lusso* e *Stylist Personale*.
  - Regola il cursore **Distanza Massima Campagna** (da 5 km a 50 km).
- **Connessione Google Calendar**: Pulsante OAuth per sincronizzare gli eventi del calendario personale con lo stylist IA.
- **Servizi di Localizzazione**: Attiva i permessi GPS per trovare esperti locali e meteo.
- **Pulsante Invita Amici**: Copia il link di invito condivisibile.
- **Assistente Acquisti**: Accedi ai dettagli dell'estensione Chrome Web Store o genera un **Bookmarklet Universale** (`javascript:...`) per confronti istantanei delle taglie sugli e-commerce.

---

## 5. Azioni dell'Account e Diagnostica
- **Disconnetti**: Esci dalla sessione corrente.
- **Elimina il mio Account**: Link per eliminare definitivamente i dati dell'account.
- **Pannello Sviluppatori**: Fisarmonica diagnostica per i test d'ambiente.

---

## Risultati Attesi
- Sincronizzazione istantanea delle metriche fisiche, della tonalità della pelle e dei ritagli foto sulla tela 2D dell'avatar.
- Nessuna richiesta di rete non necessaria durante la navigazione tra i pannelli delle impostazioni.
- Proposte di outfit personalizzate create dall'IA in linea con le tue regole e la tua agenda.

---

## Risoluzione dei Problemi
- **Sfondo della foto non rimosso**: Assicurati che la foto caricata sia a figura intera con un'illuminazione di sfondo ben contrastata.
- **Avvisi push non pervenuti**: Conferma che i permessi per le notifiche del browser siano abilitati e che sia stato salvato un numero di telefono.
- **Autocompletamento indirizzo non reattivo**: Verifica che la connessione Internet sia attiva per le query su OpenStreetMap Nominatim.

---

## Limitazioni
- Lo spazio dell'account gratuito è limitato a 150 articoli a meno che non venga ampliato tramite bonus invito (+10 spazi per amico) o abbonamento Pro.
- La modalità con chiave API personalizzata richiede chiavi valide con quota rimanente dal rispettivo provider.