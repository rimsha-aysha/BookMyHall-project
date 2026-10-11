import { packagesApi } from "../../api/catalogApi.js";
import CatalogDetail from "../../components/CatalogDetail.jsx";

const PackageDetailsPage = () => (
  <CatalogDetail
    fetchById={packagesApi.getActiveById}
    back={{ to: "/packages", label: "All packages" }}
    icon="gift"
    notFoundTitle="This package is not available"
    includesTitle="Included services"
    getIncludes={(pkg) => pkg.includedItems}
  />
);

export default PackageDetailsPage;
