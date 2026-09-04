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
          // lock_timeout: if a DDL statement (ALTER TABLE / CREATE INDEX) can't
          // acquire its AccessExclusiveLock within 5s (because the app or
          // another connection is using the table), abort it fast instead of
          // waiting until Postgres detects a deadlock and kills the whole
          // chunk transaction. All our DDL is idempotent (IF NOT EXISTS), so a
          // lock-timeout statement simply retries on the next sync.
          const LOCK_TIMEOUT = "SET lock_timeout = '5s'; SET statement_timeout = '30s';";
          const TRANSIENT = ["already exists", "duplicate", "already", "Throttler", "lock timeout", "canceling statement due to lock timeout", "deadlock detected"];
          const SCHEMA_CHUNK = 100;
          for (let ci = 0; ci < statements.length; ci += SCHEMA_CHUNK) {
            const chunk = statements.slice(ci, ci + SCHEMA_CHUNK).filter((s) => s.trim());
            if (chunk.length === 0) continue;
            const chunkRes = await fetch(`${managementApiBase}/database/query`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ query: `${LOCK_TIMEOUT}\n${chunk.join(";\n")}` }),
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
                body: JSON.stringify({ query: `${LOCK_TIMEOUT}\n${stmt}` }),
              });
              if (!sqlRes.ok) {
                const errText = await sqlRes.text();
                if (!TRANSIENT.some((t) => errText.includes(t))) {
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
          // Prepend lock_timeout to each statement so DDL that can't get a lock
          // fails fast instead of deadlocking the batch transaction.
          const CHUNK = 100;
          for (let ci = 0; ci < statements.length; ci += CHUNK) {
            const chunk = statements.slice(ci, ci + CHUNK).map((s) => `SET lock_timeout = '5s'; SET statement_timeout = '30s'; ${s}`);
            const batchRes = await fetch(`${selfSu}/rest/v1/rpc/exec_sql_batch`, {
              method: "POST",
              headers: { "apikey": selfSk, "Authorization": `Bearer ${selfSk}`, "Content-Type": "application/json" },
              body: JSON.stringify({ sql_texts: chunk }),
            });
            if (!batchRes.ok) {
              const errText = await batchRes.text();
              if (!errText.includes("lock timeout") && !errText.includes("deadlock") && !errText.includes("Throttler")) {
                failedCount += chunk.length;
                if (schemaErrors.length < 10) schemaErrors.push(`Batch chunk ${ci}: ${errText.substring(0, 150)}`);
              }
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

    // Deploy Edge Functions — including self-deploy when an access token is provided.
    // The function list is derived DYNAMICALLY from the edge_function_sources
    // table (any row whose name is a function slug, not a *_sql/*_schema row).
    // This way, adding a new function to the sources table automatically deploys
    // it on the next sync — no need to update a hardcoded list here (which was
    // the bug: a stale deployed deploy-territory had an old list missing
    // "scheduler", so sync silently skipped it).
    const SQL_META_KEYS = new Set(["master_sql", "scheduled_jobs_schema", "push_schema"]);
    const dbFunctionNames = Object.keys(FN_SOURCES).filter(
      (k) => !SQL_META_KEYS.has(k) && FN_SOURCES[k] && FN_SOURCES[k].length > 50,
    );
    const targetFunctions = functionNames && functionNames.length > 0
      ? functionNames
      : dbFunctionNames;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Deploy one function with aggressive retry/backoff on rate-limit (429 /
    // Throttler) responses from the Management API. Rate-limiting was the #1
    // cause of randomly-dropped functions: concurrent batch deploys trigger
    // throttling, and the old 3-attempt limit gave up too early. Now: 6
    // attempts with exponential backoff up to ~30s, and deploys run SERIALLY
    // (no concurrency) so we never trigger the concurrent-deploy throttle.
    async function deployOneFunction(fnName: string): Promise<boolean> {
      if (fnName === "deploy-territory" && isSelfDeploy && !accessToken) {
        results.functions[fnName] = { status: "skipped", note: "Self-deploy without token — add an access token to redeploy this function." };
        return false;
      }
      const source = FN_SOURCES[fnName];
      if (!source) {
        results.functions[fnName] = { status: "failed", error: "Source code not found in DB. Click 'Upload Sources' in Territories UI first." };
        results.errors.push(`${fnName}: Source missing`);
        return false;
      }
      if (source.length < 50) {
        results.functions[fnName] = { status: "failed", error: "Source too short (corrupted?)" };
        results.errors.push(`${fnName}: Source appears corrupted (${source.length} chars)`);
        return false;
      }

      const MAX_ATTEMPTS = 6;
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
            const isTransient = deployRes.status >= 500 || isRateLimited;
            if (isTransient && attempt < MAX_ATTEMPTS) {
              // Exponential backoff: 2s, 4s, 8s, 16s, 32s — gives the Management
              // API rate-limiter time to reset between retries.
              const backoff = 1000 * Math.pow(2, attempt);
              console.log(`[Fleet] ${fnName} rate-limited/transient (HTTP ${deployRes.status}), retrying in ${backoff}ms...`);
              await sleep(backoff);
              continue;
            }
            let errDetail = responseText.substring(0, 500);
            try {
              const errJson = JSON.parse(responseText);
              errDetail = errJson.error || errJson.message || JSON.stringify(errJson).substring(0, 300);
            } catch { /* keep raw text */ }
            results.functions[fnName] = { status: "failed", error: errDetail, httpStatus: deployRes.status };
            results.errors.push(`${fnName}: HTTP ${deployRes.status} — ${errDetail.substring(0, 150)}`);
            return false;
          }
          let deployData;
          try { deployData = JSON.parse(responseText); } catch { deployData = { raw: responseText.substring(0, 200) }; }
          results.functions[fnName] = { status: "success", id: deployData?.id, size: source.length };
          console.log(`[Fleet] ✓ ${fnName} deployed OK`);
          return true;
        } catch (e: any) {
          if (attempt < MAX_ATTEMPTS) {
            const backoff = 1000 * Math.pow(2, attempt);
            console.log(`[Fleet] ${fnName} network error, retrying in ${backoff}ms: ${e.message}`);
            await sleep(backoff);
            continue;
          }
          results.functions[fnName] = { status: "failed", error: e.message };
          results.errors.push(`${fnName}: ${e.message}`);
          console.error(`[Fleet] ✗ ${fnName} failed after ${MAX_ATTEMPTS} attempts:`, e.message);
          return false;
        }
      }
      return false;
    }

    if (deployFunctions !== false && (!isSelfDeploy || accessToken)) {
      // Deploy functions SERIALLY (one at a time) with a short pause between
      // each deploy. The Management API rate-limits CONCURRENT function deploys,
      // which was the #1 cause of randomly-dropped functions: a batch of 3
      // concurrent deploys would trigger throttling, and after 3 retries the
      // function was silently marked failed. Serial deploys with backoff
      // eliminate the concurrent-throttle entirely.
      for (let i = 0; i < targetFunctions.length; i++) {
        await deployOneFunction(targetFunctions[i]);
        // Brief pause between deploys to stay under the rate-limiter's
        // per-minute window. Only pause if more functions remain.
        if (i + 1 < targetFunctions.length) await sleep(800);
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

    // ── Verification + auto-retry pass ────────────────────────────────────
    // List functions on the target project and confirm every requested
    // function actually exists there. If any are missing OR failed due to
    // rate-limiting, AUTOMATICALLY retry them (up to 2 more rounds) instead
    // of just flagging them and making the user manually re-sync. This is
    // what makes sync reliable: a transient throttle no longer means a
    // function is permanently missing until the next manual sync.
    if (accessToken && deployFunctions !== false) {
      const MAX_VERIFY_ROUNDS = 3;
      for (let round = 1; round <= MAX_VERIFY_ROUNDS; round++) {
        let deployedSlugs = new Set<string>();
        try {
          const listRes = await fetch(`${managementApiBase}/functions`, {
            headers: { "Authorization": `Bearer ${accessToken}` },
          });
          if (listRes.ok) {
            const fnsJson = await listRes.json();
            if (Array.isArray(fnsJson)) {
              for (const f of fnsJson) {
                if (f.slug) deployedSlugs.add(f.slug);
                else if (f.name) deployedSlugs.add(f.name);
              }
            }
          }
        } catch (verifyErr: any) {
          console.warn(`[Fleet] Verification round ${round} failed (non-fatal): ${verifyErr.message}`);
        }

        // Find functions that are missing on target OR failed (and thus need retry)
        const needRetry = targetFunctions.filter((fn) => {
          const st = results.functions[fn]?.status;
          return st === "failed" || (st === "success" && !deployedSlugs.has(fn)) || !results.functions[fn];
        });

        if (needRetry.length === 0) {
          results.verification = { missing: [], deployedCount: deployedSlugs.size, ok: true, rounds: round };
          console.log(`[Fleet] Verification round ${round}: all ${targetFunctions.length} functions present on target ✓`);
          break;
        }

        console.log(`[Fleet] Verification round ${round}: ${needRetry.length} function(s) missing/failed, retrying: ${needRetry.join(", ")}`);
        if (round < MAX_VERIFY_ROUNDS) {
          // Reset their status so the retry can re-evaluate
          for (const fn of needRetry) {
            delete results.functions[fn];
            // Remove from errors list
            results.errors = results.errors.filter((e: string) => !e.startsWith(`${fn}:`));
          }
          // Retry serially with a pause before the round
          await sleep(2000);
          for (let i = 0; i < needRetry.length; i++) {
            await deployOneFunction(needRetry[i]);
            if (i + 1 < needRetry.length) await sleep(1000);
          }
        } else {
          // Final round — record what's still missing
          const stillMissing = needRetry.filter((fn) => {
            const st = results.functions[fn]?.status;
            return st !== "success" || !deployedSlugs.has(fn);
          });
          for (const fn of stillMissing) {
            if (!results.functions[fn] || results.functions[fn]?.status !== "success") {
              results.functions[fn] = { status: "failed", error: results.functions[fn]?.error || "Not present on target after 3 deploy rounds." };
              results.errors.push(`${fn}: not present on target after sync + retries`);
            }
          }
          results.verification = { missing: stillMissing, deployedCount: deployedSlugs.size, rounds: round };
          console.log(`[Fleet] Verification final: ${deployedSlugs.size} on target, ${stillMissing.length} still missing`);
        }
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
