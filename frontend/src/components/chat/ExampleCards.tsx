import { EXAMPLE_PROMPTS } from '@/lib/examples'

export function ExampleCards({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="grid gap-2">
      {EXAMPLE_PROMPTS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onPick(item.prompt)}
          className="rounded-xl border border-line bg-panel px-3 py-2.5 text-left transition hover:border-accent/50 hover:bg-raised"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-snow">{item.title}</p>
            <span className="rounded-md bg-raised px-1.5 py-0.5 font-mono text-[10px] text-mist">
              {item.stack}
            </span>
          </div>
          <p className="mt-1 text-xs text-mist">{item.hint}</p>
        </button>
      ))}
    </div>
  )
}
