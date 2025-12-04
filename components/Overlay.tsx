import React, { useState } from 'react';
import { SimulationStats } from '../types';
import { getElevationFromYear } from '../utils/math';

interface OverlayProps {
  stats: SimulationStats;
  waterLevel: number;
  substanceMass: number;
  setWaterLevel: (val: number) => void;
  setSubstanceMass: (val: number) => void;
  maxHeight: number;
  minElevation?: number;
  isAutoRising: boolean;
  toggleAutoRise: () => void;
  onUploadDEM: (file: File) => void;
  onResetTerrain: () => void;
  hasTerrain?: boolean;
}

// Icons
const IconDroplet = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-2-5-7-13-5 8-7 11-7 13a7 7 0 0 0 7 7z"/></svg>
);
const IconUpload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);
const IconRefresh = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
);
const IconPlay = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
);
const IconPause = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
);
const IconWaves = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1C7 13 7 11 9.5 11c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1C7 19 7 17 9.5 17c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>
);

const Overlay: React.FC<OverlayProps> = ({
  stats,
  waterLevel,
  substanceMass,
  setWaterLevel,
  setSubstanceMass,
  maxHeight,
  minElevation = 0,
  isAutoRising,
  toggleAutoRise,
  onUploadDEM,
  onResetTerrain,
  hasTerrain = true
}) => {
  const [manualInput, setManualInput] = useState<string>("");
  const [yearInput, setYearInput] = useState<string>("");

  const ABS_MIN_ELEVATION = 4304;
  const ABS_MAX_ELEVATION = 4405;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadDEM(e.target.files[0]);
      e.target.value = '';
    }
  };

  const clampElevation = (val: number) => {
      return Math.max(ABS_MIN_ELEVATION, Math.min(ABS_MAX_ELEVATION, val));
  };

  const handleManualSet = () => {
      const val = parseFloat(manualInput);
      if (!isNaN(val)) {
          const clamped = clampElevation(val);
          setWaterLevel(clamped - minElevation);
          setManualInput(clamped.toString());
      }
  };

  const handleYearSet = () => {
    const y = parseFloat(yearInput);
    if (!isNaN(y)) {
        let targetElevation = getElevationFromYear(y);
        targetElevation = clampElevation(targetElevation);
        setWaterLevel(targetElevation - minElevation);
    }
  };

  const absoluteWaterLevel = minElevation + waterLevel;
  const areaKm2 = stats.surfaceArea / 1_000_000;
  const volKm3 = stats.volume / 1_000_000_000;
  const sliderMin = Math.max(0, ABS_MIN_ELEVATION - minElevation);
  const sliderMax = Math.max(0, ABS_MAX_ELEVATION - minElevation);

  return (
    <div className="absolute top-6 left-6 w-80 flex flex-col gap-4 max-h-[90vh] pointer-events-auto">
      
      {/* Header Card */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 p-5 shadow-xl shadow-slate-200/50">
        <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-blue-500 rounded-lg text-white shadow-md shadow-blue-200">
                <IconDroplet />
            </div>
            <div>
                <h1 className="text-lg font-bold text-slate-800 tracking-tight">麻米错</h1>
                <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">湖表卤水：年份-面积-体积预测</p>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4 pb-4">
          
        {/* Upload Section */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 p-4 shadow-lg shadow-slate-200/50">
            <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                   <IconWaves /> 地形数据源
                </span>
                <button 
                    onClick={onResetTerrain}
                    className="text-[10px] flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full border border-slate-200"
                >
                    <IconRefresh /> 示例
                </button>
            </div>
            
            <label className="group relative flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-300 bg-slate-50/50">
                <div className="flex items-center gap-2 text-slate-400 group-hover:text-blue-500 transition-colors">
                    <IconUpload />
                    <span className="text-xs font-medium">上传 GeoTIFF / 图片</span>
                </div>
                <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.tif,.tiff" onChange={handleFileChange} />
            </label>
        </div>

        {hasTerrain && (
        <>
            {/* Main Controls */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 p-5 shadow-lg shadow-slate-200/50 space-y-5">
                
                {/* Water Level Slider */}
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">水位模拟</label>
                    <span className="text-base font-mono font-bold text-blue-600">{absoluteWaterLevel.toFixed(2)}<span className="text-xs text-slate-400 ml-1">m</span></span>
                  </div>
                  
                  {/* Optimized Slider Container - Larger Hit Area */}
                  <div className="relative w-full h-8 flex items-center justify-center">
                      
                      {/* Visual Track (Background) */}
                      <div className="absolute w-full h-2 bg-slate-200 rounded-full overflow-hidden pointer-events-none">
                           <div 
                             className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" 
                             style={{width: `${((waterLevel - sliderMin) / (sliderMax - sliderMin)) * 100}%`}}
                           ></div>
                      </div>

                      {/* Visual Thumb (Pointer Events None) */}
                      <div 
                        className="absolute h-5 w-5 bg-white rounded-full shadow-md border border-slate-100 ring-2 ring-blue-500/30 pointer-events-none transition-all z-10"
                        style={{left: `calc(${((waterLevel - sliderMin) / (sliderMax - sliderMin)) * 100}% - 10px)`}}
                      ></div>
                      
                      {/* The Input - High Z-index, Full coverage */}
                      <input
                        type="range"
                        min={sliderMin}
                        max={sliderMax}
                        step="0.1"
                        value={waterLevel}
                        onChange={(e) => setWaterLevel(parseFloat(e.target.value))}
                        className="absolute w-full h-full opacity-0 cursor-pointer z-50"
                        style={{ margin: 0 }}
                      />
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0">
                      <span>{minElevation + sliderMin}m</span>
                      <span>{minElevation + sliderMax}m</span>
                  </div>
                </div>

                {/* Precision Inputs */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-medium ml-1">定高程 (m)</label>
                        <div className="flex rounded-lg bg-slate-100 border border-slate-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 transition-all overflow-hidden">
                            <input 
                                type="number"
                                placeholder="4320"
                                className="w-full bg-transparent py-1.5 px-3 text-xs text-slate-700 placeholder-slate-400 focus:outline-none font-mono"
                                value={manualInput}
                                onChange={(e) => setManualInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleManualSet(); }}
                            />
                            <button onClick={handleManualSet} className="bg-white border-l border-slate-200 text-slate-500 hover:text-blue-600 px-2.5 transition-colors">
                                <span className="text-xs font-bold">OK</span>
                            </button>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-medium ml-1">定年份</label>
                        <div className="flex rounded-lg bg-slate-100 border border-slate-200 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-400/20 transition-all overflow-hidden">
                            <input 
                                type="number"
                                placeholder="2030"
                                className="w-full bg-transparent py-1.5 px-3 text-xs text-slate-700 placeholder-slate-400 focus:outline-none font-mono"
                                value={yearInput}
                                onChange={(e) => setYearInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleYearSet(); }}
                            />
                            <button onClick={handleYearSet} className="bg-white border-l border-slate-200 text-slate-500 hover:text-emerald-600 px-2.5 transition-colors">
                                <span className="text-xs font-bold">OK</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Auto Rise Button */}
                <button
                   onClick={toggleAutoRise}
                   className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-md ${
                     isAutoRising 
                     ? 'bg-red-50 text-red-500 border border-red-200 hover:bg-red-100' 
                     : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:shadow-cyan-200 hover:opacity-95'
                   }`}
                 >
                   {isAutoRising ? <IconPause /> : <IconPlay />}
                   {isAutoRising ? '停止模拟' : '涨水模拟'}
                 </button>

                {/* Mass Input */}
                <div className="pt-2 border-t border-slate-200">
                   <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">离子质量</label>
                        <span className="text-[10px] text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">吨</span>
                   </div>
                   <input
                        type="number"
                        min="0"
                        value={substanceMass}
                        onChange={(e) => setSubstanceMass(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-slate-100 border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 focus:outline-none font-mono transition-all"
                   />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 p-5 shadow-lg shadow-slate-200/50 space-y-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
                   监测数据
                </span>

                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/60 p-3 rounded-xl border border-white/50 shadow-sm">
                        <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">水体体积</p>
                        <p className="text-sm font-mono font-bold text-slate-800 tracking-tight">
                            {volKm3.toFixed(3)} 
                            <span className="text-[10px] font-normal text-slate-400 ml-1">km³</span>
                        </p>
                    </div>
                    <div className="bg-white/60 p-3 rounded-xl border border-white/50 shadow-sm">
                        <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">水面面积</p>
                        <p className="text-sm font-mono font-bold text-slate-800 tracking-tight">
                            {areaKm2.toFixed(3)}
                            <span className="text-[10px] font-normal text-slate-400 ml-1">km²</span>
                        </p>
                    </div>
                </div>

                <div className="bg-white/60 p-3 rounded-xl border border-white/50 shadow-sm flex justify-between items-center">
                     <p className="text-[10px] text-slate-400 uppercase font-semibold">估算年份</p>
                     <p className="text-base font-mono font-bold text-emerald-500">
                        {stats.estimatedYear || '----'}
                     </p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100 relative overflow-hidden group shadow-inner">
                    <div className="relative z-10">
                        <div className="flex justify-between items-end mb-1">
                            <p className="text-[10px] text-blue-800 uppercase font-bold tracking-wider">当前浓度</p>
                            <span className="text-[10px] text-blue-600/60">mg/L</span>
                        </div>
                        <p className="text-2xl font-mono font-bold text-blue-900 tracking-tighter">
                            {stats.concentration.toFixed(3)}
                        </p>
                    </div>
                    
                    {/* Progress Bar Background */}
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-200/50">
                        <div 
                            className="h-full bg-gradient-to-r from-cyan-400 to-blue-500" 
                            style={{ width: `${Math.min(100, (stats.concentration / 100) * 100)}%` }}
                        ></div>
                    </div>
                </div>
            </div>
        </>
        )}
      </div>
    </div>
  );
};

export default Overlay;