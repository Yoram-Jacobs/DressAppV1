# Importieren Sie Ihre Garderobe aus anderen Apps (Migration von Mitbewerbern)

## Übersicht
Wenn Sie Ihre Kleidung bereits in einer anderen Garderoben-App (wie Whering, Acloset oder Stylebook) katalogisiert haben, müssen Sie nicht von vorne beginnen. DressApp verfügt über einen intelligenten **Desktop Wardrobe Migration Agent** (über ein Browser-Bookmarklet), der Ihre alte Garderobenseite crawlt, Ihre Kleidungsstück-Karten erfasst und sie automatisch in DressApp hochlädt. Unsere KI läuft dann im Hintergrund, um Farben, Marken, Stoffe und Kategorien Ihrer Kleidung automatisch zu identifizieren.

## Voraussetzungen
- **Desktop-Computer**: Das Migrations-Bookmarklet erfordert Desktop-Browser-Funktionen (Chrome, Edge oder Safari). Es wird auf Mobilgeräten oder Tablets nicht unterstützt.
- **Aktive Konten**: Sie müssen im selben Browser sowohl in Ihrem DressApp-Konto als auch im Konto der Mitbewerber-Garderobe angemeldet sein.
- **Lesezeichenleiste**: Die Lesezeichenleiste Ihres Browsers muss sichtbar sein (Strg+Shift+B unter Windows, Cmd+Shift+B unter macOS).

## Schritt-für-Schritt-Anleitung
1. Öffnen Sie Ihre DressApp-**Profil**-Seite auf Ihrem Desktop-Computer und klicken Sie auf **Import Wardrobe**.
2. Wählen Sie Ihre alte App aus der Liste aus (Whering, Acloset, Stylebook, Smartli, BeautyAI usw.) oder geben Sie einen benutzerdefinierten Namen ein.
3. Ziehen Sie die Bookmarklet-Schaltfläche **Share & Start Agent** direkt vom Bildschirm in die Lesezeichenleiste Ihres Browsers.
4. Öffnen Sie einen neuen Tab, navigieren Sie zur Webversion Ihrer alten Garderoben-App und melden Sie sich an. Gehen Sie zu der Seite, auf der alle Ihre Kleidungsstücke in einem Raster angezeigt werden.
5. Klicken Sie auf das Bookmarklet **Share & Start Agent** in Ihrer Lesezeichenleiste.
6. Der Agent beginnt mit dem Scrollen, erkennt Bilder von Kleidungsstücken und überträgt sie in Chargen von 15 Stück an DressApp. Schließen Sie den DressApp-Tab während dieses Vorgangs nicht.
7. Sobald die Übertragung abgeschlossen ist, überprüfen Sie Ihre DressApp-Closet-Seite. Der AI Stylist verarbeitet die Artikel im Hintergrund, um die Attribute der Kleidungsstücke automatisch auszufüllen.

## Erwartete Ergebnisse
- Kleidungsstück-Karten werden sofort in Ihrem DressApp-Closet-Raster angezeigt.
- Hintergründe werden automatisch entfernt, sodass saubere, transparente Thumbnails übrig bleiben.
- Tag-Felder (Kategorie, Farbe, Passform, Stoff) werden innerhalb weniger Minuten nach dem Import automatisch ausgefüllt.

## Fehlerbehebung
- **Bookmarklet lässt sich nicht installieren**: Stellen Sie sicher, dass die Lesezeichenleiste Ihres Browsers aktiviert ist. Wenn Sicherheitseinstellungen das Ziehen blockieren, klicken Sie mit der rechten Maustaste auf die Schaltfläche, wählen Sie "Linkadresse kopieren", erstellen Sie manuell ein neues Lesezeichen und fügen Sie den Code in das URL-Feld ein.
- **Agent stoppt das Scrollen**: Stellen Sie sicher, dass die Garderobenseite des Mitbewerbers aktiv und nicht minimiert ist. Wenn der Vorgang ins Stocken gerät, aktualisieren Sie die Seite des Mitbewerbers und klicken Sie erneut auf das Bookmarklet.
- **Doppelte Artikel**: Der Importer überprüft die Bildsignaturen (dHash), um doppelte Uploads automatisch herauszufiltern.

## Einschränkungen
- **Nur Desktop**: Kann aufgrund von API-Einschränkungen nicht auf mobilen Browsern ausgeführt werden.
- **Visuelle Klarheit**: Stark verzerrte, dunkle oder überlappende Kleidungslayouts auf der App des Mitbewerbers können bei der visuellen Zuschnitt-Extraktion fehlschlagen und erfordern später manuelle Fotoanpassungen.