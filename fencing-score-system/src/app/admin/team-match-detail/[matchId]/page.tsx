'use client'

import { use, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TeamMatchDetailModal } from '@/components/teams/TeamMatchDetailModal'

interface PageProps {
  params: Promise<{ matchId: string }>
}

function TeamMatchDetailContent({ matchId }: { matchId: string; }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isPouleMatch = searchParams.get('isPouleMatch') === 'true'
  const pouleId = searchParams.get('pouleId')
  const categoryId = searchParams.get('categoryId')
  console.log('categoryId:', categoryId) // 看看是什麼

  return (
    <TeamMatchDetailModal
      matchId={matchId}
      pouleId={pouleId || undefined}
      categoryId={categoryId || undefined}
      isPouleMatch={isPouleMatch}
      isOpen={true}
      onClose={() => router.back()}
      onUpdate={() => router.back()}
    />
  )
}

export default function TeamMatchDetailPage({ params }: PageProps) {
  const { matchId } = use(params)
  
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="text-gray-400">載入中...</div></div>}>
      <TeamMatchDetailContent matchId={matchId}  />
    </Suspense>
  )
}
