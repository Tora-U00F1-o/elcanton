const CONFIG = {
  // Coordenadas actualizadas para la ruta de Cangas de Onís a Casa de Aldea El Cantón (Tornín)
  puntos: {
    inicioFijo: { 
      lat: 43.35058455755397,  
      lng: -5.1320529718716665, 
      nombre: "Puente Romano de Cangas de Onís" ,
      fotoUrl: "assets\\images\\guia-puenteromano.png" // Ruta de la imagen (ej: "assets/images/mi_imagen.jpg")

    },
    pto1: { 
      lat: 43.317297545597924, 
      lng: -5.129827151202868,
      nombre: "Pto1",
      titulo: "Entrada Tornin",
      indicacion: "Al llegar a la entrada de Tornin verás el Restaurante Casa Sanchez",
      fotoUrl: "assets\\images\\guia-entrada.png" // Ruta de la imagen (ej: "assets/images/mi_imagen.jpg")
    },
    pto3: { 
      lat: 43.31697889119276, 
      lng: -5.129225749025344,
      nombre: "",
      titulo: "La Llombiquina",
      indicacion: "Continua a la derecha por el camino llano.",
      fotoUrl: "assets\\images\\guia-llombiquina.png"
    },
    pto4: { 
      lat: 43.31636385939948, 
      lng: -5.129134425469065, 
      nombre: "",
      titulo: "Quintana Baxu",
      indicacion: "Continua recto hasta llegar a un cruce.",
      fotoUrl: "assets\\images\\guia-quintana.png"
    },
    pto7: { 
      lat: 43.31576171406016, 
      lng: -5.129024164978672,
      nombre: "Pto7",
      titulo: "Gira a la izquierda",
      indicacion: "Camino hacia arriba, sigue recto hasta llegar a la Casa de Aldea El Cantón.",
      fotoUrl: "assets\\images\\guia-subidacanton.png"
    },
    destinoFinal: { 
      lat: 43.3161642, 
      lng: -5.1286036, 
      nombre: "Casa de Aldea El Cantón",
      titulo: "Casa de Aldea El Cantón",
      indicacion: "¡Has llegado a tu destino!",
      fotoUrl: "assets\\images\\guia-elcanton.png"
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
