import { Router } from "express";
import { settingsController } from "../controllers/settingsController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/permissions.js";

import { validateBody } from "../middleware/validate.js";
import { UpdateSettingsSchema } from "../validators/index.js";

const router = Router();

router.use(authenticate);

router.get("/", asyncHandler(settingsController.get));
router.put("/", requireAdmin, validateBody(UpdateSettingsSchema), asyncHandler(settingsController.update));
router.get("/rooms", asyncHandler(settingsController.getRooms));
router.post("/rooms", requireAdmin, asyncHandler(settingsController.addRoom));
router.get("/subjects", asyncHandler(settingsController.getSubjects));
router.post("/subjects", requireAdmin, asyncHandler(settingsController.addSubject));

export default router;
