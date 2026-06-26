import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.middleware";
import * as tutorController from "./tutors.controller";

const router = Router();
const tutor = [authenticate, requireRole("tutor")] as const;

// Public search (paginated, limit=12) — keep before "/:tutorId".
router.get("/", tutorController.search);

// Authenticated tutor — own profile (static "/me" segment before "/:tutorId").
router.get("/me", ...tutor, tutorController.getMyProfile);
router.patch("/me", ...tutor, tutorController.updateMyProfile);
router.post("/me/go-live", ...tutor, tutorController.goLive);
router.post("/me/go-offline", ...tutor, tutorController.goOffline);

router.get("/me/languages", ...tutor, tutorController.listLanguages);
router.post("/me/languages", ...tutor, tutorController.addLanguage);
router.delete("/me/languages/:id", ...tutor, tutorController.deleteLanguage);

router.get("/me/credentials", ...tutor, tutorController.listCredentials);
router.post("/me/credentials/upload-url", ...tutor, tutorController.getCredentialUploadUrl);
router.post("/me/credentials", ...tutor, tutorController.createCredential);

// Public, anonymized tutor card (display_name only).
router.get("/:tutorId", tutorController.getPublic);

export default router;
