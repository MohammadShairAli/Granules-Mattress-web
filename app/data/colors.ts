export type ColorOption = {
  id: string;
  name: string;
  ral: string;
  code: string;
  hex: string;
};

export type SelectedColor = ColorOption & {
  weight: number;
};

export const PALETTE: ColorOption[] = [
  // Original colors (kept as-is)
  { id: "eggshell", name: "Eggshell", ral: "1015", code: "46 2400", hex: "#b9ad6a" },
  { id: "sand", name: "Sand", ral: "1001", code: "46 1600", hex: "#a4874a" },
  { id: "earth-yellow", name: "Erdgelb", ral: "1006", code: "46 5700", hex: "#c99512" },
  { id: "lime", name: "Lime", ral: "1016", code: "46 3300", hex: "#d7dd1e" },
  { id: "pearl", name: "Pearl", ral: "7035", code: "46 0500", hex: "#c9c9bb" },
  { id: "wheat", name: "Wheat", ral: "1014", code: "46 2500", hex: "#d0c47b" },
  { id: "orange", name: "Orange", ral: "2000", code: "46 4100", hex: "#c76414" },
  { id: "brick", name: "Brick", ral: "3000", code: "46 7200", hex: "#9b1918" },
  { id: "rose", name: "Rose", ral: "3017", code: "46 7500", hex: "#c9213b" },
  { id: "plum", name: "Plum", ral: "4007", code: "46 8400", hex: "#563062" },
  { id: "hertha", name: "Herthablau", ral: "5002", code: "46 9100", hex: "#181a4a" },
  { id: "midnight", name: "Midnight", ral: "5003", code: "46 9200", hex: "#08213d" },
  { id: "slate", name: "Slate", ral: "5014", code: "46 9300", hex: "#546174" },
  { id: "azure", name: "Azure", ral: "5015", code: "46 9400", hex: "#126da8" },
  { id: "marine", name: "Marine", ral: "5010", code: "46 9500", hex: "#003c73" },
  { id: "teal", name: "Teal", ral: "6033", code: "46 9600", hex: "#398a8b" },
  { id: "petrol", name: "Petrol", ral: "5020", code: "46 9700", hex: "#06476b" },
  { id: "mint", name: "Mint", ral: "6027", code: "46 9800", hex: "#73a99d" },
  { id: "forest", name: "Forest", ral: "6005", code: "46 9900", hex: "#123f2b" },
  { id: "olive", name: "Olive", ral: "6013", code: "46 9950", hex: "#42602f" },
  { id: "light-beige", name: "Light Beige", ral: "1013", code: "46 1400", hex: "#d2c9b0" },
  { id: "ivory", name: "Ivory", ral: "1015", code: "46 2400", hex: "#e4d9b8" },
  { id: "sun-yellow", name: "Sun Yellow", ral: "1021", code: "46 3100", hex: "#f9d71c" },
  { id: "ochre", name: "Ochre", ral: "1027", code: "46 2800", hex: "#b38c3d" },
  { id: "bright-orange", name: "Bright Orange", ral: "2004", code: "46 4200", hex: "#e36b1e" },
  { id: "signal-red", name: "Signal Red", ral: "3001", code: "46 7100", hex: "#a31e2e" },
  { id: "turquoise", name: "Turquoise", ral: "6027", code: "", hex: "#4a9c9e" },

  // === NEW: Melos Standard Colors from granules-designer (incl. Patina Green) ===
  { id: "beige", name: "Beige", ral: "1001", code: "46 2100", hex: "#d2b48c" },
  { id: "sand-yellow", name: "Sand Yellow", ral: "1002", code: "69 0600", hex: "#e0c68c" },
  { id: "yellow", name: "Yellow", ral: "1012", code: "46 2000", hex: "#e8c53f" },
  { id: "patina-green", name: "Patina Green", ral: "6000", code: "46 4000", hex: "#3a745f" },
  { id: "reseda-green", name: "Reseda Green", ral: "6011", code: "46 4700", hex: "#4a6b4a" },
  { id: "may-green", name: "May Green", ral: "6017", code: "46 4100", hex: "#3a8c4a" },
  { id: "rainbow-green", name: "Rainbow Green", ral: "6025", code: "46 5600", hex: "#2a6b3a" },
  { id: "signal-green", name: "Signal Green", ral: "6032", code: "46 4600", hex: "#1e8c4a" },
  { id: "gentian-blue", name: "Gentian Blue", ral: "5010", code: "69 0700", hex: "#003c7a" },
  { id: "blue-grey", name: "Blue Grey", ral: "5014", code: "46 1000", hex: "#5a6e8c" },
  { id: "sky-blue", name: "Sky Blue", ral: "5015", code: "46 1800", hex: "#2a7eb8" },
  { id: "rainbow-blue", name: "Rainbow Blue", ral: "5017", code: "46 5900", hex: "#1e4a8c" },
  { id: "turquoise-blue", name: "Turquoise Blue", ral: "5018", code: "46 5400", hex: "#1e7a8c" },
  { id: "capri-blue", name: "Capri Blue", ral: "5019", code: "46 1500", hex: "#00668c" },
  { id: "red", name: "Red", ral: "3016", code: "46 0000", hex: "#a61d2e" },
  { id: "purple", name: "Purple", ral: "4005", code: "46 3400", hex: "#5f2a6b" },
  { id: "light-grey", name: "Light Grey", ral: "7035", code: "46 3800", hex: "#b8b8b8" },
  { id: "charcoal", name: "Charcoal", ral: "7043", code: "46 9000", hex: "#4a4a4a" },
  { id: "brown", name: "Brown", ral: "8024", code: "46 2800", hex: "#5c3f2a" },
];

export const INITIAL_SELECTION: SelectedColor[] = [];

export function getPercent(color: SelectedColor, colors: SelectedColor[]) {
  const total = colors.reduce((sum, item) => sum + item.weight, 0);
  return total > 0 ? Math.round((color.weight / total) * 100) : 0;
}