import { Router, type IRouter } from "express";
import healthRouter from "./health";
import simplexRouter from "./simplex";
import problemsRouter from "./problems";
import templatesRouter from "./templates";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/simplex", simplexRouter);
router.use("/problems", problemsRouter);
router.use("/templates", templatesRouter);

export default router;
