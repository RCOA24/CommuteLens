import type { CommuteRoute, DataSource, Location } from "@/domain/models";

export const DEMO_SOURCE: DataSource = {
  type: "demo",
  name: "Commute Lens curated CUTC scenario",
  confidence: "medium",
};

export const DEMO_LOCATIONS = {
  cubao: { label: "Cubao, Quezon City", coordinate: { latitude: 14.6195, longitude: 121.0519 } },
  bgc: { label: "BGC, Taguig", coordinate: { latitude: 14.5508, longitude: 121.0501 } },
  ayalaMrt: { label: "Ayala MRT", coordinate: { latitude: 14.5492, longitude: 121.0279 } },
} satisfies Record<string, Location>;

export const DEMO_ROUTES: CommuteRoute[] = [
  {
    id: "demo-cubao-bgc",
    segments: [
      { mode: "rail", origin: DEMO_LOCATIONS.cubao, destination: DEMO_LOCATIONS.ayalaMrt, estimatedFare: 28, estimatedDurationMinutes: 35, source: DEMO_SOURCE },
      { mode: "bus", origin: DEMO_LOCATIONS.ayalaMrt, destination: DEMO_LOCATIONS.bgc, estimatedFare: 15, estimatedDurationMinutes: 25, source: DEMO_SOURCE },
    ],
    oneWayFare: 43,
    oneWayDurationMinutes: 60,
    transfers: 1,
    reliability: "medium",
    sources: [DEMO_SOURCE],
  },
];
