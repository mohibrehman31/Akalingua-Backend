export interface StudentProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
  location_postcode: string | null;
  location_district: string | null;
  location_country: string | null;
  is_premium: boolean;
  premium_expires_at: Date | null;
  extra_slots_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface JobPost {
  id: string;
  student_id: string;
  post_type: "broadcast" | "individual";
  status: "open" | "shortlisting" | "closed" | "completed" | "cancelled";
  target_language_code: string;
  target_language_name: string;
  dialect_preference: string | null;
  current_level: "newbie" | "elementary" | "intermediate" | "advanced";
  skill_gaps: string[];
  objective: "relocation" | "business" | "exam_prep" | "academic" | "personal";
  exam_target: string | null;
  frequency: "casual" | "standard" | "intensive";
  duration: "sprint" | "season" | "marathon";
  delivery_mode: "online" | "in_person" | "flexible";
  location_postcode: string | null;
  location_district: string | null;
  native_speaker_required: boolean;
  budget_min: string | null;
  budget_max: string | null;
  additional_notes: string | null;
  shortlist_capacity: number;
  shortlist_count: number;
  quote_count: number;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface StudentProfileUpdate {
  first_name?: string;
  last_name?: string;
  display_name?: string | null;
  avatar_url?: string | null;
  location_postcode?: string | null;
  location_district?: string | null;
  location_country?: string | null;
}

export interface JobPostCreate {
  post_type: "broadcast" | "individual";
  target_language_code: string;
  target_language_name: string;
  dialect_preference?: string | null;
  current_level: "newbie" | "elementary" | "intermediate" | "advanced";
  skill_gaps?: string[] | null;
  objective: "relocation" | "business" | "exam_prep" | "academic" | "personal";
  exam_target?: string | null;
  frequency: "casual" | "standard" | "intensive";
  duration: "sprint" | "season" | "marathon";
  delivery_mode: "online" | "in_person" | "flexible";
  location_postcode?: string | null;
  location_district?: string | null;
  native_speaker_required?: boolean | null;
  budget_min?: number | null;
  budget_max?: number | null;
  additional_notes?: string | null;
}
