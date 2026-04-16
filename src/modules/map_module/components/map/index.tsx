import React, { useRef } from 'react';
import { gameState } from '../../../game_module/game_state';
import { useMapInitialize } from './useMapInitialize';

interface MapComponentProps {
  memberToken: string;
  onReady?: () => void;
}

export const MapComponent = React.memo(({ memberToken, onReady }: MapComponentProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  gameState.canvasRef = canvasRef;
  
  useMapInitialize(memberToken, onReady);

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
});
