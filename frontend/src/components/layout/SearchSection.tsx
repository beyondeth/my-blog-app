"use client";

import React, { useCallback } from 'react';
import { FiSearch } from 'react-icons/fi';
import SidebarSection from './SidebarSection';

interface SearchSectionProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearch: (query: string) => void;
}

const SearchSection = React.memo(function SearchSection({
  searchQuery,
  onSearchQueryChange,
  onSearch,
}: SearchSectionProps) {
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  }, [onSearch, searchQuery]);

  return (
    <SidebarSection title="검색">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="검색어를 입력하세요"
          className="flex-1 px-3 py-2.5 sm:py-2 text-sm sm:text-xs border border-gray-300 rounded-md sm:rounded-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button
          type="submit"
          className="px-4 py-2.5 sm:px-3 sm:py-2 bg-amber-700 text-white rounded-md sm:rounded-none hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors min-w-[44px] flex items-center justify-center"
          aria-label="검색"
        >
          <FiSearch className="w-4 h-4" />
        </button>
      </form>
    </SidebarSection>
  );
});

export default SearchSection; 