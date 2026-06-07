/**
 * ============================================================================
 * MESSAGE ENTITY - COMMUNICATION MODULE
 * ============================================================================
 * 
 * Messages internes entre utilisateurs
 * 
 * ============================================================================
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';

export enum MessageType {
  DIRECT = 'DIRECT',           // Message direct
  GROUP = 'GROUP',             // Message de groupe
  BROADCAST = 'BROADCAST',     // Diffusion
}

export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    type: 'varchar',
    length: 50,
    enum: MessageType,
    default: MessageType.DIRECT,
  })
  type: MessageType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subject: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'uuid' })
  fromUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_user_id' })
  fromUser: User;

  @Column({ type: 'uuid' })
  toUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_user_id' })
  toUser: User;

  @Column({
    type: 'varchar',
    length: 20,
    enum: MessageStatus,
    default: MessageStatus.SENT,
  })
  status: MessageStatus;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ type: 'boolean', default: false })
  isArchived: boolean;

  @Column({ type: 'jsonb', nullable: true })
  attachments: Array<{ url: string; name: string; type: string }> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

