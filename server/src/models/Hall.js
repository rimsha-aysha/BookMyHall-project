import mongoose from "mongoose";

const hallSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Hall name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    capacity: {
      type: Number,
      required: [true, "Capacity is required"],
      min: [1, "Capacity must be a positive number"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must not be negative"],
    },
    images: {
      type: [String],
      default: [],
    },
    amenities: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Backward compatibility: older records may carry a single `image` string
// instead of the `images` array. Expose it through `images` on output, and
// fold it into the array the next time the hall is saved.
hallSchema.add({ image: { type: String, select: true } });

const withLegacyImage = (images, legacyImage) => {
  const list = (images || []).filter(Boolean);
  if (legacyImage && !list.includes(legacyImage)) list.unshift(legacyImage);
  return list;
};

hallSchema.pre("save", function mergeLegacyImage() {
  if (this.image) {
    this.images = withLegacyImage(this.images, this.image);
    this.image = undefined;
  }
});

hallSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.images = withLegacyImage(ret.images, ret.image);
    delete ret.image;
    return ret;
  },
});

const Hall = mongoose.model("Hall", hallSchema);

export default Hall;
