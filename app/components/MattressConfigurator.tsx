"use client";

import { useMemo, useState } from "react";

import {
  INITIAL_SELECTION,
  type ColorOption,
  type SelectedColor,
} from "../data/colors";
import { ColorBar } from "./ColorBar";
import { MattressViewer } from "./MattressViewer";

export function MattressConfigurator() {
  const [selectedColors, setSelectedColors] =
    useState<SelectedColor[]>(INITIAL_SELECTION);
  const [activeId, setActiveId] = useState("");

  const activeColor = useMemo(
    () => selectedColors.find((color) => color.id === activeId) ?? selectedColors[0],
    [activeId, selectedColors],
  );

  const selectColor = (option: ColorOption) => {
    setActiveId(option.id);
    setSelectedColors((current) => {
      if (current.some((color) => color.id === option.id)) {
        return current;
      }

      return [...current, { ...option, weight: 1 }];
    });
  };

  const removeColor = (id: string) => {
    setSelectedColors((current) => {
      const next = current.filter((color) => color.id !== id);

      if (activeId === id) {
        setActiveId(next[0]?.id ?? "");
      }

      return next;
    });
  };

  const changeWeight = (id: string, delta: number) => {
    setSelectedColors((current) =>
      current.map((color) =>
        color.id === id
          ? { ...color, weight: Math.max(1, Math.min(12, color.weight + delta)) }
          : color,
      ),
    );
  };

  return (
    <main className="relative h-screen overflow-hidden bg-white">
      <MattressViewer selectedColors={selectedColors} />
      <ColorBar
        activeColor={activeColor}
        activeId={activeId}
        changeWeight={changeWeight}
        removeColor={removeColor}
        selectedColors={selectedColors}
        selectColor={selectColor}
        selectSelectedColor={setActiveId}
      />
    </main>
  );
}
