import { Dialog, type ContentProps } from "primereact/dialog";
import type { ReactNode } from "react";

interface IProps {
  visible: boolean;
  setVisible: (v: boolean) => void;
  maximized?: boolean;
  content?: ReactNode | ((props: ContentProps) => React.ReactNode) | string | string[];
}

export const CoreOverlay = ( {
  visible,
  content,
  maximized,
  setVisible,
}: IProps) => {
  const handleOnHide = () => {
    if (!visible) return; 
    setVisible(false);
  }

  return (
    <Dialog
      visible={visible}
      modal
      maximized={maximized}
      onHide={handleOnHide}
      content={content}
    />
  );
}