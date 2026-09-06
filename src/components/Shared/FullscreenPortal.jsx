import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * FullscreenPortal renders modal overlays inside the active HTML5 Fullscreen element
 * (e.g. document.fullscreenElement) when in fullscreen mode, or directly into document.body
 * when in standard windowed mode.
 *
 * Browsers running the Fullscreen API only display document.fullscreenElement and its
 * DOM descendants in the screen viewport; any fixed overlays or portals mounted outside of it
 * (such as at document.body or parent page roots) are completely masked/hidden by the browser.
 */
export default function FullscreenPortal({ children }) {
  const [mountNode, setMountNode] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.fullscreenElement || document.body;
    }
    return null;
  });

  useEffect(() => {
    const updateMountNode = () => {
      setMountNode(document.fullscreenElement || document.body);
    };

    updateMountNode();

    document.addEventListener('fullscreenchange', updateMountNode);
    document.addEventListener('webkitfullscreenchange', updateMountNode);
    document.addEventListener('mozfullscreenchange', updateMountNode);
    document.addEventListener('MSFullscreenChange', updateMountNode);

    return () => {
      document.removeEventListener('fullscreenchange', updateMountNode);
      document.removeEventListener('webkitfullscreenchange', updateMountNode);
      document.removeEventListener('mozfullscreenchange', updateMountNode);
      document.removeEventListener('MSFullscreenChange', updateMountNode);
    };
  }, []);

  if (!mountNode) return null;
  return createPortal(children, mountNode);
}
