# Myelin Brand Visual Identity

**Version**: 1.0
**Date**: 2026-03-27
**Status**: Established during brand vision video project

---

## Color Palette

### Primary Colors
| Color | Hex Code | Usage |
|-------|----------|-------|
| Deep Blue | `#1a1a2e` | Primary brand color, backgrounds, gradients |
| Electric Cyan | `#00d9ff` | Accent color, highlights, interactive elements, logo |
| Black | `#000000` | Backgrounds, UI base |
| White | `#ffffff` | Body text, code text |

### Secondary Colors
| Color | Hex Code | Usage |
|-------|----------|-------|
| Dark Gray | `#808080` | Secondary text, comments |
| Light Green | `#a8e6cf` | String literals in code examples |
| Gold | `#ffd700` | Property names in code examples |

### Color Usage Guidelines
- **Dark mode first**: All brand materials use dark backgrounds (black or deep blue)
- **Cyan as accent**: Use electric cyan sparingly for emphasis, calls-to-action, and brand moments
- **Gradients**: Linear gradients from black (#000000) to deep blue (#1a1a2e) at 135deg
- **Opacity patterns**:
  - Holographic UI elements: `rgba(0, 217, 255, 0.1)` backgrounds with `rgba(0, 217, 255, 0.3)` borders
  - Glows and shadows: `rgba(0, 217, 255, 0.4)` to `rgba(0, 217, 255, 0.8)`

---

## Typography

### Primary Font Family
**Inter** or **Poppins** (clean sans-serif)
- Available via Google Fonts
- Fallback: 'Segoe UI', system sans-serif

### Font Weights
- **Normal text**: 400 (regular)
- **Headings**: 600 (semi-bold) or 700 (bold)
- **Code**: Use monospace ('Courier New', 'Monaco', monospace)

### Type Scale (Video/Vertical Format)
- **Hero titles**: 48-60px
- **Section headings**: 36-40px
- **Body text**: 26-32px (mobile-first sizing)
- **Code snippets**: 38px (must be legible at 375px width)

### Typography Guidelines
- **Readability first**: Text must be legible on smallest phone screens (375px width)
- **Technical tone**: Sans-serif only, never decorative fonts
- **Letter-spacing**: Slight increase (1-2px) for headings to enhance readability
- **Line-height**: 1.6-1.8 for body text, tighter (1.2-1.4) for headings

---

## Logo Specifications

### Logo Concept
Neural network nodes connected by myelin sheath-like pathways. Geometric, technical, modern aesthetic.

### Logo Variants Required
1. **Icon only** (1024x1024, transparent background)
   - Use: Social media avatars, favicons, app icons
   - Format: PNG with transparency
   
2. **Horizontal wordmark** (transparent background)
   - Use: Website headers, email signatures, presentations
   - Layout: Icon on left, "MYELIN" wordmark on right
   - Aspect ratio: ~3:1
   
3. **Vertical lockup** (1080x1920)
   - Use: Mobile splash screens, video title cards
   - Layout: "MYELIN" wordmark stacked above icon
   - Background: Black or transparent

### Logo Colors
- **Primary**: Deep blue (#1a1a2e) + electric cyan (#00d9ff)
- **Monochrome version**: White or cyan on dark backgrounds
- **Light background version**: Deep blue on white (rare use case)

### Logo Generation Prompt (Reference)
```
Minimalist tech logo for "Myelin" — a brain-computer interface developer platform. Design concept: neural network nodes connected by myelin sheath-like pathways. Color palette: deep blue (#1a1a2e) + electric cyan (#00d9ff) on black background. Style: geometric, technical, modern. Suitable for dark-mode UI and social media profile. Vector-style flat design. No text, icon only.
```

---

## Visual Style

### Photography/Illustration Style
- **Photorealistic with cinematic color grading**: Blue and cyan tones
- **Technical but human**: Show developers using technology, not abstract concepts
- **Dark environments with accent lighting**: Blue screen glow, cyan rim lighting
- **Shallow depth of field**: Focus on subject, blur background
- **Professional quality**: Cinema camera aesthetic, not stock photo generic

### Motion Graphics Style
- **Subtle animations**: Floating elements, pulsing glows, particle effects
- **Holographic UI elements**: Transparent backgrounds with cyan borders, backdrop blur
- **Neural network motifs**: Nodes, pathways, signal waveforms as design elements
- **Slow, smooth motion**: Ease-in-out animations, avoid jarring transitions

### Iconography
- **Geometric and minimal**: Line-based icons, not filled
- **Technical accuracy**: Brain = 🧠, Lock = 🔐, Cloud = ☁️, Code = 💻
- **Consistent stroke width**: 2-3px for icon outlines
- **Privacy symbols**: Locks, shields, encryption indicators prominent in security-related content

---

## Brand Mood & Tone

### Visual Mood
- **Sophisticated, not flashy**: Technical elegance over sci-fi fantasy
- **Calm and confident**: Blue tones evoke trust and stability
- **Developer-focused**: Show code, terminals, technical interfaces
- **Privacy-forward**: Visual emphasis on encryption, security, zero-knowledge

### What to Avoid
- **Bright, saturated colors**: No reds, greens, purples (except as error/success states)
- **Gradients with too many colors**: Stick to 2-color gradients max
- **Stock photo generic**: Avoid cheesy "person pointing at screen" imagery
- **Sci-fi clichés**: No Matrix-style falling code, no brain-in-a-jar illustrations
- **Consumer device focus**: Don't show BCI headsets as the hero (show what developers build)

---

## UI/UX Patterns

### Button Styles
- **Primary CTA**: Electric cyan background, white text, no border
- **Secondary**: Transparent background, cyan border, cyan text
- **Hover states**: Subtle glow effect (`box-shadow: 0 0 20px rgba(0, 217, 255, 0.6)`)

### Code Syntax Highlighting
- **Keywords**: Cyan (#00d9ff)
- **Functions**: Cyan (#00d9ff)
- **Strings**: Light green (#a8e6cf)
- **Properties**: Gold (#ffd700)
- **Comments**: Gray (#808080)
- **Background**: Black or dark blue

### Spacing & Layout
- **Grid-based layouts**: 8px or 10px base unit
- **Generous whitespace**: Avoid cramped designs
- **Vertical rhythm**: Consistent spacing between sections (80-120px)
- **Mobile-first**: All layouts must work at 375px width

---

## Accessibility

### Contrast Ratios
- **Body text on black**: White (#ffffff) = WCAG AAA compliant
- **Cyan on black**: #00d9ff = WCAG AA compliant for large text
- **Avoid cyan for body text**: Too low contrast for extended reading

### Text Sizing
- **Minimum body text**: 16px (browser default) for web
- **Minimum mobile text**: 26px for video/vertical formats
- **Touch targets**: Minimum 44x44px for interactive elements

### Motion
- **Respect prefers-reduced-motion**: Disable animations for users who request it
- **Avoid rapid flashing**: No strobing effects or rapid color changes
- **Smooth easing**: Use ease-in-out, not linear or abrupt transitions

---

## File Formats & Delivery

### Raster Images
- **Format**: PNG with transparency preferred, JPEG for photos
- **Resolution**: 2x (retina) for all screen-displayed assets
- **Compression**: Optimize file sizes (use tinypng.com or similar)

### Video
- **Format**: MP4 (H.264 codec)
- **Vertical (mobile)**: 1080x1920 or 1440x2560
- **Horizontal (desktop)**: 1920x1080
- **Frame rate**: 30fps or 60fps
- **File size**: <50MB for social media uploads

### Vector Graphics
- **Format**: SVG for logos and icons
- **Optimization**: Remove unnecessary metadata, compress paths
- **Fallback**: Provide PNG versions for contexts that don't support SVG

---

## Brand Applications

### Social Media
- **X/Twitter header**: 1500x500, dark blue gradient background, logo or tagline
- **Profile picture**: Logo icon (1024x1024 circle crop)
- **Post graphics**: 1080x1080 (square) or 1080x1920 (vertical)

### Website
- **Dark theme only**: Black or deep blue backgrounds
- **Syntax-highlighted code examples**: Show real, working code
- **Developer-focused CTAs**: "View docs", "Try the API", "Read the source"

### Documentation
- **Code blocks**: Dark theme with cyan syntax highlighting
- **Diagrams**: Isometric or flat 2D, cyan and white on dark background
- **Screenshots**: Actual terminal/IDE screenshots, not mockups

---

## References

This brand identity was established during the Myelin brand vision video project (task_42a2e881, 2026-03-27). Source files and production examples are available in the marketing deliverables.

**Key deliverables**:
- `03-api-code-snippet.png` - Example of code syntax highlighting and holographic UI
- `04-data-flow-diagram.png` - Example of technical diagram style and iconography
- `VIDEO-PRODUCTION-BRIEF.md` - Complete brand guidelines in video production context

**Next steps**:
- Generate logo assets using documented prompts
- Create brand asset library (logo kit, color swatches, font pairings)
- Develop website/documentation design system based on these guidelines
