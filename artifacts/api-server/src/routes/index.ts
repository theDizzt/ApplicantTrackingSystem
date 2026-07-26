import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import subscriptionRouter from "./subscription";
import companiesRouter from "./companies";
import resumesRouter from "./resumes";
import analysesRouter from "./analyses";
import resumeUploadRouter from "./resume-upload";
import interviewsRouter from "./interviews";
import dashboardRouter from "./dashboard";
import spellcheckRouter from "./spellcheck";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(subscriptionRouter);
router.use(companiesRouter);
router.use(resumesRouter);
router.use(resumeUploadRouter);
router.use(analysesRouter);
router.use(interviewsRouter);
router.use(dashboardRouter);
router.use(spellcheckRouter);
router.use(adminRouter);

export default router;
