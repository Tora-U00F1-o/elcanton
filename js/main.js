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

// Helper to get structured ordered checkpoints list
function getCheckpointList() {
  const puntos = CONFIG.puntos;
  const list = [];
  
  if (puntos.inicioFijo) {
    list.push({
      key: 'inicioFijo',
      label: 1,
      titulo: puntos.inicioFijo.nombre || "Puente Romano de Cangas de Onís",
      indicacion: "Punto de inicio de la ruta.",
      fotoUrl: puntos.inicioFijo.fotoUrl || '',
      lat: puntos.inicioFijo.lat,
      lng: puntos.inicioFijo.lng
    });
  }

  const intermediate = getIntermediatePuntos();
  intermediate.forEach((p, idx) => {
    list.push({
      key: p.key,
      label: list.length + 1,
      titulo: p.titulo || p.nombre || (`Punto ${idx + 1}`),
      indicacion: p.indicacion || p.descripcion || '',
      fotoUrl: p.fotoUrl || p.imagen || '',
      lat: p.lat,
      lng: p.lng
    });
  });

  if (puntos.destinoFinal) {
    list.push({
      key: 'destinoFinal',
      label: list.length + 1,
      titulo: puntos.destinoFinal.titulo || puntos.destinoFinal.nombre || "Casa de Aldea El Cantón",
      indicacion: puntos.destinoFinal.indicacion || "¡Has llegado a tu destino!",
      fotoUrl: puntos.destinoFinal.fotoUrl || '',
      lat: puntos.destinoFinal.lat,
      lng: puntos.destinoFinal.lng
    });
  }

  return list;
}

// Map Page Controller
let map = null;
let tileLayer = null;
let satelliteLayer = null;
let isSatelliteMode = false;
let userLocMarker = null;

function initMap() {
  const mapElement = document.getElementById('map');
  if (!mapElement) return; // Exit if not on map page

  const posFixedA = CONFIG.puntos.inicioFijo;
  const destPunto = CONFIG.puntos.destinoFinal;
  const orderedCheckpoints = getCheckpointList();

  // Read URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const routeType = urlParams.get('route');

  // Initialize Leaflet map centered midway
  map = L.map('map', { zoomControl: false }).setView([43.333, -5.134], 13);

  // Setup Tile layers dynamically
  setupMapLayers();

  // State variables for checkpoints
  let activeImmediateIndex = 0; // Index of current next checkpoint according to GPS / zone
  let selectedPreviewIndex = 0; // Index of user selected/previewed checkpoint
  let currentOrigin = null;

  // DOM Elements
  const topStepperContainer = document.getElementById('topStepperContainer');
  const stepperTrack = document.getElementById('stepperTrack');
  const topStepperDragHandle = document.getElementById('topStepperDragHandle');
  const stepperListItems = document.getElementById('stepperListItems');
  
  const bottomCard = document.getElementById('checkpointHUD');
  const bottomCardDragHandle = document.getElementById('bottomCardDragHandle');
  const hudImgContainer = document.getElementById('hudImgContainer');
  const hudImg = document.getElementById('hudImg');
  const hudTitle = document.getElementById('hudTitle');
  const hudDistanceText = document.getElementById('hudDistanceText');
  const hudMinDistanceText = document.getElementById('hudMinDistanceText');
  const btnPrevCheckpoint = document.getElementById('btnPrevCheckpoint');
  const btnNextCheckpoint = document.getElementById('btnNextCheckpoint');
  const btnOpenGoogleMaps = document.getElementById('btnOpenGoogleMaps');

  // Map Controls
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const btnToggleLayer = document.getElementById('btnToggleLayer');
  const btnCompassHeading = document.getElementById('btnCompassHeading');
  const btnRecenterGPS = document.getElementById('btnRecenterGPS');

  // Zoom control handlers
  if (btnZoomIn) btnZoomIn.addEventListener('click', () => map.zoomIn());
  if (btnZoomOut) btnZoomOut.addEventListener('click', () => map.zoomOut());

  // Toggle Satellite Layer handler
  if (btnToggleLayer) {
    btnToggleLayer.addEventListener('click', () => {
      toggleMapLayer();
    });
  }

  // Toggle Stepper Drawer expand/collapse
  if (topStepperDragHandle && topStepperContainer) {
    topStepperDragHandle.addEventListener('click', () => {
      topStepperContainer.classList.toggle('is-expanded');
    });
  }

  // Toggle Bottom Card minimize/expand
  if (bottomCardDragHandle && bottomCard) {
    bottomCardDragHandle.addEventListener('click', () => {
      bottomCard.classList.toggle('is-minimized');
    });
  }

  // Leaflet Checkpoint Markers map
  const checkpointMarkers = [];

  function createCustomMarker(lat, lng, label, index) {
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="marker-pin-wrapper future-marker"><div class="marker-inner-content">${label}</div></div>`,
        iconSize: [36, 42],
        iconAnchor: [18, 42],
        popupAnchor: [0, -38]
      })
    });

    marker.options.cpIndex = index;

    marker.on('click', () => {
      selectCheckpoint(index, true);
    });

    return marker;
  }

  // Build markers on map
  orderedCheckpoints.forEach((cp, idx) => {
    const marker = createCustomMarker(cp.lat, cp.lng, cp.label, idx).addTo(map);
    checkpointMarkers.push(marker);
  });

  // Render Zone Polygons for reference
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
            fillOpacity: 0.15
          }).addTo(map);
          poly.bindTooltip(`Zona: ${p.nombre || 'Polígono'}`);
          polygonLayers.push(poly);
        }
      });
    }
  }
  renderZonePolygons();

  // Helper to format distance in meters/km
  function formatDistance(meters) {
    if (meters === null || meters === undefined || isNaN(meters)) return '-- m';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }

  // Update UI and Map Markers State
  function updateCheckpointsUI() {
    // 1. Update Map Markers Visual Classes
    checkpointMarkers.forEach((m, idx) => {
      const el = m.getElement();
      if (!el) return;
      const pinWrapper = el.querySelector('.marker-pin-wrapper');
      if (!pinWrapper) return;

      // Reset classes
      pinWrapper.className = 'marker-pin-wrapper';

      if (idx < activeImmediateIndex) {
        // Passed checkpoint
        pinWrapper.classList.add('passed-marker');
      } else if (idx === activeImmediateIndex) {
        // Current immediate next checkpoint
        pinWrapper.classList.add('current-marker');
      } else {
        // Future checkpoint
        pinWrapper.classList.add('future-marker');
      }

      // Check if this marker is being previewed (when user jumps to a non-immediate checkpoint)
      if (idx === selectedPreviewIndex && selectedPreviewIndex !== activeImmediateIndex) {
        pinWrapper.classList.add('preview-marker');
      }
    });

    // 2. Update Top Stepper Track (Bubbles 1 - 2 - 3 ...)
    if (stepperTrack) {
      stepperTrack.innerHTML = '';
      orderedCheckpoints.forEach((cp, idx) => {
        const itemBox = document.createElement('div');
        itemBox.className = 'step-bubble-item';

        const bubble = document.createElement('div');
        let bubbleClass = 'step-bubble ';

        if (idx < activeImmediateIndex) {
          bubbleClass += 'passed';
        } else if (idx === activeImmediateIndex) {
          bubbleClass += 'current';
        } else {
          bubbleClass += 'future';
        }

        if (idx === selectedPreviewIndex && selectedPreviewIndex !== activeImmediateIndex) {
          bubbleClass += ' preview-selected';
        }

        bubble.className = bubbleClass;
        bubble.textContent = cp.label;

        // Add Material Design eye icon if this bubble is previewed
        if (idx === selectedPreviewIndex && selectedPreviewIndex !== activeImmediateIndex) {
          const eyeBadge = document.createElement('span');
          eyeBadge.className = 'bubble-eye-badge';
          eyeBadge.setAttribute('title', 'Previsualizando');
          eyeBadge.innerHTML = `<svg viewBox="0 0 24 24" class="material-eye-icon"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
          bubble.appendChild(eyeBadge);
        }

        itemBox.appendChild(bubble);

        itemBox.addEventListener('click', () => {
          selectCheckpoint(idx, true);
        });

        stepperTrack.appendChild(itemBox);

        // Add connecting line if not last item
        if (idx < orderedCheckpoints.length - 1) {
          const line = document.createElement('div');
          line.className = `stepper-line ${idx < activeImmediateIndex ? 'completed' : ''}`;
          stepperTrack.appendChild(line);
        }
      });
    }

    // 3. Update Expanded Drawer List
    if (stepperListItems) {
      stepperListItems.innerHTML = '';
      orderedCheckpoints.forEach((cp, idx) => {
        const drawerItem = document.createElement('div');
        drawerItem.className = `drawer-checkpoint-item ${idx === selectedPreviewIndex ? 'active-selected' : ''}`;

        let statusClass = idx < activeImmediateIndex ? 'passed' : (idx === activeImmediateIndex ? 'current' : 'future');
        let distStr = '-- m';
        if (currentOrigin) {
          const d = getDistanceMeters(currentOrigin.lat, currentOrigin.lng, cp.lat, cp.lng);
          distStr = formatDistance(d);
        }

        drawerItem.innerHTML = `
          <div class="drawer-item-badge ${statusClass}">
            ${idx < activeImmediateIndex ? '✓' : cp.label}
          </div>
          <div class="drawer-item-content">
            <div class="drawer-item-title">${cp.titulo}</div>
            <div class="drawer-item-desc">${cp.indicacion}</div>
          </div>
          ${cp.fotoUrl ? `<img src="${cp.fotoUrl}" class="drawer-item-thumb" alt="${cp.titulo}">` : ''}
          <div class="drawer-item-distance">${distStr}</div>
        `;

        drawerItem.addEventListener('click', () => {
          selectCheckpoint(idx, true);
        });

        stepperListItems.appendChild(drawerItem);
      });
    }

    // 4. Update Bottom Card HUD
    const activeCP = orderedCheckpoints[selectedPreviewIndex];
    if (activeCP) {
      if (hudImgContainer && hudImg) {
        if (activeCP.fotoUrl) {
          hudImg.src = activeCP.fotoUrl;
          hudImgContainer.style.display = 'block';
        } else {
          hudImgContainer.style.display = 'none';
        }
      }

      if (hudTitle) hudTitle.textContent = activeCP.titulo;
      if (hudDesc) hudDesc.textContent = activeCP.indicacion;

      let formattedDist = '-- m';
      if (currentOrigin) {
        const dist = getDistanceMeters(currentOrigin.lat, currentOrigin.lng, activeCP.lat, activeCP.lng);
        formattedDist = formatDistance(dist);
      }
      if (hudDistanceText) hudDistanceText.textContent = formattedDist;
      if (hudMinDistanceText) hudMinDistanceText.textContent = formattedDist;
    }
  }

  // Select/Jump to a checkpoint
  function selectCheckpoint(index, flyToMarker = true) {
    if (index < 0 || index >= orderedCheckpoints.length) return;
    selectedPreviewIndex = index;

    updateCheckpointsUI();

    if (flyToMarker && map) {
      const targetCP = orderedCheckpoints[index];
      const targetZoom = 17;
      const targetPoint = map.project([targetCP.lat, targetCP.lng], targetZoom);
      const mapHeight = map.getSize().y;
      const offsetY = mapHeight * 0.12;
      const newCenterPoint = L.point(targetPoint.x, targetPoint.y + offsetY);
      const newCenterLatLng = map.unproject(newCenterPoint, targetZoom);

      map.flyTo(newCenterLatLng, targetZoom, { animate: true, duration: 1.0 });
    }
  }

  // Navigation Arrows on Bottom Card
  if (btnPrevCheckpoint) {
    btnPrevCheckpoint.addEventListener('click', (e) => {
      e.stopPropagation();
      if (selectedPreviewIndex > 0) {
        selectCheckpoint(selectedPreviewIndex - 1, true);
      }
    });
  }

  if (btnNextCheckpoint) {
    btnNextCheckpoint.addEventListener('click', (e) => {
      e.stopPropagation();
      if (selectedPreviewIndex < orderedCheckpoints.length - 1) {
        selectCheckpoint(selectedPreviewIndex + 1, true);
      }
    });
  }

  // Polylines drawing
  let polylines = [];
  function clearPolylines() {
    polylines.forEach(p => map.removeLayer(p));
    polylines = [];
  }

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

    // Update activeImmediateIndex based on GPS location & zones
    const targetKey = getNextCheckpointKeyForLocation(originLat, originLng);
    if (targetKey) {
      const foundIdx = orderedCheckpoints.findIndex(c => c.key === targetKey || c.titulo === targetKey);
      if (foundIdx !== -1) {
        activeImmediateIndex = foundIdx;
        // If user hasn't explicitly previewed another checkpoint, sync preview to active
        if (selectedPreviewIndex < activeImmediateIndex) {
          selectedPreviewIndex = activeImmediateIndex;
        }
      }
    }

    updateCheckpointsUI();

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
            { color: '#0ea5e9', weight: 5, opacity: 0.8, label: 'Principal' },
            { color: '#eab308', weight: 5, opacity: 0.5, label: 'Alternativa 1' },
            { color: '#f97316', weight: 5, opacity: 0.5, label: 'Alternativa 2' }
          ];

          const routesToDraw = data.routes.slice(0, 3);
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
            map.fitBounds(mainPoly.getBounds(), { padding: [60, 60] });
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

  // Real-time GPS Watching & Device Heading
  let watchId = null;
  let currentHeading = 0;
  let followDeviceHeading = false;
  let startMarker = null;
  let userAccuracyCircle = null;

  function updateHeadingCone(headingDeg) {
    const cone = document.getElementById('userHeadingCone');
    if (cone) {
      if (headingDeg !== null && headingDeg !== undefined && !isNaN(headingDeg)) {
        cone.style.display = 'block';
        cone.style.transform = `rotate(${headingDeg}deg)`;
      }
    }
  }

  function updateGPSPosition(lat, lng, heading = null, accuracy = null) {
    const latLng = [lat, lng];
    const activeHeading = (heading !== null && heading !== undefined) ? heading : currentHeading;

    const iconHtml = `
      <div class="google-user-location-container">
        <div class="user-heading-cone" id="userHeadingCone" style="${activeHeading !== null && activeHeading !== undefined ? `display: block; transform: rotate(${activeHeading}deg);` : ''}">
          <svg viewBox="0 0 100 100" class="heading-cone-svg">
            <defs>
              <radialGradient id="coneGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stop-color="#4285F4" stop-opacity="0.45"/>
                <stop offset="60%" stop-color="#4285F4" stop-opacity="0.2"/>
                <stop offset="100%" stop-color="#4285F4" stop-opacity="0"/>
              </radialGradient>
            </defs>
            <path d="M 50 50 L 25 6.7 A 50 50 0 0 1 75 6.7 Z" fill="url(#coneGradient)"/>
          </svg>
        </div>
        <div class="user-accuracy-pulse"></div>
        <div class="user-blue-dot"></div>
      </div>`;

    if (!startMarker) {
      startMarker = L.marker(latLng, {
        icon: L.divIcon({
          className: 'google-user-location-marker',
          html: iconHtml,
          iconSize: [80, 80],
          iconAnchor: [40, 40],
          popupAnchor: [0, -20]
        }),
        zIndexOffset: 1000
      }).addTo(map);
      startMarker.bindPopup('<h4>Origen: Tu ubicación actual</h4>');
    } else {
      startMarker.setLatLng(latLng);
    }

    if (accuracy) {
      if (!userAccuracyCircle) {
        userAccuracyCircle = L.circle(latLng, {
          radius: accuracy,
          color: '#4285F4',
          fillColor: '#4285F4',
          fillOpacity: 0.12,
          weight: 1
        }).addTo(map);
      } else {
        userAccuracyCircle.setLatLng(latLng);
        userAccuracyCircle.setRadius(accuracy);
      }
    }

    if (heading !== null && heading !== undefined) {
      currentHeading = heading;
      applyRotation(heading);
    }
  }

  function applyRotation(headingDeg) {
    const compassIcon = document.querySelector('.compass-icon');
    if (compassIcon) {
      compassIcon.style.transform = `rotate(${headingDeg}deg)`;
    }

    updateHeadingCone(headingDeg);

    if (followDeviceHeading && mapElement) {
      mapElement.style.transform = `rotate(${-headingDeg}deg)`;
      mapElement.style.transition = 'transform 0.2s ease-out';
    } else if (mapElement) {
      mapElement.style.transform = 'rotate(0deg)';
      mapElement.style.transition = 'transform 0.3s ease';
    }
  }

  function startGPSWatch() {
    if (!navigator.geolocation) return;

    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }

    initDeviceOrientation();

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const uLat = position.coords.latitude;
        const uLng = position.coords.longitude;
        const heading = position.coords.heading;
        const accuracy = position.coords.accuracy;

        updateGPSPosition(uLat, uLng, heading, accuracy);

        if (!currentOrigin || getDistanceMeters(currentOrigin.lat, currentOrigin.lng, uLat, uLng) > 15) {
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

  function initDeviceOrientation() {
    const handleOrientation = (event) => {
      let compassHeading = null;
      if (event.webkitCompassHeading) {
        compassHeading = event.webkitCompassHeading;
      } else if (event.alpha !== null && event.alpha !== undefined) {
        compassHeading = (360 - event.alpha) % 360;
      }

      if (compassHeading !== null && !isNaN(compassHeading)) {
        currentHeading = compassHeading;
        applyRotation(compassHeading);
      }
    };

    if (window.DeviceOrientationEvent) {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
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

  if (btnCompassHeading) {
    btnCompassHeading.addEventListener('click', () => {
      followDeviceHeading = !followDeviceHeading;

      if (followDeviceHeading) {
        btnCompassHeading.classList.add('active-heading');
        initDeviceOrientation();
        applyRotation(currentHeading);
      } else {
        btnCompassHeading.classList.remove('active-heading');
        applyRotation(0);
      }
    });
  }

  if (routeType === 'gps') {
    startGPSWatch();
  } else {
    drawRoute(posFixedA.lat, posFixedA.lng);
  }

  if (btnOpenGoogleMaps) {
    btnOpenGoogleMaps.addEventListener('click', () => {
      let originLat = posFixedA.lat;
      let originLng = posFixedA.lng;

      if (routeType === 'gps' && currentOrigin) {
        originLat = currentOrigin.lat;
        originLng = currentOrigin.lng;
      }

      const mapsUrl = getGoogleMapsUrl(originLat, originLng);
      window.open(mapsUrl, '_blank');
    });
  }

  // Tip banner handling
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

  if (btnRecenterGPS) {
    btnRecenterGPS.addEventListener('click', () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const uLat = position.coords.latitude;
          const uLng = position.coords.longitude;

          updateGPSPosition(uLat, uLng, position.coords.heading, position.coords.accuracy);
          map.flyTo([uLat, uLng], 16, { animate: true, duration: 1.5 });
          startGPSWatch();
        },
        (error) => {
          console.error('Error tracking user location:', error);
          alert('No pudimos acceder a tu ubicación actual de GPS. Verifica los permisos de localización de tu navegador.');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  // Initial UI Render
  updateCheckpointsUI();
}

// Setup Leaflet Tile Layers & Satellite Switching
function setupMapLayers() {
  if (!map) return;

  const isDark = document.body.classList.contains('dark-mode');
  const vectorUrl = isDark 
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    
  const vectorAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

  tileLayer = L.tileLayer(vectorUrl, {
    attribution: vectorAttribution,
    maxZoom: 19
  });

  const satUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const satAttribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

  satelliteLayer = L.tileLayer(satUrl, {
    attribution: satAttribution,
    maxZoom: 19
  });

  if (isSatelliteMode) {
    satelliteLayer.addTo(map);
  } else {
    tileLayer.addTo(map);
  }
}

// Toggle between Vector and Satellite tile layers
function toggleMapLayer() {
  if (!map) return;
  isSatelliteMode = !isSatelliteMode;

  if (isSatelliteMode) {
    if (tileLayer && map.hasLayer(tileLayer)) map.removeLayer(tileLayer);
    if (satelliteLayer) satelliteLayer.addTo(map);
  } else {
    if (satelliteLayer && map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
    if (tileLayer) tileLayer.addTo(map);
  }

  const btnToggleLayer = document.getElementById('btnToggleLayer');
  if (btnToggleLayer) {
    if (isSatelliteMode) {
      btnToggleLayer.classList.add('active-heading');
    } else {
      btnToggleLayer.classList.remove('active-heading');
    }
  }
}

// Update Leaflet tile layer depending on layout theme
function updateMapTiles() {
  if (!map) return;
  if (!isSatelliteMode) {
    setupMapLayers();
  }
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

