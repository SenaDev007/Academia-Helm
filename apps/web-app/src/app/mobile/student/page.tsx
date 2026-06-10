/**
 * ============================================================================
 * MOBILE STUDENT PAGE
 * ============================================================================
 */

import StudentMobileLayout from '@/components/mobile/StudentMobileLayout';
import StudentHomePage from '@/components/mobile/StudentHomePage';

export default function MobileStudentPage() {
  return (
    <StudentMobileLayout>
      <StudentHomePage />
    </StudentMobileLayout>
  );
}

