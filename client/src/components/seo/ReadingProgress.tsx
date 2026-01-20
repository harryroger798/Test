import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface ReadingProgressProps {
  className?: string
}

export function ReadingProgress({ className = '' }: ReadingProgressProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const updateProgress = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrollProgress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0
      setProgress(Math.min(100, Math.max(0, scrollProgress)))
    }

    window.addEventListener('scroll', updateProgress, { passive: true })
    updateProgress()

    return () => window.removeEventListener('scroll', updateProgress)
  }, [])

  return (
    <div className={`fixed top-0 left-0 right-0 z-[60] h-1 bg-slate-200 dark:bg-slate-800 ${className}`}>
      <motion.div
        className="h-full bg-gradient-to-r from-primary via-purple-500 to-pink-500"
        style={{ width: `${progress}%` }}
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.1 }}
      />
    </div>
  )
}
