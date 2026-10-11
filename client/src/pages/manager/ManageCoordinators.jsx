import { useState } from "react";
import { useFetch } from "../../hooks/useFetch.js";
import { listCoordinators, createCoordinator, setCoordinatorStatus } from "../../api/authApi.js";
import { apiError, formatDate } from "../../utils/format.js";
import PageHeader from "../../components/PageHeader.jsx";
import PasswordInput from "../../components/PasswordInput.jsx";
import { LoadingState, EmptyState, ErrorState } from "../../components/States.jsx";

const EMPTY = { name: "", email: "", password: "" };

// Owner, or a Manager with coordinator-management permission.
const ManageCoordinators = () => {
  const { data: coordinators, loading, error, reload } = useFetch(listCoordinators);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    setNotice("");
    setSubmitting(true);
    try {
      await createCoordinator(form);
      setNotice(`Coordinator account created for ${form.email}. They can now log in.`);
      setForm(EMPTY);
      reload();
    } catch (err) {
      setFormError(apiError(err, "Could not create coordinator"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (c) => {
    setFormError("");
    try {
      await setCoordinatorStatus(c._id, !c.isActive);
      reload();
    } catch (err) {
      setFormError(apiError(err, "Could not update coordinator"));
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Team"
        title="Coordinators"
        lead="Create event coordinator accounts so they can be assigned to bookings."
      />

      <div className="manage-layout">
        <form onSubmit={handleCreate} className="form-card">
          <h2>Create coordinator account</h2>
          <div>
            <label htmlFor="co-name">Name</label>
            <input id="co-name" autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label htmlFor="co-email">Email</label>
            <input
              id="co-email"
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="co-password">Temporary password</label>
            <PasswordInput
              id="co-password"
              minLength={6}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <p className="field-help">At least 6 characters.</p>
          </div>
          {formError && <p role="alert">{formError}</p>}
          {notice && <p className="alert-success">{notice}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create coordinator"}
          </button>
        </form>

        <section>
          <div className="section-head">
            <h2>Coordinators</h2>
            {coordinators && <span className="muted small">{coordinators.length} total</span>}
          </div>
          {loading && <LoadingState variant="list" count={2} />}
          {error && <ErrorState message={error} onRetry={reload} />}
          {!loading && !error && (!coordinators || coordinators.length === 0) && (
            <EmptyState icon="users" title="No coordinators yet" message="Create the first coordinator account with the form." />
          )}
          {!loading && !error && coordinators?.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Coordinator</th>
                  <th>Status</th>
                  <th>Since</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {coordinators.map((c) => (
                  <tr key={c._id}>
                    <td data-label="Coordinator">
                      <span className="table-title">
                        <strong>{c.name}</strong>
                        <span className="muted small">{c.email}</span>
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={`badge ${c.isActive === false ? "badge-neutral" : "badge-success"}`}>
                        {c.isActive === false ? "Deactivated" : "Active"}
                      </span>
                    </td>
                    <td data-label="Since">{c.createdAt ? formatDate(c.createdAt) : "—"}</td>
                    <td className="actions">
                      <div className="cell-actions">
                        <button
                          type="button"
                          className={`button-sm ${c.isActive === false ? "" : "button-danger"}`}
                          onClick={() => handleToggle(c)}
                        >
                          {c.isActive === false ? "Reactivate" : "Deactivate"}
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

export default ManageCoordinators;
