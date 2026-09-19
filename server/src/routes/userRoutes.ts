import { Router } from "express";
import { userController } from "../controllers/userController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/permissions.js";
import { validateBody } from "../middleware/validate.js";
import { CreateUserSchema, ResetPasswordSchema, UpdateUserSchema } from "../validators/index.js";

const router = Router();

router.use(authenticate, requireAdmin);

router.get("/", asyncHandler(userController.list));
router.post("/", validateBody(CreateUserSchema), asyncHandler(userController.create));
router.put("/:id", validateBody(UpdateUserSchema), asyncHandler(userController.update));
router.patch("/:id/disable", asyncHandler(userController.disable));
router.post("/:id/reset-password", validateBody(ResetPasswordSchema), asyncHandler(userController.resetPassword));

export default router;
