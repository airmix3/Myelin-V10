---
title: "Myelin: Zell Venture Proposal 2026"
type: founding-document
source: Zell_Venture_Proposal_Myelin.pdf
filed: 2026-03-26
---

# Myelin: Secure Enterprise Integration Layer for Neurotechnology

**Venue:** Zell Entrepreneurship Program — 2026 batch application
**Author:** Omer Shalev

**One-Liner:** Secure, hardware-agnostic integration layer bringing privacy-first Brain-Computer Interfaces to enterprises and applications.

---

## 1. The Problem: Enterprise Adoption Barriers in Non-Invasive BCI

Brain-computer interfaces (BCIs) are moving from research into real deployments, led by non-invasive EEG headsets that translate brain activity into software-ready signals (e.g., attention, fatigue, intent).

**Market size:** Global BCI market projected to grow from ~$2.94B in 2025 to $13.86B by 2035 (~16.77% CAGR). Non-invasive systems already represent ~82% of revenue (~$2.41B in 2025). Enterprise adoption is clustering first in safety- and fatigue-critical environments (aviation, trucking).

Two main barriers keep non-invasive BCIs from scaling:

### 1) Hardware Fragmentation

The BCI ecosystem is siloed. Each vendor (Emotiv, OpenBCI, Neurable, NextMind) ships its own interface and data formats. A team building one "focus" or "fatigue" app ends up maintaining multiple device integrations across devices with different channel counts, signal quality, and noise characteristics.

For enterprises: fleets can't mix brands or switch suppliers without custom engineering — creating vendor lock-in, slow rollouts, and high maintenance costs.

### 2) Privacy and Regulation

Raw EEG is not just "sensor data" — it's neural data that can support sensitive inferences about health, emotion, and cognition. Regulation is tightening: California updated CCPA in early 2025 to explicitly include "consumer's neural data" as sensitive personal information. This raises the barrier to entry for builders and makes enterprise deployments harder to approve and scale.

---

## 2. The Solution & UVP: One Integration Layer, Privacy by Design

Myelin builds a smart, secure, privacy-preserving integration layer between diverse BCI headsets and the applications that use them — dramatically lowering the barrier to building new application-layer BCI products.

**How it works:**
- Raw EEG stays on-device, processed inside a secure trusted edge compute environment
- Device-aware preprocessing and denoising
- Signal normalization across different sensors and channel counts
- Conversion into privacy-protected features
- Differential Privacy applied to reduce biometric "signature" leakage
- Homomorphic encryption used when external compute is required — analytics run without exposing the underlying signal
- Only anonymized, minimal, actionable outputs (e.g., focus level, stress) leave the device

**Result:** Developers never touch raw neural data. Enterprises never store biometric identifiers. Compliance is enforced by default in every integration — just like an API.

---

## 3. Market & Business Model

**Market sizing approach:** Target the friction in BCI software R&D and hardware integration, not top-down hardware sales.

- 3,000+ neuro-startups, academic labs, and enterprise fleets globally
- Estimated $450M wasted annually on in-house integration engineering and legal compliance
  - Calculation: 3,000 active BCI groups x 1 dedicated integration engineer @ $150,000/yr
- **SOM: $45M** — capturing ~10% of these early adopters

**Business Model: B2D (Business-to-Developer)**

Product branded as **BDaS (Brain Data as a Service)** / "Compliance-in-a-Box"

**Three target customer segments:**

1. **Enterprises** (safety-critical fleets — trucking, mining): Unify cognitive signals across mixed-brand headsets, reduce incidents, protect workforce privacy via on-device trusted processing.

2. **BCI startups, neuro-integrated apps & gaming studios**: License Myelin to integrate biosignals (stress, focus) without building custom hardware drivers, implementing neuro-algorithms, or managing raw neural data exposure.

3. **Research & clinical labs**: Aggregate multi-headset datasets out of the box, streamline IRB/privacy approval by keeping sensitive processing at the edge and exporting only approved outputs.

**Revenue model (Hybrid SaaS):**
Single metric: **Monthly Active Connections (MAC)**
- Fixed platform subscription (SDK + dashboard + compliance controls)
- Per-connection usage fee
- Scales from hundreds of enterprise workers to tens of thousands of consumers
- Analogy: Plaid for finances -> Myelin for brain data

---

## 4. The Moat & Why Me

**Network effects:** Not competing with hardware makers — we are their ultimate distribution channel.
- More headsets supported -> more developers build on platform
- More developers -> more enterprises adopt
- Each new integration makes the platform stickier for every participant

**Founder background (rare combination):**
- **Cybersecurity & cryptography:** Elite unit within the Prime Minister's Office
- **Neuroscience:** Hands-on EEG and fMRI research at Prof. Amir Amedi's lab across multiple acquisition setups and analysis pipelines

---

## 5. Roadmap & Go-to-Market

**Phase 1 — Build:**
- Raise small initial round
- Ship core privacy-first integration layer: signal normalization, preprocessing, plug-and-play neuro-algorithm framework, Differential Privacy module
- Obtain formal legal opinion covering CCPA and GDPR — validates compliance and establishes defensible moat

**Phase 2 — B2D Launch:**
- Go-to-market targeting neurotech application-layer startups (300+ globally) and university/research institutions (price-insensitive buyer with immediate integration pain)
- Raise seed round on early traction

**Phase 3 — Expansion (Enterprise & Gaming):**
- Expand into enterprise workforce safety deployments and gaming/XR studio integrations
- Leverage developer ecosystem and headset coverage from Phase 2 to drive top-down enterprise sales and platform-level partnerships
