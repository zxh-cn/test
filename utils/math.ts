import { TerrainConfig, SimulationStats } from '../types';

// Simple pseudo-random noise function (fractional brownian motion approximation)
// to generate a valley-like structure without external heavy dependencies.
const noise = (x: number, z: number) => {
  const sin = Math.sin;
  const cos = Math.cos;
  return (
    sin(x * 0.05) * cos(z * 0.05) * 10 +
    sin(x * 0.1 + 10) * cos(z * 0.15) * 5 +
    sin(x * 0.3) * 2
  );
};

export const generateTerrainData = (config: TerrainConfig): Float32Array => {
  const size = config.width * config.depth;
  const data = new Float32Array(size);

  for (let z = 0; z < config.depth; z++) {
    for (let x = 0; x < config.width; x++) {
      // Create a bowl/valley shape
      const dx = x - config.width / 2;
      const dz = z - config.depth / 2;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      // Base valley shape
      let height = (distance * distance) / 1000;
      
      // Add noise detail
      height += noise(x, z);
      
      // Normalize somewhat to positive
      height = Math.max(0, height);
      
      data[z * config.width + x] = height;
    }
  }
  return data;
};

// Converts an image object into a normalized height array (0.0 - 1.0)
export const processImageToHeightData = (
  img: HTMLImageElement,
  width: number,
  height: number
): Float32Array => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return new Float32Array(width * height);

  // Draw image to canvas to extract pixel data
  ctx.drawImage(img, 0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);
  const rgba = imgData.data;
  
  const data = new Float32Array(width * height);
  
  for (let i = 0; i < data.length; i++) {
    // Index in rgba array (4 values per pixel)
    const idx = i * 4;
    const r = rgba[idx];
    const g = rgba[idx + 1];
    const b = rgba[idx + 2];
    
    // Calculate brightness (0-255)
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Normalize to 0-1 range
    data[i] = brightness / 255.0;
  }
  
  return data;
};

// New Helper: Process raw raster data (e.g. from GeoTIFF)
// Resizes to manageable size and normalizes so lowest point is 0
export const processRawDemData = (
    rawData:  Float32Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Int8Array | Uint8Array,
    origWidth: number,
    origHeight: number,
    targetMaxSize: number = 256
): { data: Float32Array; width: number; height: number; minHeight: number; maxHeight: number } => {
    
    // Determine scale factor
    const maxDim = Math.max(origWidth, origHeight);
    let scale = 1;
    if (maxDim > targetMaxSize) {
        scale = maxDim / targetMaxSize;
    }

    const newWidth = Math.floor(origWidth / scale);
    const newHeight = Math.floor(origHeight / scale);
    const newData = new Float32Array(newWidth * newHeight);

    let minVal = Infinity;
    let maxVal = -Infinity;

    // First pass: Downsample and copy
    for (let y = 0; y < newHeight; y++) {
        for (let x = 0; x < newWidth; x++) {
            // Nearest neighbor sampling
            const srcX = Math.floor(x * scale);
            const srcY = Math.floor(y * scale);
            
            // Safety clamp to ensure we stay within bounds
            const safeX = Math.min(Math.max(0, srcX), origWidth - 1);
            const safeY = Math.min(Math.max(0, srcY), origHeight - 1);
            const srcIdx = safeY * origWidth + safeX;
            
            let val = rawData[srcIdx];

            // Filter out NoData values.
            if (isNaN(val) || val < -12000 || val > 12000) {
                 val = NaN; 
            } else {
                if (val < minVal) minVal = val;
                if (val > maxVal) maxVal = val;
            }
            
            newData[y * newWidth + x] = val;
        }
    }

    if (minVal === Infinity) { minVal = 0; maxVal = 10; }

    // Second pass: Normalize (Shift to 0) and fill NaNs
    for (let i = 0; i < newData.length; i++) {
        if (isNaN(newData[i])) {
            newData[i] = 0; 
        } else {
            newData[i] = newData[i] - minVal;
        }
    }

    return {
        data: newData,
        width: newWidth,
        height: newHeight,
        minHeight: minVal, // The original absolute elevation of the lowest point
        maxHeight: maxVal - minVal // The relative height range
    };
};

/**
 * Polynomial constants for Area calculation.
 * y = -10.984357780264 * (x ** 4) + 191820.49752582 * (x ** 3) - 1256158182.19156 * (x ** 2) + 3656024105511.9 * x - 3990277863318550
 */
const C4 = -10.984357780264;
const C3 = 191820.49752582;
const C2 = -1256158182.19156;
const C1 = 3656024105511.9;
const C0 = -3990277863318550;

/**
 * Year-Area Formula Constants
 * Formula: y = 0.7903x - 1483.3
 * x: Year
 * y: Area (km^2)
 */
const YEAR_SLOPE = 0.7903;
const YEAR_INTERCEPT = -1483.3;

/**
 * Calculates Area (m^2) based on absolute elevation x.
 */
const calculatePolynomialArea = (x: number): number => {
    // Implementing the formula using Exponentiation Operator (**) as requested
    const term4 = C4 * (x ** 4);
    const term3 = C3 * (x ** 3);
    const term2 = C2 * (x ** 2);
    const term1 = C1 * x;
    const term0 = C0;
    
    // Result is in square meters
    const area = term4 + term3 + term2 + term1 + term0;
    return Math.max(0, area); // Ensure non-negative
};

/**
 * Calculates the primitive (indefinite integral) of the Area function.
 * Used for Volume calculation.
 */
const calculateAreaIntegral = (x: number): number => {
    // Integrate using power rule
    const term5 = (C4 / 5) * (x ** 5);
    const term4 = (C3 / 4) * (x ** 4);
    const term3 = (C2 / 3) * (x ** 3);
    const term2 = (C1 / 2) * (x ** 2);
    const term1 = C0 * x;

    return term5 + term4 + term3 + term2 + term1;
};

/**
 * Calculates Year based on Area (km^2) using y = 0.7903x - 1483.3
 * x = (y + 1483.3) / 0.7903
 */
const calculateYearFromArea = (areaKm2: number): number => {
    return (areaKm2 - YEAR_INTERCEPT) / YEAR_SLOPE;
}

/**
 * Solves for Elevation (m) given a target Area (m^2) using Binary Search.
 * Function is effectively inverse of calculatePolynomialArea.
 */
export const getElevationFromYear = (year: number): number => {
    // 1. Calculate Area in km^2
    const targetAreaKm2 = YEAR_SLOPE * year + YEAR_INTERCEPT;
    
    // 2. Convert to m^2
    const targetAreaM2 = Math.max(0, targetAreaKm2 * 1_000_000);
    
    // 3. Binary Search for Elevation
    // Assuming valid elevation range for this specific polynomial context [4304, 4450]
    // Polynomials can be non-monotonic globally, but likely monotonic in valid lake range.
    let low = 4304; 
    let high = 4450;
    const epsilon = 1.0; // 1 meter precision is enough for this polynomial magnitude

    // Quick check: if target area is 0, return base
    if (targetAreaM2 <= 1) return low;

    for (let i = 0; i < 64; i++) {
        const mid = (low + high) / 2;
        const area = calculatePolynomialArea(mid);
        
        if (Math.abs(area - targetAreaM2) < epsilon) {
            return mid;
        }
        
        // Assuming Area increases with Elevation
        if (area < targetAreaM2) {
            low = mid;
        } else {
            high = mid;
        }
    }
    
    return (low + high) / 2;
}

/**
 * Calculates Hydraulics based on specific polynomial model.
 * Volume is calculated by integrating the Area function from 4305 to current level.
 */
export const calculateHydraulics = (
  absoluteElevation: number,
  substanceMassTons: number
): SimulationStats => {
  
  // 1. Calculate Area (m^2)
  const surfaceAreaM2 = calculatePolynomialArea(absoluteElevation);

  // 2. Calculate Volume (m^3)
  // Definite Integral from Lower Limit (4304) to Current Elevation
  const LOWER_LIMIT = 4304;
  
  // Only calculate volume if we are above the lower limit
  let volumeM3 = 0;
  if (absoluteElevation > LOWER_LIMIT) {
      volumeM3 = calculateAreaIntegral(absoluteElevation) - calculateAreaIntegral(LOWER_LIMIT);
  }
  
  volumeM3 = Math.max(0, volumeM3);

  // 3. Concentration: Mass / Volume
  // Mass Input: Tons (1 Ton = 1,000,000 grams)
  // Volume Input: m^3
  // Target Unit: mg/L (which is equivalent to g/m^3)
  // Calculation: (Tons * 1,000,000) / m^3 = g/m^3 = mg/L
  const concentration = volumeM3 > 0.001 
    ? (substanceMassTons * 1_000_000) / volumeM3 
    : 0;

  // 4. Calculate Year from Area (km^2)
  const surfaceAreaKm2 = surfaceAreaM2 / 1_000_000;
  const estimatedYear = Math.round(calculateYearFromArea(surfaceAreaKm2));

  return {
    waterLevel: absoluteElevation, // Return absolute level for stats context
    surfaceArea: surfaceAreaM2,    // In m^2 (Overlay handles conversion to km^2)
    volume: volumeM3,              // In m^3 (Overlay handles conversion to km^3)
    concentration,                 // In mg/L
    estimatedYear
  };
};

// Helper for Linear Interpolation
const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;

export const getColorByHeight = (height: number, max: number): [number, number, number] => {
    // Normalize height
    const t = Math.min(Math.max(height / max, 0), 1);
    
    // Define Color Stops (RGB 0-1)
    const DEEP_WATER: [number, number, number] = [0.1, 0.2, 0.4]; // Should usually be below 0, but included for completeness
    const SAND: [number, number, number] = [0.82, 0.78, 0.55]; // ~Tan
    const GRASS: [number, number, number] = [0.25, 0.55, 0.2]; // ~Green
    const ROCK: [number, number, number] = [0.45, 0.42, 0.38]; // ~Grey/Brown
    const SNOW: [number, number, number] = [0.95, 0.95, 1.0]; // ~White

    // Smooth Gradient Logic
    if (t < 0.1) {
        // Sand zone (0 - 0.1)
        const localT = t / 0.1;
        return [
            lerp(SAND[0], GRASS[0], localT),
            lerp(SAND[1], GRASS[1], localT),
            lerp(SAND[2], GRASS[2], localT)
        ];
    } else if (t < 0.5) {
        // Grass -> Rock zone (0.1 - 0.5)
        const localT = (t - 0.1) / 0.4;
        return [
            lerp(GRASS[0], ROCK[0], localT),
            lerp(GRASS[1], ROCK[1], localT),
            lerp(GRASS[2], ROCK[2], localT)
        ];
    } else {
        // Rock -> Snow zone (0.5 - 1.0)
        const localT = (t - 0.5) / 0.5;
        return [
            lerp(ROCK[0], SNOW[0], localT),
            lerp(ROCK[1], SNOW[1], localT),
            lerp(ROCK[2], SNOW[2], localT)
        ];
    }
};