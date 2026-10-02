# El Coliseo

Sitio web del complejo deportivo El Coliseo (Posadas, Misiones): 3 canchas de fútbol 5, 2 de fútbol 6 con césped sintético, 2 de pádel Blindex y quincho con parrilla y terraza. Las reservas se arman en la página y se envían por WhatsApp.

Es un sitio estático de varias páginas, sin dependencias ni paso de compilación.

## Páginas

- `index.html`: inicio, plano interactivo de canchas y servicios.
- `canchas.html`: detalle de fútbol 5, fútbol 6 y pádel.
- `quincho.html`: alquiler del quincho con parrilla y terraza.
- `reservar.html`: asistente de reserva (cancha, quincho o combo) con calendario.
- `contacto.html`: dirección, WhatsApp y mapa.

## Panel de administración

Página aparte en `admin/` (no está enlazada desde el sitio público). Se entra con email y contraseña y solo pueden usarla las personas autorizadas. Los datos se guardan en Supabase (base de datos gratuita).

- `admin/index.html`, `admin/admin.css`: pantallas, pensadas para el celular.
- `admin/js/config.js`: dirección del proyecto y clave **pública** de Supabase (es seguro que esté en el código; nunca poner acá la clave secreta ni la `service_role`).
- `admin/js/app.js`: inicio de sesión y control de permisos.
- `admin/js/reservas.js`: calendario y lista del día (cargar, editar, cancelar, historial).
- `admin/js/quincho.js`, `eventos.js`, `resumen.js`: secciones de quincho, eventos y torneos, y resumen de dinero.
- `admin/js/solicitudes.js`: bandeja de pedidos que llegan desde la página del cliente (aceptar o rechazar).
- `admin/js/nav.js`: pestañas del panel.
- `db/01-tablas.sql`: tablas y reglas de seguridad (se pega una vez en Supabase > SQL Editor).
- `db/02-administradores.sql`: autoriza a las personas. No subir con los emails reales.
- `db/03-precios.sql`: precios de canchas y quincho (para cambiar un precio, se edita y se vuelve a correr).
- `db/04-solicitudes.sql`: tabla de pedidos que llegan desde la página del cliente y sus reglas de seguridad.
- `db/05-horarios-ocupados.sql`: consulta pública que devuelve solo qué cancha está ocupada y a qué hora (sin nombres ni datos personales), para tachar los turnos en la página del cliente.

La seguridad no depende de esconder la clave: las reglas de la base de datos solo dejan leer y escribir a los administradores autorizados.

## Archivos

- `styles.css`: estilos y colores de la marca (azul `#007ABD`, verde `#00923D`, naranja brasa del quincho).
- `js/common.js`: datos de las canchas, dibujo del plano, menú y enlaces de WhatsApp.
- `js/home.js`: selección de cancha en el inicio.
- `js/reservar.js`: calendario, validación y armado del mensaje de WhatsApp.
- `assets/`: logo y favicon.
- `serve.ps1`: servidor local de prueba para Windows.

## Ver el sitio

Abrí `index.html` en el navegador, o corré el servidor local:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Después entrá a http://localhost:5173/.

## Cómo funciona la reserva

El cliente completa el formulario (cancha, quincho o combo, día, horario, nombre y cantidad de personas). Al enviarlo pasan dos cosas a la vez:

1. Se abre WhatsApp con el mensaje ya armado.
2. El pedido se guarda en la tabla `solicitudes` de la base de datos. En el panel aparece en la pestaña **Solicitudes**, donde se acepta (se carga como reserva) o se rechaza.

La reserva queda confirmada cuando el complejo responde. Si falla el guardado, el cliente igual puede mandar el mensaje por WhatsApp.

Al elegir el día, la página consulta qué horarios ya están reservados y los tacha (si la cancha elegida está ocupada, o "Completo" cuando están ocupadas todas las del deporte; en el quincho no deja elegir un horario que pise otra reserva). Solo se ve la hora y la cancha, nunca datos del cliente. Un pedido pendiente en Solicitudes todavía no ocupa horario.

Cualquiera puede **enviar** una solicitud, pero nadie sin cuenta autorizada puede **leer** ninguna. Hay un tope de 40 pedidos cada 10 minutos contra abusos (`db/04-solicitudes.sql`).

Se puede preseleccionar desde un enlace: `reservar.html?tipo=cancha|quincho|combo&deporte=f5|f6|padel&cancha=2`.

## Datos para editar

- Número de WhatsApp: constante `WA_NUMBER` en `js/common.js` y los enlaces `wa.me` en los `.html`.
- Dirección: pie de página de cada `.html`, `contacto.html` y los datos estructurados de `index.html`.
- Cantidad de canchas: `SPORTS` y `COURTS` en `js/common.js`.
- Precios: se cambian en **tres** lugares. En `js/common.js` (`PRICES`, para el precio estimado de la reserva), en los textos de `index.html`, `canchas.html`, `quincho.html` y `reservar.html` (preguntas frecuentes), y en la base de datos con `db/03-precios.sql` (para el panel). La luz se cobra desde las 19:00 (`luzDesde`, en `js/common.js` y `admin/js/util.js`).
- Numeración de canchas: 1 a 3 son de fútbol 5, 4 y 5 de fútbol 6, más Pádel 1 y 2 (`COURTS` en `js/common.js` y la tabla `canchas` de la base de datos).
- Horario de atención: `HOURS` en `js/common.js` (hoy de 17:00 a 01:00; las horas pasada la medianoche cuentan desde 24, así `25` es la 01:00) y los textos "Abierto de 17:00 a 01:00" en los `.html`.
- Tipos de evento del quincho: opciones de `#q-event` en `reservar.html`.
