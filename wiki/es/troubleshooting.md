# Solución de problemas y respuestas útiles

Soluciones rápidas y sencillas para dudas comunes, permisos, límites de capacidad y avisos de claves de IA.

## Descripción general
Encuentre respuestas rápidas sobre acceso a la cámara, velocidad de procesamiento, límites de prendas, configuración de audio y avisos de IA para disfrutar de su armario digital sin interrupciones.

## Requisitos previos
- Una conexión a internet activa.
- Un navegador web moderno (se recomienda Google Chrome o Apple Safari) o la aplicación móvil de DressApp.

## Instrucciones paso a paso
1. **La cámara no se activa**:
   - Abra la configuración de su dispositivo o navegador, busque **DressApp** y asegúrese de que el permiso de **Cámara** esté en "Permitir". Recargue la página.
2. **Mensaje "Capacidad del armario alcanzada"**:
   - Las cuentas gratuitas almacenan hasta **50 prendas** como base.
   - Puedes invitar amigos para obtener **+10 espacios adicionales** por cada registro (hasta un máximo de 150 prendas), eliminar ropa que no uses o pulsar en **Mejorar a Pro** ($4.99/mes) para almacenamiento ilimitado.
3. **El dictado por voz o el audio no responden**:
   - Verifique que los permisos de micrófono estén permitidos en su navegador.
   - Asegúrese de que el volumen de su dispositivo no esté silenciado ni en modo "No molestar".
4. **Las fotos tardan en procesarse**:
   - Las fotos con varios artículos toman unos instantes mientras la IA elimina el fondo, revisa la prenda y extrae etiquetas de moda. El proceso se realiza en segundo plano.
5. **Aviso "Usando estilista de la plataforma (Quota Fallback)"**:
   - Si ingresó una clave de API de Google Gemini y esta superó el límite de solicitudes (`429 Too Many Requests`) o agotó su cuota diaria, DressApp lo detecta de inmediato y completa la respuesta con nuestro modelo local Gemma-4-E4B. ¡Su solicitud nunca fallará con un error! Puede revisar su cuota en Google AI Studio o seguir utilizando el motor local.
6. **Mensaje "Clave de API requerida (403)" en Trend Scout o Nano Banana**:
   - Los canales de moda de Trend Scout y la reparación fotográfica de Nano Banana requieren una clave de API personal de Google Gemini. Puede obtener una gratis en [Google AI Studio](https://aistudio.google.com/) e ingresarla en **Perfil** (`/me`) &rarr; **Configuración de IA**.
7. **Conectar Google Calendar**:
   - Diríjase a **Perfil** &rarr; **Google Calendar** y pulse **Conectar** para autorizar los permisos de agenda.

## Resultados esperados
Resolución rápida de dudas frecuentes para que su experiencia de estilismo sea fluida y agradable.

## Solución de problemas
- **¿Persiste el inconveniente?** Cierre sesión y vuelva a ingresar, o limpie la caché de su navegador.
- **Idiomas RTL**: En hebreo y árabe, los textos y pestañas se invierten automáticamente a la derecha para una lectura natural.

## Limitaciones
- La importación desde aplicaciones de la competencia requiere un navegador de escritorio y no funciona en teléfonos móviles.
- Trend Scout y la reparación con Nano Banana requieren una clave personal de Google Gemini API.
