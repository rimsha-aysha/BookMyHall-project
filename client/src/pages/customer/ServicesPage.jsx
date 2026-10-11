import { servicesApi } from "../../api/catalogApi.js";
import CatalogPage from "../../components/CatalogPage.jsx";

const ServicesPage = () => (
  <CatalogPage
    eyebrow="Extras"
    title="Additional Services"
    lead="Photography, music, valet and other services you can add to any booking."
    fetchFn={servicesApi.listActive}
    icon="briefcase"
    emptyTitle="No additional services available right now"
  />
);

export default ServicesPage;
