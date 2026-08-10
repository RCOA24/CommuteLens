import type { Coordinate, Location } from "@/domain/models";

export interface GeocodingProvider {
  search(query: string): Promise<Location[]>;
  reverseGeocode(coordinate: Coordinate): Promise<Location | null>;
}
