# FinanzApp: dirección visual móvil

Actualizado: 12 de septiembre de 2026. Primera iteración implementada en
`apps/mobile`; validación visual/gestual en el iPhone todavía pendiente.

El piloto confirmó que al usuario le gusta la navegación nativa. Conservamos
esa base y construimos una identidad propia: simple, cálida y fácil de leer.
Mon AI es una referencia de la calma y sencillez que busca el usuario; las
pantallas, textos, recursos gráficos y composición de FinanzApp serán propios.

## Primera entrega de diseño

Se aplicó primero a Inicio, registro de gasto/ingreso, cuentas y movimientos.
Son el recorrido diario y permiten revisar el estilo antes de extenderlo a
tarjetas, inversiones, reportes y asistente. Se mantienen tres pestañas funcionales:
Inicio, Movimientos y Ajustes, sin botones decorativos de secciones no implementadas.

| Pantalla | Jerarquía y comportamiento |
| --- | --- |
| Inicio | Disponible por moneda, accesos a Gasto/Ingreso, cuatro movimientos recientes y hasta tres cuentas. Ver todas abre la lista de cuentas. Patrimonio e inversiones llegan cuando esté implementada su contabilidad. |
| Gasto / ingreso | Monto destacado y moneda visible, con Listo en el teclado iOS. Cuenta en una fila que abre su selector. Fecha en una hoja nativa con Cancelar/Listo; no modifica la fecha hasta confirmar. Validación visible y borrador conservado ante errores de guardado. |
| Movimientos | Lista virtualizada agrupada por fecha, búsqueda por concepto/categoría/cuenta y filtros Todos/Gastos/Ingresos. Importe firmado y moneda; no sumar ARS y USD ni inventar días vacíos. |
| Cuentas | Lista completa por moneda y detalle con disponible, saldo inicial separado de ingresos y movimientos de esa cuenta. |
| Detalle | Importe, concepto y fecha primero; cuenta y categoría después. Editar y deshacer se muestran cuando tengan persistencia y reversión implementadas. |

## Sistema visual

- Tipografía del sistema iOS, jerarquía corta y soporte de tamaños de accesibilidad.
  Los montos grandes pueden ocupar más de una línea sin tapar otros controles.
- Fondo claro suave y oscuro profundo; superficies agrupadas con separadores
  discretos. Un acento azul propio para acciones y selección.
- Verde/rojo reservados para significado financiero y acompañados por signo o
  texto. Desconocido, pendiente y cero tienen presentaciones distintas.
- Espaciado consistente y objetivos táctiles de al menos 44 puntos. Evitar
  recuadros dentro de recuadros y repetir el mismo saldo en varios bloques.
- Iconos simples y coherentes. Una acción principal visible; ajustes secundarios
  en detalle o menú contextual, sin ocultar información necesaria para decidir.
- Estado vacío con una acción útil. Mostrar únicamente información registrada;
  las capturas y los datos personales no pertenecen al repositorio público.

## Movimiento e interacción

- La pila y las hojas nativas controlan entrar, volver, arrastrar y cancelar.
  No añadir una segunda animación de pantalla encima de la navegación del sistema.
- Respuesta breve al presionar y confirmar. Conservar los hápticos de guardado;
  no vibrar en cada fila ni reiniciar animaciones en cada render.
  Presión breve de escala y selección con fundido, desactivadas con Reducir movimiento.
  Una sola suscripción de accesibilidad para toda la interfaz.
- Fondo opaco coherente entre destino, pestaña, hoja y carga. Un gesto cancelado
  conserva pantalla, foco y borrador sin mostrar otra sección por un instante.
- Respetar Reducir movimiento y VoiceOver. Cada control tiene nombre y estado;
  el teclado y la fecha quedan dentro del área segura.
- Más adelante, gráficos con unidades, período, leyenda y valor accesible al tocar.
  Transiciones breves entre datos reales, escala comprensible y sin reiniciar el
  trazado al volver de un detalle. No dibujar historia que no existe.

## Datos y alcance de la próxima iteración

Antes de usar la app nueva como registro principal: editar/deshacer movimientos
sin duplicar débitos, restaurar la copia del piloto e importar el respaldo anterior
con una vista previa. Mostrar qué entidades se admiten, totales por moneda y
cualquier dato no compatible. Nunca descartar tarjetas/inversiones silenciosamente
si el importador inicial aún no las soporta.

Después: completar tarjetas/inversiones y su conciliación; reportes y asistente
basados en movimientos reales; sincronización opcional y funciones de Apple.
El orden y las pruebas contables están en [el roadmap](mobile-roadmap.md).

## Aceptación de diseño

- [ ] Recorrido completo Inicio → gasto/ingreso → guardar → detalle → volver.
- [ ] Apertura, cierre y cancelación de gestos sin destellos ni cambios de pestaña.
- [ ] Fecha, teclado, montos largos y texto grande sin controles fuera de pantalla.
- [ ] La moneda de Inicio preselecciona una cuenta compatible en Gasto/Ingreso.
- [ ] Búsqueda y filtros se conservan al volver de un detalle; sin duplicar filas.
- [ ] Tema claro/oscuro, VoiceOver y Reducir movimiento revisados en el iPhone.
- [ ] El usuario revisa estas tres pantallas antes de extender el lenguaje visual.
- [ ] Repetir la prueba en una versión `preview` optimizada e independiente de Metro.
