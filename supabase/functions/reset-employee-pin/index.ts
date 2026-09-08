import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Owner-initiated PIN reset (e.g. an employee forgot theirs). Distinct from the
// employee's own self-reset (app/reset-pin.tsx, a direct client-side update) because
// this writes to a DIFFERENT user's pin_hash and Auth password — the
// prevent_profile_privilege_escalation trigger only allows a user to change their
// OWN pin_hash, so this has to go through service role, same shape as create-employee.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { employee_id, new_pin } = await req.json();

    if (!employee_id || !new_pin || new_pin.length !== 6) {
      return new Response(
        JSON.stringify({ error: 'employee_id and a 6-digit new_pin are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify the calling user is an owner, and the target is an employee in their salon.
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await admin.auth.getUser(jwt!);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role, salon_id')
      .eq('id', user.id)
      .single();

    if (callerProfile?.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: targetProfile } = await admin
      .from('profiles')
      .select('id, salon_id, role')
      .eq('id', employee_id)
      .single();

    if (!targetProfile || targetProfile.salon_id !== callerProfile.salon_id || targetProfile.role !== 'employee') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Auth password (what signInWithPassword checks) — Admin API, service role only.
    const { error: authUpdateErr } = await admin.auth.admin.updateUserById(employee_id, {
      password: new_pin,
    });
    if (authUpdateErr) {
      return new Response(JSON.stringify({ error: authUpdateErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. profiles.pin_hash (what verify_employee_pin checks pre-auth) + force a
    // fresh mandatory reset on their next login, same as a brand-new employee.
    const { error: profileErr } = await admin
      .from('profiles')
      .update({ pin_hash: new_pin, must_reset_pin: true })
      .eq('id', employee_id);

    if (profileErr) {
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
