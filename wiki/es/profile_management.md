# Perfil, Medidas y Configuración (`/me`)

Gestione sus medidas corporales, tono de piel, recortes de foto corporal, preferencias de estilo, credenciales de modelos de IA e integraciones del sistema en su panel de control de perfil personal.

## Visión General
La página de **Perfil y Configuración** (`https://dressapp.co/me`) actúa como el centro de control principal para su ecosistema DressApp. Almacena sus parámetros antropométricos físicos, el escenario virtual de prueba de vestuario, restricciones de estilo, preferencias regionalizadas, claves de API para modelos de IA y programación de notificaciones push.

---

## Requisitos Previos
- Una cuenta activa de DressApp.
- (Opcional) Permisos de cámara en el dispositivo para cargar fotografías de cuerpo entero.
- (Opcional) Permisos de ubicación para campañas de estilistas locales y pronósticos meteorológicos.

---

## Guía Paso a Paso: Resumen de la Página de Arriba a Abajo

### 1. Encabezado de la Página y Barra de Navegación Explorar
Ubicado en la parte superior del panel `/me`:
- **Encabezado (Header)**: Muestra el estado y título de su cuenta.
- **Tarjetas de Exploración (Explore Cards)**: Accesos directos a las secciones principales de la aplicación:
  - **Trend Scout** (`/trends`): Ver noticias diarias de moda seleccionadas por IA.
  - **Conjuntos (Outfits)** (`/outfits`): Acceda a su calendario de conjuntos guardados.
  - **Expertos (Experts)** (`/experts`): Explore estilistas de moda y sastres locales.
  - **Estadísticas (Stats)** (`/me/stats`): Muestra la valoración del armario, el coste por uso y desglose de colores.

### 2. Tarjeta de Selección de Idioma y Voz
Destacada prominentemente para un acceso inmediato:
- **Selector de Idioma**: Elija entre 12 idiomas compatibles (*Inglés, Español, Francés, Alemán, Italiano, Portugués, Ruso, Chino, Japonés, Árabe, Hindi, Hebreo*). La selección de un idioma actualiza automáticamente la interfaz de usuario y vincula el modelo de voz regional predeterminado de Texto a Voz (TTS).

---

### 3. Tarjeta de Identidad y Detalles Personales (`ProfileDetailsCard`)

Contiene 9 paneles desplegables tipo acordeón para gestionar su identidad personal, medidas y renderizado del avatar:

#### Panel A: Identidad
- **Nombre y Apellidos**: Campos de identificación personal.
- **Correo Electrónico**: Visualización de solo lectura de su correo registrado.
- **Fecha de Nacimiento**: Utilizada para personalizar las puntuaciones de tendencias demográficas.
- *Insignia de Autocompletado de Google*: Aparece automáticamente si su perfil se creó mediante Google OAuth.

#### Panel B: Contacto y Dirección de Envío
- **Número de Teléfono**: Requerido para recibir alertas de SMS/Push con propuestas diarias y campañas locales.
- **Dirección Línea 1**: Cuenta con autocompletado a nivel de calle mediante OpenStreetMap (Nominatim).
- **Dirección Línea 2, Ciudad, Región, Código Postal**: Campos de dirección manuales para envíos del mercado.
- **País**: Menú desplegable offline con búsqueda por nombre de país o código ISO-2.

#### Panel C: Demografía
- **Sexo**: Seleccione *Femenino* o *Masculino* para configurar las medidas corporales base y taxonomía de prendas.
- **Estado Civil**: Seleccione *Soltero/a*, *Casado/a*, *Divorciado/a* o *Viudo/a*.
- **Ocupación**: Entrada de texto libre (ej. *Estudiante*, *Gerente de Marketing*, *Barista*). Alimenta el algoritmo de personalización de Trend Scout.

#### Panel D: Preferencias y Unidades de Medida
- **Unidad de Peso**: Alternar entre Kilogramos (`kg`) y Libras (`lb`).
- **Unidad de Longitud**: Alternar entre Centímetros (`cm`) y Pulgadas (`in`).

#### Panel E: Fotos y Escenario de Avatar Digital
- **Columna Izquierda — Selector de Fotos**:
  - *Foto de Rostro*: Cargar miniatura del avatar.
  - *Foto de Cuerpo Entero*: Cargar fotografía completa. El sistema ejecuta automáticamente el recortador U2-Net (`rembg`) para eliminar el fondo.
  - *Botón Eliminar Foto*: Elimina el recorte de la foto con un solo clic, volviendo al maniquí vectorial 2D SVG sin retrasos.
- **Columna Derecha — Avatar Digital y Escenario de Prueba**:
  - **Selector de Tono de Piel**: Paleta de colores interactiva para seleccionar el tono de piel del maniquí.
  - **Lienzo de Prueba del Avatar**: Renderiza prendas sobre el recorte de su foto o sobre el maniquí vectorial Bezier (`DynamicAvatar.jsx`) usando desplazamientos calibrados (`top-[14.5%]` de cuello a escote y `top-[36.5%]` de pretina a cintura).

#### Panel F: Perfil de Estilo
- **Estética**: Palabras clave de estilo separadas por comas (ej. *Minimalista, Streetwear, Vintage*).
- **Paleta de Colores**: Tonos preferidos (ej. *Pastel, Tonos Tierra, Monocromático*).
- **Evitar**: Colores o tipos de prendas a excluir estrictamente de las recomendaciones de IA.
- **Conservadurismo Cultural**: Seleccione el nivel de recato (*Casual/Relajado*, *Moderado*, *Conservador*) para guiar la cobertura del estilista de IA.

#### Panel G: Medidas Corporales y Tallas (Predictor ANSUR II)
- **Modo Inicial / Nuevo Comienzo**: Introduzca 4 datos básicos: **Altura**, **Peso**, **Circunferencia de Cintura** y **Longitud del Pie**. El modelo de regresión multisalida ANSUR II integrado con scikit-learn predice automáticamente 6 medidas estructurales:
  - *Hombros*, *Pecho / Busto*, *Cadera*, *Largo de Manga*, *Tiro Interior* y *Tiro Exterior*.
- **Modo de Edición Detallada**: Ajuste fino de los 15 parámetros de talla y atributos de cabello.

#### Panel H: Registro en el Directorio Profesional y de Expertos
- **Selector de Estilista Profesional**: Regístrese como profesional certificado (estilista, sastre, diseñador).
- **Detalles del Negocio**: Ingrese Nombre comercial, Dirección, Teléfono, Correo, Sitio web y Descripción para figurar en `/experts`.

#### Panel I: Configuración de Pagos de PayPal
- **Correo Receptor de PayPal**: Ingrese su correo electrónico de PayPal para recibir pagos del mercado y campañas.

---

## 4. Tarjeta Acordeón de Preferencias del Sistema

Gestiona la configuración a nivel de sistema, suscripciones e integraciones de IA:

- **Configuración de IA (AI Configuration)**:
  - *Modo Estándar*: Utiliza los puntos de enlace Gemini Flash 2.x gestionados por el sistema.
  - *Modo Claves API Personalizadas*: Conecte claves API propias de Google Gemini, Anthropic, OpenAI o DeepSeek.
- **Límites de Suscripción y Armario**:
  - Ver nivel de cuenta actual (**Gratuito**: límite de 150 artículos vs **Pro**: artículos ilimitados).
  - Actualizar mediante la REST API de Suscripciones de PayPal ($4.99/mes o $29.99/año).
  - Copiar **Enlace de Referencia**: Otorga +10 espacios de capacidad de armario por cada amigo registrado.
- **Programador y Recordatorios Push**:
  - Activar notificaciones de propuestas diarias de vestidos por la mañana.
  - Ajustar frecuencia, hora y exigencias del código de vestimenta (*Casual*, *Formal*, *Deportivo*, *Personalizado*).
  - Habilitar alertas push VAPID del navegador.
- **Preferencias de Notificaciones de Campañas**:
  - Interruptores detallados para *Moda Local Push/Email*, *Alertas de Ofertas*, *Moda Sostenible*, *Promociones de Lujo* y *Estilista Personal*.
  - Ajustar deslizador de **Distancia Máxima de Campaña** (5 km a 50 km).
- **Conexión con Google Calendar**: Botón OAuth para sincronizar eventos personales con el estilista IA.
- **Servicios de Ubicación**: Active los permisos de GPS para los mapas de expertos locales y clima.
- **Botón Invitar Amigos**: Copiar enlace de recomendación compartible.
- **Asistente de Compras**: Acceda a los detalles de la extensión de Chrome Web Store o genere un **Marcador Universal** (`javascript:...`) para comparaciones instantáneas de tallas en e-commerce.

---

## 5. Acciones de la Cuenta y Diagnósticos
- **Cerrar Sesión**: Salir de la sesión actual.
- **Eliminar mi Cuenta**: Enlace para purgar permanentemente los datos de la cuenta.
- **Panel de Desarrolladores**: Acordeón de diagnóstico para pruebas del entorno.

---

## Resultados Esperados
- Sincronización instantánea de métricas físicas, tono de piel y recortes fotográficos en el lienzo de prueba 2D del avatar.
- Cero peticiones de red innecesarias al navegar entre paneles de configuración.
- Propuestas de conjuntos de IA personalizadas y alineadas con sus reglas de vestimenta y agenda.

---

## Resolución de Problemas
- **El fondo de la foto no se elimina**: Asegúrese de que la foto cargada sea de cuerpo entero con iluminación de fondo contrastada.
- **No llegan las alertas push**: Confirme que los permisos de notificación del navegador estén habilitados y que haya un número de teléfono guardado.
- **El autocompletado de dirección no responde**: Verifique que la conexión a Internet esté activa para las consultas de OpenStreetMap Nominatim.

---

## Limitaciones
- El espacio de la cuenta gratuita está limitado a 150 artículos a menos que se amplíe mediante bonos de recomendación (+10 por invitación) o suscripción Pro.
- El modo de clave API personalizada requiere claves válidas con cuota disponible del proveedor correspondiente.