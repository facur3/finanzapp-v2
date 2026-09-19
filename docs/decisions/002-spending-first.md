# Decisión 002: gastos y compromisos, con cuentas opcionales

Fecha: 2026-09-19. Aceptada para la app nativa. Reemplaza el objetivo de migrar
cada sección de la web y la preferencia anterior por IA exclusivamente local.
Mantiene Expo/React Native y las garantías de almacenamiento de la decisión 001.

## Elección y alternativas

Construir un **Smart Expense Tracker**: entender lo gastado y lo pendiente,
registrando con poco esfuerzo. El número principal de Inicio es gasto registrado,
con semana/mes y moneda explícitos. Cuentas es una herramienta secundaria de
saldo manual; nunca se llama patrimonio ni incluye una cartera de inversiones.

| Opción | Aporte real | Coste/riesgo | Decisión |
| --- | --- | --- | --- |
| Gastos y compromisos | Responde qué gasté, en qué y qué vence; útil aunque el banco ya muestre el saldo | Mercado competido, requiere crear hábito; la IA y Apple Pay también existen en competidores | Elegida, con cuentas opcionales |
| Hub patrimonial | Reúne bancos/brokers y obligaciones; un banco aislado no da esa visión | Sin conexiones confiables exige conciliación, precios, tipos de cambio, costos, operaciones corporativas y soporte constante | Fuera del alcance nativo |
| Solo gastos sin contexto | Menos mantenimiento | Pierde ingresos, deudas, pagos futuros y utilidad de cuotas | Demasiado limitado para este producto |

El hub no es una mala idea por ser difícil: sirve a usuarios con patrimonio
fragmentado. No es la mejor inversión ahora para un equipo pequeño sin
integraciones estables. Más funciones no demuestran más disposición a pagar.
MonAi es un competidor relevante; no tenemos evidencia independiente de que
"domine" el mercado. Monarch ya cubre la categoría completa. La competencia
existe en ambos caminos. Español argentino, cuotas claras, captura rápida,
privacidad y calidad iOS son hipótesis de diferenciación, no una ventaja validada.
Antes de cobrar: medir uso repetido, tiempo de registro, correcciones de IA y
voluntad de pago con usuarios reales. No agregar telemetría silenciosa.

## Producto objetivo

- Inicio: gasto del período, evolución verificable, categorías y movimientos.
- Registro manual de gastos/ingresos; edición, deshacer y recuperación.
- Recurrentes/suscripciones, presupuestos y próximos vencimientos.
- Deudas personales: debo/me deben, pagos parciales y estado pendiente.
- Tarjetas: medio de pago, compras, cuotas, cierre/vencimiento y liquidación.
- Cuentas simples opcionales: saldo manual, moneda y movimientos. Sin conexión
  bancaria implícita. Se puede registrar desde una base cero sin informar al banco.
- IA en nube: texto/transcripción a borrador; preguntas sobre datos agregados
  calculados por el código. Captura automática futura con consentimiento explícito,
  datos completos y una identidad de evento persistente; ante ambigüedad, revisión.
- Atajos/Apple Pay, recordatorios, Face ID y sincronización opcional por etapas.

Quedan fuera: precios de acciones/CEDEARs/bonos/cripto, FCI y rendimientos,
conciliación de cartera, trading y rescates de FCI para pagar tarjetas. Tampoco
se promete ejecutar transferencias o pagos bancarios. Estas funciones usadas
por la web anterior se conservan allí hasta decidir su retiro y proteger los datos.
No se integrará la rama experimental de contabilidad de tarjetas sin revisión:
no fue publicada y su esquema no forma parte de esta entrega.

## Números y fronteras contables

- Gasto registrado, ingreso, saldo manual, presupuesto restante y deuda son
  conceptos distintos. No llamar "disponible para gastar" a ingresos menos gastos.
- Transferencias internas y correcciones de saldo no son gastos ni ingresos.
- Para tarjetas, registrar la compra una vez; las cuotas representan compromisos
  de pago y la liquidación del resumen no vuelve a sumar la compra como gasto.
  El reporte de gasto y las próximas salidas de caja deben etiquetarse por separado.
- Prestar/recibir un préstamo modifica una deuda, no salario ni consumo. Separar
  principal de intereses/comisiones; los reintegros deben enlazar su operación.
- ARS/USD separados; cero registrado no acredita que el gasto real haya sido cero.
- Próximos pagos aún no pagados no entran en el total de movimientos realizados.
- El asistente no tiene autoridad sobre saldos. Sus propuestas pasan validadores;
  sus explicaciones incluyen rangos y hechos comprobables, no causas inventadas.

## Qué se implementó en Interfaz 07

Inicio semana/mes, barras con detalle, categorías sin duplicar importes, cuentas
accesibles desde el encabezado/Ajustes, saldo inicial opcional, nueva paleta y
retiro de MonthCard y los colores de la antigua tarjeta de saldo. Conserva SQLite
esquema 3, los registros y la recuperación; todavía exige nombrar una cuenta de
registro inicial. Un onboarding sin ese paso es trabajo futuro, no una promesa actual.

Base de nube en `server/mobile`, contratos compartidos y cliente móvil sin claves.
Endpoints apagados hasta configurar servidor y staging. Aún no hay chat/audio en
la interfaz, emparejamiento de Atajos, incorporación de la bandeja a SQLite ni
publicación automática. Ver [contratos y activación](../mobile-integrations.md).

## Fuentes consultadas

- [MonAi](https://get-monai.app/): captura, presupuestos y Atajos.
- [Monarch](https://www.monarch.com/): agregación financiera y patrimonio.
- [Apple: disparador de transacciones](https://support.apple.com/en-sg/guide/shortcuts/apd65c67538a/ios): automatización al usar una tarjeta; no acceso general al historial.
- [OpenAI: salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs): formato controlado; sigue necesitando validación semántica.
