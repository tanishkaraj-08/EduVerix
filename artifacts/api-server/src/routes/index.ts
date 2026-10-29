import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionRouter from "./session";
import dashboardRouter from "./dashboard";
import institutionsRouter from "./institutions";
import fdrsRouter from "./fdrs";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sessionRouter);
router.use(dashboardRouter);
router.use(institutionsRouter);
router.use(fdrsRouter);
router.use(adminRouter);

export default router;
