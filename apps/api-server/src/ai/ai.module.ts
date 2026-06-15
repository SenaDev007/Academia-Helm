/**
 * ============================================================================
 * AI MODULE — Academia Helm Enterprise AI Architecture
 * ============================================================================
 * Module NestJS principal qui regroupe l'infrastructure IA :
 *   - AI Gateway (routing, auth, rate limiting, audit)
 *   - MCP Context Composer (context injection)
 *   - Tool Registry & Definitions (tool calling)
 *
 * Ce module est importé par AppModule et fournit les services
 * utilisés par ORION, SARA et ATLAS.
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import { CommonModule } from '../common/common.module';
import { AIGateway } from './gateway/ai-gateway';
import { MCPContextComposer } from './mcp/mcp-context-composer';
import { ToolRegistry } from './tools/tool-registry';
import {
  createStudentTools,
  createFinanceTools,
  createHRTools,
  createOrionTools,
  createPedagogyTools,
  createAtlasTools,
  createKnowledgeTool,
} from './tools/tool-definitions';
import {
  createExamTools,
  createPedagogyExtendedTools,
  createHRExtendedTools,
  createFinanceExtendedTools,
  createCommunicationTools,
  createAttendanceTools,
  createQHSETools,
  createMeetingTools,
  createDashboardTools,
  createDocumentTools,
  createSettingTools,
} from './tools/tool-definitions-extended';
import { createSaraProductTools } from './tools/tool-definitions-sara';
import { webSearchTool } from './tools/tool-definitions-web-search';
import { AIController } from './ai.controller';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [AIController],
  providers: [AIGateway, MCPContextComposer, ToolRegistry],
  exports: [AIGateway, MCPContextComposer, ToolRegistry],
})
export class AIModule implements OnModuleInit {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enregistre tous les outils IA au démarrage du module
   */
  onModuleInit() {
    // ─── Core tools (from tool-definitions.ts) ───
    this.toolRegistry.registerMany(createStudentTools(this.prisma));
    this.toolRegistry.registerMany(createFinanceTools(this.prisma));
    this.toolRegistry.registerMany(createHRTools(this.prisma));
    this.toolRegistry.registerMany(createOrionTools(this.prisma));
    this.toolRegistry.registerMany(createPedagogyTools(this.prisma));
    this.toolRegistry.registerMany(createAtlasTools(this.prisma));
    this.toolRegistry.register(createKnowledgeTool());

    // ─── Extended read-only tools (from tool-definitions-extended.ts) ───
    // Exams & Grades
    this.toolRegistry.registerMany(createExamTools(this.prisma));
    // Pedagogy extended
    this.toolRegistry.registerMany(createPedagogyExtendedTools(this.prisma));
    // HR extended (staff, contracts, attendance, payroll, leaves)
    this.toolRegistry.registerMany(createHRExtendedTools(this.prisma));
    // Finance extended (payments, expenses, fee configs, student accounts)
    this.toolRegistry.registerMany(createFinanceExtendedTools(this.prisma));
    // Communication
    this.toolRegistry.registerMany(createCommunicationTools(this.prisma));
    // Attendance summary
    this.toolRegistry.registerMany(createAttendanceTools(this.prisma));
    // QHSE
    this.toolRegistry.registerMany(createQHSETools(this.prisma));
    // Meetings
    this.toolRegistry.registerMany(createMeetingTools(this.prisma));
    // Dashboard & Overview
    this.toolRegistry.registerMany(createDashboardTools(this.prisma));
    // Documents (read-only)
    this.toolRegistry.registerMany(createDocumentTools(this.prisma));
    // Settings (read-only)
    this.toolRegistry.registerMany(createSettingTools(this.prisma));

    // ─── SARA Product Knowledge Tools (no tenant required) ───
    // SARA is the product ambassador — she knows the product, testimonials,
    // company info, pricing, navigation guides. She does NOT access school data.
    this.toolRegistry.registerMany(createSaraProductTools());

    // ─── Web Search Tool (SARA + ORION) ───
    // Recherche Internet en temps réel via z-ai CLI
    this.toolRegistry.register(webSearchTool);
  }
}
