import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown, ChevronUp, List } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface TOCItem {
  id: string
  text: string
  level: number
  index: number
}

interface TableOfContentsProps {
  content: string
  className?: string
  contentSelector?: string
}

export function TableOfContents({ content, className = '', contentSelector = 'article' }: TableOfContentsProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [activeId, setActiveId] = useState<string>('')
  const [items, setItems] = useState<TOCItem[]>([])
  const hasAssignedIds = useRef(false)

  const assignHeadingIds = useCallback(() => {
    const container = document.querySelector(contentSelector)
    if (!container) return []

    const headingElements = Array.from(container.querySelectorAll('h1, h2, h3'))
    
    headingElements.forEach((heading, index) => {
      if (!heading.id) {
        heading.id = `toc-heading-${index}`
      }
    })
    
    return headingElements
  }, [contentSelector])

  useEffect(() => {
    const initializeTOC = () => {
      const container = document.querySelector(contentSelector)
      if (!container) {
        setItems([])
        return
      }

      const headings: TOCItem[] = []
      const headingElements = assignHeadingIds()

      headingElements.forEach((heading, index) => {
        const level = parseInt(heading.tagName.charAt(1))
        const text = heading.textContent?.trim() || ''
        if (!text) return

        headings.push({ id: heading.id, text, level, index })
      })

      setItems(headings)
      hasAssignedIds.current = true
    }

    // Use requestAnimationFrame to ensure DOM is ready after dangerouslySetInnerHTML
    const rafId = requestAnimationFrame(() => {
      // Add a small delay to ensure React has finished rendering
      setTimeout(initializeTOC, 100)
    })

    return () => cancelAnimationFrame(rafId)
  }, [content, contentSelector, assignHeadingIds])

  useEffect(() => {
    if (items.length === 0) return

    // Re-assign IDs before setting up observer (in case they were lost)
    assignHeadingIds()

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: '-20% 0% -35% 0%' }
    )

    items.forEach((item) => {
      const element = document.getElementById(item.id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => observer.disconnect()
  }, [items, assignHeadingIds])

  const handleClick = useCallback((item: TOCItem) => {
    // First, try to find by ID
    let element = document.getElementById(item.id)
    
    // If not found, re-assign IDs and try again
    if (!element) {
      assignHeadingIds()
      element = document.getElementById(item.id)
    }
    
    // If still not found, find by index in the heading list
    if (!element) {
      const container = document.querySelector(contentSelector)
      if (container) {
        const headings = container.querySelectorAll('h1, h2, h3')
        if (headings[item.index]) {
          element = headings[item.index] as HTMLElement
          // Assign the ID for future use
          element.id = item.id
        }
      }
    }
    
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveId(item.id)
    }
  }, [assignHeadingIds, contentSelector])

  if (items.length < 3) {
    return null
  }

  return (
    <div className={`bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <List className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Table of Contents</span>
          <span className="text-sm text-muted-foreground">({items.length} sections)</span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ul className="px-4 pb-4 space-y-1">
              {items.map((item) => (
                <li
                  key={item.id}
                  style={{ paddingLeft: `${(item.level - 1) * 16}px` }}
                >
                  <button
                    onClick={() => handleClick(item)}
                    className={`w-full text-left py-1.5 px-3 rounded-lg text-sm transition-colors ${
                      activeId === item.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {item.text}
                  </button>
                </li>
              ))}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  )
}
