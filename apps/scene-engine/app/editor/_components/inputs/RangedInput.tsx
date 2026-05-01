'use client'

import { useEffect, useRef, useCallback } from 'react'

interface Props {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}

export function RangedInput({ value, min, max, step, onChange }: Props) {
  const syncing = useRef(false)
  const rangeRef = useRef<HTMLInputElement>(null)
  const numRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const next = String(Math.max(min, Math.min(max, value)))
    if (rangeRef.current) rangeRef.current.value = next
    if (numRef.current) numRef.current.value = next
  }, [max, min, value])

  const commit = useCallback(
    (n: number) => {
      if (!Number.isFinite(n)) return
      onChange(Math.max(min, Math.min(max, n)))
    },
    [max, min, onChange],
  )

  const debouncedCommit = useCallback(
    (n: number) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => commit(n), 80)
    },
    [commit],
  )

  function handleRange(e: React.ChangeEvent<HTMLInputElement>) {
    if (syncing.current) return
    syncing.current = true
    const n = Number(e.target.value)
    if (numRef.current) numRef.current.value = String(n)
    syncing.current = false
    commit(n)
  }

  function handleNum(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value === '') return
    const n = Math.max(min, Math.min(max, Number(e.target.value)))
    if (!Number.isFinite(n)) return
    e.target.value = String(n)
    if (!syncing.current) {
      syncing.current = true
      if (rangeRef.current) rangeRef.current.value = String(n)
      syncing.current = false
    }
    debouncedCommit(n)
  }

  return (
    <span className="flex w-full gap-1 items-center">
      <input
        ref={rangeRef}
        type="range"
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        onChange={handleRange}
        className="flex-1 min-w-0 h-3.5 accent-[#2a6da3] appearance-none bg-transparent
          [&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:bg-[#383838] [&::-webkit-slider-runnable-track]:rounded-full
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#999] [&::-webkit-slider-thumb]:border-none [&::-webkit-slider-thumb]:-mt-[3.5px] [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:hover:bg-[#bbb]"
      />
      <input
        ref={numRef}
        type="number"
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        onChange={handleNum}
        className="w-13 shrink-0 bg-[#222] border border-[#333] text-gray-300 text-[12px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none"
      />
    </span>
  )
}
