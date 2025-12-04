import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { TerrainConfig } from '../types';
import { getColorByHeight } from '../utils/math';

// Vertical Exaggeration Factor
// This visually stretches the terrain height without affecting the underlying data
const VISUAL_EXAGGERATION = 4.0;

// Augment the JSX namespace
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      meshStandardMaterial: any;
      planeGeometry: any;
      meshPhysicalMaterial: any;
      ambientLight: any;
      directionalLight: any;
      orthographicCamera: any;
      gridHelper: any;
    }
  }
}

// Augment React's internal JSX namespace for compatibility with newer TS/React versions
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      meshStandardMaterial: any;
      planeGeometry: any;
      meshPhysicalMaterial: any;
      ambientLight: any;
      directionalLight: any;
      orthographicCamera: any;
      gridHelper: any;
    }
  }
}

interface TerrainSceneProps {
  heightData: Float32Array;
  config: TerrainConfig;
  waterLevel: number;
}

const TerrainMesh: React.FC<TerrainSceneProps> = ({ heightData, config, waterLevel }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Generate Geometry and Colors
  const { geometry, colors } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      config.width * config.cellSize,
      config.depth * config.cellSize,
      config.width - 1,
      config.depth - 1
    );

    const posAttribute = geo.attributes.position;
    const colorArray = new Float32Array(posAttribute.count * 3);

    let maxH = 0;
    // Find approximate max height from data for coloring logic
    for (let i = 0; i < heightData.length; i++) {
       if (heightData[i] > maxH) maxH = heightData[i];
    }
    const colorMax = maxH > 0 ? maxH : config.maxHeight;

    for (let i = 0; i < posAttribute.count; i++) {
      const h = heightData[i] || 0;
      
      // Apply visual exaggeration to the mesh geometry ONLY
      posAttribute.setZ(i, h * VISUAL_EXAGGERATION);

      const [r, g, b] = getColorByHeight(h, colorMax);
      colorArray[i * 3] = r;
      colorArray[i * 3 + 1] = g;
      colorArray[i * 3 + 2] = b;
    }

    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

    return { geometry: geo, colors: colorArray };
  }, [heightData, config]);

  return (
    <group>
      <mesh 
        ref={meshRef} 
        geometry={geometry} 
        rotation={[-Math.PI / 2, 0, 0]} 
        receiveShadow
        castShadow
      >
        {/* Removed flatShading for a smoother look */}
        <meshStandardMaterial 
            vertexColors 
            roughness={0.8} 
            metalness={0.05}
        />
      </mesh>

      {waterLevel > 0 && (
        <mesh 
            rotation={[-Math.PI / 2, 0, 0]} 
            // Apply exaggeration to water level as well so it matches terrain
            position={[0, waterLevel * VISUAL_EXAGGERATION, 0]}
        >
          <planeGeometry args={[config.width * config.cellSize, config.depth * config.cellSize]} />
          <meshPhysicalMaterial 
            color="#3b82f6" 
            transparent 
            opacity={0.6} 
            transmission={0.4} 
            roughness={0.05}
            metalness={0.1}
            thickness={2}
            clearcoat={1}
            // Fix z-fighting by prioritizing water rendering slightly over the terrain
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )}
    </group>
  );
};

// Component to handle Camera and Control auto-adjustment
const SceneSetup: React.FC<{ config: TerrainConfig }> = ({ config }) => {
    const { camera, gl } = useThree();
    const controlsRef = useRef<any>(null);

    useEffect(() => {
        // Calculate scene bounding box dimensions
        const width = config.width * config.cellSize;
        const depth = config.depth * config.cellSize;
        // Account for exaggeration in the camera setup
        const terrainHeight = config.maxHeight * VISUAL_EXAGGERATION; 
        
        const maxDim = Math.max(width, depth);
        
        // 3/4 screen fit calculation
        const fitRatio = 0.75; 
        
        // Ensure standard perspective
        const fov = 45; 
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.fov = fov;
            camera.updateProjectionMatrix();
        }
        
        // Calculate Distance
        // We want the object (maxDim) to fit within 'fitRatio' of the frustum height
        // tan(fov/2) = (height/2) / distance
        // height = maxDim
        // distance = (maxDim / 2) / (tan(fov/2) * fitRatio)
        const fovRad = (camera instanceof THREE.PerspectiveCamera ? camera.fov : 45) * Math.PI / 180;
        const dist = (maxDim / 2) / (Math.tan(fovRad / 2) * fitRatio);
        
        // Set Camera Position
        // "Below the terrain" interpreted as South View (Positive Z in standard mapping) 
        // with an angled perspective (e.g., 45 degrees elevation)
        const angle = Math.PI / 4; // 45 degrees
        
        // Calculate position components
        // Z is horizontal distance from center, Y is height from center
        const z = dist * Math.cos(angle); 
        const y = dist * Math.sin(angle); 
        
        // Target: Center of the terrain bounds
        // Usually X=0, Z=0. Y might need to be slightly elevated to look at the "surface" not the base.
        const targetY = terrainHeight * 0.2; 
        
        camera.position.set(0, y + targetY, z);
        camera.lookAt(0, targetY, 0);
        
        if (controlsRef.current) {
            controlsRef.current.target.set(0, targetY, 0);
            
            // Allow reasonable zoom range
            controlsRef.current.maxDistance = dist * 4;
            controlsRef.current.minDistance = 1;
            
            // Limit polar angle to prevent going underground (keep camera above horizon)
            controlsRef.current.maxPolarAngle = Math.PI / 2 - 0.05; 
            
            controlsRef.current.update();
        }
        
        // Update Near/Far to prevent clipping
        camera.near = Math.max(0.1, maxDim / 2000); 
        camera.far = Math.max(5000, dist * 10);
        camera.updateProjectionMatrix();

    }, [config, camera]);

    return <OrbitControls ref={controlsRef} makeDefault />;
};

const TerrainScene: React.FC<TerrainSceneProps> = (props) => {
  // Calculate shadow map frustum based on terrain size
  const w = props.config.width * props.config.cellSize;
  const d = props.config.depth * props.config.cellSize;
  // Account for exaggeration in shadow calculation
  const h = props.config.maxHeight * VISUAL_EXAGGERATION;
  const shadowSize = Math.max(w, d, h) * 0.8;

  return (
    <div className="w-full h-full">
      {/* Enable logarithmicDepthBuffer to handle large scale variations and prevent Z-fighting */}
      <Canvas shadows gl={{ logarithmicDepthBuffer: true }}>
        <SceneSetup config={props.config} />
        
        <ambientLight intensity={0.7} />
        <directionalLight 
            position={[shadowSize, shadowSize * 1.5, shadowSize * 0.5]} 
            intensity={1.2} 
            castShadow 
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0005}
        >
             <orthographicCamera 
                attach="shadow-camera" 
                args={[-shadowSize, shadowSize, shadowSize, -shadowSize, 0.1, shadowSize * 5]} 
             />
        </directionalLight>

        <TerrainMesh {...props} />
        
        <Sky sunPosition={[100, 40, 100]} turbidity={0.2} rayleigh={0.5} mieCoefficient={0.005} mieDirectionalG={0.8} />
        {/* Removed Stars for light theme */}
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export default TerrainScene;