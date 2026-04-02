import { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import type { LucideIcon } from "lucide-react";

export interface ContextMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Use capture so we catch clicks even on xterm canvas elements
    document.addEventListener("mousedown", handleDown, { capture: true });
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown, { capture: true });
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      style={{ position: "fixed", top: y, left: x, zIndex: 9999 }}
      className="bg-[#1f2335] border border-[#292e42] rounded shadow-lg py-1 min-w-[160px]"
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.onClick(); onClose(); }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[#292e42] transition-colors ${
            item.danger ? "text-[#f7768e]" : "text-[#c0caf5]"
          }`}
        >
          {item.icon && <item.icon size={13} className="flex-shrink-0 opacity-70" />}
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
