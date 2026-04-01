'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  winnerTeamId: string | null
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
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [score1, setScore1] = useState(match.score1?.toString() || '')
  const [score2, setScore2] = useState(match.score2?.toString() || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDetailing, setIsDetailing] = useState(false)

  const isTeam = competitionType === 'TEAM'
  const idField = isTeam ? 'team' : 'fencer'
  const p1Id = match[`${idField}1Id` as 'team1Id' | 'fencer1Id']
  const p2Id = match[`${idField}2Id` as 'team2Id' | 'fencer2Id']

  const hasBothParticipants = !!p1Id && !!p2Id && !match.isBye

  // ── 點擊邏輯（完全分開個人 / 團體）──────────────────────────────────────────
  //
  // 個人賽：
  //   admin + 未完成 → 開分數 Modal（isEditing）
  //   任何人 + 已完成 → 導向 /match-detail/[id]
  //
  // 團體賽：
  //   admin + 未完成 → 開 TeamMatchDetailModal（isDetailing）
  //   任何人 + 已完成 → 導向 /match-detail/[id]
  //   admin + 已完成  → 導向 /match-detail/[id]（詳情頁比 Modal 更完整）

  const handleClick = () => {
    if (!hasBothParticipants) return

    if (isTeam) {
      if (isAdmin && !match.completed) {
        // 團體賽 admin 未完成 → TeamMatchDetailModal
        setIsDetailing(true)
      } else if (match.completed) {
        // 團體賽已完成 → 詳情頁
        router.push(`/match-detail/${match.id}?isPouleMatch=false`)
      }
    } else {
      // 個人賽
      if (isAdmin && !match.completed) {
        // 個人賽 admin 未完成 → 分數 Modal
        setIsEditing(true)
      } 
    }
  }

  // 「比賽詳情」按鈕的點擊（僅團體賽完成後顯示）
  const handleDetailButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/match-detail/${match.id}?isPouleMatch=false`)
  }

  const handleSubmit = async () => {
    const s1 = parseInt(score1)
    const s2 = parseInt(score2)
    const maxScore = isTeam ? 45 : 15

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
        body: JSON.stringify({ score1: s1, score2: s2, isTeamMatch: isTeam }),
      })
      const data = await res.json()
      if (data.success) {
        setIsEditing(false)
        onUpdate?.()
      } else {
        alert(data.error || '更新失敗')
      }
    } catch {
      alert('更新失敗')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Participant Slot ─────────────────────────────────────────────────────────

  const renderParticipantSlot = (
    participant: Participant | null,
    score: number | null,
    isWinner: boolean,
    isBye: boolean,
  ) => {
    // 輪空格
    if (isBye && !participant) {
      return (
        <div className="px-3 py-2 text-sm text-gray-400">
          輪空
        </div>
      )
    }

    // 勝負顏色：個人賽與團體賽邏輯相同
    const showResult = match.completed && !!participant
    const bgClass = showResult
      ? isWinner
        ? 'bg-green-100'
        : 'bg-red-50'
      : ''

    return (
      <div className={cn('flex items-center justify-between px-3 py-2', bgClass)}>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {/* 種子排名 */}
          {(() => {
            const seedRank =
              participant === match.participant1
                ? match.participant1SeedRank
                : participant === match.participant2
                  ? match.participant2SeedRank
                  : null
            const display = seedRank ?? participant?.seedRank ?? null
            if (display == null) return null
            return <span className="text-xs text-gray-400 shrink-0">[{display}]</span>
          })()}

          {/* 姓名 / 隊名 */}
          <span className={cn(
            'font-medium truncate text-sm',
            !participant && 'text-gray-400 italic',
            showResult && isWinner && 'text-green-700',
            showResult && !isWinner && 'text-red-600',
          )}>
            {participant?.name || 'TBD'}
          </span>
        </div>

        {/* 分數 */}
        {match.completed && score !== null && (
          <span className={cn(
            'font-bold ml-3 shrink-0 text-sm',
            isWinner ? 'text-green-700' : 'text-red-500',
          )}>
            {score}
          </span>
        )}
      </div>
    )
  }

  // ── 勝者判斷 ────────────────────────────────────────────────────────────────

  const winner1 = isTeam
    ? match.winnerTeamId === p1Id
    : match.winnerId === p1Id
  const winner2 = isTeam
    ? match.winnerTeamId === p2Id
    : match.winnerId === p2Id

  // 節點是否可點擊
  const isClickable =
    hasBothParticipants &&
    (
      (isTeam && ((isAdmin && !match.completed) || match.completed)) ||
      (!isTeam && ((isAdmin && !match.completed) || match.completed))
    )

  return (
    <>
      {/* ── Match Node Card ── */}
      <div
        className={cn(
          'w-48 border rounded-lg overflow-hidden shadow-sm select-none',
          match.isBye ? 'border-gray-200 bg-gray-50' : 'border-gray-300 bg-white',
          isClickable && 'cursor-pointer hover:border-red-400 hover:shadow-md transition-all',
        )}
        onClick={handleClick}
      >
        <div className="divide-y divide-gray-200">
          {renderParticipantSlot(match.participant1, match.score1, winner1, match.isBye && !match.participant1)}
          {renderParticipantSlot(match.participant2, match.score2, winner2, match.isBye && !match.participant2)}
        </div>

        {/* 團體賽：額外「比賽詳情」連結 */}
        {match.completed && isTeam && hasBothParticipants && (
          <div className="px-2 py-1 bg-gray-50 border-t border-gray-100 text-center">
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={handleDetailButtonClick}
            >
              [查看詳情]
            </button>
          </div>
        )}
      </div>

      {/* ── 個人賽分數 Modal ── */}
      {!isTeam && (
        <Modal
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          title="登記分數"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center">
                <label className="text-sm text-gray-500 mb-1">
                  {match.participant1?.name}
                </label>
                <Input
                  type="number"
                  min="0"
                  max={15}
                  value={score1}
                  onChange={e => setScore1(e.target.value)}
                  className="w-20 text-center text-xl"
                />
              </div>
              <span className="text-2xl text-gray-400">:</span>
              <div className="flex flex-col items-center">
                <label className="text-sm text-gray-500 mb-1">
                  {match.participant2?.name}
                </label>
                <Input
                  type="number"
                  min="0"
                  max={15}
                  value={score2}
                  onChange={e => setScore2(e.target.value)}
                  className="w-20 text-center text-xl"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}>取消</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? '儲存中...' : '儲存'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 團體賽 TeamMatchDetailModal（admin + 未完成） ── */}
      {isTeam && isAdmin && !match.completed && isDetailing && (
        <TeamMatchDetailModal
          matchId={match.id}
          isPouleMatch={false}
          isOpen={isDetailing}
          onClose={() => setIsDetailing(false)}
          onUpdate={() => {
            setIsDetailing(false)
            onUpdate?.()
          }}
        />
      )}
    </>
  )
}
