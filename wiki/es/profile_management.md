# Perfil, Tallaje y Configuración

Ajuste sus medidas, restricciones de modestia y credenciales de IA.

## Descripción general
La sección de Perfil mantiene su contexto de estilo actualizado, gestionando métricas corporales físicas, selección de paleta de tonos de piel, recortes de fotos de cuerpo completo, reglas de estilo, claves API de IA personalizadas, notificaciones de campañas y configuraciones regionales.

## Requisitos previos
- Cuenta de usuario activa en DressApp.

## Paso a paso
1. **Introducir métricas y tallaje ANSUR II**: Ingrese los parámetros físicos básicos (Altura, Peso, Cintura, Longitud del pie). El modelo de regresión ANSUR II calcula automáticamente sus 6 dimensiones estructurales (Hombros, Pecho, Cadera, Longitud de brazo, Entrepierna, Talle exterior).
2. **Tono de piel y recorte de foto corporal**: Seleccione su tono de piel en la paleta de colores o suba una fotografía de cuerpo completo. El sistema realiza automáticamente un recorte de fondo U2-Net para renderizar vistas previas de prueba sobre el cuerpo real. Haga clic en *Eliminar foto* para volver de inmediato al maniquí vectorial 2D SVG.
3. **Especificar reglas**: Seleccione elementos a evitar (p. ej., "evitar el amarillo") y niveles de modestia.
4. **Configuración de IA**: Ingrese sus claves personalizadas de Google AI Studio o seleccione el modo de proveedor estándar.
5. **Notificaciones de campañas**: Despliegue el acordeón *Notificaciones de campañas* para activar notificaciones por correo electrónico o push de promociones locales, ofertas y nuevos estilistas en su área, y personalice la frecuencia (Instantánea, Diaria, Semanal) y la distancia máxima (5km, 10km, 25km, 50km).
6. **Gestionar cuenta**: Consulte su nivel de suscripción (Pro vs. límite Free de 150 prendas) o solicite la eliminación de la cuenta.

## Resultados esperados
- Avatar 2D personalizado y composiciones de conjuntos adaptados exactamente a su forma, tono de piel y preferencias de estilo de vestimenta.
- Notificaciones entregadas en sus canales seleccionados cuando las campañas activas coincidan con sus reglas de estilo y entren dentro del radio de distancia seleccionado.

## Solución de problemas
- **Clave API no válida**: Verifique que haya copiado la clave correctamente desde Google AI Studio sin espacios adicionales.
- **Fondo de la foto no limpio**: Asegúrese de que su foto de cuerpo entero tenga una iluminación clara sobre un fondo contrastante.
- **El calendario no se sincroniza**: Desvincule y vuelva a autenticar su cuenta de Google para actualizar los tokens.
- **No recibe campañas**: Asegúrese de que sus *Servicios de ubicación* estén activados y de que la configuración de distancia máxima cubra la ubicación del negocio local.

## Limitaciones
- Las reglas personalizadas se aplican estrictamente; si sus reglas son demasiado estrictas, es posible que el estilista no encuentre conjuntos coincidentes.
- Las alertas push de campañas requieren permisos de notificación del navegador. Si están bloqueadas, solo recibirá notificaciones por correo electrónico.