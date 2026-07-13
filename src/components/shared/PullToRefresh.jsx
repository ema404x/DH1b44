import { useRef, useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const PULL_THRESHOLD = 70;
const MAX_PULL = 120;

/**
 * PullToRefresh — wraps page content and detects pull-down at scroll top
 * on the nearest scrollable parent. Shows a spinner and calls onRefresh.
 * Desktop behavior is untouched (touch events only).
 */
export default function PullToRefresh({ onRefresh, children }) {
  const containerRef = useRef(null);
  const scrollParentRef = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const pullDistRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    // Find nearest scrollable ancestor
    let el = containerRef.current?.parentElement;
    while (el) {
      const style = window.getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        scrollParentRef.current = el;
        el.style.overscrollBehavior = 'none';
        break;
      }
      el = el.parentElement;
    }

    const scrollEl = scrollParentRef.current;
    if (!scrollEl) return;

    const onTouchStart = (e) => {
      if (scrollEl.scrollTop > 0 || refreshingRef.current) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    };

    const onTouchMove = (e) => {
      if (!pullingRef.current) return;
      const diff = e.touches[0].clientY - startYRef.current;
      if (diff <= 0) { setPullDistance(0); pullDistRef.current = 0; return; }
      e.preventDefault();
      const damped = Math.min(diff * 0.5, MAX_PULL);
      setPullDistance(damped);
      pullDistRef.current = damped;
    };

    const onTouchEnd = async () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      if (pullDistRef.current >= PULL_THRESHOLD) {
        refreshingRef.current = true;
        setIsRefreshing(true);
        setPullDistance(PULL_THRESHOLD);
        try { await onRefreshRef.current?.(); }
        finally {
          refreshingRef.current = false;
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
        pullDistRef.current = 0;
      }
    };

    scrollEl.addEventListener('touchstart', onTouchStart, { passive: true });
    scrollEl.addEventListener('touchmove', onTouchMove, { passive: false });
    scrollEl.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      scrollEl.removeEventListener('touchstart', onTouchStart);
      scrollEl.removeEventListener('touchmove', onTouchMove);
      scrollEl.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const showIndicator = pullDistance > 0 || isRefreshing;

  return (
    <div ref={containerRef}>
      {showIndicator && (
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{
            height: isRefreshing ? PULL_THRESHOLD : pullDistance,
            transition: isRefreshing || pullDistance === 0 ? 'height 0.2s ease-out' : 'none',
          }}
        >
          <RefreshCw
            className={`text-primary ${isRefreshing ? 'animate-spin' : ''}`}
            style={{ opacity: isRefreshing ? 1 : progress }}
          />
        </div>
      )}
      {children}
    </div>
  );
}