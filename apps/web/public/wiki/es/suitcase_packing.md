# Asistente de empaque de maletas

Empaca de manera eficiente y sin estrés para cualquier destino gracias a los pronósticos del clima basados en IA y al perfeccionamiento conversacional de la lista de verificación.

## Descripción general
El Asistente de empaque de maletas elimina la ansiedad previa al viaje analizando tu itinerario, el clima del destino y el catálogo de tu armario personal para crear una lista de equipaje personalizada día por día. Impulsado por **Google Gemini 3.5 Flash-Lite** a través de `llm_gateway.py`, el asistente genera planes de empaque completos en segundos y te permite perfeccionar los artículos de manera interactiva a través del chat conversacional.

## Requisitos previos
- Nombre de la ciudad de destino y fechas de salida y regreso.
- Un inventario activo en el armario con al menos algunas prendas básicas.
- Conexión a Internet para obtener los pronósticos meteorológicos del destino.

## Instrucciones paso a paso
1. **Crear un viaje**: Abre la pestaña Maleta, toca **Nuevo viaje** e ingresa la ciudad de destino, las fechas de inicio y fin, y el propósito del viaje (por ejemplo, *Negocios*, *Vacaciones en la playa*, *Paseo urbano casual*).
2. **Generar plan de empaque**: Toca **Generar lista**. La IA consulta las temperaturas y condiciones previstas para tu destino, las cruza con las prendas de tu armario y crea una lista de empaque equilibrada.
3. **Revisar atuendos diarios**: Inspecciona las combinaciones sugeridas día por día asegurando las capas adecuadas para mañanas frescas y tardes cálidas.
4. **Perfeccionar mediante chat conversacional**: ¿Necesitas opciones adicionales? Chatea directamente con el asistente de empaque (por ejemplo, *"Agrega zapatillas cómodas para caminar"* o *"Incluye un vestido de cóctel para la cena"*). La lista se actualiza dinámicamente.
5. **Marcar artículos como empacados**: Usa las casillas de verificación interactivas a medida que llenas tu equipaje para llevar un registro de lo que ya empacaste.
6. **Guardar para viajar sin conexión**: Guarda el plan de viaje completo para acceder a él de forma rápida y optimista en tu dispositivo, incluso sin conexión durante el trayecto.

## Resultados esperados
Una lista de equipaje completa y optimizada según el clima, organizada por categorías de ropa (partes superiores, inferiores, prendas de abrigo, calzado, esenciales) sin prendas duplicadas ni innecesarias.

## Solución de problemas
- **Pronóstico del tiempo no disponible**: Verifica la ortografía de la ciudad de destino; para ubicaciones remotas, intenta indicar la ciudad principal más cercana.
- **La lista muestra pocos artículos**: Asegúrate de haber subido a tu armario suficientes prendas adecuadas para la temporada y las temperaturas previstas en el destino.
- **Los ajustes no se guardan**: Confirma que tu conexión de red esté activa al agregar notas personalizadas por chat.

## Limitaciones
- Los pronósticos meteorológicos automáticos cubren viajes planificados con hasta 14 días de anticipación; los viajes a fechas posteriores utilizan promedios climáticos estacionales históricos.