// Royalty Summary Endpoint
// Returns a secure JSON summary of this instance's territory royalty status.
// Designed for an external Master Dashboard (used by company Super Admins) to pull
// summary data from each isolated Veydra territory instance.
//
// SECURITY: Requires either:
//   1. A valid Supabase service_role key in the Authorization header, OR
//   2. A valid JWT from an authenticated super_admin user, OR
//   3. The X-Royalty-Secret header matching the ROYALTY_SUMMARY_SECRET env var
//
// RESPONSE SHAPE:
// {
//   territory_id: string,
//   territory_name: string,
//   status: "active" | "paused",
//   royalty_percentage: number,
//   payback_percentage: number,
//   purchase_price: number,
//   down_payment: number,
//   remaining_balance: number,
//   gross_sales_current_period: number,
//   gross_sales_lifetime: number,
//   amount_currently_owed: number,        // latest unpaid period total_due
//   payment_status: "current" | "overdue" | "failed" | "none",
//   last_payment_date: string | null,     // ISO date of last paid period
//   last_payment_amount: number,
//   next_expected_payment_date: string | null,
//   stripe_connected: boolean,
//   periods: [                             // last 12 periods for history
//     { period_start, period_end, gross_sales, royalty_amount, payback_amount, total_due, status, paid_at }
//   ]
// }

import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-royalty-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const royaltySecret = Deno.env.get("ROYALTY_SUMMARY_SECRET");

  // ─── Auth check ───
  const authHeader = req.headers.get("authorization") || "";
  const secretHeader = req.headers.get("x-royalty-secret") || "";
  const apiKey = req.headers.get("apikey") || "";

  const isServiceKey = apiKey === supabaseKey || authHeader.includes(supabaseKey);
  const isSecretMatch = royaltySecret && secretHeader === royaltySecret;

  // Also allow authenticated super_admin via JWT
  let isSuperAdmin = false;
  if (!isServiceKey && !isSecretMatch) {
    const token = authHeader.replace("Bearer ", "");
    if (token && token !== supabaseKey) {
      const tempClient = createClient(supabaseUrl, supabaseKey);
      const { data: userData } = await tempClient.auth.getUser(token);
      if (userData?.user) {
        const { data: roleData } = await tempClient
          .from("managers")
          .select("role")
          .eq("email", userData.user.email || "")
          .limit(1);
        isSuperAdmin = roleData?.[0]?.role === "super_admin";
      }
    }
  }

  if (!isServiceKey && !isSecretMatch && !isSuperAdmin) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Fetch this instance's own territory (is_primary = true)
    const { data: territory, error: terrError } = await supabase
      .from("territories")
      .select("*")
      .eq("is_primary", true)
      .limit(1)
      .single();

    if (terrError || !territory) {
      return jsonResponse({ error: "No primary territory registered for this instance" }, 404);
    }

    // Fetch last 12 royalty periods
    const { data: periods } = await supabase
      .from("royalty_periods")
      .select("*")
      .eq("territory_id", territory.id)
      .order("period_start", { ascending: false })
      .limit(12);

    // Fetch lifetime gross sales
    const { data: allSales } = await supabase
      .from("royalty_sales")
      .select("sale_amount, is_refund, is_test")
      .eq("territory_id", territory.id);

    // Royalty rule: refunds + test sales NEVER count — only real kept sales.
    const lifetimeGross = (allSales || []).reduce((sum: number, s: any) => {
      return sum + (s.is_refund || s.is_test ? 0 : Number(s.sale_amount));
    }, 0);

    // Current period gross sales (last 7 days)
    const periodEnd = new Date();
    periodEnd.setHours(0, 0, 0, 0);
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 7);

    const { data: currentSales } = await supabase
      .from("royalty_sales")
      .select("sale_amount, is_refund, is_test")
      .eq("territory_id", territory.id)
      .gte("sale_date", periodStart.toISOString().split("T")[0])
      .lt("sale_date", periodEnd.toISOString().split("T")[0]);

    // Royalty rule: refunds + test sales NEVER count — only real kept sales.
    const currentGross = (currentSales || []).reduce((sum: number, s: any) => {
      return sum + (s.is_refund || s.is_test ? 0 : Number(s.sale_amount));
    }, 0);

    // Determine payment status
    const lastPaidPeriod = (periods || []).find((p: any) => p.status === "paid");
    const lastFailedPeriod = (periods || []).find((p: any) => p.status === "failed");
    const pendingPeriod = (periods || []).find((p: any) => p.status === "pending" || p.status === "processing");
    const unpaidPeriod = (periods || []).find((p: any) => p.status !== "paid" && p.status !== "waived" && p.total_due > 0);

    let paymentStatus = "none";
    if (lastFailedPeriod && !lastPaidPeriod) {
      paymentStatus = "failed";
    } else if (unpaidPeriod) {
      // Check if overdue (more than 7 days past period_end)
      const periodEnd = new Date(unpaidPeriod.period_end);
      const daysSince = (Date.now() - periodEnd.getTime()) / (1000 * 60 * 60 * 24);
      paymentStatus = daysSince > 7 ? "overdue" : "current";
    } else if (lastPaidPeriod) {
      paymentStatus = "current";
    }

    // Next expected payment date (next processing day)
    const { data: settings } = await supabase
      .from("royalty_settings")
      .select("processing_day_of_week, processing_time")
      .limit(1)
      .single();

    let nextPaymentDate: string | null = null;
    if (settings) {
      const today = new Date();
      const targetDay = settings.processing_day_of_week;
      const currentDay = today.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      const next = new Date(today);
      next.setDate(today.getDate() + daysUntil);
      nextPaymentDate = next.toISOString().split("T")[0];
    }

    // Build response
    const response = {
      territory_id: territory.id,
      territory_name: territory.name,
      status: territory.status || "active",
      royalty_percentage: Number(territory.royalty_percentage || 0),
      payback_percentage: Number(territory.payback_percentage || 0),
      purchase_price: Number(territory.purchase_price || 0),
      down_payment: Number(territory.down_payment || 0),
      remaining_balance: Number(territory.remaining_balance || 0),
      gross_sales_current_period: currentGross,
      gross_sales_lifetime: lifetimeGross,
      amount_currently_owed: Number(unpaidPeriod?.total_due || 0),
      payment_status: paymentStatus,
      last_payment_date: lastPaidPeriod?.paid_at || null,
      last_payment_amount: Number(lastPaidPeriod?.total_due || 0),
      next_expected_payment_date: nextPaymentDate,
      stripe_connected: !!territory.stripe_customer_id,
      periods: (periods || []).map((p: any) => ({
        period_start: p.period_start,
        period_end: p.period_end,
        gross_sales: Number(p.gross_sales || 0),
        royalty_amount: Number(p.royalty_amount || 0),
        payback_amount: Number(p.payback_amount || 0),
        total_due: Number(p.total_due || 0),
        status: p.status,
        paid_at: p.paid_at,
      })),
    };

    return jsonResponse(response, 200);
  } catch (err) {
    console.error("Royalty summary error:", err);
    return jsonResponse({ error: err.message }, 500);
  }

  function jsonResponse(data: any, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
