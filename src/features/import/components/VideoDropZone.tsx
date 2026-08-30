import { Video } from 'lucide-react'

type VideoDropZoneProps = {
  isDragging: boolean
  onChoose: () => void | Promise<void>
}

export function VideoDropZone({
  isDragging,
  onChoose,
}: VideoDropZoneProps) {
  return (
    <div
      className={`group relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-[18px] border border-dashed border-[#a6bcb0] bg-[#fbfcfa]/64 p-8 text-center transition-[border-color,background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[#1d6b50] hover:bg-[#e2eee8]/72 hover:shadow-[0_22px_70px_rgba(22,54,42,0.09)] focus-visible:-translate-y-0.5 focus-visible:border-[#1d6b50] focus-visible:bg-[#e2eee8]/72 focus-visible:shadow-[0_22px_70px_rgba(22,54,42,0.09)] focus-visible:outline-none ${isDragging ? 'border-[#1d6b50] bg-[#e2eee8]/72 shadow-[0_22px_70px_rgba(22,54,42,0.09)]' : ''}`}
      onClick={onChoose}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') void onChoose()
      }}
      role="button"
      tabIndex={0}
      aria-label="動画ファイルを選択"
    >
      <>
        <div className="relative mb-6 grid h-[62px] w-[54px] place-items-center rounded-[7px] border border-[#adc7b9] bg-[#fbfcfa] text-[#1d6b50] shadow-[5px_5px_0_rgba(177,203,189,0.46)] transition-transform group-hover:-rotate-1 group-hover:-translate-y-0.5 after:absolute after:-right-px after:-top-px after:h-[13px] after:w-[13px] after:rounded-bl-[6px] after:border-b after:border-l after:border-[#adc7b9] after:bg-[#e9f3ed] after:content-['']" aria-hidden="true">
          <Video size={25} strokeWidth={1.7} />
        </div>
        <div className="text-[18px] font-semibold tracking-[-0.04em] text-[#18211f]">動画ファイルを選択</div>
        <div className="mt-2 text-xs leading-[1.45] text-[#71807b]">ここにドロップ、またはクリックして選択</div>
        <div className="mt-[27px] font-mono text-[9px] tracking-[0.06em] text-[#9baaa3]">MP4&nbsp; · &nbsp;MOV&nbsp; · &nbsp;M4V&nbsp; · &nbsp;MKV&nbsp; · &nbsp;WEBM</div>
      </>
    </div>
  )
}
