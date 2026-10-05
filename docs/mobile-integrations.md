# Base de IA en nube y captura de Atajos

> **Nota 2026-10-02 (Producto 25OPS1).** Este documento describe el código base de la Interfaz 07 y sigue vigente como
> contrato de los dos endpoints. El plan de producción (entornos, Vercel y Supabase, la frontera de capacidades del
> Asistente, la evaluación de modelos, los límites monetarios, la captura de Wallet) está en
> [production-plan.md](production-plan.md). La captura de Wallet de 25A2 es **local** (Atajo → App Intent → borrador en
> el teléfono), sin pasar por `/api/mobile/captures`, que queda como base de una captura remota futura.
>
> **Nota 2026-10-05 (Producto 25A-05).** El contrato v1 del Asistente quedó **retirado** (nunca se desplegó): el Asistente
> habla el **protocolo v2** (`packages/integrations/assistant-protocol.js`), validado en el servidor y otra vez en el
> teléfono; las capturas siguen con el contrato v1. No hay modelo en el código (`gpt-5-mini` se quitó): el proveedor y el
> modelo son configuración del servidor, y el modelo se elige con la evaluación de `server/mobile/evals/`. Las funciones
> privilegiadas de Supabase solo las ejecuta `service_role`, con una clave secreta del servidor. Nada de esto está
> desplegado ni aplicado en un proyecto. Las secciones de abajo están actualizadas a ese estado.
>
> **Nota 2026-10-05 (Producto 25A-06, fase A).** El servidor corre solo como **staging** (`MOBILE_ENVIRONMENT=staging`
> y, en una ruta, el `VERCEL_ENV=production` de Vercel), acepta solo claves `sb_publishable_…` / `sb_secret_…` y una
> clave de proyecto del proveedor con su id de proyecto, y la base rechaza un despliegue de otro entorno. La puesta en
> marcha de staging, paso a paso y con quién actúa, está en [ai-staging-runbook.md](ai-staging-runbook.md). Ningún
> servicio se creó, configuró ni aplicó.

Interfaz 07, 2026-09-19. Código base implementado, **integraciones no activadas**.
No se hicieron llamadas pagas ni se modificó una base de datos remota.

## Flujo y estado real

Manual → validadores → SQLite → confirmación sigue funcionando sin conexión.
Texto/transcripción → servidor autenticado → IA → resultado estructurado →
validadores → borrador revisable. **Producto 21 (2026-09-21)** entrega la UI de chat
con esa frontera: `apps/mobile/src/assistant/client.ts` envuelve `integrationClient`
(mismo origen HTTPS, misma sesión bearer, mismos contratos) en un cliente por eventos
(`delta`, `result`, `error`) listo para streaming; `runtime.ts` elige el cliente de cada
build y hoy devuelve **desconectado** porque no existe proveedor de sesión: ninguna
solicitud sale del dispositivo. La respuesta `draft` se resuelve en el teléfono
(`resolveDraft`: cuenta por nombre o única elegible, si no pregunta; tipo, importe y
categoría faltantes también preguntan) y solo Confirmar escribe, validado por el dominio.
Las filas y enlaces de una respuesta salen únicamente de los `evidenceIds` citados sobre la
evidencia local, nunca del texto (desde 25A-05; la intención de navegación del modelo solo
reordena esos enlaces). Desde 25A-04 Confirmar ocurre en la hoja de revisión, sobre un ítem
de revisión guardado; el Asistente no escribe el libro. Grabación/transcripción, consentimiento, login móvil
y guardado automático siguen pendientes.

Atajo → POST autenticado → bandeja durable `needs_review`. Esta entrega **no**
incorpora esa bandeja al libro local. No mostrar "gasto guardado" por recibir un
202. El futuro consumidor deberá usar el mismo ID estable y un recibo SQLite
atómico para evitar repetir efectos al reconectar/editar/deshacer. Un conflicto
mismo ID/distinto contenido se rechaza, nunca se sobrescribe.

Apple permite activar una automatización al usar la tarjeta elegida. La cantidad
y calidad de los datos disponibles se comprobarán en el iPhone. No presupone
acceso a todo Wallet, pagos en efectivo ni todos los bancos. Sin importe/moneda/
fecha/medio identificado, conservar borrador. No enviar número completo de tarjeta,
credenciales bancarias, backups o información financiera en una URL.

## Endpoints preparados

| Método/ruta | Entrada | Resultado |
| --- | --- | --- |
| POST `/api/mobile/captures` | CaptureRequest v1 | 202 recibido pendiente; 200 repetido; 409 mismo ID con otros datos |
| POST `/api/mobile/assistant` | Protocolo v2 (`version:2`) | answer, proposal, clarification u out_of_scope; jamás escribe el libro |

Ambos requieren JSON y sesión verificada con Supabase, límite 24 KB y respuestas
sin caché. Sin configuración, fuera de un entorno habilitado (hoy solo `staging`) o con una clave de otro tipo
devuelven 503 sin contactar proveedores. Contratos
estrictos en `packages/integrations/contracts.js` (capturas) y
`packages/integrations/assistant-protocol.js` (Asistente), con tipos públicos en `.d.ts`.
No se acepta un userId del cliente. El servidor verifica la sesión con la clave
publicable y el token de la persona, y recién entonces llama a las funciones
privilegiadas con la clave secreta (solo en el encabezado `apikey`, nunca junto al token
de la persona) pasando el id verificado; PostgreSQL rechaza un dueño nulo, inexistente o
anónimo, y ningún rol de cliente puede ejecutar esas funciones. Antes de la red, un bearer
que no puede ser un token de acceso vigente de este proyecto (forma, emisor, audiencia y rol
`authenticated`, no anónimo, no vencido) se rechaza con 401; `/auth/v1/user` sigue siendo la
única autoridad. Cada llamada privilegiada nombra además el entorno del despliegue
(`mobile_receive_capture(…, p_environment)`, `mobile_ai_reserve(…, p_environment)`), y la base
responde `environment` (503) si no es el de `mobile_ai_control.environment`, antes que cualquier
otra verificación.

CaptureRequest: `version:1`, `requestId` estable (16–100 caracteres alfanuméricos,
guion o guion bajo), `source:shortcut|assistant`, `draft`. El borrador contiene
`kind`, `amountMinor`, `currency`, `merchant`, `category`, `dateISO`,
`paymentMethodRef`; todos admiten null para datos desconocidos. Importe positivo
en centavos enteros seguros; ARS/USD. `paymentMethodRef` no es un PAN ni autoriza
usar una cuenta: el consumidor futuro debe validar propiedad/tipo/moneda.
El Atajo debe conservar el ID en reintentos; generar uno nuevo cada vez evita
la deduplicación. La política de eventos sin ID y duplicados entre fuentes queda pendiente.

Protocolo v2 del Asistente: `version:2`, `requestId` nuevo en cada consulta (16–100 caracteres
alfanuméricos, guion o guion bajo; es la clave de idempotencia de la reserva), `action:parse|explain`,
`text` (hasta 2.000 caracteres, sin controles ni marcas bidireccionales), `todayISO` local,
`currency` (ARS/USD), `region` (dos letras, la región configurada al enviar) y `facts`. Parse
no lleva hechos. Explain recibe hasta 60 hechos con id, etiqueta, centavos, cantidad y fechas.
`monthlyEvidence` calcula datos agregados localmente y compara la misma cantidad de días; no
envía nombres de cuentas ni movimientos completos, y deja afuera un nombre de categoría que el
protocolo rechazaría. El usuario debe autorizar este envío. La respuesta es un único objeto con
todas las claves: `type` (answer, proposal, clarification, out_of_scope), `message`,
`evidenceIds` (solo ids del pedido), `navigation`, `proposals` (cero o una propuesta con
`kind`, `amountMinor`, `currency`, `merchant`, `category`, `dateISO`, `paymentMethodRef`, lo
desconocido en null) y `clarification`. Se rechaza cualquier clave extra, URL, código, enlace
o carácter oculto. El teléfono vuelve a validar la respuesta y toma la evidencia de sus propios
hechos. Esta validación no prueba que cada frase del modelo sea correcta: la evaluación y la UI
que permite abrir esos hechos son requisitos antes de activar respuestas financieras.
La v2 no lleva idioma (el validador rechaza claves desconocidas); sus instrucciones piden
responder en español rioplatense, como v1, para que la voz de VoiceOver siga siendo la correcta. El diseño con idioma y región de la
interfaz como dos códigos, hechos neutros al idioma y servidor antes que app pasa a ser la
**v3** ([docs/i18n.md §11](i18n.md)). No se activó ningún proveedor.

## IA y control de costo

Puerto neutral de proveedor (`server/mobile/provider.js`) y un adaptador de OpenAI Responses
(`openai.js`) **implementado y deshabilitado**: solo claves permitidas, `store:false`,
`background:false`, esquema JSON estricto, nivel de servicio fijo `default`, sin herramientas,
sin estado de conversación, una llamada sin reintentos y timeout de 20 s; una respuesta con una
llamada a herramienta se rechaza. Proveedor, modelo, esfuerzo y topes de tokens son
configuración del servidor con listas permitidas (`MOBILE_AI_PROVIDER`, `MOBILE_AI_MODEL`,
`MOBILE_AI_REASONING_EFFORT`, `MOBILE_AI_MAX_INPUT_TOKENS`, `MOBILE_AI_MAX_OUTPUT_TOKENS`);
no hay modelo en el código. Clave solo del servidor (`MOBILE_AI_API_KEY`), de proyecto
(`sk-proj-…` o `sk-svcacct-…`), junto con el id de su proyecto (`MOBILE_AI_PROVIDER_PROJECT`,
`proj_…`) enviado como encabezado `OpenAI-Project`; una clave de usuario, heredada o de
administración se rechaza. Nunca EXPO_PUBLIC ni código cliente. Se puede sustituir el adaptador sin cambiar el libro ni el contrato.
Audio requiere una etapa de transcripción con sus propios límites; no se incluye audio.

Costo en micro-USD enteros (`cost.js`, `pricing.js`, precios leídos el 2026-10-05): antes de
llamar se acota la entrada y se **reserva el peor caso** en la base, de forma atómica; después se
liquida con el uso informado si es confiable, y si no queda reservado al máximo. El candidato de
staging, `gpt-6-luna`, no es una elección: lo decide la evaluación de 25A-06. **No es presupuesto
final**: medir `usage`, costo y calidad real antes de elegir planes/precios; no prometer un costo
fijo por usuario. `store:false` no equivale a retención cero del proveedor.

Límites durables en `server/mobile/schema.sql` (nunca aplicado a un proyecto): 120 capturas
por usuario/día y 2.000 globales (`mobile_reserve_usage`, interno). Para la IA,
`mobile_ai_control` (una fila que solo edita el dueño de la base, **deshabilitada** por defecto:
interruptor sin redeploy, y ligada a su entorno, `staging`) con valores **provisorios de staging**, no de producción: ventanas
por minuto, hora, día y mes, concurrencia, tope por consulta y techos en dinero por usuario/mes y
globales por día y mes. Cada consulta reserva su máximo antes de la llamada; un error no
devuelve lo reservado. No usar contadores en memoria en funciones sin estado. Configurar
también el tope del proyecto del proveedor, por encima de los techos del servidor. Fallos de
reserva bloquean la IA; nunca abren un camino de consumo ilimitado.

## Activación futura en staging

El orden, los puntos de control y quién actúa en cada paso están en
[ai-staging-runbook.md](ai-staging-runbook.md) (§0.2); este resumen no lo reemplaza.

1. Crear un proyecto Supabase de staging nuevo y vacío (nunca el heredado). Ejecutar explícitamente
   `server/mobile/schema.sql` después de que CI pase las pruebas PostgreSQL, y después
   `server/mobile/staging/verify.sql`, que debe imprimir `STAGING_VERIFY_OK` (runbook §6).
   Es una migración inicial, no repetible; no ejecutarla sobre tablas existentes.
2. Configurar en el servidor, solo en el ámbito Production del proyecto de Vercel de staging
   (runbook §4.4): `MOBILE_ENVIRONMENT=staging`, `MOBILE_SUPABASE_URL`,
   `MOBILE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`), `MOBILE_SUPABASE_SECRET_KEY` (`sb_secret_…`),
   `MOBILE_INTEGRATIONS_ENABLED=true`. Para IA: `MOBILE_AI_PROVIDER`, `MOBILE_AI_MODEL`,
   `MOBILE_AI_API_KEY`, `MOBILE_AI_PROVIDER_PROJECT` y `MOBILE_AI_ENABLED=true` (y habilitar `mobile_ai_control`)
   solamente después de crear un proyecto de proveedor dedicado con su tope de gasto. No
   publicar secretos. Es la porción 25A-06 del roadmap, fase B, a cargo del dueño.
3. Implementar login móvil (Sign in with Apple, [decisión 006](decisions/006-cloud-identity.md); la entrega de la
   sesión, después de 25A-06) + consentimiento y emparejamiento del Atajo. El
   endpoint base usa un JWT de sesión: **no copiar un JWT temporal ni un refresh
   token a un Atajo permanente**. Antes de habilitar automatización sin intervención,
   emitir credenciales revocables, acotadas solo a captura, con expiración y revocación.
4. Incorporar bandeja local y UI de revisar/editar/deshacer. Todo lo que llega por
   captura, Atajo, audio o bandeja es un **borrador**: solo Confirmar escribe en SQLite,
   también cuando tipo, moneda y cuenta están resueltos y el recibo es único (el
   "auto-registro" opcional que se mencionaba acá quedó reemplazado el 2026-09-22; ver
   el roadmap). Préstamos/reintegros/cuotas incompletos piden aclaración.
5. Evaluar con `node server/mobile/evals/run.js --live --approve-micro-usd <n>` (`MOBILE_AI_EVAL_LIVE=1`,
   `MOBILE_ENVIRONMENT=staging` fuera de Vercel, una clave de proyecto con su id, la tabla de precios leída
   hace 30 días o menos y un monto aprobado por el dueño no menor al peor caso; runbook §11): el corpus
   sintético de 103 casos más frases argentinas reales autorizadas, contra los umbrales ya
   escritos; además offline, 401, 429 y duplicados.
6. Verificar RLS con dos usuarios en staging (`server/mobile/staging/probe.js`, runbook §6.5), TTL/retención/exportación/borrado,
   monitoreo sin prompts/saldos, secretos y consentimiento. Probar Atajos en el iPhone.

No se ejecutaron estos pasos remotos. El código no contiene un modelo local como
sustituto silencioso: sin red o permiso de nube se mantiene el registro manual.

## Verificación

`npm test`: contratos y protocolo v2, método/auth, tamaño, propiedad de sesión, reserva
antes del modelo, respuestas inválidas, rechazo/truncamiento/herramientas, costo, el arnés
de evaluación y cero consumo sin configuración.
`npm run test:storage --prefix apps/mobile`: cliente/evidencia y almacenamiento.
El trabajo CI `mobile_api` aplica el esquema a PostgreSQL 17 desechable con un
adaptador mínimo de `auth.uid()/jwt()` y los permisos por defecto de Supabase simulados, y
prueba lectura por propietario, rechazo de todo rol cliente, deduplicación/conflicto,
límites de capturas, interruptor, idempotencia, ventanas, concurrencia, techos y
liquidación, con dos pruebas reales de concurrencia entre conexiones (`dblink`); desde 25A-06 corre
también `server/mobile/staging/verify.sql` y `usage-report.sql` sobre el mismo esquema. No certifica la
configuración del proyecto Supabase del usuario ni la automatización de Apple.

Fuentes: [precios](https://developers.openai.com/api/docs/pricing),
[salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs),
[RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security),
[transacciones de Apple](https://support.apple.com/en-sg/guide/shortcuts/apd65c67538a/ios).
