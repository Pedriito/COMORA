'use client'

import { useState } from 'react'
import Image from 'next/image'
import { getEmbedUrl, getPlatformLabel, getYoutubeThumbnail } from '@/lib/videoEmbed'

type Props = {
  youtubeUrl: string | null
  audioUrl:   string | null
}

export function MediaPlayer({ youtubeUrl, audioUrl }: Props) {
  const [videoOpen, setVideoOpen] = useState(false)
  const embedUrl   = youtubeUrl ? getEmbedUrl(youtubeUrl) : null
  const thumbnail  = youtubeUrl ? getYoutubeThumbnail(youtubeUrl) : null
  const platform   = youtubeUrl ? getPlatformLabel(youtubeUrl) : null

  return (
    <div className="space-y-3">
      {/* YouTube / Vimeo */}
      {embedUrl && (
        <div className="rounded-xl overflow-hidden border border-teal/15">
          {videoOpen ? (
            <div className="relative" style={{ paddingTop: '56.25%' }}>
              <iframe
                src={embedUrl}
                className="absolute inset-0 w-full h-full border-0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <button
              onClick={() => setVideoOpen(true)}
              className="relative w-full aspect-video flex items-center justify-center bg-dark/5 hover:bg-dark/10 transition-colors group"
            >
              {thumbnail && (
                <Image src={thumbnail} alt="" fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover opacity-80" />
              )}
              <div className="relative z-10 w-14 h-14 rounded-full bg-black/60 group-hover:bg-teal/80 flex items-center justify-center transition-colors">
                <span className="text-white text-2xl ml-1">▶</span>
              </div>
              {platform && (
                <span className="absolute bottom-2 right-3 font-sans text-xs text-white/70 z-10">{platform}</span>
              )}
            </button>
          )}
        </div>
      )}

      {/* Audio MP3 */}
      {audioUrl && (
        <div className="bg-white rounded-xl border border-teal/15 px-4 py-3 flex items-center gap-3">
          <span className="text-teal text-lg shrink-0">🎵</span>
          <audio controls className="flex-1 h-8 min-w-0" style={{ accentColor: 'var(--color-teal)' }}>
            <source src={audioUrl} type="audio/mpeg" />
            <source src={audioUrl} />
            Ton navigateur ne supporte pas la lecture audio.
          </audio>
        </div>
      )}
    </div>
  )
}
