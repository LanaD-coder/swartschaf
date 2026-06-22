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
