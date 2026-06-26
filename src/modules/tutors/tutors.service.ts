import { v4 as uuidv4 } from "uuid";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import db from "../../config/database";
import {
  s3,
  S3_PRIVATE_BUCKET,
  S3_PUBLIC_BUCKET,
  buildPrivateFileUrl,
} from "../../config/s3";
import {
  TutorProfile,
  TutorLanguage,
  TutorCredential,
  TutorProfileUpdate,
  TutorSearchFilters,
} from "./tutors.types";

export const getTutorByUserId = async (
  userId: string,
): Promise<TutorProfile | undefined> => {
  return db<TutorProfile>("tutor_profiles").where({ user_id: userId }).first();
};

export const getTutorById = async (
  tutorId: string,
): Promise<TutorProfile | undefined> => {
  return db<TutorProfile>("tutor_profiles").where({ id: tutorId }).first();
};

export const getTutorLanguages = async (
  tutorId: string,
): Promise<TutorLanguage[]> => {
  return db<TutorLanguage>("tutor_languages")
    .where({ tutor_id: tutorId })
    .orderBy("is_primary", "desc")
    .orderBy("created_at", "asc");
};

export const getTutorCredentials = async (
  tutorId: string,
  onlyVerified = false,
): Promise<TutorCredential[]> => {
  const query = db<TutorCredential>("tutor_credentials").where({
    tutor_id: tutorId,
  });
  if (onlyVerified) query.andWhere({ is_verified: true });
  return query.orderBy("created_at", "desc");
};

// Pure profile-completion rule (API.md §3) — gates go-live at ≥40%. Kept
// IO-free so it's testable without a DB (see src/checks.ts).
export const profileCompletionPoints = (
  tutor: Partial<TutorProfile>,
  languageCount: number,
  credentialCount: number,
): number => {
  let pct = 20; // base
  if (tutor.display_name) pct += 5;
  if (tutor.tagline) pct += 5;
  if (tutor.bio) pct += 10;
  if (tutor.avatar_url) pct += 10;
  if (
    tutor.hourly_rate_min !== null &&
    tutor.hourly_rate_min !== undefined &&
    tutor.hourly_rate_max !== null &&
    tutor.hourly_rate_max !== undefined
  )
    pct += 10;
  if (tutor.specialisations && tutor.specialisations.length > 0) pct += 5;
  if (tutor.is_identity_verified) pct += 10;
  if (languageCount > 0) pct += 10;
  if (credentialCount > 0) pct += 15;
  return Math.min(100, pct);
};

// Recompute on every profile/language/credential mutation.
export const calculateCompletionPct = async (
  tutorId: string,
): Promise<number> => {
  const tutor = await db<TutorProfile>("tutor_profiles")
    .where({ id: tutorId })
    .first();
  if (!tutor) return 0;

  const [langCount] = await db("tutor_languages")
    .where({ tutor_id: tutorId })
    .count<{ count: string }[]>("id as count");
  const [credCount] = await db("tutor_credentials")
    .where({ tutor_id: tutorId })
    .count<{ count: string }[]>("id as count");

  return profileCompletionPoints(
    tutor,
    Number(langCount.count),
    Number(credCount.count),
  );
};

export const recalculateAndSaveCompletion = async (
  tutorId: string,
): Promise<number> => {
  const pct = await calculateCompletionPct(tutorId);
  await db("tutor_profiles")
    .where({ id: tutorId })
    .update({ profile_completion_pct: pct, updated_at: new Date() });
  return pct;
};

export const updateTutorProfile = async (
  tutorId: string,
  patch: TutorProfileUpdate,
): Promise<TutorProfile> => {
  const [updated] = await db<TutorProfile>("tutor_profiles")
    .where({ id: tutorId })
    .update({ ...patch, updated_at: new Date() } as any)
    .returning("*");
  return updated;
};

export const setLive = async (
  tutorId: string,
  isLive: boolean,
): Promise<TutorProfile> => {
  const [updated] = await db<TutorProfile>("tutor_profiles")
    .where({ id: tutorId })
    .update({ is_live: isLive, updated_at: new Date() })
    .returning("*");
  return updated;
};

export const findDuplicateLanguage = async (
  tutorId: string,
  languageCode: string,
): Promise<TutorLanguage | undefined> => {
  return db<TutorLanguage>("tutor_languages")
    .where({ tutor_id: tutorId, language_code: languageCode })
    .first();
};

export const addLanguage = async (
  tutorId: string,
  input: {
    language_code: string;
    language_name: string;
    dialect?: string;
    status: "L1" | "L2";
    is_primary: boolean;
  },
): Promise<TutorLanguage> => {
  return db.transaction(async (trx) => {
    if (input.is_primary) {
      await trx("tutor_languages")
        .where({ tutor_id: tutorId })
        .update({ is_primary: false });
    }
    const [row] = await trx<TutorLanguage>("tutor_languages")
      .insert({
        tutor_id: tutorId,
        language_code: input.language_code,
        language_name: input.language_name,
        dialect: input.dialect ?? null,
        status: input.status,
        is_primary: input.is_primary,
      })
      .returning("*");
    return row;
  });
};

export const getLanguageById = async (
  languageId: string,
): Promise<TutorLanguage | undefined> => {
  return db<TutorLanguage>("tutor_languages").where({ id: languageId }).first();
};

export const deleteLanguage = async (languageId: string): Promise<void> => {
  await db("tutor_languages").where({ id: languageId }).del();
};

export const createCredential = async (
  tutorId: string,
  input: {
    credential_type: string;
    title: string;
    institution?: string;
    issued_year?: number;
    file_url: string;
  },
): Promise<TutorCredential> => {
  const [row] = await db<TutorCredential>("tutor_credentials")
    .insert({
      tutor_id: tutorId,
      credential_type: input.credential_type,
      title: input.title,
      institution: input.institution ?? null,
      issued_year: input.issued_year ?? null,
      file_url: input.file_url,
    })
    .returning("*");
  return row;
};

export const getCredentialById = async (
  credentialId: string,
): Promise<TutorCredential | undefined> => {
  return db<TutorCredential>("tutor_credentials")
    .where({ id: credentialId })
    .first();
};

export const generateCredentialUploadUrl = async (
  tutorId: string,
  filename: string,
  contentType: string,
): Promise<{ upload_url: string; s3_key: string; file_url: string }> => {
  const s3_key = `credentials/${tutorId}/${uuidv4()}-${filename}`;
  const command = new PutObjectCommand({
    Bucket: S3_PRIVATE_BUCKET,
    Key: s3_key,
    ContentType: contentType,
  });
  const upload_url = await getSignedUrl(s3, command, { expiresIn: 900 });
  return {
    upload_url,
    s3_key,
    file_url: buildPrivateFileUrl(s3_key),
  };
};

export const generateCredentialViewUrl = async (
  fileUrl: string,
): Promise<string> => {
  const prefix = `https://${S3_PRIVATE_BUCKET}.s3.`;
  let key = fileUrl;
  if (fileUrl.startsWith(prefix)) {
    const idx = fileUrl.indexOf("/", prefix.length);
    key = fileUrl.substring(idx + 1);
  }
  const command = new GetObjectCommand({
    Bucket: S3_PRIVATE_BUCKET,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
};

export const generateAvatarUploadUrl = async (
  ownerType: "students" | "tutors",
  ownerId: string,
  filename: string,
  contentType: string,
): Promise<{ upload_url: string; file_url: string }> => {
  const s3_key = `avatars/${ownerType}/${ownerId}/${uuidv4()}-${filename}`;
  const command = new PutObjectCommand({
    Bucket: S3_PUBLIC_BUCKET,
    Key: s3_key,
    ContentType: contentType,
  });
  const upload_url = await getSignedUrl(s3, command, { expiresIn: 900 });
  const file_url = `https://${S3_PUBLIC_BUCKET}.s3.${process.env.AWS_REGION || "eu-west-1"}.amazonaws.com/${s3_key}`;
  return { upload_url, file_url };
};

// PG returns decimals as strings; API.md wants numbers. Coerce the numeric
// fields on the way out so the frontend (which never transforms) gets numbers.
const NUMERIC_FIELDS = [
  "hourly_rate_min",
  "hourly_rate_max",
  "overall_rating",
  "retention_score_pct",
];
export const serializeTutor = <T extends Record<string, any>>(row: T): T => {
  const out: any = { ...row };
  for (const f of NUMERIC_FIELDS) {
    if (out[f] !== null && out[f] !== undefined) out[f] = Number(out[f]);
  }
  return out;
};

// Public card columns — display_name only, never first/last name (§12 double-blind).
const PUBLIC_COLUMNS = [
  "id",
  "display_name",
  "avatar_url",
  "bio",
  "tagline",
  "hourly_rate_min",
  "hourly_rate_max",
  "currency",
  "years_of_experience",
  "specialisations",
  "student_age_groups",
  "location_district",
  "location_country",
  "teaches_online",
  "teaches_in_person",
  "is_identity_verified",
  "is_accelerator_subscriber",
  "overall_rating",
  "total_reviews",
  "retention_score_pct",
  "lessons_taught_count",
];

export const searchTutors = async (
  filters: TutorSearchFilters,
): Promise<{ data: any[]; total: number; page: number; limit: number }> => {
  const offset = (filters.page - 1) * filters.limit;

  const base = db("tutor_profiles as t").where("t.is_live", true);

  if (filters.online !== undefined) base.andWhere("t.teaches_online", filters.online);
  if (filters.inPerson !== undefined) base.andWhere("t.teaches_in_person", filters.inPerson);
  if (filters.minRate !== undefined) base.andWhere("t.hourly_rate_min", ">=", filters.minRate);
  if (filters.maxRate !== undefined) {
    base.andWhere(function () {
      this.where("t.hourly_rate_max", "<=", filters.maxRate as number).orWhereNull(
        "t.hourly_rate_max",
      );
    });
  }
  if (filters.rating !== undefined) base.andWhere("t.overall_rating", ">=", filters.rating);
  if (filters.q) {
    const like = `%${filters.q}%`;
    base.andWhere(function () {
      this.whereILike("t.display_name", like)
        .orWhereILike("t.bio", like)
        .orWhereILike("t.tagline", like);
    });
  }
  if (filters.language) {
    base
      .innerJoin("tutor_languages as tl", "tl.tutor_id", "t.id")
      .andWhere("tl.language_code", filters.language);
  }
  // ponytail: `level` is a student-side attribute with no tutor column — accept and ignore.

  const totalRow = await base
    .clone()
    .clearSelect()
    .countDistinct<{ count: string }[]>("t.id as count")
    .first();
  const total = Number(totalRow?.count ?? 0);

  const query = base
    .clone()
    .select(PUBLIC_COLUMNS.map((c) => `t.${c}`))
    .groupBy("t.id")
    .limit(filters.limit)
    .offset(offset);

  switch (filters.sort) {
    case "newest":
      query.orderBy("t.created_at", "desc");
      break;
    case "rate_asc":
      query.orderBy("t.hourly_rate_min", "asc");
      break;
    case "rate_desc":
      query.orderBy("t.hourly_rate_min", "desc");
      break;
    default:
      query.orderBy("t.overall_rating", "desc");
  }

  const rows = await query;
  return { data: rows.map(serializeTutor), total, page: filters.page, limit: filters.limit };
};

export const getPublicProfile = async (tutorId: string): Promise<any | null> => {
  const tutor = await db("tutor_profiles")
    .where({ id: tutorId, is_live: true })
    .select(PUBLIC_COLUMNS)
    .first();
  if (!tutor) return null;

  const languages = await getTutorLanguages(tutorId);
  const credentials = await getTutorCredentials(tutorId, true);

  return { ...serializeTutor(tutor), languages, credentials };
};
