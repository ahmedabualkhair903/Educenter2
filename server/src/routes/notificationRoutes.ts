import { Router } from "express";
import { notificationController } from "../controllers/notificationController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { CreateNotificationSchema, UpdateNotificationSchema } from "../validators/index.js";

const router = Router();

router.use(authenticate);

router.get("/", asyncHandler(notificationController.list));
// مسارات اسمية محددة قبل ‎/:id‎ حتى لا يبتلعها (‎/provider-status‎ كان يرجع 404)
router.get("/provider-status", asyncHandler(notificationController.getProviderStatus));
router.get("/:id", asyncHandler(notificationController.getById));
router.post("/", validateBody(CreateNotificationSchema), asyncHandler(notificationController.create));
router.put("/:id", validateBody(UpdateNotificationSchema), asyncHandler(notificationController.update));
// توافق خلفي: الواجهة تستخدم PATCH للتحديث
router.patch("/:id", validateBody(UpdateNotificationSchema), asyncHandler(notificationController.update));
router.delete("/:id", asyncHandler(notificationController.delete));
router.post("/retry", asyncHandler(notificationController.retry));
router.post("/fee-reminders", asyncHandler(notificationController.sendFeeReminders));
router.post("/test-send", asyncHandler(notificationController.testSend));
router.get("/provider-status", asyncHandler(notificationController.getProviderStatus));

export default router;
