import { useState } from "react";
import { useFetch } from "../../hooks/useFetch.js";
import {
  listManagers,
  createManager,
  setManagerStatus,
  updateManagerPermissions,
} from "../../api/authApi.js";
import PageHeader from "../../components/PageHeader.jsx";
import PasswordInput from "../../components/PasswordInput.jsx";
import { LoadingState, EmptyState, ErrorState } from "../../components/States.jsx";
import { apiError } from "../../utils/format.js";

const PERMISSION_LABELS = {
  bookingManagement: "Booking Management",
  catalogManagement: "Catalog Management",
  coordinatorManagement: "Coordinator Management",
  paymentViewing: "Payment Viewing",
  paymentRecording: "Offline Payment Recording & Confirmation",
  preparationMonitoring: "Preparation/Task Monitoring",
  issueManagement: "Issue Management",
  galleryManagement: "Event Gallery Management",
};

const ManageManagers = () => {
  const { data: managers, loading, error, reload } = useFetch(listManagers);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await createManager(form);
      setForm({ name: "", email: "", password: "" });
      reload();
    } catch (err) {
      setFormError(apiError(err, "Could not create manager"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (manager) => {
    try {
      await setManagerStatus(manager._id, !manager.isActive);
      reload();
    } catch (err) {
      setFormError(apiError(err, "Could not update manager status"));
    }
  };

  const handleTogglePermission = async (manager, key, checked) => {
    try {
      await updateManagerPermissions(manager._id, { [key]: checked });
      reload();
    } catch (err) {
      setFormError(apiError(err, "Could not update manager permissions"));
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Managers"
        lead="Create manager accounts and choose exactly which areas each manager can use."
      />

      <div className="manage-layout">
        <form onSubmit={handleCreate} className="form-card">
          <h2>Create manager account</h2>
          <div>
            <label htmlFor="mgr-name">Name</label>
            <input
              id="mgr-name"
              type="text"
              autoComplete="off"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="mgr-email">Email</label>
            <input
              id="mgr-email"
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="mgr-password">Password</label>
            <PasswordInput
              id="mgr-password"
              minLength={6}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <p className="field-help">At least 6 characters. Share it with the manager securely.</p>
          </div>
          {formError && <p role="alert">{formError}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create manager"}
          </button>
        </form>

        <section>
          <div className="section-head">
            <h2>Existing managers</h2>
            {managers && <span className="muted small">{managers.length} total</span>}
          </div>
          {loading && <LoadingState variant="list" count={2} />}
          {error && <ErrorState message={error} onRetry={reload} />}
          {!loading && !error && (!managers || managers.length === 0) && (
            <EmptyState icon="user" title="No managers yet" message="Create the first manager account with the form." />
          )}
          {!loading && !error && managers && managers.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Manager</th>
                  <th>Status</th>
                  <th>Permissions</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {managers.map((manager) => (
                  <tr key={manager._id}>
                    <td data-label="Manager">
                      <span className="table-title">
                        <strong>{manager.name}</strong>
                        <span className="muted small">{manager.email}</span>
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={`badge ${manager.isActive ? "badge-success" : "badge-neutral"}`}>
                        {manager.isActive ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td data-label="Permissions">
                      <div className="permission-list">
                        {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                          <label key={key} htmlFor={`perm-${manager._id}-${key}`} className="inline-check">
                            <input
                              id={`perm-${manager._id}-${key}`}
                              type="checkbox"
                              checked={Boolean(manager.permissions?.[key])}
                              onChange={(e) => handleTogglePermission(manager, key, e.target.checked)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="actions">
                      <div className="cell-actions">
                        <button
                          type="button"
                          className={`button-sm ${manager.isActive ? "button-danger" : ""}`}
                          onClick={() => handleToggleStatus(manager)}
                        >
                          {manager.isActive ? "Deactivate" : "Reactivate"}
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

export default ManageManagers;
