# NASA Space Apps 2026 Video Briefing & SME Context
**Source Video:** 2026 Challenge | Field Shift: Adapting Farms with NASA Data  
**URL:** https://www.youtube.com/watch?v=cF0U2WXsM7o  
**Origin:** NASA Johnson Space Center (JSC) — Earth Science & Remote Sensing Unit / Mission Integration

---

## 1. Core Narrative & Problem Framing
* **Changing Baseline Conditions [00:00:18]:** Agricultural conditions beneath our feet are shifting rapidly—characterized by rising heat shifts, erratic rainfall patterns, declining water certainty, and soil nutrient loss. Farmers face urgent decisions on what to plant next under compounding environmental pressures.
* **Earth as a Multi-Scale Signal System [00:00:44]:** NASA's public Earth observation datasets capture critical environmental signals—rainfall, soil moisture, surface heat, vegetation health, and water storage. While these observations operate at different spatial and temporal scales, they represent interconnected pieces of the same agronomic story.
* **The Core Mission [00:01:12]:** Transform multi-scale NASA Earth observations into an actionable exploration tool that determines "what could come next" for a farm:
  * **Compare** crop rotations side-by-side.
  * **Reveal** multi-objective trade-offs.
  * **Understand** environmental and agronomic risk.
  * **Make uncertainty visible** rather than hiding it behind black-box predictions.
* **Permitted Deliverable Archetypes [00:01:21]:** An SI (Synthetic Intelligence / Statistical Inference / AI) model, an interactive geospatial map, a multi-layered data visualization, a comprehensive decision-support application, or a novel hybrid architecture.

---

## 2. Challenge Authors & Subject Matter Experts (Evaluator Lenses)
Understanding the backgrounds of the NASA Johnson Space Center challenge creators and SMEs reveals what technical qualities the judging panel values:

1. **Sadie Burnett Boudreaux (Challenge Author — Engineer & Developer, NASA JSC) [00:01:58]:**
   * *Background:* Artemis mission management, Moon Base payload utilization integration, Low Earth Orbit (LEO) research integration.
   * *Architectural Lens:* Systems integration, operational readiness, translating complex scientific telemetry into mission-ready decision workflows.
2. **Anand Gokhale (Data Solutions Architect, NASA JSC) [00:02:34]:**
   * *Background:* Data solutions architecture, custom web application development, and innovative workflow tooling for payload and orbital operations.
   * *Architectural Lens:* Clean data pipelines, scalable custom web app architecture, intuitive user workflows, and responsive frontend/backend integration.
3. **William Stefanov (Senior Earth System Scientist & Challenge SME, NASA JSC) [00:02:50]:**
   * *Background:* Remote sensing science and Earth imagery analysis from the International Space Station (ISS) for disaster response and environmental monitoring.
   * *Architectural Lens:* Scientific rigor in remote sensing, accurate interpretation of multi-spectral/thermal imagery, and actionable hazard/vulnerability mapping.
4. **Alex Token (Data Scientist & ML Domain Expert, NASA JSC — Earth Science & Remote Sensing Unit) [00:03:13]:**
   * *Background:* Applying machine learning models to astronaut photography and Earth observation imagery to extract structured, high-value information for downstream scientific and operational use.
   * *Architectural Lens:* Robust ML feature extraction from Earth imagery, multi-resolution data fusion, model explainability, and uncertainty quantification.

---

## 3. Key Video Directives for the AI Architect
When designing the system architecture and codebase, explicitly align with the video's core mandates:
1. **Synthesize "Different Scales, Same Story":** Explicitly show how coarse-scale regional signals (e.g., SMAP/GPM/GRACE) and fine-scale field signals (e.g., Landsat/ECOSTRESS/ISS imagery) are fused into a unified field-level narrative.
2. **Visibility of Uncertainty:** Do not output deterministic single-number crop recommendations. Every rotation comparison must visually and quantitatively expose confidence intervals, climate variance, and data blind spots.
3. **Trade-Off Transparency:** Present clear trade-off matrices (e.g., water saved vs. nitrogen fixed vs. short-term cash flow) so the farmer remains the active decision-maker.