import express from "express";
import cors from "cors";
import morgan from "morgan";

import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import testRoutes from "./routes/test.routes.js";
import hallRoutes from "./routes/hall.routes.js";
import packageRoutes from "./routes/package.routes.js";
import foodRoutes from "./routes/food.routes.js";
import decorationRoutes from "./routes/decoration.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import preparationTaskRoutes from "./routes/preparationTask.routes.js";
import issueRoutes from "./routes/issue.routes.js";
import reportRoutes from "./routes/report.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import galleryRoutes from "./routes/gallery.routes.js";
import suggestionRoutes from "./routes/suggestion.routes.js";
import uploadRoutes, { UPLOAD_DIR } from "./routes/upload.routes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
app.use("/api/halls", hallRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/foods", foodRoutes);
app.use("/api/decorations", decorationRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/tasks", preparationTaskRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/suggestions", suggestionRoutes);
app.use("/api/uploads", uploadRoutes);

// Uploaded hall/gallery photos (see routes/upload.routes.js).
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));

app.use(notFound);
app.use(errorHandler);

export default app;
