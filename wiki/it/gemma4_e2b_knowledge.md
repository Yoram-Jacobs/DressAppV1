# Gemma 4 E4B / E2B — Guida all'inferenza e architettura per agenti

**Destinatari:** Agenti AI, manutentori e ingegneri ML della pipeline di visione e styling DressApp Eyes.  
**Data:** Settembre 2026  
**Stato:** Attivo in produzione (`gemma-4-E4B-it-Q3_K_M.gguf` + `mmproj-BF16.gguf`)

Questo documento raccoglie le specifiche architetturali e le regole operative del modello personalizzato `gemma-4-E4B-it` all'interno di DressApp.

---

## 1. Specifiche architetturali
- **Profilo del modello:** Google Gemma-4-E4B è un modello multimodale visione-linguaggio con 4 miliardi di parametri effettivi (~4.5B totali) che impiega Per-Layer Embeddings (PLE). In produzione è quantizzato in `Q3_K_M` (~2.7 GB su disco, ~2.85 GB di RAM residente), offrendo prestazioni eccellenti sulla CPU del VPS Hetzner CPX32 (4 vCPU AMD).
- **Finestra di contesto:** Fino a 128K token (impostata a 4.096 token in `dressapp-eyes` per massimizzare la reattività).
- **Input multimodali:** Supporto integrato per immagini, audio e testo tramite `mmproj-BF16.gguf`.
- **Server in produzione:** Esegue `llama-server` sulla porta 7860 nel container `dressapp-eyes`, protetto con token di autenticazione FastAPI (`EYES_API_TOKEN`).

## 2. Ruoli di produzione e instradamento
1. **Motore per account gratuiti**: Gestisce le sessioni di styling interattivo e l'estrazione delle caratteristiche dei capi senza richiedere chiavi API.
2. **Attività pianificate (Cron)**: Esegue l'indicizzazione quotidiana dell'armadio e i suggerimenti mattutini senza costi commerciali di API esterne.
3. **Fallback di emergenza della quota (Quota Fallback)**: Intercetta limiti di velocità (`429`) o `RESOURCE_EXHAUSTED` dai provider esterni e reindirizza la richiesta al modello locale Gemma senza errori per l'utente.
4. **Limiti dei piani**: Funzionalità generative cloud avanzate (Trend Scout e Nano Banana) richiedono la chiave API personale dell'utente.
