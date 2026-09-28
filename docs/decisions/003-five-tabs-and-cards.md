# Decisión 003: cinco secciones con un significado cada una, y tarjetas como cuentas internas

Fecha: 2026-09-20. Aceptada para la app nativa (Interfaz 10). Complementa las
decisiones 001 y 002; no cambia el producto "gastos primero" ni las garantías de
almacenamiento.

## Navegación

Hasta Interfaz 09 la app tenía tres pestañas (Inicio, Movimientos, Ajustes) y
escondía Reportes detrás de un enlace de Inicio, y Presupuestos, Recurrentes y
Cuentas dentro de Ajustes. El dueño reportó que no encontraba Recurrentes y pidió
que "cada sección tenga un significado": lo importante en Inicio, los reportes en
Reportes, las tarjetas en Tarjetas.

Interfaz 10 usa cinco pestañas nativas, el máximo razonable en iOS:

| Pestaña | Responde |
| --- | --- |
| Inicio | ¿Cómo voy este período? Un número principal, presupuesto, próximos compromisos, categorías top y últimos movimientos. |
| Movimientos | ¿Qué registré? Toda la actividad, búsqueda y filtros. |
| Reportes | ¿A dónde fue mi plata? Análisis completo por categoría, día y comparación. |
| Tarjetas | ¿Cuánto debo y cuándo vence? Tarjetas de crédito, deudas y cobros. |
| Ajustes | Cuentas, presupuestos, recurrentes, copias y preferencias. |

La mitigación de pestañas montadas sin fade/detach/freeze (Interfaz 02) se
conserva para las cinco raíces. No hay pestaña central de "acción" ni de IA; el
asistente sigue siendo un acceso del encabezado hasta que exista de verdad.

## Contabilidad de tarjetas y deudas

Una tarjeta de crédito es una **cuenta interna oculta** con perfil (emisor,
últimos cuatro dígitos, límite, día de cierre, día de vencimiento). Una deuda
personal o un cobro pendiente también es una cuenta interna con perfil
(contraparte, dirección, vencimiento).

- **Compra con tarjeta** = un gasto registrado una sola vez en la cuenta de la
  tarjeta. Cuenta en reportes y presupuestos y aumenta la deuda de la tarjeta.
- **Pago de tarjeta** = transferencia interna de una cuenta de dinero hacia la
  tarjeta. Baja el disponible y baja la deuda. **No es otro gasto.**
- **Debo** = cuenta interna con saldo negativo igual al capital; **me deben** =
  saldo positivo. Pagos y cobros parciales son transferencias hacia/desde esa
  cuenta; nunca gastos ni ingresos. Un gasto o ingreso directo sobre una deuda se
  rechaza en el almacenamiento, no solo en la interfaz.
- **Disponible** en Inicio excluye tarjetas, deudas y cobros: es dinero
  registrado en cuentas normales, no patrimonio ni saldo bancario.
- Cierre y vencimiento se calculan con los días cargados por el usuario. No hay
  resumen bancario, estado "pendiente", congelar tarjeta ni disputas: FinanzApp no
  opera la tarjeta.

Ventajas frente a un modelo separado: reutiliza saldos exactos en centavos,
auditoría de ediciones, deshacer/recuperar, copias v1–v6 y las mismas pruebas.
Límite conocido: las cuotas todavía no se modelan; requieren semántica de
calendario y compromisos futuros, no gastos recurrentes duplicados.

## Invariantes contables de tarjetas (2026-09-28, cierre de Producto 25B2)

Auditadas contra el código al cerrar 25B2: la implementación las cumplía; se
fijaron en `packages/domain/card-invariants.test.ts` (una prueba por regla) y en
el copy. Un cambio que rompa una de ellas es una regresión, no un rediseño.

1. **Una tarjeta de crédito no está vinculada contablemente a una cuenta bancaria
   por cada compra.** `CreditCardProfile` tiene un solo vínculo, `accountId`: su
   cuenta interna oculta. Cada pago nombra su origen al registrarse; dos compras
   de la misma tarjeta pueden pagarse desde dos cuentas distintas.
2. **Una compra con tarjeta** se registra exactamente una vez como gasto (cuenta
   una vez en Movimientos, Reportes, Presupuestos y el resumen del mes), aumenta
   el saldo pendiente de la tarjeta y **no reduce ninguna cuenta de efectivo o
   banco** (Disponible no cambia).
3. **Pagar una tarjeta** es una transferencia desde una cuenta normal hacia la
   cuenta interna de la tarjeta: reduce el dinero disponible de esa cuenta, reduce
   el saldo pendiente y **no genera un segundo gasto** (los totales de gasto del
   mes son los mismos antes y después del pago). Nunca es un ingreso en la tarjeta
   ni un gasto en la cuenta; una tarjeta nunca es origen de una transferencia.
4. **Una cuenta de pago preferida**, si algún día existe, será solo una
   preselección del formulario y nunca una imputación automática: hoy el perfil
   no la tiene y el libro no deriva nada de una tarjeta hacia una cuenta.
5. **Deudas y cobros son obligaciones personales independientes de las tarjetas.**
   `PersonalDebtProfile` y el saldo pendiente de una tarjeta no comparten cuenta
   (una cuenta interna representa una sola obligación) ni total (`debtTotalsByCurrency`
   nunca incluye tarjetas; `cardDebtMinor` nunca incluye deudas).
6. **No hay tarjetas de débito como libro aparte.** Los tipos de cuenta son
   exactamente `cash`, `card` y `debt`. Una tarjeta de débito representa dinero
   que ya vive en una cuenta normal; si algún día existe `DebitCardProfile` será
   metadata vinculada a una cuenta, sin saldo, deuda, cuotas, cierre ni pagos
   propios.
7. **Producto 24T (cuando exista):** una compra en cuotas sigue siendo un único
   gasto; las cuotas son el plan de obligación/pago y nunca vuelven a contabilizar
   el gasto; archivar una tarjeta conserva las cuotas pendientes; eliminar una
   tarjeta queda bloqueado mientras tenga saldo pendiente **o** planes de cuotas
   pendientes (`assertCardDeletable` es el único lugar de esa regla). Hoy: archivar
   conserva el saldo pendiente y sigue aceptando el pago; eliminar se rechaza con
   saldo pendiente y se permite en cero; una tarjeta eliminada no acepta pagos.
8. **Copy visible:** el saldo de una tarjeta es «Saldo pendiente» / «Saldo de
   tarjeta» (en inglés «Outstanding balance»), nunca «Deuda», que nombra la
   sección Deudas y cobros. Los nombres internos (`cardDebtMinor`, `CARD_DEBT_MESSAGE`,
   `cards.panel.recordedDebt`, `transferForm.balanceDebt`…) no cambian por copy.
   El glosario (`apps/mobile/i18n/glossary.json`) distingue «deuda» de «saldo
   pendiente».

## Sistema visual

Se retira el violeta como acento dominante. Base neutra (tinta sobre fondo
gris/negro, superficies elevadas) y cuatro colores con significado: gasto coral,
ingreso verde, transferencia azul, alerta ámbar. Los importes de gasto quedan en
tinta con signo; solo ingresos van en verde. Glifos monocromos en lugar de emoji.
Ver [dirección visual](../mobile-design.md).
