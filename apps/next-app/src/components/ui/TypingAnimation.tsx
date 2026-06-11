'use client';

import { useState, useEffect } from 'react';

interface TypingAnimationProps {
  text: string;
  speed?: number; // milliseconds per character
  repeatDelay?: number; // milliseconds before restarting
  className?: string;
  highlightWord?: string; // word to highlight with special styling
  highlightClassName?: string; // className for the highlighted word
  highlightUnderline?: boolean; // whether to add underline to highlighted word
}

export default function TypingAnimation({
  text,
  speed = 50,
  repeatDelay = 5000,
  className = '',
  highlightWord,
  highlightClassName = '',
  highlightUnderline = false,
}: TypingAnimationProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (!isTyping) {
      // Wait for repeatDelay, then reset
      const resetTimer = setTimeout(() => {
        setDisplayedText('');
        setCurrentIndex(0);
        setIsTyping(true);
      }, repeatDelay);
      return () => clearTimeout(resetTimer);
    }

    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, speed);
      return () => clearTimeout(timer);
    } else {
      // Finished typing, wait before resetting
      setIsTyping(false);
      return undefined;
    }
  }, [currentIndex, text, speed, isTyping, repeatDelay]);

  // Function to render text with highlighted word
  const renderText = () => {
    if (!highlightWord) {
      return <>{displayedText}</>;
    }

    const parts = displayedText.split(new RegExp(`(${highlightWord})`, 'gi'));
    return (
      <>
        {parts.map((part, index) => {
          if (part.toLowerCase() === highlightWord.toLowerCase()) {
            return (
              <span key={index} className={highlightClassName}>
                {highlightUnderline ? (
                  <span className="relative inline-block">
                    <span className="relative z-10">{part}</span>
                    <span className="absolute bottom-0 left-0 right-0 h-3 bg-crimson-600/20 -rotate-1"></span>
                  </span>
                ) : (
                  part
                )}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </>
    );
  };

  return (
    <span className={className}>
      {renderText()}
      {isTyping && currentIndex < text.length && (
        <span className="animate-pulse">|</span>
      )}
    </span>
  );
}

