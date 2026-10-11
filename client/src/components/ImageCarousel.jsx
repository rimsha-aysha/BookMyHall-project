import { useState } from "react";
import Lightbox from "./Lightbox.jsx";
import { resolveImageUrl } from "../utils/format.js";

// Main photo with prev/next arrows and a thumbnail strip. Clicking the main
// photo opens it full-size in the Lightbox.
const ImageCarousel = ({ images, alt }) => {
  const [current, setCurrent] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const list = (images || []).filter(Boolean);

  if (list.length === 0) {
    return (
      <div className="carousel carousel-empty">
        <span>No photos yet</span>
      </div>
    );
  }

  const index = Math.min(current, list.length - 1);
  const go = (delta) => setCurrent((index + delta + list.length) % list.length);

  return (
    <div className="carousel">
      <div className="carousel-main">
        <button
          type="button"
          className="carousel-image-button"
          onClick={() => setLightboxIndex(index)}
          aria-label="View photo full size"
        >
          <img src={resolveImageUrl(list[index])} alt={`${alt} — photo ${index + 1}`} />
          <span className="carousel-zoom-hint">⤢ View full size</span>
        </button>
        {list.length > 1 && (
          <>
            <button type="button" className="carousel-nav prev" onClick={() => go(-1)} aria-label="Previous photo">
              ‹
            </button>
            <button type="button" className="carousel-nav next" onClick={() => go(1)} aria-label="Next photo">
              ›
            </button>
            <span className="carousel-counter">
              {index + 1} / {list.length}
            </span>
          </>
        )}
      </div>

      {list.length > 1 && (
        <div className="carousel-thumbs">
          {list.map((src, i) => (
            <button
              type="button"
              key={`${src}-${i}`}
              className={i === index ? "active" : ""}
              onClick={() => setCurrent(i)}
              aria-label={`Show photo ${i + 1}`}
            >
              <img src={resolveImageUrl(src)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <Lightbox
        images={list}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
        caption={alt}
      />
    </div>
  );
};

export default ImageCarousel;
