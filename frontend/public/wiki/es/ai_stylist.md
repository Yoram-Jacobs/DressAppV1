# Estilista IA Conversacional

Interactúe con un estilista personal inteligente que conoce su armario, el clima y su agenda.

## Descripción general
El Estilista IA procesa consultas de estilo por voz o texto en lenguaje natural, integrando automáticamente condiciones meteorológicas, eventos del calendario y notificaciones push impulsadas por almacenes personalizados `useSyncExternalStore` seguros para hilos (`stylistStore` y `dailySuggestionsStore`) con almacenamiento en caché de 15 minutos y deduplicación de solicitudes activas.

## Requisitos previos
- Una clave API de Gemini (o créditos predeterminados del sistema).
- Eventos de calendario conectados.

## Paso a paso
1. **Iniciar sesión**: Abra la pestaña Stylist y seleccione Chat, Shuffle o Match.
2. **Entrada de voz**: Toque el micrófono, pronuncie su consulta (p. ej., "Sugiéreme un conjunto para un día lluvioso") y toque enviar.
3. **Reproducción de audio**: Escuche la justificación de estilo generada a través del reproductor de voz de alta fidelidad.
4. **Aleatorio (Shuffle)**: Haga clic en el botón Sparkles para hacer girar la máquina tragamonedas; la IA alinea automáticamente las prendas coincidentes en el foco.
5. **Navegación sin esperas**: La navegación entre Stylist y otras pestañas utiliza preferencias almacenadas en memoria sin activar bucles de solicitudes GET a la base de datos.

## Resultados esperados
Composiciones de prendas personalizadas diseñadas según sus preferencias personales, restricciones estacionales y agenda.

## Solución de problemas
- **El audio se reproduce muy lento**: Alterne entre Gemini TTS y la alternativa Web Speech API en la configuración de Profile.
- **Sugerencias repetidas**: Asegúrese de que su historial del calendario de conjuntos esté actualizado para que el algoritmo de rotación pueda bloquear prendas repetidas.

## Limitaciones
- Las recomendaciones requieren al menos una prenda superior, una prenda inferior y un calzado en el armario para completar un look.
- La transcripción de voz puede recurrir a la escritura de texto estándar en dispositivos periféricos no compatibles.