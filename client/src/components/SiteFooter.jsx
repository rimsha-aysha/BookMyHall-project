import { Link } from "react-router-dom";
import { usePublicSettings } from "../hooks/usePublicSettings.js";
import Icon from "./Icon.jsx";

// Contact details and policies come from the Owner's System Settings.
const SiteFooter = () => {
  const { businessName, tagline, contactEmail, contactPhone, address, policyNotes } = usePublicSettings();
  const hasContact = address || contactPhone || contactEmail;

  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <div className="footer-brand">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden="true">
              {businessName.charAt(0)}
            </span>
            <span className="brand-name">{businessName}</span>
          </Link>
          {tagline && <p className="muted mt-8">{tagline}</p>}
        </div>

        <div className="footer-col footer-links">
          <h4>Explore</h4>
          <Link to="/halls">Halls</Link>
          <Link to="/packages">Packages</Link>
          <Link to="/food">Food</Link>
          <Link to="/gallery">Past events</Link>
        </div>

        <div className="footer-col">
          <h4>Contact</h4>
          {!hasContact && <p className="muted">Contact details coming soon.</p>}
          {address && (
            <p>
              <Icon name="pin" size={16} /> {address}
            </p>
          )}
          {contactPhone && (
            <p>
              <Icon name="phone" size={16} /> <a href={`tel:${contactPhone}`}>{contactPhone}</a>
            </p>
          )}
          {contactEmail && (
            <p>
              <Icon name="mail" size={16} /> <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            </p>
          )}
        </div>
      </div>
      <div className="container footer-bottom">
        {policyNotes && (
          <details>
            <summary>Booking policies</summary>
            <p className="muted mt-8" style={{ whiteSpace: "pre-line" }}>
              {policyNotes}
            </p>
          </details>
        )}
        <span>
          © {new Date().getFullYear()} {businessName}
        </span>
      </div>
    </footer>
  );
};

export default SiteFooter;
