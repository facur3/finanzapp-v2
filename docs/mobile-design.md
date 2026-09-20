# FinanzApp: dirección visual móvil

Interfaz 10 · 20 de septiembre de 2026. Implementado en código; revisión visual y
gestual en iPhone pendiente. [Alcance del producto](decisions/002-spending-first.md) ·
[Navegación y tarjetas](decisions/003-five-tabs-and-cards.md).

## Referencias y criterio propio

Apple Wallet aporta la jerarquía de una tarjeta y de una fila de transacción:
comercio, contexto en una línea, importe alineado a la derecha, tarjetas apiladas
con nombre, emisor y últimos dígitos. Las referencias tipo MonAI, Cocos y las
láminas "FinanzApp — visual direction" aportan base neutra, un número principal
grande, controles compactos y color solo con significado. No copiamos marcas,
mapas de comercios, estados bancarios ni acciones que la app no ejecuta.

## Sistema

**Color.** Tinta sobre fondo. Claro: fondo #F2F2F6, superficie #FFFFFF, tinta
#0A0A0C, secundario #6E7078, relleno #EEEEF3. Oscuro: fondo #000000, superficie
#1C1C1E, elevado #242426, tinta #F5F5F7, secundario #A0A0A8. Cuatro colores
semánticos: gasto coral (#C42F39 / #F0555C), ingreso verde (#15804F / #3DBE86),
transferencia e interacción azul (#2563EB / #5B9BFF), alerta ámbar (#B45309 /
#E8A030), cada uno con un tinte suave para tiles y chips. Todos los textos
semánticos superan 4,5:1 sobre su fondo. Los botones principales son tinta; los
enlaces, azul. Los importes de gasto van en tinta con signo menos; solo el ingreso
se pinta de verde. Nunca color sin signo o etiqueta.

**Tipografía.** Fuente del sistema. Héroe 44/700 tabular con tracking negativo,
título grande 34, título 22, encabezado 17/600, cuerpo 17, subtítulo 15, nota 13,
etiqueta 12. Números siempre tabulares.

**Espacio y forma.** Margen de pantalla 20, tarjeta 16, escala 4–32. Radios: chip
14, tile 12, grupo 16, tarjeta 20, hoja 24, tarjeta de crédito 18. Elevación clara
con sombra suave; en oscuro, escalones de superficie sin sombra.

**Componentes.** Fila de movimiento (tile de glifo · comercio · categoría · cuenta ·
fecha · importe), control segmentado nativo, botones de 52 pt, tiles de glifo
monocromo (los emoji se retiran), estadísticas compactas, tarjeta de crédito con
nombre, emisor, moneda, últimos cuatro dígitos y un tono estable por tarjeta.

## Pantallas de esta entrega

- **Tarjetas.** Carrusel horizontal con ajuste al soltar, deuda registrada como
  número principal, disponible del límite, cierre y vencimiento, barra de uso
  (ámbar desde 85 %, coral sobre el límite), acciones Registrar compra / Pagar
  tarjeta, compras y pagos del resumen abierto, recientes y deudas.
- **Detalle de tarjeta.** Tarjeta grande, deuda, límite, disponible, cierre,
  vencimiento, resumen abierto y todos sus movimientos. Pagos se leen como
  "Pago de tarjeta · desde Cuenta", sin signo ambiguo.
- **Deudas y cobros.** Totales por moneda, Debo / Me deben, detalle con estado,
  vencimiento y registro de pagos o cobros limitados al saldo pendiente.
- **Formularios.** Pagar tarjeta y saldar deudas fijan la obligación y solo eligen
  la cuenta de dinero en la misma moneda. El selector de cuenta nombra el tipo
  (Cuenta, Tarjeta de crédito) y nunca ofrece una deuda para un gasto.

## Motion y accesibilidad

Presión breve, selección y cambios de datos animados en 160–360 ms; Reduce Motion
aplica los valores sin transición. La pila y las hojas nativas siguen siendo la
única transición de pantalla; las cinco pestañas permanecen montadas sin
fade/detach/freeze. Objetivos de 44 pt, texto escalable con filas apiladas en
tamaños grandes, etiquetas de VoiceOver con importe, moneda y estado.

## Pendiente de revisión en iPhone

- Carrusel: ajuste, indicador de página y cambio de panel al soltar.
- Contraste de tarjetas de crédito y del tinte azul en claro/oscuro.
- Filas con nombres largos, texto grande y VoiceOver en Tarjetas y Deudas.
- Inicio y Reportes con la nueva paleta antes de su rediseño (fases siguientes).
