import { useRef, useEffect, useState } from 'react';

interface TouchGestureOptions {
  onPinch?: (scale: number, center: { x: number, y: number }) => void;
  onPan?: (dx: number, dy: number, event: TouchEvent) => void;
  onDoubleTap?: (x: number, y: number) => void;
  onLongPress?: (x: number, y: number) => void;
  minScale?: number;
  maxScale?: number;
}

export const useTouchGesture = (
  ref: React.RefObject<HTMLElement>,
  {
    onPinch,
    onPan,
    onDoubleTap,
    onLongPress,
    minScale = 0.1,
    maxScale = 5
  }: TouchGestureOptions = {}
) => {
  const [isPinching, setIsPinching] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number, y: number } | null>(null);
  const lastTouchPosition = useRef<{ x: number, y: number } | null>(null);
  const lastTapTime = useRef<number>(0);
  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);

  // Calculate distance between two touch points
  const getDistance = (touches: TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Calculate center point between two touches
  const getCenter = (touches: TouchList) => {
    if (touches.length < 2) return null;
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  };

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch gesture starting
        setIsPinching(true);
        setIsPanning(false);
        lastTouchDistance.current = getDistance(e.touches) || 0;
        lastTouchCenter.current = getCenter(e.touches);
        
        // Clear any existing long press timers
        if (longPressTimeout.current) {
          clearTimeout(longPressTimeout.current);
          longPressTimeout.current = null;
        }
        
        // Prevent default to avoid page scaling
        e.preventDefault();
      } else if (e.touches.length === 1) {
        // Single touch - potential pan or long press
        lastTouchPosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setIsPanning(true);
        
        // Check for double tap
        const now = Date.now();
        if (now - lastTapTime.current < 300) {
          // Double tap detected
          if (onDoubleTap && lastTouchPosition.current) {
            onDoubleTap(lastTouchPosition.current.x, lastTouchPosition.current.y);
          }
          clearTimeout(longPressTimeout.current!);
        }
        lastTapTime.current = now;
        
        // Set timer for long press
        if (onLongPress) {
          longPressTimeout.current = setTimeout(() => {
            if (lastTouchPosition.current) {
              onLongPress(lastTouchPosition.current.x, lastTouchPosition.current.y);
            }
          }, 600);
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Clear long press timer if touch moves
      if (longPressTimeout.current) {
        clearTimeout(longPressTimeout.current);
        longPressTimeout.current = null;
      }

      if (isPinching && e.touches.length === 2) {
        // Handle pinch gesture (zoom)
        const distance = getDistance(e.touches);
        const center = getCenter(e.touches);
        
        if (distance && lastTouchDistance.current && center && lastTouchCenter.current && onPinch) {
          // Calculate scale factor
          let scale = distance / lastTouchDistance.current;
          scale = Math.max(minScale, Math.min(maxScale, scale));
          
          onPinch(scale, center);
          
          lastTouchDistance.current = distance;
          lastTouchCenter.current = center;
        }
        
        // Prevent default to disable browser pinch-zoom
        e.preventDefault();
      } else if (isPanning && e.touches.length === 1 && lastTouchPosition.current && onPan) {
        // Calculate movement deltas
        const dx = e.touches[0].clientX - lastTouchPosition.current.x;
        const dy = e.touches[0].clientY - lastTouchPosition.current.y;
        
        // Call the onPan callback with consistent direction
        // Set both to negative to invert, or both to positive for natural panning
        onPan(-dx, -dy, e);
        
        // Update the last touch position
        lastTouchPosition.current = { 
          x: e.touches[0].clientX, 
          y: e.touches[0].clientY 
        };
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Clear long press timer
      if (longPressTimeout.current) {
        clearTimeout(longPressTimeout.current);
        longPressTimeout.current = null;
      }
      
      // Reset state
      if (e.touches.length < 2) {
        setIsPinching(false);
      }
      
      if (e.touches.length === 0) {
        setIsPanning(false);
        lastTouchPosition.current = null;
      }
    };

    // Add event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);
    
    // Clean up event listeners on unmount
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPinching, isPanning, onPinch, onPan, onDoubleTap, onLongPress, ref, minScale, maxScale]);

  return {
    isPinching,
    isPanning
  };
};
