import { strFromU8, unzipSync } from "fflate";
import type { Location, TransportMode } from "@/domain/models";

const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 80 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15_000;
const REQUIRED_GTFS_FILES = new Set(["stops.txt", "routes.txt", "trips.txt", "stop_times.txt"]);

export interface StaticGtfsFeedConfig {
  id: string;
  name: string;
  zipUrl: string;
  catalogUrl: string;
  effectiveThrough?: string;
}

export interface StaticGtfsStop {
  id: string;
  location: Location;
}

export interface StaticGtfsRoute {
  id: string;
  name: string;
  mode: TransportMode;
}

export interface StaticGtfsStopTime {
  stopId: string;
  arrivalSeconds: number;
  departureSeconds: number;
  sequence: number;
}

export interface StaticGtfsTrip {
  id: string;
  route: StaticGtfsRoute;
  stops: StaticGtfsStopTime[];
}

export interface StaticGtfsOccurrence {
  tripId: string;
  index: number;
}

export interface StaticGtfsIndex {
  feed: StaticGtfsFeedConfig;
  loadedAt: string;
  stops: Map<string, StaticGtfsStop>;
  trips: Map<string, StaticGtfsTrip>;
  occurrencesByStop: Map<string, StaticGtfsOccurrence[]>;
}

type CsvRecord = Record<string, string>;

function parseCsv(text: string): CsvRecord[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  return rows
    .filter((values) => values.some((value) => value.trim().length > 0))
    .map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])),
    );
}

function parseGtfsTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

function routeMode(routeType: string): TransportMode {
  const value = Number.parseInt(routeType, 10);
  if (value === 0 || value === 1 || value === 2 || value === 5 || value === 12) return "rail";
  if (value === 3 || value === 11) return "bus";
  return "other";
}

function findFile(files: Record<string, Uint8Array>, fileName: string): Uint8Array | null {
  const target = fileName.toLowerCase();
  const match = Object.entries(files).find(([path]) => {
    const normalized = path.replace(/\\/g, "/").toLowerCase();
    return normalized === target || normalized.endsWith(`/${target}`);
  });
  return match?.[1] ?? null;
}

function readRequiredTable(files: Record<string, Uint8Array>, fileName: string): CsvRecord[] {
  const file = findFile(files, fileName);
  if (!file) throw new Error(`GTFS archive is missing ${fileName}.`);
  return parseCsv(strFromU8(file));
}

function safeHttpsUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("GTFS feed URL must be a public HTTPS URL.");
  }
  return url;
}

async function downloadArchive(urlValue: string, fetchImpl: typeof fetch): Promise<Uint8Array> {
  const url = safeHttpsUrl(urlValue);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: "application/zip, application/octet-stream" },
    });
    if (!response.ok) throw new Error("The open GTFS archive could not be downloaded.");
    const declaredSize = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredSize) && declaredSize > MAX_DOWNLOAD_BYTES) {
      throw new Error("The open GTFS archive is larger than the configured safety limit.");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_DOWNLOAD_BYTES) {
      throw new Error("The open GTFS archive is larger than the configured safety limit.");
    }
    return bytes;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadStaticGtfsIndex(
  feed: StaticGtfsFeedConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<StaticGtfsIndex> {
  const archive = await downloadArchive(feed.zipUrl, fetchImpl);
  let selectedBytes = 0;
  const files = unzipSync(archive, {
    filter(file) {
      const normalized = file.name.replace(/\\/g, "/").toLowerCase();
      const fileName = normalized.split("/").at(-1) ?? "";
      if (!REQUIRED_GTFS_FILES.has(fileName)) return false;
      if (!Number.isSafeInteger(file.originalSize) || file.originalSize < 0) {
        throw new Error("The GTFS archive contains an invalid file size.");
      }
      selectedBytes += file.originalSize;
      if (selectedBytes > MAX_UNCOMPRESSED_BYTES) {
        throw new Error("The expanded GTFS archive is larger than the configured safety limit.");
      }
      return true;
    },
  });
  const uncompressedBytes = Object.values(files).reduce((sum, file) => sum + file.length, 0);
  if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
    throw new Error("The expanded GTFS archive is larger than the configured safety limit.");
  }

  const stopRows = readRequiredTable(files, "stops.txt");
  const routeRows = readRequiredTable(files, "routes.txt");
  const tripRows = readRequiredTable(files, "trips.txt");
  const stopTimeRows = readRequiredTable(files, "stop_times.txt");

  const stops = new Map<string, StaticGtfsStop>();
  for (const row of stopRows) {
    const latitude = Number.parseFloat(row.stop_lat);
    const longitude = Number.parseFloat(row.stop_lon);
    if (
      !row.stop_id ||
      !row.stop_name ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }
    stops.set(row.stop_id, {
      id: row.stop_id,
      location: { label: row.stop_name, coordinate: { latitude, longitude } },
    });
  }

  const routes = new Map<string, StaticGtfsRoute>();
  for (const row of routeRows) {
    if (!row.route_id) continue;
    const name = row.route_short_name || row.route_long_name || row.route_desc || "Published route";
    routes.set(row.route_id, {
      id: row.route_id,
      name,
      mode: routeMode(row.route_type),
    });
  }

  const tripRouteIds = new Map<string, string>();
  for (const row of tripRows) {
    if (row.trip_id && routes.has(row.route_id)) tripRouteIds.set(row.trip_id, row.route_id);
  }

  const stopTimesByTrip = new Map<string, StaticGtfsStopTime[]>();
  for (const row of stopTimeRows) {
    if (!tripRouteIds.has(row.trip_id) || !stops.has(row.stop_id)) continue;
    const arrivalSeconds = parseGtfsTime(row.arrival_time);
    const departureSeconds = parseGtfsTime(row.departure_time);
    const sequence = Number.parseInt(row.stop_sequence, 10);
    if (arrivalSeconds === null || departureSeconds === null || !Number.isFinite(sequence))
      continue;
    const stopTimes = stopTimesByTrip.get(row.trip_id) ?? [];
    stopTimes.push({ stopId: row.stop_id, arrivalSeconds, departureSeconds, sequence });
    stopTimesByTrip.set(row.trip_id, stopTimes);
  }

  const trips = new Map<string, StaticGtfsTrip>();
  const occurrencesByStop = new Map<string, StaticGtfsOccurrence[]>();
  for (const [tripId, stopTimes] of stopTimesByTrip) {
    const route = routes.get(tripRouteIds.get(tripId) ?? "");
    if (!route || stopTimes.length < 2) continue;
    stopTimes.sort((left, right) => left.sequence - right.sequence);
    const trip = { id: tripId, route, stops: stopTimes } satisfies StaticGtfsTrip;
    trips.set(tripId, trip);
    stopTimes.forEach((stopTime, index) => {
      const occurrences = occurrencesByStop.get(stopTime.stopId) ?? [];
      occurrences.push({ tripId, index });
      occurrencesByStop.set(stopTime.stopId, occurrences);
    });
  }

  if (stops.size === 0 || trips.size === 0) {
    throw new Error("The open GTFS archive contains no usable stops or route patterns.");
  }

  return {
    feed,
    loadedAt: new Date().toISOString(),
    stops,
    trips,
    occurrencesByStop,
  };
}
