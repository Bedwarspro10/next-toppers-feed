import { Router, type IRouter } from "express";
import healthRouter from "./health";
import youtubeRouter from "./youtube";
import contactRouter from "./contact";

const router: IRouter = Router();

router.use(healthRouter);
router.use(youtubeRouter);
router.use(contactRouter);

export default router;
