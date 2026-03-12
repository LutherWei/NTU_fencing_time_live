'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { formatPouleScore, formatIndicator, formatWinRate } from '@/lib/fencing-math'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

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

interface PouleMatch {
  id: string
  fencer1Id: string
  fencer2Id: string
  score1: number | null
  score2: number | null
  completed: boolean
}

interface PouleMatrixProps {
  pouleId: string
  pouleName: string
  fencers: Fencer[]
  matches: PouleMatch[]
  isAdmin?: boolean
  onScoreUpdate?: () => void
}

export function PouleMatrix({
  pouleId,
  pouleName,
  fencers,
  matches,
  isAdmin = false,
  onScoreUpdate
}: PouleMatrixProps) {
  const [editingCell, setEditingCell] = useState<{
    rowId: string
    colId: string
    matchId: string
  } | null>(null)
  const [score1, setScore1] = useState('')
  const [score2, setScore2] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 建立比賽查詢表
  const matchMap = new Map<string, PouleMatch>()
  for (const match of matches) {
    matchMap.set(`${match.fencer1Id}-${match.fencer2Id}`, match)
    matchMap.set(`${match.fencer2Id}-${match.fencer1Id}`, match)
  }

  // 獲取兩位選手之間的比賽結果
  const getMatchResult = (rowFencerId: string, colFencerId: string) => {
    const match = matchMap.get(`${rowFencerId}-${colFencerId}`)
    if (!match || !match.completed) return null

    // 判斷 row 選手的得分
    if (match.fencer1Id === rowFencerId) {
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

  const handleCellClick = (rowFencer: Fencer, colFencer: Fencer) => {
    if (!isAdmin) return
    if (rowFencer.id === colFencer.id) return

    const match = matchMap.get(`${rowFencer.id}-${colFencer.id}`)
    if (!match) return

    const result = getMatchResult(rowFencer.id, colFencer.id)
    setScore1(result?.score?.toString() || '')
    setScore2(result?.opponentScore?.toString() || '')
    setEditingCell({
      rowId: rowFencer.id,
      colId: colFencer.id,
      matchId: match.id
    })
  }

  const handleSubmitScore = async () => {
    if (!editingCell) return
    
    const s1 = parseInt(score1)
    const s2 = parseInt(score2)
    
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 > 5 || s2 > 5) {
      alert('請輸入有效分數')
      return
    }

    if (s1 === s2) {
      alert('分數不可相同（必須分出勝負）')
      return
    }

    setIsSubmitting(true)
    
    try {
      // 找到原始比賽的 fencer 順序
      const match = matchMap.get(`${editingCell.rowId}-${editingCell.colId}`)
      if (!match) return

      // 根據原始順序提交分數
      let submitScore1 = s1
      let submitScore2 = s2
      
      if (match.fencer1Id === editingCell.colId) {
        // 如果 fencer1 是 col 選手，需要交換分數
        submitScore1 = s2
        submitScore2 = s1
      }

      const res = await fetch(`/api/poules/${pouleId}/matches`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: editingCell.matchId,
          score1: submitScore1,
          score2: submitScore2
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

  return (
    <div className="overflow-x-auto">
      <h3 className="text-lg font-semibold mb-4">{pouleName}</h3>
      
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className="border border-gray-300 bg-gray-100 p-2 text-left">選手</th>
            {fencers.map((fencer, idx) => (
              <th
                key={fencer.id}
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
          {fencers.map((rowFencer, rowIdx) => (
            <tr key={rowFencer.id}>
              <td className="border border-gray-300 p-2 bg-gray-50">
                <span className="font-medium">{rowIdx + 1}. {rowFencer.name}</span>
              </td>
              {fencers.map((colFencer, colIdx) => {
                const isDiagonal = rowIdx === colIdx
                const result = isDiagonal ? null : getMatchResult(rowFencer.id, colFencer.id)
                
                return (
                  <td
                    key={colFencer.id}
                    className={cn(
                      "border border-gray-300 p-2 text-center min-w-[60px]",
                      isDiagonal && "bg-gray-800",
                      !isDiagonal && result && result.isWinner && "bg-green-100",
                      !isDiagonal && result && !result.isWinner && "bg-red-100",
                      !isDiagonal && isAdmin && "cursor-pointer hover:bg-blue-50"
                    )}
                    onClick={() => handleCellClick(rowFencer, colFencer)}
                  >
                    {isDiagonal ? (
                      <span className="text-gray-400">X</span>
                    ) : result ? (
                      <span className={cn(
                        "font-medium",
                        result.isWinner ? "text-green-700" : "text-red-700"
                      )}>
                        {formatPouleScore(result.score, result.isWinner)}
                      </span>
                    ) : (
                      isAdmin && <span className="text-gray-300">-</span>
                    )}
                  </td>
                )
              })}
              <td className="border border-gray-300 p-2 text-center font-medium">
                {rowFencer.victories}
              </td>
              <td className="border border-gray-300 p-2 text-center">
                {formatWinRate(rowFencer.winRate)}
              </td>
              <td className="border border-gray-300 p-2 text-center">
                {rowFencer.touchesScored}
              </td>
              <td className="border border-gray-300 p-2 text-center">
                {rowFencer.touchesReceived}
              </td>
              <td className={cn(
                "border border-gray-300 p-2 text-center font-medium",
                rowFencer.indicator > 0 && "text-green-600",
                rowFencer.indicator < 0 && "text-red-600"
              )}>
                {formatIndicator(rowFencer.indicator)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 分數編輯 Modal */}
      <Modal
        isOpen={editingCell !== null}
        onClose={() => setEditingCell(null)}
        title="登記分數"
      >
        {editingCell && (
          <div className="space-y-4">
            <div className="text-center text-gray-600">
              {fencers.find(f => f.id === editingCell.rowId)?.name}
              {' vs '}
              {fencers.find(f => f.id === editingCell.colId)?.name}
            </div>
            
            <div className="flex items-center justify-center space-x-4">
              <div className="flex flex-col items-center">
                <label className="text-sm text-gray-500 mb-1">
                  {fencers.find(f => f.id === editingCell.rowId)?.name}
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
                  {fencers.find(f => f.id === editingCell.colId)?.name}
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
        )}
      </Modal>
    </div>
  )
}
