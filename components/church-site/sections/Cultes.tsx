import WaveDivider from "../WaveDivider"
import type { ChurchSettings } from "@/lib/churchSettings"
import { CultesGrid } from "./CultesGrid"

type Video = { id: string; titre: string }

// Les trois dernières vidéos de la chaîne YouTube de l'église (flux RSS public)
async function getLatestVideos(channelId: string): Promise<Video[]> {

  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
      { next: { revalidate: 600 } }
    )
    if (!res.ok) return []

    const xml = await res.text()
    const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) ?? []

    const videos = entries.slice(0, 3).map((entry): Video => {
      const id    = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] ?? ''
      const raw   = entry.match(/<title>([^<]+)<\/title>/)?.[1]?.trim() ?? ''
      const titre = raw
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      return { id, titre }
    }).filter(v => v.id)

    return videos
  } catch {
    return []
  }
}

export default async function Cultes({ settings: s }: { settings: ChurchSettings }) {
  if (!s.youtube_channel_id) return null
  const videos = await getLatestVideos(s.youtube_channel_id)
  if (videos.length === 0) return null

  return (
    <section id="cultes" className="py-24 px-6 bg-teal-50">
      <div className="max-w-5xl mx-auto text-center">
        <p className="font-sans text-xs tracking-[0.3em] uppercase text-teal mb-3">
          En ligne
        </p>
        <h2 className="font-display text-4xl md:text-5xl font-light text-dark mb-1">
          Nos cultes
        </h2>
        <WaveDivider color="var(--color-teal)" className="mt-2 mb-3" />
        <p className="font-sans text-sm text-dark/50 mb-12">
          Retrouvez tous nos cultes sur notre chaîne YouTube
        </p>

        <CultesGrid videos={videos} />

        {s.youtube_url && (
          <a
            href={s.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-sans text-sm tracking-widest uppercase text-teal hover:text-teal-dark transition-colors"
          >
            Voir toutes les vidéos
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        )}
      </div>
    </section>
  )
}
