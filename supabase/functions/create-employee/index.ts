import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { full_name, pin, color, salon_id } = await req.json();

    if (!full_name || !pin || pin.length !== 4 || !salon_id) {
      return new Response(
        JSON.stringify({ error: 'full_name, 4-digit pin, and salon_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin client — service role bypasses RLS
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify the calling user is an owner of this salon
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

    if (callerProfile?.role !== 'owner' || callerProfile?.salon_id !== salon_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a Supabase Auth user for the employee.
    // Email is internal-only; employee never sees or types it.
    // We use a temporary UUID to build the email, then replace it with the real user id.
    const tempId = crypto.randomUUID();
    const email = `emp_${tempId}@swartschaf.internal`;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true, // skip email confirmation
    });

    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? 'Failed to create auth user' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update the email to use the real user id (so it's stable and recoverable)
    const realEmail = `emp_${created.user.id}@swartschaf.internal`;
    await admin.auth.admin.updateUserById(created.user.id, { email: realEmail });

    // Create the profile row
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .insert({
        id: created.user.id,
        salon_id,
        full_name,
        role: 'employee',
        pin_hash: pin,
        color: color ?? '#3498db',
        is_active: true,
      })
      .select()
      .single();

    if (profileErr) {
      // Roll back the auth user
      await admin.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ profile }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
