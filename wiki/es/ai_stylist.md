# Estilista Conversacional con IA

Interactúa con un estilista personal inteligente que conoce tu armario, el clima y tu agenda diaria.

## Descripción general
El AI Stylist es tu compañero personal de moda. Puedes conversar con él escribiendo o hablando en voz alta, exactamente como si fuera un amigo. El estilista consulta tu pronóstico meteorológico local, revisa tus eventos de Google Calendar y sugiere atuendos completos y con estilo creados directamente con las prendas que ya tienes.

El cerebro de estilismo de DressApp está impulsado por una arquitectura de inteligencia multinivel resiliente y sin necesidad de claves propias (zero-BYOK):
- **Planes Manager y Professional — Modelo Rápido en la Nube (Google Gemini 3.5 Flash)**: Los suscriptores de los planes **Manager** y **Professional** disfrutan de enrutamiento prioritario hacia el modelo rápido de IA en la nube (actualmente **Google Gemini 3.5 Flash** mediante `llm_gateway.py`), que ofrece respuestas ultrarrápidas (TTFT inferior a 350 ms) sin necesidad de configuración alguna.
- **Nivel Gratuito — Motor Eyes en Servidores Propios (`Qwen 2.5 VL 3B`) y Red de Seguridad de Cuotas**: Los usuarios del nivel gratuito cuentan con el modelo dedicado y ajustado **Qwen 2.5 VL 3B** de DressApp que se ejecuta localmente en el contenedor `dressapp-eyes` en el puerto 7860 del VPS Hetzner CPX32. También actúa como respaldo de seguridad transparente para los niveles de pago: si se alcanzan los límites de velocidad de la API en la nube (`429` / `RESOURCE_EXHAUSTED`), las consultas se redirigen automáticamente al motor Eyes en servidores propios sin fallar ni generar errores 500.

## Requisitos previos
- Al menos una prenda superior, una prenda inferior y un calzado subidos a tu armario.
- Permiso de micrófono habilitado si deseas utilizar el estilismo por voz manos libres.
- *(Opcional)* Google Calendar conectado para que las sugerencias de atuendos tengan en cuenta tus ocasiones.

## Instrucciones paso a paso
1. **Abrir el estilista**: Toca la pestaña **AI Stylist** en la barra de navegación inferior.
2. **Hablar o escribir**: Toca el **icono del micrófono** y pregunta qué deberías ponerte (por ejemplo, *"¿Qué debería ponerme para un almuerzo en una tarde lluviosa?"* o *"Sugiere un look elegante de negocios"*).
3. **Escuchar el consejo hablado**: El estilista responde con consejos personalizados y muestra tarjetas de atuendos que combinan. Toca **Reproducir respuesta** para volver a escuchar el consejo en audio en cualquier momento.
4. **Probar la herramienta Mezclar (Shuffle)**: ¿Buscas inspiración instantánea? ¡Toca la pestaña **Shuffle** para hacer girar tu armario y descubrir combinaciones frescas que quizá no se te había ocurrido usar juntas!
5. **Perfeccionar con preguntas de seguimiento**: Pídele al estilista que cambie los zapatos, sustituya una chaqueta o se adapte a los cambios de temperatura en una conversación continua.
6. **Guardar tus favoritos**: Toca **Guardar en diario** para programar el look en el calendario de tu armario personal.

## Resultados esperados
Sugerencias de atuendos personalizadas y adecuadas para el clima mostradas en tu pantalla, acompañadas de explicaciones habladas sobre por qué combinan las prendas. Si las cuotas de la API externa en la nube se agotan temporalmente, un banner informativo indica que el estilista Eyes en servidores propios integrado atendió tu solicitud sin interrupciones.

## Solución de problemas
- **El micrófono no capta las palabras**: Revisa los permisos de tu navegador o dispositivo para asegurarte de que DressApp tenga permiso para acceder a tu micrófono.
- **El estilista sugiere demasiados atuendos repetidos**: Registra tus atuendos diarios en el calendario para que el estilista sepa qué usaste recientemente y priorice la ropa que no has usado.
- **Banner "Usando estilista de la plataforma (Respaldo por cuota)"**: Aparece cuando se alcanzan los límites de velocidad de la API externa en la nube. La aplicación respondió a tu pregunta sin inconvenientes utilizando el motor Eyes en servidores propios (`Qwen 2.5 VL 3B`) integrado de DressApp, sin interrumpir tu conversación.

## Limitaciones
- El estilista trabaja estrictamente con las prendas de tu armario; no puede recomendar piezas que aún no hayas subido.
- Los usuarios del nivel gratuito (Free Tier) utilizan el modelo Eyes en servidores propios con créditos de estilismo de cortesía que se renuevan automáticamente, mientras que las cuentas Manager y Professional disfrutan del modelo rápido en la nube (`Gemini 3.5 Flash`) y de cuotas mensuales más elevadas.
