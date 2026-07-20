# Profiel, Maten & Configuratie

Finetune uw afmetingen, bescheidenheidsbeperkingen en AI-inloggegevens.

## Overzicht
De sectie Profiel houdt uw stylingcontext up-to-date en beheert fysieke lichaamsmetingen, selectie van huidskleurpaletten, uitsneden van foto's van het volledige lichaam, stylingregels, aangepaste AI-API-sleutels, campagnemeldingen en lokale regio-instellingen.

## Vereisten
- Actief DressApp-gebruikersaccount.

## Stap-voor-stap
1. **Voer metingen & ANSUR II maten in**: Voer basis fysieke parameters in (Lengte, Gewicht, Taille, Voetlengte). Het ANSUR II-regressiemodel berekent automatisch uw 6 structurele dimensies (Schouders, Borst, Heup, Armlengte, Binnenbeenlengte, Buitenbeenlengte).
2. **Huidskleur & Lichaamsfoto uitsnijden**: Selecteer uw huidskleur uit het kleurenpalet of upload een foto van het volledige lichaam. Het systeem voert automatisch U2-Net achtergrondmatting uit om pasvoorbeelden op een echt lichaam te tonen. Klik op *Foto verwijderen* om direct terug te keren naar de 2D SVG vector mannequin.
3. **Regels opgeven**: Selecteer te vermijden stijlen (bijv. "geel vermijden") en bescheidenheidsniveaus.
4. **AI-configuratie**: Voer uw aangepaste Google AI Studio-sleutels in of selecteer de standaard providermodus.
5. **Campagnemeldingen**: Vouw de *Campagnemeldingen*-accordeon uit om e-mail- of pushmeldingen in te schakelen voor lokale promoties, uitverkoop en nieuwe stylisten in uw buurt, en pas de frequentie (Direct, Dagelijks, Wekelijks) en maximale afstand (5km, 10km, 25km, 50km) aan.
6. **Account beheren**: Bekijk uw abonnementsniveau (Pro vs Free limiet van 150 artikelen) of vraag accountverwijdering aan.

## Verwachte resultaten
- Gepersonaliseerde 2D-avatar en outfit-layouts die precies overeenkomen met uw vorm, huidskleur en kledingstijlvoorkeuren.
- Meldingen worden geleverd via uw geselecteerde kanalen wanneer actieve campagnes overeenkomen met uw stylingregels en binnen uw gekozen afstandsstraal vallen.

## Probleemoplossing
- **API-sleutel ongeldig**: Controleer of u de sleutel correct hebt gekopieerd uit Google AI Studio zonder extra spaties.
- **Fotochtergrond niet schoon**: Zorg ervoor dat uw foto van het volledige lichaam duidelijke verlichting heeft tegen een contrasterende achtergrond.
- **Kalender synchroniseert niet**: Ontkoppel en herauthenticeer uw Google-account om tokens te vernieuwen.
- **Geen campagnes ontvangen**: Zorg ervoor dat uw *Locatievoorzieningen* zijn ingeschakeld en dat uw maximale afstandsinstelling de lokale bedrijfslocatie dekt.

## Beperkingen
- Aangepaste regels worden strikt toegepast; als uw regels te strikt zijn, vindt de stylist mogelijk geen passende outfits.
- Pushmeldingen voor campagnes vereisen toestemming voor browsermeldingen. Indien geblokkeerd, ontvangt u alleen e-mailmeldingen.