import { ReactNode } from 'react';

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
}

export default function MagneticButton({ 
  children, 
  className = '',
}: MagneticButtonProps) {
  return (
    <div className={`transition-transform duration-200 hover:-translate-y-0.5 ${className}`}>
      {children}
    </div>
  );
}
