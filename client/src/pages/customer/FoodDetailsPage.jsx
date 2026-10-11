import { foodsApi } from "../../api/catalogApi.js";
import CatalogDetail from "../../components/CatalogDetail.jsx";

const FoodDetailsPage = () => (
  <CatalogDetail
    fetchById={foodsApi.getActiveById}
    back={{ to: "/food", label: "All food" }}
    icon="utensils"
    notFoundTitle="This food item is not available"
  />
);

export default FoodDetailsPage;
