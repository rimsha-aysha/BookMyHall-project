import ManagerCatalogManager from "../../components/ManagerCatalogManager.jsx";
import { foodsApi } from "../../api/catalogApi.js";

const fields = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea" },
  { name: "price", label: "Price", type: "number", required: true },
  { name: "category", label: "Category", type: "text" },
];

const ManageFood = () => (
  <ManagerCatalogManager title="Manage Food" api={foodsApi} fields={fields} />
);

export default ManageFood;
