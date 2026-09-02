# Perfil, Tallas y Configuración (`/me`)

Administre sus medidas físicas, tono de piel, recortes de fotos corporales, preferencias de estilo, credenciales de modelos de IA e integraciones de sistemas en su panel de perfil personal.

## Resumen general
La página de **Perfil y Configuración** (`https://dressapp.co/me`) sirve como centro de control para su ecosistema DressApp. Contiene sus parámetros físicos antropométricos, el escenario del avatar de prueba virtual digital, restricciones de estilo, preferencias de idioma y región, claves de modelos de IA e itinerarios de alertas.

---

## Requisitos previos
- Una cuenta activa de DressApp.
- (Opcional) Permisos de cámara del dispositivo para subir fotos de cuerpo completo.
- (Opcional) Permisos de ubicación para el direccionamiento local de campañas de estilistas, restricciones culturales y pronósticos meteorológicos.

---

## Guía paso a paso: Resumen de la página de arriba a abajo

### 1. Cabecera de página y barra de navegación de exploración
Ubicada en la parte superior del panel `/me`:
- **Cabecera (Header)**: Muestra el estado y título de su cuenta.
- **Tarjetas de exploración**: Accesos directos rápidos a las secciones principales de la aplicación:
  - **Trend Scout** (`/trends`): Ver novedades de moda curadas diariamente por la IA.
  - **Outfits** (`/outfits`): Acceder a su calendario de conjuntos guardados.
  - **Experts** (`/experts`): Buscar estilistas de moda y sastres locales.
  - **Unpacked / Stats** (`/me/stats`): Ver valor del armario, métricas de costo por uso y desglose de colores.

### 2. Tarjeta de selección de idioma y voz
Ubicada de forma destacada para accesibilidad inmediata:
- **Selector de idioma**: Elija entre 12 idiomas admitidos (*español, inglés, francés, alemán, italiano, portugués, ruso, chino, japonés, árabe, hindi, hebreo*). Al seleccionar un idioma se actualiza automáticamente el entorno regional de la interfaz y se asocia el modelo de voz de texto a voz (TTS) predeterminado de la región.

---

### 3. Tarjeta de identidad y detalles personales (`ProfileDetailsCard`)

Contiene 9 paneles expandibles tipo acordeón que administran la identidad personal, tallas y representación del avatar:

#### Panel A: Identidad
- **Nombre y Apellido**: Campos de identificación personal.
- **Dirección de correo electrónico**: Visualización de solo lectura de su correo registrado.
- **Fecha de nacimiento**: Se utiliza para personalizar la clasificación de tendencias demográficas.
- *Etiqueta de autocompletar de Google*: Se muestra automáticamente si su perfil se creó a través de Google OAuth.

#### Panel B: Dirección de contacto y envío
- **Número de teléfono**: Requerido para recibir alertas por SMS o notificaciones push para las propuestas diarias del planificador y campañas de expertos locales.
- **Línea de dirección 1**: Cuenta con autocompletado de calles a nivel de calle por medio de OpenStreetMap (Nominatim). Al seleccionar una sugerencia, se rellenan automáticamente la línea 1, la ciudad, la región, el código postal y el país.
- **Línea de dirección 2, Ciudad, Región, Código postal**: Campos de dirección manuales para envíos del mercado.
- **País**: Cuadro combinado sin conexión con función de búsqueda por nombre de país o código ISO-2.

#### Panel C: Datos demográficos
- **Sexo**: Seleccione *Female* (Femenino) o *Male* (Masculino) para configurar las medidas corporales básicas y la taxonomía de la ropa.
- **Estado civil**: Seleccione *Single* (Soltero/a), *Married* (Casado/a), *Divorced* (Divorciado/a) o *Widowed* (Viudo/a).
- **Ocupación**: Entrada de texto libre (p. ej., *Estudiante*, *Gerente de marketing*, *Barista*). Alimenta al clasificador de personalización de Trend Scout para priorizar noticias de estilo relevantes.

#### Guía resumida: Sincronizar datos del perfil de Google que faltan (Reconsentimiento de People API)
Si inició sesión con Google antes de que DressApp solicitara acceso a los detalles de su perfil de **People API** (teléfono, dirección, género, fecha de nacimiento), es posible que esos campos permanezcan vacíos. Puede sincronizarlos con un solo clic:

1. **Abra el acordeón de Contacto o Demografía** — verá un botón de **"Sync from Google"** (icono de actualización) junto al título de la sección.
2. **Haga clic en "Sync from Google"** — si no se otorgaron los permisos de People API necesarios durante su inicio de sesión original, DressApp detectará esto y mostrará un aviso flotante: *"Google necesita su permiso para acceder a los detalles del perfil. Será redirigido a Google para otorgar el acceso."*
3. **Otorgue el consentimiento en la pantalla de Google** — será redirigido a la pantalla de consentimiento de OAuth de Google. Marque las casillas de **Profile info** (nombre, correo electrónico, foto) y **Contact info** (teléfono, dirección, género, cumpleaños).
4. **Retorno automático y autocompletado** — después del consentimiento, Google lo redirigirá de regreso a DressApp. La función `syncGoogleProfile()` se ejecuta automáticamente, llamando al punto final del backend `/auth/google/sync-profile` que:
   - Recupera su teléfono, dirección, género y fecha de nacimiento de Google People API.
   - Rellena los campos vacíos en los paneles de **Contacto** (teléfono, dirección) y **Demografía** (sexo, fecha de nacimiento).
   - Guarda las actualizaciones en su perfil al instante.
5. **Listo** — su perfil está completo ahora sin necesidad de escribir manualmente.

> **Nota**: El botón "Sync from Google" también aparece en la cabecera de la página (junto al botón principal "Sincronizar perfil de Google") y funciona de la misma manera: sincroniza todos los datos del perfil de Google disponibles a la vez.

#### Panel D: Preferencias y unidades de medida
- **Unidad de peso**: Cambie entre kilogramos (`kg`) y libras (`lb`).
- **Unidad de longitud**: Cambie entre centímetros (`cm`) y pulgadas (`in`).

#### Panel E: Fotos y escenario del avatar digital
- **Columna izquierda — Selectores de fotos**:
  - *Foto de rostro*: Suba una foto para miniatura del avatar.
  - *Foto de cuerpo completo*: Suba una fotografía de cuerpo completo. El sistema ejecuta automáticamente la separación de fondo local de U2-Net (`rembg`).
  - *Botón eliminar foto*: Eliminación con un solo clic de su recorte de foto, cambiando instantáneamente el escenario de prueba a la marioneta vectorizada 2D SVG sin retrasos de interfaz.
- **Columna derecha — Avatar digital y escenario de prueba**:
  - **Selector de tono de piel**: Paleta de colores interactiva para seleccionar el tono de piel del maniquí.
  - **Lienzo de prueba de avatar**: Muestra las prendas encima de su recorte de foto o del maniquí vectorial Bezier dinámico (`DynamicAvatar.jsx`) utilizando desfases de puntos de referencia calibrados (`top-[14.5%]` de cuello a escote y `top-[36.5%]` de pretina a cintura).

#### Panel F: Perfil de estilo
- **Estética**: Palabras clave de estilo separadas por comas (p. ej., *Minimalist, Streetwear, Vintage*).
- **Paleta de colores**: Tonos de color preferidos (p. ej., *Pastels, Earth Tones, Monochrome*).
- **Evitar**: Colores o tipos de prendas que se deben excluir estrictamente de las recomendaciones de IA (p. ej., *Yellow, Crop Tops*).
- **Conservadurismo cultural de la ropa**: Seleccione el nivel de recato (*Casual/Relaxed*, *Moderate*, *Conservative*) para guiar la cobertura de ropa del AI Stylist.

#### Panel G: Medidas corporales y tallas (ANSUR II Sizing Predictor)
- **Modo de inicio rápido / Onboarding**: Ingrese 4 datos básicos: **Altura**, **Peso**, **Circunferencia de cintura** y **Longitud del pie**. El modelo de regresión de salida múltiple ANSUR II de scikit-learn predice automáticamente 6 medidas estructurales:
  - *Hombros*, *Pecho / Busto*, *Cadera*, *Longitud de manga*, *Costura interna del pantalón (Inseam)* y *Costura externa (Outseam)*.
- **Traducción automática de tallas**: Una vez predichas las medidas estructurales, los algoritmos deterministas de tallas rellenan al instante **todas las tallas comerciales estándar** hasta la talla de zapatos:
  - *Talla de camisa casual* (XS–XXL según la circunferencia del pecho).
  - *Talla de cintura de pantalones* (pulgadas, convertidas a partir de cm de cintura).
  - *Talla de calzado de EE. UU.* (fórmulas de hombres/mujeres a partir de la longitud del pie).
  - *Talla de vestido para mujer* (EE. UU. 0–14+ según la cintura).
  - *Talla de sostén para mujer* (banda + copa calculadas a partir del busto/bajo busto).
- **Modo de edición detallado**: Después del autocompletado, ajuste los 15 parámetros de tallas (incluidas talla de camisa, talla de pantalones, talla de calzado, talla de sostén, talla de vestido) y atributos del cabello (*Longitud, Tipo, Color, Estilo*).
- **Cambio de unidades en vivo**: Cambie entre *kg/cm* y *lb/in*: todos los valores se convierten de inmediato sin necesidad de volver a predecir.

#### Panel H: Registro en el directorio de profesionales y expertos
- **Interruptor de estilista profesional**: Regístrese como profesional de la moda verificado (estilista, sastre, diseñador).
- **Detalles comerciales**: Ingrese nombre comercial, dirección, teléfono, correo electrónico, sitio web y descripción para aparecer en el directorio `/experts` y en el indicador de campañas regionales.

#### Panel I: Configuración de pagos de PayPal
- **Correo electrónico de receptor de PayPal**: Ingrese su correo de PayPal para recibir pagos por ventas del mercado y campañas activas de expertos.

---

### 4. Tarjeta acordeón de preferencias del sistema

Administra configuraciones a nivel de sistema, suscripciones e integraciones de IA:

- **Configuración de IA**:
  - *Modo estándar*: Utiliza puntos finales de Gemini Flash 2.x administrados por el sistema.
  - *Modo de claves de API personalizadas*: Conecte claves de API personalizadas de Google Gemini, Anthropic, OpenAI o DeepSeek a través de un modal guiado.
- **Suscripción y límites del armario**:
  - Ver el nivel de cuenta actual (**Free**: límite de 50 elementos frente a **Manager** o **Professional**: elementos ilimitados).
  - Acceder a la **página de precios** (`/pricing` o haga clic en la tarjeta de su plan) para ver la tabla de comparación de niveles, seleccionar un plan y suscribirse.
  - Actualizar a través de la API REST de PayPal Subscriptions (Manager: $4.99/mes; Professional: $9.99/mes) o la pasarela Atzmai para transacciones locales en ILS.
  - Copiar **enlace de recomendación**: Otorga +10 espacios de capacidad de armario por cada amigo que se registre (hasta un máximo de 200 elementos).
- **Planer & Push-Erinnerungen (Planificador y recordatorios push)**:
  - Activar/desactivar las notificaciones diarias de propuestas de conjuntos por la mañana.
  - Establecer frecuencia (*Todos los días*, *Día por medio*, *Dos veces por semana*, *En días laborables*), hora (p. ej., *07:00*) y demandas de estilo de código de vestir (*Casual*, *Formal*, *Athletic*, *Custom*).
  - Activar alertas push VAPID del navegador.
- **Preferencias de notificaciones de campañas**:
  - Interruptores detallados para *Local Fashion Push/Email*, *Sale Alerts*, *Sustainable Fashion*, *Luxury Promos* y *Personal Stylist*.
  - Ajustar el control deslizante de **distancia máxima de campaña** (5 km a 50 km).
- **Conexión a Google Calendar**: Botón OAuth para sincronizar eventos de calendario personal con el AI Stylist.
- **Tarjeta de servicios de ubicación**: Active los permisos de ubicación GPS para fuentes de expertos emparejados por distancia y clima local.
- **Botón invitar amigos**: Copiar enlace de recomendación compartible.
- **Asistente de compras**: Acceda a los detalles de la extensión de Chrome Web Store o genere un **Universal Bookmarklet** (`javascript:...`) para comparaciones de tallas instantáneas en tiendas en línea.

---

### 5. Acciones de cuenta y diagnósticos
- **Cerrar sesión**: Salir de su sesión actual.
- **Eliminar mi cuenta**: Enlace para purgar permanentemente los datos de la cuenta.
- **Panel de desarrollador**: Acordeón de diagnóstico para pruebas de entorno.

---

## Resultados esperados
- Sincronización instantánea de métricas físicas, tono de piel y recortes de fotos en el lienzo de prueba de avatar 2D.
- Cero solicitudes de red inactivas al navegar entre los paneles de configuración.
- Propuestas de conjuntos de AI Stylist personalizadas y adaptadas a sus reglas de recato y agenda.

---

## Resolución de problemas
- **No se quitó el fondo de la foto**: Asegúrese de que su foto subida sea de cuerpo completo con iluminación de fondo contrastante.
- **No llegan las alertas push**: Confirme que los permisos de notificación del navegador estén habilitados y que haya un número de teléfono guardado en *Contacto*.
- **El autocompletado de direcciones no responde**: Compruebe que la conexión a Internet esté activa para las consultas de OpenStreetMap Nominatim.

---

## Limitaciones
- El espacio de cuenta de nivel gratuito está limitado a 50 elementos a menos que se amplíe mediante bonos de recomendación (+10 espacios por invitación hasta un máximo de 200 elementos) o actualizando al nivel Manager o Professional.
- El modo de clave de API personalizada requiere claves válidas con cuota restante del proveedor respectivo.
