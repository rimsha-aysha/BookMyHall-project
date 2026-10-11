import { useEffect, useState } from "react";
import { useFetch } from "../../hooks/useFetch.js";
import { settingsApi } from "../../api/settingsApi.js";
import { refreshPublicSettings } from "../../hooks/usePublicSettings.js";
import PageHeader from "../../components/PageHeader.jsx";
import { ErrorState } from "../../components/States.jsx";
import { apiError } from "../../utils/format.js";

const FIELDS = [
  { name: "businessName", label: "Business Name", type: "text", required: true },
  { name: "tagline", label: "Tagline", type: "text" },
  { name: "contactEmail", label: "Contact Email", type: "email" },
  { name: "contactPhone", label: "Contact Phone", type: "text" },
  { name: "address", label: "Address", type: "text" },
  { name: "policyNotes", label: "Policy Notes", type: "textarea" },
  { name: "advancePaymentPercentage", label: "Advance Payment Percentage", type: "number", required: true },
];

const SystemSettings = () => {
  const { data: settings, loading, error } = useFetch(settingsApi.get);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        businessName: settings.businessName || "",
        tagline: settings.tagline || "",
        contactEmail: settings.contactEmail || "",
        contactPhone: settings.contactPhone || "",
        address: settings.address || "",
        policyNotes: settings.policyNotes || "",
        advancePaymentPercentage: settings.advancePaymentPercentage ?? 50,
      });
    }
  }, [settings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSuccess(false);
    setSubmitting(true);
    try {
      await settingsApi.update({
        ...form,
        advancePaymentPercentage: Number(form.advancePaymentPercentage),
      });
      refreshPublicSettings();
      setSuccess(true);
    } catch (err) {
      setFormError(apiError(err, "Could not save settings"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        lead="Business details shown across the site, booking policies and the advance payment percentage."
      />

      {loading && <div className="card skeleton" />}
      {error && <ErrorState message={error} />}

      {form && (
        <form onSubmit={handleSubmit} className="form-card">
          {FIELDS.map((field) => (
            <div key={field.name}>
              <label htmlFor={field.name}>{field.label}</label>
              {field.type === "textarea" ? (
                <textarea
                  id={field.name}
                  value={form[field.name]}
                  onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                />
              ) : (
                <input
                  id={field.name}
                  type={field.type}
                  value={form[field.name]}
                  onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                  required={field.required}
                />
              )}
            </div>
          ))}
          {formError && <p role="alert">{formError}</p>}
          {success && (
            <p className="alert-success" role="status">
              Settings saved.
            </p>
          )}
          <button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save settings"}
          </button>
        </form>
      )}
    </div>
  );
};

export default SystemSettings;
