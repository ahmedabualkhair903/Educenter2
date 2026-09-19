import { Router } from "express";
import { paymentController } from "../controllers/paymentController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { CreatePaymentSchema } from "../validators/index.js";

import { requireFinance } from "../middleware/permissions.js";

const router = Router();

router.use(authenticate);

router.get("/", asyncHandler(paymentController.list));
router.post("/", requireFinance, validateBody(CreatePaymentSchema), asyncHandler(paymentController.create));
router.put("/:id", requireFinance, asyncHandler(paymentController.update));
router.delete("/:id", requireFinance, asyncHandler(paymentController.delete));

export default router;
