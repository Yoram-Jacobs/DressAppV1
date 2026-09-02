# Outfit-Planer & Canvas

Entwerfen, schichten und überprüfen Sie koordinierte Layouts.

## Übersicht
Der Outfit-Planer bietet eine visuelle 2D-Avatar-Canvas (die sowohl Freistellungen echter Körperfotos von Benutzern als auch dynamische Vektor-SVG-Mannequins unterstützt) mit kalibrierten Landmark-Offsets (`top-[14.5%]` Kragen bis Ausschnitt und `top-[36.5%]` Bund bis Taille), um Oberteile, Unterteile, Oberbekleidung und Schuhe bündig an den Körpergrenzen zu schichten.

## Voraussetzungen
- Gespeicherte Garderobenartikel.

## Schritt für Schritt
1. **Canvas auswählen**: Öffnen Sie den Planer und klicken Sie auf einen Tag oder einen neuen Entwurf.
2. **Artikel schichten**: Ziehen Sie Kleidungsstücke auf den 2D-Avatar. Oberbekleidung wird automatisch über Hemden geschichtet.
3. **Passform bewerten**: Überprüfen Sie Kompatibilitätswerte und Warnungen (z. B. Farbkonflikte oder Wetterwarnungen).
4. **Speichern**: Legen Sie einen Titel fest und planen Sie den Look in Ihrem Garderobentagebuch. Aktualisierungen werden threadsicher über `useOutfitStore` gestreamt.

## Erwartete Ergebnisse
Wunderschön geschichtete Outfit-Kompositionen, die in Ihrem Kalender gespeichert sind und als Rasterkarten-Vorschauen ohne Hintergrund-Netzwerkanfrage-Polling-Schleifen sichtbar sind.

## Fehlerbehebung
- **Ebenenreihenfolge falsch**: Überprüfen Sie die Kategorie des Artikels erneut; Oberbekleidung muss als „Outerwear“ klassifiziert sein, um korrekt geschichtet zu werden.
- **Überlappungswarnungen**: Wenn der Avatar vor wiederholtem Tragen warnt, prüfen Sie, ob Sie dasselbe Outfit kürzlich am selben Ort getragen haben.

## Einschränkungen
- Ebenen werden automatisch basierend auf Kategorie-Tags verwaltet; manuelle z-index Überschreibungen werden nicht unterstützt.