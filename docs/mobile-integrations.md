# Base de IA en nube y captura de Atajos

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
Las filas y enlaces de una respuesta salen únicamente de los `factIds` citados sobre la
evidencia local, nunca del texto. Grabación/transcripción, consentimiento, login móvil
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
| POST `/api/mobile/assistant` | AssistantRequest v1 | draft, answer o clarification; jamás escribe el libro |

Ambos requieren JSON y sesión verificada con Supabase, límite 24 KB y respuestas
sin caché. Sin configuración devuelven 503 sin contactar proveedores. Contratos
estrictos en `packages/integrations/contracts.js` y tipos públicos en `.d.ts`.
No se acepta un userId del cliente. El servidor obtiene el propietario de la sesión,
y PostgreSQL vuelve a derivarlo de `auth.uid()` al recibir la captura.

CaptureRequest: `version:1`, `requestId` estable (16–100 caracteres alfanuméricos,
guion o guion bajo), `source:shortcut|assistant`, `draft`. El borrador contiene
`kind`, `amountMinor`, `currency`, `merchant`, `category`, `dateISO`,
`paymentMethodRef`; todos admiten null para datos desconocidos. Importe positivo
en centavos enteros seguros; ARS/USD. `paymentMethodRef` no es un PAN ni autoriza
usar una cuenta: el consumidor futuro debe validar propiedad/tipo/moneda.
El Atajo debe conservar el ID en reintentos; generar uno nuevo cada vez evita
la deduplicación. La política de eventos sin ID y duplicados entre fuentes queda pendiente.

AssistantRequest: `version:1`, `action:parse|explain`, `text` (hasta 2.000 caracteres),
`todayISO` local, `currency` y `facts`. Parse no necesita historial. Explain recibe
hasta 60 hechos con id, etiqueta, centavos, cantidad y fechas. `monthlyEvidence`
calcula datos agregados localmente y compara la misma cantidad de días; no envía
nombres de cuentas ni movimientos completos. El usuario debe autorizar este envío.
La respuesta devuelve IDs de evidencia y los hechos originales. Esta validación
no prueba que cada frase del modelo sea correcta: la evaluación y la UI que permite
abrir esos hechos son requisitos antes de activar respuestas financieras.

## IA y control de costo

Adaptador inicial: OpenAI Responses, `gpt-5-mini`, salida JSON estricta,
`store:false`, salida máxima 1.800 tokens y timeout de 25 s, sin reintentos
automáticos. Clave solo del servidor; nunca EXPO_PUBLIC ni código cliente.
Se puede sustituir el adaptador sin cambiar el libro ni el contrato.
Audio requiere una etapa de transcripción con sus propios límites; este modelo
no recibe audio. No se incluye audio en esta entrega.

La ficha oficial consultada publica USD 0,25 / millón de tokens de entrada y
USD 2 / millón de salida. Como orden de magnitud, 1.000 tokens de entrada + 300
de salida cuestan USD 0,00085; 1.000 llamadas iguales, USD 0,85. **No es presupuesto
final**: razonamiento, contexto, transcripción, reintentos y otros servicios suman.
Medir `usage`, costo y calidad real antes de elegir planes/precios; no prometer
un costo fijo por usuario. `store:false` no equivale a retención cero del proveedor.

Reservas durables: 30 consultas IA por usuario/día y 300 para toda la app/día UTC;
120 capturas por usuario/día y 2.000 globales. Se consumen antes de la llamada;
un error de proveedor no devuelve cuota. No usar contadores en memoria en
funciones sin estado. Es un techo de solicitudes, no un límite monetario exacto.
Configurar también alertas/restricciones del proyecto proveedor. Fallos de cuota
bloquean la IA; nunca abren un camino de consumo ilimitado.

## Activación futura en staging

1. Elegir un proyecto de prueba Supabase separado. Ejecutar explícitamente
   `server/mobile/schema.sql` después de que CI pase las pruebas PostgreSQL.
   Es una migración inicial, no repetible; no ejecutarla sobre tablas existentes.
2. Configurar en el servidor: `MOBILE_SUPABASE_URL`,
   `MOBILE_SUPABASE_PUBLISHABLE_KEY`, `MOBILE_INTEGRATIONS_ENABLED=true`.
   Para IA: `MOBILE_OPENAI_API_KEY` y `MOBILE_AI_ENABLED=true` solamente después
   de habilitar presupuesto en la cuenta del propietario. No publicar secretos.
3. Implementar login móvil + consentimiento y emparejamiento del Atajo. El
   endpoint base usa un JWT de sesión: **no copiar un JWT temporal ni un refresh
   token a un Atajo permanente**. Antes de habilitar automatización sin intervención,
   emitir credenciales revocables, acotadas solo a captura, con expiración y revocación.
4. Incorporar bandeja local y UI de revisar/editar/deshacer. Solo activar auto-registro
   si el usuario lo elige, el tipo/moneda/cuenta están resueltos, hay recibo único y
   es una operación soportada. Préstamos/reintegros/cuotas incompletos piden aclaración.
5. Evaluar frases argentinas reales autorizadas, ambigüedades, negaciones, preguntas,
   múltiples gastos, cuentas equivocadas, devoluciones, offline, 401, 429 y duplicados.
6. Verificar RLS con dos usuarios en staging, TTL/retención/exportación/borrado,
   monitoreo sin prompts/saldos, secretos y consentimiento. Probar Atajos en el iPhone.

No se ejecutaron estos pasos remotos. El código no contiene un modelo local como
sustituto silencioso: sin red o permiso de nube se mantiene el registro manual.

## Verificación

`npm test`: contratos, método/auth, tamaño, propiedad de sesión, cuotas antes del
modelo, respuestas inválidas, rechazo/truncamiento y cero consumo sin configuración.
`npm run test:storage --prefix apps/mobile`: cliente/evidencia y almacenamiento.
El trabajo CI `mobile_api` aplica el esquema a PostgreSQL 17 desechable con un
adaptador mínimo de `auth.uid()/jwt()`, y prueba lectura por propietario, rechazo
anónimo, deduplicación/conflicto y límites por usuario/globales. No certifica la
configuración del proyecto Supabase del usuario ni la automatización de Apple.

Fuentes: [modelo](https://developers.openai.com/api/docs/models/gpt-5-mini),
[salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs),
[RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security),
[transacciones de Apple](https://support.apple.com/en-sg/guide/shortcuts/apd65c67538a/ios).
