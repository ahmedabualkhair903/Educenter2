import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { attendanceService } from "../services/attendanceService.js";
import { attendanceRepository } from "../repositories/attendanceRepository.js";
import { AppError, sendSuccess } from "../utils/response.js";

export const attendanceController = {
  createSession(req: AuthRequest, res: Response) {
    const session = attendanceService.createSession(req.body, req.user?.id, req.ip);
    return sendSuccess(res, session, "تم فتح جلسة الحضور بنجاح", 201);
  },

  closeSession(req: AuthRequest, res: Response) {
    const session = attendanceService.closeSession(req.params.id, req.user?.id, req.ip);
    return sendSuccess(res, session, "تم إغلاق جلسة الحضور بنجاح");
  },

  listSessions(req: AuthRequest, res: Response) {
    const filters = {
      groupId: (req.query.groupId || req.query.group_id) as string | undefined,
      date: req.query.date as string | undefined,
      status: req.query.status as string | undefined,
    };
    const sessions = attendanceService.listSessions(filters);
    return sendSuccess(res, sessions);
  },

  listRecords(req: AuthRequest, res: Response) {
    const filters = {
      sessionId: (req.query.sessionId || req.query.session_id) as string | undefined,
      groupId: (req.query.groupId || req.query.group_id) as string | undefined,
      studentId: (req.query.studentId || req.query.student_id) as string | undefined,
      date: req.query.date as string | undefined,
      status: req.query.status as string | undefined,
    };
    const records = attendanceService.listRecords(filters);
    return sendSuccess(res, records);
  },

  getById(req: AuthRequest, res: Response) {
    const record = attendanceRepository.findRecordById(req.params.id);
    if (!record) throw new AppError("سجل الحضور غير موجود", 404, "RECORD_NOT_FOUND");
    return sendSuccess(res, record);
  },

  updateStatus(req: AuthRequest, res: Response) {
    const record = attendanceRepository.findRecordById(req.params.id);
    if (!record) throw new AppError("سجل الحضور غير موجود", 404, "RECORD_NOT_FOUND");
    attendanceRepository.updateRecord(req.params.id, { status: req.body.status, checkOutTime: req.body.checkOutTime });
    const updated = attendanceRepository.findRecordById(req.params.id);
    return sendSuccess(res, updated, "تم تحديث سجل الحضور");
  },

  deleteRecord(req: AuthRequest, res: Response) {
    const record = attendanceRepository.findRecordById(req.params.id);
    if (!record) throw new AppError("سجل الحضور غير موجود", 404, "RECORD_NOT_FOUND");
    attendanceRepository.deleteRecord(req.params.id);
    return sendSuccess(res, null, "تم حذف سجل الحضور");
  },

  listCheckouts(req: AuthRequest, res: Response) {
    const filters = {
      groupId: (req.query.groupId || req.query.group_id) as string | undefined,
      studentId: (req.query.studentId || req.query.student_id) as string | undefined,
      date: req.query.date as string | undefined,
    };
    const checkouts = attendanceRepository.listCheckouts(filters);
    return sendSuccess(res, checkouts);
  },

  getCheckoutById(req: AuthRequest, res: Response) {
    const record = attendanceRepository.findRecordById(req.params.id);
    if (!record || !record.checkedOutAt) {
      throw new AppError("سجل الخروج غير موجود", 404, "CHECKOUT_NOT_FOUND");
    }
    return sendSuccess(res, record);
  },

  updateCheckout(req: AuthRequest, res: Response) {
    const record = attendanceRepository.findRecordById(req.params.id);
    if (!record) throw new AppError("سجل الخروج غير موجود", 404, "CHECKOUT_NOT_FOUND");
    attendanceRepository.updateRecord(req.params.id, {
      checkOutTime: req.body.checkedOutAt || req.body.checkOutTime || record.checkedOutAt,
      status: req.body.status || record.status,
    });
    const updated = attendanceRepository.findRecordById(req.params.id);
    return sendSuccess(res, updated, "تم تحديث سجل الخروج");
  },

  deleteCheckout(req: AuthRequest, res: Response) {
    const record = attendanceRepository.findRecordById(req.params.id);
    if (!record) throw new AppError("سجل الخروج غير موجود", 404, "CHECKOUT_NOT_FOUND");
    attendanceRepository.updateRecord(req.params.id, { checkOutTime: null });
    return sendSuccess(res, null, "تم حذف سجل الخروج بنجاح");
  },

  checkOutRecord(req: AuthRequest, res: Response) {
    const record = attendanceRepository.findRecordById(req.params.id);
    if (!record) throw new AppError("سجل الحضور غير موجود", 404, "RECORD_NOT_FOUND");
    const checkOutTime = req.body.checkedOutAt || req.body.checkOutTime || new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
    attendanceRepository.updateRecord(req.params.id, { checkOutTime });
    const updated = attendanceRepository.findRecordById(req.params.id);
    return sendSuccess(res, updated, "تم تسجيل الخروج بنجاح");
  },

  async scan(req: AuthRequest, res: Response) {
    const result = await attendanceService.scanBarcodeOrQR(req.body, req.user?.id, req.ip);
    return sendSuccess(res, result, result.message);
  },

  recordManual(req: AuthRequest, res: Response) {
    const { sessionId, records } = req.body;
    attendanceService.recordManual(sessionId, records, req.user?.id, req.ip);
    return sendSuccess(res, null, "تم تسجيل الحضور اليدوي بنجاح");
  },

  listSuspicious(req: AuthRequest, res: Response) {
    const list = attendanceService.listSuspiciousCases();
    return sendSuccess(res, list);
  },

  createSuspicious(req: AuthRequest, res: Response) {
    const created = attendanceService.createSuspiciousCase(req.body);
    return sendSuccess(res, created, "تم تسجيل الحالة المشبوهة بنجاح", 201);
  },

  updateSuspicious(req: AuthRequest, res: Response) {
    const updated = attendanceService.updateSuspiciousCase(req.params.id, req.body);
    return sendSuccess(res, updated, "تم تحديث الحالة المشبوهة بنجاح");
  },
};
