import { Router } from "express";
import { feeController } from "../controllers/feeController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { CreateFeeSchema } from "../validators/index.js";

import { requireFinance } from "../middleware/permissions.js";

const router = Router();

router.use(authenticate);

router.get("/", asyncHandler(feeController.list));
router.post("/", requireFinance, validateBody(CreateFeeSchema), asyncHandler(feeController.create));
router.get("/student/:studentId", asyncHandler(feeController.getStudentFinance));

export default router;
