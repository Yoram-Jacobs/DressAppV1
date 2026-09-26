# Perfil, tallas y configuración (`/me`)

Administra medidas corporales, tono de piel, recortes de fotos corporales, preferencias de estilo, credenciales de modelos de IA e integraciones del sistema en tu panel de control de perfil personal.

## Descripción general
La página de **Perfil y configuración** (`https://dressapp.co/me`) funciona como el centro de control principal para tu ecosistema DressApp. Alberga tus parámetros antropométricos físicos, el escenario del avatar de prueba virtual digital, restricciones de estilo, preferencias regionales, claves de modelos de IA y programación de notificaciones push.

---

## Requisitos previos
- Una cuenta activa en DressApp.
- (Opcional) Permisos de cámara del dispositivo para subir fotos de cuerpo entero.
- (Opcional) Permisos de ubicación para campañas locales de estilistas, restricciones culturales y pronósticos del clima.

---

## Guía paso a paso: Recorrido completo de la página de principio a fin

### 1. Encabezado de la página y barra de navegación de exploración
Ubicados en la parte superior del panel `/me`:
- **Encabezado**: Muestra el estado y el título de tu cuenta.
- **Tarjetas de exploración**: Accesos directos a las secciones principales de la app:
  - **Trend Scout** (`/trends`): Consulta noticias de moda diarias seleccionadas por IA.
  - **Atuendos** (`/outfits`): Accede a tu calendario de atuendos guardados.
  - **Expertos** (`/experts`): Explora estilistas y sastres locales.
  - **Sin desempacar / Estadísticas** (`/me/stats`): Consulta la valoración del armario, métricas de costo por uso y desglose de colores.

### 2. Tarjeta de selección de idioma y voz
Ubicada de forma destacada para un acceso inmediato:
- **Selector de idioma**: Elige entre 12 idiomas admitidos (*inglés, español, francés, alemán, italiano, portugués, ruso, chino, japonés, árabe, hindi, hebreo*). Al seleccionar un idioma, se actualiza automáticamente el idioma de la interfaz y se vincula el modelo de voz Text-to-Speech (TTS) regional predeterminado.

---

### 3. Tarjeta de identidad y datos personales (`ProfileDetailsCard`)

Contiene 9 paneles desplegables tipo acordeón que gestionan tu identidad personal, tallas y renderizado de avatar:

#### Panel A: Identidad
- **Nombre y apellido**: Campos de identificación personal.
- **Dirección de correo electrónico**: Visualización de solo lectura de tu correo registrado.
- **Fecha de nacimiento**: Utilizada para personalizar la puntuación demográfica de tendencias.
- *Insignia de autocompletado de Google*: Se muestra automáticamente si tu perfil se inició a través de Google OAuth.

#### Panel B: Contacto y dirección de entrega
- **Número de teléfono**: Requerido para recibir alertas SMS/Push con propuestas diarias del programador y campañas de expertos locales.
- **Línea de dirección 1**: Cuenta con autocompletado a nivel de calle con OpenStreetMap (Nominatim). Al seleccionar una sugerencia, se completan automáticamente la Línea 1, Ciudad, Región, Código postal y País.
- **Línea de dirección 2, Ciudad, Región, Código postal**: Campos de dirección manuales para envíos del mercado.
- **País**: Menú desplegable offline con búsqueda por nombre de país o código ISO-2.

#### Panel C: Datos demográficos
- **Sexo**: Selecciona *Femenino* o *Masculino* para configurar las medidas corporales base y la taxonomía de prendas.
- **Estado civil**: Selecciona *Soltero/a*, *Casado/a*, *Divorciado/a* o *Viudo/a*.
- **Ocupación**: Entrada de texto libre (por ejemplo, *Estudiante*, *Gerente de marketing*, *Barista*). Alimenta el clasificador de personalización de Trend Scout para priorizar noticias de estilo relevantes.

#### Guía resumida: Sincronización de datos faltantes del perfil de Google (reconsentimiento de People API)
Si iniciaste sesión con Google antes de que DressApp solicitara acceso a los detalles de tu perfil en **People API** (teléfono, dirección, género, fecha de nacimiento), esos campos pueden quedar vacíos. Puedes sincronizarlos en un solo clic:

1. **Abre el acordeón Contacto o Demografía**: Verás un botón **"Sincronizar desde Google"** (icono de actualización) junto al título de la sección.
2. **Haz clic en "Sincronizar desde Google"**: Si los permisos necesarios de People API no se concedieron durante tu inicio de sesión original, DressApp lo detecta y muestra un mensaje informativo: *"Google necesita tu permiso para acceder a los detalles del perfil. Serás redirigido a Google para otorgar acceso."*
3. **Otorga tu consentimiento en la pantalla de Google**: Se te redirige a la pantalla de consentimiento de Google OAuth. Marca las casillas de **Información del perfil** (nombre, correo electrónico, foto) e **Información de contacto** (teléfono, dirección, género, cumpleaños).
4. **Regreso automático y autocompletado**: Tras otorgar el consentimiento, Google te redirige de vuelta a DressApp. La función `syncGoogleProfile()` se ejecuta automáticamente, llamando al endpoint del backend `/auth/google/sync-profile` que:
   - Obtiene tu teléfono, dirección, género y fecha de nacimiento desde Google People API
   - Completa los campos vacíos en los paneles de **Contacto** (teléfono, dirección) y **Demografía** (sexo, fecha de nacimiento)
   - Guarda las actualizaciones en tu perfil al instante
5. **Listo**: Tu perfil ahora está completo sin necesidad de escribir manualmente.

> **Nota**: El botón "Sincronizar desde Google" también aparece en el encabezado de la página (junto al botón principal "Sincronizar perfil de Google") y funciona exactamente igual: sincroniza todos los datos disponibles del perfil de Google a la vez.

#### Panel D: Preferencias y unidades de medida
- **Unidad de peso**: Alterna entre kilogramos (`kg`) y libras (`lb`).
- **Unidad de longitud**: Alterna entre centímetros (`cm`) y pulgadas (`in`).

#### Panel E: Fotos y escenario del avatar digital
- **Columna izquierda — Selectores de fotos**:
  - *Foto de rostro*: Sube una miniatura para tu avatar.
  - *Foto de cuerpo entero*: Sube una fotografía de cuerpo completo. El sistema ejecuta automáticamente el procesamiento local U2-Net (`rembg`) para eliminar el fondo.
  - *Botón eliminar foto*: Eliminación en un solo clic del recorte de tu foto, volviendo al instante al maniquí vectorial SVG 2D sin demoras en la interfaz.
- **Columna derecha — Avatar digital y probador virtual**:
  - **Selector de tono de piel**: Paleta interactiva para seleccionar el tono de piel del maniquí.
  - **Lienzo de prueba del avatar**: Renderiza prendas sobre tu recorte de foto o sobre el maniquí vectorial Bézier dinámico (`DynamicAvatar.jsx`) utilizando desfases calibrados de puntos de referencia (`top-[14.5%]` cuello-a-escote y `top-[36.5%]` pretina-a-cintura).

#### Panel F: Perfil de estilo
- **Estética**: Palabras clave de estilo separadas por comas (por ejemplo, *Minimalista, Streetwear, Vintage*).
- **Paleta de colores**: Tonos de color preferidos (por ejemplo, *Pasteles, Tonos tierra, Monocromático*).
- **Evitar**: Colores o tipos de prendas a excluir estrictamente de las recomendaciones de IA (por ejemplo, *Amarillo, Crop tops*).
- **Modestia en el vestir cultural**: Selecciona el nivel de recato (*Informal/Relajado*, *Moderado*, *Conservador*) para orientar la cobertura de prendas del AI Stylist.

#### Panel G: Medidas corporales y tallas (Predictor de tallas ANSUR II)
- **Modo de bienvenida / Nuevo inicio**: Ingresa 4 datos básicos: **Estatura**, **Peso**, **Circunferencia de cintura** y **Longitud del pie**. El modelo de regresión multisalida integrado scikit-learn ANSUR II predice automáticamente 6 medidas estructurales:
  - *Hombros*, *Pecho / Busto*, *Cadera*, *Largo de manga*, *Tiro interno* y *Largo lateral exterior*.
- **Traducción automática de tallas**: Una vez predichas las medidas estructurales, algoritmos deterministas de tallas completan al instante **todas las tallas estándar comerciales**, incluida la talla de calzado:
  - *Talla de camisa informal* (XS–XXL basada en el contorno de pecho)
  - *Talla de cintura de pantalón* (pulgadas, convertidas desde cm de cintura)
  - *Talla de calzado US* (fórmulas para hombre/mujer basadas en la longitud del pie)
  - *Talla de vestido de mujer* (US 0–14+ basada en la cintura)
  - *Talla de sostén de mujer* (banda + copa calculadas a partir del busto/bajo busto)
- **Modo de edición detallada**: Tras el autocompletado, ajusta con precisión los 15 parámetros de talla (incluidas talla de camisa, de pantalón, de calzado, de sostén, de vestido) y atributos del cabello (*Longitud, Tipo, Color, Estilo*).
- **Cambio de unidades en vivo**: Alterna entre *kg/cm* y *lb/in*; todos los valores se convierten de inmediato sin necesidad de volver a predecir.

#### Panel H: Registro en el directorio profesional y de expertos
- **Interruptor de estilista profesional**: Regístrate como profesional verificado de la moda (estilista, sastre, diseñador).
- **Detalles comerciales**: Ingresa nombre comercial, dirección, teléfono, correo, sitio web y descripción para aparecer en el directorio `/experts` y en el ticker de campañas regionales.

#### Panel I: Configuración de pagos con PayPal
- **Correo electrónico de receptor de PayPal**: Ingresa tu correo de PayPal para recibir pagos de ventas en el mercado y campañas activas de expertos.

---

### 4. Tarjeta tipo acordeón de preferencias del sistema

Administra configuraciones a nivel de sistema, suscripciones e integraciones de IA:

- **Configuración de IA**:
  - *Modo estándar (Motor de producción principal)*: Impulsado por **Google Gemini 3.5 Flash-Lite** a través de `llm_gateway.py`. Ofrece recomendaciones ultra veloces sin configuración inicial ni requerir claves de API personales.
  - *Red de seguridad de cuotas on-premises*: Si se alcanzan los límites de velocidad en la nube (`429` / `RESOURCE_EXHAUSTED`), las consultas pasan automáticamente al contenedor autohospedado y optimizado **Gemma-4-E4B** en el puerto 7860, garantizando que tu conversación de estilismo no se interrumpa.
  - *Modo de claves de API personalizadas (BYOK)*: Conecta tu propia clave de API de Google Gemini para desbloquear cuotas avanzadas de desarrollador y herramientas generativas en la nube como el radar diario Trend Scout y la reconstrucción de fotos Nano Banana.
- **Límites de suscripción y armario**:
  - Consulta el nivel de cuenta actual (**Free**: base de 50 artículos frente a **Manager** (\$10/mes) o **Professional** (\$15/mes): artículos ilimitados).
  - Accede a la **página de Precios** (`/pricing` o haz clic en tu tarjeta de plan) para consultar la tabla comparativa de niveles, seleccionar un plan o comprar paquetes de créditos prepagados sin vencimiento.
  - Actualiza mediante suscripciones de PayPal o a través de la pasarela Atzmai para transacciones locales en Israel en ILS (Bit / tarjeta de crédito).
  - Copiar **enlace de recomendación**: Otorga +10 espacios de capacidad de armario por cada amigo que se registre (hasta un máximo de 150 artículos).
- **Programador y recordatorios push**:
  - Activa o desactiva las notificaciones de propuestas matutinas de atuendos.
  - Define la frecuencia (*Todos los días*, *Día por medio*, *Dos veces por semana*, *Días laborables*), la hora (por ejemplo, *07:00*) y el código de vestimenta solicitado (*Informal*, *Formal*, *Deportivo*, *Personalizado*).
  - Habilita las notificaciones push VAPID del navegador.
- **Preferencias de notificación de campañas**:
  - Controles detallados para *Push/Email de moda local*, *Alertas de rebajas*, *Moda sostenible*, *Promociones de lujo* y *Estilista personal*.
  - Ajusta el control deslizante de **Distancia máxima de campaña** (5 km a 50 km).
- **Conectar Google Calendar**: Botón OAuth para sincronizar eventos del calendario personal con el AI Stylist.
- **Tarjeta de servicios de ubicación**: Activa o desactiva permisos de ubicación GPS para sugerencias de expertos cercanas y clima hiperlocal.
- **Botón invitar amigos**: Copia el enlace de recomendación para compartir.
- **Asistente de compras**: Accede a los detalles de la extensión de Chrome Web Store o genera un **Bookmarklet universal** (`javascript:...`) para comparaciones de tallas instantáneas en tiendas online.

---

### 5. Acciones de cuenta y diagnósticos
- **Cerrar sesión**: Cierra tu sesión actual.
- **Eliminar mi cuenta**: Enlace para purgar de forma permanente los datos de la cuenta.
- **Panel de desarrollador**: Vista diagnóstica para pruebas del entorno. Autenticado mediante Google OAuth (`dressappdeveloper@gmail.com`).

---

## Resultados esperados
- Sincronización instantánea de métricas corporales, tono de piel y recortes de fotos en el lienzo de prueba de avatar 2D.
- Cero peticiones de red inactivas al navegar entre los paneles de configuración.
- Propuestas de atuendos personalizadas del AI Stylist alineadas con tus pautas de modestia y tu agenda.

---

## Solución de problemas
- **No se elimina el fondo de la foto**: Asegúrate de que la foto subida sea de cuerpo entero y cuente con iluminación de fondo contrastante.
- **Las alertas push no llegan**: Confirma que los permisos de notificaciones del navegador estén habilitados y que haya un número de teléfono guardado en *Contacto*.
- **El autocompletado de dirección no responde**: Comprueba que la conexión a Internet esté activa para realizar consultas en OpenStreetMap Nominatim.

---

## Limitaciones
- El espacio de la cuenta en el nivel Free Tier está limitado a 50 artículos de base, a menos que se amplíe mediante bonificaciones por recomendación (+10 espacios por invitado hasta un máximo de 150 artículos) o al actualizar al nivel Manager o Professional.
- Los endpoints generativos de alto costo en la nube (radar Trend Scout y reconstrucción fotográfica Nano Banana) requieren una clave de API personal de Google Gemini provista por el usuario.
- El modo con clave de API personalizada recurrirá de forma fluida al motor integrado Gemma-4-E4B si el proveedor externo agota su cuota.
