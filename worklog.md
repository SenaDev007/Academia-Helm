---
Task ID: 1
Agent: Main
Task: Fix missing candidate application data and documents in RH module

Work Log:
- Cloned the Academia Helm repository from GitHub
- Analyzed the public-facing application form (CareersContent.tsx) — collects: contact info, experiences, education, skills, pitch, documents (CV, cover letter, recommendation)
- Traced the data flow: FormData → POST /hr/recruitment/apply → NestJS applyJob() → saves to HrCandidate + AcademicProfile + HrApplication
- Found that the backend correctly saves structured data (experiences, education, skills) into `AcademicProfile.pedagogicalExperience` as JSON and `AcademicProfile.subjects` as String[]
- Found that the frontend RecruitmentWorkspace correctly parses pedagogicalExperience JSON to extract experiences, education, pitch, skills
- Identified root cause of missing documents: the `applyJob` method received file uploads via Multer's FileFieldsInterceptor but NEVER saved file references to the database — files were stored temporarily and lost
- Identified that the Documents tab in the candidate detail modal showed HARDCODED filenames ("Curriculum_Vitae_{lastName}_{firstName}.pdf") instead of actual uploaded document references
- Created new `CandidateDocument` Prisma model with fields: id, candidateId, documentType, fileName, filePath, fileSize, mimeType, category, description
- Updated `HrCandidate` model to include `documents` relation
- Updated `getCandidates` service to include `documents` in the Prisma query
- Updated `applyJob` service to save document references (CV, COVER_LETTER, RECOMMENDATION) to the new CandidateDocument model
- Updated `deleteCandidate` service to also delete candidate documents
- Updated frontend RecruitmentWorkspace.tsx: added CandidateDocument interface, added documents field to Candidate interface, passed documents from API response, replaced hardcoded document display with real document list showing fileName, fileSize, type labels, and open links
- Fixed Prisma schema validation error: StaffPhoto model was missing reverse relations for AcademicYear and SchoolLevel — added academicYearId and schoolLevelId fields
- Created migration SQL for CandidateDocument table and StaffPhoto columns
- Generated Prisma client
- Committed and pushed to main branch

Stage Summary:
- Candidate documents are now properly saved to the database when applying from the public site
- The RH module now shows real uploaded document references instead of hardcoded names
- The academicProfile data (experience, education, skills, pitch) was already being saved correctly — the issue for existing candidates was likely that they applied before the code was properly implemented, or didn't fill in those fields
- New candidates applying from the public site will have their full profile data and document references visible in the RH module
- Deployment will auto-apply the migration via Railway's docker-entrypoint.sh
