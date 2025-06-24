import { useState, useCallback } from 'react';

interface ImageModalData {
  src: string;
  alt: string;
  title?: string;
}

interface UseImageModalReturn {
  modalImage: ImageModalData | null;
  isModalOpen: boolean;
  openModal: (imageData: ImageModalData) => void;
  closeModal: () => void;
  handleImageClick: (e: React.MouseEvent<HTMLElement>) => void;
}

/**
 * 이미지 모달 상태와 이벤트 처리를 관리하는 커스텀 훅
 * 
 * @returns 이미지 모달 상태와 핸들러들
 */
export function useImageModal(): UseImageModalReturn {
  const [modalImage, setModalImage] = useState<ImageModalData | null>(null);

  const openModal = useCallback((imageData: ImageModalData) => {
    setModalImage(imageData);
  }, []);

  const closeModal = useCallback(() => {
    setModalImage(null);
  }, []);

  // React 이벤트 위임을 활용한 이미지 클릭 처리
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    
    // 이미지 클릭 확인
    if (target.tagName === 'IMG' && target.dataset.clickable === 'true') {
      e.preventDefault();
      e.stopPropagation();
      
      const imgElement = target as HTMLImageElement;
      openModal({
        src: imgElement.src,
        alt: imgElement.alt || '이미지',
        title: imgElement.title || imgElement.alt || '이미지'
      });
    }
  }, [openModal]);

  return {
    modalImage,
    isModalOpen: !!modalImage,
    openModal,
    closeModal,
    handleImageClick
  };
} 