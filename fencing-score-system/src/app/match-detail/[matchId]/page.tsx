'use client'

import { useEffect, useState, use } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Fencer {
  id: string
  name: string
}

interface Team {
  id: string
  name: string
  members: Fencer[]
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

interface TeamMatchDetail {
  id: string
  bouts: Bout[]
  team1SeqType?: string
  team2SeqType?: string
}

interface PageProps {
  params: Promise<{ matchId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default function MatchDetailViewPage({ params, searchParams }: PageProps) {
  const { matchId } = use(params)
  const query = use(searchParams) as Record<string, string | string[] | undefined>
  const isPouleMatch = (query.isPouleMatch as string) === 'true'

  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<TeamMatchDetail | null>(null)
  const [team1, setTeam1] = useState<Team | null>(null)
  const [team2, setTeam2] = useState<Team | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMatchDetail()
  }, [matchId, isPouleMatch])

  const fetchMatchDetail = async () => {
    try {
      setLoading(true)
      const url = `/api/match-detail/${matchId}?isPouleMatch=${isPouleMatch}`
      const res = await fetch(url)
      const data = await res.json()

      if (data.success) {
        setDetail(data.data.detail)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-700 mx-auto" />
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    )
  }

  if (error || !detail || !team1 || !team2) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-medium text-gray-900">{error || '找不到該比賽'}</h3>
              <Link href="/" className="text-red-700 hover:underline mt-2 inline-block">返回首頁</Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const allMembers = [...team1.members, ...team2.members]
  function fencerName(id: string) {
    return allMembers.find(m => m.id === id)?.name ?? '未知選手'
  }

  // 計算隊伍總分
  const totalScore1 = detail.bouts.reduce((sum, bout) => sum + bout.score1, 0)
  const totalScore2 = detail.bouts.reduce((sum, bout) => sum + bout.score2, 0)
  const isTeam1Win = totalScore1 > totalScore2

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </Link>

        {/* 賽事標題和隊伍概況 */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-500 mb-2">{isPouleMatch ? '分組賽' : '淘汰賽'}</p>
                <div className="flex items-center gap-8">
                  {/* 隊伍1 */}
                  <div>
                    <h2 className={`text-2xl font-bold ${isTeam1Win ? 'text-green-600' : 'text-gray-600'}`}>
                      {team1.name}
                    </h2>
                    <p className={`text-3xl font-bold mt-2 ${isTeam1Win ? 'text-green-600' : 'text-gray-400'}`}>
                      {totalScore1}
                    </p>
                  </div>

                  {/* VS */}
                  <div className="text-center">
                    <p className="text-gray-400 font-medium">VS</p>
                  </div>

                  {/* 隊伍2 */}
                  <div className="text-right">
                    <h2 className={`text-2xl font-bold ${!isTeam1Win ? 'text-green-600' : 'text-gray-600'}`}>
                      {team2.name}
                    </h2>
                    <p className={`text-3xl font-bold mt-2 ${!isTeam1Win ? 'text-green-600' : 'text-gray-400'}`}>
                      {totalScore2}
                    </p>
                  </div>
                </div>
                {totalScore1 !== totalScore2 && (
                  <p className="mt-4 text-sm text-gray-600">
                    <span className="font-semibold">獲勝隊伍：</span>
                    {isTeam1Win ? team1.name : team2.name}
                    <span className="ml-2">得分優勢：{Math.abs(totalScore1 - totalScore2)} 分</span>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 隊伍成員資訊 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {[
            { team: team1, key: 'team1', side: 'left' },
            { team: team2, key: 'team2', side: 'right' },
          ].map(({ team, key, side }) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle>{team.name} - 隊員名單</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {team.members.map((member, idx) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                          {idx + 1}
                        </div>
                        <span className="text-gray-900 font-medium">{member.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 比賽記錄表 */}
        <Card>
          <CardHeader>
            <CardTitle>比賽記錄</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300">
                    <th className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">局</th>
                    <th className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      {team1.name}
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      選手
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      得分
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      累計
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      對手
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      {team2.name}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.bouts.map((bout, idx) => (
                    <tr key={idx} className={bout.score1 > bout.score2 ? 'bg-green-50' : bout.score2 > bout.score1 ? 'bg-red-50' : ''}>
                      <td className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-900">
                        {bout.order}
                      </td>

                      {/* 隊伍1 */}
                      <td className="border border-gray-300 px-4 py-3 text-center text-sm text-gray-600">
                        {bout.fencer1Id ? (
                          <span className="font-medium">{fencerName(bout.fencer1Id)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="border border-gray-300 px-4 py-3 text-center text-sm">
                        <span className="text-gray-400 text-xs">vs</span>
                      </td>

                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <span className={`font-bold text-lg ${bout.score1 > bout.score2 ? 'text-green-600' : ''}`}>
                            {bout.score1}
                          </span>
                          <span className="text-gray-400">:</span>
                          <span className={`font-bold text-lg ${bout.score2 > bout.score1 ? 'text-green-600' : ''}`}>
                            {bout.score2}
                          </span>
                        </div>
                      </td>

                      <td className="border border-gray-300 px-4 py-3 text-center text-sm">
                        <div className="flex justify-center gap-2">
                          <span className="font-semibold text-gray-700">{bout.cumScore1}</span>
                          <span className="text-gray-400">-</span>
                          <span className="font-semibold text-gray-700">{bout.cumScore2}</span>
                        </div>
                      </td>

                      <td className="border border-gray-300 px-4 py-3 text-center text-sm">
                        <span className="text-gray-400 text-xs">vs</span>
                      </td>

                      {/* 隊伍2 */}
                      <td className="border border-gray-300 px-4 py-3 text-center text-sm text-gray-600">
                        {bout.fencer2Id ? (
                          <span className="font-medium">{fencerName(bout.fencer2Id)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* 總分列 */}
                <tfoot>
                  <tr className="bg-gray-100 border-t-2 border-gray-400 font-bold">
                    <td colSpan={2} className="border border-gray-300 px-4 py-3 text-right text-gray-900">
                      總計
                    </td>
                    <td colSpan={2} className="border border-gray-300 px-4 py-3 text-center text-lg text-gray-900">
                      {totalScore1}
                    </td>
                    <td className="border border-gray-300 px-4 py-3"></td>
                    <td colSpan={2} className="border border-gray-300 px-4 py-3 text-center text-lg text-gray-900">
                      {totalScore2}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 底部資訊 */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>這是比賽結果的公開展示頁面</p>
          {isPouleMatch && <p>分組賽 • 只讀展示</p>}
          {!isPouleMatch && <p>淘汰賽 • 只讀展示</p>}
        </div>
      </main>
    </div>
  )
}
