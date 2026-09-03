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
  salon_code: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  trial_ends_at: string;
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

export interface Service {
  id: string;
  salon_id: string;
  service_category_id: string | null;
  name: string;          // e.g. "Schneiden Kurz Damen"
  price: number;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
  // joined
  service_category?: ServiceCategory;
}

export interface Appointment {
  id: string;
  salon_id: string;
  assigned_to: string;
  client_name: string;
  service_category_id: string | null;
  service_category_ids: string[]; // multi-select of service_categories for one visit (e.g. cut + color)
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

export interface AppointmentService {
  id: string;
  appointment_id: string;
  service_id: string;
  created_at: string;
  // joined
  service?: Service;
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

export interface EmployeeWorkingHours {
  id: string;
  profile_id: string;
  salon_id: string;
  weekday: number; // 0 = Sunday
  start_time: string; // 'HH:MM:SS'
  end_time: string;
  created_at: string;
}

export type InventoryUnit = 'ml' | 'g' | 'piece';

export interface InventoryItem {
  id: string;
  salon_id: string;
  product_code: string | null;
  name: string;
  brand: string | null;
  unit: InventoryUnit;       // unit that total_qty is measured in (size of one fresh gebinde)
  total_qty: number | null;  // size of one fresh gebinde, e.g. 500
  portions_per_unit: number | null; // how many service portions one gebinde yields
  purchase_price: number | null;    // cost of one gebinde
  portion_price: number | null;     // price charged to the client per portion used
  stock_quantity: number;    // current stock in PORTIONS remaining — not raw ml/g, not whole gebinde
  low_stock_threshold: number | null; // in portions
  created_at: string;
}

export interface ServiceRecipe {
  id: string;
  salon_id: string;
  service_id: string; // the specific priced service this recipe applies to (not the broad category)
  inventory_item_id: string;
  portions_per_use: number;
  created_at: string;
  // joined
  inventory_item?: InventoryItem;
}

export interface AppointmentMaterialUsage {
  id: string;
  appointment_id: string;
  inventory_item_id: string;
  portions_used: number;
  portion_price: number | null; // snapshot at time of use
  created_at: string;
  // joined
  inventory_item?: InventoryItem;
}

export type SourcingType = 'in_house' | 'dropship';

export interface Product {
  id: string;
  salon_id: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  category: string | null;
  image_url: string | null;
  sourcing_type: SourcingType;
  created_at: string;
}

export interface AppointmentProduct {
  id: string;
  appointment_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  // joined
  product?: Product;
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
