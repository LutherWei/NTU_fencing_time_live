'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { User, LogOut } from 'lucide-react'

export function Navbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  const isLoggedIn = status === 'authenticated'
  const username = session?.user?.name ?? ''

  const handleLogout = async () => {
    await signOut({ redirectTo: '/' })
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.png" alt="Logo" className="h-8 w-8 object-contain" />
              <span className="text-xl font-bold text-gray-900">
                台大擊劍隊計分系統
              </span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {isLoggedIn ? (
              <>
                <Link
                  href="/admin/dashboard"
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname.startsWith('/admin')
                      ? "bg-red-100 text-red-800"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  )}
                >
                  管理後台
                </Link>
                <div className="flex items-center space-x-2 text-gray-600">
                  <User className="h-4 w-4" />
                  <span className="text-sm">{username}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>登出</span>
                </button>
              </>
            ) : (
              <Link
                href="/admin/login"
                className="px-4 py-2 rounded-md text-sm font-medium bg-red-700 text-white hover:bg-red-800 transition-colors"
              >
                管理員登入
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
