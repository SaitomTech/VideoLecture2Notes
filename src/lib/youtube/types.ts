import type { YoutubeImportQuality } from "../../types/project";

export type YoutubeVideoInfo = {
  videoId: string;
  canonicalUrl: string;
  title: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  durationMs: number;
};

export type YoutubeDownloadProgress = {
  phase: "downloading" | "finalizing";
  percent?: number;
  speed?: string;
  eta?: string;
};

export type YoutubeDownloadInput = {
  projectId: string;
  info: YoutubeVideoInfo;
  quality: YoutubeImportQuality;
  signal?: AbortSignal;
  onProgress?: (progress: YoutubeDownloadProgress) => void;
};
