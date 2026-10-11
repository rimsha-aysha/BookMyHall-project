import { useState } from "react";
import { suggestionApi } from "../api/suggestionApi.js";
import { resolveImageUrl, formatRs, apiError } from "../utils/format.js";

const FOOD_PREFERENCES = [
  { value: "any", label: "No preference" },
  { value: "veg", label: "Vegetarian only" },
  { value: "non_veg", label: "Non-veg focused" },
];

const DECORATION_STYLES = [
  { value: "any", label: "Surprise me" },
  { value: "floral", label: "Floral" },
  { value: "lighting", label: "Lights & glow" },
  { value: "traditional", label: "Traditional" },
  { value: "themed", label: "Themed / kids" },
  { value: "balloons", label: "Balloons" },
  { value: "minimal", label: "Minimal & elegant" },
];

const SERVICE_INTERESTS = [
  { value: "photography", label: "Photography" },
  { value: "videography", label: "Videography" },
  { value: "music", label: "Music / DJ" },
  { value: "valet", label: "Valet parking" },
  { value: "security", label: "Security" },
];

const ScoreMeter = ({ score }) => (
  <span className="score" title={`${score}% match`}>
    <span className="score-bar">
      <span style={{ width: `${score}%` }} />
    </span>
    {score}% match
  </span>
);

const Reasons = ({ reasons, warnings }) => (
  <ul className="reasons">
    {reasons.map((r) => (
      <li key={r}>✓ {r}</li>
    ))}
    {warnings.map((w) => (
      <li key={w} className="warn">
        ⚠ {w}
      </li>
    ))}
  </ul>
);

const SuggestionRow = ({ suggestion, selected, onToggle, actionLabel = ["Add", "Added"], showImage }) => (
  <div className={`suggestion ${selected ? "selected" : ""}`}>
    {showImage && (
      <div className="suggestion-thumb">
        {suggestion.item.image ? <img src={resolveImageUrl(suggestion.item.image)} alt="" loading="lazy" /> : null}
      </div>
    )}
    <div className="suggestion-body">
      <div className="suggestion-head">
        <strong>{suggestion.item.name}</strong>
        <span className="price">{formatRs(suggestion.item.price)}</span>
      </div>
      <div className="suggestion-sub">
        <ScoreMeter score={suggestion.score} />
        {suggestion.item.capacity && <span className="muted small">Up to {suggestion.item.capacity} guests</span>}
        {suggestion.available === true && <span className="badge badge-success">Free on your date</span>}
        {suggestion.available === false && <span className="badge badge-danger">Booked on your date</span>}
      </div>
      <Reasons reasons={suggestion.reasons} warnings={suggestion.warnings} />
    </div>
    <button
      type="button"
      className={`suggestion-action ${selected ? "is-selected" : ""}`}
      onClick={onToggle}
      disabled={suggestion.available === false && !selected}
    >
      {selected ? `✓ ${actionLabel[1]}` : actionLabel[0]}
    </button>
  </div>
);

// Collects preferences, asks the server's recommendation engine (which scores
// the live catalog — see server/src/services/suggestions) and lets the
// customer apply the whole plan or pick individual suggestions into the form.
const SmartSuggestions = ({ eventDetails, requirements, selection, onApplyPlan, onSelect }) => {
  const [prefs, setPrefs] = useState({
    budget: "",
    foodPreference: "any",
    decorationStyle: "any",
    serviceInterests: [],
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);

  const missing = [];
  if (!eventDetails.eventType) missing.push("event type");
  if (!eventDetails.guestCount || Number(eventDetails.guestCount) < 1) missing.push("guest count");

  const toggleInterest = (value) =>
    setPrefs((p) => ({
      ...p,
      serviceInterests: p.serviceInterests.includes(value)
        ? p.serviceInterests.filter((v) => v !== value)
        : [...p.serviceInterests, value],
    }));

  const handleSuggest = async () => {
    setError("");
    setLoading(true);
    setApplied(false);
    try {
      const hasSlot = eventDetails.eventDate && eventDetails.startTime && eventDetails.endTime && eventDetails.endTime > eventDetails.startTime;
      const res = await suggestionApi.get({
        eventType: eventDetails.eventType,
        guestCount: Number(eventDetails.guestCount),
        budget: prefs.budget ? Number(prefs.budget) : undefined,
        foodPreference: prefs.foodPreference,
        decorationStyle: prefs.decorationStyle,
        serviceInterests: prefs.serviceInterests,
        requirements,
        ...(hasSlot && {
          eventDate: eventDetails.eventDate,
          startTime: eventDetails.startTime,
          endTime: eventDetails.endTime,
        }),
      });
      setResult(res.data.data);
    } catch (err) {
      setError(apiError(err, "Could not get suggestions right now"));
    } finally {
      setLoading(false);
    }
  };

  const s = result?.suggestions;
  const plan = result?.plan;
  const menuByCourse = (s?.foods || []).reduce((acc, f) => {
    const course = f.course || f.item.category || "Other";
    (acc[course] = acc[course] || []).push(f);
    return acc;
  }, {});

  return (
    <section className="smart-panel" aria-labelledby="smart-title">
      <div className="smart-head">
        <div>
          <h2 id="smart-title">Smart suggestions</h2>
          <p className="muted">
            Tell us your budget and taste — we'll match halls, packages, food, décor and services from our live catalog
            to your {eventDetails.guestCount ? `${eventDetails.guestCount} guests` : "guest count"}.
          </p>
        </div>
      </div>

      <div className="smart-inputs">
        <div>
          <label htmlFor="s-budget">Approximate budget (Rs.)</label>
          <input
            id="s-budget"
            type="number"
            min="1"
            step="any"
            placeholder="e.g. 300000"
            value={prefs.budget}
            onChange={(e) => setPrefs({ ...prefs, budget: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="s-food">Food preference</label>
          <select id="s-food" value={prefs.foodPreference} onChange={(e) => setPrefs({ ...prefs, foodPreference: e.target.value })}>
            {FOOD_PREFERENCES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="s-decor">Decoration style</label>
          <select
            id="s-decor"
            value={prefs.decorationStyle}
            onChange={(e) => setPrefs({ ...prefs, decorationStyle: e.target.value })}
          >
            {DECORATION_STYLES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="smart-inputs-wide">
          <span className="field-label">Services you'd like</span>
          <div className="chip-filter" role="group" aria-label="Services you'd like">
            {SERVICE_INTERESTS.map((o) => (
              <button
                type="button"
                key={o.value}
                className={prefs.serviceInterests.includes(o.value) ? "active" : ""}
                aria-pressed={prefs.serviceInterests.includes(o.value)}
                onClick={() => toggleInterest(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {requirements?.trim() && (
        <p className="muted small">Your special requirements above are taken into account too.</p>
      )}

      <div className="smart-actions">
        <button type="button" className="button-primary" onClick={handleSuggest} disabled={loading || missing.length > 0}>
          {loading ? "Analysing options…" : result ? "Refresh suggestions" : "Get smart suggestions"}
        </button>
        {missing.length > 0 && <span className="muted small">Enter the {missing.join(" and ")} above first.</span>}
      </div>

      {error && <p role="alert">{error}</p>}

      {loading && (
        <div className="smart-loading" aria-live="polite">
          <span className="spinner" /> Scoring halls by capacity, budget and availability, then building a menu…
        </div>
      )}

      {result && !loading && (
        <div className="smart-results" aria-live="polite">
          <div className="plan-card">
            <div className="plan-card-text">
              <span className="badge badge-accent">Recommended plan</span>
              <p className="plan-summary">{result.summary}</p>
              {plan.budget && (
                <p className={plan.withinBudget ? "success-text" : "danger-text"}>
                  {plan.withinBudget
                    ? `✓ Within your ${formatRs(plan.budget)} budget`
                    : `⚠ About ${formatRs(plan.estimatedCost - plan.budget)} over your ${formatRs(plan.budget)} budget`}
                </p>
              )}
              {plan.adjustments.length > 0 && (
                <details className="muted small">
                  <summary>Budget adjustments ({plan.adjustments.length})</summary>
                  <ul className="reasons">
                    {plan.adjustments.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <div className="plan-card-action">
              <span className="plan-total">{formatRs(plan.estimatedCost)}</span>
              <button
                type="button"
                className="button-primary"
                disabled={!plan.hall}
                onClick={() => {
                  onApplyPlan(plan);
                  setApplied(true);
                }}
              >
                {applied ? "✓ Plan applied" : "Apply this plan"}
              </button>
              <span className="muted small">You can still change anything below.</span>
            </div>
          </div>

          {result.insights.length > 0 && (
            <ul className="insights">
              {result.insights.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}

          <div className="suggestion-groups">
            <div className="suggestion-group">
              <h3>Halls</h3>
              {s.halls.length === 0 && <p className="muted">No hall fits this guest count.</p>}
              {s.halls.map((h) => (
                <SuggestionRow
                  key={h.item._id}
                  suggestion={h}
                  showImage
                  selected={selection.hall === h.item._id}
                  actionLabel={["Select", "Selected"]}
                  onToggle={() => onSelect("hall", h.item._id)}
                />
              ))}
            </div>

            <div className="suggestion-group">
              <h3>Packages</h3>
              {s.packages.length === 0 && <p className="muted">No package is a good match — customise à la carte below.</p>}
              {s.packages.map((p) => (
                <SuggestionRow
                  key={p.item._id}
                  suggestion={p}
                  selected={selection.package === p.item._id}
                  actionLabel={["Choose", "Chosen"]}
                  onToggle={() => onSelect("package", p.item._id)}
                />
              ))}
            </div>

            <div className="suggestion-group">
              <h3>Suggested menu</h3>
              {Object.entries(menuByCourse).map(([course, items]) => (
                <div key={course}>
                  <p className="course-label">{course}</p>
                  {items.map((f) => (
                    <SuggestionRow
                      key={f.item._id}
                      suggestion={{ ...f, reasons: f.reasons.filter((r) => r !== course) }}
                      selected={selection.food.includes(f.item._id)}
                      onToggle={() => onSelect("food", f.item._id)}
                    />
                  ))}
                </div>
              ))}
            </div>

            <div className="suggestion-group">
              <h3>Decorations</h3>
              {s.decorations.length === 0 && <p className="muted">No strong décor match.</p>}
              {s.decorations.map((d) => (
                <SuggestionRow
                  key={d.item._id}
                  suggestion={d}
                  selected={selection.decorations.includes(d.item._id)}
                  onToggle={() => onSelect("decorations", d.item._id)}
                />
              ))}
            </div>

            <div className="suggestion-group">
              <h3>Additional services</h3>
              {s.services.length === 0 && <p className="muted">No services stand out for this event.</p>}
              {s.services.map((sv) => (
                <SuggestionRow
                  key={sv.item._id}
                  suggestion={sv}
                  selected={selection.services.includes(sv.item._id)}
                  onToggle={() => onSelect("services", sv.item._id)}
                />
              ))}
            </div>
          </div>

          <p className="muted small engine-note">
            Suggestions by the BookMyHall smart engine ({result.engine.provider} v{result.engine.version}) using live
            hall, menu and booking data.
          </p>
        </div>
      )}
    </section>
  );
};

export default SmartSuggestions;
