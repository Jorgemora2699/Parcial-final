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

    // Bounding Box del barrio Techo
    var techoBBox = [
        [-74.15014529658922, 4.624081136080341], 
        [-74.14509432715616, 4.629688420286735]
    ];

    // Polígono del barrio Techo basado en el bbox (simplificado)
    var techoPolygon = [
        [4.624081136080341, -74.15014529658922], // SW
        [4.624081136080341, -74.14509432715616], // SE
        [4.629688420286735, -74.14509432715616], // NE
        [4.629688420286735, -74.15014529658922], // NW
        [4.624081136080341, -74.15014529658922]  // Cerrar el polígono
    ];

    // Agregar el polígono al mapa
    L.polygon(techoPolygon, {
        color: "red",
        weight: 2,
        fillColor: "yellow",
        fillOpacity: 0.4
    }).addTo(map);

    // Intentar cargar el GeoJSON si está disponible
    try {
        fetch('techo.geojson')
            .then(response => response.json())
            .then(data => {
                L.geoJSON(data, {
                    style: {
                        color: "red",
                        weight: 2,
                        fillColor: "yellow",
                        fillOpacity: 0.4
                    }
                }).addTo(map);
            })
            .catch(error => {
                console.log('No se pudo cargar el GeoJSON, usando polígono simplificado:', error);
            });
    } catch (error) {
        console.log('Error al cargar el GeoJSON:', error);
    }

    // Crear un panel para los índices de vegetación
    var panelControl = L.control({position: 'topright'});

    panelControl.onAdd = function(map) {
        var div = L.DomUtil.create('div', 'info-panel');
        div.innerHTML = `
            <div style="background-color: white; padding: 10px; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.2); min-width: 200px;">
                <h4 style="margin-top: 0; text-align: center;">Índices de Vegetación</h4>
                <div style="margin: 5px 0;">
                    <button id="btn-ndvi" class="indice-boton">Calcular NDVI</button>
                    <button id="btn-savi" class="indice-boton">Calcular SAVI</button>
                </div>
                <div style="margin: 5px 0;">
                    <label for="factor-l">Factor L para SAVI:</label>
                    <select id="factor-l" style="width: 100%; padding: 5px;">
                        <option value="0.25">L = 0.25 (vegetación densa)</option>
                        <option value="0.5" selected>L = 0.5 (vegetación intermedia)</option>
                        <option value="0.75">L = 0.75 (vegetación escasa)</option>
                    </select>
                </div>
                <div id="resultados" class="resultados"></div>
            </div>
        `;
        
        // Prevenir que los clics en el panel afecten al mapa
        L.DomEvent.disableClickPropagation(div);
        return div;
    };

    panelControl.addTo(map);

    // Configurar event listeners para los botones después de agregar el panel al mapa
    setTimeout(function() {
        // Botón NDVI
        document.getElementById('btn-ndvi').addEventListener('click', function() {
            calcularNDVI();
        });

        // Botón SAVI
        document.getElementById('btn-savi').addEventListener('click', function() {
            calcularSAVI();
        });
    }, 100);

    // Variable para almacenar el valor de L para SAVI
    var factorL = 0.5;

    // Actualizar el valor de L cuando cambie el selector
    document.addEventListener('change', function(e) {
        if (e.target && e.target.id === 'factor-l') {
            factorL = parseFloat(e.target.value);
            console.log('Factor L actualizado a:', factorL);
        }
    });

    // Definir un BBox para el cálculo
    var bogotaBBox = {
        west: -74.15014529658922,
        south: 4.624081136080341,
        east: -74.14509432715616,
        north: 4.629688420286735
    };

    // Función para simular capa NDVI
    function agregarCapaNDVI(ndviValor) {
        // Crear una capa de rectángulo coloreada según el valor NDVI
        var colorNDVI;
        
        if (ndviValor > 0.6) {
            colorNDVI = '#006400'; // Verde oscuro para vegetación densa
        } else if (ndviValor > 0.3) {
            colorNDVI = '#90EE90'; // Verde claro para vegetación moderada
        } else if (ndviValor > 0) {
            colorNDVI = '#FFFF00'; // Amarillo para vegetación escasa
        } else {
            colorNDVI = '#CD853F'; // Marrón para suelo desnudo
        }
        
        // Eliminar capas NDVI previas
        map.eachLayer(function(layer) {
            if (layer.options && layer.options.id === 'ndviLayer') {
                map.removeLayer(layer);
            }
        });
        
        // Crear una capa rectangular que represente el resultado NDVI
        var bounds = [
            [bogotaBBox.south, bogotaBBox.west],
            [bogotaBBox.north, bogotaBBox.east]
        ];
        
        var ndviLayer = L.rectangle(bounds, {
            color: colorNDVI,
            fillColor: colorNDVI,
            fillOpacity: 0.5,
            id: 'ndviLayer'
        }).addTo(map);
        
        // Añadir popup con información
        ndviLayer.bindPopup(`<strong>NDVI Promedio:</strong> ${ndviValor.toFixed(2)}`);
    }

    // Función para simular capa SAVI
    function agregarCapaSAVI(saviValor, factorL) {
        // Crear una capa de rectángulo coloreada según el valor SAVI
        var colorSAVI;
        
        if (saviValor > 0.6) {
            colorSAVI = '#228B22'; // Verde bosque para vegetación densa
        } else if (saviValor > 0.3) {
            colorSAVI = '#ADFF2F'; // Verde amarillento para vegetación moderada
        } else if (saviValor > 0) {
            colorSAVI = '#F0E68C'; // Khaki para vegetación escasa
        } else {
            colorSAVI = '#DEB887'; // Burlywood para suelo desnudo
        }
        
        // Eliminar capas SAVI previas
        map.eachLayer(function(layer) {
            if (layer.options && layer.options.id === 'saviLayer') {
                map.removeLayer(layer);
            }
        });
        
        // Crear una capa rectangular que represente el resultado SAVI
        var bounds = [
            [bogotaBBox.south, bogotaBBox.west],
            [bogotaBBox.north, bogotaBBox.east]
        ];
        
        var saviLayer = L.rectangle(bounds, {
            color: colorSAVI,
            fillColor: colorSAVI,
            fillOpacity: 0.5,
            id: 'saviLayer'
        }).addTo(map);
        
        // Añadir popup con información
        saviLayer.bindPopup(`<strong>SAVI Promedio:</strong> ${saviValor.toFixed(2)}<br><strong>Factor L:</strong> ${factorL}`);
    }

    // Función para calcular NDVI
    function calcularNDVI() {
        // En una aplicación web normal, aquí se haría una petición a Google Earth Engine
        // mediante una API. Para este ejemplo, simularemos el cálculo.
        
        console.log('Calculando NDVI...');
        
        // Simular carga
        document.getElementById('resultados').innerHTML = '<div style="text-align: center;">Calculando NDVI...</div>';
        
        setTimeout(function() {
            // Simulación de resultados NDVI
            var resultadoNDVI = {
                promedio: 0.68,
                min: 0.32,
                max: 0.89
            };
            
            // Mostrar resultados en el panel
            var resultadosDiv = document.getElementById('resultados');
            resultadosDiv.innerHTML = `
                <div class="ndvi-resultados">
                    <strong>Resultados NDVI:</strong><br>
                    Promedio: ${resultadoNDVI.promedio.toFixed(2)}<br>
                    Mínimo: ${resultadoNDVI.min.toFixed(2)}<br>
                    Máximo: ${resultadoNDVI.max.toFixed(2)}
                </div>
            `;
            
            // Actualizar también la sección de análisis
            document.getElementById('ndvi-info').innerHTML += `
                <div class="ndvi-resultados" style="margin-top: 10px;">
                    <strong>Resultados para Barrio Techo:</strong><br>
                    Promedio: ${resultadoNDVI.promedio.toFixed(2)}<br>
                    Mínimo: ${resultadoNDVI.min.toFixed(2)}<br>
                    Máximo: ${resultadoNDVI.max.toFixed(2)}
                </div>
            `;
            
            // Añadir capa NDVI al mapa
            agregarCapaNDVI(resultadoNDVI.promedio);
        }, 1500);
    }

    // Función para calcular SAVI
    function calcularSAVI() {
        console.log('Calculando SAVI con factor L =', factorL);
        
        // Simular carga
        document.getElementById('resultados').innerHTML = '<div style="text-align: center;">Calculando SAVI...</div>';
        
        setTimeout(function() {
            // Simulación de resultados SAVI
            var resultadoSAVI = {
                promedio: 0.58,
                min: 0.27,
                max: 0.79,
                factorL: factorL
            };
            
            // Ajustar el resultado promedio según el factor L
            if (factorL === 0.25) {
                resultadoSAVI.promedio = 0.62;
            } else if (factorL === 0.75) {
                resultadoSAVI.promedio = 0.54;
            }
            
            // Mostrar resultados en el panel
            var resultadosDiv = document.getElementById('resultados');
            resultadosDiv.innerHTML = `
                <div class="savi-resultados">
                    <strong>Resultados SAVI (L=${factorL}):</strong><br>
                    Promedio: ${resultadoSAVI.promedio.toFixed(2)}<br>
                    Mínimo: ${resultadoSAVI.min.toFixed(2)}<br>
                    Máximo: ${resultadoSAVI.max.toFixed(2)}
                </div>
            `;
            
            // Actualizar también la sección de análisis
            document.getElementById('savi-info').innerHTML += `
                <div class="savi-resultados" style="margin-top: 10px;">
                    <strong>Resultados para Barrio Techo (L=${factorL}):</strong><br>
                    Promedio: ${resultadoSAVI.promedio.toFixed(2)}<br>
                    Mínimo: ${resultadoSAVI.min.toFixed(2)}<br>
                    Máximo: ${resultadoSAVI.max.toFixed(2)}
                </div>
            `;
            
            // Añadir capa SAVI al mapa
            agregarCapaSAVI(resultadoSAVI.promedio, factorL);
        }, 1500);
    }

    // Función que podría implementarse para llamar a una API de Earth Engine
    function llamarAPIEarthEngine(parametros) {
        // En este punto, se realizaría una petición a tu API backend que se comunica con Google Earth Engine
        // Por ejemplo:
        /*
        fetch('https://tu-api-backend.com/calcular-indices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                bbox: bogotaBBox,
                factor_l: parametros.factorL,
                tipo_indice: parametros.tipoIndice,
                fecha_inicio: '2024-01-01',
                fecha_fin: '2025-01-01'
            })
        })
        .then(response => response.json())
        .then(data => {
            if (parametros.tipoIndice === 'ndvi') {
                mostrarResultadosNDVI(data);
            } else if (parametros.tipoIndice === 'savi') {
                mostrarResultadosSAVI(data);
            }
        })
        .catch(error => {
            console.error('Error al comunicarse con la API:', error);
            document.getElementById('resultados').innerHTML = 
                '<div style="color: red;">Error al calcular el índice. Por favor, intenta nuevamente.</div>';
        });
        */
    }
});