import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.middleware";
import * as jobPostsController from "./jobposts.controller";

const router = Router();

// All job-post routes are student-owned.
router.use(authenticate, requireRole("student"));

router.post("/", jobPostsController.create);
router.get("/mine", jobPostsController.listMine);

// Shortlist (declared before "/:id" sub-resources are fine — distinct paths)
router.get("/:id/shortlist", jobPostsController.getShortlist);
router.post("/:id/shortlist", jobPostsController.addToShortlist);
router.delete("/:id/shortlist/:quoteId", jobPostsController.removeFromShortlist);

// Lifecycle actions
router.post("/:id/cancel", jobPostsController.cancel);
router.post("/:id/close", jobPostsController.close);
router.post("/:id/repost", jobPostsController.repost);

// Detail (with embedded, anonymized quotes) — keep last so it doesn't shadow above
router.get("/:id", jobPostsController.getOne);

export default router;
