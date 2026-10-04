import { supabase } from "./supabase";

/**
 * Territory-scoped list fetchers for the manager Dashboard (and any other
 * page that needs the full jobs/assignments shape, not just the slim lists).
 *
 * Passing `null` means "all territories" (super admin with the area picker set
 * to All Areas) — no filter is applied. A non-null id scopes the query to that
 * single area so a super admin viewing one area only sees that area's data.
 *
 * These mirror api.ts getJobs/getAssignments but add the territory filter;
 * kept here so the already-large api.ts is not mutated.
 */

const BID_RE = /\[BID:(\d+(?:\.\d+)?)\]/;

function parseAddons(addons: any): string[] {
  if (!addons) return [];
  if (Array.isArray(addons)) return addons as string[];
  if (typeof addons === "string") {
    try {
      const parsed = JSON.parse(addons);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through */
    }
    return addons
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function resolveJobPay(job: any) {
  const addons = parseAddons(job.addons);
  const isBidding = addons.includes("PAY_TYPE:BIDDING");
  let pay_rate = job.pay_rate;
  if (
    isBidding &&
    (job.status === "filled" || job.status === "completed") &&
    (!pay_rate || pay_rate === 0)
  ) {
    if (job.applications && job.applications.length > 0) {
      const acceptedApp = job.applications.find(
        (a: any) => a.status === "awarded",
      );
      if (acceptedApp && acceptedApp.message) {
        const match = acceptedApp.message.match(BID_RE);
        if (match) pay_rate = parseFloat(match[1]);
      }
    }
  }
  return { addons, isBidding, pay_rate };
}

export async function fetchJobById(jobId: string) {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      `
      *,
      weddings (client_name, date, location, region, is_lgbtq, territory_id)
    `,
    )
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { addons, isBidding, pay_rate } = resolveJobPay(data);
  return {
    ...data,
    pay_rate,
    addons: addons.filter((a) => a !== "PAY_TYPE:BIDDING"),
    pay_type: isBidding ? "bidding" : "flat",
  };
}

export async function fetchMyApplications(contractorId: string) {
  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, job_id, contractor_id, status, message, created_at, jobs(id, status, role, pay_rate, hours, weddings(client_name, date, location, region))",
    )
    .eq("contractor_id", contractorId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

export async function fetchMyApplicationForJob(
  jobId: string,
  contractorId: string,
) {
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("job_id", jobId)
    .eq("contractor_id", contractorId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  let bid_amount = null;
  let message = data.message;
  if (message) {
    const match = message.match(/\[BID:(\d+(?:\.\d+)?)\]/);
    if (match) {
      bid_amount = parseFloat(match[1]);
      message = message.replace(/\[BID:\d+(?:\.\d+)?\]\s*/, "").trim();
    }
  }
  return { ...data, message, bid_amount };
}

export async function fetchOpenJobsForTerritory(territoryId: string) {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      `
      *,
      weddings (client_name, date, location, region, is_lgbtq, territory_id)
    `,
    )
    .eq("status", "open")
    .eq("territory_id", territoryId)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data || []).map((job) => {
    const { addons, isBidding, pay_rate } = resolveJobPay(job);
    return {
      ...job,
      pay_rate,
      addons: addons.filter((a) => a !== "PAY_TYPE:BIDDING"),
      pay_type: isBidding ? "bidding" : "flat",
    };
  });
}

export async function fetchJobsForTerritory(territoryId: string | null) {
  let q = supabase
    .from("jobs")
    .select(
      `
      *,
      weddings (client_name, date, location, region, is_lgbtq, territory_id),
      applications (message, status)
    `,
    )
    .order("created_at", { ascending: false });
  if (territoryId) {
    q = q.eq("territory_id", territoryId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((job) => {
    const { addons, isBidding, pay_rate } = resolveJobPay(job);
    const { applications, ...jobWithoutApps } = job;
    return {
      ...jobWithoutApps,
      pay_rate,
      addons: addons.filter((a) => a !== "PAY_TYPE:BIDDING"),
      pay_type: isBidding ? "bidding" : "flat",
    };
  });
}

export async function fetchAssignmentsForTerritory(territoryId: string | null) {
  let q = supabase
    .from("assignments")
    .select(
      `
      *,
      jobs!inner (id, status, role, pay_rate, hours, addons, contractor_todos, wedding_id, territory_id, weddings(client_name, date, location, region, timeline, vip_names, vendors, special_requests, questionnaire_data, questionnaire_completed, drive_link, upload_link, is_lgbtq, territory_id), applications(message, status)),
      contractors (first_name, last_name, email, venmo_handle, stripe_account_id)
    `,
    )
    .order("created_at", { ascending: false });
  if (territoryId) {
    q = q.eq("jobs.territory_id", territoryId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((assignment) => {
    if (assignment.jobs) {
      const addons = parseAddons(assignment.jobs.addons);
      const isBidding = addons.includes("PAY_TYPE:BIDDING");
      let pay_rate = assignment.jobs.pay_rate;
      if (isBidding && (!pay_rate || pay_rate === 0)) {
        if (
          assignment.jobs.applications &&
          assignment.jobs.applications.length > 0
        ) {
          const acceptedApp = assignment.jobs.applications.find(
            (a: any) => a.status === "awarded",
          );
          if (acceptedApp && acceptedApp.message) {
            const match = acceptedApp.message.match(BID_RE);
            if (match) pay_rate = parseFloat(match[1]);
          }
        }
      }
      const { applications, ...jobWithoutApps } = assignment.jobs;
      assignment.jobs = {
        ...jobWithoutApps,
        pay_rate,
        addons: addons.filter((a) => a !== "PAY_TYPE:BIDDING"),
        pay_type: isBidding ? "bidding" : "flat",
      };
    }
    return assignment;
  });
}

/**
 * Territory-scoped applications fetch. Applications have no territory_id
 * column of their own, so we scope via the joined job's territory_id and the
 * job's wedding's territory_id. null = All Areas (no filter).
 *
 * Mirrors api.ts getApplications (bid parsing + addon/pay_type shaping) but
 * adds the territory filter.
 */
export async function fetchApplicationsForTerritory(
  territoryId: string | null,
) {
  let q = supabase
    .from("applications")
    .select(
      `
      *,
      jobs!inner (id, status, role, pay_rate, hours, addons, territory_id, weddings(client_name, date, location, region, timeline, vip_names, vendors, special_requests, questionnaire_data, questionnaire_completed, is_lgbtq, territory_id)),
      contractors (id, first_name, last_name, email, rating, specialty, region)
    `,
    )
    .order("created_at", { ascending: false });
  if (territoryId) {
    q = q.eq("jobs.territory_id", territoryId);
  }
  const { data, error } = await q;
  if (error) throw error;

  return (data || []).map((app: any) => {
    let bid_amount = null;
    let message = app.message;
    if (message) {
      const match = message.match(/\[BID:(\d+(?:\.\d+)?)\]/);
      if (match) {
        bid_amount = parseFloat(match[1]);
        message = message.replace(/\[BID:\d+(?:\.\d+)?\]\s*/, "").trim();
      }
    }

    if (app.jobs) {
      const addons = parseAddons(app.jobs.addons);
      const isBidding = addons.includes("PAY_TYPE:BIDDING");
      app.jobs.addons = addons.filter((a) => a !== "PAY_TYPE:BIDDING");
      app.jobs.pay_type = isBidding ? "bidding" : "flat";
    }
    return { ...app, message, bid_amount };
  });
}
