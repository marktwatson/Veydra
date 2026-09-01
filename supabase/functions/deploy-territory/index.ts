import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Minimal fallback SQL (exec_sql + exec_sql_batch only) ───────────────────
// The FULL master schema is read from the edge_function_sources table at
// runtime (row named "master_sql", uploaded by the Territories UI via
// "Upload Sources"). This stub only covers the self-deploy-without-token
// fallback path, which needs exec_sql to already exist on the DB.
const MASTER_SQL = `
CREATE OR REPLACE FUNCTION public.exec_sql(sql_text TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  EXECUTE sql_text;
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END; $$;
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.exec_sql_batch(sql_texts TEXT[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  FOR i IN 1..array_length(sql_texts, 1) LOOP
    BEGIN
      EXECUTE sql_texts[i];
    EXCEPTION WHEN OTHERS THEN
      IF NOT (SQLERRM LIKE '%already exists%' OR SQLERRM LIKE '%duplicate%' OR SQLERRM LIKE '%already%') THEN
        RAISE NOTICE 'Skip: %', SQLERRM;
      END IF;
    END;
  END LOOP;
END; $$;
GRANT EXECUTE ON FUNCTION public.exec_sql_batch(TEXT[]) TO anon, authenticated, service_role;
`;

const FN_SOURCES: Record<string, string> = {}; // Populated at runtime from DB

// Strip SQL comments (single-line -- and multi-line block) so comment content
// (like $$ inside comments) doesn't confuse the statement splitter.
function stripSqlComments(sql: string): string {
  let result = "";
  let i = 0;
  let inSingleQuote = false;
  let inDollarQuote = false;
  let dollarTag = "";
  while (i < sql.length) {
    const ch = sql[i];
    const nextCh = sql[i + 1] || "";
    if (ch === "'" && !inDollarQuote) {
      if (inSingleQuote && nextCh === "'") { result += "''"; i += 2; continue; }
      inSingleQuote = !inSingleQuote;
      result += ch; i++; continue;
    }
    if (ch === "$" && !inSingleQuote) {
      if (!inDollarQuote) {
        const tagMatch = sql.substring(i).match(/^\$(\w*)\$/);
        if (tagMatch) { inDollarQuote = true; dollarTag = tagMatch[0]; result += tagMatch[0]; i += tagMatch[0].length; continue; }
      } else {
        if (sql.substring(i).startsWith(dollarTag)) { inDollarQuote = false; result += dollarTag; i += dollarTag.length; continue; }
      }
    }
    if (ch === "-" && nextCh === "-" && !inSingleQuote && !inDollarQuote) {
      while (i < sql.length && sql[i] !== "\n") i++;
      result += "\n";
      continue;
    }
    if (ch === "/" && nextCh === "*" && !inSingleQuote && !inDollarQuote) {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i += 2;
      result += " ";
      continue;
    }
    result += ch;
    i++;
  }
  return result;
}

/** Split a multi-statement SQL string into individual statements, respecting quotes and dollar-quoting. */
function splitSqlStatements(sql: string): string[] {
  const cleaned = stripSqlComments(sql);
  const statements: string[] = [];
  let currentStmt = "";
  let inSingleQuote = false;
  let inDollarQuote = false;
  let dollarTag = "";
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const nextCh = cleaned[i + 1] || "";
    currentStmt += ch;
    if (ch === "'" && !inDollarQuote && !inSingleQuote) { inSingleQuote = true; }
    else if (ch === "'" && !inDollarQuote && inSingleQuote && nextCh !== "'") { inSingleQuote = false; }
    else if (ch === "'" && inSingleQuote && nextCh === "'") { currentStmt += nextCh; i++; }
    else if (ch === "$" && !inSingleQuote) {
      if (!inDollarQuote) {
        const tagMatch = cleaned.substring(i).match(/^\$(\w*)\$/);
        if (tagMatch) { inDollarQuote = true; dollarTag = tagMatch[0]; currentStmt += tagMatch[0].substring(1); i += tagMatch[0].length - 1; }
      } else {
        if (cleaned.substring(i).startsWith(dollarTag)) { inDollarQuote = false; currentStmt += dollarTag.substring(1); i += dollarTag.length - 1; }
      }
    }
    if (ch === ";" && !inSingleQuote && !inDollarQuote) {
      const trimmed = currentStmt.trim();
      if (trimmed.length > 1) statements.push(trimmed);
      currentStmt = "";
    }
  }
  if (currentStmt.trim().length > 1) statements.push(currentStmt.trim());
  return statements;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { territoryId, projectRef, accessToken, deploySchema, deployFunctions, functionNames, testOnly } = await req.json();

    // Detect self-deploy: when the target projectRef matches this instance
    const selfSu = Deno.env.get("SUPABASE_URL") || "";
    const selfRef = selfSu.replace("https://", "").replace(".supabase.co", "");
    const isSelfDeploy = projectRef === selfRef;

    if (!projectRef || (!accessToken && !isSelfDeploy)) {
      return new Response(JSON.stringify({ error: "Missing projectRef or accessToken" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const managementApiBase = `https://api.supabase.com/v1/projects/${projectRef}`;

    // Test-only mode
    if (testOnly) {
      try {
        const testRes = await fetch(managementApiBase, {
          headers: { "Authorization": `Bearer ${accessToken}` },
        });
        if (testRes.ok) {
          const proj = await testRes.json();
          return new Response(JSON.stringify({
            success: true,
            project: { name: proj.name, region: proj.region, status: proj.status, ref: projectRef },
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ success: false, error: `HTTP ${testRes.status}` }), {
          status: testRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const results: any = { projectRef, schema: null, functions: {} as Record<string, any>, errors: [] as string[], duration: 0 };

    // Fetch latest source code AND master SQL from edge_function_sources table
    const mainDbForSources = createClient(selfSu, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const { data: sourceRows, error: sourceError } = await mainDbForSources.from("edge_function_sources").select("name, source_code");
    console.log(`[Fleet] edge_function_sources query: ${sourceRows?.length || 0} rows, error: ${sourceError?.message || "none"}`);

    let dynamicMasterSql = "";
    if (sourceRows && sourceRows.length > 0) {
      for (const row of sourceRows) {
        if (row.source_code && row.source_code.length > 50) {
          FN_SOURCES[row.name] = row.source_code;
        }
        if (row.name === "master_sql" && row.source_code && row.source_code.length > 50) {
          dynamicMasterSql = row.source_code;
          console.log(`[Fleet] Loaded master_sql from DB (${row.source_code.length} chars)`);
        }
      }
      console.log(`[Fleet] Loaded ${sourceRows.length} rows from edge_function_sources`);
    } else {
      console.warn(`[Fleet] WARNING: No edge function sources found in DB! Click 'Upload Sources' in Territories UI first.`);
      results.errors.push("No edge function sources in DB — click 'Upload Sources' in the Territories page first.");
    }

    // Use the DB-fetched master SQL if available, otherwise fall back to the minimal stub
    let effectiveSql = dynamicMasterSql;
    if (dynamicMasterSql) {
      console.log(`[Fleet] Using DB master SQL (${dynamicMasterSql.length} chars) — always latest version`);
    } else {
      effectiveSql = MASTER_SQL;
      console.warn(`[Fleet] WARNING: master_sql not found in DB, falling back to minimal stub. Click 'Upload Sources' in the Territories UI to push the full schema.`);
      results.errors.push("WARNING: master_sql not found in edge_function_sources DB — used minimal fallback. Click 'Upload Sources' in the Territories UI to push the full schema.");
    }

    // Push SQL Schema
    if (deploySchema !== false) {
      try {
        const statements = splitSqlStatements(effectiveSql);
        console.log(`[Fleet] Schema deploy: ${statements.length} statements, selfDeploy: ${isSelfDeploy}, hasToken: ${!!accessToken}`);

        let failedCount = 0;
        const schemaErrors: string[] = [];
        const selfSk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

        if (accessToken) {
          // ── Management API /database/query, CHUNKED ──────────────────────
          // /database/query accepts multi-statement SQL, so batching ~100
          // idempotent statements per call turns ~660 HTTP round-trips into
          // ~7 — that was the real cause of full Sync timing out (HTTP 546
          // Edge Gateway timeout). A failing statement rolls back its whole
          // chunk (one implicit transaction), so on chunk failure we fall
          // back to running just that chunk's statements one-by-one to
          // isolate the error and let the idempotent ones still apply.
          const SCHEMA_CHUNK = 100;
          for (let ci = 0; ci < statements.length; ci += SCHEMA_CHUNK) {
            const chunk = statements.slice(ci, ci + SCHEMA_CHUNK).filter((s) => s.trim());
            if (chunk.length === 0) continue;
            const chunkRes = await fetch(`${managementApiBase}/database/query`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ query: chunk.join(";\n") }),
            });
            if (chunkRes.ok) continue;
            const chunkErr = await chunkRes.text();
            if (chunkErr.includes("Throttler")) continue; // rate-limited — skip, next sync retries
            // Chunk failed as one transaction — isolate by running its statements individually.
            for (let si = 0; si < chunk.length; si++) {
              const stmt = chunk[si];
              if (!stmt.trim()) continue;
              const sqlRes = await fetch(`${managementApiBase}/database/query`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({ query: stmt }),
              });
              if (!sqlRes.ok) {
                const errText = await sqlRes.text();
                if (!errText.includes("already exists") && !errText.includes("duplicate") && !errText.includes("already") && !errText.includes("Throttler")) {
                  failedCount++;
                  if (schemaErrors.length < 10) schemaErrors.push(`Stmt ${ci + si + 1}: ${errText.substring(0, 150)}`);
                }
              }
            }
          }
          console.log(`[Fleet] Ran ${statements.length} statements in chunks, ${failedCount} failed`);
        } else if (isSelfDeploy) {
          // ── Fallback: exec_sql_batch RPC (self-deploy, no access token) ──
          if (!selfSk) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set on this instance");
          const createBatchFn = `CREATE OR REPLACE FUNCTION public.exec_sql_batch(sql_texts TEXT[]) RETURNS void AS $$ BEGIN FOR i IN 1..array_length(sql_texts, 1) LOOP BEGIN EXECUTE sql_texts[i]; EXCEPTION WHEN OTHERS THEN IF NOT (SQLERRM LIKE '%already exists%' OR SQLERRM LIKE '%duplicate%' OR SQLERRM LIKE '%already%') THEN RAISE NOTICE 'Skip: %', SQLERRM; END IF; END; END LOOP; END; $$ LANGUAGE plpgsql SECURITY DEFINER;`;
          const batchFnRes = await fetch(`${selfSu}/rest/v1/rpc/exec_sql`, {
            method: "POST",
            headers: { "apikey": selfSk, "Authorization": `Bearer ${selfSk}`, "Content-Type": "application/json" },
            body: JSON.stringify({ sql_text: createBatchFn }),
          });
          if (!batchFnRes.ok) {
            const errText = await batchFnRes.text();
            throw new Error(`Cannot create exec_sql_batch (exec_sql may not exist). Add a Supabase access token to use the Management API instead. Error: ${errText.substring(0, 200)}`);
          }
          const CHUNK = 100;
          for (let ci = 0; ci < statements.length; ci += CHUNK) {
            const chunk = statements.slice(ci, ci + CHUNK);
            const batchRes = await fetch(`${selfSu}/rest/v1/rpc/exec_sql_batch`, {
              method: "POST",
              headers: { "apikey": selfSk, "Authorization": `Bearer ${selfSk}`, "Content-Type": "application/json" },
              body: JSON.stringify({ sql_texts: chunk }),
            });
            if (!batchRes.ok) {
              const errText = await batchRes.text();
              failedCount += chunk.length;
              if (schemaErrors.length < 10) schemaErrors.push(`Batch chunk ${ci}: ${errText.substring(0, 150)}`);
            }
          }
        }

        if (failedCount > 0) {
          results.errors.push(`Schema: ${failedCount} statements/chunks failed`);
          results.schema = { status: "failed", error: `${failedCount} of ${statements.length} statements failed`, details: schemaErrors, totalStatements: statements.length };
        } else {
          results.schema = { status: "success", method: accessToken ? "management_api" : "exec_sql_batch_rpc", statements: statements.length };
        }
      } catch (e: any) {
        results.schema = { status: "failed", error: e.message, details: [e.message] };
        results.errors.push(`Schema: ${e.message}`);
      }

      // Reload PostgREST schema cache — hard restart (token) + NOTIFY signal.
      if (results.schema?.status === "success") {
        try {
          if (accessToken) await fetch(`${managementApiBase}/postgrest/restart`, { method: "POST", headers: { "Authorization": `Bearer ${accessToken}` } });
          const notifySql = "NOTIFY pgrst, 'reload schema';";
          const selfSk2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
          if (accessToken) await fetch(`${managementApiBase}/database/query`, { method: "POST", headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: notifySql }) });
          else if (isSelfDeploy && selfSk2) await fetch(`${selfSu}/rest/v1/rpc/exec_sql`, { method: "POST", headers: { "apikey": selfSk2, "Authorization": `Bearer ${selfSk2}`, "Content-Type": "application/json" }, body: JSON.stringify({ sql_text: notifySql }) });
          console.log("[Fleet] PostgREST schema cache reload triggered");
        } catch (e) {
          console.warn("[Fleet] Could not reload PostgREST cache:", (e as Error).message);
        }
      }
    }

    // Deploy Edge Functions — including self-deploy when an access token is provided
    const targetFunctions = functionNames || ["daily-reminders", "stripe-checkout", "stripe-invoices", "stripe-payout", "stripe-portal", "stripe-onboard", "stripe-webhook", "stripe-status", "crm-webhook", "process-notifications", "deploy-territory", "geocode", "royalty-processor", "royalty-summary", "royalty-stripe-keys", "payment-plan-approve", "stripe-cancel-subscription", "send-push", "daily-digest"];

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Deploy one function with retry/backoff on rate-limit (429 / Throttler)
    // responses from the Management API — these were silently dropping
    // functions from the results (they just came back "failed" once, no retry).
    async function deployOneFunction(fnName: string) {
      if (fnName === "deploy-territory" && isSelfDeploy && !accessToken) {
        results.functions[fnName] = { status: "skipped", note: "Self-deploy without token — add an access token to redeploy this function." };
        return;
      }
      const source = FN_SOURCES[fnName];
      if (!source) {
        results.functions[fnName] = { status: "failed", error: "Source code not found in DB. Click 'Upload Sources' in Territories UI first." };
        results.errors.push(`${fnName}: Source missing`);
        return;
      }
      if (source.length < 50) {
        results.functions[fnName] = { status: "failed", error: "Source too short (corrupted?)" };
        results.errors.push(`${fnName}: Source appears corrupted (${source.length} chars)`);
        return;
      }

      const MAX_ATTEMPTS = 3;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          console.log(`[Fleet] Deploying ${fnName} to ${projectRef} (attempt ${attempt}/${MAX_ATTEMPTS}, ${source.length} chars)...`);
          const boundary = "----VeydraBoundary" + Math.random().toString(16).substring(2);
          const metadataJson = JSON.stringify({ name: fnName, verify_jwt: false, entrypoint_path: "index.ts" });
          const multipartBody = [
            `--${boundary}\r\n`,
            `Content-Disposition: form-data; name="metadata"\r\n`,
            `Content-Type: application/json\r\n\r\n`,
            `${metadataJson}\r\n`,
            `--${boundary}\r\n`,
            `Content-Disposition: form-data; name="file"; filename="index.ts"\r\n`,
            `Content-Type: text/typescript\r\n\r\n`,
            `${source}\r\n`,
            `--${boundary}--\r\n`,
          ].join("");
          const deployRes = await fetch(`${managementApiBase}/functions/deploy?slug=${fnName}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": `multipart/form-data; boundary=${boundary}` },
            body: multipartBody,
          });
          const responseText = await deployRes.text();
          console.log(`[Fleet] ${fnName} deploy response: HTTP ${deployRes.status}, body: ${responseText.substring(0, 300)}`);
          if (!deployRes.ok) {
            const isRateLimited = deployRes.status === 429 || /throttl/i.test(responseText);
            if (isRateLimited && attempt < MAX_ATTEMPTS) {
              await sleep(1000 * attempt * 2);
              continue; // retry
            }
            let errDetail = responseText.substring(0, 500);
            try {
              const errJson = JSON.parse(responseText);
              errDetail = errJson.error || errJson.message || JSON.stringify(errJson).substring(0, 300);
            } catch { /* keep raw text */ }
            results.functions[fnName] = { status: "failed", error: errDetail, httpStatus: deployRes.status };
            results.errors.push(`${fnName}: HTTP ${deployRes.status} — ${errDetail.substring(0, 150)}`);
            return;
          }
          let deployData;
          try { deployData = JSON.parse(responseText); } catch { deployData = { raw: responseText.substring(0, 200) }; }
          results.functions[fnName] = { status: "success", id: deployData?.id, size: source.length };
          console.log(`[Fleet] ✓ ${fnName} deployed OK`);
          return;
        } catch (e: any) {
          if (attempt < MAX_ATTEMPTS) { await sleep(1000 * attempt); continue; }
          results.functions[fnName] = { status: "failed", error: e.message };
          results.errors.push(`${fnName}: ${e.message}`);
          console.error(`[Fleet] ✗ ${fnName} failed after ${MAX_ATTEMPTS} attempts:`, e.message);
          return;
        }
      }
    }

    if (deployFunctions !== false && (!isSelfDeploy || accessToken)) {
      // Deploy functions in small serial-ish batches with a short pause between
      // batches — the Management API rate-limits concurrent function deploys,
      // which was silently dropping functions from a full Sync with no retry.
      const BATCH_SIZE = 3;
      for (let i = 0; i < targetFunctions.length; i += BATCH_SIZE) {
        const batch = targetFunctions.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((fnName) => deployOneFunction(fnName)));
        if (i + BATCH_SIZE < targetFunctions.length) await sleep(400);
      }
      // Verify every requested function landed in results — if the loop above
      // ever skipped one (defensive), mark it failed instead of it vanishing.
      for (const fnName of targetFunctions) {
        if (!results.functions[fnName]) {
          results.functions[fnName] = { status: "failed", error: "Deploy attempt produced no result (unexpected)." };
          results.errors.push(`${fnName}: no result recorded`);
        }
      }
    } else if (isSelfDeploy && !accessToken) {
      for (const fnName of targetFunctions) {
        results.functions[fnName] = { status: "skipped", note: "Self-deploy without token — functions not redeployed. Add an access token to enable." };
      }
    }

    results.duration = Date.now() - startTime;
    const skippedCount = Object.values(results.functions).filter((f: any) => f?.status === "skipped").length;
    results.success = results.errors.length === 0 && skippedCount === 0;

    // Update territory record
    const mainSk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (selfSu && mainSk && territoryId) {
      const mainDb = createClient(selfSu, mainSk);
      await mainDb.from("territories").update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: results.success ? "success" : "partial",
        last_sync_result: results,
      }).eq("id", territoryId);
    }

    // If self-deploy (no territoryId), register this instance as primary
    if (selfSu && mainSk && !territoryId && deploySchema !== false) {
      const mainDb = createClient(selfSu, mainSk);
      const { data: existing } = await mainDb.from("territories").select("id").eq("project_ref", selfRef).limit(1);
      if (!existing || existing.length === 0) {
        await mainDb.from("territories").insert({
          name: "Veydra (Main)",
          project_ref: selfRef,
          supabase_url: selfSu,
          access_token: accessToken || "",
          last_synced_at: new Date().toISOString(),
          last_sync_status: "success",
          last_sync_result: results,
          is_primary: true,
        });
        results.selfRegistered = true;
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, success: false }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
