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
 *
 * Modèle : z-ai/glm-5.1 via OpenRouter
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
    // Student tools
    this.toolRegistry.registerMany(createStudentTools(this.prisma));

    // Finance tools
    this.toolRegistry.registerMany(createFinanceTools(this.prisma));

    // HR tools
    this.toolRegistry.registerMany(createHRTools(this.prisma));

    // Orion analytics tools
    this.toolRegistry.registerMany(createOrionTools(this.prisma));

    // Pedagogy tools
    this.toolRegistry.registerMany(createPedagogyTools(this.prisma));

    // Atlas workflow & document tools
    this.toolRegistry.registerMany(createAtlasTools(this.prisma));

    // Knowledge base tool
    this.toolRegistry.register(createKnowledgeTool());
  }
}
