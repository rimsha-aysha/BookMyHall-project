// Domain knowledge the rule-based engine uses to interpret an event type.
// `match` identifies the profile from the customer's free-text event type;
// `keywords` are looked for in catalog names/descriptions/amenities;
// `services`/`decorStyles` are the interests that usually suit the event.
export const EVENT_PROFILES = {
  wedding: {
    label: "Wedding",
    match: ["wedding", "nikah", "walima", "mehndi", "mehendi", "barat", "baraat", "reception", "shaadi", "shadi", "valima"],
    keywords: ["wedding", "bridal", "mandap", "floral", "stage", "dance", "grand", "reception", "traditional", "ceremony"],
    services: ["photography", "videography", "valet", "music"],
    decorStyles: ["floral", "traditional", "lighting", "table decor"],
    courses: { Starter: 2, "Main Course": 2, Dessert: 2, Beverage: 1 },
  },
  engagement: {
    label: "Engagement",
    match: ["engagement", "ring", "mangni", "mehfil"],
    keywords: ["engagement", "ring", "floral", "backdrop", "elegant", "photo", "ceremony"],
    services: ["photography", "videography", "music"],
    decorStyles: ["floral", "lighting"],
    courses: { Starter: 2, "Main Course": 1, Dessert: 1, Beverage: 1 },
  },
  birthday: {
    label: "Birthday",
    match: ["birthday", "kids", "party", "bday", "children"],
    keywords: ["birthday", "kids", "balloon", "party", "cake", "themed", "fun", "children", "casual"],
    services: ["photography", "music"],
    decorStyles: ["balloons", "themed"],
    courses: { Starter: 1, "Main Course": 1, Dessert: 1, Beverage: 1 },
  },
  anniversary: {
    label: "Anniversary",
    match: ["anniversary"],
    keywords: ["anniversary", "romantic", "fairy", "floral", "intimate", "elegant", "evening"],
    services: ["photography", "music"],
    decorStyles: ["lighting", "floral", "table decor"],
    courses: { Starter: 1, "Main Course": 1, Dessert: 1, Beverage: 1 },
  },
  corporate: {
    label: "Corporate Event",
    match: ["corporate", "conference", "seminar", "meeting", "business", "workshop", "launch", "training", "office"],
    keywords: ["corporate", "conference", "seminar", "meeting", "projector", "wi-fi", "business", "professional", "whiteboard"],
    services: ["security", "photography"],
    decorStyles: ["table decor", "minimal"],
    courses: { Starter: 1, "Main Course": 1, Beverage: 1 },
  },
};

export const DEFAULT_PROFILE = {
  label: "Event",
  match: [],
  keywords: ["elegant", "celebration", "party", "event"],
  services: ["photography"],
  decorStyles: [],
  courses: { Starter: 1, "Main Course": 1, Dessert: 1, Beverage: 1 },
};

// Customer-facing service interests → words that identify matching services.
export const SERVICE_INTERESTS = {
  photography: ["photo"],
  videography: ["video", "reel", "film"],
  music: ["dj", "band", "music", "sound", "entertainment"],
  valet: ["valet", "parking"],
  security: ["security", "guard", "crowd"],
};

// Decoration styles the customer can pick → words that identify them.
export const DECORATION_STYLES = {
  floral: ["floral", "flower", "rose"],
  lighting: ["light", "fairy", "lamp", "candle"],
  traditional: ["traditional", "mandap", "cultural"],
  themed: ["themed", "theme", "kids", "cartoon"],
  balloons: ["balloon"],
  "table decor": ["table", "centerpiece", "centrepiece"],
  minimal: ["minimal", "simple", "table", "centerpiece"],
};

// Words that mark a food item as non-vegetarian.
export const NON_VEG_WORDS = [
  "chicken", "mutton", "beef", "fish", "prawn", "shrimp", "meat", "kebab", "kabab",
  "lamb", "egg", "keema", "qeema", "nihari", "haleem", "steak", "tikka boti", "seekh",
];

const hasWord = (text, word) => new RegExp(`\\b${word}`, "i").test(text);

export const resolveProfile = (eventType = "") => {
  const entry = Object.entries(EVENT_PROFILES).find(([, profile]) =>
    profile.match.some((word) => hasWord(eventType, word))
  );
  return entry ? { key: entry[0], ...entry[1] } : { key: "other", ...DEFAULT_PROFILE };
};
