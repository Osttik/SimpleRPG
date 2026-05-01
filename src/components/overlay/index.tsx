import { Dialog } from "primereact/dialog";
import { useEffect, useId, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

const OVERLAY_OPEN_CLASS = "overlay-open";
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

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
  title?: string;
  ariaLabel?: string;
  closeLabel?: string;
  closeOnEscape?: boolean;
  maximized?: boolean;
  content?: ReactNode;
}

export const CoreOverlay = ( {
  visible,
  title,
  ariaLabel,
  closeLabel,
  closeOnEscape = true,
  content,
  maximized,
  setVisible,
}: IProps) => {
  const titleId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const accessibleTitle = title ?? ariaLabel;

  useEffect(() => {
    if (!visible) return;

    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    visibleOverlayCount += 1;
    syncOverlayOpenClass();

    return () => {
      visibleOverlayCount = Math.max(0, visibleOverlayCount - 1);
      syncOverlayOpenClass();

      const restoreTarget = restoreFocusRef.current;
      if (
        visibleOverlayCount === 0
        && restoreTarget
        && document.contains(restoreTarget)
      ) {
        restoreTarget.focus({ preventScroll: true });
      }
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const focusTimer = window.setTimeout(() => {
      const contentElement = contentRef.current;
      if (!contentElement || contentElement.contains(document.activeElement)) return;

      const firstFocusable = contentElement.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? contentElement).focus({ preventScroll: true });
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [visible]);

  const handleOnHide = () => {
    if (!visible) return; 
    setVisible(false);
  }

  const handleContentKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!closeOnEscape || event.key !== 'Escape') return;
    event.stopPropagation();
    handleOnHide();
  };

  return (
    <Dialog
      visible={visible}
      modal
      aria-label={ariaLabel ?? title}
      aria-labelledby={accessibleTitle ? titleId : undefined}
      ariaCloseIconLabel={closeLabel}
      closeOnEscape={closeOnEscape}
      maximized={maximized}
      className={maximized ? "core-overlay core-overlay-maximized" : "core-overlay"}
      contentClassName="core-overlay-content"
      style={maximized ? { width: "100vw", height: "100vh", maxHeight: "100vh", margin: 0 } : undefined}
      contentStyle={maximized ? { height: "100%", padding: 0, overflow: "hidden" } : undefined}
      draggable={false}
      resizable={false}
      onHide={handleOnHide}
    >
      <div
        ref={contentRef}
        className="core-overlay-focus-root"
        tabIndex={-1}
        onKeyDown={handleContentKeyDown}
      >
        {accessibleTitle ? (
          <span id={titleId} className="sr-only">{accessibleTitle}</span>
        ) : null}
        {content}
      </div>
    </Dialog>
  );
}
