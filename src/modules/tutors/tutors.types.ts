export interface TutorProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  tagline: string | null;
  hourly_rate_min: string | null;
  hourly_rate_max: string | null;
  currency: string;
  years_of_experience: number | null;
  specialisations: string[];
  student_age_groups: string[];
  location_postcode: string | null;
  location_district: string | null;
  location_country: string | null;
  teaches_online: boolean;
  teaches_in_person: boolean;
  profile_completion_pct: number;
  is_live: boolean;
  is_identity_verified: boolean;
  is_accelerator_subscriber: boolean;
  accelerator_expires_at: Date | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  overall_rating: string;
  total_reviews: number;
  retention_score_pct: string;
  lessons_taught_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface TutorLanguage {
  id: string;
  tutor_id: string;
  language_code: string;
  language_name: string;
  dialect: string | null;
  status: "L1" | "L2";
  is_primary: boolean;
  created_at: Date;
}

export interface TutorCredential {
  id: string;
  tutor_id: string;
  credential_type: string | null;
  title: string | null;
  institution: string | null;
  issued_year: number | null;
  file_url: string | null;
  is_verified: boolean;
  verified_at: Date | null;
  verified_by: string | null;
  created_at: Date;
}

export interface TutorProfileUpdate {
  first_name?: string;
  last_name?: string;
  display_name?: string;
  bio?: string;
  tagline?: string;
  hourly_rate_min?: number;
  hourly_rate_max?: number;
  years_of_experience?: number;
  specialisations?: string[];
  student_age_groups?: string[];
  location_postcode?: string;
  location_district?: string;
  location_country?: string;
  teaches_online?: boolean;
  teaches_in_person?: boolean;
}

// Public search filters — names mirror API.md §5 GET /tutors query params.
export interface TutorSearchFilters {
  language?: string;
  level?: string;
  minRate?: number;
  maxRate?: number;
  online?: boolean;
  inPerson?: boolean;
  rating?: number;
  q?: string;
  sort: "rating" | "newest" | "rate_asc" | "rate_desc";
  page: number;
  limit: number;
}
