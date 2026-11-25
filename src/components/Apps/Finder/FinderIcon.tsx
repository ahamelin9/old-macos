import React from 'react';
import { appInfo } from '../apps';
import type { FinderNode } from './finderFiles';

/**
 * A node's icon: the app's own for a project, and for the rest a folder, a
 * page or an internet location drawn in CSS (Finder.css). Small is the
 * sidebar's and the list view's size.
 */
const FinderIcon: React.FC<{ node: FinderNode; small?: boolean }> = ({ node, small }) => {
  const size = small ? ' finder-icon-small' : '';
  if (node.kind === 'app') {
    return <img className={`finder-icon finder-icon-app${size}`} src={appInfo(node.app).icon} alt="" draggable={false} />;
  }
  return (
    <span className={`finder-icon${size}`} aria-hidden="true">
      <span className={`finder-glyph finder-glyph-${node.kind}`}>
        {node.kind === 'link' && <span className="finder-glyph-at">@</span>}
      </span>
    </span>
  );
};

export default FinderIcon;
