import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.middleware";
import * as quotes from "./quotes.controller";

const router = Router();

router.get("/templates", authenticate, quotes.listTemplates);
router.post("/templates", authenticate, quotes.createTemplate);

router.post("/", authenticate, requireRole("tutor"), quotes.create);
router.get("/mine", authenticate, requireRole("tutor"), quotes.mine);

export default router;
