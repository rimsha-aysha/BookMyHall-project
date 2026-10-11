import { useState } from "react";
import { useFetch } from "../hooks/useFetch.js";
import ImageListEditor from "./ImageListEditor.jsx";
import { resolveImageUrl, formatRs, apiError } from "../utils/format.js";
import PageHeader from "./PageHeader.jsx";
import { LoadingState, EmptyState, ErrorState } from "./States.jsx";

// Generic manage-a-catalog-resource UI (list + create/edit form + activate/
// deactivate + delete), reused by Halls/Packages/Food/Decorations/Services —
// they differ only in which fields they collect. `fields` describes those:
// { name, label, type: "text" | "textarea" | "number" | "list" (comma-separated array)
//   | "images" (ordered photo list with upload/URL/reorder), required, help }
const emptyFormFrom = (fields) =>
  Object.fromEntries(fields.map((f) => [f.name, f.type === "images" ? [] : ""]));

const toFormValue = (item, field) => {
  const value = item[field.name];
  if (field.type === "list") return (value || []).join(", ");
  if (field.type === "images") return [...(value || [])];
  return value ?? "";
};

const toPayloadValue = (rawValue, field) => {
  if (field.type === "number") return rawValue === "" ? undefined : Number(rawValue);
  if (field.type === "images") return rawValue;
  if (field.type === "list") {
    return rawValue
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return rawValue;
};

const ManagerCatalogManager = ({ title, api, fields }) => {
  const { data: items, loading, error, reload } = useFetch(api.listAll);
  const [form, setForm] = useState(emptyFormFrom(fields));
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const imageField = fields.find((f) => f.type === "images");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setForm(emptyFormFrom(fields));
    setEditingId(null);
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setForm(Object.fromEntries(fields.map((f) => [f.name, toFormValue(item, f)])));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const payload = Object.fromEntries(
        fields.map((f) => [f.name, toPayloadValue(form[f.name], f)])
      );
      if (editingId) {
        await api.update(editingId, payload);
      } else {
        await api.create(payload);
      }
      resetForm();
      reload();
    } catch (err) {
      setFormError(apiError(err, "Save failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (item) => {
    setFormError("");
    try {
      await api.setStatus(item._id, !item.isActive);
      reload();
    } catch (err) {
      setFormError(apiError(err, "Could not update status"));
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    setFormError("");
    try {
      await api.remove(item._id);
      if (editingId === item._id) resetForm();
      reload();
    } catch (err) {
      setFormError(apiError(err, "Delete failed"));
    }
  };

  const itemLabel = title.replace(/^Manage\s+/i, "");

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title={title}
        lead={`Add, edit, activate or retire ${itemLabel.toLowerCase()}. Only active items are shown to customers.`}
      />

      <div className="manage-layout">
        <form onSubmit={handleSubmit} className="form-card">
          <h2>{editingId ? "Edit item" : "Add new item"}</h2>
          {fields.map((f) => (
            <div key={f.name}>
              <label htmlFor={f.name}>{f.label}</label>
              {f.type === "images" ? (
                <ImageListEditor
                  id={f.name}
                  value={form[f.name]}
                  onChange={(images) => setForm((prev) => ({ ...prev, [f.name]: images }))}
                />
              ) : f.type === "textarea" ? (
                <textarea id={f.name} name={f.name} value={form[f.name]} onChange={handleChange} />
              ) : (
                <input
                  id={f.name}
                  name={f.name}
                  type={f.type === "number" ? "number" : "text"}
                  value={form[f.name]}
                  onChange={handleChange}
                  required={f.required}
                />
              )}
              {f.help && <p className="field-help">{f.help}</p>}
            </div>
          ))}
          {formError && <p role="alert">{formError}</p>}
          <div className="form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : editingId ? "Update" : "Create"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <section>
          <div className="section-head">
            <h2>All items</h2>
            {items && <span className="muted small">{items.length} total · {items.filter((i) => i.isActive).length} active</span>}
          </div>
          {loading && <LoadingState variant="list" count={3} />}
          {error && <ErrorState message={error} onRetry={reload} />}
          {!loading && !error && (!items || items.length === 0) && (
            <EmptyState title="No items yet" message="Use the form to add the first one." />
          )}
          {!loading && !error && items && items.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  {imageField && <th>Photo</th>}
                  <th>Name</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id}>
                    {imageField && (
                      <td data-label="Photo">
                        {item[imageField.name]?.[0] ? (
                          <img className="table-thumb" src={resolveImageUrl(item[imageField.name][0])} alt="" />
                        ) : (
                          <span className="muted small">No photo</span>
                        )}
                        {item[imageField.name]?.length > 1 && (
                          <span className="muted small"> +{item[imageField.name].length - 1}</span>
                        )}
                      </td>
                    )}
                    <td data-label="Name">
                      <span className="table-title">
                        <strong>{item.name}</strong>
                        {item.category && <span className="muted small">{item.category}</span>}
                        {item.capacity && <span className="muted small">Up to {item.capacity} guests</span>}
                      </span>
                    </td>
                    <td data-label="Price">
                      <span className="price">{formatRs(item.price)}</span>
                    </td>
                    <td data-label="Status">
                      <span className={`badge ${item.isActive ? "badge-success" : "badge-neutral"}`}>
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="actions">
                      <div className="cell-actions">
                        <button type="button" className="button-sm" onClick={() => startEdit(item)}>
                          Edit
                        </button>
                        <button type="button" className="button-sm" onClick={() => handleToggleStatus(item)}>
                          {item.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button type="button" className="button-sm button-danger" onClick={() => handleDelete(item)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
};

export default ManagerCatalogManager;
