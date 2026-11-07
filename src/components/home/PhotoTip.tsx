"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { ICamera, IClose } from "../art/Icons";
import { setPref } from "@/lib/store";

/** Shows where on the box to aim before the camera opens: the small label in the top-left corner of the front. */
export default function PhotoTip({ onShoot, onClose }: Readonly<{ onShoot: () => void; onClose: () => void }>) {
  const go = useRef<HTMLButtonElement>(null);
  // the latest onClose, so a re-render of the search box doesn't rerun the effect and move focus
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    go.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // closes this alone, as the key modal does
      e.preventDefault();
      e.stopImmediatePropagation();
      close.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      back?.focus?.({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <motion.div className="key-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.16 } }} onClick={onClose}>
      <motion.div
        className="key-modal photo-tip"
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-tip-title"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="key-x" onClick={onClose} aria-label="Close">
          <IClose size={18} />
        </button>
        <div className="key-hero pt-hero">
          <BoxFront />
        </div>
        <h2 id="photo-tip-title">Snap the label in the corner</h2>
        <p className="key-sub">
          Every JYSK box has its product number and name printed small in the <b>top-left corner</b> of the front, like <b>3670661</b>. Get close so it fills the photo. The cover of the paper manual works too.
        </p>
        <button ref={go} className="btn primary pt-go" onClick={onShoot}>
          <ICamera size={20} />
          Take photo
        </button>
        <label className="pt-hide">
          <input type="checkbox" onChange={(e) => setPref("photoTipHidden", e.target.checked)} />
          Don&apos;t show again
        </label>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/** Our own drawing of a box front: the whole box, then a zoom into the corner label. */
function BoxFront() {
  return (
    <svg className="pt-svg" viewBox="0 0 200 140" role="img" aria-label="A box front, zooming into the product number in its top-left corner">
      <g className="pt-box">
        <rect x="60" y="6" width="80" height="128" rx="1.5" className="pt-card" />
        <g className="pt-label">
          <rect x="62" y="9" width="66" height="17" rx="1" className="pt-mark" />
          <text x="64" y="14" className="pt-no">3670661</text>
          <text x="64" y="19.2">4 drawer chest LIMFJORDEN beige</text>
          <text x="64" y="24">Box 1/2</text>
        </g>
        <rect x="84" y="40" width="32" height="2.4" className="pt-ink" />
        <rect x="78" y="45" width="44" height="4.5" className="pt-ink" />
        <rect x="88" y="53" width="24" height="2.4" className="pt-ink" />
        <g className="pt-chest">
          <path d="M80 66h40v42H80zM80 66l-6 4v42l6-4M74 112h40l6-4" />
          <path d="M82 75h36M82 85h36M82 95h36" />
        </g>
      </g>
      <g className="pt-finder">
        <path d="M14 50v-6h10M176 44h10v6M186 90v6h-10M24 96H14v-6" />
      </g>
    </svg>
  );
}
