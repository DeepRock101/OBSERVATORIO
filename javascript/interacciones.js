// Variables globales
let map;
let marcadores = {};
let capasGeoJSON = [];
let popup = L.popup();

// Aca se puede realizar la modificacion del texto por departamente, se trabaja con el nombre del json para
// poder identificar  algún texto especifico del departamento
const textosPersonalizados = {
  Guatemala: {
    "Alta Verapaz": "Esto unicamente es un prueba jajaj.",
    Huehuetenango: "Esto unicamente es un prueba jaja",
  },

  "Municipios Guatemala": {
    "Mixco": "pruebas lolololol.",
    "Villa Nueva": "son solo pruebas",
    "Santa Catarina Pinula": "pruebas",
  },

  "El Salvador": {
    "San Salvador": "Texto para San Salvador, El Salvador...",
    "La Libertad": "Texto para La Libertad, El Salvador...",
  },
};

// Configurar menú hamburguesa con soporte para dropdowns
function configurarMenuHamburguesa() {
  const menuToggle = document.getElementById("menuToggle");
  const menu = document.getElementById("menu");

  if (menuToggle && menu) {
    menuToggle.addEventListener("click", () => {
      menu.classList.toggle("active");
      menuToggle.classList.toggle("active");
    });
    
    // Manejar dropdowns en desktop (hover) y móvil (click)
    const dropdowns = menu.querySelectorAll('.dropdown');
    
    dropdowns.forEach(dropdown => {
      const dropdownLink = dropdown.querySelector('a');
      const submenu = dropdown.querySelector('.submenu');
      
      // Para desktop - hover
      dropdown.addEventListener('mouseenter', () => {
        if (window.innerWidth > 768) {
          submenu.style.display = 'flex';
        }
      });
      
      dropdown.addEventListener('mouseleave', () => {
        if (window.innerWidth > 768) {
          submenu.style.display = 'none';
        }
      });
      
      // Para móvil - click
      dropdownLink.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          e.stopPropagation();
          
          // Cerrar otros dropdowns abiertos
          dropdowns.forEach(otherDropdown => {
            if (otherDropdown !== dropdown) {
              otherDropdown.querySelector('.submenu').style.display = 'none';
            }
          });
          
          // Toggle el dropdown actual
          if (submenu.style.display === 'flex') {
            submenu.style.display = 'none';
          } else {
            submenu.style.display = 'flex';
          }
        }
      });
    });

    // Cerrar menú al hacer clic en enlaces que no son dropdowns
    const menuLinks = menu.querySelectorAll("a");
    menuLinks.forEach(link => {
      link.addEventListener("click", (e) => {
        // Solo cerrar si no es un enlace de dropdown principal
        if (!link.closest('.dropdown') || link.getAttribute('href') !== '#') {
          menu.classList.remove("active");
          menuToggle.classList.remove("active");
        }
      });
    });

    // Cerrar menú al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && !menuToggle.contains(e.target)) {
        menu.classList.remove("active");
        menuToggle.classList.remove("active");
        
        // Cerrar todos los dropdowns
        dropdowns.forEach(dropdown => {
          dropdown.querySelector('.submenu').style.display = 'none';
        });
      }
    });
  }
}

// Llamar a la función en la inicialización
document.addEventListener("DOMContentLoaded", function () {
  inicializarMapa();
  configurarMenuHamburguesa();
  configurarToggleFiltros();
});

// Función para saber si un punto en especifico se encuentra dentro de un polígono establecido
function puntoEnPoligono(point, polygons) {
  const x = point.lat;
  const y = point.lng;

  let inside = false;

  // Para cada polígono (puede ser multipolígono) no me pregunten
  polygons.forEach((polygon) => {
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0],
        yi = polygon[i][1];
      const xj = polygon[j][0],
        yj = polygon[j][1];

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }
  });

  return inside;
}

// Función mejorada para contar marcadores en cada departamento/municipio
function contarMarcadoresEnDepartamento(feature) {
  let contador = 0;

  Object.values(marcadores).forEach((marcador) => {
    const latlng = marcador.elemento.getLatLng();
    const point = [latlng.lng, latlng.lat]; // [longitud, latitud] para GeoJSON

    // Verificar si el punto está en el polígono
    if (estaPuntoEnFeature(point, feature)) {
      contador++;
    }
  });

  return contador;
}

// Función para verificar si un punto está en una feature
function estaPuntoEnFeature(point, feature) {
  if (!feature.geometry || !feature.geometry.coordinates) return false;

  const coords = feature.geometry.coordinates;
  const [lng, lat] = point;

  // Para Polygon
  if (feature.geometry.type === "Polygon") {
    return puntoEnPoligonoCoords([lat, lng], coords);
  }
  // Para MultiPolygon
  else if (feature.geometry.type === "MultiPolygon") {
    for (let polygon of coords) {
      if (puntoEnPoligonoCoords([lat, lng], polygon)) {
        return true;
      }
    }
  }

  return false;
}

// Función para punto en polígono con coordenadas GeoJSON
function puntoEnPoligonoCoords(point, polygons) {
  const x = point[0]; // lat
  const y = point[1]; // lng

  let inside = false;

  for (let polygon of polygons) {
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][1],
        yi = polygon[i][0]; // [lng, lat] -> [lat, lng]
      const xj = polygon[j][1],
        yj = polygon[j][0];

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }
  }

  return inside;
}

//----------------------------------------------------------------------------------------------------------------------------------------

// Inicialización del mapa, lo trabajamos con tanto con openstreedmap como con librerias de leaflet
function inicializarMapa() {
    // Límites aproximados de Guatemala
    const boundsGuatemala = [
        [13.7, -92.3],  // Esquina sudoeste (límite con México/Océano)
        [17.8, -88.2]   // Esquina noreste (límite con Belice/Honduras)
    ];

    map = L.map("mapa", {
        center: [15.5, -90.25],
        zoom: 9,
        // PERMITIR movimiento pero SOLO DENTRO de Guatemala:
        maxBounds: boundsGuatemala,
        maxBoundsViscosity: 0.9,  // Fuerza del límite (0.5-1.0)
    });
    
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    inicializarMarcadores();
    configurarEventos();
    cargarCapasGeoJSON();
}

// Inicializar marcadores
function inicializarMarcadores() {
 

// En este parte se puede trabajar unicamente con los marcadores personalizados
// Tiene la misma funcionalidad de los marcadores preterminados unicamente, se puede ponder una imagen para cambiar el marcador
// y mejor el entorno visual
// por cada icono es necesario que tenegamos una variable en especifico

// Función para crear popups con estilo personalizados y tener de forma fijas 
// este estilo eso si se cambia uno se cambia todo 
function crearPopupPersonalizado(datos) {
    return `
    <div style="min-width: 250px;">
        <h3 style="color: #2c3e50; margin-bottom: 10px; border-bottom: 2px solid #3498db; padding-bottom: 5px;">
            ${datos.comunidad}
        </h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div style="background: #e8f4fd; padding: 8px; border-radius: 5px; grid-column: span 2;">
                <strong>Nombre</strong><br>
                <span style="color: #2c3e50;">${datos.nombre}</span>
            </div>
            <div style="background: #e8f4fd; padding: 8px; border-radius: 5px;">
                <strong>Tipo</strong><br>
                <span style="color: #2c3e50;">${datos.tipo}</span>
            </div>
            <div style="background: #e8f4fd; padding: 8px; border-radius: 5px;">
                <strong>Estado</strong><br>
                <span style="color: #2c3e50;">${datos.estado}</span>
            </div>
         
            <div style="background: #e8f4fd; padding: 8px; border-radius: 5px;">
                <strong>Fecha</strong><br>
                <span style="color: #2c3e50;">${datos.fecha}</span>
            </div>
            <div style="background: #e8f4fd; padding: 8px; border-radius: 5px;">
                <strong>Uso de violencia</strong><br>
                <span style="color: #2c3e50;">${datos.violencia}</span>
            </div>
        </div>
        <div style="text-align: center; margin-top: 10px;">
            <a href="${datos.enlace}" style="display: inline-block; background: #3498db; color: white; padding: 8px 15px; border-radius: 5px; text-decoration: none;">
                Ver más información
            </a>
        </div>
    </div>
`;
}

// Comenzamos a trabajar lo que son los icos cada imagen tiene su varibale 
// esto es para todo sobre arboles 
  var Ubicacion = L.icon({
    iconUrl: "imagenes/problemas/1imagen.png",
    iconSize: [38, 52],  
    iconAnchor: [19, 52], 
    popupAnchor: [0, -52] 
});


marcadores["personalizado1"] = {
    categoria: "conservacion",
    elemento: L.marker([14.540018, -90.572786], { icon: Ubicacion })
      .addTo(map)
      .bindPopup(crearPopupPersonalizado({
          comunidad: "VALLE DE LAS BRISAS",
          nombre: "PESTE POR QUIMICOS",
          tipo: "CONTAMINACIÓN QUIMICA",
          estado: "ACTIVO",
          territorio: "VILLA NUEVA",
          fecha: "26/05/2025",
          violencia: "No habido violencia de moment",
          enlace: "#se puede poner uno"
      }))
};

marcadores["personalizado2"] = {
    categoria: "conservacion",
    elemento: L.marker([14.486099, -90.587330], { icon: Ubicacion })
      .addTo(map)
      .bindPopup(crearPopupPersonalizado({
          comunidad: "NOMBRE DE LA COMUNIDAD",
          nombre: "NOMBRE DEl CONLIFICTO",
          tipo: "TIPO DE CONFLICTO",
          estado: "ACTUAL QUE SE ENCUENTRA EN CONFLICTO",
          territorio: "UBICACION",
          fecha: "FECHA",
          violencia: "si",
          enlace: "#se puede poner uno"
      }))
};


// esto es para todo sobre mineros 
var minero = L.icon({
    iconUrl: "imagenes/problemas/minera.png",
    iconSize: [38, 52],  
    iconAnchor: [19, 52], 
    popupAnchor: [0, -52]  
});

marcadores["personalizado3"] = {
    categoria: "mitigacion",
    elemento: L.marker([14.550306, -90.470053], { icon: minero })
      .addTo(map)
      .bindPopup(crearPopupPersonalizado({
          comunidad: "NOMBRE DE LA COMUNIDAD",
          nombre: "NOMBRE DEl CONLIFICTO",
          tipo: "TIPO DE CONFLICTO",
          estado: "ACTUAL QUE SE ENCUENTRA EN CONFLICTO",
          territorio: "UBICACION",
          fecha: "FECHA",
          violencia: "si",
          enlace: "#se puede poner uno"
      }))
};

// esto es para todo sobre hidroelectricas 

var hidro = L.icon({
    iconUrl: "imagenes/problemas/3hidro.png",
    iconSize: [38, 52],  
    iconAnchor: [19, 52], 
    popupAnchor: [0, -52] 
});

marcadores["hidro1"] = {
    categoria: "gestion",
    elemento: L.marker([15.071846, -91.223732], { icon: hidro })
      .addTo(map)
      .bindPopup(crearPopupPersonalizado({
          comunidad: "NOMBRE DE LA COMUNIDAD",
          nombre: "NOMBRE DEl CONLIFICTO",
          tipo: "TIPO DE CONFLICTO",
          estado: "ACTUAL QUE SE ENCUENTRA EN CONFLICTO",
          territorio: "UBICACION",
          fecha: "FECHA",
          violencia: "si",
          enlace: "#se puede poner uno"
      }))
};


// esto es para todo sobre basura 

var basura = L.icon({
    iconUrl: "imagenes/problemas/basura y contaminacion.png",
    iconSize: [38, 52],  
    iconAnchor: [19, 52], 
    popupAnchor: [0, -52] 
});

marcadores["personalizado4"] = {
    categoria: "adaptacion",
    elemento: L.marker([15.382234, -90.405258], { icon: basura })
      .addTo(map)
      .bindPopup(crearPopupPersonalizado({
          comunidad: "NOMBRE DE LA COMUNIDAD",
          nombre: "NOMBRE DEl CONLIFICTO",
          tipo: "TIPO DE CONFLICTO",
          estado: "ACTUAL QUE SE ENCUENTRA EN CONFLICTO",
          territorio: "UBICACION",
          fecha: "FECHA",
          violencia: "si",
          enlace: "#se puede poner uno"
      }))
};


// esto es para todo sobre cultivos 

var cultivos = L.icon({
    iconUrl: "imagenes/problemas/cultivos.png",
    iconSize: [38, 52],  
    iconAnchor: [19, 52], 
    popupAnchor: [0, -52] 
});

marcadores["cultivo1"] = {
    categoria: "educacion",
    elemento: L.marker([15.342386, -89.317621], { icon: cultivos })
      .addTo(map)
      .bindPopup(crearPopupPersonalizado({
          comunidad: "NOMBRE DE LA COMUNIDAD",
          nombre: "NOMBRE DEl CONLIFICTO",
          tipo: "TIPO DE CONFLICTO",
          estado: "ACTUAL QUE SE ENCUENTRA EN CONFLICTO",
          territorio: "UBICACION",
          fecha: "FECHA",
          violencia: "si",
          enlace: "#se puede poner uno"
      }))
};




}

//----------------------------------------------------------------------------------------------------------------------------------------

// Configurar eventos
function configurarEventos() {
  map.on("click", onMapClick);

  // Verificar que los elementos existen antes de agregar eventos
  const filtrosContainer = document.getElementById("filtros");
  if (filtrosContainer) {
    document
      .querySelectorAll('#filtros input[type="checkbox"]')
      .forEach((checkbox) => {
        checkbox.addEventListener("change", aplicarFiltros);
      });
  }

  // Botón Mostrar todos
  const btnReset = document.getElementById("btn-reset");
  if (btnReset) {
    btnReset.addEventListener("click", function () {
      document
        .querySelectorAll('#filtros input[type="checkbox"]')
        .forEach((checkbox) => {
          checkbox.checked = true;
        });
      aplicarFiltros();
    });
  }

  // Botón Quitar todos
  const btnQuitarTodos = document.getElementById("btn-quitar-todos");
  if (btnQuitarTodos) {
    btnQuitarTodos.addEventListener("click", function () {
      document
        .querySelectorAll('#filtros input[type="checkbox"]')
        .forEach((checkbox) => {
          checkbox.checked = false;
        });
      aplicarFiltros();
    });
  }
}

// Función perteneciente al uso del filtro
function aplicarFiltros() {
  const filtros = obtenerEstadoFiltros();

  Object.keys(marcadores).forEach((key) => {
    const marcador = marcadores[key];
    const mostrar = evaluarSoloCategoria(marcador, filtros);
    actualizarVisibilidadMarcador(marcador, mostrar);
  });
}

function obtenerEstadoFiltros() {
  // Verificar que los elementos existen antes de acceder a sus propiedades
  const conservacion = document.getElementById("categoria-conservacion");
  const mitigacion = document.getElementById("categoria-mitigacion");
  const gestion = document.getElementById("categoria-gestion");
  const adaptacion = document.getElementById("categoria-adaptacion");
  const educacion = document.getElementById("categoria-educacion");

  return {
    conservacion: conservacion ? conservacion.checked : false,
    mitigacion: mitigacion ? mitigacion.checked : false,
    gestion: gestion ? gestion.checked : false,
    adaptacion: adaptacion ? adaptacion.checked : false,
    educacion: educacion ? educacion.checked : false,
  };
}

function evaluarSoloCategoria(marcador, filtros) {
  // Mapa directo de categorías a filtros
  const mapaCategorias = {
    conservacion: filtros.conservacion,
    mitigacion: filtros.mitigacion,
    gestion: filtros.gestion,
    adaptacion: filtros.adaptacion,
    educacion: filtros.educacion,
  };

  // Verificar si la categoría del marcador está activa
  return mapaCategorias[marcador.categoria] || false;
}

function actualizarVisibilidadMarcador(marcador, mostrar) {
  if (mostrar) {
    map.addLayer(marcador.elemento);
  } else {
    map.removeLayer(marcador.elemento);
  }
}

// Funcion para mostrar coordenadas al hacer click en el mapa, unicamente funciona en la capa donde
// no se tiene un mapa coroplético
function onMapClick(e) {
  popup
    .setLatLng(e.latlng)
    .setContent(
      "Coordenadas: " + e.latlng.lat.toFixed(6) + ", " + e.latlng.lng.toFixed(6)
    )
    .openOn(map);
}

// Funciones para el mapa coroplético (SE MANTIENEN IGUAL)
function highlightFeature(e) {
  var layer = e.target;

  layer.setStyle({
    weight: 5,
    color: "#666",
    dashArray: "",
    fillOpacity: 0.7,
  });

  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    layer.bringToFront();
  }
}

function resetHighlight(e) {
  var layer = e.target;
  var cantidadMarcadores = contarMarcadoresEnDepartamento(layer.feature);

  layer.setStyle({
    fillColor: getColorPorMarcadores(cantidadMarcadores),
    weight: 2,
    opacity: 1,
    color: "white",
    dashArray: "3",
    fillOpacity: 0.7,
  });
}

function zoomToFeature(e) {
  map.fitBounds(e.target.getBounds());
}

function onEachFeature(feature, layer) {
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: zoomToFeature,
  });
}

function getColorPorMarcadores(cantidad) {
  return cantidad >= 15
    ? "#8B0000" // Extremo - Rojo oscuro intenso
    : cantidad >= 12
    ? "#B22222" // Muy alto - Rojo fuego
    : cantidad >= 9
    ? "#DC143C" // Alto - Rojo carmesí
    : cantidad >= 7
    ? "#FF4500" // Medio-alto - Rojo naranja
    : cantidad >= 5
    ? "#FF6347" // Medio - Rojo tomate
    : cantidad >= 3
    ? "#FF7F50" // Moderado bajo - Rojo coral
    : cantidad >= 1
    ? "#FFA07A" // Bajo - Rojo salmón claro
    : "#cccccc"; // Gris para territorios sin proyectos
}

//----------------------------------------------------------------------------------------------------------------------------------------

// Función auxiliar para crear capa GeoJSON (para departamentos y municipios)
function crearCapaGeoJSON(url, propiedades) {
  return fetch(url)
    .then((response) => response.json())
    .then((data) => {
      var capa = L.geoJSON(data, {
        style: function (feature) {
          const cantidadMarcadores = contarMarcadoresEnDepartamento(feature);

          return {
            fillColor: getColorPorMarcadores(cantidadMarcadores),
            weight: 3, // Aumentamos el peso para mejor visualización de bordes
            opacity: 1,
            color: "white",
            dashArray: "3",
            fillOpacity: 0.7,
          };
        },
        onEachFeature: function (feature, layer) {
          const cantidadMarcadores = contarMarcadoresEnDepartamento(feature);

          // Guardar el estilo original en la capa
          layer._originalStyle = {
            fillColor: getColorPorMarcadores(cantidadMarcadores),
            weight: 3,
            opacity: 1,
            color: "white",
            dashArray: "3",
            fillOpacity: 0.7,
          };

          // Obtener texto personalizado
          const textoPersonalizado =
            textosPersonalizados[propiedades.pais]?.[feature.properties.name];

          // Obtener nombre de la feature
          const nombreFeature =
            feature.properties.name ||
            feature.properties.NOMBRE ||
            "Sin nombre";

          // Este aparatado es para la configuración de popup de marcadores
          // se puede configurar los mensajes personalizados de acuerdo a la
          // mismas estructurua que se tiene dentro de la linea 7
          const popupContent = `
                        <div style="min-width: 250px;">
                            <h3 style="color: #2c3e50; margin-bottom: 10px; border-bottom: 2px solid #3498db; padding-bottom: 5px;">
                                ${nombreFeature}
                            </h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                                <div style="background: #e8f4fd; padding: 8px; border-radius: 5px;">
                                    <strong>Proyectos</strong><br>
                                    <span style="font-size: 18px; color: #2c3e50;">${cantidadMarcadores}</span>
                                </div>
                                <div style="background: #e8f4fd; padding: 8px; border-radius: 5px;">
                                    <strong>Tipo</strong><br>
                                    <span style="color: #2c3e50;">${
                                      propiedades.pais ===
                                      "Municipios Guatemala"
                                        ? "Municipio"
                                        : "Departamento"
                                    }</span>
                                </div>
                            </div>
                            <p style="margin: 5px 0;"><strong>País:</strong> ${
                              propiedades.pais === "Municipios Guatemala"
                                ? "Guatemala"
                                : propiedades.pais
                            }</p>
                            ${
                              textoPersonalizado
                                ? `
                                <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 5px;">
                                    <p style="margin: 0; font-size: 13px; color: #856404;">
                                        <strong>Información:</strong><br>
                                        ${textoPersonalizado}
                                    </p>
                                </div>
                            `
                                : ""
                            }
                        </div>
                    `;

          layer.bindPopup(popupContent);

          // Mantener las interacciones
          layer.on({
            mouseover: highlightFeature,
            mouseout: resetHighlight,
            click: zoomToFeature,
          });
        },
      });

      // Guardar la capa en el array global
      capasGeoJSON.push(capa);
      return capa;
    });
}

// Función separada para áreas protegidas
function crearCapaAreasProtegidas(url) {
  return fetch(url)
    .then((response) => response.json())
    .then((data) => {
      var capa = L.geoJSON(data, {
        style: {
          fillColor: "#2E8B57", // Verde para áreas protegidas
          weight: 2,
          opacity: 1,
          color: "white",
          dashArray: "3",
          fillOpacity: 0.7,
        },
        onEachFeature: function (feature, layer) {
          // Guardar el estilo original en la capa
          layer._originalStyle = {
            fillColor: "#2E8B57",
            weight: 2,
            opacity: 1,
            color: "white",
            dashArray: "3",
            fillOpacity: 0.7,
          };

          // Obtener nombre de la feature
          const nombreFeature =
            feature.properties.name ||
            feature.properties.NOMBRE ||
            "Área Protegida";

          // Popup específico para áreas protegidas
          const popupContent = `
                        <div style="min-width: 250px;">
                            <h3 style="color: #2c3e50; margin-bottom: 10px; border-bottom: 2px solid #2E8B57; padding-bottom: 5px;">
                                ${nombreFeature}
                            </h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                                <div style="background: #e8f4fd; padding: 8px; border-radius: 5px;">
                                    <strong>Tipo</strong><br>
                                    <span style="color: #2c3e50;">Área Protegida</span>
                                </div>
                                <div style="background: #e8f4fd; padding: 8px; border-radius: 5px;">
                                    <strong>País</strong><br>
                                    <span style="color: #2c3e50;">Guatemala</span>
                                </div>
                            </div>
                            <p style="margin: 5px 0; font-style: italic; color: #666;">
                                Zona de conservación ambiental protegida
                            </p>
                        </div>
                    `;

          layer.bindPopup(popupContent);

          // Mantener las interacciones visuales pero sin conectar con la lógica de proyectos
          layer.on({
            mouseover: function (e) {
              var layer = e.target;
              layer.setStyle({
                weight: 4,
                color: "#666",
                dashArray: "",
                fillOpacity: 0.9,
              });
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                layer.bringToFront();
              }
            },
            mouseout: function (e) {
              var layer = e.target;
              layer.setStyle(layer._originalStyle);
            },
            click: zoomToFeature,
          });
        },
      });

      // Guardar la capa en el array global si es necesario
      capasGeoJSON.push(capa);
      return capa;
    });
}

// Cargar capas GeoJSON de esta manera sirve para solo usar la capa que deseamos ver
function cargarCapasGeoJSON() {
  // Definir capas base principal
  var osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  });

  // Segunda capa base
  var osmHOT = L.tileLayer(
    "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        "© OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team hosted by OpenStreetMap France",
    }
  );

  // variables de las capas
  var mapagt = L.layerGroup();
  var mapagtm = L.layerGroup();
  var mapasv = L.layerGroup();
  
  var capaGeneralTodos = L.layerGroup();

  // Cargar de departamentos Guatemala - USAR "mapa2.gt" es el nombre del archivo
  crearCapaGeoJSON("jsons/mapa2.gt.geojson", { pais: "Guatemala" }).then(
    (capaGT) => {
      capaGT.addTo(mapagt);
      capaGT.addTo(capaGeneralTodos);
    }
  );

  // Cargar de municipios Guatemala - USAR "municipiosgt" es el nombre del archivo
  crearCapaGeoJSON("jsons/municipiosgt.geojson", {
    pais: "Municipios Guatemala",
  }).then((capaMunicipios) => {
    capaMunicipios.addTo(mapagtm);
    capaMunicipios.addTo(capaGeneralTodos);
  });

  // Cargar áreas protegidas de Guatemala con la función separada
  crearCapaAreasProtegidas("jsons/areasprotegidas.geojson").then((capaSV) => {
    capaSV.addTo(mapasv);
    // NOTA: Las áreas protegidas NO se añaden a capaGeneralTodos
    // para mantenerlas completamente separadas
  });

  // Definir capas para el control
  var baseLayers = {
    "OpenStreetMap Estándar": osm,
    "Mapa HOT": osmHOT,
  };

  var overlayLayers = {
    "Todos los Países": capaGeneralTodos,
    "Departamentos": mapagt,
    "Municipios": mapagtm,
    "Áreas Protegidas": mapasv, // Aparece en el control pero funciona independientemente
  };

  // Añadir control de capas
  L.control
    .layers(baseLayers, overlayLayers, {
      position: "topright",
    })
    .addTo(map);

  // Añadir las capas iniciales al mapa
  osm.addTo(map);
  capaGeneralTodos.addTo(map);
  // Las áreas protegidas NO se cargan por defecto, el usuario las activa desde el control
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", function () {
  inicializarMapa();
});












// Función para descargar Excel - VERSIÓN CORRECTA
document.getElementById("btn-descargar-excel").addEventListener("click", function () {
    const datosConflictos = Object.values(marcadores).map((marcador, index) => {
        const popupContent = marcador.elemento.getPopup()?.getContent() || "";
        
        let comunidad = "N/A";
        let nombreConflicto = "N/A";
        let tipoConflicto = "N/A";
        let estado = "N/A";
        let fecha = "N/A";
        let violencia = "N/A";

        if (popupContent) {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = popupContent;

            // EXTRAER COMUNIDAD del h3
            const h3 = tempDiv.querySelector('h3');
            if (h3) {
                comunidad = h3.textContent.trim();
            }

            // EXTRAER LOS DEMÁS DATOS de los divs específicos
            const divsConInfo = tempDiv.querySelectorAll('div[style*="background: #e8f4fd"]');
            
            // El ORDEN de los divs es importante:
            // div[0] = Nombre
            // div[1] = Tipo  
            // div[2] = Estado
            // div[3] = Fecha
            // div[4] = Violencia
            
            if (divsConInfo.length >= 1) {
                const spanNombre = divsConInfo[0].querySelector('span');
                if (spanNombre) nombreConflicto = spanNombre.textContent.trim();
            }
            
            if (divsConInfo.length >= 2) {
                const spanTipo = divsConInfo[1].querySelector('span');
                if (spanTipo) tipoConflicto = spanTipo.textContent.trim();
            }
            
            if (divsConInfo.length >= 3) {
                const spanEstado = divsConInfo[2].querySelector('span');
                if (spanEstado) estado = spanEstado.textContent.trim();
            }
            
            if (divsConInfo.length >= 4) {
                const spanFecha = divsConInfo[3].querySelector('span');
                if (spanFecha) fecha = spanFecha.textContent.trim();
            }
            
            if (divsConInfo.length >= 5) {
                const spanViolencia = divsConInfo[4].querySelector('span');
                if (spanViolencia) violencia = spanViolencia.textContent.trim();
            }
        }

        return {
            "No.": index + 1,
            "NOMBRE DE LA COMUNIDAD": comunidad,
            "NOMBRE DEL CONFLICTO": nombreConflicto,
            "TIPO DE CONFLICTO": tipoConflicto,
            "ESTADO": estado,
            "FECHA": fecha,
            "VIOLENCIA": violencia
        };
    });

    // Agregar fila de totales
    const totales = {
        "No.": "TOTAL",
        "NOMBRE DE LA COMUNIDAD": "",
        "NOMBRE DEL CONFLICTO": "",
        "TIPO DE CONFLICTO": "",
        "ESTADO": "",
        "FECHA": "",
        "VIOLENCIA": datosConflictos.length + " conflictos registrados"
    };

    datosConflictos.push(totales);

    // Convertir a CSV
    const csvContent = convertirArrayACSV(datosConflictos);

    // Descargar el archivo
    const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;"
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", "conflictos_ambientales.csv");
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Función para convertir a CSV (la que ya tienes)
function convertirArrayACSV(array) {
    if (array.length === 0) return "";

    const cabeceras = Object.keys(array[0]);
    const filas = array.map((fila) =>
        cabeceras
            .map((cabecera) => {
                const valor = fila[cabecera] || "";
                return `"${String(valor).replace(/"/g, '""')}"`;
            })
            .join(",")
    );

    return [cabeceras.join(","), ...filas].join("\n");
}