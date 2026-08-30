export type ExamplePrompt = {
  id: string
  title: string
  stack: string
  prompt: string
  hint: string
}

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    id: 'pomodoro',
    title: '番茄钟工作法',
    stack: 'react',
    prompt: '帮我做一个番茄钟工作法应用，要有任务列表和统计。25 分钟工作 / 5 分钟休息，可以增删任务，并展示每日完成数。',
    hint: '交互型 · 计时 + 任务',
  },
  {
    id: 'coffee',
    title: '咖啡品牌落地页',
    stack: 'static',
    prompt: '帮我做一个精品咖啡品牌落地页，要有品牌故事、产品系列、门店信息和订阅表单，视觉偏暖色、有质感。',
    hint: '视觉型 · 落地页',
  },
  {
    id: 'ledger',
    title: '个人记账本',
    stack: 'vue',
    prompt: '帮我做一个个人记账本，可以记录收支、按分类筛选，并用图表展示本月开销结构。',
    hint: '数据型 · 图表',
  },
]
