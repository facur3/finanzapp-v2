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

## Pendiente de revisión en iPhone

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
