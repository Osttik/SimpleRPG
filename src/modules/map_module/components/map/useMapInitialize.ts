import { useWebGLRender } from './useWebGLRender';
import { useWebSocket } from './useWebSocket';
import { useControls } from './useControls';

export const useMapInitialize = () => {
  useWebGLRender();
  const socket = useWebSocket();
  useControls(socket);
};