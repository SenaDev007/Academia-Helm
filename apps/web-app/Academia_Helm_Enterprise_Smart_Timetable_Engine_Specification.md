
# ACADEMIA HELM
# ENTERPRISE SPECIFICATION
# SMART TIMETABLE ENGINE (STE)
Version: 1.0 Enterprise Architecture Draft

---

# TABLE OF CONTENTS

1. Executive Summary
2. Vision
3. Strategic Objectives
4. Business Requirements
5. Functional Scope
6. Actors
7. Core Concepts
8. Data Model
9. Academic Calendar Engine
10. Time Block Engine
11. Subject Engine
12. Teacher Engine
13. Availability Matrix
14. Classroom Engine
15. Constraint Engine
16. Constraint Classification
17. Pedagogical Rules
18. Administrative Rules
19. Resource Rules
20. Scheduling Algorithms
21. Optimization Pipeline
22. Conflict Detection
23. Conflict Resolution
24. Multi-Solution Generation
25. Manual Assisted Scheduling
26. Explainable AI Layer
27. Timetable Quality Scoring
28. Scenario Catalogue
29. UI/UX Specification
30. Database Schema
31. API Specification
32. Security
33. Audit Trail
34. Reporting
35. Exports
36. Performance Requirements
37. Roadmap

---

# 1. EXECUTIVE SUMMARY

The Smart Timetable Engine (STE) is an AI-assisted optimization engine capable of generating academic timetables automatically while respecting pedagogical, administrative, human, and logistical constraints.

The objective is not to create a timetable editor but a timetable reasoning system similar to the reasoning process of an experienced school administrator.

---

# 2. VISION

The system must:

- generate timetables automatically;
- explain its decisions;
- optimize teacher workload;
- optimize student learning conditions;
- minimize conflicts;
- support African educational realities;
- support complete institutional customization.

---

# 3. STRATEGIC OBJECTIVES

- Reduce timetable preparation time by 95%.
- Eliminate human scheduling errors.
- Support primary, secondary and higher education.
- Provide multiple optimized solutions.
- Learn institutional preferences over time.

---

# 4. BUSINESS REQUIREMENTS

The system shall support:

- one teacher per subject;
- multiple teachers per subject;
- shared teachers;
- temporary teachers;
- part-time teachers;
- evening classes;
- Saturday classes;
- special climate constraints;
- multi-campus institutions;
- specialized classrooms.

---

# 5. FUNCTIONAL SCOPE

The engine generates:

- class timetables;
- teacher timetables;
- room timetables;
- examination timetables;
- substitution timetables;
- supervision schedules.

---

# 6. ACTORS

- Administrator
- Director
- Timetable Manager
- Teacher
- Student
- Parent

---

# 7. CORE CONCEPTS

Definitions:

- Session
- Time block
- Constraint
- Preference
- Resource
- Availability
- Conflict
- Optimization score

---

# 8. DATA MODEL

Core entities:

- Institution
- AcademicYear
- Cycle
- Grade
- Section
- Class
- Subject
- Teacher
- Room
- Session
- Availability
- Constraint
- Timetable
- TimetableSolution

Relationships:

Teacher -> Subject
Teacher -> Availability
Class -> Subject
Room -> Session
Session -> Timetable

---

# 9. ACADEMIC CALENDAR ENGINE

Configurable:

- school days;
- holidays;
- examinations;
- vacations;
- public holidays;
- exceptional closures.

---

# 10. TIME BLOCK ENGINE

Examples:

| Block | Time |
|---|---|
| B1 | 08:00-10:00 |
| B2 | 10:15-12:15 |
| B3 | 15:00-17:00 |
| B4 | 16:00-18:00 (EPS) |

Capabilities:

- variable duration;
- integrated pauses;
- evening sessions;
- special sessions.

---

# 11. SUBJECT ENGINE

Parameters:

- weekly quota;
- session count;
- session duration;
- minimum interval;
- forbidden periods;
- preferred periods;
- priority score;
- room requirements.

Example:

Mathematics:
- 6h/week
- 3 sessions
- 2h/session
- no consecutive days
- avoid 08:00

---

# 12. TEACHER ENGINE

Properties:

- identity;
- specialization;
- workload;
- preferences;
- contractual limits;
- availability;
- campuses.

---

# 13. AVAILABILITY MATRIX

Status:

- AVAILABLE
- UNAVAILABLE
- PREFERRED
- FORBIDDEN
- RESERVED

Example matrix:

|Teacher|L1|L2|L3|M1|M2|M3|
|---|---|---|---|---|---|---|
|Math|O|X|P|O|O|X|

---

# 14. ROOM ENGINE

Support:

- classrooms;
- laboratories;
- workshops;
- sports facilities;
- shared rooms.

---

# 15. CONSTRAINT ENGINE

Two families:

## Hard Constraints
Must never be violated.

## Soft Constraints
May be violated with penalties.

---

# 16. HARD CONSTRAINTS

- no teacher conflict;
- no classroom conflict;
- no room conflict;
- weekly quota respected;
- availability respected;
- capacity respected;
- calendar respected.

---

# 17. SOFT CONSTRAINTS

- avoid consecutive days;
- avoid difficult mornings;
- avoid late evenings;
- group teacher sessions;
- create half-days;
- balance workload;
- optimize comfort.

---

# 18. PEDAGOGICAL RULES

Examples:

- Mathematics not at 08:00.
- EPS after 16:00.
- French sessions separated.
- No subject twice on consecutive days.
- Maximum two difficult subjects/day.
- Balance sciences and humanities.

---

# 19. ADMINISTRATIVE RULES

- maximum hours/day;
- maximum hours/week;
- teacher contractual limits;
- room occupancy limits.

---

# 20. RESOURCE RULES

- one teacher per session;
- one room per session;
- laboratory exclusivity;
- sports field exclusivity.

---

# 21. SCHEDULING ALGORITHMS

Pipeline:

1. Constraint Satisfaction
2. Backtracking
3. Branch & Bound
4. Simulated Annealing
5. Genetic Algorithm
6. Local Search

---

# 22. OPTIMIZATION PIPELINE

Step 1:
Place fixed sessions.

Step 2:
Place critical subjects.

Step 3:
Place remaining subjects.

Step 4:
Optimize.

Step 5:
Score.

---

# 23. CONFLICT DETECTION

Detect:

- teacher conflicts;
- room conflicts;
- class conflicts;
- quota conflicts;
- pedagogical conflicts.

---

# 24. CONFLICT RESOLUTION

System proposes:

- move session;
- change room;
- change teacher;
- create slot;
- recruit teacher.

---

# 25. MULTI-SOLUTION GENERATION

Generate:

- Solution A
- Solution B
- Solution C

Scores:

- feasibility;
- comfort;
- pedagogy;
- optimization.

---

# 26. MANUAL ASSISTED MODE

Functions:

- lock;
- unlock;
- regenerate locally;
- drag-and-drop;
- freeze sections.

---

# 27. EXPLAINABLE AI

Examples:

"Mathematics moved because teacher unavailable."

"EPS scheduled at 16:00 due to climate rule."

---

# 28. TIMETABLE QUALITY SCORE

Weights:

- conflicts: 40%
- pedagogy: 25%
- comfort: 20%
- preferences: 15%

Final score:
0–100.

---

# 29. SCENARIO CATALOGUE

Scenario A:
One teacher per subject.

Scenario B:
Multiple teachers.

Scenario C:
Teacher shortage.

Scenario D:
Part-time.

Scenario E:
Shared campuses.

Scenario F:
Climate constraints.

Scenario G:
Laboratory constraints.

Scenario H:
Evening classes.

Scenario I:
Saturday classes.

Scenario J:
Mixed educational systems.

---

# 30. UI/UX

Pages:

- Dashboard
- Constraints
- Teachers
- Availability Matrix
- Rooms
- Generation
- Validation
- Publication

---

# 31. DATABASE

Recommended:

PostgreSQL.

Main tables:

- teachers
- subjects
- classes
- rooms
- availabilities
- constraints
- sessions
- timetables
- solutions

---

# 32. API

Examples:

POST /generate
GET /solutions
POST /lock
POST /resolve
GET /conflicts

---

# 33. SECURITY

- RBAC
- audit trail
- permissions
- tenant isolation

---

# 34. AUDIT

Track:

- who generated;
- who modified;
- when;
- why.

---

# 35. REPORTING

Generate:

- PDF
- Excel
- Web
- Mobile

---

# 36. PERFORMANCE

Target:

- <30 seconds for small schools;
- <5 minutes for large schools.

---

# 37. ROADMAP

V1:
Basic generation.

V2:
Optimization.

V3:
Explainable AI.

V4:
Learning engine.

V5:
Autonomous optimization.

---

# CONCLUSION

The Smart Timetable Engine is a strategic component of Academia Helm and should be designed as a configurable, explainable, optimization-based educational operating system.
