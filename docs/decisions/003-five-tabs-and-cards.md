# Decisión 003: cinco secciones con un significado cada una, y tarjetas como cuentas internas

Fecha: 2026-09-20. Aceptada para la app nativa (Interfaz 10). Complementa las
decisiones 001 y 002; no cambia el producto "gastos primero" ni las garantías de
almacenamiento. **§Navegación y §Sistema visual están reemplazadas por la
[decisión 005](005-forest-four-tabs-and-capture.md) (2026-09-30);** la contabilidad de
tarjetas y deudas y las invariantes 1–8 siguen vigentes y vinculantes.

## Navegación

> **Reemplazado por la decisión 005 (2026-09-30).** Esta sección queda como registro
> histórico. La tabla de abajo ya no coincidía con el código desde Producto 22 (Tarjetas
> pasó a Más → Finanzas y el Asistente fue la pestaña central), y la frase «no hay pestaña
> central de "acción" ni de IA» tampoco rige. Ahora: **cuatro pestañas** (Inicio,
> Movimientos, Reportes, Más; Tarjetas sigue en Más); una **acción «+» aparte**, fuera de la
> lista de pestañas y solo de toque, que abre el hub Registrar (Asistente, Gasto, Ingreso,
> Transferencia); el **Asistente es una pantalla de la pila raíz** con la conversación en
> memoria durante la sesión; el dock muestra solo íconos y VoiceOver oye «n de 4»; queda en el
> layout. La mitigación de pestañas montadas sin fade/detach/freeze sigue igual para las
> cuatro raíces, sin fundido entre pestañas.

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
- Cierre y vencimiento se calculan con los días cargados por el usuario y, desde
  24T2, con las fechas exactas que la persona corrigió (regla 7, «Ciclo del
  resumen»). No hay resumen bancario, estado "pendiente", congelar tarjeta ni
  disputas: FinanzApp no opera la tarjeta.

Ventajas frente a un modelo separado: reutiliza saldos exactos en centavos,
auditoría de ediciones, deshacer/recuperar, copias v1–v6 y las mismas pruebas.
Límite conocido al decidirlo: las cuotas todavía no se modelaban; requerían semántica
de calendario y compromisos futuros, no gastos recurrentes duplicados. Superado por la
regla 7 (motor, esquema 12 y copia v12 de 24T1, PR #67, 2026-09-28).

## Invariantes contables de tarjetas (2026-09-28, cierre de Producto 25B2)

Auditadas contra el código al cerrar 25B2: la implementación las cumplía; se
fijaron en `packages/domain/card-invariants.test.ts` (una prueba por regla) y en
el copy. Un cambio que rompa una de ellas es una regresión, no un rediseño. El
2026-09-28 se corrigió la redacción de las reglas 2 y 7: «un único gasto» para una
compra en cuotas podía leerse como reconocer todo el principal el día de la compra,
y la decisión es la contraria (regla 7). 24T1 (PR #67) convirtió en pruebas 12 de los
13 `it.todo` de 24T; el que queda, el registro de un plan en moneda extranjera, es de
24C2.

1. **Una tarjeta de crédito no está vinculada contablemente a una cuenta bancaria
   por cada compra.** `CreditCardProfile` tiene un solo vínculo, `accountId`: su
   cuenta interna oculta. Cada pago nombra su origen al registrarse; dos compras
   de la misma tarjeta pueden pagarse desde dos cuentas distintas.
2. **Una compra con tarjeta sin cuotas** se registra exactamente una vez como gasto
   por su precio completo (cuenta una vez en Movimientos, Reportes, Presupuestos y
   el resumen del mes), aumenta el saldo pendiente de la tarjeta por ese mismo
   importe y **no reduce ninguna cuenta de efectivo o banco** (Disponible no
   cambia). Una compra en cuotas **no** sigue esta regla para el reconocimiento del
   gasto: sigue la regla 7.
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
7. **Compras en cuotas (Producto 24T; contrato decidido el 2026-09-28; el motor,
   el esquema y la copia implementados por 24T1 el 2026-09-28, la interfaz en 24T2,
   reintegros y cancelaciones en 24T3).** *(→ 2026-10-01, Producto 24T3: devoluciones, adelanto de
   cuotas y ciclo de vida del plan decididos por el dueño e implementados; ver «Devoluciones, adelanto de
   cuotas y ciclo de vida del plan» abajo. Las frases anteriores que dicen otra cosa quedan como registro
   y llevan una nota «→ 24T3».)* Una compra financiada es **una compra y un plan**
   (`InstallmentPlan`), nunca una `RecurringRule`. Si la persona eligió cuotas,
   FinanzApp **no** contabiliza además el precio completo como gasto inmediato.
   Ejemplo: USD 1.200 en 12 × USD 100.
   - **Al comprar:** ninguna cuenta bancaria pierde USD 1.200; se crea el plan por
     USD 1.200; la persona puede ver USD 1.200 como total comprometido; el saldo
     pendiente exigible de la tarjeta contiene solo las cuotas que ya corresponden
     a un resumen; las cuotas futuras aparecen aparte, como compromisos futuros.
   - **Reconocimiento (Reportes, Presupuestos, resumen del mes):** cada cuota de
     principal cuenta como gasto en el período al que corresponde; la compra madre
     **no** vuelve a sumar USD 1.200; la suma exacta del principal de las cuotas
     (enteros en unidades menores, el resto asignado a cuotas nombradas) es igual al
     principal total. Intereses, cargos e impuestos de financiación se registran por
     separado, con su propia categoría, y nunca se disfrazan de principal. Pagar el
     resumen sigue siendo una transferencia (regla 3), nunca un segundo gasto.
     *(→ 24T3: un adelanto de cuotas reconoce las cuotas que faltaban en la fecha del adelanto,
     una sola vez; una devolución resta en su propio mes. Ver abajo.)*
   - **Cifras distintas que el diseño de 24T muestra y nunca mezcla** (revisado en
     la revisión de 24T1): 1) precio / principal original de la compra; 2) saldo de
     la tarjeta facturado/exigible hoy; 3) principal futuro comprometido; 4)
     principal restante; 5) principal ya reconocido/facturado. La tarjeta puede
     mostrar aparte sus pagos generales (transferencias al resumen), pero **nunca
     deriva de ellos que una cuota o un plan estén pagados**: no existe «3/12
     pagadas» a partir de una transferencia a la tarjeta; sí «3/12 facturadas».
     programada ≠ reconocida/facturada ≠ pagada; «pagada» solo cuando FinanzApp
     tenga evidencia real de ese pago concreto. *(→ 24T2/24UX6D, alineado en 24T3: en el dominio
     «facturada» es sinónimo de «reconocida»; en pantalla se dice solo «registradas» («3 de 12
     registradas»), nunca «facturadas» ni «pagadas». Una cuota adelantada es «Adelantada», nunca
     «pagada».)*
   - **Crédito disponible: gate abierto.** Cómo afectan las cuotas futuras al límite
     disponible del emisor (muchos emisores reservan el total; otros no) no se
     asume: se decide y se registra aquí antes de implementar
     `cardAvailableLimitMinor` con planes. Hasta entonces el límite disponible no
     se calcula para una tarjeta con planes *(→ 24T3: «con un plan pendiente», como dicen el
     resto de esta regla y el código; un plan completo, sin seguimiento, devuelto o adelantado ya
     no está pendiente y deja de ocultar el disponible)*. **24T2 (2026-09-28) decide solo la
     presentación, no una fórmula:** sin límite cargado, «Sin límite cargado»; con
     límite y sin plan pendiente, la cifra; con límite y un plan pendiente, «No
     calculado con cuotas» con una ayuda que explica por qué. Nunca un cero ni una
     cifra inventada, y sin barra de uso mientras es desconocido.
   - **Ciclo de vida:** archivar una tarjeta conserva sus planes y permite seguir
     pagando todas las cuotas; eliminar una tarjeta queda bloqueado mientras tenga
     saldo pendiente **o** cualquier plan pendiente (`assertCardDeletable` es el
     único lugar de esa regla); una tarjeta eliminada conserva todo su historial y
     sus planes terminados. Pausar o eliminar un recurrente nunca afecta un plan.
     *(→ 24T3, B3: también con saldo a favor; ver abajo.)*
   - **Reintegros y cancelación anticipada:** nunca duplican un gasto; quedan
     vinculados a la compra/plan original; un reintegro parcial conserva el resto;
     un pago anticipado reduce la obligación y no crea un gasto nuevo. *(→ 24T3: el
     contrato exacto, abajo. «No crea un gasto nuevo» se cumple porque el adelanto reconoce, una sola
     vez y en su fecha, las cuotas que faltaban registrar; cada cuota cuenta una vez.)*
   - **Devoluciones, adelanto de cuotas y ciclo de vida del plan (decidido el 2026-10-01
     por el dueño, Producto 24T3; B1–B3).** Una devolución y un adelanto son **operaciones de
     la compra** (`packages/domain/operations.ts`): filas propias, solo agregadas, con id de
     formulario, revisión y «deshecha» (restaurable); nunca reescriben un movimiento, un plan, un
     calendario ni un pago guardados. Su efecto se **proyecta** al leer el libro como líneas
     derivadas que nunca se guardan como movimientos.
     - **Palabras.** «Devolución» (una compra devuelta, entera o en parte; nunca «Reembolso»,
       que es la categoría predefinida de ingreso), «Registrar devolución», «Registrar adelanto
       de cuotas», «Dejar de seguir el plan», «Reactivar plan». **Nota de redacción:** en el
       castellano de Argentina «cancelar» una deuda es pagarla; la «cancelación anticipada» de las
       frases anteriores de esta regla es el **adelanto de cuotas**, y el estado `cancelled` del
       dominio es **dejar de seguir** el plan (no es un pago, una devolución ni una condonación).
       Por eso la pantalla nunca dice «Cancelar plan» ni «Cancelado»: dice «Dejar de seguir el
       plan» y «Sin seguimiento».
     - **Devolución.** Nunca es un ingreso: es una línea de gasto con importe negativo
       (contra-gasto) en **su propia fecha y su propio mes**, en la **categoría de la compra
       leída al momento** (si se corrige la categoría de la compra, la devolución la sigue), y
       acreditada en **la cuenta de la compra** (una tarjeta archivada se acepta; una cuenta o
       tarjeta eliminada, no; elegir otra cuenta queda para después). Fecha entre la de la
       compra y hoy. Tope: la suma de devoluciones vivas nunca supera el precio. Mientras una
       compra tenga devoluciones vivas no se deshace, no baja de lo devuelto, no pasa a
       ingreso, no cambia de cuenta ni de moneda y no se fecha después de su primera
       devolución (el archivo lo verifica en cada lectura, edición e importación).
     - **Devolución de un plan (B2).** Devuelve solo principal. Primero revierte el principal ya
       reconocido (o adelantado) en esa fecha, como una línea de crédito en la tarjeta en la
       categoría de la última cuota de principal registrada (si no hay, la del plan); el resto
       baja el principal de las **últimas cuotas**, de la última hacia atrás, cada una hasta cero
       antes de tocar la anterior: esas cuotas se registran por lo que queda y una cuota en cero
       queda «Devuelta» sin movimiento (nunca fue gasto, así que no hay línea de gasto). La
       financiación no se toca. En un plan sin seguimiento solo se devuelve lo ya registrado.
       Invariantes: por componente, reconocido + adelantado + programado + reducciones +
       deshecho + sin seguimiento + no cobrado (solo financiación) = total del componente; Σ
       devoluciones = Σ créditos + Σ reducciones.
     - **Adelanto de cuotas (B1).** La persona registra que las cuotas que faltaban se
       adelantaron: cada cuota todavía no registrada se reconoce **una sola vez, en la fecha del
       adelanto**, en la categoría de su componente, en el saldo pendiente de la tarjeta; el pago
       a la tarjeta es la transferencia de siempre («Pagar tarjeta»), registrada aparte; nada se
       infiere ni se marca «pagada». La financiación futura la elige la persona, sin valor por
       defecto: «Los registro ahora» (se reconoce con el principal) o «El emisor no los cobró»
       (queda «No se cobró»: ni reconocida ni pendiente). Una cuota deshecha no se adelanta y
       sigue pendiente. La fecha va desde el piso del plan (la mayor entre la compra, el cierre de
       la última cuota registrada y un adelanto vivo) hasta hoy, y antes del cierre de cada cuota
       que cubre. Un adelanto sin principal se rechaza. Un adelanto parcial (N cuotas) queda para
       después.
     - **Dejar de seguir y reactivar.** Dejar de seguir (estado `cancelled`) conserva las cuotas
       registradas y deja de registrar las que faltan («No se registra»): no crea un gasto, una
       devolución ni un pago. Antes de dejar de seguir se registran, en la misma transacción, las
       cuotas cuyo resumen ya cerró. Se rechaza si no queda nada por registrar. «Reactivar plan»
       es la única vuelta atrás permitida (`cancelledAt` a nulo, una revisión más, plan no
       eliminado): registra en sus propias fechas de cierre las cuotas que cerraron mientras no se
       seguía; se permite en una tarjeta archivada y no en una eliminada.
     - **Estados y cifras efectivas.** Cada parte, por cuota y por componente, está en uno de:
       *recognised* (su movimiento), *undone*, *settled* («Adelantada», cuenta como reconocida),
       *waived* («No se cobró»), *refunded* («Devuelta»: reducida a cero sin movimiento),
       *cancelled* («No se registra») o *scheduled*. El importe efectivo de una parte es su
       calendario menos sus reducciones vivas, y es el que debe tener su movimiento (*→ reemplaza
       «un movimiento de cuota conserva importe»*: conserva el importe efectivo). Un plan vivo
       está **pendiente** mientras tiene una parte programada o deshecha, y **completo** cuando no
       tiene ninguna. Cifras por componente: total, reconocido (con lo adelantado), adelantado,
       deshecho, programado, sin seguimiento, no cobrado, devuelto como crédito, devuelto en
       cuotas futuras y restante; ninguna «pagado».
     - **Pendiente y eliminación.** Un plan completo, sin seguimiento, devuelto entero o
       adelantado no está pendiente y no bloquea eliminar su tarjeta; uno cuyo principal se
       devolvió entero pero conserva financiación programada sigue pendiente. **B3 enmienda la
       regla única de eliminación:** `assertCardDeletable` rechaza una tarjeta eliminada, con saldo
       pendiente, **con saldo a favor** («Tiene saldo a favor; archivala.») o con un plan pendiente;
       sigue siendo el único lugar de la regla. Un plan se elimina solo sin cuotas registradas
       **y sin ninguna operación**, aunque esté deshecha; dejar de seguir y eliminar nunca se
       ofrecen juntos.
     - **Deshacer y restaurar** una operación son cambios normales (una revisión más, un
       recibo idempotente); deshacer un adelanto devuelve sus cuotas a pendientes y registra en
       sus cierres las que ya cerraron. Restaurar vuelve a verificar todo salvo la fecha y el
       reparto, y se rechaza si duplicaría una cuota, superaría un tope o contradice una cuota
       registrada después. En una tarjeta o cuenta eliminada no se registra, deshace ni restaura
       nada.
     - **Lo que queda abierto o para después:** la regla de crédito disponible del emisor (gate
       de arriba); devolver o condonar financiación fuera de un adelanto; otra cuenta de
       crédito; devoluciones sobre cuentas o tarjetas eliminadas; migrar los ingresos históricos
       en tarjetas (siguen contando como «devoluciones» del ciclo); el adelanto parcial; los
       borradores de devolución del Asistente (25A).
   - **Moneda extranjera (24T + 24C2):** el modelo distingue moneda original de la
     compra, moneda en que la tarjeta factura, moneda de la cuenta que paga, importe
     exacto debitado y exacto acreditado, y tasa/cargos con su procedencia. Una
     transferencia entre monedas nunca se modela como una transferencia de la misma
     moneda.
   - **Una compra sin cuotas** conserva el comportamiento actual (regla 2): gasto
     completo una vez y saldo pendiente completo.
   - **Modelo de 24T1 (`packages/domain/installments.ts`, esquema SQLite 12, copia
     v12).** `InstallmentPlan`: identidad propia (dos compras idénticas son dos
     planes), la tarjeta (`cardId`; su cuenta interna recibe cada cuota), comercio,
     categoría del principal, moneda (la de la tarjeta), fecha de compra, principal
     total, cantidad de cuotas (1 a 120), y **cuatro componentes independientes**:
     principal, intereses (`interestMinor` + `interestCategory`), comisiones
     (`feeMinor` + `feeCategory`) e impuestos de financiación (`taxMinor` +
     `taxCategory`); cada componente de financiación es cero o positivo y tiene su
     propia categoría exactamente cuando es mayor que cero; ninguno se mezcla con
     otro ni con el principal. El **calendario exacto** se escribe una sola vez (una
     fila por cuota: cierre de resumen al que pertenece, vencimiento y la parte de
     cada componente), más `cancelledAt`, `deleted`, revisión y fechas.
     Vocabulario: *compra* (la operación), *plan* (la fila), *cuota futura* (sin
     movimiento en el libro: compromiso, no gasto), *cuota reconocida/facturada* (su
     movimiento está en el libro y cuenta una vez, en el mes de su cierre, en la
     categoría original, y sube el saldo pendiente), *saldo pendiente actual* (saldo
     negativo de la cuenta de la tarjeta), *pago* (transferencia a la tarjeta, nunca
     asignada a un plan), *principal restante* (lo no reconocido). «Pagada» no se
     deriva nunca: un pago general no marca ninguna cuota.
   - **Reparto exacto:** `distributeMinor`: partes iguales en unidades menores y el
     resto, de a una unidad, a las **primeras** cuotas (100/3 = 34, 33, 33 en
     exponente 0; 3334, 3333, 3333 en exponente 2; 33334, 33333, 33333 en 3); la suma
     es siempre el principal; se rechazan principal cero, negativo, no entero, fuera
     del rango seguro, más de 120 cuotas y cuotas que quedarían en cero. Cada
     componente de financiación se reparte por su cuenta con la misma regla (su resto
     también va a las primeras cuotas); una parte de cero no genera movimiento.
   - **Calendario:** la cuota 1 va al resumen actual (primer cierre en o después de
     la compra; una compra el día de cierre entra en ese resumen) o al siguiente, a
     elección; cada cuota siguiente al cierre del mes siguiente en el día de cierre
     configurado (31 → 28/29 de febrero y vuelve al 31; años bisiestos y cambios de
     año incluidos); el vencimiento es el día de vencimiento posterior al cierre. Solo
     fechas, sin hora ni zona. El calendario es contractual: cambiar los días de la
     tarjeta después no reescribe ninguna cuota (ni pasada ni futura); un realineo
     será una operación explícita si 24T2 la necesita. Corrimientos por fin de semana
     o feriado no se conocen y no se simulan (gate: solo con regla del emisor).
   - **Reconocimiento y materialización:** cada cuota se reconoce cuando cierra su
     resumen (`catchUpInstallments`, al abrir la app y al volver al frente, en su
     propio paso, nunca dentro de `processRecurring`): un gasto normal en la cuenta
     de la tarjeta por cada parte mayor que cero, con id determinista por componente
     (`inst_` principal, `insti_` intereses, `instf_` comisiones, `instt_` impuestos,
     más `<plan>_<nnn>`), en la categoría de su componente, fechado en el cierre.
     Así Reportes y Presupuestos agrupan Compra, Intereses, Comisiones e Impuestos
     por separado sin inferirlos de un total. Idempotente: un id ya presente en
     el libro (registrado, editado o deshecho) no se vuelve a generar, así que una
     invocación duplicada, un cierre de la app durante varios períodos, un reintento,
     una caída o una restauración nunca registran una cuota dos veces. Un plan
     cancelado o eliminado, o una tarjeta eliminada, no registra nada.
   - **Estados, derivados del libro y nunca guardados dos veces**, por cuota **y por
     componente** (cada parte es su propio movimiento): *scheduled* (sin movimiento),
     *recognised* (movimiento presente), *undone* (la persona lo deshizo: no cuenta,
     la obligación sigue abierta, la puesta al día no lo recrea; restaurarlo lo
     devuelve). Deshacer el principal no toca sus intereses, comisiones ni impuestos,
     y al revés: las cifras del plan cuentan cada parte por su propio movimiento, así
     que siempre coinciden con el libro, el saldo de la tarjeta y Reportes. Plan:
     *active*, *completed* (todas las partes reconocidas), *cancelled*, *deleted*.
     Cifras por componente: total, reconocido, deshecho, futuro comprometido,
     cancelado, restante; ninguna «pagado». *(→ 24T3: los estados y cifras efectivos de arriba;
     `completed` = ninguna parte programada ni deshecha; `cancelled` se muestra «Sin seguimiento».)*
   - **Guardas libro↔plan:** un movimiento de cuota conserva importe, fecha, cuenta y
     tipo (comercio y categoría se corrigen; deshacer y restaurar son cambios
     normales); un movimiento nuevo no puede usar un id de cuota; cada lectura del
     archivo verifica que todo movimiento con id de cuota pertenezca a un plan y
     coincida con su calendario (un desvío rechaza la escritura, nunca se muestra).
     *(→ 24T3: «coincida con su calendario» es con su importe efectivo, el calendario menos las
     reducciones vivas de una devolución, también para un movimiento deshecho.)*
   - **Ciclo de vida de la tarjeta (revisión de 24T1):** *activa*: acepta compras
     nuevas, planes nuevos, recurrentes nuevos y pagos. *Archivada*: conserva todo su
     historial y sus planes; los planes pendientes siguen reconociéndose; acepta
     pagos; se puede reactivar; **no acepta** una compra nueva, un plan nuevo, un
     recurrente nuevo ni un movimiento o recurrente movido hacia ella
     (`assertAcceptsNewObligation`, en el almacenamiento; los formularios ya no la
     ofrecen para algo nuevo y siguen mostrando la fila propia de un movimiento o
     recurrente guardado allí, que se corrige en el lugar). Un recurrente que ya
     estaba en la tarjeta es una obligación existente: sigue con su semántica actual
     hasta que la persona lo pause, lo mueva o lo elimine. *Eliminada*: no acepta nada
     nuevo; solo historial. Además: **eliminar la tarjeta se rechaza con saldo pendiente o
     con cualquier plan pendiente** (`assertCardDeletable`, la única regla: el
     almacenamiento y el diálogo la leen); una tarjeta eliminada no recibe cuotas ni
     pagos y conserva sus planes terminados. Un plan recién creado sin cuotas
     registradas se elimina (tombstone); con historia se cancela (las cuotas
     reconocidas quedan). Ningún guardado cambia precio, cuotas ni fechas: un
     reintegro, un pago anticipado o un ajuste será una operación del plan con su
     propio registro (24T3); hasta entonces el validador rechaza ese estado.
     *(→ 24T3: eliminar también se rechaza con saldo a favor (B3); un plan con historia **deja de
     seguirse** («Sin seguimiento») y uno con cualquier operación nunca se elimina; la devolución y el
     adelanto son esas operaciones, cada una con su registro; no hizo falta una operación de «ajuste»
     y ningún guardado sigue cambiando precio, cuotas ni fechas.)*
   - **Crédito disponible:** con un plan pendiente `cardAvailableLimitMinor` responde
     null (desconocido) hasta que este documento registre la regla del emisor.
   - **Falla de la puesta al día:** si el paso de cuotas no puede escribir (base llena,
     bloqueada, error de E/S), los datos abren igual, nada se inventa, lo ya durable
     queda, y la falla se informa en el aviso con «Verificar de nuevo»
     (`installmentError`, independiente del de recurrentes): el saldo de tarjetas,
     Reportes y Presupuestos pueden estar incompletos y la app lo dice. El siguiente
     paso al frente o el reintento lo repite; un éxito limpia el aviso; los ids
     deterministas impiden duplicar.
   - **Moneda:** en 24T1 un plan es de la moneda de su tarjeta (`PLAN_CURRENCY_MESSAGE`).
     24C2 agregará al lado el registro de la compra en moneda original (importe,
     tasa, cargos y procedencia); no se agregan columnas vacías hoy.
   - **Financiación en la interfaz (decidido el 2026-09-28, Producto 24T1C, para
     24T2; implementado en 24T2 con la categoría predefinida «Intereses», cuya etiqueta
     guardada es la de su identidad, nunca una traducción; es **latente**: se resuelve
     siempre con su nombre, ícono y color, pero el catálogo y los selectores la muestran
     solo cuando algo la usa —un movimiento de interés, un plan con interés guardado o una
     definición suya—, nunca en una instalación nueva):** el motor no cambia (principal, intereses, comisiones e impuestos siguen
     siendo cuatro componentes separados). La interfaz es simple: por defecto «Sin
     interés», sin ningún campo de financiación; un único interruptor secundario «Con
     interés» muestra un solo campo, «Total financiado», y FinanzApp deriva
     `interestMinor = totalFinancedMinor − principalMinor` en unidades menores (puede
     mostrarlo solo lectura, «Interés total», y el valor aproximado por cuota). Un total
     menor que el precio no se guarda. No se agregan porcentaje editable, tasa mensual,
     TNA, TEA, CFT ni campos visibles de comisión o impuesto; comisiones e impuestos
     quedan en cero desde este flujo y el dominio los conserva. Una financiación
     avanzada sería una entrega propia. **Presentación (24T2):** las cifras de un plan
     son de principal; en un plan con interés se nombran así («Principal registrado»,
     «Principal futuro», «Principal restante») y el interés que falta registrar tiene su
     propia fila («Interés futuro»). En Tarjetas, «Cuotas futuras» suma solo principal y
     nombra el interés al lado («+ interés $ …»), nunca sumado; en el ciclo abierto, la
     parte de interés de una cuota no cuenta como otra compra.
   - **Fechas exactas del ciclo (decidido para 24T2):** la tarjeta conserva los días
     habituales de cierre y vencimiento como valor por defecto y puede tener, para el
     próximo ciclo, una **fecha exacta de cierre** y una **fecha exacta de vencimiento**
     elegidas con un calendario completo (día, mes y año). No tienen que caer en el
     mismo mes (cierre 2026-10-28 y vencimiento 2026-11-05 es válido). La única regla
     entre las dos es **vencimiento > cierre**; sin límites artificiales de días. Una
     fecha inválida o un vencimiento igual o anterior al cierre no se guarda. Cambiarlas
     no reescribe movimientos, resúmenes ni calendarios de planes ya creados; puede
     cambiar cómo se presenta o programa el próximo ciclo aún no materializado. Sin
     feriados ni corrimientos a días hábiles simulados. **Qué días siguen lo decide la
     persona (decisión del dueño, 2026-09-29):** en una tarjeta existente, cualquier
     corrección de cierre o vencimiento puede ser puntual, se haya movido 1, 15 o 20
     días o más: con «Usar estos días todos los meses» apagado corrige solo ese resumen;
     encendido, sus días pasan a ser los habituales desde ese resumen. Ninguna distancia
     lo activa sola: no hay evidencia del emisor para suponer que un cierre movido cambió
     el calendario. En una tarjeta nueva, las fechas de su primer resumen dan sus días
     habituales.
   - **Ciclo del resumen (implementado en 24T2, vinculante).** Un **resumen** es un
     cierre y el vencimiento **de ese cierre**, siempre juntos: `vencimiento > cierre`
     vale dentro de un resumen y nunca entre dos. El **próximo vencimiento** es el
     primer vencimiento de hoy en adelante y puede ser el del resumen que ya cerró
     (cierre 28, vencimiento 5, el 2026-10-01: vence 5 oct —resumen del 28 sep— y
     cierra 28 oct —que vence 5 nov—); el **próximo cierre** es el primer cierre de hoy
     en adelante (el día del cierre el resumen sigue abierto). La interfaz los muestra
     como dos datos («Vence 5 oct · Cierra 28 oct»), nunca como un par ambiguo. Modelo
     (`packages/domain/card-cycles.ts`, esquema 13, copia v13): los días habituales son
     la grilla (las fórmulas de 24T1, sin cambios); las fechas exactas son resúmenes
     guardados (`card_cycle_dates`: cierre y su vencimiento), una **cadena de resúmenes
     consecutivos** por tarjeta. Cada fila guarda también los días habituales del
     calendario al que pertenece y el resumen habitual que representa (su mes,
     `monthISO`: el propio cuando cierra justo en la grilla de sus días; el del resumen
     que reemplaza cuando es un corrimiento puntual fuera de la grilla). Después de la
     cadena, los resúmenes se generan con los días habituales de la tarjeta desde el mes
     siguiente al de la última fila (si los días cambiaron después de ella, desde el
     cierre de la grilla nueva más cercano a un mes después); antes de la cadena, con los
     días de la primera fila (los vigentes cuando empezó la cadena), desde el mes anterior
     al suyo. Así una fecha movida, por pocos días o por meses, nunca duplica ni saltea un
     resumen, aunque cruce de mes. **Todo cambio congela primero lo que ya cerró:**
     corregir el próximo cierre o vencimiento, corregir el vencimiento del resumen cerrado
     que falta pagar o cambiar los días habituales guarda antes, a sus fechas vigentes,
     cada resumen desde el final de la cadena hasta el último cerrado (cuando solo cambian
     los días habituales, también el abierto: los días nuevos rigen desde el siguiente);
     nunca se borra ni se renumera una fila y el cierre de un resumen cerrado no cambia.
     Un formulario abierto sobre un resumen que ya cerró se rechaza («Las fechas del ciclo
     cambiaron…»), también cuando solo cambia los días. Los resúmenes anteriores a la
     primera fila guardada siguen siendo una estimación, con los días de esa fila: un
     cambio de días nunca reescribe la historia. Un plan nuevo usa el calendario vigente
     al crearse (fechas exactas incluidas); su calendario queda contractual.
   - **Antes de 24T1:** archivar conservaba el saldo pendiente y seguía aceptando el
     pago; eliminar se rechazaba con saldo pendiente y se permitía en cero; una
     tarjeta eliminada no aceptaba pagos. Todo eso sigue igual.
8. **Copy visible:** el saldo de una tarjeta es «Saldo pendiente» / «Saldo de
   tarjeta» (en inglés «Outstanding balance»), nunca «Deuda», que nombra la
   sección Deudas y cobros. Los nombres internos (`cardDebtMinor`, `CARD_DEBT_MESSAGE`,
   `cards.panel.recordedDebt`, `transferForm.balanceDebt`…) no cambian por copy.
   El glosario (`apps/mobile/i18n/glossary.json`) distingue «deuda» de «saldo
   pendiente».

## Sistema visual

> **Reemplazado por la decisión 005 (2026-09-30).** Esta sección y la identidad cobalto que
> la siguió (`docs/mobile-design.md`) quedan como registro histórico. Ahora rige **Forest**:
> pino en la ventana de tono 158–168° (nunca turquesa, cian, esmeralda ni azul). Un gasto
> común es tinta con signo menos, no coral; el ingreso es positivo en verde; la transferencia
> es neutra, en tinta secundaria, ya no azul; el tono negativo queda solo para lo destructivo,
> lo vencido y lo pasado de límite; la alerta sigue ámbar. Vidrio solo en el dock, el «+», el
> hub, los controles circulares compactos, los menús y el compositor. Los colores de categoría
> no cambian.

Se retira el violeta como acento dominante. Base neutra (tinta sobre fondo
gris/negro, superficies elevadas) y cuatro colores con significado: gasto coral,
ingreso verde, transferencia azul, alerta ámbar. Los importes de gasto quedan en
tinta con signo; solo ingresos van en verde. Glifos monocromos en lugar de emoji.
Ver [dirección visual](../mobile-design.md).
