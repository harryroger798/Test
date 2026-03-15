import React from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  message?: string
  className?: string
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-3',
  lg: 'h-12 w-12 border-4'
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  message,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full border-gray-600 border-t-blue-500 animate-spin`}
      />
      {message && <p className="text-sm text-gray-400">{message}</p>}
    </div>
  )
}

interface LoadingOverlayProps {
  visible: boolean
  message?: string
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ visible, message }) => {
  if (!visible) return null
  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 rounded-lg">
      <LoadingSpinner size="lg" message={message} />
    </div>
  )
}
