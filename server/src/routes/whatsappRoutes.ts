import { Router } from "express";
import { whatsappAccountController } from "../controllers/whatsappAccountController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/permissions.js";
import { validateBody } from "../middleware/validate.js";
import {
  CreateWhatsAppAccountSchema,
  TestWhatsAppAccountSchema,
  UpdateWhatsAppAccountSchema,
} from "../validators/index.js";

const router = Router();

router.use(authenticate);

// Account metadata (phone numbers, gateway URLs) is sensitive — reads use the
// same admin gate as writes. Tokens themselves are already masked in responses.
router.get("/accounts", requireAdmin, asyncHandler(whatsappAccountController.list));
router.post("/accounts", requireAdmin, validateBody(CreateWhatsAppAccountSchema), asyncHandler(whatsappAccountController.create));
router.get("/accounts/:id", requireAdmin, asyncHandler(whatsappAccountController.getById));
router.put("/accounts/:id", requireAdmin, validateBody(UpdateWhatsAppAccountSchema), asyncHandler(whatsappAccountController.update));
router.delete("/accounts/:id", requireAdmin, asyncHandler(whatsappAccountController.delete));
router.post("/accounts/:id/set-default", requireAdmin, asyncHandler(whatsappAccountController.setDefault));
router.post("/accounts/:id/test", requireAdmin, validateBody(TestWhatsAppAccountSchema), asyncHandler(whatsappAccountController.test));

export default router;
