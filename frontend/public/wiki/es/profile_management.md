# Perfil, Tallas y Configuración (`/me`)

Gestione medidas corporales, tono de piel, recortes de fotos de cuerpo completo, preferencias de estilo, credenciales de modelos de IA e integraciones del sistema en su panel de control personal.

## Descripción General
La página **Perfil y Configuración** (`https://dressapp.co/me`) sirve como centro de control central para su ecosistema DressApp. Alberga sus parámetros antropométricos físicos, escenario de avatar de prueba digital, restricciones de estilo, preferencias localizadas, claves de modelos de IA y programas de notificaciones push.

---

## Requisitos Previos
- Una cuenta DressApp activa.
- (Opcional) Permisos de cámara del dispositivo para subida de foto de cuerpo completo.
- (Opcional) Permisos de ubicación para segmentación de campañas de estilistas locales y pronóstico del tiempo.

---

## Guía Paso a Paso: Vista General de la Página de Arriba a Abajo

### 1. Encabezado de Página y Barra de Navegación Explorar
Ubicado en la parte superior del panel `/me`:
- **Encabezado**: Muestra el estado y título de su cuenta.
- **Tarjetas Explorar**: Accesos directos a secciones principales de la app:
  - **Trend Scout** (`/trends`): Ver feeds diarios de noticias de moda curados por IA.
  - **Outfits** (`/outfits`): Acceder a su calendario de outfits guardados.
  - **Expertos** (`/experts`): Navegar estilistas y sastres de moda locales.
  - **Unpacked / Estadísticas** (`/me/stats`): Ver valoración del armario, métricas de coste por uso y desgloses de color.

### 2. Tarjeta de Selección de Idioma y Voz
Mostrada prominentemente para accesibilidad inmediata:
- **Selector de Idioma**: Elija entre 12 idiomas soportados (*Inglés, Español, Francés, Alemán, Italiano, Portugués, Ruso, Chino, Japonés, Árabe, Hindi, Hebreo*). Seleccionar un idioma actualiza automáticamente la locale de la UI y vincula el modelo de voz Text-to-Speech (TTS) regional predeterminado.

---

### 3. Tarjeta de Identidad y Detalles Personales (`ProfileDetailsCard`)

Contiene 9 paneles acordeón expandibles que gestionan su identidad personal, tallas y renderizado de avatar:

#### Panel A: Identidad
- **Nombre y Apellidos**: Campos de identificación personal.
- **Dirección de Email**: Visualización de solo lectura de su email registrado.
- **Fecha de Nacimiento**: Usada para personalizar puntuación de tendencias demográficas.
- *Insignia de Autollenado Google*: Se muestra automáticamente si su perfil se creó vía Google OAuth.

#### Panel B: Contacto y Dirección de Entrega
- **Número de Teléfono**: Requerido para recibir alertas SMS/Push de propuestas del planificador diario y campañas de expertos locales.
- **Línea de Dirección 1**: Autocompletado a nivel de calle con OpenStreetMap (Nominatim). Seleccionar una sugerencia rellena automáticamente Línea 1, Ciudad, Región, Código Postal y País.
- **Línea de Dirección 2, Ciudad, Región, Código Postal**: Campos manuales de dirección para envíos del marketplace.
- **País**: Combobox offline buscable por nombre de país o código ISO-2.

#### Panel C: Demografía
- **Sexo**: Seleccione *Mujer* u *Hombre* para configurar medidas base del cuerpo y taxonomía de ropa.
- **Estado Civil**: Seleccione *Soltero*, *Casado*, *Divorciado* o *Viudo*.
- **Ocupación**: Entrada de texto libre (ej. *Estudiante*, *Gerente de Marketing*, *Barista*). Alimenta el ranker de personalización de Trend Scout para priorizar noticias de estilo relevantes.

#### Panel D: Preferencias y Unidades de Medida
- **Unidad de Peso**: Alternar entre Kilogramos (`kg`) y Libras (`lb`).
- **Unidad de Longitud**: Alternar entre Centímetros (`cm`) y Pulgadas (`in`).

#### Panel E: Fotos y Escenario de Avatar Digital
- **Columna Izquierda — Selectores de Foto**:
  - *Foto de Cara*: Subir miniatura de avatar.
  - *Foto de Cuerpo Completo*: Subir foto de cuerpo completo. El sistema ejecuta automáticamente matting U2-Net local (`rembg`) para quitar el fondo.
  - *Botón Eliminar Foto*: Eliminación con un clic de su recorte de foto, cambiando instantáneamente el escenario de prueba al maniquí vectorial SVG 2D sin lag de UI.
- **Columna Derecha — Avatar Digital y Escenario de Prueba**:
  - **Selector de Tono de Piel**: Paleta de colores interactiva para seleccionar el tono de piel del maniquí.
  - **Lienzo de Prueba de Avatar**: Renderiza prendas sobre su recorte de foto o maniquí vectorial Bézier dinámico (`DynamicAvatar.jsx`) usando offsets de puntos de referencia calibrados (`top-[14.5%]` cuello-a-escote y `top-[36.5%]` cinturón-a-cintura).

#### Panel F: Perfil de Estilo
- **Estéticas**: Palabras clave de estilo separadas por comas (ej. *Minimalista, Streetwear, Vintage*).
- **Paleta de Colores**: Tonos de color preferidos (ej. *Pasteles, Tonos Tierra, Monocromo*).
- **Evitar**: Colores o tipos de prenda a excluir estrictamente de recomendaciones IA (ej. *Amarillo, Tops Cortos*).
- **Conservadurismo en Vestimenta Cultural**: Seleccione nivel de modestia (*Casual/Relajado*, *Moderado*, *Conservador*) para guiar la cobertura de outfits del Estilista IA.

#### Panel G: Medidas Corporales y Tallas (Predictor de Tallas ANSUR II)
- **Modo Onboarding / Inicio Fresco**: Ingrese 4 entradas básicas: **Altura**, **Peso**, **Circunferencia de Cintura** y **Longitud de Pie**. El modelo de regresión multi-salida ANSUR II integrado scikit-learn predice automáticamente 6 medidas estructurales:
  - *Hombros*, *Pecho/Busto*, *Cadera*, *Largo de Manga*, *Entrepierna* y *Largo Exterior*.
- **Traducción Automática de Tallas**: Una vez predichas las medidas estructurales, algoritmos deterministas de tallas poblan **todas las tallas estándar de retail** instantáneamente hasta la talla de zapato:
  - *Talla Camisa Casual* (XS–XXL basada en circunferencia de pecho)
  - *Talla Cintura Pantalón* (pulgadas, convertida de cintura cm)
  - *Talla Zapato US* (Fórmulas Hombre/Mujer de largo de pie)
  - *Talla Vestido Mujer* (US 0–14+ basada en cintura)
  - *Talla Sujetador Mujer* (banda + copa calculada de busto/sub-busto)
- **Modo Edición Detallada**: Tras el auto-relleno, afinar los 15 parámetros de talla (incluyendo Talla Camisa, Talla Pantalón, Talla Zapato, Talla Sujetador, Talla Vestido) y atributos de cabello (*Largo, Tipo, Color, Estilo*).
- **Alternancia de Unidades en Vivo**: Cambiar entre *kg/cm* y *lb/in* — todos los valores convierten instantáneamente sin re-predicción.

#### Panel H: Registro en Directorio Profesional y de Expertos
- **Interruptor Estilista Profesional**: Registrarse como profesional de moda verificado (estilista, sastre, diseñador).
- **Detalles de Negocio**: Ingresar Nombre de Negocio, Dirección, Teléfono, Email, Web y Descripción para aparecer en directorio `/experts` y ticker de campañas regionales.

#### Panel I: Configuración de Pagos PayPal
- **Email Receptor PayPal**: Ingrese su email de PayPal para recibir pagos por ventas en marketplace y campañas de expertos activas.

---

### 4. Tarjeta Acordeón de Preferencias del Sistema

Gestiona configuraciones a nivel de sistema, suscripciones e integraciones de IA:

- **Configuración IA**:
  - *Modo Estándar*: Usa endpoints Gemini Flash 2.x gestionados por el sistema.
  - *Modo Claves API Personalizadas*: Conecte claves Google Gemini, Anthropic, OpenAI o DeepSeek API propias vía modal de configuración guiada.
- **Suscripción y Límites de Armario**:
  - Ver nivel actual de cuenta (**Gratis**: límite 150 items vs **Pro**: Items ilimitados).
  - Actualizar vía PayPal Subscriptions REST API ($4.99/mes o $29.99/año).
  - Copiar **Enlace de Referido**: Otorga +10 slots de capacidad de armario por cada amigo que se registre.
- **Planificador y Recordatorios Push**:
  - Alternar notificaciones de propuestas de outfit matutinas.
  - Establecer frecuencia (*Diario*, *Cada Dos Días*, *Dos Veces a la Semana*, *En Días Laborables*), hora (ej. *07:00*) y exigencias de código de vestimenta (*Casual*, *Formal*, *Deportivo*, *Personalizado*).
  - Habilitar alertas push VAPID del navegador.
- **Preferencias de Notificaciones de Campañas**:
  - Interruptores granulares para *Push/Email Moda Local*, *Alertas de Rebajas*, *Moda Sostenible*, *Promos de Lujo* y *Estilista Personal*.
  - Ajustar control deslizante **Distancia Máxima de Campaña** (5km a 50km).
- **Conectar Google Calendar**: Botón OAuth para sincronizar eventos de calendario personal con el Estilista IA.
- **Tarjeta de Servicios de Ubicación**: Alternar permisos GPS para feeds de expertos por distancia y clima hiperlocal.
- **Botón Invitar Amigos**: Copiar enlace de referido compartible.
- **Asistente de Compras**: Acceder a detalles de extensión Chrome Web Store o generar **Bookmarklet Universal** (`javascript:...`) para comparaciones instantáneas de tallas en e-commerce.

---

### 5. Acciones de Cuenta y Diagnóstico
- **Cerrar Sesión**: Salir de su sesión actual.
- **Eliminar mi Cuenta**: Enlace para purgar datos de cuenta permanentemente.
- **Panel de Desarrollador**: Acordeón de diagnóstico para pruebas de entorno.

---

## Resultados Esperados
- Sincronización instantánea de métricas físicas, tono de piel y recortes de foto en el lienzo de prueba de Avatar 2D.
- Cero peticiones de red inactivas al navegar entre paneles de configuración.
- Propuestas de outfit del Estilista IA personalizadas alineadas con sus reglas de modestia y horario.

---

## Solución de Problemas
- **Fondo de foto no eliminado**: Asegúrese de que su foto subida sea de cuerpo completo con iluminación de fondo contrastante.
- **Alertas push no llegan**: Confirme que permisos de notificación del navegador están habilitados y un número de teléfono guardado bajo *Contacto*.
- **Autocompletado de dirección no responde**: Verifique que la conexión a internet está activa para consultas OpenStreetMap Nominatim.

---

## Limitaciones
- Espacio de cuenta nivel gratis limitado a 150 items a menos que se expanda vía bono de referido (+10 slots por invitación) o suscripción Pro.
- Modo clave API personalizada requiere claves válidas con cuota restante del proveedor respectivo.

(Fin del archivo)