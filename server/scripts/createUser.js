// Dev/admin utility to create a privileged account (manager, coordinator, owner).
// Not exposed over HTTP. Run from the server/ folder:
//   node scripts/createUser.js --name "Jane Doe" --email jane@example.com --password secret123 --role manager
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { getMongoUri } from "../src/config/db.js";
import User from "../src/models/User.js";
import { ALL_ROLES, ROLES } from "../src/config/roles.js";

const parseArgs = () => {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i].replace(/^--/, "");
    args[key] = process.argv[i + 1];
  }
  return args;
};

const run = async () => {
  const { name, email, password, role } = parseArgs();

  if (!name || !email || !password || !role) {
    console.error(
      "Usage: node scripts/createUser.js --name <name> --email <email> --password <password> --role <manager|coordinator|owner>"
    );
    process.exit(1);
  }

  if (!ALL_ROLES.includes(role) || role === ROLES.CUSTOMER) {
    console.error(
      `Invalid role "${role}". Use one of: manager, coordinator, owner (customers should use the public register form).`
    );
    process.exit(1);
  }

  await mongoose.connect(getMongoUri());

  const existing = await User.findOne({ email });
  if (existing) {
    console.error(`A user with email "${email}" already exists.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const user = await User.create({ name, email, password, role });
  console.log(`Created ${role} account: ${user.email} (id: ${user._id})`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (error) => {
  console.error("Failed to create user:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
