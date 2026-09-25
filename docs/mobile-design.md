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

## Producto 21 — el Asistente como capacidad principal

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
  unas cinco líneas, luego desplaza dentro), micrófono en secundario y un botón redondo
  de enviar relleno de cobalto (gris e inactivo sin texto; se convierte en Detener
  mientras responde). Sigue el teclado en el hilo de UI y respeta el indicador de inicio.
  El micrófono existe y explica su límite: el dictado necesita el development build.
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
- **No conectado.** Una leyenda terciaria bajo el compositor antes del primer envío; al
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
  que ponga un nombre junto a un importe; `StatRow` pone dos o tres estadísticas lado a
  lado y una debajo de otra con texto grande; los segmentados limitan su escala a 1,3× y
  ajustan la etiqueta al segmento; los nombres tienen dos líneas y la columna del importe
  ocupa como máximo la mitad; "Deuda registrada · ARS" y "ARS 1.234,56" se unen con
  espacios duros para que el código o el número nunca queden solos.
- **Localización.** Idioma, región, moneda de la cuenta y valor almacenado son cuatro
  cosas distintas. Las fechas y los porcentajes salen de tablas (el mismo "22 sep" en toda
  la app, no el "sept" del ICU del dispositivo). El inglés existe como catálogo y no se
  muestra hasta que toda la app lo tenga (23.1): un iPhone en inglés sigue leyendo
  español antes que media app traducida.

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
- **Onboarding.** `LocaleChooser` acepta `onChosen`, así el paso de idioma y el de región del
  onboarding (25B) son la misma pantalla.

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
  nunca dentro de la lista.
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
  hoy y mañana. Nada registrado.
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
  Cerrar deja la pantalla abierta (el estado dice «Cerrada»); eliminar vuelve a Deudas.

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
