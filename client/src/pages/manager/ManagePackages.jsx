import ManagerCatalogManager from "../../components/ManagerCatalogManager.jsx";
import { packagesApi } from "../../api/catalogApi.js";

const fields = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea" },
  { name: "price", label: "Price", type: "number", required: true },
  { name: "includedItems", label: "Included Items (comma separated)", type: "list" },
];

const ManagePackages = () => (
  <ManagerCatalogManager title="Manage Packages" api={packagesApi} fields={fields} />
);

export default ManagePackages;
