'use client';
import React, { useState, useRef, useLayoutEffect, cloneElement } from 'react';
import { cn } from '@/lib/utils';

// --- Types internes ---

type NavItem = {
  id: string | number;
  icon: React.ReactElement<{ className?: string }>;
  label?: string;
  href?: string;
  onClick?: () => void;
};

type LimelightNavProps = {
  items: NavItem[];
  defaultActiveIndex?: number;
  onTabChange?: (index: number) => void;
  className?: string;
  limelightClassName?: string;
  iconContainerClassName?: string;
  iconClassName?: string;
};

/**
 * Navigation bar avec effet "limelight" (projecteur doré) qui suit l'élément actif.
 * Adapté pour Academia Helm : le limelight utilise la couleur Gold (#f5b335).
 * 
 * L'effet se compose de :
 * - Un trait lumineux horizontal doré au-dessus de l'item actif
 * - Un cône de lumière descendant en dégradé
 * - Un halo étendu via box-shadow
 * - Les icônes inactives sont en opacité réduite (40%)
 */
export const LimelightNav = ({
  items,
  defaultActiveIndex = 0,
  onTabChange,
  className,
  limelightClassName,
  iconContainerClassName,
  iconClassName,
}: LimelightNavProps) => {
  const [activeIndex, setActiveIndex] = useState(defaultActiveIndex);
  const [isReady, setIsReady] = useState(false);
  const navItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const limelightRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (items.length === 0) return;

    const limelight = limelightRef.current;
    const activeItem = navItemRefs.current[activeIndex];
    
    if (limelight && activeItem) {
      const newLeft = activeItem.offsetLeft + activeItem.offsetWidth / 2 - limelight.offsetWidth / 2;
      limelight.style.left = `${newLeft}px`;

      if (!isReady) {
        setTimeout(() => setIsReady(true), 50);
      }
    }
  }, [activeIndex, isReady, items]);

  if (items.length === 0) {
    return null;
  }

  const handleItemClick = (index: number, itemOnClick?: () => void) => {
    setActiveIndex(index);
    onTabChange?.(index);
    itemOnClick?.();
  };

  return (
    <nav
      className={cn(
        'relative inline-flex items-center h-14 rounded-lg px-2',
        // Fond Navy avec bordure subtile
        'bg-[#0b2f73] border border-[#144798]',
        className,
      )}
    >
      {items.map(({ id, icon, label, onClick }, index) => (
        <a
          key={id}
          ref={(el) => { navItemRefs.current[index] = el; }}
          className={cn(
            'relative z-20 flex h-full cursor-pointer items-center justify-center p-4',
            'transition-colors duration-200',
            iconContainerClassName,
          )}
          onClick={() => handleItemClick(index, onClick)}
          aria-label={label}
          title={label}
        >
          {cloneElement(icon, {
            className: cn(
              'w-5 h-5 transition-opacity duration-100 ease-in-out',
              activeIndex === index ? 'opacity-100' : 'opacity-40',
              icon.props.className || '',
              iconClassName || '',
            ),
          })}
        </a>
      ))}

      {/* Limelight — trait lumineux doré + cône de lumière */}
      <div
        ref={limelightRef}
        className={cn(
          'absolute top-0 z-10 w-11 h-[5px] rounded-full',
          // Couleur Gold Academia Helm
          'bg-[#f5b335]',
          // Halo étendu doré
          'shadow-[0_50px_15px_rgba(245,179,53,0.4)]',
          isReady ? 'transition-[left] duration-400 ease-in-out' : '',
          limelightClassName,
        )}
        style={{ left: '-999px' }}
      >
        {/* Cône de lumière descendant */}
        <div
          className="absolute left-[-30%] top-[5px] w-[160%] h-14 pointer-events-none"
          style={{
            clipPath: 'polygon(5% 100%, 25% 0, 75% 0, 95% 100%)',
            background: 'linear-gradient(to bottom, rgba(245, 179, 53, 0.3), transparent)',
          }}
        />
      </div>
    </nav>
  );
};

export type { NavItem, LimelightNavProps };
