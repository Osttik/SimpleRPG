import { CoreButton } from './components/button';
import { MapComponent } from './modules/map_module';
import { MenuModal } from './modules/menu_module'
import { useMenuActions, useMenuSelections } from './store/slices/menu.slice';

function App() {
  const { setMenuState } = useMenuActions();
  const { isMenuOpen } = useMenuSelections();

  return (
    <>
      <MapComponent />
      <MenuModal />
      <CoreButton onClick={() => setMenuState(!isMenuOpen)} />
    </>
  );
}

export default App
