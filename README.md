# El Coliseo

Sitio web del complejo deportivo El Coliseo (Posadas, Misiones): 3 canchas de fútbol 5, 2 de fútbol 6 con césped sintético y 2 de pádel Blindex. Las reservas se hacen por WhatsApp.

Es un sitio estático, sin dependencias ni paso de compilación.

## Archivos

- `index.html`: contenido y datos estructurados para Google.
- `styles.css`: estilos y colores de la marca (azul `#007ABD`, verde `#00923D`).
- `script.js`: plano interactivo de canchas y formulario que arma el mensaje de WhatsApp.
- `assets/`: logo y favicon.
- `serve.ps1`: servidor local de prueba para Windows.

## Ver el sitio

Abrí `index.html` en el navegador, o corré el servidor local:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Después entrá a http://localhost:5173/.

## Datos para editar

- Número de WhatsApp: constante `WA_NUMBER` en `script.js` y los enlaces `wa.me` en `index.html`.
- Dirección: `index.html` (sección "Dónde estamos", pie de página y datos estructurados).
- Cantidad de canchas: `SPORTS` y `COURTS` en `script.js`.
