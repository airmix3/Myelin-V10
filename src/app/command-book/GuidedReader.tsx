'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ListChecks,
  Minus,
  Plus,
} from 'lucide-react';
import styles from './page.module.css';

export type ReaderSection = {
  id: string;
  chapterId: string;
  chapterTitle: string;
  title: string;
  index: number;
  localIndex: number;
  readMinutes: number;
  preview: string;
  html: string;
};

export type ReaderChapter = {
  id: string;
  part: string;
  title: string;
  shortTitle: string;
  path: string;
  arc: string;
  chapterIndex: number;
  sectionCount: number;
  totalMinutes: number;
  sections: ReaderSection[];
};

type ReaderProps = {
  chapters: ReaderChapter[];
  sections: ReaderSection[];
};

const storageKey = 'cortex-command-reader-section';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function GuidedReader({ chapters, sections }: ReaderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [fontScale, setFontScale] = useState(1);
  const [chapterMenuOpen, setChapterMenuOpen] = useState(false);

  const activeSection = sections[activeIndex] ?? sections[0];
  const activeChapter =
    chapters.find((chapter) => chapter.id === activeSection.chapterId) ?? chapters[0];
  const completed = activeIndex;
  const progress = sections.length > 1 ? (activeIndex / (sections.length - 1)) * 100 : 0;

  const chapterStartIndexes = useMemo(() => {
    const map = new Map<string, number>();
    chapters.forEach((chapter) => {
      const first = chapter.sections[0];
      if (first) map.set(chapter.id, first.index);
    });
    return map;
  }, [chapters]);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;

    const parsed = Number.parseInt(saved, 10);
    if (Number.isFinite(parsed)) {
      setActiveIndex(clamp(parsed, 0, sections.length - 1));
    }
  }, [sections.length]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, String(activeIndex));
  }, [activeIndex]);

  useEffect(() => {
    const reader = document.getElementById('guided-reader-page');
    reader?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeIndex]);

  function goTo(index: number) {
    setActiveIndex(clamp(index, 0, sections.length - 1));
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Reading sequence">
        <div className={styles.brand}>
          <span className={styles.brandIcon}>
            <BookOpen size={18} aria-hidden="true" />
          </span>
          <div>
            <p>Guided Reader</p>
            <strong>Cortex Command Arc</strong>
          </div>
        </div>

        <div className={styles.sequenceLabel}>
          <ListChecks size={14} aria-hidden="true" />
          Step-by-step order
        </div>

        <nav className={styles.chapterList}>
          {chapters.map((chapter) => {
            const firstIndex = chapterStartIndexes.get(chapter.id) ?? 0;
            const isActive = chapter.id === activeChapter.id;
            const isComplete =
              chapter.sections.length > 0 &&
              activeIndex > chapter.sections[chapter.sections.length - 1].index;

            return (
              <button
                key={chapter.id}
                type="button"
                className={`${styles.chapterButton} ${isActive ? styles.chapterActive : ''}`}
                onClick={() => goTo(firstIndex)}
              >
                <span className={styles.chapterPart}>{chapter.part}</span>
                <span className={styles.chapterTitle}>{chapter.shortTitle}</span>
                <span className={styles.chapterArc}>{chapter.arc}</span>
                <span className={styles.chapterMeta}>
                  {isComplete ? (
                    <>
                      <Check size={13} aria-hidden="true" /> Complete
                    </>
                  ) : (
                    <>
                      {chapter.sectionCount} steps · {chapter.totalMinutes} min
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main id="guided-reader-page" className={styles.reader}>
        <div className={styles.topbar}>
          <button
            type="button"
            className={styles.mobileChapterToggle}
            onClick={() => setChapterMenuOpen((open) => !open)}
            aria-expanded={chapterMenuOpen}
          >
            {activeChapter.shortTitle}
            <ChevronDown size={15} aria-hidden="true" />
          </button>

          <div className={styles.controls} aria-label="Reading controls">
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setFontScale((value) => clamp(value - 0.06, 0.88, 1.22))}
              aria-label="Decrease text size"
              title="Decrease text size"
            >
              <Minus size={15} aria-hidden="true" />
            </button>
            <span className={styles.controlText}>{Math.round(fontScale * 100)}%</span>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setFontScale((value) => clamp(value + 0.06, 0.88, 1.22))}
              aria-label="Increase text size"
              title="Increase text size"
            >
              <Plus size={15} aria-hidden="true" />
            </button>
          </div>
        </div>

        {chapterMenuOpen && (
          <div className={styles.mobileChapterMenu}>
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => {
                  goTo(chapterStartIndexes.get(chapter.id) ?? 0);
                  setChapterMenuOpen(false);
                }}
              >
                <span>{chapter.part}</span>
                {chapter.shortTitle}
              </button>
            ))}
          </div>
        )}

        <div className={styles.progressTrack} aria-hidden="true">
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>

        <section className={styles.hero} aria-label="Reader introduction">
          <p className={styles.eyebrow}>Five documents · one guided sequence</p>
          <h1>Executive Assistant, Command Layer, and Cortex Synergy</h1>
          <p>
            Read the material as a deliberate path: first the Executive Assistant concept,
            then its system spec, then the game metaphor, the Command Layer requirements,
            and finally the unified Cortex model.
          </p>
        </section>

        <article className={styles.page} style={{ ['--reader-scale' as string]: fontScale }}>
          <div className={styles.pageMeta}>
            <div>
              <span>{activeChapter.part}</span>
              <strong>{activeChapter.title}</strong>
            </div>
            <div className={styles.pageCount}>
              Step {activeIndex + 1} / {sections.length}
            </div>
          </div>

          <div className={styles.sectionHeader}>
            <p>{activeSection.readMinutes} min read</p>
            <h2>{activeSection.title}</h2>
            {activeSection.preview && <span>{activeSection.preview}</span>}
          </div>

          <div
            className={styles.prose}
            dangerouslySetInnerHTML={{ __html: activeSection.html }}
          />
        </article>

        <div className={styles.stepper}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => goTo(activeIndex - 1)}
            disabled={activeIndex === 0}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Previous
          </button>

          <div className={styles.stepSummary}>
            <span>{Math.round(progress)}% complete</span>
            <strong>{completed} sections finished</strong>
          </div>

          <button
            type="button"
            className={`${styles.navButton} ${styles.navButtonPrimary}`}
            onClick={() => goTo(activeIndex + 1)}
            disabled={activeIndex === sections.length - 1}
          >
            Next step
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>

        <section className={styles.sectionNavigator} aria-label="Sections in current document">
          <div className={styles.navigatorHeader}>
            <span>Current document</span>
            <strong>{activeChapter.shortTitle}</strong>
          </div>
          <div className={styles.sectionGrid}>
            {activeChapter.sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`${styles.sectionPill} ${
                  section.index === activeIndex ? styles.sectionPillActive : ''
                }`}
                onClick={() => goTo(section.index)}
              >
                <span>{section.localIndex + 1}</span>
                {section.title}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
