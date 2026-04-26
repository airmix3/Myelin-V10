/**
 * Next.js instrumentation hook -- runs once on server start.
 * Stable in Next.js 14.2+ (no experimental flag needed).
 *
 * Responsibilities (per FOUND-06):
 * 1. Initialize FTS5 safety net (recreates if missing)
 * 2. Ensure planning desk directories exist (FOUND-11)
 * 3. Copy company DNA template on first boot (FOUND-08)
 * 4. Start worker loop (fire-and-forget, does not block startup)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Singleton guard -- prevent duplicate init on HMR
    const g = globalThis as typeof globalThis & { __cortexInit?: boolean };
    if (g.__cortexInit) return;
    g.__cortexInit = true;

    // Dynamic imports to keep edge runtime clean
    const { initFTS5 } = await import('./lib/fts');
    const { startWorkerLoop } = await import('./lib/worker');
    const { ensurePlanningDesks, ensureManagerDesks } = await import('./lib/workspace');
    const { sqlite } = await import('./lib/db');
    const { generateId } = await import('./lib/id');
    const { logger } = await import('./lib/logger');
    const fs = await import('fs');
    const path = await import('path');

    const log = logger.child({ module: 'instrumentation' });

    log.info('Cortex server initialization starting');

    // 1. Initialize FTS5 safety net (sync, fast)
    try {
      initFTS5();
      log.info('FTS5 initialized');
    } catch (err) {
      log.error({ err }, 'FTS5 initialization failed');
    }

    // 1.5. Initialize Assets FTS5
    try {
      const { initAssetsFTS5 } = await import('./lib/asset-fts');
      initAssetsFTS5();
      log.info('Asset FTS5 initialized');
    } catch (err) {
      log.error({ err }, 'Asset FTS5 initialization failed');
    }

    // 1.6. Initialize strategic layer tables (Phase 13)
    try {
      const { initStrategicTables } = await import('./lib/strategic-tables');
      initStrategicTables();
      log.info('Strategic tables initialized');
    } catch (err) {
      log.error({ err }, 'Strategic tables initialization failed');
    }

    // 1.7. Ensure strategy data directories
    try {
      const { DATA_ROOT } = await import('./lib/paths');
      fs.mkdirSync(path.join(DATA_ROOT, 'strategy', 'canvas-chats'), { recursive: true });
      log.info('Strategy data directories ensured');
    } catch (err) {
      log.error({ err }, 'Strategy directory creation failed');
    }

    // 1.8. Ensure shared library directories for all departments
    try {
      const { ensureSharedLibDirs } = await import('./lib/catalog');
      ensureSharedLibDirs();
      log.info('Shared library directories initialized');
    } catch (err) {
      log.error({ err }, 'Shared library directory creation failed');
    }

    // 2. Ensure planning desk directories (FOUND-11)
    try {
      await ensurePlanningDesks();
      log.info('Planning desks ensured');
    } catch (err) {
      log.error({ err }, 'Planning desk creation failed');
    }

    // 2.5. Ensure manager desks and dept tool/skill directories
    try {
      await ensureManagerDesks();
      log.info('Manager desks ensured');
    } catch (err) {
      log.error({ err }, 'Manager desk creation failed');
    }

    // 3. Copy company DNA on first boot (FOUND-08)
    try {
      const vaultDir = path.resolve(process.cwd(), 'data', 'vault');
      const dnaTarget = path.join(vaultDir, 'company-dna.md');
      const dnaTemplate = path.resolve(process.cwd(), 'config', 'company-dna.template.md');

      if (!fs.existsSync(dnaTarget) && fs.existsSync(dnaTemplate)) {
        fs.mkdirSync(vaultDir, { recursive: true });
        fs.copyFileSync(dnaTemplate, dnaTarget);
        log.info('Company DNA template copied to vault');

        // Read the template content and index in documents table + FTS5
        const content = fs.readFileSync(dnaTarget, 'utf-8');

        // Parse frontmatter with gray-matter
        const matter = await import('gray-matter');
        const parsed = matter.default(content);

        const docId = generateId('doc');
        sqlite.prepare(`
          INSERT INTO documents (id, title, content, source, department, filedBy, filePath, createdAt, updatedAt)
          VALUES (?, ?, ?, 'vault', 'cos', 'system', ?, datetime('now'), datetime('now'))
        `).run(docId, parsed.data.title || 'Myelin Company DNA', parsed.content, dnaTarget);

        log.info({ docId }, 'Company DNA indexed in documents table + FTS5');
      } else if (fs.existsSync(dnaTarget)) {
        log.debug('Company DNA already exists in vault, skipping copy');
      } else {
        log.warn('Company DNA template not found at config/company-dna.template.md');
      }
    } catch (err) {
      log.error({ err }, 'Company DNA copy/index failed');
    }

    // 3.5. Index any vault files not yet in the documents table
    try {
      const vaultDir = path.resolve(process.cwd(), 'data', 'vault');
      if (fs.existsSync(vaultDir)) {
        const vaultFiles = fs.readdirSync(vaultDir).filter((f: string) => f.endsWith('.md') && f !== '.gitkeep');
        const { prisma } = await import('./lib/db');

        // Get all existing vault docs by filename (not absolute path, which varies per machine)
        const existingDocs = await prisma.document.findMany({
          where: { source: 'vault' },
          select: { filePath: true },
        });
        const indexedFiles = new Set(existingDocs.map(d => d.filePath ? path.basename(d.filePath) : ''));

        for (const file of vaultFiles) {
          if (indexedFiles.has(file)) continue;

          const filePath = path.join(vaultDir, file);
          const raw = fs.readFileSync(filePath, 'utf-8');

          // Extract title from frontmatter or filename
          let title = file.replace(/\.md$/, '').replace(/-/g, ' ');
          const titleMatch = raw.match(/^title:\s*["']?(.+?)["']?\s*$/m);
          if (titleMatch) title = titleMatch[1];

          const docId = generateId('doc');
          await prisma.document.create({
            data: {
              id: docId,
              title,
              content: raw,
              source: 'vault',
              department: 'cos',
              filedBy: 'system',
              filePath,
            },
          });

          log.info({ docId, file, title }, 'Vault file indexed on startup');
        }
      }
    } catch (err) {
      log.error({ err }, 'Vault file sync failed');
    }

    // 4. Check onboarding state — skip agent seeding and orchestrator during onboarding
    let onboardingActive = false;
    try {
      const { isOnboardingActive } = await import('./lib/onboarding/detection');
      onboardingActive = isOnboardingActive();
      if (onboardingActive) {
        log.info('Onboarding mode active -- skipping agent seeding and orchestrator init');
      }
    } catch (err) {
      log.error({ err }, 'Onboarding detection failed, proceeding with normal startup');
    }

    if (!onboardingActive) {
      // 4a. Seed executive agents to DB (idempotent)
      try {
        const { seedAgents } = await import('./lib/seed-agents');
        await seedAgents();
        log.info('Executive agents seeded');
      } catch (err) {
        log.error({ err }, 'Agent seeding failed');
      }

      // 4b. Seed gallery data (MCP servers + skills)
      try {
        const { seedGallery } = await import('./lib/seed-gallery');
        await seedGallery();
        log.info('Gallery data seeded (MCP servers + skills)');
      } catch (err) {
        log.error({ err }, 'Gallery seeding failed');
      }

      // 5. Initialize orchestrator with all agent configs
      try {
        const { initOrchestrator } = await import('./lib/orchestrator');
        await initOrchestrator();
        log.info('Orchestrator initialized with agent configs');
      } catch (err) {
        log.error({ err }, 'Orchestrator initialization failed');
      }

      // 5.2. Pre-warm Tamir standby sessions (non-blocking)
      try {
        const { tamirStandby } = await import('./lib/tamir-standby');
        tamirStandby.init().then(() => {
          log.info('Tamir standby sessions pre-warmed');
        }).catch((err) => {
          log.error({ err }, 'Tamir standby pre-warm failed (non-fatal)');
        });
      } catch (err) {
        log.error({ err }, 'Tamir standby import failed');
      }
    }

    // 5.5. Initialize Langfuse OTel tracing (D-07, must be before worker loop per Pitfall 1)
    try {
      const { initLangfuse } = await import('./lib/langfuse');
      await initLangfuse();
      log.info('Langfuse tracing initialized');
    } catch (err) {
      log.error({ err }, 'Langfuse initialization failed');
    }

    // 6. Start worker loop (fire-and-forget, does not block startup)
    try {
      startWorkerLoop();
      log.info('Worker loop started');
    } catch (err) {
      log.error({ err }, 'Worker loop start failed');
    }

    // 6.5. Schedule daily company memory consolidation (shadow Tamir agent)
    // Uses 24h setInterval instead of node-cron to avoid extra dependency
    try {
      const { triggerCompanyConsolidation } = await import('./lib/company-refresh');
      const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
      setInterval(() => {
        log.info('Running daily company memory consolidation');
        triggerCompanyConsolidation();
      }, TWENTY_FOUR_HOURS_MS);
      log.info('Daily company consolidation scheduled (every 24h)');
    } catch (err) {
      log.error({ err }, 'Company consolidation schedule setup failed');
    }

    // 6.6. Schedule daily catalog recompilation for all departments + vault
    try {
      const { compileCatalog, compileVaultCatalog } = await import('./lib/catalog');
      const catalogDepts = ['cos', 'tech', 'marketing', 'operations'];
      const CATALOG_INTERVAL_MS = 24 * 60 * 60 * 1000;
      setInterval(() => {
        log.info('Running daily catalog recompilation');
        for (const dept of catalogDepts) {
          try {
            const stats = compileCatalog(dept);
            log.info({ dept, ...stats }, 'Catalog recompiled');
          } catch (err) {
            log.error({ err, dept }, 'Catalog recompilation failed');
          }
        }
        // Vault catalog
        try {
          const vaultStats = compileVaultCatalog();
          log.info({ ...vaultStats }, 'Vault catalog recompiled');
        } catch (err) {
          log.error({ err }, 'Vault catalog recompilation failed');
        }
      }, CATALOG_INTERVAL_MS);
      log.info('Daily catalog recompilation scheduled (every 24h)');
    } catch (err) {
      log.error({ err }, 'Catalog recompilation schedule setup failed');
    }

    // 6.7. Start routine scheduler (loads active routines from DB)
    try {
      const { startRoutineScheduler } = await import('./lib/routine-scheduler');
      await startRoutineScheduler();
      log.info('Routine scheduler started');
    } catch (err) {
      log.error({ err }, 'Routine scheduler start failed');
    }

    log.info('Cortex server initialization complete');
  }
}
