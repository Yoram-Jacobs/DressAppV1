# Profilo, Taglie e Configurazione

Perfeziona le tue misurazioni, i vincoli di modestia e le credenziali AI.

## Panoramica
La sezione Profilo mantiene aggiornato il tuo contesto di styling, gestendo le metriche fisiche del corpo, la selezione della palette della tonalità della pelle, i ritagli di foto a figura intera, le regole di stile, le chiavi API AI personalizzate, le notifiche delle campagne e le impostazioni della regione locale.

## Requisiti preliminari
- Account utente DressApp attivo.

## Passo dopo passo
1. **Inserisci metriche e taglie ANSUR II**: Inserisci i parametri fisici di base (Altezza, Peso, Vita, Lunghezza del piede). Il modello di regressione ANSUR II calcola automaticamente le tue 6 dimensioni strutturali (Spalle, Torace, Fianchi, Lunghezza braccio, Cavallo interno, Lunghezza esterna).
2. **Tonalità della pelle e ritaglio foto corpo**: Seleziona la tonalità della pelle dalla palette di colori o carica una fotografia a figura intera. Il sistema esegue automaticamente lo scontorno dello sfondo U2-Net per mostrare anteprime di prova sul corpo reale. Fai clic su *Rimuovi foto* per tornare all'istante al manichino vettoriale 2D SVG.
3. **Specificare le regole**: Seleziona gli elementi da evitare (ad es. "evita il giallo") e i livelli di modestia.
4. **Configurazione AI**: Inserisci le tue chiavi personalizzate di Google AI Studio o seleziona la modalità provider standard.
5. **Notifiche campagne**: Espandi l'accordo *Notifiche campagne* per attivare le notifiche via e-mail o push per promozioni locali, saldi e nuovi stylist nella tua zona, e personalizza la frequenza (Istantanea, Giornaliera, Settimanale) e la distanza massima (5km, 10km, 25km, 50km).
6. **Gestisci account**: Visualizza il tuo livello di abbonamento (Pro rispetto al limite Free di 150 articoli) o richiedi l'eliminazione dell'account.

## Risultati attesi
- Avatar 2D personalizzato e layout di outfit conformi esattamente alla tua forma, tonalità della pelle e preferenze di stile di abbigliamento.
- Notifiche inviate sui canali selezionati quando le campagne attive corrispondono alle tue regole di styling e rientrano nel raggio di distanza selezionato.

## Risoluzione dei problemi
- **Chiave API non valida**: Verifica di aver copiato correttamente la chiave da Google AI Studio senza spazi aggiuntivi.
- **Sfondo della foto non pulito**: Assicurati che la tua foto a figura intera abbia un'illuminazione chiara su uno sfondo contrastante.
- **Il calendario non si sincronizza**: Scollega e riautentica il tuo account Google per aggiornare i token.
- **Mancata ricezione delle campagne**: Assicurati che i *Servizi di localizzazione* siano abilitati e che l'impostazione della distanza massima copra la posizione dell'attività locale.

## Limitazioni
- Le regole personalizzate vengono applicate rigorosamente; se le tue regole sono troppo rigide, lo stylist potrebbe non trovare outfit corrispondenti.
- Le avvertenze push delle campagne richiedono le autorizzazioni di notifica del browser. Se bloccate, riceverai solo notifiche via e-mail.