export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'mkv', 'webm'] as const

export type VideoExtension = (typeof VIDEO_EXTENSIONS)[number]
