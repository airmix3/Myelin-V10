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

    // 2. Ensure planning desk directories (FOUND-11)
    try {
      ensurePlanningDesks();
      log.info('Planning desks ensured');
    } catch (err) {
      log.error({ err }, 'Planning desk creation failed');
    }

    // 2.5. Ensure manager desks and dept tool/skill directories
    try {
      ensureManagerDesks();
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

    // 4. Seed executive agents to DB (idempotent)
    try {
      const { seedAgents } = await import('./lib/seed-agents');
      await seedAgents();
      log.info('Executive agents seeded');
    } catch (err) {
      log.error({ err }, 'Agent seeding failed');
    }

    // 4.5. Seed gallery data (MCP servers + skills)
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

    log.info('Cortex server initialization complete');
  }
}
