import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch.js";
import { galleryApi } from "../../api/galleryApi.js";
import { hallsApi } from "../../api/catalogApi.js";
import ImageListEditor from "../../components/ImageListEditor.jsx";
import { resolveImageUrl, formatDate, apiError } from "../../utils/format.js";
import { LoadingState, EmptyState, ErrorState } from "../../components/States.jsx";

const EVENT_TYPES = ["Wedding", "Engagement", "Birthday", "Anniversary", "Corporate Event", "Conference", "Other"];

const EMPTY_FORM = {
  title: "",
  eventType: "",
  hall: "",
  eventDate: "",
  guestCount: "",
  description: "",
  images: [],
  isPublished: true,
};

const toForm = (entry) => ({
  title: entry.title,
  eventType: entry.eventType,
  hall: entry.hall?._id || "",
  eventDate: entry.eventDate ? entry.eventDate.slice(0, 10) : "",
  guestCount: entry.guestCount ?? "",
  description: entry.description || "",
  images: [...entry.images],
  isPublished: entry.isPublished,
});

// Halls come from the public list so a Manager with gallery (but not
// catalog) permission can still tag entries with a hall.
const ManageGallery = () => {
  const { data: entries, loading, error, reload } = useFetch(galleryApi.listAll);
  const { data: halls } = useFetch(hallsApi.listActive);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError("");
  };

  const startEdit = (entry) => {
    setEditingId(entry._id);
    setForm(toForm(entry));
    setFormError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setNotice("");
    if (form.images.length === 0) {
      setFormError("Add at least one photo");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        eventType: form.eventType.trim(),
        guestCount: form.guestCount === "" ? "" : Number(form.guestCount),
      };
      if (editingId) {
        await galleryApi.update(editingId, payload);
        setNotice("Gallery entry updated.");
      } else {
        await galleryApi.create(payload);
        setNotice("Gallery entry added.");
      }
      resetForm();
      reload();
    } catch (err) {
      setFormError(apiError(err, "Save failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublished = async (entry) => {
    try {
      await galleryApi.setPublished(entry._id, !entry.isPublished);
      reload();
    } catch (err) {
      setFormError(apiError(err, "Could not update entry"));
    }
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(`Delete "${entry.title}" and its ${entry.images.length} photo(s) from the gallery?`)) return;
    try {
      await galleryApi.remove(entry._id);
      if (editingId === entry._id) resetForm();
      reload();
    } catch (err) {
      setFormError(apiError(err, "Could not delete entry"));
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>Manage Event Gallery</h1>
        <p className="lead">
          Showcase events you've hosted. Published entries appear on the public{" "}
          <Link to="/gallery">Past Events</Link> page and on each hall's page.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="form-card wide-form">
        <h2>{editingId ? "Edit gallery entry" : "Add a past event"}</h2>
        <div className="form-row">
          <div>
            <label htmlFor="g-title">Title</label>
            <input id="g-title" value={form.title} onChange={(e) => set("title", e.target.value)} required />
          </div>
          <div>
            <label htmlFor="g-type">Event type</label>
            <input
              id="g-type"
              list="g-type-options"
              value={form.eventType}
              onChange={(e) => set("eventType", e.target.value)}
              placeholder="e.g. Wedding"
              required
            />
            <datalist id="g-type-options">
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="form-row">
          <div>
            <label htmlFor="g-hall">Hall</label>
            <select id="g-hall" value={form.hall} onChange={(e) => set("hall", e.target.value)}>
              <option value="">Not specified</option>
              {(halls || []).map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="g-date">Event date</label>
            <input id="g-date" type="date" value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
          </div>
          <div>
            <label htmlFor="g-guests">Guests</label>
            <input
              id="g-guests"
              type="number"
              min="1"
              value={form.guestCount}
              onChange={(e) => set("guestCount", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label htmlFor="g-desc">Description</label>
          <textarea id="g-desc" value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div>
          <label htmlFor="g-images">Photos</label>
          <ImageListEditor id="g-images" value={form.images} onChange={(images) => set("images", images)} />
        </div>
        <div>
          <label className="inline-check">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => set("isPublished", e.target.checked)} />
            Published (visible to customers)
          </label>
        </div>
        {formError && <p role="alert">{formError}</p>}
        {notice && <p className="alert-success" role="status">{notice}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : editingId ? "Update entry" : "Add to gallery"}
        </button>
        {editingId && (
          <button type="button" onClick={resetForm}>
            Cancel
          </button>
        )}
      </form>

      <div className="section-head">
        <h2>Gallery entries</h2>
        {entries && <span className="muted small">{entries.length} total</span>}
      </div>
      {loading && <LoadingState variant="list" count={2} />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (!entries || entries.length === 0) && (
        <EmptyState icon="camera" title="No gallery entries yet" message="Add your first past event with the form above." />
      )}
      {!loading && !error && entries?.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Cover</th>
              <th>Event</th>
              <th>Hall</th>
              <th>Date</th>
              <th>Photos</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry._id}>
                <td data-label="Cover">
                  <img className="table-thumb" src={resolveImageUrl(entry.images[0])} alt="" />
                </td>
                <td data-label="Event">
                  <span className="table-title">
                    <strong>{entry.title}</strong>
                    <span className="muted small">{entry.eventType}</span>
                  </span>
                </td>
                <td data-label="Hall">{entry.hall?.name || "—"}</td>
                <td data-label="Date">{entry.eventDate ? formatDate(entry.eventDate) : "—"}</td>
                <td data-label="Photos">{entry.images.length}</td>
                <td data-label="Status">
                  <span className={`badge ${entry.isPublished ? "badge-success" : "badge-neutral"}`}>
                    {entry.isPublished ? "Published" : "Hidden"}
                  </span>
                </td>
                <td className="actions">
                  <div className="cell-actions">
                    <button type="button" className="button-sm" onClick={() => startEdit(entry)}>
                      Edit
                    </button>
                    <button type="button" className="button-sm" onClick={() => handleTogglePublished(entry)}>
                      {entry.isPublished ? "Hide" : "Publish"}
                    </button>
                    <button type="button" className="button-sm button-danger" onClick={() => handleDelete(entry)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ManageGallery;
