"use client";

import { FiArrowLeft, FiEdit3, FiTrash2 } from 'react-icons/fi';

interface PostNavigationProps {
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function PostNavigation({
  canEdit,
  onBack,
  onEdit,
  onDelete,
}: PostNavigationProps) {
  return (
    <nav className="border-b border-gray-100 bg-white">
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* 왼쪽: Back 버튼 */}
          <button
            onClick={onBack}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors text-xs font-medium"
          >
            <FiArrowLeft className="mr-2 w-4 h-4" />
            Back
          </button>
          
          {/* 오른쪽: 수정/삭제 버튼 */}
          {canEdit && (
            <div className="flex items-center space-x-3">
              <button
                onClick={onEdit}
                className="flex items-center px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="수정"
              >
                <FiEdit3 className="mr-1 w-3 h-3" />
                수정
              </button>
              <button
                onClick={onDelete}
                className="flex items-center px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="삭제"
              >
                <FiTrash2 className="mr-1 w-3 h-3" />
                삭제
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
} 