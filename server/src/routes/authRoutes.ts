import { Router } from "express";
import { authController } from "../controllers/authController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { authLimiter, refreshLimiter, registerLimiter } from "../middleware/rateLimiter.js";
import { validateBody } from "../middleware/validate.js";
import { ChangePasswordSchema, LoginSchema, RegisterSchema } from "../validators/index.js";

const router = Router();

router.post("/register", registerLimiter, validateBody(RegisterSchema), asyncHandler(authController.register));
router.post("/login", authLimiter, validateBody(LoginSchema), asyncHandler(authController.login));
router.post("/refresh", refreshLimiter, asyncHandler(authController.refresh));
router.post("/logout", authenticate, asyncHandler(authController.logout));
router.get("/me", authenticate, asyncHandler(authController.me));
router.post("/change-password", authenticate, validateBody(ChangePasswordSchema), asyncHandler(authController.changePassword));

export default router;
