import { Router } from "express";
import { studentController } from "../controllers/studentController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/permissions.js";
import { validateBody } from "../middleware/validate.js";
import { CreateStudentSchema, CustomFieldDefinitionSchema, QuickRegisterSchema, UpdateStudentSchema } from "../validators/index.js";

const router = Router();

router.use(authenticate);

// Fast search & duplicates
router.get("/search", asyncHandler(studentController.searchFast));
router.get("/check-duplicates", asyncHandler(studentController.checkDuplicates));

// Custom fields
router.get("/custom-fields", asyncHandler(studentController.listCustomFields));
router.post("/custom-fields", requireAdmin, validateBody(CustomFieldDefinitionSchema), asyncHandler(studentController.createCustomField));
router.delete("/custom-fields/:id", requireAdmin, asyncHandler(studentController.deleteCustomField));

// Quick Register for reception desk
router.post("/quick-register", validateBody(QuickRegisterSchema), asyncHandler(studentController.quickRegister));

// Student CRUD
router.get("/", asyncHandler(studentController.list));
router.get("/barcode/:code", asyncHandler(studentController.getByBarcode));
router.get("/:id", asyncHandler(studentController.getById));
router.get("/:id/card", asyncHandler(studentController.getCard));
router.post("/", validateBody(CreateStudentSchema), asyncHandler(studentController.create));
router.put("/:id", validateBody(UpdateStudentSchema), asyncHandler(studentController.update));
router.delete("/:id", requireAdmin, asyncHandler(studentController.delete));

export default router;
