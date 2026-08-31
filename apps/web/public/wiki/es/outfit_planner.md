# Planificador de Conjuntos y Lienzo

Componga, superponga y revise diseños coordinados.

## Descripción general
El Planificador de Conjuntos proporciona un lienzo visual de avatar 2D (compatible con recortes de fotos reales del cuerpo del usuario y maniquíes vectoriales dinámicos SVG) con desplazamientos de puntos de referencia calibrados (`top-[14.5%]` de cuello a escote y `top-[36.5%]` de pretina a cintura) para superponer prendas superiores, inferiores, abrigos y calzado al ras de los límites del cuerpo.

## Requisitos previos
- Prendas guardadas en el armario.

## Paso a paso
1. **Seleccionar lienzo**: Abra el Planificador y haga clic en un día o nuevo borrador.
2. **Superponer prendas**: Arrastre las prendas sobre el avatar 2D. Los abrigos se superponen automáticamente sobre las camisetas interiores.
3. **Evaluar ajuste**: Verifique las puntuaciones de compatibilidad y advertencias (p. ej., conflictos de color o alertas meteorológicas).
4. **Guardar**: Asigne un título y programe el look en su diario de armario. Las actualizaciones se transmiten de forma segura mediante `useOutfitStore`.

## Resultados esperados
Composiciones de prendas superpuestas elegantemente guardadas en su calendario y visibles como vistas previas en tarjetas de cuadrícula sin bucles de sondeo de solicitudes de red en segundo plano.

## Solución de problemas
- **Orden de capas incorrecto**: Vuelva a verificar la categoría del elemento; la ropa de abrigo debe clasificarse como "Outerwear" para apilarse correctamente.
- **Alertas de superposición**: Si el avatar advierte sobre prendas repetidas, verifique si usó el mismo conjunto en la misma ubicación recientemente.

## Limitaciones
- Las capas se gestionan automáticamente según las etiquetas de categoría; no se admiten anulaciones manuales de z-index.