/**
 * VWorld3DViewer - V-World 3D 건물 뷰어
 * 전용 페이지(/vworld3d.html)를 새 창으로 열기
 * V-World 3D WebGL API는 전용 페이지에서 동작
 */
import { useEffect } from 'react';

interface VWorld3DViewerProps {
  visible: boolean;
  onClose: () => void;
}

export default function CesiumViewerComponent({ visible, onClose }: VWorld3DViewerProps) {
  useEffect(() => {
    if (visible) {
      // 새 창으로 V-World 3D 전용 페이지 열기
      const w = window.open('/vworld3d.html', 'vworld3d', 'width=1200,height=800,menubar=no,toolbar=no');
      if (w) {
        // 새 창이 닫히면 상태 리셋
        const check = setInterval(() => {
          if (w.closed) {
            clearInterval(check);
            onClose();
          }
        }, 500);
      }
      // 버튼 상태 바로 리셋 (새 창이므로)
      onClose();
    }
  }, [visible, onClose]);

  return null;
}
