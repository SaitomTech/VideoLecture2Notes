export function AppHeader() {
  return (
    <header className="flex h-[76px] items-center border-b border-[#d8e1dc]/75 px-[5.8vw]">
      <div className="flex items-center gap-3">
        <span
          className="grid h-7 w-7 grid-cols-3 items-end gap-[3px] rounded-[7px] bg-[#1d6b50] p-[5px] shadow-[0_4px_12px_rgba(29,107,80,0.2)]"
          aria-hidden="true"
        >
          <span className="block h-[45%] rounded-[2px] bg-[#dcefe4]" />
          <span className="block h-[75%] rounded-[2px] bg-[#dcefe4]" />
          <span className="block h-full rounded-[2px] bg-[#dcefe4]" />
        </span>
        <span className="text-[15px] font-bold tracking-[-0.02em]">Video Notes</span>
      </div>
    </header>
  )
}
