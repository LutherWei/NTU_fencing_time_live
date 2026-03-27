'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Fencer {
  id: string
  name: string
  seedRank: number | null
}

interface EliminationMatch {
  id: string
  round: number
  position: number
  fencer1Id: string | null
  fencer2Id: string | null
  fencer1: Fencer | null
  fencer2: Fencer | null
  fencer1SeedRank: number | null
  fencer2SeedRank: number | null
  score1: number | null
  score2: number | null
  winnerId: string | null
  winner: Fencer | null
  isBye: boolean
  isThirdPlace: boolean
  completed: boolean
}

interface MatchNodeProps {
  match: EliminationMatch
  isAdmin?: boolean
  onUpdate?: () => void
}

export function MatchNode({ match, isAdmin = false, onUpdate }: MatchNodeProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [score1, setScore1] = useState(match.score1?.toString() || '')
  const [score2, setScore2] = useState(match.score2?.toString() || '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canEdit = isAdmin && match.fencer1Id && match.fencer2Id && !match.isBye

  const handleClick = () => {
    if (canEdit) {
      setScore1(match.score1?.toString() || '')
      setScore2(match.score2?.toString() || '')
      setIsEditing(true)
    }
  }

  const handleSubmit = async () => {
    const s1 = parseInt(score1)
    const s2 = parseInt(score2)

    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 > 15 || s2 > 15) {
      alert('請輸入有效分數')
      return
    }

    if (s1 === s2) {
      alert('分數不可相同（淘汰賽必須分出勝負）')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/bracket/${match.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score1: s1, score2: s2 })
      })

      const data = await res.json()
      if (data.success) {
        setIsEditing(false)
        onUpdate?.()
      } else {
        alert(data.error || '更新失敗')
      }
    } catch (error) {
      console.error('Submit score error:', error)
      alert('更新失敗')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderFencerSlot = (
    fencer: Fencer | null, 
    fencerId: string | null, 
    score: number | null,
    isWinner: boolean,
    ranking: number | null
  ) => {
    if (match.isBye && !fencer) {
      return (
        <div className="px-3 py-2 text-gray-400 italic">
          輪空
        </div>
      )
    }

    return (
      <div className={cn(
        "flex items-center justify-between px-3 py-2",
        isWinner && match.completed && "bg-green-100",
        !isWinner && match.completed && fencer && "bg-red-50"
      )}>
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {(() => {
            const displaySeed = ranking ?? fencer?.seedRank ?? null
            if (displaySeed == null) return null
            return (
            <span className="text-xs text-gray-500 flex-shrink-0">
              [{displaySeed}]
            </span>
          )})()}
          <span className={cn(
            "font-medium truncate",
            !fencer && "text-gray-400 italic"
          )}>
            {fencer?.name || 'TBD'}
          </span>
        </div>
        {match.completed && score !== null && (
          <span className={cn(
            "font-bold ml-4 flex-shrink-0",
            isWinner ? "text-green-700" : "text-red-600"
          )}>
            {score}
          </span>
        )}
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          "w-48 border rounded-lg overflow-hidden shadow-sm",
          match.isBye && "border-gray-200 bg-gray-50",
          !match.isBye && "border-gray-300 bg-white",
          canEdit && "cursor-pointer hover:border-red-400 hover:shadow-md transition-all"
        )}
        onClick={handleClick}
      >
        <div className="divide-y divide-gray-200">
          {renderFencerSlot(
            match.fencer1,
            match.fencer1Id,
            match.score1,
            match.winnerId === match.fencer1Id,
            match.fencer1SeedRank
          )}
          {renderFencerSlot(
            match.fencer2,
            match.fencer2Id,
            match.score2,
            match.winnerId === match.fencer2Id,
            match.fencer2SeedRank
          )}
        </div>
      </div>

      {/* 分數編輯 Modal */}
      <Modal
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        title="登記分數"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-center space-x-4">
            <div className="flex flex-col items-center">
              <label className="text-sm text-gray-500 mb-1">
                {match.fencer1?.seedRank && `[${match.fencer1.seedRank}] `}
                {match.fencer1?.name}
              </label>
              <Input
                type="number"
                min="0"
                max="15"
                value={score1}
                onChange={(e) => setScore1(e.target.value)}
                className="w-20 text-center text-xl"
              />
            </div>
            <span className="text-2xl text-gray-400">:</span>
            <div className="flex flex-col items-center">
              <label className="text-sm text-gray-500 mb-1">
                {match.fencer2?.seedRank && `[${match.fencer2.seedRank}] `}
                {match.fencer2?.name}
              </label>
              <Input
                type="number"
                min="0"
                max="15"
                value={score2}
                onChange={(e) => setScore2(e.target.value)}
                className="w-20 text-center text-xl"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? '儲存中...' : '儲存'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
