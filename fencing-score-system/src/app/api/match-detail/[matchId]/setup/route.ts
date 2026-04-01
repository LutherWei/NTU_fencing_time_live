import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ matchId: string }>
}

interface SetupData {
  seq1?: string | null
  seq2?: string | null
  lineup1?: Record<string, string | null>
  lineup2?: Record<string, string | null>
  step?: number
  team1SubTarget?: string | null
  team2SubTarget?: string | null
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { matchId } = await params
    const setupPayload: SetupData = await request.json()

    // 檢查是分組賽還是淘汰賽
    const pouleMatch = await prisma.pouleMatch.findUnique({ where: { id: matchId } })
    const eliminationMatch = await prisma.eliminationMatch.findUnique({ where: { id: matchId } })

    if (!pouleMatch && !eliminationMatch) {
      return NextResponse.json(
        { success: false, error: '找不到該比賽' },
        { status: 404 }
      )
    }

    // 確保 TeamMatchDetail 存在
    let detail = await prisma.teamMatchDetail.findFirst({
      where: {
        OR: [
          { pouleMatchId: matchId },
          { eliminationMatchId: matchId }
        ]
      }
    })

    if (!detail) {
      detail = await prisma.teamMatchDetail.create({
        data: {
          pouleMatchId: pouleMatch ? matchId : undefined,
          eliminationMatchId: eliminationMatch ? matchId : undefined,
          setupData: JSON.stringify(setupPayload)
        } as any
      })
    } else {
      // 更新現有的 setup 數據
      detail = await prisma.teamMatchDetail.update({
        where: { id: detail.id },
        data: {
          setupData: JSON.stringify(setupPayload)
        } as any
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Setup 已保存',
        setup: setupPayload
      }
    })
  } catch (error) {
    console.error('Post match setup error:', error)
    return NextResponse.json(
      { success: false, error: '無法保存設置' },
      { status: 500 }
    )
  }
}
