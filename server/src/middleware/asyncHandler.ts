import type { Request, Response, NextFunction, RequestHandler } from "express";

export const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any> | any): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
