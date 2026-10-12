import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ALL_ROLES, ROLES } from "../config/roles.js";
import { PERMISSIONS } from "../config/permissions.js";
import { INDIAN_MOBILE_REGEX, INVALID_PHONE_MESSAGE, normalizePhone } from "../utils/phone.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    // 10-digit Indian mobile number, stored without formatting (see
    // utils/phone.js). Required when a customer account is created; customers
    // registered before this field existed may not have one yet and can add
    // it from their account page — their accounts keep working without it.
    phone: {
      type: String,
      trim: true,
      set: normalizePhone,
      match: [INDIAN_MOBILE_REGEX, INVALID_PHONE_MESSAGE],
      required: [
        function phoneRequiredForNewCustomers() {
          return this.isNew && this.role === ROLES.CUSTOMER;
        },
        "Phone number is required",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ALL_ROLES,
      default: ROLES.CUSTOMER,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Only meaningful for role: "manager" — Owner-controlled, per-account
    // access to Manager capabilities. All default to true so existing/new
    // Managers keep full access unless an Owner explicitly narrows it.
    permissions: {
      [PERMISSIONS.BOOKING_MANAGEMENT]: { type: Boolean, default: true },
      [PERMISSIONS.CATALOG_MANAGEMENT]: { type: Boolean, default: true },
      [PERMISSIONS.COORDINATOR_MANAGEMENT]: { type: Boolean, default: true },
      [PERMISSIONS.PAYMENT_VIEWING]: { type: Boolean, default: true },
      [PERMISSIONS.PAYMENT_RECORDING]: { type: Boolean, default: true },
      [PERMISSIONS.PREPARATION_MONITORING]: { type: Boolean, default: true },
      [PERMISSIONS.ISSUE_MANAGEMENT]: { type: Boolean, default: true },
      [PERMISSIONS.GALLERY_MANAGEMENT]: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model("User", userSchema);

export default User;
