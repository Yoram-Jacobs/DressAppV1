# Gemma 4 E4B / E2B — Guide d'inférence et connaissances système

**Public cible :** Agents IA, développeurs et ingénieurs ML travaillant sur l'infrastructure vision et styliste de DressApp Eyes.  
**Date :** Septembre 2026  
**Statut :** En production (`gemma-4-E4B-it-Q3_K_M.gguf` + `mmproj-BF16.gguf`)

Ce document consigne les spécifications techniques et les règles d'inférence du modèle affiné `gemma-4-E4B-it` au sein de DressApp.

---

## 1. Caractéristiques architecturales
- **Profil du modèle :** Google Gemma-4-E4B est un modèle vision-langage multimodal de 4 milliards de paramètres effectifs (~4,5B au total) utilisant des Per-Layer Embeddings (PLE). En production, il est quantifié en `Q3_K_M` (~2,7 Go disque, ~2,85 Go RAM résidente), garantissant d'excellentes performances sur CPU nu chez Hetzner (VPS CPX32, 4 vCPUs AMD).
- **Fenêtre de contexte :** Jusqu'à 128K tokens (configuré à 4 096 tokens dans `dressapp-eyes` pour une latence minimale).
- **Entrées multimodales :** Prise en charge native d'images, de son et de texte via le projecteur `mmproj-BF16.gguf`.
- **Serveur de production :** Exécute `llama-server` sur le port 7860 dans le conteneur Docker `dressapp-eyes`, sécurisé par FastAPI (`EYES_API_TOKEN`).

## 2. Rôles en production & Routage multi-niveaux
1. **Moteur du forfait gratuit** : Traite les échanges de stylisme interactifs et l'extraction de critères vestimentaires pour les comptes gratuits sans clé d'API.
2. **Tâches d'arrière-plan (Cron)** : Indexation quotidienne et propositions matinales sans générer de facturation API externe.
3. **Bascule de secours de quota (Quota Fallback)** : Capture en toute transparence les dépassements de limite de débit (`429`) ou `RESOURCE_EXHAUSTED` des clés tierces et redirige les requêtes vers le Gemma local sans échec ni message d'erreur.
4. **Frontières des offres** : Les fonctionnalités génératives avancées (Trend Scout et restauration d'image Nano Banana) requièrent la clé personnelle fournie par l'utilisateur.

## 3. Paramètres d'inférence
- `temperature = 0.3`, `max_tokens = 3000`.
- Débit mesuré (Hetzner CPX32) : Traitement de prompt ~32 tokens/sec, génération ~16,5 tokens/sec, RAM ~2,85 Go.
