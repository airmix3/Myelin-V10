---
phase: quick-260329-hkk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/GalleryPanel.tsx
  - public/cortex.css
autonomous: true
requirements: [GALLERY-OVERLAY, GALLERY-SELECTION-INDICATOR]
must_haves:
  truths:
    - "Clicking a gallery card opens a centered overlay with detailed info about the tool/skill"
    - "Selected gallery items have a clearly visible green bounding box"
    - "Overlay can be dismissed by clicking outside, pressing Escape, or clicking a close button"
    - "Overlay shows name, description/summary, source, stars/installs, and a link to the original source (smithery.ai URL or skills.sh repo)"
  artifacts:
    - path: "src/components/GalleryPanel.tsx"
      provides: "Detail overlay component and green selection indicator"
    - path: "public/cortex.css"
      provides: "Overlay styles and enhanced selected card styles"
  key_links:
    - from: "GalleryPanel card click"
      to: "Detail overlay display"
      via: "onClick handler sets detailItem state, overlay renders when non-null"
---

<objective>
Add a detail overlay to the gallery panel that opens when clicking a tool/skill card, showing extended information sourced from smithery.ai or skills.sh. Also add a prominent green bounding box on selected items so selection state is unmistakable.

Purpose: Users need to understand what a tool/skill does before selecting it for a task. Currently cards show truncated info with no way to see more. Also, selected state needs to be more visually prominent.
Output: Updated GalleryPanel.tsx with overlay + green selection styling, updated cortex.css with overlay and selection styles.
</objective>

<execution_context>
@/home/omersh/myelin-gsd/.claude/get-shit-done/workflows/execute-plan.md
@/home/omersh/myelin-gsd/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/GalleryPanel.tsx
@public/cortex.css
@src/app/api/search/tools/route.ts
@src/app/api/search/skills/route.ts

<interfaces>
From src/components/GalleryPanel.tsx:
```typescript
interface GalleryItem {
  id: string;
  name: string;
  description: string;
  source: string;
  stars?: number;
  department?: string;
  status?: string;
  url?: string;
  summary?: string;
}
```

From src/app/api/search/tools/route.ts (smithery items):
- `url` field contains `item.homepage || https://smithery.ai/servers/${item.qualifiedName}`
- `stars` is `item.useCount`
- `description` from smithery API

From src/app/api/search/skills/route.ts (skills.sh items):
- `id` format: `skillssh-${repo}@${skillName}` (repo is like `owner/repo`)
- `description` field contains the repo path (e.g., `anthropics/courses`)
- `stars` is install count
- No `url` field currently — derive from id: `https://skills.sh/${repo}`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add detail overlay and green selection indicator to GalleryPanel</name>
  <files>src/components/GalleryPanel.tsx, public/cortex.css</files>
  <action>
**In `public/cortex.css`**, add these styles after the existing gallery-card section (~line 601):

1. `.gallery-card.selected` — enhance with `box-shadow: 0 0 0 2px var(--green), 0 0 8px rgba(0,214,143,0.3)` for a glowing green bounding box effect. Keep existing `border-color: var(--green)` and `background: rgba(0,214,143,0.06)`.

2. `.gallery-overlay-backdrop` — fixed position full screen, `background: rgba(0,0,0,0.6)`, `z-index: 1000`, flex centered, `backdrop-filter: blur(2px)`.

3. `.gallery-overlay` — approximately 400x400px (`width: 400px; max-height: 80vh`), `background: var(--bg)`, `border: 1px solid var(--border)`, `border-radius: 8px`, `padding: 24px`, `overflow-y: auto`, `box-shadow: 0 8px 32px rgba(0,0,0,0.4)`.

4. `.gallery-overlay-header` — flex row, justify space-between, align center, margin-bottom 16px.

5. `.gallery-overlay-close` — 28x28px button, no border, `background: var(--bg-tertiary)`, `border-radius: 4px`, `color: var(--text-dim)`, `cursor: pointer`, hover: `color: var(--text)`.

6. `.gallery-overlay-meta` — flex column gap 12px for the detail fields.

7. `.gallery-overlay-field` — label in `font-size: 10px; text-transform: uppercase; color: var(--text-dim); letter-spacing: 0.5px; margin-bottom: 2px`, value in `font-size: 13px; color: var(--text); line-height: 1.5`.

8. `.gallery-overlay-link` — `color: var(--accent); text-decoration: none; font-size: 12px`, hover: `text-decoration: underline`.

**In `src/components/GalleryPanel.tsx`**:

1. Add state: `const [detailItem, setDetailItem] = useState<GalleryItem | null>(null);`

2. On each gallery card, change the `onClick` to a two-action handler:
   - Single click opens the detail overlay: `onClick={() => setDetailItem(item)}`
   - Move selection toggle into the overlay (add a "Select" / "Deselect" button inside the overlay)

3. Create the overlay JSX (render at the bottom of the component return, conditionally when `detailItem` is non-null):
   ```
   {detailItem && (
     <div className="gallery-overlay-backdrop" onClick={() => setDetailItem(null)}>
       <div className="gallery-overlay" onClick={(e) => e.stopPropagation()}>
         <div className="gallery-overlay-header">
           <div>
             <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>{detailItem.name}</div>
             <span className="badge" style={{ fontSize: '10px', marginTop: '4px' }}>{detailItem.source}</span>
           </div>
           <button className="gallery-overlay-close" onClick={() => setDetailItem(null)}>X</button>
         </div>
         <div className="gallery-overlay-meta">
           {/* Description field - show full text, no truncation */}
           <div className="gallery-overlay-field">
             <div>Description</div>
             <div>{detailItem.description}</div>
           </div>
           {/* Summary field if available */}
           {detailItem.summary && (
             <div className="gallery-overlay-field">
               <div>Summary</div>
               <div>{detailItem.summary}</div>
             </div>
           )}
           {/* Stars/installs */}
           {detailItem.stars != null && detailItem.stars > 0 && (
             <div className="gallery-overlay-field">
               <div>{detailItem.source === 'skillssh' ? 'Installs' : 'Stars'}</div>
               <div>{detailItem.stars.toLocaleString()}</div>
             </div>
           )}
           {/* Department if company source */}
           {detailItem.department && (
             <div className="gallery-overlay-field">
               <div>Department</div>
               <div>{detailItem.department}</div>
             </div>
           )}
           {/* Source link */}
           <div className="gallery-overlay-field">
             <div>Source</div>
             <a className="gallery-overlay-link" href={getSourceUrl(detailItem)} target="_blank" rel="noopener noreferrer">
               View on {getSourceLabel(detailItem)}
             </a>
           </div>
         </div>
         {/* Select/Deselect button at bottom */}
         <button
           onClick={() => { toggleSelection(detailItem); setDetailItem(null); }}
           style={{
             marginTop: '20px', width: '100%', padding: '10px',
             background: isSelected(detailItem.id) ? 'transparent' : 'var(--green)',
             color: isSelected(detailItem.id) ? 'var(--text-dim)' : 'var(--bg)',
             border: isSelected(detailItem.id) ? '1px solid var(--border)' : 'none',
             borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
           }}
         >
           {isSelected(detailItem.id) ? 'Deselect' : 'Select for Task'}
         </button>
       </div>
     </div>
   )}
   ```

4. Add helper functions above the return:
   ```typescript
   function getSourceUrl(item: GalleryItem): string {
     if (item.url) return item.url;
     if (item.source === 'smithery') {
       const qualifiedName = item.id.replace('smithery-', '');
       return `https://smithery.ai/servers/${qualifiedName}`;
     }
     if (item.source === 'skillssh') {
       // id format: skillssh-owner/repo@skillName
       const repoSkill = item.id.replace('skillssh-', '');
       const repo = repoSkill.split('@')[0];
       return `https://skills.sh/${repo}`;
     }
     return '#';
   }

   function getSourceLabel(item: GalleryItem): string {
     if (item.source === 'smithery') return 'Smithery.ai';
     if (item.source === 'skillssh') return 'Skills.sh';
     return 'Company';
   }
   ```

5. Add Escape key handler via useEffect:
   ```typescript
   useEffect(() => {
     function handleKeyDown(e: KeyboardEvent) {
       if (e.key === 'Escape') setDetailItem(null);
     }
     if (detailItem) {
       document.addEventListener('keydown', handleKeyDown);
       return () => document.removeEventListener('keydown', handleKeyDown);
     }
   }, [detailItem]);
   ```

6. Keep the existing card onClick for toggling selection as-is, but ALSO add an info button (small "i" icon) on each card that opens the detail overlay without toggling selection. Alternatively, simpler approach: card click opens overlay, overlay has the select/deselect button. This way users get info first, then decide. Update the card's `onClick` from `toggleSelection(item)` to `setDetailItem(item)`.

7. For the green selection indicator on cards: remove the inline `border` style from the card div (line 241) and let the CSS class `.gallery-card.selected` handle it via the enhanced box-shadow. The inline style currently overrides the CSS — remove the `border:` from the inline style object entirely and rely on the CSS class.
  </action>
  <verify>
    <automated>cd /home/omersh/myelin-gsd && npx next build 2>&1 | tail -5</automated>
  </verify>
  <done>
    - Clicking a gallery card opens a centered ~400x400px overlay with full name, description, summary, stars/installs, department, and a link to smithery.ai or skills.sh
    - Overlay dismisses via clicking outside, Escape key, or X button
    - Overlay contains a Select/Deselect button that toggles selection and closes the overlay
    - Selected cards have a prominent green glow/bounding box (box-shadow + border) that is clearly visible
    - No inline border styles override the CSS selection indicator
  </done>
</task>

</tasks>

<verification>
- Open planning screen at localhost:3011, start a task, navigate to gallery panel
- Search for tools/skills, verify cards render
- Click a card — overlay appears centered with full details
- Verify smithery tools show link to smithery.ai, skills.sh items link to skills.sh
- Click Select in overlay — card gets green glow, overlay closes
- Click selected card again — overlay shows Deselect option
- Press Escape or click outside overlay — overlay dismisses
- Verify green selection indicator is clearly visible (box-shadow glow)
</verification>

<success_criteria>
Gallery cards open a detail overlay on click showing full tool/skill information with source links. Selected items have an unmistakable green bounding box with glow effect. All overlay dismiss methods work (outside click, Escape, X button).
</success_criteria>

<output>
After completion, create `.planning/quick/260329-hkk-add-tool-skill-detail-overlay-on-gallery/260329-hkk-SUMMARY.md`
</output>
