import React from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { PLACE_TAG_HEX } from "@/features/places/constants";
import type { Place } from "@/features/places/types";

// Per-tag colored dot markers instead of Leaflet's default pin — this both
// sidesteps the well-known Leaflet+bundler default-marker-icon asset path
// bug and gives markers colored consistently with the rest of the vault's
// tag chips, for free.
const DIV_ICONS: Record<string, L.DivIcon> = {};

function iconForTag(tag: string): L.DivIcon {
  if (!DIV_ICONS[tag]) {
    const color = PLACE_TAG_HEX[tag] || PLACE_TAG_HEX.Other;
    DIV_ICONS[tag] = L.divIcon({
      className: "places-map-marker",
      html: `<span class="places-map-marker-dot" style="background:${color}"></span>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -8],
    });
  }
  return DIV_ICONS[tag];
}

// fitBounds isn't a MapContainer prop — it has to be called imperatively via
// useMap() from a child mounted inside the map.
function FitBounds({ places }: { places: Place[] }) {
  const map = useMap();
  React.useEffect(() => {
    if (places.length < 2) {
      return;
    }
    const bounds = L.latLngBounds(places.map((place): [number, number] => [place.lat, place.lng]));
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [map, places]);
  return null;
}

interface PlacesMapViewProps {
  places: Place[];
}

export default function PlacesMapView({ places }: PlacesMapViewProps) {
  const center = React.useMemo<[number, number]>(
    () => (places.length ? [places[0].lat, places[0].lng] : [20, 0]),
    [places],
  );
  const zoom = places.length ? 12 : 2;

  return (
    <div className="places-map-container">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ width: "100%", height: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {places.length > 1 && <FitBounds places={places} />}
        {places.map((place) => (
          <Marker key={place.id} position={[place.lat, place.lng]} icon={iconForTag(place.tag)}>
            <Popup>
              <strong>{place.name}</strong>
              <br />
              {place.tag}
              {place.address && (
                <>
                  <br />
                  <span className="places-map-popup-address">{place.address}</span>
                </>
              )}
              {place.notes && <p className="places-map-popup-notes">{place.notes}</p>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
