import React from 'react';
import { Card } from '@/components/ui/card';

export function SkeletonLine({ className = '' }) {
  return <div className={`skeleton h-3 rounded ${className}`} />;
}

export function SkeletonCard() {
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <SkeletonLine className="w-1/3" />
          <SkeletonLine className="w-1/2 h-6" />
        </div>
        <div className="skeleton h-11 w-11 rounded-xl ml-3" />
      </div>
      <SkeletonLine className="w-2/5" />
    </Card>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i} className="p-4 flex items-center gap-4">
          <div className="skeleton h-8 w-8 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonLine className="w-1/3" />
            <SkeletonLine className="w-1/2 h-2.5" />
          </div>
          <SkeletonLine className="w-16 h-6 rounded-full" />
        </Card>
      ))}
    </div>
  );
}

export default SkeletonCard;