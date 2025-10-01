import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import compression from "compression";

import connectDB from "./config/db.js";
import { notFound, errorHandler } from "./middlewares/errorMiddleware.js";
import rateLimiter from "./middlewares/rateLimit.js";

import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

dotenv.config();
const app = express();

// DB
await connectDB();

// Trust proxy for Railway/Proxies (important for rate limit & secure cookies if needed)
app.set("trust proxy", 1);

// Security & utils
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS (locked to frontend)
app.use(
  cors({
    origin: process.env.FRONTEND_URL?.split(",") || "*",
    credentials: true,
  })
);

// Global rate limit on write routes
app.use("/api", rateLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || "unknown" });
});

// 404 + Error handler
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT} (${process.env.NODE_ENV})`)
);
