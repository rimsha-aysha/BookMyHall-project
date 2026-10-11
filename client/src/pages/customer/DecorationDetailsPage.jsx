import { decorationsApi } from "../../api/catalogApi.js";
import CatalogDetail from "../../components/CatalogDetail.jsx";

const DecorationDetailsPage = () => (
  <CatalogDetail
    fetchById={decorationsApi.getActiveById}
    back={{ to: "/decorations", label: "All decorations" }}
    icon="sparkles"
    notFoundTitle="This decoration is not available"
  />
);

export default DecorationDetailsPage;
