/* global L:false */
var map, featureList, app = {};
var listSearch = [];

/* For Social Apps */
// ================================================================
app.author = "Shin Kobara";
app.copyright = "SGI-USA Austin";
app.title = "SGI Austin TX District Map";
app.html = "http://sgiusaaustin.org";
app.desc = "District/Chapter boundary map";

/* Layer Size */
// ================================================================
$(window).resize(function() {
  sizeLayerControl();
});
function sizeLayerControl() {
  $(".leaflet-control-layers").css("max-height", $("#map").height() - 50);
}
function startLoading() {
  map.spin(true);
}
function finishedLoading() {
  setTimeout(function() {
    map.spin(false);
  }, 1000);
}

// ================================================================
// Initial Map Settings
// ================================================================
//TODO (2) Edit coordinates, basemap, zoom level etc.
map = L.map("map", {
  zoomControl: false,
  scrollWheelZoom: true,
  zoom: 10,
  center: [30.34761, -97.7147],
  attributionControl: false
});
//var initBase = L.esri.basemapLayer('Topographic').addTo(map);
startLoading(); // start loading icon

// ================================================================
// Basemap Layers
// ================================================================
//TODO (4) Edit initial basemap if necessary
var mapquestOSM = L.tileLayer("http://{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png", {
  maxZoom: 20,
  subdomains: ["otile1", "otile2", "otile3", "otile4"],
  attribution: 'Tiles courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png">. Map data (c) <a href="http://www.openstreetmap.org/" target="_blank">OpenStreetMap</a> contributors, CC-BY-SA.'
});
var mapquestHYB = L.layerGroup([L.tileLayer("http://{s}.mqcdn.com/tiles/1.0.0/sat/{z}/{x}/{y}.jpg", {
  maxZoom: 20,
  subdomains: ["oatile1", "oatile2", "oatile3", "oatile4"]
}), L.tileLayer("http://{s}.mqcdn.com/tiles/1.0.0/hyb/{z}/{x}/{y}.png", {
  maxZoom: 20,
  subdomains: ["oatile1", "oatile2", "oatile3", "oatile4"],
  attribution: 'Labels courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png">. Map data (c) <a href="http://www.openstreetmap.org/" target="_blank">OpenStreetMap</a> contributors, CC-BY-SA. Portions Courtesy NASA/JPL-Caltech and U.S. Depart. of Agriculture, Farm Service Agency | Points data from <a href="http://galvbay.org">galvbay.org</a>'
})]);
var esriOcean = L.layerGroup([L.esri.tiledMapLayer("http://services.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer", {
  attribution: '&copy; <a href="http://www.esri.com/">Esri</a>, GEBCO, NOAA, National Geographic, DeLorme, HERE, Geonames.org, and other contributors| Points data from <a href="http://galvbay.org">galvbay.org</a>'
}), L.esri.tiledMapLayer("http://server.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Reference/MapServer", {
  attribution: '&copy; <a href="http://www.esri.com/">Esri</a>, GEBCO, NOAA, National Geographic, DeLorme, HERE, Geonames.org, and other contributors| Points data from <a href="http://galvbay.org">galvbay.org</a>'
})]);
var esriTopo = L.esri.tiledMapLayer("http://services.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer", {
  attribution: '&copy; <a href="http://www.esri.com/">Esri</a>, HERE, DeLorme, TomTom, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), swisstopo, MapmyIndia, © OpenStreetMap contributors, GIS User Comm. | Points data from <a href="http://galvbay.org">galvbay.org</a>'
});
var esriImage = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: '&copy; <a href="http://www.esri.com/">Esri</a>, DigitalGlobe, Earthstar Geographics, CNES/Airbus DS, GeoEye, USDA FSA, USGS, Getmapping, Aerogrid, IGN, IGP, swisstopo, and the GIS User Community | Points data from <a href="http://galvbay.org">galvbay.org</a>',
  maxZoom: 18,
});
var cartodb_light = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
  attribution: 'Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a> | Points data from <a href="http://galvbay.org">galvbay.org</a>',
  maxZoom: 18
});
var cartodb_dark = L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
  attribution: 'Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a> | Points data from <a href="http://galvbay.org">galvbay.org</a>',
  maxZoom: 18
});
var ggl = new L.Google();
var ggl2 = new L.Google('TERRAIN');

/* grouping basemap layers */
var baseLayers = {
  "Street Map": mapquestOSM,
  "Light": cartodb_light,
  "Dark": cartodb_dark,
  "Imagery with Streets": mapquestHYB,
  "Esri World Imagery": esriImage,
  //"Ocean": esriOcean,
  "Topography": esriTopo,
  "Google": ggl,
  'Google Terrain': ggl2
};
map.addLayer(mapquestOSM);

// Leaflet Map Functions
// Zoom control (bottom right)
// ================================================================
var zoomControl = L.control.zoom({
  position: "bottomright"
}).addTo(map);
// Home button - back to default extent (bottom right)
// ================================================================
L.control.defaultExtent({
  position: "bottomright"
}).addTo(map);
// GPS enabled geolocation control set to follow the user's location (bottom right)
// ================================================================
var locateControl = L.control.locate({
  position: "bottomright",
  drawCircle: true,
  follow: true,
  setView: true,
  keepCurrentZoomLevel: true,
  markerStyle: {
    weight: 1,
    opacity: 0.8,
    fillOpacity: 0.8
  },
  circleStyle: {
    weight: 1,
    clickable: false
  },
  icon: "fa fa-map-marker",
  metric: false,
  strings: {
    title: "My location", // title of the locate control
    metersUnit: "meters",
    feetUnit: "feet",
    popup: "You are within {distance} {unit} from this point",
    outsideMapBoundsMsg: "You seem located outside the boundaries of the map"
  },
  locateOptions: {
    maxZoom: 17,
    watch: true,
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 10000
  }
}).addTo(map);
map.on('dragstart', locateControl._stopFollowing, locateControl);
// leaflet draw (top left corner)
// ================================================================
var drawnItems = L.featureGroup().addTo(map);
map.addControl(new L.Control.Draw({
  edit: {
    featureGroup: drawnItems
  }
}));
map.on('draw:created', function(event) {
  var layer = event.layer;
  drawnItems.addLayer(layer);
});
// leaflet Measurement
// ================================================================
L.Control.measureControl().addTo(map);
/* leaflet filelayer (load local files suc as GeoJSON, GPX, KML) */
// ================================================================
L.Control.FileLayerLoad.LABEL = '<i class="fa fa-folder-open"></i>';
L.Control.fileLayerLoad({
  fitBounds: true,
  layerOptions: {
    style: {
      color: 'red',
      opacity: 1.0,
      fillOpacity: 1.0,
      weight: 2,
      clickable: false
    }
  },
  // File size limit in kb (default: 1024) ?
  fileSizeLimit: 1024,
  // Restrict accepted file formats (default: .geojson, .kml, and .gpx) ?
  formats: [
    '.geojson',
    '.kml'
  ]
}).addTo(map);
//$('.leaflet-control-filelayer').hide();
$('.leaflet-top.leaflet-left').hide();

// esri geocode
var geoSearchControl = new L.esri.Geocoding.Controls.Geosearch({
  position: 'bottomright',
  providers: [
    new L.esri.Geocoding.Controls.Geosearch.Providers.FeatureLayer({
      url: '//services.arcgis.com/uCXeTVveQzP4IIcx/arcgis/rest/services/gisday/FeatureServer/0/',
      searchFields: ['Name', 'Organization'],
      label: 'GIS Day Events',
      bufferRadius: 5000,
      formatSuggestion: function(feature) {
        return feature.properties.Name + ' - ' + feature.properties.Organization;
      }
    })
  ]
}).addTo(map);
var results = new L.LayerGroup().addTo(map);
geoSearchControl.on('results', function(data) {
  results.clearLayers();
  for (var i = data.results.length - 1; i >= 0; i--) {
    results.addLayer(L.marker(data.results[i].latlng));
    // move weatherMarker to the center
    weatherMarker.setLatLng(
      data.results[i].latlng
    );
    onDragEnd();
  }
  console.log('geocoding!');
});

// ================================================================
/* Attribution control (bottom right. Order:bottom to top) */
// ================================================================
function updateAttribution(e) {
  $.each(map._layers, function(index, layer) {
    if (layer.getAttribution) {
      $("#attribution").html((layer.getAttribution()));
    }
  });
}
map.on("layeradd", updateAttribution);
map.on("layerremove", updateAttribution);
var attributionControl = L.control({
  position: "bottomleft"
});
attributionControl.onAdd = function(map) {
  var div = L.DomUtil.create("div", "leaflet-control-attribution");
  //TODO (3) Edit bottom-left Attribution information
  div.innerHTML = "<span class='hidden-xs'><a href='http://products.gcoos.org' target='_blank'>GCOOS</a> | </span><a href='#' onclick='$(\"#attributionModal\").modal(\"show\"); return false;'>Attribution</a>";
  return div;
};
map.addControl(attributionControl);

//=================================================================
// Weather Info from Forecast.io
//=================================================================
var redMarker = L.ExtraMarkers.icon({
  icon: 'fa-info-circle',
  prefix: 'fa',
  shape: 'circle',
  markerColor: 'red',
  iconColor: 'white'
});
var weatherMarker = L.marker([30.34761, -97.7147], {
  icon: redMarker,
  riseOnHover: true, // z-index offset 250
  zIndexOffset: 2000,
  draggable: true
}).addTo(map);
weatherMarker.on({
  click: function(e) {
    $("#weatherModal").modal("show");
  }
});
// every time the marker is dragged, update the weather container
weatherMarker.on('dragend', onDragEnd);
// Set the initial marker coordinate on load.
onDragEnd();

function onDragEnd() {
  $("#latlng_div").html('');
  $("#weather_div").html('');
  var m = weatherMarker.getLatLng();
  //console.log('Latitude: ' + m.lat + ' Longitude: ' + m.lng);
  var address;
  $.ajax({
    // forecast.io based on shin.kobara@gmail.com
    url: "https://api.forecast.io/forecast/fce73211ba8678302a5ce7b9732703aa/" + m.lat + "," + m.lng,
    dataType: "jsonp",
    success: function(pjson) { //prased json data
      //console.log(pjson);
      L.esri.Geocoding.Tasks.reverseGeocode().latlng([m.lat, m.lng]).run(function(error, result) {
        if (result) {
          address = result.address.Match_addr;
        } else {
          address = "Cannot find";
        }
        $('#reverseAddress').html(address);
      });
      $("#latlng_div").append("Latitude: <b>" + m.lat.toFixed(5) + "</b>&deg;<br />Longitude: <b>" + m.lng.toFixed(5) + "</b>&deg;<br /><br />" + "Address: " + "<div id='reverseAddress'></div>");
      $("#weather_div").append("<iframe id='forecast_embed' type='text/html' frameborder='0' height='245' width='100%'' src='http://forecast.io/embed/#lat=" + m.lat + "&lon=" + m.lng + "&name=" + "Lat:" + m.lat.toFixed(2) + "&deg; Long:" + m.lng.toFixed(2) + "&deg;'> </iframe>");
    },
    error: function(thrownError) {
      console.warn(thrownError);
    }
  });

  // ================================================================
  // Copy to ClipBoard
  // ================================================================
  var client = new ZeroClipboard($('.clip_button'));
  client.on('ready', function(event) {
    client.on('copy', function(event) {
      //var clip = m.lng.toFixed(5)+","+m.lat.toFixed(5);
      var clip = address;
      //console.log(clip);
      event.clipboardData.setData('text/plain', clip);
    });
    client.on("aftercopy", function(event) {
      alert("Copied text to clipboard: " + event.data["text/plain"]);
    });
  });
  client.on('error', function(event) {
    // console.log( 'ZeroClipboard error of type "' + event.name + '": ' + event.message );
    ZeroClipboard.destroy();
  });
}

// ================================================================
// Layer Controls - Highlight
// ================================================================
var highlight = L.geoJson(null);
var defaultStyle = {
    color: "#2262CC",
    weight: 3,
    opacity: 0.9,
    fillOpacity: 0.2,
    fillColor: "#2262CC"
};
var highlightStyle = {
    color: '#2262CC',
    weight: 5,
    opacity: 0.6,
    fillOpacity: 0.65,
    fillColor: '#2262CC'
};

// ================================================================
// geojson layer
// ================================================================
var dataJSON = L.geoJson(null, {
  style: defaultStyle,
  onEachFeature: function(feature, layer) {
    if (feature.properties) {
      layer.bindPopup("District: <b>" + feature.properties.District + "</b><br />" + "Chapter: <b>" + feature.properties.Chapter + "</b>");

      $("#feature-list tbody").append('<tr class="feature-row" id="' + L.stamp(layer) + '"><td style="vertical-align: middle;"><img width="18" height="18" src="images/check_in.png"></td><td><span class="feature-name">' + layer.feature.properties.District + '</span><br /><small><span class="feature-chapter">' + layer.feature.properties.Chapter + '</span></small></td><td style="vertical-align: middle;"><i class="fa fa-chevron-right pull-right"></i></td></tr>');

      listSearch.push({
        oid: layer.feature.properties.OBJECTID,
        name: layer.feature.properties.District,
        chapter: layer.feature.properties.Chapter,
        source: "dataJSON"
      });
    }
    layer.on({
      mouseover: function (e) {
        var layer = e.target;
        layer.setStyle(highlightStyle);
        if (!L.Browser.ie && !L.Browser.opera) {
          layer.bringToFront();
        }
      },
      mouseout: function (e) {
        dataJSON.resetStyle(e.target);
      }
    })
  }
});


// ================================================================
// Main loader
// ================================================================
queue()
  .defer(d3.json, "data/shapefile/austindistricts.geojson")
  .await(function(error, gjson) {
    dataJSON.addData(gjson);
    map.addLayer(dataJSON);
    map.addLayer(highlight);
    syncSidebar();

    sizeLayerControl();
    finishedLoading();
});

// ================================================================
// grouping data layers
// ================================================================
var groupedOverlay = {
  "Polygon of Interest": {
    "District": dataJSON
  }
}

// ================================================================
// List in Side Panel
// ================================================================
function syncSidebar() {
  // Empty sidebar features
  $("#feature-list tbody").empty();

  // Loop through layer and add only features which are in the map bounds
  dataJSON.eachLayer(function(layer) {
      if (map.getBounds().intersects(layer.getLatLngs())) {
        $("#feature-list tbody").append('<tr class="feature-row" id="' + L.stamp(layer) + '"><td style="vertical-align: middle;"><img width="18" height="18" src="images/check_in.png"></td><td><span class="feature-name">' + layer.feature.properties.District + '</span><br /><small><span class="feature-chapter">' + layer.feature.properties.Chapter + '</span></small></td><td style="vertical-align: middle;"><i class="fa fa-chevron-right pull-right"></i></td></tr>');
      }
  });
  // Update list.js featureList
  featureList = new List("features", {
    valueNames: ["feature-name", "feature-chapter"]
  });
  featureList.sort("feature-chapter", {
    order: "asc"
  });
}

function sidebarClick(id) {
  var layer = dataJSON.getLayer(id);
  //console.log(layer);
  map.fitBounds(layer.getBounds());
  // Hide sidebar and go to the map on small screens
  if (document.body.clientWidth <= 767) {
    $("#sidebar").hide();
    map.invalidateSize();
  }
}

$(document).on("click", ".feature-row", function(e) {
  //$(document).off("mouseout", ".feature-row", clearHighlight);
  sidebarClick(parseInt($(this).attr("id")));
});
$(document).on("mouseover", ".feature-row", function(e) {
  var layer = dataJSON.getLayer($(this).attr("id"));
  highlight.clearLayers().addLayer(L.polygon(layer.getLatLngs(), highlightStyle));
});
$(document).on("mouseout", ".feature-row", function(e){
  highlight.clearLayers();
});
/* Filter sidebar feature list to only show features in current map bounds */
map.on("moveend", function (e) {
  syncSidebar();
  console.log("sync side bar.");
});


// ================================================================
/* Larger screens get expanded layer control and visible sidebar */
// ================================================================
if (document.body.clientWidth <= 767) {
  var isCollapsed = true;
} else {
  var isCollapsed = false;
}
var layerControl = L.control.groupedLayers(baseLayers, groupedOverlay, {
  //collapsed: isCollapsed
}).addTo(map);

// ================================================================
// Leaflet patch to make layer control scrollable on touch browsers
// ================================================================
var container = $(".leaflet-control-layers")[0];
if (!L.Browser.touch) {
  L.DomEvent
    .disableClickPropagation(container)
    .disableScrollPropagation(container);
} else {
  L.DomEvent.disableClickPropagation(container);
}

// ================================================================
/* Navigator and Side bar */
// ================================================================
$("#nav-btn").click(function() {
  $(".navbar-collapse").collapse("toggle");
  return false;
});
$("#sidebar-toggle-btn").click(function() {
  $("#sidebar").toggle();
  map.invalidateSize();
  return false;
});
$("#sidebar-hide-btn").click(function() {
  $('#sidebar').hide();
  map.invalidateSize();
});
$("#panel-btn").click(function() {
  $('#sidebar').toggle();
  map.invalidateSize();
  return false;
});

// ================================================================
// Map Tools Settings
// ================================================================
/* Print */
$("#print-btn").click(function() {
  $("#map").print({
    stylesheet: "../css/bootmap.css"
  });
  $(".navbar-collapse.in").collapse("hide");
  return false;
});
/* Map Tools - all top left tools */
$("#tools-btn").click(function() {
  $('.leaflet-top.leaflet-left').toggle();
  return false;
});
/* Draw Tools */
$("#draw-btn").click(function() {
  $('.leaflet-draw').toggle();
  return false;
});
/* Distance measurement (require Leaflet.Draw) */
$("#distance-btn").click(function() {
  $('.leaflet-control-draw-measure').toggle();
  return false;
});
/* Upload tool */
$("#upload-btn").click(function() {
  $('.leaflet-control-filelayer').toggle();
  return false;
});
// Lat Long
var mousemove = document.getElementById('mousemove');
map.on('mousemove', function(e) {
  //console.log('checking');
  window[e.type].innerHTML = e.latlng.toString() + " Zoom:" + map.getZoom();
});

// ================================================================
// Modal - About, Checklist, Feature
// ================================================================
$("#about-btn").click(function() {
  $("#aboutModal").modal("show");
  $(".navbar-collapse.in").collapse("hide");
  return false;
});
