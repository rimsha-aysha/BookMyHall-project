import { useRef, useState } from "react";
import { uploadImages } from "../api/uploadApi.js";
import { resolveImageUrl, apiError } from "../utils/format.js";

// Controlled editor for an ordered list of image references (uploaded
// "/uploads/..." paths or external URLs). The first image is the cover.
const ImageListEditor = ({ id, value, onChange, max = 30 }) => {
  const images = value || [];
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef(null);

  const move = (from, to) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const addUrl = () => {
    const url = urlInput.trim();
    setError("");
    if (!/^https?:\/\/\S+$/i.test(url)) {
      setError("Enter a full image URL starting with http:// or https://");
      return;
    }
    if (images.includes(url)) {
      setError("That image is already in the list");
      return;
    }
    onChange([...images, url].slice(0, max));
    setUrlInput("");
  };

  const handleFiles = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setError("");
    if (images.length + files.length > max) {
      setError(`You can add at most ${max} photos`);
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const res = await uploadImages(files);
      onChange([...images, ...res.data.data]);
    } catch (err) {
      setError(apiError(err, "Upload failed"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="image-editor">
      {images.length === 0 ? (
        <p className="muted">No photos yet — upload some or paste an image URL.</p>
      ) : (
        <div className="image-editor-grid">
          {images.map((src, i) => (
            <figure key={`${src}-${i}`} className="image-editor-item">
              <img src={resolveImageUrl(src)} alt={`Photo ${i + 1}`} loading="lazy" />
              {i === 0 && <span className="badge badge-accent image-editor-cover">Cover</span>}
              <figcaption>
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move left" title="Move left">
                  ←
                </button>
                <button type="button" onClick={() => move(i, 0)} disabled={i === 0} title="Make cover photo">
                  ★
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === images.length - 1}
                  aria-label="Move right"
                  title="Move right"
                >
                  →
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => onChange(images.filter((_, j) => j !== i))}
                  aria-label="Remove photo"
                  title="Remove"
                >
                  ✕
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <div className="image-editor-actions">
        <input
          ref={fileInput}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={handleFiles}
        />
        <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading}>
          {uploading ? "Uploading..." : "⬆ Upload photos"}
        </button>
        <div className="image-editor-url">
          <input
            type="url"
            placeholder="https://… paste an image URL"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
            aria-label="Image URL"
          />
          <button type="button" onClick={addUrl}>
            Add URL
          </button>
        </div>
      </div>
      <p className="muted small">
        {images.length} photo{images.length === 1 ? "" : "s"} · JPG, PNG, WEBP or GIF up to 5 MB each · ★ sets the cover photo
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
};

export default ImageListEditor;
