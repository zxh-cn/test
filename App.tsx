import React, { useState, useEffect, useCallback } from 'react';
import { fromBlob } from 'geotiff';
import TerrainScene from './components/TerrainScene';
import Overlay from './components/Overlay';
import { generateTerrainData, calculateHydraulics, processImageToHeightData, processRawDemData } from './utils/math';
import { TerrainConfig, SimulationStats } from './types';

const DEFAULT_CONFIG: TerrainConfig = {
  width: 128,
  depth: 128,
  cellSize: 1,
  maxHeight: 40
};

const App: React.FC = () => {
  // Configuration for the simulation grid - now stateful
  const [config, setConfig] = useState<TerrainConfig>(DEFAULT_CONFIG);
  
  // Add a version key to force re-mounting of the 3D scene when terrain changes completely
  const [terrainVersion, setTerrainVersion] = useState<number>(0);

  // Application State
  const [heightData, setHeightData] = useState<Float32Array>(new Float32Array(0));
  const [waterLevel, setWaterLevel] = useState<number>(0); // Relative water level (0 = minElevation)
  const [substanceMass, setSubstanceMass] = useState<number>(1000); // 1000 tons default
  const [isAutoRising, setIsAutoRising] = useState<boolean>(false);
  const [minElevation, setMinElevation] = useState<number>(0); // Store absolute min elevation for display
  const [stats, setStats] = useState<SimulationStats>({
    waterLevel: 0,
    surfaceArea: 0,
    volume: 0,
    concentration: 0
  });

  // Update Hydraulics Statistics whenever inputs change
  useEffect(() => {
    if (heightData.length > 0) {
      // Calculate absolute water level
      const absoluteWaterLevel = minElevation + waterLevel;
      
      // Use absolute level for the formula-based calculation
      const calculatedStats = calculateHydraulics(absoluteWaterLevel, substanceMass);
      setStats(calculatedStats);
    }
  }, [heightData, waterLevel, substanceMass, config, minElevation]);

  // Animation loop for "Rising Water" simulation
  useEffect(() => {
    let animationFrameId: number;
    
    if (isAutoRising) {
      const animate = () => {
        setWaterLevel(prev => {
          // Reduced speed: changed divisor from 500 to 1000 to slow down the rise
          const next = prev + (config.maxHeight / 1000); 
          if (next >= config.maxHeight + (config.maxHeight * 0.1)) {
             setIsAutoRising(false);
             return prev;
          }
          return next;
        });
        animationFrameId = requestAnimationFrame(animate);
      };
      animationFrameId = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isAutoRising, config.maxHeight]);

  // Core Logic to process a Blob (File or Fetch Response) as GeoTIFF
  const loadTerrainFromBlob = useCallback(async (blob: Blob) => {
      try {
          const tiff = await fromBlob(blob);
          const image = await tiff.getImage();
          
          // Get dimensions
          const w = image.getWidth();
          const h = image.getHeight();
          
          // Read raster data (assuming single band DEM)
          const rasters = await image.readRasters();
          const rawData = rasters[0] as Float32Array | Int16Array; // Typed array

          // Process data: downsample, find min/max, normalize
          const processed = processRawDemData(rawData, w, h, 256);
          
          // Try to determine real cell size from metadata
          // ModelPixelScale = [ScaleX, ScaleY, ScaleZ]
          const fileDir = image.getFileDirectory();
          let realCellSize = 1;
          
          // @ts-ignore - geotiff types might be incomplete in this environment
          const modelPixelScale = fileDir.ModelPixelScale;
          if (modelPixelScale && modelPixelScale.length >= 2) {
              // Adjust cell size based on downsampling
              const downsampleRatio = w / processed.width;
              realCellSize = modelPixelScale[0] * downsampleRatio;

              // HEURISTIC: Fix Degree vs Meter mismatch
              // If cell size is tiny (< 0.1) and height is large (> 10), assume WGS84 degrees.
              // Convert roughly to meters (1 deg approx 111,000m).
              if (realCellSize < 0.1 && processed.maxHeight > 10) {
                  console.log("Detected Degree units. Converting to Meters approx.");
                  realCellSize *= 111000;
              }
          }

          setConfig({
              width: processed.width,
              depth: processed.height,
              cellSize: realCellSize, 
              maxHeight: processed.maxHeight
          });
          
          setHeightData(processed.data);
          setMinElevation(processed.minHeight);
          setWaterLevel(0);
          setTerrainVersion(v => v + 1);
          return true; // Success

      } catch (err) {
          console.error("Error parsing GeoTIFF:", err);
          alert("Failed to parse GeoTIFF file.");
          return false; // Failed
      }
  }, []);

  // Initial Load Effect
  useEffect(() => {
    const initTerrain = async () => {
        try {
            // Attempt to fetch 'dem.tif' from public folder
            const response = await fetch('/dem.tif');
            if (response.ok) {
                const blob = await response.blob();
                console.log("Found default 'dem.tif', loading...");
                await loadTerrainFromBlob(blob);
            } else {
                console.log("Default 'dem.tif' not found, using empty state.");
                // Optional: Load procedural terrain if no file found
                // handleResetTerrain(); 
            }
        } catch (e) {
            console.log("Error loading default terrain:", e);
        }
    };

    initTerrain();
  }, [loadTerrainFromBlob]);

  const handleUploadDEM = useCallback(async (file: File) => {
    const filename = file.name.toLowerCase();

    // Handle GeoTIFF
    if (filename.endsWith('.tif') || filename.endsWith('.tiff')) {
        await loadTerrainFromBlob(file);
        return;
    }

    // Handle Images
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Limit resolution for performance (max 256x256 for this demo)
        const MAX_SIZE = 256;
        let w = img.width;
        let h = img.height;
        
        // Simple downscaling aspect ratio logic
        if (w > MAX_SIZE || h > MAX_SIZE) {
            const ratio = w / h;
            if (w > h) {
                w = MAX_SIZE;
                h = Math.round(MAX_SIZE / ratio);
            } else {
                h = MAX_SIZE;
                w = Math.round(MAX_SIZE * ratio);
            }
        }

        // 1. Process image to get 0-1 normalized data
        const normalizedData = processImageToHeightData(img, w, h);
        
        // 2. Scale it up to a reasonable height (e.g. 50m max)
        const DEM_MAX_HEIGHT = 50;
        const scaledData = new Float32Array(normalizedData.length);
        for(let i=0; i<normalizedData.length; i++) {
            scaledData[i] = normalizedData[i] * DEM_MAX_HEIGHT;
        }

        // 3. Update State
        setConfig({
            width: w,
            depth: h,
            cellSize: 1, // Assume 1m per pixel for simplicity
            maxHeight: DEM_MAX_HEIGHT
        });
        setHeightData(scaledData);
        setMinElevation(0); // Images don't have absolute elevation data
        setWaterLevel(0);
        setTerrainVersion(v => v + 1); // Increment version to force scene update
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  }, [loadTerrainFromBlob]);

  const handleResetTerrain = useCallback(() => {
      const data = generateTerrainData(DEFAULT_CONFIG);
      setConfig(DEFAULT_CONFIG);
      setHeightData(data);
      setMinElevation(0);
      setWaterLevel(0);
      setTerrainVersion(v => v + 1); // Increment version to force scene update
  }, []);

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-slate-50 via-white to-blue-50 overflow-hidden">
      {/* 3D Viewport */}
      <div className="absolute inset-0 z-0">
        <TerrainScene 
          key={terrainVersion} /* Key forces remount when terrain changes */
          heightData={heightData} 
          config={config} 
          waterLevel={waterLevel}
        />
        {heightData.length === 0 && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="bg-white/80 text-slate-700 p-6 rounded-2xl shadow-xl backdrop-blur-md flex flex-col items-center border border-white/50">
                     <p className="font-bold text-lg mb-2">等待地形数据...</p>
                     <p className="text-sm text-slate-500">正在加载 /dem.tif 或请手动上传</p>
                 </div>
             </div>
        )}
      </div>

      {/* UI Overlay */}
      <div className="relative z-10 pointer-events-none w-full h-full">
         <Overlay 
             stats={stats}
             waterLevel={waterLevel}
             substanceMass={substanceMass}
             setWaterLevel={setWaterLevel}
             setSubstanceMass={setSubstanceMass}
             maxHeight={config.maxHeight}
             minElevation={minElevation}
             isAutoRising={isAutoRising}
             toggleAutoRise={() => setIsAutoRising(!isAutoRising)}
             onUploadDEM={handleUploadDEM}
             onResetTerrain={handleResetTerrain}
             hasTerrain={heightData.length > 0}
         />
      </div>
    </div>
  );
};

export default App;