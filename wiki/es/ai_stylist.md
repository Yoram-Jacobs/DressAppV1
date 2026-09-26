# Estilista conversacional con IA

Interactúa con un estilista personal inteligente que conoce tu armario, el clima y tu agenda diaria.

## Descripción general
El AI Stylist es tu compañero personal de moda. Puedes chatear con él escribiendo o hablando en voz alta, exactamente como si fuera un amigo. El estilista consulta tu pronóstico local, revisa tus eventos de Google Calendar y sugiere atuendos completos y elegantes armados directamente con prendas que ya posees.

El cerebro de estilismo de DressApp está impulsado por una arquitectura de inteligencia multinivel resistente:
- **Motor principal de producción (Google Gemini 3.5 Flash-Lite)**: Impulsa todas las conversaciones centrales de estilismo de forma predeterminada mediante `llm_gateway.py`. Ofrece respuestas ultrarrápidas (TTFT inferior a 350 ms) sin configuración inicial ni fricciones: ¡no se requieren claves de API personales para comenzar a recibir asesoramiento!
- **Eyes en VPS on-premises (`gemma-4-E4B`) — Nivel gratuito y red de seguridad de cuotas**: Un modelo dedicado y optimizado `gemma-4-E4B` que se ejecuta localmente en el contenedor `dressapp-eyes` en el puerto 7860 del VPS Hetzner CPX32. Proporciona una base de costo variable cero para cuentas Free Tier y funciona como un respaldo transparente. Si se alcanzan los límites de la API de Google Gemini (`429` / `RESOURCE_EXHAUSTED`), las consultas se redirigen automáticamente a Gemma on-premises sin fallar ni generar errores 500.
- **Modelos en la nube personalizados (BYOK)**: Los usuarios pueden proporcionar opcionalmente su propia clave de API de Google Gemini en la configuración de Perfil para acceder a modelos de nivel superior (`gemini-2.5-pro`) o desbloquear herramientas generativas avanzadas (reconstrucción fotográfica Nano Banana).

## Requisitos previos
- Al menos una prenda superior, una prenda inferior y un calzado subidos a tu armario.
- Permiso de micrófono habilitado si deseas utilizar el estilismo por voz manos libres.
- *(Opcional)* Google Calendar conectado para que las sugerencias de vestimenta se adapten a tus ocasiones.
- *(Opcional)* Clave de API personal de Google Gemini si deseas usar tu propia cuota de desarrollador en la nube.

## Instrucciones paso a paso
1. **Abrir el estilista**: Toca la pestaña **AI Stylist** en la barra de navegación inferior.
2. **Hablar o escribir**: Toca el **icono de micrófono** y pregunta qué deberías ponerte (por ejemplo, *"¿Qué debería ponerme para un almuerzo en una tarde lluviosa?"* o *"Sugiere un look elegante de negocios"*).
3. **Escuchar el consejo hablado**: El estilista responde con consejos personalizados y muestra tarjetas de atuendos que combinan. Toca **Reproducir respuesta** para escuchar el consejo de audio nuevamente en cualquier momento.
4. **Probar la herramienta de mezclar (Shuffle)**: ¿Buscas inspiración instantánea? ¡Toca la pestaña **Shuffle** para hacer girar tu armario y descubrir combinaciones frescas que quizás no habías pensado en usar juntas!
5. **Perfeccionar con preguntas de seguimiento**: Pídele al estilista que cambie los zapatos, sustituya una chaqueta o se adapte a los cambios de temperatura en un flujo de conversación continuo.
6. **Guardar tus favoritos**: Toca **Guardar en diario** para programar el look en el calendario de tu armario personal.

## Resultados esperados
Sugerencias de atuendos personalizadas y adecuadas para el clima que se muestran en tu pantalla, acompañadas de explicaciones habladas sobre por qué combinan las prendas. Si las cuotas de la API externa se agotan temporalmente, un banner informativo indica que el estilista on-premises integrado atendió tu solicitud sin interrupciones.

## Solución de problemas
- **El micrófono no capta las palabras**: Revisa los permisos de tu navegador o dispositivo para asegurarte de que DressApp tenga permiso para acceder a tu micrófono.
- **El estilista sugiere demasiados atuendos repetidos**: Registra tus atuendos diarios en el calendario para que el estilista sepa qué usaste recientemente y priorice prendas no usadas.
- **Banner "Usando estilista de la plataforma (Respaldo por cuota)"**: Aparece cuando se alcanzan los límites de velocidad de la API externa. La aplicación respondió a tu consulta sin inconvenientes utilizando el motor Gemma on-premises integrado de DressApp, sin interrumpir tu conversación.

## Limitaciones
- El estilista trabaja estrictamente con las prendas de tu armario; no puede recomendar piezas que aún no hayas subido.
- Los usuarios del nivel Free Tier reciben créditos de estilismo de cortesía que se renuevan automáticamente, mientras que las cuentas Pro y Tester disfrutan de cuotas mensuales más altas.
