import { packagesApi } from "../../api/catalogApi.js";
import CatalogPage from "../../components/CatalogPage.jsx";

const PackagesPage = () => (
  <CatalogPage
    eyebrow="Curated bundles"
    title="Packages"
    lead="Ready-made bundles for common events. Pick one while booking, then customise anything you like."
    fetchFn={packagesApi.listActive}
    icon="gift"
    detailPath="/packages"
    emptyTitle="No packages available right now"
    priceNote="per event"
    getIncludes={(pkg) => pkg.includedItems}
  />
);

export default PackagesPage;
