# Work Log: Benin Education Data Scraping (Task ID: 3)

## Date: 2026-03-05

## Objective
Scrape education data from two Benin government websites:
1. Primary/Maternelle: https://emp.educmaster.bj/
2. Secondaire: https://secondaire.educmaster.bj/

## Approach

### Step 1: Initial Page Fetching (web-reader)
- Used `z-ai page_reader` CLI to fetch HTML from all 6 URLs (main pages, /statistiques, /departements)
- Discovered both sites are Nuxt.js Single Page Applications (SPAs) that load data dynamically via API
- The static HTML contained no department-level data - only JavaScript framework code

### Step 2: Browser Automation (agent-browser)
- Used `agent-browser` to render the SPA pages and extract data from the dynamically-loaded content
- Found that the EMP site displays:
  - National KPIs: 2,293,903 apprenants, 63,305 enseignants, 17,141 écoles
  - Interactive Benin map with clickable departments
  - Side panel with department details including circonscriptions scolaires

### Step 3: API Endpoint Discovery
- Intercepted network requests using `agent-browser network requests --filter api`
- Discovered key API endpoints:
  - EMP: `https://emp.educmaster.bj/api/public/indicateurs-accueil?sous_systeme=all&statut=all&cycle=tous`
  - Secondaire: `https://secondaire.educmaster.bj/api/public/indicateurs-accueil?sous_systeme=all&statut=all`
- Both APIs return comprehensive JSON with department-level data

### Step 4: Data Extraction
- Fetched and parsed both API endpoints
- EMP data includes: 12 departments, 90 circonscriptions scolaires, public/private breakdown
- Secondaire data includes: 12 departments, public/private breakdown, no circonscription data
- Cycle-specific KPIs extracted via browser (Maternelle, CI-CP, CE, CM)
- Sub-system KPIs extracted via browser (ESG, ETFP)

### Step 5: Map/Visualization Description
- Both sites use interactive SVG choropleth maps of Benin
- EMP map color-codes by school count, with department labels
- Secondaire map uses 6-level discrete color scale with legend
- Both have filter buttons for status (Public/Private) and cycle/sub-system

## Data Summary

### Primary/Maternelle (EMP)
- **National**: 2,293,903 students, 63,305 teachers, 17,141 schools, 48.4% girls
- **By Cycle**: Maternelle (85,995), CI-CP (817,982), CE (792,020), CM (597,906)
- **12 Departments** with full breakdown (schools, students, teachers by public/private)
- **90 Circonscriptions Scolaires** with detailed stats

### Secondaire (MESTFP)
- **National**: 1,089,068 students, 53,341 teachers, 3,552 schools, 48.1% girls
- **By Sub-system**: ESG (1,066,386 students, 2,948 schools), ETFP (22,682 students, 604 schools)
- **12 Departments** with full breakdown (schools, students, teachers by public/private)
- No circonscription data available

## Files Created
- `/home/z/my-project/benin_education_data.json` - Comprehensive structured JSON output
- `/home/z/my-project/emp_data_clean.json` - Raw EMP API data
- `/home/z/my-project/secondaire_data_clean.json` - Raw Secondaire API data
- `/home/z/my-project/emp_main_page.png` - Screenshot of EMP main page
- `/home/z/my-project/secondaire_main_page.png` - Screenshot of Secondaire main page
- `/home/z/my-project/emp_map_default.png` - Screenshot of EMP map (all)
- `/home/z/my-project/emp_map_public.png` - Screenshot of EMP map (public filter)
- `/home/z/my-project/emp_map_prive.png` - Screenshot of EMP map (private filter)
- `/home/z/my-project/secondaire_map_default.png` - Screenshot of Secondaire map

## Key Findings
1. Both sites serve static JSON files via API endpoints (generated periodically, not real-time)
2. EMP data was generated: 2026-06-12 02:21:27
3. Secondaire data was generated: 2026-06-12T03:01:03.137Z
4. The API filtering parameters (cycle, statut, sous_systeme) appear to be ignored by the server - all return the same dataset
5. Client-side JavaScript handles the filtering/interactivity
6. The Secondaire site has no circonscription scolaire breakdown unlike the EMP site
7. The private sector dominates in urban departments (Atlantique, Littoral, Ouémé) especially in secondaire

---

# Work Log: Benin SVG Map - Accurate Department Boundaries (Task ID: 3b)

## Date: 2026-03-05

## Objective
Replace the approximate/hand-drawn SVG paths in the BeninMap component with geographically accurate SVG path data derived from real GeoJSON boundary data for all 12 Benin departments.

## Approach

### Step 1: Web Search for SVG/GeoJSON Sources
- Searched for "Benin departments SVG map", "Bénin départements carte SVG", "Benin GeoJSON departments", "Bénin 12 départements carte interactive"
- Found multiple data sources:
  - **Wikimedia Commons**: "Benin_departments_map_in_colors.svg" (couldn't download raw SVG directly)
  - **simplemaps.com**: Free SVG maps of Benin (404 on direct download)
  - **amCharts**: GeoJSON with 12 departments (downloaded successfully: `amcharts_benin.json`)
  - **geoBoundaries (wmgeolab/geoBoundaries)**: ADM1 simplified GeoJSON (downloaded successfully from GitHub: `benin_adm1.geojson`)
  - **data.humdata.org**: Humanitarian Data Exchange with Benin ADM1 boundaries

### Step 2: GeoJSON Data Acquisition
- Downloaded **geoBoundaries-BEN-ADM1_simplified.geojson** from GitHub (56,979 bytes)
  - Source: `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BEN/ADM1/geoBoundaries-BEN-ADM1_simplified.geojson`
  - License: CC-BY 4.0
  - Contains all 12 departments with 1,286 total coordinate points
  - Note: Some department names have typos in the data (Atakora→Atacora, Atlanique→Atlantique, Kouffo→Couffo, Oueme→Ouémé)
- Also downloaded **amCharts Benin GeoJSON** (36,042 bytes) for comparison
  - Contains 1,836 total points (more detailed)
  - Has proper accents (Ouémé) and ISO codes (BJ-AL, BJ-AK, etc.)
  - Name typos: Atakora→Atacora, Kouffo→Couffo

### Step 3: GeoJSON to SVG Path Conversion
- Wrote Python script to project geographic coordinates (WGS84 lon/lat) to SVG coordinates
- Used the existing component's viewBox (`0 0 360 400`) for consistency
- Projection: Equirectangular with Y-axis flip (standard for SVG)
- Geographic bounds: Lon 0.7687-3.8433, Lat 6.2107-12.4114
- Scale factor: ~61.93 pixels per degree
- Computed geographic centroids for label placement
- Generated optimized SVG path data using compact notation (no `L` prefix for line segments)

### Step 4: Data Comparison
| Source | Points | Names | Notes |
|--------|--------|-------|-------|
| Original (hand-drawn) | ~15-25 per dept | Correct | Very approximate polygons |
| geoBoundaries simplified | 80-300 per dept | Some typos | Accurate boundaries |
| amCharts | 66-279 per dept | Mostly correct | More detail, ISO codes |

Chose geoBoundaries as primary source (cleaner, well-maintained, CC-BY licensed).

### Step 5: Component Update
- Updated `BeninMap.tsx` (`/home/z/my-project/apps/web-app/src/components/portal/BeninMap.tsx`):
  - Replaced `DEPT_PATHS` constant with accurate GeoJSON-derived SVG paths
  - Updated `DEPT_LABELS` positions to use geographic centroids instead of manual estimates
  - Comment updated to reflect new data source: "geoBoundaries ADM1, accurate"
- Fixed department name typo in `benin-departments.ts`: "Kouffo" → "Couffo", capital "Aplahoué" → "Dogbo"

### Step 6: Standalone Files Generated
- `/home/z/my-project/benin_departments.svg` - Standalone SVG file (300×600 viewBox)
- `/home/z/my-project/beninDepartments.ts` - TypeScript data file with path data and metadata
- `/home/z/my-project/BeninMap.tsx` - Standalone React component

## Files Modified
- `/home/z/my-project/apps/web-app/src/components/portal/BeninMap.tsx` - Updated DEPT_PATHS and DEPT_LABELS with accurate data
- `/home/z/my-project/apps/web-app/src/data/benin-departments.ts` - Fixed "Kouffo" → "Couffo" and capital

## Files Created
- `/home/z/my-project/benin_adm1.geojson` - Source GeoJSON data (geoBoundaries)
- `/home/z/my-project/amcharts_benin.json` - Alternative GeoJSON data (amCharts)
- `/home/z/my-project/benin_departments.svg` - Standalone SVG map
- `/home/z/my-project/beninDepartments.ts` - TypeScript path data module
- `/home/z/my-project/BeninMap.tsx` - Standalone React component

## Geographic Accuracy Notes
- Northern departments (top): Alibori (NE), Atacora (NW), Borgou (E), Donga (W-center)
- Central departments (middle): Collines (W-center), Plateau (E-center), Zou (center)
- Southern departments (bottom): Atlantique (center), Littoral (tiny, coast), Mono (SW), Couffo (W), Ouémé (SE)
- Littoral is the smallest department (79 km², contains Cotonou)
- Benin is approximately 2:1 height-to-width ratio (tall, narrow country)
