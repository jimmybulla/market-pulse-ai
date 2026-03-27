'use client'

import { Separator } from '@/components/ui/separator'
import type { SignalResponse } from '@/lib/types'

interface SignalExpandedProps {
  signal: SignalResponse
}

export default function SignalExpanded({ signal }: SignalExpandedProps) {
  const { drivers, risk_flags, evidence, historical_analog } = signal

  return (
    <div className="space-y-5">
      {/* Key Drivers */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Key Drivers
        </h3>
        <ul className="space-y-1.5">
          {drivers.map((driver, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
              <span className="text-brand-cyan mt-0.5">•</span>
              {driver}
            </li>
          ))}
        </ul>
      </div>

      {/* Risk Flags */}
      {risk_flags.length > 0 && (
        <>
          <Separator className="bg-white/8" />
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Risk Flags
            </h3>
            <ul className="space-y-1.5">
              {risk_flags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-warning">
                  <span className="mt-0.5">⚠</span>
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <Separator className="bg-white/8" />

      {/* Evidence */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Evidence
        </h3>
        <div className="space-y-1 text-sm text-gray-300">
          <p>{evidence.article_count} articles</p>
          <p>{Math.round(evidence.avg_credibility * 100)}% avg credibility</p>
          <p className="text-xs text-gray-500">
            Sources: {evidence.sources.join(', ')}
          </p>
        </div>
      </div>

      <Separator className="bg-white/8" />

      {/* Historical Analog */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Historical Analog
        </h3>
        <div className="space-y-1 text-sm text-gray-300">
          <p>+{(historical_analog.avg_move * 100).toFixed(1)}% avg move</p>
          <p>{Math.round(historical_analog.hit_rate * 100)}% hit rate</p>
          <p className="text-xs text-gray-500">
            {historical_analog.sample_size} historical samples
          </p>
        </div>
      </div>
    </div>
  )
}
