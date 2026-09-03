import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// "Fernando" — real model call. Suggests a reorder quantity (in Gebinde) per
// low-stock item, using recent consumption (appointment_material_usage) as
// signal, not just the static threshold. Falls back to a deterministic
// "1 Gebinde" suggestion per item if the model call fails or returns
// something that doesn't parse — Fernando should never leave the owner with
// nothing just because Groq had a bad day.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let salon_id: string | undefined;
  try {
    ({ salon_id } = await req.json());
    if (!salon_id) {
      return new Response(JSON.stringify({ error: 'salon_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify the caller is the owner of this salon (same pattern as create-employee)
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

    // Low-stock items for this salon
    const { data: items } = await admin
      .from('inventory_items')
      .select('id, name, brand, portions_per_unit, purchase_price, stock_quantity, low_stock_threshold')
      .eq('salon_id', salon_id);

    const lowStock = (items ?? []).filter(
      (i) => i.low_stock_threshold != null && i.stock_quantity <= i.low_stock_threshold
    );

    if (lowStock.length === 0) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Recent consumption per item (last 30 days) as signal for the model —
    // this is what makes the suggestion better than a flat "1 Gebinde".
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: usage } = await admin
      .from('appointment_material_usage')
      .select('inventory_item_id, portions_used, created_at')
      .in('inventory_item_id', lowStock.map((i) => i.id))
      .gte('created_at', thirtyDaysAgo);

    const usageByItem: Record<string, number> = {};
    for (const u of usage ?? []) {
      usageByItem[u.inventory_item_id] = (usageByItem[u.inventory_item_id] ?? 0) + Number(u.portions_used);
    }

    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) {
      // No key configured — deterministic fallback, not an error.
      return new Response(JSON.stringify({
        suggestions: lowStock.map((i) => ({
          item_id: i.id,
          suggested_gebinde: i.portions_per_unit ? 1 : null,
          reasoning_de: 'Regelbasiert: unter Mindestmenge (kein KI-Modell konfiguriert).',
        })),
        ai_powered: false,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const promptItems = lowStock.map((i) => ({
      item_id: i.id,
      name: i.name,
      brand: i.brand,
      stock_quantity_portions: i.stock_quantity,
      low_stock_threshold_portions: i.low_stock_threshold,
      portions_per_gebinde: i.portions_per_unit,
      purchase_price_per_gebinde: i.purchase_price,
      portions_used_last_30_days: usageByItem[i.id] ?? 0,
    }));

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Du bist Fernando, ein Einkaufsassistent für einen deutschen Friseursalon. ' +
              'Du bekommst eine Liste von Artikeln, die unter ihrer Mindestmenge liegen, mit ' +
              'Verbrauch der letzten 30 Tage. Schlage für jeden Artikel eine sinnvolle Nachbestellmenge ' +
              'in Gebinden vor (mindestens 1), basierend auf dem Verbrauch — bei hohem Verbrauch ruhig ' +
              'mehr als 1 Gebinde vorschlagen. Antworte NUR mit validem JSON in exakt dieser Form, ohne ' +
              'sonstigen Text: {"suggestions": [{"item_id": string, "suggested_gebinde": number, ' +
              '"reasoning_de": string}]}. reasoning_de: ein kurzer Satz auf Deutsch.',
          },
          { role: 'user', content: JSON.stringify(promptItems) },
        ],
        temperature: 0.3,
      }),
    });

    if (!groqRes.ok) {
      throw new Error(`Groq API error: ${groqRes.status}`);
    }

    const groqJson = await groqRes.json();
    const content = groqJson.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed.suggestions)) {
      throw new Error('Unexpected model response shape');
    }

    return new Response(JSON.stringify({ suggestions: parsed.suggestions, ai_powered: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    // Model call failed or returned something unparseable — fall back to the
    // same deterministic list rather than leaving the owner with an error.
    console.error('ai-inventory-forecast error:', err);
    try {
      if (salon_id) {
        const admin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        const { data: items } = await admin
          .from('inventory_items')
          .select('id, portions_per_unit, stock_quantity, low_stock_threshold')
          .eq('salon_id', salon_id);
        const lowStock = (items ?? []).filter(
          (i) => i.low_stock_threshold != null && i.stock_quantity <= i.low_stock_threshold
        );
        return new Response(JSON.stringify({
          suggestions: lowStock.map((i) => ({
            item_id: i.id,
            suggested_gebinde: i.portions_per_unit ? 1 : null,
            reasoning_de: 'Regelbasiert: KI-Vorschlag nicht verfügbar, unter Mindestmenge.',
          })),
          ai_powered: false,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch {
      // fall through to generic error below
    }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
