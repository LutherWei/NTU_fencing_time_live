'use client'

import { cn } from '@/lib/utils'
import { getRoundName } from '@/lib/bracket-gen'
import { MatchNode, EliminationMatch } from './MatchNode'

interface BracketTreeProps {
  matches: EliminationMatch[]
  competitionType: 'INDIVIDUAL' | 'TEAM'
  isAdmin?: boolean
  onMatchUpdate?: () => void
}

export function BracketTree({ matches, competitionType, isAdmin = false, onMatchUpdate }: BracketTreeProps) {
  // 按輪次分組
  const rounds = [...new Set(matches.filter(m => !m.isThirdPlace).map(m => m.round))].sort((a, b) => b - a)
  const thirdPlaceMatch = matches.find(m => m.isThirdPlace)
  
  // 獲取每輪的比賽
  const getMatchesByRound = (round: number) => {
    return matches
      .filter(m => m.round === round && !m.isThirdPlace)
      .sort((a, b) => a.position - b.position)
  }

  if (matches.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        尚未設置淘汰賽
      </div>
    )
  }

  return (
    <div className="overflow-x-auto pb-8">
      <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
        {rounds.map((round, roundIdx) => {
          const roundMatches = getMatchesByRound(round)
          const roundName = getRoundName(round)
          
          return (
            <div key={round} className="flex flex-col">
              {/* 輪次標題 */}
              <div className="text-center font-semibold text-gray-700 mb-4 px-4">
                {roundName}
              </div>
              
              {/* 該輪的比賽 */}
              <div 
                className={cn(
                  "flex flex-col justify-around flex-1",
                  roundIdx > 0 && "mt-8"
                )}
                style={{
                  gap: `${Math.pow(2, roundIdx) * 2}rem`
                }}
              >
                {roundMatches.map((match) => (
                  <MatchNode
                    key={match.id}
                    match={match}
                    competitionType={competitionType}
                    isAdmin={isAdmin}
                    onUpdate={onMatchUpdate}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {/* 三四名決定戰 */}
        {thirdPlaceMatch && (
          <div className="flex flex-col ml-8 border-l-2 border-gray-200 pl-8">
            <div className="text-center font-semibold text-gray-700 mb-4 px-4">
              三四名決定戰
            </div>
            <div className="flex items-center justify-center flex-1">
              <MatchNode
                match={thirdPlaceMatch}
                competitionType={competitionType}
                isAdmin={isAdmin}
                onUpdate={onMatchUpdate}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
