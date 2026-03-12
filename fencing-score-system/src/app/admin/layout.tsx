'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Navbar } from '@/components/layout/Navbar'
import { 
  LayoutDashboard, 
  Users, 
  Grid3X3, 
  Trophy,
  ChevronRight
} from 'lucide-react'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (data.success) {
        setIsAuthenticated(true)
      } else {
        // 如果未登入且不在登入頁面，重導向到登入頁
        if (!pathname.includes('/admin/login')) {
          router.push('/admin/login')
        }
      }
    } catch {
      if (!pathname.includes('/admin/login')) {
        router.push('/admin/login')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // 登入頁面不使用側邊欄佈局
  if (pathname === '/admin/login') {
    return children
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  const navItems = [
    { href: '/admin/dashboard', label: '總覽', icon: LayoutDashboard },
    { href: '/admin/check-in', label: '選手檢錄', icon: Users },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="flex">
        {/* 側邊欄 */}
        <aside className="w-64 min-h-[calc(100vh-64px)] bg-white border-r border-gray-200 hidden md:block">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {item.label}
                  {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
                </Link>
              )
            })}

            <div className="pt-4 mt-4 border-t border-gray-200">
              <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                比賽管理
              </p>
              <Link
                href="/admin/check-in"
                className={cn(
                  "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname.includes('/poules') || pathname.includes('/bracket')
                    ? "text-gray-700"
                    : "text-gray-500"
                )}
              >
                <Grid3X3 className="h-5 w-5 mr-3" />
                分組賽管理
              </Link>
              <Link
                href="/admin/check-in"
                className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-500 transition-colors"
              >
                <Trophy className="h-5 w-5 mr-3" />
                淘汰賽管理
              </Link>
            </div>
          </nav>
        </aside>

        {/* 主內容區 */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
