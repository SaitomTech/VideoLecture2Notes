import { join } from "@tauri-apps/api/path";
import { getFileSize } from "../tauri/filesystem";
import { executeSidecar, executeSidecarStreaming } from "../tauri/sidecar";
import { probeVideo } from "../media/ffprobe";
import {
  listProjectSourceAssets,
  prepareProjectSourceAssetDirectory,
  removeProjectSourceAsset,
  removeProjectSourceAssetDirectory,
} from "../storage/projectAssets";
import type { SelectedVideo } from "../../features/import/types";
import { getExtension, isSupportedVideo } from "../../features/import/utils";
import type { VideoExtension } from "../../types/media";
import type { YoutubeDownloadInput, YoutubeDownloadProgress } from "./types";

export const YT_DLP_VERSION = "2026.08.19";

function parseProgress(chunk: string): YoutubeDownloadProgress | null {
  const line = chunk.split(/\r?\n/).find((candidate) => candidate.includes("[download]"));
  if (!line) return null;

  const percentMatch = line.match(/\[download\]\s+([\d.]+)%/);
  const percent = percentMatch ? Number(percentMatch[1]) : undefined;
  const speedMatch = line.match(/\bat\s+(.+?)(?:\s+ETA\s+|$)/);
  const etaMatch = line.match(/\bETA\s+(.+)$/);

  return {
    phase: "downloading",
    ...(percent !== undefined && Number.isFinite(percent) ? { percent } : {}),
    ...(speedMatch?.[1] ? { speed: speedMatch[1].trim() } : {}),
    ...(etaMatch?.[1] ? { eta: etaMatch[1].trim() } : {}),
  };
}

function safeSourceName(title: string, extension: VideoExtension, videoId: string) {
  const printableTitle = Array.from(title)
    .filter((character) => character >= " " && character !== "\u007f")
    .join("");
  const cleaned = printableTitle
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  return `${cleaned || `youtube-${videoId}`}.${extension}`;
}

function formatForQuality(quality: YoutubeDownloadInput["quality"]) {
  const height = quality === "best" ? "" : `[height<=${quality.replace("p", "")}]`;
  return {
    video: `bestvideo${height}[ext=mp4]/bestvideo${height}`,
    audio: "bestaudio[ext=m4a]/bestaudio",
  };
}

function printedOutputPath(stdout: string, sourceDirectory: string, prefix: string) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .reverse()
    .find((line) => line.startsWith(`${sourceDirectory}/${prefix}`));
}

async function findDownloadedAsset(
  projectId: string,
  stdout: string,
  sourceDirectory: string,
  prefix: string,
) {
  const printedPath = printedOutputPath(stdout, sourceDirectory, prefix);
  if (printedPath) return printedPath;

  const paths = await listProjectSourceAssets(projectId);
  return (
    paths.find((path) => {
      const name = path.split(/[\\/]/).pop() ?? path;
      return name.startsWith(prefix);
    }) ?? null
  );
}

async function downloadFormat({
  info,
  format,
  outputTemplate,
  signal,
  onProgress,
}: {
  info: YoutubeDownloadInput["info"];
  format: string;
  outputTemplate: string;
  signal?: AbortSignal;
  onProgress?: (progress: YoutubeDownloadProgress) => void;
}) {
  const handleOutput = (chunk: string) => {
    const progress = parseProgress(chunk);
    if (progress) onProgress?.(progress);
  };
  const output = await executeSidecarStreaming(
    "binaries/yt-dlp",
    [
      "--no-playlist",
      "--no-cache-dir",
      "--no-cookies",
      "--newline",
      "--progress",
      "--no-warnings",
      "--format",
      format,
      "--output",
      outputTemplate,
      "--print",
      "after_move:filepath",
      info.canonicalUrl,
    ],
    {
      signal,
      onStdout: handleOutput,
      onStderr: handleOutput,
    },
  );

  if (output.code !== 0) {
    const detail = output.stderr.trim();
    throw new Error(detail || "YouTube動画の取得に失敗しました。");
  }

  return output.stdout;
}

export async function downloadYoutubeVideo({
  projectId,
  info,
  quality,
  signal,
  onProgress,
}: YoutubeDownloadInput): Promise<SelectedVideo> {
  const sourceDirectory = await prepareProjectSourceAssetDirectory(projectId);
  const formats = formatForQuality(quality);

  try {
    const videoTemplate = await join(sourceDirectory, "source.video.%(ext)s");
    const audioTemplate = await join(sourceDirectory, "source.audio.%(ext)s");
    const videoStdout = await downloadFormat({
      info,
      format: formats.video,
      outputTemplate: videoTemplate,
      signal,
      onProgress,
    });
    const videoPath = await findDownloadedAsset(
      projectId,
      videoStdout,
      sourceDirectory,
      "source.video.",
    );
    if (!videoPath) throw new Error("取得した映像ファイルを確認できませんでした。");

    const audioStdout = await downloadFormat({
      info,
      format: formats.audio,
      outputTemplate: audioTemplate,
      signal,
      onProgress,
    });
    const audioPath = await findDownloadedAsset(
      projectId,
      audioStdout,
      sourceDirectory,
      "source.audio.",
    );
    if (!audioPath) throw new Error("取得した音声ファイルを確認できませんでした。");

    const videoName = videoPath.split(/[\\/]/).pop() ?? videoPath;
    const videoExtension = getExtension(videoName) as VideoExtension;
    if (!isSupportedVideo(videoName)) throw new Error("取得した映像形式には対応していません。");

    const outputExtension = videoExtension === "webm" ? "mkv" : "mp4";
    const outputPath = await join(sourceDirectory, `source.${outputExtension}`);
    const mergeOutput = await executeSidecar(
      "binaries/ffmpeg",
      [
        "-hide_banner",
        "-v",
        "error",
        "-i",
        videoPath,
        "-i",
        audioPath,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-shortest",
        ...(outputExtension === "mp4" ? ["-movflags", "+faststart"] : []),
        "-y",
        outputPath,
      ],
      { signal },
    );
    if (mergeOutput.code !== 0) {
      const detail = mergeOutput.stderr.trim();
      throw new Error(detail || "映像と音声の結合に失敗しました。");
    }

    await Promise.all([
      removeProjectSourceAsset(projectId, videoName),
      removeProjectSourceAsset(projectId, audioPath.split(/[\\/]/).pop() ?? audioPath),
    ]);
    onProgress?.({ phase: "finalizing", percent: 100 });

    const [metadata, sizeBytes] = await Promise.all([probeVideo(outputPath), getFileSize(outputPath)]);
    return {
      name: safeSourceName(info.title, outputExtension, info.videoId),
      path: outputPath,
      extension: outputExtension,
      sizeBytes,
      metadata,
      origin: {
        kind: "youtube",
        videoId: info.videoId,
        canonicalUrl: info.canonicalUrl,
        pageTitle: info.title,
        channelTitle: info.channelTitle,
        thumbnailUrl: info.thumbnailUrl,
        importedAt: new Date().toISOString(),
        downloader: {
          name: "yt-dlp",
          version: YT_DLP_VERSION,
        },
        quality,
      },
    };
  } catch (error) {
    await removeProjectSourceAssetDirectory(projectId).catch(() => undefined);
    throw error;
  }
}
