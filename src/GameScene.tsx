import { MapComponent } from './modules/map_module';
import { UIComponent } from './UI';
 
interface GameSceneProps {
  memberToken: string;
  onReady?: () => void;
}

function GameScene({ memberToken, onReady }: GameSceneProps) {

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-neutral-900">
      <MapComponent memberToken={memberToken} onReady={onReady} />
      <UIComponent />
    </div>
  );
}

export default GameScene;
