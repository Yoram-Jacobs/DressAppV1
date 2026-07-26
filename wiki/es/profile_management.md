# Gestión de Perfil, Tallas y Configuración (`/me`)

Gestione medidas corporales, tono de piel, recortes de fotos de cuerpo, preferencias de estilo, credenciales de modelos de IA e integraciones del sistema en su panel de control personal.

## Resumen
La página **Perfil y Configuración** (`https://dressapp.co/me`) sirve como centro de control central para su ecosistema DressApp. Alberga sus parámetros antropométricos físicos, escenario de avatar digital de prueba virtual, restricciones de estilo, preferencias localizadas, claves de modelos de IA y programaciones de notificaciones push.

---

## Requisitos Previos
- Una cuenta DressApp activa.
- (Opcional) Permisos de cámara del dispositivo para subida de foto de cuerpo completo.
- (Opcional) Permisos de ubicación para segmentación de campañas de estilistas locales y pronósticos meteorológicos.

---

## Guía Paso a Paso: Vista General de la Página de Arriba a Abajo

### 1. Barra de Navegación y Exploración del Encabezado de Página
Ubicada en la parte superior del panel `/me`:
- **Encabezado**: Muestra el estado de su cuenta y título.
- **Tarjetas de Exploración**: Accesos rápidos a las secciones principales de la app:
  - **Explorador de Tendencias** (`/trends`): Ver feeds diarios de noticias de moda curadas por IA.
  - **Outfits** (`/outfits`): Acceder a su calendario de outfits guardados.
  - **Expertos** (`/experts`): Navegar estilistas y sastres locales de moda.
  - **Unpacked / Estadísticas** (`/me/stats`): Ver valoración de armario, métricas de coste por uso y desgloses de color.

### 2. Tarjeta de Selección de Idioma y Voz
Mostrada prominentemente para accesibilidad inmediata:
- **Selector de Idioma**: Elija entre 12 idiomas soportados (*Inglés, Español, Francés, Alemán, Italiano, Portugués, Ruso, Chino, Japonés, Árabe, Hindi, Hebreo*). Seleccionar un idioma actualiza automáticamente la locale de la UI y vincula el modelo de voz Text-to-Speech (TTS) regional por defecto.

---

### 3. Tarjeta de Identidad y Detalles Personales (`ProfileDetailsCard`)

Contiene 9 paneles acordeón expansibles que gestionan su identidad personal, tallas y renderizado de avatar:

#### Panel A: Identidad
- **Nombre y Apellidos**: Campos de identificación personal.
- **Dirección de Email**: Visualización de solo lectura de su email registrado.
- **Fecha de Nacimiento**: Usada para personalizar puntuación de tendencias demográficas.
- *Insignia de Autocompletado de Google*: Se muestra automáticamente si su perfil se creó vía Google OAuth.

#### Panel B: Contacto y Dirección de Envío
- **Número de Teléfono**: Requerido para recibir alertas SMS/Push de propuestas del programador diario y campañas de expertos locales.
- **Línea de Dirección 1**: Autocompletado a nivel de calle con OpenStreetMap (Nominatim). Seleccionar una sugerencia rellena automáticamente Línea 1, Ciudad, Región, Código Postal y País.
- **Línea de Dirección 2, Ciudad, Región, Código Postal**: Campos manuales para envíos del marketplace.
- **País**: Combo box offline buscable por nombre de país o código ISO-2.

#### Panel C: Demografía
- **Sexo**: Seleccione *Mujer* u *Hombre* para configurar medidas base del cuerpo y taxonomía de ropa.
- **Estado Civil**: Seleccione *Soltero*, *Casado*, *Divorciado* o *Viudo*.
- **Ocupación**: Entrada de texto libre (ej. *Estudiante*, *Gerente de Marketing*, *Barista*). Alimenta el ranker de personalización del Trend Scout para priorizar noticias de estilo relevantes.

#### Guía Resumida: Sincronizar Datos Faltantes del Perfil de Google (Re-consentimiento People API)
Si inició sesión con Google antes de que DressApp solicitara acceso a los detalles de su perfil **People API** (teléfono, dirección, sexo, fecha de nacimiento), esos campos pueden quedar vacíos. Puede sincronizarlos en un clic:

1. **Abra el acordeón de Contacto o Demografía** — verá un botón **"Sincronizar desde Google"** (icono de actualizar) junto al título de la sección.
2. **Haga clic en "Sincronizar desde Google"** — si los scopes requeridos de People API no se concedieron durante su inicio de sesión original, DressApp lo detecta y muestra un toast informativo: *"Google necesita su permiso para acceder a los detalles del perfil. Será redirigido a Google para conceder acceso."*
3. **Conceda consentimiento en la pantalla de Google** — será redirigido a la pantalla de consentimiento OAuth de Google. Marque las casillas de **Información de perfil** (nombre, email, foto) e **Información de contacto** (teléfono, dirección, sexo, cumpleaños).
4. **Regreso automático y auto-relleno** — tras el consentimiento, Google le redirige de vuelta a DressApp. La función `syncGoogleProfile()` se ejecuta automáticamente, llamando al endpoint backend `/auth/google/sync-profile` que:
   - Obtiene su teléfono, dirección, sexo y fecha de nacimiento de Google People API
   - Rellena los campos vacíos en los paneles **Contacto** (teléfono, dirección) y **Demografía** (sexo, fecha de nacimiento)
   - Guarda las actualizaciones en su perfil instantáneamente
5. **Listo** — su perfil está ahora completo sin escritura manual.

> **Nota**: El botón "Sincronizar desde Google" también aparece en la cabecera de la página (junto al botón principal "Sincronizar Perfil de Google") y funciona igual — sincroniza todos los datos disponibles del perfil de Google de una vez.

#### Panel D: Preferencias y Unidades de Medida
- **Unidad de Peso**: Alternar entre Kilogramos (`kg`) y Libras (`lb`).
- **Unidad de Longitud**: Alternar entre Centímetros (`cm`) y Pulgadas (`in`).

#### Panel E: Fotos y Escenario de Avatar Digital
- **Columna Izquierda — Selectores de Foto**:
  - *Foto de Cara*: Subir miniatura de avatar.
  - *Foto de Cuerpo Completo*: Subir fotografía de cuerpo completo. El sistema ejecuta automáticamente matting U2-Net local (`rembg`) para eliminar el fondo.
  - *Botón Eliminar Foto*: Eliminación de un clic de su recorte de foto, cambiando instantáneamente el escenario de prueba virtual al maniquí vectorial SVG 2D sin lag de UI.
- **Columna Derecha — Avatar Digital y Escenario de Prueba**:
  - **Selector de Tono de Piel**: Paleta de colores interactiva para seleccionar el tono de piel de su maniquí.
  - **Canvas de Prueba de Avatar**: Renderiza prendas sobre su recorte de foto o maniquí vectorial Bézier dinámico (`DynamicAvatar.jsx`) usando offsets de landmarks calibrados (`top-[14.5%]` cuello-a-línea de cuello y `top-[36.5%]` cintura-a-cintura).

#### Panel F: Perfil de Estilo
- **Estética**: Palabras clave de estilo separadas por comas (ej. *Minimalista, Streetwear, Vintage*).
- **Paleta de Colores**: Tonos de color preferidos (ej. *Pasteles, Tonos Tierra, Monocromo*).
- **Evitar**: Colores o tipos de prenda a excluir estrictamente de recomendaciones IA (ej. *Amarillo, Tops Cortos*).
- **Conservadurismo en Vestimenta Cultural**: Seleccionar nivel de modestia (*Casual/Relajado*, *Moderado*, *Conservador*) para guiar la cobertura de outfits del Estilista IA.

#### Panel G: Medidas Corporales y Tallas (Predictor de Tallas ANSUR II)
- **Modo Onboarding / Inicio Fresco**: Introduzca 4 entradas básicas: **Altura**, **Peso**, **Circunferencia de Cintura** y **Longitud de Pie**. El modelo de regresión multi-salida ANSUR II de scikit-learn integrado predice automáticamente 6 medidas estructurales:
  - *Hombros*, *Pecho/Busto*, *Cadera*, *Largo de Manga*, *Entrepierna* y *Largo Exterior*.
- **Traducción Automática de Tallas**: Una vez predichas las medidas estructurales, algoritmos de tallas deterministas rellenan instantáneamente **todas las tallas estándar de retail** hasta la talla de zapato:
  - *Talla Camiseta Casual* (XS–XXL basada en circunferencia de pecho)
  - *Talla Cintura Pantalón* (pulgadas, convertida de cm de cintura)
  - *Talla Zapato US* (Fórmulas Hombre/Mujer desde longitud de pie)
  - *Talla Vestido Mujer* (US 0–14+ basada en cintura)
  - *Talla Sujetador Mujer* (banda + copa calculada de busto/sub-busto)
- **Modo Edición Detallada**: Tras el auto-relleno, ajuste fino de todos los 15 parámetros de talla (incl. Talla Camisa, Talla Pantalón, Talla Zapato, Talla Sujetador, Talla Vestido) y atributos de cabello (*Largo, Tipo, Color, Estilo*).
- **Alternancia de Unidades en Vivo**: Cambiar entre *kg/cm* y *lb/in* — todos los valores convierten instantáneamente sin re-predicción.

#### Panel H: Registro en Directorio Profesional y de Expertos
- **Interruptor Estilista Profesional**: Regístrese como profesional de moda verificado (estilista, sastre, diseñador).
- **Detalles de Negocio**: Introduzca Nombre de Negocio, Dirección, Teléfono, Email, Web y Descripción para aparecer en el directorio `/experts` y ticker de campañas regionales.

#### Panel I: Configuración de Pagos PayPal
- **Email Receptor PayPal**: Introduzca su email de PayPal para recibir pagos por ventas del marketplace y campañas de expertos activos.

---

### 4. Tarjeta Acordeón de Preferencias del Sistema

Gestiona ajustes a nivel de sistema, suscripciones e integraciones de IA:

- **Configuración IA**:
  - *Modo Estándar*: Usa endpoints Gemini Flash 2.x gestionados por el sistema.
  - *Modo Claves API Personalizadas*: Conecte claves API personalizadas de Google Gemini, Anthropic, OpenAI o DeepSeek vía modal de configuración guiada.
- **Suscripción y Límites de Armario**:
  - Ver nivel de cuenta actual (**Gratis**: límite 150 items vs **Pro**: Items ilimitados).
  - Actualizar vía PayPal Subscriptions REST API ($4.99/mes o $29.99/año).
  - Copiar **Enlace de Referido**: Otorga +10 slots de capacidad de armario por cada amigo que se registre.
- **Programador y Recordatorios Push**:
  - Alternar notificaciones de propuestas de outfit matutinas.
  - Establecer frecuencia (*Diario*, *Cada Dos Días*, *Dos Veces por Semana*, *En Días Laborables*), hora (ej. *07:00*) y exigencias de código de vestimenta (*Casual*, *Formal*, *Deportivo*, *Personalizado*).
  - Habilitar alertas push VAPID del navegador.
- **Preferencias de Notificaciones de Campaña**:
  - Interruptores granulares para *Push/Email Moda Local*, *Alertas de Rebajas*, *Moda Sostenible*, *Promos Lujo* y *Estilista Personal*.
  - Ajustar slider **Distancia Máxima de Campaña** (5km a 50km).
- **Conectar Google Calendar**: Botón OAuth para sincronizar eventos de calendario personal con el Estilista IA.
- **Tarjeta Servicios de Ubicación**: Alternar permisos GPS para feeds de expertos por distancia y clima hiperlocal.
- **Botón Invitar Amigos**: Copiar enlace de referido compartible.
- **Asistente de Compras**: Acceder a detalles de extensión Chrome Web Store o generar **Bookmarklet Universal** (`javascript:...`) para comparaciones instantáneas de tallas en e-commerce.

---

### 5. Acciones de Cuenta y Diagnóstico
- **Cerrar Sesión**: Cerrar sesión de su sesión actual.
- **Eliminar mi Cuenta**: Enlace para purgar datos de cuenta permanentemente.
- **Panel de Desarrollador**: Acordeón de diagnóstico para pruebas de entorno.

---

## Resultados Esperados
- Sincronización instantánea de métricas físicas, tono de piel y recortes de fotos a través del Canvas de Prueba de Avatar 2D.
- Cero peticiones de red inactivas al navegar entre paneles de configuración.
- Propuestas de outfits personalizadas del Estilista IA alineadas con sus reglas de modestia y horario.

---

## Solución de Problemas
- **Fondo de foto no eliminado**: Asegúrese de que su foto subida es de cuerpo completo con iluminación de fondo contrastante.
- **Alertas push no llegan**: Confirme que los permisos de notificación del navegador están habilitados y un número de teléfono está guardado bajo *Contacto*.
- **Autocompletado de dirección no responde**: Verifique que la conexión a internet está activa para consultas OpenStreetMap Nominatim.

---

## Limitaciones
- Espacio de cuenta de nivel gratuito limitado a 150 items a menos que se expanda vía bono de referido (+10 slots por invitación) o suscripción Pro.
- Modo clave API personalizada requiere claves válidas con cuota restante del proveedor respectivo.

(Fin del archivo)