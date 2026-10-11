import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { ROLES } from "../config/roles.js";

// Verifies the JWT sent in the Authorization header and attaches the decoded
// payload ({ id, role }) to req.user. Controllers that need the full user
// document (e.g. getMe) look it up from req.user.id.
// The account is re-checked on every request, so deactivating a user (or
// deleting/changing their role) takes effect immediately instead of when
// their token expires. The role always comes from the DB, not the token.
export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401);
    return next(new Error("Not authorized, no token provided"));
  }

  let decoded;
  try {
    const token = authHeader.split(" ")[1];
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.status(401);
    return next(new Error("Not authorized, invalid or expired token"));
  }

  try {
    const user = await User.findById(decoded.id).select("role isActive");
    if (!user) {
      res.status(401);
      return next(new Error("Not authorized, account no longer exists"));
    }
    if (user.isActive === false) {
      res.status(403);
      return next(new Error("This account has been deactivated. Please contact the administrator."));
    }
    req.user = { ...decoded, id: user._id.toString(), role: user.role };
    next();
  } catch (error) {
    next(error);
  }
};

// e.g. authorize(ROLES.MANAGER, ROLES.OWNER)
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403);
      return next(new Error("Not authorized to access this resource"));
    }
    next();
  };
};

// Gates a single Manager capability (e.g. PERMISSIONS.CATALOG_MANAGEMENT).
// Always placed after authorize(...) on a route, so only roles that already
// passed the role check reach here. Owner is never restricted — permissions
// are an Owner-controlled ceiling on Manager access, not on Owner's own.
// Other roles (Coordinator/Customer) pass through untouched so their
// authorization on shared routes is unaffected.
// Looked up fresh from the DB (not the JWT) so a permission change by the
// Owner takes effect immediately, without the Manager needing to re-login.
export const requirePermission = (permissionKey) => requireAnyPermission(permissionKey);

// Same as requirePermission, but passes if the Manager holds at least one of
// the given permissions — for shared endpoints (e.g. image uploads) used by
// more than one management area.
export const requireAnyPermission = (...permissionKeys) => {
  return async (req, res, next) => {
    try {
      if (!req.user || req.user.role !== ROLES.MANAGER) {
        return next();
      }

      const manager = await User.findById(req.user.id).select("permissions");
      if (!manager || !permissionKeys.some((key) => manager.permissions?.[key] === true)) {
        res.status(403);
        return next(new Error("Your manager account does not have permission to perform this action"));
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
