"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { LngLatBoundsLike, Map } from "maplibre-gl";
import { Info, MapPinned } from "lucide-react";
import type { CommuteRoute, Location } from "@/domain/models";

const mapStyle: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    geoapify: {
      type: "raster",
      // Same-origin proxy: the Geoapify key stays on the server.
      tiles: ["/api/map/tile/{z}/{x}/{y}"],
      tileSize: 256,
      attribution:
        '© <a href="https://www.geoapify.com/">Geoapify</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    },
  },
  layers: [{ id: "geoapify", type: "raster", source: "geoapify" }],
};

function routeLocations(route: CommuteRoute): Location[] {
  const points = [
    route.segments[0]?.origin,
    ...route.segments.map((segment) => segment.destination),
  ].filter((location): location is Location => Boolean(location));
  return points.filter((location, index) => {
    const previous = points[index - 1];
    return (
      !previous ||
      previous.coordinate.latitude !== location.coordinate.latitude ||
      previous.coordinate.longitude !== location.coordinate.longitude
    );
  });
}

/**
 * Interactive Geoapify map using same-origin tile URLs so no public key is
 * needed in the browser.
 *
 * Honesty note that must survive future edits: the drawn line is a journey
 * track between the stops the itinerary reported. It is not road or rail
 * geometry, and the caption says so.
 */
export function RouteMap({ route }: { route: CommuteRoute }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const locations = routeLocations(route);
    if (locations.length < 2) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      cooperativeGestures: true,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("error", () => setMapFailed(true));

    const coordinates = locations.map((location) => [
      location.coordinate.longitude,
      location.coordinate.latitude,
    ]);
    const bounds = coordinates.reduce(
      (current, coordinate) => current.extend(coordinate as [number, number]),
      new maplibregl.LngLatBounds(
        coordinates[0] as [number, number],
        coordinates[0] as [number, number],
      ),
    );
    map.on("load", () => {
      map.addSource("commute-track", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } },
      });
      map.addLayer({
        id: "commute-track-casing",
        type: "line",
        source: "commute-track",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#102a2b",
          "line-width": 8,
          "line-opacity": 0.2,
        },
      });
      map.addLayer({
        id: "commute-track-line",
        type: "line",
        source: "commute-track",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#c83f16", "line-width": 4, "line-opacity": 0.95 },
      });
      locations.forEach((location, index) => {
        const pin = document.createElement("div");
        pin.className =
          index === 0
            ? "route-map-pin route-map-pin-start"
            : index === locations.length - 1
              ? "route-map-pin route-map-pin-end"
              : "route-map-pin";
        pin.textContent =
          index === 0 ? "H" : index === locations.length - 1 ? "O" : String(index + 1);
        pin.setAttribute("aria-hidden", "true");
        new maplibregl.Marker({ element: pin })
          .setLngLat([location.coordinate.longitude, location.coordinate.latitude])
          .setPopup(new maplibregl.Popup({ offset: 18 }).setText(location.label))
          .addTo(map);
      });
      map.fitBounds(bounds as LngLatBoundsLike, { padding: 56, maxZoom: 14, duration: 0 });
    });
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [route]);

  return (
    <section className="route-map-shell" aria-label="Commute journey map">
      {mapFailed && (
        <p role="status" className="route-map-status">
          <MapPinned className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          The map is taking a moment to load. Every route detail on this page is still accurate.
        </p>
      )}
      <div className="relative">
        <div className="route-map-legend" aria-hidden="true">
          <span>
            <i data-kind="start" />H Home
          </span>
          <span>
            <i data-kind="end" />O Office
          </span>
          <span>
            <i data-kind="track" />
            Journey track
          </span>
        </div>
        <div ref={containerRef} className="route-map" />
      </div>
      <p className="route-map-note">
        <Info className="mt-0.5 size-3.5 shrink-0 text-flame" aria-hidden="true" />
        <span>
          The line connects the stops your itinerary reported, from home to office. It is a journey
          overview, not exact road or rail geometry.
        </span>
      </p>
    </section>
  );
}
