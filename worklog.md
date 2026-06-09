---
Task ID: 1
Agent: Main Agent
Task: Refactor Academia Helm portal page with interactive Benin map (inspired by EducMaster)

Work Log:
- Analyzed reference site https://emp.educmaster.bj/ using web-reader and VLM screenshot analysis
- Captured full-page screenshot and detailed description of EducMaster's layout, map, features, color palette
- Explored current portal page code at /next-app/src/app/portal/page.tsx (895 lines)
- Identified Academia Helm color palette: NAVY=#1E3A5F, GOLD=#C9A84C, NAVY_DARK=#0D1F6E
- Fetched schools API data: 2 schools currently, both in Bénin, no city/department data
- Created /next-app/src/data/benin-departments.ts with all 12 departments data (stats, communes, etc.)
- Created /next-app/src/components/portal/BeninMap.tsx - Interactive SVG map with:
  - Choropleth coloring by school count
  - Hover tooltips with department stats
  - Click selection with detail panel
  - Framer Motion animations
  - Filter tabs (Tous/Public/Privé)
  - Legend bar
  - Department detail panel with stats, public/private bars, communes
- Refactored /next-app/src/app/portal/page.tsx with new layout:
  - Section 1: Welcome + Stats (Apprenants, Enseignants, Écoles) + Benin Map
  - Section 2: Trois axes du SIGE (Suivre, Piloter, Décider)
  - Section 3: Portal selection cards + School search flow
  - Section 4: Notre Mission section + Security badge
  - Benin tricolor stripe (Vert/Jaune/Rouge)
  - Dev mode login preserved
- TypeScript compiles with 0 errors

Stage Summary:
- New files: /next-app/src/data/benin-departments.ts, /next-app/src/components/portal/BeninMap.tsx
- Modified: /next-app/src/app/portal/page.tsx (complete refactor)
- All features from EducMaster adapted: interactive map, stats, filter tabs, department details, axes cards, mission section
- Color palette: Academia Helm Navy/Gold throughout
- Animations: Framer Motion for hover, selection, transitions
- Accessible: keyboard navigation, ARIA labels, reduced motion support
