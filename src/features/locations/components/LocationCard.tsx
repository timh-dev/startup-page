import { HiOutlineGlobeAlt, HiOutlineMapPin, HiOutlinePencil, HiOutlineTrash } from "react-icons/hi2";

import { googleMapsSatelliteEmbedUrl } from "../utils";
import type { LocationItem } from "../types";

interface LocationCardProps {
  location: LocationItem;
  googleMapsCredential: string | null;
  onEdit: (location: LocationItem) => void;
  onDelete: (location: LocationItem) => void;
}

function earthLinkFor(location: LocationItem): string {
  if (location.googleEarthUrl) {
    return location.googleEarthUrl;
  }
  return `https://earth.google.com/web/search/${encodeURIComponent(location.name)}`;
}

export default function LocationCard({ location, googleMapsCredential, onEdit, onDelete }: LocationCardProps) {
  const imageUrl = location.imageUrl || location.wikiImageUrl;
  const hasCoords = location.latitude !== null && location.longitude !== null;
  const locationChips = [location.park, location.country, location.continent].filter(Boolean);

  return (
    <div className="loc-card">
      <div className="loc-card-media">
        {imageUrl ? (
          <img src={imageUrl} alt="" loading="lazy" />
        ) : (
          <div className="loc-card-media-placeholder">
            <HiOutlineMapPin className="size-6" />
          </div>
        )}
        <div className="loc-card-media-scrim" />
        <div className="loc-card-actions">
          <button type="button" className="loc-card-action" onClick={() => onEdit(location)} title="Edit location">
            <HiOutlinePencil className="size-3.5" />
          </button>
          <button type="button" className="loc-card-action" onClick={() => onDelete(location)} title="Delete location">
            <HiOutlineTrash className="size-3.5" />
          </button>
        </div>
        <div className="loc-card-media-title">
          <span className="loc-card-name">{location.name}</span>
          {locationChips.length > 0 && (
            <span className="loc-card-subtitle">{locationChips.join(" · ")}</span>
          )}
        </div>
      </div>

      {hasCoords && googleMapsCredential ? (
        <iframe
          className="loc-card-map"
          loading="lazy"
          title={`Satellite view of ${location.name}`}
          referrerPolicy="no-referrer-when-downgrade"
          src={googleMapsSatelliteEmbedUrl(googleMapsCredential, location.latitude as number, location.longitude as number)}
        />
      ) : hasCoords ? (
        <div className="loc-card-map-placeholder">
          Add a Google Maps API key in Settings → Content to preview the satellite view.
        </div>
      ) : null}

      <div className="loc-card-body">
        {location.wikiExtract && (
          <p className="loc-card-extract">
            {location.wikiExtract}
            {location.wikiUrl && (
              <a href={location.wikiUrl} target="_blank" rel="noreferrer" className="loc-card-wiki-link">
                Wikipedia ↗
              </a>
            )}
          </p>
        )}
        {location.tags.length > 0 && (
          <div className="loc-card-chips">
            {location.tags.map((tag) => (
              <span key={tag} className="loc-card-tag">
                {tag}
              </span>
            ))}
          </div>
        )}
        <a
          href={earthLinkFor(location)}
          target="_blank"
          rel="noreferrer"
          className="loc-card-open-btn"
        >
          <HiOutlineGlobeAlt className="size-4" />
          Open in Google Earth
        </a>
      </div>
    </div>
  );
}
