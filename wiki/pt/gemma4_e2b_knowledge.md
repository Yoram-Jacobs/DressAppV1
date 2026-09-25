# Gemma 4 E4B / E2B — Guia de conhecimento e inferência para agentes

**Público-alvo:** Agentes de IA, desenvolvedores e engenheiros de ML da infraestrutura de visão e estilo do DressApp Eyes.  
**Data:** Setembro de 2026  
**Status:** Ativo em produção (`gemma-4-E4B-it-Q3_K_M.gguf` + `mmproj-BF16.gguf`)

Este documento registra a arquitetura, regras de inferência e papéis de produção do modelo personalizado `gemma-4-E4B-it` no DressApp.

---

## 1. Especificações técnicas
- **Perfil do modelo:** Google Gemma-4-E4B é um modelo multimodal de visão e linguagem com 4 bilhões de parâmetros efetivos (~4.5B no total) utilizando Per-Layer Embeddings (PLE). Em produção, é quantizado em `Q3_K_M` (~2.7 GB de disco, ~2.85 GB de memória RAM), proporcionando excelente desempenho na CPU do VPS Hetzner CPX32 (4 vCPUs AMD).
- **Janela de contexto:** Até 128K tokens (configurado para 4.096 tokens no `dressapp-eyes` para resposta rápida).
- **Entradas multimodais:** Suporte a imagens, áudio e texto através do `mmproj-BF16.gguf`.
- **Servidor em produção:** Executa `llama-server` na porta 7860 no contêiner `dressapp-eyes`, protegido por token FastAPI (`EYES_API_TOKEN`).

## 2. Papéis em produção e roteamento multinível
1. **Núcleo do plano gratuito**: Alimenta o styling conversacional e a extração de atributos para usuários do plano gratuito sem chave de API.
2. **Tarefas agendadas (Cron)**: Executa a indexação diária do armário e propostas matinais sem gerar custos de API na nuvem.
3. **Fallback automático de cota (Quota Fallback)**: Intercepta erros de limite (`429`) ou `RESOURCE_EXHAUSTED` de provedores externos e redireciona de forma transparente para o Gemma local sem falhas para o usuário.
4. **Limites de plano**: Recursos generativos avançados (Trend Scout e Nano Banana) exigem chave de API pessoal do usuário.
