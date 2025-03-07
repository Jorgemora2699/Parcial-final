// Esperar a que el DOM se cargue completamente
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar el mapa centrado en el Barrio Techo, Kennedy
    var map = L.map('map', {
        center: [4.6261, -74.1366], // Coordenadas del barrio
        zoom: 16,                   // Zoom adecuado para ver un barrio
        zoomControl: true,
        dragging: true,             // Permitir arrastrar
        scrollWheelZoom: true,      
        doubleClickZoom: true,      
        touchZoom: true             
    });

    // Capa izquierda: Mapa político (CartoDB Positron)
    var politico = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '© CartoDB | © OpenStreetMap contributors'
    }).addTo(map);

    // Capa derecha: Mapa base (OpenStreetMap)
    var base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Comparación de mapas con barra deslizante
    L.control.sideBySide(politico, base).addTo(map);

    // Activar herramientas de dibujo
    map.pm.addControls({
        position: 'topleft',
        drawMarker: true,
        drawPolyline: true,
        drawPolygon: true,
        editMode: true,
        removalMode: true
    });

    // Habilitar edición sobre geometrías dibujadas
    map.on('pm:create', function(e) {
        e.layer.pm.enable();
        console.log('Geometría creada:', e.layer.toGeoJSON());
    });

    // Cargar y agregar el polígono desde un archivo GeoJSON
    fetch('techo.geojson')
        .then(response => response.json())  // Leer el archivo GeoJSON
        .then(data => {
            L.geoJSON(data, {
                style: {
                    color: "red",      // Color del borde
                    weight: 2,         // Grosor de la línea
                    fillColor: "yellow", // Color de relleno
                    fillOpacity: 0.4   // Transparencia del relleno
                }
            }).addTo(map);
        })
        .catch(error => console.error('Error cargando el GeoJSON:', error));
});