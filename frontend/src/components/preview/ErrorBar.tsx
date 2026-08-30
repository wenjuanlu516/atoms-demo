export function ErrorBar({ message, fixing }: { message: string; fixing?: boolean }) {
  return (
    <div className="border-b border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">
      {fixing ? '检测到运行错误，正在自动修复…' : message}
    </div>
  )
}
