'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { BarChart3, TrendingUp, Newspaper, LayoutDashboard, FlaskConical } from 'lucide-react'

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/signals', label: 'Signals', icon: TrendingUp },
  { href: '/stocks', label: 'Stocks', icon: BarChart3 },
  { href: '/news', label: 'News', icon: Newspaper },
  { href: '/backtesting', label: 'Backtesting', icon: FlaskConical },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-16 lg:w-56 h-screen bg-surface-card border-r border-white/8 fixed left-0 top-0 z-50">
      {/* Logo */}
      <div className="flex items-center justify-center lg:justify-start bg-gray-300 border-b border-white/8 h-14 px-3">
        <Image
          src="/images/marketpulseai_logo.png"
          alt="MarketPulse AI"
          width={130}
          height={34}
          className="hidden lg:block object-contain"
          priority
        />
        <Image
          src="/images/marketpulseai_logo.png"
          alt="MarketPulse AI"
          width={28}
          height={28}
          className="block lg:hidden object-contain"
          priority
        />
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                ${active
                  ? 'bg-brand-cyan/10 text-brand-cyan'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface-elevated'
                }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="hidden lg:block">{label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
