/**
 * ============================================================================
 * COMMUNITY CLIENT — Accès à l'espace communautaire via le BFF
 * ============================================================================
 *
 * Toutes les requêtes passent par /api/community/* (catch-all BFF) :
 *   - Cookie httpOnly `community_token` porté automatiquement (same-origin)
 *   - Aucun token exposé au JS client
 *   - Pas de cache GET ici : les données de conversation sont vivantes
 *     (polling 10 s contrôlé par les composants)
 * ============================================================================
 */

export interface CommunityMember {
  id: string;
  email: string;
  displayName: string;
  organization?: string | null;
  avatarUrl?: string | null;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
  memberType: 'PROSPECT' | 'CLIENT' | 'PARTNER' | 'TEAM';
  status: 'PENDING' | 'ACTIVE' | 'BANNED';
  createdAt?: string;
}

export interface CommunityChannel {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  type: 'TEXT' | 'ANNOUNCEMENT' | 'RESTRICTED';
  position: number;
  lastMessageAt: string | null;
  messageCount: number;
  unread: number;
  preview: string | null;
  canPost: boolean;
}

export interface CommunityMessage {
  id: string;
  channelId: string;
  type: 'TEXT' | 'ANNOUNCEMENT' | 'POLL' | 'SYSTEM';
  content: string | null;
  attachment: { url: string; name?: string | null; size?: number | null; mime?: string | null } | null;
  replyTo: { id: string; content: string | null; type: string; authorId: string } | null;
  isPinned: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  author: {
    id: string;
    displayName: string;
    role: string;
    memberType: string;
    avatarUrl?: string | null;
  };
  reactions: Record<string, { count: number; mine: boolean }>;
  poll: {
    id: string;
    question: string;
    isMulti: boolean;
    expiresAt: string | null;
    options: { id: string; label: string }[];
  } | null;
  mine: boolean;
}

export interface PresenceMember {
  id: string;
  displayName: string;
  memberType: string;
  online: boolean;
  lastSeenAt: string;
}

export interface ScheduledPost {
  id: string;
  channel_id: string;
  channel_name?: string;
  channel_slug?: string;
  author_name?: string;
  type: string;
  content: string;
  scheduled_at: string;
  status: 'PENDING' | 'SENDING' | 'SENT' | 'CANCELLED' | 'FAILED';
  failure_reason?: string | null;
}

export class CommunityError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: { method?: string; body?: any } = {},
): Promise<T> {
  const method = init.method ?? 'GET';
  const res = await fetch(`/api/community/${path}`, {
    method,
    credentials: 'same-origin',
    headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new CommunityError(data?.message ?? `Erreur ${res.status}`, res.status);
  }
  return data as T;
}

export const communityApi = {
  // ── Auth ──
  register: (input: {
    email: string; password: string; displayName: string;
    organization?: string; country?: string; phone?: string; inviteToken?: string;
  }) =>
    request<{ member: CommunityMember; pending: boolean }>('auth/register', {
      method: 'POST',
      body: input,
    }),

  login: (input: { email: string; password: string }) =>
    request<{ member: CommunityMember }>('auth/login', { method: 'POST', body: input }),

  me: () => request<CommunityMember & { teamEmail?: string }>('me'),

  // ── Canaux & messages ──
  channels: () => request<CommunityChannel[]>('channels'),

  channel: (slug: string) =>
    request<{
      id: string; slug: string; name: string; description: string | null;
      icon: string | null; type: string; canPost: boolean;
      pinned: { id: string; content: string | null; type: string; author: string; createdAt: string }[];
    }>(`channels/${slug}`),

  messages: (slug: string, opts: { before?: string; since?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (opts.before) params.set('before', opts.before);
    if (opts.since) params.set('since', opts.since);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return request<{ channel: string; messages: CommunityMessage[]; hasMore: boolean }>(
      `channels/${slug}/messages${qs ? `?${qs}` : ''}`,
    );
  },

  postMessage: (
    slug: string,
    input: {
      content?: string; replyToId?: string;
      poll?: { question: string; isMulti?: boolean; options: string[]; expiresAt?: string };
    },
  ) => request<CommunityMessage>(`channels/${slug}/messages`, { method: 'POST', body: input }),

  editMessage: (id: string, content: string) =>
    request<{ id: string; edited: boolean }>(`messages/${id}`, { method: 'PATCH', body: { content } }),

  deleteMessage: (id: string) =>
    request<{ id: string; deleted: boolean }>(`messages/${id}`, { method: 'DELETE' }),

  pinMessage: (id: string, pinned: boolean) =>
    request<{ id: string; pinned: boolean }>(`messages/${id}/pin`, { method: 'POST', body: { pinned } }),

  react: (id: string, emoji: string) =>
    request<{ id: string; emoji: string; added: boolean }>(`messages/${id}/reactions`, {
      method: 'POST',
      body: { emoji },
    }),

  votePoll: (messageId: string, optionIds: string[]) =>
    request<{ pollId: string; totalVotes: number; results: { id: string; label: string; votes: number; mine: boolean }[] }>(
      `messages/${messageId}/poll/vote`,
      { method: 'POST', body: { optionIds } },
    ),

  markRead: (slug: string) =>
    request<{ ok: boolean }>(`channels/${slug}/read`, { method: 'POST', body: {} }),

  presence: () => request<PresenceMember[]>('presence'),

  // ── Admin (équipe) ──
  adminMembers: (query?: string) =>
    request<(CommunityMember & { lastSeenAt?: string | null; source?: string | null })[]>(
      `admin/members${query ? `?query=${encodeURIComponent(query)}` : ''}`,
    ),

  updateMember: (id: string, patch: { role?: string; memberType?: string; status?: string }) =>
    request<CommunityMember>(`admin/members/${id}`, { method: 'PATCH', body: patch }),

  scheduledPosts: (status?: string) =>
    request<ScheduledPost[]>(`admin/scheduled-posts${status ? `?status=${status}` : ''}`),

  schedulePost: (input: { channelId: string; content: string; type?: string; scheduledAt: string }) =>
    request<ScheduledPost>('admin/scheduled-posts', { method: 'POST', body: input }),

  updateScheduledPost: (id: string, patch: { content?: string; scheduledAt?: string; status?: string }) =>
    request<ScheduledPost>(`admin/scheduled-posts/${id}`, { method: 'PATCH', body: patch }),

  createInvite: (input: { channelId?: string; memberType?: string; note?: string; maxUses?: number; expiresInDays?: number }) =>
    request<{ id: string; token: string; url: string; member_type: string; uses_count: number }>('admin/invites', {
      method: 'POST',
      body: input,
    }),

  listInvites: () =>
    request<
      {
        id: string; token: string; url: string; member_type: string;
        uses_count: number; max_uses?: number | null; note?: string | null;
        channel_name?: string | null; created_at: string;
      }[]
    >('admin/invites'),

  deleteInvite: (id: string) =>
    request<{ deleted: boolean }>(`admin/invites/${id}`, { method: 'DELETE' }),

  stats: () =>
    request<{
      members: { n: number; active: number; clients: number; prospects: number; weekly_active: number };
      engagement: {
        totals: {
          total_messages: number; total_reactions: number;
          total_poll_votes: number; messages_7d: number; messages_24h: number;
        };
        perChannel: { name: string; slug: string; type: string; messages: number; last_activity: string | null }[];
        topContributors: { display_name: string; member_type: string; messages: number }[];
      };
    }>('admin/stats'),
};
