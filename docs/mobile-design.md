# FinanzApp: dirección visual móvil

Interfaz 17 · 21 de septiembre de 2026; estado al 5 de octubre de 2026: el carril Forest (24UX6A–24UX6E) y 24T3
mergeados, 25A-01 y 25A-02 mergeadas (PR #77, #78, #79) sin cambios visuales, 25UX1 mergeada (PR #80: dock, Tarjetas y
Reportes: interacción), 25OPS1 mergeada (PR #81; la última fila sobre el dock, confirmada por el dueño en el iPhone el
2026-10-03), 25DISC1 mergeada (PR #82, solo documentación), **25VIS1 mergeada (PR #83): Electric Lime, la paleta
actual del producto**, aceptada por el dueño en el iPhone el 2026-10-03 («Producto 25VIS1»), 25A-03 mergeada (PR #84:
«Para revisar» y el símbolo y los centavos del monto de Inicio en grafito sólido), 25A-04 mergeada (PR #85: la hoja de
revisión sobre el Asistente), 25A-05 mergeada (PR #86) y 25A-06 fase A en su rama, ambas sin cambios visuales
(«Producto 25A-06», «Producto 25A-05»). El resto de la revisión
visual y gestual en iPhone sigue pendiente. [Alcance del producto](decisions/002-spending-first.md) ·
[Navegación y tarjetas](decisions/003-five-tabs-and-cards.md).

> **Desde 24UX6A (decisión 005, 2026-09-30).** La paleta es **Forest** (pino, no cobalto), la app tiene **cuatro
> pestañas** (Inicio, Movimientos, Reportes, Más) con un **«+» de registro** al lado, y el Asistente es una pantalla de
> la pila, no una pestaña. Lo vigente está en «Producto 24UX6A». Las reglas de abajo que dicen otra cosa (cinco
> pestañas, el Asistente en la pestaña central, ningún «+» flotante, el cobalto como primario, la transferencia azul,
> el coral como color del gasto común, las etiquetas visibles de la barra) quedan como registro y llevan la marca
> «Reemplazado por la decisión 005». La parte de navegación de la decisión 003 (cinco pestañas) también queda
> reemplazada por la 005; sus reglas de tarjetas siguen.
>
> **Desde 25VIS1 (2026-10-03, aceptada por el dueño en el iPhone).** Los colores de Forest se reemplazan por **Electric Lime** con los mismos
> nombres de tokens (`src/ui/palette.ts`); la estructura de la decisión 005 no cambia. Lo vigente de color está en
> «Producto 25VIS1»; donde abajo se lee «pino», «salvia» o un hex de Forest, vale como registro.

## Referencias y criterio propio

Apple Wallet aporta la jerarquía de una tarjeta y de una fila de transacción:
comercio, contexto en una línea, importe alineado a la derecha, tarjetas apiladas
con nombre, emisor y últimos dígitos. Las referencias tipo MonAI, Cocos y las
láminas "FinanzApp — visual direction" aportan base neutra, un número principal
grande, controles compactos y color solo con significado. No copiamos marcas,
mapas de comercios, estados bancarios ni acciones que la app no ejecuta.

## Sistema

> **Reemplazado por la decisión 005 (2026-09-30):** los valores de color, el primario cobalto y la semántica de los
> tres párrafos siguientes dejaron de regir; los tokens vigentes fueron los de Forest («Producto 24UX6A → Forest: la
> paleta») y, desde 25VIS1, son los de Electric Lime («Producto 25VIS1»). Se conservan como registro de Interfaz 17 a 24UX5.

**Color.** Tinta sobre fondo. Claro: fondo #F2F2F6, superficie #FFFFFF, tinta
#0A0A0C, secundario #66686F, terciario #84868D, relleno #EEEEF3 (24UX1: secundario y
terciario un paso más oscuros; antes #6E7078 y #8E9098). Oscuro: fondo #000000, superficie
#1C1C1E, elevado #242426, tinta #F5F5F7, secundario #A0A0A8, terciario #7C7C84. Los tokens viven en
`src/ui/palette.ts`, sin React Native, para poder medir su contraste en Node.

**Primario FinanzApp.** Un azul cobalto para la interacción y la selección, y para
nada más: claro #2557D6 (6,2:1 sobre blanco); oscuro #5B87FF para texto, íconos y
selección (4,7:1 sobre el pulgar del segmentado, 6,4:1 sobre negro) y #3565EA como
relleno del botón principal bajo texto blanco (5:1). Tinte suave #E5ECFB / #122048.
Lo usan la pestaña activa, la etiqueta elegida de cada control segmentado (Gastos /
Disponible, Todos / Gastos / Ingresos / Transf., Categorías / Día a día, ARS / USD),
los enlaces y acciones de sección, el único botón relleno de cada pantalla, el
selector de cuenta y las marcas de elección en las hojas, la barra del mes elegido y
"Este mes". El texto normal nunca es azul; los botones secundarios siguen en tinta
sobre relleno. No es violeta ni verde neón: es un azul financiero, sobrio.
*(Reemplazado por la decisión 005: el primario es el pino de Forest, #1D5647 / #94D2BB como texto y #1D4F42 /
#86C9B0 como relleno; ya no hay ninguna regla «cobalto».)*

**Semántica aparte.** Cuatro colores con significado, intactos: gasto coral (#C42F39 /
#F0555C), ingreso verde (#15804F / #3DBE86), transferencia azul celeste (#0B6BB3 /
#4DB0FF, distinto del cobalto para que el significado y la interacción no compartan
muestra), alerta ámbar (#B45309 / #E8A030), cada uno con un tinte suave para tiles y
chips. Todos los textos semánticos superan 4,5:1 sobre la superficie. Los importes de
gasto van en tinta con signo menos; solo el ingreso se pinta de verde. Nunca color sin
signo o etiqueta. `tests/theme.node.ts` verifica estos contrastes en ambos temas.
*(Reemplazado por la decisión 005: la transferencia ya no es azul celeste sino la tinta secundaria neutra, y el tono
`expense` es el negativo —destructivo, vencido, sobre el límite—, nunca el color del gasto común. Sigue vigente que el
gasto va en tinta con signo menos y que nada depende solo del color.)* *(→ reemplazado en 24UX6C: en una fila con tipo
conocido el gasto va en tinta sin signo, el ingreso con «+» y la transferencia en su azul verdoso sin signo; ver
«Producto 24UX6C». Los signos calculados —saldos negativos, netos, variaciones— no cambian.)*

**Color de categoría.** Ocho tonos apagados de una misma familia (terracota, azul
acero, oliva, rosa, verde azulado, ocre, índigo, pizarra), con variante clara y
oscura. Cada categoría recibe un tono estable por hash de su clave, resolviendo
colisiones en orden de primer uso, así una categoría nueva nunca cambia el color
de una existente. La categoría es un solo objeto: su glifo en el tono y el tile en
un tinte suave del mismo tono (alfa 14 % en claro, 20 % en oscuro), en filas,
leyenda, presupuestos y detalle; no hay puntos de color sueltos. Ingreso y alerta
siguen mandando sobre el tono cuando ese significado importa. "Otras" en la dona
queda en gris neutro.

**Importe héroe en tres niveles.** Un importe grande es un solo texto con tres
niveles del mismo color: el símbolo ("$ ", "US$ ", con su signo) en secundario, las
unidades en primer plano y los centavos (",00") en terciario; mismo tamaño, misma
línea base, una sola etiqueta de VoiceOver. Un héroe coloreado (ingreso, saldo
negativo) conserva su tono y solo baja el alfa. Las filas siguen siendo una cadena
plana. Se aplica en Inicio, Reportes, detalle de movimiento, tarjeta, deuda,
presupuestos y cuenta.

**Campo de importe.** Agrupa los dígitos mientras se escribe: 2 · 20 · 200 · 2.000 ·
20.000 · 200.000 · 2.000.000; la coma inicia hasta dos decimales (2.000,5 · 2.000,50);
un punto tecleado en un teclado en-US es separador decimal; "2,000.50" o
"2.000.000,50" pegados se normalizan; borrar sobre un punto de agrupación borra el
dígito anterior; una selección se reemplaza; como máximo trece cifras enteras (el
rango seguro); al salir del campo "2.000,5" se completa a "2.000,50". Es solo
presentación: la cadena mostrada sigue pasando por `parseMinorUnits` y el módulo
no crea ningún número flotante.

El modelo (`src/ui/money-input.ts`) es un estado canónico, nunca la cadena mostrada:
signo · cifras enteras · coma decimal opcional · decimales · cursor lógico (un
índice dentro de "-1234,5", que la agrupación no puede mover). De ese estado se
derivan el texto y el índice del cursor en pantalla. Cada evento nativo trae el
texto nuevo y el cursor nativo; se leen al estado a partir de las cifras y la coma
(un punto es agrupación salvo que sea entrada explícita: un punto más de los que
había en pantalla, o un pegado cuyos separadores lo indiquen), y el texto y la
selección se devuelven al campo en una sola actualización controlada. Por eso una
tecla que llega cuando el campo nativo todavía muestra el texto sin formatear lee
las mismas cifras, y un punto que FinanzApp insertó nunca se convierte en decimal.
No se confía en que iOS conserve el cursor: la selección se sigue con
`onSelectionChange` (ignorando los eventos que describen un texto distinto del
mostrado) y se controla con `selection`.

La caja del campo es estable: el campo ocupa toda la fila con márgenes fijos
(`amountFieldLayout` en `src/ui/geometry.ts`: a la izquierda el símbolo y su
separación, a la derecha el cursor), centra el texto de forma nativa y el símbolo
se coloca junto al borde izquierdo del texto por aritmética (se desliza medio
avance por cifra, como ese borde). Al escribir no cambia el tamaño de la caja ni
se recentra nada; solo baja el tamaño de letra (desde 46 pt) cuando el importe no
cabe entre los márgenes, nunca por cantidad de caracteres. El campo no lleva
tracking negativo: en iOS dibuja el último glifo más allá del ancho medido y el
cursor lo pisa (el "3.000" recortado del iPhone).

**Títulos de pantalla.** Los encabezados grandes usan las variantes con nombre
(título 1 28/34, título 2 22/28), nunca un `fontSize` suelto sobre la caja de
línea del cuerpo: en iOS un glifo más alto que su línea se recorta por arriba
(el "Comida" cortado en el detalle de categoría). `AppText` además ajusta la
caja de línea cuando un estilo cambia solo el tamaño.

**Tipografía.** Fuente del sistema. Héroe 44/700 tabular con tracking negativo,
título grande 34, título 22, encabezado 17/600, cuerpo 17, subtítulo 15, nota 13,
etiqueta 12. Números siempre tabulares. **Importes responsivos:** un importe es
siempre una sola línea; uno corto queda grande y uno largo se reduce hasta la
mitad (héroe) o tres cuartos (fila) para caber, nunca se corta ni se parte. Dynamic
Type aplica con un tope de 1,4× en héroes. El campo de importe baja de 46 a 32 y 24 pt
según la cantidad de cifras.

**Espacio y forma.** Margen de pantalla 20, tarjeta 16, escala 4–32. Radios: chip
14, tile 12, grupo 16, tarjeta 20, hoja 24, tarjeta de crédito 18. Elevación clara
con sombra suave; en oscuro, escalones de superficie sin sombra.

**Componentes.** Fila de movimiento (tile de categoría · comercio · categoría ·
cuenta · fecha · importe), control segmentado nativo, botones de 52 pt, acciones
rápidas redondas (tile suave semántico de 56 pt con glifo y leyenda: Gasto coral,
Ingreso verde, Transferir azul), estadísticas compactas, tarjeta de crédito con
nombre, emisor, moneda, últimos cuatro dígitos y un tono estable por tarjeta.
*(Los tonos coral y azul de las acciones rápidas: reemplazados por la decisión 005; los tokens `expense` y `transfer`
que leen son ahora los de Forest. Su restyle por pantalla queda para 24UX6B–6D.)*

## Pantallas de esta entrega

- **Presupuestos.** Un número principal (lo que queda o cuánto se excedió), barra
  total, gastado y límite, una línea de estado y filas densas con porcentaje, estado
  y una barra fina por categoría. Nada de barras enormes repetidas. *(→ 24UX6E: el general plano sobre el lienzo, en el
  orden héroe → barra → estado → Gastado / Límite, el héroe en tinta salvo excedido; el tile de un sublímite solo
  identidad, sin chevron; ver «Producto 24UX6E — Más destinos financieros en Forest».)*
- **Recurrentes.** Tres estadísticas compactas para los próximos 30 días por moneda,
  filas con frecuencia, próxima fecha, cuenta, importe con signo y "Hoy / Mañana /
  En N días", y el switch nativo para pausar. *(→ 24UX6C: el gasto sin signo, «+» solo en un ingreso; 24UX4: sin
  interruptor, pausar es una acción del deslizamiento y del detalle; 24UX6E: el pronóstico plano con «Gastos» en su
  propia línea, ámbar solo en un gasto de hoy o mañana, «Cuenta eliminada» / «Tarjeta eliminada» en una regla cerrada.)*
- **Cuentas.** Solo cuentas de dinero, agrupadas por moneda con el total de cada una;
  el detalle muestra saldo, gastos e ingresos del mes, Gasto / Ingreso / Transferir y
  sus movimientos. Tarjetas y deudas viven en su pestaña. *(→ 24UX6E: la cabecera de cada moneda en tinta, un solo
  encabezado para VoiceOver; la fila sin «Cuenta · ARS»; el saldo y los datos del mes en un bloque plano, el saldo en
  40 pt y «Gastos este mes» sin signo.)*
- **Reportes (desde 24UX6B; ver «Producto 24UX6B — jerarquía de Reportes»).** Alcance y mes; el total con su línea
  de promedio y variación; Categorías | Día a día con la dona y «Por categoría» o «Por día»; debajo, «Evolución» con
  los seis meses (o una nota con un solo mes); después presupuestos, comercios, hechos, ingresos y flujo neto, y la
  comparación. Las barras inactivas en la tinta terciaria al 70 % / 60 % (≥ 3:1), ya no en el gris `inset`.
- **Reportes (hasta 24UX6A; el orden y el grafito de las barras quedaron reemplazados por 24UX6B).** Título del mes
  con flechas, total registrado, promedio por día y variación contra los mismos días del mes anterior; barras de seis
  meses en una sola escala (el mes en curso, delineado); dona por categoría en tonos de categoría
  (cinco con nombre, el resto como Otras en gris) y leyenda con importe y participación; Día a
  día; presupuestos con porcentaje; comercios principales; hechos (no consejos);
  ingresos, flujo neto y comparación. Sin "ahorro": no tenemos su definición.
  Interfaz 17: la barra y la etiqueta del mes elegido van en el primario, las demás
  en grafito; "Dónde más gastaste" conserva el número de puesto y muestra el tile de
  la categoría de cada comercio (sin colores de podio); "Para tener en cuenta" tiñe
  cada tarjeta al 8 % con el tono de su categoría o su color semántico y un hecho de
  categoría lleva su tile.
- **Formularios.** Un solo modal de movimiento con el selector Gasto / Ingreso /
  Transferencia arriba (cambiar de modo es estado, no navegación), importe grande (verde
  para ingresos, azul para transferencias) y dos tarjetas de selección a ancho
  completo que no se pueden pasar por alto *(el azul de transferencia y el cobalto de cuenta y botón: reemplazados por
  la decisión 005; el primario es el pino; desde 24UX6C la transferencia tiene su azul verdoso propio, `transfer`)*: Categoría (con la línea de presupuesto
  del mes si existe) y Pagado con / Ingresa en (con saldo registrado o deuda de
  tarjeta, y el tipo de cada opción en la hoja). Comercio y fecha después. El botón
  Guardar repite el importe. Sin controles decorativos de dividir, comprobante o
  etiquetas mientras no existan sus datos. Jerarquía de color: categoría en su
  tono, cuenta en el primario, fecha neutra, botón de guardar en el primario.
- **Inicio (desde 24UX6A con Forest, decisión 005; ver «Producto 24UX6A → Inicio»).** Un campo financiero pino
  arriba (el mes, el atajo a Cuentas, el alcance de moneda solo con dos o más, el número de 46 pt —sin subrenglón desde 24UX6C,
  con su ⓘ al lado cuando hay una sola moneda— y Gastado / Disponible); debajo, solo si existen, «Próximos compromisos» (hasta dos de los próximos siete días
  *(→ desde 24UX6C2, hasta dos de la ventana de 30 días, de hoy a hoy + 30 inclusive; antes de ellos, una sola fila del
  presupuesto general cuando pide atención; ver «Producto 24UX6C2 — actividad de Inicio e interacción de Reportes»;
  desde el refinamiento de 24UX6D, el general y los presupuestos por categoría que piden atención, dos filas como
  máximo: ver «Inicio: atención de presupuestos (refinamiento)»)*) y
  «Actividad reciente» (cuatro filas con compromisos, seis sin ellos); si no hay ninguno, un estado vacío tranquilo.
  Registrar vive en el «+» del dock, no en Inicio. Los movimientos completos siguen en Movimientos, el análisis en
  Reportes, los presupuestos en Presupuestos.
- **Inicio (primera iteración de 24UX6A, reemplazada por la decisión 005, 2026-09-30).** Responde tres preguntas y termina: cómo estoy
  (un número), qué necesita mi atención (los compromisos de esta semana y, a lo sumo, una línea
  calculada) y cómo registro algo (un botón). Arriba, Gastos / Disponible compacto y el atajo a
  Cuentas a la derecha, sin título de pantalla; el mes (o «Saldo registrado» con su botón de
  información) y el número de 48 pt; debajo, lo que cubre (el chip de moneda solo con más de una,
  la cantidad de cuentas en Disponible); «＋ Registrar», el único control relleno; después, solo si
  hay algo que decir, hasta dos compromisos que vencen en los próximos siete días con «Ver todos»
  y una línea: un presupuesto excedido, uno casi agotado o una categoría que concentra el mes. Los
  movimientos viven en Movimientos, el análisis en Reportes, los presupuestos en Presupuestos.
- **Movimientos.** Buscador, filtro Todos / Gastos / Ingresos / Transf., secciones
  "Hoy · 20 sep", "Ayer", día de la semana en los últimos siete días y luego la fecha,
  con el neto del día cuando hay una sola moneda.
- **Detalle de movimiento.** Tile, importe con signo, comercio, fecha completa y
  estado; categoría, cuenta o tarjeta, contexto de presupuesto solo si existe uno
  activo para ese mes, moneda; editar y deshacer. Nada inventado: sin referencias
  bancarias, mapas ni estados de autorización.
- **Tarjetas (desde 24T2; ver «Producto 24T2»).** Identidad → estado → hechos → acción
  principal → acción secundaria → cuotas futuras → actividad. Un deck vertical de las
  tarjetas activas (reemplazó al carrusel horizontal), «Saldo pendiente» como número
  principal, una fila de tres hechos (Vence, Cierra, Disponible) con barra de uso solo
  con una cifra conocida (ámbar desde 85 %, coral sobre el límite), Registrar compra a
  ancho completo sobre Pagar tarjeta (mismo tamaño, tinte azul), «Cuotas futuras» y
  Recientes con «Este ciclo, desde…» en su leyenda. Las archivadas al final, en
  Archivadas; las deudas personales viven en Más → Deudas y cobros.
- **Detalle de tarjeta.** La cara, «Saldo pendiente», los tres hechos (Disponible con
  el límite como leyenda), las acciones que le quedan, Cuotas con un plan por fila y
  todos sus movimientos con «Este ciclo» en la leyenda. Emisor y últimos cuatro ya
  están en la cara; no hay tabla de detalle. Pagos se leen como "Pago de tarjeta ·
  desde Cuenta", sin signo ambiguo.
- **Deudas y cobros.** Totales por moneda, Debo / Me deben, detalle con estado,
  vencimiento y registro de pagos o cobros limitados al saldo pendiente. *(→ 24UX6E: tiles neutros y totales en
  tinta; el color marca el estado, no la dirección; el detalle sin Tipo ni Estado y «Vencimiento» solo cuando la línea
  de estado ya no lleva la fecha.)*
- **Formularios.** Pagar tarjeta y saldar deudas fijan la obligación y solo eligen
  la cuenta de dinero en la misma moneda. El selector de cuenta nombra el tipo
  (Cuenta, Tarjeta de crédito) y nunca ofrece una deuda para un gasto.

**Menos texto.** Las pantallas no repiten reglas que la app ya cumple: sin
"no es saldo bancario", sin pies que expliquen que ARS y USD no se suman, sin
leyendas que reiteren que un pago no es un gasto. La definición de Disponible
vive detrás del botón de información.

## Gráficos

Las barras y las barras de progreso usan vistas nativas y **Reanimated**. La dona
usa **react-native-svg** en la versión incluida por Expo SDK 57 (funciona en Expo
Go); no se agrega una librería de gráficos completa ni una WebView. Las porciones
usan el tono de su categoría (hasta cinco con nombre, el resto como Otras en gris);
los nombres van en la leyenda, nunca solo en el color. En el centro, «Total del período» sobre el total del mes
*(→ reemplazado en 24UX6C2: el centro ya no repite el total, que está arriba; sirve para elegir una categoría. Ver
«Producto 24UX6C2 — actividad de Inicio e interacción de Reportes»)* *(→ 24UX6D: el total vuelve al centro y el KPI de
arriba se va; ver «Producto 24UX6D — Tarjetas en Forest y pulido final de Inicio y Reportes»)*. Con datos nuevos la dona se
dibuja en sentido horario desde las doce (480 ms) solo la primera vez; un cambio de
mes o moneda es un único fundido con las porciones ya finales, junto con el título
del mes y el total. El trazo estático es el arco terminado, así el gráfico está
completo aunque la propiedad animada no se aplique. Con Reduce Motion aparece
terminada. Los valores nunca se ocultan hasta terminar una animación.

## Motion y accesibilidad

Un solo lenguaje en `src/ui/motion.tsx`: curva ease-out fuerte
(0.23, 1, 0.32, 1) y duraciones con nombre: presión 100 ms, soltar 160, estado 200,
datos 260, revelado 480. Nada supera 300 ms salvo el revelado de un gráfico. La
motion responde a datos o al dedo, nunca a que una pantalla gane foco (las raíces
siguen montadas, así un revelado al montar no se vería).

- **Presión.** El control responde al apoyar el dedo, antes de que termine el
  toque. Botones, tarjetas y chips escalan a 0,97; las filas a ancho completo se
  tiñen como una celda de tabla y nunca se achican; los botones de texto o ícono
  se atenúan al 40 %.
- **Control segmentado.** Un solo pulgar se desliza al segmento elegido
  (interrumpible), las etiquetas cambian de color en transición y un háptico de
  selección marca el cambio. Tocar el valor actual no hace nada.
- **Valores.** Cuando cambian los datos de un número principal (métrica, período,
  moneda, mes), el valor anterior se desvanece en 100 ms y el nuevo aparece en
  200 ms subiendo 6 pt; con Reduce Motion queda el fundido sin el desplazamiento.
  Barras y proporciones interpolan entre datos reales, nunca desde cero; si cambia
  el conjunto de categorías, el bloque se funde en lugar de transformar una
  categoría en otra.
- **Una acción, pocas cosas.** Un toque mueve como máximo el pulgar del
  segmentado, el número principal y una visualización. En Inicio, Gastado /
  Disponible cruza el número (`ValueTransition`) y no mueve nada más; «Próximos compromisos» y
  «Actividad reciente» aparecen o se van fundiéndose (`Reflow`). (La línea de atención que
  también se fundía salió de Inicio con la decisión 005.)
- **Bloques.** Una sección que aparece o desaparece se funde y los vecinos se
  deslizan en lugar de saltar; con Reduce Motion, solo el fundido.
- **Hoja de Registrar (24UX6A, decisión 005).** La tarjeta flota sobre el dock: entra
  subiendo 12 pt con un fundido y sale con el fundido inverso, con los mismos tiempos de la
  hoja (unos 300 ms al entrar, 200 ms al salir) y sin resortes; el velo y el «×» dibujado
  sobre el «+» se funden con ella. Con Reduce Motion, solo el fundido en su lugar. La
  pantalla elegida se abre recién cuando la hoja se fue (nunca dos presentaciones a la vez) y
  la primera elección manda mientras se va. *(La primera iteración de 24UX6A usaba la hoja
  de fecha que sube desde el borde: reemplazada por la decisión 005.)* (El lavado animado de
  «En qué gastaste» se retiró con la lista de categorías de Inicio.)
- **Formularios.** Gasto / Ingreso / Transferencia es un solo control sobre un
  solo modal: cambiar es estado, no navegación, y el formulario de abajo se funde.
- **Deck de tarjetas (24T2; reemplaza al carrusel horizontal).** Las tarjetas no elegidas
  quedan apiladas arriba en su orden guardado, cada una mostrando solo su franja superior
  (nombre y «•••• 4009», 50 pt como mínimo); la elegida queda al frente, abajo y entera, junto
  a su resumen. Tocar una franja la elige (un háptico de selección); tocar la del frente abre
  su detalle. Cada tarjeta viaja a su lugar en el hilo de UI (`timing('data')`, 260 ms,
  ease-out, interrumpible) y se presiona como una tarjeta (0,97); ningún gesto horizontal ni de
  arrastre compite con volver atrás. El resumen queda montado y sus valores se funden; un
  bloque que no todas las tarjetas tienen (sus cuotas futuras) aparece o se va fundiéndose y
  lo de abajo se desliza a su lugar (`Reflow`), así nada salta. Con muchas tarjetas, si la
  elegida queda debajo del borde, la página la trae a la vista. Con Reduce Motion las
  tarjetas y los bloques llegan a su lugar sin movimiento y quedan solo los fundidos (su
  política es explícita, `ReduceMotion.Never`, como la de la hoja: sin ella Reanimated los
  volvía un cambio instantáneo).
- **Hápticos.** Uno por acción del usuario (selección en segmentos, cambio de
  pestaña, flechas de mes, categoría o cuenta elegida, tarjeta elegida en el deck; un
  impacto leve al tocar el «+» del dock; éxito al guardar) y siempre con una señal visual. Las
  pestañas cambian al instante, sin deslizamiento ni fundido; el dock de 24UX6A no agrega
  movimiento: la pestaña elegida cambia a su glifo relleno sobre la cápsula clara en el mismo
  cuadro. *(Antes: «la cápsula flotante… cambia de tinta y de lente»; reemplazado por la
  decisión 005.)*

La pila y las hojas nativas siguen siendo la única transición de pantalla (el
Asistente entra y sale con el empuje de la pila); las cuatro raíces de pestaña (Inicio,
Movimientos, Reportes, Más) permanecen montadas sin fade/detach/freeze. *(Antes «las cinco
pestañas»: reemplazado por la decisión 005, 2026-09-30.)* Objetivos de 44 pt,
texto escalable con filas apiladas en tamaños grandes, etiquetas de VoiceOver con
importe, moneda y estado.

## Producto 18 — navegación y acciones rápidas (sin rediseño)

*Registro. Desde la decisión 005 (2026-09-30) Más es la cuarta pestaña de cuatro y el «primario cobalto» es el pino de
Forest; ver «Producto 24UX6A».*

- **Más.** La quinta pestaña deja de llamarse Ajustes: es el hub secundario, dos
  listas agrupadas nativas (Finanzas / App y datos) con una nota al pie sobre datos
  locales. Tarjetas no aparece ahí porque ya es pestaña. La copia de seguridad tiene
  su pantalla; Categorías es una lista de solo lectura por ahora.
- **Tarjetas** solo muestra tarjetas de crédito. Deudas y cobros vive en Más.
- **Atajo de importe.** Bajo el campo de importe de una transferencia, una nota al pie
  con la cifra registrada ("Saldo registrado: ARS 190.162,00", "Saldo pendiente",
  "Pendiente") y una acción de texto en el primario cobalto: Usar todo, Pagar total,
  Saldar total o Cobrar total. Solo rellena el campo con el modelo canónico de
  visualización; guardar sigue siendo el botón principal. Sin cifra positiva no hay
  acción, solo la nota.
- Inicio no suma botones: el acceso al Asistente desaparece de la cabecera mientras
  sea una vista previa; los bloques contextuales existentes se mantienen.

## Producto 19 — presupuesto general y sublímites (sin rediseño)

- **Formulario.** Primero el tipo, con el segmentado existente: General o Por
  categoría. General no muestra selector de categoría; Por categoría lo conserva.
  Mismo AmountField de Interfaz 17.
- **Presupuestos.** Jerarquía: el presupuesto general es el resumen principal
  (Disponible o Excedido, barra, Gastado / Límite, "N % utilizado" en su color de
  estado) y los límites por categoría son filas densas debajo. *(→ 24UX6E: plano, sin tarjeta, en el orden Disponible
  o Excedido → barra → «N % utilizado» → Gastado / Límite, el héroe en tinta salvo excedido; ver «Producto 24UX6E».)* Sin general, un botón
  secundario compacto "Agregar presupuesto general", nunca una tarjeta vacía enorme.
  Nunca se suman los sublímites.
- **Estados.** Un solo criterio en el dominio: calmo por debajo del 85 %, aviso
  (ámbar) desde el 85 % hasta el límite inclusive, excedido (coral) al superarlo.
  Los mismos tres tonos semánticos de siempre.
- **Inicio.** La tarjeta responde cuánto del mes usé: lo que queda del general,
  "de $X · N %" y cuántos sublímites se excedieron; sin general, el sublímite más
  ajustado y la cantidad de sublímites.

## Producto 20 — identidad de cuentas y categorías (sin rediseño)

- **Un solo cimiento.** Íconos curados (Ionicons, nunca emoji) y una paleta fija de
  once colores contenidos — cobalto, celeste, verde azulado, verde, oliva, ocre,
  terracota, rosa, índigo, pizarra, grafito — con nombre accesible en español y par
  claro/oscuro medido en Node (`tests/appearance.node.ts`). El coral de gasto no está:
  es significado, no identidad. Doce íconos de cuenta (billetera, efectivo, banco,
  billetera virtual, tarjeta prepaga, ahorro, inversión, negocio, caja fuerte, exterior,
  hogar, compartida) y treinta y siete de categoría.
- **El selector.** Vista previa (tile grande con el nombre), "Icono" como grilla de
  tiles redondos de 44 pt y "Color" como fila de puntos. El elegido se rellena con su
  color y lleva un anillo; el punto elegido, anillo y tilde. Un háptico de selección por
  cambio, solo transiciones de color (200 ms; 0 con Reduce Motion), radio buttons con
  nombre real para VoiceOver ("Banco", "Celeste"), nunca "círculo azul".
- **Dónde vive el color.** Solo en el tile: glifo en su color sobre su tinte suave, como
  la categoría desde Interfaz 16. Filas, importes, pantallas y texto siguen neutros. Una
  cuenta sin elección se ve billetera sobre cobalto; tarjetas y deudas conservan su glifo.
- **Superficies.** Cuentas, detalle de cuenta (tile junto a "Saldo registrado"), el
  selector de cuenta y su hoja en todos los formularios, las filas Cuenta / Desde / Hacia
  de los detalles. Categorías: el nombre visible sigue a su definición en filas, detalle,
  selector, Inicio, Reportes (leyenda, dona, comercios), Presupuestos, Recurrentes y
  desgloses; la cadena guardada no cambia.
- **Categorías.** Lista con Gastos, Ingresos y Archivadas; "+" abre Nueva categoría;
  tocar una fila edita nombre, ícono y color o la archiva con confirmación. Sin borrado. *(→ 24UX6E: filas en la
  geometría de Forest sin chevron; una archivada ya no se atenúa y en Archivadas dice su tipo; el editor de una
  archivada abre con su nota de ciclo de vida.)*
- **Más.** Solo el grupo Finanzas lleva tiles tintados (cobalto, verde azulado, índigo,
  ocre, pizarra) sobre la superficie neutra; App y datos sigue neutro.

## Producto 21 — el Asistente como capacidad principal

*Registro. Desde la decisión 005 (2026-09-30) el Asistente es una pantalla de la pila que se abre desde la hoja del
«+» (ya no una pestaña ni cuatro acciones en Inicio) y todo lo que aquí es «cobalto» lee el primario pino de Forest; la
conversación, el borrador, la confirmación y la evidencia siguen como se describen. Ver «Producto 24UX6A».*

- **Inicio.** Cuatro acciones de igual ancho: Asistente, Gasto, Ingreso, Transferir. Las
  columnas flexionan (nada de separaciones fijas que desbordan un iPhone angosto) y la
  leyenda puede partirse en dos líneas con texto grande; la etiqueta de VoiceOver no se
  abrevia. El círculo es un material opaco con sensación nativa, no vidrio web: en claro,
  blanco con borde hairline y la sombra suave de las tarjetas; en oscuro, un escalón de
  superficie con un filo de luz arriba. El Asistente es el mismo objeto en el tinte de
  marca: lavado cobalto, anillo cobalto fino de 1 pt y el glifo sparkles en cobalto. Sin
  blur, sin gradientes, sin dependencia decorativa; el material real (Liquid Glass) queda
  para la fase de development build.
- **Conversación silenciosa.** Mensaje propio: píldora compacta gris (`inset`) a la
  derecha, sin color de marca. Respuesta: texto corrido a la izquierda, sin contenedor.
  "Pensando…" con un punto cobalto que late (quieto con Reduce Motion) antes de la primera
  palabra; un cursor cobalto mientras llega texto; "Respuesta interrumpida." si se detuvo.
  Nunca burbujas grandes, nunca violeta, nunca bordes brillantes.
- **Estado vacío.** Un tile sparkles de 44 pt, "¿En qué te ayudo?" y cuatro sugerencias
  como chips; desaparecen al empezar la conversación.
- **Compositor.** Una píldora de superficie con borde hairline: campo multilínea (hasta
  unas cinco líneas, luego desplaza dentro), micrófono en secundario *(→ reemplazado en 24UX6C, ver «Producto 24UX6C — presentación de movimientos, Inicio y Más»)* y un botón redondo
  de enviar relleno de cobalto (gris e inactivo sin texto; se convierte en Detener
  mientras responde). Sigue el teclado en el hilo de UI y respeta el indicador de inicio.
  El micrófono existe y explica su límite: el dictado necesita el development build. *(→ reemplazado en 24UX6C, ver «Producto 24UX6C — presentación de movimientos, Inicio y Más»)*
- **Tarjeta de borrador.** Una Surface: eyebrow "Borrador · Gasto", importe grande en
  coral (verde para ingreso), filas Comercio / Categoría (tile) / Pagado con (tile de
  cuenta) / Fecha ("Hoy · 21 sep"), Confirmar (primario) y Editar (secundario) a igual
  ancho, Descartar como texto. Un dato faltante se marca en ámbar y desactiva Confirmar.
  Confirmada: "Guardado · Gasto" con tilde verde y "Ver movimiento". Descartada o
  editada: una sola línea gris. Aparece con el ascenso de 6 pt (solo fundido con Reduce
  Motion).
- **Aclaración.** La pregunta como texto del Asistente y las opciones como chips
  (cuentas de esa moneda, Gasto / Ingreso, categorías más usadas); un háptico de selección
  y la elección se repite como mensaje propio.
- **Evidencia.** Filas discretas entre hairlines (etiqueta secundaria, importe con Money,
  con signo cuando es diferencia) y enlaces de texto en cobalto con chevron: Ver
  movimientos, Ver categoría, Ver presupuesto. Nunca un tablero.
- **No conectado.** Una leyenda terciaria bajo el compositor antes del primer envío *(→ reemplazado en 24UX6C, ver «Producto 24UX6C — presentación de movimientos, Inicio y Más»)*; al
  enviar, el texto vuelve intacto al campo y una nota con ícono lo explica. Sin respuesta
  inventada, sin envío remoto.

## Producto 23.0 — pulido de interacción y base de localización (sin rediseño)

- **Fila de selección.** Para moneda, cuenta y categoría en su forma compacta: glifo o
  tile de identidad, la etiqueta como caption, el valor elegido como línea principal (hasta
  tres líneas) y una línea de detalle (código y símbolo, tipo de cuenta), chevron. Todo
  apilado: un nombre largo baja, el código conserva su línea, nada compite en horizontal.
  Sin `onPress` es el mismo dato en solo lectura (la moneda de una cuenta existente).
  `DetailRow` sigue para pares cortos y se apila solo cuando el par es largo o el texto
  es grande, de modo que un valor nunca se parte en fragmentos alineados a la derecha.
- **Campo de importe.** El símbolo queda anclado al borde izquierdo y los dígitos crecen
  hacia la derecha desde un origen fijo, en cifras tabulares, como una columna de libro
  mayor: al agregar un dígito o un punto de miles no se mueve nada de lo que ya estaba.
  El tamaño baja únicamente cuando el importe completo no entra junto al símbolo. No hay
  animación de layout por pulsación ni posición estimada del símbolo; el importe se lee
  alineado a la izquierda como el héroe de Inicio y el atajo bajo el campo lo acompaña.
  Se descartó el centrado: centrar obliga a mover todo el par en cada tecla, y una
  posición estimada nunca coincide exactamente con los glifos reales.
- **Apilado compartido.** Un solo umbral (`useStacked`, escala mayor a 1,2) para toda fila
  que ponga un nombre junto a un importe *(en las filas de categoría de Reportes, ampliado en 24UX6C2: también se
  apilan cuando el nombre y el importe no entran juntos en el ancho; ver «Producto 24UX6C2 — actividad de Inicio e
  interacción de Reportes»)*; `StatRow` pone dos o tres estadísticas lado a
  lado y una debajo de otra con texto grande; los segmentados limitan su escala a 1,3× y
  ajustan la etiqueta al segmento; los nombres tienen dos líneas y la columna del importe
  ocupa como máximo la mitad; "Saldo pendiente · ARS" y "ARS 1.234,56" se unen con
  espacios duros para que el código o el número nunca queden solos.
- **Localización.** Idioma, región, moneda de la cuenta y valor almacenado son cuatro
  cosas distintas. Las fechas y los porcentajes salen de tablas (el mismo "22 sep" en toda
  la app, no el "sept" del ICU del dispositivo). El inglés existe como catálogo y no se
  muestra hasta que toda la app lo tenga (23.1): un iPhone en inglés sigue leyendo
  español antes que media app traducida.

## Producto 24UX6A — Forest, cuatro pestañas, el «+» de registro e Inicio (decisión 005)

Decisiones finales del dueño del 2026-09-30, registradas en la decisión 005; la PR #70 se rehízo sobre ellas.
Implementado en código; **la revisión en iPhone está pendiente** (no hubo build de EAS) y su lista está en
docs/mobile-device-checklist.md. El contrato y las pruebas están en el roadmap («Producto 24UX6A»). No cambió nada
de contabilidad, cotizaciones, unidades menores, transferencias, tarjetas, cuotas ni deudas; tampoco el esquema, la
versión de las copias ni las dependencias nativas. 24UX6A abre el carril UX (24UX6A → 6B Reportes → 6C Movimientos y
Más → 6D Tarjetas), que se apoya sobre el roadmap de producto (24T3, 25A, 25C/C2, 25D, 25E/F, Producto 26) sin
reemplazarlo.

### Forest: la paleta

Un fondo mineral gris verdoso (negro OLED en oscuro), tinta para el texto y el dinero, y una sola marca pino en la
ventana de tono 158–168°: nunca verde azulado, cian, esmeralda ni azul. Reemplaza al cobalto y a los neutros de
Interfaz 17 (sección «Sistema», marcada). Los tokens viven en `src/ui/palette.ts`, sin React Native, y
`tests/theme.node.ts` mide sus contrastes en Node.

**La ventana de tono, exacta.** La ventana vinculante de 158–168° rige el campo (`hero`) y la marca clara (`primary`,
`primaryFill`). Los hex exactos de la entrega para el acento salvia (#9FD8C1 / #86C9B0) y la marca oscura (#94D2BB /
#86C9B0) miden 155,8–157,7°: las cifras HSL de la entrega están redondeadas, y se conservan los hex. Las pruebas exigen
155–168° para todos los tokens de marca y 158–168° para el campo y la marca clara (decisión 005).

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `background` · `surface` · `inset` · `elevated` | #F0F3F1 · #FFFFFF · #E6EBE8 · #FFFFFF | #000000 · #0F1513 · #171E1B · #252D2A | Lienzo; grupos, hojas y campos; chips y campos sobre una superficie; segmento elegido y popovers |
| `text` · `secondary` · `tertiary` · `line` | #0F1A16 · #45564E · #586961 · #DCE3DF | #EDF3EF · #A2B1A9 · #899A91 · #1F2825 | Tinta y dinero; etiquetas; decimales y marcadores; hairline |
| `primary` · `link` | #1D5647 | #94D2BB | Marca como texto: enlaces, la opción elegida, glifos activos |
| `primaryFill` · `onPrimary` · `primarySoft` | #1D4F42 · #FFFFFF · #E1ECE7 | #86C9B0 · #05211A · #14261F | El único botón relleno y su tinta; un tinte de marca |
| `thumb` | #FFFFFF | #323D39 | Pulgar del segmentado compacto sobre el lienzo |
| `expense` · `income` · `transfer` · `warning` | #B3432E · #1F7A4F · #45564E · #9A5B00 | #EE8A72 · #5CCB93 · #A2B1A9 · #E8A94A | Negativo · positivo · neutro · vence pronto. *(→ 24UX6C: `transfer` es azul petróleo, #2D6476 / #8FC3D2; ver «Producto 24UX6C»)* |
| `scrim` | rgba(0,0,0,0.40) | rgba(0,0,0,0.60) | Velo de las hojas y de la hoja de Registrar |
| `hero` · `heroInk` · `heroSecondary` | #14362D · #EEF5F1 · #A8C4B9 | #0F2A22 · #EDF5F0 · #A1BDB2 | El campo financiero de Inicio y su tinta |
| `heroControl` · `heroThumb` · `heroThumbInk` | #26493F · #F4F8F6 · #14362D | #1E3D34 · #E4EEE9 · #0F2A22 | Controles sobre el campo: pista, pulgar y su texto |
| `accent` · `onAccent` | #9FD8C1 · #0F2A22 | #86C9B0 · #05211A | El acento salvia: el «+» del dock y el círculo del Asistente en la hoja |
| `dock` · `dockInk` · `dockActive` · `dockActiveInk` | #1B3C33 · #B5C9C1 · #3C6356 · #FFFFFF | #133029 · #A9BFB6 · #335A4E · #FFFFFF | La píldora pino, los glifos inactivos, la cápsula de la pestaña elegida y su glifo |

Los rellenos de deslizar (`swipeDestructive`, `swipeNeutral`, `swipeAccent`) y los tintes suaves de cada semántica
siguen la misma familia (valores en `palette.ts`).

- **Marca.** `primary` y `primaryFill` marcan interacción y selección, y nada más. Donde una regla anterior decía
  «cobalto», hoy rige el pino. El texto normal sigue en tinta; los botones secundarios, en tinta sobre relleno.
- **Significado.** El rojo nunca quiere decir «gastado»: un gasto es tinta con signo menos *(→ reemplazado en 24UX6C, ver «Producto 24UX6C — presentación de movimientos, Inicio y Más»)*; `income` (positivo) va
  con signo más; `transfer` es la tinta secundaria neutra (ya no azul) *(→ reemplazado en 24UX6C, ver «Producto 24UX6C — presentación de movimientos, Inicio y Más»)*; `expense` es el tono negativo, reservado para
  lo destructivo, lo vencido y lo que pasa un límite; `warning` es lo que vence pronto. Nunca color sin signo o
  etiqueta.
- **Campo y acento.** `hero*` es el campo financiero de Inicio y el tile del Asistente en la hoja de Registrar. El
  acento salvia es solo del «+» (y del círculo del Asistente dentro de la hoja que el «+» abre).
- **Lo que no cambió.** Los colores de categoría: los ids de apariencia de `packages/domain`, los presets, el hash, el
  orden de asignación y los tonos de `src/ui/category-color.ts`; un color guardado y el tono derivado de una categoría
  histórica conservan su identidad. Tampoco hubo reescritura global de tipografía ni de radios.
- **Alcance.** Todas las pantallas leen los tokens, así que toman Forest desde ya; el restyle propio de Reportes, de
  Movimientos y Más, y de Tarjetas es 24UX6B, 6C y 6D.

### Superficies y vidrio

- Lienzo `background`; grupos, hojas y campos en `surface`; chips y campos sobre una superficie en `inset`; pulgar y
  popovers en `elevated`; hairline `line`. En oscuro el lienzo es negro puro y las superficies suben por escalones,
  sin sombra.
- El vidrio es una capa de control, nunca de contenido: solo el dock, el «+», la hoja de Registrar, los controles
  circulares compactos, los menús y el compositor pueden llevarlo; filas, tarjetas, saldos, gráficos y contenido fijo
  quedan sólidos. Las píldoras de movimiento del detalle de una cuenta (desde 24UX3) son una superficie de control ya
  existente y también pueden llevarlo. En esta entrega el código dibuja Liquid Glass, donde iOS lo ofrece y Reducir
  transparencia está apagado, en tres superficies: la píldora del dock (teñida de pino, `dock`), las píldoras de
  movimiento del detalle de una cuenta y el compositor del Asistente. Sin vidrio, el dock es el pino sólido con
  hairline y una sombra suave en claro (`dockMaterial`), que es el estado diseñado y no uno roto. El «+» es un material
  opaco (acento, hairline, sombra leve en claro) y la tarjeta de la hoja es `surface`: ambos sólidos.

### El dock: cuatro pestañas y el «+»

- **Cuatro raíces**, en este orden: Inicio (sin cabecera), Movimientos (conserva el «+» de su cabecera, que abre un
  movimiento nuevo *(→ reemplazado en 24UX6C, ver «Producto 24UX6C — presentación de movimientos, Inicio y Más»)*), Reportes y Más. No hay pestaña del Asistente. La mitigación de pantallas negras de
  `src/ui/navigation.ts` no cambió (sin detach, sin animación, sin carga perezosa, sin congelar, escena opaca):
  cambiar de pestaña es instantáneo, sin fundido.
- **Geometría** (`src/ui/dock-geometry.ts`, pura): 60 pt de alto, 16 pt de los lados (más el inset lateral en
  horizontal), 8 pt arriba y 10 pt entre la píldora y el «+» de 60 pt. Debajo, el inset inferior menos 14 pt (nunca
  menos de 10): descansa en la parte alta del área del indicador de inicio, sin tocarlo; 10 pt en un iPhone sin
  indicador. A 375 pt cada pestaña tiene unos 65 pt de ancho; a 393 pt, unos 70.
- **En el layout, nunca encima.** *(Reemplazado el 2026-10-02 por 25UX1: el dock flota sin franja detrás; ver
  «Producto 25UX1».)* El dock es una fila sobre el lienzo de la pantalla: cada pantalla termina arriba de
  él, y el desplazamiento, el teclado, las áreas seguras y la última fila funcionan como antes. *(Confirmado
  2026-10-02, en la revisión de 24T3: la píldora y el «+» se ven sobre una franja del lienzo con el área segura, y no se
  convierten en una capa absoluta flotante. Así ninguna última fila queda debajo del dock, el teclado y el área segura
  siguen siendo deterministas y se conserva la estrategia de pestañas montadas contra las pantallas negras de
  `src/ui/navigation.ts`.)*
- **Solo íconos a la vista, nunca para la accesibilidad.** Glifo de 24 pt en `dockInk`; la pestaña elegida lleva el
  glifo relleno en `dockActiveInk` sobre una cápsula `dockActive`: dos señales, nunca solo el color. Cada pestaña es un
  blanco de 48 pt de alto y de unos 65 pt de ancho a 375 pt (unos 70 a 393 pt). En iOS, VoiceOver dice «Inicio, pestaña, 1 de
  4» (un botón que nombra su posición, porque el rol `tab` de React Native no le da rasgo a iOS) y «Seleccionado» en la
  actual; en otras plataformas, el rol `tab` con su nombre. Una pulsación larga muestra el nombre en el visor de
  contenido grande de iOS. Se emiten `tabPress` y `tabLongPress` como en la barra del sistema, y tocar la pestaña
  actual no navega.
- **El «+» es una acción, no una quinta pestaña.** Queda fuera de la lista de pestañas, sin estado elegido y fuera del
  «n de 4». VoiceOver: «Registrar», con la pista «Abre las opciones para registrar». Un círculo de 60 pt con relleno
  `accent` y el glifo `add` en `onAccent`, hairline y sombra leve en claro; un impacto háptico leve; solo toque (no
  hay atajo de pulsación larga en v1).

### La hoja de Registrar

- El «+» abre una tarjeta que flota sobre el dock (`BottomSheet` con `floating`): 12 pt por encima del dock y de los
  lados, 32 pt de radio, el título «Registrar» como eyebrow, sin fila Cancelar / Listo; el dock sigue visible bajo el
  velo. Se cierra con «Cerrar» (un «×» dibujado exactamente donde está el «+», sobre el velo y dentro del mismo grupo
  modal de VoiceOver), con el velo, con el gesto de escape de VoiceOver o con atrás. La tarjeta nunca pasa del alto de
  la ventana menos el área segura superior y el espacio del dock (mínimo 200 pt); cuando no entra (tamaños de texto de
  accesibilidad), el título y las opciones se desplazan dentro de la tarjeta, sin rebote. La hoja por defecto (fecha y
  las demás) no cambió.
- **Primero y más grande, el Asistente**: un tile pino (`hero`) con el círculo de acento y sparkles, «Asistente» y
  «Decilo con tus palabras o preguntá lo que quieras». Solo si esta sesión de la app ya tiene una conversación,
  un chip «Continuar: «…»» con las últimas palabras reales de la persona; nunca una línea inventada.
- **Debajo, tres filas neutras** (tile `inset` con el glifo en el primario) *(→ reemplazado en 24UX6C, ver «Producto 24UX6C — presentación de movimientos, Inicio y Más»)*: Gasto «Una compra o un pago», Ingreso
  «Sueldo, cobro u otro ingreso», Transferencia «Entre cuentas o pago de tarjeta». La elección es la palabra, no un
  color.
- **Sin micrófono.** Un micrófono que no puede dictar sería un callejón sin salida; el dictado es trabajo posterior
  del Asistente.
- **Una elección, una pantalla.** Gasto e Ingreso abren el formulario de movimiento con su tipo, Transferencia la
  transferencia, el Asistente su pantalla; con `router.push`, una sola vez y recién cuando la hoja se fue. La primera
  elección manda mientras la hoja se va: otra fila, el velo o el «+» no cambian nada. Un movimiento se preselecciona
  en la moneda mostrada solo si una cuenta viva la tiene; el Asistente recibe la moneda mostrada. Nada se escribe
  desde la hoja.

### El Asistente, una pantalla de la pila

- `app/assistant.tsx` es una pantalla del stack raíz con el título «Asistente»: entra y sale con el empuje nativo, y
  atrás vuelve a la pantalla donde se tocó el «+». «Nuevo chat» aparece en la cabecera cuando hay mensajes.
- La conversación vive en una sesión en memoria (`src/assistant/session.ts`), una por proceso de la app: salir de la
  pantalla no la borra ni corta una respuesta en curso (la respuesta llega a la sesión); volver la muestra con su
  último intercambio a la vista. Nuevo chat la reinicia y cerrar la app la borra. Nada se guarda.
- Los enlaces de evidencia a una raíz (Inicio, Movimientos, Reportes, Más) usan `router.dismissTo`: vuelven a las
  pestañas que ya están debajo del Asistente y eligen esa pestaña (un solo dock; atrás no descubre un segundo juego de
  pestañas, que es lo que apilaría `navigate` desde esta pantalla). Los demás se apilan. Sigue sin escribir nada sin
  un borrador confirmado, y reintentar reutiliza el mismo id de movimiento.

### Inicio: el campo financiero

Inicio tiene su propio desplazamiento y ningún título. Arriba, el campo financiero pino (`hero`, 32 pt de radio
abajo), que empieza detrás de la barra de estado (relleno superior: el área segura más 12 pt):

1. El mes en curso como encabezado (no se toca, sin chevron) y, a la derecha, el botón de billetera a Cuentas.
2. Solo con dos o más monedas: el chip de moneda y el botón de información. Con una sola moneda la fila no existe y
   la información pasa junto al subrenglón *(→ reemplazado en 24UX6C, ver «Producto 24UX6C — presentación de movimientos, Inicio y Más»)*.
3. El número a 46 pt en `heroInk` (en `heroSecondary` si es exactamente cero); con una cotización faltante, sus partes
   por moneda; fuera de rango, su texto.
4. El subrenglón *(→ reemplazado en 24UX6C, ver «Producto 24UX6C — presentación de movimientos, Inicio y Más»)*. Gastado: «Hasta hoy · $ X por día» o «Sin gastos este mes». Disponible: «Saldo registrado · N
   cuentas», nunca una cifra por día.
5. Gastado / Disponible, un segmentado sobre el campo (pista `heroControl`, pulgar `heroThumb`, elegido
   `heroThumbInk`, el otro `heroSecondary`): solo cambia el número.

- **Debajo, solo lo que existe.** «Próximos compromisos»: los gastos recurrentes que vencen en los próximos siete
  días *(→ reemplazado en 24UX6C2 por la ventana de 30 días, de hoy a hoy + 30 inclusive, ver «Producto 24UX6C2 —
  actividad de Inicio e interacción de Reportes»)*, a lo sumo dos, con «Ver todos» → Recurrentes. «Actividad reciente»: gastos e ingresos de este mes (sin
  transferencias) *(→ reemplazado en 24UX6C2, ver «Producto 24UX6C2 — actividad de Inicio e interacción de Reportes»)*, del más nuevo, cuatro filas si hay compromisos y seis si no, con «Ver todos» que selecciona
  Movimientos. Cada uno en un grupo; sin datos, la sección no existe.
- **Vacíos.** Sin ninguno de los dos: «Todavía no hay movimientos este mes» / «Registrá un gasto con el botón
  Registrar (+) o contáselo al Asistente.» (el «+» por el nombre que le da VoiceOver), sin botón. Con una moneda de
  varias mostrada sola («Solo X»), el título nombra la moneda: «Todavía no hay movimientos en X este mes» (la regla de
  24UX2, restituida). Sin cuentas: el estado vacío con «Empezar» → nueva cuenta.
- **Salieron de Inicio** «＋ Registrar» (ahora es el «+» del dock), la línea de atención, los rankings, las tarjetas de
  presupuesto, los gráficos y el banner del Asistente. Siguen en Presupuestos, Reportes y la hoja de Registrar.
  *(→ Desde 24UX6C2 vuelve una sola fila contextual del presupuesto general, solo cuando pide atención; la tarjeta
  permanente de presupuesto y la línea de atención siguen fuera. Ver «Producto 24UX6C2 — actividad de Inicio e
  interacción de Reportes».)* *(→ Refinamiento de 24UX6D: también los presupuestos por categoría, hasta dos filas; ver
  «Inicio: atención de presupuestos (refinamiento)».)*
- **Barra de estado.** Contenido claro mientras Inicio tiene foco y el campo está debajo de la barra; vuelve al
  estilo del tema al pasar el campo o al salir de Inicio.
- **La semántica no cambió.** Gastado son solo los gastos del mes (nunca transferencias ni pagos de tarjeta; las
  cuotas en el mes de su resumen; consolidado con la cotización de la fecha de cada movimiento). Disponible es el
  saldo registrado de las cuentas de dinero (sin tarjetas, deudas ni cobros): no es ingresos menos gastos ni lo que
  queda de un presupuesto.

### Motion

Las reglas de «Motion y accesibilidad» siguen vigentes: la curva de `src/ui/motion.tsx`, sin resortes, y nada supera
300 ms salvo el revelado de un gráfico.

- **La hoja de Registrar** sube 12 pt con un fundido sobre los tiempos que ya tenían las hojas (unos 300 ms al entrar,
  200 ms al salir); con Reduce Motion, solo el fundido en su lugar.
- **Las pestañas** cambian al instante; la cápsula y el glifo relleno cambian en el mismo cuadro.
- **Inicio.** Gastado / Disponible mueve el pulgar y cruza el número; los grupos aparecen o se van con `Reflow`.
- **El Asistente** entra con el empuje de la pila; no hay transición propia.

### Lo que sigue en el carril UX (aprobado, sin implementar)

- **24UX6B Reportes** *(el reordenamiento está implementado: ver «Producto 24UX6B — jerarquía de Reportes»; la dona
  elegible llegó en 24UX6C2; el gráfico Día a día y la cabecera fija siguen pendientes)*. Se reordena y se viste en Forest sin quitar
  presupuestos, hechos ni flujo neto. La dona elegible
  es solo selección visual dentro del reporte; se permiten el gráfico Día a día y una cabecera fija sólida. Las barras
  de evolución conservan la navegación por mes actual (sin una segunda selección solo para comparar); «Otras» sigue
  agrupando por los primeros N (no se adopta la regla del 3 %); sin ruta inventada de detalle por comercio.
- **24UX6C Movimientos y Más** *(implementado en parte: ver «Producto 24UX6C — presentación de movimientos, Inicio y
  Más»; los filtros por cuenta, categoría, período y período a medida siguen pendientes; desde 24UX6D pertenecen al
  alcance de búsqueda de 25C, con sus búsquedas guardadas; hoy existen la búsqueda y el filtro de tipo Todos / Gastos /
  Ingresos / Transf.)*. Filas, búsqueda y filtros en Forest; filtros por período, cuenta y categoría desde los
  datos del repositorio; el total del día como hoy. Sin nota, origen Apple Pay ni hora inventados; Deshacer y
  Recuperar se quedan (sin borrado definitivo falso), igual que Movimientos deshechos. Idioma y Región siguen siendo
  rutas separadas, agrupadas a la vista; no hay fila «Ajustes» (no tiene ruta).
- **24UX6D Tarjetas** *(implementada: ver «Producto 24UX6D — Tarjetas en Forest y pulido final de Inicio y Reportes»)*. Conserva todo lo que hace (Disponible de crédito, Registrar compra, Recientes); se permiten la
  interacción de mazo y el restyle Forest. El progreso de cuotas es registradas / facturadas según el dominio, nunca
  «pagadas» inferidas, con los importes programados reales; ninguna fórmula contable ni de disponible cambia.
- **24UX6E Más destinos financieros en Forest** *(implementada: ver «Producto 24UX6E — Más destinos financieros en Forest»)*.
  Cuentas (lista y detalle), Presupuestos (lista, detalle y sus flujos actuales), Recurrentes (lista y detalle),
  Deudas y cobros (lista y detalle) y Categorías, llevados a la jerarquía y la calidad de Inicio, Reportes y Tarjetas.
  Solo presentación y ciclo de vida, salvo que aparezca un error real; ningún cambio contable, de almacenamiento ni de
  esquema por diseño. Copia de seguridad, Movimientos deshechos, Idioma, Región, Apariencia y las demás utilidades de
  Más se auditan sin rediseñarse: las coherentes quedan como están y lo demás se anota como un pulido chico posterior.
  Detalle en `docs/mobile-roadmap.md` («Producto 24UX6E»).

### Apariencia

- Más → App y datos → Apariencia: Sistema (por defecto: decide el iPhone), Claro u Oscuro, con el selector de Idioma y
  Región. Es una preferencia del dispositivo, como el idioma: se guarda en el almacén de preferencias, fuera de la
  base financiera y de las copias de seguridad (restaurar una copia no cambia cómo se ve este iPhone), sin migración.
- Se guarda antes de aplicarse (una escritura rechazada no cambia nada y la pantalla lo dice). Se aplica en toda la app
  al instante y también a iOS (`Appearance.setColorScheme`), así el teclado, las alertas, la rueda de fecha y el vidrio
  coinciden con la paleta; Sistema le devuelve la decisión al dispositivo. Se lee y se aplica antes del primer cuadro:
  sin parpadeo del otro tema. La pantalla de lanzamiento nativa, anterior a todo JavaScript, sigue al dispositivo; el
  primer cuadro después ya es el elegido.
- Apariencia no toca los tokens: solo decide quién elige el tema (Sistema, Claro u Oscuro). Los valores de cada tema
  son los de Forest (arriba); en la primera iteración eran los de Interfaz 17.

### Primera iteración de esta PR (reemplazada por la decisión 005, 2026-09-30)

> **Reemplazado por la decisión 005.** Registro de la primera versión de 24UX6A, que no llegó a publicarse: cinco
> pestañas con etiquetas visibles y el Asistente al centro, cobalto como primario, «＋ Registrar» dentro de Inicio, la
> línea de atención y el rechazo explícito de un «+» flotante. Lo vigente es lo de arriba: Forest, cuatro pestañas
> solo con íconos, el «+» en el dock, el Asistente como pantalla de la pila y el Inicio de campo financiero. Siguen
> valiendo de aquí los compromisos de la semana (dos como máximo), Apariencia y la lista de componentes retirados.
> *(La ventana de una semana fue reemplazada en 24UX6C2 por la de 30 días, de hoy a hoy + 30 inclusive; ver «Producto
> 24UX6C2 — actividad de Inicio e interacción de Reportes».)*

Las capturas del dueño (un Inicio anterior, una app de finanzas premium, una barra flotante con «+», una IA de dinero)
fueron solo referencia de jerarquía: no se copió marca, paleta, recurso, medida ni arquitectura de información. La
identidad sigue: minimalismo iOS, tinta neutra, cobalto solo para interacción, selección, la acción principal y la
pestaña activa; sin violeta; menos superficies. El contrato y las pruebas están en el roadmap («Producto 24UX6A»).

#### Antes → después

- **Antes (24UX3–24UX5).** Título «Inicio» con el atajo a Cuentas; Gastos / Disponible con el chip de moneda; el
  número; tres píldoras (Gasto, Ingreso, Transferir) y la entrada ancha «Contale al Asistente»; la tarjeta
  «Presupuesto del mes»; «En qué gastaste» con tres categorías y el enlace a Reportes; «Próximos compromisos» (hasta
  tres, cualquier fecha); «Últimos movimientos» con «Ver todos». Siete bloques que competían con el número.
- **Después.** Gastos / Disponible compacto y el atajo a Cuentas en la misma fila (donde estaba el título: la pestaña
  elegida ya nombra la pantalla); el mes y el número de 48 pt; debajo lo que cubre; «＋ Registrar»; después, solo si
  existen, hasta dos compromisos de los próximos siete días y una línea de atención. Un mes tranquilo es el número y el
  botón. El título raíz se quitó solo en Inicio: Movimientos, Asistente, Reportes y Más conservan el suyo (su título
  sí orienta: son listas, una conversación y un hub), y ninguna pantalla de detalle o formulario perdió su cabecera.

#### Qué salió de Inicio (y dónde sigue)

- «Últimos movimientos» → la pestaña Movimientos. «En qué gastaste» → Reportes (dona, leyenda, detalle por
  categoría). La tarjeta de presupuesto → Presupuestos, y en Inicio solo la línea cuando pide atención. Las tres
  píldoras y la entrada del Asistente → la hoja de Registrar (las píldoras siguen en el detalle de una cuenta).
- Se eliminaron los componentes que ya no tenían otro uso (`CategoryRanking`, `BudgetHomeCard`, `AssistantEntry`, la
  variante `home` de `EntryRow`, `budgetHomeHeadline`, `categoriesStatus`) y sus textos.

#### Registrar: un botón, una hoja

- **Por qué una hoja y no cuatro controles.** Cuatro botones grandes eran la mitad de la pantalla y pesaban como el
  número. Un «+» flotante persistente sobre la barra competiría con la pestaña central del Asistente y taparía
  contenido; un menú contextual de iOS esconde el Asistente detrás de una pulsación larga. Una cápsula cobalto
  «＋ Registrar» bajo el número (la única acción rellena de Inicio, a lo ancho con texto de accesibilidad) abre la hoja
  compacta de la fecha con cuatro filas: Registrar gasto (coral), Registrar ingreso (verde), Transferir entre cuentas
  (azul) y Hablar con el Asistente (cobalto, con «Contale qué pasó: te propone el movimiento y vos lo confirmás»).
  Cancelar, el velo o el gesto atrás cierran sin abrir nada. Cada fila abre exactamente lo que abría el control
  anterior, con la misma moneda, después de que la hoja se fue. Nada se escribe desde la hoja; el Asistente sigue
  proponiendo borradores que la persona confirma, y sigue siendo la pestaña central.

#### Lo que necesita atención

- **Compromisos.** Solo los gastos recurrentes activos que vencen hoy o en los próximos seis días, los dos más
  próximos, con «Ver todos» (Recurrentes). Sin nada esta semana, la sección no existe (antes mostraba el mes
  siguiente). Las filas son las de 24UX5 (marca de 40 pt, la fecha bajo el importe).
- **Una línea, a lo sumo.** En este orden: un presupuesto del mes excedido (el general antes que una categoría:
  «Superaste tu presupuesto de Ocio por $ 9.000,00.»), uno al 85 % o más («Te queda 12 % de tu presupuesto de
  Comida.»), o una categoría con el 40 % o más del gasto del mes, con al menos dos categorías («Comida concentra 46 %
  de tus gastos de este mes.»). Hechos calculados, nunca una causa ni un consejo, nunca de un mes incompleto o sin
  cotización. Un glifo en su tono (ámbar cerca del límite, coral pasado, el tono de la categoría) y una flecha: abre
  Presupuestos en la moneda del presupuesto o Reportes en la moneda de Inicio. Un presupuesto en otra moneda que la
  mostrada la nombra: el importe con su código, la proporción «… en ARS».

#### Barra de pestañas

- Cinco destinos, los mismos y en el mismo orden (Inicio, Movimientos, Asistente, Reportes, Más), sin cambio de rutas.
  La barra es una cápsula flotante de 62 pt, separada 16 pt de los bordes y apoyada en la parte alta del área del
  indicador de inicio, sobre el fondo de la pantalla. Se dibuja con el material de control de la app: Liquid Glass
  donde iOS lo dibuja y Reducir transparencia está apagado; si no, la superficie opaca con un filo fino (y una sombra
  suave en claro), el estado diseñado en iOS anteriores, Android y con Reducir transparencia.
- La pestaña elegida: glifo relleno y etiqueta en cobalto sobre una lente neutra (un estado, no un color); las otras
  en tinta secundaria (AA). Las etiquetas siempre visibles, a 10 pt como en la barra del sistema, hasta 1,3× con Dynamic
  Type y achicándose para caber en un iPhone angosto antes que cortarse («Movimientos» nunca termina en «…»), con el visor de contenido
  grande de iOS (una pulsación larga muestra la etiqueta grande, como en la barra del sistema); cada pestaña es un
  blanco de 48 pt; VoiceOver la lee como la barra de siempre: «Inicio, pestaña, 1 de 5» y «Seleccionado» en la actual.
- **Por qué sigue en el layout y no flota encima.** Una barra absoluta sobre el contenido obligaría a cada lista a
  reservar su alto, rompería el cálculo del compositor del Asistente y el teclado, y taparía la última fila con texto
  grande. La cápsula queda en el flujo: cada pantalla termina arriba de ella, y el compositor, el teclado y las áreas
  seguras funcionan como antes. No hay «+» flotante adicional.

## Producto 24UX6B — jerarquía de Reportes

Segunda entrega del carril UX de la decisión 005, en su rama desde master ef24bb6 (la PR #70, 24UX6A, ya mergeada).
Implementado en código; **la revisión en iPhone está pendiente** (no hubo build de EAS) y su lista está en
docs/mobile-device-checklist.md («Producto 24UX6B»). Solo cambian `app/(tabs)/reports.tsx`, el color de las barras
inactivas en `src/ui/charts.tsx` y sus textos. No cambió nada de contabilidad, cotizaciones, unidades menores,
presupuestos, el dominio, el esquema, las copias, las rutas, la navegación ni lo nativo; la mitigación de pantallas
negras del dock (sin fade/detach/freeze, sin fundido entre pestañas) quedó intacta. Inicio sigue mostrando solo el mes
en curso: los meses pasados viven en Reportes.

### El orden de lectura

Antes (hasta 24UX6A): el total, las barras de «Últimos seis meses» como primer gráfico, después Categorías | Día a
día, la dona y las filas. La historia tapaba el análisis del mes que la persona eligió. Ahora, de arriba abajo:

1. **Alcance y período.** El chip de moneda de visualización (solo con más de una moneda) y el mes con sus flechas y
   «Este mes». Sin cambios.
2. **El total del mes.** El eyebrow «GASTADO · ARS» con el botón de información de la metodología, el importe y una sola
   línea «{promedio} por día · {variación}».
3. **El análisis del mes.** El segmentado Categorías | Día a día (Categorías por defecto). En Categorías, la dona (sin
   cambios: «Otras» sigue agrupando por los primeros N, sin la regla del 3 %, sin selección de porciones
   *(→ la selección de porciones llegó en 24UX6C2, ver «Producto 24UX6C2 — actividad de Inicio e interacción de
   Reportes»)*) y debajo el
   encabezado **«Por categoría»** sobre las filas, que siguen abriendo el detalle de la categoría. En Día a día no hay
   dona: el encabezado **«Por día»** con la nota de siempre, «Solo días con gastos registrados.», sobre las filas de
   cada día, que siguen abriendo su detalle.
4. **La historia, debajo del análisis.** La sección **«Evolución»** (leyenda «Tocá un mes para verlo») con la tarjeta
   «Últimos seis meses». Las barras conservan su semántica: tocar una abre ese mes; no hay una segunda selección para
   comparar. Como ahora están debajo del análisis, al abrir un mes la lista vuelve arriba, a su título y su total
   (animado, o directo con Reduce Motion).
5. **Los detalles**, en el orden de antes: presupuestos (en su moneda, del libro real), «Dónde más gastaste» (sin
   toque), «Para tener en cuenta», ingresos y flujo neto, «Comparar con el mes anterior».

Cambiar entre Categorías y Día a día solo cambia el bloque 3; la historia y los detalles quedan debajo, en su lugar.

### La historia con un solo mes

Seis barras con una sola llena (un libro nuevo) no cuentan una evolución. Por eso:

- **Cuando el mes mostrado es el único de sus seis con gastos** (las seis barras siempre terminan en el mes mostrado),
  «Evolución» muestra en lugar de las barras una tarjeta tranquila con un glifo de barras: «Con más meses de gastos
  registrados vas a ver la evolución acá.» Hacia meses siguientes llevan las flechas y «Este mes», no las barras.
- **Sin barras ni nota** cuando ningún mes de los seis tiene gastos, o cuando falta una cotización (la regla de 24C1,
  sin cambios).

### Estados vacíos

Un mes sin gastos muestra el total cero en sus tintas de siempre (atenuarlo dejaba los centavos por debajo de 3:1), ningún encabezado huérfano («Por categoría» o «Por día» existen solo
con filas) y una sola tarjeta `EmptyState`:

- Categorías: «Sin gastos en este período» / «Los gastos que registres en esta moneda aparecen acá, por categoría.»,
  con el glifo de dona.
- Día a día: el mismo título con «Cada día con gastos en esta moneda aparece acá, con su total.», con el glifo de
  calendario.

Fuera de rango y sin cotización: los estados de siempre.

### VoiceOver y Dynamic Type

- **La línea del total es un solo elemento.** Antes VoiceOver la leía por partes (el promedio, el «·», la variación),
  con el símbolo y los dígitos agrupados de la región. Ahora la línea es un elemento cuya etiqueta usa
  números hablados: `spokenMoney` para el promedio y `spokenPercent` para la variación, en el idioma de la app; sin
  símbolo de moneda ni separadores leídos en voz alta. A la vista, el texto no cambió.
- Orden de VoiceOver: chip, mes y flechas, el total, la línea, el segmentado, la dona, las filas, Evolución, y después
  los detalles; es el mismo orden que la vista.
- «Por categoría», «Por día» y «Evolución» son `SectionTitle` (rol de encabezado, navegables con el rotor, como el
  resto de la app). La línea del total envuelve en lugar de cortarse; las filas son las mismas de antes.

### Contraste de las barras

Las barras de los meses no mostrados usaban el gris `inset`: 1,2:1 sobre su superficie en claro y 1,1:1 en oscuro, por
debajo del 3:1 que necesita la marca de un gráfico. Ahora `idleBarColor(p)` es la tinta terciaria al 70 % en claro y al
60 % en oscuro: 3,1:1 y 3,0:1 sobre `surface`, con prueba (≥ 3:1 en ambos temas). La barra del mes mostrado sigue siendo
la marca (`primary`), la única señal fuerte; el mes en curso sigue delineado, en tinta sobre una barra inactiva (el
borde secundario se perdía sobre el relleno nuevo) y en la tinta secundaria sobre la barra mostrada.

### El rojo, solo para alertas

En Reportes `expense` (el ladrillo) aparece solo en un presupuesto excedido y en su hecho de «Para tener en cuenta».
El gasto común (el total, las filas, las barras, la dona) es tinta o el tono de su categoría. Se verificó en el código;
no hizo falta cambiar nada.

### Motion

La dona se revela en sentido horario en 480 ms cada vez que aparece (al abrir Reportes y al volver a Categorías desde
Día a día; no es nuevo); un cambio
de mes o de moneda es un único fundido, del total (`ValueTransition`) y de la dona con sus porciones ya finales; las
barras interpolan en 260 ms (`data`), nunca desde cero. Lo único nuevo: tocar una barra desplaza la lista hacia
arriba, animado. Con Reduce Motion el desplazamiento es directo, la dona aparece terminada, las barras llegan
sin interpolar y queda solo el fundido. Las pestañas siguen cambiando al instante.

### Lo que queda para después (aprobado para 24UX6B, sin implementar)

La selección de porciones dentro de la dona (solo visual, dentro del reporte) *(implementada en 24UX6C2)*, el gráfico de
barras de Día a día y una cabecera fija sólida. Siguen permitidos para una pasada siguiente; no hay ruta de detalle por comercio. El orden
vinculante del roadmap no cambia: la próxima entrega de producto es 24T3; 24UX6C (Movimientos y Más) y 24UX6D
(Tarjetas) siguen a 24UX6B en el carril UX, y su lugar frente a 24T3 lo decide el dueño (ver `docs/mobile-roadmap.md`).

## Producto 25A-06 — activación del staging de la IA, fase A (sin cambios visuales)

Preparación del repositorio, en su rama `feat/producto-25a-06-staging-activation`: ninguna pantalla, color, texto
visible ni gesto cambia, y todas las builds siguen desconectadas. La identidad del entorno, los tipos de clave, los
scripts del dueño para staging y el runbook son del servidor y de la operación
([ai-staging-runbook.md](ai-staging-runbook.md)); ningún servicio se creó, configuró ni aplicó. Ninguna build apunta a
staging en 25A-06 (runbook §13): la conexión de una build es 25A-07, y Sign in with Apple es una entrega propia
([decisión 006](decisions/006-cloud-identity.md)).

- La línea de versión de Más dice «FinanzApp 0.1.0 (25A-06)». Nada que revisar en el iPhone ahora.
- Decisión A de B7 (rama `fix/25a-06-b7-overlong-names`): cuando el modelo copia un comercio o una categoría más largos
  que su límite (120 y 60 caracteres), el servidor deja ese dato vacío en vez de perder la propuesta; en el hilo aparece
  una nota informativa debajo de la respuesta (`SystemNote`, el mismo renglón calmo de las notas existentes, ícono de
  información, sin Reintentar), y la propuesta sigue su camino normal (tarjeta con «Falta completar», hoja de revisión
  con «Falta el comercio o concepto.», Editar). Nada nuevo de color ni de movimiento; el mensaje de la persona queda en
  el hilo tal como lo escribió.

## Producto 25A-05 — seguridad de la IA, contrato del proveedor y evaluación (sin cambios visuales)

Trabajo de servidor y de contrato, mergeado como PR #86 (rama `feat/producto-25a-05-ai-security-provider-foundation`): ninguna pantalla,
color, texto visible ni gesto cambia, y todas las builds siguen desconectadas. El protocolo cerrado v2 del Asistente, la
frontera del proveedor, los límites de costo y la evaluación son del servidor y del contrato
([production-plan.md](production-plan.md) §5 y §6); acá vale una sola regla de presentación para cuando el Asistente se
conecte (25A-07):

- **Fuera de alcance = solo texto.** Una respuesta `out_of_scope` se muestra como la prosa del modelo en el hilo, sin
  tarjeta, sin chips, sin enlaces y sin acciones. Nunca abre la hoja de revisión.
- **Los enlaces de una respuesta** siguen saliendo de la evidencia local citada; la intención de navegación del modelo
  solo cambia cuál va primero, nunca agrega uno.
- **Una aclaración** muestra chips solo para candidatos que son datos que el teléfono envió.
- La línea de versión de Más dice «FinanzApp 0.1.0 (25A-05)». Nada que revisar en el iPhone ahora.

## Producto 25A-04 — Asistente → hoja de revisión

El Asistente ya no registra nada por su cuenta. Cada propuesta suya se guarda primero como un ítem de revisión y, recién
entonces, se presenta **una hoja de revisión nativa** sobre el Asistente: se confirma ahí, sin salir. «Para revisar» es la
bandeja duradera para lo que queda pendiente, no un paso obligatorio.

- **La hoja** (`/review-sheet/[id]`): una hoja de iOS ajustada a su contenido, con la manija arriba (en tamaños de texto de
  accesibilidad abre a pantalla completa y se desplaza). Compacta y tranquila: «Confirmá el gasto», el monto, el comercio,
  y en filas Categoría, Cuenta o Tarjeta, Pago (en una tarjeta) y Fecha; lo que falta, nombrado, en gris; abajo
  **Confirmar** (la única acción lima, repite el monto), **Editar** (secundario) y **«Descartar propuesta»** como texto en
  el tono negativo, con su pregunta; al pie, «Si la cerrás, queda pendiente en Para revisar.»
- **Cerrar no es descartar.** La «X» («Ahora no»), deslizar hacia abajo o volver solo cierran la hoja: la propuesta queda
  pendiente, con «Revisar» en la tarjeta del chat, en Más → Para revisar y en el número de Más.
- **Editar** abre el editor de «Para revisar» sobre la hoja; al guardar vuelve a la hoja con lo editado.
- **La tarjeta del chat** es compacta: «Pendiente · Gasto», el monto (o «Sin monto»), comercio, categoría, dónde se
  registra, el pago en una tarjeta y la fecha (lo que falta dice «Falta completar», en gris), una línea («Lista para
  confirmar.», «Faltan 2 datos para confirmar.», ámbar si está desactualizada o interrumpida) y, mientras está
  pendiente, **una sola acción secundaria, «Revisar»**, que vuelve a abrir la hoja. No repite los controles de la hoja.
- **Lee el ítem, no el chat.** Lo editado es lo que muestran la hoja y la tarjeta; confirmada, la tarjeta muestra los
  valores registrados con «Registrado» y «Ver movimiento» (o «Ver plan»); descartada, «Propuesta descartada».
- **Guardando y error.** «Guardando la propuesta…»; si falla, «No se pudo guardar la propuesta. No se registró nada.» con
  «Reintentar»; la hoja solo aparece cuando la propuesta ya quedó guardada.
- **Fecha.** Si el pedido no dice fecha, es hoy (el día del teléfono al guardar la propuesta); una fecha dicha («ayer», «el
  2 de octubre») manda.
- **Vista de prueba:** la tarjeta se ve, dice que no se guarda, no abre la hoja y no tiene acciones.
- **Nuevo chat** borra la conversación, nunca una propuesta guardada.

## Producto 25A-03 — Para revisar

La primera interfaz sobre las propuestas guardadas en el dispositivo (25A-02). Sin rediseño: las piezas son las de
siempre (filas agrupadas, `DetailRow`, `LifecycleNote`, `ActionButton`, los selectores de un movimiento).

- **Dónde vive.** Más → Finanzas, una fila «Para revisar» primera (baldosa neutra de bandeja, «2 propuestas») mientras
  algo espera o hay una fila ilegible, y siempre en una build de desarrollo; si no, no está. La pestaña Más del dock lleva
  la cantidad pendiente en un círculo chico **blanco con grafito**: ni lima (la lima es el «+» de al lado) ni rojo (nada
  falló). Sin quinta pestaña y nada nuevo en Inicio.
- **La bandeja.** Las propuestas en el orden del almacén (la más vieja primero). Cada fila: el glifo del tipo, el comercio
  o «Sin comercio», el monto en su moneda o «Sin monto», «Gasto · categoría · cuenta o tarjeta», «día · cuotas · origen» y
  el estado. **Un borrador incompleto no es un error**: «Faltan 2 datos» va en gris secundario; «Revisala de nuevo» y
  «Registro sin verificar» en ámbar; solo «Ya existe otro registro» usa el tono negativo. Lo que falta dice «Falta
  completar», nunca un valor supuesto. Las filas ilegibles son una nota al pie, nunca filas.
- **El detalle** es la superficie que manda: una frase con lo que Confirmar registra (un gasto, un gasto en la tarjeta,
  un ingreso, o una compra en N cuotas que se suman al cerrar cada resumen, no hoy), los datos, «Para confirmar falta» con
  cada dato faltante como un paso, y la nota de desactualizada, interrumpida o en conflicto. **Confirmar es la única
  acción lima** (repite el monto); Editar y Descartar son secundarias. Confirmar se habilita solo si el dominio no
  encuentra faltantes y la base está al día.
- **Editar** usa los controles de un movimiento y **no elige nada por la persona**: el segmentado Gasto | Ingreso, el de
  «Pago» y el de la cantidad de cuotas se muestran sin selección (sin pulgar) hasta que se toca uno; nunca 12 por defecto.
  El monto se escribe en la moneda del destino; si la propuesta trae una moneda, solo se ofrecen cuentas en esa moneda.
  El selector de categoría ofrece solo categorías existentes (predefinidas, guardadas o en uso), sin «Usar …» para un
  nombre nuevo: una propuesta solo se confirma con una categoría que la persona ya tiene.
- **Descartar** pregunta antes («¿Descartar esta propuesta?») con el botón destructivo del sistema.
- **Monto de Inicio: grafito sólido.** El símbolo y los centavos dejaron de ser la tinta con transparencia (que sobre la
  lima se veía oliva) y pasaron a dos grises grafito neutros: `heroMoneySymbol` #3A3C3F y `heroMoneyCents` #505255, el
  símbolo más oscuro que los centavos, ambos legibles sobre la lima clara y la oscura. Los dígitos siguen en `heroInk`;
  tamaño, peso y diseño iguales; el resto de los montos de la app no cambia; el pulgar blanco de `Gastado | Disponible`
  tampoco.

## Producto 25VIS1 — Electric Lime, la paleta actual (sin rediseño)

En su rama `feat/producto-25vis1-electric-lime-palette` desde master 227942c (25DISC1 mergeada como PR #82; PR #83, sin
mergear). Empezó como una prueba de color sobre el producto existente; **el dueño la revisó en su iPhone, en claro y
oscuro, el 2026-10-03 y la conserva como la paleta actual del producto**, tal como está implementada y sin más ajustes
estéticos (ninguno de los conceptos PDF anteriores). Es la dirección visual elegida del producto, no un nombre, logo ni
identidad de marca pública terminados: la compuerta de nombre, marca registrada y similitud confusa sigue pendiente
([brand-brief.md](brand-brief.md) §3). Ninguna pantalla, layout, navegación,
información de Inicio, comportamiento de Tarjetas o Reportes, dominio, almacenamiento, esquema (14) ni backup (v14)
cambia. Inspirada en la exploración de Claude Design preferida por el dueño, no copiada: la estructura sigue siendo la
de Forest y la decisión 005.

**Arquitectura.** Un solo archivo de tokens, `apps/mobile/src/ui/palette.ts` (`lightPalette`, `darkPalette`), leído
por `usePalette()`. Forest se reemplazó token por token con **los mismos nombres**: no hay una segunda paleta ni tokens
Forest muertos; los valores de Forest quedan en el historial (master 227942c). Se
suman dos tokens: `toggle` (el riel de un interruptor encendido; la lima se tragaría la perilla blanca) y
`heroStatusBar` (el estilo de la barra de estado sobre el campo de Inicio: oscuro, porque la lima es clara). No hay
selector de tema ni cambio de tema en tiempo de ejecución; un futuro sistema de temas reemplazaría este archivo, nada
más. Los colores de categorías (`category-color.ts`, `@finanzapp/domain` appearance) y las caras de tarjeta
(`card-faces.ts`) son familias aparte y no se tocan.

**La paleta.**

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `background` | #F1F2EE | #0B0C0A | Lienzo: blanco mineral; casi negro neutro, no #000 |
| `surface` / `inset` / `elevated` | #FFFFFF / #E8E9E4 / #FFFFFF | #1A1C19 / #232622 / #2F322C | Grupos, campos, segmento elegido |
| `text` / `secondary` / `tertiary` / `line` | #131411 / #4A4D46 / #5E625A / #DFE0DA | #F1F3EC / #AAADA5 / #9A9D95 / #2A2D28 | Tinta grafito neutra |
| `primaryFill` / `onPrimary` | #C6F12E / #131411 | #C6F12E / #131411 | El botón lleno: lima con tinta |
| `primary` = `link` | #4A6100 | #C9E76B | La marca como texto: oliva-lima profundo en claro (7,0:1), lima suavizada en oscuro |
| `primarySoft` | #EEF5D6 | #20260F | Un susurro de marca (chip elegido del Asistente) |
| `toggle` | #4A6100 | #5C7A06 | Interruptor encendido, perilla blanca visible |
| `hero` / `heroInk` / `heroSecondary` | #C6F12E / #131411 / #3B4A12 | #B8E02A / #131411 / #3A4318 | El campo de Inicio y su tinta |
| `heroControl` / `heroThumb` / `heroThumbInk` | #A9D01B / #FFFFFF / #131411 | #9FC51C / #FFFFFF / #131411 | Chip de alcance, botón de cuentas, segmento elegido (pulgar blanco, el `surface` claro, con texto en tinta; igual en oscuro) |
| `accent` / `onAccent` | #C6F12E / #131411 | #C6F12E / #131411 | El «+» del dock y el círculo del Asistente |
| `dock` / `dockInk` / `dockActive` / `dockActiveInk` | #1D1F1B / #A9ADA3 / #3A3D37 / #FFFFFF | #20221E / #A9ADA3 / #3D403A / #FFFFFF | Dock grafito |
| `income` / `expense` / `warning` / `transfer` | #1F7A4F / #B3432E / #9A5B00 / #48606F | #5CCB93 / #EE8A72 / #E8A94A / #A3B5C4 | Semántica |
| `swipeDestructive` / `swipeNeutral` / `swipeAccent` | #B3432E / #5D6159 / #4A6100 | #B8412D / #50544D / #4E6600 | Acciones de deslizar, texto blanco |

La lima de partida de la exploración, #C6F12E (≈73°), se conserva literal: con tinta encima da 14,1:1 y se queda del
lado amarillo de un verde brillante (el #9FE870 de referencia está en ≈97°). En oscuro el campo de Inicio baja un
escalón (#B8E02A) para no encandilar en una superficie grande; el «+» y los botones conservan la lima plena.

**Dónde va la lima.** El campo financiero de Inicio (y su rebote superior); el «+» del dock; el botón lleno de cada
pantalla (Guardar, Empezar; siempre con tinta); la tarjeta del Asistente en el hub (lima, con su círculo de tinta (`heroInk`) y
chispa lima (`hero`), porque un círculo lima desaparecería sobre la lima); el círculo del Asistente vacío y su botón de enviar.
Como texto de marca (oliva-lima en claro, lima suave en oscuro): Cancelar / Listo de las hojas, «Ver todos», las
marcas de selección, el mes elegido en las barras de Evolución, la flecha atrás del encabezado.

**Dónde no va, a propósito.** El dock (grafito; solo el «+» es lima); **Próximos compromisos**, que queda en la misma
superficie neutra que Actividad reciente, sin lavado verde ni lima (lo fija un test); los colores de categorías, la dona
y su selección; las caras de tarjeta; los lienzos y superficies; el ingreso, el éxito, la alerta, lo vencido y lo
destructivo.

**Semántica, separada de la marca.** Un gasto es tinta (sin signo); un ingreso, el verde semántico con «+», a más de
60° de la lima y de otra luminosidad; una transferencia, pizarra neutra (≈203°, poca saturación); por vencer, ámbar;
vencido, destructivo o excedido, el rojo de alerta. La lima nunca significa éxito, ingreso, alerta ni error, y el color
nunca es la única señal (signo, palabra, glifo o cápsula acompañan). Los tests (`tests/theme.node.ts`) fijan la
ventana de tono de la marca (68–82°), la distancia de cada tono semántico a ella, la neutralidad de lienzos, tinta y
dock, el contraste de la tinta sobre cada campo lima y el de la perilla del interruptor.

**Oscuro.** Lienzo casi negro neutro (#0B0C0A, no negro aplastado) con superficies en escalones visibles; la lima
como campo y acento deliberados, no como texto por todas partes (el texto de marca es una lima suavizada); siempre
tinta, nunca blanco, sobre la lima.

**Dock.** Píldora grafito en ambos temas (su tinte de vidrio y su relleno sólido con Reduce Transparency), la pestaña
elegida en una cápsula más clara con el glifo blanco relleno, el «+» lima con «+» de tinta y su borde fino de tinta
sobre el lienzo claro. Geometría, franja, paso de toques, teclado, área segura y la mitigación de pantallas negras no
cambian.

**Marca, no Wise.** Electric Lime es una dirección de color, no una imitación de Wise: no se reproduce su pareja verde
brillante + verde bosque como sistema de marca, su logo, su tipografía, sus íconos, sus motivos de monedas globales,
sus textos ni sus composiciones. La revisión final de nombre, logo, marca registrada y similitud confusa sigue en la
compuerta de identidad de marca existente ([brand-brief.md](brand-brief.md)); esto no es una opinión legal.

**Paquetes de tema: candidato Pro de 25F antes del lanzamiento (decisión del dueño, 2026-10-04).** Electric Lime sigue
siendo el tema por defecto y la identidad actual. Paquetes opcionales como Forest y Sapphire se podrán elegir con el
mismo entitlement de Pro una vez que existan StoreKit y el paywall (roadmap, «Producto 25F»; app-store-launch.md §1.2).
Van después de la arquitectura central de IA y Apple (25A, 25A2, 25D), antes del lanzamiento si el calendario lo
permite y antes de la investigación opcional de sincronización con Mercado Pago. Cada tema pasa QA de claro, oscuro,
accesibilidad y color semántico antes del lanzamiento; no hay selector todavía.

**Veredicto del dueño (2026-10-03, iPhone físico, claro y oscuro): se queda.** Quedan como están el campo lima de
Inicio; el segmento no elegido de `Gastado | Disponible`; la jerarquía del importe (dígitos en tinta, símbolo de moneda y centavos como están); Próximos compromisos
neutro como Actividad reciente; el dock grafito y el «+» lima; colores de categorías, caras de tarjeta, el verde del
ingreso y la pizarra de la transferencia; los encabezados de fecha («Ayer · 2 oct»); las superficies clara y oscura.

**Pulido final aprobado por el dueño (2026-10-04, tras comparar el iPhone con el concepto de la paleta).** Solo cambia
el pulgar del segmento elegido `Gastado | Disponible`: de cápsula de tinta con texto lima a **pulgar blanco neutro con
texto en tinta** (`heroThumb` #131411 → #FFFFFF, el `surface` claro existente, sin un blanco nuevo; `heroThumbInk`
#C6F12E / #B8E02A → #131411, la tinta del campo), igual en claro y oscuro porque el campo sigue siendo lima clara en
ambos. Tinta sobre el pulgar 18,5:1; el pulgar contra la pista lima 1,8:1 en claro y 2,0:1 en oscuro, más claro que el
campo mientras la pista es más oscura. Pista, segmento no elegido, medidas, deslizamiento, háptica y accesibilidad no
cambian: la elección se lee también por el pulgar, el peso (semibold / medium) y `accessibilityState.selected`, no solo
por el color. **La jerarquía del importe queda igual a propósito:** el dueño conserva el símbolo de moneda y los
centavos más silenciosos, sin oscurecerlos. El círculo del Asistente en el hub, que tomaba `heroThumb` / `heroThumbInk`,
pasa a `heroInk` / `hero` con los mismos valores, así que no cambia.

**Pendiente en el iPhone:** el pulgar blanco nuevo; los puntos de la lista que el dueño no informó uno por uno (Reduce Transparency, el cambio
de la barra de estado al desplazar, el botón lleno sobre una hoja blanca, interruptores, formularios, Reportes, el
Asistente, VoiceOver, texto grande; docs/mobile-device-checklist.md, «Producto 25VIS1»).

## Producto 25DISC1 — descubrimiento competitivo y brief de marca (sin cambios visuales)

Solo documentación, en su rama `feat/producto-25disc1-competitive-brand-discovery` desde master d0a0be8 (25OPS1
mergeada como PR #81). Ninguna pantalla, paleta, ícono ni texto de la app cambia. Dos documentos nuevos:
[competitive-landscape.md](competitive-landscape.md) (la matriz de capacidades frente a Kesef, MonAi, Copilot, Monarch,
YNAB, Wallet, Piggy, Finy, Splitwise y MoneyCoach, leída de fuentes primarias el 2026-10-02; el mapa de brechas; las
decisiones y compuertas de investigación: Mercado Pago, conexiones bancarias, WhatsApp, gastos compartidos, períodos
de cobro) y [brand-brief.md](brand-brief.md) (el nombre público y la identidad original: «FinanzApp» es solo el nombre
de trabajo; criterios y flujo de nombres; el brief de exploración visual con tres o cuatro territorios genuinamente
distintos, Forest puede ser uno evolucionado; ningún nombre elegido, ninguna paleta cambiada en código). Para esta
guía valen dos cosas: la composición de Inicio, Reportes, Tarjetas, Más y la captura queda congelada mientras se
exploran identidades (la exploración cambia identidad, no composición), y ninguna capacidad se suma a Inicio por
paridad con un competidor. Nada que revisar en el iPhone.

**Decisión del dueño tras la segunda exploración de marca (2026-10-03).** La estructura Forest actual es la base
elegida (superficies iOS redondeadas, navegación, composición de Inicio, jerarquía de Reportes, interacción tipo
Wallet de Tarjetas, dock flotante, densidad de información); la exploración de marca no autoriza otro rediseño
amplio, y la pregunta abierta es color e identidad, no layout. **Inicio queda congelado: no se le agrega arco del
mes, línea de progreso del mes, «Día X de Y», ritmo de gasto ni otro gráfico mensual**; su jerarquía (importe,
Gastado / Disponible → próximos compromisos → actividad reciente) alcanza. El ritmo de gasto o el avance del mes
puede reconsiderarse más adelante en Reportes, el calendario o una superficie de análisis si aporta una decisión
financiera clara, nunca por verse bien en un tablero. Ninguna paleta está elegida (detalle en
[brand-brief.md §4.7](brand-brief.md)).

## Producto 25OPS1 — la última fila sobre el dock

Seguimiento de 25UX1, en su rama `feat/producto-25ops1-production-launch-plan`. Ningún cambio visual: el dock, su
geometría, el hub y las pantallas son los mismos. En la pasada del dueño en el iPhone (2026-10-02) el dock sin franja,
Tarjetas y Reportes quedaron bien, pero al final del scroll la última fila de Inicio, Reportes y Más quedaba en parte
detrás de la píldora y, tras un rebote, volvía a meterse debajo.

- **El final del scroll es layout.** El espacio que deja libre el dock es relleno inferior del contenido en todas las
  plataformas (`useDockInset` → `extraPadding`, sumado al relleno propio de cada raíz), ya no un inset nativo del
  scroller. Sin rebote, la última fila descansa arriba de la píldora con el aire de siempre: el relleno de la raíz más
  los 8 pt del dock (56 pt; 48 en Movimientos), con y sin indicador de inicio. No es un pie vacío: es exactamente la
  altura del dock sobre el borde de la ventana (`dockClearance`), contada una sola vez.
- **Un único invariante.** Lo aplican `Screen` (Más), `EntryList` (Movimientos), Inicio y Reportes; ninguna pantalla
  tiene un número propio, y una pantalla apilada, un modal o el hub siguen en 0.
- **El indicador de scroll** termina arriba del dock (iOS); se vuelve a afirmar después de cada teclado.
- **Pendiente en el iPhone:** todo lo anterior, VoiceOver en una lista larga y texto grande (lista en
  docs/mobile-device-checklist.md, «Producto 25OPS1»). *(Pasada del dueño del 2026-10-03: las raíces ya bajan lo
  suficiente y el contenido final queda visible arriba de la píldora, sin volver a meterse debajo. El indicador, el
  teclado, VoiceOver y el texto grande no se informaron y siguen abiertos.)*

## Producto 25UX1 — interacción del dock, Tarjetas y Reportes

Tres problemas que el dueño observó en el producto, mergeados como PR #80 (commit de merge d45eca6; rama
`feat/producto-25ux1-interaction-polish` desde master a1bd181); no es un rediseño ni reabre la línea visual de Forest. Las reglas quedan en la decisión 005 («Enmienda
2026-10-02 — Producto 25UX1»).

### El dock es el control

- **Sin franja.** La píldora de pino con las cuatro pestañas y el «+» aparte flotan sobre la pantalla: el dock se fija al
  borde inferior de la ventana, sin fondo propio; lo que se ve alrededor y entre los dos es el contenido que pasa por
  debajo (con vidrio, desenfocado por la píldora; con Reduce Transparency, la píldora opaca de siempre). Sus márgenes
  vacíos no toman toques.
- **La última fila sigue alcanzable.** Las raíces (Inicio, Movimientos, Reportes, Más) llegan al borde de la ventana y
  terminan su contenido la altura del dock más arriba (`dockClearance`, 88 pt con un indicador de 34), con el indicador
  de scroll arriba del dock: el mismo final que antes. Es un único inset (`useDockClearance`): una pantalla apilada, un
  modal o el hub valen 0 y quedan igual. *(Corregido el 2026-10-02 por 25OPS1: ese espacio es relleno del contenido, no
  un inset nativo; ver «Producto 25OPS1».)* Geometría, hub, teclado, blancos y VoiceOver del dock no cambian.

### Tarjetas: elegir antes de ver

- **En reposo.** Al entrar, ninguna tarjeta está elegida, aunque haya una sola: el mazo en su orden guardado, la última
  entera abajo, y una línea tranquila («Tocá una tarjeta para ver su saldo y sus movimientos.»). Ningún saldo, fecha,
  disponible, cuota, movimiento ni acción de otra tarjeta.
- **Primer toque.** Cualquier tarjeta, también la entera de abajo, se elige: va al frente con el movimiento del mazo
  (260 ms, interrumpible; con Reduce Motion, al instante) y aparece su resumen: **Saldo pendiente → Vence · Cierra →
  Disponible** (o «No calculado con cuotas» / «Sin límite cargado») **→ Pagar tarjeta → Recientes**. Una sola acción:
  Registrar es el «+»; las cuotas futuras y los planes, el detalle.
- **Segundo toque.** Tocar la tarjeta elegida abre su detalle. VoiceOver distingue: una tarjeta sin elegir dice
  «Selecciona esta tarjeta y muestra su resumen»; la elegida está «Seleccionada» y dice «Abre el detalle de la tarjeta».
- **Sin números viejos.** Al cambiar de tarjeta, el saldo, los hechos y los recientes de la anterior se van en el acto y
  los nuevos entran (sube o aparece); nunca se ven juntos.
- **El detalle.** La cara y los hechos del resumen arriba, las acciones, **Movimientos y después Cuotas**: los planes
  siguen a un toque, al final de la lista.

### Reportes: la categoría elegida sube

- Al elegir una categoría en la dona, su fila pasa a ser la primera de la lista mientras está elegida y **viaja** desde
  su lugar mientras las demás le hacen espacio (el movimiento de datos de la app, 260 ms, sin resorte); al limpiar la
  elección vuelve a su lugar; al elegir otra, la anterior vuelve y la nueva sube. Sigue marcada (borde y tinte de su
  color, nombre en negrita, «Seleccionada»).
- No cambia su rango: los importes, los porcentajes, la dona y su orden de VoiceOver son los del dominio; sin elección
  el orden es el canónico. La pista de VoiceOver de la fila elegida dice «Elegida en el gráfico: se muestra primero
  mientras está elegida».
- Un mes, una moneda o un modo nuevos limpian la elección y reordenan sin viaje; con Reduce Motion el orden cambia al
  instante; no hay desplazamiento automático de la página.

## Producto 25A-01 — modelo de borradores de revisión (sin cambios visuales)

La primera entrega enfocada del Asistente real (25A), mergeada como PR #77 (merge commit a4202bc) desde su rama
`feat/producto-25a-01-review-drafts` (desde master 399a1fa, 24T3 mergeada como PR #76). Solo dominio: `packages/domain/review-drafts.ts` define el **borrador de revisión**,
la propuesta tipada en la que va a terminar todo lo que proponga un movimiento (el Asistente, una captura de Wallet, una
bandeja futura). Un borrador no es un registro: lo que falta queda como un hueco explícito (tipo, importe, moneda,
destino, modo de compra, cantidad de cuotas, comercio, categoría, fecha), nunca se completa solo, y cuando está completo
y vigente produce exactamente una escritura: un movimiento, o un plan de cuotas con la cantidad que eligió la persona.

Para el diseño de las entregas siguientes (25A-03, la bandeja «Para revisar», y 25A2), esto ya queda fijado:

- Una tarjeta empieza en «Una vez»; las cuotas nunca traen una cantidad que la persona no eligió (el 12 del formulario
  de compra queda en el formulario).
- Una moneda que falta o que no es la de la cuenta es un hueco: no se toma la moneda por defecto ni se convierte.
- Una categoría que la persona no tiene (ni incorporada, ni definida, ni usada) es un hueco: un productor nunca crea
  una categoría; un nombre nuevo lo escribe la persona en el formulario.
- Si la cuenta, la tarjeta o la categoría cambiaron desde la propuesta, el borrador queda «para revisar de nuevo» y no
  escribe.
- En una tarjeta, el texto sigue diciendo «Saldo pendiente», nunca «Deuda».

No cambia ninguna pantalla: el Asistente sigue igual y no hay bandeja todavía. La línea de versión de Más dice
«FinanzApp 0.1.0 (25A-01)». Nada que revisar en el iPhone.

## Producto 24T3 — Devoluciones, adelanto de cuotas y ciclo de vida del plan

La última entrega de 24T, mergeada como PR #76 (merge commit 399a1fa) desde su rama
`feat/producto-24t3-refunds-payoff-lifecycle` (desde master d30b77f, 24UX6E mergeada como PR #75): una compra devuelta (la **devolución**), las cuotas que faltaban adelantadas (el **adelanto de
cuotas**), dejar de seguir un plan y reactivarlo, más un arrastre chico de Reportes. Implementado en código; **la
revisión en iPhone está pendiente** (no hubo build de EAS) y su lista está en docs/mobile-device-checklist.md
(«Producto 24T3»: el dueño mergeó después de un uso dirigido y postergó la pasada registrada; no se hizo, y por decisión
del dueño del 2026-10-04 queda diferida como bloqueo de lanzamiento: debe pasar antes del primer TestFlight externo o
público y antes de enviar a la App Store, no antes de mergear 25A o 25A2). No es un rediseño: Tarjetas y el detalle de tarjeta quedan como los
dejó 24UX6D; las pantallas nuevas usan las piezas de Forest que ya existen (modal de formulario, filas agrupadas,
`LifecycleNote`, `CheckRow`, `DateField`, `AmountField`). La regla contable vinculante está en la decisión 003, regla 7
(«Devoluciones, adelanto de cuotas y ciclo de vida del plan», 2026-10-01); el detalle técnico, en el roadmap
(«Producto 24T3»). Reemplaza, marcadas en su lugar, las frases de este documento sobre la única acción del detalle del
plan y el estado «Cancelada».

### Palabras

- **«Devolución»**, nunca «Reembolso» (es la categoría predefinida de ingreso; al elegirla, el formulario dice «¿Te
  devolvieron una compra? Registrala desde la compra con «Registrar devolución»: no es un ingreso.»). En inglés
  "Refund", y la categoría de ingreso pasó a "Reimbursements".
- **«Registrar devolución»** y **«Registrar adelanto de cuotas»**: la app registra, no actúa; nunca «Adelantar» ni
  «Devolver» como si FinanzApp moviera plata.
- **«Dejar de seguir el plan»** (el estado se lee «Sin seguimiento»; sus cuotas, «No se registra») y **«Reactivar
  plan»**. Nunca «Cancelar plan» ni «Cancelado»: en Argentina «cancelar» una deuda es pagarla.
- **«Adelantada»** ("Brought forward") para una cuota que cubrió un adelanto, **«No se cobró»** para la financiación que
  el emisor no cobró, **«Devuelta»** para una cuota que una devolución llevó a cero, **«Reducida por devolución: $ X»**
  bajo una cuota que bajó. **Nunca «pagada»** ni "paid": el pago a la tarjeta es su propia transferencia.
- Las vistas previas dicen **«con fecha …»**, nunca «ahora», y siempre «No es un ingreso» para una devolución.

### Pantallas

- **Detalle de una compra.** «Registrar devolución» solo cuando el dominio lo aceptaría (gasto vivo, cuenta viva, no
  una cuota, algo por devolver). Una sección «Devoluciones» con «Devuelto $ X de $ Y» y una fila por devolución (fecha
  escrita entera para VoiceOver) que abre la operación. Deshacer una compra con devoluciones se frena antes de la
  confirmación con «Esta compra tiene devoluciones» y «Ver devoluciones». Al editarla, el tipo y la cuenta quedan fijos,
  el monto no baja de lo devuelto y la fecha no pasa de la primera devolución, con una nota que lo explica.
- **Registrar devolución** (`/new-refund`, modal). Arriba la compra (precio, comercio, cuenta o tarjeta con su glifo,
  fecha, «Ya devuelto» si algo se devolvió); el importe con el atajo «Total disponible» (en un plan, «Hasta $ X: el
  precio; el interés no se devuelve desde acá»); la fecha entre la compra (en un plan, su piso) y hoy, cada día a las
  12:00 locales como en el adelanto (revisión: antes de mediodía, una compra de hoy daba un mínimo posterior al máximo);
  «Qué se registra»,
  la vista previa calculada por la misma función que guarda («Se acreditan $ X en Banco con fecha … y se restan de Ropa en
  octubre. No es un ingreso.»; en un plan, lo que vuelve a la tarjeta, «Las cuotas 11 a 12 bajan $ Y en total y no se
  registran por esa parte.» y «El interés de esas cuotas sigue como estaba.»; si no queda precio pero sigue el interés,
  lo dice y sugiere dejar de seguir el plan). Guardar repite el importe; sin nada por devolver, un estado vacío con la
  razón en lugar del formulario.
- **Registrar adelanto de cuotas** (`/plan-payoff/[id]`, modal). «Cuotas que faltaban · ARS» sobre el importe, las
  cuotas cubiertas («Cuotas 3–12») y una fila por componente («Importe», o «Principal de las cuotas», «Interés»,
  «Comisiones», «Impuestos de financiación»). Con financiación futura, dos `CheckRow` sin nada elegido: «Los registro
  ahora» y «El emisor no los cobró» (un cargo por adelantar se registra aparte, como gasto de la tarjeta); Guardar queda
  apagado hasta elegir. La fecha acotada entre el piso del plan y hoy. La frase «FinanzApp registra con fecha … las cuotas
  que faltaban ($ X) en el saldo pendiente de la tarjeta. El pago a la tarjeta se registra aparte, con Pagar tarjeta.»
  y, si hay cuotas deshechas, que siguen pendientes. Al terminar, «Adelanto registrado» con «Pagar tarjeta» (la
  transferencia hacia esa tarjeta, con tope en su saldo; el importe no se precarga) y «Listo».
- **Detalle de la operación** (`/operation/[id]`, push, solo lectura). Héroe: el glifo de devolución
  (`arrow-undo-outline`) o la marca del comercio para un adelanto, el importe sin signo en tinta y el estado
  («Registrada · resta del gasto, no es un ingreso», «Registrado · las cuotas restantes cuentan con esta fecha»,
  «Deshecha · no cuenta en saldos ni reportes»). Filas a la compra o al plan y a la cuenta o tarjeta, categoría, fecha;
  «Qué registra» con cada efecto (las cuotas reducidas, cada componente adelantado, «No se cobró», y que el pago se
  registra aparte). «Deshacer devolución» / «Deshacer adelanto» y sus «Restaurar» solo cuando la prueba en seco del
  dominio pasa; si no, una nota con la razón en lugar del botón. La confirmación dice qué cambia, las cuotas que se
  registran en sus cierres y «Este adelanto no podrá restaurarse» cuando corresponde.
- **Devolución de compra, no reintegro** (revisión del dueño, 2026-10-02). Bajo la compra, una nota de una línea con
  su ayuda contextual (`FieldNote` + `InfoButton`): «Devolución de compra: el comercio te devuelve toda o parte de esta
  compra.»; la ayuda dice «Usá esta opción cuando un comercio te devuelve total o parcialmente una compra. Si recibiste un
  reintegro, cashback o promoción bancaria en una cuenta, registralo como ingreso en esa cuenta.» Un reintegro, un
  cashback o una promoción del banco no es una devolución: es un ingreso en la cuenta que lo recibió (la pista de la
  categoría «Reembolsos» lo dice). La copia de 24T3 dice «devolución» para la operación; el código sigue con `refund`.
  La contabilidad no cambia: la devolución vuelve a la cuenta o tarjeta de la compra.
- **Eliminar una tarjeta que todavía tiene un monto** (revisión del dueño). Un saldo pendiente, un saldo a favor o
  cuotas pendientes no se borran (B3): un solo diálogo, «Todavía no se puede eliminar», nombra cada hecho («Esta tarjeta
  todavía tiene saldo a favor de $ X y cuotas pendientes.»), dice qué conserva archivar («Podés archivarla para sacarla
  de tus tarjetas activas sin perder el saldo ni el historial.») y ofrece **Cancelar · Archivar tarjeta** (con «Pagar»
  antes si hay saldo pendiente); archivar es la acción preferida y se hace ahí mismo. Una tarjeta ya archivada lo dice y
  no ofrece archivar. Una tarjeta creada por error, sin nada que la retenga, se elimina como siempre.
- **Detalle del plan.** Las acciones según el estado, cada una solo si el almacenamiento la aceptaría: activo,
  «Registrar devolución», «Registrar adelanto de cuotas» y «Dejar de seguir el plan» (o «Eliminar plan» si todavía no
  registró nada; nunca las dos); sin seguimiento, una `LifecycleNote` bajo el héroe («Las cuotas que faltaban no se
  registran…»), «Registrar devolución» mientras haya principal registrado por devolver y «Reactivar plan»; completo,
  «Registrar devolución» si queda algo. El estado en una palabra: «Activo», «Completo», «Adelantado», «Devuelto» o «Sin
  seguimiento». La alerta de dejar de seguir dice cuánto deja de registrarse, que lo registrado queda, que no es una
  devolución ni un pago, y antes, si hace falta, «Antes se registra la cuota 3, que ya cerró ($ X)»; la de reactivar
  nombra las cuotas que cerraron mientras no se seguía, su total y sus fechas. Cifras nuevas, cada una en su fila y solo
  si existe: «Cuotas adelantadas» / «Principal adelantado», «Interés no cobrado» / «Financiación no cobrada», «Devuelto a
  la tarjeta», «Cuotas reducidas por devolución»; «No se registra» reemplaza «Cancelado». «N de 12 registradas» cuenta
  las adelantadas.
- **Calendario.** «Adelantada» cuenta como registrada (segmento lleno en tinta); «No se cobró», «Devuelta» y «No se
  registra» van atenuadas con segmento punteado. Una cuota reducida muestra lo que cobra ahora y debajo «Reducida por
  devolución: $ X»; una adelantada cuyo interés no se cobró muestra solo lo reconocido y «Interés no cobrado $ X» (nunca
  más de lo que tiene el saldo). Las filas adelantadas y devueltas abren su operación, con su propia pista de VoiceOver.
- **Filas de movimientos.** Una devolución es «Devolución · comercio», el importe **sin signo, en tinta** (el «+» queda
  para el ingreso, regla de 24UX6C) y su glifo propio (`arrow-undo-outline`); un adelanto es «Adelanto de cuotas ·
  comercio» (con «· interés ·» en la línea de financiación). VoiceOver oye primero la palabra del tipo. Abren
  `/operation/[id]`. En Movimientos están bajo Todos y Gastos (nunca Ingresos) y la búsqueda las encuentra por
  «devolución» o «adelanto de cuotas».
- **Movimientos deshechos.** Una sección «Devoluciones y adelantos», una fila por operación deshecha (también una
  devolución que solo bajó cuotas y no tiene línea), con «Restaurar» solo si la prueba en seco pasa; si no, la razón.

### Cuando las devoluciones superan lo gastado

Una devolución resta en su mes y su categoría, así que un mes, un día, una categoría o un presupuesto pueden quedar en
cero o debajo. Nunca se dibuja un número negativo como si fuera gasto:

- **Dona.** Solo las categorías positivas, con porcentajes sobre su suma; el centro sigue siendo el total neto exacto
  (puede ser negativo). Una categoría en cero o debajo se lista al final con «Sin gasto neto», nunca dentro de «Otras»
  ni como «0 %». Un período sin ninguna categoría positiva no tiene dona: el total va en la línea compacta y debajo
  «Sin gasto neto en este período: las devoluciones igualan o superan lo gastado.»
- **Barras de meses.** La escala va de 0 al mayor neto positivo; una barra en cero o debajo se dibuja en cero,
  VoiceOver agrega «sin gasto neto» (solo si el mes tiene registros) y, cuando el mes elegido queda debajo de cero, una
  línea dice su neto exacto («septiembre: las devoluciones superan lo gastado (−$ 300,00)»), con su versión hablada.
- **Comparaciones.** Contra un período anterior en cero o debajo no se dice porcentaje ni crecimiento («Más gasto
  registrado»); la fila de variación se oculta.
- **Rankings y «Tu mayor gasto».** Los comercios netean sus devoluciones y los que quedan en cero o debajo salen; «Tu
  mayor gasto» muestra la compra neta de sus devoluciones.
- **Conteos.** Cuentan compras: «2 gastos registrados · 1 devolución»; una lista con solo financiación de un
  adelanto dice «N movimientos registrados».
- **Inicio y Presupuestos.** Gastado muestra el neto exacto; debajo de cero, una línea callada «Las devoluciones superan
  lo gastado», fuera del bloque del número. En Presupuestos, Gastado queda exacto y Disponible no pasa del límite, con
  la misma frase; un sublímite dice «Quedan $ Y de $ Y · las devoluciones superan lo gastado».
- **Detalle de una cuenta** (revisión). «Gastos este mes» es el neto de sus líneas de gasto, devoluciones incluidas; en
  cero o encima se muestra igual que siempre. Debajo de cero, el mismo dato se lee **«Devoluciones netas este mes»**
  ("Net refunds this month") con el exceso sin signo, en tinta: las palabras llevan el sentido, no un color ni un
  «−», y nunca es un ingreso. VoiceOver lo lee como un elemento: «Devoluciones netas este mes: las devoluciones
  superan lo gastado en …». El saldo, el libro y Reportes/Presupuestos no cambian; una tarjeta sigue en su propio
  detalle, que no tiene ese dato.
- Las notas de método de Reportes (moneda sola y consolidado) dicen que las devoluciones restan en su mes y su
  categoría.

### Reportes: el selector «Categorías | Día a día»

El control principal de Reportes lee al tamaño subhead: una variante `prominent` de `Choices` solo para él, etiquetas
de **15/20 pt**, semibold la elegida y medium la otra, segmentos de 40 pt en una pista de 44 pt, Dynamic Type hasta 1,3×
y **sin achicar para entrar** (en la nueva arquitectura de iOS el piso de ese achique es 4 pt, no `minimumFontScale`).
El pulgar, los colores, la háptica y VoiceOver no cambian; ningún otro `Choices` cambia.

### Lo que no cambia

Tarjetas y el detalle de tarjeta (solo arreglos de compilación), Deudas y cobros, la composición congelada de Reportes
salvo las guardas de arriba, Inicio salvo su línea debajo de cero, ninguna animación nueva (las barras conservan su
tiempo y saltan con Reduce Motion), nada nativo.

### Pendiente en iPhone

Todo, en la sección «Producto 24T3» de docs/mobile-device-checklist.md: la actualización a esquema 14 con copia antes,
devoluciones en efectivo, con tarjeta y de un plan antes y después de un cierre, el tope, adelantos con y sin interés y
Pagar tarjeta, dejar de seguir y reactivar, eliminar una tarjeta con saldo a favor o con un plan pendiente, deshacer y
restaurar, las filas, Reportes con una categoría debajo de cero y el selector a 375 pt en los dos idiomas con texto
chico, grande y AX, VoiceOver en las pantallas nuevas, claro y oscuro; la fecha de una devolución dada antes de
mediodía, «Devoluciones netas este mes» en el detalle de una cuenta y, solo como evaluación, la densidad de la raíz de
Tarjetas.

## Producto 24UX6E — Más destinos financieros en Forest

La última pasada del carril UX, en su rama `feat/producto-24ux6e-more-financial-forest` desde master 8f758ad (24UX6D
mergeada como PR #74): Cuentas, Presupuestos, Recurrentes, Deudas y cobros y Categorías llevados a la jerarquía y la
calidad de Inicio, Reportes y Tarjetas, y las utilidades de Más auditadas sin rediseñarse. Implementado en código; **la
revisión en iPhone está pendiente** (no hubo build de EAS) y su lista está en docs/mobile-device-checklist.md
(«Producto 24UX6E»). Solo presentación y ciclo de vida, más los errores reales que aparecieron: no cambia el dominio,
el almacenamiento, el esquema (13), las copias (v13), las cotizaciones ni nada nativo; Inicio, Reportes y Tarjetas
quedan como estaban (Tarjetas solo recibe la navegación después de eliminar). Reemplaza, marcadas en su lugar, las
frases de este documento sobre el importe con signo y el interruptor de Recurrentes, el ámbar de cualquier recurrente
de hoy o mañana, «Cuenta eliminada» en lugar de «Saldo registrado», el estado «Cerrada» del detalle de una deuda, el
orden del presupuesto general (número → barra → gastado / límite → estado), las filas archivadas atenuadas de
Categorías, el neto del día de Movimientos deshechos y las dos tarjetas pegadas de los selectores. La regla vinculante
está en la decisión 005 («Enmienda 2026-10-01 — Producto 24UX6E»). Con esta entrega **la línea visual amplia de Forest
queda cerrada**: otra pasada necesita evidencia del iPhone de una regresión concreta.

### Reglas comunes

- **El color marca el estado, nunca la dirección ni la identidad.** El tono de alerta (`expense`) solo para lo vencido,
  lo que pasó un límite, un saldo de verdad negativo o una acción destructiva; el ámbar (`warning`) para lo que vence
  pronto o un presupuesto del 85 % al 100 %; el color de una categoría solo en su tile de identidad.
- **Una nota de ciclo de vida, la misma en todos lados.** `LifecycleNote` (`src/ui/components.tsx`, la forma de
  `CardLifecycleNote` de Tarjetas, que no se tocó): un glifo secundario de 18 pt oculto para VoiceOver, un título
  opcional (subhead 600) y una línea footnote que dice qué sigue haciendo; sin superficie, sin banner, sin color de
  alarma. `tone="warning"` solo para un estado que pide revisión (un recurrente apartado), y entonces en las palabras,
  nunca en el glifo. La usan una cuenta eliminada, un recurrente pausado, cerrado o para revisar, una deuda cerrada y
  una categoría archivada.
- **Sin chevron en una fila que abre un editor modal** (un sublímite, una categoría): el chevron promete un push. Lo
  llevan las filas que empujan una pantalla (una cuenta); las filas de Recurrentes y Deudas siguen sin chevron (filas
  hermanas con deslizamiento). `ROW_CHEVRON = 28` (`src/ui/geometry.ts`, el chevron de 16 pt y su separación de 12 pt)
  es lo que una fila con chevron descuenta antes de decidir si apila.
- **Resúmenes planos sobre el lienzo.** Los resúmenes por moneda dejan su tarjeta con relleno (el pronóstico de
  Recurrentes, los totales de Deudas, el presupuesto general, los datos del mes de una cuenta); solo las listas
  agrupadas (`Surface grouped`) siguen siendo contenedores. Los filetes son `StyleSheet.hairlineWidth`, nunca 0,5.
- **Fechas dichas enteras.** Una fecha que VoiceOver lee sigue el patrón del panel de tarjeta: una palabra relativa
  («Hoy», «Ayer») queda igual; un día suelto se lee escrito («1 de octubre de 2026»), nunca «1 oct».

### Cuentas

- **Lista.** La cabecera de cada moneda es su nombre como encabezado (subhead 600, tinta, se achica si hace falta) y su
  total registrado al lado (15 pt, secundario; el tono de alerta y el menos solo si es negativo). Para VoiceOver es un
  solo encabezado que dice qué es la cifra: «Pesos argentinos, saldo registrado 1423,00 pesos». Con texto mayor que
  1,2× o cuando no entran juntos, el total baja bajo el nombre (`labelAmountStacks`); el dinero nunca se achica ni se
  corta.
- **Fila.** La marca, el nombre y el saldo, sin la línea «Cuenta · ARS» (toda fila de Cuentas es una cuenta de dinero y
  la sección ya nombra la moneda); el chevron cuenta al decidir si apila, así un saldo de siete cifras con centavos a
  375 pt baja bajo el nombre en lugar de achicarse.
- **Detalle.** Un bloque de estado plano (la forma de `CardStatusBlock`): la marca de 32 pt y «Saldo registrado · ARS»
  (footnote 500) sobre el saldo en 40 pt (en el tono de alerta solo si es negativo); después «Gastos este mes» (sin
  signo, en tinta, como «Gastos» de Recurrentes: 24UX6C deja el signo a saldos, netos y diferencias) e «Ingresos este
  mes» (con «+» en verde), sin superficie. Luego las acciones rápidas, la fila Recurrentes y los movimientos, como antes.
- **Cuenta eliminada.** Arriba, una `LifecycleNote` (papelera, «Cuenta eliminada» y la nota de siempre); el saldo
  conserva su rótulo «Saldo registrado · ARS» y los datos del mes siguen, como historia.

### Presupuestos

- **El presupuesto general**, plano sobre el lienzo con el ritmo de `CardStatusBlock` (20 pt entre grupos, 6 pt dentro
  del héroe): «Disponible» o «Excedido» (footnote 500, sin código de moneda) sobre el héroe de 40 pt **en tinta** en
  calma y en aviso, en el tono de alerta solo cuando se excedió; la barra de 6 pt con la proporción del dominio,
  limitada a la pista; justo debajo la línea de estado («60 % utilizado», «… · cerca del límite», «… · límite
  alcanzado», «… · excedido»; en el color de estado y 600 en aviso o excedido, con el glifo de alerta delante cuando
  se excedió); al final Gastado | Límite. El orden queda héroe → barra → estado → Gastado / Límite. VoiceOver oye la
  misma frase de resumen de antes.
- **Un sublímite** es la fila de presupuesto de Inicio un nivel más callada: el tile de la categoría (solo identidad:
  su tono nunca dice el estado), el nombre (500; sin tope de líneas cuando apila) junto al porcentaje como lo escribe
  Inicio (`formatPercent`: «1.235 %», no «1235 %»; en el color de estado, con el glifo de alerta cuando se excedió), una
  barra de 4 pt y una sola línea callada sin color: «Quedan $ X de $ Y», «$ X por encima de $ Y» o «Límite alcanzado ·
  $ Y». 64 pt de alto mínimo, filete fino, **sin chevron** (abre el formulario como modal); la pista «Abre el
  presupuesto para editarlo».
- **El encabezado del mes.** El estado y «Este mes» envuelven en dos líneas centradas con texto grande; «Este mes» va en
  el color `link` y llega a 44 pt con su margen de toque. «Además gastaste …» tiene su gemelo hablado.
- **El formulario.** «Eliminar presupuesto» es el botón destructivo de la app (secundario, tono de alerta, papelera);
  el título del mes y la nota de reintento en la escala tipográfica.

### Recurrentes

- **Próximos 30 días**, plano, un bloque por moneda, nunca sumadas: «Gastos · ARS» (antes «Pagos»: FinanzApp no paga
  nada) en su propia línea a ancho completo, 22 pt 700, cifra de fila y no héroe (una proyección es una estimación);
  después una fila con «Ingresos» (con «+» en verde; solo si algo entra) y «Vencimientos». Una proyección fuera del
  rango seguro se dice en una línea secundaria.
- **Filas.** El ámbar de «Hoy» / «Mañana» marca **solo un gasto**: un ingreso de mañana no es una obligación; «Revisar»
  sigue en ámbar para los dos. Una regla cuya cuenta o tarjeta se eliminó dice «Cuenta eliminada» o «Tarjeta
  eliminada» donde iría el día (tranquila, nunca ámbar; nunca «Revisar»), y VoiceOver oye la misma palabra. Abierta
  para una cuenta, la leyenda no repite la cuenta (la cabecera ya la nombra).
- **Detalle.** El estado del héroe nombra igual una regla cerrada. Justo debajo del héroe, una `LifecycleNote` sin
  título (la palabra de estado está arriba): cerrada, la nota de recuperación; pausada, que no registra nada hasta
  reanudarla; para revisar, desde cuándo no se registra, en ámbar. Las notas ya no empiezan con «Pausado: ». Para
  revisar, «Continuar desde hoy» y su único error siguen a la nota, en la primera pantalla; después los datos,
  «Registrados» y, al final, Pausar o Reanudar y Eliminar. VoiceOver lee la próxima fecha escrita entera.

### Deudas y cobros

- **El color marca el estado, no la dirección.** Los tiles son neutros (la flecha, la leyenda y la sección dicen quién
  le debe a quién) y los totales van en tinta: lo que debo no es un aviso y lo que me deben no es un ingreso. En una
  fila solo las palabras de estado toman tono: vencida en el tono de alerta (las dos direcciones); vence en tres días o
  menos en ámbar, solo en una deuda que debo (la ventana de «Vence» en Tarjetas). Una regla pura, `debtDueState`, para
  la fila y el detalle: cerrada → saldada → sin fecha → vencida → pronto → vence.
- **Totales.** Un bloque plano por moneda, sin tarjeta; una suma fuera del rango seguro, una línea.
- **Detalle.** La línea de estado con los mismos tonos; una deuda cerrada no la tiene: debajo del héroe, una
  `LifecycleNote` (archivo, «Deuda cerrada», «No cuenta como pendiente. Conserva su saldo y sus pagos; «Reabrir deuda» la
  vuelve a pendientes.»), que nunca dice que no se puede pagar. Los datos dejan Tipo y Estado (los dicen el rótulo y la
  línea de estado): «Vencimiento» solo cuando la línea ya no lleva la fecha (saldada o cerrada), «Nota» si existe, y la
  lista agrupada solo si tiene filas. La fila suma la pista «Abre el detalle de la deuda» y VoiceOver oye el día
  escrito entero.
- **Editar deuda** resume lo que no se puede cambiar (el tipo y la moneda), nunca el nombre que se está editando.

### Categorías

- **Filas** en la geometría de fila de Forest (16 × 12 pt, 64 pt de alto mínimo, filete fino), nombre en 500 que
  envuelve en tamaños de accesibilidad, **sin chevron** (editor modal).
- **Archivadas, sin atenuar.** La fila al 0,6 de opacidad bajaba su leyenda por debajo de AA: ahora el grupo, su leyenda
  y el «archivada» dicho llevan el estado. En Archivadas la leyenda empieza por el tipo («Gasto · …»), y VoiceOver lo
  dice («Regalos, ingreso, Predeterminada · editada, archivada»): el grupo mezcla los dos tipos.
- **Editor.** Una categoría archivada abre con su `LifecycleNote` («Archivada», qué conserva y cómo desarchivarla); la
  nota de cambio de nombre va bajo el campo Nombre (`FieldNote`). Una categoría histórica abre con el ícono que la app
  ya le dibuja.
- **Los editores modales sin nada que editar** (categoría, recurrente, presupuesto, deuda, cuenta) conservan su botón
  de cerrar.

### Utilidades de Más

Auditadas sin rediseñarse. Copia de seguridad, Importar copia, Idioma, Región, Apariencia y el hub de Más quedan como
estaban, salvo dos errores:

- **La tarjeta fijada** («Según el dispositivo», «Sistema» en Apariencia) se separa 20 pt (`space.xl`) de la tarjeta
  de opciones que la sigue: antes se tocaban y se veía el fondo en las esquinas interiores. Antes de un encabezado de
  sección no cambia nada (el encabezado ya trae su espacio).
- **Movimientos deshechos** no muestra el neto del día (ni lo dice VoiceOver): lo deshecho no cuenta en ningún saldo
  ni reporte (`EntryList dayNet={false}`). La explicación va en subhead y solo sobre una lista, nunca encima de «Nada
  para recuperar».

Pulido chico posterior, anotado en el roadmap: el apilado de acciones y los tamaños sueltos de Importar copia (UT-3),
la introducción de Copia de seguridad en la escala (UT-4) y el rótulo «Compartir copia» repetido en su tarjeta.

### Errores corregidos

- Presupuestos fallaba al abrir un mes mal formado («2026-13») o un mes cuya suma sale del rango seguro; ahora abre el
  mes actual o dice «No pudimos calcular este mes» con el selector de mes usable.
- Un presupuesto duplicado y un nombre de categoría tomado congelaban el formulario en un «Reintentar guardado» que
  nunca podía funcionar; ahora son errores editables, comprobados con las mismas reglas que el almacenamiento.
- Guardar sin cambios una categoría histórica la recoloreaba y le cambiaba el glifo en toda la app.
- Una deuda cerrada con fecha y saldo se veía «Vencida» en rojo en su detalle; una fila vencida teñía toda su leyenda.
- El pronóstico de Recurrentes se achicaba y se cortaba a 375 pt; el saldo de una cuenta se achicaba en lugar de apilar.
- Revisión antes del envío: el pronóstico de 30 días ya no proyecta un recurrente que sigue activo sobre una cuenta o
  tarjeta eliminada (datos viejos o importados; su fila dice «Cuenta eliminada» y la puesta al día lo saltea), y su
  detalle ya no anuncia «Próxima fecha»; archivar una categoría pasa por las mismas reglas de nombre que Guardar, así un
  choque es un error editable y nunca un «Reintentar guardado» sin salida.
- Después de «Eliminar cuenta» y «Eliminar tarjeta», la navegación vuelve a la lista con `dismissTo` (antes
  `dismissAll()` y `replace()`).

### Lo que no cambia

El dominio, el almacenamiento, el esquema (13), las copias (v13), las cotizaciones, cada saldo y cada regla de
presupuesto, recurrente y deuda; Inicio, Reportes (congelado) y Tarjetas (congelado; `CardLifecycleNote` intacta); el
texto de `debts.detail.explain`; ninguna animación nueva (las barras conservan el tiempo de datos, al instante con
Reduce Motion); nada nativo.

### Pendiente en iPhone

Todo: Cuentas con una y varias cuentas, saldos grandes y negativos, varias monedas y nombres largos; Presupuestos en
calma, 85 %, 100 % justo y excedido, con y sin general, importes muy grandes y otra moneda; Recurrentes con gastos e
ingresos activos, pausados, cerrados y para revisar, y el pronóstico a 375 pt con ≥ $ 1.000.000,00; Deudas vencidas,
a tres días, cerradas y los tiles neutros en oscuro; Categorías archivadas sin atenuar; la tarjeta fijada de Idioma,
Región y Apariencia en claro, oscuro y AX3; Movimientos deshechos sin neto; la vuelta a la lista después de eliminar
una cuenta o una tarjeta, también desde el detalle de una cuenta abierto desde un movimiento de Inicio. A 375 pt, con texto de accesibilidad, en claro
y oscuro, con VoiceOver, Reduce Motion y Reducir transparencia. Lista en docs/mobile-device-checklist.md.

## Producto 24UX6D — Tarjetas en Forest y pulido final de Inicio y Reportes

La pasada de Tarjetas del carril UX, en su rama `feat/producto-24ux6d-cards-forest` desde master 5c73813 (24UX6C2
mergeada como PR #73), con dos micro pulidos aprobados que viajan con ella: la composición de Categorías en Reportes y
la fila del presupuesto general de Inicio como fila de progreso. Implementado en código; **la revisión en iPhone está
pendiente** (no hubo build de EAS) y su lista está en docs/mobile-device-checklist.md («Producto 24UX6D»). Solo
presentación: no cambia la contabilidad de tarjetas, los pagos, los ciclos ni sus fechas, el reconocimiento de cuotas,
el principal comprometido, la compuerta del disponible, el ciclo de vida, el libro, las reglas de presupuesto, el
esquema (13), las copias (v13), las cotizaciones ni nada nativo; ninguna animación entre pestañas. Reemplaza, marcados
en su lugar: el KPI «Gastado · ARS» de arriba de Reportes con su promedio, el centro callado «Tocá una categoría» y la
fila textual del presupuesto («Usaste 87 % del presupuesto del mes») de 24UX6C2, y en Tarjetas los tres datos en
columnas dentro de una superficie (24T2). La regla vinculante está en la decisión 005 («Enmienda 2026-10-01 — Producto
24UX6D»).

*Refinamiento del dueño (2026-10-01), dentro de esta entrega:* la atención de presupuestos de Inicio cubre también los
presupuestos por categoría, hasta dos filas (ver «Inicio: atención de presupuestos (refinamiento)», que reemplaza la
semántica «solo el presupuesto general» de la fila de progreso); la selección de Tarjetas no cambia y queda razonada
(«Tarjetas: el mazo»); la composición de Reportes queda congelada («Reportes: congelado»).

### Reportes: Categorías con el total en el centro de la dona

- **Sin KPI externo.** Categorías ya no tiene «Gastado · ARS», el importe grande, el promedio por día ni la línea de
  variación arriba del análisis. El orden: la moneda y el mes → Categorías | Día a día → la dona → «Por categoría» →
  Evolución → presupuestos, comercios, observaciones, ingresos, flujo neto, la variación y Comparar. Todo lo de abajo
  y las rutas de detalle siguen.
- **El centro.** Sin elección, «Total del período» («Period total», footnote secundaria) sobre el total exacto del
  informe (`Money`, 700; `total={report.expenseMinor}`, la misma cifra de antes). Con una categoría elegida, el
  centro la muestra en lugar del total: su nombre, su importe exacto y «29 % del gasto» (la regla de 24UX6C2); la
  porción 6 pt más gruesa, las demás al 30 % y la fila marcada (más que color: negrita, contorno, estado seleccionado).
- **Geometría.** `donutGeometry(ancho)`: el 70 % de (ventana − 40 pt), entre 200 y 260 pt y nunca más ancho que el
  contenido, con el anillo fijo de 22 pt (`DONUT_RING`). A 393 pt la dona mide 247 pt; a 375 pt, 234 pt; a 320 pt,
  200 pt; desde 412 pt, 260 pt (antes 176 pt). El espacio para texto del agujero (`donutRoom`, tamaño − 2 × (anillo +
  10)) es 183 pt y 170 pt (antes 112 pt). El importe del centro baja de 26 a 24, 22, 20 y 18 pt hasta que el texto
  exacto entra (`centreAmountSize`): «$ 4.029.727,00» queda en 24 pt a 393 pt y en 22 pt a 375 pt (anchos estimados,
  no medidos).
- **Debajo de la dona.** Con texto mayor que 1,2×, un importe que no entra ni en 18 pt o un nombre que pide más de dos
  líneas, la lectura (el total o la categoría) baja debajo de la dona, sin tope y entera, en el paso más grande que
  entra en el ancho de la fila (escala hasta 1,8×); el agujero queda libre. El dinero exacto nunca se corta.
- **Cómo se limpia la elección.** Tocar la misma porción o el agujero; cambiar de mes, de moneda o de modo (como
  antes); y, nuevo, cambiar entre Categorías y Día a día, o tocar el espacio neutro alrededor del anillo. Ese espacio
  es la propia fila de ancho completo de la dona (una `View` con manejadores de toque, no un `Pressable` ni un elemento
  de accesibilidad): solo toma el toque mientras hay algo elegido, limpia solo con un toque que se mueve menos de
  10 pt y suelta el toque en cuanto la lista se desplaza. No hay interceptor global: ni el desplazamiento, ni el
  segmentado, ni los controles de mes y moneda quedan tapados.
- **VoiceOver.** Sigue siendo un elemento ajustable; sin elección su valor es «Total del período, 4029727,00 pesos»
  («Period total, …»), con una, la categoría, el importe y el porcentaje.

### Reportes: Día a día y lo que se movió

- **Día a día.** Una línea compacta, sin héroe ni promedio: «Total» en subhead secundario (la intención del dueño,
  «Total · $ …»; el período ya está nombrado arriba) y el importe exacto en 20 pt seminegrita al lado; si no entran
  juntos, el importe baja a su propia línea, entero. Cuando ni en su línea entra a 20 pt (13 dígitos, 320 pt, texto de
  accesibilidad), se dibuja como héroe que se ajusta a su línea: nunca se corta (revisión 24UX6D). Un solo
  elemento de VoiceOver («Total del período, 6,06 pesos»). En un mes sin gastos no aparece: queda solo el vacío.
- **La variación mensual.** Pasó a una fila de los hechos de abajo (`DetailRow`), entre «Flujo neto» y «Comparar con el
  mes anterior» (que sigue abriendo la comparación completa): «Frente a los mismos días del mes anterior» o «Frente al
  mes anterior», con «20,8 % menos», «12 % más» o «Sin cambio» y un glifo de tendencia; VoiceOver la oye con
  `spokenPercent`.
- **El botón de método** («Qué cuenta este reporte») está junto a la línea del período, en todo estado listo, con meses
  vacíos y en consolidado. La línea del período nombra la moneda («Hasta hoy · ARS») solo cuando no hay chip que la
  nombre (una sola moneda).
- **Textos.** Nuevas `reports.periodTotal` y `periodTotalSpoken`; `reports.delta.*` reescritas para la fila; salieron
  `reports.spent`, `noRecords`, `chart.pick` y `chart.noneChosen` (`reports.perDay` queda solo como ejemplo de
  `tests/translation.node.ts`).

### Reportes: congelado

Decisión del dueño (2026-10-01): la composición de Reportes de esta entrega (PR #74) es **vinculante** y no se reabre
sin una nueva decisión registrada en la decisión 005. *(Ampliada el 2026-10-02 por 25UX1, registrado en la decisión 005:
la fila de la categoría elegida se lista primera mientras está elegida; ver «Producto 25UX1».)*

- **Categorías:** período y alcance → Categorías | Día a día → la dona grande → en el centro, por defecto, el total
  exacto del período → con una categoría elegida, su nombre, su importe y su porcentaje en el centro → su fila marcada
  → Evolución → los hechos de abajo.
- **Día a día:** el total exacto compacto → el análisis por día → los hechos de abajo.
- **No vuelven:** el héroe «Gastado», un titular por día ni «Tocá una categoría».

### Inicio: la fila de progreso del presupuesto

- *(→ Refinamiento: desde el refinamiento del dueño, también los presupuestos por categoría, hasta dos filas, con
  `homeBudgets`, y `home-focus.ts` cambió; ver «Inicio: atención de presupuestos (refinamiento)», abajo. La anatomía de
  esta fila sigue vigente.)*
- **Semántica sin cambios** (24UX6C2): solo el presupuesto general; ausente por debajo del 85 %; aviso del 85 % al
  100 % inclusive; excedido por encima; en su propia moneda, elegido por `homeBudget`, que nombra la moneda cuando no
  es la de la vista; antes de «Próximos compromisos»; tocar abre `/budgets` con `currency` y
  `month`. Ni `app/(tabs)/index.tsx` ni `home-focus.ts` cambiaron.
- **Anatomía** (`BudgetAttentionRow`, `src/ui/home-modules.tsx`): `PressFeedback` con resaltado, rol botón, 64 pt de
  alto mínimo, 16 × 12 pt de relleno, chevron de 13 pt.
  1. «Presupuesto» (600, tinta; «Presupuesto · USD» cuando nombra la moneda) y, a la derecha, el porcentaje entero
     (`percentUsed`: «91 %», «120 %»; 600, cifras tabulares; ámbar en aviso, el tono de alerta excedido, con un
     `alert-circle` de 15 pt delante solo cuando excedido). Comparten línea solo si entran (`labelAmountStacks` con
     116 pt de cromo); con texto mayor que 1,2× siempre se apilan.
  2. Una barra de 6 pt (radio 3) sobre la pista `inset`, llena hasta `min(1, ratio)` en el mismo tono: a 120 % se ve
     llena, no desborda. Empieza en su valor (nada se anima al montar Inicio) y se mueve solo cuando cambia, con
     `timing('data')`, 260 ms; con Reduce Motion, al instante. Oculta para VoiceOver.
  3. Una línea callada (footnote secundaria): «Quedan $ 13.000,00», «Límite alcanzado» en el 100 % justo (sigue siendo
     aviso, ámbar) o «$ 20.000,00 por encima»; importes con código cuando la fila nombra la moneda. Nada se corta: el
     nombre y el detalle envuelven.
- **Más que color.** El aviso y el excedido se distinguen por las palabras («Quedan» / «por encima») y el glifo de
  alerta, no solo por el tono.
- **Copia.** es: «Presupuesto», «Presupuesto · {code}», «Quedan {amount}», «Límite alcanzado», «{amount} por encima».
  en: «Budget», «Budget · {code}», «{amount} left», «Limit reached», «{amount} over».
- **VoiceOver.** Un botón, armado solo con `spokenPercent` y `spokenMoney`: «Presupuesto del mes, cerca del límite,
  87 % usado, quedan 13000,00 pesos»; «Presupuesto del mes, límite alcanzado, 100 % usado»; «Presupuesto del mes
  superado, 120 % usado, 20000,00 pesos por encima» («Presupuesto del mes en ARS» cuando nombra la moneda). En inglés:
  «This month’s budget, close to the limit, 87% used, 13000.00 pesos left», «…, limit reached, …», «…, over the limit,
  120% used, 20000.00 pesos over». Pista «Abre Presupuestos» («Opens Budgets»).
- **Claves.** Salieron `home.budget.warning`, `warningIn`, `exceeded`, `exceededIn` (y las formas «de {limit}»);
  entraron `title`, `titleIn`, `reached`, `spokenName`, `spokenNameIn`, `warningLabel`, `reachedLabel` y
  `exceededLabel`.

### Inicio: atención de presupuestos (refinamiento)

Refinamiento del dueño (2026-10-01) dentro de 24UX6D; vinculante. Reemplaza «solo el presupuesto general» y «una sola
fila» (24UX6C2 y la fila de progreso de arriba). Inicio sigue **sin tarjeta permanente ni tablero de presupuestos**: lo
que tiene son, **como máximo, dos filas contextuales de atención**; todo lo demás vive en Presupuestos.

- **Qué presupuestos.** El presupuesto **general** del mes y los presupuestos **por categoría** activos del mes, solo
  con la regla del dominio `budgetState` (`BUDGET_WARNING_RATIO` 0,85): **tranquilo** por debajo del 85 %, nunca se
  muestra; **aviso** del 85 % al 100 % inclusive; **excedido** por encima del 100 %. `budgetAttentions(resumen)` aplica
  la regla a `summary.total` y a cada `summary.rows`; `homeBudgets(libro, presupuestos, monedas del historial, modo,
  moneda de la vista, mes)` (`src/ui/home-focus.ts`, puro) reemplaza a `homeBudget`.
- **Monedas.** Cada presupuesto conserva su moneda (24C1) y se mide con `summarizeMonthlyBudgets` sobre el **libro
  real** en esa moneda; nunca se convierte ni se suma a otra. Con «Solo …», solo la moneda mostrada; en consolidado, la
  moneda de visualización y cada moneda del historial. Una fila nombra su moneda (`labelsCurrency`) cuando no es la de
  visualización.
- **Cuántas.** Como máximo dos (`BUDGET_ATTENTION_ROWS = 2`), cortadas **después** de ordenar.
- **Orden (determinista).**
  1. Excedido antes que aviso.
  2. Dentro de un estado, el presupuesto general antes que los por categoría.
  3. Después, la proporción mayor primero (gastado / límite, la del dominio).
  4. Desempate estable: la moneda de visualización primero, después el código de moneda, después
     `categoryKey(categoría)` (sin acentos ni mayúsculas) y por último el id del presupuesto.
- **Ejemplos del dueño.**
  - General 90 %, Supermercado 97 %, Transporte 50 % → el general y Supermercado (los dos en aviso; el general primero
    por la regla 2; Transporte está tranquilo).
  - General 50 %, Supermercado 95 %, Transporte 88 % → Supermercado y después Transporte.
  - General excedido, una categoría excedida y varias en aviso → el general excedido y la categoría excedida.
  - Cinco categorías que piden atención → solo las dos primeras según el orden.
  - Ninguno pide atención → no hay nada de presupuesto en Inicio (ni superficie, ni título, ni vacío).
- **La fila.** La misma `BudgetAttentionRow` compacta de arriba. Título: el general, «Presupuesto» («Presupuesto ·
  USD»); una categoría, su nombre localizado (`useCategoryLabel`: «Supermercado», «Supermercado · USD» con
  `labelsCurrency`; clave `home.budget.categoryIn`), en tinta 600 como el general. El porcentaje entero (puede pasar de
  100 %), la barra limitada al 100 %, «Quedan $ …» / «Límite alcanzado» / «$ … por encima». **Solo los colores de
  estado** (aviso en ámbar; excedido en el tono de alerta con el glifo de alerta): el tono de la categoría **no** se
  usa, para que nunca compita con el estado.
- **VoiceOver.** Un botón por fila, armado solo con `spokenPercent` y `spokenMoney`: «Presupuesto de Supermercado,
  cerca del límite, 97 % usado, quedan … pesos»; «Presupuesto de Supermercado, límite alcanzado, 100 % usado»;
  «Presupuesto de Supermercado superado, 120 % usado, … pesos por encima»; con la moneda nombrada, «Presupuesto de
  Supermercado en USD, …» (claves `spokenCategory`, `spokenCategoryIn`). En inglés «Groceries budget, close to the
  limit, …». El general sigue diciendo «Presupuesto del mes». Pista «Abre Presupuestos».
- **Agrupadas.** Dos filas comparten **una** `Surface grouped`, con un filete fino entre ellas (la prop `last`: la
  última no lo lleva). Cada una abre `/budgets` con `{ currency, month }` del presupuesto; no hay ruta nueva.
- **Dónde.** Sin cambios: después del campo financiero y antes de «Próximos compromisos» y «Actividad reciente».
- **Lo que no es.** Ni tarjeta permanente, ni tablero, ni la lista de los sublímites, ni el color de la categoría, ni
  una cifra nueva: el dominio de presupuestos y sus cálculos no cambian.

### Tarjetas: el mazo

- **Siempre una al frente.** *(Reemplazado el 2026-10-02 por 25UX1: Tarjetas abre en reposo, sin tarjeta elegida; ver
  «Producto 25UX1».)* Con cualquier tarjeta activa hay una al frente; una selección que ya no existe (archivada
  o eliminada) le pasa el frente a la primera. Tocar una franja la elige (háptica de selección); tocar la del frente
  abre su detalle. Solo la elegida alimenta el resumen.
- **Por qué (vinculante; refinamiento del dueño, 2026-10-01).** Tarjetas es una pantalla de estado financiero: con una
  sola tarjeta, un toque más para ver su resumen sería pura fricción; con varias, la del frente ya comunica cuál está
  elegida. Si el resumen se siente denso, se refina su jerarquía; no se esconde información detrás de un toque.
- **La regla de franjas** (`deckExposure(escala, cantidad)`, `DECK_FULL_STRIP_CARDS = 4`): hasta cuatro tarjetas las
  franjas conservan 50 pt (57 en el tope de 1,3×); desde la quinta, todas miden 44 pt (16 de relleno + 22 de la
  primera fila + 6 de margen; 47 a 1,15×, 51 en el tope), nunca menos de 44 pt y con la primera fila siempre entera.
  Alto del mazo con 1/2/3/4/6 tarjetas: 211 / 261 / 311 / 361 / 431 pt a 375 pt y 223 / 273 / 323 / 373 / 443 pt a
  393 pt; seis tarjetas ahorran 30 pt y doce 66 pt. La misma regla para cualquier cantidad: sin segunda geometría,
  sin tarjetas ocultas, sin carrusel. El desplazamiento al elegir (`deckScrollTarget`) usa la franja según la
  cantidad.
- **Nombres largos.** `CardFace` recibe `nameLines`: la del frente y la del detalle muestran hasta dos líneas; una
  franja, una (nunca una segunda línea a medias bajo la tarjeta siguiente). La primera fila se alinea arriba y «••••
  4009» nunca se achica. VoiceOver siempre oye el nombre entero.

### Tarjetas: la jerarquía del resumen y del detalle

- **Un peso por nivel:** identidad (la cara) → «Saldo pendiente» → Vence · Cierra → Disponible → Registrar compra /
  Pagar tarjeta → «Cuotas futuras» → Recientes. Sin tarjetas blancas anidadas del mismo peso.
- **Bloque plano.** `CardStatusBlock` (`src/ui/card-panel.tsx`): el saldo y los datos sobre el lienzo, sin superficie
  propia (separación 20 pt; en Tarjetas los valores se funden y los datos se reacomodan al cambiar de tarjeta). La
  cara de arriba es el objeto; el bloque, su lectura.
- **Los datos.** Vence y Cierra comparten un `StatRow`; Disponible tiene su propia fila de ancho completo con la barra
  de uso. En tres columnas, un disponible de siete cifras en ARS no entraba en su tercio a 375 pt y se dibujaba más
  chico; ahora conserva el tamaño de fila y «No calculado con cuotas» se lee en una línea. Las fechas se siguen
  apilando con texto grande.
- **Superficies.** Las que quedan son listas agrupadas: «Cuotas futuras» y los movimientos. Recientes lleva un
  `SectionTitle` callado con «Ver todos» (`common.seeAll`, como en Inicio; salió `cards.panel.seeAll`).
- **Ciclo de vida.** En el detalle, bajo la cara, `CardLifecycleNote`: un glifo de archivo o papelera, el estado y lo
  que todavía hace, legible y tranquilo (sin color de alarma). Archivada: «Sigue recibiendo pagos y registrando sus
  cuotas. Para usarla de nuevo, reactivala en Editar tarjeta.» («It still takes payments and records its installments.
  To use it again, reactivate it in Edit card.»); eliminada: «Sus compras y pagos siguen en Movimientos…». Una
  archivada se sigue pagando y no tiene Registrar compra; una eliminada solo se lee (la lógica no cambió).

### Tarjetas: el detalle del plan

- **Héroe.** La marca, «Compra en cuotas · ARS», el precio, «12 cuotas sin interés» / «12 cuotas con interés» («12
  installments, interest-free» / «… with interest»), el estado.
- **La barra de progreso** (`PlanProgressSummary`, plana bajo el héroe, desde el puro `planProgress`): un segmento de
  8 pt por cuota hasta `PLAN_SEGMENT_MAX = 24` (4 pt entre segmentos hasta 12, 2 pt más allá); un plan más largo (hasta
  120) dibuja una barra continua. Los segmentos siguen los estados del Calendario: registrada en tinta, en parte en
  ámbar, deshecha `warningSoft` con contorno ámbar, próxima y futura con contorno terciario vacío, cancelada con contorno terciario punteado (revisión: el color de línea casi no se veía sobre el lienzo) *(→ 24T3: «Adelantada» llena en tinta como registrada; «No se cobró», «Devuelta» y «No se registra» punteadas)*; lleno frente a contorno distingue registrada de pendiente sin depender del color. Es
  dibujo: el sentido está en las palabras.
- **Vocabulario.** «3 de 12 registradas» («3 of 12 recorded»), del `figures.recognisedCount` del dominio; «Próxima
  cuota · fecha» y el principal que falta («restantes»; «principal restante» con interés) solo mientras el plan está
  activo, apilado bajo el conteo antes que achicarse. El dominio usa «reconocida» y «facturada» como sinónimos
  (`packages/domain/installments.ts`): nada separa lo facturado de lo reconocido, así que la pantalla dice solo
  registradas y futuras; nunca «X/Y pagadas», porque un pago de tarjeta no se asigna a una cuota. Importes exactos;
  interés, comisiones e impuestos solo cuando existen. Un solo elemento de VoiceOver.
- **Lista de datos.** Sale la fila del conteo (`recordedCount`, `recordedCountValue`); «Restante» aparece solo en un
  plan completo o cancelado (uno activo lo muestra en el progreso). El Calendario, `ScheduleRow` y la regla de
  eliminar (solo `summary.deletable`) no cambian. *(→ 24T3: el detalle suma las acciones por estado, las cifras de
  adelanto, no cobrado y devolución y los estados Adelantada, No se cobró, Devuelta y No se registra del Calendario;
  eliminar sigue siendo solo `summary.deletable`, que ahora también exige que el plan no tenga ninguna operación. Ver
  «Producto 24T3».)*

### Tarjetas: movimientos

Revisado sin cambiar código: en las listas de una tarjeta una compra o una cuota registrada se ve sin signo en tinta y
un pago es «Pago de tarjeta» en el tono de transferencia, sin signo (la regla de 24UX6C). «Cuota X de Y» sigue en el
detalle del movimiento, no en la fila.

### Lo que no entra

Ni los demás destinos financieros en Forest (24UX6E: Cuentas, Presupuestos, Recurrentes, Deudas y cobros y
Categorías), ni los filtros de Movimientos (cuenta, categoría, período y
período a medida junto al filtro por tipo y la búsqueda: pertenecen al alcance de búsqueda y productividad de 25C, con
sus búsquedas guardadas; no se envía un botón de filtro a medias), ni 24T3, notificaciones o el Asistente.

## Producto 24UX6C2 — actividad de Inicio e interacción de Reportes

Un pulido chico después de 24UX6C, en su rama `feat/producto-24ux6c2-home-activity-reports-polish` desde master c673be6
(24UX6C mergeada como PR #72, commit de merge c673be6). Implementado en código; **la revisión en iPhone está
pendiente** (no hubo build de EAS) y su lista está en docs/mobile-device-checklist.md («Producto 24UX6C2»). No cambió
nada del libro ni de la contabilidad, del esquema (13), de las copias (v13), de cotizaciones, tarjetas, cuotas ni
deudas; ninguna dependencia nativa; ninguna animación entre pestañas (la mitigación de pantallas negras del dock quedó
intacta); la paleta Forest no cambia. La regla de presentación de 24UX6C queda congelada: el gasto con el importe
guardado, sin menos y en tinta; el ingreso con «+» en verde; la transferencia sin signo en su tono; todo negativo
calculado conserva su menos. Reemplaza, marcadas en su lugar: «Actividad reciente» sin transferencias (24UX6A), el
horizonte de siete días de «Próximos compromisos» (24UX6A; ahora 30 días), el centro de la dona con «Total del período»
y el total, y el umbral de apilado solo por escala en las filas de categoría; y precisa «sin tarjetas de presupuesto en
Inicio» (24UX6A): sigue sin haber tarjeta permanente, pero existe una fila contextual del presupuesto general cuando
pide atención (abajo) *(→ refinamiento de 24UX6D: también presupuestos por categoría, hasta dos filas)*.

### Inicio: la actividad reciente incluye transferencias

- **Qué muestra.** «Actividad reciente» lista los gastos, los ingresos **y las transferencias** de este mes (del
  primero al último día del período) en la vista, del más nuevo: `homeRecent(entries, transfers, accounts, period,
  inView, limit)` (`src/ui/home-focus.ts`) filtra los dos y los une con `mergeActivity` (`src/ui/presentation.ts`):
  fecha descendente, después `createdAt` descendente, después la clave descendente, así el orden es siempre el mismo.
  El corte (`RECENT_ROWS`: cuatro con compromisos, seis sin ellos) se aplica **después** de unir, nunca por tipo.
- **Una transferencia, una fila.** Una transferencia es un solo registro y aparece una sola vez (no una salida y una
  entrada). Entra en la vista por su cuenta de origen: el dominio rechaza transferencias entre monedas distintas
  («Las dos cuentas deben tener la misma moneda»), así que los dos lados comparten moneda y la vista muestra los dos o
  ninguno. Las transferencias deshechas no llegan (el snapshot ya las excluye).
- **La fila.** `TransferRow` como en Movimientos: la leyenda «Origen → Destino · fecha», el importe sin signo en el
  tono `transfer`; VoiceOver «Transferencia, de X a Y, importe, fecha» (o «Transferencia, nota, de X a Y…» cuando una
  nota la titula); tocarla abre `/transfer/[id]`. Gastos e ingresos siguen siendo `EntryRow`; el nombre de la cuenta
  aparece con la regla de 24UX5 (solo cuando las filas visibles vienen de más de una cuenta; una transferencia cuenta
  por su lado real: el origen, o el destino cuando el origen es la cuenta oculta de una tarjeta o una deuda, como el
  cobro de una deuda).
- **Lo que no cambia.** Gastado y Disponible son sus propias cifras (`spendingFigure`, `availableFigure`) y no leen la
  lista: una transferencia nunca suma a Gastado. El tamaño y la alineación del importe, el lugar de «Total · ARS», el
  mes, «Ver todos» → Movimientos y los vacíos quedan como estaban.

### Inicio: la fila de atención del presupuesto general

Un refinamiento del dueño dentro de esta entrega. No es una tarjeta de presupuesto: es **una sola fila contextual**
que aparece solo cuando el presupuesto general del mes pide atención, y desaparece sola cuando no. *(→ Refinamiento de
24UX6D: también los presupuestos por categoría, hasta dos filas, con `homeBudgets`; «un sublímite nunca la muestra» y
«uno solo» quedan reemplazados; ver «Inicio: atención de presupuestos (refinamiento)».)*

- **Cuándo.** `homeBudgetAttention(summary)` (`src/ui/home-focus.ts`, puro) mira **solo el presupuesto general**
  (`summary.total`) con la regla del dominio, `budgetState` (`BUDGET_WARNING_RATIO` 0,85): tranquilo por debajo del
  85 % (no hay fila), **aviso** desde el 85 % hasta el 100 % inclusive, **excedido** por encima del 100 %. Sin
  presupuesto general activo para el mes, o tranquilo, devuelve `null` y la fila no existe. Un sublímite por categoría
  nunca la muestra, ni excedido. *(→ refinamiento de 24UX6D: ahora sí, en aviso o excedido)*
- **Qué presupuesto.** `homeBudget(libro, presupuestos, monedas del historial, modo, moneda de la vista, mes)`
  (`src/ui/home-focus.ts`, puro), con la regla de 24C1 de que un presupuesto conserva su moneda. Solo cuentan los
  presupuestos **generales**: un sublímite por categoría nunca convierte a una moneda en candidata. Con «Solo …», solo
  el presupuesto general de esa moneda; en consolidado, primero el de la moneda de visualización y después el de cada
  moneda del historial en el orden de agrupación: la fila es **el primero que está en aviso o excedido**, y **nombra su
  moneda** cuando no es la de visualización. Así un presupuesto tranquilo (o un sublímite) nunca esconde el excedido de
  otra moneda, y con dos que piden atención se ve uno solo, el de la moneda de visualización primero *(→ refinamiento
  de 24UX6D: hasta dos filas, con el orden de «Inicio: atención de presupuestos (refinamiento)»)*. Se mide con
  `summarizeMonthlyBudgets` sobre el **libro real** en la moneda propia del presupuesto: nunca se convierte ni se suma a
  otra moneda.
- **Dónde.** En un grupo propio (`Surface grouped`) después del campo financiero y **antes** de «Próximos compromisos»
  y «Actividad reciente»: lo accionable primero. Entra y sale con `Reflow` como los demás grupos.
- **La fila.** *(→ 24UX6D: ahora es una fila de progreso compacta, «Presupuesto» y «91 %», una barra y «Quedan $ …»;
  la semántica no cambia; ver «Producto 24UX6D — Tarjetas en Forest y pulido final de Inicio y Reportes»)* `BudgetAttentionRow` (`src/ui/home-modules.tsx`): `PressFeedback` con resaltado, rol botón, 60 pt de
  alto mínimo; un `GlyphTile` de 36 pt (aviso: `speedometer-outline` en el tono `warning`, ámbar; excedido:
  `alert-circle-outline` en el tono `expense`, el de alerta) y un chevron. Título en tinta, 600: aviso «Usaste 87 % del
  presupuesto del mes» («You used 87% of this month’s budget»; el porcentaje entero que muestran Presupuestos y
  Reportes, `percentUsed`, nunca con decimales); excedido «Superaste el presupuesto del mes» («You went
  over this month’s budget»); cuando nombra la moneda, «… del mes en USD» («… this month’s USD budget»). Detalle en
  footnote 500, ámbar (`p.warning`) en aviso y el tono de alerta (`p.expense`) en excedido: «Quedan $ 15.000,00 de
  $ 100.000,00» («… left of …») o «$ 4.000,00 por encima de $ 100.000,00» («… over …»); los importes con
  `moneyText`, o con su código (`codedAmount`) cuando la fila nombra la moneda. El ámbar sigue en el 100 % justo; el
  tono de alerta es solo para lo que pasó el límite.
- **VoiceOver.** Un solo elemento: el título hablado (`spokenPercent`) más «, » y el detalle hablado (`spokenMoney`);
  pista «Abre Presupuestos» («Opens Budgets»). *(→ 24UX6D: «Presupuesto del mes, cerca del límite, 87 % usado, quedan
  …»; ver «Producto 24UX6D — Tarjetas en Forest y pulido final de Inicio y Reportes»)*
- **Tocar.** Abre Presupuestos en la moneda y el mes del presupuesto (`/budgets` con `currency` y `month`).
- **Textos.** Nuevas claves `home.budget.warning`, `warningIn`, `exceeded`, `exceededIn`, `left`, `over` y `hint`, en
  español y en inglés *(→ 24UX6D: las cuatro primeras salieron; `left` y `over` ya no dicen «de {limit}»)*; el candado del inglés se volvió a aceptar.
- **Lo que no es.** Ni tarjeta permanente, ni presupuestos por categoría *(→ refinamiento de 24UX6D: un presupuesto
  por categoría puede ser una de las dos filas de atención)*, ni la línea de atención de la primera
  iteración (`HomeInsightRow` no vuelve), ni una cifra nueva: no cambia el dominio de presupuestos ni cómo se calculan.

### Inicio: la regla mínima (para entregas futuras)

Inicio muestra solo el campo financiero, la atención de presupuestos cuando la hay (hasta dos filas: el general y los
por categoría, desde el refinamiento de 24UX6D), los compromisos cercanos cuando existen y la actividad reciente.

- **«Próximos compromisos» es condicional:** solo reglas recurrentes **de gasto** activas y no borradas, en la vista,
  cuya próxima fecha cae en una **ventana móvil de 30 días** desde hoy (`COMMITMENT_WINDOW_DAYS`, reemplazó al
  horizonte de siete días): desde hoy hasta hoy + 30 días, **los dos extremos incluidos** (`nextDateISO >= hoy` y
  `nextDateISO <= addDaysISO(hoy, 30)`; el 2026-10-01 la ventana va del 2026-10-01 al 2026-10-31). Es el mismo límite que
  el pronóstico «próximos 30 días» de Recurrentes (`recurringForecastByCurrency`). Una diferencia es deliberada: una
  regla cuya próxima fecha ya pasó espera revisión en Recurrentes y no se lista en Inicio (el pronóstico sí cuenta su
  próxima ocurrencia).
  Nunca es «el mes calendario». Se ordenan por fecha, después por comercio (`localeCompare`) y después por id, y recién
  entonces se cortan a dos (`COMMITMENT_ROWS`); sin ninguna en la ventana, la sección no existe. Lo demás vive en
  Recurrentes («Ver todos»). Un ingreso recurrente nunca se muestra como compromiso; tampoco resúmenes de tarjeta,
  cuotas ni pagos de deudas.
- **Presupuesto: sin tarjeta permanente ni tablero, con hasta dos filas contextuales.** Inicio **no** tiene una tarjeta
  de presupuesto permanente (ni la «Presupuesto del mes» de antes ni una lista de sublímites) ni un tablero de
  presupuestos. Sí puede tener **hasta dos** filas de atención: el presupuesto general y los presupuestos por categoría
  cuando `budgetState` dice aviso o excedido, con el orden, las monedas, el título y la tinta de «Inicio: atención de
  presupuestos (refinamiento)» (24UX6D); tranquilos, no hay nada. *(Antes del refinamiento de 24UX6D: una sola fila, solo
  del presupuesto general.)*
- **No van en Inicio:** rankings, una tarjeta permanente de presupuesto, un tablero o una lista de presupuestos por
  categoría (un presupuesto por categoría aparece solo como una de las dos filas de atención), una línea de
  atención calculada ni un módulo permanente de recurrentes. Una visibilidad más amplia de lo que viene es trabajo del
  calendario y de las notificaciones futuras (las notas de 24UX6A y 25D), no de Inicio.

### Reportes: el total arriba y la dona para elegir

- **El total, una vez.** El KPI de arriba («GASTADO · ARS», el importe y su línea) sigue en Categorías y en Día a día.
  El centro de la dona ya no repite el total del período (antes «Total del período» y el mismo importe). *(→ 24UX6D:
  el KPI y su promedio salieron; el total vive en el centro de la dona en Categorías y en una línea compacta en Día a
  día; ver «Producto 24UX6D — Tarjetas en Forest y pulido final de Inicio y Reportes»)*
- **El centro.** Sin elección, una nota callada en footnote: «Tocá una categoría» («Tap a category») *(→ 24UX6D:
  sin elección el centro muestra «Total del período» y el total exacto; la dona creció a 200–260 pt y el importe
  baja de 26 a 18 pt hasta entrar)*. Con una
  categoría elegida: su nombre (footnote seminegrita), su importe exacto (`Money`, 18 pt desde 176 pt de dona, si no
  16 pt; peso 700; centrado) y «29 % del gasto», con el mismo porcentaje que su fila (`spendingShare` sobre el gasto
  del informe). Los textos del centro se limitan a 1,2× de Dynamic Type; cuando el importe elegido no entra en el
  agujero (texto más grande que 1,2× o un importe muy largo), la lectura (nombre, importe, porcentaje) baja debajo de la
  dona, entera, y el agujero queda libre: el importe nunca se corta. El centro y esa lectura son solo para la vista;
  VoiceOver los oye una vez, como valor del elemento ajustable.
- **La porción elegida.** Se dibuja 6 pt más gruesa (`CHOSEN_EXTRA`) y las demás al 30 % de opacidad; el radio del
  anillo deja lugar para el trazo más grueso. La fila de la leyenda queda marcada: nombre en 700, un contorno de 1,5 pt
  en el tono de la categoría con 14 pt de radio, un tinte del 8 % de ese tono y `accessibilityState.selected`.
- **Tocar.** Una porción la elige; tocar la porción elegida o el agujero la quita. El toque se resuelve por geometría
  (`sliceAt`, puro, exportado con `donutArcs`): el anillo con 10 pt de margen, el ángulo desde las doce en sentido
  horario; un hueco entre porciones cuenta como la porción siguiente; el agujero o afuera, ninguna.
- **VoiceOver.** La dona es un elemento ajustable: nombre «Gasto por categoría: Comida 40 %, …», valor «Ninguna
  categoría elegida» *(→ 24UX6D: «Total del período, …»)* o «Supermercado, 412760,40 pesos, 29 % del gasto» (importe y porcentaje hablados), pista
  «Deslizá hacia arriba o hacia abajo para elegir una categoría»; deslizar recorre las porciones en orden (hacia abajo
  desde ninguna empieza por la última) y, pasado cualquiera de los extremos, vuelve a ninguna. Las dos acciones llevan
  nombres traducidos («Categoría siguiente», «Categoría anterior») para el rotor de Acciones, y un doble toque de
  VoiceOver no borra la elección.
- **El alcance de la elección.** La elección vale para un mes, una moneda y un modo de visualización: cualquier cambio
  de ellos la borra, venga de Reportes, de un enlace o de la moneda elegida en Inicio (que Reportes comparte), y volver
  después no la trae de vuelta; si la categoría ya no es una porción, tampoco se muestra. Las filas siguen abriendo `/report-category`.
- **Motion.** Nada nuevo: el grosor y la opacidad cambian de una vez; el barrido inicial de la dona y el fundido de
  datos siguen igual, y Reduce Motion también.
- **Textos.** Nuevas claves `reports.chart.byCategory`, `pick`, `pickHint`, `noneChosen`, `chosen` y `share`; salió
  `reports.periodTotal`. El candado del inglés se volvió a aceptar.

### Filas de categoría: nombres largos con importes grandes

Antes una fila de categoría se apilaba solo con texto grande (escala mayor a 1,2) o con un importe largo; un nombre
como «Supermercado» junto a un importe grande podía partirse dejando una letra suelta. Ahora:

- `labelWidthEm(text)` (`src/ui/geometry.ts`) estima por exceso el ancho de un nombre en ems (espacio 0,28;
  puntuación fina, «i», «l» 0,3; mayúsculas, dígitos, «m», «w» 0,68; ideogramas, kana, hangul y formas de ancho completo
  1; emoji 1,25, contando una secuencia con unión una sola vez; marcas combinantes 0; el resto 0,54; × 1,04 de margen) y
  `labelAmountStacks(ancho, escala, nombre, importe)` decide si el nombre y el importe entran juntos en la columna de
  texto.
- `useCategoryRowStacks` (`src/ui/spending-chart.tsx`) = la regla del importe de siempre (`useStacked`) **o**
  `labelAmountStacks`, descontando el chevron (15 pt) y su separación (12 pt). La usan `CategoryLegendRow` (Reportes)
  y `CategorySpendingRow`.
- **Apilada:** columna; el nombre sin límite de líneas y, debajo, el importe y su porcentaje juntos, alineados al
  inicio. Con texto grande se apila siempre, como antes.

### Lo que sigue

24UX6D (Tarjetas en Forest) sigue en el carril UX; el orden de producto (24T3, 25A, …) no cambia. *(→ implementada:
ver «Producto 24UX6D — Tarjetas en Forest y pulido final de Inicio y Reportes»; después viene 24UX6E, más destinos
financieros en Forest: Cuentas, Presupuestos, Recurrentes, Deudas y cobros y Categorías.)*

## Producto 24UX6C — presentación de movimientos, Inicio y Más

Tercera entrega del carril UX de la decisión 005 (enmendada el 2026-10-01: «Enmienda 2026-10-01 — Producto 24UX6C»), en
su rama `feat/producto-24ux6c-movements-more-polish` desde master ecfd1dc (24UX6B mergeada como PR #71). Implementado en
código; **la revisión en iPhone está pendiente** (no hubo build de EAS) y su lista está en
docs/mobile-device-checklist.md («Producto 24UX6C»). Solo presentación: no cambió nada de contabilidad, del signo del
libro, de los importes guardados, del esquema (13), de las copias (v13), de cotizaciones, tarjetas, cuotas, deudas ni de
la materialización de recurrentes; ninguna dependencia nativa; ninguna animación entre pestañas (la mitigación de
pantallas negras del dock quedó intacta). Reemplaza, marcadas en su lugar, estas reglas de 24UX6A: «un gasto es tinta
con signo menos», la transferencia en tinta secundaria neutra, el subrenglón de Inicio bajo el número, las tres filas
neutras de la hoja de Registrar, el «+» de la cabecera de Movimientos; y de Producto 21, el micrófono del compositor y
la leyenda «No conectado».

### Cómo se muestra el importe de un movimiento

El signo de presentación no es el signo contable. El libro guarda magnitudes positivas más un tipo; una fila cuyo tipo
ya se dice (glifo, leyenda y, para VoiceOver, «Gasto», «Ingreso» o «Transferencia») no lo repite con un signo.
`presentedAmount(kind, storedMinor)` (`src/ui/movement-amount.ts`, puro) devuelve el importe guardado sin tocar (sin
valor absoluto), un signo solo para el ingreso y el tono del tipo:

| Tipo | Importe | Signo | Tinta |
| --- | --- | --- | --- |
| Gasto | El guardado | Ninguno | Tinta (`Money` con tono `expense` dibuja `text`): un gasto es el caso normal, nunca una alarma |
| Ingreso | El guardado | «+» | `income`, el verde de ingreso |
| Transferencia | El guardado | Ninguno | `transfer`, el azul petróleo |

- **Dónde.** `EntryRow` y `TransferRow` (`src/ui/components.tsx`) en todo contexto: antes una transferencia llevaba
  ± en el contexto de una cuenta y tinta forzada fuera de él; ahora siempre el importe guardado, sin signo, en
  `transfer`. El héroe del detalle de un movimiento (`app/entry/[id].tsx`), las filas de Recurrentes
  (`app/recurring.tsx`) y el héroe del detalle de una regla (`app/recurring/[id].tsx`) siguen la misma regla («+» solo
  para un ingreso), y la tarjeta de borrador del Asistente muestra «+» en un borrador de ingreso.
- **VoiceOver.** Cuando una nota titula una transferencia, la etiqueta empieza con la palabra «Transferencia» y ya no
  repite la nota.
- **Lo que conserva su signo.** Todo signo calculado: un saldo negativo de cuenta, el neto del día en las cabeceras de
  Movimientos («−» / «+»), el flujo neto, las diferencias, los saldos de tarjeta y de deuda, el exceso de un
  presupuesto y las filas de evidencia del Asistente. Una cuenta, una tarjeta o una deuda muestran las filas con la
  regla nueva y su saldo negativo con su menos. *(→ 24UX6E: Movimientos deshechos no muestra el neto del día: lo
  deshecho no cuenta en ningún saldo ni reporte.)*

### El tono de transferencia

`transfer` deja de ser la tinta secundaria (con la que una transferencia se confundía con un texto apagado) y pasa a un
azul petróleo sobrio, bien separado del pino de la marca:

| Token | Claro | Oscuro |
| --- | --- | --- |
| `transfer` | #2D6476 (6,6:1 sobre blanco) | #8FC3D2 |
| `transferSoft` | #E2EDF1 | #132830 |

Unos 194°, saturación ≤ 0,45. Queda fuera de la ventana de Forest a propósito: esa ventana rige la marca, no la
semántica. `tests/theme.node.ts` exige 185–210°, saturación ≤ 0,5 y que sea distinto de `secondary`.

### Movimientos

- **Sin «+» en la cabecera.** Registra el «+» del dock, el mismo desde cada pestaña; no hay un segundo botón de
  registro en ninguna raíz.
- **Búsqueda.** Un `SearchField` compartido (`components.tsx`): una píldora de 44 pt sobre `surface` con hairline, la
  lupa, el botón nativo de borrar, la etiqueta «Buscar movimientos» y el marcador «Comercio, categoría o cuenta» (entero a
  375 pt); lee `speechLanguage`. La búsqueda busca lo mismo que antes.
- **Ritmo.** La línea del conteo en secundario, tamaño footnote; con VoiceOver, al cambiar el filtro se anuncia el nuevo
  conteo, y al escribir después de una pausa breve (`AccessibilityInfo.announceForAccessibility`: iOS no tiene regiones
  vivas); las cabeceras de día en
  tinta, subhead seminegrita (antes secundario footnote), con el neto del día en secundario y su signo.
- **Sin cambio.** Los filtros (el filtro por tipo y la búsqueda), la agrupación por día, los totales del día, las rutas
  de detalle, Deshacer y Recuperar.
- **Estado vacío.** El tile del glifo de `EmptyState` usa el tinte de la marca (`GlyphTile` con `p.primary`) para que
  se vea; también mejora el vacío de Inicio.

### Inicio

- **Sin subrenglón.** Ya no hay «Hasta hoy · … por día», «Sin gastos este mes» ni «Saldo registrado · N cuentas» bajo
  el número: el número y Gastado | Disponible bastan; el promedio diario vive en Reportes.
- **La ayuda junto al número.** Con una moneda, el ⓘ va al lado del número: Disponible siempre tiene su explicación;
  Gastado, solo la de la conversión cuando hay conversión. Con dos monedas o más, el chip y su ayuda siguen en la fila
  de alcance, en el mismo lugar y con la misma semántica.
- **Un chip más callado.** La etiqueta del chip de moneda pesa 500 en lugar de 600, con el mismo blanco de 44 pt.
- **Sin cambio.** El total en cero sigue atenuado (≥ 3,2:1 medido) y ninguna cifra cambió.

### La hoja de Registrar

El orden (Asistente como tile principal, Gasto, Ingreso, Transferencia) y los destinos no cambian. Las filas llevan un
tile teñido y sobrio: Gasto `inset` con el glifo en tinta, Ingreso `incomeSoft` con el glifo `income`, Transferencia
`transferSoft` con el glifo `transfer`. La elección sigue siendo la palabra; el color acompaña. Ningún cambio de
comportamiento ni de escritura.

### El Asistente

- **Sin leyenda permanente.** Salió «No conectado en esta versión…» de debajo del compositor. En el build desconectado,
  un mensaje enviado recibe en el hilo la nota «El Asistente todavía no está conectado en esta versión. Tu mensaje
  quedó escrito para cuando lo esté.»: el límite, dicho donde se usa.
- **Sin micrófono.** El micrófono del compositor y su nota salieron hasta que exista el dictado (Producto 25A): un
  micrófono que no dicta es un callejón sin salida, como en la hoja de Registrar.
- **El glifo del vacío** es el círculo de acento con los sparkles en `onAccent`, como en la hoja. Las sugerencias, la
  memoria de la sesión y la confirmación explícita no cambian.

### Más

- Los mismos dos grupos (Finanzas; App y datos) y todas las rutas en el mismo orden: Cuentas, Tarjetas, Presupuestos,
  Recurrentes, Deudas y cobros, Categorías; Copia de seguridad, Movimientos deshechos, Idioma, Región (cuando se
  muestra), Apariencia. Sin fila «Ajustes».
- Cada grupo lleva un `GroupLabel` pequeño en versalitas (eyebrow, rol de encabezado, navegable con el rotor) en lugar
  de `SectionTitle`; 28 pt entre grupos y 8 pt bajo cada rótulo.
- Las filas de App y datos empiezan con un `GlyphTile` neutro de 34 pt; Finanzas conserva sus tiles teñidos.
- La nota local y la versión, como un pie tranquilo: «FinanzApp 0.1.0 (24UX6C)».

### Motion

Nada nuevo. Las pestañas siguen cambiando al instante, sin fundido.

### Lo que queda para después (aprobado para 24UX6C, sin implementar)

Los filtros de Movimientos por período, cuenta y categoría con datos del repositorio *(→ desde 24UX6D, parte del alcance
de búsqueda y productividad de 25C, con el período a medida y sus búsquedas guardadas; no hay un botón de filtro a
medias; hoy existen la búsqueda y el filtro de tipo Todos / Gastos / Ingresos / Transf.)*. Siguen sin
inventarse nota, origen Apple Pay ni hora de un movimiento.

## Producto 24T2 — compra en cuotas y Tarjetas completo

Implementa la dirección de 24T1C. Apple Wallet fue solo referencia de jerarquía, tactilidad, profundidad, selección de
tarjeta, espaciado y detalle con el importe primero: no se copió ningún recurso, marca, dimensión ni la identidad
visual de Apple, y siguen el minimalismo iOS, el cobalto/zafiro y los materiales de FinanzApp. El contrato exacto y las
pruebas están en el roadmap («Producto 24T2»).

- **Por qué un deck vertical.** El carrusel horizontal mostraba una tarjeta por vez, pedía pasar una por una para
  encontrar otra y ocupaba el gesto horizontal, el mismo eje que volver atrás. El deck muestra todas las activas a la
  vez por su franja superior (nombre y «•••• 4009», lo que identifica una tarjeta), elige con un toque, sin arrastre ni
  gesto horizontal, y deja la elegida entera abajo, justo encima de su resumen: la cara y sus cifras quedan juntas y el
  alto de la página no depende de cuál se eligió. Una sola tarjeta es solo su cara, sin apilar. Con muchas, cada franja
  conserva 50 pt de toque *(→ 24UX6D: 50 pt hasta cuatro tarjetas, 44 pt desde la quinta)* y la página trae la elegida a la vista. Tocar la del frente abre su detalle.
- **Caras.** Identidad y nada más: nombre, «•••• 4009», emisor, el color elegido para su cuenta y el código de moneda
  solo si hay tarjetas en más de una moneda. Sin cifras, logos de banco o de red ni chip sin contacto. El texto se
  limita a 1,3× para que la franja siempre lo muestre; el nombre cede antes que los últimos cuatro, nunca se pisan.
- **El resumen de la elegida**, en el orden del brief: «Saldo pendiente · ARS» como héroe (toda la deuda registrada;
  nunca «Resumen», «Facturado» ni «Deuda»); Vence · Cierra · Disponible, tres datos separados *(→ 24UX6D: planos sobre el
  lienzo con el saldo, Vence · Cierra en una fila y Disponible en la suya)* (con cierre 28 y
  vencimiento 5, el 1 oct: Vence 5 oct —del resumen que cerró el 28 sep— y Cierra 28 oct), Vence en ámbar a tres días o
  menos si hay saldo; Disponible con la cifra, «Sin límite cargado» o, con un plan pendiente, «No calculado con cuotas»
  con su explicación a un toque, nunca un cero; Registrar compra sobre Pagar tarjeta; «Cuotas futuras» (el principal,
  «en 2 planes» y «+ interés $ …» si esos planes tienen interés, nunca sumado); Recientes con «Este ciclo, desde … · N
  compras · N pagos» (la parte de interés de una cuota no es otra compra). Las archivadas siguen al final, en
  Archivadas, todavía pagables.
- **Detalle de tarjeta.** La cara y su estado (archivada, eliminada), el saldo, los tres datos con «de $ límite», las
  acciones que le quedan (Registrar compra solo si está activa; Pagar tarjeta si no está eliminada y está activa o
  debe algo), Cuotas con una fila
  por plan («MacBook Pro · 12 cuotas · 3/12 registradas», «$ 900.000,00 restantes» —«principal restante» si el plan
  tiene interés—, «Próxima cuota · 28 oct») y Movimientos con «Este ciclo». Sin tarjetas dentro de tarjetas.
- **Detalle del plan.** Como un movimiento: la marca, «Compra en cuotas · ARS», el precio como héroe, «12 cuotas · Sin
  interés» y el estado *(→ 24UX6D: «12 cuotas sin interés» y la barra de progreso con «3 de 12 registradas»)*; después solo lo que el plan y el libro saben, una cifra por fila (con interés, las cifras dicen
  que son principal y el interés que falta tiene su fila); el Calendario con Registrada, Registrada en parte, Próxima,
  Futura y Deshecha. Nunca «pagada». La única acción es Eliminar plan, si todavía no registró nada. *(→ 24T3:
  también Registrar devolución, Registrar adelanto de cuotas, Dejar de seguir el plan y Reactivar plan, según el
  estado; ver «Producto 24T3».)*
- **Compra en cuotas.** «Pago» [Una vez][En cuotas] bajo la fecha, solo en un gasto nuevo con una tarjeta activa, tan
  liviano como una compra común: 3 · 6 · 12 · 18 · Otra (12 por defecto), «12 cuotas de $ …» («aprox.» cuando el resto
  agranda las primeras), «Primera cuota» con los dos cierres posibles y «Cierra el … y vence el …», «Con interés»
  apagado. Encendido, un solo campo, «Total financiado», con «Interés total» debajo, solo lectura. La categoría
  «Intereses» es latente: no aparece en los selectores ni en Categorías hasta que un movimiento de interés, un plan con
  interés o una definición suya la usa, así el catálogo por defecto sigue sobrio.
- **Movimiento de una cuota.** Conserva el héroe del importe; «Cuota de tarjeta» (o «Interés de cuota») y la fila «Cuota
  · 3 de 12» que abre el plan. Editar muestra importe, fecha y tarjeta como datos y deja cambiar solo el comercio y la
  categoría; Deshacer dice que no se vuelve a registrar sola.
- **Formulario de tarjeta.** Las fechas primero, en el calendario completo: «Próximo cierre» y «Vencimiento», y una frase
  con los días que siguen («Los meses siguientes: cierre el día 28 y vencimiento el día 5.»). Al editar, el resumen
  abierto y, si falta pagar uno cerrado, «Vence el resumen del 28 sep»; «Usar estos días todos los meses» decide si las
  fechas corrigen solo este resumen o se repiten; lo decide siempre la persona, sin importar cuánto se movió el cierre.
- **Movimiento y accesibilidad.** Las reglas del deck están en «Motion y accesibilidad» (arriba). VoiceOver lee cada
  tarjeta una vez, en el orden en que se dibuja, con su posición y «seleccionada»; las fechas y los importes compuestos
  tienen su versión hablada; el interruptor dice su motivo en su etiqueta. Con el texto más grande, las filas de planes,
  del calendario y de cuotas futuras se apilan sin cortar el comercio ni el importe.

## Producto 24T1C — dirección para 24T2 (solo documentación)

Nada cambia en pantalla. Refina la dirección de Tarjetas de 25B3 y fija cómo 24T2 presenta la financiación y las
fechas del ciclo. El contrato exacto está en el roadmap («Producto 24T1C») y en la decisión 003, regla 7.

- **Compra en cuotas: lo simple primero.** El caso normal es «12 cuotas sin interés» y debe sentirse tan liviano
  como una compra común: el valor por defecto es **«Sin interés»** y no aparece ningún campo financiero. Un único
  interruptor secundario, **«Con interés»**, muestra un solo campo editable, **«Total financiado»** (precio ARS
  1.000.000, total financiado ARS 1.200.000). Debajo, solo lectura: «Interés total: ARS 200.000» y, si ayuda, el valor
  aproximado por cuota. Nada más: sin porcentaje, tasa mensual, TNA, TEA ni CFT, sin campos de comisión ni de
  impuesto (el motor los conserva y este flujo los deja en cero).
- **Próximo cierre y próximo vencimiento, por separado.** Los días habituales son el valor por defecto; el próximo
  ciclo puede llevar una fecha exacta de cierre y otra de vencimiento, elegidas con un calendario completo (día, mes
  y año), que pueden caer en meses distintos; el vencimiento siempre es posterior al cierre y una combinación
  inválida no se guarda. Corregirlas no toca resúmenes, movimientos ni calendarios de planes ya creados. La interfaz
  nunca funde las dos fechas en una línea ambigua y nunca inventa feriados ni corrimientos a días hábiles.
- **Tarjetas: deck vertical seleccionable (a evaluar).** Un stack compacto en lugar del carrusel horizontal. Las caras
  de las tarjetas son de identidad (emisor, nombre, últimos cuatro, color) y sin cifras amontonadas. La tarjeta
  seleccionada revela debajo un resumen financiero, en este orden: saldo pendiente/facturado actual, próximo cierre,
  próximo vencimiento, Pagar, cuotas futuras comprometidas, últimos movimientos. El detalle financiero profundo
  conserva su propia ruta.
- **Detalle de tarjeta.** Resumen y compromisos completos, planes de cuotas, compras y pagos, historial de movimientos,
  edición y ciclo de vida (archivar, reactivar, eliminar cuando se puede).
- **Detalle de movimiento.** Puede inspirarse en el héroe de importe primero del detalle de una transacción de Wallet,
  pero conserva lo que FinanzApp sabe: categoría, cuenta o tarjeta, comercio, relación con un plan de cuotas o un
  recurrente, notas, y Editar/Deshacer cuando corresponde.
- **Apple Wallet es solo referencia** de jerarquía, tactilidad, profundidad, espaciado, selección de tarjeta y detalle
  con el importe primero. No se copian recursos, marcas, dimensiones ni la identidad visual de Apple; siguen el
  minimalismo iOS, el cobalto/zafiro, los materiales de FinanzApp y las reglas de gestos de 25B3.

## Producto 24T1 — vocabulario de cuotas (sin cambios visuales)

El motor de compras en cuotas existe en el dominio y el almacenamiento (decisión 003, regla 7); ninguna pantalla lo
usa todavía. Las palabras que 24T2 dibujará y que ninguna pantalla mezcla:

- **Compra**: la operación (comercio, precio, fecha). **Plan**: la fila que la representa, con su calendario exacto.
- **Cuota futura**: sin movimiento en el libro; un compromiso, nunca un gasto. **Cuota reconocida / facturada**: su
  movimiento está en el libro; cuenta una vez, en el mes de su cierre, en la categoría original, y sube el saldo
  pendiente. **Cuota deshecha**: la persona la deshizo; no cuenta y la obligación sigue abierta.
- **Saldo pendiente actual**: lo exigible hoy (compras y cuotas reconocidas menos pagos). **Cuotas comprometidas**:
  el principal futuro, al lado del saldo pendiente y nunca dentro. **Principal restante**: lo no reconocido.
- **Pago**: una transferencia a la tarjeta. Nunca «paga» una cuota concreta: no existe «3/12 pagadas»; existe «3/12
  facturadas». La palabra «pagada» no aparece salvo que el sistema lo sepa de verdad. *(→ 24T2/24UX6D, alineado en
  24T3: en pantalla se dice solo «registradas»; «facturada» queda como sinónimo del dominio.)*
- **Financiación**: tres componentes independientes, **Intereses**, **Comisiones** e **Impuestos de financiación**, cada
  uno un gasto aparte en su propia categoría; nunca principal ni mezclados entre sí. Reportes los muestra por separado
  de la **Compra** (el principal).
- **Cinco cifras** para 24T2: precio / principal original; saldo de la tarjeta facturado/exigible hoy; principal futuro
  comprometido; principal restante; principal ya reconocido/facturado. Los pagos generales de la tarjeta se pueden
  mostrar aparte, sin asignarlos a ninguna cuota.
- **Tarjeta archivada**: conserva historial, planes y pagos; no se ofrece para una compra, un plan o un recurrente
  nuevos; reactivarla la devuelve a los formularios.
- **Disponible de la tarjeta** con un plan pendiente: desconocido hasta que la decisión 003 registre cómo reserva el
  emisor; 24T2 decide cómo se muestra (no un cero, no un número inventado).

## Producto 25B3 — jerarquía de detalle (sin rediseño)

Dos correcciones pequeñas de jerarquía antes de empezar cuotas (24T). Nada cambia en cómo se registra,
se materializa o se guarda el dinero.

- **Cuenta: sin fila de saldo inicial.** El saldo inicial forma parte del libro (se guarda, se respalda y es
  el punto de partida de cada saldo) pero no es una métrica cotidiana. El detalle de una cuenta muestra el
  saldo registrado como héroe, gastos e ingresos del mes, las acciones rápidas, la fila Recurrentes (única fila
  del grupo, solo en una cuenta viva) y los movimientos; la fila «Saldo inicial» ya no está y nada la reemplaza.
  `openingMinor` no se toca. Para una auditoría, el dato sigue legible en cada copia de seguridad y es la
  diferencia entre el saldo registrado y los movimientos; si algún día hace falta verlo, va en Editar cuenta
  junto a «Saldo registrado», como fila quieta, no en el detalle diario. *(→ 24UX6E: el saldo y los datos del mes
  son un bloque plano sobre el lienzo, «Saldo registrado · ARS» sobre el saldo en 40 pt y «Gastos este mes» sin signo,
  en tinta, como aplicación de 24UX6C.)*
- **Recurrentes: primero el detalle.** Una regla se lee antes de editarse, como un movimiento, una cuenta,
  una tarjeta o una deuda: fila → detalle → Editar. El detalle (`app/recurring/[id].tsx`) reutiliza el
  sistema: la marca del comercio en grande, «Gasto recurrente · ARS» (o «Ingreso recurrente»), el importe
  con signo y tono como en su fila, y debajo el estado en una palabra: Activo, Pausado o Revisar (ámbar,
  24UX5). Luego una tarjeta agrupada con Próxima fecha (solo si está activa: una regla pausada nunca anuncia
  una fecha, 24UX2; en tono de aviso si hay que revisarla), Frecuencia, Categoría y Cuenta o Tarjeta (abre
  su detalle). Después «Registrados» (el historial de 24UX2, que deja el formulario) y, al final, las mismas
  acciones del deslizamiento de la fila, con nombre: Pausar/Reanudar recurrente y Eliminar recurrente, con
  las mismas confirmaciones; una regla cuya cuenta o tarjeta fue eliminada ofrece Eliminar como única acción de ciclo
  de vida y lo dice, y conserva Editar como vía de recuperación: el formulario ofrece las cuentas y tarjetas vivas de la
  misma moneda (nunca otra eliminada, una deuda ni otra moneda; la próxima fecha debe ser hoy o posterior, como
  siempre); movida allí sigue pausada, vuelve al detalle y aparece
  Reanudar, que retoma desde hoy sin registrar lo vencido. Si se deja en la fila cerrada, sigue sin poder reanudarse.
  *(→ 24UX6E: la explicación de una regla pausada, cerrada o para revisar va justo debajo del héroe como
  `LifecycleNote`, no al final, y para revisar «Continuar desde hoy» la sigue; una regla cerrada dice «Cuenta
  eliminada» o «Tarjeta eliminada» en lugar de «Pausado».)*
  Pausar o reanudar deja la pantalla abierta y cambia el estado (como Cerrar en una deuda); Eliminar pregunta
  y vuelve a Recurrentes. Editar va en la cabecera y abre el formulario, que ahora es solo el formulario.
  Inicio → Próximos compromisos, Más → Recurrentes y la fila «Recurrente» de un movimiento registrado abren
  este detalle, nunca el formulario.
- **VoiceOver.** La fila de Recurrentes lee la regla («Alquiler, mensual, Hogar, 400,00 ARS, próximo 1 oct»;
  «…, pausado»; «…, para revisar: sin registrar desde …») con la pista «Abre el detalle del recurrente»; la
  fila de Inicio conserva su frase y suma la misma pista. Ninguna fila dice «Editar». Inglés igual.
- **Dirección para Tarjetas (24T2, solo documentación; nada cambia en esta entrega).**
  - Apple Wallet puede usarse como referencia de jerarquía, tactilidad, profundidad y claridad, nunca como
    copia visual.
  - Cuando 24T2 diseñe Tarjetas, evaluar reemplazar el carrusel horizontal por un stack/deck vertical
    seleccionable.
  - Una tarjeta seleccionada prioriza, en este orden: el saldo pendiente actual, el próximo cierre/vencimiento,
    la acción Pagar, las cuotas y compromisos futuros, los movimientos.
  - Las cuotas se distinguen visualmente del saldo exigible ahora (las cinco cifras de 24T nunca se funden).
  - Se conserva el minimalismo iOS, el cobalto/zafiro y los materiales de FinanzApp.
  - Ningún gesto que compita con volver atrás (el borde izquierdo) ni con eliminar (el deslizamiento trasero
    de las filas).
  - Las tarjetas de débito siguen siendo metadatos futuros de una cuenta, no un libro independiente.

## Producto 25B2 — monedas iniciales lógicas y ciclo de vida de cuentas y tarjetas

- **Sin controles vacíos.** Con cero o una moneda, Inicio y Reportes no muestran el chip de visualización: el
  número es el total de esa moneda y no hay nada que decidir. Con dos o más, el chip de 24C1 y su hoja siguen
  iguales. Ningún selector de cuentas en Inicio: las cuentas viven en Cuentas.
- **Eliminar una cuenta.** En Cuentas, el deslizamiento trasero corto revela una sola acción, Eliminar (roja, en
  el borde); un deslizamiento completo solo abre la misma confirmación: nunca se elimina por alcanzar el umbral,
  siempre hay un diálogo destructivo antes de escribir, una sola fila abierta a la vez (`SwipeRow`, el mismo
  componente de Recurrentes y Deudas), y la acción llega a VoiceOver como acción personalizada de la fila. En
  Editar cuenta, «Eliminar cuenta» es el último botón, secundario en tono `expense`, separado de Guardar. El detalle
  de una cuenta eliminada se lee (saldo e historial), con «Cuenta eliminada» donde iba «Saldo registrado», sin
  botón de edición ni acciones rápidas. *(→ 24UX6E: «Cuenta eliminada» es una `LifecycleNote` arriba del detalle y el
  saldo conserva su rótulo «Saldo registrado · ARS».)*
- **Eliminar una tarjeta.** Solo desde Editar tarjeta, como último botón, tras Archivar/Reactivar; **nunca por
  deslizamiento en el carrusel**, que ya usa el gesto horizontal para cambiar de tarjeta. Sin saldo pendiente, la
  confirmación dice que compras y pagos quedan. Con saldo pendiente no se elimina: un diálogo («Todavía no se puede
  eliminar») nombra el saldo y ofrece **Pagar** (abre el pago revisado, con tope en el saldo, como desde el detalle) y
  **Archivar** (solo si está activa); Cancelar no escribe nada. Nada se cancela ni se escribe en silencio. El
  detalle de una tarjeta eliminada se lee («Tarjeta eliminada · saldo pendiente»), sin edición, sin Registrar
  compra ni Pagar. En Recurrentes, una regla cuya cuenta o tarjeta fue eliminada ofrece Eliminar como única acción de
  ciclo de vida; Editar sigue disponible para moverla a una cuenta o tarjeta viva compatible y reanudarla (25B3).
- **«Saldo pendiente», nunca «Deuda», para una tarjeta** (cierre de 25B2). Lo que se debe en una tarjeta
  (compras menos pagos) se llama «Saldo pendiente» en Tarjetas, en el detalle, en el formulario de compra
  («Tarjeta de crédito · saldo pendiente $ 50,00», «sin saldo pendiente»), en Pagar tarjeta («Saldo
  pendiente: ARS 50,00», «Sin saldo pendiente») y en los rechazos; en inglés, «Outstanding balance» /
  «outstanding». «Deuda» y «Pendiente» quedan para Deudas y cobros, que son obligaciones personales y nunca
  se mezclan con el saldo de una tarjeta (decisión 003, «Invariantes contables de tarjetas»). Los nombres
  internos de claves y funciones no cambian por copy.
- **Historial de una cuenta eliminada.** Editar uno de sus movimientos o reglas muestra su propia cuenta (la
  eliminada) seleccionada, con el importe, la fecha y la moneda guardados; se corrige en el lugar. Un movimiento o
  regla nuevos nunca la ofrecen. Inicio y Reportes conservan su moneda en el chip y en «Solo …» mientras el
  historial tenga dos monedas; Disponible y los formularios ya no.
- **Formularios.** La fila de moneda de cuenta, tarjeta, deuda y presupuesto arranca en la moneda que propone la
  regla (docs/currency.md §2.10); el control no cambia. Paleta, hápticos, Dynamic Type y Reduce Motion como siempre.

## Producto 25B — primera apertura nativa

- **Dos etapas, una sola ruta.** Bienvenida y Tu primera cuenta cambian en el mismo lugar (el mismo
  `ValueTransition` en fundido que el número de Inicio; con Reduce Motion, un fundido igual). Sin
  barra de navegación ni gesto de volver: no es una pila. Arriba a la derecha, "Omitir" en el azul
  de interacción, siempre visible; abajo, un botón principal ("Continuar", "Crear cuenta") y, en la
  segunda etapa, uno secundario ("Ahora no"). Omitir salta lo que queda y conserva lo ya elegido; su
  etiqueta y su pista lo dicen.
- **Bienvenida.** Título en `largeTitle`, una frase de propuesta, y una tarjeta agrupada con dos filas
  quietas, Idioma y Región, que dicen lo detectado ("Español · según el dispositivo") y abren los
  mismos selectores de Más empujados sobre la bienvenida (una elección allí se guarda como en Más y
  la bienvenida vuelve ya en el idioma nuevo). Una nota al pie: se pueden cambiar ahora o después.
- **Primera cuenta.** Nombre, la fila de moneda de todos los formularios (con la sugerencia de la
  región y su motivo en la nota; cualquiera de las 146 se puede elegir), saldo inicial opcional con
  la nota habitual. Las mismas reglas de guardado que Nueva cuenta (reintento sin duplicar). Sin
  icono ni color: se personalizan después en Cuentas.
- **Accesibilidad.** Ambas etapas son un `ScrollView` con el pie dentro del contenido, así el texto
  más grande sigue alcanzando los botones; cada título es un encabezado de VoiceOver; "Omitir" tiene
  etiqueta y pista completas; áreas seguras arriba y abajo; claro y oscuro con la paleta actual. En
  Android, el botón físico de volver vuelve a la bienvenida (`BackHandler`), nunca sale del flujo.

## Producto 24C1 — totales consolidados, misma composición de Inicio

- **Nada nuevo en pantalla.** Inicio conserva su orden (encabezado, número, tres acciones, Asistente,
  secciones) y su único número de 48 pt: nunca un segundo importe equivalente debajo. El chip de moneda
  del encabezado es el mismo (32 pt, tinta neutra, borde fino) y ahora aparece siempre que haya una cuenta y dice
  qué cubre el número: "Total · EUR" (todas las cuentas convertidas a euros), "Solo EUR" (solo las cuentas en
  euros). VoiceOver: "Total consolidado en euros" / "Solo euros".
- **Una hoja discreta, no controles permanentes.** El chip abre una hoja de página nativa con dos opciones
  con tilde (Total consolidado · Ver solamente una moneda), la fila Moneda de visualización y una frase: cambiar
  cómo se muestran los totales no convierte ni modifica nada. La fila convierte la misma hoja en la lista
  buscable de monedas de los formularios (sin un segundo modal encima); elegir vuelve a las opciones.
- **La cotización, detrás de ⓘ.** Fuente (Frankfurter) y fecha viven en el botón de información junto al
  rótulo del número, que ya existía para Disponible; no ocupan espacio. En Reportes, el ⓘ del total dice el
  rango de fechas de cotización usado.
- **Sin cotización, cada moneda por separado.** Donde iría el total, los subtotales por moneda a 28 pt, uno por
  línea, y una sola línea secundaria ("Sin cotización para sumarlo en EUR") con ⓘ que explica el motivo. Sin
  colores de alerta, sin banner, sin suma parcial.
- **Los importes originales se conservan** en filas, detalles, cuentas y desgloses; solo los totales y los
  gráficos se expresan en la moneda de visualización. **Los presupuestos no cambian de significado** con el
  modo: cada uno mide solo el gasto de las cuentas de su moneda; en el total consolidado la sección nombra esa
  moneda ("Presupuesto del mes · ARS") cuando no es la de visualización. Movimiento: el mismo `ValueTransition` del número al
  cambiar de modo o moneda; Reduce Motion igual que antes.

## Producto 24R2B — 234 regiones publicadas, mismo selector

Sin cambios de diseño: Más → Región publica ahora 234 regiones, así que en un build de publicación la
pantalla muestra la forma larga de `ChoiceScreen` (buscador, Recientes, secciones por letra) que 24R2A
diseñó para la vista previa. Cada fila lleva la muestra de formatos de su región («2026. 9. 22. · 1,234.56»
en Corea). Las fechas con espacios usan espacios duros y nunca se cortan. Idioma sigue siendo una sola
tarjeta con dos opciones.

## Producto 24R2A — Idioma y Región como selectores nativos (Argentina y Estados Unidos siguen siendo las únicas regiones publicadas)

Más → Idioma y Más → Región pasan a ser `ChoiceScreen` (`src/ui/locale-choosers.tsx`), con el lenguaje
de Ajustes de iOS y sin rediseñar nada más:
- **Arriba, fijo, «Según el dispositivo»** con lo que da el iPhone ahora («Ahora: Estados Unidos»,
  «Ahora: Japón (formatos de Argentina)»). Nunca se filtra ni entra en una sección.
- **Lista corta = una tarjeta.** Con los valores publicados (dos idiomas, dos regiones) la pantalla es
  la fila fijada y una sola tarjeta agrupada debajo: sin buscador, sin «Recientes», sin letras. Cada
  región muestra su muestra de formatos («22/9/2026 · 1.234,56»); cada idioma, su autónimo leído por
  su propia voz.
- **Lista larga (vista previa de desarrollo, 257 regiones).** Desde seis opciones: el campo «Buscar»
  (nombre sin acentos, código de dos o tres letras, código numérico, moneda), «Recientes» con las
  tres últimas elecciones leídas al abrir (la lista nunca salta bajo el dedo), y secciones
  alfabéticas por inicial con encabezados que VoiceOver anuncia como encabezados. Una sola lista
  virtualizada, filas sin alto fijo (Dynamic Type), sin banderas ni colores por país.
- **Una región elegida en la vista previa y no publicada** sigue guardada y marcada, con el subtítulo
  «Todavía no disponible en esta versión · formatos de Estados Unidos»; la fila de Más dice «Japón ·
  formatos de Estados Unidos». Nunca se presenta como si sus formatos estuvieran en uso.
- **Las notas** (qué define la región, que no cambia la moneda ni los datos, y en la vista previa que
  sus regiones no se verificaron en un iPhone) van debajo de la lista, nunca dentro.
- **Márgenes del sistema.** La lista es la vista desplazable de la pantalla, con los mismos insets
  automáticos que `Screen`: barra de navegación, indicador de inicio y, con el buscador activo, el
  teclado. La última región, el error y la nota siempre pueden desplazarse a la vista; ningún margen
  fijo reemplaza un inset.
- **Onboarding.** `LocaleChooser` acepta `onChosen`, así el paso de idioma y el de región del
  onboarding (25B) son la misma pantalla. Tocar la opción ya marcada también llama a `onChosen`
  («seguir con esta») sin guardar nada; en Más, sin `onChosen`, ese toque no hace nada.

## Producto 24R1 — selectores regionales preparados (sin cambios visuales en producción)

Nada cambia en un iPhone con Región Argentina o Estados Unidos. Con la Región en otro país, la fila
«Según el dispositivo» de Más → Región dice «Ahora: Japón (formatos de Argentina)» en vez de «Ahora:
Argentina»: nombra el país del teléfono y aclara qué formatos se usan mientras esa región no esté
publicada. Lo que queda preparado para 24R2:
- **Un selector de una sola elección, compacto y buscable** (`ChoiceScreen`): la misma fila
  `CheckRow` de Idioma y Región, dibujada como tarjetas agrupadas por sección; «Según el dispositivo»
  siempre primero y fuera de las secciones; «Recientes» con las tres últimas elecciones; secciones
  alfabéticas por inicial (sin acentos: Álava bajo A); un campo de búsqueda desde seis opciones que
  deja una lista plana ordenada por coincidencia (código exacto, prefijo de código, prefijo de
  nombre, cualquier coincidencia); «Sin coincidencias» bajo el campo cuando ninguna opción real
  coincide, aunque «Según el dispositivo» siga a la vista. Una sola lista
  virtualizada, sin altura fija por fila: el texto escala con Dynamic Type. Los encabezados tienen
  rol de encabezado; un idioma en su propio nombre lleva su idioma para VoiceOver. Un guardado
  rechazado deja la marca donde estaba y lo dice bajo la lista. La nota explicativa va debajo,
  nunca dentro de la lista. *(→ 24UX6E: la tarjeta fijada se separa 20 pt de la tarjeta de opciones que la sigue
  enseguida; antes se tocaban.)*
- **La fila resumida en Más** sigue siendo `NavigationRow` («Región · Argentina · según el
  dispositivo»); en 24R2 nombra también la región del catálogo elegida.
- Sin banderas, sin colores por país, sin lista interminable en Más: filas compactas que abren una
  pantalla con búsqueda, como las monedas.

## Producto 24B6 — hoja de fecha compacta, moneda compartida y reglas de tarjeta (sin rediseño)

Tres correcciones tras la primera prueba del propietario en el iPhone; nada cambia en la composición
de Inicio, en las cuatro acciones, en la pestaña central del Asistente ni en el material.

- **La hoja de fecha.** La rueda nativa ya no viaja en una hoja de página casi vacía. En iOS abre una
  tarjeta anclada al borde inferior, del alto de su contenido: asa, Cancelar · Elegir fecha · Listo,
  la rueda centrada y el margen del indicador de inicio tomado del área segura. Superficie `surface`
  en ambos temas (blanco / `#1C1C1E`), esquinas de 24 pt, un velo (`scrim`) que deja ver el
  formulario. Motion propia del sistema: el velo se funde y la tarjeta sube con el tiempo de estado
  (200 ms, ease-out) y baja con el de salida (100 ms), interrumpible; con Reduce Motion solo fundidos.
  (Corregido en 24UX1: la subida arrancaba antes de que el modal estuviera en pantalla; ahora usa la
  curva de hoja de iOS a 300 ms y la salida 200 ms, ver más abajo.)
  Cancelar, el velo y el gesto de volver descartan; solo Listo guarda. Cuenta, Categoría y Moneda
  conservan su hoja de página: una lista que se desplaza necesita altura; una rueda, no. Se evaluó
  la hoja nativa con detent (`formSheet` + `fitToContents` vía router) y queda para comparar en el
  dispositivo: exige una ruta y un canal de vuelta al borrador, y su medida con una rueda nativa no
  está verificada.
- **Una moneda para Inicio y Reportes.** El selector de moneda de ambas pantallas escribe la misma
  preferencia (`finanzapp.displayCurrency`, junto a idioma y región, fuera del libro y de las
  copias). Misma presentación de antes: sin selector con una moneda, segmentado con dos, fila
  compacta que abre la hoja buscable con tres o más. No hay un selector grande junto al importe y
  no se convierte nada: la elección filtra.
- **Tarjetas.** Ingreso ofrece solo cuentas normales; Gasto sigue ofreciendo cuentas y tarjetas
  (la compra es un gasto que aumenta la deuda); Pagar tarjeta sigue fijando la tarjeta como destino;
  la transferencia general nunca lista una tarjeta. Al cambiar Gasto → Ingreso con una tarjeta
  elegida, el selector pasa a una cuenta de la misma moneda y recupera la tarjeta al volver, sin
  saltos: mismo formulario, mismo estado.

## Producto 24B5 — selector de monedas y la moneda antes del importe (sin cambios visuales en producción)

Con ARS y USD nada cambia: la fila «Moneda» de Cuenta nueva abre la misma hoja de siempre (dos filas,
tilde en la actual, sin buscador); Tarjeta, Deuda y Presupuesto conservan su segmentado. Lo que ya
está listo para cuando el gate se abra:
- **La hoja de monedas** lista solo las monedas que la pantalla puede usar (el gate de la compilación),
  con el nombre en el idioma de la interfaz, el código ISO y el símbolo de la región, y a partir de seis
  monedas un campo de búsqueda que encuentra por código, nombre, símbolo, código numérico o país
  («yen», «japón», «€», «840»). Filas compactas, sin banderas ni colores por moneda; nunca una lista
  enorme en la pantalla principal.
- **La moneda antes del importe** en cuenta, tarjeta, deuda, presupuesto y recurrente (en el
  recurrente la cuenta, que fija la moneda, pasa arriba del importe): el campo usa la precisión
  correcta desde la primera tecla (teclado numérico en yenes, tres decimales en dinares).
- **Una cuenta existente** muestra su moneda por su propio nombre («Euros · EUR · €»), nunca ARS.
- **Modo de prueba.** Una compilación de desarrollo iniciada con `EXPO_PUBLIC_CURRENCY_PREVIEW=1`
  ofrece EUR, GBP, JPY, CLP y KWD y lo dice bajo el pie de Más («Monedas de prueba activas…»); una
  compilación de release nunca las ve. El pie dice Producto 24B5.

## Producto 24B4 — SQLite 9 y copia v9 (sin cambios visuales)

Nada cambia en pantalla con ARS y USD. En Importar copia, una copia v9 que registra escalas de
otras monedas muestra una fila más en la revisión («Escalas de moneda nuevas») y, si la copia
registrara otra cantidad de decimales que el dispositivo, un aviso en lugar del botón de importar.
Los errores de escala («La moneda JPY no tiene una escala registrada», «La escala de la moneda no
coincide con el registro») se muestran con el componente de error existente; nunca un diálogo
nuevo ni un reset. El pie de Más dice Producto 24B4.

## Producto 24B3 — presentación y textos multimoneda (sin cambios visuales en producción)

Con ARS y USD nada cambia: cada importe, etiqueta y frase hablada es byte a byte la de 24B2
(goldens). Lo que la interfaz ya sabe hacer para cuando se habiliten otras monedas:
- **Cada importe con su moneda.** Un yen sin decimales ("JP¥ 1.500"), un dinar con tres
  ("KWD 1.234,567"), en los separadores de la región; las escalas de los gráficos en unidades
  enteras de la moneda ("escala de 0 a JP¥ 1.234.567"), nunca centavos divididos por cien.
- **Un valor fuera del rango exacto** se muestra como "—" y VoiceOver dice "Importe fuera de
  rango": nunca NaN, Infinity ni un cero engañoso.
- **Selector de moneda.** Con una o dos monedas, el control segmentado de siempre ("Pesos · ARS",
  "Dólares · USD"; códigos sueltos en Inicio). Con tres o más, una fila compacta con la moneda
  elegida y un chevron que abre la hoja de monedas ya existente (tilde en la actual; búsqueda
  a partir de seis). Lista solo las monedas que esa pantalla puede usar; elegir una no convierte
  nada. Sin menús de divisas en el gasto común ni pop-ups.
- **Una sola plantilla** "{nombre} · {código}" para nombrar monedas, con "Pesos"/"Dólares" para
  ARS/USD y el nombre de CLDR para el resto ("Yenes japoneses · JPY").
- **VoiceOver** lee cada moneda en el idioma de la interfaz ("1500 yenes japoneses", "1234.567
  Kuwaiti dinars"). Si el libro tiene otra moneda que comparte la palabra corta (pesos chilenos
  junto a pesos, dólares canadienses junto a dólares), ARS y USD pasan a su nombre completo
  ("pesos argentinos", "US dollars"); con solo ARS y USD, las palabras de siempre.
- **Texto grande y 320 pt.** El importe más largo de cada exponente cabe en el héroe (se reduce
  hasta la mitad de su tamaño, nunca se corta) y en una fila se apila bajo el nombre; el campo
  conserva su piso junto a "JP¥", "KWD" o "CA$". Pendiente de iPhone (etapa 9): la fila del
  selector y la hoja con los tamaños de texto mayores y Reduce Motion.
Pendiente para 24B4: preparación segura de SQLite (esquema 9) y backup v9, con autorización
del propietario para la actualización irreversible.

## Producto 24B2 — rutas estrictas y campo de importe por moneda (sin cambios visuales en producción)

Nada visible cambia con ARS y USD: el formato regional, el símbolo anclado, el cursor
estable, las cifras tabulares y la escritura fluida del campo de importe son byte a byte
los de 23.1C1 (`money-input.node.ts` conserva sus goldens). Lo que el campo ya sabe hacer,
para cuando se habilite una moneda con otra precisión:
- **Teclado numérico sin coma** en una moneda sin decimales (JPY); teclado decimal en las
  demás. Tres decimales en KWD, con «Terminar» completando a tres.
- **Borrador conservado al cambiar de cuenta o de moneda.** Los dígitos escritos no se
  tocan (ARS ↔ USD no cambia nada). Si la nueva moneda no puede conservarlos exactamente,
  aparece una nota discreta bajo el campo («JPY no lleva decimales. Quitá los decimales
  antes de guardar; no se redondea.») y Guardar queda deshabilitado hasta corregirlos.
  Nunca se trunca, redondea ni reinterpreta.
- **Pegado sin adivinar.** Los marcadores de moneda vienen del catálogo («€», «JP¥», «KWD»);
  un marcador distinto de la moneda de la cuenta se rechaza, nunca se convierte; un «$» suelto
  no es evidencia; «1.234» en una moneda de tres decimales es ambiguo y se rechaza con motivo.
- **Rutas estrictas.** Un enlace con una moneda desconocida o que ninguna cuenta tiene abre
  el estado vacío de la pantalla («Día no válido», «Período no válido», «Comparación no
  válida»), nunca otra moneda. Un enlace sin moneda abre la primera del ledger, como la
  pestaña.
Entregado en 24B3 (etapa 4): los cuatro ternarios ARS/USD de presentación con la plantilla
`{name} · {code}`, el picker más allá de dos monedas y las unidades habladas.

## Producto 24B1 — red de seguridad multimoneda (sin cambios visuales)

Nada visible cambia salvo la etiqueta del pie de Más (Producto 24B1). El dominio agrupa por
las monedas realmente presentes y los selectores de moneda de Inicio, Reportes,
Presupuestos y el Asistente listan esas monedas (ARS, USD y luego por código); hoy siguen
siendo exactamente ARS y USD. Dos textos nuevos, solo cuando una suma sale del rango exacto:
"Total fuera de rango" en Deudas y Recurrentes, en lugar de redondear u ocultar la moneda.

**Decisiones de diseño para compras en moneda extranjera (24C, no implementado).**
- El formulario común no cambia: registrar un gasto en la moneda de la cuenta sigue siendo
  la experiencia predeterminada y la única visible por defecto.
- La compra en otra moneda es una opción secundaria y discreta (dentro de "Más opciones" o
  una fila contextual que aparece al elegirla), con una sola fila nueva: el importe original
  y su moneda. Nunca un selector de moneda extranjera, un campo de cotización ni una
  explicación financiera en todos los gastos; nunca un pop-up recurrente para confirmar la
  moneda de una cuenta.
- El equivalente estimado, cuando exista, se muestra como texto secundario con fuente y
  fecha; si no existe, una nota breve dice que todavía no está disponible. Guardar nunca se
  bloquea por falta de cotización.
- El ajuste manual (débito real, otra cotización, comisiones e impuestos) vive en el detalle
  del movimiento como acción secundaria, no en el formulario.
- Se reutilizan los componentes existentes, las microanimaciones discretas, la paleta
  cobalt/sapphire y los patrones nativos; ninguna superficie nueva.
- Inicio y reportes: cada cuenta en su moneda; un gasto muestra primero el importe
  contabilizado y, si corresponde, el original debajo o en el detalle; una compra pendiente
  prioriza el original y marca el estimado como tal; un total consolidado solo con
  cotizaciones trazables y, si falta alguna, subtotales por moneda con aviso.
Detalle en docs/currency.md §8–§10.

## Producto 24A — base del motor multimoneda (sin cambios visuales)

- **Nada cambia en pantalla.** Las cinco pestañas, el Asistente central, las superficies,
  el material y el movimiento quedan igual; ARS y USD se leen byte a byte como antes
  (probado contra el código anterior). Los formularios siguen ofreciendo solo ARS y USD.
- **Reglas para cuando 24B muestre otras monedas.** Cada moneda con sus propios decimales
  (yen sin decimales, dinar kuwaití con tres); un decimal registrado nunca se oculta. Un
  "$" suelto es solo el peso en Argentina; el resto usa el símbolo neutral de CLDR, que
  nombra una sola moneda ("US$", "€", "JP¥", "CA$") o el código ISO ("KWD"). Nombres de
  CLDR en el idioma de la interfaz ("Yenes japoneses"), nunca en otro idioma.
- **El selector buscable** (24B) seguirá la hoja actual de moneda (fila agrupada con
  chevron, tilde en la actual): búsqueda por código, nombre, símbolo o país, las monedas
  del libro primero, sin banderas ni colores por moneda. Diseño en docs/currency.md.

## Producto 23.1C2 — inglés y Estados Unidos publicados (sin rediseño)

- **Mismo diseño.** Ningún cambio de layout, material, color, movimiento ni jerarquía:
  cobalto/zafiro, superficies agrupadas, Liquid Glass sólo donde ya estaba (acciones de
  Inicio y compositor del Asistente) y microanimaciones discretas, igual que en 23.1C1.
- **Más → App y datos.** Idioma y Región son dos filas nativas del mismo grupo (Región
  con el glifo de globo, cerrando el grupo). Cada pantalla es una lista agrupada estilo
  Ajustes con "Según el dispositivo" primero y una marca en la opción en uso; Región
  muestra una muestra de sus formatos debajo de cada país. La nota "por ahora sólo en
  español" desapareció. Cambiar cualquiera re-renderiza en el lugar, con la háptica de
  selección de siempre; nada se reinicia.
- **Nombres de idioma.** "English" y "Español" se leen con la voz de su propio idioma,
  como en Ajustes de iOS.
- **Rueda de fecha.** Sigue siendo la rueda nativa en su hoja; los meses y el orden de
  columnas siguen el idioma (español día · mes · año, inglés mes · día · año), igual que
  la fila que la abre, en cualquier región.
- **Textos de iOS.** Con el build nuevo, el menú de edición (Pegar/Copiar) y la hoja de
  compartir aparecen en el idioma de la app según iOS; el botón de las alertas ⓘ es de
  la app ("OK").
- **Revisión de textos.** Se corrigieron errores reales en ambos idiomas (dirección de un
  cobro, "cuatro" categorías con nombre en el donut, "Vence hoy" en minúscula, ejemplos
  de marcas argentinas en placeholders) y el inglés de glosario ("transaction", nunca
  "movement"; "record", nunca "log"). Las longitudes siguen dentro de los límites de
  segmentos, pestañas, botones y cabeceras.

## Producto 23.1C1 — formatos regionales y campo de importe (sin rediseño)

- **Mismo campo, separadores de la región.** El diseño aprobado de 23.0 no cambia: el
  símbolo anclado a la izquierda, cifras tabulares, los dígitos crecen desde un origen
  fijo y nada se mueve al aparecer un separador (999 → 1.000 y 999.999 → 1.000.000 en
  Argentina; 999 → 1,000 y 999,999 → 1,000,000 en Estados Unidos). Las dos regiones
  miden igual, así que el tamaño nunca depende de la región.
- **Símbolo por región.** En Argentina "$" es el peso y "US$" el dólar; en Estados Unidos
  el peso es "AR$" y el dólar sigue "US$", para que ningún "$" sea ambiguo. El símbolo y
  el número van unidos por un espacio duro: nunca quedan en líneas distintas.
- **Pegado que no adivina.** Si el texto pegado puede leerse de dos maneras ("1,000" en
  Argentina), el campo queda como estaba y una nota al pie, en el tono de advertencia,
  dice por qué y cómo escribirlo; VoiceOver la anuncia. La nota desaparece con la
  siguiente edición válida. No hay alerta modal ni animación.
- **Cambio de región con el formulario abierto.** Sólo cambian los separadores del texto
  visible; el importe, el borrador y la posición del cursor se conservan.
- **VoiceOver.** Los importes se leen con los números del idioma de la interfaz; las
  frases de presupuestos dicen "pesos" o "dólares" en lugar de "$".
- **Selector de fecha.** La rueda usa el idioma de la interfaz para los meses.
- **Oculto hasta 23.1C2.** Inglés y Estados Unidos no aparecían en Más salvo en la
  vista previa de desarrollo (`EXPO_PUBLIC_LOCALE_PREVIEW=1`); 23.1C2 los publicó.

## Producto 23.1B1 — traducción de navegación, Inicio, Movimientos y formularios (sin rediseño)

- **Mismo diseño, otras palabras.** Ningún cambio de layout, espaciado, material,
  movimiento ni posición (el Asistente sigue en la pestaña central, Tarjetas bajo Más).
  El español se ve idéntico; el inglés existe y sigue oculto hasta 23.1B2 y 23.1C.
- **Longitud.** Los textos en inglés de segmentados, pestañas y acciones rápidas no son
  más largos que los españoles (All / Expenses / Income / Transfers; Expense / Income /
  Transfer); botones y títulos de cabecera caben en una línea de un iPhone de 320 pt. Si
  un texto nuevo no entra, se acorta la palabra, no se achica la fuente ni se trunca.
- **Categorías predeterminadas.** Muestran su nombre en el idioma de la interfaz
  ("Comida" → "Food") sin cambiar el texto guardado ni su identidad; una categoría
  creada o renombrada por la persona se muestra siempre como la escribió.
- **Errores.** Se traducen al mostrarse, así un error visible sigue un cambio de idioma.
- **Cabeceras.** Los títulos salen del catálogo y cambian en el lugar, sin reiniciar la
  pila de navegación.

## Producto 23.1A — idioma y región (sin rediseño)

- **Dos preferencias independientes.** Idioma (las palabras) y región (separadores,
  orden de la fecha numérica, reloj de 12 o 24 h, qué moneda es un "$" solo). Cada una
  sigue al dispositivo por defecto. Nunca cambian la moneda de una cuenta ni un dato
  guardado.
- **Más → App y datos → Idioma.** `NavigationRow` con glifo neutro y el valor en uso como
  subtítulo ("Español · según el dispositivo"). La pantalla es una lista agrupada de
  `CheckRow`: la forma de la fila de navegación con una tilde azul en lugar del chevron,
  "Según el dispositivo" primero con lo que da el dispositivo ahora, después los idiomas
  por su propio nombre. Un háptico de selección; ningún botón Guardar: elegir es guardar,
  y si no se pudo guardar la tilde no se mueve y se explica.
- **Solo lo que funciona.** Un idioma sin traducción completa no aparece, ni siquiera
  deshabilitado. La fila Región no aparece hasta 23.1C, porque el campo de importe todavía
  escribe con separadores argentinos.
- **Cambio en el lugar.** Cambiar el idioma o la región vuelve a dibujar los textos en la
  misma pantalla: no se reinicia la app, no se pierde la navegación, un borrador ni la
  conversación del Asistente, y no hay animación propia (solo el cambio de texto).

## Producto 22.1 — claridad y formularios (sin rediseño)

- **Fila de navegación.** Tile tintado (Finanzas) o glifo neutro en una columna fija de
  30 pt (App y datos), título en peso 600 como línea principal, descripción debajo en
  footnote secundario, chevron; cada texto puede partirse en dos líneas antes de
  truncar y el par se lee como una sola etiqueta de VoiceOver. Nunca más título y
  descripción compitiendo en la misma línea. `DetailRow` sigue para pares dato/valor.
- **Notas de campo.** Una línea corta bajo el campo ("Opcional. No cuenta como
  ingreso.") y un glifo de información que abre la explicación completa en una alerta
  nativa: se divulga, no se recorta.
- **Moneda.** Una fila agrupada "Moneda · Pesos argentinos · ARS" con chevron y una hoja
  con las dos monedas del libro, tilde en la actual y una nota de por qué son dos. Es la
  semilla de la pantalla de monedas con búsqueda de la próxima fase.
- **Estados vacíos.** Una tarjeta serena: glifo de 44 pt, título title3, una línea.

## Producto 22 — alcance con el pulgar y material nativo

*Registro. Reemplazado por la decisión 005 (2026-09-30) en tres puntos: el Asistente ya no es la pestaña central (hay
cuatro pestañas y el Asistente se abre desde el «+»), el cobalto pasó a ser el pino de Forest, y la barra de pestañas
sí es una superficie de control (el dock, vidrio teñido de pino donde iOS lo dibuja). Ver «Producto 24UX6A».*

- **Pestañas.** Inicio, Movimientos, **Asistente**, Reportes, Más. El centro inferior
  es el punto equidistante para el pulgar derecho y el izquierdo y queda dentro de la
  zona cómoda en un iPhone chico y en uno grande; la fila de acciones de Inicio vive en
  el tercio superior, con su primer botón lejos del pulgar derecho y el último lejos del
  izquierdo. El ícono es sparkles (relleno al estar activo), en la misma familia que los
  demás; nada lo agranda ni lo colorea distinto. Tarjetas pasa a Más → Finanzas, segunda
  fila, tile grafito con el mismo sistema contenido; Más no se vuelve un arcoíris.
- **Inicio conserva Asistente** como primera acción rápida mientras la capacidad es
  nueva; ambas entradas llevan a la misma conversación (la pestaña, sin apilar copias).
- **Material.** Dos superficies de control, y solo dos: los cuatro círculos de Inicio y
  la píldora del compositor. En iOS 26, con la API presente y sin Reducir transparencia,
  se dibujan con Liquid Glass nativo en estilo regular (cuerpo suficiente detrás de un
  glifo o de un campo de texto); el Asistente lleva un lavado cobalto al 25 % y ningún
  anillo, porque el material ya trae el borde. Eso ocurre solo en un development build:
  Expo Go siempre usa el material opaco y no carga el módulo de vidrio (una decoración
  jamás puede cerrar la app). En cualquier otro caso se mantiene el material opaco de
  Producto 21 tal cual: no es un estado roto, es el diseño para esos dispositivos. El pie
  de Más dice qué material se dibuja y por qué. Los glifos conservan sus colores semánticos; el botón de enviar sigue
  siendo cobalto sólido sobre el vidrio. La respuesta al toque sigue siendo la escala
  0,97; nunca opacidad, que apaga el vidrio.
- **Sin vidrio.** Filas de movimientos y categorías, listas agrupadas, tarjetas de
  Reportes, segmentados y píldoras de filtro (el seleccionado sigue en cobalto), la
  tarjeta de borrador y la evidencia del Asistente, cabeceras y barra de pestañas (la
  barra JS sigue opaca; una UITabBar del sistema con material nativo es trabajo de la
  fase de development build, no una capa de vidrio forzada encima).

## Producto 24UX1 — la entrada de la hoja de fecha, auditoría de Inicio y dirección nativa

*Registro. Reemplazado por la decisión 005 (2026-09-30) en la barra de pestañas (el Asistente al centro), el cobalto y
los neutros de Interfaz 17 que se citan aquí: hoy rigen cuatro pestañas, el «+» y Forest. La entrada de la hoja de
fecha sigue vigente. Ver «Producto 24UX6A».*

### La hoja de fecha: por qué aparecía de golpe y cómo entra ahora

El propietario vio en el iPhone que la tarjeta de 24B6 estaba casi en su sitio en muy pocos
fotogramas (segundo 91 del video). La causa no era la geometría sino el orden: `BottomSheet`
(`src/ui/form-controls.tsx`) montaba el modal (`setShown(true)`) y arrancaba `withTiming(1)` en el
mismo efecto. Un `Modal` de React Native con `visible=false` no renderiza nada, y el nativo lo
presenta recién cuando la vista llega a la ventana (`didMoveToWindow` → `presentViewController`,
con `onShow` al completar): entre uno y cuatro fotogramas después de arrancar el timing. La curva
ease-out del sistema (0,23, 1, 0,32, 1) recorre el 33 % del trayecto en el primer fotograma, el
60 % en el segundo y el 78 % en el tercero, así que el primer fotograma pintado ya mostraba la
tarjeta arriba y el resto aterrizaba en dos o tres más. Con Reduce Motion, además, `timing()`
daba duración 0: la hoja aparecía instantáneamente, sin el fundido prometido.

Ahora el orden es montar, medir y presentar, y recién entonces subir: el modal se monta con la
tarjeta una altura de ventana por debajo del borde (fuera de pantalla sea cual sea su alto) y el
velo transparente; la subida arranca cuando iOS presentó el modal (`onShow`) **y** midió la
tarjeta (`onLayout`), en cualquier orden, desde su altura real, sin saltos por una altura
adivinada. La curva es la de las hojas de iOS (0,32, 0,72, 0, 1) a 300 ms (`easeSheet`,
`duration.sheet`), la salida 200 ms (`duration.sheetExit`); el velo sigue el mismo progreso.
Con Reduce Motion la tarjeta se funde en su sitio con las mismas duraciones (`sheetTiming`
conserva el tiempo: un fundido necesita su tiempo, la aparición instantánea es justamente el
cambio brusco que evita). La política de Reanimated va explícita (`reduceMotion: Never`, revisión
de la PR #54): un `withTiming` sin política sigue el ajuste del sistema y, con Reduce Motion
activo, aterriza en el valor final en un fotograma sea cual sea la duración, así que el fundido
habría sido instantáneo; la app decide sola qué quitar (el desplazamiento) desde su propia
lectura del ajuste. El test emula esa política con los valores del enum del paquete instalado. La tarjeta queda montada mientras sale y se desmonta al terminar; una
salida interrumpida por volver a abrir nunca desmonta ni deja un modal invisible bloqueando el
formulario; un `onShow` tardío de un modal ya descartado no levanta nada. Nada cambia en las
demás hojas ni en la semántica de las fechas (Cancelar descarta, Listo guarda). Pruebas en
`tests/date-field.node.ts` (orden presentar/medir en ambos sentidos, cierre antes de presentar,
reapertura a mitad de salida, Reduce Motion como fundido con duración); lo que solo el iPhone
puede juzgar está en `docs/mobile-device-checklist.md` (Producto 24UX1).

### Auditoría de Inicio (sin rediseño general)

La composición de Inicio se conserva tal cual: control Gastos / Disponible con la moneda
discreta a su derecha cuando hay más de una, el nombre del mes o «Saldo registrado» y el número
principal, las cuatro acciones redondas, el presupuesto del mes si existe, «En qué gastaste»,
los próximos compromisos si los hay y los últimos movimientos. El propietario está conforme con
esa estructura; esta entrega la mide con el sistema visual actual (`app/(tabs)/index.tsx`,
`src/ui/quick-actions.tsx`, `src/ui/home-modules.tsx`, `src/ui/components.tsx`,
`src/ui/palette.ts`, `src/ui/theme.ts`) y corrige solo lo pequeño y demostrable. Nada de esto
es una captura del iPhone: los contrastes son cálculo WCAG 2 sobre los tokens (`tests/theme.node.ts`),
las medidas son las del código.

**Hallazgos, por gravedad.**

1. **Texto secundario por debajo de AA en claro (corregido).** `secondary` claro (#6E7078)
   daba 4,42:1 sobre el fondo #F2F2F6 y 4,27:1 sobre el relleno #EEEEF3. Sobre el fondo van el
   nombre del mes y «Saldo registrado» (subhead 15 pt, `index.tsx`), la leyenda «N cuentas»
   (footnote 13 pt), las cuatro leyendas de las acciones (caption 12 pt, peso 500,
   `quick-actions.tsx:74`) y las dos frases vacías de categorías y movimientos (subhead 15 pt);
   sobre el relleno, la etiqueta no elegida del segmentado (13 pt, `components.tsx:358`). El
   test de tema solo medía el secundario sobre la superficie blanca (4,94:1). Ahora `secondary`
   claro es #66686F: 4,98:1 sobre fondo, 5,56:1 sobre superficie, 4,81:1 sobre relleno. En
   oscuro no cambia nada (#A0A0A8: 8,1:1 / 6,6:1 / 5,4:1). Sigue habiendo tres escalones de
   tinta (tinta, secundario, terciario), verificados.
2. **Terciario por debajo de 3:1 para glifos y cifras grandes en claro (corregido).**
   `tertiary` claro (#8E9098) daba 2,85:1 sobre el fondo y 3,19:1 sobre la superficie. Sobre el
   fondo van los centavos del importe héroe (44 pt en negrita: texto grande, umbral 3:1) y el
   glifo de información de Disponible (18 pt, un control). Ahora `tertiary` claro es #84868D:
   3,26:1 sobre fondo, 3,64:1 sobre superficie, 3,14:1 sobre relleno; los chevrons y los
   marcadores de posición de toda la app ganan lo mismo. El glifo de información de Inicio
   (`MetricHelp`) pasa además a secundario, porque es algo que se toca (4,98:1), no una
   decoración; `InfoButton` de los formularios conserva el terciario y queda para revisar con
   la misma regla en su propia entrega. Ambos tokens quedan pinneados con umbrales en
   `tests/theme.node.ts`; el color del glifo, en `tests/home-ranking.node.ts`.
3. **Dos entradas al Asistente en la misma pantalla (documentado, sin cambio).** La primera
   acción redonda y la pestaña central llevan a la misma conversación (`quick-actions.tsx:52`,
   `app/(tabs)/_layout.tsx:39`). Producto 22 lo decidió así mientras la capacidad fuera nueva.
   Con el Asistente como función central, la redundancia se vuelve visible: es la única acción
   que existe dos veces en Inicio. No se retira sin comparación visual (abajo).
4. **Las cuatro acciones y el pulgar (documentado).** La fila vive en el tercio superior:
   con una mano, Gasto (la más frecuente) está a unos 200 pt del borde inferior en un iPhone
   de 6,1″, fuera de la zona cómoda; la entrada alcanzable de Inicio es la pestaña central, que
   es el Asistente, no Gasto. Movimientos tiene el «+» en la cabecera, aún más lejos. No se
   introduce navegación nueva; es un dato para la comparación.
5. **Espacio vacío con una moneda sin datos en el mes (documentado).** Con una moneda que no
   tiene movimientos este mes, Inicio muestra «$ 0,00», las cuatro acciones y dos secciones
   seguidas con solo una frase gris cada una («Tus categorías aparecerán cuando registres un
   gasto este mes.» y «Todavía no hay movimientos este mes.»), cada una con su enlace de
   sección (Reportes, Ver todo) que abre una pantalla sin datos de ese mes. Son dos frases
   que dicen casi lo mismo a 24 pt de distancia. Con un libro sin cuentas, el `EmptyState`
   único ya está bien. Se propone unificar el estado vacío del mes (abajo); no se cambia la
   composición ahora.
6. **Tamaño de las leyendas de las acciones (aceptable).** Caption 12 pt con peso 500 y dos
   líneas posibles; es el mínimo del sistema (las pestañas van a 10 pt). Con Dynamic Type
   escala sin tope (`allowFontScaling` por defecto) y las columnas flexionan; el círculo de
   54 pt no escala. Correcto; el iPhone debe confirmar que a los tamaños de accesibilidad
   mayores «Transferir» parte en dos líneas y no se recorta.
7. **Jerarquía y espaciado (correctos).** 44 pt en negrita para el importe con símbolo y
   centavos en escalones, 15 pt para su leyenda, 17 pt semibold para los títulos de sección,
   24 pt entre bloques (`Screen gap={space.xxl}`) y 20 pt dentro del bloque del héroe. Nada
   compite con el número; el control segmentado tiene 232 pt de ancho máximo para que la
   moneda quepa a su lado sin un selector grande.
8. **Accesibilidad (correcta).** Cada acción tiene su etiqueta completa («Registrar gasto»);
   el importe héroe es un solo elemento que se lee con unidad y moneda; el glifo de ayuda dice
   «Qué significa Disponible»; los títulos de sección llevan rol de encabezado; las filas de
   categoría dicen nombre, importe y participación. Los segmentos exponen `selected`.
9. **Fuera de Inicio, misma regla (nota).** La barra de pestañas pinta las inactivas en
   terciario a 10 pt (`_layout.tsx:29-31`): 3,64:1 en claro y 4,11:1 en oscuro sobre la
   superficie, por debajo de AA para texto de ese tamaño. Es la barra, no Inicio; queda
   anotado para la entrega de la barra nativa.

**Lo que cambió.** Dos tokens claros (`palette.ts`), el color del glifo de ayuda de Disponible
(`home-modules.tsx`) y sus pruebas. Ningún golden de importes, rutas o copy; ninguna cadena
nueva. El iPhone debe confirmar que el secundario más oscuro no endurece las leyendas de las
acciones ni las filas en claro, y que el terciario sigue leyéndose como «apagado» en los
centavos del héroe.

**Propuestas para una iteración con comparación visual (no implementadas).** Cada una requiere
dos capturas del mismo estado, claro y oscuro, en un iPhone de 6,1″ y en uno de 6,7″, al tamaño
de texto por defecto y al mayor de accesibilidad:
- *Asistente sin duplicado.* A: la fila actual (Asistente, Gasto, Ingreso, Transferir). B: tres
  acciones (Gasto, Ingreso, Transferir) y, en el lugar del Asistente, una fila conversacional de
  ancho completo bajo las acciones («Contale al Asistente…», con el glifo sparkles y el
  micrófono) que abre la pestaña central con el compositor enfocado. C: la fila actual con el
  Asistente en el centro. Comparar: reconocibilidad del Asistente como función central,
  alcance con el pulgar, y si B se lee como un campo de búsqueda (riesgo).
- *Estado vacío del mes.* A: las dos frases actuales. B: un solo bloque «Este mes todavía no
  hay movimientos en ARS» con la acción Gasto como botón secundario, y los títulos de sección
  ocultos hasta que haya datos. Comparar en un libro con datos en otra moneda y en otro mes.
- *Escalones del secundario.* A y B con los tokens anteriores y los nuevos, misma pantalla, para
  cerrar el punto 1 en el dispositivo.

## Producto 24UX2 — identidad de comercios y refinamiento de Inicio

*Registro. Reemplazado por la decisión 005 (2026-09-30) en las cuatro acciones de Inicio, la pestaña central del
Asistente y el cobalto: hoy rigen el «+» y su hoja, cuatro pestañas y Forest. Siguen la identidad de comercios, la fecha
una vez en las filas de compromisos y el título vacío que nombra la moneda. Ver «Producto 24UX6A».*

Sin rediseño general: Inicio conserva Gastos / Disponible, el importe grande, la moneda discreta
cuando hay varias, las cuatro acciones, las categorías, los próximos compromisos y los últimos
movimientos. No se agregó ningún módulo. Todo lo que sigue es cálculo sobre el código y los
tokens, no una captura del iPhone.

### Auditoría de Inicio

| Punto | Hallazgo | Decisión |
| --- | --- | --- |
| Acciones rápidas | Cuatro discos de 54 pt con sombra (el del Asistente con halo cobalto) debajo del héroe: el bloque con más peso visual después del número, y el cobalto compite con el contenido financiero. | **Cambiado** (alternativa A, abajo): 48 pt, sin sombra ni halo, borde fino; glifos 22/20 pt; el Asistente conserva el tinte cobalto suave. |
| Bloques de color | Los lavados de categoría (8 % claro, 11 % oscuro) y la barra del presupuesto ya son discretos. El bloque más saturado era el disco del Asistente con sombra cobalto. | Resuelto con las acciones; lavados sin cambio. |
| Metadatos redundantes | Próximos compromisos mostraba la fecha dos veces («1 oct · Banco» a la izquierda y «En 11 días» a la derecha); Recurrentes igual («Mensual · 1 oct · Banco» + «En 11 días»). Con una sola cuenta en la moneda, cada fila de Inicio repetía su nombre. | **Cambiado**: la fecha una vez, junto al importe («Hoy», «Mañana», «En N días» hasta 7, después la fecha); a la izquierda la categoría (señal secundaria) y la cuenta solo si hay otra de la misma moneda. |
| Estados vacíos | Un mes sin movimientos en la moneda mostraba dos frases casi iguales a 24 pt («Tus categorías aparecerán…» y «Todavía no hay movimientos…»), hallazgo 5 de 24UX1. | **Cambiado**: una sola frase bajo Últimos movimientos, con la moneda cuando hay varias («Todavía no hay movimientos en USD este mes.»); En qué gastaste vuelve con el primer gasto (con `Reflow` que funde). Con solo un ingreso el bloque de categorías sigue con su frase. |
| Contraste secundario | Las etiquetas inactivas de la barra de pestañas (10 pt) en terciario: 3,6:1 claro, 4,1:1 oscuro (hallazgo 9 de 24UX1). Las filas pausadas de Recurrentes al 60 % de opacidad bajaban su leyenda por debajo de AA. | **Cambiado**: pestañas inactivas en secundario (5,6:1 / 6,6:1 sobre la barra); filas pausadas con tinta plena y «Pausado» donde iría el día. |
| Jerarquía y proximidad | Héroe 44/700, títulos de sección 17/600 a 8 pt de su contenido, 24 pt entre bloques: la sección se lee como grupo y los bloques se separan. | Sin cambio (24UX1 punto 7). |
| Una mano | Gasto en el tercio superior, fuera de la zona cómoda; la entrada alcanzable es la pestaña central (Asistente). | Documentado; lo resuelve la alternativa B si el propietario la aprueba. |
| Scroll, Dynamic Type, VoiceOver, Reduce Motion | `Screen` con scroll nativo; filas apiladas con texto grande (`useStacked`); leyendas de acción a dos líneas; etiquetas de VoiceOver completas (el próximo compromiso ahora nombra la categoría; una regla pausada dice «pausado» y no anuncia fecha); `Reflow` funde con Reduce Motion. | Sin regresión; confirmar en iPhone. |
| Cobalto | Pestaña activa, segmentos elegidos, enlaces de sección y el Asistente: interacción y navegación. Ningún importe ni texto normal en cobalto. | Correcto; el halo del Asistente fue lo único que competía. |

### Dos alternativas para las acciones (comparación)

Ambas usan componentes y tokens existentes. **A está implementada; B cambia la estructura de
Inicio y queda pendiente de la aprobación del propietario.**

```
A · cuatro acciones, menos peso (implementada)   B · tres movimientos + Asistente en fila (propuesta)
┌─────────────────────────────────────┐          ┌─────────────────────────────────────┐
│ [Gastos|Disponible]         ARS|USD │          │ [Gastos|Disponible]         ARS|USD │
│ Septiembre                          │          │ Septiembre                          │
│ $ 123.456,78                        │          │ $ 123.456,78                        │
│                                     │          │                                     │
│  (✦)     (−)     (+)     (⇄)        │          │   (−)        (+)        (⇄)         │
│ Asist.  Gasto  Ingreso Transferir   │          │  Gasto     Ingreso   Transferir     │
│  48 pt, planos, borde fino          │          │ ┌─────────────────────────────────┐ │
│                                     │          │ │ ✦  Contale al Asistente…     🎙 │ │
│ En qué gastaste            Reportes │          │ └─────────────────────────────────┘ │
│ …                                   │          │ En qué gastaste            Reportes │
└─────────────────────────────────────┘          └─────────────────────────────────────┘
```

| | A | B |
| --- | --- | --- |
| Diferencia visual | Misma fila, discos 48 pt sin sombra; el héroe gana peso relativo. | Un disco menos; una fila conversacional de ancho completo (52 pt, material opaco, glifo sparkles cobalto, micrófono) que abre la pestaña central con el compositor enfocado. |
| Ventajas | Cero cambio de estructura ni de navegación; nada que reaprender. | El Asistente deja de estar duplicado como botón y se lee como lo que es (hablar de tu plata); las tres columnas de movimiento son más anchas. |
| Riesgos de accesibilidad | Disco más chico: el objetivo real es la columna (≈80 × 76 pt), sigue ≥ 44 pt; confirmar que «Transferir» a tamaños de accesibilidad parte en dos líneas sin recorte. | VoiceOver debe anunciarla como botón («Abrir el Asistente»), no como campo de texto; con texto grande la fila crece en alto; riesgo de que se lea como un buscador (probar con personas). |
| Una mano | Sin cambio. | Sin cambio para Gasto; la fila del Asistente es igual de alta en pantalla. |
| Costo | Hecho en esta entrega. | Un componente nuevo en `quick-actions.tsx`, parámetro de foco en la ruta del Asistente, pruebas de harness y de VoiceOver. |

### Identidad de comercios en pantalla

**Decisión del propietario (revisión de la PR #56): la categoría y su glifo son la presentación
de producción; mostrar marcas queda diferido a Producto 25C2**, que antes debe resolver licencia,
privacidad, mantenimiento y coherencia visual (marcas multicolores junto a los tonos apagados de
categoría y los colores semánticos). No hay logos empaquetados ni assets de marcas, ni subidas de
usuarios, ni claves de proveedores. La identidad de comercios queda como metadata tipada.

Cada fila de movimiento, cada regla de Recurrentes, cada próximo compromiso y el detalle de un
movimiento dibujan `MerchantBadge`, que en producción es el glifo de la categoría para todo
comercio: nada cambia visualmente en el tile. El nombre mostrado es siempre el que escribió la
persona; la categoría sigue en la leyenda de la fila. Solo en desarrollo,
`EXPO_PUBLIC_MERCHANT_MARK_PREVIEW=1` dibuja la inicial de una marca reconocida en un tile neutro
(sin assets ni dependencias) para validar la resolución en el iPhone: «App Store» se reconoce,
«Apple» no. Modelo, catálogo, reglas contra coincidencias ambiguas y la revisión de proveedores
(insumo para 25C2) en [merchant-identity.md](merchant-identity.md).

### Compromisos: estimado, registrado, pausado, historial

- **Próximo pago estimado**: el importe con «Hoy», «Mañana», «En N días» o la fecha; ámbar solo
  hoy y mañana. Nada registrado. *(→ 24UX6E: ámbar solo en un gasto, hoy y mañana; un ingreso no es una obligación.)*
- **Pago registrado**: un movimiento normal. El detalle de la regla lista «Registrados» (los
  movimientos que la regla registró, los doce más recientes y un conteo del resto) con la nota de
  que la próxima fecha es una estimación; el detalle del movimiento muestra «Recurrente · Mensual»
  y abre la regla.
- **Suscripción pausada**: en Pausados, tinta plena, «Pausado» en lugar del día, VoiceOver dice
  «pausado».
- Los recurrentes se registran solos (decisión del propietario, revisión de la PR #59): no hay
  conciliación ni confirmación por regla, ni ahora ni en el roadmap (merchant-identity.md §5).

### Lo que cambió visualmente (para comparar en el iPhone)

1. Las cuatro acciones de Inicio: 54 → 48 pt, sin sombra en claro, sin halo cobalto en el
   Asistente, borde fino; glifos 24 → 22 pt (Asistente 22 → 20); separación círculo-leyenda 8 → 6
   pt; tinte del vidrio del Asistente 25 % → 20 %.
2. Próximos compromisos: leyenda izquierda = categoría (· cuenta si hay otra en la moneda); la
   fecha solo a la derecha.
3. Últimos movimientos de Inicio: sin el nombre de la cuenta cuando es la única de la moneda.
4. Mes vacío: una frase en vez de dos; sin el título En qué gastaste hasta el primer gasto.
5. Recurrentes: leyenda «Mensual · Categoría · Cuenta», día a la derecha (fecha después de una
   semana), pausadas sin opacidad.
6. Detalle de una regla: sección Registrados. Detalle de un movimiento de una regla: fila
   Recurrente.
7. Barra de pestañas: etiquetas inactivas en secundario.
8. El pie de Más dice Producto 24UX2.

## Producto 24UX3 — jerarquía de Inicio

*Registro. Reemplazado por la decisión 005 (2026-09-30) en Inicio: salieron «En qué gastaste» con sus lavados de
categoría, las píldoras y la entrada del Asistente (que llevaba a una pestaña central que ya no existe); el número es de
46 pt y el cobalto es el pino de Forest. Siguen «Próximos compromisos», «Actividad reciente» (antes «Últimos
movimientos») y las píldoras del detalle de una cuenta. Ver «Producto 24UX6A».*

Sin rediseño desde cero y sin módulos nuevos: la misma estructura (título, Gastos / Disponible,
la moneda a la derecha, el número, las acciones, las secciones), con un solo punto focal y menos
cosas compitiendo. Reemplaza lo dicho sobre las acciones de Inicio en Producto 21, 22 y 24UX2:
el propietario aprobó la alternativa B de 24UX2. Todo lo que sigue es código y cálculo sobre los
tokens, no una captura del iPhone.

```
┌─────────────────────────────────────┐
│ Inicio                              │
│ [Gastos|Disponible]      [ARS|USD]  │  compactos: 32 pt, elegido en tinta
│                                     │  28 pt de aire
│ Septiembre                          │
│ $ 123.456,78                        │  48 pt (44 en el resto de la app)
│                                     │  32 pt
│ (− Gasto) (+ Ingreso) (⇄ Transferir)│  píldoras de 40 pt, glifo en su color
│ ( ✦  Contale al Asistente       › ) │  52 pt, lavado de marca, filo cobalto
│                                     │
│ En qué gastaste          Reportes › │  resumen compacto: tarjeta, filas 52 pt
│ Próximos compromisos    Ver todos › │  agenda abierta: marcas de 32 pt, el día
│ Últimos movimientos     Ver todos › │  libro abierto: marcas de 40 pt, importes
└─────────────────────────────────────┘
```

**Qué cambió y por qué mejora la jerarquía.**

1. **Cabecera más liviana.** El segmentado y la moneda usan la variante `compact` (32 pt en
   vez de 36, 44 pt de objetivo con el `hitSlop`), la etiqueta elegida en tinta sobre un pulgar
   elevado, como el control nativo, y en oscuro la pista es el escalón de superficie, no el
   relleno más claro. Antes la cabecera tenía dos palabras cobalto encima del número.
2. **El número respira.** 48 pt en Inicio (los otros héroes siguen en 44), 28 pt entre la
   cabecera y el mes, 32 pt entre bloques (antes 20 y 24). `Money` sigue ajustando un importe
   largo al ancho y limitando Dynamic Type.
3. **Movimientos como píldoras.** Gasto, Ingreso y Transferir son tres cápsulas de igual ancho y
   40 pt (el objetivo de toque es de 44), en el escalón de superficie con filo fino, el glifo en
   su color semántico y la etiqueta en tinta. Pesan menos que los discos con leyenda y ocupan una
   sola línea. En un iPhone angosto la etiqueta se achica hasta 80 % en vez de partirse; con los
   tamaños de accesibilidad las píldoras se apilan a todo el ancho y la etiqueta parte. Detalle de
   cuenta usa la misma fila.
4. **El Asistente, una sola entrada ancha.** Debajo de los movimientos, más cerca del pulgar que
   la fila anterior: una cápsula de 52 pt a todo el ancho sobre `primaryWash` (la superficie
   apenas enfriada por la marca: #151B2C oscuro, #F5F8FF claro) con filo cobalto fino, el glifo
   sparkles en un disco `primarySoft`, «Contale al Asistente» en tinta y un chevron. Es un botón,
   no un campo: sin texto gris de marcador, sin cursor, sin micrófono, para que no se lea como un
   buscador. Con Liquid Glass es vidrio regular con un lavado cobalto al 15 %. Navega a la pestaña
   central (la misma conversación) con la moneda de Inicio; VoiceOver dice «Contale al Asistente,
   botón» y una pista de qué hace. La pestaña central sigue siendo la entrada persistente.
5. **Tres secciones, tres formas.** «En qué gastaste» es un resumen compacto: la única tarjeta,
   filas de 52 pt (antes 64) con glifos de 32 pt y nombre e importe a 15 pt, los lavados de
   siempre. «Próximos compromisos» es una agenda: sin tarjeta, las filas sobre el fondo alineadas
   con el título, marca de 32 pt, filete que empieza bajo el texto y respuesta al toque por
   atenuación. «Últimos movimientos» es el libro (abierto desde la revisión, abajo).
6. **Enlaces de sección silenciosos.** Reportes, Ver y Ver todo en footnote, tinta secundaria y
   un chevron secundario (`SectionTitle quiet`), con objetivo de 44 pt. Siguen en el mismo lugar y
   abren lo mismo; el resto de la app conserva el enlace cobalto.
7. **Menos cobalto a la vez.** En Inicio quedan el glifo y el filo del Asistente y la pestaña
   activa. El presupuesto sigue en tinta, ámbar o coral según su estado.

**Revisión en el iPhone (misma entrega).** El ritmo tarjeta → lista → tarjeta hacía que
Próximos compromisos cortara el flujo entre dos bloques pesados, y en Reportes «Dónde más
gastaste» repetía la losa agrupada de las categorías. Cambios:

- **Una sola tarjeta, después contenido liviano.** «Últimos movimientos» pasa a libro abierto
  sobre el fondo (`EntryRow plain`: sin padding de celda, filete bajo el texto, atenuación al
  tocar). Se distingue de la agenda por densidad y contenido: filas completas de 64 pt con marcas
  de 40 pt e importes con signo, frente a filas de 56 pt, marcas de 32 pt y el día en ámbar.
- **Reportes.** «Dónde más gastaste» es una lista ordenada abierta (número, marca de 32 pt,
  filete bajo el texto, filas de 60 pt); la dona y la lista de categorías no cambian. Sus filas
  siguen sin ser tocables, como antes.
- **Estado de la cabecera más claro, sin cobalto.** El pulgar del segmentado compacto es un token
  propio, `thumb` (#3A3A3E en oscuro, un escalón visible sobre la pista #1C1C1E; blanco en claro),
  con filo fino; la etiqueta elegida en tinta semibold y las otras en medium. El chip de moneda de
  tres o más monedas suma un filo fino.
- **Enlaces.** Siguen silenciosos; el chevron pasa de terciario a secundario para que se lea
  como algo que se toca.
- **Asistente.** Sin cambios: funcionaba.

El ritmo resultante es un bloque pesado (el resumen) seguido de dos listas que cambian de
densidad, en vez de dos losas iguales con una lista en medio.

**Lo que no cambió a propósito.** La estructura y el orden de Inicio, qué muestra cada sección y
cuántas filas, los destinos de navegación, el presupuesto del mes, el estado vacío, los lavados de
categoría y su revelado, el contenido de las filas de movimientos, Reduce Motion (los mismos `Reflow` y
`ValueTransition`), los colores semánticos y la barra de pestañas. Ningún cálculo, dato o contrato.

**Textos.** Reportes pierde dos subtítulos: «Por importe registrado en el período» (repetía el
título) y «Hechos de tus registros, no consejos» (texto de descargo). La nota de Más sobre el
guardado local se conserva: es información de estado, no ruido.

**Riesgos a mirar en el iPhone.** Que las píldoras no se lean como filtros; que la entrada del
Asistente se lea importante sin volverse un banner; que «Transferir» no se achique de más en un
iPhone de 375 pt; que la agenda y el libro abiertos se distingan entre sí por densidad y no se
lean como una sola lista larga.

## Producto 24UX4 — gestionar recurrentes y deudas

Pausar, reanudar y eliminar una regla; saldar, cerrar, reabrir y eliminar una deuda. Las mismas
acciones viven en dos lugares, como en iOS: un deslizamiento hacia la izquierda sobre la fila y
botones al final del detalle. Nada nuevo en Inicio, Movimientos ni Reportes.

### Acciones al deslizar (`src/ui/swipe-actions.tsx`)

- **Solo al final de la fila** (trailing), como Mail y Recordatorios. La fila sigue al dedo 1:1
  (Gesture Handler en el hilo de UI); se abre si se suelta pasada la mitad de las acciones y se
  cierra si no. **Sin deslizamiento completo**: arrastrar hasta el borde nunca ejecuta nada, así
  que eliminar siempre pasa por un toque y una confirmación.
- **Una fila abierta a la vez**: abrir otra cierra la anterior. Tocar una acción cierra la fila y
  después actúa.
- **Botones sólidos de 76 pt** con glifo y etiqueta blanca en una línea (crecen con el texto
  grande): gris para lo reversible (Pausar, Cerrar), azul transferencia para lo que avanza (Reanudar,
  Saldar, Reabrir), rojo para Eliminar, siempre el último, en el borde. Tres tonos nuevos en la
  paleta (`swipeDestructive`, `swipeNeutral`, `swipeAccent`), más profundos en oscuro para que el
  blanco mantenga 4,5:1 (el rojo y el azul de texto quedaban en 3:1).
- **Sin ruido**: sin háptico al revelar (iOS no lo da); háptico de selección al pausar, cerrar o
  reabrir, de éxito al eliminar, como cualquier escritura. Con Reducir movimiento el dedo sigue
  moviendo la fila y el asentado es inmediato.
- **VoiceOver**: un deslizamiento no es un gesto que se pueda hacer sobre una fila con VoiceOver,
  así que las mismas acciones son acciones personalizadas de la fila (rotor «Acciones»).
- La fila de Recurrentes pierde su interruptor: pausar es una acción del deslizamiento y del
  detalle, y la fila queda con una sola superficie de control.

### En el detalle

- **Regla**: después de Registrados, «Pausar recurrente» / «Reanudar recurrente» (secundario) y
  «Eliminar recurrente» (secundario rojo). Actúan sobre la regla guardada, no sobre el borrador de
  arriba, y cierran el formulario; una regla pausada explica en una línea qué significa.
- **Deuda**: al final de la lista de pagos, «Cerrar deuda» / «Reabrir deuda» y «Eliminar deuda».
  Cerrar deja la pantalla abierta (el estado dice «Cerrada»); eliminar vuelve a Deudas. *(→ 24UX6E: el detalle ya no
  tiene la fila Estado; una deuda cerrada muestra la nota «Deuda cerrada» bajo el héroe y ninguna línea de
  vencimiento; «Cerrada» queda en la fila de la lista.)*

### Confirmaciones

Una alerta nativa con Cancelar y la acción en rojo. El título nombra lo que se elimina con el texto
de la persona («¿Eliminar «Netflix»?», «¿Eliminar la deuda con Juan?»); el mensaje dice lo que
queda: cuántos movimientos, pagos o cobros siguen en Movimientos, o que no se borra ninguno. Cerrar
una deuda saldada no pregunta; cerrarla con saldo pendiente sí (dice el monto: deja de figurar como
pendiente sin registrar un pago), con un botón no destructivo.

### Estados

- **Deuda cerrada**: en una sección «Cerradas» al final de Deudas («No cuentan como pendientes»),
  fuera de los totales, con «Cerrada» donde iría el vencimiento. Antes se «archivaba» y quedaba
  inaccesible.
- **Eliminada** (regla o deuda): sale de toda lista, total y enlace; el movimiento o la
  transferencia que produjo sigue igual y ya no enlaza a la regla o la deuda.
- **Saldar** abre el formulario de pago revisado con todo el saldo escrito; la persona elige la
  cuenta y confirma. Nunca se marca pagada sin una transferencia registrada.

## Producto 24UX5 — consistencia visual, textos y auditoría de recurrentes

Sin rediseño: la estructura de Inicio que el propietario aprobó en el iPhone queda igual (título,
Gastos / Disponible, la moneda, el número, las tres píldoras, el Asistente, el orden de las secciones,
la tarjeta de categorías seguida de las dos listas abiertas). Se terminan detalles de consistencia, se
recortan textos redundantes y se fijan con tests los estados que las capturas no mostraban. Código y
cálculo sobre los tokens; nada de esto está verificado en el iPhone.

### Enlaces secundarios: un token propio

`link` en `src/ui/palette.ts`: un azul pizarra desaturado para los enlaces de navegación secundaria de
Inicio (Reportes, Ver todos, Ver) y su chevron. Oscuro **#8EA7D8** (la referencia del propietario: 8,7:1
sobre negro, 7,0:1 sobre #1C1C1E); claro **#4A6390**, elegido por contraste medido (5,4:1 sobre el fondo
#F2F2F6, 6,0:1 sobre blanco). Tono ~218°, saturación muy por debajo del cobalto, así que se lee como
«se toca» sin sumar otro acento azul al lado del Asistente y la pestaña activa. `tests/theme.node.ts`
verifica el contraste, el tono y que quede lejos del primario, del azul de transferencia y de la tinta
secundaria. No se usa para controles, selección ni significado: los segmentados y el chip de moneda
siguen neutros, los colores de categoría, gasto, ingreso y transferencia no cambian. El resto de la app
conserva el enlace cobalto de `SectionTitle`.
*(Valores reemplazados por la decisión 005, 2026-09-30: en Forest `link` es el texto de marca pino, #1D5647 en claro
y #94D2BB en oscuro; ya no hay enlace cobalto ni azul pizarra.)*

### Filas de Inicio: una marca, dos densidades

| | Antes (24UX3) | Ahora (24UX5) |
| --- | --- | --- |
| Marca de Próximos compromisos | 32 pt | 40 pt, la misma columna que Últimos movimientos |
| Fila de la agenda | 56 pt, 10 pt de relleno, categoría siempre | 56 pt, 8 pt de relleno, leyenda solo si aporta |
| Fila del libro | 64 pt, «categoría · cuenta · fecha» | 64 pt, la fecha; categoría o cuenta solo si aportan |
| Enlaces de sección | tinta secundaria | `link` pizarra |

La variante es explícita: `EntryRow variant="home"` (antes `plain`); Movimientos, detalles de cuenta,
tarjeta, deuda y la historia de una regla siguen con la leyenda completa. La decisión vive en funciones
puras de `src/ui/presentation.ts`:

- `homeNamesCategory(nombre, categoría, glifoCompartido)`: la categoría vuelve a la leyenda cuando el
  nombre no alcanza (menos de tres caracteres, sin letras: «f», «a», «123»; genérico: «Varios», «Pago»,
  «Unknown») o cuando otra categoría en pantalla dibuja el mismo glifo (`sharedGlyphs`, calculado sobre
  las dos listas juntas). Un nombre que es la categoría («Transporte» en Transporte) nunca la repite.
- La cuenta aparece solo cuando **las filas visibles de esa lista** vienen de más de una cuenta
  (`visibleNamesAccount`, revisión de la PR #59). Tener dos cuentas en ARS no alcanza: si todo lo visible
  es de la misma, repetir «· a ·» en cada fila no dice nada. Cada lista decide con sus propias filas;
  Movimientos y los detalles siguen con `namesAccount`.

VoiceOver no pierde nada: la fila del libro sigue diciendo comercio, Gasto/Ingreso, importe, categoría,
cuenta y fecha; la de la agenda comercio, categoría, importe, el día estimado y la cuenta (antes la
cuenta se decía solo cuando se dibujaba). El detalle, los filtros y
la búsqueda siguen mostrando y encontrando todo.

**Búsqueda y notas.** Movimientos busca comercio, categoría guardada, el nombre localizado de la
categoría y la cuenta (`selectEntries`), y las transferencias también por su nota (`selectTransfers`).
Un gasto o un ingreso no tiene nota propia (`Entry` no la lleva): no se inventa soporte ni se migra el
esquema para esta entrega. Las notas buscables de gastos e ingresos quedan en la etapa de productividad
(roadmap, Producto 25C).

### Títulos y textos

- Inglés: «Where your money went» → **«By category»**. Español: se mantiene «En qué gastaste» (dice
  más que «Por categoría» y cabe).
- «Próximos compromisos» / «Coming up» y «Últimos movimientos» / «Latest transactions» se mantienen:
  son naturales, no ambiguos, y `SectionTitle` los parte en dos líneas antes que cortarlos; el enlace
  sigue alcanzable con el texto más grande.
- Reportes: «Tocá uno para ver los movimientos» (instrucción obvia) y la explicación de las flechas en
  el mes vacío salen; el vacío es una frase.
- Presupuestos: el vacío y «Sin límites por categoría» dejan de explicar dos veces qué es un sublímite
  (lo dice el formulario, junto al campo).
- Copia de seguridad: «piloto» / «piloto nativo» salen del texto visible y del error de versión.
- Más: el pie era diagnóstico del proyecto («Piloto nativo 0.1.0 · Producto 24UX4 · Material opaco ·
  Idioma: módulo nativo») para todos. Ahora es la línea de versión, como el «Acerca de» de iOS:
  «FinanzApp 0.1.0 (24UX5)»; el material y el origen del idioma aparecen debajo solo en una build de
  desarrollo (`__DEV__`). La nota de almacenamiento local se conserva, dicha como hecho: «Tus registros
  se guardan solo en este dispositivo y funcionan sin conexión. No se sincronizan con otros
  dispositivos.»

### Reportes: menos texto permanente, los mismos datos

- **Título del mes** (revisión de la PR #59). `textTransform: 'capitalize'` subía cada palabra y el
  iPhone mostraba «Septiembre De 2026». `formatMonthTitle` (en `src/i18n/format.ts`, también en
  `useI18n()`) sube solo la primera letra: «Septiembre de 2026», «September 2026». Lo mismo en
  Presupuestos, su formulario y la fecha larga del detalle de un movimiento o una transferencia
  («Martes, 22 de septiembre de 2026»). No queda ningún `capitalize` sobre texto localizado.
- **Sin ARS repetido.** La línea del período dice «Hasta hoy» (antes «Hasta hoy · ARS»): el chip de
  moneda y «Gastado · ARS» ya la nombran en la misma vista. El detalle de categoría conserva el código,
  porque ahí nada más lo dice (`reportPeriodLabel(…, withCurrency)`).

- **Metodología detrás de un botón.** El párrafo final («Solo movimientos registrados en ARS… Un mes sin
  registros no significa que no hayas gastado») pasa a un `InfoButton` junto a «Gastado · ARS»: «Qué
  cuenta este reporte», que además dice que no se convierte otra moneda. La advertencia sigue a un toque
  y la moneda sigue escrita junto al total.
- **Para tener en cuenta sin repetir.** «Tu mayor gasto fue X» no aparece cuando el ranking de arriba
  ya muestra esa misma compra (una fila de ese comercio con una sola compra: nombre, importe y categoría
  ya están en pantalla). Si el comercio tiene varias compras, el mayor gasto individual es un hecho
  adicional y se queda. Los avisos de presupuesto y los aumentos por categoría no se tocan
  (`insightsBesideRanking` en `src/ui/report-presentation.ts`).
- **Controles.** `IconButton` (flechas del mes, «+» de las cabeceras) medía 44 pt de ancho pero 24 de
  alto: ahora 44 × 44. «Este mes» suma 8 pt de `hitSlop` (44 pt de alto).
- Sin cambios: selector de moneda, período, importe, tendencia, dona, categorías, ranking abierto,
  accesos a detalle, fórmulas. Ninguna conversión.

### Recurrentes: un estado nuevo, solo si hace falta

Un atraso largo se registra solo, en lotes, con sus fechas (ver la auditoría en el roadmap, 24UX5). Solo
una regla activa que una falla real dejó con la próxima fecha en el pasado queda para revisar. En su fila dice **«Revisar»** en ámbar donde iría el día (antes decía «Hoy», que era
falso); su detalle explica desde cuándo no se registra y ofrece **«Continuar desde hoy»** (reanudar desde
hoy: no registra las fechas atrasadas). Los textos distinguen tres cosas: el movimiento que FinanzApp
anota («lo anota en tus movimientos cuando vence»), un pago o cobro del banco («no confirman un pago del
banco», «no paga ni cobra nada») y el próximo vencimiento («es una estimación»).

### Lo que no cambió a propósito

La estructura y el orden de Inicio, los destinos de navegación, el presupuesto del mes, los lavados de
categoría, las píldoras, el Asistente, el material, Reduce Motion (`Reflow`, `ValueTransition`, las
mismas claves: cambiar de moneda no remonta más de lo que remontaba), los colores de categoría y
semánticos, la barra de pestañas, las deudas fuera de Inicio. Literales de color que quedan en
componentes (no en pantallas): blanco sobre rellenos sólidos (acciones al deslizar, tarjetas de
crédito, marca elegida) y los filetes de las píldoras, el chip y el compositor; ningún `app/` tiene un
color propio.

## Pendiente de revisión en iPhone

- Producto 25A-06 B7, decisión A (en su rama; sin build de EAS): en la vista de prueba, la nota debajo de la respuesta
  para el comercio demasiado largo, en español y en inglés; el resto con el Asistente conectado
  (docs/mobile-device-checklist.md, «Producto 25A-04», «Over-long names»).
- Producto 25A-06 fase A (en su rama; sin build de EAS): nada visual que revisar ahora; solo la línea de versión
  «FinanzApp 0.1.0 (25A-06)». Se suma a 25A-07 y al control previo al lanzamiento (docs/mobile-device-checklist.md,
  «Producto 25A-06»).
- Producto 25A-05 (mergeada como PR #86; sin build de EAS): nada visual que revisar ahora. Cuando 25A-07 conecte una build de
  staging: una respuesta fuera de alcance aparece solo como texto, sin tarjeta ni acciones; los enlaces de una respuesta
  siguen siendo los de la evidencia local. Se suma a 25A-07 y al control previo al lanzamiento
  (docs/mobile-device-checklist.md, «Producto 25A-05»).
- Producto 25A-04 (mergeada como PR #85; sin build de EAS; diferida al control previo al lanzamiento): la tarjeta de vista de prueba
  sin acciones ni hoja y «Para revisar» vacío después; con el Asistente conectado (más adelante), la hoja de revisión que
  aparece sola después de guardar la propuesta, su tamaño ajustado y con texto grande, deslizarla hacia abajo sin
  descartar, Editar y volver a la hoja, Confirmar con un solo registro, «Descartar propuesta» con su pregunta, «Revisar»
  desde la tarjeta, «Registrado» y «Propuesta descartada». La lista exacta está en docs/mobile-device-checklist.md
  («Producto 25A-04»).

- Producto 25A-03 (mergeada como PR #84; sin build de EAS; nada revisado en el iPhone): la fila «Para revisar» de Más y la bandeja
  vacía, en claro y oscuro; el símbolo y los centavos del monto de Inicio en grafito, en claro y oscuro; VoiceOver, texto
  grande, Reduce Motion y Reduce Transparency. Todavía no hay quien produzca propuestas en la app (llega con 25A-04): las
  filas, Confirmar, Editar y Descartar se prueban en los tests automáticos, no en el iPhone. La lista exacta está en
  docs/mobile-device-checklist.md («Producto 25A-03»).
- Producto 25VIS1 (mergeada como PR #83; sin build de EAS; el dueño conservó la paleta en el iPhone el 2026-10-03, el
  resto sin revisar punto por punto): el pulgar blanco con texto en tinta del segmento elegido `Gastado | Disponible`
  (pulido final del 2026-10-04), en claro y oscuro; la paleta Electric Lime en claro y oscuro: el campo
  lima de Inicio con tinta y la barra de estado oscura sobre él; Próximos compromisos neutro como Actividad reciente; el
  dock grafito con el «+» lima, con y sin Reduce Transparency; el hub; un botón lleno sobre una hoja blanca; el texto de
  marca oliva-lima; ingreso verde, transferencia pizarra, ámbar y rojo distintos de la lima; interruptores; categorías,
  dona y tarjetas sin cambios. La lista exacta está en docs/mobile-device-checklist.md
  («Producto 25VIS1»).
- Producto 25OPS1 (mergeada como PR #81; el dueño confirmó el 2026-10-03 que el contenido final queda arriba de la
  píldora; el resto sin revisar): la última fila de Inicio, Reportes, Más y Movimientos
  descansa arriba de la píldora al final del scroll, también después de un rebote, de un teclado y de un rato de uso; el
  indicador de scroll termina arriba del dock; VoiceOver en una lista larga; texto grande. La lista exacta está en
  docs/mobile-device-checklist.md («Producto 25OPS1»).
- Producto 25UX1 (mergeada como PR #80; pasada del dueño del 2026-10-02 en términos generales: dock sin franja, cambio de
  pestañas, Tarjetas y Reportes bien; la última fila sobre el dock falló y la corrige 25OPS1; la lista ítem por ítem
  sigue abierta): el dock sin franja (último renglón, teclado, hub,
  cambio rápido de pestañas, Reduce Transparency, claro y oscuro); Tarjetas en reposo, primer toque, segundo toque,
  cambio de tarjeta sin números viejos, una y seis tarjetas, VoiceOver y Reduce Motion; el detalle con Movimientos antes
  de Cuotas; Reportes con la quinta categoría elegida que sube, vuelve y cambia, con Reduce Motion y VoiceOver. La lista
  exacta está en docs/mobile-device-checklist.md («Producto 25UX1»).
- Producto 25A-02: nada que revisar en el iPhone (la base local de propuestas, en su propio archivo; ninguna pantalla la
  abre todavía); la línea de versión de Más dice «FinanzApp 0.1.0 (25A-02)» en un build de su rama.
- Producto 25A-01 (mergeada como PR #77): nada que revisar en el iPhone (solo dominio, sin pantalla nueva).
- Producto 24T3 (mergeada como PR #76; sin build de EAS, nada revisado; diferida y bloqueo de lanzamiento por decisión
  del dueño del 2026-10-04: se hace en la pasada completa en iPhone antes del primer TestFlight externo o público y
  antes de enviar a la App Store, no antes de mergear 25A o 25A2): la
  actualización a esquema 14 con una copia antes; una devolución en efectivo parcial y total, una de una compra con
  tarjeta que baja el saldo pendiente y una de un plan antes y después de un cierre con las últimas cuotas reducidas; el
  tope que rechaza devolver de más; un adelanto con y sin interés (las dos opciones de financiación) y después Pagar
  tarjeta; dejar de seguir y reactivar un plan; eliminar una tarjeta frenado por un saldo a favor y por un plan
  pendiente, y permitido después; deshacer y restaurar una devolución y un adelanto; las filas de Movimientos y
  Movimientos deshechos; Reportes con una categoría debajo de cero y las etiquetas del selector «Categorías | Día a
  día» a 375 pt en español e inglés con texto chico, grande y XXXL; Deudas sin cambios (una devolución nunca aparece
  como pago o cobro); VoiceOver en las pantallas nuevas; claro y oscuro; la fecha de una devolución de una compra de
  hoy antes de mediodía; «Devoluciones netas este mes» en el detalle de una cuenta; la nota «Devolución de compra» con su
  ayuda; el diálogo de eliminar una tarjeta que archiva ahí mismo; la densidad de la raíz de Tarjetas
  frente a una composición más de mazo, al estilo Wallet (solo evaluar, sin rediseño en 24T3). Lista en
  docs/mobile-device-checklist.md.

- Producto 24UX6E (sin build de EAS, nada revisado todavía): Cuentas con una y varias cuentas, saldos grandes
  positivos y negativos, varias monedas, la cabecera de moneda en tinta con su total (apilada con texto grande, un solo
  encabezado para VoiceOver), nombres largos, el bloque plano del detalle en 40 pt y la nota de una cuenta eliminada;
  «Eliminar cuenta» y «Eliminar tarjeta» vuelven a su lista con Atrás y la barra de pestañas intactos, también desde
  el detalle de una cuenta abierto desde un movimiento de Inicio; Presupuestos sin general, con general y varios sublímites, en calma,
  85 %, 100 % justo y excedido (el héroe en tinta hasta excederse, el tile nunca teñido, sin chevron), importes muy
  grandes, categorías largas, otra moneda, el alcance de «Este mes», el error editable de un presupuesto duplicado y un
  enlace con un mes mal formado; Recurrentes con gastos e ingresos activos, pausados, cerrados y para revisar, fechas
  cercanas y lejanas, comercios largos, el pronóstico a 375 pt con ≥ $ 1.000.000,00 y el ámbar solo en un gasto de hoy
  o mañana; Deudas que debo y que me deben, en parte saldadas, vencidas, a tres días o menos (ámbar solo si la debo),
  cerradas (la nota, sin línea de estado), eliminadas, importes grandes, nombres largos y los tiles neutros en oscuro;
  Categorías activas y archivadas (sin atenuar), nombres largos, el error editable de un nombre tomado, una categoría
  histórica guardada sin cambios que conserva su aspecto y el botón de cerrar de una categoría que no existe; Idioma,
  Región y Apariencia con la tarjeta fijada separada en claro, oscuro y AX3; Movimientos deshechos sin neto del día y
  sin explicación sobre el vacío. En todo: 375 pt, texto de accesibilidad, claro y oscuro, VoiceOver, Reduce Motion,
  Reducir transparencia y el espacio sobre el dock. Lista en docs/mobile-device-checklist.md.

- Producto 24UX6D (sin build de EAS, nada revisado todavía): en Reportes la dona a 393 y 375 pt (247 y 234 pt), «Total
  del período» y el total exacto en el centro, la categoría elegida en su lugar, la lectura debajo de la dona en tamaños
  de accesibilidad o con un importe enorme, nunca cortada; limpiar con la misma porción, el agujero, el espacio neutro
  alrededor del anillo (sin robar el desplazamiento ni el segmentado), el mes, la moneda y Categorías ↔ Día a día; la
  línea compacta de Día a día y la fila de variación abajo; en Inicio la fila de progreso del presupuesto en aviso, en
  el 100 % justo («Límite alcanzado», ámbar) y excedida (glifo de alerta, «por encima», barra llena), su movimiento de
  260 ms y al instante con Reduce Motion, VoiceOver con estado, porcentaje e importe; con el refinamiento, hasta dos
  filas (general y por categoría) en una superficie agrupada, excedido primero, el general antes que una categoría,
  cinco categorías → dos filas, el nombre de la categoría en tinta sin su color, un presupuesto por categoría en USD
  con «· USD» que abre Presupuestos en USD, nombres largos e importes grandes a 375 pt y en tamaños de accesibilidad,
  VoiceOver por fila; en Tarjetas mazos de 1, 2, 3, 4, 5
  y 6 tarjetas (franjas de 50 pt y de 44 pt desde la quinta), nombres largos, claro y oscuro con el bloque plano, las
  notas de archivada y eliminada, la barra del plan con «3 de 12 registradas», los movimientos de la tarjeta; el
  espacio sobre el dock; Reducir transparencia. Lista en docs/mobile-device-checklist.md.

- Producto 24UX6C2 (sin build de EAS, nada revisado todavía): la actividad reciente de Inicio mezcla gastos, ingresos
  y transferencias del más nuevo, una transferencia una sola vez con «Origen → Destino» en el tono de transferencia,
  VoiceOver diciendo «Transferencia» con la dirección, tocarla abre su detalle y Gastado no cambia después de una
  transferencia; los compromisos siguen condicionales, ahora con la ventana de 30 días (de hoy a hoy + 30 inclusive);
  la fila del presupuesto general (aparece al 85 % en ámbar, sigue ámbar en el 100 %, pasado el límite en el tono de
  alerta con lo excedido, nunca por un presupuesto por categoría *(→ refinamiento de 24UX6D: también por categoría,
  hasta dos filas)*, abre Presupuestos en su moneda y su mes, en
  consolidado con el presupuesto en otra moneda que la de visualización nombra esa moneda sin convertir, desaparece por
  debajo del 85 %) *(→ 24UX6D: ahora una fila de progreso, misma semántica)*; en Reportes el total arriba en las dos
  vistas, el centro de la dona callado *(→ 24UX6D: el total pasó al centro de la dona y el KPI salió)* y después el nombre, el importe y el porcentaje de la categoría elegida, la porción elegida más gruesa
  y las demás atenuadas, la fila marcada, tocar de nuevo o el agujero la quita, VoiceOver ajustable (deslizar arriba y
  abajo) anuncia categoría, importe y porcentaje, la elección vuelve a ninguna al cambiar de mes o de moneda; nombres
  largos con importes grandes apilados a 375 pt y en tamaños de accesibilidad; la navegación de meses, las barras y
  «Este mes»; Reduce Motion; 30 cambios rápidos de pestaña sin pantallas negras. Lista en
  docs/mobile-device-checklist.md.

- Producto 24UX6C (sin build de EAS, nada revisado todavía): las filas de Movimientos en claro y oscuro (el gasto sin
  menos y en tinta, el ingreso con «+» en verde, la transferencia en azul petróleo y sin signo); las cabeceras de día y
  sus netos; la píldora de búsqueda (escribir, borrar, VoiceOver «Buscar movimientos»), los filtros y el conteo; la
  búsqueda vacía; Movimientos sin «+» en la cabecera; cuentas, tarjetas, deudas y recurrentes con la misma regla de
  filas y los saldos negativos con su menos; el héroe del detalle de un movimiento; Inicio sin subrenglón en Gastado y
  Disponible, el ⓘ junto al número con una moneda, el chip más callado con dos, el tile del vacío visible; la hoja de
  Registrar con tiles teñidos pero tranquilos; el Asistente sin leyenda permanente ni micrófono, la nota al enviar, el
  glifo del vacío visible; el ritmo de Más y sus rótulos como encabezados (rotor), cada fila abre su pantalla;
  VoiceOver leyendo Gasto / Ingreso / Transferencia con su importe; Dynamic Type en tamaños de accesibilidad a 375 pt;
  Reduce Motion; 30 cambios rápidos de pestaña sin pantallas negras. Lista en docs/mobile-device-checklist.md.

- Producto 24UX6B (sin build de EAS, nada revisado todavía): el orden de lectura de Reportes de arriba abajo en claro y
  oscuro (alcance y mes, el total, Categorías con la dona y «Por categoría» o Día a día con «Por día», «Evolución»
  debajo, después los detalles); VoiceOver en ese orden, con la línea del total leída una vez y en palabras; Dynamic
  Type hasta los tamaños de accesibilidad a 375 pt; cambiar Categorías ↔ Día a día sin que la historia suba; tocar una
  barra abre su mes; la nota de un solo mes en un libro con solo el mes en curso; el mes vacío en las dos vistas; las
  barras inactivas visibles en ambos temas; ningún rojo en el gasto común; Reduce Motion; 30 cambios rápidos de
  pestaña hacia Reportes sin pantalla negra. Lista en docs/mobile-device-checklist.md.

- Producto 24UX6A con Forest (decisión 005; sin build de EAS, nada revisado todavía): el dock de cuatro pestañas solo
  con íconos (VoiceOver «n de 4», «Registrar» que no es una pestaña, el visor de contenido grande con pulsación larga
  a tamaños de accesibilidad, 30–40 cambios rápidos de pestaña sin pantallas negras, vidrio contra pino sólido con
  Reducir transparencia); la hoja de Registrar (abrir y cerrar con el «×», el velo y el escape de VoiceOver, la primera
  elección que manda, el fundido con Reduce Motion); el Asistente (empuje y atrás, la conversación que sobrevive en la
  sesión, «Continuar» solo después de un intercambio real, borrada por Nuevo chat y al cerrar la app, el teclado del
  compositor como pantalla de la pila, el enlace de evidencia de vuelta a Movimientos); Inicio (el campo bajo la barra
  de estado en claro y oscuro, contenido claro y de vuelta a texto oscuro al desplazarse en claro, el mes que no se
  toca, la fila de alcance solo con dos o más monedas, el por día solo en Gastado, compromisos hasta dos u omitidos,
  actividad de cuatro o seis, los estados vacíos, importes largos a 375 pt, texto de accesibilidad y Dynamic Type); el
  contraste de Forest en el dispositivo; los colores de categoría sin cambios; Apariencia Sistema / Claro / Oscuro sin
  parpadeo; el mapeo de glifos SF Symbols / Ionicons. Lista en docs/mobile-device-checklist.md.

- Producto 24UX6A, primera iteración (reemplazada por la decisión 005; lo que sigue vigente está en el punto de
  arriba): Inicio a primer vistazo en claro y oscuro, con vidrio y opaco (¿el número manda?, ¿«＋ Registrar» se
  lee como la acción principal sin gritar?); la hoja de Registrar (subida, las cuatro filas, abrir cada destino después
  de que se va, Cancelar, el velo, Reduce Motion, VoiceOver); los compromisos de la semana y la línea de atención en
  sus casos; la barra flotante (separación del indicador de inicio, lente, etiquetas con texto de accesibilidad,
  VoiceOver, el teclado en el Asistente y en Movimientos, un iPhone angosto, Reducir transparencia); Apariencia
  (Sistema, Claro, Oscuro, cambiar con la app abierta, cerrar a la fuerza y reabrir, el teclado y las alertas en el
  tema elegido, sin parpadeo al abrir). Lista en docs/mobile-device-checklist.md.

- Producto 24T2: **verificado** por el dueño en un iPhone 14 Pro con un build de desarrollo nuevo (2026-09-29; PR #69,
  merge 8951f6c).

- Producto 25B3: el detalle de una cuenta sin la fila de saldo inicial (el mismo saldo registrado, el grupo
  con solo Recurrentes); el detalle de un recurrente desde Inicio, desde Recurrentes y desde un movimiento
  registrado (héroe, estado, filas, Registrados, acciones), Editar desde la cabecera, Pausar/Reanudar sin salir,
  Eliminar volviendo a la lista, el estado Revisar; VoiceOver leyendo cada fila como la regla con la pista de
  detalle en ambos idiomas; texto de accesibilidad máximo; Reduce Motion. Lista en docs/mobile-device-checklist.md.

- Producto 24UX5: el azul pizarra de los enlaces en claro y oscuro (¿se lee como enlace y no como texto
  ni como el cobalto?), las marcas de 40 pt alineadas en las dos listas, la agenda más compacta, las
  leyendas con solo la fecha y los casos que vuelven a mostrar la categoría o la cuenta, «By category»,
  el botón de información de Reportes, el pie de Más, VoiceOver en ambos idiomas, texto de
  accesibilidad máximo, cambio de moneda sin parpadeo. Lista en docs/mobile-device-checklist.md.

- Producto 24UX4: el deslizamiento en Recurrentes y Deudas (sensación, umbral, una fila abierta,
  desplazamiento vertical sin deslizamientos accidentales, el gesto atrás intacto), los tres tonos
  en claro y oscuro, las alertas, los botones del detalle, Cerradas, Saldar con el monto escrito,
  VoiceOver (rotor Acciones), Dynamic Type y Reducir movimiento. Lista en
  docs/mobile-device-checklist.md.

- Producto 24UX3: la jerarquía de Inicio en claro y oscuro, con material opaco y con vidrio:
  lectura de primer vistazo, cabecera compacta, número de 48 pt, las tres píldoras y la entrada
  del Asistente (importancia, alcance con el pulgar, que no parezca un buscador), las tres formas
  de sección, el equilibrio del cobalto, Dynamic Type, VoiceOver y Reduce Motion. Lista en
  docs/mobile-device-checklist.md.

- Producto 24UX2: las acciones de 48 pt sin sombra en claro y oscuro, con vidrio y sin él (¿se
  leen como herramientas y no como botones sueltos?, ¿el Asistente sigue reconocible?); leyendas a
  tamaños de accesibilidad; Próximos compromisos y Recurrentes con la fecha una sola vez; el mes
  vacío con una frase; Registrados en el detalle de una regla; la fila Recurrente del detalle; las
  pestañas inactivas en secundario; VoiceOver en las filas nuevas. Con
  `EXPO_PUBLIC_MERCHANT_MARK_PREVIEW=1`, que las filas reconocidas (Netflix, Spotify, Mercado Pago)
  muestren la inicial y las demás su categoría. Lista en docs/mobile-device-checklist.md.

- Producto 24R2A: Idioma y Región como una tarjeta bajo «Según el dispositivo» (tamaños de texto de
  accesibilidad, VoiceOver, ambos temas); con `EXPO_PUBLIC_LOCALE_PREVIEW=1`, Región con 257 filas:
  desplazamiento a 60/120 Hz, búsqueda, Recientes, encabezados de sección, Reduce Motion; la región
  de la vista previa conservada en un build sin vista previa. Lista en docs/mobile-device-checklist.md.

- Producto 24R1: con la Región del iPhone en un país no publicado (Japón, Reino Unido), Más →
  Región → «Según el dispositivo» dice «Ahora: Japón (formatos de Argentina)» en ambos idiomas; con
  Argentina o Estados Unidos, la frase de siempre. 

- Producto 24B6: la hoja de fecha (alto, centrado de la rueda, velo, subida y bajada, Reduce
  Motion, ambos temas, Dynamic Type, VoiceOver, área segura); el cambio de moneda en Inicio visto
  en Reportes y viceversa, y tras reabrir la app; Ingreso sin tarjetas, Registrar compra → Ingreso
  → Gasto, Pagar tarjeta, la transferencia general. Lista completa en
  docs/mobile-device-checklist.md (Producto 24B6).

- Producto 23.1C1: nada visible debe cambiar en español-Argentina salvo el idioma de la
  rueda de fechas (ahora el de la app) y los conteos de más de mil en la revisión de una
  copia (1.234); el campo de importe teclea, borra y pega igual que en 23.0; pegar
  "1,000" deja el campo como estaba con una nota al pie. Las cuatro combinaciones se
  revisan en 23.1C2, cuando se publiquen.

- Producto 23.0: el campo de importe al teclear rápido (999 → 1.000, 999.999 →
  1.000.000), con decimales, pegando, borrando sobre un punto, tocando en medio y al
  cambiar ARS/USD; el símbolo quieto y el cursor detrás del último dígito; la fila de
  moneda y su hoja; las estadísticas y filas apiladas con texto grande y en un iPhone
  angosto; segmentados con texto grande; ambos temas; VoiceOver en las filas nuevas.

- Producto 22: si Expo Go en el iPhone 14 Pro (iOS 26.6.1) informa Liquid Glass
  disponible y cómo se ven los cuatro círculos y el compositor sobre ambos fondos;
  activar Reducir transparencia en Accesibilidad y ver el cambio al material opaco sin
  reiniciar; el compositor apoyado sobre la barra de pestañas con el teclado cerrado y
  subiendo exacto al abrirlo; la pestaña central con VoiceOver y texto grande; Más →
  Tarjetas con su "+" en la cabecera y volver con el gesto.

- Producto 21: las cuatro acciones en iPhone SE / 13 mini y con texto grande (leyendas a
  dos líneas, ningún desborde), el material en ambos temas, el anillo cobalto del
  Asistente; el compositor con el teclado abierto, cerrado y descartado con el gesto,
  con texto grande, en ambos temas; VoiceOver a lo largo de una conversación (mensaje,
  respuesta, chips, tarjeta, botones); "Pensando…" y las apariciones con Reduce Motion
  activado y desactivado; el borrador y los chips con la vista de prueba
  (`EXPO_PUBLIC_ASSISTANT_FIXTURES=1`, solo desarrollo); Nuevo chat.

- Producto 20: el selector con el teclado abierto y cerrado, tamaño de toque y háptico
  por cambio, tiles de cuenta y categoría en ambos temas y con texto grande, Cuentas y
  los selectores con cuentas vestidas y sin vestir, renombrar una categoría y comprobar
  que Reportes muestra un solo grupo, archivar y ver la fila en Archivadas y el
  movimiento intacto, actualización del archivo real a esquema 8 sin cambios de saldo,
  copia v8 compartida e importada, VoiceOver leyendo los nombres de color e ícono.

- Tipo del formulario y ambas variantes; panel general y filas en calmo / aviso /
  excedido; botón compacto; tarjeta de Inicio con y sin general; migración del
  archivo real (presupuestos idénticos) y copia v7; VoiceOver, texto grande,
  Reduce Motion, ambos temas.
- Más y sus grupos, Tarjetas sin deudas, los atajos de importe con el teclado del
  iPhone (valor, cursor al final, edición posterior), Categorías y Copia de seguridad;
  VoiceOver del atajo; ambos temas, texto grande y Reduce Motion.
- Primario cobalto en ambos temas (pestaña, segmentados, CTA, selectores); rellenos
  tintados de Inicio y su revelado; campo de importe (tecleo, borrado sobre un punto,
  pegado, cursor) en ARS y USD; niveles del héroe; Dynamic Type y Reduce Motion.

- Pulgar del segmentado, fundido del héroe, barrido de la dona y profundidad del
  carrusel a 60/120 Hz, en ambos temas y con Reduce Motion activado y desactivado.
- Tonos de categoría junto al nombre en claro/oscuro; la dona animada en Expo Go.
- Carrusel: ajuste, indicador de página y cambio de panel al soltar.
- Contraste de tarjetas de crédito y del tinte azul en claro/oscuro.
- Filas con nombres largos, texto grande y VoiceOver en Tarjetas y Deudas.
- Inicio y Reportes con la nueva paleta antes de su rediseño (fases siguientes).
