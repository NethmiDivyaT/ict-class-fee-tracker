import "dotenv/config";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import {
  DatabaseConfigError,
  getStorageInfo,
  createClass,
  createStudent,
  deleteClass,
  deleteStudent,
  getAnnualAttendance,
  getAnnualStats,
  getClass,
  getClassAnnualStats,
  getClassHoliday,
  getClassMonthlyStats,
  getMonthlyIncomeForYear,
  getMonthlyStats,
  getStudentBilling,
  listClasses,
  listRecentPayments,
  listStudentsByClass,
  listStudentsForPeriod,
  markPaid,
  markUnpaid,
  setAttendance,
  setAttendanceByDate,
  setClassHoliday,
  updateClass,
  updateStudent,
  type ActionResult,
} from "@ict/core";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";

app.use(
  cors({
    origin: WEB_ORIGIN,
  }),
);
app.use(express.json());

const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

function sendResult(res: Response, result: ActionResult, successStatus = 200) {
  if (!result.ok) {
    const status = result.error.toLowerCase().includes("not found") ? 404 : 400;
    res.status(status).json(result);
    return;
  }
  res.status(successStatus).json(result);
}

function parsePositiveInt(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "ICT Class Fee Tracker API",
    web: WEB_ORIGIN,
    health: "/api/health",
    hint: `This is the backend. Open the app at ${WEB_ORIGIN}`,
  });
});

app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, ...(await getStorageInfo()) });
  }),
);

app.get(
  "/api/classes",
  asyncHandler(async (_req, res) => {
    res.json(await listClasses());
  }),
);

app.get(
  "/api/classes/:id",
  asyncHandler(async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ ok: false, error: "Invalid class." });
      return;
    }
    const cls = await getClass(id);
    if (!cls) {
      res.status(404).json({ ok: false, error: "Class not found." });
      return;
    }
    res.json(cls);
  }),
);

app.post(
  "/api/classes",
  asyncHandler(async (req, res) => {
    sendResult(res, await createClass(req.body), 201);
  }),
);

app.patch(
  "/api/classes/:id",
  asyncHandler(async (req, res) => {
    sendResult(res, await updateClass({ ...req.body, id: req.params.id }));
  }),
);

app.delete(
  "/api/classes/:id",
  asyncHandler(async (req, res) => {
    sendResult(res, await deleteClass(req.params.id));
  }),
);

app.get(
  "/api/classes/:id/students",
  asyncHandler(async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    const year = parsePositiveInt(req.query.year);
    const month = parsePositiveInt(req.query.month);
    const week = parsePositiveInt(req.query.week) ?? 0;
    if (!id || !year || !month) {
      res.status(400).json({
        ok: false,
        error: "class id, year, and month are required.",
      });
      return;
    }
    res.json(await listStudentsByClass(id, year, month, week));
  }),
);

app.post(
  "/api/classes/:id/students",
  asyncHandler(async (req, res) => {
    sendResult(
      res,
      await createStudent({ ...req.body, class_id: req.params.id }),
      201,
    );
  }),
);

app.patch(
  "/api/students/:id",
  asyncHandler(async (req, res) => {
    sendResult(res, await updateStudent({ ...req.body, id: req.params.id }));
  }),
);

app.get(
  "/api/students/:id/billing",
  asyncHandler(async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ ok: false, error: "Invalid student." });
      return;
    }
    res.json(await getStudentBilling(id));
  }),
);

app.put(
  "/api/attendance",
  asyncHandler(async (req, res) => {
    sendResult(res, await setAttendance(req.body));
  }),
);

app.put(
  "/api/attendance/bulk",
  asyncHandler(async (req, res) => {
    sendResult(res, await setAttendanceByDate(req.body));
  }),
);

app.get(
  "/api/classes/:id/holiday",
  asyncHandler(async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    const year = parsePositiveInt(req.query.year);
    const week = parsePositiveInt(req.query.week);
    if (!id || !year || !week) {
      res.status(400).json({ ok: false, error: "class id, year, and week are required." });
      return;
    }
    res.json((await getClassHoliday(id, year, week)) ?? null);
  }),
);

app.put(
  "/api/holidays",
  asyncHandler(async (req, res) => {
    sendResult(res, await setClassHoliday(req.body));
  }),
);

app.delete(
  "/api/students/:id",
  asyncHandler(async (req, res) => {
    sendResult(res, await deleteStudent(req.params.id));
  }),
);

app.get(
  "/api/records",
  asyncHandler(async (req, res) => {
    const year = parsePositiveInt(req.query.year);
    const month = parsePositiveInt(req.query.month);
    const week = parsePositiveInt(req.query.week) ?? 0;
    if (!year || !month) {
      res.status(400).json({ ok: false, error: "year and month are required." });
      return;
    }

    const classId = parsePositiveInt(req.query.classId);
    const status =
      req.query.status === "paid" || req.query.status === "unpaid"
        ? req.query.status
        : "all";
    const billingPeriod =
      req.query.billingPeriod === "weekly" || req.query.billingPeriod === "monthly"
        ? req.query.billingPeriod
        : undefined;

    res.json(
      await listStudentsForPeriod(year, month, week, {
        classId,
        status,
        billingPeriod,
      }),
    );
  }),
);

app.get(
  "/api/stats/monthly",
  asyncHandler(async (req, res) => {
    const year = parsePositiveInt(req.query.year);
    const month = parsePositiveInt(req.query.month);
    if (!year || !month) {
      res.status(400).json({ ok: false, error: "year and month are required." });
      return;
    }
    res.json(await getMonthlyStats(year, month));
  }),
);

app.get(
  "/api/stats/monthly/classes",
  asyncHandler(async (req, res) => {
    const year = parsePositiveInt(req.query.year);
    const month = parsePositiveInt(req.query.month);
    if (!year || !month) {
      res.status(400).json({ ok: false, error: "year and month are required." });
      return;
    }
    res.json(await getClassMonthlyStats(year, month));
  }),
);

app.get(
  "/api/stats/annual",
  asyncHandler(async (req, res) => {
    const year = parsePositiveInt(req.query.year);
    if (!year) {
      res.status(400).json({ ok: false, error: "year is required." });
      return;
    }
    res.json(await getAnnualStats(year));
  }),
);

app.get(
  "/api/stats/annual/months",
  asyncHandler(async (req, res) => {
    const year = parsePositiveInt(req.query.year);
    if (!year) {
      res.status(400).json({ ok: false, error: "year is required." });
      return;
    }
    res.json(await getMonthlyIncomeForYear(year));
  }),
);

app.get(
  "/api/stats/annual/classes",
  asyncHandler(async (req, res) => {
    const year = parsePositiveInt(req.query.year);
    if (!year) {
      res.status(400).json({ ok: false, error: "year is required." });
      return;
    }
    res.json(await getClassAnnualStats(year));
  }),
);

app.get(
  "/api/stats/annual/attendance",
  asyncHandler(async (req, res) => {
    const year = parsePositiveInt(req.query.year);
    if (!year) {
      res.status(400).json({ ok: false, error: "year is required." });
      return;
    }
    res.json(await getAnnualAttendance(year));
  }),
);

app.get(
  "/api/payments/recent",
  asyncHandler(async (req, res) => {
    const limit = parsePositiveInt(req.query.limit) ?? 8;
    res.json(await listRecentPayments(limit));
  }),
);

app.post(
  "/api/payments",
  asyncHandler(async (req, res) => {
    sendResult(res, await markPaid(req.body));
  }),
);

app.delete(
  "/api/payments",
  asyncHandler(async (req, res) => {
    sendResult(res, await markUnpaid(req.body));
  }),
);

app.use((req, res, next) => {
  if (res.headersSent) {
    next();
    return;
  }
  res.status(404).json({
    ok: false,
    error: `No route for ${req.method} ${req.path}`,
    hint: `This is the API. Open the app at ${WEB_ORIGIN}`,
  });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof DatabaseConfigError) {
    res.status(500).json({ ok: false, error: err.message });
    return;
  }
  if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status?: number }).status === 400
  ) {
    res.status(400).json({ ok: false, error: "Invalid JSON body." });
    return;
  }
  console.error(err);
  res.status(500).json({ ok: false, error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
