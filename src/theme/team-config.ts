export const TEAM_CODES = {
  AGUIA: "AGUIA",
  LEAO: "LEAO",
} as const;

export type TeamCode = keyof typeof TEAM_CODES;

export const TEAM_CONFIG = {
  [TEAM_CODES.AGUIA]: {
    name: "Águia",
    icon: "🦅",
    colors: {
      primary: "#2563eb", // blue-600
      secondary: "#60a5fa", // blue-400
      accent: "#facc15", // amber-400 (Dourado)
      background: "bg-blue-50",
      border: "border-blue-200",
      gradient: "from-blue-600 to-sky-400",
    },
    visual: {
      intensity: "light",
      shadow: "shadow-blue-100",
    },
  },
  [TEAM_CODES.LEAO]: {
    name: "Leão",
    icon: "🦁",
    colors: {
      primary: "#dc2626", // red-600
      secondary: "#ef4444", // red-500
      accent: "#facc15", // amber-400 (Dourado)
      background: "bg-red-50",
      border: "border-red-200",
      gradient: "from-red-700 to-rose-500",
    },
    visual: {
      intensity: "bold",
      shadow: "shadow-red-100",
    },
  },
} as const;
