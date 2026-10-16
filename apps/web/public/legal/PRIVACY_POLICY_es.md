# Política de Privacidad de DressApp

**Fecha de Entrada en Vigor:** 23 de septiembre de 2026  
**Última Actualización:** 16 de octubre de 2026  
**Versión de la Aplicación:** 1.0.5  
**Sitio Web Oficial:** [https://dressapp.co](https://dressapp.co)  
**URL Dedicada a la Privacidad:** [https://dressapp.co/privacy](https://dressapp.co/privacy)  

Bienvenido a **DressApp** ("nosotros", "nuestro", "nos" o "la Aplicación"). DressApp es una plataforma inteligente de armario digital, planificación de estilo y estilista personal con IA desarrollada y operada por **DressApp Ltd.**

Esta Política de Privacidad explica en detalle cómo accedemos, recopilamos, utilizamos, procesamos, almacenamos, divulgamos, conservamos y protegemos la información personal cuando usted utiliza nuestra plataforma web, aplicaciones móviles y servicios conectados. Lea este documento detenidamente. Al crear una cuenta o utilizar DressApp, usted reconoce y acepta las prácticas descritas en esta política.

---

## 1. Información que Recopilamos y a la que Accedemos

Recopilamos información que usted nos proporciona directamente, información recopilada automáticamente mediante la interacción con su dispositivo e información obtenida a través de integraciones autorizadas de terceros.

### 1.1 Información de Cuenta e Identidad
- **Credenciales de Autenticación:** Dirección de correo electrónico y contraseñas cifradas mediante hash criptográfico (con sal generada mediante bcrypt). Nunca almacenamos contraseñas en texto plano.
- **Datos del Perfil:** Nombre para mostrar, nombre, apellido, número de teléfono (opcional), fecha de nacimiento (opcional) y género (opcional, utilizado para el estilismo personalizado y la geometría del avatar).
- **Datos Demográficos y de Tallas:** Medidas corporales (estatura, peso, pecho, cintura, caderas, tiro/entrepierna, largo de brazo), preferencia de tono de piel y perfil de cabello (opcional) para generar avatares de prueba virtual y recomendaciones de ajuste precisas.
- **Información de Ubicación:** Ciudad, país y coordenadas geográficas aproximadas (latitud/longitud) proporcionadas con su consentimiento para obtener las condiciones meteorológicas locales y ofrecer recomendaciones diarias de atuendos adaptadas al clima.

### 1.2 Armario Digital, Multimedia y Atuendos
- **Fotografías de Prendas:** Imágenes de prendas de vestir que usted fotografía o sube a su armario digital.
- **Metadatos de Prendas:** Categoría del artículo (Parte superior, Parte inferior, Calzado, Ropa de abrigo, Vestido, Accesorio), marca, paleta de colores, composición del tejido, formalidad/código de vestimenta, temporada y etiquetas de estado.
- **Atuendos y Looks:** Combinaciones de atuendos creadas por el usuario, looks programados en el calendario y listas de equipaje para maletas.
- **Contenido del Mercado (Marketplace):** Anuncios de artículos creados para la venta, intercambio o donación, incluidas descripciones, precios solicitados y preferencias de entrega.

### 1.3 Permisos del Dispositivo
- **Cámara:** Utilizada estrictamente cuando usted captura fotografías de prendas de vestir directamente dentro de la aplicación.
- **Galería de Fotos:** Utilizada estrictamente cuando usted selecciona fotografías existentes de prendas o avatares de perfil para subirlas.
- **Notificaciones Push:** Utilizadas únicamente con su permiso para enviar recordatorios diarios de atuendos, actualizaciones del asistente de equipaje y alertas de seguridad importantes.

---

## 2. Datos de Usuario de Google y Declaración de Uso Limitado

DressApp ofrece integraciones opcionales con Google para facilitar el inicio de sesión del usuario y la programación personalizada. Esta sección detalla explícitamente a qué datos de usuario de Google se accede, cómo se utilizan, cómo se almacenan y nuestro cumplimiento de los estrictos estándares de privacidad de Google.

> ### Política de Datos de Usuario de los Servicios API de Google — Declaración de Uso Limitado
> **El uso y la transferencia por parte de DressApp a cualquier otra aplicación de la información recibida de las API de Google cumplirán con la [Política de Datos de Usuario de los Servicios API de Google](https://developers.google.com/terms/api-services-user-data-policy), incluidos los requisitos de Uso Limitado.**

### 2.1 A Qué Datos de Usuario de Google Accedemos

| Alcance de la API de Google (Scope) | Datos a los que se Accede | Propósito Específico en DressApp |
|---|---|---|
| `openid`<br>`userinfo.email`<br>`userinfo.profile` | ID de usuario de Google, dirección de correo electrónico principal, nombre completo y URL de la imagen de perfil. | Para autenticar su identidad, crear y proteger su cuenta de usuario de DressApp, y mostrar su nombre e imagen de perfil en el panel de su armario personal. |
| `https://www.googleapis.com/auth/calendar.events.readonly` | Resúmenes de eventos de Google Calendar, marcas de tiempo de inicio y fin de eventos, ubicaciones y descripciones de eventos. | Acceso de solo lectura utilizado exclusivamente por la función AI Stylist para fundamentar las sugerencias de atuendos en su agenda real (por ejemplo, sugerir vestimenta formal de negocios para reuniones programadas, ropa deportiva para entrenamientos o vestimenta de etiqueta para eventos nocturnos). |
| `https://www.googleapis.com/auth/user.birthday.read`<br>`https://www.googleapis.com/auth/user.gender.read` | Fecha de nacimiento y género (si están completados en su perfil de Google y se han autorizado explícitamente). | Utilizados para calibrar los algoritmos de tallas del avatar corporal, ofrecer consejos de estilo adecuados a la edad y recomendaciones de ajuste. |
| `https://www.googleapis.com/auth/user.phonenumbers.read`<br>`https://www.googleapis.com/auth/user.addresses.read` | Número de teléfono y dirección (si están completados en su perfil de Google y se han autorizado explícitamente). | Utilizados únicamente para precompletar direcciones de envío en transacciones del mercado y recuperación de cuenta, previa confirmación explícita del usuario. |

### 2.2 Cómo Utilizamos los Datos de Usuario de Google
- Los datos de usuario de Google se utilizan **estrictamente para proporcionar y mejorar las funciones orientadas al usuario** de la aplicación DressApp (autenticación, configuración del perfil de usuario y recomendaciones de atuendos basadas en la agenda).
- Procesamos los títulos y las marcas de tiempo de los eventos de Google Calendar en memoria transitoria para generar recomendaciones diarias de armario y listas de equipaje.

### 2.3 Prohibiciones y Protecciones Estrictas sobre los Datos de Usuario de Google
- **Sin Entrenamiento de Modelos:** Los datos de usuario de Google y los datos de las API de Google Workspace **NO** se utilizan para desarrollar, mejorar ni entrenar modelos generalizados o no personalizados de Inteligencia Artificial (IA) o Aprendizaje Automático (ML).
- **Sin Publicidad:** **NO** utilizamos, transferimos ni divulgamos datos de usuario de Google para mostrar anuncios publicitarios, incluida la publicidad dirigida, personalizada, de retargeting o basada en intereses.
- **Sin Corredores de Datos ni Reventa:** **NO** vendemos, alquilamos, licenciamos ni intercambiamos datos de usuario de Google con terceros, corredores de datos ni revendedores de información bajo ninguna circunstancia.
- **Sin Evaluación Crediticia o de Préstamos:** Los datos de usuario de Google nunca se utilizan para determinar la solvencia crediticia ni con fines de concesión de préstamos.
- **Restricciones de Acceso Humano:** Los empleados, contratistas y desarrolladores humanos **NO** leen sus datos de usuario de Google a menos que:
  1. Usted haya otorgado su consentimiento afirmativo explícito para una sesión específica de resolución de problemas;
  2. Sea estrictamente necesario para investigaciones de seguridad (como investigar abusos, fraudes o malware);
  3. Sea exigido para cumplir con la legislación vigente aplicable o con órdenes gubernamentales válidas; o
  4. Los datos estén agregados y anonimizados para operaciones técnicas internas.

---

## 3. Cómo Procesamos y Utilizamos los Datos Generales

Procesamos la información personal no procedente de Google sobre las siguientes bases legales:

| Actividad de Procesamiento | Base Legal (RGPD / Estándares Globales) | Categorías de Datos Utilizadas |
|---|---|---|
| Indexación, catalogación del armario digital y creación de atuendos | Necesidad contractual | Fotografías de prendas, categorías, colores, metadatos |
| Eliminación de fondos con IA y extracción de recortes transparentes de prendas | Necesidad contractual | Fotografías de ropa subidas |
| Recomendaciones de looks y asesoramiento de estilo del AI Stylist | Interés legítimo / Consentimiento | Metadatos del armario, preferencias de estilo |
| Planificación de atuendos adaptada al clima | Consentimiento (permiso de ubicación) | Ubicación aproximada (ciudad/coordenadas) |
| Comunicaciones transaccionales (alertas de seguridad, restablecimiento de contraseñas) | Necesidad contractual | Dirección de correo electrónico de la cuenta |
| Transacciones en el mercado y facilitación de pagos | Necesidad contractual | Tokens del proveedor de pagos (Stripe/PayPal), historial de transacciones |

---

## 4. Almacenamiento de Datos, Seguridad y Mecanismos de Protección

Implementamos sólidas medidas de seguridad administrativas, técnicas y físicas diseñadas para proteger sus datos confidenciales contra el acceso no autorizado, la alteración, la divulgación o la destrucción:

- **Cifrado en Tránsito:** El 100 % de los datos transmitidos entre su navegador/aplicación y nuestros servidores se cifra utilizando protocolos modernos **HTTPS y Seguridad de la Capa de Transporte (TLS 1.3 / TLS 1.2)**.
- **Protección de Almacenamiento y Base de Datos Autohospedada Aislada:** Todos los registros de la base de datos, metadatos del armario, entradas de perfil y credenciales OAuth cifradas se almacenan en la **base de datos MongoDB 7.0 en servidores propios (on-premises)** aislada y autogestionada de DressApp, alojada en almacenamiento NVMe dedicado de **Hetzner Cloud (UE)**, aislada dentro de una red privada interna de contenedores sin exposición pública de puertos de base de datos y protegida mediante cifrado AES-256 para tokens confidenciales y copias de seguridad locales automatizadas.
- **Protección Criptográfica de Contraseñas:** Las contraseñas de los usuarios se cifran mediante hash bcrypt incorporando sales únicas por usuario.
- **Control de Acceso:** El acceso a la infraestructura de producción está estrictamente restringido mediante autenticación por clave SSH, autenticación multifactor (MFA), controles de acceso basados en roles de privilegio mínimo (RBAC) y registro continuo de auditoría.

---

## 5. Retención y Eliminación de Datos

### 5.1 Duración de la Retención
- Conservamos sus datos personales y registros del armario mientras su cuenta de usuario de DressApp permanezca activa.
- Los tokens de acceso de Google OAuth y la caché del calendario se conservan únicamente mientras la integración con Google permanezca activa y autorizada por usted.

### 5.2 Desconexión de las Integraciones de Google
- Puede desconectar su cuenta de Google o la integración con Google Calendar en cualquier momento directamente en la aplicación a través de **Configuración → Integraciones → Desconectar Google**.
- También puede revocar los permisos de DressApp directamente desde la [Configuración de Seguridad de su Cuenta de Google](https://myaccount.google.com/permissions).
- Tras la desconexión, los tokens almacenados de Google OAuth y los registros en caché de eventos del calendario se eliminan de inmediato de nuestros sistemas activos.

### 5.3 Eliminación de la Cuenta y Derecho de Supresión
Usted tiene el derecho absoluto de eliminar su cuenta y todos los datos asociados en cualquier momento:
- **Eliminación en Un Clic dentro de la Aplicación:** Vaya a **Configuración → Cuenta → Eliminar Cuenta**.
- **Mediante Solicitud por Correo Electrónico:** Envíe un correo electrónico desde su dirección registrada a [dev@dressapp.co](mailto:dev@dressapp.co) con el asunto "Delete My Account" ("Eliminar mi cuenta").

La eliminación de la cuenta ejecuta una eliminación en cascada inmediata e irreversible en todas las bases de datos, borrando de forma permanente:
- Su perfil de usuario, registros de identidad y credenciales de autenticación;
- Todos los artículos del armario, fotografías subidas e imágenes con fondo recortado;
- Todos los atuendos guardados, entradas del diario de looks y listas de equipaje;
- Todos los anuncios del mercado y referencias de transacciones;
- Todo el historial de conversaciones con el estilista de IA, vectores de incrustación (embeddings) y tokens de Google.

Todos los datos se destruyen por completo en un plazo de 30 días a partir de la solicitud de eliminación.

---

## 6. Compartición de Datos, Divulgaciones y Terceros

No vendemos, alquilamos ni comercializamos sus datos personales. El almacenamiento principal de la base de datos y la visión por computadora base ("The Eyes") son operados directamente por DressApp en nuestra infraestructura aislada y autogestionada de servidores propios (on-premises) sin intermediarios externos de bases de datos SaaS. Solo divulgamos información a proveedores verificados de infraestructura y servicios que nos asisten en la operación de nuestra plataforma, sujetos estrictamente a acuerdos de procesamiento de datos:

| Proveedor de Servicios | Datos Divulgados | Propósito |
|---|---|---|
| **Hetzner Online GmbH (Infraestructura en la UE)** | Volúmenes de servidor cifrados que alojan la base de datos MongoDB en servidores propios autogestionada de DressApp, archivos multimedia del armario e inferencia de IA en servidores propios | Servidor privado virtual (VPS) europeo dedicado e infraestructura de almacenamiento NVMe (centro de datos en la UE que cumple con el RGPD) |
| **Google Cloud Platform / API de Google** | Tokens de autenticación OAuth, prompts de consultas de estilismo | Autenticación de usuarios y análisis de estilismo con IA de Gemini |
| **Stripe / PayPal** | Tokens de transacciones de pago, metadatos de facturación | Procesamiento de pagos compatible con PCI (los números de tarjeta nunca pasan por nuestros servidores) |
| **Resend / Servicio de Correo Transaccional** | Dirección de correo electrónico, nombre para mostrar del usuario | Entrega de avisos críticos del sistema y restablecimiento de contraseñas |

---

## 7. Derechos Internacionales de Privacidad (RGPD, CCPA/CPRA, LGPD, PIPEDA)

Dependiendo de su ubicación geográfica, usted goza de derechos legales específicos en materia de privacidad:
- **Derecho de Acceso / Portabilidad:** Puede solicitar una copia completa en formato JSON legible por máquina de todos los datos personales que conservamos sobre usted.
- **Derecho de Rectificación:** Puede actualizar o corregir cualquier información personal inexacta en cualquier momento desde la configuración de la aplicación.
- **Derecho de Supresión:** Puede solicitar la eliminación permanente de sus datos personales tal como se indica en la Sección 5.
- **Derecho de Limitación u Oposición:** Puede oponerse a la elaboración automatizada de perfiles o retirar su consentimiento para el procesamiento de ubicación o cámara en cualquier momento.
- **No Discriminación:** Nunca lo discriminaremos, le negaremos servicios ni modificaremos precios por haber ejercido sus derechos de privacidad.

---

## 8. Privacidad de los Menores

DressApp está destinada estrictamente a personas que tengan al menos 16 años de edad (o la edad mínima legal de consentimiento digital en su jurisdicción). No solicitamos ni recopilamos intencionadamente información personal de menores de 16 años. Si descubrimos que un menor de 16 años nos ha proporcionado información personal, eliminaremos inmediatamente dichos datos de nuestros servidores.

---

## 9. Cambios en Esta Política de Privacidad

Podemos actualizar periódicamente esta Política de Privacidad para reflejar cambios en nuestros servicios, avances tecnológicos o requisitos legales. Cuando se produzcan actualizaciones, revisaremos la fecha de "Última Actualización" en la parte superior de esta política y notificaremos a los usuarios mediante un anuncio en la aplicación o una notificación por correo electrónico en caso de cambios sustanciales. Le recomendamos revisar esta página con regularidad.

---

## 10. Información de Contacto y Consultas sobre Protección de Datos

Si tiene preguntas, inquietudes, comentarios o solicitudes en relación con esta Política de Privacidad o sus datos personales, comuníquese con nuestro equipo de Protección de Datos:

- **Organización:** DressApp Ltd.
- **Contacto Principal de Privacidad:** [dev@dressapp.co](mailto:dev@dressapp.co)
- **Contacto de Soporte al Usuario:** [lokoprod@gmail.com](mailto:lokoprod@gmail.com)
- **Dirección Postal:** DressApp Ltd., 11 Hanoter St, 8442711 Be'er-Sheva, Israel
- **Sitio Web Oficial:** [https://dressapp.co](https://dressapp.co)
- **URL Dedicada a la Privacidad:** [https://dressapp.co/privacy](https://dressapp.co/privacy)

Nos comprometemos a atender y resolver todas las consultas de privacidad con prontitud y en un plazo máximo de treinta (30) días a partir de su recepción.