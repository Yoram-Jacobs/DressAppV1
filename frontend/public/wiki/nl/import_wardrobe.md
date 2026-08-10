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