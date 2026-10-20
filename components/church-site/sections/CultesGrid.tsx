'use client'

import { useState } from 'react'
import Image from 'next/image'

type Video = { id: string; titre: string }

function VideoCard({ video }: { video: Video }) {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <div className="aspect-video bg-black rounded-sm overflow-hidden shadow-sm">
        <iframe
          src={`https://www.youtube.com/embed/${video.id}?autoplay=1`}
          title={video.titre}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    )
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className="aspect-video bg-teal-light rounded-sm overflow-hidden shadow-sm relative group w-full block"
      aria-label={`Lire : ${video.titre}`}
    >
      <Image
        src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
        alt={video.titre}
        fill
        sizes="(max-width:768px) 100vw, 50vw"
        className="object-cover"
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-white/90 group-hover:bg-white transition-colors flex items-center justify-center shadow-lg">
          <svg className="w-6 h-6 text-teal-dark ml-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
        <p className="font-sans text-xs text-white/90 text-left line-clamp-1">{video.titre}</p>
      </div>
    </button>
  )
}

export function CultesGrid({ videos }: { videos: Video[] }) {
  return (
    <div className="grid md:grid-cols-3 gap-6 mb-10">
      {videos.map((v) => (
        <VideoCard key={v.id} video={v} />
      ))}
    </div>
  )
}
