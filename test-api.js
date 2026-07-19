const API_BASE = 'https://api.academiahelm.com/api';

async function testEndpoint(method, path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': 'cspeb-eveildafriqueeducation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return { status: r.status, body: text.substring(0, 300) };
}

async function main() {
  // 1. Get config
  console.log('1. GET /timetable-engine/config');
  const config = await testEndpoint('GET', '/timetable-engine/config');
  console.log('  Status:', config.status);
  console.log('  Body:', config.body);
  
  // 2. Update config with time blocks
  console.log('\n2. PUT /timetable-engine/config (with time blocks)');
  const updateConfig = await testEndpoint('PUT', '/timetable-engine/config', {
    schoolLevelId: '82417850-f9cc-4be6-8a6b-370db5509e11',
    academicYearId: 'a7593470-e4f4-460a-b3b6-4dabe53bec2a',
    schoolDays: [1, 2, 3, 4, 5],
    dayStartTime: '08:00',
    dayEndTime: '18:00',
    defaultSessionDuration: 120,
    saturdayEnabled: false,
    timeBlocks: [
      { type: 'BLOCK', label: 'Séance 1', startTime: '08:00', endTime: '10:00' },
      { type: 'BREAK', label: 'Pause', startTime: '10:00', endTime: '10:15' },
      { type: 'BLOCK', label: 'Séance 2', startTime: '10:15', endTime: '12:15' },
      { type: 'BREAK', label: 'Déjeuner', startTime: '12:15', endTime: '14:00' },
      { type: 'BLOCK', label: 'Séance 3', startTime: '14:00', endTime: '16:00' },
      { type: 'BREAK', label: 'Pause', startTime: '16:00', endTime: '16:15' },
      { type: 'BLOCK', label: 'Séance 4', startTime: '16:15', endTime: '18:00' },
    ],
  });
  console.log('  Status:', updateConfig.status);
  console.log('  Body:', updateConfig.body);
  
  // 3. Get constraints types
  console.log('\n3. GET /timetable-engine/constraints/types');
  const types = await testEndpoint('GET', '/timetable-engine/constraints/types');
  console.log('  Status:', types.status);
  console.log('  Body:', types.body);
  
  // 4. Try to generate
  console.log('\n4. POST /timetable-engine/generate');
  const generate = await testEndpoint('POST', '/timetable-engine/generate', {
    academicYearId: 'a7593470-e4f4-460a-b3b6-4dabe53bec2a',
    schoolLevelId: '82417850-f9cc-4be6-8a6b-370db5509e11',
    strategy: 'feasibility',
  });
  console.log('  Status:', generate.status);
  console.log('  Body:', generate.body);
}

main().catch(e => console.error(e));
