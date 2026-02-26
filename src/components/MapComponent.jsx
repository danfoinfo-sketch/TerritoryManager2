import { useEffect, useRef, useState } from 'react';
import { MapContainer as LeafletMap, TileLayer, GeoJSON, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import axios from 'axios';
import usStatesGeoJSON from '../data/us-states.geojson'; // Assumed downloaded and simplified
import usZipsGeoJSON from '../data/us-zips.geojson'; // Assumed downloaded and simplified

const US_CENTER = [39.8283, -98.5795];
const US_ZOOM = 4;
const CENSUS_API_KEY = import.meta.env.VITE_CENSUS_API_KEY;

// Function to fetch census data for a ZIP
const fetchZipData = async (zip) => {
  try {
    const response = await axios.get(
      `https://api.census.gov/data/2022/acs/acs5?get=B01003_001E,B25024_002E&for=zcta:${zip}&key=${CENSUS_API_KEY}`
    );
    const data = response.data[1]; // First row is headers
    return {
      population: parseInt(data[0]) || 0,
      homes: parseInt(data[1]) || 0,
    };
  } catch (error) {
    console.error(`Failed to fetch data for ZIP ${zip}:`, error);
    return { population: 0, homes: 0 };
  }
};

function MapInvalidator() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  return null;
}

export default function MapComponent({ territories, activeTerritoryId, addModeTerritoryId, addZipToTerritory, boundaryMode }) {
  const mapRef = useRef();
  const zipLayerGroupRef = useRef(L.layerGroup());
  const [popupInfo, setPopupInfo] = useState(null);
  const [visibleZips, setVisibleZips] = useState([]);
  const zipDataCache = useRef({});

  // Filter ZIPs to current view or active territories
  const updateVisibleZips = () => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const bounds = map.getBounds();
    const activeZips = territories.flatMap(t => t.zips.map(z => z.zip));

    const filteredZips = usZipsGeoJSON.features.filter(feature => {
      if (activeZips.includes(feature.properties.ZCTA5CE20)) return true; // Always show active
      const centroid = turf.centroid(feature);
      return bounds.contains([centroid.geometry.coordinates[1], centroid.geometry.coordinates[0]]);
    });

    setVisibleZips(filteredZips);
    console.log(`[DEBUG] Visible ZIPs updated: ${filteredZips.length}`);
  };

  useEffect(() => {
    updateVisibleZips();
  }, [territories, boundaryMode]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    map.on('moveend zoomend', updateVisibleZips);
    return () => map.off('moveend zoomend', updateVisibleZips);
  }, []);

  const getZipStyle = (feature) => {
    const zip = feature.properties.ZCTA5CE20;
    const territory = territories.find(t => t.zips.some(z => z.zip === zip));
    return territory
      ? { color: territory.color, weight: 2, fillColor: territory.color, fillOpacity: 0.6 }
      : { color: '#0000ff', weight: 1, fillColor: '#0000ff', fillOpacity: 0.1 };
  };

  const onZipClick = async (feature, layer) => {
    const zip = feature.properties.ZCTA5CE20;
    console.log(`[DEBUG] ZIP clicked: ${zip}`);

    if (addModeTerritoryId) {
      const existing = territories.find(t => t.id === addModeTerritoryId)?.zips.some(z => z.zip === zip);
      if (existing) {
        removeZipFromTerritory(addModeTerritoryId, zip);
      } else {
        let data = zipDataCache.current[zip];
        if (!data) {
          data = await fetchZipData(zip);
          zipDataCache.current[zip] = data;
        }
        addZipToTerritory(zip, data.population, data.homes);
      }
    } else {
      let data = zipDataCache.current[zip];
      if (!data) {
        data = await fetchZipData(zip);
        zipDataCache.current[zip] = data;
      }
      setPopupInfo({ zip, ...data, latlng: layer.getBounds().getCenter() });
    }
  };

  const onZipHover = (feature, layer) => {
    layer.setStyle({ weight: 3, color: '#ff0000' });
  };

  const onZipHoverOut = (feature, layer) => {
    layer.setStyle(getZipStyle(feature));
  };

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <LeafletMap
        ref={mapRef}
        center={US_CENTER}
        zoom={US_ZOOM}
        style={{ height: '100%', width: '100%' }}
        whenReady={() => {
          mapRef.current.addLayer(zipLayerGroupRef.current);
        }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapInvalidator />

        {/* State boundaries */}
        <GeoJSON
          data={usStatesGeoJSON}
          style={{ color: '#cccccc', weight: 1, fillOpacity: 0 }}
        />

        {/* ZIP boundaries */}
        {visibleZips.length > 0 && (
          <GeoJSON
            data={{ type: 'FeatureCollection', features: visibleZips }}
            style={getZipStyle}
            onEachFeature={(feature, layer) => {
              layer.on({
                click: (e) => onZipClick(feature, layer),
                mouseover: (e) => onZipHover(feature, layer),
                mouseout: (e) => onZipHoverOut(feature, layer),
              });
            }}
          />
        )}

        {/* Popup */}
        {popupInfo && (
          <Popup position={[popupInfo.latlng.lat, popupInfo.latlng.lng]} onClose={() => setPopupInfo(null)}>
            <div>
              <h3>ZIP {popupInfo.zip}</h3>
              <p>Population: {popupInfo.population}</p>
              <p>Single-Family Homes: {popupInfo.homes}</p>
            </div>
          </Popup>
        )}
      </LeafletMap>
    </div>
  );
}