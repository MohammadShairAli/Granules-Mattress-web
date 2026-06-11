export type ColorOption = {
  id: string;
  name: string;
  hex: string;
  code: string;
  previewImage: string;
  ral?: string;
};

export type SelectedColor = ColorOption & {
  weight: number;
};

export const PALETTE: ColorOption[] = [
  { id: "ch-01-arctic-gray", name: "Arctic Gray", hex: "#A5AFAF", code: "CH-01", previewImage: "/Solid color/1 Light Gray.jpg" },
  { id: "ch-22-gray", name: "Gray", hex: "#767A80", code: "CH-22", previewImage: "/Solid color/2 Gray.jpg" },
  { id: "ch-43-dark-gray", name: "Dark Gray", hex: "#555C5E", code: "CH-43", previewImage: "/Solid color/3 Dark Gray.jpg" },

  { id: "ch-11-distressed-blue", name: "Distressed Blue", hex: "#46A4B6", code: "CH-11", previewImage: "/Solid color/4 Resin Rock Blue.jpg" },
  { id: "ch-39-light-blue", name: "Light Blue", hex: "#0284BC", code: "CH-39", previewImage: "/Solid color/5 Light Blue.jpg" },
  { id: "ch-47-dark-blue", name: "Dark Blue", hex: "#03628A", code: "CH-47", previewImage: "/Solid color/6 Dark Blue.jpg" },
  { id: "ch-53-navy-blue", name: "Navy Blue", hex: "#055096", code: "CH-53", previewImage: "/Solid color/7 Navy Blue.jpg" },

  { id: "ch-02-tan", name: "Tan", hex: "#C9AF82", code: "CH-02", previewImage: "/Solid color/8 Tan.jpg" },
  { id: "ch-51-caramel", name: "Caramel", hex: "#B4863D", code: "CH-51", previewImage: "/Solid color/9 Caramel.jpg" },
  { id: "ch-58-light-brown", name: "Light Brown", hex: "#9E7F6B", code: "CH-58", previewImage: "/Solid color/10 Light Brown.jpg" },
  { id: "ch-50-brown", name: "Brown", hex: "#6B433C", code: "CH-50", previewImage: "/Solid color/11 Brown.jpg" },

  { id: "ch-07-white", name: "White", hex: "#ECECEB", code: "CH-07", previewImage: "/Solid color/12 White.png" },
  { id: "ch-14-pearl-white", name: "Pearl White", hex: "#E5E1C4", code: "CH-14", previewImage: "/Solid color/13 Pearl White.png" },

  { id: "ch-17-red", name: "Red", hex: "#B4252D", code: "CH-17", previewImage: "/Solid color/14 Red.png" },
  { id: "ch-52-salmon", name: "Salmon", hex: "#B96165", code: "CH-52", previewImage: "/Solid color/15 Salmon.jpg" },

  { id: "ch-49-moss", name: "Moss", hex: "#516A46", code: "CH-49", previewImage: "/Solid color/16 Moss.jpg" },
  { id: "ch-34-clover-green", name: "Clover Green", hex: "#76A172", code: "CH-34", previewImage: "/Solid color/17  Clover.jpg" },
  { id: "ch-41-field-green", name: "Field Green", hex: "#038B57", code: "CH-41", previewImage: "/Solid color/27 Field Green.jpg" },

  { id: "ch-57-black", name: "Black", hex: "#2D332D", code: "CH-57", previewImage: "/Solid color/18 Black.jpg" },

  { id: "ch-37-yellow", name: "Yellow", hex: "#F6E437", code: "CH-37", previewImage: "/Solid color/19 Yellow.jpg" },
  { id: "ch-19-orange", name: "Orange", hex: "#FC9E4D", code: "CH-19", previewImage: "/Solid color/20 Orange.png" },

  { id: "ch-40-purple", name: "Purple", hex: "#553F80", code: "CH-40", previewImage: "/Solid color/21 Purple.jpg" },
  { id: "ch-24-pink", name: "Pink", hex: "#DE7886", code: "CH-24", previewImage: "/Solid color/22 Pink.jpg" },

  { id: "ch-42-apple-green", name: "Apple Green", hex: "#40B34D", code: "CH-42", previewImage: "/Solid color/23 Granny Smith.jpg" },
  { id: "ch-28-peach", name: "Peach", hex: "#E7B173", code: "CH-28", previewImage: "/Solid color/24 Peach.jpg" },
  { id: "ch-33-lilac", name: "Lilac", hex: "#A386B6", code: "CH-33", previewImage: "/Solid color/25 Lilac.jpg" },
  { id: "ch-20-teal", name: "Teal", hex: "#4A9892", code: "CH-20", previewImage: "/Solid color/26 Teal.png" },
  { id: "ch-10-magenta", name: "Magenta", hex: "#98147C", code: "CH-10", previewImage: "/Solid color/28 Magenta.png" },
];

export const INITIAL_SELECTION: SelectedColor[] = [];

export function getPercent(color: SelectedColor, colors: SelectedColor[]) {
  const total = colors.reduce((sum, item) => sum + item.weight, 0);
  return total > 0 ? Math.round((color.weight / total) * 100) : 0;
}
