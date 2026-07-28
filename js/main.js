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

// Helper to get active zones configuration (localStorage override or file)
function getActiveZonesConfig() {
  try {
    const localData = localStorage.getItem('ZONES_CONFIG');
    if (localData) {
      return JSON.parse(localData);
    }
  } catch (e) {
    console.warn('Error reading ZONES_CONFIG from localStorage:', e);
  }
  return (window.ZONES_CONFIG && window.ZONES_CONFIG.polygons) ? window.ZONES_CONFIG : { polygons: [] };
}

// Ray-Casting Point in Polygon algorithm
function isPointInPolygon(lat, lng, polygonCoords) {
  if (!polygonCoords || polygonCoords.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygonCoords.length - 1; i < polygonCoords.length; j = i++) {
    const xi = polygonCoords[i][0], yi = polygonCoords[i][1];
    const xj = polygonCoords[j][0], yj = polygonCoords[j][1];
    const intersect = ((yi > lng) !== (yj > lng))
        && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Find polygon and target checkpoint key for an origin coordinate
function getNextCheckpointKeyForLocation(lat, lng) {
  const config = getActiveZonesConfig();
  if (config.polygons && config.polygons.length > 0) {
    for (const poly of config.polygons) {
      if (poly.coords && isPointInPolygon(lat, lng, poly.coords)) {
        console.log(`Ubicación en polígono "${poly.nombre}". Siguiente checkpoint: ${poly.nextCheckpointKey}`);
        return poly.nextCheckpointKey;
      }
    }
  }
  return null;
}

// Helper to get intermediate points: pto1..ptoN
function getIntermediatePuntos() {
  const puntos = CONFIG.puntos;
  const list = [];
  const ptoKeys = Object.keys(puntos).filter(k => k.startsWith('pto'));
  ptoKeys.sort((a, b) => {
    const numA = parseInt(a.replace('pto', ''), 10);
    const numB = parseInt(b.replace('pto', ''), 10);
    return numA - numB;
  });
  ptoKeys.forEach(k => list.push({ key: k, ...puntos[k] }));
  return list;
}

// Helper to filter intermediate points starting from assigned target checkpoint
function getEffectiveIntermediatePuntos(originLat, originLng) {
  const allIntermediates = getIntermediatePuntos();
  if (originLat === undefined || originLng === undefined) return allIntermediates;

  const targetKey = getNextCheckpointKeyForLocation(originLat, originLng);
  if (!targetKey) return allIntermediates;

  if (targetKey === 'destinoFinal') {
    return [];
  }

  // Find index of targetKey in intermediate points list
  const targetIdx = allIntermediates.findIndex(p => p.key === targetKey || p.nombre === targetKey);
  if (targetIdx !== -1) {
    return allIntermediates.slice(targetIdx);
  }

  return allIntermediates;
}

// Helper to get all points ordered: inicioFijo -> pto1..ptoN -> destinoFinal
function getOrderedPuntos() {
  const puntos = CONFIG.puntos;
  const list = [];
  
  if (puntos.inicioFijo) {
    list.push(puntos.inicioFijo);
  }
  
  const intermediate = getIntermediatePuntos();
  intermediate.forEach(p => list.push(p));
  
  if (puntos.destinoFinal) {
    list.push(puntos.destinoFinal);
  }
  
  return list;
}

// Helper to generate Google Maps URL dynamically
function getGoogleMapsUrl(originLat, originLng) {
  const points = [];
  
  const intermediate = getEffectiveIntermediatePuntos(originLat, originLng);
  intermediate.forEach(p => points.push(p));
  
  const destPoint = CONFIG.puntos.destinoFinal;
  if (!destPoint) return '';
  
  const destinationQuery = `${destPoint.lat},${destPoint.lng}`;
  const waypoints = points.map(p => `${p.lat},${p.lng}`);
  
  if (waypoints.length === 0) {
    return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${encodeURIComponent(destinationQuery)}&travelmode=driving`;
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
  const intermediatePuntos = getIntermediatePuntos();
  const destPunto = CONFIG.puntos.destinoFinal;

  // Read URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const routeType = urlParams.get('route');

  // Initialize Leaflet map centered midway
  map = L.map('map').setView([43.333, -5.134], 13);

  // Setup Tile layers dynamically based on theme
  updateMapTiles();

  // Floating Checkpoint HUD Setup
  const hud = document.getElementById('checkpointHUD');
  const hudImg = document.getElementById('hudImg');
  const hudTitle = document.getElementById('hudTitle');
  const hudDesc = document.getElementById('hudDesc');
  const btnCloseHUD = document.getElementById('btnCloseHUD');

  if (btnCloseHUD) {
    btnCloseHUD.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hud) hud.style.display = 'none';
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

  function createCustomMarker(lat, lng, label, color, popupHtml, pointData, isCheckpoint = true) {
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="marker-pin-wrapper" style="background:${color};"><div class="marker-inner-content">${label}</div></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -30]
      })
    });

    marker.options.myLabel = label;
    marker.options.originalColor = color;
    marker.options.isCheckpoint = isCheckpoint;

    if (popupHtml) {
      marker.bindPopup(popupHtml);
    }

    marker.on('click', () => {
      if (pointData) {
        loadCheckpointHUD(pointData);
      }
      
      if (marker.options.isCheckpoint) {
        if (activeMarker && activeMarker !== marker) {
          updateMarkerIcon(activeMarker, activeMarker.options.originalColor);
        }
        activeMarker = marker;
        updateMarkerIcon(marker, '#facc15'); // Yellow
      }

      const targetZoom = 17;
      const targetPoint = map.project(marker.getLatLng(), targetZoom);
      const mapHeight = map.getSize().y;
      const offsetY = mapHeight * 0.10;
      const newCenterPoint = L.point(targetPoint.x, targetPoint.y + offsetY);
      const newCenterLatLng = map.unproject(newCenterPoint, targetZoom);

      map.flyTo(newCenterLatLng, targetZoom, { animate: true, duration: 1.0 });
    });

    return marker;
  }

  let puenteMarker = null;
  let startMarker = null;
  let polylines = [];
  let currentOrigin = null;

  function clearPolylines() {
    polylines.forEach(p => map.removeLayer(p));
    polylines = [];
  }

  // Always create and show Puente Romano marker at its FIXED coordinates!
  if (posFixedA) {
    puenteMarker = createCustomMarker(
      posFixedA.lat,
      posFixedA.lng,
      '🌉',
      '#2563eb',
      `<h4>${posFixedA.nombre || 'Puente Romano de Cangas de Onís'}</h4>`,
      posFixedA,
      true
    ).addTo(map);
  }

  // Intermediate markers (pto1..pto7)
  intermediatePuntos.forEach((point, idx) => {
    createCustomMarker(
      point.lat,
      point.lng,
      idx + 1,
      '#0ea5e9',
      `<h4>${point.titulo || point.nombre || ('Punto ' + (idx + 1))}</h4>`,
      point,
      true
    ).addTo(map);
  });

  // Destination marker
  if (destPunto) {
    createCustomMarker(
      destPunto.lat,
      destPunto.lng,
      '🏠',
      '#0ea5e9',
      `<h4>${destPunto.nombre || 'Casa de Aldea El Cantón'}</h4>`,
      destPunto,
      true
    ).addTo(map);
  }

  // Render configured zone polygons on map for visual reference
  let polygonLayers = [];
  function renderZonePolygons() {
    polygonLayers.forEach(l => map.removeLayer(l));
    polygonLayers = [];
    const config = getActiveZonesConfig();
    if (config.polygons) {
      config.polygons.forEach(p => {
        if (p.coords && p.coords.length >= 3) {
          const poly = L.polygon(p.coords, {
            color: '#a855f7',
            weight: 2,
            dashArray: '5, 5',
            fillColor: '#c084fc',
            fillOpacity: 0.2
          }).addTo(map);
          poly.bindTooltip(`Zona: ${p.nombre || 'Polígono'} ➔ Checkpoint: ${p.nextCheckpointKey || 'Auto'}`);
          polygonLayers.push(poly);
        }
      });
    }
  }
  renderZonePolygons();

  function drawStraightRoute(points) {
    clearPolylines();
    const routeCoords = points.map(p => [p.lat, p.lng]);
    const poly = L.polyline(routeCoords, {
      color: '#0ea5e9',
      weight: 5,
      opacity: 0.5,
      lineJoin: 'round'
    }).addTo(map);
    polylines.push(poly);
    map.fitBounds(poly.getBounds(), { padding: [40, 40] });
  }

  function drawRoute(originLat, originLng) {
    currentOrigin = { lat: originLat, lng: originLng };
    const effectiveIntermediates = getEffectiveIntermediatePuntos(originLat, originLng);
    const points = [{ lat: originLat, lng: originLng }, ...effectiveIntermediates, destPunto];
    const coordsString = points.map(p => `${p.lng},${p.lat}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson&alternatives=true`;

    fetch(osrmUrl)
      .then(response => response.json())
      .then(data => {
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          clearPolylines();

          const routeStyles = [
            { color: '#0ea5e9', weight: 5, opacity: 0.8, label: 'Principal (Azul)' },
            { color: '#eab308', weight: 5, opacity: 0.5, label: 'Alternativa 1 (Amarillo)' },
            { color: '#f97316', weight: 5, opacity: 0.5, label: 'Alternativa 2 (Naranja)' }
          ];

          const routesToDraw = data.routes.slice(0, 3);

          routesToDraw.forEach((route, idx) => {
            const durationMinutes = (route.duration / 60).toFixed(1);
            const distanceKm = (route.distance / 1000).toFixed(2);
            const style = routeStyles[idx] || { label: `Alternativa ${idx}` };

            console.log(`[Ruta en Coche - ${style.label}] Tiempo: ${durationMinutes} min (${Math.round(route.duration)} s) | Distancia: ${distanceKm} km (${Math.round(route.distance)} m)`);
          });

          // Draw in reverse order (alternatives first, main route last on top)
          for (let i = routesToDraw.length - 1; i >= 0; i--) {
            const route = routesToDraw[i];
            const style = routeStyles[i] || { color: '#888888', weight: 4, opacity: 0.4 };
            const routeCoords = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);

            const poly = L.polyline(routeCoords, {
              color: style.color,
              weight: style.weight,
              opacity: style.opacity,
              lineJoin: 'round'
            }).addTo(map);

            polylines.push(poly);
          }

          if (polylines.length > 0) {
            const mainPoly = polylines[polylines.length - 1];
            map.fitBounds(mainPoly.getBounds(), { padding: [40, 40] });
          }
        } else {
          drawStraightRoute(points);
        }
      })
      .catch(err => {
        console.warn('OSRM routing failed, falling back to straight lines:', err);
        drawStraightRoute(points);
      });
  }

  // Variables para la geolocalización y orientación en tiempo real
  let watchId = null;
  let currentHeading = 0; // en grados
  let followDeviceHeading = false; // false = Norte arriba, true = Rotar mapa/marcador con brújula
  let userAccuracyCircle = null;

  // Actualizador visual del marcador GPS y rotación
  function updateGPSPosition(lat, lng, heading = null, accuracy = null) {
    const latLng = [lat, lng];

    // Icono dinámico con aguja de brújula o marcador rotado
    const iconHtml = `<div class="marker-pin-wrapper gps-pulse-wrapper" style="background:#10b981;">
      <div class="marker-inner-content" style="transform: rotate(45deg);">📍</div>
    </div>`;

    if (!startMarker) {
      startMarker = L.marker(latLng, {
        icon: L.divIcon({
          className: 'custom-div-icon gps-location-marker',
          html: iconHtml,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -30]
        })
      }).addTo(map);
      startMarker.bindPopup('<h4>Origen: Tu ubicación actual</h4>');
    } else {
      startMarker.setLatLng(latLng);
    }

    // Dibujar o actualizar círculo de precisión de GPS
    if (accuracy) {
      if (!userAccuracyCircle) {
        userAccuracyCircle = L.circle(latLng, {
          radius: accuracy,
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.15,
          weight: 1
        }).addTo(map);
      } else {
        userAccuracyCircle.setLatLng(latLng);
        userAccuracyCircle.setRadius(accuracy);
      }
    }

    // Actualizar rotación si el modo de orientación móvil está activado
    if (heading !== null && followDeviceHeading) {
      currentHeading = heading;
      applyRotation(heading);
    }
  }

  // Aplicar rotación a los iconos y elemento contenedor del mapa cuando la orientación está activada
  function applyRotation(headingDeg) {
    const compassIcon = document.querySelector('.compass-icon');
    if (compassIcon) {
      compassIcon.style.transform = `rotate(${headingDeg}deg)`;
    }

    if (followDeviceHeading && mapElement) {
      mapElement.style.transform = `rotate(${-headingDeg}deg)`;
      mapElement.style.transition = 'transform 0.2s ease-out';
    } else if (mapElement) {
      mapElement.style.transform = 'rotate(0deg)';
      mapElement.style.transition = 'transform 0.3s ease';
    }
  }

  // Iniciar el monitoreo continuo de GPS
  function startGPSWatch() {
    if (!navigator.geolocation) return;

    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const uLat = position.coords.latitude;
        const uLng = position.coords.longitude;
        const heading = position.coords.heading; // rumbo reportado por GPS si se mueve
        const accuracy = position.coords.accuracy;

        updateGPSPosition(uLat, uLng, heading, accuracy);

        // Redibujar ruta si cambia significativamente la distancia del origen previo
        if (!currentOrigin || getDistanceMeters(currentOrigin.lat, currentOrigin.lng, uLat, uLng) > 20) {
          drawRoute(uLat, uLng);
        }
      },
      (error) => {
        console.warn('WatchPosition error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000
      }
    );
  }

  // Función auxiliar de distancia en metros
  function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Escuchar sensores de orientación del móvil (brújula digital del dispositivo)
  function initDeviceOrientation() {
    const handleOrientation = (event) => {
      let compassHeading = null;
      if (event.webkitCompassHeading) {
        // iOS
        compassHeading = event.webkitCompassHeading;
      } else if (event.alpha !== null) {
        // Android (alpha va de 0 a 360)
        compassHeading = (360 - event.alpha) % 360;
      }

      if (compassHeading !== null) {
        currentHeading = compassHeading;
        applyRotation(compassHeading);
      }
    };

    if (window.DeviceOrientationEvent) {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ requiere permiso
        DeviceOrientationEvent.requestPermission()
          .then(permissionState => {
            if (permissionState === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation, true);
            }
          })
          .catch(console.error);
      } else {
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    }
  }

  // Botón de orientación con la brújula
  const btnCompassHeading = document.getElementById('btnCompassHeading');
  const compassBtnText = document.getElementById('compassBtnText');

  if (btnCompassHeading) {
    btnCompassHeading.addEventListener('click', () => {
      followDeviceHeading = !followDeviceHeading;

      if (followDeviceHeading) {
        btnCompassHeading.classList.add('active-heading');
        if (compassBtnText) compassBtnText.textContent = 'Móvil';
        initDeviceOrientation();
        applyRotation(currentHeading);
      } else {
        btnCompassHeading.classList.remove('active-heading');
        if (compassBtnText) compassBtnText.textContent = 'Norte';
        applyRotation(0);
      }
    });
  }

  if (routeType === 'gps') {
    // Modo GPS activado: Iniciar seguimiento en tiempo real
    startGPSWatch();
  } else {
    // Fixed mode: start at Puente Romano
    drawRoute(posFixedA.lat, posFixedA.lng);
  }

  // Hook up Top Google Maps button
  const btnOpenGoogleMaps = document.getElementById('btnOpenGoogleMaps');
  if (btnOpenGoogleMaps) {
    btnOpenGoogleMaps.addEventListener('click', () => {
      let originLat = posFixedA.lat;
      let originLng = posFixedA.lng;

      if (routeType === 'gps') {
        if (currentOrigin) {
          originLat = currentOrigin.lat;
          originLng = currentOrigin.lng;
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

          updateGPSPosition(uLat, uLng, position.coords.heading, position.coords.accuracy);
          map.flyTo([uLat, uLng], 16, { animate: true, duration: 1.5 });

          // Asegurar que watchPosition está activo
          startGPSWatch();

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
