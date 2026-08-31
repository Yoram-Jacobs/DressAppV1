# Interaktiver KI-Stylist

Interagieren Sie mit einem intelligenten persönlichen Stylisten, der Ihre Garderobe, das Wetter und Ihren Zeitplan kennt.

## Übersicht
Der KI-Stylist verarbeitet Styling-Anfragen in natürlicher Sprache per Sprache oder Text und integriert automatisch Wetterbedingungen, Kalenderereignisse und Push-Benachrichtigungen basierend auf threadsicheren `useSyncExternalStore` Custom-Stores (`stylistStore` und `dailySuggestionsStore`) mit 15-Minuten-Caching und In-Flight-Anfragendeduplizierung.

## Voraussetzungen
- Ein Gemini-API-Schlüssel (oder Standard-Systemguthaben).
- Verknüpfte Kalenderereignisse.

## Schritt für Schritt
1. **Sitzung starten**: Öffnen Sie die Registerkarte Stylist und wählen Sie Chat, Shuffle oder Match.
2. **Spracheingabe**: Tippen Sie auf das Mikrofon, sprechen Sie Ihre Anfrage (z. B. „Schlage ein Outfit für einen Regentag vor“) und tippen Sie auf Senden.
3. **Audio-Wiedergabe**: Hören Sie sich die generierte Styling-Begründung über den High-Fidelity-Sprachplayer an.
4. **Shuffle**: Klicken Sie auf die Schaltfläche Sparkles, um die Slot-Maschine zu drehen; die KI richtet passende Elemente automatisch im Fokus aus.
5. **Zero-Idle-Navigation**: Die Navigation zwischen dem Stylist und anderen Registerkarten nutzt im Speicher zwischengespeicherte Präferenzen, ohne Datenbank-GET-Anfrageschleifen auszulösen.

## Erwartete Ergebnisse
Maßgeschneiderte Outfit-Layouts, die auf Ihre persönlichen Vorlieben, saisonalen Einschränkungen und Ihren Zeitplan abgestimmt sind.

## Fehlerbehebung
- **Audio wird zu langsam wiedergegeben**: Wechseln Sie in den Profile-Einstellungen zwischen Gemini TTS und dem Web Speech API Fallback.
- **Wiederholte Vorschläge**: Stellen Sie sicher, dass Ihre Outfit-Kalenderhistorie aktualisiert ist, damit der Rotationsalgorithmus wiederholtes Tragen blockieren kann.

## Einschränkungen
- Empfehlungen erfordern mindestens ein Oberteil, ein Unterteil und ein Paar Schuhe im Kleiderschrank, um einen Look zu vervollständigen.
- Die Sprachtranskription kann auf nicht unterstützten Edge-Geräten auf Standard-Texteingabe zurückgreifen.