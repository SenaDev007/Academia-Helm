# Academia Helm - Smart Timetable Engine Specification

## Executive Summary

This document specifies the architecture, business rules, constraints, algorithms, and user workflows for the **Smart Timetable Engine** of Academia Helm.

The objective is to build an intelligent timetable generator capable of automatically producing optimized school timetables while respecting pedagogical, administrative, human, and logistical constraints.

---

# 1. Core Philosophy

There is no universal "perfect timetable".

There is only a timetable optimized for a specific institution according to its own constraints.

The engine must therefore be:

- Configurable
- Explainable
- Optimizable
- Multi-solution
- Constraint-driven

---

# 2. High-Level Architecture

```
Institution Settings
        ↓
Pedagogical Settings
        ↓
Resources
        ↓
Availability Matrix
        ↓
Constraint Engine
        ↓
Optimization Engine
        ↓
Multi-Solution Generator
        ↓
Validation
        ↓
Publication
```

---

# 3. Main Entities

- Institution
- AcademicYear
- Cycle
- Grade
- Class
- Subject
- Teacher
- Room
- TimeSlot
- Availability
- Constraint
- Preference
- Timetable
- TimetableSolution

---

# 4. Institutional Parameters

The user must configure:

- school days
- school calendar
- working hours
- breaks
- lunch breaks
- sports sessions
- evening courses
- Saturday courses

Example:

| Start | End | Type |
|---|---|---|
|08:00|10:00|Block|
|10:00|10:15|Break|
|10:15|12:15|Block|
|15:00|17:00|Block|
|16:00|18:00|Special EPS|

---

# 5. Subject Parameters

For each subject:

- weekly hours
- number of sessions
- duration of sessions
- minimum spacing
- preferred slots
- forbidden slots
- pedagogical priority
- specialized room requirement
- split sessions allowed

Example:

```json
{
 "subject":"Mathematics",
 "weeklyHours":6,
 "sessions":3,
 "sessionDuration":2,
 "consecutiveDaysForbidden":true,
 "forbiddenSlots":["08:00-10:00"],
 "priority":1
}
```

---

# 6. Teacher Parameters

For each teacher:

- identity
- subjects
- assigned classes
- maximum workload
- preferences
- unavailable periods
- vacations
- part-time
- multi-campus
- polyvalence

---

# 7. Teacher Availability Matrix

Example:

| Teacher | L1 | L2 | L3 | M1 | M2 | M3 |
|---|---|---|---|---|---|---|
| French | O | O | X | O | P | O |
| Math | X | O | O | O | O | O |

Legend:

- O = available
- X = unavailable
- P = preferred
- I = forbidden

---

# 8. Room Management

Support:

- classrooms
- laboratories
- workshops
- sports fields
- shared rooms
- specialized rooms

---

# 9. Hard Constraints

Mandatory constraints:

- no teacher conflict
- no classroom conflict
- no room conflict
- weekly quota respected
- teacher availability respected
- room capacity respected
- institutional schedule respected

---

# 10. Soft Constraints

Preferred constraints:

- avoid consecutive days
- avoid difficult subjects together
- avoid mathematics at 08:00
- place EPS after 16:00
- create half-free days
- optimize teacher workload
- avoid late sessions
- balance subjects

---

# 11. Supported Scenarios

## Scenario A
One teacher per subject.

## Scenario B
Multiple teachers per subject.

## Scenario C
Polyvalent teachers.

## Scenario D
Part-time teachers.

## Scenario E
Temporary teachers.

## Scenario F
Insufficient teachers.

## Scenario G
Multiple campuses.

## Scenario H
Shared laboratories.

## Scenario I
Special climate constraints.

## Scenario J
Evening courses.

## Scenario K
Saturday classes.

---

# 12. Conflict Management

The system must:

- detect conflicts
- explain conflicts
- propose solutions
- auto-correct conflicts

Example:

```
Conflict:
Teacher: History-Geography
Slot: Tuesday 15:00-17:00

Classes:
- Grade 6
- Grade 5

Solutions:
1. Move Grade 5 to Thursday
2. Recruit another teacher
3. Add evening slot
```

---

# 13. Optimization Engine

Recommended pipeline:

1. Constraint Satisfaction Problem
2. Smart Backtracking
3. Simulated Annealing
4. Genetic Algorithm
5. Local Search Optimization

---

# 14. Multi-Solution Generation

Example:

```
Solution A: 98%
Solution B: 95%
Solution C: 91%
```

Evaluation criteria:

- conflicts
- pedagogical quality
- workload balance
- preference satisfaction
- timetable compactness

---

# 15. Assisted Manual Mode

The user may:

- lock sessions
- move sessions
- regenerate locally
- freeze areas
- re-optimize sections

---

# 16. Explainable AI

The system must explain:

- why a session was placed
- why placement failed
- blocking constraints
- recommended corrections

---

# 17. Generated Outputs

The engine produces:

- class timetables
- teacher timetables
- room timetables
- workload sheets
- occupancy reports
- conflict reports
- PDF export
- Excel export
- web display
- mobile display

---

# 18. Technical Architecture

Recommended stack:

- Backend: Node.js + TypeScript
- Database: PostgreSQL
- Solver: Google OR-Tools CP-SAT
- Cache: Redis
- Queue: BullMQ
- Real-time: WebSocket
- AI explanation layer: LLM + Rules Engine

---

# 19. Development Roadmap

## V1
Basic automatic generation.

## V2
Advanced optimization.

## V3
Explainable AI.

## V4
Preference learning.

## V5
Self-optimizing timetable generation.

---

# Conclusion

The Smart Timetable Engine should become one of the strategic differentiators of Academia Helm by reproducing the reasoning process of experienced school administrators while maintaining mathematical optimization and explainability.
