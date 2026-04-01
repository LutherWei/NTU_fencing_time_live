'use client'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ArrowLeft } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Fencer {
  id: string
  name: string
}

interface Team {
  id: string
  name: string
  members: Fencer[]
}

type SeqType = '123' | '456'

interface Lineup {
  [slot: string]: string | null
}

interface Bout {
  order: number
  fencer1Id: string
  fencer2Id: string
  score1: number
  score2: number
  cumScore1: number
  cumScore2: number
}

interface TeamMatchDetailModalProps {
  matchId: string
  pouleId?: string
  categoryId?: string
  isPouleMatch: boolean
  /** 全頁模式不需要此 prop（undefined / false 時為全頁；true 時套 overlay） */
  isOpen?: boolean
  onClose: () => void
  onUpdate: () => void
}

// ─── 正式賽程 ────────────────────────────────────────────────────────────────

const BOUT_SCHEDULE = [
  { round: 1, r1: 3, r2: 6 },
  { round: 2, r1: 1, r2: 5 },
  { round: 3, r1: 2, r2: 4 },
  { round: 4, r1: 1, r2: 6 },
  { round: 5, r1: 3, r2: 4 },
  { round: 6, r1: 2, r2: 5 },
  { round: 7, r1: 1, r2: 4 },
  { round: 8, r1: 2, r2: 6 },
  { round: 9, r1: 3, r2: 5 },
] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyBouts(): Bout[] {
  return BOUT_SCHEDULE.map(s => ({
    order: s.round,
    fencer1Id: '',
    fencer2Id: '',
    score1: 0,
    score2: 0,
    cumScore1: 0,
    cumScore2: 0,
  }))
}

function syncCumulative(bouts: Bout[]): Bout[] {
  return bouts.map(b => ({ ...b, cumScore1: b.score1, cumScore2: b.score2 }))
}

function validateCumScore(
  bouts: Bout[],
  boutIndex: number,
  side: 'score1' | 'score2',
  newVal: number,
): string | null {
  const round = boutIndex + 1
  const maxAllowed = round * 5
  if (newVal > maxAllowed) return `上限 ${maxAllowed}（第${round}局）`
  const prevVal = boutIndex > 0 ? bouts[boutIndex - 1][side] : 0
  if (newVal < prevVal) return `不可低於上局（${prevVal}）`
  return null
}

function resolveFencerId(role: number, seq1: SeqType, lineup1: Lineup, lineup2: Lineup): string {
  const in123 = [1, 2, 3].includes(role)
  if (seq1 === '123') return in123 ? (lineup1[role] ?? '') : (lineup2[role] ?? '')
  else return in123 ? (lineup2[role] ?? '') : (lineup1[role] ?? '')
}

// ─── StepIndicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const steps = ['賽序', '棒次', '比賽']
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => {
        const n = i + 1
        const done = n < step
        const active = n === step
        return (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border
              ${done ? 'bg-green-100 text-green-700 border-green-300' : active ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {done ? '✓' : n}
            </div>
            <span className={`text-xs font-medium ${active ? 'text-gray-900' : 'text-gray-600'}`}>{label}</span>
            {i < 2 && <div className="w-8 h-px bg-gray-300" />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: 賽序 ────────────────────────────────────────────────────────────

interface Step1Props {
  team1: Team; team2: Team
  seq1: SeqType | null; seq2: SeqType | null
  onSetSeq: (team: 'team1' | 'team2', seq: SeqType) => void
  onRandom: () => void; onNext: () => void
}

function Step1SeqSelection({ team1, team2, seq1, seq2, onSetSeq, onRandom, onNext }: Step1Props) {
  const conflict = seq1 !== null && seq2 !== null && seq1 === seq2
  const canProceed = seq1 !== null && seq2 !== null && !conflict

  function SeqCard({ team, seq, current, other }: {
    team: 'team1' | 'team2'; seq: SeqType; current: SeqType | null; other: SeqType | null
  }) {
    const selected = current === seq
    const disabled = other === seq
    return (
      <button
        onClick={() => !disabled && onSetSeq(team, seq)}
        disabled={disabled}
        className={`flex-1 py-4 rounded-lg border text-center transition-all
          ${selected ? 'border-gray-900 bg-gray-50' : disabled ? 'border-gray-100 opacity-40 cursor-not-allowed' : 'border-gray-300 hover:border-gray-500'}`}
      >
        <div className="text-2xl font-medium mb-1 text-gray-900">{seq}</div>
        <div className="text-xs text-gray-600">賽序組合</div>
      </button>
    )
  }

  return (
    <div>
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-700 font-medium">⚠️ 此步驟完成後無法返回，請謹慎選擇</p>
      </div>
      <p className="text-sm text-gray-700 mb-4">兩隊各選擇一個賽序，不可重複。</p>
      <div className="grid grid-cols-2 gap-6 mb-4">
        {([['team1', team1, seq1, seq2], ['team2', team2, seq2, seq1]] as const).map(([key, team, cur, other]) => (
          <div key={key}>
            <div className="text-sm font-medium mb-2">{team.name}</div>
            <div className="flex gap-2">
              <SeqCard team={key} seq="123" current={cur} other={other} />
              <SeqCard team={key} seq="456" current={cur} other={other} />
            </div>
            {cur && (
              <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${cur === '123' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                已選 {cur}
              </span>
            )}
          </div>
        ))}
      </div>
      {conflict && <p className="text-red-500 text-xs mb-2">兩隊不可選擇相同賽序</p>}
      <div className="flex items-center justify-between mt-4">
        <Button variant="outline" size="sm" onClick={onRandom}>隨機分配</Button>
        <Button onClick={onNext} disabled={!canProceed}>鎖定賽序並下一步 →</Button>
      </div>
    </div>
  )
}

// ─── Step 2: 棒次 ────────────────────────────────────────────────────────────

interface Step2Props {
  team1: Team; team2: Team
  seq1: SeqType; seq2: SeqType
  lineup1: Lineup; lineup2: Lineup
  onAssign: (team: 'team1' | 'team2', slot: string, fencerId: string | null) => void
  onNext: () => void
}

function Step2Lineup({ team1, team2, seq1, seq2, lineup1, lineup2, onAssign, onNext }: Step2Props) {
  function LineupPanel({ team, seq, lineup, teamKey }: {
    team: Team; seq: SeqType; lineup: Lineup; teamKey: 'team1' | 'team2'
  }) {
    const slots = seq === '123' ? [1, 2, 3] : [4, 5, 6]
    function usedFencers(excludeSlot: string) {
      return [...slots.map(String), 'sub'].filter(s => s !== excludeSlot).map(s => lineup[s]).filter(Boolean)
    }
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium">{team.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${seq === '123' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{seq}</span>
        </div>
        {slots.map(n => {
          const used = usedFencers(String(n))
          return (
            <div key={n} className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium shrink-0">{n}</div>
              <select
                value={lineup[n] ?? ''}
                onChange={e => onAssign(teamKey, String(n), e.target.value || null)}
                className="flex-1 text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">選擇選手...</option>
                {team.members.map(f => (
                  <option key={f.id} value={f.id} disabled={used.includes(f.id)}>{f.name}</option>
                ))}
              </select>
            </div>
          )
        })}
        <div className="flex items-center gap-2 mt-1">
          <div className="w-6 h-6 rounded-full bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 shrink-0">補</div>
          <select
            value={lineup['sub'] ?? ''}
            onChange={e => onAssign(teamKey, 'sub', e.target.value || null)}
            className="flex-1 text-sm border border-dashed border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-500"
          >
            <option value="">候補選手（選填）</option>
            {team.members.map(f => {
              const isMain = slots.map(String).some(s => lineup[s] === f.id)
              return <option key={f.id} value={f.id} disabled={isMain}>{f.name}</option>
            })}
          </select>
        </div>
      </div>
    )
  }

  const complete =
    (seq1 === '123' ? [1, 2, 3] : [4, 5, 6]).every(n => lineup1[n]) &&
    (seq2 === '123' ? [1, 2, 3] : [4, 5, 6]).every(n => lineup2[n])

  return (
    <div>
      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800 font-medium">📌 賽序已鎖定無法修改 | ⚠️ 此步驟完成後無法返回修改棒次</p>
      </div>
      <p className="text-sm text-gray-700 mb-4">為每個號碼指定選手及候補。確認後將進入記分階段。</p>
      <div className="grid grid-cols-2 gap-6 mb-4">
        <LineupPanel team={team1} seq={seq1} lineup={lineup1} teamKey="team1" />
        <LineupPanel team={team2} seq={seq2} lineup={lineup2} teamKey="team2" />
      </div>
      <div className="flex justify-end mt-4">
        <Button onClick={onNext} disabled={!complete}>確認棒次並開始記分 →</Button>
      </div>
    </div>
  )
}

// ─── Step 3: 比賽記分 ────────────────────────────────────────────────────────

interface Step3Props {
  team1: Team; team2: Team
  seq1: SeqType
  lineup1: Lineup; lineup2: Lineup
  team1SubTarget: string | null; team2SubTarget: string | null
  bouts: Bout[]
  sideSwapped: boolean
  isSubmitting: boolean
  isSavingLock: boolean
  categoryId?: string
  onScoreChange: (order: number, side: 'score1' | 'score2', value: string) => void
  onLockBout: (boutIndex: number) => void
  onSwapFencer: (boutOrder: number, fencerKey: 'fencer1Id' | 'fencer2Id', teamKey: 'team1' | 'team2', role: string, newFencerId: string) => void
  onSwapSides: () => void
  onSubmit: () => void
  onClose: () => void
}

function Step3Scoreboard({
  team1, team2, 
  seq1, lineup1, lineup2, 
  team1SubTarget, team2SubTarget,
  bouts, sideSwapped, isSubmitting, isSavingLock, categoryId,
  onScoreChange, onLockBout, onSwapFencer, onSwapSides, onSubmit, onClose,
}: Step3Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const allMembers = [...team1.members, ...team2.members]
  function fencerName(id: string) { return allMembers.find(m => m.id === id)?.name ?? id }

  const r1Team = seq1 === '123' ? team1 : team2
  const r2Team = seq1 === '123' ? team2 : team1
  const leftTeam  = sideSwapped ? r2Team : r1Team
  const rightTeam = sideSwapped ? r1Team : r2Team

  const leftKey  = (sideSwapped ? 'score2' : 'score1') as 'score1' | 'score2'
  const rightKey = (sideSwapped ? 'score1' : 'score2') as 'score1' | 'score2'

  const leftRole  = (sched: typeof BOUT_SCHEDULE[number]) => sideSwapped ? sched.r2 : sched.r1
  const rightRole = (sched: typeof BOUT_SCHEDULE[number]) => sideSwapped ? sched.r1 : sched.r2

  const last = bouts[bouts.length - 1]
  const leftTotal  = (sideSwapped ? last?.score2 : last?.score1) ?? 0
  const rightTotal = (sideSwapped ? last?.score1 : last?.score2) ?? 0

  function boutTs(i: number, key: 'score1' | 'score2'): number {
    return Math.max(bouts[i][key] - (i > 0 ? bouts[i - 1][key] : 0), 0)
  }

  // 判斷某局是否已被鎖定（下一局存在且分數不全為 0）
  function isBoutLocked(boutIndex: number): boolean {
    if (boutIndex < bouts.length - 1) {
      const next = bouts[boutIndex + 1]
      return next.score1 !== 0 || next.score2 !== 0
    }
    return false
  }

  // 判斷某局是否可以鎖定（兩側分數都有輸入，且無錯誤）
  function canLock(boutIndex: number): boolean {
    const b = bouts[boutIndex]
    if (isBoutLocked(boutIndex)) return false
    // 至少有一方得分 > 0，且本局沒有 error
    const hasScore = b.score1 > 0 || b.score2 > 0
    const lErrKey = `${b.order}-${leftKey}`
    const rErrKey = `${b.order}-${rightKey}`
    return hasScore && !errors[lErrKey] && !errors[rErrKey]
  }

  function handleInput(order: number, key: 'score1' | 'score2', value: string) {
    const boutIndex = order - 1
    if (isBoutLocked(boutIndex)) return

    let raw = parseInt(value)
    if (isNaN(raw)) raw = 0
    const errKey = `${order}-${key}`
    const err = validateCumScore(bouts, boutIndex, key, raw)
    if (err) {
      setErrors(prev => ({ ...prev, [errKey]: err }))
    } else {
      setErrors(prev => { const n = { ...prev }; delete n[errKey]; return n })
    }
    onScoreChange(order, key, String(raw))
  }

  function renderFencerWithSub(role: number, actualFencerId: string, fencerKey: 'fencer1Id' | 'fencer2Id', boutOrder: number) {
    const in123 = [1, 2, 3].includes(role)
    const isTeam1 = in123 ? seq1 === '123' : seq1 !== '123'
    const teamKey = isTeam1 ? 'team1' : 'team2'
    const lineup = isTeam1 ? lineup1 : lineup2
    const subTarget = isTeam1 ? team1SubTarget : team2SubTarget

    const hasSub = !!lineup['sub']
    const originalId = lineup[String(role)]
    const subId = lineup['sub']
    const isSubbed = actualFencerId === subId
    const canSwap = hasSub && (subTarget === null || subTarget === String(role))

    return (
      <div className="flex flex-col items-center justify-center gap-1 min-h-[44px]">
        <span className={isSubbed ? 'text-orange-700 font-bold' : 'text-gray-900'}>
          {fencerName(actualFencerId)}
          {isSubbed && <span className="text-[10px] ml-1 bg-orange-100 text-orange-800 px-1 rounded font-medium">候補</span>}
        </span>
        {canSwap && (
          <button
            onClick={() => onSwapFencer(boutOrder, fencerKey, teamKey, String(role), isSubbed ? originalId! : subId!)}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors font-medium ${
              isSubbed ? 'border-gray-400 text-gray-700 hover:bg-gray-200' : 'border-orange-400 text-orange-700 hover:bg-orange-100'
            }`}
          >
            {isSubbed ? '↑ 換回來' : '↓ 換候補'}
          </button>
        )}
      </div>
    )
  }

  const hasErrors = Object.keys(errors).length > 0

  return (
    <div>
      {/* 大比分 + 換邊 */}
      <div className="flex items-center justify-between mb-4 py-3 px-4 bg-gray-100 rounded-lg">
        <div className="flex items-center gap-5">
          <div className="text-center">
            <div className="text-xs text-gray-700 mb-0.5 font-medium">{leftTeam.name}</div>
            <div className={`text-3xl font-bold ${leftTotal > rightTotal ? 'text-green-600' : 'text-gray-700'}`}>{leftTotal}</div>
          </div>
          <div className="text-gray-400 text-lg">vs</div>
          <div className="text-center">
            <div className="text-xs text-gray-700 mb-0.5 font-medium">{rightTeam.name}</div>
            <div className={`text-3xl font-bold ${rightTotal > leftTotal ? 'text-green-600' : 'text-gray-700'}`}>{rightTotal}</div>
          </div>
          {isSavingLock && (
            <span className="text-xs text-blue-600 animate-pulse">儲存中...</span>
          )}
        </div>
        <button
          onClick={onSwapSides}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-md transition-colors
            ${sideSwapped ? 'border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100' : 'border-gray-300 text-gray-700 hover:bg-gray-200'}`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 4.5h12M9.5 2 12 4.5 9.5 7M13 9.5H1M4.5 7 2 9.5 4.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {sideSwapped ? '已換邊' : '換邊'}
        </button>
      </div>

      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-800 font-medium">🔒 棒次已鎖定 | 每局填完後按「鎖定」，系統自動存檔並即時更新大比分</p>
      </div>

      {/* 記分表 */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 text-xs text-gray-700 font-semibold">
              <th className="p-2 border border-gray-200 text-center w-8">#</th>
              <th className="p-2 border border-gray-200 text-center w-[120px]">{leftTeam.name}</th>
              <th className="p-2 border border-gray-200 text-center w-10">TS</th>
              <th className="p-2 border border-gray-200 text-center w-16">Score</th>
              <th className="p-2 border border-gray-200 text-center w-16">Score</th>
              <th className="p-2 border border-gray-200 text-center w-10">TS</th>
              <th className="p-2 border border-gray-200 text-center w-[120px]">{rightTeam.name}</th>
              <th className="p-2 border border-gray-200 text-center w-8">#</th>
              <th className="p-2 border border-gray-200 text-center w-16">操作</th>
            </tr>
          </thead>
          <tbody>
            {BOUT_SCHEDULE.map((sched, i) => {
              const bout = bouts[i]
              const lRole = leftRole(sched)
              const rRole = rightRole(sched)
              const lTs = boutTs(i, leftKey)
              const rTs = boutTs(i, rightKey)
              const lCum = bout[leftKey]
              const rCum = bout[rightKey]
              const lErrKey = `${bout.order}-${leftKey}`
              const rErrKey = `${bout.order}-${rightKey}`
              const locked = isBoutLocked(i)
              const lockable = canLock(i)

              return (
                <tr key={bout.order} className={`${i % 2 === 0 ? '' : 'bg-gray-50/50'} ${locked ? 'opacity-75' : ''}`}>
                  <td className="p-2 border border-gray-200 text-center text-gray-600">{lRole}</td>

                  {/* 左隊選手 */}
                  <td className="p-2 border border-gray-200 text-center">
                    {renderFencerWithSub(lRole, sideSwapped ? bout.fencer2Id : bout.fencer1Id, sideSwapped ? 'fencer2Id' : 'fencer1Id', bout.order)}
                  </td>

                  {/* 左 TS */}
                  <td className="p-2 border border-gray-200 text-center">
                    <span className={`inline-block min-w-[22px] px-1 py-0.5 rounded text-xs font-medium text-center
                      ${lTs > rTs ? 'bg-green-100 text-green-700' : lTs < rTs ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-700'}`}>
                      {lTs}
                    </span>
                  </td>

                  {/* 左累積分 */}
                  <td className="p-2 border border-gray-200">
                    <div className="flex flex-col items-center">
                      {locked ? (
                        <span className="w-14 text-center font-medium text-gray-700">{lCum}</span>
                      ) : (
                        <Input
                          type="number"
                          value={lCum.toString()}
                          onChange={e => handleInput(bout.order, leftKey, e.target.value)}
                          className={`w-14 text-center ${errors[lErrKey] ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                        />
                      )}
                      {errors[lErrKey] && <span className="text-red-600 text-[10px] leading-tight mt-0.5 whitespace-nowrap">{errors[lErrKey]}</span>}
                      {locked && <span className="text-gray-500 text-[10px] mt-0.5">已鎖定</span>}
                    </div>
                  </td>

                  {/* 右累積分 */}
                  <td className="p-2 border border-gray-200">
                    <div className="flex flex-col items-center">
                      {locked ? (
                        <span className="w-14 text-center font-medium text-gray-700">{rCum}</span>
                      ) : (
                        <Input
                          type="number"
                          value={rCum.toString()}
                          onChange={e => handleInput(bout.order, rightKey, e.target.value)}
                          className={`w-14 text-center ${errors[rErrKey] ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                        />
                      )}
                      {errors[rErrKey] && <span className="text-red-600 text-[10px] leading-tight mt-0.5 whitespace-nowrap">{errors[rErrKey]}</span>}
                      {locked && <span className="text-gray-500 text-[10px] mt-0.5">已鎖定</span>}
                    </div>
                  </td>

                  {/* 右 TS */}
                  <td className="p-2 border border-gray-200 text-center">
                    <span className={`inline-block min-w-[22px] px-1 py-0.5 rounded text-xs font-medium text-center
                      ${rTs > lTs ? 'bg-green-100 text-green-700' : rTs < lTs ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-700'}`}>
                      {rTs}
                    </span>
                  </td>

                  {/* 右隊選手 */}
                  <td className="p-2 border border-gray-200 text-center">
                    {renderFencerWithSub(rRole, sideSwapped ? bout.fencer1Id : bout.fencer2Id, sideSwapped ? 'fencer1Id' : 'fencer2Id', bout.order)}
                  </td>

                  <td className="p-2 border border-gray-200 text-center text-gray-600">{rRole}</td>

                  {/* 鎖定按鈕 */}
                  <td className="p-2 border border-gray-200 text-center">
                    {locked ? (
                      <span className="text-[11px] text-gray-400">🔒</span>
                    ) : (
                      <button
                        onClick={() => onLockBout(i)}
                        disabled={!lockable}
                        className={`text-[11px] px-2 py-1 rounded border font-medium transition-colors
                          ${lockable
                            ? 'border-blue-400 text-blue-700 hover:bg-blue-50'
                            : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}
                      >
                        鎖定
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between mt-4">
        <Link href={`/admin/poules/${categoryId}`}>
          <Button onClick={onSubmit} disabled={isSubmitting || hasErrors}>
            {isSubmitting ? '儲存中...' : '儲存並更新總分'}
          </Button>
        </Link>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TeamMatchDetailModal({
  matchId,
  pouleId,
  categoryId,
  isPouleMatch,
  isOpen,
  onClose,
  onUpdate,
}: TeamMatchDetailModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [team1, setTeam1] = useState<Team | null>(null)
  const [team2, setTeam2] = useState<Team | null>(null)
  const [seq1, setSeq1] = useState<SeqType | null>(null)
  const [seq2, setSeq2] = useState<SeqType | null>(null)
  const [lineup1, setLineup1] = useState<Lineup>({})
  const [lineup2, setLineup2] = useState<Lineup>({})
  const [team1SubTarget, setTeam1SubTarget] = useState<string | null>(null)
  const [team2SubTarget, setTeam2SubTarget] = useState<string | null>(null)
  const [bouts, setBouts] = useState<Bout[]>(emptyBouts())
  const [sideSwapped, setSideSwapped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingLock, setIsSavingLock] = useState(false)

  // overlay 模式（isOpen 有被傳入）：isOpen===false 時不 render
  const isOverlayMode = isOpen !== undefined
  if (isOverlayMode && !isOpen) return null

  // 使用 ref 追蹤最新的 seq1（閉包問題）
  const seq1Ref = useRef(seq1)
  useEffect(() => { seq1Ref.current = seq1 }, [seq1])

  useEffect(() => {
    setSideSwapped(false)
    fetchDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

  // overlay 模式下，isOpen 從 false→true 時重新 fetch
  useEffect(() => {
    if (isOverlayMode && isOpen) {
      setSideSwapped(false)
      fetchDetails()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])
  

  function buildBoutsFromLineup(s1: SeqType, l1: Lineup, l2: Lineup, existingBouts?: Bout[]): Bout[] {
    const existing = new Map<number, Bout>((existingBouts ?? []).map(b => [b.order, b]))
    const raw = BOUT_SCHEDULE.map(sched => {
      const prev = existing.get(sched.round)
      return {
        order: sched.round,
        fencer1Id: prev?.fencer1Id || resolveFencerId(sched.r1, s1, l1, l2),
        fencer2Id: prev?.fencer2Id || resolveFencerId(sched.r2, s1, l1, l2),
        score1: prev?.score1 ?? 0,
        score2: prev?.score2 ?? 0,
        cumScore1: prev?.score1 ?? 0,
        cumScore2: prev?.score2 ?? 0,
      }
    })
    return raw
  }

  async function fetchDetails() {
    setLoading(true)
    try {
      const res = await fetch(`/api/match-detail/${matchId}?isPouleMatch=${isPouleMatch}`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: '讀取失敗' }))
        alert(`⚠️ 讀取失敗 (HTTP ${res.status})\n${errData.error || '未知錯誤'}`)
        return
      }
      const data = await res.json()
      if (!data.success) { alert(`⚠️ ${data.error || '讀取失敗'}`); return }

      setTeam1(data.data.team1)
      setTeam2(data.data.team2)

      const existingBouts: Bout[] = data.data.detail?.bouts ?? []
      const savedSetup = data.data.setup

      if (savedSetup?.seq1 && savedSetup?.seq2 && savedSetup?.lineup1 && savedSetup?.lineup2) {
        setSeq1(savedSetup.seq1)
        setSeq2(savedSetup.seq2)
        setLineup1(savedSetup.lineup1)
        setLineup2(savedSetup.lineup2)
        setTeam1SubTarget(savedSetup.team1SubTarget || null)
        setTeam2SubTarget(savedSetup.team2SubTarget || null)
        setBouts(existingBouts.length > 0
          ? existingBouts
          : buildBoutsFromLineup(savedSetup.seq1, savedSetup.lineup1, savedSetup.lineup2)
        )
        setStep(3)
      } else if (savedSetup?.seq1 && savedSetup?.seq2) {
        setSeq1(savedSetup.seq1)
        setSeq2(savedSetup.seq2)
        setLineup1(savedSetup.lineup1 || {})
        setLineup2(savedSetup.lineup2 || {})
        setBouts(emptyBouts())
        setStep(2)
      } else {
        setBouts(emptyBouts())
        setStep(1)
      }
    } catch (err) {
      console.error('Fetch details error:', err)
      alert(`⚠️ 讀取詳細比分失敗\n${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  // ── 鎖定某局：自動存檔 + 即時更新大比分 ──────────────────────────────────
  async function handleLockBout(boutIndex: number) {
    const currentBouts = bouts
    const lockedBout = currentBouts[boutIndex]
    
    // 立即更新前端：解鎖下一局，使得大比分能即時重新渲染
    setBouts(prev => {
      const next = [...prev]
      if (boutIndex + 1 < next.length) {
        next[boutIndex + 1] = {
          ...next[boutIndex + 1],
          score1: next[boutIndex + 1].score1 === 0 ? lockedBout.score1 : next[boutIndex + 1].score1,
          score2: next[boutIndex + 1].score2 === 0 ? lockedBout.score2 : next[boutIndex + 1].score2,
        }
        
      }
      return next
    })
    
    setIsSavingLock(true)
    try {
      // 1. 存 bouts 細節到後端
      await fetch(`/api/match-detail/${matchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bouts: currentBouts }),
      })

      // 2. 即時更新後端的主比分（用這局的累積分）
      const currentSeq1 = seq1Ref.current
      if (currentSeq1) {
        const isTeam1Seq123 = currentSeq1 === '123'
        const liveScore1 = isTeam1Seq123 ? lockedBout.score1 : lockedBout.score2
        const liveScore2 = isTeam1Seq123 ? lockedBout.score2 : lockedBout.score1
        const endpoint = isPouleMatch ? `/api/poules/${pouleId}/matches` : `/api/bracket/${matchId}`
        const body = isPouleMatch
          ? { matchId, score1: liveScore1, score2: liveScore2, isTeamMatch: true }
          : { score1: liveScore1, score2: liveScore2, isTeamMatch: true }
        await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      onUpdate()
    } catch (err) {
      console.error('Lock bout error:', err)
      alert(`⚠️ 鎖定失敗\n${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsSavingLock(false)
    }
  }

  async function handleGoToStep2() {
    setStep(2)
    fetch(`/api/match-detail/${matchId}/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seq1, seq2, step: 2 }),
    })
  }

  async function handleGoToBouts() {
    const newBouts = buildBoutsFromLineup(seq1!, lineup1, lineup2)
    setBouts(newBouts)
    setStep(3)
    fetch(`/api/match-detail/${matchId}/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seq1, seq2, lineup1, lineup2, step: 3, team1SubTarget, team2SubTarget }),
    })
  }

  function handleSwapFencer(boutOrder: number, fencerKey: 'fencer1Id' | 'fencer2Id', teamKey: 'team1' | 'team2', role: string, newFencerId: string) {
    setBouts(prev => {
      const nextBouts = prev.map(b => {
        if (b.order >= boutOrder) {
          const sched = BOUT_SCHEDULE.find(s => s.round === b.order)!
          const bRole = fencerKey === 'fencer1Id' ? sched.r1 : sched.r2
          if (String(bRole) === role) return { ...b, [fencerKey]: newFencerId }
        }
        return b
      })
      const t1SubId = lineup1['sub']
      const t2SubId = lineup2['sub']
      const isT1SubUsed = nextBouts.some(b => b.fencer1Id === t1SubId || b.fencer2Id === t1SubId)
      const isT2SubUsed = nextBouts.some(b => b.fencer1Id === t2SubId || b.fencer2Id === t2SubId)
      if (!isT1SubUsed) setTeam1SubTarget(null)
      else if (teamKey === 'team1' && team1SubTarget === null) setTeam1SubTarget(role)
      if (!isT2SubUsed) setTeam2SubTarget(null)
      else if (teamKey === 'team2' && team2SubTarget === null) setTeam2SubTarget(role)
      return nextBouts
    })
  }

  function handleScoreChange(order: number, side: 'score1' | 'score2', value: string) {
    let raw = parseInt(value)
    if (isNaN(raw)) raw = 0
    const updated = bouts.map(b => b.order === order ? { ...b, [side]: raw } : b)
    // 直接更新 bouts，不需要 syncCumulative（score 就是累積分）
    setBouts(updated)
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    try {
      try {
        await fetch(`/api/match-detail/${matchId}/setup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seq1, seq2, lineup1, lineup2, step: 3, team1SubTarget, team2SubTarget }),
        })
      } catch (err) { console.warn('Setup save failed (non-critical):', err) }

      const detailRes = await fetch(`/api/match-detail/${matchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bouts }),
      })
      const detailData = await detailRes.json()
      if (!detailData.success) { alert(`⚠️ 儲存詳細比分失敗\n${detailData.error || ''}`); return }

      const last = bouts[bouts.length - 1]
      const isTeam1Seq123 = seq1 === '123'
      const finalScore1 = isTeam1Seq123 ? last.score1 : last.score2
      const finalScore2 = isTeam1Seq123 ? last.score2 : last.score1

      const endpoint = isPouleMatch ? `/api/poules/${pouleId}/matches` : `/api/bracket/${matchId}`
      const body = isPouleMatch
        ? { matchId, score1: finalScore1, score2: finalScore2, isTeamMatch: true }
        : { score1: finalScore1, score2: finalScore2, isTeamMatch: true }

      const mainRes = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!mainRes.ok) { alert(`⚠️ 更新主比分失敗 (HTTP ${mainRes.status})`); return }
      const mainData = await mainRes.json()
      if (!mainData.success) { alert(`⚠️ 更新主比分失敗\n${mainData.error || ''}`); return }

      onUpdate()
      router.back()
    } catch (err) {
      console.error('Submit error:', err)
      alert(`❌ 儲存失敗\n${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSetSeq(team: 'team1' | 'team2', seq: SeqType) {
    if (team === 'team1') setSeq1(seq); else setSeq2(seq)
  }

  function handleRandomSeq() {
    const flip = Math.random() < 0.5
    setSeq1(flip ? '123' : '456')
    setSeq2(flip ? '456' : '123')
  }

  function handleAssign(team: 'team1' | 'team2', slot: string, fencerId: string | null) {
    if (team === 'team1') setLineup1(prev => ({ ...prev, [slot]: fencerId }))
    else setLineup2(prev => ({ ...prev, [slot]: fencerId }))
  }

  const stepTitle = ['決定賽序', '決定棒次', '比賽記分'][step - 1]

  const content = (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">團體賽登記</h1>
            <p className="text-xs text-gray-600 mt-0.5">{stepTitle}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center p-12 text-gray-600">載入中...</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <StepIndicator step={step} />

            {step === 1 && team1 && team2 && (
              <Step1SeqSelection
                team1={team1} team2={team2}
                seq1={seq1} seq2={seq2}
                onSetSeq={handleSetSeq} onRandom={handleRandomSeq} onNext={handleGoToStep2}
              />
            )}

            {step === 2 && team1 && team2 && seq1 && seq2 && (
              <Step2Lineup
                team1={team1} team2={team2}
                seq1={seq1} seq2={seq2}
                lineup1={lineup1} lineup2={lineup2}
                onAssign={handleAssign} onNext={handleGoToBouts}
              />
            )}

            {step === 3 && team1 && team2 && seq1 && seq2 && (
              <Step3Scoreboard
                team1={team1} team2={team2}
                seq1={seq1} lineup1={lineup1} lineup2={lineup2}
                team1SubTarget={team1SubTarget} team2SubTarget={team2SubTarget}
                bouts={bouts} sideSwapped={sideSwapped}
                isSubmitting={isSubmitting} isSavingLock={isSavingLock}
                categoryId={categoryId}
                onScoreChange={handleScoreChange}
                onLockBout={handleLockBout}
                onSwapFencer={handleSwapFencer}
                onSwapSides={() => setSideSwapped(p => !p)}
                onSubmit={handleSubmit}
                onClose={onClose}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )

  return content
}
