# Gemma 4 E4B / E2B — Guía de inferencia y conocimiento para agentes

**Audiencia:** Agentes de IA, mantenedores e ingenieros de ML del pipeline de visión y estilismo de DressApp Eyes.  
**Fecha:** Septiembre de 2026  
**Estado:** Activo en producción (`gemma-4-E4B-it-Q3_K_M.gguf` + `mmproj-BF16.gguf`)

Este documento preserva la lógica, arquitectura y reglas de inferencia para el modelo ajustado `gemma-4-E4B-it` en DressApp.

---

## 1. Datos arquitectónicos
- **Perfil del modelo:** Google Gemma-4-E4B es un modelo multimodal de visión y lenguaje de 4 mil millones de parámetros efectivos (~4.5B en total) con Per-Layer Embeddings (PLE). Cuantizado a `Q3_K_M` (~2.7 GB en disco, ~2.85 GB en RAM), óptimo para la CPU del VPS Hetzner CPX32 (4 vCPUs AMD).
- **Ventana de contexto:** Hasta 128K tokens (configurado a 4.096 tokens en `dressapp-eyes` para máxima velocidad).
- **Entrada multimodal:** Soporte nativo para imagen, audio y texto mediante `mmproj-BF16.gguf`.
- **Servidor en producción:** Ejecuta `llama-server` en el puerto 7860 del contenedor `dressapp-eyes`, protegido con token FastAPI (`EYES_API_TOKEN`).

## 2. Roles de producción y enrutamiento multinivel
1. **Núcleo del plan gratuito**: Gestiona el estilismo conversacional y la extracción de atributos de ropa para cuentas gratuitas sin clave API.
2. **Tareas programadas (Cron)**: Indexación diaria de prendas y recomendaciones matutinas sin costes de API comercial en la nube.
3. **Respaldo automático por cuota (Quota Fallback)**: Captura errores de límite de solicitudes (`429`) o `RESOURCE_EXHAUSTED` de proveedores externos y redirige al modelo local Gemma sin caídas ni errores para el usuario.
4. **Límites de nivel**: Endpoints generativos de alto coste (Trend Scout y Nano Banana) requieren claves de API personales.

## 3. Reglas de inferencia
- **Parámetros**: `temperature = 0.3`, `max_tokens = 3000`.
- **Rendimiento medido (Hetzner CPX32)**:
  - Procesamiento de prompt: ~32 tokens/segundo.
  - Generación de respuesta: ~16.5 tokens/segundo.
  - Uso de memoria RAM: ~2.85 GB de los 8 GB disponibles.
