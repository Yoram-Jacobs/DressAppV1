# Morgenplan & Push-Benachrichtigungen

Starten Sie Ihren Tag mit automatischen, wettergerechten Stilempfehlungen, die direkt auf Ihr Gerät geliefert werden.

## Übersicht
Der Morgenplaner automatisiert Ihre Outfit-Auswahl, indem er jeden Morgen maßgeschneiderte Stilvorschläge liefert. Er prüft die lokale Wettervorhersage und Ihre täglichen Aktivitäten (über Google Kalender), um drei passende Optionen zu generieren. Tippen Sie auf die Benachrichtigung, um die Optionen auf Ihrem persönlichen Avatar anzuzeigen, Ihre bevorzugte Wahl zu speichern und sofort die Wetterkompatibilitätswerte anzuzeigen.

## Voraussetzungen
- **Benachrichtigungen erlaubt**: Push-Benachrichtigungen müssen in Ihren Geräte- oder Browsereinstellungen für DressApp aktiviert sein.
- **Garderobenartikel**: Sie müssen mindestens ein Oberteil, ein Unterteil und ein Paar Schuhe in Ihren Kleiderschrank hochgeladen haben.
- **Google Kalender**: Ein verknüpftes Google Kalender-Konto (optional, aber empfohlen, um Vorschläge ereignisabhängig zu machen).
- **Gemini-Schlüssel**: Ein in Ihren Einstellungen konfigurierter benutzerdefinierter Gemini-API-Schlüssel.

## Schritt-für-Schritt-Anleitung
1. **Benachrichtigungen aktivieren**: Gehen Sie zu **Profileinstellungen** -> **Planer & Push**. Stellen Sie den Benachrichtigungsschalter auf „Aktiviert“.
2. **Uhrzeit einstellen**: Stellen Sie die genaue Stunde und Minute ein, zu der Sie Ihren Vorschlag erhalten möchten (z. B. 07:30 Uhr).
3. **Kalender verknüpfen**: Verbinden Sie unter Kalendereinstellungen Ihr Google Kalender-Konto, damit die KI Ihren Zeitplan kennt.
4. **Vorschlag öffnen**: Wenn der morgendliche Push-Alarm eintrifft, klicken Sie darauf. Sie werden direkt zum Tab **Täglicher Vorschlag** (Match) unter **Stylist** weitergeleitet.
5. **Optionen anzeigen**: Die Auswahl **Outfit planen** öffnet sich automatisch und zeigt Ihre drei gestylten Kombinationen direkt auf Ihrem Avatar an.
6. **Speichern und Überprüfen**: Tippen Sie auf einen der täglichen Vorschläge, um ihn in Ihrem Kalender zu planen. Die App speichert das Outfit und öffnet sofort ein Detailfenster, das die Wetterkompatibilitätswerte anzeigt (Farbharmonie, Temperaturanpassung und Stilkonstanz).

## Erwartete Ergebnisse
Täglich wird eine Benachrichtigung zu der von Ihnen gewählten Zeit zugestellt. Durch Klicken darauf wird die App geöffnet, es werden drei Optionen auf Ihrem Avatar angezeigt und Sie können eine davon mit vollständigen Kompatibilitätsdetails in Ihrem Kalender speichern.

## Fehlerbehebung
- **Keine Benachrichtigungen erhalten**: 
  - Stellen Sie sicher, dass Benachrichtigungen für die DressApp-Website in den Website-Einstellungen Ihres Browsers oder in den Einstellungen Ihres Betriebssystems zugelassen sind.
  - Stellen Sie sicher, dass sich Ihr Gerät während der geplanten Benachrichtigungszeit nicht im Modus „Bitte nicht stören“ oder „Fokus“ befindet.
- **Fehlende Kleidungsstücke auf dem Avatar**: 
  - Stellen Sie sicher, dass sich Kleidungsstücke aus allen Basiskategorien (Oberteile, Unterteile, Schuhe) in Ihrem Kleiderschrank befinden, damit der Planer den Avatar richtig einkleiden kann.
- **Generische Empfehlungen**: 
  - Verknüpfen Sie Ihren Google Kalender, damit die Vorschläge auf Ihre spezifischen täglichen Ereignisse abgestimmt sind.

## Einschränkungen
- Sie können maximal ein Outfit pro Tag in Ihrem Kalender planen.
- Wetteraktualisierungen erfordern eine aktive Internetverbindung auf dem Server.
