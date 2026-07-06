export type UserRole = 'owner' | 'employee';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';
export type SubscriptionPlan = 'starter' | 'pro';
export type CustomerType = 'appointment' | 'walkin';
export type AppointmentStatus = 'scheduled' | 'in_progress' | 'completed' | 'no_show' | 'cancelled';
export type CorrectionStatus = 'pending' | 'approved' | 'rejected';

export interface Salon {
  id: string;
  name: string;
  address: string;
  steuernummer: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  created_at: string;
}

export interface Profile {
  id: string;
  salon_id: string;
  full_name: string;
  role: UserRole;
  pin_hash: string | null;
  color: string;
  is_active: boolean;
  avatar_url: string | null;
  has_seen_onboarding: boolean;
  sofortmeldung_confirmed_at: string | null;
  sofortmeldung_reference: string | null;
  ausweis_acknowledged_at: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  salon_id: string;
  full_name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

export type BreakType = 'lunch' | 'coffee' | 'sick' | 'day_off';

export interface Break {
  id: string;
  profile_id: string;
  salon_id: string;
  break_type: BreakType;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface ServiceCategory {
  id: string;
  salon_id: string;
  name: string;
  color: string;
  is_active: boolean;
}

export interface Appointment {
  id: string;
  salon_id: string;
  assigned_to: string;
  client_name: string;
  service_category_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  customer_type: CustomerType;
  notes: string | null;
  status: AppointmentStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  // joined
  service_category?: ServiceCategory;
  assigned_profile?: Profile;
}

export interface GeneratedReport {
  id: string;
  salon_id: string;
  employee_id: string | null;
  generated_by: string | null;
  period_label: string;
  period_start: string;
  period_end: string;
  file_path: string;
  file_size_bytes: number | null;
  created_at: string;
  // joined
  employee?: Pick<Profile, 'full_name' | 'color'>;
}

export interface CorrectionRequest {
  id: string;
  appointment_id: string;
  requested_by: string;
  approved_by: string | null;
  original_data: Record<string, unknown>;
  requested_data: Record<string, unknown>;
  reason: string;
  status: CorrectionStatus;
  created_at: string;
  resolved_at: string | null;
  // joined
  appointment?: Appointment;
  requester?: Profile;
}
