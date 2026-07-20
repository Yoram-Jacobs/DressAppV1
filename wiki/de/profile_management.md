# Profil, Größen & Konfiguration

Passen Sie Ihre Maße, Beschränkungen bezüglich Angemessenheit und AI-Anmeldedaten an.

## Übersicht
Der Profilbereich hält Ihren Styling-Kontext auf dem neuesten Stand und verwaltet physische Körpermaße, die Auswahl der Hauttonpalette, Ganzkörper-Fotoausschnitte, Styling-Regeln, benutzerdefinierte KI-API-Schlüssel, Kampagnenbenachrichtigungen und lokale Regionseinstellungen.

## Voraussetzungen
- Aktives DressApp-Benutzerkonto.

## Schritt für Schritt
1. **Maße & ANSUR II Größeneingabe**: Geben Sie grundlegende physische Parameter ein (Größe, Gewicht, Taille, Fußlänge). Das ANSUR II Regressionsmodell berechnet automatisch Ihre 6 strukturellen Dimensionen (Schultern, Brust, Hüfte, Armlänge, Innenbeinlänge, Außenbeinlänge).
2. **Hautton & Körper-Fotoausschnitt**: Wählen Sie Ihren Hautton aus der Farbpalette oder laden Sie ein Ganzkörperfoto hoch. Das System führt automatisch eine U2-Net-Hintergrundfreistellung durch, um Echtkörper-Anlauf-Vorschauen anzuzeigen. Klicken Sie auf *Foto entfernen*, um sofort zum 2D-SVG-Vektormannequin zurückzukehren.
3. **Regeln festlegen**: Wählen Sie Stil-Ausschlüsse (z. B. „Gelb vermeiden“) und Angemessenheitsstufen aus.
4. **KI-Konfiguration**: Geben Sie Ihre benutzerdefinierten Google AI Studio Schlüssel ein oder wählen Sie den Standard-Providermodus.
5. **Kampagnenbenachrichtigungen**: Erweitern Sie das *Kampagnenbenachrichtigungen*-Akkordeon, um E-Mail- oder Push-Benachrichtigungen für lokale Werbeaktionen, Verkäufe und neue Stylisten in Ihrer Nähe zu aktivieren, und passen Sie die Häufigkeit (Sofort, Täglich, Wöchentlich) sowie die maximale Entfernung (5km, 10km, 25km, 50km) an.
6. **Konto verwalten**: Zeigen Sie Ihr Abonnement-Level an (Pro vs. Free Limit von 150 Artikeln) oder fordern Sie die Kontolöschung an.

## Erwartete Ergebnisse
- Personalisierter 2D-Avatar und Outfit-Layouts, die exakt Ihrer Form, Ihrem Hautton und Ihren Stilpräferenzen entsprechen.
- Benachrichtigungen werden über Ihre ausgewählten Kanäle zugestellt, wenn aktive Kampagnen Ihren Styling-Regeln entsprechen und innerhalb Ihres gewählten Entfernungsradius liegen.

## Fehlerbehebung
- **API-Schlüssel ungültig**: Überprüfen Sie, ob Sie den Schlüssel korrekt aus dem Google AI Studio ohne zusätzliche Leerzeichen kopiert haben.
- **Fotohintergrund nicht sauber**: Stellen Sie sicher, dass Ihr Ganzkörperfoto bei klarer Beleuchtung vor einem kontrastreichen Hintergrund aufgenommen wurde.
- **Kalender synchronisiert nicht**: Trennen Sie Ihr Google-Konto und authentifizieren Sie es erneut, um die Token zu aktualisieren.
- **Keine Kampagnen erhalten**: Stellen Sie sicher, dass Ihre *Standortdienste* aktiviert sind und dass Ihre maximale Entfernungseinstellung den lokalen Unternehmensstandort abdeckt.

## Einschränkungen
- Benutzerdefinierte Regeln werden strikt angewendet; wenn Ihre Regeln zu streng sind, findet der Stylist möglicherweise keine passenden Outfits.
- Kampagnen-Push-Benachrichtigungen erfordern Berechtigungen für Browser-Benachrichtigungen. Falls blockiert, erhalten Sie nur E-Mail-Benachrichtigungen.