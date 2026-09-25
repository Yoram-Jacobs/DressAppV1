# Gemma 4 E4B / E2B — Agenten-Wissens- & Inferenzleitfaden

**Zielgruppe:** Zukünftige KI-Agenten, Maintainer und ML-Ingenieure der DressApp Eyes Vision- und Styling-Pipeline.  
**Datum:** September 2026  
**Status:** Aktiv in Produktion (`gemma-4-E4B-it-Q3_K_M.gguf` + `mmproj-BF16.gguf`)

Dieses Dokument beschreibt die Architektur, Inferenzregeln und Systemrollen des feinabgestimmten Modells `gemma-4-E4B-it` im DressApp-Ökosystem.

---

## 1. Architektur-Fakten
- **Modellprofil:** Google Gemma-4-E4B ist ein multimodales Vision-Language-Modell mit effektiv 4 Milliarden Parametern (~4,5 Mrd. insgesamt), das Per-Layer Embeddings (PLE) nutzt. In Produktion ist es auf `Q3_K_M` quantisiert (~2,7 GB Festplatte, ~2,85 GB RAM), was eine schnelle CPU-Ausführung auf dem Hetzner Cloud CPX32 VPS (4 AMD vCPUs) ermöglicht.
- **Kontextfenster:** Bis zu 128K Token (im Container `dressapp-eyes` auf 4.096 Token optimiert).
- **Multimodale Eingaben:** Native Unterstützung für Bilder, Audio und Text über den Projektor `mmproj-BF16.gguf`.
- **Produktionsserver:** Führt `llama-server` auf Port 7860 im Docker-Container `dressapp-eyes` aus, geschützt durch ein FastAPI-Sicherheits-Token (`EYES_API_TOKEN`).

## 2. Produktionsrollen & Multi-Tier Routing
1. **Free-Tier Kern**: Übernimmt Styling-Dialoge und Modemerkmals-Erkennung für kostenlose Konten ohne eigene API-Schlüssel.
2. **Hintergrund-Cronjobs**: Führt tägliche Garderoben-Indexierungen und Morgenempfehlungen ohne Cloud-Kosten aus.
3. **Automatischer Quoten-Fallback**: Fängt Ratenbegrenzungen (`429`), `RESOURCE_EXHAUSTED` und Quotenüberschreitungen externer Anbieter (Google Gemini) ab und leitet Anfragen unterbrechungsfrei an das On-Prem-Gemma weiter.
4. **Funktionsgrenzen**: Teure generative Cloud-Dienste (Trend Scout und Nano Banana Fotorekonstruktion) erfordern zwingend benutzereigene API-Schlüssel.

## 3. Inferenz & Prompting
- **Thinking Mode**: Gemma-4 unterstützt Chain-of-Thought; bei strukturierten JSON-Ausgaben wird dies gedeckelt, um Trunkierungen zu vermeiden.
- **Sampling-Parameter**: `temperature = 0.3`, `max_tokens = 3000`.
- **Gemessene Benchmarks (Hetzner CPX32)**:
  - Promptverarbeitung: ~32 Token/Sekunde.
  - Tokengenerierung: ~16,5 Token/Sekunde.
  - RAM-Bedarf: ~2,85 GB innerhalb des 8-GB-Budgets.
