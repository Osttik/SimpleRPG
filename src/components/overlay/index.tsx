import { Dialog, type ContentProps } from "primereact/dialog";
import { useEffect } from "react";
import type { ReactNode } from "react";

const OVERLAY_OPEN_CLASS = "overlay-open";
let visibleOverlayCount = 0;

const syncOverlayOpenClass = () => {
  if (typeof document === "undefined") return;
  document.body.classList.toggle(OVERLAY_OPEN_CLASS, visibleOverlayCount > 0);
}

export const isOverlayOpen = () => {
  if (typeof document === "undefined") return false;
  return document.body.classList.contains(OVERLAY_OPEN_CLASS);
};

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
  useEffect(() => {
    if (!visible) return;

    visibleOverlayCount += 1;
    syncOverlayOpenClass();

    return () => {
      visibleOverlayCount = Math.max(0, visibleOverlayCount - 1);
      syncOverlayOpenClass();
    };
  }, [visible]);

  const handleOnHide = () => {
    if (!visible) return; 
    setVisible(false);
  }

  return (
    <Dialog
      visible={visible}
      modal
      maximized={maximized}
      className={maximized ? "core-overlay core-overlay-maximized" : "core-overlay"}
      contentClassName="core-overlay-content"
      style={maximized ? { width: "100vw", height: "100vh", maxHeight: "100vh", margin: 0 } : undefined}
      contentStyle={maximized ? { height: "100%", padding: 0, overflow: "hidden" } : undefined}
      draggable={false}
      resizable={false}
      onHide={handleOnHide}
      content={content}
    />
  );
}
