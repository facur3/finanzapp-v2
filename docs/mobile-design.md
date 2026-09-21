# FinanzApp: dirección visual móvil

Interfaz 17 · 21 de septiembre de 2026. Implementado en código; revisión visual y
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
#1C1C1E, elevado #242426, tinta #F5F5F7, secundario #A0A0A8. Los tokens viven en
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

**Semántica aparte.** Cuatro colores con significado, intactos: gasto coral (#C42F39 /
#F0555C), ingreso verde (#15804F / #3DBE86), transferencia azul celeste (#0B6BB3 /
#4DB0FF, distinto del cobalto para que el significado y la interacción no compartan
muestra), alerta ámbar (#B45309 / #E8A030), cada uno con un tinte suave para tiles y
chips. Todos los textos semánticos superan 4,5:1 sobre la superficie. Los importes de
gasto van en tinta con signo menos; solo el ingreso se pinta de verde. Nunca color sin
signo o etiqueta. `tests/theme.node.ts` verifica estos contrastes en ambos temas.

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

## Pantallas de esta entrega

- **Presupuestos.** Un número principal (lo que queda o cuánto se excedió), barra
  total, gastado y límite, una línea de estado y filas densas con porcentaje, estado
  y una barra fina por categoría. Nada de barras enormes repetidas.
- **Recurrentes.** Tres estadísticas compactas para los próximos 30 días por moneda,
  filas con frecuencia, próxima fecha, cuenta, importe con signo y "Hoy / Mañana /
  En N días", y el switch nativo para pausar.
- **Cuentas.** Solo cuentas de dinero, agrupadas por moneda con el total de cada una;
  el detalle muestra saldo, gastos e ingresos del mes, Gasto / Ingreso / Transferir y
  sus movimientos. Tarjetas y deudas viven en su pestaña.
- **Reportes.** Título del mes con flechas, total registrado, promedio por día y
  variación contra los mismos días del mes anterior; barras de seis meses en una
  sola escala (el mes en curso, delineado); dona por categoría en tonos de categoría
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
  completo que no se pueden pasar por alto: Categoría (con la línea de presupuesto
  del mes si existe) y Pagado con / Ingresa en (con saldo registrado o deuda de
  tarjeta, y el tipo de cada opción en la hoja). Comercio y fecha después. El botón
  Guardar repite el importe. Sin controles decorativos de dividir, comprobante o
  etiquetas mientras no existan sus datos. Jerarquía de color: categoría en su
  tono, cuenta en el primario, fecha neutra, botón de guardar en el primario.
- **Inicio.** El mes en curso, nada más. Una fila con Gastos / Disponible y la
  moneda; el nombre del mes (o "Saldo registrado" con el botón de información) y el
  número principal, sin cantidad de registros ni rango de fechas ni selector de
  período. Tres acciones redondas: Gasto, Ingreso, Transferir. Una línea de
  presupuesto solo si hay presupuestos. Las tres acciones redondas son círculos
  neutros (escalón de superficie en oscuro, blanco con sombra suave en claro) con
  solo el glifo en su color semántico: el color vive en el trazo, no en un tile
  relleno. "En qué gastaste": un bloque agrupado con hasta tres categorías; detrás
  del contenido de cada fila, un lavado redondeado de su propio tono (11 % en
  oscuro, 8 % en claro), con margen respecto de los bordes de la fila, corre desde
  la izquierda exactamente en su proporción del mes (sin mínimo inventado: 0,1 %
  es un filo y la fila sigue siendo tocable). Sin separadores que corten el
  lavado. Tile, nombre e importe; sin porcentajes ni barra debajo. "Reportes"
  abre la pestaña. Compromisos próximos solo cuando existen; los últimos cuatro
  movimientos. Los períodos y el análisis viven en Reportes.
- **Movimientos.** Buscador, filtro Todos / Gastos / Ingresos / Transf., secciones
  "Hoy · 20 sep", "Ayer", día de la semana en los últimos siete días y luego la fecha,
  con el neto del día cuando hay una sola moneda.
- **Detalle de movimiento.** Tile, importe con signo, comercio, fecha completa y
  estado; categoría, cuenta o tarjeta, contexto de presupuesto solo si existe uno
  activo para ese mes, moneda; editar y deshacer. Nada inventado: sin referencias
  bancarias, mapas ni estados de autorización.
- **Tarjetas.** Identidad → estado → hechos → acción principal → acción
  secundaria → actividad. Carrusel horizontal con ajuste al soltar, deuda
  registrada como número principal, una fila de tres hechos (Disponible, Cierre,
  Vencimiento) con barra de uso (ámbar desde 85 %, coral sobre el límite),
  Registrar compra a ancho completo sobre Pagar tarjeta (mismo tamaño, tinte
  azul), y Recientes con los hechos del resumen abierto en su leyenda. Deudas debajo.
- **Detalle de tarjeta.** Tarjeta grande, deuda, tres hechos (Disponible con el
  límite como leyenda, Cierre, Vencimiento), las dos acciones apiladas y todos sus
  movimientos con el resumen abierto en la leyenda. Emisor y moneda ya están en la
  tarjeta; no hay tabla de detalle. Pagos se leen como "Pago de tarjeta · desde
  Cuenta", sin signo ambiguo.
- **Deudas y cobros.** Totales por moneda, Debo / Me deben, detalle con estado,
  vencimiento y registro de pagos o cobros limitados al saldo pendiente.
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
los nombres van en la leyenda, nunca solo en el color. Con datos nuevos la dona se
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
  segmentado, el número principal y una visualización. En Inicio la fila de
  período conserva su lugar bajo Disponible y solo se atenúa; la lista reciente se
  funde como un bloque.
- **Bloques.** Una sección que aparece o desaparece se funde y los vecinos se
  deslizan en lugar de saltar; con Reduce Motion, solo el fundido.
- **Lavados de categoría (Inicio).** Con los primeros datos, cada lavado crece
  desde cero hasta su proporción real en 300 ms ease-out, con 50 ms de escalonado
  entre filas; un cambio de datos interpola desde la proporción anterior en 260 ms.
  Es una vista absoluta sin hijos detrás del contenido: no cuesta layout ni bloquea
  el toque. Con Reduce Motion no hay movimiento de ancho, solo un fundido de 200 ms.
  Nunca responde al scroll.
- **Formularios.** Gasto / Ingreso / Transferencia es un solo control sobre un
  solo modal: cambiar es estado, no navegación, y el formulario de abajo se funde.
- **Carrusel de tarjetas.** La posición vive en el hilo de UI; las tarjetas vecinas
  retroceden (0,94 / 0,7). Al asentarse en otra tarjeta suena un háptico; el panel
  queda montado y solo sus valores se funden, así lo de abajo no salta. Reduce
  Motion deja todas las tarjetas planas.
- **Hápticos.** Uno por acción del usuario (selección en segmentos, cambio de
  pestaña, flechas de mes, categoría o cuenta elegida, tarjeta asentada; éxito al
  guardar) y siempre con una señal visual. Las pestañas cambian al instante, sin
  deslizamiento ni fundido.

La pila y las hojas nativas siguen siendo la única transición de pantalla; las
cinco pestañas permanecen montadas sin fade/detach/freeze. Objetivos de 44 pt,
texto escalable con filas apiladas en tamaños grandes, etiquetas de VoiceOver con
importe, moneda y estado.

## Producto 18 — navegación y acciones rápidas (sin rediseño)

- **Más.** La quinta pestaña deja de llamarse Ajustes: es el hub secundario, dos
  listas agrupadas nativas (Finanzas / App y datos) con una nota al pie sobre datos
  locales. Tarjetas no aparece ahí porque ya es pestaña. La copia de seguridad tiene
  su pantalla; Categorías es una lista de solo lectura por ahora.
- **Tarjetas** solo muestra tarjetas de crédito. Deudas y cobros vive en Más.
- **Atajo de importe.** Bajo el campo de importe de una transferencia, una nota al pie
  con la cifra registrada ("Saldo registrado: ARS 190.162,00", "Deuda registrada",
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
  estado) y los límites por categoría son filas densas debajo. Sin general, un botón
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
  tocar una fila edita nombre, ícono y color o la archiva con confirmación. Sin borrado.
- **Más.** Solo el grupo Finanzas lleva tiles tintados (cobalto, verde azulado, índigo,
  ocre, pizarra) sobre la superficie neutra; App y datos sigue neutro.

## Pendiente de revisión en iPhone

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
