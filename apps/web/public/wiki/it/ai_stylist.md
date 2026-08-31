# Stylist Conversazionale AI

Interagisci con uno stylist personale intelligente che conosce il tuo guardaroba, il meteo e i tuoi impegni.

## Panoramica
Lo Stylist AI gestisce le richieste di styling vocali o testuali in linguaggio naturale, integrando automaticamente condizioni meteorologiche, eventi del calendario e notifiche push gestite da store personalizzati `useSyncExternalStore` thread-safe (`stylistStore` e `dailySuggestionsStore`) con memorizzazione nella cache di 15 minuti e deduplicazione delle richieste in corso.

## Requisiti preliminari
- Una chiave API Gemini (o crediti di sistema predefiniti).
- Eventi di calendario collegati.

## Passo dopo passo
1. **Avvia sessione**: Apri la scheda Stylist e seleziona Chat, Shuffle o Match.
2. **Input vocale**: Tocca il microfono, pronuncia la tua richiesta (ad es. "Suggerisci un outfit per una giornata di pioggia") e tocca per inviare.
3. **Riproduzione audio**: Ascolta la spiegazione dello styling generata tramite il lettore vocale ad alta fedeltà.
4. **Mix (Shuffle)**: Fai clic sul pulsante Sparkles per far girare la slot machine; l'AI allinea automaticamente gli articoli corrispondenti in primo piano.
5. **Navigazione senza attesa**: La navigazione tra Stylist e altre schede utilizza le preferenze memorizzate in cache senza attivare cicli di richieste GET al database.

## Risultati attesi
Layout di outfit personalizzati creati attorno alle tue preferenze personali, ai vincoli stagionali e ai tuoi impegni.

## Risoluzione dei problemi
- **Audio riprodotto troppo lentamente**: Passa da Gemini TTS al fallback di Web Speech API nelle impostazioni del Profile.
- **Suggerimenti ripetuti**: Assicurati che la cronologia del calendario outfit sia aggiornata in modo che l'algoritmo di rotazione possa bloccare la ripetizione dei capi.

## Limitazioni
- Le raccomandazioni richiedono almeno un capo superiore, un capo inferiore e una calzatura nell'armadio per completare un look.
- La trascrizione vocale potrebbe ripiegare sulla digitazione di testo standard su dispositivi non supportati.