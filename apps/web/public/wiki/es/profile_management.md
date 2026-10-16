# Perfil, Tallas y Configuración (`/me`)

Administra medidas corporales, tono de piel, recortes de fotos de cuerpo entero, preferencias de estilo, credenciales de modelos de IA e integraciones del sistema en tu panel de perfil personal.

## Descripción general
La página de **Perfil y Configuración** (`https://dressapp.co/me`) funciona como el centro de control principal para tu ecosistema DressApp. Alberga tus parámetros antropométricos físicos, el escenario del avatar de prueba virtual digital, restricciones de estilo, preferencias regionales, configuración de modelos de IA y programación de notificaciones push.

---

## Requisitos previos
- Una cuenta activa en DressApp.
- (Opcional) Permisos de cámara del dispositivo para subir fotos de cuerpo entero.
- (Opcional) Permisos de ubicación para la segmentación de campañas de estilistas locales, restricciones culturales y pronósticos del clima.

---

## Guía paso a paso: Recorrido completo de la página de arriba abajo

### 1. Encabezado de la página y barra de navegación Explorar
Ubicados en la parte superior del panel `/me`:
- **Encabezado**: Muestra el estado y el título de tu cuenta.
- **Tarjetas de exploración**: Accesos directos rápidos a las secciones principales de la aplicación:
  - **Trend Scout** (`/trends`): Consulta feeds diarios de noticias de moda seleccionados por IA.
  - **Atuendos** (`/outfits`): Accede a tu calendario de atuendos guardados.
  - **Expertos** (`/experts`): Explora estilistas de moda y sastres locales.
  - **Sin desempacar / Estadísticas** (`/me/stats`): Consulta la valoración del armario, métricas de costo por uso y desglose de colores.

### 2. Tarjeta de selección de idioma y voz
Mostrada de forma destacada para una accesibilidad inmediata:
- **Selector de idioma**: Elige entre 12 idiomas admitidos (*inglés, español, francés, alemán, italiano, portugués, ruso, chino, japonés, árabe, hindi, hebreo*). Al seleccionar un idioma, se actualiza automáticamente el idioma de la interfaz y se vincula el modelo de voz Text-to-Speech (TTS) regional predeterminado.

---

### 3. Tarjeta de identidad y datos personales (`ProfileDetailsCard`)

Contiene 9 paneles desplegables tipo acordeón que gestionan tu identidad personal, tallas y renderizado de avatar:

#### Panel A: Identidad
- **Nombre y Apellido**: Campos de identificación personal.
- **Dirección de correo electrónico**: Visualización de solo lectura de tu correo registrado.
- **Fecha de nacimiento**: Utilizada para personalizar la puntuación demográfica de tendencias.
- *Insignia de autocompletado de Google*: Se muestra automáticamente si tu perfil se completó mediante Google OAuth.

#### Panel B: Contacto y dirección de entrega
- **Número de teléfono**: Necesario para recibir alertas SMS/Push con propuestas diarias del programador y campañas de expertos locales.
- **Línea de dirección 1**: Incluye autocompletado a nivel de calle con OpenStreetMap (Nominatim). Al seleccionar una sugerencia, se completan automáticamente la Línea 1, Ciudad, Región, Código postal y País.
- **Línea de dirección 2, Ciudad, Región, Código postal**: Campos de dirección manuales para envíos del mercado.
- **País**: Cuadro combinado sin conexión con búsqueda por nombre de país o código ISO-2.

#### Panel C: Datos demográficos
- **Sexo**: Selecciona *Femenino* o *Masculino* para configurar las medidas corporales base y la taxonomía de prendas.
- **Estado civil**: Selecciona *Soltero/a*, *Casado/a*, *Divorciado/a* o *Viudo/a*.
- **Ocupación**: Entrada de texto libre (por ejemplo, *Estudiante*, *Gerente de marketing*, *Barista*). Alimenta el clasificador de personalización de Trend Scout para priorizar noticias de estilo relevantes.

#### Guía resumida: Sincronización de datos faltantes del perfil de Google (reconsentimiento de People API)
Si iniciaste sesión con Google antes de que DressApp solicitara acceso a los detalles de tu perfil en **People API** (teléfono, dirección, género, fecha de nacimiento), esos campos pueden permanecer vacíos. Puedes sincronizarlos en un solo clic:

1. **Abre el acordeón Contacto o Demografía** — verás un botón **"Sincronizar desde Google"** (icono de actualización) junto al título de la sección.
2. **Haz clic en "Sincronizar desde Google"** — si los permisos necesarios de People API no se concedieron durante tu inicio de sesión original, DressApp lo detecta y muestra un aviso informativo: *"Google necesita tu permiso para acceder a los detalles del perfil. Serás redirigido a Google para otorgar acceso."*
3. **Otorga el consentimiento en la pantalla de Google** — serás redirigido a la pantalla de consentimiento de Google OAuth. Marca las casillas de **Información del perfil** (nombre, correo electrónico, foto) e **Información de contacto** (teléfono, dirección, género, cumpleaños).
4. **Regreso automático y autocompletado** — tras el consentimiento, Google te redirige de vuelta a DressApp. La función `syncGoogleProfile()` se ejecuta automáticamente, llamando al endpoint del backend `/auth/google/sync-profile` que:
   - Obtiene tu teléfono, dirección, género y fecha de nacimiento desde Google People API
   - Completa los campos vacíos en los paneles de **Contacto** (teléfono, dirección) y **Demografía** (sexo, fecha de nacimiento)
   - Guarda las actualizaciones en tu perfil al instante
5. **Listo** — tu perfil ya está completo sin necesidad de escribir manualmente.

> **Nota**: El botón "Sincronizar desde Google" también aparece en el encabezado de la página (junto al botón principal "Sincronizar perfil de Google") y funciona de la misma manera: sincroniza todos los datos disponibles del perfil de Google a la vez.

#### Panel D: Preferencias y unidades de medida
- **Unidad de peso**: Alterna entre kilogramos (`kg`) y libras (`lb`).
- **Unidad de longitud**: Alterna entre centímetros (`cm`) y pulgadas (`in`).

#### Panel E: Fotos y escenario del avatar digital
- **Columna izquierda — Selectores de fotos**:
  - *Foto de rostro*: Sube una miniatura para tu avatar.
  - *Foto de cuerpo entero*: Sube una fotografía de cuerpo completo. El sistema ejecuta automáticamente el recorte local U2-Net (`rembg`) para eliminar el fondo.
  - *Botón Eliminar foto*: Eliminación en un solo clic del recorte de tu foto, cambiando al instante el escenario de prueba de vuelta al maniquí vectorial SVG 2D sin demoras en la interfaz.
- **Columna derecha — Avatar digital y escenario de prueba**:
  - **Selector de tono de piel**: Paleta de colores interactiva para elegir el tono de piel de tu maniquí.
  - **Lienzo de prueba del avatar**: Renderiza prendas sobre tu recorte de foto o sobre el maniquí vectorial Bézier dinámico (`DynamicAvatar.jsx`) utilizando desfases calibrados de puntos de referencia (`top-[14.5%]` de cuello a escote y `top-[36.5%]` de pretina a cintura).

#### Panel F: Perfil de estilo
- **Estética**: Palabras clave de estilo separadas por comas (por ejemplo, *Minimalista, Streetwear, Vintage*).
- **Paleta de colores**: Tonos de color preferidos (por ejemplo, *Pasteles, Tonos tierra, Monocromático*).
- **Evitar**: Colores o tipos de prendas que deben excluirse estrictamente de las recomendaciones de IA (por ejemplo, *Amarillo, Crop tops*).
- **Modestia cultural en el vestir**: Selecciona el nivel de recato (*Informal/Relajado*, *Moderado*, *Conservador*) para orientar la cobertura de los atuendos del AI Stylist.

#### Panel G: Medidas corporales y tallas (Predictor de tallas ANSUR II)
- **Modo inicial / Comenzar de cero**: Ingresa 4 datos básicos: **Estatura**, **Peso**, **Circunferencia de cintura** y **Longitud del pie**. El modelo de regresión multisalida integrado scikit-learn ANSUR II predice automáticamente 6 medidas estructurales:
  - *Hombros*, *Pecho / Busto*, *Cadera*, *Largo de manga*, *Tiro interno (entrepierna)* y *Largo lateral exterior*.
- **Traducción automática de tallas**: Una vez predichas las medidas estructurales, algoritmos deterministas de tallas completan al instante **todas las tallas estándar comerciales**, hasta la talla de calzado:
  - *Talla de camisa informal* (XS–XXL basada en la circunferencia de pecho)
  - *Talla de cintura de pantalón* (pulgadas, convertidas desde cm de cintura)
  - *Talla de calzado US* (fórmulas para hombre/mujer a partir de la longitud del pie)
  - *Talla de vestido de mujer* (US 0–14+ basada en la cintura)
  - *Talla de sostén de mujer* (banda + copa calculadas a partir del busto/bajo busto)
- **Modo de edición detallada**: Después del autocompletado, ajusta con precisión los 15 parámetros de talla (incluidas talla de camisa, talla de pantalón, talla de calzado, talla de sostén y talla de vestido) y los atributos del cabello (*Longitud, Tipo, Color, Estilo*).
- **Cambio de unidades en vivo**: Alterna entre *kg/cm* y *lb/in*; todos los valores se convierten al instante sin volver a predecir.

#### Panel H: Registro en el directorio profesional y de expertos
- **Interruptor de estilista profesional**: Regístrate como profesional verificado de la moda (estilista, sastre, diseñador).
- **Detalles comerciales**: Ingresa Nombre comercial, Dirección, Teléfono, Correo electrónico, Sitio web y Descripción para aparecer en el directorio `/experts` y en el carrusel de campañas regionales.

#### Panel I: Configuración de pagos con PayPal
- **Correo electrónico de receptor de PayPal**: Ingresa tu correo de PayPal para recibir pagos por ventas en el mercado y campañas activas de expertos.

---

### 4. Tarjeta tipo acordeón de preferencias del sistema

Administra configuraciones a nivel de sistema, suscripciones e integraciones de IA:

- **Enrutamiento de Modelos de IA (Arquitectura por Niveles — Zero BYOK)**:
  - *Nivel Gratuito (Eyes en Servidores Propios)*: Los usuarios del nivel gratuito son atendidos por el motor **Eyes** autohospedado en servidores propios de DressApp (actualmente un modelo **Qwen 2.5 VL 3B** ajustado) en el puerto 7860, sin necesidad de claves de API personales.
  - *Planes Manager y Professional (Modelo Rápido en la Nube)*: Los suscriptores de los planes **Manager** y **Professional** disfrutan de enrutamiento prioritario hacia el modelo rápido de IA en la nube (actualmente **Google Gemini 3.5 Flash** mediante `llm_gateway.py`).
  - *Red de Seguridad de Cuotas en Servidores Propios*: Si se alcanzan los límites de velocidad de la nube externa (`429` / `RESOURCE_EXHAUSTED`), las consultas pasan automáticamente al contenedor autohospedado **Eyes** (`Qwen 2.5 VL 3B`) en el puerto 7860, garantizando que tu conversación de estilismo nunca se interrumpa.
- **Suscripción y límites del armario**:
  - Consulta el nivel actual de tu cuenta (**Free**: límite base de 150 artículos frente a **Manager** (\$10/mes) o **Professional** (\$15/mes): artículos ilimitados + modelo rápido de IA en la nube).
  - Accede a la **página de Precios** (`/pricing` o haz clic en la tarjeta de tu plan) para ver la tabla comparativa de niveles, elegir un plan o comprar paquetes de créditos prepagados que no caducan.
  - Mejora tu plan mediante suscripciones de PayPal o la pasarela Atzmai para transacciones locales en Israel en ILS (Bit / tarjeta de crédito).
  - Copiar **enlace de recomendación**: Otorga +10 espacios de capacidad en el armario por cada amigo que se registre (hasta un máximo de 150 artículos).
- **Programador y recordatorios push**:
  - Activa o desactiva las notificaciones de propuestas matutinas de atuendos.
  - Define la frecuencia (*Todos los días*, *Día por medio*, *Dos veces por semana*, *Días laborables*), la hora (por ejemplo, *07:00*) y las preferencias de estilo por código de vestimenta (*Informal*, *Formal*, *Deportivo*, *Personalizado*).
  - Habilita las alertas push VAPID del navegador.
- **Preferencias de notificaciones de campañas**:
  - Controles detallados para *Push/Email de moda local*, *Alertas de rebajas*, *Moda sostenible*, *Promociones de lujo* y *Estilista personal*.
  - Ajusta el control deslizante de **Distancia máxima de campaña** (de 5 km a 50 km).
- **Conectar Google Calendar**: Botón OAuth para sincronizar eventos del calendario personal con el AI Stylist.
- **Tarjeta de servicios de ubicación**: Activa o desactiva los permisos de ubicación GPS para feeds de expertos según la distancia y clima hiperlocal.
- **Botón Invitar amigos**: Copia el enlace de recomendación para compartir.
- **Asistente de compras**: Accede a los detalles de la extensión en Chrome Web Store o genera un **Bookmarklet universal** (`javascript:...`) para comparaciones instantáneas de tallas en tiendas de comercio electrónico.

---

### 5. Acciones de cuenta y diagnósticos
- **Cerrar sesión**: Cierra tu sesión actual.
- **Eliminar mi cuenta**: Enlace para eliminar de forma permanente los datos de la cuenta.
- **Panel de desarrollador**: Vista de diagnóstico para pruebas del entorno. Autenticado mediante Google OAuth (`dressappdeveloper@gmail.com`).

---

## Resultados esperados
- Sincronización instantánea de métricas físicas, tono de piel y recortes de fotos en el lienzo de prueba de avatar 2D.
- Cero peticiones de red en reposo al navegar entre los paneles de configuración.
- Propuestas de atuendos personalizadas del AI Stylist alineadas con tus reglas de modestia y tu agenda.

---

## Solución de problemas
- **No se elimina el fondo de la foto**: Asegúrate de que la foto subida sea de cuerpo entero y tenga una iluminación de fondo que contraste.
- **Las alertas push no llegan**: Confirma que los permisos de notificaciones del navegador estén habilitados y que haya un número de teléfono guardado en *Contacto*.
- **El autocompletado de dirección no responde**: Comprueba que la conexión a Internet esté activa para las consultas a OpenStreetMap Nominatim.

---

## Limitaciones
- El espacio de la cuenta en el nivel gratuito (Free) está limitado a 150 artículos y utiliza el modelo Eyes en servidores propios (`Qwen 2.5 VL 3B`), a menos que se actualice al plan **Manager** o **Professional** para obtener almacenamiento ilimitado y el modelo rápido en la nube (`Gemini 3.5 Flash`).
- Si se alcanzan temporalmente las cuotas de la nube, las solicitudes pasan de forma transparente al motor Eyes en servidores propios (`Qwen 2.5 VL 3B`) integrado sin interrumpir la sesión.
