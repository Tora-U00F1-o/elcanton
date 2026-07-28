document.addEventListener('DOMContentLoaded', () => {
  const mapElement = document.getElementById('adminMap');
  if (!mapElement) return;

  // Global state
  let polygons = [];
  let isDrawing = false;
  let currentVertices = [];
  let tempPolyline = null;
  let tempVertexMarkers = [];
  let polygonMapLayers = {};
  let editingPolyId = null;
  let editVertexMarkers = [];
  let testMarker = null;
  let lastTestedCoords = null;
  let testRoutePolylines = [];

  // Initialize Leaflet map
  const map = L.map('adminMap').setView([43.3168, -5.1293], 16);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  // Load available checkpoint options from CONFIG.puntos
  function getAvailableCheckpointKeys() {
    const keys = [];
    if (CONFIG && CONFIG.puntos) {
      Object.keys(CONFIG.puntos).forEach(k => {
        if (k !== 'inicioFijo') {
          keys.push({
            key: k,
            label: CONFIG.puntos[k].titulo || CONFIG.puntos[k].nombre || k
          });
        }
      });
    }
    return keys;
  }

  // Draw checkpoint markers for admin reference
  function drawCheckpointMarkers() {
    if (!CONFIG || !CONFIG.puntos) return;
    Object.keys(CONFIG.puntos).forEach(key => {
      const p = CONFIG.puntos[key];
      const isStart = key === 'inicioFijo';
      const isDest = key === 'destinoFinal';
      const color = isStart ? '#2563eb' : (isDest ? '#10b981' : '#0ea5e9');
      const iconText = isStart ? '🌉' : (isDest ? '🏠' : '📍');

      const marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div class="marker-pin-wrapper" style="background:${color};"><div class="marker-inner-content">${iconText}</div></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32]
        })
      }).addTo(map);

      marker.bindPopup(`<b>${p.titulo || p.nombre || key}</b><br><small>Clave: ${key}</small>`);
    });
  }
  drawCheckpointMarkers();

  // Load initial polygon configuration (from localStorage or file)
  function loadInitialPolygons() {
    const activeConfig = getActiveZonesConfig();
    if (activeConfig && activeConfig.polygons) {
      polygons = JSON.parse(JSON.stringify(activeConfig.polygons));
    } else {
      polygons = [];
    }
    renderAllPolygonsOnMap();
    renderPolygonList();
  }

  // Clear test route lines on admin map
  function clearTestRoute() {
    testRoutePolylines.forEach(p => map.removeLayer(p));
    testRoutePolylines = [];
  }

  // Render polygons on map
  function renderAllPolygonsOnMap() {
    Object.values(polygonMapLayers).forEach(layer => map.removeLayer(layer));
    polygonMapLayers = {};

    polygons.forEach(p => {
      if (p.coords && p.coords.length >= 3) {
        const isEditingThis = editingPolyId === p.id;
        const polyLayer = L.polygon(p.coords, {
          color: isEditingThis ? '#f59e0b' : '#a855f7',
          weight: isEditingThis ? 4 : 3,
          fillColor: isEditingThis ? '#fbbf24' : '#c084fc',
          fillOpacity: isEditingThis ? 0.45 : 0.3
        }).addTo(map);

        const cpInfo = CONFIG.puntos[p.nextCheckpointKey];
        const cpName = cpInfo ? (cpInfo.titulo || cpInfo.nombre || p.nextCheckpointKey) : p.nextCheckpointKey;
        polyLayer.bindTooltip(`Zona: <strong>${p.nombre}</strong><br>➔ Checkpoint: <strong>${p.nextCheckpointKey} (${cpName})</strong>`);
        
        polygonMapLayers[p.id] = polyLayer;
      }
    });
  }

  // Render polygon vertex handles for editing mode
  function renderEditVertexMarkers(poly) {
    editVertexMarkers.forEach(m => map.removeLayer(m));
    editVertexMarkers = [];

    if (!poly || !poly.coords) return;

    poly.coords.forEach((coord, idx) => {
      const marker = L.marker(coord, {
        draggable: true,
        icon: L.divIcon({
          className: 'custom-vertex-handle',
          html: `<div style="background:#f59e0b; color:white; width:20px; height:20px; border-radius:50%; border:2px solid white; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold; cursor:pointer;" title="Arrastrar para mover, clic para eliminar punto">${idx + 1}</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(map);

      // Drag event
      marker.on('drag', (e) => {
        const newPos = e.target.getLatLng();
        poly.coords[idx] = [Number(newPos.lat.toFixed(6)), Number(newPos.lng.toFixed(6))];
        renderAllPolygonsOnMap();
      });

      // Click to remove vertex
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (poly.coords.length <= 3) {
          alert('Un polígono debe tener al menos 3 vértices.');
          return;
        }
        poly.coords.splice(idx, 1);
        renderAllPolygonsOnMap();
        renderEditVertexMarkers(poly);
        renderPolygonList();
      });

      editVertexMarkers.push(marker);
    });
  }

  // Render sidebar polygon list
  function renderPolygonList() {
    const container = document.getElementById('polygonListContainer');
    const badge = document.getElementById('polyTotalBadge');
    if (!container) return;

    if (badge) badge.textContent = `${polygons.length} zona(s)`;
    container.innerHTML = '';

    if (polygons.length === 0) {
      container.innerHTML = `
        <p style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; padding: 1rem 0;">
          No hay polígonos creados aún. Haz clic en "Dibujar Nuevo Polígono" para empezar.
        </p>
      `;
      return;
    }

    const checkpointOpts = getAvailableCheckpointKeys();

    polygons.forEach((poly, index) => {
      const item = document.createElement('div');
      item.className = 'polygon-item';
      const isEditingThis = editingPolyId === poly.id;
      
      const selectHtml = checkpointOpts.map(opt => `
        <option value="${opt.key}" ${poly.nextCheckpointKey === opt.key ? 'selected' : ''}>
          ${opt.key} (${opt.label})
        </option>
      `).join('');

      item.innerHTML = `
        <div class="polygon-item-header">
          <input type="text" class="admin-input poly-name-input" value="${poly.nombre || ('Zona ' + (index + 1))}" style="font-weight: 600; flex: 1;">
          <button class="btn-admin-action btn-admin-danger btn-delete-poly" title="Eliminar zona">🗑️</button>
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--text-secondary);">Checkpoint Siguiente Asignado:</label>
          <select class="admin-select poly-cp-select" style="margin-top: 0.2rem;">
            ${selectHtml}
          </select>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center; margin-top: 0.2rem;">
          <span>Vértices: ${poly.coords ? poly.coords.length : 0}</span>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn-admin-action btn-admin-outline btn-edit-vertices" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; ${isEditingThis ? 'background:#f59e0b; color:white; border-color:#f59e0b;' : ''}">
              ${isEditingThis ? '✏️ Editando...' : '✏️ Editar Puntos'}
            </button>
            <button class="btn-admin-action btn-admin-outline btn-focus-poly" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">
              🔍 Enfocar
            </button>
          </div>
        </div>
      `;

      // Listeners
      const nameInput = item.querySelector('.poly-name-input');
      nameInput.addEventListener('change', (e) => {
        poly.nombre = e.target.value;
        renderAllPolygonsOnMap();
      });

      const cpSelect = item.querySelector('.poly-cp-select');
      cpSelect.addEventListener('change', (e) => {
        poly.nextCheckpointKey = e.target.value;
        renderAllPolygonsOnMap();
      });

      const btnDelete = item.querySelector('.btn-delete-poly');
      btnDelete.addEventListener('click', () => {
        if (confirm(`¿Eliminar la zona "${poly.nombre}"?`)) {
          if (editingPolyId === poly.id) {
            editingPolyId = null;
            editVertexMarkers.forEach(m => map.removeLayer(m));
            editVertexMarkers = [];
          }
          polygons = polygons.filter(p => p.id !== poly.id);
          renderAllPolygonsOnMap();
          renderPolygonList();
        }
      });

      const btnEditVerts = item.querySelector('.btn-edit-vertices');
      btnEditVerts.addEventListener('click', () => {
        if (editingPolyId === poly.id) {
          editingPolyId = null;
          editVertexMarkers.forEach(m => map.removeLayer(m));
          editVertexMarkers = [];
        } else {
          editingPolyId = poly.id;
          renderEditVertexMarkers(poly);
          const layer = polygonMapLayers[poly.id];
          if (layer) map.fitBounds(layer.getBounds(), { padding: [50, 50] });
        }
        renderAllPolygonsOnMap();
        renderPolygonList();
      });

      const btnFocus = item.querySelector('.btn-focus-poly');
      btnFocus.addEventListener('click', (e) => {
        e.preventDefault();
        const layer = polygonMapLayers[poly.id];
        if (layer) {
          map.fitBounds(layer.getBounds(), { padding: [50, 50] });
        }
      });

      container.appendChild(item);
    });
  }

  // Drawing Controls Logic
  const btnStartDraw = document.getElementById('btnStartDraw');
  const btnFinishDraw = document.getElementById('btnFinishDraw');
  const btnCancelDraw = document.getElementById('btnCancelDraw');
  const vertexCountSpan = document.getElementById('vertexCount');

  function startDrawing() {
    isDrawing = true;
    currentVertices = [];
    editingPolyId = null;
    editVertexMarkers.forEach(m => map.removeLayer(m));
    editVertexMarkers = [];

    btnStartDraw.style.display = 'none';
    btnFinishDraw.style.display = 'inline-flex';
    btnCancelDraw.style.display = 'inline-flex';
    vertexCountSpan.textContent = '0';
    map.getContainer().style.cursor = 'crosshair';
  }

  function clearDrawingState() {
    isDrawing = false;
    currentVertices = [];
    if (tempPolyline) {
      map.removeLayer(tempPolyline);
      tempPolyline = null;
    }
    tempVertexMarkers.forEach(m => map.removeLayer(m));
    tempVertexMarkers = [];

    btnStartDraw.style.display = 'inline-flex';
    btnFinishDraw.style.display = 'none';
    btnCancelDraw.style.display = 'none';
    map.getContainer().style.cursor = '';
  }

  function updateTemporaryDrawingLayers() {
    // Clear existing vertex markers on map
    tempVertexMarkers.forEach(m => map.removeLayer(m));
    tempVertexMarkers = [];

    vertexCountSpan.textContent = currentVertices.length;

    currentVertices.forEach((coord, idx) => {
      const isFirst = idx === 0;
      const canClose = isFirst && currentVertices.length >= 3;

      let marker;
      if (canClose) {
        marker = L.marker(coord, {
          icon: L.divIcon({
            className: 'closing-vertex-icon',
            html: `<div class="closing-vertex-node"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
          })
        }).addTo(map);
        marker.bindTooltip('<b>¡Haz clic aquí para CERRAR el polígono!</b>', { permanent: true, direction: 'top', offset: [0, -12] });
      } else {
        marker = L.marker(coord, {
          icon: L.divIcon({
            className: 'drawing-vertex-icon',
            html: `<div style="width:12px; height:12px; background:#a855f7; border:2px solid #ffffff; border-radius:50%; box-shadow:0 2px 5px rgba(0,0,0,0.3); cursor:pointer;"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          })
        }).addTo(map);
        marker.bindTooltip(`Punto ${idx + 1} (Clic para eliminar)`, { direction: 'top' });
      }

      // CLICK ON EXISTING VERTEX MARKER HANDLING
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);

        if (isFirst && currentVertices.length >= 3) {
          // Cleanly close polygon!
          finishDrawingPolygon();
        } else {
          // Remove vertex!
          currentVertices.splice(idx, 1);
          updateTemporaryDrawingLayers();
        }
      });

      tempVertexMarkers.push(marker);
    });

    // Update temporary polyline
    if (tempPolyline) {
      tempPolyline.setLatLngs(currentVertices);
    } else if (currentVertices.length > 0) {
      tempPolyline = L.polyline(currentVertices, {
        color: '#a855f7',
        weight: 2,
        dashArray: '4, 4'
      }).addTo(map);
    }
  }

  function finishDrawingPolygon() {
    if (currentVertices.length < 3) {
      alert('Debes marcar al menos 3 puntos en el mapa para formar un polígono.');
      return;
    }

    const defaultCp = getAvailableCheckpointKeys()[0]?.key || 'pto1';
    const newPoly = {
      id: 'zona-' + Date.now(),
      nombre: `Zona ${polygons.length + 1}`,
      nextCheckpointKey: defaultCp,
      coords: [...currentVertices]
    };

    polygons.push(newPoly);
    clearDrawingState();
    renderAllPolygonsOnMap();
    renderPolygonList();
  }

  btnStartDraw.addEventListener('click', startDrawing);
  btnCancelDraw.addEventListener('click', clearDrawingState);
  btnFinishDraw.addEventListener('click', finishDrawingPolygon);

  // Map Click Listener
  map.on('click', (e) => {
    const lat = Number(e.latlng.lat.toFixed(6));
    const lng = Number(e.latlng.lng.toFixed(6));

    if (isDrawing) {
      currentVertices.push([lat, lng]);
      updateTemporaryDrawingLayers();
    } else {
      // Coordinate Test Mode
      lastTestedCoords = [lat, lng];
      clearTestRoute();

      if (testMarker) map.removeLayer(testMarker);

      testMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div class="marker-pin-wrapper" style="background:#f59e0b;"><div class="marker-inner-content">❓</div></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32]
        })
      }).addTo(map);

      // Check if location falls inside any polygon
      let matchedPoly = null;
      for (const poly of polygons) {
        if (poly.coords && isPointInPolygon(lat, lng, poly.coords)) {
          matchedPoly = poly;
          break;
        }
      }

      const resultBox = document.getElementById('testResultBox');
      const actionBtns = document.getElementById('testActionButtons');

      if (matchedPoly) {
        const cpInfo = CONFIG.puntos[matchedPoly.nextCheckpointKey];
        const cpName = cpInfo ? (cpInfo.titulo || cpInfo.nombre || matchedPoly.nextCheckpointKey) : matchedPoly.nextCheckpointKey;
        resultBox.innerHTML = `
          <strong style="color:#10b981;">📍 Dentro de "${matchedPoly.nombre}"</strong><br>
          Siguiente checkpoint: <strong>${matchedPoly.nextCheckpointKey} (${cpName})</strong><br>
          <small style="color:var(--text-secondary);">Lat: ${lat}, Lng: ${lng}</small>
        `;
      } else {
        resultBox.innerHTML = `
          <strong style="color:#ef4444;">📍 Fuera de zonas configuradas</strong><br>
          Siguiente checkpoint: <strong>Inicial por defecto (${CONFIG.puntos.pto1?.titulo || 'Pto1'})</strong><br>
          <small style="color:var(--text-secondary);">Lat: ${lat}, Lng: ${lng}</small>
        `;
      }

      if (actionBtns) actionBtns.style.display = 'flex';
    }
  });

  // Action Buttons in Test Section: Show Route in Leaflet & Open in Google Maps
  const btnTestShowLeaflet = document.getElementById('btnTestShowLeaflet');
  const btnTestOpenGoogleMaps = document.getElementById('btnTestOpenGoogleMaps');

  if (btnTestShowLeaflet) {
    btnTestShowLeaflet.addEventListener('click', () => {
      if (!lastTestedCoords) {
        alert('Por favor haz clic primero sobre un punto del mapa para simular la ubicación GPS.');
        return;
      }

      const originLat = lastTestedCoords[0];
      const originLng = lastTestedCoords[1];
      clearTestRoute();

      // Temporarily override localStorage ZONES_CONFIG with current unsaved polygons so simulation is live!
      localStorage.setItem('ZONES_CONFIG', JSON.stringify({ polygons }));

      const effectiveIntermediates = getEffectiveIntermediatePuntos(originLat, originLng);
      const destPunto = CONFIG.puntos.destinoFinal;
      const points = [{ lat: originLat, lng: originLng }, ...effectiveIntermediates, destPunto];

      const coordsString = points.map(p => `${p.lng},${p.lat}`).join(';');
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;

      btnTestShowLeaflet.innerHTML = '⌛ Calculando...';

      fetch(osrmUrl)
        .then(res => res.json())
        .then(data => {
          btnTestShowLeaflet.innerHTML = '🗺️ Mostrar ruta en Leaflet';

          if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const routeCoords = route.geometry.coordinates.map(c => [c[1], c[0]]);

            const polyline = L.polyline(routeCoords, {
              color: '#2563eb',
              weight: 6,
              opacity: 0.85
            }).addTo(map);

            testRoutePolylines.push(polyline);
            map.fitBounds(polyline.getBounds(), { padding: [40, 40] });

            const distKm = (route.distance / 1000).toFixed(2);
            const durMin = (route.duration / 60).toFixed(1);

            // alert(`✅ Ruta simulada calculada en Leaflet:\n- Distancia: ${distKm} km\n- Tiempo est.: ${durMin} min\n- Paradas incluidas: ${points.length - 1}`);
          } else {
            const polyline = L.polyline(points.map(p => [p.lat, p.lng]), {
              color: '#2563eb',
              weight: 5,
              dashArray: '8, 8'
            }).addTo(map);
            testRoutePolylines.push(polyline);
            map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
          }
        })
        .catch(err => {
          btnTestShowLeaflet.innerHTML = '🗺️ Mostrar ruta en Leaflet';
          console.error('Error fetching OSRM route:', err);
          const polyline = L.polyline(points.map(p => [p.lat, p.lng]), {
            color: '#2563eb',
            weight: 5,
            dashArray: '8, 8'
          }).addTo(map);
          testRoutePolylines.push(polyline);
          map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
        });
    });
  }

  if (btnTestOpenGoogleMaps) {
    btnTestOpenGoogleMaps.addEventListener('click', () => {
      if (!lastTestedCoords) {
        alert('Por favor haz clic primero sobre un punto del mapa para simular la ubicación GPS.');
        return;
      }
      localStorage.setItem('ZONES_CONFIG', JSON.stringify({ polygons }));
      const mapsUrl = getGoogleMapsUrl(lastTestedCoords[0], lastTestedCoords[1]);
      window.open(mapsUrl, '_blank');
    });
  }

  // Save to LocalStorage
  const btnSaveLocal = document.getElementById('btnSaveLocal');
  if (btnSaveLocal) {
    btnSaveLocal.addEventListener('click', () => {
      const configToSave = { polygons };
      localStorage.setItem('ZONES_CONFIG', JSON.stringify(configToSave));
      alert('✅ Todos los cambios han sido guardados en localStorage correctamente.');
    });
  }

  // Export Code Modal
  const btnExportCode = document.getElementById('btnExportCode');
  const exportModal = document.getElementById('exportModal');
  const codePreviewText = document.getElementById('codePreviewText');
  const btnCloseExportModal = document.getElementById('btnCloseExportModal');
  const btnCopyCode = document.getElementById('btnCopyCode');

  if (btnExportCode) {
    btnExportCode.addEventListener('click', () => {
      const codeString = `/**
 * Configuración de zonas y polígonos para la determinación dinámica del checkpoint de inicio.
 * Este archivo se lee de manera transparente para el usuario base.
 */
window.ZONES_CONFIG = ${JSON.stringify({ polygons }, null, 2)};
`;
      codePreviewText.value = codeString;
      exportModal.style.display = 'flex';
    });
  }

  if (btnCloseExportModal) {
    btnCloseExportModal.addEventListener('click', () => {
      exportModal.style.display = 'none';
    });
  }

  if (btnCopyCode) {
    btnCopyCode.addEventListener('click', () => {
      codePreviewText.select();
      document.execCommand('copy');
      alert('📋 Código copiado al portapapeles. Pégalo en js/admin-config.js');
    });
  }

  // Initial load
  loadInitialPolygons();
});
