# Probar FinanzApp en tu iPhone, desde Linux o Windows

Actualizado: 13 de septiembre de 2026.

**El primer piloto ya fue aprobado en Expo Go:** el usuario confirmó que los
movimientos persistieron al cerrar/reabrir y que la navegación se sentía nativa
y fluida. Si ya hiciste esa prueba, seguí en [Después del piloto aprobado](#6-después-del-piloto-aprobado).

Ya hay una primera versión móvil para probar: cuentas, gastos, ingresos,
actividad, reporte mensual por categoría, edición/recuperación y guardado local. Es un **piloto**: todavía faltan inversiones,
tarjetas, IA, sincronización y las integraciones de Apple. Tu app actual sigue
siendo la que usás para llevar todas tus finanzas.

Elegimos **Expo + React Native** para crear pantallas móviles y trabajar desde
tu computadora sin comprar una Mac. Swift queda disponible para integraciones
de Apple que lo necesiten. La decisión completa y cuándo reconsiderarla están
en [este documento](decisions/001-native-mobile.md).

## 1. Preparar la computadora y el iPhone

- En la computadora: instalá [Node.js 24 LTS](https://nodejs.org/en/download)
  y [Git](https://git-scm.com/downloads). Node ejecuta las herramientas; Git
  descarga y actualiza el código. VS Code sirve para editarlo.
- En el iPhone: instalá **Expo Go** desde la App Store.
- Usá tu cuenta gratuita de [Expo](https://expo.dev/signup) en Expo Go y en la
  terminal con `npx expo login` si pide iniciar sesión. Son las credenciales de
  Expo; Apple y GitHub son cuentas distintas. Si ya funciona, no repitas el alta.
- Conectá ambos a la misma red Wi-Fi.

Todavía no necesitás pagar Apple Developer ni comprar un servicio de IA.
Expo Go permite esta primera prueba dentro de su aplicación. Más abajo está
el paso para instalar FinanzApp como una aplicación propia.

## 2. Abrir la primera versión

Abrí una terminal en una carpeta donde quieras guardar el proyecto. Esta copia
usa otra carpeta para conservar la que ya tengas:

```bash
git clone --branch master https://github.com/facur3/finanzapp-v2.git finanzapp-ios
cd finanzapp-ios/apps/mobile
npm ci
npm start
```

`npm ci` instala exactamente las herramientas guardadas en el proyecto.
`npm start` muestra un código QR y mantiene encendido el servidor de desarrollo.
Dejá esa terminal abierta, escaneá el QR con la cámara del iPhone y abrilo con
Expo Go. Permití el acceso a la red local si iOS lo pide.

Si la red impide conectarlos, cerrá el servidor con `Ctrl+C` y probá
`npm start -- --tunnel`. Puede pedir instalar la herramienta de túnel de Expo.
Si aparece un error de versión, mandame el texto exacto; no hace falta cambiar
bibliotecas al azar.

## 3. Qué probar ahora

1. Agregá una cuenta y escribí su saldo inicial explícitamente. El piloto empieza
   vacío y no trae tus datos de Cocos, Binance, bancos ni la app anterior.
2. Registrá un gasto o ingreso que quieras usar para esta prueba. Revisá monto,
   cuenta, categoría y fecha antes de guardar. Desde su detalle también podés
   editarlo o deshacerlo, y recuperar lo deshecho después.
3. Abrí su detalle y volvé. Probá también un gesto hacia atrás muy pequeño,
   cancelándolo sin terminar de mover el dedo.
4. Cerrá y volvé a abrir. Confirmá que el movimiento y el saldo sigan ahí.
5. Probá modo oscuro, texto grande y “Reducir movimiento” en Accesibilidad.
6. En Ajustes → Compartir copia, guardá el archivo en una ubicación privada.

No vuelvas a cargar todo tu patrimonio. El piloto todavía no importa ni
sincroniza tus datos de la app web. Sí puede restaurar sus propias copias nativas
v1/v2/v3 desde Ajustes → Importar copia, con revisión previa. Eso todavía no convierte
al piloto en el reemplazo de la app actual.

La prueba completa está en [la lista para iPhone](mobile-device-checklist.md).
Anotá modelo del iPhone, versión de iOS, pantalla y gesto si algo falla.
Con Expo Go, una apertura sin red puede depender de su caché: la prueba definitiva
de funcionamiento independiente se hace con la versión instalada del paso 4.

## 4. Instalar FinanzApp como una aplicación propia

Después de revisar el piloto:

1. Usá la misma cuenta de Expo con la que ya probaste el piloto.
2. Para firmar e instalar nuestra propia app de esta manera, necesitás tu
   inscripción en el [Apple Developer Program](https://developer.apple.com/programs/enroll/).
   El alta y el pago los hacés vos con tu identidad. No me pases contraseñas.
3. Vinculamos el proyecto de Expo y registramos tu iPhone. Las instrucciones
   exactas y los comandos están en [el README móvil](../apps/mobile/README.md).
4. **EAS Build** compila y firma en una Mac de la nube. Tu computadora puede
   seguir usando Linux o Windows. Revisamos la cuota/costo antes de iniciar.
5. Primero instalamos una versión de desarrollo para trabajar. Después,
   una versión `preview` trae todo incluido y funciona con la computadora apagada.
6. Tras verificarla, usamos **TestFlight**, la aplicación de Apple para distribuir
   versiones de prueba. La publicación en la App Store viene después de completar
   la migración, privacidad, pruebas y revisión de Apple.

Las versiones se llaman **FinanzApp Dev** o **FinanzApp Preview**. Tienen una
identidad separada para no reemplazar tu app actual. No se generó ni instaló
todavía una versión firmada; tampoco se envió nada a la App Store.

## 5. Qué pasa con Supabase, Apple e IA

- **SQLite** es la base de datos dentro del teléfono. Ya la usa este piloto;
  guardar un movimiento no necesita conexión.
- **Supabase** seguirá sirviendo para cuenta de usuario y sincronización opcional
  entre dispositivos. No lo borres. El piloto todavía no se conecta a sus datos.
- **Face ID, recordatorios, inicio de sesión con Apple, widgets y Atajos** están
  en el plan. Necesitan implementación y pruebas en el iPhone.
- **Apple Pay:** exploraremos una automatización de Atajos que prepare el gasto.
  No permite asumir acceso a todo el historial de Wallet ni ejecutar pagos bancarios.
- **IA:** mantendremos primero la interpretación y las consultas locales, sin
  contratar un modelo pago. Sus propuestas se podrán revisar antes de guardar.

El orden y el estado de cada etapa están en [el plan actualizado](mobile-roadmap.md).
Si todavía no lo probaste, completá primero la prueba de arriba.

## 6. Después del piloto aprobado

Seguimos con Expo + React Native y **por ahora seguimos probando gratis en Expo Go**.
Ya está implementada la cuarta iteración de [la interfaz propia](mobile-design.md):
Inicio más simple, acceso directo a Gasto/Ingreso, movimientos agrupados por fecha
con búsqueda, cuentas en su propia lista y formularios más claros. Conserva la
navegación nativa que ya te gustó. También suma categorías con símbolos y selector,
un saldo con más identidad visual y el resumen Tu mes. La pantalla negra al
cambiar pestañas tiene una mitigación específica: ver [Interfaz 02](#7-interfaz-02-pantalla-negra-y-categorías).
Interfaz 03 suma gastos por categoría y un reporte mensual, sin agregar una pestaña
ni duplicar la lista de cuentas: [cómo probarlo](#8-interfaz-03-inicio-y-reporte-mensual).
Interfaz 04 agrega editar, deshacer/recuperar y copias del piloto: [cómo probarlo](#9-interfaz-04-corregir-y-recuperar).
Interfaz 05 suma corregir cuentas y transferir entre cuentas de igual moneda:
[cómo probarlo cuando quieras](#10-interfaz-05-cuentas-y-transferencias).
Falta tu prueba de esta nueva interfaz; el estilo no se considera aprobado aún.

Inicio dice **Disponible en tus cuentas**, no patrimonio: el piloto todavía no
incluye inversiones ni deudas. Pesos y dólares se muestran por separado, sin
inventar una cotización. No hay datos precargados. Interfaz 05 actualiza la estructura
de la base local conservando tus registros; no toca Supabase ni la app anterior.
Después completamos el importador de la app web y las operaciones entre monedas para traer
tus datos sin volver a escribir todo. El piloto todavía no es el registro principal.

**Ahora, de tu lado:** conservá una copia JSON privada de la app actual usando su
opción de exportar backup. No la subas al repositorio ni hace falta compartirla
para diseñar la app. No borres Supabase ni vuelvas a cargar el patrimonio en el
piloto. Ya registramos tu **iPhone 14 Pro con iOS 26.6.1**, según tu mensaje.
No hace falta volver a dar ese dato mientras no cambie.

Antes de actualizar, guardá también una copia privada **del piloto** desde Ajustes
→ Compartir copia. Conservá el archivo y la instalación. Luego detené Metro con
`Ctrl+C` y actualizá esta misma copia del código:

```bash
cd ~/Projects/apps/finanzapp-ios
git fetch origin
git switch master
git pull --ff-only
cd apps/mobile
npm ci
npm start -- --clear
```

Esto cambia desde la antigua rama del piloto a `master`, donde se integran las
entregas verificadas; no hace falta volver a clonar. Si tenés
cambios locales y Git no permite actualizar, conservá el mensaje para revisarlo,
sin borrar archivos ni forzar un reset. Actualizar el código no borra SQLite;
desinstalar Expo Go o borrar sus datos sí puede eliminar los registros del piloto.
`--clear` limpia solamente el caché del compilador en la computadora, no tus datos.

**Prueba breve de esta entrega:**

1. Confirmá que aparecen las mismas cuentas, saldos y movimientos que ya tenías.
2. Desde Inicio, abrí Gasto e Ingreso. Si tenés una cuenta USD, seleccioná USD
   antes de abrir: el formulario debe abrir con una cuenta en esa moneda.
3. Escribí un monto; usá **Listo** para cerrar su teclado. Abrí Cuenta y Fecha.
   Cambiá la fecha y tocá **Cancelar**: debe conservar la original. Repetí usando
   **Listo**: debe tomar la nueva. Esto modifica el borrador, no guarda un gasto.
4. En Movimientos, buscá por concepto, categoría o cuenta; probá los filtros,
   entrá a un detalle y volvé. La búsqueda y los filtros deben conservarse.
5. Probá un gesto de volver cancelado, modo oscuro y texto grande. Cerrá/reabrí
   Expo Go y confirmá los datos de nuevo. Para comprobar un guardado, usá un
   movimiento que quieras conservar o corregir; Interfaz 04 ya permite editarlo/deshacerlo.

### Expo Go y EAS: para qué sirve cada uno

| Herramienta | Qué hace | Dónde probás |
| --- | --- | --- |
| Expo Go | Es la app de Expo que ya instalaste. Carga nuestro código con las funciones nativas que trae incluidas. | En tu iPhone, normalmente conectado a Metro en tu computadora. |
| EAS Build | Es un servicio que compila y firma **nuestra propia app** en servidores de Expo. Para iOS usa una Mac en la nube; vos podés seguir en Linux o Windows. | La app resultante se instala en el mismo iPhone. No es un simulador para tu PC. |
| Build `preview` | Es nuestra app con el código incluido, optimizada y con identidad propia. La prepara EAS Build. | En tu iPhone, sin Expo Go y sin depender de la computadora. |

Expo Go no permite verificar absolutamente todo. Por ejemplo, **Face ID en iOS
requiere una versión propia de desarrollo**; también debemos probar allí nuestra
configuración nativa, permisos e integraciones. Un build `development` sigue usando
Metro para editar en vivo; `preview` es el que usaremos para la prueba independiente.
Fuentes: [Expo Go y development builds](https://docs.expo.dev/develop/development-builds/introduction/),
[Face ID en Expo](https://docs.expo.dev/versions/latest/sdk/local-authentication/).

**Cuándo pagar (precios consultados el 12 de septiembre de 2026):**

| Etapa | Qué necesitás |
| --- | --- |
| Mejorar la interfaz y probar los movimientos con Expo Go | Sin pago nuevo. Tu instalación actual alcanza. |
| Compilar nuestra app con EAS | Expo ofrece un plan Free con hasta 15 builds iOS por mes y cola de baja prioridad. Revisar la cuota de tu cuenta antes de iniciar una compilación. |
| Instalar la versión propia por este flujo desde Linux y usar TestFlight/App Store | Apple Developer Program: USD 99 por año; el importe final puede variar por región. El alta y pago se hacen con tu cuenta Apple. |

Fuentes oficiales: [precios de Expo](https://expo.dev/pricing) y
[alta de Apple Developer](https://developer.apple.com/programs/enroll/).
No hace falta contratar Expo de pago ni pagar Apple ahora. Primero revisamos esta
interfaz y completamos la corrección/recuperación básica de los movimientos.
Después vinculamos EAS con el plan gratuito y hacemos el alta de Apple para la
primera versión propia, antes de implementar a fondo Face ID y las integraciones.
No esperamos a terminar toda la migración para probar ese flujo de instalación.

La siguiente prueba después de esa alta será instalar `development`, luego
`preview` y abrirla con la computadora apagada. La versión `preview` trae su
código incluido y permite comprobar persistencia, arranque y fluidez sin Metro.
Esa comprobación y las pruebas específicas de accesibilidad/gestos aún están
pendientes, aunque el primer piloto de uso ya haya pasado.

## 7. Interfaz 02: pantalla negra y categorías

La combinación anterior fundía el contenido de las pestañas y apartaba sus vistas
inactivas. Se eliminó esa combinación como causa plausible del fallo reportado:
las tres pestañas quedan preparadas y el cambio es directo. No se recargan tus
datos al tocar cada sección; se conservan búsquedas y filtros. Abrir detalles,
volver, los formularios y las respuestas de los botones conservan sus animaciones.
Esto está implementado, pero **todavía falta confirmar en el iPhone que el negro
intermitente desapareció**. No se borró ni migró SQLite.

Después de actualizar con los comandos de arriba y abrir el QR nuevo:

1. En Ajustes, el pie actual debe decir **Interfaz 05**; conserva esta corrección.
2. Cambiá 30–40 veces entre Inicio, Movimientos y Ajustes. Probá ambos sentidos
   y algunas pulsaciones rápidas. La copia de seguridad y los movimientos deben
   aparecer siempre, sin necesidad de recargar.
3. Dejá una búsqueda/filtro en Movimientos, salí y volvé: debe conservarse.
   Repetí después de salir de Expo Go y volver, y después de cerrar un formulario.
4. En un borrador, tocá Categoría: elegí una, buscá una ya usada o escribí una
   propia y tocá Usar. Cancelar el selector no debe cambiar el borrador. No hace
   falta guardar un movimiento nuevo para revisar esto.
5. Revisá el saldo, los símbolos de categoría y Tu mes en claro/oscuro y texto
   grande. Tu mes muestra registros de esa moneda, no el saldo inicial ni todo
   el patrimonio.

Si reaparece el negro, contame si siguen visibles la barra de abajo y el título,
si cambiar de pestaña lo recupera y si pasó después de usar el teclado o volver
a Expo Go. Si Metro muestra un error rojo, compartí su texto sin datos privados.
No hace falta desinstalar, borrar tus movimientos, cambiar Expo ni pagar EAS.

## 8. Interfaz 03: Inicio y reporte mensual

Seguimos gratis en Expo Go. Actualizá con los mismos comandos del paso 6 y abrí
el nuevo QR. Ajustes debe decir **Interfaz 05**, que incluye estos reportes. No hace falta cargar datos nuevos:
usá los movimientos que ya guardaste en el piloto.

1. **Inicio:** el saldo sigue siendo el disponible de tus cuentas, no todo tu
   patrimonio. **Ver cuentas** abre la lista completa. Debajo de Gasto/Ingreso,
   **Tu mes** resume ingresos/gastos y muestra las tres categorías principales.
   Más abajo están tus movimientos recientes.
2. **Ver reporte:** abre todas las categorías. Si tenés cuentas en pesos y dólares,
   podés elegir la moneda; nunca se suman entre sí. Las flechas recorren los meses
   desde el primer movimiento de esa moneda hasta el mes actual. **Este mes**
   vuelve al actual si estabas viendo uno anterior.
3. **Tocá una categoría:** abre solo sus gastos en esa moneda y mes. El total de
   esa lista debe coincidir con el importe de la categoría. Variantes como Café
   y CAFÉ se agrupan, pero no se modifica el texto de tus registros.
4. **Abrí un movimiento y volvé:** primero debe aparecer su categoría y luego
   el reporte, conservando mes y moneda. Si entraste a la categoría directamente
   desde Inicio, volvés a Inicio. Probá también un gesto atrás pequeño y cancelado.
5. **Revisá las barras:** el porcentaje es sobre todo el gasto registrado, no
   sobre la categoría más grande. Se anima el cambio de proporción, no el importe;
   no se reinicia al volver de un detalle. Probá Reducir movimiento, texto grande
   y modo oscuro/claro. Si no hay gastos, se explica sin dibujar datos de ejemplo.

El mes actual llega **hasta hoy**; un mes anterior incluye **todo ese mes**. Se usa
la fecha del movimiento, no el día en que lo escribiste. Los saldos iniciales y
los ingresos no se convierten en gastos. Ver un reporte no modifica ningún dato.

Todavía no hay comparaciones automáticas, predicciones, presupuestos, reportes de
tarjetas/inversiones ni explicación de causas. Primero consolidamos datos reales y
la corrección/recuperación de movimientos. La aceptación visual y las animaciones
siguen pendientes de tu iPhone; las pruebas del código no reemplazan esa revisión.
La prueba de pestañas del paso 7 sigue abierta: esta entrega no cambia esa mitigación.

## 9. Interfaz 04: corregir y recuperar

Se sigue probando con Expo Go, sin ningún pago ni alta nueva. Guardá primero una
copia privada del piloto, actualizá con los comandos del paso 6 y comprobá el pie
**Interfaz 05** en Ajustes (incluye lo de Interfaz 04). La actualización conserva las cuentas/movimientos y
agrega el control de cambios a la misma base. **No vuelvas a código anterior ni
desinstales Expo Go** después: una versión vieja no entiende esta estructura.

### Editar un movimiento

1. Abrí un movimiento desde Inicio, Movimientos o un reporte → **Editar movimiento**.
2. El monto, tipo, concepto, categoría, cuenta y fecha ya vienen cargados. Corregí
   lo que corresponda → **Guardar cambios**. Editar no crea un segundo movimiento.
3. La cuenta se puede cambiar por otra de la **misma moneda**. No se convierte un
   gasto de pesos a dólares cambiando solamente su cuenta.
4. Volvé al reporte/Inicio: saldo y categoría deben reflejar la corrección una vez.
   Para revisar solo el diseño, abrí el formulario y cerralo sin guardar.

### Deshacer y recuperar

- En el detalle → **Deshacer movimiento**. La confirmación explica cuánto vuelve
  o se descuenta de la cuenta. Cancelar no cambia nada.
- El movimiento deja de contar, pero no se borra definitivamente ni crea un
  ingreso ficticio. En el mismo detalle aparece **Recuperar movimiento**.
- También queda en **Ajustes → Movimientos deshechos** después de cerrar/reabrir.
  Recuperarlo vuelve a aplicar su efecto original exactamente una vez.
- Si aparece un error al guardar, usá **Reintentar** con el mismo envío. La app
  conserva los datos enviados y bloquea cambiarlos durante ese reintento. Si
  querés corregirlos, cerrá y verificá primero el movimiento actual: no lo cargues
  otra vez como uno nuevo. El aviso de verificación permite actualizar la vista.

### Importar una copia

1. **Ajustes → Compartir copia** genera el archivo nativo v3. Guardalo en Archivos,
   en una ubicación privada. Contiene datos financieros en texto, **sin cifrado**.
   Cancelar el menú no significa que se haya guardado afuera de la app.
2. **Ajustes → Importar copia → Elegir copia** abre el selector de archivos del
   sistema. Seleccioná una copia nativa del piloto, v1, v2 o v3.
3. Revisá cuentas nuevas, movimientos, deshechos, registros ya presentes y saldo
   antes/después por moneda. No se importa nada hasta **Confirmar importación**
   y confirmar el aviso. Cancelar o volver no cambia los registros.
4. Si seleccionás la misma copia que acabás de exportar, debe indicar que ya está
   incorporada, sin duplicar nada. Esta es una prueba segura con tus datos actuales.
5. Si una copia antigua contradice una corrección o un movimiento deshecho, se
   bloquea toda la importación. Conservá ambas versiones; no se sobrescribe ninguna.

El importador **agrega lo que falta por identificador**; no reemplaza toda la base,
no une cuentas solo por tener el mismo nombre y no funciona como sincronización.
Admite JSON hasta 5 MB, 1.000 cuentas y 25.000 movimientos. La copia conserva el
estado actual y los deshechos, pero no todas las revisiones históricas del registro
de cambios local. Las copias de la **app web/anterior**, tarjetas e inversiones aún
no se importan: si elegís una, debe explicarlo sin guardar parcialmente sus datos.
El selector reutiliza [FileSystem de Expo](https://docs.expo.dev/versions/latest/sdk/filesystem/),
ya incluido en el proyecto; no se añadió otra biblioteca.

La prueba completa de recuperar en una instalación vacía se hará en un entorno
separado; **no borres tu única instalación para probarla**. Estas pantallas y las
pruebas contables ya están implementadas, pero la fluidez, los gestos, Archivos y
el diseño siguen pendientes de revisión en tu iPhone. Mantenemos los botones con
respuesta breve y la navegación nativa, sin efectos de pantalla superpuestos.

## 10. Interfaz 05: cuentas y transferencias

Podés revisar esta entrega junto con las anteriores, cuando tengas tiempo.
No hay que pagar, contratar nada ni crear otro proyecto para probar estos cambios
en el piloto que ya usás. Antes de actualizar, guardá una copia privada desde
**Ajustes → Compartir copia**. No desinstales Expo Go ni borres sus datos.

En la carpeta del repositorio que ya tenés:

```bash
git switch master
git pull --ff-only
cd apps/mobile
npm ci
npm start -- --clear
```

Si la terminal ya está en `apps/mobile`, hacé `cd ../..` primero. Si Git avisa que
tenés cambios locales, frená y avisá; no uses comandos para descartarlos. Escaneá
el nuevo QR. En Ajustes, el pie debe decir **Interfaz 05**. Limpiar la caché de
Metro con `--clear` no borra SQLite. La base local pasa automáticamente a versión
3 sin perder los registros; **no vuelvas a una versión vieja del código** después.

### Dónde está cada acción

| Quiero… | Dónde y qué hace |
| --- | --- |
| Cambiar el nombre de una cuenta | Inicio → Ver cuentas → cuenta → lápiz. Editá el nombre; no cambia su saldo. |
| Corregir un saldo mal cargado | En ese mismo formulario, poné el **saldo disponible real de esa cuenta**, no el total de tu patrimonio. Confirmá el valor anterior y el nuevo. Se ajusta el saldo inicial; no se inventa un gasto/ingreso ni se reescribe el historial. |
| Registrar dinero que moví entre mis cuentas | Dentro de la cuenta → Transferir. Elegí Desde, Hacia, monto y fecha; revisá los dos saldos resultantes. Ambas cuentas deben ser de la misma moneda. |
| Corregir o deshacer esa transferencia | Movimientos → transferencia → Editar o Deshacer. Cambia ambas cuentas una sola vez. Ajustes → Movimientos deshechos permite recuperarla. |

**No corrijas nada por actualizar.** Si tus saldos ya coinciden, dejalos como están.
Usá la corrección de saldo solo para un error de carga. Un gasto, un cobro o una
transferencia real se registra como tal. Las nuevas acciones no ejecutan pagos ni
transferencias bancarias; solo actualizan tus registros en FinanzApp.

Para una transferencia, las cuentas de destino se limitan a la misma moneda.
Si falta otra, el formulario ofrece agregarla. Cambiar pesos por dólares necesita
dos importes y una cotización real: todavía no está implementado. Una comisión
real se registra como gasto separado, no se inventa dentro de la transferencia.
Un saldo negativo se advierte, pero se permite registrar una operación real.

### Revisión breve, cuando puedas

1. Primero comprobá que los saldos y movimientos anteriores siguen iguales.
2. Abrí una cuenta y su lápiz, revisá el formulario y cerralo sin guardar.
3. Si tenés una transferencia real para registrar, cargala y verificá: el origen
   baja, el destino sube y el disponible total de esa moneda **no cambia**. Aparece
   una vez en Movimientos → Todos y no infla los gastos/ingresos del reporte.
4. Abrí su edición, cambiá el borrador y cancelá: no debe cambiar nada. Solo
   guardá o deshacé operaciones que realmente quieras corregir.
5. Cerrá y reabrí la app. Guardá otra copia privada; importar esa misma copia debe
   indicarte que ya está incorporada, sin duplicados. No borres tu instalación
   para probar una restauración desde cero.
6. Probá volver, un swipe pequeño cancelado, letra grande, modo oscuro y Reducir
   movimiento. Si falla, anotá pantalla/gesto y grabá un video sin datos sensibles.

El respaldo nuevo es v3 e incluye cuentas corregidas y transferencias activas o
deshechas. Sigue aceptando copias nativas v1/v2 y bloqueando conflictos. No exporta
todo el historial de cambios local. La copia de la app web, tarjetas e inversiones
sigue pendiente de un importador específico: no hace falta recargar tu patrimonio.

Siguiente bloque: diseñar la importación segura de datos anteriores, con revisión
de qué entidades admite y comparación de totales antes de guardar. Las funciones
de Apple, la sincronización y la versión independiente firmada siguen en el roadmap.
