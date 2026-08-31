# Importa il tuo Guardaroba - Guida Dettagliata

## Panoramica

Hai già il tuo guardaroba registrato in un'altra app? Nessun problema!DressApp rende facile importare i tuoi dati di guardaroba esistenti così non devi ricominciare da capo.Supportiamo importazioni da un'ampia gamma di app popolari per la pianificazione di guardaroba e outfit.

## Fonti di importazione supportate

- **Cladwell** - Export your Cladwell wardrobe and import directly into DressApp
- **Stylebook** - Transfer your Stylebook inventory with ease
- **Acloset** - Import your Acloset items and outfits
- **SmartCloset** - Migrate your SmartCloset wardrobe data
- **CSV Files** - Import from any app that supports CSV export (generic format)
- **Other Apps** - Many other wardrobe apps support CSV export which DressApp can import

## Guida passo-passo per l'importazione

### Passo 1: Apri la pagina del Closet
Navigate to your **Closet** page in DressApp. This is where all your imported items will appear.

### Passo 2: Accedi alla funzione di importazione
Look for the **Import** button on the Closet page. It's usually in the top-right corner or in the menu options.

### Passo 3: Seleziona l'app sorgente
Choose the app you're importing from from the list of supported apps. If your app isn't listed, select **CSV File** for a generic import option.

### Passo 4: Esporta i dati dall'app vecchia
Follow the instructions for your specific app:
- **Cladwell**: Go to Settings > Export Data > Download CSV
- **Stylebook**: Open Menu > Export > Choose CSV format
- **Acloset**: Navigate to Profile > Export Wardrobe > Download
- **SmartCloset**: Go to Settings > Data Management > Export
- **CSV Export**: Look for an export or download option in your app's settings

### Passo 5: Carica su DressApp
Upload the exported file to DressApp. The system will automatically:
- Parse the data and map fields to DressApp's format
- Categorize items based on their type (tops, bottoms, dresses, etc.)
- Organize colors and sizes
- Import images if available in the export

### Passo 6: Rivedi e adatta
After import completes:
- Review your items on the Closet page
- Fix any miscategorized items
- Add missing details (brand, price, purchase date)
- Remove any duplicates or test items

## Cosa viene importato

Depending on the source app, the following data may be imported:
- Item names and descriptions
- Categories and subcategories
- Colors and patterns
- Sizes and measurements
- Brand information
- Purchase dates and prices
- Item images (if included in export)
- Wear history (if supported)

## Risoluzione problemi

### Import Failed
- Check that the file format is correct (CSV, JSON, or app-specific format)
- Ensure the file isn't corrupted or too large
- Try exporting again from the source app

### Missing Items After Import
- Some fields may not have mapped correctly
- Check the import results page for warnings
- Manually add missing items if needed

### Images Not Imported
- Not all apps include images in their export files
- You can add images manually to imported items later
- Use the camera or upload function on the item detail page

## Hai bisogno di aiuto?

If you run into issues with importing:
- Check the troubleshooting section above
- Contact support through the Help menu
- Join our community forum for tips from other users

---

*Ultima aggiornamento: luglio 2026*
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
