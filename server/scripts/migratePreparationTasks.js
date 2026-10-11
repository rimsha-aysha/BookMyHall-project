// Generates preparation tasks for every booking that already has a
// coordinator (bookings assigned before task generation existed). Safe to
// run repeatedly — generation is idempotent. The API also does this lazily
// whenever a booking's tasks are opened, so running this is optional.
//
// Legacy manually created tasks are left untouched: they stay visible as
// "earlier manual tasks" but no longer block "preparation complete".
// Bookings whose preparation was already marked complete get their new tasks
// created as completed, so that sign-off isn't reopened.
// Run from the server/ folder:  npm run migrate:tasks
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { getMongoUri } from "../src/config/db.js";
import Booking from "../src/models/Booking.js";
import PreparationTask from "../src/models/PreparationTask.js";
import { TASK_SOURCE } from "../src/config/taskSource.js";
import { syncPreparationTasks } from "../src/services/preparationTasks.js";

const run = async () => {
  await mongoose.connect(getMongoUri());

  // The unique (booking, key) index is what guarantees no duplicates.
  await PreparationTask.createIndexes();

  const bookings = await Booking.find({ coordinator: { $ne: null } });
  for (const booking of bookings) {
    await syncPreparationTasks(booking);
  }

  const generated = await PreparationTask.countDocuments({ source: TASK_SOURCE.SYSTEM });
  const legacy = await PreparationTask.countDocuments({ source: { $ne: TASK_SOURCE.SYSTEM } });
  console.log(`Bookings with a coordinator: ${bookings.length}`);
  console.log(`Generated tasks in total: ${generated}`);
  console.log(`Legacy manual tasks kept (non-blocking): ${legacy}`);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Migration failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
