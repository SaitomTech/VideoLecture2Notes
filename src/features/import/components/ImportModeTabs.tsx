type ImportMode = "file" | "youtube";

type ImportModeTabsProps = {
  mode: ImportMode;
  disabled: boolean;
  onChange: (mode: ImportMode) => void;
};

export function ImportModeTabs({ mode, disabled, onChange }: ImportModeTabsProps) {
  return (
    <div
      className="mb-5 flex rounded-[10px] border border-[#b7cbc0] bg-[#e8f2ec] p-1"
      role="tablist"
      aria-label="動画の入力方法"
    >
      <button
        className={`flex-1 rounded-[7px] px-3 py-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25 ${mode === "file" ? "bg-[#fbfcfa] text-[#1d6b50] shadow-sm" : "text-[#71807b] hover:text-[#1d6b50]"}`}
        type="button"
        role="tab"
        aria-selected={mode === "file"}
        onClick={() => onChange("file")}
        disabled={disabled}
      >
        動画ファイル
      </button>
      <button
        className={`flex-1 rounded-[7px] px-3 py-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25 ${mode === "youtube" ? "bg-[#fbfcfa] text-[#1d6b50] shadow-sm" : "text-[#71807b] hover:text-[#1d6b50]"}`}
        type="button"
        role="tab"
        aria-selected={mode === "youtube"}
        onClick={() => onChange("youtube")}
        disabled={disabled}
      >
        YouTube URL
      </button>
    </div>
  );
}
