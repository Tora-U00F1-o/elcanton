Aquí tienes toda la especificación técnica en formato **Markdown (.md)**, lista para copiar, pegar y guardar directamente en tu repositorio o entregársela al agente de desarrollo.

He optimizado el diseño para que use componentes nativos ligeros y se ejecute sin problemas en local.

---

```markdown
# Especificación Técnica: Ruta Guiada Web (OSM Local Edition)

## 1. Descripción General
El objetivo es desarrollar una aplicación web móvil-first de una sola página (SPA) que se ejecute únicamente en el lado del cliente (Frontend). El propósito principal es guiar a los usuarios hacia un destino específico en Oviedo, obligándolos a pasar por un punto de control intermedio (Catedral de Oviedo) para garantizar que sigan un trayecto preestablecido.

La aplicación se ejecutará de forma local sin dependencias de backend ni costes de APIs. Para la navegación en tiempo real fuera de la web se utilizará redirección externa a Google Maps, mientras que la visualización interna utilizará OpenStreetMap (OSM) y Leaflet.js.

---

## 2. Arquitectura de Archivos (Estructura en Local)

Para ejecutar el proyecto en local con un servidor sencillo (como la extensión Live Server de VSCode), la estructura debe ser la siguiente:

```text
mi-ruta-osm/
├── index.html            <-- Pantalla 1: Dashboard Principal
├── mapa.html             <-- Pantalla 2: Visor del Mapa OSM / Leaflet
├── css/
│   └── styles.css        <-- Estilos globales (Nativos, CSS Variables, Responsive)
├── js/
│   ├── config.js         <-- Constantes, coordenadas de Oviedo y rutas
│   └── main.js           <-- Inicialización del mapa, geolocalización y lógica
└── assets/
    └── images/
        ├── landmark1.jpg <-- Foto de control (Ej. Fachada de la Catedral)
        └── landmark2.jpg <-- Foto de control 2 (Opcional)

```

---

## 3. Configuración Centralizada (`js/config.js`)

Toda la parametrización de la app se declara en este archivo estático para evitar "cablear" código en los archivos principales:

```javascript
const CONFIG = {
  // Coordenadas fijas en Oviedo
  puntos: {
    inicioFijo: { 
      lat: 43.3664, 
      lng: -5.8427, 
      nombre: "Estación de Autobuses de Oviedo" 
    },
    paradaIntermedia: { 
      lat: 43.3624, 
      lng: -5.8432, 
      nombre: "Catedral de San Salvador" 
    },
    destinoFinal: { 
      lat: 43.3548, 
      lng: -5.8512, 
      nombre: "Campus de Llamaquique" 
    }
  },
  
  // Puntos de información con imágenes para el mapa interactivo
  checkpoints: [
    {
      lat: 43.3624,
      lng: -5.8432,
      titulo: "📍 PARADA 1: Catedral de Oviedo",
      descripcion: "Punto de control obligatorio. Al llegar aquí, gira a la derecha por la Calle de San Vicente.",
      fotoUrl: "assets/images/landmark1.jpg"
    }
  ],
  
  // Enlaces de utilidad y tráfico (QoL)
  enlacesExternos: {
    alsa: "[https://www.alsa.es](https://www.alsa.es)",
    tuaOviedo: "[https://tua.es](https://tua.es)",
    traficoAsturias: "[http://www.carreterasasturias.es](http://www.carreterasasturias.es)"
  }
};

```

---

## 4. Requisitos de las Pantallas

### Pantalla 1: Dashboard (`index.html`)

* **Encabezado:** Título "🚩 RUTA GUIADA WEB" y botón para alternar el **Modo Oscuro / Claro**.
* **Acción Principal - Botón 1 ("Usar mi ubicación actual"):**
1. Solicita acceso al GPS con `navigator.geolocation.getCurrentPosition()`.
2. Si el usuario acepta, calcula la URL multipunto dinámica de Google Maps y redirige:
`https://www.google.com/maps/dir/?api=1&origin={lat_actual},{lng_actual}&waypoints={lat_parada},{lng_parada}&destination={lat_destino}&travelmode=walking`
3. Si el usuario deniega el permiso o falla el GPS, muestra un banner/modal elegante invitándole a usar la "Ruta Fija".


* **Acción Principal - Botón 2 ("Iniciar Ruta Fija"):**
1. No requiere GPS. Redirige a la pantalla del mapa interno (`mapa.html?route=fixed`).


* **Módulo de Enlaces (QoL):** Tarjetas táctiles y accesibles con enlaces directos cargados desde `CONFIG.enlacesExternos` (ALSA, TUA Oviedo, Tráfico).

### Pantalla 2: Visor del Mapa (`mapa.html`)

* **Contenedor del Mapa:** Un div `#map` que ocupe el 100% de la pantalla útil móvil.
* **Integración de Leaflet:** Carga de mapa base sin coste (OpenStreetMap) a través de CDN:
```html
<link rel="stylesheet" href="[https://unpkg.com/leaflet@1.9.4/dist/leaflet.css](https://unpkg.com/leaflet@1.9.4/dist/leaflet.css)" />
<script src="[https://unpkg.com/leaflet@1.9.4/dist/leaflet.js](https://unpkg.com/leaflet@1.9.4/dist/leaflet.js)"></script>

```


* **Dibujo del Trayecto:** Se dibuja una línea estática (`L.polyline`) uniendo los tres puntos (`Inicio -> Parada -> Destino`) en color azul semitransparente (`#3B82F6`) para visualizar la ruta.
* **Marcadores Interactivos (Pop-ups):**
* Se colocan pines en los tres puntos de la ruta.
* Al pulsar en el pin de la **Parada Intermedia**, se despliega un pop-up que contiene la imagen (`landmark1.jpg`) de forma responsive, el título y la instrucción de giro.


* **Botón Flotante "Centrar GPS":** Ubicado en la esquina inferior derecha. Al pulsarlo, centra la vista del mapa en la ubicación real del usuario en caso de que se haya desplazado por la pantalla.
* **Botón "Volver":** Ubicado en la parte inferior para regresar fácilmente al Dashboard principal.

---

## 5. Diseño Visual y Estilos (CSS Nativo)

El archivo `css/styles.css` debe cumplir con las siguientes directrices:

* **Variables CSS** para soportar el cambio de tema en caliente de forma limpia:
```css
:root {
  --bg-primary: #ffffff;
  --text-primary: #1f2937;
  --accent-color: #2563eb;
  --card-bg: #f3f4f6;
}
body.dark-mode {
  --bg-primary: #111827;
  --text-primary: #f9fafb;
  --accent-color: #3b82f6;
  --card-bg: #1f2937;
}

```


* **Diseño Mobile-First:** El layout debe tener un ancho máximo (`max-width: 480px`) centrado en pantallas grandes para simular perfectamente un dispositivo móvil en navegadores de escritorio.
* **Interactividad:** Todos los botones interactivos deben tener un área mínima de pulsación de `44px x 44px` para cumplir con las normas de accesibilidad táctil.

---

## 6. Restricciones Técnicas (No-Gos)

1. **NO usar Frameworks pesados:** No se permite React, Angular o Vue. Todo debe programarse en JavaScript Vanilla puro para asegurar una carga instantánea.
2. **NO usar Backend:** Los datos se leen directamente desde `config.js`. No se requieren bases de datos ni llamadas `fetch` externas a servidores propios.
3. **NO guardar estado en servidor:** Las preferencias estéticas (como el tema oscuro) se guardarán localmente en el navegador mediante `localStorage`.

```
***

Con este documento `.md`, el agente de programación tendrá perfectamente claros el alcance, las limitaciones, los flujos lógicos y las tecnologías a emplear para crear tu MVP de forma ágil y ordenada. ¡Ya puedes copiarlo directamente a tu editor!

```