import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import subscriptionRouter from "./subscription";
import companiesRouter from "./companies";
import companyPostingRouter from "./company-posting";
import resumesRouter from "./resumes";
import profileItemsRouter from "./profile-items";
import analysesRouter from "./analyses";
import careerAnalysisRouter from "./career-analysis";
import resumeUploadRouter from "./resume-upload";
import interviewsRouter from "./interviews";
import dashboardRouter from "./dashboard";
import spellcheckRouter from "./spellcheck";
import adminRouter from "./admin";
import coverLetterRouter from "./cover-letter";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(subscriptionRouter);
router.use(companiesRouter);
router.use(companyPostingRouter);
router.use(resumesRouter);
router.use(profileItemsRouter);
router.use(resumeUploadRouter);
router.use(analysesRouter);
router.use(careerAnalysisRouter);
router.use(interviewsRouter);
router.use(dashboardRouter);
router.use(spellcheckRouter);
router.use(adminRouter);
router.use(coverLetterRouter);

export default router;
