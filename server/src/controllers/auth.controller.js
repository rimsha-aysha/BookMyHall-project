import User from "../models/User.js";
import { ROLES } from "../config/roles.js";
import { ALL_PERMISSIONS } from "../config/permissions.js";
import { generateToken } from "../utils/generateToken.js";

// Public registration always creates a CUSTOMER. Privileged roles are never
// accepted from the request body here — see server/scripts/createUser.js.
export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409);
      return next(new Error("An account with this email already exists"));
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: ROLES.CUSTOMER,
    });

    const token = generateToken(user);
    res.status(201).json({ success: true, token, user: user.toJSON() });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      res.status(401);
      return next(new Error("Invalid email or password"));
    }

    if (user.isActive === false) {
      res.status(403);
      return next(new Error("This account has been deactivated. Please contact the administrator."));
    }

    const token = generateToken(user);
    res.status(200).json({ success: true, token, user: user.toJSON() });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404);
      return next(new Error("User not found"));
    }
    res.status(200).json({ success: true, user: user.toJSON() });
  } catch (error) {
    next(error);
  }
};

// Customer updates their own profile. Only the phone number is accepted —
// every other field in the body (role, email, isActive, password, …) is
// ignored, and the target is always the authenticated user, never an id from
// the request.
export const updateMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404);
      return next(new Error("User not found"));
    }
    user.phone = req.body.phone; // already normalized + validated by phoneUpdateRules
    await user.save();
    res.status(200).json({ success: true, user: user.toJSON() });
  } catch (error) {
    next(error);
  }
};

// Lets managers/owners populate a coordinator picker when assigning a
// coordinator to a booking.
// Includes inactive accounts (flagged by isActive) so the coordinator
// management page can reactivate them; pickers filter to active ones.
export const listCoordinators = async (req, res, next) => {
  try {
    const coordinators = await User.find({ role: ROLES.COORDINATOR })
      .select("name email isActive createdAt")
      .sort({ name: 1 });
    res.status(200).json({ success: true, count: coordinators.length, data: coordinators });
  } catch (error) {
    next(error);
  }
};

// Owner, or a Manager with coordinator-management permission, can create and
// (de)activate coordinator accounts — previously only possible via the CLI script.
export const createCoordinator = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409);
      return next(new Error("An account with this email already exists"));
    }

    const coordinator = await User.create({ name, email, password, role: ROLES.COORDINATOR });
    res.status(201).json({ success: true, user: coordinator.toJSON() });
  } catch (error) {
    next(error);
  }
};

export const setCoordinatorActiveStatus = async (req, res, next) => {
  try {
    if (typeof req.body.isActive !== "boolean") {
      res.status(400);
      return next(new Error("isActive must be true or false"));
    }

    const coordinator = await User.findOne({ _id: req.params.id, role: ROLES.COORDINATOR });
    if (!coordinator) {
      res.status(404);
      return next(new Error("Coordinator not found"));
    }

    coordinator.isActive = req.body.isActive;
    await coordinator.save();
    res.status(200).json({ success: true, user: coordinator.toJSON() });
  } catch (error) {
    next(error);
  }
};

// Owner-only manager account management.
export const listManagers = async (req, res, next) => {
  try {
    const managers = await User.find({ role: ROLES.MANAGER }).select(
      "name email isActive createdAt permissions"
    );
    res.status(200).json({ success: true, count: managers.length, data: managers });
  } catch (error) {
    next(error);
  }
};

export const createManager = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409);
      return next(new Error("An account with this email already exists"));
    }

    const manager = await User.create({ name, email, password, role: ROLES.MANAGER });
    res.status(201).json({ success: true, user: manager.toJSON() });
  } catch (error) {
    next(error);
  }
};

// Owner-only. Returns a Manager's current permission set — same User document,
// no separate permissions model.
export const getManagerPermissions = async (req, res, next) => {
  try {
    const manager = await User.findOne({ _id: req.params.id, role: ROLES.MANAGER }).select(
      "name email permissions"
    );
    if (!manager) {
      res.status(404);
      return next(new Error("Manager not found"));
    }

    res.status(200).json({
      success: true,
      data: {
        managerId: manager._id,
        name: manager.name,
        email: manager.email,
        permissions: manager.permissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Owner-only. Partial update — only the permission keys present in the
// request body are changed, everything else on the account is untouched.
export const updateManagerPermissions = async (req, res, next) => {
  try {
    const manager = await User.findOne({ _id: req.params.id, role: ROLES.MANAGER });
    if (!manager) {
      res.status(404);
      return next(new Error("Manager not found"));
    }

    const updates = req.body.permissions || {};
    ALL_PERMISSIONS.forEach((key) => {
      if (typeof updates[key] === "boolean") {
        manager.permissions[key] = updates[key];
      }
    });
    await manager.save();

    res.status(200).json({
      success: true,
      data: {
        managerId: manager._id,
        name: manager.name,
        email: manager.email,
        permissions: manager.permissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const setManagerActiveStatus = async (req, res, next) => {
  try {
    if (typeof req.body.isActive !== "boolean") {
      res.status(400);
      return next(new Error("isActive must be true or false"));
    }

    const manager = await User.findOne({ _id: req.params.id, role: ROLES.MANAGER });
    if (!manager) {
      res.status(404);
      return next(new Error("Manager not found"));
    }

    manager.isActive = req.body.isActive;
    await manager.save();

    res.status(200).json({ success: true, user: manager.toJSON() });
  } catch (error) {
    next(error);
  }
};
