import {
  EVENT_PROFILES,
  SERVICE_INTERESTS,
  DECORATION_STYLES,
  NON_VEG_WORDS,
  resolveProfile,
} from "./eventProfiles.js";

// Deterministic, explainable recommendation engine over the live catalog.
// Every suggestion carries a 0-100 match score plus human-readable reasons,
// and the assembled plan is priced with the same formula createBooking uses
// (hall + package + each selected item's price), so the number shown here
// is the number the booking will be created with.

// "Wedding" -> "weddings", "Corporate Event" -> "corporate events"
const plural = (profile) => `${profile.label.toLowerCase()}s`;
const singular = (profile) => profile.label.toLowerCase();

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));
const formatRs = (n) => `Rs. ${Math.round(n).toLocaleString("en-US")}`;
const textOf = (...parts) => parts.flat().filter(Boolean).join(" ").toLowerCase();
const countMatches = (text, words) => words.filter((w) => text.includes(w)).length;
const sumPrices = (items) => items.reduce((sum, item) => sum + (item?.price || 0), 0);
const idOf = (doc) => doc._id.toString();

const isNonVeg = (food) => countMatches(textOf(food.name, food.description), NON_VEG_WORDS) > 0;

// Spend level, from budget per guest — decides how generous the plan is
// (number of decorations/services/dishes and whether to lean premium).
const budgetTier = ({ budget, guestCount }) => {
  if (!budget) return "standard";
  const perGuest = budget / guestCount;
  if (perGuest < 600) return "economy";
  if (perGuest < 2000) return "standard";
  return "premium";
};

const TIER_LIMITS = {
  economy: { decorations: 1, services: 1 },
  standard: { decorations: 2, services: 2 },
  premium: { decorations: 3, services: 3 },
};

// Words from the other event profiles, used to spot items clearly meant for
// a different kind of event (e.g. a "Corporate" package for a wedding).
const otherProfileWords = (profileKey) =>
  Object.entries(EVENT_PROFILES)
    .filter(([key]) => key !== profileKey)
    .flatMap(([, p]) => p.match);

const requirementWords = (requirements) =>
  (requirements || "")
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((w) => w.length > 3);

// ---------------------------------------------------------------- halls

const scoreHall = (hall, input, profile, ctx) => {
  const reasons = [];
  const warnings = [];
  let score = 0;

  const utilization = input.guestCount / hall.capacity;
  if (utilization > 1) {
    return null; // never suggest a hall that can't hold the guests
  }
  if (utilization >= 0.6) {
    score += 30;
    reasons.push(`Comfortable fit: ${input.guestCount} guests fill ${Math.round(utilization * 100)}% of its ${hall.capacity} capacity`);
  } else if (utilization >= 0.4) {
    score += 25;
    reasons.push(`Spacious for ${input.guestCount} guests (capacity ${hall.capacity})`);
  } else if (utilization >= 0.25) {
    score += 18;
    reasons.push(`Plenty of room for ${input.guestCount} guests (capacity ${hall.capacity})`);
  } else {
    score += 6;
    warnings.push(`Much larger than needed (capacity ${hall.capacity}) — may feel empty`);
  }

  const hallText = textOf(hall.name, hall.description, hall.amenities);
  const eventMatches = countMatches(hallText, profile.keywords);
  if (eventMatches > 0) {
    score += Math.min(25, eventMatches * 9);
    reasons.push(`Described as suited to ${plural(profile)}`);
  } else if (profile.key !== "other") {
    const otherEvent = Object.values(EVENT_PROFILES).find(
      (p) => p.label !== profile.label && countMatches(hallText, p.match) > 0
    );
    if (otherEvent) {
      score -= 20;
      warnings.push(`Set up mainly for ${plural(otherEvent)}`);
    }
  }
  const reqMatches = countMatches(hallText, requirementWords(input.requirements));
  if (reqMatches > 0) {
    score += Math.min(10, reqMatches * 5);
    reasons.push("Matches your special requirements");
  }

  if (input.budget) {
    const share = hall.price / input.budget;
    if (hall.price > input.budget) {
      score -= 25;
      warnings.push(`Hall price ${formatRs(hall.price)} alone exceeds your budget`);
    } else if (share <= 0.35) {
      score += 25;
      reasons.push(`Leaves most of your budget for food & décor (${formatRs(hall.price)})`);
    } else if (share <= 0.55) {
      score += 16;
      reasons.push(`Fits your budget (${formatRs(hall.price)})`);
    } else {
      score += 5;
      warnings.push(`Takes ${Math.round(share * 100)}% of your budget`);
    }
  } else {
    score += 12;
  }

  const hallId = idOf(hall);
  const hostedBefore =
    ctx.history.pastBookings.filter(
      (b) => b.hall?.toString() === hallId && resolveProfile(b.eventType).key === profile.key
    ).length +
    ctx.history.galleryEntries.filter(
      (g) => g.hall?.toString() === hallId && resolveProfile(g.eventType).key === profile.key
    ).length;
  if (hostedBefore > 0 && profile.key !== "other") {
    score += Math.min(15, hostedBefore * 5);
    reasons.push(`Has hosted ${hostedBefore} previous ${hostedBefore > 1 ? plural(profile) : singular(profile)}`);
  }

  let available = null;
  if (ctx.unavailableHallIds) {
    available = !ctx.unavailableHallIds.has(hallId);
    if (available) {
      reasons.push("Available for your selected date & time");
    } else {
      score -= 40;
      warnings.push("Already booked for your selected date & time");
    }
  }

  return { item: hall, score: clamp(score), reasons, warnings, available };
};

// ------------------------------------------------------------- packages

const GUEST_LIMIT_PATTERN = /up to (\d+) guests/i;

const scorePackage = (pkg, input, profile, budgetLeft) => {
  const reasons = [];
  const warnings = [];
  let score = 30;

  const name = pkg.name.toLowerCase();
  const fullText = textOf(pkg.name, pkg.description, pkg.includedItems);

  if (profile.match.some((w) => name.includes(w))) {
    score += 40;
    reasons.push(`Designed for ${plural(profile)}`);
  } else if (otherProfileWords(profile.key).some((w) => name.includes(w))) {
    score -= 45;
    warnings.push("Designed for a different type of event");
  } else {
    const matches = countMatches(fullText, profile.keywords);
    if (matches) {
      score += Math.min(20, matches * 7);
      reasons.push(`Includes items that suit a ${singular(profile)}`);
    }
  }

  const limitText = (pkg.includedItems || []).find((i) => GUEST_LIMIT_PATTERN.test(i));
  if (limitText) {
    const limit = Number(limitText.match(GUEST_LIMIT_PATTERN)[1]);
    if (input.guestCount > limit) {
      score -= 20;
      warnings.push(`Some inclusions only cover up to ${limit} guests`);
    } else {
      reasons.push(`Inclusions cover your ${input.guestCount} guests`);
    }
  }

  if (input.budget) {
    if (pkg.price > budgetLeft) {
      score -= 30;
      warnings.push(`${formatRs(pkg.price)} is more than your remaining budget after the hall`);
    } else if (pkg.price <= budgetLeft * 0.6) {
      score += 15;
      reasons.push(`Affordable within your budget (${formatRs(pkg.price)})`);
    } else {
      score += 5;
      reasons.push(`Within your remaining budget (${formatRs(pkg.price)})`);
    }
  }

  if (pkg.includedItems?.length) {
    reasons.push(`${pkg.includedItems.length} inclusions, e.g. ${pkg.includedItems.slice(0, 2).join(", ")}`);
  }

  return { item: pkg, score: clamp(score), reasons, warnings };
};

// ----------------------------------------------------------------- food

const scoreFood = (food, input, profile, tier) => {
  const reasons = [];
  let score = 40;
  const nonVeg = isNonVeg(food);

  if (input.foodPreference === "veg") {
    if (nonVeg) return null;
    score += 15;
    reasons.push("Vegetarian");
  } else if (input.foodPreference === "non_veg" && nonVeg) {
    score += 20;
    reasons.push("Non-vegetarian favourite");
  }

  const text = textOf(food.name, food.description);
  const reqMatches = countMatches(text, requirementWords(input.requirements));
  if (reqMatches) {
    score += 20;
    reasons.push("Matches your special requirements");
  }
  if (countMatches(text, profile.keywords)) score += 5;

  return { item: food, score: clamp(score), reasons, warnings: [], nonVeg, tier };
};

// Builds a balanced menu: N dishes per course (from the event profile),
// leaning towards pricier dishes for premium budgets and cheaper for economy.
const buildMenu = (foods, input, profile, tier) => {
  const scored = foods.map((f) => scoreFood(f, input, profile, tier)).filter(Boolean);
  const byCategory = new Map();
  scored.forEach((s) => {
    const key = (s.item.category || "Other").toLowerCase();
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(s);
  });

  const pricePreference = (a, b) => {
    if (tier === "premium") return b.item.price - a.item.price;
    if (tier === "economy") return a.item.price - b.item.price;
    return 0;
  };

  const menu = [];
  Object.entries(profile.courses).forEach(([course, baseCount]) => {
    const options = byCategory.get(course.toLowerCase()) || [];
    const count = Math.min(options.length, baseCount + (tier === "premium" && course === "Main Course" ? 1 : 0));
    options
      .sort((a, b) => b.score - a.score || pricePreference(a, b))
      .slice(0, Math.max(0, count))
      .forEach((s) => menu.push({ ...s, course, reasons: [`${course}`, ...s.reasons] }));
  });

  // Catalogs without standard course categories: fall back to top-scored items.
  if (menu.length === 0) {
    scored.sort((a, b) => b.score - a.score).slice(0, 4).forEach((s) => menu.push(s));
  }
  return { menu, allScored: scored };
};

// ---------------------------------------------------------- decorations

const scoreDecoration = (deco, input, profile) => {
  const reasons = [];
  const warnings = [];
  let score = 20;
  const text = textOf(deco.name, deco.description, deco.category);

  if (input.decorationStyle && input.decorationStyle !== "any") {
    const words = DECORATION_STYLES[input.decorationStyle] || [input.decorationStyle];
    if (countMatches(text, words)) {
      score += 45;
      reasons.push(`Matches your ${input.decorationStyle} style preference`);
    }
  }

  const styleMatch = profile.decorStyles.find((style) =>
    countMatches(text, DECORATION_STYLES[style] || [style])
  );
  if (styleMatch) {
    score += 25;
    reasons.push(`${styleMatch[0].toUpperCase()}${styleMatch.slice(1)} décor is popular for ${plural(profile)}`);
  }

  const keywordMatches = countMatches(text, profile.keywords);
  if (keywordMatches) {
    score += Math.min(15, keywordMatches * 8);
    if (!styleMatch) reasons.push(`Suits a ${singular(profile)}`);
  }

  if (countMatches(text, otherProfileWords(profile.key)) && !keywordMatches) {
    score -= 30;
    warnings.push("Better suited to a different type of event");
  }

  if (countMatches(text, requirementWords(input.requirements))) {
    score += 15;
    reasons.push("Matches your special requirements");
  }

  return { item: deco, score: clamp(score), reasons, warnings };
};

// ------------------------------------------------------------- services

const scoreService = (service, input, profile) => {
  const reasons = [];
  let score = 10;
  const text = textOf(service.name, service.description, service.category);

  const requested = input.serviceInterests.filter((interest) =>
    countMatches(text, SERVICE_INTERESTS[interest] || [interest])
  );
  if (requested.length) {
    score += 55;
    reasons.push("You asked for this");
  }

  const recommended = profile.services.filter((interest) =>
    countMatches(text, SERVICE_INTERESTS[interest] || [interest])
  );
  if (recommended.length) {
    score += 25;
    reasons.push(`Commonly booked for ${plural(profile)}`);
  }

  if (input.guestCount >= 200 && countMatches(text, SERVICE_INTERESTS.valet)) {
    score += 20;
    reasons.push(`Helps manage parking for ${input.guestCount} guests`);
  }
  if (input.guestCount >= 300 && countMatches(text, SERVICE_INTERESTS.security)) {
    score += 20;
    reasons.push(`Recommended crowd control for ${input.guestCount}+ guests`);
  }

  if (countMatches(text, requirementWords(input.requirements))) {
    score += 15;
    reasons.push("Matches your special requirements");
  }

  return { item: service, score: clamp(score), reasons, warnings: [], requested: requested.length > 0 };
};

// ----------------------------------------------------------- plan + budget

const priceOfPlan = (plan) =>
  (plan.hall?.price || 0) +
  (plan.package?.price || 0) +
  sumPrices(plan.food) +
  sumPrices(plan.decorations) +
  sumPrices(plan.services);

// If the plan is over budget: remove optional extras (package, décor,
// services the customer didn't explicitly ask for) lowest-scored first until
// it fits, then refill — highest-scored first — with anything that still
// fits, including a cheaper well-matched package. Hall and menu are kept.
const fitPlanToBudget = (plan, scoredRefs, budget, packageOptions) => {
  if (!budget || priceOfPlan(plan) <= budget) return { plan, adjustments: [] };

  const scoreOf = (kind, item) => scoredRefs[kind].get(idOf(item))?.score || 0;
  const candidates = [
    ...plan.services
      .filter((s) => !scoredRefs.services.get(idOf(s))?.requested)
      .map((s) => ({ kind: "services", item: s, score: scoreOf("services", s) })),
    ...plan.decorations.map((d) => ({ kind: "decorations", item: d, score: scoreOf("decorations", d) })),
    ...(plan.package ? [{ kind: "package", item: plan.package, score: scoreOf("packages", plan.package) }] : []),
  ].sort((a, b) => a.score - b.score || b.item.price - a.item.price);

  const removed = [];
  while (priceOfPlan(plan) > budget && candidates.length) {
    const c = candidates.shift();
    if (c.kind === "package") plan.package = null;
    else plan[c.kind] = plan[c.kind].filter((x) => idOf(x) !== idOf(c.item));
    removed.push(c);
  }

  // Refill: removed items first (best first), then a cheaper matching package.
  const refill = [...removed].sort((a, b) => b.score - a.score);
  if (!plan.package) {
    packageOptions
      .filter((p) => p.score >= 55)
      .forEach((p) => refill.push({ kind: "package", item: p.item, score: p.score, alternative: true }));
  }
  const readded = new Set();
  refill.forEach((c) => {
    if (c.kind === "package" && plan.package) return;
    if (priceOfPlan(plan) + c.item.price > budget) return;
    if (c.kind === "package") plan.package = c.item;
    else plan[c.kind] = [...plan[c.kind], c.item];
    readded.add(idOf(c.item));
  });

  const adjustments = removed
    .filter((c) => !readded.has(idOf(c.item)))
    .map((c) => `Left out ${c.item.name} to stay within budget`);
  if (plan.package && !removed.every((c) => c.kind !== "package" || readded.has(idOf(c.item)))) {
    adjustments.push(`Switched to ${plan.package.name} to stay within budget`);
  }

  return { plan, adjustments };
};

// ------------------------------------------------------------ provider

const suggest = (input, ctx) => {
  const profile = resolveProfile(input.eventType);
  const tier = budgetTier(input);
  const limits = TIER_LIMITS[tier];

  // Halls
  const scoredHalls = ctx.halls.map((h) => scoreHall(h, input, profile, ctx));
  const tooSmall = ctx.halls.filter((h, i) => scoredHalls[i] === null);
  const hallOptions = scoredHalls.filter(Boolean).sort((a, b) => b.score - a.score || a.item.price - b.item.price);
  const bestHall = hallOptions.find((h) => h.available !== false) || null;

  // Packages — budget left after the recommended hall
  const budgetLeftAfterHall = input.budget ? input.budget - (bestHall?.item.price || 0) : Infinity;
  const packageOptions = ctx.packages
    .map((p) => scorePackage(p, input, profile, budgetLeftAfterHall))
    .sort((a, b) => b.score - a.score);
  const bestPackage = packageOptions[0]?.score >= 55 ? packageOptions[0] : null;

  // Food, décor, services
  const { menu, allScored: foodScored } = buildMenu(ctx.foods, input, profile, tier);
  const decorationOptions = ctx.decorations
    .map((d) => scoreDecoration(d, input, profile))
    .sort((a, b) => b.score - a.score);
  const serviceOptions = ctx.services
    .map((s) => scoreService(s, input, profile))
    .sort((a, b) => b.score - a.score);

  const pickedDecorations = decorationOptions.filter((d) => d.score >= 45).slice(0, limits.decorations);
  const requestedServices = serviceOptions.filter((s) => s.requested);
  const pickedServices = [
    ...requestedServices,
    ...serviceOptions.filter((s) => !s.requested && s.score >= 35).slice(0, Math.max(0, limits.services - requestedServices.length)),
  ];

  const refs = {
    services: new Map(serviceOptions.map((s) => [idOf(s.item), s])),
    decorations: new Map(decorationOptions.map((d) => [idOf(d.item), d])),
    packages: new Map(packageOptions.map((p) => [idOf(p.item), p])),
  };

  const { plan, adjustments } = fitPlanToBudget(
    {
      hall: bestHall?.item || null,
      package: bestPackage?.item || null,
      food: menu.map((m) => m.item),
      decorations: pickedDecorations.map((d) => d.item),
      services: pickedServices.map((s) => s.item),
    },
    refs,
    input.budget,
    packageOptions
  );

  const estimatedCost = priceOfPlan(plan);
  const withinBudget = input.budget ? estimatedCost <= input.budget : null;

  // Insights — short, data-driven observations for the customer.
  const insights = [];
  if (tooSmall.length) {
    insights.push(
      `${tooSmall.length} hall${tooSmall.length > 1 ? "s were" : " was"} left out because ${tooSmall.length > 1 ? "they hold" : "it holds"} fewer than ${input.guestCount} guests (${tooSmall.map((h) => h.name).join(", ")}).`
    );
  }
  if (!hallOptions.length) {
    const biggest = Math.max(0, ...ctx.halls.map((h) => h.capacity));
    insights.push(`No hall can hold ${input.guestCount} guests — our largest hall seats ${biggest}.`);
  } else if (!bestHall) {
    insights.push("Every hall that fits your guests is already booked for that slot — try another date or time.");
  }
  if (input.budget) {
    insights.push(`Your budget works out to about ${formatRs(input.budget / input.guestCount)} per guest (${tier} range).`);
    if (withinBudget === false) {
      insights.push(`Even the leanest suitable plan is ${formatRs(estimatedCost - input.budget)} over budget — consider fewer guests or a smaller hall.`);
    } else if (withinBudget) {
      insights.push(`The suggested plan leaves ${formatRs(input.budget - estimatedCost)} of your budget unspent for extras.`);
    }
  }
  if (input.foodPreference === "veg") {
    const removed = ctx.foods.length - foodScored.length;
    if (removed) insights.push(`${removed} non-vegetarian dish${removed > 1 ? "es were" : " was"} excluded from the menu.`);
  }
  if (!ctx.unavailableHallIds) {
    insights.push("Add a date and time to also check which halls are free for your slot.");
  }

  const summaryParts = [];
  if (plan.hall) summaryParts.push(`${plan.hall.name}`);
  if (plan.package) summaryParts.push(`the ${plan.package.name}`);
  const summary = plan.hall
    ? `For a ${profile.key === "other" ? input.eventType.toLowerCase() : singular(profile)} of ${input.guestCount} guests${input.budget ? ` on a ${formatRs(input.budget)} budget` : ""}, we suggest ${summaryParts.join(" with ")}, a menu of ${plan.food.length} dishes, ${plan.decorations.length} décor item${plan.decorations.length === 1 ? "" : "s"} and ${plan.services.length} service${plan.services.length === 1 ? "" : "s"} — about ${formatRs(estimatedCost)} in total.`
    : "We couldn't find a hall that fits these requirements. See the notes below.";

  return {
    profile: { key: profile.key, label: profile.label },
    budgetTier: tier,
    summary,
    plan: {
      hall: plan.hall ? idOf(plan.hall) : null,
      package: plan.package ? idOf(plan.package) : null,
      food: plan.food.map(idOf),
      decorations: plan.decorations.map(idOf),
      services: plan.services.map(idOf),
      estimatedCost,
      budget: input.budget || null,
      withinBudget,
      adjustments,
    },
    halls: hallOptions.slice(0, 3),
    packages: packageOptions.filter((p) => p.score >= 40).slice(0, 3),
    foods: menu,
    decorations: decorationOptions.filter((d) => d.score >= 40).slice(0, 4),
    services: serviceOptions.filter((s) => s.score >= 35).slice(0, 4),
    insights,
  };
};

export const ruleBasedProvider = {
  name: "rule-based",
  version: "1.0",
  suggest,
};
