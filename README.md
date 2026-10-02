# El Coliseo

Sitio web del complejo deportivo El Coliseo (Posadas, Misiones): 3 canchas de fútbol 5, 2 de fútbol 6 con césped sintético, 2 de pádel Blindex y quincho con parrilla y terraza. Las reservas se arman en la página y se envían por WhatsApp.

Es un sitio estático de varias páginas, sin dependencias ni paso de compilación.

## Páginas

- `index.html`: inicio, plano interactivo de canchas y servicios.
- `canchas.html`: detalle de fútbol 5, fútbol 6 y pádel.
- `quincho.html`: alquiler del quincho con parrilla y terraza.
- `reservar.html`: asistente de reserva (cancha, quincho o combo) con calendario.
- `contacto.html`: dirección, WhatsApp y mapa.

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

El sitio no guarda reservas: arma un mensaje con la cancha o el quincho, el día, el horario y los datos, y lo envía por WhatsApp. La reserva queda confirmada cuando el complejo responde.

Se puede preseleccionar desde un enlace: `reservar.html?tipo=cancha|quincho|combo&deporte=f5|f6|padel&cancha=2`.

## Datos para editar

- Número de WhatsApp: constante `WA_NUMBER` en `js/common.js` y los enlaces `wa.me` en los `.html`.
- Dirección: pie de página de cada `.html`, `contacto.html` y los datos estructurados de `index.html`.
- Cantidad de canchas: `SPORTS` y `COURTS` en `js/common.js`.
- Horario de atención: `HOURS` en `js/common.js` (hoy de 17:00 a 01:00; las horas pasada la medianoche cuentan desde 24, así `25` es la 01:00) y los textos "Abierto de 17:00 a 01:00" en los `.html`.
- Tipos de evento del quincho: opciones de `#q-event` en `reservar.html`.
