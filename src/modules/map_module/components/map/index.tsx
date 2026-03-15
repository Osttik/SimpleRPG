import { useRef } from 'react';
import { gameState } from '../../../game_module/game_state';
import { useMapInitialize } from './useMapInitialize';

export const MapComponent = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  gameState.canvasRef = canvasRef;
  
  useMapInitialize();

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        display: 'block', 
        width: '100vw', 
        height: '100vh', 
        position: 'absolute', 
        top: 0, 
        left: 0 
      }}
    />
  );
};