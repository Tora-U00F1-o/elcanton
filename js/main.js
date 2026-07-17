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

// Helper to get all points ordered: inicioFijo -> pto1..ptoN -> destinoFinal
function getOrderedPuntos() {
  const puntos = CONFIG.puntos;
  const list = [];
  
  if (puntos.inicioFijo) {
    list.push(puntos.inicioFijo);
  }
  
  // Sort keys that start with "pto" numerically
  const ptoKeys = Object.keys(puntos).filter(k => k.startsWith('pto'));
  ptoKeys.sort((a, b) => {
    const numA = parseInt(a.replace('pto', ''), 10);
    const numB = parseInt(b.replace('pto', ''), 10);
    return numA - numB;
  });
  
  ptoKeys.forEach(k => {
    list.push(puntos[k]);
  });
  
  if (puntos.destinoFinal) {
    list.push(puntos.destinoFinal);
  }
  
  return list;
}

// Helper to generate Google Maps URL dynamically
function getGoogleMapsUrl(originLat, originLng) {
  const points = getOrderedPuntos();
  if (points.length === 0) return '';
  
  const destPoint = points[points.length - 1];
  const destinationQuery = `${destPoint.lat},${destPoint.lng}`;
  
  // Waypoints are all intermediate points
  const waypoints = [];
  for (let i = 1; i < points.length - 1; i++) {
    waypoints.push(`${points[i].lat},${points[i].lng}`);
  }
  
  const waypointsStr = waypoints.join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&waypoints=${encodeURIComponent(waypointsStr)}&destination=${encodeURIComponent(destinationQuery)}&travelmode=driving`;
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
        
        // Dynamic multi-point driving routing URL for Google Maps
        const mapsUrl = getGoogleMapsUrl(uLat, uLng);
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

  const orderedPuntos = getOrderedPuntos();
  if (orderedPuntos.length === 0) return;

  const posFixedA = orderedPuntos[0];

  // Read URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const routeType = urlParams.get('route');

  // Initialize Leaflet map centered midway
  map = L.map('map').setView([43.333, -5.134], 13);

  // Setup Tile layers dynamically based on theme
  updateMapTiles();

  let startLat = posFixedA.lat;
  let startLng = posFixedA.lng;
  let gpsOrigin = null;

  // Floating Checkpoint HUD Setup
  const hud = document.getElementById('checkpointHUD');
  const hudImg = document.getElementById('hudImg');
  const hudTitle = document.getElementById('hudTitle');
  const hudDesc = document.getElementById('hudDesc');
  const btnCloseHUD = document.getElementById('btnCloseHUD');

  if (btnCloseHUD) {
    btnCloseHUD.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hud) {
        hud.style.display = 'none';
      }
      if (activeMarker) {
        updateMarkerIcon(activeMarker, activeMarker.options.originalColor);
        activeMarker = null;
      }
    });
  }

  function loadCheckpointHUD(point) {
    if (!point || !hud || !hudImg || !hudTitle || !hudDesc) return;
    
    const foto = point.fotoUrl || point.imagen;
    const title = point.titulo || point.nombre || 'Punto';
    const desc = point.indicacion || point.descripcion || '';
    
    if (foto) {
      hudImg.src = foto;
      hudImg.style.display = 'block';
    } else {
      hudImg.style.display = 'none';
    }
    
    hudTitle.textContent = title;
    hudDesc.textContent = desc;
    
    hud.style.display = 'flex';
    hud.style.animation = 'none';
    void hud.offsetWidth; // trigger reflow
    hud.style.animation = 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
  }

  let activeMarker = null;

  function updateMarkerIcon(m, color) {
    m.setIcon(L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="marker-pin-wrapper" style="background:${color};"><div class="marker-inner-content">${m.options.myLabel}</div></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -30]
    }));
  }

  // Render all points dynamically
  orderedPuntos.forEach((point, index) => {
    let markerColor = '#0ea5e9'; // default cyan/blue for checkpoints
    let markerLabel = index; // numbers: 1, 2, 3...
    
    if (index === 0) {
      markerColor = '#2563eb'; // blue for start (A)
      markerLabel = 'A';
    } else if (index === orderedPuntos.length - 1) {
      markerColor = '#0ea5e9'; // same blue/cyan as checkpoints
      markerLabel = '🏠';
    }
    
    const marker = L.marker([point.lat, point.lng], {
      icon: L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="marker-pin-wrapper" style="background:${markerColor};"><div class="marker-inner-content">${markerLabel}</div></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -30]
      })
    }).addTo(map);

    marker.options.myLabel = markerLabel;
    marker.options.originalColor = markerColor;
    marker.options.isCheckpoint = (index > 0);

    if (index === 0) {
      startMarker = marker;
      marker.bindPopup(`<h4>Origen: ${point.nombre || 'Cangas de Onís'}</h4>`);
    }

    // Load HUD when clicking a marker
    marker.on('click', () => {
      loadCheckpointHUD(point);
      
      if (marker.options.isCheckpoint) {
        if (activeMarker && activeMarker !== marker) {
          updateMarkerIcon(activeMarker, activeMarker.options.originalColor);
        }
        activeMarker = marker;
        updateMarkerIcon(marker, '#facc15'); // Yellow
      }

      // Fly to marker coordinates with smooth zoom, offset to top 40% of screen to avoid HUD card overlap
      const targetZoom = 17;
      const targetPoint = map.project(marker.getLatLng(), targetZoom);
      const mapHeight = map.getSize().y;
      const offsetY = mapHeight * 0.10; // offset center downward so marker appears at 40% from top
      const newCenterPoint = L.point(targetPoint.x, targetPoint.y + offsetY);
      const newCenterLatLng = map.unproject(newCenterPoint, targetZoom);

      map.flyTo(newCenterLatLng, targetZoom, { animate: true, duration: 1.0 });
    });
  });

  let polyline = null;

  function drawStraightRoute(points) {
    if (polyline) {
      map.removeLayer(polyline);
    }
    const routeCoords = points.map(p => [p.lat, p.lng]);
    polyline = L.polyline(routeCoords, {
      color: '#0ea5e9',
      weight: 5,
      opacity: 0.5,
      lineJoin: 'round'
    }).addTo(map);
    map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
  }

  function drawRoute(originLat, originLng) {
    const points = [{ lat: originLat, lng: originLng }, ...orderedPuntos.slice(1)];
    const coordsString = points.map(p => `${p.lng},${p.lat}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${coordsString}?overview=full&geometries=geojson`;

    fetch(osrmUrl)
      .then(response => response.json())
      .then(data => {
        if (data.code === 'Ok' && data.routes && data.routes[0]) {
          if (polyline) {
            map.removeLayer(polyline);
          }
          // OSRM returns coordinates as [longitude, latitude], Leaflet needs [latitude, longitude]
          const routeCoords = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
          
          polyline = L.polyline(routeCoords, {
            color: '#0ea5e9',
            weight: 5,
            opacity: 0.5,
            lineJoin: 'round'
          }).addTo(map);
          
          map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
        } else {
          drawStraightRoute(points);
        }
      })
      .catch(err => {
        console.warn('OSRM routing failed, falling back to straight lines:', err);
        drawStraightRoute(points);
      });
  }

  // Draw initial route
  drawRoute(startLat, startLng);

  // If GPS route was requested, query GPS immediately
  if (routeType === 'gps' && startMarker) {
    startMarker.bindPopup('<h4>Localizando origen...</h4>').openPopup();
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const uLat = position.coords.latitude;
        const uLng = position.coords.longitude;
        gpsOrigin = { lat: uLat, lng: uLng };
        
        // Update Start Marker position to user GPS location
        startMarker.setLatLng([uLat, uLng]);
        startMarker.bindPopup('<h4>Origen: Tu ubicación actual</h4>').openPopup();
        
        // Redraw route line starting from GPS position
        drawRoute(uLat, uLng);
      },
      (error) => {
        console.error('GPS error, falling back to Cangas de Onís:', error);
        alert('No pudimos acceder a tu ubicación actual. La ruta comenzará desde Cangas de Onís por defecto.');
        startMarker.bindPopup(`<h4>Origen: ${posFixedA.nombre || 'Cangas de Onís'}</h4>`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // Hook up Top Google Maps button
  const btnOpenGoogleMaps = document.getElementById('btnOpenGoogleMaps');
  if (btnOpenGoogleMaps) {
    btnOpenGoogleMaps.addEventListener('click', () => {
      let originLat = posFixedA.lat;
      let originLng = posFixedA.lng;
      if (routeType === 'gps') {
        if (gpsOrigin) {
          originLat = gpsOrigin.lat;
          originLng = gpsOrigin.lng;
        } else {
          alert('Tu ubicación GPS aún se está cargando. Abriendo con origen en Cangas de Onís...');
        }
      }
      
      const mapsUrl = getGoogleMapsUrl(originLat, originLng);
      window.open(mapsUrl, '_blank');
    });
  }

  // Tip banner close handling
  const mapTip = document.getElementById('mapTipBanner');
  const btnCloseTip = document.getElementById('btnCloseTip');
  if (mapTip && btnCloseTip) {
    if (localStorage.getItem('hideMapTip') === 'true') {
      mapTip.style.display = 'none';
    } else {
      btnCloseTip.addEventListener('click', () => {
        mapTip.style.display = 'none';
        localStorage.setItem('hideMapTip', 'true');
      });
    }
  }

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

// Set a random background image from the portada folder
function initBackground() {
  const overlay = document.querySelector('.bg-blur-overlay');
  if (!overlay) return;

  const images = [
    'assets/images/portada/portada1.png',
    'assets/images/portada/portada2.png'
  ];

  const randomImage = images[Math.floor(Math.random() * images.length)];
  overlay.style.backgroundImage = `url('${randomImage}')`;
}

// Bootstrap Initialization
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initBackground();
  initDashboard();
  initMap();
});
