---
status: awaiting_human_verify
trigger: "Tamir API route returns 'Unknown agent: tamir' -- orchestrator.invoke() throws because this.agents map is empty"
created: 2026-03-26T23:30:00Z
updated: 2026-03-26T23:38:00Z
---

## Current Focus

hypothesis: CONFIRMED -- zombie server processes on ports 3000-3003 were serving stale code
test: Killed all zombies, restarted clean server on port 3000, curled the route
expecting: Successful agent registration and routing (no "Unknown agent" error)
next_action: Await human verification

## Symptoms

expected: POST /api/tamir/route with a message JSON body should invoke the Tamir agent and return a routing decision
actual: Returns HTTP 500 {"error":"Tamir invocation failed: Unknown agent: tamir"} on every request
errors: "[tamir/route] orchestrator.invoke failed: Unknown agent: tamir" in server log. console.log inside invoke() does NOT appear.
reproduction: curl -s -X POST http://localhost:3000/api/tamir/route -H "Content-Type: application/json" -d '{"message":"test"}'
started: Never worked. First boot.

## Eliminated

- hypothesis: Source code bug in orchestrator registration logic
  evidence: The current server on port 3004 returns a successful routing result with department, taskId, etc. The code works.
  timestamp: 2026-03-26T23:33:00Z

- hypothesis: Next.js serving stale compiled code from .next cache
  evidence: The compiled .next bundle DOES contain the console.log statements. The issue is that a different (older) server process on port 3000 is being hit.
  timestamp: 2026-03-26T23:34:00Z

## Evidence

- timestamp: 2026-03-26T23:31:00Z
  checked: /tmp/myelin-dev.log
  found: Log shows "Port 3000 is in use, trying 3001 instead" cascading to port 3004. Five Next.js servers running.
  implication: Multiple zombie server instances exist from previous dev sessions.

- timestamp: 2026-03-26T23:32:00Z
  checked: Compiled .next output for orchestrator.ts
  found: console.log statements ARE present in compiled code
  implication: Stale code theory for current server is wrong -- the issue is hitting the WRONG server

- timestamp: 2026-03-26T23:33:00Z
  checked: curl to all ports 3000-3004
  found: Port 3000 returns "Unknown agent: tamir" (OLD code). Port 3004 returns SUCCESS with routing result (taskId, department, reasoning). Ports 3001/3002 return Claude SDK path error (different issue).
  implication: The orchestrator code fix WORKS. User was testing against zombie process on port 3000.

- timestamp: 2026-03-26T23:34:00Z
  checked: ss -tlnp for ports 3000-3004
  found: Five next-server processes: PIDs 517555(3000), 523613(3001), 521528(3002), 522678(3003), 525208(3004)
  implication: All are zombie dev servers from repeated `npm run dev` without killing previous

- timestamp: 2026-03-26T23:37:00Z
  checked: Fresh server on port 3000 after killing all zombies
  found: curl returns "Claude Code executable not found" error (NOT "Unknown agent: tamir"). Logs show agents registered: [orch.invoke] agents after init: 4 [ 'tamir', 'cto', 'cmo', 'coo' ]
  implication: "Unknown agent: tamir" is fully resolved. Remaining error is a separate Claude Agent SDK config issue.

## Resolution

root_cause: Five zombie Next.js dev server processes were running on ports 3000-3004. The user's curl commands hit port 3000 (the oldest/stale server with pre-fix code). The current server on port 3004 had the correct code and worked -- it successfully routed requests. The console.log mystery was the same cause: the stale server on port 3000 had compiled code from BEFORE those statements were added.
fix: Killed all 5 zombie Next.js processes, cleared .next cache, restarted a single clean dev server on port 3000. Replaced debug console.log statements with proper pino logger call.
verification: Fresh server on port 3000 now shows all 4 agents registered (tamir, cto, cmo, coo). The "Unknown agent: tamir" error no longer occurs. The next error in the pipeline is a separate Claude Agent SDK executable path issue.
files_changed: [src/lib/orchestrator.ts]
