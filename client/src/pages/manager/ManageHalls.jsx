import ManagerCatalogManager from "../../components/ManagerCatalogManager.jsx";
import { hallsApi } from "../../api/catalogApi.js";

const fields = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea" },
  { name: "capacity", label: "Capacity", type: "number", required: true },
  { name: "price", label: "Price", type: "number", required: true },
  {
    name: "amenities",
    label: "Amenities (comma separated)",
    type: "list",
    help: "e.g. Air Conditioning, Stage, Parking, Bridal Room",
  },
  { name: "images", label: "Photos", type: "images" },
];

const ManageHalls = () => (
  <ManagerCatalogManager title="Manage Halls" api={hallsApi} fields={fields} />
);

export default ManageHalls;
