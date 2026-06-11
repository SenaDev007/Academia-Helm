export { getQueryClient } from './query-client';
export { settingsKeys } from './settings-keys';
export { academicYearsKeys } from './academic-years-keys';
export { pedagogyKeys } from './pedagogy-keys';
export {
  fetchAcademicYearsSnapshot,
  hydrateAcademicYearsFromBootstrap,
  academicYearsListFromBootstrapPayload,
  buildAcademicYearsSnapshot,
} from './academic-years-fetch';
export { fetchSettingsBootstrap, type SettingsBootstrapPayload } from './fetch-settings-bootstrap';
export { TANSTACK_QUERY_HELM_VERSION } from './tanstack-query-conventions';
