# Founder Story Video — Creative Brief

**Producer:** Alex Chen (Technical Video Producer)
**CMO Oversight:** Brand direction, narrative arc, technical accuracy review
**Target Delivery:** Single 60-90 second video optimized for X/Twitter
**Audience:** Technical investors evaluating deep tech opportunities

---

## Objective

Create a founder story video that establishes Omer Shalev's technical credibility at the intersection of cryptography and neuroscience, demonstrates the rare expertise combination that makes Myelin defensible, and presents the BDaS value proposition as a logical conclusion of that expertise — not just a market opportunity.

**What success looks like:** A technical investor watches this and thinks "this person has the rare skillset to actually solve this problem" — not "interesting pitch."

---

## Audience Profile

**Primary:** Technical investors with deep tech evaluation experience
- Can evaluate technical moats (network effects, regulatory complexity, founder expertise)
- Understands cryptography, privacy architectures, and regulatory landscape (CCPA, GDPR)
- May have neuroscience or BCI domain knowledge, but not required
- Allergic to buzzwords, marketing fluff, and unsubstantiated claims
- Values: technical depth, concrete evidence, genuine expertise

**Anti-audience:** Consumer investors, generalist VCs without technical background, anyone looking for "easy story" pitches

---

## Tone and Brand Standards

### Tone: Technical Authority

- **Precision over persuasion:** Lead with facts, not feelings. "Published CVE-2019-18675 in the Linux kernel" not "discovered critical vulnerabilities"
- **Show over tell:** Code snippets, terminal output, brain scan imagery, architecture diagrams. Avoid talking heads and stock footage.
- **Concrete over abstract:** "Edge-local differential privacy" not "cutting-edge privacy technology"
- **Authentic voice:** This is a technical founder explaining a technical problem to technical peers, not a salesperson pitching

### Visual Style

- **Dark mode aesthetic:** Technical, developer-focused. Black backgrounds, monospace fonts, syntax highlighting
- **Data visualization:** EEG waveforms, signal processing pipelines, system architecture diagrams
- **Real artifacts:** Actual CVE disclosure pages, research lab equipment, code from Omer's GitHub, fMRI scans
- **Minimal motion graphics:** Use to clarify technical concepts (how edge processing works, what differential privacy does), not for decoration

### What NOT to do

- Generic stock footage (people in lab coats, brain imagery with glowing overlays, handshakes)
- Marketing buzzwords ("revolutionizing," "game-changing," "next-generation")
- Overpromising ("will transform healthcare" → "solves enterprise privacy barrier")
- Emotional storytelling tropes (dramatic music builds, inspirational voice-over)

---

## Narrative Structure (60-90 seconds)

### Hook (0:00-0:08) — The Rare Intersection
"Most people who understand cryptography don't understand neuroscience. Most neuroscientists don't understand cryptography. I do both."

**Visual:** Split screen or quick cuts:
- Left: Terminal with CVE disclosure, code editor with cryptographic algorithms
- Right: EEG signal acquisition, fMRI scan analysis, research lab setting

### Problem (0:08-0:25) — Why BCI Adoption is Blocked
"Brain-computer interfaces are moving from labs into real applications — trucking fleets monitoring driver fatigue, researchers running multi-device studies. Two things block adoption: hardware fragmentation and neural data privacy."

**Visual:**
- Multiple different EEG headsets (Emotiv, OpenBCI, Neurable) with incompatible connectors/specs
- Text overlay: "Every device = custom integration, different data formats, vendor lock-in"
- Regulatory text snippet (California CCPA amendment: "consumer's neural data")

### Expertise (0:25-0:45) — Why This Founder Can Solve It
"I spent years in the Prime Minister's Office elite cyber unit working on cryptographic systems and low-level OS security. Published a Linux kernel CVE affecting millions of devices. Then I went to Prof. Amir Amedi's neuroscience lab — EEG, fMRI, building tools for brain data analysis."

**Visual:**
- PMO work: terminal, code, security research artifacts
- Quick cut to CVE page (deshal3v.github.io/blog/kernel-research/mmap_exploitation)
- Research lab: EEG cap on participant, fMRI scanner, MCP server for scan analysis (mention from founder profile)
- Text overlay: "Elite crypto background + hands-on neuroscience research"

### Solution (0:45-1:15) — What Myelin Does
"Myelin is an integration layer for brain data. Raw EEG never leaves the device — all signal processing happens at the edge. Differential privacy applied at feature extraction. Hardware-agnostic normalization across different channel counts and sampling rates. Developers get privacy-protected features — focus, stress, intent — never raw neural data."

**Visual:**
- System architecture diagram:
  - Multiple headsets → Edge compute layer → Privacy layer → Application API
  - Annotations: "Raw signal stays local," "Differential Privacy," "Anonymized outputs only"
- Code snippet: Simple API call showing `myelin.getFocusLevel()` returning a clean JSON response
- Text overlay: "BDaS — Brain Data as a Service"

### Traction/Validation (1:15-1:25) — Where We Are
"Applied to Zell 2026 batch. Pre-seed stage. 300-day sprint to first paying customers."

**Visual:**
- Zell logo (if permissible) or text: "Zell Entrepreneurship Program 2026"
- Roadmap graphic: Phase 1 (Build) → Phase 2 (B2D Launch: Research Labs) → Phase 3 (Enterprise)

### CTA (1:25-1:30) — Next Step
"Building the privacy-first integration layer the BCI ecosystem needs. Let's talk."

**Visual:**
- Contact: omerhashalev@gmail.com
- Logo: Myelin (if exists, or just wordmark)
- Follow on X: @myelin (or @omerhashalev if company account doesn't exist yet)

---

## Source Materials

All materials are in `/home/omersh/myelin-gsd/data/vault/`:

1. **founder-profile-omer-shalev.md** — Complete career history, research roles, publications, CVE details
2. **company-dna.md** — Myelin's technical architecture, target customers, competitive landscape, brand philosophy
3. **zell-venture-proposal.md** — Market sizing, business model, moat, roadmap

Key facts to weave in:
- **CVE-2019-18675** in Linux kernel (millions of vulnerable devices)
- PMO Innovation Leader role (founded "Team Guava" — AI tech integration)
- BCT Lab researcher under Prof. Amir Amedi (autonomic nervous system, fMRI, neurofeedback)
- B.Sc. Computer Science at age 18, average 93, cryptography specialization
- Publication: "To See Them Only" — rootkit hiding method for x86 processors
- M.A. HCI (Human-Computer Interaction) at Reichman University
- Windsurfing: Israel youth national team, skipper + commercial captain license (only use if there's a natural place for personal detail — otherwise skip)

---

## X/Twitter Video Specifications

### Technical Requirements
- **Duration:** 60-90 seconds (max 2:20 allowed, but shorter performs better)
- **Aspect ratio:** 1:1 (square) or 9:16 (vertical) — better engagement than 16:9 landscape
- **Resolution:** 1080x1080 (square) or 1080x1920 (vertical)
- **File size:** Under 512MB
- **Format:** MP4 (H.264 video codec, AAC audio codec)
- **Captions:** Burned-in captions mandatory — 85% of X videos are watched without sound

### Engagement Best Practices
- **Hook in first 3 seconds:** The "rare intersection" line must land immediately or viewers scroll
- **Visual variety:** Cut every 3-5 seconds to maintain attention
- **Text overlays:** Key claims should appear as text, not just voiceover (technical investors will screenshot)
- **No intro logo sequence:** Start with content immediately
- **CTA at end:** Email address visible for at least 3 seconds

---

## Review Criteria

The CMO will review the video against these standards before approval:

### Technical Accuracy (Blocking)
- All claims about Omer's background must be verifiable from source documents
- Technical architecture description must match company-dna.md (edge processing, differential privacy, hardware-agnostic)
- No overpromising features or capabilities not in scope

### Brand Voice (Blocking)
- Tone is technical authority, not marketing pitch
- Visual style aligns with "precision, privacy, developer empowerment" brand pillars
- No buzzwords or generic "startup video" tropes

### Audience Fit (Blocking)
- Content assumes technical sophistication (doesn't over-explain cryptography or neuroscience basics)
- Value proposition is clear to someone evaluating deep tech moat
- CTA is appropriate for investor audience (email, not "sign up for beta")

### X/Twitter Optimization (Quality, not blocking)
- Hook in first 3 seconds captures attention
- Captions are readable on mobile
- Video length optimized for engagement (closer to 60 sec better than 90 sec)

---

## Deliverable Format

Submit the following:

1. **Final video file:** `founder-story-twitter-60s.mp4` (or .mov) meeting X/Twitter specs above
2. **Draft script/storyboard:** Markdown or PDF showing visual + audio for each segment (for CMO review before production)
3. **Asset sources:** List of all visual assets used (URLs for CVE pages, source of diagrams, code snippets, etc.) for verification
4. **Suggested tweet copy:** 1-2 options for the post that will accompany the video (max 280 chars, technical tone)

---

## Budget and Timeline

- **Budget:** Included in task budget ($10 default unless flagged)
- **Timeline:** Draft storyboard + script for CMO review → revisions → final production
- **Approval flow:** CMO reviews storyboard → approves or requests changes → CMO reviews final video → approves for delivery

---

## Notes for Producer

This is not a typical "founder story" video. The audience is technical investors who can evaluate deep tech moats. They care about founder expertise, technical architecture, and defensibility — not mission statements or inspirational storytelling.

Think of this as a technical demo that happens to introduce a founder, not a founder profile that happens to mention some technical details.

When in doubt: more specificity, less abstraction. More code and diagrams, less talking head footage. More "here's what I built," less "here's what I believe."

The founder's cryptography + neuroscience background is the story. The product (BDaS) is the logical outcome of that rare expertise applied to a genuine market gap.
