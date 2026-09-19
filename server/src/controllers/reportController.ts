import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { reportService } from "../services/reportService.js";
import { sendSuccess } from "../utils/response.js";

export const reportController = {
  getDashboardStats(req: AuthRequest, res: Response) {
    const stats = reportService.getDashboardStats();
    return sendSuccess(res, stats);
  },

  getFinancialReport(req: AuthRequest, res: Response) {
    const filters = {
      startDate: (req.query.startDate || req.query.start_date) as string | undefined,
      endDate: (req.query.endDate || req.query.end_date) as string | undefined,
    };
    const report = reportService.getFinancialReport(filters);
    return sendSuccess(res, report);
  },

  getAttendanceReport(req: AuthRequest, res: Response) {
    const filters = {
      groupId: (req.query.groupId || req.query.group_id) as string | undefined,
      startDate: (req.query.startDate || req.query.start_date) as string | undefined,
      endDate: (req.query.endDate || req.query.end_date) as string | undefined,
    };
    const report = reportService.getAttendanceReport(filters);
    return sendSuccess(res, report);
  },
};
