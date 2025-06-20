"use client";

import React from 'react';
import SidebarSection from './SidebarSection';

interface TagsSectionProps {
  tags: string[];
}

const TagsSection = React.memo(function TagsSection({ tags }: TagsSectionProps) {
  return (
    <SidebarSection title="태그">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="px-3 py-2 sm:px-2 sm:py-1 text-sm sm:text-xs bg-gray-100 text-gray-700 hover:bg-amber-100 hover:text-amber-800 cursor-pointer rounded-md sm:rounded-none transition-colors min-h-[44px] sm:min-h-auto flex items-center"
            role="button"
            tabIndex={0}
            aria-label={`${tag} 태그`}
          >
            {tag}
          </span>
        ))}
        {tags.length === 0 && (
          <div className="text-center py-4 text-gray-500 w-full">
            <p className="text-sm">태그가 없습니다.</p>
          </div>
        )}
      </div>
    </SidebarSection>
  );
});

export default TagsSection; 