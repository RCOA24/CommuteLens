import type { Location } from "@/domain/models";

/**
 * CL-005 — curated Metro Manila demo locations.
 *
 * Coordinates are rounded to ~4 decimal places (roughly 10 m). That is precise
 * enough to place a marker and coarse enough that nothing here is a person's
 * exact address.
 */

/** Origins a demo user can pick as "where I live". */
export const DEMO_ORIGINS = {
  cubao: { label: "Cubao, Quezon City", coordinate: { latitude: 14.6195, longitude: 121.0519 } },
  fairview: {
    label: "Fairview, Quezon City",
    coordinate: { latitude: 14.7361, longitude: 121.0575 },
  },
  antipolo: { label: "Antipolo, Rizal", coordinate: { latitude: 14.5878, longitude: 121.176 } },
  alabang: {
    label: "Alabang, Muntinlupa",
    coordinate: { latitude: 14.4197, longitude: 121.0409 },
  },
  cainta: { label: "Cainta, Rizal", coordinate: { latitude: 14.5786, longitude: 121.1223 } },
  monumento: {
    label: "Monumento, Caloocan",
    coordinate: { latitude: 14.6547, longitude: 120.9836 },
  },
} satisfies Record<string, Location>;

/** Office districts a demo job offer can sit in. */
export const DEMO_OFFICES = {
  bgc: { label: "BGC, Taguig", coordinate: { latitude: 14.5508, longitude: 121.0501 } },
  makati: { label: "Makati CBD", coordinate: { latitude: 14.5547, longitude: 121.0244 } },
  ortigas: {
    label: "Ortigas Center, Pasig",
    coordinate: { latitude: 14.5866, longitude: 121.0614 },
  },
  eastwood: {
    label: "Eastwood City, Quezon City",
    coordinate: { latitude: 14.6091, longitude: 121.08 },
  },
} satisfies Record<string, Location>;

/** Interchange points used to build multi-segment routes. Not user-selectable. */
export const DEMO_INTERCHANGES = {
  ayalaMrt: { label: "Ayala MRT", coordinate: { latitude: 14.5492, longitude: 121.0279 } },
  guadalupe: { label: "Guadalupe, Makati", coordinate: { latitude: 14.5666, longitude: 121.0448 } },
  santolanLrt2: {
    label: "Santolan LRT-2",
    coordinate: { latitude: 14.6222, longitude: 121.0857 },
  },
  cubaoMrt: { label: "Cubao MRT-3", coordinate: { latitude: 14.6197, longitude: 121.0517 } },
  taftLrt1: { label: "Taft Avenue LRT-1", coordinate: { latitude: 14.5378, longitude: 121.0009 } },
  fairviewTerminal: {
    label: "Fairview Terminal",
    coordinate: { latitude: 14.7331, longitude: 121.0577 },
  },
  masinagJunction: {
    label: "Masinag Junction, Antipolo",
    coordinate: { latitude: 14.6188, longitude: 121.1273 },
  },
  alabangStarmall: {
    label: "Alabang Starmall Terminal",
    coordinate: { latitude: 14.4212, longitude: 121.0345 },
  },
  mcKinleyExchange: {
    label: "McKinley Exchange, Taguig",
    coordinate: { latitude: 14.5455, longitude: 121.0393 },
  },
} satisfies Record<string, Location>;

/**
 * Flat lookup kept for backwards compatibility with existing Member 1 tests and
 * the temporary page shell. Prefer `DEMO_ORIGINS` / `DEMO_OFFICES` in new code.
 */
export const DEMO_LOCATIONS = {
  ...DEMO_ORIGINS,
  ...DEMO_OFFICES,
  ...DEMO_INTERCHANGES,
} satisfies Record<string, Location>;

export type DemoOriginKey = keyof typeof DEMO_ORIGINS;
export type DemoOfficeKey = keyof typeof DEMO_OFFICES;
