import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      borderRadius: { lg: "0.5rem", md: "0.375rem", sm: "0.25rem" },
      keyframes: {
        // Onglet MSF "casino" (Steven 08/08) : animations partagees, definies
        // une fois ici plutot qu'en <style> inline pour rester reutilisables.
        "msf-shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "msf-glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(251,191,36,0.0), 0 0 12px 0 rgba(251,191,36,0.15)" },
          "50%": { boxShadow: "0 0 0 3px rgba(251,191,36,0.12), 0 0 22px 4px rgba(251,191,36,0.35)" },
        },
        "msf-deal-in": {
          "0%": { opacity: "0", transform: "translateY(-6px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "msf-flash-win": {
          "0%": { backgroundColor: "rgba(16,185,129,0.35)" },
          "100%": { backgroundColor: "rgba(16,185,129,0)" },
        },
        "msf-flash-loss": {
          "0%": { backgroundColor: "rgba(239,68,68,0.35)" },
          "100%": { backgroundColor: "rgba(239,68,68,0)" },
        },
        "msf-pop": {
          "0%": { transform: "scale(1)" },
          "35%": { transform: "scale(1.06)" },
          "100%": { transform: "scale(1)" },
        },
        "msf-dot-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.75)" },
        },
      },
      animation: {
        "msf-shimmer": "msf-shimmer 2.6s linear infinite",
        "msf-glow-pulse": "msf-glow-pulse 2.4s ease-in-out infinite",
        "msf-deal-in": "msf-deal-in 0.4s cubic-bezier(0.16,1,0.3,1) both",
        "msf-flash-win": "msf-flash-win 1.4s ease-out both",
        "msf-flash-loss": "msf-flash-loss 1.4s ease-out both",
        "msf-pop": "msf-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
        "msf-dot-pulse": "msf-dot-pulse 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
