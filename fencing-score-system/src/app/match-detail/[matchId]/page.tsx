'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Card, CardContent } from '@/components/ui/Card'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

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

interface Lineup {
  [slot: string]: string | null
}

interface Setup {
  seq1?: string | null
  seq2?: string | null
  lineup1?: Lineup
  lineup2?: Lineup
  team1SubTarget?: string | null
  team2SubTarget?: string | null
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

interface PageProps {
  params: Promise<{ matchId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// ─── 正式賽程（同 TeamMatchDetailModal） ────────────────────────────────────

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

/** 從 lineup 找到某個 fencerId 對應的棒次號碼，找不到回傳 null */
function slotOfFencer(fencerId: string, lineup: Lineup): string | null {
  for (const [slot, id] of Object.entries(lineup)) {
    if (id === fencerId) return slot
  }
  return null
}

/**
 * 根據 seq1 / lineup1 / lineup2 推算某個 fencerId 的棒次號碼（1~6）。
 * 如果是候補上場，顯示原本棒次號碼 + 「(補)」標記。
 */
function resolveSlotLabel(
  fencerId: string,
  seq1: string,
  lineup1: Lineup,
  lineup2: Lineup,
): { slot: string; isSub: boolean } {
  // 先在 lineup1 找
  const inL1 = slotOfFencer(fencerId, lineup1)
  if (inL1) {
    return { slot: inL1 === 'sub' ? '補' : inL1, isSub: inL1 === 'sub' }
  }
  // 再在 lineup2 找
  const inL2 = slotOfFencer(fencerId, lineup2)
  if (inL2) {
    return { slot: inL2 === 'sub' ? '補' : inL2, isSub: inL2 === 'sub' }
  }
  return { slot: '?', isSub: false }
}

/** 本局刺點 = 本局累積 - 上一局累積 */
function boutTs(bouts: Bout[], i: number, side: 'score1' | 'score2'): number {
  return Math.max(bouts[i][side] - (i > 0 ? bouts[i - 1][side] : 0), 0)
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MatchDetailViewPage({ params, searchParams }: PageProps) {
  const router = useRouter()
  const { matchId } = use(params)
  const query = use(searchParams) as Record<string, string | string[] | undefined>
  const isPouleMatch = (query.isPouleMatch as string) === 'true'

  const [loading, setLoading] = useState(true)
  const [bouts, setBouts] = useState<Bout[]>([])
  const [setup, setSetup] = useState<Setup | null>(null)
  const [team1, setTeam1] = useState<Team | null>(null)
  const [team2, setTeam2] = useState<Team | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMatchDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, isPouleMatch])

  async function fetchMatchDetail() {
    try {
      setLoading(true)
      const res = await fetch(`/api/match-detail/${matchId}?isPouleMatch=${isPouleMatch}`)
      const data = await res.json()
      if (data.success) {
        setBouts(data.data.detail?.bouts ?? [])
        setSetup(data.data.setup ?? null)
        setTeam1(data.data.team1)
        setTeam2(data.data.team2)
      } else {
        setError(data.error || '無法載入比賽詳情')
      }
    } catch (err) {
      console.error('Fetch match detail error:', err)
      setError('載入比賽詳情失敗')
    } finally {
      setLoading(false)
    }
  }

  // ── Loading / Error ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-700" />
        </div>
      </div>
    )
  }

  if (error || !team1 || !team2) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-medium text-gray-900">{error || '找不到該比賽'}</h3>
              <button onClick={() => router.back()} className="text-red-700 hover:underline mt-2 inline-block cursor-pointer">返回上一頁</button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── 推算顯示資訊 ────────────────────────────────────────────────────────────

  const allMembers = [...team1.members, ...team2.members]
  function fencerName(id: string) {
    return allMembers.find(m => m.id === id)?.name ?? id
  }

  const seq1 = (setup?.seq1 ?? '123') as string
  const lineup1: Lineup = setup?.lineup1 ?? {}
  const lineup2: Lineup = setup?.lineup2 ?? {}

  // seq1 = '123' → team1 持 1/2/3 號（r1），team2 持 4/5/6 號（r2）
  // seq1 = '456' → team2 持 1/2/3 號（r1），team1 持 4/5/6 號（r2）
  // r1 固定是 123 側，r2 固定是 456 側
  const r1Team = seq1 === '123' ? team1 : team2
  const r2Team = seq1 === '123' ? team2 : team1
  const r1TeamName = r1Team.name
  const r2TeamName = r2Team.name

  // 最後有分數的局作為「現在大比分」（比賽可能還沒打完）
  const lastScoredBout = [...bouts].reverse().find(b => b.score1 !== 0 || b.score2 !== 0)
  const totalScore1 = lastScoredBout?.score1 ?? 0   // r1 側
  const totalScore2 = lastScoredBout?.score2 ?? 0   // r2 側

  function renderRosterCard(team: Team, slots: number[], lineup: Lineup) {
    const subId = lineup['sub']
    const subName = subId ? fencerName(subId) : null
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-gray-900">{team.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
            ${slots[0] <= 3 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
            {slots[0] <= 3 ? '123' : '456'}
          </span>
        </div>
        <div className="space-y-1.5">
          {slots.map(n => {
            const fid = lineup[String(n)]
            return (
              <div key={n} className="flex items-center gap-2 py-1.5 px-3 bg-gray-50 rounded-md">
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-700 shrink-0">
                  {n}
                </div>
                <span className="text-sm text-gray-800">
                  {fid ? fencerName(fid) : <span className="text-gray-400">（未指定）</span>}
                </span>
              </div>
            )
          })}
          {/* 候補 */}
          <div className="flex items-center gap-2 py-1.5 px-3 bg-gray-50 rounded-md border border-dashed border-gray-200">
            <div className="w-6 h-6 rounded-full bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-400 shrink-0">
              補
            </div>
            <span className="text-sm text-gray-500">
              {subName ?? <span className="text-gray-300">（無候補）</span>}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <button onClick={() => router.back()} className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 cursor-pointer">
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </button>

        {/* ── 大比分 ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <p className="text-xs text-gray-400 mb-4 text-center">
            {isPouleMatch ? '分組賽' : '淘汰賽'} 
          </p>
          <div className="flex items-center justify-center gap-10">
            <div className="text-center">
              <div className={`text-sm font-medium mb-1 ${totalScore1 > totalScore2 ? 'text-green-600' : 'text-gray-600'}`}>
                {r1TeamName}
              </div>
              <div className={`text-5xl font-bold ${totalScore1 > totalScore2 ? 'text-green-600' : 'text-gray-400'}`}>
                {totalScore1}
              </div>
            </div>
            <div className="text-2xl text-gray-300 font-light">vs</div>
            <div className="text-center">
              <div className={`text-sm font-medium mb-1 ${totalScore2 > totalScore1 ? 'text-green-600' : 'text-gray-600'}`}>
                {r2TeamName}
              </div>
              <div className={`text-5xl font-bold ${totalScore2 > totalScore1 ? 'text-green-600' : 'text-gray-400'}`}>
                {totalScore2}
              </div>
            </div>
          </div>          
        </div>

        {/* ── 棒次名單 ── */}
        {setup?.lineup1 && setup?.lineup2 && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              {renderRosterCard(
                r1Team,
                [1, 2, 3],
                lineup1,
              )}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              {renderRosterCard(
                r2Team,
                [4, 5, 6],
                lineup2,
              )}
            </div>
          </div>
        )}

        {/* ── 記分表 ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">比賽記錄</h2>
          {bouts.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">尚無比賽記錄</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 font-semibold">
                    <th className="p-2 border border-gray-100 text-center w-8">#</th>
                    <th className="p-2 border border-gray-100 text-center">{r1TeamName}（選手）</th>
                    <th className="p-2 border border-gray-100 text-center w-8">號</th>
                    <th className="p-2 border border-gray-100 text-center w-10">TS</th>
                    <th className="p-2 border border-gray-100 text-center w-28">累積刺點</th>
                    <th className="p-2 border border-gray-100 text-center w-10">TS</th>
                    <th className="p-2 border border-gray-100 text-center w-8">號</th>
                    <th className="p-2 border border-gray-100 text-center">{r2TeamName}（選手）</th>
                  </tr>
                </thead>
                <tbody>
                  {BOUT_SCHEDULE.map((sched, i) => {
                    const bout = bouts[i]
                    // 比賽還沒打到這局
                    if (!bout || (bout.score1 === 0 && bout.score2 === 0 && i > 0)) {
                      // 第一局全 0 也可能正常，只有 i>0 才判斷跳過
                      const hasAnyScore = bouts.some(b => b.score1 !== 0 || b.score2 !== 0)
                      if (hasAnyScore && bout.score1 === 0 && bout.score2 === 0) {
                        return (
                          <tr key={sched.round} className="opacity-30">
                            <td className="p-2 border border-gray-100 text-center text-gray-400">{sched.round}</td>
                            <td colSpan={7} className="p-2 border border-gray-100 text-center text-gray-300 text-xs">
                              尚未進行
                            </td>
                          </tr>
                        )
                      }
                    }

                    if (!bout) return null

                    const lTs = boutTs(bouts, i, 'score1')
                    const rTs = boutTs(bouts, i, 'score2')

                    // 棒次號碼標籤
                    const r1SlotInfo = setup?.lineup1
                      ? resolveSlotLabel(bout.fencer1Id, seq1, lineup1, lineup2)
                      : { slot: String(sched.r1), isSub: false }
                    const r2SlotInfo = setup?.lineup2
                      ? resolveSlotLabel(bout.fencer2Id, seq1, lineup1, lineup2)
                      : { slot: String(sched.r2), isSub: false }

                    const r1Won = bout.score1 > bout.score2
                    const r2Won = bout.score2 > bout.score1

                    return (
                      <tr
                        key={sched.round}
                        className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                      >
                        {/* 局次 */}
                        <td className="p-2 border border-gray-100 text-center text-gray-400 text-xs">
                          {sched.round}
                        </td>

                        {/* r1 選手名 */}
                        <td className="p-2 border border-gray-100 text-center">
                          <span className={`font-medium ${r1Won ? 'text-green-700' : 'text-gray-700'}`}>
                            {fencerName(bout.fencer1Id)}
                          </span>
                          {r1SlotInfo.isSub && (
                            <span className="ml-1 text-[10px] bg-orange-100 text-orange-700 px-1 rounded">候補</span>
                          )}
                        </td>

                        {/* r1 棒次號碼 */}
                        <td className="p-2 border border-gray-100 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                            {r1SlotInfo.slot}
                          </span>
                        </td>

                        {/* r1 TS */}
                        <td className="p-2 border border-gray-100 text-center">
                          <span className={`inline-block min-w-[22px] px-1 py-0.5 rounded text-xs font-medium
                            ${lTs > rTs ? 'bg-green-100 text-green-700'
                              : lTs < rTs ? 'bg-red-100 text-red-600'
                              : 'bg-gray-100 text-gray-500'}`}>
                            {lTs}
                          </span>
                        </td>

                        {/* 累積刺點 */}
                        <td className="p-2 border border-gray-100 text-center">
                          <span className={`font-semibold ${r1Won ? 'text-green-700' : 'text-gray-600'}`}>
                            {bout.score1}
                          </span>
                          <span className="text-gray-300 mx-1">—</span>
                          <span className={`font-semibold ${r2Won ? 'text-green-700' : 'text-gray-600'}`}>
                            {bout.score2}
                          </span>
                        </td>

                        {/* r2 TS */}
                        <td className="p-2 border border-gray-100 text-center">
                          <span className={`inline-block min-w-[22px] px-1 py-0.5 rounded text-xs font-medium
                            ${rTs > lTs ? 'bg-green-100 text-green-700'
                              : rTs < lTs ? 'bg-red-100 text-red-600'
                              : 'bg-gray-100 text-gray-500'}`}>
                            {rTs}
                          </span>
                        </td>

                        {/* r2 棒次號碼 */}
                        <td className="p-2 border border-gray-100 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-50 text-orange-700 text-xs font-semibold">
                            {r2SlotInfo.slot}
                          </span>
                        </td>

                        {/* r2 選手名 */}
                        <td className="p-2 border border-gray-100 text-center">
                          <span className={`font-medium ${r2Won ? 'text-green-700' : 'text-gray-700'}`}>
                            {fencerName(bout.fencer2Id)}
                          </span>
                          {r2SlotInfo.isSub && (
                            <span className="ml-1 text-[10px] bg-orange-100 text-orange-700 px-1 rounded">候補</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* 總分 */}
                <tfoot>
                  <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                    <td colSpan={4} className="p-2 border border-gray-200 text-right text-xs text-gray-500 pr-3">
                      最終累積
                    </td>
                    <td className="p-2 border border-gray-200 text-center text-base">
                      <span className={totalScore1 > totalScore2 ? 'text-green-700' : 'text-gray-700'}>
                        {totalScore1}
                      </span>
                      <span className="text-gray-300 mx-1">—</span>
                      <span className={totalScore2 > totalScore1 ? 'text-green-700' : 'text-gray-700'}>
                        {totalScore2}
                      </span>
                    </td>
                    <td colSpan={3} className="p-2 border border-gray-200" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
