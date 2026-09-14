"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";

/** Native modal focus, keyboard dismissal and background isolation. */
export function Modal({ open, title, eyebrow, children, onClose, className = "", error }: {
  open: boolean; title: string; eyebrow?: string; children: ReactNode;
  onClose?: () => void; className?: string; error?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    heading.current?.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, [open]);
  return <dialog ref={ref} className={`game-modal ${className}`} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose?.(); }}
    onClick={(event) => {
      if (event.target !== event.currentTarget || !onClose) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
    <header className="modal-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={titleId} ref={heading} tabIndex={-1}>{title}</h2></div>{onClose && <button type="button" className="modal-close quiet" aria-label={`關閉${title}`} onClick={onClose}>×</button>}</header>
    {error && <p className="modal-error" role="alert">{error}</p>}
    {children}
  </dialog>;
}
