import { Controller, Post, Body } from '@nestjs/common';
import { SaraService } from './sara.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('sara')
export class SaraController {
  constructor(private readonly saraService: SaraService) {}

  /**
   * Landing page SARA query (public, Closer Senior mode)
   * Used by the SaraWidget on the landing page
   */
  @Public()
  @Post('query')
  async query(@Body() body: { query: string; visitorId?: string; messages?: Array<{ role: string; content: string }> }) {
    return this.saraService.handleVisitorQuery(body.query, body.visitorId);
  }

  /**
   * In-App SARA query (authenticated, Guide User mode)
   * Used by the InAppSaraGuide and module-specific Sara assistants
   */
  @Post('inapp')
  async inappQuery(
    @Body() body: {
      query: string;
      userId: string;
      schoolId: string;
      userRole?: string;
      currentModule?: string;
      messages?: Array<{ role: string; content: string }>;
    },
  ) {
    return this.saraService.handleInAppQuery(
      body.query,
      body.userId,
      body.schoolId,
      body.userRole,
      body.currentModule,
      body.messages,
    );
  }

  /**
   * Get contextual suggestions based on user role and current module
   */
  @Post('suggestions')
  async getSuggestions(
    @Body() body: { userRole?: string; currentModule?: string },
  ) {
    return this.saraService.getContextualSuggestions(body.userRole, body.currentModule);
  }
}
