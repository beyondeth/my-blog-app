"use client";

import React from 'react';
import { FiUser } from 'react-icons/fi';
import SidebarSection from './SidebarSection';

interface ProfileSectionProps {
  name?: string;
  description?: string;
}

const ProfileSection = React.memo(function ProfileSection({ 
  name = "개발자", 
  description = "풀스택 개발자입니다." 
}: ProfileSectionProps) {
  return (
    <SidebarSection title="프로필">
      <div className="flex items-center space-x-3 sm:space-x-3">
        <div className="w-14 h-14 sm:w-12 sm:h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
          <FiUser className="w-7 h-7 sm:w-6 sm:h-6 text-gray-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base sm:text-sm font-medium text-gray-900 break-words">{name}</div>
          <div className="text-sm sm:text-xs text-gray-500 break-words leading-relaxed">{description}</div>
        </div>
      </div>
    </SidebarSection>
  );
});

export default ProfileSection; 