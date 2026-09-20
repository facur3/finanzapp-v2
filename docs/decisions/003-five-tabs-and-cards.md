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

## Sistema visual

Se retira el violeta como acento dominante. Base neutra (tinta sobre fondo
gris/negro, superficies elevadas) y cuatro colores con significado: gasto coral,
ingreso verde, transferencia azul, alerta ámbar. Los importes de gasto quedan en
tinta con signo; solo ingresos van en verde. Glifos monocromos en lugar de emoji.
Ver [dirección visual](../mobile-design.md).
