import { MapComponent } from './modules/map_module';
import { UIComponent } from './UI';

function App() {

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-neutral-900">
      <MapComponent />
      <UIComponent />
    </div>
  );
}

export default App
