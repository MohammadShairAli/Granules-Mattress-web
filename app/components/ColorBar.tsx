"use client";

import { useEffect, useRef, useState } from "react";

import {
  getPercent,
  PALETTE,
  type ColorOption,
  type SelectedColor,
} from "../data/colors";

type ColorBarProps = {
  activeColor: SelectedColor | undefined;
  activeId: string;
  changeWeight: (id: string, delta: number) => void;
  selectedColors: SelectedColor[];
  selectColor: (option: ColorOption) => void;
  selectSelectedColor: (id: string) => void;
  removeColor: (id: string) => void;
};

function colorMeta(color: Pick<ColorOption, "code" | "ral">) {
  return [color.ral ? `RAL: ${color.ral}` : "", `Code: ${color.code}`]
    .filter(Boolean)
    .join(" | ");
}

export function ColorBar({
  activeColor,
  activeId,
  changeWeight,
  removeColor,
  selectedColors,
  selectColor,
  selectSelectedColor,
}: ColorBarProps) {
  const paletteRef = useRef<HTMLElement>(null);
  const [selectedPanelOpen, setSelectedPanelOpen] = useState(false);
  const selectedIds = new Set(selectedColors.map((color) => color.id));

  useEffect(() => {
    const palette = paletteRef.current;

    if (!palette || activeId === "") {
      return;
    }

    const activeSwatch = palette.querySelector<HTMLElement>(
      `[data-color-id="${activeId}"]`,
    );

    if (!activeSwatch) {
      return;
    }

    const centeredLeft =
      activeSwatch.offsetLeft - (palette.clientWidth - activeSwatch.offsetWidth) / 2;

    palette.scrollTo({
      behavior: "smooth",
      left: Math.max(0, centeredLeft),
    });
  }, [activeId]);

  const handlePaletteWheel = (event: React.WheelEvent<HTMLElement>) => {
    const palette = paletteRef.current;

    if (!palette) {
      return;
    }

    const scrollAmount =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;

    if (scrollAmount === 0) {
      return;
    }

    event.preventDefault();
    palette.scrollLeft += scrollAmount;
  };

  return (
    <>
      <div className="absolute bottom-24 left-0 z-20 w-48 bg-white text-sm text-neutral-400">
        <button
          aria-expanded={selectedPanelOpen}
          className="flex w-full items-center justify-between border-y border-neutral-200 px-2 py-2 text-left"
          onClick={() => setSelectedPanelOpen((open) => !open)}
          type="button"
        >
          <span>Ausgewaehlte Farben</span>
          <span
            className={`text-xl leading-none transition-transform ${
              selectedPanelOpen ? "rotate-180" : ""
            }`}
          >
            ^
          </span>
        </button>
      </div>

      {selectedPanelOpen && selectedColors.length > 0 ? (
        <section className="absolute bottom-32 left-0 z-30 w-[420px] max-w-[calc(100vw-20px)] border border-neutral-200 bg-white shadow-sm">
          <div className="flex h-9 items-center border-b border-neutral-200 text-sm">
            <div className="min-w-0 flex-1 px-2 text-neutral-700">
              Ausgewaehlte Farben
            </div>
            <button
              className="h-full bg-orange-500 px-3 text-white"
              onClick={() => activeColor && changeWeight(activeColor.id, 1)}
              type="button"
            >
              %-Farbverteilung aendern
            </button>
            <button
              aria-label="Close selected colors"
              className="h-full px-2 text-lg leading-none text-neutral-400 hover:text-neutral-700"
              onClick={() => setSelectedPanelOpen(false)}
              type="button"
            >
              x
            </button>
          </div>

          <div className="selected-colors-scroll h-40 space-y-2 overflow-y-scroll px-3 py-2">
            {selectedColors.map((color) => (
              <div
                className={`flex min-h-6 items-center gap-2 text-sm ${
                  activeId === color.id ? "text-neutral-950" : "text-neutral-500"
                }`}
                key={color.id}
              >
                <button
                  aria-label={`Select ${color.name}`}
                  className="h-4 w-4 shrink-0"
                  onClick={() => selectSelectedColor(color.id)}
                  style={{ backgroundColor: color.hex }}
                  type="button"
                />
                <button
                  className="min-w-0 flex-1 truncate text-left leading-6"
                  onClick={() => selectSelectedColor(color.id)}
                  type="button"
                >
                  <span className="font-semibold">{color.name}</span>
                  <span className="text-neutral-400">
                    {" "}
                    | {colorMeta(color)} | {color.weight}x (
                    {getPercent(color, selectedColors)}%)
                  </span>
                </button>
                <button
                  aria-label={`Remove ${color.name}`}
                  className="px-2 text-lg leading-none text-neutral-400 hover:text-orange-500"
                  onClick={() => removeColor(color.id)}
                  type="button"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activeColor ? (
        <section className="absolute bottom-36 left-1/2 z-30 w-48 -translate-x-1/2 border border-neutral-200 bg-white text-center shadow-md">
          <div className="px-3 py-3">
            <p className="text-sm font-semibold text-neutral-600">
              {activeColor.name}
            </p>
            <p className="mt-1 border-b border-neutral-200 pb-2 text-xs text-neutral-400">
              {colorMeta(activeColor)}
            </p>
            <p className="pt-2 text-xs font-medium text-orange-500">Anteil(e)</p>
            <div className="mt-1 flex items-center justify-between">
              <button
                aria-label="Decrease frequency"
                className="h-10 w-10 border border-orange-200 text-3xl leading-none text-orange-500"
                onClick={() => changeWeight(activeColor.id, -1)}
                type="button"
              >
                -
              </button>
              <span className="text-3xl font-light text-orange-500">
                {activeColor.weight}
              </span>
              <button
                aria-label="Increase frequency"
                className="h-10 w-10 border border-orange-200 text-3xl leading-none text-orange-500"
                onClick={() => changeWeight(activeColor.id, 1)}
                type="button"
              >
                +
              </button>
            </div>
          </div>
          <div className="absolute left-1/2 top-full h-4 w-4 -translate-x-1/2 -translate-y-2 rotate-45 border-b border-r border-neutral-200 bg-white" />
        </section>
      ) : null}

      <div className="absolute bottom-0 left-0 right-0 z-10 h-32 border-t border-neutral-200 bg-white">
        <button
          aria-label="Confirm color selection"
          className="absolute left-10 top-1/2 z-20 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-orange-500 text-4xl font-light text-white shadow-lg"
          type="button"
        >
          &#10003;
        </button>

        <section
          className="no-scrollbar absolute inset-0 flex items-end gap-9 overflow-x-auto overscroll-x-contain scroll-smooth px-7 pb-4 pr-48"
          onWheel={handlePaletteWheel}
          ref={paletteRef}
        >
          {PALETTE.map((option) => {
            const selected = selectedIds.has(option.id);
            const active = activeId === option.id;

            return (
              <button
                aria-label={`Use ${option.name}`}
                className={`relative shrink-0 border transition ${
                  active
                    ? "h-28 w-28 border-orange-500 bg-white p-2"
                    : selected
                      ? "h-14 w-14 border-orange-400"
                      : "h-14 w-14 border-transparent hover:border-orange-300"
                }`}
                data-color-id={option.id}
                key={option.id}
                onClick={() => selectColor(option)}
                type="button"
              >
                <span
                  className="block h-full w-full"
                  style={{
                    backgroundColor: option.hex,
                    backgroundImage: `url("${option.previewImage}")`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }}
                />
                {active ? (
                  <span className="absolute -top-3 left-1/2 h-1.5 w-14 -translate-x-1/2 bg-orange-500" />
                ) : null}
              </button>
            );
          })}
        </section>

        <div className="absolute right-2 top-0 hidden h-8 w-40 items-center gap-2 border-y border-neutral-200 bg-white py-2 text-sm text-neutral-400 md:flex">
          <span className="pl-1 text-xl leading-none">^</span>
          <span>Realvorschau</span>
        </div>
      </div>
    </>
  );
}
