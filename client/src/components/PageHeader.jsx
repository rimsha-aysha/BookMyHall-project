import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";

// Consistent page title block: optional back link and eyebrow, title, lead
// text, and right-aligned actions.
const PageHeader = ({ title, lead, eyebrow, back, actions, children }) => (
  <header className="page-head">
    {back && (
      <Link to={back.to} className="breadcrumb">
        <Icon name="arrowLeft" size={16} /> {back.label}
      </Link>
    )}
    <div className="page-head-row">
      <div className="page-head-text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
        {children}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </div>
  </header>
);

export default PageHeader;
