import { Router } from "express";
import { expenseController } from "../controllers/expenseController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin, requireFinance } from "../middleware/permissions.js";
import { validateBody } from "../middleware/validate.js";
import { CreateExpenseSchema } from "../validators/index.js";

const router = Router();

router.use(authenticate);

router.get("/", asyncHandler(expenseController.list));
router.get("/:id", asyncHandler(expenseController.getById));
// Finance write — consistent with payments/fees which require requireFinance.
// Employees (reception) remain allowed; only non-finance roles are blocked.
router.post("/", requireFinance, validateBody(CreateExpenseSchema), asyncHandler(expenseController.create));
router.delete("/:id", requireAdmin, asyncHandler(expenseController.delete));

export default router;
