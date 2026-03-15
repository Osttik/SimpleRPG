import { Dialog, type ContentProps } from "primereact/dialog";
import type { ReactNode } from "react";

interface IProps {
  visible: boolean;
  setVisible: (v: boolean) => void;
  content?: ReactNode | ((props: ContentProps) => React.ReactNode) | string | string[];
}

export const CoreOverlay = ( {
  visible,
  setVisible,
  content,
}: IProps) => {
  const handleOnHide = () => {
    if (!visible) return; 
    setVisible(false);
  }

  return (
    <Dialog
      visible={visible}
      modal
      onHide={handleOnHide}
      content={content}
    />
  );
}