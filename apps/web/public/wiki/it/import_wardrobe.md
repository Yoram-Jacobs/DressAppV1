# Importa il tuo guardaroba da altre app (Migrazione da concorrente)

## Panoramica
Se hai già catalogato i tuoi vestiti in un'altra app per il guardaroba (come Whering, Acloset o Stylebook), non devi ricominciare da capo. DressApp dispone di un intelligente **Desktop Wardrobe Migration Agent** (tramite un bookmarklet del browser) che scansiona la pagina del tuo vecchio armadio, acquisisce le schede dei tuoi indumenti e le carica automaticamente su DressApp. La nostra IA viene quindi eseguita in background per identificare automaticamente i colori, i marchi, i tessuti e le categorie dei tuoi vestiti.

## Prerequisiti
- **Computer desktop**: Il bookmarklet di migrazione richiede funzionalità del browser desktop (Chrome, Edge o Safari). Non è supportato su dispositivi mobili o tablet.
- **Account attivi**: Devi aver effettuato l'accesso sia al tuo account DressApp che al tuo account del guardaroba concorrente nello stesso browser.
- **Barra dei preferiti**: La barra dei preferiti del tuo browser deve essere visibile (Ctrl+Shift+B su Windows, Cmd+Shift+B su macOS).

## Istruzioni passo dopo passo
1. Apri la pagina del tuo **Profilo** DressApp sul tuo computer desktop e fai clic su **Import Wardrobe**.
2. Seleziona la tua vecchia app dall'elenco (Whering, Acloset, Stylebook, Smartli, BeautyAI, ecc.) o digita un nome personalizzato.
3. Trascina il pulsante del bookmarklet **Share & Start Agent** dallo schermo direttamente sulla barra dei preferiti del tuo browser.
4. Apri una nuova scheda, naviga alla versione web della tua vecchia app per il guardaroba ed effettua l'accesso. Vai alla pagina in cui tutti i tuoi articoli di abbigliamento sono visualizzati in una griglia.
5. Fai clic sul bookmarklet **Share & Start Agent** nella barra dei preferiti.
6. L'agente inizierà a scorrere la pagina, rilevando le immagini dei capi e trasmettendole a DressApp in lotti di 15. Non chiudere la scheda di DressApp durante questo processo.
7. Al termine della trasmissione, controlla la pagina del tuo armadio su DressApp. L'AI Stylist elaborerà gli elementi in background per compilare automaticamente gli attributi dei capi.

## Risultati attesi
- Le schede degli indumenti appariranno immediatamente nella griglia del tuo armadio su DressApp.
- I background vengono rimossi automaticamente, lasciando miniature pulite e trasparenti.
- I campi dei tag (categoria, colore, vestibilità, tessuto) si popoleranno automaticamente entro pochi minuti dall'importazione.

## Risoluzione dei problemi
- **Il bookmarklet non si installa**: Assicurati che la barra dei preferiti del browser sia abilitata. Se le impostazioni di sicurezza bloccano il trascinamento, fai clic con il pulsante destro del mouse sul pulsante, seleziona "Copia indirizzo link", crea manualmente un nuovo preferito e incolla il codice nel campo URL.
- **L'agente interrompe lo scorrimento**: Assicurati che la pagina del guardaroba concorrente sia attiva e non ridotta a icona. Se si blocca, aggiorna la pagina del concorrente e fai di nuovo clic sul bookmarklet.
- **Articoli duplicati**: L'importatore controlla le firme delle immagini (dHash) per filtrare automaticamente i caricamenti duplicati.

## Limitazioni
- **Solo desktop**: Non può essere eseguito su browser mobili a causa delle restrizioni API.
- **Chiarezza visiva**: Layout di abbigliamento altamente distorti, scuri o sovrapposti sull'app concorrente potrebbero far fallire l'estrazione visiva del ritaglio e richiedere successive regolazioni manuali delle foto.
