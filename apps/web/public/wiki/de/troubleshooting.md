# Fehlerbehebung & hilfreiche Lösungen

Schnelle und einfache Antworten auf häufige Fragen, Berechtigungen, Kontolimits und KI-Schlüssel.

## Übersicht
Hier finden Sie schnelle Lösungen für Kamerazugriff, Bildverarbeitungszeiten, Kleiderschranklimits, Audioeinstellungen und KI-Hinweise für ein reibungsloses Styling-Erlebnis.

## Voraussetzungen
- Eine aktive Internetverbindung.
- Ein moderner Webbrowser (Google Chrome oder Apple Safari empfohlen) oder die DressApp Mobile App.

## Schritt-für-Schritt-Anleitung
1. **Kamera schaltet sich nicht ein**:
   - Öffnen Sie Ihre Browser- oder Geräteeinstellungen, suchen Sie nach **DressApp** und stellen Sie sicher, dass der **Kamerazugriff** auf "Erlauben" steht. Laden Sie die Seite neu.
2. **Meldung „Kleiderschrank-Kapazität erreicht“**:
   - Kostenlose Konten speichern standardmäßig bis zu **50 Kleidungsstücke**.
   - Sie können Freunde einladen und **+10 kostenlose Plätze** pro Registrierung erhalten (bis maximal 150 Artikel), ungetragene Kleidung löschen oder auf **Pro upgraden** (4,99 $/Monat) für unbegrenzten Speicherplatz.
3. **Spracheingabe oder Sprachwiedergabe reagiert nicht**:
   - Prüfen Sie, ob der Zugriff auf das Mikrofon in Ihren Browsereinstellungen gestattet ist.
   - Stellen Sie sicher, dass Ihr Lautsprecher nicht stummgeschaltet oder im "Nicht stören"-Modus ist.
4. **Bilder brauchen Zeit zur Verarbeitung**:
   - Fotos mit mehreren Kleidungsstücken benötigen einen kurzen Moment, während die KI Hintergründe entfernt, Schnittränder prüft und Mode-Tags extrahiert. Dies geschieht im Hintergrund.
5. **Hinweis "Plattform-Stylist verwendet (Quota Fallback)"**:
   - Wenn Sie einen persönlichen Google Gemini API-Schlüssel hinterlegt haben und dieser die Ratenbegrenzung (`429 Too Many Requests`) oder das Kontingent erreicht, fängt DressApp dies automatisch ab und beantwortet die Anfrage über unser lokales Gemma-4-E4B-Modell. Ihre Anfrage wird nie mit einem Fehler abbrechen! Sie können Ihr Kontingent im Google AI Studio prüfen oder weiter die integrierte KI nutzen.
6. **Meldung "API-Schlüssel erforderlich (403)" bei Trend Scout oder Nano Banana**:
   - Trend Scout und Nano Banana Bildreparaturen erfordern einen persönlichen Google Gemini API-Schlüssel. Sie erhalten einen kostenlosen Schlüssel im [Google AI Studio](https://aistudio.google.com/) und können ihn unter **Profil** (`/me`) &rarr; **KI-Konfiguration** eintragen.
7. **Google Kalender verbinden**:
   - Gehen Sie auf **Profil** &rarr; **Google Kalender** und tippen Sie auf **Verbinden**, damit der Stylist anstehende Termine berücksichtigen kann.

## Erwartete Ergebnisse
Schnelle Behebung typischer Fragen, damit Ihr digitaler Kleiderschrank einwandfrei funktioniert.

## Fehlerbehebung
- **Problem besteht weiterhin?** Melden Sie sich ab und wieder an oder leeren Sie Ihren Browser-Cache.
- **RTL-Sprachanzeige**: Auf Hebräisch und Arabisch spiegelt sich die Benutzeroberfläche für eine natürliche Lesbarkeit automatisch nach rechts.

## Einschränkungen
- Der Import von Konkurrenz-Apps erfordert einen Desktop-Browser und funktioniert nicht auf Mobiltelefonen.
- Trend Scout und Nano Banana erfordern einen persönlichen Google Gemini API-Schlüssel.
