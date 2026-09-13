// Portal theme types, defaults, and helpers.
// The bride portal uses HSL-channel CSS variables (see .bride-portal in index.css).
// We store hex colors in the DB for easy editing, then convert to HSL channels at runtime.

export interface PortalTheme {
  primary: string; // near-black text / buttons
  background: string; // page background
  accent: string; // champagne gold highlights
  secondary: string; // card/section backgrounds
  border: string; // borders
  mutedText: string; // muted foreground
  bodyFont: string; // body font family name
  headingFont: string; // heading font family name
}

export const DEFAULT_PORTAL_THEME: PortalTheme = {
  primary: "#1a1a1a",
  background: "#faf7f2",
  accent: "#c9a96e",
  secondary: "#f7f3ee",
  border: "#e0d5c0",
  mutedText: "#736b5d",
  bodyFont: "Fira Sans",
  headingFont: "DM Serif Display",
};

export interface FontPair {
  label: string;
  body: string;
  heading: string;
  // Google Fonts request params (family=...)
  googleHref: string;
}

// Curated font pairs. Each href loads both body + heading weights.
export const PORTAL_FONT_PAIRS: FontPair[] = [
  {
    label: "Champagne (default)",
    body: "Fira Sans",
    heading: "DM Serif Display",
    googleHref:
      "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Fira+Sans:wght@300;400;500;600;700&display=swap",
  },
  {
    label: "Editorial",
    body: "Inter",
    heading: "Playfair Display",
    googleHref:
      "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital@0;1&display=swap",
  },
  {
    label: "Luxury",
    body: "Montserrat",
    heading: "Cormorant Garamond",
    googleHref:
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital@0;1&family=Montserrat:wght@300;400;500;600;700&display=swap",
  },
  {
    label: "Classic",
    body: "Lato",
    heading: "Bodoni Moda",
    googleHref:
      "https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital@0;1&family=Lato:wght@300;400;700&display=swap",
  },
  {
    label: "Contemporary",
    body: "Poppins",
    heading: "Fraunces",
    googleHref:
      "https://fonts.googleapis.com/css2?family=Fraunces:ital@0;1&family=Poppins:wght@300;400;500;600;700&display=swap",
  },
  {
    label: "Warm Readable",
    body: "Karla",
    heading: "Lora",
    googleHref:
      "https://fonts.googleapis.com/css2?family=Karla:wght@300;400;500;600;700&family=Lora:ital@0;1&display=swap",
  },
  {
    label: "Clean Serif",
    body: "Work Sans",
    heading: "DM Serif Display",
    googleHref:
      "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Work+Sans:wght@300;400;500;600;700&display=swap",
  },
];

export function fontPairFor(body: string, heading: string): FontPair {
  return (
    PORTAL_FONT_PAIRS.find((p) => p.body === body && p.heading === heading) ||
    PORTAL_FONT_PAIRS[0]
  );
}

// Convert #rrggbb to "H S% L%" channel string for Tailwind hsl(var(...)) tokens.
export function hexToHslChannels(hex: string): string {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return "0 0% 10%";
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);
  return `${hDeg} ${sPct}% ${lPct}%`;
}

// Derive a readable foreground (light or dark) for a given background hex.
export function readableForeground(bgHex: string): string {
  const cleaned = bgHex.replace("#", "");
  if (cleaned.length !== 6) return "#ffffff";
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
  return l > 0.6 ? "#1a1a1a" : "#faf7f2";
}

const STYLE_TAG_ID = "portal-theme-override";
const FONT_LINK_ID = "portal-theme-font";

// Injects a <style> tag overriding .bride-portal CSS variables + font families.
export function applyPortalTheme(theme: PortalTheme | null | undefined) {
  const existing = document.getElementById(STYLE_TAG_ID);
  if (!theme) {
    if (existing) existing.remove();
    return;
  }

  const merged = { ...DEFAULT_PORTAL_THEME, ...theme };
  const primaryFg = readableForeground(merged.primary);

  const css = `
.bride-portal {
  --primary: ${hexToHslChannels(merged.primary)};
  --primary-foreground: ${hexToHslChannels(primaryFg)};
  --secondary: ${hexToHslChannels(merged.secondary)};
  --secondary-foreground: ${hexToHslChannels(merged.primary)};
  --muted: ${hexToHslChannels(merged.secondary)};
  --muted-foreground: ${hexToHslChannels(merged.mutedText)};
  --accent: ${hexToHslChannels(merged.accent)};
  --accent-foreground: ${hexToHslChannels(merged.primary)};
  --background: ${hexToHslChannels(merged.background)};
  --card: ${hexToHslChannels("#ffffff")};
  --border: ${hexToHslChannels(merged.border)};
  --ring: ${hexToHslChannels(merged.primary)};
  background-color: ${merged.background};
  font-family: "${merged.bodyFont}", system-ui, -apple-system, sans-serif;
}
.bride-portal .font-serif {
  font-family: "${merged.headingFont}", Georgia, serif !important;
}
`.trim();

  if (existing) {
    existing.textContent = css;
  } else {
    const style = document.createElement("style");
    style.id = STYLE_TAG_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Load the matching Google Fonts link if needed.
  const pair = fontPairFor(merged.bodyFont, merged.headingFont);
  const existingLink = document.getElementById(
    FONT_LINK_ID,
  ) as HTMLLinkElement | null;
  if (existingLink) {
    if (existingLink.getAttribute("href") !== pair.googleHref) {
      existingLink.setAttribute("href", pair.googleHref);
    }
  } else {
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href = pair.googleHref;
    document.head.appendChild(link);
  }
}

export function parsePortalTheme(raw: any): PortalTheme | null {
  if (!raw) return null;
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    return { ...DEFAULT_PORTAL_THEME, ...obj };
  } catch {
    return null;
  }
}
