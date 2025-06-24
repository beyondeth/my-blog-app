import { FiHeart } from 'react-icons/fi';
import { ButtonHTMLAttributes } from 'react';

interface LikeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  liked: boolean;
  likeCount: number;
  tooltip?: string;
}

export default function LikeButton({
  liked,
  likeCount,
  tooltip,
  ...props
}: LikeButtonProps) {
  return (
    <button
      type="button"
      className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors
        ${liked ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}
      `}
      aria-label={tooltip || (liked ? '좋아요 취소' : '좋아요')}
      title={tooltip}
      {...props}
    >
      <FiHeart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
      <span className="min-w-[18px] text-center font-mono tabular-nums">{likeCount}</span>
    </button>
  );
} 