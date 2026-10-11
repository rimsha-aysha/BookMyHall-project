import { Link } from "react-router-dom";
import { EmptyState } from "../components/States.jsx";

const NotFound = () => {
  return (
    <div>
      <EmptyState icon="alert" title="Page not found" message="The page you're looking for doesn't exist or has moved.">
        <Link to="/" className="button-link button-primary">
          Go home
        </Link>
        <Link to="/halls" className="button-link">
          Browse halls
        </Link>
      </EmptyState>
    </div>
  );
};

export default NotFound;
