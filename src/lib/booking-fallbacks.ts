// Fallback packages/addons used while DB data loads or if DB is unreachable.
// Extracted from Book.tsx to keep that file focused.
export { renderContractSnapshot } from "./contract-snapshot-render";
export { CustomPlanOption } from "@/components/CustomPlanOption";

export const FALLBACK_PACKAGES = [
  {
    id: "pearl",
    name: "Pearl",
    desc: "4 hours",
    priceBoth: 1950,
    priceSingle: 1150,
    photoFeatures: [
      "4 hours ~ 1 Photographer",
      "300+ fully edited photos",
      "Personalized Digital Gallery",
      "Printing Rights",
    ],
    videoFeatures: [
      "4 hours ~ 1 Videographer",
      "6+ minute highlight video",
      "Audio of Vows & Speeches",
      "Shareable Digital Portfolio Link",
      "RAW Video Footage",
    ],
    isArchived: true,
  },
  {
    id: "emerald",
    name: "Emerald",
    desc: "6 hours",
    priceBoth: 2550,
    priceSingle: 1450,
    photoFeatures: [
      "6 hours ~ 1 Photographer",
      "450+ fully edited photos",
      "Personalized Digital Gallery",
      "Printing Rights",
    ],
    videoFeatures: [
      "6 hours ~ 1 Videographer",
      "8+ minute highlight video",
      "Audio of Vows & Speeches",
      "Shareable Digital Portfolio Link",
      "RAW Video Footage",
    ],
    isArchived: true,
  },
  {
    id: "diamond",
    name: "Diamond Special",
    desc: "8 hours",
    priceBoth: 3150,
    priceSingle: 1750,
    photoFeatures: [
      "8 hours ~ 1 Photographer",
      "600+ fully edited photos",
      "Personalized Digital Gallery",
      "Printing Rights",
    ],
    videoFeatures: [
      "8 hours ~ 1 Videographer",
      "10+ minute highlight video",
      "Audio of Vows & Speeches",
      "Shareable Digital Portfolio Link",
      "RAW Video Footage",
    ],
    isArchived: true,
  },
  {
    id: "platinum",
    name: "Platinum",
    desc: "10 hours",
    priceBoth: 3750,
    priceSingle: 2050,
    photoFeatures: [
      "10 hours ~ 1 Photographer",
      "750+ fully edited photos",
      "Personalized Digital Gallery",
      "Printing Rights",
    ],
    videoFeatures: [
      "10 hours ~ 1 Videographer",
      "12+ minute highlight video",
      "Audio of Vows & Speeches",
      "Shareable Digital Portfolio Link",
      "RAW Video Footage",
    ],
    isArchived: true,
  },
  {
    id: "all_in_bride",
    name: "All-In Bride",
    desc: "10 hours",
    priceBoth: 1950,
    priceSingle: 1150,
    photoFeatures: [
      "10 hours ~ 1 Photographer",
      "750+ fully edited photos & RAW photos",
      "Personalized Digital Gallery & Printing Rights",
      "Shareable Digital Portfolio Link",
    ],
    videoFeatures: [
      "10 hours ~ 1 Videographer",
      "6+ minute highlight video & RAW Video Footage",
      "Audio of Vows & Speeches",
      "Shareable Digital Portfolio Link",
    ],
  },
];

export const FALLBACK_ADDONS = [
  {
    id: "audio",
    name: "Audio of Vows & Speeches",
    price: 125,
    isArchived: true,
  },
  { id: "drone", name: "Aerial Drone Footage", price: 250, isArchived: true },
  {
    id: "second_shooter",
    name: "2nd Shooter",
    price: 200,
    isHourly: true,
    minHours: 3,
    isArchived: true,
  },
  { id: "raw", name: "4K RAW Footage Delivery", price: 200, isArchived: true },
  {
    id: "highlight_30",
    name: "30-Min Highlight Video",
    price: 350,
    isArchived: true,
  },
  {
    id: "highlight_60",
    name: "60-Min Highlight Video",
    price: 500,
    isArchived: true,
  },
  {
    id: "extra_session",
    name: "Extra Session (Engagement/Bridals)",
    price: 450,
    isArchived: true,
  },
  { id: "drone_new", name: "Aerial Drone Footage", price: 300 },
  {
    id: "second_shooter_new",
    name: "2nd Shooter (up to 10 hours)",
    price: 750,
  },
];

/** Slim fallback packages (no feature lists) for proposal builders. */
export const FALLBACK_PACKAGES_SLIM = [
  {
    id: "pearl",
    name: "Pearl",
    desc: "4 hours",
    priceBoth: 1950,
    priceSingle: 1150,
    isArchived: true,
  },
  {
    id: "emerald",
    name: "Emerald",
    desc: "6 hours",
    priceBoth: 2550,
    priceSingle: 1450,
    isArchived: true,
  },
  {
    id: "diamond",
    name: "Diamond Special",
    desc: "8 hours",
    priceBoth: 3150,
    priceSingle: 1750,
    isArchived: true,
  },
  {
    id: "platinum",
    name: "Platinum",
    desc: "10 hours",
    priceBoth: 3750,
    priceSingle: 2050,
    isArchived: true,
  },
  {
    id: "all_in_bride",
    name: "All-In Bride",
    desc: "10 hours",
    priceBoth: 1950,
    priceSingle: 1150,
  },
];

/** Slim fallback addons (no features) for proposal builders. */
export const FALLBACK_ADDONS_SLIM = [
  {
    id: "audio",
    name: "Audio of Vows & Speeches",
    price: 125,
    isArchived: true,
  },
  { id: "drone", name: "Aerial Drone Footage", price: 250, isArchived: true },
  {
    id: "second_shooter",
    name: "2nd Shooter",
    price: 200,
    isHourly: true,
    minHours: 3,
    isArchived: true,
  },
  { id: "raw", name: "4K RAW Footage Delivery", price: 200, isArchived: true },
  {
    id: "highlight_30",
    name: "30-Min Highlight Video",
    price: 350,
    isArchived: true,
  },
  {
    id: "highlight_60",
    name: "60-Min Highlight Video",
    price: 500,
    isArchived: true,
  },
  {
    id: "extra_session",
    name: "Extra Session (Engagement/Bridals)",
    price: 450,
    isArchived: true,
  },
  { id: "drone_new", name: "Aerial Drone Footage", price: 300 },
  {
    id: "second_shooter_new",
    name: "2nd Shooter (up to 10 hours)",
    price: 750,
  },
];
