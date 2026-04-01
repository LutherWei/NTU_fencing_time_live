'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { formatPouleScore, formatIndicator, formatWinRate } from '@/lib/fencing-math'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { TeamMatchDetailModal } from '@/components/teams/TeamMatchDetailModal'
import Link from 'next/link'


interface Fencer {
  id: string
  name: string
  victories: number
  defeats: number
  touchesScored: number
  touchesReceived: number
  indicator: number
  winRate: number
}

interface Team {
  id: string
  name: string
  victories: number
  defeats: number
  touchesScored: number
  touchesReceived: number
  indicator: number
  winRate: number
}

interface PouleMatch {
  id: string
  fencer1Id: string | null
  fencer2Id: string | null
  team1Id: string | null
  team2Id: string | null
  score1: number | null
  score2: number | null
  completed: boolean
}

interface PouleMatrixProps {
  pouleId: string
  pouleName: string
  participants: (Fencer | Team)[]
  matches: PouleMatch[]
  competitionType: 'INDIVIDUAL' | 'TEAM'
  isAdmin?: boolean
  onScoreUpdate?: () => void
  onFencerDelete?: (id: string, name: string) => void
}

export function PouleMatrix({
  pouleId,
  pouleName,
  participants,
  matches,
  competitionType,
  isAdmin = false,
  onScoreUpdate,
  onFencerDelete
}: PouleMatrixProps) {
  const router = useRouter()
  const [editingCell, setEditingCell] = useState<{
    rowId: string
    colId: string
    matchId: string
  } | null>(null)
  const [score1, setScore1] = useState('')
  const [score2, setScore2] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [detailingMatch, setDetailingMatch] = useState<PouleMatch | null>(null)

  // 建立比賽查詢表
  const matchMap = new Map<string, PouleMatch>()
  if (competitionType === 'TEAM') {
    for (const match of matches) {
      if (match.team1Id && match.team2Id) {
        matchMap.set(`${match.team1Id}-${match.team2Id}`, match)
        matchMap.set(`${match.team2Id}-${match.team1Id}`, match)
      }
    }
  } else {
    for (const match of matches) {
      matchMap.set(`${match.fencer1Id}-${match.fencer2Id}`, match)
      matchMap.set(`${match.fencer2Id}-${match.fencer1Id}`, match)
    }
  }

  // 獲取兩位選手/隊伍之間的比賽結果
  const getMatchResult = (rowParticipantId: string, colParticipantId: string) => {
    const match = matchMap.get(`${rowParticipantId}-${colParticipantId}`)
    if (!match || !match.completed) return null

    const idField1 = competitionType === 'TEAM' ? 'team1Id' : 'fencer1Id';

    // 判斷 row 選手的得分
    if ((competitionType === 'TEAM' && match.team1Id === rowParticipantId) || (competitionType === 'INDIVIDUAL' && match.fencer1Id === rowParticipantId)) {
      return {
        score: match.score1!,
        opponentScore: match.score2!,
        isWinner: match.score1! > match.score2!,
        matchId: match.id
      }
    } else {
      return {
        score: match.score2!,
        opponentScore: match.score1!,
        isWinner: match.score2! > match.score1!,
        matchId: match.id
      }
    }
  }

  const handleCellClick = (rowParticipant: Fencer | Team, colParticipant: Fencer | Team) => {
    if (!isAdmin) return
    if (rowParticipant.id === colParticipant.id) return

    const match = matchMap.get(`${rowParticipant.id}-${colParticipant.id}`)
    if (!match) return

    if (competitionType === 'TEAM') {
      setDetailingMatch(match)
      return
    }

    const result = getMatchResult(rowParticipant.id, colParticipant.id)
    setScore1(result?.score?.toString() || '')
    setScore2(result?.opponentScore?.toString() || '')
    setEditingCell({
      rowId: rowParticipant.id,
      colId: colParticipant.id,
      matchId: match.id
    })
  }

  const handleSubmitScore = async () => {
    if (!editingCell) return
    
    const s1 = parseInt(score1)
    const s2 = parseInt(score2)
    const maxScore = competitionType === 'TEAM' ? 45 : 5
    
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 > maxScore || s2 > maxScore) {
      alert(`請輸入 0-${maxScore} 之間的有效分數`)
      return
    }

    if (s1 === s2) {
      alert('分數不可相同（必須分出勝負）')
      return
    }

    setIsSubmitting(true)
    
    try {
      // 找到原始比賽的 fencer/team 順序
      const match = matchMap.get(`${editingCell.rowId}-${editingCell.colId}`)
      if (!match) return

      const idField1 = competitionType === 'TEAM' ? 'team1Id' : 'fencer1Id';

      // 根據原始順序提交分數
      let submitScore1 = s1
      let submitScore2 = s2
      
      if (match[idField1] === editingCell.colId) {
        // 如果 fencer1/team1 是 col 選手/隊伍，需要交換分數
        submitScore1 = s2
        submitScore2 = s1
      }

      const res = await fetch(`/api/poules/${pouleId}/matches`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: editingCell.matchId,
          score1: submitScore1,
          score2: submitScore2,
          isTeamMatch: competitionType === 'TEAM'
        })
      })

      const data = await res.json()
      if (data.success) {
        setEditingCell(null)
        onScoreUpdate?.()
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

  const handleSetDetail = (e: React.MouseEvent, match: PouleMatch) => {
    e.stopPropagation();
    
    console.log('🔍 handleOpenDetail called:', { competitionType, isAdmin, completed: match.completed, matchId: match.id })
    
    // 團體賽 & 個人賽都用 overlay modal
    setDetailingMatch(match);
  }

  const handleOpenDetail = (e: React.MouseEvent, match: PouleMatch) => {
    e.stopPropagation();
    
    console.log('🔍 handleOpenDetail called:', { competitionType, isAdmin, completed: match.completed, matchId: match.id })
    
    //直接導到match-detail/[matchID]/page.tsx
    router.push(`/match-detail/${match.id}?isPouleMatch=true&pouleId=${pouleId}`)
  }

  return (
    <div className="overflow-x-auto">
      <h3 className="text-lg font-semibold mb-4">{pouleName}</h3>
      
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className="border border-gray-300 bg-gray-100 p-2 text-left">{competitionType === 'TEAM' ? '隊伍' : '選手'}</th>
            {participants.map((participant, idx) => (
              <th
                key={participant.id}
                className="border border-gray-300 bg-gray-100 p-2 text-center min-w-[60px]"
              >
                {idx + 1}
              </th>
            ))}
            <th className="border border-gray-300 bg-gray-100 p-2 text-center">V</th>
            <th className="border border-gray-300 bg-gray-100 p-2 text-center">V/M</th>
            <th className="border border-gray-300 bg-gray-100 p-2 text-center">TS</th>
            <th className="border border-gray-300 bg-gray-100 p-2 text-center">TR</th>
            <th className="border border-gray-300 bg-gray-100 p-2 text-center">Ind</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((rowParticipant, rowIdx) => (
            <tr key={rowParticipant.id}>
              <td className="border border-gray-300 p-2 bg-gray-50">
                <div className="flex items-center justify-between"><span className="font-medium">{rowIdx + 1}. {rowParticipant.name}</span>{isAdmin && onFencerDelete && competitionType === 'INDIVIDUAL' && (<button onClick={() => onFencerDelete(rowParticipant.id, rowParticipant.name)} className="text-red-500 hover:text-red-700 ml-2" title="棄賽"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg></button>)}</div>
              </td>
              {participants.map((colParticipant, colIdx) => {
                const isDiagonal = rowIdx === colIdx
                const result = isDiagonal ? null : getMatchResult(rowParticipant.id, colParticipant.id)
                
                return (
                  <td
                    key={colParticipant.id}
                    className={cn(
                      'border border-gray-300 p-2 text-center min-w-[80px] h-[60px]',
                      isDiagonal && 'bg-gray-800',
                      !isDiagonal && isAdmin && 'cursor-pointer hover:bg-gray-100',
                      result?.isWinner && 'bg-green-100',
                      result && !result.isWinner && 'bg-red-100'
                    )}
                    onClick={() => handleCellClick(rowParticipant, colParticipant)}
                  >
                    {isDiagonal ? (
                      ''
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        {/* 團體賽：根據 isAdmin 和 completed 顯示不同內容 */}
                        {competitionType === 'TEAM' ? (
                          isAdmin ? (
                            result ? (
                              // Admin + 已完成：顯示分數 + [比賽詳情]
                              <>
                                <span className="font-bold text-lg">
                                  {formatPouleScore(result.score, result.opponentScore)}
                                </span>
                                <Button 
                                  variant="link" 
                                  size="sm" 
                                  className="mt-1 h-auto p-0 text-xs" 
                                  onClick={(e) => handleSetDetail(e, matchMap.get(`${rowParticipant.id}-${colParticipant.id}`)!)}
                                >
                                  [比賽詳情]
                                </Button>
                              </>
                            ) : (
                              // Admin + 未完成：顯示 [開始登記]
                              <Button 
                                variant="link" 
                                size="sm" 
                                className="h-auto p-0 text-xs text-blue-600" 
                                onClick={(e) => handleSetDetail(e, matchMap.get(`${rowParticipant.id}-${colParticipant.id}`)!)}
                              >
                                [開始登記]
                              </Button>
                            )
                          ) : (
                            result ? (
                              // 非Admin + 已完成：顯示分數 + [查看詳情]
                              <>
                                <span className="font-bold text-lg">
                                  {formatPouleScore(result.score, result.opponentScore)}
                                </span>
                                <Button 
                                  variant="link" 
                                  size="sm" 
                                  className="mt-1 h-auto p-0 text-xs" 
                                  onClick={(e) => handleOpenDetail(e, matchMap.get(`${rowParticipant.id}-${colParticipant.id}`)!)}
                                >
                                  [查看詳情]
                                </Button>
                              </>
                            ) : null
                          )
                        ) : (
                          // 個人賽：保持原有邏輯
                          result ? (
                            <>
                              <span className="font-bold text-lg">
                                {formatPouleScore(result.score, result.opponentScore)}
                              </span>
                            </>
                          ) : (
                            isAdmin ? <span className="text-gray-400 text-sm hover:text-gray-600">登記分數</span> : ''
                          )
                        )}
                      </div>
                    )}
                  </td>
                )
              })}
              <td className="border border-gray-300 p-2 text-center font-semibold">{rowParticipant.victories}</td>
              <td className="border border-gray-300 p-2 text-center">{formatWinRate(rowParticipant.winRate)}</td>
              <td className="border border-gray-300 p-2 text-center">{rowParticipant.touchesScored}</td>
              <td className="border border-gray-300 p-2 text-center">{rowParticipant.touchesReceived}</td>
              <td className="border border-gray-300 p-2 text-center">{formatIndicator(rowParticipant.indicator)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingCell && (
        <Modal isOpen={!!editingCell} onClose={() => setEditingCell(null)}>
          <div className="space-y-4">
            <div className="text-center text-gray-600">
              {participants.find(p => p.id === editingCell.rowId)?.name}
              {' vs '}
              {participants.find(p => p.id === editingCell.colId)?.name}
            </div>
            
            <div className="flex items-center justify-center space-x-4">
              <Input
                type="number"
                value={score1}
                onChange={(e) => setScore1(e.target.value)}
                className="w-24 text-center text-lg"
                min="0"
                max={competitionType === 'TEAM' ? 45 : 5}
              />
              <span className="text-lg font-bold">:</span>
              <Input
                type="number"
                value={score2}
                onChange={(e) => setScore2(e.target.value)}
                className="w-24 text-center text-lg"
                min="0"
                max={competitionType === 'TEAM' ? 45 : 5}
              />
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setEditingCell(null)}
              >
                取消
              </Button>
              <Button
                onClick={handleSubmitScore}
                disabled={isSubmitting}
              >
                {isSubmitting ? '儲存中...' : '儲存'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
