import { loadSuggestionContext } from "./context.js";
import { ruleBasedProvider } from "./ruleBasedProvider.js";

// Smart Suggestions entry point.
//
// A provider is `{ name, version, suggest(input, context) }`. `context` is the
// live, active catalog from MongoDB (see context.js), and the provider returns
// scored halls/packages/foods/decorations/services plus a recommended plan.
//
// Only the rule-based provider ships today — it needs no API key and costs
// nothing to run. To plug in an LLM later, add a provider with the same
// contract (e.g. send `input` + a compact `context` to the model and ask for
// ids + reasons), register it below and set SUGGESTION_PROVIDER. Whatever a
// provider returns is passed through sanitizeResult, so it can only ever
// recommend items that really exist and are active; if it throws, we fall
// back to the rule-based provider.
const PROVIDERS = {
  [ruleBasedProvider.name]: ruleBasedProvider,
};

const DEFAULT_PROVIDER = ruleBasedProvider;

export const normalizeSuggestionInput = (body) => ({
  eventType: String(body.eventType || "").trim(),
  guestCount: Number(body.guestCount),
  budget: body.budget ? Number(body.budget) : null,
  foodPreference: ["veg", "non_veg"].includes(body.foodPreference) ? body.foodPreference : "any",
  decorationStyle: body.decorationStyle ? String(body.decorationStyle).toLowerCase() : "any",
  serviceInterests: Array.isArray(body.serviceInterests)
    ? body.serviceInterests.map((s) => String(s).toLowerCase())
    : [],
  requirements: String(body.requirements || "").slice(0, 500),
  eventDate: body.eventDate || null,
  startTime: body.startTime || null,
  endTime: body.endTime || null,
});

// Small, client-friendly shapes — only the fields the UI needs.
const SHAPERS = {
  halls: (h) => ({
    _id: h._id,
    name: h.name,
    capacity: h.capacity,
    price: h.price,
    amenities: h.amenities || [],
    image: (h.images || [])[0] || h.image || null,
  }),
  packages: (p) => ({ _id: p._id, name: p.name, price: p.price, includedItems: p.includedItems || [] }),
  foods: (f) => ({ _id: f._id, name: f.name, price: f.price, category: f.category }),
  decorations: (d) => ({ _id: d._id, name: d.name, price: d.price, category: d.category }),
  services: (s) => ({ _id: s._id, name: s.name, price: s.price, category: s.category }),
};

const sanitizeResult = (result, context) => {
  const valid = Object.fromEntries(
    Object.keys(SHAPERS).map((kind) => [kind, new Map(context[kind].map((doc) => [doc._id.toString(), doc]))])
  );

  const suggestions = {};
  Object.keys(SHAPERS).forEach((kind) => {
    suggestions[kind] = (result[kind] || [])
      .filter((s) => s?.item && valid[kind].has(s.item._id.toString()))
      .map((s) => ({
        item: SHAPERS[kind](valid[kind].get(s.item._id.toString())),
        score: s.score,
        reasons: s.reasons || [],
        warnings: s.warnings || [],
        ...(s.available !== undefined && { available: s.available }),
        ...(s.course && { course: s.course }),
      }));
  });

  const keep = (kind, id) => (id && valid[kind].has(String(id)) ? String(id) : null);
  const keepAll = (kind, ids) => (ids || []).map((id) => keep(kind, id)).filter(Boolean);
  const plan = result.plan || {};

  return {
    profile: result.profile,
    budgetTier: result.budgetTier,
    summary: result.summary,
    insights: result.insights || [],
    plan: {
      hall: keep("halls", plan.hall),
      package: keep("packages", plan.package),
      food: keepAll("foods", plan.food),
      decorations: keepAll("decorations", plan.decorations),
      services: keepAll("services", plan.services),
      estimatedCost: plan.estimatedCost,
      budget: plan.budget,
      withinBudget: plan.withinBudget,
      adjustments: plan.adjustments || [],
    },
    suggestions,
  };
};

export const getSuggestions = async (rawInput) => {
  const input = normalizeSuggestionInput(rawInput);
  const context = await loadSuggestionContext(input);

  const provider = PROVIDERS[process.env.SUGGESTION_PROVIDER] || DEFAULT_PROVIDER;
  let result;
  let usedProvider = provider;
  try {
    result = await provider.suggest(input, context);
  } catch (error) {
    if (provider === DEFAULT_PROVIDER) throw error;
    console.error(`Suggestion provider "${provider.name}" failed, falling back:`, error.message);
    usedProvider = DEFAULT_PROVIDER;
    result = await DEFAULT_PROVIDER.suggest(input, context);
  }

  return {
    engine: { provider: usedProvider.name, version: usedProvider.version },
    input,
    ...sanitizeResult(result, context),
  };
};
