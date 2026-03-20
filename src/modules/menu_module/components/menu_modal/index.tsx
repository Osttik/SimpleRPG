import { useNavigate } from "react-router-dom"; 
import { CoreButton } from "../../../../components/button";
import { CoreOverlay } from "../../../../components/overlay";
import { useMenuActions, useMenuSelections } from "../../../../store/slices/menu.slice";

export const MenuModal = () => {
  const { isMenuOpen } = useMenuSelections();
  const { setMenuState } = useMenuActions();
  const navigate = useNavigate(); 

  return (
    <CoreOverlay 
      visible={isMenuOpen}
      setVisible={setMenuState}
      content={(
        <div className="flex flex-col gap-3 p-5 min-w-[200px]">
          <CoreButton 
            label="Continue" 
            onClick={() => setMenuState(false)} 
            className="p-button-outlined w-full"
          />
          <CoreButton 
            label="Quit" 
            onClick={() => {
              if (confirm('Are you sure you want to quit to the Main Menu?')) {
                setMenuState(false);
                navigate('/');
              }
            }} 
            className="p-button-danger p-button-outlined w-full"
          />
        </div>
      )}
    />
  );
}