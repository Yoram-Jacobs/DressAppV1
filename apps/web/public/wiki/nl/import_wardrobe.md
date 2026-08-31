# Importeer je Garderobe - Gedetailleerde Gids

## Overzicht

Heb je je garderobe al in een andere app bijgehouden? Geen probleem!DressApp maakt het gemakkelijk om je bestaande garderobedata te importeren, zodat je niet opnieuw hoeft te beginnen.We ondersteunen importen van een breed scala aan populaire garderobe- en outfitplaning apps.

## Ondersteunde importbronnen

- **Cladwell** - Export your Cladwell wardrobe and import directly into DressApp
- **Stylebook** - Transfer your Stylebook inventory with ease
- **Acloset** - Import your Acloset items and outfits
- **SmartCloset** - Migrate your SmartCloset wardrobe data
- **CSV Files** - Import from any app that supports CSV export (generic format)
- **Other Apps** - Many other wardrobe apps support CSV export which DressApp can import

## Stapsgewijze importgids

### Stap 1: Open de Closet-pagina
Navigate to your **Closet** page in DressApp. This is where all your imported items will appear.

### Stap 2: Toegang tot de importfunctie
Look for the **Import** button on the Closet page. It's usually in the top-right corner or in the menu options.

### Stap 3: Selecteer de brong
Choose the app you're importing from from the list of supported apps. If your app isn't listed, select **CSV File** for a generic import option.

### Stap 4: Exporteer gegevens van de oude app
Follow the instructions for your specific app:
- **Cladwell**: Go to Settings > Export Data > Download CSV
- **Stylebook**: Open Menu > Export > Choose CSV format
- **Acloset**: Navigate to Profile > Export Wardrobe > Download
- **SmartCloset**: Go to Settings > Data Management > Export
- **CSV Export**: Look for an export or download option in your app's settings

### Stap 5: Upload naar DressApp
Upload the exported file to DressApp. The system will automatically:
- Parse the data and map fields to DressApp's format
- Categorize items based on their type (tops, bottoms, dresses, etc.)
- Organize colors and sizes
- Import images if available in the export

### Stap 6: Beoordelen en aanpassen
After import completes:
- Review your items on the Closet page
- Fix any miscategorized items
- Add missing details (brand, price, purchase date)
- Remove any duplicates or test items

## Wat wordt geïmporteerd

Depending on the source app, the following data may be imported:
- Item names and descriptions
- Categories and subcategories
- Colors and patterns
- Sizes and measurements
- Brand information
- Purchase dates and prices
- Item images (if included in export)
- Wear history (if supported)

## Probleemoplossing

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

## Heb je hulp nodig?

If you run into issues with importing:
- Check the troubleshooting section above
- Contact support through the Help menu
- Join our community forum for tips from other users

---

*Laatste update: juli 2026*
# Importeer uw garderobe uit andere apps (Migratie vanaf concurrenten)

## Overzicht
Als u uw kleding al heeft gecatalogiseerd in een andere garderobe-app (zoals Whering, Acloset of Stylebook), hoeft u niet vanaf nul te beginnen. DressApp beschikt over een slimme **Desktop Wardrobe Migration Agent** (via een browserbookmarklet) die uw oude kledingpagina crawlt, de kaarten van uw kledingstukken vastlegt en deze automatisch uploadt naar DressApp. Onze AI draait vervolgens op de achtergrond om automatisch de kleuren, merken, stoffen en categorieën van uw kleding te identificeren.

## Vereisten
- **Desktopcomputer**: De migratiebookmarklet vereist desktopbrowserfunctionaliteiten (Chrome, Edge of Safari). Mobiele apparaten of tablets worden niet ondersteund.
- **Actieve accounts**: U moet in dezelfde browser zijn ingelogd op zowel uw DressApp-account als het account van uw concurrent.
- **Bladwijzerbalk**: De bladwijzerbalk van uw browser moet zichtbaar zijn (Ctrl+Shift+B op Windows, Cmd+Shift+B op macOS).

## Stap-voor-stap instructies
1. Open uw DressApp-**Profielpagina** op uw desktopcomputer en klik op **Import Wardrobe**.
2. Selecteer uw oude app in de lijst (Whering, Acloset, Stylebook, Smartli, BeautyAI, etc.) of voer een aangepaste naam in.
3. Sleep de bookmarklet-knop **Share & Start Agent** vanaf het scherm rechtstreeks naar de bladwijzerbalk van uw browser.
4. Open een nieuw tabblad, navigeer naar de webversie van uw oude garderobe-app en log in. Ga naar de pagina waar al uw kledingstukken in een raster worden weergegeven.
5. Klik op de bookmarklet **Share & Start Agent** in uw bladwijzerbalk.
6. De agent begint met scrollen, detecteert afbeeldingen van kledingstukken en streamt deze in batches van 15 naar DressApp. Sluit het DressApp-tabblad niet tijdens dit proces.
7. Zodra het streamen is voltooid, controleert u uw DressApp Closet-pagina. De AI Stylist verwerkt de items op de achtergrond om kledingkenmerken automatisch in te vullen.

## Verwachte resultaten
- Kledingkaarten verschijnen onmiddellijk in het raster van uw DressApp-kledingkast.
- Achtergronden worden automatisch verwijderd, waardoor schone, transparante miniaturen overblijven.
- Tagvelden (categorie, kleur, pasvorm, stof) worden binnen enkele minuten na import automatisch ingevuld.

## Probleemoplossing
- **Bookmarklet wil niet installeren**: Zorg ervoor dat de bladwijzerbalk van uw browser is ingeschakeld. Als beveiligingsinstellingen het slepen blokkeren, klikt u met de rechtermuisknop op de knop, selecteert u "Linkadres kopiëren", maakt u handmatig een nieuwe bladwijzer en plakt u de code in het URL-veld.
- **Agent stopt met scrollen**: Zorg ervoor dat de kledingkastpagina van de concurrent actief is en niet is geminimaliseerd. Als deze vastloopt, vernieuwt u de pagina van de concurrent en klikt u nogmaals op de bookmarklet.
- **Dubbele items**: De importeur controleert de afbeeldingshandtekeningen (dHash) om dubbele uploads automatisch te filteren.

## Beperkingen
- **Alleen desktop**: Kan niet worden uitgevoerd op mobiele browsers vanwege API-beperkingen.
- **Visuele helderheid**: Zeer vervormde, donkere of overlappende kledinglay-outs op de app van de concurrent kunnen ertoe leiden dat de visuele uitsnede mislukt en vereisen later handmatige foto-aanpassingen.
