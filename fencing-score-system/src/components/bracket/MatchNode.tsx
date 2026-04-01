'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { TeamMatchDetailModal } from '@/components/teams/TeamMatchDetailModal'

export interface Participant {
  id: string
  name: string
  seedRank: number | null
}

export interface EliminationMatch {
  id: string
  round: number
  position: number
  fencer1Id: string | null
  fencer2Id: string | null
  team1Id: string | null
  team2Id: string | null
  participant1: Participant | null
  participant2: Participant | null
  participant1SeedRank: number | null
  participant2SeedRank: number | null
  score1: number | null
  score2: number | null
  winnerId: string | null
  winner: Participant | null
  isBye: boolean
  isThirdPlace: boolean
  completed: boolean
}

interface MatchNodeProps {
  match: EliminationMatch
  competitionType: 'INDIVIDUAL' | 'TEAM'
  isAdmin?: boolean
  onUpdate?: () => void
}

export function MatchNode({ match, competitionType, isAdmin = false, onUpdate }: MatchNodeProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [score1, setScore1] = useState(match.score1?.toString() || '')
  const [score2, setScore2] = useState(match.score2?.toString() || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDetailing, setIsDetailing] = useState(false)

  const idField = competitionType === 'TEAM' ? 'team' : 'fencer';
  const canEdit = isAdmin && match[`${idField}1Id`] && match[`${idField}2Id`] && !match.isBye

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
    const maxScore = competitionType === 'TEAM' ? 45 : 15
    
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 > maxScore || s2 > maxScore) {
      alert(`請輸入 0-${maxScore} 之間的有效分數`)
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
        body: JSON.stringify({ 
          score1: s1, 
          score2: s2,
          isTeamMatch: competitionType === 'TEAM'
        })
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

  const handleOpenDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDetailing(true);
  }

  const renderParticipantSlot = (
    participant: Participant | null, 
    score: number | null,
    isWinner: boolean,
    ranking: number | null
  ) => {
    if (match.isBye && !participant) {
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
        !isWinner && match.completed && participant && "bg-red-50"
      )}>
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {(() => {
            const matchSeedRank = participant === match.participant1 ? match.participant1SeedRank : participant === match.participant2 ? match.participant2SeedRank : null
            const displaySeed = matchSeedRank ?? participant?.seedRank ?? null
            if (displaySeed == null) return null
            return (
            <span className="text-xs text-gray-500 flex-shrink-0">
              [{displaySeed}]
            </span>
          )})()}
          <span className={cn(
            "font-medium truncate",
            !participant && "text-gray-400 italic"
          )}>
            {participant?.name || 'TBD'}
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

  const participant1 = match.participant1;
  const participant2 = match.participant2;
  const winnerId = competitionType === 'TEAM' ? match.winnerId : match.winnerId;

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
          {renderParticipantSlot(
            participant1,
            match.score1,
            winnerId === (competitionType === 'TEAM' ? match.team1Id : match.fencer1Id),
            match.participant1SeedRank
          )}
          {renderParticipantSlot(
            participant2,
            match.score2,
            winnerId === (competitionType === 'TEAM' ? match.team2Id : match.fencer2Id),
            match.participant2SeedRank
          )}
        </div>
        {match.completed && competitionType === 'TEAM' && (
          <div className="p-1 bg-gray-50 text-center">
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={handleOpenDetail}>
              [比賽詳情]
            </Button>
          </div>
        )}
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
                {match.participant1SeedRank && `[${match.participant1SeedRank}] `}
                {participant1?.name}
              </label>
              <Input
                type="number"
                min="0"
                max={competitionType === 'TEAM' ? 45 : 15}
                value={score1}
                onChange={(e) => setScore1(e.target.value)}
                className="w-20 text-center text-xl"
              />
            </div>
            <span className="text-2xl text-gray-400">:</span>
            <div className="flex flex-col items-center">
              <label className="text-sm text-gray-500 mb-1">
                {participant2?.name}
              </label>
              <Input
                type="number"
                min="0"
                max={competitionType === 'TEAM' ? 45 : 15}
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

      {isDetailing && (
        <TeamMatchDetailModal
          matchId={match.id}
          isPouleMatch={false}
          isOpen={isDetailing}
          onClose={() => setIsDetailing(false)}
          onUpdate={() => {
            if (onUpdate) onUpdate();
          }}
        />
      )}
    </>
  )
}
