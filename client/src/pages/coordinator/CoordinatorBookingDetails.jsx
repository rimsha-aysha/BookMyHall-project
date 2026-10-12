import { useCallback, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch.js";
import { bookingApi } from "../../api/bookingApi.js";
import { taskApi } from "../../api/taskApi.js";
import { issueApi } from "../../api/issueApi.js";
import { StatusBadge } from "../../components/BookingStatus.jsx";
import Icon from "../../components/Icon.jsx";
import { ErrorState } from "../../components/States.jsx";
import { apiError, formatDate, formatRs, formatTimeRange } from "../../utils/format.js";

const NamedList = ({ items }) => {
  if (!items || items.length === 0) return <p className="muted small">None selected.</p>;
  return (
    <dl className="cost-lines compact">
      {items.map((item) => (
        <div key={item._id}>
          <dt>{item.name}</dt>
          <dd>{formatRs(item.price)}</dd>
        </div>
      ))}
    </dl>
  );
};

const TASK_STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

const TASK_CATEGORY_LABELS = {
  hall_setup: "Hall Setup",
  food: "Food",
  decorations: "Decorations",
  additional_services: "Additional Services",
  customer_requirements: "Customer Requirements",
};

// Generated ("system") tasks are required; anything else is a legacy task
// typed in manually before tasks were generated — shown, but optional.
const isRequiredTask = (task) => task.source === "system";

const TaskRow = ({ task, onStatusChange, updating }) => (
  <li className="task-item">
    <div className="task-text">
      <strong>{task.title}</strong>
      {task.description && <p className="muted small">{task.description}</p>}
      {task.reason && (
        <p className="small">
          <strong>Why:</strong> {task.reason}
        </p>
      )}
    </div>
    <div className="task-status">
      <label htmlFor={`status-${task._id}`} className="sr-only">
        Status of {task.title}
      </label>
      <select
        id={`status-${task._id}`}
        value={task.status}
        disabled={updating}
        onChange={(e) => onStatusChange(task, e.target.value)}
      >
        {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  </li>
);

const TasksSection = ({ tasks, loading, error, onStatusChange, updatingId, updateError }) => {
  const requiredTasks = (tasks || []).filter(isRequiredTask);
  const legacyTasks = (tasks || []).filter((task) => !isRequiredTask(task));

  // Only categories this booking actually generated tasks for.
  const tasksByCategory = Object.keys(TASK_CATEGORY_LABELS)
    .map((category) => ({ category, tasks: requiredTasks.filter((task) => task.category === category) }))
    .filter(({ tasks: categoryTasks }) => categoryTasks.length > 0);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Preparation tasks</h2>
        {requiredTasks.length > 0 && (
          <span className="muted small">
            {requiredTasks.filter((t) => t.status === "completed").length}/{requiredTasks.length} done
          </span>
        )}
      </div>
      <div className="panel-body">
        <p className="muted small">
          Generated automatically from this booking's hall, package, food, decorations, services and requirements.
          Update each task's status as you go.
        </p>
        {loading && !tasks && <p className="muted">Loading tasks…</p>}
        {error && <p role="alert">{error}</p>}
        {updateError && <p role="alert">{updateError}</p>}
        {!error && tasks && requiredTasks.length === 0 && <p className="muted">No preparation tasks for this booking.</p>}
        {!error &&
          tasksByCategory.map(({ category, tasks: categoryTasks }) => (
            <div key={category}>
              <p className="course-label">{TASK_CATEGORY_LABELS[category]}</p>
              <ul className="card-list">
                {categoryTasks.map((task) => (
                  <TaskRow
                    key={task._id}
                    task={task}
                    onStatusChange={onStatusChange}
                    updating={updatingId === task._id}
                  />
                ))}
              </ul>
            </div>
          ))}
        {!error && legacyTasks.length > 0 && (
          <div>
            <p className="course-label">Earlier manual tasks (optional)</p>
            <p className="muted small">
              Added by hand before tasks were generated automatically. Kept for reference — they don't block
              completing preparation.
            </p>
            <ul className="card-list">
              {legacyTasks.map((task) => (
                <TaskRow
                  key={task._id}
                  task={task}
                  onStatusChange={onStatusChange}
                  updating={updatingId === task._id}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};

const ISSUE_STATUS_LABELS = {
  open: "Open",
  resolved: "Resolved",
};

const IssuesSection = ({ bookingId }) => {
  const fetchIssues = useCallback(() => issueApi.listForBooking(bookingId), [bookingId]);
  const { data: issues, loading, error, reload } = useFetch(fetchIssues);
  const [form, setForm] = useState({ title: "", description: "" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await issueApi.create(bookingId, form);
      setForm({ title: "", description: "" });
      reload();
    } catch (err) {
      setFormError(apiError(err, "Could not report issue"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Issues</h2>
      </div>
      <div className="panel-body">
        {loading && <p className="muted">Loading issues…</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && !error && (!issues || issues.length === 0) && <p className="muted">No issues reported.</p>}
        {!loading && !error && issues?.length > 0 && (
          <ul className="person-list stacked">
            {issues.map((issue) => (
              <li key={issue._id}>
                <span className="title-row">
                  <strong>{issue.title}</strong>
                  <span className={`badge badge-${issue.status === "open" ? "warning" : "success"}`}>
                    {ISSUE_STATUS_LABELS[issue.status] || issue.status}
                  </span>
                </span>
                {issue.description && <span className="small">{issue.description}</span>}
              </li>
            ))}
          </ul>
        )}

        <h3>Report an issue</h3>
        <form onSubmit={handleCreate}>
          <div>
            <label htmlFor="issue-title">Title</label>
            <input
              id="issue-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="issue-description">Description</label>
            <textarea
              id="issue-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          {formError && <p role="alert">{formError}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? "Reporting…" : "Report issue"}
          </button>
        </form>
      </div>
    </section>
  );
};

const PREPARATION_STATUS_LABELS = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

const PREPARATION_TONE = { not_started: "neutral", in_progress: "warning", completed: "success" };

const PreparationStatusSection = ({ booking, tasks, onUpdated }) => {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Same rule as the API: every generated task completed.
  const requiredTasks = (tasks || []).filter(isRequiredTask);
  const allTasksCompleted = requiredTasks.length > 0 && requiredTasks.every((t) => t.status === "completed");

  const handleUpdate = async (preparationStatus) => {
    setError("");
    setSubmitting(true);
    try {
      await bookingApi.updatePreparationStatus(booking._id, preparationStatus);
      onUpdated();
    } catch (err) {
      setError(apiError(err, "Could not update preparation status"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Overall preparation</h2>
        <span className={`badge badge-${PREPARATION_TONE[booking.preparationStatus] || "neutral"}`}>
          {PREPARATION_STATUS_LABELS[booking.preparationStatus] || booking.preparationStatus}
        </span>
      </div>
      <div className="panel-body">
        <div className="field">
          <label htmlFor="prep-status">Update status</label>
          <select
            id="prep-status"
            value={booking.preparationStatus === "completed" ? "in_progress" : booking.preparationStatus}
            onChange={(e) => handleUpdate(e.target.value)}
            disabled={submitting}
          >
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
          </select>
        </div>

        <h3>Final check</h3>
        {requiredTasks.length === 0 ? (
          <p className="muted small">No preparation tasks yet.</p>
        ) : (
          <ul className="check-list">
            {requiredTasks.map((task) => (
              <li key={task._id} className={task.status === "completed" ? "" : "muted"}>
                <Icon name={task.status === "completed" ? "check" : "x"} size={14} /> {task.title} (
                {task.status === "completed" ? "Completed" : "Not completed"})
              </li>
            ))}
          </ul>
        )}

        {error && <p role="alert">{error}</p>}
        {!allTasksCompleted && requiredTasks.length > 0 && booking.preparationStatus !== "completed" && (
          <p className="muted small">Complete every task above to enable this.</p>
        )}

        <button
          type="button"
          className="button-primary block"
          disabled={submitting || !allTasksCompleted || booking.preparationStatus === "completed"}
          onClick={() => handleUpdate("completed")}
        >
          <Icon name="check" size={16} /> Mark preparation complete
        </button>
      </div>
    </section>
  );
};

const CoordinatorBookingDetails = () => {
  const { id } = useParams();
  const fetchBooking = useCallback(() => bookingApi.getById(id), [id]);
  const { data: booking, loading, error, reload } = useFetch(fetchBooking);
  // Shared by the task list and the final check, so completing the last task
  // enables "Mark preparation complete" straight away.
  const fetchTasks = useCallback(() => taskApi.listForBooking(id), [id]);
  const { data: tasks, loading: tasksLoading, error: tasksError, reload: reloadTasks } = useFetch(fetchTasks);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [taskUpdateError, setTaskUpdateError] = useState("");

  const handleTaskStatusChange = async (task, status) => {
    setTaskUpdateError("");
    setUpdatingTaskId(task._id);
    try {
      await taskApi.updateStatus(task._id, status);
      reloadTasks();
      // The API reopens a completed preparation when a required task is reopened.
      if (booking?.preparationStatus === "completed" && isRequiredTask(task) && status !== "completed") reload();
    } catch (err) {
      setTaskUpdateError(apiError(err, "Could not update task status"));
    } finally {
      setUpdatingTaskId(null);
    }
  };

  return (
    <div>
      <Link to="/coordinator" className="breadcrumb">
        <Icon name="arrowLeft" size={16} /> My events
      </Link>

      {loading && <div className="card skeleton skeleton-tall" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && booking && (
        <>
          <div className="page-head">
            <p className="eyebrow">Assigned event</p>
            <div className="title-row">
              <h1>
                {booking.eventType} · {booking.hall?.name}
              </h1>
              <StatusBadge status={booking.status} />
            </div>
            <div className="card-meta large">
              <span>
                <Icon name="calendar" size={16} />{" "}
                {formatDate(booking.eventDate, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
              </span>
              <span>
                <Icon name="clock" size={16} /> {formatTimeRange(booking.startTime, booking.endTime)}
              </span>
              <span>
                <Icon name="users" size={16} /> {booking.guestCount} guests
              </span>
            </div>
          </div>

          <div className="detail-grid">
            <div className="stack">
              <section className="panel">
                <div className="panel-head">
                  <h2>Event details</h2>
                </div>
                <div className="panel-body">
                  <dl className="kv-list">
                    <div>
                      <dt>Customer</dt>
                      <dd>
                        {booking.customer?.name || booking.walkInCustomer?.name}
                        <br />
                        <span className="muted small">{booking.customer?.email || booking.walkInCustomer?.email}</span>
                      </dd>
                    </div>
                    <div>
                      <dt>Hall</dt>
                      <dd>{booking.hall?.name}</dd>
                    </div>
                    <div>
                      <dt>Package</dt>
                      <dd>{booking.package?.name || "None"}</dd>
                    </div>
                    <div>
                      <dt>Estimated cost</dt>
                      <dd>{formatRs(booking.estimatedCost)}</dd>
                    </div>
                  </dl>
                  <h3>Requirements</h3>
                  <p className={booking.requirements ? "" : "muted"}>{booking.requirements || "None"}</p>
                  <h3>Food</h3>
                  <NamedList items={booking.food} />
                  <h3>Decorations</h3>
                  <NamedList items={booking.decorations} />
                  <h3>Additional services</h3>
                  <NamedList items={booking.services} />
                </div>
              </section>
              <TasksSection
                tasks={tasks}
                loading={tasksLoading}
                error={tasksError}
                onStatusChange={handleTaskStatusChange}
                updatingId={updatingTaskId}
                updateError={taskUpdateError}
              />
            </div>

            <div className="stack detail-aside">
              <PreparationStatusSection booking={booking} tasks={tasks} onUpdated={reload} />
              <IssuesSection bookingId={booking._id} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CoordinatorBookingDetails;
