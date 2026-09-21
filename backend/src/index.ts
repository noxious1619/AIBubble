import "dotenv/config";
import express from "express";
import cors from "cors";
import adminController from "./controllers/admin.controller";
import clockController from "./controllers/clock.controller";
import analyticsController from "./controllers/analytics.controller";
import { initializeScheduler } from "./scheduler";

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

// Routes
app.use("/api/v1/admin", adminController);
app.use("/api/v1/clock", clockController);
app.use("/api/v1/analytics", analyticsController);

// TODO: other routes to be added in future slices (e.g., /api/v1/history)

// Initialize cron scheduler
initializeScheduler();

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`AI Doomsday Clock API running on port ${PORT}`);
  });
}

export default app;
