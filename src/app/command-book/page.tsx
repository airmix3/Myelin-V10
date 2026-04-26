import { readFileSync } from 'fs';
import { join } from 'path';
import { marked } from 'marked';
import GuidedReader, { type ReaderChapter, type ReaderSection } from './GuidedReader';

export const metadata = {
  title: 'Executive Assistant Command Reader - Cortex',
  description:
    'A guided Kindle-like reader for the Executive Assistant, Command Layer, and Cortex synergy documents.',
};

type SourceChapter = {
  id: string;
  part: string;
  title: string;
  shortTitle: string;
  path: string;
  arc: string;
};

const sourceChapters: SourceChapter[] = [
  {
    id: 'executive-assistant',
    part: 'Part 01',
    title: "Executive Assistant: Tamir's Second Mode",
    shortTitle: 'Executive Assistant',
    path: 'docs/21_EXECUTIVE_ASSISTANT.md',
    arc: 'The personal operating layer',
  },
  {
    id: 'system-spec',
    part: 'Part 02',
    title: 'Executive Assistant System Requirements',
    shortTitle: 'EA System Spec',
    path: 'docs/22_EXECUTIVE_ASSISTANT_SYSTEM_SPEC.md',
    arc: 'The implementation contract',
  },
  {
    id: 'game',
    part: 'Part 03',
    title: 'The Game That Was Always There',
    shortTitle: 'The Game',
    path: 'docs/THE_GAME_THAT_WAS_ALWAYS_THERE.md',
    arc: 'The command metaphor',
  },
  {
    id: 'command-layer',
    part: 'Part 04',
    title: 'Command Layer Requirements',
    shortTitle: 'Command Layer',
    path: 'docs/20_COMMAND_LAYER_IMPLEMENTATION.md',
    arc: 'The product requirements',
  },
  {
    id: 'synergy',
    part: 'Part 05',
    title: 'Command Layer, Executive Assistant, and Cortex Synergy',
    shortTitle: 'Synergy',
    path: 'docs/23_COMMAND_EA_CORTEX_SYNERGY.md',
    arc: 'The unified model',
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function splitIntoSections(raw: string) {
  const lines = raw.split('\n');
  const sections: { title: string; markdown: string }[] = [];
  let currentTitle = 'Opening';
  let currentLines: string[] = [];

  for (const line of lines) {
    const heading = /^##\s+(.+)$/.exec(line);

    if (heading) {
      if (currentLines.some((item) => item.trim().length > 0)) {
        sections.push({ title: currentTitle, markdown: currentLines.join('\n').trim() });
      }

      currentTitle = heading[1].trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.some((item) => item.trim().length > 0)) {
    sections.push({ title: currentTitle, markdown: currentLines.join('\n').trim() });
  }

  return sections;
}

function annotateHeadings(markdown: string, chapterId: string, sectionIndex: number) {
  const usedIds = new Map<string, number>();

  return markdown
    .split('\n')
    .map((line) => {
      const match = /^(#{1,4})\s+(.+)$/.exec(line);
      if (!match) return line;

      const level = match[1].length;
      const title = match[2].trim();
      const base =
        slugify(`${chapterId}-${sectionIndex + 1}-${title}`) ||
        `${chapterId}-${sectionIndex + 1}-section`;
      const count = usedIds.get(base) ?? 0;
      usedIds.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count + 1}`;

      return `<h${level} id="${id}">${title}</h${level}>`;
    })
    .join('\n');
}

function plainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]+]\([^)]+\)/g, (match) => match.replace(/^\[|\]\([^)]+\)$/g, ''))
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_>#|~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readingMinutes(markdown: string) {
  const words = plainText(markdown).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function loadReaderData() {
  let globalIndex = 0;

  const chapters: ReaderChapter[] = sourceChapters.map((chapter, chapterIndex) => {
    const raw = readFileSync(join(process.cwd(), chapter.path), 'utf8');
    const sections = splitIntoSections(raw).map((section, sectionIndex): ReaderSection => {
      const text = plainText(section.markdown);
      const id = `${chapter.id}-${sectionIndex + 1}`;
      const html = marked.parse(annotateHeadings(section.markdown, chapter.id, sectionIndex), {
        async: false,
        gfm: true,
      }) as string;

      return {
        id,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        title: section.title,
        index: globalIndex++,
        localIndex: sectionIndex,
        readMinutes: readingMinutes(section.markdown),
        preview: text.split(' ').slice(0, 26).join(' '),
        html,
      };
    });

    return {
      ...chapter,
      chapterIndex,
      sections,
      sectionCount: sections.length,
      totalMinutes: sections.reduce((total, section) => total + section.readMinutes, 0),
    };
  });

  return {
    chapters,
    sections: chapters.flatMap((chapter) => chapter.sections),
  };
}

export default function CommandBookPage() {
  const data = loadReaderData();

  return <GuidedReader chapters={data.chapters} sections={data.sections} />;
}
