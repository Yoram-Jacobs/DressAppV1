Aquí tienes la traducción de la documentación de DressApp al español, siguiendo todas las reglas especificadas:

# Perfil, Tallas y Configuración (`/me`)

Gestiona las medidas físicas, el tono de piel, los recortes de fotos corporales, las preferencias de estilo, las credenciales del modelo de IA y las integraciones del sistema en tu panel de perfil personal.

## Resumen
La página de **Perfil y Configuración** (`https://dressapp.co/me`) sirve como centro de control central para tu ecosistema DressApp. Aloja tus parámetros antropométricos físicos, el escenario del avatar de prueba digital, las restricciones de estilo, las preferencias localizadas, las claves del modelo de IA y los programas de notificaciones push.

---

## Requisitos previos
- Una cuenta activa de DressApp.
- (Opcional) Permisos de cámara del dispositivo para carga de fotos de cuerpo completo.
- (Opcional) Permisos de ubicación para segmentación de campañas de estilistas locales y pronóstico del tiempo.

---

## Guía paso a paso: Resumen de la página de arriba a abajo

### 1. Encabezado de la página y barra de navegación "Explorar"
Ubicado en la parte superior del `dashboard` `/me`:
- **Encabezado**: Muestra el estado de tu cuenta y tu título.
- **Tarjetas "Explorar"**: Atajos rápidos a las secciones principales de la aplicación:
  - **Trend Scout** (`/trends`): Consulta las noticias de moda diarias seleccionadas por IA.
  - **Outfits** (`/outfits`): Accede a tu calendario de conjuntos guardados.
  - **Experts** (`/experts`): Explora estilistas y sastres de moda locales.
  - **Unpacked / Stats** (`/me/stats`): Consulta la valoración del armario, las métricas de costo por uso y los desgloses de color.

### 2. Tarjeta de Selección de Idioma y Voz
Mostrada de forma destacada para una accesibilidad inmediata:
- **Selector de Idioma**: Elige entre 12 idiomas compatibles (*English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Arabic, Hindi, Hebrew*). Al seleccionar un idioma, se actualiza automáticamente el `locale` de la UI y se vincula el modelo de voz regional predeterminado de Text-to-Speech (TTS).

---

### 3. Tarjeta de Identidad y Detalles Personales (`ProfileDetailsCard`)

Contiene 9 paneles de acordeón expandibles que gestionan tu identidad personal, tallas y renderizado de avatar:

#### Panel A: Identidad
- **Nombre y Apellido**: Campos de identificación personal.
- **Dirección de Correo Electrónico**: Visualización de solo lectura de tu correo electrónico registrado.
- **Fecha de Nacimiento**: Utilizado para personalizar la puntuación de tendencias demográficas.
- *Insignia de Autocompletado de Google*: Se muestra automáticamente si tu perfil fue creado a través de Google OAuth.

#### Panel B: Contacto y Dirección de Entrega
- **Número de Teléfono**: Requerido para recibir alertas SMS/Push de propuestas de programador diario y campañas de expertos locales.
- **Línea de Dirección 1**: Ofrece autocompletado a nivel de calle de OpenStreetMap (Nominatim). Al seleccionar una sugerencia, se rellenan automáticamente la Línea 1, Ciudad, Región, Código Postal y País.
- **Línea de Dirección 2, Ciudad, Región, Código Postal**: Campos de dirección manual para el envío del `marketplace`.
- **País**: `Combobox` sin conexión, se puede buscar por nombre de país o código ISO-2.

#### Panel C: Datos Demográficos
- **Sexo**: Selecciona *Mujer* o *Hombre* para configurar las medidas corporales base y la taxonomía de la ropa.
- **Estado Personal**: Selecciona *Soltero/a*, *Casado/a*, *Divorciado/a* o *Viudo/a*.
- **Ocupación**: Entrada de texto libre (p. ej., *Student*, *Marketing Manager*, *Barista*). Alimenta el `ranker` de personalización de Trend Scout para priorizar noticias de estilo relevantes.

#### Guía resumida: Sincronización de datos de perfil de Google faltantes (re-consentimiento de People API)
Si iniciaste sesión con Google antes de que DressApp solicitara acceso a los detalles de tu perfil de **People API** (teléfono, dirección, sexo, fecha de nacimiento), esos campos pueden permanecer vacíos. Puedes sincronizarlos con un solo clic:

1.  **Abre el acordeón de Contacto o Datos Demográficos** — verás un botón **"Sincronizar desde Google"** (icono de actualización) junto al título de la sección.
2.  **Haz clic en "Sincronizar desde Google"** — si los `scopes` de People API requeridos no se otorgaron durante tu inicio de sesión original, DressApp lo detecta y muestra un `toast` informativo: *"Google necesita tu permiso para acceder a los detalles del perfil. Serás redirigido/a a Google para otorgar acceso."*
3.  **Otorga el consentimiento en la pantalla de Google** — serás redirigido/a a la pantalla de consentimiento de OAuth de Google. Marca las casillas para **Profile info** (nombre, correo electrónico, foto) y **Contact info** (teléfono, dirección, género, fecha de nacimiento).
4.  **Regreso automático y auto-llenado** — después del consentimiento, Google te redirige de nuevo a DressApp. La función `syncGoogleProfile()` se ejecuta automáticamente, llamando al `endpoint` del `backend` `/auth/google/sync-profile` que:
    - Obtiene tu teléfono, dirección, sexo y fecha de nacimiento de Google People API
    - Rellena los campos vacíos en los paneles de **Contacto** (teléfono, dirección) y **Datos Demográficos** (sexo, fecha de nacimiento)
    - Guarda las actualizaciones en tu perfil al instante
5.  **Listo** — tu perfil ya está completo sin necesidad de escribir manualmente.

> **Nota**: El botón "Sincronizar desde Google" también aparece en el encabezado de la página (junto al botón principal "Sincronizar perfil de Google") y funciona de la misma manera: sincroniza todos los datos de perfil de Google disponibles a la vez.

#### Panel D: Preferencias y Unidades de Medida
- **Unidad de Peso**: Alterna entre Kilogramos (`kg`) y Libras (`lb`).
- **Unidad de Longitud**: Alterna entre Centímetros (`cm`) y Pulgadas (`in`).

#### Panel E: Fotos y Escenario de Avatar Digital
- **Columna Izquierda — Selectores de Fotos**:
  - *Foto de Cara*: Sube una miniatura de avatar.
  - *Foto de Cuerpo Completo*: Sube una fotografía de cuerpo completo. El sistema ejecuta automáticamente el `matting` local U2-Net (`rembg`) para eliminar el fondo.
  - *Botón Eliminar Foto*: Eliminación con un solo clic de tu recorte de foto, cambiando instantáneamente el escenario de prueba de nuevo al maniquí vectorial SVG 2D con cero `lag` en la UI.
- **Columna Derecha — Avatar Digital y Escenario de Prueba**:
  - **Selector de Tono de Piel**: Paleta de colores interactiva para seleccionar el tono de piel de tu maniquí.
  - **Canvas de Prueba de Avatar**: Renderiza prendas sobre tu recorte de foto o maniquí vectorial Bezier dinámico (`DynamicAvatar.jsx`) utilizando `landmark offsets` calibrados (`top-[14.5%]` de cuello a escote y `top-[36.5%]` de pretina a cintura).

#### Panel F: Perfil de Estilo
- **Estética**: Palabras clave de estilo separadas por comas (p. ej., *Minimalist, Streetwear, Vintage*).
- **Paleta de Colores**: Tonos de color preferidos (p. ej., *Pastels, Earth Tones, Monochrome*).
- **Evitar**: Colores o tipos de prendas a excluir estrictamente de las recomendaciones de IA (p. ej., *Yellow, Crop Tops*).
- **Conservadurismo de Vestimenta Cultural**: Selecciona el nivel de modestia (*Casual/Relaxed*, *Moderate*, *Conservative*) para guiar la cobertura de conjuntos del AI Stylist.

#### Panel G: Medidas Corporales y Tallas (Predictor de Tallas ANSUR II)
- **Modo de Incorporación / Inicio Fresco**: Introduce 4 entradas básicas: **Altura**, **Peso**, **Circunferencia de Cintura** y **Longitud del Pie**. El modelo de regresión de múltiples salidas `scikit-learn ANSUR II` integrado predice automáticamente 6 `structural measurements`:
  - *Hombros*, *Pecho / Busto*, *Cadera*, *Longitud de Manga*, *Entrepierna* y *Tiro exterior*.
- **Traducción Automática de Tallas**: Una vez que se predicen las `structural measurements`, los algoritmos de dimensionamiento `deterministic sizing algorithms` rellenan instantáneamente **todas las tallas minoristas estándar** hasta la talla de zapato:
  - *Talla de Camisa Casual* (XS–XXL basada en la circunferencia del pecho)
  - *Talla de Cintura de Pantalón* (pulgadas, convertidas de cm de cintura)
  - *Talla de Zapatos de EE. UU.* (fórmulas para Hombres/Mujeres a partir de la longitud del pie)
  - *Talla de Vestido de Mujer* (US 0–14+ basada en la cintura)
  - *Talla de Sujetador de Mujer* (`band + cup` calculado a partir de busto/debajo del busto)
- **Modo de Edición Detallada**: Después del auto-relleno, ajusta los 15 parámetros de dimensionamiento (incluyendo Talla de Camisa, Talla de Pantalón, Talla de Zapatos, Talla de Sujetador, Talla de Vestido) y los `Hair attributes` (*Longitud, Tipo, Color, Estilo*).
- **Selector de Unidades en Vivo**: Cambia entre *kg/cm* y *lb/in* — todos los valores se convierten instantáneamente sin repredicción.

#### Panel H: Registro en el Directorio de Profesionales y Expertos
- **Selector de Estilista Profesional**: Regístrate como un profesional de la moda verificado (estilista, sastre, diseñador/a).
- **Detalles del Negocio**: Introduce el Nombre del Negocio, Dirección, Teléfono, Correo Electrónico, Sitio Web y Descripción para aparecer en el directorio `/experts` y en el `ticker` de campañas regionales.

#### Panel I: Configuración de Pagos de PayPal
- **Correo Electrónico de Receptor de PayPal**: Introduce tu correo electrónico de PayPal para recibir pagos por ventas en el `marketplace` y campañas de expertos activas.

---

### 4. Tarjeta de Acordeón de Preferencias del Sistema

Gestiona la configuración a nivel de sistema, suscripciones e integraciones de IA:

- **Configuración de IA**:
  - *Modo Estándar*: Utiliza `endpoints` de Gemini Flash 2.x gestionados por el sistema.
  - *Modo de Claves API Personalizadas*: Conecta claves `API` personalizadas de Google Gemini, Anthropic, OpenAI o DeepSeek a través de un `modal` de configuración guiada.
- **Límites de Suscripción y Armario**:
  - Consulta tu `tier` de cuenta actual (**Free**: límite de 50 ítems frente a **Manager** o **Professional**: ítems ilimitados).
  - Actualiza a través de la PayPal Subscriptions REST API (Manager: $5/mes o $50/año; Professional: $10/mes o $100/año).
- **Programador y Recordatorios Push**:
  - Activa/desactiva las notificaciones de propuestas de atuendos matutinos.
  - Establece la frecuencia (*Everyday*, *Every Other Day*, *Twice a Week*, *On Weekday*), la hora (p. ej., *07:00*) y las demandas de estilo de código de vestimenta (*Casual*, *Formal*, *Athletic*, *Custom*).
  - Habilita las alertas `push VAPID` del navegador.
- **Preferencias de Notificación de Campañas**:
  - `Toggles` granulares para *Local Fashion Push/Email*, *Sale Alerts*, *Sustainable Fashion*, *Luxury Promos* y *Personal Stylist*.
  - Ajusta el `slider` de **Max Campaign Distance** (de 5km a 50km).
- **Conexión con Google Calendar**: Botón `OAuth` para sincronizar eventos del calendario personal con el AI Stylist.
- **Tarjeta de Servicios de Ubicación**: Activa/desactiva los permisos de ubicación GPS para `feeds` de expertos emparejados por distancia y pronóstico del tiempo hiperlocal.
- **Botón Invitar Amigos**: Copia el `referral link` compartible.
- **Asistente de Compras**: Accede a los detalles de la extensión de Chrome Web Store o genera un **Universal Bookmarklet** (`javascript:...`) para comparaciones instantáneas de tallas en `e-commerce`.

---

### 5. Acciones de Cuenta y Diagnósticos
- **Cerrar Sesión**: Cierra tu sesión actual.
- **Eliminar mi Cuenta**: Enlace para purgar permanentemente los datos de la cuenta.
- **Panel de Desarrollador**: Acordeón `diagnostic` para pruebas de `environment`.

---

## Resultados Esperados
- Sincronización instantánea de métricas físicas, tono de piel y recortes de fotos en el `Canvas` de Prueba de Avatar 2D.
- Cero `idle network requests` al navegar entre los paneles de configuración.
- Propuestas de atuendos personalizadas del AI Stylist alineadas con tus reglas de modestia y horario.

---

## Solución de Problemas
- **Fondo de la foto no eliminado**: Asegúrate de que tu foto subida sea de cuerpo completo con una iluminación de fondo contrastante.
- **Las alertas `push` no llegan**: Confirma que los `browser notification permissions` estén habilitados y que un número de teléfono esté guardado en *Contacto*.
- **`Address autocomplete` no responde**: Verifica que la conexión a internet esté activa para las `OpenStreetMap Nominatim queries`.

---

## Limitaciones
- El espacio de cuenta del `Free tier` está limitado a 150 ítems, a menos que se expanda mediante un `referral bonus` (+10 `slots` por invitación) o una suscripción `Pro`.
- El modo de clave `API` personalizada requiere claves válidas con `quota` restante del proveedor respectivo.
