import express from "express";
import { placeOrder, listOrders, updateOrderStatus, deleteOrder } from "../controllers/orderController.js";
import { protectAdmin } from "../middlewares/authMiddleware.js";
import { downloadReceipt } from "../controllers/orderController.js";

const router = express.Router();

// Public: place order (no customer login)
router.post("/", placeOrder);
router.get("/:id/receipt", protectAdmin, downloadReceipt);
// Admin
router.get("/", protectAdmin, listOrders);
router.put("/:id/status", protectAdmin, updateOrderStatus);
router.delete("/:id", protectAdmin, deleteOrder); 

export default router;
