import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { hallsApi } from "../api/catalogApi.js";
import { galleryApi } from "../api/galleryApi.js";
import HallCard from "../components/HallCard.jsx";
import GalleryCard from "../components/GalleryCard.jsx";
import Icon from "../components/Icon.jsx";
import { LoadingState } from "../components/States.jsx";
import { usePublicSettings } from "../hooks/usePublicSettings.js";
import { resolveImageUrl, formatRs } from "../utils/format.js";

const ROLE_HOME = {
  manager: { to: "/manager", label: "Go to dashboard" },
  coordinator: { to: "/coordinator", label: "Go to my events" },
  owner: { to: "/owner", label: "Go to dashboard" },
};

const STEPS = [
  { title: "Choose your hall", text: "Compare capacity, photos, amenities and pricing." },
  { title: "Check availability", text: "See open dates on a live calendar for each hall." },
  { title: "Customise & estimate", text: "Add a package, menu, décor and services — the estimate updates as you go." },
  { title: "Confirm & celebrate", text: "Our manager approves, you pay the advance, and a coordinator prepares everything." },
];

const EXPLORE = [
  { to: "/packages", icon: "gift", title: "Packages", text: "Curated bundles for common events." },
  { to: "/food", icon: "utensils", title: "Food", text: "Menus and dishes for every guest list." },
  { to: "/decorations", icon: "sparkles", title: "Decorations", text: "Themes, florals and stage setups." },
  { to: "/services", icon: "briefcase", title: "Services", text: "Photography, music, valet and more." },
];

const fetchRecentEvents = () => galleryApi.listPublished({ limit: 3 });

const Home = () => {
  const { user } = useAuth();
  const { data: halls, loading: hallsLoading } = useFetch(hallsApi.listActive);
  const { data: recentEvents } = useFetch(fetchRecentEvents);
  const { businessName, tagline } = usePublicSettings();
  const isCustomerOrGuest = !user || user.role === "customer";

  const featured = halls?.find((h) => h.images?.length) || halls?.[0];
  const largest = halls?.length ? Math.max(...halls.map((h) => h.capacity)) : null;
  const lowestPrice = halls?.length ? Math.min(...halls.map((h) => h.price)) : null;

  return (
    <div>
      <section className="hero">
        <div>
          <p className="eyebrow">Halls &amp; event venues</p>
          <h1>Celebrate in a space made for the occasion</h1>
          <p className="lead">
            {tagline && tagline !== "Hall & event booking for this restaurant." ? `${tagline} ` : ""}
            Find the right hall at {businessName}, check live availability, build your menu and décor, and see your
            estimate before you book.
          </p>
          <div className="hero-actions">
            {isCustomerOrGuest && (
              <Link to="/booking" className="button-link button-primary">
                Plan your event <Icon name="arrowRight" size={16} />
              </Link>
            )}
            {user && ROLE_HOME[user.role] && (
              <Link to={ROLE_HOME[user.role].to} className="button-link button-primary">
                {ROLE_HOME[user.role].label} <Icon name="arrowRight" size={16} />
              </Link>
            )}
            <Link to="/halls" className="button-link">
              Browse halls
            </Link>
          </div>
          {halls?.length > 0 && (
            <dl className="hero-facts">
              <div>
                <dt>{halls.length === 1 ? "Event hall" : "Event halls"}</dt>
                <dd>{halls.length}</dd>
              </div>
              <div>
                <dt>Guests in our largest hall</dt>
                <dd>{largest}</dd>
              </div>
              <div>
                <dt>Halls from</dt>
                <dd>{formatRs(lowestPrice)}</dd>
              </div>
            </dl>
          )}
          {!user && (
            <p className="muted small mt-8">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          )}
        </div>

        <div className="hero-media">
          {featured?.images?.[0] ? (
            <>
              <img src={resolveImageUrl(featured.images[0])} alt={featured.name} />
              <Link to={`/halls/${featured._id}`} className="hero-media-caption">
                <span>
                  <strong>{featured.name}</strong>
                  <br />
                  <span>Up to {featured.capacity} guests</span>
                </span>
                <Icon name="arrowRight" size={18} />
              </Link>
            </>
          ) : (
            <div className="hero-media-empty">
              <Icon name="building" size={48} />
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">How it works</p>
            <h2>From first look to the big day</h2>
          </div>
        </div>
        <ol className="steps">
          {STEPS.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Venues</p>
            <h2>Our halls</h2>
          </div>
          <Link to="/halls" className="see-all">
            View all halls <Icon name="arrowRight" size={16} />
          </Link>
        </div>
        {hallsLoading && <LoadingState count={3} />}
        {!hallsLoading && halls?.length > 0 && (
          <div className="card-grid">
            {halls.slice(0, 3).map((hall) => (
              <HallCard key={hall._id} hall={hall} />
            ))}
          </div>
        )}
        {!hallsLoading && !halls?.length && <p className="muted">No halls are currently available.</p>}
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Make it yours</p>
            <h2>Everything for your event</h2>
          </div>
        </div>
        <div className="explore-grid">
          {EXPLORE.map((tile) => (
            <Link key={tile.to} to={tile.to} className="explore-tile">
              <span className="item-icon" aria-hidden="true">
                <Icon name={tile.icon} size={20} />
              </span>
              <strong>{tile.title}</strong>
              <span>{tile.text}</span>
            </Link>
          ))}
        </div>
      </section>

      {recentEvents?.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Past events</p>
              <h2>Recently hosted</h2>
            </div>
            <Link to="/gallery" className="see-all">
              Full gallery <Icon name="arrowRight" size={16} />
            </Link>
          </div>
          <div className="card-grid">
            {recentEvents.map((entry) => (
              <GalleryCard key={entry._id} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {isCustomerOrGuest && (
        <section className="cta-band">
          <div>
            <h2>Ready to plan your event?</h2>
            <p>Pick a hall and date — your request goes to our team for approval before any payment.</p>
          </div>
          <Link to="/booking" className="button-link button-primary">
            Start planning
          </Link>
        </section>
      )}
    </div>
  );
};

export default Home;
