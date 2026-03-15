import { CoreButton } from "../../../../components/button";
import { CoreOverlay } from "../../../../components/overlay";
import { useMenuActions, useMenuSelections } from "../../../../store/slices/menu.slice";

export const MenuModal = () => {
  const { isMenuOpen } = useMenuSelections();
  const { setMenuState } = useMenuActions();

  return (
    <CoreOverlay 
      visible={isMenuOpen}
      setVisible={setMenuState}
      content={(
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px' }}>
          <CoreButton 
            label="Continue" 
            onClick={() => setMenuState(false)} 
            className="p-button-outlined"
          />
          <CoreButton 
            label="Quit" 
            onClick={() => {
              if (confirm('Are you sure you want to quit?')) {
                window.close();
                // Fallback if window.close() is blocked
                setTimeout(() => {
                  window.location.href = 'about:blank';
                }, 100);
              }
            }} 
            className="p-button-danger p-button-outlined"
          />
        </div>
      )}
    />
  );
}
