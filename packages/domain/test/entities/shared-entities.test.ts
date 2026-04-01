import { describe, expect, it } from 'vitest'
import {
  RoomSchema,
  ProjectSchema,
  MessageSchema,
  SenderTypeSchema,
  MessageTypeSchema,
  LogSchema,
  AttachmentSchema,
  PlanDecisionSchema,
  QuestionReviewSchema,
  PermissionReviewSchema,
  TeamMemberSchema,
  TeamMemberStatusSchema,
  TeamInfoSchema,
} from '../../src/index'

describe('RoomSchema', () => {
  it('parses valid data', () => {
    const result = RoomSchema.parse({
      id: 'room-1',
      name: 'Test Room',
      projectId: 'proj-1',
      createdAt: '2026-01-01T00:00:00Z',
    })
    expect(result.id).toBe('room-1')
    expect(result.name).toBe('Test Room')
    expect(result.projectId).toBe('proj-1')
  })

  it('accepts null projectId', () => {
    const result = RoomSchema.parse({
      id: 'room-1',
      name: 'Test Room',
      projectId: null,
      createdAt: '2026-01-01T00:00:00Z',
    })
    expect(result.projectId).toBeNull()
  })

  it('rejects missing required fields', () => {
    expect(() => RoomSchema.parse({ id: 'room-1' })).toThrow()
  })

  it('strips infra fields', () => {
    const result = RoomSchema.parse({
      id: 'room-1',
      name: 'test',
      projectId: null,
      createdAt: '2026-01-01',
      key_id: 'should-be-stripped',
    })
    expect(result).not.toHaveProperty('key_id')
  })
})

describe('ProjectSchema', () => {
  it('parses valid data', () => {
    const result = ProjectSchema.parse({
      id: 'proj-1',
      name: 'Test Project',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    })
    expect(result.id).toBe('proj-1')
    expect(result.name).toBe('Test Project')
  })

  it('rejects missing required fields', () => {
    expect(() => ProjectSchema.parse({ id: 'proj-1' })).toThrow()
  })

  it('strips infra fields', () => {
    const result = ProjectSchema.parse({
      id: 'proj-1',
      name: 'test',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      key_id: 'should-be-stripped',
    })
    expect(result).not.toHaveProperty('key_id')
  })
})

describe('MessageSchema', () => {
  const validMessage = {
    id: 'msg-1',
    roomId: 'room-1',
    sender: 'alice',
    senderType: 'human',
    content: 'Hello',
    color: '#ff0000',
    type: 'message',
    seq: 1,
    createdAt: '2026-01-01T00:00:00Z',
  }

  it('parses valid data', () => {
    const result = MessageSchema.parse(validMessage)
    expect(result.id).toBe('msg-1')
    expect(result.sender).toBe('alice')
    expect(result.senderType).toBe('human')
    expect(result.type).toBe('message')
  })

  it('accepts null color and seq', () => {
    const result = MessageSchema.parse({ ...validMessage, color: null, seq: null })
    expect(result.color).toBeNull()
    expect(result.seq).toBeNull()
  })

  it('rejects missing required fields', () => {
    expect(() => MessageSchema.parse({ id: 'msg-1' })).toThrow()
  })

  it('strips infra fields', () => {
    const result = MessageSchema.parse({ ...validMessage, key_id: 'stripped', r2_key: 'stripped' })
    expect(result).not.toHaveProperty('key_id')
    expect(result).not.toHaveProperty('r2_key')
  })
})

describe('SenderTypeSchema', () => {
  it('accepts valid values', () => {
    expect(SenderTypeSchema.parse('human')).toBe('human')
    expect(SenderTypeSchema.parse('agent')).toBe('agent')
  })

  it('rejects invalid values', () => {
    expect(() => SenderTypeSchema.parse('bot')).toThrow()
  })
})

describe('MessageTypeSchema', () => {
  it('accepts valid values', () => {
    expect(MessageTypeSchema.parse('message')).toBe('message')
    expect(MessageTypeSchema.parse('log')).toBe('log')
  })

  it('rejects invalid values', () => {
    expect(() => MessageTypeSchema.parse('notification')).toThrow()
  })
})

describe('LogSchema', () => {
  const validLog = {
    id: 'log-1',
    roomId: 'room-1',
    messageId: 'msg-1',
    sender: 'agent-1',
    content: 'Tool call completed',
    color: '#00ff00',
    seq: 5,
    createdAt: '2026-01-01T00:00:00Z',
  }

  it('parses valid data', () => {
    const result = LogSchema.parse(validLog)
    expect(result.id).toBe('log-1')
    expect(result.sender).toBe('agent-1')
  })

  it('accepts null messageId, color, and seq', () => {
    const result = LogSchema.parse({ ...validLog, messageId: null, color: null, seq: null })
    expect(result.messageId).toBeNull()
    expect(result.color).toBeNull()
    expect(result.seq).toBeNull()
  })

  it('rejects missing required fields', () => {
    expect(() => LogSchema.parse({ id: 'log-1' })).toThrow()
  })

  it('strips infra fields', () => {
    const result = LogSchema.parse({ ...validLog, key_id: 'stripped' })
    expect(result).not.toHaveProperty('key_id')
  })
})

describe('AttachmentSchema', () => {
  const validAttachment = {
    id: 'att-1',
    roomId: 'room-1',
    messageId: 'msg-1',
    filename: 'screenshot.png',
    size: 1024,
    contentType: 'image/png',
    createdAt: '2026-01-01T00:00:00Z',
  }

  it('parses valid data', () => {
    const result = AttachmentSchema.parse(validAttachment)
    expect(result.id).toBe('att-1')
    expect(result.filename).toBe('screenshot.png')
    expect(result.size).toBe(1024)
  })

  it('accepts null messageId', () => {
    const result = AttachmentSchema.parse({ ...validAttachment, messageId: null })
    expect(result.messageId).toBeNull()
  })

  it('rejects missing required fields', () => {
    expect(() => AttachmentSchema.parse({ id: 'att-1' })).toThrow()
  })

  it('strips infra fields', () => {
    const result = AttachmentSchema.parse({ ...validAttachment, r2_key: 'stripped', key_id: 'stripped' })
    expect(result).not.toHaveProperty('r2_key')
    expect(result).not.toHaveProperty('key_id')
  })
})

describe('PlanDecisionSchema', () => {
  const validPlanDecision = {
    id: 'pd-1',
    messageId: 'msg-1',
    roomId: 'room-1',
    status: 'pending',
    feedback: null,
    decidedBy: null,
    decidedAt: null,
    permissionMode: null,
    createdAt: '2026-01-01T00:00:00Z',
  }

  it('parses valid data', () => {
    const result = PlanDecisionSchema.parse(validPlanDecision)
    expect(result.id).toBe('pd-1')
    expect(result.status).toBe('pending')
  })

  it('accepts all nullable fields as null', () => {
    const result = PlanDecisionSchema.parse(validPlanDecision)
    expect(result.feedback).toBeNull()
    expect(result.decidedBy).toBeNull()
    expect(result.decidedAt).toBeNull()
    expect(result.permissionMode).toBeNull()
  })

  it('accepts approved status with feedback', () => {
    const result = PlanDecisionSchema.parse({
      ...validPlanDecision,
      status: 'approved',
      feedback: 'Looks good',
      decidedBy: 'alice',
      decidedAt: '2026-01-01T01:00:00Z',
    })
    expect(result.status).toBe('approved')
    expect(result.feedback).toBe('Looks good')
  })

  it('rejects invalid status', () => {
    expect(() => PlanDecisionSchema.parse({ ...validPlanDecision, status: 'invalid' })).toThrow()
  })

  it('rejects missing required fields', () => {
    expect(() => PlanDecisionSchema.parse({ id: 'pd-1' })).toThrow()
  })

  it('strips infra fields', () => {
    const result = PlanDecisionSchema.parse({ ...validPlanDecision, key_id: 'stripped' })
    expect(result).not.toHaveProperty('key_id')
  })
})

describe('QuestionReviewSchema', () => {
  const validQuestionReview = {
    id: 'qr-1',
    messageId: 'msg-1',
    roomId: 'room-1',
    questionsJson: '["What is the plan?"]',
    status: 'pending',
    answersJson: null,
    answeredBy: null,
    answeredAt: null,
    createdAt: '2026-01-01T00:00:00Z',
  }

  it('parses valid data', () => {
    const result = QuestionReviewSchema.parse(validQuestionReview)
    expect(result.id).toBe('qr-1')
    expect(result.status).toBe('pending')
    expect(result.questionsJson).toBe('["What is the plan?"]')
  })

  it('accepts all nullable fields as null', () => {
    const result = QuestionReviewSchema.parse(validQuestionReview)
    expect(result.answersJson).toBeNull()
    expect(result.answeredBy).toBeNull()
    expect(result.answeredAt).toBeNull()
  })

  it('accepts answered status', () => {
    const result = QuestionReviewSchema.parse({
      ...validQuestionReview,
      status: 'answered',
      answersJson: '{"q1":"yes"}',
      answeredBy: 'alice',
      answeredAt: '2026-01-01T01:00:00Z',
    })
    expect(result.status).toBe('answered')
  })

  it('rejects invalid status', () => {
    expect(() => QuestionReviewSchema.parse({ ...validQuestionReview, status: 'invalid' })).toThrow()
  })

  it('rejects missing required fields', () => {
    expect(() => QuestionReviewSchema.parse({ id: 'qr-1' })).toThrow()
  })

  it('strips infra fields', () => {
    const result = QuestionReviewSchema.parse({ ...validQuestionReview, key_id: 'stripped' })
    expect(result).not.toHaveProperty('key_id')
  })
})

describe('PermissionReviewSchema', () => {
  const validPermissionReview = {
    id: 'pr-1',
    messageId: 'msg-1',
    roomId: 'room-1',
    toolName: 'Bash',
    toolInputJson: '{"command":"ls"}',
    formattedContent: 'Run command: ls',
    status: 'pending',
    feedback: null,
    decidedBy: null,
    decidedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
  }

  it('parses valid data', () => {
    const result = PermissionReviewSchema.parse(validPermissionReview)
    expect(result.id).toBe('pr-1')
    expect(result.toolName).toBe('Bash')
    expect(result.status).toBe('pending')
  })

  it('accepts null toolInputJson, feedback, decidedBy, decidedAt', () => {
    const result = PermissionReviewSchema.parse({
      ...validPermissionReview,
      toolInputJson: null,
      feedback: null,
      decidedBy: null,
      decidedAt: null,
    })
    expect(result.toolInputJson).toBeNull()
    expect(result.feedback).toBeNull()
    expect(result.decidedBy).toBeNull()
    expect(result.decidedAt).toBeNull()
  })

  it('rejects invalid status', () => {
    expect(() => PermissionReviewSchema.parse({ ...validPermissionReview, status: 'invalid' })).toThrow()
  })

  it('rejects missing required fields', () => {
    expect(() => PermissionReviewSchema.parse({ id: 'pr-1' })).toThrow()
  })

  it('strips infra fields', () => {
    const result = PermissionReviewSchema.parse({ ...validPermissionReview, key_id: 'stripped' })
    expect(result).not.toHaveProperty('key_id')
  })
})

describe('TeamMemberStatusSchema', () => {
  it('accepts valid values', () => {
    expect(TeamMemberStatusSchema.parse('active')).toBe('active')
    expect(TeamMemberStatusSchema.parse('inactive')).toBe('inactive')
  })

  it('rejects invalid values', () => {
    expect(() => TeamMemberStatusSchema.parse('offline')).toThrow()
  })
})

describe('TeamMemberSchema', () => {
  const validMember = {
    name: 'agent-1',
    color: '#ff0000',
    role: 'implementer',
    model: 'claude-opus-4-6',
    status: 'active',
    joinedAt: 1700000000000,
  }

  it('parses valid data', () => {
    const result = TeamMemberSchema.parse(validMember)
    expect(result.name).toBe('agent-1')
    expect(result.color).toBe('#ff0000')
    expect(result.status).toBe('active')
  })

  it('rejects invalid status', () => {
    expect(() => TeamMemberSchema.parse({ ...validMember, status: 'offline' })).toThrow()
  })

  it('rejects missing required fields', () => {
    expect(() => TeamMemberSchema.parse({ name: 'agent-1' })).toThrow()
  })
})

describe('TeamInfoSchema', () => {
  it('parses valid data', () => {
    const result = TeamInfoSchema.parse({
      teamName: 'test-team',
      members: [
        {
          name: 'agent-1',
          color: '#ff0000',
          role: 'implementer',
          model: 'claude-opus-4-6',
          status: 'active',
          joinedAt: 1700000000000,
        },
      ],
    })
    expect(result.teamName).toBe('test-team')
    expect(result.members).toHaveLength(1)
  })

  it('accepts empty members array', () => {
    const result = TeamInfoSchema.parse({ teamName: 'test-team', members: [] })
    expect(result.members).toHaveLength(0)
  })

  it('rejects missing required fields', () => {
    expect(() => TeamInfoSchema.parse({ teamName: 'test-team' })).toThrow()
  })
})
