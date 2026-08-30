export type AgentRole = 'user' | 'mike' | 'emma' | 'bob' | 'alex' | 'qa' | 'system'

export type AgentMeta = {
  id: Exclude<AgentRole, 'user' | 'system'>
  name: string
  title: string
  blurb: string
  initials: string
  accent: string
}

export const AGENTS: Record<AgentMeta['id'], AgentMeta> = {
  mike: {
    id: 'mike',
    name: 'Mike',
    title: '队长',
    blurb: '拆解需求、制定计划、分派任务',
    initials: 'MK',
    accent: '#7c6af7',
  },
  emma: {
    id: 'emma',
    name: 'Emma',
    title: '产品经理',
    blurb: '产出精简 PRD 与页面清单',
    initials: 'EM',
    accent: '#3ee0c9',
  },
  bob: {
    id: 'bob',
    name: 'Bob',
    title: '架构师',
    blurb: '选型、文件骨架与模块边界',
    initials: 'BB',
    accent: '#f5b942',
  },
  alex: {
    id: 'alex',
    name: 'Alex',
    title: '工程师',
    blurb: '逐文件写出可运行代码',
    initials: 'AX',
    accent: '#6aa8ff',
  },
  qa: {
    id: 'qa',
    name: 'QA',
    title: '验证员',
    blurb: '静态检查与问题清单',
    initials: 'QA',
    accent: '#f0718a',
  },
}

export function isAgentRole(role: string): role is AgentMeta['id'] {
  return role in AGENTS
}
