import { foodsApi } from "../../api/catalogApi.js";
import CatalogPage from "../../components/CatalogPage.jsx";

const FoodPage = () => (
  <CatalogPage
    eyebrow="Menu"
    title="Food"
    lead="Dishes and menus for your guests. Add any of them to your booking and the estimate updates instantly."
    fetchFn={foodsApi.listActive}
    icon="utensils"
    detailPath="/food"
    emptyTitle="No food options available right now"
  />
);

export default FoodPage;
