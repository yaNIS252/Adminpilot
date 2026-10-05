"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

/**
 * Menu déroulant aux couleurs de l'application.
 *
 * Remplace le `<select>` natif, dont la liste s'ouvre aux couleurs du système
 * (blanche sous Windows, au milieu d'une interface sombre). Clavier : flèches,
 * Entrée, Échap ; un clic à l'extérieur referme.
 */
export function SelectMenu<T extends string>({
  label,
  icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon?: React.ReactNode;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function toggle() {
    setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen((previous) => !previous);
  }

  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") return setOpen(false);
    if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      return toggle();
    }
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(options.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    }
  }

  return (
    <div ref={root} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label} : ${current?.label}`}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className={`inline-flex h-9 items-center gap-2 rounded-[9px] border px-3 text-[13px] transition-colors ${
          open
            ? "border-[rgb(var(--accent-rgb)/.55)] bg-[var(--accent-soft)] text-[var(--text)]"
            : "border-[var(--border)] bg-[rgba(255,255,255,.03)] text-[var(--text-dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
        }`}
      >
        {icon && <span className="text-[var(--accent-light)]">{icon}</span>}
        <span className="text-[var(--text-faint)]">{label}</span>
        <span className="font-medium text-[var(--text)]">{current?.label}</span>
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute right-0 z-30 mt-1.5 min-w-full list-none overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--bg)] p-1 shadow-[0_18px_40px_rgba(0,0,0,.45)]"
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={selected}
                onPointerEnter={() => setActive(index)}
                onClick={() => choose(index)}
                className={`flex cursor-pointer items-center justify-between gap-4 rounded-[7px] px-3 py-2 text-[13px] whitespace-nowrap ${
                  index === active ? "bg-[rgba(255,255,255,.06)] text-[var(--text)]" : "text-[var(--text-dim)]"
                }`}
              >
                {option.label}
                {selected && <Check className="size-3.5 text-[var(--accent-light)]" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
