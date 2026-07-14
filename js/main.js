// Theme Toggle Helpers
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }

  const themeToggler = document.getElementById('themeToggler');
  if (themeToggler) {
    themeToggler.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const newTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
    });
  }
}

// Dashboard Page Controller
function initDashboard() {
  const btnUseGPS = document.getElementById('btnUseGPS');
  if (!btnUseGPS) return; // Exit if not on dashboard

  // Initialize external QoL links from config
  const linkAlsa = document.getElementById('linkAlsa');
  const linkTua = document.getElementById('linkTua');
  const linkTrafico = document.getElementById('linkTrafico');

  if (linkAlsa) linkAlsa.href = CONFIG.enlacesExternos.alsa;
  if (linkTua) linkTua.href = CONFIG.enlacesExternos.tuaOviedo;
  if (linkTrafico) linkTrafico.href = CONFIG.enlacesExternos.traficoAsturias;

  // GPS Button click handler
  btnUseGPS.addEventListener('click', () => {
    const textSpan = btnUseGPS.querySelector('.btn-card-text');
    const originalText = textSpan.textContent;
    textSpan.textContent = 'Localizando...';
    btnUseGPS.style.opacity = '0.7';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        textSpan.textContent = originalText;
        btnUseGPS.style.opacity = '1';
        
        const uLat = position.coords.latitude;
        const uLng = position.coords.longitude;
        
        // Extract route configurations from config.js
        const w1Lat = CONFIG.puntos.paradaIntermedia1.lat;
        const w1Lng = CONFIG.puntos.paradaIntermedia1.lng;
        const w2Lat = CONFIG.puntos.paradaIntermedia2.lat;
        const w2Lng = CONFIG.puntos.paradaIntermedia2.lng;
        
        // Multi-point driving routing URL for Google Maps with address destination
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${uLat},${uLng}&waypoints=${w1Lat},${w1Lng}%7C${w2Lat},${w2Lng}&destination=Casa+de+Aldea+El+Cantón,+Lugar+Tornin,+36,+33557+Tornín,+Asturias&travelmode=driving`;
        
        window.open(mapsUrl, '_blank');
      },
      (error) => {
        console.error('Error fetching GPS position:', error);
        textSpan.textContent = originalText;
        btnUseGPS.style.opacity = '1';
        
        // Reveal custom error dialog
        const modal = document.getElementById('gpsErrorModal');
        if (modal) {
          modal.style.display = 'flex';
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  // Modal Close handler
  const btnCloseModal = document.getElementById('btnCloseModal');
  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      const modal = document.getElementById('gpsErrorModal');
      if (modal) {
        modal.style.display = 'none';
      }
    });
  }
}

// Map Page Controller
let map = null;
let tileLayer = null;
let userLocMarker = null;

function initMap() {
  const mapElement = document.getElementById('map');
  if (!mapElement) return; // Exit if not on map page

  const posFixedA = CONFIG.puntos.inicioFijo;
  const posB1 = CONFIG.puntos.paradaIntermedia1;
  const posB2 = CONFIG.puntos.paradaIntermedia2;
  const posC = CONFIG.puntos.destinoFinal;

  // Read URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const routeType = urlParams.get('route');

  // Initialize Leaflet map centered midway
  map = L.map('map').setView([43.333, -5.134], 13);

  // Setup Tile layers dynamically based on theme
  updateMapTiles();

  let startLat = posFixedA.lat;
  let startLng = posFixedA.lng;
  let startName = posFixedA.nombre;
  let gpsOrigin = null;

  // Create customized Marker A
  const markerA = L.marker([startLat, startLng], {
    icon: L.divIcon({
      className: 'custom-div-icon',
      html: '<div class="marker-pin-wrapper" style="background:#2563eb;"><div class="marker-inner-content">A</div></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -30]
    })
  }).addTo(map);
  markerA.bindPopup(`<h4>Origen: Cangas de Onís</h4><p>${startName}</p>`);

  // Create customized Marker B1 (checkpoint 1)
  const markerB1 = L.marker([posB1.lat, posB1.lng], {
    icon: L.divIcon({
      className: 'custom-div-icon checkpoint-icon',
      html: '<div class="marker-pin-wrapper"><div class="marker-inner-content">B1</div></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -30]
    })
  }).addTo(map);
  markerB1.bindPopup(`<h4>Punto de Control 1</h4><p>${posB1.nombre}</p>`);

  // Create customized Marker B2 (checkpoint 2)
  const markerB2 = L.marker([posB2.lat, posB2.lng], {
    icon: L.divIcon({
      className: 'custom-div-icon checkpoint-icon',
      html: '<div class="marker-pin-wrapper" style="background:#06b6d4;"><div class="marker-inner-content">B2</div></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -30]
    })
  }).addTo(map);
  markerB2.bindPopup(`<h4>Punto de Control 2</h4><p>${posB2.nombre}</p>`);

  // Create customized Marker C (destination)
  const markerC = L.marker([posC.lat, posC.lng], {
    icon: L.divIcon({
      className: 'custom-div-icon',
      html: '<div class="marker-pin-wrapper" style="background:#ef4444;"><div class="marker-inner-content">C</div></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -30]
    })
  }).addTo(map);
  markerC.bindPopup(`<h4>Destino: Casa de Aldea El Cantón</h4><p>${posC.nombre}</p>`);

  let polyline = null;
  function drawRoute(originLat, originLng) {
    if (polyline) {
      map.removeLayer(polyline);
    }
    const routeCoords = [
      [originLat, originLng],
      [posB1.lat, posB1.lng],
      [posB2.lat, posB2.lng],
      [posC.lat, posC.lng]
    ];
    polyline = L.polyline(routeCoords, {
      color: '#0ea5e9',
      weight: 5,
      opacity: 0.8,
      lineJoin: 'round'
    }).addTo(map);

    // Auto-fit viewport bounds to show entire route
    map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
  }

  // Draw initial route
  drawRoute(startLat, startLng);

  // If GPS route was requested, query GPS immediately
  if (routeType === 'gps') {
    markerA.bindPopup('<h4>Localizando origen...</h4>').openPopup();
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const uLat = position.coords.latitude;
        const uLng = position.coords.longitude;
        gpsOrigin = { lat: uLat, lng: uLng };
        
        // Update Marker A position to user GPS location
        markerA.setLatLng([uLat, uLng]);
        markerA.bindPopup('<h4>Origen: Tu ubicación actual</h4>').openPopup();
        
        // Redraw route line starting from GPS position
        drawRoute(uLat, uLng);
      },
      (error) => {
        console.error('GPS error, falling back to Cangas de Onís:', error);
        alert('No pudimos acceder a tu ubicación actual. La ruta comenzará desde Cangas de Onís por defecto.');
        markerA.bindPopup(`<h4>Origen: Cangas de Onís</h4><p>${startName}</p>`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // Hook up Top Google Maps button
  const btnOpenGoogleMaps = document.getElementById('btnOpenGoogleMaps');
  if (btnOpenGoogleMaps) {
    btnOpenGoogleMaps.addEventListener('click', () => {
      let originQuery = `${posFixedA.lat},${posFixedA.lng}`;
      if (routeType === 'gps') {
        if (gpsOrigin) {
          originQuery = `${gpsOrigin.lat},${gpsOrigin.lng}`;
        } else {
          // GPS requested but not loaded yet (or failed), request it on the fly or warn
          alert('Tu ubicación GPS aún se está cargando. Abriendo con origen en Cangas de Onís...');
        }
      }
      
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originQuery}&waypoints=${posB1.lat},${posB1.lng}%7C${posB2.lat},${posB2.lng}&destination=Casa+de+Aldea+El+Cantón,+Lugar+Tornin,+36,+33557+Tornín,+Asturias&travelmode=driving`;
      window.open(mapsUrl, '_blank');
    });
  }

  // Floating Checkpoint HUD Setup
  const hud = document.getElementById('checkpointHUD');
  const hudImg = document.getElementById('hudImg');
  const hudTitle = document.getElementById('hudTitle');
  const hudDesc = document.getElementById('hudDesc');

  // Load the first checkpoint data on start
  function loadCheckpointHUD(index) {
    const cpData = CONFIG.checkpoints[index];
    if (cpData && hud && hudImg && hudTitle && hudDesc) {
      hudImg.src = cpData.fotoUrl;
      hudTitle.textContent = cpData.titulo;
      hudDesc.textContent = cpData.descripcion;
      
      hud.style.display = 'flex';
      hud.style.animation = 'none';
      void hud.offsetWidth; // trigger reflow
      hud.style.animation = 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    }
  }

  // Load CP1 on start
  setTimeout(() => {
    loadCheckpointHUD(0);
  }, 500);

  // Click on checkpoint marker B1 shows HUD for B1
  markerB1.on('click', () => {
    loadCheckpointHUD(0);
  });

  // Click on checkpoint marker B2 shows HUD for B2
  markerB2.on('click', () => {
    loadCheckpointHUD(1);
  });

  // Action Buttons
  const btnMapBack = document.getElementById('btnMapBack');
  if (btnMapBack) {
    btnMapBack.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  const btnRecenterGPS = document.getElementById('btnRecenterGPS');
  if (btnRecenterGPS) {
    btnRecenterGPS.addEventListener('click', () => {
      const originalHtml = btnRecenterGPS.innerHTML;
      btnRecenterGPS.innerHTML = '⌛ Localizando...';
      btnRecenterGPS.disabled = true;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const uLat = position.coords.latitude;
          const uLng = position.coords.longitude;

          // Place or shift user avatar marker
          if (!userLocMarker) {
            userLocMarker = L.marker([uLat, uLng], {
              icon: L.divIcon({
                className: 'custom-div-icon',
                html: '<div class="marker-pin-wrapper" style="background:#10b981; border-radius:50%;"><div class="marker-inner-content" style="transform:rotate(45deg);">👤</div></div>',
                iconSize: [32, 32],
                iconAnchor: [16, 16]
              })
            }).addTo(map);
            userLocMarker.bindPopup('<h4>Tu ubicación actual</h4>');
          } else {
            userLocMarker.setLatLng([uLat, uLng]);
          }

          map.flyTo([uLat, uLng], 15, { animate: true, duration: 1.5 });
          btnRecenterGPS.innerHTML = originalHtml;
          btnRecenterGPS.disabled = false;
        },
        (error) => {
          console.error('Error tracking user location:', error);
          alert('No pudimos acceder a tu ubicación actual de GPS. Verifica los permisos de localización de tu navegador.');
          btnRecenterGPS.innerHTML = originalHtml;
          btnRecenterGPS.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }
}

// Update Leaflet tile layer depending on layout theme
function updateMapTiles() {
  if (!map) return;

  if (tileLayer) {
    map.removeLayer(tileLayer);
  }

  const isDark = document.body.classList.contains('dark-mode');
  
  // Use Voyager (clean colorful) for light mode, Dark Matter for dark mode
  const url = isDark 
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    
  const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

  tileLayer = L.tileLayer(url, {
    attribution: attribution,
    maxZoom: 19
  }).addTo(map);
}

// Bootstrap Initialization
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initDashboard();
  initMap();
});
