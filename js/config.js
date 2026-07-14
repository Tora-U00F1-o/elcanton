const CONFIG = {
  // Coordenadas actualizadas para la ruta de Cangas de Onís a Casa de Aldea El Cantón (Tornín)
  puntos: {
    inicioFijo: { 
      lat: 43.3506429, 
      lng: -5.1311817, 
      nombre: "Puente Romano de Cangas de Onís" 
    },
    paradaIntermedia1: { 
      lat: 43.31714233469878, 
      lng: -5.12975139022926, 
      nombre: "Punto de Control 1: Entrada a Tornín" 
    },
    paradaIntermedia2: { 
      lat: 43.31604753996638, 
      lng: -5.129161304251733, 
      nombre: "Punto de Control 2: Desvío El Cantón" 
    },
    destinoFinal: { 
      lat: 43.3161642, 
      lng: -5.1286036, 
      nombre: "Casa de Aldea El Cantón" 
    }
  },
  
  // Puntos de información con imágenes para el mapa interactivo
  checkpoints: [
    {
      id: "cp1",
      lat: 43.31714233469878,
      lng: -5.12975139022926,
      titulo: "📍 PARADA 1: Entrada a Tornín",
      descripcion: "Punto de control obligatorio. Continúa recto por el camino de entrada al pueblo en dirección sur.",
      fotoUrl: "assets/images/landmark1.jpg"
    },
    {
      id: "cp2",
      lat: 43.31604753996638,
      lng: -5.129161304251733,
      titulo: "📍 PARADA 2: Desvío El Cantón",
      descripcion: "Gira a la izquierda por el callejón vecinal para acceder a la Casa de Aldea El Cantón.",
      fotoUrl: "assets/images/landmark2.jpg"
    }
  ],
  
  // Enlaces de utilidad y tráfico (QoL)
  enlacesExternos: {
    alsa: "https://www.alsa.es",
    tuaOviedo: "https://tua.es",
    traficoAsturias: "http://www.carreterasasturias.es"
  }
};
