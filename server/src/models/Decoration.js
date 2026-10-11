import mongoose from "mongoose";

const decorationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Decoration name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must not be negative"],
    },
    category: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Decoration = mongoose.model("Decoration", decorationSchema);

export default Decoration;
