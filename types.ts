
export interface SimulationStats {
  waterLevel: number;
  surfaceArea: number; // in square meters
  volume: number; // in cubic meters
  concentration: number; // in mg/L or similar unit based on mass input
  estimatedYear?: number; // Calculated based on surface area
}

export interface TerrainConfig {
  width: number; // number of cells x
  depth: number; // number of cells z
  cellSize: number; // meters per cell
  maxHeight: number;
}

export interface SimulationState {
  waterLevel: number;
  substanceMass: number; // in tons
  isAutoRising: boolean;
}