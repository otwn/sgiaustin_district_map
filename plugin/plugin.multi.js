/* global L */

// A layer control which provides for layer groupings.
// Author: Ishmael Smyrnow
L.Control.GroupedLayers = L.Control.extend({

  options: {
    collapsed: true,
    position: 'topright',
    autoZIndex: true,
    exclusiveGroups: []
  },

  initialize: function (baseLayers, groupedOverlays, options) {
    var i, j;
    L.Util.setOptions(this, options);

    this._layers = {};
    this._lastZIndex = 0;
    this._handlingClick = false;
    this._groupList = [];
    this._domGroups = [];

    for (i in baseLayers) {
      this._addLayer(baseLayers[i], i);
    }

    for (i in groupedOverlays) {
      for (var j in groupedOverlays[i]) {
        this._addLayer(groupedOverlays[i][j], j, i, true);
      }
    }
  },

  onAdd: function (map) {
    this._initLayout();
    this._update();

    map
        .on('layeradd', this._onLayerChange, this)
        .on('layerremove', this._onLayerChange, this);

    return this._container;
  },

  onRemove: function (map) {
    map
        .off('layeradd', this._onLayerChange)
        .off('layerremove', this._onLayerChange);
  },

  addBaseLayer: function (layer, name) {
    this._addLayer(layer, name);
    this._update();
    return this;
  },

  addOverlay: function (layer, name, group) {
    this._addLayer(layer, name, group, true);
    this._update();
    return this;
  },

  removeLayer: function (layer) {
    var id = L.Util.stamp(layer);
    delete this._layers[id];
    this._update();
    return this;
  },

  _initLayout: function () {
    var className = 'leaflet-control-layers',
        container = this._container = L.DomUtil.create('div', className);

    //Makes this work on IE10 Touch devices by stopping it from firing a mouseout event when the touch is released
    container.setAttribute('aria-haspopup', true);

    if (!L.Browser.touch) {
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(container, 'wheel', L.DomEvent.stopPropagation);
    } else {
      L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
    }

    var form = this._form = L.DomUtil.create('form', className + '-list');

    if (this.options.collapsed) {
      if (!L.Browser.android) {
        L.DomEvent
            .on(container, 'mouseover', this._expand, this)
            .on(container, 'mouseout', this._collapse, this);
      }
      var link = this._layersLink = L.DomUtil.create('a', className + '-toggle', container);
      link.href = '#';
      link.title = 'Layers';

      if (L.Browser.touch) {
        L.DomEvent
            .on(link, 'click', L.DomEvent.stop)
            .on(link, 'click', this._expand, this);
      }
      else {
        L.DomEvent.on(link, 'focus', this._expand, this);
      }

      this._map.on('click', this._collapse, this);
      // TODO keyboard accessibility
    } else {
      this._expand();
    }

    this._baseLayersList = L.DomUtil.create('div', className + '-base', form);
    this._separator = L.DomUtil.create('div', className + '-separator', form);
    this._overlaysList = L.DomUtil.create('div', className + '-overlays', form);

    container.appendChild(form);
  },

  _addLayer: function (layer, name, group, overlay) {
    var id = L.Util.stamp(layer);

    this._layers[id] = {
      layer: layer,
      name: name,
      overlay: overlay
    };

    group = group || '';
    var groupId = this._groupList.indexOf(group);

    if (groupId === -1) {
      groupId = this._groupList.push(group) - 1;
    }

    var exclusive = (this.options.exclusiveGroups.indexOf(group) != -1);

    this._layers[id].group = {
      name: group,
      id: groupId,
      exclusive: exclusive
    };

    if (this.options.autoZIndex && layer.setZIndex) {
      this._lastZIndex++;
      layer.setZIndex(this._lastZIndex);
    }
  },

  _update: function () {
    if (!this._container) {
      return;
    }

    this._baseLayersList.innerHTML = '';
    this._overlaysList.innerHTML = '';
    this._domGroups.length = 0;

    var baseLayersPresent = false,
        overlaysPresent = false,
        i, obj;

    for (i in this._layers) {
      obj = this._layers[i];
      this._addItem(obj);
      overlaysPresent = overlaysPresent || obj.overlay;
      baseLayersPresent = baseLayersPresent || !obj.overlay;
    }

    this._separator.style.display = overlaysPresent && baseLayersPresent ? '' : 'none';
  },

  _onLayerChange: function (e) {
    var obj = this._layers[L.Util.stamp(e.layer)];

    if (!obj) { return; }

    if (!this._handlingClick) {
      this._update();
    }

    var type = obj.overlay ?
      (e.type === 'layeradd' ? 'overlayadd' : 'overlayremove') :
      (e.type === 'layeradd' ? 'baselayerchange' : null);

    if (type) {
      this._map.fire(type, obj);
    }
  },

  // IE7 bugs out if you create a radio dynamically, so you have to do it this hacky way (see http://bit.ly/PqYLBe)
  _createRadioElement: function (name, checked) {

    var radioHtml = '<input type="radio" class="leaflet-control-layers-selector" name="' + name + '"';
    if (checked) {
      radioHtml += ' checked="checked"';
    }
    radioHtml += '/>';

    var radioFragment = document.createElement('div');
    radioFragment.innerHTML = radioHtml;

    return radioFragment.firstChild;
  },

  _addItem: function (obj) {
    var label = document.createElement('label'),
        input,
        checked = this._map.hasLayer(obj.layer),
        container;

    if (obj.overlay) {
      if (obj.group.exclusive) {
        groupRadioName = 'leaflet-exclusive-group-layer-' + obj.group.id;
        input = this._createRadioElement(groupRadioName, checked);
      } else {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'leaflet-control-layers-selector';
        input.defaultChecked = checked;
      }
    } else {
      input = this._createRadioElement('leaflet-base-layers', checked);
    }

    input.layerId = L.Util.stamp(obj.layer);

    L.DomEvent.on(input, 'click', this._onInputClick, this);

    var name = document.createElement('span');
    name.innerHTML = ' ' + obj.name;

    label.appendChild(input);
    label.appendChild(name);

    if (obj.overlay) {
      container = this._overlaysList;

      var groupContainer = this._domGroups[obj.group.id];

      // Create the group container if it doesn't exist
      if (!groupContainer) {
        groupContainer = document.createElement('div');
        groupContainer.className = 'leaflet-control-layers-group';
        groupContainer.id = 'leaflet-control-layers-group-' + obj.group.id;

        var groupLabel = document.createElement('span');
        groupLabel.className = 'leaflet-control-layers-group-name';
        groupLabel.innerHTML = obj.group.name;

        groupContainer.appendChild(groupLabel);
        container.appendChild(groupContainer);

        this._domGroups[obj.group.id] = groupContainer;
      }

      container = groupContainer;
    } else {
      container = this._baseLayersList;
    }

    container.appendChild(label);

    return label;
  },

  _onInputClick: function () {
    var i, input, obj,
        inputs = this._form.getElementsByTagName('input'),
        inputsLen = inputs.length;

    this._handlingClick = true;

    for (i = 0; i < inputsLen; i++) {
      input = inputs[i];
      obj = this._layers[input.layerId];

      if (input.checked && !this._map.hasLayer(obj.layer)) {
        this._map.addLayer(obj.layer);

      } else if (!input.checked && this._map.hasLayer(obj.layer)) {
        this._map.removeLayer(obj.layer);
      }
    }

    this._handlingClick = false;
  },

  _expand: function () {
    L.DomUtil.addClass(this._container, 'leaflet-control-layers-expanded');
  },

  _collapse: function () {
    this._container.className = this._container.className.replace(' leaflet-control-layers-expanded', '');
  }
});

L.control.groupedLayers = function (baseLayers, groupedOverlays, options) {
  return new L.Control.GroupedLayers(baseLayers, groupedOverlays, options);
};


(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(["leaflet"], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(require('leaflet'));
  } else {
    root.L.Control.DefaultExtent = factory(root.L);
  }
}(this, function(L) {

return (function () {
  /* global L */
  'use strict';
  L.Control.DefaultExtent = L.Control.extend({
    options: {
      position: 'topleft',
      text: 'Default Extent',
      title: 'Zoom to default extent',
      className: 'leaflet-control-defaultextent'
    },
    onAdd: function (map) {
      this._map = map;
      return this._initLayout();
    },
    setCenter: function (center) {
      this._center = center;
      return this;
    },
    setZoom: function (zoom) {
      this._zoom = zoom;
      return this;
    },
    _initLayout: function () {
      var container = L.DomUtil.create('div', 'leaflet-bar ' +
        this.options.className);
      this._container = container;
      this._fullExtentButton = this._createExtentButton(container);

      L.DomEvent.disableClickPropagation(container);

      this._map.whenReady(this._whenReady, this);

      return this._container;
    },
    _createExtentButton: function () {
      var link = L.DomUtil.create('a', this.options.className + '-toggle',
        this._container);
      link.href = '#';
      link.innerHTML = this.options.text;
      link.title = this.options.title;

      L.DomEvent
        .on(link, 'mousedown dblclick', L.DomEvent.stopPropagation)
        .on(link, 'click', L.DomEvent.stop)
        .on(link, 'click', this._zoomToDefault, this);
      return link;
    },
    _whenReady: function () {
      if (!this._center) {
        this._center = this._map.getCenter();
      }
      if (!this._zoom) {
        this._zoom = this._map.getZoom();
      }
      return this;
    },
    _zoomToDefault: function () {
      this._map.setView(this._center, this._zoom);
    }
  });

  L.Map.addInitHook(function () {
    if (this.options.defaultExtentControl) {
      this.addControl(new L.Control.DefaultExtent());
    }
  });

  L.control.defaultExtent = function (options) {
    return new L.Control.DefaultExtent(options);
  };

  return L.Control.DefaultExtent;

}());
;

}));

/*
 Leaflet.markercluster, Provides Beautiful Animated Marker Clustering functionality for Leaflet, a JS library for interactive maps.
 https://github.com/Leaflet/Leaflet.markercluster
 (c) 2012-2013, Dave Leaver, smartrak
*/
!function(t,e){L.MarkerClusterGroup=L.FeatureGroup.extend({options:{maxClusterRadius:80,iconCreateFunction:null,spiderfyOnMaxZoom:!0,showCoverageOnHover:!0,zoomToBoundsOnClick:!0,singleMarkerMode:!1,disableClusteringAtZoom:null,removeOutsideVisibleBounds:!0,animateAddingMarkers:!1,spiderfyDistanceMultiplier:1,polygonOptions:{}},initialize:function(t){L.Util.setOptions(this,t),this.options.iconCreateFunction||(this.options.iconCreateFunction=this._defaultIconCreateFunction),this._featureGroup=L.featureGroup(),this._featureGroup.on(L.FeatureGroup.EVENTS,this._propagateEvent,this),this._nonPointGroup=L.featureGroup(),this._nonPointGroup.on(L.FeatureGroup.EVENTS,this._propagateEvent,this),this._inZoomAnimation=0,this._needsClustering=[],this._needsRemoving=[],this._currentShownBounds=null,this._queue=[]},addLayer:function(t){if(t instanceof L.LayerGroup){var e=[];for(var i in t._layers)e.push(t._layers[i]);return this.addLayers(e)}if(!t.getLatLng)return this._nonPointGroup.addLayer(t),this;if(!this._map)return this._needsClustering.push(t),this;if(this.hasLayer(t))return this;this._unspiderfy&&this._unspiderfy(),this._addLayer(t,this._maxZoom);var n=t,s=this._map.getZoom();if(t.__parent)for(;n.__parent._zoom>=s;)n=n.__parent;return this._currentShownBounds.contains(n.getLatLng())&&(this.options.animateAddingMarkers?this._animationAddLayer(t,n):this._animationAddLayerNonAnimated(t,n)),this},removeLayer:function(t){if(t instanceof L.LayerGroup){var e=[];for(var i in t._layers)e.push(t._layers[i]);return this.removeLayers(e)}return t.getLatLng?this._map?t.__parent?(this._unspiderfy&&(this._unspiderfy(),this._unspiderfyLayer(t)),this._removeLayer(t,!0),this._featureGroup.hasLayer(t)&&(this._featureGroup.removeLayer(t),t.setOpacity&&t.setOpacity(1)),this):this:(!this._arraySplice(this._needsClustering,t)&&this.hasLayer(t)&&this._needsRemoving.push(t),this):(this._nonPointGroup.removeLayer(t),this)},addLayers:function(t){var e,i,n,s=this._map,r=this._featureGroup,o=this._nonPointGroup;for(e=0,i=t.length;i>e;e++)if(n=t[e],n.getLatLng){if(!this.hasLayer(n))if(s){if(this._addLayer(n,this._maxZoom),n.__parent&&2===n.__parent.getChildCount()){var a=n.__parent.getAllChildMarkers(),h=a[0]===n?a[1]:a[0];r.removeLayer(h)}}else this._needsClustering.push(n)}else o.addLayer(n);return s&&(r.eachLayer(function(t){t instanceof L.MarkerCluster&&t._iconNeedsUpdate&&t._updateIcon()}),this._topClusterLevel._recursivelyAddChildrenToMap(null,this._zoom,this._currentShownBounds)),this},removeLayers:function(t){var e,i,n,s=this._featureGroup,r=this._nonPointGroup;if(!this._map){for(e=0,i=t.length;i>e;e++)n=t[e],this._arraySplice(this._needsClustering,n),r.removeLayer(n);return this}for(e=0,i=t.length;i>e;e++)n=t[e],n.__parent?(this._removeLayer(n,!0,!0),s.hasLayer(n)&&(s.removeLayer(n),n.setOpacity&&n.setOpacity(1))):r.removeLayer(n);return this._topClusterLevel._recursivelyAddChildrenToMap(null,this._zoom,this._currentShownBounds),s.eachLayer(function(t){t instanceof L.MarkerCluster&&t._updateIcon()}),this},clearLayers:function(){return this._map||(this._needsClustering=[],delete this._gridClusters,delete this._gridUnclustered),this._noanimationUnspiderfy&&this._noanimationUnspiderfy(),this._featureGroup.clearLayers(),this._nonPointGroup.clearLayers(),this.eachLayer(function(t){delete t.__parent}),this._map&&this._generateInitialClusters(),this},getBounds:function(){var t=new L.LatLngBounds;if(this._topClusterLevel)t.extend(this._topClusterLevel._bounds);else for(var e=this._needsClustering.length-1;e>=0;e--)t.extend(this._needsClustering[e].getLatLng());return t.extend(this._nonPointGroup.getBounds()),t},eachLayer:function(t,e){var i,n=this._needsClustering.slice();for(this._topClusterLevel&&this._topClusterLevel.getAllChildMarkers(n),i=n.length-1;i>=0;i--)t.call(e,n[i]);this._nonPointGroup.eachLayer(t,e)},getLayers:function(){var t=[];return this.eachLayer(function(e){t.push(e)}),t},getLayer:function(t){var e=null;return this.eachLayer(function(i){L.stamp(i)===t&&(e=i)}),e},hasLayer:function(t){if(!t)return!1;var e,i=this._needsClustering;for(e=i.length-1;e>=0;e--)if(i[e]===t)return!0;for(i=this._needsRemoving,e=i.length-1;e>=0;e--)if(i[e]===t)return!1;return!(!t.__parent||t.__parent._group!==this)||this._nonPointGroup.hasLayer(t)},zoomToShowLayer:function(t,e){var i=function(){if((t._icon||t.__parent._icon)&&!this._inZoomAnimation)if(this._map.off("moveend",i,this),this.off("animationend",i,this),t._icon)e();else if(t.__parent._icon){var n=function(){this.off("spiderfied",n,this),e()};this.on("spiderfied",n,this),t.__parent.spiderfy()}};t._icon&&this._map.getBounds().contains(t.getLatLng())?e():t.__parent._zoom<this._map.getZoom()?(this._map.on("moveend",i,this),this._map.panTo(t.getLatLng())):(this._map.on("moveend",i,this),this.on("animationend",i,this),this._map.setView(t.getLatLng(),t.__parent._zoom+1),t.__parent.zoomToBounds())},onAdd:function(t){this._map=t;var e,i,n;if(!isFinite(this._map.getMaxZoom()))throw"Map has no maxZoom specified";for(this._featureGroup.onAdd(t),this._nonPointGroup.onAdd(t),this._gridClusters||this._generateInitialClusters(),e=0,i=this._needsRemoving.length;i>e;e++)n=this._needsRemoving[e],this._removeLayer(n,!0);for(this._needsRemoving=[],e=0,i=this._needsClustering.length;i>e;e++)n=this._needsClustering[e],n.getLatLng?n.__parent||this._addLayer(n,this._maxZoom):this._featureGroup.addLayer(n);this._needsClustering=[],this._map.on("zoomend",this._zoomEnd,this),this._map.on("moveend",this._moveEnd,this),this._spiderfierOnAdd&&this._spiderfierOnAdd(),this._bindEvents(),this._zoom=this._map.getZoom(),this._currentShownBounds=this._getExpandedVisibleBounds(),this._topClusterLevel._recursivelyAddChildrenToMap(null,this._zoom,this._currentShownBounds)},onRemove:function(t){t.off("zoomend",this._zoomEnd,this),t.off("moveend",this._moveEnd,this),this._unbindEvents(),this._map._mapPane.className=this._map._mapPane.className.replace(" leaflet-cluster-anim",""),this._spiderfierOnRemove&&this._spiderfierOnRemove(),this._hideCoverage(),this._featureGroup.onRemove(t),this._nonPointGroup.onRemove(t),this._featureGroup.clearLayers(),this._map=null},getVisibleParent:function(t){for(var e=t;e&&!e._icon;)e=e.__parent;return e||null},_arraySplice:function(t,e){for(var i=t.length-1;i>=0;i--)if(t[i]===e)return t.splice(i,1),!0},_removeLayer:function(t,e,i){var n=this._gridClusters,s=this._gridUnclustered,r=this._featureGroup,o=this._map;if(e)for(var a=this._maxZoom;a>=0&&s[a].removeObject(t,o.project(t.getLatLng(),a));a--);var h,_=t.__parent,u=_._markers;for(this._arraySplice(u,t);_&&(_._childCount--,!(_._zoom<0));)e&&_._childCount<=1?(h=_._markers[0]===t?_._markers[1]:_._markers[0],n[_._zoom].removeObject(_,o.project(_._cLatLng,_._zoom)),s[_._zoom].addObject(h,o.project(h.getLatLng(),_._zoom)),this._arraySplice(_.__parent._childClusters,_),_.__parent._markers.push(h),h.__parent=_.__parent,_._icon&&(r.removeLayer(_),i||r.addLayer(h))):(_._recalculateBounds(),i&&_._icon||_._updateIcon()),_=_.__parent;delete t.__parent},_isOrIsParent:function(t,e){for(;e;){if(t===e)return!0;e=e.parentNode}return!1},_propagateEvent:function(t){if(t.layer instanceof L.MarkerCluster){if(t.originalEvent&&this._isOrIsParent(t.layer._icon,t.originalEvent.relatedTarget))return;t.type="cluster"+t.type}this.fire(t.type,t)},_defaultIconCreateFunction:function(t){var e=t.getChildCount(),i=" marker-cluster-";return i+=10>e?"small":100>e?"medium":"large",new L.DivIcon({html:"<div><span>"+e+"</span></div>",className:"marker-cluster"+i,iconSize:new L.Point(40,40)})},_bindEvents:function(){var t=this._map,e=this.options.spiderfyOnMaxZoom,i=this.options.showCoverageOnHover,n=this.options.zoomToBoundsOnClick;(e||n)&&this.on("clusterclick",this._zoomOrSpiderfy,this),i&&(this.on("clustermouseover",this._showCoverage,this),this.on("clustermouseout",this._hideCoverage,this),t.on("zoomend",this._hideCoverage,this))},_zoomOrSpiderfy:function(t){var e=this._map;e.getMaxZoom()===e.getZoom()?this.options.spiderfyOnMaxZoom&&t.layer.spiderfy():this.options.zoomToBoundsOnClick&&t.layer.zoomToBounds(),t.originalEvent&&13===t.originalEvent.keyCode&&e._container.focus()},_showCoverage:function(t){var e=this._map;this._inZoomAnimation||(this._shownPolygon&&e.removeLayer(this._shownPolygon),t.layer.getChildCount()>2&&t.layer!==this._spiderfied&&(this._shownPolygon=new L.Polygon(t.layer.getConvexHull(),this.options.polygonOptions),e.addLayer(this._shownPolygon)))},_hideCoverage:function(){this._shownPolygon&&(this._map.removeLayer(this._shownPolygon),this._shownPolygon=null)},_unbindEvents:function(){var t=this.options.spiderfyOnMaxZoom,e=this.options.showCoverageOnHover,i=this.options.zoomToBoundsOnClick,n=this._map;(t||i)&&this.off("clusterclick",this._zoomOrSpiderfy,this),e&&(this.off("clustermouseover",this._showCoverage,this),this.off("clustermouseout",this._hideCoverage,this),n.off("zoomend",this._hideCoverage,this))},_zoomEnd:function(){this._map&&(this._mergeSplitClusters(),this._zoom=this._map._zoom,this._currentShownBounds=this._getExpandedVisibleBounds())},_moveEnd:function(){if(!this._inZoomAnimation){var t=this._getExpandedVisibleBounds();this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,this._zoom,t),this._topClusterLevel._recursivelyAddChildrenToMap(null,this._map._zoom,t),this._currentShownBounds=t}},_generateInitialClusters:function(){var t=this._map.getMaxZoom(),e=this.options.maxClusterRadius;this.options.disableClusteringAtZoom&&(t=this.options.disableClusteringAtZoom-1),this._maxZoom=t,this._gridClusters={},this._gridUnclustered={};for(var i=t;i>=0;i--)this._gridClusters[i]=new L.DistanceGrid(e),this._gridUnclustered[i]=new L.DistanceGrid(e);this._topClusterLevel=new L.MarkerCluster(this,-1)},_addLayer:function(t,e){var i,n,s=this._gridClusters,r=this._gridUnclustered;for(this.options.singleMarkerMode&&(t.options.icon=this.options.iconCreateFunction({getChildCount:function(){return 1},getAllChildMarkers:function(){return[t]}}));e>=0;e--){i=this._map.project(t.getLatLng(),e);var o=s[e].getNearObject(i);if(o)return o._addChild(t),t.__parent=o,void 0;if(o=r[e].getNearObject(i)){var a=o.__parent;a&&this._removeLayer(o,!1);var h=new L.MarkerCluster(this,e,o,t);s[e].addObject(h,this._map.project(h._cLatLng,e)),o.__parent=h,t.__parent=h;var _=h;for(n=e-1;n>a._zoom;n--)_=new L.MarkerCluster(this,n,_),s[n].addObject(_,this._map.project(o.getLatLng(),n));for(a._addChild(_),n=e;n>=0&&r[n].removeObject(o,this._map.project(o.getLatLng(),n));n--);return}r[e].addObject(t,i)}this._topClusterLevel._addChild(t),t.__parent=this._topClusterLevel},_enqueue:function(t){this._queue.push(t),this._queueTimeout||(this._queueTimeout=setTimeout(L.bind(this._processQueue,this),300))},_processQueue:function(){for(var t=0;t<this._queue.length;t++)this._queue[t].call(this);this._queue.length=0,clearTimeout(this._queueTimeout),this._queueTimeout=null},_mergeSplitClusters:function(){this._processQueue(),this._zoom<this._map._zoom&&this._currentShownBounds.contains(this._getExpandedVisibleBounds())?(this._animationStart(),this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,this._zoom,this._getExpandedVisibleBounds()),this._animationZoomIn(this._zoom,this._map._zoom)):this._zoom>this._map._zoom?(this._animationStart(),this._animationZoomOut(this._zoom,this._map._zoom)):this._moveEnd()},_getExpandedVisibleBounds:function(){if(!this.options.removeOutsideVisibleBounds)return this.getBounds();var t=this._map,e=t.getBounds(),i=e._southWest,n=e._northEast,s=L.Browser.mobile?0:Math.abs(i.lat-n.lat),r=L.Browser.mobile?0:Math.abs(i.lng-n.lng);return new L.LatLngBounds(new L.LatLng(i.lat-s,i.lng-r,!0),new L.LatLng(n.lat+s,n.lng+r,!0))},_animationAddLayerNonAnimated:function(t,e){if(e===t)this._featureGroup.addLayer(t);else if(2===e._childCount){e._addToMap();var i=e.getAllChildMarkers();this._featureGroup.removeLayer(i[0]),this._featureGroup.removeLayer(i[1])}else e._updateIcon()}}),L.MarkerClusterGroup.include(L.DomUtil.TRANSITION?{_animationStart:function(){this._map._mapPane.className+=" leaflet-cluster-anim",this._inZoomAnimation++},_animationEnd:function(){this._map&&(this._map._mapPane.className=this._map._mapPane.className.replace(" leaflet-cluster-anim","")),this._inZoomAnimation--,this.fire("animationend")},_animationZoomIn:function(t,e){var i,n=this._getExpandedVisibleBounds(),s=this._featureGroup;this._topClusterLevel._recursively(n,t,0,function(r){var o,a=r._latlng,h=r._markers;for(n.contains(a)||(a=null),r._isSingleParent()&&t+1===e?(s.removeLayer(r),r._recursivelyAddChildrenToMap(null,e,n)):(r.setOpacity(0),r._recursivelyAddChildrenToMap(a,e,n)),i=h.length-1;i>=0;i--)o=h[i],n.contains(o._latlng)||s.removeLayer(o)}),this._forceLayout(),this._topClusterLevel._recursivelyBecomeVisible(n,e),s.eachLayer(function(t){t instanceof L.MarkerCluster||!t._icon||t.setOpacity(1)}),this._topClusterLevel._recursively(n,t,e,function(t){t._recursivelyRestoreChildPositions(e)}),this._enqueue(function(){this._topClusterLevel._recursively(n,t,0,function(t){s.removeLayer(t),t.setOpacity(1)}),this._animationEnd()})},_animationZoomOut:function(t,e){this._animationZoomOutSingle(this._topClusterLevel,t-1,e),this._topClusterLevel._recursivelyAddChildrenToMap(null,e,this._getExpandedVisibleBounds()),this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,t,this._getExpandedVisibleBounds())},_animationZoomOutSingle:function(t,e,i){var n=this._getExpandedVisibleBounds();t._recursivelyAnimateChildrenInAndAddSelfToMap(n,e+1,i);var s=this;this._forceLayout(),t._recursivelyBecomeVisible(n,i),this._enqueue(function(){if(1===t._childCount){var r=t._markers[0];r.setLatLng(r.getLatLng()),r.setOpacity(1)}else t._recursively(n,i,0,function(t){t._recursivelyRemoveChildrenFromMap(n,e+1)});s._animationEnd()})},_animationAddLayer:function(t,e){var i=this,n=this._featureGroup;n.addLayer(t),e!==t&&(e._childCount>2?(e._updateIcon(),this._forceLayout(),this._animationStart(),t._setPos(this._map.latLngToLayerPoint(e.getLatLng())),t.setOpacity(0),this._enqueue(function(){n.removeLayer(t),t.setOpacity(1),i._animationEnd()})):(this._forceLayout(),i._animationStart(),i._animationZoomOutSingle(e,this._map.getMaxZoom(),this._map.getZoom())))},_forceLayout:function(){L.Util.falseFn(e.body.offsetWidth)}}:{_animationStart:function(){},_animationZoomIn:function(t,e){this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,t),this._topClusterLevel._recursivelyAddChildrenToMap(null,e,this._getExpandedVisibleBounds())},_animationZoomOut:function(t,e){this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,t),this._topClusterLevel._recursivelyAddChildrenToMap(null,e,this._getExpandedVisibleBounds())},_animationAddLayer:function(t,e){this._animationAddLayerNonAnimated(t,e)}}),L.markerClusterGroup=function(t){return new L.MarkerClusterGroup(t)},L.MarkerCluster=L.Marker.extend({initialize:function(t,e,i,n){L.Marker.prototype.initialize.call(this,i?i._cLatLng||i.getLatLng():new L.LatLng(0,0),{icon:this}),this._group=t,this._zoom=e,this._markers=[],this._childClusters=[],this._childCount=0,this._iconNeedsUpdate=!0,this._bounds=new L.LatLngBounds,i&&this._addChild(i),n&&this._addChild(n)},getAllChildMarkers:function(t){t=t||[];for(var e=this._childClusters.length-1;e>=0;e--)this._childClusters[e].getAllChildMarkers(t);for(var i=this._markers.length-1;i>=0;i--)t.push(this._markers[i]);return t},getChildCount:function(){return this._childCount},zoomToBounds:function(){for(var t,e=this._childClusters.slice(),i=this._group._map,n=i.getBoundsZoom(this._bounds),s=this._zoom+1,r=i.getZoom();e.length>0&&n>s;){s++;var o=[];for(t=0;t<e.length;t++)o=o.concat(e[t]._childClusters);e=o}n>s?this._group._map.setView(this._latlng,s):r>=n?this._group._map.setView(this._latlng,r+1):this._group._map.fitBounds(this._bounds)},getBounds:function(){var t=new L.LatLngBounds;return t.extend(this._bounds),t},_updateIcon:function(){this._iconNeedsUpdate=!0,this._icon&&this.setIcon(this)},createIcon:function(){return this._iconNeedsUpdate&&(this._iconObj=this._group.options.iconCreateFunction(this),this._iconNeedsUpdate=!1),this._iconObj.createIcon()},createShadow:function(){return this._iconObj.createShadow()},_addChild:function(t,e){this._iconNeedsUpdate=!0,this._expandBounds(t),t instanceof L.MarkerCluster?(e||(this._childClusters.push(t),t.__parent=this),this._childCount+=t._childCount):(e||this._markers.push(t),this._childCount++),this.__parent&&this.__parent._addChild(t,!0)},_expandBounds:function(t){var e,i=t._wLatLng||t._latlng;t instanceof L.MarkerCluster?(this._bounds.extend(t._bounds),e=t._childCount):(this._bounds.extend(i),e=1),this._cLatLng||(this._cLatLng=t._cLatLng||i);var n=this._childCount+e;this._wLatLng?(this._wLatLng.lat=(i.lat*e+this._wLatLng.lat*this._childCount)/n,this._wLatLng.lng=(i.lng*e+this._wLatLng.lng*this._childCount)/n):this._latlng=this._wLatLng=new L.LatLng(i.lat,i.lng)},_addToMap:function(t){t&&(this._backupLatlng=this._latlng,this.setLatLng(t)),this._group._featureGroup.addLayer(this)},_recursivelyAnimateChildrenIn:function(t,e,i){this._recursively(t,0,i-1,function(t){var i,n,s=t._markers;for(i=s.length-1;i>=0;i--)n=s[i],n._icon&&(n._setPos(e),n.setOpacity(0))},function(t){var i,n,s=t._childClusters;for(i=s.length-1;i>=0;i--)n=s[i],n._icon&&(n._setPos(e),n.setOpacity(0))})},_recursivelyAnimateChildrenInAndAddSelfToMap:function(t,e,i){this._recursively(t,i,0,function(n){n._recursivelyAnimateChildrenIn(t,n._group._map.latLngToLayerPoint(n.getLatLng()).round(),e),n._isSingleParent()&&e-1===i?(n.setOpacity(1),n._recursivelyRemoveChildrenFromMap(t,e)):n.setOpacity(0),n._addToMap()})},_recursivelyBecomeVisible:function(t,e){this._recursively(t,0,e,null,function(t){t.setOpacity(1)})},_recursivelyAddChildrenToMap:function(t,e,i){this._recursively(i,-1,e,function(n){if(e!==n._zoom)for(var s=n._markers.length-1;s>=0;s--){var r=n._markers[s];i.contains(r._latlng)&&(t&&(r._backupLatlng=r.getLatLng(),r.setLatLng(t),r.setOpacity&&r.setOpacity(0)),n._group._featureGroup.addLayer(r))}},function(e){e._addToMap(t)})},_recursivelyRestoreChildPositions:function(t){for(var e=this._markers.length-1;e>=0;e--){var i=this._markers[e];i._backupLatlng&&(i.setLatLng(i._backupLatlng),delete i._backupLatlng)}if(t-1===this._zoom)for(var n=this._childClusters.length-1;n>=0;n--)this._childClusters[n]._restorePosition();else for(var s=this._childClusters.length-1;s>=0;s--)this._childClusters[s]._recursivelyRestoreChildPositions(t)},_restorePosition:function(){this._backupLatlng&&(this.setLatLng(this._backupLatlng),delete this._backupLatlng)},_recursivelyRemoveChildrenFromMap:function(t,e,i){var n,s;this._recursively(t,-1,e-1,function(t){for(s=t._markers.length-1;s>=0;s--)n=t._markers[s],i&&i.contains(n._latlng)||(t._group._featureGroup.removeLayer(n),n.setOpacity&&n.setOpacity(1))},function(t){for(s=t._childClusters.length-1;s>=0;s--)n=t._childClusters[s],i&&i.contains(n._latlng)||(t._group._featureGroup.removeLayer(n),n.setOpacity&&n.setOpacity(1))})},_recursively:function(t,e,i,n,s){var r,o,a=this._childClusters,h=this._zoom;if(e>h)for(r=a.length-1;r>=0;r--)o=a[r],t.intersects(o._bounds)&&o._recursively(t,e,i,n,s);else if(n&&n(this),s&&this._zoom===i&&s(this),i>h)for(r=a.length-1;r>=0;r--)o=a[r],t.intersects(o._bounds)&&o._recursively(t,e,i,n,s)},_recalculateBounds:function(){var t,e=this._markers,i=this._childClusters;for(this._bounds=new L.LatLngBounds,delete this._wLatLng,t=e.length-1;t>=0;t--)this._expandBounds(e[t]);for(t=i.length-1;t>=0;t--)this._expandBounds(i[t])},_isSingleParent:function(){return this._childClusters.length>0&&this._childClusters[0]._childCount===this._childCount}}),L.DistanceGrid=function(t){this._cellSize=t,this._sqCellSize=t*t,this._grid={},this._objectPoint={}},L.DistanceGrid.prototype={addObject:function(t,e){var i=this._getCoord(e.x),n=this._getCoord(e.y),s=this._grid,r=s[n]=s[n]||{},o=r[i]=r[i]||[],a=L.Util.stamp(t);this._objectPoint[a]=e,o.push(t)},updateObject:function(t,e){this.removeObject(t),this.addObject(t,e)},removeObject:function(t,e){var i,n,s=this._getCoord(e.x),r=this._getCoord(e.y),o=this._grid,a=o[r]=o[r]||{},h=a[s]=a[s]||[];for(delete this._objectPoint[L.Util.stamp(t)],i=0,n=h.length;n>i;i++)if(h[i]===t)return h.splice(i,1),1===n&&delete a[s],!0},eachObject:function(t,e){var i,n,s,r,o,a,h,_=this._grid;for(i in _){o=_[i];for(n in o)for(a=o[n],s=0,r=a.length;r>s;s++)h=t.call(e,a[s]),h&&(s--,r--)}},getNearObject:function(t){var e,i,n,s,r,o,a,h,_=this._getCoord(t.x),u=this._getCoord(t.y),l=this._objectPoint,d=this._sqCellSize,p=null;for(e=u-1;u+1>=e;e++)if(s=this._grid[e])for(i=_-1;_+1>=i;i++)if(r=s[i])for(n=0,o=r.length;o>n;n++)a=r[n],h=this._sqDist(l[L.Util.stamp(a)],t),d>h&&(d=h,p=a);return p},_getCoord:function(t){return Math.floor(t/this._cellSize)},_sqDist:function(t,e){var i=e.x-t.x,n=e.y-t.y;return i*i+n*n}},function(){L.QuickHull={getDistant:function(t,e){var i=e[1].lat-e[0].lat,n=e[0].lng-e[1].lng;return n*(t.lat-e[0].lat)+i*(t.lng-e[0].lng)},findMostDistantPointFromBaseLine:function(t,e){var i,n,s,r=0,o=null,a=[];for(i=e.length-1;i>=0;i--)n=e[i],s=this.getDistant(n,t),s>0&&(a.push(n),s>r&&(r=s,o=n));return{maxPoint:o,newPoints:a}},buildConvexHull:function(t,e){var i=[],n=this.findMostDistantPointFromBaseLine(t,e);return n.maxPoint?(i=i.concat(this.buildConvexHull([t[0],n.maxPoint],n.newPoints)),i=i.concat(this.buildConvexHull([n.maxPoint,t[1]],n.newPoints))):[t[0]]},getConvexHull:function(t){var e,i=!1,n=!1,s=null,r=null;for(e=t.length-1;e>=0;e--){var o=t[e];(i===!1||o.lat>i)&&(s=o,i=o.lat),(n===!1||o.lat<n)&&(r=o,n=o.lat)}var a=[].concat(this.buildConvexHull([r,s],t),this.buildConvexHull([s,r],t));return a}}}(),L.MarkerCluster.include({getConvexHull:function(){var t,e,i=this.getAllChildMarkers(),n=[];for(e=i.length-1;e>=0;e--)t=i[e].getLatLng(),n.push(t);return L.QuickHull.getConvexHull(n)}}),L.MarkerCluster.include({_2PI:2*Math.PI,_circleFootSeparation:25,_circleStartAngle:Math.PI/6,_spiralFootSeparation:28,_spiralLengthStart:11,_spiralLengthFactor:5,_circleSpiralSwitchover:9,spiderfy:function(){if(this._group._spiderfied!==this&&!this._group._inZoomAnimation){var t,e=this.getAllChildMarkers(),i=this._group,n=i._map,s=n.latLngToLayerPoint(this._latlng);this._group._unspiderfy(),this._group._spiderfied=this,e.length>=this._circleSpiralSwitchover?t=this._generatePointsSpiral(e.length,s):(s.y+=10,t=this._generatePointsCircle(e.length,s)),this._animationSpiderfy(e,t)}},unspiderfy:function(t){this._group._inZoomAnimation||(this._animationUnspiderfy(t),this._group._spiderfied=null)},_generatePointsCircle:function(t,e){var i,n,s=this._group.options.spiderfyDistanceMultiplier*this._circleFootSeparation*(2+t),r=s/this._2PI,o=this._2PI/t,a=[];for(a.length=t,i=t-1;i>=0;i--)n=this._circleStartAngle+i*o,a[i]=new L.Point(e.x+r*Math.cos(n),e.y+r*Math.sin(n))._round();return a},_generatePointsSpiral:function(t,e){var i,n=this._group.options.spiderfyDistanceMultiplier*this._spiralLengthStart,s=this._group.options.spiderfyDistanceMultiplier*this._spiralFootSeparation,r=this._group.options.spiderfyDistanceMultiplier*this._spiralLengthFactor,o=0,a=[];for(a.length=t,i=t-1;i>=0;i--)o+=s/n+5e-4*i,a[i]=new L.Point(e.x+n*Math.cos(o),e.y+n*Math.sin(o))._round(),n+=this._2PI*r/o;return a},_noanimationUnspiderfy:function(){var t,e,i=this._group,n=i._map,s=i._featureGroup,r=this.getAllChildMarkers();for(this.setOpacity(1),e=r.length-1;e>=0;e--)t=r[e],s.removeLayer(t),t._preSpiderfyLatlng&&(t.setLatLng(t._preSpiderfyLatlng),delete t._preSpiderfyLatlng),t.setZIndexOffset&&t.setZIndexOffset(0),t._spiderLeg&&(n.removeLayer(t._spiderLeg),delete t._spiderLeg);i._spiderfied=null}}),L.MarkerCluster.include(L.DomUtil.TRANSITION?{SVG_ANIMATION:function(){return e.createElementNS("http://www.w3.org/2000/svg","animate").toString().indexOf("SVGAnimate")>-1}(),_animationSpiderfy:function(t,i){var n,s,r,o,a=this,h=this._group,_=h._map,u=h._featureGroup,l=_.latLngToLayerPoint(this._latlng);for(n=t.length-1;n>=0;n--)s=t[n],s.setOpacity?(s.setZIndexOffset(1e6),s.setOpacity(0),u.addLayer(s),s._setPos(l)):u.addLayer(s);h._forceLayout(),h._animationStart();var d=L.Path.SVG?0:.3,p=L.Path.SVG_NS;for(n=t.length-1;n>=0;n--)if(o=_.layerPointToLatLng(i[n]),s=t[n],s._preSpiderfyLatlng=s._latlng,s.setLatLng(o),s.setOpacity&&s.setOpacity(1),r=new L.Polyline([a._latlng,o],{weight:1.5,color:"#222",opacity:d}),_.addLayer(r),s._spiderLeg=r,L.Path.SVG&&this.SVG_ANIMATION){var c=r._path.getTotalLength();r._path.setAttribute("stroke-dasharray",c+","+c);var m=e.createElementNS(p,"animate");m.setAttribute("attributeName","stroke-dashoffset"),m.setAttribute("begin","indefinite"),m.setAttribute("from",c),m.setAttribute("to",0),m.setAttribute("dur",.25),r._path.appendChild(m),m.beginElement(),m=e.createElementNS(p,"animate"),m.setAttribute("attributeName","stroke-opacity"),m.setAttribute("attributeName","stroke-opacity"),m.setAttribute("begin","indefinite"),m.setAttribute("from",0),m.setAttribute("to",.5),m.setAttribute("dur",.25),r._path.appendChild(m),m.beginElement()}if(a.setOpacity(.3),L.Path.SVG)for(this._group._forceLayout(),n=t.length-1;n>=0;n--)s=t[n]._spiderLeg,s.options.opacity=.5,s._path.setAttribute("stroke-opacity",.5);setTimeout(function(){h._animationEnd(),h.fire("spiderfied")},200)},_animationUnspiderfy:function(t){var e,i,n,s=this._group,r=s._map,o=s._featureGroup,a=t?r._latLngToNewLayerPoint(this._latlng,t.zoom,t.center):r.latLngToLayerPoint(this._latlng),h=this.getAllChildMarkers(),_=L.Path.SVG&&this.SVG_ANIMATION;for(s._animationStart(),this.setOpacity(1),i=h.length-1;i>=0;i--)e=h[i],e._preSpiderfyLatlng&&(e.setLatLng(e._preSpiderfyLatlng),delete e._preSpiderfyLatlng,e.setOpacity?(e._setPos(a),e.setOpacity(0)):o.removeLayer(e),_&&(n=e._spiderLeg._path.childNodes[0],n.setAttribute("to",n.getAttribute("from")),n.setAttribute("from",0),n.beginElement(),n=e._spiderLeg._path.childNodes[1],n.setAttribute("from",.5),n.setAttribute("to",0),n.setAttribute("stroke-opacity",0),n.beginElement(),e._spiderLeg._path.setAttribute("stroke-opacity",0)));setTimeout(function(){var t=0;for(i=h.length-1;i>=0;i--)e=h[i],e._spiderLeg&&t++;for(i=h.length-1;i>=0;i--)e=h[i],e._spiderLeg&&(e.setOpacity&&(e.setOpacity(1),e.setZIndexOffset(0)),t>1&&o.removeLayer(e),r.removeLayer(e._spiderLeg),delete e._spiderLeg);s._animationEnd()},200)}}:{_animationSpiderfy:function(t,e){var i,n,s,r,o=this._group,a=o._map,h=o._featureGroup;for(i=t.length-1;i>=0;i--)r=a.layerPointToLatLng(e[i]),n=t[i],n._preSpiderfyLatlng=n._latlng,n.setLatLng(r),n.setZIndexOffset&&n.setZIndexOffset(1e6),h.addLayer(n),s=new L.Polyline([this._latlng,r],{weight:1.5,color:"#222"}),a.addLayer(s),n._spiderLeg=s;this.setOpacity(.3),o.fire("spiderfied")},_animationUnspiderfy:function(){this._noanimationUnspiderfy()}}),L.MarkerClusterGroup.include({_spiderfied:null,_spiderfierOnAdd:function(){this._map.on("click",this._unspiderfyWrapper,this),this._map.options.zoomAnimation&&this._map.on("zoomstart",this._unspiderfyZoomStart,this),this._map.on("zoomend",this._noanimationUnspiderfy,this),L.Path.SVG&&!L.Browser.touch&&this._map._initPathRoot()},_spiderfierOnRemove:function(){this._map.off("click",this._unspiderfyWrapper,this),this._map.off("zoomstart",this._unspiderfyZoomStart,this),this._map.off("zoomanim",this._unspiderfyZoomAnim,this),this._unspiderfy()},_unspiderfyZoomStart:function(){this._map&&this._map.on("zoomanim",this._unspiderfyZoomAnim,this)},_unspiderfyZoomAnim:function(t){L.DomUtil.hasClass(this._map._mapPane,"leaflet-touching")||(this._map.off("zoomanim",this._unspiderfyZoomAnim,this),this._unspiderfy(t))},_unspiderfyWrapper:function(){this._unspiderfy()},_unspiderfy:function(t){this._spiderfied&&this._spiderfied.unspiderfy(t)},_noanimationUnspiderfy:function(){this._spiderfied&&this._spiderfied._noanimationUnspiderfy()},_unspiderfyLayer:function(t){t._spiderLeg&&(this._featureGroup.removeLayer(t),t.setOpacity(1),t.setZIndexOffset(0),this._map.removeLayer(t._spiderLeg),delete t._spiderLeg)}})}(window,document);

/*
  Leaflet.AwesomeMarkers, a plugin that adds colorful iconic markers for Leaflet, based on the Font Awesome icons
  (c) 2012-2013, Lennard Voogdt

  http://leafletjs.com
  https://github.com/lvoogdt
*/

/*global L*/

(function (window, document, undefined) {
    "use strict";
    /*
     * Leaflet.AwesomeMarkers assumes that you have already included the Leaflet library.
     */

    L.AwesomeMarkers = {};

    L.AwesomeMarkers.version = '2.0.1';

    L.AwesomeMarkers.Icon = L.Icon.extend({
        options: {
            iconSize: [35, 45],
            iconAnchor:   [17, 42],
            popupAnchor: [1, -32],
            shadowAnchor: [10, 12],
            shadowSize: [36, 16],
            className: 'awesome-marker',
            prefix: 'glyphicon',
            spinClass: 'fa-spin',
            extraClasses: '',
            icon: 'home',
            markerColor: 'blue',
            iconColor: 'white'
        },

        initialize: function (options) {
            options = L.Util.setOptions(this, options);
        },

        createIcon: function () {
            var div = document.createElement('div'),
                options = this.options;

            if (options.icon) {
                div.innerHTML = this._createInner();
            }

            if (options.bgPos) {
                div.style.backgroundPosition =
                    (-options.bgPos.x) + 'px ' + (-options.bgPos.y) + 'px';
            }

            this._setIconStyles(div, 'icon-' + options.markerColor);
            return div;
        },

        _createInner: function() {
            var iconClass, iconSpinClass = "", iconColorClass = "", iconColorStyle = "", options = this.options;

            if(options.icon.slice(0,options.prefix.length+1) === options.prefix + "-") {
                iconClass = options.icon;
            } else {
                iconClass = options.prefix + "-" + options.icon;
            }

            if(options.spin && typeof options.spinClass === "string") {
                iconSpinClass = options.spinClass;
            }

            if(options.iconColor) {
                if(options.iconColor === 'white' || options.iconColor === 'black') {
                    iconColorClass = "icon-" + options.iconColor;
                } else {
                    iconColorStyle = "style='color: " + options.iconColor + "' ";
                }
            }

            return "<i " + iconColorStyle + "class='" + options.extraClasses + " " + options.prefix + " " + iconClass + " " + iconSpinClass + " " + iconColorClass + "'></i>";
        },

        _setIconStyles: function (img, name) {
            var options = this.options,
                size = L.point(options[name === 'shadow' ? 'shadowSize' : 'iconSize']),
                anchor;

            if (name === 'shadow') {
                anchor = L.point(options.shadowAnchor || options.iconAnchor);
            } else {
                anchor = L.point(options.iconAnchor);
            }

            if (!anchor && size) {
                anchor = size.divideBy(2, true);
            }

            img.className = 'awesome-marker-' + name + ' ' + options.className;

            if (anchor) {
                img.style.marginLeft = (-anchor.x) + 'px';
                img.style.marginTop  = (-anchor.y) + 'px';
            }

            if (size) {
                img.style.width  = size.x + 'px';
                img.style.height = size.y + 'px';
            }
        },

        createShadow: function () {
            var div = document.createElement('div');

            this._setIconStyles(div, 'shadow');
            return div;
      }
    });

    L.AwesomeMarkers.icon = function (options) {
        return new L.AwesomeMarkers.Icon(options);
    };

}(this, document));



/*
 * Leaflet.ExtraMarkers is a near copy of Leaflet.AwesomeMarkers (c) 2012-2013, Lennard Voogdt, https://github.com/lvoogdt
 * Making color changes and adding shapes are what drove me to make this copy and not a fork...
 */

/*global L*/

(function (window, document, undefined) {
    "use strict";

    L.ExtraMarkers = {};

    L.ExtraMarkers.version = '1.0.1';

    L.ExtraMarkers.Icon = L.Icon.extend({
        options: {
            iconSize: [35, 45],
            iconAnchor:   [17, 42],
            popupAnchor: [1, -32],
            shadowAnchor: [10, 12],
            shadowSize: [36, 16],
            className: 'extra-marker',
            prefix: '',
            extraClasses: '',
            shape: 'circle',
            icon: '',
            markerColor: 'red',
            iconColor: '#fff'
        },

        initialize: function (options) {
            options = L.Util.setOptions(this, options);
        },

        createIcon: function () {
            var div = document.createElement('div'),
                options = this.options;

            if (options.icon) {
                div.innerHTML = this._createInner();
            }

            if (options.bgPos) {
                div.style.backgroundPosition =
                    (-options.bgPos.x) + 'px ' + (-options.bgPos.y) + 'px';
            }

            this._setIconStyles(div, options.shape + '-' + options.markerColor);
            return div;
        },

        _createInner: function() {
            var iconClass, iconSpinClass = "", iconColorClass = "", iconColorStyle = "", options = this.options;

            if(options.iconColor) {
                iconColorStyle = "style='color: " + options.iconColor + "' ";
            }

            return "<i " + iconColorStyle + "class='" + options.extraClasses + " " + options.prefix + " " + options.icon + "'></i>";
        },

        _setIconStyles: function (img, name) {
            var options = this.options,
                size = L.point(options[name === 'shadow' ? 'shadowSize' : 'iconSize']),
                anchor;

            if (name === 'shadow') {
                anchor = L.point(options.shadowAnchor || options.iconAnchor);
            } else {
                anchor = L.point(options.iconAnchor);
            }

            if (!anchor && size) {
                anchor = size.divideBy(2, true);
            }

            img.className = 'extra-marker-' + name + ' ' + options.className;

            if (anchor) {
                img.style.marginLeft = (-anchor.x) + 'px';
                img.style.marginTop  = (-anchor.y) + 'px';
            }

            if (size) {
                img.style.width  = size.x + 'px';
                img.style.height = size.y + 'px';
            }
        },

        createShadow: function () {
            var div = document.createElement('div');

            this._setIconStyles(div, 'shadow');
            return div;
        }
    });

    L.ExtraMarkers.icon = function (options) {
        return new L.ExtraMarkers.Icon(options);
    };

}(this, document));

/*! Version: 0.39.0
Date: 2015-01-26 */

/*!
Copyright (c) 2014 Dominik Moritz

This file is part of the leaflet locate control. It is licensed under the MIT license.
You can find the project at: https://github.com/domoritz/leaflet-locatecontrol
*/
!function(a,b){"function"==typeof define&&define.amd?define(["leaflet"],a):"object"==typeof exports&&(module.exports=a("undefined"!=typeof b&&b.L?L:require("leaflet"))),"undefined"!=typeof b&&b.L&&(b.L.Locate=a(L))}(function(a){return a.Control.Locate=a.Control.extend({options:{position:"topleft",drawCircle:!0,follow:!1,stopFollowingOnDrag:!1,remainActive:!1,markerClass:a.circleMarker,circleStyle:{color:"#136AEC",fillColor:"#136AEC",fillOpacity:.15,weight:2,opacity:.5},markerStyle:{color:"#136AEC",fillColor:"#2A93EE",fillOpacity:.7,weight:2,opacity:.9,radius:5},followCircleStyle:{},followMarkerStyle:{},icon:"fa fa-map-marker",iconLoading:"fa fa-spinner fa-spin",circlePadding:[0,0],metric:!0,onLocationError:function(a){alert(a.message)},onLocationOutsideMapBounds:function(a){a.stop(),alert(a.options.strings.outsideMapBoundsMsg)},setView:!0,keepCurrentZoomLevel:!1,showPopup:!0,strings:{title:"Show me where I am",popup:"You are within {distance} {unit} from this point",outsideMapBoundsMsg:"You seem located outside the boundaries of the map"},locateOptions:{maxZoom:1/0,watch:!0}},initialize:function(b){a.Map.addInitHook(function(){this.options.locateControl&&(this.locateControl=a.control.locate(),this.addControl(this.locateControl))});for(var c in b)"object"==typeof this.options[c]?a.extend(this.options[c],b[c]):this.options[c]=b[c];a.extend(this.options.locateOptions,{setView:!1})},_activate:function(){this.options.setView&&(this._locateOnNextLocationFound=!0),this._active||this._map.locate(this.options.locateOptions),this._active=!0,this.options.follow&&this._startFollowing(this._map)},_deactivate:function(){this._map.stopLocate(),this._map.off("dragstart",this._stopFollowing),this.options.follow&&this._following&&this._stopFollowing(this._map)},drawMarker:function(b){void 0===this._event.accuracy&&(this._event.accuracy=0);var c=this._event.accuracy;this._locateOnNextLocationFound&&(this._isOutsideMapBounds()?this.options.onLocationOutsideMapBounds(this):b.fitBounds(this._event.bounds,{padding:this.options.circlePadding,maxZoom:this.options.keepCurrentZoomLevel?b.getZoom():this.options.locateOptions.maxZoom}),this._locateOnNextLocationFound=!1);var d,e;if(this.options.drawCircle)if(d=this._following?this.options.followCircleStyle:this.options.circleStyle,this._circle){this._circle.setLatLng(this._event.latlng).setRadius(c);for(e in d)this._circle.options[e]=d[e]}else this._circle=a.circle(this._event.latlng,c,d).addTo(this._layer);var f,g;this.options.metric?(f=c.toFixed(0),g="meters"):(f=(3.2808399*c).toFixed(0),g="feet");var h;h=this._following?this.options.followMarkerStyle:this.options.markerStyle,this._marker?this.updateMarker(this._event.latlng,h):this._marker=this.createMarker(this._event.latlng,h).addTo(this._layer);var i=this.options.strings.popup;this.options.showPopup&&i&&this._marker.bindPopup(a.Util.template(i,{distance:f,unit:g}))._popup.setLatLng(this._event.latlng),this._toggleContainerStyle()},createMarker:function(a,b){return this.options.markerClass(a,b)},updateMarker:function(a,b){this._marker.setLatLng(a);for(o in b)this._marker.options[o]=b[o]},removeMarker:function(){this._layer.clearLayers(),this._marker=void 0,this._circle=void 0},onAdd:function(b){var c=a.DomUtil.create("div","leaflet-control-locate leaflet-bar leaflet-control");this._layer=new a.LayerGroup,this._layer.addTo(b),this._event=void 0;var d={};return a.extend(d,this.options.markerStyle,this.options.followMarkerStyle),this.options.followMarkerStyle=d,d={},a.extend(d,this.options.circleStyle,this.options.followCircleStyle),this.options.followCircleStyle=d,this._link=a.DomUtil.create("a","leaflet-bar-part leaflet-bar-part-single",c),this._link.href="#",this._link.title=this.options.strings.title,this._icon=a.DomUtil.create("span",this.options.icon,this._link),a.DomEvent.on(this._link,"click",a.DomEvent.stopPropagation).on(this._link,"click",a.DomEvent.preventDefault).on(this._link,"click",function(){var a=void 0===this._event||this._map.getBounds().contains(this._event.latlng)||!this.options.setView||this._isOutsideMapBounds();!this.options.remainActive&&this._active&&a?this.stop():this.start()},this).on(this._link,"dblclick",a.DomEvent.stopPropagation),this._resetVariables(),this.bindEvents(b),c},bindEvents:function(a){a.on("locationfound",this._onLocationFound,this),a.on("locationerror",this._onLocationError,this),a.on("unload",this.stop,this)},start:function(){this._activate(),this._event?this.drawMarker(this._map):this._setClasses("requesting")},stop:function(){this._deactivate(),this._cleanClasses(),this._resetVariables(),this.removeMarker()},_onLocationError:function(a){3==a.code&&this.options.locateOptions.watch||(this.stop(),this.options.onLocationError(a))},_onLocationFound:function(a){this._event&&this._event.latlng.lat===a.latlng.lat&&this._event.latlng.lng===a.latlng.lng&&this._event.accuracy===a.accuracy||this._active&&(this._event=a,this.options.follow&&this._following&&(this._locateOnNextLocationFound=!0),this.drawMarker(this._map))},_startFollowing:function(){this._map.fire("startfollowing",this),this._following=!0,this.options.stopFollowingOnDrag&&this._map.on("dragstart",this._stopFollowing,this)},_stopFollowing:function(){this._map.fire("stopfollowing",this),this._following=!1,this.options.stopFollowingOnDrag&&this._map.off("dragstart",this._stopFollowing),this._toggleContainerStyle()},_isOutsideMapBounds:function(){return void 0===this._event?!1:this._map.options.maxBounds&&!this._map.options.maxBounds.contains(this._event.latlng)},_toggleContainerStyle:function(){this._container&&this._setClasses(this._following?"following":"active")},_setClasses:function(b){"requesting"==b?(a.DomUtil.removeClasses(this._container,"active following"),a.DomUtil.addClasses(this._container,"requesting"),a.DomUtil.removeClasses(this._icon,this.options.icon),a.DomUtil.addClasses(this._icon,this.options.iconLoading)):"active"==b?(a.DomUtil.removeClasses(this._container,"requesting following"),a.DomUtil.addClasses(this._container,"active"),a.DomUtil.removeClasses(this._icon,this.options.iconLoading),a.DomUtil.addClasses(this._icon,this.options.icon)):"following"==b&&(a.DomUtil.removeClasses(this._container,"requesting"),a.DomUtil.addClasses(this._container,"active following"),a.DomUtil.removeClasses(this._icon,this.options.iconLoading),a.DomUtil.addClasses(this._icon,this.options.icon))},_cleanClasses:function(){a.DomUtil.removeClass(this._container,"requesting"),a.DomUtil.removeClass(this._container,"active"),a.DomUtil.removeClass(this._container,"following"),a.DomUtil.removeClasses(this._icon,this.options.iconLoading),a.DomUtil.addClasses(this._icon,this.options.icon)},_resetVariables:function(){this._active=!1,this._locateOnNextLocationFound=this.options.setView,this._following=!1}}),a.Map.addInitHook(function(){this.options.locateControl&&(this.locateControl=a.control.locate(),this.addControl(this.locateControl))}),a.control.locate=function(b){return new a.Control.Locate(b)},function(){var b=function(b,c,d){d=d.split(" "),d.forEach(function(d){a.DomUtil[b].call(this,c,d)})};a.DomUtil.addClasses=function(a,c){b("addClass",a,c)},a.DomUtil.removeClasses=function(a,c){b("removeClass",a,c)}}(),a.Control.Locate},window);
//# sourceMappingURL=L.Control.Locate.min.js.map

/*
 Copyright (c) 2013, Jason Sanford
 Leaflet Vector Layers is a library for showing geometry objects
 from multiple geoweb services in a Leaflet map
*/
(function(a){a.lvector={VERSION:"1.5.1",noConflict:function(){a.lvector=this._originallvector;return this},_originallvector:a.lvector}})(this);lvector.Layer=L.Class.extend({options:{fields:"",scaleRange:null,map:null,uniqueField:null,visibleAtScale:!0,dynamic:!1,autoUpdate:!1,autoUpdateInterval:null,popupTemplate:null,popupOptions:{},singlePopup:!1,symbology:null,showAll:!1},initialize:function(a){L.Util.setOptions(this,a)},setMap:function(a){if(!a||!this.options.map)if(a){this.options.map=a;if(this.options.scaleRange&&this.options.scaleRange instanceof Array&&this.options.scaleRange.length===2){var a=this.options.map.getZoom(),b=this.options.scaleRange;
this.options.visibleAtScale=a>=b[0]&&a<=b[1]}this._show()}else if(this.options.map)this._hide(),this.options.map=a},getMap:function(){return this.options.map},setOptions:function(){},_show:function(){this._addIdleListener();this.options.scaleRange&&this.options.scaleRange instanceof Array&&this.options.scaleRange.length===2&&this._addZoomChangeListener();if(this.options.visibleAtScale){if(this.options.autoUpdate&&this.options.autoUpdateInterval){var a=this;this._autoUpdateInterval=setInterval(function(){a._getFeatures()},
this.options.autoUpdateInterval)}this.options.map.fire("moveend").fire("zoomend")}},_hide:function(){this._idleListener&&this.options.map.off("moveend",this._idleListener);this._zoomChangeListener&&this.options.map.off("zoomend",this._zoomChangeListener);this._autoUpdateInterval&&clearInterval(this._autoUpdateInterval);this._clearFeatures();this._lastQueriedBounds=null;if(this._gotAll)this._gotAll=!1},_hideVectors:function(){for(var a=0;a<this._vectors.length;a++){if(this._vectors[a].vector)if(this.options.map.removeLayer(this._vectors[a].vector),
this._vectors[a].popup)this.options.map.removeLayer(this._vectors[a].popup);else if(this.popup&&this.popup.associatedFeature&&this.popup.associatedFeature==this._vectors[a])this.options.map.removeLayer(this.popup),this.popup=null;if(this._vectors[a].vectors&&this._vectors[a].vectors.length)for(var b=0;b<this._vectors[a].vectors.length;b++)if(this.options.map.removeLayer(this._vectors[a].vectors[b]),this._vectors[a].vectors[b].popup)this.options.map.removeLayer(this._vectors[a].vectors[b].popup);else if(this.popup&&
this.popup.associatedFeature&&this.popup.associatedFeature==this._vectors[a])this.options.map.removeLayer(this.popup),this.popup=null}},_showVectors:function(){for(var a=0;a<this._vectors.length;a++)if(this._vectors[a].vector&&this.options.map.addLayer(this._vectors[a].vector),this._vectors[a].vectors&&this._vectors[a].vectors.length)for(var b=0;b<this._vectors[a].vectors.length;b++)this.options.map.addLayer(this._vectors[a].vectors[b])},_clearFeatures:function(){this._hideVectors();this._vectors=
[]},_addZoomChangeListener:function(){this._zoomChangeListener=this._zoomChangeListenerTemplate();this.options.map.on("zoomend",this._zoomChangeListener,this)},_zoomChangeListenerTemplate:function(){var a=this;return function(){a._checkLayerVisibility()}},_idleListenerTemplate:function(){var a=this;return function(){if(a.options.visibleAtScale)if(a.options.showAll){if(!a._gotAll)a._getFeatures(),a._gotAll=!0}else a._getFeatures()}},_addIdleListener:function(){this._idleListener=this._idleListenerTemplate();
this.options.map.on("moveend",this._idleListener,this)},_checkLayerVisibility:function(){var a=this.options.visibleAtScale,b=this.options.map.getZoom(),d=this.options.scaleRange;this.options.visibleAtScale=b>=d[0]&&b<=d[1];if(a!==this.options.visibleAtScale)this[this.options.visibleAtScale?"_showVectors":"_hideVectors"]();if(a&&!this.options.visibleAtScale&&this._autoUpdateInterval)clearInterval(this._autoUpdateInterval);else if(!a&&this.options.autoUpdate&&this.options.autoUpdateInterval){var e=
this;this._autoUpdateInterval=setInterval(function(){e._getFeatures()},this.options.autoUpdateInterval)}},_setPopupContent:function(a){var b=a.popupContent,d=a.attributes||a.properties,e;if(typeof this.options.popupTemplate=="string"){e=this.options.popupTemplate;for(var c in d)e=e.replace(RegExp("{"+c+"}","g"),d[c])}else if(typeof this.options.popupTemplate=="function")e=this.options.popupTemplate(d);else return;a.popupContent=e;a.popup?a.popupContent!==b&&a.popup.setContent(a.popupContent):this.popup&&
this.popup.associatedFeature==a&&a.popupContent!==b&&this.popup.setContent(a.popupContent)},_showPopup:function(a,b){var d=b.latlng;d||L.Util.extend(this.options.popupOptions,{offset:b.target.options.icon.options.popupAnchor});var e;if(this.options.singlePopup){if(this.popup)this.options.map.removeLayer(this.popup),this.popup=null;this.popup=new L.Popup(this.options.popupOptions,a.vector);this.popup.associatedFeature=a;e=this}else a.popup=new L.Popup(this.options.popupOptions,a.vector),e=a;e.popup.setLatLng(d?
b.latlng:b.target.getLatLng());e.popup.setContent(a.popupContent);this.options.map.addLayer(e.popup)},_fireClickEvent:function(a,b){this.options.clickEvent(a,b)},_getFeatureVectorOptions:function(a){var b={},a=a.attributes||a.properties;if(this.options.symbology)switch(this.options.symbology.type){case "single":for(var d in this.options.symbology.vectorOptions)if(b[d]=this.options.symbology.vectorOptions[d],b.title)for(var e in a){var c=RegExp("{"+e+"}","g");b.title=b.title.replace(c,a[e])}break;
case "unique":for(var f=this.options.symbology.property,g=0,h=this.options.symbology.values.length;g<h;g++)if(a[f]==this.options.symbology.values[g].value)for(d in this.options.symbology.values[g].vectorOptions)if(b[d]=this.options.symbology.values[g].vectorOptions[d],b.title)for(e in a)c=RegExp("{"+e+"}","g"),b.title=b.title.replace(c,a[e]);break;case "range":f=this.options.symbology.property;g=0;for(h=this.options.symbology.ranges.length;g<h;g++)if(a[f]>=this.options.symbology.ranges[g].range[0]&&
a[f]<=this.options.symbology.ranges[g].range[1])for(d in this.options.symbology.ranges[g].vectorOptions)if(b[d]=this.options.symbology.ranges[g].vectorOptions[d],b.title)for(e in a)c=RegExp("{"+e+"}","g"),b.title=b.title.replace(c,a[e])}return b},_getPropertiesChanged:function(a,b){var d=!1,e;for(e in a)a[e]!=b[e]&&(d=!0);return d},_getPropertyChanged:function(a,b,d){return a[d]!=b[d]},_getGeometryChanged:function(a,b){var d=!1;a.coordinates&&a.coordinates instanceof Array?a.coordinates[0]==b.coordinates[0]&&
a.coordinates[1]==b.coordinates[1]||(d=!0):a.x==b.x&&a.y==b.y||(d=!0);return d},_makeJsonpRequest:function(a){var b=document.getElementsByTagName("head")[0],d=document.createElement("script");d.type="text/javascript";d.src=a;b.appendChild(d)},_processFeatures:function(a){if(this.options.map){var b=this.options.map.getBounds();if(!this._lastQueriedBounds||!this._lastQueriedBounds.equals(b)||this.options.autoUpdate){this._lastQueriedBounds=b;featuresHaveIds=a.features&&a.features.length&&a.features[0].id?
!0:!1;!this.options.uniqueField&&!featuresHaveIds&&this._clearFeatures();if(this instanceof lvector.PRWSF){a.features=a.rows;delete a.rows;for(var b=0,d=a.features.length;b<d;b++){a.features[b].type="Feature";a.features[b].properties={};for(var e in a.features[b].row)e=="geojson"?a.features[b].geometry=a.features[b].row.geojson:a.features[b].properties[e]=a.features[b].row[e];delete a.features[b].row}}if(this instanceof lvector.GISCloud){a.features=a.data;delete a.data;b=0;for(d=a.features.length;b<
d;b++)a.features[b].type="Feature",a.features[b].properties=a.features[b].data,a.features[b].properties.id=a.features[b].__id,delete a.features[b].data,a.features[b].geometry=a.features[b].__geometry,delete a.features[b].__geometry}if(a&&a.features&&a.features.length)for(b=0;b<a.features.length;b++){if(this instanceof lvector.EsriJSONLayer)a.features[b].properties=a.features[b].attributes,delete a.features[b].attributes;e=!1;d=a.features[b].id?!0:!1;if(this.options.uniqueField||d)for(var c=0;c<this._vectors.length;c++){var f=
this._vectors[c].id?!0:!1;if(d&&f&&a.features[b].id==this._vectors[c].id||this.options.uniqueField&&a.features[b].properties[this.options.uniqueField]==this._vectors[c].properties[this.options.uniqueField])if(e=!0,this.options.dynamic){if(this._getGeometryChanged(this._vectors[c].geometry,a.features[b].geometry)&&!isNaN(a.features[b].geometry.coordinates[0])&&!isNaN(a.features[b].geometry.coordinates[1]))this._vectors[c].geometry=a.features[b].geometry,this._vectors[c].vector.setLatLng(new L.LatLng(this._vectors[c].geometry.coordinates[1],
this._vectors[c].geometry.coordinates[0]));if(this._getPropertiesChanged(this._vectors[c].properties,a.features[b].properties)&&(f=this._getPropertyChanged(this._vectors[c].properties,a.features[b].properties,this.options.symbology.property),this._vectors[c].properties=a.features[b].properties,this.options.popupTemplate&&this._setPopupContent(this._vectors[c]),this.options.symbology&&this.options.symbology.type!="single"&&f))if(this._vectors[c].vectors)for(var f=0,g=this._vectors[c].vectors.length;f<
g;f++)this._vectors[c].vectors[f].setStyle?this._vectors[c].vectors[f].setStyle(this._getFeatureVectorOptions(this._vectors[c])):this._vectors[c].vectors[f].setIcon&&this._vectors[c].vectors[f].setIcon(this._getFeatureVectorOptions(this._vectors[c]).icon);else this._vectors[c].vector&&(this._vectors[c].vector.setStyle?this._vectors[c].vector.setStyle(this._getFeatureVectorOptions(this._vectors[c])):this._vectors[c].vector.setIcon&&this._vectors[c].vector.setIcon(this._getFeatureVectorOptions(this._vectors[c]).icon))}}if(!e){this instanceof
lvector.GeoJSONLayer?(e=this._geoJsonGeometryToLeaflet(a.features[b].geometry,this._getFeatureVectorOptions(a.features[b])),a.features[b][e instanceof Array?"vectors":"vector"]=e):this instanceof lvector.EsriJSONLayer&&(e=this._esriJsonGeometryToLeaflet(a.features[b].geometry,this._getFeatureVectorOptions(a.features[b])),a.features[b][e instanceof Array?"vectors":"vector"]=e);if(a.features[b].vector)this.options.map.addLayer(a.features[b].vector);else if(a.features[b].vectors&&a.features[b].vectors.length)for(f=
0;f<a.features[b].vectors.length;f++)this.options.map.addLayer(a.features[b].vectors[f]);this._vectors.push(a.features[b]);if(this.options.popupTemplate){var h=this;e=a.features[b];this._setPopupContent(e);(function(a){if(a.vector)a.vector.on("click",function(b){h._showPopup(a,b)});else if(a.vectors)for(var b=0,c=a.vectors.length;b<c;b++)a.vectors[b].on("click",function(b){h._showPopup(a,b)})})(e)}this.options.clickEvent&&(h=this,e=a.features[b],function(a){if(a.vector)a.vector.on("click",function(b){h._fireClickEvent(a,
b)});else if(a.vectors)for(var b=0,c=a.vectors.length;b<c;b++)a.vectors[b].on("click",function(b){h._fireClickEvent(a,b)})}(e))}}}}}});lvector.GeoJSONLayer=lvector.Layer.extend({_geoJsonGeometryToLeaflet:function(a,b){var d,e;switch(a.type){case "Point":d=b.circleMarker?new L.CircleMarker(new L.LatLng(a.coordinates[1],a.coordinates[0]),b):new L.Marker(new L.LatLng(a.coordinates[1],a.coordinates[0]),b);break;case "MultiPoint":e=[];for(var c=0,f=a.coordinates.length;c<f;c++)e.push(new L.Marker(new L.LatLng(a.coordinates[c][1],a.coordinates[c][0]),b));break;case "LineString":for(var g=[],c=0,f=a.coordinates.length;c<f;c++)g.push(new L.LatLng(a.coordinates[c][1],
a.coordinates[c][0]));d=new L.Polyline(g,b);break;case "MultiLineString":e=[];c=0;for(f=a.coordinates.length;c<f;c++){for(var g=[],h=0,j=a.coordinates[c].length;h<j;h++)g.push(new L.LatLng(a.coordinates[c][h][1],a.coordinates[c][h][0]));e.push(new L.Polyline(g,b))}break;case "Polygon":for(var i=[],c=0,f=a.coordinates.length;c<f;c++){g=[];h=0;for(j=a.coordinates[c].length;h<j;h++)g.push(new L.LatLng(a.coordinates[c][h][1],a.coordinates[c][h][0]));i.push(g)}d=new L.Polygon(i,b);break;case "MultiPolygon":e=
[];c=0;for(f=a.coordinates.length;c<f;c++){i=[];h=0;for(j=a.coordinates[c].length;h<j;h++){for(var g=[],k=0,l=a.coordinates[c][h].length;k<l;k++)g.push(new L.LatLng(a.coordinates[c][h][k][1],a.coordinates[c][h][k][0]));i.push(g)}e.push(new L.Polygon(i,b))}break;case "GeometryCollection":e=[];c=0;for(f=a.geometries.length;c<f;c++)e.push(this._geoJsonGeometryToLeaflet(a.geometries[c],b))}return d||e}});lvector.EsriJSONLayer=lvector.Layer.extend({_esriJsonGeometryToLeaflet:function(a,b){var d,e;if(a.x&&a.y)d=new L.Marker(new L.LatLng(a.y,a.x),b);else if(a.points){e=[];for(var c=0,f=a.points.length;c<f;c++)e.push(new L.Marker(new L.LatLng(a.points[c].y,a.points[c].x),b))}else if(a.paths)if(a.paths.length>1){e=[];c=0;for(f=a.paths.length;c<f;c++){for(var g=[],h=0,j=a.paths[c].length;h<j;h++)g.push(new L.LatLng(a.paths[c][h][1],a.paths[c][h][0]));e.push(new L.Polyline(g,b))}}else{g=[];c=0;for(f=a.paths[0].length;c<
f;c++)g.push(new L.LatLng(a.paths[0][c][1],a.paths[0][c][0]));d=new L.Polyline(g,b)}else if(a.rings)if(a.rings.length>1){e=[];c=0;for(f=a.rings.length;c<f;c++){for(var i=[],g=[],h=0,j=a.rings[c].length;h<j;h++)g.push(new L.LatLng(a.rings[c][h][1],a.rings[c][h][0]));i.push(g);e.push(new L.Polygon(i,b))}}else{i=[];g=[];c=0;for(f=a.rings[0].length;c<f;c++)g.push(new L.LatLng(a.rings[0][c][1],a.rings[0][c][0]));i.push(g);d=new L.Polygon(i,b)}return d||e}});lvector.AGS=lvector.EsriJSONLayer.extend({initialize:function(a){for(var b=0,d=this._requiredParams.length;b<d;b++)if(!a[this._requiredParams[b]])throw Error('No "'+this._requiredParams[b]+'" parameter found.');this._globalPointer="AGS_"+Math.floor(Math.random()*1E5);window[this._globalPointer]=this;a.url.substr(a.url.length-1,1)!=="/"&&(a.url+="/");this._originalOptions=L.Util.extend({},a);if(a.esriOptions)if(typeof a.esriOptions=="object")L.Util.extend(a,this._convertEsriOptions(a.esriOptions));
else{this._getEsriOptions();return}lvector.Layer.prototype.initialize.call(this,a);if(this.options.where)this.options.where=encodeURIComponent(this.options.where);this._vectors=[];if(this.options.map){if(this.options.scaleRange&&this.options.scaleRange instanceof Array&&this.options.scaleRange.length===2)a=this.options.map.getZoom(),b=this.options.scaleRange,this.options.visibleAtScale=a>=b[0]&&a<=b[1];this._show()}},options:{where:"1=1",url:null,useEsriOptions:!1},_requiredParams:["url"],_convertEsriOptions:function(a){var b=
{};if(!(a.minScale==void 0||a.maxScale==void 0)){var d=this._scaleToLevel(a.minScale),e=this._scaleToLevel(a.maxScale);e==0&&(e=20);b.scaleRange=[d,e]}if(a.drawingInfo&&a.drawingInfo.renderer)b.symbology=this._renderOptionsToSymbology(a.drawingInfo.renderer);return b},_getEsriOptions:function(){this._makeJsonpRequest(this._originalOptions.url+"?f=json&callback="+this._globalPointer+"._processEsriOptions")},_processEsriOptions:function(a){var b=this._originalOptions;b.esriOptions=a;this.initialize(b)},
_scaleToLevel:function(a){var b=[5.91657527591555E8,2.95828763795777E8,1.47914381897889E8,7.3957190948944E7,3.6978595474472E7,1.8489297737236E7,9244648.868618,4622324.434309,2311162.217155,1155581.108577,577790.554289,288895.277144,144447.638572,72223.819286,36111.909643,18055.954822,9027.977411,4513.988705,2256.994353,1128.497176,564.248588,282.124294];if(a==0)return 0;for(var d=0,e=0;e<b.length-1;e++){var c=b[e+1];if(a<=b[e]&&a>c){d=e;break}}return d},_renderOptionsToSymbology:function(a){symbology=
{};switch(a.type){case "simple":symbology.type="single";symbology.vectorOptions=this._parseSymbology(a.symbol);break;case "uniqueValue":symbology.type="unique";symbology.property=a.field1;for(var b=[],d=0;d<a.uniqueValueInfos.length;d++){var e=a.uniqueValueInfos[d],c={};c.value=e.value;c.vectorOptions=this._parseSymbology(e.symbol);c.label=e.label;b.push(c)}symbology.values=b;break;case "classBreaks":symbology.type="range";symbology.property=rend.field;b=[];e=a.minValue;for(d=0;d<a.classBreakInfos.length;d++){var c=
a.classBreakInfos[d],f={};f.range=[e,c.classMaxValue];e=c.classMaxValue;f.vectorOptions=this._parseSymbology(c.symbol);f.label=c.label;b.push(f)}symbology.ranges=b}return symbology},_parseSymbology:function(a){var b={};switch(a.type){case "esriSMS":case "esriPMS":a=L.icon({iconUrl:"data:"+a.contentType+";base64,"+a.imageData,shadowUrl:null,iconSize:new L.Point(a.width,a.height),iconAnchor:new L.Point(a.width/2+a.xoffset,a.height/2+a.yoffset),popupAnchor:new L.Point(0,-(a.height/2))});b.icon=a;break;
case "esriSLS":b.weight=a.width;b.color=this._parseColor(a.color);b.opacity=this._parseAlpha(a.color[3]);break;case "esriSFS":a.outline?(b.weight=a.outline.width,b.color=this._parseColor(a.outline.color),b.opacity=this._parseAlpha(a.outline.color[3])):(b.weight=0,b.color="#000000",b.opacity=0),a.style!="esriSFSNull"?(b.fillColor=this._parseColor(a.color),b.fillOpacity=this._parseAlpha(a.color[3])):(b.fillColor="#000000",b.fillOpacity=0)}return b},_parseColor:function(a){red=this._normalize(a[0]);
green=this._normalize(a[1]);blue=this._normalize(a[2]);return"#"+this._pad(red.toString(16))+this._pad(green.toString(16))+this._pad(blue.toString(16))},_normalize:function(a){return a<1&&a>0?Math.floor(a*255):a},_pad:function(a){return a.length>1?a.toUpperCase():"0"+a.toUpperCase()},_parseAlpha:function(a){return a/255},_getFeatures:function(){var a=this.options.url+"query?returnGeometry=true&outSR=4326&f=json&outFields="+this.options.fields+"&where="+this.options.where+"&callback="+this._globalPointer+
"._processFeatures";this.options.showAll||(a+="&inSR=4326&spatialRel=esriSpatialRelIntersects&geometryType=esriGeometryEnvelope&geometry="+this.options.map.getBounds().toBBoxString());this._makeJsonpRequest(a)}});lvector.A2E=lvector.AGS.extend({initialize:function(a){for(var b=0,d=this._requiredParams.length;b<d;b++)if(!a[this._requiredParams[b]])throw Error('No "'+this._requiredParams[b]+'" parameter found.');this._globalPointer="A2E_"+Math.floor(Math.random()*1E5);window[this._globalPointer]=this;a.url.substr(a.url.length-1,1)!=="/"&&(a.url+="/");this._originalOptions=L.Util.extend({},a);if(a.esriOptions)if(typeof a.esriOptions=="object")L.Util.extend(a,this._convertEsriOptions(a.esriOptions));else{this._getEsriOptions();
return}lvector.Layer.prototype.initialize.call(this,a);if(this.options.where)this.options.where=encodeURIComponent(this.options.where);this._vectors=[];if(this.options.map){if(this.options.scaleRange&&this.options.scaleRange instanceof Array&&this.options.scaleRange.length===2)a=this.options.map.getZoom(),b=this.options.scaleRange,this.options.visibleAtScale=a>=b[0]&&a<=b[1];this._show()}if(this.options.autoUpdate&&this.options.esriOptions.editFeedInfo){this._makeJsonpRequest("http://cdn.pubnub.com/pubnub-3.1.min.js");
var e=this;this._pubNubScriptLoaderInterval=setInterval(function(){window.PUBNUB&&e._pubNubScriptLoaded()},200)}},_pubNubScriptLoaded:function(){clearInterval(this._pubNubScriptLoaderInterval);this.pubNub=PUBNUB.init({subscribe_key:this.options.esriOptions.editFeedInfo.pubnubSubscribeKey,ssl:!1,origin:"pubsub.pubnub.com"});var a=this;this.pubNub.subscribe({channel:this.options.esriOptions.editFeedInfo.pubnubChannel,callback:function(){a._getFeatures()},error:function(){}})}});lvector.GeoIQ=lvector.GeoJSONLayer.extend({initialize:function(a){for(var b=0,d=this._requiredParams.length;b<d;b++)if(!a[this._requiredParams[b]])throw Error('No "'+this._requiredParams[b]+'" parameter found.');lvector.Layer.prototype.initialize.call(this,a);this._globalPointer="GeoIQ_"+Math.floor(Math.random()*1E5);window[this._globalPointer]=this;this._vectors=[];if(this.options.map){if(this.options.scaleRange&&this.options.scaleRange instanceof Array&&this.options.scaleRange.length===2)a=this.options.map.getZoom(),
b=this.options.scaleRange,this.options.visibleAtScale=a>=b[0]&&a<=b[1];this._show()}},options:{dataset:null},_requiredParams:["dataset"],_getFeatures:function(){var a="http://geocommons.com/datasets/"+this.options.dataset+"/features.json?geojson=1&callback="+this._globalPointer+"._processFeatures&limit=999";this.options.showAll||(a+="&bbox="+this.options.map.getBounds().toBBoxString()+"&intersect=full");this._makeJsonpRequest(a)}});lvector.CartoDB=lvector.GeoJSONLayer.extend({initialize:function(a){for(var b=0,d=this._requiredParams.length;b<d;b++)if(!a[this._requiredParams[b]])throw Error('No "'+this._requiredParams[b]+'" parameter found.');lvector.Layer.prototype.initialize.call(this,a);this._globalPointer="CartoDB_"+Math.floor(Math.random()*1E5);window[this._globalPointer]=this;this._vectors=[];if(this.options.map){if(this.options.scaleRange&&this.options.scaleRange instanceof Array&&this.options.scaleRange.length===2)a=
this.options.map.getZoom(),b=this.options.scaleRange,this.options.visibleAtScale=a>=b[0]&&a<=b[1];this._show()}},options:{version:1,user:null,table:null,fields:"*",where:null,limit:null,uniqueField:"cartodb_id"},_requiredParams:["user","table"],_getFeatures:function(){var a=this.options.where||"";if(!this.options.showAll)for(var b=this.options.map.getBounds(),d=b.getSouthWest(),b=b.getNorthEast(),e=this.options.table.split(",").length,c=0;c<e;c++)a+=(a.length?" AND ":"")+(e>1?this.options.table.split(",")[c].split(".")[0]+
".the_geom":"the_geom")+" && st_setsrid(st_makebox2d(st_point("+d.lng+","+d.lat+"),st_point("+b.lng+","+b.lat+")),4326)";this.options.limit&&(a+=(a.length?" ":"")+"limit "+this.options.limit);a=a.length?" "+a:"";this._makeJsonpRequest("http://"+this.options.user+".cartodb.com/api/v"+this.options.version+"/sql?q="+encodeURIComponent("SELECT "+this.options.fields+" FROM "+this.options.table+(a.length?" WHERE "+a:""))+"&format=geojson&callback="+this._globalPointer+"._processFeatures")}});lvector.PRWSF=lvector.GeoJSONLayer.extend({initialize:function(a){for(var b=0,d=this._requiredParams.length;b<d;b++)if(!a[this._requiredParams[b]])throw Error('No "'+this._requiredParams[b]+'" parameter found.');a.url.substr(a.url.length-1,1)!=="/"&&(a.url+="/");lvector.Layer.prototype.initialize.call(this,a);this._globalPointer="PRWSF_"+Math.floor(Math.random()*1E5);window[this._globalPointer]=this;this._vectors=[];if(this.options.map){if(this.options.scaleRange&&this.options.scaleRange instanceof
Array&&this.options.scaleRange.length===2)a=this.options.map.getZoom(),b=this.options.scaleRange,this.options.visibleAtScale=a>=b[0]&&a<=b[1];this._show()}},options:{geotable:null,srid:null,geomFieldName:"the_geom",geomPrecision:"",fields:"",where:null,limit:null,uniqueField:null},_requiredParams:["url","geotable"],_getFeatures:function(){var a=this.options.where||"";if(!this.options.showAll){var b=this.options.map.getBounds(),d=b.getSouthWest(),b=b.getNorthEast();a+=a.length?" AND ":"";a+=this.options.srid?
this.options.geomFieldName+" && transform(st_setsrid(st_makebox2d(st_point("+d.lng+","+d.lat+"),st_point("+b.lng+","+b.lat+")),4326),"+this.options.srid+")":"transform("+this.options.geomFieldName+",4326) && st_setsrid(st_makebox2d(st_point("+d.lng+","+d.lat+"),st_point("+b.lng+","+b.lat+")),4326)"}this.options.limit&&(a+=(a.length?" ":"")+"limit "+this.options.limit);d=(this.options.fields.length?this.options.fields+",":"")+"st_asgeojson(transform("+this.options.geomFieldName+",4326)"+(this.options.geomPrecision?
","+this.options.geomPrecision:"")+") as geojson";this._makeJsonpRequest(this.options.url+"v1/ws_geo_attributequery.php?parameters="+encodeURIComponent(a)+"&geotable="+this.options.geotable+"&fields="+encodeURIComponent(d)+"&format=json&callback="+this._globalPointer+"._processFeatures")}});lvector.GISCloud=lvector.GeoJSONLayer.extend({initialize:function(a){for(var b=0,d=this._requiredParams.length;b<d;b++)if(!a[this._requiredParams[b]])throw Error('No "'+this._requiredParams[b]+'" parameter found.');lvector.Layer.prototype.initialize.call(this,a);this._globalPointer="GISCloud_"+Math.floor(Math.random()*1E5);window[this._globalPointer]=this;this._vectors=[];if(this.options.map){if(this.options.scaleRange&&this.options.scaleRange instanceof Array&&this.options.scaleRange.length===2)a=
this.options.map.getZoom(),b=this.options.scaleRange,this.options.visibleAtScale=a>=b[0]&&a<=b[1];this._show()}},options:{mapID:null,layerID:null,uniqueField:"id"},_requiredParams:["mapID","layerID"],_getFeatures:function(){var a="http://api.giscloud.com/1/maps/"+this.options.mapID+"/layers/"+this.options.layerID+"/features.json?geometry=geojson&epsg=4326&callback="+this._globalPointer+"._processFeatures";this.options.showAll||(a+="&bounds="+this.options.map.getBounds().toBBoxString());this.options.where&&
(a+="&where="+encodeURIComponent(this.options.where));this._makeJsonpRequest(a)}});lvector.GitSpatial=lvector.GeoJSONLayer.extend({initialize:function(a){for(var b=0,d=this._requiredParams.length;b<d;b++)if(!a[this._requiredParams[b]])throw Error('No "'+this._requiredParams[b]+'" parameter found.');lvector.Layer.prototype.initialize.call(this,a);this._globalPointer="GitSpatial_"+Math.floor(Math.random()*1E5);window[this._globalPointer]=this;this._vectors=[];if(this.options.map){if(this.options.scaleRange&&this.options.scaleRange instanceof Array&&this.options.scaleRange.length===
2)a=this.options.map.getZoom(),b=this.options.scaleRange,this.options.visibleAtScale=a>=b[0]&&a<=b[1];this._show()}},options:{},_requiredParams:["user","repo","featureSet"],_getFeatures:function(){var a="http://gitspatial.com/api/v1/"+this.options.user+"/"+this.options.repo+"/"+this.options.featureSet+"?callback="+this._globalPointer+"._processFeatures";this.options.showAll||(a+="&bbox="+this.options.map.getBounds().toBBoxString());this._makeJsonpRequest(a)}});

/* @license
 * jQuery.print, version 1.2.0
 *  (c) Sathvik Ponangi, Doers' Guild
 * Licence: CC-By (http://creativecommons.org/licenses/by/3.0/)
 *--------------------------------------------------------------------------*/

(function($) {"use strict";
    // A nice closure for our definitions

    function getjQueryObject(string) {
        // Make string a vaild jQuery thing
        var jqObj = $("");
        try {
            jqObj = $(string).clone();
        } catch(e) {
            jqObj = $("<span />").html(string);
        }
        return jqObj;
    }

    function isNode(o) {
        /* http://stackoverflow.com/a/384380/937891 */
        return !!( typeof Node === "object" ? o instanceof Node : o && typeof o === "object" && typeof o.nodeType === "number" && typeof o.nodeName === "string");
    }


    $.print = $.fn.print = function() {
        // Print a given set of elements

        var options, $this, self = this;

        // console.log("Printing", this, arguments);

        if ( self instanceof $) {
            // Get the node if it is a jQuery object
            self = self.get(0);
        }

        if (isNode(self)) {
            // If `this` is a HTML element, i.e. for
            // $(selector).print()
            $this = $(self);
            if (arguments.length > 0) {
                options = arguments[0];
            }
        } else {
            if (arguments.length > 0) {
                // $.print(selector,options)
                $this = $(arguments[0]);
                if (isNode($this[0])) {
                    if (arguments.length > 1) {
                        options = arguments[1];
                    }
                } else {
                    // $.print(options)
                    options = arguments[0];
                    $this = $("html");
                }
            } else {
                // $.print()
                $this = $("html");
            }
        }

        // Default options
        var defaults = {
            globalStyles : true,
            mediaPrint : false,
            stylesheet : null,
            noPrintSelector : ".no-print",
            iframe : true,
            append : null,
            prepend : null
        };
        // Merge with user-options
        options = $.extend({}, defaults, (options || {}));

        var $styles = $("");
        if (options.globalStyles) {
            // Apply the stlyes from the current sheet to the printed page
            $styles = $("style, link, meta, title");
        } else if (options.mediaPrint) {
            // Apply the media-print stylesheet
            $styles = $("link[media=print]");
        }
        if (options.stylesheet) {
            // Add a custom stylesheet if given
            $styles = $.merge($styles, $('<link rel="stylesheet" href="' + options.stylesheet + '">'));
        }

        // Create a copy of the element to print
        var copy = $this.clone();
        // Wrap it in a span to get the HTML markup string
        copy = $("<span/>").append(copy);
        // Remove unwanted elements
        copy.find(options.noPrintSelector).remove();
        // Add in the styles
        copy.append($styles.clone());
        // Appedned content
        copy.append(getjQueryObject(options.append));
        // Prepended content
        copy.prepend(getjQueryObject(options.prepend));
        // Get the HTML markup string
        var content = copy.html();
        // Destroy the copy
        copy.remove();

        var w, wdoc;
        if (options.iframe) {
            // Use an iframe for printing
            try {
                var $iframe = $(options.iframe + "");
                var iframeCount = $iframe.length;
                if (iframeCount === 0) {
                    // Create a new iFrame if none is given
                    $iframe = $('<iframe height="0" width="0" border="0" wmode="Opaque"/>').prependTo('body').css({
                        "position" : "absolute",
                        "top" : -999,
                        "left" : -999
                    });
                }
                w = $iframe.get(0);
                w = w.contentWindow || w.contentDocument || w;
                wdoc = w.document || w.contentDocument || w;
                wdoc.open();
                wdoc.write(content);
                wdoc.close();
                setTimeout(function() {
                    // Fix for IE : Allow it to render the iframe
                    w.focus();
                    try {
                        // Fix for IE11 - printng the whole page instead of the iframe content
                        if(!w.document.execCommand('print', false, null)) {
                            // document.execCommand returns false if it failed -http://stackoverflow.com/a/21336448/937891
                            w.print();
                        }
                    } catch(e) {
                        w.print();
                    }
                    setTimeout(function() {
                        // Fix for IE
                        if (iframeCount === 0) {
                            // Destroy the iframe if created here
                            $iframe.remove();
                        }
                    }, 100);
                }, 250);
            } catch (e) {
                // Use the pop-up method if iframe fails for some reason
                console.error("Failed to print from iframe", e.stack, e.message);
                w = window.open();
                w.document.write(content);
                w.document.close();
                w.focus();
                w.print();
                w.close();
            }
        } else {
            // Use a new window for printing
            w = window.open();
            w.document.write(content);
            w.document.close();
            w.focus();
            w.print();
            w.close();
        }
        return this;
    };

})(jQuery);

/*
	Leaflet.draw, a plugin that adds drawing and editing tools to Leaflet powered maps.
	(c) 2012-2013, Jacob Toye, Smartrak

	https://github.com/Leaflet/Leaflet.draw
	http://leafletjs.com
	https://github.com/jacobtoye
*/
!function(t,e){L.drawVersion="0.2.4-dev",L.drawLocal={draw:{toolbar:{actions:{title:"Cancel drawing",text:"Cancel"},undo:{title:"Delete last point drawn",text:"Delete last point"},buttons:{polyline:"Draw a polyline",polygon:"Draw a polygon",rectangle:"Draw a rectangle",circle:"Draw a circle",marker:"Draw a marker"}},handlers:{circle:{tooltip:{start:"Click and drag to draw circle."}},marker:{tooltip:{start:"Click map to place marker."}},polygon:{tooltip:{start:"Click to start drawing shape.",cont:"Click to continue drawing shape.",end:"Click first point to close this shape."}},polyline:{error:"<strong>Error:</strong> shape edges cannot cross!",tooltip:{start:"Click to start drawing line.",cont:"Click to continue drawing line.",end:"Click last point to finish line."}},rectangle:{tooltip:{start:"Click and drag to draw rectangle."}},simpleshape:{tooltip:{end:"Release mouse to finish drawing."}}}},edit:{toolbar:{actions:{save:{title:"Save changes.",text:"Save"},cancel:{title:"Cancel editing, discards all changes.",text:"Cancel"}},buttons:{edit:"Edit layers.",editDisabled:"No layers to edit.",remove:"Delete layers.",removeDisabled:"No layers to delete."}},handlers:{edit:{tooltip:{text:"Drag handles, or marker to edit feature.",subtext:"Click cancel to undo changes."}},remove:{tooltip:{text:"Click on a feature to remove"}}}}},L.Draw={},L.Draw.Feature=L.Handler.extend({includes:L.Mixin.Events,initialize:function(t,e){this._map=t,this._container=t._container,this._overlayPane=t._panes.overlayPane,this._popupPane=t._panes.popupPane,e&&e.shapeOptions&&(e.shapeOptions=L.Util.extend({},this.options.shapeOptions,e.shapeOptions)),L.setOptions(this,e)},enable:function(){this._enabled||(L.Handler.prototype.enable.call(this),this.fire("enabled",{handler:this.type}),this._map.fire("draw:drawstart",{layerType:this.type}))},disable:function(){this._enabled&&(L.Handler.prototype.disable.call(this),this._map.fire("draw:drawstop",{layerType:this.type}),this.fire("disabled",{handler:this.type}))},addHooks:function(){var t=this._map;t&&(L.DomUtil.disableTextSelection(),t.getContainer().focus(),this._tooltip=new L.Tooltip(this._map),L.DomEvent.on(this._container,"keyup",this._cancelDrawing,this))},removeHooks:function(){this._map&&(L.DomUtil.enableTextSelection(),this._tooltip.dispose(),this._tooltip=null,L.DomEvent.off(this._container,"keyup",this._cancelDrawing,this))},setOptions:function(t){L.setOptions(this,t)},_fireCreatedEvent:function(t){this._map.fire("draw:created",{layer:t,layerType:this.type})},_cancelDrawing:function(t){27===t.keyCode&&this.disable()}}),L.Draw.Polyline=L.Draw.Feature.extend({statics:{TYPE:"polyline"},Poly:L.Polyline,options:{allowIntersection:!0,repeatMode:!1,drawError:{color:"#b00b00",timeout:2500},icon:new L.DivIcon({iconSize:new L.Point(8,8),className:"leaflet-div-icon leaflet-editing-icon"}),guidelineDistance:20,maxGuideLineLength:4e3,shapeOptions:{stroke:!0,color:"#f06eaa",weight:4,opacity:.5,fill:!1,clickable:!0},metric:!0,showLength:!0,zIndexOffset:2e3},initialize:function(t,e){this.options.drawError.message=L.drawLocal.draw.handlers.polyline.error,e&&e.drawError&&(e.drawError=L.Util.extend({},this.options.drawError,e.drawError)),this.type=L.Draw.Polyline.TYPE,L.Draw.Feature.prototype.initialize.call(this,t,e)},addHooks:function(){L.Draw.Feature.prototype.addHooks.call(this),this._map&&(this._markers=[],this._markerGroup=new L.LayerGroup,this._map.addLayer(this._markerGroup),this._poly=new L.Polyline([],this.options.shapeOptions),this._tooltip.updateContent(this._getTooltipText()),this._mouseMarker||(this._mouseMarker=L.marker(this._map.getCenter(),{icon:L.divIcon({className:"leaflet-mouse-marker",iconAnchor:[20,20],iconSize:[40,40]}),opacity:0,zIndexOffset:this.options.zIndexOffset})),this._mouseMarker.on("mousedown",this._onMouseDown,this).addTo(this._map),this._map.on("mousemove",this._onMouseMove,this).on("mouseup",this._onMouseUp,this).on("zoomend",this._onZoomEnd,this))},removeHooks:function(){L.Draw.Feature.prototype.removeHooks.call(this),this._clearHideErrorTimeout(),this._cleanUpShape(),this._map.removeLayer(this._markerGroup),delete this._markerGroup,delete this._markers,this._map.removeLayer(this._poly),delete this._poly,this._mouseMarker.off("mousedown",this._onMouseDown,this).off("mouseup",this._onMouseUp,this),this._map.removeLayer(this._mouseMarker),delete this._mouseMarker,this._clearGuides(),this._map.off("mousemove",this._onMouseMove,this).off("zoomend",this._onZoomEnd,this)},deleteLastVertex:function(){if(!(this._markers.length<=1)){var t=this._markers.pop(),e=this._poly,i=this._poly.spliceLatLngs(e.getLatLngs().length-1,1)[0];this._markerGroup.removeLayer(t),e.getLatLngs().length<2&&this._map.removeLayer(e),this._vertexChanged(i,!1)}},addVertex:function(t){var e=this._markers.length;return e>0&&!this.options.allowIntersection&&this._poly.newLatLngIntersects(t)?(this._showErrorTooltip(),void 0):(this._errorShown&&this._hideErrorTooltip(),this._markers.push(this._createMarker(t)),this._poly.addLatLng(t),2===this._poly.getLatLngs().length&&this._map.addLayer(this._poly),this._vertexChanged(t,!0),void 0)},_finishShape:function(){var t=this._poly.newLatLngIntersects(this._poly.getLatLngs()[0],!0);return!this.options.allowIntersection&&t||!this._shapeIsValid()?(this._showErrorTooltip(),void 0):(this._fireCreatedEvent(),this.disable(),this.options.repeatMode&&this.enable(),void 0)},_shapeIsValid:function(){return!0},_onZoomEnd:function(){this._updateGuide()},_onMouseMove:function(t){var e=t.layerPoint,i=t.latlng;this._currentLatLng=i,this._updateTooltip(i),this._updateGuide(e),this._mouseMarker.setLatLng(i),L.DomEvent.preventDefault(t.originalEvent)},_vertexChanged:function(t,e){this._updateFinishHandler(),this._updateRunningMeasure(t,e),this._clearGuides(),this._updateTooltip()},_onMouseDown:function(t){var e=t.originalEvent;this._mouseDownOrigin=L.point(e.clientX,e.clientY)},_onMouseUp:function(e){if(this._mouseDownOrigin){var i=L.point(e.originalEvent.clientX,e.originalEvent.clientY).distanceTo(this._mouseDownOrigin);Math.abs(i)<9*(t.devicePixelRatio||1)&&this.addVertex(e.latlng)}this._mouseDownOrigin=null},_updateFinishHandler:function(){var t=this._markers.length;t>1&&this._markers[t-1].on("click",this._finishShape,this),t>2&&this._markers[t-2].off("click",this._finishShape,this)},_createMarker:function(t){var e=new L.Marker(t,{icon:this.options.icon,zIndexOffset:2*this.options.zIndexOffset});return this._markerGroup.addLayer(e),e},_updateGuide:function(t){var e=this._markers.length;e>0&&(t=t||this._map.latLngToLayerPoint(this._currentLatLng),this._clearGuides(),this._drawGuide(this._map.latLngToLayerPoint(this._markers[e-1].getLatLng()),t))},_updateTooltip:function(t){var e=this._getTooltipText();t&&this._tooltip.updatePosition(t),this._errorShown||this._tooltip.updateContent(e)},_drawGuide:function(t,e){var i,o,a,s=Math.floor(Math.sqrt(Math.pow(e.x-t.x,2)+Math.pow(e.y-t.y,2))),r=this.options.guidelineDistance,n=this.options.maxGuideLineLength,l=s>n?s-n:r;for(this._guidesContainer||(this._guidesContainer=L.DomUtil.create("div","leaflet-draw-guides",this._overlayPane));s>l;l+=this.options.guidelineDistance)i=l/s,o={x:Math.floor(t.x*(1-i)+i*e.x),y:Math.floor(t.y*(1-i)+i*e.y)},a=L.DomUtil.create("div","leaflet-draw-guide-dash",this._guidesContainer),a.style.backgroundColor=this._errorShown?this.options.drawError.color:this.options.shapeOptions.color,L.DomUtil.setPosition(a,o)},_updateGuideColor:function(t){if(this._guidesContainer)for(var e=0,i=this._guidesContainer.childNodes.length;i>e;e++)this._guidesContainer.childNodes[e].style.backgroundColor=t},_clearGuides:function(){if(this._guidesContainer)for(;this._guidesContainer.firstChild;)this._guidesContainer.removeChild(this._guidesContainer.firstChild)},_getTooltipText:function(){var t,e,i=this.options.showLength;return 0===this._markers.length?t={text:L.drawLocal.draw.handlers.polyline.tooltip.start}:(e=i?this._getMeasurementString():"",t=1===this._markers.length?{text:L.drawLocal.draw.handlers.polyline.tooltip.cont,subtext:e}:{text:L.drawLocal.draw.handlers.polyline.tooltip.end,subtext:e}),t},_updateRunningMeasure:function(t,e){var i,o,a=this._markers.length;1===this._markers.length?this._measurementRunningTotal=0:(i=a-(e?2:1),o=t.distanceTo(this._markers[i].getLatLng()),this._measurementRunningTotal+=o*(e?1:-1))},_getMeasurementString:function(){var t,e=this._currentLatLng,i=this._markers[this._markers.length-1].getLatLng();return t=this._measurementRunningTotal+e.distanceTo(i),L.GeometryUtil.readableDistance(t,this.options.metric)},_showErrorTooltip:function(){this._errorShown=!0,this._tooltip.showAsError().updateContent({text:this.options.drawError.message}),this._updateGuideColor(this.options.drawError.color),this._poly.setStyle({color:this.options.drawError.color}),this._clearHideErrorTimeout(),this._hideErrorTimeout=setTimeout(L.Util.bind(this._hideErrorTooltip,this),this.options.drawError.timeout)},_hideErrorTooltip:function(){this._errorShown=!1,this._clearHideErrorTimeout(),this._tooltip.removeError().updateContent(this._getTooltipText()),this._updateGuideColor(this.options.shapeOptions.color),this._poly.setStyle({color:this.options.shapeOptions.color})},_clearHideErrorTimeout:function(){this._hideErrorTimeout&&(clearTimeout(this._hideErrorTimeout),this._hideErrorTimeout=null)},_cleanUpShape:function(){this._markers.length>1&&this._markers[this._markers.length-1].off("click",this._finishShape,this)},_fireCreatedEvent:function(){var t=new this.Poly(this._poly.getLatLngs(),this.options.shapeOptions);L.Draw.Feature.prototype._fireCreatedEvent.call(this,t)}}),L.Draw.Polygon=L.Draw.Polyline.extend({statics:{TYPE:"polygon"},Poly:L.Polygon,options:{showArea:!1,shapeOptions:{stroke:!0,color:"#f06eaa",weight:4,opacity:.5,fill:!0,fillColor:null,fillOpacity:.2,clickable:!0}},initialize:function(t,e){L.Draw.Polyline.prototype.initialize.call(this,t,e),this.type=L.Draw.Polygon.TYPE},_updateFinishHandler:function(){var t=this._markers.length;1===t&&this._markers[0].on("click",this._finishShape,this),t>2&&(this._markers[t-1].on("dblclick",this._finishShape,this),t>3&&this._markers[t-2].off("dblclick",this._finishShape,this))},_getTooltipText:function(){var t,e;return 0===this._markers.length?t=L.drawLocal.draw.handlers.polygon.tooltip.start:this._markers.length<3?t=L.drawLocal.draw.handlers.polygon.tooltip.cont:(t=L.drawLocal.draw.handlers.polygon.tooltip.end,e=this._getMeasurementString()),{text:t,subtext:e}},_getMeasurementString:function(){var t=this._area;return t?L.GeometryUtil.readableArea(t,this.options.metric):null},_shapeIsValid:function(){return this._markers.length>=3},_vertexChanged:function(t,e){var i;!this.options.allowIntersection&&this.options.showArea&&(i=this._poly.getLatLngs(),this._area=L.GeometryUtil.geodesicArea(i)),L.Draw.Polyline.prototype._vertexChanged.call(this,t,e)},_cleanUpShape:function(){var t=this._markers.length;t>0&&(this._markers[0].off("click",this._finishShape,this),t>2&&this._markers[t-1].off("dblclick",this._finishShape,this))}}),L.SimpleShape={},L.Draw.SimpleShape=L.Draw.Feature.extend({options:{repeatMode:!1},initialize:function(t,e){this._endLabelText=L.drawLocal.draw.handlers.simpleshape.tooltip.end,L.Draw.Feature.prototype.initialize.call(this,t,e)},addHooks:function(){L.Draw.Feature.prototype.addHooks.call(this),this._map&&(this._mapDraggable=this._map.dragging.enabled(),this._mapDraggable&&this._map.dragging.disable(),this._container.style.cursor="crosshair",this._tooltip.updateContent({text:this._initialLabelText}),this._map.on("mousedown",this._onMouseDown,this).on("mousemove",this._onMouseMove,this))},removeHooks:function(){L.Draw.Feature.prototype.removeHooks.call(this),this._map&&(this._mapDraggable&&this._map.dragging.enable(),this._container.style.cursor="",this._map.off("mousedown",this._onMouseDown,this).off("mousemove",this._onMouseMove,this),L.DomEvent.off(e,"mouseup",this._onMouseUp,this),this._shape&&(this._map.removeLayer(this._shape),delete this._shape)),this._isDrawing=!1},_getTooltipText:function(){return{text:this._endLabelText}},_onMouseDown:function(t){this._isDrawing=!0,this._startLatLng=t.latlng,L.DomEvent.on(e,"mouseup",this._onMouseUp,this).preventDefault(t.originalEvent)},_onMouseMove:function(t){var e=t.latlng;this._tooltip.updatePosition(e),this._isDrawing&&(this._tooltip.updateContent(this._getTooltipText()),this._drawShape(e))},_onMouseUp:function(){this._shape&&this._fireCreatedEvent(),this.disable(),this.options.repeatMode&&this.enable()}}),L.Draw.Rectangle=L.Draw.SimpleShape.extend({statics:{TYPE:"rectangle"},options:{shapeOptions:{stroke:!0,color:"#f06eaa",weight:4,opacity:.5,fill:!0,fillColor:null,fillOpacity:.2,clickable:!0},metric:!0},initialize:function(t,e){this.type=L.Draw.Rectangle.TYPE,this._initialLabelText=L.drawLocal.draw.handlers.rectangle.tooltip.start,L.Draw.SimpleShape.prototype.initialize.call(this,t,e)},_drawShape:function(t){this._shape?this._shape.setBounds(new L.LatLngBounds(this._startLatLng,t)):(this._shape=new L.Rectangle(new L.LatLngBounds(this._startLatLng,t),this.options.shapeOptions),this._map.addLayer(this._shape))},_fireCreatedEvent:function(){var t=new L.Rectangle(this._shape.getBounds(),this.options.shapeOptions);L.Draw.SimpleShape.prototype._fireCreatedEvent.call(this,t)},_getTooltipText:function(){var t,e,i,o=L.Draw.SimpleShape.prototype._getTooltipText.call(this),a=this._shape;return a&&(t=this._shape.getLatLngs(),e=L.GeometryUtil.geodesicArea(t),i=L.GeometryUtil.readableArea(e,this.options.metric)),{text:o.text,subtext:i}}}),L.Draw.Circle=L.Draw.SimpleShape.extend({statics:{TYPE:"circle"},options:{shapeOptions:{stroke:!0,color:"#f06eaa",weight:4,opacity:.5,fill:!0,fillColor:null,fillOpacity:.2,clickable:!0},showRadius:!0,metric:!0},initialize:function(t,e){this.type=L.Draw.Circle.TYPE,this._initialLabelText=L.drawLocal.draw.handlers.circle.tooltip.start,L.Draw.SimpleShape.prototype.initialize.call(this,t,e)},_drawShape:function(t){this._shape?this._shape.setRadius(this._startLatLng.distanceTo(t)):(this._shape=new L.Circle(this._startLatLng,this._startLatLng.distanceTo(t),this.options.shapeOptions),this._map.addLayer(this._shape))},_fireCreatedEvent:function(){var t=new L.Circle(this._startLatLng,this._shape.getRadius(),this.options.shapeOptions);L.Draw.SimpleShape.prototype._fireCreatedEvent.call(this,t)},_onMouseMove:function(t){var e,i=t.latlng,o=this.options.showRadius,a=this.options.metric;this._tooltip.updatePosition(i),this._isDrawing&&(this._drawShape(i),e=this._shape.getRadius().toFixed(1),this._tooltip.updateContent({text:this._endLabelText,subtext:o?"Radius: "+L.GeometryUtil.readableDistance(e,a):""}))}}),L.Draw.Marker=L.Draw.Feature.extend({statics:{TYPE:"marker"},options:{icon:new L.Icon.Default,repeatMode:!1,zIndexOffset:2e3},initialize:function(t,e){this.type=L.Draw.Marker.TYPE,L.Draw.Feature.prototype.initialize.call(this,t,e)},addHooks:function(){L.Draw.Feature.prototype.addHooks.call(this),this._map&&(this._tooltip.updateContent({text:L.drawLocal.draw.handlers.marker.tooltip.start}),this._mouseMarker||(this._mouseMarker=L.marker(this._map.getCenter(),{icon:L.divIcon({className:"leaflet-mouse-marker",iconAnchor:[20,20],iconSize:[40,40]}),opacity:0,zIndexOffset:this.options.zIndexOffset})),this._mouseMarker.on("click",this._onClick,this).addTo(this._map),this._map.on("mousemove",this._onMouseMove,this))},removeHooks:function(){L.Draw.Feature.prototype.removeHooks.call(this),this._map&&(this._marker&&(this._marker.off("click",this._onClick,this),this._map.off("click",this._onClick,this).removeLayer(this._marker),delete this._marker),this._mouseMarker.off("click",this._onClick,this),this._map.removeLayer(this._mouseMarker),delete this._mouseMarker,this._map.off("mousemove",this._onMouseMove,this))},_onMouseMove:function(t){var e=t.latlng;this._tooltip.updatePosition(e),this._mouseMarker.setLatLng(e),this._marker?(e=this._mouseMarker.getLatLng(),this._marker.setLatLng(e)):(this._marker=new L.Marker(e,{icon:this.options.icon,zIndexOffset:this.options.zIndexOffset}),this._marker.on("click",this._onClick,this),this._map.on("click",this._onClick,this).addLayer(this._marker))},_onClick:function(){this._fireCreatedEvent(),this.disable(),this.options.repeatMode&&this.enable()},_fireCreatedEvent:function(){var t=new L.Marker(this._marker.getLatLng(),{icon:this.options.icon});L.Draw.Feature.prototype._fireCreatedEvent.call(this,t)}}),L.Edit=L.Edit||{},L.Edit.Poly=L.Handler.extend({options:{icon:new L.DivIcon({iconSize:new L.Point(8,8),className:"leaflet-div-icon leaflet-editing-icon"})},initialize:function(t,e){this._poly=t,L.setOptions(this,e)},addHooks:function(){this._poly._map&&(this._markerGroup||this._initMarkers(),this._poly._map.addLayer(this._markerGroup))},removeHooks:function(){this._poly._map&&(this._poly._map.removeLayer(this._markerGroup),delete this._markerGroup,delete this._markers)},updateMarkers:function(){this._markerGroup.clearLayers(),this._initMarkers()},_initMarkers:function(){this._markerGroup||(this._markerGroup=new L.LayerGroup),this._markers=[];var t,e,i,o,a=this._poly._latlngs;for(t=0,i=a.length;i>t;t++)o=this._createMarker(a[t],t),o.on("click",this._onMarkerClick,this),this._markers.push(o);var s,r;for(t=0,e=i-1;i>t;e=t++)(0!==t||L.Polygon&&this._poly instanceof L.Polygon)&&(s=this._markers[e],r=this._markers[t],this._createMiddleMarker(s,r),this._updatePrevNext(s,r))},_createMarker:function(t,e){var i=new L.Marker(t,{draggable:!0,icon:this.options.icon});return i._origLatLng=t,i._index=e,i.on("drag",this._onMarkerDrag,this),i.on("dragend",this._fireEdit,this),this._markerGroup.addLayer(i),i},_removeMarker:function(t){var e=t._index;this._markerGroup.removeLayer(t),this._markers.splice(e,1),this._poly.spliceLatLngs(e,1),this._updateIndexes(e,-1),t.off("drag",this._onMarkerDrag,this).off("dragend",this._fireEdit,this).off("click",this._onMarkerClick,this)},_fireEdit:function(){this._poly.edited=!0,this._poly.fire("edit")},_onMarkerDrag:function(t){var e=t.target;L.extend(e._origLatLng,e._latlng),e._middleLeft&&e._middleLeft.setLatLng(this._getMiddleLatLng(e._prev,e)),e._middleRight&&e._middleRight.setLatLng(this._getMiddleLatLng(e,e._next)),this._poly.redraw()},_onMarkerClick:function(t){var e=L.Polygon&&this._poly instanceof L.Polygon?4:3,i=t.target;this._poly._latlngs.length<e||(this._removeMarker(i),this._updatePrevNext(i._prev,i._next),i._middleLeft&&this._markerGroup.removeLayer(i._middleLeft),i._middleRight&&this._markerGroup.removeLayer(i._middleRight),i._prev&&i._next?this._createMiddleMarker(i._prev,i._next):i._prev?i._next||(i._prev._middleRight=null):i._next._middleLeft=null,this._fireEdit())},_updateIndexes:function(t,e){this._markerGroup.eachLayer(function(i){i._index>t&&(i._index+=e)})},_createMiddleMarker:function(t,e){var i,o,a,s=this._getMiddleLatLng(t,e),r=this._createMarker(s);r.setOpacity(.6),t._middleRight=e._middleLeft=r,o=function(){var o=e._index;r._index=o,r.off("click",i,this).on("click",this._onMarkerClick,this),s.lat=r.getLatLng().lat,s.lng=r.getLatLng().lng,this._poly.spliceLatLngs(o,0,s),this._markers.splice(o,0,r),r.setOpacity(1),this._updateIndexes(o,1),e._index++,this._updatePrevNext(t,r),this._updatePrevNext(r,e),this._poly.fire("editstart")},a=function(){r.off("dragstart",o,this),r.off("dragend",a,this),this._createMiddleMarker(t,r),this._createMiddleMarker(r,e)},i=function(){o.call(this),a.call(this),this._fireEdit()},r.on("click",i,this).on("dragstart",o,this).on("dragend",a,this),this._markerGroup.addLayer(r)},_updatePrevNext:function(t,e){t&&(t._next=e),e&&(e._prev=t)},_getMiddleLatLng:function(t,e){var i=this._poly._map,o=i.project(t.getLatLng()),a=i.project(e.getLatLng());return i.unproject(o._add(a)._divideBy(2))}}),L.Polyline.addInitHook(function(){this.editing||(L.Edit.Poly&&(this.editing=new L.Edit.Poly(this),this.options.editable&&this.editing.enable()),this.on("add",function(){this.editing&&this.editing.enabled()&&this.editing.addHooks()}),this.on("remove",function(){this.editing&&this.editing.enabled()&&this.editing.removeHooks()}))}),L.Edit=L.Edit||{},L.Edit.SimpleShape=L.Handler.extend({options:{moveIcon:new L.DivIcon({iconSize:new L.Point(8,8),className:"leaflet-div-icon leaflet-editing-icon leaflet-edit-move"}),resizeIcon:new L.DivIcon({iconSize:new L.Point(8,8),className:"leaflet-div-icon leaflet-editing-icon leaflet-edit-resize"})},initialize:function(t,e){this._shape=t,L.Util.setOptions(this,e)},addHooks:function(){this._shape._map&&(this._map=this._shape._map,this._markerGroup||this._initMarkers(),this._map.addLayer(this._markerGroup))},removeHooks:function(){if(this._shape._map){this._unbindMarker(this._moveMarker);for(var t=0,e=this._resizeMarkers.length;e>t;t++)this._unbindMarker(this._resizeMarkers[t]);this._resizeMarkers=null,this._map.removeLayer(this._markerGroup),delete this._markerGroup}this._map=null},updateMarkers:function(){this._markerGroup.clearLayers(),this._initMarkers()},_initMarkers:function(){this._markerGroup||(this._markerGroup=new L.LayerGroup),this._createMoveMarker(),this._createResizeMarker()},_createMoveMarker:function(){},_createResizeMarker:function(){},_createMarker:function(t,e){var i=new L.Marker(t,{draggable:!0,icon:e,zIndexOffset:10});return this._bindMarker(i),this._markerGroup.addLayer(i),i},_bindMarker:function(t){t.on("dragstart",this._onMarkerDragStart,this).on("drag",this._onMarkerDrag,this).on("dragend",this._onMarkerDragEnd,this)},_unbindMarker:function(t){t.off("dragstart",this._onMarkerDragStart,this).off("drag",this._onMarkerDrag,this).off("dragend",this._onMarkerDragEnd,this)},_onMarkerDragStart:function(t){var e=t.target;e.setOpacity(0),this._shape.fire("editstart")},_fireEdit:function(){this._shape.edited=!0,this._shape.fire("edit")},_onMarkerDrag:function(t){var e=t.target,i=e.getLatLng();e===this._moveMarker?this._move(i):this._resize(i),this._shape.redraw()},_onMarkerDragEnd:function(t){var e=t.target;e.setOpacity(1),this._fireEdit()},_move:function(){},_resize:function(){}}),L.Edit=L.Edit||{},L.Edit.Rectangle=L.Edit.SimpleShape.extend({_createMoveMarker:function(){var t=this._shape.getBounds(),e=t.getCenter();this._moveMarker=this._createMarker(e,this.options.moveIcon)},_createResizeMarker:function(){var t=this._getCorners();this._resizeMarkers=[];for(var e=0,i=t.length;i>e;e++)this._resizeMarkers.push(this._createMarker(t[e],this.options.resizeIcon)),this._resizeMarkers[e]._cornerIndex=e},_onMarkerDragStart:function(t){L.Edit.SimpleShape.prototype._onMarkerDragStart.call(this,t);var e=this._getCorners(),i=t.target,o=i._cornerIndex;this._oppositeCorner=e[(o+2)%4],this._toggleCornerMarkers(0,o)},_onMarkerDragEnd:function(t){var e,i,o=t.target;o===this._moveMarker&&(e=this._shape.getBounds(),i=e.getCenter(),o.setLatLng(i)),this._toggleCornerMarkers(1),this._repositionCornerMarkers(),L.Edit.SimpleShape.prototype._onMarkerDragEnd.call(this,t)},_move:function(t){for(var e,i=this._shape.getLatLngs(),o=this._shape.getBounds(),a=o.getCenter(),s=[],r=0,n=i.length;n>r;r++)e=[i[r].lat-a.lat,i[r].lng-a.lng],s.push([t.lat+e[0],t.lng+e[1]]);this._shape.setLatLngs(s),this._repositionCornerMarkers()},_resize:function(t){var e;this._shape.setBounds(L.latLngBounds(t,this._oppositeCorner)),e=this._shape.getBounds(),this._moveMarker.setLatLng(e.getCenter())},_getCorners:function(){var t=this._shape.getBounds(),e=t.getNorthWest(),i=t.getNorthEast(),o=t.getSouthEast(),a=t.getSouthWest();return[e,i,o,a]},_toggleCornerMarkers:function(t){for(var e=0,i=this._resizeMarkers.length;i>e;e++)this._resizeMarkers[e].setOpacity(t)},_repositionCornerMarkers:function(){for(var t=this._getCorners(),e=0,i=this._resizeMarkers.length;i>e;e++)this._resizeMarkers[e].setLatLng(t[e])}}),L.Rectangle.addInitHook(function(){L.Edit.Rectangle&&(this.editing=new L.Edit.Rectangle(this),this.options.editable&&this.editing.enable())}),L.Edit=L.Edit||{},L.Edit.Circle=L.Edit.SimpleShape.extend({_createMoveMarker:function(){var t=this._shape.getLatLng();this._moveMarker=this._createMarker(t,this.options.moveIcon)},_createResizeMarker:function(){var t=this._shape.getLatLng(),e=this._getResizeMarkerPoint(t);this._resizeMarkers=[],this._resizeMarkers.push(this._createMarker(e,this.options.resizeIcon))},_getResizeMarkerPoint:function(t){var e=this._shape._radius*Math.cos(Math.PI/4),i=this._map.project(t);return this._map.unproject([i.x+e,i.y-e])},_move:function(t){var e=this._getResizeMarkerPoint(t);this._resizeMarkers[0].setLatLng(e),this._shape.setLatLng(t)},_resize:function(t){var e=this._moveMarker.getLatLng(),i=e.distanceTo(t);this._shape.setRadius(i)}}),L.Circle.addInitHook(function(){L.Edit.Circle&&(this.editing=new L.Edit.Circle(this),this.options.editable&&this.editing.enable()),this.on("add",function(){this.editing&&this.editing.enabled()&&this.editing.addHooks()}),this.on("remove",function(){this.editing&&this.editing.enabled()&&this.editing.removeHooks()})}),L.LatLngUtil={cloneLatLngs:function(t){for(var e=[],i=0,o=t.length;o>i;i++)e.push(this.cloneLatLng(t[i]));return e},cloneLatLng:function(t){return L.latLng(t.lat,t.lng)}},L.GeometryUtil=L.extend(L.GeometryUtil||{},{geodesicArea:function(t){var e,i,o=t.length,a=0,s=L.LatLng.DEG_TO_RAD;if(o>2){for(var r=0;o>r;r++)e=t[r],i=t[(r+1)%o],a+=(i.lng-e.lng)*s*(2+Math.sin(e.lat*s)+Math.sin(i.lat*s));a=6378137*a*6378137/2}return Math.abs(a)},readableArea:function(t,e){var i;return e?i=t>=1e4?(1e-4*t).toFixed(2)+" ha":t.toFixed(2)+" m&sup2;":(t/=.836127,i=t>=3097600?(t/3097600).toFixed(2)+" mi&sup2;":t>=4840?(t/4840).toFixed(2)+" acres":Math.ceil(t)+" yd&sup2;"),i},readableDistance:function(t,e){var i;return e?i=t>1e3?(t/1e3).toFixed(2)+" km":Math.ceil(t)+" m":(t*=1.09361,i=t>1760?(t/1760).toFixed(2)+" miles":Math.ceil(t)+" yd"),i}}),L.Util.extend(L.LineUtil,{segmentsIntersect:function(t,e,i,o){return this._checkCounterclockwise(t,i,o)!==this._checkCounterclockwise(e,i,o)&&this._checkCounterclockwise(t,e,i)!==this._checkCounterclockwise(t,e,o)},_checkCounterclockwise:function(t,e,i){return(i.y-t.y)*(e.x-t.x)>(e.y-t.y)*(i.x-t.x)}}),L.Polyline.include({intersects:function(){var t,e,i,o=this._originalPoints,a=o?o.length:0;if(this._tooFewPointsForIntersection())return!1;for(t=a-1;t>=3;t--)if(e=o[t-1],i=o[t],this._lineSegmentsIntersectsRange(e,i,t-2))return!0;return!1},newLatLngIntersects:function(t,e){return this._map?this.newPointIntersects(this._map.latLngToLayerPoint(t),e):!1},newPointIntersects:function(t,e){var i=this._originalPoints,o=i?i.length:0,a=i?i[o-1]:null,s=o-2;return this._tooFewPointsForIntersection(1)?!1:this._lineSegmentsIntersectsRange(a,t,s,e?1:0)},_tooFewPointsForIntersection:function(t){var e=this._originalPoints,i=e?e.length:0;return i+=t||0,!this._originalPoints||3>=i},_lineSegmentsIntersectsRange:function(t,e,i,o){var a,s,r=this._originalPoints;o=o||0;for(var n=i;n>o;n--)if(a=r[n-1],s=r[n],L.LineUtil.segmentsIntersect(t,e,a,s))return!0;return!1}}),L.Polygon.include({intersects:function(){var t,e,i,o,a,s=this._originalPoints;return this._tooFewPointsForIntersection()?!1:(t=L.Polyline.prototype.intersects.call(this))?!0:(e=s.length,i=s[0],o=s[e-1],a=e-2,this._lineSegmentsIntersectsRange(o,i,a,1))}}),L.Control.Draw=L.Control.extend({options:{position:"topleft",draw:{},edit:!1},initialize:function(t){if(L.version<"0.7")throw new Error("Leaflet.draw 0.2.3+ requires Leaflet 0.7.0+. Download latest from https://github.com/Leaflet/Leaflet/");L.Control.prototype.initialize.call(this,t);var e;this._toolbars={},L.DrawToolbar&&this.options.draw&&(e=new L.DrawToolbar(this.options.draw),this._toolbars[L.DrawToolbar.TYPE]=e,this._toolbars[L.DrawToolbar.TYPE].on("enable",this._toolbarEnabled,this)),L.EditToolbar&&this.options.edit&&(e=new L.EditToolbar(this.options.edit),this._toolbars[L.EditToolbar.TYPE]=e,this._toolbars[L.EditToolbar.TYPE].on("enable",this._toolbarEnabled,this))},onAdd:function(t){var e,i=L.DomUtil.create("div","leaflet-draw"),o=!1,a="leaflet-draw-toolbar-top";for(var s in this._toolbars)this._toolbars.hasOwnProperty(s)&&(e=this._toolbars[s].addToolbar(t),e&&(o||(L.DomUtil.hasClass(e,a)||L.DomUtil.addClass(e.childNodes[0],a),o=!0),i.appendChild(e)));return i},onRemove:function(){for(var t in this._toolbars)this._toolbars.hasOwnProperty(t)&&this._toolbars[t].removeToolbar()},setDrawingOptions:function(t){for(var e in this._toolbars)this._toolbars[e]instanceof L.DrawToolbar&&this._toolbars[e].setOptions(t)},_toolbarEnabled:function(t){var e=t.target;for(var i in this._toolbars)this._toolbars[i]!==e&&this._toolbars[i].disable()}}),L.Map.mergeOptions({drawControlTooltips:!0,drawControl:!1}),L.Map.addInitHook(function(){this.options.drawControl&&(this.drawControl=new L.Control.Draw,this.addControl(this.drawControl))}),L.Toolbar=L.Class.extend({includes:[L.Mixin.Events],initialize:function(t){L.setOptions(this,t),this._modes={},this._actionButtons=[],this._activeMode=null},enabled:function(){return null!==this._activeMode},disable:function(){this.enabled()&&this._activeMode.handler.disable()},addToolbar:function(t){var e,i=L.DomUtil.create("div","leaflet-draw-section"),o=0,a=this._toolbarClass||"",s=this.getModeHandlers(t);for(this._toolbarContainer=L.DomUtil.create("div","leaflet-draw-toolbar leaflet-bar"),this._map=t,e=0;e<s.length;e++)s[e].enabled&&this._initModeHandler(s[e].handler,this._toolbarContainer,o++,a,s[e].title);return o?(this._lastButtonIndex=--o,this._actionsContainer=L.DomUtil.create("ul","leaflet-draw-actions"),i.appendChild(this._toolbarContainer),i.appendChild(this._actionsContainer),i):void 0},removeToolbar:function(){for(var t in this._modes)this._modes.hasOwnProperty(t)&&(this._disposeButton(this._modes[t].button,this._modes[t].handler.enable,this._modes[t].handler),this._modes[t].handler.disable(),this._modes[t].handler.off("enabled",this._handlerActivated,this).off("disabled",this._handlerDeactivated,this));this._modes={};for(var e=0,i=this._actionButtons.length;i>e;e++)this._disposeButton(this._actionButtons[e].button,this._actionButtons[e].callback,this);this._actionButtons=[],this._actionsContainer=null},_initModeHandler:function(t,e,i,o,a){var s=t.type;this._modes[s]={},this._modes[s].handler=t,this._modes[s].button=this._createButton({title:a,className:o+"-"+s,container:e,callback:this._modes[s].handler.enable,context:this._modes[s].handler}),this._modes[s].buttonIndex=i,this._modes[s].handler.on("enabled",this._handlerActivated,this).on("disabled",this._handlerDeactivated,this)},_createButton:function(t){var e=L.DomUtil.create("a",t.className||"",t.container);return e.href="#",t.text&&(e.innerHTML=t.text),t.title&&(e.title=t.title),L.DomEvent.on(e,"click",L.DomEvent.stopPropagation).on(e,"mousedown",L.DomEvent.stopPropagation).on(e,"dblclick",L.DomEvent.stopPropagation).on(e,"click",L.DomEvent.preventDefault).on(e,"click",t.callback,t.context),e},_disposeButton:function(t,e){L.DomEvent.off(t,"click",L.DomEvent.stopPropagation).off(t,"mousedown",L.DomEvent.stopPropagation).off(t,"dblclick",L.DomEvent.stopPropagation).off(t,"click",L.DomEvent.preventDefault).off(t,"click",e)},_handlerActivated:function(t){this.disable(),this._activeMode=this._modes[t.handler],L.DomUtil.addClass(this._activeMode.button,"leaflet-draw-toolbar-button-enabled"),this._showActionsToolbar(),this.fire("enable")},_handlerDeactivated:function(){this._hideActionsToolbar(),L.DomUtil.removeClass(this._activeMode.button,"leaflet-draw-toolbar-button-enabled"),this._activeMode=null,this.fire("disable")},_createActions:function(t){var e,i,o,a,s=this._actionsContainer,r=this.getActions(t),n=r.length;for(i=0,o=this._actionButtons.length;o>i;i++)this._disposeButton(this._actionButtons[i].button,this._actionButtons[i].callback);for(this._actionButtons=[];s.firstChild;)s.removeChild(s.firstChild);for(var l=0;n>l;l++)"enabled"in r[l]&&!r[l].enabled||(e=L.DomUtil.create("li","",s),a=this._createButton({title:r[l].title,text:r[l].text,container:e,callback:r[l].callback,context:r[l].context}),this._actionButtons.push({button:a,callback:r[l].callback}))},_showActionsToolbar:function(){var t=this._activeMode.buttonIndex,e=this._lastButtonIndex,i=this._activeMode.button.offsetTop-1;
this._createActions(this._activeMode.handler),this._actionsContainer.style.top=i+"px",0===t&&(L.DomUtil.addClass(this._toolbarContainer,"leaflet-draw-toolbar-notop"),L.DomUtil.addClass(this._actionsContainer,"leaflet-draw-actions-top")),t===e&&(L.DomUtil.addClass(this._toolbarContainer,"leaflet-draw-toolbar-nobottom"),L.DomUtil.addClass(this._actionsContainer,"leaflet-draw-actions-bottom")),this._actionsContainer.style.display="block"},_hideActionsToolbar:function(){this._actionsContainer.style.display="none",L.DomUtil.removeClass(this._toolbarContainer,"leaflet-draw-toolbar-notop"),L.DomUtil.removeClass(this._toolbarContainer,"leaflet-draw-toolbar-nobottom"),L.DomUtil.removeClass(this._actionsContainer,"leaflet-draw-actions-top"),L.DomUtil.removeClass(this._actionsContainer,"leaflet-draw-actions-bottom")}}),L.Tooltip=L.Class.extend({initialize:function(t){this._map=t,this._popupPane=t._panes.popupPane,this._container=t.options.drawControlTooltips?L.DomUtil.create("div","leaflet-draw-tooltip",this._popupPane):null,this._singleLineLabel=!1},dispose:function(){this._container&&(this._popupPane.removeChild(this._container),this._container=null)},updateContent:function(t){return this._container?(t.subtext=t.subtext||"",0!==t.subtext.length||this._singleLineLabel?t.subtext.length>0&&this._singleLineLabel&&(L.DomUtil.removeClass(this._container,"leaflet-draw-tooltip-single"),this._singleLineLabel=!1):(L.DomUtil.addClass(this._container,"leaflet-draw-tooltip-single"),this._singleLineLabel=!0),this._container.innerHTML=(t.subtext.length>0?'<span class="leaflet-draw-tooltip-subtext">'+t.subtext+"</span><br />":"")+"<span>"+t.text+"</span>",this):this},updatePosition:function(t){var e=this._map.latLngToLayerPoint(t),i=this._container;return this._container&&(i.style.visibility="inherit",L.DomUtil.setPosition(i,e)),this},showAsError:function(){return this._container&&L.DomUtil.addClass(this._container,"leaflet-error-draw-tooltip"),this},removeError:function(){return this._container&&L.DomUtil.removeClass(this._container,"leaflet-error-draw-tooltip"),this}}),L.DrawToolbar=L.Toolbar.extend({statics:{TYPE:"draw"},options:{polyline:{},polygon:{},rectangle:{},circle:{},marker:{}},initialize:function(t){for(var e in this.options)this.options.hasOwnProperty(e)&&t[e]&&(t[e]=L.extend({},this.options[e],t[e]));this._toolbarClass="leaflet-draw-draw",L.Toolbar.prototype.initialize.call(this,t)},getModeHandlers:function(t){return[{enabled:this.options.polyline,handler:new L.Draw.Polyline(t,this.options.polyline),title:L.drawLocal.draw.toolbar.buttons.polyline},{enabled:this.options.polygon,handler:new L.Draw.Polygon(t,this.options.polygon),title:L.drawLocal.draw.toolbar.buttons.polygon},{enabled:this.options.rectangle,handler:new L.Draw.Rectangle(t,this.options.rectangle),title:L.drawLocal.draw.toolbar.buttons.rectangle},{enabled:this.options.circle,handler:new L.Draw.Circle(t,this.options.circle),title:L.drawLocal.draw.toolbar.buttons.circle},{enabled:this.options.marker,handler:new L.Draw.Marker(t,this.options.marker),title:L.drawLocal.draw.toolbar.buttons.marker}]},getActions:function(t){return[{enabled:t.deleteLastVertex,title:L.drawLocal.draw.toolbar.undo.title,text:L.drawLocal.draw.toolbar.undo.text,callback:t.deleteLastVertex,context:t},{title:L.drawLocal.draw.toolbar.actions.title,text:L.drawLocal.draw.toolbar.actions.text,callback:this.disable,context:this}]},setOptions:function(t){L.setOptions(this,t);for(var e in this._modes)this._modes.hasOwnProperty(e)&&t.hasOwnProperty(e)&&this._modes[e].handler.setOptions(t[e])}}),L.EditToolbar=L.Toolbar.extend({statics:{TYPE:"edit"},options:{edit:{selectedPathOptions:{color:"#fe57a1",opacity:.6,dashArray:"10, 10",fill:!0,fillColor:"#fe57a1",fillOpacity:.1,maintainColor:!1}},remove:{},featureGroup:null},initialize:function(t){t.edit&&("undefined"==typeof t.edit.selectedPathOptions&&(t.edit.selectedPathOptions=this.options.edit.selectedPathOptions),t.edit.selectedPathOptions=L.extend({},this.options.edit.selectedPathOptions,t.edit.selectedPathOptions)),t.remove&&(t.remove=L.extend({},this.options.remove,t.remove)),this._toolbarClass="leaflet-draw-edit",L.Toolbar.prototype.initialize.call(this,t),this._selectedFeatureCount=0},getModeHandlers:function(t){var e=this.options.featureGroup;return[{enabled:this.options.edit,handler:new L.EditToolbar.Edit(t,{featureGroup:e,selectedPathOptions:this.options.edit.selectedPathOptions}),title:L.drawLocal.edit.toolbar.buttons.edit},{enabled:this.options.remove,handler:new L.EditToolbar.Delete(t,{featureGroup:e}),title:L.drawLocal.edit.toolbar.buttons.remove}]},getActions:function(){return[{title:L.drawLocal.edit.toolbar.actions.save.title,text:L.drawLocal.edit.toolbar.actions.save.text,callback:this._save,context:this},{title:L.drawLocal.edit.toolbar.actions.cancel.title,text:L.drawLocal.edit.toolbar.actions.cancel.text,callback:this.disable,context:this}]},addToolbar:function(t){var e=L.Toolbar.prototype.addToolbar.call(this,t);return this._checkDisabled(),this.options.featureGroup.on("layeradd layerremove",this._checkDisabled,this),e},removeToolbar:function(){this.options.featureGroup.off("layeradd layerremove",this._checkDisabled,this),L.Toolbar.prototype.removeToolbar.call(this)},disable:function(){this.enabled()&&(this._activeMode.handler.revertLayers(),L.Toolbar.prototype.disable.call(this))},_save:function(){this._activeMode.handler.save(),this._activeMode.handler.disable()},_checkDisabled:function(){var t,e=this.options.featureGroup,i=0!==e.getLayers().length;this.options.edit&&(t=this._modes[L.EditToolbar.Edit.TYPE].button,i?L.DomUtil.removeClass(t,"leaflet-disabled"):L.DomUtil.addClass(t,"leaflet-disabled"),t.setAttribute("title",i?L.drawLocal.edit.toolbar.buttons.edit:L.drawLocal.edit.toolbar.buttons.editDisabled)),this.options.remove&&(t=this._modes[L.EditToolbar.Delete.TYPE].button,i?L.DomUtil.removeClass(t,"leaflet-disabled"):L.DomUtil.addClass(t,"leaflet-disabled"),t.setAttribute("title",i?L.drawLocal.edit.toolbar.buttons.remove:L.drawLocal.edit.toolbar.buttons.removeDisabled))}}),L.EditToolbar.Edit=L.Handler.extend({statics:{TYPE:"edit"},includes:L.Mixin.Events,initialize:function(t,e){if(L.Handler.prototype.initialize.call(this,t),this._selectedPathOptions=e.selectedPathOptions,this._featureGroup=e.featureGroup,!(this._featureGroup instanceof L.FeatureGroup))throw new Error("options.featureGroup must be a L.FeatureGroup");this._uneditedLayerProps={},this.type=L.EditToolbar.Edit.TYPE},enable:function(){!this._enabled&&this._hasAvailableLayers()&&(this.fire("enabled",{handler:this.type}),this._map.fire("draw:editstart",{handler:this.type}),L.Handler.prototype.enable.call(this),this._featureGroup.on("layeradd",this._enableLayerEdit,this).on("layerremove",this._disableLayerEdit,this))},disable:function(){this._enabled&&(this._featureGroup.off("layeradd",this._enableLayerEdit,this).off("layerremove",this._disableLayerEdit,this),L.Handler.prototype.disable.call(this),this._map.fire("draw:editstop",{handler:this.type}),this.fire("disabled",{handler:this.type}))},addHooks:function(){var t=this._map;t&&(t.getContainer().focus(),this._featureGroup.eachLayer(this._enableLayerEdit,this),this._tooltip=new L.Tooltip(this._map),this._tooltip.updateContent({text:L.drawLocal.edit.handlers.edit.tooltip.text,subtext:L.drawLocal.edit.handlers.edit.tooltip.subtext}),this._map.on("mousemove",this._onMouseMove,this))},removeHooks:function(){this._map&&(this._featureGroup.eachLayer(this._disableLayerEdit,this),this._uneditedLayerProps={},this._tooltip.dispose(),this._tooltip=null,this._map.off("mousemove",this._onMouseMove,this))},revertLayers:function(){this._featureGroup.eachLayer(function(t){this._revertLayer(t)},this)},save:function(){var t=new L.LayerGroup;this._featureGroup.eachLayer(function(e){e.edited&&(t.addLayer(e),e.edited=!1)}),this._map.fire("draw:edited",{layers:t})},_backupLayer:function(t){var e=L.Util.stamp(t);this._uneditedLayerProps[e]||(t instanceof L.Polyline||t instanceof L.Polygon||t instanceof L.Rectangle?this._uneditedLayerProps[e]={latlngs:L.LatLngUtil.cloneLatLngs(t.getLatLngs())}:t instanceof L.Circle?this._uneditedLayerProps[e]={latlng:L.LatLngUtil.cloneLatLng(t.getLatLng()),radius:t.getRadius()}:t instanceof L.Marker&&(this._uneditedLayerProps[e]={latlng:L.LatLngUtil.cloneLatLng(t.getLatLng())}))},_revertLayer:function(t){var e=L.Util.stamp(t);t.edited=!1,this._uneditedLayerProps.hasOwnProperty(e)&&(t instanceof L.Polyline||t instanceof L.Polygon||t instanceof L.Rectangle?t.setLatLngs(this._uneditedLayerProps[e].latlngs):t instanceof L.Circle?(t.setLatLng(this._uneditedLayerProps[e].latlng),t.setRadius(this._uneditedLayerProps[e].radius)):t instanceof L.Marker&&t.setLatLng(this._uneditedLayerProps[e].latlng))},_toggleMarkerHighlight:function(t){if(t._icon){var e=t._icon;e.style.display="none",L.DomUtil.hasClass(e,"leaflet-edit-marker-selected")?(L.DomUtil.removeClass(e,"leaflet-edit-marker-selected"),this._offsetMarker(e,-4)):(L.DomUtil.addClass(e,"leaflet-edit-marker-selected"),this._offsetMarker(e,4)),e.style.display=""}},_offsetMarker:function(t,e){var i=parseInt(t.style.marginTop,10)-e,o=parseInt(t.style.marginLeft,10)-e;t.style.marginTop=i+"px",t.style.marginLeft=o+"px"},_enableLayerEdit:function(t){var e,i=t.layer||t.target||t,o=i instanceof L.Marker;(!o||i._icon)&&(this._backupLayer(i),this._selectedPathOptions&&(e=L.Util.extend({},this._selectedPathOptions),e.maintainColor&&(e.color=i.options.color,e.fillColor=i.options.fillColor),o?this._toggleMarkerHighlight(i):(i.options.previousOptions=L.Util.extend({dashArray:null},i.options),i instanceof L.Circle||i instanceof L.Polygon||i instanceof L.Rectangle||(e.fill=!1),i.setStyle(e))),o?(i.dragging.enable(),i.on("dragend",this._onMarkerDragEnd)):i.editing.enable())},_disableLayerEdit:function(t){var e=t.layer||t.target||t;e.edited=!1,this._selectedPathOptions&&(e instanceof L.Marker?this._toggleMarkerHighlight(e):(e.setStyle(e.options.previousOptions),delete e.options.previousOptions)),e instanceof L.Marker?(e.dragging.disable(),e.off("dragend",this._onMarkerDragEnd,this)):e.editing.disable()},_onMarkerDragEnd:function(t){var e=t.target;e.edited=!0},_onMouseMove:function(t){this._tooltip.updatePosition(t.latlng)},_hasAvailableLayers:function(){return 0!==this._featureGroup.getLayers().length}}),L.EditToolbar.Delete=L.Handler.extend({statics:{TYPE:"remove"},includes:L.Mixin.Events,initialize:function(t,e){if(L.Handler.prototype.initialize.call(this,t),L.Util.setOptions(this,e),this._deletableLayers=this.options.featureGroup,!(this._deletableLayers instanceof L.FeatureGroup))throw new Error("options.featureGroup must be a L.FeatureGroup");this.type=L.EditToolbar.Delete.TYPE},enable:function(){!this._enabled&&this._hasAvailableLayers()&&(this.fire("enabled",{handler:this.type}),this._map.fire("draw:deletestart",{handler:this.type}),L.Handler.prototype.enable.call(this),this._deletableLayers.on("layeradd",this._enableLayerDelete,this).on("layerremove",this._disableLayerDelete,this))},disable:function(){this._enabled&&(this._deletableLayers.off("layeradd",this._enableLayerDelete,this).off("layerremove",this._disableLayerDelete,this),L.Handler.prototype.disable.call(this),this._map.fire("draw:deletestop",{handler:this.type}),this.fire("disabled",{handler:this.type}))},addHooks:function(){var t=this._map;t&&(t.getContainer().focus(),this._deletableLayers.eachLayer(this._enableLayerDelete,this),this._deletedLayers=new L.layerGroup,this._tooltip=new L.Tooltip(this._map),this._tooltip.updateContent({text:L.drawLocal.edit.handlers.remove.tooltip.text}),this._map.on("mousemove",this._onMouseMove,this))},removeHooks:function(){this._map&&(this._deletableLayers.eachLayer(this._disableLayerDelete,this),this._deletedLayers=null,this._tooltip.dispose(),this._tooltip=null,this._map.off("mousemove",this._onMouseMove,this))},revertLayers:function(){this._deletedLayers.eachLayer(function(t){this._deletableLayers.addLayer(t)},this)},save:function(){this._map.fire("draw:deleted",{layers:this._deletedLayers})},_enableLayerDelete:function(t){var e=t.layer||t.target||t;e.on("click",this._removeLayer,this)},_disableLayerDelete:function(t){var e=t.layer||t.target||t;e.off("click",this._removeLayer,this),this._deletedLayers.removeLayer(e)},_removeLayer:function(t){var e=t.layer||t.target||t;this._deletableLayers.removeLayer(e),this._deletedLayers.addLayer(e)},_onMouseMove:function(t){this._tooltip.updatePosition(t.latlng)},_hasAvailableLayers:function(){return 0!==this._deletableLayers.getLayers().length}})}(window,document);

L.Polyline.Measure = L.Draw.Polyline.extend({
    addHooks: function() {
        L.Draw.Polyline.prototype.addHooks.call(this);
        if (this._map) {
            this._markerGroup = new L.LayerGroup();
            this._map.addLayer(this._markerGroup);

            this._markers = [];
            this._map.on('click', this._onClick, this);
            this._startShape();
        }
    },

    removeHooks: function () {
        L.Draw.Polyline.prototype.removeHooks.call(this);

        this._clearHideErrorTimeout();

        //!\ Still useful when control is disabled before any drawing (refactor needed?)
        this._map.off('mousemove', this._onMouseMove);
        this._clearGuides();
        this._container.style.cursor = '';

        this._removeShape();

        this._map.off('click', this._onClick, this);
    },

    _startShape: function() {
        this._drawing = true;
        this._poly = new L.Polyline([], this.options.shapeOptions);

        this._container.style.cursor = 'crosshair';

        this._updateTooltip();
        this._map.on('mousemove', this._onMouseMove, this);
    },

    _finishShape: function () {
        this._drawing = false;

        this._cleanUpShape();
        this._clearGuides();

        this._updateTooltip();

        this._map.off('mousemove', this._onMouseMove, this);
        this._container.style.cursor = '';
    },

    _removeShape: function() {
        if (!this._poly)
            return;
        this._map.removeLayer(this._poly);
        delete this._poly;
        this._markers.splice(0);
        this._markerGroup.clearLayers();
    },

    _onClick: function(e) {
        if (!this._drawing) {
            this._removeShape();
            this._startShape();
            return;
        }
    },

    _getTooltipText: function() {
        var labelText = L.Draw.Polyline.prototype._getTooltipText.call(this);
        if (!this._drawing) {
            labelText.text = '';
        }
        return labelText;
    }
});

L.Control.MeasureControl = L.Control.extend({

    statics: {
        TITLE: 'Measure distances'
    },
    options: {
        position: 'topleft',
        handler: {}
    },

    toggle: function() {
        if (this.handler.enabled()) {
            this.handler.disable.call(this.handler);
        } else {
            this.handler.enable.call(this.handler);
        }
    },

    onAdd: function(map) {
        var className = 'leaflet-control-draw';

        this._container = L.DomUtil.create('div', 'leaflet-bar');

        this.handler = new L.Polyline.Measure(map, this.options.handler);

        this.handler.on('enabled', function () {
            L.DomUtil.addClass(this._container, 'enabled');
        }, this);

        this.handler.on('disabled', function () {
            L.DomUtil.removeClass(this._container, 'enabled');
        }, this);

        var link = L.DomUtil.create('a', className+'-measure', this._container);
        link.href = '#';
        link.title = L.Control.MeasureControl.TITLE;

        L.DomEvent
            .addListener(link, 'click', L.DomEvent.stopPropagation)
            .addListener(link, 'click', L.DomEvent.preventDefault)
            .addListener(link, 'click', this.toggle, this);

        return this._container;
    }
});


L.Map.mergeOptions({
    measureControl: false
});


L.Map.addInitHook(function () {
    if (this.options.measureControl) {
        this.measureControl = L.Control.measureControl().addTo(this);
    }
});


L.Control.measureControl = function (options) {
    return new L.Control.MeasureControl(options);
};

// Generated by CoffeeScript 1.8.0

/*
Leaflet.timeline

Show any arbitrary GeoJSON objects changing over time

(c) 2014 Jonathan Skeate
https://github.com/skeate/Leaflet.timeline
http://leafletjs.com
 */

(function() {
  var IntervalTree;

  L.TimelineVersion = '0.3.2';

  IntervalTree = (function() {
    function IntervalTree() {
      this._root = null;
      this._list = null;
    }

    IntervalTree.prototype.insert = function(begin, end, value, node, parent, parentSide) {
      var new_node;
      if (node === void 0) {
        node = this._root;
      }
      if (!node) {
        new_node = {
          low: begin,
          high: end,
          max: end,
          data: value,
          left: null,
          right: null,
          parent: parent
        };
        if (parent) {
          parent[parentSide] = new_node;
        } else {
          this._root = new_node;
        }
        return new_node;
      } else {
        if (begin < node.low || begin === node.low && end < node.high) {
          new_node = this.insert(begin, end, value, node.left, node, 'left');
        } else {
          new_node = this.insert(begin, end, value, node.right, node, 'right');
        }
        node.max = Math.max(node.max, new_node.max);
      }
      return new_node;
    };

    IntervalTree.prototype.lookup = function(value, node) {
      if (node === void 0) {
        node = this._root;
        this._list = [];
      }
      if (node === null || node.max < value) {
        return;
      }
      if (node.left !== null) {
        this.lookup(value, node.left);
      }
      if (node.low <= value) {
        if (node.high >= value) {
          this._list.push(node.data);
        }
        this.lookup(value, node.right);
      }
      return this._list;
    };

    return IntervalTree;

  })();

  L.Timeline = L.GeoJSON.extend({
    includes: L.Mixin.Events,
    times: [],
    displayedLayers: [],
    ranges: null,
    options: {
      position: "bottomleft",
      formatDate: function(date) {
        return "";
      },
      enablePlayback: true,
      steps: 1000,
      duration: 10000,
      showTicks: true,
      waitToUpdateMap: false
    },
    initialize: function(timedGeoJSON, options) {
      L.GeoJSON.prototype.initialize.call(this, void 0, options);
      L.extend(this.options, options);
      this.ranges = new IntervalTree();
      return this.process(timedGeoJSON);
    },
    process: function(data) {
      var earliestStart, latestEnd;
      earliestStart = Infinity;
      latestEnd = -Infinity;
      data.features.forEach((function(_this) {
        return function(feature) {
          var end, start;
          start = (new Date(feature.properties.start)).getTime();
          end = (new Date(feature.properties.end)).getTime();
          _this.ranges.insert(start, end, feature);
          _this.times.push(start);
          _this.times.push(end);
          if (start < earliestStart) {
            earliestStart = start;
          }
          if (end > latestEnd) {
            return latestEnd = end;
          }
        };
      })(this));
      this.times = this.times.sort();
      if (!this.options.start) {
        this.options.start = earliestStart;
      }
      if (!this.options.end) {
        return this.options.end = latestEnd;
      }
    },
    addData: function(geojson) {
      var feature, features, layer, options, _i, _len;
      features = L.Util.isArray(geojson) ? geojson : geojson.features;
      if (features) {
        for (_i = 0, _len = features.length; _i < _len; _i++) {
          feature = features[_i];
          if (feature.geometries || feature.geometry || feature.features || feature.coordinates) {
            this.addData(feature);
          }
        }
        return this;
      }
      options = this.options;
      if (options.filter && !options.filter(geojson)) {
        return;
      }
      layer = L.GeoJSON.geometryToLayer(geojson, options.pointToLayer);
      this.displayedLayers.push({
        layer: layer,
        geoJSON: geojson
      });
      layer.feature = L.GeoJSON.asFeature(geojson);
      layer.defaultOptions = layer.options;
      this.resetStyle(layer);
      if (options.onEachFeature) {
        options.onEachFeature(geojson, layer);
      }
      return this.addLayer(layer);
    },
    removeLayer: function(layer, removeDisplayed) {
      if (removeDisplayed == null) {
        removeDisplayed = true;
      }
      L.GeoJSON.prototype.removeLayer.call(this, layer);
      if (removeDisplayed) {
        return this.displayedLayers = this.displayedLayers.filter(function(displayedLayer) {
          return displayedLayer.layer !== layer;
        });
      }
    },
    setTime: function(time) {
      var range, ranges, _i, _len;
      this.time = (new Date(time)).getTime();
      ranges = this.ranges.lookup(time);
      var i, j, found;
    for( i = 0; i < this.displayedLayers.length; i++ ){
      found = false;
      for( j = 0; j < ranges.length; j++ ){
        if( this.displayedLayers[i].geoJSON === ranges[j] ){
          found = true;
          ranges.splice(j, 1);
          break;
        }
      }
      if( !found ){
        var to_remove = this.displayedLayers.splice(i--,1);
        this.removeLayer(to_remove[0].layer, false);
      }
    }
    ;
      for (_i = 0, _len = ranges.length; _i < _len; _i++) {
        range = ranges[_i];
        this.addData(range);
      }
      return this.fire('change');
    },
    onAdd: function(map) {
      L.GeoJSON.prototype.onAdd.call(this, map);
      this.timeSliderControl = L.Timeline.timeSliderControl(this);
      return this.timeSliderControl.addTo(map);
    },
    getDisplayed: function() {
      return this.ranges.lookup(this.time);
    }
  });

  L.Timeline.TimeSliderControl = L.Control.extend({
    initialize: function(timeline) {
      this.timeline = timeline;
      this.options.position = this.timeline.options.position;
      this.start = this.timeline.options.start;
      this.end = this.timeline.options.end;
      this.showTicks = this.timeline.options.showTicks;
      this.stepDuration = this.timeline.options.duration / this.timeline.options.steps;
      return this.stepSize = (this.end - this.start) / this.timeline.options.steps;
    },
    _buildDataList: function(container, times) {
      var datalistSelect, used_times;
      this._datalist = L.DomUtil.create('datalist', '', container);
      datalistSelect = L.DomUtil.create('select', '', this._datalist);
      used_times = [];
      times.forEach(function(time) {
        var datalistOption;
        if (used_times[time]) {
          return;
        }
        datalistOption = L.DomUtil.create('option', '', datalistSelect);
        datalistOption.value = time;
        return used_times[time] = true;
      });
      this._datalist.id = "timeline-datalist-" + Math.floor(Math.random() * 1000000);
      return this._timeSlider.setAttribute('list', this._datalist.id);
    },
    _makePlayPause: function(container) {
      this._playButton = L.DomUtil.create('button', 'play', container);
      this._playButton.addEventListener('click', (function(_this) {
        return function() {
          return _this._play();
        };
      })(this));
      L.DomEvent.disableClickPropagation(this._playButton);
      this._pauseButton = L.DomUtil.create('button', 'pause', container);
      this._pauseButton.addEventListener('click', (function(_this) {
        return function() {
          return _this._pause();
        };
      })(this));
      return L.DomEvent.disableClickPropagation(this._pauseButton);
    },
    _makePrevNext: function(container) {
      this._prevButton = L.DomUtil.create('button', 'prev');
      this._nextButton = L.DomUtil.create('button', 'next');
      this._playButton.parentNode.insertBefore(this._prevButton, this._playButton);
      this._playButton.parentNode.insertBefore(this._nextButton, this._pauseButton.nextSibling);
      L.DomEvent.disableClickPropagation(this._prevButton);
      L.DomEvent.disableClickPropagation(this._nextButton);
      this._prevButton.addEventListener('click', this._prev.bind(this));
      return this._nextButton.addEventListener('click', this._next.bind(this));
    },
    _makeSlider: function(container) {
      this._timeSlider = L.DomUtil.create('input', 'time-slider', container);
      this._timeSlider.type = "range";
      this._timeSlider.min = this.start;
      this._timeSlider.max = this.end;
      this._timeSlider.value = this.start;
      this._timeSlider.addEventListener('mousedown', (function(_this) {
        return function() {
          return _this.map.dragging.disable();
        };
      })(this));
      document.addEventListener('mouseup', (function(_this) {
        return function() {
          return _this.map.dragging.enable();
        };
      })(this));
      this._timeSlider.addEventListener('input', this._sliderChanged.bind(this));
      return this._timeSlider.addEventListener('change', this._sliderChanged.bind(this));
    },
    _makeOutput: function(container) {
      this._output = L.DomUtil.create('output', 'time-text', container);
      return this._output.innerHTML = this.timeline.options.formatDate(new Date(this.start));
    },
    _nearestEventTime: function(findTime, mode) {
      var lastTime, nextDiff, prevDiff, retNext, time, _i, _len, _ref;
      if (mode == null) {
        mode = 0;
      }
      retNext = false;
      lastTime = this.timeline.times[0];
      _ref = this.timeline.times.slice(1);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        time = _ref[_i];
        if (retNext) {
          return time;
        }
        if (time >= findTime) {
          if (mode === -1) {
            return lastTime;
          } else if (mode === 1) {
            if (time === findTime) {
              retNext = true;
            } else {
              return time;
            }
          } else {
            prevDiff = Math.abs(findTime - lastTime);
            nextDiff = Math.abs(time - findTime);
            if (prevDiff < nextDiff) {
              return prevDiff;
            } else {
              return nextDiff;
            }
          }
        }
        lastTime = time;
      }
      return lastTime;
    },
    _prev: function() {
      var prevTime;
      this._pause();
      prevTime = this._nearestEventTime(this.timeline.time, -1);
      this._timeSlider.value = prevTime;
      return this.timeline.setTime(prevTime);
    },
    _pause: function() {
      clearTimeout(this._timer);
      return this.container.classList.remove('playing');
    },
    _play: function() {
      clearTimeout(this._timer);
      if (+this._timeSlider.value === this.end) {
        this._timeSlider.value = this.start;
      }
      this._timeSlider.stepUp(this.stepSize);
      this._sliderChanged({
        type: 'change',
        target: {
          value: this._timeSlider.value
        }
      });
      if (+this._timeSlider.value !== this.end) {
        this.container.classList.add('playing');
        return this._timer = setTimeout(this._play.bind(this, this.stepDuration));
      } else {
        return this.container.classList.remove('playing');
      }
    },
    _next: function() {
      var nextTime;
      this._pause();
      nextTime = this._nearestEventTime(this.timeline.time, 1);
      this._timeSlider.value = nextTime;
      return this.timeline.setTime(nextTime);
    },
    _sliderChanged: function(e) {
      var time;
      time = +e.target.value;
      if (!this.timeline.options.waitToUpdateMap || e.type === 'change') {
        this.timeline.setTime(time);
      }
      return this._output.innerHTML = this.timeline.options.formatDate(new Date(time));
    },
    onAdd: function(map) {
      var buttonContainer, container;
      this.map = map;
      container = L.DomUtil.create('div', 'leaflet-control-layers ' + 'leaflet-control-layers-expanded ' + 'leaflet-timeline-controls');
      if (this.timeline.options.enablePlayback) {
        buttonContainer = L.DomUtil.create('div', 'button-container', container);
        this._makePlayPause(buttonContainer);
        this._makePrevNext(buttonContainer);
      }
      this._makeSlider(container);
      if (this.showTicks) {
        this._buildDataList(container, this.timeline.times);
      }
      this._makeOutput(container);
      this.timeline.setTime(this.start);
      return this.container = container;
    }
  });

  L.timeline = function(timedGeoJSON, options) {
    return new L.Timeline(timedGeoJSON, options);
  };

  L.Timeline.timeSliderControl = function(timeline, start, end, timelist) {
    return new L.Timeline.TimeSliderControl(timeline, start, end, timelist);
  };

}).call(this);

/*
 * Load files *locally* (GeoJSON, KML, GPX) into the map
 * using the HTML5 File API.
 *
 * Requires Pavel Shramov's GPX.js
 * https://github.com/shramov/leaflet-plugins/blob/d74d67/layer/vector/GPX.js
 */
var FileLoader = L.Class.extend({
    includes: L.Mixin.Events,
    options: {
        layerOptions: {},
        fileSizeLimit: 1024
    },

    initialize: function (map, options) {
        this._map = map;
        L.Util.setOptions(this, options);

        this._parsers = {
            'geojson': this._loadGeoJSON,
            'gpx': this._convertToGeoJSON,
            'kml': this._convertToGeoJSON
        };
    },

    load: function (file /* File */) {
        // Check file size
        var fileSize = (file.size / 1024).toFixed(4);
        if (fileSize > this.options.fileSizeLimit) {
            this.fire('data:error', {
                error: new Error('File size exceeds limit (' + fileSize + ' > ' + this.options.fileSizeLimit + 'kb)')
            });
            return;
        }

        // Check file extension
        var ext = file.name.split('.').pop(),
            parser = this._parsers[ext];
        if (!parser) {
            this.fire('data:error', {
                error: new Error('Unsupported file type ' + file.type + '(' + ext + ')')
            });
            return;
        }
        // Read selected file using HTML5 File API
        var reader = new FileReader();
        reader.onload = L.Util.bind(function (e) {
            try {
                this.fire('data:loading', {filename: file.name, format: ext});
                var layer = parser.call(this, e.target.result, ext);
                this.fire('data:loaded', {layer: layer, filename: file.name, format: ext});
            }
            catch (err) {
                this.fire('data:error', {error: err});
            }

        }, this);
        reader.readAsText(file);
        return reader;
    },

    _loadGeoJSON: function (content) {
        if (typeof content == 'string') {
            content = JSON.parse(content);
        }
        var layer = L.geoJson(content, this.options.layerOptions);

        if (layer.getLayers().length === 0) {
            throw new Error('GeoJSON has no valid layers.');
        }

        if (this.options.addToMap) {
            layer.addTo(this._map);
        }
        return layer;
    },

    _convertToGeoJSON: function (content, format) {
        // Format is either 'gpx' or 'kml'
        if (typeof content == 'string') {
            content = ( new window.DOMParser() ).parseFromString(content, "text/xml");
        }
        var geojson = toGeoJSON[format](content);
        return this._loadGeoJSON(geojson);
    }
});


L.Control.FileLayerLoad = L.Control.extend({
    statics: {
        TITLE: 'Load local file (GPX, KML, GeoJSON)',
        LABEL: '&#8965;'
    },
    options: {
        position: 'topleft',
        fitBounds: true,
        layerOptions: {},
        addToMap: true,
        fileSizeLimit: 1024
    },

    initialize: function (options) {
        L.Util.setOptions(this, options);
        this.loader = null;
    },

    onAdd: function (map) {
        this.loader = new FileLoader(map, this.options);

        this.loader.on('data:loaded', function (e) {
            // Fit bounds after loading
            if (this.options.fitBounds) {
                window.setTimeout(function () {
                    map.fitBounds(e.layer.getBounds());
                }, 500);
            }
        }, this);

        // Initialize Drag-and-drop
        this._initDragAndDrop(map);

        // Initialize map control
        return this._initContainer();
    },

    _initDragAndDrop: function (map) {
        var fileLoader = this.loader,
            dropbox = map._container;

        var callbacks = {
            dragenter: function () {
                map.scrollWheelZoom.disable();
            },
            dragleave: function () {
                map.scrollWheelZoom.enable();
            },
            dragover: function (e) {
                e.stopPropagation();
                e.preventDefault();
            },
            drop: function (e) {
                e.stopPropagation();
                e.preventDefault();

                var files = Array.prototype.slice.apply(e.dataTransfer.files),
                    i = files.length;
                setTimeout(function(){
                    fileLoader.load(files.shift());
                    if (files.length > 0) {
                        setTimeout(arguments.callee, 25);
                    }
                }, 25);
                map.scrollWheelZoom.enable();
            }
        };
        for (var name in callbacks)
            dropbox.addEventListener(name, callbacks[name], false);
    },

    _initContainer: function () {
        // Create a button, and bind click on hidden file input
        var zoomName = 'leaflet-control-filelayer leaflet-control-zoom',
            barName = 'leaflet-bar',
            partName = barName + '-part',
            container = L.DomUtil.create('div', zoomName + ' ' + barName);
        var link = L.DomUtil.create('a', zoomName + '-in ' + partName, container);
        link.innerHTML = L.Control.FileLayerLoad.LABEL;
        link.href = '#';
        link.title = L.Control.FileLayerLoad.TITLE;

        // Create an invisible file input
        var fileInput = L.DomUtil.create('input', 'hidden', container);
        fileInput.type = 'file';
        if (!this.options.formats) {
            fileInput.accept = '.gpx,.kml,.geojson';
        } else {
            fileInput.accept = this.options.formats.join(',');
        }
        fileInput.style.display = 'none';
        // Load on file change
        var fileLoader = this.loader;
        fileInput.addEventListener("change", function (e) {
            fileLoader.load(this.files[0]);
            // reset so that the user can upload the same file again if they want to
            this.value = '';
        }, false);

        L.DomEvent.disableClickPropagation(link);
        L.DomEvent.on(link, 'click', function (e) {
            fileInput.click();
            e.preventDefault();
        });
        return container;
    }
});

L.Control.fileLayerLoad = function (options) {
    return new L.Control.FileLayerLoad(options);
};

L.SpinMapMixin = {
    spin: function (state, options) {
        if (!!state) {
            // start spinning !
            if (!this._spinner) {
                this._spinner = new Spinner(options).spin(this._container);
                this._spinning = 0;
            }
            this._spinning++;
        }
        else {
            this._spinning--;
            if (this._spinning <= 0) {
                // end spinning !
                if (this._spinner) {
                    this._spinner.stop();
                    this._spinner = null;
                }
            }
        }
    }
};

L.Map.include(L.SpinMapMixin);

L.Map.addInitHook(function () {
    this.on('layeradd', function (e) {
        // If added layer is currently loading, spin !
        if (e.layer.loading) this.spin(true);
        if (typeof e.layer.on != 'function') return;
        e.layer.on('data:loading', function () { this.spin(true); }, this);
        e.layer.on('data:loaded',  function () { this.spin(false); }, this);
    }, this);
    this.on('layerremove', function (e) {
        // Clean-up
        if (e.layer.loading) this.spin(false);
        if (typeof e.layer.on != 'function') return;
        e.layer.off('data:loaded');
        e.layer.off('data:loading');
    }, this);
});

// http://spin.js.org/#v2.3.1
!function(a,b){"object"==typeof exports?module.exports=b():"function"==typeof define&&define.amd?define(b):a.Spinner=b()}(this,function(){"use strict";function a(a,b){var c,d=document.createElement(a||"div");for(c in b)d[c]=b[c];return d}function b(a){for(var b=1,c=arguments.length;c>b;b++)a.appendChild(arguments[b]);return a}function c(a,b,c,d){var e=["opacity",b,~~(100*a),c,d].join("-"),f=.01+c/d*100,g=Math.max(1-(1-a)/b*(100-f),a),h=j.substring(0,j.indexOf("Animation")).toLowerCase(),i=h&&"-"+h+"-"||"";return m[e]||(k.insertRule("@"+i+"keyframes "+e+"{0%{opacity:"+g+"}"+f+"%{opacity:"+a+"}"+(f+.01)+"%{opacity:1}"+(f+b)%100+"%{opacity:"+a+"}100%{opacity:"+g+"}}",k.cssRules.length),m[e]=1),e}function d(a,b){var c,d,e=a.style;if(b=b.charAt(0).toUpperCase()+b.slice(1),void 0!==e[b])return b;for(d=0;d<l.length;d++)if(c=l[d]+b,void 0!==e[c])return c}function e(a,b){for(var c in b)a.style[d(a,c)||c]=b[c];return a}function f(a){for(var b=1;b<arguments.length;b++){var c=arguments[b];for(var d in c)void 0===a[d]&&(a[d]=c[d])}return a}function g(a,b){return"string"==typeof a?a:a[b%a.length]}function h(a){this.opts=f(a||{},h.defaults,n)}function i(){function c(b,c){return a("<"+b+' xmlns="urn:schemas-microsoft.com:vml" class="spin-vml">',c)}k.addRule(".spin-vml","behavior:url(#default#VML)"),h.prototype.lines=function(a,d){function f(){return e(c("group",{coordsize:k+" "+k,coordorigin:-j+" "+-j}),{width:k,height:k})}function h(a,h,i){b(m,b(e(f(),{rotation:360/d.lines*a+"deg",left:~~h}),b(e(c("roundrect",{arcsize:d.corners}),{width:j,height:d.scale*d.width,left:d.scale*d.radius,top:-d.scale*d.width>>1,filter:i}),c("fill",{color:g(d.color,a),opacity:d.opacity}),c("stroke",{opacity:0}))))}var i,j=d.scale*(d.length+d.width),k=2*d.scale*j,l=-(d.width+d.length)*d.scale*2+"px",m=e(f(),{position:"absolute",top:l,left:l});if(d.shadow)for(i=1;i<=d.lines;i++)h(i,-2,"progid:DXImageTransform.Microsoft.Blur(pixelradius=2,makeshadow=1,shadowopacity=.3)");for(i=1;i<=d.lines;i++)h(i);return b(a,m)},h.prototype.opacity=function(a,b,c,d){var e=a.firstChild;d=d.shadow&&d.lines||0,e&&b+d<e.childNodes.length&&(e=e.childNodes[b+d],e=e&&e.firstChild,e=e&&e.firstChild,e&&(e.opacity=c))}}var j,k,l=["webkit","Moz","ms","O"],m={},n={lines:12,length:7,width:5,radius:10,scale:1,corners:1,color:"#000",opacity:.25,rotate:0,direction:1,speed:1,trail:100,fps:20,zIndex:2e9,className:"spinner",top:"50%",left:"50%",shadow:!1,hwaccel:!1,position:"absolute"};if(h.defaults={},f(h.prototype,{spin:function(b){this.stop();var c=this,d=c.opts,f=c.el=a(null,{className:d.className});if(e(f,{position:d.position,width:0,zIndex:d.zIndex,left:d.left,top:d.top}),b&&b.insertBefore(f,b.firstChild||null),f.setAttribute("role","progressbar"),c.lines(f,c.opts),!j){var g,h=0,i=(d.lines-1)*(1-d.direction)/2,k=d.fps,l=k/d.speed,m=(1-d.opacity)/(l*d.trail/100),n=l/d.lines;!function o(){h++;for(var a=0;a<d.lines;a++)g=Math.max(1-(h+(d.lines-a)*n)%l*m,d.opacity),c.opacity(f,a*d.direction+i,g,d);c.timeout=c.el&&setTimeout(o,~~(1e3/k))}()}return c},stop:function(){var a=this.el;return a&&(clearTimeout(this.timeout),a.parentNode&&a.parentNode.removeChild(a),this.el=void 0),this},lines:function(d,f){function h(b,c){return e(a(),{position:"absolute",width:f.scale*(f.length+f.width)+"px",height:f.scale*f.width+"px",background:b,boxShadow:c,transformOrigin:"left",transform:"rotate("+~~(360/f.lines*k+f.rotate)+"deg) translate("+f.scale*f.radius+"px,0)",borderRadius:(f.corners*f.scale*f.width>>1)+"px"})}for(var i,k=0,l=(f.lines-1)*(1-f.direction)/2;k<f.lines;k++)i=e(a(),{position:"absolute",top:1+~(f.scale*f.width/2)+"px",transform:f.hwaccel?"translate3d(0,0,0)":"",opacity:f.opacity,animation:j&&c(f.opacity,f.trail,l+k*f.direction,f.lines)+" "+1/f.speed+"s linear infinite"}),f.shadow&&b(i,e(h("#000","0 0 4px #000"),{top:"2px"})),b(d,b(i,h(g(f.color,k),"0 0 1px rgba(0,0,0,.1)")));return d},opacity:function(a,b,c){b<a.childNodes.length&&(a.childNodes[b].style.opacity=c)}}),"undefined"!=typeof document){k=function(){var c=a("style",{type:"text/css"});return b(document.getElementsByTagName("head")[0],c),c.sheet||c.styleSheet}();var o=e(a("group"),{behavior:"url(#default#VML)"});!d(o,"transform")&&o.adj?i():j=d(o,"animation")}return h});
