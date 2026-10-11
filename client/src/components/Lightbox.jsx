import { useEffect, useRef } from "react";
import { resolveImageUrl } from "../utils/format.js";

// Full-screen photo viewer. Controlled: the parent owns `index` (null = closed).
// Keyboard: ←/→ to navigate, Esc to close. Touch: swipe left/right.
const Lightbox = ({ images, index, onIndexChange, onClose, caption }) => {
  const touchStartX = useRef(null);
  const isOpen = index !== null && index !== undefined && images?.length > 0;
  const count = images?.length || 0;

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndexChange((index + 1) % count);
      if (e.key === "ArrowLeft") onIndexChange((index - 1 + count) % count);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, index, count, onClose, onIndexChange]);

  if (!isOpen) return null;

  const go = (delta) => onIndexChange((index + delta + count) % count);

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touchStartX.current = null;
      }}
    >
      <div className="lightbox-top" onClick={(e) => e.stopPropagation()}>
        <span className="lightbox-counter">
          {index + 1} / {count}
        </span>
        <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close photo viewer">
          ✕
        </button>
      </div>

      <div className="lightbox-stage">
        {count > 1 && (
          <button
            type="button"
            className="lightbox-nav prev"
            aria-label="Previous photo"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
          >
            ‹
          </button>
        )}
        <img
          src={resolveImageUrl(images[index])}
          alt={caption ? `${caption} — photo ${index + 1}` : `Photo ${index + 1}`}
          onClick={(e) => e.stopPropagation()}
        />
        {count > 1 && (
          <button
            type="button"
            className="lightbox-nav next"
            aria-label="Next photo"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
          >
            ›
          </button>
        )}
      </div>

      {caption && <p className="lightbox-caption">{caption}</p>}

      {count > 1 && (
        <div className="lightbox-thumbs" onClick={(e) => e.stopPropagation()}>
          {images.map((src, i) => (
            <button
              type="button"
              key={`${src}-${i}`}
              className={i === index ? "active" : ""}
              onClick={() => onIndexChange(i)}
              aria-label={`Show photo ${i + 1}`}
            >
              <img src={resolveImageUrl(src)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Lightbox;
