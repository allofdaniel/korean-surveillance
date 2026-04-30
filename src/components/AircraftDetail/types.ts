/**
 * Shared types for AircraftDetail sub-section components
 */

export interface AircraftData {
  hex: string;
  callsign?: string;
  registration?: string;
  type?: string;
  icao_type?: string;
  lat?: number;
  lon?: number;
  altitude_ft?: number;
  ground_speed?: number;
  track?: number;
  vertical_rate?: number;
  squawk?: string;
  origin?: string;
  destination?: string;
}

export interface AircraftPhoto {
  image?: string;
  photographer?: string;
}

export interface AircraftDetails {
  Type?: string;
  Registration?: string;
  RegisteredOwners?: string;
  ICAOTypeCode?: string;
  OperatorFlagCode?: string;
  Manufacturer?: string;
}

export interface AircraftImage {
  src?: string;
}

// aircraft_images can be string[] (FR24) or AircraftImage[] (legacy)
export type AircraftImageArray = (string | AircraftImage)[];

export interface DepartureArrival {
  iata?: string;
  icao?: string;
  airport?: string;
  scheduled?: string;
  gate?: string;
  delay?: number;
}

export interface Schedule {
  std?: string;
  etd?: string;
  sta?: string;
  eta?: string;
  atd?: string;
  nature?: string;
}

export interface Flight {
  iata?: string;
  icao?: string;
}

export interface AircraftInfo {
  type?: string;
}

export interface FlightSchedule {
  departure?: DepartureArrival;
  arrival?: DepartureArrival;
  schedule?: Schedule;
  flight?: Flight;
  flight_status?: string;
  aircraft_images?: AircraftImageArray;
  aircraft_info?: AircraftInfo;
  _source?: string;
  _lastUpdated?: string;
}

export interface TrackPoint {
  time?: number;
  timestamp?: number;
  altitude_ft?: number;
  altitude_m?: number;
  on_ground?: boolean;
  lat?: number;
  lon?: number;
}

export interface FlightTrack {
  path?: TrackPoint[];
  source?: string;
}

export interface AirportInfo {
  lat?: number;
  lon?: number;
  name?: string;
}

export type AirportDatabase = Record<string, AirportInfo>;

export interface AirspaceInfo {
  type: string;
  name: string;
  color?: string;
  frequencies?: string[];
}

export interface WaypointInfo {
  ident: string;
  distance_nm: number;
  etaMinutes?: number;
}

export interface ProcedureInfo {
  type: string;
  name: string;
}

export interface FlightPhaseInfo {
  phase: string;
  phase_kr: string;
  icon: string;
  color: string;
}

export interface SectionExpandedState {
  flightStatus: boolean;
  aircraftInfo: boolean;
  schedule: boolean;
}

export interface GraphHoverData {
  time: string | null;
  altitude: number;
  x: number;
}

export interface DataWithAirport {
  airport?: AirportInfo;
  waypoints?: Record<string, { lat: number; lon: number; ident: string }>;
  procedures?: Record<string, unknown>;
}

export interface AtcSector {
  id: string;
  name: string;
  operator?: string;
  vertical_limits?: string;
  airspace_class?: string;
  frequencies?: string[];
  color?: string;
  coordinates?: [number, number][];
  floor_ft?: number;
  ceiling_ft?: number;
}

export interface AtcData {
  FIR?: AtcSector;
  ACC?: AtcSector[];
  TMA?: AtcSector[];
  CTR?: AtcSector[];
}
