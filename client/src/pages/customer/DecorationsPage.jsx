import { decorationsApi } from "../../api/catalogApi.js";
import CatalogPage from "../../components/CatalogPage.jsx";

const DecorationsPage = () => (
  <CatalogPage
    eyebrow="Styling"
    title="Decorations"
    lead="Themes, florals, lighting and stage setups to make the hall your own."
    fetchFn={decorationsApi.listActive}
    icon="sparkles"
    detailPath="/decorations"
    emptyTitle="No decoration options available right now"
  />
);

export default DecorationsPage;
