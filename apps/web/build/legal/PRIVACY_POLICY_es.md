# Política de Privacidad de DressApp

**Fecha de entrada en vigor:** 27 de julio de 2026
**Última actualización:** 27 de julio de 2026

Esta Política de Privacidad describe cómo DressApp ("nosotros", "nuestro" o "nos") recopila, utiliza, almacena, comparte y protege sus datos personales cuando utiliza nuestra aplicación de guardarropa digital y estilismo.

Por favor, lea esta política cuidadosamente. Al utilizar DressApp, usted acepta las prácticas de datos descritas en este documento. Si no está de acuerdo, no utilice la aplicación.

---

## 1. Información que Recopilamos

### 1.1 Información de Cuenta y Perfil
Cuando crea una cuenta o se conecta mediante inicio de sesión social, recopilamos:

- **Dirección de correo electrónico** — utilizada para la identificación de la cuenta, autenticación y comunicaciones transaccionales.
- **Contraseña** — almacenada como hash criptográfico; nunca almacenamos contraseñas en texto plano.
- **Nombre para mostrar** — su nombre público elegido dentro de la aplicación.
- **Nombre y apellidos** — poblados desde el perfil de Google OAuth o introducidos manualmente; editables en cualquier momento.
- **Número de teléfono** — opcional; utilizado para recuperación de cuenta y notificaciones.
- **Fecha de nacimiento** — opcional; utilizada para filtrado de contenido por edad.
- **Sexo** — opcional; utilizado para recomendaciones de medidas corporales y avatar.
- **Estado civil** — opcional (soltero, casado, divorciado, viudo).
- **Dirección** — opcional; estructurada como {línea1, línea2, ciudad, región, país, código postal}.
- **Configuración regional e idioma preferido** — utilizados para localizar la experiencia de la aplicación.
- **Voz preferida** — utilizada para la salida de voz del estilista de IA.
- **Avatar y fotos de perfil** — foto de rostro y foto corporal, almacenadas como URLs de datos base64 en MongoDB (limitadas a ~500 KB cada una en el cliente).
- **Medidas corporales** — altura, peso, busto, cintura, caderas y otras medidas utilizadas para la generación de avatar y recomendaciones de ajuste de prendas.
- **Perfil de cabello** — longitud, tipo, color y estilo (opcional).
- **Ubicación de origen** — ciudad, país y coordenadas (lat/long), utilizada para sugerencias de vestuario basadas en el clima y segmentación de campañas.
- **Perfil de estilo y contexto cultural** — sus preferencias de estilo y origen cultural utilizados para recomendaciones personalizadas.

### 1.2 Datos de Guardarropa y Multimedia
DressApp es una aplicación de guardarropa digital. Los siguientes datos son fundamentales para el funcionamiento de la aplicación:

- **Fotos del guardarropa** — imágenes de sus prendas subidas. Se procesan en el navegador para la eliminación de fondos (recorte) y luego se almacenan como URLs de datos en MongoDB.
- **Metadatos de prendas** — categoría (Parte superior, Parte inferior, Calzado, Abrigo, Vestido, Accesorio), marca, color, talla, temporada, tradición, código de vestimenta, género y etiquetas de subcategoría.
- **Datos de conjuntos** — combinaciones guardadas de prendas del guardarropa.
- **Anuncios en el mercado** — si vende o intercambia artículos, detalles del anuncio incluyendo fotos, precio e información de envío.
- **Datos de equipaje/lista de empaque** — listas de empaque para viajes con artículos, cantidades y etiquetas de propósito (ej. "Senderismo / Outdoors").

### 1.3 Permisos del Dispositivo
DressApp solicita los siguientes permisos del dispositivo:

- **Cámara** — para capturar fotos de prendas directamente en la aplicación.
- **Biblioteca de fotos / acceso al sistema de archivos** — para seleccionar fotos existentes para subir.
- **Geolocalización** — acceso a ubicación aproximada para obtener datos meteorológicos y sugerir conjuntos. Puede negar o revocar este permiso en cualquier momento.
- **Notificaciones** — notificaciones push opcionales para actualizaciones de campañas y sugerencias del estilista.

### 1.4 Procesamiento de IA y Aprendizaje Automático
DressApp utiliza IA en el dispositivo y en el servidor para los siguientes fines:

- **Eliminación de fondos (recorte)** — sus fotos de prendas subidas se procesan mediante el pipeline `rembg` / u2netp para extraer recortes limpios. Este procesamiento ocurre en el servidor.
- **Predicción corporal** — el modelo SegFormer estima las medidas corporales a partir de fotos de conjunto completas.
- **Clasificación de prendas** — la clasificación basada en CLIP etiqueta los artículos con categorías, colores y marcas.
- **Recomendaciones del estilista** — la API de Google Gemini procesa los datos de su guardarropa para generar sugerencias de conjuntos y consejos de estilo.
- **Generación de avatar** — los parámetros de forma del avatar 3D se calculan a partir de las medidas corporales para el probador virtual.

**Importante:** Las fotos subidas por los usuarios **no** se utilizan para entrenar ningún modelo de aprendizaje automático. Se procesan únicamente para proporcionar las funciones principales de la aplicación y no se comparten con pipelines de entrenamiento de modelos.

### 1.5 Datos de Uso y Análisis
Recopilamos datos de uso agregados y anónimos para mejorar la aplicación:

- Patrones de actividad y uso de funciones de la aplicación.
- Datos de interacción con artículos (visualizaciones, ediciones, eliminaciones).
- Identificadores de dispositivo (dirección IP, versión del sistema operativo, tipo de navegador).
- Análisis de campañas (impresiones de anuncios, clics, visualizaciones) — vinculados a IDs de campaña, no a identidades de usuario individuales.

**No** utilizamos SDKs de análisis de terceros (no Mixpanel, Firebase Analytics, Amplitude, Sentry, LogRocket ni similares). Todo el análisis se gestiona internamente.

### 1.6 Datos de Pago
Si utiliza las funciones de mercado o suscripción de DressApp, recopilamos:

- **Stripe** — ID de cuenta de Stripe, ID de suscripción e IDs de intención de pago. Los números de tarjeta de crédito nunca se almacenan en nuestros servidores; son gestionados directamente por Stripe.
- **PayPal** — correo electrónico del receptor PayPal y IDs de pedido/captura.
- **Apple Pay / Google Play** — tokens de pago gestionados por los SDK de la plataforma correspondiente; no almacenamos detalles de tarjetas.

### 1.7 Datos de Autenticación de Terceros
- **Google OAuth** — cuando inicia sesión con Google, recibimos y almacenamos un token OAuth encriptado (campo `google_oauth`) utilizado para acceder a su perfil de Google (nombre, correo, foto) y, opcionalmente, Google Calendar y People API para funciones de programación y contactos.

---

## 2. Cómo Utilizamos Sus Datos

Utilizamos sus datos para los siguientes fines:

| Propósito | Base legal (GDPR) | Tipos de datos |
|---|---|---|
| Proporcionar funciones principales de la aplicación (organización del guardarropa, creación de conjuntos, generación de avatar) | Necesidad contractual | Fotos del guardarropa, metadatos, medidas corporales |
| Procesar eliminación de fondos y recorte de prendas | Necesidad contractual | Fotos de prendas subidas |
| Generar recomendaciones del estilista de IA | Interés legítimo | Metadatos del guardarropa, perfil de estilo |
| Obtener datos meteorológicos para sugerencias de conjuntos | Consentimiento (permiso de ubicación) | Ubicación de origen (aproximada) |
| Autenticar y gestionar cuentas de usuario | Necesidad contractual | Correo electrónico, hash de contraseña, tokens OAuth |
| Enviar correos electrónicos transaccionales (confirmaciones de cuenta, restablecimiento de contraseña, confirmaciones de eliminación) | Necesidad contractual | Dirección de correo electrónico |
| Procesar pagos del mercado | Necesidad contractual | Tokens Stripe/PayPal, información de facturación |
| Detectar y prevenir fraude / abuso | Interés legítimo | Dirección IP, identificadores de dispositivo |
| Mejorar la funcionalidad de la aplicación (análisis agregados) | Interés legítimo | Datos de uso anónimos |
| Cumplir con obligaciones legales | Obligación legal | Todos los datos según lo requiera la ley |

---

## 3. Almacenamiento y Seguridad de Datos

### 3.1 Almacenamiento
- **Base de datos:** MongoDB Atlas (alojado en la nube, capa gratuita M0 o capa de pago según el despliegue).
- **Imágenes:** Las fotos del guardarropa se almacenan como URLs de datos codificados en base64 dentro de documentos MongoDB. Cada imagen está limitada a ~500 KB en el cliente antes de la subida.
- **Caché de modelos:** Los pesos de modelos de IA (SegFormer, u2netp) se almacenan en caché en volúmenes Docker persistentes en el servidor de producción para evitar descargas repetidas en cada solicitud.
- **No se utiliza un almacén de bloques externo** para imágenes en este momento; todos los datos de imagen residen en MongoDB.

### 3.2 Seguridad
- Todos los datos en tránsito están encriptados mediante **HTTPS/TLS 1.3**.
- Las contraseñas se almacenan como **hashes bcrypt** — nunca en texto plano.
- Los tokens de Google OAuth se almacenan encriptados en reposo.
- Los datos de pago (tokens Stripe/PayPal) nunca se almacenan en texto plano en nuestros servidores; solo almacenamos IDs de referencia.
- MongoDB Atlas proporciona **encriptación en reposo** y **encriptación en tránsito** de forma predeterminada.
- El acceso a la base de datos está restringido a la aplicación backend mediante credenciales de cadena de conexión.

### 3.3 Retención de Datos
- Sus datos se conservan mientras su cuenta esté activa.
- Tras la eliminación de la cuenta (ver Sección 5), todos los datos personales se eliminan permanentemente de MongoDB dentro de los 30 días.
- Los datos de análisis agregados y anónimos pueden conservarse indefinidamente y no pueden vincularse a usuarios individuales.

---

## 4. Compartición de Datos y Terceros

Compartimos sus datos con los siguientes terceros únicamente como se describe a continuación:

| Tercero | Datos compartidos | Propósito |
|---|---|---|
| **MongoDB Atlas** | Todos los datos de usuario e imágenes del guardarropa | Alojamiento de base de datos en la nube |
| **Google (OAuth)** | Correo electrónico, nombre, foto de perfil | Autenticación y creación de perfil |
| **Google Calendar API** | Datos de eventos del calendario (si está conectado) | Funciones de programación del estilista |
| **Google People API** | Datos de contactos (si está conectado) | Funciones sociales |
| **Google Gemini API** | Metadatos del guardarropa y descripciones de artículos | Recomendaciones del estilista de IA |
| **Stripe** | Tokens de pago, información de facturación | Procesamiento de pagos |
| **PayPal** | Tokens de pago, información de facturación | Procesamiento de pagos |
| **Resend / SendGrid** | Correo electrónico y nombre | Entrega de correos electrónicos transaccionales |

**NO vendemos sus datos personales ni sus fotos del guardarropa a intermediarios, anunciantes o agregadores de datos de terceros.**

---

## 5. Sus Derechos y Eliminación de Cuenta

Bajo el RGPD (UE/EEE), la CCPA (California) y otras leyes de privacidad aplicables, usted tiene los siguientes derechos:

### 5.1 Acceso y Exportación
Puede solicitar una copia de todos los datos personales que poseemos sobre usted contactándonos (ver Sección 6). Proporcionaremos una exportación JSON de los datos de su cuenta, incluyendo artículos del guardarropa, conjuntos e información del perfil.

### 5.2 Corrección
Puede actualizar o corregir la información de su perfil en cualquier momento a través de la página de Configuración de la aplicación. Los campos que puede editar incluyen: nombre para mostrar, nombre y apellidos, teléfono, fecha de nacimiento, dirección, medidas corporales, ubicación de origen y preferencias de estilo.

### 5.3 Eliminación (Derecho al Olvido)
Puede eliminar su cuenta y todos los datos asociados en cualquier momento:

- **En la aplicación:** Vaya a Configuración → Cuenta → Eliminar Cuenta.
- **API:** Envíe una solicitud `POST` a `/api/v1/users/me/delete` (autenticada).

La eliminación de la cuenta activa una **eliminación en cascada** en todas las colecciones:
- Documento de usuario
- Todos los artículos del guardarropa (fotos y metadatos)
- Todos los conjuntos
- Todos los anuncios en el mercado
- Todas las maletas y listas de empaque
- Todas las sesiones y mensajes del estilista
- Todas las recargas de créditos y registros de transacciones
- Todos los embeddings (datos generados por IA)
- Todas las suscripciones de notificaciones push

Se envía un correo electrónico de confirmación de eliminación a su dirección de correo electrónico registrada.

### 5.4 Portabilidad de Datos
Puede solicitar sus datos en un formato estructurado y legible por máquina (JSON) en cualquier momento. Contacte con nosotros usando los detalles de la Sección 6.

### 5.5 Retirar el Consentimiento
Puede retirar el consentimiento para el acceso a la ubicación, la cámara y las comunicaciones de marketing en cualquier momento a través de la configuración de su dispositivo o la página de Configuración de la aplicación. Retirar el consentimiento puede limitar ciertas funciones de la aplicación (ej. sugerencias de conjuntos basadas en el clima).

### 5.6 Derecho de Oposición (LGPD Art. 18, GDPR Art. 21)
Bajo la LGPD (Brasil) y el RGPD (UE/EEE), usted tiene derecho a oponerse al procesamiento de sus datos personales para fines específicos, incluyendo:
- Procesamiento basado en interés legítimo
- Marketing directo
- Perfilado y toma de decisiones automatizadas (incluyendo recomendaciones de estilista basadas en IA)

Para objetar, contacte con nosotros usando los detalles de la Sección 6.

### 5.7 Transferencias Internacionales de Datos
DressApp es una aplicación internacional. Sus datos pueden transferirse y procesarse en países distintos de su país de residencia, incluyendo Israel y los Estados Unidos. Garantizamos que todas las transferencias se rigen por salvaguardas adecuadas, incluyendo Cláusulas Contractuales Tipo (SCC) cuando lo exija la ley aplicable.

---

## 6. Información de Contacto

Para consultas relacionadas con la privacidad, solicitudes de acceso a datos, solicitudes de eliminación o para informar de una preocupación de privacidad, contacte con nosotros en:

**Correo electrónico:** dev@dressapp.co
**Dirección:** DressApp, 11 Hanoter St, 8442711 Be'er-Sheva, Israel

Responderemos a todas las solicitudes válidas dentro de los 30 días, según lo requerido por las leyes de privacidad aplicables incluyendo RGPD, CCPA, LGPD, PIPEDA y otras regulaciones internacionales de protección de datos.

Para Solicitudes de Acceso de Sujetos de Datos (DSAR), incluya la dirección de correo electrónico de su cuenta y una descripción de los datos que desea acceder o modificar.

---

## 7. Privacidad de Menores

DressApp no está destinada a menores de 16 años (o la edad de consentimiento digital aplicable en su jurisdicción, la que sea mayor). No recopilamos conscientemente datos personales de nadie menor de esta edad. Si tenemos conocimiento de que un menor nos ha proporcionado datos personales, tomaremos medidas para eliminarlos rápidamente.

Si usted es un padre o tutor legal y cree que su hijo nos ha proporcionado datos personales, por favor contacte con nosotros en dev@dressapp.co y tomaremos medidas inmediatas.

---

## 8. Cumplimiento Internacional

DressApp está diseñada para operar en todos los países. Esta Política de Privacidad está redactada para cumplir con los siguientes marcos internacionales de protección de datos:

| Marco | Jurisdicción | Disposiciones clave cubiertas |
|---|---|---|
| **RGPD** | UE/EEE | Base legal, derechos del titular de datos, contacto del DPO, transferencias internacionales, notificación de violaciones |
| **CCPA/CPRA** | California, EE. UU. | Derecho a saber, eliminar, optar por no vender, no discriminación |
| **LGPD** | Brasil | Base legal, derechos del titular de datos, DPO, transferencias internacionales, consentimiento |
| **PIPEDA** | Canadá | Consentimiento, acceso, corrección, responsabilidad, notificación de violaciones |
| **POPIA** | Sudáfrica | Procesamiento legal, derechos del titular de datos, transferencia transfronteriza |
| **PDPA** | Tailandia | Consentimiento, derechos del titular de datos, transferencia internacional |
| **PDPL** | Arabia Saudita | Base legal, derechos del titular de datos, transferencia internacional |

Cuando la ley de una jurisdicción específica requiera derechos o protecciones adicionales más allá de lo descrito en esta política, esos derechos adicionales se aplicarán.

---

## 9. Cambios en Esta Política de Privacidad

Podemos actualizar esta Política de Privacidad de vez en cuando. Notificaremos los cambios materiales mediante:

- Publicando la política actualizada en esta página con una "Fecha de entrada en vigor" revisada.
- Enviando una notificación por correo electrónico a su dirección de correo electrónico registrada para cambios significativos.
- Mostrando un aviso en la aplicación la próxima vez que la abra.

Le animamos a revisar esta política periódicamente.

---

## 10. Fecha de Entrada en Vigor y Ley Aplicable

Esta Política de Privacidad está vigente a partir del **27 de julio de 2026**.

DressApp es una aplicación internacional que opera en todos los países. Esta política se rige por los principios del **Reglamento General de Protección de Datos (RGPD)** — UE/EEE, la **Ley de Privacidad del Consumidor de California (CCPA)** — Estados Unidos, la **Ley General de Protección de Datos (LGPD)** — Brasil, la **Ley de Protección de Información Personal y Documentos Electrónicos (PIPEDA)** — Canadá, y otras leyes internacionales de protección de datos aplicables. En caso de conflicto entre estos marcos, se aplicará el estándar más protector para el usuario.

---

## 11. Cumplimiento en Tiendas de Aplicaciones

Esta Política de Privacidad está alojada públicamente en:

**https://dressapp.co/privacy**

Está referenciada en:
- **Apple App Store Connect** — Sección de Privacidad de la App
- **Google Play Console** — Sección de Seguridad de Datos
- **Configuración de la aplicación** — hay un enlace directo disponible en el menú de Configuración
- **Flujo de incorporación** — se muestra un aviso de privacidad durante la configuración inicial de la cuenta

---

*DressApp respeta su privacidad y se compromete con prácticas de datos transparentes. Si tiene alguna pregunta sobre esta política o sobre cómo manejamos sus datos, por favor contacte con nosotros en dev@dressapp.co.*