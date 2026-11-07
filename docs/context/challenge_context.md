# NASA Space Apps 2026 Challenge Specification
**Challenge Title:** Field Shift: Adapting Farms with NASA Data  
**Domain:** Earth Observation, Precision Agriculture, Spatio-Temporal Data Fusion, Decision-Support Systems (SI/ML)  
**NASA SME Focus (Johnson Space Center):** Remote sensing science, machine learning over Earth imagery, custom web app/data architecture, and disaster/environmental response.

---

## 1. Executive Summary & Core Mandate
Farmers globally face shifting temperatures, erratic rainfall patterns, water shortages, extreme weather, erosion, and declining soil health. Selecting new crops for a rotation is high-risk: a crop that improves soil health in one location may consume excessive water, introduce disease, conflict with local markets, or fall outside viable growing seasons in another.

**Primary Objective:** Create a farmer-centered decision-support tool (app, model, interactive map, or analytical platform) that fuses NASA Earth observations with local soil data, crop traits, and farmer priorities to explore resilient crop-rotation strategies.

**Core Design Philosophy:** The system must act as a supportive exploratory tool that identifies patterns, trade-offs, and possibilities—it must **never** replace farmer judgment or local agricultural extension expertise.

---

## 2. Target Datasets & Environmental Signals

### NASA Earth Observation Datasets
* **SMAP:** Soil moisture (surface and root-zone) and freeze/thaw state.
* **ECOSTRESS:** Land-surface temperature (LST), plant heat stress, and evaporative stress index.
* **GPM:** Precipitation rates, rainfall shifts, and extreme precipitation events.
* **Landsat & MODIS:** Surface reflectance, vegetation indices (e.g., NDVI), bare-soil detection, and seasonal phenology.
* **NASA POWER:** Agroclimatology parameters, solar radiation, temperature extremes, frost risk, and evaporation/evapotranspiration.
* **GRACE & GRACE-FO:** Long-term terrestrial water storage trends and groundwater/aquifer depletion signals.
* **SRTM / NASA Elevation Products:** Topography, slope, aspect, and erosion/runoff vulnerability.
* **GEDI:** Aboveground biomass and canopy structure.

### Local & Agronomic Inputs
* **Local Soil Information:** Soil texture, organic matter, nutrient levels, infiltration capacity, and ground-based measurements.
* **Crop Characteristics:** Functional categories (nitrogen-fixing crops, cover crops, deep-rooting crops, drought-tolerant crops), water demand, growing season windows, and pest/disease susceptibility.
* **Farmer Priorities & Constraints:** Water conservation, forage value, nitrogen fixation, erosion reduction, organic matter improvement, supplemental income, market suitability, and equipment limitations.

---

## 3. Core Functional Deliverables
1. **Vulnerability & Temporal Window Detection:**
   * Identify periods when fields are typically left bare (fallow/exposed soil windows).
   * Highlight seasons when current crops exhibit elevated vulnerability or environmental stress.
   * Pinpoint opportunities for rotations that interrupt pest cycles, lower water demand, improve soil water infiltration, or generate supplemental income.
2. **Multi-Strategy Rotation Comparison (Minimum 3 Strategies):**
   * Compare **at least three (3) rotation strategies**, explicitly including the **existing/baseline rotation**.
   * For *each* strategy, the tool must output:
     * **Rationale:** Why the rotation was suggested.
     * **Supporting Evidence:** Specific historical or satellite signals backing the recommendation.
     * **Projected Benefits & Trade-offs:** Impacts on water use, nutrient cycling, erosion risk, organic matter, pest disruption, forage, and market fit.
     * **Information Gaps & Uncertainty:** Known blind spots in remote sensing or model confidence.
     * **Local Review Flags:** Specific risks requiring validation by the farmer or local agricultural experts.

---

## 4. Technical & Design Considerations (Rubric Alignment)

### A. Understanding Conditions & Data Literacy
* Map relationships between temperature, soil moisture, rainfall, evaporation, and vegetation stress against crop vulnerability and soil health.
* Translate scientific terms into accessible insights: *evapotranspiration*, *soil moisture anomalies*, *vegetation indices (NDVI)*, *frost risk*, and *water-balance indicators*.
* Explicitly distinguish satellite observations (spatial/temporal averages, surface/canopy signals) from ground-based measurements (point-specific root/subsurface reality), and show how combining both improves accuracy.

### B. SI (Synthetic Intelligence / Statistical Inference), Modeling & Data Fusion
* **Resolution Harmonization:** Downsample, aggregate, or resample disparate spatial and temporal resolutions onto a **Common Analysis Grid (CAG)** to combine SMAP, ECOSTRESS, GPM, Landsat/MODIS, GEDI, elevation, and local soil datasets into coherent model features.
* **Pattern Recognition:** Compare statistical or SI approaches to detect historical climate shifts, seasonal transitions, bare-field periods, and crop stress anomalies.
* **Uncertainty & Explainability:** Clearly communicate how the model interprets uncertainty and pinpoint where local human validation is required.

### C. Rotation Strategy & Agronomic Logic
* Evaluate scenarios across multiple dimensions: nutrient cycling, erosion risk, organic matter contributions, pest-cycle disruption, water consumption, forage potential, and market viability.
* Map specific rotation options directly to user-selected farmer priorities.
* Explain the biological and physical mechanisms of how **nitrogen-fixing crops**, **cover crops**, **deep-rooting crops**, and **drought-tolerant crops** build long-term soil resilience.

### D. Geospatial Mapping & Interactive Visualization
* Provide interactive maps displaying multi-year trends (soil moisture trajectories, heat wave frequency, terrestrial water-storage declines).
* Visualize field-level vulnerability micro-zones (erosion-prone slopes, water-stress hotspots, frost-prone depressions).
* Include interactive exploration controls: historical timelines, dataset comparison overlays, and "What-If" scenario sliders (e.g., adjusting future rainfall or temperature baselines).

### E. Farmer-Centered UX & Human-in-the-Loop Safeguards
* Design for high usability and low cognitive load so farmers without GIS or data science backgrounds can immediately interpret outputs.
* Provide intuitive input controls for farmer-specific constraints (water quotas, machinery/equipment availability, local market preferences).
* Embed clear, recurring reminders that the system is a decision-support aid—highlighting exact decision points where local agronomic judgment takes precedence.